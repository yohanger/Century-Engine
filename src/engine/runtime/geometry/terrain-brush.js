// Terreno · pinceles de escultura y pintura, rampas y pintado automático. Mixin de `Terrain` (terrain.js).
import { STRIDE } from './terrain-splat.js'
import { clamp, lerp, valueNoise } from '../util.js'

export const brushMethods = {
  // ---------- pinceles ----------
  /**
   * tool: raise | lower | smooth | flatten | noise | paint
   * opts: { radius, strength(0..1), hardness(0..1), dt, layer, flattenHeight }
   */
  applyBrush(tool, cx, cz, opts) {
    const { radius, strength, hardness, dt = 1 / 60, layer = 0, flattenHeight = 0 } = opts
    const half = this.size / 2, hz = this.depth / 2, step = this.step, n1 = this.n1
    const i0 = clamp(Math.floor((cx - radius + half) / step), 0, this.segments)
    const i1 = clamp(Math.ceil((cx + radius + half) / step), 0, this.segments)
    const j0 = clamp(Math.floor((cz - radius + hz) / step), 0, this.segmentsZ)
    const j1 = clamp(Math.ceil((cz + radius + hz) / step), 0, this.segmentsZ)
    const H = this.heights
    // suavizado: copia solo la ventana afectada (+1 de margen) para leer valores estables
    let src = null, si0 = 0, sj0 = 0, sw = 0
    if (tool === 'smooth') {
      si0 = Math.max(i0 - 1, 0); sj0 = Math.max(j0 - 1, 0)
      const si1 = Math.min(i1 + 1, n1 - 1), sj1 = Math.min(j1 + 1, this.segmentsZ)
      sw = si1 - si0 + 1
      src = new Float32Array(sw * (sj1 - sj0 + 1))
      for (let jj = sj0; jj <= sj1; jj++) src.set(H.subarray(jj * n1 + si0, jj * n1 + si1 + 1), (jj - sj0) * sw)
    }
    const S = (ii, jj) => src[(jj - sj0) * sw + (ii - si0)]
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const x = -half + i * step, z = -hz + j * step
        const d = Math.hypot(x - cx, z - cz)
        if (d > radius) continue
        const t = d / radius
        let w = 1
        if (t > hardness) {
          const u = (t - hardness) / Math.max(1e-4, 1 - hardness)
          w = 1 - u * u * (3 - 2 * u)
        }
        const v = j * n1 + i
        switch (tool) {
          case 'raise': H[v] += strength * w * dt * 8; break
          case 'lower': H[v] -= strength * w * dt * 8; break
          case 'flatten': H[v] = lerp(H[v], flattenHeight, clamp(w * strength * dt * 12, 0, 1)); break
          case 'smooth': {
            const avg = (S(Math.max(i - 1, 0), j) + S(Math.min(i + 1, n1 - 1), j) +
              S(i, Math.max(j - 1, 0)) + S(i, Math.min(j + 1, n1 - 1)) + S(i, j)) / 5
            H[v] = lerp(H[v], avg, clamp(w * strength * dt * 14, 0, 1))
            break
          }
          case 'noise': H[v] += (valueNoise(x * 0.9, z * 0.9, 7) * 2 - 1) * strength * w * dt * 5; break
          case 'paint': this._paintVertex(v, layer, clamp(w * strength * dt * 4, 0, 1)); break
        }
      }
    }
    this.refreshRegion(Math.max(i0 - 1, 0), Math.max(j0 - 1, 0), Math.min(i1 + 1, this.segments), Math.min(j1 + 1, this.segmentsZ), tool !== 'paint')
    if (tool !== 'paint') {
      const d = this._dirty || (this._dirty = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity })
      d.x0 = Math.min(d.x0, cx - radius - step); d.x1 = Math.max(d.x1, cx + radius + step)
      d.z0 = Math.min(d.z0, cz - radius - step); d.z1 = Math.max(d.z1, cz + radius + step)
    }
  },

  // ---------- rampa ----------
  /** Empieza una rampa: guarda el relieve original para poder rehacer la vista previa en cada movimiento. */
  beginRamp() { this._ramp = { base: this.heights.slice(), box: null } },

  /**
   * Vista previa de una rampa de A=(ax,az,ay) a B=(bx,bz,by) (coordenadas locales, alturas del mundo).
   * `o` = { halfWidth, hardness, strength }; `null` = solo deshacer la vista previa. La rampa es un RECTÁNGULO de A a B (extremos
   * rectos, ancho = 2·halfWidth): sus puntos toman la altura interpolada y solo los lados largos se funden con el terreno original.
   */
  previewRamp(a, b, o) {
    const R = this._ramp
    if (!R) return
    const n1 = this.n1, step = this.step, half = this.size / 2, hz = this.depth / 2
    let u = R.box
    if (u) { // restaura lo tocado por la vista previa anterior
      for (let j = u.j0; j <= u.j1; j++) this.heights.set(R.base.subarray(j * n1 + u.i0, j * n1 + u.i1 + 1), j * n1 + u.i0)
    }
    let nb = null
    if (a && b && o) {
      const W = o.halfWidth
      const dx = b.x - a.x, dz = b.z - a.z, len2 = dx * dx + dz * dz
      const i0 = clamp(Math.floor((Math.min(a.x, b.x) - W + half) / step), 0, this.segments)
      const i1 = clamp(Math.ceil((Math.max(a.x, b.x) + W + half) / step), 0, this.segments)
      const j0 = clamp(Math.floor((Math.min(a.z, b.z) - W + hz) / step), 0, this.segmentsZ)
      const j1 = clamp(Math.ceil((Math.max(a.z, b.z) + W + hz) / step), 0, this.segmentsZ)
      if (Math.min(a.x, b.x) - W <= half && Math.max(a.x, b.x) + W >= -half && Math.min(a.z, b.z) - W <= hz && Math.max(a.z, b.z) + W >= -hz) {
        const H = this.heights
        for (let j = j0; j <= j1; j++) {
          for (let i = i0; i <= i1; i++) {
            const x = -half + i * step, z = -hz + j * step
            if (len2 <= 1e-9) continue
            const t = ((x - a.x) * dx + (z - a.z) * dz) / len2
            if (t < 0 || t > 1) continue // extremos rectos: nada fuera de A–B
            const d = Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t))
            if (d > W) continue
            const k = d / W
            let w = 1
            if (k > o.hardness) { const q = (k - o.hardness) / Math.max(1e-4, 1 - o.hardness); w = 1 - q * q * (3 - 2 * q) }
            const v = j * n1 + i
            H[v] = lerp(H[v], a.y + (b.y - a.y) * t, clamp(w * o.strength, 0, 1))
          }
        }
        nb = { i0, i1, j0, j1 }
        const dd = this._dirty || (this._dirty = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity })
        dd.x0 = Math.min(dd.x0, Math.min(a.x, b.x) - W - step); dd.x1 = Math.max(dd.x1, Math.max(a.x, b.x) + W + step)
        dd.z0 = Math.min(dd.z0, Math.min(a.z, b.z) - W - step); dd.z1 = Math.max(dd.z1, Math.max(a.z, b.z) + W + step)
      }
    }
    const un = u && nb ? { i0: Math.min(u.i0, nb.i0), i1: Math.max(u.i1, nb.i1), j0: Math.min(u.j0, nb.j0), j1: Math.max(u.j1, nb.j1) } : (nb || u)
    R.box = nb
    if (un) this.refreshRegion(Math.max(un.i0 - 1, 0), Math.max(un.j0 - 1, 0), Math.min(un.i1 + 1, this.segments), Math.min(un.j1 + 1, this.segmentsZ), true)
  },

  endRamp() {
    if (!this._ramp) return
    this._ramp = null
    this._range = null
  },

  /** Zona (x/z) modificada por el relieve desde la última vez; la vegetación se recoloca solo ahí. */
  takeDirtyBox() { const d = this._dirty; this._dirty = null; return d },

  _paintVertex(v, layer, amount) {
    if (layer < 0 || layer >= this.layers.length) return
    const S = this.splat, s = v * STRIDE
    const cur = S[s + layer] / 255
    const target = Math.min(1, cur + amount)
    const othersOld = 1 - cur
    const othersNew = 1 - target
    S[s + layer] = Math.round(target * 255)
    for (let k = 0; k < STRIDE; k++) {
      if (k === layer) continue
      S[s + k] = othersOld > 1e-6 ? Math.round(((S[s + k] / 255) / othersOld) * othersNew * 255) : 0
    }
  },

  /** Pinta capas automáticamente según altura y pendiente. */
  autoPaint({ rockSlope = 0.55, sandMaxHeight = 0.6 } = {}) {
    const n1 = this.n1, step = this.step, H = this.heights
    for (let j = 0; j < this.nz1; j++) {
      for (let i = 0; i < n1; i++) {
        const v = j * n1 + i
        const dx = (H[j * n1 + Math.min(i + 1, n1 - 1)] - H[j * n1 + Math.max(i - 1, 0)]) / (2 * step)
        const dz = (H[Math.min(j + 1, this.segmentsZ) * n1 + i] - H[Math.max(j - 1, 0) * n1 + i]) / (2 * step)
        const slope = Math.hypot(dx, dz)
        let layer = 0
        if (slope > rockSlope) layer = 2
        else if (H[v] < sandMaxHeight) layer = 3
        else if (slope > rockSlope * 0.6) layer = 1
        layer = Math.min(layer, this.layers.length - 1)
        for (let k = 0; k < STRIDE; k++) this.splat[v * STRIDE + k] = k === layer ? 255 : 0
      }
    }
    this.refreshAll()
  },

  resetPaint() {
    this.splat.fill(0)
    for (let i = 0; i < this.heights.length; i++) this.splat[i * STRIDE] = 255
    this.refreshAll()
  },
}
