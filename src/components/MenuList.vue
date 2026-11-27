<script setup>
import { ref, nextTick, computed, watch } from 'vue'
import { normalizeAddSearch } from './add-menu-model.js'
import Icon from './Icon.vue'

const props = defineProps({ items: { type: Array, required: true }, toolbar: Boolean, searchPlaceholder: String })
const emit = defineEmits(['pick', 'back'])
const open = ref(-1)
const subStyle = ref({})
const subEl = ref([])
const rows = ref([])
const query = ref('')
const searchInput = ref(null)
const results = ref(null)
const visibleItems = computed(() => {
  if (!props.searchPlaceholder) return props.items
  const words = normalizeAddSearch(query.value).split(/\s+/).filter(Boolean)
  return props.items.filter(it => words.every(word => normalizeAddSearch(it.searchText || it.label).includes(word)))
})
watch(query, () => { open.value = -1; if (results.value) results.value.scrollTop = 0 })

function focusSub(i, it) {
  const el = subEl.value[i]
  if (it.searchPlaceholder) el?.querySelector('input')?.focus({ preventScroll: true })
  else el?.querySelector('[role="menuitem"]:not([aria-disabled="true"])')?.focus({ preventScroll: true })
}
function searchKey(e) {
  e.stopPropagation()
  if (e.isComposing) return
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    const choices = visibleItems.value.map((it, i) => !it.disabled && !it.sep && !it.heading ? i : -1).filter(i => i >= 0)
    if (choices.length) { e.preventDefault(); focusRow(e.key === 'ArrowDown' ? choices[0] : choices.at(-1)) }
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const choices = visibleItems.value.filter(it => !it.disabled && !it.sep && !it.heading)
    if (choices.length === 1) emit('pick', choices[0])
  }
}

// Mantener los submenús fijos permite abrir listas largas sin recortarlas por el scroll.
async function openSub(e, i, it) {
  if (!it.children || it.disabled) { open.value = -1; return }
  if (it.searchPlaceholder && open.value === i && subEl.value[i]) return
  const r = e.currentTarget.getBoundingClientRect()
  open.value = i
  subStyle.value = { left: r.right - 2 + 'px', top: r.top - 5 + 'px', visibility: 'hidden' }
  await nextTick()
  if (open.value !== i) return
  const el = subEl.value[i]
  if (!el) return
  const b = el.getBoundingClientRect()
  const left = r.right - 2 + b.width > window.innerWidth - 4 ? Math.max(4, r.left - b.width + 2) : r.right - 2
  const top = Math.max(4, Math.min(r.top - 5, window.innerHeight - b.height - 6))
  subStyle.value = { left: left + 'px', top: top + 'px' }
}

function activate(e, i, it) {
  // Una acción de un submenú no debe activar nuevamente su fila antecesora.
  if (it.disabled || e.target.closest('[role="menuitem"]') !== e.currentTarget) return
  if (it.children) void openSub(e, i, it).then(() => { if (it.searchPlaceholder) focusSub(i, it) })
  else emit('pick', it)
}

function focusRow(i) {
  rows.value[i]?.focus({ preventScroll: true })
  rows.value[i]?.scrollIntoView({ block: 'nearest' })
}
function closeSub(i) {
  open.value = -1
  nextTick(() => focusRow(i))
}
function onKeydown(e) {
  const keys = ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End', 'Enter', ' ']
  if (!keys.includes(e.key)) return
  e.preventDefault()
  e.stopPropagation()
  const choices = visibleItems.value.map((it, i) => (!it.sep && !it.heading && !it.disabled ? i : -1)).filter((i) => i >= 0)
  if (!choices.length) return
  const current = choices.findIndex((i) => rows.value[i] === document.activeElement)
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (props.searchPlaceholder && current === 0 && e.key === 'ArrowUp') { searchInput.value?.focus({ preventScroll: true }); return }
    const step = e.key === 'ArrowDown' ? 1 : -1
    focusRow(choices[(current + step + choices.length) % choices.length])
    return
  }
  if (e.key === 'Home') { focusRow(choices[0]); return }
  if (e.key === 'End') { focusRow(choices.at(-1)); return }
  if (e.key === 'ArrowLeft') { emit('back'); return }
  if (current < 0) { focusRow(choices[0]); return }
  const i = choices[current]
  const item = visibleItems.value[i]
  if (item.children && (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ')) {
    void openSub({ currentTarget: rows.value[i] }, i, item).then(() => {
      focusSub(i, item)
    })
  } else if (!item.children && (e.key === 'Enter' || e.key === ' ')) emit('pick', item)
}
</script>

<template>
  <div ref="results" class="menu" :class="{ 'toolbar-menu': toolbar, 'searchable-menu': searchPlaceholder }" role="menu" @keydown="onKeydown">
    <div v-if="searchPlaceholder" class="menu-search" @click.stop>
      <Icon name="search" :size="14" />
      <input ref="searchInput" v-model="query" :placeholder="searchPlaceholder" :aria-label="searchPlaceholder" @keydown="searchKey" />
    </div>
    <template v-for="(it, i) in visibleItems" :key="i">
      <div v-if="it.sep" class="sep" role="separator"></div>
      <div v-else-if="it.heading" class="head" role="presentation">{{ it.heading }}</div>
      <div
        v-else :ref="(el) => (rows[i] = el)" class="item"
        :class="{ disabled: it.disabled, danger: it.danger, has: it.children, expanded: open === i }"
        role="menuitem" tabindex="-1" :title="it.title" :aria-disabled="!!it.disabled" :aria-haspopup="it.children ? 'menu' : undefined"
        :aria-expanded="it.children ? open === i : undefined"
        @mouseenter="openSub($event, i, it)"
        @click="activate($event, i, it)"
      >
        <span class="mark"><Icon v-if="it.checked" name="check" :size="13" /><Icon v-else-if="it.icon" :name="it.icon" :size="14" /></span>
        <span class="lbl">{{ it.label }}</span>
        <span v-if="it.keys" class="keys"><kbd v-for="k in it.keys.split(' ')" :key="k">{{ k }}</kbd></span>
        <Icon v-if="it.children" name="chevron-right" :size="13" />
        <div v-if="it.children && open === i" :ref="(el) => (subEl[i] = el)" class="sub" :style="subStyle">
          <MenuList :items="it.children" :toolbar="toolbar" :search-placeholder="it.searchPlaceholder" @pick="emit('pick', $event)" @back="closeSub(i)" />
        </div>
      </div>
    </template>
    <div v-if="searchPlaceholder && !visibleItems.length" class="head">No se encontraron grupos.</div>
  </div>
</template>

<style scoped>
.menu {
  min-width: min(220px, calc(100vw - 12px)); max-width: calc(100vw - 12px);
  padding: 5px; background: var(--menu-surface); border: 1px solid var(--menu-stroke); border-radius: 6px;
  box-shadow: 0 14px 32px #0009, 0 2px 7px #0008; max-height: min(78vh, calc(100vh - 12px), var(--lf-menu-max-height, 78vh));
  overflow-y: auto; overflow-x: hidden; animation: menu-appear 115ms ease-out both;
}
.searchable-menu { width: min(280px, calc(100vw - 12px)); max-height: min(324px, 78vh, calc(100vh - 12px)); }
.menu-search { position: sticky; top: 0; z-index: 1; height: 32px; display: flex; align-items: center; gap: 6px; padding: 4px 7px; border: 1px solid var(--hair); border-radius: 4px; color: var(--text-3); background: var(--menu-surface); }
.menu-search:focus-within { border-color: var(--blue-hi); }
.menu-search input { min-width: 0; width: 100%; background: transparent; border: 0; outline: none; color: var(--text); font: inherit; }
.searchable-menu > .item { height: 28px; min-height: 28px; scroll-margin-top: 32px; }
.item { position: relative; display: flex; align-items: center; gap: 8px; min-height: 28px; padding: 4px 9px 4px 7px; border-radius: 4px; cursor: default; color: var(--text-2); outline: none; }
.item:hover:not(.disabled), .item.expanded:not(.disabled) { background: var(--menu-hover); color: var(--text); }
.item:focus-visible { outline: 2px solid var(--blue-hi); outline-offset: -2px; background: var(--menu-selected); color: var(--text); }
.item.disabled { opacity: .43; }
.item.danger:hover:not(.disabled) { background: rgba(229, 88, 79, .16); color: #ffaaa4; }
.mark { width: 16px; flex: none; display: flex; justify-content: center; color: var(--text-3); }
.item:hover .mark, .item:focus-visible .mark { color: var(--text); }
.lbl { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.keys { display: flex; gap: 2px; margin-left: 14px; }
.sep { height: 1px; background: var(--hair); margin: 5px 3px; }
.head { padding: 7px 9px 4px; font-size: 11px; font-weight: 600; color: var(--text-3); overflow:hidden;white-space:nowrap;text-overflow:ellipsis; }
.sub { position: fixed; z-index: 5; }
.toolbar-menu {
  min-width: min(244px, calc(100vw - 12px)); padding: 4px;
  background: var(--g-800); border-color: var(--hair); border-radius: 4px;
  box-shadow: 0 8px 25px #080b108c;
}
.toolbar-menu .item { border-radius: 3px; color: var(--text); }
.toolbar-menu .item:hover:not(.disabled), .toolbar-menu .item.expanded:not(.disabled), .toolbar-menu .item:focus-visible { background: var(--editor-selection); }
.toolbar-menu .sep { margin-block: 3px; border: 0; background: var(--hair); }
.toolbar-menu .keys { gap: 4px; margin-left: 16px; }
.toolbar-menu kbd { padding: 0; border: 0; background: none; font: inherit; font-size: 11px; color: var(--text-3); }
@keyframes menu-appear { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .menu { animation: none; } }
</style>
