// Ondas de interacción del agua: anillos que se expanden desde donde cae algo, nada el jugador o flota un objeto.
//
// Un anillo = (x, z, instante de nacimiento, amplitud). Todas las aguas comparten la misma lista (los uniformes apuntan al mismo array), así
// una onda cruza de un cuerpo de agua a otro sin trabajo extra; el shader (water.js) las suma a la normal y, si son fuertes, al color (espuma).
// Es un efecto visual: la altura que consulta `WaterWorld.at` no las incluye (miden milímetros y centímetros).
import * as THREE from 'three'

export const RIPPLE_MAX = 16
export const RIPPLE_LIFE = 3.2 // s: lo que dura un anillo
/** Lista compartida: Vector4(x, z, nacimiento, amplitud). amplitud 0 = hueco libre. */
export const RIPPLES = Array.from({ length: RIPPLE_MAX }, () => new THREE.Vector4(0, 0, -1e4, 0))
let next = 0

/** Reloj de las aguas (el mismo que `rtTime`). */
export const rippleClock = () => performance.now() / 1000

/** Añade un anillo. `amp` 0..1 (0,2 = gota suave · 0,6 = chapuzón · 1 = zambullida fuerte). Sustituye al más viejo si la lista está llena. */
export function addRipple(x, z, amp = 0.5, t = rippleClock()) {
  if (!(amp > 0.01) || !Number.isFinite(x) || !Number.isFinite(z)) return
  let k = -1, old = Infinity
  for (let i = 0; i < RIPPLE_MAX; i++) {
    const r = RIPPLES[i]
    if (r.w <= 0 || t - r.z > RIPPLE_LIFE) { k = i; break }
    if (r.z < old) { old = r.z; k = i }
  }
  if (k < 0) k = next++ % RIPPLE_MAX
  RIPPLES[k].set(x, z, t, Math.min(1.5, amp))
}

export function clearRipples() { for (const r of RIPPLES) r.set(0, 0, -1e4, 0) }

/** GLSL: suma de anillos en `p` (xz del mundo). Devuelve el gradiente (xz) de la altura y, en `foam`, la espuma 0..1. */
export const RIPPLE_GLSL = `
uniform vec4 rtRip[${RIPPLE_MAX}];
vec2 rtRipples(vec2 p, out float foam) {
  vec2 g = vec2(0.0); foam = 0.0;
  for (int i = 0; i < ${RIPPLE_MAX}; i++) {
    vec4 r = rtRip[i];
    float age = rtTime - r.z;
    if (r.w <= 0.0 || age < 0.0 || age > ${RIPPLE_LIFE.toFixed(1)}) continue;
    vec2 d = p - r.xy; float dist = length(d);
    float front = 1.7 * age, w = 0.22 + 0.2 * age, u = dist - front;
    float env = exp(-(u * u) / (w * w));
    if (env < 0.01) continue;
    float k = 20.0, a = 0.05 * r.w * exp(-age * 1.1) / (1.0 + dist * 0.7);
    g += a * env * (k * cos(k * u) - 2.0 * u / (w * w) * sin(k * u)) * d / max(dist, 1e-3);
    foam = max(foam, env * smoothstep(0.5, 1.1, r.w) * exp(-age * 1.8));
  }
  return g;
}
`
