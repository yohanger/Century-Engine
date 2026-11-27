// Profundidad de campo: desenfoca lo que queda lejos del plano de enfoque (lente de cámara).
//
// Estudiado el enfoque de Beautify/Unity (círculo de confusión sacado de la profundidad + desenfoque en disco) y escrito propio:
//  - La profundidad de la escena (textura de profundidad del render, ya linealizada aquí) da, por píxel, el círculo de confusión:
//    0 dentro de la zona nítida (`range`) y creciendo hacia el máximo (`blur`, en píxeles a 1080p) cuanto más lejos del plano `focus`.
//  - Desenfoque: 32 lecturas en espiral áurea. Cada lectura solo aporta si SU círculo la alcanza (así lo nítido de delante no se «sangra»
//    sobre el fondo borroso y no hay halos oscuros), y el centro siempre cuenta.
//  - Enfoque automático (`dofAuto`): lo gobierna el modo Jugar con un rayo al centro de la pantalla, suavizado en el tiempo.
import * as THREE from 'three'
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'

const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }'
const FRAG = /* glsl */`
  uniform sampler2D tDiffuse, tDepth; uniform float uNear, uFar, uFocus, uRange, uMaxR, uAspect; uniform vec2 uTexel; varying vec2 vUv;
  float linZ(vec2 uv) { float z = texture2D(tDepth, uv).x * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
  // círculo de confusión 0..1: nítido dentro de ±range/2 del plano de enfoque; detrás se abre más despacio que delante
  float coc(float d) {
    float e = abs(d - uFocus) - uRange * 0.5;
    if (e <= 0.0) return 0.0;
    return clamp(e / (d > uFocus ? max(uFocus * 2.0, 2.0) : max(uFocus, 1.0)), 0.0, 1.0);
  }
  void main() {
    vec4 c0 = texture2D(tDiffuse, vUv);
    if (uMaxR < 0.5) { gl_FragColor = c0; return; }
    float dc = linZ(vUv), r0 = coc(dc) * uMaxR;
    vec3 sum = c0.rgb; float wsum = 1.0;
    for (int i = 0; i < 32; i++) {
      float t = (float(i) + 0.5) / 32.0, a = float(i) * 2.39996323, rad = sqrt(t) * uMaxR;
      vec2 uv = vUv + vec2(cos(a), sin(a)) * rad * uTexel;
      float ds = linZ(uv), cs = coc(ds) * uMaxR;
      // lo que está delante solo tiñe donde llega su propio círculo; lo que está detrás, donde llega el de este píxel (el fondo no se mancha sobre lo nítido)
      float reach = ds < dc ? cs : r0;
      float w = clamp(reach - rad + 0.5, 0.0, 1.0);
      sum += texture2D(tDiffuse, uv).rgb * w; wsum += w;
    }
    gl_FragColor = vec4(sum / wsum, c0.a);
  }`

export class DofPass extends Pass {
  constructor(look) {
    super()
    this.look = look; this.camera = null
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, uNear: { value: 0.1 }, uFar: { value: 1000 }, uFocus: { value: 8 }, uRange: { value: 4 }, uMaxR: { value: 6 }, uAspect: { value: 1 }, uTexel: { value: new THREE.Vector2(1, 1) } },
      vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
    })
    this.quad = new FullScreenQuad(this.mat)
  }
  render(renderer, writeBuffer, readBuffer) {
    const l = this.look, c = l.cfg, cam = l.vp.camera, depth = l.depthTex, u = this.mat.uniforms
    const ok = depth && cam?.isPerspectiveCamera
    u.tDiffuse.value = readBuffer.texture
    if (ok) {
      u.tDepth.value = depth; u.uNear.value = cam.near; u.uFar.value = cam.far
      u.uFocus.value = Math.max(0.05, l.focus); u.uRange.value = c.dofRange
      u.uTexel.value.set(1 / readBuffer.width, 1 / readBuffer.height)
      u.uMaxR.value = c.dofBlur * (readBuffer.height / 1080)
    } else u.uMaxR.value = 0 // ortográfica o sin profundidad: se copia la imagen
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer)
    this.quad.render(renderer)
  }
  dispose() { this.mat.dispose(); this.quad.dispose() }
}
