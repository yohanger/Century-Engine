// Definición DECLARATIVA de los comandos de evento. Cada comando declara sus parámetros (`params`) y la interfaz del editor
// se genera sola a partir de ellos. La ejecución de cada comando está en interpreter.js (mismo `code`).
//
// Tipos de parámetro: route · text · textarea · code · number · bool · select · switch · variable · selfswitch · scene · node · slot · model · vec3 · color · stringlist
// Campos: key, label, type, def, options [[valor, etiqueta]], min, max, step, when {clave: valor|[valores]|fn}, hint, optional
export { GROUP_ORDER } from './cmd-shared.js'
import { CMD_CORE } from './cmd-core.js'
import { CMD_PARTY } from './cmd-party.js'
import { CMD_PLAYER } from './cmd-player.js'
import { CMD_WORLD } from './cmd-world.js'
import { whenOk, defaults, clone } from './model.js'
import { newMatchCase } from './match.js'

/** `r` = ayudantes de nombres { sw(id), vr(id), scene(id), node(id), db(kind, id) } para los resúmenes. */
export const COMMANDS = {
  ...CMD_CORE,
  ...CMD_PARTY,
  ...CMD_PLAYER,
  ...CMD_WORLD,
}

export const codeLabel = (code) => COMMANDS[code]?.label || code

/** Bloques de un comando según sus parámetros actuales: [{ key, label }]. */
export const blocksOf = (cmd) => {
  const d = COMMANDS[cmd.code]
  return d?.blocks ? d.blocks(cmd.p) : []
}

/** Crea o recorta los bloques para que coincidan con los parámetros (p. ej. al añadir una opción). */
export function syncBlocks(cmd) {
  const want = blocksOf(cmd).map((b) => b.key)
  cmd.b = cmd.b || {}
  for (const k of want) if (!cmd.b[k]) cmd.b[k] = []
  // Al desactivar Default o las ramas de Esperar señal, conservar el contenido para poder recuperarlo.
  if (cmd.code !== 'waitSignal' || cmd.p.flow === true) for (const k of Object.keys(cmd.b)) if (!want.includes(k) && !(cmd.code === 'match' && k === 'default')) delete cmd.b[k]
  return cmd
}

let n = 0
export function newCommand(code, p = null) {
  const d = COMMANDS[code]
  const cmd = { id: 'c' + Date.now().toString(36) + (n++).toString(36), code, p: { ...defaults(d.params), ...(p ? clone(p) : {}) }, b: {} }
  if (code === 'match' && !p?.cases) cmd.p.cases = [newMatchCase()]
  return syncBlocks(cmd)
}

/** Parámetros visibles del comando (aplica `when`). */
export const visibleParams = (code, values) => (COMMANDS[code]?.params || []).filter((q) => whenOk(q.when, values))

/** Resumen de una línea. `r` = ayudantes de nombres. */
export function summaryOf(cmd, r) {
  const d = COMMANDS[cmd.code]
  if (!d) return `Comando desconocido (${cmd.code})`
  try { return d.summary(cmd.p, r) } catch { return '' }
}
