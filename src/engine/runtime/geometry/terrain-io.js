// Terreno · guardar, deshacer y restaurar. Mixin de `Terrain` (terrain.js).
import { STRIDE, normalizeLayers } from './terrain-splat.js'
import { storedTerrainGeneratorParams } from './terrain-gen.js'
import { bytesToB64 } from '../util.js'
import { normalizeTerrainBake } from '../render/terrain-bake.js'

export const ioMethods = {
  // ---------- (de)serialización ----------
  serialize() {
    if (this._cache && this._cache.v === this.version) return this._cache.data
    const position = this._timelineAuthoredPosition || [this.ox, this.oy, this.oz]
    const data = {
      id: this.id, name: this.name, ox: position[0], oy: position[1], oz: position[2],
      size: this.size, depth: this.depth,
      segments: this.segments, segmentsZ: this.segmentsZ,
      layers: this.layers.map((l) => ({ ...l })),
      heights: bytesToB64(new Uint8Array(this.heights.buffer, this.heights.byteOffset, this.heights.byteLength)),
      splat: bytesToB64(this.splat),
      splatStride: STRIDE,
      enabled: this.enabled,
      visible: this.visible !== false,
      ...(this.terrainBake && { terrainBake: { ...this.terrainBake } }),
      foliage: this.foliage.serialize(),
      ...(this.generator && { generator: { ...this.generator } }),
    }
    this._cache = { v: this.version, data }
    return data
  },

  snapshot() {
    const position = this._timelineAuthoredPosition || [this.ox, this.oy, this.oz]
    return {
      id: this.id, name: this.name, ox: position[0], oy: position[1], oz: position[2],
      size: this.size, depth: this.depth,
      segments: this.segments, segmentsZ: this.segmentsZ,
      layers: this.layers.map((l) => ({ ...l })),
      heights: this.heights.slice(),
      splat: this.splat.slice(),
      enabled: this.enabled,
      visible: this.visible !== false,
      terrainBake: this.terrainBake ? { ...this.terrainBake } : null,
      foliage: this.foliage.snapshot(),
      generator: this.generator ? { ...this.generator } : null,
    }
  },

  restore(s) {
    this.clearEdgePreview()
    const rebuild = s.size !== this.size || s.segments !== this.segments || (s.depth ?? s.size) !== this.depth || (s.segmentsZ ?? s.segments) !== this.segmentsZ
    if (s.name) this.name = s.name
    if ((s.ox || 0) !== this.ox || (s.oy || 0) !== this.oy || (s.oz || 0) !== this.oz)
      this.setOffset(s.ox || 0, s.oz || 0, s.oy || 0)
    this.size = s.size
    this.segments = s.segments
    this.depth = s.depth ?? s.size
    this.segmentsZ = s.segmentsZ ?? s.segments
    this.enabled = s.enabled !== false
    this.visible = s.visible !== false
    this.terrainBake = normalizeTerrainBake(s.terrainBake)
    this.bakeInfo = null
    this.generator = storedTerrainGeneratorParams(s.generator)
    this.layers = normalizeLayers(s.layers)
    this.heights = s.heights.slice()
    this.splat = s.splat.slice()
    this._applyLayerUniforms()
    if (rebuild) this._buildMesh()
    else { this._ib.array = this.splat; this._ib.needsUpdate = true; this.refreshAll() }
    this._syncTextures()
    this.foliage.restore(s.foliage || [])
  },
}
