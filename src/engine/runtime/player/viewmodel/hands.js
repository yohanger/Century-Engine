// FPS · manos (view model): lo que cuelga de la cámara —coger, soltar, lanzar, guardar— en los slots de Base de datos ▸ Jugador.
// Antes en events/play-viewmodel.js: mismo código; `this` es el controlador y el juego es `this.play` (`pm`). Opcional en el contrato:
// un tipo de jugador sin manos no lo implementa y PlayMode (events/play-player.js) responde con valores vacíos.
// View model del jugador (modo Jugar y juego exportado): lo que cuelga de la cámara.
//
//  · Los SLOTS (mano derecha, mano izquierda, ojos…) salen de Base de datos ▸ Jugador. Cada slot es un anclaje (Group) relativo
//    a la cámara. No hay mano modelada: es un lugar donde colgar cosas.
//  · «Mover al view model» (comando) / game.viewModel.attach() lleva un nodo del mundo —un evento, un trigger, un modelo…— a un
//    slot. Sin objetivo: el propio evento que lo ejecuta. Mientras está en la mano no choca con el jugador y sus zonas de
//    evento no se activan; al soltarlo vuelve al mundo (delante del jugador, en el suelo, o donde se indique).
//  · Se dibuja en una capa aparte (VM_LAYER) con la cámara `view.camera`, después de la escena y con la profundidad vaciada
//    (ver render/look.js): no atraviesa las paredes.
// Se mezcla en PlayMode.prototype, como play-route.js y play-timeline.js.
import * as THREE from 'three'
import { DEG } from '../../util.js'
import { slotById } from '../../database/player.js'

import { VM_LAYER, _e, _q, _v, arr3, eul, toVmLayer, fromVmLayer } from './hands-util.js'
import { throwMethods } from './hands-throw.js'
import { stashMethods } from './hands-stash.js'
export { VM_LAYER }
export const handsMethods = {
  // =================== montaje ===================
  /** Crea el grupo del view model, sus slots y la cámara con la que se dibuja. Se llama al empezar a jugar. */
  _vmSetup() {
    const pm = this.play
    this._vmTeardown()
    const scene = pm.vp.scene
    const root = new THREE.Group()
    root.name = 'ViewModel'
    const cam = new THREE.PerspectiveCamera(pm.cam.fov, 1, 0.01, 60)
    cam.layers.set(VM_LAYER)
    const view = { scene, camera: cam, active: false }
    this.vm = { root, cam, view, slots: new Map(), held: new Map(), stash: new Map(), visible: true, tweens: [] }
    this._thrown = []
    scene.add(root)
    pm.vp.vmView = view
    this._vmBuildSlots()
    this._vmLights()
  },

  _vmTeardown({ restoreWorld = false } = {}) {
    const pm = this.play
    const vm = this.vm
    if (!vm) return
    for (const f of this._thrown || []) f.resolve?.()
    this._thrown = []
    for (const h of [...vm.held.values()]) {
      this._vmDrop(h.id, restoreWorld ? { keepWorld: true } : { discard: true })
      if (restoreWorld) this._vmSettle(h)
    }
    if (restoreWorld) for (const s of vm.stash.values()) {
      // El inventario Database conserva su estado «stored»; los objetos
      // guardados manualmente vuelven al mundo al desaparecer el jugador.
      if (['stored', 'consumed'].includes(pm._gpRecord?.(s.id)?.state.status) ||
          pm.game?.state?.dbItems3D?.[s.id]?.status === 'consumed') continue
      s.node.visible = s.visible
      const under = (m) => { for (let n = m; n; n = n.parent) if (n === s.node) return true; return false }
      for (const m of s.coll.filter(under)) { m.layers.enable(3); if (!pm.colliders.includes(m)) pm.colliders.push(m) }
      pm.phys?.setNodeEnabled(s.node, true)
      if (s.inst) { s.inst.stashed = false; pm._eventPhysicsResume(s.inst) }
    }
    vm.root.removeFromParent()
    vm.root.traverse((o) => o.userData?.ownMaterial && o.material?.dispose?.())
    this.vm = null
    if (pm.vp) pm.vp.vmView = null
  },

  /** Los slots se (re)crean a partir de la base de datos de la partida (game.db.player.slots). */
  _vmBuildSlots() {
    const pm = this.play
    const vm = this.vm, cfg = pm.game?.db?.player
    for (const s of vm.slots.values()) { s.anchor.removeFromParent() }
    vm.slots.clear()
    vm.visible = cfg ? cfg.vmVisible !== false : true
    for (const def of cfg?.slots || []) {
      const anchor = new THREE.Group()
      anchor.name = 'Slot:' + def.id
      vm.root.add(anchor)
      const slot = { id: def.id, label: def.label, anchor, def: null, items: [] }
      vm.slots.set(def.id, slot)
      this._vmPlace(slot, def)
      if (def.model) {
        const tpl = pm.ed.models.get(def.model)
        if (tpl) { const m = tpl.clone(true); slot.def = m; anchor.add(m); toVmLayer(m); m.traverse((o) => { o.castShadow = o.receiveShadow = false }) }
      }
    }
  },

  _vmPlace(slot, d) {
    slot.anchor.position.set(d.pos[0], d.pos[1], d.pos[2])
    slot.anchor.quaternion.setFromEuler(eul(d.rot))
    slot.anchor.scale.setScalar(d.scale)
  },

  /** Las luces de la escena también alumbran la capa del view model (el resto de la geometría no se dibuja dos veces). */
  _vmLights() {
    if (!this.vm) return
    const pm = this.play
    pm.vp.scene.traverse((o) => { if (o.isLight) o.layers.enable(VM_LAYER) })
  },

  /** Cada fotograma, DESPUÉS de colocar la cámara: el view model la sigue. */
  _vmFrame(dt) {
    const pm = this.play
    const vm = this.vm
    if (!vm) return
    const cam = pm.cam
    vm.root.position.copy(cam.position)
    vm.root.quaternion.copy(cam.quaternion)
    vm.root.visible = vm.visible && pm.hasPlayer !== false && !pm._tlFov // durante una cinemática con cámara propia no se ve
    vm.root.updateMatrixWorld(true)
    // Si se consume el último objeto desde el menú, su modelo tampoco debe quedarse flotando en la mano.
    for (const id of [...vm.held.keys()]) {
      const gp = pm._gpRecord?.(id)
      if (gp?.state.status === 'hand' && gp.state.inventory && gp.info?.kind === 'items'
        && !pm.game.party.has('items', gp.info.record.id)) {
        this.viewModelStash({ target: id })
        gp.state.status = 'consumed'
        gp.node.visible = false
        pm.game.rev++
        continue
      }
      const entry = pm.game?.state?.dbItems3D?.[id]
      if (entry?.status === 'hand' && !pm.game.party.has('items', entry.itemId)) {
        this.viewModelStash({ target: id })
        entry.status = 'consumed'
        pm.game.rev++
      }
    }
    const c = vm.cam
    if (c.fov !== cam.fov || c.aspect !== cam.aspect) { c.fov = cam.fov; c.aspect = cam.aspect; c.updateProjectionMatrix() }
    c.position.copy(cam.position); c.quaternion.copy(cam.quaternion); c.updateMatrixWorld(true)
    for (const [id, h] of vm.held) if (h.sensors) pm.phys?.syncSensors(h.node)
    let any = false
    for (const s of vm.slots.values()) if (s.def || s.items.length) { any = true; break }
    vm.view.active = any && vm.root.visible
  },

  // =================== utilidades ===================
  _vmSlot(key) {
    const pm = this.play
    const vm = this.vm
    if (!vm) throw new Error('El view model solo existe mientras se juega')
    const slots = pm.game?.db?.player?.slots || []
    const k = key === undefined || key === null || key === '' ? (slots.some((x) => x.id === 'right') ? 'right' : slots[0]?.id) : key
    const def = slotById(pm.game?.db?.player, k)
    const slot = def && vm.slots.get(def.id)
    if (!slot) {
      const names = [...vm.slots.keys()].join(', ') || '(ninguno: añade slots en Base de datos ▸ Jugador)'
      throw new Error(`El slot «${key}» no existe. Slots: ${names}`)
    }
    return slot
  },

  /** Nodo (objeto del proyecto) al que se refiere un comando o script: nombre, id, handle de game.node()/game.event(). */
  _vmTarget(target, eventId) {
    const pm = this.play
    const ref = target && typeof target === 'object' ? target.id ?? target.name : target
    const key = ref === undefined || ref === null || ref === '' ? eventId : ref
    if (key === undefined || key === null || key === '') throw new Error('Indica qué mover al view model (un nodo o un evento), o ejecútalo desde un evento')
    const o = pm._find(key)
    const node = o && pm.ed.nodes.get(o.id)
    if (!o || !node) throw new Error(`No existe el nodo «${key}»`)
    return { obj: o, node }
  },

  /** Cancela lo que mueva ese nodo (tweens de Mover nodo, rutas de movimiento) para que no pelee con el slot. */
  _vmFreeze(o, node) {
    const pm = this.play
    for (const t of pm.tweens.filter((m) => m.node === node)) t.r()
    pm.tweens = pm.tweens.filter((m) => m.node !== node)
    if (o.type === 'event') pm.routeStop?.('node', o.id, o.id)
  },

  // =================== mover al view model / soltar ===================
  _vmNative(name, h) {
    const g = this.play.game
    if (!g || !h) return
    const data = { objectId: h.id, objectName: h.obj.name, slot: h.slot }
    if (h.inst) data.eventId = h.inst.id
    if (g.db.player?.actorId) data.actorId = g.db.player.actorId
    g._nativeSignal(name, data)
  },
  /**
   * Cuelga un nodo de un slot. `pos`/`rot`/`scale` = ajuste respecto al slot (por defecto, justo en el anclaje).
   * Devuelve una promesa que termina cuando acaba la transición (`seconds`).
   */
  viewModelAttach({ target, eventId, slot, pos, rot, scale, seconds, emit = true } = {}) {
    const pm = this.play
    const sl = this._vmSlot(slot)
    const { obj, node } = this._vmTarget(target, eventId)
    const vm = this.vm
    this._vmFreeze(obj, node)
    let h = vm.held.get(obj.id)
    const wasHeld = !!h
    if (h) { // ya estaba en otro slot: pasa al nuevo sin perder cómo estaba en el mundo
      const prev = vm.slots.get(h.slot)
      if (prev) prev.items = prev.items.filter((i) => i !== h)
    } else {
      const inst = pm.events.find((e) => e.id === obj.id) || null
      if (inst) pm._eventPhysicsStop(inst)
      h = {
        id: obj.id, obj, node, inst, slot: sl.id,
        parent: node.parent, scale: node.scale.clone(), // en el mundo la raíz del nodo vale 1: el tamaño real está en su `visual`
        coll: pm.colliders.filter((m) => { for (let v = m; v; v = v.parent) if (v === node) return true; return false }),
        sensors: !!pm.phys?.hasSensors(node),
        layers: toVmLayer(node), tween: null, shadow: [],
      }
      node.traverse((m) => { if (m.isMesh) { h.shadow.push([m, m.castShadow]); m.castShadow = false } }) // el view model no proyecta sombras
      // sin choque con el jugador mientras está en la mano; las zonas de evento/trigger siguen al nodo (syncSensors en _vmFrame)
      for (const m of h.coll) { m.layers.disable(3); const i = pm.colliders.indexOf(m); if (i >= 0) pm.colliders.splice(i, 1) }
      pm.phys?.setNodeEnabled(node, false)
      if (inst) { inst.held = true; inst.inside = false; inst.gazeT = 0 }
      vm.held.set(obj.id, h)
    }
    h.slot = sl.id
    sl.items.push(h)
    sl.anchor.attach(node) // conserva dónde está en el mundo: la transición parte de ahí
    const toPos = arr3(pos, [0, 0, 0]), toQuat = new THREE.Quaternion().setFromEuler(eul(arr3(rot, [0, 0, 0])))
    const toScale = h.scale.clone().multiplyScalar(Number.isFinite(+scale) && +scale > 0 ? +scale : 1)
    return this._vmGlide(h, new THREE.Vector3(...toPos), toQuat, toScale, seconds ?? 0.25).then(() => {
      if (emit && !wasHeld && vm.held.get(obj.id) === h) this._vmNative('object.grabbed', h)
    })
  },

  _vmGlide(h, pos, quat, scale, seconds) {
    const pm = this.play
    const node = h.node
    h.tween?.r()
    pm.tweens = pm.tweens.filter((m) => m !== h.tween)
    if (!(seconds > 0)) {
      node.position.copy(pos); node.quaternion.copy(quat); node.scale.copy(scale)
      node.updateMatrixWorld(true)
      h.tween = null
      return Promise.resolve()
    }
    const p0 = node.position.clone(), q0 = node.quaternion.clone(), s0 = node.scale.clone()
    return new Promise((resolve) => {
      const tw = { node, t: 0, dur: seconds, r: resolve, fn: (k) => {
        const e = k * k * (3 - 2 * k)
        node.position.lerpVectors(p0, pos, e); node.quaternion.slerpQuaternions(q0, quat, e); node.scale.lerpVectors(s0, scale, e)
      } }
      h.tween = tw
      pm.tweens.push(tw)
    })
  },

  /** Posición segura delante de la cámara. Si hay una pared encima, no sacamos el objeto de la mano. */
  _vmFlightOrigin(obj, node, direction) {
    const pm = this.play
    const size = new THREE.Box3().setFromObject(node).getSize(new THREE.Vector3())
    const radius = Math.min(0.65, Math.max(0.15, size.length() * 0.25))
    const distance = Math.max(0.85, pm.body.radius + radius + 0.25)
    const hit = pm._raycast?.(pm.cam.position.toArray(), direction.toArray(), distance + radius, { ignore: [obj.id] })
    if (hit && hit.distance < distance + radius) return null
    return pm.cam.position.clone().addScaledVector(direction, distance)
  },

  /**
   * Saca un nodo del view model y lo devuelve al mundo. `at` = [x, y, z] del mundo; sin `at`, cae delante del jugador, en el suelo.
   * Con `upright` (por defecto) queda derecho, mirando hacia donde miraba el jugador.
   */
  viewModelRelease({ target, eventId, at, seconds, upright } = {}) {
    const pm = this.play
    const vm = this.vm
    if (!vm) throw new Error('El view model solo existe mientras se juega')
    const { obj, node } = this._vmTarget(target, eventId)
    const h = vm.held.get(obj.id)
    if (!h) return Promise.resolve() // no estaba en el view model: nada que soltar
    h.tween?.r()
    pm.tweens = pm.tweens.filter((m) => m !== h.tween)
    const dest = at ? arr3(at, null) : null
    if (at && !dest) throw new Error('«at» debe ser [x, y, z]')
    if (pm._gpRecord?.(obj.id)) {
      // El Gameplay Object cae con Jolt. No hay tween ni traslado artificial hasta el suelo.
      if (!pm.phys) return Promise.resolve(false)
      const start = dest ? new THREE.Vector3(...dest) : this._vmFlightOrigin(obj, node, pm.cam.getWorldDirection(new THREE.Vector3()))
      if (!start) return Promise.resolve(false)
      this._vmDrop(h.id, { keepWorld: true })
      node.position.copy(node.parent.worldToLocal(start))
      node.updateMatrixWorld(true)
      this._vmSettle(h)
      if (!pm._gpBody?.(obj.id)) return Promise.resolve(false)
      this._vmNative('object.dropped', h)
      pm.game?.emit('drop', { node: obj.name, slot: h.slot, thrown: false })
      return Promise.resolve(true)
    }
    let to = dest
    if (!to) {
      const fx = -Math.sin(pm.yaw), fz = -Math.cos(pm.yaw)
      const x = pm.pos.x + fx * 0.9, z = pm.pos.z + fz * 0.9
      const hit = pm._raycast([x, pm.pos.y + pm.body.eyeHeight, z], [0, -1, 0], pm.body.eyeHeight + 8)
      const g = hit ? hit.point[1] : pm.ed.groundAt(x, z)
      to = [x, Number.isFinite(g) ? g : pm.pos.y, z]
    }
    // de vuelta al mundo conservando la pose actual; lo que sigue es una transición hasta el destino
    this._vmDrop(h.id, { keepWorld: true })
    this._vmNative('object.dropped', h)
    pm.game?.emit('drop', { node: obj.name, slot: h.slot, thrown: false })
    const keepUpright = upright !== false
    const yaw = pm.yaw
    const w = new THREE.Quaternion()
    node.getWorldQuaternion(w)
    const toQuatW = keepUpright ? new THREE.Quaternion().setFromEuler(_e.set(0, yaw, 0, 'YXZ')) : w
    const parent = node.parent
    parent.updateMatrixWorld(true)
    const pq = new THREE.Quaternion(); parent.getWorldQuaternion(pq)
    const lq = pq.invert().multiply(toQuatW)
    let lp = parent.worldToLocal(_v.set(to[0], to[1], to[2]).clone())
    if (!dest) { // soltado en el suelo: se apoya por su base (un cubo con el origen en el centro no queda medio hundido)
      const p0 = node.position.clone(), q0 = node.quaternion.clone()
      node.position.copy(lp); node.quaternion.copy(lq); node.updateMatrixWorld(true)
      const box = new THREE.Box3().setFromObject(node)
      node.position.copy(p0); node.quaternion.copy(q0); node.updateMatrixWorld(true)
      const lift = to[1] - box.min.y
      if (Number.isFinite(lift) && lift > 0 && lift < 5) lp = parent.worldToLocal(_v.set(to[0], to[1] + lift, to[2]).clone())
    }
    const finish = () => {
      node.position.copy(lp); node.quaternion.copy(lq); node.updateMatrixWorld(true)
      this._vmSettle(h)
    }
    const dur = seconds ?? 0.35
    if (!(dur > 0)) { finish(); return Promise.resolve() }
    return new Promise((resolve) => {
      const p0 = node.position.clone(), q0 = node.quaternion.clone()
      const tw = { node, t: 0, dur, r: () => { if (h.tween === tw) { h.tween = null; finish() } resolve() }, fn: (k) => {
        const e = k * k * (3 - 2 * k)
        node.position.lerpVectors(p0, lp, e); node.quaternion.slerpQuaternions(q0, lq, e)
      } }
      h.tween = tw
      pm.tweens.push(tw)
    })
  },

  /** Saca el nodo del slot, lo devuelve a su padre del mundo y le restituye capas y tamaño. */
  _vmDrop(id, { keepWorld = false, discard = false } = {}) {
    const pm = this.play
    const vm = this.vm, h = vm.held.get(id)
    if (!h) return
    vm.held.delete(id)
    const sl = vm.slots.get(h.slot)
    if (sl) sl.items = sl.items.filter((i) => i !== h)
    fromVmLayer(h.layers)
    const parent = h.parent || pm.vp.scene
    if (keepWorld) parent.attach(h.node); else parent.add(h.node)
    h.node.scale.copy(h.scale)
    for (const [m, c] of h.shadow) m.castShadow = c
    if (discard) { if (h.inst) h.inst.held = false; return }
    // El Gameplay Object maneja su inventario al soltar; no lo hace la página de un evento.
    pm._gpDrop?.(id)
    // Si el objeto venía de Database, soltarlo también lo saca del inventario.
    const entry = pm.game?.state?.dbItems3D?.[id]
    if (entry?.status === 'hand') {
      pm.game.party.gain('items', entry.itemId, -1)
      entry.status = 'world'
      pm.game.rev++
    }
    h.node.updateMatrixWorld(true)
    if (h.inst) h.inst.held = false
    h.released = true
    h.pendingSettle = true
  },

  /** Al llegar al suelo: otra vez colisiones, zonas y sensores en su sitio nuevo. */
  _vmSettle(h) {
    const pm = this.play
    if (!h.pendingSettle) return
    h.pendingSettle = false
    const node = h.node
    node.updateMatrixWorld(true)
    const under = (m) => { for (let v = m; v; v = v.parent) if (v === node) return true; return false }
    h.coll = h.coll.filter(under) // páginas anteriores del evento ya no existen
    for (const m of h.coll) { m.layers.enable(3); if (!pm.colliders.includes(m)) pm.colliders.push(m) }
    pm.phys?.syncNode(node)
    pm.phys?.setNodeEnabled(node, true)
    pm._gpSettle?.(h.id)
    if (h.inst) {
      pm._eventPhysicsResume(h.inst)
      h.inst.inside = pm._zone(h.inst, pm.body.radius * 0.5)
    }
    pm.vp.requestRender()
  },

  /** Un evento en la mano cambia de página: el gráfico nuevo también se dibuja en la capa del view model y no choca. */
  _vmAdopt(inst, gfx) {
    const pm = this.play
    const h = this.vm?.held.get(inst.id)
    if (!h) return
    h.layers.push(...toVmLayer(gfx))
    gfx.traverse((m) => { if (m.isMesh) { h.shadow.push([m, m.castShadow]); m.castShadow = false } })
    for (const m of [...pm.colliders]) {
      let under = false
      for (let v = m; v; v = v.parent) if (v === gfx) { under = true; break }
      if (under) { h.coll.push(m); pm.colliders.splice(pm.colliders.indexOf(m), 1) }
    }
    pm.phys?.setNodeEnabled(inst.node, false)
  },

  /** Suelta todo lo que haya en un slot (o en todos). */
  viewModelClear(slot) {
    const vm = this.vm
    if (!vm) return Promise.resolve()
    const list = slot === undefined || slot === null || slot === '' ? [...vm.held.values()] : [...this._vmSlot(slot).items]
    return Promise.all(list.map((h) => this.viewModelRelease({ target: h.id })))
  },

  /** game.viewModel */
  /** ¿Qué hay en las manos? Condición «En la mano» y game.viewModel.isHeld/isEmpty. */
  viewModelHeld({ what = 'node', node, slot } = {}, eventId) {
    const vm = this.vm
    if (!vm) return what === 'slotEmpty' || what === 'none'
    const items = (key) => { const s = vm.slots.get(key); return s ? s.items.length : 0 }
    switch (what) {
      case 'slotFull': return items(slot || 'right') > 0
      case 'slotEmpty': return items(slot || 'right') === 0
      case 'any': return vm.held.size > 0
      case 'none': return vm.held.size === 0
      default: { try { const { obj } = this._vmTarget(node || undefined, eventId); const h = vm.held.get(obj.id); return !!h && (!slot || h.slot === slot) } catch { return false } }
    }
  },

  _vmApi() {
    const self = this, pm = this.play
    const slotHandle = (s) => Object.defineProperties({
      get id() { return s.id }, get label() { return s.label },
      get object3D() { return s.anchor },
      get position() { return s.anchor.position.toArray() }, set position(v) { const a = arr3(v, null); if (a) s.anchor.position.set(...a) },
      get rotation() { const e = new THREE.Euler().setFromQuaternion(s.anchor.quaternion, 'YXZ'); return [e.x / DEG, e.y / DEG, e.z / DEG] },
      set rotation(v) { const a = arr3(v, null); if (a) s.anchor.quaternion.setFromEuler(eul(a)) },
      get scale() { return s.anchor.scale.x }, set scale(v) { if (+v > 0) s.anchor.scale.setScalar(+v) },
      get items() { return s.items.map((h) => h.id) },
      /** slot.attach(objetivo?, { pos, rot, scale, seconds }) → Promise */
      attach: (target, opts = {}) => self.viewModelAttach({ ...opts, target, slot: s.id, eventId: pm.main?.ctx?.eventId }),
      clear: () => self.viewModelClear(s.id),
    }, Object.getOwnPropertyDescriptors(pm._animMethodsFor({ slotId: s.id })))
    return {
      get visible() { return self.vm ? self.vm.visible : false }, set visible(v) { if (self.vm) { self.vm.visible = !!v; pm.vp.requestRender() } },
      get slots() { return self.vm ? [...self.vm.slots.keys()] : [] },
      slot: (key) => slotHandle(self._vmSlot(key)),
      /** attach(objetivo?, { slot, pos, rot, scale, seconds }) — sin objetivo, el evento en curso */
      attach: (target, opts = {}) => self.viewModelAttach({ ...opts, target, eventId: pm.main?.ctx?.eventId }),
      release: (target, opts = {}) => self.viewModelRelease({ ...opts, target, eventId: pm.main?.ctx?.eventId }),
      /** throw(objetivo?, { speed (m/s), up }) — lo lanza hacia donde miras; la promesa se resuelve al detenerse. */
      throw: (target, opts = {}) => self.viewModelThrow({ ...opts, target, eventId: pm.main?.ctx?.eventId }),
      /** Los scripts anteriores pueden leer esto, pero ya no hay carga por pulsación mantenida. */
      get throwCharge() { return pm.state.throwCharge || 0 },
      /** ¿Está activo soltar/tirar con la acción «drop»? (también en Base de datos ▸ Jugador) */
      get dropEnabled() { const c = pm.game?.db?.player; return c ? c.dropEnabled !== false : true },
      set dropEnabled(v) { const c = pm.game?.db?.player; if (c) c.dropEnabled = !!v },
      clear: (slot) => self.viewModelClear(slot),
      /** stash(objetivo?, { slot }) — lo quita de la mano (o del mundo) y lo esconde; devuelve { id, name } para guardarlo en una variable. Sin objetivo: lo que haya en el slot (derecha por defecto). */
      stash: (target, opts = {}) => self.viewModelStash({ ...opts, target }),
      /** unstash(valor, { to: 'hand' | 'world', slot, at, pos, rot, scale, seconds }) → Promise<boolean> */
      unstash: (target, opts = {}) => self.viewModelUnstash({ ...opts, target }),
      isStashed: (target) => { try { return !!self.vm?.stash.has(self._vmTarget(target, undefined).obj.id) } catch { return false } },
      get stashed() { return self.viewModelStashed() },
      isHeld: (target, slot) => self.viewModelHeld({ what: 'node', node: target, slot }, pm.main?.ctx?.eventId),
      /** ¿Está vacío el slot (o, sin slot, todo el view model)? */
      isEmpty: (slot) => self.viewModelHeld({ what: slot ? 'slotEmpty' : 'none', slot }, pm.main?.ctx?.eventId),
      /** Qué hay en un slot: [{ id, name }] */
      heldIn: (slot) => (self.vm ? [...self.vm.held.values()].filter((h) => h.slot === slot).map((h) => ({ id: h.id, name: h.obj.name })) : []),
      get held() { return self.vm ? [...self.vm.held.values()].map((h) => ({ id: h.id, name: h.obj.name, slot: h.slot })) : [] },
    }
  },
}
Object.assign(handsMethods, stashMethods) // stashMethods: ./hands-stash.js
Object.assign(handsMethods, throwMethods) // throwMethods: ./hands-throw.js
