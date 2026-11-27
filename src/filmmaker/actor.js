// Nether Film Maker · el personaje del actor dentro del nivel: recibe fotogramas del cuerpo (en vivo o de una toma grabada)
// y gira los huesos del modelo de la escena con el mismo retarget que usa Century al importar.
import { calibrate, toCanonical, FrameSmoother, sampleFrames, bake } from '../core/capture/edit.js'
import { retarget, findHumanoid, humanoidReport } from '../core/capture/retarget.js'
import { skeletonFromModel } from '../engine/runtime/anim/three-bridge.js'
import { ContactSolver } from './contact.js'

const ROLES = ['upperArm', 'lowerArm', 'hand', 'upperLeg', 'lowerLeg', 'foot', 'toe']

export class ActorRig {
  /** @param editor  Editor de Century · @param obj objeto de la escena con modelo (film.actor) */
  /** `contact`: { project, grip:{L,R} } → el personaje choca con el entorno y cierra los dedos (contact.js). */
  constructor(editor, obj, { smooth = 0.35, facing = '+Z', contact = null } = {}) {
    this.ed = editor; this.obj = obj; this.facing = facing; this.smoothAmt = smooth; this.contact = contact
    this.sk = skeletonFromModel(editor.models.get(obj.modelId))
    this.map = this.sk ? findHumanoid(this.sk.bones) : null
    this.report = this.sk ? humanoidReport(this.map) : { ok: false, missing: ['esqueleto'] }
    this.basis = null; this.calib = []; this.smoother = new FrameSmoother(smooth)
  }
  get ok() { return !!this.sk && this.report.ok }
  /** Huesos del modelo DE LA ESCENA (la copia que se ve), por nombre. */
  _bones() {
    const root = this.ed.nodes.get(this.obj.id)?.userData?.modelRoot
    if (!root) return null
    if (this._root !== root) {
      this._root = root; this._byName = new Map(); this._rest = new Map()
      root.traverse((o) => { if (o.isBone) { this._byName.set(o.name, o); this._rest.set(o, o.quaternion.clone()) } })
    }
    return this._byName
  }
  /** Fotogramas para calibrar (postura de frente del primer segundo). Devuelve true cuando ya está calibrado. */
  feedCalibration(frame, need = 20) {
    if (this.basis) return true
    this.calib.push(frame)
    if (this.calib.length >= need) { this.basis = calibrate(this.calib); this.smoother = new FrameSmoother(this.smoothAmt) }
    return !!this.basis
  }
  resetCalibration() { this.basis = null; this.calib = [] }
  /** Fotograma crudo del detector → pose del personaje (en vivo). */
  applyRaw(frame) {
    if (!this.ok) return false
    if (!this.basis) this.feedCalibration(frame)
    if (!this.basis) return false
    const can = this.smoother.push(toCanonical([frame], this.basis)[0])
    if (frame.c) can.c = frame.c
    return this.applyCanonical(can)
  }
  /** Nombres de los huesos de brazos y piernas por lado (para el contacto). */
  names() {
    const n = { L: {}, R: {} }
    for (const s of ['L', 'R']) for (const r of ROLES) if (this.map[s][r] !== undefined) n[s][r] = this.sk.bones[this.map[s][r]].name
    return n
  }
  /** Cierre de cada mano: el capturado (si se vio) o el agarre elegido. */
  curls(c) {
    const grip = this.contact?.grip || { L: 0, R: 0 }
    const side = (k, off) => [0, 1, 2, 3, 4].map((i) => { const v = c?.[off + i]; return v != null && v >= 0 ? v : grip[k] })
    return { L: side('L', 0), R: side('R', 5) }
  }
  /** Fotograma ya en espacio canónico (tomas horneadas) → huesos (+ contacto con el entorno si está activado). */
  applyCanonical(frame) {
    const bones = this._bones()
    if (!bones || !this.ok) return false
    const { tracks } = retarget([{ t: 0, p: frame.p }], this.sk, { map: this.map, facing: this.facing })
    for (const tr of tracks) { const b = bones.get(tr.bone); if (b) b.quaternion.set(tr.values[0], tr.values[1], tr.values[2], tr.values[3]) }
    if (this.contact) {
      this.solver ||= new ContactSolver({ editor: this.ed, project: this.contact.project, actor: this.obj, names: this.names() })
      this.lastContact = this.solver.solve(this.curls(frame.c))
    }
    this.ed.vp.requestRender()
    return true
  }
  /** Rehace la lista de mallas con las que choca (tras mover objetos o sustituir la escena). */
  refreshColliders() { this.solver = null }
  /** Rotaciones LOCALES de todos los huesos del modelo de la escena (para guardar la toma ya resuelta). */
  readLocal() { const out = []; for (const [name, b] of this._bones() || []) out.push([name, b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w]); return out }
  /** Vuelve a la pose de reposo del modelo. */
  rest() { this._bones(); for (const [b, q] of this._rest || []) b.quaternion.copy(q); this.ed.vp.requestRender() }
}

/** Una toma grabada lista para reproducir: hornea la captura una vez y muestrea por tiempo. */
export class TakePlayer {
  constructor(cap) { const { takes } = bake(cap); this.take = takes[0]; this.duration = this.take?.duration || 0 }
  frameAt(t) {
    if (!this.take) return null
    const f = sampleFrames(this.take.frames, t)
    if (f) { const fr = this.take.frames; let i = 0; while (i < fr.length - 1 && fr[i + 1].t <= t) i++; if (fr[i].c) f.c = fr[i].c }
    return f
  }
}

/**
 * Resuelve una toma con el contacto (y los dedos) contra la escena actual: devuelve las pistas de rotación de TODOS los huesos
 * ({ bone, times, values }) a `fps`. Es lo que se exporta a Century, así allí el personaje tampoco atraviesa nada.
 */
export function solveTake(rig, cap, fps = 30) {
  const tp = new TakePlayer(cap)
  if (!tp.take) return null
  const n = Math.max(2, Math.round(tp.duration * fps) + 1), by = new Map(), hits = { hands: 0, feet: 0, fingers: 0 }
  for (let i = 0; i < n; i++) {
    const t = Math.min(tp.duration, i / fps), f = tp.frameAt(t)
    if (!f) continue
    rig.applyCanonical(f)
    const r = rig.lastContact; if (r) { hits.hands += r.hands.length; hits.feet += r.feet.length; hits.fingers += r.fingers }
    for (const [name, x, y, z, w] of rig.readLocal()) {
      let tr = by.get(name); if (!tr) by.set(name, (tr = { bone: name, times: [], values: [], _p: null }))
      let q = [x, y, z, w]; if (tr._p && tr._p[0] * q[0] + tr._p[1] * q[1] + tr._p[2] * q[2] + tr._p[3] * q[3] < 0) q = q.map((v) => -v)
      tr._p = q; tr.times.push(Math.round(t * 1e4) / 1e4); tr.values.push(...q.map((v) => Math.round(v * 1e4) / 1e4))
    }
  }
  rig.rest()
  // fuera las pistas de huesos que no se mueven nunca (no aportan nada y pesan)
  const tracks = [...by.values()].filter((tr) => { const v = tr.values; for (let i = 4; i < v.length; i++) if (Math.abs(v[i] - v[i % 4]) > 1e-4) return true; return false }).map(({ _p, ...t }) => t)
  return { fps, duration: tp.duration, tracks, hits }
}
