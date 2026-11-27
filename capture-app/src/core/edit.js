// Edición de una captura: calibración del espacio, relleno de huecos, suavizado, recorte, tomas y velocidad. Todo se aplica de forma
// no destructiva con bake(): el archivo conserva los datos originales y las ediciones por separado.
import { J, NJ, normalizeCapture } from './format.js'
import { sub, mul, add, dot, cross, norm, lerp3, mid, clamp, r4 } from './math.js'

const P = (f, i) => [f.p[i * 4], f.p[i * 4 + 1], f.p[i * 4 + 2]]
const VIS = (f, i) => f.p[i * 4 + 3]
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1] ?? 0 }

/**
 * Calibra el espacio del detector: busca, con la postura de los primeros fotogramas, tres ejes del cuerpo (derecha, arriba, adelante)
 * y devuelve la base con la que pasar todo al espacio canónico: +Y arriba, la persona mira hacia −Z y su derecha es +X (como three).
 * Funciona sea cual sea la convención de ejes del detector, incluso si sale espejado, porque los ejes salen de la anatomía.
 */
export function calibrate(frames, { maxFrames = 30 } = {}) {
  const good = frames.filter((f) => [J.leftShoulder, J.rightShoulder, J.leftHip, J.rightHip, J.nose, J.leftEar, J.rightEar].every((i) => VIS(f, i) > 0.4)).slice(0, maxFrames)
  const use = good.length ? good : frames.slice(0, maxFrames)
  if (!use.length) return { right: [1, 0, 0], up: [0, 1, 0], fwd: [0, 0, -1], origin: [0, 0, 0] }
  const med = (fn) => [0, 1, 2].map((k) => median(use.map((f) => fn(f)[k])))
  const hipC = med((f) => mid(P(f, J.leftHip), P(f, J.rightHip)))
  const shC = med((f) => mid(P(f, J.leftShoulder), P(f, J.rightShoulder)))
  const lat0 = med((f) => sub(P(f, J.rightShoulder), P(f, J.leftShoulder)))
  const fwd0 = med((f) => sub(P(f, J.nose), mid(P(f, J.leftEar), P(f, J.rightEar))))
  const up = norm(sub(shC, hipC))
  const right = norm(sub(lat0, mul(up, dot(lat0, up))))
  const fwd = norm(sub(sub(fwd0, mul(up, dot(fwd0, up))), mul(right, dot(fwd0, right))))
  return { right, up, fwd, origin: hipC }
}

/** Pasa los fotogramas al espacio canónico con la base de calibrate(). El origen queda en las caderas del primer fotograma bueno. */
export function toCanonical(frames, basis, { mirror = false } = {}) {
  const { right, up, fwd, origin } = basis
  return frames.map((f) => {
    const p = new Array(NJ * 4)
    for (let i = 0; i < NJ; i++) {
      const v = sub(P(f, i), origin)
      let x = dot(v, right), y = dot(v, up), z = -dot(v, fwd)
      p[i * 4] = x; p[i * 4 + 1] = y; p[i * 4 + 2] = z; p[i * 4 + 3] = VIS(f, i)
    }
    return { t: f.t, p: mirror ? mirrorFrame(p) : p }
  })
}
/** Espejo izquierda↔derecha: intercambia los puntos pares y cambia el signo de X. */
export function mirrorFrame(p) {
  const out = new Array(p.length)
  const swap = (a, b) => { for (let k = 0; k < 4; k++) { out[a * 4 + k] = p[b * 4 + k]; out[b * 4 + k] = p[a * 4 + k] } }
  const pairs = [[1, 4], [2, 5], [3, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16], [17, 18], [19, 20], [21, 22], [23, 24], [25, 26], [27, 28], [29, 30], [31, 32]]
  out[0] = p[0]; out[1] = p[1]; out[2] = p[2]; out[3] = p[3]
  for (const [a, b] of pairs) swap(a, b)
  for (let i = 0; i < NJ; i++) out[i * 4] = -out[i * 4]
  return out
}

/** Puntos con poca visibilidad (la IA los «inventa»): se sustituyen por interpolación entre los vecinos fiables. */
export function fillGaps(frames, minVis = 0.35) {
  const n = frames.length
  if (!n) return frames
  const out = frames.map((f) => ({ t: f.t, p: [...f.p] }))
  for (let j = 0; j < NJ; j++) {
    const ok = (i) => out[i].p[j * 4 + 3] >= minVis
    let last = -1
    for (let i = 0; i < n; i++) {
      if (!ok(i)) continue
      if (last >= 0 && i - last > 1) for (let k = last + 1; k < i; k++) { const u = (out[k].t - out[last].t) / Math.max(1e-6, out[i].t - out[last].t); for (let c = 0; c < 3; c++) out[k].p[j * 4 + c] = out[last].p[j * 4 + c] + (out[i].p[j * 4 + c] - out[last].p[j * 4 + c]) * u }
      else if (last < 0) for (let k = 0; k < i; k++) for (let c = 0; c < 3; c++) out[k].p[j * 4 + c] = out[i].p[j * 4 + c]
      last = i
    }
    if (last >= 0) for (let k = last + 1; k < n; k++) for (let c = 0; c < 3; c++) out[k].p[j * 4 + c] = out[last].p[j * 4 + c]
  }
  return out
}

// ---- filtro One Euro (Casiez et al.): quita el temblor sin retrasar los movimientos rápidos ----
const alpha = (cut, dt) => { const tau = 1 / (2 * Math.PI * cut); return 1 / (1 + tau / dt) }
export function oneEuro(values, times, { minCutoff = 1, beta = 0.3, dCutoff = 1 } = {}) {
  const out = new Array(values.length)
  let x = values[0], dx = 0
  out[0] = x
  for (let i = 1; i < values.length; i++) {
    const dt = Math.max(1e-4, times[i] - times[i - 1])
    const rate = (values[i] - x) / dt
    dx += alpha(dCutoff, dt) * (rate - dx)
    const cut = minCutoff + beta * Math.abs(dx)
    x += alpha(cut, dt) * (values[i] - x)
    out[i] = x
  }
  return out
}
/** amount 0 = sin tocar · 1 = muy suave. */
export function smoothFrames(frames, amount) {
  if (amount <= 0 || frames.length < 3) return frames
  const times = frames.map((f) => f.t)
  const minCutoff = 15 * Math.pow(0.05, clamp(amount, 0, 1)) // 15 Hz → 0,75 Hz
  const out = frames.map((f) => ({ t: f.t, p: [...f.p] }))
  for (let j = 0; j < NJ; j++) for (let c = 0; c < 3; c++) {
    const s = oneEuro(frames.map((f) => f.p[j * 4 + c]), times, { minCutoff, beta: 8 })
    for (let i = 0; i < frames.length; i++) out[i].p[j * 4 + c] = s[i]
  }
  return out
}

/** Fotograma interpolado en t (los puntos son lineales; la visibilidad, la menor de las dos). */
export function sampleFrames(frames, t) {
  if (!frames.length) return null
  if (t <= frames[0].t) return frames[0]
  const last = frames.at(-1)
  if (t >= last.t) return last
  let lo = 0, hi = frames.length - 1
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (frames[m].t <= t) lo = m; else hi = m }
  const a = frames[lo], b = frames[hi], u = (t - a.t) / Math.max(1e-9, b.t - a.t)
  const p = new Array(a.p.length)
  for (let i = 0; i < p.length; i++) p[i] = i % 4 === 3 ? Math.min(a.p[i], b.p[i]) : a.p[i] + (b.p[i] - a.p[i]) * u
  return { t, p }
}

/** Cierre de los dedos en t (frames[].c, ver format.js): interpola; −1 si no se vio. `mirror` intercambia las manos. */
export function sampleCurls(frames, t, mirror = false) {
  if (!frames.length || !frames.some((f) => f.c)) return null
  let lo = 0, hi = frames.length - 1
  if (t <= frames[0].t) hi = 0
  else if (t >= frames[hi].t) lo = hi
  else while (hi - lo > 1) { const m = (lo + hi) >> 1; if (frames[m].t <= t) lo = m; else hi = m }
  const a = frames[lo].c, b = frames[hi].c
  if (!a && !b) return null
  const u = hi > lo ? (t - frames[lo].t) / Math.max(1e-9, frames[hi].t - frames[lo].t) : 0
  const c = new Array(10)
  for (let i = 0; i < 10; i++) { const x = a?.[i] ?? -1, y = b?.[i] ?? -1; c[i] = x < 0 || y < 0 ? Math.max(x, y) : r4(x + (y - x) * u) }
  return mirror ? [...c.slice(5), ...c.slice(0, 5)] : c
}

/** Reduce una lista de claves de cámara (Ramer–Douglas–Peucker sobre posición, rotación y fov). */
export function simplifyKeys(keys, tol = 0.02) {
  if (keys.length < 3) return keys
  const vec = (k) => [...k.pos, k.rot[0] / 45, k.rot[1] / 45, k.rot[2] / 45, k.fov / 60]
  const keep = new Array(keys.length).fill(false); keep[0] = keep[keys.length - 1] = true
  const rec = (a, b) => {
    let worst = -1, wd = 0
    const va = vec(keys[a]), vb = vec(keys[b])
    for (let i = a + 1; i < b; i++) {
      const u = (keys[i].t - keys[a].t) / Math.max(1e-9, keys[b].t - keys[a].t), v = vec(keys[i])
      let d = 0; for (let k = 0; k < v.length; k++) d = Math.max(d, Math.abs(v[k] - (va[k] + (vb[k] - va[k]) * u)))
      if (d > wd) { wd = d; worst = i }
    }
    if (worst >= 0 && wd > tol) { keep[worst] = true; rec(a, worst); rec(worst, b) }
  }
  rec(0, keys.length - 1)
  return keys.filter((_, i) => keep[i])
}

/** Ruido determinista y suave (sin Math.random: el temblor sale igual cada vez). */
const noise = (t, seed) => Math.sin(t * 12.9898 + seed * 78.233) * 0.5 + Math.sin(t * 7.13 + seed * 3.7) * 0.3 + Math.sin(t * 19.7 + seed * 1.3) * 0.2

export function sampleCamera(keys, t) {
  if (!keys.length) return null
  if (t <= keys[0].t) return keys[0]
  if (t >= keys.at(-1).t) return keys.at(-1)
  let i = 0; while (keys[i + 1].t <= t) i++
  const a = keys[i], b = keys[i + 1], u = (t - a.t) / Math.max(1e-9, b.t - a.t)
  const dr = (x, y) => { let d = (y - x) % 360; if (d > 180) d -= 360; if (d < -180) d += 360; return x + d * u }
  return { t, pos: lerp3(a.pos, b.pos, u), rot: [dr(a.rot[0], b.rot[0]), dr(a.rot[1], b.rot[1]), dr(a.rot[2], b.rot[2])], fov: a.fov + (b.fov - a.fov) * u }
}

/**
 * Aplica las ediciones y devuelve las TOMAS listas para retarget y Timeline:
 *   { takes: [{ name, fps, duration, frames:[{t,p}] (canónico), camera:[claves], layers:[capas relativas a la toma] }], basis }
 * Orden: calibrar → espejo → rellenar huecos → suavizar → recortar → dividir → velocidad → remuestrear a `fps`.
 */
export function bake(input, { fps } = {}) {
  const cap = normalizeCapture(input)
  const rate = fps || cap.fps
  const e = cap.edits
  const basis = calibrate(cap.body.frames)
  let frames = toCanonical(cap.body.frames, basis, { mirror: e.mirror })
  frames = smoothFrames(fillGaps(frames), e.smooth)
  const total = frames.at(-1)?.t ?? 0
  const [a, b] = e.trim || [0, total]
  const cuts = [a, ...e.cuts.filter((t) => t > a + 0.05 && t < b - 0.05), b]
  const takes = []
  for (let k = 0; k < cuts.length - 1; k++) {
    const t0 = cuts[k], t1 = cuts[k + 1]
    const dur = (t1 - t0) / e.speed
    const n = Math.max(2, Math.round(dur * rate) + 1)
    const out = [], cam = []
    for (let i = 0; i < n; i++) {
      const tt = Math.min(dur, i / rate), src = t0 + tt * e.speed
      const f = sampleFrames(frames, src)
      if (f) { const o = { t: r4(tt), p: f.p.map(r4) }; const c = sampleCurls(cap.body.frames, src, e.mirror); if (c) o.c = c; out.push(o) }
      const c = sampleCamera(cap.camera.keys, src)
      if (c) {
        let rot = c.rot
        for (const ly of cap.layers) if (ly.kind === 'shake' && src >= ly.t0 && src <= ly.t1) { const am = +ly.params.amount || 1; rot = [rot[0] + noise(src, 1) * am, rot[1] + noise(src, 2) * am, rot[2] + noise(src, 3) * am * 0.5] }
        cam.push({ t: r4(tt), pos: c.pos.map(r4), rot: rot.map(r4), fov: r4(c.fov) })
      }
    }
    const layers = cap.layers.filter((l) => l.kind !== 'shake' && l.t1 >= t0 && l.t0 <= t1).map((l) => ({ ...l, t0: r4(Math.max(0, (l.t0 - t0) / e.speed)), t1: r4(Math.min(dur, (l.t1 - t0) / e.speed)) }))
    takes.push({ name: cuts.length > 2 ? `${cap.name} · toma ${k + 1}` : cap.name, fps: rate, duration: r4(dur), frames: out, camera: simplifyKeys(cam, 0.01), layers })
  }
  return { takes, basis }
}

/** Filtro One Euro en tiempo real (un valor por llamada): la vista previa en vivo usa el mismo suavizado que bake(). */
export class OneEuroStream {
  constructor({ minCutoff = 1.7, beta = 8, dCutoff = 1 } = {}) { Object.assign(this, { minCutoff, beta, dCutoff }); this.x = null; this.dx = 0; this.t = 0 }
  static forAmount(amount) { return new OneEuroStream({ minCutoff: 15 * Math.pow(0.05, clamp(amount, 0, 1)), beta: 8 }) }
  filter(v, t) {
    if (this.x === null) { this.x = v; this.t = t; return v }
    const dt = Math.max(1e-4, t - this.t); this.t = t
    this.dx += alpha(this.dCutoff, dt) * ((v - this.x) / dt - this.dx)
    this.x += alpha(this.minCutoff + this.beta * Math.abs(this.dx), dt) * (v - this.x)
    return this.x
  }
}
/** Suaviza fotogramas uno a uno (33 puntos × 3). */
export class FrameSmoother {
  constructor(amount = 0.35) { this.f = Array.from({ length: NJ * 3 }, () => OneEuroStream.forAmount(amount)) }
  push(frame) {
    const p = [...frame.p]
    for (let j = 0; j < NJ; j++) for (let c = 0; c < 3; c++) p[j * 4 + c] = this.f[j * 3 + c].filter(frame.p[j * 4 + c], frame.t)
    return { t: frame.t, p }
  }
}
