<script setup>
// Timeline multipista de Nether Film Maker (como Premiere / DaVinci): Planos (cámara), Actor, Texto, Efectos y pistas de Audio.
//  · Arrastra un clip para moverlo (los planos se reordenan; texto, efectos y audio se colocan en el tiempo, el audio también entre pistas).
//  · Arrastra sus bordes para recortarlo. Los clips de audio tienen tiradores de fundido de entrada y salida en las esquinas.
//  · El rombo al principio de cada plano es su transición (corte, fundido a negro o a blanco).
//  · Arrastra un audio desde Assets a una pista (o al hueco de abajo para crear una pista nueva).
//  · Teclas (con el timeline enfocado): Espacio reproduce · S divide en el cabezal · Supr borra · +/− zoom.
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { store, toast, selectObject } from '../core/store.js'
import { timelineRulerTicks } from '../core/timeline/model.js'
import { EASES, BEZIER_PRESETS } from '../engine/runtime/anim/model.js'
import { AUDIO_EXT } from '../engine/runtime/audio/config.js'
import { LAYER_KINDS } from '../core/capture/format.js'
import * as M from './montage.js'
import * as F from './session.js'
import { filmNodeAnimationAllowed } from './node-tracks.js'
import FilmGlyph from './FilmGlyph.vue'

const props = defineProps({ compact: Boolean, inspectorTarget: { default: null } })
const emit = defineEmits(['inspect-clip'])
const { session } = F
const film = computed(() => session.film)
const nodeTracks = computed(() => film.value?.edit.nodeTracks || [])
const physicsBakes = computed(() => film.value?.edit.physicsBakes || [])
const displayBakes = computed(() => session.physics.state==='simulated' && F.physicsDraft()?[F.physicsDraft()]:physicsBakes.value)
const physicalStatus = computed(() => session.physics.state==='simulated'?'preview':F.physicsBakeStatus())
const physicsSeconds = ref(3)
const activeNode = computed(() => store.selectedId)
const activeName = computed(() => store.project?.objects?.find(o=>o.id===activeNode.value)?.name || 'Sin nodo')
const nodeChooser = ref(false)
const nodeFilter = ref('')
const nodeButton = ref(null), nodePicker = ref(null), nodeFilterInput = ref(null)
const nodePickerStyle = ref({})
const addChooser = ref(false), addButton = ref(null), addPicker = ref(null)
const addPickerStyle = ref({})
/** Los menús se colocan en el body: el dock y la Timeline recortan su overflow. */
function popupPosition(anchor, wantedWidth = 340, wantedHeight = 340) {
  if (!anchor?.value) return {}
  const rect = anchor.value.getBoundingClientRect()
  const width = Math.min(wantedWidth, Math.max(180, window.innerWidth - 24))
  const height = Math.min(wantedHeight, Math.max(120, window.innerHeight - 24))
  const below = window.innerHeight - rect.bottom
  const top = below >= Math.min(260, height) ? rect.bottom + 5 : Math.max(12, rect.top - height - 5)
  return { position: 'fixed', width: `${width}px`, top: `${Math.round(top)}px`,
    left: `${Math.round(Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)))}px`,
    maxHeight: `${height}px` }
}
function positionNodePicker() {
  nodePickerStyle.value = popupPosition(nodeButton)
}
function positionAddPicker() { addPickerStyle.value = popupPosition(addButton, 300, 390) }
function openAddMenu() {
  if (!film.value) { toast('Abre un recurso Cinematic antes de añadir pistas', 'error'); return false }
  if (session.playing || session.rec.state !== 'idle' || session.pass.state !== 'idle') {
    toast('Detén la grabación o reproducción para añadir pistas', 'error'); return false
  }
  nodeChooser.value = false
  if (session.montage.on) F.stopMontage()
  positionAddPicker(); addChooser.value = true
  return true
}
function toggleAddMenu() { if (addChooser.value) addChooser.value = false; else openAddMenu() }
function openNodePickerFromMenu() {
  addChooser.value = false
  addSelectedNode()
}
function closeAddMenu() { addChooser.value = false }
function closeNodePickerOutside(e) {
  if (nodeChooser.value && !nodePicker.value?.contains(e.target) && !nodeButton.value?.contains(e.target)) nodeChooser.value = false
  if (addChooser.value && !addPicker.value?.contains(e.target) && !addButton.value?.contains(e.target)) addChooser.value = false
}
function refreshNodePickerPosition() {
  if (nodeChooser.value) positionNodePicker()
  if (addChooser.value) positionAddPicker()
}
const closeNodePicker = () => { nodeChooser.value = false }

const eligibleNodes = computed(() => (store.project?.objects || []).filter(o =>
  filmNodeAnimationAllowed(o, session.film?.actor?.objectId) && store.editor?.nodes?.has(o.id)))
const availableNodes = computed(() => eligibleNodes.value.filter(o =>
  !nodeFilter.value || o.name?.toLowerCase().includes(nodeFilter.value.toLowerCase()) || o.id.toLowerCase().includes(nodeFilter.value.toLowerCase())))
const availableFilmCameras = computed(() => (film.value?.cameras || []).filter(c =>
  !nodeFilter.value || c.name?.toLowerCase().includes(nodeFilter.value.toLowerCase()) || c.id.toLowerCase().includes(nodeFilter.value.toLowerCase())))
const propertyLabels = { position:'Posición', rotation:'Rotación', scale:'Escala' }
const author = computed(() => session.author)
const seq = computed(() => (film.value ? M.sequence(film.value) : { items: [], total: 0 }))
const end = computed(() => Math.max(film.value ? M.filmEnd(film.value, seq.value) : 0,session.physics.state==='simulated'?(session.physics.start||0)+(session.physics.duration||0):0))
const pps = ref(70) // misma escala inicial que Timeline de Century
const snap = ref(true)
const sel = ref(null) // { kind: 'shot'|'layer'|'audio'|'track', id }
const head = computed(() => session.montage.T)
const previewPlaying = ref(false)
let previewClock = 0, previewStart = 0
const HEAD_W = computed(() => (props.compact ? 132 : 190))
const LANE = 36
const scroller = ref(null), heads = ref(null), root = ref(null)
const showProperties = ref(false)
const scrollLeft = ref(0), scrollMax = ref(0)
let scrollObserver = null
function syncScroll() {
  const el = scroller.value
  if (!el) return
  scrollLeft.value = el.scrollLeft
  scrollMax.value = Math.max(0, el.scrollWidth - el.clientWidth)
  if (heads.value) heads.value.scrollTop = el.scrollTop
}
function moveTimeScroll(v) {
  if (!scroller.value) return
  scroller.value.scrollLeft = Number(v)
  syncScroll()
}
watch(sel, (item) => {
  showProperties.value = !!item
  if (item) emit('inspect-clip')
})
function closeClipProperties() { showProperties.value = false; sel.value = null }
watch(() => store.selectedId, (id, old) => {
  if (id !== old && sel.value && sel.value.nodeId && sel.value.nodeId !== id) sel.value = null
})
watch(() => session.author.active, active => { if(!active)previewPlaying.value=false })

const width = computed(() => Math.max(600, (end.value + 10) * pps.value))
const x = (t) => t * pps.value
const fmt = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}` }
const ticks = computed(() => timelineRulerTicks(end.value + 10, pps.value))
const textLayers = computed(() => (film.value?.edit.layers || []).filter((l) => l.kind === 'text'))
const hasActor = computed(() => seq.value.items.some(it => it.pass.take >= 0))
const hasTimelineContent = computed(() => !!(seq.value.items.length || film.value?.edit.layers.length || film.value?.edit.audio.length || nodeTracks.value.length || displayBakes.value.length))
const fxLayers = computed(() => (film.value?.edit.layers || []).filter((l) => l.kind !== 'text'))
const audioAssets = computed(() => (store.project?.assets || []).filter((a) => AUDIO_EXT.includes((a.ext || '').toLowerCase())))
const groups = computed(() => store.project?.audio?.groups?.filter((g) => g.id !== 'master') || [])
const selShot = computed(() => (sel.value?.kind === 'shot' ? seq.value.items.find((it) => it.shot.id === sel.value.id) : null))
const selLayer = computed(() => (sel.value?.kind === 'layer' ? film.value.edit.layers.find((l) => l.id === sel.value.id) : null))
const selNode = computed(() => nodeTracks.value.find(tr=>tr.nodeId===sel.value?.nodeId))
const selPart = computed(() => selNode.value?.properties.find(p=>p.prop===sel.value?.prop))
const selKey = computed(() => selPart.value?.keys.find(k=>k.id===sel.value?.id))
const selAudio = computed(() => { if (sel.value?.kind !== 'audio') return null; for (const t of film.value.edit.audio) { const c = t.clips.find((c) => c.id === sel.value.id); if (c) return { t, c } } return null })
const takeName = (it) => (it.pass.take >= 0 ? film.value.takes[it.pass.take]?.name || '' : '')
const filterName = (id) => film.value.edit.filters.find((f) => f.id === id)?.name || ''
const set = (edit) => F.setEdit(edit)

// ---------- cabezal ----------
async function seek(T) { previewPlaying.value = false; T = Math.max(0, Math.min(end.value, T)); if (session.montage.on) await F.seekMontage(T); else { session.montage.T = T; F.previewFilmTime(T) } }
async function togglePlay() {
  // Una película puede animar un nodo aunque todavía no tenga un pase de cámara.
  // Se reutiliza el RAF existente de seguimiento del timeline; sin otro renderer ni Player.
  if (!seq.value.items.length && !film.value?.edit.audio?.some(t => t.clips?.length)) {
    if (previewPlaying.value) { previewPlaying.value=false;return }
    if (!nodeTracks.value.some(tr=>tr.properties.some(p=>p.keys.length)) && !displayBakes.value.length) { toast('Añade un plano, audio o claves antes de reproducir', 'error'); return }
    if (!F.ensureFilmEditMode()) return
    previewStart = head.value >= end.value - .05 ? 0 : head.value
    previewClock = performance.now()
    session.montage.T = previewStart
    F.previewFilmTime(previewStart)
    previewPlaying.value = true
    return
  }
  if (!session.montage.on) await F.playMontage(head.value >= end.value - 0.05 ? 0 : head.value)
  else F.togglePause()
}
function stop() { previewPlaying.value=false;F.stopMontage();F.previewFilmTime(head.value) }

// ---------- imán ----------
function snapPoints(exceptId) {
  const p = [0, head.value]
  for (const it of seq.value.items) if (it.shot.id !== exceptId) p.push(it.start, it.end)
  for (const l of film.value.edit.layers) if (l.id !== exceptId) p.push(l.t0, l.t1)
  for (const t of film.value.edit.audio) for (const c of t.clips) if (c.id !== exceptId) p.push(c.start, c.start + c.dur)
  return p
}
function snapT(t, exceptId) {
  if (!snap.value) return t
  let best = t, bd = 8 / pps.value
  for (const p of snapPoints(exceptId)) { const d = Math.abs(p - t); if (d < bd) { bd = d; best = p } }
  return best
}

// ---------- arrastrar (ratón y dedo) ----------
let drag = null
const ghost = ref(null) // plano que se está arrastrando (para verlo moverse)
function startDrag(e, d) {
  e.stopPropagation(); e.preventDefault()
  root.value?.focus()
  if (e.button !== 0) return
  drag = { ...d, x0: e.clientX, y0: e.clientY, moved: false }
  window.addEventListener('pointermove', onDrag); window.addEventListener('pointerup', endDrag, { once: true })
}
const dtOf = (e) => (e.clientX - drag.x0) / pps.value
function onDrag(e) {
  if (!drag) return
  if (Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) > 3) drag.moved = true
  if (!drag.moved) return
  const dt = dtOf(e), f = film.value
  if (drag.kind === 'ruler') { session.montage.T = Math.max(0, Math.min(end.value, drag.t0 + dt)); F.previewFilmTime(session.montage.T); return }
  if (drag.kind === 'node-key') { ghost.value = { id:drag.id,t:Math.max(0,snapT(drag.t0+dt,drag.id)) };return }
  if (drag.kind === 'shot-move') { drag.ghost = drag.start + dt; ghost.value = { id: drag.id, start: Math.max(0, drag.ghost) }; return }
  if (drag.kind === 'shot-in') { set(M.updateShot(f, drag.id, { in: Math.max(0, Math.min(drag.out - 0.1, drag.in + dt)) })); return }
  if (drag.kind === 'shot-out') { editShotOut(drag.id, Math.max(drag.in + 0.1, drag.out + dt)); return }
  if (drag.kind === 'layer-move') { const t0 = Math.max(0, snapT(drag.t0 + dt, drag.id)); set(M.updateLayer(f, drag.id, { t0, t1: t0 + (drag.t1 - drag.t0) })); return }
  if (drag.kind === 'layer-a') { set(M.updateLayer(f, drag.id, { t0: Math.min(drag.t1 - 0.05, Math.max(0, snapT(drag.t0 + dt, drag.id))) })); return }
  if (drag.kind === 'layer-b') { set(M.updateLayer(f, drag.id, { t1: Math.max(drag.t0 + 0.05, snapT(drag.t1 + dt, drag.id)) })); return }
  if (drag.kind === 'audio-move') {
    const start = Math.max(0, snapT(drag.start + dt, drag.id))
    const lane = laneAt(e.clientY)
    set(lane && lane !== drag.track ? M.moveAudioClip(f, drag.id, lane, start) : M.updateAudioClip(f, drag.id, { start }))
    if (lane) drag.track = lane
    return
  }
  if (drag.kind === 'audio-a') { // borde izquierdo: mueve el inicio y recorta el principio del archivo
    let d = snapT(drag.start + dt, drag.id) - drag.start
    d = Math.max(-drag.in, Math.min(drag.dur - 0.05, d))
    set(M.updateAudioClip(f, drag.id, { start: drag.start + d, in: drag.in + d, dur: drag.dur - d })); return
  }
  if (drag.kind === 'audio-b') { set(M.updateAudioClip(f, drag.id, { dur: Math.max(0.05, snapT(drag.start + drag.dur + dt, drag.id) - drag.start) })); return }
  if (drag.kind === 'fade-in') { set(M.updateAudioClip(f, drag.id, { fadeIn: Math.max(0, drag.fadeIn + dt) })); return }
  if (drag.kind === 'fade-out') { set(M.updateAudioClip(f, drag.id, { fadeOut: Math.max(0, drag.fadeOut - dt) })); return }
}
function endDrag(e) {
  window.removeEventListener('pointermove', onDrag)
  const d = drag, keyTarget = ghost.value?.t; drag = null; ghost.value = null
  if (!d) return
  if (d.kind === 'ruler') { seek(d.moved ? head.value : d.t0 + 0); return }
  if (d.kind === 'node-key' && d.moved) { try { F.moveFilmKey(d.nodeId,d.prop,d.id,keyTarget ?? Math.max(0,d.t0+(e.clientX-d.x0)/pps.value)) } catch(err){ toast(err.message,'error') } return }
  if (d.kind === 'shot-move' && d.moved) {
    // nueva posición: delante del primer plano cuyo centro queda a la derecha del clip arrastrado
    const center = (d.ghost ?? d.start) + d.dur / 2
    const others = seq.value.items.filter((it) => it.shot.id !== d.id)
    const idx = others.findIndex((it) => it.start + it.dur / 2 > center)
    set(M.reorderShot(film.value, d.id, idx < 0 ? others.length : idx))
  }
}
function laneAt(clientY) {
  for (const el of root.value?.querySelectorAll('[data-audio-lane]') || []) { const r = el.getBoundingClientRect(); if (clientY >= r.top && clientY <= r.bottom) return el.dataset.audioLane }
  return null
}
function rulerDown(e) {
  previewPlaying.value=false
  const r = e.currentTarget.getBoundingClientRect()
  const t = (e.clientX - r.left) / pps.value
  session.montage.T = Math.max(0, Math.min(end.value, t));F.previewFilmTime(session.montage.T)
  startDrag(e, { kind: 'ruler', t0: session.montage.T })
}
const shotDown = (e, it) => { if (session.montage.on || session.playing) return; sel.value = { kind: 'shot', id: it.shot.id }; startDrag(e, { kind: 'shot-move', id: it.shot.id, start: it.start, dur: it.dur }) }
const shotEdge = (e, it, side) => { if (session.montage.on || session.playing) return; sel.value = { kind: 'shot', id: it.shot.id }; startDrag(e, { kind: side === 'a' ? 'shot-in' : 'shot-out', id: it.shot.id, in: it.shot.in, out: it.shot.out, len: it.pass.duration }) }
const layerDown = (e, l, kind = 'layer-move') => { sel.value = { kind: 'layer', id: l.id }; startDrag(e, { kind, id: l.id, t0: l.t0, t1: l.t1 }) }
const audioDown = (e, t, c, kind = 'audio-move') => { sel.value = { kind: 'audio', id: c.id }; startDrag(e, { kind, id: c.id, track: t.id, start: c.start, in: c.in, dur: c.dur, fadeIn: c.fadeIn, fadeOut: c.fadeOut }) }

// ---------- pistas dinámicas de nodos (el rig de gameplay no participa) ----------
const nodeFor=(id)=>store.project?.objects?.find(o=>o.id===id)
function selectNodeTrack(tr){if(nodeFor(tr.nodeId))selectObject(tr.nodeId);sel.value={kind:'nodetrack',nodeId:tr.nodeId}}
function prepareNodeEdit() {
  if (!film.value || session.playing || session.rec.state !== 'idle' || session.pass.state !== 'idle') return false
  if (session.montage.on) F.stopMontage()
  return F.ensureFilmEditMode()
}
function addNodeById(nodeId) {
  if (!prepareNodeEdit()) { toast('Detén la grabación o reproducción antes de editar', 'error'); return false }
  if (!eligibleNodes.value.some(o => o.id === nodeId)) {
    toast('Este nodo no admite pistas de Transform (actor, física o Node sin Transform)', 'error'); return false
  }
  if (film.value?.edit.nodeTracks.some(tr => tr.nodeId === nodeId) || F.addFilmNode(nodeId)) {
    sel.value = { kind: 'nodetrack', nodeId }; nodeChooser.value = false
    return true
  }
  return false
}
function addSelectedNode() {
  if (!film.value) { toast('Abre un recurso Cinematic antes de añadir nodos', 'error'); return false }
  if (session.playing || session.rec.state !== 'idle' || session.pass.state !== 'idle') {
    toast('Detén la grabación o reproducción para añadir nodos', 'error'); return false
  }
  if (session.montage.on) F.stopMontage()
  addChooser.value = false
  if (nodeChooser.value) { closeNodePicker(); return true }
  nodeFilter.value = ''
  positionNodePicker()
  nodeChooser.value = true
  nextTick(() => nodeFilterInput.value?.focus())
  return true
}
function addNodeProperty(nodeId,prop) { try{F.addFilmNodeProperty(nodeId,prop);sel.value={kind:'nodepart',nodeId,prop}}catch(e){toast(e.message,'error')} }

// El arrastre usa exactamente el MIME publicado por Jerarquía y el menú contextual del editor.
const NODE_DRAG_TYPE = 'application/x-lf-node'
const CAMERA_DRAG_TYPE = 'application/x-lf-film-camera'
function nodeDragOver(e) {
  if (!film.value || session.playing || session.rec.state !== 'idle' || session.pass.state !== 'idle') return
  const types = Array.from(e.dataTransfer?.types || [])
  if (!types.includes(NODE_DRAG_TYPE) && !types.includes(CAMERA_DRAG_TYPE)) return
  e.preventDefault(); e.dataTransfer.dropEffect = 'copy'
}
function nodeDrop(e) {
  if (!film.value || session.playing || session.rec.state !== 'idle' || session.pass.state !== 'idle') return
  const types = Array.from(e.dataTransfer?.types || [])
  if (!types.includes(NODE_DRAG_TYPE) && !types.includes(CAMERA_DRAG_TYPE)) return
  e.preventDefault(); e.stopPropagation()
  if (types.includes(CAMERA_DRAG_TYPE)) { if (session.montage.on) F.stopMontage(); addEditorialShot(e.dataTransfer.getData(CAMERA_DRAG_TYPE)); return }
  if (!prepareNodeEdit()) { toast('Detén la reproducción antes de añadir nodos', 'error'); return }
  let ids
  try { ids = JSON.parse(e.dataTransfer.getData(NODE_DRAG_TYPE)) } catch { toast('Arrastre de nodo inválido', 'error'); return }
  if (!Array.isArray(ids) || !ids.length || !ids.every(id => typeof id === 'string')) { toast('Arrastra nodos válidos de Jerarquía', 'error'); return }
  const unique = [...new Set(ids)]
  const rejected = unique.filter(id => !eligibleNodes.value.some(o => o.id === id))
  if (rejected.length) { toast(`${rejected.length} nodo(s) no animables: actor, física o Node sin Transform`, 'error'); return }
  if (unique.length > 1) { unique.forEach(id => addNodeById(id)); return }
  const node = nodeFor(unique[0])
  if (!node) { toast('El nodo no pertenece a la escena actual', 'error'); return }
  store.menu = { x: e.clientX, y: e.clientY, items: [
    { heading: `Animar «${node.name}»` },
    { label: 'Añadir pista de nodo', icon: 'event', run: () => addNodeById(node.id) },
    ...Object.entries(propertyLabels).map(([prop, label]) => ({ label: `Animar ${label}`, icon: 'event', run: () => {
      if (addNodeById(node.id)) addNodeProperty(node.id, prop)
    } })),
  ] }
}
function duplicateSelection() {
  const current = sel.value; if (!current) return
  if (current.kind === 'nodekey') {
    if (!F.ensureFilmEditMode() || !selKey.value) { toast('Detén la reproducción para duplicar claves', 'error'); return }
    const key = selKey.value, part = selPart.value
    const next = Math.round((key.t + .5) * 1e5) / 1e5
    if (part.keys.some(k => Math.abs(k.t - next) < 1e-5)) { toast('Ya existe una clave en ese instante', 'error'); return }
    if (F.addFilmKey(current.nodeId, current.prop, next, [...key.v], key.ease, key.bz)) {
      const created = film.value.edit.nodeTracks.find(t => t.nodeId === current.nodeId)?.properties.find(p => p.prop === current.prop)?.keys.find(k => Math.abs(k.t - next) < 1e-5)
      if (created) sel.value = { ...current, id: created.id }
    }
    return
  }
  const result = current.kind === 'shot' ? M.duplicateShot(film.value, current.id)
    : current.kind === 'layer' ? M.duplicateLayer(film.value, current.id)
    : current.kind === 'audio' ? M.duplicateAudioClip(film.value, current.id) : null
  if (result?.id) { set(result.edit); sel.value = { ...current, id: result.id } }
}
function contextMenu(e, item) {
  e.preventDefault(); e.stopPropagation(); sel.value = item
  const title = item.kind === 'nodekey' ? 'Clave' : item.kind === 'nodetrack' ? 'Nodo' : item.kind === 'nodepart' ? 'Propiedad'
    : item.kind === 'shot' ? 'Plano' : item.kind === 'layer' ? 'Capa' : item.kind === 'audio' ? 'Audio' : item.kind === 'track' ? 'Pista de audio' : 'Timeline'
  const items = [{ heading: title }]
  if (item.kind === 'empty') items.push({ label: 'Añadir texto', icon: 'event', run: addText }, { label: 'Añadir efecto', icon: 'event', run: addEffect }, { label: 'Añadir pista de audio', icon: 'event', run: addTrack })
  if (item.kind === 'nodekey') {
    items.push({ label: 'Ir al cabezal', icon: 'pin', run: () => { if (selKey.value) void seek(selKey.value.t) } })
    items.push(...EASES.map(([ease, label]) => ({ label: `Interpolación · ${label}`, icon: 'event', run: () => {
      if (F.ensureFilmEditMode()) F.editFilmKey(item.nodeId, item.prop, item.id, undefined, ease)
      else toast('Detén la reproducción para editar claves', 'error')
    } })))
  }
  if (['nodekey', 'shot', 'layer', 'audio'].includes(item.kind)) {
    items.push({ sep: true }, { label: 'Duplicar', icon: 'copy', run: duplicateSelection }, { label: 'Eliminar', icon: 'trash', danger: true, run: remove })
  } else if (item.kind === 'track') items.push({ label: 'Eliminar pista', icon: 'trash', danger: true, run: () => { set(M.removeAudioTrack(film.value, item.id)); sel.value = null } })
  else if (item.kind === 'nodetrack') items.push({ label: 'Eliminar pista', icon: 'trash', danger: true, run: eraseNodeSelection })
  else if (item.kind === 'nodepart') items.push({ label: 'Añadir clave en el cabezal', icon: 'event', run: () => insertNodeKey(item.nodeId, item.prop) })
  store.menu = { x: e.clientX, y: e.clientY, items }
}
function fitTime() {
  const available = scroller.value?.clientWidth || 600
  pps.value = Math.max(8, Math.min(400, (available - 38) / Math.max(1, end.value + 1)))
  moveTimeScroll(0)
}

function keyValue(nodeId,prop) {
  const node=store.editor?.nodes?.get(nodeId)
  const obj=nodeFor(nodeId)
  if(!node || !obj) throw new Error('El nodo no está disponible')
  if(prop==='position')return node.position.toArray()
  if(prop==='rotation')return [node.rotation.x,node.rotation.y,node.rotation.z].map(v=>v*180/Math.PI)
  return (node.userData?.visual?.scale||node.scale).toArray()
}
function insertNodeKey(nodeId,prop) {
  try{if(!F.ensureFilmEditMode())throw new Error('Detén la reproducción');
    if(F.addFilmKey(nodeId,prop,head.value,keyValue(nodeId,prop)))sel.value={kind:'nodepart',nodeId,prop}
  }catch(e){toast(e.message,'error')}
}
function nodeKeyDown(e,tr,part,k){sel.value={kind:'nodekey',nodeId:tr.nodeId,prop:part.prop,id:k.id};startDrag(e,{kind:'node-key',nodeId:tr.nodeId,prop:part.prop,id:k.id,t0:k.t})}
function updateKeyTime(e){try{F.moveFilmKey(sel.value.nodeId,sel.value.prop,sel.value.id,+e.target.value)}catch(err){toast(err.message,'error');e.target.value=selKey.value?.t??0}}
function updateKeyVector(axis,e){try{const v=[...selKey.value.v];v[axis]=Number(e.target.value);F.editFilmKey(sel.value.nodeId,sel.value.prop,sel.value.id,v)}catch(err){toast(err.message,'error');e.target.value=selKey.value?.v?.[axis]??0}}
function eraseNodeSelection(){
  const s=sel.value;if(!s)return
  if(s.kind==='nodekey')F.removeFilmKey(s.nodeId,s.prop,s.id)
  else if(s.kind==='nodetrack')F.removeFilmNode(s.nodeId)
  else return
  sel.value=null
}
// ---------- añadir ----------
const addPass = ref(''), addAsset = ref(''), addFx = ref('fade')
function addEditorialShot(cameraId = film.value?.activeCameraId) {
  if (session.montage.on) F.stopMontage()
  try {
    const result = F.createFilmEditorialShot(cameraId, 5)
    sel.value = { kind: 'shot', id: result.shotId }
  } catch (err) { toast(err.message || String(err), 'error') }
}
function editShotOut(shotId, out) {
  try {
    const item = seq.value.items.find(it => it.shot.id === shotId)
    if (item?.pass.input === 'editor') F.resizeFilmEditorialShot(shotId, out)
    else set(M.updateShot(film.value, shotId, { out: Math.min(item?.pass.duration || out, out) }))
  } catch (err) { toast(err.message || String(err), 'error') }
}
function addShot(e) { const id = e?.target?.value || addPass.value; if (!id) return; set(M.addShot(film.value, id)); addPass.value = ''; if (e?.target) e.target.value = '' }
function addText() { const r = M.addLayer(film.value, 'text', head.value, 3); set(r.edit); sel.value = { kind: 'layer', id: r.id } }
function addEffect() { const r = M.addLayer(film.value, addFx.value, head.value, addFx.value === 'letterbox' ? Math.max(2, seq.value.total - head.value) : 1.5); set(r.edit); sel.value = { kind: 'layer', id: r.id } }
function addTrack() { set(M.addAudioTrack(film.value, '', groups.value.find((g) => g.id === 'music')?.id || groups.value[0]?.id || 'music').edit) }
async function placeAudio(assetId, trackId = null, start = head.value) {
  const a = store.project.assets.find((x) => x.id === assetId)
  if (!a) return
  let f = film.value
  if (!trackId) { const r = M.addAudioTrack(f, a.name.replace(/\.[^.]+$/, ''), groups.value.find((g) => g.id === 'music')?.id || 'music'); set(r.edit); trackId = r.id; f = session.film }
  const dur = await F.assetDuration(a.id)
  const r = M.addAudioClip(session.film, trackId, { id: a.id, name: a.name, duration: dur || 5 }, start)
  set(r.edit); sel.value = { kind: 'audio', id: r.id }
}
function addAudioAtHead(e) { const id = e?.target?.value || addAsset.value; if (id) { placeAudio(id, film.value.edit.audio[0]?.id || null); addAsset.value = ''; if (e?.target) e.target.value = '' } }
// soltar desde Assets
const entryOf = (e) => { try { return JSON.parse(e.dataTransfer.getData('application/x-lf-entry') || 'null') } catch { return null } }
function dropOn(e, trackId) {
  const en = entryOf(e); if (!en) return
  const a = store.project.assets.find((x) => x.id === en.id)
  if (!a || !AUDIO_EXT.includes((a.ext || '').toLowerCase())) { toast('Solo se pueden soltar archivos de audio en las pistas de audio', 'error'); return }
  const r = e.currentTarget.getBoundingClientRect()
  placeAudio(a.id, trackId, Math.max(0, snapT((e.clientX - r.left) / pps.value)))
}

// ---------- editar ----------
function split() {
  const s = sel.value, T = head.value, f = film.value
  if (!s) { toast('Selecciona un clip para dividirlo en el cabezal', 'error'); return }
  if (s.kind === 'shot') { const it = seq.value.items.find((i) => i.shot.id === s.id); if (it && T > it.start && T < it.end) set(M.splitShot(f, s.id, it.in + (T - it.start))) }
  else if (s.kind === 'layer') set(M.splitLayer(f, s.id, T))
  else if (s.kind === 'audio') set(M.splitAudioClip(f, s.id, T))
}
function remove() {
  const s = sel.value, f = film.value; if (!s) return
  if (s.kind === 'shot') set(M.removeShot(f, s.id))
  else if (s.kind === 'layer') set(M.removeLayer(f, s.id))
  else if (s.kind === 'audio') set(M.removeAudioClip(f, s.id))
  else if (s.kind === 'track') set(M.removeAudioTrack(f, s.id))
  else if(s.kind==='nodekey'||s.kind==='nodetrack') {eraseNodeSelection();return}
  sel.value = null
}
function key(e) {
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return
  if ((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)F.redoFilmTrack();else F.undoFilmTrack();return}
  if ((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();F.redoFilmTrack();return}
  if (e.code === 'Space') { e.preventDefault(); togglePlay() }
  else if (e.key === 's' || e.key === 'S') split()
  else if (e.key === 'Delete' || e.key === 'Backspace') remove()
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelection() }
  else if (e.key === 'Home') { e.preventDefault(); void seek(0) }
  else if (e.key === 'End') { e.preventDefault(); void seek(end.value) }
  else if (e.key === '+' || e.key === '=') pps.value = Math.min(400, pps.value * 1.25)
  else if (e.key === '-') pps.value = Math.max(8, pps.value / 1.25)
}
function wheel(e) {
  if (e.ctrlKey || e.metaKey) { e.preventDefault(); pps.value = Math.max(8, Math.min(400, pps.value * (e.deltaY < 0 ? 1.15 : 0.87))) }
  else if (e.shiftKey && scroller.value) { e.preventDefault(); scroller.value.scrollLeft += e.deltaY; syncScroll() }
}
const db = (v) => (v <= 0.0001 ? '−∞' : (20 * Math.log10(v)).toFixed(1))
// el cabezal visible mientras se reproduce
let raf = 0
function follow() {
  if (previewPlaying.value) {
    const T=Math.min(end.value,previewStart+(performance.now()-previewClock)/1000)
    session.montage.T=T
    F.previewFilmTime(T)
    if(T>=end.value)previewPlaying.value=false
  }
  const el = scroller.value
  if (el && (previewPlaying.value || (session.montage.on && !session.paused))) { const px = x(head.value); if (px > el.scrollLeft + el.clientWidth - 40) el.scrollLeft = px - 60 }
  raf = requestAnimationFrame(follow)
}
onMounted(() => {
  raf = requestAnimationFrame(follow)
  scrollObserver = new ResizeObserver(syncScroll)
  if (scroller.value) scrollObserver.observe(scroller.value)
  nextTick(syncScroll)
  window.addEventListener('pointerdown', closeNodePickerOutside)
  window.addEventListener('resize', refreshNodePickerPosition)
  window.addEventListener('scroll', refreshNodePickerPosition, true)
})
watch(width, () => nextTick(syncScroll))
onBeforeUnmount(() => {
  previewPlaying.value=false;cancelAnimationFrame(raf); scrollObserver?.disconnect()
  window.removeEventListener('pointerdown', closeNodePickerOutside)
  window.removeEventListener('resize', refreshNodePickerPosition)
  window.removeEventListener('scroll', refreshNodePickerPosition, true)
})
defineExpose({ placeAudio, sel, showProperties, openAddMenu })
</script>

<template>
  <div ref="root" class="nle" :class="{ compact }" tabindex="0" data-test="nle" @keydown="key" @dragover="nodeDragOver" @drop="nodeDrop">
    <div class="tb">
      <button class="play" :class="{ on: previewPlaying || (session.montage.on && !session.paused) }" data-test="nle-play" title="Reproducir / pausa (Espacio)" @click="togglePlay"><FilmGlyph :name="previewPlaying || (session.montage.on && !session.paused) ? 'pause' : 'play'" /></button>
      <button title="Detener" @click="stop"><FilmGlyph name="stop" /></button>
      <b class="tc" data-test="nle-time">{{ fmt(head) }} <small>/ {{ fmt(end) }}</small></b>
      <span class="sep"></span>
      <button title="Dividir el clip seleccionado en el cabezal (S)" data-test="nle-split" @click="split"><FilmGlyph name="split" /></button>
      <button title="Borrar el clip seleccionado (Supr)" data-test="nle-del" @click="remove"><FilmGlyph name="trash" /></button>
      <button :class="{ on: snap }" title="Imán: los clips se pegan a bordes y al cabezal" @click="snap = !snap"><FilmGlyph name="magnet" /></button>
      <button type="button" data-test="node-autokey" :disabled="session.montage.on || session.playing" :class="{on:author.autoKey}" title="Crear claves automáticamente al soltar el gizmo (desactivado por defecto)" @click="author.autoKey=!author.autoKey">◆ Auto-key</button>
      <button type="button" data-test="film-undo" :disabled="!author.undo" title="Deshacer edición de pistas (Ctrl+Z)" @click="F.undoFilmTrack()">↶</button>
      <button type="button" data-test="film-redo" :disabled="!author.redo" title="Rehacer edición de pistas (Ctrl+Shift+Z)" @click="F.redoFilmTrack()">↷</button>
      <div class="node-chooser-wrap">
        <button ref="nodeButton" type="button" data-test="node-add" :aria-expanded="nodeChooser" aria-controls="film-node-picker" title="Añadir un nodo de escena o cámara de FilmMaker" @click="addSelectedNode">+ Nodo…</button>
        <Teleport to="body">
        <div v-if="nodeChooser" id="film-node-picker" ref="nodePicker" class="node-chooser film-node-picker" :style="nodePickerStyle" data-test="film-node-chooser" @keydown.esc.stop.prevent="closeNodePicker" @pointerdown.stop>
          <label>Seleccionar objeto para la película</label>
          <input ref="nodeFilterInput" v-model="nodeFilter" data-test="film-node-filter" placeholder="Buscar nodo o cámara…" aria-label="Buscar nodo o cámara" />
          <button v-if="activeNode && eligibleNodes.some(o => o.id === activeNode)" data-test="film-add-selected-node" @click="addNodeById(activeNode)">+ Seleccionado: {{ activeName }}</button>
          <div class="node-chooser-list">
            <button v-for="node in availableNodes" :key="node.id" :data-test="'film-add-node-'+node.id" @click="addNodeById(node.id)">{{ node.name || node.id }}<small v-if="film.edit.nodeTracks.some(tr => tr.nodeId===node.id)">Ya tiene pista</small></button>
            <span v-if="availableFilmCameras.length" class="node-chooser-heading">Cámaras de FilmMaker · plano</span>
            <button v-for="cam in availableFilmCameras" :key="cam.id" :data-test="'film-add-camera-'+cam.id" @click="addEditorialShot(cam.id);nodeChooser=false">+ Plano · {{ cam.name || cam.id }}</button>
            <p v-if="!availableNodes.length && !availableFilmCameras.length" class="hint">No hay objetos compatibles con esta búsqueda. Los actores y nodos físicos utilizan su control propio.</p>
          </div>
        </div>
        </Teleport>
      </div>
      <details class="bake-tools" data-test="physics-tools">
        <summary :title="physicalStatus==='stale'?'La simulación requiere un nuevo horneado':'Herramientas de simulación física Jolt'">Física <span v-if="session.physics.state==='running'">{{session.physics.progress}}%</span><span v-else-if="physicalStatus==='stale'" class="bake-error">!</span></summary>
        <div class="bake-menu">
      <label class="bake-duration" title="Duración máxima de la simulación, en segundos">Física
        <input type="number" data-test="physics-duration" min="0.5" max="30" step="0.5" v-model.number="physicsSeconds" :disabled="session.physics.state==='running'" />s
      </label>
      <button type="button" data-test="physics-simulate" :disabled="session.playing || session.montage.on || session.physics.state==='running'" title="Simular cuerpos Jolt en un mundo temporal; no ejecuta scripts" @click="F.simulateFilmPhysics({duration:Math.round(physicsSeconds*60)/60,start:head})">{{ physicsBakes.length ? 'Re-simular' : 'Simular' }}</button>
      <button type="button" data-test="physics-commit" :disabled="session.playing || session.montage.on || session.physics.state!=='simulated'" title="Guardar el resultado en .nfm y Undo/Redo" @click="F.commitFilmPhysicsBake()">Hornear</button>
      <button type="button" data-test="physics-cancel" v-if="session.physics.state==='running'" @click="F.cancelPhysicsSimulation()">Cancelar</button>
      <button type="button" data-test="physics-remove" :disabled="session.playing || session.montage.on || !physicsBakes.length" @click="F.removeFilmPhysicsBake()">Quitar bake</button>
      <span v-if="session.physics.state==='running'" class="bake-status" role="status">{{ session.physics.progress }} %</span>
      <span v-if="session.physics.state==='error'" class="bake-status bake-error" role="alert" :title="session.physics.error">Error de simulación</span>
      <span v-if="physicsBakes.length" class="bake-status" :class="{'bake-error':physicalStatus==='stale'}" :title="physicalStatus==='stale'?'Colisiones o jerarquía cambiadas: rehornear':'Resultado válido y reversible'">{{ physicalStatus==='stale'?'Bake desactualizado':'Bake válido' }}</span>
        </div>
      </details>
      <button title="Alejar (−)" @click="pps = Math.max(8, pps / 1.25)">−</button>
      <button title="Zoom: acercar (+). Para añadir contenido usa + Pista o Shift+A" @click="pps = Math.min(400, pps * 1.25)">Zoom +</button>
      <button data-test="nle-fit-time" title="Ajustar toda la película al ancho visible" @click="fitTime">Ajustar</button>
      <span class="sep"></span>
      <div class="nle-add-menu" data-test="nle-add-menu">
        <button ref="addButton" type="button" class="nle-add-trigger" data-test="nle-add-trigger" :aria-expanded="addChooser" aria-controls="film-add-picker" title="Añadir nodos, planos, texto, efectos o audio (Shift+A)" @click="toggleAddMenu">＋ Pista</button>
        <Teleport to="body">
          <div v-if="addChooser" id="film-add-picker" ref="addPicker" class="nle-add-pop film-add-picker" :style="addPickerStyle" data-test="film-add-picker" role="group" aria-label="Añadir contenido a FilmMaker" @keydown.esc.stop.prevent="closeAddMenu" @pointerdown.stop>
            <strong>Añadir al Cinematic</strong>
            <button type="button" data-test="film-add-node-from-menu" @click="openNodePickerFromMenu">+ Nodo de escena o cámara…</button>
            <select v-model="addPass" data-test="nle-add-pass" title="Añadir plano grabado" @change="addShot($event);closeAddMenu()"><option value="">+ Plano grabado…</option><option v-for="ps in film.passes" :key="ps.id" :value="ps.id">{{ ps.name }}</option></select>
            <button data-test="nle-add-camera-shot" @click="addEditorialShot();closeAddMenu()">+ Plano desde cámara activa</button>
            <button data-test="nle-add-text" @click="addText();closeAddMenu()">+ Texto</button>
            <div class="nle-add-fx"><select v-model="addFx" title="Tipo de efecto"><option v-for="(d, k) in LAYER_KINDS" v-show="k !== 'text'" :key="k" :value="k">{{ d.label }}</option></select><button data-test="nle-add-fx" @click="addEffect();closeAddMenu()">+ Efecto</button></div>
            <select v-model="addAsset" data-test="nle-add-audio" title="Añadir audio en el cabezal" @change="addAudioAtHead($event);closeAddMenu()"><option value="">+ Audio…</option><option v-for="a in audioAssets" :key="a.id" :value="a.id">{{ a.name }}</option></select>
            <button data-test="nle-add-track" @click="addTrack();closeAddMenu()">+ Pista de audio vacía</button>
          </div>
        </Teleport>
      </div>
      <span class="grow"></span>
      <label class="outro" title="Cómo termina la película">Final
        <select :value="film.edit.outro.kind" data-test="nle-outro" @change="set(M.setOutro(film, { kind: $event.target.value }))"><option v-for="(l, k) in M.TRANSITIONS" :key="k" :value="k">{{ l }}</option></select>
      </label>
    </div>

    <div class="body">
      <div ref="heads" class="heads" :style="{ width: HEAD_W + 'px' }">
        <div class="rh"></div>
        <div v-if="seq.items.length" class="h v"><FilmGlyph name="cam" /> Planos</div>
        <div v-if="hasActor" class="h a"><FilmGlyph name="actor" /> Actor</div>
        <div v-if="textLayers.length" class="h t"><FilmGlyph name="text" /> Texto</div>
        <div v-if="fxLayers.length" class="h f"><FilmGlyph name="effects" /> Efectos</div>
        <div v-for="b in displayBakes" :key="b.id" class="h bake-head" :title="b.bodies.length+' cuerpos dinámicos · '+b.duration+' s'" @click="sel={kind:'physics',id:b.id}">
          <span class="n-name">Física · {{ b.bodies.length }} cuerpos</span><span :class="{'bake-error':physicalStatus==='stale'}">{{physicalStatus==='stale'?'!':'✓'}}</span>
        </div>
        <template v-for="tr in nodeTracks" :key="tr.id">
          <div class="h node-head" :class="{selt:sel?.nodeId===tr.nodeId}" @click="selectNodeTrack(tr)" @contextmenu.prevent.stop="contextMenu($event, {kind: 'nodetrack', nodeId: tr.nodeId})">
            <span class="n-name" :title="'ID: '+tr.nodeId">{{ nodeFor(tr.nodeId)?.name||tr.name||'Nodo no disponible' }}</span>
            <button type="button" :class="{on:tr.muted}" title="Silenciar animación sin borrar claves" @click.stop="F.toggleFilmNodeMute(tr.nodeId,!tr.muted)">M</button>
            <button type="button" title="Quitar pista y sus claves" @click.stop="F.removeFilmNode(tr.nodeId);sel=null">×</button>
          </div>
          <div v-for="part in tr.properties" :key="part.id" class="h node-part" :class="{selt:sel?.nodeId===tr.nodeId&&sel?.prop===part.prop}" @click="sel={kind:'nodepart',nodeId:tr.nodeId,prop:part.prop}" @contextmenu.prevent.stop="contextMenu($event, {kind: 'nodepart', nodeId: tr.nodeId, prop: part.prop})">
            <span class="n-name">{{ propertyLabels[part.prop] }}</span>
            <button :disabled="session.playing || session.montage.on" :title="'Crear clave de '+propertyLabels[part.prop]+' en '+fmt(head)" @click.stop="insertNodeKey(tr.nodeId,part.prop)">◆</button>
          </div>
          <div class="h node-addprop" v-if="!session.playing && !session.montage.on">
            <select :value="''" :data-test="'add-property-'+tr.nodeId" @change="addNodeProperty(tr.nodeId,$event.target.value);$event.target.value=''">
              <option value="">+ Propiedad…</option><option v-for="p in Object.keys(propertyLabels).filter(p=>!tr.properties.some(x=>x.prop===p))" :key="p" :value="p">{{ propertyLabels[p] }}</option>
            </select>
          </div>
        </template>
        <div v-for="t in film.edit.audio" :key="t.id" class="h au" :class="{ selt: sel?.kind === 'track' && sel.id === t.id }" @click="sel = { kind: 'track', id: t.id }" @contextmenu.prevent.stop="contextMenu($event, {kind: 'track', id: t.id})">
          <input :value="t.name" :title="t.name" @change="set(M.updateAudioTrack(film, t.id, { name: $event.target.value }))" />
          <button :class="{ on: t.mute }" title="Silenciar pista" @click.stop="set(M.updateAudioTrack(film, t.id, { mute: !t.mute }))">M</button>
          <button :class="{ on: t.solo }" title="Solo esta pista" @click.stop="set(M.updateAudioTrack(film, t.id, { solo: !t.solo }))">S</button>
        </div>
      </div>

      <div ref="scroller" class="scroll" @wheel="wheel" @scroll="syncScroll" aria-label="Pistas y regla temporal">
        <div class="canvas" :style="{ width: width + 'px', '--film-grid-step': pps + 'px' }">
          <div class="ruler" data-test="nle-ruler" @pointerdown="rulerDown">
            <span v-for="t in ticks" :key="t.t" class="tick" :class="{ major: t.major }" :style="{ left: x(t.t) + 'px' }">{{ t.major ? fmt(t.t).slice(0, 5) : '' }}</span>
          </div>
          <!-- planos -->
          <div v-if="seq.items.length" class="lane v">
            <div v-for="(it, i) in seq.items" :key="it.shot.id" class="clip shot" :class="{ sel: sel?.id === it.shot.id, on: session.montage.index === i }"
              :style="{ left: x(ghost?.id === it.shot.id ? ghost.start : it.start) + 'px', width: Math.max(6, x(it.dur)) + 'px', zIndex: ghost?.id === it.shot.id ? 5 : 'auto' }" :data-test="'shot-' + i" @pointerdown="shotDown($event, it)" @contextmenu.prevent.stop="contextMenu($event, {kind: 'shot', id: it.shot.id})">
              <i class="edge a" @pointerdown="shotEdge($event, it, 'a')"></i>
              <span class="nm">{{ i + 1 }}. {{ it.pass.name }}</span><span v-if="it.shot.filter" class="badge">🎨 {{ filterName(it.shot.filter) }}</span>
              <i class="edge b" @pointerdown="shotEdge($event, it, 'b')"></i>
              <b v-if="it.shot.tin.kind !== 'cut'" class="tr" :title="M.TRANSITIONS[it.shot.tin.kind] + ' · ' + it.shot.tin.dur + ' s'" :style="{ width: x(i === 0 ? it.shot.tin.dur : it.shot.tin.dur / 2) + 'px', left: i === 0 ? '0' : -x(it.shot.tin.dur / 2) + 'px' }"></b>
            </div>
            <div v-if="!seq.items.length" class="hint lf-help">Arrastra una cámara de producción o usa «+ Plano desde cámara activa». Grabar es opcional</div>
          </div>
          <div v-if="hasActor" class="lane a">
            <div v-for="it in seq.items.filter((i) => i.pass.take >= 0)" :key="it.shot.id" class="clip actor" :style="{ left: x(it.start) + 'px', width: Math.max(6, x(it.dur)) + 'px' }"><span class="nm">{{ takeName(it) }}</span></div>
          </div>
          <div v-if="textLayers.length" class="lane t">
            <div v-for="l in textLayers" :key="l.id" class="clip text" :class="{ sel: sel?.id === l.id }" :style="{ left: x(l.t0) + 'px', width: Math.max(6, x(l.t1 - l.t0)) + 'px' }" :data-test="'text-' + l.id" @pointerdown="layerDown($event, l)" @contextmenu.prevent.stop="contextMenu($event, {kind: 'layer', id: l.id})">
              <i class="edge a" @pointerdown="layerDown($event, l, 'layer-a')"></i><span class="nm">{{ l.params.text || 'Texto' }}</span><i class="edge b" @pointerdown="layerDown($event, l, 'layer-b')"></i>
            </div>
          </div>
          <div v-if="fxLayers.length" class="lane f">
            <div v-for="l in fxLayers" :key="l.id" class="clip fx" :class="[l.kind, { sel: sel?.id === l.id }]" :style="{ left: x(l.t0) + 'px', width: Math.max(6, x(l.t1 - l.t0)) + 'px' }" @pointerdown="layerDown($event, l)" @contextmenu.prevent.stop="contextMenu($event, {kind: 'layer', id: l.id})">
              <i class="edge a" @pointerdown="layerDown($event, l, 'layer-a')"></i><span class="nm">{{ LAYER_KINDS[l.kind].label }}</span><i class="edge b" @pointerdown="layerDown($event, l, 'layer-b')"></i>
            </div>
          </div>
          <div v-for="b in displayBakes" :key="b.id" class="lane bake-head" :data-test="'physics-bake-'+b.id" @click="sel={kind:'physics',id:b.id}">
            <div class="bake-clip" :class="{'bake-invalid':physicalStatus==='stale'}" :style="{left:x(b.start)+'px',width:Math.max(6,x(b.duration))+'px'}" :title="'Jolt · '+b.bodies.length+' cuerpos · '+b.duration+' s · '+(physicalStatus==='stale'?'REHORNEAR':'bake válido')">Simulación Jolt · {{b.bodies.length}} cuerpos</div>
          </div>
          <template v-for="tr in nodeTracks" :key="tr.id">
            <div class="lane node-head" :class="{muted:tr.muted}" :data-test="'node-track-'+tr.nodeId"><span class="hint">{{ tr.muted?'Silenciada':'Nodo' }}</span></div>
            <div v-for="part in tr.properties" :key="part.id" class="lane node-part" :data-test="'node-prop-'+tr.nodeId+'-'+part.prop" :class="{muted:tr.muted}">
              <span v-for="k in part.keys" :key="k.id" class="node-diamond" :class="{sel:sel?.id===k.id}" :data-test="'node-key-'+k.id"
                :style="{left:x(ghost?.id===k.id?ghost.t:k.t)+'px'}" :title="propertyLabels[part.prop]+' · '+fmt(k.t)" @pointerdown="nodeKeyDown($event,tr,part,k)" @contextmenu.prevent.stop="contextMenu($event, {kind: 'nodekey', nodeId: tr.nodeId, prop: part.prop, id: k.id})">◆</span>
            </div>
            <div v-if="!session.playing && !session.montage.on" class="lane node-addprop"></div>
          </template>
          <div v-for="t in film.edit.audio" :key="t.id" class="lane au" :class="{ muted: t.mute }" :data-audio-lane="t.id" @dragover.prevent @drop.prevent="dropOn($event, t.id)">
            <div v-for="c in t.clips" :key="c.id" class="clip audio" :class="{ sel: sel?.id === c.id }" :style="{ left: x(c.start) + 'px', width: Math.max(6, x(c.dur)) + 'px' }" :data-test="'aclip-' + c.id" @pointerdown="audioDown($event, t, c)" @contextmenu.prevent.stop="contextMenu($event, {kind: 'audio', id: c.id})">
              <svg class="env" :viewBox="`0 0 ${Math.max(1, x(c.dur))} 20`" preserveAspectRatio="none"><polyline :points="`0,20 ${x(c.fadeIn)},2 ${Math.max(x(c.fadeIn), x(c.dur - c.fadeOut))},2 ${x(c.dur)},20`" /></svg>
              <i class="edge a" @pointerdown="audioDown($event, t, c, 'audio-a')"></i>
              <i class="fh in" title="Fundido de entrada" :style="{ left: x(c.fadeIn) + 'px' }" @pointerdown="audioDown($event, t, c, 'fade-in')"></i>
              <i class="fh out" title="Fundido de salida" :style="{ left: x(c.dur - c.fadeOut) + 'px' }" @pointerdown="audioDown($event, t, c, 'fade-out')"></i>
              <span class="nm">♪ {{ c.name }}</span>
              <i class="edge b" @pointerdown="audioDown($event, t, c, 'audio-b')"></i>
            </div>
          </div>
          <div v-if="film.edit.audio.length" class="lane drop" @dragover.prevent @drop.prevent="dropOn($event, null)"><span class="hint lf-help">Suelta aquí un audio de Assets para crear una pista</span></div>
          <div v-if="!hasTimelineContent" class="nle-empty" data-test="nle-empty" @contextmenu.prevent.stop="contextMenu($event, {kind: 'empty'})" @dragover.prevent @drop.prevent="dropOn($event, null)"><b>Película sin pistas</b><span>Arrastra un nodo desde Jerarquía, una cámara desde Cámara, o añade efectos y audio. No necesitas grabar.</span><span>Las herramientas están listas; ninguna pista se crea automáticamente.</span></div>
          <div class="playhead" :style="{ left: x(head) + 'px' }"></div>
        </div>
      </div>

      <Teleport :to="inspectorTarget || 'body'" :disabled="!inspectorTarget">
      <aside v-if="sel && showProperties" class="props" :class="{'dock-props': !!inspectorTarget}" data-test="nle-props" aria-label="Propiedades del clip seleccionado">
        <div class="props-title"><span>PROPIEDADES DEL CLIP</span><button type="button" title="Cerrar propiedades" aria-label="Cerrar propiedades de clip" data-test="close-nle-props" @click="closeClipProperties">×</button></div>
        <template v-if="sel?.kind==='physics' && displayBakes.length">
          <h5>Simulación física · Jolt</h5>
          <p class="hint">{{displayBakes[0].bodies.length}} cuerpos · {{displayBakes[0].duration}} s · {{displayBakes[0].hz}} Hz</p>
          <p class="hint" :class="{'bake-error':physicalStatus==='stale'}">{{physicalStatus==='stale'?'Modificaste colisiones, nodos o Transform base. Re-simula y hornea.':'Resultado determinista. Puedes retroceder el cabezal.'}}</p>
          <button :disabled="session.playing || session.montage.on" @click="session.physics.state==='simulated'?F.cancelPhysicsSimulation():F.removeFilmPhysicsBake();sel=null">Eliminar bake</button>
        </template>
        <template v-if="sel?.kind==='nodetrack' && selNode">
          <h5>Animación · {{nodeFor(selNode.nodeId)?.name||selNode.name||selNode.nodeId}}</h5>
          <p class="hint">ID estable: {{selNode.nodeId}} · {{selNode.properties.length}} propiedades</p>
          <label><input type="checkbox" :checked="selNode.muted" @change="F.toggleFilmNodeMute(selNode.nodeId,$event.target.checked)" /> Silenciar sin borrar</label>
          <button @click="eraseNodeSelection">Eliminar pista</button>
        </template>
        <template v-else-if="sel?.kind==='nodepart' && selPart">
          <h5>{{propertyLabels[selPart.prop]}}</h5><p class="hint">{{selPart.keys.length}} claves. Elige un rombo para editarlo.</p>
          <button :disabled="session.playing || session.montage.on" @click="insertNodeKey(sel.nodeId,sel.prop)">◆ Añadir clave en el cabezal</button>
        </template>
        <template v-else-if="sel?.kind==='nodekey' && selKey">
          <h5>{{propertyLabels[selPart.prop]}} · Clave</h5>
          <label>Tiempo (s) <input type="number" min="0" step="0.01" :value="selKey.t" data-test="key-time" @change="updateKeyTime" /></label>
          <label v-for="(axis,i) in ['X','Y','Z']" :key="axis">{{axis}} <input type="number" step="0.01" :value="selKey.v[i]" :data-test="'key-'+axis" @change="updateKeyVector(i,$event)" /></label>
          <label>Interpolación <select :value="selKey.ease" @change="F.editFilmKey(sel.nodeId,sel.prop,selKey.id,undefined,$event.target.value)"><option v-for="[ease,label] in EASES" :key="ease" :value="ease">{{ label }}</option></select></label>
          <label v-if="selKey.ease === 'bezier'">Curva Bézier <select :value="BEZIER_PRESETS.findIndex(([,bz])=>JSON.stringify(bz)===JSON.stringify(selKey.bz))" @change="F.editFilmKey(sel.nodeId,sel.prop,selKey.id,undefined,'bezier',BEZIER_PRESETS[+$event.target.value]?.[1])"><option v-for="([label,bz],i) in BEZIER_PRESETS" :key="label" :value="i">{{ label }}</option></select></label>
          <button @click="eraseNodeSelection">Borrar clave</button>
        </template>
        <template v-else-if="selShot">
          <h5>Plano · {{ selShot.pass.name }}</h5>
          <label>Entra (s) <input type="number" step="0.1" min="0" :value="selShot.shot.in" @change="set(M.updateShot(film, selShot.shot.id, { in: +$event.target.value }))" /></label>
          <label>Sale (s) <input type="number" step="0.1" min="0" :max="selShot.pass.input === 'editor' ? 3600 : selShot.pass.duration" :value="selShot.shot.out" @change="editShotOut(selShot.shot.id, +$event.target.value)" /></label>
          <label>Transición <select :value="selShot.shot.tin.kind" data-test="shot-trans" @change="set(M.setTransition(film, selShot.shot.id, { kind: $event.target.value }))"><option v-for="(l, k) in M.TRANSITIONS" :key="k" :value="k">{{ l }}</option></select></label>
          <label v-if="selShot.shot.tin.kind !== 'cut'">Duración (s) <input type="number" step="0.1" min="0.05" :value="selShot.shot.tin.dur" @change="set(M.setTransition(film, selShot.shot.id, { dur: +$event.target.value }))" /></label>
          <label>Color <select :value="selShot.shot.filter" @change="set(M.updateShot(film, selShot.shot.id, { filter: $event.target.value }))"><option value="">El de la escena</option><option v-for="f in film.edit.filters" :key="f.id" :value="f.id">{{ f.name }}</option></select></label>
          <p class="hint lf-help">El color propio de un plano se ajusta en la pestaña Color → «Este plano».</p>
        </template>
        <template v-else-if="selLayer">
          <h5>{{ LAYER_KINDS[selLayer.kind].label }}</h5>
          <label>Empieza (s) <input type="number" step="0.1" min="0" :value="selLayer.t0" @change="set(M.updateLayer(film, selLayer.id, { t0: +$event.target.value }))" /></label>
          <label>Acaba (s) <input type="number" step="0.1" min="0" :value="selLayer.t1" @change="set(M.updateLayer(film, selLayer.id, { t1: +$event.target.value }))" /></label>
          <template v-if="selLayer.kind === 'text'">
            <textarea :value="selLayer.params.text" rows="2" placeholder="Texto" data-test="text-input" @change="set(M.updateLayer(film, selLayer.id, { params: { text: $event.target.value } }))"></textarea>
            <label>Posición <select :value="selLayer.params.pos" @change="set(M.updateLayer(film, selLayer.id, { params: { pos: $event.target.value } }))"><option value="bottom">Abajo</option><option value="center">Centro</option><option value="top">Arriba</option></select></label>
          </template>
          <template v-if="selLayer.kind === 'fade'">
            <label>Fundido <select :value="selLayer.params.dir" @change="set(M.updateLayer(film, selLayer.id, { params: { dir: $event.target.value } }))"><option value="out">Fade out (a color)</option><option value="in">Fade in (desde color)</option></select></label>
            <label>Color <ColorInput :value="selLayer.params.color || '#000000'" @change="set(M.updateLayer(film, selLayer.id, { params: { color: $event.target.value } }))" /></label>
          </template>
          <label v-if="selLayer.kind === 'letterbox'">Alto (%) <input type="number" min="2" max="25" :value="selLayer.params.percent" @change="set(M.updateLayer(film, selLayer.id, { params: { percent: +$event.target.value } }))" /></label>
          <label v-if="selLayer.kind === 'shake'">Fuerza (°) <input type="number" min="0.1" max="8" step="0.1" :value="selLayer.params.amount" @change="set(M.updateLayer(film, selLayer.id, { params: { amount: +$event.target.value } }))" /></label>
        </template>
        <template v-else-if="selAudio">
          <h5>♪ {{ selAudio.c.name }}</h5>
          <label>Empieza (s) <input type="number" step="0.1" min="0" :value="selAudio.c.start" @change="set(M.updateAudioClip(film, selAudio.c.id, { start: +$event.target.value }))" /></label>
          <label>Desde el segundo <input type="number" step="0.1" min="0" :value="selAudio.c.in" @change="set(M.updateAudioClip(film, selAudio.c.id, { in: +$event.target.value }))" /></label>
          <label>Duración (s) <input type="number" step="0.1" min="0.05" :value="selAudio.c.dur" @change="set(M.updateAudioClip(film, selAudio.c.id, { dur: +$event.target.value }))" /></label>
          <label>Volumen <input type="range" min="0" max="2" step="0.01" :value="selAudio.c.volume" data-test="aclip-vol" @input="set(M.updateAudioClip(film, selAudio.c.id, { volume: +$event.target.value }))" /><small>{{ db(selAudio.c.volume) }} dB</small></label>
          <label>Fade in (s) <input type="number" step="0.1" min="0" :value="selAudio.c.fadeIn" data-test="aclip-fin" @change="set(M.updateAudioClip(film, selAudio.c.id, { fadeIn: +$event.target.value }))" /></label>
          <label>Fade out (s) <input type="number" step="0.1" min="0" :value="selAudio.c.fadeOut" @change="set(M.updateAudioClip(film, selAudio.c.id, { fadeOut: +$event.target.value }))" /></label>
        </template>
        <template v-else-if="sel?.kind === 'track'">
          <h5>Pista · {{ film.edit.audio.find((t) => t.id === sel.id)?.name }}</h5>
          <label>Canal del mezclador <select :value="film.edit.audio.find((t) => t.id === sel.id)?.group" @change="set(M.updateAudioTrack(film, sel.id, { group: $event.target.value }))"><option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option></select></label>
          <label>Volumen <input type="range" min="0" max="2" step="0.01" :value="film.edit.audio.find((t) => t.id === sel.id)?.volume" @input="set(M.updateAudioTrack(film, sel.id, { volume: +$event.target.value }))" /></label>
          <button @click="set(M.removeAudioTrack(film, sel.id)); sel = null">Quitar la pista</button>
        </template>
        <p v-else class="hint lf-help">Selecciona un clip para ver sus propiedades. Arrastra para mover, los bordes para recortar; en el audio, los puntos de las esquinas son el fade in / fade out.</p>
      </aside>
      </Teleport>
    </div>
    <div v-if="scrollMax > 1" class="time-scroll" data-test="time-scroll">
      <label for="film-time-pan">Desplazar tiempo ↔</label>
      <input id="film-time-pan" type="range" min="0" :max="scrollMax" step="1" :value="scrollLeft" aria-label="Desplazar horizontalmente las pistas del timeline" @input="moveTimeScroll($event.target.value)" />
    </div>
  </div>
</template>

<style scoped>
.nle { display: flex; flex-direction: column; height: 100%; min-height: 0; outline: none; font-size: 12px; user-select: none; }
.tb { display: flex; align-items: center; gap: 4px; padding: 4px 6px; border-bottom: 1px solid var(--hair); background: var(--g-850); flex-wrap: wrap; flex: none; }
.tb button, .tb select { height: 24px; padding: 0 8px; font-size: 12px; }
.tb button.on, .tb .play.on { background: var(--blue); color: #fff; border-color: var(--blue); }
.tc { font-variant-numeric: tabular-nums; padding: 0 6px; font-weight: 500; } .tc small { color: var(--text-3); font-weight: 400; }
.sep { width: 1px; height: 16px; background: var(--hair); margin: 0 2px; } .grow { flex: 1; }
.outro { display: flex; align-items: center; gap: 4px; color: var(--text-3); }
.body { flex: 1; min-height: 0; display: flex; position: relative; }
.heads { flex: none; overflow: hidden; background: var(--g-850); border-right: 1px solid var(--hair); }
.rh { height: 22px; border-bottom: 1px solid var(--hair); position: sticky; top: 0; z-index: 2; background: var(--g-850); }
.h { height: 36px; display: flex; align-items: center; gap: 3px; padding: 0 6px; border-bottom: 1px solid var(--hair-soft); color: var(--text-2); white-space: nowrap; overflow: hidden; }
.h.au input { flex: 1; min-width: 0; background: transparent; border: 0; color: var(--text); font-size: 12px; padding: 0; }
.h.au button { width: 20px; height: 18px; padding: 0; font-size: 10px; } .h.au button.on { background: var(--amber); color: #000; }
.h.selt { background: var(--blue-wash); }
.bake-tools{position:relative;flex:none;z-index:16}.bake-tools summary{display:flex;align-items:center;gap:6px;cursor:pointer;border:1px solid var(--hair);border-radius:4px;height:24px;padding:0 10px;background:var(--g-850);list-style:none}.bake-tools summary::-webkit-details-marker{display:none}.bake-tools summary::after{content:'▾';font-size:9px;color:var(--text-3)}.bake-tools[open] summary{background:var(--g-700)}.bake-menu{position:absolute;top:calc(100% + 5px);left:0;width:min(270px,calc(100vw - 32px));max-height:min(400px,55vh);overflow:auto;display:flex;flex-wrap:wrap;align-items:center;gap:7px;background:var(--g-850);border:1px solid var(--hair);border-radius:6px;padding:12px;box-shadow:0 12px 28px #0008}.bake-menu button{flex:1 1 auto}.bake-menu .bake-status{width:100%}
.bake-duration{display:inline-flex;align-items:center;gap:3px;color:var(--text-2);white-space:nowrap}.bake-duration input{width:49px;min-width:0;height:23px;font-size:11px}.bake-status{font-size:10px;color:#9fc4b9;white-space:nowrap}.bake-error{color:#ecb56d!important}.bake-head{background:#204b4f44;cursor:pointer}.bake-head .n-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bake-clip{position:absolute;top:3px;height:29px;background:#376775;border:1px solid #6fa7ab;border-radius:4px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;padding:6px 8px;box-sizing:border-box;color:#d8f4f4;font-size:11px;cursor:pointer}.bake-clip.bake-invalid{background:#6b4f3d;border-color:#edab76}
.node-head{background:#24364566}.node-head .n-name,.node-part .n-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.node-part{background:#1c304344}.node-part .n-name{padding-left:11px}.node-head button,.node-part button{min-width:19px;height:20px;padding:0 3px}.node-addprop{background:#19252f;}.node-addprop select{width:100%;height:24px;font-size:11px}.node-diamond{position:absolute;top:6px;display:block;width:16px;height:23px;margin-left:-8px;color:#76c8ff;font-size:17px;text-shadow:0 0 2px #000;cursor:ew-resize;touch-action:none;user-select:none}.node-diamond.sel{color:#ffd17a}.lane.node-head{background:#2a465266}.lane.node-part{background:#20364244}
.h.add { border: 0; } .h.add button { height: 22px; font-size: 11px; }
.scroll { flex: 1; min-width: 0; overflow-y: auto; overflow-x: hidden; position: relative; background: var(--g-900); scrollbar-width: thin; scrollbar-color: #566f84 #10202d; }
.canvas { position: relative; min-height: 100%; }
.ruler { height: 22px; position: sticky; top: 0; z-index: 3; background: var(--g-850); border-bottom: 1px solid var(--hair); cursor: text; touch-action: none; }
.tick { position: absolute; top: 0; height: 22px; border-left: 1px solid var(--g-600); padding-left: 3px; font-size: 10px; color: var(--text-3); line-height: 22px; pointer-events: none; }
.lane { position: relative; height: 36px; border-bottom: 1px solid var(--hair-soft); }
.lane.muted { opacity: .45; }
.lane.drop { height: 40px; border: 1px dashed var(--g-700); margin: 4px; display: flex; align-items: center; }
.lane .hint, .lane.drop .hint { padding-left: 8px; color: var(--text-3); font-size: 11px; }
.clip { position: absolute; top: 3px; height: 30px; border-radius: 4px; display: flex; align-items: center; gap: 4px; overflow: visible; cursor: grab; touch-action: none; box-sizing: border-box; border: 1px solid #0006; }
.clip .nm { padding: 0 8px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; pointer-events: none; color: #fff; font-size: 11px; position: relative; z-index: 1; }
.clip.sel { outline: 2px solid var(--amber); outline-offset: -1px; }
.shot { background: #2f5e9e; } .shot.on { background: #3d78c6; }
.actor { background: #3c4a3c; cursor: default; } .actor .nm { color: #cfe6cf; }
.text { background: #6b4f9e; } .fx { background: #555; } .fx.fade { background: #4a4a4a; } .fx.letterbox { background: #7a6a2a; } .fx.shake { background: #8a4a2a; }
.audio { background: #2b6b4c; flex-direction: column; align-items: flex-start; justify-content: center; }
.badge { font-size: 10px; background: #0005; border-radius: 3px; padding: 0 4px; color: #fff; pointer-events: none; white-space: nowrap; }
.edge { position: absolute; top: 0; bottom: 0; width: 7px; cursor: ew-resize; z-index: 2; } .edge.a { left: -1px; } .edge.b { right: -1px; }
.edge:hover { background: #fff4; }
.tr { position: absolute; top: -3px; height: 4px; background: repeating-linear-gradient(90deg, #fff 0 4px, #000 4px 8px); border-radius: 2px; pointer-events: none; }
.env { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; } .env polyline { fill: #ffffff14; stroke: #bff5d6; stroke-width: 1; vector-effect: non-scaling-stroke; }
.fh { position: absolute; top: 1px; width: 9px; height: 9px; margin-left: -4px; border-radius: 50%; background: #fff; border: 1px solid #000; cursor: ew-resize; z-index: 3; }
.playhead { position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: #ff4f4f; pointer-events: none; z-index: 4; }
.props.dock-props { position: relative; top: auto; bottom: auto; right: auto; width: 100%; height: 100%; border-left: 0; box-shadow: none; }
.props { position: absolute; z-index: 7; top: 0; bottom: 0; right: 0; width: min(290px, 70%); border-left: 1px solid var(--hair); background: var(--g-850); padding: 8px; overflow: auto; display: flex; flex-direction: column; gap: 6px; box-shadow: -9px 0 22px #0007; }
.props-title { display: flex; flex: none; align-items: center; justify-content: space-between; color: var(--text-2); font-size: 10px; letter-spacing: .08em; border-bottom: 1px solid var(--hair); padding-bottom: 5px; }
.props-title button { font-size: 17px; line-height: 1; padding: 0 6px; min-width: 25px; height: 24px; }
.time-scroll { display: flex; align-items: center; gap: 9px; padding: 4px 10px; height: 29px; flex: none; background: var(--g-850); border-top: 1px solid var(--hair); }
.time-scroll label { color: var(--text-3); white-space: nowrap; font-size: 10px; }
.time-scroll input[type=range] { flex: 1; min-width: 30px; accent-color: #789aaf; height: 15px; }

.props h5 { margin: 0 0 4px; font-size: 12px; } .props label { display: flex; align-items: center; justify-content: space-between; gap: 6px; color: var(--text-2); }
.props input[type=number] { width: 72px; } .props input[type=range] { flex: 1; } .props textarea { width: 100%; resize: vertical; }
.props .hint, .hint { color: var(--text-3); font-size: 11px; margin: 0; }
.nle { position: relative; }
.compact .props { position: absolute; left: 0; right: 0; bottom: 0; width: auto; max-height: 55%; border-left: 0; border-top: 1px solid var(--g-600); z-index: 6; box-shadow: 0 -6px 18px #0008; }
.compact .h { font-size: 11px; padding: 0 3px; }
.compact .props.empty { display: none; }
.compact .tb select, .compact .tb button { height: 28px; }

/* Geometría y lenguaje visual acordes con el Timeline de Century. */
.nle { --film-header-width: 190px; border: 1px solid var(--hair); border-radius: 5px; overflow: hidden; background: var(--g-900); }
.nle.compact { --film-header-width: 132px; }
.nle .tb { background: var(--g-850); border-bottom: 1px solid var(--hair); gap: 5px; }
.nle .tb button, .nle .tb select { min-height: 26px; border-radius: 4px; }
.nle .h { background-color: var(--g-850); border-bottom: 1px solid var(--hair); }
.nle .lane { background-image: linear-gradient(90deg,#ffffff05 1px,transparent 1px); background-size: var(--film-grid-step,70px) 100%; }
.nle .lane:nth-child(even) { background-color: #ffffff03; }
.nle .ruler, .nle .rh { background: var(--g-850); height: 27px; }
.nle .tick { border-color: var(--g-700); color: var(--text-3); }
.nle .tick.major { border-color: var(--g-500); }
.nle .node-diamond { cursor: grab; }
.nle .node-diamond.sel { outline: 1px solid var(--blue); outline-offset: 1px; }
.nle .nle-empty { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9px; min-height: 144px; max-width: 680px; margin: 12px auto; border: 1px dashed var(--g-700); border-radius: 6px; color: var(--text-3); text-align: center; padding: 24px; font-size: 12px; }
.nle .nle-empty b { font-size: 13px; color: var(--text-2); }
.nle .nle-empty span { max-width: 430px; }

.nle-add-menu { position: relative; flex: none; z-index: 12; }
.nle-add-trigger { display: inline-flex; align-items: center; min-height: 26px; border: 1px solid var(--hair); background: var(--g-800); border-radius: 4px; padding: 3px 9px; cursor: pointer; list-style: none; color: var(--text); }
.nle-add-trigger::-webkit-details-marker { display: none; }
.nle-add-trigger::after { content: '▾'; color: var(--text-3); margin-left: 7px; font-size: 10px; }
.nle-add-pop { position: absolute; top: calc(100% + 5px); left: 0; display: flex; flex-direction: column; gap: 6px; padding: 10px; min-width: 225px; background: var(--g-800); border: 1px solid var(--g-600); border-radius: 5px; box-shadow: 0 12px 30px #0009; }
.nle-add-pop > strong { font-size: 11px; color: var(--text-2); padding-bottom: 6px; border-bottom: 1px solid var(--hair); }
.nle-add-pop select, .nle-add-pop button { width: 100%; min-height: 27px; }
.nle-add-fx { display: flex; gap: 5px; }
.nle-add-fx select { min-width: 0; flex: 1; }
.nle-add-fx button { width: auto; flex: none; }
</style>
