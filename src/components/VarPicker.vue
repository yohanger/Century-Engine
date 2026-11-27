<script setup>
// Selector de interruptor / variable como el de RPG Maker MZ: un botón «0012 Llaves» que abre un cuadro con los grupos de 20 a la izquierda
// y las 20 entradas del grupo a la derecha (número + nombre). Doble clic o Intro elige; Esc cierra.
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { store } from '../core/store.js'

const props = defineProps({ modelValue: { type: Number, default: 0 }, kind: { type: String, default: 'variables' }, optional: { type: Boolean, default: false }, disabled: { type: Boolean, default: false }, none: { type: String, default: '' } })
const emit = defineEmits(['update:modelValue'])
const open = ref(false), group = ref(0), root = ref(null), pos = ref({ left: 0, top: 0, up: false })
const PER = 20
const db = computed(() => store.project.database)
const names = computed(() => db.value[props.kind] || [])
const total = computed(() => Math.max(PER, Math.ceil((names.value.length + 5) / PER) * PER))
const groups = computed(() => Array.from({ length: total.value / PER }, (_, g) => g))
const pad = (i) => String(i).padStart(4, '0')
const label = (i) => (i ? `${pad(i)}${names.value[i - 1] ? ' ' + names.value[i - 1] : ''}` : props.none || (props.kind === 'switches' ? '— ninguno —' : '— ninguna —'))
const rows = computed(() => Array.from({ length: PER }, (_, k) => group.value * PER + k + 1))
const hl = ref(0)
let pickerWindow
function show() {
  group.value = Math.max(0, Math.floor(((props.modelValue || 1) - 1) / PER)); hl.value = props.modelValue || group.value * PER + 1
  const r = root.value.getBoundingClientRect()
  const view = root.value.ownerDocument.defaultView
  pos.value = { left: Math.max(8, Math.min(r.left, view.innerWidth - 400)), top: r.bottom + 4, up: r.bottom + 360 > view.innerHeight }
  if (pos.value.up) pos.value.top = r.top - 4
  open.value = true
  nextTick(() => root.value?.querySelector('.vp-pop')?.focus())
}
function pick(i) { emit('update:modelValue', i); open.value = false }
function key(e) {
  if (e.key === 'Escape') { open.value = false; e.stopPropagation(); return }
  if (e.key === 'Enter') { pick(hl.value); e.preventDefault(); return }
  const d = { ArrowDown: 1, ArrowUp: -1, PageDown: PER, PageUp: -PER }[e.key]
  if (d) { hl.value = Math.max(1, Math.min(total.value, hl.value + d)); group.value = Math.floor((hl.value - 1) / PER); e.preventDefault() }
}
const away = (e) => { if (open.value && !root.value?.contains(e.target)) open.value = false }
watch(open, (o) => {
  if (o) {
    pickerWindow = root.value?.ownerDocument.defaultView
    pickerWindow?.addEventListener('pointerdown', away, true)
  } else pickerWindow?.removeEventListener('pointerdown', away, true)
})
onBeforeUnmount(() => pickerWindow?.removeEventListener('pointerdown', away, true))
</script>

<template>
  <span ref="root" class="vp">
    <button type="button" class="vp-btn" :disabled="disabled" :data-tooltip="kind === 'switches' ? 'Elegir interruptor' : 'Elegir variable'" @click="open ? (open = false) : show()">{{ label(modelValue) }}<i>▾</i></button>
    <div v-if="open" class="vp-pop" tabindex="0" :style="{ left: pos.left + 'px', top: pos.top + 'px', transform: pos.up ? 'translateY(-100%)' : '' }" @keydown="key">
      <div class="vp-g">
        <button v-for="g in groups" :key="g" type="button" :class="{ on: g === group }" @click="group = g">{{ pad(g * PER + 1) }}-{{ pad(g * PER + PER) }}</button>
      </div>
      <div class="vp-l">
        <button v-if="optional" type="button" class="vp-r" :class="{ on: !modelValue }" @click="pick(0)"><span class="n">—</span>{{ none || (kind === 'switches' ? 'ninguno' : 'ninguna') }}</button>
        <button v-for="i in rows" :key="i" type="button" class="vp-r" :class="{ on: i === modelValue, hl: i === hl }" @click="hl = i" @dblclick="pick(i)"><span class="n">{{ pad(i) }}</span><span class="t">{{ names[i - 1] || '' }}</span></button>
      </div>
      <div class="vp-f"><span>Doble clic o Intro para elegir</span><button type="button" class="primary" @click="pick(hl)">Aceptar</button></div>
    </div>
  </span>
</template>

<style scoped>
.vp { position: relative; display: block; min-width: 0; }
.vp-btn { width: 100%; text-align: left; display: flex; align-items: center; gap: 6px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.vp-btn i { margin-left: auto; font-style: normal; color: var(--text-3); }
.vp-pop { position: fixed; z-index: 3000; width: 380px; max-width: calc(100vw - 16px); display: grid; grid-template-columns: 118px 1fr; grid-template-rows: 1fr auto; background: var(--g-900); border: 1px solid var(--hair); border-radius: 8px; box-shadow: 0 10px 34px #000a; outline: none; height: 340px; }
.vp-g { overflow: auto; border-right: 1px solid var(--hair); padding: 4px; display: flex; flex-direction: column; gap: 2px; background: var(--g-850); border-radius: 8px 0 0 0; }
.vp-g button { text-align: left; font-variant-numeric: tabular-nums; font-size: 11px; min-height: 24px; height: 24px; background: transparent; border-color: transparent; }
.vp-g button.on { background: var(--blue-wash); border-color: var(--blue); }
.vp-l { overflow: auto; padding: 4px; display: flex; flex-direction: column; gap: 1px; }
.vp-r { display: flex; gap: 8px; text-align: left; min-height: 24px; height: 24px; background: transparent; border-color: transparent; font-size: 12px; }
.vp-r .n { color: var(--text-3); font-variant-numeric: tabular-nums; flex: none; }
.vp-r .t { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.vp-r.hl { background: var(--g-800, #2a2d33); }
.vp-r.on { background: var(--blue-wash); border-color: var(--blue); }
.vp-f { grid-column: 1 / 3; display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-top: 1px solid var(--hair); font-size: 11px; color: var(--text-3); }
.vp-f span { flex: 1; }
</style>
