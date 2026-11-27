import { Matrix3, Vector3, Vector4 } from 'three'
import { Fn, If, Loop, float, getViewPosition, mix, uv as quadUv, step, uniform, vec4 } from 'three/tsl'
import { FOG, FRACTION_EPS, resolveVolume } from '../world/fog.js'

// Mismo modelo de extinción, altura, dispersión y volúmenes que el pase atmosférico WebGL.
export class WebGpuFog {
  constructor(camera, depth, color) {
    const p0 = this.density = uniform(new Vector4())
    const p1 = this.lighting = uniform(new Vector4())
    const fogColor = this.color = uniform(new Vector3())
    const sun = this.sun = uniform(new Vector3())
    const sunColor = this.sunColor = uniform(new Vector3())
    const shafts = this.shafts = uniform(new Vector4())
    const volume = this.volume = uniform(new Vector4())
    const center = this.center = uniform(new Vector3())
    const half = this.half = uniform(new Vector3())
    const rotation = this.rotation = uniform(new Matrix3())
    const world = uniform(camera.matrixWorld)
    const invProjection = uniform(camera.projectionMatrixInverse)
    const farClip = this.far = uniform(camera.far)
    const sampleView = (uv, z) => getViewPosition(uv, z, invProjection)
    const toWorld = p => world.mul(vec4(p, 1)).xyz
    this.node = Fn(() => {
      const uv = quadUv()
      const origin = camera.isOrthographicCamera ? toWorld(sampleView(uv, 0)) : world[3].xyz
      const delta = toWorld(sampleView(uv, depth.sample(uv).r)).sub(origin).toVar()
      const length = delta.length().max(0.00001)
      const dir = delta.div(length).toVar()
      const distance = length.min(p0.w).toVar()
      const start = p1.z.toVar()
      If(volume.x.greaterThan(0), () => {
        const local = rotation.mul(origin.sub(center)).toVar()
        const ray = rotation.mul(dir).toVar()
        const safeRay = step(0, ray).mul(2).sub(1).mul(ray.abs().max(0.000001))
        const exit = half.sub(local).div(safeRay).max(half.negate().sub(local).div(safeRay))
        start.assign(start.max(exit.x.min(exit.y).min(exit.z).clamp(0, distance).mul(volume.y)))
      })
      const len = distance.sub(start).max(0)
      const y0 = origin.y.add(dir.y.mul(start))
      const y1 = y0.add(dir.y.mul(len))
      const low = y0.min(y1), high = y0.max(y1)
      const above = high.sub(low.max(p0.z)).max(0)
      const heightDelta = high.sub(low)
      const slope = dir.y.abs().max(0.00001)
      const aboveLen = heightDelta.lessThan(0.00001).select(low.greaterThan(p0.z).select(len, 0), above.div(slope).min(len))
      const k = p0.y.mul(above)
      const fraction = k.lessThan(FRACTION_EPS).select(
        float(1).sub(k.mul(0.5)).add(k.mul(k).div(6)).sub(k.pow(3).div(24)),
        k.negate().exp().oneMinus().div(k.max(0.00001)),
      )
      const integral = len.sub(aboveLen).add(aboveLen.mul(low.sub(p0.z).max(0).mul(p0.y).negate().exp()).mul(fraction))
      const tau = p0.x.mul(integral).max(0)
      const transmission = tau.negate().exp().toVar()
      const scatter = transmission.oneMinus()
      const g = p1.x.clamp()
      const g2 = g.mul(g)
      const phase = g2.oneMinus().mul(FOG.HG_NORM)
        .div(g2.add(1).sub(g.mul(2).mul(dir.dot(sun))).max(0.025).pow(1.5)).min(FOG.HG_MAX)
      const response = mix(FOG.DEPTH_RESPONSE_MIN, 1, tau.greaterThan(0.0001).select(scatter.div(tau.max(0.0001)).clamp().sqrt(), 1))
      const light = fogColor.mul(p1.y).add(sunColor.mul(phase.mul(response).mul(p1.w))).mul(scatter).clamp().toVar()

      If(shafts.z.greaterThan(0.0001), () => {
        const step = shafts.xy.sub(uv).div(FOG.SHAFT_SAMPLES)
        const sampleUv = uv.toVar()
        const visibility = float(0).toVar(), decay = float(1).toVar()
        Loop(FOG.SHAFT_SAMPLES, () => {
          sampleUv.assign(sampleUv.add(step).clamp())
          const view = sampleView(sampleUv, depth.sample(sampleUv).r).z.negate()
          const clear = view.sub(farClip.mul(0.985)).div(farClip.mul(0.015).max(0.5)).clamp()
          visibility.addAssign(clear.mul(decay))
          decay.mulAssign(FOG.SHAFT_DECAY)
        })
        const radial = uv.sub(shafts.xy).length().mul(-0.72).add(1).clamp()
        light.addAssign(sunColor.mul(visibility.div(FOG.SHAFT_NORM).clamp().mul(radial).mul(shafts.w)
          .mul(len.div(distance.max(0.0001)).clamp())))
      })

      return color.mul(transmission).add(light)
    })()
    this.sunScreen = new Vector3()
    this.position = new Vector3()
    this.forward = new Vector3()
  }

  update(vp) {
    const { camera, _fogState: fog } = vp
    const p = fog.params
    this.far.value = camera.far
    this.density.value.set(p.extinction, p.falloff, p.baseHeight, Math.min(p.maxDistance, Math.max(1, camera.far * 0.98)))
    this.lighting.value.set(p.anisotropy, p.ambient, p.start, p.scatter * Math.max(0, fog.sunIntensity))
    this.color.value.set(fog.color.r, fog.color.g, fog.color.b)
    this.sun.value.fromArray(fog.sunDir).normalize()
    this.sunColor.value.fromArray(fog.sunColor)
    this.position.setFromMatrixPosition(camera.matrixWorld)
    const volume = resolveVolume(vp.atmoVolumes?.() || [], this.position.toArray())
    if (volume) {
      this.volume.value.set(1, 1 - volume.exchange, 0, 0)
      this.center.value.fromArray(volume.position)
      this.half.value.fromArray(volume.half)
      this.rotation.value.set(...volume.m)
    } else this.volume.value.x = 0
    const screen = this.sunScreen.copy(this.position).addScaledVector(this.sun.value, Math.max(1000, camera.far)).project(camera)
    const visible = Math.abs(screen.x) < 0.7 && Math.abs(screen.y) < 0.7 && this.sun.value.dot(camera.getWorldDirection(this.forward)) > 0
    const strength = fog.shafts > 0 ? Math.min(1, fog.shaftStrength(visible)) : 0
    const amount = strength * Math.min(1, p.density / FOG.REF_DENSITY) * fog.shafts
    this.shafts.value.set(screen.x * 0.5 + 0.5, 0.5 - screen.y * 0.5, strength, amount)
  }
}
