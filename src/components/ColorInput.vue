<script setup>
import { usableRect } from '../engine/runtime/numeric-integrity.js'
import { acquirePointer } from '../engine/runtime/input/pointer-capture.js'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { clamp, colorHex, hexFromRgb, hsvFromRgb, positionColorPicker, rgbFromHex, rgbFromHsv, validHex } from './color-picker-math.js'

// Sustituye el popup nativo de Electron. Conserva input/change y v-model de los campos anteriores.
defineOptions({ inheritAttrs: false })
const props = defineProps({ value: { type: String, default: undefined }, modelValue: { type: String, default: undefined }, disabled: Boolean })
const emit = defineEmits(['input', 'change', 'update:modelValue'])
const current = computed(() => colorHex(props.modelValue ?? props.value))
const swatch = ref(null), popup = ref(null), isOpen = ref(false), dirty = ref(false)
const edited = ref(current.value), hexDraft = ref(current.value)
const hsv = ref(hsvFromRgb(rgbFromHex(current.value)))
const coords = ref({ left: 0, top: 0, width: 286, maxHeight: 338 })
let dragging = false
watch(current, (val) => {
  if (val === edited.value) return
  edited.value = val
  if (!isOpen.value) hexDraft.value = val
  hsv.value = hsvFromRgb(rgbFromHex(val))
})
const hue = computed(() => hsv.value[0])
const rgb = computed(() => rgbFromHex(edited.value))
const svBackground = computed(() => ({ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hue.value}, 100%, 50%))` }))
const dot = computed(() => ({ left: `${hsv.value[1] * 100}%`, top: `${(1 - hsv.value[2]) * 100}%` }))
const hueMark = computed(() => ({ left: `${(hue.value / 360) * 100}%` }))
const syntheticEvent = (value) => ({ target: { value }, currentTarget: { value } })
function live(hex) {
  if (!validHex(hex) || colorHex(hex) === edited.value) return
  edited.value = colorHex(hex)
  hexDraft.value = edited.value
  dirty.value = true
  emit('update:modelValue', edited.value)
  emit('input', syntheticEvent(edited.value))
}
function finish() {
  if (!dirty.value) return
  dirty.value = false
  emit('change', syntheticEvent(edited.value))
}
function reposition() {
  if (!swatch.value || !isOpen.value) return
  coords.value = positionColorPicker(swatch.value.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight },
    { width: 286, height: popup.value?.offsetHeight || 338 })
}
async function open() {
  if (props.disabled) return
  if (isOpen.value) { close(); return }
  edited.value = current.value
  hexDraft.value = edited.value
  hsv.value = hsvFromRgb(rgbFromHex(edited.value))
  isOpen.value = true
  window.addEventListener('resize', reposition)
  window.addEventListener('scroll', reposition, true)
  document.addEventListener('pointerdown', outside, true)
  document.addEventListener('keydown', keyboard, true)
  await nextTick()
  reposition()
  popup.value?.querySelector('.lf-color-sv')?.focus()
}
function close() {
  if (!isOpen.value) return
  finish()
  isOpen.value = false
  window.removeEventListener('resize', reposition)
  window.removeEventListener('scroll', reposition, true)
  document.removeEventListener('pointerdown', outside, true)
  document.removeEventListener('keydown', keyboard, true)
}
function outside(e) {
  if (!swatch.value?.contains(e.target) && !popup.value?.contains(e.target)) close()
}
function keyboard(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); swatch.value?.focus() } }
function setHSV(h, s, v) {
  hsv.value = [((h % 360) + 360) % 360, clamp(s, 0, 1), clamp(v, 0, 1)]
  live(hexFromRgb(rgbFromHsv(...hsv.value)))
}
function setSV(e) {
  if (!popup.value) return
  const bounds = e.currentTarget.getBoundingClientRect()
  if (!usableRect(bounds) || ![e.clientX,e.clientY].every(Number.isFinite)) return
  setHSV(hue.value, clamp((e.clientX - bounds.left) / bounds.width, 0, 1),
    1 - clamp((e.clientY - bounds.top) / bounds.height, 0, 1))
}
function startSV(e) {
  if (e.button !== 0) return
  if (!acquirePointer(e.currentTarget, e, "Selector de color")) return
  dragging = true
  setSV(e)
}
function moveSV(e) { if (dragging) setSV(e) }
function endSV(e) {
  if (!dragging) return
  dragging = false
  if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  finish()
}
function keySV(e) {
  let [h, s, v] = hsv.value
  if (e.key === 'ArrowRight') s += 0.01
  else if (e.key === 'ArrowLeft') s -= 0.01
  else if (e.key === 'ArrowUp') v += 0.01
  else if (e.key === 'ArrowDown') v -= 0.01
  else return
  e.preventDefault()
  setHSV(h, s, v)
  finish()
}
function hueInput(e) { setHSV(Number(e.target.value), hsv.value[1], hsv.value[2]) }
function applyHex() {
  if (validHex(hexDraft.value)) { live(hexDraft.value); hsv.value = hsvFromRgb(rgbFromHex(edited.value)) }
  else hexDraft.value = edited.value
  finish()
}
function rgbInput(index, value) {
  if (value === '') return
  const next = [...rgb.value]
  next[index] = Number(value)
  const hex = hexFromRgb(next)
  live(hex)
  hsv.value = hsvFromRgb(rgbFromHex(hex))
}
onBeforeUnmount(close)
</script>

<template>
  <button ref="swatch" type="button" class="lf-color-input" :style="{ '--lf-color': edited }"
    :disabled="disabled" :aria-label="$attrs['aria-label'] || 'Elegir color'" :aria-expanded="isOpen"
    aria-haspopup="dialog" v-bind="$attrs" @click.stop="open">
    <span class="lf-color-input-swatch" aria-hidden="true"></span>
  </button>
  <Teleport to="body">
    <div v-if="isOpen" ref="popup" class="lf-color-popup" role="dialog" aria-label="Selector de color"
      :style="{ left: `${coords.left}px`, top: `${coords.top}px`, width: `${coords.width}px`, maxHeight: `${coords.maxHeight}px` }">
      <div class="lf-color-heading"><b>Color</b><button type="button" aria-label="Cerrar selector" @click="close">×</button></div>
      <div class="lf-color-sv" :style="svBackground" role="slider" tabindex="0" aria-label="Saturación y brillo"
        :aria-valuetext="`Saturación ${Math.round(hsv[1] * 100)}%, brillo ${Math.round(hsv[2] * 100)}%`"
        @pointerdown.prevent="startSV" @pointermove.prevent="moveSV" @pointerup="endSV" @pointercancel="endSV" @lostpointercapture="endSV" @keydown="keySV">
        <span class="lf-color-dot" :style="dot" aria-hidden="true"></span>
      </div>
      <div class="lf-color-hue-wrap">
        <span class="lf-color-preview" :style="{ background: edited }" aria-hidden="true"></span>
        <div class="lf-color-hue-box">
          <input type="range" min="0" max="359" step="1" :value="Math.round(hue)" aria-label="Tono"
            @input="hueInput" @change="finish" />
          <span class="lf-color-hue-cursor" :style="hueMark" aria-hidden="true"></span>
        </div>
      </div>
      <div class="lf-color-values">
        <label>HEX<input :value="hexDraft" maxlength="7" spellcheck="false" aria-label="Color hexadecimal"
          @input="hexDraft = $event.target.value" @blur="applyHex" @keydown.enter.prevent="applyHex" /></label>
        <label v-for="(key, i) in ['R', 'G', 'B']" :key="key">{{ key }}
          <input type="number" min="0" max="255" step="1" :value="rgb[i]" :aria-label="key"
            @input="rgbInput(i, $event.target.value)" @change="finish" /></label>
      </div>
    </div>
  </Teleport>
</template>

<style>
.lf-color-input { display:inline-flex; align-items:center; justify-content:stretch; box-sizing:border-box; min-width:24px; width:100%; height:var(--h, 26px); padding:2px; border:1px solid var(--hair,#333); background:var(--g-950,#080808); border-radius:var(--r,3px); cursor:pointer; vertical-align:middle; }
.lf-color-input:hover { border-color:var(--g-600,#5b626b); }
.lf-color-input:focus-visible { outline:2px solid var(--blue,#478cbf); outline-offset:1px; }
.lf-color-input-swatch { display:block; flex:1; min-width:0; height:100%; border:1px solid #ffffff38; border-radius:2px; background:var(--lf-color); }
.lf-color-popup { position:fixed; box-sizing:border-box; z-index:2147483600; overflow-y:auto; padding:10px; border-radius:7px; border:1px solid #353a42; background:#15171c; color:#e7e9ee; font:12px/1.4 'IBM Plex Sans',sans-serif; box-shadow:0 14px 36px #000b; }
.lf-color-heading { display:flex; align-items:center; justify-content:space-between; margin-bottom:9px; }
.lf-color-heading button { width:24px; height:23px; padding:0; background:transparent; border:none; font-size:18px; color:#b8bfca; }
.lf-color-sv { height:164px; width:100%; position:relative; cursor:crosshair; border:1px solid #565a61; box-sizing:border-box; border-radius:3px; touch-action:none; }
.lf-color-sv:focus-visible { outline:2px solid #479cd7; }
.lf-color-dot { position:absolute; width:12px; height:12px; border:2px solid #fff; box-shadow:0 0 0 1px #101317,0 1px 4px #000; border-radius:50%; transform:translate(-50%,-50%); pointer-events:none; }
.lf-color-hue-wrap { display:flex; align-items:center; gap:9px; margin:12px 0; }
.lf-color-preview { width:26px; height:26px; flex:none; border-radius:4px; border:1px solid #ffffff40; }
.lf-color-hue-box { position:relative; flex:1; height:13px; border-radius:10px; background:linear-gradient(to right,red,yellow,lime,cyan,blue,magenta,red); }
.lf-color-hue-box input { width:100%; height:100%; opacity:0; cursor:ew-resize; position:relative; z-index:1; margin:0; }
.lf-color-hue-box:focus-within { outline:1px solid #80b8ec; }
.lf-color-hue-cursor { position:absolute; top:-3px; width:7px; height:19px; background:#fff; border:1px solid #333; border-radius:3px; transform:translateX(-50%); pointer-events:none; }
.lf-color-values { display:grid; grid-template-columns:minmax(82px,1.7fr) repeat(3,minmax(30px,1fr)); gap:6px; }
.lf-color-values label { display:flex; flex-direction:column; gap:3px; font-size:10px; text-align:center; color:#b1b9c5; }
.lf-color-values input { width:100%; min-width:0; box-sizing:border-box; height:28px; padding:2px 4px; text-align:center; color:#e7e9ee; background:#0c0e12; border:1px solid #3a414c; border-radius:3px; font:11px 'IBM Plex Sans',sans-serif; }
.lf-color-values input:focus { outline:none; border-color:#478cbf; }
.lf-color-values input::-webkit-inner-spin-button { display:none; }
</style>
