// Orquestador de la interfaz del juego. Sin DOM: lo usan el modo Jugar, la vista previa del editor y (más adelante) el juego exportado.
//
//  · Documentos (.ui) → componentes Vue (compilados en tiempo de ejecución, con caché por contenido).
//  · Roles: el sistema decide qué pantalla de cada rol se ve (HUD, indicación, diálogo, opciones, fundido, pausa).
//  · Pantallas abiertas por el juego: game.ui.open("nombre", props, { modal, layer }) → promesa que se resuelve con close(resultado).
//  · Pantallas modales: liberan el ratón y pausan el juego; Esc cierra la superior.
import { SYSTEM_ROLES, systemDocById, roleVisible } from './system.js'
import { reactive, markRaw, ref, computed, watch, watchEffect, onMounted, onUnmounted, onErrorCaptured, nextTick, compile, h, provide, toRaw } from 'vue'
import { parseUi, scopeCss, uiClass, uiScreenName } from './sfc.js'
import { ROLES, ROLE_BY_KEY } from './roles.js'
import { normalizeTheme, themeVars } from './theme.js'
import { DESIGN_CSS, parseDesign } from './design-html.js'
import { compileScript, createScriptConsole } from '../host.js'

const SETUP_NAMES = ['ref', 'reactive', 'computed', 'watch', 'watchEffect', 'onMounted', 'onUnmounted', 'nextTick', 'props', 'game', 'ui', 'play', 'close', 'call', 'asset', 'onUpdate']

/** Compila un documento. No lanza: devuelve { ok, errors, render, setup, css, attrs }. */
export function compileUi(code, id = 'x') {
  const parts = parseUi(code), errors = []
  let render = null, setup = null
  if (!parts.template.trim()) errors.push({ where: 'plantilla', message: 'Falta <template>' })
  else {
    try { render = compile(parts.template, { onError: (e) => errors.push({ where: 'plantilla', message: e.message, line: e.loc?.start?.line }), onWarn: () => {} }) } catch (e) { errors.push({ where: 'plantilla', message: e.message }) }
  }
  if (parts.script.trim()) {
    try {
      const factory = compileScript(SETUP_NAMES, parts.script, { strict: false })
      setup = (...args) => factory(args[SETUP_NAMES.length] || globalThis.console)(...args)
    } catch (e) { errors.push({ where: 'script', message: e.message }) }
  }
  return { ok: !errors.length && !!render, errors, render, setup, css: scopeCss((parts.design.trim() ? DESIGN_CSS : '') + parts.style, uiClass(id)), attrs: parts.attrs, parts }
}

// Antes de que exista la partida (o en la vista previa sin datos) las pantallas ya pueden dibujarse: lecturas neutras.
const NO_GAME = { switch: () => false, variable: () => 0, selfSwitch: () => false, time: 0, state: {}, player: undefined, say: async () => {}, choose: async () => -1, wait: async () => {}, fade: async () => {}, log: () => {}, random: (a = 0) => a, call: () => {}, ui: undefined, t: (k, f) => f ?? String(k ?? ''), lang: '', languages: [] }

export class UiManager {
  /**
   * @param play     objeto reactivo con el estado del juego que ven las pantallas (dialog, choices, prompt, fade, focus…)
   * @param getDocs  () => lista de documentos del proyecto ({ id, name, code })
   * @param getConfig () => { slots }
   * @param getGame  () => instancia de Game (o null)
   * @param getSprites () => Sprites 2D que se dibujan en la pantalla (UiRoot)
   * @param host     { onModal, resume, quit, advance, pick, error, assetUrl }
   */
  constructor({ play, getDocs, getConfig, getGame, getTheme, getCanvases, getSprites, host = {} }) {
    this.play = play
    this.getDocs = getDocs
    this.getConfig = getConfig
    this.getGame = getGame
    this.getTheme = getTheme || (() => null)
    this.getCanvases = getCanvases || (() => [])
    /** Sprites 2D en pantalla (nodes/sprite.js): [{ id, url, refW, refH, x, y, rot, sx, sy, layer, pixel, flipX, flipY, opacity }] */
    this.getSprites = getSprites || (() => [])
    this.host = host
    this.state = reactive({ open: [], rev: 0, time: 0, errors: [], preview: null, themeRev: 0, canvas: {}, linger: null })
    this.cache = new Map()
    this.resolvers = new Map()
    this.updaters = new Set()
    this._timeAt = 0
    this.api = this._buildApi()
    this.gameFacade = this._facade()
    // ---- la última frase sigue en pantalla un instante al cerrarse (y mientras haya opciones justo después) ----
    // Así el cuadro no parpadea entre una frase y la siguiente, la frase acompaña a las respuestas como en un juego de diálogo,
    // y la animación de salida solo se ve al terminar la conversación.
    this.playView = new Proxy(this.play, {
      get: (t, k) => (k === 'dialog' ? t.dialog || this.state.linger : t[k]),
      set: (t, k, v) => { t[k] = v; return true },
    })
    let lingerTimer = 0
    const endLinger = () => { clearTimeout(lingerTimer); lingerTimer = 0; this.state.linger = null }
    watch(() => this.play.dialog, (now, before) => {
      if (now) { endLinger(); return }
      if (!before) return
      this.state.linger = markRaw({ ...toRaw(before), shown: String(before.text || '').length, done: true, lingering: true, resolve: null, voice: null })
      clearTimeout(lingerTimer)
      lingerTimer = setTimeout(() => { if (!this.play.choices) endLinger() }, 160)
    }, { flush: 'sync' })
    watch(() => !!this.play.choices, (on) => { if (!on && this.state.linger) endLinger() }, { flush: 'sync' })
    markRaw(this)
  }

  // ---------- documentos ----------
  doc(nameOrId) {
    const docs = this.getDocs() || []
    const sys = systemDocById(nameOrId)
    if (sys) return docs.find((d) => d.id === sys.id) || sys
    const q = String(nameOrId ?? '').toLowerCase()
    return docs.find((d) => d.id === nameOrId) || docs.find((d) => uiScreenName(d.name).toLowerCase() === q) || docs.find((d) => d.name.toLowerCase() === q)
  }

  /** Compilación en caché (se renueva cuando cambia el texto del documento). */
  compiled(docId) {
    const d = this.doc(docId)
    if (!d) return null
    const c = this.cache.get(d.id)
    if (c && c.code === d.code && c.name === d.name) return c
    const r = { code: d.code, name: d.name, doc: d, ...compileUi(d.code, d.id) }
    // diseño con «Escalar con la pantalla»: UiRoot lo escala desde su resolución de diseño
    const f = r.parts?.design?.trim() ? parseDesign(r.parts.design)?.form : null
    r.scaleTo = f && f.scale === 'screen' ? { w: f.w, h: f.h } : null
    r.exit = f && f.exit && f.exit !== 'none' ? { anim: f.exit, ms: f.exitMs } : null
    r.component = markRaw(this._component(r))
    this.cache.set(d.id, r)
    return r
  }

  _component(c) {
    const mgr = this
    const content = {
      name: 'RtUi',
      props: { screen: { type: Object, required: true } },
      setup(p) {
        const screen = p.screen
        const props = new Proxy({}, { get: (_, k) => (mgr.state.open.find((s) => s.key === screen.key)?.props ?? screen.props ?? {})[k] })
        const scope = {
          props, game: mgr.gameFacade, ui: mgr.api, play: mgr.playView,
          close: (result) => mgr.close(screen.key, result),
          call: (name, ...a) => mgr.getGame()?.call(name, ...a),
          asset: (name) => mgr.host.assetUrl?.(name) || '',
        }
        // los componentes del diálogo (<rt-dialog-text>, <rt-portrait>, <rt-choices>, <rt-prompt>) leen de aquí
        provide('rtUi', { play: mgr.playView, game: mgr.gameFacade, ui: mgr.api, asset: scope.asset, assetById: (id) => mgr.host.assetUrlById?.(id) || '' })
        const mine = []
        let mounted = true
        const onUpdate = (fn) => { mgr.updaters.add(fn); mine.push(fn) }
        onUnmounted(() => { mounted = false; mine.forEach((f) => mgr.updaters.delete(f)) })
        let ret = {}
        if (c.setup && !mgr.host.previewReadOnly) {
          try {
            const args = SETUP_NAMES.map((n) => ({ ref, reactive, computed, watch, watchEffect, onMounted, onUnmounted, nextTick, onUpdate })[n] ?? scope[n])
            const game = mgr.getGame()
            const output = game?.scriptConsole(`Interfaz ${c.name}`, () => mounted) || createScriptConsole(() => mgr.host, `Interfaz ${c.name}`, () => mounted)
            scope.game = Object.create(mgr.gameFacade)
            scope.game.log = output.log
            args[SETUP_NAMES.indexOf('game')] = scope.game
            ret = c.setup(...args, output) || {}
          } catch (e) { mgr.error(c.name, e) }
        }
        return { ...scope, ...ret }
      },
      render: c.render,
    }
    // Vue entrega al padre los fallos del render, eventos y hooks del documento del autor.
    return {
      name: 'RtUiBoundary',
      props: content.props,
      setup(p) {
        const origin = mgr.getGame()
        let mounted = true
        onUnmounted(() => { mounted = false })
        onErrorCaptured(error => {
          if (mounted && !origin?._outputClosed) mgr.error(c.name, error)
          return false
        })
        return () => h(content, { screen: p.screen })
      },
    }
  }

  /** Variables CSS del tema (--rt-*) para el contenedor raíz. `host.assetUrlById(id)` resuelve la imagen de ventana. */
  themeStyle() {
    const t = normalizeTheme(this.getTheme())
    void this.state.themeRev
    return themeVars(t, { imgUrl: t.bgImage ? this.host.assetUrlById?.(t.bgImage) || '' : '' })
  }
  /** @font-face de la fuente importada (o cadena vacía). */
  themeFontCss() {
    const t = normalizeTheme(this.getTheme()); void this.state.themeRev
    const u = t.font === 'asset' && t.fontAsset ? this.host.assetUrlById?.(t.fontAsset) : ''
    return u ? `@font-face{font-family:'LFThemeFont';src:url('${u}');font-display:block}` : ''
  }
  get theme() { return normalizeTheme(this.getTheme()) }

  cssOf(docId) { return this.compiled(docId)?.css || '' }
  clsOf(docId) { return uiClass(docId) }

  // ---------- qué se muestra ----------
  get modalOpen() { return this.state.open.some((s) => s.modal) || this.canvases().some((c) => c.shown && c.modal && this.doc(c.ui)) }

  /** Lista ordenada de pantallas visibles. Se evalúa dentro de un computed: reacciona a play, a las abiertas y a los documentos. */
  screens() {
    const out = []
    const pv = this.state.preview
    if (pv) {
      const c = this.compiled(pv.docId)
      if (c) out.push({ key: 'preview', docId: c.doc.id, props: pv.props || {}, layer: 1, modal: false, interactive: true, role: null })
      return out
    }
    const slots = this.getConfig()?.slots || {}
    const pl = this.playView, modal = this.modalOpen
    // @deprecated — roles antiguos («Interfaz del juego»): solo si la escena no tiene Canvas con ese uso
    const add = (role, id, extra = 0, visible = true) => {
      if (!id || !visible || !this.doc(id)) return false
      const r = ROLE_BY_KEY[role]
      out.push({ key: role + ':' + id, docId: this.doc(id).id, props: {}, layer: r.layer + extra, modal: false, interactive: !!r.interactive, role })
      return true
    }
    ;(slots.hud || []).forEach((id, i) => add('hud', id, i * 0.01))
    // el menú de pausa ya no se muestra al jugar ni al soltar el ratón (un clic en el juego vuelve a capturarlo); el rol se conserva en los datos
    const canvases = this.canvases()
    // nodos Canvas sin uso: cada uno dibuja su recurso .ui mientras está visible
    for (const c of canvases) {
      if (c.role || !c.shown || !this.doc(c.ui)) continue
      out.push({ key: 'canvas:' + c.id, docId: this.doc(c.ui).id, props: {}, layer: c.layer, modal: !!c.modal, interactive: c.interactive || !!c.modal, alpha: c.alpha, role: null, canvas: c.id })
    }
    // Compatibilidad: Canvas antiguo → rol antiguo → recurso del proyecto → respaldo integrado
    for (const r of SYSTEM_ROLES) {
      const mine = canvases.filter((c) => c.role === r.key)
      const visible = roleVisible(r.key, pl, modal)
      if (mine.length) {
        if (!visible) continue
        for (const c of mine) {
          const d = c.shown && (c.ui ? this.doc(c.ui) : this.doc('sys:' + r.key))
          if (d) out.push({ key: 'canvas:' + c.id, docId: d.id, props: {}, layer: c.layer, modal: !!c.modal, interactive: c.interactive || !!c.modal, alpha: c.alpha, role: r.key, canvas: c.id })
        }
        continue
      }
      if (slots[r.key] && ROLE_BY_KEY[r.key]) { if (visible) add(r.key, slots[r.key]); if (this.doc(slots[r.key])) continue }
      if (visible) out.push({ key: 'sys:' + r.key, docId: this.doc('sys:' + r.key).id, props: {}, layer: r.layer, modal: false, interactive: false, role: r.key })
    }
    for (const s of this.state.open) {
      const d = this.doc(s.docId)
      if (d) out.push({ key: s.key, docId: d.id, props: s.props, layer: s.layer, modal: s.modal, interactive: s.modal, role: null })
    }
    return out.sort((a, b) => a.layer - b.layer)
  }

  /** Nodos Canvas de la escena con su visibilidad efectiva (la que fija el script gana sobre la del Inspector). */
  canvases() {
    return (this.getCanvases() || []).map((c) => ({ ...c, shown: c.id in this.state.canvas ? !!this.state.canvas[c.id] : c.visible }))
  }
  findCanvas(x) {
    const q = String(x ?? '').toLowerCase()
    const list = this.canvases()
    return list.find((c) => c.id === x) || list.find((c) => c.name.toLowerCase() === q) || null
  }
  setCanvas(x, on) {
    const c = this.findCanvas(x)
    if (!c) { this.error('ui.canvas', new Error(`No existe el Canvas «${x}»`)); return false }
    this.state.canvas[c.id] = on === 'toggle' ? !c.shown : !!on
    if (c.modal) this.host.onModal?.() // un Canvas modal libera el ratón y pausa igual que una pantalla modal
    return true
  }

  // ---------- pantallas abiertas por el juego ----------
  open(name, props = {}, opts = {}) {
    const d = this.doc(name)
    if (!d) { this.error('ui.open', new Error(`No existe la interfaz «${name}»`)); return Promise.resolve(undefined) }
    const c = this.compiled(d.id)
    const key = d.id
    const cur = this.state.open.find((s) => s.key === key)
    if (cur) { cur.props = { ...props }; return this.resolvers.get(key)?.promise ?? Promise.resolve(undefined) }
    const modal = opts.modal ?? !!c?.attrs.modal
    const layer = Number(opts.layer ?? c?.attrs.layer ?? 50)
    let resolve
    const promise = new Promise((r) => { resolve = r })
    this.resolvers.set(key, { resolve, promise })
    this.state.open.push({ key, docId: d.id, props: { ...props }, modal, layer })
    this.host.onModal?.()
    return promise
  }

  close(nameOrKey, result) {
    let s
    if (nameOrKey == null) {
      const m = [...this.state.open].reverse(); s = m.find((x) => x.modal) || m[0]
      if (!s) { const cv = this.canvases().filter((c) => c.shown && c.modal).sort((a, b) => b.layer - a.layer)[0]; if (cv) return this.setCanvas(cv.id, false) } // Esc cierra el Canvas modal superior
    } else {
      const d = this.doc(nameOrKey)
      s = this.state.open.find((x) => x.key === nameOrKey || (d && x.key === d.id))
    }
    if (!s) return false
    this.state.open.splice(this.state.open.indexOf(s), 1)
    const r = this.resolvers.get(s.key)
    this.resolvers.delete(s.key)
    r?.resolve(result)
    this.host.onModal?.()
    return true
  }

  closeAll() { while (this.state.open.length) this.close(this.state.open.at(-1).key) }
  isOpen(name) { const d = this.doc(name); return !!d && this.state.open.some((s) => s.key === d.id) }

  /** Vuelve a cero (al empezar o terminar el juego). */
  reset() {
    for (const [, r] of this.resolvers) r.resolve(undefined)
    this.resolvers.clear()
    this.state.open.splice(0)
    this.state.errors.splice(0)
    this.state.rev = 0; this.state.time = 0
    for (const k of Object.keys(this.state.canvas)) delete this.state.canvas[k]
    this.updaters.clear()
  }

  // ---------- reloj del juego ----------
  /** El juego avisa cada fotograma: así las pantallas se redibujan al cambiar interruptores/variables. */
  sync(rev, time, dt = 0) {
    if (this.state.rev !== rev) this.state.rev = rev
    if (time - this._timeAt >= 0.1 || time < this._timeAt) { this._timeAt = time; this.state.time = time }
    if (dt) for (const f of [...this.updaters]) {
      const game = this.getGame()
      const report = e => { if (!game?._outputClosed && this.updaters.has(f)) this.error('onUpdate', e) }
      try { const result = f(dt); if (result?.catch) result.catch(report) } catch (e) { report(e) }
    }
  }

  error(where, e) {
    const msg = `Interfaz ${where}: ${e?.message || e}`
    if (this.state.errors.length < 50) this.state.errors.push(msg)
    this.host.error ? this.host.error(msg, e) : console.error(msg)
  }

  // ---------- APIs ----------
  /** `game` dentro de las pantallas: la API normal, pero leerla registra la dependencia para redibujar. */
  _facade() {
    const mgr = this
    return new Proxy({}, {
      get(_, k) { void mgr.state.rev; void mgr.state.time; const a = mgr.getGame()?.api; return a ? a[k] : NO_GAME[k] },
      has(_, k) { return k in (mgr.getGame()?.api || {}) },
    })
  }

  _buildApi() {
    const m = this
    return {
      open: (name, props, opts) => m.open(name, props, opts),
      close: (name, result) => m.close(name, result),
      toggle: (name, props, opts) => (m.isOpen(name) ? (m.close(name), Promise.resolve(undefined)) : m.open(name, props, opts)),
      isOpen: (name) => m.isOpen(name),
      closeAll: () => m.closeAll(),
      // nodos Canvas: mostrar / ocultar por nombre
      showCanvas: (name) => m.setCanvas(name, true),
      hideCanvas: (name) => m.setCanvas(name, false),
      toggleCanvas: (name) => m.setCanvas(name, 'toggle'),
      isCanvasVisible: (name) => !!m.findCanvas(name)?.shown,
      canvas: (name) => {
        const c = m.findCanvas(name)
        if (!c) { m.error('ui.canvas', new Error(`No existe el Canvas «${name}»`)); return null }
        return {
          get name() { return m.findCanvas(c.id)?.name },
          get visible() { return !!m.findCanvas(c.id)?.shown },
          set visible(v) { m.setCanvas(c.id, !!v) },
          show: () => m.setCanvas(c.id, true), hide: () => m.setCanvas(c.id, false), toggle: () => m.setCanvas(c.id, 'toggle'),
        }
      },
      // acciones del sistema para las pantallas por defecto (diálogo, opciones, pausa)
      next: () => m.host.advance?.(),
      pick: (i) => m.host.pick?.(i),
      resume: () => m.host.resume?.(),
      quit: () => m.host.quit?.(),
    }
  }
}

export { ROLES }
