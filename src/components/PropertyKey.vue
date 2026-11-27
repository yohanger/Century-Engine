<script setup>
import Icon from './Icon.vue'
const props = defineProps({
  label: { type: String, required: true },
  available: { type: Boolean, default: false },
  marked: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['insert'])
</script>

<template>
  <button v-if="available" type="button" class="property-key" :class="{ marked }"
    :aria-label="`Insertar clave de ${label} en Timeline`" :aria-pressed="marked" :disabled="disabled"
    :title="marked ? 'Actualizar clave en el cabezal' : 'Insertar clave en el cabezal'"
    @pointerdown.stop @click.stop="emit('insert')"><Icon name="key" :size="13" /></button>
</template>

<style scoped>
.property-key { flex: none; width: 22px; min-width: 22px; height: 22px; padding: 2px; display: inline-flex; align-items: center; justify-content: center; color: var(--text-3); border: 1px solid var(--hair); border-radius: 3px; background: var(--g-800); }
.property-key:hover, .property-key:focus-visible { color: var(--text); border-color: var(--blue); }
.property-key.marked { color: var(--blue); border-color: var(--blue); }
</style>
