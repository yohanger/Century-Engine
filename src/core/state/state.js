// Estado reactivo del editor (`store`), preferencias de interfaz y avisos. Base de todo: no importa nada del proyecto.
import { reactive, markRaw, watch } from '@vue/reactivity'
import { uid } from '../../engine/runtime/util.js'
import { DEFAULT_EDITOR_VIEW, mergeEditorSettings, setWorkspaceTreeOpen } from './editor-workspace.js'
import { normalizeDockLayout } from '../editor/docking.js'

// ---------- preferencias de interfaz (persisten en el navegador) ----------
const PREFS_KEY = 'levelforge:prefs'
export const defaultPrefs = () => ({
  navigation: 'mouse', // mouse | trackpad
  orbitSelection: true, // centrar órbita en selección solo al empezar a girar
  editorFov: 90, // FOV horizontal de cámara editorial, no se exporta
  leftOpen: true,
  rightOpen: true,
  bottomOpen: true,
  leftW: 236,
  rightW: 296,
  bottomH: 210,
  topH: 150,
  topOpen: false,
  rightTab: 'object',
  bottomTab: 'project', // project | console | mixer
  shaderGraphDocked: false,
  inspFold: {}, // secciones del Inspector plegadas { título: true }
  inspLabelWidth: 112, // ancho en píxeles de la columna de nombres; preferencia local
  projTreeW: 170,
  projSize: 64, // tamaño de los iconos del panel Proyecto
  projView: 'grid',
  projTreeOpen: false,
  projSort: 'name', // name | type
  // sensibilidad y comportamiento del editor (Preferencias)
  mouseSensitivity: 1, mouseOrbit: 1, mousePan: 1, mouseZoom: 1, mouseInvertZoom: false,
  padOrbit: 1, padPan: 1, padZoom: 1, padInvert: false, padInvertY: false, padZoomCursor: true,
  flySpeed: 14, flySprint: 3, flyLook: 1,
  gizmoSize: 1, orientGizmo: true, tooltips: false, toolPalette: false,
  showGizmos: true, // visibilidad general de ayudas editoriales (no afecta TransformControls)
  gizmoCategories: {}, // false por categoría la oculta; las no configuradas son visibles
  selectionStyle: 'box', selectionOutlineColor: '#ffb547', selectionOutlineWidth: 1.5, selectionOutlineStrength: 3, // toolPalette: obsoleto (las herramientas viven en la barra superior)
  gameAspect: 'free', gameScale: 1, gameMaximize: false, gameMute: false, // vista Juego (como Game de Unity)
  diskDelay: 3, // segundos entre un cambio y la escritura del project.lfproj en disco
  terrainCropWarning: true, // advertir antes de recortar información del terreno
  addAsChild: false, // Shift+A: añadir SIEMPRE dentro del seleccionado (si no, dentro solo si es un grupo; si no, a su lado)
})
function loadPrefs() {
  let saved = {}
  try { saved = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') || {} } catch { /* preferencias ilegibles */ }
  const prefs = { ...defaultPrefs(), ...saved }
  if (!prefs.gizmoCategories || typeof prefs.gizmoCategories !== 'object' || Array.isArray(prefs.gizmoCategories)) prefs.gizmoCategories = {}
  if (prefs.bottomTab === 'clips') prefs.bottomTab = 'project' // La pestaña heredada se retiró; no abrir una vista sin contenido.
  prefs.dockLayout = normalizeDockLayout(saved.dockLayout, prefs)
  return prefs
}

export const store = reactive({
  project: null,
  selectedId: null, // nodo principal (el que lleva el gizmo)
  selectedIds: [],
  chunkSelection: null,
  streamingPreviewRows: [],
  roadPoint: null, // índice del punto de control seleccionado de la carretera activa
  roadPaint: { active: false, slot: 'asphalt', layerId: null, radius: 1.2, hardness: 0.55, opacity: 0.7, erase: false },
  tool: 'select', // select | terrain | place | road
  gizmo: 'translate', // translate | rotate | scale | universal | none
  uniformScaleHud: '', // mensaje temporal de operación S en Object Mode, no persistente
  colliderPreview: true, // solo editor: mostrar el contorno físico del nodo seleccionado
  space: 'world', // world | local
  terrainTool: 'raise',
  brush: { radius: 5, strength: 0.5, hardness: 0.5, layer: 0 },
  // herramienta Rampa: 'points' = alturas del terreno en los dos puntos · 'angle' = ángulo fijo desde el inicio · lift = subir/bajar todo
  ramp: { mode: 'points', angle: -20, lift: 0 },
  rampInfo: null, // { len, dh, angle } de la rampa que se está arrastrando
  place: { type: 'primitive', kind: 'box', modelId: null },
  audioInspector: null, // grupo/efecto seleccionado del mezclador: estado solo de interfaz
  audioPrev: null, // id del clip que se está previsualizando
  nav: { running: false, fraction: 0 },
  mapPick: null, // selector de punto en el mapa: { title, point, resolve }
  bake: { running: false, label: '', fraction: 0, state: { active: false, stale: false, lightmaps: 0, probes: 0 } }, // progreso del horneado de luz
  view: { ...DEFAULT_EDITOR_VIEW },
  editorSnap: {},
  treeState: { open: {}, rootOpen: true, scroll: 0 },
  foliageBrush: { typeId: null, erase: false, all: false },
  foliageCounts: {},
  pieces: [], // piezas de terreno de la escena: { id, name, ox, oz, size, segments, enabled }
  activePieceId: null,
  terrainSel: false, // el nodo «Terreno» de la jerarquía está seleccionado
  saveState: 'saved', // estado de la copia de trabajo IndexedDB
  unsavedChanges: false, // cambios desde el último guardado CONFIRMADO, no desde el autoguardado
  pendingRevision: 0, // aumenta con cada modificación, incluso durante un guardado
  recoveryPending: false, // bloqueo durante la decisión sobre copias de cierre inesperado
  closeBusy: false, // bloquea interacción mientras se resuelve Guardar/Descartar
  modal: null, // 'projects' | 'export' | 'shortcuts' | 'rename' | 'migration' | 'sceneInstance'
  sceneInstanceTarget: null, // solo interfaz: proyecto, escena activa y padre del selector
  palette: false,
  addModal: null,
  menu: null, // menú contextual { x, y, items, rebuild? }
  renameId: null, // nodo que se está renombrando en el árbol
  toasts: [],
  log: [], // salidas y diagnósticos de scripts (pestaña Consola)
  canUndo: false,
  canRedo: false,
  viewInfo: { name: '', ortho: false },
  viewQuat: [0, 0, 0, 1], // orientación de la cámara del editor (para el gizmo de ejes)
  cursor: null, // { x, y, z } bajo el puntero
  filmMode: false, // Nether Film Maker: no se añaden ni se borran objetos
  ui: { mode: 'desktop', drawer: null, viewTab: 'scene', shaderWorkspace: false, codeNativeOpen: false }, // mode: desktop | tablet | phone · drawer: panel abierto en pantallas chicas
  projFolder: 'Assets', // carpeta abierta en el panel Proyecto
  projSel: null, // { kind, id } entrada seleccionada en el panel Proyecto
  // pintar en un sprite (Tab con un Sprite / Lienzo de píxeles elegido): core/paint/session.js
  paint: {
    on: false, objId: null, tool: 'pencil', color: '#1a1c2c', color2: '#ffffff', size: 1, pixelPerfect: true, symX: false, symY: false,
    tolerance: 0, contiguous: true, fill: false, w: 0, h: 0, canUndo: false, canRedo: false, px: null,
    layers: [], activeLayer: null, // capas del lienzo (de arriba abajo) y la activa (core/paint/session.js)
  },
  edit: {
    on: false, id: null, mode: 'vertex', vertexDraw: false, vertexPlane: 'XZ', // herramienta temporal y plano de construcción (no se guarda en el proyecto)
    globalShortcuts: true, localView: false,
    xray: false, proportional: false, falloff: 'smooth', propSize: 2, mirrorX: false, showNormals: false,
    count: { v: 0, e: 0, f: 0, sv: 0, se: 0, sf: 0 },
    hud: '', // texto de la operación modal en curso
    modalControl: null,
    paint: { active: false, layer: 1, radius: 1.2, strength: 0.5, hardness: 0.45 },
    slide: { factor: 0.3, axis: 'x' }, extrudeIndividual: { distance: 0.2 },
    spin: { angle: 90, steps: 8, axis: 'y', center: [0, 0, 0] },
    shear: { factor: 0.3, axis: 'x', reference: 'y' },
    bevel: { width: 0.2, segments: 1, profile: 0.5 }, loopCuts: 1, loopSlide: 0, inset: { thickness: 0.2, depth: 0 }, subdivide: { cuts: 1 }, mergeDist: 0.001,
  },
  prefs: loadPrefs(),
  editor: null,
  ready: false,
  locked: false, // sin proyecto abierto: la pantalla de bienvenida bloquea el editor
  disk: { name: '', state: 'none' }, // carpeta del proyecto en el disco · state: none | saved | saving | dirty | error
  godotName: '', // carpeta del proyecto Godot para exportar
  eventEditId: null, // evento abierto en el editor de eventos (o «db:commonEvents:id»)
  docsWin: null, // ventana Ayuda ▸ Documentación abierta: { page, hash } (docs/*.md)
  locWin: null, // ventana de Localización abierta: { focus: clave a mostrar } (i18n/localization.js)
  eventReturn: null, // ventana a la que volver al cerrar el editor de eventos
  dbUi: { section: 'actors', id: 1 }, // selección en la base de datos
  migration: null, // informe de la última migración del formato del Runtime: { name, report, backup, source } (ventana «Proyecto actualizado»)
  gameExport: { busy: false, phase: '', done: 0, total: 0, result: null, error: '', diagnostics: { devtools: false, stats: false } }, // exportación del juego a AppImage
  sceneSel: false, // «Escena» seleccionada (como en Unity): el Inspector muestra sus ajustes
  shaderEditId: null, // shader (.glsl) abierto en el editor de shaders
  uiGalleryFolder: 'Assets/UI',
  temporalSelection: null, // {kind, resourceId, element, trackId?, itemId?}: selección editorial del Inspector
  temporalEditRevision: 0, // notifica al preview tras una edición realizada desde el Inspector
  temporalSeek: null, // orden de mover el cabezal del editor temporal correspondiente
  cinematicId: null, // película importada seleccionada en Cinematics (solo estado editorial)
  timelineId: null, // timeline abierto en el editor
  animId: null, // animación abierta en el editor
  animRoot: null, // nodo raíz de la vista previa de animación
  uiEditId: null, // interfaz (.ui) abierta en el editor de interfaces
  scriptEditId: null, // script del proyecto abierto en el editor de scripts
  scriptRenameId: null, // recurso recién creado desde comandos: Assets activa su renombrado
  gameView: { on: false, noCamera: false }, // vista previa editorial, independiente de la sesión de juego
  // estado del modo Jugar (lo escribe play.js y lo dibuja PlayHud.vue)
  play: { on: false, focus: false, dialog: null, choices: null, prompt: '', fade: { color: '#000000', alpha: 0, ms: 0 }, notes: [], errors: 0, throwCharge: 0 },
})

watch(() => store.project, () => { store.audioInspector = null; store.temporalSelection = null; store.temporalSeek = null })
watch(() => store.projSel, (selection) => {
  store.temporalSelection = null
  if (selection) store.audioInspector = null
})
watch(() => store.selectedId, (id, previous) => {
  if (!id || id === previous) return
  store.temporalSelection = null
  if (store.projSel) store.projSel = null
})
watch(() => [store.sceneSel, store.terrainSel], ([scene, terrain]) => { if (scene || terrain) store.temporalSelection = null })

watch(() => store.prefs, (p) => {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)) } catch { /* sin almacenamiento */ }
}, { deep: true })

export function setEditor(editor) {
  store.editor = editor ? markRaw(editor) : null
}

// ---------- notificaciones ----------
/** Nether Film Maker (store.filmMode): la película AJUSTA lo que existe; añadir o quitar objetos se hace en Century. */
export function filmBlocked() { toast('En Nether Film Maker no se añaden ni se borran objetos: hazlo en Century y sustituye la escena', 'error', 4500); return null }
export function toast(msg, kind = 'info', ms = 2600) {
  const t = { id: uid('t'), msg, kind }
  store.toasts.push(t)
  setTimeout(() => {
    const i = store.toasts.findIndex((x) => x.id === t.id)
    if (i >= 0) store.toasts.splice(i, 1)
  }, ms)
}

/** Copia profunda por JSON (datos del proyecto). */
export const clone = (o) => JSON.parse(JSON.stringify(o))

/** Selección contextual no serializada: el mismo Inspector sirve a Assets y a los editores temporales. */
export function selectTemporal(kind, resourceId, element = 'resource', trackId = null, itemId = null, keyRefs = null, timelineMode = null) {
  if (!['timeline', 'animation'].includes(kind) || !resourceId) return
  store.temporalSelection = { kind, resourceId, element, trackId, itemId,
    ...(kind === 'timeline' && element === 'key' && Array.isArray(keyRefs) && keyRefs.length > 1
      ? {keyRefs:keyRefs.map(({tr,k}) => ({tr,k}))} : {}),
    ...(kind === 'timeline' && element === 'clip' && ['mix','ripple','replace'].includes(timelineMode) ? {timelineMode}: {}) }
  store.prefs.rightTab = 'object'
  if (store.ui?.mode === 'desktop') store.prefs.rightOpen = true
  else if (store.ui) store.ui.drawer = 'inspector'
}
export function clearTemporal(kind = null, resourceId = null) {
  const s = store.temporalSelection
  if (s && (!kind || s.kind === kind) && (!resourceId || s.resourceId === resourceId)) store.temporalSelection = null
}

export const editorSettings = () => mergeEditorSettings(store)
export const treeNodeOpen = o => Object.hasOwn(store.treeState.open, o.id) ? store.treeState.open[o.id] : !!o.open
export const setTreeNodeOpen = (o, open) => setWorkspaceTreeOpen(store, o, open)
