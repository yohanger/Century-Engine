// Campo de condensado en coordenadas atmosféricas (el viento medio ya mueve el mapa).
import { decodeCloudWater, encodeCloudWater } from './cloud-volume-state.js'

const DEPTH = 16
const STEP = 0.5
const clamp01 = (v) => Math.max(0, Math.min(1, v))

function trilinear(grid, n, x, y, z) {
  if (x < -0.5 || x > n - 0.5 || z < -0.5 || z > n - 0.5 || y < -0.5 || y > DEPTH - 0.5) return 0
  x = Math.max(0, Math.min(n - 1, x)); z = Math.max(0, Math.min(n - 1, z))
  y = Math.max(0, Math.min(DEPTH - 1, y))
  const ix = Math.floor(x), iz = Math.floor(z), iy = Math.floor(y)
  const dx = x - ix, dz = z - iz, dy = y - iy
  const sx = ix < n - 1 ? 1 : 0, sz = iz < n - 1 ? n : 0
  const plane = n * n, sy = iy < DEPTH - 1 ? plane : 0, k = iy * plane + iz * n + ix
  const a = (grid[k] * (1 - dx) + grid[k + sx] * dx) * (1 - dz)
    + (grid[k + sz] * (1 - dx) + grid[k + sz + sx] * dx) * dz
  const b = (grid[k + sy] * (1 - dx) + grid[k + sy + sx] * dx) * (1 - dz)
    + (grid[k + sy + sz] * (1 - dx) + grid[k + sy + sz + sx] * dx) * dz
  return a * (1 - dy) + b * dy
}

function horizontal(grid, a, b, dx, dz) {
  return (grid[a] + (grid[a + 1] - grid[a]) * dx) * (1 - dz)
    + (grid[b] + (grid[b + 1] - grid[b]) * dx) * dz
}

function clearRanges(ranges, n) {
  for (let i = 0; i < ranges.length; i += 2) { ranges[i] = n; ranges[i + 1] = -1 }
}

export class CloudVolume {
  constructor(map) {
    const n = this.N = Math.min(80, map.N)
    const size = n * n * DEPTH
    this.depth = DEPTH
    this.half = map.half
    this.spacing = 2 * map.half / n
    this.data = new Uint8Array(size * 2)
    this._core = new Float32Array(size)
    this._lift = new Float32Array(size)
    this._water = new Float32Array(size)
    this._nextWater = new Float32Array(size)
    this._vapor = new Float32Array(size)
    this._nextVapor = new Float32Array(size)
    this._sourceRanges = new Int16Array(n * DEPTH * 2)
    this._activeRanges = new Int16Array(n * DEPTH * 2)
    this._nextRanges = new Int16Array(n * DEPTH * 2)
    clearRanges(this._activeRanges, n)
    this.version = 0
    this.pending = 0
    this.blend = 1
    this.hasClouds = false
    this._coldRegion = false
  }

  rebuild(map, volumes) {
    const dx = this.spacing
    const cx = Math.round(map.cx / dx) * dx, cz = Math.round(map.cz / dx) * dx
    const base = Math.floor((map.slabBase - 150) / 100) * 100
    const top = Math.ceil((map.slabBase + map.slabThick + 250) / 100) * 100
    const height = Math.max(800, top - base)
    if (this.version && (cx !== this.cx || cz !== this.cz || base !== this.base || height !== this.height)) {
      // No extrapolar una región que dejó de solaparse: su condensado se reconstruirá
      // desde las fuentes espaciales del DESTINO antes de publicar el siguiente frame.
      this._coldRegion = Math.abs(cx - this.cx) >= this.half * 2 || Math.abs(cz - this.cz) >= this.half * 2 ||
        base >= this.base + this.height || this.base >= base + height
      if (!this._coldRegion) this._recenter(cx, cz, base, height)
    }
    this.cx = cx; this.cz = cz; this.base = base; this.height = height
    this._core.fill(0); this._lift.fill(0)
    clearRanges(this._sourceRanges, this.N)
    this._hasSources = volumes.length > 0
    for (const p of volumes) this._stamp(p)
  }

  _recenter(cx, cz, base, height) {
    const n = this.N
    for (let y = 0, k = 0; y < DEPTH; y++) {
      const sy = ((base - this.base) + (y + 0.5) * height / DEPTH) * DEPTH / this.height - 0.5
      for (let z = 0; z < n; z++) {
        for (let x = 0; x < n; x++, k++) {
          const sx = x + (cx - this.cx) / this.spacing, sz = z + (cz - this.cz) / this.spacing
          this._nextWater[k] = trilinear(this._water, n, sx, sy, sz)
          this._nextVapor[k] = trilinear(this._vapor, n, sx, sy, sz)
        }
      }
    }
    this._swap()
    this._indexActivity()
    this._publish = true
  }

  _stamp(p) {
    const n = this.N, dx = this.spacing, dy = this.height / DEPTH
    const cx = (p.x - this.cx + this.half) / dx - 0.5
    const cz = (p.z - this.cz + this.half) / dx - 0.5
    const cy = (p.y - this.base) / dy - 0.5
    const rx = Math.max(0.7, p.rx / dx), ry = Math.max(0.7, p.ry / dy), rz = Math.max(0.7, p.rz / dx)
    const i0 = Math.max(0, Math.floor(cx - 1.45 * rx)), i1 = Math.min(n - 1, Math.ceil(cx + 1.45 * rx))
    const j0 = Math.max(0, Math.floor(cz - 1.45 * rz)), j1 = Math.min(n - 1, Math.ceil(cz + 1.45 * rz))
    const h0 = Math.max(0, Math.floor(cy - 1.35 * ry)), h1 = Math.min(DEPTH - 1, Math.ceil(cy + 1.35 * ry))
    for (let h = h0; h <= h1; h++) {
      const dy2 = ((h - cy) / ry) ** 2
      for (let j = j0; j <= j1; j++) {
        const yz = dy2 + ((j - cz) / rz) ** 2, row = (h * n + j) * n
        if (yz >= 2 || i0 > i1) continue
        // El cuerpo realmente activo es el elipsoide r² < 2. Evitar
        // recorrer e indexar el rectángulo exterior vacío resulta importante
        // cuando los lóbulos de buen tiempo recuperan altura tridimensional.
        const remaining = Math.sqrt(2 - yz) * rx
        const start = Math.max(i0, Math.ceil(cx - remaining))
        const end = Math.min(i1, Math.floor(cx + remaining))
        if (start > end) continue
        const range = (h * n + j) * 2
        this._sourceRanges[range] = Math.min(i0, this._sourceRanges[range])
        this._sourceRanges[range + 1] = Math.max(i1, this._sourceRanges[range + 1])
        for (let i = start; i <= end; i++) {
          const r2 = yz + ((i - cx) / rx) ** 2
          const core = Math.max(0, 1 - r2), edge = Math.max(0, 1 - r2 / 2)
          this._core[row + i] += core * core * (3 - 2 * core) * p.str
          this._lift[row + i] += edge * edge * p.str
        }
      }
    }
  }

  advance(dt, forcing, wind) {
    this.pending = Math.min(2, this.pending + Math.max(0, dt))
    const initial = this.version === 0 || this._coldRegion
    this.blend = this._previous === this._water ? 1 : Math.min(1, this.pending / STEP)
    if (!initial && this.pending < STEP && !this._publish) return
    if (!initial && !this.hasClouds && !this._hasSources) { this.pending = 0; return }
    while (initial || this.pending >= STEP) {
      this._step(forcing, wind, initial)
      this.pending = Math.max(0, this.pending - STEP)
      if (initial) break
    }
    this._previous = initial || this._publish ? this._water : this._nextWater
    this.blend = this._previous === this._water ? 1 : this.pending / STEP
    this._coldRegion = false
    let dirty = initial || this._publish
    for (let k = 0; k < this._water.length; k++) {
      const a = Math.round(this._previous[k] * 255), b = Math.round(this._water[k] * 255)
      dirty ||= a !== this.data[k * 2] || b !== this.data[k * 2 + 1]
      this.data[k * 2] = a; this.data[k * 2 + 1] = b
    }
    if (dirty) this.version++
    this._publish = false
  }

  _step({ humidity, coverage, storm }, wind, initial) {
    const n = this.N, water = this._water, vapor = this._vapor, plane = n * n
    const background = Math.min(0.64, humidity * 0.82)
    const shear = STEP / this.spacing, liftScale = (3 + storm * 11) * STEP * DEPTH / this.height
    const blend = initial ? 1 : 0.24
    this._nextWater.fill(0); this._nextVapor.fill(0)
    clearRanges(this._nextRanges, n)
    let peak = 0
    for (let y = 0; y < DEPTH; y++) {
      const level = (y + 0.5) / DEPTH
      const shift = (0.92 - level) * shear * 0.82 // cizalladura: capas bajas más veloces que las altas
      const sx = wind[0] * shift - wind[1] * shift * 0.28, sz = wind[1] * shift + wind[0] * shift * 0.28
      const ix = Math.floor(-sx), iz = Math.floor(-sz), fx = -sx - ix, fz = -sz - iz
      const saturation = 0.69 - 0.09 * level
      for (let z = 0; z < n; z++) {
        const az = z + iz, oz = Math.max(0, Math.min(n - 2, az))
        const dz = az < 0 ? 0 : az >= n - 1 ? 1 : fz
        const row = (y * n + oz) * n
        const outRow = y * n + z, range = outRow * 2
        let start = this._sourceRanges[range], end = this._sourceRanges[range + 1]
        const input = (y * n + oz) * 2, r = this._activeRanges
        const upstreamStart = Math.min(r[input], r[input + 2])
        if (!initial && upstreamStart < n) {
          start = Math.min(start, upstreamStart - ix - 1)
          end = Math.max(end, Math.max(r[input + 1], r[input + 3]) - ix)
        }
        for (let x = Math.max(0, start), stop = Math.min(n - 1, end); x <= stop; x++) {
          const k = outRow * n + x
          const core = Math.min(1.4, this._core[k]), lift = Math.min(1, this._lift[k])
          let prevVapor = 0, prevWater = 0
          if (!initial) {
            const ax = x + ix, a = row + Math.max(0, Math.min(n - 2, ax)), b = a + n
            const dx = ax < 0 ? 0 : ax >= n - 1 ? 1 : fx
            prevVapor = horizontal(vapor, a, b, dx, dz)
            prevWater = horizontal(water, a, b, dx, dz)
            if (y > 0 && lift > 0) {
              const up = Math.min(1, lift * liftScale)
              prevVapor += (horizontal(vapor, a - plane, b - plane, dx, dz) - prevVapor) * up
              prevWater += (horizontal(water, a - plane, b - plane, dx, dz) - prevWater) * up
            }
          }
          // La mezcla húmeda procede de las corrientes de todas las nubes cercanas.
          const supply = lift * (0.46 + 0.28 * humidity)
          const target = Math.max(0, background + supply - saturation)
          const excess = prevVapor + (target - prevVapor) * blend
          const cloud = coverage > 0.001 ? clamp01(core * 1.45 + excess * Math.min(1, lift * 4) * 2.8) : 0
          const rate = initial ? 1 : cloud > prevWater ? 0.20 : 0.20 + (1 - humidity) * 0.24
          const next = prevWater + (cloud - prevWater) * rate
          this._nextVapor[k] = excess > 0.001 ? excess : 0
          this._nextWater[k] = next > 0.001 ? next : 0
          if (excess > 0.001 || next > 0.001) {
            this._nextRanges[range] = Math.min(this._nextRanges[range], x)
            this._nextRanges[range + 1] = x
          }
          peak = Math.max(peak, next)
        }
      }
    }
    this._swap()
    const ranges = this._activeRanges
    this._activeRanges = this._nextRanges; this._nextRanges = ranges
    this.hasClouds = peak > 0.012
  }

  _swap() {
    const water = this._water, vapor = this._vapor
    this._water = this._nextWater; this._nextWater = water
    this._vapor = this._nextVapor; this._nextVapor = vapor
  }

  _indexActivity() {
    const n = this.N, r = this._activeRanges
    clearRanges(r, n)
    for (let row = 0; row < r.length / 2; row++) {
      for (let x = 0; x < n; x++) {
        const k = row * n + x
        if (!(this._water[k] || this._vapor[k])) continue
        r[row * 2] = Math.min(r[row * 2], x)
        r[row * 2 + 1] = x
      }
    }
  }

  sample(x, altitude, z) {
    if (!this.hasClouds) return 0
    const ix = (x - this.cx + this.half) / this.spacing - 0.5, iz = (z - this.cz + this.half) / this.spacing - 0.5
    const iy = (altitude - this.base) / this.height * DEPTH - 0.5
    const density = trilinear(this._water, this.N, ix, iy, iz)
    if (this.blend >= 1) return density
    return density * this.blend + trilinear(this._previous, this.N, ix, iy, iz) * (1 - this.blend)
  }

  contains(x, z) {
    return this.version > 0 && Math.abs(x - this.cx) < this.half && Math.abs(z - this.cz) < this.half
  }

  snapshot() {
    if (!this.version || (!this.hasClouds && !this._hasSources)) return null
    return { N: this.N, half: this.half, bounds: [this.cx, this.cz, this.base, this.height],
      pending: this.pending, blend: this.blend, water: encodeCloudWater(this) }
  }

  restore(state) {
    const { N, half, bounds, pending, blend, water } = state
    if (N !== this.N || half !== this.half || !Array.isArray(bounds) || bounds.length !== 4
      || bounds.some(v => !Number.isFinite(v)) || bounds[3] <= 0
      || !Number.isFinite(pending) || pending < 0 || pending > 2
      || !Number.isFinite(blend) || blend < 0 || blend > 1) throw new Error('Nubes: snapshot de condensado incompatible')
    const bytes = decodeCloudWater(water, this._water.length * 3)
    ;[this.cx, this.cz, this.base, this.height] = bounds
    this._previous = this._nextWater
    this.hasClouds = false
    for (let k = 0; k < this._water.length; k++) {
      this.data[k * 2] = bytes[k * 3]; this.data[k * 2 + 1] = bytes[k * 3 + 1]
      this._previous[k] = bytes[k * 3] / 255; this._water[k] = bytes[k * 3 + 1] / 255
      this._vapor[k] = bytes[k * 3 + 2] / 255
      if (this._water[k] > 0.012) this.hasClouds = true
    }
    this.pending = pending; this.blend = blend
    this._indexActivity()
    this.version++
  }
}
