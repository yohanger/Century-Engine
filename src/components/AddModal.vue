<script setup>
// Shift+A sigue usando el registro y la creación de nodos de siempre. Aquí solo se decide cómo mostrar el menú.
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { store } from '../core/store.js'
import Icon from './Icon.vue'
import { addMenuTree, searchAddNodes, addMenuPosition, addSubmenuPosition } from './add-menu-model.js'

const m = computed(() => store.addModal)
const search = ref('')
const input = ref(null)
const panel = ref(null)
const layer = ref(null)
const openPath = ref([])
const activeDepth = ref(0)
const selected = ref([0, 0, 0])
const positions = ref([null, null])
const tree = computed(() => addMenuTree(m.value?.items || []))
const matches = computed(() => searchAddNodes(tree.value, search.value))
const searching = computed(() => !!search.value.trim())
const heading = computed(() => (m.value?.items || []).find((i) => i.heading)?.heading || 'Añadir')
const toggle = computed(() => (m.value?.items || []).find((i) => i.checked !== undefined))
const viewport = () => ({ width: window.innerWidth, height: window.innerHeight })
const rootHeight = computed(() => Math.min(370, 29 + 31 + Math.min(340, (searching.value ? matches.value.length : tree.value.length) * 27 + 8) + (toggle.value && !searching.value ? 29 : 0) + 24))
const rootPosition = computed(() => {
  const vp = viewport()
  return addMenuPosition(m.value?.at, vp, Math.min(268, vp.width - 16), Math.min(rootHeight.value, vp.height - 16))
})
const columns = computed(() => {
  if (searching.value) return [matches.value]
  const result = [tree.value]
  let items = tree.value
  for (const i of openPath.value) {
    const next = items[i]?.children
    if (!next?.length) break
    result.push(next)
    items = next
  }
  return result
})

function close() { store.addModal = null }
function pick(item) {
  if (!item || item.disabled || typeof item.run !== 'function') return
  close()
  nextTick(() => item.run())
}
function resetSearch() {
  openPath.value = []
  activeDepth.value = 0
  selected.value = [0, 0, 0]
  positions.value = [null, null]
}
watch(search, resetSearch)

async function openBranch(depth, i) {
  const item = columns.value[depth]?.[i]
  if (!item?.children?.length || searching.value) return false
  openPath.value = [...openPath.value.slice(0, depth), i]
  activeDepth.value = depth + 1
  selected.value[depth + 1] = 0
  await nextTick()
  const el = layer.value?.querySelector(`[data-depth="${depth}"][data-index="${i}"]`)
  const parent = depth === 0 ? panel.value : layer.value?.querySelector(`[data-panel="${depth}"]`)
  if (!el || !parent) return true
  const row = el.getBoundingClientRect()
  const rect = parent.getBoundingClientRect()
  const submenu = layer.value?.querySelector(`[data-panel="${depth + 1}"]`)
  const height = Math.min(submenu?.getBoundingClientRect().height || 370, viewport().height - 16)
  const position = addSubmenuPosition(row, rect, viewport(), Math.min(260, viewport().width - 16), height)
  positions.value = positions.value.slice(0, depth)
  positions.value[depth] = position
  return true
}
function moveTo(depth, i, item) {
  selected.value[depth] = i
  if (searching.value) return
  if (item?.children?.length) void openBranch(depth, i)
  else {
    openPath.value = openPath.value.slice(0, depth)
    activeDepth.value = depth
  }
}
function choose(depth, i, item) {
  selected.value[depth] = i
  if (item?.children?.length) void openBranch(depth, i)
  else pick(item)
}
function back() {
  if (searching.value) { search.value = ''; return }
  if (activeDepth.value > 0) {
    openPath.value = openPath.value.slice(0, activeDepth.value - 1)
    activeDepth.value--
  } else close()
}
function key(e) {
  const depth = searching.value ? 0 : Math.min(activeDepth.value, columns.value.length - 1)
  const list = columns.value[depth] || []
  const cursor = Math.max(0, Math.min(selected.value[depth] || 0, list.length - 1))
  if (e.key === 'Escape') { e.preventDefault(); back() }
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    if (list.length) selected.value[depth] = Math.max(0, Math.min(list.length - 1, cursor + (e.key === 'ArrowDown' ? 1 : -1)))
    reveal(depth)
  } else if (e.key === 'ArrowRight' && !searching.value) {
    e.preventDefault()
    void openBranch(depth, cursor)
  } else if (e.key === 'ArrowLeft' && !searching.value) {
    e.preventDefault()
    back()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    choose(depth, cursor, list[cursor])
  }
}
function reveal(depth) {
  nextTick(() => layer.value?.querySelector(`[data-depth="${depth}"][data-index="${selected.value[depth]}"]`)?.scrollIntoView({ block: 'nearest' }))
}
function toggleChild() {
  if (!toggle.value) return
  toggle.value.run()
  // El destino de inserción cambia con esta opción: reconstruimos las acciones del menú abierto.
  m.value?.refresh?.()
  resetSearch()
  nextTick(() => input.value?.focus())
}
function outside(e) { if (!e.target.closest?.('.am-panel, [data-menubar-trigger]')) close() }
function resize() { close() }
onMounted(() => {
  input.value?.focus()
  window.addEventListener('pointerdown', outside, true)
  window.addEventListener('resize', resize)
})
onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', outside, true)
  window.removeEventListener('resize', resize)
})
</script>

<template>
  <div v-if="m" ref="layer" class="add-menu-layer" @keydown="key">
    <section ref="panel" class="am-panel am-root" role="region" aria-label="Añadir nodo" :style="{ left: rootPosition.left + 'px', top: rootPosition.top + 'px' }">
      <div class="am-caption"><span class="am-caption-text" :title="heading">{{ heading }}</span><button type="button" class="am-close" aria-label="Cerrar" @click="close">×</button></div>
      <label class="am-search"><Icon name="search" :size="13" /><input ref="input" v-model="search" placeholder="Buscar nodo…" spellcheck="false" aria-label="Buscar nodo" /></label>
      <div class="am-scroll" role="menu">
        <template v-for="(item, i) in columns[0]" :key="item.label + i">
          <button type="button" class="am-item" :class="{ active: selected[0] === i && (searching || activeDepth === 0 || openPath[0] === i) }"
            :data-depth="0" :data-index="i" role="menuitem" @pointerdown.prevent @mouseenter="moveTo(0, i, item)" @click="choose(0, i, item)">
            <Icon :name="item.icon || 'plus'" :size="14" />
            <span class="am-label">{{ item.label }}</span>
            <span v-if="searching && item.group" class="am-group">{{ item.group }}</span>
            <Icon v-else-if="item.children" name="chevron-right" :size="13" />
          </button>
        </template>
        <div v-if="!columns[0]?.length" class="am-empty">No se encontró ningún nodo.</div>
      </div>
      <label v-if="toggle && !searching" class="am-option"><input type="checkbox" :checked="toggle.checked" @change="toggleChild" />{{ toggle.label }}</label>
      <div class="am-help">↑ ↓ navegar · → abrir · Intro añadir · Esc salir</div>
    </section>
    <section v-for="(branch, d) in columns.slice(1)" :key="d" class="am-panel am-branch" :data-panel="d + 1"
      :style="{ left: (positions[d]?.left ?? rootPosition.left + 270) + 'px', top: (positions[d]?.top ?? rootPosition.top) + 'px' }" role="menu">
      <div class="am-branch-title">{{ columns[d]?.[openPath[d]]?.label }}</div>
      <div class="am-scroll">
        <button v-for="(item, i) in branch" :key="item.label + i" type="button" class="am-item" :class="{ active: selected[d + 1] === i && activeDepth >= d + 1 }"
          :data-depth="d + 1" :data-index="i" role="menuitem" @pointerdown.prevent @mouseenter="moveTo(d + 1, i, item)" @click="choose(d + 1, i, item)">
          <Icon :name="item.icon || 'plus'" :size="14" />
          <span class="am-label">{{ item.label }}</span>
          <Icon v-if="item.children" name="chevron-right" :size="13" />
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.add-menu-layer { position: fixed; inset: 0; z-index: 150; pointer-events: none; background: transparent; }
.am-panel { position: fixed; width: min(268px, calc(100vw - 16px)); max-height: min(370px, calc(100vh - 16px)); display: flex; flex-direction: column; background: var(--menu-surface); border: 1px solid var(--menu-stroke); border-radius: 6px; box-shadow: 0 14px 32px #0009, 0 2px 7px #0008; animation: add-menu-appear 130ms ease-out both; pointer-events: auto; overflow: hidden; color: var(--text); font-size: 12px; }
.am-branch { width: min(260px, calc(100vw - 16px)); }
.am-caption { min-height: 29px; background: var(--g-700); display: flex; align-items: center; padding: 0 7px 0 11px; border-bottom: 1px solid var(--hair); color: var(--text-3); gap: 6px; }
.am-caption-text { flex: 1; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; font-size: 11px; }
.am-close { background: transparent; border: 0; color: var(--text-2); padding: 0 4px; font-size: 18px; }
.am-close:hover { background: var(--menu-hover); color: var(--text); }
.am-close:focus-visible { outline: 2px solid var(--blue-hi); outline-offset: -2px; }
.am-search { display: flex; flex: none; align-items: center; gap: 7px; padding: 0 9px; border-bottom: 1px solid var(--hair); color: var(--text-3); }
.am-search:focus-within { background: var(--g-800); }
.am-search input { background: transparent; border: 0; outline: none; padding: 0; width: 100%; height: 30px; font-size: 12px; color: var(--text); }
.am-scroll { overflow: auto; flex: 1 1 auto; min-height: 0; padding: 4px; }
.am-item { width: 100%; min-height: 27px; display: flex; align-items: center; gap: 9px; padding: 4px 7px; background: transparent; color: var(--text-2); border: 0; border-radius: 4px; text-align: left; font-size: 12px; cursor: default; }
.am-item:hover { background: var(--menu-hover); color: var(--text); }
.am-item.active { background: var(--menu-selected); color: var(--text); }
.am-item:focus-visible { outline: 2px solid var(--blue-hi); outline-offset: -2px; }
.am-item > :first-child { flex: none; color: var(--text-3); }
.am-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.am-group { font-size: 10px; max-width: 86px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--text-3); }
.am-option { display: flex; align-items: center; gap: 7px; padding: 6px 9px; border-top: 1px solid var(--hair); font-size: 11px; color: var(--text-2); }
.am-option input { margin: 0; }
.am-help { padding: 6px 9px; border-top: 1px solid var(--hair); font-size: 10px; color: var(--text-3); white-space: nowrap; }
.am-empty { padding: 18px 8px; color: var(--text-3); }
.am-branch-title { font-size: 11px; color: var(--text-3); padding: 7px 10px; border-bottom: 1px solid var(--hair); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
@keyframes add-menu-appear { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .am-panel { animation: none; } }
</style>
