import { toRaw } from '@vue/reactivity'
import { Box3 } from 'three'
import { OCCLUSION_BAKE_VERSION, occluderMesh, occluderSide, resolveStaticMesh, worldBounds } from './occlusion-static.js'
import { meshOcclusionSignature } from './occlusion-patches.js'

const status = { disabled: 'Desactivado', 'no-bake': 'Sin horneado', 'outside-grid': 'Fuera del volumen', 'camera-mode': 'Vista no compatible' }

export function cellAt(grid, x, y, z) {
  if (!Array.isArray(grid?.origin) || !Array.isArray(grid?.dimensions) || !(grid.size > 0)) return -1
  const ix = Math.floor((x - grid.origin[0]) / grid.size)
  const iy = Math.floor((y - grid.origin[1]) / grid.size)
  const iz = Math.floor((z - grid.origin[2]) / grid.size)
  const [nx, ny, nz] = grid.dimensions
  if (![ix, iy, iz].every(Number.isFinite) || ix < 0 || iy < 0 || iz < 0 || ix >= nx || iy >= ny || iz >= nz) return -1
  return ix + nx * (iy + ny * iz)
}

// El AABB real de cualquier malla, no el tamaño fijo de una primitiva antigua.
function inFrontOfNear(mesh, camera) {
  const box = worldBounds(mesh, new Box3())
  const center = box.getCenter(mesh.position.clone())
  const half = box.getSize(mesh.position.clone()).multiplyScalar(0.5)
  center.applyMatrix4(camera.matrixWorldInverse)
  const e = camera.matrixWorldInverse.elements
  const radius = Math.abs(e[2])*half.x + Math.abs(e[6])*half.y + Math.abs(e[10])*half.z
  return -center.z - radius > camera.near + 0.01
}

export class CameraOcclusion {
  constructor(vp) {
    this.vp = vp
    this.graph = null
    this.masked = []
    this.lastReason = 'disabled'
    this.lastCellPairs = null
    this.lastValidOccluders = null
    this.drawing = false
    this.revealing = false
    this.bounds = new Box3()
  }

  get enabled() { return this.graph?.host.project?.render?.staticOcclusion === true }

  _mesh(entry, camera) {
    if (!entry || !Array.isArray(entry.path)) return null
    const mesh = resolveStaticMesh(this.graph, entry.id, entry.path)
    if (!mesh?.layers.test(camera.layers)) return null
    mesh.updateWorldMatrix(true, false)
    return mesh
  }

  _mask(camera) {
    const project = this.graph.host.project
    const bake = toRaw(project.environment?.occlusionBake)
    if (bake?.version !== OCCLUSION_BAKE_VERSION || !bake.grid || !Array.isArray(bake.cells)) return 'no-bake'

    camera.updateWorldMatrix(true, false)
    const p = camera.matrixWorld.elements
    const index = cellAt(bake.grid, p[12], p[13], p[14])
    if (index < 0) return 'outside-grid'
    const pairs = bake.cells[index]
    this.lastCellPairs = Array.isArray(pairs) ? Math.floor(pairs.length / 2) : 0
    this.lastValidOccluders = 0
    if (!Array.isArray(pairs) || !pairs.length) return ''

    const checked = new Map()
    const fingerprints = new Map()
    const witnesses = new Set()
    const hidden = []
    for (let i = 0; i < pairs.length; i += 2) {
      const occluderIndex = pairs[i + 1]
      if (!checked.has(occluderIndex)) {
        const occluder = bake.occluders?.[occluderIndex]
        const bakedMesh = bake.meshes?.[occluder?.mesh]
        const mesh = this._mesh(bakedMesh, camera)
        const valid = !!mesh && occluderMesh(mesh) && inFrontOfNear(mesh, camera) &&
          mesh.matrixWorld.elements.every((value, axis) => value === bakedMesh.matrix?.[axis]) &&
          (() => {
            if (!fingerprints.has(mesh)) fingerprints.set(mesh, meshOcclusionSignature(mesh))
            return fingerprints.get(mesh) === bakedMesh.signature && occluderSide(mesh) === occluder.side
          })()
        checked.set(occluderIndex, !!valid)
        if (valid) witnesses.add(mesh)
      }
      if (!checked.get(occluderIndex)) continue

      const entry = bake.meshes?.[pairs[i]]
      const mesh = this._mesh(entry, camera)
      if (!mesh || !Array.isArray(entry.limits)) continue
      if (!fingerprints.has(mesh)) fingerprints.set(mesh, meshOcclusionSignature(mesh))
      if (fingerprints.get(mesh) !== entry.signature) continue
      const { min, max } = worldBounds(mesh, this.bounds)
      const [x0, y0, z0, x1, y1, z1] = entry.limits
      if (min.x >= x0 && min.y >= y0 && min.z >= z0 && max.x <= x1 && max.y <= y1 && max.z <= z1) hidden.push(mesh)
    }
    this.lastValidOccluders = witnesses.size
    for (const mesh of hidden) {
      const drawable = mesh._lfClusterBatch ?? mesh
      if (witnesses.has(mesh) || !drawable.visible) continue
      this.masked.push(drawable)
      drawable.visible = false
    }
    return ''
  }

  draw(camera, fn) {
    if (this.drawing) return this.withShadows(fn)
    const extra = this.vp.perf?.enabled ? this.vp.perf.stats.extra : null
    const start = extra ? performance.now() : 0
    this.drawing = true
    this.lastCellPairs = null
    this.lastValidOccluders = null
    try {
      let reason
      if (!this.enabled) reason = 'disabled'
      else if (!camera?.isPerspectiveCamera || this.vp.scene.overrideMaterial ||
               this.vp.renderer.clippingPlanes.length || this.vp.psxUniforms.step.value > 0) reason = 'camera-mode'
      else reason = this._mask(camera)
      this.lastReason = reason || ''
      if (extra) {
        extra.occlusionHidden = this.masked.length
        extra.occlusionCpuMs = performance.now() - start
        extra.occlusionReason = status[reason] || ''
      }
      return fn()
    } finally {
      for (const mesh of this.masked) mesh.visible = true
      this.masked.length = 0
      this.drawing = false
    }
  }

  /** Las sombras deben poder ver la escena completa desde la luz. */
  withShadows(fn) {
    if (!this.masked.length || this.revealing) return fn()
    this.revealing = true
    for (const mesh of this.masked) mesh.visible = true
    try { return fn() } finally {
      for (const mesh of this.masked) mesh.visible = false
      this.revealing = false
    }
  }

  wrapRenderPass(pass) {
    const render = pass.render.bind(pass)
    pass.render = (...args) => this.draw(pass.camera, () => render(...args))
  }

  dispose() {
    for (const mesh of this.masked) mesh.visible = true
    this.masked.length = 0
    this.graph = null
    this.vp = null
  }
}
