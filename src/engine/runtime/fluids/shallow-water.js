// Fluido superficial conservativo: profundidad y momento por celda (Saint-Venant 2.5D).
// Sin renderer, DOM ni Jolt. El host posee el reloj y la integración de escena.
const G = 9.81
const DRY = 1e-9
const CFL = 0.4
const MAX_CELLS = 65536
const MAX_SUBSTEPS = 256
import { normalizeLiquid, WATER_LIQUID } from './liquid.js'
import { displacementHeights } from './solids.js'
const directions = ['west', 'east', 'north', 'south']

function positive(value, label, allowZero = false) {
  if (!Number.isFinite(value) || (allowZero ? value < 0 : value <= 0)) throw new RangeError(`${label}: número fuera de rango`)
  return value
}
function arrayOf(values, length, label, initial = 0) {
  if (values == null) return new Float64Array(length).fill(initial)
  if (values.length !== length) throw new RangeError(`${label}: longitud incompatible`)
  const out = new Float64Array(length)
  for (let k = 0; k < length; k++) {
    if (!Number.isFinite(values[k])) throw new RangeError(`${label}: valor no finito en ${k}`)
    out[k] = values[k]
  }
  return out
}

// HLL con reconstrucción hidrostática: el flujo de cada lado corrige la presión
// de fondo para que una superficie plana permanezca quieta sobre relieve irregular.
function flux(hA, qxA, qzA, bedA, hB, qxB, qzB, bedB, axis, out) {
  const crest = Math.max(bedA, bedB)
  const ha = Math.max(0, bedA + hA - crest)
  const hb = Math.max(0, bedB + hB - crest)
  const ua = hA > DRY ? qxA / hA : 0, va = hA > DRY ? qzA / hA : 0
  const ub = hB > DRY ? qxB / hB : 0, vb = hB > DRY ? qzB / hB : 0
  const na = axis === 0 ? ua : va, nb = axis === 0 ? ub : vb
  const ta = axis === 0 ? va : ua, tb = axis === 0 ? vb : ub
  const ca = Math.sqrt(G * ha), cb = Math.sqrt(G * hb)
  const qa = ha * na, qb = hb * nb
  const fa0 = qa, fb0 = qb
  const fa1 = qa * na + 0.5 * G * ha * ha, fb1 = qb * nb + 0.5 * G * hb * hb
  const fa2 = qa * ta, fb2 = qb * tb
  let sl = Math.min(na - ca, nb - cb), sr = Math.max(na + ca, nb + cb)
  if (ha <= DRY && hb > DRY) sl = Math.min(sl, nb - 2 * cb)
  if (hb <= DRY && ha > DRY) sr = Math.max(sr, na + 2 * ca)
  let fh = 0, fn = 0, ft = 0
  if (sl >= 0) { fh = fa0; fn = fa1; ft = fa2 }
  else if (sr <= 0) { fh = fb0; fn = fb1; ft = fb2 }
  else if (sr > sl) {
    const inv = 1 / (sr - sl)
    fh = (sr * fa0 - sl * fb0 + sl * sr * (hb - ha)) * inv
    fn = (sr * fa1 - sl * fb1 + sl * sr * (qb - qa)) * inv
    ft = (sr * fa2 - sl * fb2 + sl * sr * (hb * tb - ha * ta)) * inv
  }
  out[0] = fh
  out[1] = axis === 0 ? fn : ft
  out[2] = axis === 0 ? ft : fn
  out[3] = 0.5 * G * (hA * hA - ha * ha)
  out[4] = 0.5 * G * (hB * hB - hb * hb)
  return out
}

/** Dominio de fluido homogéneo; unidades SI. Una sola autoridad de volumen y momento. */
export class FluidRegion {
  static liquid = WATER_LIQUID
  static displacementHeights = displacementHeights
  get liquid() { return this._liquid }

  constructor(config) {
    const { id, name = id, x = 0, z = 0, width, height, cellSize = 1, cellSizeZ = cellSize,
      bed, valid, depth, velocityX, velocityZ, blockX, blockZ, boundaries = {}, color = '#3a78a8',
      deepColor = '#12365a', clarity = 6, hydrology = null } = config || {}
    if (config?.liquidId && config.liquidId !== 'water' && !config.liquid) throw new Error('Región: líquido no soportado sin perfil físico explícito')
    this._liquid = normalizeLiquid(config?.liquid || WATER_LIQUID)
    if (typeof id !== 'string' || !id.trim()) throw new Error('Región de agua: id obligatorio')
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2 || width * height > MAX_CELLS) throw new RangeError('Región de agua: dimensiones inválidas')
    positive(cellSize, 'cellSize'); positive(cellSizeZ, 'cellSizeZ')
    if (!Number.isFinite(x) || !Number.isFinite(z)) throw new RangeError('Región de agua: origen inválido')
    const n = width * height
    this.id = id; this.name = name; this.x = x; this.z = z
    this.width = width; this.height = height; this.dx = cellSize; this.dz = cellSizeZ
    this.color = color; this.deepColor = deepColor; this.clarity = clarity
    this.bed = arrayOf(bed, n, 'bed')
    this.occupied = new Float64Array(n) // elevación equivalente del volumen sólido, NO agua nueva
    this.effectiveBed = this.bed.slice()
    this.valid = new Uint8Array(n).fill(1)
    if (valid != null) {
      if (valid.length !== n) throw new RangeError('valid: longitud incompatible')
      for (let k = 0; k < n; k++) this.valid[k] = valid[k] ? 1 : 0
    }
    this.depth = arrayOf(depth, n, 'depth')
    const vx = arrayOf(velocityX, n, 'velocityX'), vz = arrayOf(velocityZ, n, 'velocityZ')
    this.qx = new Float64Array(n); this.qz = new Float64Array(n)
    for (let k = 0; k < n; k++) {
      if (this.depth[k] < 0 || (!this.valid[k] && this.depth[k] > 0)) throw new RangeError('depth: profundidad incompatible con el fondo')
      this.qx[k] = this.depth[k] * vx[k]; this.qz[k] = this.depth[k] * vz[k]
    }
    this.blockX = this._blocks(blockX, (width + 1) * height, 'blockX')
    this.blockZ = this._blocks(blockZ, width * (height + 1), 'blockZ')
    this.boundaries = {}
    for (const side of directions) {
      const value = boundaries[side] ?? 'closed'
      if (value !== 'closed' && value !== 'open') throw new RangeError(`Borde ${side}: condición inválida`)
      this.boundaries[side] = value
    }
    this.initialVolume = this.volume()
    this.hydrology = hydrology ? this._initHydrology(hydrology) : null
    this.ledger = { added: 0, drained: 0, exited: 0 }
    this.pending = []
    this.revision = 0
    // Scratch residente: evita asignaciones grandes por subpaso.
    this._scratch = {
      upcoming: new Float64Array(n),
      xf: new Float64Array((width + 1) * height * 5), zf: new Float64Array(width * (height + 1) * 5),
      outflow: new Float64Array(n), limiter: new Float64Array(n),
      dH: new Float64Array(n), dX: new Float64Array(n), dZ: new Float64Array(n),
      face: new Float64Array(5),
    }
  }

  /** Estado versionado, independiente del renderer. No serializa buffers ni recursos GPU. */
  snapshot() {
    return { id: this.id, width: this.width, height: this.height, x: this.x, z: this.z,
      dx: this.dx, dz: this.dz, bed: Array.from(this.bed), valid: Array.from(this.valid),
      liquid: { ...this.liquid }, depth: Array.from(this.depth), qx: Array.from(this.qx), qz: Array.from(this.qz),
      ...(this.occupied.some((h) => h > 0) && { occupied: Array.from(this.occupied) }),
      initialVolume: this.initialVolume, ledger: { ...this.ledger },
      pending: this.pending.map(([k, v]) => [k, v]),
      ...(this.hydrology && { hydrology: {
        storage: Array.from(this.hydrology.storage), initialVolume: this.hydrology.initialVolume,
        drainedVolume: this.hydrology.drainedVolume, signature: this.hydrology.signature,
      } }) }
  }

  /** Comprueba el snapshot completo antes de tocar ningún dato físico. */
  validateSnapshot(s) {
    const n = this.depth.length
    if (s?.liquid && (s.liquid.id !== this.liquid.id || s.liquid.densityKgM3 !== this.liquid.densityKgM3)) throw new Error('Agua: líquido del snapshot incompatible')
    if (!s?.liquid && this.liquid.id !== 'water') throw new Error('Agua: snapshot anterior no representa este líquido')
    if (!s || s.id !== this.id || s.width !== this.width || s.height !== this.height ||
        s.x !== this.x || s.z !== this.z || s.dx !== this.dx || s.dz !== this.dz ||
        !Array.isArray(s.bed) || !Array.isArray(s.valid) || s.bed.length !== n || s.valid.length !== n ||
        s.bed.some((v, k) => v !== this.bed[k]) || s.valid.some((v, k) => v !== this.valid[k]))
      throw new Error(`Agua: geometría incompatible «${this.id}»`)
    if (!Array.isArray(s.depth) || !Array.isArray(s.qx) || !Array.isArray(s.qz))
      throw new Error('Agua: estado físico incompleto')
    const depth = arrayOf(s.depth, n, 'snapshot.depth'), qx = arrayOf(s.qx, n, 'snapshot.qx'), qz = arrayOf(s.qz, n, 'snapshot.qz')
    const occupied = arrayOf(s.occupied, n, 'snapshot.occupied')
    if (occupied.some((h,k) => h < 0 || h > 100 || (!this.valid[k] && h > 0)))
      throw new Error('Agua: ocupación geométrica del snapshot inválida')
    for (let k = 0; k < n; k++) if (depth[k] < 0 || (!this.valid[k] && (depth[k] || qx[k] || qz[k])) || (depth[k] <= DRY && (qx[k] || qz[k])))
      throw new Error(`Agua: celda física inválida «${this.id}»`)
    const ledger = s.ledger
    if (!ledger || !['added','drained','exited'].every((key) => Number.isFinite(ledger[key]) && ledger[key] >= 0) ||
        !Number.isFinite(s.initialVolume) || s.initialVolume < 0 || !Array.isArray(s.pending))
      throw new Error('Agua: balance de volumen inválido')
    const pending = s.pending.map((entry) => {
      if (!Array.isArray(entry) || entry.length !== 2 || !Number.isInteger(entry[0]) || entry[0] < 0 || entry[0] >= n ||
          !this.valid[entry[0]] || !Number.isFinite(entry[1])) throw new Error('Agua: aporte pendiente inválido')
      return [entry[0], entry[1]]
    })
    let soil = null, initialSoil = 0
    if (this.hydrology) {
      const stored = s.hydrology
      if (stored) {
        if (stored.signature !== this.hydrology.signature || !Number.isFinite(stored.initialVolume) || stored.initialVolume < 0 ||
            !Number.isFinite(stored.drainedVolume) || stored.drainedVolume < 0 ||
            stored.drainedVolume > ledger.drained + 1e-8) throw new Error('Hidrología: snapshot incompatible')
        soil = arrayOf(stored.storage, n, 'snapshot.soil')
        for (let k = 0; k < n; k++) if (soil[k] < 0 || soil[k] > this.hydrology.capacity[k] + 1e-9 || (!this.valid[k] && soil[k] !== 0))
          throw new Error('Hidrología: almacenamiento inválido')
        initialSoil = stored.initialVolume
      } else {
        // v1/v2: no existía almacenamiento hidráulico; conservar el estado inicial configurado.
        soil = this.hydrology.initial.slice()
        initialSoil = this.hydrology.initialVolume
      }
    } else if (s.hydrology) throw new Error('Hidrología: región sin simulación configurada')
    const volume = depth.reduce((a, h) => a + h, 0) * this.dx * this.dz +
      (soil ? soil.reduce((a, h) => a + h, 0) * this.dx * this.dz : 0)
    const target = s.initialVolume + initialSoil + ledger.added - ledger.drained - ledger.exited
    if (Math.abs(volume - target) > 1e-6 * Math.max(1, Math.abs(target))) throw new Error('Agua: conservación incompatible')
    return { depth, qx, qz, initialVolume: s.initialVolume, ledger: { ...ledger }, pending,
      soil, initialSoil, soilDrained: s.hydrology?.drainedVolume ?? 0, occupied }
  }

  restoreValidated(s) {
    this.depth.set(s.depth); this.qx.set(s.qx); this.qz.set(s.qz)
    this.initialVolume = s.initialVolume; this.ledger = s.ledger; this.pending = s.pending
    this._setOccupancy(s.occupied)
    if (this.hydrology) {
      this.hydrology.storage.set(s.soil)
      this.hydrology.initialVolume = s.initialSoil
      this.hydrology.drainedVolume = s.soilDrained
    }
    this.revision++
  }

  /** El inventario del suelo pertenece a la región, nunca a un shader. Unidades: metros de lámina. */
  _initHydrology(profile) {
    const n = this.depth.length
    const capacity = arrayOf(profile.capacity, n, 'hidrología.capacity')
    const infiltration = arrayOf(profile.infiltration, n, 'hidrología.infiltration')
    const drainage = arrayOf(profile.drainage, n, 'hidrología.drainage')
    const initial = arrayOf(profile.initial, n, 'hidrología.initial')
    for (let k = 0; k < n; k++) {
      if (capacity[k] < 0 || infiltration[k] < 0 || drainage[k] < 0 || initial[k] < 0 ||
          initial[k] > capacity[k] || (!this.valid[k] && (initial[k] || capacity[k] || infiltration[k] || drainage[k])))
        throw new RangeError('Hidrología: propiedades de celda inválidas')
    }
    const signature = JSON.stringify([this.id, this.width, this.height, this.dx, this.dz,
      Array.from(capacity), Array.from(infiltration), Array.from(drainage), Array.from(initial)])
    return { capacity, infiltration, drainage, initial, storage: initial.slice(), signature,
      initialVolume: initial.reduce((a,b) => a + b, 0) * this.dx * this.dz, drainedVolume: 0 }
  }

  /** Recalcula el perfil pintado sin crear ni destruir agua: el exceso regresa a superficie. */
  updateHydrology(profile) {
    if (!this.hydrology) throw new Error('Hidrología: región sin perfil')
    const fresh = this._initHydrology(profile), old = this.hydrology
    fresh.initialVolume = old.initialVolume
    fresh.drainedVolume = old.drainedVolume
    for (let k = 0; k < this.depth.length; k++) {
      const stored = old.storage[k], retained = Math.min(stored, fresh.capacity[k])
      fresh.storage[k] = retained
      if (stored > retained) this.depth[k] += stored - retained
    }
    this.hydrology = fresh
    this.revision++
  }

  storedVolume() { return this.hydrology ? this.hydrology.storage.reduce((a, h) => a + h, 0) * this.dx * this.dz : 0 }
  totalVolume() { return this.volume() + this.storedVolume() }
  moistureAt(col, row) {
    const h = this.hydrology, k = this.cell(col, row)
    return h && h.capacity[k] > 0 ? Math.min(1, h.storage[k] / h.capacity[k]) : 0
  }

  _blocks(values, length, label) {
    if (values != null && values.length !== length) throw new RangeError(`${label}: longitud incompatible`)
    const out = new Uint8Array(length)
    if (values) for (let i = 0; i < length; i++) out[i] = values[i] ? 1 : 0
    return out
  }

  /** Recalcula el fondo sin perder masa: el agua de celdas eliminadas busca el suelo válido más cercano. */
  replaceTerrain({ bed, valid, blockX, blockZ }) {
    const n = this.depth.length
    const B = arrayOf(bed, n, 'bed')
    if (!valid || valid.length !== n) throw new RangeError('valid: longitud incompatible')
    const V = new Uint8Array(n)
    for (let k = 0; k < n; k++) V[k] = valid[k] ? 1 : 0
    const BX = this._blocks(blockX, (this.width + 1) * this.height, 'blockX')
    const BZ = this._blocks(blockZ, this.width * (this.height + 1), 'blockZ')
    const nearestValid = (k) => {
      let best = -1, dist = Infinity
      const c = k % this.width, r = Math.floor(k / this.width)
      for (let q = 0; q < n; q++) {
        if (!V[q]) continue
        const dc = c - q % this.width, dr = r - Math.floor(q / this.width), d = dc * dc + dr * dr
        if (d < dist) { best = q; dist = d }
      }
      return best
    }
    let displaced = 0
    for (let k = 0; k < n; k++) {
      if (!this.valid[k] || V[k]) continue
      const h = this.depth[k]
      if (h > 0) {
        const best = nearestValid(k)
        if (best >= 0) this.depth[best] += h
        else displaced += h * this.dx * this.dz
      }
      if (this.hydrology?.storage[k] > 0) {
        const v = this.hydrology.storage[k], best = nearestValid(k)
        if (best >= 0) this.hydrology.storage[best] += v
        else displaced += v * this.dx * this.dz
        this.hydrology.storage[k] = 0
      }
      this.depth[k] = 0; this.qx[k] = 0; this.qz[k] = 0
    }
    // Un aporte solicitado antes de editar terreno no debe aparecer en una celda eliminada.
    this.pending = this.pending.flatMap(([k, v]) => {
      if (V[k]) return [[k, v]]
      const target = nearestValid(k)
      return target < 0 ? [] : [[target, v]]
    })
    // El relieve hace trabajo externo: mantenemos volumen, no forzamos la altura superficial anterior.
    this.bed = B; this.valid = V; this.blockX = BX; this.blockZ = BZ
    for (let k = 0; k < this.occupied.length; k++) if (!V[k]) this.occupied[k] = 0
    this.effectiveBed = Float64Array.from(B, (y, k) => y + this.occupied[k])
    this.revision++
    this.ledger.exited += displaced // salida explícita si toda la región pierde su suelo
    return displaced
  }

  /** Obstáculo móvil como altura equivalente. Conserva depth y el inventario de agua. */
  _setOccupancy(values) {
    const next = values || new Float64Array(this.depth.length)
    if (next.length !== this.depth.length) throw new RangeError('Agua: ocupación de tamaño inválido')
    let changed = false
    for (let k = 0; k < next.length; k++) {
      const h = next[k]
      if (!Number.isFinite(h) || h < 0 || h > 100 || (!this.valid[k] && h)) throw new RangeError('Agua: ocupación inválida')
      if (Math.abs(this.occupied[k] - h) > 1e-10) changed = true
    }
    if (changed) {
      this.occupied.set(next)
      for (let k = 0; k < next.length; k++) this.effectiveBed[k] = this.bed[k] + next[k]
      this.revision++
    }
  }

  contains(x, z) { return x >= this.x && x < this.x + this.width * this.dx && z >= this.z && z < this.z + this.height * this.dz }
  cell(col, row) {
    if (!Number.isInteger(col) || !Number.isInteger(row) || col < 0 || col >= this.width || row < 0 || row >= this.height) throw new RangeError('Celda de agua fuera de la región')
    const k = row * this.width + col
    if (!this.valid[k]) throw new RangeError('Celda de agua sin suelo físico válido')
    return k
  }
  volume() { let sum = 0; for (let k = 0; k < this.depth.length; k++) sum += this.depth[k]; return sum * this.dx * this.dz }
  balanceError() { return this.totalVolume() - (this.initialVolume + (this.hydrology?.initialVolume || 0) + this.ledger.added - this.ledger.drained - this.ledger.exited) }

  /** Cola de aportes y drenajes en m³; se aplica al inicio del próximo paso físico. */
  queue(col, row, volume) {
    const k = this.cell(col, row)
    if (!Number.isFinite(volume)) throw new RangeError('Volumen de agua no finito')
    if (volume === 0) return
    this.pending.push([k, volume])
  }

  sample(x, z) {
    if (!this.contains(x, z)) return null
    const col = Math.floor((x - this.x) / this.dx), row = Math.floor((z - this.z) / this.dz)
    const k = row * this.width + col, h = this.depth[k]
    if (!this.valid[k] || h <= DRY) return null
    return {
      surface: this.effectiveBed[k] + h, depth: h, flowX: this.qx[k] / h, flowZ: this.qz[k] / h,
      edge: Math.min(x - this.x, this.x + this.width * this.dx - x, z - this.z, this.z + this.height * this.dz - z),
      body: -1, id: this.bodyId || this.id, name: this.name, color: this.color, deepColor: this.deepColor, clarity: this.clarity,
    }
  }

  /** Perturbación de momento de una interacción física: nunca agrega masa. */
  disturb(x, z, power = 0.5, radius = 1) {
    if (![x, z, power, radius].every(Number.isFinite) || power < 0 || radius <= 0)
      throw new RangeError('Agua: perturbación inválida')
    if (power <= 0 || !this.contains(x, z)) return false
    const spread = Math.max(radius, Math.min(this.dx, this.dz) * 1.5)
    let changed = false
    for (let j = Math.max(0, Math.floor((z - spread - this.z)/this.dz)); j <= Math.min(this.height-1, Math.floor((z + spread - this.z)/this.dz)); j++)
      for (let i = Math.max(0, Math.floor((x - spread - this.x)/this.dx)); i <= Math.min(this.width-1, Math.floor((x + spread - this.x)/this.dx)); i++) {
        const k = j*this.width+i, h = this.depth[k]
        if (!this.valid[k] || h <= 0.002) continue
        const dx = this.x+(i+0.5)*this.dx-x, dz = this.z+(j+0.5)*this.dz-z
        const distance = Math.hypot(dx,dz)
        if (distance > spread) continue
        const weight = Math.exp(-3*(distance/spread)**2)
        // Límite de velocidad para el presupuesto CFL del solver.
        const impulse = Math.min(1.5, power) * weight / Math.max(distance, Math.min(this.dx,this.dz)*0.25)
        this.qx[k] = Math.max(-3*h, Math.min(3*h, this.qx[k]+h*dx*impulse))
        this.qz[k] = Math.max(-3*h, Math.min(3*h, this.qz[k]+h*dz*impulse))
        changed = true
      }
    if (changed) this.revision++
    return changed
  }

  _stableDt(cfl) {
    let sx = 0, sz = 0
    for (let k = 0; k < this.depth.length; k++) {
      const h = this.depth[k]
      if (!this.valid[k] || h <= DRY) continue
      const c = Math.sqrt(G * h)
      sx = Math.max(sx, Math.abs(this.qx[k] / h) + c)
      sz = Math.max(sz, Math.abs(this.qz[k] / h) + c)
    }
    return Math.min(sx > 0 ? cfl * this.dx / sx : Infinity, sz > 0 ? cfl * this.dz / sz : Infinity)
  }

  step(dt, cfl = CFL) {
    positive(dt, 'Paso físico')
    if (!Number.isFinite(cfl) || cfl <= 0 || cfl > 0.45) throw new RangeError('CFL fuera de rango')
    // Prevalidación conservadora de aportes: evita aplicar un volumen enorme antes de
    // comprobar si cabe en el presupuesto numérico del paso.
    let highestDepth = 0, highestU = 0, highestV = 0
    const upcoming = this._scratch.upcoming; upcoming.fill(0)
    for (const [k, v] of this.pending) if (v > 0) upcoming[k] += v / (this.dx * this.dz)
    for (let k = 0; k < this.depth.length; k++) {
      const h = this.depth[k]
      highestDepth = Math.max(highestDepth, h + upcoming[k])
      if (h > DRY) { highestU = Math.max(highestU, Math.abs(this.qx[k] / h)); highestV = Math.max(highestV, Math.abs(this.qz[k] / h)) }
    }
    const speed = Math.sqrt(G * highestDepth)
    const safeDt = Math.min(highestU + speed > 0 ? cfl * this.dx / (highestU + speed) : Infinity,
      highestV + speed > 0 ? cfl * this.dz / (highestV + speed) : Infinity)
    if (Number.isFinite(safeDt) && dt / safeDt > MAX_SUBSTEPS * 0.8) throw new RangeError('El paso físico exige demasiados subpasos')
    const before = this.volume()
    const area = this.dx * this.dz
    let added = 0, drained = 0
    for (const [k, v] of this.pending) {
      if (v > 0) { this.depth[k] += v / area; added += v }
      else {
        const amount = Math.min(-v, this.depth[k] * area)
        const old = this.depth[k]
        this.depth[k] -= amount / area
        const factor = old > 0 ? this.depth[k] / old : 0
        this.qx[k] *= factor; this.qz[k] *= factor
        drained += amount
      }
    }
    this.pending.length = 0
    this.ledger.added += added; this.ledger.drained += drained
    if (this.hydrology) {
      const soil = this.hydrology, area = this.dx * this.dz
      for (let k = 0; k < this.depth.length; k++) {
        if (!this.valid[k]) continue
        const infiltrated = Math.min(this.depth[k], Math.max(0, soil.capacity[k] - soil.storage[k]), soil.infiltration[k] * dt)
        if (infiltrated > 0) {
          const original = this.depth[k]
          this.depth[k] = Math.max(0, original - infiltrated)
          const fraction = original > 0 ? this.depth[k] / original : 0
          this.qx[k] *= fraction; this.qz[k] *= fraction
          soil.storage[k] += infiltrated
          this.revision++
        }
        const drainedSoil = Math.min(soil.storage[k], soil.drainage[k] * dt)
        if (drainedSoil > 0) {
          soil.storage[k] -= drainedSoil
          soil.drainedVolume += drainedSoil * area
          this.ledger.drained += drainedSoil * area
          this.revision++
        }
      }
    }
    if (before === 0 && added === 0) return { before, after: 0, added, drained, exited: 0, substeps: 0, error: this.balanceError() }
    let exited = 0, rest = dt, substeps = 0
    while (rest > Math.max(1e-12, dt * 1e-12)) {
      if (++substeps > MAX_SUBSTEPS) throw new RangeError('Límite de subpasos del solver')
      const hdt = Math.min(rest, this._stableDt(cfl))
      exited += this._advance(hdt)
      rest -= hdt
    }
    this.ledger.exited += exited
    if (before > 0 || added || drained || exited) this.revision++
    return { before, after: this.volume(), added, drained, exited, substeps, error: this.balanceError() }
  }

  _advance(dt) {
    const w = this.width, rows = this.height, n = w * rows
    const nx = (w + 1) * rows, nz = w * (rows + 1)
    const scratch = this._scratch
    const xf = scratch.xf, zf = scratch.zf; xf.fill(0); zf.fill(0)
    const outflow = scratch.outflow, limiter = scratch.limiter; outflow.fill(0); limiter.fill(1)
    const stepFlux = scratch.face
    const H = this.depth, X = this.qx, Z = this.qz, B = this.effectiveBed, V = this.valid
    const dx = dt / this.dx, dz = dt / this.dz
    const loadFace = (left, right, axis, target, base, open) => {
      if (left >= 0 && !V[left] || right >= 0 && !V[right]) {
        // Una celda inválida funciona como pared impermeable, no como agua que desaparece.
        const k = left >= 0 && V[left] ? left : right >= 0 && V[right] ? right : -1
        if (k >= 0) {
          if (left >= 0 && V[left]) target[base + 3] = 0.5 * G * H[left] * H[left]
          if (right >= 0 && V[right]) target[base + 4] = 0.5 * G * H[right] * H[right]
        }
        return
      }
      const a = left < 0 ? right : left, b = right < 0 ? left : right
      if (a < 0 || b < 0) return
      flux(left < 0 ? 0 : H[left], left < 0 ? 0 : X[left], left < 0 ? 0 : Z[left], B[a],
        right < 0 ? 0 : H[right], right < 0 ? 0 : X[right], right < 0 ? 0 : Z[right], B[b], axis, stepFlux)
      if (open && (left < 0 && stepFlux[0] > 0 || right < 0 && stepFlux[0] < 0)) stepFlux.fill(0)
      for (let q = 0; q < 5; q++) target[base + q] = stepFlux[q]
      const amount = stepFlux[0] * (axis === 0 ? dx : dz)
      if (amount > 0 && left >= 0) outflow[left] += amount
      if (amount < 0 && right >= 0) outflow[right] -= amount
    }
    for (let j = 0; j < rows; j++) for (let i = 0; i <= w; i++) {
      const left = i === 0 ? -1 : j * w + i - 1
      const right = i === w ? -1 : j * w + i
      const border = i === 0 ? 'west' : i === w ? 'east' : null
      if ((border && this.boundaries[border] === 'closed') || this.blockX[j * (w + 1) + i]) {
        const base = (j * (w + 1) + i) * 5
        if (left >= 0 && V[left]) xf[base + 3] = 0.5 * G * H[left] * H[left]
        if (right >= 0 && V[right]) xf[base + 4] = 0.5 * G * H[right] * H[right]
        continue
      }
      loadFace(left, right, 0, xf, (j * (w + 1) + i) * 5, !!border)
    }
    for (let j = 0; j <= rows; j++) for (let i = 0; i < w; i++) {
      const top = j === 0 ? -1 : (j - 1) * w + i
      const bottom = j === rows ? -1 : j * w + i
      const border = j === 0 ? 'north' : j === rows ? 'south' : null
      if ((border && this.boundaries[border] === 'closed') || this.blockZ[j * w + i]) {
        const base = (j * w + i) * 5
        if (top >= 0 && V[top]) zf[base + 3] = 0.5 * G * H[top] * H[top]
        if (bottom >= 0 && V[bottom]) zf[base + 4] = 0.5 * G * H[bottom] * H[bottom]
        continue
      }
      loadFace(top, bottom, 1, zf, (j * w + i) * 5, !!border)
    }
    for (let k = 0; k < n; k++) if (outflow[k] > H[k]) limiter[k] = H[k] > 0 ? H[k] / outflow[k] : 0
    const dH = scratch.dH, dX = scratch.dX, dZ = scratch.dZ
    dH.fill(0); dX.fill(0); dZ.fill(0)
    let exited = 0
    for (let j = 0; j < rows; j++) for (let i = 0; i <= w; i++) {
      const left = i === 0 ? -1 : j * w + i - 1
      const right = i === w ? -1 : j * w + i
      const base = (j * (w + 1) + i) * 5
      let f = xf[base]
      if (f === 0 && xf[base + 1] === 0 && xf[base + 3] === 0 && xf[base + 4] === 0) continue
      const scale = f > 0 && left >= 0 ? limiter[left] : f < 0 && right >= 0 ? limiter[right] : 1
      f *= scale
      const qx = xf[base + 1] * scale, qz = xf[base + 2] * scale
      if (left >= 0) { dH[left] -= f * dx; dX[left] -= (qx + xf[base + 3]) * dx; dZ[left] -= qz * dx }
      else exited -= f * this.dz * dt
      if (right >= 0) { dH[right] += f * dx; dX[right] += (qx + xf[base + 4]) * dx; dZ[right] += qz * dx }
      else exited += f * this.dz * dt
    }
    for (let j = 0; j <= rows; j++) for (let i = 0; i < w; i++) {
      const top = j === 0 ? -1 : (j - 1) * w + i
      const bottom = j === rows ? -1 : j * w + i
      const base = (j * w + i) * 5
      let f = zf[base]
      if (f === 0 && zf[base + 2] === 0 && zf[base + 3] === 0 && zf[base + 4] === 0) continue
      const scale = f > 0 && top >= 0 ? limiter[top] : f < 0 && bottom >= 0 ? limiter[bottom] : 1
      f *= scale
      const qx = zf[base + 1] * scale, qz = zf[base + 2] * scale
      if (top >= 0) { dH[top] -= f * dz; dX[top] -= qx * dz; dZ[top] -= (qz + zf[base + 3]) * dz }
      else exited -= f * this.dx * dt
      if (bottom >= 0) { dH[bottom] += f * dz; dX[bottom] += qx * dz; dZ[bottom] += (qz + zf[base + 4]) * dz }
      else exited += f * this.dx * dt
    }
    for (let k = 0; k < n; k++) {
      if (!V[k]) continue
      H[k] = Math.max(0, H[k] + dH[k])
      X[k] += dX[k]; Z[k] += dZ[k]
      // Fricción lineal macroscópica: el agua (viscosidad 1) conserva el solver histórico.
      if (this.liquid.viscosity !== 1) {
        const attenuation = Math.exp(-0.75 * Math.max(0, this.liquid.viscosity - 1) * dt)
        X[k] *= attenuation; Z[k] *= attenuation
      }
      if (H[k] <= DRY) { X[k] = 0; Z[k] = 0 }
    }
    return exited
  }
}

