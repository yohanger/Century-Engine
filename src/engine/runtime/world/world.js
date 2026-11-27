// El mundo vivo de una escena: hora del día, sol y luna, clima y viento. Sin DOM ni THREE (lo prueban los tests de Node).
//
//   const w = new World(); w.configure(environment)     // lo que dice el inspector (Hora · Clima)
//   w.update(dt)                                         // avanza el reloj, mezcla el tiempo, genera relámpagos
//   const f = w.frame()                                  // TODO lo que necesita el render, ya calculado
//
// `frame()` devuelve siempre el mismo objeto (sin basura por fotograma). Quien dibuja (viewport.js, world/fx.js) solo lee `f`:
// no hay lógica de clima repartida por el motor. Para scripts y eventos: game.clock y game.weather (play.js) llaman a
// setHour / setWeather / setFlow.
import { solarPosition, lunarPosition, directionOf, smooth } from './solar.js'
import { PRESETS, resolveWeather, blend, windAt, WEATHER_IDS, cloudBeamTransmission } from './weather.js'
import { normalizeWorld, SEASON_DAY } from './params.js'
import { astroState, addDays, moonPhaseName } from './astro.js'
import { FlashModel, resolveWorldStrike } from './lightning.js'
import { CloudField } from './cloudfield.js'
import { Director, Moisture, WindGusts, airTemperature, precipMm } from './atmosphere.js'
import { normalizeFog, visibilityOf, FOG } from './fog.js'
import { WindField, vortexVelocityAt } from './windfield.js'

const hex = (h, d = [0, 0, 0]) => (/^#[0-9a-f]{6}$/i.test(h || '') ? [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) : d)
const toHex = (c) => '#' + c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('')
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k]
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
const lerp = (a, b, t) => a + (b - a) * t
const WORLD_CLOUD_CELLS = 96 // celdas residentes (Frost: 56): con 96 el cielo cercano queda menos vacío; el horneado sigue siendo de pocos ms
const CLOUD_WIND = 1.6 // las nubes van más rápido que el viento del suelo (como las clásicas)
const smooth01 = (t) => { const k = Math.max(0, Math.min(1, t)); return k * k * (3 - 2 * k) }
const storm01 = (x) => Math.min(1, Math.max(0, x))
const TORNADO_PHASES = ['idle', 'development', 'organization', 'formation', 'active', 'weakening', 'dissipation', 'ended']
const moveTo = (c, t, d) => (Math.abs(t - c) <= d ? t : c + Math.sign(t - c) * d)
/** Color del tiempo nublado: pierde saturación y brillo según `dark` (0–1). */
const dull = (c, dark) => { const g = lum(c); return mix(c, [g, g, g * 1.04], Math.min(1, dark * 1.1)).map((v) => v * (1 - 0.42 * dark)) }

// Colores del sol según su altura (grados): rojizo en el horizonte, blanco cálido arriba
const SUN_STOPS = [[-2, '#ff5a1e'], [2, '#ff8a3c'], [8, '#ffb870'], [20, '#ffdba8'], [45, '#fff1dc'], [90, '#fff6ea']]
const MOON = hex('#8fa8e0')
const NIGHT = { top: hex('#03050d'), horizon: hex('#0a1224'), ground: hex('#040507'), ambient: hex('#18223b') }
const TWILIGHT = hex('#ff8a50')

function sunColor(elev) {
  const S = SUN_STOPS
  if (elev <= S[0][0]) return hex(S[0][1])
  for (let i = 1; i < S.length; i++) if (elev <= S[i][0]) return mix(hex(S[i - 1][1]), hex(S[i][1]), (elev - S[i - 1][0]) / (S[i][0] - S[i - 1][0]))
  return hex(S[S.length - 1][1])
}

function mulberry32(a) {
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

/** "14:30" a partir de horas decimales. */
export function formatHour(h) {
  const m = Math.round((((h % 24) + 24) % 24) * 60) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export class World {
  constructor(seed = 1) {
    this.rng = mulberry32(seed)
    this.drng = mulberry32((seed ^ 0x9e3779b9) >>> 0) // azar del director y de las rachas naturales (aparte del de los rayos)
    this._lm = new FlashModel(); this._strike = null; this._strikeN = 0
    this.autoOver = null; this.dir = null; this._gusts = new WindGusts(() => this.drng()); this._moist = new Moisture(); this._moistDt = 0
    this.cfg = normalizeWorld({})
    this.env = {}
    this.t = 0                       // segundos simulados (el viento y las rachas dependen de él)
    this.hour = 12
    this.forceAstro = false; this.dateOver = null // game.clock.setDate: fecha elegida por script (activa la astronomía real)
    this.dayAdd = 0                  // días enteros transcurridos desde la fecha inicial (solo con «Astronomía real»: la luna recorre sus fases)
    this.flow = false
    this.dayMinutes = 24
    this.forceTime = false           // game.clock.* lo activa aunque el inspector no controle la hora
    this.forceWeather = false
    this.preset = 'clear'; this.intensity = 1
    this.cur = resolveWeather('clear', 1)
    this._fade = null; this._htw = null
    this.windOff = [0, 0]            // desplazamiento acumulado del viento (m): las nubes lo siguen sin saltos aunque cambie la racha
    this.field = null                // campo nuboso nativo (cloudModel classic solo para escenas experimentales previas)
    this._obs = [0, 0, 0]            // dónde está el observador (cámara): lluvia local, rayos y sol tapado se miden desde ahí
    this._cq = { init: false, t: 0, tr: 0, pc: 0, pcT: 0, tau: 0, tauT: 0, sun: 1, sunT: 1, moon: 1, moonT: 1, mm: 0, mmT: 0 }
    this.flash = 0; this._pulses = []
    this.lightning = true
    this.listeners = { lightning: new Set() }
    this._f = { sunDir: [0, 1, 0], moonDir: [0, -1, 0], starAxis: [0, 1, 0], starAngle: 0, light: 1, keyDir: [0, 1, 0], keyColor: [1, 1, 1], windOff: [0, 0], wind: { speed: 0, dir: 0, x: 0, z: 0 }, precip: { rain: 0, snow: 0 }, fog: null, clouds: null,
      stormFront: { x: 0, z: 1, progress: 0, strength: 0 },
      cloudLightning: { x: 0, y: 0, z: 0, radius: 0, intensity: 0 } }
    this.lightningContext = null // se instala únicamente durante Play, nunca es autoridad del render
    this.tornado = null // fuente física única para Jolt, FPS, scripting y VFX3D
    this._wf = new WindField()    // obstáculos del viento (bloque F)
  }

  /** Lo que dicen los ajustes de la escena. Reinicia la hora y el tiempo a los valores del inspector. */
  /** `keepHour`: al cambiar de escena en pleno juego el reloj sigue donde estaba (la hora es del mundo, no de la escena). */
  configure(env = {}, { keepHour = false } = {}) {
    const hadTime = this.timeOn, h = this.hour, flow = this.flow, dm = this.dayMinutes
    this.env = env || {}
    this.cfg = normalizeWorld(env)
    this.reset()
    if (keepHour && hadTime && this.cfg.time.on) { this.hour = h; this.flow = flow; this.dayMinutes = dm }
    return this
  }

  /** Fija la semilla del azar del clima (rayos): con la misma semilla y los mismos pasos, el mismo resultado. */
  reseed(seed = 1) { this.rng = mulberry32(seed >>> 0 || 1); this.drng = mulberry32(((seed >>> 0) ^ 0x9e3779b9) >>> 0); return this }

  reset() {
    const { time, weather } = this.cfg
    this.forceTime = false; this.forceWeather = false
    this.hour = time.hour; this.flow = time.flow; this.dayMinutes = time.dayMinutes; this.dayAdd = 0; this.forceAstro = false; this.dateOver = null
    this.preset = weather.preset; this.intensity = weather.intensity; this.lightning = weather.lightning
    this.cur = resolveWeather(weather.preset, weather.intensity)
    this._fade = null; this._htw = null
    this.flash = 0; this._pulses = []; this._lm = new FlashModel({ peakKA: weather.peakKA }); this._strike = null
    this.t = 0; this.windOff[0] = 0; this.windOff[1] = 0
    // director de clima, rachas naturales y humedad: empiezan de cero con la escena
    this.autoOver = null; this._moist = new Moisture(); this._moistDt = 0; this._gusts = new WindGusts(() => this.drng())
    this.drng = mulberry32(weather.directorSeed > 0 ? weather.directorSeed : (Math.random() * 4294967296) >>> 0)
    this.dir = new Director(weather, () => this.drng())
    if (weather.director && weather.directorStart === 'random') { const id = this.dir.pickAny(); if (id) { this.preset = id; this.intensity = 1; this.cur = resolveWeather(id, 1) } }
    this.dir.settle(this.preset)
    // Cielo natural predeterminado: el campo persistente decide las formaciones según World; classic permanece solo si ya está guardado.
    this.field = weather.cloudModel === 'cells' ? new CloudField({ seed: (weather.cloudSeed > 0 ? weather.cloudSeed : Math.random() * 4294967296) | 0, scale: weather.cloudScale, sizeMul: weather.cloudSize, maxCells: WORLD_CLOUD_CELLS }) : null
    this._cq = { init: false, t: 0, tr: 0, pc: 0, pcT: 0, tau: 0, tauT: 0, sun: 1, sunT: 1, moon: 1, moonT: 1, mm: 0, mmT: 0 }
    this._tornadoStormEpisode = false
    this.tornado = weather.tornadoEnabled ? {
      id: 'tornado-1', phase: 'idle', phaseAge: 0, active: false, started: false, age: 0,
      x: weather.tornadoX, y: weather.tornadoY, z: weather.tornadoZ,
      radius: weather.tornadoRadius, height: weather.tornadoHeight,
      intensity: 0, targetIntensity: weather.tornadoIntensity, duration: weather.tornadoDuration,
      heading: weather.tornadoHeading, moveSpeed: weather.tornadoMoveSpeed,
    } : null
    this._wf.clear()   // los obstáculos los registra la escena al cargar; al resetear parten de cero
    return this
  }

  /** Dónde está quien mira (m): la lluvia local, los rayos y el sol tapado por nubes se calculan desde ahí. */
  setAuthoredSunDirection(direction) {
    if (this._authoredSunDir === direction || this._authoredSunDir?.every((value, index) => value === direction?.[index])) return
    this._authoredSunDir = direction
    if (!this.timeOn && this._cq) this._cq.init = false
  }

  setObserver(x, y, z) { const o = this._obs; o[0] = +x || 0; o[1] = +y || 0; o[2] = +z || 0 }

  // ── Obstáculos del viento (bloque F) ────────────────────────────────────────
  /**
   * Registra un obstáculo que modifica el viento local.
   * @param {string} id  Identificador único (suele ser el id del nodo en la escena)
   * @param {'bluff'|'gap'|'cavity'} type
   * @param {object} data
   *   bluff / cavity: { minX, maxX, minZ, maxZ }   ← AABB del objeto en XZ (coordenadas mundo)
   *   gap:            { cx, cz, nx, nz, width, depth } ← centro, normal del flujo, tamaño del canal
   */
  registerObstacle(id, type, data) { this._wf.register(id, type, data) }

  /** Elimina un obstáculo registrado (p.ej. al destruir el objeto en la escena). */
  removeObstacle(id) { this._wf.remove(id) }

  /** Elimina todos los obstáculos (llamado por reset). */
  clearObstacles() { this._wf.clear() }

  /**
   * Viento local en el punto (x, z) del mundo, afectado por obstáculos.
   * @returns {{ speed: number, dir: number, x: number, z: number, factor: number }}
   */
  windAt(x, z) { return this._wf.localWind(+x || 0, +z || 0, this._f.wind) }
  /** Control meteorológico único: nunca crea objetos, partículas ni cuerpos físicos. */
  startTornado(options = {}) {
    const t = this.tornado
    if (!t || !['idle', 'ended'].includes(t.phase)) return false
    this.modifyTornado(options)
    t.phase = 'development'; t.phaseAge = 0; t.age = 0
    t.intensity = 0; t.active = false; t.started = true
    this.forceWeather = true
    this.setWeather('storm', 1, options.weatherTransition ?? this.cfg.weather.tornadoDevelopmentSeconds)
    if (this.field) {
      Object.assign(t, this.field.selectTornadoMother(t.x, t.z))
      this.field.tornado = t
    }
    return true
  }
  modifyTornado(changes = {}) {
    const t = this.tornado
    if (!t || !changes || typeof changes !== 'object' || Array.isArray(changes)) return false
    const limits = { intensity:[0,75,'targetIntensity'], direction:[-360,360,'heading'],
      moveSpeed:[0,20,'moveSpeed'], duration:[1,1800,'duration'],
      x:[-100000,100000,'x'], y:[-10000,10000,'y'], z:[-100000,100000,'z'],
      radius:[2,200,'radius'], height:[5,1000,'height'] }
    const updates = []
    for (const [key,value] of Object.entries(changes)) {
      if (key === 'weatherTransition') { if (!Number.isFinite(value) || value < 0 || value > 180) throw new RangeError('Tornado: transición climática inválida'); continue }
      const lim = limits[key]
      if (!lim || typeof value !== 'number' || !Number.isFinite(value) || value < lim[0] || value > lim[1])
        throw new RangeError(`Tornado: parámetro inválido (${key})`)
      updates.push([lim[2],value])
    }
    for (const [key,value] of updates) t[key] = value
    return true
  }
  stopTornado(immediate = false) {
    const t = this.tornado
    if (!t || ['idle','ended'].includes(t.phase)) return false
    t.phase = immediate ? 'ended' : 'weakening'; t.phaseAge = 0
    if (immediate) { t.intensity = 0; t.active = false }
    return true
  }
  /** Un único avance por paso fijo. No se usa reloj real ni un simulador paralelo. */
  tornadoStep(dt) {
    const t = this.tornado
    if (!t) return null
    if (!Number.isFinite(dt) || dt <= 0) throw new RangeError('Tornado: paso físico inválido')
    if (['idle','ended'].includes(t.phase) && this.cfg.weather.tornadoMode === 'automatic') {
      const storm = this.weatherOn && this.cur.bolts >= 5 && this.cur.rain >= 0.65
      if (!storm) this._tornadoStormEpisode = false
      else if (!this._tornadoStormEpisode) {
        this._tornadoStormEpisode = true
        if (this.drng() < this.cfg.weather.tornadoChance) this.startTornado({ weatherTransition: 0 })
      }
    }
    if (['idle','ended'].includes(t.phase)) return t
    const durations = { development: this.cfg.weather.tornadoDevelopmentSeconds,
      organization: this.cfg.weather.tornadoOrganizationSeconds,
      formation: this.cfg.weather.tornadoFormationSeconds,
      active: t.duration, weakening: this.cfg.weather.tornadoWeakeningSeconds,
      dissipation: this.cfg.weather.tornadoDissipationSeconds }
    const next = { development:'organization', organization:'formation', formation:'active',
      active:'weakening', weakening:'dissipation', dissipation:'ended' }
    let remaining = dt
    while (remaining > 1e-10 && t.phase !== 'ended') {
      const phase = t.phase, dur = durations[phase], step = Math.min(remaining, Math.max(0,dur-t.phaseAge))
      t.phaseAge += step; t.age += step; remaining -= step
      const progress = smooth01(t.phaseAge / dur)
      const factor = phase === 'formation' ? progress : phase === 'active' ? 1
        : phase === 'weakening' ? 1 - progress * 0.7
        : phase === 'dissipation' ? 0.3 * (1-progress) : 0
      t.intensity = t.targetIntensity * factor
      t.active = ['formation','active','weakening','dissipation'].includes(phase)
      if (t.active) {
        const a=t.heading*Math.PI/180
        t.x += Math.sin(a)*t.moveSpeed*step; t.z -= Math.cos(a)*t.moveSpeed*step
      }
      if (t.phaseAge >= dur-1e-9) {
        t.phase = next[phase]; t.phaseAge = 0
        if (t.phase === 'ended') { t.active = false; t.intensity = 0 }
      }
    }
    return t
  }
  /** Valida antes de mutar: carga de partidas con fase y estado físico coherentes. */
  restoreTornado(snapshot) {
    const t=this.tornado
    if (!t || !snapshot || snapshot.id!==t.id || !TORNADO_PHASES.includes(snapshot.phase)) throw new Error('Tornado: snapshot incompatible')
    const numeric=['age','phaseAge','x','y','z','radius','height','intensity','targetIntensity','duration','heading','moveSpeed']
    if (numeric.some(k=>typeof snapshot[k]!=='number'||!Number.isFinite(snapshot[k])) || snapshot.age<0 || snapshot.phaseAge<0 ||
      snapshot.radius<=0 || snapshot.height<=0 || snapshot.duration<=0 || snapshot.targetIntensity<0 || snapshot.targetIntensity>75 ||
      typeof snapshot.active!=='boolean' || typeof snapshot.started!=='boolean') throw new Error('Tornado: snapshot inválido')
    if (snapshot.motherKey != null) {
      if (!this.field || !Number.isSafeInteger(snapshot.motherSx) || !Number.isSafeInteger(snapshot.motherSz) ||
        this.field._worldKey(snapshot.motherSx, snapshot.motherSz) !== snapshot.motherKey) throw new Error('Tornado: nube madre incompatible')
    }
    Object.assign(t,Object.fromEntries([...numeric,'id','phase','active','started'].map(k=>[k,snapshot[k]])))
    if (this.field) {
      Object.assign(t, snapshot.motherKey == null ? this.field.selectTornadoMother(t.x, t.z)
        : { motherSx: snapshot.motherSx, motherSz: snapshot.motherSz, motherKey: snapshot.motherKey })
      this.field.tornado = t
    }
  }
  /** Estado mínimo para reanudar una transición, sin reemplazar el Director ni serializar RNG global. */
  captureWeatherEvolution() {
    const fade = this._fade
    const copy = w => ({ ...w, tint: [...w.tint] })
    return { t: this.t, windOff: [...this.windOff],
      fade: fade ? { from: copy(fade.from), to: copy(fade.to), t: fade.t, dur: fade.dur } : null,
      director: this.dir ? { current: this.dir.current, busy: this.dir.busy, dwell: this.dir.dwell } : null }
  }
  restoreWeatherEvolution(state) {
    if (!state || !Number.isFinite(state.t) || state.t < 0 ||
      !Array.isArray(state.windOff) || state.windOff.length !== 2 || state.windOff.some(v => !Number.isFinite(v)))
      throw new Error('Clima: evolución incompatible')
    const fd = state.fade
    if (fd !== null && fd !== undefined) {
      const validWeather = w => w && !Array.isArray(w) && Array.isArray(w.tint) && w.tint.length === 3 &&
        w.tint.every(v => Number.isFinite(v)) &&
        ['type','coverage','density','altitude','thickness','erosion','light','sun','dark','fog','rain','snow','windBoost','bolts','humidity','temp'].every(k => Number.isFinite(w[k]))
      if (!Number.isFinite(fd.t) || !Number.isFinite(fd.dur) || fd.dur <= 0 || fd.t < 0 || fd.t >= fd.dur ||
        !validWeather(fd.from) || !validWeather(fd.to)) throw new Error('Clima: transición incompatible')
    }
    const dr = state.director
    if (dr != null && (!this.dir || (dr.current != null && !WEATHER_IDS.includes(dr.current)) ||
      !Number.isFinite(dr.busy) || dr.busy < 0 || !Number.isFinite(dr.dwell)))
      throw new Error('Clima: director incompatible')
    this.t = state.t; this.windOff[0] = state.windOff[0]; this.windOff[1] = state.windOff[1]
    this._fade = fd ? { from: { ...fd.from, tint: [...fd.from.tint] }, to: { ...fd.to, tint: [...fd.to.tint] }, t: fd.t, dur: fd.dur } : null
    if (this._fade) { const k = this._fade.t / this._fade.dur; this.cur = blend(this._fade.from, this._fade.to, k * k * (3 - 2 * k)) }
    if (dr && this.dir) { this.dir.current = dr.current; this.dir.busy = dr.busy; this.dir.dwell = dr.dwell }
    this._cq.init = false
  }
  /** Reconstruye la misma distribución y deriva de nubes al cargar un episodio. */
  restoreCloudField(snapshot) {
    if (!this.field || !snapshot || !Number.isInteger(snapshot.seed) ||
      !Array.isArray(snapshot.windOff) || snapshot.windOff.length !== 2 ||
      snapshot.windOff.some(v => !Number.isFinite(v)) || !Number.isFinite(snapshot.evolution) || snapshot.evolution < 0)
      throw new Error('Nubes: snapshot incompatible')
    const w = this.cfg.weather
    const f = new CloudField({ seed: snapshot.seed, scale: w.cloudScale, sizeMul: w.cloudSize, maxCells: WORLD_CLOUD_CELLS })
    f.update(this._cloudState(), [0, 0], 0)
    f.windOff[0] = snapshot.windOff[0]; f.windOff[1] = snapshot.windOff[1]
    f.evolution = snapshot.evolution
    if (snapshot.forcing != null) {
      const forcing = snapshot.forcing
      if (!['coverage','density','humidity','storm','rain'].every(k => Number.isFinite(forcing[k]) && forcing[k] >= 0))
        throw new Error('Nubes: forzado incompatible')
      Object.assign(f.f, forcing)
      f._seeded = true
    }
    if (snapshot.volume) f.map.volume.restore(snapshot.volume)
    this.field = f; this._cq.init = false
  }
  tornadoWindAt(x,y,z) { return vortexVelocityAt(this.tornado,x,y,z) }
  /** Extensión 3D; windAt(x,z) conserva su contrato original. */
  windAt3D(x,y,z) {
    const ambient=this.windAt(x,z), vortex=this.tornadoWindAt(x,y,z)
    return {x:ambient.x+vortex.x,y:vortex.y,z:ambient.z+vortex.z,inside:vortex.inside,weight:vortex.weight}
  }

  /** ¿Hay campo de nubes por celdas funcionando? */
  get cellsOn() { return !!this.field && this.weatherOn }
  /** Intensidad de lluvia (0–1) en el observador: con celdas, la que cae bajo las nubes de aquí; si no, la del tiempo. */
  get rainLevel() { return this.cellsOn ? this._localPrecip().rain : this.cur.rain }
  get snowLevel() { return this.cellsOn ? this._localPrecip().snow : this.cur.snow }
  /** Precipitación (mm/h) en el punto (x, z) del mundo: con celdas, la que cae bajo la nube que haya allí; sin ellas, la del tiempo (igual en todas partes). */
  precipitationAt(x, z, y = 0) { return this.cellsOn ? this.field.effectivePrecipitationAt(+x || 0, +y || 0, +z || 0) : precipMm(this.cur.rain, this.cur.snow) }
  /** Cumulonimbo apto para rayos más cercano (nubes por celdas): { distance (m), bearing (°, 0 norte · 90 este) } o null. Sin celdas siempre null. */
  nearestStorm(maxDistance = 8000) {
    if (!this.cellsOn) return null
    const o = this._obs, c = this.field.lightningOrigin(o[0], o[2], Math.max(100, +maxDistance || 8000))
    if (!c || c.dist > Math.max(100, +maxDistance || 8000)) return null // la búsqueda del campo mira al menos un chunk: aquí se respeta el alcance pedido
    return { distance: c.dist, bearing: ((Math.atan2(c.x - o[0], -(c.z - o[2])) * 180) / Math.PI + 360) % 360 }
  }
  /** Cielo cubierto (0–1) visto desde el observador: con celdas, el medido sobre su cabeza; sin ellas, la cobertura del tiempo. */
  get skyCover() { return this.cellsOn ? this._cq.pc : this.cur.coverage }
  /** Fracción de sol directo que llega al observador (1 = sin nubes delante): con celdas exp(−τ) hacia el sol; sin ellas, el factor del tiempo. */
  get sunTransmission() {
    if (this.cellsOn) return this._cq.sun
    return this._layerTransmission(this._f.sunDir[1]) * (this.weatherOn ? this.cur.sun : 1)
  }
  get moonTransmission() { return this.cellsOn ? this._cq.moon : this._layerTransmission(this._f.moonDir[1]) }
  _layerTransmission(elevationY) {
    if (this.weatherOn) return cloudBeamTransmission(this.cur.coverage, this.cur.density, elevationY)
    return this.env?.cloudsOn ? cloudBeamTransmission(this.env.cloudsCoverage ?? 0.5, this.env.cloudsDensity ?? 1, elevationY) : 1
  }
  _localPrecip() {
    const w = this.cur, q = this._cq, g = precipMm(w.rain, w.snow), k = g > 1e-6 ? Math.min(1.25, q.mm / g) : 0
    const o = this._lp || (this._lp = { rain: 0, snow: 0 })
    o.rain = Math.min(1, w.rain * k); o.snow = Math.min(1, w.snow * k)
    return o
  }

  get timeOn() { return !this.suspended && (this.cfg.time.on || this.forceTime) }
  /** ¿Cambia el tiempo solo? (el inspector, o game.weather.auto) */
  get directorOn() { return this.weatherOn && (this.autoOver ?? this.cfg.weather.director) }
  get weatherOn() { return !this.suspended && (this.cfg.weather.on || this.forceWeather) } // `suspended`: el horneado ignora hora y clima
  /** ¿Hay algo que simular (hora o clima)? Si no, el cielo y las luces son los del inspector sin tocar. */
  get active() { return this.timeOn || this.weatherOn }

  // ---------- control en juego ----------
  /** Pone la hora. `seconds` > 0: el reloj avanza hasta esa hora (siempre hacia delante: el sol sale y se pone, no retrocede). */
  setHour(h, seconds = 0) {
    this.forceTime = true
    const to = ((+h % 24) + 24) % 24
    if (!(seconds > 0)) { this.hour = to; this._htw = null; this._celestialCloudsDirty = true; return }
    this._htw = { from: this.hour, span: ((to - this.hour) % 24 + 24) % 24 || 24, t: 0, dur: seconds }
  }
  /** Elige la fecha (día del año 1–366 y año): activa la astronomía real, con la luna y los planetas de ese día. */
  setDate(day, year) {
    this.forceTime = true; this.forceAstro = true
    const cur = this.date()
    this.dateOver = { year: Math.round(+year || cur.year), day: Math.round(+day || cur.day) }; this.dayAdd = 0; this._celestialCloudsDirty = true
  }
  /** Fecha actual { year, day } (con los días que han transcurrido). */
  date() { const t = this.cfg.time, b = this.dateOver || { year: t.year, day: t.day }; return addDays(b.year, b.day, this.dayAdd) }
  get astroOn() { return this.timeOn && (this.cfg.time.astro || this.forceAstro) }
  setFlow(on, dayMinutes) { this.forceTime = true; this.flow = !!on; if (dayMinutes > 0) this.dayMinutes = dayMinutes }
  /** Cambia el tiempo (gradualmente si `seconds` > 0). */
  setWeather(id, intensity = 1, seconds = 0) {
    if (!PRESETS[id]) return false
    this.forceWeather = true
    this._setPreset(id, intensity, seconds)
    this.dir?.settle(id) // un script lo cambió: el director cuenta desde aquí
    return true
  }
  _setPreset(id, intensity, seconds) {
    this.preset = id; this.intensity = Math.min(1, Math.max(0, +intensity))
    const to = resolveWeather(id, this.intensity)
    if (seconds > 0) this._fade = { from: this.cur, to, t: 0, dur: seconds }
    else { this.cur = to; this._fade = null }
  }
  /** game.weather.auto(true/false): activa o apaga el director; `null` vuelve a lo que diga el inspector. */
  setAuto(on) { this.forceWeather = true; this.autoOver = on === null ? null : !!on; this.dir?.settle(this.preset) }
  /** Cambia ya al siguiente tiempo del director (o a uno al azar si no hay lista). Devuelve su id. */
  nextWeather(seconds = 0) {
    this.forceWeather = true
    if (this.dir) this.dir.current = this.preset // «siguiente» es siempre otro tiempo distinto del actual
    const id = this.dir ? (this.dir.pick() || this.dir.pickAny() || null) : null
    if (id) this.setWeather(id, 1, seconds)
    return id
  }
  on(name, fn) { this.listeners[name]?.add(fn); return () => this.listeners[name]?.delete(fn) }

  // ---------- avance ----------
  /** Avanza la simulación únicamente cuando la llama Play/Runtime.
   * `clock:false` sigue siendo una API explícita de simulación (no se invoca desde Edit Mode).
   */
  update(dt, { clock = true } = {}) {
    if (!(dt > 0)) return
    // El Director puede acelerar el tiempo meteorológico; condensado y transición
    // deben compartir ese reloj. Los scripts sin Director conservan segundos reales.
    const wc = this.cfg.weather
    const simDt = wc.followClock && this.timeOn && this.flow ? (dt * 1440) / Math.max(0.5, this.dayMinutes) : dt * wc.weatherScale
    const atmosphericDt = this.directorOn ? simDt : dt
    this.t += atmosphericDt
    this._moistDt += atmosphericDt
    if (wc.gustModel === 'natural') this._gusts.step(dt, 0.9, (1.8 * Math.max(0, wc.gusts)) / 0.35)
    if (this.directorOn && !this._fade) {
      const ch = this.dir.update(simDt)
      if (ch) this._setPreset(ch.id, 1, Math.max(ch.abrupt ? 1 : 0.5, ch.simSeconds))
    } else if (this.directorOn) this.dir.update(0)
    if (this.timeOn && clock) {
      const h0 = this.hour
      if (this._htw) {
        const h = this._htw; h.t += dt
        const k = Math.min(1, h.t / h.dur)
        this.hour = (h.from + h.span * (k * k * (3 - 2 * k))) % 24
        if (k >= 1) this._htw = null
      } else if (this.flow) this.hour = (this.hour + (dt * 24) / (this.dayMinutes * 60)) % 24
      if (this.hour < h0 - 1e-9) this.dayAdd++ // pasó la medianoche: avanza la fecha
    }
    if (this._fade) {
      const f = this._fade; f.t += atmosphericDt
      const k = Math.min(1, f.t / f.dur)
      this.cur = blend(f.from, f.to, k * k * (3 - 2 * k))
      if (k >= 1) { this.cur = f.to; this._fade = null }
    }
    const w = this._wind()
    this.windOff[0] += w.x * atmosphericDt; this.windOff[1] += w.z * atmosphericDt
    this._cloudStep(atmosphericDt, w)
    this._lightning(atmosphericDt)
  }

  /** Estado atmosférico que alimenta al campo de nubes (los mismos números del tiempo, en las escalas de Frost). */
  _cloudState() {
    const w = this.cur, wc = this.cfg.weather
    return { coverage: w.coverage, density: Math.min(1, w.density / 2.1), humidity: wc.moisture && this._moist.init ? this._moist.humidity : w.humidity,
      storm: Math.min(1, Math.max(0, w.bolts / 7)), rain: precipMm(w.rain, w.snow), altitude: w.altitude }
  }

  /**
   * Un paso del campo de nubes: avanza las celdas con el viento, las mantiene alrededor del observador (y hornea el mapa del cielo) y cada 0,125 s
   * mide lo que Frost mide en `FrostEnvironmentPresentation`: cobertura física y profundidad óptica media sobre el observador (oscurecen el cielo y
   * la luz ambiente) y la transmisión directa de sol y luna exp(−τ) en sus direcciones; cada 0,22 s la lluvia efectiva en el punto.
   * Se suavizan con las mismas velocidades que Frost (1,8 · 3,0 · 2,5 por segundo).
   */
  _cloudStep(dt, wind) {
    const cf = this.field
    if (!cf || !this.weatherOn) return
    cf.tornado = this.tornado
    cf.tornadoDurations = this.cfg.weather
    cf.update(this._cloudState(), [wind.x * CLOUD_WIND, wind.z * CLOUD_WIND], dt)
    const o = this._obs, q = this._cq
    cf.maintain(o[0], o[2], dt)
    q.t += dt; q.tr += dt
    if (q.t >= 0.125 || !q.init) {
      q.t = 0
      const ph = cf.physicalState(o[0], o[1], o[2]), { sunDir, moonDir } = this._f
      const transmit = (dir) => dir[1] > 0 ? Math.exp(-cf.opticalDepthAlongRay(o, dir, cf.simRadius * 2)) : 1
      q.pcT = ph.coverage; q.tauT = ph.meanTau
      q.sunT = transmit(sunDir)
      q.moonT = this.timeOn ? transmit(moonDir) : 1
    }
    if (q.tr >= 0.22 || !q.init) { q.tr = 0; q.mmT = cf.effectivePrecipitationAt(o[0], o[1], o[2]) }
    if (!q.init) { q.init = true; q.pc = q.pcT; q.tau = q.tauT; q.sun = q.sunT; q.moon = q.moonT; q.mm = q.mmT; return }
    q.pc = moveTo(q.pc, q.pcT, dt * 1.8); q.tau = moveTo(q.tau, q.tauT, dt * 3); q.sun = moveTo(q.sun, q.sunT, dt * 2.5)
    q.moon = moveTo(q.moon, q.moonT, dt * 2.5)
    q.mm += (q.mmT - q.mm) * (1 - Math.exp(-dt / 0.8)) // la lluvia entra y sale con suavidad al cruzar el borde de una nube
  }

  /** Oscurecimiento por nubes (0–1) a la escala de los tiempos de Century (la tormenta cerrada ≈ 0,62; Frost oscurece más: su exposición no se toca aquí). */
  _cloudDark() { const q = this._cq, amb = (1 - q.pc) + q.pc * Math.exp(-q.tau); return (1 - Math.min(1, Math.max(0, amb))) * 0.62 }

  /**
   * Origen de un rayo con celdas: el cumulonimbo apto más cercano (consulta de Frost) y un punto de descarga dentro de él (las celdas miden kilómetros).
   * Devuelve undefined (sin campo: distancia y rumbo al azar, como siempre), null (no hay cumulonimbo apto: no cae rayo) o { distance, bearing, extra }.
   */
  _cellOrigin() {
    const cf = this.field
    if (!cf || !this.weatherOn) return undefined
    const o = this._obs, c = cf.lightningOrigin(o[0], o[2], Math.max(cf.chunk * 4, 1800))
    if (!c || this.rng() > c.elig * (0.9 + 0.1 * (1 - Math.exp(-Math.max(0, c.tau))))) return null
    const a = this.rng() * Math.PI * 2, r = Math.sqrt(this.rng()) * c.radius * 0.55
    const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r, dx = x - o[0], dz = z - o[2]
    return { distance: Math.max(30, Math.hypot(dx, dz)), bearing: ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360,
      extra: { altitude: c.base, thickness: c.thick, cloud: [x, c.y, z], cloudRadius: Math.min(c.radius, 1500), type: 1 } }
  }

  _wind() {
    const { windSpeed, windDir, gusts } = this.cfg.weather
    const boost = this.weatherOn ? this.cur.windBoost : 0
    if (this.cfg.weather.gustModel === 'natural') return this._gusts.at(Math.max(0, windSpeed + boost), windDir)
    return windAt(this.t, Math.max(0, windSpeed + boost), windDir, gusts)
  }

  _lightning(dt) {
    if (this.cfg.weather.lightningModel === 'physical') return this._physicalLightning(dt)
    this.flash *= Math.exp(-dt * 8)
    if (this._pulses.length) {
      for (const p of this._pulses) p.at -= dt
      const due = this._pulses.filter((p) => p.at <= 0)
      this._pulses = this._pulses.filter((p) => p.at > 0)
      for (const p of due) this.flash = Math.max(this.flash, p.amp)
    }
    const bolts = this.weatherOn && this.lightning ? this.cur.bolts : 0
    if (bolts > 0 && this.rng() < (bolts / 60) * dt) {
      const c = this._cellOrigin()
      if (c === null) return // con celdas: sin cumulonimbo apto cerca no hay relámpago
      const amp = 0.65 + this.rng() * 0.35
      this.flash = amp
      this._pulses.push({ at: 0.09 + this.rng() * 0.08, amp: amp * 0.8 }) // el segundo destello, como un relámpago real
      if (c) this._emitBolt(c.distance, c.bearing, c.extra)
      else this._emitBolt(300 + this.rng() * 3500)
    }
  }

  _emitBolt(distance, bearing = this.drng() * 360, extra = null) {
    // `seed` y `peak` (kA) los usa el trueno procedural (world/thunder.js): el mismo rayo suena igual. Sin consumir los azares del clima.
    const seed = extra?.seed ?? ((Math.imul(this._boltN = (this._boltN | 0) + 1, 0x9e3779b1) ^ Math.imul(Math.round(distance * 7 + bearing * 13), 0x85ebca6b) ^ Math.round(this.t * 1000)) >>> 0)
    const e = { distance, delay: distance / 343, bearing, seed, peak: extra?.peak ?? this.cfg.weather.peakKA, altitude: extra?.altitude ?? this.cur.altitude, thickness: extra?.thickness ?? this.cur.thickness,
      ...(extra?.thunderEnabled === false ? { thunderEnabled: false } : {}) }
    if (extra?.impact) e.impact = { ...extra.impact, point: [...extra.impact.point], normal: [...extra.impact.normal] }
    for (const fn of this.listeners.lightning) fn(e) // el trueno llega más tarde que la luz
  }

  /**
   * Rayos físicos: la cadencia es un proceso de Poisson en tiempo REAL (no se acelera con el reloj del mundo) con tasa
   * maxStrikes × potencial de tormenta (los rayos/min del tiempo ÷ 7); solo hay un rayo a la vez. El canal lo construye quien dibuja
   * (render/lightning-fx.js) a partir de `frame().strike`; aquí solo está la forma de onda: `flash` y `boltAlpha` siguen la corriente.
   */
  _physicalLightning(dt) {
    const wc = this.cfg.weather
    this._lm.cfg.peakKA = wc.peakKA
    this.flash = Math.max(0, this._lm.update(dt) * (this._strike?.amp ?? 1))
    if (this._lm.active || !this.weatherOn || !this.lightning) return
    const storm = Math.min(1, Math.max(0, this.cur.bolts / 7)), lam = (Math.max(0, wc.maxStrikes) * storm) / 60
    if (lam > 0 && this.rng() < 1 - Math.exp(-lam * dt)) {
      const c = this._cellOrigin()
      if (c === undefined) this._startStrike(300 + this.rng() * 3500, this.rng() * 360)
      else if (c) this._startStrike(c.distance, c.bearing, c.extra)
    }
  }

  _startStrike(distance, bearing, extra = null, withThunder = true) {
    const k = this._lm
    k.cfg.peakKA = this.cfg.weather.peakKA
    k.start(this.cfg.weather.peakKA * (0.72 + 0.56 * this.rng()))
    // Fijar el origen al disparar: el destello en la nube y el canal de LightningFX
    // no deben desplazarse si la cámara se mueve durante una descarga.
    const altitude = extra?.altitude ?? this.cur.altitude, thickness = extra?.thickness ?? this.cur.thickness
    const br = bearing * Math.PI / 180, boltThick = Math.min(1500, Math.max(300, thickness * 0.5))
    const cloud = extra?.cloud ? [...extra.cloud] : [this._obs[0] + Math.sin(br) * distance, altitude + boltThick * 0.35, this._obs[2] - Math.cos(br) * distance]
    this._strike = { id: ++this._strikeN, distance, bearing, peak: k.peak, seed: (this.rng() * 4294967296) >>> 0, amp: Math.min(1, Math.max(0.35, 1.2 - distance / 6000)),
      altitude, thickness, type: extra?.type ?? this.cur.type, cloud, cloudRadius: extra?.cloudRadius ?? 240 }
    if (this.cfg.weather.lightningImpacts && this.lightningContext) {
      const resolver = this.lightningContext(this._strike)
      if (resolver) {
        const result = resolveWorldStrike(this._strike, [...this._obs], resolver)
        this._strike.bolt = result.bolt
        this._strike.impact = result.impact
      }
    }
    this.flash = this._strike.amp
    this._emitBolt(distance, bearing, withThunder ? this._strike : { ...this._strike, thunderEnabled: false })
  }

  /** Un rayo a petición (scripts, cinemáticas): destello, aviso y trueno con el retardo de la distancia (m). */
  strike(distance = 1200, bearing, withThunder = true) {
    distance = Math.max(30, Math.min(8000, +distance || 1200))
    if (this.cfg.weather.lightningModel === 'physical') {
      this._startStrike(distance, Number.isFinite(+bearing) && bearing !== undefined ? +bearing : this.rng() * 360, null, withThunder)
      return { distance, delay: withThunder ? distance / 343 : 0 }
    }
    this.flash = 1
    this._pulses.push({ at: 0.1, amp: 0.8 })
    this._emitBolt(distance, Number.isFinite(+bearing) && bearing !== undefined && bearing !== null ? +bearing : undefined,
      withThunder ? null : { thunderEnabled: false })
    return { distance, delay: withThunder ? distance / 343 : 0 }
  }

  // ---------- resultado para el render ----------
  /**
   * Visibilidad horizontal (m) a la altura `y`: ley de Koschmieder V = 3,912 / β. Con niebla física cuenta la humedad y la caída con la
   * altura; con la simple (exponencial uniforme) es 3,912 / densidad. Infinity si no hay niebla.
   */
  visibility(y = 0, env = this.env) {
    const f = this.frame(), fg = f.fog
    if (!fg || !fg.on) return Infinity
    const F = normalizeFog(env)
    if (F.fogMode !== 'physical') return FOG.VISIBILITY_K / Math.max(1e-9, fg.density)
    return visibilityOf(fg.density, fg.humidity ?? f.humidity, y, F.fogFalloff, F.fogHeight)
  }

  frame() {
    const f = this._f, env = this.env || {}, { time } = this.cfg
    const useT = this.timeOn, useW = this.weatherOn, w = this.cur
    f.timeOn = useT; f.weatherOn = useW; f.active = useT || useW
    f.hour = this.hour; f.preset = this.preset; f.flash = this.flash
    f.windOff[0] = this.windOff[0]; f.windOff[1] = this.windOff[1]
    f.wind = this._wind()
    // La transición existente de World es la única autoridad de la aproximación.
    // No se altera CloudField ni se crean frentes que simulen otro estado meteorológico.
    const front = f.stormFront, fade = useW ? this._fade : null
    const incoming = fade && fade.to.bolts > fade.from.bolts + 0.01 && fade.to.bolts > 0
    front.strength = incoming ? storm01((fade.to.bolts - fade.from.bolts) / 7) : 0
    front.progress = incoming ? smooth01(fade.t / Math.max(0.001, fade.dur)) : 0
    const windLen = Math.hypot(f.wind.x, f.wind.z)
    front.x = windLen > 0.01 ? -f.wind.x / windLen : 0
    front.z = windLen > 0.01 ? -f.wind.z / windLen : 1
    // El flash físico procede de la misma descarga que LightningFX y el trueno.
    const strike = this.cfg.weather.lightningModel === 'physical' && this._lm.active ? this._strike : null
    const flash = f.cloudLightning
    flash.intensity = useW && this.lightning && strike && this.flash > 0.001 ? storm01(this.flash) : 0
    if (flash.intensity > 0 && strike.cloud) {
      flash.x = strike.cloud[0]; flash.y = strike.cloud[1]; flash.z = strike.cloud[2]
      flash.radius = Math.min(2400, Math.max(350, strike.cloudRadius * 2.5, strike.thickness * 0.45))
    } else { flash.x = 0; flash.y = 0; flash.z = 0; flash.radius = 0 }

    // sol y luna
    const doy = SEASON_DAY[time.season]
    const hour = useT ? this.hour : 12
    let sun, moon, ast = null
    if (this.astroOn) {
      // astronomía real: fecha + hora local + lugar → sol, luna con fase, planetas y tiempo sidéreo (el catálogo estelar se orienta con él)
      const dt = this.date()
      ast = astroState({ hour, year: dt.year, day: dt.day, latitude: time.latitude, longitude: time.longitude, utcOffset: time.utcOffset })
      sun = ast.sun; moon = ast.moon
      f.sunDir = ast.sun.dir; f.moonDir = ast.moon.dir
      f.year = dt.year; f.day = dt.day
    } else {
      sun = solarPosition(hour, time.latitude, doy); moon = lunarPosition(hour, time.latitude, doy)
      f.sunDir = directionOf(sun.elevation, sun.azimuth); f.moonDir = directionOf(moon.elevation, moon.azimuth)
    }
    if (!useT && this._authoredSunDir) f.sunDir = this._authoredSunDir
    f.sunElevation = !useT && this._authoredSunDir ? Math.asin(Math.max(-1, Math.min(1, f.sunDir[1]))) * 180 / Math.PI : sun.elevation
    f.moonElevation = moon.elevation
    if (this.field && useW && (!this._cq.init || this._celestialCloudsDirty)) {
      this._cq.init = false
      this._cloudStep(0, f.wind)
    }
    this._celestialCloudsDirty = false
    const cells = !!this.field && useW
    f.astro = ast
    // modelo sencillo: las estrellas giran con la hora alrededor del polo norte celeste (elevación = latitud) y avanzan ~1°/día con la estación
    f.starAxis = directionOf(time.latitude, 0); f.starAngle = (((hour - 12) * 15 + doy * 0.9856) * Math.PI) / 180
    const cover = useW ? (cells ? this._cq.pc : w.coverage) : 0.3, direct = this.sunTransmission, dark = useW ? (cells ? this._cloudDark() : w.dark) : 0
    const dayF = useT ? smooth(-7, 9, sun.elevation) : 1
    f.night = useT ? 1 - smooth(-14, -3, sun.elevation) : 0

    // luz principal (la luz direccional de la escena): sol de día, luna de noche; en el crepúsculo se apaga y cambia de lado
    const sunE = useT ? smooth(-4, 3, sun.elevation) * (0.35 + 0.65 * smooth(0, 35, sun.elevation)) : 1 // gradual: al amanecer y al atardecer aún hay luz cálida de sobra
    const sunMul = sunE * direct
    const moonEnergy = useT ? f.night * smooth(0, 8, moon.elevation) * time.moonLight * (ast ? Math.pow(ast.moonIllum, 1.3) : 1) : 0
    const lunarTransmission = this.moonTransmission
    const moonMul = moonEnergy * lunarTransmission
    const useSun = sunMul >= moonMul
    f.keyDir = useSun ? f.sunDir : f.moonDir
    f.keyColor = useSun ? sunColor(sun.elevation) : MOON
    f.keyMul = Math.max(sunMul, moonMul)
    // G003: ambos cuerpos conservan su energía independiente; key* sigue igual para proyectos antiguos.
    f.solarTransmission = direct
    f.lunarTransmission = lunarTransmission
    // Las nubes reciben las fuentes por encima de la cubierta, y la escena recibe el haz transmitido.
    f.sunCloudMul = sunE; f.moonCloudMul = moonEnergy
    f.sunDirectMul = sunMul; f.moonMul = moonMul; f.moonColor = MOON
    f.sunColor = sunColor(sun.elevation); f.sunMul = sunE * (0.35 + 0.65 * direct)
    // Temperatura de color relativa a la luz diurna. Usa la misma transmisión de
    // las nubes que la energía directa y el estado meteorológico ya interpolado.
    const cloudFilter = Math.min(1, 0.65 * (1 - direct) + 0.75 * dark)
    f.sunTemperatureOffset = -3000 * (1 - smooth(0, 50, sun.elevation)) + 2400 * cloudFilter

    // cielo: la paleta del inspector es la de «día»; de noche tiende a azul oscuro, en el crepúsculo se tiñe de naranja
    const bt = hex(env.skyTop, [0.25, 0.45, 0.72]), bh = hex(env.skyHorizon, [0.72, 0.83, 0.93]), bg = hex(env.ground, [0.36, 0.33, 0.27])
    let top = mix(NIGHT.top, bt, dayF), hor = mix(NIGHT.horizon, bh, dayF), gnd = mix(NIGHT.ground, bg, dayF)
    if (useT) {
      const tw = Math.exp(-((sun.elevation / 6) ** 2)) * (1 - 0.7 * cover)
      hor = mix(hor, TWILIGHT, tw * 0.55); top = mix(top, hex('#3a3f78'), tw * 0.25)
    }
    if (useW) { top = dull(top, dark); hor = dull(hor, dark); gnd = dull(gnd, dark) }
    f.skyTop = toHex(top); f.skyHorizon = toHex(hor); f.ground = toHex(gnd)
    f.exposure = 1 - 0.5 * dark // el destello de un relámpago va aparte (f.flash): no debe provocar un nuevo horneado del cielo

    // luz ambiente (la intensidad del inspector se multiplica por esto)
    const ba = hex(env.ambientColor || env.skyHorizon, bh)
    f.ambientMul = lerp(time.nightAmbient, 1, dayF) * (1 - 0.35 * dark) + this.flash * 1.4
    f.light = Math.min(1, Math.max(f.sunMul, moonMul, f.ambientMul * 0.6)) // luz que llega a la escena y al agua
    f.ambientColor = toHex(useW ? dull(mix(NIGHT.ambient, ba, dayF), dark) : mix(NIGHT.ambient, ba, dayF))

    // estrellas y luna en el cielo
    const veil = 1 - Math.min(1, cover * 0.95) * (useW ? 1 : 0.4)
    f.stars = useT ? (1 - smooth(-18, -4, sun.elevation)) * veil * (1 - Math.min(1, w.fog * 25)) : 0
    f.moonVis = useT ? smooth(-1, 5, moon.elevation) * (0.25 + 0.75 * f.night) : 0

    // niebla: la del inspector o la del tiempo (la mayor); toma el color del horizonte para fundirse con el cielo
    const wc = this.cfg.weather
    f.temperature = airTemperature(hour, wc.baseTemp, wc.tempRange, useW ? w.temp : 0)
    f.humidity = useW ? w.humidity : 0.5
    f.precipMm = useW ? precipMm(w.rain, w.snow) : 0
    f.weather = this.preset
    // Una sola autoridad: el cielo lee la misma circulación meteorológica que el emisor temporal.
    f.tornado = this.tornado
    f.tornadoDurations = this.cfg.weather
    let wfog = useW ? w.fog : 0
    if (useW && wc.moisture) {
      // la niebla del tiempo pasa por el modelo de punto de rocío: se forma de madrugada y se disipa con el sol y el viento
      const el = sun.elevation, intensity = Math.sqrt(Math.max(0, Math.sin((el * Math.PI) / 180))) * smooth(-0.5, 5, el)
      const m = this._moist.update({ humidity: w.humidity, temperature: f.temperature, coverage: w.coverage, density: Math.min(1, w.density / 2.1), precip: f.precipMm }, wc.baseTemp + w.temp,
        { daylight: smooth(-3, 15, el), intensity }, f.wind.speed, this._moistDt, w.fog)
      this._moistDt = 0; f.humidity = m.humidity; wfog = m.fog
    }
    const base = env.fog ? +env.fogDensity || 0 : 0
    const dens = Math.max(base, useW ? wfog : 0)
    if (f.active && (dens > 0.0002 || env.fog)) f.fog = { on: dens > 0.0002, density: dens, color: toHex(mix(hor, gnd, 0.15)), humidity: f.humidity }
    else f.fog = null

    // nubes: con clima activo mandan los presets; si no, las del inspector
    if (useW) {
      const c = f.clouds || (f.clouds = {})
      if (cells) {
        const M = this.field.map, v = M.volume
        c.on = v.hasClouds; c.cells = true; c.map = M; c.windOff = this.field.windOff
        c.altitude = v.base ?? M.slabBase; c.thickness = v.height ?? M.slabThick
      }
      else { c.on = w.coverage > 0.03; c.cells = false; c.map = null; c.altitude = w.altitude; c.thickness = w.thickness }
      const mother = cells && this.field ? this.field.motherPosition(this.tornado) : null
      c.motherKey = mother ? this.tornado.motherKey : 0
      c.motherX = mother ? mother[0] : this.tornado?.x ?? 0
      c.motherZ = mother ? mother[1] : this.tornado?.z ?? 0
      c.motherRadius = mother ? this.field.chunk * 0.6 : 0
      c.evolution = this.t // único reloj meteorológico para el shader: se congela con PlayMode pausado
      c.coverage = w.coverage; c.density = w.density
      c.erosion = w.erosion; c.type = w.type; c.tint = toHex(w.tint); c.light = w.light
    } else f.clouds = null

    // precipitación y viento
    f.strike = this._strike; f.boltAlpha = this._lm.active ? this._lm.value : 0
    f.precip.rain = useW ? w.rain : 0; f.precip.snow = useW ? w.snow : 0
    if (cells) { const lp = this._localPrecip(); f.precip.rain = lp.rain; f.precip.snow = lp.snow; f.precipMm = this._cq.mm } // llueve solo bajo las nubes que lluevan
    f.cloudCover = cells ? this._cq.pc : null; f.sunTrans = cells ? this._cq.sun : null
    return f
  }
}

export { WEATHER_IDS }
