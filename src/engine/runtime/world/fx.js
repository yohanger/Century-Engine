// Lluvia y nieve. Las partículas se animan ENTERAS en la GPU (el CPU solo integra un desplazamiento por fotograma); se reparten en un
// volumen alrededor de la cámara que se repite (módulo), así que cuestan lo mismo en cualquier mapa. Se dibujan con la profundidad de la
// escena (no atraviesan paredes) y se ven igual en el editor (vista viva) que jugando.
// Bloque G (0.26.11): update() acepta `occlude` 0–1 (oclusión acústica del oyente). Con oclusión alta la lluvia se suprime
// visualmente (bajo un techo no llueve dentro) y las salpicaduras desaparecen. La nieve se reduce menos (puede entrar por ventanas).
//
// Gotas cercanas y lejanas como partículas cortas con silueta suave, sin cortina de tiras largas.
// Los impactos visibles se detectan con una muestra limitada de las MISMAS trayectorias GPU;
// sus anillos se orientan a la cara impactada. El volumen físico proviene del clima vía WaterWorld.
// La nieve son copos con vaivén, tamaño por distancia y deriva del viento.
import { rainPoint, traceRainSegment } from './rain-impact.js'
import * as THREE from 'three'

const SIZE = 38          // lado del volumen de las gotas (m)
const HEIGHT = 26        // alto (m)
const MAX_RAIN = 7000
const MAX_MIST = 1800
const MAX_SNOW = 7000
const MAX_SPLASH = 520
const TRACKED_DROPS = 384    // trayectorias visuales muestreadas, nunca cuerpos rígidos
const MAX_IMPACT_CASTS = 64  // raycasts máximos por frame; el volumen ya lo contabiliza World/WaterWorld

const WRAP = /* glsl */`
uniform vec3 uCam; uniform vec3 uOff; uniform float uSize, uHeight;
vec3 wrapAround(vec3 p) {
  vec3 c = uCam - vec3(0.0, uHeight * 0.35, 0.0);
  vec3 q = p - c;
  q.x = mod(q.x + uSize * 0.5, uSize) - uSize * 0.5;
  q.z = mod(q.z + uSize * 0.5, uSize) - uSize * 0.5;
  q.y = mod(q.y, uHeight);
  return c + q;
}`

// tira orientada a la cámara: position.x ∈ [−0.5, 0.5] a lo ancho, position.y ∈ [0, 1] a lo largo (0 = cabeza, abajo)
const RAIN_VERT = /* glsl */`
${WRAP}
attribute vec4 aSeed;
uniform vec3 uDir; uniform float uLen, uWidth, uFade;
varying vec2 vUv; varying float vK;
void main() {
  vec3 start = vec3(aSeed.x * uSize, aSeed.w * uHeight, aSeed.y * uSize);
  vec3 p = wrapAround(start + uOff * vec3(1.0, 0.85 + 0.3 * aSeed.z, 1.0));
  vec3 toCam = uCam - p;
  float dist = length(toCam);
  vec3 right = cross(uDir, toCam / max(dist, 1e-3));
  if (dot(right, right) < 1e-5) right = cross(uDir, vec3(1.0, 0.0, 0.0));
  right = normalize(right);
  float len = uLen * (0.7 + 0.6 * aSeed.z);
  float w = uWidth * (0.7 + 0.5 * aSeed.x); // la distancia no convierte gotas en una cortina
  vec3 wp = p - uDir * len * position.y + right * position.x * w;
  vUv = vec2(position.x + 0.5, position.y);
  vK = (1.0 - smoothstep(uSize * 0.25, uSize * 0.5, dist)) * (0.5 + 0.5 * aSeed.z) * uFade;   // se desvanecen en los bordes del volumen
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`
const RAIN_FRAG = /* glsl */`
uniform vec3 uColor; uniform float uAlpha;
varying vec2 vUv; varying float vK;
void main() {
  // Silueta de gota con borde suave; desenfoque corto, no tira rectangular.
  vec2 q = (vUv - vec2(0.5, 0.43)) * vec2(2.0, 1.7);
  float droplet = 1.0 - smoothstep(0.46, 1.0, length(q));
  float glint = 0.75 + 0.25 * (1.0 - smoothstep(0.1, 0.6, abs(vUv.y - 0.32)));
  gl_FragColor = vec4(uColor, droplet * glint * uAlpha * vK);
}`

const SNOW_VERT = /* glsl */`
${WRAP}
attribute vec4 aSeed;
uniform float uScale, uTime;
void main() {
  vec3 start = vec3(aSeed.x * uSize, aSeed.w * uHeight, aSeed.y * uSize);
  vec3 p = wrapAround(start + uOff * vec3(1.0, 0.8 + 0.4 * aSeed.z, 1.0));
  p.x += sin(uTime * 0.8 + aSeed.z * 40.0) * 0.45; p.z += cos(uTime * 0.6 + aSeed.w * 40.0) * 0.45;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_PointSize = clamp(uScale * (0.03 + 0.03 * aSeed.z) / max(0.3, -mv.z), 1.5, 22.0);
  gl_Position = projectionMatrix * mv;
}`
const SNOW_FRAG = /* glsl */`
uniform vec3 uColor; uniform float uAlpha;
void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.15, d); gl_FragColor = vec4(uColor, a * uAlpha); }`

// salpicadura: un cuadrito horizontal sobre el suelo con un anillo que se expande (aAge 0 → 1)
const SPL_VERT = /* glsl */`
attribute vec4 aSplash;      // xyz = punto de impacto, w = edad 0–1
attribute vec3 aNormal;      // normal de la cara impactada
uniform float uSize;
varying vec2 vP; varying float vAge;
void main() {
  vAge = aSplash.w;
  float r = (0.025 + 0.085 * aSplash.w) * uSize;
  vP = position.xy * 2.0;
  vec3 n = normalize(aNormal);
  vec3 tangent = normalize(cross(abs(n.y) > 0.94 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0), n));
  vec3 bitangent = cross(n, tangent);
  vec3 wp = aSplash.xyz + n * 0.012 + (tangent * position.x + bitangent * position.y) * (2.0 * r);
  gl_Position = aSplash.w >= 1.0 ? vec4(2.0, 2.0, 2.0, 1.0) : projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`
const SPL_FRAG = /* glsl */`
uniform vec3 uColor; uniform float uAlpha;
varying vec2 vP; varying float vAge;
void main() {
  float d = length(vP);
  float ring = (1.0 - smoothstep(0.0, 0.18, abs(d - (0.35 + 0.6 * vAge))));
  float flash = (1.0 - smoothstep(0.0, 0.35, d)) * (1.0 - smoothstep(0.0, 0.25, vAge));
  float a = (ring * (1.0 - vAge) + flash * 0.8) * uAlpha;
  if (a < 0.01 || d > 1.0) discard;
  gl_FragColor = vec4(uColor, a);
}`

function seeds(n) {
  const s = new Float32Array(n * 4)
  let r = 123456789
  const rnd = () => { r ^= r << 13; r ^= r >>> 17; r ^= r << 5; return ((r >>> 0) % 100000) / 100000 }
  for (let i = 0; i < s.length; i++) s[i] = rnd()
  return s
}

/** Geometría instanciada de tiras (cuadrito [−0.5, 0.5] × [0, 1]). */
function stripGeo(n) {
  const g = new THREE.InstancedBufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3))
  g.setIndex([0, 1, 2, 0, 2, 3])
  g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds(n), 4))
  g.instanceCount = 0
  return g
}

export class PrecipFX {
  /** `ground` y `impact` son consultas de escena; no alteran el volumen de WaterWorld. */
  constructor(scene, ground = null) {
    this.ground = ground
    this.onImpact = null // solo perturbación visual en agua (sin modificar volumen)
    this.impact = null // (origen [x,y,z], destino [x,y,z]) → { point:[x,y,z], normal:[x,y,z] } | null
    this._tracked = new Float32Array(TRACKED_DROPS * 3)
    this._rainSample = new Float64Array(3) // reutilizar buffer evita asignaciones por gota
    this._tracking = false
    this._splashNext = 0
    this._splashActive = false
    const common = (size, height) => ({ uCam: { value: new THREE.Vector3() }, uOff: { value: new THREE.Vector3() }, uSize: { value: size }, uHeight: { value: height }, uColor: { value: new THREE.Color(0.75, 0.8, 0.9) }, uAlpha: { value: 0.4 } })
    const rainMat = (size, height, extra) => new THREE.ShaderMaterial({ vertexShader: RAIN_VERT, fragmentShader: RAIN_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, uniforms: { ...common(size, height), uDir: { value: new THREE.Vector3(0, -1, 0) }, uLen: { value: 0.5 }, uWidth: { value: 0.012 }, uFade: { value: 1 }, ...extra } })
    this.rainMat = rainMat(SIZE, HEIGHT)
    this.rain = new THREE.Mesh(stripGeo(MAX_RAIN), this.rainMat)
    this.mistMat = rainMat(SIZE * 2.6, HEIGHT * 2.2)
    this.mist = new THREE.Mesh(stripGeo(MAX_MIST), this.mistMat)

    const sn = seeds(MAX_SNOW)
    const sg = new THREE.BufferGeometry()
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_SNOW * 3), 3))
    sg.setAttribute('aSeed', new THREE.BufferAttribute(sn, 4))
    this.snowMat = new THREE.ShaderMaterial({ vertexShader: SNOW_VERT, fragmentShader: SNOW_FRAG, transparent: true, depthWrite: false, fog: false, uniforms: { ...common(SIZE, HEIGHT), uScale: { value: 800 }, uTime: { value: 0 } } })
    this.snow = new THREE.Points(sg, this.snowMat)

    const spg = new THREE.InstancedBufferGeometry()
    spg.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3))
    spg.setIndex([0, 1, 2, 0, 2, 3])
    this.splashData = new Float32Array(MAX_SPLASH * 4).fill(0); for (let i = 0; i < MAX_SPLASH; i++) this.splashData[i * 4 + 3] = 1
    this.splashAttr = new THREE.InstancedBufferAttribute(this.splashData, 4).setUsage(THREE.DynamicDrawUsage)
    spg.setAttribute('aSplash', this.splashAttr)
    this.splashNormals = new Float32Array(MAX_SPLASH * 3)
    for (let i = 0; i < MAX_SPLASH; i++) this.splashNormals[i * 3 + 1] = 1
    this.splashNormalAttr = new THREE.InstancedBufferAttribute(this.splashNormals, 3).setUsage(THREE.DynamicDrawUsage)
    spg.setAttribute('aNormal', this.splashNormalAttr)
    spg.instanceCount = MAX_SPLASH
    this.splashMat = new THREE.ShaderMaterial({ vertexShader: SPL_VERT, fragmentShader: SPL_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, uniforms: { uColor: { value: new THREE.Color(0.8, 0.85, 0.95) }, uAlpha: { value: 0.35 }, uSize: { value: 1 } } })
    this.splash = new THREE.Mesh(spg, this.splashMat)
    this.splashLife = new Float32Array(MAX_SPLASH).fill(1)   // edad 0–1 de cada una

    // GTAO reemplaza el shader de los quads transparentes: su G-buffer no debe dibujar el quad base.
    // Los copos son Points; GTAO ya los excluye por tipo mediante Three.js.
    for (const o of [this.rain, this.mist, this.splash]) o.userData.lfExcludeFromAO = true
    for (const o of [this.rain, this.mist, this.snow, this.splash]) { o.frustumCulled = false; o.visible = false; o.renderOrder = 5; scene.add(o) }
    this._rt = 0; this._rng = 1
  }

  _rnd() { this._rng = (this._rng * 16807) % 2147483647; return this._rng / 2147483647 }

  /**
   * Avanza y coloca la precipitación. `f` = World.frame(). Devuelve true si hay algo que dibujar (el visor sigue renderizando).
   * `px` = alto del buffer de dibujo en píxeles (tamaño de los copos).
   * `occlude` 0–1 = oclusión del oyente (bloque G): bajo un techo la lluvia se suprime visualmente.
   * `windLocal` proviene de World.windAt3D en la cámara (compartido con NatureFX).
   */
  update(f, cam, dt, px = 720, occlude = 0, windLocal = null) {
    const rain = f ? f.precip.rain : 0, snow = f ? f.precip.snow : 0
    // Bajo techo: la lluvia desaparece de forma suave a partir de occ 0.5; a 0.9 ya no se ve ninguna gota.
    const rainScale = rain * Math.max(0, 1 - Math.max(0, occlude - 0.5) * 2.5)
    this.rain.visible = this.mist.visible = rainScale > 0.01
    this.snow.visible = snow > 0.01
    this.splash.visible = rainScale > 0.01 || this._splashActive
    if (!this.rain.visible && !this.snow.visible && !this._splashActive) {
      this._tracking = false
      return false
    }
    dt = Math.min(Math.max(dt, 0), 0.1); this._rt += dt
    const light = Math.min(1, 0.22 + 0.78 * (f?.ambientMul ?? 1))
    const hz = new THREE.Color(f?.skyHorizon ?? 0x8899aa)
    const wind = windLocal ?? f?.wind
    const wx = wind?.x ?? 0, wz = wind?.z ?? 0
    if (this.rain.visible) {
      const fall = 8.5 + 4 * rain
      const dir = new THREE.Vector3(wx * 0.75, -fall, wz * 0.75).normalize()
      const col = new THREE.Color(0.82, 0.86, 0.94).lerp(hz, 0.3).multiplyScalar(light)
      for (const [mat, geo, max, k] of [[this.rainMat, this.rain.geometry, MAX_RAIN, 1], [this.mistMat, this.mist.geometry, MAX_MIST, 0.6]]) {
        const m = mat.uniforms
        m.uOff.value.x += wx * 0.75 * dt * k; m.uOff.value.z += wz * 0.75 * dt * k; m.uOff.value.y -= fall * dt * k
        m.uCam.value.copy(cam.position)
        m.uDir.value.copy(dir)
        m.uColor.value.copy(col)
        geo.instanceCount = Math.floor(max * Math.min(1, rainScale))
      }
      const a = this.rainMat.uniforms
      a.uLen.value = 0.075 + 0.065 * rain; a.uWidth.value = 0.019; a.uAlpha.value = (0.56 + 0.25 * rain) * Math.max(0, 1 - occlude * 0.9)
      const b = this.mistMat.uniforms
      b.uLen.value = 0.12 + 0.08 * rain; b.uWidth.value = 0.012; b.uAlpha.value = (0.045 + 0.025 * rain) * Math.max(0, 1 - occlude * 0.9)
      this._traceDrops(cam, dt, fall, rainScale)
    }
    else this._tracking = false
    this._ageSplashes(dt)
    this.splash.visible = this._splashActive
    if (this.snow.visible) {
      const m = this.snowMat.uniforms
      m.uOff.value.x += wx * 0.55 * dt; m.uOff.value.z += wz * 0.55 * dt; m.uOff.value.y -= (1 + 0.5 * snow) * dt
      m.uCam.value.copy(cam.position); m.uTime.value = this._rt
      m.uScale.value = px / (2 * Math.tan((cam.fov || 60) * Math.PI / 360))
      m.uColor.value.set(1, 1, 1).lerp(hz, 0.15).multiplyScalar(0.55 + 0.45 * light)
      m.uAlpha.value = 0.55 + 0.35 * snow
      this.snow.geometry.setDrawRange(0, Math.floor(MAX_SNOW * Math.min(1, snow)))
    }
    return true
  }

  /** Solo rastreamos una muestra de gotas de la misma geometría GPU; nunca se añade volumen aquí. */
  _traceDrops(cam, dt, fall, rain) {
    const data = this.rain.geometry.getAttribute('aSeed').array
    const off = this.rainMat.uniforms.uOff.value
    const size = this.rainMat.uniforms.uSize.value, height = this.rainMat.uniforms.uHeight.value
    const prev = this._tracked
    let castCount = 0
    for (let i = 0; i < TRACKED_DROPS; i++) {
      const k = Math.floor(i * MAX_RAIN / TRACKED_DROPS) * 4, v = i * 3
      const p = rainPoint(data, off, cam.position, size, height, k, this._rainSample)
      if (this._tracking && dt > 0 && castCount < MAX_IMPACT_CASTS) {
        const origin = [prev[v], prev[v + 1], prev[v + 2]]
        const fallDist = origin[1] - p[1]
        // La discontinuidad del volumen que sigue a la cámara no es una caída real.
        if (fallDist > 0 && fallDist < fall * dt * 2.5 &&
            Math.abs(origin[0] - p[0]) < 1 + dt * fall && Math.abs(origin[2] - p[2]) < 1 + dt * fall &&
            p[1] < cam.position.y + 6 && p[1] > cam.position.y - 7) {
          castCount++
          const hit = traceRainSegment(origin, p, this.ground, this.impact)
          if (hit && this._rnd() < rain) this._addSplash(hit)
        }
      }
      prev[v] = p[0]; prev[v + 1] = p[1]; prev[v + 2] = p[2]
    }
    this._tracking = true
  }

  /** Cada anillo se coloca en la cara impactada, incluida la de una primitiva inclinada. */
  _addSplash(hit) {
    const i = this._splashNext++ % MAX_SPLASH, n = i * 3, k = i * 4
    this.splashData[k] = hit.point[0]; this.splashData[k + 1] = hit.point[1]; this.splashData[k + 2] = hit.point[2]
    this.splashData[k + 3] = 0
    this.splashNormals.set(hit.normal, n)
    this.splashLife[i] = 0
    this.onImpact?.(hit)
    this._splashActive = true
    this.splashAttr.needsUpdate = true
    this.splashNormalAttr.needsUpdate = true
  }

  /** Una salpicadura termina sin renacer en una posición aleatoria. */
  _ageSplashes(dt) {
    const d = this.splashData, life = this.splashLife
    let active = false
    for (let i = 0; i < MAX_SPLASH; i++) {
      if (life[i] >= 1) continue
      life[i] = Math.min(1, life[i] + dt / 0.42)
      d[i * 4 + 3] = life[i]
      if (life[i] < 1) active = true
    }
    this._splashActive = active
    this.splashAttr.needsUpdate = true
  }

  resetImpacts() {
    this._tracking = false
    this._splashActive = false
    this._splashNext = 0
    this.splashLife.fill(1)
    for (let i = 0; i < MAX_SPLASH; i++) this.splashData[i * 4 + 3] = 1
    this.splashAttr.needsUpdate = true
    this.splash.visible = false
  }

  dispose() {
    this.impact = null; this.ground = null; this.onImpact = null
    for (const o of [this.rain, this.mist, this.snow, this.splash]) { o.parent?.remove(o); o.geometry.dispose(); o.material.dispose() }
  }
}
