// Consultas del campo de nubes por celdas (bloque E): lluvia efectiva en un punto, origen de rayos, cobertura física y profundidad óptica hacia el sol.
// Son métodos de `CloudField` (se añaden a su prototipo desde cloudfield.js); viven aparte para que ningún archivo pase de 600 líneas.
import { MORPH } from './cloudfield.js'
import { CLOUD_CURVATURE_RADIUS, CLOUD_VIEW_DISTANCE, cloudHeightAtDistance } from './cloud-curvature.js'

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const lerp = (a, b, t) => a + (b - a) * t
const smooth = (a, b, x) => { if (b <= a) return x >= b ? 1 : 0; const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t) }
const floorDiv = (v, d) => (d <= 0 ? 0 : Math.floor(v / d))
const MAX_SUN_TILES = 512

/** Intervalos del rayo dentro de la misma envolvente radial que recorre WebGL. */
function volumeOpticalDepth(volume, x, y, z, d, distance) {
  if (!volume.hasClouds) return 0
  const radius = CLOUD_CURVATURE_RADIUS + y
  const b = radius * d[1]
  const roots = (h) => {
    const c = (y - h) * (radius + CLOUD_CURVATURE_RADIUS + h)
    const disc = b * b - c
    if (disc <= 0) return [-1, -1]
    const q = -b - (b < 0 ? -1 : 1) * Math.sqrt(disc), other = c / q
    return [Math.min(q, other), Math.max(q, other)]
  }
  const outer = roots(volume.base + volume.height), inner = roots(volume.base)
  let near = Math.max(0, outer[0]), far = Math.min(distance, outer[1])
  if (inner[0] > near) far = Math.min(far, inner[0])
  else if (inner[1] > near) near = inner[1]
  if (y >= 0 && d[1] < 0) {
    const ground = roots(0)[0]
    if (ground >= 0) far = Math.min(far, ground)
  }
  far = Math.min(far, near + 11000)
  if (far <= near) return 0
  const steps = Math.min(48, Math.max(4, Math.ceil((far - near) / (volume.height / volume.depth * 0.6))))
  const step = (far - near) / steps
  let tau = 0
  for (let i = 0; i < steps && tau < 12; i++) {
    const t = near + (i + 0.5) * step, dx = d[0] * t, dz = d[2] * t
    const r = radius + d[1] * t, horizontal2 = dx * dx + dz * dz
    const h = y + d[1] * t + horizontal2 / (Math.sqrt(r * r + horizontal2) + r)
    tau += volume.sample(x + dx, h, z + dz) * step * 0.004
  }
  return tau
}

export const queryMethods = {
  /** Lluvia efectiva (mm/h) en el punto (x, y, z): suma de las huellas de las celdas cercanas, corridas por el viento durante la caída. */
  effectivePrecipitationAt(x, y, z) {
    if (this.f.rain <= 0.001) return 0
    const K = this.K, tv = Math.max(0.5, this.cfg.terminalVelocity), s = this._tmp, src = this._tile
    const [ctx, ctz] = this._tileRange(x, z)
    let result = 0
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
      this._sourceOfTile(ctx + dx, ctz + dz, src)
      this.evaluate(src.x, src.z, s)
      if (s.condensate <= 0.002 || s.rainEff <= 0.001) continue
      const fallTime = Math.max(1, s.y - y) / tv
      const px = s.x + this.wind[0] * fallTime, pz = s.z + this.wind[1] * fallTime
      const foot = Math.max(18 * K, s.radius * lerp(0.72, 1.18, s.precipMat))
      const nd = Math.hypot(x - px, z - pz) / foot
      if (nd >= 1) continue
      let w = 1 - nd; w = w * w * (3 - 2 * w)
      result += s.rainEff * w
    }
    const volume = this.map.volume
    const ax = x - this.windOff[0], az = z - this.windOff[1]
    if (volume.contains(ax, az)) {
      const radius = CLOUD_CURVATURE_RADIUS
      let condensate = 0
      for (let layer = 0; layer < volume.depth; layer++) {
        const h = volume.base + (layer + 0.5) * volume.height / volume.depth
        const t = Math.max(0, h - y) / tv, dx = this.wind[0] * t, dz = this.wind[1] * t
        const curvedHeight = h - (dx * dx + dz * dz) / (2 * (radius + h))
        if (curvedHeight > y) condensate = Math.max(condensate, volume.sample(ax - dx, h, az - dz))
      }
      const droplets = smooth(0.38, 0.80, condensate)
      // El condensado modifica la lluvia existente y puede producir gotas en las uniones húmedas.
      const rain = this.f.rain * droplets * smooth(0.52, 0.88, this.f.humidity)
      result = Math.max(rain, result * smooth(0.06, 0.45, condensate))
    }
    return clamp(result, 0, Math.max(0.1, this.cfg.mmAtMax * 1.25))
  },

  /**
   * Origen de un rayo cerca de (x, z): el cumulonimbo eléctricamente apto con mejor puntuación a menos de `maxDistance` (m).
   * Devuelve { x, y, z (centro de la nube), radius, thick, dev, tau, elig, base } o null.
   */
  lightningOrigin(x, z, maxDistance) {
    const F = this.f
    if (F.storm <= 0.001 || F.coverage <= 0.001) return null
    const ch = this.chunk, S = this.stride, tile = ch * S, K = this.K
    const search = clamp(Math.max(ch, +maxDistance || 0), ch, this.simRadius * 1.25)
    const [ctx, ctz] = this._tileRange(x, z), tr = Math.ceil(search / tile) + 1
    const s = this._tmp, src = this._tile
    let best = 0, found = null
    for (let dz = -tr; dz <= tr; dz++) for (let dx = -tr; dx <= tr; dx++) {
      this._sourceOfTile(ctx + dx, ctz + dz, src)
      this.evaluate(src.x, src.z, s)
      if (s.condensate <= 0.002 || s.morph !== MORPH.CUMULONIMBUS || s.elec <= 0.001) continue
      const d = Math.hypot(s.x - x, s.z - z)
      if (d > search + Math.max(1, s.radius)) continue
      const dw = 1 - clamp01(d / Math.max(1, search))
      const score = s.elec * lerp(0.82, 1, dw) * lerp(0.72, 1, s.dev) * lerp(0.76, 1, s.maturity)
      if (!found || score > best) { best = score; found = { x: s.x, y: s.y, z: s.z, base: s.base, radius: s.radius, thick: s.thick, dev: s.dev, tau: s.tau, elig: 0, key: s.key, dist: d } }
    }
    if (!found || best < 0.08) return null
    found.y = found.y + found.thick * 0.38      // centro de descarga: 0,38 espesores sobre el centro de la masa (como en Frost)
    found.radius = Math.max(8 * K, found.radius); found.thick = Math.max(8 * K, found.thick); found.dev = clamp01(found.dev)
    found.elig = clamp01(best)
    return found
  },

  /** Cobertura física (0–1, fracción de cielo tapada por las celdas) y profundidad óptica media vistas desde (x, y, z). */
  physicalState(x, y, z, maxDistance = this.simRadius) {
    const out = { coverage: 0, meanTau: 0 }
    if (this.f.coverage <= 0.001) return out
    const ch = this.chunk, S = this.stride, tile = ch * S
    const r = Math.min(CLOUD_VIEW_DISTANCE, clamp(Math.max(ch, maxDistance), ch, this.simRadius * 1.25)), r2 = r * r
    const [ctx, ctz] = this._tileRange(x, z), tr = Math.ceil(r / tile) + 1
    const s = this._tmp, src = this._tile
    let acc = 0, wTau = 0, wSum = 0
    for (let dz = -tr; dz <= tr; dz++) for (let dx = -tr; dx <= tr; dx++) {
      this._sourceOfTile(ctx + dx, ctz + dz, src)
      this.evaluate(src.x, src.z, s)
      if (s.condensate <= 0.002 || s.tau <= 0.001) continue
      const hx = s.x - x, hz = s.z - z
      const horizontal2 = hx * hx + hz * hz
      if (horizontal2 > r2) continue
      const cloudY = cloudHeightAtDistance(s.y, horizontal2)
      const dist = Math.max(1, Math.hypot(hx, cloudY - y, hz))
      const ang = Math.atan2(Math.max(1, s.radius), dist)
      const frac = clamp01((1 - Math.cos(ang)) * 0.5)
      const contrib = frac * clamp01(Math.max(s.condensate, s.maturity))
      if (contrib <= 1e-6) continue
      acc += contrib; wTau += contrib * Math.max(0, s.tau); wSum += contrib
    }
    if (wSum <= 1e-6) return out
    out.coverage = clamp01(1 - Math.exp(-acc * 2.4)); out.meanTau = Math.max(0, wTau / wSum)
    return out
  },

  /** Profundidad óptica τ a lo largo del rayo (origen `o`, dirección `d` unitaria, hasta `maxDistance` m): la transmisión directa es exp(−τ). */
  opticalDepthAlongRay(o, d, maxDistance) {
    const dl = Math.hypot(d[0], d[1], d[2])
    if (dl <= 1e-3) return 0
    const dir = [d[0] / dl, d[1] / dl, d[2] / dl]
    const md = clamp(Math.max(1, +maxDistance || 1), 1, Math.min(CLOUD_VIEW_DISTANCE, this.simRadius * 2))
    const ch = this.chunk, S = this.stride
    const margin = Math.max(ch * S, this.maxSize * 2.8)
    const ox = o[0] - this.windOff[0], oz = o[2] - this.windOff[1]
    if (this.map.volume.contains(ox, oz)) return volumeOpticalDepth(this.map.volume, ox, o[1], oz, dir, md)
    if (this.f.coverage <= 0.001) return 0
    const ex = ox + dir[0] * md, ez = oz + dir[2] * md
    const minTX = floorDiv(Math.floor((Math.min(ox, ex) - margin) / ch), S) - 1, maxTX = floorDiv(Math.floor((Math.max(ox, ex) + margin) / ch), S) + 1
    const minTZ = floorDiv(Math.floor((Math.min(oz, ez) - margin) / ch), S) - 1, maxTZ = floorDiv(Math.floor((Math.max(oz, ez) + margin) / ch), S) + 1
    const s = this._tmp, src = this._tile
    let acc = 0, n = 0
    for (let tz = minTZ; tz <= maxTZ && n < MAX_SUN_TILES; tz++) for (let tx = minTX; tx <= maxTX && n < MAX_SUN_TILES; tx++) {
      n++
      this._sourceOfTile(tx, tz, src)
      this.evaluate(src.x, src.z, s)
      if (s.condensate <= 0.002 || s.tau <= 0.001) continue
      acc += this._rayContribution(o, dir, md, s)
    }
    return Math.max(0, acc)
  },
  _rayContribution(o, d, md, s) {
    const K = this.K, rx = Math.max(8 * K, s.radius), rz = rx
    let vo = 0, vs = 0.58
    if (s.morph === MORPH.TOWERING) { vo = s.thick * 0.28; vs = 0.72 } else if (s.morph === MORPH.CUMULONIMBUS) { vo = s.thick * 0.34; vs = 0.82 }
    const ry = Math.max(5 * K, s.thick * vs)
    const x = o[0] - s.x, z = o[2] - s.z
    const horizontal2 = x * x + z * z
    if (horizontal2 > CLOUD_VIEW_DISTANCE ** 2) return 0
    const cloudY = cloudHeightAtDistance(s.y + vo, horizontal2)
    const lx = x / rx, ly = (o[1] - cloudY) / ry, lz = z / rz
    const dx = d[0] / rx, dy = d[1] / ry, dz = d[2] / rz
    const a = dx * dx + dy * dy + dz * dz, b = 2 * (lx * dx + ly * dy + lz * dz), c = lx * lx + ly * ly + lz * lz - 1
    const disc = b * b - 4 * a * c
    if (a <= 1e-7 || disc <= 0) return 0
    const root = Math.sqrt(disc), inv = 0.5 / a
    let entry = (-b - root) * inv, exit = (-b + root) * inv
    if (exit <= 0 || entry >= md) return 0
    entry = Math.max(0, entry); exit = Math.min(md, exit)
    const chord = Math.max(0, exit - entry)
    if (chord <= 0.001) return 0
    const ch = Math.max(10 * K, Math.min(rx, Math.max(ry, rx * 0.45)) * 2)
    return s.tau * clamp01(chord / ch) * clamp01(Math.max(s.condensate, s.maturity))
  },
}
