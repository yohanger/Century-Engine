<script setup>
// Campo «acción o tecla»: escribe el nombre de una acción del Input Map o una tecla (KeyE, Mouse0, Pad0…) o pulsa «Capturar» y pulsa la entrada.
import { ref, onBeforeUnmount } from 'vue'
import { store } from '../core/store.js'
import { captureInput } from '../core/input/capture.js'
import { labelOf, findAction } from '../engine/runtime/input/inputmap.js'

const props = defineProps({ modelValue: { type: String, default: '' }, mode: { type: String, default: 'action' } })
const emit = defineEmits(['update:modelValue'])
const listId = 'ia' + Math.random().toString(36).slice(2, 7)
const cap = ref(null)
const names = () => (store.project?.inputMap?.actions || []).map((a) => a.name)
const isAct = () => !!findAction(store.project?.inputMap || { actions: [] }, props.modelValue)
async function capture() {
  if (cap.value) { cap.value.cancel(); return }
  cap.value = captureInput()
  const t = await cap.value.promise
  cap.value = null
  if (!t) return
  if (props.mode === 'action') { const m = (store.project.inputMap?.actions || []).find((a) => a.bindings.includes(t)); emit('update:modelValue', m ? m.name : t) } else emit('update:modelValue', t)
}
onBeforeUnmount(() => cap.value?.cancel())
</script>
<template>
  <span class="irf">
    <input type="text" :value="modelValue" :list="mode === 'action' ? listId : undefined" :placeholder="mode === 'action' ? 'acción o tecla' : 'KeyE, Mouse0…'" @input="emit('update:modelValue', $event.target.value.trim())" />
    <datalist :id="listId"><option v-for="n in names()" :key="n" :value="n"></option></datalist>
    <button type="button" :class="{ on: cap }" data-tooltip="Pulsa una tecla, botón o mando (Esc cancela)" @click="capture">{{ cap ? 'Pulsa…' : 'Capturar' }}</button>
    <small v-if="modelValue && !isAct()">{{ labelOf(modelValue) }}</small>
  </span>
</template>
<style scoped>
.irf { display: flex; gap: 4px; align-items: center; width: 100%; }
.irf input { flex: 1; min-width: 0; }
.irf button.on { background: var(--accent, #c80); color: #000; }
.irf small { color: var(--text-2); white-space: nowrap; }
</style>
