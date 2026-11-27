// Catálogo estelar como atlas de cubo (world/starcat.js): geometría de caras, extracción de estrellas, posición exacta y cobertura de la búsqueda 3×3 del shader.
// Uso: node scripts/test-starcat.mjs   (sin DOM)
import { unzlibSync } from 'three/examples/jsm/libs/fflate.module.js'
import { STARS_B64 } from '../src/engine/runtime/world/astro-data.js'
import { STAR_N, FACE_AXIS, FACE_RIGHT, FACE_UP, dirToFace, faceToDir, starList, buildStarAtlas } from '../src/engine/runtime/world/starcat.js'

let bad = 0
const ok = (name, cond, extra = '') => { if (!cond) bad++; console.log((cond ? '  OK  ' : ' FALLA ') + name + (extra !== '' ? `  [${extra}]` : '')) }
const mulberry = (a) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const rnd = mulberry(11), RAD = Math.PI / 180
const ang = (a, b) => 2 * Math.asin(Math.min(1, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / 2))   // por la cuerda: el acos pierde precisión cerca de 0
const eq = (raDeg, decDeg) => { const r = raDeg * RAD, d = decDeg * RAD; return [Math.cos(d) * Math.cos(r), Math.cos(d) * Math.sin(r), Math.sin(d)] }
const unb64 = (s) => Uint8Array.from(Buffer.from(s, 'base64'))
const sd = unzlibSync(unb64(STARS_B64))

console.log('Geometría de las seis caras')
{ let worst = 0, bad2 = 0
  for (let i = 0; i < 20000; i++) {
    let v = [rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1]; const l = Math.hypot(...v); if (l < 1e-3) continue; v = v.map((c) => c / l)
    const { f, u, v: w } = dirToFace(...v), b = faceToDir(f, u, w)
    worst = Math.max(worst, ang(v, b)); if (Math.abs(u) > 1 + 1e-12 || Math.abs(w) > 1 + 1e-12) bad2++
  }
  ok('dirección → cara → dirección: error < 1e-9 rad', worst < 1e-9, worst.toExponential(2))
  ok('u, v quedan siempre dentro de [−1, 1] en la cara elegida', bad2 === 0, bad2) }
ok('ejes, derechas y arriba forman un triedro ortonormal en cada cara', FACE_AXIS.every((n, f) => { const r = FACE_RIGHT[f], u = FACE_UP[f]; const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; return dot(n, r) === 0 && dot(n, u) === 0 && dot(r, u) === 0 && dot(n, n) === 1 })
  && [0, 1, 2, 3, 4, 5].every((f) => { const n = FACE_AXIS[f], r = FACE_RIGHT[f], u = FACE_UP[f]; return faceToDir(f, 0, 0).every((c, k) => Math.abs(c - n[k]) < 1e-12) && r && u }))
{ // el tamaño angular de un texel varía poco: 0,65–1,0 del nominal
  const nominal = (2 / STAR_N) * (Math.PI / 4); let mn = 9, mx = 0       // tamaño del texel en el centro de una cara
  for (let f = 0; f < 6; f++) for (const [u, v] of [[0, 0], [0.99, 0], [0, 0.99], [0.99, 0.99], [-0.99, -0.99], [0.5, 0.3]]) {
    const a = faceToDir(f, u, v), b = faceToDir(f, u + 2 / STAR_N, v), c = faceToDir(f, u, v + 2 / STAR_N)
    mn = Math.min(mn, ang(a, b) / nominal, ang(a, c) / nominal); mx = Math.max(mx, ang(a, b) / nominal, ang(a, c) / nominal)
  }
  ok('texels de tamaño casi uniforme (0,70–1,0 del nominal en toda la esfera; el menor ≈ 0,0044 rad)', mn > 0.70 && mx <= 1.0001, `${mn.toFixed(3)}–${mx.toFixed(3)} · menor ${(mn * nominal).toFixed(4)} rad`) }

console.log('Extracción de estrellas y atlas')
const list = starList(sd), atlas = buildStarAtlas(sd)
ok('el catálogo distribuido tiene 9 479 texels con brillo', (() => { let n = 0; for (let i = 3; i < sd.length; i += 4) if (sd[i] > 0) n++; return n })() === 9479)
ok('se reconocen 8 611 estrellas (el resto es el halo 3×3 de las brillantes)', list.length === 8611, list.length)
ok('atlas: 8 586 colocadas y 25 tenues fusionadas con una vecina en su texel', atlas.count === 8586 && atlas.dropped === 25 && atlas.count + atlas.dropped === list.length, `${atlas.count} + ${atlas.dropped}`)
ok(`dimensiones del atlas: ${6 * STAR_N}×${STAR_N} RGBA8 + RG8`, atlas.width === 6 * STAR_N && atlas.height === STAR_N && atlas.color.length === atlas.width * atlas.height * 4 && atlas.off.length === atlas.width * atlas.height * 2)
{ const per = new Array(6).fill(0); for (let f = 0; f < 6; f++) for (let j = 0; j < STAR_N; j++) for (let i = 0; i < STAR_N; i++) if (atlas.color[(j * atlas.width + f * STAR_N + i) * 4 + 3] > 0) per[f]++
  ok('las seis caras tienen estrellas (800–2 000 cada una)', per.every((n) => n > 800 && n < 2000), per.join(' · ')) }
// cada texel ocupado se decodifica a una de las estrellas del catálogo (posición exacta dentro del texel, 8 bits)
{ const stars = list.map((s) => ({ s, d: eq(s.ra / RAD, s.dec / RAD) })); let worst = 0, n = 0
  const byKey = new Map(); for (const { s, d } of stars) { const { f, u, v } = dirToFace(...d), k = `${f},${Math.min(STAR_N - 1, Math.floor((u * 0.5 + 0.5) * STAR_N))},${Math.min(STAR_N - 1, Math.floor((v * 0.5 + 0.5) * STAR_N))}`; if (!byKey.has(k) || byKey.get(k).a < s.a) byKey.set(k, { d, a: s.a }) }
  for (let f = 0; f < 6; f++) for (let j = 0; j < STAR_N; j++) for (let i = 0; i < STAR_N; i++) {
    const t = j * atlas.width + f * STAR_N + i
    if (atlas.color[t * 4 + 3] === 0) continue
    const u = ((i + atlas.off[t * 2] / 255) / STAR_N) * 2 - 1, v = ((j + atlas.off[t * 2 + 1] / 255) / STAR_N) * 2 - 1
    const dec = faceToDir(f, u, v), orig = byKey.get(`${f},${i},${j}`)
    if (!orig) { worst = 9; continue }
    worst = Math.max(worst, ang(dec, orig.d) / RAD); n++
  }
  ok(`${n} texels ocupados: la posición decodificada coincide con la del catálogo (< 0,01°)`, worst < 0.01 && n === atlas.count, `${worst.toFixed(4)}°`) }
{ const near = (raDeg, decDeg, rad) => { const t = eq(raDeg, decDeg); return list.filter((s) => ang(eq(s.ra / RAD, s.dec / RAD), t) < rad * RAD) }
  const sirius = near(101.287, -16.716, 0.6), polaris = near(37.95, 89.26, 1.2), vega = near(279.234, 38.784, 0.6), canopus = near(95.988, -52.696, 0.6)
  ok('Sirio: una sola estrella a menos de 0,6° (el halo 3×3 no cuenta como estrellas)', sirius.length === 1 && sirius[0].a > 200, sirius.map((s) => s.a))
  ok('Vega y Canopus presentes y brillantes', vega.length === 1 && vega[0].a > 150 && canopus.length === 1 && canopus[0].a > 150, `${vega.map((s) => s.a)} · ${canopus.map((s) => s.a)}`)
  ok('Polaris presente a menos de 1,2° de su posición (el catálogo la cuantiza a su texel de 0,35°)', polaris.length >= 1 && Math.max(...polaris.map((s) => s.a)) > 40, polaris.map((s) => s.a)) }

console.log('Cobertura de la búsqueda 3×3 del shader')
// Réplica en JS del bucle de catalogStars(): vecinos en el espacio de la cara del píxel; los que se salen caen en la cara contigua.
const stars8 = []; for (let f = 0; f < 6; f++) for (let j = 0; j < STAR_N; j++) for (let i = 0; i < STAR_N; i++) { const t = j * atlas.width + f * STAR_N + i; if (atlas.color[t * 4 + 3] > 0) stars8.push({ f, i, j, t }) }
const found = (e) => {
  const { f, u, v } = dirToFace(...e), c0 = [Math.floor((u * 0.5 + 0.5) * STAR_N), Math.floor((v * 0.5 + 0.5) * STAR_N)], out = new Set()
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const q = [((c0[0] + di + 0.5) / STAR_N) * 2 - 1, ((c0[1] + dj + 0.5) / STAR_N) * 2 - 1], dn = faceToDir(f, q[0], q[1]), r = dirToFace(...dn)
    const i2 = Math.min(STAR_N - 1, Math.max(0, Math.floor((r.u * 0.5 + 0.5) * STAR_N))), j2 = Math.min(STAR_N - 1, Math.max(0, Math.floor((r.v * 0.5 + 0.5) * STAR_N)))
    out.add(j2 * atlas.width + r.f * STAR_N + i2)
  }
  return out
}
{ const RMAX = 0.0044; let miss = 0, tot = 0
  for (let k = 0; k < 40000; k++) {
    const s = stars8[Math.floor(rnd() * stars8.length)], u = ((s.i + atlas.off[s.t * 2] / 255) / STAR_N) * 2 - 1, v = ((s.j + atlas.off[s.t * 2 + 1] / 255) / STAR_N) * 2 - 1
    const c = faceToDir(s.f, u, v)
    // un píxel a una distancia aleatoria ≤ RMAX de la estrella, en una dirección aleatoria del plano tangente
    let a = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]; const dp = a[0] * c[0] + a[1] * c[1] + a[2] * c[2]; a = a.map((x, n) => x - dp * c[n]); const l = Math.hypot(...a); a = a.map((x) => x / l)
    const r = RMAX * Math.sqrt(rnd()), e = c.map((x, n) => x * Math.cos(r) + a[n] * Math.sin(r))
    tot++; if (!found(e).has(s.t)) miss++
  }
  ok(`${tot} píxeles a ≤ ${RMAX} rad de una estrella: la búsqueda 3×3 siempre la encuentra`, miss === 0, `fallos ${miss}`) }
{ // peor caso: estrellas pegadas a las esquinas y aristas de las caras
  let miss = 0, tot = 0
  const edge = stars8.filter((s) => s.i < 3 || s.j < 3 || s.i > STAR_N - 4 || s.j > STAR_N - 4)
  for (const s of edge) for (let k = 0; k < 20; k++) {
    const u = ((s.i + atlas.off[s.t * 2] / 255) / STAR_N) * 2 - 1, v = ((s.j + atlas.off[s.t * 2 + 1] / 255) / STAR_N) * 2 - 1, c = faceToDir(s.f, u, v)
    let a = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]; const dp = a[0] * c[0] + a[1] * c[1] + a[2] * c[2]; a = a.map((x, n) => x - dp * c[n]); const l = Math.hypot(...a); a = a.map((x) => x / l)
    const r = 0.0044 * Math.sqrt(rnd()), e = c.map((x, n) => x * Math.cos(r) + a[n] * Math.sin(r)); tot++; if (!found(e).has(s.t)) miss++
  }
  ok(`${edge.length} estrellas en el borde de una cara (${tot} pruebas): también se encuentran`, miss === 0 && tot > 1000, `fallos ${miss}/${tot}`) }

console.log('\nRESULTADO:', bad ? `${bad} FALLOS` : 'OK'); process.exit(bad ? 1 : 0)
