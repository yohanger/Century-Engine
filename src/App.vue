<script setup>
import { setTooltips, showClippedText } from './core/tooltips.js'
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, provide, defineAsyncComponent, nextTick, shallowRef } from 'vue'
import { editorScreenMode, fitEditorDocks } from './core/editor/window-layout.js'
import * as db from './core/db.js'
import * as S from './core/store.js'
import { store, setEditor, openProject, newProject, saveNow, flushDisk, configureEditorWorkspace, importFiles, placeModel, openLfprojDialog } from './core/store.js'
import { handleNativeCinematicRequest } from './core/state/film.js'
import {createTimelinePlayback, timelinePlaybackKey} from './core/timeline/playback-session.js'
import WelcomeScreen from './components/WelcomeScreen.vue'
import LoadingScreen from './components/LoadingScreen.vue'
import { projectLoading } from './core/editor/project-loading.js'
import { allEntries, extOf } from './core/project.js'
import { resolveAssetDrop } from './core/editor/asset-drop.js'
import MenuBar from './components/MenuBar.vue'
import Toolbar from './components/Toolbar.vue'
import Splitter from './components/Splitter.vue'
import SceneTabs from './components/SceneTabs.vue'
import ViewBar from './components/ViewBar.vue'
import SceneTree from './components/SceneTree.vue'
import SceneInstancePicker from './components/SceneInstancePicker.vue'
import ViewportOverlay from './components/ViewportOverlay.vue'
import PreferencesModal from './components/PreferencesModal.vue'
import StatusBar from './components/StatusBar.vue'
import InspectorDock from './components/InspectorDock.vue'
import BottomDock from './components/BottomDock.vue'
import DockTree from './components/DockTree.vue'
import DockFloating from './components/DockFloating.vue'
import DockPanelBank from './components/DockPanelBank.vue'
import SceneRuntimeObserver from './components/SceneRuntimeObserver.vue'
import { SPECIAL_DOCK_PANELS, DOCK_PANELS, dockGroups, dockNodeHasAvailablePanel, dockPanelIsActive, findDockPanel, focusDockPanel, moveDockPanel, hideDockPanel } from './core/editor/docking.js'
import { activateViewportDock, activateCodeDock, resolveViewportDockTarget, recoverViewportDrawing } from './core/editor/view-dock-session.js'
import { notifyNativeDock } from './core/editor/native-dock.js'
import ContextMenu from './components/ContextMenu.vue'
import CommandPalette from './components/CommandPalette.vue'
import AddModal from './components/AddModal.vue'
import AskWindows from './components/AskWindows.vue'
import ProjectsModal from './components/ProjectsModal.vue'
import ExportModal from './components/ExportModal.vue'
import ShortcutsModal from './components/ShortcutsModal.vue'
import RenameModal from './components/RenameModal.vue'
import ShaderEditor from './components/ShaderEditor.vue'
import CaptureImportWindow from './components/CaptureImportWindow.vue'
import UiSlotsModal from './components/UiSlotsModal.vue'
import ThemeEditor from './components/ThemeEditor.vue'
import LocalizationWindow from './components/LocalizationWindow.vue'
import DocsWindow from './components/DocsWindow.vue'
import UiGalleryModal from './components/UiGalleryModal.vue'
import MapPicker from './components/MapPicker.vue'
import UiRoot from './engine/runtime/ui/UiRoot.vue'
import DialogPreview from './components/DialogPreview.vue'
import GameSettingsModal from './components/GameSettingsModal.vue'
import ExportGameModal from './components/ExportGameModal.vue'
import MigrationReportWindow from './components/MigrationReportWindow.vue'
import DatabaseModal from './components/DatabaseModal.vue'
import TagsLayersModal from './components/TagsLayersModal.vue'
import PlayHud from './components/PlayHud.vue'
import PerfPanel from './components/PerfPanel.vue'
import Icon from './components/Icon.vue'
const EventEditor = defineAsyncComponent(() => import('./components/EventEditor.vue'))
const ScriptEditor = defineAsyncComponent(() => import('./components/ScriptEditor.vue'))
const ShaderGraphEditor = defineAsyncComponent(() => import('./components/ShaderGraphEditor.vue'))
const UiEditor = defineAsyncComponent(() => import('./components/UiEditor.vue'))
const EngineSettingsModal = defineAsyncComponent(() => import('./components/EngineSettingsModal.vue'))

// Sesión única por Editor, independiente del montaje de pestañas o docking.
const timelinePlayback = createTimelinePlayback({
  getProject:()=>store.project, getEditor:()=>store.editor,
  getObjects:()=>store.project?.objects||[], worldMatrix:S.worldMatrix,
  onWarning:message=>S.toast('Timeline Preview: '+message,'warn'),
  getContext:()=>({project:store.project,sceneId:store.project?.activeSceneId,
    timelineId:store.timelineId,editor:store.editor,
    playOn:store.play.on,
    locked:store.locked,cinematic:store.projSel?.kind==='cinematic'}),
})
provide(timelinePlaybackKey,timelinePlayback)
// La selección y las herramientas nunca desplazan la reproducción temporal.
watch(()=>[store.project,store.project?.activeSceneId,store.timelineId,store.editor,
  store.play.on,store.locked,store.projSel?.kind],()=>timelinePlayback.validate(),{flush:'sync'})

const host = ref(null)
const topEl = ref(null)
const workspaceMounted = ref(false)
let editor = null
let closeClippedText = null
let stopCinematicRequests = null
store.locked = true

async function mountEditor() {
  if (editor) return
  const { Editor } = await import('./core/editor.js')
  workspaceMounted.value = true
  await nextTick()
  editor = new Editor(host.value)
  setEditor(editor)
}
function unmountEditor() {
  editor?.dispose()
  editor = null
  setEditor(null)
  workspaceMounted.value = false
}
configureEditorWorkspace({ mount: mountEditor, unmount: unmountEditor })

watch(() => store.locked ? null : store.project?.id, id => window.lf?.setCinematicProject?.(id || null), { immediate: true })
watch(() => store.locked, () => window.lf?.setWindowChrome?.('editor'), { immediate: true })

const mode = computed(() => store.ui.mode)
watch(() => !!projectLoading.value, (active) => {
  if (!active && store.locked && workspaceMounted.value) {
    store.project = null
    unmountEditor()
  }
})
const graphDocument = computed(() => store.project?.shaders.find((s) => s.id === store.shaderEditId && s.graph))
const gameView = computed(() => store.play.on || store.gameView.on)
const graphDockVisible = computed(() => !!graphDocument.value && store.prefs.shaderGraphDocked && findDockPanel(store.prefs.dockLayout, 'shaderGraph')?.kind !== 'dock' && store.ui.shaderWorkspace && !gameView.value)
// «Maximizar al jugar» (como Game de Unity): mientras se juega, los paneles se ocultan y el juego ocupa todo el espacio
const maxed = computed(() => store.play.on && store.prefs.gameMaximize && store.ui.viewTab === 'game' && store.ui.mode === 'desktop')
// Relación de aspecto de la vista Juego: «16:9» → 1.777…; «free» → null (ocupa toda la vista)
const gameRatio = computed(() => {
  if (!gameView.value) return null
  const m = /^(\d+):(\d+)$/.exec(store.prefs.gameAspect || '')
  return m ? +m[1] / +m[2] : null
})
const frameStyle = computed(() => (gameView.value ? { ...(gameRatio.value ? { '--ar': gameRatio.value } : {}), '--sc': store.prefs.gameScale || 1 } : {}))
const framed = computed(() => gameView.value && (gameRatio.value || (store.prefs.gameScale || 1) < 1))
const drawer = computed(() => store.ui.drawer)
const sceneInstanceBusy = ref(false)
function closeSceneInstancePicker() {
  if (sceneInstanceBusy.value) return
  store.modal = null
  store.sceneInstanceTarget = null
}
async function chooseSceneInstance(sceneId) {
  const request = store.sceneInstanceTarget
  if (!request || sceneInstanceBusy.value || store.modal !== 'sceneInstance' ||
      store.project?.id !== request.projectId || store.project?.activeSceneId !== request.sceneId) return
  sceneInstanceBusy.value = true
  try {
    const instance = await S.instantiateScene(sceneId, { parentId: request.parentId })
    if (instance && store.sceneInstanceTarget === request) {
      store.modal = null
      store.sceneInstanceTarget = null
    }
  } finally { sceneInstanceBusy.value = false }
}
// Cierra solicitudes obsoletas al cambiar de proyecto, escena o modo; nunca instancia en otro contexto.
watch(() => [store.project?.id, store.project?.activeSceneId, store.play.on, store.filmMode, store.locked, store.modal], () => {
  const request = store.sceneInstanceTarget
  if (!request) return
  if (store.modal !== 'sceneInstance') { store.sceneInstanceTarget = null; return }
  if (store.project?.id !== request.projectId || store.project?.activeSceneId !== request.sceneId ||
      store.play.on || store.filmMode || store.locked) {
    store.modal = null
    store.sceneInstanceTarget = null
  }
})

// Electron conserva los paneles de escritorio con cualquier escala de pantalla.
// Los tamaños dibujados se limitan al espacio real, sin reescribir las preferencias persistentes.
const viewportSize = reactive({ width: window.innerWidth, height: window.innerHeight })
const dockPriority = ref(null)
const dockSizes = computed(() => fitEditorDocks(viewportSize.width, viewportSize.height, store.prefs, dockPriority.value))
const dockLayout = computed(() => store.prefs.dockLayout)
const mainViewId = computed(() => store.play.on || (mode.value !== 'desktop' && store.gameView.on) ? 'gameView' : 'sceneView')
const viewportTarget = (id) => {
  const at = findDockPanel(store.prefs.dockLayout, id)
  if (at?.kind === 'float') return `#lf-dock-float-${id}`
  if (at?.kind === 'dock') return `#lf-dock-target-${at.groupId}-${id}`
  return '#lf-viewport-fallback'
}
const mainViewTarget = computed(() => mode.value !== 'desktop' || maxed.value || !store.project
  ? '#lf-viewport-fallback' : viewportTarget(mainViewId.value))
function focusMainViewport() {
  if (mode.value === 'desktop' && store.project) activateViewportDock(store, mainViewId.value)
}
const observerView = computed(() => mainViewId.value === 'gameView' ? 'scene' : 'game')
const observerPanel = computed(() => observerView.value === 'scene' ? 'sceneView' : 'gameView')
const observerTarget = computed(() => viewportTarget(observerPanel.value))
const observePlayingScene = computed(() => mode.value === 'desktop' && !maxed.value &&
  !!store.project && observerTarget.value !== mainViewTarget.value &&
  dockPanelIsActive(store.prefs.dockLayout, store.prefs, observerPanel.value))
// El destino físico puede reemplazarse al dividir o acoplar: resolverlo después del parche DOM.
// Mantener un fallback estable evita montar Teleport antes de que exista el grupo.
const mainTeleportTo = shallowRef('#lf-viewport-fallback')
const observerDock = shallowRef(null)
const observerDockReady = computed(() => observePlayingScene.value && observerDock.value?.view === observerView.value)
let viewportDockSequence = 0
let viewportDockFrame = 0
async function recoverViewportDocks() {
  const sequence = ++viewportDockSequence
  await nextTick()
  if (sequence !== viewportDockSequence || !workspaceMounted.value) return
  const main = resolveViewportDockTarget(document, mainViewTarget.value, '#lf-viewport-fallback')
  const secondary = observePlayingScene.value ? resolveViewportDockTarget(document, observerTarget.value) : null
  if (main) {
    if (main !== mainTeleportTo.value && !store.play.on) editor?.cancelEditorPointer('dock-move')
    mainTeleportTo.value = main
  }
  observerDock.value = secondary && secondary !== main
    ? { view: observerView.value, target: secondary } : null
  await nextTick()
  if (sequence !== viewportDockSequence) return
  editor?._continuousGrab?.syncDocument()
  editor?.edit?._continuousGrab?.syncDocument()
  editor?.vp?._syncFlyDocument?.()
  editor?.vp?._syncContinuousNavigationWindow?.()
  if (viewportDockFrame) cancelAnimationFrame(viewportDockFrame)
  viewportDockFrame = requestAnimationFrame(() => {
    viewportDockFrame = 0
    recoverViewportDrawing(editor, host.value)
  })
}
watch(() => [workspaceMounted.value, store.project, store.editor, store.prefs.dockLayout, mainViewTarget.value,
  observerTarget.value, observePlayingScene.value, observerView.value, graphDockVisible.value,
  viewportSize.width, viewportSize.height], recoverViewportDocks, { flush: 'post', immediate: true })
function onViewportReturn() { if (!document.hidden) void recoverViewportDocks() }
function onNativeDockChanged() { void recoverViewportDocks() }
watch(() => store.play.on, (on) => {
  if (store.project && mode.value === 'desktop') activateViewportDock(store, on ? 'gameView' : 'sceneView')
}, { flush: 'post' })

const dockVisible = (zone) => store.prefs[zone + 'Open'] !== false &&
  dockNodeHasAvailablePanel(dockLayout.value?.zones?.[zone], store)
const resourceDockEntries = [
  ['eventEditor', () => !!store.eventEditId && !store.locked],
  ['database', () => store.modal === 'database'],
  ['localization', () => !!store.locWin],
  ['themeEditor', () => store.modal === 'theme'],
  ['docs', () => !!store.docsWin],
  ['uiEditor', () => store.modal === 'ui' && !!store.uiEditId],
  ['shaderEditor', () => store.modal === 'shader' && !graphDocument.value],
  ['shaderGraph', () => store.ui.shaderWorkspace && !!graphDocument.value],
]
watch(() => [store.project?.id, store.locked, store.eventEditId, store.modal, store.locWin,
  store.docsWin, store.uiEditId, store.ui.shaderWorkspace, store.shaderEditId], () => {
  if (store.ui.mode !== 'desktop' || !store.project || store.locked) return
  for (const [id, opened] of resourceDockEntries) {
    const location = findDockPanel(store.prefs.dockLayout, id)
    if (opened()) {
      if (location?.kind !== 'dock' && location?.kind !== 'float') {
        const group = dockGroups(store.prefs.dockLayout.zones.bottom)[0]
        store.prefs.dockLayout = moveDockPanel(store.prefs.dockLayout, id, 'bottom', group?.id)
      }
      store.prefs.bottomOpen = true
    } else if (location?.kind === 'dock' || location?.kind === 'float') {
      store.prefs.dockLayout = hideDockPanel(store.prefs.dockLayout, id)
    }
  }
}, { immediate: true, flush: 'post' })
const floatingPanels = computed(() => (dockLayout.value?.floats || []).filter((f) => !SPECIAL_DOCK_PANELS.includes(f.id)))
const centerDockPreview = ref('')
function clearCenterDockPreview() { centerDockPreview.value = '' }
function onDockDragKey(event) { if (event.key === 'Escape') clearCenterDockPreview() }
function centerDockLeave(event) {
  const next = event.relatedTarget
  if (next && event.currentTarget.contains(next)) return
  const r = event.currentTarget.getBoundingClientRect()
  if (event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom) return
  clearCenterDockPreview()
}
function centerDockZone(e) {
  const r = e.currentTarget.getBoundingClientRect()
  const x = (e.clientX - r.left) / Math.max(1, r.width), y = (e.clientY - r.top) / Math.max(1, r.height)
  if (x < .16) return 'left'
  if (x > .84) return 'right'
  if (y < .17) return 'top'
  if (y > .83) return 'bottom'
  return 'center'
}
function centerDockOver(e) {
  if (!Array.from(e.dataTransfer?.types || []).includes('application/x-lf-dock-panel')) { clearCenterDockPreview(); return }
  e.stopPropagation()
  centerDockPreview.value = centerDockZone(e)
  if (centerDockPreview.value) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }
}
function centerDockDrop(e) {
  const id = e.dataTransfer?.getData('application/x-lf-dock-panel')
  const zone = centerDockZone(e)
  clearCenterDockPreview()
  if (!id || !DOCK_PANELS[id] || !zone) return
  e.preventDefault(); e.stopPropagation()
  const group = dockGroups(store.prefs.dockLayout.zones.center)[0]
  store.prefs.dockLayout = moveDockPanel(store.prefs.dockLayout, id, 'center', group?.id, zone)
  if (SPECIAL_DOCK_PANELS.includes(id)) notifyNativeDock(id, 'attach')
  else if (id === 'codeView') activateCodeDock(store)
}
function requestLegacyTab(id) {
  const at = findDockPanel(store.prefs.dockLayout, id)
  if (at?.kind === 'dock') {
    store.prefs.dockLayout = focusDockPanel(store.prefs.dockLayout, id)
    store.prefs[at.zone + 'Open'] = true
  }
}
watch(() => store.prefs.rightTab, (id) => { if (id && store.ui.mode === 'desktop') requestLegacyTab(id) })
watch(() => store.prefs.bottomTab, (id) => { if (id && store.ui.mode === 'desktop') requestLegacyTab(id) })
function resizeDock(side, width) {
  dockPriority.value = side
  store.prefs[side + 'W'] = width
}
function resizeVertical(zone, size) { store.prefs[zone + 'H'] = size }

function updateMode() {
  viewportSize.width = window.innerWidth
  viewportSize.height = window.innerHeight
  const m = editorScreenMode(viewportSize.width, !!window.lf?.isElectron)
  if (m !== store.ui.mode) { store.ui.mode = m; store.ui.drawer = null }
}

onMounted(async () => {
  closeClippedText = showClippedText()
  updateMode()
  window.addEventListener('resize', updateMode)
  window.addEventListener('focus', onViewportReturn)
  window.addEventListener('century:native-dock-changed', onNativeDockChanged)
  document.addEventListener('visibilitychange', onViewportReturn)
  // dragleave.self no detecta todos los finales de DnD (hijos, Escape o salida de Electron).
  window.addEventListener('dragend', clearCenterDockPreview, true)
  window.addEventListener('drop', clearCenterDockPreview, true)
  window.addEventListener('blur', clearCenterDockPreview)
  window.addEventListener('keydown', onDockDragKey, true)
  window.__lf = { store, get editor() { return store.editor }, S } // utilidad para depurar y para las pruebas automáticas
  const last = db.lastProjectId.get()
  // Al iniciar siempre se muestra la bienvenida (crear o abrir proyecto); nunca se reabre el último solo.
  // Pruebas automáticas (navegador controlado): proyecto temporal sin bienvenida. `?welcome` la fuerza.
  const recoveryState = await window.lf?.recoveryState?.().catch(() => ({ interrupted: false }))
  const pendingRecovery = window.lf?.isElectron && (await db.listRecoveryProjects()).length > 0
  const auto = !pendingRecovery && navigator.webdriver && !location.search.includes('welcome')
  if (auto) {
    let ok = false
    if (last) ok = await openProject(last).catch((e) => { console.error(e); return false })
    if (!ok) {
      const all = await db.listProjects()
      if (all.length) ok = await openProject(all[0].id).catch((e) => { console.error(e); return false })
    }
    if (!ok) await newProject('Mi primer proyecto')
  }
  store.ready = true
  if (window.lf?.onCinematicRequest) stopCinematicRequests = window.lf.onCinematicRequest(handleNativeCinematicRequest)
  window.addEventListener('beforeunload', onUnload)
  window.lf?.onBeforeClose?.(() => S.requestClose()) // Electron: cierre decidido por el usuario
  if (window.lf?.isElectron) await S.resolveInterruptedRecovery(recoveryState?.interrupted)
})
function onUnload(e) {
  S.persistEditorWorkspace()
  if (window.lf?.isElectron || !store.unsavedChanges) return
  e.preventDefault()
  e.returnValue = '' // Solo en navegador: se utiliza el diálogo nativo de recarga/cierre.
}
onBeforeUnmount(() => {
  timelinePlayback.dispose()
  stopCinematicRequests?.()
  window.lf?.setCinematicProject?.(null)
  closeClippedText?.()
  window.removeEventListener('beforeunload', onUnload)
  window.removeEventListener('resize', updateMode)
  window.removeEventListener('focus', onViewportReturn)
  window.removeEventListener('century:native-dock-changed', onNativeDockChanged)
  document.removeEventListener('visibilitychange', onViewportReturn)
  viewportDockSequence++
  if (viewportDockFrame) cancelAnimationFrame(viewportDockFrame)
  window.removeEventListener('dragend', clearCenterDockPreview, true)
  window.removeEventListener('drop', clearCenterDockPreview, true)
  window.removeEventListener('blur', clearCenterDockPreview)
  window.removeEventListener('keydown', onDockDragKey, true)
  configureEditorWorkspace(null)
  unmountEditor()
})

// El nombre del proyecto ya no está en la barra superior: va en el título de la ventana (barra de tareas).
watch(() => store.project?.name, (n) => { document.title = n ? `${n} · Century` : 'Century' }, { immediate: true })
// tooltips: desactivados salvo Preferencias ▸ «Mostrar tooltips» (core/tooltips.js)
watch(() => !!store.prefs.tooltips, (on) => setTooltips(on), { immediate: true })

watch(() => store.tool, (t) => {
  if (t === 'terrain') {
    store.prefs.rightTab = 'object'
    if (S.terrainOn()) S.selectTerrain()
    if (store.ui.mode === 'desktop') store.prefs.rightOpen = true
  }
})
watch(() => store.edit.on, (on) => {
  if (on) { store.prefs.rightTab = 'mesh'; if (store.ui.mode === 'desktop') store.prefs.rightOpen = true }
  else if (store.prefs.rightTab === 'mesh') store.prefs.rightTab = 'object'
})

// ---- arrastrar y soltar sobre el viewport: modelos del panel Proyecto y archivos del sistema ----
function dragOver(e) {
  if (store.gameView.on) return
  const t = e.dataTransfer?.types || []
  if (t.includes('application/x-lf-entry') || t.includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }
}
async function drop(e) {
  if (e.dataTransfer?.types?.includes('application/x-lf-dock-panel')) return
  if (store.gameView.on) { e.preventDefault(); return }
  const raw = e.dataTransfer.getData('application/x-lf-entry')
  if (raw) {
    e.preventDefault()
    const { kind, id } = JSON.parse(raw)
    if (kind === 'model') editor.dropModel(id, e.clientX, e.clientY)
    else if (kind === 'texture') editor.dropImage(id, e.clientX, e.clientY) // una imagen → Sprite 3D
    else if (kind === 'prefab') editor.dropPrefab(id, e.clientX, e.clientY)
    else if (kind === 'scene' && resolveAssetDrop(e.dataTransfer, allEntries(store.project), { kinds: ['scene'] }))
      await editor.dropScene(id, e.clientX, e.clientY)
    return
  }
  const files = Array.from(e.dataTransfer.files || [])
  if (!files.length) return
  e.preventDefault()
  const proj = files.find((f) => extOf(f.name) === 'lfproj')
  if (proj) return openLfprojDialog(proj)
  const before = new Set(store.project.models.map((m) => m.id))
  await importFiles(files)
  const added = store.project.models.filter((m) => !before.has(m.id))
  if (added.length === 1) editor.dropModel(added[0].id, e.clientX, e.clientY)
  else if (!added.length) { const img = (importFiles.last || []).filter((x) => x.kind === 'texture'); if (img.length === 1) editor.dropImage(img[0].id, e.clientX, e.clientY) }
}

const sheet = computed(() => mode.value !== 'desktop' && drawer.value)
const nav = [['hierarchy', 'tree', 'Jerarquía'], ['inspector', 'sliders', 'Inspector'], ['project', 'folder', 'Proyecto'], ['console', 'terminal', 'Consola']]
function navTo(id) {
  if (id === 'console' || id === 'project') {
    const same = store.ui.drawer === 'project' && store.prefs.bottomTab === id
    store.prefs.bottomTab = id
    store.ui.drawer = same ? null : 'project'
  } else store.ui.drawer = store.ui.drawer === id ? null : id
}
</script>

<template>
  <div class="app" :class="['m-' + mode, { editing: store.edit.on }]">
    <MenuBar v-if="store.project" />
    <header v-else class="ph"></header>
    <Toolbar v-if="store.project" />

    <main v-if="workspaceMounted" class="main">
      <template v-if="store.project && mode === 'desktop' && store.prefs.leftOpen && dockVisible('left') && !maxed">
        <aside class="dock left" :style="{ width: dockSizes.left + 'px' }" aria-label="Paneles izquierdos"><DockTree :node="dockLayout.zones.left" zone="left" /></aside>
        <Splitter :model-value="store.prefs.leftW" @update:model-value="resizeDock('left', $event)" :min="dockSizes.leftMin" :max="dockSizes.leftMax" />
      </template>
      <div class="col">
        <template v-if="store.project && mode === 'desktop' && store.prefs.topOpen && dockVisible('top') && !maxed">
          <section class="dock dock-top" :style="{ height: dockSizes.top + 'px' }" aria-label="Paneles superiores"><DockTree :node="dockLayout.zones.top" zone="top" /></section>
          <Splitter :model-value="store.prefs.topH" dir="y" px invert :min="80" :max="dockSizes.topMax" @update:model-value="resizeVertical('top', $event)" />
        </template>
        <div ref="topEl" class="top">
          <section class="center" @dragover="centerDockOver" @drop="centerDockDrop" @dragleave="centerDockLeave">
            <SceneTabs v-if="store.project" />
            <ViewBar v-if="store.project" v-show="!graphDockVisible && store.ui.viewTab !== 'code'" />
            <div id="shader-graph-host" v-show="graphDockVisible" class="shader-graph-host"></div>
            <div v-if="mode === 'desktop' && !maxed && store.project" class="viewport-dock-region"><DockTree :node="dockLayout.zones.center" zone="center" /></div>
    <div id="lf-viewport-fallback" v-show="mode !== 'desktop' || maxed || !store.project" class="viewport-dock-region"></div>
    <Teleport :to="mainTeleportTo" defer>
    <div v-show="!graphDockVisible" class="stage" :class="{ 'game-view': gameView, 'game-preview': store.gameView.on }" @dragover="dragOver" @drop="drop">
              <div class="gframe" :class="{ framed, ratio: !!gameRatio }" :style="frameStyle">
                <div ref="host" class="viewport" @pointerdown.capture="focusMainViewport"></div>
                <ViewportOverlay v-if="store.project && !gameView" />
                <DialogPreview v-if="!gameView && timelinePlayback.dialog.value"
                  inline :timeline-dialog="timelinePlayback.dialog.value" :timeline-time="timelinePlayback.time.value" />
                <div v-if="store.gameView.on && store.gameView.noCamera" class="nocam" role="status">
                  <b>No hay cámara para la vista previa</b>
                  <span class="lf-help">Marca una <em>Camera3D</em> como principal o asígnala en el GameManager de la escena.</span>
                </div>
                <div v-if="store.play.on && store.play.noCamera" class="nocam" role="alert">
                  <b>No hay ninguna cámara activa</b>
                  <span class="lf-help">Designa un <em>CharacterBody3D</em> como jugador o marca una <em>Camera3D</em> como principal.</span>
                </div>
                <UiRoot v-if="store.play.on" :manager="store.editor.player.ui" />
                <PlayHud v-if="store.play.on" />
                <PerfPanel v-if="store.view.perf && store.ready && store.editor?.vp?.perf" :monitor="store.editor.vp.perf" :playing="store.play.on" :redraw="() => store.editor?.vp?.requestRender()" @close="store.view.perf = false" />
              </div>
            </div>
            </Teleport>
            <Teleport v-if="observerDockReady" :to="observerDock.target" defer><SceneRuntimeObserver :key="observerView" :view="observerView" /></Teleport>
            <div v-if="centerDockPreview" class="lf-center-drop" :class="'edge-' + centerDockPreview" aria-hidden="true">Como pestaña · {{ { left:'izquierda', right:'derecha', top:'arriba', bottom:'abajo', center:'centro' }[centerDockPreview] }}</div>
          </section>
        </div>
        <template v-if="store.project && mode === 'desktop' && store.prefs.bottomOpen && dockVisible('bottom') && !maxed">
          <Splitter :model-value="store.prefs.bottomH" @update:model-value="resizeVertical('bottom', $event)" dir="y" px invert :min="Math.min(110, dockSizes.bottomMax)" :max="dockSizes.bottomMax" />
          <section class="dock bottom" :style="{ height: dockSizes.bottom + 'px' }" aria-label="Paneles inferiores"><DockTree :node="dockLayout.zones.bottom" zone="bottom" /></section>
        </template>
      </div>
      <template v-if="store.project && mode === 'desktop' && store.prefs.rightOpen && dockVisible('right') && !maxed">
        <Splitter :model-value="store.prefs.rightW" @update:model-value="resizeDock('right', $event)" invert :min="dockSizes.rightMin" :max="dockSizes.rightMax" />
        <aside class="dock right" :style="{ width: dockSizes.right + 'px' }" aria-label="Paneles derechos"><DockTree :node="dockLayout.zones.right" zone="right" /></aside>
      </template>
      <!-- Tableta y móvil mantienen cajones independientes del layout de escritorio. -->
      <div v-if="sheet" class="veil" @click="store.ui.drawer = null"></div>
      <transition name="drawer">
        <aside v-if="sheet && store.project" :key="drawer" class="drawer" :class="[mode, drawer]">
          <button class="close ghost icon" aria-label="Cerrar panel" @click="store.ui.drawer = null"><Icon name="x" :size="14" /></button>
          <div v-if="drawer === 'hierarchy'" class="in"><SceneTree /></div>
          <div v-else-if="drawer === 'inspector'" class="in"><InspectorDock /></div>
          <div v-else class="in"><BottomDock :closable="false" /></div>
        </aside>
      </transition>
    </main>
    <DockFloating v-for="item in (mode === 'desktop' && store.project ? floatingPanels : [])" :key="item.id" :item="item" />
    <DockPanelBank v-if="store.project && mode === 'desktop'" />

    <nav v-if="mode === 'phone' && store.project" class="bnav" aria-label="Paneles">
      <button v-for="[id, ic, label] in nav" :key="id" :class="{ on: id === 'console' ? drawer === 'project' && store.prefs.bottomTab === 'console' : id === 'project' ? drawer === 'project' && store.prefs.bottomTab === 'project' : drawer === id }" @click="navTo(id)">
        <Icon :name="ic" :size="16" /><span>{{ label }}</span>
      </button>
    </nav>

    <StatusBar v-if="store.project && mode !== 'phone'" />

    <ContextMenu v-if="store.menu" />
    <div v-if="store.recoveryPending" class="recovery-lock">
      <div class="recovery-lock-card">
        <strong>Hay una recuperación pendiente</strong>
        <p>No se abrirán proyectos hasta restaurar o descartar la copia.</p>
        <button @click="S.resolveInterruptedRecovery(true)">Revisar recuperación</button>
      </div>
    </div>
    <AskWindows />
    <CommandPalette v-if="store.palette" />
    <AddModal v-if="store.addModal" />
    <ProjectsModal v-if="store.modal === 'projects'" />
    <WelcomeScreen v-if="store.ready && store.locked" />
    <div v-if="projectLoading" class="project-splash">
      <LoadingScreen :title="projectLoading.name || 'Cargando proyecto'" :status="projectLoading.status" :show-artwork="false" />
    </div>
    <ExportModal v-if="store.modal === 'export'" />
    <ShortcutsModal v-if="store.modal === 'shortcuts'" />
    <SceneInstancePicker v-if="store.modal === 'sceneInstance' && store.sceneInstanceTarget && store.project"
      :scenes="store.project.scenes" :active-scene-id="store.sceneInstanceTarget.sceneId"
      :parent-name="store.sceneInstanceTarget.parentName" :busy="sceneInstanceBusy"
      @choose="chooseSceneInstance" @close="closeSceneInstancePicker" />
    <PreferencesModal v-if="store.modal === 'prefs'" />
    <RenameModal v-if="store.modal === 'rename'" />
    <EventEditor v-if="!store.locked && store.eventEditId" :key="store.eventEditId" />
    <ScriptEditor v-if="!store.locked && store.project && (mode === 'desktop' || store.scriptEditId !== null)" />
    <ShaderGraphEditor v-if="graphDocument" :key="store.project.id + ':' + graphDocument.id" :shader-id="graphDocument.id"
      :visible="(findDockPanel(store.prefs.dockLayout, 'shaderGraph')?.kind === 'dock') || (store.prefs.shaderGraphDocked ? graphDockVisible : store.modal === 'shader')" />
    <ShaderEditor v-else-if="store.modal === 'shader'" :key="store.shaderEditId" />
    <UiEditor v-if="store.modal === 'ui'" :key="store.uiEditId" />
    <UiSlotsModal v-if="store.modal === 'uislots'" />
    <CaptureImportWindow v-if="store.modal === 'capture'" />
    <ThemeEditor v-if="store.modal === 'theme'" />
    <LocalizationWindow v-if="store.locWin && store.project" />
    <DocsWindow v-if="store.docsWin" />
    <UiGalleryModal v-if="store.modal === 'uigallery'" />
    <MapPicker v-if="store.mapPick" />
    <GameSettingsModal v-if="store.modal === 'game'" />
    <EngineSettingsModal v-if="store.modal === 'engine'" />
    <ExportGameModal v-if="store.modal === 'exportgame'" />
    <MigrationReportWindow v-if="store.modal === 'migration'" />
    <DatabaseModal v-if="store.modal === 'database'" />
    <TagsLayersModal v-if="store.modal === 'taglayers'" />

    <div v-if="store.closeBusy" class="close-busy" role="status" aria-live="polite">Finalizando el proyecto…</div>

    <div class="toasts">
      <div v-for="t in store.toasts" :key="t.id" class="toast" :class="t.kind">{{ t.msg }}</div>
    </div>
  </div>
</template>

<style scoped>
.app { display: grid; grid-template-rows: 36px 36px minmax(0, 1fr) 24px; height: 100%; position: relative; background: var(--editor-frame); }
.app.m-phone { grid-template-rows: 36px 36px minmax(0, 1fr) 44px; }
.ph { background: var(--g-850); border-bottom: 1px solid var(--hair); -webkit-app-region: drag; }
.main { display: flex; min-height: 0; min-width: 0; position: relative; }
.col { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.top { flex: 1; min-height: 0; display: flex; }
.dock { background: var(--g-850); display: flex; flex-direction: column; min-height: 0; flex: none; overflow: hidden; border-radius: 4px; }
.dock.left { --g-850: #11141b; border-right: 1px solid var(--hair); }
.dock.right { border-left: 1px solid var(--hair); }
.dock.bottom { --g-850: #161a20; border-top: 1px solid var(--hair); }
.dock.dock-top { border-bottom:1px solid var(--hair); }
.lf-center-drop { position:absolute; z-index:18; pointer-events:none; background:var(--g-850); border:1px solid #88969e; color:var(--text); display:grid; place-items:center; padding:7px 10px; font-size:11px; border-radius:4px; box-shadow:0 6px 18px #0006; }
.lf-center-drop.edge-left { left:8px; top:50%; transform:translateY(-50%); }
.lf-center-drop.edge-right { right:8px; top:50%; transform:translateY(-50%); }
.lf-center-drop.edge-top { top:40px; left:50%; transform:translateX(-50%); }
.lf-center-drop.edge-bottom { bottom:8px; left:50%; transform:translateX(-50%); }
.center { position:relative; flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--hair-soft); border-radius: 4px; background: var(--g-900); }
.shader-graph-host { flex:1; min-height:0; min-width:0; position:relative; }
.nocam { position: absolute; inset: 0; background: #000; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; text-align: center; padding: 24px; color: var(--text-2); pointer-events: none; }
.nocam b { color: var(--warn); font-size: 14px; }
.nocam span { max-width: 460px; line-height: 1.5; }
.stage { position: absolute; inset: 0; min-height: 0; background: var(--g-850); touch-action: none; }
.viewport-dock-region { position:relative; flex:1; min-height:0; min-width:0; overflow:hidden; }
.viewport-dock-region :deep(.lf-dock-target) { position:relative; }
.viewport { position: absolute; inset: 0; }
/* marco del juego: ocupa toda la vista; con aspecto fijo o escala < 1 se centra y deja bandas negras (container queries) */
.stage { container-type: size; }
.stage.game-view { background: #000; }
.stage.game-preview .viewport { pointer-events: none; }
.gframe { position: absolute; inset: 0; isolation: isolate; overflow: hidden; }
.gframe.framed { inset: auto; left: 50%; top: 50%; transform: translate(-50%, -50%); width: calc(100cqw * var(--sc, 1)); height: calc(100cqh * var(--sc, 1)); box-shadow: 0 0 0 1px var(--hair); overflow: hidden; }
.gframe.framed.ratio { aspect-ratio: var(--ar); width: min(calc(100cqw * var(--sc, 1)), calc(100cqh * var(--sc, 1) * var(--ar))); height: auto; }
.project-splash { position: fixed; inset: 0; z-index: 21000; }

/* cajones */
.veil { position: absolute; inset: 0; z-index: 18; background: rgba(8, 10, 13, .38); }
.drawer { position: absolute; z-index: 20; background: var(--g-850); border: 1px solid var(--g-600); box-shadow: 0 18px 50px rgba(0, 0, 0, .55); display: flex; flex-direction: column; min-height: 0; }
.drawer .in { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.drawer .in > * { flex: 1; min-height: 0; }
.drawer .close { position: absolute; top: 3px; right: 4px; z-index: 3; width: 22px; height: 22px; }
.drawer :deep(.panel-head), .drawer :deep(.tabs), .drawer :deep(.bdock > .tabs) { padding-right: 32px; }
.drawer.tablet.hierarchy { top: 0; bottom: 0; left: 0; width: min(320px, 86vw); border-left: none; }
.drawer.tablet.inspector { top: 0; bottom: 0; right: 0; width: min(340px, 90vw); border-right: none; }
.drawer.tablet.project, .drawer.phone { left: 0; right: 0; bottom: 0; height: min(60%, 520px); border-bottom: none; border-radius: 10px 10px 0 0; }
.drawer.tablet.project { height: min(52%, 460px); }
.drawer-enter-active, .drawer-leave-active { transition: transform .18s ease, opacity .18s ease; }
.drawer.tablet.hierarchy.drawer-enter-from, .drawer.tablet.hierarchy.drawer-leave-to { transform: translateX(-24px); opacity: 0; }
.drawer.tablet.inspector.drawer-enter-from, .drawer.tablet.inspector.drawer-leave-to { transform: translateX(24px); opacity: 0; }
.drawer.tablet.project.drawer-enter-from, .drawer.tablet.project.drawer-leave-to, .drawer.phone.drawer-enter-from, .drawer.phone.drawer-leave-to { transform: translateY(24px); opacity: 0; }
@media (prefers-reduced-motion: reduce) { .drawer-enter-active, .drawer-leave-active { transition: none; } }

.bnav { display: grid; grid-template-columns: repeat(4, 1fr); background: var(--g-850); border-top: 1px solid var(--hair); z-index: 21; }
.bnav button { height: 100%; flex-direction: column; gap: 2px; border: none; border-radius: 0; background: transparent; color: var(--text-3); font-size: 10px; }
.bnav button.on { color: var(--blue-hi); background: var(--blue-wash); }

.toasts { position: fixed; bottom: 36px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; gap: 6px; z-index: 200; pointer-events: none; max-width: 92vw; }
.m-phone .toasts { bottom: 56px; }
.toast { background: var(--g-700); border: 1px solid var(--g-600); padding: 7px 13px; border-radius: 6px; box-shadow: 0 8px 24px rgba(0, 0, 0, .4); }
.toast.ok { border-color: rgba(95, 200, 143, .5); }
.toast.error { border-color: rgba(229, 88, 79, .6); color: #ff9a92; }
</style>

<style scoped>
.close-busy { position: fixed; inset: 0; z-index: 20000; display: flex; align-items: center; justify-content: center; background: rgba(8, 10, 13, .72); color: var(--text); font-size: 14px; }
</style>

<style>
@font-face {
  font-family: 'JetBrains Mono';
  src: url('./assets/fonts/JetBrainsMono-Regular.ttf') format('truetype');
  font-display: swap;
}
@font-face {
  font-family: Selawik;
  src: url('./assets/fonts/selawk.ttf') format('truetype');
  font-weight: 400;
  font-display: swap;
}
@font-face {
  font-family: Selawik;
  src: url('./assets/fonts/selawksb.ttf') format('truetype');
  font-weight: 600;
  font-display: swap;
}

:root.lf-editor {
  --g-950: #0d1015;
  --g-900: #11141b;
  --g-850: #171a21;
  --g-800: #1d2128;
  --g-700: #2f353f;
  --g-600: #404853;
  --hair: #34373d;
  --hair-soft: #242932;
  --menu-surface: #1d2128;
  --menu-hover: #2f353f;
  --menu-selected: #22394b;
  --menu-stroke: #3d4754;
  --text: #f5f6f7;
  --text-2: #bfc4cc;
  --text-3: #a6aab0;
  --blue: #0068c3;
  --blue-hi: #77beef;
  --blue-wash: #233d53;
  --editor-frame: #1f242b;
  --editor-chrome: #0e1116;
  --editor-selection: #003d5e;
  --font: Selawik, 'Segoe UI', system-ui, sans-serif;
  color: var(--text);
}

.recovery-lock { position: fixed; inset: 0; z-index: 8990; display: grid; place-items: center; background: rgba(8,10,12,.90); color: #e8eaed; }
.recovery-lock-card { width: min(420px,90vw); padding: 24px; border: 1px solid #454b52; background: #1d2127; border-radius: 8px; }
.recovery-lock-card p { color: #b0bac5; line-height: 1.5; }
.recovery-lock-card button { padding: 9px 16px; background: #384f64; color: white; border: 1px solid #6e8295; border-radius: 4px; cursor: pointer; }
</style>
