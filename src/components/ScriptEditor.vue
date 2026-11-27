<script setup>
// Editor de scripts: CodeMirror y API Century existentes, con navegación de recursos y métodos.
// El store continúa siendo dueño de los documentos, el modo de ejecución y el guardado.
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { Compartment, EditorState, Prec } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { javascript } from '@codemirror/lang-javascript'
import { openSearchPanel, gotoLine } from '@codemirror/search'
import { undo, redo, toggleComment } from '@codemirror/commands'
import { forEachDiagnostic, openLintPanel, nextDiagnostic } from '@codemirror/lint'
import { startCompletion } from '@codemirror/autocomplete'
import { store, createScript, setScriptCode, setScriptExecution, openScriptEditor, closeScriptEditor, saveAll, openInVSCode, toast, openDocs } from '../core/store.js'
import { jsIntelligence, formatCode } from '../core/editor/jsintel.js'
import { outlineForDocument } from '../core/editor/analysis.js'
import { editorLook, minimap } from '../core/editor/theme.js'
import { projectNames, scriptOwnerTypes } from '../core/vscode/files.js'
import { scriptPath } from '../core/vscode/plan.js'
import { loadScene } from '../core/db.js'
import FloatingEditorWindow from './FloatingEditorWindow.vue'
import { activateCodeDock } from '../core/editor/view-dock-session.js'
import Icon from './Icon.vue'

const sc = computed(() => store.project?.scripts.find((item) => item.id === store.scriptEditId))
const inactiveScenes = ref(new Map())
let sceneReadGeneration = 0
const intelligenceScenes = computed(() => {
  const p = store.project
  if (!p) return new Map()
  const scenes = new Map(inactiveScenes.value)
  scenes.set(p.activeSceneId, { objects: p.objects || [] })
  return scenes
})
const ownerType = computed(() => {
  const p = store.project, script = sc.value
  if (!p || script?.execution !== 'node') return null
  return JSON.parse(scriptOwnerTypes(p, intelligenceScenes.value)).owners[scriptPath(script)] || null
})
const intelligenceNames = computed(() => store.project ? projectNames(store.project, intelligenceScenes.value) : {})
const namesForScript = () => intelligenceNames.value
const intelligenceOptions = script => ({ context: script.execution === 'node' ? 'nodeScript' : 'script', ownerType: ownerType.value, names: namesForScript })
watch(() => [store.project, store.project?.activeSceneId, ...(store.project?.scenes || []).map(s => s.id)], async () => {
  const p = store.project, generation = ++sceneReadGeneration
  inactiveScenes.value = new Map()
  if (!p) return
  const scenes = new Map()
  for (const scene of p.scenes || []) {
    if (scene.id === p.activeSceneId) continue
    try {
      const saved = await loadScene(p.id, scene.id)
      if (saved) scenes.set(scene.id, saved)
    } catch { /* una escena no disponible impide inferir un propietario específico */ }
  }
  if (generation === sceneReadGeneration && p === store.project) inactiveScenes.value = scenes
}, { immediate: true })
const code = ref(sc.value?.code ?? '')
const editorHost = ref(null)
const scriptSearchInput = ref(null)
const commandCenterInput = ref(null)
const menuBar = ref(null)
const scriptSearch = ref('')
const showNavigator = ref(readPref('lf.se.navigator', true))
const activityMode = ref('explorer')
const cursor = ref({ line: 1, column: 1 })
const wordWrap = ref(true)
const showMap = ref(readPref('lf.se.minimap', true))
const showOutline = ref(readPref('lf.se.outline', true))
const problems = ref({ error: 0, warning: 0, info: 0 })
const formatting = ref(false)
const wrapping = new Compartment()
const mapComp = new Compartment()
const intelligence = new Compartment()
let editor = null
let syncingProjectDocument = false
let editorRoot = null

function readPref(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : v === '1' } catch { return def } }
function writePref(k, v) { try { localStorage.setItem(k, v ? '1' : '0') } catch { /* sin almacenamiento */ } }

const savedLabel = computed(() => store.saveState === 'saved' && store.disk.state !== 'dirty' && store.disk.state !== 'error' ? 'Guardado' : 'Sin guardar')
const outlineByScript = new Map()
const outlineSnapshot = ref(outlineForDocument(code.value))
if (sc.value) outlineByScript.set(sc.value.id, outlineSnapshot.value)
const outline = computed(() => outlineSnapshot.value.items)

function refreshOutline(text, id = sc.value?.id, changes = null, reset = false) {
  if (!id) return
  const previous = reset ? [] : (outlineByScript.get(id)?.items ?? [])
  const next = outlineForDocument(text, previous, changes ? pos => changes.mapPos(pos, 1) : undefined)
  outlineByScript.set(id, next)
  if (id === sc.value?.id) outlineSnapshot.value = next
}
const scriptGroups = computed(() => {
  const query = scriptSearch.value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const groups = new Map()
  for (const item of store.project?.scripts ?? []) {
    const path = `${item.folder}/${item.name}`
    if (query && !path.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(query)) continue
    if (!groups.has(item.folder)) groups.set(item.folder, [])
    groups.get(item.folder).push(item)
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b, 'es')).map(([folder, items]) => ({
    folder, items: items.sort((a, b) => a.name.localeCompare(b.name, 'es')),
  }))
})
/** Función o región en la que está el cursor (para la ruta de arriba). */
const currentSymbol = computed(() => {
  let cur = null
  for (const o of outline.value) if (!o.provisional && o.line <= cursor.value.line) cur = o
  return cur
})
const OUTLINE_ICON = { define: 'ƒ', on: '⚡', function: 'ƒ', region: '#' }

function updateCursor(view) {
  const head = view.state.selection.main.head
  const line = view.state.doc.lineAt(head)
  cursor.value = { line: line.number, column: head - line.from + 1 }
}
function countProblems(state) {
  const n = { error: 0, warning: 0, info: 0 }
  forEachDiagnostic(state, (d) => { n[d.severity] = (n[d.severity] || 0) + 1 })
  problems.value = n
}
const menuItems = [
  { name: 'Archivo', actions: [['Nuevo script', 'new'], ['Abrir script…', 'open'], ['Guardar', 'save', 'Ctrl+S'], ['Abrir en VS Code', 'vscode']] },
  { name: 'Editar', actions: [['Deshacer', 'undo', 'Ctrl+Z'], ['Rehacer', 'redo', 'Ctrl+Mayús+Z'], ['Comentar selección', 'comment'], ['Formatear', 'format', 'Mayús+Alt+F']] },
  { name: 'Buscar', actions: [['Buscar y reemplazar', 'find', 'Ctrl+F'], ['Buscar script…', 'open', 'Ctrl+P']] },
  { name: 'Ir a', actions: [['Ir a línea…', 'line'], ['Ir a método…', 'method']] },
  { name: 'Ver', actions: [['Navegador de scripts', 'navigator'], ['Métodos y regiones', 'outline'], ['Minimapa', 'minimap'], ['Ajuste de línea', 'wrap'], ['Problemas', 'problems']] },
  { name: 'Ayuda', actions: [['Referencia API Century', 'api']] },
]
function save() { void saveAll() }
function createAndOpenScript() {
  const script = createScript()
  if (script) openScriptEditor(script.id)
}
async function openVSCodeWorkspace(scriptId = null) {
  try { await openInVSCode(scriptId) }
  catch (error) { toast(String(error?.message || error), 'error', 4500) }
}
const documentMenuActions = new Set(['undo', 'redo', 'comment', 'format', 'find', 'line', 'method', 'minimap', 'wrap', 'problems'])
function menuActionDisabled(action) { return !sc.value && documentMenuActions.has(action) }
function onMenuToggle(event) {
  if (!event.target.open) return
  for (const sibling of menuBar.value?.querySelectorAll('details[open]') || []) if (sibling !== event.target) sibling.open = false
}
function runMenuAction(action, event) {
  const details = event.currentTarget.closest('details')
  if (details) details.open = false
  switch (action) {
    case 'new': createAndOpenScript(); break
    case 'open': void focusScriptSearch(); break
    case 'save': save(); break
    case 'vscode': if (sc.value) openInVSCode(sc.value.id); else void openVSCodeWorkspace(); break
    case 'undo': if (editor) { undo(editor); editor.focus() } break
    case 'redo': if (editor) { redo(editor); editor.focus() } break
    case 'comment': if (editor) { toggleComment(editor); editor.focus() } break
    case 'format': void format(); break
    case 'find': showFind(); break
    case 'line': if (editor) { gotoLine(editor); editor.focus() } break
    case 'method': if (!showNavigator.value) toggleNavigator(); showOutline.value = true; break
    case 'navigator': toggleNavigator(); break
    case 'outline': toggleOutline(); break
    case 'minimap': toggleMinimap(); break
    case 'wrap': toggleWordWrap(); break
    case 'problems': showProblems(); break
    case 'api': openDocs('referencia/api.md'); break
  }
}
function onShellKeydown(event) {
  if (sc.value || event.altKey || !(event.ctrlKey || event.metaKey)) return
  const key = event.key.toLowerCase()
  if (key === 'n') { event.preventDefault(); createAndOpenScript() }
  else if (key === 'p') { event.preventDefault(); void focusCommandCenter() }
  else if (key === 's') { event.preventDefault(); save() }
}
function onEscape(event) {
  const menus = menuBar.value?.querySelectorAll('details[open]') || []
  if (menus.length) { for (const menu of menus) menu.open = false; return }
  // CodeMirror usa Escape para la búsqueda, las sugerencias y la ayuda de parámetros: no cierra la ventana.
  // composedPath(): CodeMirror quita el campo de búsqueda del DOM al cerrar el panel, y entonces `target.closest()` ya no encuentra el editor
  if (event.composedPath().some((n) => n.classList?.contains('cm-editor'))) return
  if (store.ui.mode !== 'desktop') closeScriptEditor()
}
function showFind() { if (editor) openSearchPanel(editor) }
function showProblems() { if (!editor) return; openLintPanel(editor); if (problems.value.error + problems.value.warning + problems.value.info) nextDiagnostic(editor) }
function toggleWordWrap() {
  wordWrap.value = !wordWrap.value
  editor?.dispatch({ effects: wrapping.reconfigure(wordWrap.value ? EditorView.lineWrapping : []) })
  editor?.focus()
}
function toggleMinimap() {
  showMap.value = !showMap.value
  writePref('lf.se.minimap', showMap.value)
  editor?.dispatch({ effects: mapComp.reconfigure(showMap.value ? minimap() : []) })
}
function toggleOutline() { showOutline.value = !showOutline.value; writePref('lf.se.outline', showOutline.value) }
function toggleNavigator() {
  showNavigator.value = !showNavigator.value
  if (showNavigator.value) activityMode.value = 'explorer'
  writePref('lf.se.navigator', showNavigator.value)
}
async function focusScriptSearch() {
  activityMode.value = 'search'
  if (!showNavigator.value) { showNavigator.value = true; writePref('lf.se.navigator', true) }
  await nextTick()
  scriptSearchInput.value?.focus()
  scriptSearchInput.value?.select()
}
async function focusCommandCenter() {
  activityMode.value = 'search'
  await nextTick()
  commandCenterInput.value?.focus()
  commandCenterInput.value?.select()
}
function openFirstFilteredScript() {
  const first = scriptGroups.value[0]?.items[0]
  if (first) selectScript(first.id)
}
function showExplorerFromActivity() {
  activityMode.value = 'explorer'
  if (!showNavigator.value) { showNavigator.value = true; writePref('lf.se.navigator', true) }
}
async function showOutlineFromActivity() {
  activityMode.value = 'outline'
  if (!showNavigator.value) { showNavigator.value = true; writePref('lf.se.navigator', true) }
  if (!showOutline.value) { showOutline.value = true; writePref('lf.se.outline', true) }
  await nextTick()
  const doc = editorHost.value?.ownerDocument || document
  doc.querySelector('.se-methods')?.scrollIntoView({ block: 'nearest' })
}
function clearScriptSearch() { scriptSearch.value = ''; editor?.focus() }
function selectScript(id) {
  if (id === sc.value?.id) { editor?.focus(); return }
  openScriptEditor(id)
}
function goTo(pos) {
  if (!editor) return
  editor.dispatch({ selection: { anchor: pos }, effects: EditorView.scrollIntoView(pos, { y: 'center' }) })
  editor.focus()
}
async function format() {
  if (!editor || formatting.value) return
  formatting.value = true
  try {
    const activeId = sc.value?.id
    const before = editor.state.doc.toString()
    const out = await formatCode(before, sc.value?.execution === 'node' ? 'nodeScript' : 'script')
    // Si cambió el documento durante el formateo, no sobrescribir el script ahora activo.
    if (!editor || sc.value?.id !== activeId || editor.state.doc.toString() !== before) return
    if (out !== before) {
      const head = Math.min(editor.state.selection.main.head, out.length)
      editor.dispatch({ changes: { from: 0, to: before.length, insert: out }, selection: { anchor: head }, userEvent: 'format' })
    }
  } catch (e) {
    toast('No se puede formatear: ' + String(e.message || e).split('\n')[0], 'error', 4000)
  } finally { formatting.value = false; editor?.focus() }
}

function createEditorState(script) {
  return EditorState.create({
    doc: script.code ?? '',
    extensions: [
      basicSetup,
      javascript(),
      editorLook(),
      mapComp.of(showMap.value ? minimap() : []),
      intelligence.of(jsIntelligence(intelligenceOptions(script))),
      wrapping.of(EditorView.lineWrapping),
      Prec.highest(keymap.of([
        { key: 'Mod-s', run: () => { save(); return true } },
        { key: 'Mod-p', run: () => { void focusCommandCenter(); return true } },
        { key: 'Mod-h', run: (view) => { openSearchPanel(view); return true } },
        { key: 'Alt-z', run: () => { toggleWordWrap(); return true } },
        { key: 'Shift-Alt-f', run: () => { void format(); return true } },
        { key: 'Mod-Shift-m', run: () => { showProblems(); return true } },
        { key: 'Mod-i', run: startCompletion },
      ])),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          code.value = update.state.doc.toString()
          if (sc.value && !syncingProjectDocument) {
            refreshOutline(code.value, sc.value.id, update.changes)
            setScriptCode(sc.value.id, code.value)
          }
        }
        if (update.docChanged || update.selectionSet) updateCursor(update.view)
        if (update.transactions.length) countProblems(update.state)
      }),
    ],
  })
}

watch(editorHost, (host) => {
  if (!host || !sc.value) {
    if (!host && editor) { editor.destroy(); editor = null; editorRoot = null }
    return
  }
  editor?.destroy()
  code.value = sc.value.code ?? ''
  refreshOutline(code.value, sc.value.id)
  editorRoot = host.ownerDocument
  editor = new EditorView({ parent: host, root: editorRoot, state: createEditorState(sc.value) })
  updateCursor(editor)
  editor.focus()
}, { flush: 'post' })
// Navegar por recursos cambia la vista del mismo editor, sin duplicar documentos ni el estado del proyecto.
watch(() => sc.value?.id, (id, previous) => {
  if (!editor || !id || id === previous) return
  const next = sc.value.code ?? ''
  editor.setState(createEditorState(sc.value))
  code.value = next
  refreshOutline(next, id)
  updateCursor(editor)
  editor.focus()
})
watch([() => sc.value?.execution, ownerType], () => {
  if (!editor || !sc.value) return
  editor.dispatch({ effects: intelligence.reconfigure(jsIntelligence(intelligenceOptions(sc.value))) })
})
// Si el script cambia desde fuera (se editó en VS Code), el editor toma el texto nuevo sin perder la posición del cursor.
watch(() => sc.value?.code, (next) => {
  if (!editor || next === undefined) return
  const cur = editor.state.doc.toString()
  if (next === cur) return
  const head = Math.min(editor.state.selection.main.head, next.length)
  syncingProjectDocument = true
  try {
    editor.dispatch({ changes: { from: 0, to: cur.length, insert: next }, selection: { anchor: head } })
  } finally { syncingProjectDocument = false }
  code.value = next
  refreshOutline(next, sc.value?.id, null, true)
})
async function onNativeChange() {
  await nextTick()
  const host = editorHost.value
  if (!host || !editor || host.ownerDocument === editorRoot) return
  const old = editor
  const state = old.state
  const scrollTop = old.scrollDOM.scrollTop
  const scrollLeft = old.scrollDOM.scrollLeft
  old.destroy()
  editorRoot = host.ownerDocument
  editor = new EditorView({ parent: host, root: editorRoot, state })
  editor.scrollDOM.scrollTop = scrollTop
  editor.scrollDOM.scrollLeft = scrollLeft
  editor.requestMeasure()
  updateCursor(editor)
}
watch(() => store.ui.viewTab, async (tab) => {
  if (tab === 'code') { await nextTick(); editor?.requestMeasure() }
})
watch(() => store.project, () => {
  outlineByScript.clear()
  refreshOutline(sc.value?.code ?? '', sc.value?.id, null, true)
})
onBeforeUnmount(() => {
  sceneReadGeneration++
  editor?.destroy()
  outlineByScript.clear()
  editor = null
  editorRoot = null
})
</script>

<template>
  <FloatingEditorWindow dock-panel-id="codeView" :initial-width="1040" :initial-height="690" label="Code" :subtitle="sc?.name"
    native-tool="code" :native-on-demand="true" :integrated-titlebar="true" :closable="store.ui.mode !== 'desktop'"
    @native-change="onNativeChange" @close="closeScriptEditor">
    <div class="edwin se" :class="{ 'se-welcome-shell': !sc }" @keydown="onShellKeydown" @keydown.esc.stop="onEscape"
      @pointerdown.capture="store.ui.mode === 'desktop' && !store.ui.codeNativeOpen && store.ui.viewTab !== 'code' && activateCodeDock(store)">
      <div ref="menuBar" class="se-commands" role="menubar" aria-label="Menús de Code">
        <div class="se-menu-strip">
          <details v-for="menu in menuItems" :key="menu.name" class="se-menu" @toggle="onMenuToggle">
            <summary role="menuitem" :aria-label="menu.name">{{ menu.name }}</summary>
            <div class="se-menu-list" role="menu" :aria-label="menu.name">
              <button v-for="[text, action, shortcut] in menu.actions" :key="action" type="button" role="menuitem"
                :disabled="menuActionDisabled(action)" @click="runMenuAction(action, $event)"><span>{{ text }}</span><kbd v-if="shortcut">{{ shortcut }}</kbd></button>
            </div>
          </details>
        </div>
        <label class="se-command-center" title="Buscar y abrir scripts del proyecto">
          <Icon name="search" :size="14"/>
          <input ref="commandCenterInput" v-model="scriptSearch" type="search" autocomplete="off" aria-label="Buscar scripts del proyecto"
            placeholder="Buscar scripts del proyecto" @focus="activityMode = 'search'" @keydown.enter.prevent="openFirstFilteredScript" @keydown.esc.stop="clearScriptSearch"/>
          <kbd>Ctrl+P</kbd>
        </label>
        <span class="se-command-spacer"></span>
        <button type="button" class="se-command se-icon se-nav-toggle" :aria-pressed="showNavigator" title="Mostrar u ocultar navegación" aria-label="Mostrar u ocultar navegación" @click="toggleNavigator"><Icon name="panel-left" :size="15"/></button>
        <button type="button" class="se-command se-icon" :aria-pressed="showMap" title="Mostrar u ocultar minimapa" aria-label="Mostrar u ocultar minimapa" :disabled="!sc" @click="toggleMinimap"><Icon name="list" :size="15"/></button>
        <button type="button" class="se-command se-icon" title="Guardar proyecto" aria-label="Guardar proyecto" @click="save"><Icon name="save" :size="15"/></button>
      </div>
      <div class="script-tabs" role="tablist" aria-label="Documentos abiertos">
        <div v-if="sc" class="active-tab" role="tab" aria-selected="true" :data-tooltip="`${sc.folder}/${sc.name}`">
          <span class="js-badge">JS</span>
          <span class="tab-filename">{{ sc.name }}</span>
          <span v-if="savedLabel !== 'Guardado'" class="dirty-dot" data-tooltip="Cambios sin guardar">●</span>
        </div>
        <div v-else class="active-tab welcome-tab" role="tab" aria-selected="true">
          <Icon name="script" :size="14"/><span class="tab-filename">Inicio</span>
        </div>
        <span class="grow"></span>
      </div>
      <div class="se-workspace">
        <nav class="se-activity" aria-label="Vistas de Code">
          <button type="button" :class="{ active: activityMode === 'explorer' && showNavigator }" aria-label="Explorador" title="Explorador"
            :aria-pressed="activityMode === 'explorer' && showNavigator" @click="showExplorerFromActivity"><Icon name="folder" :size="21"/></button>
          <button type="button" :class="{ active: activityMode === 'search' }" aria-label="Buscar scripts" title="Buscar scripts (Ctrl+P)"
            :aria-pressed="activityMode === 'search'" @click="focusScriptSearch"><Icon name="search" :size="21"/></button>
          <button type="button" :class="{ active: activityMode === 'outline' }" aria-label="Métodos y regiones" title="Métodos y regiones"
            :aria-pressed="activityMode === 'outline'" :disabled="!sc" @click="showOutlineFromActivity"><Icon name="list" :size="21"/></button>
          <span class="grow"></span>
          <button type="button" aria-label="Referencia de Century" title="Referencia de Century" @click="openDocs('referencia/api.md')"><Icon name="help" :size="21"/></button>
        </nav>
        <aside v-if="showNavigator" class="se-sidebar" aria-label="Navegación del editor de scripts">
          <section class="se-files" aria-label="Scripts del proyecto">
            <div class="se-panel-head">
              <span>EXPLORADOR</span>
              <span class="se-panel-actions"><span class="se-count">{{ store.project?.scripts?.length ?? 0 }}</span><button type="button" title="Nuevo script" aria-label="Nuevo script" @click="createAndOpenScript"><Icon name="plus" :size="14"/></button></span>
            </div>
            <label class="se-search-box">
              <Icon name="search" :size="14" />
              <input ref="scriptSearchInput" v-model="scriptSearch" aria-label="Filtrar scripts" placeholder="Filtrar scripts…" type="search" autocomplete="off" @keydown.esc.stop="clearScriptSearch" />
            </label>
            <div class="se-file-list">
              <div v-for="group in scriptGroups" :key="group.folder" class="se-file-group">
                <div class="se-folder" :title="group.folder"><Icon name="folder" :size="13"/><span>{{ group.folder }}</span></div>
                <button v-for="item in group.items" :key="item.id" type="button" class="se-file" :class="{ active: item.id === sc?.id }"
                  :aria-current="item.id === sc?.id ? 'page' : undefined" :title="`${item.folder}/${item.name}`" @click="selectScript(item.id)">
                  <span class="js-small">JS</span><span class="se-file-name">{{ item.name }}</span><span v-if="item.execution === 'node'" class="se-type" title="Script de nodo">N</span>
                </button>
              </div>
              <div v-if="!scriptGroups.length" class="se-empty se-files-empty">
                <p>{{ (store.project?.scripts?.length ?? 0) ? 'No hay scripts que coincidan con la búsqueda.' : 'Este proyecto todavía no tiene scripts.' }}</p>
                <button v-if="!(store.project?.scripts?.length ?? 0)" type="button" @click="createAndOpenScript"><Icon name="plus" :size="13"/> Nuevo script</button>
              </div>
            </div>
          </section>
          <section v-if="sc" class="se-methods" aria-label="Métodos y regiones del script">
            <button type="button" class="se-panel-head se-collapser" :aria-expanded="showOutline" @click="toggleOutline">
              <span><Icon :name="showOutline ? 'chevron-down' : 'chevron-right'" :size="13"/> Métodos y regiones</span><span class="se-count">{{ outlineSnapshot.pending && outline.some(o => o.provisional) ? '≈ ' : '' }}{{ outline.length }}</span>
            </button>
            <div v-if="showOutline" class="se-method-list">
              <p v-if="outlineSnapshot.pending" class="se-outline-warning" role="status">Comentario de bloque sin cerrar. Los métodos atenuados son posiciones provisionales, no código activo.</p>
              <button v-for="o in outline" :key="`${o.kind}:${o.label}:${o.pos}`" type="button" class="ol-item"
                :class="{ cur: !o.provisional && currentSymbol && currentSymbol.pos === o.pos, 'is-provisional': o.provisional }"
                :title="`${o.label} · línea ${o.line}${o.provisional ? ' · índice provisional' : ''}`" @click="goTo(o.pos)">
                <i :class="'ok-' + o.kind">{{ OUTLINE_ICON[o.kind] }}</i><span>{{ o.label }}</span><em>{{ o.provisional ? '≈' : '' }}{{ o.line }}</em>
              </button>
              <p v-if="!outline.length" class="se-empty">Las funciones y regiones aparecerán aquí.</p>
            </div>
          </section>
        </aside>
        <div class="se-editor-column">
          <div v-if="sc" class="script-breadcrumb" aria-label="Ubicación del script">
            <Icon name="folder" :size="13"/><span>{{ sc.folder }}</span><span class="path-sep">›</span><strong>{{ sc.name }}</strong>
            <template v-if="currentSymbol"><span class="path-sep">›</span><span class="crumb-sym"><i :class="'ok-' + currentSymbol.kind">{{ OUTLINE_ICON[currentSymbol.kind] }}</i>{{ currentSymbol.label }}</span></template>
            <span class="grow"></span>
            <label class="script-execution" title="Modalidad de ejecución del recurso">Ejecución
              <select :value="sc.execution || 'global'" @change="setScriptExecution(sc.id, $event.target.value)">
                <option value="global">Global</option><option value="node">Nodo</option>
              </select>
            </label>
          </div>
          <div v-if="sc" ref="editorHost" class="script-editor" aria-label="Editor de código JavaScript"></div>
          <main v-else class="se-welcome" aria-labelledby="se-welcome-title">
            <div class="se-welcome-inner">
              <header class="se-welcome-brand">
                <span class="se-welcome-mark"><Icon name="script" :size="27"/></span>
                <span><h1 id="se-welcome-title">Century Code</h1><p>Editor de scripts del proyecto</p></span>
              </header>
              <div class="se-welcome-grid">
                <section aria-labelledby="se-start-title">
                  <h2 id="se-start-title">Comenzar</h2>
                  <div class="se-start-actions">
                    <button type="button" @click="createAndOpenScript"><Icon name="file" :size="17"/><span><strong>Nuevo script…</strong><small>Crear un archivo JavaScript</small></span><kbd>Ctrl+N</kbd></button>
                    <button type="button" @click="focusScriptSearch"><Icon name="search" :size="17"/><span><strong>Buscar script…</strong><small>Explorar scripts del proyecto</small></span><kbd>Ctrl+P</kbd></button>
                    <button type="button" @click="openVSCodeWorkspace()"><Icon name="script" :size="17"/><span><strong>Abrir en VS Code</strong><small>Usar el editor externo</small></span></button>
                  </div>
                  <h2 class="se-project-title">Proyecto</h2>
                  <p class="se-project-empty">Este proyecto todavía no tiene scripts.<br><span>Crea uno nuevo para empezar a programar.</span></p>
                </section>
                <section aria-labelledby="se-learn-title">
                  <h2 id="se-learn-title">Primeros pasos</h2>
                  <button type="button" class="se-walkthrough" @click="createAndOpenScript">
                    <span class="se-walkthrough-icon"><Icon name="plus" :size="17"/></span><span><strong>Crear el primer script</strong><small>Empieza con una plantilla lista para Century.</small></span><Icon name="chevron-right" :size="15"/>
                  </button>
                  <button type="button" class="se-walkthrough" @click="openDocs('referencia/api.md')">
                    <span class="se-walkthrough-icon"><Icon name="help" :size="17"/></span><span><strong>Explorar la API de Century</strong><small>Consulta nodos, eventos y funciones disponibles.</small></span><Icon name="chevron-right" :size="15"/>
                  </button>
                  <div class="se-shortcuts" aria-label="Atajos esenciales"><span><kbd>Ctrl+S</kbd> Guardar</span><span><kbd>Ctrl+P</kbd> Buscar script</span></div>
                </section>
              </div>
            </div>
          </main>
        </div>
      </div>
      <div class="script-status">
        <button v-if="sc" type="button" class="status-action problems" :class="{ bad: problems.error, warn: !problems.error && problems.warning }" data-tooltip="Ver diagnósticos" @click="showProblems">
          <span class="p-err">⊗ {{ problems.error }}</span><span class="p-warn">⚠ {{ problems.warning }}</span><span v-if="problems.info" class="p-info">ⓘ {{ problems.info }}</span>
        </button>
        <span v-else class="status-workspace"><Icon name="script" :size="12"/> Century Code</span>
        <span class="grow"></span>
        <template v-if="sc">
          <span v-if="outlineSnapshot.pending" class="status-comment" role="status">Comentario /* sin cerrar</span>
          <span class="save-status">{{ savedLabel }}</span>
          <span class="status-position">Ln {{ cursor.line }}, Col {{ cursor.column }}</span>
          <button class="status-action" type="button" :aria-pressed="wordWrap" data-tooltip="Ajuste de línea (Alt+Z)" @click="toggleWordWrap">{{ wordWrap ? 'Ajuste de línea' : 'Sin ajuste' }}</button>
          <span class="status-dim">UTF-8</span>
        </template>
        <span class="status-lang">JavaScript · Century</span>
      </div>
    </div>
  </FloatingEditorWindow>
</template>

<style scoped>
/* El editor comparte las superficies del shell; CodeMirror conserva su resaltado de sintaxis. */
/* El marco flotante/docking define el área; los límites globales .edwin son para diálogos, no para este editor. */
.edwin.se { display:flex; flex-direction:column; width:100%; height:100%; min-height:0; min-width:0; max-width:none; max-height:none; overflow:hidden; color:#d9e0e8; background:#11151b; border:1px solid #303743; border-radius:5px; --se-ui-font:system-ui,-apple-system,'Segoe UI',sans-serif; --se-accent:#2997e6; --se-rail:#0e1217; --se-sidebar:#151a21; --se-editor:#1e232b; --se-border:#2c3440; --se-muted:#8d98a6; --se-status:#0878ca; font-family:var(--se-ui-font); }
.grow { flex:1; }
.se-commands { display:flex; flex:none; align-items:center; gap:3px; height:42px; padding:4px 8px; background:#10141a; border-bottom:1px solid var(--se-border); min-width:0; }

.se-commands { overflow:visible; gap:4px; position:relative; z-index:9; }
.se-menu-strip { display:flex; align-items:center; flex:0 1 344px; min-width:0; }
.se-menu { position:relative; flex:none; }
.se-menu > summary { list-style:none; cursor:pointer; border:1px solid transparent; padding:7px 9px; border-radius:4px; font:500 12px/1.2 var(--se-ui-font); color:#c0c8d2; }
.se-menu > summary::-webkit-details-marker { display:none; }
.se-menu > summary:hover,.se-menu[open] > summary { background:var(--menu-hover); color:var(--text); }
.se-menu > summary:focus-visible { outline:2px solid var(--blue-hi); }
.se-menu-list { position:absolute; top:calc(100% + 3px); left:0; z-index:30; min-width:198px; padding:5px; display:flex; flex-direction:column; background:#202630; border:1px solid #3b4654; border-radius:5px; box-shadow:0 14px 34px #000a; }
.se-menu-list button { display:flex; align-items:center; gap:20px; width:100%; min-height:27px; padding:5px 9px; border:0; border-radius:3px; background:transparent; font:400 11.5px/1.3 var(--se-ui-font); text-align:left; color:var(--text-2); cursor:pointer; white-space:nowrap; }
.se-menu-list button:hover,.se-menu-list button:focus-visible { background:var(--menu-hover); color:var(--text); }
.se-menu-list button:disabled { opacity:.38; cursor:default; background:transparent; }
.se-menu-list kbd { margin-left:auto; color:var(--text-3); font:10px/1.3 var(--se-ui-font); }
.se-command-center { display:flex; align-items:center; gap:8px; flex:0 1 520px; min-width:190px; height:30px; padding:0 9px; color:#8f9ba9; background:#171d25; border:1px solid #495567; border-radius:5px; box-shadow:0 1px 2px #0005; }
.se-command-center:focus-within { border-color:var(--se-accent); box-shadow:0 0 0 1px color-mix(in srgb,var(--se-accent) 45%,transparent); }
.se-command-center input { flex:1; min-width:0; height:100%; padding:0; color:#dce4ed; background:transparent; border:0; outline:0; font:400 12px/1 var(--se-ui-font); text-align:center; }
.se-command-center input::placeholder { color:#8793a0; opacity:1; }
.se-command-center kbd { flex:none; color:#6f7b88; font:500 9px/1 var(--se-ui-font); border:1px solid #3a4350; border-radius:3px; padding:3px 5px; background:#11161c; }
.se-command-spacer { flex:1 1 80px; min-width:4px; }
.se-icon { padding:0; width:27px; }
.se-command { display:inline-flex; align-items:center; justify-content:center; gap:6px; flex:none; height:27px; min-width:28px; padding:0 9px; border:1px solid transparent; border-radius:4px; background:transparent; color:var(--text-2); font:500 11.5px/1 var(--se-ui-font); white-space:nowrap; cursor:pointer; }
.se-command:hover { border-color:var(--g-600); background:var(--menu-hover); color:#fff; }
.se-command:focus-visible, .se-file:focus-visible, .ol-item:focus-visible, .se-collapser:focus-visible, .status-action:focus-visible { outline:2px solid var(--blue-hi); outline-offset:-2px; }
.se-command[aria-pressed=true] { background:var(--menu-selected); border-color:var(--menu-stroke); color:var(--text); }
.se-command.primary { color:var(--text); background:var(--g-600); border-color:var(--g-600); }
.se-command.primary:hover { background:var(--menu-hover); }
.se-command:disabled { opacity:.48; cursor:default; }
.se-separator { height:18px; width:1px; flex:none; background:var(--hair); margin:0 3px; }
.script-tabs { display:flex; flex:none; align-items:stretch; min-width:0; height:38px; background:#0f1318; border-bottom:1px solid var(--se-border); }
.active-tab { display:flex; align-items:center; gap:8px; min-width:155px; max-width:60%; padding:0 14px; background:var(--se-editor); border-top:2px solid var(--se-accent); border-right:1px solid var(--se-border); color:#edf2f7; font-size:12px; }
.welcome-tab { color:var(--text-2); }
.welcome-tab svg { color:var(--se-accent); }
.js-badge, .js-small { flex:none; font:700 9px/1 var(--se-ui-font); color:var(--warn); letter-spacing:.1px; }
.tab-filename { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.dirty-dot { color:var(--amber); font-size:10px; }
.script-execution { display:flex; align-items:center; gap:8px; margin-left:12px; font-size:11px; color:#9ba6b3; }
.script-execution select { max-width:100px; font-size:11px; background:#171c23; color:#e1e7ee; border:1px solid #3a4451; border-radius:4px; height:23px; }
.se-workspace { display:flex; flex:1; min-height:0; min-width:0; }
.se-activity { display:flex; flex-direction:column; align-items:stretch; flex:none; width:46px; min-height:0; padding:4px 0 5px; background:var(--se-rail); border-right:1px solid var(--se-border); }
.se-activity button { position:relative; display:grid; place-items:center; width:100%; height:43px; flex:none; padding:0; color:#8793a1; background:transparent; border:0; cursor:pointer; }
.se-activity button::before { content:''; position:absolute; left:0; top:7px; bottom:7px; width:2px; border-radius:0 2px 2px 0; background:transparent; }
.se-activity button:hover { color:#d7dee6; background:#171d24; }
.se-activity button.active { color:#f0f5fa; background:#18212b; }
.se-activity button.active::before { background:var(--se-accent); }
.se-activity button:focus-visible { outline:2px solid var(--se-accent); outline-offset:-3px; }
.se-activity button:disabled { opacity:.34; cursor:default; background:transparent; }
.se-sidebar { display:flex; flex-direction:column; flex:none; width:246px; min-width:166px; max-width:48%; min-height:0; resize:horizontal; overflow:hidden; background:var(--se-sidebar); border-right:1px solid var(--se-border); }
.se-files { display:flex; flex-direction:column; min-height:100px; flex:1; overflow:hidden; }
.se-methods { display:flex; flex-direction:column; min-height:0; max-height:45%; border-top:1px solid var(--se-border); }
.se-panel-head { display:flex; align-items:center; justify-content:space-between; gap:8px; flex:none; min-height:36px; padding:0 10px 0 13px; color:#c7d0da; background:var(--se-sidebar); font-size:10.5px; font-weight:700; letter-spacing:.65px; }
.se-count { color:var(--text-3); font:500 10px/1 var(--se-ui-font); }
.se-panel-actions { display:flex; align-items:center; gap:5px; }
.se-panel-actions button { width:24px; height:24px; display:grid; place-items:center; padding:0; color:var(--text-2); background:transparent; border:0; border-radius:4px; }
.se-panel-actions button:hover { color:#fff; background:#252d37; }
.se-panel-actions button:focus-visible { outline:2px solid var(--blue-hi); outline-offset:-2px; }
.se-collapser { width:100%; text-align:left; border:0; cursor:pointer; }
.se-collapser > span:first-child { display:flex; gap:5px; align-items:center; }
.se-collapser:hover { background:var(--menu-hover); }
.se-search-box { display:flex; flex:none; align-items:center; gap:8px; margin:7px 10px 9px; padding:0 8px; height:30px; background:#1b2129; border:1px solid #394452; border-radius:4px; color:#9ba6b3; }
.se-search-box:focus-within { border-color:var(--blue-hi); }
.se-search-box input { min-width:0; flex:1; width:100%; background:transparent; border:none; outline:none; color:var(--text); font-size:11.5px; }
.se-search-box input::placeholder { color:var(--text-3); }
.se-file-list, .se-method-list { flex:1; min-height:0; overflow:auto; padding-bottom:8px; }
.se-folder { display:flex; align-items:center; gap:6px; min-width:0; padding:8px 10px 4px; color:var(--text-2); font:600 10px/1.3 var(--se-ui-font); }
.se-folder span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.se-file, .ol-item { width:100%; min-height:28px; display:flex; align-items:center; gap:7px; padding:3px 10px 3px 22px; background:transparent; color:#b8c1cc; text-align:left; border:0; cursor:pointer; font:400 11.5px/1.25 var(--se-ui-font); }
.se-file:hover, .ol-item:hover { background:#202832; color:#fff; }
.se-file.active, .ol-item.cur { background:#17344c; color:#fff; box-shadow:inset 2px 0 0 var(--se-accent); }
.se-file-name, .ol-item span { min-width:0; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.se-type { flex:none; font-size:9px; color:var(--ok); border:1px solid var(--g-600); border-radius:3px; padding:1px 4px; }
.se-method-list { padding-top:4px; }
.ol-item { padding-left:13px; min-height:26px; }
.ol-item i { flex:none; font:400 13px/1 var(--se-ui-font); width:14px; text-align:center; }
.ol-item em { flex:none; color:var(--text-3); font:400 10px/1 var(--se-ui-font); }
.ol-item.is-provisional { opacity:.65; }
.se-outline-warning { margin:5px 8px 7px; padding:6px 8px; border:1px solid var(--g-600); border-radius:3px; color:var(--text-2); font:400 10.5px/1.4 var(--se-ui-font); }
.status-comment { color:var(--warn); font-size:10.5px; }
.se-empty { padding:6px 12px; color:var(--text-3); font-size:11px; line-height:1.5; }
.se-files-empty { display:flex; flex-direction:column; align-items:flex-start; gap:9px; padding:10px 13px; }
.se-files-empty p { margin:0; }
.se-files-empty button { display:flex; align-items:center; gap:6px; min-height:26px; padding:3px 8px; border:1px solid var(--g-600); border-radius:4px; color:var(--text-2); background:var(--g-800); font:500 10.5px/1 var(--se-ui-font); }
.se-files-empty button:hover { color:var(--text); border-color:var(--text-3); background:var(--menu-hover); }
.ok-function, .ok-define { color:var(--n-area); }.ok-on { color:var(--amber); }.ok-region { color:var(--blue); }
.se-editor-column { display:flex; flex-direction:column; flex:1; min-height:0; min-width:0; }
.script-breadcrumb { display:flex; flex:none; align-items:center; gap:7px; height:34px; padding:0 12px; border-bottom:1px solid var(--se-border); background:#171c23; color:#9ca7b4; font-size:11px; white-space:nowrap; overflow:hidden; }
.script-breadcrumb > span:first-of-type { overflow:hidden; text-overflow:ellipsis; min-width:0; }
.script-breadcrumb strong { color:var(--text); font-weight:500; overflow:hidden; text-overflow:ellipsis; }
.crumb-sym { display:inline-flex; align-items:center; gap:4px; overflow:hidden; text-overflow:ellipsis; }
.crumb-sym i { font-style:normal; }
.path-sep { color:var(--text-3); }
.script-editor { flex:1; min-height:0; min-width:0; overflow:hidden; background:#1e1e1e; user-select:text; }
.script-editor :deep(.cm-editor) { height:100%; width:100%; background:#1e1e1e; }
.script-editor :deep(.cm-gutters) { background:#1e1e1e; }
.script-editor :deep(.cm-panels) { background:var(--g-700); }
.script-editor :deep(.cm-content) { user-select:text; }
.script-editor :deep(.cm-panels input) { min-width:60px; width:auto; height:25px; }
.script-editor :deep(.cm-panels button) { height:25px; padding:0 8px; }
.se-welcome { flex:1; min-height:0; overflow:auto; background:var(--se-editor); }
.se-welcome-inner { width:min(820px, calc(100% - 56px)); margin:0 auto; padding:58px 0 48px; }
.se-welcome-brand { display:flex; align-items:center; gap:15px; margin-bottom:42px; }
.se-welcome-mark { width:50px; height:50px; display:grid; place-items:center; flex:none; color:var(--se-accent); border:1px solid var(--g-600); border-radius:10px; background:var(--g-850); box-shadow:0 10px 25px #0003; }
.se-welcome-brand h1 { margin:0 0 4px; color:var(--text); font:600 25px/1.15 var(--se-ui-font); letter-spacing:-.5px; }
.se-welcome-brand p { margin:0; color:var(--text-3); font:400 11.5px/1.4 var(--se-ui-font); }
.se-welcome-grid { display:grid; grid-template-columns:minmax(230px,.88fr) minmax(290px,1.12fr); gap:68px; align-items:start; }
.se-welcome h2 { margin:0 0 13px; color:var(--text); font:600 17px/1.25 var(--se-ui-font); letter-spacing:-.25px; }
.se-start-actions { display:flex; flex-direction:column; align-items:stretch; gap:3px; }
.se-start-actions button { width:100%; min-height:43px; display:grid; grid-template-columns:20px 1fr auto; align-items:center; gap:10px; padding:6px 8px; border:1px solid transparent; border-radius:5px; color:var(--se-accent); background:transparent; text-align:left; cursor:pointer; }
.se-start-actions button:hover { background:var(--menu-hover); border-color:var(--hair-soft); }
.se-start-actions button:focus-visible,.se-walkthrough:focus-visible { outline:2px solid var(--blue-hi); outline-offset:1px; }
.se-start-actions button > span { min-width:0; display:flex; flex-direction:column; gap:2px; }
.se-start-actions strong { color:var(--se-accent); font:500 12px/1.25 var(--se-ui-font); }
.se-start-actions small { color:var(--text-3); font:400 10px/1.3 var(--se-ui-font); }
.se-start-actions kbd,.se-shortcuts kbd { color:var(--text-3); font:500 9px/1 var(--se-ui-font); border:1px solid var(--g-600); border-bottom-color:var(--g-700); border-radius:3px; padding:3px 5px; background:var(--g-850); box-shadow:0 1px 0 #0007; }
.se-project-title { margin-top:34px !important; }
.se-project-empty { margin:0; color:var(--text-2); font:400 11.5px/1.65 var(--se-ui-font); }
.se-project-empty span { color:var(--text-3); }
.se-walkthrough { width:100%; min-height:62px; display:grid; grid-template-columns:34px 1fr 16px; align-items:center; gap:11px; margin-bottom:9px; padding:9px 11px; border:1px solid var(--g-600); border-radius:6px; color:var(--text-2); background:var(--g-850); text-align:left; cursor:pointer; box-shadow:0 1px 2px #0002; }
.se-walkthrough:hover { border-color:var(--se-accent); background:var(--g-700); }
.se-walkthrough > span:nth-child(2) { min-width:0; display:flex; flex-direction:column; gap:4px; }
.se-walkthrough strong { color:var(--text); font:600 11.5px/1.3 var(--se-ui-font); }
.se-walkthrough small { color:var(--text-3); font:400 10.5px/1.4 var(--se-ui-font); }
.se-walkthrough-icon { width:30px; height:30px; display:grid; place-items:center; color:var(--se-accent); border-radius:5px; background:var(--blue-wash); }
.se-shortcuts { display:flex; flex-wrap:wrap; gap:8px 17px; margin-top:19px; color:var(--text-3); font:400 10px/1.5 var(--se-ui-font); }
.se-shortcuts span { display:inline-flex; align-items:center; gap:6px; }
.script-status { display:flex; align-items:center; gap:10px; flex:none; min-height:24px; padding:0 10px; background:var(--se-status); border-top:1px solid #2997e655; color:#fff; white-space:nowrap; font-size:10.5px; }
.status-workspace { display:inline-flex; align-items:center; gap:6px; color:#fff; }
.status-action { border:0; border-radius:3px; background:transparent; color:inherit; padding:3px 5px; cursor:pointer; white-space:nowrap; font-size:10.5px; }
.status-action:hover { background:#ffffff24; color:#fff; }
.problems { display:flex; gap:10px; }.problems.bad .p-err { color:#ffe0df; }.problems.warn .p-warn { color:#fff0bd; }.p-info { color:#fff; }
.status-dim,.status-lang,.status-position,.save-status { color:#fff; }
@media (max-width:1050px) { .se-command-center { flex-basis:390px; } .se-command-center kbd { display:none; } }
@media (max-width:900px) { .se-menu > summary { padding-inline:6px; } .se-command-center { flex-basis:300px; } }
@media (max-width:820px) { .se-welcome-inner { width:min(620px, calc(100% - 40px)); padding-top:38px; } .se-welcome-grid { grid-template-columns:1fr; gap:38px; } .se-welcome-brand { margin-bottom:30px; } .se-menu:nth-child(4),.se-menu:nth-child(5) { display:none; } }
@media (max-width:730px) { .se-sidebar { width:186px; } .se-command-center { min-width:150px; } .se-command-center input { text-align:left; } .script-status .status-dim, .script-status .status-lang { display:none; } }
@media (max-width:590px) { .se-menu-strip { flex-basis:auto; } .se-menu:nth-child(n+3) { display:none; } .se-command-center { flex:1; } .se-command-spacer { display:none; } }
@media (max-width:510px) { .se-activity { width:40px; } .se-sidebar { width:148px; } .se-file { padding-left:9px; } .script-status .save-status { display:none; } }
@media (prefers-reduced-motion: no-preference) { .se-command, .se-file, .ol-item, .se-start-actions button, .se-walkthrough { transition:background-color .12s ease, border-color .12s ease, color .12s ease; } }
</style>
