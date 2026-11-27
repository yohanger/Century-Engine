import * as THREE from 'three'
import { VfxSimulation } from './simulation.js'

const VERTEX = /* glsl */`
attribute vec3 aCenter;
attribute vec3 aColor;
attribute vec3 aParams; // tamaño, opacidad, rotación en radianes
varying vec2 vUv;
varying vec3 vColor;
varying float vOpacity;
void main() {
  vec2 corner = position.xy;
  float cs = cos(aParams.z), sn = sin(aParams.z);
  vec2 turned = vec2(cs * corner.x - sn * corner.y, sn * corner.x + cs * corner.y) * aParams.x;
  vec4 center = modelViewMatrix * vec4(aCenter, 1.0);
  center.xy += turned;
  gl_Position = projectionMatrix * center;
  vUv = uv;
  vColor = aColor;
  vOpacity = aParams.y;
}`
const FRAGMENT = /* glsl */`
uniform sampler2D uMap;
varying vec2 vUv;
varying vec3 vColor;
varying float vOpacity;
void main() {
  // Sin textura no se evalúa un sampler nulo: algunos drivers devuelven negro.
  vec4 sampleColor = vec4(1.0);
  float alpha = 1.0 - smoothstep(0.12, 0.5, length(vUv - vec2(0.5)));
#ifdef VFX_HAS_MAP
  sampleColor = texture2D(uMap, vUv);
  alpha = sampleColor.a;
#endif
  vec3 color = sampleColor.rgb * vColor;
  alpha *= vOpacity;
  if (alpha <= 0.001) discard;
  gl_FragColor = vec4(color, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

/** Un quad instanciado por emisor. No es dueño de la textura compartida. */
export class VfxBillboardRenderer {
  constructor(simulation, { texture = null } = {}) {
    if (!(simulation instanceof VfxSimulation)) throw new Error('VFX: simulación requerida')
    if (simulation.resource.appearance.textureId && !texture) throw new Error(`VFX: textura ausente (${simulation.resource.appearance.textureId})`)
    this.simulation = simulation
    this.geometry = new THREE.InstancedBufferGeometry()
    this.geometry.setIndex([0, 1, 2, 0, 2, 3])
    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      -0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
    ], 3))
    this.geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2))
    this._centers = new Float32Array(simulation.capacity * 3)
    this._colors = new Float32Array(simulation.capacity * 3)
    this._params = new Float32Array(simulation.capacity * 3)
    this._distances = new Float32Array(simulation.capacity)
    this._order = new Uint16Array(simulation.capacity)
    this._compareDepth = (a, b) => this._distances[b] - this._distances[a] || a - b
    this.geometry.setAttribute('aCenter', new THREE.InstancedBufferAttribute(this._centers, 3).setUsage(THREE.DynamicDrawUsage))
    this.geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(this._colors, 3).setUsage(THREE.DynamicDrawUsage))
    this.geometry.setAttribute('aParams', new THREE.InstancedBufferAttribute(this._params, 3).setUsage(THREE.DynamicDrawUsage))
    this.geometry.instanceCount = 0
    const additive = simulation.resource.appearance.blend === 'additive'
    this.material = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: texture } },
      defines: texture ? { VFX_HAS_MAP: 1 } : {},
      vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthTest: true, depthWrite: false, side: THREE.DoubleSide,
      toneMapped: true,
    })
    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.mesh.frustumCulled = false // El quad y su centro se mueven dentro de un pool.
    this.mesh.castShadow = false
    this.mesh.receiveShadow = false
    this.mesh.name = 'VFX billboards'
    // GTAO sustituye el shader y convertiría el quad base en un oclusor opaco.
    this.mesh.userData.lfExcludeFromAO = true
    this._disposed = false
  }

  setTexture(texture) {
    if (this._disposed) throw new Error('VFX: renderer destruido')
    if (this.simulation.resource.appearance.textureId && !texture) throw new Error('VFX: falta la textura referenciada')
    this.material.uniforms.uMap.value = texture
    const hadMap = !!this.material.defines.VFX_HAS_MAP
    if (hadMap !== !!texture) {
      this.material.defines = texture ? { VFX_HAS_MAP: 1 } : {}
      this.material.needsUpdate = true
    }
  }

  /** Copia solo las partículas vivas; alpha se ordena de lejos a cerca dentro del emisor. */
  sync(camera = null) {
    if (this._disposed) throw new Error('VFX: renderer destruido')
    const sim = this.simulation, count = sim.count
    const order = this._order, distances = this._distances
    const alpha = sim.resource.appearance.blend === 'alpha' && camera
    if (alpha) {
      this.mesh.updateWorldMatrix(true, false)
      camera.updateWorldMatrix(true, false)
      const model = this.mesh.matrixWorld.elements, view = camera.matrixWorldInverse.elements
      for (let i = 0; i < count; i++) {
        const k = i * 3, x = sim.position[k], y = sim.position[k + 1], z = sim.position[k + 2]
        const wx = model[0] * x + model[4] * y + model[8] * z + model[12]
        const wy = model[1] * x + model[5] * y + model[9] * z + model[13]
        const wz = model[2] * x + model[6] * y + model[10] * z + model[14]
        distances[i] = -(view[2] * wx + view[6] * wy + view[10] * wz + view[14])
        order[i] = i
      }
      order.subarray(0, count).sort(this._compareDepth)
    }
    let visibleParticles = false
    for (let i = 0; i < count; i++) {
      const source = alpha ? order[i] : i, src = source * 3, dst = i * 3
      for (let c = 0; c < 3; c++) {
        this._centers[dst + c] = sim.position[src + c]
        this._colors[dst + c] = sim.color[src + c] * (sim.visualTint?.[c] ?? 1)
      }
      this._params[dst] = sim.size[source] * (sim.visualSizeAt?.(sim.position[src + 1]) ?? 1)
      this._params[dst + 1] = sim.opacity[source] * (sim.visualOpacity ?? 1)
      this._params[dst + 2] = sim.rotation[source]
      if (this._params[dst + 1] > 0.001 && this._params[dst] > 0) visibleParticles = true
    }
    for (const attr of ['aCenter', 'aColor', 'aParams']) this.geometry.getAttribute(attr).needsUpdate = true
    this.geometry.instanceCount = count
    this.mesh.visible = visibleParticles
  }

  dispose() {
    if (this._disposed) return
    this._disposed = true
    this.mesh.parent?.remove(this.mesh)
    this.geometry.dispose()
    this.material.dispose()
    this.material.uniforms.uMap.value = null // El asset conserva la propiedad de la textura.
  }
}
