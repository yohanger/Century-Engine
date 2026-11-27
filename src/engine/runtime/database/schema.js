// Base de datos del juego (estilo RPG Maker MZ, adaptada a juegos narrativos).
// Todo es DECLARATIVO: la ventana «Base de datos» se genera sola a partir de SECTIONS (mismos tipos que ParamForm).
// Nuevos tipos de parámetro: header · ref {kind} · list {item, label} · icon · formula · equips
//   ref.kind = colección ('items', 'skills'…) o lista de texto del sistema ('sys:elements').
import { clone } from '../events/model.js'
import { normalizePlayer } from './player.js'
import { modelParams } from './models.js'
export { MODEL_PRIMS, PRIM_PREFIX, PREFAB_PREFIX, prefabRef, dbPrefabUsage, parseModelRef, graphicOf, resolveGraphic, GRAPHIC_DB_KINDS, GRAPHIC_DB_LABELS, graphicRecord, dbModelUsage } from './models.js'
export { PLAYER_PARAMS, PLAYER_DEFAULTS, normalizePlayer, slotById, slotOptions } from './player.js'

export const PARAMS = [
  ['mhp', 'Vida máx.'], ['mmp', 'Energía máx.'], ['atk', 'Ataque'], ['def', 'Defensa'],
  ['mat', 'Ataque mág.'], ['mdf', 'Defensa mág.'], ['agi', 'Agilidad'], ['luk', 'Suerte'],
]
const PARAM_OPTS = PARAMS.map(([k, l]) => [k, l])

export const TRAIT_CODES = [
  ['paramPlus', 'Parámetro +'], ['paramRate', 'Parámetro × %'], ['elementRate', 'Resistencia elemental × %'],
  ['stateResist', 'Resiste estado'], ['addSkill', 'Añade habilidad'], ['sealSkill', 'Bloquea habilidad'],
]
export const EFFECT_CODES = [
  ['hp', 'Recuperar vida'], ['mp', 'Recuperar energía'], ['addState', 'Añadir estado'], ['removeState', 'Quitar estado'],
  ['grow', 'Aumentar parámetro'], ['learnSkill', 'Aprender habilidad'], ['commonEvent', 'Evento común'],
]

const traits = { key: 'traits', label: 'Rasgos', type: 'list', def: [], item: [
  { key: 'code', label: 'Rasgo', type: 'select', def: 'paramPlus', options: TRAIT_CODES },
  { key: 'param', label: 'Parámetro', type: 'select', def: 'atk', options: PARAM_OPTS, when: { code: ['paramPlus', 'paramRate'] } },
  { key: 'element', label: 'Elemento', type: 'ref', kind: 'sys:elements', def: 1, when: { code: 'elementRate' } },
  { key: 'state', label: 'Estado', type: 'ref', kind: 'states', def: 1, when: { code: 'stateResist' } },
  { key: 'skill', label: 'Habilidad', type: 'ref', kind: 'skills', def: 1, when: { code: ['addSkill', 'sealSkill'] } },
  { key: 'value', label: 'Valor', type: 'number', def: 10, step: 1, when: { code: ['paramPlus', 'paramRate', 'elementRate'] } },
], summary: (t) => t.code }

const damage = { key: 'damage', label: 'Daño', type: 'list', def: [], max: 1, item: [
  { key: 'type', label: 'Tipo', type: 'select', def: 'hp', options: [['hp', 'Daño a vida'], ['mp', 'Daño a energía'], ['hpRec', 'Curar vida'], ['mpRec', 'Curar energía'], ['hpDrain', 'Absorber vida'], ['mpDrain', 'Absorber energía']] },
  { key: 'element', label: 'Elemento', type: 'ref', kind: 'sys:elements', optional: true, def: 0 },
  { key: 'formula', label: 'Fórmula', type: 'formula', def: 'a.atk * 4 - b.def * 2', hint: 'a = quien usa · b = objetivo · v = variables del juego. Ej: a.atk * 4 - b.def * 2' },
  { key: 'variance', label: 'Variación %', type: 'number', def: 20, min: 0, max: 100, step: 5 },
] }
const effects = { key: 'effects', label: 'Efectos', type: 'list', def: [], item: [
  { key: 'code', label: 'Efecto', type: 'select', def: 'hp', options: EFFECT_CODES },
  { key: 'pct', label: '% del máx.', type: 'number', def: 0, step: 5, when: { code: ['hp', 'mp'] } },
  { key: 'flat', label: 'Cantidad fija', type: 'number', def: 0, step: 1, when: { code: ['hp', 'mp'] } },
  { key: 'state', label: 'Estado', type: 'ref', kind: 'states', def: 1, when: { code: ['addState', 'removeState'] } },
  { key: 'chance', label: 'Probabilidad %', type: 'number', def: 100, min: 0, max: 100, step: 5, when: { code: ['addState', 'removeState'] } },
  { key: 'param', label: 'Parámetro', type: 'select', def: 'atk', options: PARAM_OPTS, when: { code: 'grow' } },
  { key: 'value', label: 'Cantidad', type: 'number', def: 1, step: 1, when: { code: 'grow' } },
  { key: 'skill', label: 'Habilidad', type: 'ref', kind: 'skills', def: 1, when: { code: 'learnSkill' } },
  { key: 'event', label: 'Evento común', type: 'ref', kind: 'commonEvents', def: 1, when: { code: 'commonEvent' } },
] }
const scope = { key: 'scope', label: 'Alcance', type: 'select', def: 'one', options: [['none', 'Ninguno'], ['one', 'Un aliado'], ['all', 'Todo el grupo'], ['self', 'El usuario'], ['enemy', 'Un enemigo']] }
const occasion = { key: 'occasion', label: 'Disponible', type: 'select', def: 'always', options: [['always', 'Siempre'], ['menu', 'Solo en el menú'], ['event', 'Solo desde eventos/scripts'], ['never', 'Nunca']] }
const head = (label) => ({ key: '_h' + label, type: 'header', label })
const base = (extra = []) => [
  { key: 'name', label: 'Nombre', type: 'text', def: '' },
  { key: 'icon', label: 'Icono', type: 'icon', def: '' },
  { key: 'desc', label: 'Descripción', type: 'textarea', def: '' },
  ...extra,
  { key: 'note', label: 'Notas', type: 'textarea', def: '', hint: 'Texto libre; accesible desde scripts (record.note)' },
]
const paramFields = (def = 100) => PARAMS.flatMap(([k, l]) => [
  { key: k + 'Base', label: l + ' (nivel 1)', type: 'number', def: k === 'mhp' ? def : k === 'mmp' ? 20 : 10, step: 1 },
  { key: k + 'Grow', label: l + ' / nivel', type: 'number', def: k === 'mhp' ? 20 : k === 'mmp' ? 5 : 2, step: 0.5 },
])
const itemPrice = { key: 'price', label: 'Precio', type: 'number', def: 0, min: 0, step: 1 }
const physicsFields = [
  head('Physics'),
  { key: 'physics', label: 'Physics', type: 'select', def: 'static', options: [['none', 'Ninguno'], ['static', 'Static'], ['dynamic', 'Dynamic (Rigidbody)'], ['kinematic', 'Kinematic']] },
  { key: 'bodyShape', label: 'Colisión', type: 'select', def: 'box', options: [['box', 'Caja'], ['sphere', 'Esfera'], ['capsule', 'Cápsula']], when: { physics: 'dynamic' } },
  { key: 'bodyMass', label: 'Masa (kg)', type: 'number', def: 1, min: 0.05, max: 20000, step: 0.1, when: { physics: 'dynamic' } },
  { key: 'bodyFriction', label: 'Fricción', type: 'number', def: 0.6, min: 0, max: 2, step: 0.05, when: { physics: 'dynamic' } },
  { key: 'bodyBounce', label: 'Rebote', type: 'number', def: 0.15, min: 0, max: 1, step: 0.05, when: { physics: 'dynamic' } },
]

export const SECTIONS = [
  { id: 'actors', label: 'Personajes', icon: '☺', single: 'Personaje', params: base([
    { key: 'nickname', label: 'Apodo', type: 'text', def: '' },
    { key: 'classId', label: 'Clase', type: 'ref', kind: 'classes', def: 1 },
    { key: 'level', label: 'Nivel inicial', type: 'number', def: 1, min: 1, max: 99, step: 1 },
    { key: 'maxLevel', label: 'Nivel máximo', type: 'number', def: 20, min: 1, max: 99, step: 1 },
    { key: 'profile', label: 'Perfil / biografía', type: 'textarea', def: '' },
    { key: 'portrait', label: 'Retrato', type: 'texture', def: '' },
    head('Modelo 3D'), ...modelParams({ model: 'prim:cylinder', size: [0.8, 1.7, 0.8] }),
    head('Equipo inicial'),
    { key: 'equips', label: 'Equipo', type: 'equips', def: [] },
    traits,
  ]) },
  { id: 'classes', label: 'Clases', icon: '⚑', single: 'Clase', params: base([
    head('Parámetros (base y crecimiento por nivel)'), ...paramFields(),
    { key: 'expBase', label: 'Experiencia base', type: 'number', def: 30, min: 1, step: 1 },
    { key: 'expInflation', label: 'Inflación de exp.', type: 'number', def: 20, min: 0, step: 1 },
    { key: 'learnings', label: 'Habilidades que aprende', type: 'list', def: [], item: [
      { key: 'level', label: 'Nivel', type: 'number', def: 1, min: 1, max: 99, step: 1 },
      { key: 'skill', label: 'Habilidad', type: 'ref', kind: 'skills', def: 1 },
    ] },
    traits,
  ]) },
  { id: 'skills', label: 'Habilidades', icon: '✦', single: 'Habilidad', params: base([
    { key: 'stype', label: 'Tipo de habilidad', type: 'ref', kind: 'sys:skillTypes', def: 1 },
    { key: 'mpCost', label: 'Coste de energía', type: 'number', def: 0, min: 0, step: 1 },
    scope, occasion, damage, effects,
    { key: 'message', label: 'Mensaje', type: 'text', def: '{a} usa {name}.', hint: '{a} usuario · {b} objetivo · {name} habilidad · {n} cantidad' },
  ]) },
  { id: 'items', label: 'Objetos', icon: '◆', single: 'Objeto', params: base([
    { key: 'itype', label: 'Tipo', type: 'select', def: 'regular', options: [['regular', 'Objeto normal'], ['key', 'Objeto clave / narrativo']] },
    head('Modelo 3D'), ...modelParams({ size: [0.35, 0.35, 0.35] }), ...physicsFields,
    head('Uso'), itemPrice, { key: 'consumable', label: 'Se consume al usarlo', type: 'bool', def: true },
    scope, occasion, damage, effects,
    head('Presentación opcional'),
    { key: 'actionAnimation', label: 'Animación al usar', type: 'animation', def: '', optional: true, hint: 'Se reproduce en el evento del objeto. Vacío = uso inmediato sin animación.' },
    { key: 'actionSound', label: 'Sonido al usar', type: 'audio', def: '', optional: true, hint: 'Se reproduce por el grupo SFX. Vacío = uso sin sonido.' },
  ]) },
  { id: 'weapons', label: 'Armas', icon: '†', single: 'Arma', params: base([
    { key: 'wtype', label: 'Tipo de arma', type: 'ref', kind: 'sys:weaponTypes', def: 1 },
    { key: 'etype', label: 'Ranura de equipo', type: 'ref', kind: 'sys:equipTypes', def: 1 },
    head('Modelo 3D'), ...modelParams({ size: [0.12, 0.12, 0.9] }), ...physicsFields,
    head('Uso'), itemPrice,
    { key: 'actionSkill', label: 'Acción del arma (habilidad)', type: 'ref', kind: 'skills', def: 0, optional: true, hint: 'La habilidad define daño, efectos y coste de MP. Vacío = arma sin acción configurada.' },
    head('Presentación opcional'),
    { key: 'actionAnimation', label: 'Animación de la acción', type: 'animation', def: '', optional: true, hint: 'Se reproduce en el evento del arma equipada. Vacío = acción sin animación.' },
    { key: 'actionSound', label: 'Sonido de la acción', type: 'audio', def: '', optional: true, hint: 'Se reproduce por SFX. Vacío = acción sin sonido.' },
    head('Parámetros'), ...PARAMS.map(([k, l]) => ({ key: k, label: l, type: 'number', def: 0, step: 1 })),
    traits,
  ]) },
  { id: 'armors', label: 'Armaduras', icon: '⛨', single: 'Armadura', params: base([
    { key: 'atype', label: 'Tipo de armadura', type: 'ref', kind: 'sys:armorTypes', def: 1 },
    { key: 'etype', label: 'Ranura de equipo', type: 'ref', kind: 'sys:equipTypes', def: 2 },
    head('Modelo 3D'), ...modelParams({ size: [0.5, 0.5, 0.2] }),
    head('Uso'), itemPrice,
    head('Parámetros'), ...PARAMS.map(([k, l]) => ({ key: k, label: l, type: 'number', def: 0, step: 1 })),
    traits,
  ]) },
  { id: 'enemies', label: 'Enemigos', icon: '☠', single: 'Enemigo', params: base([
    head('Modelo 3D'), ...modelParams({ model: 'prim:sphere', color: '#7a4fd6', size: [1, 1, 1] }),
    head('Parámetros'), ...PARAMS.map(([k, l]) => ({ key: k, label: l, type: 'number', def: k === 'mhp' ? 50 : k === 'mmp' ? 0 : 8, step: 1 })),
    { key: 'exp', label: 'Experiencia', type: 'number', def: 10, min: 0, step: 1 },
    { key: 'gold', label: 'Oro', type: 'number', def: 5, min: 0, step: 1 },
    { key: 'actions', label: 'Habilidades', type: 'list', def: [], item: [{ key: 'skill', label: 'Habilidad', type: 'ref', kind: 'skills', def: 1 }] },
    { key: 'drops', label: 'Botín', type: 'list', def: [], item: [
      { key: 'kind', label: 'Tipo', type: 'select', def: 'items', options: [['items', 'Objeto'], ['weapons', 'Arma'], ['armors', 'Armadura']] },
      { key: 'item', label: 'Elemento', type: 'ref', kind: 'items', def: 1, when: { kind: 'items' } },
      { key: 'weapon', label: 'Elemento', type: 'ref', kind: 'weapons', def: 1, when: { kind: 'weapons' } },
      { key: 'armor', label: 'Elemento', type: 'ref', kind: 'armors', def: 1, when: { kind: 'armors' } },
      { key: 'chance', label: 'Probabilidad %', type: 'number', def: 50, min: 0, max: 100, step: 5 },
    ] },
    traits,
  ]) },
  { id: 'states', label: 'Estados', icon: '✚', single: 'Estado', params: base([
    { key: 'restriction', label: 'Restricción', type: 'select', def: 'none', options: [['none', 'Ninguna'], ['noSkills', 'No puede usar habilidades'], ['noActions', 'No puede actuar']] },
    { key: 'duration', label: 'Duración (ticks, 0 = permanente)', type: 'number', def: 0, min: 0, step: 1 },
    head('Efectos por tick (negativo = daño / pérdida)'),
    { key: 'tickHpFlat', label: 'HP por tick · cantidad fija', type: 'number', def: 0, step: 1 },
    { key: 'tickHpPct', label: 'HP por tick · % del máximo', type: 'number', def: 0, step: 1 },
    { key: 'tickMpFlat', label: 'MP por tick · cantidad fija', type: 'number', def: 0, step: 1 },
    { key: 'tickMpPct', label: 'MP por tick · % del máximo', type: 'number', def: 0, step: 1 },
    { key: 'removeOnDamage', label: 'Se quita al recibir daño', type: 'bool', def: false },
    { key: 'msgAdd', label: 'Mensaje al aplicarse', type: 'text', def: '{b} sufre {name}.' },
    traits,
  ]) },
  { id: 'commonEvents', label: 'Eventos comunes', icon: '⚡', single: 'Evento común', params: [
    { key: 'name', label: 'Nombre', type: 'text', def: '' },
    { key: 'trigger', label: 'Disparador', type: 'select', def: 'none', options: [['none', 'Ninguno (se llama con un comando)'], ['auto', 'Automático (mientras el interruptor esté ON)'], ['parallel', 'Paralelo (mientras el interruptor esté ON)'], ['input', 'Al pulsar una acción / tecla']] },
    { key: 'action', label: 'Acción o tecla', type: 'action', def: 'interact', when: { trigger: 'input' } },
    { key: 'switch', label: 'Interruptor', type: 'switch', def: 0, optional: true, when: { trigger: ['auto', 'parallel'] } },
    { key: 'list', label: 'Comandos', type: 'commands', def: [] },
  ] },
  { id: 'quests', label: 'Misiones', icon: '⚐', single: 'Misión', params: base([
    { key: 'objectives', label: 'Objetivos', type: 'list', def: [], item: [{ key: 'text', label: 'Objetivo', type: 'text', def: '' }, { key: 'optional', label: 'Opcional', type: 'bool', def: false }] },
    { key: 'rewardGold', label: 'Recompensa de oro', type: 'number', def: 0, min: 0, step: 1 },
    { key: 'rewardItem', label: 'Objeto de recompensa', type: 'ref', kind: 'items', optional: true, def: 0 },
    { key: 'hidden', label: 'Oculta hasta empezarla', type: 'bool', def: true },
  ]) },
  { id: 'lore', label: 'Documentos', icon: '✉', single: 'Documento', params: base([
    { key: 'category', label: 'Categoría', type: 'text', def: 'Notas' },
    { key: 'body', label: 'Contenido', type: 'textarea', def: '', hint: 'Admite códigos de escape (\\C[2], \\V[1]…)' },
    { key: 'image', label: 'Imagen', type: 'texture', def: '' },
  ]) },
]

/** Listas de texto del sistema (índice + 1 = id). */
export const SYS_LISTS = [
  ['elements', 'Elementos'], ['skillTypes', 'Tipos de habilidad'], ['weaponTypes', 'Tipos de arma'], ['armorTypes', 'Tipos de armadura'], ['equipTypes', 'Ranuras de equipo'],
]
export const TERMS = {
  currency: 'Monedas', level: 'Nivel', hp: 'Vida', mp: 'Energía', exp: 'Experiencia',
  mhp: 'Vida máx.', mmp: 'Energía máx.', atk: 'Ataque', def: 'Defensa', mat: 'Ataque mág.', mdf: 'Defensa mág.', agi: 'Agilidad', luk: 'Suerte',
  items: 'Objetos', skills: 'Habilidades', equip: 'Equipo', status: 'Estado', quests: 'Misiones', journal: 'Diario', party: 'Grupo',
  useItem: '{a} usa {name}.', gainItem: 'Obtienes {name} ×{n}.', loseItem: 'Pierdes {name} ×{n}.', gainGold: 'Obtienes {n} {currency}.', levelUp: '{a} sube al nivel {n}.', learnSkill: '{a} aprende {name}.',
  damage: '{b} recibe {n} de daño.', recover: '{b} recupera {n}.', miss: 'Sin efecto.',
}
export const SYSTEM_PARAMS = [
  { key: 'title', label: 'Título del juego', type: 'text', def: 'Mi juego' },
  { key: 'currency', label: 'Moneda', type: 'text', def: '€' },
  { key: 'startGold', label: 'Oro inicial', type: 'number', def: 0, min: 0, step: 1 },
  { key: 'party', label: 'Grupo inicial', type: 'list', def: [{ actor: 1 }], item: [{ key: 'actor', label: 'Personaje', type: 'ref', kind: 'actors', def: 1 }] },
  { key: 'maxItems', label: 'Máx. por objeto', type: 'number', def: 99, min: 1, step: 1 },
]

const rec = (kind, id, over = {}) => ({ id, ...Object.fromEntries(SECTIONS.find((s) => s.id === kind).params.filter((q) => q.type !== 'header' && q.def !== undefined).map((q) => [q.key, clone(q.def)])), ...over })

/** Crea un registro nuevo con los valores por defecto del esquema. */
export const newRecord = (kind, id) => rec(kind, id, { name: '' })

export function defaultDatabase() {
  return {
    switches: [], variables: [],
    actors: [rec('actors', 1, { name: 'Protagonista', classId: 1, profile: '', equips: [1, 0, 0, 1] })],
    classes: [rec('classes', 1, { name: 'Aventurero', learnings: [{ level: 1, skill: 1 }, { level: 3, skill: 2 }] })],
    skills: [
      rec('skills', 1, { name: 'Golpe', icon: '✦', desc: 'Un ataque básico.', scope: 'enemy', damage: [{ type: 'hp', element: 0, formula: 'a.atk * 4 - b.def * 2', variance: 20 }], message: '{a} ataca.' }),
      rec('skills', 2, { name: 'Primeros auxilios', icon: '✚', desc: 'Recupera algo de vida.', mpCost: 3, scope: 'one', damage: [{ type: 'hpRec', element: 0, formula: '30 + a.mat * 2', variance: 10 }], message: '{a} usa {name} sobre {b}.' }),
    ],
    items: [
      rec('items', 1, { name: 'Poción', icon: '⚗', desc: 'Recupera 50 de vida.', price: 20, effects: [{ code: 'hp', pct: 0, flat: 50, state: 1, chance: 100, param: 'atk', value: 1, skill: 1, event: 1 }] }),
      rec('items', 2, { name: 'Llave oxidada', icon: '⚷', desc: 'Abre una puerta antigua.', itype: 'key', consumable: false, scope: 'none', occasion: 'never' }),
    ],
    weapons: [rec('weapons', 1, { name: 'Palo', icon: '†', desc: 'Mejor que nada.', price: 5, atk: 2 })],
    armors: [rec('armors', 1, { name: 'Ropa', icon: '⛨', desc: 'Ropa de viaje.', price: 5, def: 1, etype: 4 })],
    enemies: [rec('enemies', 1, { name: 'Sombra' })],
    states: [rec('states', 1, { name: 'Veneno', icon: '☠', desc: 'Pierde vida con el tiempo.', duration: 3 }), rec('states', 2, { name: 'Inconsciente', icon: '✖', restriction: 'noActions' })],
    commonEvents: [], quests: [], lore: [],
    player: normalizePlayer(null),
    system: {
      ...Object.fromEntries(SYSTEM_PARAMS.map((q) => [q.key, clone(q.def)])),
      elements: ['Físico', 'Fuego', 'Hielo', 'Rayo', 'Luz', 'Oscuridad'], skillTypes: ['Especial', 'Magia'],
      weaponTypes: ['Contundente', 'Cortante', 'A distancia'], armorTypes: ['General', 'Ligera', 'Pesada'],
      equipTypes: ['Arma', 'Escudo', 'Cabeza', 'Cuerpo', 'Accesorio'], terms: { ...TERMS },
    },
  }
}

/** Base de datos vacía: sin protagonista, grupo ni recursos de demostración.
 *  La marca noPlayer distingue esto de un proyecto antiguo al que le falta el campo Jugador. */
export function emptyDatabase() {
  const def = defaultDatabase()
  return { switches: [], variables: [],
    ...Object.fromEntries(SECTIONS.map((s) => [s.id, []])),
    noPlayer: true,
    system: { ...def.system, party: [] },
  }
}

/** Completa lo que falte (proyectos anteriores que solo tenían switches/variables).
 *  `legacyGame` = project.game: de ahí salen caminar/correr/saltar/FOV de proyectos anteriores a la sección «Jugador». */
export function normalizeDatabase(db, legacyGame = null) {
  const d = db || {}
  const def = defaultDatabase()
  const out = { switches: Array.isArray(d.switches) ? d.switches : [], variables: Array.isArray(d.variables) ? d.variables : [] }
  const first = !d.actors && !d.system // base antigua: se añade el contenido inicial de ejemplo
  for (const s of SECTIONS) {
    const list = Array.isArray(d[s.id]) ? d[s.id] : first ? def[s.id] : []
    const used = new Set(); let next = Math.max(0, ...list.map((r) => +r?.id || 0)) + 1
    out[s.id] = list.filter(Boolean).map((r) => {
      let id = +r.id; if (!id || used.has(id)) id = next++; used.add(id)
      const record = { ...rec(s.id, id), ...r, id }
      // Si el objeto es anterior al campo Physics, no le añadimos colisiones nuevas al abrir el proyecto.
      if ((s.id === 'items' || s.id === 'weapons') && !Object.hasOwn(r, 'physics')) delete record.physics
      return record
    })
  }
  // Empty no tiene registro de jugador. En proyectos antiguos, un campo ausente
  // sigue tomando el valor habitual; nunca se interpreta como Empty implícito.
  if (d.noPlayer === true) out.noPlayer = true
  else out.player = normalizePlayer(d.player, legacyGame)
  out.system = { ...def.system, ...(d.system || {}) }
  out.system.terms = { ...TERMS, ...(d.system?.terms || {}) }
  for (const [k] of SYS_LISTS) if (!Array.isArray(out.system[k]) || !out.system[k].length) out.system[k] = def.system[k]
  return out
}

export const section = (id) => SECTIONS.find((s) => s.id === id)
/** Opciones [[id, nombre]] de una referencia (`items`, `sys:elements`…). */
export function refOptions(db, kind) {
  if (kind.startsWith('sys:')) return (db.system?.[kind.slice(4)] || []).map((n, i) => [i + 1, n])
  return (db[kind] || []).map((r) => [r.id, r.name || `(${String(r.id).padStart(3, '0')})`])
}
