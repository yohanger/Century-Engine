// Pases propios del «look»: gradación de color (con LUT), pase del view model y captura de profundidad. Los monta look.js.
import * as THREE from 'three'
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js'

export const GradeShader = {
  name: 'RtGrade',
  uniforms: {
    tDiffuse: { value: null }, uTime: { value: 0 }, uAspect: { value: 1 }, uRes: { value: new THREE.Vector2(1, 1) },
    uVignette: { value: 0 }, uGrain: { value: 0 }, uSat: { value: 1 }, uContrast: { value: 1 }, uTint: { value: 0 }, uChroma: { value: 0 },
    uShadow: { value: new THREE.Vector3(1, 1, 1) }, uHigh: { value: new THREE.Vector3(1, 1, 1) },
    uLift: { value: new THREE.Vector3() }, uGamma: { value: new THREE.Vector3() }, uGain: { value: new THREE.Vector3() }, uOffset: { value: new THREE.Vector3() },
    tLut: { value: null }, uLutMode: { value: 0 }, uLutN: { value: 16 }, uLutSize: { value: new THREE.Vector2(256, 16) }, uLutAmt: { value: 1 },
    uTemp: { value: 0 }, uTintG: { value: 0 }, uHue: { value: 0 }, uVib: { value: 0 }, uVigR: { value: 0.5 }, uVigC: { value: new THREE.Vector3() },
  },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime, uAspect, uVignette, uGrain, uSat, uContrast, uTint, uChroma; uniform vec2 uRes;
    uniform vec3 uShadow, uHigh; varying vec2 vUv;
    uniform sampler2D tLut; uniform int uLutMode; uniform float uLutN, uLutAmt; uniform vec2 uLutSize;
    // LUT 3D guardada en 2D. Modo 1: tira de N cortes de N×N (ancho N², cada corte = un valor de azul, filas de arriba a abajo = verde de más a menos).
    // Modo 2: Hald (cuadrada, lado L³ con N = L²; el píxel nº r + g·N + b·N² en orden de lectura). Se interpola en 3D a mano con 8 lecturas exactas.
    vec3 lutAt(vec3 i) {
      vec2 px;
      if (uLutMode == 1) px = vec2(i.b * uLutN + i.r, uLutN - 1.0 - i.g);
      else { float p = i.r + i.g * uLutN + i.b * uLutN * uLutN; px = vec2(mod(p, uLutSize.x), floor(p / uLutSize.x)); }
      return texture2D(tLut, (px + 0.5) / uLutSize).rgb;
    }
    vec3 lutApply(vec3 c) {
      vec3 q = clamp(c, 0.0, 1.0) * (uLutN - 1.0), f = fract(q), b0 = floor(q), b1 = min(b0 + 1.0, uLutN - 1.0);
      vec3 c00 = mix(lutAt(vec3(b0.r, b0.g, b0.b)), lutAt(vec3(b1.r, b0.g, b0.b)), f.r);
      vec3 c10 = mix(lutAt(vec3(b0.r, b1.g, b0.b)), lutAt(vec3(b1.r, b1.g, b0.b)), f.r);
      vec3 c01 = mix(lutAt(vec3(b0.r, b0.g, b1.b)), lutAt(vec3(b1.r, b0.g, b1.b)), f.r);
      vec3 c11 = mix(lutAt(vec3(b0.r, b1.g, b1.b)), lutAt(vec3(b1.r, b1.g, b1.b)), f.r);
      return mix(mix(c00, c10, f.g), mix(c01, c11, f.g), f.b);
    }
    uniform vec3 uLift, uGamma, uGain, uOffset, uVigC; uniform float uTemp, uTintG, uHue, uVib, uVigR;
    vec3 hueRotate(vec3 c, float a) { // rotación de tono en YIQ
      const mat3 toY = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312);
      const mat3 toR = mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703);
      vec3 y = toY * c; float h = atan(y.z, y.y) + a, ch = length(y.yz);
      return toR * vec3(y.x, ch * cos(h), ch * sin(h));
    }
    float hash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
    void main() {
      vec2 c = vUv - 0.5;
      vec3 col;
      if (uChroma > 0.0) col = vec3(texture2D(tDiffuse, vUv + c * uChroma).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - c * uChroma).b);
      else col = texture2D(tDiffuse, vUv).rgb;
      // ruedas: offset (todo), lift (sombras), gamma (medios), gain (luces)
      col += uOffset * 0.1;
      col += uLift * 0.25 * (1.0 - clamp(col, 0.0, 1.0));
      col = pow(max(col, 0.0), 1.0 / max(1.0 + uGamma * 0.5, vec3(0.05)));
      col *= max(1.0 + uGain * 0.5, vec3(0.0));
      // balance de blancos: temperatura (azul ↔ ámbar) y tinte (verde ↔ magenta)
      col *= vec3(1.0 + 0.2 * uTemp + 0.08 * uTintG, 1.0 - 0.15 * uTintG, 1.0 - 0.2 * uTemp + 0.08 * uTintG);
      if (abs(uHue) > 1e-4) col = max(hueRotate(col, uHue), 0.0);
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      vec3 tint = mix(uShadow, uHigh, smoothstep(0.12, 0.8, l));
      tint /= max(dot(tint, vec3(0.3333)), 1e-3);
      col = mix(col, col * tint, uTint);
      col = mix(vec3(l), col, uSat);
      if (abs(uVib) > 1e-4) { float mx = max(col.r, max(col.g, col.b)), mn = min(col.r, min(col.g, col.b)); col = mix(vec3(l), col, 1.0 + uVib * (1.0 - clamp(mx - mn, 0.0, 1.0))); }
      // contraste sobre el gris medio SIN recortar los negros: (c − 0,5)·k + 0,5 resta (k−1)/2 a todo, y con k > 1 los tonos por debajo de ~9/255
      // (un cielo nocturno, el suelo de noche) se iban a 0. Con k > 1 el efecto entra gradualmente desde el negro; con k < 1 es el de siempre.
      vec3 cc = (col - 0.5) * uContrast + 0.5;
      col = uContrast > 1.0 ? mix(col, cc, smoothstep(vec3(0.0), vec3(0.25), col)) : cc;
      float d = length(c * vec2(uAspect, 1.0)) / (0.5 * length(vec2(uAspect, 1.0)));
      col = mix(col, uVigC, uVignette * smoothstep(uVigR * 0.7, uVigR * 0.7 + 0.7, d));
      if (uLutMode > 0 && uLutAmt > 0.0) col = mix(col, lutApply(col), uLutAmt);
      float g = hash(floor(vUv * uRes) + fract(uTime * 0.37) * 523.0) - 0.5;
      col += g * uGrain * 0.4 * (1.15 - l); // 0.4: el grano es sutil incluso en el máximo
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
}

/** Pase del view model: dibuja lo que cuelga de la cámara (capa aparte) encima de la escena, con la profundidad vaciada.
 *  Así una linterna en la mano no se hunde en la pared que tienes delante. Lo pone el modo Jugar en `vp.vmView`. */
export class ViewModelPass extends Pass {
  constructor(look) { super(); this.look = look; this.needsSwap = false }
  render(renderer, writeBuffer, readBuffer) { this.look.drawViewModel(renderer, readBuffer) }
}


/** Copia la profundidad de la escena antes de que SSR, niebla y AO reutilicen los dos buffers del compositor. */
export class CaptureDepthPass extends Pass {
  constructor(look) {
    super()
    this.look = look
    this.needsSwap = false
    const type = look.vp.renderer.extensions.has('EXT_color_buffer_float') ? THREE.FloatType : THREE.HalfFloatType
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      format: THREE.RedFormat, type, depthBuffer: false,
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    })
    this.material = new THREE.ShaderMaterial({
      uniforms: { tDepth: { value: null } }, depthTest: false, depthWrite: false, toneMapped: false,
      vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: 'uniform sampler2D tDepth; void main() { gl_FragColor = vec4(texelFetch(tDepth, ivec2(gl_FragCoord.xy), 0).r, 0.0, 0.0, 1.0); }',
    })
    this.quad = new FullScreenQuad(this.material)
  }
  render(renderer, writeBuffer, readBuffer) {
    const depth = readBuffer.depthTexture
    this.look.depthTex = null
    if (!depth) return
    this.target.setSize(readBuffer.width, readBuffer.height)
    this.material.uniforms.tDepth.value = depth
    const previous = renderer.getRenderTarget()
    try {
      renderer.setRenderTarget(this.target)
      this.quad.render(renderer)
      this.look.depthTex = this.target.texture
    } finally { renderer.setRenderTarget(previous) }
  }
  dispose() { this.target.dispose(); this.material.dispose(); this.quad.dispose() }
}
