<script setup>
import { computed } from 'vue'
import { store } from '../core/store.js'
import { MENUS, MESH_MENU, items, openAddMenu } from '../core/commands.js'
import Icon from './Icon.vue'

const phone = computed(() => store.ui.mode === 'phone')

/** Menús de la barra: Archivo, Editar, Añadir, Ver, Juego, Ayuda (+ Malla en modo edición). */
const menus = computed(() => {
  const m = [{ label: 'Archivo', ids: MENUS[0].ids }, { label: 'Editar', ids: MENUS[1].ids }, { label: 'Añadir', add: true }, { label: 'Ver', ids: MENUS[2].ids }, { label: 'Juego', ids: MENUS[3].ids }, { label: 'Ayuda', ids: MENUS[4].ids }]
  if (store.edit.on) m.splice(2, 0, { label: 'Malla', ids: MESH_MENU })
  return m
})

/** Un solo menú superior activo: Añadir usa su panel especializado, no store.menu. */
const activeMenu = computed(() => store.addModal?.menubar === 'Añadir' ? 'Añadir' : store.menu?.menubar || null)
function showMenu(e, m, toggle = false) {
  const current = activeMenu.value
  if (toggle && current === m.label) {
    store.menu = null
    store.addModal = null
    return
  }
  const r = e.currentTarget.getBoundingClientRect()
  // Cerrar primero el otro sistema evita que ambos paneles coexistan.
  store.menu = null
  store.addModal = null
  if (m.add) {
    openAddMenu({ x: r.left, y: r.bottom + 2 })
    if (store.addModal) store.addModal.menubar = 'Añadir'
  } else {
    store.menu = { x: r.left, y: r.bottom + 2, items: items(m.ids), menubar: m.label }
  }
}
function openMenu(e, m) { showMenu(e, m, true) }
function hoverMenu(e, m) {
  if (!activeMenu.value || activeMenu.value === m.label) return
  showMenu(e, m)
}
function burger(e) {
  store.addModal = null
  const r = e.currentTarget.getBoundingClientRect()
  store.menu = {
    x: r.left, y: r.bottom + 2,
    items: menus.value.map((m) => (m.add
      ? { label: 'Añadir…', icon: 'plus', run: () => { store.menu = null; openAddMenu({ x: r.left, y: r.bottom + 2 }) } }
      : { label: m.label, children: items(m.ids) })),
  }
}
</script>

<template>
  <!-- Toda la barra arrastra la ventana en Electron; los botones quedan fuera de la zona de arrastre. -->
  <header class="bar">
    <nav v-if="!phone" class="menus" aria-label="Menús del editor">
      <button v-for="m in menus" :key="m.label" class="ghost" data-menubar-trigger :class="{ hot: m.label === 'Malla', active: activeMenu === m.label }" :aria-expanded="activeMenu === m.label" aria-haspopup="menu" @mouseenter="hoverMenu($event, m)" @click="openMenu($event, m)">{{ m.label }}</button>
    </nav>
    <button v-else class="ghost icon" aria-label="Menú principal" @click="burger"><Icon name="more" /></button>
    <span v-if="!store.locked && store.project" class="project-title" :title="store.project.name">{{ store.project.name }}</span>
  </header>
</template>

<style scoped>
.bar {
  display: flex; align-items: center; gap: 4px; height: 36px; min-width: 0;
  /* en macOS los botones de la ventana quedan a la izquierda: titlebar-area-x los esquiva (0 si no hay superposición) */
  padding: 0 max(8px, calc(100% - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100%) + 8px)) 0 max(8px, env(titlebar-area-x, 0px));
  background: var(--editor-chrome); border-bottom: 1px solid var(--hair-soft);
  -webkit-app-region: drag;
}
.bar button { -webkit-app-region: no-drag; }
.menus { display: flex; align-items: center; flex: none; gap: 2px; }
.menus button { height: 28px; padding: 0 10px; border-radius: 4px; color: var(--text); font-weight: 400; }
.menus button.hot { color: var(--amber); }
.menus button:hover { background: var(--g-800); }
.menus button.active { background: var(--editor-selection); }
.menus button:focus-visible { outline: 2px solid var(--blue-hi); outline-offset: -2px; }
.project-title { margin-left: auto; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
