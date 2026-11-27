// Trueno procedural (Bloque C2): canal acústico, retardo, espectro, estéreo, regiones, oclusión, integración con el mundo, WeatherAudio y API.
// Uso: node scripts/test-thunder.mjs   (sin DOM ni WebAudio real: el contexto de audio es un doble de prueba)
import { synthThunder, thunderChannel, mulberry32, pickRegion, occlusionFilter, probeOcclusion, ACOUSTIC_PRESETS, ACOUSTIC_LIST, SPEED_OF_SOUND } from '../src/engine/runtime/world/thunder.js'
import { WeatherAudio } from '../src/engine/runtime/world/sound.js'
import { World } from '../src/engine/runtime/world/world.js'
import { makeWorldApi } from '../src/engine/runtime/world/api.js'
import { normalizeWeather, WEATHER_DEFAULTS } from '../src/engine/runtime/world/params.js'

let bad = 0
const ok = (name, cond, extra = '') => { if (!cond) bad++; console.log((cond ? '  OK  ' : ' FALLA ') + name + (extra !== '' ? `  [${extra}]` : '')) }
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i])

function fft(re, im) { const n = re.length; for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]];[im[i], im[j]] = [im[j], im[i]] } }
  for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len; for (let i = 0; i < n; i += len) for (let k = 0; k < len / 2; k++) { const c = Math.cos(a * k), s = Math.sin(a * k), h = i + k + len / 2, ur = re[i + k], ui = im[i + k], vr = re[h] * c - im[h] * s, vi = re[h] * s + im[h] * c; re[i + k] = ur + vr; im[i + k] = ui + vi; re[h] = ur - vr; im[h] = ui - vi } } }
function bands(x, sr) { let n = 1; while (n < x.length) n <<= 1; const re = new Float64Array(n), im = new Float64Array(n); re.set(x); fft(re, im)
  const e = (a, b) => { let s = 0; for (let k = Math.floor(a * n / sr); k < Math.floor(b * n / sr); k++) s += re[k] ** 2 + im[k] ** 2; return s }; const tot = e(0, sr / 2) || 1
  return { lo: e(20, 200) / tot, mid: e(200, 1000) / tot, hi: e(1000, sr / 2) / tot } }
const rmsOf = (x, a = 0, b = x.length) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, b - a)) }
const pkOf = (x) => { let p = 0; for (const v of x) p = Math.max(p, Math.abs(v)); return p }

console.log('Canal acústico')
{ const segs = thunderChannel(mulberry32(5), { distance: 1200, bearing: 0, cloudBase: 1100, thickness: 1200 })
  ok('hay cientos de segmentos', segs.length > 200 && segs.length < 6000, segs.length)
  ok('todos finitos y con longitud y peso positivos', segs.every((s) => s.every(Number.isFinite) && s[3] > 0 && s[7] > 0))
  const low = Math.min(...segs.map((s) => s[1] + 1.7)); ok('el canal baja hasta el suelo', low < 15, low.toFixed(1))
  const top = Math.max(...segs.map((s) => s[1] + 1.7)); ok('y sube hasta la nube', top > 1000, top.toFixed(0))
  const horiz = segs.filter((s) => Math.abs(s[5]) < 0.35).length; ok('hay tramos casi horizontales (ramas y nube)', horiz > 20, horiz)
  const near = segs.filter((s) => Math.hypot(s[0], s[2]) < 1250 && s[1] < 60); ok('la base queda a la distancia pedida (bearing 0 = norte = −Z)', near.length > 0 && near.every((s) => s[2] < 0), near.length)
  const east = thunderChannel(mulberry32(5), { distance: 1200, bearing: 90 }); ok('bearing 90 = este (+X)', east[0][0] > 900 && Math.abs(east[0][2]) < 300, east[0][0].toFixed(0)) }

console.log('Síntesis')
const T = (o = {}) => synthThunder({ distance: 1500, bearing: 90, seed: 7, ...o })
{ const t0 = performance.now(), r = T(); const ms = performance.now() - t0
  ok('estéreo, finito y sin NaN', r.left.length === r.right.length && r.left.length > 1000 && [...r.left, ...r.right].every(Number.isFinite))
  ok('no pasa de 1 (limitador suave)', pkOf(r.left) <= 1 && pkOf(r.right) <= 1, Math.max(pkOf(r.left), pkOf(r.right)).toFixed(3))
  const act = Math.round((r.preroll + r.stats.spread + 0.4) * r.sampleRate), ms2 = Math.sqrt((rmsOf(r.left, 0, act) ** 2 + rmsOf(r.right, 0, act) ** 2) / 2)
  ok('suena fuerte: rms ≈ 0,2 antes de la cola', ms2 > 0.08 && ms2 < 0.35, ms2.toFixed(3))
  ok('dura lo que el canal estira el sonido: ≥ (r_máx − r_mín)/343', r.duration >= Math.min(15, r.stats.spread) && r.duration <= 22, `${r.duration.toFixed(1)} s, estira ${r.stats.spread.toFixed(1)} s`)
  ok('cada síntesis tarda < 1,5 s (y se hace una por trueno)', ms < 1500, ms.toFixed(0) + ' ms')
  const a = T(), b = T({ seed: 8 }); ok('misma semilla → mismo trueno', same(r.left, a.left) && same(r.right, a.right))
  ok('otra semilla → otro trueno', !same(r.left, b.left)) }

console.log('Retardo de llegada')
{ for (const D of [150, 900, 4000]) {
    const r = synthThunder({ distance: D, bearing: 45, seed: 3 }), n0 = Math.round(r.preroll * r.sampleRate)
    ok(`D=${D}: lo más cercano del canal está a ≈ D (el instante 0 es distancia/343 tras el relámpago)`, Math.abs(r.stats.rMin - D) / D < 0.12, `r_mín ${r.stats.rMin.toFixed(0)} m, retardo ${(D / SPEED_OF_SOUND).toFixed(2)} s`)
    let first = -1; const thr = pkOf(r.right) * 0.02; for (let i = 0; i < r.right.length; i++) if (Math.abs(r.right[i]) > thr || Math.abs(r.left[i]) > thr) { first = i; break }
    ok(`D=${D}: silencio antes del preroll y primer sonido enseguida`, first >= n0 * 0.5 && first < n0 + 0.6 * r.sampleRate, `${(first / r.sampleRate).toFixed(3)} s`) }
  const w = new World(); w.configure({ time: { on: true, hour: 21 }, weather: { on: true, preset: 'storm', lightning: true, maxStrikes: 0 } }); const ev = []; w.on('lightning', (e) => ev.push(e))
  const r = w.strike(900, 90); ok('el evento trae el retardo distancia/343', Math.abs(r.delay - 900 / SPEED_OF_SOUND) < 1e-9 && Math.abs(ev[0].delay - 900 / SPEED_OF_SOUND) < 1e-9) }

console.log('Espectro: cerca crujido, lejos solo grave')
{ const B = [100, 500, 1500, 4000, 9000].map((D) => bands(synthThunder({ distance: D, bearing: 0, seed: 11 }).right, 22050))
  ok('los agudos (>1 kHz) caen con la distancia', B[0].hi > B[1].hi && B[1].hi >= B[2].hi && B[0].hi > 0.03 && B[3].hi < 0.002, B.map((b) => b.hi.toFixed(3)).join(' '))
  ok('el grave (<200 Hz) sube con la distancia', B[0].lo < B[2].lo && B[2].lo < B[4].lo && B[4].lo > 0.7, B.map((b) => b.lo.toFixed(2)).join(' '))
  const near = synthThunder({ distance: 120, seed: 4 }), far = synthThunder({ distance: 6000, seed: 4 })
  ok('el rayo lejano suena más flojo (nivel por distancia)', near.level > far.level && far.level >= 0.25 && near.level <= 1, `${near.level.toFixed(2)} → ${far.level.toFixed(2)}`)
  const k = synthThunder({ distance: 800, seed: 4, peakKA: 120 }), d = synthThunder({ distance: 800, seed: 4, peakKA: 8 }); ok('más kA → algo más fuerte', k.level > d.level, `${d.level.toFixed(2)} → ${k.level.toFixed(2)}`) }

console.log('Estéreo')
{ const lr = (yaw) => { const r = synthThunder({ distance: 1500, bearing: 90, seed: 13, yaw }); const n = Math.round((r.preroll + 1) * r.sampleRate); return rmsOf(r.right, 0, n) / rmsOf(r.left, 0, n) }
  const n = lr(0), e = lr(Math.PI / 2), wst = lr(Math.PI), back = lr(-Math.PI / 2)
  ok('rayo al este y oyente mirando al norte: suena más por la derecha', n > 1.15, n.toFixed(2))
  ok('mirando al este (el rayo de frente): equilibrado', e > 0.8 && e < 1.25, e.toFixed(2))
  ok('mirando al sur (el rayo del este queda a la izquierda): más por la izquierda', wst < 0.87, wst.toFixed(2))
  ok('mirando al oeste (el rayo a la espalda): equilibrado', back > 0.8 && back < 1.25, back.toFixed(2))
  ok('nunca hay un oído mudo (el trueno es difuso)', n < 4, n.toFixed(2)) }

console.log('Regiones acústicas')
{ const regs = [{ preset: 'valley', cx: 100, cy: 0, cz: 0, sx: 40, sy: 40, sz: 40 }, { preset: 'forest', cx: 110, cy: 0, cz: 0, sx: 40, sy: 40, sz: 40 }]
  ok('dentro de una caja → su preset', pickRegion(regs, [90, 1, 5], 'open').id === 'valley')
  ok('en el solape gana la primera de la lista', pickRegion(regs, [115, 0, 0], 'open').id === 'valley' && pickRegion(regs, [125, 0, 0], 'open').id === 'forest')
  ok('fuera de todas → la de por defecto', pickRegion(regs, [0, 0, 0], 'city').id === 'city' && pickRegion([], [0, 0, 0]).id === 'open')
  ok('preset desconocido → campo abierto', pickRegion([{ preset: 'xx', cx: 0, cy: 0, cz: 0, sx: 9, sy: 9, sz: 9 }], [0, 0, 0]).preset === ACOUSTIC_PRESETS.open)
  ok('lista de presets coherente', ACOUSTIC_LIST.length === Object.keys(ACOUSTIC_PRESETS).length && ACOUSTIC_LIST.every(([id]) => ACOUSTIC_PRESETS[id]))
  const R = (id, extra = {}) => synthThunder({ distance: 700, bearing: 0, seed: 21, region: ACOUSTIC_PRESETS[id], ...extra })
  const op = R('open'), va = R('valley'), fo = R('forest'), ci = R('city')
  ok('el valle alarga la cola (ecos y reverberación larga)', va.duration > op.duration + 1.5, `${op.duration.toFixed(1)} → ${va.duration.toFixed(1)} s`)
  const tailE = (r) => { const a = Math.round((r.preroll + r.stats.spread + 0.5) * r.sampleRate); return rmsOf(r.left, a, r.left.length - 1) / rmsOf(r.left, 0, a) }
  ok('en el valle queda más energía tras terminar el canal que al aire libre', tailE(va) > tailE(op) * 1.3, `${tailE(op).toFixed(3)} → ${tailE(va).toFixed(3)}`)
  const hiOf = (id) => bands(synthThunder({ distance: 150, bearing: 0, seed: 21, region: ACOUSTIC_PRESETS[id] }).left, 22050).hi
  ok('el bosque come los agudos (>1 kHz) de un rayo cercano', hiOf('forest') < hiOf('open') * 0.8 && hiOf('open') > 0.03, `${hiOf('forest').toFixed(3)} vs ${hiOf('open').toFixed(3)}`)
  ok('la ciudad mete ecos cortos (más larga que el campo)', ci.duration > op.duration + 0.4, ci.duration.toFixed(1))
  for (const id of Object.keys(ACOUSTIC_PRESETS)) { const r = R(id); ok(`preset ${id}: finito y ≤ 1`, [...r.left, ...r.right].every(Number.isFinite) && pkOf(r.left) <= 1) } }

console.log('Oclusión')
{ const f0 = occlusionFilter(0), f1 = occlusionFilter(1), fh = occlusionFilter(0.5)
  ok('sin oclusión: paso bajo abierto y volumen pleno', f0.cutoff === 20000 && f0.gain === 1)
  ok('tapado: ≈450 Hz y −55 % de volumen', Math.abs(f1.cutoff - 450) < 1 && Math.abs(f1.gain - 0.45) < 1e-9)
  ok('monótono (más oclusión = menos agudos y menos volumen)', f0.cutoff > fh.cutoff && fh.cutoff > f1.cutoff && f0.gain > fh.gain && fh.gain > f1.gain)
  ok('valores fuera de rango o raros se acotan', occlusionFilter(-3).cutoff === 20000 && occlusionFilter(9).cutoff === f1.cutoff && occlusionFilter(NaN).cutoff === 20000)
  ok('rayos: cielo abierto → 0', probeOcclusion(() => false) === 0)
  ok('rayos: todo tapado → 0,92 (nunca se calla del todo)', probeOcclusion(() => true, 90) === 0.92)
  const roof = probeOcclusion((d) => d[1] > 0.99); ok('solo el techo → ≈ 0,27', Math.abs(roof - 3 / 11) < 1e-9, roof.toFixed(3))
  const wall = probeOcclusion((d) => d[1] < 0.1, 90); ok('solo la pared hacia el rayo → ≈ 0,15', Math.abs(wall - 2 / 13) < 1e-9, wall.toFixed(3))
  const nb = []; probeOcclusion((d) => { nb.push(d); return false }, 0); ok('se tiran 10 rayos (arriba, 8 a 50° y uno hacia el rayo), todos unitarios', nb.length === 10 && nb.every((d) => Math.abs(Math.hypot(...d) - 1) < 0.02), nb.length) }

console.log('Parámetros y proyectos antiguos')
{ const d = normalizeWeather({}); ok('por defecto: clips, campo abierto, sin regiones, oclusión activa (los proyectos no cambian)', d.thunderSound === 'clips' && d.thunderRegion === 'open' && d.thunderRegions.length === 0 && d.soundOcclusion === true && WEATHER_DEFAULTS.thunderSound === 'clips')
  const n = normalizeWeather({ thunderSound: 'raro', thunderRegion: 'luna', soundOcclusion: false, thunderRegions: [{ preset: 'valley', cx: 1e9, sx: -4 }, null, { preset: 'zzz' }, ...Array.from({ length: 30 }, () => ({ preset: 'city' }))] })
  ok('valores inválidos → por defecto', n.thunderSound === 'clips' && n.thunderRegion === 'open' && n.soundOcclusion === false)
  ok('regiones acotadas (centro ±100 000, tamaño ≥ 1, máx. 16, preset válido)', n.thunderRegions.length === 16 && n.thunderRegions[0].cx === 100000 && n.thunderRegions[0].sx === 1 && n.thunderRegions[1].preset === 'open')
  ok('«procedural» se conserva', normalizeWeather({ thunderSound: 'procedural' }).thunderSound === 'procedural') }

console.log('Evento del mundo')
const mk = (weather = {}) => { const w = new World(); w.configure({ time: { on: true, hour: 21 }, weather: { on: true, preset: 'storm', lightning: true, lightningModel: 'physical', maxStrikes: 0, ...weather } }); return w }
{ const w = mk(), ev = []; w.on('lightning', (e) => ev.push(e)); w.strike(900, 90)
  const e = ev[0]; ok('el evento trae semilla, kA, altitud y espesor de la nube', Number.isInteger(e.seed) && e.peak > 5 && e.altitude > 300 && e.thickness > 100, JSON.stringify({ s: e.seed, p: +e.peak.toFixed(1), a: e.altitude }))
  ok('la semilla del evento es la del rayo visible (mismo rayo)', e.seed === w.frame().strike.seed)
  ok('sigue trayendo distancia, retardo y rumbo', e.distance === 900 && e.bearing === 90 && Math.abs(e.delay - 900 / 343) < 1e-9)
  const s = mk({ lightningModel: 'simple' }), ev2 = []; s.on('lightning', (x) => ev2.push(x)); s.strike(500, 10); s.update(1); s.strike(500, 10)
  ok('modo sencillo: semilla propia y distinta por rayo', Number.isInteger(ev2[0].seed) && ev2[0].seed !== ev2[1].seed)
  const a = mk({ lightningModel: 'simple' }), b = mk({ lightningModel: 'simple' }), ea = [], eb = []; a.on('lightning', (x) => ea.push(x)); b.on('lightning', (x) => eb.push(x)); a.strike(700, 20); b.strike(700, 20)
  ok('y reproducible entre dos mundos iguales', ea[0].seed === eb[0].seed)
  const m = mk({ lightningModel: 'simple' }), m2 = mk({ lightningModel: 'simple' }); m.reseed(42); m2.reseed(42); m.strike(600, 5); m2.strike(600, 5)
  const sb = mk({ lightningModel: 'simple' }), eb2 = []; sb.on('lightning', (x) => eb2.push(x)); sb.strike(500, 123); ok('modo sencillo: strike(distancia, rumbo) respeta el rumbo', eb2[0].bearing === 123)
  ok('pedir un rayo no consume el azar del clima (el director sigue igual)', m.rng() === m2.rng() && m.drng() === m2.drng()) }

console.log('WeatherAudio con un contexto de prueba')
const fakeCtx = () => {
  const node = (extra = {}) => ({ connect(n) { this.to = n }, disconnect() { this.to = null }, ...extra })
  const param = (v = 0) => ({ value: v, targets: [], setTargetAtTime(x) { this.value = x; this.targets.push(x) } })
  return { currentTime: 0, sampleRate: 22050,
    createBuffer: (ch, len, sr) => ({ ch, len, sr, data: Array.from({ length: ch }, () => new Float32Array(len)), copyToChannel(a, c) { this.data[c].set(a) } }),
    createBiquadFilter: () => node({ type: '', Q: param(), frequency: param(20000) }), createGain: () => node({ gain: param(1) }) }
}
const mkAudio = (cfg = {}, o = {}) => {
  const ctx = fakeCtx(), plays = [], world = mk({ thunderSound: 'procedural', ...cfg }), sfx = { n: 'sfx' }
  const engine = { ctx, groupInput: () => sfx, async playBuffer(buf, opts) { const v = { stopped: false, stop() { this.stopped = true; this.end() }, end: null, done: null }; v.done = new Promise((r) => { v.end = r }); plays.push({ buf, opts, v }); return v }, async play() { plays.push({ clip: true }); return null } }
  const audio = { engine, resolveClip: () => null }
  const cam = { matrixWorld: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, o.x ?? 0, o.y ?? 1.7, o.z ?? 0, 1] } }
  let probes = 0
  const ws = new WeatherAudio({ world, audio, camera: () => cam, probe: o.probe === undefined ? (() => { probes++; return 0 }) : o.probe })
  return { ws, plays, ctx, sfx, world, cam, get probes() { return probes } }
}
const tick = () => new Promise((r) => setTimeout(r, 0))
{ const A = mkAudio(); const e = { distance: 1200, bearing: 90, delay: 3.5, seed: 99, peak: 30, altitude: 1100, thickness: 1200 }
  const info = A.ws.thunder(e); await tick()
  ok('procedural: reproduce UN buffer estéreo, sin usar clips', A.plays.length === 1 && !A.plays[0].clip && A.plays[0].buf.ch === 2 && A.plays[0].buf.sr === 22050)
  ok('empieza tras el preroll (offset) y pasa por el filtro propio', Math.abs(A.plays[0].opts.offset - 0.02) < 1e-9 && A.plays[0].opts.dest?.type === 'lowpass')
  ok('el buffer lleva la síntesis (no está vacío)', pkOf(A.plays[0].buf.data[0]) > 0.05 && pkOf(A.plays[0].buf.data[1]) > 0.05)
  ok('volumen = thunderVolume × nivel por distancia', Math.abs(A.plays[0].opts.volume - A.ws.lastThunder.level * A.ws.cfg.thunderVolume) < 1e-9, A.plays[0].opts.volume.toFixed(2))
  ok('devuelve { region, occlusion, loudness } para el evento', info && info.region === 'open' && info.occlusion === 0 && info.loudness > 0 && info.loudness <= 1, JSON.stringify(info))
  ok('el registro anota región y distancia', A.ws.log.at(-1).kind === 'thunder' && A.ws.log.at(-1).region === 'open' && A.ws.log.at(-1).distance === 1200)
  ok('queda un trueno activo con su filtro', A.ws.active.length === 1)
  A.plays[0].v.end(); await tick(); ok('al terminar suelta el filtro y deja de estar activo', A.ws.active.length === 0) }
{ const A = mkAudio({ thunderSound: 'clips' }); const r = A.ws.thunder({ distance: 900, bearing: 0, delay: 2 }); await tick(); ok('modo «clips»: no sintetiza nada (sin clips configurados no suena, como antes)', r === null && A.plays.length === 0) }
{ const A = mkAudio(); A.ws.mute(true); const r = A.ws.thunder({ distance: 900, bearing: 0, seed: 1 }); await tick(); ok('silenciado (game.weather.muteSounds): no suena', r === null && A.plays.length === 0) }
{ const A = mkAudio({ thunderRegion: 'valley' }); const info = A.ws.thunder({ distance: 1500, bearing: 0, seed: 5 }); await tick()
  ok('usa la acústica por defecto de la escena', info.region === 'valley' && A.ws.lastThunder.region === 'valley')
  const B = mkAudio({ thunderRegion: 'open', thunderRegions: [{ preset: 'city', cx: 500, cy: 0, cz: 0, sx: 100, sy: 100, sz: 100 }] }, { x: 520 })
  ok('y la región cuya caja contiene al oyente (cámara en x=520)', B.ws.thunder({ distance: 900, bearing: 0, seed: 5 }).region === 'city' && B.ws.region.index === 0) }
{ const A = mkAudio({}, { probe: () => 0.6 }); A.ws.thunder({ distance: 1500, bearing: 0, seed: 5 }); await tick()
  for (let i = 0; i < 40; i++) A.ws.update(0.1)
  const lp = A.ws.active[0].lp
  ok('la oclusión por rayos baja el paso bajo y el volumen del trueno que suena', Math.abs(A.ws.occlusion - 0.6) < 0.01 && lp.frequency.value < 3000 && A.ws.active[0].gain.gain.value < 0.75, `occ ${A.ws.occlusion.toFixed(2)}, ${lp.frequency.value.toFixed(0)} Hz`)
  A.ws.setOcclusion(0); for (let i = 0; i < 40; i++) A.ws.update(0.1)
  ok('setOcclusion(0) lo abre otra vez (el script manda sobre los rayos)', A.ws.occlusion < 0.01 && A.ws.active[0].lp.frequency.value > 19000)
  A.ws.setOcclusion(null); for (let i = 0; i < 40; i++) A.ws.update(0.1); ok('setOcclusion(null) vuelve a la automática', Math.abs(A.ws.occlusion - 0.6) < 0.01)
  A.ws.setOcclusion(7); for (let i = 0; i < 60; i++) A.ws.update(0.1); ok('setOcclusion(7) se acota a 1', A.ws.occlusion > 0.99 && A.ws.occlusion <= 1) }
{ const A = mkAudio({ soundOcclusion: false }, { probe: () => 0.9 }); A.ws.thunder({ distance: 1500, bearing: 0, seed: 5 }); await tick(); for (let i = 0; i < 20; i++) A.ws.update(0.1)
  ok('«Oclusión por techos» apagada: los rayos no se tiran ni cuentan', A.ws.occlusion === 0 && A.probes === 0, A.probes)
  const B = mkAudio({ thunderRegions: [{ preset: 'interior', cx: 0, cy: 0, cz: 0, sx: 50, sy: 50, sz: 50 }], soundOcclusion: false }); B.ws.thunder({ distance: 1500, bearing: 0, seed: 5 }); await tick(); for (let i = 0; i < 20; i++) B.ws.update(0.1)
  ok('una región Interior amortigua aunque no haya rayos (suelo 0,75)', Math.abs(B.ws.occlusion - 0.75) < 0.01, B.ws.occlusion.toFixed(2)) }
{ const A = mkAudio({ thunderSound: 'clips' }); for (let i = 0; i < 20; i++) A.ws.update(0.1); ok('en modo clips no se tiran rayos de sonido (coste cero)', A.probes === 0)
  const B = mkAudio(); B.ws.thunder({ distance: 900, bearing: 0, seed: 2 }); await tick(); B.ws.stop(); ok('stop() corta y suelta los truenos activos', B.ws.active.length === 0 && B.plays[0].v.stopped) }

console.log('API de scripts')
{ const A = mkAudio({ thunderRegion: 'city' }); const api = makeWorldApi(() => A.world, () => A.ws)
  ok('game.weather.thunderRegion', api.weather.thunderRegion === 'city')
  api.weather.setOcclusion(0.4); A.ws.thunder({ distance: 800, bearing: 0, seed: 3 }); await tick(); for (let i = 0; i < 40; i++) A.ws.update(0.1)
  ok('game.weather.setOcclusion / .occlusion', Math.abs(api.weather.occlusion - 0.4) < 0.01)
  const none = makeWorldApi(() => A.world, () => null); ok('sin audio: valores seguros', none.weather.thunderRegion === 'open' && none.weather.occlusion === 0 && none.weather.setOcclusion(1) === undefined) }

console.log(bad ? `\n${bad} FALLO(S)` : '\nTODO OK'); process.exit(bad ? 1 : 0)
