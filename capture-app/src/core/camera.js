// Cámara virtual: la orientación del móvil (sensores) se convierte en las rotaciones [pitch, yaw, roll] de las claves de cámara del Timeline.
import { qFromEulerYXZ, clamp, cross, dot, norm } from './math.js'

/**
 * Orientación de la cámara trasera a partir de los ángulos del sensor (W3C DeviceOrientation: alpha=Z, beta=X', gamma=Y'', grados;
 * mundo: X este, Y norte, Z arriba). Devuelve { pitch, yaw, roll } en grados con la convención de las claves de cámara:
 * pitch + mira arriba · yaw + gira a la izquierda (la brújula crece a la derecha, por eso yaw = −rumbo) · roll según la convención YXZ de las claves (comprobado en test-capture).
 */
export function deviceAxes(alpha, beta, gamma) {
  const d = Math.PI / 180, a = alpha * d, b = beta * d, g = gamma * d
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cg = Math.cos(g), sg = Math.sin(g)
  // R = Rz(alpha) · Rx(beta) · Ry(gamma): sus columnas son los ejes del dispositivo en el mundo
  const R = [
    [ca * cg - sa * sb * sg, -sa * cb, ca * sg + sa * sb * cg],
    [sa * cg + ca * sb * sg, ca * cb, sa * sg - ca * sb * cg],
    [-cb * sg, sb, cb * cg],
  ]
  const col = (j) => [R[0][j], R[1][j], R[2][j]]
  return { fwd: col(2).map((v) => -v), right: col(0) } // la cámara trasera mira por −Z del dispositivo
}
export function cameraFromDeviceAngles(alpha, beta, gamma) {
  const d = Math.PI / 180
  const { fwd, right } = deviceAxes(alpha, beta, gamma)
  const pitch = Math.asin(clamp(fwd[2], -1, 1)) / d
  const heading = Math.atan2(fwd[0], fwd[1]) / d
  // roll: giro de la «derecha» del móvil respecto a la derecha horizontal, alrededor del eje de visión
  const rightH = norm(cross(fwd, [0, 0, 1]))
  const upH = cross(rightH, fwd)
  const tilt = Math.atan2(dot(right, upH), dot(right, rightH)) / d // + = el lado derecho sube (giro antihorario) → roll negativo
  return { pitch, yaw: -heading, roll: tilt }
}
/** Resta el rumbo de referencia (la dirección en que empezó la toma) para que arranque en yaw 0. */
export function relativeTo(rot, ref) {
  const y = (((rot.yaw - ref.yaw) % 360) + 540) % 360 - 180
  return [rot.pitch, y, rot.roll]
}
export const cameraQuat = (rot) => qFromEulerYXZ(rot[0], rot[1], rot[2])
/** Zoom del móvil (1× = fov base) → campo de visión vertical en grados. */
export const fovFromZoom = (zoom, baseFov = 60) => 2 * Math.atan(Math.tan((baseFov * Math.PI) / 360) / Math.max(0.1, zoom)) * 180 / Math.PI
