import { Box3, Color, Vector3 } from 'three'
import { LightProbeGridWebGL } from 'three/addons/lighting/LightProbeGridWebGL.js'

import { boundsOfIrradianceWorld, layoutIrradiance } from './irradiance-layout.js'

const PROBE_INTERVAL = { local: 75, scene: 40 }
const REFRESH_INTERVAL = 2400

/** Irradiancia difusa local. Construye una sonda por actualización antes de publicar la cuadrícula. */
export class WorldIrradiance {
  constructor(viewport) {
    this.vp = viewport
    this.position = new Vector3()
    this.bounds = new Box3()
    this.background = new Color(0)
    this.active = null
    this.staging = null
    this.spare = null
    this.index = 0
    this.nextProbe = 0
    this.nextRefresh = 0
  }

  setScene(id) {
    if (id === this.sceneId) return
    this.sceneId = id
    this.dispose()
  }

  update(enabled, now, mode = 'local', intervalScale = 1) {
    const vp = this.vp
    if (!enabled || !vp.renderer.extensions.has('EXT_color_buffer_float')) {
      if (this.active || this.staging || this.spare) this.dispose()
      this.failed = false
      return
    }
    if (mode !== this.mode) {
      this.dispose()
      this.mode = mode
    }
    if (this.failed || now < this.nextProbe) return
    if (!this.staging) {
      vp.camera.getWorldPosition(this.position)
      if (this.active && now < this.nextRefresh &&
          (mode === 'scene' || this.position.distanceToSquared(this.active.position) < 9)) return
      if (mode === 'scene') boundsOfIrradianceWorld(vp.world, this.bounds)
      const layout = layoutIrradiance(mode, this.position, this.bounds)
      const key = JSON.stringify([...layout.size, ...layout.resolution])
      if (this.spare?.layoutKey !== key) {
        this.spare?.dispose()
        this.spare = null
      }
      this.staging = this.spare ?? new LightProbeGridWebGL(...layout.size, ...layout.resolution)
      this.staging.layoutKey = key
      this.staging.far = layout.far
      this.staging.position.fromArray(layout.center)
      this.staging.probeCount = layout.resolution.reduce((a, b) => a * b)
      this.spare = null
      this.index = 0
    }

    try {
      this._capture()
      if (++this.index === this.staging.probeCount) {
        this.active?.removeFromParent()
        this.spare = this.active
        this.active = this.staging
        this.staging = null
        vp.scene.add(this.active)
        this.nextRefresh = now + REFRESH_INTERVAL * intervalScale
        const extra = vp.perf?.stats?.extra
        if (extra) extra.irradianceProbes = this.active.probeCount
      }
      this.nextProbe = now + PROBE_INTERVAL[mode] * intervalScale
    } catch (error) {
      this.dispose()
      this.failed = true
      console.warn('Sondas dinámicas de iluminación indirecta', error)
    }
  }

  _capture() {
    const { scene, sky, grid, overlay, precip, bolt, renderer, _envRT } = this.vp
    const hidden = [this.active, sky, grid, overlay, precip.rain, precip.snow, precip.mist, precip.splash, bolt?.mesh]
      .filter(object => object?.visible)
    const { background, environment } = scene
    try {
      for (const object of hidden) object.visible = false
      scene.background = this.background
      scene.environment = _envRT?.texture || null
      this.staging.bake(renderer, scene, { cubemapSize: 12, near: 0.15, far: this.staging.far, start: this.index, count: 1 })
    } finally {
      scene.background = background
      scene.environment = environment
      for (const object of hidden) object.visible = true
    }
  }

  dispose() {
    for (const volume of [this.active, this.staging, this.spare]) {
      volume?.removeFromParent()
      volume?.dispose()
    }
    this.active = null
    this.staging = null
    this.spare = null
    this.nextProbe = 0
    this.nextRefresh = 0
    this.failed = false
    const extra = this.vp.perf?.stats?.extra
    if (extra) delete extra.irradianceProbes
  }
}
