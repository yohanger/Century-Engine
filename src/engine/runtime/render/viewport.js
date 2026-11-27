import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js'
import { clamp } from '../util.js'
import { setIblDiffuse } from './chunks.js'
import { ReflectionProbe } from './reflection-probe.js'
import { WorldRayScene } from './world-ray-scene.js'
import { WorldIrradiance } from './world-irradiance.js'
import { WetReflections } from './wet-reflections.js'
import { LookPipeline } from './look.js'
import { createInfiniteGrid } from './infinite-grid.js'
import { PerfMonitor } from './perf.js'
import { RuntimePerformanceController } from './performance-controller.js'
import { ViewDiagnostics } from './view-diagnostics.js'
import { CameraOcclusion } from './camera-occlusion.js'
import { LF_TIME } from './pbr.js'
import { SKY_VERT, SKY_FRAG } from './skylib.js'
import { SkyVariants } from './sky-variants.js'
import { PrecipFX } from '../world/fx.js'
import { LightningFX } from '../world/lightning-fx.js'
import { setCameraFov, refreshCameraFov } from './camera-fov.js'
import { navMethods } from './viewport-nav.js'
import { envMethods } from './viewport-env.js'

// El ambiente difuso: luz plana en el look «clásico» o IBL completo en «realista»; ver render/chunks.js.

/** Renderer, cámara, controles de navegación estilo Unreal, cielo, rejilla y luces de editor. */
export class Viewport {
  constructor(container) {
    this.container = container
    RectAreaLightUniformsLib.init() // tablas LTC oficiales; compartidas por Editor y Player.
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false })
    // Si el driver reinicia la GPU (p. ej. tras un horneado largo) el contexto se pierde: se pausa el dibujo y, al volver, se reconstruye lo que vivía en la GPU.
    const cv = this.renderer.domElement
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this._glLost = true })
    cv.addEventListener('webglcontextrestored', () => this._glRestored())
    // En laptops con pantalla HiDPI limitar la densidad ahorra mucha GPU sin perder nitidez apreciable.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    // Sin tone mapping por defecto (Linear); el look del proyecto (Ajustes → Render) lo cambia.
    this.renderer.toneMapping = THREE.NoToneMapping
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    // la comprobación de errores de shader fuerza una lectura síncrona tras cada compilación: solo en desarrollo
    this.renderer.debug.checkShaderErrors = !!import.meta.env?.DEV
    this.dom = this.renderer.domElement
    this.dom.style.cssText = 'display:block;width:100%;height:100%;outline:none'
    this.dom.tabIndex = 0
    container.appendChild(this.dom)

    this.perf = new PerfMonitor(this.renderer) // Stats detallado o muestreo ligero del presupuesto en Play
    this.occlusion = new CameraOcclusion(this) // una sola capacidad por cámara de render, Editor/Play/Player
    const sm = this.renderer.shadowMap, renderShadows = sm.render.bind(sm)
    sm.render = (l, sc, c) => this.occlusion.withShadows(() => (this.perf.enabled ? this.perf.time('Sombras', () => renderShadows(l, sc, c)) : renderShadows(l, sc, c)))
    this.look = new LookPipeline(this)
    this.performanceController = new RuntimePerformanceController(this)
    // Uniformes compartidos por las primitivas y mallas editables. No se cambian sus geometrías.
    this.psxUniforms = { size: { value: new THREE.Vector2(1, 1) }, step: { value: 0 }, phase: { value: new THREE.Vector2(0, 0) } }
    this.scene = new THREE.Scene()
    this.persp = new THREE.PerspectiveCamera(60, 1, 0.1, 2000)
    this.persp.position.set(0, 10, 10) // posición inicial de autoría; no depende del tamaño del terreno
    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000)
    this.camera = this.persp // la activa; cambia con setOrtho()
    this._camSubs = new Set()
    this._orthoH = 10 // semialtura del frustum ortográfico con zoom = 1

    // grupos
    this.world = new THREE.Group() // terreno + objetos
    this.overlay = new THREE.Group() // gizmos, brush, helpers (no se exporta ni se selecciona)
    this.scene.add(this.world, this.overlay)

    // cielo
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      defines: { LF_CLOUD_VOLUME: 1 },
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, ground: { value: new THREE.Color() },
        uMode: { value: 0 }, uExposure: { value: 1 }, uRotation: { value: 0 }, uTint: { value: new THREE.Color(1, 1, 1) },
        uPano: { value: null }, uPanoFlip: { value: 0 }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color(1, 1, 1) },
        uTurb: { value: 2 }, uRayleigh: { value: 1 }, uMie: { value: 0.005 }, uMieG: { value: 0.8 },
        uCamY: { value: 0 }, uTime: { value: 0 }, uClouds: { value: 0 }, uCloudSteps: { value: 24 }, uCloudDiagnostic: { value: 0 },
        uSolarTransmission: { value: 1 }, uNight: { value: 0 }, uMoonColor: { value: new THREE.Color(0, 0, 0) },
        uStormCover: { value: 0 }, uStormFront: { value: new THREE.Vector4(0, 1, 0, 0) },
        uLightningCloud: { value: new THREE.Vector4() }, uLightningEnergy: { value: 0 }, uSkyFogDensity: { value: 0 }, uSkyFogColor: { value: new THREE.Color() }, uWeatherHazeFalloff: { value: 0 },
        uCovg: { value: 0.5 }, uCType: { value: 0.5 }, uShape: { value: null }, uDetail: { value: null }, uCDens: { value: 1 }, uCBase: { value: 1500 }, uCThick: { value: 1400 }, uCScale: { value: 1 }, uCErode: { value: 0.5 },
        uCCells: { value: 0 }, uCMap: { value: null }, uCCam: { value: new THREE.Vector2() }, uCAtm: { value: new THREE.Vector2() }, uCMapHalf: { value: 1 },
        uCVolume: { value: null }, uCVolumeOrigin: { value: new THREE.Vector4() }, uCVolumeBlend: { value: 1 },
        uTornadoCloud: { value: new THREE.Vector4() }, uTornadoShape: { value: new THREE.Vector4() }, uTornadoOrganization: { value: new THREE.Vector4() }, uCamXZ: { value: new THREE.Vector2() },
        uCWind: { value: 10 }, uCWindDir: { value: 0 }, uWindOff: { value: new THREE.Vector2() }, uStars: { value: 0 }, uMoonVis: { value: 0 }, uFlash: { value: 0 }, uMoonDir: { value: new THREE.Vector3(0, -1, 0) }, uStarAxis: { value: new THREE.Vector3(0, 1, 0) }, uStarAng: { value: 0 }, uAstro: { value: 0 }, uLat: { value: 0 }, uLst: { value: 0 }, uStarTex: { value: null }, uStarOff: { value: null }, uStarCore: { value: 0.72 }, uMoonTex: { value: null }, uPlDir: { value: Array.from({ length: 5 }, () => new THREE.Vector3(0, -1, 0)) }, uPlCol: { value: Array.from({ length: 5 }, () => new THREE.Vector4()) }, uPlRad: { value: [0, 0, 0, 0, 0] }, uMoonRight: { value: new THREE.Vector3(1, 0, 0) }, uMoonUp: { value: new THREE.Vector3(0, 1, 0) }, uAstroSun: { value: new THREE.Vector3(0, 1, 0) }, uMoonIllum: { value: 1 }, uMoonRad: { value: 0.0122 }, uCLight: { value: 1 }, uCTint: { value: new THREE.Color(1, 1, 1) }, uCAmb: { value: new THREE.Color(0.3, 0.4, 0.55) },
      },
    })
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), this.skyMat)
    // Después de los opacos: early depth rechaza el raymarch tapado por paredes
    // y terreno. Los transparentes siguen componiéndose después del cielo.
    this.sky.renderOrder = 10000
    this.sky.frustumCulled = false
    this.scene.add(this.sky)
    // Anidado en la consulta GPU real de 'Escena · dibujo': separa el coste de cielo y nubes del resto de la escena.
    this.sky.onBeforeRender = () => this.perf.begin('Cielo atmosférico')
    this.sky.onAfterRender = () => this.perf.end('Cielo atmosférico')
    this.precip = new PrecipFX(this.scene) // lluvia y nieve (modo Jugar y vista viva del editor)
    this.bolt = new LightningFX(this.scene) // el rayo visible (Escena ▸ Clima ▸ Tipo de rayos ▸ Físicos)
    this.wetReflections = new WetReflections(this)
    this.reflectionProbe = new ReflectionProbe(this)
    this.worldIrradiance = new WorldIrradiance(this)
    this.worldRayScene = new WorldRayScene(this)
    this.nature = null // hojas, viento en la vegetación y animales (core/world/nature.js); lo monta el editor
    this.windWorld = null // instancia World que resuelve el viento efectivo local; lo asigna SceneGraph
    this.weatherOcclusion = 0 // oclusión acústica del oyente 0–1 (bloque G); la escribe play.js cada frame para suprimir lluvia bajo techos
    this.liveFx = false // editor: animar el clima (lluvia, viento, hojas…) sin jugar
    this.viewMode = 'lit' // override editorial no persistente; el Player siempre utiliza Lit
    this.viewDiagnostics = new ViewDiagnostics(this)
    this._wf = null // estado del mundo (hora y clima) que sobrescribe el entorno de la escena; null = el del inspector tal cual

    // luces de ambiente / editor
    this.hemi = new THREE.AmbientLight('#b9d3ec', 0)
    // el ambiente sale del cielo (IBL), (IBL completo)
    this.pmrem = new THREE.PMREMGenerator(this.renderer)
    this.envScene = new THREE.Scene()
    this.envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), this.skyMat))
    this.skyVariants = new SkyVariants(this)
    this.editorSun = new THREE.DirectionalLight('#ffffff', Math.PI * 0.8)
    this.editorSun.position.set(0.5, 1, 0.35)
    this.scene.add(this.hemi, this.editorSun)

    // rejilla
    this.grid = null
    this.setGrid(1, 64)


    // Navegación: clic central = orbitar (Shift: desplazar), rueda = zoom, clic derecho + WASD = vuelo, Shift + clic derecho = desplazar.
    // Sin ratón de tres botones: Alt + clic izq. = orbitar, Alt + Shift + clic izq. o Espacio + clic izq. = desplazar.
    this._space = false
    this.nav = 'mouse'
    this.isNavigating = false
    this.playing = false // modo Jugar: la cámara la lleva el jugador
    // Shift + clic derecho arrastrando = desplazar (sin Shift, el clic derecho es el modo vuelo)
    this.dom.addEventListener('pointerdown', (e) => {
      if (this.playing || this._guardEditorPointerDown(e)) return
      // OrbitControls invierte con Mayús (ROTATE + Mayús = desplazar), así que se pide ROTATE para obtener el desplazamiento
      if (e.button === 2) { this.controls.mouseButtons.RIGHT = e.shiftKey ? THREE.MOUSE.ROTATE : -1; return }
      if (e.button !== 0) return
      this.controls.mouseButtons.LEFT = this._space ? THREE.MOUSE.PAN : e.altKey ? THREE.MOUSE.ROTATE : -1
    }, { capture: true })
    this.controls = new OrbitControls(this.camera, this.dom)
    this.controls.mouseButtons = { LEFT: -1, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: -1 }
    // Selección como centro de órbita, pero solo al iniciar una órbita real (nunca al seleccionar ni desplazar).
    this.orbitAroundSelection = true
    this.orbitSelectionPoint = null // el Editor provee el centro; el Player no conoce selección
    this.dom.addEventListener('pointerdown', (e) => {
      if (this.playing || this._flying) return
      if ((e.button === 1 && !e.shiftKey) || (e.button === 0 && e.altKey && !e.shiftKey && !this._space)) this._prepareSelectionOrbit()
    }, { capture: true })
    this.controls.addEventListener('start', () => { this.isNavigating = true; if (this.currentView) { this.currentView = null; this._viewChanged() } })
    this.controls.addEventListener('end', () => { this.isNavigating = false })
    this.controls.enableDamping = false
    this.controls.zoomToCursor = true
    this.controls.maxPolarAngle = Math.PI // sin tope: tras mirar hacia arriba con el vuelo el objetivo queda sobre la cámara y un tope de 90° la subía (el tope al orbitar está en _orbitBy)
    this.controls.target.set(0, 0, 0)
    this.controls.addEventListener('change', () => this.requestRender())

    this._needs = true
    this._raf = 0
    this._flying = false
    this._keys = new Set()
    this._flySpeed = 14
    this._last = performance.now()
    this._onFrame = []
    // gestos del trackpad: se acumulan por evento y se aplican (suavizados) una vez por fotograma
    this._padState = { ox: 0, oy: 0, px: 0, py: 0, z: 0, zx: 0, zy: 0, zoomUntil: 0, lastEv: 0, holdUntil: 0 }
    this._bindFly()
    this._bindContinuousNavigation()

    this._ro = new ResizeObserver(() => this.resize())
    this._ro.observe(container)
    this.resize()
    this._loop = this._loop.bind(this)
    this._raf = requestAnimationFrame(this._loop)
  }

  // ---------- render ----------
  requestRender() { this._needs = true }
  onFrame(fn) {
    this._onFrame.push(fn)
    return () => { const i = this._onFrame.indexOf(fn); if (i !== -1) this._onFrame.splice(i, 1) }
  }

  _loop(now) {
    this.step(now)
    this._raf = requestAnimationFrame(this._loop)
  }
  /** Un fotograma sin programar el siguiente (lo usa el rastreo AR de Nether Film Maker, que marca su propio ritmo). */
  step(now = performance.now()) {
    const started = performance.now(), frameMs = now - this._last
    const controller = this.performanceController
    controller.sync(started, !document.hidden)
    this.perf.budgetStride = frameMs > 50 ? 2 : 8 // suficientes muestras GPU incluso cuando ya hay pocos FPS
    const dt = Math.min(0.1, (now - this._last) / 1000)
    this._last = now
    if (this._flying) this._flyStep(dt)
    this._padStep(dt, now)
    for (const fn of this._onFrame) if (fn(dt)) this._needs = true
    const logicMs = performance.now() - started
    if (this._psxTemporalActive() && !this.dom.ownerDocument.hidden) this._needs = true
    const drew = this._needs && !this._glLost
    if (this._needs) this._render()
    if (drew && controller.active && !this.nativeBackend?.active) controller.sample({ frameMs, logicMs,
      cpuMs: performance.now() - started, gpuMs: this.perf.takeBudgetGpu(), calls: this.renderer.info.render.calls }, performance.now())
  }

  /** Algo que proyecta sombra cambió: las luces mixtas/estáticas (sombras en caché) y la luz volumétrica las recalculan. */
  invalidateShadows() { this._shadowDirty = true; this.look.volDirty = true; this.requestRender() }

  /** Firma barata de lo que proyecta sombra: cambia cuando una malla con sombra se mueve, aparece o desaparece. */
  _casterSig() {
    let h = 0, n = 0
    this.scene.traverse((o) => {
      if (!o.isMesh || !o.castShadow) return
      if (o.isInstancedMesh) { h += o.visible ? o.count * 0.37 : 0; n++; return } // vegetación: cambia si el LOD cambia cuántas instancias se dibujan
      if (o.isSkinnedMesh) { h += Math.random(); return } // un personaje animado cambia en cada pose
      const e = o.matrixWorld.elements
      let v = 0
      for (let i = 0; i < 16; i++) v += e[i] * (i + 1.7)
      h += o.visible ? v : -v * 3.1
      n++
    })
    return h + ':' + n
  }

  _render() {
    if (!this.nativeBackend?.active && (this._glLost || this.renderer.getContext().isContextLost())) { this._needs = true; return } // contexto perdido (el evento llega después): se reintenta al volver
    this._needs = false
    this._advancePsxFrame()
    if (!this.playing && this.drawMeshLocal) {
      const pf = this.perf
      pf.frameStart()
      let drawn
      try { drawn = pf.time('Modo Local', () => this.drawMeshLocal()) }
      finally { pf.frameEnd() }
      if (drawn) { this._notifyCameraOrientation(); return }
    }
    if (this.drawEditorPreview && !this.playing) this.drawEditorPreview(() => this._draw())
    else this._draw()
  }

  drawEditorOverlay(visibility = null) {
    const scene = this.scene, renderer = this.renderer
    const helpers = new Set([this.overlay, this.grid, this.bolt?.mesh].filter(Boolean))
    const saved = visibility ?? scene.children.map(obj => [obj, obj.visible])
    if (!saved.some(([obj, visible]) => helpers.has(obj) && visible &&
      (obj !== this.overlay || obj.children.length > 0))) return false

    const background = scene.background
    const autoClear = renderer.autoClear, toneMapping = renderer.toneMapping
    const target = renderer.getRenderTarget()
    try {
      for (const [obj, visible] of saved) obj.visible = helpers.has(obj) && visible
      scene.background = null
      renderer.autoClear = false
      renderer.toneMapping = THREE.NoToneMapping
      if (target !== null) renderer.setRenderTarget(null)
      renderer.clearDepth()
      renderer.render(scene, this.camera)
      return true
    } finally {
      for (const [obj, visible] of saved) obj.visible = visible
      scene.background = background
      renderer.autoClear = autoClear
      renderer.toneMapping = toneMapping
      if (target !== null) renderer.setRenderTarget(target)
    }
  }

  _draw() {
    const now = performance.now()
    if (this.playing && now - (this._lastShadowInv || 0) > 250) {
      this._lastShadowInv = now
      const sig = this._casterSig() // las sombras en caché solo se recalculan si algo que proyecta sombra se movió de verdad
      if (sig !== this._casterHash) { this._casterHash = sig; this._shadowDirty = true; this.look.volDirty = true }
    } else if (!this.playing) this._casterHash = null
    if (this._shadowDirty) {
      this._shadowDirty = false
      this.scene.traverse((o) => { if (o.isLight && o.shadow && o.castShadow && !o.shadow.autoUpdate) o.shadow.needsUpdate = true })
    }
    this.sky.position.copy(this.camera.position)
    LF_TIME.value = performance.now() / 1000
    this.skyMat.uniforms.uCamY.value = this.camera.position.y
    this.skyMat.uniforms.uCamXZ.value.set(this.camera.position.x, this.camera.position.z)
    if (this.skyMat.uniforms.uCCells.value === 1 && this._wf?.clouds?.map) this._placeCellClouds(this._wf.clouds, this.skyMat.uniforms)
    this.skyMat.uniforms.uTime.value = this.playing ? (this._wf?.weatherOn && Number.isFinite(this._wf?.clouds?.evolution) ? this._wf.clouds.evolution : LF_TIME.value) : 0
    if (!this._wf?.weatherOn) { const u = this.skyMat.uniforms, w = u.uCWind.value * u.uTime.value, a = u.uCWindDir.value; u.uWindOff.value.set(Math.cos(a) * w, Math.sin(a) * w) } // sin clima: nubes con el viento fijo del inspector
    const pdt = this._pfT ? Math.min(0.1, LF_TIME.value - this._pfT) : 0.016
    this._pfT = LF_TIME.value
    const live = this.playing || this.liveFx
    // Un muestreo local para precipitación y naturaleza: evita recalcular obstáculos dos veces por frame.
    const windLocal = live && this._wf?.wind && this.windWorld?.windAt3D
      ? this.windWorld.windAt3D(this.camera.position.x, this.camera.position.y, this.camera.position.z) : null
    if (this.precip.update(live ? this._wf : null, this.camera, pdt, this.renderer.domElement.height, this.playing ? this.weatherOcclusion : 0, windLocal)) this._needs = true // lluvia / nieve: se anima sola; bloque G: bajo techo se suprime
    this.bolt.ground = this.precip.ground
    if (this.bolt.update(live ? this._wf : null, this.camera)) this._needs = true // el rayo parpadea solo
    if (this.nature?.update(this._wf, this.camera, pdt, this.renderer.domElement.height, live, this.playing, this.windWorld, windLocal)) this._needs = true // hojas, viento, animales
    const cloudMap = this._wf?.clouds?.map
    const volume = cloudMap?.volume
    const confirmedEmpty = !!(this._wf?.weatherOn && this._wf?.clouds?.cells && cloudMap?.version &&
      !cloudMap.hasClouds && !volume?.hasClouds)
    const cloudSteps = confirmedEmpty ? 0 : this.look.profile === 'alto' ? 56 : this.look.profile === 'medio' ? 36 : 24
    this.skyMat.uniforms.uCloudSteps.value = this.sky.visible && this.skyMat.uniforms.uClouds.value
      ? Math.round(cloudSteps * this.performanceController.cloudScale) : 0
    // Información de presupuestos reales, NO tiempo GPU ni triángulos de nube inventados.
    if (this.perf.enabled) {
      const ex = this.perf.stats.extra
      ex.cloudStepsBudget = this.skyMat.uniforms.uCloudSteps.value
      ex.cloudProfile = this.look.profile
      ex.cloudPrimitives = cloudMap?.prims ?? null
      ex.cloudGrid = volume?.N && volume?.depth ? `${volume.N}×${volume.N}×${volume.depth}` : null
      ex.cloudEmptySkip = confirmedEmpty
      ex.cloudSolarTransmission = this._wf?.solarTransmission ?? this._manualSunTransmission ?? null
      ex.cloudMetricNote = 'Pasos máximos por rayo y primitivas CPU; GPU incluida en Cielo atmosférico'
    }
    this.skyVariants.update()
    if (this.playing) { const t = performance.now(); if (this._lastDraw) this.look.tick(t - this._lastDraw); this._lastDraw = t } else this._lastDraw = 0
    if (this._drawWithSolarTransmission(() => this._drawWebGpu(now))) return
    const pf = this.perf
    pf.frameStart()
    pf.begin('Fotograma (CPU)')
    try { this._drawWithSolarTransmission(() => {
      const render = this.renderCfg
      const editorDiagnostic = !this.playing && !this.drawEditorPreview && this.viewMode !== 'lit'
      if (this._editorDiagnosticLod) this._editorDiagnosticLod.update(this.camera)
      if (editorDiagnostic) {
        const supported = this.viewDiagnostics.capability(this.viewMode).supported
        if (supported) {
          this.viewDiagnostics.draw(this.viewMode)
          this.drawEditorOverlay()
        } else {
          this.viewDiagnostics.draw(this.viewMode) // publica motivo, sin instrumentación falsa
          this.look.render(0) // Lit completo como respaldo, incluidos sus efectos
        }
        const d = this.viewDiagnostics.last
        pf.stats.extra.viewDiagnostics = { ...d } // métricas de una escena real, nunca un contador sintético
      } else {
        delete pf.stats.extra.viewDiagnostics
        this.worldRayScene.update(this.playing && render?.look === 'realista' && this.look.profile !== 'bajo' &&
          (render.worldRayBounce && render.screenBounce > 0 || render.worldRayReflection > 0) && this.renderer.extensions.has('EXT_color_buffer_float'), now)
        this.worldIrradiance.update(this.playing && render?.look === 'realista' && this.look.profile !== 'bajo' && render.indirectProbeGrid, now, render?.indirectProbeCoverage,
          this.performanceController.captureScale)
        this.reflectionProbe.update(render?.look === 'realista' && render.dynamicReflections && render.reflections > 0, now,
          this.performanceController.reflectionInterval)
        if (render?.look === 'realista' && render.puddleReflections) {
          pf.begin('Reflejo de charcos')
          this.wetReflections.update(this.reflectionTerrains?.() || [], render.puddleReflectionStrength, now)
          pf.end('Reflejo de charcos')
        } else if (this.wetReflections.active.size) this.wetReflections.dispose()
        this.look.render(this.playing ? LF_TIME.value : 0)
      }
    }) } finally {
      pf.end('Fotograma (CPU)')
      pf.frameEnd()
    }
    this._notifyCameraOrientation()
  }

  _notifyCameraOrientation() {
    if (this.onCamQuat && !this.drawEditorPreview) { const q = this.camera.quaternion; const k = q.x + ':' + q.y + ':' + q.z + ':' + q.w + this.isOrtho; if (k !== this._qk) { this._qk = k; this.onCamQuat([q.x, q.y, q.z, q.w]) } }
  }

  _drawWebGpu(now) {
    const extra = this.perf.stats.extra
    if (!this.playing || this.look.cfg.backend !== 'webgpu') {
      this.nativeBackend?.dispose()
      this.nativeBackend = null
      this._gpuError = ''
      this._gpuNotice = ''
      delete extra.renderBackend
      delete extra.webgpuReason
      return false
    }
    extra.renderBackend = 'WebGL'
    if (!this._gpuModule && !this._gpuImport && !this._gpuError) {
      this._gpuImport = import('./webgpu-play.js').then(module => { this._gpuModule = module })
        .catch(error => { this._gpuError = error.message })
        .finally(() => { this._gpuImport = null; if (!this._disposed) this.requestRender() })
    }
    if (this.nativeBackend?.error) this._gpuError = this.nativeBackend.error
    const reason = this._gpuError || this._gpuModule?.unavailableWebGpuEffect(this)
    if (reason || !this._gpuModule) {
      if (reason) {
        this.nativeBackend?.dispose()
        this.nativeBackend = null
        extra.webgpuReason = reason
        this._reportWebGpu(reason)
      } else extra.webgpuReason = 'cargando el backend'
      return false
    }
    if (!this.nativeBackend) {
      const backend = new this._gpuModule.WebGpuPlay(this)
      this.nativeBackend = backend
      backend.init().catch(error => {
        if (this.nativeBackend === backend) this._gpuError = error.message
      }).finally(() => { if (!this._disposed) this.requestRender() })
    }
    try {
      if (this.nativeBackend.pmrem && !this.nativeBackend.active) {
        this.lodManager?.suspendForWebGpu()
        this.worldIrradiance.dispose()
        this.wetReflections.dispose()
        this.reflectionProbe.dispose()
      }
      const started = this.perf.now()
      if (!this.nativeBackend.draw(now)) {
        const missing = this.nativeBackend.frameFallback
        extra.webgpuReason = missing || 'inicializando WebGPU'
        if (missing) this._reportWebGpu(missing)
        return false
      }
      this.perf.webGpuFrame(this.nativeBackend.renderer, started)
      extra.renderBackend = 'WebGPU'
      delete extra.webgpuReason
      this._gpuNotice = ''
      return true
    } catch (error) {
      this._gpuError = error.message
      this.nativeBackend.dispose()
      this.nativeBackend = null
      extra.webgpuReason = this._gpuError
      this._reportWebGpu(this._gpuError)
      return false
    }
  }

  _reportWebGpu(reason) {
    if (this._gpuNotice === reason || !this.onWebGpuFallback) return
    this._gpuNotice = reason
    this.onWebGpuFallback(reason)
  }

  // La luz manual mantiene sus propiedades de autoría. Solo se atenúa durante el dibujo y las capturas.
  _drawWithSolarTransmission(draw) {
    const transmission = this._manualSunTransmission ?? 1
    if (transmission >= 1) return draw()
    const sun = this.editorSun.visible ? this.editorSun : this.authoredSun?.()
    if (!sun?.visible) return draw()
    const intensity = sun.intensity
    const visible = sun.visible
    sun.intensity = intensity * transmission
    if (transmission <= 0.005) sun.visible = false
    try { return draw() }
    finally { sun.intensity = intensity; sun.visible = visible }
  }

  resize() {
    const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight)
    // setSize vacía el canvas. El ResizeObserver corre DESPUÉS de los rAF y justo antes de pintar, así que
    // si repintáramos en el siguiente frame, el navegador mostraría un frame vacío en cada paso del arrastre.
    // Por eso se repinta aquí mismo, de forma síncrona.
    if (this.renderer.domElement.width !== Math.round(w * this.renderer.getPixelRatio()) || this.renderer.domElement.height !== Math.round(h * this.renderer.getPixelRatio())) {
      this.renderer.setSize(w, h, false)
    }
    this.look.setSize(w, h)
    this._syncPsx()
    this._fitCameras(w, h)
    // ResizeObserver puede dibujar antes del siguiente frame de Play Mode.
    // La cámara activa debe usar el mismo aspecto que el framebuffer ya redimensionado.
    if (this.playing && this.camera.isPerspectiveCamera && this.camera !== this.persp) {
      this.camera.aspect = w / h
      refreshCameraFov(this.camera)
    }
    this._render()
  }

  _fitCameras(w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight)) {
    this.persp.aspect = w / h
    refreshCameraFov(this.persp)
    const hh = this._orthoH, a = w / h
    this.ortho.left = -hh * a; this.ortho.right = hh * a; this.ortho.top = hh; this.ortho.bottom = -hh
    this.ortho.updateProjectionMatrix()
  }

  _viewChanged() {
    const names = { top: 'Superior', bottom: 'Inferior', front: 'Frontal', back: 'Trasera', right: 'Derecha', left: 'Izquierda' }
    this.onViewChange?.({ name: names[this.currentView] || '', ortho: this.isOrtho })
  }

  /** Plano lejano acorde al tamaño del mundo (terrenos de varios km). */
  setFar(far) {
    this.persp.far = this.ortho.far = far
    this.persp.updateProjectionMatrix(); this.ortho.updateProjectionMatrix()
    this.sky.scale.setScalar(Math.max(1, far / 2000))
  }

  /** Snapshot exclusivamente del visor de autoría; no altera la cámara del Player. */
  saveEditorView() {
    const pose = (cam) => ({ pos: cam.position.clone(), quat: cam.quaternion.clone(), zoom: cam.zoom, fov: cam.fov,
      fovSpec: cam.userData?.lfFov ? { ...cam.userData.lfFov } : null })
    return {
      isOrtho: this.isOrtho, currentView: this.currentView, target: this.controls.target.clone(),
      persp: pose(this.persp), ortho: pose(this.ortho), orthoH: this._orthoH,
      minPolarAngle: this.controls.minPolarAngle, maxPolarAngle: this.controls.maxPolarAngle,
    }
  }

  /** Vuelve al estado exacto, incluida la cámara ortográfica y los controles enlazados. */
  restoreEditorView(s) {
    if (!s) return
    for (const [cam, saved] of [[this.persp, s.persp], [this.ortho, s.ortho]]) {
      cam.position.copy(saved.pos); cam.quaternion.copy(saved.quat); cam.zoom = saved.zoom
      if (saved.fovSpec && cam.isPerspectiveCamera) setCameraFov(cam, saved.fovSpec.value, saved.fovSpec.axis)
      else { if (saved.fov != null) cam.fov = saved.fov; cam.updateProjectionMatrix() }
    }
    this._orthoH = s.orthoH
    this._fitCameras()
    this.camera = s.isOrtho ? this.ortho : this.persp
    this.controls.object = this.camera
    this.controls.target.copy(s.target)
    this.controls.minPolarAngle = s.minPolarAngle
    this.controls.maxPolarAngle = s.maxPolarAngle
    this.currentView = s.currentView
    this.controls.update()
    for (const fn of this._camSubs) fn(this.camera)
    this._viewChanged()
    this.requestRender()
  }

  get isOrtho() { return this.camera === this.ortho }

  /** Suscripción a cambios de cámara activa (los TransformControls necesitan la nueva). Devuelve la función para cancelar. */
  onCamera(fn) { this._camSubs.add(fn); return () => this._camSubs.delete(fn) }

  /** Alterna perspectiva / ortográfica conservando encuadre (misma dirección, misma altura visible en el objetivo). */
  setOrtho(on) {
    if (on === this.isOrtho) return
    const t = this.controls.target
    const from = this.camera, to = on ? this.ortho : this.persp
    const dist = Math.max(0.5, from.position.distanceTo(t))
    if (on) {
      this._orthoH = Math.max(0.5, dist * Math.tan(THREE.MathUtils.degToRad(this.persp.fov / 2)))
      to.zoom = 1
    } else {
      // distancia perspectiva equivalente a lo que se veía en ortográfica
      const d = this._orthoH / to.zoom / Math.tan(THREE.MathUtils.degToRad(this.persp.fov / 2))
      this.persp.position.copy(t).addScaledVector(from.position.clone().sub(t).normalize(), clamp(d, 0.6, 600))
    }
    if (on) to.position.copy(from.position)
    to.quaternion.copy(from.quaternion)
    this.camera = to
    this.controls.object = to
    this._fitCameras()
    to.updateProjectionMatrix()
    this.controls.update()
    for (const fn of this._camSubs) fn(to)
    this._viewChanged()
    this.requestRender()
  }

  /** Documentos Shader Graph del proyecto. Comparte el compositor entre Editor y Player. */
  setShaderGraphDocs(shaders) {
    const prev = this._shaderSnapshot || ''
    this.shaderGraphDocs = Array.isArray(shaders) ? shaders : []
    const doc = this.look._postDoc()
    const next = doc ? doc.id + ':' + doc.code : ''
    this._shaderSnapshot = next
    if (prev !== next) this.look._dispose()
    this.requestRender()
  }

  // ---------- look (Ajustes → Render) ----------
  /** El grid de vértices usa el tamaño real de dibujo (PSX o resolución nativa), incluso al cambiar el tamaño de ventana. */
  _syncPsx() {
    const cfg = this.renderCfg || this.look.cfg
    this.psxUniforms.size.value.set(cfg.psx ? this.look.psxW : this.look._outW, cfg.psx ? this.look.psxH : this.look._outH)
    this.psxUniforms.step.value = cfg.psx ? (cfg.psxSnap || 0) : 0
    if (!this._psxTemporalActive()) this.psxUniforms.phase.value.set(0, 0)
  }

  _psxTemporalActive() {
    return this.renderCfg?.psx === true && this.renderCfg.psxContinuous === true && this.psxUniforms.step.value > 0
  }

  _advancePsxFrame() {
    if (!this._psxTemporalActive()) return
    const phase = this.psxUniforms.phase.value
    // Desplazar el origen de cuantización, no la cámara ni la geometría.
    phase.set((phase.x + 0.61803398875) % 1, (phase.y + 0.41421356237) % 1)
  }

  _envIntensity() { return !this.renderCfg || this.renderCfg.look === 'clasico' ? 1 : this.renderCfg.reflections }

  /** Ajustes de render en vivo (perfiles): igual que setRender pero sin reconstruir los pases cuando no hace falta. */
  setRenderLive(cfg) {
    this.renderCfg = cfg
    this.performanceController.configure(cfg)
    this.look.live(cfg)
    this._syncPsx()
    this.scene.environmentIntensity = this._envIntensity()
    this.requestRender()
  }

  /** Aplica la configuración de render normalizada (ver render/look.js): tone mapping, efectos y modo de iluminación del cielo. */
  setRender(cfg) {
    const changed = setIblDiffuse(cfg.look !== 'clasico')
    this.renderCfg = cfg
    this.performanceController.configure(cfg)
    this.look.configure(cfg)
    this._syncPsx()
    this.scene.environmentIntensity = this._envIntensity()
    if (changed) this.recompileMaterials()
    this.requestRender()
  }

  /** El contexto WebGL volvió tras perderse: entorno (PMREM), pases de post-proceso y materiales se recrean. */
  _glRestored() {
    this.skyVariants.reset()
    this._glLost = false
    try {
      this.reflectionProbe.dispose()
      this.worldIrradiance.dispose()
      this.worldRayScene.dispose()
      this.wetReflections.dispose()
      this._envRT = null; this.pmrem.dispose(); this.pmrem = new THREE.PMREMGenerator(this.renderer)
      if (this._rawEnv) { this._envSig = null; this._applyEnv() }
      this.look._dispose()
      this.recompileMaterials()
    } catch (err) { console.warn('[viewport] no se pudo reconstruir tras la pérdida de contexto', err) }
    this.requestRender()
  }

  recompileMaterials() {
    this.scene.traverse((o) => { const m = o.material; if (m) for (const x of Array.isArray(m) ? m : [m]) x.needsUpdate = true })
  }

  // ---------- entorno ----------
  /** Sol del escenario (dirección hacia él, color y energía) para el cielo físico, las nubes y la luz volumétrica; lo calcula el editor. */
  setSun(sun) { this._sun = sun; if (this._env) this._applySky() }
  /** Panorama HDRI/LDR ya cargado (THREE.Texture) o null. */
  setSkyTexture(tex, flip = false) { this._pano = tex; this.skyMat.uniforms.uPano.value = tex; this.skyMat.uniforms.uPanoFlip.value = flip ? 1 : 0; if (this._env) this._applySky() }

  setLightPreview(on) {
    this.editorSun.visible = !on
    this.requestRender()
  }

  setGrid(cell, extent = 64) {
    if (!this.grid) {
      this.grid = createInfiniteGrid(cell)
      this.scene.add(this.grid)
    } else this.grid.setCellSize(cell)
    this.requestRender()
  }

  // ---------- navegación ----------
  wantsNav(e) { return e.button === 0 && (e.altKey || this._space) }

  /** 'mouse': rueda = zoom. 'trackpad': dos dedos = orbitar, pellizco = zoom, Shift + dos dedos = desplazar. */
  setNavigation(mode) {
    this.nav = mode
    this.controls.enableZoom = mode === 'mouse'
  }

  /** Sensibilidades y velocidades (Preferencias). */
  applyPrefs(p) {
    // La preferencia usa grados horizontales; no cambia las cámaras de escena.
    setCameraFov(this.persp, p.editorFov ?? 90)
    const c = this.controls
    c.rotateSpeed = p.mouseOrbit ?? 1
    c.panSpeed = p.mousePan ?? 1
    c.zoomSpeed = (p.mouseZoom ?? 1) * (p.mouseInvertZoom ? -1 : 1)
    // Sentido por defecto = «arrastrar la escena» con los dedos (igual que arrastrar con el ratón). `padInvert` lo invierte todo; `padInvertY` solo el eje vertical.
    const sx = p.padInvert ? 1 : -1
    this._pad = { orbit: p.padOrbit ?? 1, pan: p.padPan ?? 1, zoom: p.padZoom ?? 1, sx, sy: sx * (p.padInvertY ? -1 : 1), zoomCursor: p.padZoomCursor !== false }
    this._flyLook = p.flyLook ?? 1
    this._flySprint = p.flySprint ?? 3
    if (p.flySpeed !== this._flySpeedPref) { this._flySpeedPref = p.flySpeed; this._flySpeed = p.flySpeed ?? 14 }
  }

  get isFlying() { return this._flying }

  dispose() {
    this._disposed = true
    this.skyVariants.dispose()
    this.performanceController.dispose()
    this.nativeBackend?.dispose()
    this.nativeBackend = null
    cancelAnimationFrame(this._raf)
    clearTimeout(this._bakeT)
    this.precip?.dispose(); this.bolt?.dispose()
    this.nature?.dispose()
    this.wetReflections.dispose()
    this.reflectionProbe.dispose()
    this.worldIrradiance.dispose()
    this.worldRayScene.dispose()
    this.viewDiagnostics.dispose()
    this.look.dispose()
    this.occlusion.dispose()
    this._ro.disconnect()
    this._stopContinuousNavigation(true)
    this._continuousNavigationCleanup?.()
    this._flyCleanup?.()
    this.controls.dispose()
    this._cmapTex?.dispose(); this.skyMat.uniforms.uCVolume.value?.dispose()
    this._envRT?.dispose()
    this.pmrem?.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.dom.remove()
  }
}
Object.assign(Viewport.prototype, navMethods) // navMethods: ./viewport-nav.js
Object.assign(Viewport.prototype, envMethods) // envMethods: ./viewport-env.js
