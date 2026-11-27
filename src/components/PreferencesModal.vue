<script setup>
import AppWindow from './AppWindow.vue'
import { store } from '../core/store.js'
import ColorInput from './ColorInput.vue'
import { computed, ref } from 'vue'
import Icon from './Icon.vue'
import NumberField from './NumberField.vue'
import { defaultPrefs } from '../core/state/state.js'
import { editorAppearance, applyEditorAppearance } from '../core/editor/appearance.js'

const p = store.prefs
const appearanceStatus = ref('')
async function openConfig() {
  try { appearanceStatus.value = await window.lf.openEditorConfig() }
  catch (error) { appearanceStatus.value = error.message }
}
async function reloadEditorConfig() {
  try {
    await applyEditorAppearance(true)
    appearanceStatus.value = editorAppearance.value?.issues.length ? '' : 'Configuración recargada desde editor.toml.'
  } catch (error) { appearanceStatus.value = error.message }
}
const setEditorFov = (value) => {
  const n = Number(value)
  p.editorFov = Number.isFinite(n) && value !== '' ? Math.min(120, Math.max(40, n)) : 90
}

const sections = [
  { id: 'device', category: 'navigation', title: 'Dispositivo de navegación', rows: [['navigation', 'Dispositivo de navegación', 'device']] },
  { id: 'mouse', category: 'navigation', title: 'Ratón', hint: 'Rueda pulsada: órbita. Shift + rueda pulsada: desplazamiento. Rueda: zoom.', rows: [
    ['mouseSensitivity', 'Velocidad general', 0.1, 3, 0.05, 'x'],
    ['mouseOrbit', 'Sensibilidad al orbitar', 0.2, 3, 0.05, 'x'], ['mousePan', 'Sensibilidad al desplazar', 0.2, 3, 0.05, 'x'], ['mouseZoom', 'Velocidad del zoom (rueda)', 0.2, 4, 0.05, 'x'],
    ['flyLook', 'Sensibilidad de la mirada libre', 0.2, 3, 0.05, 'x'], ['mouseInvertZoom', 'Invertir el sentido de la rueda', 'bool'],
  ] },
  { id: 'pad', category: 'navigation', title: 'Trackpad', hint: 'Dos dedos: órbita. Shift + dos dedos: desplazamiento. Pellizco: zoom.', rows: [
    ['padOrbit', 'Sensibilidad al orbitar', 0.1, 3, 0.05, 'x'], ['padPan', 'Sensibilidad al desplazar', 0.1, 3, 0.05, 'x'], ['padZoom', 'Sensibilidad del pellizco (zoom)', 0.1, 4, 0.05, 'x'],
    ['padInvert', 'Invertir órbita y desplazamiento', 'bool'], ['padInvertY', 'Invertir solo el eje vertical', 'bool'], ['padZoomCursor', 'Zoom hacia el cursor', 'bool'],
  ] },
  { id: 'flight', category: 'navigation', title: 'Vuelo libre', hint: 'Clic derecho + W A S D.', rows: [
    ['flySpeed', 'Velocidad de vuelo', 2, 120, 1, 'm/s'], ['flySprint', 'Multiplicador con Shift', 1, 10, 0.5, 'x'],
  ] },
  { id: 'camera', category: 'viewport', title: 'Cámara del editor', rows: [['editorFov', 'FOV horizontal', 'fov'], ['orbitSelection', 'Orbitar alrededor de la selección', 'bool']] },
  { id: 'selection', category: 'viewport', title: 'Selección de objetos 3D', rows: [
    ['selectionStyle', 'Indicador en el Editor', 'selection'], ['selectionOutlineColor', 'Color', 'color'],
    ['selectionOutlineWidth', 'Grosor', 0.5, 4, 0.5, ''], ['selectionOutlineStrength', 'Intensidad', 0.5, 6, 0.5, ''],
  ] },
  { id: 'gizmos', category: 'viewport', title: 'Gizmos', rows: [
    ['gizmoSize', 'Tamaño de los gizmos', 0.5, 4, 0.05, 'x'], ['orientGizmo', 'Gizmo de ejes', 'bool'], ['showGizmos', 'Mostrar ayudas editoriales', 'bool'],
    ['toolPalette', 'Paleta de herramientas (obsoleta)', 'bool'],
  ] },
  { id: 'interface', category: 'interface', title: 'Interfaz', rows: [['inspLabelWidth', 'Ancho de etiquetas del Inspector', 72, 240, 1, 'px'], ['tooltips', 'Mostrar tooltips', 'bool'], ['addAsChild', 'Shift+A añade dentro del seleccionado', 'bool']] },
  { id: 'project', category: 'project', title: 'Proyecto', rows: [['diskDelay', 'Escribir el proyecto en disco tras', 1, 60, 1, 's'], ['terrainCropWarning', 'Advertir antes de recortar datos del terreno', 'bool']] },
]
const categories = [
  { id: 'navigation', label: 'Navegación', icon: 'mouse' }, { id: 'viewport', label: 'Viewport', icon: 'camera' },
  { id: 'interface', label: 'Interfaz', icon: 'sliders' }, { id: 'project', label: 'Proyecto', icon: 'folder' },
  { id: 'config', label: 'Archivo de configuración', icon: 'file' },
]
const defaults = defaultPrefs()
const keys = [...new Set(sections.flatMap(s => s.rows.map(r => r[0])).concat('gizmoCategories'))]
const category = ref('navigation'), search = ref(''), folded = ref({})
const normalize = text => String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
const matches = text => normalize(search.value).split(/\s+/).every(term => normalize(text).includes(term))
const visibleSections = computed(() => sections.filter(s => search.value.trim() || s.category === category.value).map(s => ({ ...s, rows: s.rows.filter(r => matches([categories.find(c=>c.id===s.category)?.label,s.title,s.hint,r[0],r[1]].join(' '))) })).filter(s => s.rows.length))
const showConfig = computed(() => !search.value.trim() ? category.value === 'config' : matches('archivo configuración editor.toml recargar abrir'))
const changed = key => JSON.stringify(p[key]) !== JSON.stringify(defaults[key])
const resetOne = key => { p[key] = structuredClone(defaults[key]) }
const reset = () => keys.forEach(resetOne)
const selectCategory = id => { category.value = id; search.value = '' }
const toggle = id => { folded.value[id] = !folded.value[id] }
const closed = id => !search.value.trim() && folded.value[id]
const selectionDetails = key => ['selectionOutlineColor','selectionOutlineWidth','selectionOutlineStrength'].includes(key)
const updateNumber = (row, value) => { if (Number.isFinite(value)) p[row[0]] = Math.min(row[3], Math.max(row[2], value)) }
</script>

<template>
  <AppWindow title="Preferencias del editor" :width="760" :height="540" :min-width="340" :min-height="240" persist="prefs" :scroll="false" @close="store.modal = null">
    <div class="preferences" data-testid="editor-preferences">
      <div class="prefs-search"><Icon name="search" :size="14"/><input v-model="search" type="search" placeholder="Buscar preferencias…" aria-label="Buscar preferencias" /></div>
      <div class="prefs-layout">
        <nav class="prefs-nav" aria-label="Categorías de preferencias">
          <button v-for="c in categories" :key="c.id" :class="{ on: category === c.id && !search.trim() }" :aria-pressed="category === c.id && !search.trim()" @click="selectCategory(c.id)"><Icon :name="c.icon" :size="15"/><span>{{ c.label }}</span></button>
        </nav>
        <main class="prefs-content">
          <section v-if="showConfig" class="prefs-section">
            <h3>Archivo de configuración</h3>
            <template v-if="editorAppearance">
              <div class="config-path" :title="editorAppearance.path">{{ editorAppearance.path }}</div>
              <div class="config-actions"><button @click="openConfig">Abrir editor.toml</button><button @click="reloadEditorConfig">Recargar editor.toml</button></div>
              <p v-if="appearanceStatus" role="status">{{ appearanceStatus }}</p>
              <p v-for="issue in editorAppearance.issues" :key="issue" class="config-issue" role="status">{{ issue }}</p>
            </template>
            <p v-else>Archivo disponible en Electron.</p>
          </section>
          <section v-for="s in visibleSections" :key="s.id" class="prefs-section" :data-pref-section="s.id">
            <button class="section-head" :aria-expanded="!closed(s.id)" :title="s.hint || s.title" @click="toggle(s.id)"><Icon :name="closed(s.id) ? 'chevron-right' : 'chevron-down'" :size="13"/><span>{{ s.title }}</span></button>
            <div v-if="!closed(s.id)" class="section-rows">
              <template v-for="r in s.rows" :key="r[0]">
                <div v-if="!selectionDetails(r[0]) || p.selectionStyle !== 'none'" class="row" :class="{ modified: changed(r[0]) }" :data-pref="r[0]">
                  <label :for="'pref-'+r[0]" :title="r[1]">{{ r[1] }}</label>
                  <div class="control">
                    <input v-if="r[2] === 'bool'" :id="'pref-'+r[0]" v-model="p[r[0]]" type="checkbox" />
                    <div v-else-if="r[2] === 'device'" class="seg"><button :class="{ on: p.navigation === 'mouse' }" @click="p.navigation = 'mouse'">Ratón</button><button :class="{ on: p.navigation === 'trackpad' }" @click="p.navigation = 'trackpad'">Trackpad</button></div>
                    <input v-else-if="r[2] === 'fov'" id="editor-camera-fov" class="number" type="number" min="40" max="120" step="1" :value="p.editorFov ?? 90" aria-label="FOV horizontal de la cámara del editor" @change="setEditorFov($event.target.value)" />
                    <select v-else-if="r[2] === 'selection'" :id="'pref-'+r[0]" v-model="p.selectionStyle"><option value="box">Caja</option><option value="outline">Contorno</option><option value="none">Ninguno</option></select>
                    <ColorInput v-else-if="r[2] === 'color'" :id="'pref-'+r[0]" v-model="p.selectionOutlineColor" />
                    <div v-else class="numeric-control"><input :id="'pref-'+r[0]" type="range" :aria-label="r[1]" :value="p[r[0]]" :min="r[2]" :max="r[3]" :step="r[4]" @input="updateNumber(r, Number($event.target.value))"/><NumberField :model-value="p[r[0]]" :min="r[2]" :max="r[3]" :step="r[4]" :decimals="r[4] >= 1 ? 0 : 2" :title="r[1]" @update:model-value="updateNumber(r, $event)"/><span class="unit">{{ r[5] }}</span></div>
                  </div>
                  <button class="reset-one" :disabled="!changed(r[0])" :aria-label="'Restablecer '+r[1]" title="Restablecer valor" @click="resetOne(r[0])"><Icon name="undo" :size="13"/></button>
                </div>
              </template>
            </div>
          </section>
          <p v-if="!visibleSections.length && !showConfig" class="empty">No se encontraron preferencias.</p>
        </main>
      </div>
    </div>
    <template #footer><button @click="reset">Restablecer todo</button><span class="sp"></span><button class="primary" @click="store.modal = null">Cerrar</button></template>
  </AppWindow>
</template>

<style scoped>
.preferences { display:flex; flex-direction:column; height:100%; min-height:0; color:var(--text); }
.prefs-search { display:flex; align-items:center; gap:8px; padding:8px 12px; border-bottom:1px solid var(--hair); color:var(--text-3); }
.prefs-search input { min-width:0; width:100%; }
.prefs-layout { display:flex; flex:1; min-height:0; overflow:hidden; }
.prefs-nav { flex:0 0 174px; padding:8px; overflow:auto; border-right:1px solid var(--hair); background:var(--g-850); }
.prefs-nav button { display:flex; align-items:center; justify-content:flex-start; gap:8px; width:100%; text-align:left; white-space:normal; height:auto; min-height:30px; padding:5px 8px; background:transparent; border-color:transparent; }
.prefs-nav button > span, .section-head > span { min-width:0; overflow-wrap:anywhere; }
.prefs-nav button.on { background:var(--blue-wash); color:var(--blue-hi); }
.prefs-content { flex:1; min-width:0; overflow:auto; padding:10px 12px; }
.prefs-section { margin:0 0 10px; min-width:0; }
.section-head { width:100%; display:flex; align-items:center; justify-content:flex-start; gap:7px; text-align:left; background:var(--g-800); border:0; font-weight:600; padding:4px 8px; min-height:28px; }
.section-rows { padding:3px 0; }
.row { display:grid; grid-template-columns:minmax(96px,1fr) minmax(100px,1.35fr) 24px; align-items:center; gap:6px; min-height:29px; padding:3px 0 3px 8px; font-size:12px; }
.row > label { min-width:0; overflow-wrap:anywhere; color:var(--text-2); }
.row.modified > label { color:var(--blue-hi); }
.control, .numeric-control { min-width:0; display:flex; align-items:center; gap:5px; }
.control > select,.control > .number { width:100%; min-width:0; }
.numeric-control input[type=range] { flex:1; min-width:20px; width:0; }
.numeric-control :deep(.nf) { flex:0 1 60px; min-width:42px; }
.unit { color:var(--text-3); font-size:10px; flex-shrink:0; }
.reset-one { padding:0; display:grid; place-items:center; background:transparent; border-color:transparent; width:24px; }
.reset-one:disabled { opacity:0; }
.seg { display:flex; min-width:0; border:1px solid var(--hair); border-radius:var(--r); overflow:hidden; }
.seg button { border:0; border-radius:0; padding:0 8px; background:transparent; }
.seg button.on { background:var(--blue-wash); color:var(--blue-hi); }
.config-path { overflow-wrap:anywhere; user-select:text; color:var(--text-3); margin:8px 0; }
.config-actions { display:flex; gap:6px; flex-wrap:wrap; }
.config-issue { color:var(--warn); }
.empty { color:var(--text-3); }
.sp { flex:1; }
@container win (max-width:560px) { .prefs-layout { flex-direction:column; } .prefs-nav { flex:0 0 auto; display:flex; flex-wrap:wrap; gap:2px; border-right:0; border-bottom:1px solid var(--hair); } .prefs-nav button { width:auto; min-height:26px; font-size:11px; } }
@container win (max-width:390px) { .prefs-content { padding:6px; } .row { grid-template-columns:minmax(0,1fr) 24px; } .row .control { grid-row:2; grid-column:1 / -1; } .row .reset-one { grid-column:2; grid-row:1; } }
</style>
