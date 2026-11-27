// Proyección del actor (puntos canónicos de la captura) al «escenario» y a la pantalla: vistas frontal/lateral/cenital y la vista
// de la cámara virtual (misma convención que el Timeline de Century).
import { J, NJ } from '../core/format.js'
import { qRot, qInv, sub } from '../core/math.js'
import { cameraQuat } from '../core/camera.js'

/** Altura del suelo en el espacio canónico (el punto más bajo de los pies en los primeros fotogramas). */
export function floorOf(frames) {
  let m = Infinity
  for (const f of frames.slice(0, 45)) for (const j of [J.leftHeel, J.rightHeel, J.leftFootIndex, J.rightFootIndex, J.leftAnkle, J.rightAnkle]) m = Math.min(m, f.p[j * 4 + 1])
  return Number.isFinite(m) ? m : -1
}
/** Canónico (mira −Z) → escenario (el actor en el origen mirando +Z, hacia la cámara por defecto; suelo en y = 0). */
export function stagePoints(frame, floor) {
  const out = new Array(NJ)
  for (let i = 0; i < NJ; i++) out[i] = [-frame.p[i * 4], frame.p[i * 4 + 1] - floor, -frame.p[i * 4 + 2]]
  return out
}
/** Devuelve una función punto→[x,y] de pantalla (o null si queda detrás de la cámara). */
export function projector(view, w, h, camKey) {
  if (view === 'camera' && camKey) {
    const q = qInv(cameraQuat(camKey.rot)), f = (h / 2) / Math.tan(((camKey.fov || 60) * Math.PI) / 360)
    return (p) => {
      const r = qRot(q, sub(p, camKey.pos))
      if (r[2] > -0.05) return null
      return [w / 2 + (r[0] / -r[2]) * f, h / 2 - (r[1] / -r[2]) * f]
    }
  }
  const k = h / 2.4, cx = w / 2, cy = h * 0.92
  if (view === 'side') return (p) => [cx - p[2] * k, cy - p[1] * k]
  if (view === 'top') return (p) => [cx + p[0] * k, h / 2 + p[2] * k]
  return (p) => [cx + p[0] * k, cy - p[1] * k] // frontal: la cámara mira hacia −Z, el actor nos mira
}
