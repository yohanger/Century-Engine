<script setup>
// Ayuda → Documentación. La misma web estática funciona dentro y fuera de Electron.
// Vite copia public/docs/ a dist/docs/; la ruta relativa funciona también con file://.
import { computed } from 'vue'
import AppWindow from './AppWindow.vue'
import { store, closeDocs } from '../core/store.js'

const aliases = {
  'index.md': 'inicio',
  'guia/primeros-pasos.md': 'primeros-pasos',
  'guia/conceptos.md': 'escenas',
  'tutorial/vertical-slice.md': 'tutorial-vertical-slice',
  'referencia/api.md': 'api-intro',
  'referencia/comandos.md': 'comandos-intro',
  'referencia/ui.md': 'referencia-ui',
  'referencia/textos.md': 'referencia-textos',
  'referencia/shaders.md': 'referencia-shaders',
}

/** Conserva las rutas que usan los comandos Ayuda y los enlaces históricos. */
function route(page = 'index.md', anchor = '') {
  let id = aliases[page] || page.replace(/\.md$/, '')
  if (page === 'referencia/api.md' && anchor) id = 'api-' + anchor.toLowerCase()
  else if (page === 'referencia/comandos.md' && anchor) id = 'cmd-' + anchor.toLowerCase()
  return './docs/index.html#/' + encodeURIComponent(id) + (anchor && !page.startsWith('referencia/') ? '?section=' + encodeURIComponent(anchor) : '')
}
const url = computed(() => route(store.docsWin?.page, store.docsWin?.hash))
</script>

<template>
  <AppWindow dock-panel-id="docs" title="Documentación de Century" subtitle="Manual y referencia · Sin conexión" :width="1220" :height="780" :min-width="560" :min-height="400" :scroll="false" persist="docs" data-win="docs" @close="closeDocs">
    <iframe class="lf-documentation" :src="url" title="Portal de documentación de Century" data-testid="docs-web" />
  </AppWindow>
</template>

<style scoped>
.lf-documentation { display: block; flex: 1 1 auto; height: 100%; width: 100%; min-height: 0; border: 0; background: #fff; }
</style>
