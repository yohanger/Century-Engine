<script setup>
// Tema de la interfaz: todo lo que el motor dibuja por su cuenta (diálogos, opciones, avisos, pausa…) lee estas variables --rt-*.
// Las pantallas .ui por defecto ya las usan; en las tuyas puedes usar var(--rt-accent), var(--rt-font)… para heredar el estilo.
import AppWindow from './AppWindow.vue'
import { computed, reactive, ref, markRaw, onBeforeUnmount, onMounted, watchEffect } from 'vue'
import { store, setTheme, assetUrl, importFiles, resetAllSystemUi, createUi, openUiEditor } from '../core/store.js'
import { UiManager } from '../engine/runtime/ui/manager.js'
import { Game } from '../engine/runtime/events/interpreter.js'
import { normalizeTheme, THEME_PRESETS, FONT_STACKS, defaultTheme } from '../engine/runtime/ui/theme.js'
import { pickFile } from '../engine/runtime/util.js'
import { defaultUi } from '../engine/runtime/ui/defaults.js'
import UiRoot from '../engine/runtime/ui/UiRoot.vue'

const t = computed(() => normalizeTheme(store.project.theme))
const set = (k, v) => setTheme({ [k]: v }, 'Tema: ' + k)
const num = (k) => (e) => set(k, +e.target.value)
const fonts = computed(() => store.project.assets.filter((a) => a.kind === 'font'))
const images = computed(() => store.project.assets.filter((a) => a.kind === 'texture'))

// ---- vista previa (misma maquinaria que el juego) ----
const view = ref('dialog')
const mock = reactive({ on: true, focus: true, dialog: null, choices: null, prompt: '', fade: { color: '#000', alpha: 0, ms: 0 }, errors: 0, started: true, party: null })
const SAMPLE = 'Has llegado hasta aquí… pero el \\C[2]camino de vuelta\\C[0] ya no existe.'
function plain() { return 'Has llegado hasta aquí… pero el camino de vuelta ya no existe.' }
const urls = reactive({})
// la vista previa usa pantallas de ejemplo propias (el proyecto ya no trae interfaces por defecto); el tema (--rt-*) lo pueden usar los .ui del proyecto
const legacy = defaultUi()
const pgame = new Game({ database: store.project.database, host: {} })
const pm = markRaw(new UiManager({
  // diálogo, opciones e indicación: las interfaces por defecto del sistema (ui/system.js), las mismas que se ven al jugar sin Canvas propio
  play: mock, getDocs: () => legacy.uis, getConfig: () => ({ slots: { hud: legacy.ui.slots.hud || [], pause: legacy.ui.slots.pause } }), getGame: () => pgame, getTheme: () => store.project.theme,
  host: { assetUrlById: (id) => urls[id] },
}))
watchEffect(async () => { for (const a of store.project.assets) if ((a.kind === 'font' || a.kind === 'texture') && !urls[a.id]) { const u = await assetUrl(a.id); if (u) { urls[a.id] = u; pm.state.themeRev++ } } })
watchEffect(() => {
  const txt = plain()
  mock.dialog = null; mock.choices = null; mock.prompt = ''; mock.focus = true
  if (view.value === 'dialog') mock.dialog = { speaker: 'Mira', text: txt, msg: null, runs: [{ s: txt.indexOf('camino de vuelta'), e: txt.indexOf('camino de vuelta') + 16, color: t.value.accent, size: 1 }], pos: 'bottom', shown: txt.length, done: true, age: 0 }
  else if (view.value === 'choices') mock.choices = { prompt: '¿Qué haces?', options: ['Abrir la puerta', 'Escuchar en silencio', 'Marcharte'], index: 1 }
  else if (view.value === 'prompt') mock.prompt = 'E · Abrir puerta'
  else if (view.value === 'pause') mock.focus = false
})
const wrap = ref(null), k = ref(0.5)
let ro
onMounted(() => { ro = new ResizeObserver(() => { if (wrap.value) k.value = Math.max(0.2, wrap.value.clientWidth / 1280) }); ro.observe(wrap.value) })

// ---- acciones ----
const preset = (k) => setTheme({ ...defaultTheme(), fontAsset: t.value.fontAsset, bgImage: t.value.bgImage, ...THEME_PRESETS[k][1] }, 'Tema: ' + THEME_PRESETS[k][0])
async function addFont() {
  const files = await pickFile('.ttf,.otf,.woff,.woff2')
  if (!files.length) return
  await importFiles(files, 'Assets/Fonts')
  const made = (importFiles.last || []).find((m) => m.kind === 'font')
  const a = made ? store.project.assets.find((x) => x.name === made.name) : fonts.value.at(-1)
  if (a) setTheme({ font: 'asset', fontAsset: a.id }, 'Tema: fuente importada')
}
const reset = () => setTheme(defaultTheme(), 'Restablecer tema')
const apply = () => { resetAllSystemUi() }
const customize = () => { store.modal = null; const d = store.project.uis.find((u) => u.name === 'dialog.ui'); if (d) openUiEditor(d.id) }
const close = () => { store.modal = null }
onBeforeUnmount(() => { ro?.disconnect(); pm.reset() })
const VIEWS = [['dialog', 'Diálogo'], ['choices', 'Opciones'], ['prompt', 'Aviso'], ['pause', 'Pausa']]
</script>

<template>
  <AppWindow dock-panel-id="themeEditor" data-win="te" title="Tema de interfaz" subtitle="lo que el motor dibuja por sí mismo" :width="1180" :height="780" :min-width="340" :min-height="320" :scroll="false" persist="theme" @close="close">
      <div class="wrap">
        <aside>
          <section>
            <h3>Estilos</h3>
            <div class="presets"><button v-for="(p, k) in THEME_PRESETS" :key="k" @click="preset(k)">{{ p[0] }}</button></div>
          </section>
          <section>
            <h3>Texto</h3>
            <label>Fuente
              <select :value="t.font" @change="set('font', $event.target.value)">
                <option v-for="(f, k) in FONT_STACKS" :key="k" :value="k" :disabled="k === 'asset' && !fonts.length">{{ f[0] }}</option>
              </select>
            </label>
            <label v-if="t.font === 'asset'">Archivo de fuente
              <select :value="t.fontAsset" @change="set('fontAsset', $event.target.value)"><option v-for="f in fonts" :key="f.id" :value="f.id">{{ f.name }}</option></select>
            </label>
            <button class="wide" @click="addFont">Importar fuente (.ttf .otf .woff)…</button>
            <label>Tamaño <input type="range" min="10" max="40" :value="t.fontSize" @input="num('fontSize')($event)" /><em>{{ t.fontSize }}px</em></label>
            <label>Interlineado <input type="range" min="1" max="2.4" step="0.05" :value="t.lineHeight" @input="num('lineHeight')($event)" /><em>{{ t.lineHeight }}</em></label>
            <label>Espaciado <input type="range" min="-1" max="6" step="0.25" :value="t.letterSpacing" @input="num('letterSpacing')($event)" /><em>{{ t.letterSpacing }}px</em></label>
            <label>Color <ColorInput :value="t.textColor" @input="set('textColor', $event.target.value)" /></label>
            <label class="chk"><input type="checkbox" :checked="t.bold" @change="set('bold', $event.target.checked)" /> Negrita</label>
            <label class="chk"><input type="checkbox" :checked="t.textShadow" @change="set('textShadow', $event.target.checked)" /> Sombra del texto</label>
          </section>
          <section>
            <h3>Ventana</h3>
            <label>Fondo <ColorInput :value="t.winBg" @input="set('winBg', $event.target.value)" /><input type="range" min="0" max="1" step="0.02" :value="t.winOpacity" @input="num('winOpacity')($event)" /><em>{{ Math.round(t.winOpacity * 100) }}%</em></label>
            <label>Borde <ColorInput :value="t.winBorder" @input="set('winBorder', $event.target.value)" /><input type="range" min="0" max="1" step="0.02" :value="t.winBorderOpacity" @input="num('winBorderOpacity')($event)" /><em>{{ Math.round(t.winBorderOpacity * 100) }}%</em></label>
            <label>Grosor <input type="range" min="0" max="8" :value="t.winBorderWidth" @input="num('winBorderWidth')($event)" /><em>{{ t.winBorderWidth }}px</em></label>
            <label>Redondeo <input type="range" min="0" max="32" :value="t.radius" @input="num('radius')($event)" /><em>{{ t.radius }}px</em></label>
            <label>Relleno <input type="range" min="4" max="40" :value="t.padding" @input="num('padding')($event)" /><em>{{ t.padding }}px</em></label>
            <label class="chk"><input type="checkbox" :checked="t.shadow" @change="set('shadow', $event.target.checked)" /> Sombra de la ventana</label>
            <label>Imagen
              <select :value="t.bgImage" @change="set('bgImage', $event.target.value)"><option value="">— ninguna —</option><option v-for="i in images" :key="i.id" :value="i.id">{{ i.name }}</option></select>
            </label>
            <label v-if="t.bgImage">Opacidad imagen <input type="range" min="0" max="1" step="0.05" :value="t.bgImageOpacity" @input="num('bgImageOpacity')($event)" /></label>
          </section>
          <section>
            <h3>Colores de acento</h3>
            <label>Selección <ColorInput :value="t.accent" @input="set('accent', $event.target.value)" /><ColorInput :value="t.accentText" @input="set('accentText', $event.target.value)" data-tooltip="Texto sobre la selección" /></label>
            <label>Nombre <ColorInput :value="t.nameBg" @input="set('nameBg', $event.target.value)" /><ColorInput :value="t.nameText" @input="set('nameText', $event.target.value)" data-tooltip="Texto del nombre" /></label>
            <label>Indicador ▼ <ColorInput :value="t.nextColor" @input="set('nextColor', $event.target.value)" /><input type="text" maxlength="3" class="mini" :value="t.nextIcon" @input="set('nextIcon', $event.target.value)" /></label>
          </section>
          <section>
            <h3>Diálogo</h3>
            <label>Velocidad <input type="range" min="8" max="200" :value="t.speed" @input="num('speed')($event)" /><em>{{ t.speed }} car/s</em></label>
            <p class="note lf-help">El tamaño, la posición y las piezas del diálogo (nombre, retrato, ▼…) se diseñan en Assets/UI/Sistema/dialogo.ui. Estos tres ajustes solo afectan a diálogos antiguos escritos a mano:</p>
            <label>Ancho <input type="range" min="320" max="1200" step="10" :value="t.dlgWidth" @input="num('dlgWidth')($event)" /><em>{{ t.dlgWidth }}px</em></label>
            <label>Margen inferior <input type="range" min="0" max="30" :value="t.dlgBottom" @input="num('dlgBottom')($event)" /><em>{{ t.dlgBottom }}%</em></label>
            <label>Líneas mín. <input type="range" min="1" max="6" :value="t.dlgLines" @input="num('dlgLines')($event)" /><em>{{ t.dlgLines }}</em></label>
          </section>
        </aside>
        <main>
          <div class="views"><button v-for="v in VIEWS" :key="v[0]" :class="{ on: view === v[0] }" @click="view = v[0]">{{ v[1] }}</button></div>
          <div class="stage" ref="wrap"><div class="sc" :style="{ transform: `scale(${k})` }"><UiRoot :manager="pm" /></div></div>
          <p class="hint lf-help">Las pantallas por defecto leen el tema. Si una interfaz tuya sigue con su estilo antiguo, usa <b>Aplicar tema a las pantallas del sistema</b> (reemplaza el código de dialog/choices/prompt/pause/inventario/hud). En tus propias pantallas usa <code>var(--rt-accent)</code>, <code>var(--rt-font)</code>, <code>var(--rt-win-bg)</code>…</p>
          <div class="row"><button @click="apply">Aplicar tema a las pantallas del sistema</button><button @click="customize">Editar dialog.ui a mano…</button></div>
        </main>
      </div>
    <template #footer><button @click="reset">Restablecer</button><span style="flex:1"></span><button class="primary" @click="close">Cerrar</button></template>
  </AppWindow>
</template>

<style scoped>
.wrap { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(240px, 340px) minmax(0, 1fr); }
@container win (max-width: 720px) { .wrap { grid-template-columns: 1fr; overflow: auto; } aside { overflow: visible; border-right: 0; border-bottom: 1px solid var(--hair); } }
aside { overflow: auto; padding: 8px 14px 16px; border-right: 1px solid var(--hair); }
section { padding: 6px 0 10px; border-bottom: 1px solid var(--hair); }
h3 { margin: 6px 0 8px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--text-2); }
label { display: flex; align-items: center; gap: 8px; margin: 5px 0; font-size: 12px; }
label > :first-child:not(input):not(select) { }
label input[type=range] { flex: 1; min-width: 0; }
label select { flex: 1; min-width: 0; }
label em { font-style: normal; color: var(--text-2); width: 62px; text-align: right; font-size: 11px; }
label.chk { gap: 6px; }
.mini { width: 42px; text-align: center; }
.presets { display: flex; flex-wrap: wrap; gap: 5px; }
.wide { width: 100%; margin: 4px 0; }
main { display: flex; flex-direction: column; padding: 10px 14px; min-width: 0; gap: 8px; }
.views { display: flex; gap: 4px; }
.views button.on { border-color: var(--accent, #4aa3ff); }
.stage { position: relative; aspect-ratio: 16/9; width: 100%; background: repeating-conic-gradient(#2a2d33 0 25%, #23262b 0 50%) 0 0/24px 24px; border: 1px solid var(--hair); border-radius: 6px; overflow: hidden; }
.sc { position: absolute; left: 0; top: 0; width: 1280px; height: 720px; transform-origin: 0 0; }
.hint { color: var(--text-2); font-size: 11px; margin: 0; }
.row { display: flex; gap: 8px; }
.note { margin: 4px 0; font-size: 11px; line-height: 1.4; color: var(--text-3); }
</style>
