<script setup>
// Grupos acoplables del Editor; no monta copias de los paneles.
import { acquirePointer } from '../engine/runtime/input/pointer-capture.js'
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { store } from '../core/store.js'
import Icon from './Icon.vue'
import { activateViewportDock, activateCodeDock } from '../core/editor/view-dock-session.js'
import { notifyNativeDock } from '../core/editor/native-dock.js'
import { startDockGesture, consumeDockClickSuppression } from '../core/editor/dock-gesture.js'
import { DOCK_PANELS, SPECIAL_DOCK_PANELS, REQUIRED_DOCK_VIEWS, dockNodeHasAvailablePanel, dockPanelAvailable, activeDockTab, moveDockPanel, floatDockPanel, hideDockPanel, resizeDockSplit, dockDropEdge } from '../core/editor/docking.js'

defineOptions({ name: 'DockTree' })
const props = defineProps({ node: { type: Object, required: true }, zone: { type: String, required: true } })
const hover = ref('')
const hoverTabs = ref(false)
const hoverBefore = ref(null)
function clearHover() { hover.value = ''; hoverTabs.value = false; hoverBefore.value = null }
function onDockDragKey(event) { if (event.key === 'Escape') clearHover() }
function onPointerDockPreview(event) {
  const target = event.detail
  if (target?.groupId !== props.node.id || target.zone !== props.zone) { clearHover(); return }
  hover.value = target.edge
  hoverTabs.value = target.onTabs
  hoverBefore.value = target.beforeTab
}
onMounted(() => {
  window.addEventListener('century:dock-preview', onPointerDockPreview)
  window.addEventListener('dragend', clearHover, true)
  window.addEventListener('drop', clearHover, true)
  window.addEventListener('blur', clearHover)
  window.addEventListener('keydown', onDockDragKey, true)
})
onBeforeUnmount(() => {
  window.removeEventListener('century:dock-preview', onPointerDockPreview)
  window.removeEventListener('dragend', clearHover, true)
  window.removeEventListener('drop', clearHover, true)
  window.removeEventListener('blur', clearHover)
  window.removeEventListener('keydown', onDockDragKey, true)
})
function hasDockDrag(event) {
  return Array.from(event.dataTransfer?.types || []).includes('application/x-lf-dock-panel')
}
function leave(event) {
  if (event.relatedTarget && event.currentTarget.contains(event.relatedTarget)) return
  const r = event.currentTarget.getBoundingClientRect()
  if (event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom) return
  clearHover()
}
const shown = computed(() => props.node.type === 'group' ? props.node.tabs.filter((id) => dockPanelAvailable(id, store)) : [])
const active = computed(() => props.node.type === 'group' ? activeDockTab(props.node, store) : null)
const firstAvailable = computed(() => props.node.type === 'split' && dockNodeHasAvailablePanel(props.node.first, store))
const secondAvailable = computed(() => props.node.type === 'split' && dockNodeHasAvailablePanel(props.node.second, store))
const title = (id) => DOCK_PANELS[id]?.[0] || id
const icon = (id) => DOCK_PANELS[id]?.[1] || 'frame'
function focus(id) {
  if (consumeDockClickSuppression()) return
  if (id === 'sceneView' || id === 'gameView') { activateViewportDock(store, id); return }
  if (id === 'codeView') { activateCodeDock(store); return }
  const node = props.node
  store.prefs.dockLayout = moveDockPanel(store.prefs.dockLayout, id, props.zone, node.id, 'center')
  if (['object', 'signals', 'mesh', 'paint'].includes(id)) store.prefs.rightTab = id
  if (['project', 'console', 'mixer', 'timeline', 'anim', 'vcs'].includes(id)) store.prefs.bottomTab = id
}

function dataId(event) {
  return event.dataTransfer?.getData('application/x-lf-dock-panel') || ''
}
function dragStart(event, id) {
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('application/x-lf-dock-panel', id)
  event.dataTransfer.setData('text/plain', id)
}
function detectEdge(event) {
  return dockDropEdge(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY)
}
function over(event) {
  if (!hasDockDrag(event)) { clearHover(); return }
  event.preventDefault()
  event.stopPropagation()
  event.dataTransfer.dropEffect = 'move'
  hoverTabs.value = !!event.target.closest?.('.lf-dock-tabs')
  hover.value = hoverTabs.value ? 'center' : detectEdge(event)
}
function commitDrop(event, edge) {
  const id = dataId(event)
  clearHover()
  if (!DOCK_PANELS[id]) return
  event.preventDefault()
  event.stopPropagation()
  const beforeTab = edge === 'center' ? event.target?.closest?.('[data-lf-dock-tab]')?.dataset?.lfDockTab ?? null : null
  const next = moveDockPanel(store.prefs.dockLayout, id, props.zone, props.node.id, edge, beforeTab)
  if (next === store.prefs.dockLayout) return
  store.prefs.dockLayout = next
  if (SPECIAL_DOCK_PANELS.includes(id)) notifyNativeDock(id, 'attach')
  else if (props.zone === 'center' && (id === 'gameView' || id === 'sceneView')) activateViewportDock(store, id)
  else if (props.zone === 'center' && id === 'codeView') activateCodeDock(store)
  if (props.zone !== 'center') store.prefs[props.zone + 'Open'] = true
}
function drop(event) { commitDrop(event, event.target.closest?.('.lf-dock-tabs') ? 'center' : detectEdge(event)) }
function float(id) {
  if (id === 'codeView') return
  const r = document.querySelector(`[data-lf-dock-group="${props.node.id}"]`)?.getBoundingClientRect()
  store.prefs.dockLayout = floatDockPanel(store.prefs.dockLayout, id, { x: Math.max(8, r?.left || 130), y: Math.max(44, r?.top || 100), w: 570, h: 410 })
}
function hide(id) { if (!REQUIRED_DOCK_VIEWS.includes(id)) store.prefs.dockLayout = hideDockPanel(store.prefs.dockLayout, id) }
let resize = null
function startResize(event) {
  if (event.button !== 0) return
  const element = event.currentTarget.parentElement
  const bounds = element.getBoundingClientRect()
  if (!acquirePointer(event.currentTarget, event, "Docking")) return
  resize = { id: event.pointerId, x: event.clientX, y: event.clientY, width: bounds.width, height: bounds.height, ratio: props.node.ratio }
  event.preventDefault()
}
function moveResize(event) {
  if (!resize || resize.id !== event.pointerId) return
  const d = props.node.dir === 'row' ? (event.clientX - resize.x) / Math.max(1, resize.width) : (event.clientY - resize.y) / Math.max(1, resize.height)
  store.prefs.dockLayout = resizeDockSplit(store.prefs.dockLayout, props.node.id, resize.ratio + d)
}
function endResize(event) {
  if (!resize || resize.id !== event.pointerId) return
  resize = null
  try { event.currentTarget.releasePointerCapture(event.pointerId) } catch { /* captura liberada */ }
}
function keyResize(event) {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
  const step = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -.04 : .04
  store.prefs.dockLayout = resizeDockSplit(store.prefs.dockLayout, props.node.id, props.node.ratio + step)
  event.preventDefault()
}
</script>

<template>
  <section v-if="node.type === 'group' && active" class="lf-dock-group" :data-lf-dock-zone="zone" :data-lf-dock-group="node.id"
    :class="{ 'dock-hover': !!hover }" @dragover.capture="over" @dragleave="leave" @drop.capture="drop">
    <nav class="lf-dock-tabs" :class="{ 'dock-tabs-over': hoverTabs }" role="tablist" :aria-label="'Paneles ' + zone" @dragleave="leave">
      <button v-for="id in shown" :key="id" :data-lf-dock-tab="id" class="lf-dock-tab" type="button" role="tab" :draggable="false"
        :class="{ active: active === id, 'dock-insert-before': hoverBefore === id }" :aria-selected="active === id" :aria-controls="`lf-dock-target-${node.id}-${id}`"
        :title="'Arrastra para acoplar · ' + title(id)" @click="focus(id)" @pointerdown="startDockGesture($event, id, store)">
        <Icon :name="icon(id)" :size="13"/><span>{{ title(id) }}</span><small v-if="id === 'console' && store.log.length">{{ store.log.length }}</small>
      </button>
      <span class="lf-dock-spacer"/>
      <template v-if="active">
        <button v-if="!REQUIRED_DOCK_VIEWS.includes(active)" class="lf-dock-action" type="button" :aria-label="'Ocultar ' + title(active)" title="Ocultar panel" @click="hide(active)"><Icon name="x" :size="13"/></button>
      </template>
    </nav>
    <div class="lf-dock-body" :class="{ 'drop-active': !!hover }">
      <div v-for="id in node.tabs" :id="`lf-dock-target-${node.id}-${id}`" :key="id" class="lf-dock-target" v-show="active === id" role="tabpanel" :aria-label="title(id)">
        <div v-if="id === 'codeView' && store.ui.codeNativeOpen" class="code-native-hint">Code está abierto en otra ventana.</div>
      </div>
      <div v-if="hover" class="lf-dock-drop" :class="'on-' + hover"><span>{{ hover === 'center' ? 'Unir como pestaña en este espacio' : 'Dividir ' + ({ left: 'a la izquierda', right: 'a la derecha', top: 'arriba', bottom: 'abajo' }[hover]) }}</span></div>
    </div>
  </section>
  <div v-else-if="node.type === 'split' && firstAvailable && secondAvailable" class="lf-dock-split" :class="'dir-' + node.dir" :data-lf-dock-zone="zone">
    <div class="lf-split-child" :style="{ flexBasis: (node.ratio * 100) + '%' }"><DockTree :node="node.first" :zone="zone" /></div>
    <div class="lf-dock-divider" role="separator" tabindex="0" :aria-orientation="node.dir === 'row' ? 'vertical' : 'horizontal'"
      @pointerdown="startResize" @pointermove="moveResize" @pointerup="endResize" @pointercancel="endResize" @lostpointercapture="endResize" @keydown="keyResize" />
    <div class="lf-split-child" :style="{ flexBasis: ((1 - node.ratio) * 100) + '%' }"><DockTree :node="node.second" :zone="zone" /></div>
  </div>
  <DockTree v-else-if="node.type === 'split' && firstAvailable" :node="node.first" :zone="zone" />
  <DockTree v-else-if="node.type === 'split' && secondAvailable" :node="node.second" :zone="zone" />
</template>

<style scoped>
.lf-dock-group,.lf-dock-split { display:flex; flex-direction:column; width:100%; height:100%; min-width:0; min-height:0; background:var(--g-850); position:relative; }
.lf-dock-tabs { display:flex; height:29px; min-height:29px; align-items:center; gap:2px; padding:0 5px; background:var(--editor-chrome); border-bottom:1px solid var(--hair-soft); overflow-x:auto; }
.lf-dock-tabs::-webkit-scrollbar { height:3px; }
.lf-dock-tabs::-webkit-scrollbar-thumb { background:var(--g-600); border:0; }
.lf-dock-tabs.dock-tabs-over { box-shadow:inset 0 -2px 0 #88969e; }
.lf-dock-tab { flex:none; display:inline-flex; align-items:center; gap:5px; max-width:160px; height:25px; border:1px solid transparent; border-bottom:0; border-radius:4px 4px 0 0; padding:0 9px; color:var(--text-3); background:transparent; cursor:grab; white-space:nowrap; }
.lf-dock-tab span { overflow:hidden; text-overflow:ellipsis; }
.lf-dock-tab.dock-insert-before { box-shadow:inset 2px 0 0 var(--blue); }
.lf-dock-tab:hover { color:var(--text); background:var(--g-800); }
.lf-dock-tab.active { color:var(--text); background:var(--g-800); border-color:var(--hair-soft); font-weight:600; }
.lf-dock-tab:focus-visible,.lf-dock-action:focus-visible { outline:2px solid var(--blue); outline-offset:-2px; }
.lf-dock-tab small { color:var(--text-2); }
.lf-dock-spacer { flex:1; }
.lf-dock-action { flex:none; display:grid; place-items:center; width:23px; height:23px; padding:0; border:0; background:transparent; color:var(--text-3); }
.lf-dock-action:hover { color:var(--text); background:var(--g-700); }
.lf-dock-body { flex:1; position:relative; min-height:0; min-width:0; overflow:hidden; }
.lf-dock-target { height:100%; width:100%; min-height:0; min-width:0; }
.code-native-hint { display:grid; height:100%; place-items:center; font-size:12px; color:var(--text-3); }
.lf-dock-drop { position:absolute; pointer-events:none; display:grid; place-items:center; z-index:15; border:2px solid #88969e; border-radius:3px; background:rgba(113,127,138,.18); color:var(--text); font-size:11px; }
.lf-dock-drop.on-center { inset:6px; }.lf-dock-drop.on-left { inset:6px 50% 6px 6px; }.lf-dock-drop.on-right { inset:6px 6px 6px 50%; }.lf-dock-drop.on-top { inset:6px 6px 50% 6px; }.lf-dock-drop.on-bottom { inset:50% 6px 6px 6px; }
.lf-dock-split.dir-row { flex-direction:row; }.lf-dock-split.dir-column { flex-direction:column; }
.lf-split-child { flex:1 1 auto; min-width:0; min-height:0; overflow:hidden; }
.lf-dock-divider { flex:0 0 5px; background:var(--g-950); border:1px solid var(--hair); touch-action:none; }
.dir-row>.lf-dock-divider { cursor:col-resize; }.dir-column>.lf-dock-divider { cursor:row-resize; }
.lf-dock-divider:hover,.lf-dock-divider:focus-visible { background:var(--g-600); outline:0; }
@media (prefers-reduced-motion: reduce) { .lf-dock-drop { transition:none; } }
</style>
