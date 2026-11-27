// Gameplay Object reutiliza Database, View Model y Jolt. No conoce páginas ni ejecuta comandos de evento.
import * as THREE from 'three'
import { gameplayRecord, gameplayProfile, gameplayState, gameplayNext } from '../gameplay/object-state.js'

const _p = new THREE.Vector3(), _dir = new THREE.Vector3()

export const gameplayObjectMethods = {
  _gpInitScene() {
    const scene = this.project.activeSceneId
    this._gpObjects = new Map()
    for (const obj of this.project.objects) {
      if (obj.type !== 'gameplayObject') continue
      const node = this.ed.nodes.get(obj.id)
      if (!node) continue
      const info = gameplayRecord(obj, this.game.db)
      const kept = this._persistGameplayStates?.get(obj.id)
      const state = kept || gameplayState(this.game.state, scene, obj)
      if (kept) (this.game.state.gameplayObjects[scene] ||= {})[obj.id] = kept
      const profile = gameplayProfile(obj, this.game.db)
      if (state.status === 'world' && Array.isArray(state.position)) {
        node.position.fromArray(state.position)
        if (Array.isArray(state.rotation) && state.rotation.length === 4) node.quaternion.fromArray(state.rotation)
        node.updateMatrixWorld(true)
      }
      this._gpObjects.set(obj.id, { obj, node, info, state, profile, busy: false })
      // El estado guardado manda sobre la posición inicial del editor, no sobre la configuración de Database.
      if (state.status === 'consumed') node.visible = false
    }
  },

  _gpRecord(obj) { return this._gpObjects?.get(obj?.id ?? obj) || null },
  _gpProfile(obj) { return this._gpRecord(obj)?.profile || null },
  _gpBody(obj) { return this._bodies?.find((b) => b.id === (obj?.id ?? obj))?.handle || null },

  _gpBodiesInit() {
    for (const g of this._gpObjects?.values() || []) {
      if (!g.info?.record?.model || g.state.status !== 'world' || !this._nodeEnabled(g.obj)) continue
      if ((g.profile?.type === 'dynamic' || g.state.flight) && this.phys) {
        try { this._gpCreateBody(g) } catch (e) { this.game?.report(e, g.obj.name) }
      }
    }
  },
  _gpCreateBody(g) {
    if (!this.phys || !g || (g.profile?.type !== 'dynamic' && !g.state.flight) || this._gpBody(g.obj.id)) return null
    const p = g.profile || {}
    // La caída usa Jolt aunque Database diga Static. Ese valor no se cambia.
    const body = this._bodyAdd(g.obj.id, { shape: p.shape || 'box', mass: p.mass ?? 1,
      friction: p.friction ?? 0.6, bounce: p.bounce ?? 0.15,
      vel: g.state.velocity || undefined, angularVel: g.state.angularVelocity || undefined })
    if (body) { g.state.velocity = null; g.state.angularVelocity = null }
    return body
  },

  /** Termina la caída únicamente después de que Jolt haya dormido el cuerpo. */
  _gpRest(id, body, awake) {
    const g = this._gpRecord(id)
    if (!g?.state.flight || g.state.status !== 'world' || awake || body.age < 0.1 || body.item.inWater) return
    g.state.position = g.node.position.toArray()
    g.state.rotation = g.node.quaternion.toArray()
    g.state.flight = false
    g.state.velocity = null
    g.state.angularVelocity = null
    if (g.profile?.type === 'dynamic') return // Dynamic sigue siendo Dynamic, solo está dormido.
    this._gpRemoveBody(g)
    const restored = g.profile?.type
    if (restored === 'static' || restored === 'kinematic') {
      // Un objeto cargado directamente en la mano quizá no tenía collider al montar la escena.
      const hasCollider = this.colliders.some((m) => { for (let v = m; v; v = v.parent) if (v === g.node) return true; return false })
      if (!hasCollider) this._addColliders(g.node, this.colliders)
      if (restored === 'kinematic') this.phys?.makeKinematic(g.node)
      this.phys?.setNodeEnabled(g.node, true)
      this.phys?.syncNode(g.node)
    } else this.phys?.setNodeEnabled(g.node, false) // None vuelve a no tener colisión.
  },

  _gpReady() {
    if (!this.vm) return // Aparición diferida: la mano se restaura después de Spawn Player.
    // Reponer la mano y los objetos guardados sin emitir nuevas señales al entrar o cargar una escena.
    for (const g of this._gpObjects?.values() || []) {
      if (g.state.status === 'stored') {
        // Stash anterior puede seguir oculto tras destruir al jugador y
        // volver a crearlo: conservar la visibilidad autoral al rehidratarlo.
        g.node.visible = g.obj.visible !== false
        this.viewModelStash({ target: g.obj.id })
      } else if (g.state.status === 'hand') {
        void this.viewModelAttach({ target: g.obj.id, slot: g.state.slot, seconds: 0, emit: false })
          .catch((e) => this.game?.report(e, g.obj.name))
      }
    }
  },

  _gpCandidate(extraReach = 0) {
    if (!this.hasPlayer || this.main || !this.control || !this.vm) return null
    const eye = this.cam.position
    let result = null, best = Infinity
    for (const g of this._gpObjects?.values() || []) {
      if (!g.info?.record?.model || g.busy || g.state.status !== 'world' || !g.node.visible) continue
      const point = g.node.getWorldPosition(_p)
      const dist = eye.distanceTo(point)
      if (dist < 0.05) continue // El volumen puede ser una caja grande o estar desplazado respecto al modelo.
      if (dist >= best || !this._inIndicatorZone?.(g, 'key')) continue
      // En pantalla puede estar en un borde; lo importante es que siga viéndose.
      if (!this._indicatorScreen?.(g)) continue
      // No se puede coger un objeto que queda detrás de una pared sólida.
      const hit = this._raycast?.(eye.toArray(), point.clone().sub(eye).normalize().toArray(), dist - 0.08,
        { ignore: [g.obj.id] })
      if (hit && hit.distance < dist - 0.12) continue
      result = g; best = dist
    }
    return result ? { item: result, distance: best } : null
  },

  async _gpPickup(id) {
    const g = this._gpRecord(id), P = this.game?.party
    if (!g || !g.info?.record?.model || g.busy || g.state.status !== 'world' || !this.vm) return false
    const { kind, record } = g.info, inventory = g.obj.props.mode !== 'direct'
    const actor = this.game.db.player?.actorId || P.members[0]
    if (inventory && P.count(kind, record.id) >= (+this.game.db.system.maxItems || 99)) return false
    if (kind === 'weapons' && inventory && (!actor || +record.etype !== 1)) return false
    const sl = g.obj.props.slot || 'right'
    if (this.vm.slots.get(sl)?.items.length) return false // Primero soltar o guardar lo que ya ocupa esa mano.
    g.busy = true
    try {
      this._gpRemoveBody(g)
      await this.viewModelAttach({ target: g.obj.id, slot: sl, seconds: 0, emit: false })
      if (inventory) P.gain(kind, record.id, 1)
      if (kind === 'weapons' && inventory) P.equip(actor, 1, record.id)
      g.state.status = 'hand'; g.state.inventory = inventory; g.state.slot = sl
      g.state.flight = false; g.state.velocity = null; g.state.angularVelocity = null
      this.game.rev++
      const held = this.vm.held.get(g.obj.id)
      if (held) this.player._vmNative('object.grabbed', held)
      this.game._nativeSignal('item.picked_up', { objectId: g.obj.id, objectName: g.obj.name,
        itemId: record.id, kind, actorId: actor || 0, slot: sl })
      return true
    } catch (err) {
      this.game?.report(err, g.obj.name)
      // Una operación fallida no debe dejar un objeto invisible pero registrado como disponible.
      if (this.vm?.held.has(g.obj.id)) this.player._vmDrop(g.obj.id, { discard: true })
      this._gpCreateBody(g)
      return false
    } finally { g.busy = false }
  },

  _gpRemoveBody(g) {
    const body = this._bodies?.find((b) => b.id === g.obj.id)
    if (body) this._bodyRemove(body)
  },

  _gpDrop(id) {
    const g = this._gpRecord(id)
    if (!g || g.state.status !== 'hand') return
    const { kind, record } = g.info || {}
    if (g.state.inventory && record) {
      if (kind === 'weapons') {
        const actor = this.game.db.player?.actorId || this.game.party.members[0]
        if (actor && this.game.party.actor(actor)?.equips[0] === record.id) this.game.party.equip(actor, 1, 0)
      }
      this.game.party.gain(kind, record.id, -1)
    }
    g.state.status = 'world'; g.state.inventory = false
    g.state.flight = true; g.state.velocity = null; g.state.angularVelocity = null
    this.game.rev++
  },

  _gpSettle(id) {
    const g = this._gpRecord(id)
    if (!g || g.state.status !== 'world') return
    g.node.updateMatrixWorld(true)
    g.state.position = g.node.position.toArray()
    g.state.rotation = g.node.quaternion.toArray()
    try { this._gpCreateBody(g) } catch (e) { this.game?.report(e, g.obj.name) }
  },

  async _gpStore(id) {
    const g = this._gpRecord(id)
    if (!g?.info || g.busy || !gameplayNext(g.state.status, 'store')) return false
    const { kind, record } = g.info
    if (!g.state.inventory && this.game.party.count(kind, record.id) >= (+this.game.db.system.maxItems || 99)) return false
    g.busy = true
    try {
      if (!this.viewModelStash({ target: id })) return false
      // Guardar un arma equipada devuelve la unidad a inventario; no se duplica.
      if (kind === 'weapons') {
        const actor = this.game.db.player?.actorId || this.game.party.members[0]
        if (actor && this.game.party.actor(actor)?.equips[0] === record.id) this.game.party.equip(actor, 1, 0)
        else if (!g.state.inventory) this.game.party.gain(kind, record.id, 1)
      } else if (!g.state.inventory) this.game.party.gain(kind, record.id, 1)
      g.state.status = 'stored'; g.state.inventory = true
      this.game.rev++
      return true
    } catch (e) { this.game.report(e, g.obj.name); return false } finally { g.busy = false }
  },

  async _gpDraw(id) {
    const g = this._gpRecord(id)
    if (!g?.info || g.busy || !gameplayNext(g.state.status, 'draw')) return false
    if (!this.game.party.has(g.info.kind, g.info.record.id)) return false
    if (this.vm.slots.get(g.state.slot)?.items.length) return false
    g.busy = true
    try {
      const ok = await this.viewModelUnstash({ target: id, to: 'hand', slot: g.state.slot, seconds: 0 })
      if (ok) {
        if (g.info.kind === 'weapons') {
          const actor = this.game.db.player?.actorId || this.game.party.members[0]
          if (actor) this.game.party.equip(actor, 1, g.info.record.id)
        }
        g.state.status = 'hand'; this.game.rev++
      }
      return !!ok
    } catch (e) { this.game.report(e, g.obj.name); return false } finally { g.busy = false }
  },

  async _gpUse(id) {
    const g = this._gpRecord(id), P = this.game?.party
    if (!g?.info || g.busy || !['hand', 'stored'].includes(g.state.status)) return false
    const { kind, record } = g.info
    if (kind === 'weapons') {
      const actor = this.game.db.player?.actorId || P.members[0]
      if (!actor || P.actor(actor)?.equips[0] !== record.id) return false
      // Una acción contra un enemigo requiere objetivo explícito; no se daña al jugador por error.
      const skill = P.rec('skills', record.actionSkill)
      const enemyId = Number(g.obj.props.targetEnemy)
      if (skill?.scope === 'enemy' && (!Number.isSafeInteger(enemyId) || enemyId <= 0)) return false
      const target = skill?.scope === 'enemy' ? { enemy: enemyId } : undefined
      const result = P.weaponAction(actor, target)
      if (!result.ok) return false
      await P.runEvents(result)
      return true
    }
    if (!g.state.inventory) return false // Un objeto directo no se consume hasta guardarse en inventario.
    const result = P.useItem(record.id, undefined, null, 'event')
    if (!result.ok) return false
    await P.runEvents(result)
    if (record.consumable && P.count('items', record.id) === 0) {
      g.state.status = 'consumed'
      this.viewModelStash({ target: id })
      g.node.visible = false
      this.game.rev++
    }
    return true
  },

  _gpCapture() {
    for (const g of this._gpObjects?.values() || []) {
      if (g.state.status !== 'world') continue
      g.state.position = g.node.position.toArray()
      g.state.rotation = g.node.quaternion.toArray()
      const body = this._bodies?.find((b) => b.id === g.obj.id)
      g.state.velocity = body && this.phys?.bodies ? this.phys.bodies.velocityOf(body.item) : [0, 0, 0]
      g.state.angularVelocity = body && this.phys?.bodies ? this.phys.bodies.angularVelocityOf(body.item) : [0, 0, 0]
    }
  },

  _gpRestore() {
    this._gpInitScene()
    for (const g of this._gpObjects.values()) {
      this._gpRemoveBody(g)
      if (g.state.status === 'world') {
        const stashed = this.vm?.stash.get(g.obj.id)
        if (stashed) {
          this.vm.stash.delete(g.obj.id)
          for (const m of stashed.coll || []) {
            m.layers.enable(3)
            if (!this.colliders.includes(m)) this.colliders.push(m)
          }
        }
        g.node.visible = true
        this.phys?.setNodeEnabled(g.node, !g.state.flight && g.profile?.type !== 'none')
        this.phys?.syncNode(g.node)
        if (!g.state.flight && (g.profile?.type === 'static' || g.profile?.type === 'kinematic')) {
          const hasCollider = this.colliders.some((m) => { for (let v = m; v; v = v.parent) if (v === g.node) return true; return false })
          if (!hasCollider) this._addColliders(g.node, this.colliders)
          if (g.profile.type === 'kinematic') this.phys?.makeKinematic(g.node)
        }
        this._gpCreateBody(g)
      }
      else if (g.state.status === 'consumed') g.node.visible = false
    }
    this._gpReady()
  },

  _gpActionInput() {
    if (!this.on || !this.input || !this.vm || this.main || !this.control) return
    const held = [...this.vm.held.keys()].find((id) => this._gpRecord(id))
    if (this.input.justPressed('gp_use') && held) void this._gpUse(held)
    if (this.input.justPressed('gp_store') && held) void this._gpStore(held)
    if (this.input.justPressed('gp_draw')) {
      const stored = [...(this._gpObjects?.values() || [])].find((g) => g.state.status === 'stored')
      if (stored) void this._gpDraw(stored.obj.id)
    }
  },
}
