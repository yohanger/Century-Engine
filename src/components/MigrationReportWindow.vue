<script setup>
// Informe de la migración del formato del Runtime (v1 → v2): qué se reescribió, dónde quedó la copia de seguridad y qué scripts
// mencionan el vocabulario antiguo y hay que revisar a mano. Es una ventana (sin modales); no bloquea el editor.
import AppWindow from './AppWindow.vue'
import { computed } from 'vue'
import { store } from '../core/store.js'

const m = computed(() => store.migration)
const kindName = { ui: 'Interfaz', shader: 'Shader', script: 'Script' }
const close = () => { store.modal = null }
</script>

<template>
  <AppWindow v-if="m" data-win="migration" title="Proyecto actualizado" :subtitle="m.name" :width="560" :min-width="340" :min-height="240" persist="migration" @close="close">
    <p class="lf-help intro">
      «{{ m.name }}» usaba el formato {{ m.report.from }} del Runtime y se ha pasado al {{ m.report.to }}: las etiquetas, clases y variables de interfaz y las
      funciones de shader del motor ahora empiezan por <code>rt</code> (antes <code>lf</code>).
    </p>
    <p v-if="m.backup" class="ok keep">✓ Copia de seguridad antes de migrar: <code>{{ m.backup }}</code> (junto al proyecto).</p>
    <p v-else-if="m.report.rewritten.length" class="warn keep">No había carpeta donde guardar una copia: el archivo que abriste ({{ m.source }}) no se ha modificado, así que sigue siendo tu copia de seguridad.</p>

    <h4 v-if="m.report.rewritten.length">Reescrito automáticamente ({{ m.report.rewritten.length }})</h4>
    <ul v-if="m.report.rewritten.length" class="list"><li v-for="r in m.report.rewritten" :key="r.kind + r.name"><b>{{ kindName[r.kind] || r.kind }}</b> {{ r.name }}</li></ul>

    <h4 v-if="m.report.review.length">Para revisar a mano ({{ m.report.review.length }})</h4>
    <p v-if="m.report.review.length" class="lf-help">Los scripts son código tuyo y no se tocan. Estos mencionan nombres con el prefijo antiguo; si buscan elementos de una interfaz por clase, cámbialo a <code>rt-</code>.</p>
    <ul v-if="m.report.review.length" class="list">
      <li v-for="r in m.report.review" :key="r.kind + r.name">
        <b>{{ kindName[r.kind] || r.kind }}</b> {{ r.name }}
        <div v-for="l in r.lines" :key="l.line" class="ln"><span>{{ l.line }}</span><code>{{ l.text }}</code></div>
      </li>
    </ul>
    <template #footer>
      <span class="grow"></span>
      <button class="primary" @click="close">Entendido</button>
    </template>
  </AppWindow>
</template>

<style scoped>
.grow { flex: 1; }
.intro, .ok, .warn { margin: 12px 16px 6px; font-size: 12.5px; line-height: 1.5; }
.ok { color: var(--ok); } .warn { color: var(--warn); }
code { color: var(--amber); font-family: ui-monospace, monospace; font-size: 11.5px; word-break: break-all; }
h4 { margin: 12px 16px 4px; font-size: 12px; color: var(--text-2); font-weight: 600; }
.list { list-style: none; margin: 0 16px 4px; padding: 0; font-size: 12.5px; display: flex; flex-direction: column; gap: 4px; }
.list b { color: var(--text-3); font-weight: 500; margin-right: 6px; }
.ln { display: flex; gap: 8px; margin: 2px 0 0 12px; font-size: 11.5px; } .ln span { color: var(--text-3); min-width: 28px; text-align: right; }
</style>
