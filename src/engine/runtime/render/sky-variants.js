import * as THREE from 'three'

const zeroColor = v => (v.r ?? v.x) === 0 && (v.g ?? v.y) === 0 && (v.b ?? v.z) === 0

/** Solo especializa estados discretos; posiciones, densidad, luz y tiempo siguen siendo uniformes. */
export function skyVariantState(u) {
  const clouds = u.uClouds.value
  const cells = clouds === 1 ? u.uCCells.value : 0
  const state = {
    mode: u.uMode.value, clouds, cells,
    volume: cells === 1 && u.uCVolumeOrigin.value.w > 0,
    noRoot: u.uTornadoCloud.value.w === 0,
    noOrganization: u.uTornadoOrganization.value.w === 0,
    noMoonLight: zeroColor(u.uMoonColor.value),
    noCelestials: u.uStars.value === 0 && u.uMoonVis.value === 0,
  }
  state.key = [state.mode, clouds, cells, +state.volume, +state.noRoot,
    +state.noOrganization, +state.noMoonLight, +state.noCelestials].join(':')
  return state
}

/** Conserva las fórmulas originales: el compilador puede eliminar únicamente ramas inalcanzables. */
export function specializeSkyFragment(source, state) {
  const constant = (name, type, value) => {
    source = source.replace(new RegExp(`uniform\\s+${type}\\s+${name}\\s*;`), `const ${type} ${name} = ${value};`)
  }
  constant('uMode', 'int', String(state.mode))
  constant('uCCells', 'int', String(state.cells))
  // El origen y la mezcla del volumen siguen vivos; solo se fija la disponibilidad de la ruta 3D.
  if (state.volume) source = source.replace('if (uCVolumeOrigin.w > 0.0)', 'if (true)')
  if (state.noRoot) constant('uTornadoCloud', 'vec4', 'vec4(0.0)')
  if (state.noOrganization) constant('uTornadoOrganization', 'vec4', 'vec4(0.0)')
  if (state.noMoonLight) constant('uMoonColor', 'vec3', 'vec3(0.0)')
  if (state.noCelestials) source = source.replace('uniform float uStars, uMoonVis, uFlash;', 'const float uStars = 0.0, uMoonVis = 0.0; uniform float uFlash;')
  return source
}

/** Caché acotada de variantes. Durante compilación y transiciones siempre puede dibujar el shader completo. */
export class SkyVariants {
  constructor(vp, limit = 8) {
    this.vp = vp
    this.base = vp.skyMat
    this.limit = limit
    this.enabled = true // interruptor A/B de diagnóstico; no se guarda en el proyecto
    this.entries = new Map()
    this.generation = 0
    this.scene = new THREE.Scene()
    this.mesh = new THREE.Mesh(vp.sky.geometry, this.base)
    this.mesh.frustumCulled = false
    this.scene.add(this.mesh)
    this.linearTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType })
  }

  _select(material, status, key = '') {
    this.vp.sky.material = material
    this.vp.envScene.children[0].material = material
    const signature = `${status}:${key}`
    if (signature !== this._published) {
      this._published = signature
      this.vp.perf.stats.extra.skyVariant = { status, key, cached: this.entries.size }
    }
    return material
  }

  update() {
    const vp = this.vp, r = vp.renderer
    if (!this.enabled || this.disposed || vp._glLost || vp.nativeBackend?.active) return this._select(this.base, 'generic')
    // Evita compilar sincrónicamente al aparecer un fenómeno nuevo en drivers sin KHR.
    if (!r.extensions.has('KHR_parallel_shader_compile')) return this._select(this.base, 'unavailable')
    const state = skyVariantState(this.base.uniforms)
    let entry = this.entries.get(state.key)
    if (entry) {
      this.entries.delete(state.key); this.entries.set(state.key, entry)
      return this._select(entry.ready ? entry.material : this.base, entry.ready ? 'specialized' : entry.failed ? 'failed' : 'compiling', state.key)
    }
    this._select(this.base, 'compiling', state.key)
    if (this.entries.size >= this.limit) {
      const oldest = [...this.entries].find(([, value]) => !value.pending)
      if (!oldest) return this.base
      oldest[1].material.dispose(); this.entries.delete(oldest[0])
    }
    const material = this.base.clone()
    material.uniforms = this.base.uniforms
    material.fragmentShader = specializeSkyFragment(this.base.fragmentShader, state)
    entry = { material, ready: false, pending: true, failed: false }
    this.entries.set(state.key, entry)
    const generation = this.generation
    try {
      // Canvas con tone mapping y buffers lineales del compositor/IBL necesitan programas distintos.
      // Son secuenciales: compileAsync consulta currentProgram, que cambia al compilar el segundo destino.
      this._compileAt(material, null).then(() => {
        if (!this.disposed && this.generation === generation) return this._compileAt(material, this.linearTarget)
      }).then(() => {
        if (!this.disposed && this.generation === generation) return this._compileAt(material, this.linearTarget, vp.envScene)
      }).then(() => {
        if (!this.disposed && this.generation === generation) {
          entry.ready = true
          vp.requestRender()
        }
      }).catch(() => { entry.failed = true }).finally(() => { entry.pending = false })
    } catch {
      entry.failed = true; entry.pending = false
    }
    return this.base
  }

  _compileAt(material, destination, scene = this.vp.scene) {
    const r = this.vp.renderer, target = r.getRenderTarget()
    const face = r.getActiveCubeFace(), mip = r.getActiveMipmapLevel()
    this.mesh.material = material
    try {
      r.setRenderTarget(destination)
      return r.compileAsync(this.scene, this.vp.camera, scene)
    } finally {
      r.setRenderTarget(target, face, mip)
      this.mesh.material = this.base
    }
  }

  reset() {
    this.generation++
    this._select(this.base, 'generic')
    for (const entry of this.entries.values()) entry.material.dispose()
    this.entries.clear()
  }

  dispose() { this.reset(); this.disposed = true; this.linearTarget.dispose(); this.scene.clear() }
}
