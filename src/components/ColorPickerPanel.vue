<script setup>
import { computed, ref, watch } from 'vue'
import { store, getObject, updateObject, commit } from '../core/store.js'
const obj = computed(() => store.selectedIds.length === 1 ? getObject(store.selectedId) : null)
const supportsColor = computed(() => obj.value && typeof obj.value.color === 'string' && /^#[0-9a-f]{6}$/i.test(obj.value.color))
const value = computed(() => supportsColor.value ? obj.value.color : '#ffffff')
const hex = ref(value.value)
const focused = ref(false)
const dirty = ref(false)
watch(value, (v) => { if (!focused.value) hex.value = v })
function live(v) { if (!supportsColor.value || v === value.value) return; dirty.value = true; updateObject(obj.value.id, { color: v }, { commit: false }); hex.value = v }
function finish() { if (!supportsColor.value) return; const normalized = /^#[0-9a-f]{6}$/i.test(hex.value) ? hex.value : value.value; if (normalized !== value.value) live(normalized); if (dirty.value) commit('Color de ' + obj.value.name); dirty.value = false; focused.value = false; hex.value = value.value }
function reset() { focused.value = false; hex.value = value.value }
</script>
<template>
  <div class="picker" data-testid="hierarchy-color-picker">
    <template v-if="supportsColor">
      <p class="item">{{ obj.name }}</p>
      <label class="field"><span>Color</span><ColorInput :value="value" @input="live($event.target.value)" @change="finish" /></label>
      <label class="field"><span>Hexadecimal</span><input type="text" :value="hex" maxlength="7" spellcheck="false" @focus="focused = true" @input="hex = $event.target.value" @blur="finish" @keydown.enter.prevent="$event.target.blur()" @keydown.esc="reset(); $event.target.blur()" /></label>
    </template>
    <p v-else class="hint">Selecciona un único objeto que admita color. Se modifica la misma propiedad utilizada por el Inspector.</p>
  </div>
</template>
<style scoped>
.picker { padding: 12px 10px; font-size:12px; }
.item { margin:0 0 12px; font-weight:600; overflow:hidden; text-overflow:ellipsis; }
.field { display:flex; align-items:center; justify-content:space-between; gap:10px; margin:9px 0; }
.field input[type='text'] { width:100px; }
.field  :deep(.lf-color-input) { width:58px; height:26px; padding:2px; }
.hint { color:var(--text-3); font-size:12px; line-height:1.5; }
</style>
