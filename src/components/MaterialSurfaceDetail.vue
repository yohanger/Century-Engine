<script setup>
// Un único editor para materiales locales, .material compartidos y slots de carretera.
import { computed } from 'vue'
import { store } from '../core/store.js'
import { normalizeSurfaceDetail, surfaceDetailFromLegacy, surfaceDetailSupport } from '../engine/runtime/render/surface-detail.js'
import NumberField from './NumberField.vue'
import ResourceDropSlot from './ResourceDropSlot.vue'

const props = defineProps({ obj: { type: Object, required: true }, edit: { type: Function, required: true } })
const mat = computed(() => props.obj.mat || {})
const shaderId = computed(() => mat.value.shader || (store.project.render?.look === 'clasico' ? '' : store.project.render?.shader || 'builtin:realista'))
const support = computed(() => surfaceDetailSupport(shaderId.value))
const compatible = computed(() => support.value.normal || support.value.height || support.value.procedural)
const legacy = computed(() => shaderId.value === 'builtin:realista' && !mat.value.surfaceDetail)
const data = computed(() => normalizeSurfaceDetail(mat.value.surfaceDetail) || (legacy.value ? surfaceDetailFromLegacy(mat.value) : normalizeSurfaceDetail({})))
const textures = computed(() => (store.project.assets || []).filter((a) => a.kind === 'texture'))
const fileMissing = computed(() => !!data.value.texture && !textures.value.some((a) => a.id === data.value.texture))
const change = (key, value) => props.edit({ mat: { ...mat.value, surfaceDetail: { ...data.value, [key]: value } } }, 'Detalle de superficie')
const options = computed(() => [
  ['none', 'Sin relieve'],
  ...(support.value.normal ? [['normal', 'Normal Map']] : []),
  ...(support.value.height ? [['height', 'Mapa de altura (Bump)']] : []),
  ...(support.value.procedural ? [['procedural', 'Microdetalle procedural']] : []),
])
const visibleMode = computed(() => options.value.some((o) => o[0] === data.value.mode) ? data.value.mode : 'none')
</script>

<template>
  <div class="lf-detail" data-testid="surface-detail-panel">
    <p v-if="!compatible" class="hint">Este shader tiene su propia definición de superficie. El detalle estándar no se aplicará.</p>
    <template v-else>
      <div class="field"><label for="lf-detail-mode">Modo</label>
        <select id="lf-detail-mode" :value="visibleMode" @change="change('mode', $event.target.value)">
          <option v-for="o in options" :key="o[0]" :value="o[0]">{{ o[1] }}</option>
        </select>
      </div>
      <template v-if="visibleMode !== 'none'">
        <div v-if="visibleMode === 'normal' || visibleMode === 'height'" class="field"><label for="lf-detail-texture">Imagen</label>
          <ResourceDropSlot :kinds="['texture']" :accepted-ids="textures.map(t => t.id)" @assign="change('texture', $event)">
            <select id="lf-detail-texture" :value="data.texture" @change="change('texture', $event.target.value)">
              <option value="">— seleccionar en Assets —</option>
              <option v-for="asset in textures" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
            </select>
          </ResourceDropSlot>
        </div>
        <p v-if="fileMissing && (visibleMode === 'normal' || visibleMode === 'height')" class="hint error" role="alert">La imagen no existe en Assets.</p>
        <div v-if="visibleMode !== 'procedural'" class="field"><label>Intensidad</label>
          <NumberField :model-value="data.strength" :min="0" :max="4" :step="0.05" @update:model-value="change('strength', $event)" />
        </div>
        <template v-if="support.procedural">
          <div class="field"><label>Microdetalle</label>
            <NumberField :model-value="data.micro" :min="0" :max="1" :step="0.01" @update:model-value="change('micro', $event)" />
          </div>
          <div class="field"><label>Escala micro (m)</label>
            <NumberField :model-value="data.microScale" :min="0.01" :max="2" :step="0.01" @update:model-value="change('microScale', $event)" />
          </div>
        </template>
      </template>
      <p class="hint">Relieve aparente: no desplaza vértices ni altera colisiones. Normal y altura son alternativas; el microdetalle puede acompañarlos en Realista (PBR).</p>
    </template>
  </div>
</template>

<style scoped>
.lf-detail {display:flex;flex-direction:column;gap:7px;padding:8px 0 3px;min-width:0}
.field {display:grid;grid-template-columns:minmax(85px,40%) minmax(0,1fr);gap:8px;align-items:center}
.field label {font-size:11px;color:var(--text-2)}
.field select {width:100%;min-width:0}
.hint {font-size:11px;line-height:1.5;color:var(--text-3);margin:2px 0}
.error {color:var(--danger,#f0a29c)}
</style>
