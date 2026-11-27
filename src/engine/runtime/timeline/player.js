// Reproductor de timelines. No toca three ni el DOM: habla con el juego a través de `host`.
//
//  host = {
//    camera(pose|null)            aplica (o quita) la cámara cinemática
//    node(nombre, prop, valor)    aplica el valor de una pista de nodo
//    audio(clave)                 reproduce / detiene un sonido
//    commands(lista, { name })    ejecuta una lista de comandos → { done: Promise }
//    method(nodoId, nombre, argumentos) llama un método público del nodo, sin ejecutar scripts durante seek
//    resolveCamera(clave)         pose de las claves «cámara de la escena» / «vista del jugador»
//    letterbox(porcentaje)        barras de cine
//  }
import { evalTimelineCamera, evalTimelineNode } from './eval.js'
import { sampleBakeTrack } from '../../../core/timeline/physics.js'

export class TimelineRunner {
  constructor(tl, host, { speed = 1, from = 0, onEnd = null } = {}) {
    this.tl = tl; this.host = host
    this.time = Math.max(0, from); this.speed = speed
    this.paused = false; this.finished = false; this.skipped = false
    this.blockers = 0
    // El montaje reúne claves de pistas distintas: su ejecución sigue el reloj global,
    // no el orden visual de las pistas. Conserva el orden de autoría en tiempos iguales.
    this.events = this._collectEvents()
    // Desde un tiempo avanzado no se repiten comandos, sonidos ni métodos anteriores.
    this.fired = new Set(this.events.filter(({ k }) => k.t < this.time).map(({ id }) => id))
    this.runs = []
    this.onEnd = onEnd
    this.done = new Promise((r) => { this._resolve = r })
    this._started = false
  }

  get playing() { return !this.finished && !this.paused }
  get progress() { return this.tl.duration > 0 ? Math.min(1, this.time / this.tl.duration) : 1 }

  /** Calendario temporal calculado una vez por reproducción (sin ordenar cada fotograma). */
  _events() { return this.events }
  _collectEvents() {
    return (this.tl.tracks || []).flatMap(tr =>
      !tr.muted && ['audio', 'commands', 'method'].includes(tr.kind)
        ? (tr.keys || []).map(k => ({ tr, k, id: `${tr.id}\0${k.id}` })) : [],
    ).sort((a, b) => a.k.t - b.k.t)
  }
  refreshEditedEvents() {
    this.events = this._collectEvents()
    for (const { k, id } of this.events) if (k.t < this.time) this.fired.add(id)
  }

  _fire({ tr, k, id }) {
    this.fired.add(id)
    if (tr.kind === 'audio') {
      try {
        const result = this.host.audio?.(k, this)
        if (result?.then) Promise.resolve(result).catch(error => this.host.error?.(error))
      } catch (error) { this.host.error?.(error) }
      return
    }
    if (tr.kind === 'method') {
      if (!tr.node || !k.method) { this.host.error?.(new Error('Timeline: pista o clave de método sin nodo/método')); return }
      try {
        const result = this.host.method?.(tr.node, k.method, k.args || [])
        if (result?.then) Promise.resolve(result).catch(error => this.host.error?.(error))
      } catch (error) { this.host.error?.(error) }
      return
    }
    if (!k.list?.length) return
    try {
      const r = this.host.commands?.(k.list, { name: k.name || tr.name })
      if (r?.cancel) this.runs.push(r)
      if (k.block && r?.done) {
        this.blockers++
        Promise.resolve(r.done).then(
          () => { this.blockers-- },
          error => { this.blockers--; this.host.error?.(error) },
        )
      }
    } catch (error) { this.host.error?.(error) }
  }

  /** Aplica el estado de todas las pistas en `this.time`. */
  _apply() {
    const h = this.host
    // El Editor ya aplica poses visuales con TimelinePreview; comparte solo el calendario.
    if (h.eventsOnly === true) return
    // Actualiza propiedad de cuerpos antes de aplicar muestras; también en seek y loop.
    h.bakeFrame?.(this.time)
    for (const tr of this.tl.tracks) {
      if (!tr.muted && tr.kind === 'node' && tr.node) {
        const value = evalTimelineNode(tr, this.time)
        if (value !== undefined) h.node?.(tr.node, tr.prop, value, { byId: tr.byId === true, sceneId: tr.sceneId })
      }
    }
    // Prioridad explícita: bake físico sobre pistas de Transform manuales. Nunca se simula Jolt al buscar tiempo.
    for (const tr of this.tl.tracks) if (!tr.muted && tr.kind === 'bake') {
      const pose = sampleBakeTrack(tr, this.time)
      if (pose) h.bake?.(tr.node, pose)
    }
    // Igual que Preview: resolver tras actualizar las transformaciones de la escena.
    let activeCamera = null
    for (const tr of this.tl.tracks) if (tr.kind === 'camera' && !tr.muted) {
      const pose = evalTimelineCamera(tr, this.time, (k) => h.resolveCamera?.(k))
      if (pose) activeCamera = pose
    }
    h.camera?.(activeCamera)
  }

  /** Avanza `dt` segundos. Devuelve true mientras siga activo. */
  update(dt) {
    if (this.finished) return false
    if (!this._started) { this._started = true; this.host.letterbox?.(this.tl.letterbox || 0) }
    if (this.paused || this.blockers > 0) { this._apply(); return true }
    this.time += dt * this.speed
    const ev = this._events()
    const dur = this.tl.duration
    const end = this.time >= dur
    const upto = end ? dur : this.time
    for (const e of ev) if (!this.fired.has(e.id) && e.k.t <= upto) this._fire(e)
    if (end) {
      if (this.tl.loop) { this.time -= dur; this.fired.clear(); this.host.audioLoop?.(this); this._apply(); return true }
      this.time = dur; this._apply()
      // Una orden bloqueante al final debe terminar antes de liberar cámara y control.
      if (this.blockers > 0) return true
      this._finish(); return false
    }
    this._apply()
    this.host.audioUpdate?.(this)
    return true
  }

  pause() { this.paused = true; this.host.audioPause?.(this) }
  resume() { this.paused = false; this.host.audioResume?.(this) }
  /** Salta a `t` sin ejecutar lo que queda atrás (lo ya pasado se da por disparado). */
  seek(t) {
    this.time = Math.max(0, Math.min(this.tl.duration, +t || 0))
    this.fired.clear()
    for (const e of this._events()) if (e.k.t < this.time) this.fired.add(e.id)
    this._apply()
    this.host.audioSeek?.(this)
  }
  /** Omitir: salta al final; solo corren las claves marcadas «imprescindible». */
  async skip() {
    if (this.finished || this.skipped) return
    this.skipped = true
    for (const r of this.runs) r.cancel() // lo que estuviera en curso (diálogos…) se corta
    this.host.interrupt?.()
    const rest = this._events().filter((e) => !this.fired.has(e.id) && e.tr.kind === 'commands' && e.k.essential).sort((a, b) => a.k.t - b.k.t)
    this.time = this.tl.duration; this._apply()
    for (const e of rest) { this.fired.add(e.id); const r = this.host.commands?.(e.k.list || [], { name: e.k.name }); if (r?.done) await r.done }
    this._finish()
  }
  stop() { if (!this.finished) { for (const r of this.runs) r.cancel(); this.host.interrupt?.(); this._finish(true) } }
  _finish(stopped = false) {
    if (this.finished) return
    this.finished = true
    this.host.audioStop?.(this)
    this.host.camera?.(null)
    this.host.letterbox?.(0)
    this.onEnd?.(this, stopped)
    this._resolve({ stopped, skipped: this.skipped })
  }
}
