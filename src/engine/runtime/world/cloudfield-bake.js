const clamp01 = (v) => Math.max(0, Math.min(1, v))

export const bakeMethods = {
  /** Horneado: proyecta las primitivas de las celdas residentes al mapa (sistema atmosférico: sin el desplazamiento del viento). */
  bake() {
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
    const M = this.map, N = M.N, ts = (2 * M.half) / N, ox = M.cx - M.half, oz = M.cz - M.half, n2 = N * N
    if (!this._acc2) {
      this._acc2 = { f: new Float32Array(n2), tn: new Float32Array(n2), ws: new Float32Array(n2), bmin: new Float32Array(n2), tmax: new Float32Array(n2), bw: new Float32Array(n2), bb: new Float32Array(n2), bt: new Float32Array(n2) }
    }
    const A = this._acc2
    A.f.fill(0); A.tn.fill(0); A.ws.fill(0); A.bmin.fill(Infinity); A.tmax.fill(-Infinity); A.bw.fill(0)
    const list = this._plist || (this._plist = [])
    const volumes = []
    let prims = 0
    for (const c of this.cells) {
      if (!c.active || c.condensate <= 0.002) continue
      const cnt = this.primitives(c, list)
      const [jx, jz] = this._jitter(c.key)
      const ccx = (c.sx + 0.5 + jx) * this.chunk, ccz = (c.sz + 0.5 + jz) * this.chunk
      const ax = c.x - this.windOff[0], az = c.z - this.windOff[1]
      for (let p = 0; p < cnt; p++) {
        const q = list[p], cx = ccx + q.x, cz = ccz + q.z, cy = c.y + q.y
        const i0 = Math.max(0, Math.floor((cx - q.rx - ox) / ts)), i1 = Math.min(N - 1, Math.ceil((cx + q.rx - ox) / ts))
        const j0 = Math.max(0, Math.floor((cz - q.rz - oz) / ts)), j1 = Math.min(N - 1, Math.ceil((cz + q.rz - oz) / ts))
        if (i1 < i0 || j1 < j0) continue
        prims++
        volumes.push({ x: ax + q.x, y: cy, z: az + q.z, rx: q.rx, ry: q.ry, rz: q.rz, str: q.str })
        const irx = 1 / q.rx, irz = 1 / q.rz
        for (let j = j0; j <= j1; j++) {
          const dz = (oz + (j + 0.5) * ts - cz) * irz, dz2 = dz * dz, row = j * N
          if (dz2 >= 1) continue
          for (let i = i0; i <= i1; i++) {
            const dx = (ox + (i + 0.5) * ts - cx) * irx, q2 = dx * dx + dz2
            if (q2 >= 1) continue
            const cc = 1 - q2, w = cc * cc * (3 - 2 * cc) * q.str
            if (w <= 0) continue
            const k = row + i, chord = q.ry * Math.sqrt(1 - q2), b = cy - chord, t = cy + chord
            A.f[k] += w; A.tn[k] += w * q.type; A.ws[k] += w
            if (w >= 0.12) { if (b < A.bmin[k]) A.bmin[k] = b; if (t > A.tmax[k]) A.tmax[k] = t }
            if (w > A.bw[k]) { A.bw[k] = w; A.bb[k] = b; A.bt[k] = t }
          }
        }
      }
    }
    // losa: de la base más baja al techo más alto con nube apreciable
    let sb = Infinity, st = -Infinity, maxO = 0
    for (let k = 0; k < n2; k++) {
      const O = A.f[k] * 0.82 > 1 ? 1 : A.f[k] * 0.82
      if (O > maxO) maxO = O
      if (O < 0.03) continue
      const b = A.bmin[k] < Infinity ? A.bmin[k] : A.bb[k], t = A.tmax[k] > -Infinity ? A.tmax[k] : A.bt[k]
      if (b < sb) sb = b; if (t > st) st = t
    }
    if (!(st > sb)) { sb = this.baseAltitude; st = sb + this.layer }
    sb = Math.floor(sb / 25) * 25; st = Math.ceil(st / 25) * 25   // la losa en pasos de 25 m: el entorno (IBL) solo se rehorneará si cambia de verdad
    const thick = Math.max(200, st - sb), D = M.data
    for (let k = 0; k < n2; k++) {
      const O = A.f[k] * 0.82 > 1 ? 1 : A.f[k] * 0.82, o = k * 4
      if (O < 0.004) { D[o] = D[o + 1] = D[o + 2] = D[o + 3] = 0; continue }
      let b = A.bmin[k] < Infinity ? A.bmin[k] : A.bb[k], t = A.tmax[k] > -Infinity ? A.tmax[k] : A.bt[k]
      if (t < b + 1) t = b + 1
      const bf = clamp01((b - sb) / thick), tf = clamp01((t - sb) / thick), type = A.ws[k] > 0 ? A.tn[k] / A.ws[k] : 0.5
      D[o] = Math.round(O * 255); D[o + 1] = Math.round(O * clamp01(type) * 255); D[o + 2] = Math.round(O * bf * 255); D[o + 3] = Math.round(O * tf * 255)
    }
    M.slabBase = sb; M.slabThick = thick; M.hasClouds = maxO > 0.02; M.prims = prims; M.version++
    M.ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0
    M.volume.rebuild(M, volumes)
    return M
  },
}
