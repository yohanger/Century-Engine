import * as THREE from 'three'
import { DEG } from '../util.js'
import { nodeEffectiveActive } from '../nodes/hierarchy.js'
import { MOVE_KEYS, PLAYER_PARAMS, clampPlayerField } from '../database/player.js'
import { crouchMethods, crouchHeight } from './play-crouch.js'
import { pickMove } from './play-shared.js'

export function findPlayerCamera(objects, id, enabled) {
  if (!id) return null
  return objects.find(o => o.type === 'camera' && enabled(o)
    && (() => { for (let p = o.parentId; p;) { if (p === id) return true; p = objects.find(x => x.id === p)?.parentId } return false })()) || null
}

// El jugador visto desde PlayMode. La locomoción y la mirada del personaje están en
// Scripts de Nodo; los accesores enlazan la identidad activa con CharacterBody3D/Jolt.
export const playerMethods = {
  ...crouchMethods,
  /** Aparición explícita en escenas configuradas para API: sin FPS paralelo. */
  _spawnPlayer(prefab, options = {}) {
    if (this._restoringPhysical && !this._rebuildingSavedPlayer)
      throw new Error('Spawn Player: la carga ya está reconstruyendo el jugador guardado')
    if (!this.on || this.film || this.project?.scenes?.find(s => s.id === this.project.activeSceneId)?.playerSpawnMode !== 'api')
      throw new Error('Spawn Player requiere escena de gameplay en modo Aparición por API')
    if (this._scenePlayerDecision().kind !== 'deferred')
      throw new Error('Spawn Player: configuración de escena incompatible')
    if (this._nativePlayerId || this.hasPlayer)
      throw new Error('Spawn Player: ya existe un personaje controlado')
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Spawn Player: opciones inválidas')
    const id = typeof prefab === 'string' ? prefab : prefab?.id
    const matches = (this.project.prefabs || []).filter(p => p.id === id || p.name === id)
    if (matches.length !== 1) throw new Error(`Spawn Player: Prefab inexistente o ambiguo: ${String(id)}`)
    const source = matches[0].objects || []
    const bodies = source.filter(o => o.type === 'characterbody3d' && nodeEffectiveActive(source, o))
    if (bodies.length !== 1) throw new Error(`Spawn Player: se requiere exactamente un CharacterBody3D activo (${bodies.length})`)
    if (!this.phys?.nodeBodyRuntime) throw new Error('Spawn Player requiere Jolt activo')
    const index = source.indexOf(bodies[0])
    // La materialización y su rollback pertenecen a Prefabs; la identidad a PlayMode.
    return this._prefabInstantiate(prefab, options, (created) => {
      const body = created[index]
      this._nativePlayerId = body.id
      if (!this._nativeCharacterState()) throw new Error('Spawn Player: CharacterBody3D sin cuerpo Jolt válido')
      this._nativePlayerConfigApply()
      this.hasPlayer = true
      this.state.player = true
      this._vmSetup()
      if (!this._restoringPhysical) this._gpReady()
    })
  },
  /** Modifica solo el registro normalizado de Database durante esta partida. */
  _nativePlayerConfigSet(patch) {
    this._nativeRequire()
    const cfg = this.game?.db?.player
    if (!cfg) throw new Error('Jugador nativo: Database Jugador no disponible')
    const bools = new Set(PLAYER_PARAMS.filter(p => p.type === 'bool').map(p => p.key))
    const next = { ...cfg }
    for (const [key, value] of Object.entries(patch || {})) {
      if (!(key in cfg) || (!MOVE_KEYS.includes(key) && !['height','radius','eyeHeight','stepHeight'].includes(key)))
        throw new Error(`Jugador nativo: ajuste no admitido ${key}`)
      if (bools.has(key)) next[key] = !!value
      else if (value !== '' && value != null && Number.isFinite(+value)) next[key] = clampPlayerField(key, value)
      else throw new TypeError(`game.player.${key}: valor inválido`)
    }
    if (next.radius * 2 > next.height) throw new RangeError('Jugador nativo: la altura debe ser al menos dos veces el radio')
    next.eyeHeight = Math.min(next.eyeHeight, next.height)
    next.stepHeight = Math.min(next.stepHeight, next.height / 2)
    // La cápsula Jolt se cambia antes del commit: un fallo no altera Database ni pm.g.
    const crouch = this._nativeCrouchState()
    const shape = crouch?.on ? { ...next, height: crouchHeight(next) } : next
    this.phys?.nodeSpatial?.configurePlayerShape(this._nativePlayerId, shape)
    const camera = this._nativePitchCamera()
    // En el rig FPS nativo la Camera3D es hija directa del cuerpo: sus ojos
    // son relativos a los pies del CharacterVirtual, no al centro de cápsula.
    if (camera?.parentId === this._nativePlayerId) {
      const node = this.ed?.nodes?.get(camera.id)
      if (node) { node.position.y = next.eyeHeight + (crouch?.eyeOffset || 0); node.updateMatrixWorld?.(true) }
    }
    Object.assign(cfg, next)
    Object.assign(this.g, pickMove(cfg))
  },
  /** La escena o un Prefab creado por Spawn reutilizan la misma configuración runtime. */
  _nativePlayerConfigApply() {
    if (!this._nativePlayerId || !this._nativeCharacterState() || !this.game?.db?.player) return false
    this._nativePlayerConfigSet({})
    return true
  },

  // ---- estado del jugador (lo posee el controlador) ----
  /** El CharacterBody3D de la escena es dueño de posición, velocidad y contactos. */
  _nativeCharacterState() {
    const id = this._nativePlayerId
    const obj = id && this.project?.objects?.find(o => o.id === id)
    const node = id && this.ed?.nodes?.get(id)
    const spatial = this.phys?.nodeSpatial
    const character = id && spatial?.characters?.get(id)
    if (!obj || obj.type !== 'characterbody3d' || !this._nodeEnabled(obj)
      || !node || !character || character.obj !== obj || character.node !== node || spatial.disposed) return null
    return { id, obj, node, spatial, character }
  },
  _nativeRequire() {
    const current = this._nativeCharacterState()
    if (!current) throw new Error(`Jugador nativo sin cuerpo físico activo: ${this._nativePlayerId || '(no asignado)'}`)
    return current
  },
  _nativeWorldPosition() { return this._nativeRequire().node.getWorldPosition(new THREE.Vector3()) },
  _nativePositionSet(value) {
    const { node, spatial, character } = this._nativeRequire()
    const world = Array.isArray(value) ? new THREE.Vector3(...value) : value.clone()
    if (![world.x, world.y, world.z].every(Number.isFinite)) throw new TypeError('game.player.position: XYZ inválida')
    if (node.parent) node.parent.worldToLocal(world)
    node.position.copy(world)
    node.updateMatrixWorld(true)
    spatial.syncCharacter(character)
  },
  _nativeYaw() {
    const q = this._nativeRequire().node.getWorldQuaternion(new THREE.Quaternion())
    return new THREE.Euler().setFromQuaternion(q, 'YXZ').y
  },
  _nativeYawSet(yaw) {
    if (!Number.isFinite(yaw)) throw new TypeError('game.player.yaw: valor inválido')
    const { node } = this._nativeRequire()
    const worldYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
    if (node.parent) worldYaw.premultiply(node.parent.getWorldQuaternion(new THREE.Quaternion()).invert())
    node.quaternion.copy(worldYaw)
    node.updateMatrixWorld(true)
  },
  _nativePitchCamera() {
    return findPlayerCamera(this.project.objects || [], this._nativePlayerId, (o) => this._nodeEnabled(o))
  },
  get pos() { return this._nativePlayerId ? this._nativeWorldPosition() : this.player.pos },
  get body() {
    if (!this._nativePlayerId) return this.player.body
    // Antes de que exista el registro de sesión se lee la cápsula autoral;
    // durante Play Database configura ese mismo CharacterVirtual Jolt.
    const id = this._nativePlayerId
    const shape = this.project.objects.find(o => o.parentId === id && o.type === 'collisionshape3d' && o.props?.disabled !== true)?.props?.shape
    const radius = Number(shape?.radius) || 0.3
    const height = Number(shape?.height) || 1.7
    const cam = this._nativePitchCamera()
    const eyeHeight = cam ? Math.abs(this.ed.nodes.get(cam.id)?.position.y ?? 1.55) + height / 2 : height * 0.85
    const cfg = this.game?.db?.player
    const crouch = id === this._nativeCrouch?.body.obj.id ? this._nativeCrouch : null
    return cfg ? { radius: cfg.radius, height: crouch?.on ? crouchHeight(cfg) : cfg.height,
      eyeHeight: cfg.eyeHeight + (crouch?.eyeOffset || 0), stepHeight: cfg.stepHeight }
      : { radius, height, eyeHeight, stepHeight: this.player.body.stepHeight }
  },
  get yaw() { return this._nativePlayerId ? this._nativeYaw() : this.player.yaw },
  set yaw(v) { if (this._nativePlayerId) this._nativeYawSet(v); else this.player.yaw = v },
  get pitch() { const cam = this._nativePlayerId && this._nativePitchCamera(); return cam ? this.ed.nodes.get(cam.id)?.rotation.x ?? 0 : this.player.pitch },
  set pitch(v) { const cam = this._nativePlayerId && this._nativePitchCamera(); if (cam) this.ed.nodes.get(cam.id).rotation.x = v; else this.player.pitch = v },
  get vy() { return this._nativePlayerId ? this._nativeRequire().spatial.characterState(this._nativePlayerId).velocity[1] : this.player.vy },
  set vy(v) { if (this._nativePlayerId) { const { spatial, id } = this._nativeRequire(); const vel = spatial.characterState(id).velocity; vel[1] = v; spatial.setVelocity(id, vel) } else this.player.vy = v },
  get grounded() { return this._nativePlayerId ? this._nativeRequire().spatial.characterState(this._nativePlayerId).onFloor : this.player.grounded },
  set grounded(v) { if (this._nativePlayerId) throw new Error('game.player.grounded es de solo lectura en CharacterBody3D'); this.player.grounded = v },

  // ---- reenvíos ----
  _move(dt) { this.player.move?.(dt) },
  _faceEvent(dt) { this.player.faceEvent?.(dt) },
  _stepsFrame(dt) { this.player.late(dt) },
  _applyPlayer(cfg) { this.player.applyConfig(cfg); this._nativePlayerConfigApply() },
  _setPlayer(patch) { if (this._nativePlayerId) this._nativePlayerConfigSet(patch); else this.player.setConfig(patch) },
  _playerApi() {
    if (!this._nativePlayerId) return null
    const self = this, id = this._nativePlayerId, session = this._referenceSession, sceneId = this.project.activeSceneId
    const requireSame = () => {
      if (!self.on || self._referenceSession !== session || self.project.activeSceneId !== sceneId || self._nativePlayerId !== id)
        throw new Error(`game.player: referencia de escena obsoleta (${id})`)
      return self._nativeRequire()
    }
    const handle = this._nodeHandle(id)
    const read = () => requireSame().spatial.characterState(id)
    const pos = () => { requireSame(); return self.pos }
    // El prototipo es el handle ordinario del nodo; no se copia ni se duplica estado físico.
    const api = Object.create(handle)
    Object.defineProperties(api, {
      node: { get: () => { requireSame(); return handle }, enumerable: true },
      x: { get: () => pos().x }, y: { get: () => pos().y }, z: { get: () => pos().z },
      position: { get: () => pos().toArray(), set: v => { requireSame(); self._nativePositionSet(v) } },
      yaw: { get: () => { requireSame(); return self.yaw / DEG }, set: v => { requireSame(); self.yaw = v * DEG } },
      pitch: { get: () => { requireSame(); return self.pitch / DEG }, set: v => { requireSame(); self.pitch = v * DEG } },
      velocity: { get: () => read().velocity, set: v => requireSame().spatial.setVelocity(id, v) },
      ground: { get: () => read().ground },
      grounded: { get: () => read().onFloor },
      crouching: { get: () => { requireSame(); return self._nativeCrouchState().on } },
      stable: { get: () => read().ground === 'stable' },
      speed: { get: () => { const v = read().velocity; return Math.hypot(v[0], v[2]) } },
      surface: { get: () => { const p = pos(); return self.surfaceAt(p.x, p.y, p.z) } },
      name: { get: () => { requireSame(); const actor = self.game?.db?.player?.actorId; return actor ? self._textCtx().actor('player') : null } },
      actor: { get: () => { requireSame(); const actor = self.game?.db?.player?.actorId; return actor ? self.game.party?.actors?.[actor] || self.game.db.actors?.find(a => a.id === actor) || null : null } },
      control: { get: () => { requireSame(); return self.control }, set: v => { requireSame(); self.control = !!v } },
      mode: { get: () => { requireSame(); return self._playerMode() } },
      eye: { get: () => { requireSame(); return self._eyeRay().origin } },
      forward: { get: () => { requireSame(); return self._eyeRay().dir } },
    })
    api.crouch = (on = true) => { requireSame(); self._nativeCrouchState().script = !!on }
    api.look = opts => { requireSame(); return self._playerLook(opts) }
    // MOVE_KEYS conserva el contrato público de configuración; Database runtime
    // y pm.g son los propietarios existentes. No se duplica un perfil en el nodo.
    for (const k of [...MOVE_KEYS, 'height', 'radius', 'eyeHeight', 'stepHeight']) {
      Object.defineProperty(api, k, { enumerable: true, configurable: true,
        get: () => { requireSame(); return self.game?.db?.player?.[k] },
        set: v => { requireSame(); self._nativePlayerConfigSet({ [k]: v }) } })
    }
    return api
  },
  _placeAtSpawn(tag = 'player') {
    if (!this._nativePlayerId) return false
    const obj = this._spawnFor(tag)
    if (!obj) return false // Sin marcador: mantener posición autoral del personaje.
    this._teleport({ mode: 'node', node: obj.id })
    this._profSpawn(obj) // Sólo para marcadores históricos con perfil explícito.
    return true
  },
  _placeAtCamera() {
    if (!this._nativePlayerId || !this.fromCam?.pos) return false
    const p = this.fromCam.pos.clone()
    p.y -= this.body.eyeHeight
    this._nativePositionSet(p)
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.fromCam.quat)
    this.yaw = Math.atan2(-fwd.x, -fwd.z)
    return true
  },
  _jumpSound() { this.player.jumpSound?.() },

  // ---- manos (opcional: un tipo de jugador sin manos no las implementa y esto devuelve vacío) ----
  get vm() { return this.player.vm ?? null },
  get _thrown() { return this.player._thrown }, set _thrown(v) { this.player._thrown = v }, // objetos lanzados en vuelo
  _vmSetup(...a) { return this.player._vmSetup?.(...a) },
  _vmTeardown(...a) { return this.player._vmTeardown?.(...a) },
  _vmLights(...a) { return this.player._vmLights?.(...a) },
  _vmFrame(...a) { return this.player._vmFrame?.(...a) },
  _thrownTick(...a) { return this.player._thrownTick?.(...a) },
  _dropHeld(...a) { return this.player._dropHeld?.(...a) },
  _dropInput(...a) { return this.player._dropInput?.(...a) },
  _vmDrop(...a) { return this.player._vmDrop?.(...a) },
  _vmAdopt(...a) { return this.player._vmAdopt?.(...a) },
  _vmStashAdopt(...a) { return this.player._vmStashAdopt?.(...a) },
  _vmSlot(...a) { return this.player._vmSlot?.(...a) },
  _vmTarget(...a) { return this.player._vmTarget?.(...a) },
  _vmApi(...a) { return this.vm ? this.player._vmApi?.(...a) : undefined },
  viewModelAttach(...a) { return this.player.viewModelAttach?.(...a) },
  viewModelClear(...a) { return this.player.viewModelClear?.(...a) },
  viewModelHeld(...a) { return this.player.viewModelHeld?.(...a) },
  viewModelRelease(...a) { return this.player.viewModelRelease?.(...a) },
  viewModelStash(...a) { return this.player.viewModelStash?.(...a) },
  viewModelStashed(...a) { return this.player.viewModelStashed?.(...a) },
  viewModelThrow(...a) { return this.player.viewModelThrow?.(...a) },
  viewModelUnstash(...a) { return this.player.viewModelUnstash?.(...a) },
}
