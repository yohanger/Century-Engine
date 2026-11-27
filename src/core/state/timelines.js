import { findDockPanel, focusDockPanel } from '../editor/docking.js'
// Timelines (cinemáticas): crear, duplicar, borrar y abrir el editor.
import { askText } from '../dialogs.js'
import { sanitizeName, normFolder, addFolderChain, allEntries } from '../project.js'
import { uid } from '../../engine/runtime/util.js'
import { store, clearTemporal } from './state.js'
import { commit } from './history.js'
import { newTimeline, sampleTimeline, normalizeTimeline, isFilmMakerTimeline, NEW_TIMELINE_CAMERA_EXIT, normalizeTimelineCameraExit } from '../timeline/model.js'

// La pestaña «anim» sigue siendo el dock original, pero ahora solo reproduce películas de FilmMaker.
export function openCinematics(id = null) {
  if (id !== null) store.cinematicId = store.project?.timelines?.find(t => t.id === id && isFilmMakerTimeline(t))?.id || null
  if (store.cinematicId) { store.projSel = { kind: 'cinematic', id: store.cinematicId }; clearTemporal('timeline') }
  store.prefs.bottomTab = 'anim'; store.prefs.bottomOpen = true
  const at = findDockPanel(store.prefs.dockLayout, 'anim')
  if (at?.kind === 'dock') { store.prefs.dockLayout = focusDockPanel(store.prefs.dockLayout, 'anim'); store.prefs[at.zone + 'Open'] = true }
}
// ---- timelines (cinemáticas) ----
export function openTimelineEditor(id = null) {
  if (id !== null) store.timelineId = store.project?.timelines?.some(item => item.id === id && !isFilmMakerTimeline(item)) ? id : null
  clearTemporal('timeline')
  store.prefs.bottomTab = 'timeline'
  store.prefs.bottomOpen = true
  const at = findDockPanel(store.prefs.dockLayout, 'timeline')
  if (at?.kind === 'dock') {
    store.prefs.dockLayout = focusDockPanel(store.prefs.dockLayout, 'timeline')
    store.prefs[at.zone + 'Open'] = true
  }
}
function uniqueName(items, base) {
  const names = new Set(items.map(item => item.name.toLowerCase()))
  let name = base
  for (let i = 2; names.has(name.toLowerCase()); i++) name = `${base} ${i}`
  return name
}
export function createTimeline(name = 'Timeline', sample = true, folder = 'Assets') {
  const p = store.project
  name = uniqueName([...p.timelines, ...allEntries(p)], sanitizeName(name, 'Timeline'))
  folder = normFolder(folder)
  if (folder === 'Assets/Cinematics' || folder.startsWith('Assets/Cinematics/') || folder === 'Assets/UI/Sistema' || folder.startsWith('Assets/UI/Sistema/')) folder = 'Assets'
  const tl = sample ? sampleTimeline(name) : newTimeline(name)
  tl.folder = folder
  addFolderChain(p, folder)
  p.timelines.push(tl)
  commit('Nuevo timeline')
  return tl
}
/** Crear desde cualquiera de las dos superficies, sin recurso provisional al cancelar. */
export async function createTimelineDialog(folder = 'Assets') {
  const project = store.project
  if (!project || store.locked) return null
  const name = await askText('Nombre del Timeline', 'Timeline', { title: 'Nuevo Timeline', ok: 'Crear' })
  if (name === null || !String(name).trim() || project !== store.project || store.locked) return null
  const timeline = createTimeline(name, false, folder)
  store.projSel = { kind: 'timeline', id: timeline.id }
  openTimelineEditor(timeline.id)
  return timeline
}
export function duplicateTimeline(id) {
  const p = store.project, src = p.timelines.find((t) => t.id === id); if (!src) return null
  const tl = normalizeTimeline(JSON.parse(JSON.stringify(src)))
  tl.id = uid('tl'); tl.name = uniqueName([...p.timelines, ...allEntries(p)], src.name + ' (copia)')
  delete tl.filmMaker // La copia editada ya no es un artefacto importado de FilmMaker.
  if (!tl.cameraExit) tl.cameraExit = normalizeTimelineCameraExit(NEW_TIMELINE_CAMERA_EXIT) // Nueva copia, no mutar original.
  const groupIds=new Map((tl.groups||[]).map(group=>{const old=group.id;group.id=uid('tg');return [old,group.id]}))
  for (const marker of tl.markers||[]) marker.id=uid('tm')
  for (const tr of tl.tracks) {
    tr.id=uid('tr')
    if(tr.groupId)tr.groupId=groupIds.get(tr.groupId)
    const keyIds=new Map()
    for(const key of tr.keys){const old=key.id;key.id=uid('k');keyIds.set(old,key.id)}
    for(const clip of tr.clips||[]){clip.id=uid('tc');clip.from=keyIds.get(clip.from);clip.to=keyIds.get(clip.to)}
  }
  p.timelines.push(tl); commit('Duplicar timeline'); return tl
}
/** Borra uno o varios recursos temporales en una sola operación del historial. */
export function deleteTimelines(ids, { record = true } = {}) {
  const wanted = new Set(ids)
  const p = store.project
  const alive = new Set((p.timelines || []).filter(t => wanted.has(t.id)).map(t => t.id))
  if (!alive.size) return false
  p.timelines = p.timelines.filter(t => !alive.has(t.id))
  if (alive.has(store.timelineId)) store.timelineId = null
  if (alive.has(store.cinematicId)) store.cinematicId = null
  if (store.temporalSelection?.kind === 'timeline' && alive.has(store.temporalSelection.resourceId)) clearTemporal('timeline', store.temporalSelection.resourceId)
  if (store.temporalSeek?.kind === 'timeline' && alive.has(store.temporalSeek.resourceId)) store.temporalSeek = null
  if (['timeline', 'cinematic'].includes(store.projSel?.kind) && alive.has(store.projSel.id)) store.projSel = null
  if (record) commit(alive.size === 1 ? 'Eliminar timeline' : 'Eliminar timelines')
  return true
}
export const deleteTimeline = (id) => deleteTimelines([id])
