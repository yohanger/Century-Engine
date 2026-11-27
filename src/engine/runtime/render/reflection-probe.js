import * as THREE from 'three'

/** Sonda que actualiza el entorno PBR con geometría y luces de la escena. */
export class ReflectionProbe {
  constructor(viewport) {
    this.vp = viewport
    this.position = new THREE.Vector3()
    this.skyPosition = new THREE.Vector3()
    this.last = -Infinity
  }

  update(enabled, now, interval = 900) {
    const { vp } = this
    if (!enabled) {
      if (this.target) this.dispose()
      return
    }
    if (now - this.last < interval) return
    this.last = now
    if (!this.target) {
      this.target = new THREE.WebGLCubeRenderTarget(64, {
        type: THREE.HalfFloatType, generateMipmaps: false, minFilter: THREE.LinearFilter,
      })
      this.camera = new THREE.CubeCamera(0.15, 3000, this.target)
    }
    const { renderer, scene, sky, precip } = vp
    vp.camera.getWorldPosition(this.position)
    this.camera.position.copy(this.position)
    this.camera.layers.mask = vp.camera.layers.mask
    this.skyPosition.copy(sky.position)
    const hidden = [vp.grid, precip.rain, precip.snow, precip.mist, precip.splash].filter(item => item?.visible)
    const previous = renderer.getRenderTarget(), shadow = renderer.shadowMap.autoUpdate, xr = renderer.xr.enabled
    const environment = scene.environment
    try {
      for (const item of hidden) item.visible = false
      // La captura usa el cielo como entrada y evita reflejarse a sí misma.
      scene.environment = vp._envRT?.texture || null
      sky.position.copy(this.position)
      renderer.shadowMap.autoUpdate = false
      this.camera.update(renderer, scene)
      scene.environment = this.target.texture
    } catch (error) {
      scene.environment = environment
      throw error
    } finally {
      sky.position.copy(this.skyPosition)
      renderer.setRenderTarget(previous)
      renderer.shadowMap.autoUpdate = shadow
      renderer.xr.enabled = xr
      for (const item of hidden) item.visible = true
    }
  }

  dispose() {
    if (!this.target) return
    this.vp.scene.environment = this.vp._envRT?.texture || null
    this.target.dispose()
    this.target = null
    this.last = -Infinity
  }
}
