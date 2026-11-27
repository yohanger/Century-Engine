// Formato .lfcap (captura de movimiento de Century Capture). JSON de texto, sin binarios.
//
//  { format:'lfcap', version:1, id, name, created, fps,
//    body:   { space:'mediapipe-world', frames:[{ t, p:[x,y,z,vis × 33] }] }      ← landmarks tal como salen del detector (sin esqueleto de ningún modelo)
//      (opcional) frames[i].c = [pulgar, índice, medio, anular, meñique] de la mano izquierda y luego de la derecha: cierre 0–1, −1 = no se vio
//    camera: { keys:[{ t, pos:[x,y,z], rot:[pitch,yaw,roll]°, fov }] }           ← cámara virtual (orientación del móvil + claves de posición/zoom)
//    edits:  { trim:[inicio,fin]|null, cuts:[t…], speed, smooth, mirror }        ← edición no destructiva (se aplica al importar: bake)
//    layers: [{ id, kind:'text'|'fade'|'letterbox'|'shake', t0, t1, params }] }  ← efectos y capas
//
// El cuerpo se guarda SIN retargeting: Century lo aplica a los huesos del modelo que elijas al importar.
export const FORMAT = 'lfcap'
export const VERSION = 1

// Los 33 puntos de MediaPipe Pose, en orden.
export const JOINTS = [
  'nose', 'leftEyeInner', 'leftEye', 'leftEyeOuter', 'rightEyeInner', 'rightEye', 'rightEyeOuter', 'leftEar', 'rightEar', 'mouthLeft', 'mouthRight',
  'leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow', 'leftWrist', 'rightWrist', 'leftPinky', 'rightPinky', 'leftIndex', 'rightIndex', 'leftThumb', 'rightThumb',
  'leftHip', 'rightHip', 'leftKnee', 'rightKnee', 'leftAnkle', 'rightAnkle', 'leftHeel', 'rightHeel', 'leftFootIndex', 'rightFootIndex',
]
export const J = Object.fromEntries(JOINTS.map((n, i) => [n, i]))
export const NJ = JOINTS.length
/** Segmentos del muñeco de palitos (la app los dibuja). */
export const STICKS = [
  ['leftShoulder', 'rightShoulder'], ['leftShoulder', 'leftElbow'], ['leftElbow', 'leftWrist'], ['rightShoulder', 'rightElbow'], ['rightElbow', 'rightWrist'],
  ['leftShoulder', 'leftHip'], ['rightShoulder', 'rightHip'], ['leftHip', 'rightHip'], ['leftHip', 'leftKnee'], ['leftKnee', 'leftAnkle'], ['rightHip', 'rightKnee'], ['rightKnee', 'rightAnkle'],
  ['leftAnkle', 'leftFootIndex'], ['rightAnkle', 'rightFootIndex'], ['leftEar', 'rightEar'], ['leftWrist', 'leftIndex'], ['rightWrist', 'rightIndex'],
]
export const LAYER_KINDS = {
  text: { label: 'Texto', params: { text: 'Texto', pos: 'bottom' } },
  fade: { label: 'Fundido', params: { dir: 'out', color: '#000000' } },
  letterbox: { label: 'Barras de cine', params: { percent: 12 } },
  shake: { label: 'Temblor de cámara', params: { amount: 1.2 } },
}

const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d)
const uid = (p) => p + Math.random().toString(36).slice(2, 9)

export function newCapture(name = 'Captura', extra = {}) {
  return {
    format: FORMAT, version: VERSION, id: uid('cap_'), name, created: new Date().toISOString(), fps: 30,
    body: { space: 'mediapipe-world', frames: [] },
    camera: { keys: [] },
    edits: { trim: null, cuts: [], speed: 1, smooth: 0.35, mirror: false },
    layers: [],
    ...extra,
  }
}
export const newLayer = (kind, t0, t1, params = {}) => ({ id: uid('ly_'), kind, t0: Math.max(0, num(t0)), t1: Math.max(num(t0), num(t1, t0 + 2)), params: { ...LAYER_KINDS[kind].params, ...params } })
export const duration = (cap) => Math.max(0, cap.body.frames.at(-1)?.t ?? 0, cap.camera.keys.at(-1)?.t ?? 0)

export function normalizeCapture(c) {
  if (!c || c.format !== FORMAT) throw new Error('No es un archivo .lfcap')
  if (num(c.version) > VERSION) throw new Error(`Captura de una versión más nueva (${c.version}); actualiza Century`)
  const o = newCapture(String(c.name || 'Captura'), { id: c.id || uid('cap_'), created: c.created || new Date().toISOString() })
  o.fps = Math.min(120, Math.max(1, num(c.fps, 30)))
  o.body = { space: 'mediapipe-world', frames: (c.body?.frames || []).filter((f) => Array.isArray(f.p) && f.p.length >= NJ * 4).map((f) => { const o = { t: Math.max(0, num(f.t)), p: f.p.slice(0, NJ * 4).map((v) => num(v)) }; if (Array.isArray(f.c) && f.c.length === 10) o.c = f.c.map((v) => (Number.isFinite(+v) ? Math.min(1, Math.max(-1, +v)) : -1)); return o }).sort((a, b) => a.t - b.t) }
  o.camera = { keys: (c.camera?.keys || []).map((k) => ({ t: Math.max(0, num(k.t)), pos: [0, 1, 2].map((i) => num(k.pos?.[i])), rot: [0, 1, 2].map((i) => num(k.rot?.[i])), fov: Math.min(170, Math.max(5, num(k.fov, 60))) })).sort((a, b) => a.t - b.t) }
  const e = c.edits || {}
  const d = duration(o)
  const trim = Array.isArray(e.trim) && e.trim.length === 2 ? [Math.max(0, num(e.trim[0])), Math.min(d || Infinity, num(e.trim[1], d))] : null
  o.edits = {
    trim: trim && trim[1] > trim[0] ? trim : null,
    cuts: (Array.isArray(e.cuts) ? e.cuts : []).map((t) => num(t)).filter((t) => t > 0).sort((a, b) => a - b).filter((t, i, a) => i === 0 || t - a[i - 1] > 0.05),
    speed: Math.min(8, Math.max(0.1, num(e.speed, 1))), smooth: Math.min(1, Math.max(0, num(e.smooth, 0.35))), mirror: !!e.mirror,
  }
  o.layers = (c.layers || []).filter((l) => LAYER_KINDS[l?.kind]).map((l) => ({ id: l.id || uid('ly_'), kind: l.kind, t0: Math.max(0, num(l.t0)), t1: Math.max(num(l.t0), num(l.t1, l.t0)), params: { ...LAYER_KINDS[l.kind].params, ...(l.params || {}) } }))
  return o
}
export const serialize = (cap) => JSON.stringify(cap)
export function parse(text) {
  let j
  try { j = JSON.parse(text) } catch { throw new Error('El archivo no es un .lfcap válido (JSON roto)') }
  return normalizeCapture(j)
}
