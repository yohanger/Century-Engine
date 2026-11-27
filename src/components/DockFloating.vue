<script setup>
// Utiliza AppWindow y sus ocho asas de redimensionamiento; la ubicación pertenece al layout del Editor.
import AppWindow from './AppWindow.vue'
import Icon from './Icon.vue'
import { store } from '../core/store.js'
import { activateViewportDock } from '../core/editor/view-dock-session.js'
import { DOCK_PANELS, restoreDockPanel, hideDockPanel, updateDockFloat, REQUIRED_DOCK_VIEWS } from '../core/editor/docking.js'
const props = defineProps({ item: { type: Object, required: true } })
const electron = !!window.lf?.isElectron
function focusFloat() {
  if (['sceneView', 'gameView'].includes(props.item.id)) activateViewportDock(store, props.item.id)
}
function dragStart(event) { event.dataTransfer.setData('application/x-lf-dock-panel', props.item.id); event.dataTransfer.effectAllowed = 'move' }
function dock() { store.prefs.dockLayout = restoreDockPanel(store.prefs.dockLayout, props.item.id) }
function close() { store.prefs.dockLayout = REQUIRED_DOCK_VIEWS.includes(props.item.id) ? restoreDockPanel(store.prefs.dockLayout, props.item.id) : hideDockPanel(store.prefs.dockLayout, props.item.id) }
function geometry(rect) { store.prefs.dockLayout = updateDockFloat(store.prefs.dockLayout, props.item.id, rect) }
</script>
<template>
  <AppWindow :title="DOCK_PANELS[item.id]?.[0] || item.id" :native-tool="electron" :native-panel-id="item.id" :closable="!REQUIRED_DOCK_VIEWS.includes(item.id)" :width="item.w" :height="item.h" :min-width="260" :min-height="180" :scroll="false"
    :layout-rect="item" @geometry-change="geometry" @close="close">
    <div :id="`lf-dock-float-${item.id}`" class="dock-float-host" @pointerdown.capture="focusFloat" />
  </AppWindow>
</template>
<style scoped>
.dock-return { width:27px; height:25px; padding:0; border:0; background:transparent; color:var(--text-2); }
.dock-return:hover { color:var(--text); background:var(--g-700); }
.dock-float-host { position:relative; flex:1; min-height:0; min-width:0; height:100%; width:100%; }
</style>
