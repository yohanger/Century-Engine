// Matemática mínima (vectores y cuaterniones como arrays) para el núcleo de captura. Sin three ni DOM: la usa también la app móvil.
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k]
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
export const len = (a) => Math.hypot(a[0], a[1], a[2])
export const norm = (a) => { const l = len(a); return l > 1e-9 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0] }
export const lerp3 = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]
export const mid = (a, b) => mul(add(a, b), 0.5)

export const Q_ID = [0, 0, 0, 1]
export const qMul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
]
export const qInv = (q) => [-q[0], -q[1], -q[2], q[3]] // cuaternión unitario
export const qNorm = (q) => { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l] }
export function qRot(q, v) { // q · v · q⁻¹
  const t = mul(cross([q[0], q[1], q[2]], v), 2)
  return add(add(v, mul(t, q[3])), cross([q[0], q[1], q[2]], t))
}
/** Giro de arco mínimo que lleva el vector unitario a hacia b. */
export function qFromTo(a, b) {
  const d = dot(a, b)
  if (d > 0.999999) return [0, 0, 0, 1]
  if (d < -0.999999) { // opuestos: medio giro sobre cualquier eje perpendicular
    let ax = cross([1, 0, 0], a); if (len(ax) < 1e-6) ax = cross([0, 1, 0], a)
    ax = norm(ax); return [ax[0], ax[1], ax[2], 0]
  }
  const c = cross(a, b)
  return qNorm([c[0], c[1], c[2], 1 + d])
}
export function qSlerp(a, b, u) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]
  let bb = b
  if (d < 0) { d = -d; bb = [-b[0], -b[1], -b[2], -b[3]] }
  if (d > 0.9995) return qNorm([a[0] + (bb[0] - a[0]) * u, a[1] + (bb[1] - a[1]) * u, a[2] + (bb[2] - a[2]) * u, a[3] + (bb[3] - a[3]) * u])
  const th = Math.acos(Math.min(1, d)), s = Math.sin(th), w1 = Math.sin((1 - u) * th) / s, w2 = Math.sin(u * th) / s
  return [a[0] * w1 + bb[0] * w2, a[1] * w1 + bb[1] * w2, a[2] * w1 + bb[2] * w2, a[3] * w1 + bb[3] * w2]
}
/** Cuaternión de la base ortonormal cuyas columnas son x, y, z (determinante +1). */
export function qFromBasis(x, y, z) {
  const m00 = x[0], m01 = y[0], m02 = z[0], m10 = x[1], m11 = y[1], m12 = z[1], m20 = x[2], m21 = y[2], m22 = z[2]
  const tr = m00 + m11 + m22
  let q
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s] }
  else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; q = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s] }
  else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; q = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s] }
  else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; q = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s] }
  return qNorm(q)
}
/** Euler YXZ (grados, como las claves de cámara del Timeline) → cuaternión. */
export function qFromEulerYXZ(pitch, yaw, roll) {
  const d = Math.PI / 180, x = pitch * d, y = yaw * d, z = roll * d
  const c1 = Math.cos(x / 2), s1 = Math.sin(x / 2), c2 = Math.cos(y / 2), s2 = Math.sin(y / 2), c3 = Math.cos(z / 2), s3 = Math.sin(z / 2)
  return [s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 - s1 * s2 * c3, c1 * c2 * c3 + s1 * s2 * s3]
}
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
export const r4 = (v) => Math.round(v * 1e4) / 1e4
