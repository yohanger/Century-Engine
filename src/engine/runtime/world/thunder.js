// Trueno procedural (Bloque C2 del Environment). Sin DOM ni THREE ni WebAudio: devuelve muestras (Float32Array) y las reproduce quien llama.
//
// Modelo físico simplificado (hecho a partir de la acústica del trueno, NO es un port línea a línea de FrostEnvironmentThunderSimulation.cs):
//  · El trueno no sale de un punto: sale de TODO el canal del rayo (tronco + ramas + tramos horizontales dentro de la nube). Cada segmento
//    radia una onda de choque (onda N) hacia los lados y llega al oyente a t = (r − r_mín) / 343. La diferencia de recorrido entre lo más
//    cercano y lo más lejano del canal es lo que estira el estruendo (varios segundos).
//  · Amplitud de cada pulso ∝ √(longitud × energía) × directividad / r (la onda sale perpendicular al segmento; la parte baja del canal,
//    con más corriente, es más energética).
//  · Crujido = suma de los pulsos de los segmentos cercanos (agudos). Cuerpo grave = ruido paso bajo (45–180 Hz) con la envolvente de energía
//    que llega en cada instante. Con la distancia el aire se come los agudos (paso bajo) y la ondícula se ensancha: lejos solo queda el grave.
//  · Regiones acústicas (campo abierto, bosque, valle, ciudad, interior): reverberación (peines + pasos de todo), ecos discretos, absorción de
//    agudos y un suelo de oclusión. Una región es una caja en el mundo (centro + tamaño) o la de la escena por defecto.
//  · Oclusión: un filtro paso bajo + bajada de volumen (occlusionFilter) que mueve quien reproduce según los rayos de sonido hacia techos y paredes.
// Todo es reproducible por semilla. Norte = −Z, este = +X; bearing 0 = norte, 90 = este.

export const SPEED_OF_SOUND = 343
const TAU = Math.PI * 2
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const lerp = (a, b, t) => a + (b - a) * t
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }

export function mulberry32(a) { return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

/**
 * Regiones acústicas. rt60 = cola de la reverberación (s) · reverb = cuánta se mezcla · echoes = ecos discretos (cuántos, entre qué retardos) ·
 * hf = corte de agudos de la zona (Hz) · body/crack = multiplicadores del grave y del crujido · occlusion = suelo de oclusión (0–1).
 */
export const ACOUSTIC_PRESETS = {
  open: { label: 'Campo abierto', rt60: 0.9, reverb: 0.16, echoes: 0, span: [0.4, 2], hf: 16000, body: 1, crack: 1, occlusion: 0 },
  forest: { label: 'Bosque', rt60: 0.7, reverb: 0.22, echoes: 0, span: [0.2, 1], hf: 1600, body: 0.9, crack: 0.5, occlusion: 0 },
  valley: { label: 'Valle o montañas', rt60: 2.8, reverb: 0.3, echoes: 6, span: [0.6, 4.2], hf: 7000, body: 1.15, crack: 1, occlusion: 0 },
  city: { label: 'Ciudad', rt60: 1.6, reverb: 0.28, echoes: 7, span: [0.08, 0.9], hf: 9000, body: 0.9, crack: 1.05, occlusion: 0 },
  interior: { label: 'Interior', rt60: 0.6, reverb: 0.25, echoes: 0, span: [0.1, 0.5], hf: 5000, body: 0.85, crack: 0.7, occlusion: 0.75 },
}
export const ACOUSTIC_LIST = Object.entries(ACOUSTIC_PRESETS).map(([id, p]) => [id, p.label])
export const acoustic = (id) => ACOUSTIC_PRESETS[id] || ACOUSTIC_PRESETS.open

/** Región que vale en `pos`: la primera caja de `regions` ({ preset, cx, cy, cz, sx, sy, sz }) que lo contiene; si no, `def`. → { id, index, preset } */
export function pickRegion(regions, pos, def = 'open') {
  const list = Array.isArray(regions) ? regions : []
  for (let i = 0; i < list.length; i++) {
    const r = list[i]
    if (Math.abs(pos[0] - r.cx) <= r.sx / 2 && Math.abs(pos[1] - r.cy) <= r.sy / 2 && Math.abs(pos[2] - r.cz) <= r.sz / 2) return { id: r.preset, index: i, preset: acoustic(r.preset) }
  }
  return { id: ACOUSTIC_PRESETS[def] ? def : 'open', index: -1, preset: acoustic(def) }
}

/** Oclusión (0 = al aire libre, 1 = tapado) → filtro paso bajo (Hz) y ganancia (0–1). */
export function occlusionFilter(occ) {
  const o = clamp(+occ || 0, 0, 1)
  return { cutoff: 20000 * Math.pow(450 / 20000, o), gain: 1 - 0.55 * o }
}

/**
 * Oclusión a partir de rayos de sonido. `blocked(dir)` dice si el rayo [x,y,z] choca con algo cerca del oyente. Se tira uno hacia arriba (techo,
 * peso 3), ocho a 50° de elevación (aleros, copas, tejados) y, si se conoce, uno hacia el rayo (paredes; peso 2). Nunca llega a 1: el trueno
 * siempre se cuela algo.
 */
export function probeOcclusion(blocked, bearing = null) {
  let w = 0, b = 0
  const add = (dir, k) => { w += k; if (blocked(dir)) b += k }
  add([0, 1, 0], 3)
  const c = Math.cos((50 * Math.PI) / 180), s = Math.sin((50 * Math.PI) / 180)
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; add([Math.sin(a) * c, s, -Math.cos(a) * c], 1) }
  if (bearing != null) { const a = (bearing * Math.PI) / 180; add([Math.sin(a), 0.05, -Math.cos(a)], 2) }
  return Math.min(0.92, b / w)
}

// ---------- el canal acústico ----------
/** Polilínea de `a` a `b` por desplazamiento del punto medio, con tramos ≤ `step`. */
function wander(a, b, step, rng, rough, out) {
  const rec = (p, q, amp) => {
    const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2], len = Math.hypot(dx, dy, dz)
    if (len <= step) { out.push(q); return }
    const m = [(p[0] + q[0]) / 2 + (rng() - 0.5) * 2 * amp, (p[1] + q[1]) / 2 + (rng() - 0.5) * amp, (p[2] + q[2]) / 2 + (rng() - 0.5) * 2 * amp]
    rec(p, m, amp * 0.62); rec(m, q, amp * 0.62)
  }
  out.push(a); rec(a, b, rough * Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]))
  return out
}

/**
 * Segmentos del canal en coordenadas del oyente (oído en el origen, Y arriba). Cada uno: [mx,my,mz, longitud, ux,uy,uz, peso].
 * `o` = { distance, bearing, cloudBase (altura de la base de la nube, m), thickness, earHeight }.
 */
export function thunderChannel(rng, o) {
  const D = Math.max(30, o.distance), b = ((o.bearing || 0) * Math.PI) / 180
  const gx = Math.sin(b) * D, gz = -Math.cos(b) * D, ear = o.earHeight ?? 1.7
  const hc = clamp(o.cloudBase ?? 1100, 300, 4500), thick = clamp(o.thickness ?? 1200, 200, 3500)
  const top = hc + thick * 0.35 * (0.6 + 0.8 * rng())
  const step = clamp(D / 250, 6, 28)
  const segs = []
  // `near`: las ramas y los tramos de la nube no se acercan al oyente más que la base del rayo (así el primer sonido llega a distancia/343)
  const push = (pts, w, near = 0) => {
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], q = pts[i], dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2], len = Math.hypot(dx, dy, dz)
      if (len < 1e-3) continue
      if (near && Math.hypot((p[0] + q[0]) / 2, (p[1] + q[1]) / 2 - ear, (p[2] + q[2]) / 2) < near) continue
      const my = (p[1] + q[1]) / 2
      segs.push([(p[0] + q[0]) / 2, my - ear, (p[2] + q[2]) / 2, len, dx / len, dy / len, dz / len, w * (1 + 1.5 * Math.exp(-Math.max(0, my) / 150))]) // la parte baja lleva más corriente
    }
  }
  const trunk = wander([gx, 0, gz], [gx + (rng() - 0.5) * 200, top, gz + (rng() - 0.5) * 200], step, rng, 0.08, [])
  push(trunk, 1)
  const nb = 4 + Math.floor(rng() * 6)
  for (let i = 0; i < nb; i++) { // ramas: nacen del tronco, más a menudo arriba
    const s = trunk[Math.min(trunk.length - 1, Math.floor(Math.pow(rng(), 0.7) * trunk.length))], az = rng() * TAU
    const len = 80 + rng() * 620, dy = -0.35 + rng() * 0.5, h = Math.sqrt(Math.max(0.05, 1 - dy * dy))
    const e = [s[0] + Math.sin(az) * h * len, Math.max(5, s[1] + dy * len), s[2] - Math.cos(az) * h * len]
    push(wander(s, e, step, rng, 0.12, []), 0.45, D * 0.95)
  }
  const nl = rng() < 0.85 ? 1 + Math.floor(rng() * 3) : 0
  for (let i = 0; i < nl; i++) { // tramos horizontales dentro de la nube: el estruendo largo
    const s = trunk[trunk.length - 1 - Math.floor(rng() * Math.min(6, trunk.length))], az = rng() * TAU, len = (800 + rng() * 4200) * (0.5 + 0.5 * clamp(thick / 1500, 0.3, 1.5))
    push(wander(s, [s[0] + Math.sin(az) * len, s[1] + (rng() - 0.5) * 200, s[2] - Math.cos(az) * len], Math.max(step, 14), rng, 0.1, []), 0.55, D * 0.95)
  }
  return segs
}

// ---------- filtros y mezcla ----------
const onePole = (x, fc, sr) => { const a = 1 - Math.exp((-TAU * fc) / sr); let y = 0; for (let i = 0; i < x.length; i++) { y += a * (x[i] - y); x[i] = y } return x }
const lowpass = (x, fc, sr, order = 2) => { if (fc >= sr * 0.45) return x; for (let k = 0; k < order; k++) onePole(x, fc, sr); return x }
function highpass(x, fc, sr) { const a = Math.exp((-TAU * fc) / sr); let px = 0, py = 0; for (let i = 0; i < x.length; i++) { const v = a * (py + x[i] - px); px = x[i]; x[i] = v; py = v } return x }
const rms = (x, n) => { let s = 0; for (let i = 0; i < n; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, n)) }

/** Reverberación de Schroeder (4 peines con amortiguación + 2 pasos de todo). `skew` descorrela los dos oídos. */
function reverb(x, sr, rt60, skew) {
  const out = new Float32Array(x.length)
  for (const d0 of [0.0297, 0.0371, 0.0411, 0.0437]) {
    const d = Math.max(1, Math.round(d0 * skew * sr)), g = Math.pow(10, (-3 * d0 * skew) / Math.max(0.1, rt60)), buf = new Float32Array(d)
    let lp = 0, p = 0
    for (let i = 0; i < x.length; i++) { const y = buf[p]; lp = lp * 0.35 + y * 0.65; buf[p] = x[i] + g * lp; p = (p + 1) % d; out[i] += y * 0.25 }
  }
  for (const [d0, g] of [[0.005, 0.7], [0.0017, 0.7]]) {
    const d = Math.max(1, Math.round(d0 * skew * sr)), buf = new Float32Array(d); let p = 0
    for (let i = 0; i < x.length; i++) { const v = buf[p], y = -g * out[i] + v; buf[p] = out[i] + g * y; p = (p + 1) % d; out[i] = y }
  }
  return out
}

/**
 * Sintetiza un trueno estéreo.
 * `o` = { distance (m, hasta la base del rayo), bearing (°), yaw (rad: hacia dónde mira el oyente, 0 = norte), seed, peakKA, region (preset),
 *         cloudBase, thickness, sampleRate (22050), earHeight }
 * → { left, right, sampleRate, preroll (s de silencio inicial: empezar a oír desde ahí), duration, level (0–1), stats }
 * El instante 0 (tras `preroll`) es la llegada del sonido más cercano del canal = distancia / 343 después del relámpago.
 */
export function synthThunder(o = {}) {
  const sr = Math.round(clamp(o.sampleRate || 22050, 8000, 48000))
  const D = clamp(+o.distance || 1200, 30, 12000), P = o.region || ACOUSTIC_PRESETS.open, rng = mulberry32((o.seed >>> 0) || 1)
  const yaw = +o.yaw || 0, peakK = clamp(Math.pow((+o.peakKA || 30) / 30, 0.35), 0.6, 1.4)
  const segs = thunderChannel(rng, { distance: D, bearing: o.bearing, cloudBase: o.cloudBase, thickness: o.thickness, earHeight: o.earHeight })
  // distancias, llegadas y reparto estéreo
  let rMin = Infinity, rMax = 0
  const rr = new Float32Array(segs.length)
  segs.forEach((s, i) => { const r = Math.max(8, Math.hypot(s[0], s[1], s[2])); rr[i] = r; if (r < rMin) rMin = r; if (r > rMax) rMax = r })
  const MAXARR = 15, PRE = 0.02, spread = Math.min(MAXARR, (rMax - rMin) / SPEED_OF_SOUND)
  const echoMax = P.echoes ? P.span[1] : 0, tail = clamp(P.rt60 * 0.9 + echoMax * 0.6, 0.4, 7)
  const total = Math.min(22, PRE + spread + 0.4 + tail), N = Math.ceil(total * sr)
  const L = new Float32Array(N), R = new Float32Array(N)
  const ENV = 100, bins = Math.ceil(total * ENV) + 4, eL = new Float32Array(bins), eR = new Float32Array(bins)
  const cr = P.crack
  let used = 0
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i], r = rr[i], t = (r - rMin) / SPEED_OF_SOUND
    if (t > MAXARR) continue
    // directividad: la onda sale perpendicular al segmento
    const cosT = (s[4] * s[0] + s[5] * s[1] + s[6] * s[2]) / r, dirw = 0.25 + 0.75 * Math.sqrt(Math.max(0, 1 - cosT * cosT))
    const a = (rng() < 0.5 ? -1 : 1) * Math.sqrt(s[3] * s[7]) * dirw * (1 / Math.max(r, 20)) * cr * peakK * 1000
    const az = Math.atan2(s[0], -s[2]) - yaw, el = Math.asin(clamp(s[1] / r, -1, 1)), pan = 0.5 * Math.sin(az) * Math.cos(el), th = ((pan + 1) * Math.PI) / 4 // medio panorama: el trueno es difuso y llega a los dos oídos
    const gL = Math.cos(th), gR = Math.sin(th)
    const sig = Math.max(8e-5, 6e-6 * Math.pow(r, 0.6)), half = Math.ceil(4 * sig * sr), c = (PRE + t) * sr, i0 = Math.round(c)
    for (let k = -half; k <= half; k++) {
      const n = i0 + k; if (n < 0 || n >= N) continue
      const x = k / sr / sig, v = x * Math.exp(0.5 - 0.5 * x * x) * a // ondícula N: derivada de gaussiana, pico = 1
      L[n] += v * gL; R[n] += v * gR
    }
    const b = Math.round((PRE + t) * ENV); eL[b] += a * a * gL * gL; eR[b] += a * a * gR * gR
    used++
  }
  // aire: los agudos mueren con la distancia; la zona recorta más
  const airFc = clamp(12000 / (1 + D / 400), 250, 12000)
  for (const ch of [L, R]) { lowpass(ch, airFc, sr, 2); lowpass(ch, P.hf, sr, 2) }
  // cuerpo grave: ruido paso bajo con la envolvente de energía que llega en cada instante
  const bodyFc = clamp(180 / Math.sqrt(1 + D / 2500), 45, 180), win = 0.08 + 0.00006 * D
  const smoothEnv = (e) => { // causal: el estruendo sube cuando llega la energía y se apaga con constante `win` (nada suena antes de la primera llegada)
    const sb = Math.max(1, win * ENV), dec = Math.exp(-1 / sb), out = new Float32Array(bins); let acc = 0
    for (let i = 0; i < bins; i++) { acc = acc * dec + e[i]; out[i] = acc / sb }
    return out
  }
  const aL = smoothEnv(eL), aR = smoothEnv(eR)
  const common = new Float32Array(N), nl = new Float32Array(N), nr = new Float32Array(N)
  for (let i = 0; i < N; i++) { common[i] = rng() * 2 - 1; nl[i] = rng() * 2 - 1; nr[i] = rng() * 2 - 1 }
  for (let i = 0; i < N; i++) { nl[i] = 0.7 * common[i] + 0.7 * nl[i]; nr[i] = 0.7 * common[i] + 0.7 * nr[i] }
  const bodyOf = (n, a) => {
    highpass(lowpass(n, bodyFc, sr, 4), 25, sr)
    const rn = rms(n, N) || 1
    for (let i = 0; i < N; i++) { const f = (i / sr) * ENV, b = Math.min(bins - 2, Math.floor(f)), env = Math.sqrt(lerp(a[b], a[b + 1], f - b)); n[i] = (n[i] / rn) * env }
    return n
  }
  const BL = bodyOf(nl, aL), BR = bodyOf(nr, aR)
  const nCut = Math.min(N, Math.round((PRE + spread + 0.4) * sr))
  const mix = lerp(0.55, 1.4, smooth(300, 4000, D)) * P.body
  const kb = (mix * (rms(L, nCut) + rms(R, nCut))) / Math.max(1e-9, rms(BL, nCut) + rms(BR, nCut))
  for (let i = 0; i < N; i++) { L[i] += BL[i] * kb; R[i] += BR[i] * kb }
  // zona: ecos discretos y reverberación
  let outL = L, outR = R
  if (P.echoes > 0) {
    const eL2 = new Float32Array(N), eR2 = new Float32Array(N)
    const sL = lowpass(Float32Array.from(L), 1500, sr, 1), sR = lowpass(Float32Array.from(R), 1500, sr, 1)
    for (let k = 0; k < P.echoes; k++) {
      const tau = lerp(P.span[0], P.span[1], (k + rng() * 0.8) / P.echoes), g = 0.5 * Math.exp(-tau / (0.7 * P.rt60)) * (0.6 + 0.4 * rng()), d = Math.round(tau * sr), side = k % 2 ? 1 : -1
      const gl = side < 0 ? 1 : 0.4, gr = side < 0 ? 0.4 : 1
      for (let i = d; i < N; i++) { eL2[i] += sL[i - d] * g * gl; eR2[i] += sR[i - d] * g * gr }
    }
    outL = L.map((v, i) => v + eL2[i]); outR = R.map((v, i) => v + eR2[i])
  }
  const wl = reverb(outL, sr, P.rt60, 1), wr = reverb(outR, sr, P.rt60, 1.13)
  for (let i = 0; i < N; i++) { outL[i] += wl[i] * P.reverb * 2.2; outR[i] += wr[i] * P.reverb * 2.2 }
  // limitador suave: rms ≈ 0,2 y tanh (el crujido tiene picos altísimos frente al cuerpo; sin esto sonaría bajísimo), cola suave y nivel por distancia
  const act = Math.min(N, Math.round((PRE + spread + 0.4 + tail * 0.5) * sr))
  const g = 0.2 / Math.max(1e-9, Math.sqrt((rms(outL, act) ** 2 + rms(outR, act) ** 2) / 2))
  const fade = Math.round(0.6 * sr), level = Math.min(1, (0.25 + 0.75 / (1 + (D / 1500) ** 1.5)) * lerp(0.9, 1.1, (peakK - 0.6) / 0.8))
  for (let i = 0; i < N; i++) { const f = i > N - fade ? 0.5 + 0.5 * Math.cos(((i - (N - fade)) / fade) * Math.PI) : 1; outL[i] = Math.tanh(outL[i] * g) * f; outR[i] = Math.tanh(outR[i] * g) * f }
  return { left: outL, right: outR, sampleRate: sr, preroll: PRE, duration: total, level, stats: { segments: segs.length, used, rMin, rMax, spread, airFc, bodyFc, tail } }
}
