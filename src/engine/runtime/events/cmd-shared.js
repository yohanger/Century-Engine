// Ayudas compartidas por las definiciones de comandos (commandDefs.js y cmd-*.js): grupos, operadores, ranuras de guardado, animación, recorte de texto.
import { ANIM_IN, ANIM_OUT } from '../ui/anim.js'

export const G = { MSG: 'Mensajes', FLOW: 'Flujo', DATA: 'Datos', DB: 'Personajes e inventario', PLAYER: 'Jugador y escena', WORLD: 'Mundo', AUDIO: 'Audio', ADV: 'Avanzado' }
export const GROUP_ORDER = [G.MSG, G.FLOW, G.DATA, G.DB, G.PLAYER, G.WORLD, G.AUDIO, G.ADV]

export const OPS = [['set', '= (asignar)'], ['add', '+ (sumar)'], ['sub', '− (restar)'], ['mul', '× (multiplicar)'], ['div', '÷ (dividir)'], ['mod', '% (resto)']]
/** Parámetros «ranura de guardado» (constante, variable, la última o el autoguardado). */
export const slotParams = (when = {}) => [
  { key: 'slotSrc', label: 'Ranura', type: 'select', def: 'const', options: [['const', 'Número'], ['variable', 'Variable'], ['last', 'La última usada'], ['auto', 'Autoguardado (0)']], when },
  { key: 'slot', label: 'Número de ranura', type: 'number', def: 1, min: 0, max: 99, step: 1, when: { ...when, slotSrc: 'const' } },
  { key: 'slotVar', label: 'Variable con la ranura', type: 'variable', def: 1, when: { ...when, slotSrc: 'variable' } },
]
export const slotText = (p, r) => ({ const: `ranura ${p.slot}`, variable: `ranura ${r.vr(p.slotVar)}`, last: 'la última ranura', auto: 'el autoguardado' }[p.slotSrc || 'const'])
export const CMPS = [['>=', '≥'], ['>', '>'], ['==', '='], ['<=', '≤'], ['<', '<'], ['!=', '≠']]
export const VCMPS = [...CMPS, ['has', 'contiene (lista o texto)'], ['nhas', 'no contiene']]
/** Animación de entrada y salida elegida en el comando (ui/anim.js). Vacío = la de la interfaz. */
export const ANIM_PARAMS = [
  { key: 'enter', label: 'Animación de entrada', type: 'select', def: '', options: ANIM_IN },
  { key: 'exit', label: 'Animación de salida', type: 'select', def: '', options: ANIM_OUT },
  { key: 'animTime', label: 'Duración de la animación (s)', type: 'number', def: 0.25, min: 0, max: 3, step: 0.05, when: { $: (v) => !!(v.enter && v.enter !== 'none') || !!(v.exit && v.exit !== 'none') } },
]
export const animSummary = (p) => (p.enter || p.exit ? ' · ✦' : '')
export const q = (s, n = 38) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s }

