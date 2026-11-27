// Astronomía sencilla pero real: posición del sol y de la luna a partir de la hora, la latitud y la época del año.
// Convención del motor: norte = −Z, este = +X; azimut en grados desde el norte hacia el este; elevación sobre el horizonte.
// Sin DOM ni THREE.

const RAD = Math.PI / 180

/** Declinación solar (°) del día del año (1–365): ±23,44° entre solsticios. */
export const declination = (dayOfYear) => 23.44 * Math.sin(2 * Math.PI * (284 + dayOfYear) / 365)

/** Posición del sol: { elevation, azimuth } en grados. `hour` 0–24 (hora solar: 12 = mediodía). */
export function solarPosition(hour, latitude = 20, dayOfYear = 172) {
  const phi = latitude * RAD, dec = declination(dayOfYear) * RAD, h = (hour - 12) * 15 * RAD
  const sinEl = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(h)
  const el = Math.asin(Math.max(-1, Math.min(1, sinEl)))
  // azimut medido desde el sur hacia el oeste → desde el norte hacia el este
  const azS = Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi))
  const az = (((azS / RAD + 180) % 360) + 360) % 360
  return { elevation: el / RAD, azimuth: az }
}

/** Dirección unitaria HACIA el astro, en ejes del motor. */
export function directionOf(elevation, azimuth) {
  const e = elevation * RAD, a = azimuth * RAD
  return [Math.cos(e) * Math.sin(a), Math.sin(e), -Math.cos(e) * Math.cos(a)]
}

/** La luna sale cuando se pone el sol (con un pequeño desfase: no es siempre luna llena exacta) y recorre la bóveda contraria. */
export function lunarPosition(hour, latitude = 20, dayOfYear = 172, lag = 1.2) {
  return solarPosition(hour + 12 - lag, latitude, ((dayOfYear + 182 - 1) % 365) + 1)
}

/** Longitud del día (horas de sol) en esa latitud y fecha; 0 = noche polar, 24 = sol de medianoche. */
export function dayLength(latitude, dayOfYear) {
  const x = -Math.tan(latitude * RAD) * Math.tan(declination(dayOfYear) * RAD)
  if (x >= 1) return 0
  if (x <= -1) return 24
  return (2 * Math.acos(x)) / RAD / 15
}

export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
