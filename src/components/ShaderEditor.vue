<script setup>
// CodeMirror is the editing surface; the existing store owns script content and saving.
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { Compartment, EditorState, Prec } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { cpp, cppLanguage } from '@codemirror/lang-cpp'
import { glslSource } from '../core/editor/intellisense.js'
import { editorLook } from '../core/editor/theme.js'
import { openSearchPanel } from '@codemirror/search'
import { store, setShaderCode, closeShaderEditor, saveAll } from '../core/store.js'
import { checkShader } from '../engine/runtime/render/pbr.js'
import { parseShader } from '../engine/runtime/render/shaderlib.js'
import FloatingEditorWindow from './FloatingEditorWindow.vue'
import Icon from './Icon.vue'

const sc = computed(() => store.project.shaders.find((item) => item.id === store.shaderEditId))
const code = ref(sc.value?.code ?? '')
const editorHost = ref(null)
const cursor = ref({ line: 1, column: 1 })
const wordWrap = ref(true)
const wrapping = new Compartment()
let editor = null

let checkTimer = 0
const compile = ref({ ok: true, message: 'Sin comprobar' })
function runCheck() {
  const vp = store.editor?.vp
  if (!vp || !sc.value) return
  try {
    const err = checkShader(vp.renderer, code.value)
    compile.value = err ? { ok: false, message: err } : { ok: true, message: 'Compila correctamente' }
  } catch (e) { compile.value = { ok: false, message: String(e.message || e) } }
}
function scheduleCheck() { clearTimeout(checkTimer); checkTimer = setTimeout(runCheck, 450) }
const info = computed(() => parseShader(code.value))
const savedLabel = computed(() => store.saveState === 'saved' && store.disk.state !== 'dirty' && store.disk.state !== 'error'
  ? 'Guardado' : 'Sin guardar')


function updateCursor(view) {
  const head = view.state.selection.main.head
  const line = view.state.doc.lineAt(head)
  cursor.value = { line: line.number, column: head - line.from + 1 }
}
function save() { void saveAll() }
function onEscape(event) {
  // CodeMirror owns Escape for search and completion; do not close the whole window.
  // composedPath(): CodeMirror quita el campo de búsqueda del DOM al cerrar el panel, y entonces `target.closest()` ya no encuentra el editor
  if (event.composedPath().some((n) => n instanceof Element && n.classList.contains('cm-editor'))) return
  closeShaderEditor()
}
function showFind() {
  if (!editor) return
  openSearchPanel(editor)
}
function toggleWordWrap() {
  wordWrap.value = !wordWrap.value
  if (editor) editor.dispatch({ effects: wrapping.reconfigure(wordWrap.value ? EditorView.lineWrapping : []) })
  editor?.focus()
}

onMounted(async () => {
  await nextTick()
  if (!editorHost.value || !sc.value) return
  editor = new EditorView({
    parent: editorHost.value,
    state: EditorState.create({
      doc: sc.value.code ?? '',
      extensions: [
        basicSetup,
        cpp(),
        cppLanguage.data.of({ autocomplete: glslSource }),
        wrapping.of(EditorView.lineWrapping),
        Prec.highest(keymap.of([
          { key: 'Mod-s', run: () => { save(); return true } },
          { key: 'Mod-h', run: (view) => { openSearchPanel(view); return true } },
          { key: 'Alt-z', run: () => { toggleWordWrap(); return true } },
        ])),
        editorLook(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            code.value = update.state.doc.toString()
            if (sc.value) setShaderCode(sc.value.id, code.value)
          }
          if (update.docChanged) scheduleCheck()
          if (update.docChanged || update.selectionSet) updateCursor(update.view)
        }),
      ],
    }),
  })
  updateCursor(editor)
  editor.focus()
  runCheck()
})
onBeforeUnmount(() => {
  clearTimeout(checkTimer)
  editor?.destroy()
  editor = null
})
</script>

<template>
  <FloatingEditorWindow dock-panel-id="shaderEditor" native-tool="shaderEditor" :native-on-demand="true" v-if="sc" :initial-width="1040" :initial-height="720" label="Shader Editor" @close="closeShaderEditor">
    <div class="edwin se" @keydown.esc.stop="onEscape">
      <h2 class="script-header" data-window-drag-handle>
        <Icon name="shader" :size="15" />
        <span class="window-caption">SHADER EDITOR</span>
        <span class="header-divider"></span>
        <span class="header-path">{{ sc.folder }}</span>
      </h2>
      <div class="script-tabs">
        <div class="active-tab" role="tab" aria-selected="true" :data-tooltip="`${sc.folder}/${sc.name}`">
          <Icon name="shader" :size="13" />
          <span class="tab-filename">{{ sc.name }}</span>
          <span class="file-language">GLSL</span>
        </div>
        <span class="grow"></span>
        <button type="button" class="tab-action" data-tooltip="Find / Replace (Ctrl+F / Ctrl+H)" aria-label="Buscar" @click="showFind">
          <Icon name="search" :size="15" />
        </button>
      </div>
      <div class="script-breadcrumb" aria-label="Ubicación">
        <span>{{ sc.folder }}</span><span class="path-sep">›</span><strong>{{ sc.name }}</strong>
        <span class="grow"></span><span class="completion-hint">{{ info.params.length }} parámetros</span>
      </div>
      <div ref="editorHost" class="script-editor" aria-label="GLSL shader editor"></div>
      <div class="script-status">
        <span class="syntax-status" :class="compile.ok ? 'ok' : 'bad'" :data-tooltip="compile.message">{{ compile.ok ? '✓' : '✕' }} {{ compile.message }}</span>
        <span class="grow"></span>
        <span class="save-status">{{ savedLabel }}</span>
        <button class="status-action" type="button" data-tooltip="Guardar proyecto (Ctrl+S)" @click="save">Guardar</button>
        <span class="status-position">Ln {{ cursor.line }}, Col {{ cursor.column }}</span>
        <button class="status-action" type="button" :aria-pressed="wordWrap" data-tooltip="Toggle word wrap (Alt+Z)" @click="toggleWordWrap">{{ wordWrap ? 'Wrap: On' : 'Wrap: Off' }}</button>
        <span>GLSL ES 3.0</span>
      </div>
    </div>
  </FloatingEditorWindow>
</template>

<style scoped>
.edwin.se { display: flex; flex-direction: column; width: 100%; height: 100%; min-width: 0; max-width: none; max-height: none; overflow: hidden; background: #1e1e1e; border: 1px solid #353535; border-radius: 6px; }
.edwin.se > .script-header { display: flex; flex: none; align-items: center; gap: 10px; height: 42px; min-height: 42px; padding: 0 100px 0 16px; background: #181818; color: #bcbcbc; border-bottom: 1px solid #2d2d2d; font: 500 11px/1 var(--font); }
.window-caption { letter-spacing: .7px; color: #d2d2d2; white-space: nowrap; }
.header-divider { flex: none; height: 14px; border-left: 1px solid #414141; }
.header-path { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #858585; }
.grow { flex: 1; }
.script-tabs { display: flex; flex: none; align-items: stretch; min-width: 0; height: 36px; background: #181818; border-bottom: 1px solid #292929; }
.active-tab { display: flex; align-items: center; gap: 9px; min-width: 0; max-width: 60%; padding: 0 15px; background: #1e1e1e; border-top: 1px solid #569cd6; border-right: 1px solid #303030; color: #eeeeee; font-size: 12px; }
.active-tab .ic { color: #d7bb86; }
.tab-filename { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-language { flex: none; margin-left: 4px; color: #aaaaaa; font-size: 10px; }
.tab-action { align-self: center; flex: none; width: 30px; height: 28px; margin: 0 10px 0 0; padding: 0; border: none; border-radius: 3px; background: transparent; color: #a5a5a5; }
.tab-action:hover { background: #303030; color: #fff; }
.script-breadcrumb { display: flex; align-items: center; gap: 8px; min-width: 0; height: 30px; flex: none; padding: 0 20px; background: #1e1e1e; color: #858585; font-size: 11px; }
.script-breadcrumb > span:first-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.script-breadcrumb strong { font-weight: 500; color: #bcbcbc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.path-sep { color: #6e6e6e; }
.completion-hint { flex: none; color: #797979; }
.script-editor { flex: 1; min-width: 0; min-height: 0; background: #1e1e1e; overflow: hidden; user-select: text; }
.script-editor :deep(.cm-editor) { width: 100%; height: 100%; }
.script-editor :deep(.cm-content) { user-select: text; }
.script-editor :deep(.cm-panels input) { width: auto; min-width: 60px; height: 25px; }
.script-editor :deep(.cm-panels button) { height: 25px; padding: 0 8px; }
.script-status { display: flex; flex: none; align-items: center; gap: 14px; padding: 0 14px; height: 26px; min-height: 26px; white-space: nowrap; background: #252526; color: #a7a7a7; border-top: 1px solid #393939; font-size: 10.5px; }
.syntax-status { max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.syntax-status.ok { color: #8cc9a8; }
.syntax-status.bad { color: #e99292; }
.status-action { padding: 0 3px; height: 22px; border: 0; border-radius: 2px; background: transparent; color: inherit; white-space: nowrap; }
.status-action:hover { background: #3b3b3b; color: #fff; }
.status-position { color: #d3d3d3; }
@media (max-width: 850px) {
  .edwin.se > .script-header { padding-left: 10px; }
  .script-breadcrumb { padding: 0 12px; }
  .completion-hint, .save-status { display: none; }
  .script-status { gap: 8px; padding: 0 8px; }
}
</style>
