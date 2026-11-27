// Rayos físicos (Bloque C1): canal por ruptura dieléctrica, forma de onda de Heidler, cadencia de Poisson y el mundo.
// Uso: node scripts/test-lightning.mjs   (sin DOM)
import { createStrike, FlashModel, LIGHTNING_DEFAULTS } from '../src/engine/runtime/world/lightning.js'
import { World } from '../src/engine/runtime/world/world.js'
import { makeWorldApi } from '../src/engine/runtime/world/api.js'

let bad = 0
const ok = (name, cond, extra = '') => { if (!cond) bad++; console.log((cond ? '  OK  ' : ' FALLA ') + name + (extra !== '' ? `  [${extra}]` : '')) }
const mulberry = (a) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const O = { cloud: [0, 900, 0], cloudRadius: 500, thickness: 600, development: 0.6, groundAt: () => 0 }

console.log('Canal')
const s = createStrike({}, mulberry(11), O), n = s.points.length
ok('el canal tiene decenas de puntos', n > 20 && n < 400, n)
ok('el punto 0 es la nube', s.parents[0] < 0 || s.parents[0] === undefined || s.parents[0] === -1)
{ let tree = true; for (let i = 1; i < n; i++) if (!(s.parents[i] >= 0 && s.parents[i] < i)) tree = false; ok('todos los puntos cuelgan de uno anterior (árbol conectado)', tree) }
const lo = Math.min(...s.points.map((p) => p[1] ?? 1e9)), pts = s.points
ok('el canal llega al suelo', (Array.isArray(pts[0]) ? Math.min(...pts.map((p) => p[1])) : lo) <= 30, Array.isArray(pts[0]) ? Math.min(...pts.map((p) => p[1])).toFixed(1) : '?')
const s2 = createStrike({}, mulberry(11), O), s3 = createStrike({}, mulberry(12), O)
ok('misma semilla → mismo rayo', JSON.stringify(s.points) === JSON.stringify(s2.points))
ok('otra semilla → otro rayo', JSON.stringify(s.points) !== JSON.stringify(s3.points))
{ const kids = new Map(); for (let i = 1; i < n; i++) kids.set(s.parents[i], (kids.get(s.parents[i]) || 0) + 1); ok('hay ramificaciones', [...kids.values()].some((k) => k > 1)) }

console.log('Forma de onda')
{ const f = new FlashModel({ peakKA: 30 }); ok('inactivo no da luz', f.update(0.1) === 0)
  f.start(30); const v = []; for (let i = 0; i < 60; i++) v.push(f.update(0.01))
  ok('arranca al máximo', v[0] > 0.9, v[0].toFixed(2))
  const rise = []; for (let i = 1; i < v.length; i++) if (v[i] > v[i - 1] + 1e-3) rise.push(i)
  ok('parpadea: se reaviva con los golpes sucesivos (+75 y +155 ms)', rise.some((i) => i >= 6 && i <= 9) && rise.some((i) => i >= 14 && i <= 17), rise.join(','))
  for (let i = 0; i < 60; i++) f.update(0.01); ok('termina solo', !f.active && f.value === 0)
  ok('pico de Heidler normalizado = kA', Math.abs(f.heidler(f.peakTime(), 30) - 30) < 1e-6) }

console.log('Mundo')
const mk = (weather, seed = 3) => { const w = new World(); w.configure({ time: { on: true, hour: 21, latitude: 19 }, weather: { on: true, preset: 'storm', lightning: true, lightningModel: 'physical', ...weather } }); w.rng = mulberry(seed); return w }
{ const w = mk({ maxStrikes: 0 }), ev = []; w.on("lightning", (e) => ev.push(e))
  const r = w.strike(900, 90); w.update(0.016); const f = w.frame()
  ok('strike(900, 90) devuelve distancia y retardo', r.distance === 900 && Math.abs(r.delay - 900 / 343) < 1e-9)
  ok('emite el evento con rumbo', ev.length === 1 && ev[0].bearing === 90 && ev[0].distance === 900)
  ok('el frame trae el rayo y su alfa', f.strike && f.strike.bearing === 90 && f.boltAlpha > 0.5, f.boltAlpha)
  ok('el destello del mundo sigue la corriente', f.flash > 0.3, f.flash.toFixed(2))
  for (let i = 0; i < 60; i++) w.update(0.02); ok('después de ~1 s ya no hay destello', w.frame().boltAlpha === 0 && w.frame().flash < 0.01) }
{ const w = mk({ maxStrikes: 0 }); w.strike(500); const a = w.frame().strike.id; for (let i = 0; i < 60; i++) w.update(0.02); w.strike(500); ok('cada rayo tiene un id nuevo', w.frame().strike.id === a + 1) }
{ const w = mk({ maxStrikes: 0 }); for (let i = 0; i < 6000; i++) w.update(0.05); ok('maxStrikes = 0 → ningún rayo espontáneo', w.frame().strike == null || w.frame().strike.id === 0 || !w._strike) }
{ // cadencia: tasa = maxStrikes × potencial(bolts/7) por minuto REAL
  const w = mk({ maxStrikes: 6 }, 99); let c = 0; w.on("lightning", () => c++); const sec = 3600
  for (let i = 0; i < sec * 20; i++) w.update(0.05)
  const exp = 6 * Math.min(1, w.cur.bolts / 7) * (sec / 60)
  ok('cadencia de Poisson ≈ maxStrikes × potencial (1 h simulada)', c > exp * 0.6 && c < exp * 1.4 && exp > 0, `${c} vs ${exp.toFixed(0)}`) }
{ const w = mk({ maxStrikes: 0, preset: 'clear' }); w.on("lightning", () => {}); let c = 0; w.on("lightning", () => c++); w.configure({ time: { on: true, hour: 21, latitude: 19 }, weather: { on: true, preset: 'clear', lightning: true, lightningModel: 'physical', maxStrikes: 60 } }); for (let i = 0; i < 20000; i++) w.update(0.05); ok('cielo despejado: sin rayos espontáneos', c === 0, c) }
{ const w = mk({ lightningModel: 'simple', maxStrikes: 0 }); w.strike(800, 45); ok('modo simple sigue funcionando (sin canal)', w.frame().flash > 0.5 && !w.frame().strike?.id) }

console.log('API de scripts')
{ const w = mk({ maxStrikes: 0 }); const api = makeWorldApi(() => w); const ev = []; w.on("lightning", (e) => ev.push(e))
  const r = api.weather.strike({ distance: 1200, bearing: 270 }); ok('game.weather.strike({distance, bearing})', r && r.distance === 1200 && ev[0].bearing === 270)
  const r2 = api.weather.strike(600); ok('game.weather.strike(600) (número) sigue valiendo', r2.distance === 600) }

console.log(bad ? `\n${bad} FALLO(S)` : '\nTODO OK'); process.exit(bad ? 1 : 0)
