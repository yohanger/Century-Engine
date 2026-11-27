import { validateSceneVfx } from '../engine/runtime/vfx/scene-validation.js'
import { modelIdsInScene } from '../engine/runtime/database/models.js'
import { resolveAudioClip } from '../engine/runtime/audio/config.js'
import { isFilmMakerTimeline } from './timeline/model.js'

// Lista de escenas de la ventana Build (lógica pura sobre el proyecto; sin store ni DOM, para poder probarla en Node).
// `p.build = { target, scenes: [ids en orden], last }`. La primera escena de la lista es la inicial del juego.

/** Escenas que entran en el juego, en orden. Sin lista guardada: todas, con la antigua «escena inicial» (game.startScene) primero. */
export function buildSceneIds(p) {
  if (!p) return []
  const all = p.scenes.map((s) => s.id)
  let list = Array.isArray(p.build?.scenes) ? p.build.scenes.filter((id) => all.includes(id)) : null
  if (!list) { const st = p.game?.startScene; list = st && all.includes(st) ? [st, ...all.filter((id) => id !== st)] : all }
  return list
}
/** Garantiza p.build con su lista materializada y la devuelve (para poder editarla). */
export function ensureBuildList(p) {
  if (!p.build) p.build = { target: 'linux-x64', scenes: null, last: null }
  if (!p.build.scenes) p.build.scenes = buildSceneIds(p)
  return p.build
}
/** Mete o saca una escena de la lista (al meterla va al final). */
export function toggleScene(p, id) {
  const b = ensureBuildList(p), i = b.scenes.indexOf(id)
  if (i >= 0) b.scenes.splice(i, 1); else if (p.scenes.some((s) => s.id === id)) b.scenes.push(id)
  return b.scenes
}
/** Mueve una escena de la lista (dir −1 arriba, +1 abajo). Devuelve si cambió algo. */
export function moveScene(p, id, dir) {
  const b = ensureBuildList(p), i = b.scenes.indexOf(id), j = i + dir
  if (i < 0 || j < 0 || j >= b.scenes.length) return false
  ;[b.scenes[i], b.scenes[j]] = [b.scenes[j], b.scenes[i]]
  return true
}

/** Verifica recursos de las escenas elegidas antes de escribir un juego exportado. */
export function validateBuildSources(meta, scenes, files) {
  if (!scenes?.length) throw new Error('No hay ninguna escena en la lista Build')
  const known = new Set((meta.models || []).map((m) => m.id))
  const scripts = new Map((meta.scripts || []).map(s => [s.id, s]))
  for (const scene of scenes) {
    if (!scene?.data) throw new Error(`Falta el contenido de la escena «${scene?.name || scene?.id}»`)
    validateSceneVfx(scene.data.objects || [], meta.vfx || [], meta.assets || [])
    for (const obj of scene.data.objects || []) {
      const ids = Array.isArray(obj.scriptIds) ? obj.scriptIds : obj.scriptId ? [obj.scriptId] : []
      if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string' || !id.trim() || id !== id.trim()) || new Set(ids).size !== ids.length)
        throw new Error(`Scripts de Nodo inválidos en «${obj.name || obj.id}»`)
      for (const id of ids) if (scripts.get(id)?.execution !== 'node')
        throw new Error(`La escena «${scene.name}» contiene un Script de Nodo ausente o incompatible: ${id}`)
    }
    for (const o of scene.data.objects || []) if (o.type === 'vfx' && o.props?.vfxId) {
      const fx = (meta.vfx || []).find((v) => v.id === o.props.vfxId)
      const texId = fx?.appearance?.textureId
      if (texId && !files.has(texId)) throw new Error(`VFX3D «${o.name || o.id}»: falta el archivo de textura ${texId}`)
    }
    const used = modelIdsInScene(scene.data.objects || [], meta.database, meta.prefabs)
    for (const id of used) {
      if (!known.has(id)) throw new Error(`La escena «${scene.name}» usa un modelo que no existe en Assets/Models: ${id}`)
      if (!files.has(id)) throw new Error(`Falta el archivo del modelo ${id} usado en «${scene.name}». Reimpórtalo antes de exportar.`)
    }
  }
  // La exportación filtra Assets sin binario: impedir que Timeline conserve referencias
  // aparentemente válidas que el Player no podrá cargar del paquete.
  for (const timeline of meta.timelines || []) {
    if (isFilmMakerTimeline(timeline)) continue // Las películas importadas no son Timeline de gameplay.
    for (const track of timeline?.tracks || []) {
      if (track?.kind !== 'audio' || track.muted) continue
      for (const key of track.keys || []) {
        if (key?.action === 'stop') continue
        const reference = String(key?.clip || '').trim()
        const context = `Timeline «${timeline.name || timeline.id}» / pista «${track.name || track.id}» / clave «${key?.id || '?'}»`
        if (!reference) throw new Error(`${context}: falta asignar el clip de audio antes de exportar.`)
        const id = resolveAudioClip(meta, reference)
        if (!id) throw new Error(`${context}: no existe el Audio Asset «${reference}». Conserva la referencia en el proyecto y asígnale un recurso válido.`)
        if (!files?.has(id)) throw new Error(`${context}: falta el archivo de audio «${reference}» (ID: ${id}). Reimpórtalo antes de exportar.`)
      }
    }
  }
}
