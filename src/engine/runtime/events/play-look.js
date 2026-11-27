// Rayos y mirada del jugador (modo Jugar y juego exportado). Se mezcla en PlayMode.prototype, como play-steps.js.
//
//  · game.raycast(origen, dirección, distancia, { layers, tags, ignore, triggers }): rayo con filtro. Sin opciones es el rayo de siempre.
//  · game.player.eye / forward / pitch / camera / look({ … }): desde dónde y hacia dónde mira el jugador, y qué tiene delante.
//  · Nodo Trigger con «Mirada»: avisa (game.on('triggerLook'/'triggerLookEnd') y los slots «Al mirar» / «Al dejar de mirar») cuando
//    el jugador lo mira de cerca. Es opcional: si ningún Trigger activa «Mirada», no se lanza ningún rayo por fotograma.
import * as THREE from 'three'
import { layersOf, tagOf, layerIndex } from '../layers.js'

const _inv = new THREE.Matrix4(), _nm = new THREE.Matrix3(), _o = new THREE.Vector3(), _e = new THREE.Vector3(), _n = new THREE.Vector3()
const arr = (v) => (v == null || v === '' ? [] : Array.isArray(v) ? v : [v])
const MAX_SKIP = 24 // cuántas superficies que no cumplen el filtro puede atravesar un rayo

export const TRIGGER_LOOK_DEFAULT = 3 // metros

/** Configuración efectiva de Trigger durante reproducción, sin modificar el proyecto. */
export function triggerRuntimeProps(play, obj) {
  return { ...obj.props, ...play.ed?.nodes?.get(obj.id)?.userData?.timelineTriggerProps }
}

export const lookMethods = {
  /** Filtro de un rayo a partir de las opciones del script. null si no filtra nada. Lanza un error claro si una layer no existe. */
  _rayFilter(opts) {
    if (!opts || typeof opts !== 'object') return null
    const tl = this.project.tagLayers
    const idx = arr(opts.layers).map((n) => {
      const i = typeof n === 'number' ? n : layerIndex(tl, n)
      if (!(i >= 0 && i < 32)) throw new Error(`raycast: no existe la layer «${n}» (Tags y Layers)`)
      return i
    })
    const tags = arr(opts.tags).map((t) => String(t).trim().toLowerCase())
    const ignore = arr(opts.ignore).map((n) => this._find(n && typeof n === 'object' ? n.id ?? n.name : n)?.id).filter(Boolean)
    return idx.length || tags.length || ignore.length ? { idx, tags, ignore } : null
  },
  _rayAccept(f, obj) {
    if (!f) return true
    if (obj && f.ignore.includes(obj.id)) return false
    if (f.idx.length) { const L = obj ? layersOf(obj) : [0]; if (!f.idx.some((i) => L.includes(i))) return false }
    if (f.tags.length && !f.tags.includes((obj ? tagOf(obj) : 'Untagged').toLowerCase())) return false
    return true
  },
  /** Objeto del proyecto al que pertenece una malla golpeada. */
  _objOfMesh(m) {
    for (let v = m; v; v = v.parent) if (v.userData?.rtObj) return v.userData.rtObj
    for (let v = m; v; v = v.parent) for (const [id, n] of this.ed.nodes) if (n === v) return this._find(id)
    return null
  },

  /** Un rayo contra la geometría sólida (Jolt; sin Jolt, Three.js). { point, normal, distance, mesh } o null. */
  _castOnce(o, u, maxDist) {
    if (this.phys) return this.phys.raycast(o, u, maxDist)
    this.ray.set(new THREE.Vector3(...o), new THREE.Vector3(...u)); this.ray.far = maxDist
    const h = this.ray.intersectObjects(this.colliders, false)[0]
    return h ? { point: h.point.toArray(), normal: h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld).toArray() : null, distance: h.distance, mesh: h.object } : null
  },
  /** Lo sólido más cercano que cumple el filtro. Lo que no cumple no estorba: el rayo lo atraviesa. */
  _raycastSolid(o, u, maxDist, f) {
    let org = o, left = maxDist, done = 0
    for (let i = 0; i < MAX_SKIP; i++) {
      const r = this._castOnce(org, u, left)
      if (!r) return null
      const obj = f ? this._objOfMesh(r.mesh) : null
      if (this._rayAccept(f, obj)) return { ...r, distance: done + r.distance }
      const adv = r.distance + 0.01
      done += adv; left -= adv
      if (left <= 0) return null
      org = [org[0] + u[0] * adv, org[1] + u[1] * adv, org[2] + u[2] * adv]
    }
    return null
  },

  /** Triggers de la escena (con su nodo). Se recalcula al cambiar de escena. */
  _trigList() {
    if (this._trigCache) return this._trigCache
    return (this._trigCache = this.project.objects.filter((o) => o.type === 'trigger').map((obj) => ({ obj, node: this.ed.nodes.get(obj.id) })).filter((t) => t.node))
  },
  /** Primer volumen de Trigger que cruza el rayo: { distance, point, normal, obj } (distancia 0 si el origen está dentro) o null. */
  _raycastTriggers(o, u, maxDist, f, only = null) {
    let best = null
    for (const t of this._trigList()) {
      if (only && !only(t.obj)) continue
      if (!this._rayAccept(f, t.obj)) continue
      const s = t.obj.scale || [1, 1, 1]
      t.node.updateWorldMatrix(true, false)
      _inv.copy(t.node.matrixWorld).invert()
      _o.set(o[0], o[1], o[2]).applyMatrix4(_inv)
      _e.set(o[0] + u[0], o[1] + u[1], o[2] + u[2]).applyMatrix4(_inv).sub(_o) // dirección local por metro de mundo
      let tmin = -Infinity, tmax = Infinity, axis = 0, sign = 1
      const lo = [_o.x, _o.y, _o.z], de = [_e.x, _e.y, _e.z]
      let miss = false
      for (let a = 0; a < 3 && !miss; a++) {
        const h = Math.abs(s[a]) / 2
        if (Math.abs(de[a]) < 1e-9) { if (Math.abs(lo[a]) > h) miss = true; continue }
        let t1 = (-h - lo[a]) / de[a], t2 = (h - lo[a]) / de[a], sg = -1
        if (t1 > t2) { const k = t1; t1 = t2; t2 = k; sg = 1 }
        if (t1 > tmin) { tmin = t1; axis = a; sign = sg }
        tmax = Math.min(tmax, t2)
      }
      if (miss || tmax < 0 || tmin > tmax) continue
      const dist = tmin >= 0 ? tmin : 0
      if (dist > maxDist || (best && dist >= best.distance)) continue
      _n.set(0, 0, 0).setComponent(axis, sign)
      _nm.getNormalMatrix(t.node.matrixWorld)
      best = { distance: dist, point: [o[0] + u[0] * dist, o[1] + u[1] * dist, o[2] + u[2] * dist], normal: tmin >= 0 ? _n.applyMatrix3(_nm).normalize().toArray() : null, obj: t.obj }
    }
    return best
  },

  /**
   * game.raycast([x,y,z], [dx,dy,dz], maxDist, opts?) → { point, normal, distance, node, kind } o null.
   * opts: { layers, tags, ignore, triggers }. `layers`/`tags`: solo cuentan los objetos que estén en alguna de esas layers/etiquetas (el resto no
   * estorba). `ignore`: nodos que el rayo atraviesa. `triggers: true`: también se detectan los volúmenes de Trigger (kind: 'trigger').
   */
  _raycast(origin, dir, maxDist = 100, opts = null) {
    const o = Array.from(origin || [], Number), d = Array.from(dir || [], Number)
    if (o.length !== 3 || d.length !== 3 || o.concat(d).some((v) => !Number.isFinite(v))) throw new Error('raycast(origen, dirección, distancia): origen y dirección son [x, y, z]')
    const len = Math.hypot(...d)
    if (!(len > 0) || !(maxDist > 0)) return null
    const u = [d[0] / len, d[1] / len, d[2] / len]
    const f = this._rayFilter(opts)
    const nodeOf = (m) => { for (let v = m; v; v = v.parent) { for (const [id, n] of this.ed.nodes) if (n === v) return this._nodeHandle(id) } return undefined }
    const solid = this._raycastSolid(o, u, maxDist, f)
    const trig = opts?.triggers ? this._raycastTriggers(o, u, solid ? solid.distance : maxDist, f) : null
    if (trig && (!solid || trig.distance <= solid.distance)) return { point: trig.point, normal: trig.normal, distance: trig.distance, node: this._nodeHandle(trig.obj.id), kind: 'trigger', trigger: this._trigInfo(trig.obj) }
    return solid ? { point: solid.point, normal: solid.normal, distance: solid.distance, node: solid.mesh ? nodeOf(solid.mesh) : undefined, kind: 'solid' } : null
  },

  _trigInfo(obj) { return { id: obj.id, name: obj.name, tag: triggerRuntimeProps(this, obj).tag || 'zona' } },

  // ---------- mirada del jugador ----------
  /** Posición de los ojos y hacia dónde mira (la cámara real, también con una cinemática). */
  _eyeRay() {
    const cam = (this._eyeRayCam ??= this.cam.clone())
    cam.aspect = this.cam.aspect
    this._viewCamera(cam) // calcular mirada gameplay sin pisar la salida que usa el render
    cam.updateMatrixWorld(true)
    const p = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld)
    const f = new THREE.Vector3(0, 0, -1).transformDirection(cam.matrixWorld)
    return { origin: p.toArray(), dir: f.toArray() }
  },
  /** game.player.look({ distance, layers, tags, ignore, triggers }) → lo que el jugador tiene delante (3 m por defecto) o null. */
  _playerLook(opts = {}) {
    const { origin, dir } = this._eyeRay()
    const dist = Number.isFinite(+opts?.distance) && +opts.distance > 0 ? +opts.distance : 3
    return this._raycast(origin, dir, dist, opts)
  },

  // ---------- Triggers con «Mirada» ----------
  /** Cada fotograma: ¿cuál de los Trigger con «Mirada» mira ahora el jugador? Sin ninguno activado, no cuesta nada. */
  _lookTick() {
    const list = this._trigList().filter((t) => triggerRuntimeProps(this, t.obj).look)
    if (!list.length) { if (this._lookCur) this._lookSet(null); return }
    const { origin, dir } = this._eyeRay()
    const far = Math.max(...list.map((t) => this._lookDistance(t.obj)))
    const solid = this._raycastSolid(origin, dir, far, null)
    const hit = this._raycastTriggers(origin, dir, solid ? solid.distance : far, null, (obj) => !!triggerRuntimeProps(this, obj).look)
    // un trigger solo se «mira» si el rayo entra en él antes de chocar con algo sólido y dentro de su alcance
    const ok = hit && hit.distance <= this._lookDistance(hit.obj) && (!solid || hit.distance <= solid.distance + 0.05)
    this._lookSet(ok ? hit.obj : null)
  },
  _lookDistance(obj) { const d = +triggerRuntimeProps(this, obj).lookDistance; return Number.isFinite(d) && d > 0 ? d : TRIGGER_LOOK_DEFAULT },
  _lookSet(obj) {
    const cur = this._lookCur
    if ((cur?.id ?? null) === (obj?.id ?? null)) return
    this._lookCur = obj
    if (cur) this._triggerFire(cur, 'triggerLookEnd', triggerRuntimeProps(this, cur).onLookEnd)
    if (obj) this._triggerFire(obj, 'triggerLook', triggerRuntimeProps(this, obj).onLook)
  },
  /** Emite la señal del motor y llama a la función opcional del slot del Trigger (definida con game.define). */
  _triggerFire(obj, signal, fnName) {
    const payload = this._trigInfo(obj)
    const g = this.game
    if (!g) return
    void g.emit(signal, payload)
    const name = String(fnName || '').trim()
    if (name) g.call(name, payload).catch((e) => g.report?.(e, `Trigger «${obj.name}» · ${signal}`))
  },
}
