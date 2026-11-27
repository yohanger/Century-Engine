// Objetos que sobreviven al cambio de escena durante una misma partida.
// No forman parte de los datos guardados de la escena de destino.

/** Incluye los descendientes, aunque el hijo no tenga activada la casilla. */
export function persistentIds(objects, marked) {
  const ids = new Set(), byParent = new Map()
  for (const o of objects) {
    if (!byParent.has(o.parentId)) byParent.set(o.parentId, [])
    byParent.get(o.parentId).push(o)
  }
  const visit = (id) => {
    if (ids.has(id)) return
    ids.add(id)
    for (const c of byParent.get(id) || []) visit(c.id)
  }
  for (const o of objects) if (marked(o)) visit(o.id)
  return ids
}

/** La escena entrante no puede crear otro objeto con la identidad de uno vivo. */
export function overlayPersistent(sceneObjects, retained) {
  const ids = new Set(retained.map((x) => x.id))
  return [...sceneObjects.filter((o) => !ids.has(o.id)), ...retained]
}

/** Retira solamente los objetos insertados por el runtime; no borra los originales. */
export function withoutInjected(objects, injected) {
  return injected?.size ? objects.filter((o) => !injected.has(o.id)) : objects
}

export const persistentMethods = {
  _persistMarked(o) { return this._persistOverrides?.has(o.id) ? this._persistOverrides.get(o.id) : o.dontDestroyOnLoad === true },

  /** Para scripts/eventos: game.dontDestroyOnLoad('Música', true|false). */
  _persistSet(name, enabled = true) {
    const o = this._find(name)
    if (!o) return false
    this._persistOverrides ??= new Map()
    this._persistOverrides.set(o.id, !!enabled)
    return true
  },

  _persistBeforeScene() {
    const objects = this.project.objects || []
    const ids = persistentIds(objects, (o) => this._persistMarked(o))
    const previous = this._persistObjects || new Map()
    const saved = new Map()
    const physics = new Map()
    const eventState = new Map()
    const gameplay = new Map()
    for (const o of objects) {
      if (!ids.has(o.id)) continue
      // Conservar la misma referencia del objeto y su instancia 3D.
      saved.set(o.id, previous.get(o.id) || o)
      const ev = this.events?.find((e) => e.id === o.id)
      if (ev) eventState.set(o.id, { erased: ev.erased, off: ev.off })
      const gp = this._gpObjects?.get(o.id)
      if (gp) gameplay.set(o.id, gp.state)
      const body = this._bodies?.find((b) => b.id === o.id)
      if (body && this.phys?.bodies) {
        try { physics.set(o.id, { velocity: this.phys.bodies.velocityOf(body.item), angularVelocity: this.phys.bodies.angularVelocityOf(body.item), config: {
          mass: body.mass, density: body.density, friction: body.friction, bounce: body.bounce,
          drag: body.drag, current: body.current, shape: body.shape, float: body.floats,
        } }) } catch { /* El mundo físico puede haberse detenido. */ }
      }
    }
    this._persistObjects = saved
    this._persistPhysics = physics
    this._persistEventStates = eventState
    this._persistGameplayStates = gameplay
    this.ed._persistRetainIds = ids
    // Los objetos introducidos en una escena anterior no pertenecen a su archivo.
    this._persistRemoveInjected()
  },

  _persistRemoveInjected() {
    const ids = this._persistInjected
    if (ids?.size) this.project.objects = [
      ...withoutInjected(this.project.objects, ids),
      ...(this._persistBackup?.values() || []),
    ]
    this._persistInjected = new Set()
    this._persistBackup = new Map()
  },

  _persistAfterScene() {
    const saved = [...(this._persistObjects?.values() || [])]
    if (!saved.length) { this.ed._persistRetainIds = null; return }
    this._persistBackup = new Map((this.project.objects || []).filter((o) => this._persistObjects.has(o.id)).map((o) => [o.id, o]))
    this.project.objects = overlayPersistent(this.project.objects || [], saved)
    this._persistInjected = new Set(saved.map((o) => o.id))
    this.ed.restoreRetainedNodes(saved)
    this.ed._persistRetainIds = null
  },

  _persistPhysicsResume() {
    for (const [id, saved] of this._persistPhysics || []) {
      const body = this._bodies?.find((b) => b.id === id)
      if (body) {
        try {
          body.handle.setVelocity(saved.velocity)
          this.phys.bodies.setAngularVelocity(body.item, saved.angularVelocity)
        } catch { /* Mundo sin Jolt. */ }
      } else if (this.phys) {
        try { this._bodyAdd(id, { ...saved.config, vel: saved.velocity, angularVel: saved.angularVelocity }) } catch (e) { console.warn('Cuerpo persistente', e) }
      }
    }
    this._persistPhysics = new Map()
  },

  _persistEnd() {
    this._persistRemoveInjected()
    this.ed._persistRetainIds = null
    this.ed.discardRetainedNodes?.()
    this._persistObjects?.clear()
    this._persistOverrides?.clear()
    this._persistPhysics?.clear()
    this._persistEventStates?.clear()
    this._persistGameplayStates?.clear()
  },
}
