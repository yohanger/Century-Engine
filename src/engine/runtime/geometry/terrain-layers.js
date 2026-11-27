// Terreno · capas de pintura (añadir, quitar, reordenar). Mixin de `Terrain` (terrain.js).
import { MAX_LAYERS, STRIDE, normalizeLayers } from './terrain-splat.js'

export const layerMethods = {
  /** Sustituye las capas (nombre/color/textura/tile). No toca los pesos pintados. */
  setLayers(layers) {
    this.layers = normalizeLayers(layers)
    this._applyLayerUniforms()
    this._syncTextures()
    this.version++
    this._cache = null
  },

  /** Añade una capa vacía (peso 0). Devuelve su índice o -1 si ya hay el máximo. */
  addLayer(layer = {}) {
    if (this.layers.length >= MAX_LAYERS) return -1
    const n = this.layers.length
    this.layers.push(...normalizeLayers([{ name: `Capa ${n + 1}`, color: layer.color || '#8c8c8c', ...layer }]))
    this._applyLayerUniforms()
    this._syncTextures()
    this.version++
    this._cache = null
    return n
  },

  /** Quita una capa y reparte su peso entre las demás. */
  removeLayer(i) {
    if (this.layers.length <= 1 || i < 0 || i >= this.layers.length) return false
    const S = this.splat
    for (let v = 0; v < S.length; v += STRIDE) {
      let sum = 0
      for (let k = i; k < STRIDE - 1; k++) S[v + k] = S[v + k + 1]
      S[v + STRIDE - 1] = 0
      for (let k = 0; k < STRIDE; k++) sum += S[v + k]
      if (!sum) S[v] = 255
      else if (sum !== 255) for (let k = 0; k < STRIDE; k++) S[v + k] = Math.round((S[v + k] * 255) / sum)
    }
    this.layers.splice(i, 1)
    this._texSig = '' // los índices de textura cambian
    this._applyLayerUniforms()
    this._syncTextures()
    this.version++
    this._cache = null
    this.refreshAll()
    return true
  },

  /** Intercambia dos capas (orden en la lista y canal de pintura). */
  swapLayers(a, b) {
    if (a === b || a < 0 || b < 0 || a >= this.layers.length || b >= this.layers.length) return false
    const S = this.splat
    for (let v = 0; v < S.length; v += STRIDE) { const t = S[v + a]; S[v + a] = S[v + b]; S[v + b] = t }
    ;[this.layers[a], this.layers[b]] = [this.layers[b], this.layers[a]]
    this._texSig = ''
    this._applyLayerUniforms()
    this._syncTextures()
    this.version++
    this._cache = null
    this.refreshAll()
    return true
  },
}
