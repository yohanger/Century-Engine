<script setup>
// Ventana Build (como en Unity): destino, escenas del juego en orden (la 1.ª es la inicial), ajustes del juego, avisos y estado de la última exportación.
import AppWindow from './AppWindow.vue'
import ParamForm from './ParamForm.vue'
import { computed } from 'vue'
import { store, markDirty, exportGameAppImage, exportChecks, canExportApp, BUILD_TARGETS, buildScenes, toggleBuildScene, moveBuildScene, setBuildTarget } from '../core/store.js'
import { BUILD_PARAMS } from '../engine/runtime/templates/gameParams.js'
import { getTemplate } from '../core/templates/index.js'

const p = computed(() => store.project)
const tpl = computed(() => getTemplate(p.value.template))
const st = computed(() => store.gameExport)
const checks = computed(() => exportChecks())
const target = computed(() => p.value.build?.target || 'linux-x64')
const inList = computed(() => buildScenes(p.value))
const outList = computed(() => p.value.scenes.filter((s) => !inList.value.includes(s.id)))
const nameOf = (id) => p.value.scenes.find((s) => s.id === id)?.name || id
const pct = computed(() => (st.value.total ? Math.min(100, Math.round((st.value.done / st.value.total) * 100)) : 0))
const mb = (n) => (n / 1048576).toFixed(0)
const last = computed(() => p.value.build?.last)
const when = (t) => new Date(t).toLocaleString()
const show = () => window.lf?.showItem?.(st.value.result?.path || last.value?.path)
</script>

<template>
  <AppWindow data-win="eg" title="Build" :subtitle="'plantilla ' + tpl.name" :closable="!st.busy" :width="760" :min-width="420" :min-height="320" persist="exportgame" @close="store.modal = null">
    <div class="build">
      <section class="targets">
        <h3>Destino</h3>
        <button v-for="t in BUILD_TARGETS" :key="t.id" class="tg" :class="{ on: target === t.id }" :disabled="!t.ready" @click="setBuildTarget(t.id)">
          <b>{{ t.name }}</b><span>{{ t.detail }}</span><i v-if="!t.ready">pronto</i>
        </button>
      </section>

      <section class="scenes">
        <h3>Escenas del juego</h3>
        <p class="dim lf-help">La primera es la que arranca. Solo se exportan las de esta lista.</p>
        <ol class="list">
          <li v-for="(id, i) in inList" :key="id">
            <input type="checkbox" checked :disabled="st.busy" @change="toggleBuildScene(id)" />
            <span class="n">{{ i }}</span><span class="nm">{{ nameOf(id) }}</span><em v-if="i === 0">inicial</em>
            <button class="ghost" :disabled="st.busy || i === 0" @click="moveBuildScene(id, -1)">↑</button>
            <button class="ghost" :disabled="st.busy || i === inList.length - 1" @click="moveBuildScene(id, 1)">↓</button>
          </li>
          <li v-for="s in outList" :key="s.id" class="off">
            <input type="checkbox" :disabled="st.busy" @change="toggleBuildScene(s.id)" /><span class="n">–</span><span class="nm">{{ s.name }}</span>
          </li>
        </ol>
      </section>

      <section class="settings">
        <h3>Ajustes del juego</h3>
        <ParamForm :params="BUILD_PARAMS" :values="p.game" @change="markDirty()" />
        <div class="export-diagnostics">
          <h3>Herramientas de diagnóstico (solo este Build)</h3>
          <label><input type="checkbox" :disabled="st.busy" :checked="!!st.diagnostics?.devtools" @change="st.diagnostics.devtools = $event.target.checked" /> NGME-DEVTOOLS <small>Ctrl + Shift + F12</small></label>
          <label><input type="checkbox" :disabled="st.busy" :checked="!!st.diagnostics?.stats" @change="st.diagnostics.stats = $event.target.checked" /> NGME-STATS <small>Ctrl + Shift + F3</small></label>
          <p class="dim lf-help">Desactivados por defecto. La versión normal no permite estas herramientas; no se guardan en el proyecto.</p>
        </div>
      </section>
    </div>

    <ul v-if="checks.length" class="warn"><li v-for="c in checks" :key="c">⚠ {{ c }}</li></ul>
    <p v-if="!canExportApp()" class="warn">Exportar a AppImage solo está disponible en la <b>app de escritorio</b> (Electron en Linux). En el navegador puedes llevarte el proyecto con Archivo → Guardar copia (.lfproj).</p>

    <div v-if="st.busy" class="prog"><div class="bar"><i :style="{ width: pct + '%' }"></i></div><span>{{ st.phase }} {{ st.phase.startsWith('Comp') ? pct + '%' : '' }}</span></div>
    <p v-if="st.error" class="err">✕ {{ st.error }}</p>
    <p v-if="st.result" class="ok">✓ Listo · {{ mb(st.result.size) }} MB<br /><code>{{ st.result.path }}</code></p>
    <p v-else-if="last" class="dim last">Última exportación: {{ when(last.at) }} · {{ last.scenes }} escena(s) · {{ mb(last.size) }} MB<br /><code>{{ last.path }}</code></p>
    <p v-if="st.result" class="dim lf-help">Para jugar: <code>chmod +x</code> si hace falta y ejecútalo. Si tu sistema no tiene FUSE: <code>./juego.AppImage --appimage-extract-and-run</code>.</p>

    <template #footer>
      <button v-if="st.result || last" @click="show()">Mostrar en la carpeta</button>
      <span class="grow"></span>
      <button :disabled="st.busy" @click="store.modal = null">Cerrar</button>
      <button class="primary" :disabled="st.busy || !canExportApp() || !inList.length" @click="exportGameAppImage()">{{ st.busy ? 'Exportando…' : 'Build' }}</button>
    </template>
  </AppWindow>
</template>

<style scoped>
.grow { flex: 1; } .dim { color: var(--text-2); font-weight: 400; font-size: 12px; }
.build { display: grid; grid-template-columns: 150px minmax(0, 1fr) minmax(0, 1.2fr); gap: 14px; margin: 12px 16px 4px; align-items: start; }
@media (max-width: 700px) { .build { grid-template-columns: 1fr; } }
h3 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--text-3); }
.targets { display: flex; flex-direction: column; gap: 4px; }
.tg { display: grid; grid-template-columns: 1fr auto; text-align: left; padding: 6px 8px; height: auto; gap: 0 6px; } .tg b { font-size: 12.5px; } .tg span { grid-column: 1; font-size: 11px; color: var(--text-3); } .tg i { grid-row: 1; grid-column: 2; font-size: 10px; color: var(--text-3); }
.tg.on { outline: 1px solid var(--blue); } .tg:disabled { opacity: .5; }
.list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 2px; }
.list li { display: flex; align-items: center; gap: 6px; padding: 3px 4px; font-size: 12.5px; border-radius: 4px; background: var(--g-700); }
.list li.off { opacity: .6; background: transparent; }
.list .n { width: 16px; text-align: right; color: var(--text-3); font-size: 11px; } .list .nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.list em { font-size: 10px; color: var(--ok); font-style: normal; } .list button { padding: 0 6px; height: 20px; }
.warn { margin: 10px 16px; padding: 0; list-style: none; color: var(--warn); font-size: 12px; line-height: 1.5; }
.err { margin: 10px 16px; color: var(--danger); font-size: 12px; } .ok { margin: 10px 16px 2px; color: var(--ok); font-size: 12.5px; }
.ok code, p code { color: var(--amber); font-family: ui-monospace, monospace; font-size: 11.5px; word-break: break-all; }
p.dim { margin: 4px 0; font-size: 11.5px; } .last, p.lf-help { margin: 8px 16px 4px; }
.export-diagnostics { margin-top: 15px; padding-top: 10px; border-top: 1px solid var(--g-600); }
.export-diagnostics label { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; font-size: 12px; padding: 4px 0; }
.export-diagnostics label small { margin-left: auto; color: var(--text-3); font-size: 10px; }
.export-diagnostics label input { margin: 0; }
.prog { margin: 12px 16px; display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--text-2); }
.bar { height: 6px; background: var(--g-700); border-radius: 3px; overflow: hidden; } .bar i { display: block; height: 100%; background: var(--blue); transition: width .15s; }
</style>
