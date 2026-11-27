// Piezas de terreno: edición (añadir, quitar, mover, deshacer). El montaje y las alturas están en engine/runtime/scene/terrain.js
import { Terrain } from '../../engine/runtime/geometry/terrain.js'
import { stitchPieces, adjacentSpot, serializeAll, snapshotAll } from '../../engine/runtime/geometry/terrains.js'
import { store } from '../store.js'

export const terrainMethods = {
  // =================== piezas de terreno ===================
  setActivePiece(id) {
    if (!this.terrains.some((t) => t.id === id)) return
    this._activeId = id
    this.vp.requestRender()
  },

  /** Crea una pieza nueva (plana). `at` = [x,z] o `adjacent` = 'px'|'nx'|'pz'|'nz' respecto a la activa. */
  addPiece({ size = null, segments = null, at = null, adjacent = 'px', name = '' } = {}) {
    const ref = this.terrain
    const S = size || ref?.size || 64, N = segments || ref?.segments || 128
    const t = new Terrain(S, N, ref?.layers)
    t.name = name || `Terreno ${this.terrains.length + 1}`
    const [x, z] = at || (ref ? adjacentSpot(ref, S, adjacent) : [0, 0])
    this.terrains.push(t)
    this._mountPiece(t)
    t.setOffset(x, z, ref?.oy ?? 0)
    if (store.project?.terrain?.foliage) t.foliage.setTypes(JSON.parse(JSON.stringify(store.project.terrain.foliage)))
    this._activeId = t.id
    this.afterPiecesChanged()
    return t
  },

  removePiece(id) {
    const t = this.terrains.find((x) => x.id === id)
    if (!t || this.terrains.length <= 1) return false
    this.terrains = this.terrains.filter((x) => x !== t)
    this._unmountPiece(t)
    if (this._activeId === id) this._activeId = this.terrains[0].id
    this.afterPiecesChanged()
    return true
  },

  movePiece(id, x, z, y) {
    const t = this.terrains.find((q) => q.id === id)
    if (!t) return
    t.setOffset(x, z, y ?? t.oy)
    this.afterPiecesChanged()
  },

  /** Ajuste por borde: una reconstrucción completa al confirmar, nunca durante cada píxel de arrastre. */
  extendTerrainEdge(id, side, cells) {
    const piece = this.terrains.find(t => t.id === id && t.enabled !== false)
    if (!piece || !piece.extendEdge(side, cells)) return false
    this.afterPiecesChanged()
    return true
  },

  /** Iguala los bordes de las piezas que se tocan. */
  stitch() {
    const changed = stitchPieces(this.terrains)
    return changed
  },

  afterPiecesChanged() {
    this._syncTerrainGizmo()
    this.touchTerrain()
    this.syncSettings()
    this.applyView()
    this._foliageCounts()
    this.vp.requestRender()
  },

  serializeTerrain() { return serializeAll(this.terrains) },
  snapshotTerrain() { return snapshotAll(this.terrains) },

  /** Restaura todas las piezas desde una instantánea (deshacer/rehacer). */
  restoreTerrain(snap) {
    const { extra, ...main } = snap
    const items = [main, ...(extra || [])]
    const ids = new Set(items.map((x) => x.id))
    const keep = []
    for (const it of items) {
      let t = this.terrains.find((q) => q.id === it.id)
      if (!t) {
        t = new Terrain(it.size, it.segments, it.layers)
        if (it.id) t.id = it.id
        this._mountPiece(t)
      }
      t.restore(it)
      keep.push(t)
    }
    for (const t of this.terrains) if (!keep.includes(t)) this._unmountPiece(t)
    this.terrains = keep
    if (!keep.some((t) => t.id === this._activeId)) this._activeId = keep[0].id
    this.afterPiecesChanged()
  },

}
