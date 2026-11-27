<script setup>
import { ref, watch } from 'vue'
const props = defineProps({ modelValue: { type: [String, Number], default: '' }, placeholder: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue', 'commit'])
const draft = ref(String(props.modelValue ?? ''))
const editing = ref(false)
watch(() => props.modelValue, (v) => { if (!editing.value) draft.value = String(v ?? '') })
function finish() {
  if (!editing.value) return
  editing.value = false
  if (draft.value !== String(props.modelValue ?? '')) { emit('update:modelValue', draft.value); emit('commit') }
}
function cancel(e) { e.preventDefault(); editing.value = false; draft.value = String(props.modelValue ?? ''); e.target.blur() }
</script>
<template>
  <input type="text" :value="draft" :placeholder="placeholder" @focus="editing = true" @input="draft = $event.target.value" @blur="finish" @keydown.enter.prevent="$event.target.blur()" @keydown.esc="cancel" />
</template>
