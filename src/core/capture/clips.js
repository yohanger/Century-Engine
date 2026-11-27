// Capturas guardadas en el proyecto (project.captures): clips de huesos ya retargeteados a un modelo concreto.
//   { id, name, modelId, fps, duration, tracks:[{ bone, times:[], values:[x,y,z,w,…] }], from:{ capture, take } }
const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d)
export function normalizeCaptureClip(c) {
  const tracks = (Array.isArray(c?.tracks) ? c.tracks : []).map((t) => {
    const times = (Array.isArray(t?.times) ? t.times : []).map((v) => num(v))
    const values = (Array.isArray(t?.values) ? t.values : []).map((v) => num(v)).slice(0, times.length * 4)
    return { bone: String(t?.bone || ''), times: times.slice(0, values.length / 4), values }
  }).filter((t) => t.bone && t.times.length)
  return {
    id: String(c?.id || 'cc' + Math.random().toString(36).slice(2, 9)), name: String(c?.name || 'Captura'), modelId: String(c?.modelId || ''),
    fps: Math.max(1, num(c?.fps, 30)), duration: Math.max(0, num(c?.duration, Math.max(0, ...tracks.map((t) => t.times.at(-1) ?? 0)))),
    tracks, from: { capture: String(c?.from?.capture || ''), take: num(c?.from?.take) },
  }
}
export const normalizeCaptureClips = (l) => (Array.isArray(l) ? l.map(normalizeCaptureClip).filter((c) => c.modelId) : [])
