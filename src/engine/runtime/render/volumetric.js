// Niebla y luz volumétrica: raymarching en pantalla (media resolución) con las luces de la escena marcadas como «volumétricas».
//  · Las luces de punto, focos y direccionales dispersan luz en el aire con fase Henyey–Greenstein (anisotropía ajustable).
//  · Sombras volumétricas: se dibuja la profundidad de la escena desde cada luz (máx. 4 con sombra) en un atlas R16F;
//    los puntos usan 6 caras, los focos una perspectiva y el sol una ortográfica centrada en la cámara.
//  · Las luces mixtas/estáticas guardan su mapa en caché y sólo lo recalculan cuando algo cambia (Viewport.invalidateShadows).
import * as THREE from 'three'
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'
import { normalizeVolumetric } from './lightlib.js'

const MAX_L = 6, MAX_SH = 4, ATLAS = 2048, Q = ATLAS / 2, FACE = Math.floor(Q / 3)

const OCC_VERT = /* glsl */`
varying vec3 vWP;
void main() {
  vec4 p = vec4(position, 1.0);
  #ifdef USE_INSTANCING
    p = instanceMatrix * p;
  #endif
  vec4 w = modelMatrix * p; vWP = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`
const OCC_FRAG = /* glsl */`
uniform vec3 uLP; uniform vec3 uDir; uniform float uMode; uniform float uScale; uniform vec3 uOrigin;
varying vec3 vWP;
void main() {
  float d = uMode < 0.5 ? length(vWP - uLP) : dot(vWP - uOrigin, uDir);
  gl_FragColor = vec4(d * uScale, 0.0, 0.0, 1.0);
}`

const FS_VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }'

const VOL_FRAG = /* glsl */`
precision highp float;
uniform sampler2D tDepth, tAtlas;
uniform mat4 uInvVP;
uniform float uDensity, uAniso, uDist, uHeight, uFalloff, uIntensity, uFrame, uNoise, uNoiseScale; uniform vec3 uColor, uAmbient, uNoiseOff;
uniform int uSteps, uNL;
uniform vec3 uLPos[${MAX_L}], uLDir[${MAX_L}], uLCol[${MAX_L}];
uniform vec4 uLInfo[${MAX_L}];     // x tipo (0 punto, 1 foco, 2 direccional) · y rango · z cos exterior · w cos interior
uniform vec4 uLSh[${MAX_L}];       // x ranura de sombra (-1 = sin sombra) · y escala (1/rango) · z sesgo · w exponente de atenuación
uniform vec3 uLOrigin[${MAX_L}];
uniform mat4 uShVP[${MAX_SH * 6}];
varying vec2 vUv;
const float PI = 3.141592653589793;

// ruido de valor 3D (sin texturas), dos octavas: la niebla se agrupa en bancos que el viento arrastra
float vh(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(vh(i), vh(i + vec3(1, 0, 0)), f.x), mix(vh(i + vec3(0, 1, 0)), vh(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(vh(i + vec3(0, 0, 1)), vh(i + vec3(1, 0, 1)), f.x), mix(vh(i + vec3(0, 1, 1)), vh(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fogNoise(vec3 p) { vec3 q = (p + uNoiseOff) / uNoiseScale; return 0.65 * vn(q) + 0.35 * vn(q * 2.03 + 7.1); }

vec3 unproj(vec2 uv, float z) { vec4 p = uInvVP * vec4(uv * 2.0 - 1.0, z * 2.0 - 1.0, 1.0); return p.xyz / p.w; }
float hg(float c, float g) { float g2 = g * g; return (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * c, 1.5); }   // ·4π: media = 1

float shadowVis(int j, vec3 p) {
  float slot = uLSh[j].x;
  if (slot < 0.0) return 1.0;
  int s = int(slot + 0.5);
  float type = uLInfo[j].x;
  vec2 origin = vec2(float(s - (s / 2) * 2), float(s / 2)) * 0.5;
  vec2 uv; float cur; int face = 0; float tsz = 0.5;
  if (type < 0.5) {
    vec3 d = p - uLPos[j]; vec3 a = abs(d);
    if (a.x >= a.y && a.x >= a.z) face = d.x > 0.0 ? 0 : 1; else if (a.y >= a.z) face = d.y > 0.0 ? 2 : 3; else face = d.z > 0.0 ? 4 : 5;
    cur = length(d) * uLSh[j].y;
    tsz = ${(FACE / ATLAS).toFixed(6)};
    origin += vec2(float(face - (face / 3) * 3), float(face / 3)) * tsz;
  } else {
    cur = type < 1.5 ? length(p - uLPos[j]) * uLSh[j].y : dot(p - uLOrigin[j], uLDir[j]) * uLSh[j].y;
  }
  vec4 c = uShVP[s * 6 + face] * vec4(p, 1.0);
  vec2 n = c.xy / c.w;
  if (type > 0.5 && (abs(n.x) > 1.0 || abs(n.y) > 1.0 || c.w < 0.0)) return type < 1.5 ? 0.0 : 1.0;
  uv = origin + clamp(n * 0.5 + 0.5, 0.004, 0.996) * tsz;
  float stored = texture2D(tAtlas, uv).r;
  return cur - uLSh[j].z * uLSh[j].y < stored ? 1.0 : 0.0;
}

void main() {
  float z = texture2D(tDepth, vUv).r;
  vec3 ro = unproj(vUv, 0.0);
  vec3 far = unproj(vUv, z < 1.0 ? z : 1.0);
  vec3 rd = normalize(far - ro);
  float L = min(length(far - ro), uDist);
  float dt = L / float(uSteps);
  float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy + uFrame * vec2(17.0, 31.0), vec2(0.06711056, 0.00583715))));
  vec3 acc = vec3(0.0); float T = 1.0;
  for (int i = 0; i < 64; i++) {
    if (i >= uSteps || T < 0.01) break;
    float t = (float(i) + jit) * dt;
    vec3 p = ro + rd * t;
    float sigma = uDensity * (uFalloff > 0.0 ? exp(-max(0.0, p.y - uHeight) * uFalloff) : 1.0);
    if (uNoise > 0.0) sigma *= clamp(mix(1.0, fogNoise(p) * 2.0, uNoise), 0.0, 3.0);
    vec3 Ls = uAmbient;
    for (int j = 0; j < ${MAX_L}; j++) {
      if (j >= uNL) break;
      float type = uLInfo[j].x;
      vec3 l; float att = 1.0;
      if (type > 1.5) l = -uLDir[j];
      else {
        vec3 tl = uLPos[j] - p; float d = length(tl); l = tl / max(d, 1e-4);
        float w = clamp(1.0 - pow(d / uLInfo[j].y, 4.0), 0.0, 1.0);
        att = w * w / pow(max(d, 0.5), uLSh[j].w);
        if (type > 0.5) att *= smoothstep(uLInfo[j].z, uLInfo[j].w, dot(-l, uLDir[j]));
      }
      if (att <= 0.0) continue;
      float vis = shadowVis(j, p);
      Ls += uLCol[j] * att * vis * hg(dot(rd, l), uAniso);
    }
    acc += T * sigma * dt * Ls * uColor * uIntensity;
    T *= exp(-sigma * dt);
  }
  gl_FragColor = vec4(acc, T);
}`

const COMP_FRAG = /* glsl */`
uniform sampler2D tDiffuse, tVol; uniform vec2 uTexel; varying vec2 vUv;
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  vec4 v = texture2D(tVol, vUv) * 0.4
    + 0.15 * (texture2D(tVol, vUv + vec2(uTexel.x, 0.0)) + texture2D(tVol, vUv - vec2(uTexel.x, 0.0)) + texture2D(tVol, vUv + vec2(0.0, uTexel.y)) + texture2D(tVol, vUv - vec2(0.0, uTexel.y)));
  gl_FragColor = vec4(c.rgb * v.a + v.rgb, c.a);
}`

export class VolumetricPass extends Pass {
  constructor(look) {
    super()
    this.look = look
    this.needsSwap = true
    this.vol = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false })
    this.atlas = new THREE.WebGLRenderTarget(ATLAS, ATLAS, { type: THREE.HalfFloatType, format: THREE.RedFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true })
    this.atlas.texture.generateMipmaps = false
    const u = {
      tDepth: { value: null }, tAtlas: { value: this.atlas.texture }, uInvVP: { value: new THREE.Matrix4() },
      uDensity: { value: 0.03 }, uAniso: { value: 0.6 }, uDist: { value: 60 }, uHeight: { value: 0 }, uFalloff: { value: 0 }, uIntensity: { value: 1 }, uFrame: { value: 0 }, uNoise: { value: 0 }, uNoiseScale: { value: 12 }, uNoiseOff: { value: new THREE.Vector3() },
      uColor: { value: new THREE.Color() }, uAmbient: { value: new THREE.Color() }, uSteps: { value: 24 }, uNL: { value: 0 },
      uLPos: { value: Array.from({ length: MAX_L }, () => new THREE.Vector3()) }, uLDir: { value: Array.from({ length: MAX_L }, () => new THREE.Vector3()) },
      uLCol: { value: Array.from({ length: MAX_L }, () => new THREE.Vector3()) }, uLInfo: { value: Array.from({ length: MAX_L }, () => new THREE.Vector4()) },
      uLSh: { value: Array.from({ length: MAX_L }, () => new THREE.Vector4(-1, 1, 0.1, 0)) }, uLOrigin: { value: Array.from({ length: MAX_L }, () => new THREE.Vector3()) },
      uShVP: { value: Array.from({ length: MAX_SH * 6 }, () => new THREE.Matrix4()) },
    }
    this.volMat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: FS_VERT, fragmentShader: VOL_FRAG, depthTest: false, depthWrite: false })
    this.compMat = new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, tVol: { value: this.vol.texture }, uTexel: { value: new THREE.Vector2() } }, vertexShader: FS_VERT, fragmentShader: COMP_FRAG, depthTest: false, depthWrite: false })
    this.quad = new FullScreenQuad(this.volMat)
    this.occMat = new THREE.ShaderMaterial({
      uniforms: { uLP: { value: new THREE.Vector3() }, uDir: { value: new THREE.Vector3() }, uOrigin: { value: new THREE.Vector3() }, uMode: { value: 0 }, uScale: { value: 1 } },
      vertexShader: OCC_VERT, fragmentShader: OCC_FRAG, side: THREE.DoubleSide,
    })
    this._neutral = new THREE.DataTexture(new Float32Array([0, 0, 0, 1]), 1, 1, THREE.RGBAFormat, THREE.FloatType); this._neutral.needsUpdate = true
    this.cams = Array.from({ length: 6 }, () => new THREE.PerspectiveCamera(90, 1, 0.1, 50))
    this.cache = new Map() // uuid de la luz → { sig, slot }
    this.frame = 0
    this.stats = { lights: 0, shadowRenders: 0 }
  }

  setSize(w, h) { this.vol.setSize(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2))); this.compMat.uniforms.uTexel.value.set(1 / this.vol.width, 1 / this.vol.height) }

  /** Luces volumétricas visibles, las más cercanas a la cámara primero. */
  _collect(camPos) {
    const out = []
    this.look.vp.scene.traverseVisible((o) => { if (o.isLight && o.userData.rtVol) out.push(o) })
    const d = (l) => l.getWorldPosition(new THREE.Vector3()).distanceToSquared(camPos)
    return out.sort((a, b) => d(a) - d(b)).slice(0, MAX_L)
  }

  /** Dibuja la profundidad de lo que proyecta sombra desde la luz en su cuadrante del atlas. */
  _renderShadow(renderer, light, slot, info, volDist, camera) {
    const vp = this.look.vp, u = this.occMat.uniforms
    const wp = light.getWorldPosition(new THREE.Vector3())
    const qx = (slot % 2) * Q, qy = Math.floor(slot / 2) * Q
    const range = Math.max(1, info.range || 20)
    const hide = []
    const skip = [vp.sky, vp.overlay, vp.grid]
    for (const o of skip) if (o && o.visible) { o.visible = false; hide.push(o) }
    vp.scene.traverse((o) => {
      if (!o.visible || o === vp.scene) return
      if (o.isLine || o.isPoints || o.isSprite) { o.visible = false; hide.push(o); return }
      if (o.isMesh) {
        const m = Array.isArray(o.material) ? o.material[0] : o.material
        if (!m || o.userData.helper || o.userData.isHelper || m.wireframe || (m.transparent && m.opacity < 1) || m.alphaTest > 0 || !o.castShadow) { o.visible = false; hide.push(o) }
      }
    })
    const prevSM = renderer.shadowMap.enabled, prevRT = renderer.getRenderTarget(), prevAuto = renderer.shadowMap.autoUpdate
    const prevClear = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha()
    renderer.shadowMap.enabled = false
    renderer.setClearColor(0xffffff, 1)
    vp.scene.overrideMaterial = this.occMat
    const draw = (cam, x, y, w, h) => {
      this.atlas.viewport.set(x, y, w, h); this.atlas.scissor.set(x, y, w, h); this.atlas.scissorTest = true
      renderer.setRenderTarget(this.atlas); renderer.clear(true, true, false)
      renderer.render(vp.scene, cam)
      this.stats.shadowRenders++
    }
    const mats = this.look.volVP
    if (info.type === 'omni') {
      u.uMode.value = 0; u.uLP.value.copy(wp); u.uScale.value = 1 / range
      const dirs = [[1, 0, 0, 0, 1, 0], [-1, 0, 0, 0, 1, 0], [0, 1, 0, 0, 0, -1], [0, -1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, -1, 0, 1, 0]]
      dirs.forEach((d, f) => {
        const c = this.cams[f]; c.near = 0.05; c.far = range; c.updateProjectionMatrix()
        c.position.copy(wp); c.up.set(d[3], d[4], d[5]); c.lookAt(wp.x + d[0], wp.y + d[1], wp.z + d[2]); c.updateMatrixWorld()
        draw(c, qx + (f % 3) * FACE, qy + Math.floor(f / 3) * FACE, FACE, FACE)
        mats[slot * 6 + f].multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse)
      })
    } else if (info.type === 'spot') {
      const c = this.cams[0], tg = light.target.getWorldPosition(new THREE.Vector3())
      c.fov = Math.min(170, info.spotAngle * 2 + 4); c.near = 0.1; c.far = range; c.updateProjectionMatrix()
      c.position.copy(wp); c.up.set(0, 1, 0)
      if (Math.abs(tg.clone().sub(wp).normalize().y) > 0.99) c.up.set(1, 0, 0)
      c.lookAt(tg); c.updateMatrixWorld()
      u.uMode.value = 0; u.uLP.value.copy(wp); u.uScale.value = 1 / range
      draw(c, qx, qy, Q, Q)
      mats[slot * 6].multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse)
    } else {
      const tg = light.target.getWorldPosition(new THREE.Vector3()), dir = tg.sub(wp).normalize()
      const E = Math.min(info.shadowDistance || 60, Math.max(10, volDist))
      const focus = camera.position.clone()
      const c = new THREE.OrthographicCamera(-E, E, E, -E, 0.1, E * 4)
      c.position.copy(focus).addScaledVector(dir, -E * 2); c.up.set(0, 1, 0)
      if (Math.abs(dir.y) > 0.99) c.up.set(1, 0, 0)
      c.lookAt(focus); c.updateMatrixWorld()
      u.uMode.value = 1; u.uDir.value.copy(dir); u.uOrigin.value.copy(c.position); u.uScale.value = 1 / (E * 4)
      draw(c, qx, qy, Q, Q)
      mats[slot * 6].multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse)
      info.sunOrigin = c.position.clone(); info.sunScale = 1 / (E * 4)
    }
    vp.scene.overrideMaterial = null
    for (const o of hide) o.visible = true
    this.atlas.scissorTest = false
    renderer.shadowMap.enabled = prevSM; renderer.shadowMap.autoUpdate = prevAuto
    renderer.setClearColor(prevClear, prevAlpha)
    renderer.setRenderTarget(prevRT)
  }

  render(renderer, writeBuffer, readBuffer) {
    const look = this.look, vp = look.vp, camera = vp.camera
    const cfg = normalizeVolumetric(vp._env), u = this.volMat.uniforms
    const depth = look.depthTex
    if (!depth) { this._copy(renderer, writeBuffer, readBuffer); return }
    this.frame++
    this.stats.shadowRenders = 0
    if (!look.volVP) look.volVP = Array.from({ length: MAX_SH * 6 }, () => new THREE.Matrix4())
    camera.updateMatrixWorld()
    const lights = this._collect(camera.position)
    const cached = (light) => this.cache.get(light.uuid)
    let slot = 0, n = 0
    const wp = new THREE.Vector3(), tg = new THREE.Vector3()
    for (const light of lights) {
      const info = light.userData.rtVol
      light.getWorldPosition(wp)
      const i = n++
      const type = info.type === 'omni' ? 0 : info.type === 'spot' ? 1 : 2
      const range = Math.max(1, info.range || 20)
      u.uLPos.value[i].copy(wp)
      if (type !== 0) { light.target.getWorldPosition(tg); u.uLDir.value[i].copy(tg.sub(wp).normalize()) }
      // energía = intensidad/π; el exponente de caída coincide con el de la luz
      const e = (light.intensity / Math.PI) * info.intensity * cfg.volIntensity * 0.1
      u.uLCol.value[i].set(light.color.r * e, light.color.g * e, light.color.b * e)
      const ang = (info.spotAngle || 45) * Math.PI / 180
      u.uLInfo.value[i].set(type, range, Math.cos(ang), Math.cos(ang * (1 - (info.penumbra ?? 1))))
      let sh = -1, bias = 0.1
      if (info.shadow && slot < MAX_SH) {
        sh = slot++
        const prev = cached(light)
        // mapa en caché para luces mixtas/estáticas; las dinámicas se recalculan en cada fotograma
        const key = wp.toArray().join() + '|' + (type ? light.target.getWorldPosition(new THREE.Vector3()).toArray().join() : '') + range + '|' + (type === 2 ? camera.position.toArray().map((x) => Math.round(x / 4)).join() : '')
        const need = !prev || prev.slot !== sh || prev.key !== key || (info.mode === 'dynamic' && this.frame % 6 === 0) || look.volDirty
        if (need) { vp.perf.time('Sombras niebla', () => this._renderShadow(renderer, light, sh, info, cfg.volDistance, camera)); this.cache.set(light.uuid, { slot: sh, key, sunOrigin: info.sunOrigin, sunScale: info.sunScale }) }
        else if (type === 2) { info.sunOrigin = prev.sunOrigin; info.sunScale = prev.sunScale }
        bias = 0.08 + range * 0.004
      }
      if (type === 2) { u.uLOrigin.value[i].copy(info.sunOrigin || camera.position); u.uLSh.value[i].set(sh, info.sunScale || 1 / 240, bias, 0) }
      else u.uLSh.value[i].set(sh, 1 / range, bias, light.decay ?? 1)
    }
    look.volDirty = false
    for (let k = 0; k < MAX_SH * 6; k++) u.uShVP.value[k].copy(look.volVP[k])
    u.uNL.value = n
    this.stats.lights = n

    u.tDepth.value = depth
    u.uInvVP.value.copy(camera.projectionMatrix).multiply(camera.matrixWorldInverse).invert()
    u.uDensity.value = cfg.volDensity; u.uAniso.value = cfg.volAniso; u.uDist.value = cfg.volDistance
    u.uHeight.value = cfg.volHeight; u.uFalloff.value = cfg.volFalloff; u.uIntensity.value = 1; u.uFrame.value = this.frame % 64
    // ruido animado: la deriva se integra aquí (el viento de la escena si hay clima, si no una brisa fija) para que un cambio de velocidad no haga saltar la niebla
    const now = performance.now() / 1000, dtn = Math.min(0.1, Math.max(0, now - (this._tn ?? now))); this._tn = now
    const wf = vp._wf, wa = wf?.weatherOn ? Math.atan2(wf.wind.z, wf.wind.x) : 0.6
    this._noiseOff ??= new THREE.Vector3()
    this._noiseOff.x += Math.cos(wa) * cfg.volNoiseSpeed * dtn; this._noiseOff.z += Math.sin(wa) * cfg.volNoiseSpeed * dtn; this._noiseOff.y += 0.15 * cfg.volNoiseSpeed * dtn
    u.uNoise.value = cfg.volNoise; u.uNoiseScale.value = cfg.volNoiseScale; u.uNoiseOff.value.copy(this._noiseOff)
    u.uColor.value.set(cfg.volColor)
    const amb = new THREE.Color(vp._env.ambientColor || vp._env.skyHorizon)
    u.uAmbient.value.copy(amb).multiplyScalar(cfg.volAmbient * Math.max(0.02, (vp._env.ambient ?? 0.5)) * 0.9)
    u.uSteps.value = look.profile === 'alto' ? 40 : 24

    this.quad.material = this.volMat
    renderer.setRenderTarget(this.vol); renderer.clear(true, false, false)
    this.quad.render(renderer)
    this.compMat.uniforms.tDiffuse.value = readBuffer.texture
    this.quad.material = this.compMat
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer)
    this.quad.render(renderer)
  }

  _copy(renderer, writeBuffer, readBuffer) {
    this.compMat.uniforms.tDiffuse.value = readBuffer.texture
    this.compMat.uniforms.tVol.value = this._neutral // sin profundidad no hay niebla: se copia la imagen tal cual
    this.quad.material = this.compMat
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer)
    this.quad.render(renderer)
    this.compMat.uniforms.tVol.value = this.vol.texture
  }

  dispose() { this.vol.dispose(); this.atlas.dispose(); this.volMat.dispose(); this.compMat.dispose(); this.occMat.dispose(); this.quad.dispose() }
}
