<script setup>
// Marco común para las ventanas de edición de Eventos y Scripts.
// Solo administra la geometría de la ventana; no modifica el contenido ni el estado del proyecto.
import { acquirePointer } from '../engine/runtime/input/pointer-capture.js'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import Icon from './Icon.vue'
import ToolAlerts from './ToolAlerts.vue'
import { fitEditorWindow } from '../core/editor/window-layout.js'
import { store, toast } from '../core/store.js'
import { findDockPanel, moveDockPanel, floatDockPanel, updateDockFloat, restoreDockPanel, DOCK_PANELS } from '../core/editor/docking.js'
import { activateViewportDock, activateCodeDock } from '../core/editor/view-dock-session.js'
import { useNativeToolWindow, useMountedDockTarget } from '../core/editor/native-tool-window.js'
import { startDockGesture, startNativeDockTransfer } from '../core/editor/dock-gesture.js'
import { getDockSpawn } from '../core/editor/native-dock.js'

const props = defineProps({
  initialWidth: { type: Number, required: true },
  initialHeight: { type: Number, required: true },
  label: { type: String, required: true },
  startMaximized: { type: Boolean, default: false },
  docked: { type: Boolean, default: false },
  visible: { type: Boolean, default: true },
  dockTarget: { type: String, default: '#shader-graph-host' },
  dockPanelId: { type: String, default: '' },
  integratedTitlebar: { type: Boolean, default: false },
  titleIcon: { type: String, default: 'script' },
  subtitle: { type: String, default: '' },
  nativeTool: { type: String, default: '' },
  nativeOnDemand: { type: Boolean, default: false },
  nativeClosable: { type: Boolean, default: true },
  closable: { type: Boolean, default: true },
})
const emit = defineEmits(['close', 'native-change'])
const nativeRequested = ref(false)
const nativeTarget = useNativeToolWindow({
  kind: props.nativeTool,
  enabled: () => !!props.nativeTool && (!props.nativeOnDemand || nativeRequested.value),
  title: () => props.label,
  width: () => props.initialWidth,
  height: () => props.initialHeight,
  position: () => getDockSpawn(props.dockPanelId) || (findDockPanel(store.prefs.dockLayout, props.dockPanelId)?.kind === 'float' ? findDockPanel(store.prefs.dockLayout, props.dockPanelId) : null),
  registryId: props.dockPanelId,
  canClose: () => props.nativeClosable,
  close: () => { if (props.nativeOnDemand) { nativeRequested.value = false; if (props.dockPanelId && props.dockPanelId !== 'codeView') restoreNativeDock() } else emit('close', 'native') },
})
watch(nativeTarget, async (target) => {
  if (props.dockPanelId === 'codeView') store.ui.codeNativeOpen = !!target
  await nextTick()
  emit('native-change', !!target)
}, { flush: 'post' })
function openNative() {
  if (nativeTarget.value) { activateCodeDock(store); return }
  if (!window.lf?.isElectron || !props.nativeTool) return
  if (maximized.value) maximized.value = false
  nativeRequested.value = true
  if (!nativeTarget.value) {
    nativeRequested.value = false
    toast('No se pudo abrir la ventana', 'error')
    return
  }
  if (props.dockPanelId && props.dockPanelId !== 'codeView') store.prefs.dockLayout = floatDockPanel(store.prefs.dockLayout, props.dockPanelId, { ...getDockSpawn(props.dockPanelId), w: props.initialWidth, h: props.initialHeight })
  if (props.dockPanelId === 'codeView' && store.ui.mode === 'desktop') activateViewportDock(store, 'sceneView')
}
function onNativeDockEvent(event) {
  if (event.detail?.id !== props.dockPanelId) return
  if (event.type === 'century:dock-detach') openNative()
  else void attachNative()
}
function restoreNativeDock() {
  if (!props.dockPanelId) return
  let at = findDockPanel(store.prefs.dockLayout, props.dockPanelId)
  if (at?.kind !== 'dock') {
    store.prefs.dockLayout = restoreDockPanel(store.prefs.dockLayout, props.dockPanelId)
    at = findDockPanel(store.prefs.dockLayout, props.dockPanelId)
  }
  if (at?.kind === 'dock') store.prefs[at.zone + 'Open'] = true
}
async function attachNative() {
  if (!nativeTarget.value) return
  nativeRequested.value = false
  await nextTick()
  if (!nativeTarget.value && props.dockPanelId === 'codeView') activateCodeDock(store)
  else if (!nativeTarget.value) restoreNativeDock()
}
const location = computed(() => props.dockPanelId ? findDockPanel(store.prefs.dockLayout, props.dockPanelId) : null)
const workspaceDocked = computed(() => !nativeTarget.value && store.ui.mode === 'desktop' && location.value?.kind === 'dock')
const isDocked = computed(() => workspaceDocked.value || props.docked)
const focusMode = computed(() => props.dockPanelId === 'codeView' && maximized.value && !nativeTarget.value)
const target = computed(() => {
  if (!workspaceDocked.value) return props.dockTarget
  const z = location.value.zone
  const unavailable = store.ui.mode !== 'desktop' || store.prefs[z + 'Open'] === false || (store.play.on && store.prefs.gameMaximize)
  return unavailable ? `#lf-dock-special-${props.dockPanelId}` : `#lf-dock-target-${location.value.groupId}-${props.dockPanelId}`
})
const mountedDockTarget = useMountedDockTarget(() => target.value, () => `#lf-dock-special-${props.dockPanelId}`, () => [store.prefs.dockLayout, store.play.on, store.prefs.gameMaximize, store.ui.mode, nativeTarget.value])
const teleportTo = computed(() => nativeTarget.value || (focusMode.value ? 'body' : (isDocked.value
  ? mountedDockTarget.value : 'body')))
function nativeTitleDown(event) {
  if (event.target.closest?.('button,input,select,textarea,a,[data-no-window-drag]')) return
  if (nativeTarget.value && props.dockPanelId) startDockGesture(event, props.dockPanelId, store, true)
}
function toggleWorkspaceDock() {
  if (!props.dockPanelId || !DOCK_PANELS[props.dockPanelId]) return
  if (props.dockPanelId === 'codeView') return
  const layout = store.prefs.dockLayout
  store.prefs.dockLayout = workspaceDocked.value
    ? floatDockPanel(layout, props.dockPanelId, { x: position.left, y: position.top, w: dimensions.w, h: dimensions.h })
    : moveDockPanel(layout, props.dockPanelId, DOCK_PANELS[props.dockPanelId][2])
  if (props.dockPanelId === 'shaderGraph') { store.prefs.shaderGraphDocked = false; store.modal = 'shader' }
  if (workspaceDocked.value) store.prefs[DOCK_PANELS[props.dockPanelId][2] + 'Open'] = true
}
const margin = 12
const BAR_H = 36 // los botones nativos de la ventana (Zorin/Electron) cubren la franja superior
const topMargin = BAR_H + 8
const viewport = reactive({ width: window.innerWidth, height: window.innerHeight })
const maximized = ref(props.startMaximized)
const dragging = ref(false)
const position = reactive({ left: 0, top: 0 })
const dimensions = reactive({ w: props.initialWidth, h: props.initialHeight })
const frame = ref(null)
let drag = null
const persistKey = `lf.float.${props.label}`
function savePosition() {
  if (isDocked.value) return
  if (location.value?.kind === 'float') {
    store.prefs.dockLayout = updateDockFloat(store.prefs.dockLayout, props.dockPanelId, { x: position.left, y: position.top, w: dimensions.w, h: dimensions.h })
    return
  }
  try { localStorage.setItem(persistKey, JSON.stringify({ left: position.left, top: position.top, w: dimensions.w, h: dimensions.h, maximized: maximized.value })) } catch { /* almacenamiento no disponible */ }
}
function loadPosition() {
  if (location.value?.kind === 'float') {
    const r = location.value
    position.left = r.x; position.top = r.y; dimensions.w = r.w; dimensions.h = r.h
    return true
  }
  try {
    const v = JSON.parse(localStorage.getItem(persistKey) || 'null')
    if (!v || !Number.isFinite(v.left) || !Number.isFinite(v.top)) return false
    position.left = v.left; position.top = v.top
    if (Number.isFinite(v.w)) dimensions.w = v.w
    if (Number.isFinite(v.h)) dimensions.h = v.h
    maximized.value = !!v.maximized
    return true
  } catch { return false }
}

const size = computed(() => ({
  width: Math.max(1, viewport.width - margin * 2),
  height: Math.max(1, viewport.height - margin - topMargin),
}))
// El Script Editor maximizado ocupa todo el escritorio bajo la barra principal.
// Otros editores conservan sus márgenes al maximizar.
const width = computed(() => maximized.value
  ? (props.integratedTitlebar ? Math.max(1, viewport.width) : size.value.width)
  : Math.min(dimensions.w, size.value.width))
const height = computed(() => maximized.value
  ? (props.integratedTitlebar ? Math.max(1, viewport.height - BAR_H) : size.value.height)
  : Math.min(dimensions.h, size.value.height))
const geometry = computed(() => isDocked.value || nativeTarget.value || focusMode.value ? {} : ({
  width: `${width.value}px`, height: `${height.value}px`,
  left: `${maximized.value ? (props.integratedTitlebar ? 0 : margin) : position.left}px`,
  top: `${maximized.value ? (props.integratedTitlebar ? BAR_H : topMargin) : position.top}px`,
}))

function clampPosition() {
  // Conservar la posición restaurada incluso cuando el Shader Graph está maximizado.
  const restoredWidth = Math.min(dimensions.w, size.value.width)
  const restoredHeight = Math.min(dimensions.h, size.value.height)
  const rect = fitEditorWindow({ x: position.left, y: position.top, w: restoredWidth, h: restoredHeight }, viewport.width, viewport.height, topMargin, margin)
  position.left = rect.x
  position.top = rect.y
}
function onResize() {
  viewport.width = window.innerWidth
  viewport.height = window.innerHeight
  if (!drag) clampPosition()
}
function clampGrabPosition() {
  // Durante el arrastre solo conservamos una franja alcanzable del título.
  // No forzamos la ventana completa a caber: si casi llena la pantalla, no se podría desplazar horizontalmente.
  const grab = Math.min(96, Math.max(48, width.value / 4))
  position.left = Math.max(grab - width.value, Math.min(viewport.width - grab, position.left))
  position.top = Math.max(topMargin, Math.min(viewport.height - 36, position.top))
}
function toggleMaximize() {
  if (isDocked.value && props.dockPanelId !== 'codeView') return
  if (drag) endDrag()
  maximized.value = !maximized.value
  // Restaurar debe recuperar la ubicación elegida; onResize ya rescata cambios de pantalla.
  savePosition()
}
function isHandleTarget(target) {
  return target instanceof Element && !!target.closest('[data-window-drag-handle]') &&
    !target.closest('button, input, select, textarea, a, [contenteditable="true"], [data-no-window-drag]')
}
function startDrag(event) {
  if (nativeTarget.value || isDocked.value || maximized.value || event.button !== 0 || !isHandleTarget(event.target)) return
  if (!acquirePointer(frame.value, event, "Docking")) return
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY,
    left: position.left, top: position.top }
  dragging.value = true
  event.preventDefault()
}
function moveDrag(event) {
  if (!drag || event.pointerId !== drag.id) return
  position.left = drag.left + event.clientX - drag.x
  position.top = drag.top + event.clientY - drag.y
  clampGrabPosition()
}
function endDrag(event) {
  if (!drag || (event && event.pointerId !== drag.id)) return
  const id = drag.id
  drag = null
  dragging.value = false
  if (frame.value?.hasPointerCapture(id)) frame.value.releasePointerCapture(id)
  savePosition()
}
function doubleClick(event) {
  if (!nativeTarget.value && isHandleTarget(event.target)) toggleMaximize()
}
let resize = null
const handles = ['n','s','e','w','ne','nw','se','sw']
function startResize(event, dir) {
  if (isDocked.value || maximized.value || event.button !== 0) return
  if (!acquirePointer(event.currentTarget, event, "Redimensionar ventana")) return
  resize = { id:event.pointerId, dir, x:event.clientX, y:event.clientY, left:position.left, top:position.top, w:width.value, h:height.value }
  event.stopPropagation(); event.preventDefault()
}
function moveResize(event) {
  if (!resize || resize.id !== event.pointerId) return
  const r = resize, dx = event.clientX - r.x, dy = event.clientY - r.y
  const minW = Math.min(300, size.value.width), minH = Math.min(220, size.value.height)
  let { left, top, w, h } = r
  const clamp = (value, a, b) => Math.max(a, Math.min(b, value))
  if (r.dir.includes('e')) w = clamp(r.w + dx, minW, viewport.width - margin - r.left)
  if (r.dir.includes('s')) h = clamp(r.h + dy, minH, viewport.height - margin - r.top)
  if (r.dir.includes('w')) { w = clamp(r.w - dx, minW, r.left + r.w - margin); left = r.left + r.w - w }
  if (r.dir.includes('n')) { h = clamp(r.h - dy, minH, r.top + r.h - topMargin); top = r.top + r.h - h }
  dimensions.w = w; dimensions.h = h
  position.left = left; position.top = top
}
function endResize(event) {
  if (!resize || (event && resize.id !== event.pointerId)) return
  try { frame.value?.releasePointerCapture(resize.id) } catch { /* captura liberada */ }
  resize = null
  savePosition()
}
function onBlur() { endDrag(); endResize() }
watch(() => location.value?.kind === 'float' ? [location.value.x, location.value.y, location.value.w, location.value.h] : null, (rect, oldRect) => {
  if (!rect || (oldRect && rect.every((v, i) => v === oldRect[i]))) return
  if (drag || resize) return
  position.left = rect[0]; position.top = rect[1]; dimensions.w = rect[2]; dimensions.h = rect[3]
  // Guardar un flotante no debe deshacer su desplazamiento horizontal.
  clampGrabPosition()
})

onMounted(() => {
  if (props.dockPanelId) {
    window.addEventListener('century:dock-detach', onNativeDockEvent)
    window.addEventListener('century:dock-attach', onNativeDockEvent)
  }
  if (props.dockPanelId === 'codeView') {
    window.addEventListener('century:code-detach', openNative)
    window.addEventListener('century:code-attach', attachNative)
    if (location.value?.kind === 'float') store.prefs.dockLayout = restoreDockPanel(store.prefs.dockLayout, 'codeView')
  }
  if (props.dockPanelId !== 'codeView' && props.nativeOnDemand && location.value?.kind === 'float') openNative()
  if (nativeTarget.value) return
  if (!loadPosition()) {
    position.left = Math.round((viewport.width - Math.min(dimensions.w, size.value.width)) / 2)
    position.top = Math.round((viewport.height + topMargin - margin - Math.min(dimensions.h, size.value.height)) / 2)
  }
  clampGrabPosition()
  window.addEventListener('resize', onResize)
  window.addEventListener('blur', onBlur)
})
onBeforeUnmount(() => {
  if (props.dockPanelId) {
    window.removeEventListener('century:dock-detach', onNativeDockEvent)
    window.removeEventListener('century:dock-attach', onNativeDockEvent)
  }
  if (props.dockPanelId === 'codeView') {
    store.ui.codeNativeOpen = false
    window.removeEventListener('century:code-detach', openNative)
    window.removeEventListener('century:code-attach', attachNative)
  }
  endDrag(); endResize()
  window.removeEventListener('resize', onResize)
  window.removeEventListener('blur', onBlur)
})
</script>

<template>
  <Teleport :to="teleportTo" :disabled="!isDocked && !nativeTarget" defer>
  <div v-show="visible" class="floating-editor-layer" :class="{ docked: isDocked && !focusMode, 'native-tool-layer': nativeTarget, 'focus-mode': focusMode }">
    <section ref="frame" class="floating-editor-window" :class="{ maximized, dragging, 'has-titlebar': integratedTitlebar, 'code-docked': dockPanelId === 'codeView' && isDocked && !focusMode }" :style="geometry"
      :role="isDocked || nativeTarget ? 'region' : 'dialog'" :aria-modal="!isDocked && !nativeTarget ? 'false' : undefined" :aria-label="label"
      @pointerdown="startDrag" @pointermove="moveDrag" @pointerup="endDrag"
      @pointercancel="endDrag" @lostpointercapture="endDrag" @dblclick="doubleClick">
      <header v-if="nativeTarget" class="native-tool-title">
        <span v-if="dockPanelId" class="native-code-tab" draggable="true" title="Arrastra la pestaña para acoplar; el espacio libre mueve la ventana" @pointerdown="nativeTitleDown" @dragstart="startNativeDockTransfer">
          <Icon :name="titleIcon" :size="15" /><span>{{ label }}</span><small v-if="subtitle">{{ subtitle }}</small>
        </span>
        <template v-else><Icon :name="titleIcon" :size="15" /><span>{{ label }}</span><small v-if="subtitle">{{ subtitle }}</small></template>
        <span class="grow"/>
      </header>
      <div v-else class="floating-editor-chrome" :class="{ integrated: integratedTitlebar }" :data-window-drag-handle="integratedTitlebar ? '' : null">
        <template v-if="integratedTitlebar">
          <Icon :name="titleIcon" :size="15" />
          <span class="floating-editor-caption">{{ label }}</span>
          <span v-if="subtitle" class="floating-editor-subtitle">{{ subtitle }}</span>
        </template>
        <div class="floating-editor-actions" data-no-window-drag>
        <button v-if="!isDocked || dockPanelId === 'codeView'" type="button" class="floating-editor-action" :data-tooltip="maximized ? 'Restaurar Code' : 'Maximizar Code'"
          :aria-label="maximized ? 'Restaurar Code' : 'Maximizar Code'" @click="toggleMaximize">
          <Icon name="frame" :size="14" />
        </button>
        <button v-if="closable" type="button" class="floating-editor-action close" data-tooltip="Close window" aria-label="Close window" @click="emit('close')">
          <Icon name="x" :size="14" />
        </button>
        </div>
      </div>
      <slot />
      <ToolAlerts v-if="nativeTarget" />
      <template v-if="!isDocked && !maximized && !nativeTarget"><i v-for="d in handles" :key="d" class="lf-floating-rz" :class="d" @pointerdown.stop="startResize($event, d)" @pointermove.stop="moveResize" @pointerup.stop="endResize" @pointercancel.stop="endResize" @lostpointercapture.stop="endResize" /></template>
    </section>
  </div>
  </Teleport>
</template>

<style scoped>
.floating-editor-layer {
  position: fixed;
  inset: 0;
  z-index: 100;
  pointer-events: none; /* ventana, no modal: el editor de detrás sigue usable */
}
.floating-editor-window {
  position: absolute;
  pointer-events: auto;
  min-width: 0;
  min-height: 0;
  isolation: isolate;
  border-radius: 8px;
  box-shadow: 0 30px 70px rgba(0, 0, 0, .6);
}
.floating-editor-window :deep([data-window-drag-handle]) {
  cursor: grab;
  user-select: none;
  padding-right: 86px;
}
.floating-editor-window :deep([data-window-drag-handle] input),
.floating-editor-window :deep([data-window-drag-handle] textarea) { cursor: text; user-select: text; }
.floating-editor-window :deep([data-window-drag-handle] button),
.floating-editor-window :deep([data-window-drag-handle] select) { cursor: pointer; user-select: auto; }
.floating-editor-window.dragging :deep([data-window-drag-handle]) { cursor: grabbing; }
.floating-editor-chrome { position:absolute; z-index:6; right:8px; top:7px; }
.floating-editor-actions { display:flex; gap:3px; align-items:center; }
.floating-editor-window.has-titlebar {
  display:flex; flex-direction:column; overflow:hidden;
  background:var(--g-850); border:1px solid var(--g-600);
}
/* Sin bordes ni sombra exterior al maximizar: el contenido rellena el área útil. */
.floating-editor-window.maximized.has-titlebar { border:0; border-radius:0; box-shadow:none; }
.floating-editor-chrome.integrated {
  position:relative; top:auto; right:auto; z-index:6;
  flex:0 0 36px; display:flex; align-items:center; gap:9px; min-width:0;
  padding:0 3px 0 7px; background:var(--g-800); color:var(--text-2);
  border-bottom:1px solid var(--hair); user-select:none; touch-action:none;
}
.floating-editor-chrome.integrated > svg { flex:none; }
.code-docked .floating-editor-chrome.integrated { position:absolute; right:2px; top:3px; height:29px; min-height:0; padding:0; background:transparent; border:0; }
.code-docked :deep(.se-commands) { padding-right:36px; }
.code-docked .floating-editor-chrome.integrated > svg,
.code-docked .floating-editor-caption,
.code-docked .floating-editor-subtitle { display:none; }
.floating-editor-caption { color:var(--text); font-size:11px; font-weight:650; letter-spacing:.5px; white-space:nowrap; }
.floating-editor-subtitle { font-size:11px; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text-3); }
.floating-editor-chrome.integrated .floating-editor-actions { position:relative; margin-left:auto; flex:none; }
.floating-editor-window.has-titlebar :deep(.edwin) { flex:1; height:auto; min-height:0; border:0; border-radius:0; }
.floating-editor-action {
  width: 27px;
  height: 26px;
  padding: 0;
  border-color: transparent;
  background: transparent;
  color: var(--text-2);
}
.floating-editor-action:hover { background: var(--g-700); color: var(--text); }
.floating-editor-action.close:hover { background: var(--danger); color: #fff; }
.lf-floating-rz { position:absolute; z-index:8; touch-action:none; }
.lf-floating-rz.n,.lf-floating-rz.s { left:10px; right:10px; height:6px; cursor:ns-resize; }
.lf-floating-rz.e,.lf-floating-rz.w { top:10px; bottom:10px; width:6px; cursor:ew-resize; }
.lf-floating-rz.n { top:-2px; }.lf-floating-rz.s { bottom:-2px; }
.lf-floating-rz.e { right:-2px; }.lf-floating-rz.w { left:-2px; }
.lf-floating-rz.ne,.lf-floating-rz.nw,.lf-floating-rz.se,.lf-floating-rz.sw { width:14px; height:14px; }
.lf-floating-rz.ne { top:-3px; right:-3px; cursor:nesw-resize; }.lf-floating-rz.sw { bottom:-3px; left:-3px; cursor:nesw-resize; }
.lf-floating-rz.nw { top:-3px; left:-3px; cursor:nwse-resize; }.lf-floating-rz.se { bottom:-3px; right:-3px; cursor:nwse-resize; }
.floating-editor-layer.docked { position:relative; inset:auto; z-index:auto; width:100%; height:100%; min-height:0; }
.floating-editor-layer.focus-mode { position:fixed; inset:36px 0 24px; z-index:200; pointer-events:auto; background:var(--g-850); }
.focus-mode .floating-editor-window { position:relative; inset:0; width:100%; height:100%; }
.native-tool-title .grow { flex:1; }
.docked .floating-editor-window { position:relative; width:100%; height:100%; border-radius:0; box-shadow:none; }
.docked .floating-editor-window :deep([data-window-drag-handle]) { cursor:default; padding-right:42px; }
.docked .floating-editor-chrome.integrated { cursor:default; padding-right:7px; }
.floating-editor-window.has-titlebar .floating-editor-chrome.integrated { padding-right:3px; }
.floating-editor-window.dragging .floating-editor-chrome.integrated { cursor:grabbing; }
.floating-editor-action:focus-visible { outline:2px solid var(--blue-hi); outline-offset:-2px; }
.native-tool-layer .floating-editor-window {
  position: fixed; inset: 0;
  display: flex; flex-direction: column; border: 0; border-radius: 0; box-shadow: none; background: var(--g-850);
}
.native-tool-layer .floating-editor-window :deep(.edwin) { flex: 1; height: auto; min-height: 0; border: 0; border-radius: 0; box-shadow: none; }
.native-tool-layer .floating-editor-window :deep([data-window-drag-handle]) { cursor: default; padding-right: 14px; }
.native-tool-title {
  height: var(--bar-h); flex: none; display: flex; align-items: center; gap: 8px;
  padding-left: max(7px, env(titlebar-area-x, 0px));
  padding-right: max(3px, calc(100% - env(titlebar-area-width, 100%) - env(titlebar-area-x, 0px) + 3px));
  background: var(--editor-chrome); border-bottom: 1px solid var(--hair-soft); -webkit-app-region: drag;
}
.native-tool-title small { color: var(--text-3); white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
.native-code-tab { display:inline-flex; align-items:center; gap:8px; min-width:0; max-width:65%; cursor:grab; user-select:none; -webkit-app-region:no-drag; }
.native-code-tab:active { cursor:grabbing; }
.native-code-tab small { min-width:0; overflow:hidden; }
</style>
