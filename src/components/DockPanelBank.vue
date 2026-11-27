<script setup>
// Monta una sola instancia de cada panel y la transporta al grupo activo; así moverlo no reinicia sus datos ni su foco.
import { computed, nextTick, onMounted, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { store } from '../core/store.js'
import SceneTree from './SceneTree.vue'
import BottomDock from './BottomDock.vue'
import InspectorDock from './InspectorDock.vue'
import { getNativeToolDocument } from '../core/editor/native-tool-registry.js'
import { DOCK_PANELS, SPECIAL_DOCK_PANELS, dockGroups, findDockPanel, dockPanelAvailable, activeDockTab } from '../core/editor/docking.js'

const builtin = Object.keys(DOCK_PANELS).filter((id) => !SPECIAL_DOCK_PANELS.includes(id) && !['sceneView','gameView'].includes(id))
const targets = shallowRef({})
let disposed = false
const visited = ref([])
const hidden = (id) => `#lf-dock-bank-${id}`
const maxed = () => !!(store.play.on && store.prefs.gameMaximize && store.ui.viewTab === 'game' && store.ui.mode === 'desktop')
const zoneMounted = (zone) => store.ui.mode === 'desktop' && !maxed() && store.prefs[zone + 'Open'] !== false
function calculate() {
  if (disposed) return
  const layout = store.prefs.dockLayout
  const next = {}
  for (const id of builtin) {
    const at = findDockPanel(layout, id)
    const wanted = at?.kind === 'float' ? `lf-dock-float-${id}`
      : at?.kind === 'dock' && zoneMounted(at.zone) ? `lf-dock-target-${at.groupId}-${id}` : null
    // El nodo destino puede haberse sustituido durante una división: nunca transportar a un host retirado del DOM.
    const host = wanted && (getNativeToolDocument(id)?.getElementById(wanted) || document.getElementById(wanted))
    next[id] = host?.isConnected ? host : document.getElementById(`lf-dock-bank-${id}`)
  }
  targets.value = next
}
function visible(id) {
  const at = findDockPanel(store.prefs.dockLayout, id)
  if (at?.kind === 'float') return true
  if (at?.kind !== 'dock' || !zoneMounted(at.zone)) return false
  const g = dockGroups(store.prefs.dockLayout.zones[at.zone]).find((entry) => entry.id === at.groupId)
  return !!g && activeDockTab(g, store) === id && dockPanelAvailable(id, store)
}
// La lista de paneles montados sigue la actividad del grupo, también después de separar, volver a unir o restaurar.
// El alojamiento se recalcula aparte, cuando los nuevos destinos ya existen en el DOM.
const activeIds = computed(() => builtin.filter(visible))
watch(activeIds, (ids) => {
  const missing = ids.filter((id) => !visited.value.includes(id))
  if (missing.length) visited.value = [...visited.value, ...missing]
}, { immediate: true, flush: 'sync' })
watch(() => [store.prefs.dockLayout, store.ui.mode, store.edit.on, store.paint.on,
  store.play.on, store.prefs.gameMaximize,
  store.prefs.leftOpen, store.prefs.rightOpen, store.prefs.topOpen, store.prefs.bottomOpen], async () => {
  await nextTick()
  calculate()
}, { flush: 'post' })
function onNativeDockChanged() { void nextTick().then(calculate) }
onMounted(async () => { window.addEventListener('century:native-dock-changed', onNativeDockChanged); await nextTick(); calculate() })
onBeforeUnmount(() => { disposed = true; window.removeEventListener('century:native-dock-changed', onNativeDockChanged) })
</script>

<template>
  <div class="lf-dock-bank" aria-hidden="true"><div v-for="id in builtin" :id="`lf-dock-bank-${id}`" :key="id"/><div v-for="id in SPECIAL_DOCK_PANELS" :id="`lf-dock-special-${id}`" :key="id"/></div>
  <Teleport v-for="id in visited" :key="id" :to="targets[id] || hidden(id)" defer>
    <div v-show="visible(id)" class="lf-dock-panel-content">
      <SceneTree v-if="id === 'hierarchy'" />
      <InspectorDock v-else-if="['object','signals','mesh','paint'].includes(id)" :pane="id" />
      <BottomDock v-else :pane="id" :closable="false" />
    </div>
  </Teleport>
</template>

<style scoped>
.lf-dock-bank { display:none; }
.lf-dock-panel-content { width:100%; height:100%; min-width:0; min-height:0; overflow:hidden; display:flex; flex-direction:column; }
.lf-dock-panel-content :deep(> *) { width:100%; flex:1; min-height:0; }
</style>
