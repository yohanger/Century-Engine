import { BackSide, Mesh, Scene, SphereGeometry, WebGPUCoordinateSystem } from 'three'
import { MeshBasicNodeMaterial, PMREMGenerator, WebGPURenderer } from 'three/webgpu'
import { mix, positionLocal, step, uniform } from 'three/tsl'
import { WebGpuPost, webGpuPostOptions } from './webgpu-post.js'
import { GpuClusterDraw } from './gpu-cluster-draw.js'

export function unavailableWebGpuEffect(vp) {
  const c = vp.look.cfg
  if (vp.filmCapture) return 'captura de Film Maker'
  if (c.psx) return 'estilo PSX'
  if (c.staticOcclusion) return 'oclusión precalculada'
  if (c.batchStatic) return 'batching de decoración'
  if (vp.look.active && c.indirectProbeGrid) return 'sondas dinámicas de iluminación indirecta'
  if (vp.look._postDoc()) return 'shader de postprocesado'
  if (c.look !== 'clasico' && (c.puddleReflections || c.dynamicReflections && c.reflections > 0)) return 'reflejos del entorno o de charcos'
  const sky = vp.skyMat.uniforms
  if (sky.uMode.value !== 0 || sky.uClouds.value > 0) return 'cielo físico, panorámico o con nubes'
  if (sky.uAstro.value > 0.5 || sky.uStars.value > 0 || sky.uStormCover.value > 0.001) return 'cielo astronómico o de tormenta'
  if (vp.look.active && c.screenBounce > 0 && !c.worldRayBounce && !vp.camera.isPerspectiveCamera) return 'rebote en pantalla con cámara ortográfica'
  if (vp.vmView?.active) return 'view model'
  if (vp.scene.background?.isRenderTargetTexture || vp.scene.overrideMaterial) return 'material de escena'
  let reason = ''
  vp.scene.traverseVisible(object => {
    if (reason || object === vp.sky || !object.layers.test(vp.camera.layers)) return
    if (vp.look.active && vp._env?.volOn && object.isLight && object.userData.rtVol?.shadow) { reason = 'sombras volumétricas'; return }
    if (object.isLensflare) { reason = 'destello de lente'; return }
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    for (const m of materials) {
      if (!m?.visible) continue
      if (m.isShaderMaterial || m.isRawShaderMaterial || m.userData.rt || m.userData.rtRoadPaint ||
          m.userData.rtShArr || m.defines?.LF_BAKE_UV || m.envMap?.isRenderTargetTexture ||
          (Object.hasOwn(m, 'onBeforeCompile') && !m.userData.rtLfEffects)) {
        reason = 'material de ' + (object.name || object.parent?.name || 'un objeto')
        return
      }
    }
  })
  return reason
}

export class WebGpuPlay {
  constructor(vp) {
    this.vp = vp
    this.active = false
    this.closed = false
    this.clusters = null
  }

  async init() {
    const adapter = await globalThis.navigator?.gpu?.requestAdapter()
    if (!adapter || this.closed) throw new Error('no hay un adaptador WebGPU disponible')
    const features = ['rg11b10ufloat-renderable'].filter(feature => adapter.features.has(feature))
    const device = await adapter.requestDevice({ requiredFeatures: features })
    if (this.closed) { device.destroy(); return }
    this.device = device
    this.canvas = this.vp.dom.ownerDocument.createElement('canvas')
    this.canvas.setAttribute('aria-hidden', 'true')
    this.canvas.style.cssText = 'display:none;position:absolute;inset:0;width:100%;height:100%;pointer-events:none'
    this.renderer = new WebGPURenderer({ canvas: this.canvas, device, antialias: true, alpha: false })
    // Century decide el fallback del fotograma hacia el canvas WebGL del editor.
    this.renderer._getFallback = null
    await this.renderer.init()
    if (this.closed) { await this.renderer.dispose(); return }
    if (!this.renderer.backend.isWebGPUBackend) throw new Error('el dispositivo no inició WebGPU')
    this.renderer.shadowMap.enabled = true
    this.renderer.onError = ({ message }) => {
      if (this.closed) return
      this.error = message || 'error del dispositivo WebGPU'
      this.vp.requestRender()
    }
    this.device.lost.then(() => {
      if (this.closed) return
      this.error = 'se perdió el dispositivo WebGPU'
      this.hide()
      this.vp.requestRender()
    })
    this._makeSky()
    this.vp.dom.after(this.canvas)
  }

  _makeSky() {
    const { top, horizon, ground } = this.vp.skyMat.uniforms
    this.colors = [uniform(top.value.clone()), uniform(horizon.value.clone()), uniform(ground.value.clone())]
    const [sky, middle, floor] = this.colors
    this.skyExposure = uniform(this.vp.skyMat.uniforms.uExposure.value)
    this.skyFogColor = uniform(this.vp.skyMat.uniforms.uSkyFogColor.value.clone())
    this.skyFogDensity = uniform(0)
    const y = positionLocal.normalize().y
    const arc = y.abs().clamp(0, 1).acos().mul(2 / Math.PI)
    const upper = mix(sky, middle, arc.pow(1 / 0.15))
    const lower = mix(floor, middle, arc.pow(1 / 0.02))
    this.skyMaterial = new MeshBasicNodeMaterial()
    this.skyMaterial.side = BackSide
    this.skyMaterial.depthWrite = false
    const gradient = mix(lower, upper, step(0, y)).mul(this.skyExposure)
    const opticalDepth = this.skyFogDensity.mul(2400)
    this.skyMaterial.colorNode = mix(this.skyFogColor, gradient, opticalDepth.mul(opticalDepth).negate().exp())
    this.environmentScene = new Scene()
    this.environmentSky = new Mesh(new SphereGeometry(10, 24, 12), this.skyMaterial)
    this.environmentScene.add(this.environmentSky)
    this.pmrem = new PMREMGenerator(this.renderer)
  }

  _sky(now) {
    const u = this.vp.skyMat.uniforms
    const next = [u.top.value, u.horizon.value, u.ground.value]
    const fogDensity = this.post?.fog ? 0 : u.uSkyFogDensity.value
    const changed = this.skyExposure.value !== u.uExposure.value || next.some((color, i) => !this.colors[i].value.equals(color)) ||
      this.skyFogDensity.value !== fogDensity || fogDensity > 0 && !this.skyFogColor.value.equals(u.uSkyFogColor.value)
    this.skyFogDensity.value = fogDensity
    this.skyFogColor.value.copy(u.uSkyFogColor.value)
    this.skyExposure.value = u.uExposure.value
    for (let i = 0; i < next.length; i++) this.colors[i].value.copy(next[i])
    this.skyDirty ||= changed
    if (!this.texture || this.skyDirty && now - (this.envAt || 0) >= 1200) {
      this.texture?.dispose()
      this.texture = this.pmrem.fromScene(this.environmentScene)
      this.envAt = now
      this.skyDirty = false
    }
  }

  draw(now) {
    if (!this.pmrem || this.closed || this.error) return false
    const vp = this.vp, cfg = vp.look.cfg, { camera, scene } = vp
    const width = vp.container.clientWidth || 1, height = vp.container.clientHeight || 1
    const pixelRatio = vp.renderer.getPixelRatio()
    const scale = Math.max(cfg.resScale * pixelRatio, 1 / Math.min(width, height))
    vp.worldRayScene.update(vp.look.active && (cfg.worldRayReflection > 0 || cfg.worldRayBounce && cfg.screenBounce > 0), now)
    const options = webGpuPostOptions(vp)
    if (options.bounce && (!camera.isPerspectiveCamera || !this.renderer.hasFeature('rg11b10ufloat-renderable'))) {
      // Si se prepara el BVH, el rebote de mundo será suficiente en el siguiente fotograma.
      if (cfg.worldRayBounce && !vp.worldRayScene.failed) options.bounce = false
      else {
        this.frameFallback = 'el dispositivo o la cámara no admite el rebote SSGI'
        this.hide()
        return false
      }
    }
    this.frameFallback = ''
    const usePost = options.grade || options.sharpen || options.filter === 'catmull' || options.filter === 'edge-guard'
    const postKey = usePost ? JSON.stringify(options) : ''
    if (postKey !== this.postKey || this.post && camera !== this.post.camera) {
      this.post?.dispose()
      this.post = null
      this.post = usePost ? new WebGpuPost(this.renderer, vp, options) : null
      this.postKey = postKey
    }
    const outputScale = this.post ? pixelRatio : scale
    const size = width + ':' + height + ':' + outputScale
    if (this.size !== size) {
      this.renderer.setPixelRatio(outputScale)
      this.renderer.setSize(width, height, false)
      this.size = size
    }
    vp.look._syncFog(!!this.post?.fog)
    vp.look._applyExposure()
    this.renderer.toneMapping = vp.renderer.toneMapping
    this.renderer.toneMappingExposure = vp.renderer.toneMappingExposure
    this.canvas.style.imageRendering = cfg.spatialReconstruction === 'nearest' ? 'pixelated' : 'auto'
    const coordinateSystem = camera.coordinateSystem
    const previousEnv = scene.environment
    const previousSky = vp.sky.material
    const draw = () => this.post ? this.post.render(vp, now, width, height, outputScale) : this.renderer.render(scene, camera)
    let indirect = 0
    try {
      this._sky(now)
      scene.environment = this.texture.texture
      vp.sky.material = this.skyMaterial
      if (camera.coordinateSystem !== WebGPUCoordinateSystem) {
        camera.coordinateSystem = WebGPUCoordinateSystem
        camera.updateProjectionMatrix()
      }
      camera.updateWorldMatrix(true, false)
      // Gestión nativa del backend WebGPU, independiente del interruptor histórico.
      // Los objetos no compatibles continúan en el render normal.
      this.clusters ??= new GpuClusterDraw(this.renderer)
      indirect = this.clusters.draw(scene, camera, camera.projectionMatrix.elements[5] * height * scale * 0.5,
        cfg.lodQuality, draw)
    } finally {
      vp.sky.material = previousSky
      scene.environment = previousEnv
      if (camera.coordinateSystem !== coordinateSystem) {
        camera.coordinateSystem = coordinateSystem
        camera.updateProjectionMatrix()
      }
    }
    this.active = true
    this.canvas.style.display = vp.dom.style.opacity === '0' ? 'none' : 'block'
    vp.perf.stats.extra.gpuIndirectMeshes = indirect
    const buffer = this.post?.scene.renderTarget || this.canvas
    vp.perf.stats.extra.sceneBuffer = `${buffer.width}×${buffer.height}`
    vp.perf.stats.extra.scale = cfg.resScale
    vp.perf.stats.extra.internal = vp.perf.stats.extra.sceneBuffer
    vp.perf.stats.extra.spatialReconstruction = options.filter || ''
    return true
  }

  hide() {
    if (this.canvas) this.canvas.style.display = 'none'
    if (this.active) {
      this.active = false
      const extra = this.vp.perf.stats.extra
      for (const key of ['gpuIndirectMeshes', 'sceneBuffer', 'scale', 'internal', 'spatialReconstruction']) delete extra[key]
      this.vp._queueEnvBake(true)
    }
  }

  dispose() {
    if (this.closed) return
    this.closed = true
    this.hide()
    this.clusters?.dispose()
    this.post?.dispose()
    this.environmentSky?.geometry.dispose()
    this.skyMaterial?.dispose()
    this.texture?.dispose()
    this.pmrem?.dispose()
    const device = this.device
    if (this.renderer?.hasInitialized()) {
      this.renderer.dispose().catch(console.warn).finally(() => device?.destroy())
    } else device?.destroy()
    this.canvas?.remove()
  }
}
