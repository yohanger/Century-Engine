// Manos · guardar en un slot («stash»): esconde un objeto de la mano y lo recupera después. Mixin de hands.js.
import { _q, _v } from './hands-util.js'

export const stashMethods = {
  // =================== guardar objetos (stash) ===================
  /**
   * Quita un nodo del mundo y de las manos sin destruirlo: queda oculto, sin colisiones ni disparadores, esperando a que
   * `viewModelUnstash` lo devuelva. Sin objetivo, guarda lo último que haya en el slot (por defecto la mano derecha).
   * Devuelve `{ id, name }` (un valor que cabe en una variable y vale como NodeLike) o `null` si no había nada.
   */
  viewModelStash({ target, slot } = {}) {
    const pm = this.play
    const vm = this.vm
    if (!vm) throw new Error('Guardar objetos solo funciona mientras se juega')
    const has = target !== undefined && target !== null && target !== ''
    let obj, node, h
    if (has) { ({ obj, node } = this._vmTarget(target)); h = vm.held.get(obj.id) }
    else {
      h = this._vmSlot(slot || 'right').items.at(-1)
      if (!h) return null
      ;({ obj, node } = h)
    }
    const ref = { id: obj.id, name: obj.name }
    if (vm.stash.has(obj.id)) return ref
    this._vmFreeze(obj, node)
    const inst = pm.events.find((e) => e.id === obj.id) || null
    if (inst) pm._eventPhysicsStop(inst)
    let coll
    if (h) { coll = h.coll; this._vmDrop(obj.id, { discard: true }) } // en la mano ya no choca ni proyecta sombras; se conserva lo que había que restituir
    else {
      coll = pm.colliders.filter((m) => { for (let v = m; v; v = v.parent) if (v === node) return true; return false })
      for (const m of coll) { m.layers.disable(3); const i = pm.colliders.indexOf(m); if (i >= 0) pm.colliders.splice(i, 1) }
      pm.phys?.setNodeEnabled(node, false)
    }
    vm.stash.set(obj.id, { id: obj.id, obj, node, inst, coll, visible: node.visible })
    node.visible = false
    if (inst) { inst.stashed = true; inst.inside = false; inst.gazeT = 0; inst.par?.cancel() }
    pm.vp.requestRender()
    return ref
  },

  /** Nodos guardados ahora: [{ id, name }]. */
  viewModelStashed() { return this.vm ? [...this.vm.stash.values()].map((s) => ({ id: s.id, name: s.obj.name })) : [] },

  /**
   * Devuelve un nodo guardado: `to` = 'hand' (a un slot; instantáneo salvo `seconds`) o 'world' (en `at` o delante del jugador).
   * La promesa vale `false` si ese nodo no estaba guardado (por ejemplo, una variable vacía).
   */
  async viewModelUnstash({ target, to = 'hand', slot, at, pos, rot, scale, seconds, upright } = {}) {
    const pm = this.play
    const vm = this.vm
    if (!vm) throw new Error('Guardar objetos solo funciona mientras se juega')
    if (target === undefined || target === null || target === '' || target === 0) return false
    let obj
    try { ({ obj } = this._vmTarget(target)) } catch { return false }
    const s = vm.stash.get(obj.id)
    if (!s) return false
    vm.stash.delete(obj.id)
    s.node.visible = s.visible
    // Tras un cambio de página no devolvemos colliders del gráfico que ya se retiró.
    const under = (m) => { for (let n = m; n; n = n.parent) if (n === s.node) return true; return false }
    s.coll = s.coll.filter(under)
    if (s.inst?.gfx && ['static', 'kinematic'].includes(s.inst.physicsProfile?.type) && !s.inst.gfxColl.length) {
      pm._addColliders(s.inst.gfx, s.inst.gfxColl)
      for (const m of s.inst.gfxColl) { if (!pm.colliders.includes(m)) pm.colliders.push(m); s.coll.push(m) }
      if (s.inst.physicsProfile.type === 'kinematic') pm.phys?.makeKinematic(s.inst.gfx)
    }
    for (const m of s.coll) { m.layers.enable(3); if (!pm.colliders.includes(m)) pm.colliders.push(m) }
    pm.phys?.setNodeEnabled(s.node, true)
    if (s.inst) s.inst.stashed = false
    const inHand = to !== 'world'
    await this.viewModelAttach({ target: obj.id, slot: slot || 'right', pos, rot, scale, seconds: inHand ? seconds ?? 0 : 0 })
    if (!inHand) await this.viewModelRelease({ target: obj.id, at, upright })
    return true
  },

  /** Un evento guardado cambia de página: el gráfico nuevo tampoco choca hasta que vuelva. */
  _vmStashAdopt(inst, gfx) {
    const pm = this.play
    const st = this.vm?.stash.get(inst.id)
    if (!st) return
    for (const m of [...pm.colliders]) {
      let under = false
      for (let v = m; v; v = v.parent) if (v === gfx) { under = true; break }
      if (under) { m.layers.disable(3); st.coll.push(m); pm.colliders.splice(pm.colliders.indexOf(m), 1) }
    }
    pm.phys?.setNodeEnabled(inst.node, false)
  },
}
