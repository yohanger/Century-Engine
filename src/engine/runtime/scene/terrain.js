// Piezas de terreno de la escena: montar, desmontar y consultar alturas. La edición de piezas (añadir, mover, deshacer) está en el editor.
import { groundAtAll, heightAtAll, raycastAll, rangeAll, boundsAll } from '../geometry/terrains.js'
import { nodeEffectiveActive } from '../nodes/hierarchy.js'

export const terrainMethods = {
  /** Pieza activa (la que edita el panel Terreno: tamaño, generación, capas…). */
  get terrain() { return this.terrains.find((t) => t.id === this._activeId) || this.terrains[0] || null },

  _mountPiece(t) {
    this.vp.world.add(t.mesh, t.foliage.group)
    t.foliage.requestRender = () => this.vp.requestRender()
    t.onFoliageChange = () => this._foliageCounts()
    t.mesh.position.set(t.ox, t.oy, t.oz); t.foliage.group.position.set(t.ox, t.oy, t.oz)
    this.bake.schedule()
  },

  _unmountPiece(t) {
    if (t._timelineAuthoredPosition) {
      ;[t.ox, t.oy, t.oz] = t._timelineAuthoredPosition
      delete t._timelineAuthoredPosition
    }
    const obj = this.host.getObject?.(t.id)
    if (obj?._lfTerrainPiece === t) delete obj._lfTerrainPiece
    this.vp.world.remove(t.mesh, t.foliage.group)
    t.dispose()
  },

  _foliageCounts() {
    const c = {}
    for (const t of this.terrains) for (const s of t.foliage.types.values()) c[s.cfg.id] = (c[s.cfg.id] || 0) + s.count
    this.host.foliageCounts?.(c)
  },

  _enabledTerrains() {
    const objects = this.host.project?.objects || []
    return [...this.terrains.filter(t => {
      const obj = this.host.getObject(t.id)
      return obj && (this.player?.on ? this.player._nodeEnabled(obj) : nodeEffectiveActive(objects, obj))
    }), ...this.streamedTerrains]
  },
  /** Alturas, rayos y bounds consultan únicamente piezas activas. */
  heightAt(x, z) { return heightAtAll(this._enabledTerrains(), x, z) },
  groundAt(x, z) { return groundAtAll(this._enabledTerrains(), x, z) },
  raycastTerrain(ray) { return raycastAll(this._enabledTerrains(), ray) },
  terrainRange() { return rangeAll(this._enabledTerrains()) },
  terrainBounds() { return boundsAll(this._enabledTerrains()) },
}
