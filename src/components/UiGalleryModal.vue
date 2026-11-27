<script setup>
// «Nueva interfaz»: elige una plantilla de partida (con su vista previa viva) y un nombre.
import AppWindow from './AppWindow.vue'
import { ref, reactive, markRaw, computed } from 'vue'
import { store, createUi, openUiEditor } from '../core/store.js'
import { UI_GALLERY } from '../core/ui/templates.js'
import { UiManager } from '../engine/runtime/ui/manager.js'
import { Game } from '../engine/runtime/events/interpreter.js'
import UiRoot from '../engine/runtime/ui/UiRoot.vue'

const sel = ref(UI_GALLERY[0].key)
const item = computed(() => UI_GALLERY.find((g) => g.key === sel.value))
const name = ref('')
const folder = store.uiGalleryFolder || 'Assets/UI'
// vista previa: documento temporal fuera del proyecto
const docs = reactive([{ id: 'gal', name: 'gal.ui', code: UI_GALLERY[0].code }])
const mock = reactive({ on: true, focus: true, dialog: { speaker: 'Ana', text: 'Hola viajero.', pos: 'bottom', shown: 99, done: true, age: 1 }, choices: null, prompt: '', fade: { color: '#000', alpha: 0, ms: 0 }, errors: 0 })
const pgame = new Game({ database: store.project.database, host: {} })
const pm = markRaw(new UiManager({ play: mock, getDocs: () => docs, getConfig: () => ({ slots: {} }), getGame: () => pgame, getTheme: () => store.project.theme, host: {} }))
pm.state.preview = { docId: 'gal', props: { text: 'Texto de ejemplo', title: 'Título' } }
function pick(g) { sel.value = g.key; docs[0].code = g.code; name.value = '' }
function create() {
  const d = createUi(folder, (name.value.trim() || item.value.name).replace(/\.ui$/, '') + '.ui', item.value.code)
  store.modal = null
  openUiEditor(d.id)
}
</script>

<template>
  <AppWindow data-win="gal" title="Nueva interfaz" :width="980" :height="640" :min-width="340" :min-height="320" :scroll="false" persist="uigallery" @close="store.modal = null">
      <div class="wrap">
        <div class="grid">
          <button v-for="g in UI_GALLERY" :key="g.key" class="card" :class="{ on: sel === g.key }" @click="pick(g)" @dblclick="create">
            <span class="ic">{{ g.icon }}</span><b>{{ g.label }}</b><small class="lf-help">{{ g.desc }}</small>
          </button>
        </div>
        <div class="side">
          <div class="pv"><div class="sc"><UiRoot :manager="pm" /></div></div>
          <label>Nombre <input v-model="name" :placeholder="item.name" @keydown.enter="create" /></label>
          <p class="dim lf-help">{{ item.desc }}</p>
          <button class="primary" @click="create">Crear y editar</button>
        </div>
      </div>
    <template #footer><span class="grow"></span><button @click="store.modal = null">Cancelar</button></template>
  </AppWindow>
</template>

<style scoped>
.grow { flex: 1; }
.wrap { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 340px; }
@container win (max-width: 700px) { .wrap { grid-template-columns: 1fr; grid-template-rows: minmax(0, 1fr) auto; overflow: auto; } .side { border-left: 0; border-top: 1px solid var(--hair); } .grid { overflow: visible; } }
.grid { overflow: auto; padding: 14px; display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px; align-content: start; }
.card { display: grid; gap: 4px; text-align: left; padding: 12px; height: auto; border-radius: 8px; border: 1px solid var(--hair); background: var(--g-800, #262626); }
.card.on { border-color: var(--accent, #4aa3ff); background: var(--g-700, #2e2e2e); }
.card .ic { font-size: 22px; } .card small { color: var(--text-2); font-size: 11px; line-height: 1.35; white-space: normal; }
.side { border-left: 1px solid var(--hair); padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.pv { position: relative; aspect-ratio: 16/9; overflow: hidden; border: 1px solid var(--hair); border-radius: 6px; background: repeating-conic-gradient(#3a3f47 0 25%, #2e3238 0 50%) 0 0 / 20px 20px; }
.sc { position: absolute; left: 0; top: 0; width: 1280px; height: 720px; transform-origin: 0 0; transform: scale(.235); }
label { display: grid; gap: 4px; font-size: 12px; }
.dim { color: var(--text-2); font-size: 12px; margin: 0; }
</style>
