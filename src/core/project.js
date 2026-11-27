import { strictJson } from '../engine/runtime/numeric-integrity.js'
import { authoredSceneTree } from '../engine/runtime/scene/instances.js'
import { isSystemUiPath } from '../engine/runtime/ui/system.js'
// Modelo de datos del proyecto (v3). Sin dependencias del DOM: se usa igual en el navegador y en Node.
import { toRaw } from '@vue/reactivity'
import { defaultDatabase, emptyDatabase, normalizeDatabase } from '../engine/runtime/database/schema.js'
import { defaultTheme, normalizeTheme } from '../engine/runtime/ui/theme.js'
import { FORMAT_VERSION } from '../engine/runtime/format.js'
import { normalizeTimelines, isFilmMakerTimeline, CINEMATICS_FOLDER } from './timeline/model.js'
import { normalizeClips } from '../engine/runtime/anim/model.js'
import { compileGraph } from './shadergraph/compile.js'
//
// Un PROYECTO contiene varias ESCENAS (niveles) y un sistema de archivos (carpetas + assets).
// En memoria, `store.project` lleva los datos del proyecto y, aplanados, los de la escena ACTIVA
// (objects, environment, terrain). Las demás escenas viven en IndexedDB / dentro del .lfproj.
import { uid } from '../engine/runtime/util.js'
import { makeObject } from '../engine/runtime/nodes/index.js'
import { DEFAULT_LAYERS } from '../engine/runtime/geometry/terrain.js'
import { WFX_DEFAULTS } from '../engine/runtime/geometry/waterfx.js'
import { emptySlots } from '../engine/runtime/ui/roles.js'
import { ensureSystemUi } from '../engine/runtime/ui/system.js'
import { getTemplate, DEFAULT_TEMPLATE, LEGACY_TEMPLATE } from './templates/index.js'
import { GAME_DEFAULTS } from '../engine/runtime/templates/gameParams.js'
import { normalizeWorld } from '../engine/runtime/world/params.js'
import { defaultTagLayers, normalizeTagLayers, migrateObjectGroups } from '../engine/runtime/layers.js'
import { defaultInputMap, normalizeInputMap } from '../engine/runtime/input/inputmap.js'
import { normalizeProfiles, PROFILE_FOLDER } from '../engine/runtime/render/profiles.js'
import { normalizeMaterials, MATERIAL_FOLDER } from '../engine/runtime/render/material-resource.js'
import { normalizeGameManager, MANAGER_FOLDER, MANAGER_EXT } from '../engine/runtime/game-manager.js'
import { normalizeRender, presetOf, rendererPreset } from '../engine/runtime/render/config.js'
import { BAKE_DEFAULTS, normalizeBake } from '../engine/runtime/bake/config.js'
import { defaultAudio, normalizeAudio } from '../engine/runtime/audio/config.js'
import { normalizeLoc } from '../engine/runtime/i18n/localization.js'
import { normalizeCaptureClips } from './capture/clips.js'
import { normalizeVfxCollection } from '../engine/runtime/vfx/resource.js'
import { normalizeLiquid } from '../engine/runtime/geometry/liquid-containers.js'
import { SCENE_FADE_DEFAULTS } from '../engine/runtime/events/scene-transitions.js'
import { nodeEffectiveActive, validateNodeTree } from '../engine/runtime/nodes/hierarchy.js'

export const PROJECT_VERSION = 3
export const ROOT_FOLDER = 'Assets'
// Carpetas con las que nace un proyecto nuevo. Son carpetas normales: se pueden renombrar, mover y borrar (solo «Assets» es fija).
export const DEFAULT_FOLDERS = ['Assets', 'Assets/Scenes', CINEMATICS_FOLDER]
export const PREFAB_SUFFIX = '.prefab'

export const MODEL_EXT = ['glb', 'gltf', 'obj']
export const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp']
export const SCRIPT_EXT = ['js', 'mjs']
export const UI_EXT = ['ui']
export const SHADER_EXT = ['glsl', 'frag']
export const FONT_EXT = ['ttf', 'otf', 'woff', 'woff2']
export const AUDIO_KIND_EXT = ['mp3', 'wav', 'ogg', 'oga', 'flac', 'm4a', 'aac', 'opus', 'weba']

export const extOf = (name) => (/\.([^.]+)$/.exec(name || '')?.[1] || '').toLowerCase()
export const baseName = (name) => String(name || '').replace(/\.[^.]+$/, '')

/** Tipo de archivo del proyecto según su extensión. */
export function fileKind(name) {
  const e = extOf(name)
  if (MODEL_EXT.includes(e)) return 'model'
  if (IMAGE_EXT.includes(e)) return 'texture'
  if (e === 'gamemanager') return 'gamemanager'
  if (e === 'material') return 'material'
  if (e === 'vfx') return 'vfx'
  if (e === 'liquid') return 'liquid'
  if (e === 'post' || e === 'profile') return 'profile'
  if (SCRIPT_EXT.includes(e)) return 'script'
  if (UI_EXT.includes(e)) return 'ui'
  if (SHADER_EXT.includes(e)) return 'shader'
  if (AUDIO_KIND_EXT.includes(e)) return 'audio'
  if (FONT_EXT.includes(e)) return 'font'
  return 'file'
}
export const defaultFolderFor = (kind) => ({ gamemanager: MANAGER_FOLDER, profile: 'Assets/Profiles', material: MATERIAL_FOLDER, liquid: 'Assets/Liquids', vfx: 'Assets', scene: 'Assets/Scenes', prefab: 'Assets/Prefabs', model: 'Assets/Models', texture: 'Assets/Textures', script: 'Assets/Scripts', ui: 'Assets/UI', shader: 'Assets/Shaders', audio: 'Assets/Audio', font: 'Assets/Fonts' }[kind] || ROOT_FOLDER)

/** Nombre de archivo válido dentro de un zip/carpeta (sin separadores ni caracteres de control). */
export function sanitizeName(name, fallback = 'archivo') {
  const s = String(name || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/^\.+/, '').trim()
  return s || fallback
}

export function normFolder(path) {
  const parts = String(path || ROOT_FOLDER).split('/').map((p) => sanitizeName(p, '')).filter(Boolean)
  if (!parts.length || parts[0] !== ROOT_FOLDER) parts.unshift(ROOT_FOLDER)
  return parts.join('/')
}
export const parentFolder = (path) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : null)
export const folderName = (path) => path.slice(path.lastIndexOf('/') + 1)

/** Todas las entradas del sistema de archivos como una lista uniforme. */
export function allEntries(project, { includeTemporal = false } = {}) {
  const out = []
  for (const s of project.scenes || []) out.push({ kind: 'scene', id: s.id, name: s.name, folder: s.folder || 'Assets/Scenes', file: `${s.name}.scene.json`, ref: s })
  for (const f of project.prefabs || []) out.push({ kind: 'prefab', id: f.id, name: f.name, folder: f.folder || 'Assets/Prefabs', file: `${f.name}${PREFAB_SUFFIX}`, ref: f })
  for (const m of project.models || []) out.push({ kind: 'model', id: m.id, name: m.name, folder: m.folder || 'Assets/Models', file: m.name, ref: m })
  for (const c of project.scripts || []) out.push({ kind: 'script', id: c.id, name: c.name, folder: c.folder || 'Assets/Scripts', file: c.name, ref: c })
  for (const c of project.uis || []) out.push({ kind: 'ui', id: c.id, name: c.name, folder: c.folder || 'Assets/UI', file: c.name, ref: c })
  for (const c of project.shaders || []) out.push({ kind: 'shader', id: c.id, name: c.name, folder: c.folder || 'Assets/Shaders', file: c.name, ref: c })
  for (const c of project.gameManagers || []) out.push({ kind: 'gamemanager', id: c.id, name: c.name, folder: c.folder || MANAGER_FOLDER, file: c.name, ref: c })
  for (const c of project.profiles || []) out.push({ kind: 'profile', id: c.id, name: c.name, folder: c.folder || PROFILE_FOLDER, file: c.name, ref: c })
  for (const c of project.materials || []) out.push({ kind: 'material', id: c.id, name: c.name, folder: c.folder || MATERIAL_FOLDER, file: c.name, ref: c })
  for (const c of project.liquids || []) out.push({ kind: 'liquid', id: c.id, name: c.name, folder: c.folder, file: c.name, ref: c })
  for (const c of project.vfx || []) out.push({ kind: 'vfx', id: c.id, name: c.name, folder: c.folder, file: c.name, ref: c })
  for (const a of project.assets || []) out.push({ kind: a.kind || 'file', id: a.id, name: a.name, folder: a.folder || ROOT_FOLDER, file: a.name, ref: a })
  for (const ref of project.cinematics || []) out.push({ kind: 'cinematic', id: ref.id, name: ref.name, folder: ref.folder || CINEMATICS_FOLDER, file: `${ref.name}.cinematic`, ref, embedded: false })
  // Los recursos temporales se guardan en project.json. Solo Assets los proyecta como entradas.
  if (includeTemporal) {
    for (const ref of project.timelines || []) {
      if (ref.filmMaker?.nativeResourceId && (project.cinematics || []).some(c => c.id === ref.filmMaker.nativeResourceId)) continue
      out.push({ kind: isFilmMakerTimeline(ref) ? 'cinematic' : 'timeline', id: ref.id, name: ref.name, folder: isFilmMakerTimeline(ref) ? CINEMATICS_FOLDER : ref.folder || ROOT_FOLDER, file: ref.name, ref, embedded: true })
    }
    for (const ref of project.animations || []) out.push({ kind: 'animation', id: ref.id, name: ref.name, folder: ROOT_FOLDER, file: ref.name, ref, embedded: true })
  }
  return out
}

/** Nombre libre dentro de una carpeta (compara el nombre de archivo, sin distinguir mayúsculas). */
export function uniqueFileName(project, folder, name, { ignoreId = null, suffix = '' } = {}) {
  const taken = new Set(allEntries(project, { includeTemporal: true }).filter((e) => e.folder === folder && e.id !== ignoreId).map((e) => e.file.toLowerCase()))
  const clean = sanitizeName(name)
  const ext = extOf(clean)
  const base = ext ? clean.slice(0, -(ext.length + 1)) : clean
  const mk = (n) => `${base}${n ? ` ${n}` : ''}${ext ? '.' + ext : ''}`
  let i = 0
  while (taken.has((mk(i) + suffix).toLowerCase())) i++
  return mk(i)
}

export function uniqueSceneName(project, base) {
  const names = new Set((project.scenes || []).map((s) => s.name.toLowerCase()))
  const b = sanitizeName(base, 'Escena')
  if (!names.has(b.toLowerCase())) return b
  const root = b.replace(/ \d+$/, '')
  let i = 2
  while (names.has(`${root} ${i}`.toLowerCase())) i++
  return `${root} ${i}`
}

/** Base de datos de eventos: nombres de interruptores y variables (el id es la posición + 1). */
export { defaultDatabase }
export const defaultSettings = () => ({ snap: true, moveSnapOn: true, rotateSnapOn: true, scaleSnapOn: true, gridSize: 1, rotSnap: 15, scaleSnap: 0.25, exportPath: 'res://levels/' })
export const defaultEnvironment = () => ({
  lightingMode: 'manual', sunLightId: '', // nueva escena: una sola autoridad; escenas antiguas sin estos campos conservan su comportamiento
  skyTop: '#3f74b8', skyHorizon: '#b9d3ec', ground: '#5b5346',
  ambient: 0.55, ambientColor: '#b9d3ec', fog: false, fogDensity: 0.012, fogStart: 0, fogColor: '#aab8c9',
  fogMode: 'simple', fogFalloff: 0, fogHeight: 0, fogShafts: 1, fogScatter: 1, // niebla física (bloque D): altura, humedad, sol y haces; 'simple' = la exponencial de siempre
  ...WFX_DEFAULTS,
  ...normalizeWorld({}), // level · time · weather (Nombre del nivel, hora del día, clima y viento)
})

/** Datos de una escena nueva: lo que declara la plantilla; nunca crea un Spawn implícito. */
export function validateSignalConnections(value) {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error('signalConnections debe ser una lista de conexiones')
  const ids = new Set(), links = new Set()
  for (const [index, c] of value.entries()) {
    if (!c || typeof c !== 'object' || Array.isArray(c)) throw new Error(`Conexión de señal inválida en posición ${index}`)
    for (const key of ['id', 'emitterId', 'signal', 'receiverId', 'method']) {
      if (typeof c[key] !== 'string' || !c[key].trim() || c[key] !== c[key].trim()) {
        throw new Error(`Conexión ${index}: campo ${key} inválido`)
      }
    }
    if (ids.has(c.id)) throw new Error(`ID de conexión duplicado: ${c.id}`)
    ids.add(c.id)
    const unique = JSON.stringify([c.emitterId, c.signal, c.receiverId, c.method])
    if (links.has(unique)) throw new Error(`Conexión de señal duplicada: ${c.id}`)
    links.add(unique)
  }
  return value
}

/** Copia solo enlaces completamente internos y asigna identidad nueva a cada conexión. */
export function remapSignalConnections(connections, ids, makeId = () => uid('sig')) {
  const mapping = ids instanceof Map ? ids : new Map(Object.entries(ids || {}))
  return validateSignalConnections(connections || [])
    .filter((c) => mapping.has(c.emitterId) && mapping.has(c.receiverId))
    .map((c) => ({ ...c, id: makeId(), emitterId: mapping.get(c.emitterId), receiverId: mapping.get(c.receiverId) }))
}

/** Instancia el árbol persistido de un Prefab sin modificar el recurso original.
 * Compartida por el Editor y PlayMode; las conexiones solo pueden apuntar al subárbol.
 */
export function materializePrefab(pf, parentId = null, makeId = uid) {
  const source = pf?.objects
  if (!Array.isArray(source) || !source.length || source[0]?.parentId != null)
    throw new Error('Prefab inválido: debe contener una raíz sin padre')
  const ids = new Set(source.map(o => o?.id))
  if (ids.size !== source.length || ids.has(undefined) || source.some((o, i) => i && !ids.has(o.parentId)))
    throw new Error('Prefab inválido: identificadores o jerarquía incompatibles')
  validateNodeTree(source)
  const remap = new Map(source.map(o => [o.id, makeId()]))
  if (new Set(remap.values()).size !== remap.size) throw new Error('Prefab: colisión de identificadores')
  const objects = source.map((o, index) => {
    const copy = migrateNodeScripts(JSON.parse(JSON.stringify(o)))
    delete copy.prefabId; delete copy.prefabRev
    copy.id = remap.get(o.id)
    copy.parentId = index === 0 ? parentId : remap.get(o.parentId)
    return copy
  })
  return { objects, connections: remapSignalConnections(pf.signalConnections || [], remap) }
}

/** Normaliza la autoría de Scripts de Nodo sin perder identidades ni orden. */
export function migrateNodeScripts(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('Nodo inválido para migrar scripts')
  if (!Object.hasOwn(obj, 'scriptIds')) obj.scriptIds = obj.scriptId ? [obj.scriptId] : []
  if (!Array.isArray(obj.scriptIds) || obj.scriptIds.some(id => typeof id !== 'string' || !id.trim() || id !== id.trim()) ||
      new Set(obj.scriptIds).size !== obj.scriptIds.length) throw new Error(`Scripts de Nodo inválidos en ${obj.name || obj.id}`)
  delete obj.scriptId
  return obj
}

export function migrateScene(scene) {
  if (!scene) return scene
  // Una escena antigua no tiene conexiones. Los datos corruptos se rechazan, nunca se borran.
  scene.signalConnections = validateSignalConnections(scene.signalConnections)
  // Terreno pasa a ser un nodo real. Las piezas siguen siendo la única fuente de alturas,
  // pintura y vegetación; el nodo comparte su ID y solo representa identidad de escena.
  if (scene.terrain) {
    scene.objects ||= []
    const pieces = [scene.terrain, ...(scene.terrain.extra || [])]
    for (const piece of pieces) {
      if (!piece.id) piece.id = uid('terrain') // identidad persistente para escenas antiguas
      const node = scene.objects.find(o => o.id === piece.id && o.type === 'terrain')
      if (piece.enabled === false) {
        if (node) scene.objects.splice(scene.objects.indexOf(node), 1)
        continue
      }
      if (!node) scene.objects.push(makeObject('terrain', 'terrain', {
        id: piece.id, name: piece.name || 'Terreno', visible: piece.visible !== false,
        props: { terrainId: piece.id },
      }))
    }
    const ids = new Set(pieces.filter(p => p.enabled !== false).map(p => p.id))
    scene.objects = scene.objects.filter(o => o.type !== 'terrain' || ids.has(o.id))
  }
  for (const o of scene?.objects || []) {
    // Lista ordenada como única fuente; no borrar referencias a recursos ausentes.
    migrateNodeScripts(o)
    migrateObjectGroups(o)
    if (o.type === 'primitive' && o.props?.csg === 'subtract') {
      o.type = 'subtract'
      o.kind = ['box', 'cylinder', 'stairs'].includes(o.kind) ? o.kind : 'box'
      o.collision = false
      delete o.props.csg
    }
  }
  // Escena ▸ Nivel · Hora · Clima (core/world): las escenas anteriores reciben los valores por defecto (todo desactivado)
  if (scene?.environment) Object.assign(scene.environment, normalizeWorld(scene.environment))
  return scene
}

export function createSceneContent(templateId = DEFAULT_TEMPLATE) {
  const spec = getTemplate(templateId).scene || []
  return {
    environment: defaultEnvironment(),
    terrain: { size: 64, segments: 128, enabled: !getTemplate(templateId).emptyDatabase, layers: DEFAULT_LAYERS.map((l) => ({ ...l })), foliage: [] },
    objects: spec.map(([type, kind, extra]) => makeObject(type, kind, { ...extra, id: uid() })),
    signalConnections: [],
  }
}

export function createProjectData(name = 'Nivel nuevo', templateId = DEFAULT_TEMPLATE, { renderer = null } = {}) {
  const tpl = getTemplate(templateId)
  const resources = tpl.createResources?.({ uid, makeObject })
  const scene = { id: uid('s'), name: 'Escena 1', folder: 'Assets/Scenes', transitions: { ...SCENE_FADE_DEFAULTS } }
  return {
    version: PROJECT_VERSION,
    id: uid('p'),
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    runtimeFormat: FORMAT_VERSION, // versión del formato de los datos que interpreta el Runtime (engine/runtime/format.js); ensureFs NO la rellena: ausente = 1
    settings: defaultSettings(),
    scenes: [scene],
    activeSceneId: scene.id,
    folders: [...DEFAULT_FOLDERS, ...(resources?.folders || [])],
    prefabs: resources?.prefabs || [],
    meshes: [], // geometrías vinculadas (Alt+D), compartidas entre escenas
    models: [],
    assets: [],
    scripts: resources?.scripts || [], // scripts JS del proyecto (Assets/Scripts): { id, name, folder, code }
    shaders: [], // shaders GLSL del proyecto (Assets/Shaders): { id, name, folder, code }
    render: renderer ? rendererPreset(renderer) : presetOf('realista'), // look de la escena y perfil de calidad (Ajustes → Render); los proyectos anteriores se ven como antes (clásico)
    audio: defaultAudio(), // mezclador de audio (grupos, efectos)
    localization: normalizeLoc(null), // idiomas, textos por clave y voces (i18n/localization.js)
    bake: { ...BAKE_DEFAULTS }, // ajustes del horneado de luz (Escena ▸ Iluminación)
    database: tpl.emptyDatabase ? emptyDatabase() : defaultDatabase(),
    gameManagers: [], // recursos de configuración de escenas (Assets/GameManagers/*.gamemanager)
    liquids: [], // perfiles .liquid de autoría, sin contenido dinámico de recipientes
    vfx: [], // definiciones VFX compartidas, sin simulación temporal
    materials: [], // recursos compartidos (Assets/Materials/*.material); local legacy vive en obj
    profiles: [], // perfiles de post-proceso (Assets/Profiles/*.post y *.profile): core/render/profiles.js
    inputMap: tpl.emptyBindings
      ? { actions: defaultInputMap().actions.map((a) => ({ ...a, bindings: [] })) }
      : defaultInputMap(), // Input Map del proyecto: acciones y sus entradas (core/input/inputmap.js)
    tagLayers: defaultTagLayers(), // Registro de Groups y Layers; tags antiguos permanecen para compatibilidad
    animations: [], // clips de animación por claves (pestaña Animación)
    timelines: [], // Timeline de gameplay y cachés derivados para el Player
    cinematics: [], // recursos de autoría nativa de Nether FilmMaker
    captures: [], // capturas de movimiento importadas (.lfcap → clips de huesos de un modelo)
    theme: defaultTheme(), // tema de la interfaz del motor (fuente, colores, ventanas, velocidad del texto)
    template: tpl.id,
    game: { ...tpl.game },
    uis: [], // los .ui del sistema se crean abajo en ensureFs; los Canvas propios siguen separados
    ui: { slots: emptySlots() }, // DEPRECATED: roles del sistema (hud/diálogo/…); solo se conserva para proyectos anteriores
    ...createSceneContent(tpl.id),
  }
}

/** Campos que pertenecen a la escena (no al proyecto). */
export const SCENE_KEYS = ['objects', 'environment', 'terrain', 'signalConnections']

/** Identidad editorial por escena: nunca depende de la selección ni crea un controlador físico. */
export function resolveScenePlayerNode(scene, objects = []) {
  const id = scene?.playerNodeId || ''
  if (!id) return { status: 'unassigned', id: '', node: null }
  if (typeof id !== 'string') return { status: 'invalid', id, node: null }
  const matches = (objects || []).filter((o) => o.id === id)
  if (!matches.length) return { status: 'missing', id, node: null }
  if (matches.length > 1) return { status: 'ambiguous', id, node: null }
  const node = matches[0]
  if (node.type !== 'characterbody3d') return { status: 'wrong-type', id, node }
  if (!nodeEffectiveActive(objects, node)) return { status: 'inactive', id, node }
  return { status: 'valid', id, node }
}


/** Separa un proyecto en memoria en { meta, scene } para guardarlo. `terrainData` = terreno serializado. */
export function splitProject(project, terrainData) {
  const meta = {}
  for (const k of Object.keys(project)) if (!SCENE_KEYS.includes(k) && k !== 'thumb') meta[k] = project[k]
  const tree = authoredSceneTree(project)
  const scene = { objects: toRaw(tree.objects), environment: toRaw(project.environment), terrain: terrainData, signalConnections: toRaw(validateSignalConnections(tree.signalConnections)) }
  // toRaw: serializar los proxies reactivos es varias veces más lento que los objetos planos
  return { meta: JSON.parse(strictJson(meta, "Proyecto")), scene: JSON.parse(strictJson(scene, "Escena")) }
}

/** Proyectos v1/v2 (una sola escena embebida) → v3. Devuelve { meta, scene } y no toca el original. */
export function migrateRecord(rec) {
  rec = JSON.parse(JSON.stringify(rec))
  const fixObjs = (objs) => {
    for (const o of objs || []) {
      if (o.parentId === undefined) o.parentId = null
      if (o.open === undefined) o.open = true
    }
  }
  if (rec.version >= 3 && rec.scenes) {
    const { thumb, objects, environment, terrain, signalConnections, ...meta } = rec
    fixObjs(objects)
    ensureFs(meta)
    return { meta, scene: objects ? migrateScene({ objects, environment, terrain, signalConnections }) : null }
  }
  // v2: todo dentro del registro
  fixObjs(rec.objects)
  const scene = { id: uid('s'), name: rec.name || 'Escena 1', folder: 'Assets/Scenes' }
  const { thumb, objects, environment, terrain, signalConnections, ...meta } = rec
  meta.version = PROJECT_VERSION
  meta.scenes = [scene]
  meta.activeSceneId = scene.id
  meta.assets = meta.assets || []
  meta.models = (meta.models || []).map((m) => ({ ...m }))
  ensureFs(meta)
  return { meta, scene: migrateScene({ objects, environment, terrain, signalConnections }) }
}

/** Garantiza carpetas y rutas coherentes en los metadatos de un proyecto. */
export function ensureFs(meta) {
  meta.folders = meta.folders || []
  if (!meta.folders.includes(ROOT_FOLDER)) meta.folders.unshift(ROOT_FOLDER)
  meta.scenes = meta.scenes || []
  meta.prefabs = meta.prefabs || []
  for (const f of meta.prefabs) { f.folder = normFolder(f.folder || 'Assets/Prefabs'); f.rev = f.rev || 1 }
  meta.meshes = Array.isArray(meta.meshes) ? meta.meshes : []
  meta.models = meta.models || []
  meta.assets = meta.assets || []
  meta.scripts = meta.scripts || []
  meta.shaders = meta.shaders || []
  meta.materials = normalizeMaterials(meta.materials)
  meta.vfx = normalizeVfxCollection(meta.vfx)
  meta.liquids = Array.isArray(meta.liquids) ? meta.liquids.map((v)=>normalizeLiquid(v,{resource:true})) : []
  if(new Set(meta.liquids.map((v)=>v.id)).size!==meta.liquids.length) throw new Error('Líquido: IDs duplicados')
  meta.render = normalizeRender(meta.render)
  meta.bake = normalizeBake(meta.bake)
  meta.audio = normalizeAudio(meta.audio)
  meta.localization = normalizeLoc(meta.localization)
  meta.database = normalizeDatabase(meta.database, meta.game)
  meta.tagLayers = normalizeTagLayers(meta.tagLayers)
  for (const prefab of meta.prefabs) for (const obj of prefab.objects || []) {
    migrateNodeScripts(obj)
    migrateObjectGroups(obj)
  }
  meta.inputMap = normalizeInputMap(meta.inputMap)
  meta.gameManagers = Array.isArray(meta.gameManagers) ? meta.gameManagers.map(normalizeGameManager) : []
  for (const gm of meta.gameManagers) gm.folder = normFolder(gm.folder || MANAGER_FOLDER)
  meta.profiles = normalizeProfiles(meta.profiles)
  for (const pr of meta.profiles) pr.folder = normFolder(pr.folder || PROFILE_FOLDER)
  meta.theme = normalizeTheme(meta.theme)
  meta.cinematics = Array.isArray(meta.cinematics) ? meta.cinematics : []
  if (new Set(meta.cinematics.map(c => c.id)).size !== meta.cinematics.length) throw new Error('Cinematic: IDs duplicados')
  for (const movie of meta.cinematics) {
    if (!movie?.id || !movie.sceneId || !meta.scenes.some(s => s.id === movie.sceneId)) throw new Error('Cinematic: recurso inválido')
    movie.folder = normFolder(movie.folder || CINEMATICS_FOLDER)
    if (typeof movie.name !== 'string' || !movie.name.trim()) throw new Error('Cinematic: nombre inválido')
    if (typeof movie.revision !== 'string' || !movie.revision) throw new Error('Cinematic: control de edición inválido')
    addFolderChain(meta, movie.folder)
  }
  const names = new Set()
  for (const movie of meta.cinematics) {
    const path = `${movie.folder}/${movie.name}.cinematic`.toLocaleLowerCase()
    if (names.has(path)) throw new Error('Cinematic: ruta de recurso duplicada')
    names.add(path)
  }
  meta.timelines = normalizeTimelines(meta.timelines)
  for (const timeline of meta.timelines.filter(t => !isFilmMakerTimeline(t))) {
    if (timeline.folder && (timeline.folder === CINEMATICS_FOLDER || timeline.folder.startsWith(CINEMATICS_FOLDER + '/') || isSystemUiPath(timeline.folder))) timeline.folder = ROOT_FOLDER
    if (timeline.folder) addFolderChain(meta, timeline.folder)
  }
  if (meta.timelines.some(isFilmMakerTimeline) && !meta.folders.includes(CINEMATICS_FOLDER)) addFolderChain(meta, CINEMATICS_FOLDER)
  meta.animations = normalizeClips(meta.animations)
  meta.captures = normalizeCaptureClips(meta.captures)
  meta.template = meta.template || LEGACY_TEMPLATE
  meta.game = { ...GAME_DEFAULTS, ...(meta.game || {}) }
  if (!Array.isArray(meta.uis)) meta.uis = []
  ensureSystemUi(meta) // Si el proyecto es antiguo, añadimos los recursos nativos sin tocar sus Canvas.
  meta.ui = { slots: { ...emptySlots(), ...(meta.ui?.slots || {}) } }
  for (const c of meta.uis) { c.folder = normFolder(c.folder || 'Assets/UI'); c.code = c.code ?? '' }
  for (const s of meta.scenes) { s.folder = normFolder(s.folder || 'Assets/Scenes'); if (typeof s.gameManagerId !== 'string') s.gameManagerId = '' }
  for (const m of meta.models) { m.folder = normFolder(m.folder || 'Assets/Models'); m.ext = m.ext || extOf(m.name) }
  for (const c of meta.shaders) {
    c.folder = normFolder(c.folder || 'Assets/Shaders'); c.code = c.code ?? ''
    if (c.graph) { const r = compileGraph(c.graph, String(c.name).replace(/\.glsl$/, '')); c.graph = r.graph; c.code = r.code } // Shader Graph: el GLSL se regenera siempre
  }
  for (const c of meta.scripts) { c.folder = normFolder(c.folder || 'Assets/Scripts'); c.code = c.code ?? '' }
  for (const a of meta.assets) { a.folder = normFolder(a.folder || ROOT_FOLDER); a.kind = a.kind || fileKind(a.name); a.ext = a.ext || extOf(a.name) }
  // Las entradas VFX no pueden compartir ID o ruta con un asset existente de otra colección.
  if (meta.liquids.length) {
    const entries=allEntries(meta)
    const others=entries.filter((e)=>e.kind!=='liquid')
    for (const liquid of meta.liquids) if (others.some((e)=>e.id===liquid.id || `${e.folder}/${e.file}`.toLowerCase()===`${liquid.folder}/${liquid.name}`.toLowerCase()))
      throw new Error('Líquido: ID o ruta ya utilizada por otro recurso')
  }
  if (meta.vfx.length) {
    const entries = allEntries(meta)
    const occupiedIds = new Set(entries.filter((e) => e.kind !== 'vfx').map((e) => e.id))
    const occupiedPaths = new Set(entries.filter((e) => e.kind !== 'vfx').map((e) => `${e.folder}/${e.file}`.toLowerCase()))
    for (const e of entries.filter((e) => e.kind === 'vfx')) {
      if (occupiedIds.has(e.id) || occupiedPaths.has(`${e.folder}/${e.file}`.toLowerCase())) {
        throw new Error(`VFX: ID o archivo ocupado por otro recurso (${e.id})`)
      }
    }
  }
  for (const e of allEntries(meta)) if (!meta.folders.includes(e.folder)) addFolderChain(meta, e.folder)
  const oldSnap = meta.settings || {}
  meta.settings = {
    ...defaultSettings(), ...oldSnap,
    moveSnapOn: oldSnap.moveSnapOn ?? oldSnap.snap ?? true,
    rotateSnapOn: oldSnap.rotateSnapOn ?? oldSnap.snap ?? true,
    scaleSnapOn: oldSnap.scaleSnapOn ?? oldSnap.snap ?? true,
  }
  // `snap` conserva la compatibilidad con carretera y colocación sobre rejilla.
  meta.settings.snap = meta.settings.moveSnapOn
  if (!meta.activeSceneId || !meta.scenes.some((s) => s.id === meta.activeSceneId)) meta.activeSceneId = meta.scenes[0]?.id
  return meta
}

export function addFolderChain(meta, path) {
  const parts = normFolder(path).split('/')
  for (let i = 1; i <= parts.length; i++) {
    const p = parts.slice(0, i).join('/')
    if (!meta.folders.includes(p)) meta.folders.push(p)
  }
}
