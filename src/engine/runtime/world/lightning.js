// Rayos físicos: el canal crece por ruptura dieléctrica (modelo de FrostEngine, autoría del usuario) y la corriente sigue la forma de onda de
// Heidler con golpes sucesivos. Sin DOM ni THREE: el suelo se inyecta (`groundAt`) y el azar también.
//
//   const bolt = createStrike(cfg, rng, { cloud: [x, y, z], cloudRadius, thickness, development, groundAt })
//   bolt → { points: [[x,y,z]…], parents: [i…], dist: [m…] (recorrido desde la nube), peak (kA), cloud, cloudRadius }
//   const fm = new FlashModel(cfg); fm.start(bolt.peak); fm.update(dt) → 0–1 (persistencia visual: destello y brillo del canal)
//
// El potencial es una malla 3D (0 en el suelo, 1 en la nube y en el propio canal) que se relaja con Jacobi (Laplace); cada paso del
// líder elige una celda vecina con probabilidad ∝ (caída de potencial)^η, con sesgo hacia abajo y un ruido de Gumbel: de ahí salen las
// ramas y el zigzag. Termina al llegar al suelo.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

export const LIGHTNING_DEFAULTS = {
  maxPerMinute: 1.2, simRadius: 900, cloudBase: 850, resX: 18, resY: 28, resZ: 18, jacobi: 24, maxSegments: 110, branching: 3.1,
  peakKA: 30, decayLength: 2000, heidlerRise: 1.2, heidlerDecay: 50, heidlerExp: 2, flashSeconds: 0.42,
}

/**
 * Un rayo. `o` = { cloud: [x, y, z] (centro de la nube), cloudRadius, thickness, development (0–1), groundAt: (x, z) → altura o NaN }.
 * `cfg` = LIGHTNING_DEFAULTS (o parte). Devuelve el árbol del canal: el punto 0 es la nube; los demás cuelgan de `parents[i]`.
 */
export function createStrike(cfg, rng, o) {
  const C = { ...LIGHTNING_DEFAULTS, ...cfg }
  const nx = clamp(Math.round(C.resX), 8, 36), ny = clamp(Math.round(C.resY), 12, 48), nz = clamp(Math.round(C.resZ), 8, 36)
  const cc = o.cloud, cloudRadius = Math.max(20, o.cloudRadius), thick = Math.max(20, o.thickness), dev = clamp(o.development ?? 0.5, 0, 1)
  const groundAt = o.groundAt || (() => NaN)
  const cloudTop = cc[1] + thick * (0.3 + (0.58 - 0.3) * dev)
  let ref = groundAt(cc[0], cc[2]); if (!Number.isFinite(ref)) ref = 0
  if (ref > cc[1] - 15) ref = Math.min(cc[1] - 15, 0)
  const radius = Math.max(20, Math.min(Math.max(40, C.simRadius), Math.max(60, cloudRadius * 1.35)))
  const height = Math.max(50, Math.max(60, cloudTop - ref))
  const org = [cc[0], ref, cc[2]]
  const N = nx * ny * nz
  let pot = new Float32Array(N), scr = new Float32Array(N); const cond = new Uint8Array(N), gY = new Int32Array(nx * nz)
  const idx = (x, y, z) => x + nx * (y + ny * z)
  const toWorld = (x, y, z) => [org[0] + (x / (nx - 1) - 0.5) * radius * 2, org[1] + (y / (ny - 1)) * height, org[2] + (z / (nz - 1) - 0.5) * radius * 2]
  const toCell = (p) => [clamp(Math.round(((p[0] - org[0]) / (radius * 2) + 0.5) * (nx - 1)), 0, nx - 1), clamp(Math.round(((p[1] - org[1]) / height) * (ny - 1)), 0, ny - 1), clamp(Math.round(((p[2] - org[2]) / (radius * 2) + 0.5) * (nz - 1)), 0, nz - 1)]

  // suelo: una altura por columna (cada 2 celdas, como el original)
  for (let z = 0; z < nz; z += 2) for (let x = 0; x < nx; x += 2) {
    const wx = org[0] + (x / (nx - 1) - 0.5) * radius * 2, wz = org[2] + (z / (nz - 1) - 0.5) * radius * 2
    let gh = groundAt(wx, wz); if (!Number.isFinite(gh)) gh = org[1]
    const g = clamp(Math.round(clamp((gh - org[1]) / height, 0, 1) * (ny - 1)), 0, ny - 3)
    for (let fz = z; fz < Math.min(nz, z + 2); fz++) for (let fx = x; fx < Math.min(nx, x + 2); fx++) gY[fz * nx + fx] = g
  }
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    const g = gY[z * nx + x]
    pot[idx(x, y, z)] = y <= g ? 0 : y === ny - 1 ? 1 : (y - g) / Math.max(1, ny - 1 - g)
  }
  const bound = (f) => {
    for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const i = idx(x, y, z), g = gY[z * nx + x]
      if (y <= g) f[i] = 0
      else if (cond[i] || y === ny - 1) f[i] = 1
      else if (x === 0 || x === nx - 1 || z === 0 || z === nz - 1) f[i] = (y - g) / Math.max(1, ny - 1 - g)
    }
  }
  const solve = (iters) => {
    for (let it = 0; it < iters; it++) {
      for (let z = 1; z < nz - 1; z++) for (let y = 1; y < ny - 1; y++) for (let x = 1; x < nx - 1; x++) {
        const i = idx(x, y, z)
        scr[i] = y <= gY[z * nx + x] ? 0 : cond[i] ? 1 : (pot[idx(x - 1, y, z)] + pot[idx(x + 1, y, z)] + pot[idx(x, y - 1, z)] + pot[idx(x, y + 1, z)] + pot[idx(x, y, z - 1)] + pot[idx(x, y, z + 1)]) / 6
      }
      bound(scr); const s = pot; pot = scr; scr = s
    }
  }
  solve(clamp(Math.round(C.jacobi), 4, 18))

  const maxSeg = clamp(Math.round(C.maxSegments), 12, 220)
  const bolt = { points: [], parents: [], dist: [], cells: [], peak: Math.max(1, C.peakKA * (0.72 + 0.56 * rng())), cloud: cc, cloudRadius, thickness: thick, development: dev }
  const add = (world, cell, parent) => {
    const i = bolt.points.length; bolt.points.push(world); bolt.parents.push(parent); bolt.cells.push(cell)
    bolt.dist.push(parent >= 0 ? bolt.dist[parent] + Math.hypot(world[0] - bolt.points[parent][0], world[1] - bolt.points[parent][1], world[2] - bolt.points[parent][2]) : 0)
    return i
  }
  const sx = clamp(((nx / 2) | 0) + Math.round((rng() * 0.2 - 0.1) * (nx - 2)), 1, nx - 2), sz = clamp(((nz / 2) | 0) + Math.round((rng() * 0.2 - 0.1) * (nz - 2)), 1, nz - 2)
  add(toWorld(sx, ny - 2, sz), [sx, ny - 2, sz], -1)
  cond[idx(sx, ny - 2, sz)] = 1; pot[idx(sx, ny - 2, sz)] = 1
  let tips = [0]
  const eta = clamp(C.branching, 0.5, 8)

  for (let seg = 0; seg < maxSeg; seg++) {
    // candidatos: vecinos libres de las puntas activas, ponderados por la caída de potencial
    const cands = []; let total = 0
    for (const tp of tips) {
      const [tx, ty, tz] = bolt.cells[tp], tpot = pot[idx(tx, ty, tz)]
      for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy && !dz) continue
        const x = tx + dx, y = ty + dy, z = tz + dz
        if (x <= 0 || x >= nx - 1 || y <= 0 || y >= ny - 1 || z <= 0 || z >= nz - 1) continue
        const i = idx(x, y, z); if (cond[i] || cands.length >= 192) continue
        const drop = Math.max(1e-5, tpot - pot[i]), bias = dy < 0 ? 1.85 : dy === 0 ? 0.65 : 0.12
        const g = -Math.log(-Math.log(clamp(rng(), 1e-4, 0.9999)))
        const w = Math.pow(drop, eta) * bias * Math.exp(clamp(g * 0.18, -2, 2))
        if (w > 0) { cands.push({ tp, cell: [x, y, z], w }); total += w }
      }
    }
    if (!cands.length || total <= 0) break
    let roll = rng() * total, sel = cands[cands.length - 1]
    for (const c of cands) { roll -= c.w; if (roll <= 0) { sel = c; break } }
    const ni = add(toWorld(...sel.cell), sel.cell, sel.tp), ci = idx(...sel.cell)
    cond[ci] = 1; pot[ci] = 1
    if (sel.cell[1] <= gY[sel.cell[2] * nx + sel.cell[0]] + 1) break // tocó el suelo
    // la punta vieja sigue activa con probabilidad (ramificación) o se sustituye por la nueva
    const keep = tips.length < 7 && rng() < clamp(0.08 + sel.w * 0.05, 0, 1)
    if (!keep) tips = tips.filter((t) => t !== sel.tp)
    if (!tips.includes(ni) && tips.length < 8) tips.push(ni)
    if ((seg & 7) === 7) { solve(1); for (const c of bolt.cells) { const i = idx(c[0], c[1], c[2]); cond[i] = 1; pot[i] = 1 } }
  }
  // unión al suelo: último punto → baja hasta el terreno
  const last = bolt.points.length - 1, tip = bolt.points[last]
  let gh = groundAt(tip[0], tip[2]); if (!Number.isFinite(gh)) gh = org[1]
  if (tip[1] > gh + 1) add([tip[0], gh, tip[2]], toCell([tip[0], gh, tip[2]]), last)
  delete bolt.cells
  bolt.height = height; bolt.radius = radius; bolt.origin = org
  return bolt
}

/**
 * Forma de onda de la corriente (Heidler) con golpes sucesivos (+75 ms al 58 %, +155 ms al 36 %) y corriente continua; produce la
 * «persistencia visual» 0–1: sube a 1 con cada golpe y decae en ~0,11 s (por eso un rayo parpadea 2–3 veces).
 */
export class FlashModel {
  constructor(cfg = {}) { this.cfg = { ...LIGHTNING_DEFAULTS, ...cfg }; this.active = false; this.value = 0; this.t = 0; this.peak = 1 }
  _tau() { const c = this.cfg, t1 = Math.max(1e-7, c.heidlerRise * 1e-6), t2 = Math.max(t1, c.heidlerDecay * 1e-6), n = Math.max(1, c.heidlerExp); return [t1, t2, n] }
  peakTime() { const [t1, t2, n] = this._tau(); return t1 * Math.pow((n * t2) / t1, 1 / n) }
  heidler(t, kA) {
    if (t < 0) return 0
    const [t1, t2, n] = this._tau(), tp = this.peakTime()
    const f = (x) => { const p = Math.pow(Math.max(0, x / t1), n); return (p / (1 + p)) * Math.exp(-x / t2) }
    const norm = f(tp) || 1
    return (kA * f(t)) / norm
  }
  current(t, kA) {
    if (t < 0) return 0
    return this.heidler(t, kA) + this.heidler(t - 0.075, kA * 0.58) + this.heidler(t - 0.155, kA * 0.36) + (t > 0.004 ? kA * 0.025 * Math.exp(-(t - 0.004) / 0.18) : 0)
  }
  _peakIn(a, b, kA) {
    if (b < 0 || b < a) return 0
    const s = Math.max(0, a), e = Math.max(s, b), tp = this.peakTime()
    let p = Math.max(this.current(s, kA), this.current(e, kA))
    for (const c of [tp, 0.075 + tp, 0.155 + tp, 0.004]) if (c >= s && c <= e) p = Math.max(p, this.current(c, kA))
    return p
  }
  start(kA = 30) { this.peak = Math.max(1, kA); this.t = 0; this.value = 1; this.active = true }
  /** Avanza `dt` s; devuelve la persistencia visual 0–1 (0 cuando el rayo terminó). */
  update(dt) {
    if (!this.active) return 0
    const a = this.t; this.t += Math.max(0, dt)
    const norm = clamp(this._peakIn(a, this.t, this.peak) / this.peak, 0, 1)
    this.value = Math.max(norm, this.value * Math.exp(-Math.max(0, dt) / 0.11))
    if (this.t >= Math.max(0.12, this.cfg.flashSeconds)) { this.active = false; this.value = 0 }
    return this.value
  }
  stop() { this.active = false; this.value = 0 }
}

/** Genera una única descarga y resuelve el primer contacto para render y simulación. */
export function resolveWorldStrike(strike, observer, { groundAt = () => NaN, intersect = () => null } = {}) {
  if (!strike || !Number.isInteger(strike.seed) || !Array.isArray(observer) || observer.length < 3 ||
      !observer.every(Number.isFinite)) throw new Error('Rayo: origen o semilla inválida')
  const rad = strike.bearing * Math.PI / 180
  const cx = observer[0] + Math.sin(rad) * strike.distance
  const cz = observer[2] - Math.cos(rad) * strike.distance
  const thick = Math.min(1500, Math.max(300, (strike.thickness || 1500) * 0.5))
  const cloud = strike.cloud ? [...strike.cloud] : [cx, (strike.altitude || 1200) + thick * 0.35, cz]
  const rng = (() => { let a = strike.seed | 0; return () => { a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } })()
  const bolt = createStrike({ ...LIGHTNING_DEFAULTS, peakKA: strike.peak }, rng, { cloud,
    cloudRadius: strike.cloudRadius || 240, thickness: thick, development: strike.type ?? 0.5, groundAt })
  const last = bolt.points.length - 1, tip = bolt.points[last], start = bolt.points[0]
  const candidates = []
  const ground = groundAt(tip[0],tip[2])
  if (Number.isFinite(ground)) candidates.push({ kind:'terrain', point:[tip[0],ground,tip[2]], normal:[0,1,0], ownerId:null })
  const hit = intersect(start,tip)
  if (hit && Array.isArray(hit.point) && hit.point.length===3 && hit.point.every(Number.isFinite) &&
      hit.point[1] <= start[1] && hit.point[1] >= tip[1]-0.5 &&
      ['object','water','terrain'].includes(hit.kind)) candidates.push(hit)
  // El primer contacto válido debe estar delante del suelo y del extremo del rayo.
  candidates.sort((a,b) => b.point[1]-a.point[1])
  const best = candidates[0] || null
  if (best) bolt.points[last] = [...best.point]
  const impact = best ? { id:strike.id, seed:strike.seed, peakKA:strike.peak,
    kind:best.kind, point:[...best.point], normal:[...(best.normal||[0,1,0])],
    ownerId:best.ownerId||null, surface:best.surface||'', materialId:best.materialId||'' } : null
  return { bolt, impact }
}
