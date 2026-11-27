// Adaptación automática de exposición («ojo»): mide el brillo medio de la imagen y acerca la exposición a un brillo objetivo con el tiempo.
//
// Estudiado el enfoque de Beautify/Unity (eye adaptation) y escrito propio, sin lecturas a la CPU:
//  1. Un pase de 1×1 píxel muestrea la imagen (cuadrícula de 16×16) y promedia log2(luminancia): la media geométrica no se deja engañar por el Sol.
//  2. El valor adaptado (en pasos de exposición, EV) vive en una textura 1×1 en ping-pong y se acerca al objetivo con una exponencial:
//     sube más deprisa al entrar en un sitio oscuro o tarda más al salir al sol, según `speedUp` / `speedDown`.
//  3. Un segundo pase multiplica la imagen por 2^(EV·fuerza). Va ANTES del bloom y del tone mapping.
import * as THREE from 'three'
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'

const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }'

const MEASURE = /* glsl */`
  uniform sampler2D tScene, tPrev; uniform float uDt, uUp, uDown, uKey, uMin, uMax, uFirst; varying vec2 vUv;
  void main() {
    float sum = 0.0;
    for (int j = 0; j < 16; j++) for (int i = 0; i < 16; i++) {
      vec2 uv = (vec2(float(i), float(j)) + 0.5) / 16.0;
      uv = 0.5 + (uv - 0.5) * 0.9; // sin los bordes (viñeta, marcos)
      vec3 c = max(texture2D(tScene, uv).rgb, 0.0);
      sum += log2(max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-4));
    }
    float avg = exp2(sum / 256.0);
    float target = clamp(log2(uKey / max(avg, 1e-4)), uMin, uMax);
    float prev = uFirst > 0.5 ? target : texture2D(tPrev, vec2(0.5)).r;
    float rate = target > prev ? uUp : uDown;
    gl_FragColor = vec4(prev + (target - prev) * (1.0 - exp(-uDt * rate)), 0.0, 0.0, 1.0);
  }`

const APPLY = /* glsl */`
  uniform sampler2D tDiffuse, tEv; uniform float uAmount; varying vec2 vUv;
  void main() {
    vec4 c = texture2D(tDiffuse, vUv);
    gl_FragColor = vec4(c.rgb * exp2(texture2D(tEv, vec2(0.5)).r * uAmount), c.a);
  }`

export class AutoExposurePass extends Pass {
  constructor() {
    super()
    const o = { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false }
    this.rt = [new THREE.WebGLRenderTarget(1, 1, o), new THREE.WebGLRenderTarget(1, 1, o)]
    this.cur = 0
    this.first = true
    this.measure = new THREE.ShaderMaterial({
      uniforms: { tScene: { value: null }, tPrev: { value: null }, uDt: { value: 0.016 }, uUp: { value: 3 }, uDown: { value: 1 }, uKey: { value: 0.25 }, uMin: { value: -3 }, uMax: { value: 3 }, uFirst: { value: 1 } },
      vertexShader: VERT, fragmentShader: MEASURE, depthTest: false, depthWrite: false,
    })
    this.apply = new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, tEv: { value: null }, uAmount: { value: 1 } }, vertexShader: VERT, fragmentShader: APPLY, depthTest: false, depthWrite: false })
    this.quad = new FullScreenQuad(this.measure)
  }

  /** key = brillo objetivo (luminancia lineal); speedUp/speedDown = rapidez (1/s) al aclarar u oscurecer; minEv/maxEv = límites; amount = 0..1. */
  setParams({ key, speedUp, speedDown, minEv, maxEv, amount }) {
    const u = this.measure.uniforms
    u.uKey.value = key; u.uUp.value = speedUp; u.uDown.value = speedDown; u.uMin.value = minEv; u.uMax.value = maxEv
    this.apply.uniforms.uAmount.value = amount
  }
  /** Salta a la exposición correcta en el siguiente fotograma (cambio de escena, corte de cámara). */
  reset() { this.first = true }

  render(renderer, writeBuffer, readBuffer, deltaTime) {
    const prev = this.rt[this.cur], next = this.rt[1 - this.cur]
    const u = this.measure.uniforms
    u.tScene.value = readBuffer.texture; u.tPrev.value = prev.texture
    u.uDt.value = Math.min(0.25, Math.max(0, deltaTime || 0.016)); u.uFirst.value = this.first ? 1 : 0
    this.first = false
    this.quad.material = this.measure
    renderer.setRenderTarget(next); this.quad.render(renderer)
    this.cur = 1 - this.cur
    this.apply.uniforms.tDiffuse.value = readBuffer.texture; this.apply.uniforms.tEv.value = next.texture
    this.quad.material = this.apply
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer)
    if (this.clear) renderer.clear()
    this.quad.render(renderer)
  }

  dispose() { this.rt.forEach((r) => r.dispose()); this.measure.dispose(); this.apply.dispose(); this.quad.dispose() }
}
