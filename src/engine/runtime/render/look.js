// «Look» de la escena: tone mapping, oclusión ambiental, bloom, gradación de color, viñeta y grano de película.
// Se configura en Ajustes → Render (project.render) con tres perfiles de calidad:
//   alto  → AO (GTAO) + bloom + gradación + grano + MSAA        medio → bloom + gradación + grano + MSAA        bajo → solo tone mapping
// Jugando (y si el proyecto lo pide) la escena se dibuja a una fracción de la resolución y se reconstruye con TAA (ver upscale.js):
//   «dividido» = composerA (interno: escena, niebla, AO) → TemporalUpscaler → composerB (completo: view model, bloom, tonos, color, nitidez).
// El look «clásico» no toca nada (sin tone mapping ni efectos): es lo que había antes.
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { VolumetricPass } from './volumetric.js'
import { AtmosphericFogPass } from './atmofog.js'
import { AutoExposurePass } from './autoexposure.js'
import { DofPass } from './dof.js'
import { ScreenBouncePass } from './screen-bounce.js'
import { environmentLook } from './environment-look.js'
import { normalizeVolumetric } from './lightlib.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { SSRPass } from 'three/examples/jsm/postprocessing/SSRPass.js'
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js'
import { TexturePass } from 'three/examples/jsm/postprocessing/TexturePass.js'
import { compileGraph } from '../../../core/shadergraph/compile.js'
import { TemporalUpscaler, SharpenShader, DynRes, jitterOf } from './upscale.js'

import { RENDER_DEFAULTS, CLASSIC_RENDER, normalizeRender, presetOf, RENDER_PRESETS, GRADE_WHEELS, wheelRGB } from './config.js'
export { RENDER_DEFAULTS, CLASSIC_RENDER, normalizeRender, presetOf, RENDER_PRESETS }

const STAR_CORE = 0.72, STAR_CORE_TAA = 1.25   // radio del núcleo de las estrellas en píxeles (sin y con TAA)

const TONEMAP = { aces: THREE.ACESFilmicToneMapping, agx: THREE.AgXToneMapping, neutral: THREE.NeutralToneMapping, lineal: THREE.LinearToneMapping }

import { GradeShader, ViewModelPass, CaptureDepthPass } from './look-passes.js'
export class LookPipeline {
  constructor(vp) {
    this.vp = vp
    this.cfg = { ...CLASSIC_RENDER }
    this.fx = true       // «Efectos» del menú Ver: apagado = solo tone mapping
    this.composer = null // composer principal: el único (modo normal) o el de resolución completa (modo dividido)
    this.composerA = null // modo dividido: resolución interna
    this.psxTarget = null   // buffer lineal a baja resolución cuando no hay compositor
    this.psxOutput = null
    this.psxCopy = null
    this.upscaler = null
    this.builtKey = ''
    this.editorSelection = [] // referencias de selección del Editor; nunca se serializan ni llegan al Player
    this.editorOutlineOn = false
    this.editorOutlineCfg = { color: '#ffb547', width: 1.5, strength: 3 }
    this.w = 1; this.h = 1
    this.scale = 1       // fracción de resolución con la que se dibuja la escena (modo dividido)
    this.dyn = new DynRes()
    this.frameNo = 0
    this._pp = new THREE.Vector3(); this._pf = new THREE.Vector3(0, 0, -1); this._pHave = false
  }

  get profile() { return !this.fx ? 'bajo' : this.cfg.profile }
  /** ¿Se usan pases de post-proceso sin reconstrucción? (clásico y perfil bajo: no) */
  get active() { return (this.cfg.look !== 'clasico' && this.profile !== 'bajo') || !!this._postDoc() }
  _postDoc() {
    if (!this.cfg?.postShader) return null
    return (this.vp.shaderGraphDocs || []).find((s) => s.id === this.cfg.postShader && s.graph?.target === 'post') || null
  }

  get outlineEnabled() { return this.editorOutlineOn && !this.vp.playing && !this.vp.drawEditorPreview && this.editorSelection.length > 0 }
  /** Modo dividido: solo jugando y con resolución interna < 1. (El TAA y la resolución dinámica que también lo activaban se retiraron en 0.26.9; su código sigue aquí, obsoleto y sin uso.) */
  get split() { const c = this.cfg; return !c.psx && !!this.vp.playing && c.resScale < 0.999 }
  get spatialFilter() { return this.cfg.spatialReconstruction }
  get usesSpatialShader() { return this.cfg.taa || this.spatialFilter === 'catmull' || this.spatialFilter === 'edge-guard' }
  get adaptsToWorld() { return this.fx && this.cfg.look !== 'clasico' && this.cfg.environmentLook === true }
  get usesComposer() { return this.active || this.split || this.outlineEnabled || this.adaptsToWorld }
  // El tamaño interno PSX mantiene la relación de aspecto del canvas sin cambiar su tamaño visible.
  get psxH() { return this.cfg.psxHeight ? Math.min(this._outH, this.cfg.psxHeight) : this._outH }
  get psxW() { return Math.max(1, Math.round(this._outW * this.psxH / this._outH)) }

  configure(cfg) {
    this.cfg = cfg
    this.dyn.setLimits({ target: cfg.targetFps, min: Math.min(cfg.minScale, cfg.resScale), max: cfg.resScale })
    this.scale = cfg.dynRes ? Math.min(cfg.resScale, Math.max(Math.min(cfg.minScale, cfg.resScale), this.scale)) : cfg.resScale
    this.dyn.scale = this.scale; this.dyn.reset()
    this._applyRenderer()
    this._dispose()
    this.vp.requestRender()
  }

  /**
   * Cambia los ajustes SIN reconstruir los pases si la estructura es la misma (perfiles de post-proceso, mezclas en vivo).
   * Si aparece o desaparece un efecto (bloom, AO) o cambia el modo, hace una configuración completa.
   */
  live(cfg) {
    const a = this.cfg
    if (!a || (a.ssr && a.ssrStrength > 0) !== (cfg.ssr && cfg.ssrStrength > 0) || (a.ssr && cfg.ssr && a.ssrQuality !== cfg.ssrQuality) || (a.screenBounce > 0) !== (cfg.screenBounce > 0) || a.worldRayBounce !== cfg.worldRayBounce || (a.worldRayReflection > 0) !== (cfg.worldRayReflection > 0) || (a.bloom > 0) !== (cfg.bloom > 0) || (a.autoExposure > 0) !== (cfg.autoExposure > 0) || (a.dofBlur > 0) !== (cfg.dofBlur > 0) || (a.ao > 0) !== (cfg.ao > 0) || a.look !== cfg.look || a.environmentLook !== cfg.environmentLook || a.profile !== cfg.profile || a.taa !== cfg.taa || a.resScale !== cfg.resScale || a.spatialReconstruction !== cfg.spatialReconstruction || a.dynRes !== cfg.dynRes || a.psx !== cfg.psx || a.psxHeight !== cfg.psxHeight || a.postShader !== cfg.postShader) return this.configure(cfg)
    this.cfg = cfg
    this._applyRenderer(); this._updateUniforms()
    this.vp.requestRender()
  }

  setFx(on) { if (this.fx === !!on) return; this.fx = !!on; this._applyRenderer(); this._dispose(); this.vp.requestRender() }

  /** La selección es propiedad del Editor; aquí solo se presenta cuando hace falta. */
  setEditorOutline(nodes, enabled, prefs = {}) {
    const before = this.outlineEnabled
    this.editorSelection.splice(0, this.editorSelection.length, ...nodes)
    this.editorOutlineOn = !!enabled
    this.editorOutlineCfg.color = /^#[0-9a-fA-F]{6}$/.test(prefs.selectionOutlineColor) ? prefs.selectionOutlineColor : '#ffb547'
    this.editorOutlineCfg.width = THREE.MathUtils.clamp(Number(prefs.selectionOutlineWidth) || 1.5, 0.5, 4)
    this.editorOutlineCfg.strength = THREE.MathUtils.clamp(Number(prefs.selectionOutlineStrength) || 3, 0.5, 6)
    if (before !== this.outlineEnabled && !this.outlinePass && !this.active && !this.adaptsToWorld) this._dispose()
    if (this.outlinePass) this._syncOutline()
    this.vp.requestRender()
  }

  _syncOutline() {
    const p = this.outlinePass
    if (!p) return
    p.enabled = this.outlineEnabled
    p.renderCamera = this.vp.camera
    p.visibleEdgeColor.set(this.editorOutlineCfg.color)
    p.hiddenEdgeColor.set(this.editorOutlineCfg.color).multiplyScalar(0.35)
    p.edgeThickness = this.editorOutlineCfg.width
    p.edgeStrength = this.editorOutlineCfg.strength
  }

  _addOutline(composer, w, h) {
    if (this.vp.playing || !this.editorOutlineOn) return
    const pass = new OutlinePass(new THREE.Vector2(w, h), this.vp.scene, this.vp.camera, this.editorSelection)
    composer.addPass(pass)
    this.outlinePass = pass
    this._syncOutline()
  }

  _applyRenderer() {
    const r = this.vp.renderer, c = this.cfg
    r.toneMapping = c.look === 'clasico' ? THREE.NoToneMapping : TONEMAP[c.tonemap]
    this._applyExposure()
  }

  _applyExposure() {
    const base = this.cfg.look === 'clasico' ? 1 : this.cfg.exposure
    const response = environmentLook(this.adaptsToWorld ? this.vp._wf : null)
    this.worldTemperature = response.temperature
    this.vp.renderer.toneMappingExposure = base * response.exposure
  }

  get _pr() { return this.vp.renderer.getPixelRatio() }
  get _outW() { return Math.max(1, Math.round(this.w * this._pr)) }
  get _outH() { return Math.max(1, Math.round(this.h * this._pr)) }

  get scenePixelHeight() { return this.cfg.psx ? this.psxH : this.split ? Math.max(1, Math.round(this.h * this._pr * this.scale)) : this._outH }

  _sizeInternal(composer) {
    composer.setSize(Math.max(1, Math.round(this.w * this._pr * this.scale)), this.scenePixelHeight)
  }

  setSize(w, h) {
    this.w = w; this.h = h
    if (this.composerA) this._sizeInternal(this.composerA)
    if (this.composer) {
      if (this.cfg.psx) this.composer.setPixelRatio(this.psxH / h)
      this.composer.setSize(w, h)
    }
    this.psxTarget?.setSize(this.psxW, this.psxH)
    this.upscaler?.setSize(this._outW, this._outH)
    this._resizeSSR()
    this._uRes()
  }
  _uRes() { if (this.grade) this.grade.uniforms.uRes.value.set(this.cfg.psx ? this.psxW : this._outW, this.cfg.psx ? this.psxH : this._outH); if (this.sharpen) this.sharpen.uniforms.uTexel.value.set(1 / this._outW, 1 / this._outH) }

  /** Resolución dinámica: cambia la fracción interna (sin tocar la historia, que es de resolución completa). */
  setScale(s) {
    if (Math.abs(s - this.scale) < 1e-6) return
    this.scale = s
    if (this.composerA) { this._sizeInternal(this.composerA); this._resizeSSR() }
    this.vp.requestRender()
  }
  /** Una vez por fotograma dibujado, jugando: ajusta la resolución a los FPS objetivo. */
  tick(dtMs) {
    if (!this.split || !this.cfg.dynRes) return
    const ns = this.dyn.sample(dtMs)
    if (ns != null) this.setScale(ns)
  }
  /** Enfoque automático: distancia (m) a lo que hay en el centro de la pantalla; la pone el modo Jugar. */
  setFocusTarget(d) { this.focusTarget = Number.isFinite(d) && d > 0 ? d : null }

  /** LUT de color: `img` = imagen cargada de Assets (o null para quitarla). Detecta tira (ancho N², alto N) o Hald (cuadrada, lado L³). */
  setLut(img) {
    this.lut?.tex.dispose(); this.lut = null
    if (img) {
      const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height
      let mode = 0, n = 0
      if (w === h * h && h >= 2 && h <= 64) { mode = 1; n = h }
      else if (w === h) { const L = Math.round(Math.cbrt(w)); if (L >= 2 && L * L * L === w) { mode = 2; n = L * L } }
      if (!mode) this.lutError = `LUT no válida (${w}×${h}): usa una tira de N²×N (256×16, 1024×32…) o una Hald cuadrada (64×64, 512×512…).`
      else {
        const tex = new THREE.Texture(img)
        tex.colorSpace = THREE.NoColorSpace; tex.flipY = false; tex.generateMipmaps = false; tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.needsUpdate = true
        this.lut = { tex, mode, n, w, h }; this.lutError = ''
      }
    } else this.lutError = ''
    this.vp.requestRender()
  }

  /** Corte de cámara, cambio de escena…: la historia temporal deja de valer. */
  resetTemporal() {
    this.upscaler?.reset()
    this.aePass?.reset()
    this.vp.nativeBackend?.post?.autoExposure?.reset()
  }

  _dispose() {
    this.vp.perf?.forgetAO(this.aoPass)
    for (const c of [this.composer, this.composerA]) {
      if (!c) continue
      for (const p of c.passes) p.dispose?.()
      c.dispose()
    }
    this.upscaler?.dispose()
    this.psxTarget?.dispose(); this.psxTarget = null
    this.psxOutput?.dispose(); this.psxOutput = null
    this.psxCopy?.dispose(); this.psxCopy = null
    this.composer = null; this.composerA = null; this.upscaler = null
    this.outlinePass = null; this.ssrPass = null; this.bouncePass = null; this.volPass = null; this.atmoPass = null; this.vmPass = null; this.grade = null; this.customPass = null; this.bloomPass = null; this.aoPass = null; this.sharpen = null; this.texPass = null; this.aePass = null; this.dofPass = null; this.depthTex = null
    this.builtKey = ''
  }

  // Lensflare r170 copia píxeles del framebuffer para su oclusión. WebGL no permite
  // copiar directamente de un framebuffer multisample con glCopyTexSubImage2D.
  _hasVisibleLensflare() {
    let visible = false
    this.vp.scene.traverseVisible((obj) => { if (obj.isLensflare) visible = true })
    return visible
  }

  _key() { return `${this.split ? 'dividido' : 'normal'}|${this.profile}|${this.cfg.psx ? this.cfg.psxHeight : 'off'}|outline:${this.vp.playing || !this.editorOutlineOn ? 'off' : (this.vp.camera.isOrthographicCamera ? 'orto' : 'persp')}|flare:${this._hasVisibleLensflare() ? 'on' : 'off'}|shader:${this.cfg.postShader || ''}|revision:${this._postDoc()?.code?.length || 0}` }

  _names(map) {
    for (const [c, list] of map) for (const p of c.passes) {
      this.vp.perf.wrapPass(p, list.get(p) || (p instanceof OutputPass ? 'Tone mapping' : p instanceof TexturePass ? 'Copia' : p.constructor.name))
      if (p === this.aoPass) this._installAoCompositeExperiment(p)
      if (p === this.aoPass) this.vp.perf.wrapAO(p)
      if (p === this.renderPass) { this.vp.perf.wrapScene(p); this.vp.occlusion.wrapRenderPass(p) }
    }
  }

  _build() {
    this.builtKey = this._key()
    if (this.split) this._buildSplit(); else this._buildSingle()
    this._updateUniforms()
    this.setSize(this.w, this.h)
  }

  _addGrade(composer) {
    if (this.profile === 'bajo' && !this.adaptsToWorld) return
    this.grade = new ShaderPass(GradeShader)
    composer.addPass(this.grade)
  }

  _addPost(composer, high, fullW, fullH) {
    const c = this.cfg
    if (c.bloom > 0 && this.profile !== 'bajo') {
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(Math.round(fullW * (high ? 0.75 : 0.5)), Math.round(fullH * (high ? 0.75 : 0.5))), c.bloom, c.bloomRadius, c.bloomThreshold)
      composer.addPass(this.bloomPass)
    }
    if (c.autoExposure > 0 && this.profile !== 'bajo') { this.aePass = new AutoExposurePass(); composer.addPass(this.aePass) }
    composer.addPass(new OutputPass())
    this._addGrade(composer)
    this._addGraphPass(composer)
  }

  /** Un único ShaderPass opcional. La selección del grafo recompila; uniforms no lo hacen. */
  _addGraphPass(composer) {
    const doc = this._postDoc()
    if (!doc) return
    const result = compileGraph(doc.graph, doc.name)
    if (result.errors.length) { console.warn('Shader Graph postprocesado inválido:', result.errors); return }
    const uniforms = { tDiffuse: { value: null }, uTime: { value: 0 }, uIntensity: { value: 1 } }
    for (const p of result.graph.props) {
      if (p.type === 'texture') continue
      const value = p.type === 'color' ? new THREE.Color(p.def) : p.type === 'vec3' ? new THREE.Vector3(...p.def) : p.def
      uniforms['u' + p.name] = { value }
    }
    this.customPass = new ShaderPass({ name: doc.name, uniforms,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: result.code })
    this.customGraph = result.graph
    composer.addPass(this.customPass)
  }

  // SSRPass de Three.js r170 no soporta resolutionScale: se dimensionan sus targets internos.
  _resizeSSR() {
    if (!this.ssrPass) return
    const quality = { baja: 0.5, media: 0.75, alta: 1 }[this.cfg.ssrQuality] || 0.75
    const internal = this.composerA ? this.scale : 1
    const pixelRatio = this.cfg.psx ? this.psxH / this.h : this._pr
    this.ssrPass.setSize(Math.max(1, Math.round(this.w * pixelRatio * internal * quality)), Math.max(1, Math.round(this.h * pixelRatio * internal * quality)))
  }

  _addSSR(composer) {
    const c = this.cfg
    if (!c.ssr || c.ssrStrength <= 0 || c.look !== 'realista' || this.profile === 'bajo') return
    // En r170 SSRPass vuelve a renderizar la escena y NO lee el buffer previo.
    // Por ello se agrega ANTES de la niebla/AO/bloom y no borra esos efectos.
    this.ssrPass = new SSRPass({ renderer: this.vp.renderer, scene: this.vp.scene, camera: this.vp.camera, width: 1, height: 1, selects: [] })
    this.ssrPass.blur = true
    this.ssrPass.bouncing = false
    composer.addPass(this.ssrPass)
  }

  _addScreenBounce(composer) {
    const { screenBounce, worldRayReflection, look } = this.cfg
    if (!(screenBounce > 0 || worldRayReflection > 0) || look !== 'realista' || this.profile === 'bajo') return
    if (!this.vp.renderer.extensions.has('EXT_color_buffer_float')) return
    this.bouncePass = new ScreenBouncePass(this)
    composer.addPass(this.bouncePass)
  }

  _syncSSR() {
    if (!this.ssrPass) return
    const pass = this.ssrPass, cam = this.vp.camera
    const traced = this.bouncePass && this.cfg.worldRayReflection > 0 ? this.vp.worldRayScene?.active?.meshes : null
    pass.camera = cam
    // El addon r170 refleja toda la escena sin `selects`, incluso materiales no PBR.
    // Usar la misma lista en cada fotograma evita recompilar el programa SELECTIVE.
    const selected = pass.selects
    selected.length = 0
    this.vp.scene.traverseVisible((obj) => {
      if (!obj.isMesh) return
      if (traced?.has(obj._lfClusterSource ?? obj) && obj.material.roughness < 0.85) return
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
      if (materials.some((m) => (m?.isMeshStandardMaterial || m?.isMeshPhysicalMaterial) && (m.roughness < 0.85 || m.metalness > 0.03))) selected.push(obj)
    })
    pass.enabled = !traced || selected.length > 0
    pass.opacity = this.cfg.ssrStrength
    pass.maxDistance = this.cfg.ssrDistance
    pass.ssrMaterial.uniforms.cameraNear.value = cam.near
    pass.ssrMaterial.uniforms.cameraFar.value = cam.far
    pass.ssrMaterial.uniforms.cameraProjectionMatrix.value.copy(cam.projectionMatrix)
    pass.ssrMaterial.uniforms.cameraInverseProjectionMatrix.value.copy(cam.projectionMatrixInverse)
    pass.depthRenderMaterial.uniforms.cameraNear.value = cam.near
    pass.depthRenderMaterial.uniforms.cameraFar.value = cam.far
  }

  /** GTAO no debe tratar las partículas transparentes instanciadas como sólidos. */
  _excludeVfxFromAO(pass) {
    // Three.js r186 expone estos métodos con prefijo "_"; la caché restaura los visibles.
    if (typeof pass._overrideVisibility !== 'function' || !Array.isArray(pass._visibilityCache)) {
      console.warn('Century: GTAO sin API de visibilidad compatible; revisar integración VFX.')
      return
    }
    const original = pass._overrideVisibility.bind(pass)
    pass._overrideVisibility = () => {
      original()
      this.vp.scene.traverse((object) => {
        if (!object.userData?.lfExcludeFromAO || !object.visible) return
        object.visible = false
        pass._visibilityCache.push(object)
      })
    }
  }

  /** Diagnóstico S17: fusiona copia + multiplicación AO en un dibujo, sin tocar GTAO ni el preset.
   * Se habilita exclusivamente desde Stats. La ruta oficial permanece predeterminada. */
  _installAoCompositeExperiment(pass) {
    if (!pass || pass._lfAoCompositeWrapped) return
    pass._lfAoCompositeWrapped = true
    // No reserva material ni compila programa si el experimento no se usa.
    const getMaterial = () => {
      if (pass._lfAoFusedMaterial) return pass._lfAoFusedMaterial
      const material = new THREE.ShaderMaterial({
        uniforms: { tScene: { value: null }, tAO: { value: null }, intensity: { value: 1 } },
        vertexShader: `varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `varying vec2 vUv;
          uniform sampler2D tScene;
          uniform sampler2D tAO;
          uniform float intensity;
          void main() {
            vec4 sceneColor = texture2D(tScene, vUv);
            vec4 occlusion = texture2D(tAO, vUv);
            vec3 light = mix(vec3(1.0), occlusion.rgb, intensity);
            gl_FragColor = vec4(sceneColor.rgb * light, sceneColor.a * occlusion.a);
          }`,
        blending: THREE.NoBlending, depthTest: false, depthWrite: false, toneMapped: false,
      })
      pass._lfAoFusedMaterial = material
      return material
    }
    const originalRender = pass.render.bind(pass)
    // Solo el OUTPUT.Default y los buffers separados permiten sustituir la composición.
    // Conserva _renderPass de Three.js para estado de renderTarget y framebuffer.
    pass.render = (renderer, writeBuffer, readBuffer, ...args) => {
      const fusion = this.vp.perf?.enabled && this.vp.perf.aoCompositeMode === 'fused' &&
        pass.output === GTAOPass.OUTPUT.Default && !!readBuffer?.texture &&
        (pass.renderToScreen || (!!writeBuffer && writeBuffer !== readBuffer))
      if (!fusion) return originalRender(renderer, writeBuffer, readBuffer, ...args)
      const material = getMaterial()
      const draw = pass._renderPass
      pass._renderPass = (r, m, target, ...rest) => {
        if (m === pass.copyMaterial) return // La imagen se leerá directamente en la fusión.
        if (m === pass.blendMaterial) {
          material.uniforms.tScene.value = readBuffer.texture
          material.uniforms.tAO.value = pass.pdRenderTarget.texture
          material.uniforms.intensity.value = pass.blendIntensity
          return draw.call(pass, r, material, target, ...rest)
        }
        return draw.call(pass, r, m, target, ...rest)
      }
      try { return originalRender(renderer, writeBuffer, readBuffer, ...args) }
      finally { pass._renderPass = draw }
    }
    const originalDispose = pass.dispose.bind(pass)
    pass.dispose = (...args) => { pass._lfAoFusedMaterial?.dispose(); return originalDispose(...args) }
  }

  _buildSingle() {
    const vp = this.vp, r = vp.renderer, c = this.cfg, high = this.profile === 'alto'
    const pr = c.psx ? this.psxH / this.h : r.getPixelRatio(), W = Math.max(1, Math.round(this.w * pr)), H = Math.max(1, Math.round(this.h * pr))
    const filter = c.psx ? THREE.NearestFilter : THREE.LinearFilter
    const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: c.psx || this._hasVisibleLensflare() ? 0 : 4, minFilter: filter, magFilter: filter })
    rt.depthTexture = new THREE.DepthTexture(W, H) // la niebla volumétrica lee la profundidad de la escena
    const composer = new EffectComposer(r, rt)
    composer.setPixelRatio(pr)
    composer.setSize(this.w, this.h)
    this.renderPass = new RenderPass(vp.scene, vp.camera)
    composer.addPass(this.renderPass)
    // Clásico/Bajo no tenían postproceso. Solo con selección Outline montamos
    // el mínimo (escena + conversión de salida + contorno), sin activar AO/LUT/DOF.
    if (!this.active) {
      if (this.adaptsToWorld) composer.addPass(new ViewModelPass(this))
      composer.addPass(new OutputPass())
      if (this.adaptsToWorld) this._addGrade(composer)
      this._addOutline(composer, W, H)
      this.composer = composer
      this._names(new Map([[composer, new Map([[this.renderPass, 'Escena'], [this.outlinePass, 'Selección Outline']])]]))
      return
    }
    composer.addPass(new CaptureDepthPass(this)) // la profundidad de la escena la leen la niebla (más abajo) y el desenfoque de campo
    this._addSSR(composer)
    this._addScreenBounce(composer)
    this.volPass = new VolumetricPass(this)
    composer.addPass(this.volPass)
    this.atmoPass = new AtmosphericFogPass(this) // niebla física (altura, humedad, sol, haces): solo trabaja si la escena la pide
    composer.addPass(this.atmoPass)
    if (c.dofBlur > 0 && this.profile !== 'bajo') { this.dofPass = new DofPass(this); composer.addPass(this.dofPass) }
    this.vmPass = new ViewModelPass(this) // después de la niebla volumétrica (que lee la profundidad de la escena) y antes de AO/bloom/color
    composer.addPass(this.vmPass)
    if (high && c.ao > 0) {
      this.aoPass = new GTAOPass(vp.scene, vp.camera, this.w, this.h)
      this._excludeVfxFromAO(this.aoPass)
      this.aoPass.output = GTAOPass.OUTPUT.Default
      composer.addPass(this.aoPass)
    }
    this._addPost(composer, high, this.w, this.h)
    this._addOutline(composer, W, H)
    this.composer = composer
    this._names(new Map([[composer, new Map([[this.renderPass, 'Escena'], [this.ssrPass, 'Reflejos SSR'], [this.bouncePass, 'Rebote de luz'], [this.outlinePass, 'Selección Outline'], [this.volPass, 'Niebla volumétrica'], [this.atmoPass, 'Niebla atmosférica'], [this.dofPass, 'Profundidad de campo'], [this.vmPass, 'View model'], [this.aoPass, 'AO'], [this.aePass, 'Exposición automática'], [this.bloomPass, 'Bloom'], [this.grade, 'Color y grano'], [this.customPass, 'Shader Graph']])]]))
  }

  _buildSplit() {
    const vp = this.vp, r = vp.renderer, c = this.cfg, high = this.profile === 'alto'
    const pr = this._pr, s = this.scale, W = this._outW, H = this._outH
    const iw = Math.max(1, Math.round(W * s)), ih = Math.max(1, Math.round(H * s))
    // A: escena, niebla y AO a resolución interna (sin MSAA si hay TAA: el propio TAA suaviza los bordes)
    const modern = c.look !== 'clasico'
    const filter = this.spatialFilter === 'nearest' ? THREE.NearestFilter : THREE.LinearFilter
    const type = r.extensions.has('EXT_color_buffer_float') ? THREE.HalfFloatType : THREE.UnsignedByteType
    const rtA = new THREE.WebGLRenderTarget(iw, ih, { type, samples: filter === THREE.NearestFilter || c.taa || this._hasVisibleLensflare() ? 0 : 4, minFilter: filter, magFilter: filter })
    if (modern) rtA.depthTexture = new THREE.DepthTexture(iw, ih)
    const A = new EffectComposer(r, rtA)
    A.renderToScreen = false
    A.setPixelRatio(1)
    this._sizeInternal(A)
    this.renderPass = new RenderPass(vp.scene, vp.camera)
    A.addPass(this.renderPass)
    if (modern) {
      A.addPass(new CaptureDepthPass(this))
      this._addSSR(A)
      this._addScreenBounce(A)
      this.volPass = new VolumetricPass(this)
      A.addPass(this.volPass)
      this.atmoPass = new AtmosphericFogPass(this)
      A.addPass(this.atmoPass)
      if (high && c.ao > 0) {
        this.aoPass = new GTAOPass(vp.scene, vp.camera, iw, ih)
        this._excludeVfxFromAO(this.aoPass)
        this.aoPass.output = GTAOPass.OUTPUT.Default
        A.addPass(this.aoPass)
      }
    }
    // B: resolución completa. Parte de la imagen reconstruida; encima va el view model, después bloom, tonos, color y nitidez
    const rtB = new THREE.WebGLRenderTarget(W, H, { type, samples: modern ? 4 : 0 })
    const B = new EffectComposer(r, rtB)
    B.setPixelRatio(pr)
    B.setSize(this.w, this.h)
    this.texPass = new TexturePass(null)
    B.addPass(this.texPass)
    if (modern && c.dofBlur > 0 && this.profile !== 'bajo') { this.dofPass = new DofPass(this); B.addPass(this.dofPass) } // la profundidad viene del render interno (A)
    this.vmPass = new ViewModelPass(this)
    B.addPass(this.vmPass)
    if (modern) {
      this._addPost(B, high, this.w, this.h)
      this.sharpen = new ShaderPass(SharpenShader)
      B.addPass(this.sharpen)
    } else {
      B.addPass(new OutputPass())
      this._addGraphPass(B)
    }
    this._addOutline(B, W, H)
    if (this.usesSpatialShader && r.extensions.has('EXT_color_buffer_float')) this.upscaler = new TemporalUpscaler()
    this.composerA = A; this.composer = B
    this._names(new Map([[A, new Map([[this.renderPass, 'Escena'], [this.ssrPass, 'Reflejos SSR'], [this.bouncePass, 'Rebote de luz'], [this.outlinePass, 'Selección Outline'], [this.volPass, 'Niebla volumétrica'], [this.atmoPass, 'Niebla atmosférica'], [this.aoPass, 'AO']])], [B, new Map([[this.dofPass, 'Profundidad de campo'], [this.vmPass, 'View model'], [this.aePass, 'Exposición automática'], [this.bloomPass, 'Bloom'], [this.grade, 'Color y grano'], [this.sharpen, 'Nitidez'], [this.customPass, 'Shader Graph']])]]))
  }

  _updateUniforms() {
    const c = this.cfg
    if (this.ssrPass) { this.ssrPass.opacity = c.ssrStrength; this.ssrPass.maxDistance = c.ssrDistance }
    if (this.aoPass) {
      this.aoPass.blendIntensity = Math.min(1, c.ao)
      this.aoPass.updateGtaoMaterial({ radius: c.aoRadius, distanceExponent: 1, thickness: 1, scale: Math.max(0.5, c.ao), samples: 16, distanceFallOff: 1, screenSpaceRadius: false })
      this.aoPass.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, radiusExponent: 1, rings: 2, samples: 16 })
    }
    if (this.aePass) this.aePass.setParams({ key: c.aeKey, speedUp: c.aeSpeedUp, speedDown: c.aeSpeedDown, minEv: c.aeMin, maxEv: c.aeMax, amount: c.autoExposure })
    if (this.bloomPass) { this.bloomPass.strength = c.bloom; this.bloomPass.radius = c.bloomRadius; this.bloomPass.threshold = c.bloomThreshold }
    if (this.sharpen) { this.sharpen.uniforms.uStrength.value = c.sharpen; this.sharpen.enabled = c.sharpen > 0.001 }
    if (this.customPass) {
      this.customPass.uniforms.uIntensity.value = Math.max(0, Math.min(1, Number(c.postMix) || 0))
      const params = c.postParams || {}
      for (const p of this.customGraph.props) {
        const uniform = this.customPass.uniforms['u' + p.name]
        if (!uniform) continue
        const v = params[p.name] ?? p.def
        if (p.type === 'color') uniform.value.set(/^#[0-9a-f]{6}$/i.test(v) ? v : p.def)
        else if (p.type === 'vec3') { if (Array.isArray(v) && v.length === 3) uniform.value.set(...v.map(Number)) }
        else if (p.type === 'float') uniform.value = Number.isFinite(Number(v)) ? Number(v) : p.def
        else if (p.type === 'bool') uniform.value = !!v
      }
    }
    if (this.grade) {
      const u = this.grade.uniforms
      u.uVignette.value = c.vignette; u.uGrain.value = c.grain; u.uSat.value = c.saturation; u.uContrast.value = c.contrast
      u.uTint.value = c.tintStrength; u.uChroma.value = c.chromatic
      const s = new THREE.Color(c.shadowTint).convertLinearToSRGB(), h = new THREE.Color(c.highlightTint).convertLinearToSRGB()
      u.uShadow.value.set(s.r, s.g, s.b); u.uHigh.value.set(h.r, h.g, h.b)
      for (const w of GRADE_WHEELS) u['u' + w[0].toUpperCase() + w.slice(1)].value.set(...wheelRGB(c[w + 'X'] || 0, c[w + 'Y'] || 0, c[w + 'M'] || 0))
      u.uTemp.value = THREE.MathUtils.clamp((c.temperature || 0) + this.worldTemperature, -1, 1); u.uTintG.value = c.tintGreen || 0; u.uHue.value = ((c.hue || 0) * Math.PI) / 180; u.uVib.value = c.vibrance || 0
      u.uLutMode.value = this.lut ? this.lut.mode : 0; u.tLut.value = this.lut?.tex || null; u.uLutAmt.value = c.lutStrength ?? 1
      if (this.lut) { u.uLutN.value = this.lut.n; u.uLutSize.value.set(this.lut.w, this.lut.h) }
      u.uVigR.value = c.vignetteRadius ?? 0.5
      const vc = new THREE.Color(c.vignetteColor || '#000000').convertLinearToSRGB(); u.uVigC.value.set(vc.r, vc.g, vc.b)
    }
  }

  /** View model: se dibuja encima con la profundidad vaciada. No toca las sombras (sus mapas ya están hechos en el pase principal). */
  drawViewModel(r, target) {
    const v = this.vp.vmView
    if (!v?.active) return
    const t = r.getRenderTarget(), ac = r.autoClear, su = r.shadowMap.autoUpdate
    r.setRenderTarget(target); r.autoClear = false; r.shadowMap.autoUpdate = false
    r.clearDepth()
    r.render(v.scene, v.camera)
    r.setRenderTarget(t); r.autoClear = ac; r.shadowMap.autoUpdate = su
  }

  /**
   * La niebla física la dibuja un pase del compositor: solo con composer, escena con «Niebla: Física» y fuera del agua. En cualquier otro caso
   * (clásico, perfil bajo, bajo el agua…) la escena vuelve a llevar su FogExp2 de three para que la niebla nunca desaparezca.
   */
  _syncFog(composerOn) {
    const vp = this.vp, want = !!(composerOn && vp._fogState?.physical)
    if (want === !!this._physFog) return
    this._physFog = want
    vp._applyFog()
  }

  /** Dibuja la escena con el look. `time` en segundos (animación del grano). */
  render(time = 0) {
    const vp = this.vp, r = vp.renderer
    this._applyExposure()
    this._syncFog(this.active || (this.split && this.cfg.look !== 'clasico')) // Outline solo no debe cambiar la niebla del modo Clásico/Bajo
    // Estrellas del cielo: con TAA, un punto de 1 píxel se recorta contra su vecindad 3×3 (±1,25σ) y parpadea según la fase del jitter;
    // con el núcleo a ~1,25 píxeles siempre hay un bloque de 2×2 a brillo pleno y la historia no lo recorta.
    if (vp.skyMat) vp.skyMat.uniforms.uStarCore.value = this.split && this.cfg.taa ? STAR_CORE_TAA : STAR_CORE
    if (!this.usesComposer && !this.cfg.psx) {
      if (this.composer) this._dispose()
      vp.perf.time('Escena', () => vp.perf.time('Escena · dibujo', () => vp.occlusion.draw(vp.camera, () => r.render(vp.scene, vp.camera)))); vp.perf.time('View model', () => this.drawViewModel(r, null)); return
    }
    if (this.usesComposer) {
      if (!this.composer || this.builtKey !== this._key()) { this._dispose(); this._build() }
      this.renderPass.camera = vp.camera
      this._syncSSR()
      this._syncOutline()
      if (this.dofPass) { // distancia de enfoque: la del ajuste, o la del centro de la pantalla suavizada (enfoque automático)
        const dt = Math.min(0.1, Math.max(0, time - (this._ft ?? time))); this._ft = time
        const want = this.cfg.dofAuto && this.focusTarget != null ? this.focusTarget : this.cfg.dofFocus
        this.focus = this.focus == null || !this.cfg.dofAuto ? want : this.focus + (want - this.focus) * (1 - Math.exp(-dt * 6))
      }
      // Clásico/Bajo con Outline usa solo RenderPass + OutputPass + OutlinePass.
      if (this.volPass) this.volPass.enabled = normalizeVolumetric(vp._env).volOn
      if (this.atmoPass) this.atmoPass.enabled = this._physFog
      if (this.aoPass) this.aoPass.camera = vp.camera
      this._updateUniforms()
      if (this.grade) { this.grade.uniforms.uTime.value = time; this.grade.uniforms.uAspect.value = this.w / this.h }
      if (this.customPass) this.customPass.uniforms.uTime.value = time
    }
    // los ayudantes del editor (gizmos, rejilla…) se dibujan después y encima, sin efectos
    const overlayThings = new Set([vp.overlay, vp.grid, vp.bolt?.mesh]) // el rayo también va tras los efectos: la niebla/AO por profundidad lo apagarían
    const vis = vp.scene.children.map((o) => [o, o.visible])
    for (const [o] of vis) if (overlayThings.has(o)) o.visible = false
    try {
      vp.sky.position.copy(vp.camera.position)
      if (this.cfg.psx) {
        if (this.usesComposer) {
          this.composer.renderToScreen = false
          this.composer.render()
          // El OutputPass del compositor ya aplicó la exposición y el espacio de salida.
          this.psxCopy ??= new TexturePass(null)
          this.psxCopy.map = this.composer.readBuffer.texture
          this.psxCopy.renderToScreen = true
          this.psxCopy.render(r, null, this.composer.readBuffer)
        } else {
          if (!this.psxTarget) {
            const type = r.extensions.has('EXT_color_buffer_float') ? THREE.HalfFloatType : THREE.UnsignedByteType
            this.psxTarget = new THREE.WebGLRenderTarget(this.psxW, this.psxH, {
              type, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
            })
          }
          r.setRenderTarget(this.psxTarget)
          r.clear()
          vp.occlusion.draw(vp.camera, () => r.render(vp.scene, vp.camera))
          this.drawViewModel(r, this.psxTarget)
          this.psxOutput ??= new OutputPass()
          this.psxOutput.renderToScreen = true
          this.psxOutput.render(r, null, this.psxTarget)
        }
      } else if (this.composerA) this._renderSplit(); else this.composer.render()
      vp.drawEditorOverlay(vis)
    } finally { for (const [o, v] of vis) o.visible = v }
  }

  _renderSplit() {
    const vp = this.vp, r = vp.renderer, cam = vp.camera, taa = this.cfg.taa
    const bw = this.composerA.renderTarget1.width, bh = this.composerA.renderTarget1.height // tamaño interno real
    let jit = [0, 0], vpm = null
    const sharedView = !!(cam.view && cam.view.enabled) // si otro código ya desplaza la cámara, no se toca
    if (taa) {
      cam.updateMatrixWorld()
      vpm = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)
      const pos = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld), fwd = new THREE.Vector3(0, 0, -1).transformDirection(cam.matrixWorld)
      if (this._pHave && (pos.distanceToSquared(this._pp) > 9 || fwd.dot(this._pf) < 0.7)) this.upscaler.reset()
      this._pp.copy(pos); this._pf.copy(fwd); this._pHave = true
      if (!sharedView) {
        jit = jitterOf(this.frameNo++)
        cam.setViewOffset(bw, bh, jit[0], jit[1], bw, bh)
      }
    }
    try { this.composerA.render() }
    finally { if (taa && !sharedView) cam.clearViewOffset() }

    const color = this.composerA.readBuffer.texture
    this.texPass.map = this.upscaler ? vp.perf.time('Reconstrucción', () => this.upscaler.render(r, {
      color, depth: this.depthTex, inW: bw, inH: bh, vp: vpm, jitter: jit, temporal: taa && !sharedView,
      spatialAdaptive: this.cfg.spatialReconstruction === 'edge-guard', alpha: this.scale < 0.8 ? 0.08 : 0.1,
    })) : color
    this.composer.render()
    const st = vp.perf.stats.extra
    st.scale = this.scale; st.taa = taa; st.internal = `${bw}×${bh}`; st.spatialReconstruction = this.cfg.spatialReconstruction || 'catmull'
    if (!this.upscaler && this.usesSpatialShader) st.spatialReconstruction = 'linear'
  }

  dispose() { this._dispose() }
}
