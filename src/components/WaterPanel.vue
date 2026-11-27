<script setup>
import { computed } from 'vue'
import { store, updateObject, commit, importFiles } from '../core/store.js'
import { normalizeWaterNode, WATER_NODE_DEFAULTS, WATER_SHAPES } from '../engine/runtime/geometry/watershape.js'
import { pickFile } from '../engine/runtime/util.js'
import NumberField from './NumberField.vue'
import Vec3Field from './Vec3Field.vue'
import PropertyKey from './PropertyKey.vue'

const props = defineProps({ obj: { type: Object, required: true }, keyable: { type: Function, required: true }, marked: { type: Function, required: true } })
const emit = defineEmits(['insert-key'])
const w = computed(() => normalizeWaterNode(props.obj.props))
const physicalRegions = computed(() => store.project.environment?.waterSimulation?.enabled
  ? (store.project.environment.waterSimulation.regions || []) : [])
const set = (patch, label = 'Agua') => updateObject(props.obj.id, { props: patch }, { label })
const live = (patch) => updateObject(props.obj.id, { props: patch }, { commit: false })
const done = () => commit('Agua')
const textures = computed(() => store.project.assets.filter((a) => a.kind === 'texture'))
const shaders = computed(() => store.project.assets.filter((a) => /\.(gdshader|shader)$/i.test(a.name)))

async function importTex() {
  const files = await pickFile('image/*')
  if (!files.length) return
  await importFiles(files, 'Assets/Textures')
  const made = importFiles.last?.find((m) => m.kind === 'texture')
  if (made) set({ texture: made.id })
}
async function importShader() {
  const files = await pickFile('.gdshader,.shader')
  if (!files.length) return
  await importFiles(files, 'Assets/Shaders')
  const made = importFiles.last?.[0]
  if (made) set({ shaderAsset: made.id })
}
const LOOK = ['color', 'deepColor', 'opacity', 'roughness', 'waveHeight', 'waveLength', 'waveSpeed', 'wind', 'windDir', 'ripples', 'rippleScale', 'foam', 'clarity', 'shoreFoam', 'shoreWidth', 'faceted', 'texture', 'textureMode', 'textureScale', 'textureSpeed', 'textureStrength', 'shaderAsset']
const reset = () => set(Object.fromEntries(LOOK.map((k) => [k, WATER_NODE_DEFAULTS[k]])), 'Restablecer agua')

// ---- río: puntos ----
const sel = computed(() => store.roadPoint)
const pickPoint = (i) => { store.roadPoint = i; store.editor?._syncRoadHandles() }
function setPoint(i, v, commitIt) {
  const pts = w.value.points.map((q) => [...q])
  pts[i] = v
  if (commitIt) set({ points: pts }, 'Mover punto del río'); else live({ points: pts })
}
function insertAfter() {
  const pts = w.value.points.map((q) => [...q])
  const i = Math.min(sel.value ?? pts.length - 2, pts.length - 2)
  const a = pts[Math.max(0, i)], b = pts[Math.max(0, i) + 1] || a
  pts.splice(Math.max(0, i) + 1, 0, a.map((v, k) => +((v + b[k]) / 2).toFixed(3)))
  store.roadPoint = Math.max(0, i) + 1
  set({ points: pts }, 'Insertar punto')
}
function removePoint() {
  const pts = w.value.points.map((q) => [...q])
  if (pts.length <= 2) return
  const i = sel.value ?? pts.length - 1
  pts.splice(i, 1)
  store.roadPoint = Math.min(i, pts.length - 1)
  set({ points: pts }, 'Quitar punto')
}
const reverse = () => set({ points: w.value.points.map((q) => [...q]).reverse() }, 'Invertir sentido')
const draw = () => { store.tool = store.tool === 'road' ? 'select' : 'road' }
</script>

<template>
  <section class="sect">
    <header>Agua</header>
    <div class="body">
      <div class="row"><span>Forma</span><select :value="w.shape" @change="set({ shape: $event.target.value })"><option v-for="(l, k) in WATER_SHAPES" :key="k" :value="k">{{ l }}</option></select></div>
      <div v-if="w.shape === 'ocean'" class="row"><span>Tamaño (m)</span><NumberField :model-value="w.size" :step="500" :min="10" :max="50000" @update:model-value="live({ size: $event })" @commit="done" /></div>
      <div v-if="w.shape === 'rect'" class="row"><span>Ancho / largo (m)</span><div class="two"><NumberField :model-value="w.width" :step="1" :min="0.5" @update:model-value="live({ width: $event })" @commit="done" /><NumberField :model-value="w.length" :step="1" :min="0.5" @update:model-value="live({ length: $event })" @commit="done" /></div></div>
      <div v-if="w.shape === 'circle'" class="row"><span>Radio (m)</span><NumberField :model-value="w.radius" :step="1" :min="0.5" @update:model-value="live({ radius: $event })" @commit="done" /></div>
      <template v-if="w.shape === 'river'">
        <div class="row"><span>Ancho (m)</span><NumberField :model-value="w.riverWidth" :step="0.5" :min="0.5" @update:model-value="live({ riverWidth: $event })" @commit="done" /></div>
        <div class="row"><span>Curva suave</span><input type="checkbox" :checked="w.smooth" @change="set({ smooth: $event.target.checked })" /></div>
        <div class="row"><span>Cerrado (anillo)</span><input type="checkbox" :checked="w.closed" @change="set({ closed: $event.target.checked })" /></div>
      </template>
      <div v-if="w.shape !== 'ocean'" class="row"><span>Resolución (m)</span><NumberField :model-value="w.res" :step="0.25" :min="0.25" :max="20" @update:model-value="live({ res: $event })" @commit="done" /></div>
      <p class="hint lf-help">La altura del agua es la posición Y del objeto; no depende del terreno.</p>
      <div v-if="physicalRegions.length" class="row"><span>Dominio físico</span>
        <select :value="w.physicalRegionId || ''" @change="set({ physicalRegionId: $event.target.value })">
          <option value="">Heredado (sin acoplamiento)</option>
          <option v-for="r in physicalRegions" :key="r.id" :value="r.id">{{ r.name || r.id }}</option>
        </select>
      </div>
      <p v-if="w.physicalRegionId" class="hint lf-help">La región física seleccionada sustituye a esta malla cuando hay cobertura válida. No modifica automáticamente los proyectos antiguos. Requiere que las regiones coincidan espacialmente.</p>
    </div>
  </section>

  <section v-if="w.shape === 'river'" class="sect">
    <header>Puntos del río <span class="dim">{{ w.points.length }}</span></header>
    <div class="body">
      <div class="two">
        <button :class="{ primary: store.tool === 'road' }" data-tooltip="Clic en el terreno añade puntos; Enter o Esc terminan" @click="draw">{{ store.tool === 'road' ? 'Terminar (Enter)' : '✎ Dibujar puntos' }}</button>
        <button data-tooltip="Cambia el sentido" @click="reverse">⇄ Invertir</button>
      </div>
      <div class="pts">
        <div v-for="(pt, i) in w.points" :key="i" class="pt" :class="{ on: sel === i }" @mousedown="pickPoint(i)">
          <b>{{ i + 1 }}</b>
          <Vec3Field :model-value="pt" :step="0.5" :decimals="2" @change="setPoint(i, $event.value, $event.commit)" />
        </div>
      </div>
      <div class="two"><button @click="insertAfter">＋ Insertar punto</button><button :disabled="w.points.length <= 2" @click="removePoint">− Quitar</button></div>
      <p class="hint lf-help">Arrastra las esferas del visor. La Y de cada punto da el desnivel del río (coordenadas locales).</p>
    </div>
  </section>

  <section class="sect">
    <header>Aspecto</header>
    <div class="body">
      <div class="row"><span>Color superficial</span><ColorInput :value="w.color" @input="live({ color: $event.target.value })" @change="done" /><PropertyKey v-if="keyable('water.color')" label="Color superficial" :available="true" :marked="marked('water.color')" @insert="emit('insert-key','water.color')" /></div>
      <div class="row"><span>Color profundo</span><ColorInput :value="w.deepColor" @input="live({ deepColor: $event.target.value })" @change="done" /><PropertyKey v-if="keyable('water.deepColor')" label="Color profundo" :available="true" :marked="marked('water.deepColor')" @insert="emit('insert-key','water.deepColor')" /></div>
      <div class="row"><span>Opacidad</span><input type="range" min="0.1" max="1" step="0.02" :value="w.opacity" @input="live({ opacity: +$event.target.value })" @change="done" /><PropertyKey v-if="keyable('water.opacity')" label="Opacidad" :available="true" :marked="marked('water.opacity')" @insert="emit('insert-key','water.opacity')" /></div>
      <div class="row"><span>Brillo (rugosidad)</span><input type="range" min="0" max="0.6" step="0.01" :value="w.roughness" @input="live({ roughness: +$event.target.value })" @change="done" /><PropertyKey v-if="keyable('water.roughness')" label="Brillo (rugosidad)" :available="true" :marked="marked('water.roughness')" @insert="emit('insert-key','water.roughness')" /></div>
      <div class="row"><span>Espuma</span><input type="range" min="0" max="1" step="0.02" :value="w.foam" @input="live({ foam: +$event.target.value })" @change="done" /><PropertyKey v-if="keyable('water.foam')" label="Espuma" :available="true" :marked="marked('water.foam')" @insert="emit('insert-key','water.foam')" /></div>
      <div class="row"><span>Claridad (m)</span><input type="range" min="0.5" max="24" step="0.5" :value="w.clarity" @input="live({ clarity: +$event.target.value })" @change="done" data-tooltip="Profundidad a la que el agua ya es del color profundo" /><PropertyKey v-if="keyable('water.clarity')" label="Claridad (m)" :available="true" :marked="marked('water.clarity')" @insert="emit('insert-key','water.clarity')" /></div>
      <div class="row"><span>Espuma de orilla</span><input type="range" min="0" max="1" step="0.02" :value="w.shoreFoam" @input="live({ shoreFoam: +$event.target.value })" @change="done" /><PropertyKey v-if="keyable('water.shoreFoam')" label="Espuma de orilla" :available="true" :marked="marked('water.shoreFoam')" @insert="emit('insert-key','water.shoreFoam')" /></div>
      <div class="row"><span>Ancho de la espuma (m)</span><input type="range" min="0.1" max="4" step="0.1" :value="w.shoreWidth" @input="live({ shoreWidth: +$event.target.value })" @change="done" /><PropertyKey v-if="keyable('water.shoreWidth')" label="Ancho de la espuma (m)" :available="true" :marked="marked('water.shoreWidth')" @insert="emit('insert-key','water.shoreWidth')" /></div>
      <div class="row"><span>Facetado (PS1)</span><input type="checkbox" :checked="w.faceted" @change="set({ faceted: $event.target.checked })" /><PropertyKey v-if="keyable('water.faceted')" label="Facetado (PS1)" :available="true" :marked="marked('water.faceted')" @insert="emit('insert-key','water.faceted')" /></div>
    </div>
  </section>

  <section class="sect">
    <header>Olas y viento</header>
    <div class="body">
      <div class="row"><span>Altura olas (m)</span><NumberField :model-value="w.waveHeight" :step="0.05" :min="0" :max="10" @update:model-value="live({ waveHeight: $event })" @commit="done" /><PropertyKey v-if="keyable('water.waveHeight')" label="Altura olas (m)" :available="true" :marked="marked('water.waveHeight')" @insert="emit('insert-key','water.waveHeight')" /></div>
      <div class="row"><span>Longitud (m)</span><NumberField :model-value="w.waveLength" :step="1" :min="1" :max="200" @update:model-value="live({ waveLength: $event })" @commit="done" /><PropertyKey v-if="keyable('water.waveLength')" label="Longitud (m)" :available="true" :marked="marked('water.waveLength')" @insert="emit('insert-key','water.waveLength')" /></div>
      <div class="row"><span>Velocidad</span><input type="range" min="0" max="3" step="0.05" :value="w.waveSpeed" @input="live({ waveSpeed: +$event.target.value })" @change="done" /><PropertyKey v-if="keyable('water.waveSpeed')" label="Velocidad" :available="true" :marked="marked('water.waveSpeed')" @insert="emit('insert-key','water.waveSpeed')" /></div>
      <div class="row"><span>Viento</span><input type="range" min="0" max="1" step="0.02" :value="w.wind" @input="live({ wind: +$event.target.value })" @change="done" /><PropertyKey v-if="keyable('water.wind')" label="Viento" :available="true" :marked="marked('water.wind')" @insert="emit('insert-key','water.wind')" /></div>
      <div class="row"><span>Dirección °</span><NumberField :model-value="w.windDir" :step="5" :decimals="0" @update:model-value="live({ windDir: $event })" @commit="done" /><PropertyKey v-if="keyable('water.windDir')" label="Dirección °" :available="true" :marked="marked('water.windDir')" @insert="emit('insert-key','water.windDir')" /></div>
      <div class="row"><span>Ondulación fina</span><input type="range" min="0" max="1" step="0.02" :value="w.ripples" @input="live({ ripples: +$event.target.value })" @change="done" /><PropertyKey v-if="keyable('water.ripples')" label="Ondulación fina" :available="true" :marked="marked('water.ripples')" @insert="emit('insert-key','water.ripples')" /></div>
      <div class="row"><span>Tamaño ondul. (m)</span><NumberField :model-value="w.rippleScale" :step="0.25" :min="0.2" :max="30" @update:model-value="live({ rippleScale: $event })" @commit="done" /><PropertyKey v-if="keyable('water.rippleScale')" label="Tamaño ondul. (m)" :available="true" :marked="marked('water.rippleScale')" @insert="emit('insert-key','water.rippleScale')" /></div>
    </div>
  </section>

  <section class="sect">
    <header>Corriente (jugador)</header>
    <div class="body">
      <div class="row"><span>Velocidad (m/s)</span><NumberField :model-value="w.flowSpeed" :step="0.1" :min="0" :max="20" @update:model-value="live({ flowSpeed: $event })" @commit="done" /></div>
      <div v-if="w.shape !== 'river' && w.flowSpeed > 0" class="row"><span>Dirección °</span><NumberField :model-value="w.flowDir" :step="5" :decimals="0" @update:model-value="live({ flowDir: $event })" @commit="done" /></div>
      <p class="hint lf-help">Empuja al jugador que vadea o nada (Base de datos ▸ Jugador ▸ Agua ▸ Fuerza de la corriente). En un río va en el sentido de los puntos; en el resto, hacia la dirección indicada (0° = +X).</p>
    </div>
  </section>

  <section class="sect">
    <header>Textura y shader</header>
    <div class="body">
      <div class="row"><span>Textura</span>
        <div class="two"><select :value="w.texture || ''" @change="set({ texture: $event.target.value || null })"><option value="">ninguna</option><option v-for="t in textures" :key="t.id" :value="t.id">{{ t.name }}</option></select><button data-tooltip="Importar una imagen" @click="importTex">＋</button></div>
      <PropertyKey v-if="keyable('water.texture')" label="Textura" :available="true" :marked="marked('water.texture')" @insert="emit('insert-key','water.texture')" /></div>
      <template v-if="w.texture">
        <div class="row"><span>Uso</span><select :value="w.textureMode" @change="set({ textureMode: $event.target.value })"><option value="color">Color (superficie)</option><option value="normal">Mapa de normales</option></select><PropertyKey v-if="keyable('water.textureMode')" label="Uso" :available="true" :marked="marked('water.textureMode')" @insert="emit('insert-key','water.textureMode')" /></div>
        <div class="row"><span>Repetición (m)</span><NumberField :model-value="w.textureScale" :step="1" :min="0.5" @update:model-value="live({ textureScale: $event })" @commit="done" /><PropertyKey v-if="keyable('water.textureScale')" label="Repetición (m)" :available="true" :marked="marked('water.textureScale')" @insert="emit('insert-key','water.textureScale')" /></div>
        <div class="row"><span>Desplazamiento</span><input type="range" min="0" max="2" step="0.05" :value="w.textureSpeed" @input="live({ textureSpeed: +$event.target.value })" @change="done" /><PropertyKey v-if="keyable('water.textureSpeed')" label="Desplazamiento" :available="true" :marked="marked('water.textureSpeed')" @insert="emit('insert-key','water.textureSpeed')" /></div>
        <div class="row"><span>Intensidad</span><input type="range" min="0" max="1" step="0.02" :value="w.textureStrength" @input="live({ textureStrength: +$event.target.value })" @change="done" /><PropertyKey v-if="keyable('water.textureStrength')" label="Intensidad" :available="true" :marked="marked('water.textureStrength')" @insert="emit('insert-key','water.textureStrength')" /></div>
      </template>
      <!-- OBSOLETO y oculto: el .gdshader propio solo se usaba al exportar a Godot -->
      <template v-if="false">
      <div class="row"><span>.gdshader propio</span>
        <div class="two"><select :value="w.shaderAsset || ''" @change="set({ shaderAsset: $event.target.value || null })"><option value="">el de LevelForge</option><option v-for="t in shaders" :key="t.id" :value="t.id">{{ t.name }}</option></select><button data-tooltip="Importar un .gdshader" @click="importShader">＋</button></div>
      </div>
      <p class="hint lf-help">Un shader propio se usa solo en Godot; el editor sigue mostrando el agua base.</p>
      </template>
      <button class="wide" @click="reset">Restablecer aspecto</button>
    </div>
  </section>
</template>

<style scoped>
.row { display: grid; grid-template-columns: 112px minmax(0, 1fr); align-items: center; gap: 8px; margin-bottom: 6px; }
.row:has(> .property-key) { grid-template-columns: 112px minmax(0, 1fr) 22px; gap: 5px; }
.row > .property-key { justify-self: end; }
.row > span { color: var(--text-3); font-size: 12px; }
.row select { width: 100%; }
.two { display: flex; gap: 6px; min-width: 0; margin-bottom: 6px; }
.row .two { margin-bottom: 0; }
.two > * { flex: 1; min-width: 0; }
.row .two > button { flex: 0 0 26px; }
.pts { max-height: 190px; overflow: auto; margin-bottom: 6px; border: 1px solid var(--hair); border-radius: 6px; background: var(--g-950); }
.pt { display: flex; align-items: center; gap: 6px; padding: 3px 5px; border-bottom: 1px solid var(--hair-soft); cursor: pointer; }
.pt b { width: 16px; text-align: center; font-size: 11px; color: var(--text-3); font-weight: 500; }
.pt.on { background: var(--amber-wash, rgba(255,181,71,.12)); }
.pt.on b { color: var(--amber, #ffb547); }
.hint { margin: 4px 0 0; font-size: 11px; color: var(--text-3); }
.wide { width: 100%; margin-top: 8px; }
</style>
