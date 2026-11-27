<script setup>
import { computed } from 'vue'
import NumberField from './NumberField.vue'
import Vec3Field from './Vec3Field.vue'
import { normalizeIndicatorZones } from '../engine/runtime/interaction/volumes.js'
const props = defineProps({ modelValue: { type: Object, default: null }, reach: { type: Number, default: 2.2 } })
const emit = defineEmits(['change'])
const cfg = computed(() => normalizeIndicatorZones(props.modelValue, props.reach))
function patch(zone, key, value, commit = true) {
  const next = normalizeIndicatorZones(props.modelValue, props.reach)
  next[zone][key] = value
  emit('change', { value: next, commit })
}
</script>
<template>
  <div class="lf-zone-panel">
    <p class="hint">Azul: anillo · Verde: tecla. Son zonas de detección, no colisiones físicas.</p>
    <fieldset v-for="z in ['ring', 'key']" :key="z">
      <legend>{{ z === 'ring' ? 'Zona del anillo' : 'Zona de la tecla' }}</legend>
      <div class="field"><label>Figura</label><select :value="cfg[z].shape" @change="patch(z, 'shape', $event.target.value)">
        <option value="sphere">Esfera</option><option value="box">Caja</option>
      </select></div>
      <div v-if="cfg[z].shape === 'sphere'" class="field"><label>Radio (m)</label>
        <NumberField :model-value="cfg[z].radius" :min="0.05" :step="0.1" @update:model-value="patch(z, 'radius', $event, false)" @commit="patch(z, 'radius', cfg[z].radius)" />
      </div>
      <template v-else>
        <div class="field"><label>Tamaño X/Y/Z</label><Vec3Field :model-value="cfg[z].size" :min="0.05" @change="patch(z, 'size', $event.value, $event.commit)" /></div>
        <div class="field"><label>Giro X/Y/Z (°)</label><Vec3Field :model-value="cfg[z].rotation" :step="5" @change="patch(z, 'rotation', $event.value, $event.commit)" /></div>
      </template>
      <div class="field"><label>Centro X/Y/Z</label><Vec3Field :model-value="cfg[z].offset" @change="patch(z, 'offset', $event.value, $event.commit)" /></div>
    </fieldset>
    <fieldset>
      <legend>Posición del indicador</legend>
      <label class="chk"><input type="checkbox" :checked="cfg.visual.automatic" @change="patch('visual', 'automatic', $event.target.checked)" /> Posición automática según el modelo</label>
      <div v-if="!cfg.visual.automatic" class="field"><label>Anillo X/Y/Z</label><Vec3Field :model-value="cfg.visual.offset" @change="patch('visual', 'offset', $event.value, $event.commit)" /></div>
      <div class="field"><label>Letra X/Y/Z</label><Vec3Field :model-value="cfg.visual.keyOffset" @change="patch('visual', 'keyOffset', $event.value, $event.commit)" /></div>
      <div class="field"><label>Escala</label><NumberField :model-value="cfg.visual.scale" :min="0.4" :step="0.1" @update:model-value="patch('visual', 'scale', $event, false)" @commit="patch('visual', 'scale', cfg.visual.scale)" /></div>
    </fieldset>
  </div>
</template>
<style scoped>
.lf-zone-panel { display: grid; gap: 8px; }
.lf-zone-panel fieldset { border: 1px solid var(--border, #333); border-radius: 5px; padding: 8px; min-width: 0; }
.lf-zone-panel legend { font-size: 12px; color: var(--text-muted, #aaa); padding: 0 4px; }
.lf-zone-panel .field { display: flex; align-items: center; gap: 8px; margin: 8px 0; }
.lf-zone-panel .field label { min-width: 88px; font-size: 12px; }
.lf-zone-panel .field select { flex: 1; }
.lf-zone-panel .hint { font-size: 11px; color: #999; }
</style>
