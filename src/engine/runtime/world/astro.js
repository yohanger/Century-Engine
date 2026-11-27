// Astronomía real: sol, luna con fase y planetas a partir de fecha, hora, latitud y longitud. Sin DOM ni THREE.
// Portado del modelo de FrostEngine (autoría del usuario): día juliano, tiempo sidéreo local, elementos orbitales keplerianos
// (Mercurio, Venus, Marte, Júpiter, Saturno), luna con términos de perturbación y fase por separación angular con el sol.
//
// Convención del modelo: este = +X, arriba = +Y, norte = +Z. `toEngine` lo pasa a la del motor (norte = −Z).
//   const a = astroState({ hour, year, day, latitude, longitude, utcOffset })
//   a.sun / a.moon / a.planets[i] → { dir:[x,y,z] (ejes del motor), … }   a.lst (grados) · a.moonIllum (0–1) · a.moonLight (0–0,085)
const RAD = Math.PI / 180, DEG = 180 / Math.PI
const rep = (v) => { v %= 360; return v < 0 ? v + 360 : v }
const repS = (v) => { v = rep(v); return v > 180 ? v - 360 : v }
const sinD = (v) => Math.sin(v * RAD)
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }

const LEAP = (y) => (y % 4 === 0) && (y % 100 !== 0 || y % 400 === 0)
const MDAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/** Día juliano de (año, día del año 1–366, hora local, desfase UTC en horas). */
export function julianDay(year, dayOfYear, localHours, utcOffset = 0) {
  const y0 = clamp(Math.round(year), 1800, 2050)
  const day = clamp(Math.round(dayOfYear), 1, LEAP(y0) ? 366 : 365)
  const raw = localHours - utcOffset
  const utc = ((raw % 24) + 24) % 24
  const shift = raw < 0 ? -1 : raw >= 24 ? 1 : 0
  // fecha civil del día del año, desplazada por el cambio de día UTC
  let rem = day, m = 0
  for (; m < 12; m++) { const n = MDAYS[m] + (m === 1 && LEAP(y0) ? 1 : 0); if (rem <= n) break; rem -= n }
  const d0 = new Date(Date.UTC(y0, Math.min(m, 11), rem + shift))
  let y = d0.getUTCFullYear(), mo = d0.getUTCMonth() + 1; const d = d0.getUTCDate()
  if (mo <= 2) { y -= 1; mo += 12 }
  const a = Math.trunc(y / 100), b = 2 - a + Math.trunc(a / 4)
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (mo + 1)) + d + b - 1524.5 + utc / 24
}

/** Tiempo sidéreo local en grados. */
export function localSidereal(jd, longitude) {
  const t = (jd - 2451545) / 36525
  return rep(280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * t * t - (t * t * t) / 38710000 + longitude)
}

/** (RA, Dec) en grados → dirección unitaria [este, arriba, norte] para esa latitud y tiempo sidéreo. */
export function equatorialToHorizontal(ra, dec, latitude, lst) {
  const lat = latitude * RAD, d = dec * RAD, H = repS(lst - ra) * RAD, cd = Math.cos(d)
  const east = -cd * Math.sin(H)
  const north = Math.cos(lat) * Math.sin(d) - Math.sin(lat) * cd * Math.cos(H)
  const up = Math.sin(lat) * Math.sin(d) + Math.cos(lat) * cd * Math.cos(H)
  const l = Math.hypot(east, north, up) || 1
  return [east / l, up / l, north / l]
}
/** [este, arriba, norte] → ejes del motor (este = +X, arriba = +Y, norte = −Z). */
export const toEngine = (v) => [v[0], v[1], -v[2]]

function solveKepler(Mdeg, e) {
  const m = Mdeg * RAD
  let E = m + e * Math.sin(m) * (1 + e * Math.cos(m))
  for (let i = 0; i < 5; i++) E -= (E - e * Math.sin(E) - m) / Math.max(1e-6, 1 - e * Math.cos(E))
  return E
}

// [a0,a1, e0,e1, i0,i1, L0,L1, peri0,peri1, node0,node1] (por siglo juliano)
const EL = {
  mercury: [0.38709927, 0.00000037, 0.20563593, 0.00001906, 7.00497902, -0.00594749, 252.2503235, 149472.67411175, 77.45779628, 0.16047689, 48.33076593, -0.12534081],
  venus: [0.72333566, 0.0000039, 0.00677672, -0.00004107, 3.39467605, -0.0007889, 181.9790995, 58517.81538729, 131.60246718, 0.00268329, 76.67984255, -0.27769418],
  earth: [1.00000261, 0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668, 100.46457166, 35999.37244981, 102.93768193, 0.32327364, 0, 0],
  mars: [1.52371034, 0.00001847, 0.0933941, 0.00007882, 1.84969142, -0.00813131, -4.55343205, 19140.30268499, -23.94362959, 0.44441088, 49.55953891, -0.29257343],
  jupiter: [5.202887, -0.00011607, 0.04838624, -0.00013253, 1.30439695, -0.00183714, 34.39644051, 3034.74612775, 14.72847983, 0.21252668, 100.47390909, 0.20469106],
  saturn: [9.53667594, -0.0012506, 0.05386179, -0.00050991, 2.48599187, 0.00193609, 49.95424423, 1222.49362201, 92.59887831, -0.41897216, 113.66242448, -0.28867794],
}
function helio(el, t) {
  const a = el[0] + el[1] * t, e = el[2] + el[3] * t, inc = (el[4] + el[5] * t) * RAD
  const L = rep(el[6] + el[7] * t), peri = rep(el[8] + el[9] * t), node = rep(el[10] + el[11] * t)
  const E = solveKepler(rep(L - peri), e)
  const xo = a * (Math.cos(E) - e), yo = a * Math.sqrt(Math.max(0, 1 - e * e)) * Math.sin(E)
  const w = (peri - node) * RAD, N = node * RAD
  const cw = Math.cos(w), sw = Math.sin(w), cN = Math.cos(N), sN = Math.sin(N), cI = Math.cos(inc), sI = Math.sin(inc)
  const x1 = cw * xo - sw * yo, y1 = sw * xo + cw * yo
  return [cN * x1 - sN * cI * y1, sN * x1 + cN * cI * y1, sI * y1]
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const nrm = (a) => { const l = Math.max(1e-9, Math.hypot(a[0], a[1], a[2])); return [a[0] / l, a[1] / l, a[2] / l] }
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

// [id, nombre, color, escala del radio angular, distancia típica, magnitud típica, fase fuerte]
const PLANETS = [
  ['mercury', 'Mercurio', [0.78, 0.75, 0.7], 0.1, 1, -0.4, true],
  ['venus', 'Venus', [1, 0.92, 0.72], 0.13, 1, -4, true],
  ['mars', 'Marte', [1, 0.48, 0.25], 0.08, 1.5, -1, false],
  ['jupiter', 'Júpiter', [1, 0.88, 0.68], 0.1, 5, -2.2, false],
  ['saturn', 'Saturno', [1, 0.82, 0.52], 0.085, 9, 0.3, false],
]
export const PLANET_IDS = PLANETS.map((p) => p[0])

function planet(p, t, earth, lat, lst) {
  const pl = helio(EL[p[0]], t), geo = sub(pl, earth), delta = Math.max(0.05, Math.hypot(...geo))
  const toSun = nrm([-pl[0], -pl[1], -pl[2]]), toEarth = nrm(sub(earth, pl))
  const illum = clamp((1 + clamp(dot(toSun, toEarth), -1, 1)) * 0.5, 0.01, 1)
  const ob = (23.439291 - 0.0130042 * t) * RAD
  const q = [geo[0], geo[1] * Math.cos(ob) - geo[2] * Math.sin(ob), geo[1] * Math.sin(ob) + geo[2] * Math.cos(ob)]
  const ra = rep(Math.atan2(q[1], q[0]) * DEG), dec = Math.atan2(q[2], Math.hypot(q[0], q[1])) * DEG
  const mag = p[5] + 5 * Math.log10(delta / Math.max(0.05, p[4])) + (1 - illum) * (p[6] ? 3.8 : 0.8)
  return { id: p[0], name: p[1], color: p[2], ra, dec, distance: delta, magnitude: mag, illum,
    brightness: clamp(Math.pow(10, -0.2 * (mag + 4.5)), 0.02, 1), radius: clamp(p[3] / delta, 0.015, 0.18),
    dir: toEngine(equatorialToHorizontal(ra, dec, lat, lst)) }
}

/** Sol: (RA, Dec) por longitud eclíptica. */
export function sunEquatorial(jd) {
  const n = jd - 2451545
  const L = rep(280.46 + 0.9856474 * n), g = rep(357.528 + 0.9856003 * n) * RAD
  const lam = rep(L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD
  const ob = (23.439 - 0.0000004 * n) * RAD
  return { ra: rep(Math.atan2(Math.cos(ob) * Math.sin(lam), Math.cos(lam)) * DEG), dec: Math.asin(Math.sin(ob) * Math.sin(lam)) * DEG }
}

/** Luna: (RA, Dec) con perturbaciones principales. */
export function moonEquatorial(jd) {
  const d = jd - 2451543.5
  const node = rep(125.1228 - 0.0529538083 * d), incl = 5.1454, peri = rep(318.0634 + 0.1643573223 * d)
  const ecc = 0.0549, M = rep(115.3654 + 13.0649929509 * d)
  const E = solveKepler(M, ecc)
  const xo = 60.2666 * (Math.cos(E) - ecc), yo = 60.2666 * Math.sqrt(1 - ecc * ecc) * Math.sin(E)
  const rad = Math.hypot(xo, yo), lonO = rep(Math.atan2(yo, xo) * DEG + peri)
  const nR = node * RAD, iR = incl * RAD, lR = lonO * RAD
  const x = rad * (Math.cos(nR) * Math.cos(lR) - Math.sin(nR) * Math.sin(lR) * Math.cos(iR))
  const y = rad * (Math.sin(nR) * Math.cos(lR) + Math.cos(nR) * Math.sin(lR) * Math.cos(iR))
  const z = rad * Math.sin(lR) * Math.sin(iR)
  let lon = Math.atan2(y, x) * DEG, lat = Math.atan2(z, Math.hypot(x, y)) * DEG
  const Ms = rep(356.047 + 0.9856002585 * d), Ls = rep(Ms + rep(282.9404 + 0.0000470935 * d))
  const Lm = rep(node + peri + M), D = repS(Lm - Ls), F = repS(Lm - node)
  lon += -1.274 * sinD(M - 2 * D) + 0.658 * sinD(2 * D) - 0.186 * sinD(Ms) - 0.059 * sinD(2 * M - 2 * D) - 0.057 * sinD(M - 2 * D + Ms) + 0.053 * sinD(M + 2 * D) +
    0.046 * sinD(2 * D - Ms) + 0.041 * sinD(M - Ms) - 0.035 * sinD(D) - 0.031 * sinD(M + Ms) - 0.015 * sinD(2 * F - 2 * D) + 0.011 * sinD(M - 4 * D)
  lat += -0.173 * sinD(F - 2 * D) - 0.055 * sinD(M - F - 2 * D) - 0.046 * sinD(M + F - 2 * D) + 0.033 * sinD(F + 2 * D) + 0.017 * sinD(2 * M + F)
  const lo = lon * RAD, la = lat * RAD, ob = (23.439291 - 0.0000003563 * d) * RAD
  const ex = Math.cos(lo) * Math.cos(la), ey = Math.sin(lo) * Math.cos(la), ez = Math.sin(la)
  const qy = ey * Math.cos(ob) - ez * Math.sin(ob), qz = ey * Math.sin(ob) + ez * Math.cos(ob)
  return { ra: rep(Math.atan2(qy, ex) * DEG), dec: Math.atan2(qz, Math.hypot(ex, qy)) * DEG }
}

/** Sol y luna sin planetas (barato): para el reloj, la luz y los scripts. */
export function sunMoon(jd, latitude, longitude) {
  const lst = localSidereal(jd, longitude)
  const s = sunEquatorial(jd), m = moonEquatorial(jd)
  const sh = equatorialToHorizontal(s.ra, s.dec, latitude, lst), mh = equatorialToHorizontal(m.ra, m.dec, latitude, lst)
  return { lst, sunH: sh, moonH: mh }
}

const elevAz = (h) => ({ elevation: Math.asin(clamp(h[1], -1, 1)) * DEG, azimuth: rep(Math.atan2(h[0], h[2]) * DEG) })

/**
 * Todo el cielo en un instante. `o` = { hour (hora local 0–24), year, day (1–366), latitude, longitude, utcOffset }.
 * Devuelve ejes del motor. Los planetas se calculan siempre (cinco; es barato).
 */
export function astroState(o) {
  const lat = +o.latitude || 0, lon = +o.longitude || 0
  const jd = julianDay(o.year ?? 2026, o.day ?? 172, o.hour ?? 12, o.utcOffset ?? 0)
  const t = (jd - 2451545) / 36525
  const { lst, sunH, moonH } = sunMoon(jd, lat, lon)
  const sunDir = toEngine(sunH), moonDir = toEngine(moonH)
  const cosSep = clamp(dot(sunH, moonH), -1, 1)
  const moonIllum = clamp((1 - cosSep) * 0.5, 0, 1) // iluminación aproximada por separación angular (0 nueva · 1 llena)
  const moonAlt = sstep(0, 1, clamp((moonH[1] + 0.015) * 2.8, 0, 1))
  const earth = helio(EL.earth, t)
  const sun = elevAz(sunH), moon = elevAz(moonH)
  // ángulo de fase firmado: >0 creciente (la luna está al este del sol), <0 menguante
  const sunRaDec = sunEquatorial(jd), moonRaDec = moonEquatorial(jd)
  const waxing = repS(moonRaDec.ra - sunRaDec.ra) > 0
  return {
    jd, lst, latitude: lat,
    sun: { dir: sunDir, ...sun }, moon: { dir: moonDir, ...moon, ra: moonRaDec.ra, dec: moonRaDec.dec },
    moonIllum, moonWaxing: waxing, moonLight: Math.pow(moonIllum, 1.3) * moonAlt * 0.085,
    planets: PLANETS.map((p) => planet(p, t, earth, lat, lst)),
  }
}

/** Nombre de la fase lunar (para mostrar y para scripts). */
export function moonPhaseName(illum, waxing) {
  if (illum < 0.03) return 'Luna nueva'
  if (illum > 0.97) return 'Luna llena'
  if (illum < 0.4) return waxing ? 'Creciente' : 'Menguante'
  if (illum < 0.6) return waxing ? 'Cuarto creciente' : 'Cuarto menguante'
  return waxing ? 'Gibosa creciente' : 'Gibosa menguante'
}

/** Día del año (1–366) de una fecha civil. */
export function dayOfYear(year, month, day) {
  let n = day
  for (let m = 0; m < month - 1; m++) n += MDAYS[m] + (m === 1 && LEAP(year) ? 1 : 0)
  return n
}

/** Suma `n` días enteros a (año, día del año): { year, day }. */
export function addDays(year, day, n) {
  let y = Math.round(year), d = Math.round(day) + Math.floor(n)
  for (let g = 0; g < 400 && d > (LEAP(y) ? 366 : 365); g++) { d -= LEAP(y) ? 366 : 365; y++ }
  for (let g = 0; g < 400 && d < 1; g++) { y--; d += LEAP(y) ? 366 : 365 }
  return { year: clamp(y, 1800, 2050), day: d }
}
