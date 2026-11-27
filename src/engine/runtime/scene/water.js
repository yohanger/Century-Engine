import * as THREE from 'three'
import { nodeActive } from '../nodes/hierarchy.js'
// Agua y mapa de profundidad
import { groundAtAll, halfExtentAll } from '../geometry/terrains.js'
import { WaterWorld } from '../geometry/waterworld.js'
import { addRipple } from '../geometry/waterripple.js'
import { TerrainWaterConnection, nativeWaterConfiguration } from '../geometry/water-terrain.js'
import { WaterSurfaceView } from '../geometry/water-surface.js'
import { effectiveMaterialObject } from '../render/material-resource.js'
import { normalizedRunoff } from '../render/material-resource.js'
import { roadSlotMaterial } from '../render/road-material.js'
import { surfaceOf } from '../layers.js'
import { WETU } from '../render/wetlib.js'
import { WM, bakeWaterMap, normalizeWaterFx, setWaterFxUniforms, collectWaterBodies } from '../geometry/waterfx.js'

export const waterMethods = {
  /** Las gotas que tocan agua visible alteran la normal, no el volumen de WaterWorld. */
  rainWaterRipple(hit) {
    this._rainAudioImpact?.(hit) // el mismo impacto visual alimenta el audio; nunca cambia el volumen físico
    const p = hit?.point
    if (!p || hit.normal?.[1] < 0.7) return
    const water = this._activeWaterWorld || this._physicalWaterView?.water
    const surface = water?.at(p[0], p[2])
    if (!surface || Math.abs(surface.surface - p[1]) > 0.08) return
    const now = performance.now()
    if (this._rainRippleStamp != null && now - this._rainRippleStamp < 105) return
    this._rainRippleStamp = now
    addRipple(p[0], p[2], 0.11)
    water?.disturb(p[0], p[2], 0.08, 0.6)
  },
  /** Devuelve la primera cara sólida atravesada por una gota visible. El suelo se consulta aparte. */
  rainImpact(from, to) {
    const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2])
    const length = dir.length()
    if (!(length > 0)) return null
    if (!this._rainRay) this._rainRay = new THREE.Raycaster()
    const ray = this._rainRay
    ray.set(new THREE.Vector3(...from), dir.divideScalar(length))
    ray.near = 0; ray.far = length
    // Refrescar lista por intervalo para no recorrer la escena en cada gota ni conservar geometría retirada.
    const now = performance.now()
    if (!this._rainMeshes || now - (this._rainMeshStamp || 0) > 300) {
      this._rainMeshes = []
      this._rainOwners = new WeakMap()
      const types = new Set(['primitive', 'mesh', 'road', 'text'])
      for (const [id, node] of this.nodes) {
        if (!types.has(this.host.getObject(id)?.type)) continue
        node.traverse((mesh) => {
          if (!mesh.isMesh || !mesh.geometry || mesh.userData.helper || mesh.material?.visible === false) return
          for (let parent = mesh; parent; parent = parent.parent) if (!parent.visible) return
          this._rainMeshes.push(mesh)
          this._rainOwners.set(mesh, id)
        })
      }
      this._rainMeshStamp = now
    }
    const hit = ray.intersectObjects(this._rainMeshes, false)[0]
    if (!hit?.face) return null
    const normal = hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize()
    const id = this._rainOwners.get(hit.object), obj = id ? this.host.getObject(id) : null
    const materials = this.host.project?.materials || []
    // Una superficie física debe ser estática. La identificación se comparte con el audio futuro.
    const slot = obj?.type === 'road' && hit.object.userData.roadSlot
      ? obj.props?.slots?.[hit.object.userData.roadSlot] : null
    const resolved = slot ? roadSlotMaterial(slot, hit.object.userData.roadSlot, materials)
      : effectiveMaterialObject(obj, materials)
    const motion = obj?.physics?.type || obj?.physics?.mode || obj?.physics
    const stationary = !motion || motion === 'static' || motion === 'Static'
    let runoff = null
    try { if (stationary && resolved?.mat?.runoff?.enabled) runoff = normalizedRunoff(resolved.mat.runoff) }
    catch { /* dato inválido: nunca habilitar una superficie física */ }
    return { point: hit.point.toArray(), normal: normal.toArray(), ownerId: id || null,
      materialId: slot?.materialId || obj?.materialId || '', surface: this.host.project?.tagLayers && obj ? surfaceOf(this.host.project.tagLayers, obj) : '',
      rainAudio: resolved?.mat?.rainAudio || null, runoff }
  },
  /** La superficie física se dibuja desde WaterWorld; nunca almacena un segundo volumen. */
  showPhysicalWater(water) {
    // Construir primero la superficie física: un fallo durante el montaje no
    // puede dejar ocultas las mallas autorales ni destruir la vista anterior.
    const view = new WaterSurfaceView(this.vp.world, water)
    this.hidePhysicalWater()
    this._physicalWaterView = view
    this._coupledWaterVisibility = []
    for (const body of water.bodies) {
      if (!body.coupledRegion || !water.regions.has(body.coupledRegion)) continue
      const node = this.nodes.get(body.id)
      if (!node) continue
      this._coupledWaterVisibility.push([node, node.visible])
      node.visible = false
    }
    this.vp.requestRender()
  },
  updatePhysicalWater(water) {
    this._physicalWaterView?.update(water)
    this.setPhysicalWaterBounds(water)
    this.vp.requestRender()
  },
  hidePhysicalWater() {
    const hadPhysicalView = !!this._physicalWaterView || !!this._coupledWaterVisibility?.length
    for (const [node, wasVisible] of this._coupledWaterVisibility || []) {
      const owner = node._lfNodeOwner
      // Si el nodo se sustituyó o eliminó durante Play, no tocar el obsoleto.
      if (owner && this.nodes.get(owner.id) !== node) continue
      // La autoría actual prevalece sobre el visible capturado antes de Play:
      // dicho booleano pudo pertenecer a una vista física transitoria anterior.
      node.visible = owner ? nodeActive(owner) && owner.visible !== false : wasVisible
    }
    this._coupledWaterVisibility = []
    this._physicalWaterView?.dispose()
    this._physicalWaterView = null
    this._physicalPreviewSig = null
    WETU.uPhysicalCount.value = 0
    WETU.uHydroCount.value = 0
    this._hydroMoistureTexture?.dispose()
    this._hydroMoistureTexture = null
    WETU.uHydroMoisture.value = null
    if (hadPhysicalView) this.vp.requestRender?.()
  },
  /** En edición se ve el agua inicial sin avanzar el solver. */
  refreshPhysicalWaterPreview() {
    if (this.isPlaying) return
    const project = this.host.project
    if (!project || !Array.isArray(project.objects)) {
      if (this._physicalWaterView || this._previewWaterWorld || this._physicalPreviewSig) this.hidePhysicalWater()
      this._previewWaterWorld = null
      return
    }
    const config = project.environment?.waterSimulation
    const nodes = project.objects.filter((o) => o.type === 'water').map((o) => {
      const parents = []
      let id = o.parentId
      for (let i = 0; id && i < 64; i++) {
        const parent = this.host.getObject(id)
        if (!parent) break
        parents.push([parent.id, parent.position, parent.rotation, parent.visible, parent.active])
        id = parent.parentId
      }
      return [o.id, o.visible, o.active, o.position, o.rotation, o.props, parents]
    })
    const sig = JSON.stringify([config || null, nodes]) + '|' + this.terrains.map((t) => `${t.id}:${t.version}:${t.ox}:${t.oy}:${t.oz}:${t.enabled}`).join('|')
    if (sig === this._physicalPreviewSig) return
    this.hidePhysicalWater()
    this._previewWaterWorld = null
    try {
      const water = WaterWorld.fromObjects(project.objects)
      this._previewWaterWorld=water
      const resolved = nativeWaterConfiguration(water, config, this.terrains)
      if (!resolved) return
      new TerrainWaterConnection(water, resolved, this.terrains, this.world)
      this.showPhysicalWater(water)
      this.setPhysicalWaterBounds(water)
    } catch (err) {
      this.hidePhysicalWater()
      this._previewWaterWorld = null
      console.warn('Vista previa del agua física:', err)
      this.host.toast?.('Agua física: ' + (err?.message || err), 'error', 3000)
    } finally {
      // La firma solo se publica después de montar o limpiar correctamente.
      // Las operaciones internas de montaje desmontan la vista previa anterior.
      this._physicalPreviewSig = sig
    }
  },
  /** La tierra mantiene su humedad, pero no inventa charcos dentro de regiones físicas. */
  setPhysicalWaterBounds(water) {
    const regions = [...water.regions.values()]
    if (regions.length > 32) throw new Error('Agua física: máximo 32 regiones visuales')
    WETU.uPhysicalCount.value = regions.length
    regions.forEach((r, i) => WETU.uPhysicalBounds.value.set([r.x, r.z, r.x + r.width * r.dx, r.z + r.height * r.dz], i * 4))
    // Atlas único, a lo sumo 4096 celdas S02: el shader sólo LEE saturación de WaterRegion.
    const wet = regions.filter((r) => r.hydrology)
    WETU.uHydroCount.value = wet.length
    if (!wet.length) return
    if (!this._hydroMoistureTexture) {
      const data = new Uint8Array(4096 * 4)
      const tex = new THREE.DataTexture(data, 64, 64, THREE.RGBAFormat, THREE.UnsignedByteType)
      tex.minFilter = THREE.NearestFilter; tex.magFilter = THREE.NearestFilter
      tex.generateMipmaps = false
      this._hydroMoistureTexture = tex
    }
    const data = this._hydroMoistureTexture.image.data
    data.fill(0)
    let offset = 0
    for (let i = 0; i < wet.length; i++) {
      const r = wet[i], count = r.width * r.height
      if (offset + count > 4096) throw new Error('Hidrología: se superó el límite de celdas')
      WETU.uHydroGrid.value.set([r.x, r.z, 1 / r.dx, 1 / r.dz], i * 4)
      WETU.uHydroDims.value.set([r.width, r.height, offset, 0], i * 4)
      for (let k = 0; k < count; k++) {
        const sat = r.hydrology.capacity[k] > 0 ? r.hydrology.storage[k] / r.hydrology.capacity[k] : 0
        data[(offset + k) * 4] = Math.round(255 * Math.max(0, Math.min(1, sat)))
        data[(offset + k) * 4 + 3] = 255
      }
      offset += count
    }
    this._hydroMoistureTexture.needsUpdate = true
    WETU.uHydroMoisture.value = this._hydroMoistureTexture
  },
  /** Reaplica la iluminación horneada si la escena tiene (o tenía) un bake. */
  _bakeSchedule() {
    if (this.host.project?.environment?.bake || this.bake.state.active) this.bake.schedule()
  },

  // ---------- agua ↔ terreno ----------
  /** Hornea (con retardo) el mapa de profundidad que usan el terreno y el agua; ver waterfx.js. */
  _scheduleWM() {
    if (this._wmTimer) return
    this._wmTimer = setTimeout(() => { this._wmTimer = 0; this.refreshWaterMap() }, 60)
  },

  /** Terreno «virtual» que usa el mapa de agua: la pieza si solo hay una en el origen; si no, un cuadrado centrado que las abarca. */
  _wmTerrain() {
    const live = this.terrains.filter((t) => t.enabled !== false)
    if (live.length === 1 && !live[0].ox && !live[0].oz && !live[0].oy && live[0].size === live[0].depth)
      return live[0]
    if (!live.length) return { enabled: false, size: 64, segments: 128, heightAt: () => 0 }
    const S = Math.max(8, halfExtentAll(live) * 2)
    const step = Math.min(...live.map((t) => t.step))
    return { enabled: true, size: S, segments: Math.min(1024, Math.ceil(S / step)), ox: 0, oz: 0, heightAt: (x, z) => { const g = groundAtAll(live, x, z); return Number.isNaN(g) ? -50 : g } }
  },

  refreshWaterMap() {
    const p = this.host.project
    if (!p || !this.terrains.length) return
    const fx = normalizeWaterFx(p.environment)
    const bodies = collectWaterBodies(p.objects)
    const t = this._wmTerrain()
    const sig = bodies.length ? JSON.stringify([bodies.map((b) => [b.x, b.y, b.z, b.yaw, b.p.shape, b.p.size, b.p.width, b.p.length, b.p.radius, b.p.riverWidth, b.p.points, b.p.closed, b.p.smooth]), this._wmVer, t.size, t.depth, t.segments, t.segmentsZ, t.enabled, t.ox, t.oz]) : ''
    if (sig !== this._wmSig) {
      this._wmSig = sig
      this._wmMap = sig ? bakeWaterMap(p.objects, t) : null
    }
    setWaterFxUniforms(WM, this._wmMap, fx)
    this.vp.requestRender()
  },
}
