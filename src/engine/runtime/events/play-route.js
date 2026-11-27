// Rutas de movimiento y movimiento autónomo de eventos, y «mirar al evento» (gaze). Se mezcla en PlayMode (play.js).
import * as THREE from 'three'
import { SPEED_MPS } from './model.js'
import { ROUTE_CMDS } from './route.js'
import { DEG } from '../util.js'
import { compileScript } from '../host.js'

const fwdOf = (yaw) => new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))
const rightOf = (yaw) => new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw))
const faceYaw = (dx, dz) => Math.atan2(-dx, -dz)
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d }

/** Acepta pasos como objeto {c,p}, texto 'turnPlayer' o lista ['forward', 2] (el valor va al primer parámetro). */
export function normStep(s) {
  if (typeof s === 'string') s = { c: s, p: {} }
  else if (Array.isArray(s)) { const d = ROUTE_CMDS[s[0]]; s = { c: s[0], p: d?.params[0] && s.length > 1 ? { [d.params[0].key]: s[1] } : {} } }
  const d = ROUTE_CMDS[s?.c]
  if (!d) throw new Error(`Paso de ruta desconocido «${s?.c}» (usa: ${Object.keys(ROUTE_CMDS).join(', ')})`)
  const p = {}
  for (const q of d.params) p[q.key] = s.p && s.p[q.key] !== undefined ? s.p[q.key] : q.def
  return { c: s.c, p }
}

export const routeMethods = {
  // ---------- actores ----------
  _routeActor(target, nodeName, eventId) {
    if (target === 'player') {
      if (!this._nativePlayerId) throw new Error('Ruta del jugador: no existe CharacterBody3D controlado')
      return { key: 'player', player: true, pos: () => this.pos, yaw: () => this.yaw, setYaw: (y) => { this.yaw = y }, id: this._nativePlayerId }
    }
    let inst = null, node = null, obj = null
    if (target === 'this' || target == null) { inst = this.events.find((e) => e.id === eventId); if (!inst) throw new Error('«Este evento» solo funciona dentro de un evento'); node = inst.node; obj = inst.obj }
    else {
      obj = typeof target === 'object' ? target : this._find(target === 'node' ? nodeName : target)
      node = obj && this.ed.nodes.get(obj.id)
      if (!node) throw new Error(`No existe el nodo «${nodeName || target}»`)
      inst = this.events.find((e) => e.id === obj.id) || null
    }
    return { key: node, node, obj, inst, id: obj.id, pos: () => node.position, yaw: () => node.rotation.y, setYaw: (y) => { node.rotation.y = y; node.updateMatrixWorld(true); this.phys?.syncNode(node) } }
  },
  _actorState(a) {
    this.actors ||= new Map()
    let st = this.actors.get(a.key)
    if (!st) { st = { token: 0, speed: a.player ? 4 : 3, through: false, dirFix: false }; this.actors.set(a.key, st) }
    return st
  },
  _wait(s) { return s > 0 ? new Promise((r) => this.timers.push({ t: s, r })) : new Promise((r) => this.frameWait.push(r)) },

  /** Tween genérico por «dueño» (nodo o 'player'); sustituye (y libera) al anterior del mismo dueño. */
  _tween(owner, dur, fn) {
    for (const o of this.tweens.filter((m) => m.node === owner)) o.r()
    this.tweens = this.tweens.filter((m) => m.node !== owner)
    if (!(dur > 0)) { fn(1, 0); return Promise.resolve() }
    return new Promise((r) => this.tweens.push({ node: owner, t: 0, dur, fn, r }))
  },

  // ---------- ejecución ----------
  /** Lanza una ruta. Devuelve una promesa que se resuelve al terminar (si no es un bucle). */
  routeRun({ target, node, route, eventId }) {
    const a = this._routeActor(target, node, eventId), st = this._actorState(a), tk = ++st.token
    const list = (route.list || []).map(normStep)
    return this._routeExec(a, st, list, route.skip !== false, !!route.repeat, tk)
  },
  routeStop(target, node, eventId) { const a = this._routeActor(target, node, eventId); this._actorState(a).token++ },
  async _routeExec(a, st, list, skip, repeat, tk) {
    do {
      for (const s of list) {
        if (!this.on || st.token !== tk) return
        await this._routeStep(a, st, s, skip, tk)
      }
      if (repeat) await this._wait(0)
    } while (repeat && list.length && this.on && st.token === tk)
  },

  /** ¿Se puede avanzar `vec` desde la posición actual? (paredes y jugador). */
  _routeBlocked(a, st, vec) {
    if (st.through || (a.inst && this._pageOf(a.inst)?.options?.through)) return false
    const len = vec.length(); if (len < 1e-6) return false
    const dir = vec.clone().divideScalar(len), p = a.pos()
    if (!a.player && Math.hypot(p.x + vec.x - this.pos.x, p.z + vec.z - this.pos.z) < this.body.radius + 0.45 && Math.abs(p.y - this.pos.y) < 2.5) return true
    if (st.noWall) return false // siguiendo el mapa de navegación: la geometría fija ya está resuelta
    const ext = a.player ? this.body.radius : this._ext(a)
    const origin = [p.x + dir.x * ext, p.y + (a.player ? 0.9 : 0), p.z + dir.z * ext]
    const hit = this._raycast(origin, [dir.x, dir.y, dir.z], len + 0.12)
    return !!hit && hit.node?.id !== a.id
  },
  _ext(a) {
    const pg = a.inst && this._pageOf(a.inst), gr = pg?.graphic
    return pg && pg.solid && gr && gr.kind !== 'none' ? Math.max(gr.size?.[0] || 1, gr.size?.[2] || 1) / 2 + 0.05 : 0.3
  },
  _pageOf(inst) { return inst.props.pages[inst.pageIdx] },

  async _turn(a, yaw, seconds = 0.12) {
    const from = a.yaw(), d = angDiff(from, yaw)
    await this._tween(a.key === 'player' ? 'player-turn' : a.key, seconds, (k) => a.setYaw(from + d * k))
  },
  async _walk(a, st, vec, skip, tk) {
    const len = vec.length(); if (len < 1e-6) return
    if (!st.dirFix && (vec.x || vec.z)) await this._turn(a, faceYaw(vec.x, vec.z), 0.1)
    await this._move3(a, st, vec, skip, tk)
  },
  async _move3(a, st, vec, skip, tk) {
    const len = vec.length(); if (len < 1e-6) return
    let tries = 0
    while (this._routeBlocked(a, st, vec)) {
      if (skip || ++tries > 12) return
      await this._wait(0.25)
      if (!this.on || st.token !== tk) return
    }
    const mps = SPEED_MPS[Math.max(1, Math.min(6, st.speed | 0))] || 2, from = a.pos().clone(), to = from.clone().add(vec)
    if (a.player) { await this._tween('player', len / mps, (k) => { this._nativePositionSet(from.clone().lerp(to, k)) }); return }
    this.phys?.makeKinematic(a.node)
    await this._tween(a.node, len / mps, (k, dt) => { a.node.position.lerpVectors(from, to, k); a.node.updateMatrixWorld(true); this.phys?.syncNode(a.node, dt) })
  },


  /**
   * Sigue una ruta del mapa de navegación de forma fluida: velocidad constante, giro suave mientras camina (sin parar en cada esquina).
   * `pts` = [[x,y,z]…] (sin el punto de partida). Devuelve true si llegó.
   */
  async _followPath(a, st, pts, tk, { arrive = 0 } = {}) {
    const mps = SPEED_MPS[Math.max(1, Math.min(6, st.speed | 0))] || 2
    const start = a.pos().clone()
    const n0 = this.nav?.nearest([start.x, start.y, start.z], 4)
    const dy = n0 ? start.y - n0[1] : 0 // desfase entre el origen del nodo y el suelo (los eventos tienen el origen en el centro)
    if (!a.player) this.phys?.makeKinematic(a.node)
    st.noWall = true
    try {
      let first = true
      let cur = start.clone()
      for (let i = 0; i < pts.length; i++) {
        if (!this.on || st.token !== tk) return false
        const q = pts[i], to = new THREE.Vector3(q[0], q[1] + dy, q[2])
        let seg = to.clone().sub(cur)
        // un destino demasiado cerca del final (p. ej. «acercarse»): se corta la ruta a `arrive` metros del último punto
        if (arrive > 0 && i === pts.length - 1) { const l = Math.hypot(seg.x, seg.z); if (l <= arrive) break; seg.multiplyScalar((l - arrive) / l); to.copy(cur).add(seg) }
        const len = seg.length(); if (len < 1e-4) continue
        // «no pisar al jugador»: un evento que se acerca se detiene antes de chocar
        if (!a.player && Math.hypot(to.x - this.pos.x, to.z - this.pos.z) < this.body.radius + 0.45 && Math.abs(to.y - this.pos.y) < 2.5) break
        const target = faceYaw(seg.x, seg.z)
        if (first && !st.dirFix && Math.abs(angDiff(a.yaw(), target)) > 1.0) await this._turn(a, target, 0.14)
        first = false
        const from = cur.clone()
        await this._tween(a.player ? 'player' : a.node, len / mps, (k, dt) => {
          const v = from.clone().lerp(to, k)
          if (a.player) { this._nativePositionSet(v) }
          else { a.node.position.copy(v); a.node.updateMatrixWorld(true); this.phys?.syncNode(a.node, dt) }
          if (!st.dirFix) { const cy = a.yaw(); a.setYaw(cy + angDiff(cy, target) * (1 - Math.exp(-14 * Math.max(dt, 1 / 60)))) }
        })
        if (!this.on || st.token !== tk) return false
        cur = to
      }
      return true
    } finally { st.noWall = false }
  },
  /** Ir a un punto con el mapa de navegación (o en línea recta si no hay mapa y `straight` no es false). */
  async _gotoPoint(a, st, p, tk, { straight = true, arrive = 0 } = {}) {
    const pos = a.pos(), x = +p[0] || 0, z = +p[2] || 0
    const y = p[1] === null || p[1] === undefined || p[1] === '' || !Number.isFinite(+p[1]) ? undefined : +p[1]
    const nav = this.nav
    if (nav?.ready) {
      const r = nav.path([pos.x, pos.y, pos.z], [x, y ?? pos.y, z], { smooth: true, allowPartial: true })
      if (r && r.points.length > 1) return this._followPath(a, st, r.points.slice(1), tk, { arrive })
      if (r) return true // ya está ahí
    }
    if (!straight) return false
    return this._followPath(a, st, [[x, y ?? pos.y, z]], tk, { arrive })
  },

  async _routeStep(a, st, s, skip, tk) {
    const p = s.p, yaw = a.yaw(), pos = a.pos(), d = +p.dist || 0
    const toPlayer = () => new THREE.Vector3(this.pos.x - pos.x, 0, this.pos.z - pos.z)
    switch (s.c) {
      case 'forward': return this._move3(a, st, fwdOf(yaw).multiplyScalar(d), skip, tk)
      case 'back': return this._move3(a, st, fwdOf(yaw).multiplyScalar(-d), skip, tk)
      case 'left': return this._move3(a, st, rightOf(yaw).multiplyScalar(-d), skip, tk)
      case 'right': return this._move3(a, st, rightOf(yaw).multiplyScalar(d), skip, tk)
      case 'up': return this._move3(a, st, new THREE.Vector3(0, d, 0), skip, tk)
      case 'down': return this._move3(a, st, new THREE.Vector3(0, -d, 0), skip, tk)
      case 'stepRandom': { const an = Math.random() * Math.PI * 2; return this._walk(a, st, new THREE.Vector3(Math.cos(an) * d, 0, Math.sin(an) * d), skip, tk) }
      case 'stepToward': { const v = toPlayer(); if (v.lengthSq() > 1e-6) return this._walk(a, st, v.setLength(Math.min(d, Math.max(0, v.length() - this.body.radius - 0.5))), skip, tk); return }
      case 'stepAway': { const v = toPlayer(); if (v.lengthSq() > 1e-6) return this._walk(a, st, v.setLength(-d), skip, tk); return }
      case 'moveTo': { const t = new THREE.Vector3(...(p.pos || [0, 0, 0]).map(Number)); return this._move3(a, st, p.rel ? t : t.sub(pos), skip, tk) }
      case 'goto': { await this._gotoPoint(a, st, p.pos || [0, null, 0], tk, { straight: p.straight !== false }); return }
      case 'turnBy': return this._turn(a, yaw + p.deg * DEG)
      case 'turnTo': return this._turn(a, p.deg * DEG)
      case 'turnPlayer': { const v = toPlayer(); return v.lengthSq() > 1e-6 ? this._turn(a, faceYaw(v.x, v.z)) : undefined }
      case 'turnAway': { const v = toPlayer(); return v.lengthSq() > 1e-6 ? this._turn(a, faceYaw(-v.x, -v.z)) : undefined }
      case 'turnRandom': return this._turn(a, Math.random() * Math.PI * 2)
      case 'turnNode': { const o = this._find(p.node), n = o && this.ed.nodes.get(o.id); if (!n) throw new Error(`No existe el nodo «${p.node}»`); return this._turn(a, faceYaw(n.position.x - pos.x, n.position.z - pos.z)) }
      case 'speed': st.speed = +p.n || 3; return
      case 'through': st.through = !!p.on; return
      case 'dirFix': st.dirFix = !!p.on; return
      case 'wait': return this._wait(+p.seconds || 0)
      case 'jump': {
        const h = +p.height || 0, y0 = pos.y
        return this._tween(a.player ? 'player-jump' : a.key, +p.seconds || 0.5, (k, dt) => {
          const y = y0 + 4 * h * k * (1 - k)
          if (a.player) { if (this._nativePlayerId) this._nativePositionSet(new THREE.Vector3(this.pos.x, y, this.pos.z)); else this.pos.y = y } else { a.node.position.y = y; a.node.updateMatrixWorld(true); this.phys?.syncNode(a.node, dt) }
        })
      }
      case 'visible': if (a.id) this._nodeVisible(a.id, !!p.on); return
      case 'switch': this.game.setSw(p.id, !!p.on); return
      case 'sound': if (p.clip) this.audio?.script.play(p.clip, { group: p.group || 'sfx' }); return
      case 'script': {
        const output = this.game.scriptConsole(`Ruta ${a.obj?.name || 'Jugador'}`, () => this.on && st.token === tk)
        await compileScript(['game', 'node'], p.code || '')(output)(this.game.scriptApi(output), a.id ? this._nodeHandle(a.obj.name) : this._playerApi())
        return
      }
    }
  },

  // ---------- movimiento autónomo (página) ----------
  _stopAuto(e) {
    const a = this._routeActor('this', null, e.id), st = this._actorState(a)
    st.token++
  },
  _startAuto(e, pg) {
    const a = this._routeActor('this', null, e.id), st = this._actorState(a), tk = ++st.token
    st.speed = pg?.move?.speed || 3; st.dirFix = !!pg?.options?.dirFix; st.through = !!pg?.options?.through
    const mv = pg?.move
    if (!mv || mv.type === 'fixed') return
    const home = e.node.position.clone(), range = mv.range || 4
    const pause = () => (6 - (mv.freq || 3)) * 0.5 * (0.6 + Math.random() * 0.8)
    ;(async () => {
      while (this.on && st.token === tk) {
        await this._wait(pause())
        while (this.on && st.token === tk && (this.main || this.state.dialog)) await this._wait(0.2)
        if (!this.on || st.token !== tk) return
        const p = e.node.position
        if (mv.type === 'random') {
          const hasNav = this.nav?.ready
          const t = hasNav ? this.nav.randomPoint([home.x, home.y, home.z], range) : null
          if (t && Math.hypot(t[0] - p.x, t[2] - p.z) > 0.8) { await this._gotoPoint(a, st, t, tk, { straight: false }); continue }
          let an = Math.random() * Math.PI * 2, v = new THREE.Vector3(Math.cos(an), 0, Math.sin(an))
          if (p.distanceTo(home) + 1 > range) v = home.clone().sub(p).setY(0).normalize()
          await this._walk(a, st, v, true, tk)
        } else if (mv.type === 'approach') {
          const v = new THREE.Vector3(this.pos.x - p.x, 0, this.pos.z - p.z), l = v.length()
          if (l > this.body.radius + 1.4 && l < 40) {
            if (this.nav?.ready) await this._gotoPoint(a, st, [this.pos.x, this.pos.y, this.pos.z], tk, { straight: false, arrive: this.body.radius + 1.2 })
            else await this._walk(a, st, v.setLength(1), true, tk)
          }
        } else if (mv.type === 'custom') {
          const r = mv.route || {}
          await this._routeExec(a, st, (r.list || []).map(normStep), r.skip !== false, false, tk)
        }
      }
    })().catch((err) => this.game?.report(err, e.obj.name))
  },

  // ---------- mirar al evento ----------
  _gazeVec(e, gz) {
    const n = e.node; n.updateWorldMatrix(true, false)
    const q = new THREE.Quaternion(), wp = new THREE.Vector3(); n.matrixWorld.decompose(wp, q, new THREE.Vector3())
    return new THREE.Vector3(...(gz.offset || [0, 0, 0]).map(Number)).applyQuaternion(q).add(wp)
  },
  /** ¿Está el jugador mirando el círculo amarillo de la página? (rayo de la cámara frente a una esfera). */
  _gazeHit(e, pg) {
    const gz = pg.gaze, P = this._gazeVec(e, gz)
    const o = new THREE.Vector3(this.pos.x, this.pos.y + this.body.eyeHeight, this.pos.z)
    const cp = Math.cos(this.pitch), dir = new THREE.Vector3(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp)
    const v = P.clone().sub(o), t = v.dot(dir)
    if (t < 0 || t > gz.distance + gz.radius) return false
    if (v.clone().addScaledVector(dir, -t).length() > gz.radius) return false
    if (gz.occlude !== false) {
      const L = v.length(), dn = v.clone().divideScalar(L || 1)
      const hit = this._raycast(o.toArray(), dn.toArray(), Math.max(0, L - gz.radius))
      if (hit && hit.node?.id !== e.id) return false
    }
    return true
  },
}

