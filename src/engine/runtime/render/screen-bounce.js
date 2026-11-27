// Rebotes difusos y reflejos híbridos en HDR, con respaldo del BVH de la escena.
import * as THREE from 'three'
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js'
import { RAY_LIGHTS, WORLD_RAY_GLSL } from './world-ray-shader.js'

const vertexShader = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }'
const depthHelpers = /* glsl */`
  uniform sampler2D tDepth;
  uniform mat4 uInvProjection;
  vec3 viewPosition(vec2 uv, float depth) {
    vec4 p = uInvProjection * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
    return p.xyz / p.w;
  }
`

const trace = /* glsl */`
  varying vec2 vUv;
  uniform sampler2D tColor;
  uniform mat4 uProjection;
  uniform vec2 uTexel;
  uniform float uDistance, uDiffuse, uSpecular, uSpecularDistance;
  uniform int uBounceCount;
  uniform bool uOrtho;
  ${depthHelpers}
  ${WORLD_RAY_GLSL}

  vec3 neighbor(vec2 uv) {
    vec2 p = clamp(uv, uTexel * 0.5, 1.0 - uTexel * 0.5);
    return viewPosition(p, texture2D(tDepth, p).r);
  }

  // El gradiente del lado más cercano en profundidad reduce el ruido en las siluetas.
  vec3 normalAt(vec2 uv, vec3 p) {
    vec3 l = p - neighbor(uv - vec2(uTexel.x, 0.0));
    vec3 r = neighbor(uv + vec2(uTexel.x, 0.0)) - p;
    vec3 b = p - neighbor(uv - vec2(0.0, uTexel.y));
    vec3 t = neighbor(uv + vec2(0.0, uTexel.y)) - p;
    vec3 n = cross(abs(l.z) < abs(r.z) ? l : r, abs(b.z) < abs(t.z) ? b : t);
    return n * inversesqrt(max(dot(n, n), 1e-16));
  }

  vec4 traceRay(vec3 origin, vec3 dir, float start, float range, bool glossy) {
    float previous = 0.0;
    for (int step = 1; step <= 8; step++) {
      float fraction = float(step) / 8.0;
      float distance = mix(start, range, fraction * fraction);
      vec3 p = origin + dir * distance;
      vec4 clip = uProjection * vec4(p, 1.0);
      if (clip.w <= 0.0) break;
      vec2 uv = clip.xy / clip.w * 0.5 + 0.5;
      if (any(lessThanEqual(uv, vec2(0.0))) || any(greaterThanEqual(uv, vec2(1.0)))) break;

      float depth = texture2D(tDepth, uv).r;
      if (depth >= 1.0) { previous = 0.0; continue; }
      vec3 surface = viewPosition(uv, depth);
      float delta = surface.z - p.z;
      if (delta > 0.0 && previous <= 0.0) {
        if (delta > max(0.03, range * 0.10)) break;
        float facing = glossy ? 1.0 : max(0.0, dot(normalAt(uv, surface), -dir));
        float fade = glossy ? smoothstep(0.0, range * 0.2, range - distance) : 1.0 - distance / range;
        float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
        float border = smoothstep(0.0, 0.035, edge);
        return vec4(min(texture2D(tColor, uv).rgb, vec3(8.0)) * facing * fade * fade * border, border);
      }
      previous = delta;
    }
    return vec4(0.0);
  }

  #ifdef LF_WORLD_TRACE
  vec3 reflectedLight(vec3 origin, vec3 direction, float bias, float roughness) {
    vec3 tangent = normalize(cross(direction, abs(direction.z) < 0.9 ? vec3(0,0,1) : vec3(0,1,0)));
    vec3 bitangent = cross(direction, tangent);
    vec3 reflected = vec3(0.0);
    int samples = roughness < 0.12 ? 1 : 3;
    for (int i = 0; i < 3; i++) {
      if (i >= samples) break;
      float angle = float(i) * 2.0943951;
      vec3 radial = tangent * cos(angle) + bitangent * sin(angle);
      vec3 dir = normalize(direction + radial * (roughness * roughness * 0.45));
      vec4 screen = traceRay(origin, dir, bias, uSpecularDistance, true);
      reflected += screen.rgb;
      if (screen.a < 0.999) reflected += (1.0 - screen.a) *
        traceWorld(origin, dir, uSpecularDistance, 1, 0.0, true);
    }
    return reflected / float(samples);
  }
  #endif

  void main() {
    float depth = texture2D(tDepth, vUv).r;
    if (depth >= 1.0) { gl_FragColor = vec4(0.0); return; }
    vec3 p = viewPosition(vUv, depth);
    vec3 n = normalAt(vUv, p);
    vec3 tangent = normalize(cross(n, abs(n.z) < 0.95 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0)) + vec3(1e-8));
    vec3 bitangent = cross(n, tangent);
    float bias = min(uDistance * 0.06, max(0.01, abs(p.z) * uTexel.y));
    vec3 light = vec3(0.0);
    if (uDiffuse > 0.0) for (int ray = 0; ray < 4; ray++) {
      float angle = float(ray) * 1.5707963 + 0.7853982;
      vec3 dir = normalize(n * 0.55 + tangent * cos(angle) + bitangent * sin(angle));
      vec3 origin = p + n * bias * 2.0;
      vec4 traced = traceRay(origin, dir, bias, uDistance, false);
      light += traced.rgb;
      #ifdef LF_WORLD_TRACE
        if (uBounceCount > 0 && traced.a < 0.999) light += traceWorld(origin, dir, uDistance, uBounceCount, (float(ray) + 0.5) * 0.25, false) * (1.0 - traced.a);
      #endif
    }
    light *= 0.25 * uDiffuse;
    #ifdef LF_WORLD_TRACE
    if (uSpecular > 0.0) {
      vec3 incident = uOrtho ? vec3(0.0, 0.0, -1.0) : normalize(p);
      vec4 surface = receiverSurface(p, incident);
      if (surface.a < 0.85 && max(max(surface.r, surface.g), surface.b) > 0.001) {
        vec3 dir = normalize(reflect(incident, n));
        vec3 origin = p + n * bias * 2.0;
        vec3 reflected = reflectedLight(origin, dir, bias, surface.a);
        float facing = clamp(dot(n, -incident), 0.0, 1.0);
        vec3 fresnel = mix(surface.rgb, vec3(1.0), pow(1.0 - facing, 5.0));
        light += reflected * fresnel * pow(1.0 - surface.a, 2.0) * uSpecular;
      }
    }
    #endif
    gl_FragColor = vec4(light, min(-p.z, 65000.0));
  }
`

const compose = /* glsl */`
  varying vec2 vUv;
  uniform sampler2D tColor, tBounce;
  uniform vec2 uBounceSize;
  uniform float uStrength;
  ${depthHelpers}

  void main() {
    vec4 base = texture2D(tColor, vUv);
    float depth = texture2D(tDepth, vUv).r;
    if (depth >= 1.0 || uStrength <= 0.0) { gl_FragColor = base; return; }
    float z = viewPosition(vUv, depth).z;
    vec2 pixel = vUv * uBounceSize - 0.5;
    vec2 cell = floor(pixel), phase = fract(pixel);
    vec3 light = vec3(0.0);
    float sum = 0.0;
    for (int y = 0; y <= 1; y++) {
      for (int x = 0; x <= 1; x++) {
        vec2 offset = vec2(float(x), float(y));
        vec2 uv = (clamp(cell + offset, vec2(0.0), uBounceSize - 1.0) + 0.5) / uBounceSize;
        vec4 sampleColor = texture2D(tBounce, uv);
        if (sampleColor.a <= 0.0) continue;
        float dz = abs(sampleColor.a + z);
        vec2 weight = mix(1.0 - phase, phase, offset);
        float w = weight.x * weight.y * exp(-dz / max(0.05, abs(z) * 0.025));
        light += sampleColor.rgb * w;
        sum += w;
      }
    }
    gl_FragColor = vec4(base.rgb + light * (uStrength / max(sum, 0.25)), base.a);
  }
`

export class ScreenBouncePass extends Pass {
  constructor(look) {
    super()
    this.look = look
    this.lightPosition = new THREE.Vector3()
    this.targetPosition = new THREE.Vector3()
    this.worldTrace = false
    // La textura también guarda la profundidad de cada muestra para la ampliación.
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    })
    const material = (fragmentShader, uniforms) => new THREE.ShaderMaterial({
      uniforms, vertexShader, fragmentShader, depthTest: false, depthWrite: false, toneMapped: false,
    })
    const input = { tColor: { value: null }, tDepth: { value: null }, uInvProjection: { value: new THREE.Matrix4() } }
    const lightArray = (Type) => ({ value: Array.from({ length: RAY_LIGHTS }, () => new Type()) })
    this.trace = material(trace, {
      ...input, uProjection: { value: new THREE.Matrix4() }, uTexel: { value: new THREE.Vector2() }, uDistance: { value: 0 },
      uWorldBvh: { value: null }, tWorldAlbedo: { value: null }, tWorldEmission: { value: null }, tWorldSurface: { value: null },
      uDiffuse: { value: 0 }, uSpecular: { value: 0 }, uSpecularDistance: { value: 30 },
      uOrtho: { value: false }, uBounceCount: { value: 1 },
      uCameraWorld: { value: new THREE.Matrix4() }, uWorldAmbient: { value: new THREE.Vector3() },
      uWorldLightCount: { value: 0 }, uWorldLightPos: lightArray(THREE.Vector4), uWorldLightDir: lightArray(THREE.Vector4),
      uWorldLightColor: lightArray(THREE.Vector4), uWorldLightCone: lightArray(THREE.Vector3),
    })
    this.compose = material(compose, {
      ...input, tBounce: { value: this.target.texture }, uBounceSize: { value: new THREE.Vector2() }, uStrength: { value: 0 },
    })
    this.quad = new FullScreenQuad(this.trace)
  }

  setSize(w, h) {
    const divisor = (this.look.cfg.worldRayBounce || this.look.cfg.worldRayReflection > 0) ? 3 : 2
    this.target.setSize(Math.max(1, Math.round(w / divisor)), Math.max(1, Math.round(h / divisor)))
    this.compose.uniforms.uBounceSize.value.set(this.target.width, this.target.height)
  }

  render(renderer, writeBuffer, readBuffer) {
    const { cfg, depthTex, vp } = this.look
    const { camera } = vp
    const u = this.trace.uniforms
    u.tColor.value = readBuffer.texture
    u.tDepth.value = depthTex
    u.uInvProjection.value.copy(camera.projectionMatrixInverse)
    u.uProjection.value.copy(camera.projectionMatrix)
    u.uTexel.value.set(1 / readBuffer.width, 1 / readBuffer.height)
    u.uDistance.value = cfg.bounceDistance
    const world = vp.worldRayScene?.active
    u.uDiffuse.value = cfg.screenBounce
    u.uSpecular.value = world ? cfg.worldRayReflection : 0
    u.uSpecularDistance.value = cfg.worldRayReflectionDistance
    u.uOrtho.value = !!camera.isOrthographicCamera
    u.uBounceCount.value = cfg.worldRayBounce ? cfg.worldRayBounceCount : 0
    this.compose.uniforms.uStrength.value = depthTex && (u.uDiffuse.value > 0 || u.uSpecular.value > 0) ? 1 : 0

    this._syncWorld(vp, camera, cfg.worldRayBounce || cfg.worldRayReflection > 0 ? world : null)
    if (depthTex) {
      this.quad.material = this.trace
      renderer.setRenderTarget(this.target)
      this.quad.render(renderer)
    }
    this.quad.material = this.compose
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer)
    this.quad.render(renderer)
  }

  _syncWorld(vp, camera, world) {
    if (!!world !== this.worldTrace) {
      this.worldTrace = !!world
      this.trace.defines = world ? { LF_WORLD_TRACE: 1 } : {}
      this.trace.needsUpdate = true
    }
    if (!world) return
    const u = this.trace.uniforms
    u.uWorldBvh.value = world.bvh
    u.tWorldAlbedo.value = world.albedo
    u.tWorldEmission.value = world.emission
    u.tWorldSurface.value = world.surface
    u.uCameraWorld.value.copy(camera.matrixWorld)
    const ambient = vp.hemi
    u.uWorldAmbient.value.set(ambient.color.r, ambient.color.g, ambient.color.b)
      .multiplyScalar(ambient.visible ? ambient.intensity : 0)
    let index = 0
    const add = (light) => {
      if (!light.visible || light.intensity <= 0 || !light.layers.test(camera.layers) || index >= RAY_LIGHTS) return
      const kind = light.isDirectionalLight ? 0 : light.isSpotLight ? 2 : light.isPointLight ? 1 : -1
      if (kind < 0) return
      light.getWorldPosition(this.lightPosition)
      u.uWorldLightPos.value[index].set(...this.lightPosition, kind)
      if (kind !== 1) {
        light.target.getWorldPosition(this.targetPosition)
        this.targetPosition.subVectors(this.lightPosition, this.targetPosition).normalize()
        u.uWorldLightDir.value[index].set(...this.targetPosition, light.distance ?? 0)
      } else {
        u.uWorldLightDir.value[index].set(0, 0, 0, light.distance)
      }
      const { r, g, b } = light.color
      u.uWorldLightColor.value[index].set(r * light.intensity, g * light.intensity, b * light.intensity, light.decay ?? 0)
      const cone = u.uWorldLightCone.value[index]
      cone.set(0, 0, light.castShadow ? 1 : 0)
      if (kind === 2) {
        cone.x = Math.cos(light.angle)
        cone.y = Math.cos(light.angle * (1 - light.penumbra))
      }
      index++
    }
    const key = vp.editorSun.visible ? vp.editorSun : vp.authoredSun?.()
    if (key) add(key)
    vp.scene.traverseVisible((object) => { if (object.isLight && object !== key) add(object) })
    u.uWorldLightCount.value = index
  }

  dispose() {
    this.target.dispose()
    this.trace.dispose()
    this.compose.dispose()
    this.quad.dispose()
  }
}
