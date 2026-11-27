// Implementación de cada comando de evento (el `code` coincide con commandDefs.js). Se ejecutan con `this` = la partida (`Game`, interpreter.js).
import { EventError } from './event-error.js'
import { showVal, parseLiteral, parseList } from './vars.js'
import { normalizeAnim } from '../ui/anim.js'
import { matchCaseKey, matchCaseValue, matchEquals } from './match.js'

const BREAK = 'break', EXIT = 'exit'

/** Presentación de Database: un clip que falte no anula una acción que ya se aplicó. */
async function presentDatabaseAction(host, record, eventId, waitForAnimation = false) {
  const warn = (kind, error) => console.warn(`${kind} de «${record.name}»: ${error?.message || error}`)
  let done
  if (record.actionAnimation && eventId && host.animationPlay) {
    try {
      const handle = host.animationPlay(eventId, record.actionAnimation, { loop: false })
      if (waitForAnimation) done = handle?.done
      else Promise.resolve(handle?.done).catch((error) => warn('Animación', error))
    } catch (error) { warn('Animación', error) }
  }
  if (record.actionSound && host.audio?.play) {
    try {
      const handle = host.audio.play(record.actionSound, { group: 'sfx', volume: 1, pitch: 1, loop: false, ui: true })
      // El audio continúa por su cuenta. Una carga fallida no debe detener el evento.
      Promise.resolve(handle?.done).catch((error) => warn('Sonido', error))
    } catch (error) { warn('Sonido', error) }
  }
  if (done) {
    try { await done } catch (error) { warn('Animación', error) }
  }
}


export const cmp = (op, a, b) => {
  switch (op) {
    case '>=': return a >= b
    case '>': return a > b
    case '==': return a === b
    case '<=': return a <= b
    case '<': return a < b
    case '!=': return a !== b
    default: return false
  }
}

export const applyOp = (op, cur, v) => {
  if (op === 'set') return v
  if (op === 'add' && (typeof cur !== 'number' || typeof v !== 'number')) {
    if (Array.isArray(cur)) return [...cur, ...(Array.isArray(v) ? v : [v])] // lista += valor: añade
    if (typeof cur === 'string' || typeof v === 'string') return showVal(cur === 0 && typeof v === 'string' ? '' : cur) + showVal(v) // texto += texto: concatena
  }
  cur = Number.isFinite(+cur) ? +cur : 0; v = Number.isFinite(+v) ? +v : 0
  switch (op) {
    case 'set': return v
    case 'add': return cur + v
    case 'sub': return cur - v
    case 'mul': return cur * v
    case 'div': return v === 0 ? cur : cur / v
    case 'mod': return v === 0 ? cur : cur % v
    default: return cur
  }
}

/** Ranura elegida en un comando de guardado. */
export const saveSlotOf = (g, p) => (p.slotSrc === 'variable' ? Math.round(+g.getVar(p.slotVar) || 0) : p.slotSrc === 'last' ? 'last' : p.slotSrc === 'auto' ? 'auto' : Math.round(+p.slot || 0))
const toggle = (mode, cur) => (mode === 'toggle' ? !cur : mode === 'on')

// ---------- implementación de cada comando (el `code` coincide con commandDefs.js) ----------
export const EXEC = {
  async text(p, cmd, ctx) {
    const r = this.localize({ text: p.text, speaker: p.speaker, voice: p.voice, key: p.loc })
    await this.host.say?.({ speaker: this.plain(r.speaker, ctx), text: this.fmt(r.text, ctx), pos: p.pos, voice: r.voice, voiceAdvance: p.voiceAdvance !== false, voiceGroup: p.voiceGroup || 'voice', anim: normalizeAnim({ enter: p.enter, exit: p.exit, duration: p.animTime }) })
  },
  async choices(p, cmd, ctx) {
    const idx = (await this.host.choose?.({ options: (p.options || []).map((o) => this.plain(o, ctx)), cancel: p.cancel ?? -1, prompt: this.plain(p.prompt, ctx), anim: normalizeAnim({ enter: p.enter, exit: p.exit, duration: p.animTime }) })) ?? -1
    const blocks = cmd.b || {}
    if (idx >= 0 && blocks['c' + idx]) return await this.runList(blocks['c' + idx], ctx)
  },
  async wait(p) { await this.host.wait?.(+p.seconds || 0) },
  async waitInput(p) { if (p.action) await this.host.inputWait?.(p.action) },
  async inputAction(p) { const a = p.action; if (!a) return; const t = String(p.key || '').trim(); this.host.inputOp?.(p.op, a, p.op === 'rebind' ? (t ? [t] : []) : t) },
  async if(p, cmd, ctx) {
    const ok = this.evalIf(p, ctx)
    const blk = ok ? cmd.b?.then : cmd.b?.else
    if (blk) return await this.runList(blk, ctx)
  },
  async match(p, cmd, ctx) {
    // El valor se lee una sola vez; ninguna rama posterior cambia la selección.
    const value = p.src === 'variable' ? this.getVar(p.variable)
      : p.src === 'number' ? Number(p.value)
        : p.src === 'text' ? String(p.text ?? '')
          : p.src === 'bool' ? p.flag !== false
            : p.src === 'signal' ? this.signalValue(ctx, p.signalField)
              : p.src === 'script' ? this.evalExpr(p.expr, ctx) : undefined
    const branch = (Array.isArray(p.cases) ? p.cases : []).find((c) => c && matchEquals(value, matchCaseValue(c, (id) => this.getVar(id))))
    const key = branch ? matchCaseKey(branch) : p.hasDefault ? 'default' : null
    if (key && cmd.b?.[key]) return await this.runList(cmd.b[key], ctx)
  },
  async loop(p, cmd, ctx) {
    for (let guard = 0; ; guard++) {
      if (guard > 1e6) throw new EventError('Bucle sin fin', 'loop')
      const r = await this.runList(cmd.b?.body, ctx)
      if (r === BREAK) return
      if (r === EXIT) return EXIT
      await (this.host.frame ? this.host.frame() : Promise.resolve()) // cede el control: un bucle sin esperas no congela el juego
    }
  },
  break() { return BREAK },
  exit() { return EXIT },
  comment() {},
  switch(p) { this.setSw(p.id, toggle(p.value, this.getSw(p.id))) },
  variable(p, cmd, ctx) {
    const rnd = () => Math.floor(Math.random() * (Math.max(+p.max, +p.min) - Math.min(+p.max, +p.min) + 1)) + Math.min(+p.max, +p.min)
    const v = p.src === 'signal' ? this.signalValue(ctx, p.signalField)
      : p.src === 'variable' ? this.getVar(p.id2)
      : p.src === 'random' ? rnd()
        : p.src === 'script' ? this.evalExpr(p.expr, ctx)
          : p.src === 'text' ? this.fmt(String(p.text ?? ''), ctx)
            : p.src === 'list' ? parseList(p.list)
              : p.src === 'bool' ? p.flag !== false
                : +p.value || 0
    this.setVar(p.id, applyOp(p.op, this.getVar(p.id), v))
  },
  async saveGame(p, cmd, ctx) {
    const ok = await this.saves.save(saveSlotOf(this, p), { name: p.name ? this.plain(p.name, ctx) : undefined })
    if (p.ok) this.setSw(p.ok, ok)
  },
  /** «Emitir señal». */
  async signal(p, cmd, ctx) {
    const data = p.dataSrc === 'variable' ? this.getVar(p.dataVar) : p.dataSrc === 'text' ? this.fmt(String(p.text ?? ''), ctx) : p.dataSrc === 'number' ? +p.value || 0 : p.dataSrc === 'received' ? ctx?.signal?.data : undefined
    const run = this.signal(p.name, data)
    if (p.wait) await run; else run.catch((e) => this.report(e, 'Emitir señal'))
  },
  async waitSignal(p, cmd, ctx) {
    if (!String(p.name ?? '').trim()) throw new EventError('Escribe el nombre de la señal', 'waitSignal')
    const result = await this.waitSignalResult(p.name, +p.timeout || 0, ctx)
    if (ctx.cancelled || result.status === 'cancelled') return
    if (p.out) this.setVar(p.out, result.status === 'received' ? (result.data === undefined ? 0 : result.data) : 0)
    if (p.okSw) this.setSw(p.okSw, result.status === 'received')
    if (p.flow !== true) return // comandos guardados antes de este Gate: sin ramas
    const block = result.status === 'received' ? cmd.b?.received : cmd.b?.timeout
    if (!block) return
    const previousSignal = ctx.signal, previousArgs = ctx.args
    if (result.status === 'received') {
      ctx.signal = { name: p.name, data: result.data }
      ctx.args = [result.data, ...previousArgs]
    }
    try { return await this.runList(block, ctx) }
    finally { ctx.signal = previousSignal; ctx.args = previousArgs }
  },
  /** «Ejecutar evento»: corre las páginas de otro evento (la activa o la elegida). */
  async runEvent(p, cmd, ctx) {
    const h = p.node ? this.host.findEvent?.(p.node) : null
    if (!h) throw new EventError(`No existe el evento «${p.node}»`, 'runEvent')
    const run = h.run({ page: +p.page || 0 })
    if (p.wait) await run
  },
  async loadGame(p) {
    const ok = await this.saves.load(saveSlotOf(this, p))
    if (p.ok) this.setSw(p.ok, ok)
    if (ok) return EXIT // la partida cargada sustituye a lo que estaba pasando: este evento ya no continúa
  },
  deleteSave(p) { this.saves.delete(saveSlotOf(this, p)) },
  saveAccess(p) { this.saves.access = toggle(p.value, this.saves.access) },
  async saveScreen(p) {
    const name = p.ui || this.db.player?.saveUi
    if (!name) throw new EventError('Elige la interfaz de guardado (en el comando o en Base de datos ▸ Jugador ▸ Guardado)', 'saveScreen')
    const done = this.host.ui?.open(name, { mode: p.mode === 'load' ? 'load' : 'save', slots: this.saves.list() }, {})
    if (p.wait !== false) await done
  },
  /** «Variable: lista»: operaciones de lista sobre una variable (estilo $gameVariables con arrays). */
  variableArray(p, cmd, ctx) {
    const index = p.idxSrc === 'variable' ? this.getVar(p.idxVar) : +p.index || 0
    const value = p.valSrc === 'variable' ? this.getVar(p.valVar) : p.valSrc === 'text' ? this.fmt(String(p.text ?? ''), ctx) : p.valSrc === 'literal' ? parseLiteral(p.literal) : +p.value || 0
    const r = this.varArray(p.id, p.op, { index, value, sep: p.sep ?? ', ' })
    if (p.out) this.setVar(p.out, r)
  },
  selfSwitch(p, cmd, ctx) { this.setSelf(ctx.eventId, p.ch, toggle(p.value, this.getSelf(ctx.eventId, p.ch))) },
  control(p) { this.host.setControl?.(p.mode ?? (p.enabled === false ? 'locked' : 'free')) },
  async teleport(p) {
    const yaw = p.yaw === '' || p.yaw == null || Number.isNaN(+p.yaw) ? undefined : +p.yaw
    await this.host.teleport?.({ mode: p.mode, node: p.node, pos: p.pos, yaw })
  },
  async scene(p) {
    const yaw = p.yaw === '' || p.yaw == null || Number.isNaN(+p.yaw) ? undefined : +p.yaw
    const n = (v, d) => (v === '' || v == null || Number.isNaN(+v) ? d : +v)
    await this.host.gotoScene?.({ scene: p.scene, tag: p.tag || 'player', pos: p.where === 'pos' ? p.pos : undefined, yaw, fadeOut: p.fadeOut === undefined ? undefined : n(p.fadeOut, 0), fadeIn: p.fadeIn === undefined ? undefined : n(p.fadeIn, 0), color: p.color })
  },
  // «Mover al view model»: sin nodo indicado se mueve el propio evento (ctx.eventId)
  async viewModel(p, cmd, ctx) {
    const done = this.host.viewModelAttach?.({ target: p.node || undefined, eventId: ctx.eventId, slot: p.slot || 'right', pos: p.pos, rot: p.rot, scale: +p.scale || 1, seconds: p.seconds === '' || p.seconds == null ? undefined : +p.seconds })
    if (p.wait) await done
  },
  async viewModelRelease(p, cmd, ctx) {
    let done
    if (p.what === 'all') done = this.host.viewModelClear?.()
    else if (p.what === 'slot') done = this.host.viewModelClear?.(p.slot || 'right')
    else if (p.how === 'throw') done = this.host.viewModelThrow?.({ target: p.node || undefined, eventId: ctx.eventId, speed: +p.speed || 8 })
    else done = this.host.viewModelRelease?.({ target: p.node || undefined, eventId: ctx.eventId, at: p.where === 'pos' ? p.pos : undefined, seconds: p.seconds === '' || p.seconds == null ? undefined : +p.seconds })
    if (p.wait) await done
  },
  /** «Guardar objeto en variable»: lo de la mano (o un nodo) desaparece y su referencia queda en una variable. */
  async stashItem(p) {
    if (p.what === 'node' && !p.node) throw new EventError('Elige el nodo que guardar', 'stashItem')
    const ref = this.host.viewModelStash?.(p.what === 'node' ? { target: p.node } : { slot: p.slot || 'right' }) ?? null
    if (p.out) this.setVar(p.out, ref || 0)
    if (p.okSw) this.setSw(p.okSw, !!ref)
  },
  /** «Sacar objeto guardado»: lo devuelve a la mano o al mundo. */
  async unstashItem(p) {
    const target = p.src === 'node' ? p.node : this.getVar(p.var)
    const ok = !!(await this.host.viewModelUnstash?.({ target, to: p.to, slot: p.slot || 'right', at: p.to === 'world' && p.where === 'pos' ? p.pos : undefined }))
    if (ok && p.src !== 'node' && p.clear !== false) this.setVar(p.var, 0)
    if (p.okSw) this.setSw(p.okSw, ok)
  },
  async fade(p) { await this.host.fade?.({ dir: p.dir, seconds: +p.seconds || 0, color: p.color }) },
  async levelName(p, cmd, ctx) { this.host.levelName?.(p.text ? this.fmt(String(p.text), ctx) : '', p.pos ? { position: p.pos } : {}) },
  async caption(p, cmd, ctx) { const h = this.host.caption?.({ text: this.fmt(String(p.text ?? ''), ctx), seconds: +p.seconds || 3, pos: p.pos || 'bottom', anim: normalizeAnim({ enter: p.enter, exit: p.exit, duration: p.animTime }) }); if (p.wait && h) await h },
  letterbox(p) { this.host.letterbox?.(Math.min(25, Math.max(0, +p.percent || 0))) },
  async sound(p) {
    const a = this.host.audio; if (!a) return
    const h = a.play(p.clip, { group: p.group || 'sfx', volume: +p.volume, pitch: +p.pitch, loop: !!p.loop, fx: p.fx, ui: true })
    if (p.wait && !p.loop) await h.done
  },
  soundStop(p) { this.host.audio?.stopAll(p.group || null, +p.fade || 0) },
  async audioGroup(p) {
    const a = this.host.audio; if (!a) return
    if (p.mute !== 'keep') a.mute(p.group, p.mute === 'on')
    if (p.volume !== '' && p.volume != null) { if (+p.seconds > 0) { const f = a.fade(p.group, +p.volume, +p.seconds); if (p.wait) await f } else a.setVolume(p.group, +p.volume) }
  },
  gold(p) { const P = this.party; P.addGold(p.op === 'sub' ? -p.n : p.op === 'set' ? p.n - P.gold : +p.n) },
  async items(p) {
    const P = this.party, key = { items: 'item', weapons: 'weapon', armors: 'armor' }[p.kind], ref = p[key], r = P.need(p.kind, ref)
    const amount = p.nsrc === 'variable' ? Math.round(+this.getVar(p.nvar) || 0) : Math.round(+p.n || 0)
    let n
    if (p.op === 'set') { const before = P.count(p.kind, r.id); P.setCount(p.kind, r.id, amount); n = P.count(p.kind, r.id) - before }
    else if (p.op === 'all') { n = -P.count(p.kind, r.id); P.setCount(p.kind, r.id, 0) }
    else { n = p.op === 'add' ? amount : -amount; P.gain(p.kind, r.id, n) }
    if (p.msg && n) await this.host.say?.({ speaker: '', text: this.fmt(P.fmt(P.term(n > 0 ? 'gainItem' : 'loseItem'), { name: `\\I[${key}:${r.id}]${r.name}`, n: Math.abs(n) })), pos: 'bottom' })
  },
  /** «Vaciar inventario»: quita todos los objetos / armas / armaduras (o solo un tipo). */
  clearItems(p) { this.party.clearInventory(p.kind === 'all' || !p.kind ? undefined : p.kind) },
  party(p) { if (p.action === 'join') this.party.join(p.actor); else this.party.leave(p.actor) },
  actorStat(p) {
    const P = this.party
    for (const b of p.actor ? [P.battler(p.actor)] : P.partyBattlers) {
      const m = p.stat === 'hp' ? b.mhp : b.mmp
      b[p.stat] = p.op === 'full' ? m : b[p.stat] + (p.op === 'add' ? +p.n : -p.n)
    }
  },
  async level(p) {
    const P = this.party, a = P.need1(p.actor)
    const res = p.what === 'level' ? P.setLevel(a, p.op === 'set' ? +p.n : a.level + (p.op === 'add' ? +p.n : -p.n)) : P.gainExp(a, p.op === 'sub' ? -p.n : +p.n)
    for (const id of res.learned || []) this.host.partyChanged?.('skill')
  },
  equip(p) { this.party.equip(p.actor, +p.slot, p.item || 0) },
  /** El arma sigue siendo equipo de Party; el evento 3D solo representa su modelo en la mano. */
  async weapon3D(p, cmd, ctx) {
    const P = this.party, actor = P.need1(p.actor), action = p.action || 'equip'
    if (action === 'use') {
      const target = p.targetType === 'enemy' ? { enemy: p.targetEnemy } : p.targetType === 'actor' ? p.targetActor : p.target
      const result = P.weaponAction(actor.id, target || undefined)
      if (p.msg) await this.host.say?.({ speaker: '', text: this.fmt(result.text), pos: 'bottom' })
      if (result.ok) {
        const activeModel = Object.entries(this.state.dbWeapons3D || {}).find(([, st]) => st.actorId === actor.id && st.status === 'hand')?.[0]
        const weapon = P.need('weapons', actor.equips[0])
        await presentDatabaseAction(this.host, weapon, activeModel)
        await P.runEvents(result)
      }
      return result
    }
    const all = (this.state.dbWeapons3D ||= {})
    const active = Object.entries(all).find(([, st]) => st.actorId === actor.id && st.status === 'hand')
    if (action === 'unequip') {
      if (active && this.host.databaseWeaponOfEvent?.(active[0]) && !this.host.viewModelStash?.({ target: active[0] })) throw new EventError('No se pudo guardar el modelo del arma', 'weapon3D')
      P.equip(actor.id, 1, 0)
      if (active) all[active[0]].status = 'stored'
      this.rev++
      return { ok: true, weaponId: 0, status: 'stored' }
    }
    if (action !== 'equip') throw new EventError(`Acción de arma no válida: ${action}`, 'weapon3D')
    const ref = p.node || ctx?.eventId
    if (!ref) throw new EventError('Indica el evento del arma 3D', 'weapon3D')
    const world = this.host.databaseWeaponOfEvent?.(ref)
    if (!world?.id || !world.weaponId) throw new EventError(`El evento «${ref}» necesita un gráfico Arma de Database`, 'weapon3D')
    const weapon = P.need('weapons', world.weaponId)
    if (+weapon.etype !== 1) throw new EventError(`«${weapon.name}» no corresponde a la ranura de arma`, 'weapon3D')
    if (actor.equips[0] !== weapon.id && !P.has('weapons', weapon.id)) throw new EventError(`No tienes «${weapon.name}»`, 'weapon3D')
    const saved = all[world.id]
    if (saved && saved.actorId !== actor.id) throw new EventError(`El modelo «${weapon.name}» ya pertenece a otro personaje`, 'weapon3D')
    if (!this.host.viewModelAttach) throw new EventError('Este jugador no tiene View Model', 'weapon3D')
    const slot = p.slot || 'right'
    if (saved?.status === 'stored') {
      const ok = await this.host.viewModelUnstash?.({ target: world.id, to: 'hand', slot, seconds: 0 })
      if (!ok) throw new EventError(`No se pudo sacar el modelo de «${weapon.name}»`, 'weapon3D')
    } else await this.host.viewModelAttach({ target: world.id, slot, seconds: 0 })
    // Si llevaba otra arma, se guarda su modelo y Party devuelve el arma antigua al inventario.
    if (active && active[0] !== world.id && this.host.databaseWeaponOfEvent?.(active[0])) {
      const hidden = this.host.viewModelStash?.({ target: active[0] })
      if (!hidden) throw new EventError('No se pudo guardar el modelo del arma anterior', 'weapon3D')
    }
    if (actor.equips[0] !== weapon.id) P.equip(actor.id, 1, weapon.id)
    if (active && active[0] !== world.id) all[active[0]].status = 'stored'
    all[world.id] = { actorId: actor.id, weaponId: weapon.id, status: 'hand', slot }
    this.rev++
    return { ok: true, weaponId: weapon.id, status: 'hand' }
  },
  skill(p) {
    const a = this.party.need1(p.actor), id = this.party.need('skills', p.skill).id
    if (p.action === 'learn') { if (!a.skills.includes(id)) a.skills.push(id) } else a.skills = a.skills.filter((s) => s !== id)
    this.party.ctx.changed?.('party')
  },
  state(p) { const P = this.party; for (const b of p.actor ? [P.battler(p.actor)] : P.partyBattlers) { if (p.action === 'add') P.addState(b, p.state); else P.removeState(b, p.state) } },
  recoverAll() { this.party.recoverAll() },
  /** Objeto 3D: el inventario es la cantidad real; el View Model solo muestra dónde está el nodo. */
  async item3D(p, cmd, ctx) {
    const ref = p.node || ctx.eventId
    if (!ref) throw new EventError('Indica el evento del objeto 3D', 'item3D')
    const world = this.host.databaseItemOfEvent?.(ref)
    if (!world?.id) throw new EventError(`No existe el evento del objeto «${ref}»`, 'item3D')
    const all = (this.state.dbItems3D ||= {})
    const saved = all[world.id]
    const action = p.action || 'pickup'
    const itemId = action === 'pickup' ? (+p.item || world.itemId) : saved?.itemId
    const item = this.party.need('items', itemId)
    const status = saved?.status || 'world'
    if (action === 'pickup') {
      if (status !== 'world') throw new EventError(`«${item.name}» ya fue recogido`, 'item3D')
      if (this.party.count('items', item.id) >= (+this.db.system.maxItems || 99)) throw new EventError(`No cabe otro «${item.name}» en el inventario`, 'item3D')
      if (!this.host.viewModelAttach) throw new EventError('Este jugador no tiene View Model', 'item3D')
      await this.host.viewModelAttach({ target: world.id, slot: p.slot || 'right', seconds: 0 })
      this.party.gain('items', item.id, 1)
      all[world.id] = { itemId: item.id, status: 'hand' }
      this._nativeSignal('item.picked_up', { eventId: world.id, objectId: world.id, objectName: world.name || item.name,
        actorId: this.db.player?.actorId || this.party.members[0], kind: 'items', itemId: item.id })
    } else if (action === 'use' || action === 'store') {
      if (status !== 'hand' || !this.host.viewModelHeld?.({ what: 'node', node: world.id })) throw new EventError(`«${item.name}» no está en la mano`, 'item3D')
      if (action === 'use') {
        const result = this.party.useItem(item.id, p.target || undefined, null, 'event')
        if (!result.ok) return result
        // Un consumible espera solo su animación para que el modelo no desaparezca antes.
        // Sin clip configurado, se guarda inmediatamente como en S02.
        await presentDatabaseAction(this.host, item, world.id, item.consumable !== false)
        if (item.consumable !== false) {
          const hidden = this.host.viewModelStash?.({ target: world.id })
          if (!hidden) throw new EventError(`No se pudo guardar el modelo de «${item.name}»`, 'item3D')
          all[world.id] = { itemId: item.id, status: 'consumed' }
        }
        if (p.msg) await this.host.say?.({ speaker: '', text: this.fmt(result.text), pos: 'bottom' })
        await this.party.runEvents(result)
        return result
      }
      if (!this.host.viewModelStash?.({ target: world.id })) throw new EventError(`No se pudo guardar «${item.name}»`, 'item3D')
      all[world.id] = { itemId: item.id, status: 'stored' }
    } else if (action === 'take') {
      if (status !== 'stored' || !this.party.has('items', item.id)) throw new EventError(`«${item.name}» no está guardado en el inventario`, 'item3D')
      const ok = await this.host.viewModelUnstash?.({ target: world.id, to: 'hand', slot: p.slot || 'right', seconds: 0 })
      if (!ok) throw new EventError(`No se pudo sacar «${item.name}» a la mano`, 'item3D')
      all[world.id] = { itemId: item.id, status: 'hand' }
    } else throw new EventError(`Acción de objeto 3D no válida: ${action}`, 'item3D')
    this.rev++
    return { ok: true, itemId: item.id, status: all[world.id].status }
  },
  async useItem(p) { const r = this.party.useItem(p.item, p.target || undefined, null, 'event'); if (p.msg) await this.host.say?.({ speaker: '', text: this.fmt(r.text), pos: 'bottom' }); await this.party.runEvents(r) },
  async useSkill(p) { const r = this.party.useSkill(p.skill, p.user, p.target || undefined); if (p.msg) await this.host.say?.({ speaker: '', text: this.fmt(r.text), pos: 'bottom' }); await this.party.runEvents(r) },
  nameActor(p) { const a = this.party.need1(p.actor); if (p.name) a.name = p.name; if (p.nickname) a.nickname = p.nickname; this.party.ctx.changed?.('party') },
  async commonEvent(p) { await this.callCommon(p.id) },
  async timeline(p) {
    const done = this.host.timelinePlay?.(p.timeline, { speed: +p.speed || 1, from: +p.from || 0 })
    if (p.wait !== false) await done
  },
  timelineStop(p) { if (p.skip) this.host.timelineSkip?.(p.timeline || undefined); else this.host.timelineStop?.(p.timeline || undefined) },
  cameraControl(p, cmd, ctx) {
    const action = p.action || 'activate'
    if (!['activate', 'change', 'release'].includes(action)) throw new EventError('Acción de cámara desconocida', 'cameraControl')
    if (action !== 'release' && !p.node) throw new EventError('Selecciona una Camera3D', 'cameraControl')
    if (action === 'release' && !['keep', 'base', 'camera3d', 'previous', 'player', 'pose'].includes(p.to || 'keep')) throw new EventError('Salida de cámara no válida', 'cameraControl')
    if (action === 'release' && p.to === 'camera3d' && !p.cameraId) throw new EventError('Selecciona Camera3D destino', 'cameraControl')
    const seconds = p.seconds == null ? 0 : Number(p.seconds)
    if (!Number.isFinite(seconds) || seconds < 0 || !['linear', 'inOut'].includes(p.ease || 'inOut')) throw new EventError('Transición de cámara no válida', 'cameraControl')
    const ok = this.host.cameraEvent?.({ action, id: p.node, to: p.to || 'keep', cameraId: p.cameraId, seconds, ease: p.ease || 'inOut', eventId: ctx?.eventId, cameraOwner: ctx?.cameraOwner })
    if (!ok) throw new EventError('No se pudo controlar la cámara: fuente no disponible, conflicto de autoridad o evento sin solicitud propia', 'cameraControl')
  },
  async journal(p) {
    const P = this.party; let t = ''
    if (p.kind === 'quest') { const q = P.setQuest(p.quest, p.qa, (+p.obj || 1) - 1); t = `\\C[6]${q.name}\\C[0]: ${{ start: 'misión nueva', objective: 'objetivo cumplido', complete: 'misión completada', fail: 'misión fallida', reset: '' }[p.qa]}` }
    else { P.collect(p.lore, p.la === 'collect'); if (p.la === 'collect') t = `Nuevo documento: \\C[6]${P.need('lore', p.lore).name}\\C[0]` }
    if (p.msg && t) await this.host.say?.({ speaker: '', text: this.fmt(t), pos: 'top' })
  },
  async playAnimation(p, cmd, ctx) {
    const h = this.host.animationPlay?.(p.node || undefined, p.clip, { loop: p.loop === 'yes' ? true : p.loop === 'no' ? false : undefined, speed: +p.speed || 1, fade: +p.fade || 0, from: +p.from || 0, layer: p.layer || '', weight: p.weight === undefined || p.weight === '' ? 1 : +p.weight, mask: p.mask || '' }, ctx.eventId)
    if (p.wait && h) await h.done
  },
  stopAnimation(p, cmd, ctx) { this.host.animationStop?.(p.node || undefined, p.clip || undefined, { reset: !!p.reset, layer: p.layer || undefined }, ctx.eventId) },
  async light(p) {
    const list = p.tag ? this.api.lights(p.tag) : [this.api.node(p.node)?.light].filter(Boolean)
    if (!list.length) throw new Error(p.tag ? `No hay luces con la etiqueta «${p.tag}»` : 'La luz no existe (o el nodo no es una luz)')
    const s = Math.max(0, +p.seconds || 0), jobs = []
    for (const L of list) {
      const to = {}
      if (p.setColor) to.color = p.color
      if (p.setEnergy) to.energy = +p.energy
      if (p.setRange) to.range = +p.range
      const st = p.state === 'toggle' ? (L.on ? 'off' : 'on') : p.state
      if (st === 'on') jobs.push(L.turnOn(s, to))
      else if (st === 'off') { if (to.color) L.color = to.color; if (to.range != null) L.range = to.range; jobs.push(L.turnOff(s)) }
      else if (Object.keys(to).length) jobs.push(L.fadeTo(to, s))
    }
    if (p.wait) await Promise.all(jobs)
  },
  nodeVisible(p) { this.host.nodeVisible?.(p.node, !!p.visible) },
  nodePersist(p, cmd, ctx) { this.host.nodePersist?.(p.node || ctx?.eventId, p.enabled !== false) },
  async weather(p) {
    const w = this.host.world; if (!w) return
    w.setWeather(p.preset || 'clear', p.intensity ?? 1, +p.seconds || 0)
    if (p.wait && +p.seconds > 0) await this.host.wait?.(+p.seconds)
  },
  weatherLightning(p) {
    // Usa el rayo real del mundo. El trueno lo programa una clave independiente del Timeline.
    const distance = Math.max(30, Math.min(8000, Number(p.distance) || 1200))
    const bearing = Math.max(0, Math.min(360, Number(p.bearing) || 0))
    this.host.world?.strike(distance, bearing, false)
  },
  weatherThunder(p) {
    // La misma acústica y regiones que el clima del Player; no se añade reproductor paralelo.
    const distance = Math.max(30, Math.min(8000, Number(p.distance) || 1200))
    const bearing = Math.max(0, Math.min(360, Number(p.bearing) || 0))
    const world = this.host.world
    const e = { distance, bearing, delay: 0, peak: world?.cfg?.weather?.peakKA || 25 }
    const info = this.host.weatherSound?.thunder(e)
    this.host.game?.emit('thunder', info ? { ...e, ...info } : e)
  },
  async profile(p) {
    const pf = this.host.profile; if (!pf) return
    if (p.profile) pf.set(p.profile, +p.seconds || 0); else pf.clear(+p.seconds || 0)
    if (p.wait && +p.seconds > 0) await this.host.wait?.(+p.seconds)
  },
  async clock(p) {
    const w = this.host.world; if (!w) return
    if (p.action === 'set') { w.setHour(+p.hour || 0, +p.seconds || 0); if (p.wait && +p.seconds > 0) await this.host.wait?.(+p.seconds) }
    else if (p.action === 'advance') { w.setHour((w.hour + (+p.hours || 0)) % 24, +p.seconds || 0); if (p.wait && +p.seconds > 0) await this.host.wait?.(+p.seconds) }
    else if (p.action === 'flow') w.setFlow(true, +p.dayMinutes || undefined)
    else if (p.action === 'stop') w.setFlow(false)
  },
  async nodeMove(p) {
    const done = this.host.nodeMove?.(p.node, { rel: !!p.rel, pos: p.pos, seconds: +p.seconds || 0 })
    if (p.wait) await done
  },
  async ui(p) {
    const ui = this.host.ui
    if (!ui) return
    if (/Canvas$/.test(p.action)) {
      if (!p.canvas) throw new EventError('Elige el nodo Canvas', 'ui')
      ui[p.action](p.canvas); return
    }
    const name = p.ui
    if (p.action === 'close') { ui.close(name); return }
    if (p.action === 'toggle' && ui.isOpen(name)) { ui.close(name); return }
    let props = {}
    try { props = p.props ? JSON.parse(p.props) : {} } catch { throw new EventError(`Datos no válidos (JSON): ${p.props}`, 'ui') }
    const done = ui.open(name, props, p.modal === 'yes' ? { modal: true } : p.modal === 'no' ? { modal: false } : {})
    if (p.wait && p.action === 'open') await done
  },
  async moveRoute(p, cmd, ctx) {
    const done = this.host.moveRoute?.({ target: p.target, node: p.node, route: p.route || { list: [] }, eventId: ctx.eventId })
    if (p.wait && !p.route?.repeat) await done
  },
  erase(p, cmd, ctx) { this.host.eraseEvent?.(ctx.eventId) },
  async script(p, cmd, ctx) { await this._fn('code', p.code || '', ctx)(this.api, ctx.eventHandle, ctx.args) },
  async callFn(p) {
    let args = []
    try { args = p.args ? JSON.parse(p.args) : [] } catch { throw new EventError(`Argumentos no válidos (JSON): ${p.args}`, 'callFn') }
    await this.call(p.name, ...(Array.isArray(args) ? args : [args]))
  },
}

export const EXEC_CODES = Object.keys(EXEC)
