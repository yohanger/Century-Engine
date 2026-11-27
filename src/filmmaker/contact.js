// Nether Film Maker · contacto con el entorno: el personaje no es un fantasma. Después del retarget, en cada fotograma:
//   · brazos y piernas: si un segmento (hombro→codo→muñeca→punta de la mano, cadera→rodilla→tobillo→punta del pie) atraviesa una
//     malla de la escena, la mano/el pie se queda en la superficie y el codo/la rodilla se recolocan con IK de dos huesos
//   · pies: nunca por debajo del suelo
//   · dedos: se cierran (por la mano capturada o por el «agarre» elegido) articulación a articulación y paran al tocar algo
//     (un volante, una barandilla…)
import * as THREE from 'three'
import { isCutter } from '../engine/runtime/geometry/csg.js'
import { sideOf } from '../core/capture/retarget.js'

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion()
const ray = new THREE.Raycaster()
const FINGERS = [['thumb', /thumb/i], ['index', /index|pointer/i], ['middle', /middle/i], ['ring', /ring/i], ['pinky', /pinky|little/i]]
export const FINGER_NAMES = FINGERS.map((f) => f[0])

/** Mallas de la escena contra las que choca el actor (lo que tiene colisión y se ve; nunca el propio actor ni los ayudantes). */
export function colliderMeshes(editor, project, excludeId) {
  const out = []
  for (const o of project.objects) {
    if (o.id === excludeId || o.collision === false || o.visible === false || isCutter(o) || !['primitive', 'mesh', 'model', 'road', 'text'].includes(o.type)) continue
    editor.nodes.get(o.id)?.traverse((m) => { if (m.isMesh && m.visible && m.geometry && !m.userData.helper && !m.userData.isHelper && !m.isInstancedMesh) out.push(m) })
  }
  return out
}

/** Rota un hueso en espacio del mundo (delta · rotación actual) conservando la jerarquía. */
export function rotateWorld(bone, delta) {
  bone.getWorldQuaternion(_q1)
  _q1.premultiply(delta)
  bone.parent.getWorldQuaternion(_q2)
  bone.quaternion.copy(_q2.invert().multiply(_q1))
  bone.updateMatrixWorld(true)
}
const wp = (o, v = new THREE.Vector3()) => o.getWorldPosition(v)

/**
 * IK analítica de dos huesos: mueve `upper` y `lower` para que `end` llegue a `target` (mundo), con el codo/la rodilla hacia
 * donde estaban (polo actual). Devuelve true si alcanzó el objetivo.
 */
export function twoBoneIK(upper, lower, end, target, hint = null) {
  const A = wp(upper), B = wp(lower), C = wp(end)
  const a = A.distanceTo(B), b = B.distanceTo(C)
  if (a < 1e-5 || b < 1e-5) return false
  const AT = target.clone().sub(A)
  const d = Math.min(a + b - 1e-4, Math.max(Math.abs(a - b) + 1e-4, AT.length()))
  const dir = AT.normalize()
  // polo: lo que el codo se aparta de la línea hombro→objetivo
  let pole = B.clone().sub(A); pole.sub(dir.clone().multiplyScalar(pole.dot(dir)))
  if (pole.lengthSq() < 1e-8) { // cadena recta: hacia dónde se dobla lo dice `hint` (rodilla adelante, codo atrás)
    const h = hint ? hint.clone() : (Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1))
    pole = h.sub(dir.clone().multiplyScalar(h.dot(dir)))
  }
  pole.normalize()
  const cosA = (a * a + d * d - b * b) / (2 * a * d), alpha = Math.acos(Math.max(-1, Math.min(1, cosA)))
  const B2 = A.clone().addScaledVector(dir, Math.cos(alpha) * a).addScaledVector(pole, Math.sin(alpha) * a)
  rotateWorld(upper, new THREE.Quaternion().setFromUnitVectors(B.clone().sub(A).normalize(), B2.clone().sub(A).normalize()))
  const B3 = wp(lower), C3 = wp(end)
  const T2 = A.clone().addScaledVector(dir, d)
  rotateWorld(lower, new THREE.Quaternion().setFromUnitVectors(C3.sub(B3).normalize(), T2.sub(B3).normalize()))
  return wp(end).distanceTo(target) < 1e-3
}

/** Primer choque de un segmento P→Q con las mallas (o null). */
function hitSegment(P, Q, meshes) {
  const dir = _v3.copy(Q).sub(P), len = dir.length()
  if (len < 1e-5 || !meshes.length) return null
  ray.set(P, dir.normalize()); ray.far = len; ray.near = 0
  const h = ray.intersectObjects(meshes, false)[0]
  return h ? { point: h.point.clone(), dist: h.distance, len, dir: dir.clone() } : null
}

/** Cadenas de dedos de un esqueleto three: { L: { index:[b1,b2,b3], … }, R: {…} } (de la base a la punta). */
export function fingerChains(root) {
  const out = { L: {}, R: {} }
  const bones = []; root.traverse((o) => { if (o.isBone) bones.push(o) })
  for (const [name, re] of FINGERS) for (const side of ['L', 'R']) {
    const list = bones.filter((b) => re.test(b.name) && sideOf(b.name) === side && !/end|tip|nub|_4$|4$/i.test(b.name.replace(/mixamorig:?/i, '')))
    const depth = (b) => { let d = 0, p = b; while (p.parent) { d++; p = p.parent } return d }
    list.sort((x, y) => depth(x) - depth(y))
    if (list.length) out[side][name] = list.slice(0, 3)
  }
  return out
}

export class ContactSolver {
  /**
   * @param o { editor, project, actor (objeto), names: { L:{ upperArm, lowerArm, hand, upperLeg, lowerLeg, foot, toe }, R:{…} } (nombres de huesos),
   *            radius (m, grosor de mano y dedos), meshes? }
   */
  constructor(o) {
    Object.assign(this, { radius: 0.03, feet: true, hands: true, fingers: true }, o)
    this.meshes = o.meshes || colliderMeshes(o.editor, o.project, o.actor.id)
    this._curlSign = new Map()
  }
  _root() { return this.editor.nodes.get(this.actor.id)?.userData?.modelRoot }
  _bones() {
    const root = this._root(); if (!root) return null
    if (root !== this._r) {
      this._r = root; this.byName = new Map(); root.traverse((b) => { if (b.isBone) this.byName.set(b.name, b) })
      this.chains = fingerChains(root); this._rest = new Map()
      for (const s of ['L', 'R']) for (const ch of Object.values(this.chains[s])) for (const b of ch) this._rest.set(b, b.quaternion.clone())
    }
    return this.byName
  }
  /**
   * Corrige la pose ACTUAL del modelo (ya retargeteada). `curls`: { L:[pulgar,índice,medio,anular,meñique] 0–1 | null, R:[…] | null }.
   * Devuelve un informe { hands:[lados con contacto], feet:[…], fingers:n de dedos que pararon }.
   */
  solve(curls = null) {
    const B = this._bones(); if (!B) return null
    const rep = { hands: [], feet: [], fingers: 0 }
    this._r.updateMatrixWorld(true)
    for (const s of ['L', 'R']) {
      const n = this.names[s] || {}
      const ua = B.get(n.upperArm), la = B.get(n.lowerArm), ha = B.get(n.hand)
      if (this.hands && ua && la && ha) if (this._limb(ua, la, ha, this._handTip(s, ha, la), 0.18)) rep.hands.push(s)
      const ul = B.get(n.upperLeg), ll = B.get(n.lowerLeg), ft = B.get(n.foot)
      if (this.feet && ul && ll && ft) if (this._limb(ul, ll, ft, n.toe ? B.get(n.toe) : null, 0.15, true)) rep.feet.push(s)
      if (this.fingers) rep.fingers += this._fingers(s, curls?.[s])
    }
    return rep
  }
  _handTip(s, hand) { const ch = this.chains?.[s]; const mid = ch?.middle || ch?.index; return mid ? mid[mid.length - 1] : null }
  /** Brazo o pierna: si la cadena atraviesa algo, el extremo se queda en la superficie. */
  _limb(upper, lower, end, tip, tipLen, foot = false) {
    const A = wp(upper), Bp = wp(lower), C = wp(end)
    const T = tip ? wp(tip) : C.clone().add(C.clone().sub(Bp).normalize().multiplyScalar(tipLen))
    let target = null
    const h1 = hitSegment(A, Bp, this.meshes)
    const h2 = !h1 && hitSegment(Bp, C, this.meshes)
    const h3 = !h1 && !h2 && hitSegment(C, T, this.meshes)
    if (h2) target = h2.point.clone().addScaledVector(h2.dir, -(this.radius + C.distanceTo(T))) // la mano entera (y sus dedos) se queda fuera
    else if (h3) target = C.clone().addScaledVector(h3.dir, -(h3.len - h3.dist + this.radius))
    else if (h1) target = null // el hueso de arriba ya choca: no se puede arreglar con IK (lo deja como está)
    if (foot) { // nunca por debajo del suelo
      const g = this.editor.groundAt(C.x, C.z)
      const floor = Number.isNaN(g) ? -Infinity : g + 0.06
      const cur = target || C
      if (cur.y < floor) target = new THREE.Vector3(cur.x, floor, cur.z)
    }
    if (!target) return false
    const fwd = new THREE.Vector3(0, 0, 1).transformDirection(this._r.matrixWorld) // el personaje mira a +Z de su modelo
    twoBoneIK(upper, lower, end, target, foot ? fwd : fwd.clone().negate().add(new THREE.Vector3(0, -0.5, 0)))
    return true
  }
  /** Signo del cierre de los dedos de una mano (hacia la palma): se deduce del pulgar. */
  _sign(s, ch) {
    if (this._curlSign.has(s)) return this._curlSign.get(s)
    const idx = ch.index || ch.middle, th = ch.thumb, other = ch.pinky || ch.ring
    let sign = 1
    if (idx && th && other) {
      const tip = idx[idx.length - 1], before = wp(tip), axis = this._axis(ch)
      const palmToThumb = wp(th[0]).sub(wp(idx[0]).add(wp(other[0])).multiplyScalar(0.5))
      const q0 = idx[0].quaternion.clone()
      rotateWorld(idx[0], new THREE.Quaternion().setFromAxisAngle(axis, 0.8))
      const moved = wp(tip).sub(before)
      idx[0].quaternion.copy(q0); idx[0].updateMatrixWorld(true)
      sign = moved.dot(palmToThumb) >= 0 ? 1 : -1
    }
    this._curlSign.set(s, sign)
    return sign
  }
  /** Eje de cierre: de la base del índice a la del meñique (a lo ancho de la palma). */
  _axis(ch) { const a = ch.index || ch.middle, b = ch.pinky || ch.ring; return a && b ? wp(b[0]).sub(wp(a[0])).normalize() : new THREE.Vector3(1, 0, 0) }
  /** Cierra los dedos hasta su curl (0 abierto · 1 puño) o hasta tocar algo. Devuelve cuántos dedos pararon por contacto. */
  _fingers(s, curl) {
    const ch = this.chains?.[s]; if (!ch || !Object.keys(ch).length) return 0
    for (const list of Object.values(ch)) for (const b of list) { const r = this._rest.get(b); if (r) b.quaternion.copy(r) }
    this._r.updateMatrixWorld(true)
    if (!curl) return 0
    const sign = this._sign(s, ch), axisW = this._axis(ch)
    let stopped = 0
    FINGERS.forEach(([name], fi) => {
      const list = ch[name], c = Math.max(0, Math.min(1, curl[fi] ?? 0))
      if (!list || c <= 0) return
      const maxA = (name === 'thumb' ? 50 : 85) * (Math.PI / 180) * c
      const ax = name === 'thumb' ? axisW.clone().applyAxisAngle(wp(list[0]).sub(wp(list[0].parent)).normalize(), Math.PI / 3) : axisW
      let blocked = false
      // ¿algún tramo del dedo, desde la articulación j hasta la punta, toca algo?
      const touches = (j) => {
        const pts = list.slice(j).map((b) => wp(b))
        const last = pts[pts.length - 1], prev = pts.length > 1 ? pts[pts.length - 2] : wp(list[j].parent)
        pts.push(last.clone().add(last.clone().sub(prev).normalize().multiplyScalar(0.022 + this.radius * 0.5))) // la yema
        for (let i = 0; i < pts.length - 1; i++) if (hitSegment(pts[i], pts[i + 1], this.meshes)) return true
        return false
      }
      for (let j = 0; j < list.length && !blocked; j++) {
        const b = list[j], steps = 6
        for (let k = 0; k < steps; k++) {
          const prev = b.quaternion.clone()
          rotateWorld(b, new THREE.Quaternion().setFromAxisAngle(ax, (sign * maxA) / steps))
          if (touches(j)) { b.quaternion.copy(prev); b.updateMatrixWorld(true); blocked = true; break }
        }
      }
      if (blocked) stopped++
    })
    return stopped
  }
}
