<script setup>
// Divisor arrastrable. dir='x': ajusta un ancho (px). dir='y': ajusta una proporción 0..1 dentro de `container`.
const props = defineProps({
  dir: { type: String, default: 'x' },
  modelValue: { type: Number, required: true },
  min: { type: Number, default: 160 },
  max: { type: Number, default: 520 },
  invert: { type: Boolean, default: false }, // true si el panel está a la derecha del divisor
  container: { type: Object, default: null },
  px: { type: Boolean, default: false }, // dir='y' en píxeles (altura); con `invert`, arrastrar hacia arriba agranda
  label: { type: String, default: 'Redimensionar panel' },
})
const emit = defineEmits(['update:modelValue'])

function down(e) {
  e.preventDefault()
  const start = props.dir === 'x' ? e.clientX : e.clientY
  const v0 = props.modelValue
  const box = props.container?.getBoundingClientRect()
  const move = (m) => {
    const cur = props.dir === 'x' ? m.clientX : m.clientY
    if (props.dir === 'x') {
      const d = (cur - start) * (props.invert ? -1 : 1)
      emit('update:modelValue', Math.round(Math.min(props.max, Math.max(props.min, v0 + d))))
    } else if (props.px) {
      const d = (cur - start) * (props.invert ? -1 : 1)
      emit('update:modelValue', Math.round(Math.min(props.max, Math.max(props.min, v0 + d))))
    } else if (box) {
      emit('update:modelValue', Math.min(props.max, Math.max(props.min, (cur - box.top) / box.height)))
    }
  }
  const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); document.body.style.cursor = '' }
  document.body.style.cursor = props.dir === 'x' ? 'col-resize' : 'row-resize'
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}
function key(e) {
  const d = props.dir === 'x'
    ? (e.key === 'ArrowLeft' ? -12 : e.key === 'ArrowRight' ? 12 : 0)
    : (props.px ? (e.key === 'ArrowUp' ? -12 : e.key === 'ArrowDown' ? 12 : 0) : 0)
  if (d) {
    e.preventDefault()
    emit('update:modelValue', Math.min(props.max, Math.max(props.min, props.modelValue + d * (props.invert ? -1 : 1))))
  }
}
</script>

<template>
  <div class="split" :class="dir" role="separator" tabindex="0" :aria-label="label" :aria-valuenow="modelValue" :aria-valuemin="min" :aria-valuemax="max" :aria-orientation="dir === 'x' ? 'vertical' : 'horizontal'" @pointerdown="down" @keydown="key"></div>
</template>

<style scoped>
.split { flex: none; position: relative; z-index: 4; background: transparent; }
.split.x { width: 5px; margin: 0 -2px; cursor: col-resize; }
.split.y { height: 5px; margin: -2px 0; cursor: row-resize; }
.split::after { content: ''; position: absolute; inset: 0; transition: background .12s; }
.split:hover::after, .split:focus-visible::after { background: var(--blue); opacity: .75; }
.split:focus-visible { outline: none; }
</style>
