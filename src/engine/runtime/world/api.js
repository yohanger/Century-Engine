// API de scripting del mundo: game.clock (hora) y game.weather (clima, viento). Sin DOM: recibe el World por una función.
//
//   game.clock.hour               hora actual 0–24 (lectura y escritura)      game.clock.text   "14:30"
//   game.clock.set(20, 5)         pasa a las 20:00 (en 5 s si se indica; el sol siempre avanza, no retrocede)
//   game.clock.flow(true, 12)     el tiempo transcurre (12 minutos reales por día)    game.clock.flow(false) lo detiene
//   game.clock.isNight / sunElevation
//   game.clock.setDate(172, 2026)  elige el día del año (y el año): activa la astronomía real (sol, luna con fases, planetas, estrellas)
//   game.clock.day · year · moon → { illumination 0–1, name, waxing, elevation, azimuth } · planets → [{ name, elevation, azimuth, magnitude }]
//   game.weather.set("rain", 0.8, 10)   cambia a lluvia al 80 % en 10 s        game.weather.preset · intensity · list
//   game.weather.wind             { speed, dir, x, z } en este instante · game.weather.beaufort → [n, "Fresco"]
//   game.weather.raining / snowing / foggy
//   game.weather.visibility (m, Infinity sin niebla) · visibilityAt(y) a esa altura
//   game.weather.cloudModel ('classic' | 'cells') · cloudCoverage (0–1) · sunTransmission (0–1) · precipitationAt(x, z) (mm/h) · nearestStorm(maxDistance)
//   game.weather.temperature (°C) · humidity (0–1) · precipitation (mm/h)      game.weather.auto(true) el tiempo cambia solo · game.weather.next(10) pasa ya al siguiente
//   game.weather.strike({distance: 800, bearing: 90})  lanza un rayo (bearing: hacia dónde, 0 = norte; con «Rayos físicos» se ve el canal) (destello + trueno tras distance/343 s) · game.weather.muteSounds(true)
//   game.weather.thunderRegion (acústica donde está el oyente) · game.weather.occlusion (0–1) · game.weather.setOcclusion(0.8 | null)
//   game.on("lightning", (e) => …) · game.on("thunder", (e) => …)   e = { distance, delay, bearing, peak }; el trueno procedural añade { region, occlusion, loudness }
import { WEATHER_IDS } from './weather.js'
import { beaufort } from './weather.js'
import { formatHour } from './world.js'
import { moonPhaseName } from './astro.js'

export function makeWorldApi(get, getSound, getEnv) {
  const W = () => get?.()
  const M = () => getSound?.()
  return {
    clock: {
      get hour() { return W()?.hour ?? 12 }, set hour(v) { W()?.setHour(+v) },
      get text() { return formatHour(W()?.hour ?? 12) },
      set: (h, seconds = 0) => W()?.setHour(+h, +seconds || 0),
      flow: (on = true, dayMinutes) => W()?.setFlow(!!on, dayMinutes),
      get running() { return !!W()?.flow },
      get isNight() { return (W()?.frame().night ?? 0) > 0.5 },
      get sunElevation() { return W()?.frame().sunElevation ?? 90 },
      setDate: (day, year) => { W()?.setDate(day, year) },
      get day() { return W()?.date().day ?? 1 },
      get year() { return W()?.date().year ?? 2026 },
      get moon() {
        const w = W(), a = w?.frame().astro
        if (!a) return { illumination: 1, name: 'Luna llena', waxing: true, elevation: w?.frame().moonElevation ?? -90, azimuth: 0 }
        return { illumination: a.moonIllum, name: moonPhaseName(a.moonIllum, a.moonWaxing), waxing: a.moonWaxing, elevation: a.moon.elevation, azimuth: a.moon.azimuth }
      },
      get planets() { return (W()?.frame().astro?.planets || []).map((p) => { const d = p.dir; return { name: p.name, elevation: Math.asin(Math.max(-1, Math.min(1, d[1]))) * 180 / Math.PI, azimuth: (Math.atan2(d[0], -d[2]) * 180 / Math.PI + 360) % 360, magnitude: p.magnitude } }) },
    },
    weather: {
      set: (id, intensity = 1, seconds = 0) => !!W()?.setWeather(String(id), intensity, +seconds || 0),
      get preset() { return W()?.preset ?? 'clear' },
      get intensity() { return W()?.intensity ?? 0 },
      get list() { return [...WEATHER_IDS] },
      get wind() { const w = W()?.frame().wind; return w ? { ...w } : { speed: 0, dir: 0, x: 0, z: 0 } },
      /** Viento local en (x, z) tras aplicar obstáculos del bloque F. { speed, dir, x, z, factor } */
      windAt: (x = 0, z = 0) => { const wld = W(); if (!wld) return { speed: 0, dir: 0, x: 0, z: 0, factor: 1 }; return wld.windAt(+x || 0, +z || 0) },
      get beaufort() { return beaufort(W()?.frame().wind.speed ?? 0) },
      get raining() { return (W()?.rainLevel ?? 0) > 0.05 },
      get snowing() { return (W()?.snowLevel ?? 0) > 0.05 },
      get foggy() { return (W()?.cur.fog ?? 0) > 0.01 },
      get temperature() { return W()?.frame().temperature ?? 24 },
      get humidity() { return W()?.frame().humidity ?? 0.5 },
      get precipitation() { return W()?.frame().precipMm ?? 0 },
      get cloudModel() { return W()?.cellsOn ? 'cells' : 'classic' },
      get cloudCoverage() { return W()?.skyCover ?? 0 },
      get sunTransmission() { return W()?.sunTransmission ?? 1 },
      precipitationAt: (x = 0, z = 0) => W()?.precipitationAt(x, z) ?? 0,
      nearestStorm: (maxDistance = 8000) => W()?.nearestStorm(maxDistance) ?? null,
      get visibility() { return W()?.visibility(0, getEnv?.()) ?? Infinity },
      visibilityAt: (y = 0) => W()?.visibility(+y || 0, getEnv?.()) ?? Infinity,
      get tornado() { const t=W()?.tornado; return t ? {...t} : null },
      startTornado: (options = {}) => W()?.startTornado(options) ?? false,
      modifyTornado: (options = {}) => W()?.modifyTornado(options) ?? false,
      stopTornado: (immediate = false) => W()?.stopTornado(immediate) ?? false,
      get autoChange() { return !!W()?.directorOn },
      auto: (on = true) => { W()?.setAuto(on) },
      next: (seconds = 0) => W()?.nextWeather(+seconds || 0) ?? null,
      strike: (o) => W()?.strike(typeof o === 'number' ? o : o?.distance, typeof o === 'object' ? o?.bearing : undefined) ?? null,
      muteSounds: (on = true) => { M()?.mute(on) },
      get soundsMuted() { return !!M()?.muted },
      get thunderRegion() { return M()?.region.id ?? 'open' },
      get occlusion() { return M()?.occlusion ?? 0 },
      setOcclusion: (v) => { M()?.setOcclusion(v) },
    },
  }
}
