// Atmósfera: temperatura, humedad/niebla (punto de rocío), viento con rachas estocásticas y el director de clima aleatorio.
// Portado del Environment de FrostEngine (autoría del usuario): FrostEnvironmentAtmosphericMoistureModel, WindSimulation y WeatherDirector.
// Sin DOM ni THREE. Todo son números y funciones puras (más tres clases con su propio estado, alimentadas con un azar que se les pasa).

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const lerp = (a, b, t) => a + (b - a) * t
const smooth = (a, b, x) => { if (b <= a) return x >= b ? 1 : 0; const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }
const expResp = (dt, tau) => (tau <= 1e-4 ? 1 : 1 - Math.exp(-Math.max(0, dt) / tau))

/** Presión de vapor de saturación (hPa) a esa temperatura (°C). */
export const satVapor = (T) => { T = clamp(T, -60, 60); return 6.112 * Math.exp((17.62 * T) / (243.12 + T)) }
/** Punto de rocío (°C) de una presión de vapor (hPa). */
export const dewPoint = (e) => { const g = Math.log(Math.max(0.001, e) / 6.112); return (243.12 * g) / (17.62 - g) }

/** Precipitación en mm/h a partir de la intensidad 0–1 del motor (45 mm/h = lluvia a pleno, como en FrostEngine). La nieve cuenta como agua equivalente. */
export const precipMm = (rain, snow = 0) => 45 * rain * rain + 6 * snow * snow

/** Temperatura del aire (°C): base + desvío del tiempo + ciclo diario (máximo a las 15 h, mínimo a las 3 h). */
export function airTemperature(hour, base, dailyRange, offset = 0) {
  const a = (((((hour % 24) + 24) % 24) - 15) / 24) * Math.PI * 2
  return base + offset + Math.cos(a) * dailyRange * 0.5
}

/**
 * Humedad relativa y fracción de niebla de equilibrio. `s` = { humidity (a la temperatura de referencia), temperature, coverage, density, precip (mm/h) };
 * `refTemp` = temperatura sin ciclo diario; `solar` = { daylight 0–1, intensity 0–1 }; `wind` en m/s.
 * De noche la temperatura baja → el aire se acerca al punto de rocío → hay niebla; con sol y viento se disipa.
 */
export function moistureEquilibrium(s, refTemp, solar, wind) {
  const refH = clamp(s.humidity, 0.01, 1)
  const vapor = satVapor(refTemp) * refH, satNow = satVapor(s.temperature)
  const rh = clamp(satNow <= 1e-4 ? refH : vapor / satNow, 0.01, 1)
  const spread = Math.max(0, s.temperature - dewPoint(vapor))
  const avail = smooth(0.7, 0.98, rh), prox = 1 - smooth(0.35, 6, spread)
  let cond = clamp(avail * 0.42 + prox * 0.72, 0, 1); cond *= cond
  const shade = clamp(s.coverage * lerp(0.55, 1, s.density), 0, 1)
  const shield = smooth(0.15, 4, s.precip)
  const heating = clamp(solar.daylight * solar.intensity * (1 - shade * 0.82) * (1 - shield * 0.7), 0, 1)
  const mix = smooth(1.5, 12, Math.max(0, wind))
  const frac = clamp(cond * lerp(1, 0.48, mix) * lerp(1, 0.34, heating) * lerp(1, 1.18, shield), 0, 1)
  return { humidity: rh, fogFrac: frac, heating }
}

/** Humedad y niebla efectivas: la humedad responde en ~5 min, la niebla se forma en 5–20 min y se disipa en 4–15 (más rápido con sol). Tiempos en segundos simulados. */
export class Moisture {
  constructor() { this.init = false; this.humidity = 0.5; this.fog = 0 }
  /** `fogRef` = densidad de niebla del tiempo (la «de referencia»); devuelve { humidity, fog }. */
  update(s, refTemp, solar, wind, dt, fogRef) {
    const eq = moistureEquilibrium(s, refTemp, solar, wind), eqFog = Math.max(0, fogRef) * eq.fogFrac
    if (!this.init) { this.humidity = eq.humidity; this.fog = eqFog; this.init = true }
    else if (dt > 0) {
      this.humidity = lerp(this.humidity, eq.humidity, expResp(dt, 300))
      const tau = eqFog > this.fog ? lerp(1200, 300, clamp(eq.humidity, 0, 1)) : lerp(900, 240, clamp(solar.daylight * solar.intensity, 0, 1))
      this.fog = lerp(this.fog, eqFog, expResp(dt, tau))
    }
    return { humidity: clamp(this.humidity, 0.01, 1), fog: Math.max(0, this.fog) }
  }
}

/** Normal estándar (Marsaglia) sobre un generador uniforme `rng`. */
export function gaussian(rng) {
  let spare = null
  return () => {
    if (spare !== null) { const v = spare; spare = null; return v }
    let u, v, s
    do { u = rng() * 2 - 1; v = rng() * 2 - 1; s = u * u + v * v } while (s <= 1e-12 || s >= 1)
    const m = Math.sqrt((-2 * Math.log(s)) / s); spare = v * m; return u * m
  }
}

/** Rachas de Ornstein-Uhlenbeck: la velocidad y la dirección oscilan alrededor del viento base con memoria (no hay saltos ni se repite). */
export class WindGusts {
  constructor(rng) { this.g = gaussian(rng); this.speed = 0; this.dir = 0 }
  /** `reversion` ≈ 0,9 /s, `volatility` ≈ 1,8 m/s/√s (FrostEngine). */
  step(dt, reversion = 0.9, volatility = 1.8) {
    if (!(dt > 0)) return
    const th = Math.max(0.01, reversion), sg = Math.max(0, volatility), r = Math.sqrt(Math.max(1e-4, dt))
    this.speed += -th * this.speed * dt + sg * r * this.g()
    this.dir += -th * 0.35 * this.dir * dt + sg * 2.5 * r * this.g()
  }
  /** { speed, dir, x, z } en ejes del motor (dir: 0 = norte −Z, 90 = este +X). */
  at(base, dirDeg) {
    const sp = Math.max(0, base + this.speed), d = dirDeg + this.dir, a = (d * Math.PI) / 180
    return { speed: sp, dir: d, x: Math.sin(a) * sp, z: -Math.cos(a) * sp }
  }
}

/** Perfiles por defecto del director (ids de PRESETS). weight = probabilidad relativa; min/max = minutos que dura. */
export const DIRECTOR_DEFAULTS = [
  { preset: 'clear', weight: 3, minMinutes: 20, maxMinutes: 60 },
  { preset: 'partly', weight: 3, minMinutes: 15, maxMinutes: 45 },
  { preset: 'cloudy', weight: 2, minMinutes: 15, maxMinutes: 40 },
  { preset: 'overcast', weight: 1.5, minMinutes: 10, maxMinutes: 30 },
  { preset: 'fog', weight: 0.7, minMinutes: 15, maxMinutes: 40 },
  { preset: 'drizzle', weight: 1, minMinutes: 8, maxMinutes: 20 },
  { preset: 'rain', weight: 1.5, minMinutes: 10, maxMinutes: 30 },
  { preset: 'storm', weight: 0.6, minMinutes: 6, maxMinutes: 15 },
]

/**
 * Director de clima: elige al azar (con pesos) el siguiente tiempo, espera lo que dure el actual y cambia de forma gradual
 * (transMin–transMax minutos) o, con probabilidad `abruptChance`, brusca (abruptMin–abruptMax segundos). Tiempos en segundos SIMULADOS.
 *   const d = new Director(cfg, rng); d.settle('clear')       // empieza en «clear»
 *   const ch = d.update(simDt)                                  // null o { id, simSeconds, abrupt }: el mundo debe pasar a ese tiempo en ese rato
 */
export class Director {
  constructor(cfg, rng) { this.cfg = cfg; this.rng = rng; this.current = null; this.dwell = 60; this.busy = 0 }
  _range(a, b) { return b <= a ? a : a + (b - a) * this.rng() }
  _profile(id) { return this.cfg.profiles.find((p) => p.preset === id) }
  _dwell(id) { const p = this._profile(id); if (!p) return 60; const mn = Math.max(0.1, p.minMinutes), mx = Math.max(mn, p.maxMinutes); return this._range(mn, mx) * 60 }
  /** Pasa a `id` ya establecido (inicio, o un script lo cambió): empieza a contar lo que dura. */
  settle(id) { this.current = id; this.busy = 0; this.dwell = this._dwell(id) }
  /** Elige el siguiente (no el actual) según los pesos; null si no hay otro. */
  pick() {
    const list = this.cfg.profiles.filter((p) => p.preset !== this.current)
    const total = list.reduce((a, p) => a + Math.max(0, p.weight), 0)
    if (!list.length) return null
    if (total <= 1e-4) return list[0].preset
    let r = this._range(0, total)
    for (const p of list) { r -= Math.max(0, p.weight); if (r <= 0) return p.preset }
    return list[list.length - 1].preset
  }
  /** Primer tiempo al empezar en modo «al azar». */
  pickAny() { const c = this.current; this.current = null; const id = this.pick(); this.current = c; return id }
  update(dt) {
    if (!(dt > 0)) return null
    if (this.busy > 0) { this.busy -= dt; if (this.busy <= 0) { this.busy = 0; this.dwell = this._dwell(this.current) } return null }
    this.dwell -= dt
    if (this.dwell > 0) return null
    const id = this.pick()
    if (!id) { this.dwell = 60; return null }
    const c = this.cfg, abrupt = this.rng() < clamp(c.abruptChance, 0, 1)
    const sec = abrupt ? this._range(Math.max(0, c.abruptMin), Math.max(c.abruptMin, c.abruptMax)) : this._range(Math.max(0, c.transMin), Math.max(c.transMin, c.transMax)) * 60
    this.current = id; this.busy = Math.max(1e-3, sec)
    return { id, simSeconds: sec, abrupt }
  }
}
