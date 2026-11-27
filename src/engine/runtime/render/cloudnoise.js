// Ruido 3D para las nubes volumétricas (técnica de «Horizon Zero Dawn»), generado una vez en la CPU y sin ficheros:
//   · shape  (64³)  R = Perlin-Worley (cuerpo hinchado de la nube) · G, B, A = Worley invertido a 3 frecuencias (erosiona la forma)
//   · detail (32³)  R, G, B = Worley invertido a 3 frecuencias (bordes rizados y jirones)
// Todo es PERIÓDICO (se repite sin costuras), así que la textura se puede enrollar sobre el cielo. Sin DOM ni THREE: lo prueba test-world.mjs.
// Coste: ~0,3 s la primera vez que se activan las nubes.

const hash = (x, y, z, s) => {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647) ^ Math.imul(s + 1, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16
  return (h >>> 0) / 4294967296
}
const mod = (n, m) => ((n % m) + m) % m

/** Worley invertido periódico (1 = en el centro de una celda, 0 = lejos) con `f` celdas por lado, en p ∈ [0,1)³. */
export function worley(px, py, pz, f, seed = 0) {
  const x = px * f, y = py * f, z = pz * f
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z)
  let best = 9
  for (let k = -1; k <= 1; k++) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = ix + i, cy = iy + j, cz = iz + k
    const wx = mod(cx, f), wy = mod(cy, f), wz = mod(cz, f)
    const dx = cx + hash(wx, wy, wz, seed) - x, dy = cy + hash(wx, wy, wz, seed + 11) - y, dz = cz + hash(wx, wy, wz, seed + 23) - z
    const d = dx * dx + dy * dy + dz * dz
    if (d < best) best = d
  }
  return 1 - Math.min(1, Math.sqrt(best))
}

/** Ruido de valor periódico suave (el «Perlin» de la receta), con `f` celdas por lado. */
export function valueNoise(px, py, pz, f, seed = 0) {
  const x = px * f, y = py * f, z = pz * f
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z)
  const fx = x - ix, fy = y - iy, fz = z - iz
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz)
  const h = (i, j, k) => hash(mod(ix + i, f), mod(iy + j, f), mod(iz + k, f), seed)
  const a = h(0, 0, 0) + (h(1, 0, 0) - h(0, 0, 0)) * u, b = h(0, 1, 0) + (h(1, 1, 0) - h(0, 1, 0)) * u
  const c = h(0, 0, 1) + (h(1, 0, 1) - h(0, 0, 1)) * u, d = h(0, 1, 1) + (h(1, 1, 1) - h(0, 1, 1)) * u
  const e = a + (b - a) * v, g = c + (d - c) * v
  return e + (g - e) * w
}

const perlinFbm = (x, y, z) => (valueNoise(x, y, z, 4, 1) * 0.5 + valueNoise(x, y, z, 8, 2) * 0.3 + valueNoise(x, y, z, 16, 3) * 0.2)

/** Bytes RGBA de la textura de forma (n³). */
export function buildShape(n = 64) {
  const out = new Uint8Array(n * n * n * 4)
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const px = x / n, py = y / n, pz = z / n
    const w4 = worley(px, py, pz, 4, 5)
    const pw = w4 + perlinFbm(px, py, pz) * (1 - w4)          // Perlin-Worley: el valor sube desde el Worley hasta 1
    const o = ((z * n + y) * n + x) * 4
    out[o] = Math.round(Math.min(1, pw) * 255)
    out[o + 1] = Math.round(worley(px, py, pz, 4, 7) * 255)
    out[o + 2] = Math.round(worley(px, py, pz, 8, 9) * 255)
    out[o + 3] = Math.round(worley(px, py, pz, 16, 13) * 255)
  }
  return out
}

/** Bytes RGBA de la textura de detalle (n³). */
export function buildDetail(n = 32) {
  const out = new Uint8Array(n * n * n * 4)
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const px = x / n, py = y / n, pz = z / n
    const o = ((z * n + y) * n + x) * 4
    out[o] = Math.round(worley(px, py, pz, 2, 21) * 255)
    out[o + 1] = Math.round(worley(px, py, pz, 4, 23) * 255)
    out[o + 2] = Math.round(worley(px, py, pz, 8, 29) * 255)
    out[o + 3] = 255
  }
  return out
}
