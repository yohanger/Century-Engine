<script setup>
import { usableRect } from '../engine/runtime/numeric-integrity.js'
import { acquirePointer } from '../engine/runtime/input/pointer-capture.js'
import { computed, ref } from 'vue'
import { insertVfxPoint, moveVfxPoint, removeVfxPoint } from '../core/editor/vfx-curves.js'
const props = defineProps({ points: { type: Array, required: true }, field: { type: String, default: 'value' }, maxValue: { type: Number, default: 1 }, label: { type: String, required: true } })
const emit = defineEmits(['update', 'commit'])
const svg = ref(null)
const selected = ref(0)
let activePointer = null
let dragScale = 1
const graphScale = computed(() => isColor.value ? 1 : props.maxValue <= 1 ? 1 : Math.min(props.maxValue, Math.max(2, Math.ceil(Math.max(...props.points.map(p => p.value))*1.2))))
const isColor = computed(() => props.field === 'color')
const poly = computed(() => props.points.map((p) => `${12 + p.t * 296},${74 - (isColor.value ? 0.5 : Math.max(0, Math.min(1, p.value / graphScale.value))) * 64}`).join(' '))
function setPoint(index, t, value, record = true) {
  const next = moveVfxPoint(props.points, index, t, value, props.field)
  emit('update', next, record)
  if (record) emit('commit')
}
function start(e, index) {
  if (isColor.value || e.button !== 0) return
  if (!acquirePointer(svg.value, e, "Curva VFX")) return
  selected.value = index
  activePointer = e.pointerId
  dragScale = graphScale.value
  e.preventDefault()
}
function move(e) {
  if (e.pointerId !== activePointer || isColor.value) return
  const rect = svg.value.getBoundingClientRect()
  if (!usableRect(rect) || ![e.clientX,e.clientY].every(Number.isFinite)) return
  const x = ((e.clientX - rect.left) / rect.width * 320 - 12) / 296
  const y = (74 - (e.clientY - rect.top) / rect.height * 86) / 64
  const t = Math.max(0, Math.min(1, x))
  const value = Number((Math.max(0, Math.min(1, y)) * dragScale).toFixed(3))
  setPoint(selected.value, t, value, false)
}
function stop(e) {
  if (activePointer !== e.pointerId) return
  activePointer = null
  emit('commit')
}
function add() { const v = insertVfxPoint(props.points, props.field); if (v) { emit('update', v, true); emit('commit'); selected.value = v.length - 2 } }
function remove() { const v = removeVfxPoint(props.points, selected.value); if (v) { emit('update', v, true); emit('commit'); selected.value = Math.min(selected.value, v.length - 1) } }
function editT(e) {
  const t = Number(e.target.value)
  if (Number.isFinite(t)) setPoint(selected.value, t, props.points[selected.value][props.field])
  e.target.value = props.points[selected.value].t
}
function editValue(e) {
  const v = isColor.value ? e.target.value : Number(e.target.value)
  if (isColor.value || Number.isFinite(v) && v >= 0 && v <= props.maxValue) setPoint(selected.value, props.points[selected.value].t, v)
  else e.target.value = props.points[selected.value][props.field]
}
</script>
<template>
  <section class="curve" :aria-label="label">
    <header><strong>{{ label }}</strong><span>{{ points.length }} puntos</span></header>
    <svg v-if="!isColor" ref="svg" viewBox="0 0 320 86" role="img" :aria-label="`Curva de ${label}`"
      @pointermove="move" @pointerup="stop" @pointercancel="stop" @lostpointercapture="stop">
      <path v-for="n in 5" :key="'h'+n" :d="`M12 ${10 + (n-1)*16} H308`" class="grid"/>
      <path v-for="n in 5" :key="'v'+n" :d="`M${12 + (n-1)*74} 10 V74`" class="grid"/>
      <polyline :points="poly" class="line"/>
      <circle v-for="(p,i) in points" :key="i" :cx="12+p.t*296" :cy="74-Math.max(0,Math.min(1,p.value/graphScale))*64"
        :r="i===selected?5:4" :class="['handle',{ selected: i===selected }]" tabindex="0"
        :aria-label="`Punto ${i+1}`" @pointerdown="start($event,i)" @click="selected=i" @keydown.enter="selected=i" />
    </svg>
    <div v-else class="gradient" :style="{ background: `linear-gradient(to right, ${points.map(p => `${p.color} ${p.t*100}%`).join(',')})` }"></div>
    <div v-if="isColor" class="swatches">
      <button v-for="(p,i) in points" :key="i" type="button" :class="{ picked: selected===i }" :title="`Punto ${i+1}: ${p.t}`" :style="{ background:p.color }" @click="selected=i"></button>
    </div>
    <div class="tools">
      <label>Tiempo <input type="number" min="0" max="1" step="0.01" :disabled="selected===0 || selected===points.length-1" :value="points[selected]?.t" @change="editT" /></label>
      <label>{{ isColor?'Color':'Valor' }} <input v-if="isColor" type="color" :value="points[selected]?.color" @change="editValue" />
        <input v-else type="number" min="0" :max="maxValue" step="0.01" :value="points[selected]?.value" @change="editValue" /></label>
      <button type="button" :disabled="points.length>=32" @click="add" aria-label="Añadir punto">+ Punto</button>
      <button type="button" :disabled="selected===0 || selected===points.length-1" @click="remove" aria-label="Eliminar punto">Eliminar</button>
    </div>
  </section>
</template>
<style scoped>
.curve { background:#202329; border:1px solid #343942; border-radius:6px; padding:10px; display:grid; gap:8px; }
header { display:flex; justify-content:space-between; font-size:12px; color:#e1e6ed; }
header span { color:#9ca6b4; font-size:11px; }
svg { width:100%; height:auto; background:#171b21; border-radius:4px; touch-action:none; }
.grid { fill:none; stroke:#393f49; stroke-width:.65; }
.line { fill:none; stroke:#86b4e5; stroke-width:1.8; pointer-events:none; }
.handle { fill:#d9e8f8; stroke:#4c84bd; stroke-width:1.5; cursor:grab; }
.handle.selected { fill:#91c4ff; stroke:white; }
.tools { display:flex; gap:6px; align-items:end; flex-wrap:wrap; }
.tools label { flex:1; min-width:80px; display:grid; gap:3px; font-size:10px; color:#abb5c0; }
.tools input { min-width:0; max-width:110px; width:100%; padding:4px 5px; border:1px solid #49515a; background:#14191f; color:#e3e9f1; border-radius:4px; }
.tools button { background:#303844; color:#d8e3ee; border:1px solid #45515d; border-radius:4px; font-size:11px; padding:6px; cursor:pointer; }
.tools button:disabled { opacity:.35; cursor:default; }
.gradient { height:20px; border-radius:3px; border:1px solid #444; }
.swatches { display:flex; flex-wrap:wrap; gap:6px; }
.swatches button { width:23px; height:23px; border:1px solid #707987; border-radius:4px; cursor:pointer; }
.swatches .picked { outline:2px solid #9ac9f7; outline-offset:2px; }
</style>
