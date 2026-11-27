// .levelpackage: selección de recursos del proyecto con sus dependencias.
// No es un .lfproj ni el paquete del juego: la importación se implementará en G002.
import { normalizeTimeline, TIMELINE_REF_FIELDS } from './timeline/model.js'
import { allEntries, ROOT_FOLDER, validateSignalConnections } from './project.js'
import { isSystemUi, isSystemUiPath } from '../engine/runtime/ui/system.js'
import { normalizeLiquid } from '../engine/runtime/geometry/liquid-containers.js'
import { validateVfxResource } from '../engine/runtime/vfx/resource.js'

export const LEVELPACKAGE_FORMAT = 'levelforge-package'
export const LEVELPACKAGE_VERSION = 1
const TEXT_KINDS = new Set(['script', 'ui', 'shader'])
const storedPath = (entry) => `${entry.folder}/${entry.file}`
const inside = (path, folder) => path === folder || path.startsWith(folder + '/')
const allowedPath = (path) => path.startsWith(ROOT_FOLDER + '/') && !path.split('/').some((part) => !part || part === '.' || part === '..' || /[\\\u0000-\u001f]/.test(part))
const toPlain = (value) => JSON.parse(JSON.stringify(value))

// Datos de proyecto compartidos por una escena; G002 decidirá cómo conciliarlos con el destino.
const contextKeys = ['database', 'animations', 'timelines', 'captures', 'inputMap', 'tagLayers', 'localization', 'theme', 'render', 'bake', 'audio', 'game', 'settings', 'template', 'ui']
function sceneContext(meta) {
  const result = {}
  for (const k of contextKeys) if (meta[k] !== undefined) {
    // El contexto de .levelpackage no transporta el cuerpo Cinematic nativo:
    // tampoco debe copiar una proyección de Player sin su recurso fuente.
    result[k] = k === 'timelines'
      ? toPlain(meta.timelines.filter(t => !t.filmMaker?.nativeResourceId))
      : toPlain(meta[k])
  }
  return result
}

// Un .levelpackage se puede importar en otro proyecto: incluye las mallas por valor, sin IDs externos.
function payloadOf(entry, scenes, meta) {
  if (entry.kind === 'scene' || entry.kind === 'prefab') {
    const data = toPlain(entry.kind === 'scene' ? scenes.get(entry.id) : { objects: entry.ref.objects || [], signalConnections: entry.ref.signalConnections || [] })
    if (data?.signalConnections !== undefined) validateSignalConnections(data.signalConnections)
    for (const o of data?.objects || []) {
      if (!o.props?.meshRef) continue
      const resource = (meta.meshes || []).find((m) => m.id === o.props.meshRef)
      if (!resource) throw new Error(`Geometría vinculada sin recurso: ${o.name || o.id}`)
      o.props.mesh = toPlain(resource.mesh)
      delete o.props.meshRef
    }
    return data
  }
  if (entry.kind === 'timeline') return normalizeTimeline(toPlain(entry.ref))
  if (TEXT_KINDS.has(entry.kind)) return entry.ref.code || ''
  if (entry.kind === 'vfx') return validateVfxResource(toPlain(entry.ref))
  if (entry.kind === 'liquid') return normalizeLiquid(toPlain(entry.ref),{resource:true})
  if (entry.kind === 'profile' || entry.kind === 'gamemanager' || entry.kind === 'material') return toPlain(entry.ref)
  return null // Los demás recursos son binarios, obtenidos desde IndexedDB.
}

/**
 * Cierra la selección sobre los IDs conocidos. No modifica el proyecto.
 * Selección: [{kind:'folder',id:'Assets/…'} | {kind,id}].
 */
export function resolveLevelPackageSelection({ meta, scenes, selection }) {
  if (!meta || !(scenes instanceof Map)) throw new Error('El proyecto y sus escenas son necesarios')
  const entries = allEntries(meta, { includeTemporal: true }).filter(e => e.kind !== 'cinematic' && (!e.embedded || (e.kind === 'timeline' && !e.ref?.filmMaker?.nativeResourceId))).filter((e) => !isSystemUi(e.ref) && !isSystemUiPath(e.folder))
  const byId = new Map()
  const byPath = new Map()
  for (const entry of entries) {
    if (byId.has(entry.id)) throw new Error(`Identificador duplicado en el proyecto: ${entry.id}`)
    const path = storedPath(entry)
    if (!allowedPath(path)) throw new Error(`Ruta no válida: ${path}`)
    if (byPath.has(path.toLowerCase())) throw new Error(`Ruta duplicada en el proyecto: ${path}`)
    byId.set(entry.id, entry)
    byPath.set(path.toLowerCase(), entry.id)
  }
  const roots = new Set()
  for (const sel of selection || []) {
    if (sel.kind === 'folder') {
      if (isSystemUiPath(sel.id)) throw new Error('No se puede exportar la interfaz del sistema')
      const folder = sel.id
      for (const e of entries) if (inside(e.folder, folder)) roots.add(e.id)
    } else {
      const e = byId.get(sel.id)
      if (!e || e.kind !== sel.kind) throw new Error(`Recurso seleccionado no encontrado: ${sel.kind}:${sel.id}`)
      roots.add(e.id)
    }
  }
  if (!roots.size) throw new Error('Selecciona archivos o carpetas con contenido para exportar')

  const selected = new Set(roots)
  const direct = new Map()
  const missing = new Set()
  // En las escenas se guarda también la configuración global necesaria para eventos y runtime.
  const context = [...roots].some((id) => byId.get(id)?.kind === 'scene') ? sceneContext(meta) : null
  const queue = [...roots]
  let contextScanned = false
  function scan(data, owner) {
    if (data == null) return
    const source = typeof data === 'string' ? data : JSON.stringify(data)
    const deps = new Set()
    for (const [id, entry] of byId) {
      // Detecta referencias por ID exacto, también dentro de páginas de eventos y código fuente.
      // Incluye rutas literales de Assets que puedan aparecer en shaders o scripts.
      const pattern = new RegExp(`(^|[^a-zA-Z0-9_])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-zA-Z0-9_])`)
      if (pattern.test(source) || source.includes(storedPath(entry))) {
        if (id !== owner) deps.add(id)
      }
    }
    // Solo se denuncian referencias ausentes cuando el campo indica inequívocamente un Asset.
    // Los IDs de scripts son dependencias obligatorias, no simples textos opcionales.
    const visitNodeScripts = (v) => {
      if (!v || typeof v !== 'object') return
      if (Array.isArray(v.objects)) for (const obj of v.objects) {
        const ids = Object.hasOwn(obj, 'scriptIds') ? obj.scriptIds : obj.scriptId ? [obj.scriptId] : []
        if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string' || !id.trim() || id !== id.trim()) || new Set(ids).size !== ids.length)
          throw new Error(`Scripts de Nodo inválidos en ${obj.name || obj.id}`)
        for (const scriptId of ids) {
          const script = byId.get(scriptId)
          if (!script || script.kind !== 'script' || script.ref.execution !== 'node') {
            missing.add(`Script de Nodo: ${scriptId} (${obj.name || obj.id})`)
          } else if (scriptId !== owner) deps.add(scriptId)
        }
      }
    }
    if (typeof data !== 'string') visitNodeScripts(data)
    const refKeys = new Set(['modelId', 'prefabId', 'shaderId', 'postShader', 'scriptId', 'profileId', 'materialId', 'gameManagerId', 'textureId', 'assetId', 'audioId', 'fontId', 'imageId', 'texture', 'image', 'profile', 'vfxId',  'liquidId', 'sceneId'])
    const visit = (v) => {
      if (!v || typeof v !== 'object') return
      for (const [key, value] of Object.entries(v)) {
        if (TIMELINE_REF_FIELDS.has(key) && typeof value === 'string' && value) {
          const target = entries.find(e => e.kind === 'timeline' && (e.id === value || e.name === value))
          if (!target) missing.add(`Timeline: ${value}`)
          else if (target.id !== owner) deps.add(target.id)
        }
        if (refKeys.has(key) && typeof value === 'string' && /^[a-z]{1,3}_[a-z0-9]+$/i.test(value) && !byId.has(value)) missing.add(`${key}: ${value}`)
        if (typeof value === 'object') visit(value)
      }
    }
    if (typeof data !== 'string') visit(data)
    for (const id of deps) if (!selected.has(id)) { selected.add(id); queue.push(id) }
    return [...deps].sort()
  }
  while (queue.length) {
    const id = queue.shift()
    const entry = byId.get(id)
    const payload = payloadOf(entry, scenes, meta)
    if (entry.kind === 'timeline') {
      for (const track of payload.tracks.filter(t => t.kind === 'audio')) for (const key of track.keys) {
        if (key.action === 'stop' || !key.clip) continue
        const audio = entries.find(e => e.id === key.clip || (e.kind === 'audio' && e.name === key.clip))
        if (!audio || audio.kind !== 'audio') throw new Error(`Audio ausente del Timeline: ${key.clip}`)
        if (!selected.has(audio.id)) { selected.add(audio.id); queue.push(audio.id) }
      }
    }
    if (entry.kind === 'scene' && payload == null) throw new Error(`Falta la escena seleccionada: ${entry.name}`)
    const audioIds = entry.kind === 'timeline' ? payload.tracks.filter(t => t.kind === 'audio').flatMap(t => t.keys.filter(k => k.action !== 'stop' && k.clip).map(k => entries.find(e => e.kind === 'audio' && (e.id === k.clip || e.name === k.clip))?.id).filter(Boolean)) : []
    direct.set(id, [...new Set([...audioIds,...(scan(payload, id) || []), ...(entry.kind === 'scene' ? scan(entry.ref, id) || [] : [])])])
    if (entry.kind === 'scene' && context && !contextScanned) {
      contextScanned = true
      scan(context, null)
    }
  }
  if (missing.size) throw new Error(`Referencias a recursos inexistentes: ${[...missing].join(', ')}`)
  const chosen = [...selected].map((id) => byId.get(id)).sort((a, b) => storedPath(a).localeCompare(storedPath(b), 'en'))
  const folderSet = new Set([ROOT_FOLDER])
  for (const e of chosen) {
    const bits = e.folder.split('/')
    for (let n = 1; n <= bits.length; n++) folderSet.add(bits.slice(0, n).join('/'))
  }
  return {
    roots: [...roots].sort().map((id) => ({ kind: byId.get(id).kind, id })),
    entries: chosen,
    dependencyIds: direct,
    folders: [...folderSet].sort(),
    context,
    dependenciesAdded: selected.size - roots.size,
  }
}

/** Construye un ZIP autónomo, sin modificar proyecto ni IndexedDB. Falla si falta un recurso. */
export async function buildLevelPackage({ meta, scenes, files, selection, plan = null }) {
  const resolved = plan || resolveLevelPackageSelection({ meta, scenes, selection })
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const manifest = {
    format: LEVELPACKAGE_FORMAT, version: LEVELPACKAGE_VERSION, app: 'Century',
    exportedAt: new Date().toISOString(),
    sourceProject: { id: meta.id, name: meta.name, version: meta.version },
    roots: resolved.roots, folders: resolved.folders, context: resolved.context,
    entries: [],
  }
  for (const e of resolved.entries) {
    const path = storedPath(e)
    const ref = toPlain(e.ref)
    // El contenido vive en el archivo del ZIP; no se duplica en el manifiesto.
    if (e.kind === 'prefab') { delete ref.objects; delete ref.signalConnections }
    if (TEXT_KINDS.has(e.kind)) delete ref.code
    if (e.kind === 'profile' || e.kind === 'gamemanager' || e.kind === 'material' || e.kind === 'vfx' || e.kind === 'liquid' || e.kind === 'timeline') { for (const key of Object.keys(ref)) if (!['id', 'name', 'folder', 'kind'].includes(key)) delete ref[key] }
    const record = { kind: e.kind, id: e.id, name: e.name, folder: e.folder, file: e.file, path,
      dependencies: resolved.dependencyIds.get(e.id) || [], metadata: ref }
    let data = payloadOf(e, scenes, meta)
    if (e.kind === 'scene' && data == null) throw new Error(`La escena «${e.name}» no tiene contenido`)
    if (e.kind === 'scene' || e.kind === 'prefab' || e.kind === 'profile' || e.kind === 'gamemanager' || e.kind === 'material' || e.kind === 'vfx' || e.kind === 'liquid' || e.kind === 'timeline') data = JSON.stringify(data)
    if (data == null) {
      const bytes = files?.get(e.id)
      if (!bytes) throw new Error(`No se encuentra el recurso «${path}» en IndexedDB`)
      data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
    }
    zip.file(path, data)
    manifest.entries.push(record)
  }
  zip.file('levelpackage.json', JSON.stringify(manifest, null, 2))
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  return { blob, manifest }
}
