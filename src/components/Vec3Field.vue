<script setup>
import NumberField from './NumberField.vue'
import { watch } from 'vue'

const props = defineProps({
  modelValue: { type: Array, required: true },
  step: { type: Number, default: 0.1 },
  min: { type: Number, default: -Infinity },
  decimals: { type: Number, default: 3 },
  displayDecimals: { type: Number, default: null },
})
const emit = defineEmits(['change'])

const COLORS = ['#c0504d', '#6aa84f', '#4a7fc1']
const LABELS = ['X', 'Y', 'Z']
// NumberField envía update y commit en el mismo ciclo; Vue aún puede entregar las props anteriores.
let pending = null
watch(() => props.modelValue, (v) => {
  // Un cambio externo cancela un valor temporal ajeno a la selección actual.
  if (pending && !pending.every((n, i) => n === v[i])) pending = null
})
function set(i, v) {
  const a = [...(pending || props.modelValue)]
  a[i] = v
  pending = a
  emit('change', { value: a, commit: false })
}
function commit() {
  emit('change', { value: [...(pending || props.modelValue)], commit: true })
  pending = null
}
</script>

<template>
  <div class="v3">
    <NumberField
      v-for="i in 3" :key="i"
      :model-value="modelValue[i - 1]"
      :label="LABELS[i - 1]" :color="COLORS[i - 1]"
      :step="step" :min="min" :decimals="decimals" :display-decimals="displayDecimals"
      @update:model-value="set(i - 1, $event)"
      @commit="commit"
    />
  </div>
</template>

<style scoped>
.v3 { display: flex; gap: 4px; }
</style>
