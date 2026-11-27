// Reconstrucción espacial de la imagen interna y mecanismos temporales históricos.
// S17-G002 agrega una protección de bordes opt-in sin volver a activar TAA ni DynRes.
// La ruta espacial por defecto conserva el Catmull-Rom de cinco tomas.
// La alternativa experimental limita las sobreoscilaciones cerca de contrastes fuertes
// mediante cuatro lecturas adicionales, que deben medirse en GPU real.
// El código TAA/DynRes anterior permanece inactivo por contrato desde 0.26.9.
import * as THREE from 'three'
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'

/** Secuencia de baja discrepancia (Halton) en [0,1): reparte los desplazamientos del subpíxel sin repetirse pronto. */
export function halton(index, base) {
  let f = 1, r = 0
  for (let i = index; i > 0; i = Math.floor(i / base)) { f /= base; r += f * (i % base) }
  return r
}
export const JITTER_COUNT = 16
/** Desplazamiento del fotograma `n` en píxeles internos, en [-0.5, 0.5). */
export function jitterOf(n) { const i = (n % JITTER_COUNT) + 1; return [halton(i, 2) - 0.5, halton(i, 3) - 0.5] }

/**
 * Controlador de resolución dinámica. Se alimenta con la duración de cada fotograma (ms) y devuelve la nueva escala cuando cambia.
 * Reglas: baja rápido si se pasa del presupuesto (hasta 3 pasos), sube despacio y solo si la predicción cabe (el coste ~ píxeles = escala²).
 */
export class DynRes {
  constructor({ target = 60, min = 0.6, max = 1, step = 0.05, scale = 1 } = {}) {
    this.target = target; this.min = min; this.max = max; this.step = step
    this.scale = Math.min(max, Math.max(min, scale))
    this.ema = 0; this.n = 0; this.since = 0
    this.probing = false; this.probeWait = 180; this.over = 0
  }
  get budget() { return 1000 / this.target }
  setLimits({ target, min, max }) {
    if (target) this.target = target
    if (min != null) this.min = min
    if (max != null) this.max = max
    this.scale = Math.min(this.max, Math.max(this.min, this.scale))
  }
  reset() { this.ema = 0; this.n = 0; this.since = 0; this.over = 0 }
  /** @returns {number|null} nueva escala, o null si no cambia */
  sample(dtMs) {
    if (!(dtMs > 0) || dtMs > 250) { this.reset(); return null } // pausa, pestaña oculta o carga: no es un coste de render
    this.ema = this.n ? this.ema * 0.9 + dtMs * 0.1 : dtMs
    this.n++; this.since++
    if (this.n < 20) return null
    const b = this.budget, s = this.scale
    this.over = this.ema > b * 1.12 ? this.over + 1 : 0 // un pico suelto no cuenta: tiene que durar
    let next = s
    if (this.over >= 8 && this.since >= 12 && s > this.min) {
      const steps = Math.min(3, 1 + Math.floor((this.ema / b - 1.12) * 5))
      next = Math.max(this.min, s - this.step * steps)
      if (this.probing) { this.probeWait = Math.min(this.probeWait * 2, 3600); this.probing = false } // la prueba de subir salió mal: tarda más en volver a intentarlo
    } else if (s < this.max) {
      const up = Math.min(this.max, s + this.step)
      if (this.ema < b * 0.85 && this.since >= 90) { if (this.ema * (up * up) / (s * s) < b * 0.97) next = up } // sobra GPU de verdad: se puede predecir
      else if (this.ema <= b * 1.05 && this.since >= this.probeWait) { next = up; this.probing = true } // al límite de los FPS (o del vsync) no se ve cuánto sobra: se prueba
    }
    if (this.probing && this.since >= 90 && next === s) { this.probing = false; this.probeWait = Math.max(120, this.probeWait / 2) } // la prueba aguantó
    next = Math.round(next * 100) / 100
    if (next === s) return null
    this.scale = next; this.since = 0; this.n = 10; this.ema = this.ema * (next * next) / (s * s) // el coste cambia con los píxeles: se re-estima en lugar de esperar
    return next
  }
}

const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }'

const FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D tColor, tDepth, tHist;
  uniform vec2 uInSize, uOutSize, uJitter;     // píxeles de la imagen interna · de la salida · desplazamiento del fotograma (en uv)
  uniform mat4 uInvVP, uPrevVP;
  uniform float uMaxW, uReset, uUseHist, uSpatialEdge;
  varying vec2 vUv;

  vec3 toMapped(vec3 c) { return c / (1.0 + max(max(c.r, c.g), c.b)); }          // comprime el HDR para que un brillo no domine la mezcla
  vec3 fromMapped(vec3 c) { return c / max(1.0 - max(max(c.r, c.g), c.b), 1e-3); }

  // Catmull-Rom de 5 tomas: reconstruye con nitidez en lugar de difuminar como el bilineal
  vec4 catmull(sampler2D tex, vec2 uv, vec2 size) {
    vec2 p = uv * size, c = floor(p - 0.5) + 0.5, f = p - c;
    vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f)), w1 = 1.0 + f * f * (-2.5 + 1.5 * f), w2 = f * (0.5 + f * (2.0 - 1.5 * f)), w3 = f * f * (-0.5 + 0.5 * f);
    vec2 w12 = w1 + w2, t12 = (c + w2 / w12) / size, t0 = (c - 1.0) / size, t3 = (c + 2.0) / size;
    float k0 = w12.x * w0.y, k1 = w0.x * w12.y, k2 = w12.x * w12.y, k3 = w3.x * w12.y, k4 = w12.x * w3.y;
    vec4 r = texture2D(tex, vec2(t12.x, t0.y)) * k0 + texture2D(tex, vec2(t0.x, t12.y)) * k1
           + texture2D(tex, vec2(t12.x, t12.y)) * k2 + texture2D(tex, vec2(t3.x, t12.y)) * k3 + texture2D(tex, vec2(t12.x, t3.y)) * k4;
    return max(r / (k0 + k1 + k2 + k3 + k4), 0.0); // las esquinas se omiten: se renormaliza para que los pesos sumen 1
  }

  void main() {
    vec2 uv = vUv;                       // posición en pantalla SIN desplazar
    vec2 sp = uv - uJitter;              // dónde está esa posición en la imagen interna de este fotograma
    if (uUseHist < 0.5) {
      vec3 result = catmull(tColor, sp, uInSize).rgb;
      if (uSpatialEdge > 0.5) {
        // G002 experimental: recorta sobreoscilación de Catmull-Rom solo en bordes contrastados.
        // Cuatro lecturas más; el modo predeterminado sigue usando las cinco originales.
        vec2 p = (floor(sp * uInSize - 0.5) + 0.5) / uInSize;
        vec2 tx = 1.0 / uInSize;
        vec3 a = texture2D(tColor, p).rgb;
        vec3 b = texture2D(tColor, p + vec2(tx.x, 0.0)).rgb;
        vec3 c = texture2D(tColor, p + vec2(0.0, tx.y)).rgb;
        vec3 d = texture2D(tColor, p + tx).rgb;
        vec3 low = min(min(a, b), min(c, d)), high = max(max(a, b), max(c, d));
        vec3 weights = vec3(0.2126, 0.7152, 0.0722);
        float ll = min(min(dot(a, weights), dot(b, weights)), min(dot(c, weights), dot(d, weights)));
        float lh = max(max(dot(a, weights), dot(b, weights)), max(dot(c, weights), dot(d, weights)));
        float contrast = clamp((lh - ll) * 2.0 / (lh + 0.1), 0.0, 1.0);
        result = mix(result, clamp(result, low, high), contrast);
      }
      gl_FragColor = vec4(result, 1.0);
      return;
    }

    // 3x3 de la imagen interna alrededor de la muestra más cercana: color con núcleo gaussiano estrecho, estadística de la vecindad y profundidad mínima
    vec2 base = floor(sp * uInSize);
    vec3 acc = vec3(0.0), m1 = vec3(0.0), m2 = vec3(0.0); float wsum = 0.0, dmin = 1.0, dnear = 10.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 tuv = (base + vec2(float(x), float(y)) + 0.5) / uInSize;
      vec3 c = toMapped(texture2D(tColor, tuv).rgb);
      vec2 d = (tuv - sp) * uInSize;                 // distancia en píxeles internos
      float w = exp(-dot(d, d) / (2.0 * 0.3 * 0.3));
      acc += c * w; wsum += w; m1 += c; m2 += c * c;
      dmin = min(dmin, texture2D(tDepth, tuv).r);    // el más cercano: los bordes de objetos no heredan la profundidad del fondo
      dnear = min(dnear, dot(d, d));
    }
    vec3 cur = acc / wsum;
    m1 /= 9.0; m2 /= 9.0;
    vec3 sigma = sqrt(max(m2 - m1 * m1, 0.0));
    vec3 lo = m1 - 1.25 * sigma, hi = m1 + 1.25 * sigma;
    // confianza de esta muestra: cuánto cae cerca (en píxeles de SALIDA) del píxel que se reconstruye. A media resolución solo una de cada cuatro está cerca.
    float eps = sqrt(dnear) * uOutSize.x / uInSize.x;
    float conf = max(exp(-0.5 * eps * eps / (0.4 * 0.4)), 0.02);

    // reproyección: de la profundidad al mundo y de ahí a donde estaba ese punto en el fotograma anterior
    vec4 wp = uInvVP * vec4(uv * 2.0 - 1.0, dmin * 2.0 - 1.0, 1.0);
    wp /= wp.w;
    vec4 pc = uPrevVP * wp;
    vec2 puv = pc.xy / pc.w * 0.5 + 0.5;
    bool inside = pc.w > 0.0 && puv.x > 0.0 && puv.x < 1.0 && puv.y > 0.0 && puv.y < 1.0;
    if (uReset > 0.5 || !inside) { gl_FragColor = vec4(fromMapped(cur), conf); return; }

    vec4 hs = catmull(tHist, puv, uOutSize);
    vec3 hist = toMapped(hs.rgb); float wh = min(hs.a, uMaxW);
    // recorte hacia el centro de la caja de la vecindad (conserva el tono mejor que recortar canal a canal)
    vec3 center = 0.5 * (lo + hi), ext = max(0.5 * (hi - lo), 1e-4), v = hist - center, a = abs(v / ext);
    float k = max(a.x, max(a.y, a.z));
    vec3 clipped = k > 1.0 ? center + v / k : hist;
    float off = clamp(length(hist - clipped) * 6.0, 0.0, 1.0); // cuánto se ha tenido que recortar: movimiento o desoclusión
    wh *= 1.0 - 0.85 * off;                                    // la historia dudosa pesa menos
    // media ponderada: la historia acumula el peso de las muestras que ha recibido (hasta uMaxW), cada muestra nueva pesa su confianza
    vec3 outc = (clipped * wh + cur * conf) / (wh + conf);
    gl_FragColor = vec4(fromMapped(outc), min(wh + conf, uMaxW));
  }`

const RESOLVE = /* glsl */`
  precision highp float; uniform sampler2D tHist; varying vec2 vUv;
  void main() { gl_FragColor = vec4(texture2D(tHist, vUv).rgb, 1.0); }` // quita el peso (canal alfa) de la historia

const SHARPEN = {
  name: 'RtSharpen',
  uniforms: { tDiffuse: { value: null }, uTexel: { value: new THREE.Vector2(1, 1) }, uStrength: { value: 0.3 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  // nitidez adaptativa al contraste (estilo CAS): afina lo borroso y deja en paz los bordes ya duros
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform vec2 uTexel; uniform float uStrength; varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      vec3 n = texture2D(tDiffuse, vUv + vec2(0.0, uTexel.y)).rgb, s = texture2D(tDiffuse, vUv - vec2(0.0, uTexel.y)).rgb;
      vec3 e = texture2D(tDiffuse, vUv + vec2(uTexel.x, 0.0)).rgb, w = texture2D(tDiffuse, vUv - vec2(uTexel.x, 0.0)).rgb;
      vec3 mn = min(c, min(min(n, s), min(e, w))), mx = max(c, max(max(n, s), max(e, w)));
      vec3 amp = sqrt(clamp(min(mn, 1.0 - mx) / max(mx, 1e-3), 0.0, 1.0));
      vec3 wgt = amp * -mix(0.125, 0.2, uStrength);
      gl_FragColor = vec4(clamp((wgt * (n + s + e + w) + c) / (4.0 * wgt + 1.0), 0.0, 1.0), 1.0);
    }`,
}
export { SHARPEN as SharpenShader }

const hdrTarget = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false })

export class TemporalUpscaler {
  constructor() {
    this.hist = [hdrTarget(), hdrTarget()]
    this.out = hdrTarget() // lo que ve el resto del pipeline: la historia sin su canal de peso
    this.cur = 0
    this.valid = false
    this.prevVP = new THREE.Matrix4()
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: null }, tDepth: { value: null }, tHist: { value: null },
        uInSize: { value: new THREE.Vector2(1, 1) }, uOutSize: { value: new THREE.Vector2(1, 1) }, uJitter: { value: new THREE.Vector2() },
        uInvVP: { value: new THREE.Matrix4() }, uPrevVP: { value: new THREE.Matrix4() }, uMaxW: { value: 10 }, uReset: { value: 1 }, uUseHist: { value: 1 }, uSpatialEdge: { value: 0 },
      },
      vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
    })
    this.resolveMat = new THREE.ShaderMaterial({ uniforms: { tHist: { value: null } }, vertexShader: VERT, fragmentShader: RESOLVE, depthTest: false, depthWrite: false })
    this.quad = new FullScreenQuad(this.mat)
    this.w = 1; this.h = 1
  }

  setSize(w, h) {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h))
    if (w === this.w && h === this.h) return
    this.w = w; this.h = h
    for (const t of [...this.hist, this.out]) t.setSize(w, h)
    this.mat.uniforms.uOutSize.value.set(w, h)
    this.reset()
  }

  /** La historia deja de valer (corte de cámara, cambio de escena, cambio de tamaño). */
  reset() { this.valid = false }

  /**
   * @param {object} o
   * @param {THREE.Texture} o.color    imagen interna (HDR lineal)
   * @param {THREE.Texture} o.depth    su profundidad
   * @param {number} o.inW,o.inH       tamaño de la imagen interna
   * @param {THREE.Matrix4} o.vp       proyección·vista SIN desplazar de este fotograma
   * @param {number[]} o.jitter        desplazamiento aplicado a la cámara, en píxeles internos (x a la derecha, y hacia abajo)
   * @param {boolean} o.temporal       false = solo escalar (sin historia)
   * @returns {THREE.Texture} imagen a resolución completa
   */
  render(renderer, o) {
    const u = this.mat.uniforms
    const src = this.hist[this.cur], dst = this.hist[1 - this.cur]
    u.tColor.value = o.color; u.tDepth.value = o.depth; u.tHist.value = src.texture
    u.uInSize.value.set(o.inW, o.inH)
    u.uJitter.value.set(o.jitter[0] / o.inW, -o.jitter[1] / o.inH) // el desplazamiento de la cámara es hacia abajo; el uv crece hacia arriba
    if (o.temporal) { u.uInvVP.value.copy(o.vp).invert(); u.uPrevVP.value.copy(this.prevVP) }
    u.uReset.value = this.valid ? 0 : 1
    u.uUseHist.value = o.temporal ? 1 : 0
    u.uSpatialEdge.value = !o.temporal && o.spatialAdaptive === true ? 1 : 0
    u.uMaxW.value = 1 / (o.alpha ?? 0.1) // la historia pesa como mucho tantas muestras: equivale al factor de mezcla clásico (0,1 → 10)
    const prevRT = renderer.getRenderTarget()
    renderer.setRenderTarget(dst); this.quad.render(renderer)
    if (o.temporal) this.prevVP.copy(o.vp)
    this.cur = 1 - this.cur
    this.valid = !!o.temporal
    if (!o.temporal) { renderer.setRenderTarget(prevRT); return dst.texture } // solo escalar: ya es opaca
    this.quad.material = this.resolveMat; this.resolveMat.uniforms.tHist.value = dst.texture
    renderer.setRenderTarget(this.out); this.quad.render(renderer)
    this.quad.material = this.mat
    renderer.setRenderTarget(prevRT)
    return this.out.texture
  }

  dispose() { for (const t of [...this.hist, this.out]) t.dispose(); this.mat.dispose(); this.resolveMat.dispose(); this.quad.dispose() }
}
