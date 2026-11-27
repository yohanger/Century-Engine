// Proyecto: guardado, disco, VS Code, escenas (pestañas), archivo .lfproj
import { askConfirm, askChoice, askCloseDecision, askRecoveryDecision } from '../dialogs.js'
import { reactive } from '@vue/reactivity'
import * as db from '../db.js'
import { normalizeRender, rendererPreset } from '../../engine/runtime/render/config.js'
import { uid, b64ToBytes, downloadBlob, slug, pickFile } from '../../engine/runtime/util.js'
import { Terrain } from '../../engine/runtime/geometry/terrain.js'
import { createProjectData, createSceneContent, splitProject, migrateRecord, migrateScene, validateSignalConnections, ensureFs, addFolderChain, allEntries, uniqueFileName, uniqueSceneName, sanitizeName, normFolder, resolveScenePlayerNode, ROOT_FOLDER } from '../project.js'
import { decodeNativeFilm, encodeNativeFilm } from '../cinematic-resource.js'
import { buildLfproj, parseLfproj } from '../lfproj.js'
import { buildLevelPackage, resolveLevelPackageSelection } from '../levelpackage.js'
import { readLevelPackage, planLevelPackageImport } from '../levelpackage-import.js'
import * as disk from '../disk.js'
import { store, toast, clone } from './state.js'
import { markDirty, commit, resetHistory, configureHistory, cancelPendingAutosave } from './history.js'
import { syncPieces } from './terrain.js'
import { loadNavCache } from './nav.js'
import { syncPrefabInstances } from './prefabs.js'
import { prepareEditorSceneInstances, sceneInstanceUsage } from './scene-instances.js'
import { authoredSceneTree } from '../../engine/runtime/scene/instances.js'
import { loc } from './localization.js'
import { applyCaptureClips } from './capture.js'
import { discoverNodeMethods, discoverNodeSignals, nodeScriptIds, buildNodeCallbackCode } from '../../engine/runtime/scene/node-scripts.js'
import { getNativeSignal } from '../../engine/runtime/nodes/registry.js'
import { upgradeFormat } from '../../engine/runtime/format.js'
import { EditorCameraViews } from './editor-camera-views.js'
import { EditorWorkspaceState, normalizeWorkspace, normalizeSceneWorkspace, workspaceSelection, workspaceTabs, encodeCameraView } from './editor-workspace.js'
import { selectObject } from './objects.js'
import { SCENE_FADE_DEFAULTS } from '../../engine/runtime/events/scene-transitions.js'
import { sceneGameConfig } from '../../engine/runtime/game-manager.js'
import { projectLoading, withProjectLoading } from '../editor/project-loading.js'

// Conexiones visuales: una sola fuente de autoría en la escena activa; nunca activar en Edit Mode.
function applyEditedSignalConnections(next, label) {
  if (!store.project || store.locked || store.play.on || store.edit.on || store.paint.on) throw new Error('No se pueden editar conexiones en el modo actual')
  validateSignalConnections(next)
  store.project.signalConnections = next
  commit(label)
}

/** Crea una conexión editorial sin interpretar ni ejecutar scripts del usuario. */
export function addSceneSignalConnection({ emitterId, signal, receiverId, method }) {
  const p = store.project
  const ids = new Set((p?.objects || []).map((o) => o.id))
  if (!ids.has(emitterId) || !ids.has(receiverId)) throw new Error('El emisor y el receptor deben existir en esta escena')
  const previous = p.signalConnections || []
  const next = { id: uid('sig'), emitterId, signal: signal?.trim(), receiverId, method: method?.trim() }
  // Comprobar todo el conjunto antes de modificar el proyecto.
  validateSignalConnections([...previous, next])
  applyEditedSignalConnections([...previous, next], 'Conectar señal')
  return next.id
}

export function editSceneSignalConnection(id, { emitterId, signal, receiverId, method }) {
  const p = store.project
  const previous = p?.signalConnections || []
  const index = previous.findIndex((c) => c.id === id)
  if (index < 0) throw new Error('Conexión inexistente en la escena activa')
  const ids = new Set((p?.objects || []).map((o) => o.id))
  if (!ids.has(emitterId) || !ids.has(receiverId)) throw new Error('El emisor y el receptor deben existir en esta escena')
  const next = [...previous]
  next[index] = { ...previous[index], emitterId, signal: signal?.trim(), receiverId, method: method?.trim() }
  validateSignalConnections(next)
  applyEditedSignalConnections(next, 'Editar conexión de señal')
}

export function removeSceneSignalConnection(id) {
  const previous = store.project?.signalConnections || []
  if (!previous.some((c) => c.id === id)) return false
  applyEditedSignalConnections(previous.filter((c) => c.id !== id), 'Desconectar señal')
  return true
}

/** No hay CAS atómico con el archivo de VS Code. Fallar cerrado ante sincronización activa. */
export function callbackGenerationBlockReason(scriptId) {
  if (!store.project || store.locked || store.play.on || store.edit.on || store.paint.on)
    return 'La escena no está disponible para edición'
  if (projLoc?.kind === 'path' || vsc?.active)
    return 'Sincronización con archivos externos: generar manualmente para no sobrescribir cambios de VS Code'
  if (store.scriptEditId === scriptId)
    return 'Cierra el editor de este script antes de generar; el buffer abierto no se sobrescribirá'
  return ''
}
/** Una sola operación reversible para callback y conexión, sin commits intermedios. */
export function createSceneSignalCallback({ emitterId, signal, receiverId, scriptId, method, expectedCode }) {
  const reason = callbackGenerationBlockReason(scriptId)
  if (reason) throw new Error(reason)
  const p = store.project
  const emitter = p.objects.find(o => o.id === emitterId)
  const receiver = p.objects.find(o => o.id === receiverId)
  if (!emitter || !receiver || store.selectedId !== emitterId || store.selectedIds.length > 1 || !nodeScriptIds(receiver).includes(scriptId)) throw new Error('Emisor, receptor o asociación de script cambiaron')
  const script = p.scripts.find(s => s.id === scriptId && s.execution === 'node')
  if (!script || typeof expectedCode !== 'string' || script.code !== expectedCode)
    throw new Error('El código del script cambió desde que se preparó el callback')
  const meta = getNativeSignal(emitter.type, signal)
  const custom = discoverNodeSignals(emitter, p.scripts).signals.find(x => x.name === signal && !x.nativeCollision && !x.duplicate)
  if (!meta && !custom) throw new Error('La señal emisora ya no está disponible')
  const existing = discoverNodeMethods(receiver, p.scripts)
  if (existing.diagnostics.some(d => d.kind === 'dynamic' || d.kind === 'missing' || d.kind === 'association') ||
      existing.methods.some(m => m.name === method || m.duplicate || m.reserved))
    throw new Error('Métodos ambiguos, reservados o ya publicados; usar edición manual')
  const reserved = new Set(['await','break','case','catch','class','const','continue','debugger','default','delete','do','else','enum','export','extends','false','finally','for','function','if','import','in','instanceof','new','null','return','super','switch','this','throw','true','try','typeof','var','void','while','with','yield'])
  if (reserved.has(method)) throw new Error('Nombre de callback reservado por JavaScript')
  const args = meta ? (meta.args || []).map(a => a.name) : []
  const nextCode = buildNodeCallbackCode(script.code, method, args)
  const link = { id: uid('sig'), emitterId, signal, receiverId, method }
  const nextLinks = [...(p.signalConnections || []), link]
  validateSignalConnections(nextLinks)
  // Sin await ni turno de eventos entre el preflight y el commit.
  p.signalConnections = nextLinks
  script.code = nextCode
  commit('Generar callback de señal', { scriptDelta: {scriptId, receiverId, before:expectedCode, after:nextCode} })
  return { id:link.id, scriptId }
}

//  PROYECTO · ESCENAS · GUARDADO
// =====================================================================
const editorCameraViews = new EditorCameraViews()
let sceneTransition = false
const workspaceStorage = new EditorWorkspaceState({
  getItem: key => globalThis.localStorage.getItem(key),
  setItem: (key, value) => globalThis.localStorage.setItem(key, value),
  removeItem: key => globalThis.localStorage.removeItem(key),
})
let workspaceSession = null, workspaceTimer = null, workspaceProject = null
const defaultAids = { showGizmos: store.prefs.showGizmos !== false, orientGizmo: store.prefs.orientGizmo !== false, gizmoCategories: { ...store.prefs.gizmoCategories }, colliderPreview: true }
function temporaryWorkspace() {
  const ed = store.editor
  return store.play.on || ed?.player?.session?.saved || store.gameView.on || ed?._cameraPilot || ed?.vp?.world?.visible === false || store.filmMode
}
function captureWorkspaceScene(p) {
  const id = p.activeSceneId, ed = store.editor
  const view = ed.meshLocalSavedView?.() || ed.vp.saveEditorView()
  if (encodeCameraView(view)) editorCameraViews.capture(p.id, id, ed)
  const previous = workspaceSession.scenes[id]
  const tree = { ...store.treeState, open: Object.fromEntries(p.objects.filter(o=>Object.hasOwn(store.treeState.open,o.id)).map(o=>[o.id,store.treeState.open[o.id]])) }
  workspaceSession.scenes[id] = normalizeSceneWorkspace({ camera: editorCameraViews.serialized(id) || previous?.camera,
    selectedIds: store.selectedIds, selectedId: store.selectedId, sceneSel: store.sceneSel, tree, mode: store.view.mode })
}
export function persistEditorWorkspace() {
  const p = store.project
  if (!p || store.locked || !store.editor || workspaceProject !== p.id || !workspaceSession || sceneTransition || temporaryWorkspace()) return false
  captureWorkspaceScene(p)
  const valid = new Set(p.scenes.map(s=>s.id))
  for (const id of Object.keys(workspaceSession.scenes)) if (!valid.has(id)) delete workspaceSession.scenes[id]
  Object.assign(workspaceSession, { activeSceneId:p.activeSceneId, tabs:[...openSceneIds()], gizmo:store.gizmo, space:store.space,
    snap:store.editorSnap, view:store.view, folder:store.projFolder, aids:{showGizmos:store.prefs.showGizmos,orientGizmo:store.prefs.orientGizmo,gizmoCategories:store.prefs.gizmoCategories,colliderPreview:store.colliderPreview} })
  return workspaceStorage.write(p.id,workspaceSession)
}
function restoreWorkspaceScene(p, id) {
  const saved = normalizeSceneWorkspace(workspaceSession?.scenes[id])
  const valid = new Set(p.objects.map(o=>o.id))
  store.treeState = { ...saved.tree, open: Object.fromEntries(Object.entries(saved.tree.open).filter(([key])=>valid.has(key))) }
  store.view.mode = saved.mode
  const sel = workspaceSelection(saved,p.objects)
  selectObject(null,{range:sel.selectedIds})
  if (sel.selectedId && store.selectedId !== sel.selectedId) { store.selectedId=sel.selectedId; store.editor.setSelection(sel.selectedId,sel.selectedIds) }
  store.sceneSel = sel.sceneSel
  if (sel.selectedId || sel.sceneSel) store.prefs.rightTab = 'object'
  if (saved.camera?.persp?.fovSpec?.axis === 'horizontal') store.prefs.editorFov = saved.camera.persp.fovSpec.value
  store.editor.applyView()
}
function beginWorkspace(p, saved) {
  clearInterval(workspaceTimer)
  if (store.filmMode) {
    editorCameraViews.beginProject(p.id,store.editor)
    store.projFolder=ROOT_FOLDER
    store.editorSnap={}
    return
  }
  workspaceProject=p.id
  workspaceSession=normalizeWorkspace(saved)
  const ws=workspaceSession
  const aids={...defaultAids,...(saved?ws.aids:{})}
  Object.assign(store.view,ws.view)
  store.gizmo=ws.gizmo; store.space=ws.space; store.editorSnap=ws.snap
  store.prefs.showGizmos=aids.showGizmos; store.prefs.orientGizmo=aids.orientGizmo
  store.prefs.gizmoCategories={...aids.gizmoCategories}; store.colliderPreview=aids.colliderPreview
  store.projFolder=p.folders.includes(ws.folder)?ws.folder:ROOT_FOLDER
  sceneTabs.pid=p.id; sceneTabs.ids=workspaceTabs(ws.tabs,p.scenes,p.activeSceneId)
  editorCameraViews.beginProject(p.id,store.editor,ws.scenes)
  editorCameraViews.restore(p.id,p.activeSceneId,store.editor)
  restoreWorkspaceScene(p,p.activeSceneId)
  store.editor.syncSettings()
  store.editor.applyView()
  workspaceTimer=setInterval(()=>{if (!projectLoading.value) persistEditorWorkspace()},2000)
}
function stopWorkspace() { clearInterval(workspaceTimer); workspaceTimer=null; workspaceProject=null; workspaceSession=null }


export const activeScene = () => store.project?.scenes.find((s) => s.id === store.project.activeSceneId) || null

/** Identidad del personaje controlado: exclusiva de la escena activa, sin efecto sobre PlayMode en G001. */
export function assignScenePlayerNode(id) {
  const scene = activeScene(), project = store.project
  if (!scene || store.locked || store.play?.on || store.filmMode || typeof id !== 'string') return false
  if (id && scene.playerSpawnMode === 'api') return false
  if (id && resolveScenePlayerNode({ playerNodeId: id }, project.objects).status !== 'valid') return false
  if ((scene.playerNodeId || '') === id) return true
  scene.playerNodeId = id
  commit('Asignar personaje de escena')
  return true
}


/** Configuración explícita; no cambia la semántica de escenas sin este campo. */
export function assignScenePlayerSpawnMode(mode) {
  const scene = activeScene(), project = store.project
  if (!scene || store.locked || store.play?.on || store.filmMode || !['node', 'api'].includes(mode)) return false
  if (mode === 'api' && (scene.playerNodeId || sceneGameConfig(project).config.player === 'none')) return false
  const next = mode === 'api' ? 'api' : undefined
  if (scene.playerSpawnMode === next) return true
  if (next) scene.playerSpawnMode = next
  else delete scene.playerSpawnMode
  commit('Modo de aparición de jugador')
  return true
}

/** { meta, scene } listos para guardar: la escena activa con su terreno serializado. */
export function serializeProject() {
  const { meta, scene } = splitProject(store.project, store.editor.serializeTerrain())
  // Los objetos trasladados por DontDestroyOnLoad no se guardan en la escena visitada.
  const injected = store.editor?.player?.on && store.editor.player._persistInjected
  if (injected?.size) scene.objects = [
    ...scene.objects.filter((o) => !injected.has(o.id)),
    ...(store.editor.player._persistBackup?.values() || []),
  ]
  Object.assign(scene, authoredSceneTree(scene))
  meta.updatedAt = Date.now()
  const s = meta.scenes.find((x) => x.id === meta.activeSceneId)
  if (s) s.count = scene.objects.length
  return { meta, scene }
}

let lastThumb = 0
// Los guardados se encadenan: uno nuevo nunca se solapa con otro en curso (evitaba que un guardado con datos viejos
// reescribiera una escena recién borrada o los metadatos anteriores).
let saveChain = Promise.resolve()
// Coordina también las transacciones de recursos Cinematic con el autoguardado del proyecto.
export function queueProjectPersistence(action) {
  const task = saveChain.then(action, action)
  saveChain = task.catch(() => {})
  return task
}
export function saveNow(opts = {}) {
  return queueProjectPersistence(() => saveNowImpl(opts))
}
async function saveNowImpl({ thumb = false } = {}) {
  if (!store.project || !store.editor || store.locked) return false
  const revision = store.pendingRevision
  store.saveState = 'saving'
  try {
    store.editor.flushEdit?.()
    const preview = store.editor.streamingPreview
    if (preview?.pending.has(store.project.id)) await preview.flush(store.project.id)
    const { meta, scene } = serializeProject()
    // la miniatura obliga a leer píxeles de la GPU: solo cada 2 min o al cerrar/cambiar de proyecto
    const wantThumb = !store.edit.localView && (thumb || Date.now() - lastThumb > 120000)
    const img = wantThumb ? store.editor.thumbnail() : undefined
    if (wantThumb) lastThumb = Date.now()
    await db.saveScene(meta.id, meta.activeSceneId, scene)
    await db.saveProject(meta, img)
    // La copia recuperable se obtiene DESPUÉS de que concluya el autoguardado de trabajo.
    // Un fallo de cuota impide afirmar que la sesión está protegida.
    if (store.unsavedChanges) { await pendingWrites; await db.captureRecoveryProject(meta.id) }
    store.project.updatedAt = meta.updatedAt
    const s = activeScene()
    if (s) s.count = scene.objects.length
    if (!String(meta.id).startsWith('nfm_')) db.lastProjectId.set(meta.id)
    store.saveState = store.pendingRevision === revision ? 'saved' : 'dirty'
    // IndexedDB conserva la copia de trabajo. Nunca confirma por sí misma project.lfproj.
    return true
  } catch (err) {
    console.error(err)
    store.saveState = 'dirty'
    toast('No se pudo guardar: ' + err.message, 'error', 5000)
    return false
  }
}

/** Configuración de los tipos de vegetación (sin las instancias) de un terreno serializado. */
export const foliageCfgs = (t) => (t.foliage || []).map(({ data, ...c }) => clone(c))

function exitEdit() { store.editor?.exitEditMode?.({ silent: true }) }

let editorWorkspace = null
export function configureEditorWorkspace(workspace) { editorWorkspace = workspace }

/** Monta en memoria un proyecto (meta + escena activa). `assets` = binarios de modelos para el editor. */
async function installProject(meta, sceneData, assets, { report, workspace = null } = {}) {
  stopWorkspace()
  projLoc = null; godotLoc = null
  store.timelineId = null; store.animId = null; store.animRoot = null; store.temporalSelection = null; store.temporalSeek = null
  vsc?.stop()
  store.disk.name = ''; store.disk.state = 'none'; store.godotName = ''
  exitEdit()
  migrateScene(sceneData)
  const t = sceneData.terrain
  const project = {
    ...clone(meta),
    objects: clone(sceneData.objects || []),
    environment: clone(sceneData.environment),
    signalConnections: clone(sceneData.signalConnections),
    terrain: { size: t.size, segments: t.segments, layers: clone(t.layers), foliage: foliageCfgs(t), enabled: t.enabled !== false },
  }
  ensureFs(project)
  Object.assign(project, await prepareEditorSceneInstances(project, project, project.activeSceneId))
  await report?.('terrain')
  await editorWorkspace?.mount()
  await store.editor.loadProject({ terrain: t, settings: project.settings }, assets, project.models,
    report && ((done, total) => report('models', done, total)), project)
  await report?.('finish')
  store.eventEditId = null
  store.eventReturn = null
  store.scriptEditId = null
  if (store.modal === 'event' || store.modal === 'script') store.modal = null
  store.project = project
  applyCaptureClips()
  syncPieces()
  resetSceneState({ frame: false })
  if (!String(project.id).startsWith('nfm_')) db.lastProjectId.set(project.id)
  store.projSel = null
  const confirmed = await db.getConfirmedProject(project.id)
  store.unsavedChanges = !!confirmed?.dirty
  store.pendingRevision = 0
  store.saveState = confirmed?.dirty ? 'dirty' : 'saved'
  if ((await db.loadProject(project.id)) && !confirmed) await db.ensureConfirmedProject(project.id)
  store.locked = false
  beginWorkspace(store.project,workspace)
}

function resetSceneState({ frame = true } = {}) {
  syncPrefabInstances({ silent: true }) // instancias de esta escena al día con sus prefabs
  store.selectedId = null
  store.selectedIds = []
  store.tool = 'select'
  store.editor.syncAll()
  store.editor.syncEnvironment()
  store.editor.setSelection(null, [])
  loadNavCache()
  if (frame) store.editor.frameAll() // no reencuadrar al abrir/cambiar escena: conservar cámara de edición
  resetHistory()
}

/** Terreno inicial (plano) serializado para una escena nueva. */
function blankTerrain(content) {
  const t = new Terrain(content.terrain.size, content.terrain.segments, content.terrain.layers)
  if (content.terrain.enabled === false) { t.enabled = false; t.mesh.visible = false }
  const data = t.serialize()
  t.dispose()
  return data
}

// ---------- proyecto en disco ----------
// El proyecto vive en una carpeta elegida por el usuario (`project.lfproj` dentro). IndexedDB es la copia de trabajo rápida;
// el archivo se reescribe SOLO al guardar explícitamente (Ctrl+S). IndexedDB es autoguardado de trabajo.
export let projLoc = null
let godotLoc = null
// La escritura automática al disco fue retirada: no debe pisar la última versión confirmada.
let pendingWrites = Promise.resolve()
let unconfirmedDiskWrite = null
function recordPending(id) {
  pendingWrites = pendingWrites.catch(() => {}).then(() => db.markProjectPending(id))
  return pendingWrites
}

async function bindLoc(id, loc) {
  projLoc = loc
  store.disk.name = disk.locName(loc)
  store.disk.state = store.unsavedChanges ? 'dirty' : 'saved'
  await db.putLoc('proj:' + id, loc)
  startEditorSync(loc)
}

// ---------- VS Code (módulo del editor, bajo demanda: state/vscode.js) ----------
let vsc = null
let loadingVscode = null
let startingEditorSync = null
const vscode = () => loadingVscode ??= import('./vscode.js')
  .then(module => vsc = module.createVscode({ getLoc: () => projLoc, serializeProject, collectScenes }))
  .catch(err => { loadingVscode = null; throw err })
function startEditorSync(loc) {
  startingEditorSync = vscode()
    .then(v => { if (loc === projLoc) return v.startSync(loc) })
    .catch(err => console.error('VS Code: no se pudo preparar la carpeta del proyecto', err))
  return startingEditorSync
}
/** Abre la carpeta del proyecto y, si se indica, el script de esa misma carpeta. */
export async function insertNodeRefInVSCode(id) {
  try { return await (await vscode()).insertNode(id) }
  catch (error) { toast(error.message, 'error', 6500); return false }
}
export async function openInVSCode(scriptId = null) {
  const loc = projLoc
  const project = store.project
  try {
    const editor = await vscode()
    await startingEditorSync
    if (loc !== projLoc || project !== store.project) throw new Error('El proyecto activo cambió durante la apertura.')
    return await editor.open(scriptId)
  } catch (err) {
    toast('No se pudo abrir VS Code: ' + err.message, 'error', 6000)
    return false
  }
}

/** Archivo .lfproj del proyecto abierto (con todas sus escenas y archivos). */
export async function buildProjectFile() {
  const projectId = store.project.id
  const preview = store.editor.streamingPreview
  if (preview?.pending.has(projectId)) {
    await queueProjectPersistence(() => preview.flush(projectId))
    if (store.project?.id !== projectId) throw new Error('El proyecto activo cambió durante el guardado')
  }
  const { meta, scene } = serializeProject()
  const scenes = await collectScenes(meta, scene)
  const files = new Map()
  for (const e of allEntries(meta)) {
    if (e.kind === 'scene' || e.kind === 'prefab' || e.kind === 'script' || e.kind === 'ui' || e.kind === 'shader' || e.kind === 'vfx' || e.kind === 'liquid') continue
    const a = await db.getAsset(meta.id, e.id)
    if (a) files.set(e.id, new Uint8Array(a.bytes))
  }
  const rec = await db.loadProject(meta.id)
  const { blob, missing } = await buildLfproj({ meta, scenes, files, thumb: rec?.thumb })
  return { blob, missing, meta, files, scenes }
}

/** Exporta una selección de Proyecto y sus dependencias, sin modificar el proyecto abierto. */
export async function exportLevelPackage(selection) {
  if (!store.project || store.locked) return false
  try {
    const { meta, scene } = serializeProject()
    const scenes = await collectScenes(meta, scene)
    const plan = resolveLevelPackageSelection({ meta, scenes, selection })
    const count = plan.entries.length
    const extra = plan.dependenciesAdded
    const timelineWarning = plan.entries.some(e => e.kind === 'timeline') ? ' Los enlaces a nodos de escena y referencias dinámicas deberán revisarse al importar.' : ''
    const withContext = plan.context ? ' Incluye datos compartidos de la escena (eventos, animaciones y configuración).' : ''
    if (!(await askConfirm(`Exportar ${count} recurso(s) (${extra} dependencia(s) añadida(s)).${withContext}${timelineWarning}\n\nNo se modificará el proyecto.`, {
      title: 'Exportar .levelpackage', ok: 'Exportar',
    }))) return false
    const files = new Map()
    for (const e of plan.entries) {
      if (['scene', 'prefab', 'script', 'ui', 'shader', 'profile', 'gamemanager', 'material', 'vfx', 'liquid', 'timeline'].includes(e.kind)) continue
      const asset = await db.getAsset(meta.id, e.id)
      if (!asset?.bytes) throw new Error(`Falta el archivo original: ${e.folder}/${e.file}`)
      files.set(e.id, new Uint8Array(asset.bytes))
    }
    const { blob } = await buildLevelPackage({ meta, scenes, files, selection, plan })
    const label = selection.length === 1 ? plan.entries.find((e) => e.id === selection[0].id)?.name || meta.name : `${meta.name}-seleccion`
    downloadBlob(blob, `${slug(label, 'recursos')}.levelpackage`)
    toast(`Paquete exportado: ${count} recurso(s), ${extra} dependencia(s)`, 'ok', 3500)
    return true
  } catch (err) {
    console.error('No se pudo exportar el .levelpackage', err)
    toast('No se pudo exportar .levelpackage: ' + err.message, 'error', 6000)
    return false
  }
}

/** Previsualiza un paquete sin modificar el proyecto. */
export async function inspectLevelPackage(file) {
  if (store.locked || !store.project) throw new Error('Abre un proyecto antes de importar')
  return readLevelPackage(file)
}

let importingLevelPackage = false
/** Confirma la selección de G002 de manera atómica, sin fusionar configuración global. */
export async function importLevelPackage(packageData, selectedIds, decisions) {
  if (importingLevelPackage || store.locked || !store.project) return false
  importingLevelPackage = true
  const projectId = store.project.id
  try {
    // Garantiza que la escena activa y sus recursos anteriores ya están persistidos.
    await saveNow()
    if (store.saveState !== 'saved') throw new Error('Guarda el proyecto actual antes de importar')
    const { meta } = serializeProject()
    const plan = planLevelPackageImport({
      ...packageData, project: meta, selectedIds, decisions, makeId: uid,
    })
    if (!plan.records.length) throw new Error('No hay recursos nuevos que importar')
    if (plan.context && !(await askConfirm(
      'Este paquete contiene escenas con datos globales (Database, InputMap, animaciones, etc.).\n\n' +
      'Se importarán las escenas y sus recursos, pero NO se sobrescribirán los datos globales del proyecto destino. ' +
      'Los eventos que dependan de esa configuración pueden requerir ajustes manuales. ¿Continuar?',
      { title: 'Contexto compartido de la escena', ok: 'Importar sin fusionar' },
    ))) return false
    if (!(await askConfirm(
      `Importar ${plan.records.length} recurso(s), de los cuales ${plan.scenes.length} son escenas.\n` +
      `Se reutilizarán ${plan.actions.filter((a) => a.action === 'reuse').length} recurso(s) existentes.\n` +
      'Los cambios de archivos NO forman parte del Ctrl+Z del Editor.\n\n¿Confirmar importación?',
      { title: 'Importar .levelpackage', ok: 'Importar' },
    ))) return false
    for (const record of plan.records) {
      if (!Array.isArray(meta[record.collection])) meta[record.collection] = []
      meta[record.collection].push(record.ref)
      addFolderChain(meta, record.ref.folder)
    }
    if (store.project?.id !== projectId) throw new Error('El proyecto cambió durante la importación')
    // Commit único (proyecto, escenas y binarios). El estado en memoria se actualiza SOLO al completarse.
    await db.saveLevelPackageImport(meta, plan.scenes, plan.assets)
    for (const key of ['scenes', 'prefabs', 'models', 'scripts', 'uis', 'shaders', 'profiles', 'materials', 'gameManagers', 'vfx', 'liquids', 'assets', 'folders']) {
      store.project[key] = meta[key]
    }
    // Los nuevos modelos quedan disponibles para colocar desde Proyecto.
    for (const asset of plan.assets) {
      if (plan.records.some((r) => r.collection === 'models' && r.ref.id === asset.id)) {
        try { await store.editor.registerModel(asset.id, asset.bytes.buffer.slice(asset.bytes.byteOffset, asset.bytes.byteOffset + asset.bytes.byteLength), asset.name) }
        catch (err) { console.warn('Modelo importado; vista previa pendiente:', asset.name, err) }
      }
    }
    markDirty()
    toast(`.levelpackage: ${plan.records.length} recurso(s) importado(s)`, 'ok', 4500)
    for (const w of plan.warnings) console.warn('LevelPackage:', w)
    return true
  } catch (err) {
    console.error('Fallo de importación .levelpackage', err)
    toast(`No se pudo importar .levelpackage: ${err.message}`, 'error', 6500)
    return false
  } finally { importingLevelPackage = false }
}

/** Escribe el proyecto en su carpeta. Devuelve true si se guardó. Las escrituras no se solapan: si llega otra mientras
 *  se escribe, se repite una vez al terminar con el estado más reciente. */
let flushing = null
let flushAgain = false
export function flushDisk() {
  if (!store.project || store.locked || !projLoc) return Promise.resolve(false)
  if (flushing) { flushAgain = true; return flushing }
  flushing = (async () => {
    let ok = false
    do { flushAgain = false; ok = await flushDiskOnce() } while (flushAgain && ok)
    return ok
  })().finally(() => { flushing = null })
  return flushing
}

async function flushDiskOnce() {
  const loc = projLoc
  store.disk.state = 'saving'
  try {
    store.editor.flushEdit?.()
    const { blob, meta, scenes, missing } = await buildProjectFile()
    if (missing.length) throw new Error(`Faltan ${missing.length} recursos en el proyecto` )
    await disk.writeFiles(loc, new Map([['project.lfproj', new Uint8Array(await blob.arrayBuffer())]]))
    unconfirmedDiskWrite = meta.id
    try { const v = await vscode(); await v.writeEditorFiles(loc, meta, scenes); await v.flush() } catch (err) { console.error('VS Code:', err) } // los archivos de VS Code nunca hacen fallar el guardado del proyecto
    if (loc === projLoc && !flushAgain) store.disk.state = 'saved'
    return true
  } catch (err) {
    console.error(err)
    store.disk.state = 'error'
    toast('No se pudo escribir el proyecto en el disco: ' + err.message, 'error', 6000)
    return false
  }
}

/** Persistencia estructural en la copia de trabajo; NO confirma el archivo del disco. */
export async function persistNow() { return saveNow() }

/** Guardado explícito: confirma el disco y el punto de restauración, o devuelve false. */
export async function saveAll() {
  const id = store.project?.id
  if (!id || store.locked) return false
  const loc = projLoc
  if (loc) {
    await startingEditorSync
    if (loc !== projLoc || store.project?.id !== id) return false
    // Recibe el guardado externo antes de serializar el proyecto y tomar su revisión.
    await vsc?.flush({ force: true })
    if (loc !== projLoc || store.project?.id !== id) return false
  }
  const revision = store.pendingRevision
  if (!(await saveNow({ thumb: true }))) return false
  await pendingWrites
  if (projLoc) {
    if (!(await flushDisk())) return false
  } else if (disk.canDisk()) {
    toast('Este proyecto aún no está en una carpeta: elige dónde guardarlo', 'info', 3000)
    if (!(await attachFolder({ confirm: false }))) return false
  }
  if (store.project?.id !== id || store.pendingRevision !== revision) {
    toast('Hubo cambios durante el guardado. Vuelve a guardar antes de salir.', 'error', 5000)
    return false
  }
  try {
    await db.confirmProject(id)
    await db.consumeRecoveryProject(id)
    if (unconfirmedDiskWrite === id) unconfirmedDiskWrite = null
    store.unsavedChanges = false
    store.saveState = 'saved'
    if (projLoc) store.disk.state = 'saved'
    if (projLoc) toast('Guardado en ' + store.disk.name, 'ok', 1600)
    else toast('Guardado', 'ok', 1200)
    return true
  } catch (err) {
    toast('No se pudo confirmar el guardado: ' + err.message, 'error', 6000)
    return false
  }
}

/** Repara una escritura confirmada en disco pero cuyo checkpoint falló después. */
async function restoreConfirmedDisk(id) {
  const checkpoint = await db.getConfirmedProject(id)
  if (!checkpoint?.project) throw new Error('No existe el proyecto anterior confirmado')
  const scenes = new Map(checkpoint.scenes.map((s) => [s.sceneId, { objects: s.objects, environment: s.environment, terrain: s.terrain }]))
  const files = new Map(checkpoint.assets.map((a) => [a.assetId, new Uint8Array(a.bytes)]))
  const { blob, missing } = await buildLfproj({ meta: checkpoint.project, scenes, files, thumb: checkpoint.project.thumb })
  if (missing.length) throw new Error('No puede restablecerse el archivo: faltan recursos anteriores')
  await disk.writeFiles(projLoc, new Map([['project.lfproj', new Uint8Array(await blob.arrayBuffer())]]))
}

/** Solicitud de cierre del proceso principal. El único resultado que autoriza cerrar es «close». */
export async function requestClose() {
  // Una recuperación pospuesta conserva su copia; cerrar sigue el protocolo de G001.
  if (!store.project || store.locked) return 'close'
  try {
    // También se reciben posibles ediciones externas de scripts antes de decidir.
    try { await vsc?.flush({ force: true }) } catch (err) { console.error('VS Code:', err) }
    if (store.unsavedChanges || store.disk.state === 'error') {
      const decision = await askCloseDecision(store.project.name)
      if (decision === 'cancel' || !decision) return 'cancel'
      if (decision === 'discard') {
        store.closeBusy = true
        cancelPendingAutosave()
        // Termina cualquier escritura de trabajo ANTES de restaurar el último estado confirmado.
        await saveChain
        await pendingWrites
        if (flushing) await flushing
        if (unconfirmedDiskWrite === store.project.id && projLoc) await restoreConfirmedDisk(store.project.id)
        await db.restoreConfirmedProject(store.project.id)
        await db.consumeRecoveryProject(store.project.id)
        unconfirmedDiskWrite = null
        store.unsavedChanges = false
        store.disk.state = projLoc ? 'saved' : 'none'
        persistEditorWorkspace()
        return 'close'
      }
      if (decision !== 'save') return 'cancel'
      store.closeBusy = true
      if (!(await saveAll())) return 'cancel'
    } else if (store.saveState !== 'saved') {
      store.closeBusy = true
      if (!(await saveNow())) return 'cancel'
    }
    // Una edición posterior al guardado impide salir hasta resolverla.
    if (store.unsavedChanges || store.saveState !== 'saved') return 'cancel'
    persistEditorWorkspace()
    return 'close'
  } catch (err) {
    console.error('Cierre cancelado:', err)
    toast('No se pudo completar el cierre: ' + err.message, 'error', 6000)
    return 'cancel'
  } finally {
    store.closeBusy = false
  }
}

/** La recuperación debe resolverse antes de abrir cualquier proyecto de la sesión nueva. */
export async function resolveInterruptedRecovery(interrupted = false) {
  if (!store.locked) throw new Error('La recuperación solo puede comenzar en la bienvenida')
  const list = await db.listRecoveryProjects()
  if (!list.length) {
    if (interrupted) toast('Se detectó un cierre inesperado, pero no hay una copia recuperable válida.', 'error', 6500)
    return true
  }
  store.recoveryPending = true
  let resolved = false
  try {
    for (const entry of list) {
      const decision = await askRecoveryDecision(entry)
      if (decision === 'cancel') return false // conserva la copia, no desbloquea el proyecto
      if (decision === 'discard') {
        await db.restoreConfirmedProject(entry.id)
        await db.consumeRecoveryProject(entry.id, entry.token)
        continue
      }
      if (decision !== 'restore' || !entry.valid) return false
      const recoveryToken = await db.restoreRecoveryProject(entry.id)
      // La copia no se consume hasta que el proyecto se haya cargado correctamente.
      if (!(await openProject(entry.id))) throw new Error('No se pudo abrir el proyecto recuperado')
      const previousLoc = await db.getLoc('proj:' + entry.id)
      if (previousLoc) {
        if (await disk.ensurePermission(previousLoc)) await bindLoc(entry.id, previousLoc)
        else toast('La carpeta original requiere permisos; no se sobrescribirán archivos externos.', 'error', 6500)
      }
      await db.consumeRecoveryProject(entry.id, recoveryToken)
      store.unsavedChanges = true
      store.saveState = 'dirty'
      store.disk.state = projLoc ? 'dirty' : 'none'
      toast('Trabajo recuperado. Usa Guardar para confirmar los cambios.', 'ok', 6000)
    }
    resolved = true
    return true
  } catch (err) {
    console.error('Recuperación:', err)
    toast('No se pudo recuperar el proyecto: ' + err.message + '. La copia permanece disponible.', 'error', 9000)
    return false
  } finally {
    // Si alguna decisión queda pendiente, solo se permite la bienvenida.
    // Nunca se abre automáticamente un proyecto en el arranque de recuperación.
    store.recoveryPending = !resolved
  }
}

/** Compatibilidad para llamadas existentes: ya no cierra ni confirma por sí sola. */
export async function closeFlush() { return requestClose() }

/** Para proyectos sin carpeta (creados antes o en navegadores sin acceso al disco): elegir dónde vivirán. */
export async function attachFolder({ confirm = true } = {}) {
  if (!store.project || !disk.canDisk()) return false
  const parent = await disk.pickDirectory({ title: 'Elige la carpeta donde guardar el proyecto «' + store.project.name + '»' })
  if (!parent) return false
  const dir = await disk.subDir(parent, slug(store.project.name, 'proyecto'))
  if (await disk.exists(dir, 'project.lfproj')) {
    toast('Ya existe un proyecto en esa carpeta. Elige una ubicación diferente.', 'error', 5500)
    return false
  }
  await bindLoc(store.project.id, dir)
  if (!(await flushDisk())) return false
  if (confirm) {
    await pendingWrites
    await db.confirmProject(store.project.id)
    await db.consumeRecoveryProject(store.project.id)
    unconfirmedDiskWrite = null
    store.unsavedChanges = false
    store.disk.state = 'saved'
  }
  return true
}

/** Vuelve a la bienvenida y libera la sesión del editor tras guardar su trabajo. */
export async function lockEditor() {
  if (projectLoading.value) return false
  if (!store.locked && store.project) {
    if (store.editor?.player?.on) await store.editor.player.stop()
    await store.editor?.exitPaint?.()
    // Confirmar disco para proyectos con carpeta; los proyectos solo en IndexedDB
    // conservan su flujo anterior, sin forzar un selector de ubicación al salir.
    if (!(projLoc ? await saveAll() : await saveNow({ thumb: true }))) return false
  }
  persistEditorWorkspace()
  stopWorkspace()
  cancelPendingAutosave()
  await pendingWrites
  if (flushing) await flushing
  vsc?.stop()
  projLoc = null
  godotLoc = null
  store.locked = true
  store.project = null
  store.disk.name = ''; store.disk.state = 'none'; store.godotName = ''
  store.unsavedChanges = false; store.pendingRevision = 0; store.saveState = 'saved'
  store.selectedId = null; store.selectedIds = []; store.projSel = null
  store.sceneSel = false; store.terrainSel = false
  store.eventEditId = null; store.eventReturn = null; store.scriptEditId = null
  store.timelineId = null; store.animId = null; store.animRoot = null
  store.shaderEditId = null; store.modal = null; store.menu = null; store.palette = false
  store.ui.drawer = null
  resetHistory()
  editorWorkspace?.unmount()
  return true
}

/** Crea un proyecto nuevo dentro de `parentLoc` (se crea la subcarpeta con su nombre). */
export async function createProject(name, parentLoc, templateId, opts = {}) {
  const nm = (name || '').trim() || 'Proyecto nuevo'
  let dir = null
  if (parentLoc) {
    dir = await disk.subDir(parentLoc, slug(nm, 'proyecto'))
    if (await disk.exists(dir, 'project.lfproj')) throw new Error('Ya existe un proyecto en esa carpeta: ábrelo con «Abrir proyecto»')
  }
  await newProject(nm, templateId, opts)
  if (dir) { await bindLoc(store.project.id, dir); if (!(await flushDisk())) throw new Error('No se pudo crear el archivo del proyecto'); await db.confirmProject(store.project.id); await db.consumeRecoveryProject(store.project.id); unconfirmedDiskWrite = null; store.unsavedChanges = false; store.disk.state = 'saved' }
  await loadGodotLoc()
}

/** Abre el proyecto guardado en una carpeta (lee su project.lfproj). */
export async function openFromFolder(loc) {
  const bytes = await disk.readFile(loc, 'project.lfproj')
  if (!bytes) throw new Error('En esa carpeta no hay un project.lfproj')
  const file = { name: 'project.lfproj', arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) }
  const ok = await openLfproj(file, { onConflict: () => 'replace', backupLoc: loc })
  if (!ok) return false
  await bindLoc(store.project.id, loc)
  await loadGodotLoc()
  return true
}

/** Congela la sincronización externa de scripts antes de tocar archivos con Git.
 * Debe acompañarse de reloadVcsProjectFromDisk() o resumeVcsProjectSync() en error. */
export async function suspendVcsProjectSync(expectedRoot) {
  if (!projLoc || projLoc.kind!=='path' || projLoc.path!==expectedRoot || store.unsavedChanges || store.saveState!=='saved') throw new Error('Guarda y registra los cambios del proyecto antes de continuar')
  await saveChain; await pendingWrites; await startingEditorSync
  if (vsc) { await vsc.flush({force:true}); vsc.stop() }
  if (store.unsavedChanges || store.saveState!=='saved' || store.disk.state!=='saved') throw new Error('La sincronización de scripts creó cambios; guárdalos y registra un commit antes de continuar')
}
export async function resumeVcsProjectSync(expectedRoot) {
  if (projLoc?.kind==='path' && projLoc.path===expectedRoot) await startEditorSync(projLoc)
}

/** Recarga tras un checkout/restauración Git, sin volver a guardar la versión anterior.
 * S03: nunca permitir un autoguardado de IndexedDB que reescriba la revisión restaurada.
 * El backend crea un respaldo antes de tocar el disco; el caller conserva el recibo de recuperación.
 */
export async function reloadVcsProjectFromDisk(expectedRoot) {
  const loc = projLoc
  if (!loc || loc.kind !== 'path' || loc.path !== expectedRoot || !store.project) throw new Error('La carpeta de Git ya no coincide con el proyecto abierto')
  if (store.unsavedChanges || store.saveState !== 'saved' || store.disk.state === 'error') throw new Error('Hay cambios en memoria sin guardar; primero crea un commit')
  await saveChain
  await pendingWrites
  const bytes = await disk.readFile(loc, 'project.lfproj')
  if (!bytes) throw new Error('La revisión restaurada no tiene project.lfproj')
  // Validar formato e identidad antes de cambiar IndexedDB.
  const parsed = await parseLfproj(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength))
  if (parsed.meta.id !== store.project.id || parsed.lost?.length) throw new Error('La revisión no pertenece al mismo proyecto o contiene recursos ausentes')
  const file = {name:'project.lfproj',arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)}
  const ok = await openLfproj(file,{onConflict:()=> 'replace',backupLoc:loc,quiet:true,skipActiveSave:true})
  if (!ok) throw new Error('No se pudo reabrir la revisión restaurada')
  await bindLoc(store.project.id,loc)
  await loadGodotLoc()
  store.unsavedChanges = false
  store.saveState = 'saved'
  store.disk.state = 'saved'
  return true
}

/** Abre un proyecto de la lista de recientes; si no tiene carpeta pide una (es obligatoria). */
export async function openRecent(id) {
  const rec = await db.loadProject(id)
  if (!rec) { toast('El proyecto no existe', 'error'); return false }
  let loc = await db.getLoc('proj:' + id)
  if (loc && !(await disk.ensurePermission(loc))) { toast('Sin permiso para usar la carpeta del proyecto', 'error', 4000); return false }
  if (!loc && disk.canDisk()) {
    const parent = await disk.pickDirectory({ title: 'Elige la carpeta donde guardar «' + rec.name + '»' })
    if (!parent) return false
    loc = await disk.subDir(parent, slug(rec.name, 'proyecto'))
  }
  if (!(await openProject(id, { backupLoc: loc }))) return false
  if (loc) {
    await bindLoc(id, loc)
    if (!(await disk.exists(loc, 'project.lfproj'))) {
      if (!(await flushDisk())) return false
      await db.confirmProject(id)
      await db.consumeRecoveryProject(id)
      unconfirmedDiskWrite = null
      store.unsavedChanges = false; store.disk.state = 'saved'
    }
  }
  await loadGodotLoc()
  return true
}

// ---------- carpeta del proyecto Godot ----------
async function loadGodotLoc() {
  godotLoc = store.project ? await db.getLoc('godot:' + store.project.id) : null
  store.godotName = disk.locName(godotLoc)
}
export const getGodotLoc = () => godotLoc

/** Selector de carpetas del sistema para el proyecto Godot (donde está project.godot). */
export async function chooseGodotFolder() {
  const loc = await disk.pickDirectory({ title: 'Elige la carpeta de tu proyecto Godot (la que contiene project.godot)', id: 'godot-project' })
  if (!loc) return false
  if (!(await disk.exists(loc, 'project.godot')) && !(await askConfirm('Esa carpeta no contiene project.godot.\n\n¿Usarla igualmente?', { title: 'Carpeta Godot' }))) return false
  godotLoc = loc
  store.godotName = disk.locName(loc)
  await db.putLoc('godot:' + store.project.id, loc)
  return true
}

export async function newProject(name, templateId, opts = {}) {
  return withProjectLoading(name, async (report) => {
    persistEditorWorkspace()
    if (store.project) await saveNow({ thumb: true })
    const data = createProjectData(name || 'Nivel nuevo', templateId, opts)
    const { objects, environment, terrain, ...meta } = data
    meta.scenes[0].count = objects.length
    await installProject(meta, { objects, environment, terrain: blankTerrain(data) }, [], { report })
    if (!(await saveNow({ thumb: true }))) throw new Error('No se pudo guardar el nuevo proyecto')
    await db.confirmProject(store.project.id)
    await db.consumeRecoveryProject(store.project.id)
    unconfirmedDiskWrite = null
    store.unsavedChanges = false
    toast(`Proyecto «${data.name}» creado`, 'ok')
  })
}

/** Lee un registro de la base (v2 o v3) y devuelve { meta, scene } con la escena activa. */
async function readProject(id, { workspace = null } = {}) {
  const rec = await db.loadProject(id)
  if (!rec) return null
  const { meta, scene: inline } = migrateRecord(rec)
  const migration = upgradeFormat(meta) // formato de datos del Runtime (engine/runtime/format.js)
  let scene = inline
  const preferred = workspace?.activeSceneId
  if (!inline && preferred && preferred !== meta.activeSceneId && meta.scenes.some(s=>s.id===preferred)) {
    const previous = await db.loadScene(id,preferred)
    if (previous) { meta.activeSceneId=preferred; scene=previous }
  }
  if (!scene) {
    const r = await db.loadScene(id, meta.activeSceneId)
    if (!r) throw new Error('No se encontró la escena activa del proyecto')
    scene = { objects: r.objects, environment: r.environment, terrain: r.terrain, signalConnections: r.signalConnections }
  }
  return { meta, scene, migration }
}

// ---------- migración del formato del Runtime (v1 → v2): copia de seguridad + informe ----------
export const BACKUP_V1 = 'project.lfproj.bak-v1'
/** Guarda en la carpeta del proyecto la copia del .lfproj anterior a la migración. Nunca pisa una copia que ya exista. */
async function backupBeforeMigration(loc, bytes) {
  if (!loc) return null
  try {
    if (await disk.exists(loc, BACKUP_V1)) return BACKUP_V1
    const data = bytes || (await disk.readFile(loc, 'project.lfproj'))
    if (!data) return null
    await disk.writeFiles(loc, new Map([[BACKUP_V1, data]]))
    return BACKUP_V1
  } catch (err) { console.error('Copia de seguridad:', err); return null }
}
/** Deja el informe en `store.migration` y abre la ventana si hubo algo reescrito o que revisar. */
function announceMigration(migration, { name, source, backup }) {
  if (!migration?.upgraded) return
  store.migration = { name, source, backup, report: migration }
  if (migration.changed) store.modal = 'migration'
}

export async function openProject(id, { backupLoc = null } = {}) {
  return withProjectLoading('', async (report, setName) => {
    persistEditorWorkspace()
    if (store.project && store.project.id !== id) await saveNow({ thumb: true })
    const workspace=workspaceStorage.read(id)
    const r = await readProject(id,{workspace})
    if (!r) { toast('El proyecto no existe', 'error'); return false }
    setName(r.meta.name)
    const ids = new Set(r.meta.models.map((m) => m.id))
    const assets = (await db.listAssets(id)).filter((a) => ids.has(a.assetId))
    const backup = r.migration.rewritten.length ? await backupBeforeMigration(backupLoc) : null // antes de que nada pise el archivo del disco
    await installProject(r.meta, r.scene, assets, { report, workspace })
    if (r.migration.upgraded) { await saveNow(); announceMigration(r.migration, { name: r.meta.name, source: 'navegador', backup }) }
    return true
  })
}

/** Cambia el método de renderizado del proyecto (Forward+ / Mobile / Compatibility): sustituye los ajustes de render por los del método. */
export function setRenderMethod(id) {
  const p = store.project
  if (!p) return
  store.view.renderMethod = ''
  store.view.mode = 'lit' // cada proyecto arranca sin instrumentación editorial
  const prev = p.render
  p.render = normalizeRender({
    ...rendererPreset(id), backend: prev?.backend,
    resScale: prev?.resScale, spatialReconstruction: prev?.spatialReconstruction,
    psx: prev?.psx === true, psxHeight: prev?.psxHeight ?? 240, psxSnap: prev?.psxSnap ?? 0, psxContinuous: prev?.psxContinuous === true, psxAffine: prev?.psxAffine === true,
    staticOcclusion: prev?.staticOcclusion === true, environmentLook: prev?.environmentLook === true,
    meshErrorLod: prev?.meshErrorLod === true, clusterGeometry: prev?.clusterGeometry === true,
    indirectProbeGrid: prev?.indirectProbeGrid === true, indirectProbeCoverage: prev?.indirectProbeCoverage, worldRayBounce: prev?.worldRayBounce === true, worldRayBounceCount: prev?.worldRayBounceCount,
    worldRayReflection: prev?.worldRayReflection, worldRayReflectionDistance: prev?.worldRayReflectionDistance,
  })
  commit('Método de renderizado')
}

export async function duplicateProject(id) {
  const r = await readProject(id)
  if (!r) { toast('No se encontró el proyecto que deseas duplicar', 'error'); return false }
  const rec = await db.loadProject(id)
  const newId = uid('p')
  const meta = { ...r.meta, id: newId, name: r.meta.name + ' (copia)', createdAt: Date.now(), updatedAt: Date.now() }
  // las demás escenas viven en su propio registro
  for (const s of meta.scenes) {
    if (s.id === meta.activeSceneId) await db.saveScene(newId, s.id, r.scene)
    else { const x = await db.loadScene(id, s.id); if (x) await db.saveScene(newId, s.id, { objects: x.objects, environment: x.environment, terrain: x.terrain, signalConnections: x.signalConnections }) }
  }
  await db.saveProject(meta, rec?.thumb)
  for (const a of await db.listAssets(id)) await db.putAsset(newId, a.assetId, a.name, a.bytes)
  toast('Proyecto duplicado', 'ok')
  return true
}

export async function renameProject(name) {
  if (!store.project) return
  store.project.name = name.trim() || 'Sin nombre'
  commit('Renombrar proyecto')
}

/** Un proyecto abierto no se puede eliminar. La pantalla de bienvenida usa store.locked. */
export function isProjectOpen(id) {
  return !!id && !store.locked && store.project?.id === id
}

export async function removeProject(id) {
  // Hay que comprobarlo antes de borrar los registros, no después.
  if (isProjectOpen(id)) {
    toast('Primero cambia a otro proyecto antes de eliminar el que está abierto', 'warn')
    return false
  }
  if (!id) return false
  await db.deleteProject(id)
  workspaceStorage.forget(id)
  return true
}

// ---------- escenas ----------
// Pestañas abiertas: las escenas siguen en el proyecto (panel Proyecto) aunque su pestaña esté cerrada; abrirla la devuelve.
const sceneTabs = reactive({ pid: '', ids: [] })
/** Escenas con pestaña abierta, en orden. Un proyecto recién abierto las muestra todas. */
export function openSceneIds() {
  const p = store.project
  if (!p) return []
  if (sceneTabs.pid !== p.id) { sceneTabs.pid = p.id; sceneTabs.ids = p.scenes.map((s) => s.id) }
  const ids = sceneTabs.ids.filter((id) => p.scenes.some((s) => s.id === id))
  if (ids.length !== sceneTabs.ids.length) sceneTabs.ids = ids
  if (!ids.includes(p.activeSceneId)) sceneTabs.ids = [...ids, p.activeSceneId]
  return sceneTabs.ids
}
function showSceneTab(id) { if (!openSceneIds().includes(id)) sceneTabs.ids = [...sceneTabs.ids, id] }
/** Cierra la pestaña de una escena (no la borra). La última pestaña no se puede cerrar; si era la activa pasa a la vecina. */
export async function closeSceneTab(id) {
  const ids = openSceneIds()
  if (!ids.includes(id)) return false
  if (ids.length <= 1) { toast('Debe quedar al menos una escena abierta', 'error'); return false }
  const i = ids.indexOf(id)
  if (store.project.activeSceneId === id) {
    const next = ids[i + 1] ?? ids[i - 1]
    if (!(await switchScene(next))) return false
  }
  sceneTabs.ids = sceneTabs.ids.filter((x) => x !== id)
  return true
}

/** Carga una escena del proyecto abierto y la deja activa. */
export async function switchScene(id) {
  const p = store.project
  if (!p || p.activeSceneId === id || !p.scenes.some((s) => s.id === id) || sceneTransition) return false
  // Capturar ANTES de guardar/cargar: ninguna operación asíncrona puede cambiar la vista saliente.
  const previousId = p.activeSceneId
  const managed = workspaceProject === p.id && !!workspaceSession && !store.filmMode
  const temporary = managed && temporaryWorkspace()
  if (!temporary) {
    persistEditorWorkspace()
    const vp=store.editor.vp
    if (encodeCameraView(store.editor.meshLocalSavedView?.() || vp.saveEditorView())) editorCameraViews.capture(p.id, previousId, store.editor)
  }
  sceneTransition = true
  try {
    if (!(await saveNow({ thumb: false }))) return false
    const saved = migrateScene(await db.loadScene(p.id, id))
    if (!saved) { toast('No se encontró esa escena', 'error'); return false }
    const r = await prepareEditorSceneInstances(p, saved, id)
    exitEdit()
    const t = r.terrain
    p.objects = r.objects || []
    p.environment = r.environment
    p.signalConnections = clone(r.signalConnections)
    p.terrain = { size: t.size, segments: t.segments, layers: clone(t.layers), foliage: foliageCfgs(t), enabled: t.enabled !== false }
    p.activeSceneId = id
    await store.editor.loadScene({ terrain: t, settings: p.settings })
    syncPieces()
    resetSceneState({ frame: false })
    // Restaurar después de la carga y la sincronización para que no se sobrescriba.
    if (!temporary) {
      editorCameraViews.restore(p.id, id, store.editor)
      if (managed) {
        restoreWorkspaceScene(p,id)
        store.editor.syncSettings()
      }
      showSceneTab(id)
      if (!managed) markDirty()
    } else {
      // La navegación del juego no reemplaza el contexto editorial almacenado.
      if (workspaceSession && store.editor.player?.session?.saved?.sceneId === id) restoreWorkspaceScene(p,id)
    }
    return true
  } finally {
    sceneTransition = false
    if (!temporary) persistEditorWorkspace()
  }
}

export async function addScene(name, { folder = 'Assets/Scenes', select = true, empty = false } = {}) {
  const p = store.project
  await saveNow({ thumb: false })
  const content = createSceneContent(p.template)
  if (empty) { content.objects = []; content.terrain.enabled = false }
  const scene = { id: uid('s'), name: uniqueSceneName(p, !name || name === 'Escena' ? 'Escena 1' : name), folder: normFolder(folder), transitions: { ...SCENE_FADE_DEFAULTS } }
  scene.name = uniqueFileName(p, scene.folder, scene.name + '.scene.json').replace(/\.scene\.json$/, '')
  scene.count = content.objects.length
  await db.saveScene(p.id, scene.id, migrateScene({ objects: content.objects, environment: content.environment, terrain: blankTerrain(content), signalConnections: content.signalConnections }))
  p.scenes.push(scene)
  addFolderChain(p, scene.folder)
  markDirty()
  if (select) await switchScene(scene.id)
  await persistNow() // crear una escena es un cambio de estructura: se escribe en disco sin esperar
  toast(`Escena «${scene.name}» creada`, 'ok')
  return scene
}

export async function duplicateScene(id) {
  const p = store.project
  const src = p.scenes.find((s) => s.id === id)
  if (!src) return
  await saveNow({ thumb: false })
  const rec = await db.loadScene(p.id, id)
  const scene = { id: uid('s'), name: uniqueSceneName(p, src.name + ' copia'), folder: src.folder, count: src.count, ...(src.transitions ? { transitions: clone(src.transitions) } : {}), ...(src.streaming ? { streaming: clone(src.streaming) } : {}), ...(src.playerNodeId ? { playerNodeId: src.playerNodeId } : {}), ...(src.playerSpawnMode === 'api' ? { playerSpawnMode: 'api' } : {}) }
  await db.saveScene(p.id, scene.id, { objects: rec.objects, environment: rec.environment, terrain: rec.terrain, signalConnections: rec.signalConnections })
  p.scenes.splice(p.scenes.indexOf(src) + 1, 0, scene)
  markDirty()
  await persistNow()
  toast(`Escena duplicada: «${scene.name}»`, 'ok')
}

export function renameScene(id, name) {
  const p = store.project
  const s = p.scenes.find((x) => x.id === id)
  const clean = sanitizeName(name, '')
  if (!s || !clean || clean === s.name) return
  s.name = uniqueFileName(p, s.folder, clean + '.scene.json', { ignoreId: id }).replace(/\.scene\.json$/, '')
  markDirty()
  persistNow()
}

export async function deleteScene(id) {
  const p = store.project
  if (p.scenes.length <= 1) { toast('Un proyecto necesita al menos una escena', 'error'); return false }
  const i = p.scenes.findIndex((s) => s.id === id)
  if (i < 0) return false
  const usage = await sceneInstanceUsage(p, id)
  if (usage) { toast(`Escena vinculada desde «${usage}»`, 'warn'); return false }
  if (store.project !== p || !p.scenes.some(s => s.id === id)) return false
  if (p.activeSceneId === id && !(await switchScene(p.scenes[i === 0 ? 1 : i - 1].id))) return false
  p.scenes = p.scenes.filter((s) => s.id !== id)
  sceneTabs.ids = sceneTabs.ids.filter((x) => x !== id)
  await db.deleteScene(p.id, id)
  editorCameraViews.forget(p.id, id)
  if (workspaceSession) delete workspaceSession.scenes[id]
  markDirty()
  await persistNow() // borrar una escena: se escribe en disco ya, para que el archivo del proyecto no la conserve
  return true
}

// ---------- archivo del proyecto (.lfproj) ----------
async function collectScenes(meta, active) {
  const scenes = new Map()
  for (const s of meta.scenes) {
    if (s.id === meta.activeSceneId) scenes.set(s.id, active)
    else {
      const r = await db.loadScene(meta.id, s.id)
      if (r) scenes.set(s.id, { objects: r.objects, environment: r.environment, terrain: r.terrain, signalConnections: r.signalConnections })
    }
  }
  return scenes
}

/** Descarga una copia del proyecto como .lfproj (para respaldo o para llevarlo a otro equipo). */
export async function saveLfproj() {
  await saveNow({ thumb: true })
  const { blob, missing, meta, files } = await buildProjectFile()
  downloadBlob(blob, `${slug(meta.name, 'proyecto')}.lfproj`)
  toast(missing.length ? `Copia con ${missing.length} archivo(s) ausentes` : `Copia descargada: ${meta.scenes.length} escena(s), ${files.size} archivo(s)`, missing.length ? 'error' : 'ok', 3500)
}

/**
 * Abre un .lfproj. Si el proyecto ya existe en este navegador, `onConflict()` decide: 'replace' | 'copy' | 'cancel'.
 * `id`: guardarlo con otro id (Nether Film Maker abre la escena como copia propia y nunca pisa el proyecto original).
 */
export async function openLfproj(file, { onConflict, id = null, quiet = false, backupLoc = null, skipActiveSave = false } = {}) {
  const { meta, scenes, files, thumb, lost, migration } = await parseLfproj(await file.arrayBuffer())
  if (id) { meta.id = id; onConflict = () => 'replace' }
  if (skipActiveSave && (meta.id !== store.project?.id || store.unsavedChanges || store.saveState !== 'saved')) throw new Error('No se puede recargar: el proyecto cambió o tiene datos sin guardar')
  const existing = await db.loadProject(meta.id)
  if (existing) {
    const choice = onConflict ? await onConflict(meta, existing) : 'copy'
    if (choice === 'cancel') return false
    if (choice === 'copy') {
      const copiedId = uid('p'), sourceId = meta.id
      // Copiar el proyecto no debe dejar películas que apunten al ID del proyecto original.
      for (const resource of meta.cinematics || []) {
        const source = decodeNativeFilm(files.get(resource.id), resource.id, sourceId)
        source.scene.projectId = copiedId
        source.scene.projectName = `${meta.name} (copia)`
        files.set(resource.id, encodeNativeFilm(source))
      }
      meta.id = copiedId; meta.name += ' (copia)'
    }
    else await db.deleteProject(meta.id)
  }
  persistEditorWorkspace()
  if (store.project && !skipActiveSave) await saveNow({ thumb: true })
  for (const s of meta.scenes) {
    const sd = scenes.get(s.id)
    s.count = sd.objects?.length ?? 0
    await db.saveScene(meta.id, s.id, sd)
  }
  meta.updatedAt = Date.now()
  await db.saveProject(meta, thumb)
  for (const e of allEntries(meta)) if (e.kind !== 'scene' && e.kind !== 'prefab' && e.kind !== 'script' && e.kind !== 'ui' && e.kind !== 'shader' && e.kind !== 'vfx' && e.kind !== 'liquid') await db.putAsset(meta.id, e.id, e.name, files.get(e.id).buffer.slice(files.get(e.id).byteOffset, files.get(e.id).byteOffset + files.get(e.id).byteLength))
  const backup = migration.rewritten.length ? await backupBeforeMigration(backupLoc, backupLoc ? new Uint8Array(await file.arrayBuffer()) : null) : null
  await openProject(meta.id)
  announceMigration(migration, { name: meta.name, source: file.name || 'archivo', backup })
  if (!quiet || lost.length) toast(`Abierto «${meta.name}» · ${meta.scenes.length} escena(s)${lost.length ? ` · faltan ${lost.length} archivo(s)` : ''}`, lost.length ? 'error' : 'ok', 3500)
  return true
}

/** Abre un .lfproj (selector de archivos si no se pasa uno). Si ya existe, pregunta entre reemplazar o abrir como copia. */
export async function openLfprojDialog(file) {
  const f = file || (await pickFile('.lfproj,.zip'))[0]
  if (!f) return false
  try {
    return await openLfproj(f, {
      onConflict: async (meta) => ((await askChoice(`«${meta.name}» ya existe en este navegador.`, 'Reemplazarlo con el archivo', 'Abrirlo como copia', { title: 'Proyecto existente' })) ? 'replace' : 'copy'),
    })
  } catch (err) {
    console.error(err)
    toast('No se pudo abrir el proyecto: ' + err.message, 'error', 5000)
    return false
  }
}

// ---------- copia heredada .levelforge.json (v2, una sola escena) ----------
export async function importBundle(file) {
  const json = JSON.parse(await file.text())
  if (json.format !== 'levelforge') throw new Error('No es un archivo de Century')
  const { meta, scene } = migrateRecord(json.project)
  meta.id = uid('p')
  meta.updatedAt = Date.now()
  meta.scenes[0].count = scene.objects.length
  await db.saveScene(meta.id, meta.scenes[0].id, scene)
  await db.saveProject(meta, undefined)
  for (const a of json.assets || []) await db.putAsset(meta.id, a.assetId, a.name, b64ToBytes(a.data).buffer)
  await openProject(meta.id)
  toast(`Importado «${meta.name}»`, 'ok')
}

// =====================================================================

// Lo que el historial necesita de aquí (guardar, ¿hay carpeta en disco?, piezas de terreno): se inyecta para no crear un ciclo.
configureHistory({ save: () => saveNow(), hasDisk: () => !!projLoc, markPending: recordPending, syncPieces: () => syncPieces(), canEditGeneratedScript: callbackGenerationBlockReason })
