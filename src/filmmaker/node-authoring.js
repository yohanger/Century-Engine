// Autoría no destructiva de las pistas del montaje: operaciones puras + historial limitado.
// Los tiempos son absolutos, los nodos se vinculan SOLO por ID. No toca la escena ni Jolt.
import { uid } from '../engine/runtime/util.js'
import { normalizeNodeTracks } from './node-tracks.js'
import { BEZIER_PRESETS } from '../engine/runtime/anim/model.js'

const copy = (v) => JSON.parse(JSON.stringify(v))
const props = ['position', 'rotation', 'scale']
const checkTime = (t) => { if (!Number.isFinite(t) || t < 0) throw new Error('Tiempo de animación inválido'); return Math.round(t * 1e5) / 1e5 }
const checkProp = (p) => { if (!props.includes(p)) throw new Error(`Propiedad no animable: ${p}`); return p }
const findTrack = (edit, nodeId) => (edit.nodeTracks || []).find((t) => t.nodeId === nodeId)
const editCopy = (edit) => ({ ...edit, nodeTracks: copy(edit.nodeTracks || []) })
const clean = (edit) => ({ ...edit, nodeTracks: normalizeNodeTracks(edit.nodeTracks) })
export const nodeTrackOf = findTrack

export function addNodeTrack(edit, nodeId, name = '') {
  if (!nodeId || typeof nodeId !== 'string') throw new Error('Selecciona un nodo válido')
  if (findTrack(edit, nodeId)) return edit
  const next = editCopy(edit)
  next.nodeTracks.push({ id: uid('fn'), nodeId, name, muted: false, properties: [] })
  return clean(next)
}
export function removeNodeTrack(edit, nodeId) {
  if (!findTrack(edit,nodeId)) return edit
  const next = editCopy(edit)
  next.nodeTracks = next.nodeTracks.filter((t) => t.nodeId !== nodeId)
  return clean(next)
}
export function muteNodeTrack(edit, nodeId, muted) {
  const next = editCopy(edit), track = findTrack(next,nodeId)
  if (!track) return edit
  track.muted = !!muted
  return clean(next)
}
export function addProperty(edit, nodeId, prop) {
  checkProp(prop)
  const next = editCopy(edit), track = findTrack(next,nodeId)
  if (!track) throw new Error('Primero añade el nodo al timeline')
  if (track.properties.some((p) => p.prop === prop)) return edit
  track.properties.push({ id:uid('fp'), prop, keys: [] })
  return clean(next)
}
export function upsertNodeKey(edit, nodeId, prop, t, vec, ease='inOut', bz=undefined) {
  checkProp(prop); t=checkTime(t)
  if (!Array.isArray(vec) || vec.length!==3 || !vec.every(Number.isFinite)) throw new Error('Transform inválido')
  let next=editCopy(edit), track=findTrack(next,nodeId)
  if (!track) throw new Error('Primero añade el nodo al timeline')
  let part=track.properties.find((p)=>p.prop===prop)
  if (!part) { part={id:uid('fp'),prop,keys:[]};track.properties.push(part) }
  const prev=part.keys.find(k=>Math.abs(k.t-t)<1e-5)
  if (prev) { prev.v=[...vec];prev.ease=ease;if(ease==='bezier')prev.bz=[...(bz||BEZIER_PRESETS[0][1])];else delete prev.bz }
  else part.keys.push({id:uid('fk'), t, v:[...vec], ease, ...(ease==='bezier'?{bz:[...(bz||BEZIER_PRESETS[0][1])]}:{})})
  return clean(next)
}
export function moveNodeKey(edit, nodeId, prop, keyId, t) {
  checkProp(prop);t=checkTime(t)
  const next=editCopy(edit), part=findTrack(next,nodeId)?.properties.find(p=>p.prop===prop)
  const key=part?.keys.find(k=>k.id===keyId)
  if (!key) return edit
  if (part.keys.some(k=>k.id!==keyId && Math.abs(k.t-t)<1e-5)) throw new Error('Ya existe una clave en ese instante')
  key.t=t
  return clean(next)
}
export function removeNodeKey(edit,nodeId,prop,keyId) {
  checkProp(prop)
  const next=editCopy(edit), part=findTrack(next,nodeId)?.properties.find(p=>p.prop===prop)
  if (!part?.keys.some(k=>k.id===keyId)) return edit
  part.keys=part.keys.filter(k=>k.id!==keyId)
  return clean(next)
}
export function editNodeKey(edit,nodeId,prop,keyId,vec,ease,bz=undefined) {
  checkProp(prop)
  const next=editCopy(edit), key=findTrack(next,nodeId)?.properties.find(p=>p.prop===prop)?.keys.find(k=>k.id===keyId)
  if (!key) return edit
  if (vec!==undefined) { if (!Array.isArray(vec)||vec.length!==3||!vec.every(Number.isFinite)) throw new Error('Transform inválido'); key.v=[...vec] }
  if (ease!==undefined) {key.ease=ease;if(ease==='bezier')key.bz=[...(bz||key.bz||BEZIER_PRESETS[0][1])];else delete key.bz}
  if(bz!==undefined && key.ease==='bezier')key.bz=[...bz]
  return clean(next)
}

/** Una sola entrada Undo por edición confirmada (incluido mouseUp del gizmo). */
export class FilmTrackHistory {
  constructor(limit=80){this.limit=limit;this.undoStack=[];this.redoStack=[]}
  reset(){this.undoStack=[];this.redoStack=[]}
  commit(before,after){
    if (JSON.stringify([before.nodeTracks||[],before.physicsBakes||[]])===JSON.stringify([after.nodeTracks||[],after.physicsBakes||[]])) return false
    this.undoStack.push(copy({nodeTracks:before.nodeTracks||[],physicsBakes:before.physicsBakes||[]}));if(this.undoStack.length>this.limit)this.undoStack.shift()
    this.redoStack=[];return true
  }
  undo(edit){if(!this.undoStack.length)return null;const prev=this.undoStack.pop();this.redoStack.push(copy({nodeTracks:edit.nodeTracks||[],physicsBakes:edit.physicsBakes||[]}));return clean({...edit,...prev})}
  redo(edit){if(!this.redoStack.length)return null;const next=this.redoStack.pop();this.undoStack.push(copy({nodeTracks:edit.nodeTracks||[],physicsBakes:edit.physicsBakes||[]}));return clean({...edit,...next})}
  get canUndo(){return this.undoStack.length>0}
  get canRedo(){return this.redoStack.length>0}
}
