<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import Icon from './Icon.vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  options: { type: Array, default: () => [] },
  noneLabel: { type: String, default: 'Ninguno' },
  placeholder: { type: String, default: 'Buscar nodo…' },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])
const root = ref(null)
const searchInput = ref(null)
const open = ref(false)
const query = ref('')
const highlighted = ref('')
const position = ref({ left: 0, top: 0, width: 260, up: false })
let pickerWindow

const selected = computed(() => props.options.find(option => option.id === props.modelValue) || null)
const filtered = computed(() => {
  const text = query.value.trim().toLocaleLowerCase()
  return [...props.options]
    .filter(option => !text || `${option.label || ''} ${option.detail || ''}`.toLocaleLowerCase().includes(text))
    .sort((a, b) => String(a.label || '').localeCompare(String(b.label || ''), 'es') || String(a.id).localeCompare(String(b.id)))
})
watch(filtered, list => {
  if (!list.some(option => option.id === highlighted.value)) highlighted.value = list[0]?.id || ''
})

function close() { open.value = false }
function show() {
  if (props.disabled) return
  const rect = root.value.getBoundingClientRect()
  const view = root.value.ownerDocument.defaultView
  const width = Math.max(260, rect.width)
  const up = rect.bottom + 330 > view.innerHeight
  position.value = {
    left: Math.max(8, Math.min(rect.left, view.innerWidth - width - 8)),
    top: up ? rect.top - 5 : rect.bottom + 5,
    width,
    up,
  }
  query.value = ''
  highlighted.value = props.modelValue || props.options[0]?.id || ''
  open.value = true
  nextTick(() => searchInput.value?.focus({ preventScroll: true }))
}
function choose(id) { emit('update:modelValue', id); close() }
function onKeydown(event) {
  if (event.key === 'Escape') { close(); event.preventDefault(); return }
  if (event.key === 'Enter') { choose(highlighted.value || ''); event.preventDefault(); return }
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  const rows = [{ id: '' }, ...filtered.value]
  const index = rows.findIndex(option => option.id === highlighted.value)
  const next = event.key === 'ArrowDown' ? Math.min(index + 1, rows.length - 1) : Math.max(index - 1, 0)
  highlighted.value = rows[Math.max(0, next)]?.id || ''
  event.preventDefault()
}
function away(event) {
  if (!open.value || root.value?.contains(event.target) || event.target.closest?.('[data-node-picker-popover]')) return
  close()
}
watch(open, value => {
  if (value) {
    pickerWindow = root.value?.ownerDocument.defaultView
    pickerWindow?.addEventListener('pointerdown', away, true)
  } else pickerWindow?.removeEventListener('pointerdown', away, true)
})
onBeforeUnmount(() => pickerWindow?.removeEventListener('pointerdown', away, true))
</script>

<template>
  <div ref="root" class="node-picker">
    <button type="button" class="trigger" :disabled="disabled" :aria-expanded="open"
      aria-haspopup="listbox" @click="open ? close() : show()">
      <Icon :name="selected?.icon || 'search'" :size="13" />
      <span>{{ selected?.label || noneLabel }}</span><i>▾</i>
    </button>
    <Teleport to="body">
      <div v-if="open" class="popover" data-node-picker-popover :style="{
        left: position.left + 'px', top: position.top + 'px', width: position.width + 'px',
        transform: position.up ? 'translateY(-100%)' : '',
      }" @keydown="onKeydown">
        <div class="search"><Icon name="search" :size="13" /><input ref="searchInput" v-model="query"
          type="search" :placeholder="placeholder" aria-label="Buscar nodo" autocomplete="off" /></div>
        <div class="results" role="listbox" aria-label="Nodos de la escena">
          <button type="button" role="option" :aria-selected="!modelValue" :class="{ active: highlighted === '' }"
            @mouseenter="highlighted = ''" @click="choose('')">
            <Icon name="x" :size="12" /><span class="entry"><strong>{{ noneLabel }}</strong><small>Sin referencia específica</small></span>
          </button>
          <button v-for="option in filtered" :key="option.id" type="button" role="option"
            :aria-selected="modelValue === option.id" :class="{ active: highlighted === option.id, selected: modelValue === option.id }"
            @mouseenter="highlighted = option.id" @click="choose(option.id)">
            <Icon :name="option.icon || 'box'" :size="13" /><span class="entry"><strong>{{ option.label }}</strong><small>{{ option.detail }}</small></span>
            <Icon v-if="modelValue === option.id" name="check" :size="12" />
          </button>
          <p v-if="!filtered.length" class="empty">No se encontraron nodos.</p>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.node-picker { min-width:0; width:100%; }
.trigger { display:flex; align-items:center; gap:6px; width:100%; min-width:0; text-align:left; }
.trigger span { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.trigger i { font-style:normal; color:var(--text-3); }
.popover { position:fixed; z-index:5000; display:flex; flex-direction:column; max-width:calc(100vw - 16px); max-height:320px; padding:6px; gap:5px; background:var(--g-900); border:1px solid var(--hair); border-radius:7px; box-shadow:0 12px 36px #000a; }
.search { display:flex; align-items:center; gap:6px; min-height:30px; padding:0 8px; color:var(--text-3); background:var(--g-950); border:1px solid var(--hair); border-radius:5px; }
.search:focus-within { border-color:var(--blue); }
.search input { flex:1; min-width:0; height:28px; padding:0; border:0; outline:0; background:transparent; color:var(--text); }
.results { overflow:auto; display:flex; flex-direction:column; gap:2px; min-height:34px; }
.results button { display:flex; align-items:center; gap:8px; min-height:38px; padding:4px 7px; text-align:left; background:transparent; border:1px solid transparent; }
.results button:hover, .results button.active { background:var(--g-800); }
.results button.selected { border-color:var(--blue); background:var(--blue-wash); }
.entry { display:flex; flex:1; flex-direction:column; min-width:0; gap:1px; }
.entry strong, .entry small { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.entry strong { font-size:12px; font-weight:500; }
.entry small { color:var(--text-3); font-size:10px; }
.empty { margin:0; padding:18px 8px; color:var(--text-3); text-align:center; font-size:11px; }
</style>
