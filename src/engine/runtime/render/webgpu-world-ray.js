import { DataTexture, FloatType, RGBAFormat, RGIntegerFormat, UnsignedIntType, Vector3, Vector4 } from 'three'
import { Fn, If, getViewPosition, uv as quadUv, textureLoad, uniform, vec3, vec4, wgslFn } from 'three/tsl'
import { RAY_LIGHTS } from './world-ray-shader.js'

const trace = wgslFn(/* wgsl */`
fn lfWorldRay(
  origin: vec3f, incident: vec3f, normal: vec3f, surface: vec4f, config: vec4f, specular: f32, ambient: vec3f,
  vertices: texture_2d<f32>, triangles: texture_2d<u32>, bounds: texture_2d<f32>, tree: texture_2d<u32>,
  albedo: texture_2d<f32>, emission: texture_2d<f32>, lights: texture_2d<f32>, jitter: f32
) -> vec3f {
  let p = origin + normal * 0.025;
  var lighting = vec3f(0);
  if (config.x > 0.0) {
    for (var i = 0u; i < 3u; i++) {
      let seed = fract((f32(i) + 0.5) / 3.0 + jitter);
      lighting += lfTrace(p, lfDiffuseRay(normal, seed), config.y, u32(config.z), seed, false, ambient,
        vertices, triangles, bounds, tree, albedo, emission, lights);
    }
    lighting *= config.x / 3.0;
  }
  if (specular > 0.0 && surface.x < 0.85) {
    let dir = reflect(incident, normal);
    let basis = normalize(cross(dir, select(vec3f(0, 1, 0), vec3f(0, 0, 1), abs(dir.z) < 0.9)));
    let width = surface.x * surface.x * 0.45;
    let count = select(3u, 1u, surface.x < 0.12);
    let facing = clamp(dot(normal, -incident), 0.0, 1.0);
    let fresnel = mix(surface.yzw, vec3f(1), pow(1.0 - facing, 5.0));
    var reflected = vec3f(0);
    for (var i = 0u; i < count; i++) {
      let a = f32(i) * 2.0943951;
      let ray = normalize(dir + width * (basis * cos(a) + cross(dir, basis) * sin(a)));
      reflected += lfTrace(p, ray, config.w, 1u, 0.0, true, ambient, vertices, triangles, bounds, tree, albedo, emission, lights);
    }
    lighting += reflected * fresnel * pow(1.0 - surface.x, 2.0) * specular / f32(count);
  }
  return lighting;
}

struct LfHit {
  dist: f32, normal: vec3f, bary: vec3f, face: vec3u, side: f32, found: bool,
}
fn lfCoord(index: u32, width: u32) -> vec2i {
  return vec2i(i32(index % width), i32(index / width));
}
fn lfFloat(tex: texture_2d<f32>, index: u32) -> vec4f {
  return textureLoad(tex, lfCoord(index, textureDimensions(tex).x), 0);
}
fn lfUint(tex: texture_2d<u32>, index: u32) -> vec4u {
  return textureLoad(tex, lfCoord(index, textureDimensions(tex).x), 0);
}
fn lfSurface(tex: texture_2d<f32>, hit: LfHit) -> vec4f {
  return lfFloat(tex, hit.face.x) * hit.bary.x + lfFloat(tex, hit.face.y) * hit.bary.y + lfFloat(tex, hit.face.z) * hit.bary.z;
}
fn lfFirstHit(p: vec3f, dir: vec3f, distance: f32, vertices: texture_2d<f32>, triangles: texture_2d<u32>,
  bounds: texture_2d<f32>, tree: texture_2d<u32>) -> LfHit {
  var result = LfHit(distance, vec3f(0), vec3f(0), vec3u(0), 0.0, false);
  var stack: array<u32, 42>;
  var top = 1u;
  let invDir = (step(vec3f(0), dir) * 2.0 - 1.0) / max(abs(dir), vec3f(1e-8));
  stack[0] = 0u;
  while (top > 0u) {
    top -= 1u;
    let nodeIndex = stack[top];
    let toMin = (lfFloat(bounds, nodeIndex * 2u).xyz - p) * invDir;
    let toMax = (lfFloat(bounds, nodeIndex * 2u + 1u).xyz - p) * invDir;
    let lo = min(toMin, toMax);
    let hi = max(toMin, toMax);
    let enter = max(0.0, max(lo.x, max(lo.y, lo.z)));
    if (enter > min(hi.x, min(hi.y, hi.z)) || enter > result.dist) { continue; }
    let info = lfUint(tree, nodeIndex).xy;
    if ((info.x & 0xffff0000u) != 0u) {
      let end = info.y + (info.x & 0xffffu);
      for (var face = info.y; face < end; face++) {
        let ids = lfUint(triangles, face).xyz;
        let a = lfFloat(vertices, ids.x).xyz;
        let ab = lfFloat(vertices, ids.y).xyz - a;
        let ac = lfFloat(vertices, ids.z).xyz - a;
        let n = cross(ab, ac);
        let det = -dot(dir, n);
        if (abs(det) < 1e-8) { continue; }
        let originToA = p - a;
        let crossRay = cross(originToA, dir);
        let u = dot(ac, crossRay) / det;
        let v = -dot(ab, crossRay) / det;
        let distanceHit = dot(originToA, n) / det;
        let bary = vec3f(1.0 - u - v, u, v);
        if (all(bary >= vec3f(-1e-5)) && distanceHit > 0.0001 && distanceHit < result.dist) {
          result = LfHit(distanceHit, sign(det) * normalize(n), bary, ids, sign(det), true);
        }
      }
    } else {
      let left = nodeIndex + 1u;
      let right = info.y;
      let positive = dir[info.x & 0xffffu] >= 0.0;
      if (top + 1u >= 42u) { continue; }
      stack[top] = select(left, right, positive);
      stack[top + 1u] = select(right, left, positive);
      top += 2u;
    }
  }
  return result;
}
fn lfDirect(p: vec3f, normal: vec3f, ambient: vec3f, vertices: texture_2d<f32>, triangles: texture_2d<u32>,
  bounds: texture_2d<f32>, tree: texture_2d<u32>, lights: texture_2d<f32>) -> vec3f {
  var result = ambient;
  for (var i = 0; i < i32(textureDimensions(lights).y); i++) {
    let position = textureLoad(lights, vec2i(0, i), 0);
    if (position.w < 0.0) { break; }
    let direction = textureLoad(lights, vec2i(1, i), 0);
    let color = textureLoad(lights, vec2i(2, i), 0);
    let cone = textureLoad(lights, vec2i(3, i), 0);
    var dir = direction.xyz;
    var distance = 1e6;
    var attenuation = 1.0;
    if (position.w > 0.0) {
      let offset = position.xyz - p;
      distance = max(0.0001, length(offset));
      dir = offset / distance;
      let cutoff = select(1.0, clamp(1.0 - pow(distance / max(direction.w, 0.0001), 4.0), 0.0, 1.0), direction.w > 0.0);
      attenuation = cutoff * cutoff / max(pow(distance, color.w), 0.01);
      if (position.w == 2.0) { attenuation *= smoothstep(cone.x, max(cone.x + 0.00001, cone.y), dot(dir, direction.xyz)); }
    }
    let amount = max(0.0, dot(normal, dir)) * attenuation;
    if (amount <= 0.0001) { continue; }
    if (cone.z > 0.5 && lfFirstHit(p + normal * 0.012, dir, distance - 0.02, vertices, triangles, bounds, tree).found) { continue; }
    result += color.rgb * amount;
  }
  return result;
}
fn lfDiffuseRay(n: vec3f, seed: f32) -> vec3f {
  let tangent = normalize(cross(n, select(vec3f(1, 0, 0), vec3f(0, 1, 0), abs(n.y) < 0.9)));
  let phase = seed * 6.2831853;
  return normalize(0.72 * n + 0.69 * (tangent * cos(phase) + cross(n, tangent) * sin(phase)));
}
fn lfTrace(origin: vec3f, direction: vec3f, range: f32, count: u32, seed: f32, glossy: bool, ambient: vec3f,
  vertices: texture_2d<f32>, triangles: texture_2d<u32>, bounds: texture_2d<f32>, tree: texture_2d<u32>,
  albedo: texture_2d<f32>, emission: texture_2d<f32>, lights: texture_2d<f32>) -> vec3f {
  var p = origin;
  var dir = direction;
  var limit = range;
  var result = vec3f(0);
  var throughput = vec3f(1);
  for (var i = 0u; i < min(count, 3u); i++) {
    let hit = lfFirstHit(p, dir, limit, vertices, triangles, bounds, tree);
    if (!hit.found) { break; }
    let emitted = lfSurface(emission, hit);
    if (hit.side < 0.0 && emitted.a < 0.5) { break; }
    let base = lfSurface(albedo, hit).rgb;
    p += dir * hit.dist;
    limit -= hit.dist;
    let fade = select(limit / range, smoothstep(0.0, range * 0.2, limit), glossy);
    let indirect = emitted.rgb + base * lfDirect(p, hit.normal, ambient, vertices, triangles, bounds, tree, lights) * 0.31830989;
    result += throughput * min(indirect, vec3f(8)) * fade * fade;
    throughput *= base;
    if (max(throughput.r, max(throughput.g, throughput.b)) < 0.01) { break; }
    p += hit.normal * 0.015;
    dir = lfDiffuseRay(hit.normal, fract(seed + f32(i + 1u) * 0.61803399));
  }
  return result;
}
`)

const inputs = {
  vertices: world => world.bvh.position,
  triangles: world => world.bvh.index,
  bounds: world => world.bvh.bvhBounds,
  tree: world => world.bvh.bvhContents,
  albedo: world => world.albedo,
  emission: world => world.emission,
}

export class WebGpuWorldRay {
  constructor(camera, depth, normal, surface, diffuse, world, ssr) {
    this.config = uniform(new Vector4())
    this.ambient = uniform(new Vector3())
    this.specular = uniform(0)
    this.lightTexture = new DataTexture(new Float32Array(RAY_LIGHTS * 16), 4, RAY_LIGHTS, RGBAFormat, FloatType)
    this.lightPosition = new Vector3()
    this.targetPosition = new Vector3()
    this.textures = Object.fromEntries(Object.keys(inputs).map(key => [key, textureLoad()]))
    this.updateWorld(world)
    const invProjection = uniform(camera.projectionMatrixInverse), cameraWorld = uniform(camera.matrixWorld)
    this.node = Fn(() => {
      const z = depth.sample(quadUv()).r.toVar()
      const result = vec3(0).toVar()
      If(z.lessThan(1), () => {
        const view = getViewPosition(quadUv(), z, invProjection)
        const origin = cameraWorld.mul(vec4(view, 1)).xyz
        const viewIncident = camera.isOrthographicCamera ? vec3(0, 0, -1) : view.normalize()
        const incident = cameraWorld.mul(vec4(viewIncident, 0)).xyz
        const worldNormal = cameraWorld.mul(vec4(normal.sample(quadUv()).rgb.normalize(), 0)).xyz
        const props = surface.sample(quadUv())
        const f0 = vec3(0.04).mix(diffuse.sample(quadUv()).rgb, props.g)
        const material = vec4(props.r, f0)
        const jitter = quadUv().mul(4096).floor().dot(vec3(0.06711, 0.00584, 0).xy).fract()
        // El rayo de mundo completa el reflejo solo donde SSR no encontró una superficie.
        const specular = ssr ? ssr.a.greaterThan(0.0001).select(0, this.specular) : this.specular
        result.assign(trace({ origin, incident, normal: worldNormal, surface: material,
          config: this.config, specular, ambient: this.ambient, ...this.textures,
          lights: textureLoad(this.lightTexture), jitter }))
      })
      return result
    })()
  }

  updateWorld(world) {
    if (world === this.world) return
    for (const tex of this.nativeTextures || []) tex.dispose()
    this.nativeTextures = []
    this.world = world
    for (const [key, get] of Object.entries(inputs)) {
      const source = get(world)
      const { data, width, height } = source.image
      // El worker conserva sus formatos WebGL. WebGPU infiere los formatos a partir del tipo y los canales.
      const integer = key === 'triangles' || key === 'tree'
      const pixels = integer && !(data instanceof Uint32Array) ? Uint32Array.from(data) : data
      const copy = new DataTexture(pixels, width, height, source.format, integer ? UnsignedIntType : source.type)
      if (integer) copy.internalFormat = source.format === RGIntegerFormat ? 'rg32uint' : 'rgba32uint'
      copy.needsUpdate = true
      this.textures[key].value = copy
      this.nativeTextures.push(copy)
    }
  }

  update(vp) {
    const cfg = vp.look.cfg
    this.updateWorld(vp.worldRayScene.active)
    this.config.value.set(cfg.worldRayBounce ? cfg.screenBounce : 0, cfg.bounceDistance, cfg.worldRayBounceCount, cfg.worldRayReflectionDistance)
    this.specular.value = cfg.worldRayReflection
    const ambient = vp.hemi
    this.ambient.value.set(ambient.color.r, ambient.color.g, ambient.color.b).multiplyScalar(ambient.visible ? ambient.intensity : 0)
    const data = this.lightTexture.image.data
    let index = 0
    const add = light => {
      const kind = light.isDirectionalLight ? 0 : light.isSpotLight ? 2 : light.isPointLight ? 1 : -1
      if (kind < 0 || !light.visible || light.intensity <= 0 || !light.layers.test(vp.camera.layers) || index >= RAY_LIGHTS) return
      const offset = index++ * 16
      light.getWorldPosition(this.lightPosition).toArray(data, offset)
      data[offset + 3] = kind
      if (kind !== 1) {
        light.target.getWorldPosition(this.targetPosition)
        this.targetPosition.subVectors(this.lightPosition, this.targetPosition).normalize()
      } else this.targetPosition.set(0, 0, 0)
      this.targetPosition.toArray(data, offset + 4)
      data[offset + 7] = light.distance ?? 0
      const { r, g, b } = light.color, intensity = light.intensity
      data.set([r * intensity, g * intensity, b * intensity, light.decay ?? 0,
        kind === 2 ? Math.cos(light.angle) : 0, kind === 2 ? Math.cos(light.angle * (1 - light.penumbra)) : 0,
        light.castShadow ? 1 : 0, 0], offset + 8)
    }
    const key = vp.editorSun.visible ? vp.editorSun : vp.authoredSun?.()
    if (key) add(key)
    vp.scene.traverseVisible(object => { if (object.isLight && object !== key) add(object) })
    if (index < RAY_LIGHTS) data[index * 16 + 3] = -1
    this.lightTexture.needsUpdate = true
  }

  dispose() {
    for (const tex of this.nativeTextures) tex.dispose()
    this.lightTexture.dispose()
  }
}
