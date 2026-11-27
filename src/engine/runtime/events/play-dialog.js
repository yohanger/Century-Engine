// Diálogos (voz, escritura) y temporizadores
import { markRaw } from '@vue/reactivity'
import { normalizeLoc, locActive, startLanguage } from '../i18n/localization.js'

export const dialogMethods = {
  /**
   * Voz de un diálogo («Mostrar texto» con audio, o game.say con { voice }): suena en el grupo «Voz» del mezclador. Si `voiceAdvance`
   * (por defecto), al terminar el audio se muestra todo el texto y el diálogo pasa solo al siguiente; si el jugador avanza antes, la voz se corta.
   */
  _dialogVoice(d, m) {
    const api = this.audio?.script
    if (!m.voice || !api) return
    let h = null
    try { h = api.play(m.voice, { group: m.voiceGroup || 'voice', ui: true }) } catch (e) { console.warn('Voz:', e); return }
    if (!h) return
    d.voice = markRaw(h)
    d.voiceAdvance = m.voiceAdvance !== false
    h.done?.then(() => {
      d.voiceEnded = true
      if (!d.voiceAdvance || this.state.dialog !== d) return
      d.shown = d.text.length; d.done = true; d.waitInput = false; d.hold = 0
      // un instante para leer la última palabra y se pasa al siguiente texto
      setTimeout(() => { if (this.state.dialog === d) { this.state.dialog = null; this._endDialog(d) } }, 350)
    })
  },
  /** Cierra un diálogo: corta su voz si sigue sonando y continúa el evento. */
  _endDialog(d) {
    if (d.voice && !d.voiceEnded) { try { d.voice.stop(0.08) } catch { /* ya parada */ } }
    d.resolve()
  },
  /** Idioma del juego (i18n/localization.js): en el juego exportado la tabla siempre se usa; en el editor solo con «Usar en el editor». */
  _locInit(raw) {
    const loc = normalizeLoc(raw)
    const saved = this.rt.storage.get('language') || ''
    const on = this.runtime ? locActive(loc) : loc.useInDev
    const lang = this.runtime ? startLanguage(loc, { saved, system: typeof navigator !== 'undefined' ? navigator.language : '' }) : loc.useInDev ? loc.devLang : loc.base
    this.game.setupLocalization(loc, { on, lang })
    this.state.lang = this.game.lang
  },

  /** Escritura progresiva del cuadro de diálogo con los códigos de escape (esperas \. \| \!, texto instantáneo \> \<, cierre automático \^). */
  _typeDialog(d, dt) {
    d.age += dt
    const auto = !!this.main && this._playerMode() === 'free' // en modo «Libre» los diálogos avanzan solos
    if (d.auto !== auto) d.auto = auto
    if (d.done) {
      // \^ cierra enseguida; \D[s] (o, en modo «Libre», 1 s) lo deja el tiempo indicado y sigue solo, sin clic
      const stay = d.msg?.autoClose ? 0.25 : d.msg?.stay ?? (d.auto ? 1 : null)
      // con voz sonando el diálogo no se cierra solo hasta que la voz termina (ver _dialogVoice)
      if (stay != null && d.age > stay && this.state.dialog === d && !(d.voice && d.voice.playing)) { this.state.dialog = null; this._endDialog(d) }
      return
    }
    if (d.waitInput) return
    if (d.hold > 0) { d.hold -= dt; return }
    const m = d.msg, n = d.text.length
    let budget = dt * (d.speed || this.ui.theme.speed || 48) // d.speed: la del control «Texto del diálogo» del diseñador
    while (budget > 0 && d.shown < n) {
      const i = Math.floor(d.shown)
      if (m && m.waits[i] && !d.seen?.has('w' + i)) { (d.seen ||= new Set()).add('w' + i); d.hold = m.waits[i]; return }
      if (m && m.inputs.includes(i) && !d.seen?.has('i' + i)) { (d.seen ||= new Set()).add('i' + i); d.waitInput = true; return }
      const fast = m && m.fast.some(([a, b]) => i >= a && i < b)
      d.shown = Math.min(n, i + 1); budget -= fast ? 0.05 : 1
    }
    if (d.shown >= n) { d.shown = n; d.done = true; d.age = 0 }
  },

  _timers(dt) {
    const fw = this.frameWait; this.frameWait = []
    for (const r of fw) r()
    for (const t of this.timers) t.t -= dt
    const done = this.timers.filter((t) => t.t <= 0)
    this.timers = this.timers.filter((t) => t.t > 0)
    for (const t of done) t.r()
    const invalid = this.tweens.filter((m) => m.valid && !m.valid())
    if (invalid.length) { this.tweens = this.tweens.filter((m) => !invalid.includes(m)); for (const m of invalid) m.r() }
    for (const m of [...this.tweens]) {
      m.t = Math.min(m.dur, m.t + dt)
      const k = m.dur > 0 ? m.t / m.dur : 1, e = k * k * (3 - 2 * k)
      if (m.fn) { m.fn(k, dt); continue }
      m.node.position.lerpVectors(m.from, m.to, e)
      m.node.updateMatrixWorld(true)
      this.phys?.syncNode(m.node, dt)
    }
    const fin = this.tweens.filter((m) => m.t >= m.dur)
    this.tweens = this.tweens.filter((m) => m.t < m.dur)
    for (const m of fin) m.r()
  },
}
