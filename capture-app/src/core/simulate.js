// Poses humanas sintéticas con la misma forma que el detector (33 puntos). Sirven para las pruebas y para el modo «simulado» de la app
// (probar sin cámara). Se generan en el espacio del sujeto (+Y arriba, mira −Z, derecha +X) y se pasan a una convención «cruda» arbitraria.
import { newCapture, J, NJ } from './format.js'
import { norm, add, mul, qFromEulerYXZ, qRot, r4 } from './math.js'

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

/** Ángulos de la pose (grados): abducción de brazos (0 abajo · 90 lateral · 180 arriba), flexión de codos, balanceo de cadera de las piernas, flexión de rodillas, giro del cuerpo. */
export function poseAt(t, turnAmp = 25) {
  return {
    armL: 20 + 15 * Math.sin(t * 2), armR: 100 + 60 * Math.sin(t * 3), elbowL: 20, elbowR: 40 + 30 * Math.sin(t * 3 + 1),
    legL: 15 * Math.sin(t * 2), legR: -15 * Math.sin(t * 2), kneeL: 10 + 10 * Math.max(0, Math.sin(t * 2)), kneeR: 10 + 10 * Math.max(0, -Math.sin(t * 2)),
    turn: turnAmp * Math.sin(t * 0.8),
  }
}
/** Puntos del sujeto para unos ángulos. Devuelve un array de 33 vectores [x,y,z] en metros. */
export function subjectPoints(a) {
  const d = Math.PI / 180, P = new Array(NJ).fill(0).map(() => [0, 0, 0])
  const set = (i, v) => { P[i] = v }
  const lhip = [-0.1, 0, 0], rhip = [0.1, 0, 0], lsh = [-0.2, 0.5, 0], rsh = [0.2, 0.5, 0]
  set(J.leftHip, lhip); set(J.rightHip, rhip); set(J.leftShoulder, lsh); set(J.rightShoulder, rsh)
  set(J.nose, [0, 0.66, -0.1]); set(J.leftEar, [-0.08, 0.68, 0]); set(J.rightEar, [0.08, 0.68, 0])
  set(J.leftEyeInner, [-0.02, 0.69, -0.08]); set(J.leftEye, [-0.04, 0.69, -0.08]); set(J.leftEyeOuter, [-0.06, 0.69, -0.07])
  set(J.rightEyeInner, [0.02, 0.69, -0.08]); set(J.rightEye, [0.04, 0.69, -0.08]); set(J.rightEyeOuter, [0.06, 0.69, -0.07])
  set(J.mouthLeft, [-0.03, 0.62, -0.08]); set(J.mouthRight, [0.03, 0.62, -0.08])
  const arm = (side, sh, ab, el, ids) => {
    const s = side === 'L' ? -1 : 1
    const up = [s * Math.sin(ab * d), -Math.cos(ab * d), 0], fw = [0, 0, -1]
    const elbow = add(sh, mul(up, 0.3))
    const fdir = norm(add(mul(up, Math.cos(el * d)), mul(fw, Math.sin(el * d))))
    const wrist = add(elbow, mul(fdir, 0.27))
    set(ids.elbow, elbow); set(ids.wrist, wrist)
    set(ids.pinky, add(wrist, add(mul(fdir, 0.07), [s * 0.01, 0, 0.015])))
    set(ids.index, add(wrist, add(mul(fdir, 0.08), [s * 0.01, 0, -0.015])))
    set(ids.thumb, add(wrist, add(mul(fdir, 0.05), [-s * 0.01, 0, -0.03])))
  }
  arm('L', lsh, a.armL, a.elbowL, { elbow: J.leftElbow, wrist: J.leftWrist, pinky: J.leftPinky, index: J.leftIndex, thumb: J.leftThumb })
  arm('R', rsh, a.armR, a.elbowR, { elbow: J.rightElbow, wrist: J.rightWrist, pinky: J.rightPinky, index: J.rightIndex, thumb: J.rightThumb })
  const leg = (hip, sw, kn, ids) => {
    const s1 = sw * d, s2 = (sw - kn) * d
    const knee = add(hip, [0, -0.42 * Math.cos(s1), -0.42 * Math.sin(s1)])
    const ankle = add(knee, [0, -0.4 * Math.cos(s2), -0.4 * Math.sin(s2)])
    set(ids.knee, knee); set(ids.ankle, ankle)
    set(ids.heel, add(ankle, [0, -0.05, 0.05])); set(ids.foot, add(ankle, [0, -0.06, -0.15]))
  }
  leg(lhip, a.legL, a.kneeL, { knee: J.leftKnee, ankle: J.leftAnkle, heel: J.leftHeel, foot: J.leftFootIndex })
  leg(rhip, a.legR, a.kneeR, { knee: J.rightKnee, ankle: J.rightAnkle, heel: J.rightHeel, foot: J.rightFootIndex })
  // giro del cuerpo entero alrededor de Y
  const q = qFromEulerYXZ(0, a.turn, 0)
  return P.map((v) => qRot(q, v))
}
/** Convenciones «crudas» de ejes del detector, para comprobar que la calibración las absorbe (una de ellas está espejada). */
export const RAW = {
  canonical: (v) => v,
  mediapipe: (v) => [-v[0], -v[1], v[2]],            // x a la izquierda, y hacia abajo (giro de 180° sobre Z)
  rotated: (v) => [v[2], v[1], -v[0]],               // sujeto girado 90°
  mirrored: (v) => [v[0], -v[1], v[2]],              // espejo
}
/** Una captura simulada: `seconds` de movimiento a `fps`, con ruido determinista y la cámara dando media vuelta alrededor. */
export function simulateCapture({ seconds = 4, fps = 30, raw = 'mediapipe', jitter = 0.004, seed = 7, name = 'Captura simulada', turnAmp = 25 } = {}) {
  const rnd = rng(seed), conv = RAW[raw] || RAW.mediapipe
  const cap = newCapture(name, { source: 'simulated' })
  const n = Math.round(seconds * fps)
  for (let i = 0; i <= n; i++) {
    const t = i / fps, pts = subjectPoints(poseAt(t, turnAmp))
    const p = []
    for (let j = 0; j < NJ; j++) { const v = conv(pts[j]); p.push(r4(v[0] + (rnd() - 0.5) * jitter), r4(v[1] + (rnd() - 0.5) * jitter), r4(v[2] + (rnd() - 0.5) * jitter), 0.99) }
    cap.body.frames.push({ t: r4(t), p })
    if (i % 5 === 0) cap.camera.keys.push({ t: r4(t), mode: 'free', pos: [Math.sin(t * 0.5) * 3, 1.6, Math.cos(t * 0.5) * 3], rot: [-5, 20 + t * 15, 0], fov: 60 })
  }
  return cap
}
