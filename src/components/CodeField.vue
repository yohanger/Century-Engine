<script setup>
// Campo de código embebido (comando «Script» de un evento, expresiones JS de condiciones y variables) con el mismo IntelliSense que el
// editor de scripts: sugerencias por tipos, información al pasar el ratón, ayuda de parámetros y diagnósticos.
//   inline: una sola línea (expresión): Intro no inserta salto de línea y no hay números de línea.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { EditorView, basicSetup, minimalSetup } from 'codemirror'
import { EditorState, Prec } from '@codemirror/state'
import { keymap, placeholder as cmPlaceholder } from '@codemirror/view'
import { javascript } from '@codemirror/lang-javascript'
import { closeBrackets } from '@codemirror/autocomplete'
import { forEachDiagnostic } from '@codemirror/lint'
import { jsIntelligence, formatCode } from '../core/editor/jsintel.js'
import { editorLook } from '../core/editor/theme.js'
import { liveNames } from '../core/editor/names.js'
import { store } from '../core/store.js'
import { nodeReference, nodeReferenceFromDrop } from '../core/editor/node-reference.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  inline: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  minHeight: { type: Number, default: 220 },
})
const emit = defineEmits(['update:modelValue'])
const host = ref(null)
const problems = ref({ error: 0, warning: 0, info: 0 })
let view = null
const availableNodes = computed(() => store.project?.objects || [])
const NODE_MIME = 'application/x-lf-node'

function insertReference(expression, at = null) {
  if (!view || !expression) return false
  const selection = view.state.selection.main
  const from = at ?? selection.from, to = at ?? selection.to
  view.dispatch({ changes: { from, to, insert: expression }, selection: { anchor: from + expression.length }, scrollIntoView: true })
  view.focus()
  return true
}
function chooseNode(event) {
  const id = event.target.value
  event.target.value = ''
  if (id && availableNodes.value.some(o => o.id === id)) insertReference(nodeReference(id))
}
function onNodeDragOver(event) {
  if ([...(event.dataTransfer?.types || [])].includes(NODE_MIME)) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }
}
function onNodeDrop(event) {
  if (![...(event.dataTransfer?.types || [])].includes(NODE_MIME)) return
  event.preventDefault()
  event.stopPropagation()
  const expression = nodeReferenceFromDrop(event.dataTransfer, availableNodes.value)
  if (!expression) return
  const pos = view?.posAtCoords({ x: event.clientX, y: event.clientY })
  insertReference(expression, pos ?? view?.state.selection.main.from)
}

async function format() {
  if (!view || props.inline) return
  try {
    const before = view.state.doc.toString()
    const out = (await formatCode(before, 'script')).replace(/\n$/, '')
    if (out !== before) view.dispatch({ changes: { from: 0, to: before.length, insert: out } })
  } catch { /* con errores de sintaxis no se formatea; el diagnóstico ya lo marca */ }
}

onMounted(() => {
  view = new EditorView({
    parent: host.value,
    root: host.value.ownerDocument,
    state: EditorState.create({
      doc: props.modelValue || '',
      extensions: [
        props.inline ? [minimalSetup, closeBrackets()] : basicSetup,
        javascript(),
        editorLook(),
        Prec.highest(EditorView.theme({ '.cm-content': { padding: '8px 0' } })),
        jsIntelligence({ context: 'script', names: liveNames, lint: !props.inline }),
        props.placeholder ? cmPlaceholder(props.placeholder) : [],
        props.inline ? [EditorState.transactionFilter.of((tr) => (tr.newDoc.lines > 1 ? [] : tr)), EditorView.theme({ '.cm-content': { padding: '5px 0' }, '.cm-line': { padding: '0 8px' }, '&': { fontSize: '12.5px' } })] : EditorView.lineWrapping,
        Prec.highest(keymap.of([{ key: 'Shift-Alt-f', run: () => { void format(); return true } }])),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) emit('update:modelValue', u.state.doc.toString())
          if (u.transactions.length) {
            const n = { error: 0, warning: 0, info: 0 }
            forEachDiagnostic(u.state, (d) => { n[d.severity]++ })
            problems.value = n
          }
        }),
      ],
    }),
  })
})
watch(() => props.modelValue, (v) => {
  if (!view || v === view.state.doc.toString()) return
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v || '' } })
})
onBeforeUnmount(() => { view?.destroy(); view = null })
</script>

<template>
  <div class="codefield" :class="{ inline }" @dragover.capture="onNodeDragOver" @drop.capture="onNodeDrop" @keydown.esc.capture="(e) => e.target.closest('.cm-editor') && e.stopPropagation()">
    <div ref="host" class="cf-host" :style="inline ? null : { minHeight: minHeight + 'px' }"></div>
    <div v-if="!inline" class="cf-status">
      <span :class="{ bad: problems.error }">⊗ {{ problems.error }}</span>
      <span :class="{ warn: problems.warning }">⚠ {{ problems.warning }}</span>
      <span v-if="problems.info" class="info">ⓘ {{ problems.info }}</span>
      <span class="grow"></span>
      <select class="cf-node-select" aria-label="Insertar referencia de nodo" :value="''" @change="chooseNode">
        <option value="">Insertar nodo…</option>
        <option v-for="o in availableNodes" :key="o.id" :value="o.id">{{ o.name }} ({{ o.type }})</option>
      </select>
      <span class="lf-help">Ctrl+Espacio sugerencias · Mayús+Alt+F formatear</span>
    </div>
  </div>
</template>

<style scoped>
.codefield { display: flex; flex-direction: column; width: 100%; border: 1px solid #3a3a3a; border-radius: 4px; overflow: hidden; background: #1e1e1e; }
.codefield:focus-within { border-color: #0078d4; }
.cf-host { flex: 1; min-height: 0; display: flex; }
.cf-host :deep(.cm-editor) { flex: 1; min-width: 0; height: auto; }
.codefield:not(.inline) .cf-host :deep(.cm-editor) { max-height: 460px; }
.codefield.inline .cf-host :deep(.cm-content) { padding-bottom: 5px; }
.cf-status { display: flex; gap: 10px; align-items: center; height: 22px; padding: 0 8px; background: #181818; border-top: 1px solid #2b2b2b; color: #8b8b8b; font-size: 11px; }
.cf-status .bad { color: #f48771; }
.cf-status .warn { color: #cca700; }
.cf-status .info { color: #75beff; }
.grow { flex: 1; }
.cf-node-select { max-width: 155px; min-width: 95px; height: 20px; padding: 0 3px; color: var(--text-2); background: var(--g-900); border: 1px solid var(--hair); font-size: 11px; }
</style>
