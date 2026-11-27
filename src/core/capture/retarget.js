// Retargeting: de los puntos del cuerpo (espacio canónico) a rotaciones de los huesos de CUALQUIER modelo humanoide.
// Para cada hueso con un hijo se gira su dirección de reposo hasta la dirección observada (rotación de «oscilación», sin torsión).
import { sub, norm, mid, cross, qFromTo, qFromBasis, qMul, qInv, Q_ID, r4 } from './math.js'
import { J } from './format.js'

/** Descripción mínima del esqueleto: bones:[{ name, parent (índice o −1), pos:[x,y,z] mundo en reposo, quat:[x,y,z,w] mundo en reposo }] */

const strip = (n) => n.replace(/^.*[|]/, '').replace(/^mixamorig:?/i, '').replace(/^(bip\d*|b)[_.\s-]/i, '')
export function sideOf(name) {
  const n = strip(name)
  if (/left/i.test(n)) return 'L'
  if (/right/i.test(n)) return 'R'
  if (/(^|[_.\-\s])l($|[_.\-\s])/i.test(n)) return 'L'
  if (/(^|[_.\-\s])r($|[_.\-\s])/i.test(n)) return 'R'
  if (/[a-z0-9]L$/.test(n)) return 'L'
  if (/[a-z0-9]R$/.test(n)) return 'R'
  return ''
}
const coreOf = (name) => strip(name).replace(/left|right/gi, '').replace(/([a-z0-9])[LR]$/, '$1').replace(/(^|[_.\-\s])[lr](?=$|[_.\-\s])/gi, '$1').toLowerCase().replace(/[^a-z0-9]/g, '')
const PARTS = [
  ['hips', /^(hips|pelvis|hip|roothips)$/], ['spine', /^spine\d?$/], ['chest', /^(chest|upperchest|spine[12])$/], ['neck', /^neck\d?$/], ['head', /^head$/],
  ['upperArm', /^(upperarm|arm|uparm|upperarm\d)$/], ['lowerArm', /^(forearm|lowerarm|elbow)$/], ['hand', /^(hand|wrist)$/],
  ['upperLeg', /^(upleg|thigh|upperleg|upleg\d)$/], ['lowerLeg', /^(leg|lowerleg|calf|shin)$/], ['foot', /^(foot|ankle)$/], ['toe', /^(toebase|toe|toes|ball)$/],
]
/** Busca los huesos de un humanoide por nombre (Mixamo, Unreal, Blender, Rigify básico…). Devuelve { hips, spine, neck, head, L:{upperArm…}, R:{…} }. */
export function findHumanoid(bones) {
  const out = { L: {}, R: {} }
  bones.forEach((b, i) => {
    const core = coreOf(b.name), side = sideOf(b.name)
    for (const [role, re] of PARTS) {
      if (!re.test(core)) continue
      const limb = /Arm|Leg|hand|foot|toe/.test(role)
      if (limb) { if (side && out[side][role] === undefined) out[side][role] = i } else if (out[role] === undefined) out[role] = i
      break
    }
  })
  return out
}
export function humanoidReport(map) {
  const need = ['hips', 'spine']; const limb = ['upperArm', 'lowerArm', 'upperLeg', 'lowerLeg']
  const missing = need.filter((k) => map[k] === undefined)
  for (const s of ['L', 'R']) for (const k of limb) if (map[s][k] === undefined) missing.push(`${s}.${k}`)
  return { ok: !missing.length, missing }
}

const P = (f, i) => [f.p[i * 4], f.p[i * 4 + 1], f.p[i * 4 + 2]]
// canónico (mira −Z, derecha +X) → espacio del modelo: por defecto mira +Z (glTF, Mixamo…); facing '-Z' para modelos que miran a −Z
const TO_MODEL = { '+Z': (v) => [-v[0], v[1], -v[2]], '-Z': (v) => v }

/**
 * Calcula las pistas de rotación de los huesos mapeados.
 * @returns { tracks:[{ bone, times:[], values:[x,y,z,w,…] (rotación LOCAL) }], map }
 */
export function retarget(frames, skeleton, { map, facing = '+Z' } = {}) {
  const toModel = TO_MODEL[facing] || TO_MODEL['+Z']
  const bones = skeleton.bones
  map = map || findHumanoid(bones)
  const rootQ = skeleton.rootQuat || Q_ID
  const wpos = bones.map((b) => b.pos), wq = bones.map((b) => b.quat)
  const kids = bones.map(() => [])
  bones.forEach((b, i) => { if (b.parent >= 0) kids[b.parent].push(i) })
  const restLocal = bones.map((b, i) => qMul(qInv(b.parent >= 0 ? wq[b.parent] : rootQ), wq[i]))
  const dirRest = (a, b) => norm(sub(wpos[b], wpos[a]))

  // Segmentos: hueso → (punto inicio, punto fin observados, dirección de reposo)
  const seg = []
  const add = (bone, a, b, rest) => { if (bone !== undefined && rest) seg.push({ bone, a, b, rest }) }
  const sideSeg = (s, S) => {
    const m = map[s], k = (n) => m[n]
    if (k('upperArm') !== undefined && k('lowerArm') !== undefined) add(k('upperArm'), S.shoulder, S.elbow, dirRest(k('upperArm'), k('lowerArm')))
    if (k('lowerArm') !== undefined && k('hand') !== undefined) add(k('lowerArm'), S.elbow, S.wrist, dirRest(k('lowerArm'), k('hand')))
    if (k('hand') !== undefined && k('lowerArm') !== undefined) add(k('hand'), S.wrist, S.hand, dirRest(k('lowerArm'), k('hand')))
    if (k('upperLeg') !== undefined && k('lowerLeg') !== undefined) add(k('upperLeg'), S.hip, S.knee, dirRest(k('upperLeg'), k('lowerLeg')))
    if (k('lowerLeg') !== undefined && k('foot') !== undefined) add(k('lowerLeg'), S.knee, S.ankle, dirRest(k('lowerLeg'), k('foot')))
    if (k('foot') !== undefined) add(k('foot'), S.ankle, S.toe, k('toe') !== undefined ? dirRest(k('foot'), k('toe')) : norm([0, -0.4, 1]))
  }
  const L = { shoulder: J.leftShoulder, elbow: J.leftElbow, wrist: J.leftWrist, hip: J.leftHip, knee: J.leftKnee, ankle: J.leftAnkle, toe: J.leftFootIndex }
  const R = { shoulder: J.rightShoulder, elbow: J.rightElbow, wrist: J.rightWrist, hip: J.rightHip, knee: J.rightKnee, ankle: J.rightAnkle, toe: J.rightFootIndex }
  sideSeg('L', { ...L, hand: -1 }); sideSeg('R', { ...R, hand: -1 })
  // las manos usan la media índice/meñique de cada lado: se resuelve al evaluar
  const handPts = { L: [J.leftIndex, J.leftPinky], R: [J.rightIndex, J.rightPinky] }
  const handBones = new Map(); if (map.L.hand !== undefined) handBones.set(map.L.hand, 'L'); if (map.R.hand !== undefined) handBones.set(map.R.hand, 'R')

  // Rest de la base de caderas (derecha, arriba) para el hueso raíz
  const hasHips = map.hips !== undefined && map.L.upperLeg !== undefined && map.R.upperLeg !== undefined
  let restHipsBasis = null
  const basisOf = (right, up) => { const x = norm(right); const y = norm(sub(up, x.map((v) => v * (up[0] * x[0] + up[1] * x[1] + up[2] * x[2])))); return qFromBasis(x, y, cross(x, y)) }
  if (hasHips) {
    const neckI = map.neck ?? map.head ?? map.spine
    restHipsBasis = basisOf(sub(wpos[map.L.upperLeg], wpos[map.R.upperLeg]), sub(wpos[neckI] ?? wpos[map.spine], wpos[map.hips]))
  }
  // Torso (hueso spine) y cuello
  const torsoTo = map.neck ?? map.head
  const spineRest = map.spine !== undefined && torsoTo !== undefined ? dirRest(map.spine, torsoTo) : null
  const neckRest = map.neck !== undefined && map.head !== undefined ? dirRest(map.neck, map.head) : null

  const order = bones.map((_, i) => i) // los padres van antes que los hijos (norma en glTF/three); si no, se reordena
  const depth = (i) => { let d = 0; while (bones[i].parent >= 0) { i = bones[i].parent; d++ } return d }
  order.sort((a, b) => depth(a) - depth(b))
  const segByBone = new Map(seg.map((s) => [s.bone, s]))
  const mapped = new Set([...segByBone.keys()])
  if (hasHips) mapped.add(map.hips)
  if (spineRest) mapped.add(map.spine)
  if (neckRest) mapped.add(map.neck)

  const tracks = new Map([...mapped].map((b) => [b, { bone: bones[b].name, times: [], values: [] }]))
  const prev = new Map()
  for (const f of frames) {
    const pt = (i) => toModel(P(f, i))
    const hipM = mid(pt(J.leftHip), pt(J.rightHip)), shM = mid(pt(J.leftShoulder), pt(J.rightShoulder)), earM = mid(pt(J.leftEar), pt(J.rightEar))
    const aw = new Array(bones.length) // rotación mundial animada
    for (const i of order) {
      const par = bones[i].parent
      const parentQ = par >= 0 ? aw[par] : rootQ
      let target = null
      if (i === map.hips && hasHips) {
        const obs = basisOf(sub(pt(J.leftHip), pt(J.rightHip)), sub(shM, hipM))
        target = qMul(qMul(obs, qInv(restHipsBasis)), wq[i])
      } else if (i === map.spine && spineRest) {
        target = qMul(qFromTo(spineRest, norm(sub(shM, hipM))), wq[i])
      } else if (i === map.neck && neckRest) {
        target = qMul(qFromTo(neckRest, norm(sub(earM, shM))), wq[i])
      } else if (segByBone.has(i)) {
        const s = segByBone.get(i)
        let end = s.b >= 0 ? pt(s.b) : null
        const side = handBones.get(i)
        if (side) end = mid(pt(handPts[side][0]), pt(handPts[side][1]))
        const d = norm(sub(end, pt(s.a)))
        target = qMul(qFromTo(s.rest, d), wq[i])
      }
      aw[i] = target || qMul(parentQ, restLocal[i])
      const tr = tracks.get(i)
      if (tr && target) {
        let local = qMul(qInv(parentQ), target)
        const pv = prev.get(i)
        if (pv && pv[0] * local[0] + pv[1] * local[1] + pv[2] * local[2] + pv[3] * local[3] < 0) local = local.map((v) => -v)
        prev.set(i, local)
        tr.times.push(f.t); tr.values.push(...local.map(r4))
      }
    }
  }
  return { tracks: [...tracks.values()].filter((t) => t.times.length), map }
}
