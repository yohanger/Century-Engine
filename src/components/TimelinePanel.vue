<script setup>
import { acquirePointer } from '../engine/runtime/input/pointer-capture.js'
import { askConfirm, askText } from '../core/dialogs.js'
// Timeline (cinemáticas): pistas de cámara, nodos, audio y comandos con claves arrastrables, cabezal y previsualización en el viewport.
// Los detalles de cada clave usan el formulario temporal compartido.
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, inject, nextTick } from 'vue'
import { store, commit, markDirty, toast, deleteTimeline, openEventEditor, worldMatrix, selectObject, createTimelineDialog, openTimelineEditor, renameEntry } from '../core/store.js'
import { newTrack, newKey, sortKeys, TRACK_KINDS, timelinePropertySpec, timelineEnd, timelineMinDuration, retimeTimelineSegment, resizeTimelineAudioKey, trimTimelineAudioKey, resizeTimelineAudioFade, editTimelineAudioVolumePoint, isFilmMakerTimeline, timelineRulerTicks, timelineSelectedKeys, timelineSelectionMoveDelta, moveTimelineSelection, duplicateTimelineSelection, deleteTimelineSelection, timelineKeysInRegion, TIMELINE_EDIT_MODES, NEW_TIMELINE_CAMERA_EXIT, normalizeTimelineCameraExit, addTimelineCameraBinding, readTimelineNodeProperty, timelineTrackNodeOwner, upsertTimelineNodePropertyKey, editTimelineClip, deleteTimelineClip, editTimelineEvent, timelineClipSnapTime, timelineTrackEditable, timelineVisibleRows, addTimelineGroup, removeTimelineGroup, moveTimelineGroup, moveTimelineTrack, addTimelineMarker, moveTimelineMarker, deleteTimelineMarker, timelineFps, timelineSnapFrame } from '../core/timeline/model.js'
import * as THREE from 'three'
import { rotFromQuat } from '../engine/runtime/timeline/eval.js'
import { nodeAnimationProperties, nodeAnimationProperty } from '../engine/runtime/anim/model.js'
import { kindIcon } from '../engine/runtime/nodes/index.js'
import TimelineCurveEditor from './TimelineCurveEditor.vue'
import TimelineAudioSource from './TimelineAudioSource.vue'
import { audioSourcePlaybackSpan } from '../core/timeline/audio-waveform.js'
import {timelinePlaybackKey} from '../core/timeline/playback-session.js'
import { createTimelinePointerDrag } from '../core/timeline/pointer-drag.js'
import { uid } from '../engine/runtime/util.js'
import Icon from './Icon.vue'
import PropertyKey from './PropertyKey.vue'
import TemporalResourceInspector from './TemporalResourceInspector.vue'

const timelines = computed(() => (store.project?.timelines || []).filter(t => !isFilmMakerTimeline(t)))
const search = ref('')
const listing = computed(() => timelines.value.filter(t => t.name.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase())))
const tl = computed(() => timelines.value.find(t => t.id === store.timelineId) || null)
function chooseTimeline(id) {
  closeLibrary(true)
  store.projSel = { kind: 'timeline', id }
  openTimelineEditor(id)
}
function closeLibrary(restoreFocus = false) {
  libraryOpen.value = false
  search.value = ''
  if (restoreFocus) nextTick(() => libraryButton.value?.focus())
}
function focusLibraryResult(step) {
  const buttons = [...(libraryPopup.value?.querySelectorAll('.timeline-item') || [])]
  if (!buttons.length) return
  const current = buttons.indexOf(document.activeElement)
  const next = current < 0 ? (step > 0 ? 0 : buttons.length - 1) : current + step
  if (next < 0) { librarySearch.value?.focus(); return }
  buttons[Math.min(next, buttons.length - 1)].focus()
}
function libraryKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    closeLibrary(true)
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    event.stopPropagation()
    focusLibraryResult(event.key === 'ArrowDown' ? 1 : -1)
  } else if (event.key === 'Enter' && event.target === librarySearch.value) {
    event.preventDefault()
    event.stopPropagation()
    const first = listing.value[0]
    if (first) chooseTimeline(first.id)
  }
}
async function renameResource(event) {
  const id = tl.value?.id
  if (id) await renameEntry('timeline', id, event.target.value)
  event.target.value = tl.value?.name || ''
}
watch(() => store.project?.id, () => { search.value = '' })

// El transporte vive en App; el estado visual puede montarse/desmontarse sin interrumpirlo.
const playback = inject(timelinePlaybackKey)
if (!playback) throw new Error('Timeline requiere el transporte del Editor')
const timelineDrag = createTimelinePointerDrag()
const ph = playback.time, playing = playback.playing, previewOn = playback.previewEnabled
const zoom = ref(70), snapPreference = ref('frame')
const snap = computed(() => snapPreference.value === 'frame'
  ? 1 / (tl.value?.fps || 30) : Number(snapPreference.value))
function updateFps(event) {
  const before = tl.value?.fps || 30
  const candidate = Number(event.target.value)
  try {
    timelineFps(candidate)
    if (candidate !== before && !store.locked && !store.play.on) {
      setTl({fps:candidate})
      snapPreference.value = 'frame'
    }
  } catch (error) { toast(error.message, 'error') }
  event.target.value = String(tl.value?.fps || 30)
}
// El margen anterior al segundo cero pertenece a la geometría visual, no al recurso.
const TIME_ORIGIN_PX = 24
const timeToX = (time, scale = zoom.value) => TIME_ORIGIN_PX + time * scale
const xToTime = (x, scale = zoom.value) => (x - TIME_ORIGIN_PX) / scale
// Ctrl conserva el cursor normal sobre clips y activa la inserción manual de claves en carriles de propiedades.
const ctrlOverClips = ref(false)
function trackCtrlKey(event) {
  if (event.key === 'Control') ctrlOverClips.value = event.type === 'keydown'
  else if (!event.ctrlKey) ctrlOverClips.value = false
}
function syncCtrlPointer(event) { ctrlOverClips.value = !!event.ctrlKey }
function clearCtrlCursor() { ctrlOverClips.value = false }
function resetCtrlOnVisibility() { if (document.hidden) clearCtrlCursor() }

const editMode = ref('mix') // Herramienta editorial, no serializada como atributo del recurso.
const sel = ref(null)
const nodeTargetId = ref(null)
const detailsOpen = ref(false)
const detailsButton = ref(null)
const detailsContext = computed(() => {
  const s = sel.value
  return {
    kind: 'timeline', resourceId: tl.value?.id,
    element: s?.marker ? 'marker' : s?.group ? 'group' : s?.clip ? 'clip' : s?.k ? 'key' : s?.tr ? 'track' : 'resource',
    trackId: s?.tr, itemId: s?.marker || s?.group || s?.clip || s?.k,
    keyRefs: s?.keys, timelineMode: editMode.value,
  }
})
function selectDetails({ element, trackId, itemId, keyRefs }) {
  if (element === 'key') selectRefs(keyRefs?.length ? keyRefs : [{tr: trackId, k: itemId}], {tr: trackId, k: itemId})
  else if (element === 'clip') sel.value = {tr: trackId, clip: itemId}
  else if (element === 'track') sel.value = {tr: trackId}
  else sel.value = null
}
function closeDetails() {
  detailsOpen.value = false
  detailsButton.value?.focus({preventScroll: true})
}
const ver = ref(0)
const bump = () => { ver.value++ }
const root = ref(null), scroller = ref(null), pinnedRows = ref(null), ruler = ref(null), inner = ref(null), marquee = ref(null), addMenu = ref(false), optMenu = ref(false), libraryOpen = ref(false), nodeDropActive = ref(false)
const libraryButton = ref(null), libraryPopup = ref(null), librarySearch = ref(null), optionsButton = ref(null), trackButton = ref(null), trackPopup = ref(null), popupPlacement = ref({})
// Las cabeceras mantienen el ancho elegido; solo se limita cuando el dock queda estrecho.
const DEFAULT_HEADER_WIDTH = 224
const headerWidth = ref(DEFAULT_HEADER_WIDTH), viewportWidth = ref(600)
// Posición editorial del scroll, no otro estado de duración: el corchete queda
// anclado al viewport visible aunque los carriles tengan scroll vertical.
const durationScrollX = ref(0), durationViewportHeight = ref(0)
const durationBoundaryX = computed(() => timeToX(tl.value?.duration || 0) - durationScrollX.value)
let preferredHeaderWidth = DEFAULT_HEADER_WIDTH, resizeObserver = null, headerDrag = null
function clampHeaderWidth(requested, available) {
  const limit = Math.min(360, Math.max(96, available - 120))
  return Math.min(limit, Math.max(Math.min(132, limit), requested))
}
// La columna de pistas no pertenece al scroller horizontal. Un solo scroll nativo
// gobierna el tiempo y el desplazamiento vertical, sin copiar tiempos ni claves.
function syncTimelineScroll(event) {
  const element = event?.currentTarget || scroller.value
  if (!element) return
  durationScrollX.value = element.scrollLeft
  if (pinnedRows.value) pinnedRows.value.style.transform = `translateY(${-element.scrollTop}px)`
}
function forwardPinnedWheel(event) {
  if (event.ctrlKey || event.metaKey) { zoomWheel(event, true); return }
  const element = scroller.value
  if (!element) return
  element.scrollTop += event.deltaY
  element.scrollLeft += event.deltaX
  syncTimelineScroll()
}
function measureViewport() {
  if (!scroller.value) return
  viewportWidth.value = scroller.value.parentElement?.clientWidth || scroller.value.clientWidth
  // clientHeight excluye la barra horizontal; el remate inferior termina
  // en el último píxel útil, no encima del scrollbar del sistema.
  durationViewportHeight.value = scroller.value.clientHeight
  headerWidth.value = clampHeaderWidth(preferredHeaderWidth, viewportWidth.value)
  repositionPopup()
}
function beginHeaderResize(event) {
  if (event.button !== 0) return
  event.preventDefault()
  event.stopPropagation()
  if (!acquirePointer(event.currentTarget, event, "Anchura de pistas")) return
  headerDrag = { id: event.pointerId, x: event.clientX, initial: headerWidth.value }
}
function moveHeaderResize(event) {
  if (!headerDrag || headerDrag.id !== event.pointerId) return
  preferredHeaderWidth = clampHeaderWidth(headerDrag.initial + event.clientX - headerDrag.x, Math.max(480, viewportWidth.value))
  headerWidth.value = clampHeaderWidth(preferredHeaderWidth, viewportWidth.value)
}
function endHeaderResize(event) {
  if (!headerDrag || headerDrag.id !== event.pointerId) return
  headerDrag = null
  if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
}
function keyHeaderResize(event) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  preferredHeaderWidth = clampHeaderWidth(preferredHeaderWidth + (event.key === 'ArrowRight' ? 12 : -12), Math.max(480, viewportWidth.value))
  headerWidth.value = clampHeaderWidth(preferredHeaderWidth, viewportWidth.value)
  event.preventDefault()
}
function activePopup() { return libraryOpen.value ? 'library' : optMenu.value ? 'options' : addMenu.value ? 'tracks' : '' }
function repositionPopup() {
  const kind = activePopup()
  const button = kind === 'library' ? libraryButton.value : kind === 'options' ? optionsButton.value : trackButton.value
  if (!kind || !button || typeof window === 'undefined') return
  const rect = button.getBoundingClientRect()
  const width = Math.max(0, Math.min(kind === 'library' ? 368 : kind === 'options' ? 278 : 224, window.innerWidth - 16))
  const left = Math.max(8, Math.min(window.innerWidth - width - 8, kind === 'library' ? rect.left : rect.right - width))
  const below = Math.max(0, window.innerHeight - rect.bottom - 12)
  const above = Math.max(0, rect.top - 12)
  const preferredHeight = kind === 'library' ? 340 : kind === 'options' ? 360 : 260
  const topSide = below < Math.min(preferredHeight, 200) && above > below
  const availableHeight = Math.max(0, topSide ? above : below)
  popupPlacement.value = { position:'fixed', left: left + 'px', width: width + 'px', maxHeight: (kind === 'library' ? Math.min(preferredHeight, availableHeight) : availableHeight) + 'px',
    height: 'auto',
    top: topSide ? 'auto' : rect.bottom + 5 + 'px', bottom: topSide ? window.innerHeight - rect.top + 5 + 'px' : 'auto',
    zIndex: 2500, overflowY: kind === 'library' ? 'hidden' : 'auto' }
}
function togglePopup(kind) {
  const wasOpen = activePopup() === kind
  libraryOpen.value = false; optMenu.value = false; addMenu.value = false
  if (wasOpen) { if (kind === 'library') closeLibrary(); return }
  if (kind === 'library') {
    search.value = ''
    libraryOpen.value = true
    nextTick(() => librarySearch.value?.focus())
  }
  if (kind === 'options') optMenu.value = true
  if (kind === 'tracks') {
    addMenu.value = true
    nextTick(() => trackPopup.value?.querySelector('button')?.focus())
  }
  repositionPopup()
}
function outsideMenus(event) {
  if (event.target?.closest?.('.timeline-selector, .options-menu, .add-track-menu, .timeline-dropdown')) return
  closeLibrary(); addMenu.value = false; optMenu.value = false
}
function dismissMenus(event) {
  if (event.key !== 'Escape') return
  const returnLibraryFocus = libraryOpen.value
  const returnTrackFocus = addMenu.value
  closeLibrary(); addMenu.value = false; optMenu.value = false
  if (returnLibraryFocus) nextTick(() => libraryButton.value?.focus())
  else if (returnTrackFocus) nextTick(() => trackButton.value?.focus())
}
onMounted(() => {
  window.addEventListener('pointerdown', outsideMenus)
  window.addEventListener('keydown', dismissMenus)
  window.addEventListener('keydown', trackCtrlKey)
  window.addEventListener('keyup', trackCtrlKey)
  window.addEventListener('blur', clearCtrlCursor)
  document.addEventListener('visibilitychange', resetCtrlOnVisibility)
  window.addEventListener('resize', repositionPopup)
  window.addEventListener('scroll', repositionPopup, true)
})
// El carril se monta cuando se abre la cinemática, no necesariamente cuando se monta el dock.
watch(scroller, (element) => {
  resizeObserver?.disconnect()
  resizeObserver = null
  if (!element) return
  measureViewport()
  syncTimelineScroll()
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(measureViewport)
    resizeObserver.observe(element)
    if (element.parentElement) resizeObserver.observe(element.parentElement)
  }
}, { flush: 'post' })
const selTrack = computed(() => tl.value?.tracks.find((t) => t.id === sel.value?.tr) || null)
const selKey = computed(() => selTrack.value?.keys.find((k) => k.id === sel.value?.k) || null)
const selClip = computed(() => selTrack.value?.clips?.find(c => c.id === sel.value?.clip) || null)
// El nodo soltado solo existe en la vista hasta que obtiene su primera pista.
const collapsedNodes = ref(new Set())
const expandedGroupId = computed(() => {
  if (!nodeTargetId.value || !tl.value) return null
  const groups = new Set(tl.value.tracks.filter(track => trackOwner(track)?.id === nodeTargetId.value).map(track => track.groupId || null))
  return groups.size === 1 ? groups.values().next().value : null
})
const visibleRows = computed(() => {
  const sceneId = store.project?.activeSceneId
  const rows = timelineVisibleRows(tl.value, {
    objects: objects.value, sceneId, collapsedNodes: collapsedNodes.value, expandedGroupId: expandedGroupId.value,
  })
  const node = objects.value.find(item => item.id === nodeTargetId.value)
  if (tl.value && node && !rows.some(row => row.type === 'node' && row.nodeId === node.id)) {
    rows.push({ type: 'node', id: `node::${sceneId}:${node.id}`, node, nodeId: node.id, tracks: [], pending: true })
  }
  return rows
})
// Geometría editorial compartida por CSS, carriles y selección rectangular.
const NODE_ROW_HEIGHT = 27, PROPERTY_ROW_HEIGHT = 21, TRACK_ROW_HEIGHT = 36
function timelineRowHeight(row) {
  if (row.type === 'node') return NODE_ROW_HEIGHT
  if (row.type === 'track' && row.child && row.track.kind === 'node') return PROPERTY_ROW_HEIGHT
  return TRACK_ROW_HEIGHT
}
const rowBounds = computed(() => {
  let bottom = 0
  return visibleRows.value.map(row => {
    bottom += timelineRowHeight(row)
    return bottom
  })
})
function timelineRowAt(y) {
  const index = rowBounds.value.findIndex(bottom => y < bottom)
  return index < 0 ? Math.max(0, rowBounds.value.length - 1) : index
}
const nodeGroupConflict = computed(() => visibleRows.value.some(row => row.nodeConflict))
const nodePropertyLabel = track => track.kind === 'camera' ? 'Toma de cámara'
  : track.kind === 'method' ? 'Métodos' : timelinePropertySpec(track.prop)?.label || track.name
function toggleNodeRow(row) {
  const next = new Set(collapsedNodes.value)
  if (next.has(row.id)) next.delete(row.id); else next.add(row.id)
  collapsedNodes.value = next
}
function pickNodeRow(row) {
  sel.value = null
  selectObject(row.nodeId) // Usa la selección original: Inspector correcto incluso para el mismo ID.
}

const keyRefs = computed(() => sel.value?.keys?.length ? sel.value.keys : sel.value?.k ? [{ tr:sel.value.tr, k:sel.value.k }] : [])
const chosen = computed(() => timelineSelectedKeys(tl.value, keyRefs.value))
const chosenCount = computed(() => chosen.value.length)
const chosenIds = computed(() => new Set(chosen.value.map(s => s.tr + '\0' + s.k)))
const hasKey = (track, key) => chosenIds.value.has(track.id + '\0' + key.id)

// G005: el subpanel gráfico extiende esta misma Timeline sin duplicar modelo ni evaluación.
const curveOpen=ref(false)
function pauseCurvePlayback(){playback.pause()}
function onCurveEdited(label){commit(label);bump()}
const W = computed(() => Math.max(160, timeToX(tl.value?.duration || 10) + 120, viewportWidth.value - headerWidth.value))
const ZOOM_MIN = 0.1, ZOOM_MAX = 720
// Un mismo scroll nativo determina el tiempo bajo el cursor; no se altera el playhead.
let zoomRequest = 0, pendingZoomScroll = null
const setZoom = (value, cursorX = null) => {
  const sc = scroller.value, oldZoom = zoom.value
  const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Number(value) || ZOOM_MIN))
  if (Math.abs(newZoom - oldZoom) < 0.00001) return
  const x = sc ? Math.max(0, Math.min(sc.clientWidth, cursorX ?? sc.clientWidth / 2)) : 0
  const time = sc ? Math.max(0, xToTime((pendingZoomScroll ?? sc.scrollLeft) + x, oldZoom)) : 0
  zoom.value = newZoom
  const request = ++zoomRequest
  if (sc) {
    pendingZoomScroll = Math.max(0, timeToX(time, newZoom) - x)
    void nextTick(() => {
      if (request !== zoomRequest || sc !== scroller.value) return
      sc.scrollLeft = pendingZoomScroll
      pendingZoomScroll = null
      syncTimelineScroll()
    })
  }
}
const zoomBy = (factor) => setZoom(zoom.value * factor)
function zoomWheel(event, pinned = false) {
  if (!event.ctrlKey && !event.metaKey) return
  if (event.cancelable) event.preventDefault()
  const sc = scroller.value
  if (!sc || !event.deltaY) return
  const x = pinned ? sc.clientWidth / 2 : event.clientX - sc.getBoundingClientRect().left
  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? sc.clientHeight : 1)
  setZoom(zoom.value * Math.exp(Math.max(-300, Math.min(300, -delta)) * 0.002), x)
}
function fitZoom() {
  if (!tl.value) return
  setZoom((viewportWidth.value - headerWidth.value - TIME_ORIGIN_PX - 24) / Math.max(0.5, tl.value.duration))
  if (scroller.value) {
    zoomRequest++
    pendingZoomScroll = null
    scroller.value.scrollLeft = 0
    syncTimelineScroll()
  }
}
const fmt = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(2).padStart(5, '0')}`
const snapT = t => Math.max(0, Math.min(tl.value.duration,
  snapPreference.value === 'frame' ? timelineSnapFrame(t, tl.value.fps || 30)
    : snap.value ? Math.round(t / snap.value) * snap.value : t))
const ticks = computed(() => timelineRulerTicks(tl.value?.duration || 0, zoom.value))
const gridStep = computed(() => (ticks.value.find(t => t.major && t.t > 0)?.t || 1) * zoom.value)
const gridMinorStep = computed(() => ((ticks.value[1]?.t || ticks.value.find(t => t.major && t.t > 0)?.t || 1) * zoom.value))
const tickText = (t) => t >= 60 ? `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}` : Number(t.toFixed(2)).toString()

const addableKinds = Object.fromEntries(Object.entries(TRACK_KINDS).filter(([k]) => ['audio', 'commands', 'method'].includes(k)))
// Iconos del proyecto: la presentación no incorpora recursos ni clases de Unity.
const trackGlyphs = { camera: 'camera', node: 'box', bake: 'static-body', audio: 'audio', commands: 'event', method: 'script' }
const trackGlyph = (kind) => trackGlyphs[kind] || 'event'
// Bootstrap Icons MIT: solo el menú de creación, sin alterar TRACK_KINDS.
const trackMenuGlyphs = { audio: 'bi-soundwave', commands: 'bi-list-check', method: 'bi-braces' }

const objects = computed(() => store.project?.objects || [])
const objByName = (n) => objects.value.find((o) => o.name === n || o.id === n)
const trackObject = (tr) => tr.byId ? objects.value.find((o) => o.id === tr.node) : objByName(tr.node)

// La Jerarquía ya publica este tipo MIME. Solo Timeline consume nodos, no arrastres de docks o Assets.
const NODE_DRAG_TYPE = 'application/x-lf-node'
function nodeDragOver(e) {
  if (!tl.value || !Array.from(e.dataTransfer?.types || []).includes(NODE_DRAG_TYPE)) return
  e.preventDefault()
  e.stopPropagation()
  e.dataTransfer.dropEffect = 'copy'
  nodeDropActive.value = true
}
function nodeDragLeave(e) {
  const r = e.currentTarget.getBoundingClientRect()
  if (e.clientX < r.left || e.clientX >= r.right || e.clientY < r.top || e.clientY >= r.bottom) nodeDropActive.value = false
}
const canAuthorProperties = computed(() => !!tl.value && !store.locked && !store.play.on && !store.filmMode && !playing.value)
function insertNodePropertyKey(node, prop, time) {
  if (!canAuthorProperties.value) return null
  if (!node) { toast('El nodo de esta propiedad ya no está disponible', 'error'); return null }
  try {
    const result = upsertTimelineNodePropertyKey(tl.value, node, prop, store.project.activeSceneId,
      objects.value, time, readTimelineNodeProperty(node, prop))
    if (result.changed) {
      playback.yieldToEditing()
      commit(result.updated ? 'Actualizar clave de propiedad' : 'Insertar clave de propiedad')
      bump()
    }
    pick(result.track, result.key)
    return result.key
  } catch (error) {
    toast(error.message, 'error')
    return null
  }
}
function trackOwner(track) {
  return timelineTrackNodeOwner(track, objects.value, store.project.activeSceneId)?.node
}
function nodePicker(event, row) {
  const trigger = event.currentTarget
  const project = store.project, resourceId = tl.value.id, nodeId = row.nodeId, sceneId = project.activeSceneId
  const properties = nodeAnimationProperties(row.node)
  store.menu = {
    x: event.clientX, y: event.clientY, timelineAnchor: timelineMenuAnchor(event), returnFocus: trigger,
    items: [
      { heading: `Animar «${row.node.name}»` },
      ...properties.map(([prop, spec]) => ({
        label: spec.label, icon: 'key',
        run: () => {
          if (store.project === project && tl.value?.id === resourceId && project.activeSceneId === sceneId)
            insertNodePropertyKey(objects.value.find(node => node.id === nodeId), prop, ph.value)
        },
      })),
      ...(!properties.length ? [{label: 'Este nodo no tiene propiedades habilitadas', disabled: true}] : []),
      { sep: true },
      ...(row.node.type === 'camera' ? [{
        label: 'Añadir toma de cámara', icon: 'camera',
        run: () => { if (store.project === project) nodeCameraShot(resourceId, nodeId, ph.value, null, sceneId) },
      }] : []),
      { label: 'Llamadas a métodos', icon: 'event', run: () => { if (store.project === project) nodeMethodTrack(resourceId, nodeId, sceneId) } },
    ],
  }
}
function focusDroppedNode(node) {
  nodeTargetId.value = node.id
  sel.value = null
  selectObject(node.id)
  const row = visibleRows.value.find(item => item.type === 'node' && item.nodeId === node.id)
  if (row && collapsedNodes.value.has(row.id)) toggleNodeRow(row)
  nextTick(() => {
    const heading = root.value?.querySelector(`.node-head[data-node-id="${CSS.escape(node.id)}"]`)
    heading?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    heading?.querySelector('.node-key-picker:not(:disabled), .node-row-name')?.focus({ preventScroll: true })
  })
}
function cancelPendingNode() {
  if (!visibleRows.value.some(row => row.pending)) return false
  nodeTargetId.value = null
  root.value?.focus({ preventScroll: true })
  return true
}
function nodeCameraShot(resourceId, nodeId, time, trackId = null, sceneId = store.project.activeSceneId) {
  const current = tl.value
  if (!current || current.id !== resourceId || store.project.activeSceneId !== sceneId || store.locked || store.play.on) return
  const node = objects.value.find(o => o.id === nodeId && o.type === 'camera')
  if (!node) { toast('Camera3D ya no está disponible', 'error'); return }
  try {
    const { track, key, changed } = addTimelineCameraBinding(current, node, snapT(time), {
      sceneId: store.project.activeSceneId, ...(trackId ? {trackId} : {}),
    })
    pick(track, key)
    if (changed) { commit('Vincular Camera3D'); bump() }
  } catch (error) { toast(error.message, 'error') }
}
function nodeDrop(e) {
  if (!tl.value || !Array.from(e.dataTransfer?.types || []).includes(NODE_DRAG_TYPE)) return
  e.preventDefault()
  e.stopPropagation()
  nodeDropActive.value = false
  let ids
  try { ids = JSON.parse(e.dataTransfer.getData(NODE_DRAG_TYPE)) } catch { toast('Arrastre de nodo inválido', 'error'); return }
  if (!Array.isArray(ids) || ids.length !== 1 || typeof ids[0] !== 'string') {
    toast('Arrastra un solo nodo de la Jerarquía', 'error'); return
  }
  const node = objects.value.find((o) => o.id === ids[0])
  if (!node) { toast('El nodo no pertenece a la escena actual', 'error'); return }
  if (store.locked || store.play.on) return
  store.menu = null
  const resourceId = tl.value.id, nodeId = node.id, sceneId = store.project.activeSceneId
  if (node.type === 'camera') {
    const shotLane = e.target?.closest?.('[data-camera-track]')
    if (shotLane?.dataset.cameraTrack) {
      // Un destino de toma explícito conserva el drop anterior sin una acción implícita en el área general.
      nodeCameraShot(resourceId, nodeId, xToTime(e.clientX - shotLane.getBoundingClientRect().left), shotLane.dataset.cameraTrack, sceneId)
      return
    }
  }
  if (canAuthorProperties.value) focusDroppedNode(node)
}

// Una pista de métodos pertenece inequívocamente al ID del nodo arrastrado.
function nodeMethodTrack(resourceId, nodeId, expectedScene = store.project.activeSceneId) {
  const current = tl.value
  if (!current || current.id !== resourceId || store.project.activeSceneId !== expectedScene || store.locked || store.play.on) return
  const node = objects.value.find((o) => o.id === nodeId)
  if (!node) { toast('El nodo arrastrado ya no existe', 'error'); return }
  const existing = current.tracks.find((t) => t.kind === 'method' && t.node === nodeId)
  if (existing) { pickTrack(existing); toast('La pista de métodos ya existe; se ha seleccionado'); return }
  const tr = newTrack('method', { name: `${node.name} · Métodos`, node: node.id, byId: true })
  current.tracks.push(tr); pickTrack(tr); commit('Añadir pista de métodos'); bump()
}

// ---------- edición ----------
function pick(tr, k, event = null) {
  if (!tr || !k || tr.kind === 'bake') return
  const ref = { tr:tr.id, k:k.id }, previous = keyRefs.value
  if (event?.ctrlKey || event?.metaKey) {
    const selected = previous.some(r => r.tr === ref.tr && r.k === ref.k)
    const refs = selected ? previous.filter(r => r.tr !== ref.tr || r.k !== ref.k) : [...previous, ref]
    const anchor = selected ? refs.at(-1) : ref
    sel.value = anchor ? { tr:anchor.tr, k:anchor.k, keys:refs } : { tr:tr.id }
  } else if (event?.shiftKey && sel.value?.tr === tr.id && sel.value?.k) {
    const sorted = [...tr.keys].sort((a,b) => a.t - b.t)
    const a = sorted.findIndex(x => x.id === sel.value.k), b = sorted.findIndex(x => x.id === k.id)
    const refs = a < 0 ? [ref] : sorted.slice(Math.min(a,b), Math.max(a,b)+1).map(x => ({tr:tr.id,k:x.id}))
    sel.value = { tr:tr.id, k:k.id, keys:refs }
  } else if (!event?.shiftKey && chosenCount.value > 1 && hasKey(tr,k)) {
    // Al iniciar arrastre desde una clave seleccionada se conserva el grupo.
    return
  } else sel.value = { tr:tr.id, k:k.id }
}
function pickSegment(tr, startId, event = null) {
  const index = tr.keys.findIndex(k => k.id === startId)
  const key = tr.keys[index], next = tr.keys[index + 1]
  if (!key) return
  if (!event || event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) {pick(tr,key,event);return}
  const selectedGroup = chosenCount.value > 1 && hasKey(tr,key)
  pick(tr,key,event)
  if (!next || tr.locked || tr.kind==='bake' || store.locked || store.play.on) return
  // El bloque temporal representa dos claves reales: arrastrarlo mueve ambos extremos.
  const segment = [{tr:tr.id,k:key.id},{tr:tr.id,k:next.id}]
  const refs = selectedGroup ? timelineSelectedKeys(tl.value, [...keyRefs.value, ...segment]).map(s=>({tr:s.tr,k:s.k})) : segment
  beginKeyDrag(event,tr,key,refs,selectedGroup)
}
function selectRefs(refs, primary = refs.at(-1)) {
  if (!primary) { sel.value = null; return }
  sel.value = { tr:primary.tr, k:primary.k, ...(refs.length > 1 ? { keys:refs } : {}) }
}
function toggleTrackMute(tr) {
  if (!tl.value || !tl.value.tracks.includes(tr)) return
  tr.muted = !tr.muted
  commit('Silenciar pista')
  bump()
}
function stepTime(direction) {
  if (!tl.value) return
  playback.pause()
  const step = snap.value || 0.1
  seekTime(snapPreference.value === 'frame' && tl.value?.fps
    ? timelineSnapFrame(ph.value + direction * step, tl.value.fps)
    : +((ph.value + direction * step).toFixed(5)))
}

function pickTrack(tr) { sel.value = { tr: tr.id } }
function pickGroup(group) { sel.value={group:group.id} }
function pickMarker(marker) { sel.value={marker:marker.id}; seekTime(marker.t) }
function guardedTrack(tr) { return timelineTrackEditable(tr) && !store.locked && !store.play.on }
function toggleTrackLock(tr) {
  if(!tr || tr.kind==='bake' || store.locked || store.play.on)return
  tr.locked=!tr.locked
  if(tr.locked && sel.value?.tr===tr.id)pickTrack(tr)
  commit(tr.locked?'Bloquear pista':'Desbloquear pista');bump()
}
function createGroup() {
  if(!tl.value || store.locked || store.play.on)return
  addMenu.value=false
  const group=addTimelineGroup(tl.value)
  pickGroup(group);commit('Crear grupo de pistas');bump()
}
function deleteGroup(group) {
  if(!tl.value || store.locked || store.play.on)return
  if(removeTimelineGroup(tl.value,group.id)){sel.value=null;commit('Desagrupar pistas');bump()}
}
async function renameGroup(group) {
  if(store.locked || store.play.on)return
  const id=tl.value?.id, groupId=group.id
  const value=await askText('Nombre del grupo',group.name,{title:'Renombrar grupo',ok:'Guardar'})
  if(value===null || !value.trim() || tl.value?.id!==id || store.locked || store.play.on)return
  const found=tl.value.groups?.find(g=>g.id===groupId)
  if(found && found.name!==value.trim().slice(0,80)){found.name=value.trim().slice(0,80);commit('Renombrar grupo');bump()}
}
function groupCollapsed(group) { return group.collapsed && group.id !== expandedGroupId.value }
function toggleGroup(group) {
  if (store.locked || store.play.on || !tl.value?.groups?.includes(group)) return
  if (group.id === expandedGroupId.value) {
    nodeTargetId.value = null
    if (group.collapsed) return
  }
  group.collapsed = !group.collapsed
  commit('Contraer grupo')
  bump()
}
// Menús de Timeline: anclar al elemento y preservar la regla temporal.
// El menú compartido conserva Escape, clic exterior y navegación por teclado.
function timelineMenuAnchor(event, mode = 'row') {
  const r = event.currentTarget?.getBoundingClientRect?.()
  const mainTop = root.value?.querySelector('.main')?.getBoundingClientRect().top ?? 0
  if (!r || (mode === 'point' && (r.height > 48 || r.width > 180))) {
    return { mode: 'point', left: event.clientX, right: event.clientX, top: event.clientY, bottom: event.clientY, contentTop: mainTop + 29 }
  }
  return { mode, left: r.left, right: r.right, top: r.top, bottom: r.bottom, contentTop: mainTop + 29 }
}
function groupMenu(e,group) {
  pickGroup(group)
  store.menu={x:e.clientX,y:e.clientY,timelineAnchor:timelineMenuAnchor(e),items:[
    {heading:group.name},
    {label:group.collapsed?'Expandir grupo':'Contraer grupo',icon:'chevd',run:()=>toggleGroup(group)},
    {label:'Renombrar grupo',icon:'edit',run:()=>renameGroup(group)},
    {label:'Desagrupar pistas sin borrarlas',icon:'trash',danger:true,run:()=>deleteGroup(group)},
  ]}
}
const ORGANIZE_MIME='application/x-lf-timeline-organize'
function beginOrganizeDrag(e,type,id) {
  if(store.locked || store.play.on)return e.preventDefault()
  e.stopPropagation()
  e.dataTransfer.effectAllowed='move'
  e.dataTransfer.setData(ORGANIZE_MIME,JSON.stringify({resourceId:tl.value?.id,type,id}))
}
function allowOrganizeDrop(e) {
  if(!Array.from(e.dataTransfer?.types||[]).includes(ORGANIZE_MIME))return
  e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='move'
}
function dropOrganize(e,{groupId=null,beforeId=null,beforeGroupId=null}={}) {
  if(!Array.from(e.dataTransfer?.types||[]).includes(ORGANIZE_MIME))return
  e.preventDefault();e.stopPropagation()
  if(!tl.value || store.locked || store.play.on)return
  let source
  try {source=JSON.parse(e.dataTransfer.getData(ORGANIZE_MIME))}catch{return}
  if(source.resourceId!==tl.value.id)return
  const changed=source.type==='track'
    ? moveTimelineTrack(tl.value,source.id,{groupId,beforeId})
    : source.type==='group' && beforeGroupId!==null ? moveTimelineGroup(tl.value,source.id,beforeGroupId) : false
  if(changed){commit('Organizar pistas');bump()}
}
function addMarker(time=ph.value) {
  if(!tl.value || store.locked || store.play.on)return
  try {const marker=addTimelineMarker(tl.value,snapT(time));pickMarker(marker);commit('Añadir marcador temporal');bump()}
  catch(error){toast(error.message,'error')}
}
function markerAtPointer(e) {const rect=ruler.value?.getBoundingClientRect();if(rect)addMarker(xToTime(e.clientX-rect.left))}
function markerDown(e,marker) {
  if(e.button!==0)return
  e.preventDefault();e.stopPropagation();pickMarker(marker)
  if(store.locked || store.play.on)return
  const resourceId=tl.value.id,original=marker.t,x=e.clientX,z=zoom.value
  let moved=false
  const move=ev=>{
    if(tl.value?.id!==resourceId)return
    if(Math.abs(ev.clientX-x)<3 && !moved)return
    moved=true
    const time=snapT(original+(ev.clientX-x)/z)
    if(moveTimelineMarker(tl.value,marker.id,time)){seekTime(marker.t);bump()}
  }
  const clean=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',cancel)}
  const end=ev=>{move(ev);clean();if(tl.value?.id===resourceId && marker.t!==original){commit('Mover marcador temporal');bump()}}
  const cancel=()=>{clean();if(tl.value?.id===resourceId){moveTimelineMarker(tl.value,marker.id,original);bump()}}
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',cancel)
}
function markerMenu(e,marker) {
  pickMarker(marker)
  store.menu={x:e.clientX,y:e.clientY,timelineAnchor:timelineMenuAnchor(e),items:[
    {heading:`${marker.name} · ${marker.t.toFixed(2)} s`},
    {label:'Ir al tiempo',icon:'pin',run:()=>seekTime(marker.t)},
    {label:'Eliminar marcador',icon:'trash',danger:true,run:()=>{if(store.locked||store.play.on)return;if(deleteTimelineMarker(tl.value,marker.id)){sel.value=null;commit('Eliminar marcador');bump()}}},
  ]}
}

function pickClip(track,clip) { sel.value={tr:track.id,clip:clip.id} }
function removeClip() {
  if (!tl.value || !guardedTrack(selTrack.value) || !selClip.value) return
  if (deleteTimelineClip(tl.value,selTrack.value.id,selClip.value.id)) {const track=selTrack.value;pickTrack(track);commit('Eliminar clip de Timeline');bump()}
}
function moveEventToHead(track,key) {
  if (!tl.value || !guardedTrack(track)) return
  if (editMode.value==='mix') {toast('Los eventos discretos admiten Ripple o Replace; Mix solo se aplica a cámara y nodos numéricos','info');return}
  try {if(editTimelineEvent(tl.value,track.id,key.id,snapT(ph.value),editMode.value)) {pick(track,key);commit('Mover evento con '+editMode.value);bump()}}
  catch(error){toast(error.message,'error')}
}
function clipMenu(event,track,clip) {
  pickClip(track,clip)
  const resourceId=tl.value?.id,trackId=track.id,clipId=clip.id
  const current=()=>tl.value?.id===resourceId ? tl.value.tracks.find(t=>t.id===trackId)?.clips?.find(c=>c.id===clipId):null
  store.menu={x:event.clientX,y:event.clientY,timelineAnchor:timelineMenuAnchor(event, 'point'),items:[
    {heading:`Clip · ${clip.start.toFixed(2)} s · ${clip.duration.toFixed(2)} s`},
    {label:'Mostrar clip en Inspector',icon:'sliders',run:()=>{const c=current();if(c)pickClip(tl.value.tracks.find(t=>t.id===trackId),c)}},
    {label:`Mover al cabezal (${editMode.value})`,icon:'pin',disabled:!guardedTrack(track),run:()=>{
      if(!current())return
      try {if(editTimelineClip(tl.value,trackId,clipId,{start:timelineClipSnapTime(tl.value,trackId,clipId,ph.value,{snap:snap.value,playhead:ph.value,zoom:zoom.value}),mode:editMode.value})){commit('Mover clip');bump()}}
      catch(error){toast(error.message,'error')}
    }},
    {sep:true},
    {label:'Eliminar clip',icon:'trash',danger:true,disabled:!guardedTrack(track),run:()=>{if(!current() || !guardedTrack(track))return; if(deleteTimelineClip(tl.value,trackId,clipId)){pickTrack(tl.value.tracks.find(t=>t.id===trackId));commit('Eliminar clip de Timeline');bump()}}},
  ]}
}
function clipDragDown(event,track,clip,resize=false) {
  if (event.button !== 0 || !tl.value) return
  event.preventDefault(); root.value?.focus({ preventScroll: true }); pickClip(track,clip)
  if (!guardedTrack(track)) return
  const timeline = tl.value, originalClips = track.clips
  const startZoom = zoom.value, mode = editMode.value
  let changed = false
  const restore = () => { if (changed) { track.clips = originalClips; changed = false; bump() } }
  timelineDrag.begin(event, {
    move(_event, dx) {
      if (tl.value !== timeline || !guardedTrack(track) || !timeline.tracks.includes(track)) return
      const draftTrack = { ...track, clips: originalClips }
      const draft = { ...timeline, tracks: timeline.tracks.map(item => item === track ? draftTrack : item) }
      const raw = dx / startZoom
      try {
        const duration = clip.duration + raw
        const edit = resize
          ? { duration: snap.value ? Math.round(duration / snap.value) * snap.value : duration }
          : { start: timelineClipSnapTime(draft,track.id,clip.id,clip.start+raw,{snap:snap.value,playhead:ph.value,zoom:startZoom}) }
        if (!editTimelineClip(draft,track.id,clip.id,{...edit,mode})) { restore(); return }
      } catch { restore(); return }
      playback.pause()
      track.clips = draftTrack.clips; changed = true; bump()
    },
    finish() { if (changed) { commit(resize ? 'Ajustar duración clip · '+mode : 'Mover clip · '+mode); bump() } },
    cancel: restore,
  })
}
function clipResizeKeydown(e,tr,clip) {
  if (!['ArrowLeft','ArrowRight'].includes(e.key) || !guardedTrack(tr)) return
  e.preventDefault()
  const delta=(e.key==='ArrowRight'?1:-1)*(snap.value||.1)
  try { if(editTimelineClip(tl.value,tr.id,clip.id,{duration:Math.max(.05,clip.duration+delta),mode:editMode.value})) {playback.pause();commit('Ajustar duración clip');bump()} }
  catch(error){toast(error.message,'error')}
}
function eventDragDown(e,tr,key) {
  if (!tl.value || !guardedTrack(tr)) return
  const timeline = tl.value, z = zoom.value, mode = editMode.value, initial = key.t
  const original = tr.keys.map(item => ({ item, time: item.t }))
  const byId = new Map(original.map(entry => [entry.item.id, entry.item]))
  let changed = false
  const restore = () => {
    if (!changed) return
    for (const { item, time } of original) item.t = time
    tr.keys = original.map(entry => entry.item); changed = false; bump()
  }
  timelineDrag.begin(e, {
    move(_event, dx) {
      if (tl.value !== timeline || !guardedTrack(tr) || !timeline.tracks.includes(tr)) return
      const draftTrack = { ...tr, keys: original.map(({ item, time }) => ({ ...item, t: time })) }
      const draft = { ...timeline, tracks: [draftTrack] }
      try { if (!editTimelineEvent(draft,tr.id,key.id,snapT(initial+dx/z),mode)) { restore(); return } }
      catch { restore(); return }
      playback.pause()
      tr.keys = draftTrack.keys.map(item => {
        const originalKey = byId.get(item.id)
        originalKey.t = item.t
        return originalKey
      })
      changed = true; bump()
    },
    finish() { if (changed) { playback.eventsEdited(); commit('Mover evento · '+mode); bump() } },
    cancel: restore,
  })
}

function addTrack(kind) {
  addMenu.value = false
  if (kind === 'bake') return // solo se importan desde Nether Film Maker, no son claves manuales
  const tr = newTrack(kind)
  if (kind === 'node' || kind === 'method') { const o = objects.value.find((x) => x.id === store.selectedId); tr.node = o?.id || ''; tr.byId = kind === 'method' || !!o; tr.name = o?.name || tr.name }
  tl.value.tracks.push(tr); pickTrack(tr); commit('Nueva pista'); bump()
}
function delTrack(tr) { if(!guardedTrack(tr))return; tl.value.tracks = tl.value.tracks.filter((t) => t !== tr); if (sel.value?.tr === tr.id) sel.value = null; commit('Eliminar pista'); bump() }
// Menú contextual del editor: todas las acciones operan sobre los IDs aún vigentes.
function trackMenu(e, tr, at = null) {
  pickTrack(tr)
  const resourceId = tl.value.id, trackId = tr.id
  const current = () => tl.value?.id === resourceId ? tl.value.tracks.find((t) => t.id === trackId) : null
  store.menu = { x: e.clientX, y: e.clientY, returnFocus: e.currentTarget?.matches?.('button') ? e.currentTarget : null, timelineAnchor: timelineMenuAnchor(e, at === null ? 'row' : 'point'), items: [
    { heading: at === null ? (tr.name || 'Pista') : `${tr.name || 'Pista'} · ${at.toFixed(2)} s` },
    { label: at === null ? 'Añadir clave en el cabezal' : 'Añadir clave aquí', icon: 'event', disabled: !guardedTrack(tr), run: () => { const t = current(); if (t) addKey(t, at === null ? ph.value : at) } },
    ...(tr.kind === 'node' && tr.prop === 'position' ? [{ label: 'Capturar posición de cámara', icon: 'camera', run: () => { const t = current(); if (t) captureCameraForTrack(t) } }] : []),
    { label: tr.muted ? 'Activar pista' : 'Silenciar pista', icon: tr.muted ? 'volume' : 'mute', run: () => { const t = current(); if (t) toggleTrackMute(t) } },
    { label: tr.locked ? 'Desbloquear pista' : 'Bloquear pista',icon:'lock',disabled:tr.kind==='bake',run:()=>{const t=current();if(t)toggleTrackLock(t)} },
    { label: 'Sacar del grupo',icon:'move',disabled:!tr.groupId,run:()=>{const t=current();if(t && moveTimelineTrack(tl.value,t.id,{groupId:null})){commit('Sacar pista del grupo');bump()} } },
    ...(tl.value.groups||[]).filter(g=>g.id!==tr.groupId).map(group=>({label:'Mover a '+group.name,icon:'folder',run:()=>{const t=current();if(t && moveTimelineTrack(tl.value,t.id,{groupId:group.id})){commit('Agrupar pista');bump()}}})),
    { sep: true },
    { label: 'Eliminar pista', icon: 'trash', danger: true, run: () => { const t = current(); if (t) delTrack(t) } },
  ] }
}
function segmentMenu(event,track,startId) {
  const key=track.keys.find(k=>k.id===startId)
  if(!key)return
  keyMenu(event,track,key)
}
function keyMenu(e, tr, key) {
  if (!hasKey(tr,key)) pick(tr, key)
  const resourceId = tl.value.id, trackId = tr.id, keyId = key.id
  const current = () => {
    if (tl.value?.id !== resourceId) return null
    const track = tl.value.tracks.find((t) => t.id === trackId)
    return track?.keys.some((k) => k.id === keyId) ? track : null
  }
  store.menu = { x: e.clientX, y: e.clientY, timelineAnchor: timelineMenuAnchor(e, 'point'), items: [
    { heading: `Clave · ${key.t.toFixed(2)} s` },
    { label: 'Mostrar detalles', icon: 'sliders', run: () => { const t = current(); if (t) { pick(t, t.keys.find((k) => k.id === keyId)); detailsOpen.value = true } } },
    { label: 'Ir al cabezal', icon: 'pin', run: () => { const t = current(); if (t) { pick(t, t.keys.find((k) => k.id === keyId)); seekTime(t.keys.find((k) => k.id === keyId).t) } } },
    { sep: true },
    { label: chosenCount.value > 1 ? `Duplicar ${chosenCount.value} claves` : 'Duplicar clave', icon: 'copy', disabled:!guardedTrack(tr), run: () => { if (current()) dupKey() } },
    ...(['audio','commands','method'].includes(tr.kind) ? [{label:`Mover evento al cabezal · ${editMode.value}`,icon:'pin',disabled:editMode.value==='mix'||!guardedTrack(tr),run:()=>{const t=current();if(t)moveEventToHead(t,t.keys.find(k=>k.id===keyId))}}] : []),
    { label: chosenCount.value > 1 ? `Eliminar ${chosenCount.value} claves` : 'Eliminar clave', icon: 'trash', danger: true, disabled:!guardedTrack(tr), run: () => { if (current()) delKey() } },
  ] }
}
function laneMenu(e, tr) {
  const r = e.currentTarget.getBoundingClientRect()
  trackMenu(e, tr, snapT(xToTime(e.clientX - r.left)))
}
function captureView() {
  const c = store.editor?.vp?.persp; if (!c) return null
  return { pos: c.position.toArray().map((v) => +v.toFixed(3)), rot: rotFromQuat(c.quaternion).map((v) => +v.toFixed(2)), fov: c.fov }
}
function addKey(tr, t = ph.value) {
  if (!guardedTrack(tr) || !tl.value) return null
  t = snapT(t)
  if (tr.kind === 'node') {
    const node = trackOwner(tr)
    if (!node) { toast('El nodo de esta propiedad ya no está disponible', 'error'); return null }
    return insertNodePropertyKey(node, tr.prop, t)
  }
  let extra = {}
  if (tr.kind === 'camera') {
    const v = captureView()
    if (v) extra = { pos: v.pos, rot: v.rot, fov: Math.round(v.fov) }
  }
  const key = newKey(tr.kind, t, extra)
  tr.keys.push(key); sortKeys(tr); pick(tr, key); commit('Nueva clave'); bump()
  return key
}

function delKey() {
  if (!tl.value || !keyRefs.value.length || !guardedTrack(selTrack.value)) return
  const trackId = sel.value?.tr
  let deleted
  try { deleted = deleteTimelineSelection(tl.value, keyRefs.value) }
  catch(error) {toast(error.message,'error');return}
  if (!deleted) return
  sel.value = tl.value.tracks.some(track => track.id === trackId) ? { tr:trackId } : null
  commit(deleted > 1 ? 'Eliminar claves' : 'Eliminar clave'); bump()
}
function dupKey() {
  if (!tl.value || !keyRefs.value.length || !guardedTrack(selTrack.value)) return
  const refs = duplicateTimelineSelection(tl.value, keyRefs.value, Math.max(1, snap.value || 1))
  if (!refs.length) { toast('No hay espacio temporal para duplicar las claves', 'error'); return }
  selectRefs(refs)
  commit(refs.length > 1 ? 'Duplicar claves' : 'Duplicar clave'); bump()
}
const setTl = (patch) => { Object.assign(tl.value, patch); commit('Editar timeline'); bump() }
const exitReasons = [['natural','Al terminar'],['stop','Al detener'],['skip','Al omitir'],['interrupted','Si se interrumpe']]
const exitOptions = [['keep','Mantener fuente viva'],['previous','Cámara anterior'],['pose','Mantener pose fija'],['player','Jugador'],['base','Cámara base']]
function setTimelineCameraExit(reason, raw) {
  if (!tl.value || store.locked || store.play.on || raw === 'current') return
  const policies = normalizeTimelineCameraExit(tl.value.cameraExit || NEW_TIMELINE_CAMERA_EXIT)
  let policy = { to: raw }
  if (raw.startsWith('camera3d|')) {
    const id = raw.slice('camera3d|'.length)
    const node = store.project.objects.find(o => o.type === 'camera' && o.id === id)
    if (!node) { toast('Camera3D no disponible en la escena actual', 'error'); return }
    policy = { to:'camera3d', sceneId:store.project.activeSceneId, cameraId:id }
  }
  policies[reason] = policy
  setTl({ cameraExit: normalizeTimelineCameraExit(policies) })
}
function cameraExitSelection(reason) {
  const policy = tl.value?.cameraExit?.[reason]
  if (!policy) return 'current' // No reetiquetar Timelines existentes automáticamente.
  return policy.to === 'camera3d' ? `camera3d|${policy.cameraId}` : policy.to
}

function updateDuration(value, save = false) {
  if (!tl.value || !Number.isFinite(value)) return false
  const min = timelineMinDuration(tl.value)
  const next = Math.max(min, +value.toFixed(5))
  if (save && value < min) toast(`La última clave termina en ${min.toFixed(2)} s; no se puede recortar sin eliminar contenido`, 'error')
  if (next === tl.value.duration) return false
  tl.value.duration = next
  if (ph.value > next) ph.value = next
  bump()
  if (save) commit('Cambiar duración del Timeline')
  return true
}
function dur(e) {
  const requested = Math.max(0.5, Number(e.target.value) || 10)
  if (requested !== tl.value?.duration) playback.pause()
  updateDuration(requested, true)
  e.target.value = tl.value.duration
}
function beginDurationResize(e) {
  if (e.button !== 0 || !tl.value) return
  e.preventDefault(); e.stopPropagation()
  const original = tl.value.duration, startX = e.clientX, initialZoom = zoom.value, resourceId = tl.value.id
  const move = ev => {
    if (tl.value?.id !== resourceId) return
    if (Math.abs(ev.clientX-startX)<3) return
    if (playing.value) playback.pause()
    const raw = original + (ev.clientX - startX) / initialZoom
    const rounded = snap.value ? Math.round(raw / snap.value) * snap.value : raw
    updateDuration(rounded)
  }
  const end = () => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end)
    if (tl.value?.id === resourceId && tl.value.duration !== original) commit('Redimensionar duración del Timeline')
  }
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end)
}
function durationKeydown(e) {
  if (!['ArrowLeft', 'ArrowRight'].includes(e.key) || !tl.value) return
  e.stopPropagation(); e.preventDefault()
  const value = tl.value.duration + (e.key === 'ArrowRight' ? 1 : -1) * (snap.value || 0.1)
  playback.pause()
  updateDuration(value, true)
}
// Audio dispone de «duration» real en el Inspector. No aplica a Comandos/Naturaleza/Métodos.
function audioTrimSnapshot(key) {
  return { t: key.t, offset: key.offset, duration: key.duration,
    points: Array.isArray(key.volumeAutomation) ? key.volumeAutomation.map(point => ({ ...point })) : null }
}
function restoreAudioTrim(key, snapshot, track) {
  key.t = snapshot.t; key.offset = snapshot.offset; key.duration = snapshot.duration
  if (snapshot.points) key.volumeAutomation = snapshot.points.map(point => ({ ...point }))
  else delete key.volumeAutomation
  sortKeys(track)
}
function audioTrimChanged(key, original) {
  return key.t !== original.t || key.offset !== original.offset || key.duration !== original.duration ||
    JSON.stringify(key.volumeAutomation || null) !== JSON.stringify(original.points)
}
function audioTrimDown(e, tr, key, edge) {
  if (e.button !== 0 || !tl.value || !guardedTrack(tr) || key.action !== 'play') return
  const source = audioSourceSeconds.get(key.clip)
  if (!(source > 0)) { toast('Espera al análisis de la fuente antes de recortar el audio', 'warn'); return }
  e.preventDefault(); e.stopPropagation(); pick(tr, key)
  const timeline = tl.value, original = audioTrimSnapshot(key), initialZoom = zoom.value
  const originalSpan = audioDisplayDuration(key)
  timelineDrag.begin(e, {
    move(_event, dx) {
      if (tl.value !== timeline || !guardedTrack(tr) || !timeline.tracks.includes(tr)) return
      // El desplazamiento absoluto parte de la fotografía inicial. Un gesto inválido
      // mantiene el último estado válido en pantalla, sin saltar al origen.
      const previous = audioTrimSnapshot(key)
      restoreAudioTrim(key, original, tr)
      const raw = (edge === 'left' ? original.t : originalSpan) + dx / initialZoom
      const next = snap.value ? Math.round(raw / snap.value) * snap.value : raw
      if (trimTimelineAudioKey(timeline, tr.id, key.id, edge, +next.toFixed(5), source)) {
        playback.pause(); bump()
      } else {
        restoreAudioTrim(key, previous, tr); bump()
      }
    },
    finish() {
      if (audioTrimChanged(key, original)) {
        playback.eventsEdited(); commit(edge === 'left' ? 'Recortar inicio de Audio' : 'Recortar fin de Audio'); bump()
      }
    },
    cancel() { if (audioTrimChanged(key, original)) { restoreAudioTrim(key, original, tr); bump() } },
  })
}
function audioResizeDown(e, tr, key) { audioTrimDown(e, tr, key, 'right') }
function audioTrimKeydown(e, tr, key, edge) {
  if (!['ArrowLeft','ArrowRight','Home'].includes(e.key) || !tl.value || !guardedTrack(tr) || key.action !== 'play') return
  const source = audioSourceSeconds.get(key.clip)
  if (!(source > 0)) return
  e.preventDefault(); e.stopPropagation(); pick(tr,key)
  const step = snap.value || 0.1
  const before = audioTrimSnapshot(key)
  const rate = Math.max(.1, Math.min(4, Number(key.pitch) || 1))
  const earliest = Math.max(0, key.t - Math.max(0, Number(key.offset) || 0) / rate)
  const next = edge === 'left'
    ? (e.key === 'Home' ? earliest : key.t + (e.key === 'ArrowRight' ? step : -step))
    : (e.key === 'Home' ? 0 : audioDisplayDuration(key) + (e.key === 'ArrowRight' ? step : -step))
  const edited = edge === 'right' && e.key === 'Home'
    ? (key.fadeOut <= 0 && resizeTimelineAudioKey(tl.value,tr.id,key.id,0))
    : trimTimelineAudioKey(tl.value,tr.id,key.id,edge,+next.toFixed(5),source)
  if (edited) {
    playback.pause(); playback.eventsEdited()
    commit(edge === 'left' ? 'Recortar inicio de Audio' : 'Recortar fin de Audio'); bump()
  }
}
function audioResizeKeydown(e, tr, key) { audioTrimKeydown(e, tr, key, 'right') }
function audioTrimLeftKeydown(e, tr, key) { audioTrimKeydown(e, tr, key, 'left') }

function audioFadeSpan(key) {
  if (key.duration > 0) return audioDisplayDuration(key)
  // No usar el placeholder de 1 s para editar un audio todavía sin analizar.
  return audioSourceSeconds.get(key.clip) > 0 ? audioDisplayDuration(key) : 0
}
function audioFadeMax(key, field) {
  if (field === 'fadeOut' && key.duration <= 0) return 0
  const opposite = Math.max(0, Number(key[field === 'fadeIn' ? 'fadeOut' : 'fadeIn']) || 0)
  return Math.max(0, audioFadeSpan(key) - (key.duration > 0 ? opposite : 0))
}
function audioFadePath(key) {
  const width = audioFadeSpan(key) * zoom.value
  const fadeIn = Math.min(width, Math.max(0, key.fadeIn || 0) * zoom.value)
  const fadeOut = key.duration > 0 ? Math.min(Math.max(0, width - fadeIn), Math.max(0, key.fadeOut || 0) * zoom.value) : 0
  return `M0 ${fadeIn > 0 ? 23 : 4} L${fadeIn} 4 L${width - fadeOut} 4 L${width} ${fadeOut > 0 ? 23 : 4}`
}
function audioFadeDown(event, track, key, field) {
  if (event.button !== 0 || !tl.value || !guardedTrack(track) || key.action !== 'play' || !(audioFadeSpan(key) > 0)) return
  if (field === 'fadeOut' && key.duration <= 0) return
  event.preventDefault(); event.stopPropagation(); pick(track, key)
  const timeline = tl.value, original = key[field], initialZoom = zoom.value, startSpan = audioFadeSpan(key)
  timelineDrag.begin(event, {
    move(_event, dx) {
      if (tl.value !== timeline || !guardedTrack(track) || !timeline.tracks.includes(track)) return
      const desired = original + (field === 'fadeOut' ? -dx : dx) / initialZoom
      const rounded = snap.value ? Math.round(desired / snap.value) * snap.value : desired
      const limit = Math.max(0, Math.min(startSpan, audioFadeMax(key, field)))
      const next = +Math.min(limit, Math.max(0, rounded)).toFixed(5)
      if (resizeTimelineAudioFade(timeline, track.id, key.id, field, next, startSpan)) {
        playback.pause(); bump()
      }
    },
    finish() {
      if (key[field] !== original) {
        playback.eventsEdited(); commit(field === 'fadeIn' ? 'Ajustar fundido de entrada' : 'Ajustar fundido de salida'); bump()
      }
    },
    cancel() { if (key[field] !== original) { key[field] = original; bump() } },
  })
}
function audioFadeKeydown(event, track, key, field) {
  if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key) || !tl.value || !guardedTrack(track)) return
  if (field === 'fadeOut' && key.duration <= 0) return
  event.preventDefault(); event.stopPropagation(); pick(track, key)
  const step = snap.value || 0.1
  const next = event.key === 'Home' ? 0 : Math.max(0, Math.min(audioFadeMax(key, field), key[field] + (event.key === 'ArrowRight' ? step : -step)))
  if (resizeTimelineAudioFade(tl.value, track.id, key.id, field, +next.toFixed(5), audioFadeSpan(key))) {
    playback.pause(); playback.eventsEdited(); commit(field === 'fadeIn' ? 'Ajustar fundido de entrada' : 'Ajustar fundido de salida'); bump()
  }
}

function audioVolumePath(key) {
  const points = key.volumeAutomation || []
  const width = Math.max(1, key.duration * zoom.value)
  const commands = ['M0 4']
  for (const point of points) commands.push(`L${point.t * zoom.value} ${23 - 19 * point.value}`)
  commands.push(`L${width} ${23 - 19 * (points.at(-1)?.value ?? 1)}`)
  return commands.join(' ')
}
function audioVolumeAddFromClip(event, track, key) {
  // Doble clic normal conserva la operación del clip. Solo Ctrl crea un punto.
  if (!event.ctrlKey || event.metaKey || event.button !== 0 || track.kind !== 'audio') return
  if (!tl.value || !guardedTrack(track) || key.action !== 'play' || !(key.duration > 0)) return
  event.preventDefault(); event.stopPropagation(); pick(track, key)
  const rect = event.currentTarget.getBoundingClientRect()
  const relative = (event.clientX - rect.left) / zoom.value
  const at = Math.max(0, Math.min(key.duration, snap.value ? Math.round(relative / snap.value) * snap.value : relative))
  const value = Math.max(0, Math.min(1, 1 - (event.clientY - rect.top - 5) / 19))
  if (editTimelineAudioVolumePoint(tl.value, track.id, key.id, 'add', { id: uid('av'), t: +at.toFixed(5), value: +value.toFixed(4) })) {
    playback.pause(); playback.eventsEdited(); commit('Crear punto de volumen'); bump()
  }
}
function audioVolumeDown(event, track, key, point) {
  if (event.button !== 0 || !tl.value || !guardedTrack(track)) return
  event.preventDefault(); event.stopPropagation(); pick(track, key)
  const timeline = tl.value, initial = { ...point }, startZoom = zoom.value
  timelineDrag.begin(event, {
    axis: 'both',
    move(_event, dx, dy) {
      if (tl.value !== timeline || !guardedTrack(track)) return
      const time = initial.t + dx / startZoom
      const at = Math.max(0, Math.min(key.duration, snap.value ? Math.round(time / snap.value) * snap.value : time))
      const value = Math.max(0, Math.min(1, initial.value - dy / 19))
      if (editTimelineAudioVolumePoint(timeline, track.id, key.id, 'move', { id: initial.id, t: +at.toFixed(5), value: +value.toFixed(4) })) {
        playback.pause(); bump()
      }
    },
    finish() {
      const current = key.volumeAutomation?.find(entry => entry.id === initial.id)
      if (current && (current.t !== initial.t || current.value !== initial.value)) {
        playback.eventsEdited(); commit('Mover punto de volumen'); bump()
      }
    },
    cancel() {
      if (editTimelineAudioVolumePoint(timeline, track.id, key.id, 'move', initial)) bump()
    },
  })
}
function audioVolumeKeydown(event, track, key, point) {
  if (!tl.value || !guardedTrack(track) || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','Delete','Backspace'].includes(event.key)) return
  event.preventDefault(); event.stopPropagation(); pick(track, key)
  if (event.key === 'Delete' || event.key === 'Backspace') {
    if (editTimelineAudioVolumePoint(tl.value, track.id, key.id, 'remove', { id: point.id })) {
      playback.pause(); playback.eventsEdited(); commit('Eliminar punto de volumen'); bump()
    }
    return
  }
  const step = snap.value || 0.1
  const at = ['ArrowLeft','ArrowRight'].includes(event.key) ? Math.max(0, Math.min(key.duration, point.t + (event.key === 'ArrowRight' ? step : -step))) : point.t
  const value = event.key === 'Home' ? 1 : ['ArrowUp','ArrowDown'].includes(event.key) ? Math.max(0, Math.min(1, point.value + (event.key === 'ArrowUp' ? .05 : -.05))) : point.value
  if (editTimelineAudioVolumePoint(tl.value, track.id, key.id, 'move', { id: point.id, t: +at.toFixed(5), value: +value.toFixed(4) })) {
    playback.pause(); playback.eventsEdited(); commit('Editar punto de volumen'); bump()
  }
}

function beginSegmentResize(e, tr, startId) {
  if (e.button !== 0 || !tl.value || !guardedTrack(tr) || !['node', 'camera'].includes(tr.kind)) return
  e.preventDefault(); e.stopPropagation()
  const keys = [...tr.keys].sort((a, b) => a.t - b.t)
  const index = keys.findIndex(key => key.id === startId), endKey = keys[index + 1]
  if (!endKey) return
  pick(tr, endKey)
  const timeline = tl.value, original = endKey.t, initialZoom = zoom.value
  timelineDrag.begin(e, {
    move(_event, dx) {
      if (tl.value !== timeline || !guardedTrack(tr)) return
      if (retimeTimelineSegment(tr, startId, original + dx / initialZoom, timeline.duration, snap.value)) {
        playback.pause(); bump()
      }
    },
    finish() { if (endKey.t !== original) { commit('Ajustar duración del segmento'); bump() } },
    cancel() { if (endKey.t !== original) { endKey.t = original; sortKeys(tr); bump() } },
  })
}
function captureCameraForTrack(tr) {
  if (!tl.value || tr?.locked || tr?.kind !== 'node' || tr.prop !== 'position') return
  const obj = trackObject(tr), cam = store.editor?.vp?.persp
  if (!obj || !cam) { toast('Selecciona un nodo válido y una cámara de Editor', 'error'); return }
  cam.updateMatrixWorld(true)
  const world = cam.getWorldPosition(new THREE.Vector3())
  const parent = obj.parentId ? worldMatrix(obj.parentId) : new THREE.Matrix4()
  if (Math.abs(parent.determinant()) < 1e-10) { toast('Transform del padre no invertible', 'error'); return }
  const local = world.applyMatrix4(parent.clone().invert()).toArray().map(v => +v.toFixed(5))
  if (!local.every(Number.isFinite)) { toast('Posición calculada inválida', 'error'); return }
  const time = snapT(ph.value)
  let key = tr.keys.find(k => Math.abs(k.t - time) < 1e-5)
  if (!key) { key = newKey('node', time, { v: local }); tr.keys.push(key); sortKeys(tr) }
  else key.v = local
  pick(tr, key); commit('Capturar posición de cámara'); bump()
}
// ---------- ratón: cabezal, claves ----------
function scrub(e, target = ruler.value) {
  if (!tl.value || !target) return
  // La posición del carril incluye el scroll real; no se resta una cabecera fija.
  const x = e.clientX - target.getBoundingClientRect().left
  seekTime(xToTime(x))
}
function scrubDown(e, target = ruler.value, fromHandle = false) {
  if (e.button !== 0 || !target || !tl.value) return
  playback.pause()
  const initialTime = ph.value, initialX = e.clientX, initialZoom = zoom.value
  if (!fromHandle) scrub(e, target)
  // El asa conserva el tiempo al pulsarla: solo el desplazamiento mueve el cabezal.
  const mv = (ev) => {
    if (fromHandle) seekTime(initialTime + (ev.clientX - initialX) / initialZoom)
    else scrub(ev, target)
  }
  const up = () => {
    window.removeEventListener('pointermove', mv)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
  }
  window.addEventListener('pointermove', mv)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}
function playheadKeydown(e) {
  if (!tl.value) return
  const delta = snap.value || 0.1
  let next = ph.value
  if (e.key === 'ArrowLeft') next -= delta
  else if (e.key === 'ArrowRight') next += delta
  else if (e.key === 'Home') next = 0
  else if (e.key === 'End') next = tl.value.duration
  else return
  e.preventDefault()
  e.stopPropagation()
  playback.pause()
  seekTime(+next.toFixed(5))
}
function marqueeDown(e) {
  if (!tl.value || !inner.value || store.locked || store.play.on || e.button !== 0) return
  e.stopPropagation(); e.preventDefault()
  root.value?.focus({preventScroll:true})
  const resourceId = tl.value.id, origin = inner.value.getBoundingClientRect()
  const x0 = Math.max(0, Math.min(tl.value.duration * zoom.value, e.clientX - origin.left - TIME_ORIGIN_PX))
  const y0 = Math.max(0, e.clientY - origin.top - 29)
  let dragged = false
  const update = ev => {
    if (tl.value?.id !== resourceId || !inner.value) return
    const r = inner.value.getBoundingClientRect()
    const x = Math.max(0, Math.min(tl.value.duration * zoom.value, ev.clientX - r.left - TIME_ORIGIN_PX))
    const y = Math.max(0, Math.min((rowBounds.value.at(-1) || 0), ev.clientY - r.top - 29))
    if (Math.abs(x - x0) > 4 || Math.abs(y - y0) > 4) dragged = true
    if (dragged) marquee.value = { x:Math.min(x,x0), y:Math.min(y,y0), w:Math.abs(x-x0), h:Math.abs(y-y0) }
  }
  const clean = () => {
    window.removeEventListener('pointermove', update)
    window.removeEventListener('pointerup', finish)
    window.removeEventListener('pointercancel', cancel)
    marquee.value = null
  }
  const finish = ev => {
    update(ev)
    const rect = marquee.value
    clean()
    if (!rect || !tl.value || tl.value.id !== resourceId) return
    const refs = timelineKeysInRegion(tl.value, rect.x / zoom.value, (rect.x + rect.w) / zoom.value,
      timelineRowAt(rect.y), timelineRowAt(rect.y + rect.h), visibleRows.value)
    const combined = e.ctrlKey || e.metaKey ? timelineSelectedKeys(tl.value, [...keyRefs.value, ...refs]).map(s => ({tr:s.tr,k:s.k})) : refs
    selectRefs(combined)
  }
  const cancel = () => clean()
  window.addEventListener('pointermove', update)
  window.addEventListener('pointerup', finish)
  window.addEventListener('pointercancel', cancel)
}
function laneDown(e, tr) {
  if (e.target !== e.currentTarget) return
  if (e.shiftKey) marqueeDown(e)
  else if (tr.kind === 'node' && e.ctrlKey && !e.metaKey) { pickTrack(tr); playback.pause() }
  else { pickTrack(tr); scrubDown(e, e.currentTarget) }
}
function keyDown(e, tr, k) {
  if (e.button !== 0 || tr.locked || tr.kind==='bake' || store.locked || store.play.on) return
  e.stopPropagation()
  if (e.ctrlKey || e.metaKey || e.shiftKey) { pick(tr,k,e); return }
  const wasMulti = chosenCount.value > 1 && hasKey(tr,k)
  pick(tr,k,e)
  if (['audio','commands','method'].includes(tr.kind) && editMode.value!=='mix' && keyRefs.value.length===1) {eventDragDown(e,tr,k);return}
  beginKeyDrag(e,tr,k,keyRefs.value.map(r=>({...r})),wasMulti)
}
function beginKeyDrag(e,tr,k,refs,wasMulti = false) {
  const timeline = tl.value, startZoom = zoom.value
  const initial = timelineSelectedKeys(timeline,refs).map(s => ({key:s.key, track:s.track, t:s.key.t}))
  let lastShift = 0
  const restore = () => {
    if (!lastShift) return
    const tracks = new Set()
    for (const x of initial) {x.key.t = x.t;tracks.add(x.track)}
    for (const track of tracks) sortKeys(track)
  }
  timelineDrag.begin(e, {
    move(_event, dx) {
      if (tl.value !== timeline || !guardedTrack(tr) || !initial.length) return
      restore()
      const shift = timelineSelectionMoveDelta(timeline, refs, dx/startZoom,
        {snap:snap.value, playhead:ph.value, zoom:startZoom, anchor:{tr:tr.id,k:k.id}})
      const applied = moveTimelineSelection(timeline, refs, shift)
      if (applied) playback.pause()
      if (lastShift || applied) bump()
      lastShift = applied
    },
    finish(dragging) {
      if (lastShift) {
        if (initial.some(({ track }) => ['audio','commands','method'].includes(track.kind))) playback.eventsEdited()
        commit(initial.length > 1 ? 'Mover claves' : 'Mover clave'); bump()
      } else if (!dragging && wasMulti) selectRefs([{tr:tr.id,k:k.id}])
    },
    cancel() { if (lastShift) { restore(); bump() } },
  })
}
function laneDbl(e, tr) {
  if (!guardedTrack(tr)) return
  if (tr.kind === 'node') {
    if (!e.ctrlKey || e.metaKey || e.button !== 0) return
    // Una clave/clip existente conserva su doble clic y nunca crea otra encima.
    if (e.target.closest?.('.key,.timeline-live-clip,.clip-tail-external')) return
    e.preventDefault()
    playback.pause()
  } else if (e.target !== e.currentTarget) return
  const r = e.currentTarget.getBoundingClientRect()
  addKey(tr, xToTime(e.clientX - r.left))
}
function keydown(e) {
  if (e.code === 'Escape' && (detailsOpen.value || cancelPendingNode())) {
    if (detailsOpen.value) closeDetails()
    e.preventDefault()
    return
  }
  if (e.target.closest('.timeline-details, input, textarea, select')) return
  if (e.code === 'Space' && e.target.closest('button')) return
  if (e.code === 'Delete' || e.code === 'Backspace') { if(selClip.value) removeClip();else delKey();e.preventDefault();e.stopPropagation() }
  else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyD') { dupKey();e.preventDefault();e.stopPropagation() }
  else if (e.code === 'Escape' && (chosenCount.value > 1 || selClip.value)) {sel.value = null; e.preventDefault()}
  else if (e.code === 'Space') { togglePlay(); e.preventDefault() }
  else if (e.code === 'Home') seekTime(0)
  else if (e.code === 'End') seekTime(tl.value?.duration || 0)
}

// ---------- transporte persistente en App: el panel solo muestra su estado. ----------
function togglePlay() {if (tl.value && !store.play.on && !store.locked) playback.toggle(tl.value,selTrack.value)}
function stop() {playback.stop()}
function preview() {playback.refresh(tl.value,selTrack.value)}
function togglePreviewEditing() {
  if (playing.value || !tl.value) return
  if (previewOn.value) playback.yieldToEditing()
  else { previewOn.value = true; preview() }
}
function seekTime(value) {
  if (!tl.value) return
  playback.pause()
  const previous = ph.value
  playback.seek(Math.max(0, Math.min(tl.value.duration, Number(value) || 0)))
  if (ph.value === previous) preview()
}
// Cambiar de recurso invalida la sesión; volver a montar el panel NO la reinicia.
watch(() => tl.value?.id, (id,previous) => {
  timelineDrag.cancel()
  if (previous !== undefined && previous !== id && playback.resourceId && playback.resourceId !== id) playback.stop()
  sel.value=null
  nodeTargetId.value=null
  detailsOpen.value=false
},{flush:'sync'})
watch(() => [store.project?.id, store.project?.activeSceneId], () => {
  if (store.menu?.returnFocus && root.value?.contains(store.menu.returnFocus)) store.menu = null
  playback.validate()
  sel.value = null
  nodeTargetId.value = null
  detailsOpen.value = false
})
watch(() => store.temporalSelection, (context) => {
  if (context?.kind !== 'timeline' || context.resourceId !== tl.value?.id) return
  if (context.element === 'resource') { if (sel.value) sel.value = null;return }
  if (context.element === 'group') {if(sel.value?.group!==context.itemId)sel.value={group:context.itemId};return}
  if (context.element === 'marker') {if(sel.value?.marker!==context.itemId)sel.value={marker:context.itemId};return}
  if (context.element === 'track') {
    if (sel.value?.tr !== context.trackId || sel.value?.k || sel.value?.clip) sel.value = {tr:context.trackId}
    return
  }
  if(context.element === 'clip') {
    if(sel.value?.tr!==context.trackId || sel.value?.clip!==context.itemId) sel.value={tr:context.trackId,clip:context.itemId}
    return
  }
  if (context.element !== 'key') return
  const refs = context.keyRefs?.length > 1 ? context.keyRefs : [{tr:context.trackId,k:context.itemId}]
  if (sel.value?.k !== context.itemId || sel.value?.tr !== context.trackId ||
    keyRefs.value.length !== refs.length || refs.some((ref,i)=>ref.tr !== keyRefs.value[i]?.tr || ref.k !== keyRefs.value[i]?.k)) {
    sel.value = {tr:context.trackId,k:context.itemId,...(refs.length > 1 ? {keys:refs.map(ref=>({...ref}))} : {})}
  }
})
watch(tl, () => {
  timelineDrag.cancel()
  if (sel.value?.marker && !tl.value?.markers?.some(m=>m.id===sel.value.marker))sel.value=null
  if (sel.value?.group && !tl.value?.groups?.some(g=>g.id===sel.value.group))sel.value=null
  if (sel.value?.clip && !tl.value?.tracks.find(tr=>tr.id===sel.value.tr)?.clips?.some(c=>c.id===sel.value.clip)) sel.value=null
  if (sel.value?.tr && !selTrack.value) sel.value = null
  if (sel.value?.k && !selKey.value && !sel.value.keys?.length) sel.value = { tr: sel.value.tr }
  if (sel.value?.keys?.length) {
    const kept = timelineSelectedKeys(tl.value, sel.value.keys).map(s=>({tr:s.tr,k:s.k}))
    if (kept.length !== sel.value.keys.length) selectRefs(kept)
  }
})
watch(() => store.temporalSeek, (seek) => {if(seek?.kind==='timeline' && seek.resourceId===tl.value?.id)seekTime(seek.time)})
watch([ph,ver,previewOn,tl,sel,()=>store.selectedId,()=>store.temporalEditRevision,()=>store.editor],preview,{flush:'post',immediate:true})
// Cambiar de pestaña solo limpia UI contextual. Nunca se interpreta como Stop.
watch(() => store.ui.mode==='desktop' ? store.prefs.bottomTab === 'timeline' : store.prefs.bottomTab==='timeline', visible => {
  if(!visible){
    libraryOpen.value=false;addMenu.value=false;optMenu.value=false
    detailsOpen.value=false;nodeTargetId.value=null;timelineDrag.cancel()
    if (store.menu?.returnFocus && root.value?.contains(store.menu.returnFocus)) store.menu=null
  }
  else if(tl.value){
    preview()
  }
})
onBeforeUnmount(() => { timelineDrag.cancel(); window.removeEventListener('pointerdown', outsideMenus); window.removeEventListener('keydown', dismissMenus); window.removeEventListener('keydown', trackCtrlKey); window.removeEventListener('keyup', trackCtrlKey); window.removeEventListener('blur', clearCtrlCursor); document.removeEventListener('visibilitychange', resetCtrlOnVisibility); window.removeEventListener('resize', repositionPopup); window.removeEventListener('scroll', repositionPopup, true); resizeObserver?.disconnect(); if (store.menu?.returnFocus && root.value?.contains(store.menu.returnFocus)) store.menu=null })

// La fuente se analiza para dibujar su onda: reutilizar esa duración sin persistirla en claves legacy.
const audioSourceSeconds = reactive(new Map())
watch(() => store.project?.id, () => audioSourceSeconds.clear())
function recordAudioSourceDuration(clip, seconds) {
  if (Number.isFinite(seconds) && seconds > 0) audioSourceSeconds.set(clip, seconds)
  else audioSourceSeconds.delete(clip)
}
const audioDisplayDuration = (k) => {
  const remaining = Math.max(0, (tl.value?.duration || 0) - k.t)
  if (k.duration > 0) return Math.min(k.duration, remaining)
  const source = audioSourceSeconds.get(k.clip)
  if (source > 0) return Math.min(remaining, k.loop ? remaining : audioSourcePlaybackSpan(source, k))
  return Math.min(1, remaining) // Placeholder únicamente mientras falta el análisis PCM.
}
const keyLabel = (tr, k) => (tr.kind === 'method' ? (k.method ? k.method + '()' : '(elegir método)') : tr.kind === 'audio' ? (k.action === 'stop' ? '■ ' + k.group : k.clip || '(sin clip)') : tr.kind === 'commands' ? k.name || (k.list?.length ? `${k.list.length} cmd` : '(vacío)') : '')
// La continuidad solo representa intervalos entre claves reales; nunca crea ni evalúa animaciones.
const motionSpans = (tr) => (tr.kind === 'camera' || tr.kind === 'node' ? tr.keys : []).slice(0, -1)
  .map((key, index) => ({ id: key.id, l: timeToX(key.t),
    w: Math.max(0, (tr.keys[index + 1].t - key.t) * zoom.value),
    cut: key.ease === 'cut' || tr.interpolation === 'nearest' }))
  .filter(segment => segment.w > 0)
function keyWidth(tr, key, index) {
  if (tr.kind === 'camera' || tr.kind === 'node') return 14
  // sortKeys() conserva el orden: obtener la siguiente clave en O(1), sin escanear la pista por clave.
  const next = tr.keys[index + 1]?.t
  return Math.max(14, Math.min(144, Number.isFinite(next) && next > key.t ? (next - key.t) * zoom.value - 8 : 144))
}
</script>

<template>
  <div ref="root" class="tlp" :style="{'--tl-node-row-height':NODE_ROW_HEIGHT+'px','--tl-property-row-height':PROPERTY_ROW_HEIGHT+'px'}" :class="{ 'ctrl-over-clips': ctrlOverClips }" tabindex="0" @pointerenter="syncCtrlPointer" @keydown="keydown" @keydown.esc.stop="dismissMenus">
    <header class="timeline-titlebar">
        <div class="timeline-selector">
        <button ref="libraryButton" type="button" class="timeline-picker" :aria-expanded="libraryOpen" aria-haspopup="dialog" aria-controls="timeline-library-popup" aria-label="Seleccionar Timeline" :title="tl?.name || 'Seleccionar Timeline'" @click="togglePopup('library')">
          <Icon name="play" :size="14" /><span class="picker-name">{{ tl?.name || 'Seleccionar Timeline' }}</span><Icon name="chevd" :size="12" />
        </button>
        <Teleport to="body"><div v-if="libraryOpen" id="timeline-library-popup" ref="libraryPopup" class="library-pop timeline-dropdown" :style="popupPlacement" role="dialog" aria-label="Seleccionar Timeline" @keydown="libraryKeydown">
          <div class="library-search"><Icon name="search" :size="14" /><input ref="librarySearch" v-model="search" type="search" placeholder="Buscar Timeline…" aria-label="Buscar Timeline" autocomplete="off" /></div>
          <small class="library-count">TIMELINES · {{ listing.length }}{{ search.trim() ? ' / ' + timelines.length : '' }}</small>
          <div class="library-list" aria-label="Timelines disponibles">
            <button v-for="resource in listing" :key="resource.id" class="timeline-item" type="button" :class="{ active: tl?.id === resource.id }" :aria-pressed="tl?.id === resource.id" @click="chooseTimeline(resource.id)"><Icon name="play" :size="14" /><span><b>{{ resource.name }}</b><small>{{ resource.folder || 'Assets' }} · {{ resource.duration }} s</small></span><Icon v-if="tl?.id === resource.id" name="check" :size="14" class="library-selected" /></button>
            <p v-if="!timelines.length" class="library-hint">No hay Timelines. Usa «Nuevo Timeline» para crear uno.</p>
            <p v-else-if="!listing.length" class="library-hint">No se encontraron Timelines.</p>
          </div>
          <small class="library-footnote">↑↓ Navegar · Enter Abrir · Esc Cerrar</small>
        </div></Teleport>
      </div>
      <span class="timeline-subtitle" :title="tl?.folder || 'Assets'">{{ tl?.folder || 'Assets' }}</span>
      <span class="grow"></span>
      <button type="button" class="create-timeline" :disabled="store.locked || store.play.on" @click="createTimelineDialog()"><Icon name="plus" :size="13" /><span>Nuevo Timeline</span></button>
    </header>
    <div class="timeline-editor">
    <div v-if="!tl" class="empty">
      <b>Timeline</b>
      <p class="lf-help">Selecciona un recurso desde el menú superior o crea un Timeline. También puedes abrirlo desde Assets.</p>
    </div>
    <template v-else>
      <div class="bar" role="toolbar" aria-label="Controles de Timeline" tabindex="0">
        <div v-if="chosenCount > 1" class="selection-tools" aria-live="polite">
          <span>{{ chosenCount }} claves</span>
          <button type="button" aria-label="Duplicar claves seleccionadas" title="Duplicar selección (Ctrl+D)" :disabled="store.locked || store.play.on" @click="dupKey"><Icon name="copy" :size="12" /></button>
          <button type="button" aria-label="Eliminar claves seleccionadas" title="Eliminar selección" :disabled="store.locked || store.play.on" @click="delKey"><Icon name="trash" :size="12" /></button>
        </div>
        
        <div class="transport">
          <button class="tp" type="button" aria-label="Ir al inicio" data-tooltip="Ir al inicio" @click="stop"><Icon name="step" :size="13" class="reverse-step" /></button>
          <button class="tp" type="button" aria-label="Retroceder un intervalo" data-tooltip="Retroceder según Snap" @click="stepTime(-1)"><Icon name="step" :size="13" class="reverse-step" /></button>
          <button class="tp" :class="{ on: playing }" :aria-label="playing ? 'Pausar' : 'Reproducir'" :data-tooltip="playing ? 'Pausa (Espacio)' : 'Reproducir (Espacio)'" @click="togglePlay"><Icon :name="playing ? 'pause' : 'play'" :size="14" /></button>
          <button class="tp" aria-label="Detener" data-tooltip="Detener y volver al inicio" @click="stop"><Icon name="stop" :size="14" /></button>
          <button class="tp" type="button" :disabled="playing" :aria-label="previewOn ? 'Editar pose autoral' : 'Volver a vista previa'"
            :data-tooltip="previewOn ? 'Editar pose autoral durante pausa' : 'Volver a vista previa temporal'" @click="togglePreviewEditing"><Icon :name="previewOn ? 'move' : 'eye'" :size="13" /></button>
          <button class="tp" type="button" aria-label="Avanzar un intervalo" data-tooltip="Avanzar según Snap" @click="stepTime(1)"><Icon name="step" :size="13" /></button>
        </div>
        <div class="time-readout">
          <input class="tm" type="number" min="0" step="0.01" :max="tl.duration" :value="ph.toFixed(2)" aria-label="Tiempo actual en segundos" data-tooltip="Tiempo actual (s)" @change="seekTime($event.target.value)" />
          <span class="dim total-time" :title="`Duración: ${fmt(tl.duration)}`">/ {{ fmt(tl.duration) }}</span>
        </div>
        <span class="sep wide-only"></span>
        <button ref="detailsButton" type="button" class="curve-toggle" :class="{on:detailsOpen}" :aria-expanded="detailsOpen" @click="detailsOpen=!detailsOpen">Detalles</button>
        <button type="button" class="curve-toggle" :class="{on:curveOpen}" :aria-pressed="curveOpen" title="Abrir editor gráfico de curvas" @click="curveOpen=!curveOpen">Curvas</button>
        <div class="zoom-tools" aria-label="Zoom temporal">
          <button class="ghost icon-button" aria-label="Alejar" data-tooltip="Alejar" @click="zoomBy(0.8)"><Icon name="minus" :size="13" /></button>
          <input class="zoom-slider" type="range" :min="ZOOM_MIN" :max="ZOOM_MAX" step="any" :value="zoom" aria-label="Zoom temporal" @input="setZoom($event.target.value)" />
          <button class="ghost icon-button" aria-label="Acercar" data-tooltip="Acercar" @click="zoomBy(1.25)"><Icon name="plus" :size="13" /></button>
          <button class="ghost icon-button" aria-label="Ajustar duración" data-tooltip="Ajustar toda la duración" @click="fitZoom"><Icon name="frame" :size="13" /></button>
        </div>
        <label class="timeline-fps-control" data-tooltip="Fotogramas por segundo del recurso; no limita la velocidad de render">FPS <input type="number" min="1" max="240" step="1" :value="tl.fps || 30" :disabled="store.locked || store.play.on" aria-label="Fotogramas por segundo del Timeline" @change="updateFps" /></label>
        <label class="snap-tools" data-tooltip="Imán de claves"><Icon name="magnet" :size="13" /><select v-model="snapPreference" aria-label="Intervalo de ajuste"><option value="frame">1 fotograma</option><option value="0">Libre</option><option value="0.05">0.05 s</option><option value="0.1">0.1 s</option><option value="0.25">0.25 s</option><option value="0.5">0.5 s</option><option value="1">1 s</option></select></label>
        <div v-if="tl.tracks.some(track => track.clips?.length || ['audio', 'commands', 'method'].includes(track.kind))" class="timeline-edit-modes" role="group" aria-label="Modo de edición temporal" data-test="timeline-edit-modes">
          <button v-for="[value,label] in TIMELINE_EDIT_MODES" :key="value" type="button" :class="{on:editMode===value}" :aria-pressed="editMode===value" :title="value==='mix'?'Solapar y mezclar clips de animación':value==='ripple'?'Mover contenido posterior conservando intervalos':'Sustituir el intervalo de destino sin borrar el resto'" @click="editMode=value">{{ label }}</button>
        </div>
        <button type="button" class="clip-create" :disabled="store.locked || store.play.on" title="Crear marcador en el cabezal" @click="addMarker()"><Icon name="pin" :size="12" /> Marcador</button>
        <button v-if="selClip" type="button" class="clip-remove" :disabled="store.locked || store.play.on" title="Eliminar clip seleccionado, sin borrar claves" @click="removeClip">Eliminar clip</button>
        <span class="grow"></span>
        <div class="menu options-menu"><button ref="optionsButton" class="ghost icon-button options-trigger" :class="{ on: optMenu }" :aria-expanded="optMenu" aria-haspopup="true" aria-label="Opciones de Timeline" data-tooltip="Opciones de Timeline" @click="togglePopup('options')"><Icon name="more" :size="16" /></button>
          <Teleport to="body"><div v-if="optMenu" class="pop options-pop timeline-dropdown" :style="popupPlacement">
            <label class="field-label">Nombre <input :value="tl.name" aria-label="Nombre del Timeline" @change="renameResource($event)" /></label>
            <label class="field-label">Duración (s) <input class="n" type="number" min="0.5" step="0.5" :value="tl.duration" @change="dur" /></label>
            <label class="field-label">Zoom <input type="range" :min="ZOOM_MIN" :max="ZOOM_MAX" step="any" :value="zoom" @input="setZoom($event.target.value)" /></label>
            <button class="menu-action" @click="fitZoom">Ajustar duración visible</button>
            <label class="field-label">Fotogramas por segundo <input class="n" type="number" min="1" max="240" step="1" :value="tl.fps || 30" :disabled="store.locked || store.play.on" aria-label="FPS del Timeline" @change="updateFps" /></label>
            <label class="field-label">Imán <select v-model="snapPreference" aria-label="Intervalo de ajuste de claves"><option value="frame">1 fotograma</option><option value="0">Libre</option><option value="0.05">0.05 s</option><option value="0.1">0.1 s</option><option value="0.25">0.25 s</option><option value="0.5">0.5 s</option><option value="1">1 s</option></select></label>
            <label class="chk"><input type="checkbox" :checked="tl.loop" @change="setTl({ loop: $event.target.checked })" /> En bucle</label>
            <label class="chk"><input type="checkbox" :checked="tl.lockPlayer" @change="setTl({ lockPlayer: $event.target.checked })" /> Bloquear al jugador</label>
            <label class="chk"><input type="checkbox" :checked="tl.skippable" @change="setTl({ skippable: $event.target.checked })" /> Se puede omitir (Retroceso)</label>
            <label class="field-label">Barras de cine (%) <input class="n" type="number" min="0" max="25" step="1" :value="tl.letterbox" @change="setTl({ letterbox: +$event.target.value || 0 })" /></label>
            <div class="timeline-camera-exit-title">Salida de cámara</div>
            <label v-for="[reason,label] in exitReasons" :key="reason" class="field-label">
              {{ label }}
              <select :value="cameraExitSelection(reason)" :disabled="store.locked || store.play.on" :aria-label="`Salida de cámara: ${label}`" @change="setTimelineCameraExit(reason, $event.target.value)">
                <option v-if="!tl.cameraExit" value="current">Comportamiento actual</option>
                <option v-for="[to,name] in exitOptions" :key="to" :value="to">{{ name }}</option>
                <option v-for="camera in store.project.objects.filter(o => o.type === 'camera')" :key="camera.id" :value="`camera3d|${camera.id}`">Camera3D · {{ camera.name }}</option>
                <option v-if="tl.cameraExit?.[reason]?.to === 'camera3d' && !store.project.objects.some(o => o.id === tl.cameraExit[reason].cameraId && o.type === 'camera')" :value="cameraExitSelection(reason)" disabled>Camera3D no disponible</option>
              </select>
            </label>
            <button class="menu-action danger" @click="optMenu = false; askConfirm('¿Eliminar «' + tl.name + '»?', { ok: 'Eliminar', danger: true }).then(y => y && deleteTimeline(tl.id))"><Icon name="trash" :size="13" /> Eliminar Timeline</button>
          </div></Teleport>
        </div>
      </div>

      <div class="timeline-workspace">
      <div class="main" :class="{ 'node-drop-target': nodeDropActive }" :style="{ '--tl-header-width': headerWidth + 'px' }" @dragover="nodeDragOver" @dragleave="nodeDragLeave" @drop="nodeDrop">
      <div class="pinned-column" :style="{ width: headerWidth + 'px' }" @wheel.prevent="forwardPinnedWheel">
              <div class="hcorner"><div class="track-bar">
                <div class="menu add-track-menu"><button ref="trackButton" class="track-add" :class="{ on: addMenu }" :aria-expanded="addMenu" aria-haspopup="true" @click="togglePopup('tracks')"><Icon name="plus" :size="14" /> <span>Pista</span> <Icon name="chevd" :size="11" /></button>
          <Teleport to="body"><div v-if="addMenu" ref="trackPopup" class="pop add-pop timeline-dropdown" :style="popupPlacement" role="group" aria-label="Crear pista">
            <button type="button" @click="createGroup()"><Icon name="bi-folder-plus" :size="15" /> <span>Crear grupo de pistas</span></button>
            <button v-for="(kind, key) in addableKinds" :key="key" type="button" @click="addTrack(key)"><Icon :name="trackMenuGlyphs[key]" :size="15" :style="{ color: kind.color }" /> <span>{{ kind.label }}</span></button>
          </div></Teleport>
        </div>
                <button type="button" class="track-root" title="Soltar pista aquí para sacarla de un grupo" @dragover="allowOrganizeDrop" @drop="dropOrganize($event,{groupId:null})">Sin grupo</button>
                <span class="track-count" :title="`${tl.tracks.length} pistas`">{{ tl.tracks.length }}</span>
              </div>
                <div class="header-resizer" role="separator" tabindex="0" aria-label="Ajustar anchura de pistas" aria-orientation="vertical" :aria-valuenow="headerWidth" aria-valuemin="96" :aria-valuemax="Math.max(96, viewportWidth - 120)" @pointerdown="beginHeaderResize" @pointermove="moveHeaderResize" @pointerup="endHeaderResize" @pointercancel="endHeaderResize" @lostpointercapture="endHeaderResize" @keydown="keyHeaderResize"></div>
              </div>
        <div class="pinned-viewport">
          <div ref="pinnedRows" class="pinned-rows">
            <div v-for="row in visibleRows" :key="row.type+'-'+row.id" class="pinned-row" :data-timeline-row="row.type" :data-timeline-id="row.id" :class="{'group-row':row.type==='group','node-heading-row':row.type==='node','node-child-row':row.type==='track' && row.child,'property-value-row':row.type==='track' && row.child && row.track.kind==='node'}">
              <div v-if="row.type==='group'" class="group-head" @pointerdown="pickGroup(row.group)" @contextmenu.prevent.stop="groupMenu($event,row.group)" @dragover="allowOrganizeDrop" @drop="dropOrganize($event,{groupId:row.group.id,beforeGroupId:row.group.id})">
                <button class="group-toggle" type="button" :aria-expanded="!groupCollapsed(row.group)" :aria-label="groupCollapsed(row.group)?'Expandir grupo':'Contraer grupo'" @pointerdown.stop @click.stop="toggleGroup(row.group)"><Icon :name="groupCollapsed(row.group)?'chevr':'chevd'" :size="13" /></button>
                <span class="group-drag" draggable="true" title="Arrastrar para reordenar grupos" @dragstart="beginOrganizeDrag($event,'group',row.group.id)"><Icon name="move" :size="13" /></span>
                <span class="group-name" @dblclick.stop="renameGroup(row.group)">{{ row.group.name }}</span>
                <span class="group-count">{{ tl.tracks.filter(t=>t.groupId===row.group.id).length }}</span>
              </div>
              <div v-else-if="row.type==='node'" class="node-head" :data-node-id="row.nodeId" :class="{ 'node-selected':store.selectedId===row.nodeId }">
                <button v-if="!row.pending" type="button" class="node-row-toggle" :aria-expanded="!collapsedNodes.has(row.id)" :aria-label="`${collapsedNodes.has(row.id)?'Expandir':'Contraer'} propiedades de ${row.node.name}`" @click.stop="toggleNodeRow(row)"><Icon :name="collapsedNodes.has(row.id)?'chevr':'chevd'" :size="13" /></button>
                <span v-if="row.pending" class="node-row-toggle" aria-hidden="true"></span>
                <button type="button" class="node-row-name" :title="`${row.node.name} · ${row.nodeId}`" @click="pickNodeRow(row)"><Icon :name="kindIcon(row.node)" :size="14" /> <span>{{ row.node.name }}</span></button>
                <button type="button" class="node-key-picker" aria-haspopup="menu" :aria-label="`Elegir propiedad de ${row.node.name}`" title="Elegir propiedad animable" :disabled="!canAuthorProperties" @click.stop="nodePicker($event, row)"><Icon name="key" :size="13" /></button>
                <button v-if="row.pending" type="button" class="node-key-picker" aria-label="Cancelar nodo provisional" title="Cancelar" @click.stop="cancelPendingNode"><Icon name="x" :size="12" /></button>
              </div>
              <div v-else-if="row.type==='track'" class="head" :class="{ muted: row.track.muted, on: sel?.tr === row.track.id, locked: row.track.locked, 'node-property-head':row.child }" @pointerdown="pickTrack(row.track)" @dragover="allowOrganizeDrop" @drop="dropOrganize($event,{groupId:row.track.groupId||null,beforeId:row.track.id})" @contextmenu.prevent.stop="trackMenu($event, row.track)">
                <div v-if="row.child" class="l1 property-row-content">
                  <span class="track-drag" draggable="true" title="Arrastrar pista a otro grupo o lugar" @pointerdown.stop @dragstart="beginOrganizeDrag($event,'track',row.track.id)"><Icon name="move" :size="12" /></span>
                  <button type="button" class="property-row-select" :aria-label="`Seleccionar pista de ${nodePropertyLabel(row.track)}`" :title="nodePropertyLabel(row.track)" @pointerdown.stop="pickTrack(row.track)" @click.stop="pickTrack(row.track)">
                    <span class="node-property-name">{{ nodePropertyLabel(row.track) }}</span>
                  </button>
                  <span v-if="row.track.muted || row.track.locked" class="property-state" :aria-label="[row.track.muted ? 'Silenciada' : '', row.track.locked ? 'Bloqueada' : ''].filter(Boolean).join(', ')">
                    <Icon v-if="row.track.muted" name="mute" :size="12" />
                    <Icon v-if="row.track.locked" name="lock" :size="12" />
                  </span>
                  <div class="property-actions">
                    <PropertyKey v-if="row.track.kind==='node'" :label="nodePropertyLabel(row.track)" :available="!!nodeAnimationProperty(trackOwner(row.track), row.track.prop)" :disabled="!guardedTrack(row.track) || !canAuthorProperties" :marked="row.track.keys.some(key=>Math.abs(key.t-ph)<=0.000001)" @insert="insertNodePropertyKey(trackOwner(row.track), row.track.prop, ph)" />
                    <button type="button" class="property-menu" aria-haspopup="menu" :aria-label="`Opciones de ${nodePropertyLabel(row.track)}`" title="Opciones de pista" @pointerdown.stop @click.stop="trackMenu($event, row.track)"><span aria-hidden="true">⋯</span></button>
                  </div>
                </div>
                <div v-else class="l1">
                  <span class="track-drag" draggable="true" title="Arrastrar pista a otro grupo o lugar" @pointerdown.stop @dragstart="beginOrganizeDrag($event,'track',row.track.id)"><Icon name="move" :size="12" /></span>
                  <span class="ico" :style="{ color: TRACK_KINDS[row.track.kind].color }" :title="TRACK_KINDS[row.track.kind].label"><Icon :name="trackGlyph(row.track.kind)" :size="14" /></span>
                  <input class="tn" :value="row.track.name" :aria-label="`Nombre de pista: ${row.track.name}`" :disabled="!!row.track.locked" @change="row.track.name = $event.target.value || row.track.name; commit('Renombrar pista')" />
                  <PropertyKey v-if="row.track.kind==='node'" :label="nodePropertyLabel(row.track)" :available="!!nodeAnimationProperty(trackOwner(row.track), row.track.prop)" :disabled="!guardedTrack(row.track) || !canAuthorProperties" :marked="row.track.keys.some(key=>Math.abs(key.t-ph)<=0.000001)" @insert="insertNodePropertyKey(trackOwner(row.track), row.track.prop, ph)" />
                  <button type="button" class="track-mute" :class="{ active: row.track.muted }" :aria-label="row.track.muted ? 'Activar pista' : 'Silenciar pista'" :aria-pressed="!!row.track.muted" :title="row.track.muted ? 'Activar pista' : 'Silenciar pista'" @pointerdown.stop @click.stop="toggleTrackMute(row.track)"><Icon :name="row.track.muted ? 'mute' : 'volume'" :size="13" /></button>
                  <button v-if="row.track.kind!=='bake'" type="button" class="track-lock" :class="{active:row.track.locked}" :title="row.track.locked?'Desbloquear pista':'Bloquear pista'" :aria-label="row.track.locked?'Desbloquear pista':'Bloquear pista'" :aria-pressed="!!row.track.locked" @pointerdown.stop @click.stop="toggleTrackLock(row.track)"><Icon name="lock" :size="12" /></button><span v-else class="track-readonly" title="Pista horneada de solo lectura"><Icon name="lock" :size="12" /></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
        <div ref="scroller" class="scroll" @scroll.passive="syncTimelineScroll" @wheel="zoomWheel">
          <div ref="inner" class="inner" :style="{ width: W + 'px', '--tl-grid-step': gridStep + 'px', '--tl-grid-minor': gridMinorStep + 'px', '--tl-time-origin': TIME_ORIGIN_PX + 'px' }">
            <div class="rulerrow">
              <div ref="ruler" class="ruler" @pointerdown="scrubDown" @dblclick.stop="markerAtPointer"><span v-for="t in ticks" :key="t.t" class="tick" :class="{ major: t.major }" :style="{ left: timeToX(t.t) + 'px' }"><i v-if="t.major">{{ tickText(t.t) }}</i></span>
                <button v-for="marker in (tl.markers||[])" :key="marker.id" type="button" class="timeline-marker" :class="{on:sel?.marker===marker.id}" :style="{left:timeToX(marker.t)+'px'}" :title="`${marker.name} · ${marker.t.toFixed(2)} s`" :aria-label="`${marker.name} · ${marker.t.toFixed(2)} segundos`" @pointerdown.stop="markerDown($event,marker)" @contextmenu.prevent.stop="markerMenu($event,marker)"><Icon name="pin" :size="11" /></button>
                
                <button type="button" class="playhead-grip" role="slider" tabindex="0" aria-label="Arrastrar cabezal de tiempo" aria-orientation="horizontal" aria-valuemin="0" :aria-valuemax="tl.duration" :aria-valuenow="+ph.toFixed(2)" :aria-valuetext="fmt(ph)" :style="{ left: timeToX(ph) + 'px' }" data-tooltip="Arrastrar tiempo · ← → para avanzar" @pointerdown.stop.prevent="scrubDown($event, ruler, true)" @keydown="playheadKeydown"></button></div>
            </div>
            <div class="time-grid" :style="{ width: W + 'px' }" aria-hidden="true"></div>
            <div v-if="marquee" class="timeline-marquee" :style="{ left:(TIME_ORIGIN_PX+marquee.x)+'px', top:29+marquee.y+'px', width:marquee.w+'px', height:marquee.h+'px' }" aria-hidden="true"></div>
            <div v-for="row in visibleRows" :key="row.type+'-'+row.id" class="trow" :data-timeline-row="row.type" :data-timeline-id="row.id" :class="{ muted: row.track?.muted, on: sel?.tr === row.track?.id, 'group-row':row.type==='group', 'node-row':row.type==='node', 'node-child-row':row.type==='track' && row.child,'property-value-row':row.type==='track' && row.child && row.track.kind==='node', locked:row.track?.locked }">
              <div v-if="row.type==='group'" class="group-lane" :style="{width:W+'px'}" @dragover="allowOrganizeDrop" @drop="dropOrganize($event,{groupId:row.group.id,beforeGroupId:row.group.id})"></div>
              <div v-else-if="row.type==='node'" class="node-lane" :style="{width:W+'px'}"></div>
              <template v-else>
              <div class="lane" :data-tooltip="row.track.kind==='node'?'Ctrl + doble clic para insertar un keyframe':null" :class="{'property-lane':row.track.kind==='node'}" :data-camera-track="row.track.kind === 'camera' ? row.track.id : null" :style="{ width: W + 'px' }" @contextmenu.prevent.stop="laneMenu($event, row.track)" @pointerdown="laneDown($event, row.track)" @dblclick="laneDbl($event, row.track)">
                <div v-if="row.track.kind === 'bake'" class="bakeclip" :style="{ left: timeToX(row.track.start) + 'px', width: row.track.duration * zoom + 'px' }" :title="`Física horneada · ${row.track.node} · ${row.track.duration.toFixed(2)} s · 60 Hz`">Simulación horneada · {{ row.track.duration.toFixed(2) }} s</div>
                <template v-if="row.track.kind === 'camera'">
                  <button v-for="s in motionSpans(row.track)" :key="s.id" type="button" class="span" :class="{ cut: s.cut, selected: chosenIds.has(row.track.id + '\0' + s.id) }" :style="{ left: s.l + 'px', width: s.w + 'px', '--c': TRACK_KINDS[row.track.kind].color }" :aria-label="`Segmento de ${row.track.name}, duración ${(s.w / zoom).toFixed(2)} s`" @pointerdown.stop="pickSegment(row.track, s.id, $event)" @contextmenu.prevent.stop="segmentMenu($event, row.track, s.id)"><span>{{ row.track.name }}</span></button>
                  <button v-for="s in motionSpans(row.track)" :key="'resize-' + s.id" type="button" class="segment-grip" :style="{ left: (s.l + s.w) + 'px', '--c': TRACK_KINDS[row.track.kind].color }" :data-tooltip="`Ajustar duración: ${(s.w / zoom).toFixed(2)} s`" aria-label="Cambiar duración del tramo" @pointerdown.stop.prevent="beginSegmentResize($event, row.track, s.id)"></button>
                  </template>
                <template v-if="row.track.kind === 'camera' || row.track.kind === 'node'">
                <div v-for="clip in (row.track.clips || [])" :key="'clip-'+clip.id" role="button" tabindex="0" class="timeline-live-clip" :class="{on:sel?.tr===row.track.id && sel?.clip===clip.id, mixing:(row.track.clips||[]).some(c=>c.id!==clip.id && c.start<clip.start+clip.duration && c.start+c.duration>clip.start)}" :style="{left:timeToX(clip.start)+'px',width:clip.duration*zoom+'px','--c':TRACK_KINDS[row.track.kind].color}" :title="`Clip ${row.track.name} · ${clip.start.toFixed(2)}–${(clip.start+clip.duration).toFixed(2)} s · ${editMode}`" @pointerdown.stop="clipDragDown($event,row.track,clip)" @keydown.enter.prevent="pickClip(row.track,clip)" @contextmenu.prevent.stop="clipMenu($event,row.track,clip)">
                    <span class="clip-caption">{{ row.track.name }}</span>
                  </div>
                  <button v-for="clip in (row.track.clips || [])" :key="'clip-tail-'+clip.id" type="button" class="clip-tail-external" :class="{ on:sel?.tr===row.track.id && sel?.clip===clip.id }" :style="{left:timeToX(clip.start+clip.duration)+'px','--c':TRACK_KINDS[row.track.kind].color}" role="slider" tabindex="0" :aria-label="`Ajustar duración del clip ${row.track.name}`" :aria-valuenow="clip.duration" aria-valuemin="0.05" :data-tooltip="`Arrastrar fin del clip · ${clip.duration.toFixed(2)} s`" @pointerdown.stop.prevent="clipDragDown($event,row.track,clip,true)" @keydown.stop="clipResizeKeydown($event,row.track,clip)"></button>
                </template>
                <div v-for="span in (row.track.kind === 'node' ? motionSpans(row.track) : [])" :key="'prop-line-'+span.id" class="node-key-interval" :class="{cut:span.cut}" :style="{left:span.l+'px',width:span.w+'px','--c':TRACK_KINDS[row.track.kind].color}" aria-hidden="true"></div>
                <button v-for="k in (row.track.kind === 'audio' ? row.track.keys.filter(k => k.action === 'play' && k.t < tl.duration) : [])" :key="'audio-head-'+k.id" type="button" class="audio-duration-head" :style="{left:timeToX(k.t)+'px','--c':TRACK_KINDS[row.track.kind].color}" role="slider" tabindex="0" :aria-label="`Recortar inicio del audio ${keyLabel(row.track,k)}`" :aria-valuenow="k.t" aria-valuemin="0" :aria-valuemax="k.t + audioDisplayDuration(k)" :data-tooltip="`Arrastrar inicio · fuente desde ${(k.offset || 0).toFixed(2)} s`" @pointerdown.stop.prevent="audioTrimDown($event,row.track,k,'left')" @keydown.stop="audioTrimLeftKeydown($event,row.track,k)"></button>
                <button v-for="k in (row.track.kind === 'audio' ? row.track.keys.filter(k => k.action === 'play' && k.t < tl.duration) : [])" :key="'audio-tail-'+k.id" type="button" class="audio-duration-tail" :style="{left:timeToX(k.t + audioDisplayDuration(k))+'px','--c':TRACK_KINDS[row.track.kind].color}" role="slider" tabindex="0" :aria-label="`Ajustar duración del audio ${keyLabel(row.track,k)}`" :aria-valuenow="audioDisplayDuration(k)" :aria-valuemin="0" :aria-valuemax="Math.max(0,tl.duration-k.t)" :aria-valuetext="k.duration ? `${k.duration.toFixed(2)} segundos` : `Fuente completa · ${(audioDisplayDuration(k)).toFixed(2)} s visibles`" :data-tooltip="k.duration ? `Duración audio: ${k.duration.toFixed(2)} s` : 'Fuente completa · arrastra el borde derecho para recortar'" @pointerdown.stop.prevent="audioResizeDown($event,row.track,k)" @keydown.stop="audioResizeKeydown($event,row.track,k)"></button>
                <template v-if="row.track.kind === 'audio'">
                  <template v-for="k in row.track.keys.filter(k => k.action === 'play' && k.duration > 0 && k.volumeAutomation?.length)" :key="'volume-line-'+k.id">
                    <svg class="audio-volume-envelope" :style="{left:timeToX(k.t)+'px',width:k.duration*zoom+'px'}" :viewBox="`0 0 ${Math.max(1,k.duration*zoom)} 27`" preserveAspectRatio="none" aria-hidden="true"><path :d="audioVolumePath(k)" /></svg>
                    <button v-for="point in k.volumeAutomation" :key="point.id" type="button" class="audio-volume-point" :style="{left:timeToX(k.t+point.t)+'px',top:(27-19*point.value)+'px'}" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="Math.round(point.value*100)" :aria-label="`Volumen ${Math.round(point.value*100)}% en ${point.t.toFixed(2)} segundos`" data-tooltip="Arrastrar: tiempo y volumen · Suprimir: eliminar" @pointerdown.stop.prevent="audioVolumeDown($event,row.track,k,point)" @keydown.stop="audioVolumeKeydown($event,row.track,k,point)"></button>
                  </template>
                  <svg v-for="k in row.track.keys.filter(k => k.action === 'play' && audioFadeSpan(k) > 0)" :key="'fade-line-'+k.id" class="audio-fade-envelope" :style="{left:timeToX(k.t)+'px',width:audioFadeSpan(k)*zoom+'px'}" :viewBox="`0 0 ${Math.max(1,audioFadeSpan(k)*zoom)} 27`" preserveAspectRatio="none" aria-hidden="true"><path :d="audioFadePath(k)" /></svg>
                  <button v-for="k in row.track.keys.filter(k => k.action === 'play' && audioFadeSpan(k) > 0)" :key="'fade-in-'+k.id" type="button" class="audio-fade-grip fade-in" :style="{left:timeToX(k.t+Math.min(audioFadeMax(k,'fadeIn'),Math.max(0,k.fadeIn||0)))+'px'}" role="slider" tabindex="0" :aria-label="`Fundido de entrada de ${keyLabel(row.track,k)}`" aria-valuemin="0" :aria-valuemax="audioFadeMax(k,'fadeIn')" :aria-valuenow="k.fadeIn" :data-tooltip="`Fade In · ${(k.fadeIn||0).toFixed(2)} s`" @pointerdown.stop.prevent="audioFadeDown($event,row.track,k,'fadeIn')" @keydown.stop="audioFadeKeydown($event,row.track,k,'fadeIn')"></button>
                  <button v-for="k in row.track.keys.filter(k => k.action === 'play' && k.duration > 0 && audioFadeSpan(k) > 0)" :key="'fade-out-'+k.id" type="button" class="audio-fade-grip fade-out" :style="{left:timeToX(k.t+audioFadeSpan(k)-Math.min(audioFadeMax(k,'fadeOut'),Math.max(0,k.fadeOut||0)))+'px'}" role="slider" tabindex="0" :aria-label="`Fundido de salida de ${keyLabel(row.track,k)}`" aria-valuemin="0" :aria-valuemax="audioFadeMax(k,'fadeOut')" :aria-valuenow="k.fadeOut" :data-tooltip="`Fade Out · ${(k.fadeOut||0).toFixed(2)} s`" @pointerdown.stop.prevent="audioFadeDown($event,row.track,k,'fadeOut')" @keydown.stop="audioFadeKeydown($event,row.track,k,'fadeOut')"></button>
                </template>
                <button v-for="(k, index) in row.track.keys" :key="k.id" type="button" :aria-label="row.track.kind === 'node' ? `Clave de ${nodePropertyLabel(row.track)} en ${k.t.toFixed(2)} segundos` : `Clave de ${row.track.name} en ${k.t.toFixed(2)} segundos`" class="key" :class="[row.track.kind, { on: hasKey(row.track,k), cut: k.ease === 'cut', blk: k.block }]" :style="{ left: timeToX(k.t) + 'px', width: row.track.kind==='audio' && k.action==='play' ? audioDisplayDuration(k)*zoom+'px' : undefined, maxWidth: row.track.kind==='audio' && k.action==='play' ? audioDisplayDuration(k)*zoom+'px' : keyWidth(row.track, k, index) + 'px', '--c': TRACK_KINDS[row.track.kind].color }" :data-tooltip="`${k.t.toFixed(2)} s · ${keyLabel(row.track, k)}`" @pointerdown="keyDown($event, row.track, k)" @dblclick="row.track.kind === 'audio' && audioVolumeAddFromClip($event,row.track,k)" @contextmenu.prevent.stop="keyMenu($event, row.track, k)"><TimelineAudioSource v-if="row.track.kind === 'audio' && k.action === 'play'" :clip="k.clip" :duration="audioDisplayDuration(k)" :offset="k.offset" :pitch="k.pitch" :loop="k.loop" :clip-start-px="timeToX(k.t)" :clip-width-px="audioDisplayDuration(k) * zoom" :viewport-left-px="durationScrollX" :viewport-width-px="Math.max(0, viewportWidth - headerWidth)" @source-duration="recordAudioSourceDuration(k.clip, $event)" /><em>{{ keyLabel(row.track, k) }}</em></button>
              </div>
              </template>
            </div>
            <div v-if="nodeGroupConflict" class="node-group-conflict" role="status">Hay pistas de un mismo nodo en grupos diferentes. Conservamos sus grupos; unifícalas manualmente para mostrar un solo encabezado.</div>
            <div v-if="!tl.tracks.length" class="hint lf-help">Sin pistas. Arrastra un nodo desde Jerarquía para elegir su propiedad, o pulsa «＋ Pista».</div>
            <div class="playhead" :style="{ left: timeToX(ph) + 'px' }" aria-hidden="true"></div>
          </div>
        </div>
        <div class="duration-overlay" :style="{ left: headerWidth + 'px', height: durationViewportHeight ? durationViewportHeight + 'px' : '100%' }">
          <button class="duration-grip" type="button" role="slider" tabindex="0"
            aria-label="Arrastrar límite global de duración del Timeline"
            aria-orientation="horizontal" :aria-valuenow="tl.duration"
            :aria-valuemin="timelineMinDuration(tl)"
            :style="{ left: durationBoundaryX + 'px' }"
            :data-tooltip="`Fin global del Timeline: ${tl.duration.toFixed(2)} s`"
            @pointerdown.stop.prevent="beginDurationResize"
            @keydown.stop="durationKeydown"></button>
        </div>
      </div>
        <aside v-if="detailsOpen" class="timeline-details" aria-label="Detalles de Timeline">
          <header><b>Detalles</b><button type="button" aria-label="Cerrar detalles" @click="closeDetails"><Icon name="x" :size="13" /></button></header>
          <fieldset class="timeline-details-fields" :disabled="store.locked || store.play.on">
            <TemporalResourceInspector kind="timeline" :resource-id="tl.id" :context="detailsContext" @select="selectDetails" @seek="seekTime" />
          </fieldset>
        </aside>
      </div>
      <TimelineCurveEditor v-if="curveOpen" :timeline="tl" :track="selTrack" :selected-key="selKey" :playhead="ph" :snap="snap" :disabled="store.locked || store.play.on" @pick="pick" @pause="pauseCurvePlayback" @edited="onCurveEdited" @removed="sel={tr:$event.id}" @error="toast($event,'error')" @live="bump" @seek="seekTime" @close="curveOpen=false" />
      <footer class="timeline-status"><span>{{ tl.tracks.length }} pistas</span><span class="status-divider"></span><span>Tiempo: {{ fmt(ph) }}</span><span class="status-divider"></span><span>{{ chosenCount > 1 ? chosenCount+' claves seleccionadas' : sel?.marker ? (tl.markers||[]).find(m=>m.id===sel.marker)?.name : sel?.group ? (tl.groups||[]).find(g=>g.id===sel.group)?.name : selTrack ? selTrack.name : 'Ninguna pista seleccionada' }}</span><span class="grow"></span><span>{{ `Modo ${editMode.toUpperCase()}` }}</span><span class="status-divider"></span><span>{{ snap ? `Snap ${snap} s` : 'Snap libre' }}</span></footer>
    </template>
    </div>
  </div>
</template>

<style scoped>
.timeline-titlebar { display:flex;align-items:center;gap:9px;min-height:36px;padding:4px 10px;border-bottom:1px solid var(--hair);background:var(--g-900);position:relative;z-index:12;min-width:0;flex:none }
.timeline-titlebar .primary { display:inline-flex;align-items:center;gap:5px;min-height:26px;padding:0 9px;flex:none }
.timeline-selector { position:relative;min-width:0;max-width:min(48%,340px);flex:0 1 250px }
.timeline-picker { width:100%;height:26px;display:flex;align-items:center;gap:7px;padding:0 8px;text-align:left;border:1px solid var(--hair);background:var(--g-850);border-radius:4px }
.timeline-picker:hover,.timeline-picker[aria-expanded=true] { border-color:var(--blue);background:var(--g-800) }
.timeline-picker .picker-name { font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1 }
.timeline-subtitle { color:var(--text-3);font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:28% }
.library-pop { box-sizing:border-box;position:fixed;z-index:40;width:min(368px,calc(100vw - 16px));padding:9px;display:flex;flex-direction:column;gap:6px;overflow:hidden;background:var(--g-800);border:1px solid var(--g-600);border-radius:5px;box-shadow:0 12px 30px #0009 }
.library-search { display:flex;align-items:center;gap:7px;flex:none;padding:0 8px;border:1px solid var(--g-600);background:var(--g-900);border-radius:3px;color:var(--text-3) }
.library-search:focus-within { border-color:var(--blue);outline:1px solid var(--blue) }
.library-pop .library-search input { width:100%;height:29px;min-width:0;flex:1;border:0;outline:0;background:transparent;color:var(--text);font:inherit }
.library-count { flex:none }
.library-list { min-height:0;flex:0 1 auto;overflow-x:hidden;overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--g-500, #777) var(--g-850, #1b1b1b);display:flex;flex-direction:column;gap:2px;padding-right:3px }
.library-list::-webkit-scrollbar { width:9px }
.library-list::-webkit-scrollbar-thumb { background:var(--g-500, #777);border-radius:6px }
.library-list::-webkit-scrollbar-track { background:var(--g-850, #1b1b1b) }
.library-count,.library-footnote { color:var(--text-3);font-size:10px;padding:2px 5px;flex:none }
.library-footnote { border-top:1px solid var(--hair);padding-top:7px }
.library-hint { color:var(--text-3);font-size:11px;padding:10px 8px;margin:0 }
.timeline-item { display:flex;gap:8px;align-items:center;text-align:left;flex:none;min-height:38px;width:100%;padding:6px 8px;border:1px solid transparent;border-radius:3px;background:transparent }
.timeline-item.active { background:var(--g-700);border-color:var(--hair) }
.timeline-item:hover,.timeline-item:focus-visible { background:var(--g-700);border-color:var(--blue);outline:none }
.timeline-item span { display:grid;gap:3px;min-width:0;flex:1 }
.timeline-item b,.timeline-item small { overflow:hidden;text-overflow:ellipsis;white-space:nowrap }
.timeline-item small { color:var(--text-3);font-size:10px }
.library-selected { flex:none;color:var(--blue) }
.timeline-workspace { position:relative; display:flex; flex:1; min-width:0; min-height:0; }
.timeline-details { flex:0 0 min(320px, 45%); min-width:0; overflow:auto; background:var(--g-900); border-left:1px solid var(--hair); }
.timeline-details > header { position:sticky; top:0; z-index:1; display:flex; justify-content:space-between; align-items:center; padding:4px 8px; background:var(--g-850); }
.timeline-details-fields { min-width:0; margin:0; padding:0; border:0; }
.timeline-details > header button,.node-key-picker { flex:none; display:inline-grid; place-items:center; width:22px; height:22px; padding:0; }
@container (max-width: 480px) {
  .timeline-details { position:absolute; z-index:31; inset:29px 0 0 auto; width:min(300px, 95%); }
}
.timeline-editor { display:flex;flex-direction:column;flex:1;min-width:0;min-height:0;overflow:hidden }
.tlp { position:relative; display: flex; flex-direction: column; height: 100%; min-height: 0; min-width: 0; outline: none; font-size: 12px; container-type: inline-size; }
.empty { margin: auto; max-width: 460px; text-align: center; color: var(--text-2); display: grid; gap: 8px; }
.bar { display: flex; flex: none; align-items: center; gap: 6px; min-width: 0; min-height: 36px; padding: 4px 8px; border-bottom: 1px solid var(--hair); background: var(--g-850); white-space: nowrap; }
.bar button { height: 26px; display: inline-flex; align-items: center; justify-content: center; gap: 3px; flex: none; }
.nm { width: clamp(110px, 18%, 188px); min-width: 0; flex: 0 1 166px; height: 26px; font-weight: 600; }
.transport,.time-readout,.zoom-tools,.snap-tools { display: inline-flex; align-items: center; gap: 3px; flex: none; }
.tp { width: 27px; padding: 0; }
.tp.on { background: var(--blue); border-color: var(--blue); color: #fff; }
.tm { width: 62px; height: 26px; padding: 0 4px; text-align: right; font-variant-numeric: tabular-nums; }
.total-time { font-variant-numeric: tabular-nums; font-size: 11px; }
.icon-button { width: 27px; padding: 0; }
.zoom-slider { width: 78px; height: 20px; }
.snap-tools { color: var(--text-3); }
.snap-tools select { max-width: 78px; height: 26px; }
.sep { flex: none; width: 1px; height: 17px; background: var(--hair); margin: 0 2px; }
.dim { color: var(--text-3); } .grow { flex: 1; min-width: 0; }
.menu { position: relative; flex: none; }
.menu .primary { padding: 0 8px; }
.pop { position: absolute; top: calc(100% + 5px); right: 0; z-index: 30; display: grid; gap: 5px; min-width: 220px; max-width: min(320px, 90vw); padding: 9px; background: var(--g-800, #262626); color: var(--text); border: 1px solid var(--g-600); border-radius: 6px; box-shadow: 0 10px 30px #0009; white-space: normal; }
.pop button { width: 100%; justify-content: flex-start; text-align: left; border: 0; background: transparent; }
.pop button:hover { background: var(--g-600); }
.pop .n { width: 65px; }
.field-label { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--text-2); }
.options-pop { max-height: min(70vh, 540px); overflow-y: auto; scrollbar-width: thin; }
.timeline-camera-exit-title { border-top: 1px solid var(--hair); padding-top: 8px; font-size: 11px; font-weight: 600; color: var(--text); }
.field-label input:not([type=checkbox]),.field-label select { min-width: 0; max-width: 145px; height: 25px; }
.field-label input[type=range] { width: 130px; }
.chk { display: inline-flex; align-items: center; gap: 6px; color: var(--text-2); }
.menu-action.danger { color: var(--red, #ec7474); border-top: 1px solid var(--hair); border-radius: 0; padding-top: 7px; }
.main { flex: 1; min-height: 0; min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr); }
.main.node-drop-target { outline: 2px solid var(--blue); outline-offset: -2px; }
.scroll { min-width: 0; min-height:0; overflow: auto; position: relative; background: var(--g-900); scrollbar-width:thin; }
.inner { position: relative; min-height: 100%; }
/* Las líneas de tiempo comparten origen y escala con la regla; las horizontales pertenecen a las filas. */
.time-grid { position:absolute; top:27px; bottom:0; left:var(--tl-header-width); pointer-events:none; z-index:1;
  background-image:linear-gradient(90deg,#ffffff18 1px,transparent 1px),linear-gradient(90deg,#ffffff09 1px,transparent 1px);
  background-size:var(--tl-grid-step) 100%,var(--tl-grid-minor) 100%; background-repeat:repeat; }
.rulerrow { position: sticky; top: 0; z-index: 6; display: flex; height: 27px; background: var(--g-850); border-bottom: 1px solid var(--hair); }
.hcorner { box-sizing: border-box; position: relative; left: 0; z-index: 7; flex: none; width: var(--tl-header-width); min-width: 0; padding: 6px 10px; color: var(--text-3); font-size: 11px; font-weight: 600; background: var(--g-850); border-right: 1px solid var(--hair); }
.header-resizer { position:absolute;top:0;bottom:0;right:-4px;width:9px;z-index:12;cursor:col-resize;touch-action:none;border-right:2px solid transparent;outline-offset:-2px }
.header-resizer:hover,.header-resizer:focus-visible { border-right-color:var(--blue);background:#77a5db1b }
.ruler { position: relative; flex: 1; cursor: crosshair; touch-action: none; }
.tick { position: absolute; top: 16px; bottom: 0; width: 1px; background: var(--g-600); pointer-events: none; }
.tick.major { top: 8px; background: var(--text-3); }
.tick i { position: absolute; top: -6px; left: 4px; font-style: normal; font-size: 10px; line-height: 12px; font-variant-numeric: tabular-nums; color: var(--text-3); }
.endmark { position: absolute; top: 0; bottom: 0; width: 2px; background: #e0524a88; pointer-events: none; }
.segment-grip { position:absolute;top:24px;transform:translateX(-50%);width:12px;height:9px;border-radius:2px;padding:0;border:1px solid #131920;background:var(--c);z-index:6;cursor:ew-resize;touch-action:none;opacity:.9; }
.segment-grip:hover,.segment-grip:focus-visible { outline:1px solid #fff;outline-offset:1px; }
/* +Pista solo crea pistas: iconografía SVG y foco visible, también en Teleport. */
.add-pop { gap:2px; padding:6px; }
.add-pop button { display:flex;align-items:center;gap:9px;min-height:31px;padding:5px 9px;border-radius:3px;font-size:11px;line-height:1.3;color:#dbe3e9;white-space:nowrap; }
.add-pop button .ic { flex:none; }
.add-pop button:hover,.add-pop button:focus-visible { background:#475a68;color:#fff;outline:1px solid #7ca8c7;outline-offset:-1px; }
.trow { display: flex; height: 34px; border-bottom: 1px solid #ffffff18; }
.trow:nth-child(even) { background: #ffffff03; }
.trow.on { background: #ffffff0e; }
.trow.muted { opacity: .5; }
.head { box-sizing: border-box; position: relative; left: 0; z-index: 5; flex: none; width: var(--tl-header-width); min-width: 0; padding: 3px 7px; display: flex; align-items: center; background: var(--g-850); border-right: 1px solid var(--hair); }
.trow.on .head { box-shadow: inset 2px 0 0 var(--blue); }
.l1 { display: flex; align-items: center; gap: 6px; width: 100%; min-width: 0; }
.ico { width: 16px; flex: none; text-align: center; }
.tn { flex: 1; min-width: 0; height: 23px; padding: 0 4px; border: 1px solid transparent; background: transparent; overflow: hidden; text-overflow: ellipsis; font-size: 11px; }
.tn:focus { border-color: var(--blue); background: var(--g-900); }
.lane { position: relative; flex: none; }
.bakeclip { position: absolute; box-sizing:border-box; min-width:0; top: 6px; height: 22px; border-radius: 4px; border: 1px solid #75bacb; background: #315562; color: #d7f5ff; padding: 4px 8px; font-size: 10px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; pointer-events: none; }
.span { position: absolute; z-index:2; top: 16px; height: 2px; background: var(--c); opacity: .65; pointer-events: none; }
.span.cut { background: repeating-linear-gradient(90deg, var(--c) 0 4px, transparent 4px 8px); opacity: .7; }
.key { position: absolute; z-index:3; top: 7px; height: 20px; min-width: 14px; padding: 0 6px; transform: translateX(-7px); border: 1px solid #0007; border-left: 3px solid #0009; border-radius: 3px; background: var(--c); color: #111; font-size: 10px; line-height: 18px; cursor: grab; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.key em { display: block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; font-style: normal; }
.key.camera,.key.node,.key.method { width: 14px; height:14px; min-width: 14px; padding: 0; top: 10px; transform: translateX(-7px); border-radius: 50%; border: 2px solid #101820; box-shadow: 0 0 0 1px var(--c); }
.key.camera em,.key.node em,.key.method em { display: none; }
.key.cut:not(.node):not(.camera):not(.method) { border-radius: 1px; }
.key.blk { box-shadow: inset 0 -3px 0 #fff8; }
.key.on { outline: 2px solid #fff; outline-offset: 1px; z-index: 3; }
.playhead { position: absolute; top: 0; bottom: 0; width: 0; z-index: 4; pointer-events: none; border-left: 1px solid #ff5a4d; }
.playhead-grip { position:absolute;top:0;transform:translateX(-50%);width:16px;height:19px;padding:0;border:0;border-radius:0;
  background:#ff5a4d;clip-path:polygon(12% 0,88% 0,100% 18%,100% 61%,50% 100%,0 61%,0 18%);
  cursor:ew-resize;touch-action:none;z-index:8; }
.playhead-grip:hover,.playhead-grip:focus-visible { background:#ff7770;filter:drop-shadow(0 0 2px #ff5a4d); }
.playhead-grip:focus-visible { outline:2px solid #fff;outline-offset:2px; }
.hint { padding: 18px; margin-left: var(--tl-header-width); color: var(--text-3); }
@container (max-width: 800px) {
  .zoom-slider { width:54px }
  .timeline-subtitle { display:none }
}
@container (max-width: 540px) {
  .bar { gap:4px;padding-inline:6px }
  .bar .wide-only,.snap-tools,.zoom-tools { display:none }
  .timeline-titlebar { gap:6px;padding-inline:6px }
  .timeline-selector { max-width:none;flex:1 }
  .create-timeline span { display:none }
  .total-time { max-width:70px;overflow:hidden;text-overflow:ellipsis }
}
@container (max-width: 350px) {
  .bar { height:auto;min-height:36px;flex-wrap:wrap;row-gap:3px }
  .bar .grow { display:none }
  .time-readout { flex:1 }
  .add-track-menu { margin-left:auto }
  .bar .total-time { display:none }
  .menu .primary { padding:0 6px }
}

/* CORR-001: cabeceras fuera del scroll horizontal; sin compensaciones X. */
/* S10: presentación nativa con jerarquía y densidad comparables al editor de Unity Timeline.
   El modelo, los eventos y los tiempos siguen siendo los originales de Century. */
.tlp { --tl-bg:#242628; --tl-pane:#2d3033; --tl-sep:#45494d; --tl-text:#d2d6da; --tl-accent:#61a7d8; font-family:inherit; color:var(--tl-text); }
.timeline-titlebar { min-height:26px;height:26px;padding:0 8px;gap:10px;background:#252729;border-bottom:1px solid #141617;box-shadow:inset 0 1px 0 #ffffff08; }
.timeline-dock-tab { display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:650;letter-spacing:.01em;color:#e4e8eb;white-space:nowrap; }
.timeline-titlebar .create-timeline { background:transparent;color:#b9c1c8;border:1px solid transparent;min-height:22px;height:22px;padding:0 7px;border-radius:2px;font-size:10px; }
.timeline-titlebar .create-timeline:hover { background:#3b4246;border-color:#525960; }
.timeline-subtitle { color:#8c969e;font-size:10px;max-width:35%; }
.bar { min-height:32px;height:32px;padding:3px 7px;gap:5px;background:linear-gradient(#343739,#303335);border-bottom:1px solid #17191b;box-shadow:inset 0 1px 0 #ffffff0c; }
.bar button { height:23px;border-radius:2px;transition:background-color .12s,border-color .12s; }
.bar .tp:hover,.bar .icon-button:hover { background:#485056;color:#fff; }
.transport { gap:1px;padding:0 1px; }
.tp { width:24px;height:23px!important;min-width:24px;border:1px solid transparent;background:transparent;color:#aab2b9; }
.tp.on { background:#3b566b;border-color:#5c87a4;color:#f0f7ff; }
.reverse-step { transform:rotate(180deg); }
.time-readout { gap:4px;padding:0 5px; }
.tm { width:70px;height:22px;padding:0 5px;border-radius:2px;border:1px solid #575c5f;background:#1c1e20;color:#dbe8f4;font-family:ui-monospace,monospace;font-size:11px;text-align:center; }
.total-time { color:#9ca6ad;font-size:10px; }
.bar .sep { margin:0 4px;height:16px;background:#4b5053; }
.timeline-titlebar .timeline-selector { flex:1 1 165px;max-width:310px;min-width:72px; }
.timeline-titlebar .timeline-picker { border-radius:2px;height:23px;background:#303438;border:1px solid #50565b;color:#d5dee5;font-size:11px; }
.timeline-titlebar .timeline-picker:hover,.timeline-titlebar .timeline-picker[aria-expanded=true] { background:#424a4e;border-color:#7a95aa; }
.timeline-titlebar .timeline-picker .picker-name { font-weight:500; }
.zoom-tools { gap:1px; }
.zoom-tools .icon-button { width:23px;color:#bcc4ca;border-color:transparent;background:transparent; }
.zoom-slider { width:65px;accent-color:#9da9b3; }
.snap-tools { color:#b8c2ca;gap:3px;font-size:10px; }
.snap-tools select { max-width:66px;height:23px;border-radius:2px;font-size:10px;background:#25292c;border-color:#555c60;color:#c8d1d9; }
.bar .options-trigger { border:1px solid transparent;background:transparent;color:#b8c2ca; }
.main { background:var(--tl-bg);border-top:1px solid #464a4d; }
.scroll { background:#242628;scrollbar-color:#5e6469 #272b2e; }
.inner { background:repeating-linear-gradient(0deg,transparent 0,transparent 35px,#ffffff04 35px,#ffffff04 36px); }
.rulerrow { height:29px;background:#303335;border-bottom:1px solid #17191b; }
.hcorner { padding:2px 6px;background:#34383b;border-right:1px solid #181b1d;box-shadow:inset 0 1px 0 #ffffff09; }
.track-bar { display:flex;align-items:center;gap:6px;height:100%;min-width:0; }
.track-count { margin-left:auto;padding:0 5px;font-size:10px;color:#88939b;font-variant-numeric:tabular-nums; }
.track-add { height:22px;display:flex;align-items:center;gap:4px;padding:0 7px;border:1px solid #535a60;background:#454b4f;color:#d7e1e8;border-radius:2px;font-size:10px; }
.track-add:hover,.track-add.on { background:#526572;border-color:#6997b8; }
.ruler { background:#292d30; }
.tick { background:#7b848b52;top:17px; }
.tick.major { background:#a1aab277;top:9px; }
.tick i { top:-7px;left:4px;font-size:10px;color:#b4bfc8;text-shadow:0 1px 1px #15181a; }
.endmark { background:#c78c68;opacity:.8; }
.time-grid { top:29px; opacity:.72; background-image:linear-gradient(90deg,#dbe5ed23 1px,transparent 1px),linear-gradient(90deg,#c5d8e510 1px,transparent 1px); }
.trow { height:36px;border-bottom:1px solid #171a1c; }
.trow:nth-child(odd) { background:#ffffff02; }
.trow:nth-child(even) { background:#00000012; }
.trow.on { background:#48658022; }
.trow.muted { opacity:.62; }
.head { padding:3px 5px; background:#303437;border-right:1px solid #161819;box-shadow:inset 0 1px 0 #ffffff06; }
.trow:nth-child(even) .head { background:#2c3033; }
.trow.on .head { box-shadow:inset 3px 0 0 #659ac1;background:#3b4a56; }
.l1 { gap:4px; }
.ico { display:flex;align-items:center;justify-content:center;width:24px;height:23px;border-radius:2px;background:#171a1e99;border:1px solid #ffffff14; }
.tn { color:#e0e5e8; height:24px;font-size:11px;padding:0 4px; }
.tn:focus { background:#1e2225;border-color:#759cb7;outline:none; }
.track-mute { width:23px;height:22px;flex:none;display:flex;align-items:center;justify-content:center;padding:0;border:1px solid transparent;color:#939da4;background:transparent;border-radius:2px; }
.track-mute:hover { color:#f0f5fa;background:#535d64;border-color:#6b777e; }
.track-mute.active { color:#eab887;background:#544337;border-color:#80634c; }
.track-readonly { display:inline-flex;align-items:center;color:#a2adb6; }
.lane { background:transparent; }
.bakeclip { top:5px;height:26px;border-radius:2px;background:linear-gradient(#397182,#2c5865);border:1px solid #729fa8;font-size:10px;line-height:15px; }
.span { display:block;position:absolute;z-index:2;top:5px;height:26px;min-width:1px;box-sizing:border-box;border:1px solid color-mix(in srgb,var(--c) 85%,#111);border-left:3px solid var(--c);border-radius:2px;padding:3px 5px;background:linear-gradient(180deg,color-mix(in srgb,var(--c) 35%,#26323a),color-mix(in srgb,var(--c) 18%,#1c2226));color:#e5edf3;opacity:1;cursor:pointer;overflow:hidden;white-space:nowrap;text-align:left;font:inherit;font-size:10px;line-height:18px;pointer-events:auto; }
.span span { display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;pointer-events:none; }
.span:hover { filter:brightness(1.15); }
.span.selected { outline:1px solid #dce8f0;outline-offset:-2px; }
.span.cut { background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--c) 14%,#202427) 0 7px,color-mix(in srgb,var(--c) 23%,#202427) 7px 14px);border-style:dashed;opacity:1; }
.key { top:8px;height:20px;max-height:22px;line-height:18px;border:1px solid #0c1012;border-left:3px solid #0c1012;border-radius:2px;background:var(--c);box-shadow:inset 0 1px 0 #ffffff3a; }
.key.camera,.key.node,.key.method { top:12px;width:13px;height:13px;min-width:13px;transform:translateX(-7px);border-radius:50%;border:2px solid #14191c;box-shadow:0 0 0 1px var(--c); }
.key.on { outline:2px solid #ecf5ff;outline-offset:1px; }
.segment-grip { top:5px;height:26px;width:10px;border-radius:1px;border:1px solid #ffffff88;border-left:2px solid #ffffffa3;border-right:2px solid #ffffffa3;opacity:1;background:color-mix(in srgb,var(--c) 55%,#303336); }
.segment-grip:hover,.segment-grip:focus-visible { background:#f0e9d6;outline:1px solid white; }
.playhead { border-left:1px solid #edf3f7;box-shadow:1px 0 0 #15191d; }
.playhead-grip { background:#e8ecee;clip-path:polygon(0 0,100% 0,100% 62%,50% 100%,0 62%); }
.playhead-grip:hover,.playhead-grip:focus-visible { background:#fff;filter:drop-shadow(0 0 3px #fff7); }
.hint { padding:20px;color:#9faab2; }
.timeline-status { flex:none;display:flex;align-items:center;gap:7px;height:20px;min-height:20px;overflow:hidden;padding:0 9px;border-top:1px solid #16191b;background:#272b2e;color:#8f9ba3;font-size:10px;white-space:nowrap; }
.timeline-status span:not(.grow) { overflow:hidden;text-overflow:ellipsis; }
.timeline-status .status-divider { width:1px;height:10px;background:#565b60;flex:none; }
.tlp :is(button,input,select):focus-visible { outline:2px solid #82b3d8;outline-offset:1px; }
@container (max-width: 800px) { .timeline-titlebar .timeline-selector { max-width:205px; }.zoom-slider { width:46px; } .bar .total-time { display:none; } }
@container (max-width: 540px) { .bar { flex-wrap:wrap;height:auto;min-height:32px;row-gap:2px; } .timeline-titlebar .timeline-selector { flex:1 1 120px;max-width:none; } .bar .zoom-tools { display:none; } .bar .snap-tools { display:none; } .time-readout { padding:0 2px; } .timeline-titlebar .create-timeline span { display:none; } .timeline-status .status-divider { display:none; } }
@container (max-width: 350px) { .timeline-titlebar .timeline-selector { flex:1 1 100%; } .bar .time-readout { flex:1; } .bar .transport { flex:none; } .bar .grow { display:none; } }

/* CORR-001 QA visual: dos columnas de presentación, UN único scrollbar de tiempo.
   Izquierda sin scroll horizontal; la derecha recorta claves y regla en su límite. */
.main { display:grid; grid-template-columns:var(--tl-header-width) minmax(0,1fr); overflow:hidden; }
.pinned-column { grid-column:1; position:relative; z-index:9; min-height:0; min-width:0; overflow:hidden; background:#303437; border-right:1px solid #14191d; }
.pinned-column .hcorner { position:relative; left:auto; top:0; transform:none; width:100%; height:29px; flex:none; box-sizing:border-box; padding:2px 6px; overflow:visible; z-index:2; }
.pinned-column .header-resizer { right:0; width:8px; }
.pinned-viewport { position:absolute; inset:29px 0 0; overflow:hidden; }
.pinned-rows { width:100%; will-change:transform; }
.pinned-row { display:flex; height:36px; min-height:36px; border-bottom:1px solid #171a1c; box-sizing:border-box; }
.pinned-row .head { position:relative; left:auto; transform:none; width:100%; height:100%; min-width:0; flex:1; border-right:0; box-sizing:border-box; z-index:auto; }
.pinned-row:nth-child(even) .head { background:#2c3033; }
.pinned-row .head.on { box-shadow:inset 3px 0 0 #659ac1; background:#3b4a56; }
.pinned-row .head.muted { opacity:.62; }
.scroll { grid-column:2; min-width:0; min-height:0; overflow:auto; position:relative; }
.inner { width:max-content; min-height:100%; }
.rulerrow { position:sticky; top:0; left:0; z-index:6; width:100%; height:29px; }
.ruler { min-width:0; }
.time-grid { left:0; background-position:var(--tl-time-origin) 0, var(--tl-time-origin) 0; }
/* Zona visible antes de cero; el cálculo de tiempo y los eventos son independientes. */
.inner::before { content:''; position:absolute;left:0;top:0;bottom:0;width:var(--tl-time-origin);pointer-events:none;z-index:2;background:color-mix(in srgb,var(--g-950) 24%,transparent);border-right:1px solid var(--hair);box-sizing:border-box; }
.trow { display:block; height:36px; }
.lane { width:100%; height:100%; }
.playhead { left:0; }
/* G002: selección de claves editoriales sin alterar el dibujo ni el scroll fijado en G001. */
.selection-tools { display:flex;gap:5px;align-items:center;min-height:23px;padding:0 5px;border:1px solid #59768a;border-radius:2px;background:#334650;color:#e6f2fb;font-size:10px;white-space:nowrap; }
.selection-tools button { display:flex;align-items:center;justify-content:center;width:22px;height:21px;padding:0;background:transparent;border:1px solid transparent;color:#c9dce8; }
.selection-tools button:hover,.selection-tools button:focus-visible { border-color:#86a4b8;background:#445d6d; }
.timeline-marquee { position:absolute;z-index:30;pointer-events:none;border:1px solid #9bd4ff;background:rgba(78,156,219,.18);box-shadow:0 0 0 1px #2d6085 inset; }
.key.on { outline:2px solid #f1fbff;outline-offset:1px;box-shadow:0 0 0 2px #2479b1; }
@container (max-width: 540px) { .selection-tools {order:4;flex:1 1 100%;} }

/* G003: clips reales por referencias a claves, dentro del mismo carril temporal. */
.timeline-edit-modes { display:flex;align-items:center;gap:1px;flex:none;padding:2px;background:#24282a;border:1px solid #464e53;border-radius:3px; }
.timeline-edit-modes button { min-height:22px;height:22px;min-width:45px;padding:1px 5px;border:1px solid transparent;background:transparent;color:#aeb9c2;font-size:10px;border-radius:2px; }
.timeline-edit-modes button:hover { background:#45515b;color:#f3f7fa; }
.timeline-edit-modes button.on { color:#edf6fb;border-color:#6390ae;background:#37566a; }
.clip-create,.clip-remove { min-height:23px;height:23px;border:1px solid #58636a;border-radius:2px;background:#303c45;color:#d4e1ea;font-size:10px;padding:0 7px;white-space:nowrap; }
.clip-remove { color:#e8b3ad;border-color:#765352; }
.timeline-live-clip { position:absolute;top:5px;height:25px;min-width:0;box-sizing:border-box;border:1px solid var(--c);border-radius:2px;background:linear-gradient(180deg,color-mix(in srgb,var(--c) 35%,#1f313a),color-mix(in srgb,var(--c) 53%,#243444));z-index:4;color:#f2f8fc;cursor:grab;display:flex;align-items:center;padding:0 10px 0 5px;overflow:hidden;text-align:left;box-shadow:inset 0 1px 0 #ffffff4c; }
.timeline-live-clip:hover { filter:brightness(1.16); }
.timeline-live-clip:active { cursor:grabbing; }
.timeline-live-clip.on { outline:2px solid #e4f3ff;outline-offset:1px;z-index:5; }
.timeline-live-clip.mixing { background:repeating-linear-gradient(130deg,color-mix(in srgb,var(--c) 50%,#263947) 0 8px,color-mix(in srgb,var(--c) 35%,#20313d) 8px 16px); }
.timeline-live-clip .clip-caption { white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:10px;min-width:0;pointer-events:none; }
.timeline-live-clip .clip-tail { position:absolute;right:0;top:0;height:100%;width:9px;cursor:ew-resize;box-sizing:border-box;border-left:2px solid #ffffff8a;background:#12181a55; }
.timeline-live-clip .clip-tail:hover,.timeline-live-clip .clip-tail:focus-visible {background:#dbe9f5a6;outline:1px solid #fff; }
.lane .key { z-index:6; }
@container (max-width: 680px) { .timeline-edit-modes { order:3; } .bar .clip-create,.bar .clip-remove {order:4;} }

/* G004: filas de grupo y pista comparten altura y orden en ambas superficies.
   El Player sigue usando tl.tracks, nunca esta proyección de filas. */
.group-row {height:36px!important;min-height:36px!important;background:#29343a!important;}
.group-head {width:100%;height:100%;box-sizing:border-box;display:flex;gap:5px;align-items:center;padding:0 7px;border-left:3px solid #7697a9;border-right:0;background:#32414a;color:#dce8ef;font-weight:600;font-size:11px;}
.group-toggle,.group-drag,.track-drag {flex:none;display:flex;justify-content:center;align-items:center;width:18px;height:22px;padding:0;background:transparent;border:0;color:#9fb6c5;cursor:grab;}
.group-toggle {cursor:pointer;}
.group-name {min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;cursor:default;}
.group-count {color:#819dad;font-size:10px;}
.group-lane {width:100%;height:100%;box-sizing:border-box;border-bottom:1px solid #1c252b;background:#2b394122;}
.track-root {border:0;background:transparent;color:#899ba5;padding:0 4px;font-size:10px;cursor:default;}
.track-root:hover {background:#455862;color:#e0e9ef;}
.track-drag {width:13px;color:#798791;}
.track-lock {width:20px;height:22px;flex:none;display:flex;align-items:center;justify-content:center;padding:0;border:1px solid transparent;border-radius:2px;background:transparent;color:#6f7a83;}
.track-lock:hover {color:#e8eef2;background:#485157;}
.track-lock.active {color:#e9b77f;background:#59483b;border-color:#896849;}
.pinned-row .head.locked {box-shadow:inset 3px 0 0 #b68b5f;}
.trow.locked .lane {opacity:.76;}
.trow.locked .key,.trow.locked .timeline-live-clip,.trow.locked .span {cursor:not-allowed;}
.timeline-marker {position:absolute;top:0;z-index:15;transform:translateX(-50%);width:14px;height:23px;display:flex;align-items:flex-start;justify-content:center;padding:2px 0;border:0;border-radius:2px;background:#75573a;color:#ffe1aa;cursor:ew-resize;}
.timeline-marker:hover,.timeline-marker.on {background:#aa7844;color:#fff4d6;outline:1px solid #f6cc82;}
.clip-create {display:inline-flex;align-items:center;gap:4px;}

.curve-toggle { height:23px;flex:none;border:1px solid #59656e;border-radius:2px;background:#2e383e;color:#d5dce2;font-size:10px;padding:0 7px; }
.curve-toggle.on { background:#3d607c;border-color:#87aed0;color:#fff; }

/* G005 CORR-001 · Responsive First: toolbar completa y desplazable, cabecera sin duplicado. */
.timeline-titlebar { min-height:30px; height:auto; padding-block:3px; gap:7px; }
.timeline-titlebar .timeline-selector {flex:1 1 110px;max-width:300px;min-width:52px;}
.bar {flex-wrap:nowrap!important; height:37px!important; min-height:37px!important; overflow-x:auto; overflow-y:hidden; scrollbar-width:thin; scrollbar-color:#798995 #2a3033; overscroll-behavior-x:contain; }
.bar>* {flex-shrink:0!important; order:0!important;}
.bar .grow {flex:none!important;width:0;}
.bar .zoom-tools,.bar .snap-tools,.bar .wide-only {display:inline-flex!important;}
.bar .selection-tools {flex:none!important;}
.bar::-webkit-scrollbar {height:5px;}
.bar::-webkit-scrollbar-thumb {background:#798995;border-radius:4px;}
@container (max-width:540px) {
  .timeline-titlebar .timeline-selector {max-width:none;flex:1 1 80px;}
  .bar .zoom-tools,.bar .snap-tools {display:inline-flex!important;}
  .bar .total-time {display:inline!important;}
}
@container (max-width:350px) {
  .timeline-titlebar {flex-wrap:wrap;}
  .timeline-titlebar .timeline-selector {flex:1 1 80px;}
  .bar {flex-wrap:nowrap!important;}
}
/* CORR-003: UN solo corchete global de altura completa. La capa es hermana
   del scroller: su remate inferior sigue visible con cualquier scroll vertical. */
.main { position:relative; }
.duration-overlay { position:absolute;top:0;right:0;overflow:hidden;pointer-events:none;z-index:12;min-width:0; }
.duration-grip { position:absolute;top:0;bottom:0;height:100%;width:15px;box-sizing:border-box;
  transform:translateX(-100%);padding:0;border:0;border-right:3px solid #eac471;
  border-radius:0;background:transparent;box-shadow:none;cursor:ew-resize;
  touch-action:none;pointer-events:auto;z-index:1; }
.duration-grip::before,.duration-grip::after { content:'';position:absolute;right:0;width:12px;height:3px;
  border-radius:1px;background:#eac471;pointer-events:none; }
.duration-grip::before { top:0; }
.duration-grip::after { bottom:0; }
.duration-grip:hover,.duration-grip:focus-visible { background:#e4c06b22;border-right-color:#ffe09b;outline:0; }
.duration-grip:hover::before,.duration-grip:hover::after,.duration-grip:focus-visible::before,.duration-grip:focus-visible::after { background:#ffe09b; }
.duration-grip:focus-visible { outline:2px solid #fff1bd;outline-offset:-2px; }
/* La curva está sobre la onda existente, sin superficie que intercepte el arrastre del clip. */
.audio-volume-envelope {position:absolute;top:8px;height:27px;z-index:7;pointer-events:none;overflow:visible;}
.audio-volume-envelope path {fill:none;stroke:#ffe5a1;stroke-width:1.8;vector-effect:non-scaling-stroke;}
.audio-volume-point {position:absolute;z-index:14;transform:translate(-50%,-50%);width:11px;height:11px;
  padding:0;border-radius:2px;border:1px solid #292718;background:#f4d783;box-shadow:0 0 0 1px #2229;
  cursor:move;touch-action:none;}
.audio-volume-point:focus-visible,.audio-volume-point:hover {outline:2px solid white;outline-offset:1px;}
.audio-fade-envelope {position:absolute;top:8px;height:27px;z-index:6;pointer-events:none;overflow:visible;}
.audio-fade-envelope path {fill:none;stroke:#d9f8d0;stroke-width:1.5;vector-effect:non-scaling-stroke;opacity:.88;}
.audio-fade-grip {position:absolute;top:2px;z-index:12;width:13px;height:13px;padding:0;
  transform:translateX(-50%);border:1px solid #12352b;border-radius:2px;
  background:#c8efcc;box-shadow:0 1px 2px #07140e;cursor:ew-resize;touch-action:none;}
.audio-fade-grip.fade-in {clip-path:polygon(0 0,100% 0,0 100%);}
.audio-fade-grip.fade-out {clip-path:polygon(0 0,100% 0,100% 100%);}
.audio-fade-grip:hover,.audio-fade-grip:focus-visible {background:#fff;filter:drop-shadow(0 0 2px #b4f5c0);}
.audio-fade-grip:focus-visible {outline:2px solid #fff;outline-offset:2px;clip-path:none;}
.audio-duration-tail {position:absolute;top:8px;width:10px;height:27px;box-sizing:border-box;padding:0;
  transform:translateX(-100%);border:0;border-right:3px solid #dcffe2;border-radius:0 2px 2px 0;
  background:linear-gradient(90deg,transparent,#345b4588);cursor:ew-resize;touch-action:none;z-index:10;}
.audio-duration-tail:hover,.audio-duration-tail:focus-visible {background:#a5e7bd88;border-right-color:#fff;outline:1px solid #fff;}
.audio-duration-head {position:absolute;top:8px;width:10px;height:27px;box-sizing:border-box;padding:0;
  transform:none;border:0;border-left:3px solid #dcffe2;border-radius:2px 0 0 2px;
  background:linear-gradient(90deg,#345b4588,transparent);cursor:ew-resize;touch-action:none;z-index:11;}
.audio-duration-head:hover,.audio-duration-head:focus-visible {background:#a5e7bd88;border-left-color:#fff;outline:1px solid #fff;}

/* Audio es una banda de duración, no un marcador centrado: su extremo derecho
   coincide con el asa y con la coordenada temporal incluso al cambiar el zoom. */
.lane .key.audio {z-index:5;transform:none;box-sizing:border-box;min-width:0;}
.lane .key.audio:has(> .timeline-waveform) {
  height:27px; max-height:27px; color:#dcf2e6;
  background:color-mix(in srgb,var(--c) 30%,#1d2c26);
}
.lane .key.audio > .timeline-waveform + em {
  position:absolute; inset:1px 5px auto; line-height:10px; text-align:left; pointer-events:none;
}

/* Llaves sobre la banda superior; el cuerpo de clip es una superficie libre de arrastre. */
.lane .key.camera,.lane .key.node { top:0px; z-index:8; width:11px;height:11px;min-width:11px;transform:translateX(-50%);}
.lane .span { top:9px;height:24px; padding-top:1px; }
.lane .segment-grip {top:8px;height:27px;width:10px;transform:translateX(-10%);z-index:8;background:color-mix(in srgb,var(--c) 62%,#26343b);cursor:ew-resize;}
.lane .timeline-live-clip { top:9px;height:24px;padding:0 8px 0 5px;overflow:hidden;z-index:4; }
.lane .timeline-live-clip.on {z-index:6;}
.lane .clip-tail-external { position:absolute; top:8px; width:10px;height:27px;transform:translateX(-10%); border:1px solid #b3c0c8;border-left:3px solid #e8f0f6; border-radius:2px; box-sizing:border-box; background:color-mix(in srgb,var(--c) 35%,#29323a); cursor:ew-resize;touch-action:none;z-index:9;opacity:.9; }
.lane .clip-tail-external:hover,.lane .clip-tail-external:focus-visible,.lane .clip-tail-external.on {background:#d3e8fa;border-color:#fff;opacity:1;}
/* El cuerpo del segmento no queda cubierto por marcadores de claves. */
.lane .span:not(.selected) {z-index:2;}

/* Mensajes reversibles de la sesión de comandos. No son recursos de UI del juego. */
/* Ctrl sobre cualquier clip: flecha normal, incluidos controles superpuestos.
   Al soltarlo se recuperan los cursores establecidos por las herramientas. */
.tlp.ctrl-over-clips .lane :is(.key, .span, .timeline-live-clip, .bakeclip,
  .audio-duration-tail, .audio-duration-head, .clip-tail-external, .segment-grip, .audio-fade-grip,
  .audio-volume-point, .clip-tail),
.tlp.ctrl-over-clips .lane :is(.key, .span, .timeline-live-clip, .bakeclip,
  .audio-duration-tail, .audio-duration-head, .clip-tail-external, .segment-grip, .audio-fade-grip,
  .audio-volume-point, .clip-tail) * { cursor: default !important; }

/* S13-G008-G001: sólo presentación. El eje temporal y sus coordenadas se conservan. */
.tlp { --tl-bg:var(--g-900);--tl-pane:var(--g-850);--tl-sep:var(--hair);--tl-text:var(--text);--tl-accent:var(--blue); }
.timeline-titlebar { background:var(--editor-chrome, var(--g-900));border-bottom-color:var(--hair-soft);box-shadow:none; }
.timeline-titlebar .timeline-picker { background:var(--g-850);border-color:var(--hair);color:var(--text); }
.timeline-titlebar .create-timeline {color:var(--text-2);}
.bar {background:var(--g-800);border-bottom-color:var(--hair-soft);box-shadow:none;}
.bar .transport .tp { background:var(--g-900); border-color:var(--hair-soft); }
.bar .transport .tp:hover { background:var(--g-700); }
.bar .transport .tp.on { background:var(--editor-selection, var(--blue-wash)); border-color:var(--blue-hi); }
.main {background:var(--g-900);border-top-color:var(--hair);}
.scroll {background:var(--g-900);scrollbar-color:var(--g-600) var(--g-900);}
.inner {background:repeating-linear-gradient(0deg,transparent 0,transparent 35px,color-mix(in srgb,var(--text) 3%,transparent) 35px,color-mix(in srgb,var(--text) 3%,transparent) 36px);}
.rulerrow,.ruler {background:var(--editor-chrome, var(--g-900));border-bottom-color:var(--hair-soft);}
.hcorner,.head {background:var(--g-850);border-color:var(--hair);box-shadow:none;}
.group-row {background:var(--g-850)!important;}
.group-head {background:var(--g-800);border-left-color:var(--blue);color:var(--text);}
.group-lane {border-bottom-color:var(--hair);background:transparent;}
.trow {border-bottom-color:var(--hair);}
.curve-toggle {background:var(--g-800);border-color:var(--hair);color:var(--text-2);}
.curve-toggle.on {background:var(--g-700);border-color:var(--blue);color:var(--text);}
/* La guía temporal se dibuja detrás de clips, asas y rombos; la agarradera sigue en la regla. */
.playhead { z-index:1; border-left:1px solid var(--text);box-shadow:1px 0 0 var(--g-950);pointer-events:none; }
.rulerrow {z-index:26;}
.playhead-grip {z-index:27;}
/* CORR-002: superficies residuales que heredaban grises de la antigua Timeline.
   La selección y los bloqueos permanecen distinguibles; ninguna coordenada temporal cambia. */
.pinned-column { background:var(--g-850);border-right-color:var(--hair); }
.pinned-row { border-bottom-color:var(--hair); }
.pinned-row:nth-child(even) .head,.trow:nth-child(even) .head { background:var(--g-850); }
.pinned-row .head.on,.trow.on .head { background:var(--g-800);box-shadow:inset 3px 0 0 var(--blue); }
.trow:nth-child(odd),.trow:nth-child(even) { background:transparent; }
.trow.on { background:var(--editor-selection, var(--blue-wash)); }
.timeline-edit-modes { background:var(--g-850);border-color:var(--hair); }
.timeline-edit-modes button { color:var(--text-2); }
.timeline-edit-modes button:hover { background:var(--g-700);color:var(--text); }
.timeline-edit-modes button.on { background:var(--blue-wash);border-color:var(--blue);color:var(--text); }
.track-add { background:var(--g-800);border-color:var(--hair);color:var(--text); }
.track-add:hover,.track-add.on { background:var(--g-700);border-color:var(--blue); }
.snap-tools select { background:var(--g-950);border-color:var(--hair);color:var(--text); }
.bar { scrollbar-color:var(--g-600) var(--g-850); }
.bar::-webkit-scrollbar-thumb { background:var(--g-600); }

/* Jerarquía de animación: una sola composición para nodos y propiedades.
   Las dos columnas comparten la proyección de filas; no se altera su altura (36px). */
.pinned-row .head .l1 {gap:5px;}
.pinned-row .head .ico {width:18px;height:22px;flex:none;background:transparent;border:0;}
.pinned-row .head .track-drag {width:12px;flex:none;opacity:.75;}
.pinned-row .head .track-mute,.pinned-row .head .track-lock {width:22px;height:24px;flex:none;border-radius:3px;}
.pinned-row .head .tn {min-width:0;font-size:11px;color:var(--text-2);}
.pinned-row .head .tn:focus {color:var(--text);background:var(--g-900);border-color:var(--blue);}
.group-head {background:var(--g-800);border-left-color:color-mix(in srgb,var(--blue) 55%,var(--g-800));}
.pinned-row.node-heading-row {height:var(--tl-node-row-height);min-height:var(--tl-node-row-height);}
.pinned-row.property-value-row {height:var(--tl-property-row-height);min-height:var(--tl-property-row-height);}
.trow.node-row {height:var(--tl-node-row-height);}
.trow.property-value-row {height:var(--tl-property-row-height);}
.pinned-row.node-heading-row,
.pinned-row.node-child-row { border-bottom-color:transparent; }
.pinned-row.node-heading-row:not(:first-child),
.trow.node-row:not(:first-child) { border-top:1px solid var(--hair); }
.pinned-row .node-head {
  width:100%;min-width:0;box-sizing:border-box;display:flex;align-items:center;gap:6px;
  padding:0 8px;background:var(--g-850);
}
.pinned-row .node-head.node-selected { background:var(--editor-selection, var(--blue-wash)); }
.node-row-toggle {display:grid;place-items:center;width:16px;height:24px;flex:none;padding:0;border:0;background:transparent;color:var(--text-3);}
.node-row-toggle:hover {color:var(--text);}
.node-row-name {display:flex;justify-content:flex-start;flex:1;min-width:0;gap:8px;align-items:center;height:100%;padding:0;border:0;background:transparent;color:var(--text);text-align:left;font-weight:600;font-size:12px;}
.node-row-name > svg {flex:none;color:var(--text-2);}
.node-row-name span {min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.node-head .node-key-picker {border:0;background:transparent;color:var(--text-3);}
.node-head .node-key-picker:hover,.node-head .node-key-picker:focus-visible {background:var(--g-700);color:var(--text);}
.pinned-row .head.node-property-head {
  position:relative;padding:0 8px 0 66px;border:0;background:var(--g-850);box-shadow:none;
}
.pinned-row .head.node-property-head::before {
  content:'';position:absolute;left:36px;top:0;bottom:0;border-left:1px solid var(--hair);
}
.pinned-row .head.node-property-head:hover {background:var(--g-800);}
.pinned-row .head.node-property-head.on {background:var(--blue-wash);box-shadow:none;}
.property-row-content {width:100%;height:100%;min-width:0;gap:0;}
.property-row-select {
  display:flex;justify-content:flex-start;flex:1;min-width:0;height:100%;padding:0;border:0;background:transparent;
  text-align:left;color:var(--text-2);font:inherit;
}
.node-property-name {display:block;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:12px;font-weight:400;}
.node-property-head.on .property-row-select {color:var(--text);}
.pinned-row .node-property-head .track-drag {position:absolute;left:39px;width:16px;opacity:0;color:var(--text-3);}
.property-actions {display:flex;align-items:center;gap:2px;position:absolute;right:6px;top:0;height:100%;opacity:0;pointer-events:none;background:inherit;}
.property-actions :deep(.property-key),.property-menu {
  display:inline-grid;place-items:center;width:22px;min-width:22px;height:20px;padding:0;
  border:0;border-radius:3px;background:transparent;color:var(--text-3);
}
.property-menu {font-size:18px;line-height:1;}
.property-actions :deep(.property-key.marked) {color:var(--blue);}
.property-actions :deep(.property-key:hover),.property-menu:hover {background:var(--g-700);color:var(--text);}
.node-property-head:hover .property-actions,.node-property-head:focus-within .property-actions {opacity:1;pointer-events:auto;}
.node-property-head:hover .property-row-select,.node-property-head:focus-within .property-row-select {padding-right:48px;}
.pinned-row .node-property-head:hover .track-drag,.pinned-row .node-property-head:focus-within .track-drag {opacity:1;}
.property-state {display:flex;align-items:center;gap:3px;padding-left:6px;color:var(--text-3);}
.node-property-head:hover .property-state,.node-property-head:focus-within .property-state {visibility:hidden;}
.node-row {background:var(--g-850)!important;}
.node-lane {height:100%;background:var(--g-850);box-sizing:border-box;}
.trow.node-child-row {border-bottom-color:transparent;}
.node-group-conflict {padding:6px 10px;max-width:580px;color:var(--text-2);font-size:11px;background:var(--g-800);border:1px solid var(--hair);}
/* S13-G008 CORR-003: una pista de propiedad son claves puntuales; las tomas conservan clips. */
.lane.property-lane { cursor:crosshair; }
.lane.property-lane .node-key-interval { position:absolute;top:18px;height:2px;z-index:1;pointer-events:none;background:color-mix(in srgb,var(--c) 52%,transparent);opacity:.72; }
.lane.property-lane .node-key-interval.cut { background:repeating-linear-gradient(90deg,var(--c) 0 3px,transparent 3px 7px);opacity:.55; }
.lane.property-lane .key.node { top:12px; width:11px;min-width:11px;height:11px;min-height:11px;max-height:11px;transform:translateX(-50%) rotate(45deg);border:1.5px solid #14222b;border-radius:1px;box-shadow:0 0 0 1px var(--c);background:var(--c);z-index:5;padding:0;cursor:ew-resize; }
.lane.property-lane .key.node.on,.lane.property-lane .key.node:focus-visible { outline:2px solid var(--text);outline-offset:2px; }
.lane.property-lane .key.node:hover {background:color-mix(in srgb,var(--c) 76%,white);}
.lane.property-lane .key.node > em { display:none; }

.property-value-row .lane.property-lane .key.node {top:calc((var(--tl-property-row-height) - 11px) / 2);}
.property-value-row .lane.property-lane .node-key-interval {top:calc(var(--tl-property-row-height) / 2);}

.tlp.ctrl-over-clips .lane.property-lane { cursor:default; }
.timeline-status { background:var(--editor-chrome, var(--g-900)); border-top-color:var(--hair-soft); color:var(--text-2); }
.timeline-status .status-divider { background:var(--hair); }
.timeline-fps-control {display:inline-flex;align-items:center;gap:4px;white-space:nowrap;font-size:10px;color:var(--muted,var(--g-300));}
.timeline-fps-control input {width:40px;min-width:40px;background:var(--g-900,#151515);color:inherit;border:1px solid var(--hair,#444);border-radius:3px;padding:3px 2px;text-align:center;font:inherit;}
</style>
