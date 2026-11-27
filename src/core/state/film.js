// Nether Film Maker (.nfm): la escena viaja a la app de rodaje y la película vuelve
import { askConfirm, askText } from '../dialogs.js'
import * as db from '../db.js'
import { normalizeRender } from '../../engine/runtime/render/config.js'
import { uid, downloadBlob, slug, pickFile } from '../../engine/runtime/util.js'
import { addFolderChain, uniqueFileName, fileKind, extOf, normFolder } from '../project.js'
import { store, toast } from './state.js'
import { commit, markDirty, synchronizeCinematicHistory } from './history.js'
import { activeScene, saveNow, buildProjectFile, switchScene, serializeProject, queueProjectPersistence } from './project.js'
import { updateObject } from './objects.js'
import { PROFILE_FOLDER, normalizeProfile } from '../../engine/runtime/render/profiles.js'
import { applyCaptureClips, readCapture, captureRigInfo, importCapture, deleteCaptureClip, openCaptureImport, filmTool } from './capture.js'
import { runBake, updateBake, cancelBake, clearBake, pickOnMap, closeMapPick } from './bake.js'
import { assetUrl } from './files.js'
import { host, openTab } from '../desktop.js'
import { validateFilmMotion } from '../../filmmaker/montage-motion.js'
import { normalizeTimeline, filmMakerSource, CINEMATICS_FOLDER } from '../timeline/model.js'
import { nativeCinematic, newNativeCinematic, updatedNativeCinematic, cinematicSceneStamp, encodeNativeFilm, decodeNativeFilm } from '../cinematic-resource.js'

/** Recrea únicamente el caché del Player; el cuerpo editable está en el recurso Assets. */
export function syncCinematicRuntime(project, resource, film, objects) {
  project.timelines = project.timelines.filter(t => t.filmMaker?.nativeResourceId !== resource.id)
  const playable = filmTool().sequence(film).items.length || film.edit.nodeTracks?.length || film.edit.physicsBakes?.length || film.edit.audio?.some(t => t.clips?.length)
  if (!playable) return null
  const tl = filmTool().montageTimeline(film, {
    name: resource.name, objects, overrides: film.overrides,
    animations: project.animations, clipName: id => project.assets.find(a => a.id === id)?.name || id,
  })
  tl.id = resource.id
  tl.filmMaker = { ...filmMakerSource(film, 'montage', film.id, filmTool().cinematicReel(film)), nativeResourceId: resource.id }
  const normalized = normalizeTimeline(tl)
  project.timelines.push(normalized)
  return normalized
}

/** Crea un recurso del proyecto, nunca una toma ni una pista ficticia. */
export async function createNativeCinematicDialog() {
  const p = store.project
  if (!p || store.locked || store.filmMode || !host()?.openFilmmaker) { toast('Crea el Cinematic desde el proyecto original de Century', 'error'); return null }
  const name = await askText('Nombre del Cinematic', 'Nueva película', { title: 'Nuevo Cinematic', ok: 'Crear' })
  if (!name?.trim() || p !== store.project || store.locked) return null
  const scene = activeScene()
  const uniqueName = uniqueFileName(p, CINEMATICS_FOLDER, name.trim() + '.cinematic').replace(/\.cinematic$/i, '')
  const film = filmTool().newFilm({ name: uniqueName, sceneId: scene.id, sceneName: scene.name, projectId: p.id, projectName: p.name })
  const resource = newNativeCinematic(p, film)
  try {
    await queueProjectPersistence(async () => {
      if (p !== store.project || store.locked) throw new Error('Proyecto modificado durante la creación')
    const { meta } = serializeProject()
    meta.cinematics = [...p.cinematics, resource]
    addFolderChain(meta, CINEMATICS_FOLDER)
    const bytes = encodeNativeFilm(film)
    await db.saveLevelPackageImport(meta, [], [{ id: resource.id, name: `${resource.name}.cinematic`, bytes: bytes.buffer }])
    p.cinematics.push(resource)
    addFolderChain(p, CINEMATICS_FOLDER)
      commit('Crear Cinematic')
    })
  } catch (err) {
    toast('No se pudo crear el Cinematic: ' + err.message, 'error', 6000)
    return null
  }
  store.projSel = { kind: 'cinematic', id: resource.id }
  store.projFolder = CINEMATICS_FOLDER
  try { await openNativeCinematic(resource.id) }
  catch (err) { toast('Creado en Assets; no se pudo abrir FilmMaker: ' + err.message, 'error', 6000) }
  return resource
}

export async function duplicateNativeCinematic(id) {
  const p = store.project, rec = nativeCinematic(p, id)
  if (!rec || store.locked || store.filmMode) return null
  const original = await db.getAsset(p.id, rec.id)
  const film = decodeNativeFilm(original?.bytes, rec.id, p.id)
  film.id = uid('film_')
  film.name = uniqueFileName(p, rec.folder, rec.name + ' copia.cinematic').replace(/\.cinematic$/i, '')
  const fresh = newNativeCinematic(p, film, rec.folder)
  const scene = await sceneDataForFilm(p, fresh.sceneId)
  await queueProjectPersistence(async () => {
    if (p !== store.project || store.locked || !nativeCinematic(p, id)) throw new Error('El proyecto cambió durante la duplicación')
    const trial = { ...p, cinematics: [...p.cinematics, fresh], timelines: [...p.timelines] }
    syncCinematicRuntime(trial, fresh, film, scene.objects)
    const { meta } = serializeProject()
    meta.cinematics = trial.cinematics; meta.timelines = trial.timelines
    const bytes = encodeNativeFilm(film)
    await db.saveLevelPackageImport(meta, [], [{ id: fresh.id, name: `${fresh.name}.cinematic`, bytes: bytes.buffer }])
    p.cinematics = trial.cinematics; p.timelines = trial.timelines
    commit('Duplicar Cinematic')
  })
  return { kind: 'cinematic', id: fresh.id }
}

export async function openNativeCinematic(id) {
  const p = store.project
  if (store.filmMode || !nativeCinematic(p, id)) throw new Error('Abre el Cinematic desde el proyecto original de Century')
  const bridge = host()
  if (!bridge?.openFilmmaker) throw new Error('FilmMaker nativo requiere Electron')
  return bridge.openFilmmaker({ projectId: p.id, cinematicId: id })
}

async function sceneDataForFilm(p, sceneId) {
  if (p.activeSceneId === sceneId) return { objects: p.objects, environment: p.environment }
  const scene = await db.loadScene(p.id, sceneId)
  if (!scene) throw new Error('No existe la escena referenciada por el Cinematic')
  return scene
}

/** Atiende solicitudes autenticadas por Electron. El estado de Century es la autoridad del recurso. */
async function handleNativeCinematicRequestImpl(action, args) {
  const p = store.project
  if (!p || store.locked || !args?.projectId || p.id !== args.projectId) throw new Error('El proyecto original ya no está abierto en Century')
  const rec = nativeCinematic(p, args.cinematicId)
  if (!rec) throw new Error('El Cinematic ya no existe')
  const data = await sceneDataForFilm(p, rec.sceneId)
  const stamp = cinematicSceneStamp(data.objects, data.environment, p.render, p.audio)
  if (action === 'open') {
    if (!(await saveNow())) throw new Error('No se pudo consolidar la copia de trabajo del proyecto')
    const { blob, missing } = await buildProjectFile()
    if (missing.length) throw new Error('Faltan archivos del proyecto: ' + missing.join(', '))
    const stored = await db.getAsset(p.id, rec.id)
    const film = decodeNativeFilm(stored?.bytes, rec.id, p.id)
    if (film.scene.id !== rec.sceneId) throw new Error('Escena del Cinematic incompatible con el proyecto')
    film.name = rec.name
    return { film, revision: rec.revision, sceneStamp: stamp,
      lfproj: new Uint8Array(await blob.arrayBuffer()) }
  }
  if (action !== 'save') throw new Error('Operación Cinematic no autorizada')
  return queueProjectPersistence(async () => {
    if (p !== store.project || store.locked || nativeCinematic(p, rec.id)?.revision !== rec.revision) throw new Error('Conflicto: recurso o proyecto cambiado durante el guardado')
    const latestScene = await sceneDataForFilm(p, rec.sceneId)
    if (cinematicSceneStamp(latestScene.objects, latestScene.environment, p.render, p.audio) !== stamp) throw new Error('Conflicto: escena modificada durante el guardado')
    if (args.sceneStamp !== stamp) throw new Error('Conflicto: la escena original cambió mientras se editaba la película')
    if (!args.film || args.film.id !== args.cinematicId) throw new Error('Película e identidad de recurso incompatibles')
    // La normalización/validación estructural pertenece a FilmMaker; no se acepta una cámara ausente.
    const film = args.film
    if (!Array.isArray(film.cameras) || !film.cameras.length || !film.cameras.some(c => c.id === film.activeCameraId)) throw new Error('Cámaras de FilmMaker inválidas')
    validateFilmMotion(film, latestScene.objects, film.overrides)
    const updated = updatedNativeCinematic(p, rec.id, film, args.revision)
    const newAssets = [], ids = new Set()
    for (const asset of args.assets || []) {
      if (!film.assets?.some(a => a.id === asset.id) || ids.has(asset.id) || p.assets.some(a => a.id === asset.id) || !asset.id || !asset.name || !asset.bytes) throw new Error('Recurso de FilmMaker duplicado o inválido')
      ids.add(asset.id)
      newAssets.push({ ...asset, bytes: new Uint8Array(asset.bytes) })
    }
    if ((film.assets || []).some(a => !p.assets.some(b => b.id === a.id) && !ids.has(a.id))) throw new Error('Película con Assets faltantes')
    // Se prepara un snapshot independiente: la transacción IndexedDB o confirma todos los cambios, o ninguno.
    const trial = { ...p, cinematics: p.cinematics.map(c => c.id === rec.id ? updated : c),
      assets: [...p.assets, ...newAssets.map(({ bytes, ...a }) => ({ ...a, bytes: bytes.byteLength }))],
      timelines: [...p.timelines] }
    syncCinematicRuntime(trial, updated, film, latestScene.objects)
    const { meta } = serializeProject()
    Object.assign(meta, { cinematics: trial.cinematics, timelines: trial.timelines, assets: trial.assets })
    const filmBytes = encodeNativeFilm(film)
    await db.saveLevelPackageImport(meta, [], [
      { id: updated.id, name: `${updated.name}.cinematic`, bytes: filmBytes.buffer },
      ...newAssets.map(a => ({ id: a.id, name: a.name, bytes: a.bytes.buffer.slice(a.bytes.byteOffset, a.bytes.byteOffset + a.bytes.byteLength) })),
    ])
    if (p !== store.project || p.id !== args.projectId) throw new Error('El proyecto cambió durante el guardado; revisa su estado')
    p.cinematics = trial.cinematics; p.timelines = trial.timelines; p.assets = trial.assets
    for (const a of newAssets) addFolderChain(p, a.folder || 'Assets')
    // El historial de película es propio de FilmMaker. Sincroniza snapshots de Editor
    // para que Deshacer no restaure un runtime anterior al archivo cinematográfico guardado.
    synchronizeCinematicHistory(updated.id, updated,
      p.timelines.find(t => t.filmMaker?.nativeResourceId === updated.id) || null)
    markDirty()
    toast(`Cinematic «${updated.name}» actualizado en el proyecto; guarda el proyecto en disco desde Century`, 'ok', 6000)
    return { revision: updated.revision, sceneStamp: stamp, cinematicId: updated.id }
  })
}

// Serializa todas las escrituras Cinematic: cada solicitud revalida revision tras la anterior.
let nativeCinematicSaveQueue = Promise.resolve()
export function handleNativeCinematicRequest(action, args) {
  if (action !== 'save') return handleNativeCinematicRequestImpl(action, args)
  const op = nativeCinematicSaveQueue.then(() => handleNativeCinematicRequestImpl(action, args))
  nativeCinematicSaveQueue = op.catch(() => {})
  return op
}

/** Empaqueta el proyecto con la escena activa como película nueva para Nether Film Maker. */
export async function exportSceneForFilm() {
  await saveNow({ thumb: true })
  const { blob, meta } = await buildProjectFile()
  const sc = activeScene()
  const film = filmTool().newFilm({ name: `${sc.name} · película`, sceneId: sc.id, sceneName: sc.name, projectId: meta.id, projectName: meta.name })
  const bytes = await filmTool().packNfm(film, new Uint8Array(await blob.arrayBuffer()))
  downloadBlob(new Blob([bytes], { type: 'application/zip' }), `${slug(sc.name, 'escena')}.nfm`)
  toast(`Escena «${sc.name}» lista para Nether Film Maker`, 'ok', 3500)
  return bytes
}
/**
 * Trae una película de Nether Film Maker: los objetos movidos/girados/escalados vuelven a su escena (deshacer con Ctrl+Z)
 * y cada toma del actor se convierte en clip de huesos + cinemática.
 * @returns { applied, missing, clips, timelines }
 */
export async function importFilm(bytes, { confirmOtherProject, applyScene = true } = {}) {
  const { film, assets: filmFiles } = await filmTool().unpackNfm(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes))
  const p = store.project
  if (film.scene.projectId && film.scene.projectId !== p.id) {
    const go = confirmOtherProject ? await confirmOtherProject(film) : await askConfirm(`Esta película es del proyecto «${film.scene.projectName}», no de «${p.name}». ¿Aplicarla igualmente a la escena «${film.scene.name}»?`, { ok: 'Aplicar' })
    if (!go) return null
  }
  if (!p.scenes.some((s) => s.id === film.scene.id)) throw new Error(`La escena «${film.scene.name}» no existe en este proyecto`)
  // La misma película ya registrada en modo consulta no vuelve a alterar el proyecto.
  if (!applyScene) {
    const existing = p.timelines.find(t => t.filmMaker?.filmId === film.id && t.filmMaker?.sceneId === film.scene.id && (
      (t.filmMaker.kind === 'montage' && t.filmMaker.sourceId === film.id) ||
      (t.filmMaker.kind === 'pass' && film.passes.some(ps => ps.id === t.filmMaker.sourceId))
    ))
    if (existing) {
      // Actualiza únicamente los datos descriptivos del visor para películas ya registradas.
      // No reimporta recursos, no mueve objetos y no duplica las pistas de ejecución.
      let updated = 0
      for (const tl of p.timelines.filter(t => t.filmMaker?.filmId === film.id && t.filmMaker?.sceneId === film.scene.id)) {
        const source = tl.filmMaker
        if (source.kind === 'pass' && !film.passes.some(ps => ps.id === source.sourceId)) continue
        if (source.kind === 'montage' && source.sourceId !== film.id) continue
        const marker = filmMakerSource(film, source.kind, source.sourceId,
          filmTool().cinematicReel(film, source.kind === 'pass' ? source.sourceId : null))
        if (JSON.stringify(source) !== JSON.stringify(marker)) { tl.filmMaker = marker; updated++ }
      }
      if (updated) commit('Actualizar información cinematográfica')
      return { applied: [], missing: [], clips: [], timelines: [], montage: existing.name, filmId: film.id, reused: true, metadataUpdated: updated }
    }
  }
  // Preflight sobre los datos de la escena DESTINO, antes de cambiar la escena activa.
  // switchScene() guarda/carga IndexedDB; nunca se invoca con pistas inválidas.
  const previousSceneId = p.activeSceneId
  const target = previousSceneId === film.scene.id ? { objects: p.objects } : await db.loadScene(p.id, film.scene.id)
  if (!target?.objects) throw new Error(`No se pudo leer la escena de destino «${film.scene.name}»`)
  validateFilmMotion(film, target.objects, film.overrides)
  const hasMotion = !!(film.edit.nodeTracks?.length || film.edit.physicsBakes?.length)
  if (hasMotion) normalizeTimeline(filmTool().montageTimeline(film, {
    name: `Montaje · ${film.name}`, objects: target.objects, animations: store.project.animations, overrides: film.overrides,
  }))
  // El rollback abarca también la transición de escena. El commit único sucede al final.
  const fields = ['objects','captures','models','timelines','profiles','assets','folders','environment','render','audio']
  const previousTimelineId = store.timelineId, addedAssets = []
  let snapshot = null, switched = false
  try {
    if (p.activeSceneId !== film.scene.id) {
      if (!(await switchScene(film.scene.id))) throw new Error('No se pudo activar la escena de destino')
      switched = true
    }
    snapshot = Object.fromEntries(fields.map(k => [k, JSON.parse(JSON.stringify(p[k] ?? null))]))
  const { applied, missing } = applyScene
    ? filmTool().applyOverrides(store.project.objects, film.overrides)
    : { applied: [], missing: [] }
  if (applyScene) for (const id of applied) updateObject(id, JSON.parse(JSON.stringify(film.overrides[id])), { commit: false })
  const res = { applied, missing, clips: [], timelines: [], env: false, render: false, audio: false, assets: [] }
  // atmósfera, color y mezclador ajustados en la película: pasan a ser los de la escena / el proyecto (el juego se ve igual)
  if (applyScene && film.scene.env) { store.project.environment = JSON.parse(JSON.stringify(film.scene.env)); store.editor?.syncEnvironment(); res.env = true }
  if (applyScene && film.scene.render) { store.project.render = normalizeRender(film.scene.render); res.render = true }
  if (applyScene && film.scene.audio) { store.project.audio = JSON.parse(JSON.stringify(film.scene.audio)); res.audio = true }
  // archivos añadidos en la app (música, voces, imágenes): al proyecto, con el mismo id (el timeline los nombra así)
  for (const a of film.assets) {
    const b = filmFiles.get(a.id)
    if (!b || store.project.assets.some((x) => x.id === a.id)) continue
    const folder = normFolder(a.folder || 'Assets/Audio'), name = uniqueFileName(store.project, folder, a.name)
    await db.putAsset(store.project.id, a.id, name, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
    addedAssets.push(a.id)
    store.project.assets.push({ id: a.id, name, folder, kind: a.kind || fileKind(name), ext: extOf(name), bytes: b.byteLength })
    addFolderChain(store.project, folder); res.assets.push(name)
  }
  // tomas del actor → clips de huesos (mismo camino que «Importar .lfcap»); los pases de cámara → cinemáticas con esa cámara
  const actor = film.actor.objectId && store.project.objects.find((o) => o.id === film.actor.objectId)
  const clipOf = new Map()
  const usedTakes = new Set(film.passes.map((ps) => ps.take).filter((i) => i >= 0))
  film.takes.forEach((cap, i) => {
    if (!actor?.modelId) return
    try {
      const r = importCapture(cap, { modelId: actor.modelId, nodeId: actor.id, timeline: !usedTakes.has(i), camera: false, quiet: true, solved: cap.solved })
      clipOf.set(i, r.clips[0]); res.clips.push(...r.clips); res.timelines.push(...r.timelines)
    } catch (e) { if (hasMotion) throw e; toast(e.message, 'error', 6000) }
  })
  if (film.takes.length && !actor?.modelId) toast('La película tiene tomas pero el actor no está en la escena: no se importaron', 'error', 6000)
  for (const ps of film.passes) {
    let name = ps.name, n = 2
    while (store.project.timelines.some((t) => t.name.toLowerCase() === name.toLowerCase())) name = `${ps.name} ${n++}`
    const clip = clipOf.get(ps.take) || ''
    const tl = filmTool().cinematicFromPass(ps, { name, node: clip ? actor.id : '', clip, film, objects: store.project.objects, animations: store.project.animations })
    tl.filmMaker = filmMakerSource(film, 'pass', ps.id, filmTool().cinematicReel(film, ps.id))
    store.project.timelines.push(normalizeTimeline(tl)); store.timelineId = tl.id; res.timelines.push(tl.name)
  }
  // montaje: la película final como una cinemática; sus filtros pasan a ser perfiles de post-proceso del proyecto
  if (filmTool().sequence(film).items.length || hasMotion || film.edit.audio?.some(a => a.clips?.length)) {
    const profName = new Map()
    const used = new Set(film.edit.shots.map((s) => s.filter).filter(Boolean))
    for (const f of film.edit.filters) {
      if (!used.has(f.id)) continue
      const file = uniqueFileName(store.project, PROFILE_FOLDER, `${film.name} · ${f.name}.post`.replace(/[\\/:*?"<>|]+/g, ''))
      const pr = normalizeProfile({ id: uid('pr'), name: file, folder: PROFILE_FOLDER, fx: f.fx })
      store.project.profiles.push(pr); addFolderChain(store.project, PROFILE_FOLDER); profName.set(f.id, pr.name)
    }
    let name = `Montaje · ${film.name}`, n = 2
    while (store.project.timelines.some((t) => t.name.toLowerCase() === name.toLowerCase())) name = `Montaje · ${film.name} ${n++}`
    const tl = filmTool().montageTimeline(film, { name, node: actor?.modelId ? actor.id : '', clipOf: (i) => clipOf.get(i) || '', profileOf: (id) => profName.get(id) || '', objects: store.project.objects, animations: store.project.animations, overrides: {}, clipName: (id) => store.project.assets.find((a) => a.id === id)?.name || id })
    tl.filmMaker = filmMakerSource(film, 'montage', film.id, filmTool().cinematicReel(film))
    store.project.timelines.push(normalizeTimeline(tl)); store.timelineId = tl.id; res.timelines.push(tl.name); res.montage = tl.name; res.profiles = [...profName.values()]
  }
  if (!applyScene && !res.timelines.length) throw new Error('La película no contiene tomas ni montaje reproducible para Cinematics')
  if (res.timelines.length) addFolderChain(store.project, CINEMATICS_FOLDER)
  if (!applyScene && switched) {
    if (!(await switchScene(previousSceneId))) throw new Error('No se pudo restaurar la escena activa después de importar')
    switched = false
  }
  commit('Importar película')
  store.editor?.syncAll()
  const extra = [res.env && 'atmósfera', res.render && 'color', res.audio && 'mezclador'].filter(Boolean)
  toast(`Película «${film.name}»: ${applied.length} objeto(s) actualizados${extra.length ? ', ' + extra.join(', ') : ''}${res.assets.length ? `, ${res.assets.length} archivo(s)` : ''}${missing.length ? `, ${missing.length} ya no existen` : ''}${res.clips.length ? `, ${res.clips.length} toma(s)` : ''}`, missing.length ? 'error' : 'ok', 5000)
  return res
  } catch (error) {
    for (const id of addedAssets) { try { await db.deleteAsset(p.id, id) } catch (rollbackError) { console.error('No se pudo retirar un asset de importación fallida', id, rollbackError) } }
    // Restaurar primero la escena de destino; switchScene la persistirá al volver.
    if (snapshot) for (const [key, value] of Object.entries(snapshot)) p[key] = value
    if (switched && p.activeSceneId !== previousSceneId) {
      try { await switchScene(previousSceneId) }
      catch (rollbackError) { console.error('No se pudo restaurar la escena anterior', rollbackError) }
    }
    store.timelineId = previousTimelineId
    store.editor?.syncAll?.()
    store.editor?.syncEnvironment?.()
    throw error
  }
}
export async function importFilmDialog(options = { applyScene: false }) {
  const [f] = await pickFile('.nfm,.zip'); if (!f) return null
  try { return await importFilm(new Uint8Array(await f.arrayBuffer()), options) } catch (e) { toast('No se pudo importar la película: ' + e.message, 'error', 6000); return null }
}
/** Abre Nether Film Maker (en Electron, en su propia ventana). */
export function openFilmmaker() {
  if (host()?.openFilmmaker) return host().openFilmmaker()
  openTab(new URL('filmmaker.html', location.href).href)
}

/** Reproducción íntegra mediante el PlayMode existente, nunca durante el scrub editorial. */
export async function runFilmCinematic(timeline, { from = 0, onStart } = {}) {
  if (!timeline?.filmMaker || !store.project) throw new Error('Selecciona una película importada válida')
  if (timeline.filmMaker.sceneId !== store.project.activeSceneId) throw new Error('Activa primero la escena de la película')
  const player = store.editor?.player
  if (!player) throw new Error('El Player de Century no está disponible')
  if (!player.on) await player.start()
  if (!player.on) throw new Error('No se pudo iniciar Play Mode')
  const done = player.timelinePlay(timeline.id, { from: Math.min(timeline.duration, Math.max(0, Number(from) || 0)) })
  onStart?.()
  return done
}
