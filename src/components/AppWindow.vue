<script setup>
// Ventana real del editor: barra de título con cerrar y maximizar, se arrastra, se redimensiona desde cualquier borde,
// pasa al frente al tocarla y recuerda su posición y tamaño. NO bloquea el editor: en Century no hay modales, todos los
// diálogos son ventanas (la propiedad `modal` está obsoleta). En pantallas pequeñas ocupa todo el espacio disponible (hoja completa).
//
// Contenido: <AppWindow title="…" @close="…"> …cuerpo… <template #footer>…</template> </AppWindow>
// El cuerpo es un contenedor (container-type: inline-size, nombre «win»): los formularios internos se adaptan al ANCHO DE LA
// VENTANA con @container win (…), no al de la pantalla.
import { acquirePointer } from '../engine/runtime/input/pointer-capture.js'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import Icon from './Icon.vue'
import ToolAlerts from './ToolAlerts.vue'
import { fitEditorWindow } from '../core/editor/window-layout.js'
import { releasePropertyFocusOnEscape } from '../core/editor/property-focus.js'
import { store } from '../core/store.js'
import { DOCK_PANELS, findDockPanel, floatDockPanel, moveDockPanel, restoreDockPanel } from '../core/editor/docking.js'
import { startDockGesture, startNativeDockTransfer } from '../core/editor/dock-gesture.js'
import { isNativeToolDragging } from '../core/editor/native-tool-registry.js'
import { getDockSpawn } from '../core/editor/native-dock.js'
import { useNativeToolWindow, useMountedDockTarget } from '../core/editor/native-tool-window.js'

let zTop = 100 // las ventanas más recientes quedan delante; siempre por debajo de los avisos (z 200)

const props = defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  width: { type: Number, default: 720 },
  height: { type: Number, default: 0 },          // 0 = se ajusta al contenido (hasta el alto disponible)
  minWidth: { type: Number, default: 340 },
  minHeight: { type: Number, default: 180 },
  modal: { type: Boolean, default: false },      // @deprecated — el editor no usa modales (test-no-modals.mjs lo vigila); se conserva por compatibilidad
  closable: { type: Boolean, default: true },
  resizable: { type: Boolean, default: true },
  scroll: { type: Boolean, default: true },       // false: el contenido gestiona su propio scroll
  persist: { type: String, default: '' },         // clave para recordar geometría
  compactBelow: { type: Number, default: 720 },   // por debajo de este ancho de pantalla: hoja completa
  backdropClose: { type: Boolean, default: true },
  level: { type: Number, default: 0 },
  layoutRect: { type: Object, default: null },
  dockPanelId: { type: String, default: '' },
  nativePanelId: { type: String, default: '' }, // geometría del docking: no crea otra preferencia            // se suma al orden de apilado (selector de mapa: por encima de todo)
  nativeTool: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'geometry-change'])
const nativePanels = new Set(['projects', 'prefs', 'shortcuts', 'gamesettings', 'enginesettings', 'exportgame', 'docs', 'database', 'taglayers', 'localization', 'capture-import'])
const nativeRequested = ref(false)
const nativeTarget = useNativeToolWindow({
  kind: 'panel',
  enabled: () => props.dockPanelId ? nativeRequested.value : props.nativeTool || nativePanels.has(props.persist),
  title: () => props.title,
  width: () => props.width,
  height: () => props.height || 510,
  position: () => props.layoutRect || getDockSpawn(props.nativePanelId || props.dockPanelId) || (findDockPanel(store.prefs.dockLayout, props.dockPanelId)?.kind === 'float' ? findDockPanel(store.prefs.dockLayout, props.dockPanelId) : null),
  registryId: props.nativePanelId || props.dockPanelId,
  canClose: () => props.dockPanelId ? true : props.nativePanelId ? true : props.closable,
  close: () => { if (props.dockPanelId) attachNative(); else emit('close') },
})

function openNative() {
  if (!props.dockPanelId || !window.lf?.isElectron || nativeTarget.value) return
  nativeRequested.value = true
  if (!nativeTarget.value) { nativeRequested.value = false; return }
  const rect = nativeTarget.value.ownerDocument.defaultView
  store.prefs.dockLayout = floatDockPanel(store.prefs.dockLayout, props.dockPanelId, {
    x: Number.isFinite(rect?.screenX) ? rect.screenX : 80,
    y: Number.isFinite(rect?.screenY) ? rect.screenY : 90,
    w: props.width, h: props.height || 520,
  })
}
function attachNative() {
  if (!props.dockPanelId) return
  let at = findDockPanel(store.prefs.dockLayout, props.dockPanelId)
  if (at?.kind !== 'dock') {
    store.prefs.dockLayout = restoreDockPanel(store.prefs.dockLayout, props.dockPanelId)
    at = findDockPanel(store.prefs.dockLayout, props.dockPanelId)
  }
  if (at?.kind !== 'dock') return
  store.prefs[at.zone + 'Open'] = true
  nativeRequested.value = false
}
function nativeDockEvent(event) {
  if (event.detail?.id !== props.dockPanelId) return
  if (event.type === 'century:dock-detach') openNative()
  else attachNative()
}
onMounted(() => {
  window.addEventListener('century:dock-detach', nativeDockEvent)
  window.addEventListener('century:dock-attach', nativeDockEvent)
  if (props.dockPanelId && findDockPanel(store.prefs.dockLayout, props.dockPanelId)?.kind === 'float') openNative()
})
onBeforeUnmount(() => {
  window.removeEventListener('century:dock-detach', nativeDockEvent)
  window.removeEventListener('century:dock-attach', nativeDockEvent)
})
watch(nativeTarget, async () => { await nextTick(); window.dispatchEvent(new Event('century:native-dock-changed')) }, { flush: 'post' })

const location = computed(() => props.dockPanelId ? findDockPanel(store.prefs.dockLayout, props.dockPanelId) : null)
const docked = computed(() => store.ui.mode === 'desktop' && location.value?.kind === 'dock')
const target = computed(() => {
  if (!docked.value) return 'body'
  const z = location.value.zone
  const unavailable = store.ui.mode !== 'desktop' || store.prefs[z + 'Open'] === false || (store.play.on && store.prefs.gameMaximize)
  return unavailable ? `#lf-dock-special-${props.dockPanelId}` : `#lf-dock-target-${location.value.groupId}-${props.dockPanelId}`
})
const mountedDockTarget = useMountedDockTarget(() => target.value, () => `#lf-dock-special-${props.dockPanelId}`, () => [store.prefs.dockLayout, store.play.on, store.prefs.gameMaximize, store.ui.mode, nativeTarget.value])
function nativeTitleDown(event) {
  if (event.target.closest?.('button,input,select,textarea,a,[data-no-drag]')) return
  if (nativeTarget.value && (props.dockPanelId || props.nativePanelId)) startDockGesture(event, props.dockPanelId || props.nativePanelId, store, true)
}
function dragDock(event) {
  if (nativeTarget.value) { startNativeDockTransfer(event); return }
  const id = props.dockPanelId || props.nativePanelId
  if (!id) return
  event.dataTransfer.setData('application/x-lf-dock-panel', id)
  event.dataTransfer.effectAllowed = 'move'
}
function toggleDock() {
  const id = props.dockPanelId
  if (!id || !DOCK_PANELS[id]) return
  const zone = DOCK_PANELS[id][2]
  store.prefs.dockLayout = docked.value
    ? floatDockPanel(store.prefs.dockLayout, id, { x: geo.x, y: geo.y, w: geo.w, h: geo.h || 520 })
    : moveDockPanel(store.prefs.dockLayout, id, zone)
  if (docked.value) store.prefs[zone + 'Open'] = true
}


const M = 8          // margen con el borde de la pantalla
const TOP = 40       // franja superior (controles nativos de la ventana de Electron)
const KEEP = 90      // píxeles de la barra que siempre quedan a la vista al arrastrar
const DIRS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

const vp = reactive({ w: window.innerWidth, h: window.innerHeight })
const geo = reactive({ x: 0, y: 0, w: props.width, h: props.height })
const maximized = ref(false)
const dragging = ref(false)
const frame = ref(null)
let hostWindow = window
const z = ref(++zTop + props.level)

const compact = computed(() => !window.lf?.isElectron && (vp.w < props.compactBelow || vp.h < 440))
const isMax = computed(() => compact.value || maximized.value)
const availW = computed(() => Math.max(200, vp.w - M * 2))
const availH = computed(() => Math.max(160, vp.h - TOP - M))

const clamp = (v, a, b) => Math.min(Math.max(v, a), Math.max(a, b))
const rect = computed(() => {
  if (compact.value) return { x: 0, y: TOP, w: vp.w, h: vp.h - TOP }
  if (maximized.value) return { x: M, y: TOP, w: availW.value, h: availH.value }
  const w = clamp(geo.w, Math.min(props.minWidth, availW.value), availW.value)
  const h = geo.h ? clamp(geo.h, Math.min(props.minHeight, availH.value), availH.value) : 0
  return { x: geo.x, y: geo.y, w, h }
})
const style = computed(() => {
  if (docked.value || nativeTarget.value) return {}
  const r = rect.value
  const s = { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', maxHeight: (compact.value || maximized.value ? r.h : availH.value) + 'px' }
  if (r.h) s.height = r.h + 'px'
  return s
})

// ---- persistencia (por proyecto no: es una preferencia del editor) ----
const key = () => (props.persist ? 'lf.win.' + props.persist : '')
function load() {
  if (props.layoutRect) {
    const rect = props.layoutRect
    if (![rect.x, rect.y, rect.w, rect.h].every(Number.isFinite)) return false
    Object.assign(geo, rect)
    return true
  }
  try {
    const raw = key() && localStorage.getItem(key())
    if (!raw) return false
    const g = JSON.parse(raw)
    if (![g.x, g.y, g.w].every(Number.isFinite)) return false
    Object.assign(geo, { x: g.x, y: g.y, w: g.w, h: Number.isFinite(g.h) ? g.h : 0 })
    maximized.value = !!g.max
    return true
  } catch { return false }
}
function save() {
  if (props.layoutRect) { emit('geometry-change', { x: geo.x, y: geo.y, w: geo.w, h: geo.h }); return }
  try { if (key()) localStorage.setItem(key(), JSON.stringify({ x: geo.x, y: geo.y, w: geo.w, h: geo.h, max: maximized.value })) } catch { /* sin almacenamiento: no pasa nada */ }
}

function curH() { return rect.value.h || frame.value?.offsetHeight || 300 }
function fit() {
  const r = rect.value
  geo.x = clamp(geo.x, KEEP - r.w, vp.w - KEEP)
  geo.y = clamp(geo.y, TOP, vp.h - 40)
  // la ventana cabe entera en la pantalla (el arrastre sí puede sacar parte de ella); al achicar la pantalla vuelve a entrar
  const h = Math.min(curH(), availH.value)
  if (!dragging.value) {
    const visible = fitEditorWindow({ x: geo.x, y: geo.y, w: r.w, h }, vp.w, vp.h, TOP, M)
    geo.x = visible.x
    geo.y = visible.y
  }
  // el tamaño elegido (geo.w/h) no se recorta aquí: `rect` lo limita a la pantalla al dibujar, así la ventana vuelve a su tamaño al agrandar la pantalla
}
function center() {
  const r = rect.value
  geo.x = Math.round((vp.w - r.w) / 2)
  geo.y = Math.round(TOP + (availH.value - Math.min(curH(), availH.value)) / 2)
  // cada ventana nueva se desplaza un poco para que no queden exactamente apiladas
  const n = (zTop - 100) % 5
  geo.x += n * 14; geo.y += n * 14
}
function onResize() { vp.w = hostWindow.innerWidth; vp.h = hostWindow.innerHeight; fit() }

// ---- arrastrar ----
let drag = null
function startDrag(e) {
  if (nativeTarget.value || docked.value || isMax.value || e.button !== 0 || e.target.closest('button, input, select, textarea, a, [data-no-drag]')) return
  if (!acquirePointer(e.currentTarget, e, "Mover ventana")) return
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, gx: geo.x, gy: geo.y, el: e.currentTarget }
  dragging.value = true
  if (!geo.h) geo.h = 0 // se mantiene automático
  e.preventDefault()
}
function moveDrag(e) {
  if (!drag || e.pointerId !== drag.id) return
  geo.x = clamp(drag.gx + e.clientX - drag.x, KEEP - rect.value.w, vp.w - KEEP)
  geo.y = clamp(drag.gy + e.clientY - drag.y, TOP, vp.h - 40)
}
function endDrag(e) {
  if (!drag || (e && e.pointerId !== drag.id)) return
  try { drag.el.releasePointerCapture(drag.id) } catch { /* ya liberado */ }
  drag = null; dragging.value = false; save()
}

// ---- redimensionar ----
let rz = null
function startResize(e, dir) {
  if (e.button !== 0 || isMax.value || docked.value) return
  if (!acquirePointer(e.currentTarget, e, "Redimensionar ventana")) return
  if (!geo.h) geo.h = curH()
  rz = { id: e.pointerId, dir, x: e.clientX, y: e.clientY, g: { x: geo.x, y: geo.y, w: rect.value.w, h: rect.value.h }, el: e.currentTarget }
  e.preventDefault()
}
function moveResize(e) {
  if (!rz || e.pointerId !== rz.id) return
  const dx = e.clientX - rz.x, dy = e.clientY - rz.y, d = rz.dir, g = rz.g
  const minW = Math.min(props.minWidth, availW.value), minH = Math.min(props.minHeight, availH.value)
  let { x, y, w, h } = g
  if (d.includes('e')) w = clamp(g.w + dx, minW, vp.w - M - g.x)
  if (d.includes('s')) h = clamp(g.h + dy, minH, vp.h - M - g.y)
  if (d.includes('w')) { w = clamp(g.w - dx, minW, g.x + g.w - M); x = g.x + g.w - w }
  if (d.includes('n')) { h = clamp(g.h - dy, minH, g.y + g.h - TOP); y = g.y + g.h - h }
  Object.assign(geo, { x, y, w, h })
}
function endResize(e) {
  if (!rz || (e && e.pointerId !== rz.id)) return
  try { rz.el.releasePointerCapture(rz.id) } catch { /* ya liberado */ }
  rz = null; save()
}

function toggleMax() { if (nativeTarget.value || !props.resizable || compact.value || docked.value) return; maximized.value = !maximized.value; save() }
function raise() { if (z.value < zTop + props.level) z.value = ++zTop + props.level }
function close() { if (props.closable) emit('close') }
// Esc dentro de un editor de código (CodeMirror) es del editor: cierra su buscador, no la ventana
function onEsc(e) {
  if (releasePropertyFocusOnEscape(e) || e.defaultPrevented) return
  if (!e.composedPath().some((n) => n.classList?.contains('cm-editor'))) close()
}
function onBackdrop() { if (props.modal && props.backdropClose) close() }

onMounted(async () => {
  hostWindow = frame.value?.ownerDocument.defaultView || window
  if (!nativeTarget.value) {
    const had = load()
    onResize()
    hostWindow.addEventListener('resize', onResize)
    await nextTick()
    if (!had) center()
    fit()
  }
  await nextTick()
  // el foco dentro de la ventana permite cerrarla con Esc; si ya hay algo enfocado dentro (autofocus) se respeta
  if (!isNativeToolDragging(props.nativePanelId || props.dockPanelId) && frame.value && !frame.value.contains(hostWindow.document.activeElement)) frame.value.focus({ preventScroll: true })
})
onBeforeUnmount(() => { hostWindow.removeEventListener('resize', onResize); endDrag(); endResize() })
</script>

<template>
  <Teleport :to="nativeTarget || mountedDockTarget" :disabled="!docked && !nativeTarget" defer>
  <div class="aw-layer" :class="{ modal, docked, 'native-tool-layer': nativeTarget }" :style="{ zIndex: z }" @pointerdown.self="onBackdrop">
    <section ref="frame" class="aw" :class="{ max: isMax, drag: dragging, compact, docked }" :style="style" role="dialog" :aria-modal="modal ? 'true' : 'false'"
      :aria-label="title" tabindex="-1" @pointerdown="raise" @keydown.esc.stop="onEsc">
      <header class="aw-bar" @pointerdown="startDrag" @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="endDrag" @lostpointercapture="endDrag" @dblclick="toggleMax">
        <span class="aw-title" :class="{ 'native-dock-title': nativeTarget && (dockPanelId || nativePanelId) }" :draggable="!!(dockPanelId || nativePanelId)" @pointerdown="nativeTitleDown" @dragstart="dragDock" :title="nativeTarget && (dockPanelId || nativePanelId) ? 'Arrastra el título para acoplar; el espacio libre mueve la ventana' : undefined">{{ title }}</span>
        <span v-if="subtitle" class="aw-sub">{{ subtitle }}</span>
        <span class="aw-grow"></span>
        <slot name="actions" />
        <button v-if="!nativeTarget && resizable && !compact && !docked" type="button" class="aw-btn" :data-tooltip="maximized ? 'Restaurar' : 'Maximizar'" :aria-label="maximized ? 'Restaurar ventana' : 'Maximizar ventana'" @click="toggleMax">
          <Icon name="frame" :size="13" />
        </button>
        <button v-if="!nativeTarget && closable" type="button" class="aw-btn aw-x" data-tooltip="Cerrar" aria-label="Cerrar ventana" @click="close">
          <Icon name="x" :size="14" />
        </button>
      </header>
      <div class="aw-content" :class="{ noscroll: !scroll }"><slot /></div>
      <footer v-if="$slots.footer" class="aw-foot"><slot name="footer" /></footer>
      <ToolAlerts v-if="nativeTarget" />
      <template v-if="!nativeTarget && resizable && !isMax && !docked">
        <i v-for="d in DIRS" :key="d" class="aw-rz" :class="d" @pointerdown.stop="startResize($event, d)" @pointermove="moveResize" @pointerup="endResize" @pointercancel="endResize" @lostpointercapture="endResize"></i>
      </template>
    </section>
  </div>
  </Teleport>
</template>

<style scoped>
.aw-layer { position: fixed; inset: 0; z-index: 100; pointer-events: none; }
.aw-layer.docked { position:relative; inset:auto; width:100%; height:100%; z-index:auto !important; pointer-events:auto; }
.aw-layer.modal { pointer-events: auto; background: rgba(8, 10, 13, .55); }
.aw {
  position: absolute; display: flex; flex-direction: column; min-width: 0; min-height: 0; pointer-events: auto; outline: none;
  background: var(--g-850); border: 1px solid var(--g-600); border-radius: 8px; overflow: hidden;
  box-shadow: 0 24px 60px rgba(0, 0, 0, .5), 0 0 0 1px rgba(0, 0, 0, .25);
  container: win / inline-size;
}
.aw.max { border-radius: 0; }
.aw.docked { position:relative; left:auto; top:auto; width:100%; height:100%; max-height:none; border-radius:0; box-shadow:none; }
.aw.docked .aw-bar { cursor:default; }
.aw.compact { border-left: 0; border-right: 0; border-bottom: 0; }
.aw-bar {
  flex: none; display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 6px 0 14px; min-width: 0;
  background: var(--g-800); border-bottom: 1px solid var(--hair); cursor: grab; user-select: none; touch-action: none;
}
.aw.max .aw-bar { cursor: default; }
.aw.drag .aw-bar { cursor: grabbing; }
.aw-title { font-size: 13px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 0 1 auto; }
.aw-sub { font-size: 11.5px; color: var(--text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; flex: 1 1 0; }
.aw-grow { flex: 1 1 0; min-width: 0; }
.aw-sub + .aw-grow { flex: 0 0 0; }
.aw-btn { width: 28px; height: 26px; padding: 0; flex: none; border-color: transparent; background: transparent; color: var(--text-2); }
.aw-btn:hover { background: var(--g-700); color: var(--text); }
.aw-x:hover { background: var(--danger); color: #fff; }
.aw-content { flex: 1 1 auto; min-height: 0; min-width: 0; overflow: auto; display: flex; flex-direction: column; }
.aw-content.noscroll { overflow: hidden; }
.aw-content > :deep(*) { min-width: 0; }
.aw-foot { flex: none; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px 14px; border-top: 1px solid var(--hair); background: var(--g-850); }
.native-tool-layer .aw { inset: 0; border: 0; border-radius: 0; box-shadow: none; }
.native-tool-layer .aw-bar {
  cursor: default; background: var(--editor-chrome); border-color: var(--hair-soft);
  padding-left: max(12px, env(titlebar-area-x, 0px));
  padding-right: max(12px, calc(100% - env(titlebar-area-width, 100%) - env(titlebar-area-x, 0px) + 12px));
  -webkit-app-region: drag;
}
.native-tool-layer .aw-bar .native-dock-title { -webkit-app-region: no-drag; cursor:grab; user-select:none; }
.native-tool-layer .aw-bar :deep(:is(button,input,select,textarea,a,[data-no-drag])) { -webkit-app-region: no-drag; }
/* bordes de redimensión: franjas invisibles de 6 px (8 en esquinas) por encima del contenido */
.aw-rz { position: absolute; z-index: 5; touch-action: none; }
.aw-rz.n, .aw-rz.s { left: 10px; right: 10px; height: 6px; cursor: ns-resize; }
.aw-rz.e, .aw-rz.w { top: 10px; bottom: 10px; width: 6px; cursor: ew-resize; }
.aw-rz.n { top: -2px; } .aw-rz.s { bottom: -2px; } .aw-rz.e { right: -2px; } .aw-rz.w { left: -2px; }
.aw-rz.ne, .aw-rz.nw, .aw-rz.se, .aw-rz.sw { width: 14px; height: 14px; }
.aw-rz.ne { top: -3px; right: -3px; cursor: nesw-resize; } .aw-rz.sw { bottom: -3px; left: -3px; cursor: nesw-resize; }
.aw-rz.nw { top: -3px; left: -3px; cursor: nwse-resize; } .aw-rz.se { bottom: -3px; right: -3px; cursor: nwse-resize; }
</style>
