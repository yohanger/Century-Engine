<script setup>
import { ref, onMounted, nextTick, watch, onUnmounted } from 'vue'
import { store } from '../core/store.js'
import Icon from './Icon.vue'
import MenuList from './MenuList.vue'

const el = ref(null)
const pos = ref({ x: store.menu.x, y: store.menu.y, maxHeight: null })

function close() { store.menu = null }
function onKeydown(e) {
  if (e.key !== 'Escape') return
  const trigger = store.menu?.returnFocus
  e.preventDefault()
  close()
  if (trigger?.isConnected) {
    e.stopPropagation()
    trigger.focus({ preventScroll: true })
  }
}
function onPointerDown(e) {
  // Un clic fuera cierra; los botones de la barra reciben el clic y abren el siguiente menú.
  if (e.target.closest?.('[data-menubar-trigger]')) return
  if (!el.value?.contains(e.target)) close()
}
watch(() => store.menu, async (menu) => {
  if (!menu) return
  pos.value = { x: menu.x, y: menu.y }
  await nextTick()
  positionMenu()
  focusFirst()
})
function focusFirst() {
  el.value?.querySelector('[role="menuitem"]:not([aria-disabled="true"])')?.focus({ preventScroll: true })
}
function positionMenu() {
  if (!el.value || !store.menu) return
  const menu = store.menu
  const r = el.value.getBoundingClientRect()
  const margin = 6
  const clamp = (value, min, max) => Math.max(min, Math.min(value, Math.max(min, max)))
  let x = clamp(menu.x, margin, window.innerWidth - r.width - margin)
  let y = clamp(menu.y, margin, window.innerHeight - r.height - margin)
  let maxHeight = null
  // Un menú de pista no debe subir encima de la regla al ajustarse al viewport.
  // La fila de origen sigue visible y el menú desplaza sus elementos si falta altura.
  if (menu.timelineAnchor) {
    const a = menu.timelineAnchor
    const ruleBottom = clamp(a.contentTop ?? 0, margin, window.innerHeight - 42)
    const belowTop = Math.max(ruleBottom, a.bottom + margin)
    const below = Math.max(0, window.innerHeight - belowTop - margin)
    const above = Math.max(0, a.top - ruleBottom - margin)
    const openBelow = below >= Math.min(150, r.height) || below >= above
    maxHeight = Math.max(36, Math.min(r.height, openBelow ? below : above))
    y = openBelow ? belowTop : Math.max(ruleBottom, a.top - maxHeight - margin)
    if (a.mode === 'row') {
      const rightX = a.right + margin
      const leftX = a.left - r.width - margin
      if (rightX + r.width <= window.innerWidth - margin) x = rightX
      else if (leftX >= margin) x = leftX
    } else if (a.mode === 'point') {
      // Las claves puntuales y marcadores no deben quedar debajo del propio menú.
      const rightX = a.right + margin
      if (rightX + r.width <= window.innerWidth - margin) x = rightX
    }
  }
  pos.value = { x, y, maxHeight }
}
function onViewportResize() { positionMenu() }
function onTimelineScroll(e) {
  // La fila puede desplazarse mientras el popover está fijo al viewport.
  // El scroll propio de la lista no cierra el menú.
  if (store.menu?.timelineAnchor && !el.value?.contains(e.target)) close()
}
function onOutsideContextMenu(e) {
  if (!el.value?.contains(e.target)) close()
}
window.addEventListener('contextmenu', onOutsideContextMenu, true)
window.addEventListener('keydown', onKeydown, true)
window.addEventListener('pointerdown', onPointerDown, true)
window.addEventListener('resize', onViewportResize, true)
window.addEventListener('scroll', onTimelineScroll, true)
onUnmounted(() => {
  window.removeEventListener('contextmenu', onOutsideContextMenu, true)
  window.removeEventListener('keydown', onKeydown, true)
  window.removeEventListener('pointerdown', onPointerDown, true)
  window.removeEventListener('resize', onViewportResize, true)
  window.removeEventListener('scroll', onTimelineScroll, true)
})
function pick(it) {
  if (it.keep) { it.run?.(); if (store.menu?.rebuild) store.menu.items = store.menu.rebuild(); return }
  const trigger = store.menu?.returnFocus
  close()
  it.run?.()
  if (trigger?.isConnected) trigger.focus({ preventScroll: true })
}

onMounted(async () => { await nextTick(); positionMenu(); focusFirst() })
</script>

<template>
  <div class="veil" :class="{ dropdown: !!store.menu?.menubar }">
    <div ref="el" class="pop" :style="{ left: pos.x + 'px', top: pos.y + 'px', '--lf-menu-max-height': pos.maxHeight === null ? undefined : pos.maxHeight + 'px' }">
      <MenuList :items="store.menu.items" :toolbar="!!store.menu.menubar" @pick="pick" />
    </div>
  </div>
</template>

<style scoped>
.veil { position: fixed; inset: 0; z-index: 300; pointer-events: none; background: transparent; }
.pop { position: fixed; pointer-events: auto; }
.veil.dropdown { pointer-events: none; }
.veil.dropdown .pop { pointer-events: auto; }
</style>
