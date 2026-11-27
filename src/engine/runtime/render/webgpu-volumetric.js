import { Color, DataTexture, FloatType, RGBAFormat, Vector3, Vector4 } from 'three'
import { Fn, getViewPosition, rtt, textureLoad, uniform, uv, vec4, wgslFn } from 'three/tsl'
import { normalizeVolumetric } from './lightlib.js'

const MAX_LIGHTS = 6

const scatter = wgslFn(/* wgsl */`
fn lfVolume(origin: vec3f, dir: vec3f, distance: f32, fog: vec4f, noise: vec4f, wind: vec3f,
  color: vec3f, ambient: vec3f, settings: vec3f, pixel: vec2f, lights: texture_2d<f32>) -> vec4f {
  let steps = u32(settings.x);
  let dt = distance / settings.x;
  let jitter = fract(52.9829189 * fract(dot(pixel, vec2f(0.06711056, 0.00583715))));
  var sum = vec3f(0);
  var transmission = 1.0;
  for (var i = 0u; i < steps; i++) {
    if (transmission < 0.01) { break; }
    let p = origin + dir * ((f32(i) + jitter) * dt);
    var density = fog.x * exp(-max(0.0, p.y - fog.z) * fog.w);
    if (noise.x > 0.0) {
      let q = (p + wind) / noise.y;
      let n = 0.65 * lfVolumeNoise(q) + 0.35 * lfVolumeNoise(q * 2.03 + 7.1);
      density *= clamp(mix(1.0, n * 2.0, noise.x), 0.0, 3.0);
    }
    var lightSum = ambient;
    for (var j = 0i; j < i32(settings.y); j++) {
      let position = textureLoad(lights, vec2i(0, j), 0);
      let direction = textureLoad(lights, vec2i(1, j), 0);
      let radiance = textureLoad(lights, vec2i(2, j), 0);
      let cone = textureLoad(lights, vec2i(3, j), 0);
      var towards = direction.xyz;
      var attenuation = 1.0;
      if (position.w > 0.0) {
        let delta = position.xyz - p;
        let d = max(0.0001, length(delta));
        towards = delta / d;
        let cutoff = clamp(1.0 - pow(d / direction.w, 4.0), 0.0, 1.0);
        attenuation = cutoff * cutoff / pow(max(d, 0.5), radiance.w);
        if (position.w == 2.0) {
          attenuation *= smoothstep(cone.x, max(cone.x + 0.00001, cone.y), dot(towards, direction.xyz));
        }
      }
      let g2 = fog.y * fog.y;
      let phase = (1.0 - g2) / pow(max(0.001, 1.0 + g2 - 2.0 * fog.y * dot(dir, towards)), 1.5);
      lightSum += radiance.xyz * (attenuation * phase);
    }
    let loss = exp(-density * dt);
    sum += transmission * (1.0 - loss) * lightSum * color;
    transmission *= loss;
  }
  return vec4f(sum, transmission);
}
fn lfVolumeHash(p: vec3f) -> f32 {
  let q = fract(p * 0.3183099 + 0.1) * 17.0;
  return fract(q.x * q.y * q.z * (q.x + q.y + q.z));
}
fn lfVolumeNoise(p: vec3f) -> f32 {
  let b = floor(p);
  let f = smoothstep(vec3f(0), vec3f(1), fract(p));
  let a = mix(lfVolumeHash(b), lfVolumeHash(b + vec3f(1, 0, 0)), f.x);
  let c = mix(lfVolumeHash(b + vec3f(0, 1, 0)), lfVolumeHash(b + vec3f(1, 1, 0)), f.x);
  let d = mix(lfVolumeHash(b + vec3f(0, 0, 1)), lfVolumeHash(b + vec3f(1, 0, 1)), f.x);
  let e = mix(lfVolumeHash(b + vec3f(0, 1, 1)), lfVolumeHash(b + vec3f(1, 1, 1)), f.x);
  return mix(mix(a, c, f.y), mix(d, e, f.y), f.z);
}
`)

export class WebGpuVolumetric {
  constructor(camera, depth, source) {
    const inverseProjection = uniform(camera.projectionMatrixInverse)
    const cameraWorld = uniform(camera.matrixWorld)
    const fog = this.fog = uniform(new Vector4())
    const noise = this.noise = uniform(new Vector4())
    const wind = this.wind = uniform(new Vector3())
    const color = this.color = uniform(new Color())
    const ambient = this.ambient = uniform(new Color())
    const settings = this.settings = uniform(new Vector3())
    this.lights = new DataTexture(new Float32Array(MAX_LIGHTS * 16), 4, MAX_LIGHTS, RGBAFormat, FloatType)
    this.position = new Vector3()
    this.direction = new Vector3()
    this.config = null
    this.target = rtt(Fn(() => {
      const st = uv()
      const near = getViewPosition(st, 0, inverseProjection)
      const hit = getViewPosition(st, depth.sample(st).r, inverseProjection)
      const origin = cameraWorld.mul(vec4(near, 1)).xyz
      const delta = cameraWorld.mul(vec4(hit.sub(near), 0)).xyz
      const length = delta.length().max(0.00001)
      return scatter({ origin, dir: delta.div(length), distance: length.min(settings.z),
        fog, noise, wind, color, ambient, settings, pixel: st.mul(4096).floor(), lights: textureLoad(this.lights) })
    })())
    this.node = source.mul(this.target.a).add(this.target.rgb)
  }

  update(vp, now, scale) {
    if (vp._env !== this.env || !this.config) {
      this.env = vp._env
      this.config = normalizeVolumetric(vp._env)
    }
    const c = this.config, camera = vp.camera
    const data = this.lights.image.data
    const lights = []
    vp.scene.traverseVisible(light => {
      if (light.isLight && light.userData.rtVol && light.intensity > 0 && light.layers.test(camera.layers)) {
        light.getWorldPosition(this.position)
        lights.push({ light, distance: this.position.distanceToSquared(camera.position) })
      }
    })
    lights.sort((a, b) => a.distance - b.distance)
    const count = Math.min(MAX_LIGHTS, lights.length)
    for (let i = 0; i < count; i++) {
      const { light } = lights[i], info = light.userData.rtVol
      const kind = info.type === 'omni' ? 1 : info.type === 'spot' ? 2 : 0
      const pos = light.getWorldPosition(this.position)
      if (kind !== 1) light.target.getWorldPosition(this.direction).sub(pos).normalize()
      else this.direction.set(0, 0, 0)
      if (kind === 0 || kind === 2) this.direction.negate()
      const { r, g, b } = light.color
      const e = light.intensity * info.intensity * c.volIntensity * 0.1 / Math.PI
      const cone = (info.spotAngle || 45) * Math.PI / 180
      data.set([pos.x, pos.y, pos.z, kind, this.direction.x, this.direction.y, this.direction.z, Math.max(1, info.range || 20),
        r * e, g * e, b * e, light.decay ?? 1, Math.cos(cone), Math.cos(cone * (1 - (info.penumbra ?? 1))), 0, 0], i * 16)
    }
    this.lights.needsUpdate = true
    this.fog.value.set(c.volDensity, c.volAniso, c.volHeight, c.volFalloff)
    this.noise.value.set(c.volNoise, c.volNoiseScale, 0, 0)
    this.color.value.set(c.volColor)
    this.ambient.value.set(vp._env.ambientColor || vp._env.skyHorizon)
      .multiplyScalar(c.volAmbient * Math.max(0.02, vp._env.ambient ?? 0.5) * 0.9)
    this.settings.value.set(vp.look.profile === 'alto' ? 40 : 24, count, c.volDistance)
    const dt = Math.min(0.1, Math.max(0, (now - (this.last ?? now)) / 1000))
    this.last = now
    const angle = vp._wf?.weatherOn ? Math.atan2(vp._wf.wind.z, vp._wf.wind.x) : 0.6
    const amount = dt * c.volNoiseSpeed
    this.wind.value.x += Math.cos(angle) * amount
    this.wind.value.y += 0.15 * amount
    this.wind.value.z += Math.sin(angle) * amount
    this.target.setResolutionScale(scale)
  }

  dispose() {
    this.lights.dispose()
    this.target.dispose()
  }
}
