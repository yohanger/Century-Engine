// Formato .lfproj: un zip que refleja el sistema de archivos del proyecto.
//
//   project.json                       metadatos (ids, escenas, carpetas, ajustes)
//   Assets/Scenes/Escena 1.scene.json  una escena (objetos, entorno, terreno)
//   Assets/Models/roca.glb             modelos importados (copia del original)
//   Assets/Prefabs/Farola.prefab       prefabs (JSON con sus nodos)
//   Assets/Textures/rock.png           texturas / archivos
//   Assets/Scripts/puerta.js           scripts JS del proyecto (texto)
//   Assets/UI/inventario.ui            interfaces del juego (plantilla Vue + script + CSS)
//
// Se puede abrir con cualquier gestor de zips y los assets quedan en sus carpetas reales.
import { strictJson } from '../engine/runtime/numeric-integrity.js'
import { allEntries, ensureFs, migrateRecord, migrateNodeScripts, PROJECT_VERSION } from './project.js'
import { upgradeFormat } from '../engine/runtime/format.js'
import { isSystemUi } from '../engine/runtime/ui/system.js'
import { normalizeLiquid } from '../engine/runtime/geometry/liquid-containers.js'
import { validateVfxResource, vfxIndexOf } from '../engine/runtime/vfx/resource.js'

export const FORMAT = 'levelforge-project'
const entryPath = (e) => `${e.folder}/${e.file}`

/**
 * @param meta    metadatos del proyecto (sin objects/environment/terrain)
 * @param scenes  Map(sceneId -> { objects, environment, terrain(serializado) })
 * @param files   Map(entryId -> Uint8Array|ArrayBuffer) de modelos y assets
 * @param thumb   dataURL jpeg opcional
 */
export async function buildLfproj({ meta, scenes, files, thumb }) {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const { thumb: _t, ...clean } = meta
  clean.prefabs = (meta.prefabs || []).map(({ objects, signalConnections, ...rest }) => rest) // nodos y enlaces viven en su propio .prefab
  clean.scripts = (meta.scripts || []).map(({ code, ...rest }) => rest) // el código va en su propio archivo .js
  clean.uis = (meta.uis || []).map(({ code, ...rest }) => rest)
  clean.shaders = (meta.shaders || []).map(({ code, ...rest }) => rest)
  // El índice no duplica el cuerpo de cada .vfx; el cuerpo es la fuente canónica.
  clean.vfx = (meta.vfx || []).map((v) => vfxIndexOf(validateVfxResource(v)))
  zip.file('project.json', strictJson({ format: FORMAT, version: PROJECT_VERSION, app: 'Century', savedAt: new Date().toISOString(), ...clean }, 'Proyecto', 2))
  const missing = []
  for (const e of allEntries(meta)) {
    if (e.kind === 'scene') {
      const data = scenes.get(e.id)
      if (!data) { missing.push(e.file); continue }
      zip.file(entryPath(e), strictJson(data, e.file))
    } else if (e.kind === 'prefab') {
      zip.file(entryPath(e), strictJson({ objects: e.ref.objects || [], signalConnections: e.ref.signalConnections || [] }, e.file))
    } else if (e.kind === 'vfx') {
      zip.file(entryPath(e), JSON.stringify(validateVfxResource(e.ref)))
    } else if (e.kind === 'profile' || e.kind === 'gamemanager' || e.kind === 'material' || e.kind === 'liquid') {
      zip.file(entryPath(e), strictJson(e.ref, e.file))
    } else if (e.kind === 'script' || e.kind === 'ui' || e.kind === 'shader') {
      zip.file(entryPath(e), e.ref.code || '')
    } else {
      const bytes = files.get(e.id)
      if (!bytes) { missing.push(e.file); continue }
      zip.file(entryPath(e), bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), { binary: true })
    }
  }
  if (thumb && /^data:image\/jpeg;base64,/.test(thumb)) zip.file('thumb.jpg', thumb.split(',')[1], { base64: true })
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  return { blob, missing }
}

/** Lee un .lfproj. Devuelve { meta, scenes: Map, files: Map, thumb }. */
export async function parseLfproj(buffer) {
  const { default: JSZip } = await import('jszip')
  let zip
  try { zip = await JSZip.loadAsync(buffer) } catch { throw new Error('El archivo no es un zip válido') }
  const pj = zip.file('project.json')
  if (!pj) throw new Error('Falta project.json: no es un proyecto de Century')
  const raw = JSON.parse(await pj.async('string'))
  if (raw.format !== FORMAT) throw new Error('Formato desconocido: ' + raw.format)
  const { format, app, savedAt, ...rest } = raw
  const { meta } = migrateRecord({ ...rest, version: rest.version ?? PROJECT_VERSION, scenes: rest.scenes || [] })
  ensureFs(meta)

  const scenes = new Map(), files = new Map()
  const lost = []
  for (const e of allEntries(meta)) {
    const f = zip.file(entryPath(e))
    if (!f) {
      if (e.kind === 'vfx' || e.kind === 'liquid' || e.kind === 'cinematic') throw new Error(`Falta recurso obligatorio: ${entryPath(e)}`)
      if (!isSystemUi(e.ref)) lost.push(entryPath(e))
      continue
    }
    if (e.kind === 'scene') scenes.set(e.id, JSON.parse(await f.async('string')))
    else if (e.kind === 'prefab') {
      const prefab = JSON.parse(await f.async('string'))
      e.ref.objects = (prefab.objects || []).map(migrateNodeScripts)
      e.ref.signalConnections = prefab.signalConnections || []
    }
    else if (e.kind === 'vfx') {
      const resource = validateVfxResource(JSON.parse(await f.async('string')))
      if (JSON.stringify(vfxIndexOf(resource)) !== JSON.stringify(vfxIndexOf(e.ref))) {
        throw new Error(`VFX: índice y archivo no coinciden (${entryPath(e)})`)
      }
      Object.assign(e.ref, resource)
    }
    else if (e.kind === 'liquid') {
      const data=normalizeLiquid(JSON.parse(await f.async('string')),{resource:true})
      if (data.id!==e.id || data.name!==e.name || data.folder!==e.folder) throw new Error(`Líquido: índice/archivo incompatible (${entryPath(e)})`)
      Object.assign(e.ref,data)
    }
    else if (e.kind === 'profile' || e.kind === 'gamemanager' || e.kind === 'material') Object.assign(e.ref, JSON.parse(await f.async('string')))
    else if (e.kind === 'script' || e.kind === 'ui' || e.kind === 'shader') e.ref.code = await f.async('string')
    else files.set(e.id, await f.async('uint8array'))
  }
  if (!meta.scenes.length) throw new Error('El proyecto no tiene escenas')
  // escenas ausentes → se descartan; modelos/assets ausentes → se quitan del proyecto
  meta.scenes = meta.scenes.filter((s) => scenes.has(s.id))
  meta.models = meta.models.filter((m) => files.has(m.id))
  meta.assets = meta.assets.filter((a) => files.has(a.id))
  meta.scripts = (meta.scripts || []).filter((c) => typeof c.code === 'string')
  meta.uis = (meta.uis || []).filter((c) => typeof c.code === 'string')
  meta.shaders = (meta.shaders || []).filter((c) => typeof c.code === 'string')
  meta.prefabs = (meta.prefabs || []).filter((f) => Array.isArray(f.objects) && f.objects.length)
  if (!meta.scenes.length) throw new Error('No se pudo leer ninguna escena')
  const migration = upgradeFormat(meta) // el código de .ui/.glsl ya está leído: aquí el Runtime sube su formato
  ensureFs(meta)
  const t = zip.file('thumb.jpg')
  const thumb = t ? 'data:image/jpeg;base64,' + (await t.async('base64')) : undefined
  return { meta, scenes, files, thumb, lost, migration }
}
