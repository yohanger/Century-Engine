<script setup>
import { askText } from '../core/dialogs.js'
// Editor del Input Map: acciones integradas (reasignables, no borrables) y acciones propias, con varias entradas por acción.
import { ref, computed, onBeforeUnmount } from 'vue'
import { store, markDirty, toast } from '../core/store.js'
import { captureInput } from '../core/input/capture.js'
import { labelOf, deviceOf, isBuiltin, BUILTIN_DEFS, MAX_BINDINGS, addAction, removeAction, renameAction, addBinding, removeBinding, resetAction, conflictsOf, padAxisOf, validName, isToken, normalizeInputMap, defaultInputMap } from '../engine/runtime/input/inputmap.js'

const map = computed(() => store.project.inputMap)
const q = ref(''); const newName = ref(''); const cap = ref(null); const capFor = ref(''); const manual = ref({})
const desc = Object.fromEntries(BUILTIN_DEFS.map((d) => [d[0], d[1]]))
const shown = computed(() => map.value.actions.filter((a) => !q.value || a.name.includes(q.value.toLowerCase()) || a.bindings.some((b) => labelOf(b).toLowerCase().includes(q.value.toLowerCase()))))
const edit = (fn, msg = '') => { const r = fn(map.value); if (r === false || r === null) { if (msg) toast(msg, 'error'); return r } markDirty(); return r }
function create() { const n = newName.value.trim(); if (!validName(n)) return toast('Nombre inválido: letras, números y _ (máx. 40), sin espacios', 'error'); if (edit((m) => addAction(m, n), 'Ya existe una acción con ese nombre (o el mapa está lleno)')) newName.value = '' }
async function capture(a) {
  if (cap.value) cap.value.cancel()
  capFor.value = a.name; cap.value = captureInput()
  const t = await cap.value.promise; cap.value = null; capFor.value = ''
  if (t) add(a, t)
}
function add(a, t) {
  if (!isToken(t)) return toast('Entrada no válida: ' + t, 'error')
  const c = conflictsOf(map.value, t, a.name)
  if (!edit((m) => addBinding(m, a.name, t))) return
  if (c.length) toast(`«${labelOf(t)}» también está en: ${c.join(', ')}`, 'info')
}
function addManual(a) { const t = (manual.value[a.name] || '').trim(); if (t) { add(a, t); manual.value[a.name] = '' } }
const hasPadAxis = (a) => a.bindings.some((b) => padAxisOf(b))
async function rename(a) { const n = await askText('Nuevo nombre de la acción', a.name, { title: 'Renombrar acción' }); if (n && n !== a.name) edit((m) => renameAction(m, a.name, n.trim()), 'Nombre inválido o repetido') }
const restoreAll = () => { store.project.inputMap = defaultInputMap(); markDirty() }
onBeforeUnmount(() => cap.value?.cancel())
</script>
<template>
  <div class="im">
    <p class="hint lf-help">Las acciones agrupan teclas, ratón y mando. Úsalas en comandos («Condición → Entrada», «Esperar entrada»), en eventos («Al pulsar una acción») y en scripts: <code>game.input.justPressed("jump")</code>. También puedes usar teclas sueltas: <code>game.input.pressed("KeyF")</code> o escribir <code>KeyF</code> donde se pida una acción. Las integradas se pueden reasignar pero no borrar.</p>
    <div class="bar"><input v-model="q" placeholder="Buscar acción o tecla…" /><input v-model="newName" placeholder="nueva_accion" @keydown.enter="create" /><button @click="create">+ Acción</button></div>
    <div v-for="a in shown" :key="a.name" class="row" :class="{ bi: isBuiltin(a.name) }">
      <div class="nm"><b>{{ a.name }}</b><small class="lf-help" v-if="desc[a.name]">{{ desc[a.name] }}</small><small v-else>propia</small></div>
      <div class="chips">
        <span v-for="b in a.bindings" :key="b" class="chip" :class="deviceOf(b)">{{ labelOf(b) }}<i data-tooltip="Quitar" @click="edit((m) => removeBinding(m, a.name, b))">×</i></span>
        <span v-if="!a.bindings.length" class="none">sin entradas</span>
      </div>
      <div class="ops">
        <button :class="{ on: capFor === a.name }" :disabled="a.bindings.length >= MAX_BINDINGS" @click="capture(a)">{{ capFor === a.name ? 'Pulsa… (Esc cancela)' : '+ Capturar' }}</button>
        <input class="man" v-model="manual[a.name]" placeholder="KeyG" @keydown.enter="addManual(a)" />
        <label v-if="hasPadAxis(a)" class="dz" data-tooltip="Zona muerta de los ejes del mando">zona <input type="range" min="0" max="0.9" step="0.05" v-model.number="a.deadzone" @input="markDirty()" /> {{ (+a.deadzone).toFixed(2) }}</label>
        <button v-if="isBuiltin(a.name)" data-tooltip="Restaurar entradas por defecto" @click="edit((m) => resetAction(m, a.name))">↺</button>
        <template v-else><button data-tooltip="Renombrar" @click="rename(a)">✎</button><button data-tooltip="Borrar" @click="edit((m) => removeAction(m, a.name))">🗑</button></template>
      </div>
    </div>
    <div class="bar"><button @click="restoreAll">Restaurar todo el Input Map</button></div>
  </div>
</template>
<style scoped>
.im { padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; }
.hint { color: var(--text-2); font-size: 12px; margin: 0; } code { background: #0003; padding: 0 4px; border-radius: 3px; }
.bar { display: flex; gap: 6px; } .bar input { flex: 1; }
.row { display: grid; grid-template-columns: 160px 1fr auto; gap: 10px; align-items: center; padding: 6px 8px; border: 1px solid var(--g-600); border-radius: 6px; }
.nm { display: flex; flex-direction: column; } .nm small { color: var(--text-2); font-size: 11px; }
.chips { display: flex; flex-wrap: wrap; gap: 4px; } .none { color: var(--text-2); font-size: 12px; }
.chip { background: var(--g-700, #2a2a2a); border-radius: 10px; padding: 2px 4px 2px 9px; font-size: 12px; display: inline-flex; gap: 5px; align-items: center; }
.chip.mouse { background: #35506b; } .chip.pad { background: #4a6035; }
.chip i { cursor: pointer; font-style: normal; opacity: .6; padding: 0 4px; } .chip i:hover { opacity: 1; }
.ops { display: flex; gap: 4px; align-items: center; } .man { width: 70px; } .dz { font-size: 11px; display: flex; gap: 4px; align-items: center; }
button.on { background: var(--accent, #c80); color: #000; }
</style>
