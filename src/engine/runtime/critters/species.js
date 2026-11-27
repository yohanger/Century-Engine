// Registro de especies de animales («clusters»). Añadir una especie = crear critters/<especie>.js que llame a registerSpecies() y
// importarlo en critters/index.js. El sistema (system.js) no sabe de luciérnagas: solo de agentes, de una máquina de estados y de
// cómo dibujarlos.
//
//   registerSpecies({
//     id, label,
//     params: [...],               // parámetros declarados (los mismos que ParamForm: key, label, type, min, max, step, def, hint)
//     machine: StateMachine,       // IA: estados y transiciones
//     init(a, cl, rnd),            // da valores iniciales a un agente (cl = el cluster: centro, radio, parámetros)
//     step(a, dt, cl, ctx),        // movimiento y comportamiento continuo del estado (se llama tras machine.tick)
//     groupStep?(cl, dt, ctx),     // una vez por fotograma y cluster (p. ej. el campo medio de la sincronización)
//     look: { color, size, blend } // cómo se pinta (puntos con halo, aditivo)
//   })
const species = new Map()
export function registerSpecies(def) { species.set(def.id, def); return def }
export const getSpecies = (id) => species.get(id)
export const allSpecies = () => [...species.values()]
export const SPECIES_LIST = () => allSpecies().map((s) => [s.id, s.label])

/** Valores de los parámetros de una especie con lo que falte por defecto, y limitados a su rango. */
export function normalizeCritter(props, id = props?.species || 'firefly') {
  const sp = species.get(id) || species.values().next().value
  const out = { species: sp.id }
  for (const p of sp.params) {
    let v = props?.[p.key]
    if (p.type === 'number') { v = Number.isFinite(+v) && v !== '' && v !== null ? +v : p.def; if (p.min !== undefined) v = Math.max(p.min, v); if (p.max !== undefined) v = Math.min(p.max, v) }
    else if (p.type === 'bool') v = v === undefined ? p.def : !!v
    else if (p.type === 'color') v = /^#[0-9a-f]{6}$/i.test(v || '') ? v : p.def
    else if (p.type === 'select') v = p.options.some((o) => o[0] === v) ? v : p.def
    else v = v ?? p.def
    out[p.key] = v
  }
  return out
}
