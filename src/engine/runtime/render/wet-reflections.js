import * as THREE from 'three'
import { Reflector } from 'three/addons/objects/Reflector.js'
import { WETU } from './wetlib.js'

const MAX_DISTANCE = 60
const TARGET_SCALE = 0.5

export class WetReflections {
  constructor(viewport) {
    this.vp = viewport
    this.active = new Set()
    this.matrix = new THREE.Matrix4()
    this.inverse = new THREE.Matrix4()
    this.size = new THREE.Vector2()
    this.position = new THREE.Vector3()
    this.lastFrame = -Infinity
  }

  clear() {
    for (const terrain of this.active) {
      const uniforms = terrain.wetMirror
      uniforms.uWetMirrorStrength.value = 0
      uniforms.uWetMirrorMap.value = null
    }
    this.active.clear()
    this.lastFrame = -Infinity
  }

  dispose() {
    this.clear()
    this.reflector?.geometry.dispose()
    this.reflector?.dispose()
    this.reflector = null
  }

  update(terrains, strength, now) {
    const { vp } = this
    const camera = vp.camera
    if (strength <= 0 || WETU.uWet.value <= 0.65 || !camera.isPerspectiveCamera || !terrains.length) {
      if (this.active.size) this.clear()
      return
    }
    if (now - this.lastFrame < 33) return
    const position = camera.getWorldPosition(this.position)
    let best = MAX_DISTANCE, height
    for (const terrain of terrains) {
      if (!terrain.mesh.visible || !terrain.enabled) continue
      const b = terrain.bounds
      const x = THREE.MathUtils.clamp(position.x, b.x0, b.x1)
      const z = THREE.MathUtils.clamp(position.z, b.z0, b.z1)
      const y = terrain.oy + terrain.heightAt(x - terrain.ox, z - terrain.oz)
      const distance = Math.hypot(position.x - x, position.y - y, position.z - z)
      if (distance >= best || position.y < y + 0.05) continue
      height = y; best = distance
    }
    this.clear()
    if (height === undefined) return
    this.lastFrame = now
    const reflector = this.reflector ||= new Reflector(new THREE.BufferGeometry(), { multisample: 0 })
    reflector.rotation.x = -Math.PI / 2
    reflector.position.y = height - 0.025
    reflector.updateMatrixWorld()
    reflector.getReflectionCamera(camera).layers.mask = camera.layers.mask

    const { renderer, scene, precip } = vp
    renderer.getDrawingBufferSize(this.size)
    const target = reflector.getRenderTarget()
    const factor = Math.min(TARGET_SCALE, 1024 / Math.max(this.size.x, this.size.y, 1))
    const width = Math.max(1, Math.round(this.size.x * factor)), rows = Math.max(1, Math.round(this.size.y * factor))
    target.setSize(width, rows)
    const hidden = [vp.grid, precip.rain, precip.snow, precip.mist, precip.splash].filter(item => item?.visible)
    const prev = renderer.getRenderTarget()
    const shadow = renderer.shadowMap.autoUpdate, xr = renderer.xr.enabled
    try {
      for (const item of hidden) item.visible = false
      // El terreno se dibuja con los reflejos desactivados durante la captura.
      reflector.onBeforeRender(renderer, scene, camera)
    } finally {
      renderer.setRenderTarget(prev)
      renderer.shadowMap.autoUpdate = shadow
      renderer.xr.enabled = xr
      for (const item of hidden) item.visible = true
    }
    this.inverse.copy(reflector.matrixWorld).invert()
    this.matrix.copy(reflector.material.uniforms.textureMatrix.value).multiply(this.inverse)
    for (const terrain of terrains) {
      const uniforms = terrain.wetMirror
      uniforms.uWetMirrorMatrix.value.copy(this.matrix)
      uniforms.uWetMirrorMap.value = target.texture
      uniforms.uWetMirrorHeight.value = height
      uniforms.uWetMirrorStrength.value = strength
      this.active.add(terrain)
    }
  }
}
