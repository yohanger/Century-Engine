// Niebla atmosférica física (bloque D): integral analítica de altura, HG, humedad, visibilidad, volúmenes atmosféricos y referencia CPU del shader.
// Uso: node scripts/test-fog.mjs   (sin DOM)
import { World } from '../src/engine/runtime/world/world.js'
import { makeWorldApi } from '../src/engine/runtime/world/api.js'
import { normalizeWorld } from '../src/engine/runtime/world/params.js'
import { FOG, FOG_DEFAULTS, normalizeFog, fogParams, heightDensity, integrateHeight, hg, makeVolume, volumeContains, resolveVolume, volumeExitDistance, integrationStart, fogRay, shaftStrength, visibility, visibilityOf } from '../src/engine/runtime/world/fog.js'

let bad = 0
const ok = (name, cond, extra = '') => { if (!cond) bad++; console.log((cond ? '  OK  ' : ' FALLA ') + name + (extra !== '' ? `  [${extra}]` : '')) }
const near = (a, b, tol) => Math.abs(a - b) <= tol
const mulberry = (a) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const norm = (v) => { const l = Math.hypot(...v); return v.map((c) => c / l) }

console.log('Parámetros por humedad')
{ const dry = fogParams({ density: 0.01, humidity: 0 }), wet = fogParams({ density: 0.01, humidity: 1 })
  ok('seco: extinción ×0,82, caída 0,00085, g=0,5', near(dry.extinction, 0.0082, 1e-9) && near(dry.falloff, 0.00085, 1e-12) && near(dry.anisotropy, 0.5, 1e-12))
  ok('saturado: extinción ×1,28, caída 0,00185, g=0,69', near(wet.extinction, 0.0128, 1e-9) && near(wet.falloff, 0.00185, 1e-12) && near(wet.anisotropy, 0.69, 1e-12))
  ok('la humedad fuera de 0–1 se recorta', fogParams({ density: 1, humidity: 5 }).humidity === 1 && fogParams({ density: 1, humidity: -2 }).humidity === 0)
  ok('caída manual (>0) manda sobre la automática', fogParams({ density: 1, humidity: 0.5, falloff: 0.01 }).falloff === 0.01)
  ok('densidad 0 → apagada; por encima del mínimo → encendida', !fogParams({ density: 0 }).on && fogParams({ density: 2e-5 }).on)
  ok('distancia máxima recortada a 2400 m y mínimo 1', fogParams({ density: 1, maxDistance: 1e6 }).maxDistance === 2400 && fogParams({ density: 1, maxDistance: -3 }).maxDistance === 1) }

console.log('Integral de altura (analítica) frente a suma numérica')
{ const rnd = mulberry(7); let worst = 0, n = 0
  const num = (oy, ry, s, l, base, k) => { const N = 20000, ds = l / N; let acc = 0; for (let i = 0; i < N; i++) acc += heightDensity(oy + ry * (s + (i + 0.5) * ds), base, k) * ds; return acc }
  for (let i = 0; i < 400; i++) {
    const oy = -40 + rnd() * 400, ry = -1 + rnd() * 2, s = rnd() < 0.3 ? 0 : rnd() * 300, l = 1 + rnd() * 2300, base = rnd() < 0.5 ? 0 : -50 + rnd() * 150, k = 0.0005 + rnd() * 0.004
    const a = integrateHeight(oy, ry, s, l, base, k), b = num(oy, ry, s, l, base, k)
    worst = Math.max(worst, Math.abs(a - b) / Math.max(1, b)); n++
  }
  ok(`${n} rayos aleatorios: error relativo máximo < 1e-6`, worst < 1e-6, worst.toExponential(2))
  // la fórmula de Frost usaba la densidad del punto inicial por debajo de |k·rayY| < 1e-5: error de ~0,1 % que aquí no existe
  const worstFlat = (() => { let w = 0; for (const ry of [0, 1e-7, -1e-6, 3e-6, -3e-6, 1e-5, 2e-5, 1e-4, -1e-4, 1e-3]) for (const l of [10, 500, 2400]) { const a = integrateHeight(139.5, ry, 0, l, 0, 0.0011), b = num(139.5, ry, 0, l, 0, 0.0011); w = Math.max(w, Math.abs(a - b) / b) } return w })()
  ok('rayos casi horizontales (|rayY| ≤ 1e-3): error < 1e-6', worstFlat < 1e-6, worstFlat.toExponential(2)) }
ok('rayo horizontal: densidad constante × longitud', near(integrateHeight(30, 0, 0, 500, 0, 0.001), heightDensity(30, 0, 0.001) * 500, 1e-9))
ok('todo por debajo de la base: la integral es la longitud', integrateHeight(-10, -0.5, 0, 800, 0, 0.002) === 800)
ok('cruce de la base hacia arriba: tramo bajo + tramo alto', (() => { const k = 0.002, r = norm([0, 1, 0.2])[1], len = 600, cross = 20 / r, a = integrateHeight(-20, r, 0, len, 0, k), want = cross + (1 - Math.exp(-k * r * (len - cross))) / (k * r); return near(a, want, 1e-6) })())
ok('longitud 0 o negativa → 0', integrateHeight(5, 0.3, 0, 0, 0, 0.001) === 0 && integrateHeight(5, 0.3, 0, -4, 0, 0.001) === 0)
ok('hacia arriba la niebla pesa menos que a nivel del suelo', integrateHeight(2, 0.9, 0, 1000, 0, 0.0015) < integrateHeight(2, 0, 0, 1000, 0, 0.0015))
ok('subir de altura reduce el espesor óptico horizontal', integrateHeight(400, 0, 0, 1000, 0, 0.0015) < integrateHeight(0, 0, 0, 1000, 0, 0.0015))

console.log('Ajustes de escena')
ok('valores por defecto: modo simple (las escenas antiguas no cambian)', JSON.stringify(normalizeFog({})) === JSON.stringify(FOG_DEFAULTS) && normalizeFog({}).fogMode === 'simple')
ok('un modo desconocido cae en simple; «physical» se respeta', normalizeFog({ fogMode: 'x' }).fogMode === 'simple' && normalizeFog({ fogMode: 'physical' }).fogMode === 'physical')
ok('los números se recortan: caída 0–0,05, altura −500…5000, haces y luz 0–3', (() => { const n = normalizeFog({ fogFalloff: 9, fogHeight: -9999, fogShafts: 77, fogScatter: -3 }); return n.fogFalloff === 0.05 && n.fogHeight === -500 && n.fogShafts === 3 && n.fogScatter === 0 })())
ok('texto o NaN → valor por defecto', (() => { const n = normalizeFog({ fogFalloff: 'a', fogHeight: NaN, fogShafts: null, fogScatter: undefined }); return n.fogFalloff === 0 && n.fogHeight === 0 && n.fogShafts === 1 && n.fogScatter === 1 })())
ok('«Empieza a» desplaza el inicio de la niebla', (() => { const P = fogParams({ density: 0.01, humidity: 0.5, start: 100 }); const a = fogRay({ params: P, originY: 1.7, ray: [0, 0, -1], dist: 300 }), b = fogRay({ params: fogParams({ density: 0.01, humidity: 0.5 }), originY: 1.7, ray: [0, 0, -1], dist: 300 }); return a.start === 100 && a.length === 200 && a.transmittance > b.transmittance })())
ok('«Luz del sol» 0 quita la luz solar y deja solo el ambiente', (() => { const sun = { dir: [0, 0, -1], color: [1, 1, 1], intensity: 1 }; const a = fogRay({ params: fogParams({ density: 0.01, humidity: 0.5, scatter: 0 }), originY: 1.7, ray: [0, 0, -1], dist: 500, color: [0.5, 0.5, 0.5], sun }), b = fogRay({ params: fogParams({ density: 0.01, humidity: 0.5 }), originY: 1.7, ray: [0, 0, -1], dist: 500, color: [0.5, 0.5, 0.5], sun }); return a.rgb[0] < b.rgb[0] && a.rgb[0] > 0 })())

console.log('Henyey-Greenstein')
{ const g = 0.6, steps = 20000; let acc = 0
  for (let i = 0; i < steps; i++) { const mu = -1 + (2 * (i + 0.5)) / steps; acc += hg(mu, g) * (2 / steps) } // ∫ p dμ
  // con la escala de Frost (×0,22 y tope 3) la integral no es 1: se comprueba la forma, no la normalización
  ok('hacia el sol (μ=1) es mucho más brillante que de espaldas (μ=−1)', hg(1, g) > 10 * hg(-1, g) || hg(1, g) === FOG.HG_MAX, `${hg(1, g).toFixed(2)} vs ${hg(-1, g).toFixed(3)}`)
  ok('tope de brillo 3', hg(1, 0.99) <= FOG.HG_MAX + 1e-12)
  ok('monótona creciente con μ', (() => { let prev = -1; for (let i = 0; i <= 100; i++) { const v = hg(-1 + i / 50, 0.6); if (v < prev - 1e-12) return false; prev = v } return true })())
  ok('isotrópica (g=0): constante', near(hg(-0.7, 0), hg(0.9, 0), 1e-12) && near(hg(0, 0), 0.22, 1e-12))
  void acc }

console.log('Visibilidad (Koschmieder)')
ok('densidad 0,032 (preset niebla) y humedad 0,97 → visibilidad ≈ 95 m', (() => { const v = visibilityOf(0.032, 0.97); return v > 80 && v < 110 })(), visibilityOf(0.032, 0.97).toFixed(1))
ok('V = 3,912 / β', near(visibility(fogParams({ density: 0.01, humidity: 0.5 })), 3.912 / (0.01 * (0.82 + 0.46 * 0.5)), 1e-6))
ok('sin niebla: visibilidad infinita', visibilityOf(0, 0.5) === Infinity)
ok('a más altura hay más visibilidad', visibilityOf(0.01, 0.5, 300) > visibilityOf(0.01, 0.5, 0))
ok('más humedad = menos visibilidad', visibilityOf(0.01, 0.95) < visibilityOf(0.01, 0.1))

console.log('Volúmenes atmosféricos')
{ const box = makeVolume({ position: [10, 2, -5], size: [8, 4, 6], exchange: 0 })
  ok('contiene el centro y las esquinas, no lo de fuera', volumeContains(box, [10, 2, -5]) && volumeContains(box, [13.9, 3.9, -2.1]) && !volumeContains(box, [14.5, 2, -5]))
  ok('salida desde el centro en +X = media anchura', near(volumeExitDistance(box, [10, 2, -5], [1, 0, 0], 100), 4, 1e-9))
  ok('salida en diagonal coincide con marcha por pasos', (() => { const o = [9, 1.5, -4], r = norm([0.6, 0.3, -0.7]); let t = 0; while (t < 100 && volumeContains(box, [o[0] + r[0] * t, o[1] + r[1] * t, o[2] + r[2] * t])) t += 0.0005; return near(volumeExitDistance(box, o, r, 100), t, 0.002) })())
  ok('desde fuera la distancia de salida es 0', volumeExitDistance(box, [50, 0, 0], [-1, 0, 0], 100) === 0)
  ok('se recorta a la distancia de la superficie', volumeExitDistance(box, [10, 2, -5], [1, 0, 0], 1.5) === 1.5)
  const yaw = (a) => [0, Math.sin(a / 2), 0, Math.cos(a / 2)] // giro en Y
  const rot = makeVolume({ position: [0, 0, 0], rotation: yaw(Math.PI / 2), size: [10, 2, 2] }) // 10 m de largo en X local → Z del mundo
  ok('caja girada 90°: el eje largo pasa a ser Z', volumeContains(rot, [0, 0, 4.5]) && !volumeContains(rot, [4.5, 0, 0]) && near(volumeExitDistance(rot, [0, 0, 0], [0, 0, 1], 100), 5, 1e-6) && near(volumeExitDistance(rot, [0, 0, 0], [1, 0, 0], 100), 1, 1e-6))
  const big = makeVolume({ position: [0, 0, 0], size: [40, 10, 40] }), small = makeVolume({ position: [0, 0, 0], size: [4, 4, 4] })
  ok('volúmenes anidados: gana el de menor volumen', resolveVolume([big, small], [0, 0, 0]) === small && resolveVolume([big, small], [10, 0, 0]) === big && resolveVolume([big, small], [100, 0, 0]) === null)
  ok('intercambio 0: la niebla empieza en la salida; 1: en la cámara; 0,5: a medias', (() => { const v0 = makeVolume({ size: [8, 8, 8], exchange: 0 }), v1 = makeVolume({ size: [8, 8, 8], exchange: 1 }), vh = makeVolume({ size: [8, 8, 8], exchange: 0.5 }); const o = [0, 0, 0], r = [1, 0, 0]
    return near(integrationStart(v0, o, r, 500), 4, 1e-9) && integrationStart(v1, o, r, 500) === 0 && near(integrationStart(vh, o, r, 500), 2, 1e-9) && integrationStart(null, o, r, 500) === 0 })())
  ok('exchange fuera de 0–1 se recorta', makeVolume({ exchange: 7 }).exchange === 1 && makeVolume({ exchange: -1 }).exchange === 0) }

console.log('Referencia CPU del shader (fogRay)')
{ const P = fogParams({ density: 0.01, humidity: 0.6 }), sun = { dir: norm([0.3, 0.5, -0.8]), color: [1, 0.95, 0.85], intensity: 1 }, col = [0.62, 0.67, 0.73]
  const at = (d, ray = [0, 0, -1], extra = {}) => fogRay({ params: P, originY: 1.7, ray, dist: d, color: col, sun, ...extra })
  ok('distancia 0 → transmitancia 1 y nada de luz', (() => { const r = at(0); return r.transmittance === 1 && r.rgb.every((c) => c === 0) })())
  ok('la transmitancia decrece con la distancia', at(50).transmittance > at(200).transmittance && at(200).transmittance > at(800).transmittance)
  ok('horizontal a nivel del suelo: T = exp(−β·d)', near(at(300, [1, 0, 0]).transmittance, Math.exp(-P.extinction * heightDensity(1.7, 0, P.falloff) * 300), 1e-6))
  ok('la luz dispersada crece con la distancia hasta saturar', at(50).rgb[1] < at(400).rgb[1] && at(400).rgb[1] <= 1)
  ok('mirando hacia el sol hay más luz dispersada que de espaldas', at(400, sun.dir).rgb[0] > at(400, sun.dir.map((c) => -c)).rgb[0])
  ok('sol apagado (noche): solo queda el ambiente (> 0 y menor que con sol)', (() => { const n = fogRay({ params: P, originY: 1.7, ray: sun.dir, dist: 400, color: col, sun: { ...sun, intensity: 0 } }); return n.rgb[0] > 0 && n.rgb[0] < at(400, sun.dir).rgb[0] })())
  ok('niebla apagada → imagen intacta', (() => { const r = fogRay({ params: fogParams({ density: 0 }), originY: 0, ray: [0, 0, -1], dist: 500, color: col, sun }); return r.transmittance === 1 && r.rgb.every((c) => c === 0) })())
  ok('el cielo (distancia enorme) se recorta a la distancia máxima', near(at(1e7).transmittance, at(2400).transmittance, 1e-12))
  const room = makeVolume({ position: [0, 1.7, 0], size: [6, 4, 6], exchange: 0 }), open = makeVolume({ position: [0, 1.7, 0], size: [6, 4, 6], exchange: 1 })
  ok('dentro de un interior cerrado, a 2 m del muro no hay niebla (T=1)', at(2.5, [0, 0, -1], { volume: room, origin: [0, 1.7, 0] }).transmittance === 1)
  ok('un volumen abierto no cambia nada', near(at(300, [0, 0, -1], { volume: open, origin: [0, 1.7, 0] }).transmittance, at(300).transmittance, 1e-12))
  ok('mirando más allá de la salida, la niebla cuenta solo el tramo exterior', (() => { const r = at(303, [0, 0, -1], { volume: room, origin: [0, 1.7, 0] }); return near(r.length, 300, 1e-9) && r.start === 3 })())
  ok('intercambio parcial deja pasar una parte de la niebla', (() => { const half = makeVolume({ position: [0, 1.7, 0], size: [6, 4, 6], exchange: 0.5 }); const a = at(200, [0, 0, -1], { volume: room, origin: [0, 1.7, 0] }).transmittance, b = at(200, [0, 0, -1], { volume: half, origin: [0, 1.7, 0] }).transmittance, c = at(200).transmittance; return a >= b && b >= c })())
  ok('barrido: resultados siempre finitos y en [0,1] (2000 rayos al azar)', (() => { const rnd = mulberry(11); for (let i = 0; i < 2000; i++) { const r = fogRay({ params: fogParams({ density: rnd() * 0.2, humidity: rnd(), falloff: rnd() < 0.5 ? 0 : rnd() * 0.01 }), originY: -20 + rnd() * 500, ray: norm([rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1]), dist: rnd() * 5000, color: [rnd(), rnd(), rnd()], sun: { dir: norm([rnd() - 0.5, rnd(), rnd() - 0.5]), color: [rnd(), rnd(), rnd()], intensity: rnd() * 3 } }); if (!(r.transmittance >= 0 && r.transmittance <= 1) || r.rgb.some((c) => !(c >= 0 && c <= 1))) return false } return true })()) }

console.log('Haces de sol')
ok('sin sol en el encuadre no hay haces', shaftStrength({ sunInView: false, sunIntensity: 1, humidity: 1, density: 0.05 }) === 0)
ok('sin niebla no hay haces', shaftStrength({ sunInView: true, sunIntensity: 1, humidity: 1, density: 0 }) === 0)
ok('más humedad y más niebla = más haces', shaftStrength({ sunInView: true, sunIntensity: 1, humidity: 0.9, density: 0.01 }) > shaftStrength({ sunInView: true, sunIntensity: 1, humidity: 0.1, density: 0.002 }))
ok('tope: humedad 1 + niebla ≥ referencia = 0,72', near(shaftStrength({ sunInView: true, sunIntensity: 5, humidity: 1, density: 1 }), 0.72, 1e-12))

console.log('Mundo y API: visibilidad')
{ const mk = (env) => { const w = new World(); w.configure({ ...normalizeWorld({}), ...env }); return w }
  const w0 = mk({ time: { on: true, hour: 12 }, weather: { on: true, preset: 'clear' }, fog: false })
  ok('sin niebla la visibilidad es infinita', w0.visibility() === Infinity)
  const ws = mk({ time: { on: true, hour: 12 }, weather: { on: true, preset: 'fog' }, fog: false, fogMode: 'simple' })
  ok('niebla simple: V = 3,912 / densidad (preset «Niebla» 0,032 → 122 m)', near(ws.visibility(), 3.912 / 0.032, 0.5), ws.visibility().toFixed(1))
  const wp = mk({ time: { on: true, hour: 12 }, weather: { on: true, preset: 'fog' }, fog: false, fogMode: 'physical' })
  ok('niebla física: la humedad (0,97) acorta la visibilidad respecto a la simple', wp.visibility() < ws.visibility() && wp.visibility() > 70, wp.visibility().toFixed(1))
  ok('y con la altura crece (200 m de altura → más visibilidad)', wp.visibility(200) > wp.visibility(0) * 1.2, `${wp.visibility(0).toFixed(1)} → ${wp.visibility(200).toFixed(1)}`)
  ok('los ajustes de la escena (caída manual) cambian la visibilidad con la altura', (() => { const a = mk({ time: { on: true, hour: 12 }, weather: { on: true, preset: 'fog' }, fogMode: 'physical', fogFalloff: 0.01 }); return a.visibility(100) > wp.visibility(100) })())
  const api = makeWorldApi(() => wp)
  ok('game.weather.visibility y visibilityAt(y) leen del mundo', near(api.weather.visibility, wp.visibility(0), 1e-9) && near(api.weather.visibilityAt(200), wp.visibility(200), 1e-9))
  ok('sin mundo: infinita (no lanza)', makeWorldApi(() => null).weather.visibility === Infinity)
  const fr = wp.frame()
  ok('el estado del mundo lleva la humedad a la niebla (viewport → pase)', near(fr.fog.humidity, 0.97, 0.02) && fr.fog.on, JSON.stringify(fr.fog)) }

console.log(bad ? `\n${bad} prueba(s) con fallo` : '\nTodo bien')
process.exit(bad ? 1 : 0)
