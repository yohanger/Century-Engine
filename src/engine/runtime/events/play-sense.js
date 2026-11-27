// Sensores para IA y gameplay: game.sensor({ from, range, fov, … }) → qué ve o oye un nodo (o el jugador).
//
// Estudiado en SensorToolkit (Unity) —sensores de rango/visión con línea de vista, pulsos periódicos, filtros por etiqueta y capa,
// memoria de lo visto— y reescrito para este motor: no hay componentes ni nodos nuevos, es una API de scripts que usa los rayos y
// los Tags/Layers que ya existen. Sin sensores creados no cuesta nada.
//
//   const ojos = game.sensor({ from: 'Guardia', range: 18, fov: 100, targets: { player: true, tags: 'Intruso' }, hearRange: 3, memory: 4 })
//   ojos.on('detected', (d) => game.log('Veo a ' + d.name))
//   ojos.on('lost', (d) => game.log('Perdí a ' + d.name))
//   if (ojos.sees('player')) { … }   ojos.nearest   ojos.detections   ojos.remove()
//
// Los sensores viven lo que dura la escena: se vuelven a crear en game.on('scene') (o en 'start' para la primera).
import * as THREE from 'three'
import { layersOf, tagOf, layerIndex } from '../layers.js'

const arr = (v) => (v == null || v === '' ? [] : Array.isArray(v) ? v : [v])
const DEG = Math.PI / 180
const _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _f = new THREE.Vector3(), _e = new THREE.Vector3()
const INTERVAL_MIN = 0.02

export const senseMethods = {
  _senseReset() { this._sensors = [] },

  /** game.sensor(opciones) → Sensor. */
  _senseCreate(opts = {}) {
    if (!opts || typeof opts !== 'object') throw new Error('game.sensor({ from, range, fov, … }): faltan las opciones')
    const self = this
    const from = opts.from ?? opts.node
    if (from == null) throw new Error('game.sensor: indica `from` (un nodo, su nombre, o "player")')
    const isPlayer = from === 'player'
    if (!isPlayer && !this._find(from?.id ?? from?.name ?? from)) throw new Error(`game.sensor: no existe el nodo «${from?.name ?? from}»`)
    const owner = isPlayer ? null : this._find(from?.id ?? from?.name ?? from)
    const tg = opts.targets || {}
    const tl = this.project.tagLayers
    const layerIdx = arr(tg.layers).map((n) => (typeof n === 'number' ? n : layerIndex(tl, n)))
    if (layerIdx.some((i) => !(i >= 0 && i < 32))) throw new Error('game.sensor: una de las layers de targets no existe (Tags y Layers)')
    const tags = arr(tg.tags).map((t) => String(t).trim().toLowerCase())
    const named = arr(tg.nodes).map((n) => this._find(n?.id ?? n?.name ?? n)?.id).filter(Boolean)
    const cfg = {
      range: Math.max(0.1, +opts.range || 15), fov: Math.min(360, Math.max(1, +opts.fov || 360)), hearRange: Math.max(0, +opts.hearRange || 0),
      los: opts.lineOfSight !== false, eye: Array.isArray(opts.eye) ? opts.eye : [0, owner ? 1.5 : 0, 0], aim: Number.isFinite(+opts.targetHeight) ? +opts.targetHeight : 0.9,
      interval: Math.max(INTERVAL_MIN, Number.isFinite(+opts.interval) ? +opts.interval : 0.15), memory: Math.max(0, +opts.memory || 0),
    }
    const s = {
      enabled: opts.enabled !== false, cfg, t: Math.random() * cfg.interval, time: 0, recs: new Map(), handlers: { detected: [], lost: [], update: [] },
      want: { player: !!tg.player, layerIdx, tags, named, any: !tg.player && !layerIdx.length && !tags.length && !named.length }, ownerId: owner?.id ?? null, dead: false,
    }
    const emit = (name, d) => { for (const fn of s.handlers[name]) { try { const r = fn(d); if (r && r.catch) r.catch((e) => self.game?.report?.(e, 'game.sensor · ' + name)) } catch (e) { self.game?.report?.(e, 'game.sensor · ' + name) } } }
    s.emit = emit
    const rec = (r) => ({ id: r.id, name: r.name, node: r.node, distance: r.dist, angle: r.angle, visible: r.visible, heard: r.heard, lastSeen: r.last, position: r.pos.slice() })
    const api = {
      get enabled() { return s.enabled }, set enabled(v) { s.enabled = !!v; if (!s.enabled) self._senseClear(s) },
      get range() { return cfg.range }, set range(v) { cfg.range = Math.max(0.1, +v || cfg.range) },
      get fov() { return cfg.fov }, set fov(v) { cfg.fov = Math.min(360, Math.max(1, +v || cfg.fov)) },
      get hearRange() { return cfg.hearRange }, set hearRange(v) { cfg.hearRange = Math.max(0, +v || 0) },
      get memory() { return cfg.memory }, set memory(v) { cfg.memory = Math.max(0, +v || 0) },
      /** Todo lo detectado ahora (visto, oído o recordado), de más cerca a más lejos. */
      get detections() { return [...s.recs.values()].map(rec).sort((a, b) => a.distance - b.distance) },
      get nearest() { return this.detections[0] ?? null },
      get count() { return s.recs.size },
      /** ¿Ve ahora mismo (con línea de vista) ese nodo, o "player"? Sin argumentos: ¿ve algo? */
      sees(who) { return [...s.recs.values()].some((r) => r.visible && (who == null || r.id === (who === 'player' ? 'player' : self._find(who?.id ?? who?.name ?? who)?.id))) },
      /** ¿Lo detecta (visto, oído o recordado)? */
      detects(who) { return who == null ? s.recs.size > 0 : s.recs.has(who === 'player' ? 'player' : self._find(who?.id ?? who?.name ?? who)?.id) },
      on(name, fn) {
        if (!s.handlers[name]) throw new Error('sensor.on: eventos válidos: detected, lost, update')
        s.handlers[name].push(fn)
        return () => { const i = s.handlers[name].indexOf(fn); if (i >= 0) s.handlers[name].splice(i, 1) }
      },
      /** Mira ya, sin esperar al siguiente pulso. */
      pulse() { self._sensePulse(s) },
      remove() { s.dead = true; self._senseClear(s); self._sensors = self._sensors.filter((x) => x !== s) },
    }
    s.api = api
    this._sensors ??= []
    this._sensors.push(s)
    return api
  },

  /** Un fotograma: cada sensor mira cuando le toca su pulso. */
  _senseTick(dt) {
    const list = this._sensors
    if (!list?.length) return
    for (const s of list.slice()) {
      if (s.dead || !s.enabled) continue
      s.time += dt; s.t -= dt
      if (s.t <= 0) { s.t = s.cfg.interval; this._sensePulse(s) }
    }
  },

  _senseClear(s) {
    for (const r of [...s.recs.values()]) { s.recs.delete(r.id); s.emit('lost', this._senseRec(r)) }
  },
  _senseRec(r) { return { id: r.id, name: r.name, node: r.node, distance: r.dist, angle: r.angle, visible: r.visible, heard: r.heard, lastSeen: r.last, position: r.pos.slice() } },

  /** Dónde está el sensor y hacia dónde mira. */
  _senseOrigin(s) {
    if (s.ownerId == null) { const e = this._eyeRay(); return { o: e.origin, f: e.dir } }
    const node = this.ed.nodes.get(s.ownerId)
    if (!node) return null
    node.updateWorldMatrix(true, false)
    node.getWorldPosition(_p); node.getWorldQuaternion(_q)
    _e.set(s.cfg.eye[0], s.cfg.eye[1], s.cfg.eye[2]).applyQuaternion(_q).add(_p)
    _f.set(0, 0, -1).applyQuaternion(_q)
    return { o: _e.toArray(), f: _f.toArray() }
  },

  /** Candidatos: el jugador y/o los nodos que cumplen el filtro (nunca el propio dueño del sensor). */
  _senseCandidates(s) {
    const out = []
    const w = s.want
    if ((w.player || w.any) && this.hasPlayer) out.push({ id: 'player', name: 'player', pos: [this.pos.x, this.pos.y + s.cfg.aim, this.pos.z], node: null })
    if (w.player && !w.layerIdx.length && !w.tags.length && !w.named.length) return out
    for (const o of this.project.objects) {
      if (o.id === s.ownerId || !this._nodeEnabled(o) || o.type === 'event' || o.type === 'spawn' || o.type === 'camera' || o.type === 'light') continue
      if (!(w.any || w.named.includes(o.id) || (w.tags.length && w.tags.includes(tagOf(o).toLowerCase())) || (w.layerIdx.length && w.layerIdx.some((i) => layersOf(o).includes(i))))) continue
      const node = this.ed.nodes.get(o.id)
      if (!node || !node.visible) continue
      node.getWorldPosition(_p)
      out.push({ id: o.id, name: o.name, pos: [_p.x, _p.y + s.cfg.aim, _p.z], node: null, obj: o })
    }
    return out
  },

  _sensePulse(s) {
    const org = this._senseOrigin(s)
    if (!org) return
    const { o, f } = org, c = s.cfg, now = s.time
    const half = (c.fov / 2) * DEG
    const seen = new Set()
    for (const cand of this._senseCandidates(s)) {
      const dx = cand.pos[0] - o[0], dy = cand.pos[1] - o[1], dz = cand.pos[2] - o[2], dist = Math.hypot(dx, dy, dz)
      if (dist > Math.max(c.range, c.hearRange) || dist < 1e-4) continue
      const cos = (dx * f[0] + dy * f[1] + dz * f[2]) / (dist * Math.hypot(f[0], f[1], f[2]) || 1)
      const angle = Math.acos(Math.max(-1, Math.min(1, cos))) / DEG
      const heard = c.hearRange > 0 && dist <= c.hearRange
      let visible = dist <= c.range && (c.fov >= 360 || Math.acos(Math.max(-1, Math.min(1, cos))) <= half)
      if (visible && c.los) {
        const ign = [s.ownerId, cand.id === 'player' ? null : cand.id].filter(Boolean)
        const hit = this._raycast(o, [dx, dy, dz], dist, ign.length ? { ignore: ign } : null)
        if (hit && hit.distance < dist - 0.25) visible = false
      }
      if (!visible && !heard) continue
      seen.add(cand.id)
      let r = s.recs.get(cand.id)
      const isNew = !r
      if (isNew) { r = { id: cand.id, name: cand.name, node: cand.id === 'player' ? null : this._nodeHandle(cand.id) ?? null, last: now }; s.recs.set(cand.id, r) }
      Object.assign(r, { dist, angle, visible, heard: heard && !visible, pos: cand.pos })
      if (visible || heard) r.last = now
      if (isNew) s.emit('detected', this._senseRec(r))
    }
    // lo que ya no se ve ni se oye: se recuerda `memory` segundos y luego se pierde
    for (const r of [...s.recs.values()]) {
      if (seen.has(r.id)) continue
      r.visible = false; r.heard = false
      if (now - r.last > c.memory) { s.recs.delete(r.id); s.emit('lost', this._senseRec(r)) }
    }
    if (s.handlers.update.length) s.emit('update', s.api.detections)
  },
}
