// Recurso Cinematic nativo: datos de autoría del proyecto y control de escrituras concurrentes.
// `revision` pertenece al registro del proyecto; no es una versión del formato .nfm.
const fail = message => { throw new Error(message) }
// Token de edición: cambia con cada mutación, incluso tras deshacer. No es versión de .nfm.
export const nextNativeRevision = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
export const nativeCinematic = (project, id) => (project?.cinematics || []).find(item => item.id === id) || null
export function newNativeCinematic(project, film, folder = 'Assets/Cinematics') {
  if (!project?.id || !film?.id || film.scene?.projectId !== project.id || !(project.scenes || []).some(s => s.id === film.scene.id))
    fail('La cinematográfica no pertenece a una escena válida de este proyecto')
  if (nativeCinematic(project, film.id) || (project.timelines || []).some(t => t.id === film.id) || (project.assets || []).some(a => a.id === film.id))
    fail('Ya existe un recurso con este identificador')
  return { id: film.id, name: String(film.name || 'Película'), folder, sceneId: film.scene.id, revision: nextNativeRevision() }
}
export function updatedNativeCinematic(project, id, film, expectedRevision) {
  const current = nativeCinematic(project, id)
  if (!current) fail('El Cinematic ya no existe en el proyecto')
  if (typeof expectedRevision !== 'string' || current.revision !== expectedRevision)
    fail('Conflicto: el Cinematic cambió en otra sesión; no se sobrescribió')
  if (!film || film.id !== id || film.scene?.projectId !== project.id || !(project.scenes || []).some(s => s.id === film.scene.id))
    fail('Identidad o escena inválida para guardar el Cinematic')
  if ((project.cinematics || []).some(other => other.id !== id && other.folder === current.folder && other.name.toLocaleLowerCase() === String(film.name || current.name).toLocaleLowerCase()))
    fail('Ya existe otro Cinematic con ese nombre en la carpeta')
  if (current.sceneId !== film.scene.id) fail('No se permite reasignar la escena de un Cinematic nativo')
  return { ...current, name: String(film.name || current.name), revision: nextNativeRevision() }
}
// Sello de dependencias de escena: detecta cambios pertinentes mientras FilmMaker la rueda.
// No se serializa dentro del recurso, ni forma parte del formato .nfm.
export function cinematicSceneStamp(objects, environment, render, audio) {
  const content = JSON.stringify([objects || [], environment || null, render || null, audio || null])
  let hash = 2166136261
  for (let i = 0; i < content.length; i++) hash = Math.imul(hash ^ content.charCodeAt(i), 16777619)
  return `${content.length}:${hash >>> 0}`
}

// Cuerpo del recurso: JSON cinematográfico sin project.lfproj embebido ni campos de versión.
export const encodeNativeFilm = film => new TextEncoder().encode(JSON.stringify(film))
export function decodeNativeFilm(bytes, id, projectId) {
  if (!bytes) fail('Falta el contenido del Cinematic en Assets')
  let film
  try { film = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) } catch { fail('El recurso Cinematic no contiene una película válida') }
  if (!film || film.id !== id || film.scene?.projectId !== projectId) fail('Identidad del Cinematic incompatible con su proyecto')
  return film
}
