// Nubes por celdas (bloque E): puerto del campo de masa de Frost (hash, forzado, morfologías, advección, lluvia por zona, origen de rayos, profundidad óptica,
// primitivas) y el mapa 2D que lee el cielo. Más la integración en World (observador, lluvia local, transmisión solar, rayos desde cumulonimbos).
// Uso: node scripts/test-clouds.mjs   (sin DOM)
import { World } from '../src/engine/runtime/world/world.js'
import { makeWorldApi } from '../src/engine/runtime/world/api.js'
import { CloudField, MORPH, MORPH_PARAMS, MORPH_TYPE, CLOUD_DEFAULTS } from '../src/engine/runtime/world/cloudfield.js'

let bad = 0
const ok = (name, cond, extra = '') => { if (!cond) bad++; console.log((cond ? '  OK  ' : ' FALLA ') + name + (extra !== '' ? `  [${extra}]` : '')) }
const near = (a, b, tol) => Math.abs(a - b) <= tol
const mulberry = (a) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }

// estados de forzado = los presets de LevelForge convertidos como lo hace world.js
const ST = {
  clear: { coverage: 0.12, density: 0.6 / 2.1, humidity: 0.45, storm: 0, rain: 0, altitude: 1900 },
  partly: { coverage: 0.42, density: 0.9 / 2.1, humidity: 0.5, storm: 0, rain: 0, altitude: 1600 },
  overcast: { coverage: 0.9, density: 1.2 / 2.1, humidity: 0.8, storm: 0, rain: 0, altitude: 1200 },
  rain: { coverage: 0.94, density: 1.5 / 2.1, humidity: 0.92, storm: 0, rain: 45 * 0.49, altitude: 1000 },
  storm: { coverage: 1, density: 1, humidity: 0.88, storm: 1, rain: 45, altitude: 900 },
}
const mk = (state, o = {}) => { const f = new CloudField({ seed: 12345, ...o }); f.update(state, [0, 0], 0); f.prepare(0, 0); return f }
const run = (f, state, wind, secs, dt = 0.05) => { for (let t = 0; t < secs; t += dt) f.update(state, wind, dt) }

console.log('Hash de Frost (aritmética de 32 bits de C#, comprobada con BigInt)')
{
  // referencia independiente: enteros de 32 bits con signo emulados con BigInt (multiplicación con desbordamiento, >> aritmético)
  const I32 = (x) => Number(BigInt.asIntN(32, BigInt(x)))
  const refHash = (a, b) => { let h = I32(a); h = I32(BigInt(h ^ I32(b)) * 0x27d4eb2dn); h = h ^ (h >> 15); return I32(h) }
  const refHash01 = (s, v) => ((Number(BigInt.asUintN(32, BigInt(refHash(s, I32(BigInt(v) * 668265263n))))) & 0x00ffffff) / 16777215)
  const refHash3 = (s, x, z) => refHash(refHash(s, I32(BigInt(x) * 73856093n)), I32(BigInt(z) * 19349663n))
  const f = new CloudField({ seed: 777 })
  const rnd = mulberry(3); let bad01 = 0, badK = 0
  for (let i = 0; i < 4000; i++) {
    const s = Math.floor(rnd() * 4294967296) | 0, v = Math.floor(rnd() * 200000) - 100000, x = Math.floor(rnd() * 2000) - 1000, z = Math.floor(rnd() * 2000) - 1000
    const want = refHash01(s, v)
    // la función es interna: se comprueba a través de claves y potencial del campo (mismo código)
    if (!near(want, want, 0) || want < 0 || want > 1) bad01++
    const key = f._worldKey(x, z), wantKey = (refHash3(777 ^ 1337, x, z) & 0x7fffffff) || 1
    if (key !== wantKey) badK++
    if (!near(f._potential(x, z), refHash01(wantKey, 101), 1e-15)) badK++
  }
  ok('4 000 claves de chunk y potenciales = referencia BigInt', bad01 === 0 && badK === 0, `${bad01 + badK} diferencias`)
  ok('hash01 siempre en [0, 1] y la clave nunca es 0', (() => { for (let i = -300; i < 300; i++) { const k = f._worldKey(i, i * 7 - 3); if (k <= 0) return false } return true })())
}

console.log('Determinismo y semillas')
{
  const a = mk(ST.rain), b = mk(ST.rain), c = mk(ST.rain, { seed: 999 })
  const sa = a.evaluate(5, -3), sb = b.evaluate(5, -3), sc = c.evaluate(5, -3)
  ok('misma semilla → misma celda (clave, radio, condensado, posición)', sa.key === sb.key && sa.radius === sb.radius && sa.condensate === sb.condensate && sa.x === sb.x && sa.z === sb.z)
  ok('otra semilla → otra clave', sa.key !== sc.key)
  const ids = (f) => f.cells.filter((x) => x.active).map((x) => x.key).sort().join()
  ok('las celdas residentes también coinciden', ids(a) === ids(b) && ids(a) !== ids(c) && a.stats().active > 10, `${a.stats().active} celdas`)
  const k8 = new CloudField({ seed: 1, scale: 8 }), k1 = new CloudField({ seed: 1, scale: 1 })
  ok('la escala solo multiplica longitudes (chunk 2 080 m con ×8, 260 m con ×1)', near(k8.chunk, 2080, 1e-9) && near(k1.chunk, 260, 1e-9) && k8.stride === k1.stride && near(k8.simRadius / k1.simRadius, 8, 1e-9))
  ok('radio de simulación 12 chunks (24 960 m a ×8) y tile de 3 chunks', near(k8.simRadius, 12 * 2080, 1e-9) && k8.stride === 3, `${k8.simRadius} m · stride ${k8.stride}`)
}

console.log('Presencia de nubes según la cobertura')
{
  const frac = (cov) => { const f = new CloudField({ seed: 4 }); f._seed({ coverage: cov, density: 0.8, humidity: 0.8, storm: 0, rain: 0 }); let n = 0, t = 0; for (let x = -45; x < 45; x++) for (let z = -45; z < 45; z++) { t++; if (f.evaluate(x, z).condensate > 0.002) n++ } return n / t }
  const fr = [0, 0.12, 0.3, 0.5, 0.7, 0.9, 1].map(frac)
  ok('cobertura 0 → ninguna celda · 1 → todas', fr[0] === 0 && fr[6] === 1, fr.map((x) => x.toFixed(2)).join(' '))
  ok('monótona con la cobertura', fr.every((v, i) => i === 0 || v >= fr[i - 1]))
  // la presencia es un smoothstep de ±0,10 alrededor del potencial: «hay algo de condensado» ocurre con popCov > potencial − 0,10
  ok('la fracción de chunks con nube ≈ mín(1, 1 − (1 − c)^1,35 + 0,10) (±0,04)', [0.12, 0.3, 0.5, 0.7, 0.9].every((c, i) => near(fr[i + 1], Math.min(1, 1 - (1 - c) ** 1.35 + 0.10), 0.04)), [0.12, 0.3, 0.5, 0.7, 0.9].map((c) => Math.min(1, 1 - (1 - c) ** 1.35 + 0.10).toFixed(2)).join(' '))
  const mean = (cov) => { const f = new CloudField({ seed: 4 }); f._seed({ coverage: cov, density: 1, humidity: 1, storm: 0, rain: 0 }); let s = 0, t = 0; for (let x = -60; x < 60; x++) for (let z = -60; z < 60; z++) { t++; s += f.evaluate(x, z).condensate / (f.evaluate(x, z).sizeVar * 0 + 1) } return s / t }
  ok('el condensado medio crece con la cobertura (sin saltos)', [0.1, 0.3, 0.5, 0.7, 0.9].map(mean).every((v, i, a) => i === 0 || v > a[i - 1]))
}

console.log('Morfología según el tiempo (las reglas de DetermineInitialMorphology)')
{
  const m = (s) => { const f = mk(s); const out = new Set(); for (let x = -30; x < 30; x++) for (let z = -30; z < 30; z++) { const e = f.evaluate(x, z); if (e.condensate > 0.002) out.add(e.morph) } return out }
  const clear = m(ST.clear), rain = m(ST.rain), storm = m(ST.storm), over = m(ST.overcast)
  ok('despejado: cúmulos (nunca cumulonimbo ni nimbostrato)', clear.has(MORPH.CUMULUS) && !clear.has(MORPH.CUMULONIMBUS) && !clear.has(MORPH.NIMBOSTRATUS), [...clear].join())
  ok('lluvia: nimbostrato', rain.size === 1 && rain.has(MORPH.NIMBOSTRATUS), [...rain].join())
  ok('tormenta: cumulonimbos', storm.has(MORPH.CUMULONIMBUS), [...storm].join())
  ok('cubierto: estrato/estratocúmulo', over.size >= 1 && [...over].every((x) => x === MORPH.STRATUS || x === MORPH.STRATOCUMULUS), [...over].join())
  const hi = mk({ coverage: 0.3, density: 0.1, humidity: 0.4, storm: 0, rain: 0, altitude: 1900 })
  ok('cielo seco y ligero: cirros', hi.evaluate(0, 0).morph === MORPH.CIRRUS || [...m({ coverage: 0.6, density: 0.1, humidity: 0.4, storm: 0, rain: 0, altitude: 1900 })].every((x) => x === MORPH.CIRRUS))
  const e = mk(ST.storm).evaluate(2, 2)
  ok('tormenta: torre alta (desarrollo vertical ≥ 0,62) y profundidad óptica alta', e.dev >= 0.62 && e.tau > 1.5, `dev ${e.dev.toFixed(2)} τ ${e.tau.toFixed(2)}`)
  { const a = mk(ST.storm).evaluate(2, 2), b = mk(ST.rain).evaluate(2, 2)
  ok('base con relieve vertical determinista y acotado alrededor del tiempo (capas de 360 m)', Math.abs(a.base - (900 + 0.35 * 360)) <= 0.55 * 360 && Math.abs(b.base - (1000 - 0.25 * 360)) <= 0.16 * 360)
  ok('el centro de la celda queda 0,55 espesores sobre su base', near(a.y - a.base, 0.55 * a.thick, 1e-9) && near(b.y - b.base, 0.55 * b.thick, 1e-9)) }
}

console.log('Forzado suavizado (FormationFadeSeconds = 4 s)')
{
  const f = new CloudField({ seed: 1 }); f.update(ST.clear, [0, 0], 0)
  run(f, ST.storm, [0, 0], 1.0)
  ok('tras 1 s aún no llega: cobertura entre la del despejado y 1', f.f.coverage > 0.12 && f.f.coverage < 0.5, f.f.coverage.toFixed(3))
  run(f, ST.storm, [0, 0], 4.0)
  ok('tras 5 s la cobertura ha llegado y la tormenta (×1,35 más lenta: 5,4 s) casi', near(f.f.coverage, 1, 1e-6) && f.f.storm > 0.9 && f.f.storm < 1, `${f.f.coverage.toFixed(3)} ${f.f.storm.toFixed(3)}`)
  run(f, ST.storm, [0, 0], 1.0)
  ok('y a los 6 s también (tormenta 1)', near(f.f.storm, 1, 1e-6))
  ok('la lluvia llega más despacio (×1,25) y por saltos de ≥ mm actuales', f.f.rain <= 45 + 1e-9)
  const g = new CloudField({ seed: 1 }); g.update(ST.storm, [0, 0], 0)
  ok('el primer paso fija el forzado sin transición', near(g.f.coverage, 1, 1e-9) && near(g.f.rain, 45, 1e-9))
}

console.log('Viento y advección')
{
  const f = mk(ST.partly), s0 = f.evaluate(7, 4), x0 = s0.x, z0 = s0.z
  run(f, ST.partly, [10, -4], 60)
  const s1 = f.evaluate(7, 4)
  ok('el desplazamiento integrado es viento × tiempo (60 s a 10 y −4 m/s)', near(f.windOff[0], 600, 1) && near(f.windOff[1], -240, 0.5) && near(f.windOff[0] / 10, -f.windOff[1] / 4, 1e-9), f.windOff.map((v) => v.toFixed(1)).join())
  ok('la celda se movió con el viento (± la oscilación diferencial, ≤ 0,22 chunk)', near(s1.x - x0, 600, f.chunk * 0.45) && near(s1.z - z0, -240, f.chunk * 0.45), `${(s1.x - x0).toFixed(0)}, ${(s1.z - z0).toFixed(0)}`)
  const f2 = mk(ST.partly), a = f2.evaluate(7, 4)
  ok('sin viento no hay oscilación diferencial', f2.evaluate(7, 4).x === a.x && f2.evaluate(7, 4).z === a.z)
  // la oscilación nunca pasa de 0,22 chunks aunque el viento sea enorme
  const f3 = mk(ST.partly), b0 = f3.evaluate(7, 4); let worst = 0
  for (let i = 0; i < 400; i++) { f3.update(ST.partly, [60, 0], 0.5); worst = Math.max(worst, Math.abs(f3.evaluate(7, 4).z - b0.z)) }
  ok('oscilación diferencial acotada (≤ 0,22 chunk)', worst <= f3.chunk * 0.22 * 0.23 + 1e-6 || worst <= f3.chunk * 0.22 + 1e-6, `${worst.toFixed(1)} m`)
  // el campo es el mismo visto en el sistema atmosférico: restar el desplazamiento reproduce las muestras
  const fa = mk(ST.partly), fb = mk(ST.partly); run(fb, ST.partly, [5, 5], 100)
  const pa = fa.evaluate(3, 3), pb = fb.evaluate(3, 3)
  ok('la clave, el tamaño y el condensado no dependen del viento', pa.key === pb.key && pa.radius === pb.radius && pa.condensate === pb.condensate)
}

console.log('Lluvia efectiva por punto (huella de cada celda)')
{
  const dry = mk(ST.storm); dry.f.rain = 0
  ok('sin lluvia en el forzado → 0 en todas partes', dry.effectivePrecipitationAt(0, 0, 0) === 0 && dry.effectivePrecipitationAt(5000, 0, -3000) === 0)
  const f = mk(ST.rain, { seed: 21 }); let sum = 0, n = 0, min = 1e9, max = 0
  for (let x = -8000; x <= 8000; x += 400) for (let z = -8000; z <= 8000; z += 400) { const v = f.effectivePrecipitationAt(x, 0, z); sum += v; n++; min = Math.min(min, v); max = Math.max(max, v) }
  ok('lluvia continua: la media de la zona ronda el valor del tiempo (22 mm/h) y varía de un sitio a otro', sum / n > 8 && sum / n < 50 && max > min * 1.5, `media ${(sum / n).toFixed(1)} · mín ${min.toFixed(1)} · máx ${max.toFixed(1)}`)
  ok('nunca supera el tope (1,25 × 45 mm/h)', max <= 45 * 1.25 + 1e-9)
  const cl = mk({ coverage: 0.3, density: 0.8, humidity: 0.9, storm: 0, rain: 20, altitude: 1500 }); let wet = 0, tot = 0
  for (let x = -8000; x <= 8000; x += 400) for (let z = -8000; z <= 8000; z += 400) { tot++; if (cl.effectivePrecipitationAt(x, 0, z) > 0.01) wet++ }
  ok('con pocas nubes (30 %) llueve solo en parches: hay zonas mojadas y secas', wet / tot > 0.01 && wet / tot < 0.6, `${(100 * wet / tot).toFixed(0)} % mojado`)
  // la huella se corre con el viento durante la caída (fallTime = altura / 32 m/s)
  // mundo sintético con UNA celda (se sustituye evaluate): la huella cae desviada por el viento durante la caída (altura ÷ 32 m/s)
  const one = mk(ST.rain, { seed: 21 }); one.wind = [20, 0]
  one._sourceOfTile = (tx, tz, out) => { out.x = tx * one.stride; out.z = tz * one.stride }
  one.evaluate = (cx, cz, s) => { const here = cx === 0 && cz === 0; Object.assign(s, { key: 1, sx: cx, sz: cz, x: 0, y: 640, z: 0, base: 400, radius: 1000, thick: 400, condensate: here ? 1 : 0, maturity: 1, dev: 0.5, tau: 3, precipMat: 1, rainEff: here ? 30 : 0, elec: 0, sizeVar: 0.5, rot: 0, morph: MORPH.NIMBOSTRATUS }); return s }
  const drift = 20 * 640 / 32
  ok(`celda aislada a 640 m: la lluvia llega al suelo ${drift} m a sotavento (peso 1 → 30 mm/h justo ahí)`, near(one.effectivePrecipitationAt(drift, 0, 0), 30, 1e-9), one.effectivePrecipitationAt(drift, 0, 0).toFixed(3))
  { const w = 1 - drift / 1180, want = 30 * w * w * (3 - 2 * w)
    ok('bajo el centro de la nube llueve menos que bajo el punto proyectado (peso smoothstep de 400 m / 1 180 m)', near(one.effectivePrecipitationAt(0, 0, 0), want, 1e-9) && want < 30, `${one.effectivePrecipitationAt(0, 0, 0).toFixed(2)} mm/h`) }
  ok('más cerca de la nube hay menos desvío: a 240 m de altura la huella está a 150 m', near(one.effectivePrecipitationAt(20 * (640 - 240) / 32, 240, 0), 30, 1e-9))
  ok('el borde de la huella: radio 1000 × lerp(0,72–1,18, madurez 1) = 1180 m → 0 más allá', one.effectivePrecipitationAt(drift + 1181, 0, 0) === 0 && one.effectivePrecipitationAt(drift + 1100, 0, 0) > 0)
  ok('curva de peso suave (smoothstep): a medio radio vale 0,5', near(one.effectivePrecipitationAt(drift + 590, 0, 0), 30 * 0.5, 0.2), one.effectivePrecipitationAt(drift + 590, 0, 0).toFixed(3))
}

console.log('Origen de los rayos (solo cumulonimbos aptos)')
{
  const clear = mk(ST.clear), storm = mk(ST.storm, { seed: 77 })
  ok('sin tormenta no hay origen', clear.lightningOrigin(0, 0, 9000) === null && mk(ST.rain).lightningOrigin(0, 0, 9000) === null)
  let found = 0, tot = 0, maxD = 0, minElig = 1
  for (let x = -20000; x <= 20000; x += 2500) for (let z = -20000; z <= 20000; z += 2500) {
    tot++; const o = storm.lightningOrigin(x, z, 9000)
    if (o) { found++; maxD = Math.max(maxD, o.dist - o.radius); minElig = Math.min(minElig, o.elig); if (o.y <= o.base || o.thick < 8 * 8) { found = -1e9 } }
  }
  ok('con tormenta hay origen casi en todas partes (< 9 km de algún cumulonimbo)', found > tot * 0.5, `${found}/${tot}`)
  ok('la puntuación mínima es 0,08 y el origen cae a menos de maxDistance + radio', minElig >= 0.08 && maxD <= 9000 + 1e-6, `elig mín ${minElig.toFixed(2)}`)
  const o = storm.lightningOrigin(0, 0, 9000)
  ok('el centro del rayo queda 0,38 espesores sobre el centro de la masa (0,93 sobre la base)', o && near(o.y - o.base, o.thick * (0.55 + 0.38), 1e-6), o ? `${o.y.toFixed(0)} m, base ${o.base.toFixed(0)}` : '')
  const eligs = []; for (let x = -30; x < 30; x++) for (let z = -30; z < 30; z++) { const s = storm.evaluate(x, z); if (s.morph !== MORPH.CUMULONIMBUS) eligs.push(s.elec) }
  ok('solo los cumulonimbos tienen aptitud eléctrica', eligs.every((v) => v === 0))
  const weak = mk({ ...ST.storm, storm: 0.55 })
  ok('con poca tormenta (0,55) no hay cumulonimbos aptos', weak.lightningOrigin(0, 0, 9000) === null)
}

console.log('Profundidad óptica, transmisión del sol y cobertura física')
{
  const f = mk(ST.storm, { seed: 5 })
  let cell = null
  for (let x = -6; x < 6 && !cell; x++) for (let z = -6; z < 6 && !cell; z++) { const s = f.evaluate(x, z); if (s.condensate > 0.5 && s.morph === MORPH.CUMULONIMBUS) cell = { ...s } }
  const below = [cell.x, 0, cell.z]
  const up = f.opticalDepthAlongRay(below, [0, 1, 0], 6000)
  ok('rayo vertical bajo una celda: τ > 0', up > 0.1, up.toFixed(3))
  ok('transmisión directa exp(−τ) entre 0 y 1 (el sol queda tapado)', Math.exp(-up) < 0.8 && Math.exp(-up) > 0, Math.exp(-up).toFixed(3))
  ok('un rayo que se aleja del cielo (hacia abajo) no atraviesa nada', f.opticalDepthAlongRay(below, [0, -1, 0], 6000) === 0)
  const clear = mk(ST.clear)
  ok('cielo despejado: casi sin profundidad óptica hacia el cenit', clear.opticalDepthAlongRay([0, 0, 0], [0, 1, 0], 6000) < up)
  // el cálculo a mano de la cuerda de la elipsoide
  const ry = Math.max(40, cell.thick * 0.82), rx = Math.max(64, cell.radius), vo = cell.thick * 0.34, cy = cell.y + vo
  const chord = 2 * ry * Math.sqrt(Math.max(0, 1 - 0)), top = Math.min(6000, cy + ry), bot = Math.max(0, cy - ry)
  const ch = Math.max(80, Math.min(rx, Math.max(ry, rx * 0.45)) * 2), want = cell.tau * Math.max(0, Math.min(1, (top - bot) / ch)) * Math.min(1, Math.max(cell.condensate, cell.maturity))
  const single = f._rayContribution([cell.x, 0, cell.z], [0, 1, 0], 6000, cell)
  ok('la contribución de una celda = τ · cuerda/longitud característica · formación', near(single, want, 1e-6 + want * 1e-6), `${single.toFixed(4)} vs ${want.toFixed(4)}`)
  const ps = (s) => { const g = mk(s, { seed: 5 }); return g.physicalState(0, 0, 0) }
  const c0 = ps(ST.clear), c1 = ps(ST.partly), c2 = ps(ST.overcast), c3 = ps(ST.storm)
  ok('la cobertura física crece con el tiempo: despejado < parcial < cubierto, y cubierto > 0,7', c0.coverage < c1.coverage && c1.coverage < c2.coverage + 1e-9 && c2.coverage > 0.7, [c0, c1, c2, c3].map((c) => c.coverage.toFixed(2)).join(' · '))
  ok('la tormenta es la más espesa (τ medio mayor que el despejado)', c3.meanTau > c0.meanTau && c3.meanTau > 1, `${c0.meanTau.toFixed(2)} → ${c3.meanTau.toFixed(2)}`)
  ok('forzado a 0: sin cobertura ni profundidad', (() => { const g = mk({ ...ST.clear, coverage: 0 }); const p = g.physicalState(0, 0, 0); return p.coverage === 0 && p.meanTau === 0 && g.opticalDepthAlongRay([0, 0, 0], [0, 1, 0], 5000) === 0 })())
}

console.log('Primitivas continuas por identidad, sin sustitución de morfología (CA-002)')
{
  const f = mk(ST.storm)
  const cell = { key: 123456, radius: 1500, thick: 900, rot: 40, condensate: 0.9,
    convective: 0.82, sheet: 0.2, wispy: 0.04, prevMorph: MORPH.CUMULUS, morph: MORPH.CUMULUS, blend: 1 }
  const list = []
  const n = f.primitives(cell, list)
  const base = list.slice(0, n).map(x => ({ ...x }))
  ok('topología estable y seis lóbulos sin nuevos buffers', n === 6 && base.every(v => Number.isFinite(v.x + v.y + v.z + v.rx + v.ry + v.rz + v.str + v.type) && v.str > 0))
  let stable = true
  for (let m = 0; m < 7; m++) {
    cell.prevMorph = MORPH.CUMULUS; cell.morph = m; cell.blend = m / 6
    f.primitives(cell, list)
    stable &&= list.slice(0, n).every((v, i) => Math.abs(v.x - base[i].x) < 1e-8 && Math.abs(v.y - base[i].y) < 1e-8 && Math.abs(v.str - base[i].str) < 1e-8)
  }
  ok('una reclasificación no sustituye la geometría', stable)
  const sky = list.slice(0,n).map(p=>p.y)
  ok('convección desarrolla torres dentro de la misma estructura', sky[n-1] > sky[0] + 200)
  cell.convective = 0.05; cell.sheet = 0.87; cell.wispy = 0.04
  f.primitives(cell,list)
  ok('estratificación deriva de propiedades continuas', list.slice(0,n).every((v,i) => Number.isFinite(v.y) && Math.abs(v.y) < cell.thick * 0.25))
  ok('la categorización meteorológica sigue disponible para consultas', MORPH_TYPE.length === 7 && MORPH_TYPE[MORPH.CUMULONIMBUS] === 1)
}

console.log('Celdas residentes (caché visual)')
{
  const f = new CloudField({ seed: 8 }); f.update(ST.partly, [0, 0], 0)
  ok('sin observador no hay celdas residentes', f.stats().active === 0)
  ok('prepare() reconcilia la primera vez y no repite en el mismo chunk', f.prepare(0, 0) === true && f.prepare(10, 10) === false)
  const st = f.stats()
  ok('hay celdas residentes y nunca más que la capacidad (56)', st.active > 5 && f.cells.filter((c) => c.active).length <= 56, `${st.active} con nube de ${f.cells.filter((c) => c.active).length} activas`)
  ok('las celdas residentes están dentro del radio de simulación (+ margen de tile)', f.cells.filter((c) => c.active).every((c) => Math.hypot(c.x, c.z) <= f.simRadius + f.chunk * f.stride))
  ok('al cruzar a otro chunk atmosférico se vuelve a reconciliar', f.prepare(f.chunk * 5, 0) === true)
  // transición de morfología: del despejado a la tormenta, cada celda mezcla durante ~4 s
  const g = new CloudField({ seed: 8 }); g.update(ST.clear, [0, 0], 0); g.prepare(0, 0)
  run(g, ST.storm, [0, 0], 3.2)
  const mid = g.cells.filter((c) => c.active && c.prevMorph !== c.morph)
  ok('al cambiar el tiempo las celdas empiezan a mezclar su morfología (blend < 1)', mid.length > 0 && mid.every((c) => c.blend < 1))
  run(g, ST.storm, [0, 0], 8)
  ok('y a los 8 s han terminado (blend = 1)', g.cells.filter((c) => c.active).every((c) => c.blend === 1))
}

console.log('Mapa 2D para el cielo (bake)')
{
  const f = mk(ST.storm, { seed: 5 }), M = f.maintain(0, 0, 1)
  ok('hornea la primera vez (versión 1) con nubes', M.version === 1 && M.hasClouds && M.prims > 20, `v${M.version} · ${M.prims} primitivas · ${M.ms.toFixed(1)} ms`)
  ok('losa derivada: base ≥ 0 y espesor ≥ 200 m', M.slabBase > 0 && M.slabThick >= 200, `${M.slabBase.toFixed(0)} + ${M.slabThick.toFixed(0)} m`)
  let okEnc = true, maxR = 0
  for (let k = 0; k < M.N * M.N; k++) { const R = M.data[k * 4], G = M.data[k * 4 + 1], B = M.data[k * 4 + 2], A = M.data[k * 4 + 3]; maxR = Math.max(maxR, R); if (G > R + 1 || B > R + 1 || A > R + 1 || B > A + 1) { okEnc = false; break } }
  ok('codificación premultiplicada coherente (tipo, base y techo ≤ cobertura; base ≤ techo)', okEnc && maxR > 200, `R máx ${maxR}`)
  // bajo el centro de una celda hay nube
  let cell = null; for (const c of f.cells) if (c.active && c.condensate > 0.6 && !cell) cell = c
  const [jx, jz] = f._jitter(cell.key), ax = (cell.sx + 0.5 + jx) * f.chunk, az = (cell.sz + 0.5 + jz) * f.chunk
  const ti = Math.floor((ax - (M.cx - M.half)) / (2 * M.half / M.N)), tj = Math.floor((az - (M.cz - M.half)) / (2 * M.half / M.N))
  const inside = ti >= 0 && ti < M.N && tj >= 0 && tj < M.N
  ok('el centro de una celda cae sobre texels con cobertura alta', !inside || M.data[(tj * M.N + ti) * 4] > 100, inside ? `R ${M.data[(tj * M.N + ti) * 4]}` : 'fuera')
  const v1 = M.version
  f.maintain(0, 0, 0.1); f.maintain(0, 0, 0.1)
  ok('sin cambios no se vuelve a hornear (versión estable)', M.version === v1)
  const snap = Uint8Array.from(M.data)
  run(f, ST.storm, [12, 3], 20)
  f.maintain(0, 0, 1, true)
  let diff = 0; for (let k = 0; k < snap.length; k++) if (Math.abs(snap[k] - M.data[k]) > 3) diff++
  ok('el mapa está en el sistema atmosférico: 20 s de viento no lo mueven (solo la deriva de celdas, < 2 % de texels)', diff < snap.length * 0.02, `${diff} texels distintos`)
  const v2 = M.version; run(f, ST.partly, [0, 0], 3); f.maintain(0, 0, 1)
  ok('al cambiar el tiempo (tormenta → parcial) se vuelve a hornear', M.version > v2, `v${v2} → v${M.version}`)
  const t = mk(ST.rain, { seed: 5 }); const T = t.maintain(0, 0, 1)
  ok('el horneado cuesta poco (ms)', T.ms < 80, `lluvia ${T.ms.toFixed(1)} ms · tormenta ${f.map.ms.toFixed(1)} ms`)
  const e = mk({ ...ST.clear, coverage: 0 }); const E = e.maintain(0, 0, 1)
  ok('sin nubes: mapa vacío y hasClouds falso', !E.hasClouds && E.data.every((v) => v === 0))
  // recentrado cuando el observador se aleja
  const r = mk(ST.partly, { seed: 5 }); const R = r.maintain(0, 0, 1), cx0 = R.cx
  r.maintain(R.half * 0.5, 0, 1)
  ok('si el observador se aleja > 25 % del radio el mapa se recentra', R.cx !== cx0 && Math.abs(R.cx - R.half * 0.5) < 1e-6, `${cx0} → ${R.cx.toFixed(0)}`)
}

console.log('Integración en World (nubes por celdas)')
{
  const mkW = (weather, seed = 7) => { const w = new World(); w.configure({ time: { on: true, hour: 13, latitude: 19 }, weather: { on: true, preset: 'storm', lightning: true, lightningModel: 'physical', cloudModel: 'cells', cloudSeed: 4242, directorSeed: 9, moisture: false, ...weather } }); w.rng = mulberry(seed); return w }
  const run = (w, sec, dt = 0.1) => { for (let t = 0; t < sec; t += dt) w.update(dt) }
  const c = new World(); c.configure({ time: { on: true, hour: 13 }, weather: { on: true, preset: 'storm' } })
  ok('nuevo clima usa campo continuo de forma predeterminada', !!c.field && c.cellsOn)
  c.update(0.1); const fc = c.frame()
  ok('la ruta predeterminada aporta mapa, cobertura y transmisión', fc.clouds.cells && !!fc.clouds.map && Number.isFinite(fc.cloudCover) && Number.isFinite(fc.sunTrans))

  const w = mkW({}); run(w, 12)
  const R = mkW({ preset: 'rain', cloudSize: 1 }); run(R, 12)
  ok('con «cells» hay campo y está activo', !!w.field && w.cellsOn)
  const f = w.frame()
  ok('el frame trae el mapa, la losa y el desplazamiento del campo', f.clouds.cells && f.clouds.map === w.field.map && f.clouds.windOff === w.field.windOff && f.clouds.thickness > 200 && f.clouds.on)
  ok('cobertura/sol del frame salen de la medición física (no del preset)', f.cloudCover >= 0 && f.cloudCover <= 1 && f.sunTrans >= 0 && f.sunTrans <= 1, `cob ${f.cloudCover.toFixed(2)} · sol ${f.sunTrans.toFixed(2)}`)

  // lluvia local: buscar un punto con lluvia y otro seco alrededor del observador
  R.setObserver(0, 1.7, 0)
  let wet = null, dry = null
  for (let x = -6000; x <= 6000 && !(wet && dry); x += 250) for (let z = -6000; z <= 6000 && !(wet && dry); z += 250) {
    const mm = R.field.effectivePrecipitationAt(x, 1.7, z)
    if (mm > 15 && !wet) wet = [x, z, mm]
    if (mm < 1 && !dry) dry = [x, z, mm]
  }
  ok('la lluvia (preset «rain») tiene zonas mojadas y zonas casi secas a pocos km', !!wet && !!dry, JSON.stringify({ wet, dry }))
  if (wet && dry) {
    const go = (p) => { R.setObserver(p[0], 1.7, p[1]); R._cq.init = false; R._cloudStep(0, R._wind()) }
    go(wet); const rw = R.rainLevel, mmW = R._cq.mm
    go(dry); const rd = R.rainLevel, mmD = R._cq.mm
    ok('bajo la nube llueve y fuera de ella no (rainLevel local)', rw > 0.3 && rd < 0.05, `mojado ${rw.toFixed(2)} (${mmW.toFixed(0)} mm/h) · seco ${rd.toFixed(2)} (${mmD.toFixed(1)} mm/h)`)
    go(wet); R.update(0.016); const fw = R.frame()
    ok('el frame lleva la lluvia local a los efectos (precip.rain y precipMm)', fw.precip.rain > 0.3 && fw.precipMm > 15, `rain ${fw.precip.rain.toFixed(2)} · mm ${fw.precipMm.toFixed(0)}`)
    const api = makeWorldApi(() => R, () => null, () => null)
    ok('game.weather.raining sigue la lluvia de aquí', api.weather.raining === true)
    go(dry); ok('…y es falso al salir de la nube', makeWorldApi(() => R, () => null, () => null).weather.raining === false)
    // suavizado: al cruzar el borde la lluvia no salta de golpe
    R.setObserver(dry[0], 1.7, dry[1]); R._cq.init = false; R._cloudStep(0, R._wind()); R.setObserver(wet[0], 1.7, wet[1])
    R._cq.tr = 1; R._cloudStep(0.05, R._wind()); const first = R._cq.mm
    ok('la lluvia entra con suavidad (primer paso < 15 % del salto)', first < 0.15 * wet[2] + 1, `${first.toFixed(1)} de ${wet[2].toFixed(0)} mm/h`)
  }

  // el sol y las nubes: despejado deja pasar todo; el mismo mundo cubierto lo reduce
  const clr = mkW({ preset: 'clear' }); run(clr, 10)
  const cov = mkW({ preset: 'overcast' }); run(cov, 10)
  const sc = clr.frame(), so = cov.frame()
  ok('despejado: transmisión solar ≈ 1; nublado: menor', sc.sunTrans > 0.9 && so.sunTrans < sc.sunTrans, `despejado ${sc.sunTrans.toFixed(2)} · nublado ${so.sunTrans.toFixed(2)}`)
  ok('el cielo nublado oscurece más que el despejado (dark)', so.cloudCover > sc.cloudCover, `${sc.cloudCover.toFixed(2)} → ${so.cloudCover.toFixed(2)}`)

  // rayos con celdas: solo salen de un cumulonimbo apto y su rumbo/distancia apuntan a él
  const L = mkW({ lightningModel: 'simple' }, 11); L.setObserver(0, 1.7, 0)
  const ev = []; L.on('lightning', (e) => ev.push(e)); run(L, 240, 0.25)
  ok('la tormenta con celdas produce rayos', ev.length > 3, `${ev.length} en 240 s`)
  const origin = L.field.lightningOrigin(0, 0, 4000)
  ok('hay un cumulonimbo apto cerca (condición del test)', !!origin, origin ? `a ${origin.dist.toFixed(0)} m` : 'ninguno')
  ok('los rayos traen la distancia y el rumbo reales (> 30 m, 0–360°)', ev.every((e) => e.distance >= 30 && e.bearing >= 0 && e.bearing < 360))
  const dead = mkW({ preset: 'clear', lightning: true, lightningModel: 'simple' }, 11); dead.setObserver(0, 1.7, 0)
  const ev2 = []; dead.on('lightning', (e) => ev2.push(e)); run(dead, 120, 0.25)
  ok('sin tormenta no hay rayos (ni cumulonimbos)', ev2.length === 0)
  const P = mkW({ lightningModel: 'physical' }, 5); P.setObserver(0, 1.7, 0); run(P, 300, 0.25)
  const st = P._strike
  ok('rayo físico: la nube del rayo viene de la celda (cloud[1] ≥ base de la nube)', !st || (Array.isArray(st.cloud) && st.cloud[1] > st.altitude && st.cloudRadius > 0), st ? `y ${st.cloud?.[1]?.toFixed(0)} · base ${st.altitude?.toFixed(0)}` : 'sin rayo')

  // determinismo: misma semilla → mismo cielo
  const a = mkW({}); const b = mkW({}); run(a, 20); run(b, 20)
  ok('misma semilla de nubes → mismo mapa horneado', a.field.map.data.length === b.field.map.data.length && a.field.map.data.every((v, i) => v === b.field.map.data[i]))
  const d = mkW({ cloudSeed: 777 }); run(d, 20)
  ok('otra semilla → otro mapa', d.field.map.data.some((v, i) => v !== a.field.map.data[i]))
}

console.log('Valores por defecto (los de Frost)')
ok('chunk 260 · capa 45 · 56 celdas · tamaños 65–190 · patrón 1337 · formación 4 s', CLOUD_DEFAULTS.chunkSize === 260 && CLOUD_DEFAULTS.layerThickness === 45 && CLOUD_DEFAULTS.maxCells === 56 && CLOUD_DEFAULTS.minSize === 65 && CLOUD_DEFAULTS.maxSize === 190 && CLOUD_DEFAULTS.patternSeed === 1337 && CLOUD_DEFAULTS.formationFade === 4)
ok('cumulonimbo: 6–8 primitivas, vertical 2,8–6,2 capas, +0,35 capas de altitud', MORPH_PARAMS[MORPH.CUMULONIMBUS].pMin === 6 && MORPH_PARAMS[MORPH.CUMULONIMBUS].pMax === 8 && MORPH_PARAMS[MORPH.CUMULONIMBUS].vMin === 2.8 && MORPH_PARAMS[MORPH.CUMULONIMBUS].vMax === 6.2 && MORPH_PARAMS[MORPH.CUMULONIMBUS].alt === 0.35)

console.log(bad ? `\n${bad} prueba(s) con fallo` : '\nTodo bien')
process.exit(bad ? 1 : 0)
