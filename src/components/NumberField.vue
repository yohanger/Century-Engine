<script setup>
import { acquirePointer } from '../engine/runtime/input/pointer-capture.js'
import { nextTick, ref, watch } from 'vue'
import { readNumberDraft } from './number-draft.js'
const props = defineProps({
  modelValue: { type: Number, default: 0 }, label: { type: String, default: '' },
  step: { type: Number, default: 0.1 }, min: { type: Number, default: -Infinity },
  max: { type: Number, default: Infinity }, color: { type: String, default: '' },
  decimals: { type: Number, default: 3 }, disabled: { type: Boolean, default: false },
  displayDecimals: { type: Number, default: null },
  mixed: { type: Boolean, default: false },
  selectOnFocus: { type: Boolean, default: false },
  keepFocusOnEnter: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'commit'])
const dragging = ref(false)
const editing = ref(false)
const fmt = (v) => String(Number(Number(v).toFixed(props.displayDecimals ?? props.decimals)))
const currentText = (full = false) => props.mixed ? '' : full && props.displayDecimals != null ? String(props.modelValue) : fmt(props.modelValue)
const clampV = (v) => Math.min(props.max, Math.max(props.min, v))
const draft = ref(currentText())
watch(() => [props.modelValue, props.mixed, props.displayDecimals], () => { if (!editing.value && !dragging.value) draft.value = currentText() })
let startX = 0, startV = 0, moved = false, pointerId = null
let dirty = false
function focus(e) {
  if (props.disabled) return
  if (!editing.value) {
    draft.value = currentText(true); dirty = false
    if (props.displayDecimals != null) e.currentTarget.value = draft.value
  }
  editing.value = true
  if (props.selectOnFocus) e.currentTarget.select()
}
function onInput(e) {
  if (props.disabled || dragging.value) return
  editing.value = true
  dirty = true
  draft.value = e.currentTarget.value
}
function onMouseDown(e) {
  const input = e.currentTarget
  if (!props.selectOnFocus || props.disabled || e.button !== 0 || input === input.ownerDocument.activeElement) return
  e.preventDefault()
  input.focus()
}
async function confirm(keepFocus = false) {
  if (!editing.value) return
  editing.value = keepFocus
  if (!dirty || props.disabled) { dirty = false; draft.value = currentText(keepFocus); return }
  dirty = false
  const v = readNumberDraft(draft.value, props.min, props.max)
  if (v === null) { draft.value = currentText(keepFocus); return }
  draft.value = keepFocus && props.displayDecimals != null ? String(v) : fmt(v)
  if (!props.mixed && v === props.modelValue) return
  emit('update:modelValue', v)
  emit('commit')
  if (props.keepFocusOnEnter || props.displayDecimals != null) {
    await nextTick()
    if (editing.value === keepFocus && !dragging.value && !dirty) draft.value = currentText(keepFocus)
  }
}
async function onEnter(e) {
  if (e.isComposing || props.disabled) return
  e.preventDefault()
  const input = e.currentTarget
  if (!props.keepFocusOnEnter) { await confirm(false); input.blur(); return }
  await confirm(true)
  if (input === input.ownerDocument.activeElement) input.select()
}
function cancel(e) {
  if (e.key !== 'Escape') return
  e.preventDefault()
  editing.value = false
  dirty = false
  draft.value = currentText()
  e.target.blur()
}
function down(e) {
  if (editing.value || dragging.value || props.disabled || props.mixed || e.button !== 0 || !Number.isFinite(props.modelValue) || !Number.isFinite(e.clientX)) return
  if (!acquirePointer(e.currentTarget, e, "Campo numérico")) return
  pointerId = e.pointerId
  dragging.value = true; moved = false; startX = e.clientX; startV = props.modelValue
}
function move(e) {
  if (!dragging.value || props.disabled || e.pointerId !== pointerId) return
  const dx = e.clientX - startX
  if (Math.abs(dx) <= 1) return
  const mult = e.shiftKey ? 0.1 : e.ctrlKey ? 10 : 1
  const candidate = startV + dx * props.step * 0.5 * mult
  if (!Number.isFinite(candidate)) return
  const v = clampV(Number(candidate.toFixed(props.decimals)))
  if (!Number.isFinite(v)) return
  moved = true
  draft.value = fmt(v)
  emit('update:modelValue', v)
}
function up(e) { if (dragging.value && (!e || e.pointerId === pointerId)) { pointerId = null; dragging.value = false; if (moved) emit('commit') } }
</script>
<template>
  <label class="nf" :class="{ drag: dragging, disabled }">
    <span v-if="label" class="lbl" :style="color ? { background: color } : null" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @lostpointercapture="up">{{ label }}</span>
    <input type="text" inputmode="decimal" :value="draft" :placeholder="mixed ? '—' : ''" :disabled="disabled" :aria-label="label || 'Valor numérico'" :step="step" @mousedown="onMouseDown" @focus="focus" @input="onInput" @blur="confirm()" @keydown.enter="onEnter" @keydown.esc="cancel" />
  </label>
</template>
<style scoped>
.nf { display:flex; align-items:stretch; min-width:0; flex:1; }
.lbl { display:flex; align-items:center; justify-content:center; min-width:20px; padding:0 6px; font-size:11px; font-weight:600; color:#fff; background:var(--g-700); cursor:ew-resize; border-radius:4px 0 0 4px; user-select:none; touch-action:none; }
input { width:100%; min-width:0; border-radius:0 4px 4px 0; border-left:none; text-align:right; font-family:var(--font); font-size:12px; padding:4px 6px; }
.nf:not(:has(.lbl)) input { border-radius:4px; border-left:1px solid var(--hair); }
.drag .lbl { background:var(--blue) !important; }
.disabled .lbl { cursor: default; opacity: 0.5; }
</style>
