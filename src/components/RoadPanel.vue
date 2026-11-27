<script setup>
import { computed } from 'vue'
import { store, updateObject, commit, importFiles, createMaterial, openMaterialEditor } from '../core/store.js'
import { normalizeRoad, ROAD_DEFAULTS, ROAD_SLOTS, roadTintEnabled, MARK_STYLES, LANE_STYLES, MARK_MODES } from '../engine/runtime/geometry/road.js'
import { pickFile } from '../engine/runtime/util.js'
import { roadSlotMaterial } from '../engine/runtime/render/road-material.js'
import { normalizeRoadPaint, ROAD_PAINT_MAX_STROKES } from '../engine/runtime/render/road-paint.js'
import MaterialShader from './MaterialShader.vue'
import MaterialSurfaceDetail from './MaterialSurfaceDetail.vue'
import NumberField from './NumberField.vue'
import Vec3Field from './Vec3Field.vue'
import PropertyKey from './PropertyKey.vue'

const props = defineProps({ obj: { type: Object, required: true }, keyable: { type: Function, required: true }, marked: { type: Function, required: true } })
const emit = defineEmits(['insert-key'])
const roadKey = (slot, field) => `road.${slot}${field[0].toUpperCase()}${field.slice(1)}`
const p = computed(() => normalizeRoad(props.obj.props))
const textures = computed(() => store.project.assets.filter((a) => a.kind === 'texture'))
const materials = computed(() => store.project?.materials || [])
const paint = computed(() => normalizeRoadPaint(p.value.paint))
const brush = computed(() => store.roadPaint)
const paintLayers = computed(() => paint.value[brush.value.slot] || [])
const compatibleMaterials = computed(() => materials.value.filter((m) => !m.mat?.shader || ['builtin:blockout', 'builtin:realista'].includes(m.mat.shader)))
const painting = computed(() => brush.value.active && props.obj.id === store.selectedId)
function paintMode(on) {
  if (on && !paintLayers.value.find((l) => l.id === brush.value.layerId)) {
    store.roadPaint.active = false
    return
  }
  store.roadPaint.active = !!on
  if (on) store.tool = 'select'
}
function paintSlot(slot) { store.roadPaint.slot = slot; store.roadPaint.layerId = paint.value[slot][0]?.id || null; store.roadPaint.active = false }
function addPaintLayer() {
  const layers = paint.value[brush.value.slot]
  const material = compatibleMaterials.value[0]
  if (layers.length >= 3 || !material) return
  const id = `roadpaint-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  layers.push({ id, materialId: material.id, visible: true, tile: 4, strokes: [] })
  set({ paint: paint.value }, 'Añadir capa de pintura')
  store.roadPaint.layerId = id
}
function editPaintLayer(id, patch) {
  const layer = paint.value[brush.value.slot].find((l) => l.id === id)
  if (!layer) return
  Object.assign(layer, patch)
  set({ paint: paint.value }, 'Configurar capa de pintura')
}
function deletePaintLayer(id) {
  const layers = paint.value[brush.value.slot]
  const i = layers.findIndex((l) => l.id === id)
  if (i < 0) return
  layers.splice(i, 1)
  store.roadPaint.active = false
  store.roadPaint.layerId = layers[0]?.id || null
  set({ paint: paint.value }, 'Eliminar capa de pintura')
}

const slotEffective = (k) => roadSlotMaterial(p.value.slots[k], k, materials.value)
const shared = (k) => materials.value.find((m) => m.id === p.value.slots[k].materialId) || null
function selectMaterial(k, id) { setSlot(k, { materialId: id || '' }) }
function makeLocal(k) {
  const resource = shared(k)
  if (!resource) return
  setSlot(k, { materialId: '', color: resource.color, roughness: resource.roughness,
    metallic: resource.metallic, opacity: resource.opacity,
    mat: JSON.parse(JSON.stringify(resource.mat)), texture: null })
}
function makeResource(k) {
  const effective = slotEffective(k)
  // Los PNG anteriores también quedan integrados en el nuevo recurso, no desaparecen.
  if (p.value.slots[k].texture && !effective.mat?.params?.uAlbedo) {
    effective.mat = { ...effective.mat, shader: effective.mat?.shader || 'builtin:realista',
      mapping: effective.mat?.mapping || 'object',
      params: { ...(effective.mat?.params || {}), uAlbedo: p.value.slots[k].texture, uTile: p.value.slots[k].tile } }
  }
  const m = createMaterial(effective, 'Assets/Materials', `Carretera-${k}.material`)
  selectMaterial(k, m.id)
}
function editSlotMaterial(k, patch) {
  if (shared(k)) return // Un recurso compartido se edita desde su Inspector propio.
  setSlot(k, { ...patch, ...(patch.mat ? { mat: { ...(p.value.slots[k].mat || {}), ...patch.mat } } : {}) })
}

const set = (patch, label = 'Carretera') => updateObject(props.obj.id, { props: patch }, { label })
const live = (patch) => updateObject(props.obj.id, { props: patch }, { commit: false })
const done = () => commit('Carretera')
const slotPatch = (k, patch) => { const s = JSON.parse(JSON.stringify(p.value.slots)); Object.assign(s[k], patch); return { slots: s } }
const setSlot = (k, patch) => set(slotPatch(k, patch))
const chooseTexture = (k, id) => {
  const slot = p.value.slots[k]
  setSlot(k, { texture: id || null, tintEnabled: id ? (slot.texture ? roadTintEnabled(slot, k) : slot.tintEnabled ?? slot.color.toLowerCase() !== ROAD_DEFAULTS.slots[k].color) : slot.tintEnabled })
}
const hasTexture = (k) => textures.value.some((a) => a.id === p.value.slots[k].texture)
const liveSlot = (k, patch) => live(slotPatch(k, patch))

async function importTex(k) {
  const files = await pickFile('image/*')
  if (!files.length) return
  await importFiles(files, 'Assets/Textures')
  const made = importFiles.last?.find((m) => m.kind === 'texture')
  if (made) chooseTexture(k, made.id)
}

// ---- puntos ----
const sel = computed(() => store.roadPoint)
const pickPoint = (i) => { store.roadPoint = i; store.editor?._syncRoadHandles() }
function setPoint(i, v, commitIt) {
  const pts = p.value.points.map((q) => [...q])
  pts[i] = v
  if (commitIt) set({ points: pts }, 'Mover punto de carretera'); else live({ points: pts })
}
const widthOf = (i) => +(p.value.width * (p.value.pw[i] ?? 1)).toFixed(2)
function setPointWidth(i, w, commitIt) {
  const pw = [...p.value.pw]
  pw[i] = Math.max(0.1, w / p.value.width)
  if (commitIt) set({ pw }, 'Ancho en punto'); else live({ pw })
}
function insertAfter() {
  const pts = p.value.points.map((q) => [...q])
  const pw = [...p.value.pw]
  const i = Math.min(sel.value ?? pts.length - 2, pts.length - 2)
  const a = pts[Math.max(0, i)], b = pts[Math.max(0, i) + 1] || a
  pts.splice(Math.max(0, i) + 1, 0, a.map((v, k) => +((v + b[k]) / 2).toFixed(3)))
  pw.splice(Math.max(0, i) + 1, 0, ((pw[Math.max(0, i)] ?? 1) + (pw[Math.max(0, i) + 1] ?? 1)) / 2)
  store.roadPoint = Math.max(0, i) + 1
  set({ points: pts, pw }, 'Insertar punto')
}
function removePoint() {
  const pts = p.value.points.map((q) => [...q])
  if (pts.length <= 2) return
  const i = sel.value ?? pts.length - 1
  const pw = [...p.value.pw]
  pts.splice(i, 1); pw.splice(i, 1)
  store.roadPoint = Math.min(i, pts.length - 1)
  set({ points: pts, pw }, 'Quitar punto')
}
const reverse = () => set({ points: p.value.points.map((q) => [...q]).reverse(), pw: [...p.value.pw].reverse() }, 'Invertir sentido')
function draw() { store.tool = store.tool === 'road' ? 'select' : 'road' }
const reset = () => { const keep = p.value.points, pw = p.value.pw.map(() => 1); set({ ...normalizeRoad({}), points: keep, pw }, 'Restablecer carretera') }
const slotList = computed(() => ROAD_SLOTS.filter(([k]) => k !== 'side' || p.value.sidewalks))
const lengthTxt = computed(() => { const u = store.editor?.nodes.get(props.obj.id)?.userData.stats; return u ? `${u.length.toFixed(1)} m` : '' })
</script>

<template>
  <section class="sect">
    <header>Carretera <span class="dim">{{ lengthTxt }}</span></header>
    <div class="body">
      <div class="two">
        <button :class="{ primary: store.tool === 'road' }" data-tooltip="Clic en el terreno añade puntos; Enter o Esc terminan" @click="draw">{{ store.tool === 'road' ? 'Terminar (Enter)' : '✎ Dibujar puntos' }}</button>
        <button data-tooltip="Cambia el sentido (inicio ↔ final)" @click="reverse">⇄ Invertir</button>
      </div>
      <div class="row"><span>Curva suave</span><input type="checkbox" :checked="p.smooth" @change="set({ smooth: $event.target.checked })" /></div>
      <div class="row"><span>Circuito cerrado</span><input type="checkbox" :checked="p.closed" @change="set({ closed: $event.target.checked })" /></div>
      <div class="row"><span>Seguir el terreno</span><input type="checkbox" :checked="p.conform" @change="set({ conform: $event.target.checked })" /></div>
      <template v-if="p.conform">
        <div class="row"><span>Adaptar a la ladera</span><input type="checkbox" data-tooltip="Cada punto del ancho toma la altura del terreno (si no, la calzada queda plana de lado a lado)" :checked="p.crossSlope" @change="set({ crossSlope: $event.target.checked })" /></div>
        <div class="row"><span>Suavizado (m)</span><NumberField :model-value="p.smoothing" :step="0.5" :min="0" :max="30" @update:model-value="live({ smoothing: $event })" @commit="done" /></div>
      </template>
      <div class="row"><span>Altura s/ terreno</span><NumberField :model-value="p.lift" :step="0.01" :min="0" @update:model-value="live({ lift: $event })" @commit="done" /></div>
      <div class="row"><span>Resolución (m)</span><NumberField :model-value="p.step" :step="0.25" :min="0.25" :max="10" @update:model-value="live({ step: $event })" @commit="done" /></div>
    </div>
  </section>

  <section class="sect">
    <header>Puntos <span class="dim">{{ p.points.length }}</span></header>
    <div class="body">
      <div class="pts">
        <div v-for="(pt, i) in p.points" :key="i" class="pt" :class="{ on: sel === i }" @mousedown="pickPoint(i)">
          <b>{{ i + 1 }}</b>
          <Vec3Field :model-value="pt" :step="0.5" :decimals="2" @change="setPoint(i, $event.value, $event.commit)" />
        </div>
      </div>
      <div v-if="sel != null && sel < p.points.length" class="row"><span>Ancho en punto {{ sel + 1 }}</span><NumberField :model-value="widthOf(sel)" :step="0.25" :min="0.5" :max="200" @update:model-value="setPointWidth(sel, $event, false)" @commit="done" /></div>
      <div class="two"><button @click="insertAfter">＋ Insertar punto</button><button :disabled="p.points.length <= 2" @click="removePoint">− Quitar</button></div>
      <p class="hint lf-help">Arrastra las esferas del visor para moverlos. Con un punto elegido, Supr lo quita. Los puntos están en coordenadas locales de la carretera.</p>
    </div>
  </section>

  <section class="sect">
    <header>Calzada</header>
    <div class="body">
      <div class="row"><span>Ancho (m)</span><div class="two"><input type="range" min="1" max="40" step="0.25" :value="p.width" @input="live({ width: +$event.target.value })" @change="done" /><NumberField :model-value="p.width" :step="0.25" :min="0.5" :max="200" @update:model-value="live({ width: $event })" @commit="done" /></div></div>
      <div class="row"><span>Carriles</span><NumberField :model-value="p.lanes" :step="1" :min="1" :max="12" :decimals="0" @update:model-value="live({ lanes: Math.round($event) })" @commit="done" /></div>
      <div class="row"><span>Grosor borde (m)</span><NumberField :model-value="p.thickness" :step="0.05" :min="0.05" @update:model-value="live({ thickness: $event })" @commit="done" /></div>
      <div class="row"><span>Aceras</span><input type="checkbox" :checked="p.sidewalks" @change="set({ sidewalks: $event.target.checked })" /></div>
      <template v-if="p.sidewalks">
        <div class="row"><span>Acera / berma (m)</span><NumberField :model-value="p.sideWidth" :step="0.1" :min="0" @update:model-value="live({ sideWidth: $event })" @commit="done" /></div>
        <div class="row"><span>Altura bordillo</span><NumberField :model-value="p.curbHeight" :step="0.01" :min="0" @update:model-value="live({ curbHeight: $event })" @commit="done" /></div>
        <div class="row"><span>Lados con acera</span><div class="two"><label class="chk"><input type="checkbox" :checked="p.sideLeft" @change="set({ sideLeft: $event.target.checked })" /> izq.</label><label class="chk"><input type="checkbox" :checked="p.sideRight" @change="set({ sideRight: $event.target.checked })" /> der.</label></div></div>
      </template>
    </div>
  </section>

  <section class="sect">
    <header>Líneas</header>
    <div class="body">
      <div class="row"><span>Tipo de marca</span><select :value="p.markMode" @change="set({ markMode: $event.target.value })"><option v-for="(l, k) in MARK_MODES" :key="k" :value="k">{{ l }}</option></select></div>
      <div class="row"><span>Línea central</span><select :value="p.centerStyle" @change="set({ centerStyle: $event.target.value })"><option v-for="(l, k) in MARK_STYLES" :key="k" :value="k">{{ l }}</option></select></div>
      <div class="row"><span>Entre carriles</span><select :value="p.laneStyle" @change="set({ laneStyle: $event.target.value })"><option v-for="(l, k) in LANE_STYLES" :key="k" :value="k">{{ l }}</option></select></div>
      <div class="row"><span>Líneas de borde</span><input type="checkbox" :checked="p.edgeLines" @change="set({ edgeLines: $event.target.checked })" /></div>
      <div v-if="p.edgeLines" class="row"><span>Margen del borde</span><NumberField :model-value="p.edgeInset" :step="0.05" :min="0" @update:model-value="live({ edgeInset: $event })" @commit="done" /></div>
      <div class="row"><span>Grosor línea (m)</span><NumberField :model-value="p.markWidth" :step="0.01" :min="0.02" @update:model-value="live({ markWidth: $event })" @commit="done" /></div>
      <div v-if="p.centerStyle === 'double' || p.centerStyle === 'solidDashed'" class="row"><span>Separación doble</span><NumberField :model-value="p.markGap" :step="0.01" :min="0" @update:model-value="live({ markGap: $event })" @commit="done" /></div>
      <div class="row"><span>Trazo / hueco (m)</span><div class="two"><NumberField :model-value="p.dashLen" :step="0.25" :min="0.2" @update:model-value="live({ dashLen: $event })" @commit="done" /><NumberField :model-value="p.dashGap" :step="0.25" :min="0.2" @update:model-value="live({ dashGap: $event })" @commit="done" /></div></div>
      <div v-if="p.markMode === 'raised'" class="row"><span>Relieve (m)</span><NumberField :model-value="p.markHeight" :step="0.01" :min="0.01" @update:model-value="live({ markHeight: $event })" @commit="done" /></div>
    </div>
  </section>

  <section v-for="[k, label] in slotList" :key="k" class="sect">
    <header>Material · {{ label }}</header>
    <div class="body">
      <div class="row"><span>Recurso</span><select :value="p.slots[k].materialId || ''" @change="selectMaterial(k, $event.target.value)">
        <option value="">Local (sin recurso)</option>
        <option v-for="m in materials" :key="m.id" :value="m.id">{{ m.name }}</option>
      </select></div>
      <p v-if="p.slots[k].materialId && !shared(k)" class="road-error" role="alert">El recurso .material asignado no existe. Se usa el material local.</p>
      <div class="two">
        <button type="button" @click="makeResource(k)">Crear .material</button>
        <button v-if="shared(k)" type="button" @click="makeLocal(k)">Hacer local</button>
        <button v-if="shared(k)" type="button" @click="openMaterialEditor(shared(k).id)">Editar recurso…</button>
      </div>
      <p v-if="shared(k)" class="hint">Este recurso se comparte con otras superficies. Edítalo desde Assets o hazlo local.</p>
      <template v-if="!shared(k)">
      <div v-if="p.slots[k].texture" class="row"><span>Aplicar tinte</span><input type="checkbox" :checked="roadTintEnabled(p.slots[k], k)" @change="setSlot(k, { tintEnabled: $event.target.checked })" /></div>
      <div class="row"><span>{{ p.slots[k].texture ? 'Color del tinte' : 'Color base' }}</span><ColorInput :value="p.slots[k].color" :disabled="!!p.slots[k].texture && !roadTintEnabled(p.slots[k], k)" @input="liveSlot(k, { color: $event.target.value })" @change="done" /><PropertyKey v-if="keyable(roadKey(k,'color'))" label="Color base" :available="true" :marked="marked(roadKey(k,'color'))" @insert="emit('insert-key', roadKey(k,'color'))" /></div>
      <div class="row"><span>Rugosidad</span><input type="range" min="0" max="1" step="0.01" :value="p.slots[k].roughness" @input="liveSlot(k, { roughness: +$event.target.value })" @change="done" /><PropertyKey v-if="keyable(roadKey(k,'roughness'))" label="Rugosidad" :available="true" :marked="marked(roadKey(k,'roughness'))" @insert="emit('insert-key', roadKey(k,'roughness'))" /></div>
      <div class="row"><span>Textura</span>
        <div class="two"><select :value="p.slots[k].texture || ''" @change="chooseTexture(k, $event.target.value)"><option value="">ninguna</option><option v-for="t in textures" :key="t.id" :value="t.id">{{ t.name }}</option></select><button data-tooltip="Importar una imagen" @click="importTex(k)">＋</button></div>
      </div>
      <p v-if="p.slots[k].texture && !hasTexture(k)" class="road-error" role="alert">La textura asignada no existe en Assets. Selecciona otra imagen.</p>
      <div class="row"><span>Repetición (m)</span><NumberField :model-value="p.slots[k].tile" :step="0.5" :min="0.2" @update:model-value="liveSlot(k, { tile: $event })" @commit="done" /></div>
      <div v-if="k === 'center' || k === 'lanes'" class="row"><span>Brillo propio</span><input type="range" min="0" max="3" step="0.05" :value="p.slots[k].emissive" @input="liveSlot(k, { emissive: +$event.target.value })" @change="done" /><PropertyKey v-if="keyable(roadKey(k,'emissive'))" label="Brillo propio" :available="true" :marked="marked(roadKey(k,'emissive'))" @insert="emit('insert-key', roadKey(k,'emissive'))" /></div>
      <details class="road-shader"><summary>Detalle de superficie</summary>
        <MaterialSurfaceDetail :obj="slotEffective(k)" :edit="(patch) => editSlotMaterial(k, patch)" />
      </details>
      <details class="road-shader"><summary>Shader y propiedades avanzadas</summary>
        <MaterialShader :obj="slotEffective(k)" :edit="(patch) => editSlotMaterial(k, patch)" />
      </details>
      </template>
    </div>
  </section>

  <section class="sect" data-qa="road-paint-panel">
    <header>Capas de pintura <span class="dim">Máximo 3 por superficie</span></header>
    <div class="body">
      <p class="hint">Pinta materiales PBR sobre la carretera sin cambiar la geometría. Los trazos no dependen de la repetición de las texturas.</p>
      <div class="row"><span>Superficie</span><select :value="brush.slot" @change="paintSlot($event.target.value)">
        <option value="asphalt">Calzada</option><option v-if="p.sidewalks" value="side">Acera / berma</option>
      </select></div>
      <div v-for="layer in paintLayers" :key="layer.id" class="road-paint-layer" :class="{ selected: brush.layerId === layer.id }">
        <div class="two">
          <button type="button" :class="{ primary: brush.layerId === layer.id }" @click="store.roadPaint.layerId = layer.id">{{ layer.id === brush.layerId ? '◆ Capa activa' : 'Seleccionar capa' }}</button>
          <button type="button" :aria-label="'Eliminar capa ' + layer.id" data-tooltip="Quitar capa y sus trazos" @click="deletePaintLayer(layer.id)">×</button>
        </div>
        <div class="row"><span>Material</span><select :value="layer.materialId" @change="editPaintLayer(layer.id, { materialId: $event.target.value })">
          <option v-for="m in compatibleMaterials" :key="m.id" :value="m.id">{{ m.name }}</option>
        </select></div>
        <div class="row"><span>Visible</span><input type="checkbox" :checked="layer.visible" @change="editPaintLayer(layer.id, { visible: $event.target.checked })" /></div>
        <div class="row"><span>Repetición (m)</span><NumberField :model-value="layer.tile" :min="0.2" :max="100" :step="0.5" @update:model-value="editPaintLayer(layer.id, { tile: $event })" /></div>
        <p class="hint">{{ layer.strokes.length }} / {{ ROAD_PAINT_MAX_STROKES }} trazos</p>
      </div>
      <div class="two"><button type="button" :disabled="paintLayers.length >= 3 || !compatibleMaterials.length" @click="addPaintLayer">＋ Añadir capa</button>
        <button type="button" :class="{ primary: painting }" :disabled="!paintLayers.some((l) => l.id === brush.layerId && l.visible && !!l.materialId && l.strokes.length < ROAD_PAINT_MAX_STROKES)" @click="paintMode(!painting)">{{ painting ? '■ Terminar pintura' : '✎ Pintar' }}</button>
      </div>
      <template v-if="painting">
        <div class="row"><span>Pincel</span><select :value="brush.erase ? 'erase' : 'paint'" @change="store.roadPaint.erase = $event.target.value === 'erase'"><option value="paint">Pintar</option><option value="erase">Borrar capa</option></select></div>
        <div class="row"><span>Radio (m)</span><NumberField :model-value="brush.radius" :min="0.1" :max="8" :step="0.1" @update:model-value="store.roadPaint.radius = $event" /></div>
        <div class="row"><span>Dureza</span><input type="range" min="0" max="1" step="0.05" :value="brush.hardness" @input="store.roadPaint.hardness = +$event.target.value" /></div>
        <div class="row"><span>Opacidad</span><input type="range" min="0.01" max="1" step="0.05" :value="brush.opacity" @input="store.roadPaint.opacity = +$event.target.value" /></div>
        <p class="hint">Arrastra sobre la calzada o acera. Cada trazo se deshace con Ctrl+Z. Esc finaliza el modo pintura.</p>
      </template>
      <p v-if="!compatibleMaterials.length" class="road-error">Crea un recurso .material compatible en Assets para añadir una capa.</p>
      <p v-if="paintLayers.some((l) => !materials.some((m) => m.id === l.materialId))" class="road-error">Una capa hace referencia a un .material ausente y no se renderizará.</p>
    </div>
  </section>

  <section class="sect"><div class="body"><button style="width:100%" @click="reset">Restablecer ajustes de carretera</button></div></section>
</template>

<style scoped>
.road-paint-layer { border: 1px solid var(--hair); padding: 7px; border-radius: 5px; margin-bottom: 7px; }
.road-paint-layer.selected { border-color: var(--amber, #ffb547); }
.road-shader { border-top:1px solid var(--hair); padding-top:6px; }
.road-shader summary { cursor:pointer; font-size:12px; color:var(--text-2); }
.row { display: grid; grid-template-columns: 112px minmax(0, 1fr); align-items: center; gap: 8px; margin-bottom: 6px; }
.row:has(> .property-key) { grid-template-columns: 112px minmax(0, 1fr) 22px; gap: 5px; }
.row > .property-key { justify-self: end; }
.row > span { color: var(--text-3); font-size: 12px; }
.row select { width: 100%; }
.two { display: flex; gap: 6px; min-width: 0; margin-bottom: 6px; }
.row .two { margin-bottom: 0; }
.row .two input[type=range] { flex: 1 1 auto; min-width: 0; }
.row .two > :last-child:not(:first-child):is(.num, [class*=num]) { flex: 0 0 64px; }
.two > * { flex: 1; min-width: 0; }
.two > button:last-child:not(:only-child):has(+ *), .row .two > button { flex: 0 0 26px; }
.chk { display: inline-flex; gap: 4px; align-items: center; font-size: 12px; color: var(--text-2); }
.pts { max-height: 190px; overflow: auto; margin-bottom: 6px; border: 1px solid var(--hair); border-radius: 6px; background: var(--g-950); }
.pt { display: flex; align-items: center; gap: 6px; padding: 3px 5px; border-bottom: 1px solid var(--hair-soft); cursor: pointer; }
.pt b { width: 16px; text-align: center; font-size: 11px; color: var(--text-3); font-weight: 500; }
.pt.on { background: var(--amber-wash, rgba(255,181,71,.12)); }
.pt.on b { color: var(--amber, #ffb547); }
.hint { margin: 4px 0 0; font-size: 11px; color: var(--text-3); }
.road-error { color: var(--danger, #ec8b80); font-size: 11px; line-height: 1.35; margin: 3px 0 8px; }
</style>
