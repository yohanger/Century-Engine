// Input Map en el modo Jugar y el juego exportado (core/input/inputmap.js). Se mezcla en PlayMode.prototype.
//  · El juego trabaja con una COPIA del Input Map del proyecto: reasignar teclas jugando no modifica el proyecto
//    (en el juego exportado los cambios se guardan en el navegador del jugador).
//  · game.input.pressed("jump") · justPressed · axis("move_left", "move_right") · onPress("interact", fn) · bind/rebind/reset…
//  · También vale una tecla «normal»: game.input.pressed("KeyF"), justPressed("Mouse1")…
import { InputState, normalizeInputMap, defaultInputMap, addAction, removeAction, setBindings, addBinding, resetAction, findAction, labelOf, isToken } from '../input/inputmap.js'
import { pollGamepad, padLook } from '../input/gamepad.js'

const clone = (v) => JSON.parse(JSON.stringify(v))

export const inputMethods = {
  _inputInit() {
    let map = normalizeInputMap(clone(this.project?.inputMap || defaultInputMap()))
    if (this.runtime) { // juego exportado: se respetan las teclas que el jugador reasignó
      try { const raw = this.rt.storage.get('input'); if (raw) map = normalizeInputMap(JSON.parse(raw)) } catch { /* sin almacenamiento */ }
    }
    this.input = new InputState(map)
    this.input.any = (name, pressed) => { this.game?.emit('action', { action: name, pressed }) }
    this._inWait = []; this._inCapture = null; this._inApi = null
  },

  /** Una vez por fotograma, antes de la lógica: mando + estado de las acciones + esperas. */
  _inputFrame(dt = 0) {
    const inp = this.input
    if (!inp) return
    pollGamepad(inp)
    inp.step()
    this._dropInput?.()
    this._gpActionInput?.()
    // cámara con el stick derecho (el ratón sigue girando por _look)
    if (dt && inp._padTokens?.size && this.state.focus && !this.ui.modalOpen) {
      const md = this._playerMode()
      if (md !== 'frozen' && md !== 'face') {
        const l = padLook(inp, Math.min(dt, 0.05), this.g.sensitivity)
        if ((l.yaw || l.pitch) && this._nativePlayerId) {
          // El mando orienta el mismo CharacterBody3D y su Camera3D; no existe FpsPlayer.
          const camera = this._nativePitchCamera()
          const active = this._cameraActive
          if (camera && (!active || (active.kind === 'camera3d' && active.id === camera.id))) {
            this.yaw += l.yaw
            this.pitch = Math.max(-85 * Math.PI / 180, Math.min(85 * Math.PI / 180, this.pitch + l.pitch))
          }
        }
      }
    }
    if (this._inCapture && inp.rawDown.size) {
      const t = [...inp.rawDown].find((x) => !/^Pad[LR][XY]/.test(x) || inp.held.get(x) > 0.7)
      if (t) { const r = this._inCapture; this._inCapture = null; r(t) }
    }
    if (this._inWait.length) {
      const rest = []
      for (const w of this._inWait) { if (inp.anyJustPressed(w.ref)) w.r(); else rest.push(w) }
      this._inWait = rest
    }
  },

  _inputSave() {
    if (!this.runtime) return
    try { this.rt.storage.set('input', JSON.stringify(this.input.map)) } catch { /* sin almacenamiento */ }
  },

  /** Comandos y scripts: «Entrada» (esperar, asignar, activar). Devuelve false si no existe la acción. */
  _inputOp(op, ref, arg) {
    const inp = this.input, map = inp.map
    const name = String(ref ?? '')
    if (op === 'enable' || op === 'disable') { if (!inp.has(name)) return false; inp.setEnabled(name, op === 'enable'); return true }
    let ok = false
    if (op === 'bind') ok = addBinding(map, name, arg)
    else if (op === 'rebind') ok = setBindings(map, name, Array.isArray(arg) ? arg : [arg]) && (Array.isArray(arg) ? arg : [arg]).every((t) => isToken(t) || t === undefined)
    else if (op === 'reset') ok = resetAction(map, name)
    else if (op === 'create') ok = !!addAction(map, name, Array.isArray(arg) ? arg : arg ? [arg] : [])
    else if (op === 'remove') ok = removeAction(map, name)
    if (ok) { inp.setMap(map); this._inputSave() }
    return ok
  },

  /** game.input (ver game-api.d.ts). */
  _inputApi() {
    if (this._inApi) return this._inApi
    const self = this, inp = () => self.input
    this._inApi = {
      pressed: (r) => inp().anyPressed(r),
      justPressed: (r) => inp().anyJustPressed(r),
      justReleased: (r) => inp().anyJustReleased(r),
      strength: (a) => inp().strength(a),
      axis: (neg, pos) => inp().axis(neg, pos),
      vector: (nx, px, ny, py) => inp().vector(nx, px, ny, py),
      get pointerDelta() { return { ...inp().pointerDelta } },
      get actions() { return inp().map.actions.map((a) => a.name) },
      has: (a) => inp().has(a),
      bindings: (a) => [...(findAction(inp().map, a)?.bindings || [])],
      label: (t) => labelOf(t),
      /** Texto de las entradas de una acción: «E / Intro / Clic izquierdo». */
      labels: (a) => (findAction(inp().map, a)?.bindings || []).map(labelOf).join(' / '),
      onPress: (a, fn) => inp().on('press', a, fn),
      onRelease: (a, fn) => inp().on('release', a, fn),
      wait: (r) => new Promise((res) => { if (self.on) self._inWait.push({ ref: r, r: res }) }),
      /** Espera a que el jugador pulse algo y devuelve su entrada («KeyF», «Mouse1», «Pad0»…): útil para menús de reasignar teclas. */
      capture: () => new Promise((res) => { if (self.on) self._inCapture = res }),
      enable: (a, on = true) => self._inputOp(on ? 'enable' : 'disable', a),
      disable: (a) => self._inputOp('disable', a),
      isEnabled: (a) => inp().isEnabled(a),
      create: (a, tokens) => self._inputOp('create', a, tokens),
      remove: (a) => self._inputOp('remove', a),
      bind: (a, token) => self._inputOp('bind', a, token),
      rebind: (a, tokens) => self._inputOp('rebind', a, tokens),
      reset: (a) => self._inputOp('reset', a),
    }
    return this._inApi
  },

  /** Disparadores «Al pulsar una acción»: páginas de evento y eventos comunes. */
  _inputTriggers() {
    // El input puede llegar después de que otro evento cambie el self-switch en este mismo frame.
    if (this._reconcilePages() === false) return
    const inp = this.input, g = this.game
    if (!inp) return
    if (!this.main && this.control) {
      for (const e of this.events) {
        const pg = e.props.pages[e.pageIdx]
        if (!pg || pg.trigger !== 'input' || e.off || e.held || e.stashed || !pg.input?.action) continue
        const hit = pg.input.mode === 'released' ? inp.anyJustReleased(pg.input.action) : inp.anyJustPressed(pg.input.action)
        if (hit) { this._startMain(e); break }
      }
    }
    for (const ce of g.db.commonEvents) {
      if (ce.trigger !== 'input' || !ce.action || !ce.list?.length) continue
      this.commons ||= new Map()
      if (this.commons.get(ce.id) || !inp.anyJustPressed(ce.action)) continue
      const r = g.run(ce.list, { name: ce.name, onEnd: () => this.commons.delete(ce.id) })
      this.commons.set(ce.id, r)
    }
  },
}
