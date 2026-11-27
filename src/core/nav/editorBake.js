// Horneado del editor y del Player: un mismo algoritmo y mundo Jolt temporal.
// El resultado nunca escribe Assets. La publicación de un mapa es responsabilidad de su propietario.
import { bakeNavRegion as bakeRegion } from '../../engine/runtime/nav/bake.js'
import { navBounds } from '../../engine/runtime/nodes/navigation.js'
export function bakeNavRegion(options) {
  return bakeRegion({ ...options, bounds: navBounds(options.obj) })
}
