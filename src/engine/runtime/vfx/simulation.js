import { validateVfxResource } from './resource.js'

export const VFX_STEP_SECONDS = 1 / 60
export const VFX_MAX_STEPS = 6
export const VFX_MAX_PARTICLES = 1024

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const srgb = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
const rgb = (hex) => [srgb(parseInt(hex.slice(1, 3), 16)), srgb(parseInt(hex.slice(3, 5), 16)), srgb(parseInt(hex.slice(5, 7), 16))]

function curveValue(points, t, field) {
  if (t <= points[0].t) return points[0][field]
  for (let i = 1; i < points.length; i++) {
    const b = points[i]
    if (t <= b.t) {
      const a = points[i - 1], u = (t - a.t) / (b.t - a.t)
      return a[field] + (b[field] - a[field]) * u
    }
  }
  return points[points.length - 1][field]
}

// El gradiente se calcula una vez por recurso, nunca se analiza el texto hexadecimal por frame.
function colorStops(points) { return points.map(p => ({ t: p.t, color: rgb(p.color) })) }
function colorAt(stops, t, out, offset, base) {
  let i = 1
  while (i < stops.length - 1 && t > stops[i].t) i++
  const a = stops[i - 1], b = stops[i], u = Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t)))
  for (let c = 0; c < 3; c++) out[offset + c] = (a.color[c] + (b.color[c] - a.color[c]) * u) * base[c]
}

function transformPoint(m, x, y, z, out, offset) {
  out[offset] = m[0] * x + m[4] * y + m[8] * z + m[12]
  out[offset + 1] = m[1] * x + m[5] * y + m[9] * z + m[13]
  out[offset + 2] = m[2] * x + m[6] * y + m[10] * z + m[14]
}
function transformDirection(m, x, y, z, out, offset) {
  out[offset] = m[0] * x + m[4] * y + m[8] * z
  out[offset + 1] = m[1] * x + m[5] * y + m[9] * z
  out[offset + 2] = m[2] * x + m[6] * y + m[10] * z
}

/** Un emisor CPU sin dependencias gráficas. El recurso nunca almacena partículas ni tiempos. */
export class VfxSimulation {
  constructor(resource, { seed = 1 } = {}) {
    this.resource = validateVfxResource(resource)
    if (!Number.isSafeInteger(seed)) throw new Error('VFX: semilla entera requerida')
    this.seed = seed >>> 0
    this.capacity = this.resource.emission.capacity
    this.position = new Float32Array(this.capacity * 3)
    this.velocity = new Float32Array(this.capacity * 3)
    this.age = new Float64Array(this.capacity)
    this.lifetime = new Float64Array(this.capacity)
    this.size = new Float32Array(this.capacity)
    this.opacity = new Float32Array(this.capacity)
    this.rotation = new Float32Array(this.capacity)
    this.color = new Float32Array(this.capacity * 3)
    this._stops = colorStops(this.resource.evolution.color)
    this._baseColor = rgb(this.resource.appearance.color)
    this.reset()
  }

  reset() {
    this.count = 0
    this.elapsed = 0
    this.accumulator = 0
    this.emitRemainder = 0
    this._rng = this.seed || 0x6d2b79f5
    this._burstStarted = false
    this._burstCycle = 0
    this.droppedSeconds = 0
    this.droppedBirths = 0
    this.totalBirths = 0
    this.position.fill(0); this.velocity.fill(0); this.age.fill(0); this.lifetime.fill(0)
    this.size.fill(0); this.opacity.fill(0); this.rotation.fill(0); this.color.fill(0)
  }

  _random() {
    let x = this._rng
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5
    this._rng = x >>> 0
    return this._rng / 4294967296
  }

  _spawn(matrix) {
    if (this.count >= this.capacity) { this.droppedBirths++; return }
    const r = this.resource, i = this.count++, k = 3 * i
    const b = r.birth, m = r.movement
    let x = 0, y = 0, z = 0
    if (b.shape === 'box') {
      x = (this._random() - 0.5) * b.box[0]
      y = (this._random() - 0.5) * b.box[1]
      z = (this._random() - 0.5) * b.box[2]
    } else if (b.shape === 'sphere') {
      const h = this._random() * 2 - 1, a = this._random() * Math.PI * 2
      const d = Math.cbrt(this._random()) * b.radius, s = Math.sqrt(1 - h * h)
      x = d * s * Math.cos(a); y = d * h; z = d * s * Math.sin(a)
    }
    const dirX = m.spread ? (this._random() * 2 - 1) * m.spread : 0
    const dirZ = m.spread ? (this._random() * 2 - 1) * m.spread : 0
    const vx = dirX, vy = m.speed, vz = dirZ
    if (m.space === 'world') {
      transformPoint(matrix, x, y, z, this.position, k)
      transformDirection(matrix, vx, vy, vz, this.velocity, k)
    } else {
      this.position[k] = x; this.position[k + 1] = y; this.position[k + 2] = z
      this.velocity[k] = vx; this.velocity[k + 1] = vy; this.velocity[k + 2] = vz
    }
    // Influencia externa opcional de nacimiento; el recurso .vfx no conoce el clima.
    if (this.spawnAt) this.spawnAt(this.position, k)
    this.age[i] = 0
    this.lifetime[i] = b.lifetime[0] + this._random() * (b.lifetime[1] - b.lifetime[0])
    this.rotation[i] = r.appearance.rotation * Math.PI / 180
    this._appearance(i)
    this.totalBirths++
  }

  _appearance(i) {
    const t = Math.min(1, this.age[i] / this.lifetime[i]), r = this.resource
    this.size[i] = r.appearance.size * curveValue(r.evolution.size, t, 'value')
    this.opacity[i] = Math.min(1, r.appearance.opacity * curveValue(r.evolution.opacity, t, 'value'))
    colorAt(this._stops, t, this.color, i * 3, this._baseColor)
  }

  _ageParticles(dt) {
    const a = this.resource.movement.acceleration
    const vortex = this.resource.movement.space === 'world' && this.flowAt
    let i = 0
    while (i < this.count) {
      const age = this.age[i] + dt
      if (age + 1e-10 >= this.lifetime[i]) {
        const last = --this.count, j = i * 3, k = last * 3
        if (i !== last) {
          this.age[i] = this.age[last]; this.lifetime[i] = this.lifetime[last]
          this.size[i] = this.size[last]; this.opacity[i] = this.opacity[last]; this.rotation[i] = this.rotation[last]
          for (let c = 0; c < 3; c++) {
            this.position[j + c] = this.position[k + c]
            this.velocity[j + c] = this.velocity[k + c]
            this.color[j + c] = this.color[k + c]
          }
        }
        continue
      }
      this.age[i] = age
      const k = i * 3
      if (vortex) {
        const flow=vortex(this.position[k],this.position[k+1],this.position[k+2])
        if (flow && [flow.x,flow.y,flow.z].every(Number.isFinite)) {
          // Advección acotada: el viento cambia la trayectoria del VFX, no la autoridad física.
          this.velocity[k]+=(flow.x-this.velocity[k])*Math.min(1,dt*3)
          this.velocity[k+1]+=(flow.y-this.velocity[k+1])*Math.min(1,dt*3)
          this.velocity[k+2]+=(flow.z-this.velocity[k+2])*Math.min(1,dt*3)
        }
      }
      for (let c = 0; c < 3; c++) {
        this.position[k + c] += this.velocity[k + c] * dt + a[c] * dt * dt * 0.5
        this.velocity[k + c] += a[c] * dt
      }
      this._appearance(i)
      i++
    }
  }

  _step(dt, matrix) {
    this._ageParticles(dt)
    // Emisores meteorológicos opcionales: los supervivientes envejecen aunque no nazcan partículas.
    if (this.emissionEnabled === false) { this.elapsed += dt; return }
    const e = this.resource.emission
    if (e.mode === 'burst') {
      if (!this._burstStarted) {
        this._burstStarted = true
        for (let n = 0; n < e.burstCount; n++) this._spawn(matrix)
      }
      if (e.loop && e.duration > 0) {
        const cycle = Math.floor((this.elapsed + dt + 1e-9) / e.duration)
        if (cycle > this._burstCycle) {
          // Si pasan varios ciclos durante un paso, solo se conserva la emisión del ciclo actual.
          this._burstCycle = cycle
          for (let n = 0; n < e.burstCount; n++) this._spawn(matrix)
        }
      }
    } else {
      const remaining = e.duration > 0 && !e.loop ? Math.max(0, e.duration - this.elapsed) : dt
      const activeDt = Math.min(dt, remaining)
      this.emitRemainder += e.rate * activeDt
      const births = Math.floor(this.emitRemainder + 1e-9)
      this.emitRemainder = Math.max(0, this.emitRemainder - births)
      for (let n = 0; n < births; n++) this._spawn(matrix)
    }
    this.elapsed += dt
  }

  /** dt de reloj del host; no ejecuta más de VFX_MAX_STEPS ni acumula deuda indefinida. */
  update(dt, matrixWorld = identity) {
    if (!Number.isFinite(dt) || dt < 0) throw new Error('VFX: dt debe ser finito y no negativo')
    const matrix = matrixWorld?.elements ?? matrixWorld
    if (!matrix || matrix.length !== 16) throw new Error('VFX: matriz de emisor inválida')
    for (let i = 0; i < 16; i++) if (!Number.isFinite(matrix[i])) throw new Error('VFX: matriz de emisor inválida')
    const added = this.accumulator + dt
    const bounded = Math.min(added, VFX_STEP_SECONDS * VFX_MAX_STEPS)
    this.droppedSeconds += Math.max(0, added - bounded)
    this.accumulator = bounded
    let steps = 0
    while (steps < VFX_MAX_STEPS && this.accumulator + 1e-10 >= VFX_STEP_SECONDS) {
      this._step(VFX_STEP_SECONDS, matrix)
      this.accumulator -= VFX_STEP_SECONDS
      steps++
    }
    return steps
  }

  /** Un paso exacto, independiente de la pausa externa y del acumulador del host. */
  step(matrixWorld = identity) {
    const matrix = matrixWorld?.elements ?? matrixWorld
    if (!matrix || matrix.length !== 16) throw new Error('VFX: matriz de emisor inválida')
    for (let i = 0; i < 16; i++) if (!Number.isFinite(matrix[i])) throw new Error('VFX: matriz de emisor inválida')
    this._step(VFX_STEP_SECONDS, matrix)
    return 1
  }
}
