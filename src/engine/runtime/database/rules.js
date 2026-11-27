// Reglas del juego (estilo MZ, sin combate por turnos): grupo, inventario, parámetros, rasgos, fórmulas de daño, estados,
// niveles, equipo y diario de misiones. Sin DOM: lo usa el intérprete (game.party) y las pruebas.
import { PARAMS } from './schema.js'
import { evaluateFormula } from './formula.js'

const KEYS = PARAMS.map(([k]) => k)
const clampI = (v, a, b) => Math.max(a, Math.min(b, Math.round(v)))
const SLOT_KINDS = (i) => (i === 0 ? 'weapons' : 'armors') // la primera ranura de equipo es de armas

export class Party {
  /** @param db base de datos normalizada · @param ctx { getVar(n), callCommon(id), changed(kind), log(msg) } */
  constructor(db, ctx = {}) {
    this.db = db; this.ctx = ctx
    this.reset()
  }
  reset() {
    const s = this.db.system || {}
    this.gold = +s.startGold || 0
    this.inv = { items: {}, weapons: {}, armors: {} }
    this.actors = {}   // id → estado del personaje (se crea al unirse)
    this.enemies = {}  // id de instancia → estado independiente del enemigo
    this.nextEnemyId = 1
    this.members = []  // ids en orden
    this.journal = { quests: {}, lore: {} }
    for (const m of s.party || []) if (m.actor) this.join(m.actor, { silent: true })
  }

  // ---------- registros ----------
  rec(kind, x) {
    const list = this.db[kind] || []
    if (x && typeof x === 'object') return x
    if (typeof x === 'number' || /^\d+$/.test(String(x))) return list.find((r) => r.id === +x) || null
    const q = String(x ?? '').trim().toLowerCase()
    return list.find((r) => (r.name || '').toLowerCase() === q) || null
  }
  need(kind, x) { const r = this.rec(kind, x); if (!r) throw new Error(`No existe «${x}» en la base de datos (${kind})`); return r }
  term(k) { return this.db.system?.terms?.[k] ?? k }
  fmt(t, vars = {}) { return String(t ?? '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? (k === 'currency' ? this.db.system?.currency ?? '' : `{${k}}`))) }

  // ---------- inventario ----------
  _invSignal(kind, r, before, after) {
    if (before === after) return
    const delta = after - before
    this.ctx.nativeSignal?.(delta > 0 ? 'inventory.item_added' : 'inventory.item_removed',
      { kind, itemId: r.id, before, after, delta })
  }
  count(kind, x) { const r = this.rec(kind, x); return r ? this.inv[kind][r.id] || 0 : 0 }
  has(kind, x, n = 1) { return this.count(kind, x) >= n }
  gain(kind, x, n = 1) {
    const r = this.need(kind, x), max = this.db.system?.maxItems || 99
    const before = this.inv[kind][r.id] || 0
    const now = clampI(before + n, 0, max)
    if (now) this.inv[kind][r.id] = now; else delete this.inv[kind][r.id]
    this.ctx.changed?.('inventory')
    this._invSignal(kind, r, before, now)
    return now
  }
  /** Fija la cantidad exacta (0 = quitarlo del inventario). Devuelve la cantidad resultante. */
  setCount(kind, x, n = 0) {
    const r = this.need(kind, x), max = this.db.system?.maxItems || 99, now = clampI(n, 0, max)
    const before = this.inv[kind][r.id] || 0
    if (now) this.inv[kind][r.id] = now; else delete this.inv[kind][r.id]
    this.ctx.changed?.('inventory')
    this._invSignal(kind, r, before, now)
    return now
  }
  set(kind, x, n) { return this.setCount(kind, x, n) }
  /** Quita todo lo que hay de ese tipo (o de todo el inventario sin argumento). */
  clearInventory(kind) {
    const removed = []
    for (const k of kind ? [kind] : ['items', 'weapons', 'armors']) {
      const previous = this.inv[k]
      this.inv[k] = {}
      for (const [id, amount] of Object.entries(previous || {})) {
        const r = this.rec(k, +id)
        if (r && amount > 0) removed.push([k, r, amount])
      }
    }
    this.ctx.changed?.('inventory')
    for (const [k, r, amount] of removed) this._invSignal(k, r, amount, 0)
  }
  /** Lista del inventario: [{ kind, id, name, count }]. */
  list(kind) {
    const out = []
    for (const k of kind ? [kind] : ['items', 'weapons', 'armors']) for (const [id, n] of Object.entries(this.inv[k] || {})) { const r = this.rec(k, +id); if (r && n > 0) out.push({ kind: k, id: +id, name: r.name, count: n }) }
    return out
  }
  addGold(n) { this.gold = Math.max(0, this.gold + Math.round(n)); this.ctx.changed?.('gold'); return this.gold }

  // ---------- personajes ----------
  join(x, { silent = false } = {}) {
    const r = this.need('actors', x)
    if (!this.actors[r.id]) {
      const a = { id: r.id, name: r.name, nickname: r.nickname || '', classId: r.classId, level: r.level || 1, exp: 0, hp: 0, mp: 0, equips: [], skills: [], states: [], grown: {}, extraTraits: [] }
      this.actors[r.id] = a
      this.db.system.equipTypes.forEach((_, i) => a.equips.push((r.equips || [])[i] || 0))
      a.exp = this.expFor(a, a.level)
      this._learnByLevel(a)
      a.hp = this.param(a, 'mhp'); a.mp = this.param(a, 'mmp')
    }
    if (!this.members.includes(r.id)) this.members.push(r.id)
    if (!silent) this.ctx.changed?.('party')
    return this.battler(r.id)
  }
  leave(x) { const r = this.need('actors', x); this.members = this.members.filter((i) => i !== r.id); this.ctx.changed?.('party') }
  actor(x) {
    const r = this.rec('actors', x), a = r && this.actors[r.id]
    return a || null
  }
  /** Objeto «batiente» que ven las fórmulas y los scripts (con getters). Acepta id, nombre, estado o { enemy: id }. */
  battler(x) {
    if (x && x._isBattler) return x
    if (x && typeof x === 'object' && x.enemyInstance !== undefined) return this.enemyInstance(x.enemyInstance)
    if (x && typeof x === 'object' && x.enemy !== undefined) return this.enemy(x.enemy)
    const a = x && typeof x === 'object' && x.classId !== undefined ? x : this.actor(x)
    if (!a) throw new Error(`«${x}» no está en el grupo (usa game.party.join)`)
    return this._wrap(a)
  }
  _wrap(a) {
    const P = this, o = { _isBattler: true, _a: a, isEnemy: false }
    for (const k of KEYS) Object.defineProperty(o, k, { get: () => P.param(a, k), enumerable: true })
    for (const k of ['name', 'nickname', 'level', 'exp', 'id', 'classId']) Object.defineProperty(o, k, { get: () => a[k], set: (v) => { a[k] = v }, enumerable: true })
    Object.defineProperties(o, {
      hp: { get: () => a.hp, set: (v) => { a.hp = clampI(v, 0, P.param(a, 'mhp')); P.ctx.changed?.('party') }, enumerable: true },
      mp: { get: () => a.mp, set: (v) => { a.mp = clampI(v, 0, P.param(a, 'mmp')); P.ctx.changed?.('party') }, enumerable: true },
      skills: { get: () => P.skillIds(a) }, states: { get: () => a.states.map((s) => s.id) }, alive: { get: () => a.hp > 0 },
    })
    return o
  }
  /** Referencia antigua { enemy: id }: una instancia persistente predeterminada por tipo. */
  enemy(x) {
    const r = this.need('enemies', x), key = `legacy:${r.id}`
    if (!this.enemies[key]) this.enemies[key] = this._enemyState(r, key)
    return this._wrapEnemy(this.enemies[key])
  }
  _enemyState(r, instanceId) {
    return { id: r.id, instanceId, name: r.name, hp: r.mhp, mp: r.mmp, states: [], enemy: true }
  }
  /** Crea una instancia independiente y devuelve un battler con instanceId estable. */
  spawnEnemy(x) {
    const r = this.need('enemies', x), key = `enemy:${this.nextEnemyId++}`
    this.enemies[key] = this._enemyState(r, key)
    this.ctx.changed?.('party')
    return this._wrapEnemy(this.enemies[key])
  }
  /** Recupera una instancia ya creada; nunca la recrea silenciosamente. */
  enemyInstance(instanceId) {
    const key = String(instanceId), st = Object.hasOwn(this.enemies, key) ? this.enemies[key] : null
    if (!st) throw new Error(`No existe la instancia de enemigo «${key}»`)
    return this._wrapEnemy(st)
  }
  /** Elimina solamente la instancia indicada. */
  removeEnemy(instanceId) {
    const key = String(instanceId)
    if (!Object.hasOwn(this.enemies, key)) return false
    delete this.enemies[key]
    this.ctx.changed?.('party')
    return true
  }
  _wrapEnemy(st) {
    const r = this.need('enemies', st.id)
    const o = { _isBattler: true, _e: st, isEnemy: true, id: st.id, level: 1 }
    for (const k of KEYS) o[k] = r[k]
    Object.defineProperties(o, {
      instanceId: { get: () => st.instanceId, enumerable: true },
      name: { get: () => st.name, enumerable: true },
      hp: { get: () => st.hp, set: (v) => { st.hp = clampI(v, 0, r.mhp); this.ctx.changed?.('party') }, enumerable: true },
      mp: { get: () => st.mp, set: (v) => { st.mp = clampI(v, 0, r.mmp); this.ctx.changed?.('party') }, enumerable: true },
      states: { get: () => st.states.map((s) => s.id) }, alive: { get: () => st.hp > 0 }, record: { value: r },
    })
    return o
  }
  get partyBattlers() { return this.members.map((id) => this.battler(id)) }

  // ---------- parámetros y rasgos ----------
  traitsOf(a) {
    const out = [], cls = this.rec('classes', a.classId), r = this.rec('actors', a.id)
    out.push(...(r?.traits || []), ...(cls?.traits || []), ...a.extraTraits)
    for (const id of a.equips) { if (!id) continue }
    a.equips.forEach((id, i) => { if (id) out.push(...(this.rec(SLOT_KINDS(i), id)?.traits || [])) })
    for (const s of a.states) out.push(...(this.rec('states', s.id)?.traits || []))
    return out
  }
  param(a, k) {
    const cls = this.rec('classes', a.classId) || {}
    let v = (+cls[k + 'Base'] || 0) + (+cls[k + 'Grow'] || 0) * (a.level - 1) + (a.grown[k] || 0)
    a.equips.forEach((id, i) => { if (id) v += +this.rec(SLOT_KINDS(i), id)?.[k] || 0 })
    let rate = 100
    for (const t of this.traitsOf(a)) { if (t.param !== k) continue; if (t.code === 'paramPlus') v += +t.value || 0; else if (t.code === 'paramRate') rate += (+t.value || 100) - 100 }
    return Math.max(k === 'mhp' ? 1 : 0, Math.round((v * rate) / 100))
  }
  elementRate(b, element) {
    if (!element) return 100
    if (b.isEnemy) { const t = (b.record.traits || []).filter((x) => x.code === 'elementRate' && +x.element === +element); return t.reduce((r, x) => (r * (+x.value || 0)) / 100, 100) }
    return this.traitsOf(b._a).filter((t) => t.code === 'elementRate' && +t.element === +element).reduce((r, t) => (r * (+t.value || 0)) / 100, 100)
  }
  skillIds(a) {
    const ids = new Set(a.skills)
    // La habilidad configurada en el arma está disponible solo mientras siga equipada.
    const weapon = this.rec('weapons', a.equips[0])
    if (weapon?.actionSkill) ids.add(+weapon.actionSkill)
    for (const t of this.traitsOf(a)) if (t.code === 'addSkill') ids.add(+t.skill)
    for (const t of this.traitsOf(a)) if (t.code === 'sealSkill') ids.delete(+t.skill)
    return [...ids].filter((id) => this.rec('skills', id))
  }

  // ---------- niveles ----------
  expFor(a, level) { const c = this.rec('classes', a.classId) || {}, n = level - 1; return Math.round((c.expBase || 30) * n + (c.expInflation || 0) * n * n) }
  _learnByLevel(a) {
    const c = this.rec('classes', a.classId); const out = []
    for (const l of c?.learnings || []) if (l.level <= a.level && !a.skills.includes(+l.skill) && this.rec('skills', l.skill)) { a.skills.push(+l.skill); out.push(+l.skill) }
    return out
  }
  setLevel(x, level) {
    const a = this.need1(x), max = this.rec('actors', a.id)?.maxLevel || 99
    const from = a.level; a.level = clampI(level, 1, max); a.exp = this.expFor(a, a.level)
    const learned = this._learnByLevel(a)
    a.hp = Math.min(a.hp || 0, this.param(a, 'mhp')); a.mp = Math.min(a.mp, this.param(a, 'mmp'))
    if (a.level > from) { a.hp = this.param(a, 'mhp'); a.mp = this.param(a, 'mmp') }
    this.ctx.changed?.('party'); return { level: a.level, learned }
  }
  gainExp(x, n) {
    const a = this.need1(x), max = this.rec('actors', a.id)?.maxLevel || 99
    a.exp = Math.max(0, a.exp + Math.round(n))
    let lv = a.level
    while (lv < max && a.exp >= this.expFor(a, lv + 1)) lv++
    const res = lv !== a.level ? this.setLevelKeepExp(a, lv) : { level: a.level, learned: [] }
    this.ctx.changed?.('party'); return res
  }
  setLevelKeepExp(a, lv) { const e = a.exp; const r = this.setLevel(a, lv); a.exp = e; return r }
  need1(x) { const a = x && x.classId !== undefined ? x : x && x._a ? x._a : this.actor(x); if (!a) throw new Error(`«${x}» no está en el grupo`); return a }

  // ---------- equipo ----------
  equip(x, slot, item) {
    const a = this.need1(x); const i = typeof slot === 'number' ? slot - 1 : this.db.system.equipTypes.findIndex((n) => n.toLowerCase() === String(slot).toLowerCase())
    if (i < 0 || i >= a.equips.length) throw new Error(`Ranura de equipo «${slot}» no existe`)
    const kind = SLOT_KINDS(i), old = a.equips[i]
    const next = item ? this.need(kind, item) : null
    if (next && +next.etype !== i + 1) throw new Error(`«${next.name}» no va en la ranura «${this.db.system.equipTypes[i]}»`)
    if (old === (next?.id || 0)) return // volver a equipar lo mismo no cambia nada
    if (next && !this.has(kind, next.id)) throw new Error(`No tienes «${next.name}»`)
    // Actualiza primero las cantidades y la ranura: los eventos ven el equipo definitivo.
    const changes = []
    if (next) {
      const before = this.count(kind, next.id)
      this.inv[kind][next.id] = before - 1
      if (!this.inv[kind][next.id]) delete this.inv[kind][next.id]
      changes.push([next, before, before - 1])
    }
    a.equips[i] = next?.id || 0
    if (old) {
      const previous = this.need(kind, old), before = this.count(kind, old)
      const after = clampI(before + 1, 0, this.db.system?.maxItems || 99)
      if (after) this.inv[kind][old] = after
      changes.push([previous, before, after])
    }
    a.hp = Math.min(a.hp, this.param(a, 'mhp')); a.mp = Math.min(a.mp, this.param(a, 'mmp'))
    this.ctx.changed?.('inventory'); this.ctx.changed?.('party')
    for (const [rec, before, after] of changes) this._invSignal(kind, rec, before, after)
    if (old) this.ctx.nativeSignal?.('equipment.unequipped', { actorId: a.id, kind, itemId: old, equipSlot: i + 1 })
    if (next) this.ctx.nativeSignal?.('equipment.equipped', { actorId: a.id, kind, itemId: next.id, equipSlot: i + 1 })
  }

  /** Usa la habilidad configurada en el arma que lleva equipada el personaje. */
  weaponAction(actor, target) {
    const a = this.need1(actor), weaponId = a.equips[0]
    if (!weaponId) return { ok: false, events: [], text: 'No hay ningún arma equipada.' }
    const weapon = this.need('weapons', weaponId)
    if (!weapon.actionSkill) return { ok: false, events: [], text: `«${weapon.name}» no tiene una acción configurada.` }
    const skill = this.need('skills', weapon.actionSkill)
    if (skill.scope === 'enemy' && (!target || !this.battler(target).isEnemy)) return { ok: false, events: [], text: 'Indica un enemigo válido como objetivo.' }
    return this.useSkill(skill.id, a.id, target)
  }

  // ---------- estados ----------
  addState(x, id, chance = 100) {
    const b = this.battler(x), r = this.need('states', id)
    if (Math.random() * 100 >= chance) return false
    const list = b.isEnemy ? b._e.states : b._a.states
    if (!b.isEnemy && this.traitsOf(b._a).some((t) => t.code === 'stateResist' && +t.state === r.id)) return false
    const ex = list.find((s) => s.id === r.id)
    if (ex) ex.turns = r.duration || 0; else list.push({ id: r.id, turns: r.duration || 0 })
    this.ctx.changed?.('party'); return true
  }
  removeState(x, id) { const b = this.battler(x), r = this.need('states', id), l = b.isEnemy ? b._e : b._a; l.states = l.states.filter((s) => s.id !== r.id); this.ctx.changed?.('party') }
  /** Un tick es un paso lógico explícito: aplica efectos y después reduce la duración. */
  tick(x) {
    const list = x ? [this.battler(x)] : this.partyBattlers, ended = []
    // Prepara los efectos antes de modificar estadísticas; estados antiguos no tienen estos campos.
    const updates = list.map((b) => {
      const owner = b.isEnemy ? b._e : b._a
      const effects = owner.states.map((st) => {
        const r = this.rec('states', st.id)
        const values = ['tickHpFlat', 'tickHpPct', 'tickMpFlat', 'tickMpPct'].map((key) => {
          const v = Number(r?.[key] ?? 0)
          if (!Number.isFinite(v)) throw new Error(`Estado «${r?.name || st.id}»: ${key} no es finito`)
          return v
        })
        const hp = Math.round(values[0] + b.mhp * values[1] / 100)
        const mp = Math.round(values[2] + b.mmp * values[3] / 100)
        if (!Number.isFinite(hp) || !Number.isFinite(mp)) throw new Error(`Estado «${r?.name || st.id}»: efecto no finito`)
        return { st, hp, mp }
      })
      return { b, owner, effects }
    })
    for (const { b, owner, effects } of updates) {
      for (const { st, hp, mp } of effects) {
        if (hp) b.hp += hp
        if (mp) b.mp += mp
        if (st.turns > 0) st.turns--
      }
      const gone = owner.states.filter((st) => st.turns === 0 && (this.rec('states', st.id)?.duration || 0) > 0)
      for (const st of gone) ended.push([b.name, st.id])
      owner.states = owner.states.filter((st) => !gone.includes(st))
    }
    this.ctx.changed?.('party'); return ended
  }
  canAct(b, skill) {
    const st = b.states.map((id) => this.rec('states', id)?.restriction)
    return !(st.includes('noActions') || (skill && st.includes('noSkills')))
  }
  recoverAll() { for (const b of this.partyBattlers) { b.hp = b.mhp; b.mp = b.mmp; b._a.states = [] } this.ctx.changed?.('party') }

  // ---------- fórmulas, habilidades y objetos ----------
  formula(src, a, b) {
    try { return evaluateFormula(src, a, b, (id) => this.ctx.getVar?.(id) ?? 0) }
    catch (e) { throw new Error(`Fórmula «${src}»: ${e.message}`) }
  }
  _damageAmount(entry, a, b) {
    let n = Math.max(0, this.formula(entry.formula || '0', a, b))
    n = (n * this.elementRate(b, entry.element)) / 100
    const vr = (+entry.variance || 0) / 100; if (vr) n *= 1 + (Math.random() * 2 - 1) * vr
    if (!Number.isFinite(n)) throw new Error(`Fórmula «${entry.formula}»: daño no finito`)
    return Math.round(n)
  }
  _damage(entry, a, b, n) {
    const hpT = entry.type.startsWith('hp'), rec = entry.type.endsWith('Rec'), drain = entry.type.endsWith('Drain')
    const key = hpT ? 'hp' : 'mp'
    if (rec) b[key] += n; else { b[key] -= n; if (drain) a[key] += n }
    if (!rec && n > 0 && hpT) for (const s of [...b.states]) if (this.rec('states', s)?.removeOnDamage) this.removeState(b, s)
    return { type: entry.type, amount: n, signed: rec ? n : -n }
  }
  _effects(effects, user, b, out) {
    for (const e of effects || []) {
      if (e.code === 'hp' || e.code === 'mp') { const m = e.code === 'hp' ? b.mhp : b.mmp, n = Math.round((m * (+e.pct || 0)) / 100 + (+e.flat || 0)); b[e.code] += n; out.effects.push({ code: e.code, amount: n }) }
      else if (e.code === 'addState') { if (this.addState(b, e.state, e.chance)) out.effects.push({ code: 'addState', state: e.state }) }
      else if (e.code === 'removeState') { this.removeState(b, e.state); out.effects.push({ code: 'removeState', state: e.state }) }
      else if (e.code === 'grow' && !b.isEnemy) { b._a.grown[e.param] = (b._a.grown[e.param] || 0) + (+e.value || 0); out.effects.push({ code: 'grow', param: e.param }) }
      else if (e.code === 'learnSkill' && !b.isEnemy) { if (!b._a.skills.includes(+e.skill)) { b._a.skills.push(+e.skill); out.learned.push(+e.skill) } }
      else if (e.code === 'commonEvent') out.events.push(+e.event)
    }
  }
  _apply(rec, user, targets, out, mpCost = 0) {
    // Calcula todo antes de descontar MP, inventario o modificar los objetivos.
    // Para habilidades, la fórmula ve el MP del usuario después del coste (contrato anterior).
    const previewUser = mpCost ? Object.create(user) : user
    if (mpCost) Object.defineProperty(previewUser, 'mp', { value: user.mp - mpCost, enumerable: true })
    const amounts = targets.map((b) => (rec.damage || []).map((d) =>
      this._damageAmount(d, previewUser || b, b === user ? previewUser : b)))
    if (mpCost) user.mp -= mpCost
    targets.forEach((b, i) => {
      const res = { target: b.name, damage: null }
      ;(rec.damage || []).forEach((d, j) => { res.damage = this._damage(d, user || b, b, amounts[i][j]) })
      this._effects(rec.effects, user, b, out)
      out.hits.push(res)
    })
  }
  targetsOf(rec, user, target) {
    const sc = rec.scope
    if (sc === 'self') return [user]
    if (sc === 'all') return this.partyBattlers
    if (sc === 'none') return []
    return [target ? this.battler(target) : user]
  }
  /** Usa una habilidad: game.party.useSkill("Golpe", "Protagonista", {enemy: 1}) → resultado. */
  useSkill(skill, user, target) {
    const s = this.need('skills', skill), u = this.battler(user)
    const out = { ok: false, skill: s.name, hits: [], effects: [], learned: [], events: [], text: '' }
    if (!this.canAct(u, true)) { out.text = `${u.name} no puede actuar.`; return out }
    if (!u.isEnemy && !this.skillIds(u._a).includes(s.id)) throw new Error(`${u.name} no conoce «${s.name}»`)
    if (u.mp < (+s.mpCost || 0)) { out.text = `${u.name} no tiene energía suficiente.`; return out }
    this._apply(s, u, this.targetsOf(s, u, target), out, +s.mpCost || 0)
    out.ok = true; out.text = this.fmt(s.message, { a: u.name, b: out.hits[0]?.target || '', name: s.name, n: out.hits[0]?.damage?.amount ?? '' })
    this.ctx.changed?.('party'); return out
  }
  /** Usa un objeto. Las llamadas antiguas de scripts usan contexto «event». */
  useItem(item, target, user = null, context = 'event') {
    if (context !== 'event' && context !== 'menu') throw new Error(`Contexto de uso «${context}» no válido`)
    const it = this.need('items', item)
    const out = { ok: false, item: it.name, hits: [], effects: [], learned: [], events: [], text: '' }
    if (!this.has('items', it.id)) { out.text = `No tienes ${it.name}.`; return out }
    if (it.occasion === 'never' || (it.occasion === 'menu' && context !== 'menu') || (it.occasion === 'event' && context !== 'event')) {
      out.text = `${it.name} no se puede usar aquí.`; return out
    }
    const u = user ? this.battler(user) : null, tg = target ?? this.members[0]
    // Un objeto sin objetivo puede ejecutar un evento común incluso sin personajes en el grupo.
    const targets = it.scope === 'none' ? [] : this.targetsOf(it, u || this.battler(tg), tg)
    this._apply(it, u, targets, out)
    // Los eventos comunes son efectos del uso, no de cada objetivo; se ejecutan una sola vez.
    out.events = [...new Set((it.effects || []).filter((e) => e.code === 'commonEvent').map((e) => +e.event))]
    if (it.consumable) this.gain('items', it.id, -1)
    out.ok = true; out.text = this.fmt(this.term('useItem'), { a: u?.name || '', name: it.name })
    this.ctx.changed?.('party'); return out
  }
  /** Ejecuta los eventos comunes pedidos por efectos (los llama el intérprete). */
  async runEvents(res) { for (const id of res.events || []) await this.ctx.callCommon?.(id) }

  // ---------- diario ----------
  quest(x) {
    const q = this.need('quests', x), st = this.journal.quests[q.id] || { status: 'none', done: [] }
    return { id: q.id, name: q.name, status: st.status, done: [...st.done], total: (q.objectives || []).length, record: q }
  }
  setQuest(x, action, obj = 0) {
    const q = this.need('quests', x), st = (this.journal.quests[q.id] ||= { status: 'none', done: [] })
    if (action === 'start') st.status = 'active'
    else if (action === 'complete') { st.status = 'done'; if (q.rewardGold) this.addGold(q.rewardGold); if (q.rewardItem) this.gain('items', q.rewardItem, 1) }
    else if (action === 'fail') st.status = 'failed'
    else if (action === 'objective') { if (st.status === 'none') st.status = 'active'; const i = +obj; if (!st.done.includes(i)) st.done.push(i) }
    else if (action === 'reset') { st.status = 'none'; st.done = [] }
    this.ctx.changed?.('journal'); return this.quest(q.id)
  }
  collect(x, on = true) { const l = this.need('lore', x); if (on) this.journal.lore[l.id] = true; else delete this.journal.lore[l.id]; this.ctx.changed?.('journal') }

  // ---------- vista para interfaces (play.party) ----------
  snapshot() {
    const nm = (kind) => Object.entries(this.inv[kind]).map(([id, n]) => { const r = this.rec(kind, +id); return { id: +id, kind, name: r.name, icon: r.icon, desc: r.desc, n, record: r } })
    return {
      gold: this.gold, currency: this.db.system?.currency || '',
      members: this.members.map((id) => { const b = this.battler(id), a = b._a; return { id, name: a.name, nickname: a.nickname, level: a.level, hp: a.hp, mp: a.mp, mhp: b.mhp, mmp: b.mmp, exp: a.exp, params: Object.fromEntries(KEYS.map((k) => [k, b[k]])), skills: this.skillIds(a).map((s) => this.rec('skills', s)?.name), states: a.states.map((s) => this.rec('states', s.id)?.name), equips: a.equips.map((e, i) => (e ? this.rec(SLOT_KINDS(i), e)?.name : '')), portrait: this.rec('actors', id)?.portrait || '' } }),
      items: nm('items'), weapons: nm('weapons'), armors: nm('armors'),
      quests: this.db.quests.map((q) => this.quest(q.id)).filter((q) => q.status !== 'none' || !q.record.hidden).map((q) => ({ id: q.id, name: q.name, desc: q.record.desc, status: q.status, objectives: (q.record.objectives || []).map((o, i) => ({ text: o.text, optional: o.optional, done: q.done.includes(i) })) })),
      lore: this.db.lore.filter((l) => this.journal.lore[l.id]).map((l) => ({ id: l.id, name: l.name, category: l.category, body: l.body, desc: l.desc })),
    }
  }
}
