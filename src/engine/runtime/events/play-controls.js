// Entrada del jugador: ratón capturado, teclas, interacción y modo de control
import { doc } from '../platform.js'
import { physicsStep } from '../templates/gameParams.js'
import { refreshCameraFov } from '../render/camera-fov.js'

export const controlsMethods = {
  // =================== entrada ===================
  /** Captura el ratón (el jugador solo tiene el control con el ratón capturado). Si se deniega, se avisa en vez de fallar en silencio. */
  _lock() {
    const fail = (err) => {
      if (doc.pointerLockElement === this.dom || !this.on) return
      console.warn('No se pudo capturar el ratón', err)
      // sin gesto del usuario (p. ej. tras cargar) es normal: el aviso del visor pide hacer clic. Denegado de verdad: se dice
      if (err && /NotAllowed|NotSupported|denied|permission/i.test(`${err.name} ${err.message}`) && !this._lockWarned) {
        this._lockWarned = true
        this.rt.toast('No se pudo capturar el ratón: haz clic en la vista del juego. Si sigue sin responder, el sistema bloquea la captura del puntero.', 'error', 6000)
      }
    }
    try { const r = this.dom.requestPointerLock(); r?.catch?.(fail) } catch (e) { fail(e) }
  },
  /** URLs de las imágenes del proyecto, para `asset("nombre.png")` dentro de las interfaces. */
  async _loadAssetUrls() {
    this.assetUrls = new Map()
    this.assetUrlsById = new Map()
    for (const a of this.project.assets || []) {
      if (a.kind !== 'texture' && a.kind !== 'font') continue
      try { const u = await this.rt.assetUrl(a.id); if (u) { this.assetUrls.set(a.name.toLowerCase(), u); this.assetUrlsById.set(a.id, u) } } catch { /* sin imagen */ }
    }
  },

  /** Una interfaz modal abierta libera el ratón (y pausa el juego); al cerrarse se vuelve a capturar. */
  _modalChanged() {
    if (!this.on) return
    this.keys.clear(); this.input?.clear()
    if (this.ui.modalOpen) { if (doc.pointerLockElement === this.dom) doc.exitPointerLock() } else this._lock()
  },

  _pick(i) {
    const c = this.state.choices
    if (!c || !(i >= 0 && i < c.options.length)) return
    c.index = i
    this._press(true)
  },

  _lockChanged() { this.state.focus = doc.pointerLockElement === this.dom; if (this.state.focus) this.state.started = true; this._lockAt = performance.now(); this.vp.requestRender() },

  /** Modo del jugador: lo marca el evento en curso (opción «Jugador durante el evento») o game.control. */
  _playerMode() {
    if (this.main) return this.main.mode || 'locked'
    if (!this.control) return this.lookControl === false ? 'frozen' : 'locked'
    return 'free'
  },

  _look(e) {
    if (!this.on || doc.pointerLockElement !== this.dom) return
    if (performance.now() - (this._lockAt || 0) < 150) return // el salto inicial del puntero al capturarlo no debe girar la cámara
    if (this.paused || ['frozen', 'face'].includes(this._playerMode())) return
    this.input?.movePointer(e.movementX || 0, e.movementY || 0)
    this.player.look(e)
  },

  _mouse(e) {
    e.preventDefault()
    if (this.ui.modalOpen) return
    if (doc.pointerLockElement !== this.dom) { if (e.button === 0 && !this.paused) this._lock(); return }
    const code = 'Mouse' + e.button
    this.input?.set(code, 1)
    if (this.input?.bound('interact', code)) this._press()
  },

  _key(e, down) {
    const t = e.target
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
    if (e.ctrlKey || e.metaKey || e.altKey) return
    // En el Editor F3 pertenece al panel Stats, no al Input Map de PlayMode.
    if (!this.runtime && e.code === 'F3') return
    if (down) this.keys.add(e.code); else this.keys.delete(e.code)
    if (this.state.focus || !down) this.input?.set(e.code, down ? 1 : 0)
    e.stopPropagation()
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault()
    if (!down || e.repeat) return
    if (e.code === 'F5') { e.preventDefault(); if (!this.runtime) this.stop(); return }
    if (this.ui.modalOpen) { if (e.code === 'Escape') this.ui.close(); return } // con una interfaz modal abierta, Esc la cierra y el juego no recibe teclas
    if (e.code === 'Escape' && !this.state.focus) { if (!this.runtime) this.stop(); return }
    if (!this.state.focus) return
    if (e.code === 'Backspace' && !this.state.choices && this.tls?.length && this.timelineSkip()) return
    const ch = this.state.choices
    if (ch) {
      const inp = this.input
      if (inp.bound('ui_up', e.code)) ch.index = (ch.index + ch.options.length - 1) % ch.options.length
      else if (inp.bound('ui_down', e.code)) ch.index = (ch.index + 1) % ch.options.length
      else if (/^(Digit|Numpad)[1-9]$/.test(e.code)) { const n = +e.code.slice(-1) - 1; if (n < ch.options.length) { ch.index = n; this._press() } } else if (inp.bound('ui_cancel', e.code)) { if (ch.cancel >= 0) { ch.index = Math.min(ch.cancel, ch.options.length - 1); this._press() } }
    }
    if (this.input.bound('interact', e.code)) this._press()
  },

  /** Botón de acción: avanza el texto, confirma una opción o activa el evento que se tiene delante. */
  _press(fromUi = false) {
    if (this.ui.modalOpen && !fromUi) return
    const pl = this.state
    if (pl.dialog) {
      const d = pl.dialog
      if (d.waitInput) { d.waitInput = false; return }
      if (!d.done) { d.shown = d.text.length; d.done = true; return }
      if (d.age < 0.12) return
      pl.dialog = null
      this._endDialog(d)
      return
    }
    if (pl.choices) { const c = pl.choices; pl.choices = null; c.resolve(c.index); return }
    if (this.main || !this.control) return
    if (this._reconcilePages() === false) return
    if (this.gameplayCand) {
      const candidate = this._gpCandidate?.()
      const current = candidate?.item?.obj.id === this.gameplayCand.obj.id ? this.gameplayCand : null
      this.gameplayCand = null
      if (current) void this._gpPickup(current.obj.id)
      return
    }
    if (!this._canAction(this.cand)) { this.cand = null; this.state.prompt = ''; this.state.interactionIndicator = null; return }
    this._startMain(this.cand)
  },

  // =================== bucle ===================
  frame(dt) {
    if (!this.on) return false
    const cam = this.cam, c = this.vp.container
    this._shakeRestore(cam) // los sistemas del juego leen la pose sin desplazamiento visual
    const aspect = Math.max(1, c.clientWidth) / Math.max(1, c.clientHeight)
    if (Math.abs(cam.aspect - aspect) > 1e-4) { cam.aspect = aspect; refreshCameraFov(cam) }
    this._inputFrame(dt)
    if (this.game) this.ui.sync(this.game.rev, this.game.time, Math.min(dt, 0.05))
    const stepping = !!this._stepN
    if (this.film && this.game) {
      // paso fijo: la misma secuencia de pasos da el mismo clima, los mismos rayos y los mismos movimientos
      const f = this.film
      f.acc = stepping ? 1 / 60 : this.paused ? 0 : Math.min(f.acc + dt, 15 / 60) // se pone al día hasta 0,25 s por fotograma
      this._stepN = 0; this._alpha = 1
      while (f.acc >= 1 / 60 - 1e-9) { f.acc -= 1 / 60; f.time += 1 / 60; f.steps++; this._simStep(1 / 60, 1, 1 / 60) } // un paso de física por paso (determinista)
    } else if (this.game && ((this.state.focus && !this.paused) || stepping)) {
      // Paso de física FIJO (Ajustes del juego ▸ Tasa de física): el fotograma consume el tiempo acumulado en pasos de `fdt`
      // (el sobrante pasa al siguiente fotograma y la cámara se interpola con `_alpha`). Se acotan los pasos por fotograma.
      let fdt = physicsStep(this.g), n
      if (stepping) { dt = 1 / 60; fdt = 1 / 60; n = 1; this._pacc = 0; this._alpha = 1 }
      else {
        dt = Math.min(dt, 0.05)
        this._pacc = Math.min((this._pacc || 0) + dt, 0.05 + fdt)
        n = Math.floor(this._pacc / fdt + 1e-9); this._pacc -= n * fdt
        this._alpha = Math.min(1, Math.max(0, this._pacc / fdt))
      }
      this._stepN = 0
      this.player.frame(dt)
      this._simStep(dt, n, fdt)
    }
    if (this.film?.onFrame) this.film.onFrame(this.film.time) // primero se actualiza el mundo de la película
    this._cameraDelta = stepping ? 1 / 60 : (this.paused || !this.state.focus ? 0 : Math.max(0, dt))
    this._nativeCrouchView?.(dt)
    this._cameraFrame(cam)
    this.audio?.update(cam)
    this.weatherSound?.update(dt)
    if (this.weatherSound) this.vp.weatherOcclusion = this.weatherSound.occ // bloque G: suprime lluvia visual bajo techo
    this._profVolumesTick(dt)
    this._thrownTick(dt)
    this._vmFrame(dt)
    this._updateInteractionIndicator()
    this._updateHeldActions()
    this.lod?.update(this.cam)
    if (this._worldStreamer) {
      const now = performance.now() / 1000
      if (now >= this._nextStreamCheck) {
        this._nextStreamCheck = now + 0.1
        this._worldStreamer.update(this._nativePlayerId ? this.pos : cam.position, now)
      }
    }
    this._shakeFrame(cam, dt, stepping) // solo afecta el fotograma renderizado, después de interacción y cinemáticas
    return true // siempre se redibuja
  },

  /**
   * Nether Film Maker: pone el clima y la hora como estaban en el segundo `t` desde el inicio (misma semilla, mismos pasos),
   * sin volver a arrancar el juego. Lo usa el montaje al pasar de un plano a otro.
   */
  filmJump(t) {
    if (!this.film) return
    const w = this.ed.world, steps = Math.max(0, Math.round(t * 60))
    w.configure(this.project.environment); w.reseed(this.film.seed)
    this._filmJumping = true
    try {
      if ((this._waterConnection || this._liquidViews?.length) && this._waterFilmInitial) this.water.restore(this._waterFilmInitial)
      // Repetición sincronizada: cada paso meteorológico alimenta exactamente un paso de agua.
      for (let i = 0; i < steps; i++) {
        w.update(1 / 60)
        this._waterConnection?.step(1 / 60)
        if (w.tornado) w.tornadoStep(1 / 60)
        if (!this._waterConnection && this._liquidViews?.length) this.water.step(1 / 60)
      }
    } finally { this._filmJumping = false }
    this._tornadoStarted=!!w.tornado?.active || ['weakening','dissipation','ended'].includes(w.tornado?.phase)
    this._tornadoEnded=w.tornado?.phase==='ended'
    this._tornadoPhase=w.tornado?.phase ?? null
    this._tornadoInside?.clear()
    if (this._waterConnection) this.ed.updatePhysicalWater(this.water)
    this._liquidRender?.()
    this._destructionRender?.()
    w.flash = 0; w._pulses = []
    this.film.time = steps / 60; this.film.acc = 0
    this.ed.applyWorld(); this.vp.requestRender()
  },

  /**
   * Un paso de simulación del juego. `dt` = tiempo del fotograma; `n` pasos de física de `fdt` segundos (puede ser 0 si el
   * fotograma es más corto que el paso). Orden: timers → timeline → game.update → mundo → [fixedUpdate → Jolt → jugador] × n →
   * perfiles/luces/animación → eventos → disparadores de entrada → game.lateUpdate.
   */
  _simStep(dt, n = 1, fdt = dt) {
    {
      this._timers(dt)
      this._tlUpdate(dt)
      this._tlSyncBrushes()
      this.game.update(dt)
      this.ed.nodeLifecycle?.process(dt)
      // Con agua física, clima y solver comparten el reloj fijo (independiente de FPS).
      // Sin agua se conserva el comportamiento heredado del mundo.
      if (!this._waterConnection) this.ed.tickWorld(dt)
      const pl = this.state
      if (pl.dialog) this._typeDialog(pl.dialog, dt)
      if (pl.levelTitle) this._levelTitleTick(pl.levelTitle, dt)
      this._nativeCrouchInput?.()
      for (let i = 0; i < n; i++) { // pasos de física a tasa fija
        this.player.snapshot()
        if (this._waterConnection) {
          if (this.ed.world.active) {
            this.ed._worldObserver()
            this.ed.world.update(fdt)
          }
        }
        // WaterWorld publica el estado antes de los consumidores físicos del mismo paso.
        // Los aportes pedidos en fixedUpdate se aplican en el siguiente paso.
        this._tornadoFixed?.(fdt)
        this._destructionFixed?.(fdt)
        this._liquidPoseSync?.()
        this._waterDisplacementSync?.()
        this._waterConnection?.step(fdt)
        if (!this._waterConnection && this._liquidViews?.length) this.water.step(fdt)
        this._nativeCrouchStep?.(fdt)
        this.game.fixedUpdate(fdt)
        this.ed.nodeLifecycle?.physicsProcess(fdt)
        this._nativeCrouchSpeed?.()
        // Un paso Jolt por intervalo fijo, haya o no CharacterBody3D controlado.
        // NodeSpatialRuntime avanza desde JoltWorld.step, sin un segundo bucle.
        this.phys?.step(fdt)
        if (this.hasPlayer) this.player.update(fdt)
        this.player.late(fdt)
      }
      if (this._waterConnection && n > 0) this.ed.applyWorld()
      this._profTick(dt)
      this._lightTick(dt)
      this._animTick(dt)
      this._events(dt)
      this._inputTriggers()
      this._bodiesTick(dt)
      this._destructionRender?.()
      if (this._waterConnection) {
        this._waterViewTime = (this._waterViewTime || 0) + dt
        if (this._waterViewTime >= 0.1) { this.ed.updatePhysicalWater(this.water); this._waterViewTime = 0 }
      }
      this._liquidRender?.()
      this._waterFxTick(dt)
      this._senseTick(dt)
      this.game.lateUpdate(dt) // el jugador y los eventos ya están al día en este fotograma
      this._tlBakeHold?.() // el Timeline conserva el control final de los cuerpos horneados
    }
  },
}
