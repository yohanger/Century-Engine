// Sonido del clima en el modo Jugar: la sonda de oclusión (rayos de sonido). Lo usa world/sound.js (WeatherAudio) para saber si el oyente está
// bajo un techo o junto a paredes; el trueno procedural pierde agudos y volumen con ella (world/thunder.js::occlusionFilter).
import { probeOcclusion } from '../world/thunder.js'

const REACH = 40 // m: un rayo que choca antes de esta distancia cuenta como tapado

export const weatherMethods = {
  /** Oclusión 0–1 en el oído del jugador: 9 rayos (arriba y 8 a 50°) y, si se da el rumbo del rayo, uno hacia él. */
  _soundOcclusion(bearing = null) {
    const cam = this.cam; if (!cam?.matrixWorld) return 0
    const m = cam.matrixWorld.elements, o = [m[12], m[13], m[14]]
    return probeOcclusion((dir) => !!this._castOnce(o, dir, REACH), bearing)
  },
}
