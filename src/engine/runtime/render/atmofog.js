// Niebla atmosférica física (bloque D): pase de post-proceso, portada de FrostEnvironmentVolumetricFog.
//  1) profundidad lineal a resolución completa (copia propia: no se puede muestrear la textura de profundidad del buffer en el que se escribe)
//  2) niebla a media resolución: densidad exponencial con la altura integrada de forma analítica, humedad, ambiente + fase Henyey-Greenstein del sol
//  3) haces de sol a media resolución: 12 muestras radiales hacia el sol, solo donde el rayo atraviesa niebla
//  4) composición a resolución completa con remuestreo consciente de la profundidad (bilateral): imagen·T + niebla + haces
// Las fórmulas son las de world/fog.js (que los tests comparan con este shader). Norte −Z, este +X.
import * as THREE from 'three'
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'
import { FOG, resolveVolume, makeVolume, FRACTION_EPS } from '../world/fog.js'

const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }'

const COMMON = /* glsl */`
precision highp float;
uniform sampler2D tDepth;
uniform mat4 uInvVP;
uniform vec3 uCam, uFwd; uniform float uOrtho, uNear, uFar;
uniform vec4 uP0;   // extinción · caída · altura base · distancia máxima
uniform vec4 uP1;   // anisotropía · ambiente · inicio · dispersión solar
uniform vec3 uColor, uSunDir, uSunCol; uniform float uSunI;
uniform vec4 uVol;  // activo · intercambio
uniform vec3 uVolC, uVolHalf; uniform mat3 uVolM;
varying vec2 vUv;

vec3 unproj(vec2 uv, float z) { vec4 p = uInvVP * vec4(uv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0); return p.xyz / p.w; }
float eyeDepth(float z) { return uOrtho > 0.5 ? uNear + z * (uFar - uNear) : uNear * uFar / (uFar - z * (uFar - uNear)); }

// rayo del píxel: origen, dirección y distancia a la superficie (el cielo cuenta como la distancia máxima)
void pixelRay(vec2 uv, out vec3 ro, out vec3 rd, out float dist) {
  float z = texture2D(tDepth, uv).r;
  vec3 n = unproj(uv, 0.0), f = unproj(uv, z);
  ro = uOrtho > 0.5 ? n : uCam;
  vec3 d = f - ro; float L = length(d);
  rd = d / max(L, 1e-5);
  dist = min(L, uP0.w);
}

float volExit(vec3 ro, vec3 rd, float maxD) {
  if (uVol.x < 0.5) return 0.0;
  vec3 o = uVolM * (ro - uVolC);
  if (abs(o.x) > uVolHalf.x + 1e-4 || abs(o.y) > uVolHalf.y + 1e-4 || abs(o.z) > uVolHalf.z + 1e-4) return 0.0;
  vec3 d = uVolM * rd;
  d.x = abs(d.x) < 1e-6 ? (d.x < 0.0 ? -1e-6 : 1e-6) : d.x;
  d.y = abs(d.y) < 1e-6 ? (d.y < 0.0 ? -1e-6 : 1e-6) : d.y;
  d.z = abs(d.z) < 1e-6 ? (d.z < 0.0 ? -1e-6 : 1e-6) : d.z;
  vec3 t0 = (-uVolHalf - o) / d, t1 = (uVolHalf - o) / d;
  vec3 tf = max(t0, t1);
  return clamp(min(tf.x, min(tf.y, tf.z)), 0.0, maxD);
}
// donde empieza la niebla: salida del volumen × (1 − intercambio), y nunca antes de «Empieza a»
float fogStart(vec3 ro, vec3 rd, float dist) { return max(uP1.z, volExit(ro, rd, dist) * (1.0 - clamp(uVol.y, 0.0, 1.0))); }

float hDens(float y) { return exp(-max(0.0, y - uP0.z) * uP0.y); }
float decayFrac(float x) { return abs(x) < ${FRACTION_EPS.toFixed(4)} ? 1.0 - x * 0.5 + x * x / 6.0 - x * x * x / 24.0 : (1.0 - exp(-x)) / x; }
float above(float y0, float ry, float len) { return len <= 1e-4 ? 0.0 : hDens(y0) * len * decayFrac(uP0.y * ry * len); }
float integHeight(float oy, float ry, float start, float len) {
  if (len <= 1e-4) return 0.0;
  float base = uP0.z, sy = oy + ry * start, ey = sy + ry * len;
  if (sy <= base && ey <= base) return len;
  if (sy > base && ey > base) return above(sy, ry, len);
  if (abs(ry) <= 1e-5) return hDens(sy) * len;
  float cr = clamp((base - sy) / ry, 0.0, len);
  if (sy <= base) return cr + above(base, ry, len - cr);
  return above(sy, ry, cr) + (len - cr);
}
float hg(float c) {
  float g = clamp(uP1.x, 0.0, 1.0), g2 = g * g;
  return min(${FOG.HG_MAX.toFixed(1)}, (1.0 - g2) / pow(max(0.025, 1.0 + g2 - 2.0 * g * c), 1.5) * ${FOG.HG_NORM.toFixed(2)});
}
`

const DEPTH_FRAG = /* glsl */`
precision highp float;
uniform sampler2D tDepth; uniform float uOrtho, uNear, uFar; varying vec2 vUv;
void main() { float z = texture2D(tDepth, vUv).r; float e = uOrtho > 0.5 ? uNear + z * (uFar - uNear) : uNear * uFar / (uFar - z * (uFar - uNear)); gl_FragColor = vec4(e, 0.0, 0.0, 1.0); }`

const FOG_FRAG = COMMON + /* glsl */`
void main() {
  vec3 ro, rd; float dist; pixelRay(vUv, ro, rd, dist);
  float st = fogStart(ro, rd, dist), len = max(0.0, dist - st);
  if (len <= 1e-4) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  float phase = hg(dot(rd, normalize(uSunDir)));
  float tau = max(0.0, uP0.x * integHeight(ro.y, rd.y, st, len));
  float T = exp(-tau), s = 1.0 - T;
  float mean = tau > 1e-4 ? s / tau : 1.0;
  float resp = mix(${FOG.DEPTH_RESPONSE_MIN.toFixed(2)}, 1.0, sqrt(clamp(mean, 0.0, 1.0)));
  vec3 sc = s * (uColor * uP1.y + uSunCol * max(0.0, uSunI) * phase * resp * uP1.w);
  gl_FragColor = vec4(clamp(sc, 0.0, 1.0), clamp(T, 0.0, 1.0));
}`

const SHAFT_FRAG = COMMON + /* glsl */`
uniform vec4 uSun;   // xy: fuente en pantalla · z: densidad relativa (0–1) · w: fuerza
uniform float uShaftMul;
uniform sampler2D tSky;
uniform bool uCloudShaftMask;
void main() {
  float strength = uSun.w;
  if (strength <= 1e-4) { gl_FragColor = vec4(0.0); return; }
  vec3 ro, rd; float dist; pixelRay(vUv, ro, rd, dist);
  if (dist <= 1e-4) { gl_FragColor = vec4(0.0); return; }
  float frac = clamp((dist - fogStart(ro, rd, dist)) / max(1e-4, dist), 0.0, 1.0);
  if (frac <= 1e-4) { gl_FragColor = vec4(0.0); return; }
  vec2 delta = (uSun.xy - vUv) / ${FOG.SHAFT_SAMPLES.toFixed(1)};
  vec2 suv = vUv; float vis = 0.0, decay = 1.0;
  for (int i = 0; i < ${FOG.SHAFT_SAMPLES}; i++) {
    suv = clamp(suv + delta, 0.0, 1.0);
    float e = eyeDepth(texture2D(tDepth, suv).r);
    float openSky = clamp((e - uFar * 0.985) / max(0.5, uFar * 0.015), 0.0, 1.0);
    // La radiancia del mismo cielo antes de la niebla conserva los huecos entre nubes.
    if (uCloudShaftMask && openSky > 0.0) {
      float radiance = dot(texture2D(tSky, suv).rgb, vec3(0.2126, 0.7152, 0.0722));
      float peak = mix(0.055, 0.5, smoothstep(0.04, 0.35, uSunI));
      openSky *= smoothstep(peak * 0.12, peak, radiance);
    }
    vis += openSky * decay;
    decay *= ${FOG.SHAFT_DECAY.toFixed(2)};
  }
  vis = clamp(vis / ${FOG.SHAFT_NORM.toFixed(1)}, 0.0, 1.0);
  float radial = clamp(1.0 - length(vUv - uSun.xy) * 0.72, 0.0, 1.0);
  float shaft = vis * radial * strength * frac * uSun.z * uShaftMul;
  gl_FragColor = vec4(uSunCol * shaft, shaft);
}`

const COMP_FRAG = /* glsl */`
precision highp float;
uniform sampler2D tDiffuse, tFog, tShaft, tLin; uniform vec2 uHalfTexel; varying vec2 vUv;
float w(float cd, float sd) { return 1.0 / (1.0 + abs(sd - cd) / max(1.0, cd) * 48.0); }
void main() {
  vec4 src = texture2D(tDiffuse, vUv);
  float cd = texture2D(tLin, vUv).r;
  vec2 h = uHalfTexel * 0.5;
  vec2 u0 = clamp(vUv + vec2(-h.x, -h.y), 0.0, 1.0), u1 = clamp(vUv + vec2(h.x, -h.y), 0.0, 1.0), u2 = clamp(vUv + vec2(-h.x, h.y), 0.0, 1.0), u3 = clamp(vUv + vec2(h.x, h.y), 0.0, 1.0);
  float w0 = w(cd, texture2D(tLin, u0).r), w1 = w(cd, texture2D(tLin, u1).r), w2 = w(cd, texture2D(tLin, u2).r), w3 = w(cd, texture2D(tLin, u3).r);
  vec4 fog = (texture2D(tFog, u0) * w0 + texture2D(tFog, u1) * w1 + texture2D(tFog, u2) * w2 + texture2D(tFog, u3) * w3) / max(1e-4, w0 + w1 + w2 + w3);
  vec3 sh = texture2D(tShaft, vUv).rgb;
  gl_FragColor = vec4(src.rgb * clamp(fog.a, 0.0, 1.0) + fog.rgb + sh, src.a);
}`

const rt = (type = THREE.HalfFloatType, format = THREE.RGBAFormat) => new THREE.WebGLRenderTarget(1, 1, { type, format, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false })

export class AtmosphericFogPass extends Pass {
  constructor(look) {
    super()
    this.look = look
    this.needsSwap = true
    this.lin = rt(THREE.HalfFloatType, THREE.RedFormat); this.lin.texture.minFilter = this.lin.texture.magFilter = THREE.NearestFilter
    this.fog = rt(); this.shaft = rt()
    const U = (v) => ({ value: v })
    const common = () => ({
      tDepth: U(null), uInvVP: U(new THREE.Matrix4()), uCam: U(new THREE.Vector3()), uFwd: U(new THREE.Vector3(0, 0, -1)), uOrtho: U(0), uNear: U(0.1), uFar: U(1000),
      uP0: U(new THREE.Vector4()), uP1: U(new THREE.Vector4()), uColor: U(new THREE.Color()), uSunDir: U(new THREE.Vector3(0, 1, 0)), uSunCol: U(new THREE.Color()), uSunI: U(0),
      uVol: U(new THREE.Vector4()), uVolC: U(new THREE.Vector3()), uVolHalf: U(new THREE.Vector3(1, 1, 1)), uVolM: U(new THREE.Matrix3()),
    })
    const mk = (uniforms, frag) => new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: frag, depthTest: false, depthWrite: false })
    this.fogMat = mk(common(), FOG_FRAG)
    this.shaftMat = mk({ ...common(), uSun: U(new THREE.Vector4()), uShaftMul: U(1), tSky: U(null), uCloudShaftMask: U(false) }, SHAFT_FRAG)
    this.depthMat = mk({ tDepth: U(null), uOrtho: U(0), uNear: U(0.1), uFar: U(1000) }, DEPTH_FRAG)
    this.compMat = mk({ tDiffuse: U(null), tFog: U(this.fog.texture), tShaft: U(this.shaft.texture), tLin: U(this.lin.texture), uHalfTexel: U(new THREE.Vector2()) }, COMP_FRAG)
    this.quad = new FullScreenQuad(this.fogMat)
    this._size = ''
    this._inv = new THREE.Matrix4(); this._v = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3()
    this.state = { volume: null, shaft: 0 } // lo último resuelto: lo leen los tests y el panel de diagnóstico
  }

  _resize(w, h) {
    const key = w + 'x' + h
    if (key === this._size) return
    this._size = key
    this.lin.setSize(w, h)
    const hw = Math.max(1, Math.round(w / 2)), hh = Math.max(1, Math.round(h / 2))
    this.fog.setSize(hw, hh); this.shaft.setSize(hw, hh)
    this.compMat.uniforms.uHalfTexel.value.set(1 / hw, 1 / hh)
  }

  /** Volumen atmosférico que contiene la cámara (el más pequeño), a partir de los nodos registrados. */
  _volume(camPos) {
    const list = this.look.vp.atmoVolumes?.() || []
    return resolveVolume(list, [camPos.x, camPos.y, camPos.z])
  }

  render(renderer, writeBuffer, readBuffer) {
    const look = this.look, vp = look.vp, camera = vp.camera, S = vp._fogState, depth = look.depthTex
    if (!S || !S.physical || !depth) { this._copy(renderer, writeBuffer, readBuffer); return }
    this._resize(readBuffer.width, readBuffer.height)
    camera.updateMatrixWorld()
    const ortho = camera.isOrthographicCamera ? 1 : 0
    const P = S.params, vol = this._volume(this._v.setFromMatrixPosition(camera.matrixWorld))
    this.state.volume = vol
    const far = Math.max(1, camera.far), near = Math.max(0.001, camera.near)
    const maxD = Math.min(P.maxDistance, Math.max(1, far * 0.98))
    const camPos = this._v.setFromMatrixPosition(camera.matrixWorld).clone()
    const fwd = new THREE.Vector3(0, 0, -1).transformDirection(camera.matrixWorld)
    this._inv.copy(camera.projectionMatrix).multiply(camera.matrixWorldInverse).invert()

    const set = (m) => {
      const u = m.uniforms
      u.tDepth.value = depth; u.uInvVP.value.copy(this._inv); u.uCam.value.copy(camPos); u.uFwd.value.copy(fwd)
      u.uOrtho.value = ortho; u.uNear.value = near; u.uFar.value = far
      u.uP0.value.set(P.extinction, P.falloff, P.baseHeight, maxD)
      u.uP1.value.set(P.anisotropy, P.ambient, P.start, P.scatter)
      u.uColor.value.copy(S.color); u.uSunDir.value.set(S.sunDir[0], S.sunDir[1], S.sunDir[2]); u.uSunCol.value.setRGB(S.sunColor[0], S.sunColor[1], S.sunColor[2]); u.uSunI.value = S.sunIntensity
      if (vol) {
        u.uVol.value.set(1, vol.exchange, 0, 0); u.uVolC.value.set(vol.position[0], vol.position[1], vol.position[2]); u.uVolHalf.value.set(vol.half[0], vol.half[1], vol.half[2]); u.uVolM.value.set(...vol.m)
      } else u.uVol.value.set(0, 1, 0, 0)
    }
    const prevRT = renderer.getRenderTarget()
    // 1) profundidad lineal
    const d = this.depthMat.uniforms; d.tDepth.value = depth; d.uOrtho.value = ortho; d.uNear.value = near; d.uFar.value = far
    this.quad.material = this.depthMat; renderer.setRenderTarget(this.lin); this.quad.render(renderer)
    // 2) niebla (media resolución)
    set(this.fogMat); this.quad.material = this.fogMat; renderer.setRenderTarget(this.fog); this.quad.render(renderer)
    // 3) haces de la fuente celeste dominante
    const sun = new THREE.Vector3(S.sunDir[0], S.sunDir[1], S.sunDir[2]).normalize()
    const inFront = sun.dot(fwd) > 0
    const ndc = camPos.clone().addScaledVector(sun, Math.max(1000, far)).project(camera)
    const inView = inFront && ndc.x > -0.7 && ndc.x < 0.7 && ndc.y > -0.7 && ndc.y < 0.7 // = uv −0,35…1,35
    const strength = S.shafts > 0 ? Math.min(1, S.shaftStrength(inView)) : 0
    this.state.shaft = strength
    const su = this.shaftMat.uniforms
    set(this.shaftMat)
    su.tSky.value = readBuffer.texture; su.uCloudShaftMask.value = !!S.cloudShaftMask
    su.uSun.value.set(ndc.x * 0.5 + 0.5, ndc.y * 0.5 + 0.5, Math.min(1, Math.max(0, P.density / FOG.REF_DENSITY)), strength); su.uShaftMul.value = S.shafts
    this.quad.material = this.shaftMat; renderer.setRenderTarget(this.shaft); this.quad.render(renderer)
    // 4) composición
    this.compMat.uniforms.tDiffuse.value = readBuffer.texture
    this.quad.material = this.compMat
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.quad.render(renderer)
    void prevRT
  }

  _copy(renderer, writeBuffer, readBuffer) {
    // sin estado o sin profundidad: la imagen pasa tal cual (T = 1, sin luz añadida)
    renderer.setRenderTarget(this.fog); renderer.setClearColor(0x000000, 1); renderer.clear()
    renderer.setRenderTarget(this.shaft); renderer.clear()
    this.compMat.uniforms.tDiffuse.value = readBuffer.texture
    this.quad.material = this.compMat
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.quad.render(renderer)
  }

  dispose() { for (const r of [this.lin, this.fog, this.shaft]) r.dispose(); for (const m of [this.fogMat, this.shaftMat, this.depthMat, this.compMat]) m.dispose(); this.quad.dispose() }
}

export { makeVolume }
