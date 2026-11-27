// Importación .levelpackage: validar y planificar en memoria antes de escribir IndexedDB.
// No modifica el proyecto; el commit atómico pertenece a state/project.js.
import { normalizeTimeline, isFilmMakerTimeline, TIMELINE_REF_FIELDS } from './timeline/model.js'
import { allEntries, ROOT_FOLDER, sanitizeName, validateSignalConnections, remapSignalConnections, migrateNodeScripts } from './project.js'
import { isSystemUiPath } from '../engine/runtime/ui/system.js'
import { LEVELPACKAGE_FORMAT, LEVELPACKAGE_VERSION } from './levelpackage.js'
import { normalizeMaterial } from '../engine/runtime/render/material-resource.js'
import { normalizeLiquid } from '../engine/runtime/geometry/liquid-containers.js'
import { validateVfxResource } from '../engine/runtime/vfx/resource.js'

const MAX_PACKAGE_BYTES = 96 * 1024 * 1024
const MAX_ENTRY_BYTES = 64 * 1024 * 1024
const MAX_TOTAL_BYTES = 256 * 1024 * 1024
const MAX_ENTRIES = 500
const textKinds = new Set(['script', 'shader', 'ui'])
const allowedKinds = new Set(['timeline', 'scene', 'prefab', 'model', 'script', 'shader', 'ui', 'profile', 'gamemanager', 'material', 'vfx', 'liquid', 'texture', 'audio', 'font', 'file'])
const collection = (kind) => ({ timeline: 'timelines', scene: 'scenes', prefab: 'prefabs', model: 'models', script: 'scripts', shader: 'shaders', ui: 'uis', profile: 'profiles', material: 'materials', gamemanager: 'gameManagers', vfx: 'vfx', liquid: 'liquids' }[kind] || 'assets')
const plain = (v) => JSON.parse(JSON.stringify(v))
const validPath = (path) => typeof path === 'string' && path.startsWith(ROOT_FOLDER + '/') && path.length <= 600 && !path.split('/').some((p) => !p || p === '.' || p === '..' || /[\\\u0000-\u001f]/.test(p))
const actualFile = (entry) => entry.kind === 'scene' ? `${entry.name}.scene.json` : entry.kind === 'prefab' ? `${entry.name}.prefab` : entry.name
const validId = (id) => typeof id === 'string' && /^[a-zA-Z][a-zA-Z0-9_-]{0,127}$/.test(id)
const must = (ok, message) => { if (!ok) throw new Error(message) }
const bytesSize = (bytes) => bytes?.byteLength ?? bytes?.length ?? 0

/** Comprueba que un manifiesto G001 sea autosuficiente y que el ZIP no contenga rutas ni entradas ajenas. */
export function validateLevelPackageManifest(manifest, paths) {
  must(manifest && typeof manifest === 'object' && !Array.isArray(manifest), 'Manifiesto inválido')
  must(manifest.format === LEVELPACKAGE_FORMAT && manifest.version === LEVELPACKAGE_VERSION, 'Versión o formato .levelpackage incompatible')
  must(Array.isArray(manifest.entries) && manifest.entries.length > 0 && manifest.entries.length <= MAX_ENTRIES, 'Cantidad de recursos no admitida')
  must(Array.isArray(manifest.roots) && Array.isArray(manifest.folders), 'Selección o carpetas ausentes')
  const ids = new Set(), names = new Set()
  for (const folder of manifest.folders) must(folder === ROOT_FOLDER || validPath(folder + '/_'), `Carpeta inválida: ${folder}`)
  const archivePaths = new Set(paths)
  must(archivePaths.size === paths.length && archivePaths.has('levelpackage.json'), 'Entradas ZIP repetidas o sin manifiesto')
  for (const path of paths) must(path === 'levelpackage.json' || validPath(path), `Ruta peligrosa en ZIP: ${path}`)
  for (const e of manifest.entries) {
    must(e && allowedKinds.has(e.kind) && validId(e.id), 'Tipo o ID inválido en paquete')
    must(typeof e.name === 'string' && e.name.length <= 255 && e.name === sanitizeName(e.name), `Nombre inválido: ${e.id}`)
    must(validPath(e.path) && e.folder === e.path.slice(0, e.path.lastIndexOf('/')) && e.file === actualFile(e) && e.path === `${e.folder}/${e.file}`, `Ruta incoherente: ${e.id}`)
    must(!isSystemUiPath(e.folder), 'El paquete contiene una interfaz reservada del sistema')
    must(e.metadata && typeof e.metadata === 'object' && !Array.isArray(e.metadata), `Metadatos inválidos: ${e.id}`)
    must(Array.isArray(e.dependencies), `Dependencias inválidas: ${e.id}`)
    must(!ids.has(e.id) && !names.has(e.path.toLowerCase()), `ID o ruta duplicada: ${e.id}`)
    must(archivePaths.has(e.path), `Falta el contenido: ${e.path}`)
    ids.add(e.id); names.add(e.path.toLowerCase())
  }
  for (const e of manifest.entries) for (const dep of e.dependencies) must(ids.has(dep) && dep !== e.id, `Dependencia ausente de ${e.id}: ${dep}`)
  for (const r of manifest.roots) must(r && ids.has(r.id) && manifest.entries.some((e) => e.id === r.id && e.kind === r.kind), 'Raíz de selección inválida')
  must(archivePaths.size === manifest.entries.length + 1, 'El ZIP contiene archivos sin declarar')
  return manifest
}

/** Lee el ZIP completo una sola vez; impone límites antes y durante la descompresión. */
export async function readLevelPackage(file, JSZipType = null) {
  must(file && typeof file.arrayBuffer === 'function' && file.size <= MAX_PACKAGE_BYTES, 'Paquete demasiado grande o inválido')
  const Zip = JSZipType || (await import('jszip')).default
  const zip = await Zip.loadAsync(await file.arrayBuffer(), { checkCRC32: true, createFolders: false })
  // JSZip normaliza ../ en los nombres; rechazamos igualmente las rutas originales inseguras.
  for (const z of Object.values(zip.files)) {
    if (z.unsafeOriginalName && z.unsafeOriginalName !== z.name) throw new Error(`Ruta insegura en ZIP: ${z.unsafeOriginalName}`)
  }
  const files = Object.values(zip.files).filter((z) => !z.dir)
  must(files.length <= MAX_ENTRIES + 1, 'Demasiados archivos dentro del paquete')
  must(zip.file('levelpackage.json'), 'Falta levelpackage.json')
  const sizeOf = (z) => z._data?.uncompressedSize
  let total = 0
  for (const z of files) {
    must(typeof sizeOf(z) === 'number' && sizeOf(z) >= 0 && sizeOf(z) <= MAX_ENTRY_BYTES, `Tamaño sin validar: ${z.name}`)
    total += sizeOf(z)
    must(total <= MAX_TOTAL_BYTES, 'Paquete descomprimido demasiado grande')
  }
  const mf = zip.file('levelpackage.json')
  must(sizeOf(mf) <= 2 * 1024 * 1024, 'Manifiesto demasiado grande')
  const manifest = validateLevelPackageManifest(JSON.parse(await mf.async('string')), files.map((z) => z.name))
  const contents = new Map()
  for (const e of manifest.entries) {
    const z = zip.file(e.path)
    const raw = await z.async('uint8array')
    must(bytesSize(raw) <= MAX_ENTRY_BYTES, `Archivo excesivo: ${e.path}`)
    contents.set(e.id, e.kind === 'scene' || e.kind === 'prefab' || e.kind === 'profile' || e.kind === 'gamemanager' || e.kind === 'material' || e.kind === 'vfx' || e.kind === 'liquid' || e.kind === 'timeline'
      ? JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw))
      : textKinds.has(e.kind) ? new TextDecoder('utf-8', { fatal: true }).decode(raw) : raw)
  }
  return { manifest, contents }
}

/** Cierre de dependencias: no se puede importar un recurso sin los que utiliza. */
export function levelPackageSelection(manifest, ids) {
  const byId = new Map(manifest.entries.map((e) => [e.id, e]))
  const result = new Set(), visiting = new Set()
  function visit(id) {
    if (result.has(id)) return
    must(byId.has(id), `Recurso desconocido: ${id}`)
    if (visiting.has(id)) return // Los prefabs y scripts pueden referenciarse mutuamente.
    visiting.add(id)
    for (const dep of byId.get(id).dependencies) visit(dep)
    visiting.delete(id)
    result.add(id)
  }
  for (const id of ids) visit(id)
  return result
}

/** Prepara el destino y remapea referencias ID/rutas sin tocar el origen ni el proyecto. */
export function planLevelPackageImport({ manifest, contents, project, selectedIds, decisions = {}, makeId }) {
  const selected = levelPackageSelection(manifest, selectedIds)
  must(selected.size, 'Selecciona al menos un recurso')
  const current = allEntries(project, { includeTemporal: true })
  const occupied = new Map(current.map((e) => [`${e.folder}/${e.file}`.toLowerCase(), e]))
  const reservedIds = new Set([...current.map((e) => e.id), ...manifest.entries.map((e) => e.id)])
  const imported = manifest.entries.filter((e) => selected.has(e.id))
  const remap = new Map(), paths = new Map(), actions = [], warnings = []
  const taken = new Set(occupied.keys())
  const timelineNames = new Set((project.timelines || []).map(t => t.name.toLowerCase()))
  for (const e of imported) {
    const collision = occupied.get(e.path.toLowerCase())
    const choice = collision ? decisions[e.id] : 'rename'
    must(!collision || ['rename', 'reuse', 'skip'].includes(choice), `Resuelve el conflicto de ${e.path}`)
    must(!(collision && choice === 'reuse' && collision.kind !== e.kind), `No se puede reutilizar otro tipo de recurso: ${e.path}`)
    if (collision && choice === 'skip') { actions.push({ entry: e, action: 'skip' }); continue }
    if (collision && choice === 'reuse') {
      remap.set(e.id, collision.id)
      paths.set(e.path, `${collision.folder}/${collision.file}`)
      actions.push({ entry: e, action: 'reuse', id: collision.id }); continue
    }
    let filename = e.file
    if (taken.has(e.path.toLowerCase()) || (e.kind === 'timeline' && timelineNames.has(filename.toLowerCase()))) {
      const dot = e.kind === 'timeline' ? '' : e.kind === 'scene' ? '.scene.json' : e.kind === 'prefab' ? '.prefab' : /\.[^.]+$/.exec(filename)?.[0] || ''
      const base = dot ? filename.slice(0, -dot.length) : filename
      let n = 2
      while (taken.has(`${e.folder}/${base} ${n}${dot}`.toLowerCase()) || (e.kind === 'timeline' && timelineNames.has(`${base} ${n}${dot}`.toLowerCase()))) n++
      filename = `${base} ${n}${dot}`
    }
    if (e.kind === 'timeline') timelineNames.add(filename.toLowerCase())
    const prefix = { timeline: 'tl', scene: 's', model: 'm', prefab: 'pf', script: 'sc', shader: 'sh', ui: 'u', profile: 'rp', gamemanager: 'gm', vfx: 'vfx', liquid: 'li' }[e.kind] || 'a'
    let newId, tries = 0
    do { newId = makeId(prefix); tries++ } while (reservedIds.has(newId) && tries < 100)
    must(validId(newId) && !reservedIds.has(newId), 'No fue posible asignar identificadores únicos')
    reservedIds.add(newId)
    const newPath = `${e.folder}/${filename}`
    remap.set(e.id, newId); paths.set(e.path, newPath); taken.add(newPath.toLowerCase())
    actions.push({ entry: e, action: 'create', id: newId, file: filename, folder: e.folder })
  }
  // Omitir un recurso referenciado rompe el paquete: debe reutilizarse o importarse.
  for (const e of imported) if (actions.find((a) => a.entry.id === e.id)?.action !== 'skip') {
    for (const dep of e.dependencies) must(remap.has(dep), `«${e.name}» necesita «${dep}». No puedes omitir esa dependencia`)
  }
  // Validación multiscript anterior a cualquier escritura; "skip" nunca elimina referencias.
  const entriesById = new Map(manifest.entries.map(e => [e.id, e]))
  for (const entry of imported) {
    const action = actions.find(a => a.entry.id === entry.id)
    if (action?.action !== 'create' || !['scene', 'prefab'].includes(entry.kind)) continue
    const data = contents.get(entry.id)
    must(Array.isArray(data?.objects), `Objetos ausentes en ${entry.name}`)
    for (const node of data.objects) {
      const list = Object.hasOwn(node, 'scriptIds') ? node.scriptIds : node.scriptId ? [node.scriptId] : []
      must(Array.isArray(list) && list.every(id => typeof id === 'string' && id.trim() === id && !!id) &&
        new Set(list).size === list.length, `Scripts de Nodo inválidos en ${node.name || node.id}`)
      for (const id of list) {
        const script = entriesById.get(id)
        must(script?.kind === 'script' && selected.has(id) && remap.has(id), `Script de Nodo no incluido: ${id}`)
        const depAction = actions.find(a => a.entry.id === id)
        must(entry.dependencies.includes(id), `Dependencia de Script de Nodo no declarada: ${id}`)
        const execution = depAction.action === 'reuse'
          ? current.find(e => e.id === depAction.id)?.ref.execution
          : script.metadata.execution
        must(execution === 'node', `El recurso no es un Script de Nodo: ${id}`)
      }
    }
  }
  const idMap = Object.fromEntries(remap)
  function replace(value) {
    if (typeof value === 'string') {
      if (remap.has(value)) return remap.get(value)
      if (paths.has(value)) return paths.get(value)
      // Dentro de scripts y rutas literales se sustituyen tokens completos, no fragmentos.
      let out = value
      for (const [oldId, newId] of remap) out = out.replace(new RegExp(`(^|[^a-zA-Z0-9_])${oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-zA-Z0-9_])`, 'g'), (_, before) => before + newId)
      for (const [oldPath, newPath] of paths) if (oldPath !== newPath) out = out.split(oldPath).join(newPath)
      return out
    }
    if (Array.isArray(value)) return value.map(replace)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => {
      if (k === 'scriptProperties' && v && typeof v === 'object' && !Array.isArray(v))
        return [k, Object.fromEntries(Object.entries(v).map(([id, fields]) => [remap.get(id) || id, plain(fields)]))]
      const timeline = TIMELINE_REF_FIELDS.has(k) && typeof v === 'string' ? manifest.entries.find(e => e.kind === 'timeline' && (e.id === v || e.name === v)) : null
      return [k, timeline && remap.has(timeline.id) ? remap.get(timeline.id) : replace(v)]
    }))
    return value
  }
  // Cada escena o recurso Prefab recibe IDs lógicos nuevos, independientes del proyecto origen.
  // Las referencias entre recursos son resueltas primero por replace(); las de nodos, aquí.
  function remapNodes(data) {
    const nodes = data.objects || []
    const map = new Map()
    for (const o of nodes) {
      must(validId(o.id) && !map.has(o.id), 'Nodo con ID inválido o duplicado en paquete')
      let id, tries = 0
      do { id = makeId(); tries++ } while (reservedIds.has(id) && tries < 100)
      must(validId(id) && !reservedIds.has(id), 'No fue posible asignar ID de nodo')
      reservedIds.add(id)
      map.set(o.id, id)
    }
    const remapValue = (v) => {
      if (typeof v === 'string') return map.get(v) || v
      if (Array.isArray(v)) return v.map(remapValue)
      if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, val]) => [k, k === 'scriptProperties' ? plain(val) : remapValue(val)]))
      return v
    }
    const sourceLinks = validateSignalConnections(data.signalConnections)
    must(sourceLinks.every((c) => map.has(c.emitterId) && map.has(c.receiverId)),
      'Conexión visual con extremo externo o ausente: importación bloqueada para evitar pérdida de datos')
    const signalConnections = remapSignalConnections(sourceLinks, map, () => {
      let id, tries = 0
      do { id = makeId(); tries++ } while (reservedIds.has(id) && tries < 100)
      must(validId(id) && !reservedIds.has(id), 'No fue posible asignar ID de conexión')
      reservedIds.add(id)
      return id
    })
    return { ...data, objects: nodes.map(remapValue).map(migrateNodeScripts), signalConnections }
  }
  const records = [], scenes = [], assets = []
  for (const action of actions) {
    if (action.action !== 'create') continue
    const e = action.entry, data = contents.get(e.id)
    must(data !== undefined, `Falta el contenido de ${e.path}`)
    const name = e.kind === 'scene' ? action.file.slice(0, -'.scene.json'.length) : e.kind === 'prefab' ? action.file.slice(0, -'.prefab'.length) : action.file
    const meta = replace(plain(e.metadata))
    const ref = { ...meta, id: action.id, name, folder: e.folder }
    if (e.kind === 'scene') {
      must(data && Array.isArray(data.objects) && data.environment && data.terrain, `Escena inválida: ${e.name}`)
      scenes.push({ id: action.id, data: remapNodes(replace(plain(data))) })
    } else if (e.kind === 'timeline') {
      must(data && Array.isArray(data.tracks) && typeof data === 'object' && !Array.isArray(data) && data.id === e.id && data.name === e.name && (data.folder || 'Assets') === e.folder && !isFilmMakerTimeline(data) && !data.filmMaker && !e.metadata.filmMaker, `Timeline incoherente: ${e.name}`)
      must(e.folder !== 'Assets/Cinematics' && !e.folder.startsWith('Assets/Cinematics/'), 'La carpeta Cinematics está reservada a FilmMaker')
      Object.assign(ref, normalizeTimeline({ ...replace(plain(data)), id: action.id, name, folder: e.folder }))
      for (const track of ref.tracks) { track.id = makeId('tr'); for (const key of track.keys) key.id = makeId('k') }
      for (const track of ref.tracks.filter(t => t.kind === 'audio')) for (const key of track.keys) {
        if (!key.clip || key.action === 'stop') continue
        const audio = manifest.entries.find(e => e.kind === 'audio' && (e.name === key.clip || remap.get(e.id) === key.clip))
        must(audio && e.dependencies.includes(audio.id) && remap.has(audio.id), `Audio del Timeline no incluido: ${key.clip}`)
        key.clip = remap.get(audio.id)
      }
      warnings.push(`Timeline ${e.name}: revisa los enlaces a nodos de la escena destino y referencias dinámicas de scripts; no se importan nodos automáticamente.`)
    } else if (e.kind === 'prefab') {
      must(data && Array.isArray(data.objects), `Prefab inválido: ${e.name}`)
      const prefab = remapNodes(replace(plain(data)))
      ref.objects = prefab.objects
      ref.signalConnections = prefab.signalConnections
    } else if (textKinds.has(e.kind)) {
      must(typeof data === 'string', `Código inválido: ${e.name}`)
      ref.code = replace(data)
      if (e.kind === 'script') warnings.push(`Revisar rutas o IDs construidos dinámicamente: ${e.name}`)
    } else if (e.kind === 'profile' || e.kind === 'gamemanager' || e.kind === 'material') {
      must(data && typeof data === 'object' && !Array.isArray(data), `Perfil inválido: ${e.name}`)
      Object.assign(ref, { ...replace(plain(data)), id: action.id, name, folder: e.folder })
      if (e.kind === 'material') Object.assign(ref, normalizeMaterial(ref))
    } else if (e.kind === 'liquid') {
      must(data && typeof data==='object' && !Array.isArray(data), `Líquido inválido: ${e.name}`)
      must(data.id===e.id && data.name===e.name && data.folder===e.folder, `Líquido incoherente: ${e.name}`)
      Object.assign(ref,normalizeLiquid({...replace(plain(data)),id:action.id,name,folder:e.folder},{resource:true}))
    } else if (e.kind === 'vfx') {
      must(data && typeof data === 'object' && !Array.isArray(data), `VFX inválido: ${e.name}`)
      const body = replace(plain(data))
      // No permitir que un manifiesto forje un cuerpo con otra identidad.
      must(data.id === e.id && data.name === e.name && data.folder === e.folder, `Índice/cuerpo VFX incoherente: ${e.name}`)
      Object.assign(ref, validateVfxResource({ ...body, id: action.id, name, folder: e.folder }))
      if (ref.appearance.textureId) {
        const sourceTexture = manifest.entries.find((item) => item.id === data.appearance.textureId)
        must(sourceTexture?.kind === 'texture' && remap.has(sourceTexture.id), `Textura de VFX no incluida: ${data.appearance.textureId}`)
      }
    } else {
      must(data instanceof Uint8Array && bytesSize(data) > 0, `Binario inválido: ${e.name}`)
      assets.push({ id: action.id, name, bytes: data })
    }
    if (collection(e.kind) === 'assets') ref.kind = e.kind
    records.push({ collection: collection(e.kind), ref })
  }
  const context = manifest.context && imported.some((e) => e.kind === 'scene')
  if (context) warnings.push('Las escenas contienen contexto global (Database, InputMap, etc.). No se fusionará automáticamente con el proyecto destino.')
  return { records, scenes, assets, actions, idMap, warnings, context: !!context }
}
