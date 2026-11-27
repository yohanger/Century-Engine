// Motor de audio (WebAudio): mezclador con grupos (buses) y efectos, voces 3D/UI y medidores.
// Cadena de un grupo:  entrada → [efectos en orden] → volumen → medidor → entrada del grupo padre (Salida / send) → … → Master
import { MASTER_ID, dbToGain, normalizeAudio, normalizeSource, normalizeFx } from './config.js'
import { makeEffect } from './effects.js'
import { scheduleVolumeAutomation } from './automation.js'

class Voice {
  constructor(engine, buffer, opts) {
    this.engine = engine; this.buffer = buffer; this.opts = opts
    this.src = null; this.playing = false; this.paused = false; this.offset = 0; this.t0 = 0; this._stopping = false; this._fadingSource = null; this.finishedNaturally = false
    this.volume = opts.volume ?? 1; this.pitch = opts.pitch ?? 1; this.loop = !!opts.loop; this.mute = !!opts.mute
    this.done = new Promise((r) => { this._resolve = r })
    const ctx = engine.ctx
    this.gain = ctx.createGain()
    // Solo las voces con puntos reciben esta etapa: no interferir con ramp()/fade/Stop.
    this.volumeAutomation = Array.isArray(opts.volumeAutomation) && opts.volumeAutomation.length ? opts.volumeAutomation : null
    this.automationGain = this.volumeAutomation ? ctx.createGain() : null
    this.automationElapsed = Math.max(0, opts.automationElapsed || 0)
    this.automationRate = Math.max(0.01, opts.automationRate || 1)
    this.automationClock = ctx.currentTime
    this._automationFade = null; this._automationFadeResume = null
    // Cadena privada por voz; los FX del bus se aplican después y no se duplican.
    this.clipEffects = []
    this.fxInput = opts.fx?.length ? ctx.createGain() : null
    let tail = this.fxInput
    for (const params of opts.fx || []) {
      const fx = makeEffect(ctx, params.type)
      fx.update(params, params.on)
      tail.connect(fx.input)
      tail = fx.output
      this.clipEffects.push({ params, fx })
    }
    if (this.automationGain) this.automationGain.connect(this.gain)
    if (tail) tail.connect(this.automationGain || this.gain)
    const wetTail = this.clipEffects.reduce((seconds, { params }) => {
      if (!params.on) return seconds
      if (params.type === 'reverb') return seconds + params.time
      if (params.type === 'echo') {
        // Un eco con feedback cero todavía produce un retardo completo.
        const repeats = params.feedback > 0 ? Math.max(1, Math.log(0.001) / Math.log(params.feedback)) : 1
        return seconds + Math.min(12, params.time * repeats)
      }
      return seconds
    }, 0)
    this.fxTail = wetTail > 0 ? Math.min(20, wetTail + 0.1) : 0
    if (opts.mode === '3d') {
      const p = (this.panner = ctx.createPanner())
      p.panningModel = opts.hrtf ? 'HRTF' : 'equalpower'
      p.distanceModel = opts.rolloff === 'linear' ? 'linear' : 'inverse'
      p.refDistance = opts.minDistance ?? 1; p.maxDistance = opts.maxDistance ?? 30; p.rolloffFactor = 1
      p.coneInnerAngle = opts.coneInner ?? 360; p.coneOuterAngle = opts.coneOuter ?? 360; p.coneOuterGain = opts.coneOuterGain ?? 0
      this.gain.connect(p)
      if (opts.occlusion) {
        // Solo las fuentes que lo piden tienen un filtro propio, antes de entrar al mezclador.
        this.occlusionFilter = ctx.createBiquadFilter(); this.occlusionFilter.type = 'lowpass'; this.occlusionFilter.frequency.value = 22000
        this.occlusionGain = ctx.createGain(); this.occlusionGain.gain.value = 1
        p.connect(this.occlusionFilter); this.occlusionFilter.connect(this.occlusionGain); this.occlusionGain.connect(engine.groupInput(opts.group))
      } else p.connect(engine.groupInput(opts.group))
      if (opts.position) this.setPosition(opts.position, opts.forward)
    } else this.gain.connect(opts.dest || engine.groupInput(opts.group))
    this._applyGain()
  }
  _applyGain() { this.gain.gain.value = this.mute ? 0 : this.volume }
  // Cambiar velocidad temporal no cancela la ganancia de fundidos.
  setAutomationPosition(elapsed, rate = this.automationRate) {
    if (!this.automationGain) return
    this.automationElapsed = Math.max(0, elapsed)
    this.automationRate = Math.max(0.01, rate)
    this.automationClock = this.engine.ctx.currentTime
    if (this.isPlaying) scheduleVolumeAutomation(this.automationGain.gain, this.automationClock, this.volumeAutomation, this.automationElapsed, this.automationRate)
  }
  setPosition(p, fwd) {
    const n = this.panner; if (!n) return
    this.opts.position = [p[0], p[1], p[2]]
    n.positionX.value = p[0]; n.positionY.value = p[1]; n.positionZ.value = p[2]
    if (fwd) { n.orientationX.value = fwd[0]; n.orientationY.value = fwd[1]; n.orientationZ.value = fwd[2] }
  }
  /** Oclusión por voz: suaviza el cambio sin tocar distancia, volumen ni efectos del grupo. */
  setOcclusion(blocked) {
    if (!this.occlusionFilter) return
    const t = this.engine.ctx.currentTime
    this.occlusionFilter.frequency.setTargetAtTime(blocked ? 850 : 22000, t, blocked ? 0.07 : 0.13)
    this.occlusionGain.gain.setTargetAtTime(blocked ? 0.35 : 1, t, blocked ? 0.07 : 0.13)
  }
  setVolume(v) { this.volume = Math.max(0, v); this._applyGain() }
  /** Fundido: de `from` (o el volumen actual) a `to` en `seconds` (rampa lineal de WebAudio). */
  ramp(to, seconds = 0, from = null) {
    const g = this.gain.gain, t = this.engine.ctx.currentTime
    const start = this.mute ? 0 : from ?? g.value, end = this.mute ? 0 : to
    g.cancelScheduledValues(t); g.setValueAtTime(start, t)
    if (seconds > 0) g.linearRampToValueAtTime(end, t + seconds); else g.setValueAtTime(end, t)
    if (this.automationGain) this._automationFade = seconds > 0 ? { start, end, at: t, seconds } : null
    this.volume = to
  }
  setMute(m) { this.mute = !!m; this._applyGain() }
  setPitch(p) { this.pitch = Math.max(0.05, p); if (this.src) this.src.playbackRate.value = this.pitch }
  setLoop(l) { this.loop = !!l; if (this.src) this.src.loop = this.loop }
  get isPlaying() { return this.playing && !this.paused }
  get time() { return this.paused || !this.playing ? this.offset : (this.offset + (this.engine.ctx.currentTime - this.t0) * this.pitch) % (this.loop ? this.buffer.duration : Infinity) }
  start(delay = 0, offset = 0) {
    const ctx = this.engine.ctx
    const s = ctx.createBufferSource()
    s.buffer = this.buffer; s.loop = this.loop; s.playbackRate.value = this.pitch
    s.connect(this.fxInput || this.automationGain || this.gain)
    s.onended = () => {
      if (this.src === s && !this.paused && !this._stopping) {
        this.finishedNaturally = true
        this.playing = false; this.src = null; this.engine._drop(this, true); this._resolve()
      }
    }
    this.src = s; this.playing = true; this.paused = false; this.offset = offset
    this.t0 = ctx.currentTime + delay
    if (this.automationGain) {
      this.automationClock = this.t0
      scheduleVolumeAutomation(this.automationGain.gain, this.t0, this.volumeAutomation, this.automationElapsed, this.automationRate)
    }
    s.start(ctx.currentTime + delay, offset)
  }
  pause() {
    if (!this.isPlaying) return
    if (this.automationGain) {
      const t = this.engine.ctx.currentTime
      this.automationElapsed += Math.max(0, t - this.automationClock) * this.automationRate
      if (this._automationFade) {
        const { start, end, at, seconds } = this._automationFade
        const passed = Math.min(seconds, Math.max(0, t - at))
        if (passed < seconds) {
          const level = start + (end - start) * passed / seconds
          this._automationFadeResume = { from: level, to: end, remaining: seconds - passed }
          this.gain.gain.cancelScheduledValues(t); this.gain.gain.setValueAtTime(level, t)
        } else this._automationFadeResume = null
        this._automationFade = null
      }
    }
    this.offset = this.time; this.paused = true
    // Silenciar también las colas de delay/reverb mientras se pausa el Preview.
    if (this.fxInput) this.gain.gain.value = 0
    if (this.automationGain) {
      const t = this.engine.ctx.currentTime, g = this.automationGain.gain
      g.cancelScheduledValues(t); g.setValueAtTime(0, t)
    }
    const s = this.src; this.src = null; try { s.stop() } catch { /* ya parada */ }
  }
  resume() {
    if (this.paused) {
      this.start(0, this.offset % this.buffer.duration)
      const fade = this._automationFadeResume; this._automationFadeResume = null
      if (fade) this.ramp(fade.to, fade.remaining, fade.from)
      else if (this.fxInput) this._applyGain()
    }
  }
  stop(fade = 0) {
    if (this._stopping) {
      if (fade <= 0 && this._fadingSource) {
        const pending = this._fadingSource
        this._fadingSource = null; pending.onended = null
        try { pending.stop() } catch { /* ya parada */ }
        this.engine._drop(this); this._resolve()
      }
      return
    }
    this._stopping = true
    if (this.automationGain) this.automationGain.gain.cancelScheduledValues(this.engine.ctx.currentTime)
    const s = this.src
    this.playing = false; this.paused = false; this.src = null
    if (s) {
      s.onended = null
      try {
        if (fade > 0) {
          const t = this.engine.ctx.currentTime, g = this.gain.gain
          g.cancelScheduledValues(t); g.setValueAtTime(g.value, t)
          g.linearRampToValueAtTime(0, t + fade)
          // El sonido sigue conectado hasta que WebAudio termina el fundido.
          this._fadingSource = s
          s.onended = () => { this._fadingSource = null; s.onended = null; this.engine._drop(this, true); this._resolve() }
          s.stop(t + fade + 0.02)
          return
        }
        s.stop()
      } catch { this._fadingSource = null; s.onended = null /* ya parada */ }
    }
    this.engine._drop(this); this._resolve()
  }
  dispose() {
    if (this._disposeTimer) { clearTimeout(this._disposeTimer); this._disposeTimer = null }
    this.engine._tails?.delete(this)
    try { this.fxInput?.disconnect(); this.automationGain?.disconnect(); this.gain.disconnect(); this.panner?.disconnect(); this.occlusionFilter?.disconnect(); this.occlusionGain?.disconnect() } catch { /* nada */ }
    for (const { fx } of this.clipEffects) {
      try { fx.input.disconnect(); fx.output.disconnect(); fx.dispose() } catch { /* contexto cerrado */ }
    }
    this.clipEffects.length = 0
  }
}

/** El decodificador consume su ArrayBuffer. La copia protege los bytes del recurso. */
export function decodeAudioBytes(context, bytes) {
  const copy = ArrayBuffer.isView(bytes)
    ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    : bytes.slice(0)
  return context.decodeAudioData(copy)
}

export class AudioEngine {
  constructor() {
    this.ctx = null
    this.cfg = normalizeAudio({})
    this.override = {}            // { grupo: { volume?, mute?, fx: { id|tipo: {on, …} }, extra: [fx] } } cambios en tiempo de ejecución (scripts); no tocan el proyecto
    this.nodes = new Map()        // id → { input, vol, meter, buf, chain: [{ fid, type, fx }], sig, parent }
    this.voices = new Set()
    this._tails = new Set()
    this.buffers = new Map()      // id de asset → { source, buffer }
    this.loader = null            // async (id) → { name, bytes }
    this._decoding = new Map()
    this._unlock = () => { if (this.ctx && this.ctx.state !== 'running') this.ctx.resume().catch(() => {}) }
  }

  setLoader(fn, identify) {
    if (this.loader !== fn || this.identify !== identify) {
      this.buffers.clear()
      this._decoding.clear()
    }
    this.loader = fn
    this.identify = identify
  }

  /** Crea el contexto (hace falta un gesto del usuario: botón Probar, Jugar, clic…). */
  /** Silencio del EDITOR (botón «Silenciar audio» de la vista Juego): no toca el mezclador del proyecto. */
  setMuted(m) { this.muted = !!m; if (this.out) this.out.gain.value = this.muted ? 0 : 1 }

  /** Amortigua todo el sonido (0 = nada, 1 = como bajo el agua): un filtro paso bajo que se mueve con suavidad. */
  setMuffle(k) {
    if (!this.lp) return
    const hz = 22000 * Math.pow(500 / 22000, Math.max(0, Math.min(1, k)))
    this.lp.frequency.setTargetAtTime(hz, this.ctx.currentTime, 0.08)
  }

  async ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) throw new Error('Este navegador no tiene WebAudio')
      this.ctx = new AC({ latencyHint: 'interactive' })
      this.out = this.ctx.createGain(); this.out.gain.value = this.muted ? 0 : 1
      this.lp = this.ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 22000; this.lp.Q.value = 0.5 // «bajo el agua» (setMuffle)
      this.out.connect(this.lp); this.lp.connect(this.ctx.destination)
      this._build()
      for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, this._unlock, true)
    }
    if (this.ctx.state !== 'running') { try { await this.ctx.resume() } catch { /* se reintenta con el siguiente gesto */ } }
    return this.ctx
  }

  _build() {
    this.nodes.clear()
    // el Master primero: los demás se conectan a su padre en apply()
    for (const g of [...this.cfg.groups].sort((a, b) => (a.id === MASTER_ID ? -1 : b.id === MASTER_ID ? 1 : 0))) this._makeGroup(g)
    this.apply()
  }

  _makeGroup(g) {
    const ctx = this.ctx, n = { chain: [], sig: '', parent: undefined }
    n.input = ctx.createGain(); n.vol = ctx.createGain()
    n.meter = ctx.createAnalyser(); n.meter.fftSize = 512; n.buf = new Float32Array(512)
    n.vol.connect(n.meter)
    this.nodes.set(g.id, n)
    n.input.connect(n.vol)
  }

  /** Usa la configuración del proyecto. */
  configure(audio) {
    this.cfg = normalizeAudio(audio)
    if (!this.ctx) return
    const ids = new Set(this.cfg.groups.map((g) => g.id))
    for (const g of this.cfg.groups) if (!this.nodes.has(g.id)) this._makeGroup(g)
    for (const [id, n] of [...this.nodes]) if (!ids.has(id)) { try { n.vol.disconnect(); n.input.disconnect() } catch { /* nada */ } for (const c of n.chain) c.fx.dispose(); this.nodes.delete(id) }
    this.apply()
  }

  /** Configuración efectiva de un grupo = proyecto + cambios de los scripts. */
  eff(g) {
    const o = this.override[g.id]
    if (!o) return g
    const withOverride = (f) => ({ ...f, ...(o.fx?.[f.id] || {}), ...(o.fx?.[f.type] || {}) })
    return { ...g, volume: o.volume ?? g.volume, mute: o.mute ?? g.mute, fx: [...g.fx.map(withOverride), ...(o.extra || []).map(withOverride)] }
  }

  /** Cadena de efectos: reconecta entrada → efectos → volumen solo si cambió el orden/tipos. */
  _rewire(g, n) {
    const sig = g.fx.map((f) => f.id + ':' + f.type).join(',')
    if (sig === n.sig) return
    n.sig = sig
    try { n.input.disconnect() } catch { /* nada */ }
    for (const c of n.chain) { try { c.fx.output.disconnect() } catch { /* nada */ } }
    const old = new Map(n.chain.map((c) => [c.fid, c]))
    const next = []
    for (const f of g.fx) {
      const c = old.get(f.id)
      if (c && c.type === f.type) { old.delete(f.id); try { c.fx.input.disconnect() } catch { /* nada */ } next.push(c) } else next.push({ fid: f.id, type: f.type, fx: makeEffect(this.ctx, f.type) })
    }
    for (const c of old.values()) { try { c.fx.input.disconnect() } catch { /* nada */ } c.fx.dispose() }
    n.chain = next
    let prev = n.input
    for (const c of next) { prev.connect(c.fx.input); prev = c.fx.output }
    prev.connect(n.vol)
  }

  /** Vuelca la configuración a los nodos de audio (volumen, mute/solo, cadena de efectos, enrutado). */
  apply() {
    const ctx = this.ctx; if (!ctx) return
    const t = ctx.currentTime
    const groups = this.cfg.groups.map((g) => this.eff(g))
    const anySolo = groups.some((g) => g.solo)
    for (const g of groups) {
      const n = this.nodes.get(g.id); if (!n) continue
      this._rewire(g, n)
      for (const c of n.chain) { const f = g.fx.find((x) => x.id === c.fid); if (f) c.fx.update(f, f.on && !g.bypass) }
      const silent = g.mute || (anySolo && !g.solo && !this._soloAncestorOrChild(g, groups) && g.id !== MASTER_ID)
      n.vol.gain.cancelScheduledValues(t); n.vol.gain.setTargetAtTime(silent ? 0 : dbToGain(g.volume), t, 0.015)
      // salida (send) → padre
      const parent = g.id === MASTER_ID ? null : g.parent || MASTER_ID
      if (n.parent !== parent) {
        try { n.vol.disconnect(); n.vol.connect(n.meter) } catch { /* nada */ }
        if (g.id === MASTER_ID) n.vol.connect(this.out)
        else n.vol.connect((this.nodes.get(parent) || this.nodes.get(MASTER_ID)).input)
        n.parent = parent
      }
    }
  }
  /** Con solo activo, también suenan los antecesores (para que llegue al Master) y los hijos del grupo en solo. */
  _soloAncestorOrChild(g, groups) {
    const byId = new Map(groups.map((x) => [x.id, x]))
    for (const s of groups) {
      if (!s.solo) continue
      let p = byId.get(s.parent)
      while (p) { if (p.id === g.id) return true; p = byId.get(p.parent) }
      let q = byId.get(g.parent)
      while (q) { if (q.id === s.id) return true; q = byId.get(q.parent) }
    }
    return false
  }

  setOverride(id, patch) {
    const o = (this.override[id] ||= {})
    for (const [k, v] of Object.entries(patch)) {
      if (k === 'fx') { o.fx ||= {}; for (const [fk, fv] of Object.entries(v)) o.fx[fk] = { ...(o.fx[fk] || {}), ...fv } } else o[k] = v
    }
    this.apply()
  }
  /** Añade un efecto temporal (solo en ejecución) a un grupo. */
  addExtraFx(id, fx) { const o = (this.override[id] ||= {}); o.extra ||= []; o.extra.push(fx); this.apply() }
  clearOverrides() { this.override = {}; this.apply() }

  /**
   * Golpe sintético (pasos, impactos): ruido filtrado + golpe grave, sin archivos. `def` = { f, q, d, g, lo, noise } (ver SURFACES).
   * opts: { volume (0–1), pitch (~1), group ('sfx'), pan (−1…1) }. Devuelve false si el audio aún no está listo.
   */
  blip(def, { volume = 1, pitch = 1, group = 'sfx', pan = 0 } = {}) {
    const ctx = this.ctx
    if (!ctx || ctx.state !== 'running') return false
    const t = ctx.currentTime, dur = Math.max(0.03, def.d / Math.max(0.3, pitch))
    const n = Math.ceil(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1
      last = def.noise === 'brown' ? (last + 0.04 * w) / 1.04 * 3.2 : w
      const e = Math.pow(1 - i / n, 2.2) * Math.min(1, i / (ctx.sampleRate * 0.004))
      d[i] = last * e
    }
    const src = ctx.createBufferSource(); src.buffer = buf
    const flt = ctx.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = def.f * pitch; flt.Q.value = def.q
    const g = ctx.createGain(); g.gain.value = def.g * volume
    const out = ctx.createGain(); out.gain.value = 1
    src.connect(flt); flt.connect(g); g.connect(out)
    if (def.lo > 0) { // golpe grave del talón
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(130 * pitch, t); o.frequency.exponentialRampToValueAtTime(55 * pitch, t + 0.08)
      const og = ctx.createGain(); og.gain.setValueAtTime(def.lo * volume * 0.6, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.09)
      o.connect(og); og.connect(out); o.start(t); o.stop(t + 0.1)
    }
    let tail = out
    if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; out.connect(p); tail = p }
    tail.connect(this.groupInput(group))
    src.start(t)
    src.onended = () => { try { tail.disconnect() } catch { /* ya soltado */ } }
    return true
  }

  groupInput(id) { return (this.nodes.get(id) || this.nodes.get('sfx') || this.nodes.get(MASTER_ID)).input }

  /** Nivel RMS (0–1) y pico de un grupo, para los medidores del mezclador. */
  level(id) {
    const n = this.nodes.get(id); if (!n) return 0
    n.meter.getFloatTimeDomainData(n.buf)
    let s = 0
    for (let i = 0; i < n.buf.length; i++) s += n.buf[i] * n.buf[i]
    return Math.sqrt(s / n.buf.length)
  }

  // ---------- clips ----------
  cachedBuffer(id, source) {
    const entry = this.buffers.get(id)
    return entry?.source === source ? entry?.buffer : undefined
  }
  async buffer(id) {
    const source = this.identify?.(id) ?? this.loader
    const cached = this.cachedBuffer(id, source)
    if (cached) return cached
    const pending = this._decoding.get(id)
    if (pending && pending.source === source) return pending.promise
    const task = { source }
    const current = () => this._decoding.get(id) === task && (this.identify?.(id) ?? this.loader) === source
    const loader = this.loader, context = this.ctx
    task.promise = (async () => {
      const asset = await loader?.(id)
      if (!asset || !current()) return null
      const buffer = await decodeAudioBytes(context, asset.bytes)
      if (!current()) return null
      this.buffers.set(id, { source, buffer })
      return buffer
    })().finally(() => { if (this._decoding.get(id) === task) this._decoding.delete(id) })
    this._decoding.set(id, task)
    return task.promise
  }
  forget(id) { this.buffers.delete(id); this._decoding.delete(id) }

  /** Reproduce un clip. opts: { group, mode:'3d'|'ui', volume, pitch, loop, position, forward, delay, minDistance, maxDistance, rolloff, … } */
  async play(clipId, opts = {}) {
    await this.ensure()
    const buf = await this.buffer(clipId)
    return buf ? this._voice(buf, opts) : null
  }

  /** Reproduce un AudioBuffer ya hecho (sonido sintetizado, p. ej. el trueno procedural). Mismas opciones que play(), más `dest` (un nodo propio en lugar del grupo) y `offset` (s). */
  async playBuffer(buffer, opts = {}) {
    await this.ensure()
    return this._voice(buffer, opts)
  }

  _voice(buf, opts) {
    const o = { ...normalizeSource(opts), position: opts.position, forward: opts.forward, dest: opts.dest, fx: Array.isArray(opts.fx) ? opts.fx.map(normalizeFx).filter(Boolean) : [], volumeAutomation: opts.volumeAutomation, automationElapsed: opts.automationElapsed, automationRate: opts.automationRate }
    o.volume = opts.volume ?? o.volume
    const v = new Voice(this, buf, o)
    this.voices.add(v)
    v.start(o.delay || 0, opts.offset || 0)
    return v
  }
  _drop(v, preserveTail = false) {
    this.voices.delete(v)
    // El final natural deja sonar las colas; Stop las cancela explícitamente.
    const ms = preserveTail ? Math.max(60, Math.ceil(v.fxTail * 1000)) : 60
    if (preserveTail && v.fxTail > 0) this._tails.add(v)
    v._disposeTimer = setTimeout(() => v.dispose(), ms)
  }

  stopAll(group = null, fade = 0) {
    for (const v of [...this.voices]) if (!group || v.opts.group === group) v.stop(fade)
    for (const v of [...this._tails]) if (!group || v.opts.group === group) v.dispose()
  }
  pauseAll(p = true) { for (const v of this.voices) p ? v.pause() : v.resume() }

  setListener(pos, fwd, up = [0, 1, 0]) {
    const l = this.ctx?.listener; if (!l) return
    if (l.positionX) {
      l.positionX.value = pos[0]; l.positionY.value = pos[1]; l.positionZ.value = pos[2]
      l.forwardX.value = fwd[0]; l.forwardY.value = fwd[1]; l.forwardZ.value = fwd[2]
      l.upX.value = up[0]; l.upY.value = up[1]; l.upZ.value = up[2]
    } else { l.setPosition(pos[0], pos[1], pos[2]); l.setOrientation(fwd[0], fwd[1], fwd[2], up[0], up[1], up[2]) }
  }

  dispose() {
    this.stopAll()
    for (const v of [...this._tails]) v.dispose()
    for (const ev of ['pointerdown', 'keydown']) window.removeEventListener(ev, this._unlock, true)
    this.ctx?.close().catch(() => {}); this.ctx = null; this.nodes.clear(); this.buffers.clear(); this._decoding.clear()
  }
}

/** Motor único (editor, vista previa y modo Jugar comparten el mismo mezclador). */
export function getAudio() { return (globalThis.__rtAudio ??= new AudioEngine()) }
