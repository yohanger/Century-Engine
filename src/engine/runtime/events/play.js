// Modo «Jugar»: ejecuta el nivel dentro del editor o del Player exportado.
//
//  · Jugador: CharacterBody3D y scripts nativos; Jolt controla el cuerpo físico y las colisiones.
//  · Eventos: cada nodo «Evento» activa su página según interruptores/variables y se lanza por acción (E / clic),
//    contacto, ejecución automática o proceso paralelo. Todo lo que hace el intérprete pasa por `host` (aquí abajo).
//  · La interfaz del juego NO está en el código: son documentos .ui del proyecto (Assets/UI) que dibuja UiRoot.vue
//    con el UiManager (core/ui). Este módulo solo escribe el estado en `this.state` (play-state.js) y atiende las acciones de la interfaz.
import * as THREE from 'three'
import { nodeEffectiveActive } from '../nodes/hierarchy.js'
import { routeMethods } from './play-route.js'
import { timelineMethods } from './play-timeline.js'
import { stepMethods } from './play-steps.js'
import { lookMethods } from './play-look.js'
import { sceneMethods } from './play-scene.js'
import { profileMethods } from './play-profile.js'
import { inputMethods } from './play-input.js'
import { graphicsMethods } from './play-graphics.js'
import { lightMethods } from './play-light.js'
import { animMethods } from './play-anim.js'
import { GAME_DEFAULTS } from '../templates/gameParams.js'
import { LAYER, pickMove, freshPlay } from './play-shared.js'
import { createPlayState } from '../play-state.js'
import { normalizeSceneTransitions, sceneFadeState } from './scene-transitions.js'
import { PLAYER_DEFAULTS } from '../database/player.js'
import { loadNavCache } from '../nav-cache.js'
import { NavWorld, navCache } from '../nav/world.js'
import { bakeNavRegion } from '../nav/bake.js'
import { navBounds } from '../nodes/navigation.js'
import { AudioScene } from '../audio/scene.js'
import { normalizeCanvas } from '../nodes/canvas.js'
import { normalizeSprite, sprite2dScreen } from '../nodes/sprite.js'
import { Game } from './interpreter.js'
import { NodeScriptRuntime } from '../scene/node-scripts.js'
import { normalizeEvent } from './model.js'
import { normalizeLevel } from '../world/params.js'
import { WeatherAudio } from '../world/sound.js'
import { saveMethods } from './play-saves.js'
import { signalMethods } from './play-signals.js'
import { LodManager } from '../render/lodmgr.js'
import { UiManager } from '../ui/manager.js'
import { loadJolt, JoltWorld } from '../physics/jolt.js'
import { createSceneStreamer } from '../streaming/scene.js'
import { nodesMethods } from './play-nodes.js'
import { persistentMethods } from './play-persistent.js'
import { eventsMethods } from './play-events.js'
import { playerMethods } from './play-player.js'
import { createPlayer } from '../player/index.js'
import { resolveScenePlayerNode } from '../../../core/project.js'
import { sceneGameConfig } from '../game-manager.js'
import { dialogMethods } from './play-dialog.js'
import { cameraMethods } from './play-camera.js'
import { cameraShakeMethods } from './play-camera-shake.js'
import { controlsMethods } from './play-controls.js'
import { levelMethods } from './play-level.js'
import { hostMethods } from './play-host.js'
import { senseMethods } from './play-sense.js'
import { weatherMethods } from './play-weather.js'
import { waterFxMethods } from './play-water.js'
import { lightningMethods } from './play-lightning.js'
import { tornadoMethods } from './play-tornado.js'
import { destructiveTornadoMethods } from './play-tornado-destruction.js'
import { liquidMethods } from './play-liquid.js'
import { bodyMethods } from './play-bodies.js'
import { gameplayObjectMethods } from './play-gameplay-objects.js'
import { indicatorMethods } from './play-interaction-indicator.js'
import { heldActionsMethods } from './play-held-actions.js'
import { WaterWorld } from '../geometry/waterworld.js'
import { TerrainWaterConnection, nativeWaterConfiguration } from '../geometry/water-terrain.js'
import { isCutter } from '../geometry/csg.js'
import { win, doc } from '../platform.js'



export class PlayMode {
  _frameN = 0 // contador de fotogramas para repartir trabajo (play-move.js)

  /** `session`: opcional, solo en el editor (core/editor/play-session.js): guarda y restaura lo que el editor tiene abierto. Sin ella el juego no toca nada del editor. */
  constructor(editor, session = null) {
    this.ed = editor
    this.session = session
    this.state = editor.host.playState ?? createPlayState() // estado reactivo del juego (lo dibuja UiRoot); el editor pasa el suyo
    this.vp = editor.vp
    this.on = false
    this.starting = false
    this.cam = new THREE.PerspectiveCamera(75, 1, 0.05, 3000)
    this.g = { ...GAME_DEFAULTS, ...pickMove(PLAYER_DEFAULTS) } // ajustes del juego (project.game) + movimiento del jugador (Base de datos ▸ Jugador); se releen al empezar
    this.runtime = false // true en el juego exportado: sin controles de editor (F5 / Esc no detienen) y «Salir» cierra la ventana
    this.onQuit = null
    this.ray = new THREE.Raycaster()
    this.ray.layers.set(LAYER)
    this.player = createPlayer('none', this) // capacidad ViewModel; no crea ni mueve un personaje
    this.keys = new Set()
    this.control = true; this.lookControl = true
    this.colliders = []
    this.Jolt = null // Jolt WASM; si falla no existe respaldo físico de jugador
    this.phys = null // JoltWorld de la escena en juego
    this.water = null
    this.events = []
    this.timers = []; this.frameWait = []; this.tweens = []
    this._tlInit()
    this._cameraReset()
    this._shakeClocks = new Map()
    this._shakeBase = null
    this.main = null
    this.hasPlayer = false
    this._nativePlayerId = null
    this._nativeCrouch = null
    this._nativePlayerIssue = null
    this._onKey = (e) => this._key(e, true)
    this._onKeyUp = (e) => this._key(e, false)
    this._onMove = (e) => this._look(e)
    this._onDown = (e) => this._mouse(e)
    this._onLock = () => this._lockChanged()
    this._onBlur = () => { this.keys.clear(); this.input?.clear() }
    this._onUp = (e) => this.input?.set('Mouse' + e.button, 0)
    this._onWheel = (e) => { if (doc.pointerLockElement === this.dom) this.input?.pulse(e.deltaY < 0 ? 'WheelUp' : 'WheelDown') }
    this._onMenu = (e) => e.preventDefault()
    this.ui = new UiManager({
      play: this.state,
      getDocs: () => this.project?.uis,
      getConfig: () => this.project?.ui,
      getGame: () => this.game,
      getTheme: () => this.project?.theme,
      getSprites: () => this._sprites2d(),
      getCanvases: () => (this.project?.objects || []).filter(o => o.type === 'canvas' && nodeEffectiveActive(this.project.objects,o)).map(o => {
        const overrides = this.ed.nodes.get(o.id)?.userData?.timelineCanvas || {}
        const c = normalizeCanvas({ ...o.props, ...overrides })
        return { id:o.id, name:o.name, ui:c.ui, role:c.role, layer:c.layer, interactive:c.interactive, modal:c.modal, alpha:c.alpha, visible:c.visible && o.visible !== false }
      }).filter(c => c.ui || c.role),
      host: {
        assetUrlById: (id) => this.assetUrlsById?.get(id),
        onModal: () => this._modalChanged(),
        advance: () => this._press(true),
        pick: (i) => this._pick(i),
        resume: () => this._lock(),
        quit: () => (this.onQuit ? this.onQuit() : this.stop()),
        log: (msg, kind, context) => { if (this.on || this.ui?.state.preview) this.rt.log?.(msg, kind, context) },
        error: (msg) => { this.state.errors++; this.rt.log?.(msg, 'error', 'Interfaz'); this.rt.toast(msg, 'error', 6000); console.error(msg) },
        assetUrl: (name) => this.assetUrls?.get(String(name).toLowerCase()),
      },
    })
    this.vp.onFrame((dt) => this.frame(dt))
  }

  /** Lo que el Runtime pide al exterior (engine/runtime/host.js). */
  get rt() { return this.ed.host }
  get project() { return this.rt.project }
  get dom() { return this.vp.dom }

  /** La identidad de escena tiene prioridad solo cuando está explícitamente asignada.
   *  Ningún fallo de referencia inicia un FPS de respaldo. */
  _scenePlayerDecision() {
    const scene = this.project?.scenes?.find(s => s.id === this.project.activeSceneId)
    const resolution = resolveScenePlayerNode(scene, this.project?.objects || [])
    if (scene && Object.hasOwn(scene, 'playerSpawnMode') && scene.playerSpawnMode !== 'api')
      return { kind: 'invalid', id: resolution.id, reason: 'invalid-spawn-mode' }
    if (scene?.playerSpawnMode === 'api') {
      if (resolution.status !== 'unassigned') return { kind: 'invalid', id: resolution.id, reason: 'api-with-player-node' }
      if (this.g.player === 'none') return { kind: 'invalid', id: null, reason: 'api-without-gameplay-player' }
      if (this.film) return { kind: 'disabled', id: null, reason: 'filmmaker' }
      return { kind: 'deferred', id: null }
    }
    if (resolution.status === 'unassigned') return { kind: 'none', id: null }
    if (resolution.status !== 'valid') return { kind: 'invalid', id: resolution.id, reason: resolution.status }
    if (this.film) return { kind: 'disabled', id: resolution.id }
    if (this.g.player === 'none') return { kind: 'disabled', id: resolution.id, reason: 'game-manager-none' }
    return { kind: 'native', id: resolution.id }
  }

  _scenePlayerSelect() {
    const decision = this._scenePlayerDecision()
    this._nativePlayerId = decision.kind === 'native' ? decision.id : null
    this._nativeCrouch = null
    this._nativePlayerIssue = decision.kind === 'invalid' ? decision : null
    if (this._nativePlayerIssue) {
      const msg = `Personaje controlado inválido (${decision.reason}): ${String(decision.id)}`
      this.rt.log?.(msg, 'error', 'Player FPS nativo')
      console.error(msg)
    }
    return decision
  }

  // Una sola resolución por escena: GameManager sobrescribe solo el tipo de Player.
  _managerScene() {
    const { manager, config } = sceneGameConfig(this.project)
    this._gm = manager
    this.g = { ...GAME_DEFAULTS, ...config }
    return manager
  }


  /** Sprites 2D que se ven en la pantalla (UiRoot los pinta): posición en la resolución de su Canvas, imagen, capa… */
  _sprites2d() {
    void this.state.spriteRev
    const objs = this.project?.objects || []
    const out = []
    for (const o of objs) {
      if (o.type !== 'sprite2d' || !this._nodeEnabled(o) || o.visible === false || this.sprite2dVis?.get(o.id) === false) continue
      const parent = objs.find((x) => x.id === o.parentId)
      const cv = parent?.type === 'canvas' ? parent : null
      // un Canvas sin .ui (el que se crea para los sprites) no está en el gestor de interfaces: manda su casilla «visible»
      const known = cv ? this.ui?.findCanvas?.(cv.id) : null
      if (cv && (!nodeEffectiveActive(objs, cv) || cv.visible === false || (known && !known.shown))) continue
      const root = this.ed.nodes.get(o.id)
      const overrides = root?.userData.timelineVisualFields
      const effective = { ...o, ...(overrides?.object || {}), props: { ...o.props, ...(overrides?.props || {}) } }
      const p = normalizeSprite(effective.props, true)
      const url = p.image ? this.assetUrlsById?.get(p.image) : ''
      if (!url) continue
      const cvRoot = cv && this.ed.nodes.get(cv.id)
      const canvasProps = cv ? normalizeCanvas({ ...cv.props, ...cvRoot?.userData.timelineCanvas }) : null
      const canvas = cv && canvasProps ? { ...cv, props: canvasProps } : cv
      // Las pistas de transformación actúan sobre el mismo root que representa
      // al nodo; el overlay 2D debe leer esa pose, no la autoría congelada.
      const overlay = root ? { ...effective,
        position: root.position?.toArray?.() ?? effective.position,
        rotation: root.rotation ? [0, 0, root.rotation.z * 180 / Math.PI] : effective.rotation,
        scale: root.userData?.visual?.scale?.toArray?.() ?? effective.scale,
      } : effective
      const sc = sprite2dScreen(overlay, canvas)
      out.push({ id: o.id, url, ...sc, layer: cv ? Math.max(p.layer, canvasProps.layer) : p.layer, pixel: p.filter === 'pixel', flipX: p.flipX, flipY: p.flipY, opacity: effective.opacity ?? 1 })
    }
    return out
  }
  toggle(opts) { return this.on ? this.stop() : this.start(opts) }

  /** Pausa (suelta el ratón para usar el editor) y reanuda. Mientras está en pausa el juego no avanza. */
  pause() {
    if (!this.on) return
    this.paused = !this.paused
    this.state.paused = this.paused
    if (this.paused) { if (doc.pointerLockElement === this.dom) doc.exitPointerLock() } else this._lock()
    this.vp.requestRender()
  }

  /** Avanza un solo fotograma (1/60 s) y vuelve a la pausa. */
  step() {
    if (!this.on) return
    if (!this.paused) this.pause()
    this._stepN = 1
    this.vp.requestRender()
  }

  // =================== arrancar / detener ===================
  /**
   * `here`: empezar con el CharacterBody3D en la vista del editor, si existe.
   * `film` (Nether Film Maker): { seed, camera(cam) } → el mundo corre «como en Play» pero sin jugador ni ratón capturado,
   * a paso fijo de 1/60 s y con la semilla del clima fijada (los rayos caen igual en cada reproducción); `camera` coloca la cámara.
   */
  async start({ here = false, film = null, onProgress } = {}) {
    if (this.on || this.starting) return
    const ed = this.ed, p = this.project
    if (!p || this.rt.locked) return
    this.starting = true
    try {
      await this.session?.begin() // el editor guarda su selección, herramienta y cámara y cierra la edición (todo vuelve al detener)
      this.fromCam = { pos: this.vp.persp.position.clone(), quat: this.vp.persp.quaternion.clone() } // «jugar aquí» (play-level.js)
      Object.assign(this.state, freshPlay(), { on: true })
      const entering = normalizeSceneTransitions(p.scenes.find((s) => s.id === p.activeSceneId)?.transitions)
      const coverStart = !this.runtime && !film && entering.enter
      if (coverStart) this.state.fade = sceneFadeState('out', 0, entering.color, entering.curve)
      const startupCover = coverStart ? this.state.fade : null
      this._pacc = 0; this._alpha = 1
      this._persistObjects = new Map(); this._persistOverrides = new Map()
      this._persistInjected = new Set(); this._persistPhysics = new Map()
      this._managerScene()
      this.ui.reset()
      await onProgress?.('systems')
      await this._loadAssetUrls()
      this.state.spriteRev = (this.state.spriteRev || 0) + 1 // las imágenes de los Sprite 2D ya tienen URL
      try { this.Jolt = await loadJolt() } catch (e) { this.Jolt = null; console.error(e); this.rt.toast('Jolt no cargó: no habrá física de personaje', 'error', 5000) }
      this.on = true
      this._referenceSession = {} // Los handles de una sesión anterior no vuelven a activarse.
      this._runtimePrefabInstances = new Map()
      this._runtimeSceneInstances = new Map()
      this._runtimeSceneSourceCache = new Map()
      this.vp.onWebGpuFallback = reason => this.rt.toast('WebGPU no activo: ' + reason + '. El juego dibuja con WebGL.', 'warn', 6000)
      this.vp.filmCapture = !!film
      this.vp.playing = true
      this.showPlayView()
      this.vp.camera = this.cam
      this.film = film ? { seed: film.seed ?? 1, camera: film.camera || null, onFrame: film.onFrame || null, acc: 0, time: 0, steps: 0 } : null
      const playerDecision = this._scenePlayerSelect()
      this.player.dispose()
      this.player = createPlayer('none', this)
      this.control = true; this.lookControl = true; this.main = null; this.player.begin()
      this.timers = []; this.frameWait = []; this.tweens = []; this.actors = new Map(); this.commons = new Map()
      this._tlInit()
      this._cameraReset()
      this.game = new Game({ database: p.database, host: this._host() })
      this._locInit(p.localization)
      this.player.applyConfig(this.game.db.player) // cuerpo, velocidad y cámara salen de Base de datos ▸ Jugador
      // ViewModel se activa únicamente cuando Jolt valida un CharacterBody3D nativo.
      this._syncParty()
      this._lastRev = -1
      await loadNavCache(this.ed)
      this._gfxInit()
      this._lightInit()
      this._animInit()
      this._profInit()
      this._inputInit()
      this.paused = false; this._stepN = 0
      this.hasPlayer = false // _setupScene confirma la identidad física real
      this._shakeClocks.clear()
      this._shakeBase = null
      this._setupScene('player', here)
      if (!film) await this._startWorldStreaming()
      if (!this.on) return
      this._worldStart()
      this.audio = new AudioScene({ scene: this.ed, host: this.rt, onFinished: (obj) => this.ed.nodeLifecycle.scripts?.emitNativeAudioFinished(obj), cast: (origin, dir, distance, owner) => {
        let start = origin, left = distance
        for (let i = 0; i < 4 && left > 0.05; i++) {
          const hit = this._castOnce(start, dir, left)
          if (!hit) return false
          // El collider del propio emisor no tapa su sonido.
          let own = false
          for (let mesh = hit.mesh; mesh; mesh = mesh.parent) if (mesh === owner) { own = true; break }
          if (!own) return true
          const step = Math.max(0.04, hit.distance + 0.04)
          start = [start[0] + dir[0] * step, start[1] + dir[1] * step, start[2] + dir[2] * step]
          left -= step
        }
        return false
      } })
      this.audio.engine.setMuted(!!this.rt.muted)
      try { await this.audio.start({ deferSources: true }) } catch (e) { console.warn('Audio no disponible', e); this.rt.toast('Audio no disponible: ' + (e.message || e), 'error', 4000) }
      this.weatherSound = new WeatherAudio({ world: this.ed.world, audio: this.audio, camera: () => this.cam, probe: (bearing) => this._soundOcclusion(bearing), scene: this.ed })
      this.ed._rainAudioImpact = (hit) => this.weatherSound?.impact(hit)
      await onProgress?.('scripts')
      await this.game.loadScripts((p.scripts || []).filter((s) => s.execution !== 'node'))
      this.ed.nodeLifecycle.scripts = new NodeScriptRuntime(this)
      this.ed.nodeLifecycle.isEnabled = (obj) => this._nodeEnabled(obj)
      // Los receptores se conectan tras _enter_tree, antes del primer _ready.
      this._sceneSignalReady = true
      this.ed.nodeLifecycle.start()
      // Autoplay solo después de publicar y conectar los métodos de Scripts de Nodo.
      if (this.audio?.on) this.audio.resetSources()
      if (!this.on) return
      await this.game.emit('start')
      await this.game.emit('scene', { scene: this.project.scenes.find((s) => s.id === this.project.activeSceneId)?.name })
      if (this.film) { this.vp.controls.enabled = true; this.state.focus = true; this.state.started = true; this.vp.requestRender(); return }
      if (startupCover && this.state.fade === startupCover) {
        // Dejar pintar al menos un fotograma cubierto antes de comenzar la transición CSS.
        this._sceneFadeTimer = setTimeout(() => requestAnimationFrame(() => {
          if (this.on && this.state.fade === startupCover) this.state.fade = sceneFadeState('in', entering.inSeconds, entering.color, entering.curve)
        }), Math.max(16, Math.round(entering.delay * 1000)))
      } // la app de cine maneja la cámara y la entrada
      win.addEventListener('keydown', this._onKey, true)
      win.addEventListener('keyup', this._onKeyUp, true)
      win.addEventListener('blur', this._onBlur)
      doc.addEventListener('mousemove', this._onMove)
      doc.addEventListener('pointerlockchange', this._onLock)
      this.dom.addEventListener('mousedown', this._onDown)
      win.addEventListener('mouseup', this._onUp)
      this.dom.addEventListener('wheel', this._onWheel, { passive: true })
      this.dom.addEventListener('contextmenu', this._onMenu)
      this.dom.focus()
      if (this.ui.modalOpen) this._modalChanged(); else this._lock()
      this.vp.requestRender()
    } catch (err) {
      console.error(err)
      this.rt.toast('No se pudo iniciar el juego: ' + err.message, 'error', 5000)
      await this.stop()
    } finally {
      this.starting = false
    }
  }

  _closeWorldStreaming() {
    this._worldStreamer?.close()
    this._worldStreamer = null
  }

  async _startWorldStreaming() {
    this._worldStreamer = createSceneStreamer(this, LAYER)
    if (!this._worldStreamer) return
    this._nextStreamCheck = 0
    await this._worldStreamer.settleNearby(this._nativePlayerId ? this.pos : this.cam.position, performance.now() / 1000)
  }

  async stop() {
    if (!this.on && !this.state.on) return
    // El ciclo de salida entrega tree_exiting/tree_exited antes de invalidar los handles.
    this._closeWorldStreaming()
    this.ed.nodeLifecycle.stop()
    this._sceneClearRuntime()
    this._prefabClearRuntime()
    this.game?.closeOutput()
    this.on = false
    this._sceneSignalReady = false
    this._referenceSession = null
    clearTimeout(this._sceneFadeTimer); this._sceneFadeTimer = null
    this.ed.nodeLifecycle.scripts = null
    this.ed.nodeLifecycle.isEnabled = null
    try { this._sceneReset() } catch { /* el visor ya no existe */ } // game.scene: el editor vuelve al entorno del proyecto
    win.removeEventListener('keydown', this._onKey, true)
    win.removeEventListener('keyup', this._onKeyUp, true)
    win.removeEventListener('blur', this._onBlur)
    doc.removeEventListener('mousemove', this._onMove)
    doc.removeEventListener('pointerlockchange', this._onLock)
    this.dom.removeEventListener('mousedown', this._onDown)
    win.removeEventListener('mouseup', this._onUp)
    this.dom.removeEventListener('wheel', this._onWheel)
    this.dom.removeEventListener('contextmenu', this._onMenu)
    if (doc.pointerLockElement === this.dom) doc.exitPointerLock()
    this._tlReset?.()
    this._cameraReset()
    this._animReset()
    this.game?.cancelAll()
    this._offLightning?.(); this._offLightning = null
    this.ed.world.lightningContext = null
    this.ed._rainAudioImpact = null
    this.weatherSound?.stop(); this.weatherSound = null
    this._profEnd()
    if (this._uwOn) { this._uwOn = false; this.vp.setUnderwater(null) } // fuera del agua al salir de Jugar
    this._waterFxEnd(); this._bodiesEnd(); this._waterApiObj = null; this._physicsApiObj = null
    this.audio?.stop(); this.audio = null
    this.ui.reset()
    this.game = null
    this.main = null
    this.timers = []; this.frameWait = []; this.tweens = []; this.actors = new Map()
    this._teardownScene()
    this._nativePlayerId = null
    this._nativePlayerIssue = null
    this._persistEnd()
    this._vmTeardown()
    this.dom.style.opacity = ''; this._fovOverride = false; this.hasPlayer = true; this.paused = false; this._stepN = 0; this.film = null
    this._shakeClocks.clear()
    this._shakeBase = null
    Object.assign(this.state, freshPlay())
    try { await this.session?.returnToScene((id) => this.rt.switchScene(id)) } catch (err) { console.error(err) }
    this.vp.playing = false
    this.vp.filmCapture = false
    this.vp.onWebGpuFallback = null
    this.vp.camera = this.vp.persp
    this.session?.end()
    // La vista física de Edit se recupera inmediatamente tras Stop, sin
    // depender de que ocurra otro frame de interacción del editor.
    if (this.session) this.ed.refreshPhysicalWaterPreview()
    this.vp.requestRender()
  }

  /** Esconde lo del editor que no es del juego (cuadrícula, anillos…) si hay sesión de editor; también al cambiar de escena.
   *  En el juego exportado (sin sesión) lo hace directamente sobre el visor. */
  showPlayView() {
    if (this.session) { this.session.showPlayView(); return }
    // standalone: ocultar cuadrícula y otros ayudantes visibles antes de jugar
    if (this.vp.grid) this.vp.grid.visible = false
  }

  // =================== mundo (hora, clima) ===================
  /** Al empezar a jugar: el reloj y el tiempo vuelven a los del inspector y los relámpagos avisan a los scripts (game.on('lightning'), 'thunder'). */
  _worldStart() {
    const w = this.ed.world
    w.configure(this.project.environment)
    w.lightningContext = w.cfg.weather.lightningImpacts && w.cfg.weather.lightningModel === 'physical'
      ? () => this._lightningWorldContext() : null
    if (this.film) w.reseed(this.film.seed)
    this._offLightning?.()
    this._offLightning = w.on('lightning', (e) => {
      if (this._filmJumping) return // saltando en el tiempo (montaje): los rayos del salto no suenan ni avisan
      this.game?.emit('lightning', e)
      if (e.impact) this._lightningWorldHit(e.impact)
      this.weatherSound?.lightning(e)
      if (e.thunderEnabled !== false) this.timers.push({ t: e.delay, r: () => { const info = this.weatherSound?.thunder(e); this.game?.emit('thunder', info ? { ...e, ...info } : e) } }) // un rayo de Timeline puede separar luz y trueno; los demás conservan el retraso físico
    })
    this.ed.vp.nature?.critters.reset() // los animales vuelven al suelo y salen de nuevo
    this.ed.applyWorld()
  }

  // =================== escena ===================
  _setupScene(tag, here = false) {
    this._runtimeGroups = new Map() // La pertenencia modificada por scripts nunca entra en las escenas guardadas.
    this._shakeClocks.clear() // Una escena nueva no hereda reproducciones temporales de otra.
    const ed = this.ed, p = this.project
    this._managerScene()
    const decision = this._scenePlayerSelect()
    // Una nueva escena nativa no hereda objetos de la vista anterior, aunque
    // el tipo inerte de controlador sea el mismo.
    this._vmTeardown()
    // Releer la configuración del registro Jugador después de resolver GameManager,
    // para no perder velocidad, tamaño del cuerpo y FOV al entrar a otra escena.
    this.player.applyConfig(this.game?.db?.player)
    // _vmSetup se retrasa hasta verificar que el CharacterBody3D existe en Jolt.
    if (this._prof) {
      this._prof.cam = ''
      this._prof.player = this._gm?.profile || ''
      this._prof.override = null
      this._profApply(this._profWanted(), 0)
    }
    this.player.sceneReset()
    this._sceneOv = {} // cambios de game.scene: duran lo que la escena (play-scene.js)
    this.level = normalizeLevel(p.environment?.level) // reglas del nivel (Escena ▸ Nivel): correr, saltar, velocidad, gravedad
    ed.refreshBrushes?.() // los huecos de los brushes sustractivos ya calculados antes de crear colisiones
    ed.vp.scene.updateMatrixWorld(true) // las matrices de los nodos recién creados deben estar al día antes de lanzar rayos
    this._gpInitScene()
    // Física de escena: únicamente nodos físicos y sistemas especializados.
    this.colliders = []
    this.phys?.dispose()
    this.phys = this.Jolt ? new JoltWorld(this.Jolt, { radius: this.body.radius, height: this.body.height, stepUp: this.body.stepHeight, maxSlope: this.g.slopeLimit ?? 50 }) : null
    if (this.phys) for (const t of ed.terrains) this.phys.addTerrain(t)
    // La geometría visual no crea cuerpos físicos. Solo lo hacen los nodos físicos
    // y los subsistemas especializados de eventos y Gameplay Objects.
    // Los objetos interactuables usan su perfil de Database, nunca una segunda colisión genérica.
    for (const g of this._gpObjects.values()) {
      if (!g.info || g.state.status !== 'world' || !nodeEffectiveActive(p.objects, g.obj)) continue
      if (!g.state.flight && (g.profile?.type === 'static' || g.profile?.type === 'kinematic')) {
        this._addColliders(g.node, this.colliders)
        if (g.profile.type === 'kinematic') this.phys?.makeKinematic(g.node)
      }
    }
    // los ayudantes del editor (spawns, triggers, cámaras, iconos de luz, zonas de evento) no se ven al jugar
    this.hidden = []
    this.sprite2dVis = new Map() // visibilidad de los Sprite 2D cambiada por scripts o eventos
    for (const o of p.objects) {
      const node = ed.nodes.get(o.id)
      if (!node) continue
      if (node.userData.indicatorZonesGizmo) { node.userData.indicatorZonesGizmo.visible = false; this.hidden.push(node.userData.indicatorZonesGizmo) }
      if (o.type === 'audio') ed._applyViewToNode(node) // las ayudas de audio solo se ven al editar
      if (o.type === 'event') { for (const h of [node.userData.visual, node.userData.gem, node.userData.previewGraphic, node.userData.gaze]) if (h) { h.visible = false; this.hidden.push(h) } } else if (o.type === 'light') { const v = node.userData.visual; if (v) { v.visible = false; this.hidden.push(v) } } else if (o.type === 'postvolume') { const v = node.userData.visual; if (v) { v.visible = false; this.hidden.push(v) } } else if (o.type === 'cameraShake') { const v = node.userData.visual; if (v) { v.visible = false; this.hidden.push(v) } } else if (['trigger', 'atmovolume', 'spawn', 'camera', 'canvas', 'sprite2d'].includes(o.type) || isCutter(o)) { node.visible = false; this.hidden.push(node) } // el Sprite 2D se pinta en la pantalla (UiRoot)
    }
    // eventos
    this.events = p.objects.filter((o) => o.type === 'event').map((o) => ({
      id: o.id, obj: o, props: normalizeEvent(o.props), node: ed.nodes.get(o.id),
      pageIdx: -2, gfx: null, gfxColl: [], erased: false, inside: false, par: null, quick: 0, off: false,
    })).filter((e) => e.node)
    // Los eventos retenidos mantienen sus flags; su página y su física se reconstruyen con el nivel.
    for (const e of this.events) {
      const prev = this._persistEventStates?.get(e.id)
      if (prev) { e.erased = !!prev.erased; e.off = !!prev.off }
    }
    // Las cámaras/ayudas ocultas no cambian el estado lógico de visible/active.
    this._buildSensors(p)
    this._restoreEventPhysics()
    this.phys?.finalize()
    ed.hidePhysicalWater() // retirar la vista inicial del editor antes de iniciar la física
    this.water = WaterWorld.fromObjects(p.objects) // agua consultable (superficie con olas, corriente): la usa el jugador
    ed._activeWaterWorld = this.water // las gotas y la física consultan una sola autoridad en Play Mode
    // Los colliders deben existir antes de muestrear barreras hidráulicas.
    this._bodiesInit() // nodos físicos declarados + cuerpos propios de eventos y Database
    this._syncNodeActivationPhysics()
    this.phys?.finalize()
    // CA-005: Lago/Río construyen dominio nativo automáticamente sin una opción de activación.
    this._waterConnection = null
    const waterConfig = nativeWaterConfiguration(this.water, p.environment?.waterSimulation, ed.terrains)
    if (waterConfig) {
      this._waterConnection = new TerrainWaterConnection(this.water, waterConfig,
        ed.terrains, ed.world, (o, u, distance) => !!(this.phys
          ? this.phys.raycast(o, u, distance, { backFaces: true, staticOnly: true })
          : this._castOnce(o, u, distance)),
        (from, to) => ed.rainImpact(from, to),
        () => this._waterObjectSignature(), p.liquids || [])
    }
    this._liquidInit()
    this._waterFilmInitial = this.film && this._waterConnection ? this.water.snapshot() : null
    if (this.film && !this._waterConnection && this._liquidViews?.length) this._waterFilmInitial = this.water.snapshot()
    if (this._waterConnection) ed.showPhysicalWater(this.water)
    ed.setPhysicalWaterBounds(this.water) // después del montaje: no perder uniformes al retirar la vista previa de Edit
    this._gpBodiesInit()
    this._persistPhysicsResume()
    // CharacterBody3D debe estar registrado antes de montar las manos y
    // restaurar los objetos de Database que estaban en un slot.
    if (decision.kind === 'native' && this._nativeCharacterState()) this._vmSetup()
    this._gpReady()
    this._tornadoInit()
    this._waterFxInit() // gotas, ondas y objetos que flotan (play-water.js)
    const rc = ed.vp.renderCfg
    this.lod = rc ? new LodManager(ed, rc) : null // autoridad de clústeres siempre presente en Play
    try { this.lod?.attach() } catch (e) { this.lod?.detach(); console.warn('LOD / BatchedMesh', e); this.lod = null }
    this._destructionInit()
    if(this.film && (this._waterConnection || this._liquidViews?.length || this.water.suspensionEnabled)) this._waterFilmInitial=this.water.snapshot()
    this._vmLights()
    this.nav = new NavWorld(p.objects.filter((o) => o.type === 'navigation' && o.props.asset && navCache.has(o.props.asset)).map((o) => ({ id: o.id, name: o.name, grid: navCache.get(o.props.asset), node: ed.nodes.get(o.id) })))
    // NavWorld es dueño de las vistas transitorias; este host solo le provee
    // el horneador existente, sin escribir .navmesh ni crear bucles físicos.
    for (const region of this.nav.regions) {
      const obj = p.objects.find(o => o.id === region.id)
      const node = region.node
      if (!obj || !node) continue
      node.userData.navBakeRuntime = { refresh: () => {
        if (!this.on || this.nav?.regions?.includes(region) !== true || this.ed.nodes.get(obj.id) !== node) return
        const overrides = node.userData.timelineNavBake
        if (!overrides || !Object.keys(overrides).length) { this.nav.restoreBake(region.id); return }
        const props = { ...obj.props, ...overrides,
          stepHeight: node.userData.timelineNavStepHeight ?? obj.props.stepHeight }
        const effective = { ...obj, props }
        const bounds = navBounds(effective)
        // Un guard fijo evita que un recurso animado genere millones de muestras
        // simultáneas en un equipo de memoria limitada.
        const signature = JSON.stringify([obj.id, bounds, props.cell, props.agentRadius,
          props.agentHeight, props.maxSlope, props.stepHeight, props.layers])
        const session = this._referenceSession
        this.nav.requestBake(obj.id, signature,
          signal => {
            if (!this.on || session !== this._referenceSession || signal.aborted) throw new Error('Cancelado')
            return bakeNavRegion({ editor:ed, project:p, obj:effective, bounds,
              signal, refreshBrushes:false, maxCells:100_000 })
          }, error => this.game?.report?.(error))
      } }
      if (node.userData.timelineNavBake) node.userData.navBakeRuntime.refresh()
    }
    this._lastRev = -1
    // Sólo un CharacterBody3D válido, autoral o por API, habilita gameplay del jugador.
    if (decision.kind === 'native' && this._nativeCharacterState()) this._nativePlayerConfigApply()
    if (decision.kind === 'native' && !this._nativeCharacterState()) {
      this._nativePlayerIssue = { kind: 'invalid', id: decision.id, reason: 'missing-jolt-body' }
      this._nativePlayerId = null
      this.rt.log?.(`CharacterBody3D sin cuerpo físico Jolt: ${decision.id}`, 'error', 'Player FPS nativo')
    }
    this.hasPlayer = !!this._nativePlayerId
    this.state.player = this.hasPlayer
    if (!this.hasPlayer) this.cand = null
    if (this.hasPlayer && here) this._placeAtCamera()
    // Escena ▸ Nivel ▸ «Mostrar el nombre al entrar»
    this.state.levelTitle = null
    const lv = normalizeLevel(this.project.environment?.level)
    if (lv.showName && !this.film) this.showLevelName()
    ed.vp.requestRender()
  }







}

// Los métodos de PlayMode viven en play-*.js (mixins). Se copian los descriptores (no Object.assign) para que los getters no se ejecuten al mezclar.
function mixin(cls, methods) { Object.defineProperties(cls.prototype, Object.getOwnPropertyDescriptors(methods)) }
mixin(PlayMode, nodesMethods)
mixin(PlayMode, persistentMethods)
mixin(PlayMode, eventsMethods)
mixin(PlayMode, playerMethods)
mixin(PlayMode, dialogMethods)
mixin(PlayMode, cameraMethods)
mixin(PlayMode, cameraShakeMethods)
mixin(PlayMode, controlsMethods)
mixin(PlayMode, levelMethods)
mixin(PlayMode, hostMethods)
mixin(PlayMode, senseMethods)
mixin(PlayMode, weatherMethods)
mixin(PlayMode, waterFxMethods)
mixin(PlayMode, lightningMethods)
mixin(PlayMode, tornadoMethods)
mixin(PlayMode, destructiveTornadoMethods)
mixin(PlayMode, liquidMethods)
mixin(PlayMode, bodyMethods)
mixin(PlayMode, gameplayObjectMethods)
mixin(PlayMode, indicatorMethods)
mixin(PlayMode, heldActionsMethods)
// @@MIXINS@@

Object.assign(PlayMode.prototype, routeMethods, timelineMethods, stepMethods, profileMethods, inputMethods, graphicsMethods, lightMethods, animMethods, saveMethods, signalMethods, lookMethods, sceneMethods)
