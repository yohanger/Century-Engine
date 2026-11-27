// Edición de curvas sobre las claves originales de Timeline; no evalúa animaciones.
// El muestreo visual usa src/engine/runtime/timeline/eval.js (Editor y Player).
import {newKey,sortKeys} from './model.js'
const rounded = (value) => +value.toFixed(6)
const validScalar = (value) => Number.isFinite(value) && Math.abs(value) <= 1e6

export function timelineCurveChannels(track) {
  if (track?.kind === 'node' && track.prop !== 'visible') return [
    { id:'v0', label:'X', field:'v', axis:0, color:'#e6a176' },
    { id:'v1', label:'Y', field:'v', axis:1, color:'#91c891' },
    { id:'v2', label:'Z', field:'v', axis:2, color:'#79b6ed' },
  ]
  if (track?.kind === 'camera' && (track.keys || []).every(k => k.mode === 'free')) return [
    ...['X','Y','Z'].map((label,axis)=>({id:'p'+axis,label:'Pos '+label,field:'pos',axis,color:['#e6a176','#91c891','#79b6ed'][axis]})),
    ...['X','Y','Z'].map((label,axis)=>({id:'r'+axis,label:'Rot '+label,field:'rot',axis,color:['#edbb67','#b5a1e7','#70cfca'][axis]})),
    {id:'fov',label:'FOV',field:'fov',axis:null,color:'#d8a5c6'},
  ]
  return []
}
export function timelineCurveKeyValue(key, channel) {
  if (!key || !channel) return null
  const value = channel.axis === null ? key[channel.field] : key[channel.field]?.[channel.axis]
  return Number.isFinite(value) ? value : null
}
export function timelineCurveCanRetime(track, key) {
  return !!track && !!key && !(track.clips || []).some(c=>c.from===key.id || c.to===key.id)
}
/** Cambios atomizados: validación previa; el caller hace un único commit al soltar. */
export function editTimelineCurveKey(track, keyId, channelId, { time, value } = {}, duration = Infinity) {
  if (!track || track.kind === 'bake' || track.locked) return false
  const channel = timelineCurveChannels(track).find(c=>c.id===channelId)
  const keys = track.keys || [], key = keys.find(k=>k.id===keyId)
  if (!channel || !key || !Number.isFinite(duration) && duration !== Infinity) return false
  const index=keys.indexOf(key), before=keys[index-1], after=keys[index+1]
  const nextTime = time === undefined ? key.t : Number(time)
  const nextValue = value === undefined ? timelineCurveKeyValue(key,channel) : Number(value)
  if (!validScalar(nextValue) || !Number.isFinite(nextTime) || nextTime < 0 || nextTime > duration ||
    (before && nextTime <= before.t+0.001) || (after && nextTime >= after.t-0.001) ||
    (nextTime !== key.t && !timelineCurveCanRetime(track,key)) ||
    (channel.field === 'fov' && (nextValue < 5 || nextValue > 170))) return false
  if (Math.abs(key.t-nextTime)<1e-7 && Math.abs(timelineCurveKeyValue(key,channel)-nextValue)<1e-7) return false
  if (channel.axis === null) key[channel.field]=rounded(nextValue)
  else key[channel.field][channel.axis]=rounded(nextValue)
  key.t=rounded(nextTime)
  return true
}
/** Pendiente de salida (desde clave) o de entrada (hacia clave), unidades/segundo. */
export function editTimelineCurveTangent(track, keyId, channelId, side, slope) {
  if (track?.kind !== 'node' || track.locked || !['cubic','cubic-angle'].includes(track.interpolation) ||
    !['in','out'].includes(side) || !validScalar(slope)) return false
  const channel=timelineCurveChannels(track).find(c=>c.id===channelId)
  if (!channel || channel.field!=='v') return false
  const keys=track.keys || [], index=keys.findIndex(k=>k.id===keyId)
  if (index<0 || side==='in' && index===0 || side==='out' && index===keys.length-1) return false
  const key=keys[index], field=side==='in'?'tanIn':'tanOut', next=rounded(slope)
  if (key[field]?.[channel.axis]===next) return false
  const slopes=Array.isArray(key[field]) && key[field].length===3 ? [...key[field]] : [null,null,null]
  slopes[channel.axis]=next
  key[field]=slopes
  return true
}
export function editTimelineCurveBezier(track, keyId, handle, x, y) {
  if (!track || track.locked || track.interpolation || !['node','camera'].includes(track.kind) ||
    ![0,1].includes(handle) || !Number.isFinite(x) || !validScalar(y)) return false
  const keys=track.keys || [], index=keys.findIndex(k=>k.id===keyId)
  if (index<0 || index===keys.length-1) return false
  const key=keys[index]
  if (key.ease!=='bezier') return false
  const bz=Array.isArray(key.bz) && key.bz.length===4 ? [...key.bz] : [0.42,0,0.58,1]
  const i=handle*2, nx=rounded(Math.min(1,Math.max(0,x))), ny=rounded(y)
  if (bz[i]===nx && bz[i+1]===ny) return false
  bz[i]=nx; bz[i+1]=ny; key.bz=bz
  return true
}

/** Vuelve a tangente automática por canal; elimina el campo vacío para compatibilidad. */
export function resetTimelineCurveTangent(track,keyId,side,axis=null) {
  if (track?.kind !== 'node' || track.locked || !['in','out'].includes(side) ||
      !['cubic','cubic-angle'].includes(track.interpolation)) return false
  const key=track.keys?.find(k=>k.id===keyId),field=side==='in'?'tanIn':'tanOut'
  if (!key || !Array.isArray(key[field]) || axis!==null && ![0,1,2].includes(axis)) return false
  if (axis===null) { delete key[field]; return true }
  if (key[field][axis]===null) return false
  key[field][axis]=null
  if (key[field].every(value=>value===null)) delete key[field]
  return true
}

/** Nueva clave real interpolada. No cambia IDs de extremos ni duplica referencias de clip. */
export function insertTimelineCurveKey(track, channelId, time, value, duration, pose) {
  const channel = timelineCurveChannels(track).find(c=>c.id===channelId)
  if (!channel || track.locked || !Number.isFinite(duration) || !Number.isFinite(time) || !validScalar(value) || time<0 || time>duration) return null
  if (channel.field==='fov' && (value<5 || value>170)) return null
  const keys=track.keys||[]
  const index=keys.findIndex(k=>k.t>time)
  if (index<1 || keys.some(k=>Math.abs(k.t-time)<.005)) return null
  const before=keys[index-1]
  const extra=track.kind==='node' ? {v:[...(pose?.v||before.v)],ease:before.ease||'inOut'} :
    {mode:'free',pos:[...(pose?.pos||before.pos)],rot:[...(pose?.rot||before.rot)],fov:pose?.fov??before.fov,ease:before.ease||'inOut'}
  if(before.ease==='bezier' && before.bz) extra.bz=[...before.bz]
  const key=newKey(track.kind,rounded(time),extra)
  if(channel.axis===null) key[channel.field]=rounded(value)
  else key[channel.field][channel.axis]=rounded(value)
  keys.push(key);sortKeys(track)
  return key
}
