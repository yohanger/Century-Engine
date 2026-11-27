// Guardar y cargar partida (estilo RPG Maker MZ: ranuras numeradas + ranura 0 de autoguardado). Sin DOM ni three:
// el estado del juego (interruptores, variables, auto-interruptores, grupo, inventario, diario, game.state) lo gestiona esta clase;
// lo que toca el mundo (escena, posición del jugador, hora, clima, objetos en las manos) lo captura y restaura el `host`
// (host.captureWorld() / host.restoreWorld(w)) y el almacenamiento lo pone el host (host.saveStorage()): localStorage en el juego.
//
//   game.save.save(3)  ·  game.save.load(3)  ·  game.save.list()  ·  game.save.autosave()  ·  game.save.canSave = false
import { cloneVal } from './vars.js'

export const SAVE_VERSION = 1
const json = (v, d = null) => { try { return v === undefined ? d : JSON.parse(JSON.stringify(v)) } catch { return d } }

/** Almacenamiento en memoria (pruebas y entornos sin localStorage). */
export class MemoryStorage {
  constructor() { this.m = new Map() }
  get(slot) { return this.m.has(slot) ? this.m.get(slot) : null }
  set(slot, data) { this.m.set(slot, data) }
  del(slot) { this.m.delete(slot) }
  slots() { return [...this.m.keys()] }
}
/** localStorage con un espacio de nombres por proyecto. */
export class LocalStorageBackend {
  constructor(ns, ls = typeof localStorage !== 'undefined' ? localStorage : null) { this.ns = ns; this.ls = ls }
  k(slot) { return `rt-save:${this.ns}:${slot}` }
  get(slot) { try { const t = this.ls?.getItem(this.k(slot)); return t ? JSON.parse(t) : null } catch { return null } }
  set(slot, data) { this.ls.setItem(this.k(slot), JSON.stringify(data)) }
  del(slot) { try { this.ls?.removeItem(this.k(slot)) } catch { /* nada */ } }
  slots() { const out = [], pre = `rt-save:${this.ns}:`; try { for (let i = 0; i < this.ls.length; i++) { const k = this.ls.key(i); if (k.startsWith(pre) && /^\d+$/.test(k.slice(pre.length))) out.push(+k.slice(pre.length)) } } catch { /* nada */ } return out }
}

/** Partidas sobre el almacenamiento del host (claves lógicas 'save/<ranura>'). */
export class KeyedStorageBackend {
  constructor(storage) { this.st = storage }
  get(slot) { try { const t = this.st.get('save/' + slot); return t ? JSON.parse(t) : null } catch { return null } }
  set(slot, data) { this.st.set('save/' + slot, JSON.stringify(data)) }
  del(slot) { this.st.remove('save/' + slot) }
  slots() { return this.st.keys('save/').map((k) => k.slice(5)).filter((k) => /^\d+$/.test(k)).map(Number) }
}

export class SaveManager {
  /** @param game Game (interpreter.js) */
  constructor(game) {
    this.g = game
    this.access = true // «Cambiar acceso a guardado» de MZ
    this.last = 0       // última ranura usada (para «guardar» / «cargar» sin número)
    this.busy = false
    this.api = this._api()
  }
  get host() { return this.g.host }
  get cfg() { return this.g.db.player || {} }
  get max() { return Math.max(1, Math.min(99, Math.floor(+this.cfg.saveSlots || 20))) }
  get storage() { return (this._st ??= this.host.saveStorage?.() || new MemoryStorage()) }
  /** Permite sustituir el almacenamiento (pruebas). */
  useStorage(st) { this._st = st }
  _slot(n) {
    if (n === undefined || n === null || n === '' || n === 'last') return this.last || 1
    if (n === 'auto') return 0
    const i = Math.floor(+n)
    if (!Number.isFinite(i) || i < 0 || i > this.max) throw new Error(`Ranura de guardado no válida: ${n} (0 = autoguardado, 1–${this.max})`)
    return i
  }

  // ---------- estado del juego ----------
  snapshot() {
    const g = this.g, P = g.party
    return {
      sw: json(g.sw, {}), vr: json(g.vr, {}), selfSw: json(g.selfSw, {}), dyn: json(g.dyn, { switches: [], variables: [] }),
      state: json(g.state, {}), time: g.time,
      party: { gold: P.gold, inv: json(P.inv), actors: json(P.actors, {}), members: [...P.members], journal: json(P.journal),
        enemies: json(P.enemies, {}), nextEnemyId: P.nextEnemyId },
    }
  }
  restore(s) {
    const g = this.g, P = g.party
    g.sw = json(s.sw, {}); g.vr = json(s.vr, {}); g.selfSw = json(s.selfSw, {})
    if (s.dyn) g.dyn = json(s.dyn)
    for (const k of Object.keys(g.state)) delete g.state[k] // game.state conserva su identidad: los scripts guardan la referencia
    Object.assign(g.state, json(s.state, {}))
    g.time = +s.time || 0
    const p = s.party || {}
    P.gold = Math.max(0, +p.gold || 0)
    P.inv = { items: {}, weapons: {}, armors: {}, ...json(p.inv, {}) }
    P.actors = json(p.actors, {}); P.members = Array.isArray(p.members) ? [...p.members] : []
    // Partidas anteriores no contienen instancias; no heredarlas de la sesión actual.
    P.enemies = json(p.enemies, {})
    const next = Object.keys(P.enemies).reduce((n, k) => {
      const m = /^enemy:(\d+)$/.exec(k)
      return m ? Math.max(n, Number(m[1]) + 1) : n
    }, 1)
    P.nextEnemyId = Math.max(next, Number.isSafeInteger(p.nextEnemyId) ? p.nextEnemyId : 1)
    P.journal = { quests: {}, lore: {}, ...json(p.journal, {}) }
    g.rev++
    P.ctx.changed?.('party')
  }

  // ---------- operaciones ----------
  /** ¿Hay algo guardado en la ranura? */
  exists(n) { return !!this.storage.get(this._slot(n)) }
  /** Datos resumidos de una ranura (sin el estado completo) o null. */
  info(n) {
    const slot = this._slot(n), d = this.storage.get(slot)
    return d ? { slot, ...d.meta, auto: slot === 0 } : null
  }
  /** Todas las ranuras: autoguardado (0) y 1..N; las vacías salen con `empty: true`. */
  list() {
    return Array.from({ length: this.max + 1 }, (_, slot) => this.info(slot) || { slot, empty: true, auto: slot === 0 })
  }
  /** Guarda en la ranura (por defecto la última usada). Devuelve false si el guardado está bloqueado. */
  async save(n, { name, meta } = {}) {
    if (!this.access && this._slot(n) !== 0) return false
    const slot = this._slot(n), g = this.g
    const world = (await this.host.captureWorld?.()) || {}
    const level = this.host.level?.name || ''
    const names = g.party.members.map((id) => g.party.actor(id)?.name).filter(Boolean)
    const info = {
      name: String(name ?? `Partida ${slot}`), date: new Date().toISOString(), playtime: Math.round(g.time), scene: world.sceneName || '', level,
      gold: g.party.gold, party: names, ...json(meta, {}),
    }
    const data = { v: SAVE_VERSION, meta: info, game: this.snapshot(), world }
    try { this.storage.set(slot, data) } catch (e) { g.report(e, 'Guardar'); return false }
    if (slot !== 0) this.last = slot
    await g.emit('save', { slot, ...info })
    return true
  }
  /** Carga la ranura: restaura el estado, vuelve a la escena y pone al jugador donde estaba. false si no existe. */
  async load(n) {
    const slot = this._slot(n), d = this.storage.get(slot)
    if (!d || !d.game) return false
    if (this.busy) return false
    this.busy = true
    try {
      // Fallar antes de sobrescribir variables/Party si falta el Prefab guardado.
      await this.host.validateWorldRestore?.(d.world || {})
      this.restore(d.game)
      await this.host.restoreWorld?.(d.world || {})
      if (slot !== 0) this.last = slot
      await this.g.emit('load', { slot, ...d.meta })
    } finally { this.busy = false }
    return true
  }
  delete(n) { const slot = this._slot(n); const had = !!this.storage.get(slot); this.storage.del(slot); if (this.last === slot) this.last = 0; return had }
  /** Guarda en la ranura 0 (aunque el guardado esté bloqueado, como el autoguardado de MZ). */
  autosave() { return this.save(0, { name: 'Autoguardado' }) }
  /** Ranura más reciente (por fecha) con datos, o -1. */
  latest() { let best = -1, t = ''; for (const s of this.list()) if (!s.empty && s.date > t) { t = s.date; best = s.slot } return best }

  _api() {
    const m = this
    return {
      /** Número de ranuras (1..N; la 0 es el autoguardado). */
      get slots() { return m.max },
      /** Última ranura guardada o cargada (0 = ninguna). */
      get lastSlot() { return m.last },
      get canSave() { return m.access }, set canSave(v) { m.access = !!v },
      get busy() { return m.busy },
      list: () => m.list(), info: (n) => m.info(n), exists: (n) => m.exists(n), latest: () => m.latest(),
      save: (n, o) => m.save(n, o), load: (n) => m.load(n), delete: (n) => m.delete(n), autosave: () => m.autosave(),
    }
  }
}
export { cloneVal }
