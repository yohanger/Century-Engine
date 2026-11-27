// Muestreo de clips y reproductor (AnimRunner). Puro: habla con el juego a través de `host`.
//
//  host = {
//    apply(track, valor)          aplica el valor de una pista a su nodo
//    read(track)                  valor actual de la pista (para mezclar al empezar y en modo aditivo)
//    event(ev)                    se alcanzó un evento del clip
//  }
import { PROPS } from './model.js'

const back = (u) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2) }
const bounce = (u) => { const n = 7.5625, d = 2.75; if (u < 1 / d) return n * u * u; if (u < 2 / d) return n * (u -= 1.5 / d) * u + 0.75; if (u < 2.5 / d) return n * (u -= 2.25 / d) * u + 0.9375; return n * (u -= 2.625 / d) * u + 0.984375 }
const elastic = (u) => (u === 0 || u === 1 ? u : Math.pow(2, -10 * u) * Math.sin((u * 10 - 0.75) * (2 * Math.PI / 3)) + 1)

/** Curva cubic-bezier(x1,y1,x2,y2) como en CSS: x → y. */
export function bezierEase(bz, u) {
  const [x1, y1, x2, y2] = bz
  const bx = (s) => 3 * (1 - s) * (1 - s) * s * x1 + 3 * (1 - s) * s * s * x2 + s * s * s
  const by = (s) => 3 * (1 - s) * (1 - s) * s * y1 + 3 * (1 - s) * s * s * y2 + s * s * s
  let lo = 0, hi = 1, s = u
  for (let i = 0; i < 24; i++) { s = (lo + hi) / 2; if (bx(s) < u) lo = s; else hi = s }
  return by(s)
}
export function easeValue(k, u) {
  u = Math.min(1, Math.max(0, u))
  switch (k.ease) {
    case 'linear': return u
    case 'in': return u * u
    case 'out': return 1 - (1 - u) * (1 - u)
    case 'bezier': return bezierEase(k.bz || [0.42, 0, 0.58, 1], u)
    case 'back': return back(u)
    case 'bounce': return bounce(u)
    case 'elastic': return elastic(u)
    case 'cut': return 0
    default: return u * u * (3 - 2 * u)
  }
}

const hexToRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const rgbToHex = (c) => '#' + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')

/** Índice i con keys[i].t <= t (o -1 si t es anterior a la primera). */
export function segment(keys, t) {
  if (!keys.length || t < keys[0].t) return -1
  let i = keys.length - 1
  while (i > 0 && keys[i].t > t) i--
  return i
}

/** Valor de una pista en `t`; antes de la primera clave mantiene la primera; undefined si no tiene claves. */
export function sampleTrack(track, t) {
  const ks = track.keys
  if (!ks.length) return undefined
  const i = segment(ks, t)
  if (i < 0) return ks[0].v
  const a = ks[i], b = ks[i + 1]
  const kind = PROPS[track.prop]?.kind
  if (!b || a.ease === 'cut' || kind === 'bool') { if (!b || t < b.t || kind === 'bool') return a.v; return b.v }
  const span = b.t - a.t
  if (span <= 0) return t >= b.t ? b.v : a.v
  const u = easeValue(a, (t - a.t) / span)
  if (kind === 'vec3') return a.v.map((v, n) => v + (b.v[n] - v) * u)
  if (kind === 'number') return a.v + (b.v - a.v) * u
  if (kind === 'color') { const ca = hexToRgb(a.v), cb = hexToRgb(b.v); return rgbToHex(ca.map((v, n) => v + (cb[n] - v) * u)) }
  return a.v
}

/** Tiempo dentro del clip según el bucle: [tiempo, terminó]. */
export function wrapTime(t, dur, loop) {
  if (loop) return [dur > 0 ? ((t % dur) + dur) % dur : 0, false]
  return t >= dur ? [dur, true] : [Math.max(0, t), false]
}

/** Mezcla lo que había (`from`) con el valor de la pista (`to`) con peso w ∈ [0,1]. */
export function blendValue(prop, from, to, w) {
  if (w >= 1 || from === undefined) return to
  const kind = PROPS[prop]?.kind
  if (kind === 'vec3') return from.map((v, n) => v + (to[n] - v) * w)
  if (kind === 'number') return from + (to - from) * w
  if (kind === 'color') { const a = hexToRgb(from), b = hexToRgb(to); return rgbToHex(a.map((v, n) => v + (b[n] - v) * w)) }
  return w >= 0.5 ? to : from
}

/** Valor «aditivo»: base + delta (posición/rotación), base · escala. */
export function addValue(prop, base, v) {
  if (!base) return v
  if (prop === 'scale') return base.map((x, n) => x * v[n])
  if (prop === 'position' || prop === 'rotation') return base.map((x, n) => x + v[n])
  return v
}

export class AnimRunner {
  /** opts: { loop, speed, fade, from, additive } — los que falten salen del clip. */
  constructor(clip, host, opts = {}) {
    this.clip = clip; this.host = host
    this.loop = opts.loop ?? clip.loop
    this.speed = (opts.speed ?? 1) * (clip.speed || 1)
    this.fade = Math.max(0, +opts.fade || 0)
    this.additive = opts.additive ?? clip.additive
    this.time = Math.max(0, +opts.from || 0)
    this.elapsed = 0
    this.paused = false; this.finished = false; this.stopped = false
    this.lastT = this.time
    this.base = new Map()  // pista → valor al empezar (aditivo y mezcla)
    for (const tr of clip.tracks) if (tr.keys.length) this.base.set(tr.id, host.read?.(tr))
    this.done = new Promise((r) => { this._res = r })
    this.apply()
    this.fireFrom(-1, this.time)
  }
  get playing() { return !this.finished && !this.paused }
  get progress() { return this.clip.duration > 0 ? this.time / this.clip.duration : 1 }

  /** Aplica la pose del instante actual. */
  apply() {
    const w = this.fade > 0 ? Math.min(1, this.elapsed / this.fade) : 1
    for (const tr of this.clip.tracks) {
      let v = sampleTrack(tr, this.time)
      if (v === undefined) continue
      const base = this.base.get(tr.id)
      if (this.additive) v = addValue(tr.prop, base, v)
      if (w < 1) v = blendValue(tr.prop, base, v, w * w * (3 - 2 * w))
      this.host.apply(tr, v)
    }
  }
  fireFrom(a, b) { for (const ev of this.clip.events) if (ev.t > a && ev.t <= b) this.host.event?.(ev, this) }

  update(dt) {
    if (this.finished) return false
    this.elapsed += dt
    if (!this.paused) {
      const dur = this.clip.duration
      const prev = this.time
      const raw = prev + dt * this.speed
      if (this.loop && dur > 0) {
        if (raw >= dur) { this.fireFrom(prev, dur); this.time = raw % dur; this.fireFrom(-1, this.time) } else { this.time = raw; this.fireFrom(prev, raw) }
      } else {
        const [t, end] = wrapTime(raw, dur, false)
        this.time = t; this.fireFrom(prev, t)
        if (end) { this.apply(); this.finish(false); return false }
      }
    }
    this.apply()
    return true
  }
  seek(t) { this.time = Math.min(this.clip.duration, Math.max(0, +t || 0)); this.lastT = this.time; this.apply() }
  pause() { this.paused = true }
  resume() { this.paused = false }
  stop() { if (!this.finished) this.finish(true) }
  finish(stopped) { this.finished = true; this.stopped = stopped; this._res({ stopped, clip: this.clip.name }); this.host.end?.(this, stopped) }
}
