// Herramientas SOLO del editor (edición de mallas, comandos y menús, captura de movimiento, Nether Film Maker).
// El editor (src/main.js) las registra al arrancar; el juego exportado (runtime.html) no, así que su paquete no las lleva.
// Así el motor las usa sin importarlas: `tool('mesh').EditSession`. La API sigue siendo síncrona (no hay import dinámico).
//   registerTools({ mesh, commands, capture, film })  ·  tool('mesh')  ·  hasTool('mesh')
const reg = {}
export function registerTools(obj) { Object.assign(reg, obj) }
export const hasTool = (name) => !!reg[name]
/** Módulo de una herramienta del editor. Error claro si esta app no la registró (p. ej. el juego exportado). */
export function tool(name) {
  const t = reg[name]
  if (!t) throw new Error(`La herramienta «${name}» solo existe en el editor (no está registrada en esta aplicación)`)
  return t
}
