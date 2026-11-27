<script setup>
// Rueda de color (como DaVinci / Premiere): arrastra el punto para teñir; el deslizador de abajo es la luminosidad.
// Doble clic en la rueda = volver al centro. Valores x, y, m en −1…1.
import { usableRect } from '../engine/runtime/numeric-integrity.js'
import { acquirePointer } from '../engine/runtime/input/pointer-capture.js'
import { computed, ref } from 'vue'

const props = defineProps({ label: String, x: { type: Number, default: 0 }, y: { type: Number, default: 0 }, m: { type: Number, default: 0 }, size: { type: Number, default: 96 } })
const emit = defineEmits(['change', 'commit'])
const el = ref(null)
const dot = computed(() => ({ left: `${50 + props.x * 50}%`, top: `${50 - props.y * 50}%` }))
let drag = false
function set(e) {
  const r = el.value.getBoundingClientRect()
  if (!usableRect(r) || ![e.clientX,e.clientY].every(Number.isFinite)) return
  let x = ((e.clientX - r.left) / r.width) * 2 - 1, y = -(((e.clientY - r.top) / r.height) * 2 - 1)
  const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l }
  emit('change', { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, m: props.m })
}
function down(e) { if (!acquirePointer(el.value, e, "Rueda de color")) return; drag = true; set(e) }
function move(e) { if (drag) set(e) }
function up() { if (drag) { drag = false; emit('commit') } }
function reset() { emit('change', { x: 0, y: 0, m: 0 }); emit('commit') }
</script>

<template>
  <div class="cw">
    <div class="lb">{{ label }} <button class="rs" data-tooltip="Restablecer" @click="reset">↺</button></div>
    <div ref="el" class="wheel" :style="{ width: size + 'px', height: size + 'px' }" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @lostpointercapture="up" @dblclick="reset">
      <i class="dot" :style="dot"></i>
    </div>
    <input class="m" type="range" min="-1" max="1" step="0.01" :value="m" :data-tooltip="'Luminosidad ' + m.toFixed(2)" @input="emit('change', { x, y, m: +$event.target.value })" @change="emit('commit')" />
    <div class="vals"><span>{{ x.toFixed(2) }}</span><span>{{ y.toFixed(2) }}</span><span>{{ m.toFixed(2) }}</span></div>
  </div>
</template>

<style scoped>
.cw { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; }
.lb { font-size: 11px; color: var(--text-2); display: flex; align-items: center; gap: 4px; }
.rs { background: none; border: 0; color: var(--text-3); padding: 0 2px; font-size: 12px; cursor: pointer; } .rs:hover { color: var(--text); }
.wheel { position: relative; border-radius: 50%; cursor: crosshair; touch-action: none; flex: none;
  background: radial-gradient(circle, #fff 0%, transparent 62%), conic-gradient(from 90deg, #f00, #f0f, #00f, #0ff, #0f0, #ff0, #f00);
  box-shadow: inset 0 0 0 2px #0006, 0 0 0 1px var(--g-600); }
.dot { position: absolute; width: 10px; height: 10px; margin: -5px 0 0 -5px; border-radius: 50%; background: #fff; box-shadow: 0 0 0 2px #000a; pointer-events: none; }
.m { width: 100%; }
.vals { display: flex; gap: 6px; font-size: 10px; color: var(--text-3); font-variant-numeric: tabular-nums; }
</style>
