// Modelo de datos de los eventos (estilo RPG Maker MZ). Sin DOM ni three: se usa igual en el editor, el runtime y las pruebas.
//
//  Nodo «Evento» (props):  { reach, pages: [Página] }
//  Página:  { id, name, cond, graphic, trigger, solid, list: [Comando] }
//  Comando: { id, code, p: {parámetros}, b: { bloque: [Comando] } }      (los bloques anidan: si / opciones / bucle)
//
// Toda la interfaz de edición (condiciones, gráfico, parámetros de cada comando) se GENERA a partir de listas de
// parámetros declarados (ver commandDefs.js), no hay formularios hechos a mano por comando.
import { uid } from '../util.js'
import { GRAPHIC_DB_KINDS, GRAPHIC_DB_LABELS } from '../database/models.js'
import { defaultIndicatorZones, normalizeIndicatorZones } from '../interaction/volumes.js'

export const TRIGGERS = [
  ['action', 'Botón de acción', 'Se ejecuta al pulsar E (o clic) estando dentro de su alcance'],
  ['touch', 'Contacto con el jugador', 'Se ejecuta al entrar el jugador en la zona del evento'],
  ['auto', 'Ejecución automática', 'Se ejecuta sola y bloquea al jugador mientras la página esté activa (se repite)'],
  ['parallel', 'Proceso paralelo', 'Se ejecuta en segundo plano sin bloquear al jugador (se repite)'],
  ['input', 'Al pulsar una acción', 'Se ejecuta al pulsar (o soltar) una acción del Input Map o una tecla, esté donde esté el jugador. Úsalo para atajos globales'],
  ['signal', 'Al recibir señal', 'Se ejecuta en segundo plano cuando un script (game.emit) u otro evento (Emitir señal) envía la señal. Si la página ya se está ejecutando, la señal se ignora'],
  ['look', 'Al mirarlo', 'Se ejecuta cuando el jugador mira el círculo amarillo; no necesita acercarse a la zona'],
]

/** «El jugador debe mirar»: esfera (círculo amarillo en la vista previa) a `offset` del evento. Aplica a Acción, Contacto y «Al mirarlo». */
export const GAZE_PARAMS = [
  { key: 'on', label: 'El jugador debe mirarlo', type: 'bool', def: false },
  { key: 'offset', label: 'Punto a mirar (m, desde el evento)', type: 'vec3', def: [0, 0, 0], when: { on: true } },
  { key: 'radius', label: 'Radio del círculo (m)', type: 'number', def: 0.5, min: 0.05, max: 20, step: 0.05, when: { on: true } },
  { key: 'distance', label: 'Distancia máxima (m)', type: 'number', def: 8, min: 0.5, max: 200, step: 0.5, when: { on: true } },
  { key: 'hold', label: 'Mantener la mirada (s)', type: 'number', def: 0, min: 0, max: 30, step: 0.1, when: { on: true } },
  { key: 'occlude', label: 'Bloqueado por paredes', type: 'bool', def: true, when: { on: true } },
]

/** Movimiento autónomo (como MZ): tipo, velocidad y frecuencia. Con «custom» se repite la ruta. */
export const MOVE_TYPES = [['fixed', 'Fijo'], ['random', 'Aleatorio'], ['approach', 'Acercarse al jugador'], ['custom', 'Personalizado (ruta)']]
export const SPEEDS = [[1, '1: muy lenta'], [2, '2: lenta'], [3, '3: normal'], [4, '4: rápida'], [5, '5: muy rápida'], [6, '6: veloz']]
export const SPEED_MPS = [0, 0.7, 1.2, 2, 3, 4.5, 6.5] // m/s por nivel de velocidad
export const FREQS = [[1, '1: muy baja'], [2, '2: baja'], [3, '3: normal'], [4, '4: alta'], [5, '5: muy alta']]
export const MOVE_PARAMS = [
  { key: 'type', label: 'Tipo', type: 'select', def: 'fixed', options: MOVE_TYPES },
  { key: 'speed', label: 'Velocidad', type: 'select', def: 3, options: SPEEDS, when: { type: ['random', 'approach', 'custom'] } },
  { key: 'freq', label: 'Frecuencia', type: 'select', def: 3, options: FREQS, when: { type: ['random', 'approach', 'custom'] } },
  { key: 'range', label: 'Radio de vagabundeo (m)', type: 'number', def: 4, min: 0.5, max: 100, step: 0.5, when: { type: 'random' } },
]

/** Opciones de la página (MZ: Walking / Stepping / Direction fix / Through). Adaptadas a 3D. */
/** Qué puede hacer el jugador mientras la página se ejecuta (eventos de acción, contacto, automáticos y «al mirarlo»). */
export const DURING_MODES = [
  ['locked', 'Bloqueado: puede mirar, no moverse'],
  ['free', 'Libre: puede moverse (el evento sigue)'],
  ['frozen', 'Congelado: ni moverse ni mirar'],
  ['face', 'Mirando al evento: bloqueado y la cámara se gira hacia él'],
]
export const OPTION_PARAMS = [
  { key: 'during', label: 'Jugador durante el evento', type: 'select', def: 'locked', options: DURING_MODES, hint: 'Como en RPG Maker el jugador queda quieto mientras corre el evento; aquí puedes elegir otro comportamiento. Con opciones de diálogo abiertas el movimiento siempre se detiene.' },
  { key: 'face', label: 'Girarse hacia el jugador al activarse', type: 'bool', def: false },
  { key: 'dirFix', label: 'Dirección fija (no gira al moverse)', type: 'bool', def: false },
  { key: 'through', label: 'Atravesable (sin colisión)', type: 'bool', def: false },
  { key: 'alwaysOn', label: 'Siempre por encima (sin ocultarse al jugar)', type: 'bool', def: false },
]

// Conserva las claves de las páginas existentes y expone las siete geometrías del catálogo.
export const GRAPHIC_KINDS = [
  ['none', 'Ninguno'], ['box', 'Caja'], ['sphere', 'Esfera'], ['cylinder', 'Cilindro'],
  ['cone', 'Cono'], ['plane', 'Plano'], ['ramp', 'Rampa'], ['stairs', 'Escaleras'], ['model', 'Modelo del proyecto'], ['prefab', 'Prefab'],
  ['sprite', 'Sprite (imagen)'],
]
// Gráficos que leen un registro de la base de datos (Personaje, Enemigo, Objeto, Arma, Armadura): el modelo sale del registro.
GRAPHIC_KINDS.push(...GRAPHIC_DB_LABELS)
const GRAPHIC_PRIMITIVES = GRAPHIC_KINDS.filter(([kind]) => kind !== 'none' && kind !== 'model' && kind !== 'prefab' && kind !== 'sprite' && !GRAPHIC_DB_KINDS[kind]).map(([kind]) => kind)


/** Condiciones de página: cada una es opcional (0 / vacío = no se comprueba). */
export const COND_PARAMS = [
  { key: 'sw1', label: 'Interruptor', type: 'switch', optional: true },
  { key: 'sw2', label: 'Interruptor', type: 'switch', optional: true },
  { key: 'vr', label: 'Variable', type: 'variable', optional: true },
  { key: 'vrOp', label: 'Comparación', type: 'select', def: '>=', options: [['>=', '≥'], ['>', '>'], ['==', '='], ['<=', '≤'], ['<', '<'], ['!=', '≠']], when: { vr: (v) => v > 0 } },
  { key: 'vrVal', label: 'Valor', type: 'number', def: 0, step: 1, when: { vr: (v) => v > 0 } },
  { key: 'item', label: 'Objeto', type: 'ref', kind: 'items', optional: true, def: 0 },
  { key: 'actor', label: 'Personaje en el grupo', type: 'ref', kind: 'actors', optional: true, def: 0 },
  { key: 'self', label: 'Auto-interruptor', type: 'select', def: '', options: [['', '—'], ['A', 'A'], ['B', 'B'], ['C', 'C'], ['D', 'D']] },
  { key: 'script', label: 'Script (true/false)', type: 'text', js: true, def: '', hint: 'Expresión JS; ej. game.variable(3) > 2' },
]

export const GRAPHIC_PARAMS = [
  // «Prefab» como gráfico directo queda obsoleto: el prefab se elige como modelo del registro (Personaje, Objeto, Armadura…) en la
  // Base de datos. Las páginas que ya lo usan siguen funcionando y la opción solo aparece en ellas.
  { key: 'kind', label: 'Gráfico', type: 'select', def: 'none', options: GRAPHIC_KINDS, deprecated: ['prefab'] },
  { key: 'modelId', label: 'Modelo', type: 'model', def: null, when: { kind: 'model' } },
  { key: 'prefabId', label: 'Prefab', type: 'prefab', def: null, when: { kind: 'prefab' }, hint: 'Se dibuja el prefab entero (mallas, modelos, luces…). Cambiar de página cambia el conjunto: una farola encendida en la página 1 y rota en la 2.' },
  // Sprite: la misma imagen-plano que el nodo Sprite 3D (nodes/sprite.js), como los personajes planos de RPG Maker
  { key: 'imageId', label: 'Imagen', type: 'image', def: '', when: { kind: 'sprite' } },
  { key: 'pixelSize', label: 'Tamaño del píxel (m)', type: 'number', def: 0.03, min: 0.0001, step: 0.005, when: { kind: 'sprite' } },
  { key: 'billboard', label: 'Mirar a la cámara', type: 'select', def: 'y', options: [['none', 'No (plano fijo)'], ['y', 'Gira en vertical hacia la cámara'], ['full', 'Siempre de frente a la cámara']], when: { kind: 'sprite' } },
  { key: 'filter', label: 'Filtro', type: 'select', def: 'pixel', options: [['smooth', 'Suave'], ['pixel', 'Píxeles nítidos (pixel art)']], when: { kind: 'sprite' } },
  { key: 'actorId', label: 'Personaje', type: 'ref', kind: 'actors', def: 1, when: { kind: 'actor' }, hint: 'El modelo, color y tamaño salen de Base de datos ▸ Personajes. En los textos, \\N[0] es el nombre de este personaje.' },
  { key: 'enemyId', label: 'Enemigo', type: 'ref', kind: 'enemies', def: 1, when: { kind: 'enemy' } },
  { key: 'itemId', label: 'Objeto', type: 'ref', kind: 'items', def: 1, when: { kind: 'item' } },
  { key: 'weaponId', label: 'Arma', type: 'ref', kind: 'weapons', def: 1, when: { kind: 'weapon' } },
  { key: 'armorId', label: 'Armadura', type: 'ref', kind: 'armors', def: 1, when: { kind: 'armor' } },
  { key: 'color', label: 'Color', type: 'color', def: '#d9a05b', when: { kind: GRAPHIC_PRIMITIVES } },
  { key: 'size', label: 'Tamaño (m)', type: 'vec3', def: [1, 1, 1], when: { kind: [...GRAPHIC_PRIMITIVES, 'model', 'prefab'] } },
  { key: 'steps', label: 'Peldaños', type: 'number', def: 8, min: 2, max: 64, step: 1, when: { kind: 'stairs' } },
]

export const defaults = (params) => Object.fromEntries(params.filter((q) => q.def !== undefined).map((q) => [q.key, clone(q.def)]))
export const clone = (v) => (v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v)

export const INPUT_PARAMS = [
  { key: 'action', label: 'Acción o tecla', type: 'action', def: 'interact' },
  { key: 'mode', label: 'Cuándo', type: 'select', def: 'pressed', options: [['pressed', 'Al pulsar'], ['released', 'Al soltar']] },
]

// Un solo catálogo para Emitir, Esperar y el disparador «Al recibir señal».
// Los nombres se conservan tal cual: también valen las señales personalizadas.
export const NATIVE_SIGNALS = [
  ['item.picked_up', 'Objeto recogido'],
  ['object.grabbed', 'Objeto agarrado'],
  ['object.dropped', 'Objeto soltado'],
  ['object.thrown', 'Objeto lanzado'],
  ['inventory.item_added', 'Añadido al inventario'],
  ['inventory.item_removed', 'Retirado del inventario'],
  ['equipment.equipped', 'Objeto equipado'],
  ['equipment.unequipped', 'Objeto desequipado'],
]

export const SIGNAL_PARAMS = [
  { key: 'name', label: 'Señal', type: 'signal', def: '', hint: 'Elige una señal nativa o escribe el nombre de una señal personalizada.' },
  { key: 'var', label: 'Variable (opcional, proyectos anteriores)', type: 'variable', def: 0, optional: true, none: 'No guardar', hint: 'No hace falta una variable: usa \\S[itemId] en los textos de la página, o args[0] en scripts.' },
]

export function newPage(n = 1) {
  return {
    id: uid('pg'),
    name: `Página ${n}`,
    cond: defaults(COND_PARAMS),
    graphic: defaults(GRAPHIC_PARAMS),
    trigger: 'action',
    solid: false,
    showIndicator: false,
    indicatorZones: defaultIndicatorZones(1.2),
    gaze: defaults(GAZE_PARAMS),
    input: defaults(INPUT_PARAMS),
    signal: defaults(SIGNAL_PARAMS),
    move: { ...defaults(MOVE_PARAMS), route: newRoute() },
    options: defaults(OPTION_PARAMS),
    list: [],
  }
}
export const newRoute = () => ({ list: [], repeat: true, skip: true })

export const newEventProps = () => ({ reach: 1.2, pages: [newPage(1)] })

/** Completa campos que falten (proyectos guardados con versiones anteriores del modelo). */
export function normalizeEvent(props) {
  props.reach = Number.isFinite(props.reach) ? props.reach : 1.2
  if (!Array.isArray(props.pages) || !props.pages.length) props.pages = [newPage(1)]
  props.pages.forEach((pg, i) => {
    pg.id = pg.id || uid('pg')
    pg.name = pg.name || `Página ${i + 1}`
    pg.cond = { ...defaults(COND_PARAMS), ...(pg.cond || {}) }
    pg.graphic = { ...defaults(GRAPHIC_PARAMS), ...(pg.graphic || {}) }
    pg.trigger = pg.trigger || 'action'
    pg.solid = !!pg.solid
    pg.showIndicator = pg.showIndicator === true
    pg.indicatorZones = normalizeIndicatorZones(pg.indicatorZones, props.reach + 0.3)
    pg.gaze = { ...defaults(GAZE_PARAMS), ...(pg.gaze || {}) }
    pg.input = { ...defaults(INPUT_PARAMS), ...(pg.input || {}) }
    pg.signal = { ...defaults(SIGNAL_PARAMS), ...(pg.signal || {}) }
    pg.move = { ...defaults(MOVE_PARAMS), ...(pg.move || {}), route: { ...newRoute(), ...(pg.move?.route || {}) } }
    pg.move.route.list = pg.move.route.list || []
    pg.options = { ...defaults(OPTION_PARAMS), ...(pg.options || {}) }
    pg.list = pg.list || []
  })
  return props
}

/** Páginas que referencian un modelo. Se examinan TODAS las páginas, no solo la activa. */
export function eventPagesUsingModel(props, modelId) {
  if (!modelId || !Array.isArray(props?.pages)) return []
  return props.pages.flatMap((pg, i) => pg?.graphic?.kind === 'model' && pg.graphic.modelId === modelId ? [i + 1] : [])
}

/** ¿Se cumple el valor `when` (valor exacto, lista de valores o función)? */
export function whenOk(when, values) {
  if (!when) return true
  // clave especial «$»: función que recibe todos los valores (para condiciones con varios campos)
  return Object.entries(when).every(([k, w]) => (k === '$' ? !!w(values) : typeof w === 'function' ? w(values[k]) : Array.isArray(w) ? w.includes(values[k]) : values[k] === w))
}

/** Recorre todos los comandos (en profundidad). */
export function walk(list, fn, depth = 0) {
  for (const c of list || []) {
    fn(c, depth)
    for (const b of Object.values(c.b || {})) walk(b, fn, depth + 1)
  }
}
