// Sistema de archivos del proyecto: carpetas, modelos, texturas, mover, renombrar, duplicar
import { askConfirm } from '../dialogs.js'
import * as db from '../db.js'
import { uid } from '../../engine/runtime/util.js'
import { addFolderChain, allEntries, uniqueFileName, fileKind, extOf, sanitizeName, normFolder, parentFolder, folderName, ROOT_FOLDER } from '../project.js'
import { eventPagesUsingModel } from '../../engine/runtime/events/model.js'
import { dbModelUsage } from '../../engine/runtime/database/models.js'
import { store, toast } from './state.js'
import { commit } from './history.js'
import { duplicateScene, renameScene, deleteScene } from './project.js'
import { SUFFIX, stripSuffix } from './naming.js'
import { removePrefabData } from './prefabs.js'
import { unlinkTexture, dropUrl } from './assets.js'
import { dropUi } from './ui-assets.js'
import { isSystemUi, isSystemUiPath } from '../../engine/runtime/ui/system.js'
import { dropShader } from './shaders.js'
import { dropProfile } from './profiles.js'
import { dropMaterial, materialUsagesInOtherScenes } from './materials.js'
import { normalizeMaterial } from '../../engine/runtime/render/material-resource.js'
import { normalizeProfile } from '../../engine/runtime/render/profiles.js'
import { dropGameManager } from './game-managers.js'
import { normalizeGameManager } from '../../engine/runtime/game-manager.js'
import { closeScriptEditor } from './database.js'
import { normalizeLiquid } from '../../engine/runtime/geometry/liquid-containers.js'
import { validateVfxResource } from '../../engine/runtime/vfx/resource.js'
import { duplicateTimeline, deleteTimeline, deleteTimelines } from './timelines.js'
import { importFilm, duplicateNativeCinematic } from './film.js'
import { nativeCinematic, nextNativeRevision } from '../cinematic-resource.js'
import { timelineReferences } from '../timeline/model.js'
import { duplicateAnimation } from './animation.js'



const entryList = () => allEntries(store.project, { includeTemporal: true }).filter(e => !e.embedded || e.kind === 'timeline')
export const folderEntries = (folder) => allEntries(store.project, { includeTemporal: true }).filter((e) => e.folder === folder)
export const subfolders = (folder) => store.project.folders.filter((f) => parentFolder(f) === folder).sort((a, b) => a.localeCompare(b, 'es'))
const inside = (path, folder) => path === folder || path.startsWith(folder + '/')

/**
 * Importa archivos a una carpeta del proyecto. Cada archivo se COPIA dentro del proyecto:
 * modelos (.glb .gltf .obj), texturas (imágenes) y cualquier otro archivo.
 */
export async function importFiles(files, folder = store.projFolder) {
  const p = store.project
  const base = normFolder(folder)
  if (isSystemUiPath(base)) { toast('La carpeta Sistema está reservada para las interfaces del motor', 'error'); return 0 }
  let ok = 0
  const where = new Set()
  const made = []
  for (const f of [...files].sort((a,b) => Number(extOf(a.name) === 'obj') - Number(extOf(b.name) === 'obj'))) {
    if (extOf(f.name) === 'nfm') {
      try {
        const result = await importFilm(new Uint8Array(await f.arrayBuffer()), { applyScene: false })
        if (result) { ok++; where.add('Assets/Cinematics') }
      } catch (err) { toast(`No se pudo importar ${f.name}: ${err.message}`, 'error', 6000) }
      continue
    }
    if (extOf(f.name) === 'lfproj') { toast('Para abrir un .lfproj usa Archivo ▸ Abrir proyecto', 'error', 4000); continue }
    if (extOf(f.name) === 'levelpackage') { toast('Para importar .levelpackage usa Proyecto ▸ Importar paquete… (vista previa y conflictos)', 'info', 4500); continue }
    const kind = fileKind(f.name)
    // La ubicación elegida manda: no crear carpetas por categoría al importar en Assets.
    const dest = base
    const bytes = await f.arrayBuffer()
    const name = uniqueFileName(p, dest, f.name)
    try {
      if (kind === 'vfx') {
        const parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
        const id = uid('vfx')
        const doc = validateVfxResource({ ...parsed, id, name, folder: dest })
        if (doc.appearance.textureId && !p.assets.some((a) => a.id === doc.appearance.textureId && a.kind === 'texture')) {
          throw new Error('La textura de este VFX no existe en el proyecto. Importa un .levelpackage con sus dependencias.')
        }
        p.vfx ||= []
        p.vfx.push(doc)
        made.push({ kind, id, name })
      } else if (kind === 'liquid') {
        const parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
        const id=uid('li');p.liquids ||= [];p.liquids.push(normalizeLiquid({...parsed,id,name,folder:dest},{resource:true}))
        made.push({kind,id,name})
      } else if (kind === 'material') {
        const parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Material inválido')
        const id = uid('mt')
        p.materials.push(normalizeMaterial({ ...parsed, id, name, folder: dest }))
        made.push({ kind, id, name })
      } else if (kind === 'profile') {
        const parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Perfil inválido')
        const id = uid('pr')
        p.profiles.push(normalizeProfile({ ...parsed, id, name, folder: dest }))
        made.push({ kind, id, name })
      } else if (kind === 'gamemanager') {
        const parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('GameManager inválido')
        const id = uid('gm')
        p.gameManagers.push(normalizeGameManager({ ...parsed, id, name, folder: dest }))
        made.push({ kind, id, name })
      } else if (kind === 'shader') {
        const id = uid('sh')
        p.shaders.push({ id, name, folder: dest, code: new TextDecoder().decode(bytes) })
        made.push({ kind, id, name })
      } else if (kind === 'ui') {
        const id = uid('u')
        p.uis.push({ id, name, folder: dest, code: new TextDecoder().decode(bytes) })
        made.push({ kind, id, name })
      } else if (kind === 'script') {
        const id = uid('sc')
        p.scripts.push({ id, name, folder: dest, code: new TextDecoder().decode(bytes) })
        made.push({ kind, id, name })
      } else if (kind === 'model') {
        const id = uid('m')
        const info = await store.editor.registerModel(id, bytes, name, { project:p, folder:dest })
        await db.putAsset(p.id, id, name, bytes)
        p.models.push({ id, name, folder: dest, ext: extOf(name), bytes: bytes.byteLength, size: info.size, center: info.center, clips: info.clips || [] })
        made.push({ kind, id, name })
      } else {
        const id = uid('a')
        await db.putAsset(p.id, id, name, bytes)
        p.assets.push({ id, name, folder: dest, kind, ext: extOf(name), bytes: bytes.byteLength })
        made.push({ kind, id, name })
      }
      addFolderChain(p, dest)
      where.add(dest)
      ok++
    } catch (err) {
      console.error(err)
      toast(`No se pudo importar ${f.name}: ${err.message}`, 'error', 5000)
    }
  }
  if (ok) {
    const at = [...where].join(', ')
    if (made.length) {
      toast(ok === 1 ? `Importado en ${at}` : `${ok} archivos importados en ${at}`, 'ok')
      commit('Importar archivos')
    }
  }
  importFiles.last = made // lo creado en esta llamada (para asignarlo, p. ej., a una capa de terreno)
  return ok
}

/** Importar modelos sin imponer una carpeta vacía por defecto. */
export const importModels = (files) => importFiles(files, ROOT_FOLDER)

/** Referencias que impiden borrar un modelo, incluso en páginas inactivas y escenas guardadas. */
export async function findModelUsage(modelId) {
  const p = store.project
  const out = []
  for (const s of p.scenes) {
    const data = s.id === p.activeSceneId ? p : await db.loadScene(p.id, s.id)
    for (const o of data?.objects || []) {
      if (o.modelId === modelId) out.push(`${s.name} / ${o.name || o.id}`)
      if (o.type === 'event') {
        for (const page of eventPagesUsingModel(o.props, modelId)) out.push(`${s.name} / ${o.name || o.id} / Event Page ${page}`)
      }
    }
    for (const f of data?.terrain?.foliage || []) {
      const cfg = f.cfg || f
      if (cfg.source === 'model' && cfg.modelId === modelId) out.push(`${s.name} / Foliage ${cfg.name || cfg.id || ''}`.trim())
    }
  }
  out.push(...dbModelUsage(p.database, modelId))
  for (const pf of p.prefabs || []) {
    for (const o of pf.objects || []) {
      if (o.modelId === modelId) out.push(`Prefab ${pf.name} / ${o.name || o.id}`)
      if (o.type === 'event') {
        for (const page of eventPagesUsingModel(o.props, modelId)) out.push(`Prefab ${pf.name} / ${o.name || o.id} / Event Page ${page}`)
      }
    }
  }
  return out
}

/** Referencias a recursos compartidos, incluso en escenas que no están abiertas. */
export async function findAssetUsage(kind, id) {
  if (kind !== 'vfx' && kind !== 'texture' && kind !== 'liquid') return []
  const p = store.project
  const uses = []
  const key = kind === 'vfx' ? 'vfxId' : kind === 'liquid' ? 'liquidId' : 'textureId'
  const hasRef = (value) => {
    if (!value || typeof value !== 'object') return false
    if (Array.isArray(value)) return value.some(hasRef)
    return Object.entries(value).some(([k, v]) =>
      ((k === key || (kind === 'texture' && ['texture', 'image', 'imageId', 'assetId'].includes(k))) && v === id) || hasRef(v))
  }
  for (const s of p.scenes || []) {
    const data = s.id === p.activeSceneId ? p : await db.loadScene(p.id, s.id)
    if (!data) throw new Error(`No se pudo revisar la escena «${s.name}»`)
    for (const o of data.objects || []) if (hasRef(o)) uses.push(`${s.name} / ${o.name || o.id}`)
    if ((kind === 'texture' && hasRef(data.terrain)) || (kind === 'liquid' && hasRef(data.environment?.waterSimulation))) uses.push(`${s.name} / Terreno`)
  }
  for (const pf of p.prefabs || []) for (const o of pf.objects || []) {
    if (hasRef(o)) uses.push(`Prefab ${pf.name} / ${o.name || o.id}`)
  }
  for (const v of p.vfx || []) if (kind === 'texture' && v.appearance?.textureId === id) uses.push(`VFX ${v.name}`)
  if (kind === 'texture') {
    for (const type of ['materials', 'profiles', 'gameManagers']) {
      for (const r of p[type] || []) if (hasRef(r)) uses.push(`${type} / ${r.name}`)
    }
  }
  return uses
}

/** Comprueba referencias explícitas en escenas, prefabs, eventos y otros timelines.
 *  Las llamadas a game.timeline.play() construidas dinámicamente no son detectables. */
export async function findTimelineUsage(id, { nameOnly = false } = {}) {
  const p = store.project, resource = p.timelines?.find(t => t.id === id)
  if (!resource) return []
  const uses = []
  const references = (data, origin) => timelineReferences(data, resource, origin, { nameOnly })
  for (const scene of p.scenes || []) {
    const data = scene.id === p.activeSceneId ? p : await db.loadScene(p.id, scene.id)
    if (!data) throw new Error(`No se pudo revisar la escena «${scene.name}»`)
    for (const object of data.objects || []) uses.push(...references(object, `Escena ${scene.name} / ${object.name || object.id}`))
    uses.push(...references(data.events || [], `Eventos ${scene.name}`))
  }
  for (const prefab of p.prefabs || []) for (const object of prefab.objects || []) uses.push(...references(object, `Prefab ${prefab.name} / ${object.name || object.id}`))
  uses.push(...references(p.database?.commonEvents || p.db?.commonEvents || [], 'Eventos comunes'))
  for (const other of p.timelines || []) if (other.id !== id) uses.push(...references(other.tracks, `Timeline ${other.name}`))
  return [...new Set(uses)]
}

export async function removeEntry(kind, id) {
  if (kind === 'cinematic' && nativeCinematic(store.project, id)) {
    const uses = await findTimelineUsage(id)
    if (uses.length) { toast('Cinematic utilizado por el juego: ' + uses.slice(0, 3).join(', '), 'error', 6500); return false }
    const p = store.project
    // El historial del Editor puede restaurar el registro con Deshacer.
    // Se conserva el cuerpo local para ese caso; el empaquetado .lfproj solo incluye recursos registrados.
    p.cinematics = p.cinematics.filter(c => c.id !== id)
    p.timelines = p.timelines.filter(t => t.filmMaker?.nativeResourceId !== id)
    if (store.cinematicId === id) store.cinematicId = null
    commit('Eliminar Cinematic'); return true
  }
  if (kind === 'timeline' || kind === 'cinematic') return deleteTimeline(id)
  const p = store.project
  if (kind === 'vfx' || kind === 'texture' || kind === 'liquid') {
    const used = await findAssetUsage(kind, id)
    if (used.length) { toast(`Recurso en uso: ${used.join(', ')}`, 'error', 6000); return false }
    if (kind === 'vfx') {
      p.vfx = (p.vfx || []).filter((v) => v.id !== id)
      commit('Eliminar recurso VFX')
      return true
    }
  }
  if (kind === 'scene') return deleteScene(id)
  if (kind === 'prefab') { removePrefabData(id); commit('Eliminar prefab'); return true }
  if (kind === 'shader') { dropShader(id); commit('Eliminar shader'); return true }
  if (kind === 'liquid') {
    p.liquids=p.liquids.filter((v)=>v.id!==id);commit('Eliminar recurso líquido');return true
  }
  if (kind === 'material') {
    const uses = await materialUsagesInOtherScenes(id)
    if (uses.length) { toast(`Material usado en otra escena: ${uses.join(', ')}`, 'error', 5000); return false }
    dropMaterial(id); commit('Eliminar material'); return true
  }
  if (kind === 'profile') { dropProfile(id); commit('Eliminar perfil'); return true }
  if (kind === 'gamemanager') { dropGameManager(id); commit('Eliminar GameManager'); return true }
  if (kind === 'ui') { if (!dropUi(id)) { toast('Las interfaces del sistema no se pueden eliminar', 'error'); return false } commit('Eliminar interfaz'); return true }
  if (kind === 'script') { p.scripts = p.scripts.filter((c) => c.id !== id); if (store.scriptEditId === id) closeScriptEditor(); commit('Eliminar script'); return true }
  if (kind === 'model') {
    const used = await findModelUsage(id)
    if (used.length) { toast(`Modelo en uso: ${used.join(', ')}`, 'error', 5000); return false }
    p.models = p.models.filter((m) => m.id !== id)
  } else {
    p.assets = p.assets.filter((a) => a.id !== id)
    unlinkTexture(id)
  }
  dropUrl(id)
  await db.deleteAsset(p.id, id)
  commit('Quitar archivo')
  return true
}
export const removeModel = (id) => removeEntry('model', id)

const refOf = (kind, id) => (kind === 'timeline' || kind === 'cinematic' ? (kind === 'cinematic' && nativeCinematic(store.project, id) ? store.project.cinematics : store.project.timelines) : kind === 'scene' ? store.project.scenes : kind === 'prefab' ? store.project.prefabs : kind === 'model' ? store.project.models : kind === 'script' ? store.project.scripts : kind === 'ui' ? store.project.uis : kind === 'shader' ? store.project.shaders : kind === 'profile' ? store.project.profiles : kind === 'material' ? store.project.materials : kind === 'vfx' ? store.project.vfx : kind === 'liquid' ? store.project.liquids : kind === 'gamemanager' ? store.project.gameManagers : store.project.assets).find((x) => x.id === id)

export function renameEntry(kind, id, input) {
  if (kind === 'timeline') return renameTimelineEntry(id, input)
  if (kind === 'cinematic' && !nativeCinematic(store.project, id)) return false
  const p = store.project
  const ref = refOf(kind, id)
  const clean = sanitizeName(input, '')
  if (!ref || !clean || isSystemUi(ref)) return false
  if (kind === 'scene') { renameScene(id, clean.replace(/\.scene\.json$/, '')); return true }
  if (kind === 'prefab') {
    const next = stripSuffix(kind, uniqueFileName(p, ref.folder, stripSuffix(kind, clean) + SUFFIX.prefab, { ignoreId: id }))
    if (next === ref.name) return false
    ref.name = next
    commit('Renombrar prefab')
    return true
  }
  const ext = extOf(ref.name)
  const wanted = kind === 'cinematic' ? clean.replace(/\.cinematic$/i, '') + '.cinematic' : extOf(clean) === ext ? clean : ext ? `${clean}.${ext}` : clean
  const next = uniqueFileName(p, ref.folder, wanted, { ignoreId: id })
  if (next === (kind === 'cinematic' ? `${ref.name}.cinematic` : ref.name)) return false
  ref.name = kind === 'cinematic' ? next.replace(/\.cinematic$/i, '') : next
  if (kind === 'cinematic') {
    ref.revision = nextNativeRevision()
    const runtime = p.timelines.find(t => t.filmMaker?.nativeResourceId === id)
    if (runtime) { runtime.name = next; runtime.filmMaker.filmName = next }
  }
  commit('Renombrar archivo')
  return true
}

async function renameTimelineEntry(id, input) {
  const project = store.project, resource = refOf('timeline', id)
  const name = sanitizeName(input, '')
  if (!resource || resource.filmMaker || !name || name === resource.name) return false
  if (allEntries(project, { includeTemporal: true }).some(e => e.id !== id && e.name.toLowerCase() === name.toLowerCase())) {
    toast('Ya existe un recurso con ese nombre', 'error'); return false
  }
  const oldName = resource.name
  let uses
  try { uses = await findTimelineUsage(id, { nameOnly: true }) }
  catch (error) { toast('No se pudo comprobar el renombrado: ' + error.message, 'error'); return false }
  if (uses.length) { toast('No se renombró: hay referencias por nombre. Usa el ID del Timeline antes de renombrar. ' + uses.slice(0, 3).join(', '), 'error', 8000); return false }
  if (!await askConfirm('Las referencias por ID se conservan. Las referencias por nombre escritas en scripts no se actualizan ni pueden comprobarse completamente. ¿Renombrar?', { title: 'Renombrar Timeline', ok: 'Renombrar' })) return false
  if (project !== store.project || !project.timelines.includes(resource) || resource.name !== oldName || store.locked) return false
  try { uses = await findTimelineUsage(id, { nameOnly: true }) }
  catch (error) { toast('No se pudo comprobar el renombrado: ' + error.message, 'error'); return false }
  if (uses.length || project !== store.project || !project.timelines.includes(resource) || resource.name !== oldName || allEntries(project, { includeTemporal: true }).some(e => e.id !== id && e.name.toLowerCase() === name.toLowerCase())) return false
  resource.name = name; commit('Renombrar Timeline'); return true
}
function movableTimeline(ref, folder) {
  if (!ref || ref.filmMaker || folder === 'Assets/Cinematics' || folder.startsWith('Assets/Cinematics/') || isSystemUiPath(folder)) return false
  if (allEntries(store.project, { includeTemporal: true }).some(e => e.id !== ref.id && e.folder === folder && e.file.toLowerCase() === ref.name.toLowerCase())) {
    toast('La carpeta destino ya contiene ese nombre; no se movió el Timeline', 'error'); return false
  }
  return true
}

export function moveEntry(kind, id, folder) {
  const p = store.project
  const ref = refOf(kind, id)
  folder = normFolder(folder)
  if (!ref || (kind === 'cinematic' && !nativeCinematic(p, id)) || isSystemUi(ref) || isSystemUiPath(folder) || ref.folder === folder || !p.folders.includes(folder)) return false
  if (kind === 'timeline') { if (!movableTimeline(ref, folder)) return false; ref.folder = folder; commit('Mover Timeline'); return true }
  const file = kind === 'cinematic' ? `${ref.name}.cinematic` : SUFFIX[kind] ? ref.name + SUFFIX[kind] : ref.name
  const next = uniqueFileName(p, folder, file, { ignoreId: id })
  ref.name = kind === 'cinematic' ? next.replace(/\.cinematic$/i, '') : stripSuffix(kind, next)
  ref.folder = folder
  if (kind === 'cinematic') {
    ref.revision = nextNativeRevision()
    const runtime = p.timelines.find(t => t.filmMaker?.nativeResourceId === id)
    if (runtime) { runtime.name = ref.name; runtime.filmMaker.filmName = ref.name }
  }
  commit('Mover archivo')
  return true
}

/** Mueve varias entradas y/o carpetas a `folder`. items: [{ kind, id }] (kind 'folder' → id = ruta). */
export function moveItems(items, folder) {
  const p = store.project
  folder = normFolder(folder)
  if (((folder === 'Assets/Cinematics' || folder.startsWith('Assets/Cinematics/')) && !items.every(it => it.kind === 'cinematic' && nativeCinematic(p, it.id))) || isSystemUiPath(folder) || items.some((it) => (it.kind === 'folder' && (isSystemUiPath(it.id) || inside('Assets/UI/Sistema', it.id))) || (it.kind === 'ui' && isSystemUi(refOf(it.kind, it.id))))) return 0
  let n = 0
  for (const it of items) {
    if (it.kind === 'folder') {
      const target = `${folder}/${folderName(it.id)}`
      if (it.id === ROOT_FOLDER || isSystemUiPath(it.id) || inside('Assets/UI/Sistema', it.id) || inside(folder, it.id) || parentFolder(it.id) === folder) continue
      let dest = target, i = 2
      while (p.folders.includes(dest)) dest = `${target} ${i++}`
      p.folders = p.folders.map((f) => (inside(f, it.id) ? dest + f.slice(it.id.length) : f))
      for (const e of entryList()) if (inside(e.folder, it.id)) {
        e.ref.folder = dest + e.folder.slice(it.id.length)
        if (e.kind === 'cinematic') e.ref.revision = nextNativeRevision()
      }
      if (inside(store.projFolder, it.id)) store.projFolder = dest + store.projFolder.slice(it.id.length)
      n++
    } else {
      const ref = refOf(it.kind, it.id)
      if (it.kind === 'cinematic' && !nativeCinematic(p, it.id)) continue
      if (it.kind === 'timeline') { if (p.folders.includes(folder) && movableTimeline(ref, folder) && (ref.folder || 'Assets') !== folder) { ref.folder = folder; n++ }; continue }
      if (!ref || isSystemUi(ref) || ref.folder === folder) continue
      const file = it.kind === 'cinematic' ? `${ref.name}.cinematic` : SUFFIX[it.kind] ? ref.name + SUFFIX[it.kind] : ref.name
      const nextName = uniqueFileName(p, folder, file, { ignoreId: it.id })
      ref.name = it.kind === 'cinematic' ? nextName.replace(/\.cinematic$/i, '') : stripSuffix(it.kind, nextName)
      ref.folder = folder
      if (it.kind === 'cinematic') {
        ref.revision = nextNativeRevision()
        const runtime = p.timelines.find(t => t.filmMaker?.nativeResourceId === it.id)
        if (runtime) { runtime.name = ref.name; runtime.filmMaker.filmName = ref.name }
      }
      n++
    }
  }
  if (n) commit(n > 1 ? `Mover ${n} elementos` : 'Mover archivo')
  return n
}

/** Duplica un archivo del proyecto (misma carpeta, nombre libre). Devuelve { kind, id } del duplicado. */
export async function duplicateEntry(kind, id) {
  if (kind === 'cinematic') return duplicateNativeCinematic(id)
  const p = store.project
  if (kind === 'scene') { await duplicateScene(id); return null }
  if (kind === 'timeline' || kind === 'animation') {
    const copy = kind === 'timeline' ? duplicateTimeline(id) : duplicateAnimation(id)
    return copy ? { kind, id: copy.id } : null
  }
  const ref = refOf(kind, id)
  if (!ref || isSystemUi(ref)) return null
  if (kind === 'prefab') {
    const name = stripSuffix(kind, uniqueFileName(p, ref.folder, `${ref.name} copia${SUFFIX.prefab}`))
    const copy = { ...JSON.parse(JSON.stringify(ref)), id: uid('pf'), name, rev: 1 }
    p.prefabs.push(copy)
    commit('Duplicar prefab')
    return { kind, id: copy.id }
  }
  if (kind === 'liquid') {
    const name=uniqueFileName(p,ref.folder,ref.name.replace(/\.liquid$/i,' copia.liquid'))
    const copy=normalizeLiquid({...JSON.parse(JSON.stringify(ref)),id:uid('li'),name},{resource:true})
    p.liquids.push(copy);commit('Duplicar recurso líquido');return {kind,id:copy.id}
  }
  if (kind === 'vfx') {
    const name = uniqueFileName(p, ref.folder, ref.name.replace(/\.vfx$/i, ' copia.vfx'))
    const copy = validateVfxResource({ ...JSON.parse(JSON.stringify(ref)), id: uid('vfx'), name })
    p.vfx.push(copy)
    commit('Duplicar recurso VFX')
    return { kind, id: copy.id }
  }
  if (kind === 'gamemanager') {
    const name = uniqueFileName(p, ref.folder, ref.name.replace(/(\.[^.]+)?$/, ' copia$1'))
    const copy = { ...JSON.parse(JSON.stringify(ref)), id: uid('gm'), name }
    p.gameManagers.push(copy)
    commit('Duplicar GameManager')
    return { kind, id: copy.id }
  }
  if (kind === 'material') {
    const name = uniqueFileName(p, ref.folder, ref.name.replace(/(\.[^.]+)?$/, ' copia$1'))
    const copy = { ...JSON.parse(JSON.stringify(ref)), id: uid('mt'), name }
    p.materials.push(copy)
    commit('Duplicar material')
    return { kind, id: copy.id }
  }
  if (kind === 'profile') {
    const name = uniqueFileName(p, ref.folder, ref.name.replace(/(\.[^.]+)?$/, ' copia$1'))
    const copy = { ...JSON.parse(JSON.stringify(ref)), id: uid('pr'), name }
    p.profiles.push(copy)
    commit('Duplicar perfil')
    return { kind, id: copy.id }
  }
  if (kind === 'shader') {
    const name = uniqueFileName(p, ref.folder, ref.name.replace(/(\.[^.]+)?$/, ' copia$1'))
    const copy = { ...JSON.parse(JSON.stringify(ref)), id: uid('sh'), name }
    p.shaders.push(copy)
    commit('Duplicar shader')
    return { kind, id: copy.id }
  }
  if (kind === 'ui') {
    const name = uniqueFileName(p, ref.folder, ref.name.replace(/(\.[^.]+)?$/, ' copia$1'))
    const copy = { ...JSON.parse(JSON.stringify(ref)), id: uid('u'), name }
    p.uis.push(copy)
    commit('Duplicar interfaz')
    return { kind, id: copy.id }
  }
  if (kind === 'script') {
    const name = uniqueFileName(p, ref.folder, ref.name.replace(/(\.[^.]+)?$/, ' copia$1'))
    const copy = { ...JSON.parse(JSON.stringify(ref)), id: uid('sc'), name }
    p.scripts.push(copy)
    commit('Duplicar script')
    return { kind, id: copy.id }
  }
  const a = await db.getAsset(p.id, id)
  if (!a) return null
  const name = uniqueFileName(p, ref.folder, ref.name.replace(/(\.[^.]+)?$/, ' copia$1'))
  if (kind === 'model') {
    const nid = uid('m')
    await store.editor.registerModel(nid, a.bytes.slice(0), name, { project:p, folder:ref.folder })
    await db.putAsset(p.id, nid, name, a.bytes.slice(0))
    p.models.push({ ...JSON.parse(JSON.stringify(ref)), id: nid, name })
    commit('Duplicar modelo')
    return { kind, id: nid }
  }
  const nid = uid('a')
  await db.putAsset(p.id, nid, name, a.bytes.slice(0))
  p.assets.push({ ...JSON.parse(JSON.stringify(ref)), id: nid, name })
  commit('Duplicar archivo')
  return { kind, id: nid }
}

export function createFolder(parent, name) {
  const p = store.project
  const clean = sanitizeName(name, '')
  if (!clean || isSystemUiPath(normFolder(parent))) return null
  const base = `${normFolder(parent)}/${clean}`
  let path = base, i = 2
  while (p.folders.includes(path)) path = `${base} ${i++}`
  p.folders.push(path)
  commit('Nueva carpeta')
  return path
}

export function renameFolder(path, name) {
  const p = store.project
  const clean = sanitizeName(name, '')
  if (!clean || path === ROOT_FOLDER || path === 'Assets/UI' || isSystemUiPath(path) || inside('Assets/UI/Sistema', path)) return false
  const target = `${parentFolder(path)}/${clean}`
  if (target === path) return false
  if (p.folders.includes(target)) { toast('Ya existe una carpeta con ese nombre', 'error'); return false }
  p.folders = p.folders.map((f) => (inside(f, path) ? target + f.slice(path.length) : f))
  for (const e of entryList()) if (inside(e.folder, path)) {
    e.ref.folder = target + e.folder.slice(path.length)
    if (e.kind === 'cinematic') e.ref.revision = nextNativeRevision()
  }
  if (inside(store.projFolder, path)) store.projFolder = target + store.projFolder.slice(path.length)
  commit('Renombrar carpeta')
  return true
}

export async function deleteFolder(path) {
  const p = store.project
  if (isSystemUiPath(path) || path === 'Assets/UI' || inside('Assets/UI/Sistema', path)) { toast('No se puede eliminar una carpeta que contiene interfaces del motor', 'error'); return false }
  if (path === ROOT_FOLDER) { toast('La carpeta Assets no se puede eliminar', 'error'); return false }
  const doomed = entryList().filter((e) => inside(e.folder, path))
  if (doomed.some(e => e.kind === 'cinematic')) { toast('Mueve primero los Cinematics de esta carpeta; no se eliminarán películas indirectamente', 'error', 6000); return false }
  const scenesLeft = p.scenes.length - doomed.filter((e) => e.kind === 'scene').length
  if (scenesLeft < 1) { toast('No puedes dejar el proyecto sin escenas', 'error'); return false }

  for (const e of doomed.filter((e) => e.kind === 'vfx' || e.kind === 'texture' || e.kind === 'liquid')) {
    const uses = await findAssetUsage(e.kind, e.id)
    if (uses.length) { toast(`Recurso en uso: ${uses.join(', ')}`, 'error', 6000); return false }
  }
  for (const e of doomed.filter((e) => e.kind === 'material')) {
    const uses = await materialUsagesInOtherScenes(e.id)
    if (uses.length) { toast(`Material en uso: ${uses.join(', ')}`, 'error'); return false }
  }
  for (const e of doomed.filter((e) => e.kind === 'model')) {
    const used = await findModelUsage(e.id)
    if (used.length) { toast(`«${e.name}» está en uso en: ${used.join(', ')}`, 'error', 4000); return false }
  }
  for (const e of doomed) {
    if (e.kind === 'scene') await deleteScene(e.id)
    else if (e.kind === 'timeline') deleteTimelines([e.id], { record: false })
    else if (e.kind === 'prefab') removePrefabData(e.id)
    else if (e.kind === 'script') p.scripts = p.scripts.filter((c) => c.id !== e.id)
    else if (e.kind === 'ui') dropUi(e.id)
    else if (e.kind === 'shader') dropShader(e.id)
    else if (e.kind === 'profile') dropProfile(e.id)
    else if (e.kind === 'material') dropMaterial(e.id)
    else if (e.kind === 'gamemanager') dropGameManager(e.id)
    else if (e.kind === 'liquid') p.liquids=p.liquids.filter((v)=>v.id!==e.id)
    else if (e.kind === 'vfx') p.vfx = (p.vfx || []).filter((v) => v.id !== e.id)
    else {
      if (e.kind === 'model') p.models = p.models.filter((m) => m.id !== e.id)
      else { p.assets = p.assets.filter((a) => a.id !== e.id); unlinkTexture(e.id) }
      dropUrl(e.id)
      await db.deleteAsset(p.id, e.id)
    }
  }
  p.folders = p.folders.filter((f) => !inside(f, path))
  if (inside(store.projFolder, path)) store.projFolder = parentFolder(path) || ROOT_FOLDER
  commit('Eliminar carpeta')
  return true
}
