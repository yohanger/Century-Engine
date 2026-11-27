<script setup>
// Receptor de un recurso existente del proyecto. La asignación la realiza el dueño del campo.
import { ref } from 'vue'
import { store } from '../core/store.js'
import { allEntries } from '../core/project.js'
import { hasAssetDrag, resolveAssetDrop } from '../core/editor/asset-drop.js'

const props = defineProps({
  kinds: { type: Array, required: true },
  acceptedIds: { type: Array, required: true },
})
const emit = defineEmits(['assign', 'reject'])
const over = ref(false)
function dragOver(event) {
  if (!hasAssetDrag(event.dataTransfer)) return
  event.preventDefault()
  event.stopPropagation()
  event.dataTransfer.dropEffect = 'copy'
  over.value = true
}
function dragLeave(event) {
  if (event.currentTarget?.contains(event.relatedTarget)) return
  over.value = false
}
function drop(event) {
  over.value = false
  if (!hasAssetDrag(event.dataTransfer)) return
  event.preventDefault()
  event.stopPropagation()
  const entry = resolveAssetDrop(event.dataTransfer, allEntries(store.project), {
    kinds: props.kinds,
    accepts: (item) => props.acceptedIds.includes(item.id),
  })
  if (!entry) { emit('reject'); return }
  emit('assign', entry.id)
}
</script>

<template>
  <div class="resource-drop-slot" :class="{ 'resource-drop-slot--over': over }"
    data-testid="resource-drop-slot" @dragover="dragOver" @dragleave="dragLeave" @drop="drop">
    <slot />
  </div>
</template>

<style scoped>
.resource-drop-slot { min-width: 0; width: 100%; border: 1px solid transparent; border-radius: 4px; box-sizing: border-box; }
.resource-drop-slot--over { border-color: var(--blue, #3d8bd6); background: var(--blue-wash, rgba(61,139,214,.12)); }
</style>
