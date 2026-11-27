// Atmósfera de FrostEngine en LevelForge: director de clima, temperatura, humedad/niebla (punto de rocío), rachas naturales, API y normalización.
// Uso: node scripts/test-atmosphere.mjs   (sin DOM: solo matemática y el mundo)
import { World } from '../src/engine/runtime/world/world.js'
import { Director, Moisture, WindGusts, moistureEquilibrium, satVapor, dewPoint, airTemperature, precipMm, gaussian, DIRECTOR_DEFAULTS } from '../src/engine/runtime/world/atmosphere.js'
import { normalizeWeather } from '../src/engine/runtime/world/params.js'
import { makeWorldApi } from '../src/engine/runtime/world/api.js'
import { PRESETS } from '../src/engine/runtime/world/weather.js'

let bad = 0
const ok = (name, cond, extra = '') => { if (!cond) bad++; console.log((cond ? '  OK  ' : ' FALLA ') + name + (extra !== '' ? `  [${extra}]` : '')) }
const mulberry = (a) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }

console.log('Termodinámica')
ok('presión de saturación a 20 °C ≈ 23,4 hPa', Math.abs(satVapor(20) - 23.4) < 0.3, satVapor(20).toFixed(2))
ok('punto de rocío a 25 °C y 50 % ≈ 13,9 °C', Math.abs(dewPoint(satVapor(25) * 0.5) - 13.9) < 0.3, dewPoint(satVapor(25) * 0.5).toFixed(2))
ok('ciclo diario: máx. a las 15 h, mín. a las 3 h', Math.abs(airTemperature(15, 24, 8) - 28) < 1e-9 && Math.abs(airTemperature(3, 24, 8) - 20) < 1e-9)
ok('precipitación: lluvia a pleno = 45 mm/h, llovizna ≈ 3,5', precipMm(1) === 45 && Math.abs(precipMm(0.28) - 3.53) < 0.01, precipMm(0.28).toFixed(2))

console.log('Humedad y niebla')
const fogCase = (hour) => { const ref = 24, T = airTemperature(hour, ref, 8, -2), s = { humidity: 0.97, temperature: T, coverage: 0.75, density: 0.4, precip: 0 }
  const sun = hour >= 7 && hour <= 18; return moistureEquilibrium(s, ref - 2, { daylight: sun ? 1 : 0, intensity: sun ? 0.8 : 0 }, 1) }
const nightFog = fogCase(4).fogFrac, dayFog = fogCase(15).fogFrac
ok('la niebla de equilibrio es mucho mayor de madrugada que a las 15 h', nightFog > 0.5 && dayFog < 0.1, `4 h: ${nightFog.toFixed(2)} · 15 h: ${dayFog.toFixed(2)}`)
ok('la humedad relativa sube cuando el aire se enfría', fogCase(4).humidity > fogCase(15).humidity, `${fogCase(4).humidity.toFixed(2)} > ${fogCase(15).humidity.toFixed(2)}`)
{ const m = new Moisture(); const sNight = { humidity: 0.97, temperature: 20, coverage: 0.5, density: 0.4, precip: 0 }, night = { daylight: 0, intensity: 0 }
  m.update({ ...sNight, temperature: 30 }, 22, { daylight: 1, intensity: 0.8 }, 1, 0, 0.03) // empieza sin niebla (de día)
  let t = 0; const first = m.update(sNight, 22, night, 1, 60, 0.03).fog; while (t < 600) { m.update(sNight, 22, night, 1, 10, 0.03); t += 10 }
  const after10 = m.update(sNight, 22, night, 1, 0, 0.03).fog; while (t < 2400) { m.update(sNight, 22, night, 1, 10, 0.03); t += 10 }
  const full = m.update(sNight, 22, night, 1, 0, 0.03).fog
  ok('la niebla se forma poco a poco (no de golpe): 1 min < 10 min < 40 min', first < after10 && after10 < full && first < 0.4 * 0.03, `${first.toFixed(4)} · ${after10.toFixed(4)} · ${full.toFixed(4)}`)
  let t2 = 0; const day = { daylight: 1, intensity: 0.9 }, sDay = { ...sNight, temperature: 30 }
  while (t2 < 1800) { m.update(sDay, 22, day, 4, 10, 0.03); t2 += 10 }
  ok('con sol y viento la niebla se disipa', m.update(sDay, 22, day, 4, 0, 0.03).fog < full * 0.2, m.fog.toFixed(5)) }

console.log('Rachas naturales (Ornstein-Uhlenbeck)')
{ const g = new WindGusts(mulberry(5)); const v = []; for (let i = 0; i < 40000; i++) { g.step(0.05, 0.9, 1.8); v.push(g.speed) }
  const mean = v.reduce((a, b) => a + b) / v.length, sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length)
  ok('media ≈ 0 y desviación ≈ σ/√(2θ) = 1,34 m/s', Math.abs(mean) < 0.2 && Math.abs(sd - 1.34) < 0.15, `media ${mean.toFixed(2)} · sd ${sd.toFixed(2)}`)
  let a = 0, b = 0, c = 0; for (let i = 20; i < v.length; i++) { a += v[i] * v[i - 1]; b += v[i] * v[i]; c += v[i] * v[i - 20] }
  ok('tiene memoria: autocorrelación a 0,05 s alta y a 1 s baja', a / b > 0.9 && c / b < 0.7, `${(a / b).toFixed(2)} · ${(c / b).toFixed(2)}`)
  const w = new WindGusts(mulberry(1)).at(5, 90); ok('viento hacia el este (sin racha): x = 5 y z ≈ 0', Math.abs(w.x - 5) < 1e-9 && Math.abs(w.z) < 1e-9, `${w.x.toFixed(2)}, ${w.z.toFixed(2)}`)
  const wn = g.at(5, 0); ok('hacia el norte (−Z): z < 0', wn.z < 0, wn.z.toFixed(2))
  const gg = gaussian(mulberry(9)); const xs = Array.from({ length: 20000 }, gg); const m = xs.reduce((p, q) => p + q) / xs.length
  ok('gaussiana: media 0 y varianza 1', Math.abs(m) < 0.03 && Math.abs(xs.reduce((p, q) => p + (q - m) ** 2, 0) / xs.length - 1) < 0.05) }

console.log('Director de clima')
{ const cfg = normalizeWeather({ director: true }); const run = (seed, n = 4000) => { const d = new Director(cfg, mulberry(seed)); d.settle('clear'); const ids = []; for (let i = 0; i < n; i++) { const c = d.update(10); if (c) ids.push(c.id) } return ids }
  const a = run(3), b = run(3), c = run(4)
  ok('misma semilla → misma secuencia; otra semilla → otra', JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) !== JSON.stringify(c), `${a.length} cambios`)
  ok('nunca repite el tiempo actual dos veces seguidas', a.every((x, i) => i === 0 || x !== a[i - 1]))
  const big = run(11, 400000), cnt = {}; for (const x of big) cnt[x] = (cnt[x] || 0) + 1
  ok('los pesos mandan: «clear» sale más que «storm»', (cnt.clear || 0) > (cnt.storm || 0) * 2, JSON.stringify(cnt))
  const d = new Director(cfg, mulberry(2)); d.settle('clear'); let first = null, t = 0; while (!first && t < 3600 * 3) { first = d.update(5); t += 5 }
  ok('espera lo que dura el tiempo actual (clear: 20–60 min) antes de cambiar', t >= 20 * 60 - 5 && t <= 60 * 60 + 5, `${(t / 60).toFixed(1)} min`)
  ok('la transición gradual dura 2–8 min', first.simSeconds >= 120 && first.simSeconds <= 480 || first.abrupt, `${(first.simSeconds / 60).toFixed(1)} min`)
  const onlyOne = new Director(normalizeWeather({ director: true, profiles: [{ preset: 'rain', weight: 1, minMinutes: 1, maxMinutes: 1 }] }), mulberry(1)); onlyOne.settle('rain')
  ok('con un único tiempo posible no se cambia (y no se cuelga)', Array.from({ length: 200 }, () => onlyOne.update(10)).every((x) => x === null)) }

console.log('El mundo')
{ const mk = (weather, time = { on: true, hour: 12, latitude: 19 }) => { const w = new World(); w.configure({ time, weather: { on: true, cloudModel: 'classic', ...weather } }); return w }
  const w = mk({ director: true, directorSeed: 7, weatherScale: 120, transMin: 0.5, transMax: 1, abruptChance: 0 }), seq = []; let last = w.preset
  for (let i = 0; i < 6000; i++) { w.update(0.1); if (w.preset !== last) { last = w.preset; seq.push(last) } }
  const w2 = mk({ director: true, directorSeed: 7, weatherScale: 120, transMin: 0.5, transMax: 1, abruptChance: 0 }), seq2 = []; last = w2.preset
  for (let i = 0; i < 6000; i++) { w2.update(0.1); if (w2.preset !== last) { last = w2.preset; seq2.push(last) } }
  ok('el director cambia el tiempo del mundo y es reproducible con semilla', seq.length >= 5 && JSON.stringify(seq) === JSON.stringify(seq2), seq.slice(0, 6).join('→'))
  const off = mk({ director: false }); for (let i = 0; i < 6000; i++) off.update(1)
  ok('sin director el tiempo no cambia', off.preset === 'clear')
  const sc = mk({ director: false }); sc.setAuto(true); sc.update(0.1); ok('game.weather.auto(true) lo activa desde un script', sc.directorOn)
  const nx = mk({ preset: 'clear' }); const id = nx.nextWeather(0); ok('game.weather.next() cambia ya de tiempo', !!id && id !== 'clear' && nx.preset === id, id)
  // temperatura y precipitación en el frame
  const rainy = mk({ preset: 'rain', baseTemp: 24, tempRange: 8 }, { on: true, hour: 15, latitude: 19 }); const f = rainy.frame()
  ok('temperatura a las 15 h con lluvia = base − 3 °C + 4 °C', Math.abs(f.temperature - (24 - 3 + 4)) < 1e-6, f.temperature.toFixed(2))
  ok('precipitación de la lluvia en mm/h (0,7² × 45 = 22)', Math.abs(f.precipMm - 22.05) < 0.1, f.precipMm.toFixed(2))
  const snow = mk({ preset: 'snow' }, { on: true, hour: 3, latitude: 19 }); ok('nieve de madrugada: bajo cero', snow.frame().temperature < -5, snow.frame().temperature.toFixed(1))
  // niebla realista: de madrugada hay, a las 15 h casi no
  const fogAt = (hour) => { const x = mk({ preset: 'fog', moisture: true, windSpeed: 1 }, { on: true, hour, latitude: 19, flow: false }); x.update(1); x.frame(); x.update(3 * 3600, { clock: false }); return x.frame().fog?.density ?? 0 }
  const f4 = fogAt(4), f15 = fogAt(15)
  ok('«Humedad y niebla realistas»: densidad de madrugada ≫ a las 15 h', f4 > 0.01 && f15 < f4 * 0.25, `4 h: ${f4.toFixed(4)} · 15 h: ${f15.toFixed(4)}`)
  const plain = mk({ preset: 'fog' }, { on: true, hour: 15, latitude: 19 }); plain.update(1)
  ok('sin ese ajuste la niebla del tiempo sigue siendo la de siempre', Math.abs((plain.frame().fog?.density ?? 0) - PRESETS.fog.fog) < 1e-9)
  // rachas naturales en el mundo
  const nat = mk({ gustModel: 'natural', windSpeed: 6, windDir: 90, gusts: 0.35 }), sp = []; for (let i = 0; i < 2000; i++) { nat.update(0.05); sp.push(nat.frame().wind.speed) }
  ok('viento natural: oscila alrededor de 6 m/s sin salirse de rango', Math.min(...sp) >= 0 && Math.max(...sp) < 16 && Math.abs(sp.reduce((a, b) => a + b) / sp.length - 6) < 1.5, `${Math.min(...sp).toFixed(1)}–${Math.max(...sp).toFixed(1)}`)
  const api = makeWorldApi(() => rainy)
  ok('API: temperature, humidity, precipitation, autoChange', Math.abs(api.weather.temperature - f.temperature) < 1e-9 && api.weather.humidity > 0.5 && api.weather.precipitation > 20 && api.weather.autoChange === false)
  ok('proyectos antiguos (sin los ajustes nuevos): todo apagado y 8 tiempos por defecto', (() => { const n = normalizeWeather({ on: true, preset: 'rain' }); return !n.director && !n.moisture && n.gustModel === 'sines' && n.profiles.length === DIRECTOR_DEFAULTS.length })()) }

console.log(bad ? `\n${bad} FALLO(S)` : '\nRESULTADO: OK'); process.exit(bad ? 1 : 0)
