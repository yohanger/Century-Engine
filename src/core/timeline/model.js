import { normalizeFx, normalizeSource } from '../../engine/runtime/audio/config.js'
import { MAX_VOLUME_POINTS, normalizeVolumeAutomation, normalizeVolumePointName } from '../../engine/runtime/audio/automation.js'
// Modelo de datos de los timelines (cinemáticas). Sin DOM ni three: lo usan el editor, el runtime y las pruebas.
//
//  Timeline: { id, name, duration, loop, lockPlayer, skippable, letterbox, tracks: [Pista] }
//  Pista:    { id, kind, name, muted, node?, prop?, path?, keys: [Clave] }
//    camera   · claves { t, mode: free|node|player|camera3d, pos, rot[pitch,yaw,roll], fov, node, sceneId?, ease }
//    node     · claves { t, v (vec3 o bool), ease }                    (prop: position | rotation | scale | visible | active)
//    audio    · claves { t, action: play|stop, clip, group, volume, pitch, loop, fade, offset, fadeIn, duration, fadeOut }
//               (offset = desde qué segundo del archivo · duration > 0 = se para sola a los N s con fundido de salida fadeOut)
//    commands · claves { t, name, list: [Comando], block, essential }  (los mismos comandos que los eventos)
//    method   · pista { node: ID persistente, byId: true }, claves { t, method, args: [JSON] }
//  `ease` describe cómo se llega desde ESTA clave a la siguiente: linear · in · out · inOut · cut (mantiene y corta).
import { uid } from '../../engine/runtime/util.js'
import { normalizeBakeTrack } from './physics.js'
import { EASES as ANIM_EASES, PROPS, validatePropertyValue, nodeAnimationProperty } from '../../engine/runtime/anim/model.js'

// El Player sigue leyendo timeline.tracks. Estos encabezados son SOLO filas editoriales
// derivadas de las referencias existentes, sin crear otro nodo, pista ni grupo persistente.
export function timelineTrackEditable(track) { return !!track && track.kind !== 'bake' && track.locked !== true }
/** Devuelve el nodo real del que depende una pista, únicamente cuando la referencia es inequívoca. */
export function timelineTrackNodeOwner(track, objects = [], sceneId = null) {
  if (!track || !Array.isArray(objects)) return null
  let id = '', sourceScene = track.sceneId || ''
  if (track.kind === 'node' || track.kind === 'method') {
    if (!track.node) return null
    if (track.byId === true || objects.some(o => o.id === track.node)) id = track.node
    else {
      const candidates = objects.filter(o => o.name === track.node)
      if (candidates.length !== 1) return null // El nombre heredado no es una identidad segura.
      id = candidates[0].id
    }
  } else if (track.kind === 'camera') {
    if (!track.keys?.length || track.clips?.length) return null
    const sources = track.keys.filter(k => k.mode === 'camera3d' && k.node && k.sceneId)
    if (sources.length !== track.keys.length) return null // Pista global: free, player o varias fuentes.
    if (sources.some(k => k.node !== sources[0].node || k.sceneId !== sources[0].sceneId)) return null
    id = sources[0].node
    sourceScene = sources[0].sceneId
  } else return null
  if (sceneId && sourceScene && sceneId !== sourceScene) return null
  const node = objects.find(o => o.id === id)
  if (!node || (track.kind === 'camera' && node.type !== 'camera')) return null
  return {node, nodeId:node.id, sceneId:sourceScene || sceneId || ''}
}
/** Filas jerárquicas derivadas; la agrupación manual no se sobrescribe ni se serializa. */
export function timelineVisibleRows(timeline, {objects = [], sceneId = null, collapsedNodes = null, expandedGroupId = null} = {}) {
  if (!timeline) return []
  const tracks = Array.isArray(timeline.tracks) ? timeline.tracks : []
  const groups = Array.isArray(timeline.groups) ? timeline.groups : []
  const known = new Set(groups.map(g => g.id))
  const indices = new Map(tracks.map((track,index)=>[track,index]))
  const sortTracks = items => items.map(track => ({track,index:indices.get(track)}))
    .sort((a,b) => (a.track.displayOrder ?? a.index) - (b.track.displayOrder ?? b.index) || a.index-b.index)
    .map(({track}) => track)
  const scopes = new Map(), owners = new Map()
  if (objects.length && sceneId) for (const track of tracks) {
    const owner = timelineTrackNodeOwner(track, objects, sceneId)
    if (!owner) continue
    const key = `${owner.sceneId}\0${owner.nodeId}`
    owners.set(track, { ...owner, key })
    if (!scopes.has(key)) scopes.set(key,new Set())
    scopes.get(key).add(known.has(track.groupId) ? track.groupId : '')
  }
  const rowsFor = (list, scope) => {
    const ordered = sortTracks(list), emitted = new Set(), result = []
    for (const track of ordered) {
      if (emitted.has(track)) continue
      const owner = owners.get(track)
      // Si el mismo nodo está repartido por grupos manuales, preservar el orden
      // original y señalar el conflicto: no duplicar encabezados ni mover datos.
      if (!owner || scopes.get(owner.key)?.size !== 1) {
        result.push({type:'track', track, id:track.id, nodeConflict:!!owner})
        emitted.add(track)
        continue
      }
      const siblings = ordered.filter(item => owners.get(item)?.key === owner.key)
      const id = `node:${scope}:${owner.sceneId}:${owner.nodeId}`
      result.push({type:'node',id,...owner,tracks:siblings})
      siblings.forEach(item => emitted.add(item))
      if (collapsedNodes?.has(id)) continue
      result.push(...siblings.map(item=>({type:'track',track:item,id:item.id,child:true,nodeId:owner.nodeId})))
    }
    return result
  }
  const rows = rowsFor(tracks.filter(t => !t.groupId || !known.has(t.groupId)), '')
  for (const group of groups) {
    rows.push({type:'group',group,id:group.id})
    if (!group.collapsed || group.id === expandedGroupId) rows.push(...rowsFor(tracks.filter(t=>t.groupId===group.id),group.id))
  }
  return rows
}
export function addTimelineGroup(timeline, name = 'Grupo') {
  if (!timeline || !Array.isArray(timeline.tracks)) throw new Error('Timeline inválido')
  if (!Array.isArray(timeline.groups)) timeline.groups = []
  if (timeline.groups.length >= 64) throw new Error('Límite de 64 grupos')
  const group = {id:uid('tg'), name:String(name || 'Grupo').trim().slice(0,80) || 'Grupo', collapsed:false}
  timeline.groups.push(group)
  return group
}
export function removeTimelineGroup(timeline, groupId) {
  const index = (timeline?.groups || []).findIndex(g => g.id === groupId)
  if (index < 0) return false
  // Desagrupar no borra ni bloquea las pistas, claves o clips existentes.
  for (const track of timeline.tracks || []) if (track.groupId === groupId) delete track.groupId
  timeline.groups.splice(index,1)
  return true
}
export function moveTimelineGroup(timeline, groupId, beforeGroupId = null) {
  const groups = timeline?.groups || []
  const index = groups.findIndex(g=>g.id===groupId)
  if (index<0 || beforeGroupId===groupId) return false
  const target=beforeGroupId===null?groups.length:groups.findIndex(g=>g.id===beforeGroupId)
  if (target<0) return false
  const [group]=groups.splice(index,1)
  groups.splice(index<target?target-1:target,0,group)
  return true
}
export function moveTimelineTrack(timeline, trackId, {groupId=null,beforeId=null}={}) {
  const tracks=timeline?.tracks
  if (!Array.isArray(tracks) || (groupId!==null && !(timeline.groups||[]).some(g=>g.id===groupId))) return false
  const moving=tracks.find(t=>t.id===trackId)
  if(!moving || (beforeId===trackId && (moving.groupId||null)===groupId)) return false
  const target=beforeId===null?null:tracks.find(t=>t.id===beforeId)
  if(beforeId!==null && (!target || (target.groupId||null)!==groupId))return false
  const sortedTracks=(id)=>tracks.map((track,index)=>({track,index}))
    .filter(x=>(x.track.groupId||null)===id)
    .sort((a,b)=>(a.track.displayOrder??a.index)-(b.track.displayOrder??b.index)||a.index-b.index)
    .map(x=>x.track)
  const ordered=sortedTracks(groupId).filter(t=>t.id!==trackId)
  const position=beforeId===null?ordered.length:ordered.findIndex(t=>t.id===beforeId)
  if(position<0)return false
  const previousGroup=moving.groupId||null
  const previously=sortedTracks(previousGroup).map(track=>track.id)
  ordered.splice(position,0,moving)
  const now=ordered.map(track=>track.id)
  if(previousGroup===groupId && now.length===previously.length && now.every((id,index)=>id===previously[index])) return false
  if(groupId===null)delete moving.groupId
  else moving.groupId=groupId
  // Orden solo editorial: el array runtime timeline.tracks permanece intacto.
  ordered.forEach((track,index)=>{track.displayOrder=index})
  return true
}
export function addTimelineMarker(timeline,time,name='Marcador') {
  if (!timeline || !Number.isFinite(time) || time<0 || time>timeline.duration) throw new Error('Marcador fuera del Timeline')
  if (!Array.isArray(timeline.markers)) timeline.markers=[]
  if (timeline.markers.length>=512) throw new Error('Límite de marcadores alcanzado')
  const marker={id:uid('tm'),t:roundedMarkerTime(time),name:String(name||'Marcador').trim().slice(0,80)||'Marcador'}
  timeline.markers.push(marker)
  timeline.markers.sort((a,b)=>a.t-b.t)
  return marker
}
const roundedMarkerTime = t=>+t.toFixed(5)
export function moveTimelineMarker(timeline,markerId,time) {
  const marker=timeline?.markers?.find(m=>m.id===markerId)
  if (!marker || !Number.isFinite(time) || time<0 || time>timeline.duration) return false
  const next=roundedMarkerTime(time)
  if(next===marker.t)return false
  marker.t=next;timeline.markers.sort((a,b)=>a.t-b.t)
  return true
}
export function deleteTimelineMarker(timeline,markerId) {
  const markers=timeline?.markers
  if(!Array.isArray(markers)||!markers.some(m=>m.id===markerId))return false
  timeline.markers=markers.filter(m=>m.id!==markerId)
  return true
}

// Selección editorial por ID: no se persiste en project.lfproj ni altera la semántica de clips.
// Estas operaciones comparten el modelo real de Timeline y el historial original del Editor.
export function timelineSelectedKeys(timeline, refs = []) {
  const result = [], used = new Set()
  for (const ref of Array.isArray(refs) ? refs : []) {
    const track = timeline?.tracks?.find(t => t.id === ref?.tr)
    if (!timelineTrackEditable(track) || !Array.isArray(track.keys)) continue
    const key = track.keys.find(k => k.id === ref.k)
    if (!key || !Number.isFinite(key.t)) continue
    const identity = track.id + '\0' + key.id
    if (used.has(identity)) continue
    used.add(identity)
    result.push({ track, key, tr: track.id, k: key.id })
  }
  return result
}

const roundedTime = value => +value.toFixed(5)
/** Traslación única para todas las claves; límite común y ajuste al cabezal, otras claves o rejilla. */
export function timelineSelectionMoveDelta(timeline, refs, wanted, { snap = 0, playhead = null, zoom = 70, tolerancePixels = 8, anchor = null } = {}) {
  const selected = timelineSelectedKeys(timeline, refs)
  if (!selected.length || !Number.isFinite(wanted)) return 0
  const duration = Math.max(0, Number(timeline.duration) || 0)
  const min = Math.min(...selected.map(s => s.key.t)), max = Math.max(...selected.map(s => s.key.t))
  const clamp = d => Math.max(-min, Math.min(duration - max, d))
  let delta = clamp(wanted)
  if (!(Number(snap) > 0)) return roundedTime(delta)
  // Los elementos seleccionados mantienen sus offsets; el primer/activo actúa como ancla de rejilla.
  const reference = selected.find(s => s.tr === anchor?.tr && s.k === anchor?.k) || selected[0]
  const gridDelta = Math.round((reference.key.t + delta) / snap) * snap - reference.key.t
  delta = clamp(gridDelta)
  const selectedIds = new Set(selected.map(s => s.tr + '\0' + s.k))
  const targets = [0, duration, ...(timeline.markers||[]).map(m=>m.t)]
  if (Number.isFinite(playhead)) targets.push(Math.max(0, Math.min(duration, playhead)))
  for (const track of timeline.tracks || []) for (const key of track.keys || []) {
    if (!selectedIds.has(track.id + '\0' + key.id) && Number.isFinite(key.t)) targets.push(key.t)
  }
  const tolerance = Math.max(0, tolerancePixels) / Math.max(1, Number(zoom) || 1)
  targets.sort((a,b) => a-b)
  let best = null
  for (const selectedKey of selected) {
    const expected = selectedKey.key.t + clamp(wanted)
    let lo = 0, hi = targets.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (targets[mid] < expected) lo = mid + 1
      else hi = mid
    }
    for (const index of [lo - 1, lo]) {
      const target = targets[index]
      if (!Number.isFinite(target)) continue
      const candidate = target - selectedKey.key.t
      if (candidate < -min - 1e-8 || candidate > duration - max + 1e-8) continue
      const distance = Math.abs(candidate - clamp(wanted))
      if (distance <= tolerance && (!best || distance < best.distance)) best = { delta:candidate, distance }
    }
  }
  return roundedTime(clamp(best ? best.delta : delta))
}

/** Una llamada = una operación: ordenar claves reales y registrar un único commit desde el editor. */
export function moveTimelineSelection(timeline, refs, delta) {
  const selected = timelineSelectedKeys(timeline, refs)
  if (!selected.length || !Number.isFinite(delta) || !delta) return 0
  const duration = Math.max(0, Number(timeline.duration) || 0)
  const min = Math.min(...selected.map(s => s.key.t)), max = Math.max(...selected.map(s => s.key.t))
  const actual = Math.max(-min, Math.min(duration - max, delta))
  if (Math.abs(actual) < 1e-7) return 0
  // Los clips dependen de un par de IDs fuente; nunca invertir ni colapsar ese par.
  const shifted = new Set(selected.map(s => s.tr + '\0' + s.k))
  for (const track of timeline.tracks || []) for (const clip of track.clips || []) {
    const from = track.keys.find(k => k.id === clip.from), to = track.keys.find(k => k.id === clip.to)
    if (!from || !to) return 0
    const first = from.t + (shifted.has(track.id + '\0' + from.id) ? actual : 0)
    const last = to.t + (shifted.has(track.id + '\0' + to.id) ? actual : 0)
    if (last - first < .05 - 1e-7) return 0
  }
  const affected = new Set()
  for (const selectedKey of selected) {
    selectedKey.key.t = roundedTime(selectedKey.key.t + actual)
    affected.add(selectedKey.track)
  }
  for (const track of affected) sortKeys(track)
  return selected.length
}

export function duplicateTimelineSelection(timeline, refs, distance = 1) {
  const selected = timelineSelectedKeys(timeline, refs)
  if (!selected.length) return []
  const max = Math.max(...selected.map(s => s.key.t)), min = Math.min(...selected.map(s => s.key.t))
  const right = timeline.duration - max, left = min
  // Nunca duplicar en la misma posición sin advertencia ni modificar una pista horneada.
  const offset = right >= .05 ? Math.min(Math.max(.05, Math.abs(distance) || 1), right)
    : left >= .05 ? -Math.min(Math.max(.05, Math.abs(distance) || 1), left) : 0
  if (Math.abs(offset) < .05 - 1e-8) return []
  const newRefs = [], affected = new Set()
  for (const { track, key } of selected) {
    const copy = JSON.parse(JSON.stringify(key))
    copy.id = uid('k')
    copy.t = roundedTime(key.t + offset)
    for (const cmd of copy.list || []) cmd.id = uid('c')
    track.keys.push(copy)
    affected.add(track)
    newRefs.push({ tr:track.id, k:copy.id })
  }
  for (const track of affected) sortKeys(track)
  return newRefs
}

export function deleteTimelineSelection(timeline, refs) {
  const selected = timelineSelectedKeys(timeline, refs)
  if (!selected.length) return 0
  const doomed = new Set(selected.map(s => s.tr + '\0' + s.k))
  for (const track of timeline.tracks || []) for (const clip of track.clips || []) {
    if (doomed.has(track.id + '\0' + clip.from) || doomed.has(track.id + '\0' + clip.to))
      throw new Error('La clave pertenece a un clip. Elimina primero el clip para conservar sus fuentes')
  }
  const keysByTrack = new Map()
  for (const {tr,k} of selected) {
    if (!keysByTrack.has(tr)) keysByTrack.set(tr,new Set())
    keysByTrack.get(tr).add(k)
  }
  for (const track of timeline.tracks) {
    const ids = keysByTrack.get(track.id)
    if (ids) track.keys = track.keys.filter(key => !ids.has(key.id))
  }
  return selected.length
}

/** Rectángulo desde el lienzo: track index + tiempo; sin DOM ni metadatos guardados. */
export function timelineKeysInRegion(timeline, aTime, bTime, aTrack, bTrack, visibleRows = null) {
  if (!timeline || ![aTime,bTime,aTrack,bTrack].every(Number.isFinite)) return []
  const lo = Math.min(aTime,bTime), hi = Math.max(aTime,bTime)
  const rows = visibleRows || timeline.tracks.map(track=>({type:'track',track}))
  const first = Math.max(0, Math.min(aTrack,bTrack)), last = Math.min(rows.length - 1, Math.max(aTrack,bTrack))
  return rows.flatMap((row,index) => index < first || index > last || row.type!=='track' || !timelineTrackEditable(row.track) ? [] :
    (row.track.keys || []).filter(key => key.t >= lo - 1e-6 && key.t <= hi + 1e-6).map(key => ({ tr:row.track.id, k:key.id })))
}

// Operaciones nativas de clips sobre claves existentes. Sin nuevo reloj, recursos ni gestor global.
// Intervalos semiabiertos: en un corte exacto se activa el clip que comienza, no dos a la vez.
const clipEnd = c => c.start + c.duration
const clipCopy = clip => ({ ...clip })
const clipHasSource = (track, c) => {
  const first = track.keys.find(k => k.id === c.from), last = track.keys.find(k => k.id === c.to)
  return first && last && first.t < last.t
}
export function timelineClipOverlapCount(clips = []) {
  const points = clips.flatMap(c => [{ t:c.start, d:1 }, { t:clipEnd(c), d:-1 }]).sort((a,b) => a.t-b.t || a.d-b.d)
  let active = 0, peak = 0
  for (const point of points) { active += point.d; peak = Math.max(peak,active) }
  return peak
}
export function timelineClipAt(track, time) {
  if (!CLIP_KINDS.has(track?.kind) || track.kind === 'node' && track.prop === 'visible') return []
  return (track.clips || []).filter(c => time >= c.start && time < clipEnd(c) && clipHasSource(track,c))
    .sort((a,b) => a.start-b.start || a.id.localeCompare(b.id))
}
/** Crea una referencia temporal a un tramo entre claves consecutivas (sin copiarlas). */
export function addTimelineClip(timeline, trackId, startKeyId) {
  const track = timeline?.tracks?.find(t => t.id === trackId)
  if (!timelineTrackEditable(track) || !CLIP_KINDS.has(track.kind) || track.kind === 'node' && track.prop === 'visible') throw new Error('Solo Cámara y propiedades numéricas de Nodo admiten clips mezclables')
  const keys = [...track.keys].sort((a,b) => a.t-b.t)
  const i = keys.findIndex(key => key.id === startKeyId)
  const a = keys[i], b = keys[i+1]
  if (!a || !b || b.t - a.t < .05) throw new Error('Selecciona un tramo entre dos claves con duración mínima de 0.05 segundos')
  const clip = {id:uid('tc'),from:a.id,to:b.id,start:roundedTime(a.t),duration:roundedTime(b.t-a.t),in:0,out:1}
  const clips = [...(track.clips||[]),clip]
  if (timelineClipOverlapCount(clips) > 2) throw new Error('Mix no admite más de dos clips simultáneos')
  track.clips = clips
  return clip
}
/** Los recortes Replace mantienen exactamente el intervalo de fuente correspondiente. */
function clipPiece(original,start,end,id=original.id) {
  const fractionStart = (start-original.start)/original.duration
  const fractionEnd = (end-original.start)/original.duration
  return { ...original,id,start:roundedTime(start),duration:roundedTime(end-start),
    in:original.in+(original.out-original.in)*fractionStart,
    out:original.in+(original.out-original.in)*fractionEnd }
}
function replaceClipRegion(clips,start,end) {
  const result=[]
  for (const c of clips) {
    if (clipEnd(c) <= start+1e-7 || c.start >= end-1e-7) {result.push(clipCopy(c));continue}
    if (c.start < start-1e-7) result.push(clipPiece(c,c.start,start))
    if (clipEnd(c) > end+1e-7) result.push(clipPiece(c,end,clipEnd(c),c.start < start ? uid('tc') : c.id))
  }
  return result
}
/** Transacción temporal, calculada antes de mutar. Rechazos nunca dejan ediciones parciales. */
export function editTimelineClip(timeline, trackId, clipId, {start=null,duration=null,mode='mix'} = {}) {
  const track=timeline?.tracks?.find(t=>t.id===trackId), original=track?.clips?.find(c=>c.id===clipId)
  if (!timelineTrackEditable(track) || !CLIP_KINDS.has(track.kind) || !original || !TIMELINE_EDIT_MODES.some(m=>m[0]===mode)) throw new Error('Clip o modo de edición no válido')
  if (!clipHasSource(track,original)) throw new Error('Las claves fuente del clip ya no existen')
  const targetStart = start===null ? original.start : start
  const targetLength = duration===null ? original.duration : duration
  if (!Number.isFinite(targetStart) || !Number.isFinite(targetLength) || targetStart<0 || targetLength<.05 || targetStart+targetLength > timeline.duration+1e-7) throw new Error('El intervalo del clip queda fuera de la duración del Timeline')
  const copy={...original,start:roundedTime(targetStart),duration:roundedTime(targetLength)}
  const delta=copy.start-original.start, lengthDelta=copy.duration-original.duration
  if (!delta && !lengthDelta) return false
  // El asa derecha recorta el mismo origen en lugar de acelerar silenciosamente sus claves.
  if (duration!==null) {
    const nextOut=original.in+(original.out-original.in)*(copy.duration/original.duration)
    if (nextOut>1+1e-7) throw new Error('No se puede extender el clip más allá de sus claves fuente')
    copy.out=Math.min(1,nextOut)
  }
  let clips=track.clips.filter(c=>c.id!==original.id).map(clipCopy)
  if (mode==='ripple') {
    // Shift de material posterior, conservando duraciones. El ancla es el final original.
    const shift=delta+lengthDelta
    clips=clips.map(c => c.start>=clipEnd(original)-1e-7 ? {...c,start:roundedTime(c.start+shift)}:c)
    if (clips.some(c=>c.start < 0 || clipEnd(c)>timeline.duration+1e-7)) throw new Error('Ripple excede los límites temporales del recurso')
  } else if (mode==='replace') clips=replaceClipRegion(clips,copy.start,clipEnd(copy))
  clips.push(copy)
  if (mode==='ripple' && timelineClipOverlapCount(clips)>1) throw new Error('Ripple no permite crear solapamientos: usa Mix o ajusta el clip anterior')
  if (timelineClipOverlapCount(clips)>2) throw new Error('Mix no admite más de dos clips simultáneos')
  track.clips=clips.sort((a,b)=>a.start-b.start||a.id.localeCompare(b.id))
  return true
}
export function deleteTimelineClip(timeline,trackId,clipId) {
  const track=timeline?.tracks?.find(t=>t.id===trackId)
  if (!timelineTrackEditable(track) || !track.clips?.some(c=>c.id===clipId)) return false
  track.clips=track.clips.filter(c=>c.id!==clipId)
  return true
}
/** Eventos: Ripple desplaza los posteriores, Replace sustituye solo la coincidencia puntual. */
export function editTimelineEvent(timeline,trackId,keyId,target,mode='ripple') {
  const track=timeline?.tracks?.find(t=>t.id===trackId), key=track?.keys?.find(k=>k.id===keyId)
  if (!timelineTrackEditable(track) || !['audio','commands','method'].includes(track?.kind) || !key || !['ripple','replace'].includes(mode)) throw new Error('Los eventos discretos solo admiten Ripple o Replace')
  if (!Number.isFinite(target) || target<0 || target>timeline.duration) throw new Error('Tiempo de evento fuera del recurso')
  const delta=roundedTime(target-key.t)
  if (!delta) return false
  const following=track.keys.filter(k=>k!==key && k.t>key.t)
  if (mode==='ripple' && following.some(k=>k.t+delta<0 || k.t+delta>timeline.duration)) throw new Error('Ripple de eventos excede la duración del Timeline')
  if (mode==='ripple') for(const k of following) k.t=roundedTime(k.t+delta)
  else track.keys=track.keys.filter(k=>k===key || Math.abs(k.t-target)>1e-5)
  key.t=roundedTime(target);sortKeys(track)
  return true
}

// Origen del recurso importado, independiente del nombre visible y de su colección.
export const FILMMAKER_SOURCE = 'nether-film-maker'
export const CINEMATICS_FOLDER = 'Assets/Cinematics'

// Escala de regla compartida entre Timeline de Century y FilmMaker.
// Solo geometría visual: nunca crea pistas, relojes ni estado de película.
export function timelineRulerTicks(duration, pixelsPerSecond, minMajorPixels = 62) {
  const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 30, 60, 120, 300, 600, 1200, 3600, 7200, 14400]
  const scale = Math.max(1, Number(pixelsPerSecond) || 1)
  const step = steps.find(v => v * scale >= minMajorPixels) || steps.at(-1)
  const minor = step * scale >= 60
  const increment = minor ? step / 2 : step
  const limit = Math.max(0, Math.min(86400, Number(duration) || 0))
  const ticks = []
  for (let i = 0; i <= Math.ceil(limit / increment) && ticks.length < 1200; i++) {
    const t = +(i * increment).toFixed(5)
    if (t > limit + 1e-6) break
    ticks.push({ t, major: !minor || i % 2 === 0 })
  }
  return ticks
}
function filmReel(reel) {
  if (!reel || typeof reel !== 'object' || Array.isArray(reel)) return null
  const range = value => Math.min(86400, Math.max(0, Number.isFinite(+value) ? +value : 0))
  const bounded = value => String(value ?? '').slice(0, 160)
  const entries = (source, map) => (Array.isArray(source) ? source.slice(0, 2048) : []).map(map)
    .filter(item => item.id && item.end > item.start)
  return {
    shots: entries(reel.shots, s => ({ id: bounded(s?.id), start: range(s?.start), end: range(s?.end),
      name: bounded(s?.name), camera: bounded(s?.camera), actor: bounded(s?.actor),
      transition: ['cut', 'black', 'white'].includes(s?.transition) ? s.transition : 'cut' })),
    layers: entries(reel.layers, l => ({ id: bounded(l?.id), start: range(l?.start), end: range(l?.end),
      kind: bounded(l?.kind), name: bounded(l?.name) })),
  }
}
export function filmMakerSource(film, kind, sourceId, reel = null) {
  if (!['pass', 'montage'].includes(kind) || !film?.id || !sourceId || !film.scene?.id) throw new Error('Origen de película inválido')
  return { provider: FILMMAKER_SOURCE, filmId: String(film.id), filmName: String(film.name || ''),
    sceneId: String(film.scene.id), kind, sourceId: String(sourceId), ...(reel ? { reel: filmReel(reel) } : {}) }
}
function normalizedFilmMakerSource(source) {
  if (!source || source.provider !== FILMMAKER_SOURCE || !['pass', 'montage'].includes(source.kind) ||
    ![source.filmId, source.sceneId, source.sourceId].every(v => typeof v === 'string' && v.trim())) return null
  return { provider: FILMMAKER_SOURCE, filmId: source.filmId, filmName: String(source.filmName || ''),
    sceneId: source.sceneId, kind: source.kind, sourceId: source.sourceId,
    ...(source.nativeResourceId ? { nativeResourceId: String(source.nativeResourceId) } : {}),
    ...(source.reel ? { reel: filmReel(source.reel) } : {}) }
}
export const isFilmMakerTimeline = (tl) => !!normalizedFilmMakerSource(tl?.filmMaker)

// Diagnóstico conservador: las referencias por nombre/ID declaradas en comandos y eventos.
// No intenta interpretar JavaScript de scripts ni resuelve referencias construidas en ejecución.
export const TIMELINE_REF_FIELDS = new Set(['timeline', 'timelineId', 'cinematic', 'cinematicId'])
export function timelineReferences(data, resource, origin = 'Proyecto', { nameOnly = false } = {}) {
  if (!resource?.id) return []
  const used = new WeakSet(), refs = []
  const visit = (value, path) => {
    if (!value || typeof value !== 'object' || used.has(value)) return
    used.add(value)
    if (Array.isArray(value)) { value.forEach((entry, i) => visit(entry, `${path}[${i}]`)); return }
    for (const [key, entry] of Object.entries(value)) {
      if (TIMELINE_REF_FIELDS.has(key) && typeof entry === 'string' && ((!nameOnly && entry === resource.id) || entry === resource.name)) refs.push(`${path}.${key}`)
      else if (entry && typeof entry === 'object') visit(entry, `${path}.${key}`)
    }
  }
  visit(data, origin)
  return refs
}

export const TRACK_KINDS = {
  camera: { label: 'Cámara', color: '#e3b341', icon: '🎥' },
  node: { label: 'Nodo', color: '#4aa3ff', icon: '◈' },
  bake: { label: 'Física horneada', color: '#70b7ba', icon: '◈' },
  audio: { label: 'Audio', color: '#6cc18a', icon: '♪' },
  commands: { label: 'Comandos', color: '#c586c0', icon: '⚡' },
  method: { label: 'Métodos de nodo', color: '#bc98e5', icon: 'ƒ' },
}
export const NODE_PROPS = [['position', 'Posición'], ['rotation', 'Rotación (°)'], ['scale', 'Escala'], ['visible', 'Visible']]
// Los tipos pertenecen al catálogo original de Animation Clips.
// El catálogo declara únicamente canales con evaluador y aplicador temporal verificados.
export const timelinePropertySpec = prop => Object.hasOwn(PROPS, prop) ? PROPS[prop] : null
export const timelinePropertyPlayable = prop => PROPS[prop]?.timelineRuntime === true

/** Pista canónica: un canal por escena, nodo y propiedad. No muta pistas existentes. */
export function findTimelineNodePropertyTrack(timeline, node, prop, sceneId, objects = []) {
  if (!node?.id || !timelinePropertySpec(prop)) return null
  const sameName = objects.filter(item => item.name === node.name).length === 1
  return (timeline?.tracks || []).find(tr => tr.kind === 'node' && tr.prop === prop && (
    (tr.byId === true && tr.node === node.id && (!tr.sceneId || tr.sceneId === sceneId)) ||
    (tr.byId !== true && (!tr.sceneId || tr.sceneId === sceneId) &&
      (tr.node === node.id || (sameName && tr.node === node.name)))
  )) || null
}

export function ensureTimelineNodePropertyTrack(timeline, node, prop, sceneId, objects = []) {
  if (!timeline || !Array.isArray(timeline.tracks) || isFilmMakerTimeline(timeline) ||
    typeof node?.id !== 'string' || !node.id || typeof sceneId !== 'string' || !sceneId)
    throw new Error('Timeline: referencia de nodo y escena obligatoria')
  const spec = timelinePropertySpec(prop)
  if (!spec) throw new Error(`Timeline: propiedad no declarada: ${prop}`)
  if (!Array.isArray(objects) || !objects.some(item => item?.id === node.id))
    throw new Error('Timeline: el nodo no existe en la escena activa')
  if (prop.startsWith('light.') && node.type !== 'light') throw new Error(`Timeline: ${prop} requiere un nodo Light`)
  if (!nodeAnimationProperty(node, prop)) throw new Error(`Timeline: ${prop} no es animable en ${node.type}`)
  const existing = findTimelineNodePropertyTrack(timeline, node, prop, sceneId, objects)
  if (existing) return { track: existing, created: false }
  const related = timeline.tracks.filter(track => timelineTrackNodeOwner(track, objects, sceneId)?.nodeId === node.id)
  const scopes = new Set(related.map(track => track.groupId || ''))
  if (scopes.size > 1) throw new Error('El nodo tiene pistas en grupos distintos; organiza sus pistas antes de añadir otra')
  const track = newTrack('node', { name: `${node.name} · ${spec.label}`, node: node.id,
    byId: true, sceneId, prop, ...(related[0]?.groupId ? {groupId:related[0].groupId} : {}) })
  timeline.tracks.push(track)
  return { track, created: true }
}

/** Crea una clave tipada para los canales preparados; no evalúa ni modifica nodos. */
export function newTimelinePropertyKey(prop, t, value) {
  if (!Number.isFinite(t) || t < 0) throw new Error('Timeline: tiempo de clave inválido')
  return newKey('node', t, { v: validatePropertyValue(prop, value) })
}

/** Lee el valor autoral de un canal que el Timeline puede aplicar. */
export function readTimelineNodeProperty(node, prop) {
  const spec = nodeAnimationProperty(node, prop)
  if (!spec) throw new Error('La propiedad no tiene un aplicador animable válido')
  const value = spec.read ? spec.read(node)
    : prop === 'active' ? node.active !== false : prop === 'light.energy' ? node.light?.energy : prop === 'light.color' ? node.color : node[prop]
  return validatePropertyValue(prop, value)
}

/** Inserción explícita; no modifica el nodo ni crea claves automáticamente. */
export function upsertTimelineNodePropertyKey(timeline, node, prop, sceneId, objects, time, value) {
  if (!Number.isFinite(time) || time < 0 || time > timeline?.duration)
    throw new Error('Timeline: clave fuera de la duración del recurso')
  if (!timelinePropertyPlayable(prop)) throw new Error(`Timeline: ${prop} no tiene evaluador habilitado`)
  const candidate = newTimelinePropertyKey(prop, time, value)
  const existing = findTimelineNodePropertyTrack(timeline, node, prop, sceneId, objects)
  if (existing && !timelineTrackEditable(existing)) throw new Error('Timeline: pista bloqueada')
  const { track, created } = ensureTimelineNodePropertyTrack(timeline, node, prop, sceneId, objects)
  const key = track.keys.find(entry => Math.abs(entry.t - time) <= 0.000001)
  if (key) {
    if (JSON.stringify(key.v) === JSON.stringify(candidate.v)) return { track, key, created, changed: false }
    key.v = candidate.v
    return { track, key, created, changed: true, updated: true }
  }
  track.keys.push(candidate)
  sortKeys(track)
  return { track, key: candidate, created, changed: true, updated: false }
}

// Solo etiquetas del Inspector Timeline: IDs y cálculo de curvas siguen siendo los mismos.
// El catálogo común de animación/FilmMaker mantiene su presentación original.
const TIMELINE_EASE_LABELS = {
  inOut: 'Ease In Out', linear: 'Linear', in: 'Ease In', out: 'Ease Out',
  bezier: 'Bezier', back: 'Back', bounce: 'Bounce', elastic: 'Elastic', cut: 'Cut',
}
export const EASES = ANIM_EASES.map(([id, label]) => [id, TIMELINE_EASE_LABELS[id] || label])
// Interpolación explícita por pista; la ausencia de campo conserva el suavizado heredado de cada clave.
export const INTERPOLATIONS = [['nearest', 'Nearest'], ['linear', 'Linear'], ['cubic', 'Cubic'], ['linear-angle', 'Linear Angle'], ['cubic-angle', 'Cubic Angle']]
const VALID_INTERPOLATIONS = new Set(INTERPOLATIONS.map(([id]) => id))
export const TIMELINE_EDIT_MODES = [['mix', 'Mix'], ['ripple', 'Ripple'], ['replace', 'Replace']]
const CLIP_KINDS = new Set(['node', 'camera'])
export const CAM_MODES = [['free', 'Posición libre'], ['camera3d', 'Camera3D vinculada'], ['node', 'Cámara de la escena (heredada)'], ['player', 'Vista del jugador']]

const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d)
const vec = (v, d) => (Array.isArray(v) && v.length === 3 ? v.map((x) => num(x)) : [...d])
const ease = (e) => (ANIM_EASES.some((x) => x[0] === e) ? e : 'inOut')
const bezierPoints = (input) => {
  const b = Array.isArray(input) && input.length === 4 ? input.map((x, i) => num(x, i === 0 ? 0.42 : i === 2 ? 0.58 : i === 3 ? 1 : 0)) : [0.42, 0, 0.58, 1]
  return [Math.min(1, Math.max(0, b[0])), b[1], Math.min(1, Math.max(0, b[2])), b[3]]
}

export function newKey(kind, t = 0, extra = {}) {
  const base = { id: uid('k'), t: Math.max(0, num(t)) }
  if (kind === 'camera') return { ...base, mode: 'free', pos: [0, 2, 5], rot: [0, 0, 0], fov: 70, node: '', ease: 'inOut', ...extra }
  if (kind === 'node') return { ...base, v: [0, 0, 0], ease: 'inOut', ...extra }
  if (kind === 'method') return { ...base, method: '', args: [], ...extra }
  if (kind === 'audio') return { ...base, action: 'play', clip: '', group: 'sfx', volume: 1, pitch: 1, loop: false, fade: 0, offset: 0, fadeIn: 0, duration: 0, fadeOut: 0, ...extra }
  return { ...base, name: '', list: [], block: false, essential: false, ...extra }
}
export function newTrack(kind, extra = {}) {
  return { id: uid('tr'), kind, name: extra.name || TRACK_KINDS[kind].label, muted: false, locked:false, ...(kind === 'node' ? { node: '', prop: 'position' } : {}), ...(kind === 'method' ? { node: '', byId: true } : {}), ...(kind === 'camera' ? { path: 'smooth' } : {}), keys: [], ...extra }
}
// Política explícita solo para recursos creados a partir de G006. Normalize no la añade a los ya guardados.
export const NEW_TIMELINE_CAMERA_EXIT = Object.freeze({ natural: { to: 'keep' }, stop: { to: 'keep' }, skip: { to: 'keep' }, interrupted: { to: 'keep' } })
const CAMERA_EXIT_TO = new Set(['keep', 'camera3d', 'previous', 'player', 'pose', 'base'])
export function normalizeTimelineCameraExit(policies) {
  if (!policies || typeof policies !== 'object' || Array.isArray(policies)) throw new Error('Timeline: política de salida de cámara inválida')
  const result = {}
  for (const reason of ['natural', 'stop', 'skip', 'interrupted']) {
    const policy = policies[reason] ?? NEW_TIMELINE_CAMERA_EXIT[reason]
    if (!policy || typeof policy !== 'object' || !CAMERA_EXIT_TO.has(policy.to)) throw new Error(`Timeline: salida de cámara inválida (${reason})`)
    const cameraId = policy.to === 'camera3d' ? String(policy.cameraId || '') : ''
    const sceneId = policy.to === 'camera3d' ? String(policy.sceneId || '') : ''
    if (policy.to === 'camera3d' && (!cameraId || !sceneId)) throw new Error('Timeline: la política Camera3D necesita ID y escena')
    result[reason] = policy.to === 'camera3d' ? { to: policy.to, sceneId, cameraId } : { to: policy.to }
  }
  return result
}

export const TIMELINE_FPS_DEFAULT = 30
export const TIMELINE_FPS_MIN = 1
export const TIMELINE_FPS_MAX = 240
export function timelineFps(value) {
  if (!Number.isInteger(value) || value < TIMELINE_FPS_MIN || value > TIMELINE_FPS_MAX)
    throw new RangeError('Timeline: FPS debe ser un entero entre 1 y 240')
  return value
}
export function timelineFrameTime(frame, fps) {
  timelineFps(fps)
  if (!Number.isInteger(frame) || frame < 0) throw new RangeError('Timeline: fotograma inválido')
  return +((frame / fps).toFixed(8))
}
export function timelineSnapFrame(time, fps) {
  if (!Number.isFinite(time)) throw new RangeError('Timeline: tiempo no finito')
  return timelineFrameTime(Math.max(0, Math.round(time * timelineFps(fps))), fps)
}

export function newTimeline(name = 'Cinemática', extra = {}) {
  return { id: uid('tl'), name, duration: 10, fps: TIMELINE_FPS_DEFAULT, loop: false, lockPlayer: true, skippable: true, letterbox: 0, tracks: [], groups: [], markers: [], cameraExit: normalizeTimelineCameraExit(NEW_TIMELINE_CAMERA_EXIT), ...extra }
}

export function addTimelineCameraBinding(timeline, camera, time, { sceneId, trackId = null } = {}) {
  if (!timeline || isFilmMakerTimeline(timeline) || camera?.type !== 'camera' || !camera.id || !sceneId ||
      !Number.isFinite(time) || time < 0 || time > timeline.duration) throw new Error('Vínculo de Camera3D inválido')
  const matches = key => key.mode === 'camera3d' && key.node === camera.id && key.sceneId === sceneId
  const track = trackId ? timeline.tracks.find(track => track.id === trackId)
    : timeline.tracks.find(track => track.kind === 'camera' && !track.clips?.length && track.keys.some(matches))
  if (trackId && track?.kind !== 'camera') throw new Error('Selecciona una pista de Cámara')
  if (track && !timelineTrackEditable(track)) throw new Error('Desbloquea la pista de Cámara para vincular el nodo')
  if (track?.clips?.length) throw new Error('La pista usa clips. Vincula una clave fuente en el Inspector o suelta la cámara fuera de esta pista')
  const t = roundedTime(time)
  const existing = track?.keys.find(key => Math.abs(key.t - t) < 1e-5)
  if (existing && matches(existing)) return { track, key: existing, changed: false }
  if (existing) throw new Error('Ya hay una clave en este tiempo. Cambia su cámara desde el Inspector')
  const related = timeline.tracks.filter(other => timelineTrackNodeOwner(other, [camera], sceneId)?.nodeId === camera.id)
  const scopes = new Set(related.map(other => other.groupId || ''))
  if (!track && scopes.size > 1) throw new Error('La cámara tiene pistas en grupos distintos; organiza sus pistas antes de añadir la toma')
  const target = track || newTrack('camera', { name: camera.name,
    ...(related[0]?.groupId ? {groupId:related[0].groupId} : {}) })
  const key = newKey('camera', t, { mode: 'camera3d', node: camera.id, sceneId, ease: 'cut' })
  target.keys.push(key)
  sortKeys(target)
  if (!track) timeline.tracks.push(target)
  return { track: target, key, changed: true }
}

export function normalizeKey(kind, k, prop) {
  const b = newKey(kind, k?.t)
  const o = { ...b, id: k?.id || b.id, t: Math.max(0, num(k?.t)) }
  if (kind === 'camera') {
    Object.assign(o, { mode: CAM_MODES.some(([mode]) => mode === k?.mode) ? k.mode : 'free', pos: vec(k?.pos, b.pos), rot: vec(k?.rot, b.rot), fov: Math.min(170, Math.max(5, num(k?.fov, 70))), node: String(k?.node || ''), ease: ease(k?.ease), ...(k?.ease === 'bezier' ? { bz: bezierPoints(k?.bz) } : {}) })
    if (o.mode === 'camera3d') o.sceneId = String(k?.sceneId || '')
  }
  else if (kind === 'node') {
    const value = ['position', 'rotation', 'scale', 'visible'].includes(prop)
      ? (prop === 'visible' ? !!k?.v : vec(k?.v, prop === 'scale' ? [1, 1, 1] : [0, 0, 0]))
      : validatePropertyValue(prop, k?.v)
    Object.assign(o, { v: value, ease: ease(k?.ease), ...(k?.ease === 'bezier' ? { bz: bezierPoints(k?.bz) } : {}) })
    // Pendientes manuales opcionales por eje; null mantiene el cálculo Hermite original.
    if (['position', 'rotation', 'scale'].includes(prop)) for (const field of ['tanIn', 'tanOut']) {
      const slopes = k?.[field]
      if (Array.isArray(slopes) && slopes.length === 3 && slopes.some(v => Number.isFinite(v))) {
        o[field] = slopes.map(v => Number.isFinite(v) ? Math.max(-1e6, Math.min(1e6, v)) : null)
      }
    }
  }
  else if (kind === 'method') Object.assign(o, { method: typeof k?.method === 'string' ? k.method.trim() : '', args: Array.isArray(k?.args) ? JSON.parse(JSON.stringify(k.args)) : [] })
  else if (kind === 'audio') {
    Object.assign(o, { action: k?.action === 'stop' ? 'stop' : 'play', clip: String(k?.clip || ''), group: String(k?.group || 'sfx'), volume: num(k?.volume, 1), pitch: num(k?.pitch, 1), loop: !!k?.loop, fade: Math.max(0, num(k?.fade)), offset: Math.max(0, num(k?.offset)), fadeIn: Math.max(0, num(k?.fadeIn)), duration: Math.max(0, num(k?.duration)), fadeOut: Math.max(0, num(k?.fadeOut)) })
    // Los recursos antiguos no adquieren una propiedad FX hasta que el usuario la edite.
    if (Array.isArray(k?.fx)) o.fx = k.fx.map(normalizeFx).filter(Boolean)
    if (o.action === 'play' && Array.isArray(k?.volumeAutomation) && o.duration > 0) {
      const points = normalizeVolumeAutomation(k.volumeAutomation, o.duration)
      if (points.length) o.volumeAutomation = points
    }
  }
  else Object.assign(o, { name: String(k?.name || ''), list: Array.isArray(k?.list) ? k.list : [], block: !!k?.block, essential: !!k?.essential })
  return o
}
export function normalizeTrack(tr) {
  const kind = TRACK_KINDS[tr?.kind] ? tr.kind : 'commands'
  const o = { ...newTrack(kind), id: tr?.id || uid('tr'), name: String(tr?.name || TRACK_KINDS[kind].label), muted: !!tr?.muted, locked:!!tr?.locked }
  if (tr?.groupId != null) o.groupId=String(tr.groupId)
  if (Number.isInteger(tr?.displayOrder) && tr.displayOrder>=0 && tr.displayOrder<=4096) o.displayOrder=tr.displayOrder
  if (kind === 'node') {
    o.node = String(tr?.node || ''); o.byId = tr?.byId === true
    // Los canales tipados deben identificar un nodo real por ID y escena.
    // Una pista antigua sin sceneId conserva exactamente su identidad anterior.
    if (tr?.sceneId !== undefined) {
      if (!o.byId || !o.node || typeof tr.sceneId !== 'string' || !tr.sceneId.trim() || tr.sceneId !== tr.sceneId.trim())
        throw new Error('Timeline: referencia de escena inválida en pista de nodo')
      o.sceneId = tr.sceneId
    }
    const propertyId = tr?.prop === undefined ? 'position' : tr.prop
    if (!timelinePropertySpec(propertyId)) throw new Error(`Timeline: propiedad de nodo desconocida: ${propertyId}`)
    o.prop = propertyId
    if (!['position', 'rotation', 'scale', 'visible'].includes(o.prop) && (!o.byId || !o.node || !o.sceneId))
      throw new Error(`Timeline: ${o.prop} necesita ID de nodo y escena`)
    // Nunca interpretar un modo inválido como otro: descartar para mantener el modo por clave.
    if (['position', 'rotation', 'scale'].includes(o.prop) && VALID_INTERPOLATIONS.has(tr?.interpolation) &&
      (o.prop === 'rotation' || !tr.interpolation.endsWith('-angle'))) o.interpolation = tr.interpolation
  }
  if (kind === 'method') { o.node = String(tr?.node || ''); o.byId = true } // Nunca resolver métodos por nombre.
  if (kind === 'bake') Object.assign(o, normalizeBakeTrack(tr))
  if (kind === 'camera') o.path = tr?.path === 'linear' ? 'linear' : 'smooth'
  if (kind === 'node' && !['position', 'rotation', 'scale', 'visible'].includes(o.prop)) {
    const seen = new Set()
    for (const key of Array.isArray(tr?.keys) ? tr.keys : []) {
      if (!Number.isFinite(key?.t) || key.t < 0 ||
          (key?.id !== undefined && (typeof key.id !== 'string' || !key.id || seen.has(key.id))))
        throw new Error(`Timeline: tiempo o ID inválido en ${o.prop}`)
      if (key.id) seen.add(key.id)
    }
  }
  o.keys = kind === 'bake' ? [] : (Array.isArray(tr?.keys) ? tr.keys : []).map((k) => normalizeKey(kind, k, o.prop)).sort((a, b) => a.t - b.t)
  // Solo nodos con valores numéricos y cámaras admiten fuente continua y mezcla.
  // Los clips referencian las claves originales por ID; no clonan ni reescriben sus curvas.
  if (kind === 'node' && !['position', 'rotation', 'scale', 'visible'].includes(o.prop) && tr?.clips?.length)
    throw new Error(`Timeline: clips de ${o.prop} requieren evaluador temporal`)
  if (CLIP_KINDS.has(kind) && (kind !== 'node' || (['position', 'rotation', 'scale'].includes(o.prop)))) {
    const ids = new Set(o.keys.map(k => k.id))
    if (tr?.clips !== undefined && !Array.isArray(tr.clips)) throw new Error(`Timeline: los clips de «${o.name}» deben ser una lista`)
    const candidates = Array.isArray(tr?.clips) ? tr.clips : []
    const unique = new Set(), invalid = []
    o.clips = candidates.slice(0, 2048).filter(c => {
      if (!c || typeof c !== 'object' || typeof c.id !== 'string' || !c.id || unique.has(c.id)) {invalid.push('ID');return false}
      if (!ids.has(c.from) || !ids.has(c.to) || c.from === c.to) {invalid.push('referencia');return false}
      if (!Number.isFinite(c.start) || !Number.isFinite(c.duration) || c.start < 0 || c.duration < .05 || c.start + c.duration > 86400) {invalid.push('intervalo');return false}
      if (!Number.isFinite(c.in) || !Number.isFinite(c.out) || c.in < 0 || c.out > 1 || c.out - c.in < 0.0001) {invalid.push('fuente');return false}
      const a = o.keys.find(k => k.id === c.from), b = o.keys.find(k => k.id === c.to)
      if (!a || !b || b.t - a.t < .05) {invalid.push('claves');return false}
      unique.add(c.id); return true
    }).map(c => ({ id:c.id, from:c.from, to:c.to, start:roundedTime(c.start), duration:roundedTime(c.duration), in:c.in, out:c.out }))
    if (invalid.length) throw new Error(`Timeline: clips inválidos en «${o.name}» (${[...new Set(invalid)].join(', ')})`)
    if (timelineClipOverlapCount(o.clips) > 2) throw new Error(`Timeline: la pista «${o.name}» tiene más de dos clips mezclados a la vez`)
  }
  return o
}
export function normalizeTimeline(tl) {
  const o = newTimeline(String(tl?.name || 'Cinemática'), { id: tl?.id || uid('tl') })
  if (typeof tl?.folder === 'string' && /^Assets(?:\/[^\\/:*?"<>|\u0000-\u001f]+)*$/.test(tl.folder) && !tl.folder.split('/').some(p => p === '.' || p === '..')) o.folder = tl.folder
  o.duration = Math.max(0.1, num(tl?.duration, 10))
  o.fps = tl?.fps === undefined ? TIMELINE_FPS_DEFAULT : timelineFps(tl.fps)
  o.loop = !!tl?.loop; o.lockPlayer = tl?.lockPlayer !== false; o.skippable = tl?.skippable !== false
  o.letterbox = Math.min(25, Math.max(0, num(tl?.letterbox)))
  if (tl && Object.hasOwn(tl, 'cameraExit')) o.cameraExit = normalizeTimelineCameraExit(tl.cameraExit)
  else delete o.cameraExit // Un Timeline anterior conserva salida histórica; sin migración silenciosa.
  const filmMaker = normalizedFilmMakerSource(tl?.filmMaker)
  if (filmMaker) o.filmMaker = filmMaker
  // Los formatos antiguos no incluyen organización y se abren sin migración destructiva.
  const groups=Array.isArray(tl?.groups)?tl.groups:[]
  if(groups.length>64)throw new Error('Timeline: límite de grupos excedido')
  const groupIds=new Set()
  o.groups=groups.map(group=>{
    if(!group || typeof group.id!=='string' || !group.id || groupIds.has(group.id))throw new Error('Timeline: grupo sin ID o duplicado')
    groupIds.add(group.id)
    return {id:group.id,name:String(group.name||'Grupo').slice(0,80),collapsed:!!group.collapsed}
  })
  o.tracks = (Array.isArray(tl?.tracks) ? tl.tracks : []).map(normalizeTrack)
  if(o.tracks.some(track=>track.groupId && !groupIds.has(track.groupId))) throw new Error('Timeline: referencia de grupo inexistente')
  const seenTracks=new Set()
  for(const track of o.tracks){if(seenTracks.has(track.id))throw new Error('Timeline: ID de pista duplicado');seenTracks.add(track.id)}
  const channels = new Set()
  for (const track of o.tracks) {
    if (track.kind !== 'node' || !track.sceneId) continue
    const identity = JSON.stringify([track.sceneId, track.node, track.prop])
    if (channels.has(identity)) throw new Error(`Timeline: pista duplicada para ${track.prop} (${track.node})`)
    channels.add(identity)
  }
  const markers=Array.isArray(tl?.markers)?tl.markers:[]
  if(markers.length>512)throw new Error('Timeline: límite de marcadores excedido')
  const markerIds=new Set()
  o.markers=markers.map(marker=>{
    if(!marker || typeof marker.id!=='string' || !marker.id || markerIds.has(marker.id) || !Number.isFinite(marker.t) || marker.t<0 || marker.t>o.duration)
      throw new Error('Timeline: marcador inválido, duplicado o fuera del recurso')
    markerIds.add(marker.id)
    return {id:marker.id,t:roundedMarkerTime(marker.t),name:String(marker.name||'Marcador').slice(0,80)}
  }).sort((a,b)=>a.t-b.t)
  for(const track of o.tracks) for(const clip of track.clips || []) if(clip.start+clip.duration>o.duration+1e-7)
    throw new Error(`Timeline: el clip de «${track.name}» excede la duración del recurso`)
  const baked = o.tracks.filter(t => t.kind === 'bake')
  if (baked.length > 16 || new Set(baked.map(t => t.node)).size !== baked.length) throw new Error('Timeline físico: más de 16 cuerpos o nodeId duplicado')
  return o
}
export const normalizeTimelines = (l) => (Array.isArray(l) ? l.map(normalizeTimeline) : [])

/** Cinemática de ejemplo para «Nueva timeline»: cámara que avanza y gira, una luz/puerta y un mensaje. */
export function sampleTimeline(name = 'Cinemática') {
  const tl = newTimeline(name, { duration: 8 })
  const cam = newTrack('camera', { name: 'Cámara' })
  cam.keys = [
    newKey('camera', 0, { mode: 'player', ease: 'inOut' }),
    newKey('camera', 1.5, { pos: [0, 2, 8], rot: [-5, 0, 0], fov: 60, ease: 'inOut' }),
    newKey('camera', 5, { pos: [4, 2, 2], rot: [-8, 40, 0], fov: 55, ease: 'cut' }),
    newKey('camera', 5.01, { pos: [-3, 1.6, 2], rot: [0, -50, 0], fov: 70, ease: 'inOut' }),
    newKey('camera', 8, { mode: 'player' }),
  ]
  const cmd = newTrack('commands', { name: 'Comandos' })
  cmd.keys = [newKey('commands', 2, { name: 'Mensaje', block: true, list: [{ id: uid('c'), code: 'text', p: { speaker: '', text: 'Algo se mueve en la oscuridad…', pos: 'bottom' }, b: {} }] })]
  tl.tracks = [cam, cmd]
  return tl
}

/** Parámetros del inspector de una clave (los dibuja ParamForm). */
export function keyParams(track) {
  const t = { key: 't', label: 'Tiempo (s)', type: 'number', def: 0, min: 0, step: 0.05 }
  const easeP = (when) => ({ key: 'ease', label: 'Hasta la siguiente', type: 'select', def: 'inOut', options: EASES, when })
  if (track.kind === 'camera') return [t,
    { key: 'mode', label: 'Cámara', type: 'select', def: 'free', options: CAM_MODES },
    { key: 'node', label: 'Nodo cámara', type: 'cameranode', def: '', when: { mode: 'node' } },
    { key: 'node', label: 'Camera3D', type: 'cameraid', def: '', when: { mode: 'camera3d' } },
    { key: 'pos', label: 'Posición', type: 'vec3', def: [0, 2, 5], when: { mode: 'free' } },
    { key: 'rot', label: 'Rotación (inclin., giro, alabeo °)', type: 'vec3', def: [0, 0, 0], when: { mode: 'free' } },
    { key: 'fov', label: 'Campo de visión', type: 'number', def: 70, min: 5, max: 170, step: 1, when: { mode: 'free' } },
    easeP()]
  if (track.kind === 'node') return [t,
    { key: 'v', label: timelinePropertySpec(track.prop)?.label || 'Valor',
      type: timelinePropertySpec(track.prop)?.kind === 'color' ? 'color' : timelinePropertySpec(track.prop)?.kind || 'vec3',
      def: timelinePropertySpec(track.prop)?.def ?? [0, 0, 0] },
    ...(track.prop === 'visible' || track.interpolation || !timelinePropertyPlayable(track.prop) ? [] : [easeP()])]
  if (track.kind === 'method') return [t] // El selector de método y los argumentos JSON viven en el Inspector contextual.
  if (track.kind === 'audio') return [t,
    { key: 'action', label: 'Acción', type: 'select', def: 'play', options: [['play', 'Reproducir'], ['stop', 'Detener']] },
    { key: 'clip', label: 'Clip', type: 'audio', def: '', when: { action: 'play' } },
    { key: 'group', label: 'Grupo del mezclador', type: 'audiogroup', def: 'sfx' },
    { key: 'volume', label: 'Volumen', type: 'number', def: 1, min: 0, max: 2, step: 0.05, when: { action: 'play' } },
    { key: 'pitch', label: 'Tono', type: 'number', def: 1, min: 0.1, max: 4, step: 0.05, when: { action: 'play' } },
    { key: 'loop', label: 'En bucle', type: 'bool', def: false, when: { action: 'play' } },
    { key: 'offset', label: 'Empezar en el segundo', type: 'number', def: 0, min: 0, step: 0.1, when: { action: 'play' } },
    { key: 'fadeIn', label: 'Fundido de entrada (s)', type: 'number', def: 0, min: 0, step: 0.1, when: { action: 'play' } },
    { key: 'duration', label: 'Duración (s, 0 = entero)', type: 'number', def: 0, min: 0, step: 0.1, when: { action: 'play' } },
    { key: 'fadeOut', label: 'Fundido de salida (s)', type: 'number', def: 0, min: 0, step: 0.1, when: { action: 'play' } },
    { key: 'fade', label: 'Fundido (s)', type: 'number', def: 0, min: 0, step: 0.1, when: { action: 'stop' } }]
  return [t,
    { key: 'name', label: 'Nombre', type: 'text', def: '' },
    { key: 'block', label: 'Pausar el timeline hasta que terminen', type: 'bool', def: false, hint: 'Ideal para diálogos u opciones: la cinemática espera.' },
    { key: 'essential', label: 'Imprescindible (se ejecuta aunque se omita)', type: 'bool', def: false, hint: 'Al omitir la cinemática solo se ejecutan las claves marcadas.' }]
}

/** Cambia la duración ya persistida de un evento de Audio «play».
 * 0 mantiene el significado existente: reproducir el archivo completo.
 * Comandos y Métodos no tienen campo duration individual y no se aceptan aquí.
 */
export function resizeTimelineAudioKey(timeline, trackId, keyId, seconds) {
  const track = timeline?.tracks?.find(t => t.id === trackId)
  if (!timelineTrackEditable(track) || track.kind !== 'audio' || !Number.isFinite(seconds) || seconds < 0) return false
  const key = track.keys?.find(k => k.id === keyId)
  if (!key || key.action !== 'play' || !Number.isFinite(key.t) || !Number.isFinite(timeline.duration)) return false
  const upper = Math.min(86400, timeline.duration - key.t)
  if (upper < 0 || seconds > upper + 1e-6) return false
  const next = +Math.max(0, seconds).toFixed(5)
  if (Array.isArray(key.volumeAutomation) && key.volumeAutomation.some(point => point.t > next + 1e-6)) return false
  if (key.volumeAutomation?.length && next === 0) return false
  if (next === key.duration) return false
  key.duration = next
  return true
}

/** Recorte no destructivo de un clip Audio: ambos extremos usan el mismo offset y
 * duración ya persistidos. Los tiempos de los puntos siguen anclados al Timeline.
 * `seconds` es la nueva coordenada ABSOLUTA del borde izquierdo o la duración
 * relativa del derecho. Sin PCM conocido nunca se inventa una duración de fuente.
 */
export function trimTimelineAudioKey(timeline, trackId, keyId, edge, seconds, sourceSeconds) {
  if (!['left', 'right'].includes(edge) || !Number.isFinite(seconds) ||
      !Number.isFinite(sourceSeconds) || sourceSeconds <= 0 || !Number.isFinite(timeline?.duration)) return false
  const track = timeline.tracks?.find(track => track.id === trackId)
  if (!timelineTrackEditable(track) || track.kind !== 'audio') return false
  const key = track.keys?.find(key => key.id === keyId)
  if (!key || key.action !== 'play' || !Number.isFinite(key.t) || key.t < 0) return false
  const rate = normalizeSource({ pitch: key.pitch }).pitch
  const offset = Math.max(0, Number(key.offset) || 0)
  const availableSource = Math.max(0, (sourceSeconds - offset) / rate)
  const maxTimeline = Math.max(0, timeline.duration - key.t)
  const current = key.duration > 0 ? key.duration : Math.min(maxTimeline, key.loop ? maxTimeline : availableSource)
  if (!(current >= 0.05) || !Number.isFinite(current)) return false
  const minimum = 0.05
  if (edge === 'right') {
    const next = +seconds.toFixed(5)
    if (next < minimum || next > maxTimeline + 1e-6 ||
        (!key.loop && next > availableSource + 1e-6) ||
        next + 1e-6 < (Number(key.fadeIn) || 0) + (Number(key.fadeOut) || 0)) return false
    // Duración cero conserva el significado de fuente completa hasta recortar.
    if (key.duration === 0 && Math.abs(next - current) < 1e-5) return false
    return resizeTimelineAudioKey(timeline, trackId, keyId, next)
  }
  const nextStart = +seconds.toFixed(5)
  const delta = +(nextStart - key.t).toFixed(5)
  const nextDuration = +(current - delta).toFixed(5)
  const nextOffset = +(offset + delta * rate).toFixed(5)
  if (!delta || nextStart < 0 || nextStart >= timeline.duration ||
      nextDuration < minimum || nextStart + nextDuration > timeline.duration + 1e-6 ||
      nextOffset < -1e-6 || nextOffset >= sourceSeconds ||
      (!key.loop && nextOffset + nextDuration * rate > sourceSeconds + 1e-5) ||
      nextDuration + 1e-6 < (Number(key.fadeIn) || 0) + (Number(key.fadeOut) || 0)) return false
  const oldPoints = Array.isArray(key.volumeAutomation) ? key.volumeAutomation : []
  if (oldPoints.some(point => !Number.isFinite(point.t) || point.t < delta - 1e-6)) return false
  const points = oldPoints.map(point => ({ ...point, t: +(point.t - delta).toFixed(5) }))
  if (points.some(point => point.t < 0 || point.t > nextDuration + 1e-6)) return false
  // No escribir parcialmente si una de las validaciones anteriores falla.
  key.t = nextStart
  key.duration = nextDuration
  key.offset = Math.max(0, nextOffset)
  if (oldPoints.length) key.volumeAutomation = points
  sortKeys(track)
  return true
}

/** Editar un fundido del Audio existente sin cambiar la fuente ni su duración.
 *  duration=0 admite fadeIn solo si el Editor conoce el tramo PCM visible.
 *  fadeOut necesita un final persistente: no se inventa para archivos completos.
 */
export function resizeTimelineAudioFade(timeline, trackId, keyId, field, seconds, visibleSeconds = 0) {
  if (field !== 'fadeIn' && field !== 'fadeOut') return false
  const track = timeline?.tracks?.find(t => t.id === trackId)
  if (!timelineTrackEditable(track) || track.kind !== 'audio' || !Number.isFinite(seconds) || seconds < 0) return false
  const key = track.keys?.find(k => k.id === keyId)
  if (!key || key.action !== 'play' || !Number.isFinite(key.t) || !Number.isFinite(timeline.duration)) return false
  const available = Math.max(0, Math.min(timeline.duration - key.t, key.duration > 0 ? key.duration : visibleSeconds))
  if (!(available > 0) || (field === 'fadeOut' && !(key.duration > 0))) return false
  const other = Math.max(0, Number(key[field === 'fadeIn' ? 'fadeOut' : 'fadeIn']) || 0)
  const limit = Math.max(0, available - (key.duration > 0 ? other : 0))
  if (seconds > limit + 1e-6) return false
  const next = +seconds.toFixed(5)
  if (next === key[field]) return false
  key[field] = next
  return true
}

// Asigna ordinales solo cuando el usuario edita el orden; abrir un proyecto antiguo no lo migra.
function ensureVolumeCreationOrders(points) {
  const used = new Set(points.filter(p => Number.isSafeInteger(p.createdOrder) && p.createdOrder > 0).map(p => p.createdOrder))
  let next = 1
  return points.map(point => {
    if (Number.isSafeInteger(point.createdOrder) && point.createdOrder > 0) return point
    while (used.has(next)) next++
    used.add(next)
    return { ...point, createdOrder: next++ }
  })
}

/** Edita puntos de volumen sobre la misma clave Audio, sin pistas ni relojes nuevos. */
export function editTimelineAudioVolumePoint(timeline, trackId, keyId, action, data = {}) {
  const track = timeline?.tracks?.find(track => track.id === trackId)
  if (!timelineTrackEditable(track) || track.kind !== 'audio') return false
  const key = track.keys?.find(key => key.id === keyId)
  if (!key || key.action !== 'play' || !(key.duration > 0) || key.t + key.duration > timeline.duration + 1e-6) return false
  const list = Array.isArray(key.volumeAutomation) ? key.volumeAutomation : []
  if (action === 'rename') {
    const index = list.findIndex(point => point.id === data.id)
    const name = normalizeVolumePointName(data.name)
    if (index < 0 || !name || (list[index].name || `Punto-${list[index].createdOrder || index + 1}`) === name) return false
    const used = list.some((point, i) => i !== index &&
      (normalizeVolumePointName(point.name) || `Punto-${point.createdOrder || i + 1}`).toLocaleLowerCase() === name.toLocaleLowerCase())
    if (used) return false
    key.volumeAutomation = list.map(point => point.id === data.id ? { ...point, name } : point)
    return true
  }
  if (action === 'remove') {
    if (!list.some(point => point.id === data.id)) return false
    const next = list.filter(point => point.id !== data.id)
    if (next.length) key.volumeAutomation = next
    else delete key.volumeAutomation
    return true
  }
  if (!['add','move'].includes(action) || !Number.isFinite(data.t) || !Number.isFinite(data.value) ||
      data.t < 0 || data.t > key.duration + 1e-6 || data.value < 0 || data.value > 1) return false
  const t = +Math.min(key.duration, data.t).toFixed(5), value = +data.value.toFixed(4)
  const other = list.filter(point => point.id !== data.id)
  if (other.some(point => Math.abs(point.t - t) < 1e-5)) return false
  if (action === 'add') {
    if (!data.id || typeof data.id !== 'string' || list.length >= MAX_VOLUME_POINTS || list.some(point => point.id === data.id)) return false
    const occupied = new Set(list.map((point, i) =>
      (normalizeVolumePointName(point.name) || `Punto-${point.createdOrder || i + 1}`).toLocaleLowerCase()))
    let index = 1
    while (occupied.has(`punto-${index}`)) index++
    const name = normalizeVolumePointName(data.name) || `Punto-${index}`
    if (occupied.has(name.toLocaleLowerCase())) return false
    const ranked = ensureVolumeCreationOrders(list)
    const createdOrder = Math.max(0, ...ranked.map(point => point.createdOrder)) + 1
    if (!Number.isSafeInteger(createdOrder)) return false
    key.volumeAutomation = [...ranked, { id: data.id, t, value, name, createdOrder }].sort((a,b) => a.t - b.t)
    return true
  }
  const index = list.findIndex(point => point.id === data.id)
  if (index < 0 || list[index].t === t && list[index].value === value) return false
  key.volumeAutomation = ensureVolumeCreationOrders(list)
    .map(point => point.id === data.id ? { ...point, t, value } : point).sort((a,b) => a.t - b.t)
  return true
}

/** El extremo derecho del tramo es la siguiente clave real; no se generan clips paralelos. */
export function retimeTimelineSegment(track, startId, endTime, duration, snap = 0) {
  if (!timelineTrackEditable(track) || !['node', 'camera'].includes(track?.kind) || !Array.isArray(track.keys)) return false
  const ordered = [...track.keys].sort((a, b) => a.t - b.t)
  const index = ordered.findIndex(key => key.id === startId)
  if (index < 0 || index >= ordered.length - 1 || !Number.isFinite(endTime)) return false
  const start = ordered[index], end = ordered[index + 1]
  let next = Math.max(0, Math.min(duration, snap > 0 ? Math.round(endTime / snap) * snap : endTime))
  next = +next.toFixed(5)
  // No cruzar claves ni destruir una duración vecina: el editor debe mostrar un límite real.
  if (next <= start.t || (ordered[index + 2] && next >= ordered[index + 2].t)) return false
  if ((track.clips || []).some(c => (c.from === start.id && c.to === end.id || c.from === end.id || c.to === end.id) && next-start.t < .05)) return false
  if (next === end.t) return false
  end.t = next
  sortKeys(track)
  return true
}

/** Acortar nunca descarta silenciosamente contenido temporal. */
export function timelineMinDuration(timeline) {
  let minimum = 0.5
  for (const track of timeline?.tracks || []) {
    if (track.kind === 'bake') minimum = Math.max(minimum, (Number(track.start) || 0) + (Number(track.duration) || 0))
    else {
      for (const key of track.keys || []) {
        minimum = Math.max(minimum, Number(key.t) || 0)
        // Audio «play» puede tener una parada real tras duration; no recortar bajo ese final.
        if (track.kind === 'audio' && key.action === 'play' && Number.isFinite(key.duration) && key.duration > 0)
          minimum = Math.max(minimum, key.t + key.duration)
      }
      for (const clip of track.clips || []) minimum = Math.max(minimum, clip.start + clip.duration)
    }
  }
  for (const marker of timeline?.markers || []) minimum=Math.max(minimum, Number(marker.t)||0)
  return minimum
}

export const sortKeys = (tr) => tr.keys.sort((a, b) => a.t - b.t)
export const timelineEnd = (tl) => Math.max(tl.duration, ...tl.tracks.flatMap((t) => t.kind === 'bake' ? [t.start + t.duration] : [...t.keys.map(k => k.t), ...(t.clips || []).map(c => c.start + c.duration)]))

/** Geometría consultiva de las pistas existentes; no genera claves, recursos ni otro reloj. */
export function readonlyTimelineLanes(timeline) {
  if (!isFilmMakerTimeline(timeline)) return []
  const total = Math.max(0.1, Number(timeline.duration) || 0.1)
  const segment = (start, end, label, kind = 'clip') => ({
    start: Math.min(total, Math.max(0, Number(start) || 0)),
    end: Math.min(total, Math.max(0, Number(end) || 0)),
    label: String(label || ''), kind,
  })
  const native = (timeline.tracks || []).map(track => {
    const keys = Array.isArray(track.keys) ? [...track.keys].sort((a, b) => a.t - b.t) : []
    const segments = []
    if (track.kind === 'bake') {
      segments.push(segment(track.start, (Number(track.start) || 0) + (Number(track.duration) || 0), track.name))
    } else if (track.kind === 'camera') {
      // Los cortes están representados por el ease de las claves exportadas.
      if (keys.length) {
        let begin = keys[0].t, index = 1
        for (let i = 0; i < keys.length - 1; i++) {
          if (keys[i].ease !== 'cut') continue
          segments.push(segment(begin, keys[i + 1].t, `Plano ${index++}`))
          begin = keys[i + 1].t
        }
        segments.push(segment(begin, total, `Plano ${index}`))
      }
    } else if (track.kind === 'audio') {
      for (const key of keys) segments.push(segment(key.t, key.t + Math.max(0.08, Number(key.duration) || 0.08), key.clip || key.action || track.name))
    } else if (track.kind === 'commands') {
      for (const key of keys) {
        const seconds = Math.max(0.08, ...(key.list || []).map(cmd => Number(cmd?.p?.seconds) || 0))
        segments.push(segment(key.t, key.t + seconds, key.name || track.name, 'event'))
      }
    } else if (track.kind === 'node') {
      for (let i = 0; i < keys.length; i++) segments.push(segment(keys[i].t, keys[i + 1]?.t ?? keys[i].t + .08, track.name))
    } else {
      for (const key of keys) segments.push(segment(key.t, key.t + .08, key.method || track.name, 'event'))
    }
    const group = track.kind === 'camera' ? 'CÁMARAS' : track.kind === 'audio' ? 'AUDIO'
      : track.kind === 'node' ? 'ANIMACIÓN' : track.kind === 'bake' ? 'FÍSICA' : 'EVENTOS'
    return { id: track.id, name: track.name, kind: track.kind, group, muted: !!track.muted,
      segments: segments.filter(s => s.end > s.start),
      keys: keys.map(k => ({ id: k.id, t: Math.max(0, Math.min(total, Number(k.t) || 0)) })) }
  })
  const reel = timeline.filmMaker?.reel
  if (!reel) return native
  const shotSegments = (reel.shots || []).map((shot, i) => segment(shot.start, shot.end,
    `${i + 1}. ${shot.name}${shot.camera ? ' · ' + shot.camera : ''}`, 'shot'))
    .filter(s => s.end > s.start)
  const actorSegments = (reel.shots || []).filter(s => s.actor).map(shot => segment(shot.start, shot.end, shot.actor, 'actor'))
    .filter(s => s.end > s.start)
  const editorial = []
  if (shotSegments.length) editorial.push({ id: 'film-shots', name: 'Planos y cortes', kind: 'shot', group: 'MONTAJE',
    muted: false, segments: shotSegments, keys: [] })
  if (actorSegments.length) editorial.push({ id: 'film-actor', name: 'Tomas de actor', kind: 'actor', group: 'INTERPRETACIÓN',
    muted: false, segments: actorSegments, keys: [] })
  const types = { text: 'Subtítulos', fade: 'Fundidos', letterbox: 'Barras de cine', shake: 'Temblor' }
  for (const [kind, label] of Object.entries(types)) {
    const segments = (reel.layers || []).filter(l => l.kind === kind)
      .map(l => segment(l.start, l.end, l.name, kind)).filter(s => s.end > s.start)
    if (segments.length) editorial.push({ id: `film-layer-${kind}`, name: label, kind, group: 'CAPAS',
      muted: false, segments, keys: [] })
  }
  return [...editorial, ...native]
}

/** Snap de clip a cuadrícula, cabezal, bordes de clips y claves existentes (tolerancia visual). */
export function timelineClipSnapTime(timeline, trackId, clipId, wanted, { snap=0, playhead=null, zoom=70, tolerancePixels=8 } = {}) {
  const track=timeline?.tracks?.find(t=>t.id===trackId), clip=track?.clips?.find(c=>c.id===clipId)
  if (!clip || !Number.isFinite(wanted)) return null
  const cap=Math.max(0,timeline.duration-clip.duration)
  const requested=Math.max(0,Math.min(cap,wanted))
  if (!(Number(snap)>0)) return roundedTime(requested)
  let candidate=Math.max(0,Math.min(cap,Math.round(requested/snap)*snap))
  const tolerance=Math.max(0,tolerancePixels)/Math.max(1,Number(zoom)||1)
  const points=[0,timeline.duration,...(timeline.markers||[]).map(m=>m.t)]
  if (Number.isFinite(playhead)) points.push(playhead)
  for(const item of timeline.tracks||[]) {
    for(const key of item.keys||[]) if (Number.isFinite(key.t)) points.push(key.t)
    for(const part of item.clips||[]) if (part.id!==clipId) points.push(part.start,clipEnd(part))
  }
  let best=Infinity
  for(const point of points) for(const edge of [point,point-clip.duration]) {
    if(edge<-1e-7 || edge>cap+1e-7) continue
    const diff=Math.abs(edge-requested)
    if(diff<=tolerance && diff<best) {best=diff;candidate=edge}
  }
  return roundedTime(Math.max(0,Math.min(cap,candidate)))
}
