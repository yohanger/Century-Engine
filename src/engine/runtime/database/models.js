// Modelos 3D de la base de datos (personajes, enemigos, objetos, armas y armaduras) y su uso en los eventos.
//
// Un registro guarda `model` (referencia), `modelColor` y `modelSize`. La referencia es:
//   null              sin modelo
//   'prim:cylinder'   una primitiva del editor (cubo, esfera, cilindro, cono, plano, rampa, escalera)
//   'prefab:<id>'     un prefab del proyecto (Assets/Prefabs): el conjunto entero (mallas, modelos, luces…)
//   '<id>'            un modelo importado en Assets/Models
// Un evento con gráfico «Personaje / Enemigo / Objeto / Arma / Armadura» no copia nada: lee el registro, así que cambiar el modelo
// en la base de datos cambia a todos los eventos que lo usan (como elegir un personaje en RPG Maker MZ).
// Sin dependencias de THREE ni del DOM: lo usan el editor, el juego exportado y las pruebas.

export const PRIM_PREFIX = 'prim:'
export const PREFAB_PREFIX = 'prefab:'
/** Mismas siete primitivas que engine/scene/primitives.js (la prueba test-database.mjs comprueba que no se desincronicen). */
export const MODEL_PRIMS = [
  ['box', 'Cubo'], ['sphere', 'Esfera'], ['cylinder', 'Cilindro'], ['cone', 'Cono'], ['plane', 'Plano'], ['ramp', 'Rampa'], ['stairs', 'Escalera'],
]

/** { prim } | { prefabId } | { modelId } | null */
export function parseModelRef(v) {
  if (!v || typeof v !== 'string') return null
  if (v.startsWith(PREFAB_PREFIX)) return v.length > PREFAB_PREFIX.length ? { prefabId: v.slice(PREFAB_PREFIX.length) } : null
  if (v.startsWith(PRIM_PREFIX)) {
    const k = v.slice(PRIM_PREFIX.length)
    return MODEL_PRIMS.some(([p]) => p === k) ? { prim: k } : null
  }
  return { modelId: v }
}
export const primRef = (kind) => PRIM_PREFIX + kind
export const prefabRef = (id) => PREFAB_PREFIX + id

/**
 * Parámetros declarados del modelo de un registro (los pinta ParamForm). `def` = { model, color, size } por defecto de la sección.
 * El color solo aparece con primitivas; el tamaño, con cualquier modelo.
 */
export function modelParams(def = {}) {
  return [
    { key: 'model', label: 'Modelo', type: 'model', prims: true, def: def.model ?? null, hint: 'Una primitiva, un modelo importado o un prefab. Los eventos con «Personaje» (u Objeto, Arma…) como gráfico lo muestran.' },
    { key: 'modelColor', label: 'Color', type: 'color', def: def.color ?? '#d9a05b', when: { model: (v) => typeof v === 'string' && v.startsWith(PRIM_PREFIX) } },
    { key: 'modelSize', label: 'Tamaño (m)', type: 'vec3', def: def.size ?? [1, 1, 1], when: { model: (v) => !!v } },
  ]
}

/** Gráfico de evento ({kind, modelId, color, size}) que corresponde a un registro; { kind: 'none' } si no tiene modelo. */
export function graphicOf(rec) {
  const ref = parseModelRef(rec?.model)
  if (!ref) return { kind: 'none' }
  const size = Array.isArray(rec.modelSize) && rec.modelSize.length >= 3 ? rec.modelSize.slice(0, 3).map((n) => (Number.isFinite(+n) && +n > 0 ? +n : 1)) : [1, 1, 1]
  if (ref.prim) return { kind: ref.prim, color: rec.modelColor || '#d9a05b', size, steps: 8 }
  if (ref.prefabId) return { kind: 'prefab', prefabId: ref.prefabId, size }
  return { kind: 'model', modelId: ref.modelId, size }
}

/** Tipos de gráfico de evento que leen un registro de la base de datos: kind → [colección, clave del id en el gráfico]. */
export const GRAPHIC_DB_KINDS = {
  actor: ['actors', 'actorId'], enemy: ['enemies', 'enemyId'], item: ['items', 'itemId'], weapon: ['weapons', 'weaponId'], armor: ['armors', 'armorId'],
}
export const GRAPHIC_DB_LABELS = [
  ['actor', 'Personaje (base de datos)'], ['enemy', 'Enemigo (base de datos)'], ['item', 'Objeto (base de datos)'], ['weapon', 'Arma (base de datos)'], ['armor', 'Armadura (base de datos)'],
]

/** El registro de la base de datos al que apunta un gráfico (o null). */
export const PHYSICS_TYPES = ['none', 'static', 'dynamic', 'kinematic']

/** Perfil físico del gráfico actual; null significa que usa el comportamiento heredado de la página. */
export function graphicPhysics(gr, db) {
  if (gr?.kind !== 'item' && gr?.kind !== 'weapon') return null
  const rec = graphicRecord(gr, db)
  if (!rec || !Object.hasOwn(rec, 'physics')) return null
  if (!PHYSICS_TYPES.includes(rec.physics)) throw new Error(`Physics no válido en «${rec.name || rec.id}»: ${rec.physics}`)
  return { type: rec.physics, shape: rec.bodyShape || 'box', mass: rec.bodyMass ?? 1,
    friction: rec.bodyFriction ?? 0.6, bounce: rec.bodyBounce ?? 0.15 }
}

export function graphicRecord(gr, db) {
  const t = GRAPHIC_DB_KINDS[gr?.kind]
  if (!t) return null
  return (db?.[t[0]] || []).find((r) => r.id === gr[t[1]]) || null
}

/** Gráfico «real» que se dibuja: los de la base de datos se sustituyen por el modelo del registro; el resto se devuelve tal cual. */
export function resolveGraphic(gr, db) {
  if (!gr || !GRAPHIC_DB_KINDS[gr.kind]) return gr
  const rec = graphicRecord(gr, db)
  return rec ? graphicOf(rec) : { kind: 'none' }
}

/** Registros de la base de datos cuyo modelo es ese prefab, como textos «Base de datos / Armaduras / Ropa». */
export function dbPrefabUsage(db, prefabId) {
  const out = []
  const SEC = { actors: 'Personajes', enemies: 'Enemigos', items: 'Objetos', weapons: 'Armas', armors: 'Armaduras' }
  for (const [k, label] of Object.entries(SEC)) for (const r of db?.[k] || []) if (r.model === PREFAB_PREFIX + prefabId) out.push(`Base de datos / ${label} / ${r.name || r.id}`)
  return out
}

/** Todos los registros de la base de datos que usan un modelo importado, como textos «Personajes / Protagonista». */
export function dbModelUsage(db, modelId) {
  const out = []
  const SEC = { actors: 'Personajes', enemies: 'Enemigos', items: 'Objetos', weapons: 'Armas', armors: 'Armaduras' }
  for (const [k, label] of Object.entries(SEC)) for (const r of db?.[k] || []) if (r.model === modelId) out.push(`Base de datos / ${label} / ${r.name || r.id}`)
  for (const s of db?.player?.slots || []) if (s.model === modelId) out.push(`Base de datos / Jugador / slot ${s.id}`)
  return out
}

/** Modelos importados que necesita una escena al jugar. Incluye las páginas alternativas de los eventos de Database. */
export function modelIdsInScene(objects = [], database = {}, prefabs = []) {
  const ids = new Set()
  const visited = new Set()
  const add = (ref) => {
    const parsed = parseModelRef(ref)
    if (parsed?.modelId) ids.add(parsed.modelId)
    if (parsed?.prefabId && !visited.has(parsed.prefabId)) {
      visited.add(parsed.prefabId)
      const prefab = prefabs.find((p) => p.id === parsed.prefabId)
      for (const o of prefab?.objects || []) {
        add(o.modelId)
        add(o.props?.model)
    if (o.type === 'gameplayObject') {
      const kind = o.props?.recordKind, id = +o.props?.recordId
      if (kind === 'items' || kind === 'weapons') add(database?.[kind]?.find((r) => r.id === id)?.model)
    }
      }
    }
  }
  for (const o of objects) {
    add(o.modelId)
    add(o.props?.model)
    if (o.type === 'gameplayObject') {
      const kind = o.props?.recordKind, id = +o.props?.recordId
      if (kind === 'items' || kind === 'weapons') add(database?.[kind]?.find((r) => r.id === id)?.model)
    }
    for (const page of o.type === 'event' ? o.props?.pages || [] : []) {
      const graphic = resolveGraphic(page?.graphic, database)
      if (graphic?.kind === 'model') add(graphic.modelId)
      if (graphic?.kind === 'prefab') add(PREFAB_PREFIX + graphic.prefabId)
    }
  }
  // Los modelos de los slots del jugador pueden verse sin existir como nodos en la escena.
  for (const slot of database?.player?.slots || []) add(slot.model)
  return ids
}
