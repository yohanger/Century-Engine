// Utilidades pequeñas compartidas por todo el editor.

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
export const lerp = (a, b, t) => a + (b - a) * t
export const DEG = Math.PI / 180

export function uid(prefix = 'o') {
  return prefix + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3)
}

export function slug(name, fallback = 'nivel') {
  const s = String(name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return s || fallback
}

// ---- base64 <-> bytes (por bloques para no reventar la pila) ----
export function bytesToB64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes.buffer ?? bytes, bytes.byteOffset ?? 0, bytes.byteLength)
  let bin = ''
  const CH = 0x8000
  for (let i = 0; i < u8.length; i += CH) bin += String.fromCharCode.apply(null, u8.subarray(i, i + CH))
  return btoa(bin)
}

export function b64ToBytes(b64) {
  const bin = atob(b64)
  const u8 = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
  return u8
}

export { downloadBlob, pickFile } from './platform.js' // acceso a la plataforma: viven en core/platform.js

export function debounce(fn, ms) {
  let t
  const d = (...a) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...a), ms)
  }
  d.flush = (...a) => {
    clearTimeout(t)
    fn(...a)
  }
  return d
}

// Ruido de valor determinista (suficiente para generar terreno base).
function hash2(ix, iz, seed) {
  let h = ix * 374761393 + iz * 668265263 + seed * 1442695041
  h = (h ^ (h >>> 13)) * 1274126177
  h = h ^ (h >>> 16)
  return (h >>> 0) / 4294967295
}

export function valueNoise(x, z, seed = 1) {
  const x0 = Math.floor(x), z0 = Math.floor(z)
  const fx = x - x0, fz = z - z0
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz)
  const a = hash2(x0, z0, seed), b = hash2(x0 + 1, z0, seed)
  const c = hash2(x0, z0 + 1, seed), d = hash2(x0 + 1, z0 + 1, seed)
  return lerp(lerp(a, b, sx), lerp(c, d, sx), sz)
}

export function fbm(x, z, { octaves = 5, gain = 0.5, lacunarity = 2, seed = 1 } = {}) {
  let amp = 1, freq = 1, sum = 0, norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += (valueNoise(x * freq, z * freq, seed + i * 31) * 2 - 1) * amp
    norm += amp
    amp *= gain
    freq *= lacunarity
  }
  return sum / norm // -1..1
}
