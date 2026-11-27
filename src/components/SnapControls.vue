<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { editorSettings, updateSettings } from '../core/store.js'
import { snapEnabled, snapStep } from '../core/editor/snap.js'
import Icon from './Icon.vue'
const config = [
  ['translate', 'Movimiento', 'moveSnapOn', 'gridSize', 'm', [0.1, 0.25, 0.5, 1, 2, 4]],
  ['rotate', 'Rotación', 'rotateSnapOn', 'rotSnap', '°', [1, 5, 10, 15, 22.5, 45, 90]],
  ['scale', 'Escala', 'scaleSnapOn', 'scaleSnap', '', [0.05, 0.1, 0.25, 0.5, 1]],
]
const s = computed(() => editorSettings())
const on = (mode) => snapEnabled(s.value, mode)
const value = (mode) => snapStep(s.value, mode)
const open = ref(false)
const pos = ref({ top: '0px', left: '0px' })
const trigger = ref(null)
const panel = ref(null)
function togglePanel() {
  if (!open.value) {
    const rect = trigger.value.getBoundingClientRect()
    pos.value = {
      top: `${rect.bottom + 4}px`,
      left: `${Math.max(4, Math.min(rect.left, window.innerWidth - 254))}px`,
    }
  }
  open.value = !open.value
}
function outside(e) { if (open.value && !trigger.value?.contains(e.target) && !panel.value?.contains(e.target)) open.value = false }
onMounted(() => document.addEventListener('pointerdown', outside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside))
function toggle(mode, key) { updateSettings({ [key]: !on(mode) }) }
function step(key, e) { const n = Number(e.target.value); if (Number.isFinite(n) && n > 0) updateSettings({ [key]: n }) }
</script>
<template>
  <button ref="trigger" class="snap-trigger" type="button" data-testid="snap-controls" :aria-expanded="open" aria-label="Configurar snapping" @click="togglePanel"><Icon name="magnet" :size="15" /><span>Snap</span></button>
  <Teleport to="body">
    <div v-if="open" ref="panel" class="snap-panel" :style="pos" role="group" aria-label="Snapping de transformaciones">
      <div v-for="[mode, label, key, size, unit, presets] in config" :key="mode" class="snap-line">
        <label><input type="checkbox" :checked="on(mode)" :aria-label="'Snap ' + label" @change="toggle(mode, key)" />{{ label }}</label>
        <select :value="value(mode)" :disabled="!on(mode)" :aria-label="'Paso ' + label" @change="step(size, $event)">
          <option v-if="!presets.includes(value(mode))" :value="value(mode)">{{ value(mode) }}{{ unit }}</option>
          <option v-for="n in presets" :key="n" :value="n">{{ n }}{{ unit }}</option>
        </select>
      </div>
    </div>
  </Teleport>
</template>
<style scoped>
.snap-trigger { display: flex; align-items: center; gap: 5px; height: 27px; padding: 0 8px; border: 1px solid var(--hair); border-radius: 5px; background: var(--g-900); font-size: 11px; cursor: pointer; flex: none; color: var(--text-2); }
.snap-trigger[aria-expanded='true'] { color: var(--blue-hi); }
.snap-panel { position: fixed; z-index: 210; width: 246px; background: var(--g-850); padding: 9px; border: 1px solid var(--hair); border-radius: 6px; box-shadow: 0 8px 22px #0009; color:var(--text); }
.snap-line { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 4px 0; }
.snap-line label { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.snap-line select { width: 82px; font-size: 12px; }
</style>
