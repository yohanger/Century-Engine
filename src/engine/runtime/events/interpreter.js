// Intérprete de eventos y API de scripting. Sin DOM ni three: todo lo que toca el mundo pasa por `host`
// (lo implementa play.js en el editor, y un simulacro en las pruebas).
//
//  · Interruptores / variables / auto-interruptores viven en memoria y se reinician en cada «Jugar».
//  · Los comandos se ejecutan con async/await: los scripts pueden usar `await game.say(...)`, `await game.wait(2)`, etc.
//  · Los scripts del proyecto (Assets/Scripts/*.js) se ejecutan una vez al empezar y registran funciones y escuchas.
import { normalizeAnim } from '../ui/anim.js'
import { COMMANDS, blocksOf } from './commandDefs.js'
import { expandCodes, stripCodes } from './textcodes.js'
import { makeWorldApi } from '../world/api.js'
import { normalizeEvent } from './model.js'
import { normalizeDatabase } from '../database/schema.js'
import { Party } from '../database/rules.js'
import { SaveManager } from './saves.js'
import { normalizeLoc, lookup, slug } from '../i18n/localization.js'
import { EventError } from './event-error.js'
import { cmp, applyOp, saveSlotOf, EXEC, EXEC_CODES } from './exec-commands.js'
import { normVal, cloneVal, showVal, arrayOp, cmpVals } from './vars.js'
import { createScriptConsole, compileScript } from '../host.js'

const RESERVED_SIGNALS = new Set(['start', 'scene', 'update', 'lateUpdate', 'fixedUpdate', 'animationEvent', 'action', 'triggerEnter', 'triggerExit', 'triggerLook', 'triggerLookEnd', 'footstep', 'jump', 'land', 'crouch', 'drop', 'lightning', 'thunder', 'save', 'load', 'language'])
const BREAK = 'break', EXIT = 'exit'

export class Game {
  /** @param {{database?:{switches:string[],variables:string[]}, host?:object}} opts */
  constructor({ database = {}, host = {}, localization = null } = {}) {
    this.db = normalizeDatabase(database)
    // localización (i18n/localization.js): locOn = los «Mostrar texto» usan la tabla; lang = idioma actual
    this.loc = normalizeLoc(localization)
    this.locOn = false
    this.lang = this.loc.base
    this.party = new Party(this.db, {
      getVar: (n) => this.getVar(n),
      changed: (k) => { this.rev++; this.host.partyChanged?.(k) },
      callCommon: (id) => this.callCommon(id),
      nativeSignal: (name, data) => this._nativeSignal(name, data),
    })
    this.host = host
    this._outputClosed = false
    this.console = this.scriptConsole()
    this._worldApi = makeWorldApi(() => this.host.world, () => this.host.weatherSound, () => this.host._sceneEnv?.()) // el entorno efectivo (con los cambios de game.scene.set): el modelo y la caída de la niebla
    this.sw = {}
    this.vr = {}
    this.selfSw = {}
    this.state = {} // objeto libre para los scripts
    this.rev = 0 // sube con cada cambio de interruptor/variable: el motor reevalúa las páginas
    this.time = 0
    this.fns = new Map()
    this.listeners = new Map()
    this.waiters = new Map() // señales que alguien espera: nombre → [resolver]
    this._nativeSignalsMuted = false
    this._nativeSignalsQueue = null
    this._waitCancel = new Set()
    this.runners = new Set()
    this.dyn = { switches: [], variables: [] } // nombres usados desde scripts que no están en la base de datos
    this._code = new Map()
    this.saves = new SaveManager(this)
    this.api = this._buildApi()
  }

  // ---------- nombres / ids ----------
  _id(kind, x) {
    if (typeof x === 'number') return x
    const s = String(x).trim()
    if (/^\d+$/.test(s)) return +s
    const list = kind === 'sw' ? this.db.switches : this.db.variables
    const i = list.findIndex((n) => n && n.toLowerCase() === s.toLowerCase())
    if (i >= 0) return i + 1
    const dyn = kind === 'sw' ? this.dyn.switches : this.dyn.variables
    let j = dyn.indexOf(s.toLowerCase())
    if (j < 0) j = dyn.push(s.toLowerCase()) - 1
    return 100000 + j
  }
  getSw(x) { return !!this.sw[this._id('sw', x)] }
  setSw(x, v) { const id = this._id('sw', x); if (!!this.sw[id] !== !!v) { this.sw[id] = !!v; this.rev++ } else this.sw[id] = !!v }
  /** Valor de la variable (número, texto, sí/no, lista u objeto; 0 si nunca se asignó). */
  getVar(x) { return this.vr[this._id('vr', x)] ?? 0 }
  setVar(x, v) {
    const id = this._id('vr', x); v = normVal(v)
    if (typeof v === 'object' || this.vr[id] !== v) { this.vr[id] = v; this.rev++ } // las listas cuentan siempre como cambio
  }
  /** Operación de lista sobre una variable (push, pop, setAt, at, length…); devuelve el resultado de la operación. */
  varArray(x, op, o = {}) {
    const id = this._id('vr', x), cur = this.vr[id]
    const { arr, result } = arrayOp(Array.isArray(cur) ? cur : [], op, o)
    if (!['at', 'length', 'includes', 'indexOf', 'join', 'sum', 'min', 'max', 'random'].includes(op) || !Array.isArray(cur)) { this.vr[id] = arr; this.rev++ }
    return result
  }
  /** Nombre de la variable `id` en la base de datos ('' si no tiene). */
  varName(id) { return this.db.variables[+id - 1] || '' }
  getSelf(eventId, ch) { return !!this.selfSw[`${eventId}:${ch}`] }
  setSelf(eventId, ch, v) { const k = `${eventId}:${ch}`; if (!!this.selfSw[k] !== !!v) { this.selfSw[k] = !!v; this.rev++ } }

  /** Sustituye {v:N} (o {v:nombre}) por el valor de la variable. */
  /** `ctx` = contexto de la ejecución (de él sale el evento que habla: \N[0] es el personaje de ESE evento, aunque el comando se ejecute en el mismo instante en que arranca). */
  fmt(text, ctx) { return expandCodes(text, this.textCtx(ctx)) }
  /** Texto sin códigos de escape (opciones, preguntas, registros). */
  plain(text, ctx) { return stripCodes(this.fmt(text, ctx), this.textCtx(ctx)) }
  textCtx(ctx) { return { variable: (n) => showVal(this.getVar(n)), signal: (field) => { const v = this.signalValue(ctx, field); return v === undefined ? '' : showVal(v) }, translate: (k) => this.translate(k), ...(this.host.textCtx?.(ctx?.eventId) || {}) } }
  // Los datos recibidos pertenecen a este bloque, no a las variables globales.
  signalValue(ctx, field) {
    const signal = ctx?.signal
    if (!signal) return undefined
    const key = String(field ?? '').trim()
    if (key === 'signal') return signal.name
    if (key === 'data' || key === '') return signal.data
    let value = signal.data
    for (const part of key.split('.')) {
      if (!part || ['__proto__', 'prototype', 'constructor'].includes(part) || value == null || !Object.prototype.hasOwnProperty.call(Object(value), part)) return undefined
      value = value[part]
    }
    return value
  }

  // ---------- localización ----------
  /** Activa la localización: `on` = los comandos usan la tabla (juego exportado o «Usar en el editor»); `lang` = idioma inicial. */
  setupLocalization(loc, { on = false, lang = '' } = {}) {
    this.loc = normalizeLoc(loc)
    this.locOn = !!on
    this.lang = this.loc.languages.some((l) => l.code === lang) ? lang : this.loc.base
  }
  /** Cambia el idioma del juego. Devuelve false si no existe. Avisa con game.on('language'). */
  setLanguage(code) {
    code = String(code ?? '').trim().toLowerCase()
    if (!this.loc.languages.some((l) => l.code === code)) return false
    if (code === this.lang) return true
    this.lang = code
    this.rev++
    this.host.languageChanged?.(code)
    void this.emit('language', { lang: code })
    return true
  }
  /** Texto de una clave en el idioma actual (con respaldo en el idioma base); null si la clave no existe. */
  translate(key) { const r = lookup(this.loc, String(key ?? '').trim(), this.lang); return r ? r.text : null }
  /**
   * Texto, nombre y voz que muestra un «Mostrar texto» (o game.say con { key }): con la localización activa salen de la tabla en el idioma
   * actual; el nombre de quien habla se traduce con la clave «speaker.<nombre>» si existe. La voz de un idioma no se usa en otro.
   */
  localize({ text = '', speaker = '', voice = '', key = '' } = {}) {
    let v = voice || ''
    if (this.locOn) {
      const r = key ? lookup(this.loc, key, this.lang) : null
      if (r) { text = r.text; v = r.voice || (this.lang === this.loc.base ? v : '') } else if (this.lang !== this.loc.base) v = ''
      if (speaker) { const sp = lookup(this.loc, `speaker.${slug(speaker)}`, this.lang); if (sp) speaker = sp.text }
    }
    return { text, speaker, voice: v }
  }

  // ---------- compilación de JS ----------
  scriptConsole(context = '', active = () => true) {
    return createScriptConsole(() => this.host, context, () => !this._outputClosed && active())
  }
  scriptApi(output, base = this.api) {
    const api = Object.create(base)
    api.log = output.log
    return api
  }
  closeOutput() { this._outputClosed = true }

  _fn(kind, src, ctx) {
    const key = kind + '\u0000' + src
    let f = this._code.get(key)
    if (!f) {
      f = { create: compileScript(['game', 'event', 'args'], kind === 'expr' ? `return (${src}\n)` : src, { async: kind !== 'expr' }), scopes: new WeakMap(), plain: null }
      this._code.set(key, f)
    }
    if (!ctx) return f.plain ??= f.create(this.console)
    // Conserva la caché entre evaluaciones del mismo evento sin retener contextos terminados.
    let scoped = f.scopes.get(ctx)
    if (!scoped) {
      const output = this.scriptConsole(ctx.name || ctx.eventId || 'Evento', () => !ctx.cancelled)
      const run = f.create(output), api = this.scriptApi(output)
      scoped = (_api, event, args) => run(api, event, args)
      f.scopes.set(ctx, scoped)
    }
    return scoped
  }
  evalExpr(src, ctx) {
    try { return this._fn('expr', src, ctx)(this.api, ctx?.eventHandle, ctx?.args) } catch (e) { throw new EventError(`Expresión «${src}»: ${e.message}`, 'script') }
  }

  // ---------- páginas ----------
  condOk(page, eventId, ctx = null) {
    const c = page.cond || {}
    if (c.sw1 && !this.getSw(c.sw1)) return false
    if (c.sw2 && !this.getSw(c.sw2)) return false
    if (c.vr) {
      const v = this.getVar(c.vr), t = +c.vrVal || 0
      if (!cmp(c.vrOp || '>=', v, t)) return false
    }
    if (c.self && !this.getSelf(eventId, c.self)) return false
    if (c.item && !this.party.has('items', c.item)) return false
    if (c.actor && !this.party.members.includes(+c.actor)) return false
    if (c.script && String(c.script).trim()) {
      try { if (!this.evalExpr(c.script, ctx)) return false } catch (e) { this.report(e); return false }
    }
    return true
  }
  /** Índice de la página activa (la última cuyas condiciones se cumplen) o -1. */
  activePage(props, eventId) {
    const pages = normalizeEvent(props).pages
    for (let i = pages.length - 1; i >= 0; i--) if (this.condOk(pages[i], eventId)) return i
    return -1
  }

  // ---------- ejecución ----------
  /** Lanza una lista de comandos. Devuelve { done, cancel, ctx }. */
  run(list, { event = null, eventId = null, name = '', args = [], signal = null, cameraOwner = null, onEnd = null } = {}) {
    const ctx = { cancelled: false, eventId, name, args, signal, cameraOwner, eventHandle: event || this.host.eventHandle?.(eventId) || { id: eventId, name } }
    const r = { ctx, cancel: () => { ctx.cancelled = true; for (const cancel of [...(ctx.waitCancels || [])]) cancel() }, done: null }
    this.runners.add(r)
    r.done = (async () => {
      try { await this.runList(list, ctx) } catch (e) { if (!ctx.cancelled) this.report(e, ctx.name || ctx.eventId) } finally { this.runners.delete(r); onEnd?.() }
    })()
    return r
  }
  /** Ejecuta un evento común de la base de datos (por id o nombre) y espera a que termine. */
  async callCommon(x) {
    const r = this.party.need('commonEvents', x)
    await this.run(r.list || [], { name: r.name, cameraOwner: `common:${r.id}` }).done
  }
  cancelAll() { for (const r of this.runners) r.cancel(); this.waiters.clear(); for (const f of [...this._waitCancel]) f(); this._waitCancel.clear() }

  async runList(list, ctx) {
    for (const cmd of list || []) {
      if (ctx.cancelled) return EXIT
      const r = await this.exec(cmd, ctx)
      if (r === BREAK || r === EXIT) return r
    }
  }

  async exec(cmd, ctx) {
    const fn = EXEC[cmd.code]
    if (!fn) throw new EventError(`Comando desconocido: ${cmd.code}`, cmd.code)
    try {
      // Solo agrupamos las acciones que cambian mano e inventario a la vez.
      // «Usar» puede reproducir clips largos: no debe retener otras señales mientras anima.
      const p = cmd.p || {}
      const moveItem = cmd.code === 'item3D' && ['pickup', 'take'].includes(p.action || 'pickup')
      const equipWeapon = cmd.code === 'weapon3D' && (p.action || 'equip') === 'equip'
      if (moveItem || equipWeapon) return await this._nativeTransaction(() => fn.call(this, p, cmd, ctx))
      return await fn.call(this, cmd.p || {}, cmd, ctx)
    } catch (e) {
      if (e instanceof EventError) throw e
      throw new EventError(`${COMMANDS[cmd.code]?.label || cmd.code}: ${e.message}`, cmd.code)
    }
  }

  evalIf(p, ctx) {
    switch (p.kind) {
      case 'switch': return this.getSw(p.id) === !!p.on
      case 'variable': return cmpVals(p.op, this.getVar(p.vid), p.src === 'variable' ? this.getVar(p.vid2) : p.src === 'text' ? String(p.text ?? '') : (Number.isFinite(+p.value) ? +p.value : 0))
      case 'self': return this.getSelf(ctx.eventId, p.ch) === !!p.on
      case 'save': return p.sq === 'any' ? this.saves.latest() >= 0 : p.sq === 'canSave' ? this.saves.access : this.saves.exists(saveSlotOf(this, p))
      case 'gold': return cmp(p.op2, this.party.gold, +p.n || 0)
      case 'item': return cmp(p.op2, this.party.count('items', p.item), +p.n || 0)
      case 'actor': return this.party.members.includes(+p.actor)
      case 'skill': { const a = this.party.actor(p.actor); return !!a && this.party.skillIds(a).includes(+p.skill) }
      case 'quest': return this.party.quest(p.quest).status === p.qs
      case 'animating': return !!this.host.animationPlaying?.(p.node || undefined, p.clip || undefined, ctx.eventId)
      case 'held': return !!this.host.viewModelHeld?.(p, ctx.eventId)
      case 'input': { const i = this.host.input, a = p.action; if (!i) return false; return p.state === 'pressed' ? i.anyJustPressed(a) : p.state === 'released' ? i.anyJustReleased(a) : i.anyPressed(a) }
      case 'script': return !!this.evalExpr(p.expr, ctx)
      default: return false
    }
  }

  // ---------- funciones y escuchas definidas por scripts ----------
  define(name, fn) { if (typeof fn !== 'function') throw new Error('game.define necesita una función'); this.fns.set(String(name), fn) }
  async call(name, ...args) {
    const f = this.fns.get(String(name))
    if (!f) throw new EventError(`La función «${name}» no está definida (game.define)`, 'callFn')
    return await f(...args)
  }
  on(name, fn) {
    if (typeof fn !== 'function') throw new Error('game.on necesita una función')
    const l = this.listeners.get(name) || []
    l.push(fn); this.listeners.set(name, l)
    return () => this.listeners.set(name, (this.listeners.get(name) || []).filter((f) => f !== fn))
  }
  /**
   * Señal con nombre propio (game.emit / comando «Emitir señal»): despierta a quien la espere (comando «Esperar señal», game.waitFor),
   * arranca las páginas con disparador «Al recibir señal» y avisa a los game.on(nombre). Devuelve cuando han terminado los game.on.
   */
  async signal(name, data) {
    name = String(name ?? '').trim()
    if (!name) throw new Error('La señal necesita un nombre')
    if (RESERVED_SIGNALS.has(name)) throw new Error(`«${name}» es un evento interno del motor: elige otro nombre para tu señal`)
    const w = this.waiters.get(name.toLowerCase())
    if (w) { this.waiters.delete(name.toLowerCase()); for (const fn of w) fn(data) }
    this.host.signalEvents?.(name, data)
    await this.emit(name, data)
  }
  /** Señales del motor: usan las mismas páginas, esperas y listeners que las señales personalizadas. */
  _nativeSignal(name, data) {
    if (this._nativeSignalsMuted) return
    if (this._nativeSignalsQueue) { this._nativeSignalsQueue.push([name, data]); return }
    try { Promise.resolve(this.signal(name, data)).catch((e) => this.report(e, name)) }
    catch (e) { this.report(e, name) }
  }
  async _nativeTransaction(run) {
    if (this._nativeSignalsQueue) return run() // una acción declarativa puede llamar a otra
    this._nativeSignalsQueue = []
    let result, queued
    try { result = await run(); queued = this._nativeSignalsQueue }
    finally { this._nativeSignalsQueue = null }
    if (queued) for (const [name, data] of queued) this._nativeSignal(name, data)
    return result
  }
  /** Conserva el resultado antiguo de game.waitFor: solo el dato o undefined. */
  async waitSignal(name, timeout = 0) {
    const result = await this.waitSignalResult(name, timeout)
    return result.status === 'received' ? result.data : undefined
  }
  /** La espera estructurada distingue una señal sin datos de un timeout y de una cancelación. */
  waitSignalResult(name, timeout = 0, ctx = null) {
    const key = String(name ?? '').trim().toLowerCase()
    if (!key) return Promise.reject(new Error('La señal necesita un nombre'))
    if (ctx?.cancelled) return Promise.resolve({ status: 'cancelled' })
    return new Promise((resolve) => {
      let timer = null, finished = false
      const clean = () => {
        if (timer !== null) clearTimeout(timer)
        const remaining = (this.waiters.get(key) || []).filter((f) => f !== received)
        if (remaining.length) this.waiters.set(key, remaining)
        else this.waiters.delete(key)
        this._waitCancel.delete(cancel)
        ctx?.waitCancels?.delete(cancel)
      }
      const finish = (status, data) => {
        if (finished) return
        finished = true
        clean()
        resolve({ status, data })
      }
      const received = (data) => finish('received', data)
      const cancel = () => finish('cancelled')
      this.waiters.set(key, [...(this.waiters.get(key) || []), received])
      this._waitCancel.add(cancel)
      if (ctx) (ctx.waitCancels ??= new Set()).add(cancel)
      if (timeout > 0) timer = setTimeout(() => finish('timeout'), timeout * 1000)
    })
  }
  async emit(name, payload) {
    for (const fn of [...(this.listeners.get(name) || [])]) {
      try { await fn(payload) } catch (e) { this.report(e, `game.on("${name}")`) }
    }
  }
  /** Cada fotograma (el motor lo llama): avanza el reloj y avisa a los game.on("update"). */
  update(dt) {
    this.time += dt
    this._tick('update', dt)
  }
  /** Al final del fotograma, con el jugador y los eventos ya actualizados: game.on("lateUpdate"). */
  lateUpdate(dt) { this._tick('lateUpdate', dt) }
  /** Una vez por paso de física (tasa fija de Ajustes del juego), justo antes de mover al jugador: game.on("fixedUpdate"). */
  fixedUpdate(dt) { this._tick('fixedUpdate', dt) }
  _tick(name, dt) {
    const l = this.listeners.get(name)
    if (l) for (const fn of l) { try { const r = fn(dt); if (r?.catch) r.catch((e) => this.report(e, `game.on("${name}")`)) } catch (e) { this.report(e, `game.on("${name}")`) } }
  }

  /** Ejecuta los scripts del proyecto (una vez al empezar). */
  async loadScripts(scripts) {
    for (const s of scripts || []) {
      try {
        const output = this.scriptConsole(s.name || s.id)
        await compileScript(['game'], s.code || '', { async: true })(output)(this.scriptApi(output))
      } catch (e) { this.report(e, s.name) }
    }
  }

  report(e, where = '') {
    const msg = `${where || e.where || 'Evento'}: ${e?.message || e}`
    if (this._outputClosed) { console.error(msg); return }
    if (this.host.error) this.host.error(msg, e)
    else console.error(msg)
  }

  _variablesApi() {
    const g = this
    const api = {
      get: (x) => g.getVar(x), set: (x, v) => { g.setVar(x, v); return g.getVar(x) },
      add: (x, n = 1) => { g.setVar(x, applyOp('add', g.getVar(x), n)); return g.getVar(x) },
      /** El nombre de la variable `id` en la base de datos. */
      name: (id) => g.varName(id),
      /** El id de la variable por su nombre (0 si no existe). */
      id: (name) => { const i = g.db.variables.findIndex((n) => n && n.toLowerCase() === String(name).trim().toLowerCase()); return i + 1 },
      /** Nombres de la base de datos (índice 0 = variable 1). */
      get names() { return [...g.db.variables] },
      /** Todas las variables con valor asignado: { id: valor }. */
      all: () => Object.fromEntries(Object.entries(g.vr).filter(([k]) => +k < 100000).map(([k, v]) => [k, cloneVal(v)])),
      /** Todas las variables a su valor inicial (0). */
      reset: () => { g.vr = {}; g.rev++ },
      push: (x, v) => g.varArray(x, 'push', { value: v }), pop: (x) => g.varArray(x, 'pop'), shift: (x) => g.varArray(x, 'shift'), unshift: (x, v) => g.varArray(x, 'unshift', { value: v }),
      insert: (x, i, v) => g.varArray(x, 'insert', { index: i, value: v }), removeAt: (x, i) => g.varArray(x, 'removeAt', { index: i }), remove: (x, v) => !!g.varArray(x, 'removeValue', { value: v }),
      at: (x, i) => g.varArray(x, 'at', { index: i }), setAt: (x, i, v) => g.varArray(x, 'setAt', { index: i, value: v }),
      length: (x) => g.varArray(x, 'length'), clear: (x) => { g.varArray(x, 'clear') },
      includes: (x, v) => !!g.varArray(x, 'includes', { value: v }), indexOf: (x, v) => g.varArray(x, 'indexOf', { value: v }),
      shuffle: (x) => { g.varArray(x, 'shuffle') }, sort: (x) => { g.varArray(x, 'sort') }, reverse: (x) => { g.varArray(x, 'reverse') },
      join: (x, sep = ', ') => g.varArray(x, 'join', { sep }), sum: (x) => g.varArray(x, 'sum'), min: (x) => g.varArray(x, 'min'), max: (x) => g.varArray(x, 'max'), random: (x) => g.varArray(x, 'random'),
    }
    return api
  }

  // ---------- API pública para scripts ----------
  _buildApi() {
    const g = this, h = () => g.host
    return {
      // estado
      switch: (x) => g.getSw(x), setSwitch: (x, v = true) => g.setSw(x, v),
      variable: (x) => g.getVar(x), setVariable: (x, v) => g.setVar(x, v),
      /** game.save: guardar / cargar partida (ranuras 1..N + autoguardado 0). Ver core/events/saves.js */
      get save() { return g.saves.api },
      /** game.variables: la tabla de variables como en RPG Maker MZ (id 1..N con nombre) pero con valores de cualquier tipo y operaciones de lista. */
      variables: g._variablesApi(),
      selfSwitch: (ch, ev) => g.getSelf(ev?.id ?? ev ?? h().currentEventId?.(), ch),
      setSelfSwitch: (ch, v, ev) => g.setSelf(ev?.id ?? ev ?? h().currentEventId?.(), ch, v),
      state: g.state,
      // diálogo
      say: (text, speaker = '', pos = 'bottom', opts = {}) => {
        const c = { eventId: h().currentEventId?.() }
        const r = g.localize({ text: String(text ?? ''), speaker, voice: opts?.voice, key: opts?.key })
        return h().say?.({ speaker: g.plain(r.speaker, c), text: g.fmt(r.text, c), pos, voice: r.voice, voiceAdvance: opts?.advance !== false, voiceGroup: opts?.group || 'voice', anim: normalizeAnim(opts) })
      },
      // localización
      get lang() { return g.lang },
      set lang(v) { g.setLanguage(v) },
      get languages() { return g.loc.languages.map((l) => ({ ...l })) },
      setLanguage: (code) => g.setLanguage(code),
      t: (key, fallback) => { const t = g.translate(key); return t == null ? (fallback ?? String(key)) : g.fmt(t, { eventId: h().currentEventId?.() }) },
      choose: async (options, cancel = -1, prompt = '', opts = {}) => (await h().choose?.({ options, cancel, prompt, anim: normalizeAnim(opts) })) ?? -1,
      wait: (seconds = 1) => h().wait?.(seconds),
      fade: (dir = 'out', seconds = 1, color = '#000000') => h().fade?.({ dir, seconds, color }),
      caption: (text, seconds = 3, pos = 'bottom', opts = {}) => h().caption?.({ text: g.fmt(String(text ?? ''), { eventId: h().currentEventId?.() }), seconds: +seconds || 3, pos, anim: normalizeAnim(opts) }),
      letterbox: (percent = 12) => h().letterbox?.(Math.min(25, Math.max(0, +percent || 0))),
      showLevelName: (text, opts = {}) => h().levelName?.(text == null ? '' : g.fmt(String(text), { eventId: h().currentEventId?.() }), opts || {}),
      // base de datos: game.party (ver core/database/rules.js) · game.db = registros · game.common("nombre")
      get party() { return g.party },
      get db() { return g.db },
      common: (x) => g.callCommon(x),
      // jugador / mundo
      teleport: (x, y, z, yaw) => h().teleport?.({ mode: 'pos', pos: [x, y, z], yaw }),
      teleportTo: (node, yaw) => h().teleport?.({ mode: 'node', node, yaw }),
      /** game.control(true|false) o game.control('free' | 'locked' | 'frozen'): libre · quieto pero mira · ni moverse ni mirar */
      control: (mode = 'free') => h().setControl?.(mode),
      get player() { return h().player },
      /** game.viewModel: lo que cuelga de la cámara. attach(objetivo?, { slot, pos, rot, scale, seconds }) · release(objetivo?, { at, seconds }) · slot("right") · clear(slot?) */
      get viewModel() { return h().viewModel },
      raycast: (origin, dir, maxDist = 100, opts) => h().raycast?.(origin, dir, maxDist, opts) ?? null,
      /** game.sensor({ from, range, fov, targets, … }) → sensor de visión/oído (ver play-sense.js). */
      sensor: (opts) => h().sensor?.(opts),
      node: (name) => h().findNode?.(name),
      /** Instanciación transitoria: la autoría de Prefabs permanece intacta. */
      spawnPlayer: (prefab, options = {}) => h().spawnPlayer?.(prefab, options),
      prefabs: {
        instantiate: (prefab, options = {}) => h().prefabInstantiate?.(prefab, options),
        destroy: (root) => h().prefabDestroy?.(root) ?? false,
      },
      scenes: {
        instantiate: (scene, options = {}) => h().sceneInstantiate?.(scene, options),
        destroy: (root) => h().sceneDestroy?.(root) ?? false,
      },
      /** Conserva un nodo y sus hijos al cambiar de escena (solo durante esta partida). */
      dontDestroyOnLoad: (name, enabled = true) => h().nodePersist?.(name, enabled) ?? false,
      findByTag: (tag) => h().findByTag?.(tag) ?? [], // compatibilidad legacy
      get_nodes_in_group: (name) => h().getNodesInGroup?.(name) ?? [],
      call_group: (name, method, ...args) => h().callGroup?.(name, method, ...args),
      findByLayer: (name) => h().findByLayer?.(name) ?? [],
      surfaceAt: (x, y, z) => h().surfaceAt?.(x, y, z) ?? '',
      /** game.moveRoute("player"|"this"|"Nodo", [["forward", 2], "turnPlayer", { c: "wait", p: { seconds: 1 } }], { repeat, skip }) → Promise */
      moveRoute: (target, steps, opts = {}) => h().moveRoute?.({ target, node: target, route: { list: steps || [], repeat: !!opts.repeat, skip: opts.skip !== false }, eventId: h().currentEventId?.() }),
      stopRoute: (target = 'this') => h().stopRoute?.(target, target, h().currentEventId?.()),
      event: (name) => h().findEvent?.(name),
      /** game.timeline.play("nombre", { speed, from, lock, skippable }) → Promise({ stopped, skipped }) · stop · skip · pause · resume · seek(t) · speed(v) · isPlaying · info · list */
      timeline: {
        play: (name, opts = {}) => h().timelinePlay?.(name, opts) ?? Promise.resolve({ stopped: true }),
        stop: (name) => !!h().timelineStop?.(name),
        skip: (name) => !!h().timelineSkip?.(name),
        pause: (name) => !!h().timelineControl?.(name, 'pause'),
        resume: (name) => !!h().timelineControl?.(name, 'resume'),
        seek: (name, t) => !!h().timelineControl?.(name, 'seek', t),
        speed: (name, v) => !!h().timelineControl?.(name, 'speed', v),
        isPlaying: (name) => !!h().timelineInfo?.(name),
        info: (name) => h().timelineInfo?.(name) ?? null,
        list: () => h().timelineList?.() ?? [],
      },
      /** game.nav: mapa de navegación horneado. ready · path(from, to, {smooth, allowPartial}) → [[x,y,z]…]|null · nearest([x,y,z]) · randomPoint([x,y,z], radio) · canWalk(a, b) */
      nav: {
        get ready() { return !!h().nav?.ready },
        path: (from, to, o = {}) => h().nav?.path(from, to, o)?.points ?? null,
        nearest: (p, max = 6) => h().nav?.nearest(p, max) ?? null,
        randomPoint: (c, r = 5) => h().nav?.randomPoint(c, r) ?? null,
        canWalk: (a, b) => !!h().nav?.canWalk(a, b),
      },
      goScene: (scene, tag = 'player', opts = {}) => h().gotoScene?.({ scene, tag, ...opts }),
      // audio (ver core/audio/scene.js)
      get audio() { return h().audio },
      // scripts
      define: (name, fn) => g.define(name, fn), call: (name, ...a) => g.call(name, ...a),
      on: (name, fn) => g.on(name, fn),
      /** game.once("señal", fn): como on pero se ejecuta una sola vez. */
      once: (name, fn) => { const off = g.on(name, (d) => { off(); return fn(d) }); return off },
      /** game.emit("señal", datos): señal propia. La reciben game.on / game.once / game.waitFor y las páginas «Al recibir señal». */
      emit: (name, data) => g.signal(name, data),
      /** game.waitFor("señal", segundos?) → Promise con el dato de la señal (undefined si pasa el tiempo). */
      waitFor: (name, timeout = 0) => g.waitSignal(name, timeout),
      random: (min = 0, max = 1) => Math.floor(Math.random() * (max - min + 1)) + min,
      log: (...a) => g.console.log(...a),
      get time() { return g.time },
      get ui() { return h().ui },
      // mundo: hora y clima (ver core/world/api.js) · game.level = { name, canRun, canJump, speedScale, gravityScale } de la escena actual
      get clock() { return g._worldApi.clock },
      get weather() { return g._worldApi.weather },
      /** game.profile.set("Noche", 2) · clear(seconds) · current — perfiles de post-proceso (Assets/Profiles) */
      get profile() { return h().profile },
      /** game.input: pressed/justPressed/justReleased/strength/axis/vector(acción o tecla) · onPress · wait · bind/rebind/create… (Project Settings → Input Map) */
      get input() { return h().inputApi },
      /** game.graphics: renderer ("forward"|"mobile"|"compat") · quality ("alto"|"medio"|"bajo") · resolutionScale · set({…}) · reset() — para menús de calidad gráfica */
      get graphics() { return h().graphics },
      /** game.lights("Etiqueta") → luces con esa etiqueta (todas sin etiqueta): .forEach(l => l.on = false) */
      lights: (tag) => h().lights?.(tag) ?? [],
      /** game.animation: play(nodo, "Clip", { loop, speed, fade, from, additive, layer, weight, mask }) · stop(nodo?, clip?) · isPlaying · active · list() — también node.playAnimation("Clip") */
      get animation() { return h().animation },
      /** game.cameraShake: reproduce y controla nodos Camera Shake Base en tiempo de juego. */
      get cameraShake() { return h().cameraShake },
      /** game.camera.acquire(id) → lease para activar, cambiar y liberar una Camera3D nativa por ID. */
      get camera() { return h().camera },
      get level() { return h().level ?? { name: '', canRun: true, canCrouch: true, canJump: true, speedScale: 1, gravityScale: 1 } },
      get scene() { return h().scene ?? { name: '', props: [], set() {}, reset() {} } }, // sin juego en marcha: vacío
      /** game.physics: cuerpos dinámicos (caen, chocan, se empujan, flotan); ver play-bodies.js. */
      get physics() { return h().physics },
    }
  }
}

export { EventError, EXEC_CODES }
export { blocksOf }
