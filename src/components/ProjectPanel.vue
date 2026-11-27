<script setup>
import { askConfirm } from '../core/dialogs.js'
import { activeEffects } from '../engine/runtime/render/profiles.js'
import { previewClip, stopPreview } from '../core/store.js'
import { AUDIO_EXT } from '../engine/runtime/audio/config.js'
// Panel «Proyecto» (como el de Unity): árbol de carpetas + contenido de la carpeta abierta.
// Cada archivo importado se COPIA dentro del proyecto y viaja dentro del .lfproj.
//
//  · Selección múltiple (Ctrl / Shift / Ctrl+A) · arrastrar archivos y CARPETAS a otras carpetas (árbol, iconos, ruta)
//  · Renombrar: F2, menú, o segundo clic sobre el nombre · Duplicar Ctrl+D · Eliminar Supr · Crear ▸ carpeta / escena / prefab
//  · Arrastrar nodos desde la Jerarquía a una carpeta crea un prefab · arrastrar un prefab al viewport lo instancia
//  · Buscar: texto, o `t:prefab` `t:texture` `t:model` `t:scene` para filtrar por tipo
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import {
  store, subfolders, folderEntries, importFiles, inspectLevelPackage, importLevelPackage, switchScene, placeModel, renameEntry, moveItems, removeEntry, duplicateEntry,
  createFolder, renameFolder, deleteFolder, addScene, assetUrl, toast, exportLevelPackage, createPrefab, createEmptyPrefab, selectionRoots, commit, createScript, openScriptEditor, setScriptExecution, createShader, createShaderGraph, openShaderEditor, createProfile, openProfileEditor, createMaterial, openMaterialEditor, createLiquid, openLiquidEditor, createGameManager, openGameManagerEditor, createUi, openUiEditor, openUiGallery, createVfx, openVfxEditor, createTimeline, createTimelineDialog, deleteTimelines, deleteAnimation, findTimelineUsage, openTimelineEditor, openCinematics, importFilmDialog, createNativeCinematicDialog, openNativeCinematic,
} from '../core/store.js'
import { allEntries, ROOT_FOLDER, parentFolder, folderName } from '../core/project.js'
import { CINEMATICS_FOLDER } from '../core/timeline/model.js'
import { levelPackageSelection, planLevelPackageImport } from '../core/levelpackage-import.js'
import { uid } from '../engine/runtime/util.js'
import { isSystemUi, isSystemUiPath } from '../engine/runtime/ui/system.js'
import { pickFile } from '../engine/runtime/util.js'
import Icon from './Icon.vue'
import { writeAssetDrag } from '../core/editor/asset-drop.js'
import folderClosed from '../assets/icons/icn_folder_close.png'
import folderOpen from '../assets/icons/icn_folder_open.png'
import { assetIcon } from '../core/editor/asset-icon.js'
import searchArt from '../assets/icons/icn_search.png'
import filterArt from '../assets/icons/icn_filter.png'
import settingsArt from '../assets/icons/icn_settings.png'
import plusArt from '../assets/icons/icn_plus.png'

const root = ref(null)
const grid = ref(null)
const narrow = ref(false)
const filter = ref('')
const viewMode = computed({ get: () => store.prefs.projView === 'grid' ? 'grid' : 'list', set: (v) => { store.prefs.projView = v } })
const displayTree = computed(() => store.prefs.projTreeOpen && !narrow.value)
const sortMode = computed({ get: () => store.prefs.projSort === 'type' ? 'type' : 'name', set: (v) => { store.prefs.projSort = v } })
const open = reactive(new Set(['Assets']))
const rename = ref(null)
const packagePreview = ref(null) // {manifest, contents}, sin modificar el proyecto
const packagePicked = ref([])
const packageDecisions = reactive({})
const packageBusy = ref(false)
const packageClosure = computed(() => packagePreview.value ? levelPackageSelection(packagePreview.value.manifest, packagePicked.value) : new Set())
const packageCurrent = computed(() => new Map(allEntries(store.project, { includeTemporal: true }).map((e) => [`${e.folder}/${e.file}`.toLowerCase(), e])))
const packageConflict = (e) => packageCurrent.value.get(e.path.toLowerCase())
const packageUnresolved = computed(() => !!packagePreview.value && packagePreview.value.manifest.entries.some((e) => packageClosure.value.has(e.id) && packageConflict(e) && !packageDecisions[e.id]))
function togglePackageEntry(id, checked) {
  packagePicked.value = checked ? [...new Set([...packagePicked.value, id])] : packagePicked.value.filter((x) => x !== id)
}
async function previewLevelPackage(file) {
  try {
    packagePreview.value = await inspectLevelPackage(file)
    packagePicked.value = packagePreview.value.manifest.entries.map((e) => e.id)
    for (const key of Object.keys(packageDecisions)) delete packageDecisions[key]
  } catch (err) { toast(`Paquete inválido: ${err.message}`, 'error', 6000) }
}
async function pickPackage() {
  const list = await pickFile('.levelpackage', false)
  if (list.length) await previewLevelPackage(list[0])
}
async function applyPackage() {
  if (!packagePreview.value || !packageClosure.value.size || packageUnresolved.value || packageBusy.value) return
  packageBusy.value = true
  try {
    planLevelPackageImport({ ...packagePreview.value, project: store.project, selectedIds: packagePicked.value, decisions: packageDecisions, makeId: uid })
    if (await importLevelPackage(packagePreview.value, packagePicked.value, { ...packageDecisions })) packagePreview.value = null
  } catch (err) { toast(`Revisa la selección: ${err.message}`, 'error', 6500) }
  finally { packageBusy.value = false }
}
 // { key, kind, id }
const draft = ref('')
const hover = ref(null) // carpeta sobre la que se arrastra
const urls = reactive({})
const dims = reactive({})
const sel = ref([]) // [{ kind, id }]
let anchor = null
let renameTimer = 0
let dragging = [] // lo que se arrastra dentro del panel (los datos de dataTransfer no se pueden leer durante dragover)
let ro

onMounted(() => {
  ro = new ResizeObserver(([e]) => { narrow.value = e.contentRect.width < 470 })
  ro.observe(root.value)
})
onBeforeUnmount(() => { ro?.disconnect(); clearTimeout(renameTimer) })

const inside = (path, f) => path === f || path.startsWith(f + '/')
const isCinematicsFolder = path => path === CINEMATICS_FOLDER || path?.startsWith(CINEMATICS_FOLDER + '/')
const folder = computed(() => (store.project.folders.includes(store.projFolder) ? store.projFolder : ROOT_FOLDER))
const crumbs = computed(() => {
  const parts = folder.value.split('/')
  return parts.map((p, i) => ({ name: p, path: parts.slice(0, i + 1).join('/') }))
})
watch(folder, (f) => { for (let p = parentFolder(f); p; p = parentFolder(p)) open.add(p) }, { immediate: true })

const countIn = (path) => folderEntries(path).length
const treeRows = computed(() => {
  const out = []
  const walk = (path, depth) => {
    const kids = subfolders(path)
    out.push({ kind: 'folder', id: path, path, depth, kids: kids.length, name: folderName(path), count: countIn(path) })
    if (open.has(path)) for (const k of kids) walk(k, depth + 1)
  }
  walk(ROOT_FOLDER, 0)
  return out
})

const KINDS = { timeline: 'timeline', cinematica: 'cinematic', cinematic: 'cinematic', cinematics: 'cinematic', animation: 'animation', animacion: 'animation', material: 'material', materiales: 'material', materiales3d: 'material', prefab: 'prefab', prefabs: 'prefab', texture: 'texture', textura: 'texture', texturas: 'texture', model: 'model', modelo: 'model', modelos: 'model', scene: 'scene', escena: 'scene', escenas: 'scene', script: 'script', scripts: 'script', ui: 'ui', interfaz: 'ui', interfaces: 'ui', shader: 'shader', shaders: 'shader', perfil: 'profile', perfiles: 'profile', profile: 'profile', gamemanager: 'gamemanager', gestor: 'gamemanager', vfx: 'vfx', liquid: 'liquid', liquido: 'liquid', líquidos: 'liquid', efecto: 'vfx', efectos: 'vfx' }
const items = computed(() => {
  let q = filter.value.trim().toLowerCase()
  const t = /(?:^|\s)t:(\w+)/.exec(q)
  const kind = t ? KINDS[t[1]] : null
  if (t) q = q.replace(t[0], '').trim()
  if (q || kind) {
    return allEntries(store.project, { includeTemporal: true })
      .filter((e) => (!kind || e.kind === kind) && (!q || e.file.toLowerCase().includes(q)))
      .map((e) => ({ ...e, hint: e.folder }))
  }
  const dirs = subfolders(folder.value).map((p) => ({ kind: 'folder', id: p, name: folderName(p), folder: p }))
  const entries = [...folderEntries(folder.value)]
  entries.sort((a, b) => sortMode.value === 'type'
    ? a.kind.localeCompare(b.kind, 'es') || a.file.localeCompare(b.file, 'es')
    : a.file.localeCompare(b.file, 'es'))
  return [...dirs, ...entries]
})

// miniaturas de texturas (se cargan bajo demanda)
watch(items, async (list) => {
  for (const it of list) {
    if (it.kind === 'texture' && !urls[it.id]) assetUrl(it.id).then((u) => { if (u) urls[it.id] = u })
  }
}, { immediate: true })

const keyOf = (it) => `${it.kind}:${it.id}`
const selKeys = computed(() => new Set(sel.value.map(keyOf)))
const isSel = (it) => selKeys.value.has(keyOf(it))
const isActiveScene = (it) => it.kind === 'scene' && it.id === store.project.activeSceneId
const artwork = (it) => assetIcon(it, isSel(it))
const human = (n) => (n == null ? '' : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`)
const primary = () => sel.value.at(-1) || null
const selectedItems = () => sel.value.map((s) => items.value.find((x) => x.kind === s.kind && x.id === s.id)).filter(Boolean)

const info = computed(() => {
  if (sel.value.length > 1) return `${sel.value.length} elementos seleccionados`
  const s = primary()
  if (!s) return `${folder.value} · ${items.value.length} elemento(s)`
  if (s.kind === 'folder') return `${s.id}/`
  const e = allEntries(store.project, { includeTemporal: true }).find((x) => x.kind === s.kind && x.id === s.id)
  if (!e) return ''
  const r = e.ref
  const bits = [`${e.folder}/${e.file}`]
  if (e.embedded) bits.push(`${e.kind === 'cinematic' ? 'Cinematics · FilmMaker' : e.kind === 'timeline' ? 'Timeline' : 'Clip de animación'} · ${r.duration} s`)
  if (r.bytes) bits.push(human(r.bytes))
  if (e.kind === 'model' && r.size) bits.push(r.size.map((v) => v.toFixed(1)).join(' × ') + ' m')
  if (e.kind === 'texture' && dims[e.id]) bits.push(dims[e.id])
  if (e.kind === 'scene') bits.push(`${r.count ?? 0} nodos`)
  if (e.kind === 'prefab') bits.push(`${r.objects?.length ?? 0} nodos`)
  if (e.kind === 'gamemanager') bits.push(`Jugador: ${r.player === 'inherit' ? 'del proyecto' : r.player}`)
  if (e.kind === 'profile') bits.push(activeEffects(r).join(', ') || 'sin efectos')
  if (e.kind === 'vfx') bits.push(`Emisión ${r.emission?.mode || '—'} · Capacidad ${r.emission?.capacity ?? '—'}`)
  if (e.kind === 'liquid') bits.push(`Densidad ${r.densityKgM3} kg/m³ · Viscosidad ${r.viscosity}`)
  if (e.kind === 'material') bits.push(`Albedo ${r.color} · Rugosidad ${r.roughness} · Metálico ${r.metallic}`)
  if (e.kind === 'script' || e.kind === 'ui' || e.kind === 'shader') bits.push(`${(r.code || '').split('\n').length} líneas`)
  return bits.join(' · ')
})

// ---------- selección ----------
function setSel(list) {
  sel.value = list
  store.temporalSelection = null
  store.projSel = list.at(-1) || null
  if (['profile', 'material', 'gamemanager', 'liquid', 'vfx'].includes(store.projSel?.kind)) {
    store.prefs.rightTab = 'object'
    if (store.ui?.mode === 'desktop') store.prefs.rightOpen = true
    else if (store.ui) store.ui.drawer = 'inspector'
  }
}
function select(it, e) {
  const k = keyOf(it)
  if (e?.shiftKey && anchor) {
    const keys = items.value.map(keyOf)
    const a = keys.indexOf(anchor), b = keys.indexOf(k)
    if (a >= 0 && b >= 0) {
      const [lo, hi] = a < b ? [a, b] : [b, a]
      return setSel(items.value.slice(lo, hi + 1).map((x) => ({ kind: x.kind, id: x.id })))
    }
  }
  if (e?.ctrlKey || e?.metaKey) {
    anchor = k
    return setSel(isSel(it) ? sel.value.filter((s) => keyOf(s) !== k) : [...sel.value, { kind: it.kind, id: it.id }])
  }
  anchor = k
  setSel([{ kind: it.kind, id: it.id }])
}
function goto(path) { store.projFolder = path; setSel([]); filter.value = ''; anchor = null }
function up() { const p = parentFolder(folder.value); if (p) goto(p) }
watch(() => store.project.id, () => setSel([]))
watch(() => store.projSel, (v) => { // otros paneles pueden cambiar o limpiar la selección de Assets
  if (!v) { if (sel.value.length) sel.value = []; return }
  if (!primary() || keyOf(primary()) !== keyOf(v)) sel.value = [v]
})

function activate(it) {
  if (it.kind === 'folder') return goto(it.id)
  if (it.kind === 'scene') return switchScene(it.id)
  if (it.kind === 'model') { placeModel(it.id); toast('Haz clic en la escena para colocar el modelo', 'info', 2200) }
  if (it.kind === 'prefab') store.editor.dropPrefab(it.id)
  if (it.kind === 'timeline') return openTimelineEditor(it.id)
  if (it.kind === 'cinematic') return store.project.cinematics?.some(c => c.id === it.id) ? (store.filmMode ? toast('El Cinematic actual se edita desde la Timeline de FilmMaker', 'info') : openNativeCinematic(it.id)) : openCinematics(it.id)
  if (it.kind === 'animation') return toast('Clip heredado: no dispone de editor en Cinematics. Su reproducción de gameplay permanece disponible.', 'info', 4500)
  if (it.kind === 'script') return openScriptEditor(it.id)
  if (it.kind === 'shader') openShaderEditor(it.id)
  else if (it.kind === 'profile') openProfileEditor(it.id)
  else if (it.kind === 'material') openMaterialEditor(it.id)
  else if (it.kind === 'vfx') openVfxEditor(it.id)
  else if (it.kind === 'liquid') openLiquidEditor(it.id)
  else if (it.kind === 'gamemanager') openGameManagerEditor(it.id)
  if (it.kind === 'ui') openUiEditor(it.id)
  if (it.kind === 'audio' || (it.kind === 'file' && AUDIO_EXT.includes((it.ext || it.name.split('.').pop() || '').toLowerCase()))) { if (store.audioPrev === it.id) stopPreview(); else previewClip(it.id) }
}

// ---------- renombrar ----------
async function startRename(it, where = 'grid') {
  if (it.embedded && it.kind !== 'timeline') return
  if ((it.kind === 'folder' && (it.id === ROOT_FOLDER || isSystemUiPath(it.id) || isCinematicsFolder(it.id) || it.id === 'Assets/UI')) || isSystemUi(it)) return
  clearTimeout(renameTimer)
  rename.value = { key: (where === 'tree' ? 'tree:' : '') + keyOf(it), kind: it.kind, id: it.id }
  draft.value = ['folder', 'scene', 'prefab', 'timeline', 'cinematic'].includes(it.kind) ? it.name : it.name.replace(/\.[^.]+$/, '')
  await nextTick()
  const i = root.value?.querySelector('input.rn')
  i?.focus(); i?.select()
}
function finishRename(save) {
  const r = rename.value
  rename.value = null
  if (!save || !r || !draft.value.trim()) return
  if (r.kind === 'folder') renameFolder(r.id, draft.value)
  else renameEntry(r.kind, r.id, draft.value)
}
function dblOpen(it) { clearTimeout(renameTimer); activate(it) }
function tileClick(e, it) {
  const sole = sel.value.length === 1 && isSel(it) && !e.shiftKey && !e.ctrlKey && !e.metaKey
  select(it, e)
  clearTimeout(renameTimer)
  // como en Unity: un segundo clic (lento) sobre el nombre de un elemento ya seleccionado lo renombra
  if (sole && e.target.closest?.('.lbl') && !(it.kind === 'folder' && it.id === ROOT_FOLDER)) renameTimer = setTimeout(() => startRename(it), 550)
}

// ---------- acciones ----------
const nested = (list) => list.filter((a) => !(a.kind === 'folder' && list.some((b) => b !== a && b.kind === 'folder' && inside(a.id, b.id))))
// Los recursos temporales se guardan dentro del proyecto; no son archivos de IndexedDB.
const deletableEmbedded = (it) => it?.embedded && ['timeline', 'cinematic', 'animation'].includes(it.kind)
const canRemove = (list) => list.every(it => !it.embedded || deletableEmbedded(it))
async function remove(list = selectedItems()) {
  list = nested(list).filter((it) => !(it.kind === 'folder' && (it.id === ROOT_FOLDER || it.id === 'Assets/UI' || isSystemUiPath(it.id) || isCinematicsFolder(it.id))) && !isSystemUi(it))
  if (!list.length || !canRemove(list)) return
  const projectId = store.project?.id
  const temporal = [...new Map([...list.filter(it => it.kind === 'timeline' || it.kind === 'cinematic'), ...allEntries(store.project, { includeTemporal: true }).filter(e => e.kind === 'timeline' && list.some(d => d.kind === 'folder' && inside(e.folder, d.id)))].map(e => [e.id, e])).values()]
  const found = []
  try {
    for (const entry of temporal) for (const use of await findTimelineUsage(entry.id)) found.push(`${entry.name}: ${use}`)
  } catch (error) { toast(`No se pudo comprobar el uso del timeline: ${error.message}`, 'error', 6000); return }
  const dirs = list.filter((l) => l.kind === 'folder')
  const inner = dirs.reduce((n, d) => n + allEntries(store.project).filter((e) => inside(e.folder, d.id)).length, 0)
  const what = list.length === 1 ? `«${list[0].name}»` : `${list.length} elementos`
  const extra = inner ? ` (incluye ${inner} archivo(s) dentro de carpetas)` : ''
  const useWarning = found.length ? `\n\nReferencias detectadas (${found.length}):\n${found.slice(0, 6).join('\n')}${found.length > 6 ? '\n…' : ''}\nNo se modificarán esas referencias.` : ''
  const dynamicWarning = temporal.length ? '\n\nLas referencias creadas dinámicamente desde scripts no pueden detectarse automáticamente.' : ''
  const legacyWarning = list.some(it => it.kind === 'animation') ? '\n\nLos clips heredados pueden estar referenciados por CameraShake, eventos o scripts. Comprueba sus usos antes de eliminarlos.' : ''
  if (!(await askConfirm(`¿Eliminar ${what}${extra}?${useWarning}${dynamicWarning}${legacyWarning}`, { title: 'Eliminar', ok: 'Eliminar', danger: true }))) return
  if (store.project?.id !== projectId) return toast('El proyecto cambió durante la confirmación; no se eliminó nada.', 'error')
  // Una selección múltiple de películas y timelines genera una sola entrada Deshacer.
  const legacyTemporal = list.filter(t => t.kind === 'timeline' || (t.kind === 'cinematic' && !store.project.cinematics?.some(c => c.id === t.id)))
  const deleted = legacyTemporal.length ? deleteTimelines(legacyTemporal.map(t => t.id)) : false
  let any = !!deleted
  for (const it of list.filter(it => it.kind !== 'timeline' && (it.kind !== 'cinematic' || store.project.cinematics?.some(c => c.id === it.id)))) {
    const ok = it.kind === 'folder' ? await deleteFolder(it.id) : it.kind === 'animation' ? deleteAnimation(it.id) : await removeEntry(it.kind, it.id)
    any = !!ok || any
  }
  if (any) setSel([])
}
async function duplicate(list = selectedItems()) {
  if (list.some(it => it.kind === 'cinematic' || (it.embedded && it.kind !== 'timeline'))) return
  const made = []
  for (const it of list.filter((l) => l.kind !== 'folder')) {
    const r = await duplicateEntry(it.kind, it.id)
    if (r) made.push(r)
  }
  if (made.length) setSel(made)
}
async function newFolder(parent = folder.value) {
  const p = createFolder(parent, 'Nueva carpeta')
  if (!p) return
  open.add(parent)
  if (parent !== folder.value) goto(parent)
  setSel([{ kind: 'folder', id: p }])
  await nextTick()
  startRename({ kind: 'folder', id: p, name: folderName(p) })
}
async function newPrefab(parent = folder.value) {
  const pf = createEmptyPrefab(parent)
  if (parent !== folder.value) goto(parent)
  setSel([{ kind: 'prefab', id: pf.id }])
  await nextTick()
  startRename({ kind: 'prefab', id: pf.id, name: pf.name })
}
async function newScript(parent = folder.value, execution = 'node') {
  const sc = createScript(parent, execution === 'node' ? 'node.js' : 'script.js', execution)
  if (parent !== folder.value) goto(parent)
  filter.value = ''
  setSel([{ kind: 'script', id: sc.id }])
  await nextTick()
  await startRename({ kind: 'script', id: sc.id, name: sc.name })
}
// La paleta de comandos utiliza el mismo flujo de renombrado que Assets.
watch(() => store.scriptRenameId, async (id) => {
  if (!id) return
  const sc = store.project?.scripts?.find((item) => item.id === id)
  if (!sc) return
  if (folder.value !== sc.folder) goto(sc.folder)
  if (filter.value) filter.value = ''
  setSel([{ kind: 'script', id }])
  await nextTick()
  await startRename({ kind: 'script', id, name: sc.name })
  store.scriptRenameId = null
}, { immediate: true })
function newShader(parent = folder.value) {
  const d = createShader(parent)
  if (parent !== folder.value) goto(parent)
  setSel([{ kind: 'shader', id: d.id }])
  openShaderEditor(d.id)
}
function newShaderGraph(parent = folder.value, target = 'material') {
  const d = createShaderGraph(parent, target === 'post' ? 'post-graph.glsl' : 'graph.glsl', false, target)
  if (parent !== folder.value) goto(parent)
  setSel([{ kind: 'shader', id: d.id }])
  openShaderEditor(d.id)
}
function newProfile(parent = folder.value) {
  const d = createProfile(parent === ROOT_FOLDER || parent === folder.value ? 'Assets/Profiles' : parent)
  goto(d.folder)
  setSel([{ kind: 'profile', id: d.id }])
  openProfileEditor(d.id)
}
function newVfx(parent = folder.value) {
  const d = createVfx(parent)
  if (!d) return toast('No se puede crear VFX en la carpeta reservada', 'error')
  if (parent !== folder.value) goto(parent)
  filter.value = ''
  setSel([{ kind: 'vfx', id: d.id }])
}
function newLiquid(parent = folder.value) {
  const d=createLiquid(parent===ROOT_FOLDER?'Assets/Liquids':parent)
  if(!d)return
  goto(d.folder);setSel([{kind:'liquid',id:d.id}]);openLiquidEditor(d.id)
}
function newMaterial(parent = folder.value) {
  const d = createMaterial(null, parent === ROOT_FOLDER ? 'Assets/Materials' : parent)
  goto(d.folder)
  setSel([{ kind: 'material', id: d.id }])
  openMaterialEditor(d.id)
}
function newGameManager(parent = folder.value) {
  const d = createGameManager(parent === ROOT_FOLDER ? 'Assets/GameManagers' : parent)
  goto(d.folder)
  setSel([{ kind: 'gamemanager', id: d.id }])
  openGameManagerEditor(d.id)
}
function newUi(parent = folder.value) {
  const d = createUi(parent === ROOT_FOLDER ? 'Assets/UI' : parent)
  if (!d) return toast('La carpeta Sistema está reservada para las interfaces del motor', 'error')
  goto(d.folder)
  setSel([{ kind: 'ui', id: d.id }])
  openUiEditor(d.id)
}
function prefabFromSelection(parent = folder.value) {
  const ids = selectionRoots()
  if (!ids.length) return toast('Selecciona nodos en la Jerarquía primero (o arrástralos aquí)', 'info', 2600)
  createPrefab(ids, parent)
}
async function doExport(list = selectedItems()) {
  if (list.some(it => it.embedded && it.kind !== 'timeline')) return
  if (!list.length) return toast('Selecciona archivos o carpetas para exportar', 'info')
  await exportLevelPackage(nested(list).map((item) => ({ kind: item.kind, id: item.id })))
}
async function doImport(parent = folder.value) {
  if (isCinematicsFolder(parent)) return toast('Cinematics solo recibe películas mediante el importador de FilmMaker', 'info')
  const files = await pickFile('', true)
  const packages = files.filter((f) => f.name.toLowerCase().endsWith('.levelpackage'))
  if (packages.length) {
    if (packages.length > 1 || files.length > 1) toast('Se previsualizará un solo paquete; importa los demás después', 'info')
    await previewLevelPackage(packages[0])
  } else if (files.length) await importFiles(files, typeof parent === 'string' ? parent : folder.value)
}
async function newTemporal(parent = folder.value) {
  const resource = await createTimelineDialog(parent)
  if (!resource) return
  goto(resource.folder || ROOT_FOLDER)
  setSel([{ kind: 'timeline', id: resource.id }])
}
const createItems = (parent) => {
  if (isSystemUiPath(parent)) return []
  if (isCinematicsFolder(parent)) return [
    { label: 'Cinematic', icon: 'play', run: createNativeCinematicDialog },
  ]
  return [
    { label: 'Carpeta', icon: 'folder', run: () => newFolder(parent) },
    { sep: true },
    { label: 'Escenas', icon: 'scene', children: [
      { label: 'Escena', icon: 'scene', run: () => addScene('Escena', { folder: parent }) },
      { label: 'Escena vacía', icon: 'scene', run: () => addScene('Escena', { folder: parent, empty: true }) },
    ] },
    { label: 'Prefabs', icon: 'prefab', children: [
      { label: 'Prefab (vacío)', icon: 'prefab', run: () => newPrefab(parent) },
      { label: 'Prefab desde la selección', icon: 'prefab', run: () => prefabFromSelection(parent) },
    ] },
    ...(parent === ROOT_FOLDER ? [{ label: 'Cinemáticas', icon: 'play', children: [
      { label: 'Timeline', icon: 'play', run: () => newTemporal(parent) },
      { label: 'Cinematic', icon: 'play', run: createNativeCinematicDialog },
      { label: 'Importar película de FilmMaker (.nfm)…', icon: 'import', run: importFilmDialog },
    ] }] : []),
    { label: 'Scripts', icon: 'script', children: [
      { label: 'Script de Nodo (.js)', icon: 'script', run: () => newScript(parent, 'node') },
      { label: 'Script Global (.js)', icon: 'script', run: () => newScript(parent, 'global') },
    ] },
    { label: 'Shaders y materiales', icon: 'shader', children: [
      { label: 'Shader (.glsl)', icon: 'shader', run: () => newShader(parent) },
      { label: 'Shader Graph · Material', icon: 'shader', run: () => newShaderGraph(parent) },
      { label: 'Shader Graph · Post Processing', icon: 'shader', run: () => newShaderGraph(parent, 'post') },
      { label: 'Material (.material)', icon: 'sphere', run: () => newMaterial(parent) },
      { label: 'Perfil de post-proceso (.post)', icon: 'light', run: () => newProfile(parent) },
    ] },
    { sep: true },
    { label: 'Líquido (.liquid)', icon: 'droplets', run: () => newLiquid(parent) },
    { label: 'Efecto VFX (.vfx)', icon: 'vfx', run: () => newVfx(parent) },
    { label: 'GameManager (.gamemanager)', icon: 'database', run: () => newGameManager(parent) },
    { label: 'Interfaz (.ui)', icon: 'ui', run: () => newUi(parent) },
  ]
}
function createMenu(e) {
  const r = e.currentTarget.getBoundingClientRect()
  store.menu = { x: r.left, y: r.bottom + 2, items: createItems(folder.value) }
}
function bgMenu(e) {
  e.preventDefault()
  store.menu = {
    x: e.clientX, y: e.clientY,
    items: [
      { label: 'Crear', icon: 'plus', children: createItems(folder.value) },
      { sep: true },
      { label: 'Importar archivos…', icon: 'import', disabled: isSystemUiPath(folder.value) || isCinematicsFolder(folder.value), run: () => doImport() },
      ...(isCinematicsFolder(folder.value) ? [{ label: 'Importar película FilmMaker (.nfm)…', icon: 'import', run: importFilmDialog }] : []),
      { label: 'Importar paquete (.levelpackage)…', icon: 'import', run: pickPackage },
      { label: 'Exportar selección (.levelpackage)…', icon: 'export', disabled: !sel.value.length, run: () => doExport() },
      { label: 'Carpeta superior', run: up, disabled: folder.value === ROOT_FOLDER },
    ],
  }
}
const folderChoices = () => store.project.folders.filter(f => !isCinematicsFolder(f) || selectedItems().every(it => it.kind === 'cinematic' && store.project.cinematics?.some(c => c.id === it.id))).sort((a, b) => a.localeCompare(b, 'es'))
function scriptMenu(it) {
  const mode = store.project.scripts.find(script => script.id === it.id)?.execution || 'global'
  return [
    { label: 'Abrir en VS Code', icon: 'script', run: () => activate(it) },
    { label: 'Ejecución', children: [
      { label: 'Global', disabled: mode === 'global', run: () => setScriptExecution(it.id, 'global') },
      { label: 'Nodo', disabled: mode === 'node', run: () => setScriptExecution(it.id, 'node') },
    ] },
    { sep: true },
  ]
}
function itemMenu(e, it) {
  e.preventDefault(); e.stopPropagation()
  if (!isSel(it)) select(it)
  const list = selectedItems()
  const one = list.length === 1
  const embedded = list.some(item => item.embedded && item.kind !== 'timeline')
  const nonExportable = list.some(item => item.kind === 'cinematic') || embedded
  const rootSel = list.some((l) => (l.kind === 'folder' && (l.id === ROOT_FOLDER || l.id === 'Assets/UI' || isCinematicsFolder(l.id) || isSystemUiPath(l.id))) || isSystemUi(l))
  const own = !one ? [] : {
    folder: [{ label: 'Abrir', icon: 'folder-open', run: () => goto(it.id) }, { label: 'Crear aquí', icon: 'plus', children: createItems(it.id) }, { sep: true }],
    scene: [
      { label: 'Abrir escena', icon: 'scene', run: () => switchScene(it.id), disabled: isActiveScene(it) },
      { label: 'Instanciar en la escena', icon: 'scene', run: () => void store.editor.dropScene(it.id), disabled: isActiveScene(it) || store.locked || store.play.on || store.filmMode },
      { sep: true },
    ],
    model: [{ label: 'Colocar en la escena', icon: 'plus', run: () => activate(it) }, { sep: true }],
    prefab: [{ label: 'Instanciar en la escena', icon: 'prefab', run: () => activate(it) }, { sep: true }],
    timeline: [{ label: 'Abrir en Timeline', icon: 'play', run: () => activate(it) }, { sep: true }],
    cinematic: [{ label: 'Abrir en Cinematics', icon: 'play', run: () => openCinematics(it.id) },
      ...(!store.filmMode && store.project.cinematics?.some(c => c.id === it.id) ? [{ label: 'Editar en Nether FilmMaker', icon: 'play', run: () => openNativeCinematic(it.id) }] : []), { sep: true }],
    animation: [{ label: 'Clip heredado (solo datos)', icon: 'rotate', disabled: true }, { sep: true }],
    script: it.kind === 'script' ? scriptMenu(it) : [],
    shader: [{ label: 'Abrir en el editor', icon: 'shader', run: () => activate(it) }, { sep: true }],
    gamemanager: [{ label: 'Editar GameManager', icon: 'database', run: () => activate(it) }, { sep: true }],
    material: [{ label: 'Editar material', icon: 'sphere', run: () => activate(it) }, { sep: true }],
    liquid: [{ label: 'Editar propiedades del líquido', icon: 'droplets', run: () => activate(it) }, { sep: true }],
    vfx: [{ label: 'Abrir en editor VFX', icon: 'vfx', run: () => activate(it) }, { sep: true }],
    profile: [{ label: 'Abrir perfil', icon: 'light', run: () => activate(it) }, { sep: true }],
    ui: [{ label: 'Abrir en el editor de interfaz', icon: 'ui', run: () => activate(it) }, { sep: true }],
    texture: [{
      label: 'Usar en capa de terreno', icon: 'paint',
      children: store.project.terrain.layers.map((l, i) => ({
        label: `${i + 1} · ${l.name}`,
        run: () => { l.texture = it.id; commit('Textura de capa', { terrain: true }) },
      })),
    }, { sep: true }],
    file: [],
  }[it.kind] || []
  const dest = list.every((l) => l.kind !== 'folder') ? folderChoices() : folderChoices().filter((f) => !list.some((l) => l.kind === 'folder' && inside(f, l.id)))
  store.menu = {
    x: e.clientX, y: e.clientY,
    items: [
      ...own,
      { label: 'Renombrar', keys: 'F2', run: () => startRename(it), disabled: embedded || !one || (it.kind === 'folder' && it.id === ROOT_FOLDER) },
      { label: 'Duplicar', icon: 'copy', keys: 'Ctrl D', run: () => duplicate(list), disabled: embedded || rootSel || list.every((l) => l.kind === 'folder') },
      { label: 'Mover a', children: dest.map((f) => ({ label: f, run: () => moveItems(nested(list).map((l) => ({ kind: l.kind, id: l.id })), f) })), disabled: embedded || rootSel || !dest.length },
      { label: 'Exportar selección (.levelpackage)…', icon: 'export', disabled: nonExportable || rootSel, run: () => doExport(list) },
      { label: 'Copiar ruta', run: () => navigator.clipboard?.writeText(it.kind === 'folder' ? it.id : `${it.folder}/${it.file}`), disabled: embedded || !one },
      { sep: true },
      { label: one ? 'Eliminar' : `Eliminar ${list.length} elementos`, icon: 'trash', keys: 'Supr', danger: true, run: () => remove(list), disabled: !canRemove(list) || rootSel },
    ],
  }
}
function treeMenu(e, r) {
  e.preventDefault(); e.stopPropagation()
  const it = { kind: 'folder', id: r.path, name: r.name }
  store.menu = {
    x: e.clientX, y: e.clientY,
    items: [
      { label: 'Abrir', icon: 'folder-open', run: () => goto(r.path) },
      { label: 'Crear aquí', icon: 'plus', disabled: isSystemUiPath(r.path), children: createItems(r.path) },
      ...(isCinematicsFolder(r.path) ? [{ label: 'Importar película FilmMaker (.nfm)…', icon: 'import', run: importFilmDialog }] : []),
      { sep: true },
      { label: 'Renombrar', keys: 'F2', run: () => startRename(it, 'tree'), disabled: r.path === ROOT_FOLDER || r.path === 'Assets/UI' || isCinematicsFolder(r.path) || isSystemUiPath(r.path) },
      { label: 'Importar aquí…', icon: 'import', disabled: isSystemUiPath(r.path) || isCinematicsFolder(r.path), run: () => doImport(r.path) },
      { label: 'Exportar carpeta (.levelpackage)…', icon: 'export', disabled: isSystemUiPath(r.path), run: () => doExport([it]) },
      { sep: true },
      { label: 'Eliminar', icon: 'trash', danger: true, run: () => remove([{ ...it, name: r.name }]), disabled: r.path === ROOT_FOLDER || r.path === 'Assets/UI' || isCinematicsFolder(r.path) || isSystemUiPath(r.path) },
    ],
  }
}

// ---------- arrastrar y soltar ----------
function dragStart(e, it) {
  if ((it.kind === 'folder' && (it.id === ROOT_FOLDER || it.id === 'Assets/UI' || isCinematicsFolder(it.id) || isSystemUiPath(it.id))) || isSystemUi(it)) { e.preventDefault(); return }
  clearTimeout(renameTimer)
  if (!isSel(it)) select(it)
  if ((it.embedded && it.kind !== 'timeline') || selectedItems().some(item => item.embedded && item.kind !== 'timeline')) { e.preventDefault(); return }
  dragging = nested(selectedItems().length ? selectedItems() : [it]).map((l) => ({ kind: l.kind, id: l.id }))
  if (!dragging.length) dragging = [{ kind: it.kind, id: it.id }]
  if (dragging.some(d => d.kind === 'folder' && isCinematicsFolder(d.id))) { dragging = []; e.preventDefault(); return }
  e.dataTransfer.effectAllowed = 'copyMove'
  if (!writeAssetDrag(e.dataTransfer, dragging, it.name)) { dragging = []; e.preventDefault() }
}
const endDrag = () => { dragging = []; hover.value = null }
const hasType = (e, t) => e.dataTransfer?.types?.includes(t)
const accepts = (e) => hasType(e, 'application/x-lf-entries') || hasType(e, 'application/x-lf-node') || hasType(e, 'Files')
function canDrop(path) {
  if (isSystemUiPath(path) || isCinematicsFolder(path)) return false
  if (!dragging.length) return true
  if (dragging.some(d => d.kind === 'folder' && isCinematicsFolder(d.id))) return false
  return !dragging.some((d) => (d.kind === 'folder' && (inside(path, d.id) || parentFolder(d.id) === path)) || (d.kind !== 'folder' && false))
}
function dragOver(e, path) {
  if (!accepts(e) || !canDrop(path)) return
  e.preventDefault()
  e.dataTransfer.dropEffect = hasType(e, 'Files') || hasType(e, 'application/x-lf-node') ? 'copy' : 'move'
  hover.value = path
}
async function drop(e, path) {
  e.preventDefault(); e.stopPropagation()
  hover.value = null
  if (!canDrop(path)) { dragging = []; return }
  if (hasType(e, 'application/x-lf-entries') && dragging.length) {
    const list = dragging
    dragging = []
    const n = moveItems(list, path)
    if (n) open.add(path)
  } else if (hasType(e, 'application/x-lf-node')) {
    let ids = []
    try { ids = JSON.parse(e.dataTransfer.getData('application/x-lf-node')) } catch { /* ignorar */ }
    createPrefab(ids, path)
  } else if (e.dataTransfer.files?.length) {
    await importFiles(Array.from(e.dataTransfer.files), path)
  }
}

// ---------- teclado ----------
function cols() {
  const g = grid.value
  return g ? Math.max(1, getComputedStyle(g).gridTemplateColumns.split(' ').length) : 1
}
function onKey(e) {
  if (e.target.tagName === 'INPUT') return
  const mod = e.ctrlKey || e.metaKey
  const list = selectedItems()
  const it = list.at(-1)
  if (e.key === 'F2' && it && list.length === 1) { e.preventDefault(); e.stopPropagation(); startRename(it) }
  else if (e.key === 'Delete' && list.length) { e.preventDefault(); e.stopPropagation(); remove(list) }
  else if (mod && e.key.toLowerCase() === 'd' && list.length) { e.preventDefault(); e.stopPropagation(); duplicate(list) }
  else if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); e.stopPropagation(); setSel(items.value.map((x) => ({ kind: x.kind, id: x.id }))) }
  else if (e.key === 'Enter' && it) activate(it)
  else if (e.key === 'Backspace' || (e.altKey && e.key === 'ArrowUp')) { if (!list.length) up() }
  else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && items.value.length) {
    e.preventDefault()
    const keys = items.value.map(keyOf)
    const cur = it ? keys.indexOf(keyOf(it)) : -1
    const step = viewMode.value === 'list' ? 1 : cols()
    const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -step, ArrowDown: step }[e.key]
    const n = Math.min(items.value.length - 1, Math.max(0, cur < 0 ? 0 : cur + d))
    select(items.value[n], e)
    nextTick(() => grid.value?.querySelector('.tile.sel:last-of-type, .tile.sel')?.scrollIntoView({ block: 'nearest' }))
  }
}

const tileStyle = computed(() => ({ '--sz': store.prefs.projSize + 'px' }))
function assetMenu(event, items) {
  const button = event.currentTarget
  const bounds = button.getBoundingClientRect()
  store.menu = { x: bounds.left, y: bounds.bottom + 3, items, returnFocus: button }
}
function assetFilters(event) {
  const types = [['', 'Todos los recursos'], ['scene', 'Escenas'], ['script', 'Scripts'], ['material', 'Materiales'], ['texture', 'Texturas'], ['model', 'Modelos'], ['prefab', 'Prefabs']]
  const text = filter.value.replace(/^t:\S+\s*/i, '')
  assetMenu(event, types.map(([kind, label]) => ({ label, run: () => { filter.value = [kind && 't:' + kind, text].filter(Boolean).join(' ') } })))
}
function assetSettings(event) {
  const hasUnsupportedSelection = selectedItems().some(it => it.kind === 'cinematic' || (it.embedded && it.kind !== 'timeline'))
  assetMenu(event, [
    { label: 'Vista cuadrícula', icon: 'grid', checked: viewMode.value === 'grid', run: () => { viewMode.value = 'grid' } },
    { label: 'Vista lista', icon: 'list', checked: viewMode.value === 'list', run: () => { viewMode.value = 'list' } },
    { label: 'Árbol de carpetas', icon: 'folder', checked: !!store.prefs.projTreeOpen, run: () => { store.prefs.projTreeOpen = !store.prefs.projTreeOpen } },
    { sep: true },
    { label: 'Ordenar por nombre', checked: sortMode.value === 'name', run: () => { sortMode.value = 'name' } },
    { label: 'Ordenar por tipo', checked: sortMode.value === 'type', run: () => { sortMode.value = 'type' } },
    { sep: true },
    { label: 'Importar .levelpackage…', icon: 'import', run: pickPackage },
    { label: 'Exportar .levelpackage…', icon: 'export', disabled: !sel.value.length || hasUnsupportedSelection, run: () => doExport() },
  ])
}
</script>

<template>
  <div ref="root" class="proj" :class="{ narrow }" @keydown="onKey">
    <div class="bar">
      <button class="ghost icon asset-tool" aria-label="Filtrar recursos" title="Filtrar recursos" @click="assetFilters"><img :src="filterArt" alt="" /></button>
      <div class="find"><img :src="searchArt" alt="" /><input v-model="filter" placeholder="Buscar recursos…" spellcheck="false" aria-label="Buscar archivos" /></div>
      <span class="grow"></span>
      <button class="ghost icon create asset-tool" data-tooltip="Crear recurso" aria-label="Crear" :disabled="isSystemUiPath(folder)" @click="createMenu"><img :src="plusArt" alt="" /></button>
      <button class="ghost icon" data-tooltip="Importar archivos (modelos .glb .obj, texturas…)" aria-label="Importar" @click="doImport()"><Icon name="import" :size="14" /></button>
      <input v-if="viewMode === 'grid'" v-model.number="store.prefs.projSize" class="zoom" type="range" min="44" max="110" step="2" data-tooltip="Tamaño de los iconos" aria-label="Tamaño de los iconos" />
      <button class="ghost icon asset-tool" aria-label="Ajustes del navegador de recursos" title="Ajustes del navegador de recursos" @click="assetSettings"><img :src="settingsArt" alt="" /></button>
    </div>
    <div v-if="folder !== ROOT_FOLDER" class="location">
      <button class="ghost" aria-label="Subir un nivel" @click="up"><Icon name="chevron-right" :size="13" style="transform: rotate(180deg)" />Atrás</button>
      <nav class="crumbs" aria-label="Ruta">
        <template v-for="(c, i) in crumbs" :key="c.path">
          <Icon v-if="i" name="chevron-right" :size="11" class="sep" />
          <button
            class="ghost cr" :class="{ last: i === crumbs.length - 1, hov: hover === 'crumb:' + c.path }"
            @click="goto(c.path)" @dragover="dragOver($event, c.path); hover = hover === c.path ? 'crumb:' + c.path : hover" @dragleave="hover = null" @drop="drop($event, c.path)"
          >{{ c.name }}</button>
        </template>
      </nav>
    </div>

    <div class="body">
      <aside v-if="displayTree" class="ptree" aria-label="Carpetas" @contextmenu.prevent>
        <div
          v-for="r in treeRows" :key="r.path" class="trow" :class="{ on: r.path === folder, hov: hover === r.path }"
          :style="{ paddingLeft: 6 + r.depth * 13 + 'px' }" :draggable="r.path !== ROOT_FOLDER && !isCinematicsFolder(r.path)"
          @click="goto(r.path)" @contextmenu="treeMenu($event, r)" @dblclick.stop="startRename(r, 'tree')"
          @dragstart="dragStart($event, r)" @dragend="endDrag" @dragover="dragOver($event, r.path)" @dragleave="hover = null" @drop="drop($event, r.path)"
        >
          <button class="chev" :class="{ hidden: !r.kids }" tabindex="-1" @click.stop="open.has(r.path) ? open.delete(r.path) : open.add(r.path)">
            <Icon :name="open.has(r.path) ? 'chevron-down' : 'chevron-right'" :size="11" />
          </button>
          <img :src="r.path === folder ? folderOpen : folderClosed" class="fi" alt="" />
          <input
            v-if="rename && rename.key === 'tree:' + keyOf(r)" v-model="draft" class="rn tr" @click.stop @dblclick.stop
            @keydown.enter="finishRename(true)" @keydown.esc="finishRename(false)" @blur="finishRename(true)"
          />
          <span v-else class="tn">{{ r.name }}</span>
          <span v-if="r.count" class="cnt">{{ r.count }}</span>
        </div>
      </aside>

      <div
        ref="grid" class="grid" :class="{ 'asset-list': viewMode === 'list', hov: hover === folder }" tabindex="0" :style="tileStyle"
        @click.self="setSel([])" @contextmenu="bgMenu"
        @dragover="dragOver($event, folder)" @dragleave.self="hover = null" @drop="drop($event, folder)"
      >
        <div
          v-for="it in items" :key="keyOf(it)" class="tile" :class="{ sel: isSel(it), hov: it.kind === 'folder' && hover === it.id, cur: isActiveScene(it) }"
          :draggable="(!it.embedded || it.kind === 'timeline') && !(it.kind === 'folder' && isCinematicsFolder(it.id))" :data-tooltip="it.hint ? `${it.hint}/${it.file || it.name}` : it.name"
          @click.stop="tileClick($event, it)" @dblclick.stop="dblOpen(it)" @contextmenu="itemMenu($event, it)"
          @dragstart="dragStart($event, it)" @dragend="endDrag"
          @dragover="it.kind === 'folder' && dragOver($event, it.id)" @drop="it.kind === 'folder' && drop($event, it.id)" @dragleave="hover = null"
        >
          <div class="thumb" :class="it.kind">
            <img v-if="it.kind === 'texture' && urls[it.id]" :src="urls[it.id]" alt="" draggable="false" @load="dims[it.id] = `${$event.target.naturalWidth}×${$event.target.naturalHeight} px`" />
            <img v-else class="asset-art" :src="artwork(it)" alt="" draggable="false" />
            <span v-if="isActiveScene(it)" class="dot" data-tooltip="Escena abierta"></span>
          </div>
          <input
            v-if="rename && rename.key === keyOf(it)" v-model="draft" class="rn" @click.stop @dblclick.stop
            @keydown.enter="finishRename(true)" @keydown.esc="finishRename(false)" @blur="finishRename(true)"
          />
          <span v-else class="lbl">{{ it.name }}</span>
          <span v-if="viewMode === 'list'" class="asset-type">{{ ({ folder: 'Carpeta', timeline: 'Timeline', cinematic: 'Cinematics', animation: 'Clip de animación' }[it.kind] || it.kind) }}</span>
        </div>

        <div v-if="!items.length" class="empty">
          <template v-if="filter">Ningún archivo coincide con «{{ filter }}».</template>
          <template v-else-if="isCinematicsFolder(folder)">Crea un <b>Cinematic</b> con el botón <b>+</b> para editarlo en Nether FilmMaker, o importa una película externa <b>.nfm</b> desde el menú contextual.</template><template v-else>Carpeta vacía.<br />Arrastra aquí archivos <b>.glb</b>, <b>.obj</b> o imágenes, nodos de la Jerarquía (crean un <b>prefab</b>), o usa <b>+</b> / clic derecho.</template>
        </div>
      </div>
    </div>

    <div v-if="packagePreview" class="lp-overlay" role="dialog" aria-modal="true" aria-label="Importar LevelPackage" @keydown.esc.stop="packagePreview = null">
      <div class="lp-window">
        <header class="lp-head"><b>Importar .levelpackage</b><button class="ghost" aria-label="Cerrar" :disabled="packageBusy" @click="packagePreview = null">×</button></header>
        <p class="lp-note">{{ packagePreview.manifest.sourceProject?.name || 'Proyecto origen' }} · Formato v{{ packagePreview.manifest.version }} · {{ packagePreview.manifest.entries.length }} recursos. Los recursos marcados como dependencia se incluyen automáticamente.</p>
        <div class="lp-list">
          <div v-for="e in packagePreview.manifest.entries" :key="e.id" class="lp-item">
            <input type="checkbox" :checked="packageClosure.has(e.id)" :disabled="packageBusy || (packageClosure.has(e.id) && !packagePicked.includes(e.id))" :aria-label="'Importar ' + e.name" @change="togglePackageEntry(e.id, $event.target.checked)" />
            <div class="lp-details"><b>{{ e.name }}</b><small>{{ e.kind }} · {{ e.path }} <template v-if="packageClosure.has(e.id) && !packagePicked.includes(e.id)">· Dependencia obligatoria</template></small></div>
            <select v-if="packageConflict(e) && packageClosure.has(e.id)" v-model="packageDecisions[e.id]" :disabled="packageBusy" :aria-label="'Resolver conflicto ' + e.name">
              <option :value="undefined" disabled>Resolver conflicto…</option>
              <option value="rename">Importar renombrado</option>
              <option v-if="packageConflict(e).kind === e.kind" value="reuse">Reutilizar existente</option>
              <option value="skip">Omitir recurso</option>
            </select>
            <span v-else-if="packageClosure.has(e.id)" class="lp-tag">Nuevo</span>
          </div>
        </div>
        <p class="lp-note">Las escenas pueden depender de Database, InputMap u otros datos globales. Se avisará antes de importarlas; no se fusionan automáticamente. El inventario de archivos importados no se deshace con Ctrl+Z.</p>
        <footer class="lp-foot"><span>{{ packageClosure.size }} seleccionado(s) · {{ packageUnresolved ? 'Hay conflictos pendientes' : 'Listo para validar' }}</span><button class="ghost" :disabled="packageBusy" @click="packagePreview = null">Cancelar</button><button :disabled="packageBusy || !packageClosure.size || packageUnresolved" @click="applyPackage">Importar selección</button></footer>
      </div>
    </div>
    <footer class="info" :data-tooltip="info">{{ info }}</footer>
  </div>
</template>

<style scoped>
.proj { display: flex; flex-direction: column; height: 100%; min-height: 0; min-width: 0; outline: none; }
.bar { display: flex; align-items: center; gap: 5px; height: 32px; padding: 0 6px; background: var(--g-800); border-bottom: 1px solid var(--hair); flex: none; }
.asset-tool img, .find img { width: 21px; height: 21px; object-fit: contain; flex: none; }
.location { display: flex; align-items: center; gap: 6px; padding: 3px 8px; border-bottom: 1px solid var(--hair-soft); }
.crumbs { display: flex; align-items: center; min-width: 0; overflow: hidden; }
.cr { height: 22px; padding: 0 5px; color: var(--text-3); }
.cr.last { color: var(--text); font-weight: 500; }
.cr.hov { outline: 1px solid var(--blue); background: var(--blue-wash); }
.rn.tr { flex: 1; height: 18px; text-align: left; min-width: 0; }
.sep { color: var(--text-3); flex: none; }
.grow { flex: 1; }
.find { display: flex; align-items: center; gap: 3px; padding: 0 5px; background: var(--g-950); border: 1px solid var(--hair-soft); border-radius: var(--r); color: var(--text-3); flex: 1 1 360px; max-width: 432px; min-width: 55px; }
.find:focus-within { border-color: var(--blue); }
.find input { border: none; background: transparent; padding: 0; height: 20px; flex: 1; min-width: 0; }
.find input:focus { outline: none; }
.zoom { width: 70px; flex: none; }
.body { display: flex; flex: 1; min-height: 0; }
.ptree { width: 168px; flex: none; overflow: auto; border-right: 1px solid var(--hair); padding: 4px 0; background: var(--g-900); }
.trow { display: flex; align-items: center; gap: 4px; height: 22px; padding-right: 8px; cursor: default; }
.trow:hover { background: var(--g-800); }
.trow.on { background: var(--blue-wash); }
.trow.hov { outline: 1px solid var(--blue); outline-offset: -1px; background: var(--blue-wash); }
.chev { width: 14px; height: 14px; padding: 0; background: transparent; border: none; color: var(--text-3); flex: none; }
.chev.hidden { visibility: hidden; }
.fi { width: 22px; height: 22px; object-fit: contain; flex: none; }
.tn { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cnt { font-size: 10px; color: var(--text-3); }

.grid { flex: 1; min-width: 0; overflow: auto; padding: 8px; display: grid; grid-template-columns: repeat(auto-fill, calc(var(--sz) + 16px)); grid-auto-rows: max-content; gap: 6px 4px; align-content: start; outline: none; }
.grid.hov { background: var(--blue-wash); }
.tile { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 4px 3px 5px; border-radius: 4px; border: 1px solid transparent; cursor: default; min-width: 0; width: calc(var(--sz) + 16px); }
.tile:hover { background: var(--g-800); }
.tile.sel { background: var(--editor-selection); border-color: transparent; }
.tile.hov { outline: 1px solid var(--blue); background: var(--blue-wash); }
.thumb { position: relative; width: var(--sz); height: var(--sz); display: flex; align-items: center; justify-content: center; border-radius: 4px; overflow: hidden; color: var(--text-3); }
.thumb.folder { background: transparent; color: #c9a45a; }
.thumb.scene { color: var(--blue-hi); }
.thumb.model { color: var(--n-model); }
.thumb.prefab { color: var(--blue-hi); }
.thumb.script { color: var(--amber); }
.thumb.ui { color: var(--blue); }
.thumb img { width: 100%; height: 100%; object-fit: cover; image-rendering: auto; }
.thumb img.asset-art { object-fit: contain; }
.dot { position: absolute; top: 3px; right: 3px; width: 7px; height: 7px; border-radius: 50%; background: var(--ok); }
.lbl { max-width: 100%; text-align: center; line-height: 1.2; font-size: 11px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
.tile.cur .lbl { color: var(--blue-hi); }
.rn { width: 100%; height: 20px; padding: 0 3px; font-size: 11px; text-align: center; }
.empty { grid-column: 1 / -1; padding: 22px 10px; text-align: center; color: var(--text-3); line-height: 1.6; }
.info { height: 22px; line-height: 21px; padding: 0 10px; border-top: 1px solid var(--hair); color: var(--text-3); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: none; }
.narrow .find { width: 90px; flex-basis: 90px; }
.narrow .zoom { display: none; }
.lp-overlay { position: fixed; inset: 0; z-index: 2000; background: #0009; display: flex; justify-content: center; align-items: center; padding: 20px; }
.lp-window { width: min(750px, 94vw); max-height: 82vh; background: var(--g-900); border: 1px solid var(--hair); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 14px 50px #0009; }
.lp-head, .lp-foot { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.lp-list { overflow: auto; min-height: 90px; border: 1px solid var(--hair); border-radius: 5px; }
.lp-item { display: flex; align-items: center; padding: 7px 9px; gap: 10px; border-bottom: 1px solid var(--hair); }
.lp-item:last-child { border-bottom: 0; }
.lp-details { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 2px; }
.lp-details small { color: var(--text-3); overflow-wrap: anywhere; }
.lp-note { color: var(--text-3); font-size: 11px; line-height: 1.5; margin: 0; }
.lp-tag { color: var(--text-3); font-size: 11px; }
.lp-item select { max-width: 168px; min-width: 130px; }
.lp-foot span { color: var(--text-3); font-size: 11px; margin-right: auto; }
/* Navegador de recursos: lista densa, iconos reales y controles discretos. */
.grid.asset-list { display: flex; flex-direction: column; gap: 0; padding: 4px; align-content: initial; }
.asset-list .tile { flex-direction: row; align-items: center; gap: 9px; min-height: 26px; height: 26px; width: auto; padding: 2px 8px; border-radius: 2px; flex: none; }
.asset-list .thumb { width: 20px; height: 20px; background: transparent; border-radius: 2px; flex: none; }
.asset-list .thumb img { object-fit: contain; }
.asset-list .lbl { flex: 1; text-align: left; white-space: nowrap; display: block; overflow: hidden; text-overflow: ellipsis; font-size: 11px; }
.asset-type { min-width: 75px; max-width: 95px; text-align: left; font-size: 10px; color: var(--text-3); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
.asset-list .empty { padding: 22px 10px; }
.asset-list .rn { flex: 1; text-align: left; }
.asset-list .dot { width: 5px; height: 5px; }
</style>
