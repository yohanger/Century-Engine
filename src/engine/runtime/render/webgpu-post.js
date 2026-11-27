import { Color, MathUtils, NearestFilter, Vector2, Vector3 } from 'three'
import { RenderPipeline } from 'three/webgpu'
import {
  Fn, If, float, diffuseColor, materialMetalness, materialRoughness, mix, mrt, normalView, output, pass,
  renderOutput, rtt, sample, uv as quadUv, smoothstep, texture, textureSize, uniform, vec2, vec3, vec4,
} from 'three/tsl'
import { ao } from 'three/addons/tsl/display/GTAONode.js'
import SSGINode from 'three/addons/tsl/display/SSGINode.js'
import { ssr } from 'three/addons/tsl/display/SSRNode.js'
import { WebGpuAutoExposure, WebGpuBloom, WebGpuDepthOfField, applyLut } from './webgpu-lens.js'
import { WebGpuWorldRay } from './webgpu-world-ray.js'
import { WebGpuVolumetric } from './webgpu-volumetric.js'
import { WebGpuFog } from './webgpu-fog.js'
import { GRADE_WHEELS, wheelRGB } from './config.js'

const luma = color => color.dot(vec3(0.2126, 0.7152, 0.0722))
const quality = { baja: 0.5, media: 0.75, alta: 1 }

class ScaledSSGI extends SSGINode {
  setSize(width, height) {
    super.setSize(Math.max(1, Math.round(width * this.resolutionScale)), Math.max(1, Math.round(height * this.resolutionScale)))
  }
}

export function webGpuPostOptions(vp) {
  const { cfg, active, adaptsToWorld, profile, split } = vp.look
  const grade = active || adaptsToWorld
  const trace = active && !!vp.worldRayScene.active &&
    (cfg.worldRayReflection > 0 || cfg.worldRayBounce && cfg.screenBounce > 0)
  return {
    trace,
    grade,
    lut: grade && cfg.lutStrength > 0 ? vp.look.lut?.tex.id ?? -1 : -1,
    dof: active && cfg.dofBlur > 0 && vp.camera.isPerspectiveCamera,
    volumetric: active && !!vp._env?.volOn,
    fog: active && !!vp._fogState?.physical,
    ao: active && profile === 'alto' && cfg.ao > 0,
    autoExposure: active && cfg.autoExposure > 0,
    bloom: active && cfg.bloom > 0,
    bounce: active && cfg.screenBounce > 0 && !(trace && cfg.worldRayBounce),
    ssr: active && cfg.ssr && cfg.ssrStrength > 0 ? cfg.ssrQuality : '',
    filter: split ? cfg.spatialReconstruction : '',
    sharpen: split && cfg.look !== 'clasico' && cfg.sharpen > 0.001,
    chromatic: grade && cfg.chromatic > 0,
    grain: grade && cfg.grain > 0,
  }
}

function catmull(source, uv, size, protectEdges) {
  const p = uv.mul(size)
  const center = p.sub(0.5).floor().add(0.5)
  const f = p.sub(center)
  const f2 = f.mul(f)
  const w0 = f.mul(f.mul(f.mul(-0.5).add(1)).sub(0.5))
  const w1 = f2.mul(f.mul(1.5).sub(2.5)).add(1)
  const w2 = f.mul(f.mul(f.mul(-1.5).add(2)).add(0.5))
  const w3 = f2.mul(f.mul(0.5).sub(0.5))
  const w12 = w1.add(w2)
  const t12 = center.add(w2.div(w12)).div(size)
  const t0 = center.sub(1).div(size)
  const t3 = center.add(2).div(size)
  const weights = [w12.x.mul(w0.y), w0.x.mul(w12.y), w12.x.mul(w12.y), w3.x.mul(w12.y), w12.x.mul(w3.y)]
  const coords = [vec2(t12.x, t0.y), vec2(t0.x, t12.y), t12, vec2(t3.x, t12.y), vec2(t12.x, t3.y)]
  const result = coords.map((coord, i) => source.sample(coord).rgb.mul(weights[i]))
    .reduce((a, b) => a.add(b)).div(weights.reduce((a, b) => a.add(b))).max(0)
  if (!protectEdges) return result
  const base = center.div(size)
  const pixel = vec2(1).div(size)
  const samples = [vec2(0), vec2(pixel.x, 0), vec2(0, pixel.y), pixel].map(offset => source.sample(base.add(offset)).rgb)
  const [a, b, c, d] = samples
  const [la, lb, lc, ld] = samples.map(luma)
  const low = a.min(b).min(c.min(d)), high = a.max(b).max(c.max(d))
  const minLuma = la.min(lb).min(lc.min(ld)), maxLuma = la.max(lb).max(lc.max(ld))
  const contrast = maxLuma.sub(minLuma).mul(2).div(maxLuma.add(0.1)).clamp()
  return mix(result, result.clamp(low, high), contrast)
}

function sharpen(color, source, uv, texel, strength) {
  const x = vec2(texel.x, 0), y = vec2(0, texel.y)
  const [n, s, e, w] = [uv.add(y), uv.sub(y), uv.add(x), uv.sub(x)].map(coord => source.sample(coord).rgb)
  const low = color.min(n.min(s)).min(e.min(w))
  const high = color.max(n.max(s)).max(e.max(w))
  // Evalúa el contraste en HDR para evitar halos en emisivos.
  const amp = low.div(high.max(0.001)).clamp().sqrt()
  const weight = amp.mul(strength).mul(-0.2)
  return color.add(weight.mul(n.add(s).add(e).add(w))).div(weight.mul(4).add(1)).max(0)
}

function colorGrade(color, u, options, lut, lutSource) {
  const col = color.toVar()
  col.addAssign(u.offset.mul(0.1))
  col.addAssign(u.lift.mul(0.25).mul(col.clamp().oneMinus()))
  col.assign(col.max(0).pow(u.gamma.mul(0.5).add(1).max(0.05).reciprocal()))
  col.mulAssign(u.gain.mul(0.5).add(1).max(0))
  const warm = u.temperature.mul(0.2), tint = u.tintGreen.mul(0.08)
  col.mulAssign(vec3(warm.add(tint).add(1), u.tintGreen.mul(-0.15).add(1), tint.sub(warm).add(1)))
  If(u.hue.abs().greaterThan(0.0001), () => {
    const y = col.dot(vec3(0.299, 0.587, 0.114))
    const i = col.dot(vec3(0.596, -0.274, -0.322))
    const q = col.dot(vec3(0.211, -0.523, 0.312))
    const cos = u.hue.cos(), sin = u.hue.sin()
    col.assign(vec3(y).add(vec3(0.956, -0.272, -1.106).mul(i.mul(cos).sub(q.mul(sin))))
      .add(vec3(0.621, -0.647, 1.703).mul(q.mul(cos).add(i.mul(sin)))).max(0))
  })
  const light = luma(col).toVar()
  const hueTint = mix(u.shadowTint, u.highlightTint, smoothstep(0.12, 0.8, light))
  col.assign(mix(col, col.mul(hueTint.div(hueTint.dot(vec3(1 / 3)).max(0.001))), u.tintStrength))
  col.assign(mix(vec3(light), col, u.saturation))
  const spread = col.r.max(col.g.max(col.b)).sub(col.r.min(col.g.min(col.b))).clamp()
  col.assign(mix(vec3(light), col, u.vibrance.mul(spread.oneMinus()).add(1)))
  const contrasted = col.sub(0.5).mul(u.contrast).add(0.5)
  col.assign(u.contrast.greaterThan(1).select(mix(col, contrasted, smoothstep(vec3(0), vec3(0.25), col)), contrasted))
  const aspect = vec2(u.aspect, 1)
  const distance = quadUv().sub(0.5).mul(aspect).length().div(aspect.length().mul(0.5))
  const radius = u.vignetteRadius.mul(0.7)
  col.assign(mix(col, u.vignetteColor, u.vignette.mul(smoothstep(radius, radius.add(0.7), distance))))
  if (lut) col.assign(applyLut(col, lut, lutSource, u.lutStrength))
  if (options.grain) {
    const seed = quadUv().mul(u.size).floor().add(u.time.mul(0.37).fract().mul(523))
    const hash = seed.dot(vec2(0.06711056, 0.00583715)).fract().mul(52.9829189).fract().sub(0.5)
    col.addAssign(hash.mul(u.grain).mul(0.4).mul(float(1.15).sub(light)))
  }
  return col.max(0)
}

export class WebGpuPost {
  constructor(renderer, vp, options) {
    const { camera, scene } = vp
    this.camera = camera
    this.options = options
    this.effects = []
    this.u = Object.fromEntries([
      'temperature', 'tintGreen', 'hue', 'saturation', 'contrast', 'vibrance', 'tintStrength',
      'vignette', 'vignetteRadius', 'grain', 'chromatic', 'sharpen', 'aspect', 'time',
    ].map(key => [key, uniform(0)]))
    for (const key of [...GRADE_WHEELS, 'shadowTint', 'highlightTint', 'vignetteColor']) {
      this.u[key] = uniform(new Vector3())
    }
    this.u.size = uniform(new Vector2(1, 1))
    this.color = new Color()
    const lut = options.lut >= 0 ? vp.look.lut : null
    const lutSource = lut ? texture(lut.tex) : null
    this.u.lutStrength = uniform(0)
    this.scene = pass(scene, camera, { samples: 0 })
    const beauty = this.scene.getTextureNode('output')
    const { ao: ambient, bounce, ssr: reflections, trace } = options
    let color = beauty.rgb
    if (ambient || bounce || reflections || trace || options.fog || options.dof || options.volumetric) {
      this.scene.renderTarget.depthTexture.minFilter = NearestFilter
      this.scene.renderTarget.depthTexture.magFilter = NearestFilter
    }
    const depth = this.scene.getTextureNode('depth')
    if (ambient || bounce || reflections || trace) {
      const attachments = { output, normal: vec4(normalView, 1) }
      if (reflections || trace) attachments.surface = vec4(materialRoughness, materialMetalness, 0, 1)
      if (trace) attachments.diffuse = diffuseColor
      this.scene.setMRT(mrt(attachments))
      const normal = this.scene.getTextureNode('normal')
      if (ambient) {
        this.ao = ao(depth, normal, camera)
        this.effects.push(this.ao)
        color = color.mul(mix(1, this.ao.getTextureNode().r, uniform(0).onRenderUpdate(() => Math.min(vp.look.cfg.ao, 1))))
      }
      if (bounce) {
        this.gi = new ScaledSSGI(beauty, depth, normal, camera)
        this.effects.push(this.gi)
        // Usa las mismas unidades de escena que el trazado de WebGL.
        this.gi.useScreenSpaceSampling.value = false
        this.gi.stepCount.value = 8
        color = color.add(this.gi.getGINode().rgb)
      }
      if (trace || reflections) this.surface = this.scene.getTextureNode('surface')
      if (reflections) {
        const surface = this.surface
        this.ssr = ssr(beauty, depth, normal, {
          camera,
          roughnessNode: sample(uv => surface.sample(uv).r),
          metalnessNode: sample(uv => surface.sample(uv).g),
          reflectNonMetals: true,
        })
        this.ssr.quality.value = quality[reflections]
        this.effects.push(this.ssr)
        const reflection = this.ssr
        color = color.add(reflection.rgb)
      }
      if (trace) {
        this.worldRay = new WebGpuWorldRay(camera, depth, normal, this.surface, this.scene.getTextureNode('diffuse'),
          vp.worldRayScene.active, this.ssr)
        this.effects.push(this.worldRay)
        color = color.add(this.worldRay.node)
      }
    }
    if (options.volumetric) {
      this.volumetric = new WebGpuVolumetric(camera, depth, color)
      this.effects.push(this.volumetric)
      color = this.volumetric.node
    }
    // La reconstrucción lee la imagen ya iluminada y conserva la resolución interna de la escena.
    if (options.fog) {
      this.fog = new WebGpuFog(camera, depth, color)
      color = this.fog.node
    }
    let source = beauty
    if (ambient || bounce || reflections || trace || options.fog || options.volumetric) {
      this.lit = rtt(vec4(color, 1))
      this.effects.push(this.lit)
      source = this.lit
    }
    if (options.dof) {
      this.dof = new WebGpuDepthOfField(camera, source, depth)
      this.effects.push(this.dof)
      source = this.dof.target
    }
    if (options.autoExposure) {
      this.autoExposure = new WebGpuAutoExposure(source)
      this.effects.push(this.autoExposure)
    }
    const exposure = this.autoExposure?.factor || float(1)
    if (options.bloom) {
      this.bloom = new WebGpuBloom(source, exposure)
      this.effects.push(this.bloom)
    }
    const size = vec2(textureSize(source))
    const sampleColor = uv => {
      if (options.filter === 'nearest') return source.sample(uv.mul(size).floor().add(0.5).div(size)).rgb
      if (options.filter === 'catmull' || options.filter === 'edge-guard') {
        return catmull(source, uv, size, options.filter === 'edge-guard')
      }
      return source.sample(uv).rgb
    }
    const outputNode = Fn(() => {
      const uv = quadUv()
      let color = sampleColor(uv)
      if (options.sharpen) color = sharpen(color, source, uv, vec2(1).div(size), this.u.sharpen)
      if (options.chromatic) {
        const offset = uv.sub(0.5).mul(this.u.chromatic)
        color = vec3(sampleColor(uv.add(offset)).r, color.g, sampleColor(uv.sub(offset)).b)
      }
      color = color.mul(exposure)
      if (this.bloom) color = color.add(this.bloom.node)
      // GradeShader de WebGL opera en sRGB tras el mapeo de tonos.
      color = renderOutput(vec4(color, 1)).rgb
      return vec4(options.grade ? colorGrade(color, this.u, options, lut, lutSource) : color, 1)
    })()
    this.pipeline = new RenderPipeline(renderer, outputNode)
    this.pipeline.outputColorTransform = false
  }

  render(vp, now, width, height, pixelRatio) {
    const { cfg, worldTemperature } = vp.look
    const u = this.u
    const minimum = 1 / Math.max(1, Math.floor(Math.min(width, height) * pixelRatio))
    const internalScale = Math.max(cfg.resScale, minimum)
    const halfScale = Math.max(cfg.resScale * 0.5, minimum)
    this.scene.setResolutionScale(internalScale)
    this.lit?.setResolutionScale(internalScale)
    if (this.ao) this.ao.resolutionScale = internalScale
    if (this.ssr) this.ssr.resolutionScale = Math.max(minimum, cfg.resScale * quality[this.options.ssr])
    u.size.value.set(width * pixelRatio, height * pixelRatio)
    u.aspect.value = width / height
    u.time.value = now / 1000
    for (const key of ['tintGreen', 'saturation', 'contrast', 'vibrance', 'tintStrength', 'vignette', 'vignetteRadius', 'grain', 'chromatic', 'sharpen']) {
      u[key].value = cfg[key]
    }
    u.hue.value = MathUtils.degToRad(cfg.hue)
    u.temperature.value = MathUtils.clamp(cfg.temperature + (worldTemperature || 0), -1, 1)
    for (const key of GRADE_WHEELS) u[key].value.set(...wheelRGB(cfg[key + 'X'], cfg[key + 'Y'], cfg[key + 'M']))
    for (const key of ['shadowTint', 'highlightTint', 'vignetteColor']) {
      this.color.set(cfg[key]).convertLinearToSRGB()
      u[key].value.set(this.color.r, this.color.g, this.color.b)
    }
    if (this.ao) {
      this.ao.radius.value = cfg.aoRadius
      this.ao.scale.value = Math.max(0.5, cfg.ao)
    }
    if (this.gi) {
      this.gi.resolutionScale = cfg.resScale
      this.gi.radius.value = cfg.bounceDistance
      this.gi.giIntensity.value = cfg.screenBounce
    }
    if (this.ssr) {
      this.ssr.maxDistance.value = cfg.ssrDistance
      this.ssr.intensity.value = cfg.ssrStrength
    }
    this.autoExposure?.update(cfg, now)
    this.bloom?.update(cfg, halfScale)
    this.dof?.update(vp, now, height * pixelRatio, internalScale)
    u.lutStrength.value = cfg.lutStrength
    this.worldRay?.update(vp)
    this.volumetric?.update(vp, now, halfScale)
    this.fog?.update(vp)
    this.pipeline.render()
  }

  dispose() {
    this.pipeline.dispose()
    for (const effect of this.effects.reverse()) effect.dispose()
    this.scene.dispose()
  }
}
