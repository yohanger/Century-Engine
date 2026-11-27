<script setup>
// Gradación de color (estilo DaVinci / Premiere): ruedas Lift · Gamma · Gain · Offset, balance de blancos, tono, saturación,
// vibrance, contraste, exposición, viñeta (intensidad, radio, color), nitidez, grano y bloom. Edita un objeto con las claves de
// project.render (o de un perfil): `values`. Emite `change` mientras se arrastra y `commit` al soltar.
import ColorWheel from './ColorWheel.vue'
import { GRADE_WHEELS } from '../engine/runtime/render/config.js'

const props = defineProps({ values: { type: Object, required: true }, compact: Boolean })
const emit = defineEmits(['change', 'commit'])
const NAMES = { lift: 'Lift', gamma: 'Gamma', gain: 'Gain', offset: 'Offset' }
const SLIDERS = [
  ['Control de color', [['hue', 'Tono', -180, 180, 1, 0], ['saturation', 'Saturación', 0, 2, 0.01, 1], ['vibrance', 'Vibrance', -1, 1, 0.01, 0], ['contrast', 'Contraste', 0.5, 2, 0.01, 1], ['exposure', 'Exposición', 0.1, 4, 0.01, 0.9]]],
  ['Temperatura y tinte', [['temperature', 'Temperatura', -1, 1, 0.01, 0], ['tintGreen', 'Tinte (verde ↔ magenta)', -1, 1, 0.01, 0]]],
  ['Viñeta', [['vignette', 'Viñeta', 0, 1, 0.01, 0], ['vignetteRadius', 'Radio', 0.05, 1, 0.01, 0.5]]],
  ['Detalle', [['sharpen', 'Nitidez', 0, 1, 0.01, 0], ['grain', 'Grano', 0, 0.5, 0.01, 0], ['bloom', 'Brillo (bloom)', 0, 3, 0.01, 0.45]]],
]
const v = (k, d) => (props.values[k] ?? d)
function set(patch) { Object.assign(props.values, patch); emit('change', patch) }
function setWheel(w, e) { set({ [w + 'X']: e.x, [w + 'Y']: e.y, [w + 'M']: e.m }) }
function resetAll() {
  const p = {}
  for (const w of GRADE_WHEELS) { p[w + 'X'] = 0; p[w + 'Y'] = 0; p[w + 'M'] = 0 }
  for (const [, list] of SLIDERS) for (const [k, , , , , d] of list) p[k] = d
  p.vignetteColor = '#000000'
  set(p); emit('commit')
}
</script>

<template>
  <div class="cg" :class="{ compact }">
    <div class="head"><b>Gradación de color</b><button class="ghost" data-tooltip="Todo a los valores neutros" data-test="grade-reset" @click="resetAll">↺ Restablecer</button></div>
    <div class="wheels">
      <ColorWheel v-for="w in GRADE_WHEELS" :key="w" :label="NAMES[w]" :x="v(w + 'X', 0)" :y="v(w + 'Y', 0)" :m="v(w + 'M', 0)" :size="compact ? 72 : 88" :data-test="'wheel-' + w" @change="setWheel(w, $event)" @commit="emit('commit')" />
    </div>
    <section v-for="[title, list] in SLIDERS" :key="title">
      <h5>{{ title }}</h5>
      <label v-for="[k, l, mn, mx, st, d] in list" :key="k" class="sl">
        <span>{{ l }}</span>
        <input type="range" :min="mn" :max="mx" :step="st" :value="v(k, d)" :data-test="'grade-' + k" @input="set({ [k]: +$event.target.value })" @change="emit('commit')" @dblclick="set({ [k]: d }); emit('commit')" />
        <b>{{ (+v(k, d)).toFixed(k === 'hue' ? 0 : 2) }}</b>
      </label>
      <label v-if="title === 'Viñeta'" class="sl"><span>Color de la viñeta</span><ColorInput :value="v('vignetteColor', '#000000')" @input="set({ vignetteColor: $event.target.value })" @change="emit('commit')" /><b></b></label>
    </section>
  </div>
</template>

<style scoped>
.cg { display: flex; flex-direction: column; gap: 10px; container-type: inline-size; }
.head { display: flex; align-items: center; justify-content: space-between; }
.wheels { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 8px; justify-items: center; }
@container (min-width: 480px) { .wheels { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
h5 { margin: 4px 0 2px; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--text-3); }
.sl { display: grid; grid-template-columns: 1fr 1.4fr 44px; align-items: center; gap: 8px; font-size: 12px; color: var(--text-2); padding: 2px 0; }
.sl input[type=range] { width: 100%; } .sl b { font-weight: 500; text-align: right; font-variant-numeric: tabular-nums; color: var(--text); }
.sl  :deep(.lf-color-input) { width: 40px; height: 22px; padding: 0; border: 1px solid var(--g-600); background: none; }
</style>
