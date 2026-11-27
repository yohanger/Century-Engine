// Mapa de navegación (navmesh en rejilla multicapa). Sin DOM ni three: lo usan el horneado, el modo Jugar y las pruebas.
//
//  Cada columna (ix, iz) de `cell` metros guarda hasta L superficies transitables (h = altura, NaN = vacío; ok = 1 si el agente cabe).
//  Las columnas vecinas se conectan si la diferencia de altura es ≤ `step` (escalones, rampas). Búsqueda A* en 8 direcciones + suavizado.
const MAGIC = 0x4c464e56 // 'LFNV'
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]

class Heap {
  constructor() { this.a = [] }
  get size() { return this.a.length }
  push(item, pr) {
    const a = this.a; a.push([pr, item]); let i = a.length - 1
    while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop()
    if (a.length) {
      a[0] = last; let i = 0
      for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m }
    }
    return top[1]
  }
}

export class NavGrid {
  /** @param d { cell, x0, z0, nx, nz, L, h:Float32Array, ok:Uint8Array, step, agentRadius, agentHeight, maxSlope } */
  constructor(d) {
    Object.assign(this, { step: 0.55, agentRadius: 0.4, agentHeight: 1.8, maxSlope: 45 }, d)
  }

  get cells() { let n = 0; for (let i = 0; i < this.ok.length; i++) if (this.ok[i]) n++; return n }
  index(ix, iz, l) { return (iz * this.nx + ix) * this.L + l }
  cellOf(x, z) { return [Math.floor((x - this.x0) / this.cell), Math.floor((z - this.z0) / this.cell)] }
  inside(ix, iz) { return ix >= 0 && iz >= 0 && ix < this.nx && iz < this.nz }
  centerX(ix) { return this.x0 + (ix + 0.5) * this.cell }
  centerZ(iz) { return this.z0 + (iz + 0.5) * this.cell }
  nodePos(i) { const l = i % this.L, c = (i - l) / this.L, ix = c % this.nx, iz = (c - ix) / this.nx; return [this.centerX(ix), this.h[i], this.centerZ(iz)] }
  nodeCell(i) { const l = i % this.L, c = (i - l) / this.L, ix = c % this.nx; return [ix, (c - ix) / this.nx, l] }

  /** Capa transitable de la columna cuya altura está más cerca de `y` (−1 si no hay). `maxDy` limita la diferencia. */
  layerAt(ix, iz, y, maxDy = Infinity) {
    if (!this.inside(ix, iz)) return -1
    let best = -1, bd = maxDy + 1e-9
    for (let l = 0; l < this.L; l++) { const i = this.index(ix, iz, l); if (!this.ok[i]) continue; const d = Math.abs(this.h[i] - y); if (d <= bd) { bd = d; best = l } }
    return best
  }

  /** Altura del suelo transitable bajo (x, z) cerca de `y` (undefined si no hay). */
  heightAt(x, z, y = Infinity) {
    const [ix, iz] = this.cellOf(x, z)
    const l = this.layerAt(ix, iz, Number.isFinite(y) ? y : 1e6)
    return l < 0 ? undefined : this.h[this.index(ix, iz, l)]
  }

  /** Nodo transitable más cercano a un punto del mundo (busca en anillos). −1 si no hay ninguno a menos de `maxDist` m. */
  nearest(x, y, z, maxDist = 6) {
    const [cx, cz] = this.cellOf(x, z), R = Math.ceil(maxDist / this.cell)
    let best = -1, bd = Infinity
    for (let r = 0; r <= R; r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue
        const ix = cx + dx, iz = cz + dz
        if (!this.inside(ix, iz)) continue
        for (let l = 0; l < this.L; l++) {
          const i = this.index(ix, iz, l); if (!this.ok[i]) continue
          const px = this.centerX(ix) - x, pz = this.centerZ(iz) - z, py = Number.isFinite(y) ? (this.h[i] - y) * 1.5 : 0
          const d = Math.hypot(px, pz, py); if (d < bd && d <= maxDist) { bd = d; best = i }
        }
      }
      if (best >= 0 && bd < (r + 1) * this.cell * 0.5) break
    }
    return best
  }

  /** Vecino de `i` en la dirección (dx, dz): nodo de la columna contigua con altura compatible, o −1. */
  neighbor(i, dx, dz) {
    const [ix, iz] = this.nodeCell(i), nx = ix + dx, nz = iz + dz
    if (!this.inside(nx, nz)) return -1
    const l = this.layerAt(nx, nz, this.h[i], this.step)
    return l < 0 ? -1 : this.index(nx, nz, l)
  }
  _step(i, dx, dz) {
    const j = this.neighbor(i, dx, dz)
    if (j < 0) return -1
    if (dx && dz && (this.neighbor(i, dx, 0) < 0 || this.neighbor(i, 0, dz) < 0)) return -1 // sin cortar esquinas
    return j
  }

  /** ¿Se puede ir en línea recta de `a` a `b` (puntos [x,y,z]) pisando solo celdas transitables? */
  canWalk(a, b) {
    const dx = b[0] - a[0], dz = b[2] - a[2], len = Math.hypot(dx, dz)
    const n = Math.max(1, Math.ceil(len / (this.cell * 0.5)))
    let y = a[1], px = -1, pz = -1, pl = -1
    for (let s = 0; s <= n; s++) {
      const t = s / n, x = a[0] + dx * t, z = a[2] + dz * t
      const [ix, iz] = this.cellOf(x, z)
      const l = this.layerAt(ix, iz, y, this.step)
      if (l < 0) return false
      // al cambiar de celda en diagonal, las dos contiguas también deben ser transitables
      if (px >= 0 && ix !== px && iz !== pz) { if (this.layerAt(ix, pz, y, this.step) < 0 || this.layerAt(px, iz, y, this.step) < 0) return false }
      y = this.h[this.index(ix, iz, l)]; px = ix; pz = iz; pl = l
    }
    return pl >= 0
  }

  /**
   * Camino de `from` a `to` ([x,y,z]). Ajusta ambos extremos al mapa (hasta `snap` m).
   * @returns { points:[[x,y,z]…], length, partial } | null    (partial = el destino no era alcanzable: llega al punto más cercano)
   */
  findPath(from, to, { smooth = true, snap = 6, allowPartial = true } = {}) {
    const s = this.nearest(from[0], from[1], from[2], snap), g = this.nearest(to[0], to[1], to[2], snap)
    if (s < 0 || g < 0) return null
    const N = this.h.length
    const gScore = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N)
    const gp = this.nodePos(g)
    const hf = (i) => { const p = this.nodePos(i), dx = Math.abs(p[0] - gp[0]), dz = Math.abs(p[2] - gp[2]); return (Math.max(dx, dz) + 0.4142 * Math.min(dx, dz)) + Math.abs(p[1] - gp[1]) * 0.2 }
    const heap = new Heap(); gScore[s] = 0; heap.push(s, hf(s))
    let bestNode = s, bestH = hf(s), found = false
    while (heap.size) {
      const c = heap.pop()
      if (closed[c]) continue
      closed[c] = 1
      if (c === g) { found = true; break }
      const hc = hf(c); if (hc < bestH) { bestH = hc; bestNode = c }
      const cp = this.nodePos(c)
      for (const [dx, dz] of DIRS) {
        const j = this._step(c, dx, dz)
        if (j < 0 || closed[j]) continue
        const jp = this.nodePos(j)
        const cost = gScore[c] + Math.hypot(jp[0] - cp[0], jp[2] - cp[2]) + Math.abs(jp[1] - cp[1]) * 0.5
        if (cost < gScore[j]) { gScore[j] = cost; came[j] = c; heap.push(j, cost + hf(j)) }
      }
    }
    if (!found && !allowPartial) return null
    let end = found ? g : bestNode
    const chain = []
    for (let i = end; i >= 0; i = came[i]) chain.push(i)
    chain.reverse()
    let pts = chain.map((i) => this.nodePos(i))
    // los extremos exactos (si caen en el mapa) en vez del centro de la celda
    const exact = (p, ref) => (Math.hypot(p[0] - ref[0], p[2] - ref[2]) <= this.cell * 1.5 ? [p[0], ref[1], p[2]] : null)
    pts[0] = [from[0], pts[0][1], from[2]]
    if (found) { const e = exact(to, pts.at(-1)); if (e) pts[pts.length - 1] = [to[0], pts.at(-1)[1], to[2]] }
    if (smooth && pts.length > 2) pts = this._smooth(pts)
    let length = 0
    for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2])
    return { points: pts, length, partial: !found }
  }

  /** Suavizado por línea de visión: salta a cada paso al punto más lejano al que se llega en recta. */
  _smooth(pts) {
    const out = [pts[0]]; let i = 0
    while (i < pts.length - 1) {
      let j = pts.length - 1
      while (j > i + 1 && !this.canWalk(pts[i], pts[j])) j--
      out.push(pts[j]); i = j
    }
    return out
  }

  /** Punto transitable al azar a ≤ `radius` de `center` (alcanzable desde él). Devuelve [x,y,z] o null. */
  randomPoint(center, radius, rng = Math.random, tries = 10) {
    for (let t = 0; t < tries; t++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * radius
      const x = center[0] + Math.cos(a) * r, z = center[2] + Math.sin(a) * r
      const n = this.nearest(x, center[1], z, this.cell * 2); if (n < 0) continue
      const p = this.nodePos(n)
      if (this.canWalk(center, p) || this.findPath(center, p, { smooth: false, allowPartial: false })) return p
    }
    return null
  }

  // ---------- (de)serialización ----------
  encode() {
    const head = JSON.stringify({ v: 1, cell: this.cell, x0: this.x0, z0: this.z0, nx: this.nx, nz: this.nz, L: this.L, step: this.step, agentRadius: this.agentRadius, agentHeight: this.agentHeight, maxSlope: this.maxSlope })
    const hb = new TextEncoder().encode(head), pad = (4 - ((12 + hb.length) % 4)) % 4
    const n = this.h.length, out = new Uint8Array(12 + hb.length + pad + n * 4 + n)
    const dv = new DataView(out.buffer)
    dv.setUint32(0, MAGIC); dv.setUint32(4, hb.length); dv.setUint32(8, pad)
    out.set(hb, 12)
    const off = 12 + hb.length + pad
    new Float32Array(out.buffer, off, n).set(this.h)
    out.set(this.ok, off + n * 4)
    return out
  }
  static decode(bytes) {
    const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
    const dv = new DataView(u.buffer, u.byteOffset, u.byteLength)
    if (dv.getUint32(0) !== MAGIC) throw new Error('Archivo de navegación no válido')
    const hl = dv.getUint32(4), pad = dv.getUint32(8)
    const d = JSON.parse(new TextDecoder().decode(u.subarray(12, 12 + hl)))
    const n = d.nx * d.nz * d.L, off = 12 + hl + pad
    const copy = u.slice(off, off + n * 4 + n)
    return new NavGrid({ ...d, h: new Float32Array(copy.buffer, 0, n), ok: copy.subarray(n * 4, n * 4 + n) })
  }
}
