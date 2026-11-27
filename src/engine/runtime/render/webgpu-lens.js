import { DataTexture, HalfFloatType, RGBAFormat } from 'three'
import { Fn, If, Loop, float, mix, perspectiveDepthToViewZ, rtt, uv as quadUv, smoothstep, texture, textureSize, uniform, vec2, vec3, vec4 } from 'three/tsl'

export class WebGpuBloom {
  constructor(source, exposure) {
    this.strength = uniform(0)
    this.threshold = uniform(0)
    this.radius = uniform(0)
    // Reduce y extrae la energía de las altas luces antes de desenfocar.
    this.bright = rtt(Fn(() => {
      const color = source.sample(quadUv()).rgb.mul(exposure).max(0).toVar()
      const luminance = color.dot(vec3(0.2126, 0.7152, 0.0722))
      return vec4(color.mul(smoothstep(this.threshold, this.threshold.add(0.1), luminance)), 1)
    })())
    const blur = (input, horizontal) => rtt(Fn(() => {
      const size = vec2(textureSize(input))
      const step = (horizontal ? vec2(size.x.reciprocal(), 0) : vec2(0, size.y.reciprocal()))
        .mul(this.radius.mul(2).add(0.5))
      const sample = offset => input.sample(quadUv().add(step.mul(offset))).rgb
      return vec4(sample(0).mul(0.227027)
        .add(sample(1.384615).add(sample(-1.384615)).mul(0.316216))
        .add(sample(3.230769).add(sample(-3.230769)).mul(0.070270)), 1)
    })())
    this.horizontal = blur(this.bright, true)
    this.vertical = blur(this.horizontal, false)
    this.node = this.vertical.rgb.mul(this.strength)
  }

  update(cfg, scale) {
    this.strength.value = cfg.bloom
    this.threshold.value = cfg.bloomThreshold
    this.radius.value = cfg.bloomRadius
    for (const target of [this.bright, this.horizontal, this.vertical]) target.setResolutionScale(scale)
  }

  dispose() {
    for (const target of [this.vertical, this.horizontal, this.bright]) target.dispose()
  }
}

export class WebGpuAutoExposure {
  constructor(source) {
    this.history = new DataTexture(new Uint16Array(4), 1, 1, RGBAFormat, HalfFloatType)
    this.history.needsUpdate = true
    const previous = texture(this.history, vec2(0.5))
    const [key, minEv, maxEv, up, down, elapsed, first, amount] = this.params =
      [0.25, -3, 3, 3, 1, 0.016, 1, 1].map(value => uniform(value))
    this.measure = rtt(Fn(() => {
      const sum = float(0).toVar()
      Loop(16, ({ i }) => {
        Loop(16, ({ i: j }) => {
          const uv = vec2(i.toFloat(), j.toFloat()).add(0.5).div(16).sub(0.5).mul(0.9).add(0.5)
          const luminance = source.sample(uv).rgb.max(0).dot(vec3(0.2126, 0.7152, 0.0722))
          sum.addAssign(luminance.max(0.0001).log2())
        })
      })
      const goal = key.log2().sub(sum.div(256)).clamp(minEv, maxEv).toVar()
      const old = first.greaterThan(0.5).select(goal, previous.r).toVar()
      const speed = goal.greaterThan(old).select(up, down)
      const ev = mix(old, goal, elapsed.mul(speed).negate().exp().oneMinus())
      return vec4(ev, 0, 0, 1)
    })(), 1, 1)
    const renderMeasure = this.measure.updateBefore.bind(this.measure)
    this.measure.updateBefore = frame => {
      renderMeasure(frame)
      frame.renderer.copyTextureToTexture(this.measure.renderTarget.texture, this.history)
    }
    this.factor = this.measure.sample(vec2(0.5)).r.mul(amount).exp2()
  }

  update(cfg, now) {
    const elapsed = this.last == null ? 0.016 : Math.min(0.25, Math.max(0, (now - this.last) / 1000))
    const values = [cfg.aeKey, cfg.aeMin, cfg.aeMax, cfg.aeSpeedUp, cfg.aeSpeedDown, elapsed, this.last == null ? 1 : 0, cfg.autoExposure]
    this.params.forEach((param, index) => { param.value = values[index] })
    this.last = now
  }

  reset() { this.last = null }

  dispose() {
    this.measure.dispose()
    this.history.dispose()
  }
}

export class WebGpuDepthOfField {
  constructor(camera, source, depth) {
    const near = this.near = uniform(camera.near)
    const far = this.far = uniform(camera.far)
    const focus = this.focus = uniform(8)
    const range = this.range = uniform(4)
    const blur = this.blur = uniform(0)
    const depthAt = uv => perspectiveDepthToViewZ(depth.sample(uv).r, near, far).negate()
    const coc = d => d.sub(focus).abs().sub(range.mul(0.5))
      .div(d.greaterThan(focus).select(focus.mul(2).max(2), focus.max(1))).clamp().mul(blur)
    this.target = rtt(Fn(() => {
      const sum = source.sample(quadUv()).rgb.toVar()
      If(blur.greaterThanEqual(0.5), () => {
        const center = depthAt(quadUv()).toVar()
        const centerRadius = coc(center).toVar()
        const texel = vec2(textureSize(source)).reciprocal()
        const weights = float(1).toVar()
        Loop(32, ({ i }) => {
          const angle = i.toFloat().mul(2.39996323)
          const radius = i.toFloat().add(0.5).div(32).sqrt().mul(blur)
          const uv = quadUv().add(vec2(angle.cos(), angle.sin()).mul(radius).mul(texel))
          const distance = depthAt(uv).toVar()
          const reach = distance.lessThan(center).select(coc(distance), centerRadius)
          const weight = reach.sub(radius).add(0.5).clamp().toVar()
          sum.addAssign(source.sample(uv).rgb.mul(weight))
          weights.addAssign(weight)
        })
        sum.divAssign(weights)
      })
      return vec4(sum, 1)
    })())
  }

  update(vp, now, outputHeight, scale) {
    const { camera, look } = vp, c = look.cfg
    const target = c.dofAuto && look.focusTarget != null ? look.focusTarget : c.dofFocus
    const dt = Math.min(0.1, Math.max(0, (now - (this.last ?? now)) / 1000))
    this.focus.value = this.last == null || !c.dofAuto ? target : this.focus.value + (target - this.focus.value) * (1 - Math.exp(-dt * 6))
    this.last = now
    this.range.value = c.dofRange
    this.blur.value = c.dofBlur * scale * outputHeight / 1080
    this.near.value = camera.near
    this.far.value = camera.far
    this.target.setResolutionScale(scale)
  }

  dispose() { this.target.dispose() }
}

export function applyLut(original, lut, texture, amount) {
  const upper = lut.n - 1
  const coord = original.clamp().mul(upper)
  const f = coord.fract().toVar(), low = coord.floor().toVar(), high = low.add(1).min(upper)
  const size = vec2(lut.w, lut.h)
  const sample = (r, g, b) => {
    const k = r.add(g.mul(lut.n)).add(b.mul(lut.n * lut.n))
    const pixel = lut.mode === 1 ? vec2(b.mul(lut.n).add(r), float(upper).sub(g)) : vec2(k.mod(lut.w), k.div(lut.w).floor())
    return texture.sample(pixel.add(0.5).div(size)).rgb
  }
  const blendR = (g, b) => mix(sample(low.r, g, b), sample(high.r, g, b), f.r)
  const lowB = mix(blendR(low.g, low.b), blendR(high.g, low.b), f.g)
  const highB = mix(blendR(low.g, high.b), blendR(high.g, high.b), f.g)
  return mix(original, mix(lowB, highB, f.b), amount)
}
