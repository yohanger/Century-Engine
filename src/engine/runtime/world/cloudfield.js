// Campo de nubes por celdas (bloque E). Puerto a JS puro del Environment de FrostEngine (autoría del usuario):
// FrostEnvironmentCloudMassField (celdas deterministas por chunk, forzado del mundo, morfologías, advección, consultas físicas) y, de
// FrostEnvironmentCloudChunkField, la construcción de las primitivas de densidad de cada celda. Sin DOM, THREE ni
// WebAudio: se prueba en Node (scripts/test-clouds.mjs) y lo usa world.js.
//
// Modelo (igual que Frost):
//  · El mundo se divide en chunks de `chunk` m. Cada «tile» de `stride`×`stride` chunks guarda como mucho UNA celda de nube, en un chunk
//    elegido por hash; su posición, su tamaño y su potencial de existir salen del hash (semilla de sesión ⊕ semilla del patrón): el mismo
//    punto del mundo da siempre la misma nube. Todo el campo se desplaza con el viento (desplazamiento integrado) y cada celda oscila un poco
//    distinto de las demás (advección diferencial).
//  · El «forzado» del mundo (cobertura, densidad, humedad, tormenta, lluvia) viene del estado atmosférico y se suaviza con `formationFade` s.
//    Con él cada celda decide si existe (condensado), su madurez, su desarrollo vertical, su MORFOLOGÍA (cirro, estrato, estratocúmulo,
//    cúmulo, cúmulo torreón, cumulonimbo, nimbostrato), su profundidad óptica, cuánta lluvia deja caer y si puede producir rayos.
//  · Consultas: lluvia efectiva en un punto (huella de cada celda desplazada por el viento durante la caída), origen de un rayo (solo
//    cumulonimbos eléctricamente aptos), cobertura física y profundidad óptica medias sobre un observador, y profundidad óptica a lo largo de
//    un rayo (la transmisión directa del sol = exp(−τ)).
//  · Dibujo: el puerto original adaptó el agrupamiento de volúmenes de Frost. En esta evolución, las
//    primitivas estables por identidad y características continuas se «proyectan» a un mapa 2D que lee el trazador de nubes del cielo
//    (render/skylib.js): cobertura, tipo, base y techo de cada columna (`bake`). Ver README, bloque E.
//
// Escala: Frost trabaja con nubes de juego (base a 220 m, capa de 45 m, chunks de 260 m). Century tiene cielos de kilómetros, así que
// TODAS las longitudes se multiplican por `scale` (por defecto 8: chunks de 2 080 m, celdas de 0,3–1,5 km, capa de 360 m). Las velocidades
// (viento, caída de la lluvia) y los tiempos no se escalan. La altitud la da el tiempo (preset) en cada paso.
// Diferencia con Frost: allí `BaseAltitude` es el CENTRO de la masa de la celda; en Century «altitud» siempre ha sido la BASE de las nubes
// (uCBase). Aquí la base plana de cada celda es altitud + desplazamiento de la morfología, y su centro (`y`) queda LIFT × espesor por encima:
// la referencia de base procede del tiempo, pero cada celda tiene un desfase vertical determinista por región y morfología;
// su centro (`y`) sigue a LIFT × espesor sobre esa base, sin hundir las torres bajo el terreno.
//
// Convenciones: norte −Z, este +X; posiciones en metros.

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const clamp01 = (v) => clamp(v, 0, 1)
const lerp = (a, b, t) => a + (b - a) * t
const smooth = (a, b, x) => { if (b <= a) return x >= b ? 1 : 0; const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t) }
const moveTowards = (c, t, d) => (Math.abs(t - c) <= d ? t : c + Math.sign(t - c) * d)
// Convención geométrica continua: una masa húmeda poco estratificada desarrolla
// cuerpos redondeados incluso sin tormenta. La etiqueta MORPH no interviene.
// El condensado impide que una nube todavía naciente se convierta en una torre.
const cloudBody = (sheet, wispy, condensate) =>
  (1 - 0.78 * clamp01(sheet)) * (1 - 0.55 * clamp01(wispy)) * smooth(0.06, 0.36, clamp01(condensate))
/** Redondeo al par (Mathf.RoundToInt de Unity): 0,5 → 0 · 1,5 → 2 · 2,5 → 2. */
const roundEven = (x) => { const r = Math.round(x); return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r }
const floorDiv = (v, d) => (d <= 0 ? 0 : Math.floor(v / d))

// ---------- hash (el de Frost: enteros de 32 bits) ----------
const hash = (a, b) => { let h = Math.imul((a | 0) ^ (b | 0), 0x27d4eb2d); h ^= h >> 15; return h | 0 }
const hash3 = (seed, x, z) => hash(hash(seed, Math.imul(x, 73856093)), Math.imul(z, 19349663))
const hash01 = (seed, v) => (((hash(seed, Math.imul(v, 668265263)) >>> 0) & 0x00ffffff) / 16777215)

// ---------- morfologías (enum de Frost) ----------
export const MORPH = { CIRRUS: 0, STRATUS: 1, STRATOCUMULUS: 2, CUMULUS: 3, TOWERING: 4, CUMULONIMBUS: 5, NIMBOSTRATUS: 6 }
export const MORPH_NAMES = ['cirro', 'estrato', 'estratocúmulo', 'cúmulo', 'cúmulo torreón', 'cumulonimbo', 'nimbostrato']
/** Valor «tipo de nube» (0 estrato plano · 0,5 cúmulo · 1 cumulonimbo) con el que el cielo elige el perfil de altura de cada morfología. */
export const MORPH_TYPE = [0.0, 0.0, 0.3, 0.5, 0.78, 1.0, 0.12]
const A0 = { h: 0.92, w: 0.92, d: 0.62, t: 0.25, s: 1.04 }
const mp = (hMin, hMax, vMin, vMax, alt, pScale, pOff, pMin, pMax, anvil = A0) => ({ hMin, hMax, vMin, vMax, alt, pScale, pOff, pMin, pMax, anvil })
/** Parámetros por morfología (los de FrostEnvironmentCloudSettings). `alt` = desplazamiento de altitud en capas. */
export const MORPH_PARAMS = [
  mp(1.35, 1.35, 0.25, 0.25, 4.50, 0.50, 0, 3, 5),
  mp(1.45, 2.10, 0.32, 0.32, -0.25, 1.00, -1, 4, 6),
  mp(1.35, 1.35, 0.55, 0.55, 0.00, 1.00, -2, 4, 6),
  mp(1.00, 1.00, 0.65, 1.35, 0.00, 1.00, -2, 4, 6),
  mp(1.05, 1.05, 1.25, 3.00, 0.00, 1.00, 0, 5, 7),
  mp(1.55, 1.55, 2.80, 6.20, 0.35, 1.00, 1, 6, 8, { h: 0.92, w: 0.92, d: 0.62, t: 0.25, s: 1.04 }),
  mp(1.70, 2.35, 1.15, 1.15, -0.25, 1.00, 0, 5, 7),
]

/** Ajustes por defecto, en unidades de Frost (antes de multiplicar por `scale`). */
export const CLOUD_DEFAULTS = {
  scale: 8, seed: 1, patternSeed: 1337, maxCells: 56, chunkSize: 260, prewarm: 2, layerThickness: 45,
  sizeMul: 1, minSize: 65, maxSize: 190, patternCount: 8, structure: 0.72, minAspect: 1.10, maxAspect: 2.65, formationFade: 4,
  terminalVelocity: 32, mmAtMax: 45, mapSize: 128,
}

const MAX_PRIMS = 8
const PHYS_STEP = 0.125
const MIN_SIM_CHUNKS = 12
const WORLD_KEY_SEED = 0x51a7c31
const LIFT = 0.55   // centro de la celda sobre su base, en espesores (las primitivas de Frost llegan a ~0,55 espesores por debajo del centro)

import { queryMethods } from './cloudfield-query.js'
import { bakeMethods } from './cloudfield-bake.js'
import { CloudVolume } from './cloud-volume.js'

export class CloudField {
  /** `o.seed` = semilla de la sesión; `o.scale` = metros por unidad de Frost (8). El resto: CLOUD_DEFAULTS. */
  constructor(o = {}) {
    const c = { ...CLOUD_DEFAULTS, ...o }
    this.cfg = c
    this.seed = c.seed | 0
    const K = this.K = clamp(+c.scale || 8, 0.5, 100)
    this.chunk = Math.max(80, c.chunkSize) * K
    const SZ = this.sizeMul = clamp(+c.sizeMul || 1, 0.25, 6) // tamaño de las celdas (1 = el de Frost): más grande = más solapadas = cielo más cubierto con las mismas celdas
    this.minSize = Math.max(16, c.minSize * 0.55) * K * SZ
    this.maxSize = Math.max(Math.max(16, c.minSize * 0.55), c.maxSize) * K * SZ
    this.layer = Math.max(12, c.layerThickness) * K
    this.structure = clamp01(c.structure)
    this.fade = Math.max(0.5, c.formationFade)
    const cap = clamp(Math.round(c.maxCells), 8, 128)
    this.cells = []
    for (let i = 0; i < cap; i++) this.cells.push(this._newCell(i + 1))
    this._candX = new Int32Array(cap); this._candZ = new Int32Array(cap); this._candD = new Float64Array(cap); this._sel = new Uint8Array(cap)
    this.baseAltitude = 1500
    this.wind = [0, 0]              // velocidad del viento de las nubes (m/s) en el último paso
    this.windOff = [0, 0]           // desplazamiento integrado (m)
    this.evolution = 0              // segundos de evolución atmosférica (la oscilación diferencial depende de él)
    this._acc = 0
    this.f = { coverage: 0, density: 0, humidity: 0, storm: 0, rain: 0 } // forzado suavizado del mundo
    this._seeded = false
    this.tornado = null // referencia a World.tornado, nunca un segundo estado meteorológico
    this._prepared = false; this._pcx = -1e9; this._pcz = -1e9; this._pr = -1
    const chunks = this.chunk
    this.simRadius = Math.max(chunks * MIN_SIM_CHUNKS, chunks * (clamp(Math.round(c.prewarm), 1, 4) + 6))
    const side = Math.max(3, Math.ceil(Math.sqrt(cap * 1.6)))
    this.stride = clamp(Math.ceil((MIN_SIM_CHUNKS * 2 + 1) / side), 1, 8)
    this._tmp = this._newSample()
    // Buffers temporales de las celdas residentes: se reutilizan por paso, no son estado persistido.
    this._residentJitter = [0, 0]
    this._residentA = [0, 0]; this._residentB = [0, 0]; this._residentD = [0, 0]
    this._tile = { x: 0, z: 0 }
    // mapa 2D para el cielo
    const N = clamp(Math.round(c.mapSize), 32, 512)
    this.map = { N, half: this.simRadius, cx: 0, cz: 0, data: new Uint8Array(N * N * 4), version: 0, slabBase: 0, slabThick: 1, hasClouds: false, prims: 0, ms: 0 }
    this.map.volume = new CloudVolume(this.map)
    this._acc2 = null
    this._sig = null; this._bakeT = 1e9
  }

  _newCell(id) {
    return { id, key: 0, sx: 0, sz: 0, active: false, retiring: false, pre: false, x: 0, y: 0, z: 0, radius: 0, thick: 0, condensate: 0, maturity: 0, dev: 0, tau: 0,
      precipMat: 0, rainEff: 0, elec: 0, sizeVar: 0, rot: 0, convective: 0, sheet: 0, wispy: 0, prevMorph: MORPH.CUMULUS, morph: MORPH.CUMULUS, blend: 1 }
  }
  _newSample() { return { key: 0, sx: 0, sz: 0, x: 0, y: 0, base: 0, z: 0, radius: 0, thick: 0, condensate: 0, maturity: 0, dev: 0, tau: 0, precipMat: 0, rainEff: 0, elec: 0, sizeVar: 0, rot: 0, convective: 0, sheet: 0, wispy: 0, morph: MORPH.CUMULUS } }

  // ---------- claves ----------
  _worldKey(cx, cz) { const k = hash3(this.seed ^ this.cfg.patternSeed, cx, cz) & 0x7fffffff; return k === 0 ? 1 : k }
  _potential(cx, cz) { return hash01(this._worldKey(cx, cz), 101) }
  /** Chunk de origen de la celda del tile (tx, tz) (un chunk de entre `stride`² elegido por hash). */
  _sourceOfTile(tx, tz, out) {
    const tk = hash3(this.seed ^ this.cfg.patternSeed ^ WORLD_KEY_SEED, tx, tz), s = this.stride
    out.x = tx * s + clamp(Math.floor(hash01(tk, 17) * s), 0, s - 1)
    out.z = tz * s + clamp(Math.floor(hash01(tk, 29) * s), 0, s - 1)
  }
  _jitter(key, out = [0, 0]) { out[0] = lerp(-0.48, 0.48, hash01(key, 17)); out[1] = lerp(-0.48, 0.48, hash01(key, 29)); return out }

  /** Selecciona una fuente estable del mosaico global, sin mover la caché de la cámara. */
  selectTornadoMother(x, z) {
    const [tx, tz] = this._tileRange(x, z), source = { x: 0, z: 0 }
    let best = null, score = -Infinity
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      this._sourceOfTile(tx + dx, tz + dz, source)
      const sx = source.x, sz = source.z, key = this._worldKey(sx, sz)
      const px = (sx + 0.5 + this._jitter(key)[0]) * this.chunk + this.windOff[0]
      const pz = (sz + 0.5 + this._jitter(key)[1]) * this.chunk + this.windOff[1]
      const dist = Math.hypot(px - x, pz - z)
      // La presencia potencial es estable aun antes de que la tormenta madure.
      const rank = this._potential(sx, sz) * 0.25 - dist / (this.chunk * 2)
      if (rank > score) { score = rank; best = { motherSx: sx, motherSz: sz, motherKey: key } }
    }
    return best
  }

  /** Posición derivada de la fuente; no crea otro estado ni depende de celdas residentes. */
  motherPosition(t) {
    if (!t || t.motherKey !== this._worldKey(t.motherSx, t.motherSz)) return null
    const j = this._jitter(t.motherKey, this._motherJitter || (this._motherJitter = [0, 0]))
    const p = this._motherPosition || (this._motherPosition = [0, 0])
    p[0] = (t.motherSx + 0.5 + j[0]) * this.chunk + this.windOff[0]
    p[1] = (t.motherSz + 0.5 + j[1]) * this.chunk + this.windOff[1]
    return p
  }

  // ---------- forzado ----------
  /** `s` = { coverage, density, humidity, storm, rain (mm/h), altitude (m) } */
  _target(s) {
    return { coverage: clamp01(s.coverage), density: clamp01(s.density), humidity: clamp01(s.humidity), storm: clamp01(s.storm), rain: Math.max(0, s.rain || 0) }
  }
  _seed(s) { Object.assign(this.f, this._target(s)); this._seeded = true }
  _advanceForcing(s, dt) {
    const t = this._target(s), F = this.f
    const sr = Math.max(0.001, dt / this.fade), rr = Math.max(0.001, dt / (this.fade * 1.25)), st = Math.max(0.001, dt / (this.fade * 1.35))
    F.coverage = moveTowards(F.coverage, t.coverage, sr); F.density = moveTowards(F.density, t.density, sr); F.humidity = moveTowards(F.humidity, t.humidity, sr)
    F.storm = moveTowards(F.storm, t.storm, st)
    F.rain = moveTowards(F.rain, t.rain, rr * Math.max(1, Math.max(F.rain, t.rain)))
  }

  /**
   * Un paso: `state` (ver _target), `wind` = [x, z] m/s a la altura de las nubes, `dt` s.
   * El primer paso fija el forzado sin transición (la escena empieza con el tiempo que toca).
   */
  update(state, wind, dt) {
    const d = Math.max(0, +dt || 0)
    this.baseAltitude = Number.isFinite(+state.altitude) ? +state.altitude : this.baseAltitude
    this.wind[0] = +wind[0] || 0; this.wind[1] = +wind[1] || 0
    if (!this._seeded) this._seed(state)
    this.evolution += d
    this.windOff[0] += this.wind[0] * d; this.windOff[1] += this.wind[1] * d
    this._acc += d
    let steps = 0
    while (this._acc >= PHYS_STEP && steps < 4) { this._advanceForcing(state, PHYS_STEP); this._refreshResidents(PHYS_STEP); this._acc -= PHYS_STEP; steps++ }
    if (this._acc > PHYS_STEP * 4) this._acc = PHYS_STEP * 4
    this._positionResidents()
  }

  // ---------- muestra del mundo (el corazón: EvaluateWorldSample) ----------
  _sizeVariation(a, b) {
    let v = clamp01(a); const sel = clamp01(b)
    if (sel < 0.34) v = v ** 1.75; else if (sel > 0.66) v = 1 - (1 - v) ** 1.75; else v = v * v * (3 - 2 * v)
    return clamp01(v)
  }
  _morphology(cov, dens, hum, storm, rain, mat, dev) {
    if (storm >= 0.48 && hum >= 0.62) {
      if (storm >= 0.72 && dens >= 0.62 && mat >= 0.55 && dev >= 0.62) return MORPH.CUMULONIMBUS
      if (mat >= 0.34 && dev >= 0.42) return MORPH.TOWERING
      return MORPH.CUMULUS
    }
    if (rain > 0.001 && cov >= 0.70) return MORPH.NIMBOSTRATUS
    if (cov >= 0.78) return dens >= 0.58 ? MORPH.STRATUS : MORPH.STRATOCUMULUS
    if (dens <= 0.28 && hum <= 0.62 && rain <= 0.001 && storm <= 0.20) return MORPH.CIRRUS
    if (cov >= 0.52 && dens <= 0.48) return MORPH.STRATOCUMULUS
    return MORPH.CUMULUS
  }
  _hRadius(m, variation, coverage) {
    const P = MORPH_PARAMS[m]
    return lerp(this.minSize, this.maxSize, clamp01(variation)) * lerp(Math.max(0.1, P.hMin), Math.max(0.1, P.hMax), clamp01(coverage))
  }
  _vThickness(m, dev, variation) {
    const P = MORPH_PARAMS[m]
    return this.layer * lerp(Math.max(0.05, P.vMin), Math.max(0.05, P.vMax), clamp01(dev)) * lerp(0.82, 1.18, clamp01(variation))
  }
  _targetRadius(m, variation, coverage) {
    const authored = this._hRadius(m, variation, coverage)
    const n = clamp01((clamp01(coverage) - 0.58) / 0.42), fill = n * n * (3 - 2 * n)
    if (fill <= 0) return authored
    const spacing = this.chunk * Math.max(1, this.stride)
    return lerp(authored, Math.max(authored, spacing * 0.76), fill)
  }
  _altOffset(m) { return this.layer * MORPH_PARAMS[m].alt }
  /** Relieve vertical por nube, derivado de las claves ya existentes (sin estado ni ruido temporal extra).
   * Las capas estratiformes conservan bases próximas; los cúmulos admiten más variación.
   * La componente regional agrupa nubes vecinas y evita una distribución totalmente aleatoria. */
  _altitudeRelief(cx, cz, key, morph) {
    // Relieve reducido: los cúmulos siguen a diferentes cotas, pero sin
    // escalones de varios cientos de metros entre nubes del mismo tipo.
    const spread = [0.20, 0.09, 0.16, 0.38, 0.52, 0.33, 0.10][morph] ?? 0.20
    const regionSize = this.stride * 3
    const regionKey = this._worldKey(floorDiv(cx, regionSize), floorDiv(cz, regionSize))
    const regional = hash01(regionKey, 257) * 2 - 1
    const individual = hash01(key, 261) * 2 - 1
    return this.layer * spread * (regional * 0.35 + individual * 0.65)
  }
  /** Oscilación diferencial: cada celda va un poco más o menos rápida que el viento, con su propio periodo y fase. */
  _differential(key, m, out) {
    const sp = Math.hypot(this.wind[0], this.wind[1])
    if (sp <= 0.001) { out[0] = 0; out[1] = 0; return out }
    const dx = this.wind[0] / sp, dz = this.wind[1] / sp, px = -dz, pz = dx
    const layer = hash01(key, 223) // variación de cizalladura estable: la clase MORPH no desplaza la nube
    const identity = lerp(-1, 1, hash01(key, 227))
    let variation = lerp(0.055, 0.165, this.structure) * lerp(0.88, 1.14, layer) * identity
    const period = lerp(72, 168, hash01(key, 229)), ang = (Math.PI * 2) / Math.max(24, period)
    const phase = hash01(key, 233) * Math.PI * 2 + this.evolution * ang
    const maxAmp = this.chunk * 0.22
    const amp = Math.min(maxAmp, Math.abs(sp * variation) / Math.max(0.0001, ang))
    const along = Math.sin(phase) * amp * (variation < 0 ? -1 : 1)
    const cross = Math.sin(phase * 0.73 + 1.17) * amp * lerp(-0.22, 0.22, hash01(key, 239))
    out[0] = dx * along + px * cross; out[1] = dz * along + pz * cross
    return out
  }

  /** Muestra del mundo para el chunk (cx, cz): sin estado propio, solo hash + forzado + desplazamiento actual. */
  evaluate(cx, cz, s = this._newSample()) {
    const F = this.f, key = this._worldKey(cx, cz), potential = this._potential(cx, cz)
    const cov = clamp01(F.coverage), popCov = 1 - (1 - cov) ** 1.35
    const presence = cov <= 0.0001 ? 0 : cov >= 0.9999 ? 1 : smooth(potential - 0.10, potential + 0.10, popCov)
    const sizeVar = this._sizeVariation(hash01(key, 41), hash01(key, 43))
    const localVar = lerp(0.82, 1.12, sizeVar)
    const humSupport = clamp01((F.humidity - 0.32) / 0.63)
    let condensate = clamp01(presence * lerp(0.30, 1.0, F.density) * lerp(0.38, 1.0, humSupport) * localVar)
    let maturity = clamp01((condensate - 0.04) / 0.82)
    const localStorm = clamp01(F.storm * lerp(0.78, 1.14, hash01(key, 73)))
    let dev = clamp01(0.10 + localStorm * humSupport * lerp(0.55, 1.0, F.density) * 0.90 + maturity * 0.12)
    let morph = this._morphology(F.coverage, F.density, F.humidity, localStorm, F.rain, maturity, dev)
    // La clasificación es diagnóstico/meteorología; la forma nace de características continuas.
    // Ningún umbral de MORPH sustituye las primitivas ni la altitud de una nube existente.
    const sheet = smooth(0.43, 0.86, cov) * (1 - smooth(0.24, 0.76, localStorm) * 0.75)
    const wispy = (1 - smooth(0.29, 0.67, F.density)) * (1 - smooth(0.38, 0.81, cov)) * (1 - smooth(0.18, 0.6, localStorm))
    let convective = clamp01(smooth(0.10, 0.68, dev * humSupport * 0.9 + localStorm * 0.35) * (1 - 0.48 * wispy))
    const authoredRadius = lerp(this.minSize, this.maxSize, sizeVar) * (1 + 0.26 * sheet + 0.12 * convective + 0.08 * wispy)
    const fill = smooth(0.58, 1, cov)
    let radius = lerp(authoredRadius, Math.max(authoredRadius, this.chunk * Math.max(1, this.stride) * 0.76), fill)
    const body = cloudBody(sheet, wispy, condensate)
    // sizeMul antes solo agrandaba el plano XZ. Con el tamaño habitual 2×,
    // esto convertía los cúmulos en discos: el cuerpo escala también en Y,
    // mientras los estratos y las torres convectivas conservan su perfil.
    let thick = this.layer * (0.48 + 0.34 * maturity + 0.17 * sheet + 0.24 * wispy + convective * (0.36 + 4.25 * localStorm * humSupport)) * lerp(0.82, 1.18, sizeVar)
    thick = thick * (1 + (this.sizeMul - 1) * 0.72 * body * (1 - 0.90 * convective))
      + this.layer * 0.64 * body * (1 - 0.88 * convective)
    const t = this.tornado
    if (t && t.motherKey === key && t.motherSx === cx && t.motherSz === cz && !['idle', 'ended'].includes(t.phase)) {
      // La nube seleccionada madura dentro del CloudField existente; la fase la aporta World.
      const org = t.phase === 'development' ? 0.15 + 0.35 * clamp01(t.phaseAge / Math.max(1, this.tornadoDurations?.tornadoDevelopmentSeconds || 8))
        : t.phase === 'organization' ? 0.5 + 0.5 * clamp01(t.phaseAge / Math.max(1, this.tornadoDurations?.tornadoOrganizationSeconds || 6))
        : t.phase === 'dissipation' ? Math.max(0, 0.55 * (1 - t.phaseAge / Math.max(1, this.tornadoDurations?.tornadoDissipationSeconds || 5)))
        : t.phase === 'weakening' ? 0.85 : 1
      const k = org * org * (3 - 2 * org)
      condensate = Math.max(condensate, k * 0.85)
      maturity = Math.max(maturity, k * 0.88)
      dev = Math.max(dev, k * 0.95)
      convective = Math.max(convective, k)
      if (k > 0.45) morph = MORPH.CUMULONIMBUS
      else if (k > 0.15) morph = MORPH.TOWERING
      radius = Math.max(radius, this.chunk * 0.28 * k)
      thick = Math.max(thick, this.layer * (0.7 + 0.7 * k))
    }
    const tau = Math.max(0, condensate * lerp(0.55, 2.60, maturity) * (0.70 + clamp01(thick / Math.max(1, this.layer)) * 1.35))
    const opt = smooth(0.72, 1.55, tau), matE = smooth(0.48, 0.80, maturity), humE = smooth(0.52, 0.88, F.humidity)
    const precipMat = F.rain > 0.001 ? clamp01(opt * matE * humE) : 0
    const rainEff = F.rain * precipMat
    let elec = 0
    if (morph === MORPH.CUMULONIMBUS) elec = clamp01(smooth(0.58, 0.92, localStorm) * smooth(0.62, 0.92, dev) * smooth(0.68, 0.92, maturity) * smooth(1.0, 2.4, tau))
    const [jx, jz] = this._jitter(key), df = this._differential(key, morph, this._d2 || (this._d2 = [0, 0]))
    s.key = key; s.sx = cx; s.sz = cz
    s.x = (cx + 0.5 + jx) * this.chunk + this.windOff[0] + df[0]
    // Conservar el contrato de distribución de altitudes: estratos próximos y
    // cúmulos con relieve dentro de tolerancias verificadas en CORR-002.
    const regionSize = this.stride * 3
    const regional = hash01(this._worldKey(floorDiv(cx, regionSize), floorDiv(cz, regionSize)), 257) * 2 - 1
    const individual = hash01(key, 261) * 2 - 1
    const relief = this.layer * (0.20 * (1 - 0.60 * sheet) + convective * 0.18 + wispy * 0.06) * (0.35 * regional + 0.65 * individual)
    s.base = this.baseAltitude + this.layer * (2.9 * wispy - 0.12 * sheet + 0.24 * convective) + relief
    s.y = s.base + LIFT * thick
    s.z = (cz + 0.5 + jz) * this.chunk + this.windOff[1] + df[1]
    s.radius = radius; s.thick = thick; s.condensate = condensate; s.maturity = maturity; s.dev = dev; s.tau = tau
    s.precipMat = precipMat; s.rainEff = rainEff; s.elec = elec; s.sizeVar = sizeVar; s.rot = hash01(key, 53) * 360
    s.convective = convective; s.sheet = sheet; s.wispy = wispy; s.morph = morph
    return s
  }

  // ---------- celdas residentes (la caché visual de Frost) ----------
  _refreshResidents(dt) {
    for (const c of this.cells) {
      if (!c.active) continue
      this.evaluate(c.sx, c.sz, this._tmp); this._apply(c, this._tmp, dt)
    }
  }
  _apply(c, s, dt) {
    const was = c.condensate > 0.002, is = s.condensate > 0.002
    if (!was && is) c.pre = false
    c.retiring = was && !is
    if (s.morph !== c.morph) { c.prevMorph = c.morph; c.morph = s.morph; c.blend = 0 }
    if (dt > 0) c.blend = moveTowards(c.blend, 1, dt / this.fade)
    const [jx, jz] = this._jitter(c.key, this._residentJitter), dd = this._residentDifferential(c)
    c.x = (c.sx + 0.5 + jx) * this.chunk + this.windOff[0] + dd[0]
    c.z = (c.sz + 0.5 + jz) * this.chunk + this.windOff[1] + dd[1]
    const shapeDt = Math.max(0, dt) / Math.max(8, this.fade * 2)
    c.y = dt > 0 ? moveTowards(c.y, s.y, Math.max(this.layer * 0.25, Math.abs(s.y - c.y)) * shapeDt) : s.y
    c.radius = dt > 0 ? moveTowards(c.radius, s.radius, Math.max(this.chunk * 0.05, Math.abs(s.radius - c.radius)) * shapeDt) : s.radius
    c.thick = dt > 0 ? moveTowards(c.thick, s.thick, Math.max(this.layer * 0.12, Math.abs(s.thick - c.thick)) * shapeDt) : s.thick
    c.convective = dt > 0 ? moveTowards(c.convective, s.convective, shapeDt) : s.convective
    c.sheet = dt > 0 ? moveTowards(c.sheet, s.sheet, shapeDt) : s.sheet
    c.wispy = dt > 0 ? moveTowards(c.wispy, s.wispy, shapeDt) : s.wispy
    c.condensate = dt > 0 ? moveTowards(c.condensate, s.condensate, shapeDt * 2) : s.condensate
    c.maturity = s.maturity; c.dev = s.dev; c.tau = s.tau
    c.precipMat = s.precipMat; c.rainEff = s.rainEff; c.elec = s.elec; c.sizeVar = s.sizeVar; c.rot = s.rot
  }
  _residentDifferential(c) {
    // Una nube no cambia de trayectoria cuando el diagnóstico pasa a otro género.
    return this._differential(c.key, c.morph, this._residentD)
  }
  _positionResidents() {
    for (const c of this.cells) {
      if (!c.active) continue
      const [jx, jz] = this._jitter(c.key, this._residentJitter), dd = this._residentDifferential(c)
      c.x = (c.sx + 0.5 + jx) * this.chunk + this.windOff[0] + dd[0]
      c.z = (c.sz + 0.5 + jz) * this.chunk + this.windOff[1] + dd[1]
    }
  }
  _assignImmediate(c, s, pre) {
    c.key = s.key; c.sx = s.sx; c.sz = s.sz; c.active = true; c.retiring = false; c.pre = pre
    c.x = s.x; c.y = s.y; c.z = s.z
    c.radius = s.radius; c.thick = s.thick; c.condensate = s.condensate; c.maturity = s.maturity; c.dev = s.dev; c.tau = s.tau
    c.precipMat = s.precipMat; c.rainEff = s.rainEff; c.elec = s.elec; c.sizeVar = s.sizeVar; c.rot = s.rot
    c.convective = s.convective; c.sheet = s.sheet; c.wispy = s.wispy
    c.prevMorph = s.morph; c.morph = s.morph; c.blend = 1
  }
  _deactivate(c) {
    c.active = false; c.retiring = false; c.pre = false; c.key = 0; c.sx = 0; c.sz = 0; c.condensate = 0; c.maturity = 0; c.dev = 0; c.tau = 0
    c.precipMat = 0; c.rainEff = 0; c.elec = 0; c.convective = 0; c.sheet = 0; c.wispy = 0; c.blend = 1
  }
  _horizontalOf(sx, sz) {
    const key = this._worldKey(sx, sz), [jx, jz] = this._jitter(key)
    return [(sx + 0.5 + jx) * this.chunk + this.windOff[0], (sz + 0.5 + jz) * this.chunk + this.windOff[1]]
  }

  /**
   * Mantiene las celdas residentes alrededor de (x, z): las más cercanas dentro de `radius` (≤ capacidad). Devuelve true si cambió algo
   * (cuando el observador cambia de chunk atmosférico o el radio cambia en un chunk entero).
   */
  prepare(x, z, radius = this.simRadius) {
    if (!this._seeded) return false
    const ch = this.chunk, r = clamp(Math.max(ch, radius), ch, this.simRadius)
    const ax = x - this.windOff[0], az = z - this.windOff[1]
    const scx = Math.floor(ax / ch), scz = Math.floor(az / ch), rc = Math.ceil(r / ch)
    if (this._prepared && scx === this._pcx && scz === this._pcz && Math.abs(rc - this._pr) < 1) return false
    this._reconcile(x, z, r)
    this._prepared = true; this._pcx = scx; this._pcz = scz; this._pr = rc
    return true
  }
  _gather(x, z, r) {
    const ch = this.chunk, S = this.stride, tile = ch * S
    const ax = x - this.windOff[0], az = z - this.windOff[1]
    const ctx = floorDiv(Math.floor(ax / ch), S), ctz = floorDiv(Math.floor(az / ch), S)
    const tr = Math.ceil(r / tile) + 2, rm = r + tile * 0.72, r2 = rm * rm
    const src = this._tile
    let n = 0
    const cap = this._candX.length
    for (let dz = -tr; dz <= tr; dz++) for (let dx = -tr; dx <= tr; dx++) {
      this._sourceOfTile(ctx + dx, ctz + dz, src)
      const p = this._horizontalOf(src.x, src.z), ex = p[0] - x, ez = p[1] - z, d2 = ex * ex + ez * ez
      if (d2 > r2) continue
      if (n < cap) { this._candX[n] = src.x; this._candZ[n] = src.z; this._candD[n] = d2; n++; continue }
      let w = 0, wd = this._candD[0]
      for (let i = 1; i < n; i++) if (this._candD[i] > wd) { wd = this._candD[i]; w = i }
      if (d2 >= wd) continue
      this._candX[w] = src.x; this._candZ[w] = src.z; this._candD[w] = d2
    }
    return n
  }
  _reconcile(x, z, r) {
    const n = this._gather(x, z, r), cells = this.cells
    this._sel.fill(0)
    for (let i = 0; i < n; i++) {
      const sx = this._candX[i], sz = this._candZ[i]
      let ex = -1
      for (let k = 0; k < cells.length; k++) if (cells[k].active && cells[k].sx === sx && cells[k].sz === sz) { ex = k; break }
      if (ex >= 0) { this._sel[ex] = 1; continue }
      let slot = -1
      for (let k = 0; k < cells.length; k++) if (!cells[k].active && !this._sel[k]) { slot = k; break }
      if (slot < 0) for (let k = 0; k < cells.length; k++) if (!this._sel[k]) { slot = k; break }
      if (slot < 0) break
      this.evaluate(sx, sz, this._tmp); this._assignImmediate(cells[slot], this._tmp, true); this._sel[slot] = 1
    }
    for (let k = 0; k < cells.length; k++) if (cells[k].active && !this._sel[k]) this._deactivate(cells[k])
    this._refreshResidents(0); this._positionResidents()
  }

  // ---------- consultas físicas ----------
  _tileRange(x, z) {
    const ch = this.chunk, S = this.stride
    const ax = x - this.windOff[0], az = z - this.windOff[1]
    return [floorDiv(Math.floor(ax / ch), S), floorDiv(Math.floor(az / ch), S)]
  }

  // ---------- primitivas de densidad (identidad espacial estable, morfología continua) ----------
  /** Estructura estable por clave: lóbulos que crecen y se deforman sin cambiar de plantilla MORPH.
   * La categoría sigue disponible para lluvia, rayos y diagnóstico; no decide geometría.
   * Se reutilizan los mismos ocho slots y objetos, sin asignaciones por paso y sin textura GPU nueva.
   */
  primitives(cell, list) {
    const count = Math.min(MAX_PRIMS, 6), key = cell.key, r = Math.max(this.K * 10, cell.radius), h = Math.max(this.K * 6, cell.thick)
    const cv = clamp01(cell.convective ?? 0), sheet = clamp01(cell.sheet ?? 0), wispy = clamp01(cell.wispy ?? 0)
    const rot = cell.rot * Math.PI / 180, dirX = Math.cos(rot), dirZ = Math.sin(rot)
    const mix = lerp(0.68, 1.02, clamp01(cell.condensate))
    for (let i = 0; i < count; i++) {
      const o = list[i] || (list[i] = {}), a = hash01(key, i * 17 + 1), b = hash01(key, i * 17 + 2)
      const c = hash01(key, i * 17 + 3), d = hash01(key, i * 17 + 4)
      const t = i / (count - 1), angle = a * Math.PI * 2 + rot
      const radial = Math.sqrt(b) * (i === 0 ? 0.18 : 0.65)
      const tower = Math.pow(t, 0.88) * cv, layer = (c - 0.5) * 0.20 * (1 - cv)
      const body = cloudBody(sheet, wispy, cell.condensate ?? 0)
      // Bultos tridimensionales anclados a la misma clave. El cuerpo aparece
      // progresivamente; cada lóbulo tiene altura/radio distintos sin cambiar
      // de topología cuando World reclasifica la formación.
      const loft = body * (1 - cv) * (0.12 + 0.34 * t + (c - 0.5) * 0.20)
      const horizontal = (1 - 0.22 * t * cv) * (1 + sheet * 0.14) * (1 - 0.12 * body * (1 - cv))
      const spreadX = Math.cos(angle) * radial * r * horizontal
      const spreadZ = Math.sin(angle) * radial * r * horizontal
      const cirrusLine = (t - 0.5) * r * 1.1
      o.x = lerp(spreadX, dirX * cirrusLine, wispy * 0.68) + (hash01(key, 187) - 0.5) * tower * r * 0.16
      o.z = lerp(spreadZ, dirZ * cirrusLine, wispy * 0.68) + (hash01(key, 191) - 0.5) * tower * r * 0.16
      o.y = (tower * 0.83 + loft + layer) * h
      o.rx = r * lerp(0.55, 0.27, tower) * (1 - 0.16 * body * (1 - cv)) * lerp(1, 1.17, sheet) * lerp(1, 1.12, d)
      o.rz = r * lerp(0.54, 0.29, tower) * (1 - 0.16 * body * (1 - cv)) * lerp(1, 1.20, sheet) * lerp(1, 0.88, c)
      o.ry = h * (0.24 + 0.43 * body * (1 - cv) + 0.16 * cv + 0.06 * sheet) * lerp(0.83, 1.14, d)
      // La convección alimenta las torres superiores; los bancos mantienen múltiples capas.
      o.str = mix * lerp(1.12, 0.78, t) * (1 + 0.25 * tower + 0.11 * sheet) * (1 - wispy * 0.10)
      o.type = clamp01(0.10 + 0.65 * cv + 0.17 * (1 - sheet) - 0.08 * wispy)
    }
    return count
  }

  // ---------- mapa 2D para el cielo ----------
  /** Huella digital de lo que se dibuja (para no volver a hornear si nada cambió). */
  _signature() {
    let h = 17
    h = hash(h, Math.round(this.baseAltitude / 25))
    for (const c of this.cells) {
      if (!c.active || c.condensate <= 0.002) continue
      h = hash(h, c.key); h = hash(h, Math.round(c.radius / (this.chunk * 0.02))); h = hash(h, Math.round(c.thick / (this.layer * 0.05)))
      h = hash(h, Math.round((c.x - this.windOff[0]) / (this.chunk * 0.1))); h = hash(h, Math.round((c.z - this.windOff[1]) / (this.chunk * 0.1))) // deriva diferencial (≈ 200 m): el mapa la sigue
      h = hash(h, Math.round(c.convective * 24)); h = hash(h, Math.round(c.sheet * 24)); h = hash(h, Math.round(c.wispy * 24))
      h = hash(h, Math.round(c.condensate * 30)); h = hash(h, Math.round(c.y / (this.layer * 0.1)))
    }
    return h
  }

  /**
   * Observador en (x, z) (mundo): mantiene las celdas y, si cambió algo (o el observador se alejó del centro del mapa), vuelve a hornear.
   * Devuelve el mapa (siempre el mismo objeto; `version` sube con cada horneado). `dt` = s desde la última llamada.
   */
  maintain(x, z, dt = 0, force = false) {
    this._bakeT += Math.max(0, dt)
    this.prepare(x, z)
    const M = this.map, ax = x - this.windOff[0], az = z - this.windOff[1]
    const far = Math.hypot(ax - M.cx, az - M.cz) > M.half * 0.25
    if (force || far || this._bakeT >= 0.4) {
      this._bakeT = 0
      const sig = this._signature()
      if (force || far || sig !== this._sig || M.version === 0) {
        this._sig = sig
        if (far || M.version === 0) { M.cx = ax; M.cz = az }
        this.bake()
      }
    }
    M.volume.advance(dt, this.f, this.wind)
    return M
  }

  /** Resumen para pruebas e inspector: celdas por morfología, forzado y desplazamiento. */
  stats() {
    const byMorph = [0, 0, 0, 0, 0, 0, 0]
    let active = 0
    for (const c of this.cells) if (c.active && c.condensate > 0.002) { active++; byMorph[c.morph]++ }
    return { active, byMorph, forcing: { ...this.f }, windOff: [...this.windOff], simRadius: this.simRadius, stride: this.stride, tile: this.chunk * this.stride, cells: this.cells.length }
  }
}

Object.assign(CloudField.prototype, queryMethods, bakeMethods)
