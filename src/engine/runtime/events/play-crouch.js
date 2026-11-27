// Postura del mismo CharacterVirtual de CharacterBody3D. Database mantiene
// las dimensiones de pie y la escena puede retirar el permiso.
export function crouchHeight(cfg) {
  return Math.min(cfg.height, Math.max(2 * cfg.radius + 0.02, cfg.height * cfg.crouchHeight))
}

export const crouchMethods = {
  _nativeCrouchState() {
    if (!this._nativePlayerId) return null
    const body = this.phys?.nodeSpatial?.characters?.get(this._nativePlayerId)
    if (!body || !this._nodeEnabled(body.obj)) return null
    if (this._nativeCrouch?.body !== body)
      this._nativeCrouch = { body, on: false, toggled: false, held: false, script: null, eyeOffset: 0, retry: 0 }
    return this._nativeCrouch
  },

  _nativeCrouchInput() {
    const state = this._nativeCrouchState()
    if (!state || !this.input) return
    const cfg = this.game.db.player
    if (this.level?.canCrouch === false || !cfg.crouchEnabled) {
      state.toggled = false
      state.held = false
      state.script = null
      return
    }
    const pressed = this.input.anyJustPressed('crouch')
    const released = this.input.anyJustReleased('crouch')
    const control = this.control && this._playerMode() === 'free'
    if (control && (pressed || released)) state.script = null
    if (control && pressed && cfg.crouchToggle) state.toggled = !state.toggled
    state.held = control && this.input.anyPressed('crouch')
  },

  _nativeCrouchStep(dt) {
    const state = this._nativeCrouchState()
    if (!state) return
    const cfg = this.game.db.player
    const shortHeight = crouchHeight(cfg)
    const permitted = cfg.crouchEnabled && this.level?.canCrouch !== false && shortHeight < cfg.height
    const want = permitted && (state.script ?? (cfg.crouchToggle ? state.toggled : state.held))
    if (want === state.on) { state.retry = 0; return }
    state.retry = Math.max(0, state.retry - dt)
    if (state.retry || (want && !cfg.crouchAir && !state.body.onFloor)) return

    const height = want ? shortHeight : cfg.height
    if (this.phys.nodeSpatial.configurePlayerShape(this._nativePlayerId, { radius: cfg.radius, height }, { allowBlocked: true })) {
      state.on = want
      void this.game.emit('crouch', { on: want })
    } else state.retry = 0.12
  },

  _nativeCrouchSpeed() {
    const state = this._nativeCrouch
    if (!state?.on || this.phys?.nodeSpatial?.characters?.get(this._nativePlayerId) !== state.body) return
    const cfg = this.game.db.player
    const speed = cfg.walk * cfg.crouchSpeed * (this.level?.speedScale ?? 1)
    const [x, y, z] = state.body.velocity
    const horizontal = Math.hypot(x, z)
    if (horizontal > speed) this.phys.nodeSpatial.setVelocity(this._nativePlayerId, [x * speed / horizontal, y, z * speed / horizontal])
  },

  _nativeCrouchView(dt) {
    const state = this._nativeCrouchState()
    if (!state || (!state.on && state.eyeOffset === 0)) return
    const cfg = this.game.db.player
    const eye = state.on ? Math.min(cfg.eyeHeight * crouchHeight(cfg) / cfg.height, crouchHeight(cfg) - 0.05) : cfg.eyeHeight
    const offset = eye - cfg.eyeHeight
    const delta = (offset - state.eyeOffset) * (1 - Math.exp(-Math.max(0, dt) * cfg.crouchLerp))
    state.eyeOffset = Math.abs(offset - (state.eyeOffset + delta)) < 0.001 ? offset : state.eyeOffset + delta
    const camera = this._nativePitchCamera()
    if (camera?.parentId !== this._nativePlayerId) return
    const node = this.ed.nodes.get(camera.id)
    if (node) node.position.y = cfg.eyeHeight + state.eyeOffset
  },
}
