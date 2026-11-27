<script setup>
// Inspector contextual único para cinemáticas y clips. Las pistas y claves siguen perteneciendo al recurso existente.
import { computed, ref, watch } from 'vue'
import * as THREE from 'three'
import { store, commit, toast, openEventEditor, getObject, descendantsOf, selectTemporal, renameEntry } from '../core/store.js'
import { TRACK_KINDS, NODE_PROPS, INTERPOLATIONS, keyParams, timelineSelectedKeys, moveTimelineSelection, duplicateTimelineSelection, deleteTimelineSelection, editTimelineClip, deleteTimelineClip, timelineTrackEditable, editTimelineAudioVolumePoint, timelineMinDuration, moveTimelineMarker, deleteTimelineMarker, removeTimelineGroup } from '../core/timeline/model.js'
import { PROPS, EASES, BEZIER_PRESETS, defaultValue, sortKeys } from '../engine/runtime/anim/model.js'
import { easeValue } from '../engine/runtime/anim/eval.js'
import { uid } from '../engine/runtime/util.js'
import { editTimelineCurveTangent, resetTimelineCurveTangent } from '../core/timeline/curves.js'
import { COMMANDS } from '../engine/runtime/events/commandDefs.js'
import { quatFromRot, rotFromQuat } from '../engine/runtime/timeline/eval.js'
import { discoverNodeMethods } from '../engine/runtime/scene/node-scripts.js'
import Icon from './Icon.vue'
import ParamForm from './ParamForm.vue'
import TimelineAudioSource from './TimelineAudioSource.vue'
import { requestTimelineAudioAnalysis } from '../core/timeline/audio-source-analysis.js'
import { initialTimelineAudioDuration } from '../core/timeline/audio-waveform.js'
import { readTimelineNodeProperty, timelineTrackNodeOwner } from '../core/timeline/model.js'
import { FX_TYPES } from '../engine/runtime/audio/config.js'
import { volumeAutomationVisualOrder } from '../engine/runtime/audio/automation.js'

const props = defineProps({
  kind: { type: String, required: true },
  resourceId: { type: String, required: true },
  context: { type: Object, default: null },
})
const emit = defineEmits(['select', 'seek'])
function selectDetails(kind, resourceId, element = 'resource', trackId = null, itemId = null, keyRefs = null) {
  if (props.context) emit('select', { element, trackId, itemId, keyRefs })
  else selectTemporal(kind, resourceId, element, trackId, itemId, keyRefs)
}
const collection = computed(() => props.kind === 'timeline' ? store.project?.timelines : store.project?.animations)
const resource = computed(() => collection.value?.find((r) => r.id === props.resourceId) || null)
const selection = computed(() => {
  const s = props.context ?? store.temporalSelection
  return s?.kind === props.kind && s.resourceId === props.resourceId ? s : null
})
const track = computed(() => resource.value?.tracks.find((t) => t.id === selection.value?.trackId) || null)
const group = computed(() => isTimeline.value && selection.value?.element==='group' ? resource.value?.groups?.find(g=>g.id===selection.value?.itemId) || null : null)
const marker = computed(() => isTimeline.value && selection.value?.element==='marker' ? resource.value?.markers?.find(m=>m.id===selection.value?.itemId) || null : null)
const timelineClip = computed(() => props.kind === 'timeline' && selection.value?.element === 'clip' ? track.value?.clips?.find(c => c.id === selection.value.itemId) || null : null)
const timelineClipSource = computed(() => timelineClip.value ? {from:track.value.keys.find(k=>k.id===timelineClip.value.from),to:track.value.keys.find(k=>k.id===timelineClip.value.to)} : null)
const multiKeys = computed(() => props.kind === 'timeline' && selection.value?.element === 'key' ?
  timelineSelectedKeys(resource.value, selection.value.keyRefs).map(entry => ({ tr:entry.tr, k:entry.k, t:entry.key.t })) : [])
const multiTrackCount = computed(() => new Set(multiKeys.value.map(k => k.tr)).size)
const multiRange = computed(() => multiKeys.value.length ? {
  start:Math.min(...multiKeys.value.map(item=>item.t)),
  end:Math.max(...multiKeys.value.map(item=>item.t)),
} : null)

const item = computed(() => selection.value?.element === 'event'
  ? resource.value?.events?.find((e) => e.id === selection.value.itemId) || null
  : selection.value?.element === 'key'
    ? track.value?.keys?.find((k) => k.id === selection.value.itemId) || null
    : null)
const part = computed(() => group.value ? 'group' : marker.value ? 'marker' : timelineClip.value ? 'clip' : multiKeys.value.length > 1 ? 'keys' : item.value ? selection.value.element : track.value ? 'track' : 'resource')
const isTimeline = computed(() => props.kind === 'timeline')
const title = computed(() => part.value === 'resource'
  ? (isTimeline.value ? 'Cinemática' : 'Clip de animación')
  : part.value === 'group' ? 'Grupo de pistas' : part.value === 'marker' ? 'Marcador' : part.value === 'track' ? 'Pista' : part.value === 'clip' ? 'Clip' : part.value === 'keys' ? 'Selección de claves'
    : part.value === 'event' ? 'Evento' : 'Clave')
const trackLabel = computed(() => isTimeline.value
  ? track.value?.name || '' : track.value ? `${track.value.path || '(raíz)'} · ${PROPS[track.value.prop]?.label || track.value.prop}` : '')
const objects = computed(() => store.project?.objects || [])
const cameraBindingStatus = computed(() => {
  if (!isTimeline.value || track.value?.kind !== 'camera') return []
  const keys = part.value === 'key' ? [item.value]
    : part.value === 'clip' ? [timelineClipSource.value?.from, timelineClipSource.value?.to] : track.value.keys
  const bindings = new Map()
  for (const key of keys) {
    if (key?.mode !== 'camera3d') continue
    const identity = JSON.stringify([key.sceneId, key.node])
    const otherScene = !!key.sceneId && key.sceneId !== store.project.activeSceneId
    const object = key.sceneId && !otherScene && objects.value.find(object => object.id === key.node && object.type === 'camera')
    bindings.set(identity, { identity, id: key.node, object, otherScene })
  }
  return [...bindings.values()]
})
const timelineNodeId = computed(() => track.value?.byId ? track.value.node : objects.value.find((o) => o.name === track.value?.node)?.id || '')
const methodInfo = computed(() => track.value?.kind === 'method' && timelineNode.value ? discoverNodeMethods(timelineNode.value, store.project?.scripts || []) : { methods: [], diagnostics: [] })
const methodArgsDraft = ref('[]'), methodArgsError = ref(''), methodNameError = ref('')
watch(() => [props.resourceId, selection.value?.trackId, selection.value?.itemId, item.value?.args], () => {
  methodArgsDraft.value = JSON.stringify(item.value?.args || [])
  methodArgsError.value = ''
  methodNameError.value = ''
}, { immediate: true })
function methodNameChange(value) {
  if (track.value?.kind !== 'method' || !item.value || isTimeline.value && !timelineTrackEditable(track.value)) return
  const name = value.trim()
  if (methodInfo.value.methods.some((m) => m.name === name && (m.duplicate || m.reserved))) {
    methodNameError.value = 'Método ambiguo o reservado; elige otro nombre.'
    return
  }
  methodNameError.value = ''
  item.value.method = name
  changed('Método de la clave')
}
function methodArgsChange(text) {
  if (isTimeline.value && !timelineTrackEditable(track.value)) return
  methodArgsDraft.value = text
  try {
    const args = JSON.parse(text)
    if (!Array.isArray(args)) throw new Error('Los argumentos deben ser una lista JSON (ejemplo: [1, true, "texto"]).')
    item.value.args = args
    methodArgsError.value = ''
    changed('Argumentos del método')
  } catch (error) { methodArgsError.value = error.message || 'JSON inválido' }
}
const timelineNode = computed(() => objects.value.find((o) => o.id === timelineNodeId.value) || null)
const keyFields = computed(() => {
  if (!track.value || !item.value || part.value !== 'key') return []
  if (isTimeline.value) return keyParams(track.value)
    .filter(param => param.key !== 't' || !(track.value.clips || []).some(c => c.from===item.value.id || c.to===item.value.id))
    .map(param => param.key === 'duration' && track.value.kind === 'audio' && item.value.volumeAutomation?.length
      ? { ...param, min: Math.max(0.05, ...item.value.volumeAutomation.map(point => point.t)) } : param)
  const kind = PROPS[track.value.prop]?.kind
  return [
    { key: 't', label: 'Tiempo (s)', type: 'number', def: 0, min: 0, step: 0.05 },
    kind === 'vec3' ? { key: 'v', label: PROPS[track.value.prop].label, type: 'vec3', def: [0, 0, 0] }
      : kind === 'bool' ? { key: 'v', label: 'Visible', type: 'bool', def: true }
        : kind === 'color' ? { key: 'v', label: 'Color', type: 'color', def: '#ffffff' }
          : { key: 'v', label: PROPS[track.value.prop].label, type: 'number', def: 0, step: 0.1 },
    ...(kind === 'bool' ? [] : [{ key: 'ease', label: 'Hasta la siguiente', type: 'select', def: 'inOut', options: EASES }]),
  ]
})
const commandSummaries = computed(() => {
  if (!isTimeline.value || track.value?.kind !== 'commands' || !item.value) return []
  const refs = { sw: (i) => '#' + i, vr: (i) => '#' + i, scene: (i) => i, node: (n) => n || '(nodo)', db: (_, i) => '#' + i }
  return (item.value.list || []).slice(0, 8).map(c => {
    const def = COMMANDS[c.code]
    let summary = ''
    try { summary = def?.summary?.(c.p || {}, refs) || '' } catch { /* Comando heredado sin resumen. */ }
    return `${def?.label || c.code}${summary ? ': ' + summary : ''}`
  })
})
const bezierPath = computed(() => {
  if (!item.value || item.value.ease !== 'bezier') return ''
  const points = []
  for (let i = 0; i <= 24; i++) {
    const u = i / 24
    points.push(`${(u * 100).toFixed(1)},${(100 - easeValue(item.value, u) * 70 - 15).toFixed(1)}`)
  }
  return points.join(' ')
})
function changed(label) {
  commit(label)
  store.temporalEditRevision++ // Reactivar el preview existente sin replicar su evaluador.
}
async function renameTimelineResource(event) {
  if (resource.value?.id) await renameEntry('timeline', resource.value.id, event.target.value)
  event.target.value = resource.value?.name || ''
}
function resourceChange(key) {
  if (key === 'duration') resource.value.duration = Math.max(isTimeline.value ? timelineMinDuration(resource.value) : 0.1, +resource.value.duration || 1)
  if (key === 'letterbox') resource.value.letterbox = Math.max(0, Math.min(25, +resource.value.letterbox || 0))
  if (key === 'speed') resource.value.speed = Math.max(0.01, +resource.value.speed || 1)
  if (key === 'name') resource.value.name = String(resource.value.name || '').trim() || (isTimeline.value ? 'Cinemática' : 'Animación')
  changed('Editar recurso temporal')
}
function trackChange(label = 'Editar pista') { if(isTimeline.value && !timelineTrackEditable(track.value))return;changed(label) }
function toggleInspectorTrackLock() {
  if(!isTimeline.value || track.value?.kind==='bake' || store.locked || store.play.on)return
  track.value.locked=!track.value.locked
  changed(track.value.locked?'Bloquear pista':'Desbloquear pista')
}
function editGroupName(e) {
  if(!group.value || store.locked || store.play.on)return
  const name=String(e.target.value||'').trim().slice(0,80)
  e.target.value=name||group.value.name
  if(name && name!==group.value.name){group.value.name=name;changed('Renombrar grupo')}
}
function toggleInspectorGroup(e) {if(!group.value||store.locked||store.play.on)return;group.value.collapsed=e.target.checked;changed('Contraer grupo')}
function removeInspectorGroup() {
  if(!group.value || store.locked || store.play.on)return
  if(removeTimelineGroup(resource.value,group.value.id)){changed('Desagrupar pistas');selectDetails('timeline',resource.value.id)}
}
function editMarkerName(e) {
  if(!marker.value||store.locked||store.play.on)return
  const name=String(e.target.value||'').trim().slice(0,80)
  e.target.value=name||marker.value.name
  if(name && name!==marker.value.name){marker.value.name=name;changed('Renombrar marcador')}
}
function editMarkerTime(e) {
  if(!marker.value||store.locked||store.play.on)return
  const old=marker.value.t,time=Number(e.target.value)
  if(moveTimelineMarker(resource.value,marker.value.id,time)) changed('Mover marcador')
  e.target.value=marker.value.t??old
}
function removeInspectorMarker() {
  if(!marker.value||store.locked||store.play.on)return
  if(deleteTimelineMarker(resource.value,marker.value.id)){changed('Eliminar marcador');selectDetails('timeline',resource.value.id)}
}
function timelineNodeChange(value) {
  // El selector publica IDs: no conservar el modo por nombre de una pista heredada.
  track.value.node = value
  track.value.byId = track.value.kind === 'method' || !!value
  trackChange('Nodo de la pista')
}
function timelineInterpolationChange(value) {
  if (track.value?.kind !== 'node' || track.value.prop === 'visible') return
  if (value && (!INTERPOLATIONS.some(([mode]) => mode === value) || (track.value.prop !== 'rotation' && value.endsWith('-angle')))) return
  if (value) track.value.interpolation = value
  else delete track.value.interpolation // Los recursos anteriores siguen usando ease por clave.
  trackChange('Interpolación de pista')
}
function timelinePropChange(value) {
  if (!NODE_PROPS.some((p) => p[0] === value)) return
  if (track.value?.clips?.length) {toast('Elimina primero los clips vinculados para cambiar la propiedad de la pista','error');return}
  track.value.prop = value
  if (value === 'visible') delete track.value.interpolation
  else if (value !== 'rotation' && track.value.interpolation?.endsWith('-angle')) track.value.interpolation = track.value.interpolation === 'cubic-angle' ? 'cubic' : 'linear'
  for (const k of track.value.keys) k.v = value === 'visible' ? true : value === 'scale' ? [1, 1, 1] : [0, 0, 0]
  trackChange('Propiedad de la pista')
}
function animTrackChange(key, value) {
  const nextPath = key === 'path' ? value : track.value.path
  const nextProp = key === 'prop' ? value : track.value.prop
  if (resource.value.tracks.some((t) => t !== track.value && t.path === nextPath && t.prop === nextProp)) return
  if (key === 'prop' && PROPS[value]) {
    track.value.prop = value
    for (const k of track.value.keys) k.v = defaultValue(value)
  } else if (key === 'path') track.value.path = value
  trackChange('Editar pista de animación')
}
const animPaths = computed(() => {
  const root = getObject(store.animRoot)
  if (!root) return [{ value: '', label: '(raíz)' }, ...(store.project?.database?.player?.slots || []).map(s => ({ value: '@slot:' + s.id, label: 'Slot ' + s.id }))]
  const choices = [root, ...descendantsOf(root.id)].map((o) => {
    const segs = []; let cur = o
    while (cur && cur.id !== root.id) { segs.unshift(cur.name); cur = getObject(cur.parentId) }
    return { value: segs.join('/'), label: o.id === root.id ? `${o.name} (raíz)` : segs.join('/') }
  })
  return [...choices, ...(store.project?.database?.player?.slots || []).map(s => ({ value: '@slot:' + s.id, label: 'Slot ' + s.id }))]
})
// Indicador derivado de los datos guardados: leer nunca altera la cadena FX.
const savedClipFx = computed(() => isTimeline.value && track.value?.kind === 'audio' &&
  item.value?.action === 'play' && Array.isArray(item.value?.fx) ? item.value.fx : [])
const volumeSectionOpen = ref(true)
const volumePointOpenIds = ref([])
watch(() => [props.resourceId, selection.value?.trackId, selection.value?.itemId], () => {
  volumeSectionOpen.value = true
  volumePointOpenIds.value = []
})
const visualVolumePoints = computed(() => volumeAutomationVisualOrder(item.value?.volumeAutomation))
function volumePointLabel(point, index) {
  const originalIndex = item.value?.volumeAutomation?.indexOf(point) ?? -1
  return point.name || `Punto-${point.createdOrder || (originalIndex >= 0 ? originalIndex + 1 : index + 1)}`
}
function volumePointExpanded(id) { return volumePointOpenIds.value.includes(id) }
function toggleVolumePoint(id) {
  volumePointOpenIds.value = volumePointExpanded(id)
    ? volumePointOpenIds.value.filter(current => current !== id)
    : [...volumePointOpenIds.value, id]
}
function editInspectorVolumePoint(action, point = null, field = '', event = null) {
  if (!isTimeline.value || track.value?.kind !== 'audio' || item.value?.action !== 'play' ||
      !timelineTrackEditable(track.value) || store.locked || store.play.on) return
  const current = item.value, t = field === 't' ? Number(event?.target.value) : point?.t
  const value = field === 'value' ? Number(event?.target.value) : point?.value
  const data = action === 'add' ? { id: uid('av'), t: +Math.min(current.duration, current.duration / 2).toFixed(5), value: .7 }
    : action === 'rename' ? { id: point?.id, name: event?.target.value }
      : { id: point?.id, t, value }
  if (editTimelineAudioVolumePoint(resource.value, track.value.id, current.id, action, data)) {
    if (action === 'add') { volumeSectionOpen.value = true; volumePointOpenIds.value = [data.id] }
    if (action === 'remove') volumePointOpenIds.value = volumePointOpenIds.value.filter(id => id !== data.id)
    changed(action === 'remove' ? 'Eliminar punto de volumen' : action === 'rename' ? 'Renombrar punto de volumen' : 'Editar automatización de volumen')
  } else if (event?.target) event.target.value = field === 'name' ? volumePointLabel(point, current.volumeAutomation.indexOf(point)) : point?.[field] ?? ''
}
// Solo una asignación explícita inicializa duración; abrir una clave antigua no la migra.
let cancelDurationLookup = () => {}
watch(() => [store.project?.id, props.resourceId, selection.value?.trackId, selection.value?.itemId], () => {
  cancelDurationLookup()
  cancelDurationLookup = () => {}
})
function initializeAudioDuration(key, trackRef, timeline, project) {
  cancelDurationLookup()
  cancelDurationLookup = () => {}
  if (!key.clip || key.duration !== 0) return
  const clip = key.clip
  // El callback puede llegar después de otra selección, una edición manual o un cambio de proyecto.
  cancelDurationLookup = requestTimelineAudioAnalysis(project, clip, result => {
    if (result.status !== 'ready' || store.project !== project || resource.value !== timeline || item.value !== key ||
        key.clip !== clip || key.duration !== 0 || !timelineTrackEditable(trackRef) || store.locked || store.play.on) return
    const { seconds, exceedsTimeline } = initialTimelineAudioDuration(result.data.duration, key, timeline.duration)
    if (!(seconds > 0)) return
    key.duration = seconds
    changed('Duración inicial de Audio')
    if (exceedsTimeline) toast('La fuente supera el final del Timeline; ajusta la duración global para reproducirla completa.', 'warning')
  }, true)
}
function keyChange(key) {
  if (isTimeline.value && !timelineTrackEditable(track.value)) return
  if (isTimeline.value && track.value?.kind === 'audio' && key === 'action' &&
      item.value.action === 'stop' && item.value.volumeAutomation?.length) {
    item.value.action = 'play'
    toast('Elimina los puntos de volumen antes de convertir esta clave en Stop.', 'warning')
    return
  }
  if (key === 't') { item.value.t = Math.max(0, +item.value.t || 0); sortKeys(track.value) }
  if (track.value.kind === 'camera' && item.value.mode === 'camera3d') {
    if (key === 'mode') { item.value.node = ''; item.value.sceneId = '' }
    if (key === 'node') item.value.sceneId = item.value.node ? store.project.activeSceneId : ''
  }
  if (key === 'ease' && item.value.ease === 'bezier' && !Array.isArray(item.value.bz)) item.value.bz = [...BEZIER_PRESETS[0][1]]
  if (key === 'duration') { cancelDurationLookup(); cancelDurationLookup = () => {} }
  changed('Editar clave')
  if (isTimeline.value && track.value?.kind === 'audio' && item.value?.action === 'play' && key === 'clip')
    initializeAudioDuration(item.value, track.value, resource.value, store.project)
}
function curveChange(index, value) {
  if (isTimeline.value && !timelineTrackEditable(track.value)) return
  if (!Array.isArray(item.value.bz)) item.value.bz = [...BEZIER_PRESETS[0][1]]
  const num = Number(value) || 0
  item.value.bz[index] = index % 2 === 0 ? Math.min(1, Math.max(0, num)) : num
  changed('Editar curva')
}
function inspectorTangentChange(side, axis, value) {
  if (!isTimeline.value || !item.value || !timelineTrackEditable(track.value) || store.locked || store.play.on) return
  const text=String(value).trim()
  const changedTangent=text==='' ? resetTimelineCurveTangent(track.value,item.value.id,side,axis)
    : editTimelineCurveTangent(track.value,item.value.id,'v'+axis,side,Number(text))
  if(changedTangent) changed('Editar tangente cúbica')
}
function inspectorTangentAuto(side) {
  if (!isTimeline.value || !item.value || !timelineTrackEditable(track.value) || store.locked || store.play.on) return
  if(resetTimelineCurveTangent(track.value,item.value.id,side)) changed('Restaurar tangente automática')
}
function eventChange(key, value) {
  if (key === 't') { item.value.t = Math.max(0, +value || 0); resource.value.events.sort((a, b) => a.t - b.t) }
  else item.value.name = String(value)
  changed(key === 't' ? 'Mover evento' : 'Renombrar evento')
}
function duplicateMultiKeys() {
  if (part.value !== 'keys' || store.locked || store.play.on) return
  const refs = duplicateTimelineSelection(resource.value, multiKeys.value, 1)
  if (!refs.length) return
  changed('Duplicar claves')
  const anchor = refs.at(-1)
  selectDetails('timeline', resource.value.id, 'key', anchor.tr, anchor.k, refs)
}
function deleteMultiKeys() {
  if (part.value !== 'keys' || store.locked || store.play.on) return
  try { if (!deleteTimelineSelection(resource.value, multiKeys.value)) return }
  catch(error){toast(error.message,'error');return}
  changed('Eliminar claves')
  selectDetails('timeline', resource.value.id)
}
function shiftMultiKeys(event) {
  if (part.value !== 'keys' || store.locked || store.play.on) return
  const requested = Number(event.target.value)
  event.target.value = ''
  if (!Number.isFinite(requested) || !requested) return
  if (moveTimelineSelection(resource.value, multiKeys.value, requested)) changed('Mover claves')
}
function duplicateKey() {
  if (part.value !== 'key' || isTimeline.value && !timelineTrackEditable(track.value)) return
  if (isTimeline.value) {
    const refs = duplicateTimelineSelection(resource.value, [{tr:track.value.id,k:item.value.id}], 1)
    if (!refs.length) return
    changed('Duplicar clave')
    selectDetails('timeline', resource.value.id, 'key', refs[0].tr, refs[0].k)
    return
  }
  const copy = JSON.parse(JSON.stringify(item.value))
  copy.id = uid('k'); copy.t += isTimeline.value ? 1 : 0.5
  for (const command of copy.list || []) command.id = uid('c')
  track.value.keys.push(copy); sortKeys(track.value)
  changed('Duplicar clave')
  selectDetails(props.kind, resource.value.id, 'key', track.value.id, copy.id)
}
function deleteSelected() {
  if (part.value === 'resource' || isTimeline.value && !timelineTrackEditable(track.value)) return
  if (part.value === 'clip') { removeTimelineClip(); return }
  if (part.value === 'key' && isTimeline.value) {
    try {if (!deleteTimelineSelection(resource.value,[{tr:track.value.id,k:item.value.id}])) return}
    catch(error){toast(error.message,'error');return}
    changed('Eliminar clave');selectDetails('timeline',resource.value.id);return
  }
  const which = part.value
  if (which === 'event') resource.value.events = resource.value.events.filter((e) => e.id !== item.value.id)
  else if (which === 'key') track.value.keys = track.value.keys.filter((k) => k.id !== item.value.id)
  else resource.value.tracks = resource.value.tracks.filter((t) => t.id !== track.value.id)
  changed(`Eliminar ${which === 'key' ? 'clave' : which === 'track' ? 'pista' : 'evento'}`)
  selectDetails(props.kind, resource.value.id)
}
function seek() {
  if (props.context) emit('seek', item.value.t)
  else store.temporalSeek = { kind: props.kind, resourceId: props.resourceId, time: item.value.t }
}
function commands() { if (isTimeline.value && !timelineTrackEditable(track.value))return; if (part.value === 'event') openEventEditor(`an:${resource.value.id}:${item.value.id}`); else if (part.value === 'key' && track.value.kind === 'commands') openEventEditor(`tl:${resource.value.id}:${track.value.id}:${item.value.id}`) }
function editClipField(field,event) {
  if (!timelineClip.value || !timelineTrackEditable(track.value) || store.locked || store.play.on) return
  const value=Number(event.target.value)
  const saved=timelineClip.value[field]
  if (!Number.isFinite(value)) {event.target.value=saved;return}
  try {
    if(editTimelineClip(resource.value,track.value.id,timelineClip.value.id,{[field]:value,mode:selection.value?.timelineMode || 'mix'})) changed('Editar clip · '+(selection.value?.timelineMode||'mix'))
  } catch(error) {toast(error.message,'error')}
  event.target.value=timelineClip.value?.[field] ?? saved
}
function removeTimelineClip() {
  if(!timelineClip.value || !timelineTrackEditable(track.value) || store.locked || store.play.on)return
  if(deleteTimelineClip(resource.value,track.value.id,timelineClip.value.id)) {changed('Eliminar clip');selectDetails('timeline',resource.value.id,'track',track.value.id)}
}
function timelineCapture() {
  if (!isTimeline.value || part.value !== 'key' || !timelineTrackEditable(track.value) || store.locked || store.play.on) return
  if (track.value.kind === 'camera') {
    const camera = store.editor?.vp?.persp
    if (!camera) return
    Object.assign(item.value, { mode: 'free', pos: camera.position.toArray().map(v => +v.toFixed(3)), rot: rotFromQuat(camera.quaternion).map(v => +v.toFixed(2)), fov: Math.round(camera.fov) })
  } else if (track.value.kind === 'node') {
    const target = timelineTrackNodeOwner(track.value, objects.value, store.project.activeSceneId)?.node
    try { item.value.v = readTimelineNodeProperty(target, track.value.prop) }
    catch (error) { toast(error.message, 'error'); return }
  } else return
  changed('Capturar valor')
}
function goToView() {
  if (track.value?.kind !== 'camera' || item.value?.mode !== 'free') return
  const editor = store.editor?.vp; if (!editor) return
  const cam = editor.persp
  cam.position.set(...item.value.pos); cam.quaternion.copy(quatFromRot(item.value.rot)); cam.fov = item.value.fov; cam.updateProjectionMatrix()
  const dest = new THREE.Vector3(0, 0, -8).applyQuaternion(cam.quaternion).add(cam.position)
  editor.controls.target.copy(dest); editor.controls.update(); editor.requestRender()
}
function animCurrentValue() {
  const tr = track.value; if (!tr) return
  const root = getObject(store.animRoot)
  let target = root
  if (target && tr.path && !tr.path.startsWith('@')) {
    for (const name of tr.path.split('/')) {
      target = objects.value.find(o => o.parentId === target?.id && o.name === name)
      if (!target) break
    }
  }
  const prop = tr.prop
  let value = defaultValue(prop)
  if (target && !tr.path.startsWith('@')) {
    if (['position', 'rotation', 'scale'].includes(prop)) value = [...target[prop]]
    else if (prop === 'visible') value = target.visible !== false
    else if (prop === 'light.energy' && target.type === 'light') value = target.light?.energy ?? value
    else if (prop === 'light.color' && target.type === 'light') value = target.color ?? value
  }
  item.value.v = value
  changed('Tomar valor')
}
</script>

<template>
  <div v-if="resource" class="temporal-inspector insp" :data-node-type="kind" :data-test="'temporal-inspector-' + kind" :data-part="part">
    <section class="sect">
      <header>{{ title }}</header>
      <div class="body">
        <div class="identity"><b :title="resource.name">{{ part === 'resource' ? resource.name : part === 'event' ? item?.name || 'Evento' : trackLabel }}</b><small>{{ kind === 'timeline' ? 'Timeline' : 'Animación' }}</small></div>
        <p v-for="binding in cameraBindingStatus" :key="binding.identity" class="note" :class="{ error: !binding.object }" data-test="timeline-camera-binding">
          {{ binding.object ? 'Camera3D vinculada · ' + binding.object.name : binding.otherScene ? 'Camera3D de otra escena · ' + binding.id : binding.id ? 'Camera3D ausente · ' + binding.id : 'Camera3D sin asignar' }}
        </p>
        <template v-if="part === 'resource'">
          <div v-if="isTimeline" class="field"><label>Nombre</label><input :value="resource.name" aria-label="Nombre del Timeline" @change="renameTimelineResource($event)" /></div>
          <ParamForm :values="resource" :params="[
            ...(!isTimeline ? [{ key: 'name', label: 'Nombre', type: 'text' }] : []),
            { key: 'duration', label: 'Duración (s)', type: 'number', min: 0.1, step: 0.1 },
            { key: 'loop', label: 'En bucle', type: 'bool' },
            ...(isTimeline ? [
              { key: 'lockPlayer', label: 'Bloquear jugador', type: 'bool' },
              { key: 'skippable', label: 'Se puede omitir', type: 'bool' },
              { key: 'letterbox', label: 'Barras de cine (%)', type: 'number', min: 0, max: 25, step: 1 },
            ] : [
              { key: 'speed', label: 'Velocidad', type: 'number', min: 0.01, step: 0.1 },
              { key: 'additive', label: 'Aditiva', type: 'bool' },
            ]),
          ]" @change="resourceChange" />
        </template>
        <template v-else-if="part === 'group'">
          <div class="field"><label>Nombre</label><input :value="group.name" :disabled="store.locked || store.play.on" @change="editGroupName" /></div>
          <div class="field"><label>Contraído</label><input type="checkbox" :checked="group.collapsed" :disabled="store.locked || store.play.on" @change="toggleInspectorGroup" /></div>
          <p class="note">Agrupar o contraer pistas no altera las claves ni la reproducción.</p>
          <div class="actions"><button type="button" class="ghost" :disabled="store.locked || store.play.on" @click="removeInspectorGroup">Desagrupar (conservar pistas)</button></div>
        </template>
        <template v-else-if="part === 'marker'">
          <div class="field"><label>Nombre</label><input :value="marker.name" :disabled="store.locked || store.play.on" @change="editMarkerName" /></div>
          <div class="field"><label>Tiempo (s)</label><input type="number" min="0" :max="resource.duration" step="0.05" :value="marker.t" :disabled="store.locked || store.play.on" @change="editMarkerTime" /></div>
          <p class="note">Marcador editorial: no ejecuta comandos, métodos ni señales.</p>
          <div class="actions"><button type="button" class="ghost" :disabled="store.locked || store.play.on" @click="removeInspectorMarker">Eliminar marcador</button></div>
        </template>
        <template v-else-if="part === 'track'">
          <div v-if="isTimeline" class="field"><label>Bloqueada</label><input type="checkbox" :checked="!!track.locked" :disabled="track.kind==='bake' || store.locked || store.play.on" @change="toggleInspectorTrackLock" /></div>
          <fieldset class="track-edit-fields" :disabled="isTimeline && !!track.locked">
          <template v-if="isTimeline">
            <div class="field"><label>Nombre</label><input :value="track.name" @change="track.name = $event.target.value || track.name; trackChange('Renombrar pista')" /></div>
            <div class="field"><label>Tipo</label><span>{{ TRACK_KINDS[track.kind]?.label || track.kind }}</span></div>
            <div class="field"><label>Silenciada</label><input type="checkbox" :checked="track.muted" @change="track.muted = $event.target.checked; trackChange('Silenciar pista')" /></div>
            <template v-if="track.kind === 'node' || track.kind === 'method'">
              <div class="field"><label>Nodo</label><select :value="timelineNodeId" @change="timelineNodeChange($event.target.value)"><option value="">— nodo —</option><option v-if="track.node && !timelineNode" value="" disabled>Referencia no disponible</option><option v-for="o in objects" :key="o.id" :value="o.id">{{ o.name }}</option></select></div>
              <p v-if="track.byId && !timelineNode" class="note">El nodo referenciado ya no existe. Elige otro nodo o restaura el original.</p>
              <div v-if="track.kind === 'method'" class="note">Las claves invocan métodos públicos del nodo en Play/Player. En Edit Mode no se ejecutan scripts.</div>
              <template v-if="track.kind === 'node'">
              <div class="field"><label>Propiedad</label><select :value="track.prop" @change="timelinePropChange($event.target.value)"><option v-for="p in NODE_PROPS" :key="p[0]" :value="p[0]">{{ p[1] }}</option></select></div>
              <div v-if="track.prop !== 'visible'" class="field"><label>Interpolación</label><select :value="track.interpolation || ''" @change="timelineInterpolationChange($event.target.value)"><option value="">Por clave (heredado)</option><option v-for="mode in INTERPOLATIONS.filter(([id]) => track.prop === 'rotation' || !id.endsWith('-angle'))" :key="mode[0]" :value="mode[0]">{{ mode[1] }}</option></select></div>
              <p v-if="track.prop !== 'visible' && track.interpolation" class="note">La interpolación de pista tiene prioridad sobre el suavizado de cada clave.</p>
              </template>
            </template>
            <div v-if="track.kind === 'camera'" class="field"><label>Trayectoria</label><select :value="track.path" @change="track.path = $event.target.value; trackChange('Trayectoria')"><option value="smooth">Curva suave</option><option value="linear">Recta</option></select></div>
            <div v-if="track.kind === 'bake'" class="note">Simulación física horneada: datos de solo lectura. No se pueden añadir claves manuales.</div>
          </template>
          <template v-else>
            <div class="field"><label>Ruta de nodo</label><select :value="track.path" @change="animTrackChange('path', $event.target.value)"><option v-if="!animPaths.some(p => p.value === track.path)" :value="track.path">{{ track.path }} (no disponible)</option><option v-for="p in animPaths" :key="p.value" :value="p.value">{{ p.label }}</option></select></div>
            <div class="field"><label>Propiedad</label><select :value="track.prop" @change="animTrackChange('prop', $event.target.value)"><option v-for="(p, key) in PROPS" :key="key" :value="key">{{ p.label }}</option></select></div>
          </template>
          <div class="actions"><button class="ghost" @click="deleteSelected">Eliminar pista</button></div>
          </fieldset>
        </template>
        <template v-else-if="part === 'clip'">
          <fieldset class="track-edit-fields" :disabled="!!track?.locked">
          <p class="note">El clip usa las dos claves originales por ID. Moverlo no modifica su fuente. La previsualización y el Player evalúan el mismo intervalo.</p>
          <div class="field"><label>Inicio (s)</label><input type="number" min="0" step="0.05" :max="resource.duration" :value="timelineClip.start" :disabled="store.locked || store.play.on" @change="editClipField('start',$event)" /></div>
          <div class="field"><label>Duración (s)</label><input type="number" min="0.05" step="0.05" :value="timelineClip.duration" :disabled="store.locked || store.play.on" @change="editClipField('duration',$event)" /></div>
          <div class="field"><label>Modo</label><span>{{ (selection?.timelineMode || 'mix').toUpperCase() }}</span></div>
          <div class="field"><label>Claves fuente</label><span>{{ timelineClipSource?.from?.t.toFixed(2) }} – {{ timelineClipSource?.to?.t.toFixed(2) }} s</span></div>
          <div class="field"><label>Fragmento origen</label><span>{{ Math.round(timelineClip.in*100) }}% – {{ Math.round(timelineClip.out*100) }}%</span></div>
          <div class="actions"><button type="button" :disabled="store.locked || store.play.on" @click="removeTimelineClip">Eliminar clip sin borrar las claves</button></div>
          </fieldset>
        </template>
        <template v-else-if="part === 'keys'">
          <fieldset class="track-edit-fields" :disabled="multiKeys.some(k=>resource.tracks.find(t=>t.id===k.tr)?.locked)">
          <p class="note" data-test="timeline-multi-inspector">{{ multiKeys.length }} claves seleccionadas en {{ multiTrackCount }} pistas. La selección conserva los IDs de cada clave.</p>
          <div class="field"><label>Primera clave</label><span>{{ multiRange?.start.toFixed(2) }} s</span></div>
          <div class="field"><label>Última clave</label><span>{{ multiRange?.end.toFixed(2) }} s</span></div>
          <div class="field"><label>Desplazar (s)</label><input type="number" step="0.05" value="" placeholder="± segundos" aria-label="Desplazar selección en segundos" @change="shiftMultiKeys" /></div>
          <div class="actions"><button :disabled="store.locked || store.play.on" @click="duplicateMultiKeys">Duplicar selección</button><button class="ghost" :disabled="store.locked || store.play.on" @click="deleteMultiKeys">Eliminar selección</button></div>
          <p class="note">Usa Ctrl+clic, Mayús+clic o Mayús+arrastrar para modificar la selección desde Timeline. Ctrl+Z deshace la edición.</p>
          </fieldset>
        </template>
        <template v-else-if="part === 'key'">
          <fieldset class="track-edit-fields" :disabled="isTimeline && !!track?.locked">
          <p v-if="isTimeline && (track?.clips || []).some(c=>c.from===item?.id || c.to===item?.id)" class="note">Esta clave define la fuente de un clip. Para cambiar su tiempo, elimina primero el clip vinculado.</p>
          <ParamForm :params="keyFields" :values="item" @change="keyChange" />
          <TimelineAudioSource v-if="isTimeline && track.kind === 'audio' && item.action === 'play'" :clip="item.clip" inspector />
          <section v-if="isTimeline && track.kind === 'audio' && item.action === 'play'" class="inspector-audio-volume" aria-label="Automatización de volumen">
            <div class="volume-title">
              <button type="button" class="volume-section-toggle" :aria-expanded="volumeSectionOpen" aria-controls="volume-points-content" @click="volumeSectionOpen = !volumeSectionOpen"><span aria-hidden="true">{{ volumeSectionOpen ? '▾' : '▸' }}</span> Automatización de volumen <span class="volume-count">{{ (item.volumeAutomation || []).length }}</span></button>
              <button type="button" :disabled="store.locked || store.play.on || track.locked || !(item.duration > 0) || (item.volumeAutomation?.length || 0) >= 64" @click="editInspectorVolumePoint('add')">Añadir punto</button>
            </div>
            <div v-if="volumeSectionOpen" id="volume-points-content" class="volume-section-content">
              <p v-if="!(item.duration > 0)" class="note" role="status">Duración requerida</p>
              <div class="volume-point-list" :class="{'volume-point-list-scroll': (item.volumeAutomation?.length || 0) >= 5}" aria-label="Puntos de volumen">
                <div v-for="(point, index) in visualVolumePoints" :key="point.id" class="volume-point-row">
                  <div class="volume-point-heading">
                    <button type="button" class="volume-point-toggle" :aria-expanded="volumePointExpanded(point.id)" :aria-controls="'volume-point-'+point.id" @click="toggleVolumePoint(point.id)"><span aria-hidden="true">{{ volumePointExpanded(point.id) ? '▾' : '▸' }}</span> <span class="volume-point-name">{{ volumePointLabel(point, index) }}</span></button>
                    <button type="button" class="volume-point-delete" :disabled="store.locked || store.play.on || track.locked" :aria-label="'Eliminar punto '+point.id" :title="'Eliminar '+volumePointLabel(point, index)" @click.stop="editInspectorVolumePoint('remove',point)"><Icon name="bi-trash" :size="14" /></button>
                  </div>
                  <div v-if="volumePointExpanded(point.id)" :id="'volume-point-'+point.id" class="volume-point-fields">
                    <label>Nombre <input type="text" maxlength="48" :value="volumePointLabel(point, index)" :disabled="store.locked || store.play.on || track.locked" @change="editInspectorVolumePoint('rename',point,'name',$event)" /></label>
                    <label>Tiempo (s) <input type="number" min="0" :max="item.duration" step="0.01" :value="point.t" :disabled="store.locked || store.play.on || track.locked" @change="editInspectorVolumePoint('move',point,'t',$event)" /></label>
                    <label>Factor <input type="number" min="0" max="1" step="0.05" :value="point.value" :disabled="store.locked || store.play.on || track.locked" @change="editInspectorVolumePoint('move',point,'value',$event)" /></label>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <p v-if="savedClipFx.length" class="note saved-clip-fx" role="status" aria-label="FX guardados en el clip (solo lectura)" data-test="timeline-clip-fx-readonly">
            FX guardados ({{ savedClipFx.length }}) · <span v-for="(fx, index) in savedClipFx" :key="fx.id || index">{{ index ? ' · ' : '' }}{{ FX_TYPES[fx.type]?.label || fx.type }} ({{ fx.on === false ? 'desactivado' : 'activo' }})</span>.
            Se reproducen sin modificaciones; los efectos del bus se editan en Audio Mixer.
          </p>
          <template v-if="isTimeline && track.kind === 'method'">
            <p v-if="!timelineNode" class="note">Nodo receptor ausente. Selecciona la pista y asigna un nodo existente.</p>
            <div class="field"><label>Método</label><input :value="item.method" :list="'lf-methods-' + track.id" placeholder="Método expuesto con node.expose()" @change="methodNameChange($event.target.value)" />
              <datalist :id="'lf-methods-' + track.id"><option v-for="m in methodInfo.methods.filter(m => !m.duplicate && !m.reserved)" :key="m.name" :value="m.name" /></datalist>
            </div>
            <p v-if="methodNameError" class="note error">{{ methodNameError }}</p>
            <p v-if="methodInfo.methods.some(m => m.name === item.method && (m.duplicate || m.reserved))" class="note error">Método ambiguo o reservado: no puede ejecutarse.</p>
            <p v-else-if="item.method && !methodInfo.methods.some(m => m.name === item.method)" class="note">No detectado estáticamente. Solo funcionará si node.expose() lo registra en Play.</p>
            <p v-if="methodInfo.diagnostics.length" class="note">{{ methodInfo.diagnostics.map(d => d.detail).join(' · ') }}</p>
            <div class="method-args"><label>Argumentos (lista JSON)</label><textarea :value="methodArgsDraft" rows="3" spellcheck="false" @change="methodArgsChange($event.target.value)"></textarea></div>
            <p v-if="methodArgsError" class="note error">{{ methodArgsError }}</p>
            <p class="note">Solo Play/Player ejecuta esta clave. Mover el cabezal no llama al método.</p>
          </template>
          <section v-if="isTimeline && track.kind==='node' && ['cubic','cubic-angle'].includes(track.interpolation)" class="inspector-tangents" aria-label="Tangentes cúbicas de la clave">
            <p class="note">Tangentes por canal (unidades/segundo). Vacío = automático; se usa el mismo Hermite del Player.</p>
            <div v-for="side in ['in','out']" :key="side" class="tangent-side" v-show="side==='in' ? track.keys.indexOf(item)>0 : track.keys.indexOf(item)<track.keys.length-1">
              <div class="tangent-heading"><b>{{ side==='in'?'Entrada':'Salida' }}</b><button class="ghost" type="button" :disabled="track.locked" @click="inspectorTangentAuto(side)">Automático</button></div>
              <div class="tangent-values"><label v-for="axis in 3" :key="axis">{{ ['X','Y','Z'][axis-1] }} <input type="number" step="0.1" :disabled="track.locked" :value="(side==='in'?item.tanIn:item.tanOut)?.[axis-1] ?? ''" placeholder="Auto" :aria-label="'Tangente '+side+' '+['X','Y','Z'][axis-1]" @change="inspectorTangentChange(side,axis-1,$event.target.value)" /></label></div>
            </div>
          </section>
          <template v-if="item.ease === 'bezier' && (!isTimeline || ['camera', 'node'].includes(track.kind) && !track.interpolation)">
            <svg class="curve" viewBox="0 0 100 100" aria-label="Curva Bézier"><polyline :points="bezierPath" fill="none" stroke="#4aa3ff" stroke-width="2" /><line x1="0" y1="85" x2="100" y2="85" stroke="#666" stroke-width=".6" /><line x1="0" y1="15" x2="100" y2="15" stroke="#666" stroke-width=".6" /></svg>
            <div class="bezier"><input v-for="i in 4" :key="i" type="number" step="0.05" :value="item.bz?.[i - 1]" :aria-label="'Control Bézier ' + i" @change="curveChange(i - 1, $event.target.value)" /></div>
            <div class="presets"><button v-for="(p, i) in BEZIER_PRESETS" :key="p[0]" @click="item.bz = [...p[1]]; changed('Curva')">{{ isTimeline ? (['Smooth', 'Fast Start', 'Slow Start', 'Anticipation'][i] || p[0]) : p[0] }}</button></div>
          </template>
          <div class="actions">
            <button v-if="isTimeline && (track.kind === 'node' || track.kind === 'camera' && item.mode !== 'camera3d')" @click="timelineCapture">{{ track.kind === 'camera' ? 'Capturar vista del editor' : 'Tomar valor del nodo' }}</button>
            <button v-if="isTimeline && track.kind === 'camera' && item.mode === 'free'" @click="goToView">Ir a esta vista</button>
            <button v-if="!isTimeline" @click="animCurrentValue">Tomar valor del nodo</button>
            <button @click="seek">Ir al cabezal</button>
            <template v-if="isTimeline && track.kind === 'commands'">
              <button class="primary" @click="commands">Editar comandos… ({{ item.list?.length || 0 }})</button>
            </template>
            <button @click="duplicateKey">Duplicar clave</button>
            <button class="ghost" @click="deleteSelected">Eliminar clave</button>
          </div>
          <ul v-if="commandSummaries.length" class="command-list"><li v-for="(line, i) in commandSummaries" :key="i">{{ line }}</li></ul>
          </fieldset>
        </template>
        <template v-else-if="part === 'event'">
          <div class="field"><label>Nombre</label><input :value="item.name" @change="eventChange('name', $event.target.value)" /></div>
          <div class="field"><label>Tiempo (s)</label><input type="number" min="0" step="0.05" :value="item.t" @change="eventChange('t', $event.target.value)" /></div>
          <div class="actions"><button class="primary" @click="commands">Editar comandos… ({{ item.list?.length || 0 }})</button><button @click="seek">Ir al cabezal</button><button class="ghost" @click="deleteSelected">Eliminar evento</button></div>
          <p class="note">El evento se emite durante la reproducción del clip.</p>
        </template>
      </div>
    </section>
  </div>
  <div v-else class="temporal-inspector missing">El recurso seleccionado ya no existe.</div>
</template>

<style scoped>
.track-edit-fields { border:0;padding:0;margin:0;min-width:0; }
.track-edit-fields:disabled { opacity:.75; }

.temporal-inspector { min-width: 0; padding: 8px 10px 16px; font-size: 12px; }
.sect { min-width: 0; border: 1px solid var(--hair); border-radius: 5px; overflow: hidden; }
.sect > header { min-height: 28px; height: auto; padding: 5px 9px 5px 22px; font-weight: 600; background: var(--g-800); border-bottom: 1px solid var(--hair); }
.body { min-width: 0; padding: 9px; }
.identity { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: baseline; min-width: 0; margin-bottom: 10px; }
.identity b { overflow-wrap: anywhere; min-width: 0; }
.identity small, .note { color: var(--text-3); }
.error { color: var(--danger, #ec7373); }
.method-args { display: grid; gap: 5px; margin-top: 9px; }
.method-args textarea { width: 100%; min-width: 0; max-width: 100%; resize: vertical; font: 11px/1.45 monospace; }
.note { font-size: 11px; line-height: 1.5; margin: 10px 0 0; overflow-wrap: anywhere; }
.field { display: grid; grid-template-columns: minmax(0, 105px) minmax(0, 1fr); gap: 8px; align-items: center; margin: 6px 0; }
.field label { color: var(--text-3); overflow-wrap: anywhere; }
.field input:not([type=checkbox]), .field select { width: 100%; min-width: 0; }
.actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.actions button { max-width: 100%; white-space: normal; text-align: left; }
.curve { display: block; width: 100%; max-height: 130px; background: var(--g-900); margin-top: 9px; }
.bezier { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; margin-top: 6px; }
.bezier input { width: 100%; min-width: 0; }
.presets { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.command-list { color: var(--text-2); overflow-wrap: anywhere; padding-left: 18px; }
.missing { padding: 14px; color: var(--text-3); }
@container insp (max-width: 260px) { .field { grid-template-columns: minmax(0, 1fr); gap: 3px; } }

.inspector-tangents {padding:7px 0;border-top:1px solid var(--hair);margin-top:8px;}
.tangent-heading {display:flex;align-items:center;gap:8px;justify-content:space-between;font-size:11px;color:var(--text-2);}
.tangent-heading button {font-size:10px;height:23px;}
.tangent-values {display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;padding:5px 0;}
.tangent-values label {display:flex;gap:4px;align-items:center;font-size:10px;min-width:0;}
.tangent-values input {min-width:0;width:100%;height:25px;font-size:10px;}
.inspector-audio-volume {padding:12px 0 8px;border-top:1px solid var(--hair);display:grid;gap:8px;min-width:0;}
.volume-title {display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0;border-bottom:1px solid var(--hair);padding:0 0 7px;}
.volume-title > button:last-child {flex:none;white-space:nowrap;margin-left:auto;}
.volume-section-toggle,.volume-point-toggle {display:flex;align-items:center;gap:6px;min-width:0;border:0;background:transparent;color:var(--text);font-size:11px;text-align:left;cursor:pointer;padding:5px 2px;}
.volume-section-toggle {flex:1 1 auto;font-weight:600;justify-content:flex-start;text-align:left;min-width:0;}
.volume-section-toggle span:first-child,.volume-point-toggle span:first-child {font-size:13px;flex:none;}
.volume-count {color:var(--text-3);font-weight:400;}
.volume-section-content,.volume-point-list {display:grid;gap:4px;min-width:0;}
.volume-point-list-scroll {max-height:144px;overflow-y:auto;overscroll-behavior:contain;align-content:start;}
.volume-point-row {display:grid;min-width:0;border:1px solid var(--hair);border-radius:4px;}
.volume-point-heading {display:flex;align-items:center;justify-content:space-between;gap:5px;min-width:0;width:100%;}
.volume-point-delete {flex:none;display:grid;place-items:center;width:28px;min-width:28px;height:26px;padding:0;margin-right:3px;border:1px solid transparent;background:transparent;color:var(--text-3);}
.volume-point-delete:hover:not(:disabled) {color:var(--danger,#e77);background:var(--g-800);border-color:var(--hair);}
.volume-point-name {min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.volume-point-toggle {flex:1 1 auto;width:auto;min-width:0;padding:6px 7px;justify-content:flex-start;text-align:left;}
.volume-point-fields {display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:7px;padding:9px 10px 10px;border-top:1px solid var(--hair);}
.volume-point-fields label {display:grid;gap:3px;font-size:10px;min-width:0;}
.volume-point-fields label:first-child {grid-column:1/-1;}
.volume-point-fields input {width:100%;min-width:0;box-sizing:border-box;height:25px;font-size:11px;}

.volume-section-toggle:focus-visible,.volume-point-toggle:focus-visible,.volume-point-delete:focus-visible {outline:2px solid var(--blue);outline-offset:1px;}
</style>
