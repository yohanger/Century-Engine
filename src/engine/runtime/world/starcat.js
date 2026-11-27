// Catálogo estelar del cielo real como ATLAS DE CUBO (puro JS: sin DOM, THREE ni WebAudio, para poder probarlo en node).
//
// El catálogo que se distribuye (astro-data.js) es una textura equirrectangular 1024×512 con un texel por estrella (más un halo de 3×3
// alrededor de las brillantes). Dibujarla con filtro bilineal hacía que cada estrella fuese un rombo cuyo brillo dependía de dónde
// cayera el centro del píxel: al girar la cámara las tenues aparecían y desaparecían, y cerca de los polos (Polaris) los texels se
// estrechan hasta ser rayas. Aquí se reorganiza en una rejilla casi uniforme sobre la esfera —seis caras de 256×256, proyección
// gnomónica— y cada estrella guarda su posición exacta dentro del texel; el shader la dibuja como un disco de tamaño ligado al píxel.
//
// Convención de ejes: marco ecuatorial E = (cos dec·cos RA, cos dec·sin RA, sin dec). Cara f: eje n, derecha r, arriba u;
// dirección = normalize(n + tan(u·π/4)·r + tan(v·π/4)·u), (u, v) ∈ [−1, 1] «equiangulares»: la tangente reparte los texels casi por igual
// (el más pequeño mide 0,71 del nominal; con la proyección gnomónica pura llegaba a 0,48). El shader (skylib.js) repite estas fórmulas y
// tablas: si se cambian, cambiar ambos.

const K = 4 / Math.PI
export const STAR_N = 256                       // texels por lado de cada cara
export const FACE_AXIS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
export const FACE_RIGHT = [[0, 0, -1], [0, 0, 1], [1, 0, 0], [1, 0, 0], [1, 0, 0], [-1, 0, 0]]
export const FACE_UP = [[0, 1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [0, 1, 0], [0, 1, 0]]

/** Dirección → { f, u, v } (u, v ∈ [−1, 1], equiangulares). */
export function dirToFace(x, y, z) {
  const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z)
  const f = ax >= ay && ax >= az ? (x > 0 ? 0 : 1) : ay >= az ? (y > 0 ? 2 : 3) : (z > 0 ? 4 : 5)
  const n = FACE_AXIS[f], r = FACE_RIGHT[f], up = FACE_UP[f]
  const dn = x * n[0] + y * n[1] + z * n[2]
  return { f, u: Math.atan((x * r[0] + y * r[1] + z * r[2]) / dn) * K, v: Math.atan((x * up[0] + y * up[1] + z * up[2]) / dn) * K }
}
/** (cara, u, v) → dirección unitaria [x, y, z]. */
export function faceToDir(f, u, v) {
  const n = FACE_AXIS[f], r = FACE_RIGHT[f], up = FACE_UP[f]
  const a = Math.tan(u / K), b = Math.tan(v / K)
  const x = n[0] + a * r[0] + b * up[0], y = n[1] + a * r[1] + b * up[1], z = n[2] + a * r[2] + b * up[2]
  const l = Math.hypot(x, y, z)
  return [x / l, y / l, z / l]
}

const NEIGH = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]
/**
 * Estrellas del catálogo equirrectangular `sd` (Uint8Array 1024×512×4, fila 0 = declinación −90°, alfa = brillo):
 * un texel es una estrella si es un máximo local, o si su vecino mayor no es solo el halo de una brillante (el halo vale ~0,2 de su centro).
 * Devuelve [{ ra, dec (rad, centro del texel), r, g, b, a (0–255) }].
 */
export function starList(sd, W = 1024, H = 512) {
  const A = (y, x) => sd[((y * W) + ((x + W) % W)) * 4 + 3]
  const out = []
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = A(y, x)
    if (a <= 0) continue
    let mx = 0
    for (const [dy, dx] of NEIGH) { const yy = y + dy; if (yy < 0 || yy >= H) continue; mx = Math.max(mx, A(yy, x + dx)) }
    if (a < mx && a / mx < 0.45) continue          // halo de una estrella más brillante
    const i = (y * W + x) * 4
    out.push({ ra: ((x + 0.5) / W) * 2 * Math.PI, dec: ((y + 0.5) / H - 0.5) * Math.PI, r: sd[i], g: sd[i + 1], b: sd[i + 2], a })
  }
  return out
}

/**
 * Atlas: `color` RGBA8 (6N × N: x = cara·N + i, y = j; rgb = color, a = brillo) y `off` RG8 (posición de la estrella dentro del texel,
 * 0–255 → 0–1). Si dos estrellas caen en el mismo texel se queda la más brillante (con N = 256 son 25 de 8 611, todas tenues).
 */
export function buildStarAtlas(sd, N = STAR_N) {
  const stars = starList(sd), W = 6 * N
  const color = new Uint8Array(W * N * 4), off = new Uint8Array(W * N * 2)
  let dropped = 0, placed = 0
  for (const s of stars) {
    const cd = Math.cos(s.dec), { f, u, v } = dirToFace(cd * Math.cos(s.ra), cd * Math.sin(s.ra), Math.sin(s.dec))
    const px = (u * 0.5 + 0.5) * N, py = (v * 0.5 + 0.5) * N
    const i = Math.min(N - 1, Math.floor(px)), j = Math.min(N - 1, Math.floor(py)), t = j * W + f * N + i
    if (color[t * 4 + 3] >= s.a && color[t * 4 + 3] > 0) { dropped++; continue }
    if (color[t * 4 + 3] === 0) placed++; else dropped++
    color[t * 4] = s.r; color[t * 4 + 1] = s.g; color[t * 4 + 2] = s.b; color[t * 4 + 3] = s.a
    off[t * 2] = Math.min(255, Math.round((px - i) * 255)); off[t * 2 + 1] = Math.min(255, Math.round((py - j) * 255))
  }
  return { color, off, N, width: W, height: N, count: placed, dropped, total: stars.length }
}
