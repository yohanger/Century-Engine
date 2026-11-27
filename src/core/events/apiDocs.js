// Documentación de game.* leída de game-api.d.ts (la fuente única de la API de scripts).
// La usa el editor de scripts interno para sus sugerencias; la extensión de VS Code usa el mismo .d.ts directamente (TypeScript).
import apiDts from './game-api.d.ts?raw'
import { parseInterface, propertyType } from './apiParse.js'

export const GAME_API_DTS = apiDts
export { parseInterface, propertyType }

/** Miembros de game.* y, para cada propiedad con tipo propio (game.viewModel, game.player…), los de ese tipo. */
export function gameApi() {
  const top = parseInterface(apiDts, 'Game')
  const nested = {}
  for (const e of top) {
    const t = e.property && propertyType(e)
    if (t) { const members = parseInterface(apiDts, t); if (members.length) nested[e.name] = members }
  }
  return { top, nested }
}
