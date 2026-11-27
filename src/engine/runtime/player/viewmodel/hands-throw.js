// Manos · soltar y lanzar: soltar lo que se sostiene, lanzarlo con una trayectoria y posarlo al caer (también en el agua). Mixin de hands.js.
import * as THREE from 'three'
import { _q, _v } from './hands-util.js'

export const throwMethods = {
  // =================== acciones independientes de soltar y lanzar ===================
  /** El objeto que realmente se va a soltar o lanzar. Se prioriza la mano derecha. */
  _dropHeld() {
    const pm = this.play
    const cfg = pm.game?.db?.player
    if (!this.vm || cfg?.dropEnabled === false || !this.vm.held.size) return null
    const right = this.vm.slots.get('right')
    return (right?.items.at(-1)) || [...this.vm.held.values()].at(-1) || null
  },

  /** G suelta y T lanza al pulsarlas. Mantener una tecla ya no cambia de acción ni acumula fuerza. */
  _dropInput() {
    const pm = this.play
    const inp = pm.input, cfg = pm.game?.db?.player
    if (!inp || !this.vm || !cfg || !pm.state.focus || pm.ui?.modalOpen || pm.state.dialog || pm.state.choices) return
    const drop = inp.justPressed('drop')
    const launch = inp.justPressed('throw')
    if (!drop && !launch) return
    const h = this._dropHeld()
    if (!h) return
    if (drop) this.viewModelRelease({ target: h.id, thrown: false }).catch?.(() => {})
    else this.viewModelThrow({ target: h.id, speed: cfg.throwMax }).catch?.(() => {})
  },

  /**
   * Tira un nodo de la mano: sale de la cámara hacia donde miras con `speed` (m/s), gira, rebota en lo que choque y se queda en el suelo.
   * La promesa se resuelve cuando se detiene.
   */
  viewModelThrow({ target, eventId, speed = 8, up = 0.12 } = {}) {
    const pm = this.play
    const vm = this.vm
    if (!vm) throw new Error('El view model solo existe mientras se juega')
    const { obj, node } = this._vmTarget(target, eventId)
    const h = vm.held.get(obj.id)
    if (!h) return Promise.resolve()
    const profile = h.inst?.physicsProfile || pm._gpProfile?.(obj)
    if (h.inst && !h.inst.gfx) return Promise.resolve(false)
    // Gameplay Object utiliza Dynamic temporal, sin importar el perfil original de Database.
    if (profile && profile.type !== 'dynamic' && !pm._gpRecord?.(obj.id)) return Promise.resolve(false)
    if (profile?.type === 'dynamic' || pm._gpRecord?.(obj.id)) {
      if (!pm.phys) return Promise.resolve(false)
      const dir = new THREE.Vector3(); pm.cam.getWorldDirection(dir); dir.y += up; dir.normalize()
      const gp = pm._gpRecord?.(obj.id)
      const start = gp ? this._vmFlightOrigin(obj, node, dir) : node.getWorldPosition(new THREE.Vector3()).addScaledVector(dir, 0.5)
      if (gp && !start) return Promise.resolve(false)
      h.tween?.r(); pm.tweens = pm.tweens.filter((m) => m !== h.tween)
      this._vmDrop(h.id, { keepWorld: true })
      // El impulso empieza delante de la cápsula, no en el centro del cuerpo del jugador.
      const wp = start
      node.parent.updateMatrixWorld(true)
      node.position.copy(node.parent.worldToLocal(wp)); node.updateMatrixWorld(true)
      this._vmSettle(h)
      const body = h.inst?.physicsBody || pm._gpBody?.(obj.id)
      if (!body) return Promise.resolve(false)
      const v = Math.max(0.1, +speed || 8)
      body.push(dir.multiplyScalar(v * body.mass).toArray())
      this._vmNative('object.thrown', h)
      pm.game?.emit('drop', { node: obj.name, slot: h.slot, thrown: true, force: +v.toFixed(2) })
      return Promise.resolve(true)
    }
    h.tween?.r(); pm.tweens = pm.tweens.filter((m) => m !== h.tween)
    this._vmDrop(h.id, { keepWorld: true })
    const dir = new THREE.Vector3(); pm.cam.getWorldDirection(dir); dir.y += up; dir.normalize()
    const box = new THREE.Box3().setFromObject(node), size = box.getSize(new THREE.Vector3())
    const radius = Math.max(0.05, Math.min(0.6, Math.max(size.x, size.y, size.z) * 0.35))
    const wp = new THREE.Vector3(); node.getWorldPosition(wp)
    const v = Math.max(0.1, +speed || 8)
    const axis = new THREE.Vector3(dir.z, 0, -dir.x).normalize() // gira «hacia delante»
    if (!Number.isFinite(axis.x)) axis.set(1, 0, 0)
    const f = { h, node, vel: dir.multiplyScalar(v), speed: v, pos: wp, radius, axis, spin: 2 + v * 0.5, age: 0, bounces: 0, resolve: null, ground: null }
    const p = new Promise((r) => { f.resolve = r })
    this._thrown.push(f)
    this._vmNative('object.thrown', h)
    pm.game?.emit('drop', { node: obj.name, slot: h.slot, thrown: true, force: +v.toFixed(2) })
    return p
  },

  /** Vuelo de los objetos tirados (balística simple con rebote; sin cuerpos dinámicos de Jolt). */
  _thrownTick(dt) {
    const pm = this.play
    const list = this._thrown
    if (!list?.length) return
    const g = Math.max(4, (pm.game?.db?.player?.gravity ?? 24) * 0.8)
    for (const f of [...list]) {
      let left = Math.min(dt, 0.1)
      while (left > 0 && !f.done) {
        const s = Math.min(left, 1 / 90); left -= s
        f.age += s
        f.vel.y -= g * s
        const len = f.vel.length() * s
        let hit = null
        if (len > 1e-6) { const d = f.vel.clone().normalize(); try { hit = pm._raycast(f.pos.toArray(), d.toArray(), len + f.radius) } catch { hit = null } }
        if (hit && hit.distance <= len + f.radius) {
          const n = hit.normal ? new THREE.Vector3(...hit.normal).normalize() : new THREE.Vector3(0, 1, 0)
          if (n.dot(f.vel) > 0) n.negate()
          f.pos.set(...hit.point).addScaledVector(n, f.radius)
          const vn = f.vel.dot(n)
          f.vel.addScaledVector(n, -(1.4) * vn) // rebote con pérdida (e = 0,4)
          const tang = f.vel.clone().addScaledVector(n, -f.vel.dot(n)); f.vel.addScaledVector(tang, -0.25)
          f.spin *= 0.55; f.bounces++
          f.ground = n.y > 0.5 ? hit.point[1] : f.ground
          if (n.y > 0.5 && f.vel.length() < 1.2) { f.done = true; break }
        } else f.pos.addScaledVector(f.vel, s)
        if (f.age > 10) f.done = true
      }
      // pose en el nodo (el padre puede no ser la escena)
      const parent = f.node.parent
      if (parent) { parent.updateMatrixWorld(true); f.node.position.copy(parent.worldToLocal(f.pos.clone())) }
      if (!f.done && f.spin > 0.2) f.node.rotateOnWorldAxis(f.axis, f.spin * dt)
      f.node.updateMatrixWorld(true)
      pm.phys?.syncNode(f.node)
      if (f.done) this._thrownLand(f)
    }
    pm.vp.requestRender()
  },

  _thrownLand(f) {
    const pm = this.play
    this._thrown = this._thrown.filter((x) => x !== f)
    const node = f.node
    // se apoya por su base sobre el suelo bajo él
    node.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(node)
    const base = f.ground ?? (() => { const r = pm._raycast([f.pos.x, f.pos.y + 0.2, f.pos.z], [0, -1, 0], 50); return r ? r.point[1] : pm.ed.groundAt(f.pos.x, f.pos.z) })()
    if (Number.isFinite(base)) {
      const dy = base - box.min.y
      if (Math.abs(dy) < 3) { const parent = node.parent; const wp = new THREE.Vector3(); node.getWorldPosition(wp); wp.y += dy; node.position.copy(parent ? parent.worldToLocal(wp) : wp) }
    }
    node.updateMatrixWorld(true)
    this._vmSettle(f.h)
    pm.game?.emit('drop', { node: f.h.obj.name, slot: f.h.slot, thrown: true, landed: true, bounces: f.bounces })
    f.resolve?.()
  },
}
