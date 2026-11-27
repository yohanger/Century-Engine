// Century · pista física nativa. Un bake es datos muestreados, NO una segunda simulación.
// Sin Three.js ni Jolt: el Player, el editor de Timeline y la importación usan el mismo contrato.
const finite = Number.isFinite
const vec = (v, n, label) => {
  if (!Array.isArray(v) || v.length !== n || !v.every(x => typeof x === 'number' && finite(x))) throw new Error(`Timeline físico: ${label} inválido`)
  return [...v]
}
const MAX_STEPS = 60 * 30

/** Valida al importar o normalizar: evita buffers enormes, NaN, quaternions nulos y referencias por nombre. */
export function normalizeBakeTrack(tr) {
  const start = tr?.start, duration = tr?.duration, hz = tr?.hz
  if (typeof tr?.node !== 'string' || !tr.node.trim()) throw new Error('Timeline físico: falta ID del nodo')
  if (!finite(start) || start < 0 || !finite(duration) || duration <= 0 || duration > 30 || hz !== 60) throw new Error('Timeline físico: intervalo o frecuencia inválidos')
  const count = Math.round(duration * hz) + 1
  if (count < 2 || count > MAX_STEPS + 1 || Math.abs((count - 1) / hz - duration) > 1e-5) throw new Error('Timeline físico: muestras desalineadas')
  if (!Array.isArray(tr.samples) || tr.samples.length !== count) throw new Error('Timeline físico: tamaño de muestras inválido')
  const samples = tr.samples.map(s => {
    const pos = vec(s?.pos, 3, 'posición'), quat = vec(s?.quat, 4, 'quaternion')
    const norm = Math.hypot(...quat)
    if (norm < 1e-8) throw new Error('Timeline físico: quaternion degenerado')
    return { pos, quat: quat.map(x => x / norm) }
  })
  return { node: tr.node, start, duration, hz, samples }
}

/** SLERP con hemisferio corto, sin convertir a Euler ni generar saltos de vuelta completa. */
export function slerpQuat(a, b, t) {
  let dot = a.reduce((s, x, i) => s + x * b[i], 0)
  let bb = b
  if (dot < 0) { dot = -dot; bb = b.map(x => -x) }
  dot = Math.min(1, Math.max(-1, dot))
  let wa = 1 - t, wb = t
  if (dot < 0.9995) {
    const theta = Math.acos(dot), sin = Math.sin(theta)
    wa = Math.sin((1 - t) * theta) / sin; wb = Math.sin(t * theta) / sin
  }
  const q = a.map((v, i) => wa * v + wb * bb[i])
  const n = Math.hypot(...q)
  return q.map(v => v / n)
}

/** undefined antes de empezar, última pose fija después del intervalo. */
export function sampleBakeTrack(track, time) {
  if (!track || !finite(time) || time < track.start || !track.samples?.length) return undefined
  const u = Math.min(track.duration, time - track.start) * track.hz
  const i = Math.min(Math.floor(u), track.samples.length - 1)
  const j = Math.min(i + 1, track.samples.length - 1)
  const t = Math.min(1, Math.max(0, u - i))
  const a = track.samples[i], b = track.samples[j]
  return { pos: a.pos.map((v, n) => v + (b.pos[n] - v) * t), quat: slerpQuat(a.quat, b.quat, t) }
}
