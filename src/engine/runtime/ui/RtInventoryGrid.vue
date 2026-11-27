<script setup>
import { computed, inject, ref } from 'vue'

const props = defineProps({
  slots: { type: Number, default: 12 },
  cellMin: { type: Number, default: 64 },
  gap: { type: Number, default: 8 },
  modelValue: { type: Array, default: null },
  disabled: Boolean,
})
const emit = defineEmits(['update:modelValue', 'move'])
const asset = inject('rtUi', null)?.asset
const local = ref([])
const active = ref(null)
const dragged = ref(null)
const target = ref(null)
const items = computed(() => props.modelValue || local.value)
const size = computed(() => Math.max(1, Math.min(120, Math.round(props.slots) || 12)))
const cells = computed(() => Array.from({ length: size.value }, (_, index) => items.value[index] ?? null))
const label = (item) => typeof item === 'object' ? (item?.label ?? item?.name ?? item?.id ?? '') : item
const hasItem = (index) => cells.value[index] != null
const style = computed(() => ({
  '--cell-min': Math.max(24, Math.min(512, props.cellMin)) + 'px',
  '--rt-inventory-gap-default': Math.max(0, Math.min(64, props.gap)) + 'px',
}))

function move(from, to) {
  if (props.disabled || from === null || from === to || !hasItem(from) || to < 0 || to >= size.value) return
  const next = Array.from(items.value)
  const item = next[from]
  const swapped = next[to] ?? null
  next[from] = swapped
  next[to] = item
  if (props.modelValue === null) local.value = next
  emit('update:modelValue', next)
  emit('move', { from, to, item, swapped })
}

function click(index) {
  if (active.value === null || !hasItem(active.value)) {
    if (hasItem(index)) active.value = index
  } else {
    move(active.value, index)
    active.value = null
  }
}
function start(event, index) {
  if (props.disabled || !hasItem(index) || !event.dataTransfer) { event.preventDefault(); return }
  dragged.value = index
  active.value = index
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('application/x-levelforge-inventory-slot', String(index))
}
function over(event, index) {
  if (props.disabled || dragged.value === null) return
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
  target.value = index
}
function end() { dragged.value = null; target.value = null; active.value = null }
function drop(event, index) {
  if (dragged.value === null) return
  event.preventDefault()
  move(dragged.value, index)
  end()
}
</script>

<template>
  <div class="rt-inventory-grid" role="group" aria-label="Inventario" :style="style" @keydown.esc.stop="end">
    <button v-for="(item, index) in cells" :key="index" type="button" class="rt-inventory-slot" :data-inventory-slot="index + 1"
      :class="{ 'drop-target': target === index }" :disabled="disabled"
      :aria-label="'Casilla ' + (index + 1) + ', ' + (item == null ? 'vacía' : label(item) || 'objeto')"
      :aria-pressed="active === index" :draggable="!disabled && item != null"
      @click="click(index)" @dragstart="start($event, index)" @dragover="over($event, index)"
      @dragleave="target === index && (target = null)" @drop="drop($event, index)" @dragend="end">
      <img v-if="item?.icon && asset" :src="asset(item.icon)" alt="" draggable="false" />
      <span v-if="item != null">{{ label(item) }}</span>
      <small v-if="item?.count > 1">{{ item.count }}</small>
    </button>
  </div>
</template>

<style scoped>
.rt-inventory-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--cell-min)), 1fr)); align-content: start; gap: var(--rt-inventory-gap, var(--rt-inventory-gap-default)); overflow: auto; padding: 4px; pointer-events: auto; }
.rt-inventory-slot { position: relative; display: grid; place-content: center; width: 100%; min-width: 0; height: auto; aspect-ratio: 1; overflow: hidden; padding: 3px; background: var(--rt-win-bg, #151923); border: var(--rt-bw, 1px) solid var(--rt-win-border, #ffffff40); border-radius: var(--rt-radius, 6px); font: inherit; font-size: .75em; color: var(--rt-text, #fff); }
.rt-inventory-slot span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rt-inventory-slot img { margin: auto; max-width: 100%; max-height: 1.8em; object-fit: contain; pointer-events: none; }
.rt-inventory-slot small { position: absolute; bottom: 2px; right: 4px; }
.rt-inventory-slot[draggable="true"] { cursor: grab; }
.rt-inventory-slot:focus-visible, .rt-inventory-slot[aria-pressed="true"], .rt-inventory-slot.drop-target { outline: 2px solid var(--rt-accent, #67b0ec); outline-offset: -2px; }
</style>
