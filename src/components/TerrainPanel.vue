<script setup>
import { askConfirm } from '../core/dialogs.js'
import { reactive, ref, computed, watch } from 'vue'
import { store, confirmTerrainCrop, addTerrain, addTerrainPiece, selectPiece, setPiecePosition, renamePiece, stitchTerrain, removeTerrain, syncPieces, terrainOn, commitTerrain, extendTerrainEdge, toast, assetUrl, importFiles, folderEntries, addFoliageType, removeFoliageType, assignFoliageFile, clearFoliageInstances, commitFoliageEdit } from '../core/store.js'
import { BUILTIN_FOLIAGE, MAX_PER_TYPE } from '../engine/runtime/geometry/foliage.js'
import { MAX_LAYERS, DEFAULT_TERRAIN_GENERATOR } from '../engine/runtime/geometry/terrain.js'
import { allEntries } from '../core/project.js'
import { hasAssetDrag, resolveAssetDrop } from '../core/editor/asset-drop.js'
import { pickFile } from '../engine/runtime/util.js'
import { SURFACE_LIST, surfaceFromPaintName } from '../engine/runtime/layers.js'
import { normalizedHydrology } from '../engine/runtime/geometry/terrain-splat.js'
import NumberField from './NumberField.vue'
import Icon from './Icon.vue'
import PropertyKey from './PropertyKey.vue'

const properties = defineProps({
  timelinePieceId: { type: String, default: '' },
  timelineKeyable: { type: Function, default: null },
  timelineMarked: { type: Function, default: null },
})
const emit = defineEmits(['timeline-insert-key'])
const terrainPositionKey = 'terrain.piecePosition'
const showTerrainPositionKey = computed(() => properties.timelinePieceId &&
  active.value?.id === properties.timelinePieceId && properties.timelineKeyable?.(terrainPositionKey))

const TOOLS = [
  { id: 'raise', label: 'Elevar', icon: 'raise', tip: 'Sube el terreno (Ctrl = bajar)' },
  { id: 'lower', label: 'Bajar', icon: 'lower', tip: 'Baja el terreno (Ctrl = elevar)' },
  { id: 'smooth', label: 'Suavizar', icon: 'smooth', tip: 'Suaviza irregularidades' },
  { id: 'flatten', label: 'Aplanar', icon: 'flatten', tip: 'Nivela a la altura del primer clic' },
  { id: 'noise', label: 'Rugosidad', icon: 'noise', tip: 'Añade relieve aleatorio' },
  { id: 'paint', label: 'Pintar', icon: 'paint', tip: 'Pinta la capa seleccionada' },
  { id: 'ramp', label: 'Rampa', icon: 'ramp', tip: 'Arrastra de A a B: crea una rampa rectangular; el ancho es el tamaño del pincel (playas, taludes, acantilados)' },
]

const gen = reactive({ ...DEFAULT_TERRAIN_GENERATOR })
const size = reactive({ size: store.project.terrain.size, segments: store.project.terrain.segments })

watch(() => [store.project.terrain.size, store.project.terrain.segments], ([a, b]) => { size.size = a; size.segments = b }) // tras deshacer/cambiar de escena
const t = () => store.editor.terrain

function pickTool(id) {
  store.terrainTool = id
  store.tool = 'terrain'
}

function generate() {
  // Generate es la única acción que actualiza la versión de la costa guardada.
  if (gen.shape !== 'terrain') gen.reliefVersion = 3
  if (gen.shape !== 'terrain') gen.coastlineVersion = 4
  t().generate({ ...gen })
  commitTerrain('Generar terreno')
  toast('Terreno generado', 'ok', 1400)
}
function flat() { t().flat(0); commitTerrain('Aplanar terreno') }
function autoPaint() { t().autoPaint(); commitTerrain('Auto-pintar'); toast('Capas aplicadas por altura y pendiente', 'ok', 1800) }
function resetPaint() { t().resetPaint(); commitTerrain('Reiniciar pintura') }
function randomSeed() { gen.seed = Math.floor(Math.random() * 9999) }

const SIZES = [32, 64, 128, 256, 512, 1024, 2048]
const SEGS = [64, 128, 256, 512, 1024]
const verts = computed(() => (size.segments + 1) ** 2)
const heavy = computed(() => size.segments > 512)
const sizeDirty = computed(() => size.size !== store.project.terrain.size || size.segments !== store.project.terrain.segments)
// Una sola configuración de agua física por escena. Las regiones existentes siguen siendo editables.
const sim = computed(() => store.project.environment?.waterSimulation || { enabled: false, regions: [] })
const liquidProfiles = computed(() => store.project?.liquids || [])
function setRegionLiquid(id) {
  store.project.environment.waterSimulation = {...sim.value, regions:sim.value.regions.map((r,i)=>i===0?{...r,liquidId:id}:r)}
  store.editor.syncEnvironment();commit('Líquido de la región física')
}
const simRegion = computed(() => sim.value.regions?.[0] || null)
const simDepthDraft = ref(0)
const simCells = computed(() => sim.value.regions?.reduce((n, r) => n + r.width * r.height, 0) || 0)
const hydroOn = computed(() => sim.value.hydrology?.enabled === true)
const runoffOn = computed(() => sim.value.runoff?.enabled === true)
// Las conexiones son datos explícitos de escena; los cuerpos heredados no pasan a reservas finitas.
const couplingDomains = computed(() => [
  ...(sim.value.regions || []).map((r) => ({ id: r.id, label: `Región: ${r.name || r.id}`, region: r })),
  ...(store.project.objects || []).filter((o) => o.type === 'water' && o.visible !== false)
    .map((o) => ({ id: o.id, label: `Agua: ${o.name}`, region: null })),
])
const linkFrom = ref(''), linkTo = ref('')
function endpoint(id) {
  const domain = couplingDomains.value.find((d) => d.id === id)
  if (!domain) return null
  if (!domain.region) return { id }
  return { id, col: Math.floor(domain.region.width / 2), row: Math.floor(domain.region.height / 2) }
}
function saveCouplings(links) {
  store.project.environment.waterSimulation = { ...sim.value, couplings: links }
  store.editor.syncEnvironment()
  commit('Conexiones hidráulicas')
}
function addCoupling() {
  const from = endpoint(linkFrom.value), to = endpoint(linkTo.value)
  if (!from || !to || from.id === to.id) return toast('Selecciona dos dominios diferentes', 'info')
  if (!sim.value.regions.some((r) => r.id === from.id || r.id === to.id))
    return toast('Al menos un extremo debe ser una región física', 'info')
  const existing = sim.value.couplings || []
  const id = `hydro-${Math.max(0,...existing.map((l) => Number(String(l.id).replace(/^hydro-/, '')) || 0))+1}`
  saveCouplings([...existing, { id, from, to, apertureM2: 0.05, coefficient: 0.6, maxFlowM3s: 2, direction: 'from-to' }])
}
function updateCoupling(i, patch) {
  const links = (sim.value.couplings || []).map((l, k) => k === i ? { ...l, ...patch } : l)
  saveCouplings(links)
}
function changeCouplingEndpoint(i, end, value) {
  const e = endpoint(value)
  if (e) updateCoupling(i, { [end]: e })
}
function changeCouplingCell(i, end, key, value) {
  const l = sim.value.couplings?.[i], region = sim.value.regions?.find((r) => r.id === l?.[end]?.id)
  if (!region || !Number.isInteger(value) || value < 0 || value >= (key === 'col' ? region.width : region.height)) return
  updateCoupling(i, { [end]: { ...l[end], [key]: value } })
}
function removeCoupling(i) { saveCouplings((sim.value.couplings || []).filter((_, k) => k !== i)) }
function toggleDisplacement(on) {
  store.project.environment.waterSimulation = { ...sim.value, displacement: { enabled: on } }
  store.editor.syncEnvironment()
  commit('Desplazamiento de agua por Jolt')
}

function toggleRunoff(on) {
  store.project.environment.waterSimulation = { ...sim.value, runoff: { enabled: on } }
  store.editor.syncEnvironment()
  commit('Escurrimiento sobre geometría')
}
function toggleHydrology(on) {
  store.project.environment.waterSimulation = { ...sim.value, hydrology: { enabled: on } }
  store.editor.syncEnvironment()
  commit('Hidrología del terreno')
}
function layerHydrology(l) { return l.hydrology || (l.hydrology = normalizedHydrology()) }
function saveHydrology() {
  // La fuente de verdad de los pesos está en Terrain; sincronizar también propiedades de capa.
  const normalized = layers.value.map((l) => ({ ...l, hydrology: normalizedHydrology(l.hydrology) }))
  for (const piece of store.editor.terrains) piece.setLayers(normalized)
  store.project.terrain.layers = normalized
  store.editor.syncEnvironment()
  commitTerrain('Propiedades hidrológicas')
}
watch(() => simRegion.value?.initialDepth ?? 0, (d) => { simDepthDraft.value = d }, { immediate: true })
function waterSimToggle(on) {
  const old = sim.value
  if (!on) store.project.environment.waterSimulation = { ...old, enabled: false }
  else if (old.regions?.length) store.project.environment.waterSimulation = { ...old, enabled: true }
  else {
    const piece = active.value
    if (!piece) return toast('Selecciona una pieza de terreno para el agua', 'info')
    const size = piece.size, cells = 32
    store.project.environment.waterSimulation = { enabled: true, regions: [{ id: 'agua-terreno',
      x: piece.ox - size / 2, z: piece.oz - size / 2, width: cells, height: cells,
      cellSize: size / cells, initialDepth: 0 }] }
  }
  store.editor.syncEnvironment()
  commit('Simulación de agua')
}
function waterSimDepth(depth) {
  const old = sim.value
  if (!old.regions?.length) return
  store.project.environment.waterSimulation = { ...old, regions: old.regions.map((r, i) => i === 0
    ? { ...r, initialDepth: Math.max(0, depth) } : r) }
  store.editor.syncEnvironment()
  commit('Profundidad inicial del agua')
}
const maxRadius = computed(() => store.editor?.maxBrush?.() ?? 40)

async function applySize() {
  if (!sizeDirty.value) return
  const S = Math.round(Math.min(8192, Math.max(8, size.size))), N = Math.round(Math.min(1024, Math.max(8, size.segments)))
  size.size = S; size.segments = N
  if (!(await askConfirm('Cambiar tamaño o resolución remuestrea el terreno. ¿Continuar?', { title: 'Remuestrear terreno' }))) return
  t().resize(S, N)
  store.editor.stitch()
  syncPieces()
  store.editor.syncEnvironment()
  store.editor.syncSettings()
  store.editor.applyView()
  commitTerrain('Redimensionar terreno')
}

// ---------- piezas de terreno ----------
const pieces = computed(() => store.pieces)
const active = computed(() => store.pieces.find((q) => q.id === store.activePieceId) || null)
// Seleccionar el nodo Terrain en Jerarquía enfoca la misma pieza en el panel.
watch(() => properties.timelinePieceId, id => {
  if (id && store.activePieceId !== id && store.editor?.terrains?.some(t => t.id === id)) selectPiece(id)
}, { immediate: true })
const multi = computed(() => store.pieces.length > 1)
// Al seleccionar otra pieza o deshacer/rehacer, leer el contrato de ESA pieza.
// El formulario no modifica el terreno hasta pulsar Generate.
watch(() => store.pieces, () => Object.assign(gen, store.editor?.terrain?.generator || DEFAULT_TERRAIN_GENERATOR), { immediate: true })
const EDGE_SIDES = [['nx', '←', 'Borde −X'], ['px', '→', 'Borde +X'], ['nz', '↑', 'Borde −Z'], ['pz', '↓', 'Borde +Z']]
const edgeMeters = ref(4)
async function changeEdge(side, direction = 1) {
  const a = active.value
  if (!a) return
  const cells = Math.round(edgeMeters.value / a.step) * direction
  if (!Number.isSafeInteger(cells) || cells === 0) return toast('Introduce una distancia mayor que una celda', 'info')
  if (direction < 0 && !(await confirmTerrainCrop())) return
  if (!extendTerrainEdge(a.id, side, cells)) return toast('Límite de terreno o memoria alcanzado', 'error')
}
const SIDES = [['nx' , '←', 'A la izquierda (−X)'], ['px', '→', 'A la derecha (+X)'], ['nz', '↑', 'Detrás (−Z)'], ['pz', '↓', 'Delante (+Z)']]
function addPiece(side) { addTerrainPiece({ adjacent: side }); toast('Pieza añadida y bordes unidos', 'ok', 1600) }
function movePiece(axis, v, commit) {
  const a = active.value
  if (!a) return
  const x = axis === 0 ? v : a.ox, y = axis === 1 ? v : a.oy, z = axis === 2 ? v : a.oz
  setPiecePosition(a.id, x, z, commit, y)
}
function joinEdges() {
  const n = stitchTerrain()
  toast(n ? `Bordes unidos en ${n} piezas` : 'No hay piezas que se toquen', n ? 'ok' : 'info', 1800)
}

// ---------- vegetación ----------
const fol = computed(() => store.project.terrain.foliage || [])
const activeFol = computed(() => fol.value.find((f) => f.id === store.foliageBrush.typeId) || null)
const foliageOn = computed(() => store.tool === 'terrain' && store.terrainTool === 'foliage')
const folTotal = computed(() => Object.values(store.foliageCounts).reduce((a, b) => a + b, 0))
const dropOver = ref(null) // id del slot (o 'new') sobre el que se arrastra
const entryById = (id) => allEntries(store.project).find((e) => e.id === id)
const BUILTIN_LIST = Object.entries(BUILTIN_FOLIAGE).map(([key, b]) => ({ key, ...b }))

function pickFoliage(id) {
  store.foliageBrush.typeId = id
  pickTool('foliage')
}
function startFoliage() {
  if (!store.foliageBrush.typeId && fol.value.length) store.foliageBrush.typeId = fol.value[0].id
  if (!fol.value.length) return toast('Añade un tipo de vegetación primero', 'info', 1800)
  pickTool('foliage')
}
function addBuiltin(key) { addFoliageType('builtin', key); pickTool('foliage') }
function addEmpty() { addFoliageType('empty'); pickTool('foliage') }
const foliageDrag = (e) => {
  const t = e.dataTransfer.types
  return t.includes('application/x-lf-entries') || t.includes('application/x-lf-entry') || t.includes('Files')
}
function overSlot(e, id) { if (foliageDrag(e)) { e.preventDefault(); dropOver.value = id } }
async function dropSlot(e, id) {
  e.preventDefault()
  e.stopPropagation()
  dropOver.value = null
  let entries = []
  if (hasAssetDrag(e.dataTransfer)) {
    entries = resolveAssetDrop(e.dataTransfer, allEntries(store.project), {
      kinds: ['model', 'texture'], multiple: true, filterKinds: true,
    }) || []
  } else if (e.dataTransfer.files?.length) {
    importFiles.last = []
    await importFiles([...e.dataTransfer.files], 'Assets')
    entries = importFiles.last || []
  }
  entries = entries.filter((x) => x.kind === 'model' || x.kind === 'texture')
  if (!entries.length) return toast('Arrastra un modelo (.glb/.obj) o una textura con alfa (.png/.webp) del panel Proyecto', 'info', 2600)
  // sobre un slot: el primero lo rellena; el resto crea slots nuevos
  entries.forEach((en, i) => { const t = assignFoliageFile(i === 0 && id !== 'new' ? id : null, en); if (t && i === entries.length - 1) pickFoliage(t.id) })
}
function slotThumb(f) { return f.source === 'texture' && f.texture ? urls[f.texture] : null }
function slotIcon(f) { return f.source === 'builtin' ? BUILTIN_FOLIAGE[f.builtin]?.icon || 'tree' : f.source === 'model' ? 'box' : f.source === 'texture' ? 'grass' : 'plus' }
function slotSource(f) {
  if (f.source === 'builtin') return 'Integrado'
  if (f.source === 'model') return entryById(f.modelId)?.file || 'Modelo (falta)'
  if (f.source === 'texture') return entryById(f.texture)?.file || 'Textura (falta)'
  return 'Arrastra un modelo o textura'
}
const fEdit = () => commitFoliageEdit('Vegetación')

// ---------- capas de pintura ----------
const picker = ref(null) // índice de la capa con el selector de textura abierto
const urls = reactive({})
const layers = computed(() => store.project.terrain.layers)
const textures = computed(() => allEntries(store.project).filter((e) => e.kind === 'texture'))
const PALETTE = ['#4f7d3a', '#8a6a44', '#9a9ea6', '#dccb94', '#6b8fb5', '#b05a4a', '#caa63c', '#e7ebef']

watch([textures, layers, fol], () => {
  const need = new Set([...textures.value.map((e) => e.id), ...layers.value.map((l) => l.texture).filter(Boolean), ...fol.value.map((f) => f.texture).filter(Boolean)])
  for (const id of need) if (!urls[id]) assetUrl(id).then((u) => { if (u) urls[id] = u })
}, { immediate: true, deep: true })

// El terreno es la fuente de verdad de pesos + capas; tras añadir/quitar/reordenar se copia al proyecto.
const syncFromTerrain = () => { store.project.terrain.layers = t().layers.map((l) => ({ ...l })) }

function addLayer() {
  const color = PALETTE[layers.value.length % PALETTE.length]
  const k = t().addLayer({ color })
  for (const o of store.editor.terrains) if (o !== t()) o.addLayer({ color })
  if (k < 0) return toast(`Máximo ${MAX_LAYERS} capas`, 'error')
  syncFromTerrain()
  store.brush.layer = k
  pickTool('paint')
  commitTerrain('Añadir capa')
}
async function removeLayer(i) {
  if (layers.value.length <= 1) return toast('Debe quedar al menos una capa', 'error')
  if (!(await askConfirm(`¿Quitar la capa «${layers.value[i].name}»? Su pintura se reparte entre las demás.`, { title: 'Quitar capa', ok: 'Quitar', danger: true }))) return
  for (const o of store.editor.terrains) o.removeLayer(i)
  syncFromTerrain()
  store.brush.layer = Math.min(store.brush.layer, layers.value.length - 1)
  picker.value = null
  commitTerrain('Quitar capa')
}
function moveLayer(i, d) {
  if (!t().swapLayers(i, i + d)) return
  for (const o of store.editor.terrains) if (o !== t()) o.swapLayers(i, i + d)
  syncFromTerrain()
  if (store.brush.layer === i) store.brush.layer = i + d
  else if (store.brush.layer === i + d) store.brush.layer = i
  picker.value = null
  commitTerrain('Reordenar capas')
}
function setTexture(i, id) {
  store.project.terrain.layers[i].texture = id
  commitTerrain(id ? 'Textura de capa' : 'Quitar textura de capa')
}
async function importTexture(i) {
  const files = await pickFile('image/*', true)
  if (!files.length) return
  await importFiles(files, 'Assets/Textures')
  const got = (importFiles.last || []).find((e) => e.kind === 'texture')
  if (got) setTexture(i, got.id)
}
function layerChange(commit) { if (commit) commitTerrain('Capa de pintura') }
function dropTexture(e, i) {
  if (!hasAssetDrag(e.dataTransfer)) return
  const entry = resolveAssetDrop(e.dataTransfer, allEntries(store.project), { kinds: ['texture'] })
  if (!entry) return toast('Arrastra una única textura válida del panel Proyecto', 'info', 2200)
  e.preventDefault()
  setTexture(i, entry.id)
}
</script>

<template>
  <div class="tp">
    <section v-if="!terrainOn()">
      <p class="hint keep" style="margin:4px 0 10px">Esta escena no tiene terreno.</p>
      <button class="primary" style="width:100%" @click="addTerrain"><Icon name="terrain" :size="13" /> Añadir terreno</button>
    </section>
    <template v-else>
    <section class="sect terrain-sect" data-fold-id="terrain-pieces">
      <header>Piezas de terreno <span class="dim">{{ pieces.length }}</span></header>
      <div class="body">
      <div class="pieces">
        <div v-for="q in pieces" :key="q.id" class="piece" :class="{ on: q.id === store.activePieceId }" @click="selectPiece(q.id)">
          <Icon name="terrain" :size="12" />
          <span class="pn">{{ q.name }}</span>
          <span class="dim mono">{{ q.size }} × {{ q.depth ?? q.size }} m</span>
        </div>
      </div>
      <div v-if="active" class="row"><span>Nombre</span><input type="text" :value="active.name" @change="renamePiece(active.id, $event.target.value)" /></div>
      <div v-if="active" class="row"><span>Posición X</span><NumberField :model-value="active.ox" :step="1" @update:model-value="movePiece(0, $event, false)" @commit="movePiece(0, active.ox, true)" /><PropertyKey v-if="showTerrainPositionKey" label="Posición de pieza XYZ" :available="true"
          :marked="!!properties.timelineMarked?.(terrainPositionKey)"
          @insert="emit('timeline-insert-key', terrainPositionKey)" /></div>
      <div v-if="active" class="row"><span>Posición Y</span><NumberField :model-value="active.oy" :step="1" @update:model-value="movePiece(1, $event, false)" @commit="movePiece(1, active.oy, true)" /></div>
      <div v-if="active" class="row"><span>Posición Z</span><NumberField :model-value="active.oz" :step="1" @update:model-value="movePiece(2, $event, false)" @commit="movePiece(2, active.oz, true)" /></div>
      <h5>Extender bordes de esta pieza</h5>
      <div class="row"><span>Distancia (m)</span><NumberField :model-value="edgeMeters" :min="0.1" :step="1" @update:model-value="edgeMeters = $event" /></div>
      <p class="hint terrain-stat">{{ active?.size }} × {{ active?.depth ?? active?.size }} m · {{ active?.segments + 1 }} × {{ (active?.segmentsZ ?? active?.segments) + 1 }} vértices</p>
      <div v-for="[id, ic, label] in EDGE_SIDES" :key="id" class="row">
        <span>{{ label }}</span>
        <button data-tooltip="Extender lado" @click="changeEdge(id, 1)">+ {{ ic }}</button>
        <button data-tooltip="Recortar lado (confirmación requerida)" @click="changeEdge(id, -1)">− {{ ic }}</button>
      </div>
      <h5>Añadir otra pieza de terreno</h5>
      <div class="sides">
        <button v-for="[id, ic, tip] in SIDES" :key="id" :data-tooltip="'Añadir pieza nueva pegada: ' + tip" @click="addPiece(id)">{{ ic }}</button>
      </div>
      <div class="two">
        <button :disabled="!multi" data-tooltip="Iguala las alturas donde dos piezas se tocan" @click="joinEdges">Unir bordes</button>
        <button :disabled="!multi" data-tooltip="Elimina la pieza seleccionada" @click="removeTerrain">Quitar pieza</button>
      </div>
      </div>
    </section>

    <section class="sect terrain-sect" data-fold-id="terrain-water">
      <header>Agua física</header>
      <div class="body">
      <div class="row"><span>Simulación</span><input type="checkbox" :checked="!!sim.enabled" @change="waterSimToggle($event.target.checked)" /></div>
      <template v-if="sim.enabled && simRegion">
        <div class="row"><span>Tipo de líquido</span><select :value="simRegion.liquidId||'water'" @change="setRegionLiquid($event.target.value)"><option value="water">Agua</option><option v-for="l in liquidProfiles" :key="l.id" :value="l.id">{{l.name}}</option></select></div>
        <div class="row"><span>Prof. inicial</span><NumberField :model-value="simRegion.initialDepth ?? 0" :min="0" :step="0.01" :decimals="3" @update:model-value="simDepthDraft = $event" @commit="waterSimDepth(simDepthDraft)" /><b class="mono">m</b></div>
        <p class="hint terrain-stat">{{ sim.regions.length }} regiones · {{ simCells }} celdas</p>
      </template>
      <template v-if="sim.enabled && simRegion">
        <label class="chk"><input type="checkbox" :checked="sim.displacement?.enabled === true" @change="toggleDisplacement($event.target.checked)" /> Desplazamiento físico por cuerpos Jolt (caja, esfera y cápsula compatibles)</label>
        <h5>Conexiones hidráulicas</h5>
        <div class="row"><span>Origen</span><select v-model="linkFrom"><option value="">Elegir</option><option v-for="d in couplingDomains" :key="d.id" :value="d.id">{{ d.label }}</option></select></div>
        <div class="row"><span>Destino</span><select v-model="linkTo"><option value="">Elegir</option><option v-for="d in couplingDomains" :key="d.id" :value="d.id">{{ d.label }}</option></select></div>
        <button :disabled="!linkFrom || !linkTo || linkFrom === linkTo" @click="addCoupling">＋ Conectar dominios</button>
        <div class="terrain-scroll-list" :class="{ 'terrain-scroll-list--long': (sim.couplings?.length || 0) >= 4 }" aria-label="Conexiones hidráulicas">
        <div v-for="(link,i) in sim.couplings || []" :key="link.id" class="layer" style="display:block; cursor:default">
          <div class="row"><b>{{ link.id }}</b><button @click="removeCoupling(i)" data-tooltip="Retirar enlace hidráulico">Eliminar</button></div>
          <div v-for="side in ['from','to']" :key="side" class="row">
            <span>{{ side === 'from' ? 'Origen' : 'Destino' }}</span>
            <select :value="link[side].id" @change="changeCouplingEndpoint(i,side,$event.target.value)"><option v-for="d in couplingDomains" :key="d.id" :value="d.id">{{ d.label }}</option></select>
            <template v-if="sim.regions?.some(r => r.id === link[side].id)">
              <input type="number" min="0" step="1" style="width:46px" :aria-label="side + ' columna'" :value="link[side].col" @change="changeCouplingCell(i,side,'col',+$event.target.value)" />
              <input type="number" min="0" step="1" style="width:46px" :aria-label="side + ' fila'" :value="link[side].row" @change="changeCouplingCell(i,side,'row',+$event.target.value)" />
            </template>
          </div>
          <div class="row"><span>Sección m²</span><NumberField :model-value="link.apertureM2" :min="0.001" :max="100" :step="0.01" @update:model-value="updateCoupling(i,{ apertureM2: $event })" /></div>
          <div class="row"><span>Coeficiente</span><NumberField :model-value="link.coefficient" :min="0.01" :max="1" :step="0.05" @update:model-value="updateCoupling(i,{ coefficient: $event })" /></div>
          <div class="row"><span>Caudal máx m³/s</span><NumberField :model-value="link.maxFlowM3s" :min="0.01" :max="1000" :step="0.1" @update:model-value="updateCoupling(i,{ maxFlowM3s: $event })" /></div>
          <label class="chk"><input type="checkbox" :checked="link.direction === 'both'" @change="updateCoupling(i,{ direction: $event.target.checked ? 'both' : 'from-to' })" /> Bidireccional</label>
        </div>
        </div>
      </template>
      </div>
    </section>

    <section class="sect terrain-sect" data-fold-id="terrain-brush">
      <header>Pincel</header>
      <div class="body">
      <div class="tools">
        <button v-for="b in TOOLS" :key="b.id" :class="{ on: store.tool === 'terrain' && store.terrainTool === b.id }" :data-tooltip="b.tip" @click="pickTool(b.id)">
          <Icon :name="b.icon" :size="14" />{{ b.label }}
        </button>
      </div>
      <div class="row"><span>Radio</span><input type="range" min="0.5" :max="maxRadius" step="0.1" v-model.number="store.brush.radius" /><b class="mono">{{ store.brush.radius.toFixed(1) }}</b></div>
      <div class="row"><span>Fuerza</span><input type="range" min="0.02" max="1" step="0.01" v-model.number="store.brush.strength" /><b class="mono">{{ store.brush.strength.toFixed(2) }}</b></div>
      <div class="row"><span>Dureza</span><input type="range" min="0" max="0.95" step="0.01" v-model.number="store.brush.hardness" /><b class="mono">{{ store.brush.hardness.toFixed(2) }}</b></div>
      <div v-if="store.terrainTool === 'ramp'" class="ramp">
        <div class="row"><span>Modo</span>
          <select v-model="store.ramp.mode">
            <option value="points">Entre los dos puntos</option>
            <option value="angle">Ángulo fijo desde A</option>
          </select>
        </div>
        <div v-if="store.ramp.mode === 'angle'" class="row"><span>Ángulo (°)</span><NumberField :model-value="store.ramp.angle" :step="1" :min="-88" :max="88" @update:model-value="store.ramp.angle = $event" /></div>
        <div class="row"><span>Subir todo (m)</span><NumberField :model-value="store.ramp.lift" :step="0.25" @update:model-value="store.ramp.lift = $event" /></div>
        <p v-if="store.rampInfo" class="hint info">Largo {{ store.rampInfo.len.toFixed(1) }} m × ancho {{ store.rampInfo.width.toFixed(1) }} m · desnivel {{ store.rampInfo.dh.toFixed(2) }} m · {{ store.rampInfo.angle.toFixed(1) }}°</p>
      </div>
      </div>
    </section>

    <section class="sect terrain-sect" data-fold-id="terrain-layers">
      <header>Capas de pintura <span class="dim">{{ layers.length }}/{{ MAX_LAYERS }}</span></header>
      <div class="body">
      <label v-if="sim.enabled" class="chk" style="margin:8px 0">
        <input type="checkbox" :checked="hydroOn" @change="toggleHydrology($event.target.checked)" /> Hidrología física en las regiones de Terrain
      </label>
      <label v-if="sim.enabled" class="chk" style="margin:8px 0">
        <input type="checkbox" :checked="runoffOn" @change="toggleRunoff($event.target.checked)" /> Escurrimiento sobre geometría 3D estática
      </label>
      <div class="terrain-scroll-list" :class="{ 'terrain-scroll-list--long': layers.length >= 6 }" aria-label="Capas de pintura">
      <template v-for="(l, i) in layers" :key="i">
        <div
          class="layer" :class="{ on: store.brush.layer === i }" @click="store.brush.layer = i; pickTool('paint')"
          @dragover="$event.dataTransfer.types.includes('application/x-lf-entry') && $event.preventDefault()" @drop="dropTexture($event, i)"
        >
          <button class="sw" :data-tooltip="l.texture ? 'Cambiar textura' : 'Asignar textura'" @click.stop="picker = picker === i ? null : i">
            <img v-if="l.texture && urls[l.texture]" :src="urls[l.texture]" alt="" draggable="false" />
            <span v-else class="flat" :style="{ background: l.color }"></span>
          </button>
          <input class="lname" type="text" v-model="l.name" @click.stop @change="layerChange(true)" />
          <ColorInput v-if="!l.texture" v-model="l.color" data-tooltip="Color de la capa" @click.stop @change="layerChange(true)" />
          <span class="ops">
            <button class="ghost icon mini" data-tooltip="Subir" :disabled="i === 0" @click.stop="moveLayer(i, -1)"><Icon name="chevron-down" :size="12" style="transform: rotate(180deg)" /></button>
            <button class="ghost icon mini" data-tooltip="Bajar" :disabled="i === layers.length - 1" @click.stop="moveLayer(i, 1)"><Icon name="chevron-down" :size="12" /></button>
            <button class="ghost icon mini" data-tooltip="Quitar capa" @click.stop="removeLayer(i)"><Icon name="trash" :size="12" /></button>
          </span>
        </div>
        <div v-if="picker === i" class="picker">
          <div class="pgrid">
            <button class="pt none" :class="{ on: !l.texture }" data-tooltip="Solo color" @click="setTexture(i, null)"><span class="flat" :style="{ background: l.color }"></span><small>Color</small></button>
            <button v-for="e in textures" :key="e.id" class="pt" :class="{ on: l.texture === e.id }" :data-tooltip="e.file" @click="setTexture(i, e.id)">
              <img v-if="urls[e.id]" :src="urls[e.id]" alt="" draggable="false" /><small>{{ e.file }}</small>
            </button>
          </div>
          <div class="row"><span>Superficie</span>
            <select v-model="l.surface" data-tooltip="Qué suena al pisar esta capa" @change="layerChange(true)">
              <option value="">Auto ({{ SURFACE_LIST.find((s) => s[0] === surfaceFromPaintName(l.name))?.[1] || 'Tierra' }})</option>
              <option v-for="[k, lab] in SURFACE_LIST" :key="k" :value="k">{{ lab }}</option>
            </select></div>
          <div class="row" v-if="l.texture"><span>Repetir cada</span><NumberField v-model="l.tile" :step="0.25" :min="0.1" :max="512" :decimals="2" @commit="layerChange(true)" /><b class="mono">m</b></div>
          <button style="width:100%" @click="importTexture(i)"><Icon name="import" :size="13" /> Importar imagen…</button>
        </div>
        <template v-if="hydroOn">
            <div class="row"><span>Infiltración</span><NumberField v-model="layerHydrology(l).infiltrationMmH" :min="0" :max="10000" :step="5" :decimals="1" @commit="saveHydrology" /><b>mm/h</b></div>
            <div class="row"><span>Retención</span><NumberField v-model="layerHydrology(l).capacityMm" :min="0" :max="10000" :step="5" :decimals="1" @commit="saveHydrology" /><b>mm</b></div>
            <div class="row"><span>Saturación inicial</span><NumberField v-model="layerHydrology(l).initialSaturation" :min="0" :max="1" :step="0.05" :decimals="2" @commit="saveHydrology" /><b>0–1</b></div>
            <div class="row"><span>Drenaje</span><NumberField v-model="layerHydrology(l).drainageMmH" :min="0" :max="10000" :step="5" :decimals="1" @commit="saveHydrology" /><b>mm/h</b></div>
          </template>
      </template>
      </div>
      <button style="width:100%; margin-top:4px" :disabled="layers.length >= MAX_LAYERS" @click="addLayer"><Icon name="plus" :size="13" /> Añadir capa</button>
      </div>
    </section>

    <section class="sect terrain-sect" data-fold-id="terrain-foliage">
      <header>Vegetación <span class="dim">{{ folTotal.toLocaleString('es') }} inst.</span>
        <button class="ghost icon mini eye" :class="{ off: !store.view.foliage }" data-tooltip="Mostrar / ocultar vegetación" aria-label="Mostrar u ocultar vegetación" @click.stop="store.view.foliage = !store.view.foliage"><Icon name="eye" :size="13" /></button>
      </header>
      <div class="body">
      <div class="btns" style="margin:0 0 8px">
        <button :class="{ on: foliageOn && !store.foliageBrush.erase }" data-tooltip="Pinta el tipo seleccionado" @click="store.foliageBrush.erase = false; startFoliage()"><Icon name="tree" :size="13" /> Pintar</button>
        <button :class="{ on: foliageOn && store.foliageBrush.erase }" data-tooltip="Borra el tipo seleccionado (Ctrl mientras pintas = borrar)" @click="store.foliageBrush.erase = true; startFoliage()"><Icon name="eraser" :size="13" /> Borrar</button>
      </div>
      <label v-if="store.foliageBrush.erase" class="chk"><input type="checkbox" v-model="store.foliageBrush.all" /> Borrar todos los tipos</label>
      <div class="terrain-scroll-list" :class="{ 'terrain-scroll-list--long': fol.length >= 6 }" aria-label="Tipos de vegetación">
      <template v-for="f in fol" :key="f.id">
        <div
          class="slot" :class="{ on: activeFol?.id === f.id, over: dropOver === f.id, off: !f.visible }" @click="pickFoliage(f.id)"
          @dragover="overSlot($event, f.id)" @dragleave="dropOver = null" @drop="dropSlot($event, f.id)"
        >
          <span class="sw"><img v-if="slotThumb(f)" :src="slotThumb(f)" alt="" draggable="false" /><Icon v-else :name="slotIcon(f)" :size="16" /></span>
          <span class="sname">
            <input type="text" v-model="f.name" @click.stop @change="fEdit" />
            <small :class="{ warn: f.source === 'empty' }">{{ slotSource(f) }} · {{ (store.foliageCounts[f.id] || 0).toLocaleString('es') }}</small>
          </span>
          <button class="ghost icon mini" :data-tooltip="f.visible ? 'Ocultar' : 'Mostrar'" @click.stop="f.visible = !f.visible; fEdit()"><Icon name="eye" :size="12" /></button>
          <button class="ghost icon mini" data-tooltip="Quitar tipo" @click.stop="removeFoliageType(f.id)"><Icon name="trash" :size="12" /></button>
        </div>
        <div v-if="activeFol?.id === f.id" class="fprops">
          <div class="row"><span>Densidad</span><NumberField v-model="f.density" :step="1" :min="0.5" :max="2000" :decimals="1" @commit="fEdit" /><b class="mono">/100 m²</b></div>
          <div class="row"><span>Escala</span><NumberField v-model="f.minScale" :step="0.05" :min="0.05" :max="50" :decimals="2" @commit="fEdit" /><NumberField v-model="f.maxScale" :step="0.05" :min="0.05" :max="50" :decimals="2" @commit="fEdit" /></div>
          <div class="row"><span>Altura Y</span><NumberField v-model="f.yOffset" :step="0.05" :decimals="2" @commit="fEdit" /><b class="mono">m</b></div>
          <div class="row"><span>Pendiente</span><input type="range" min="5" max="90" step="1" v-model.number="f.maxSlope" @change="fEdit" /><b class="mono">{{ f.maxSlope }}°</b></div>
          <label class="chk"><input type="checkbox" v-model="f.destructible" @change="fEdit" /> Árbol desprendible con fuerza suficiente</label>
          <template v-if="f.destructible">
            <div class="row"><span>Raíces (N)</span><NumberField v-model="f.rootResistanceN" :min="20" :max="100000" :step="100" @commit="fEdit" /></div>
            <div class="row"><span>Tronco (N)</span><NumberField v-model="f.trunkResistanceN" :min="20" :max="100000" :step="100" @commit="fEdit" /></div>
          </template>
          <label class="chk"><input type="checkbox" v-model="f.combustible" @change="fEdit" /> Vegetación combustible</label>
          <div v-if="f.combustible" class="row"><span>Humedad</span><NumberField v-model="f.moisture" :min="0" :max="1" :step="0.05" @commit="fEdit" /></div>
          <div class="row"><span>Viento</span><input type="range" min="0" max="2" step="0.05" :value="f.windSway ?? 1" data-tooltip="Cuánto se mece con el viento (0 = rígido)" @input="f.windSway = +$event.target.value" @change="fEdit" /><b class="mono">{{ (f.windSway ?? 1).toFixed(2) }}</b></div>
          <div v-if="f.source !== 'texture'" class="row"><span>Hojas</span><label class="chk"><input type="checkbox" :checked="!!f.leaves" @change="f.leaves = $event.target.checked; fEdit()" /> caen hojas (con el viento)</label></div>
          <div class="row"><span>Alinear</span><input type="range" min="0" max="1" step="0.05" v-model.number="f.alignNormal" @change="fEdit" /><b class="mono">{{ f.alignNormal.toFixed(2) }}</b></div>
          <div class="row" v-if="f.source !== 'model'"><span>Tinte</span><ColorInput v-model="f.color" @change="fEdit" /><span></span></div>
          <label class="chk"><input type="checkbox" v-model="f.castShadow" @change="fEdit" /> Proyecta sombra</label>
          <button style="width:100%; margin-top:6px" :disabled="!store.foliageCounts[f.id]" @click="clearFoliageInstances(f.id)"><Icon name="trash" :size="12" /> Borrar sus instancias</button>
        </div>
      </template>
      </div>
      <div class="newslot" :class="{ over: dropOver === 'new' }" @dragover="overSlot($event, 'new')" @dragleave="dropOver = null" @drop="dropSlot($event, 'new')">
        Suelta aquí un modelo o textura para crear un tipo propio
      </div>
      <div class="chips bi">
        <button v-for="b in BUILTIN_LIST" :key="b.key" :data-tooltip="`Añadir ${b.name}`" @click="addBuiltin(b.key)"><Icon :name="b.icon" :size="12" /> {{ b.name }}</button>
        <button data-tooltip="Slot vacío (luego arrastra un archivo)" @click="addEmpty"><Icon name="plus" :size="12" /> Vacío</button>
      </div>
      </div>
    </section>

    <section class="sect terrain-sect generator" data-fold-id="terrain-generator">
      <header>Terrain Generator <span v-if="(gen.shape !== 'terrain' && gen.coastlineVersion < 4) || gen.reliefVersion === 1" class="terrain-alert">Costa heredada</span></header>
      <div class="body">
      <div class="row"><span>Shape</span>
        <select v-model="gen.shape">
          <option value="terrain">Original Terrain</option>
          <option value="island">Island</option>
          <option value="bay">Bay (Complete Coast)</option>
        </select>
      </div>
      <div class="row"><span>Seed</span><NumberField v-model="gen.seed" :step="1" :decimals="0" /><button class="ghost" data-tooltip="Random seed" @click="randomSeed">⚄</button></div>
      <template v-if="gen.shape === 'terrain'">
        <div class="row"><span>Height</span><NumberField v-model="gen.amplitude" :step="0.5" :min="0" /></div>
        <div class="row"><span>Noise Scale</span><NumberField v-model="gen.scale" :step="0.005" :min="0.005" :decimals="3" /></div>
        <div class="row"><span>Octaves</span><NumberField v-model="gen.octaves" :step="1" :min="1" :max="8" :decimals="0" /></div>
        <div class="row"><span>Roughness</span><NumberField v-model="gen.roughness" :step="0.05" :min="0.1" :max="0.9" /></div>
      </template>
      <div v-if="gen.shape === 'terrain'" class="row"><span>Island Falloff</span><input type="range" min="0" max="1" step="0.05" v-model.number="gen.island" /><b class="mono">{{ gen.island.toFixed(2) }}</b></div>
      <template v-else>
        <div class="row"><span>Coast Roughness</span><input type="range" min="0" max="1" step="0.05" v-model.number="gen.coastRoughness" /><b class="mono">{{ gen.coastRoughness.toFixed(2) }}</b></div>
        <div class="row"><span>Beach Width</span><NumberField v-model="gen.beachWidth" :step="0.5" :min="0.5" :max="Math.max(0.5, (active?.size ?? 64) / 2)" /><b class="mono">m</b></div>
        <div class="row"><span>Cliff Strength</span><input type="range" min="0" max="1" step="0.05" v-model.number="gen.cliffStrength" /><b class="mono">{{ gen.cliffStrength.toFixed(2) }}</b></div>
        <div class="row"><span>Sea Level</span><NumberField v-model="gen.seaLevel" :step="0.5" :decimals="2" /><b class="mono">Y</b></div>
        <p v-if="gen.shape !== 'terrain' && gen.coastlineVersion < 4" class="hint keep">Older coastline detected. Saved heights remain unchanged until Generate applies the updated coast.</p>
        <p v-if="gen.reliefVersion === 1" class="hint keep">Legacy coastal terrain detected. Existing heights stay unchanged until you press Generate, which applies the new relief algorithm.</p>
      </template>
      <div class="btns">
        <button class="primary" @click="generate">Generate</button>
        <button @click="flat">Aplanar</button>
      </div>
      <p class="hint warn">Generate reemplaza las alturas de la pieza. Puedes deshacer la operación.</p>
      <div class="btns">
        <button @click="autoPaint">Auto-pintar</button>
        <button @click="resetPaint">Reiniciar pintura</button>
      </div>
      </div>
    </section>

    <section class="sect terrain-sect" data-fold-id="terrain-size">
      <header>Tamaño <span v-if="heavy" class="terrain-alert">Resolución alta</span></header>
      <div class="body">
      <div class="row"><span>Lado (m)</span><NumberField v-model="size.size" :step="8" :min="8" :max="8192" :decimals="0" /><b class="mono">m</b></div>
      <div class="chips"><button v-for="n in SIZES" :key="n" :class="{ on: size.size === n }" @click="size.size = n">{{ n }}</button></div>
      <div class="row"><span>Resolución</span><NumberField v-model="size.segments" :step="16" :min="8" :max="1024" :decimals="0" /><b class="mono">seg</b></div>
      <div class="chips"><button v-for="n in SEGS" :key="n" :class="{ on: size.segments === n }" @click="size.segments = n">{{ n }}</button></div>
      <button class="primary" style="width:100%" :disabled="!sizeDirty" @click="applySize">Aplicar tamaño</button>
      <p class="hint terrain-stat">Celda: {{ (size.size / size.segments).toFixed(2) }} m · {{ verts.toLocaleString('es') }} vértices</p>
      <p v-if="heavy" class="hint warn">Más de 512 segmentos es pesado: el editor y el archivo exportado serán lentos. Mejor aumenta el lado y mantén ≤ 512.</p>
      </div>
    </section>
    </template>
  </div>
</template>

<style scoped>
section:not(.terrain-sect) { padding: 8px 10px 12px; border-bottom: 1px solid var(--hair); }
.terrain-sect { min-width: 0; }
.terrain-sect > header { min-height: 30px; height: auto; overflow: visible; white-space: normal; padding-block: 6px; }
.terrain-sect > .body { padding: 12px 14px 14px; min-width: 0; }
.tp { container-type: inline-size; }
.terrain-scroll-list--long { max-height: 280px; overflow-y: auto; overscroll-behavior: contain; }
.terrain-scroll-list { min-width: 0; }
.terrain-scroll-list:focus-within { scroll-behavior: auto; }

.terrain-sect > header .eye { margin-left: auto; flex: none; }
.terrain-alert { margin-left: auto; padding-inline: 5px; border-radius: 3px; color: var(--amber); font-size: 10px; font-weight: 500; }
.tools { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin-bottom: 10px; }
.tools button { height: auto; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 7px 2px; font-size: 11px; }
.tools button.on { background: var(--blue); border-color: var(--blue); color: #fff; }
.ic { font-size: 15px; line-height: 1; }
.row { display: grid; grid-template-columns: minmax(70px, 0.9fr) minmax(0, 1.1fr) auto; align-items: center; gap: 9px; margin-bottom: 8px; min-height: 28px; }
.row > span { color: var(--text-3); font-size: 12px; overflow-wrap: anywhere; }
.row b { font-weight: 500; font-size: 11px; min-width: 32px; text-align: right; }
.row select { grid-column: 2 / 4; }
.generator .row { grid-template-columns: minmax(112px, 0.9fr) minmax(0, 1.1fr) auto; }
.layer { display: flex; gap: 8px; align-items: center; padding: 7px 6px; border: 1px solid transparent; border-radius: 6px; cursor: pointer; margin-bottom: 3px; }
.dim { color: var(--text-3); font-weight: 400; margin-left: 4px; }
.sw { width: 30px; height: 30px; padding: 0; flex: none; overflow: hidden; border-radius: 5px; border: 1px solid var(--hair); background: var(--g-950); }
.sw img, .sw .flat, .pt img, .pt .flat { display: block; width: 100%; height: 100%; object-fit: cover; }
.layer .lname { flex: 1; min-width: 0; }
.ops { display: flex; flex: none; }
.ops .mini { width: 20px; height: 22px; padding: 0; }
.picker { margin: 0 0 6px 8px; padding: 8px; background: var(--g-900); border: 1px solid var(--hair); border-radius: 6px; }
.pgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(54px, 1fr)); gap: 5px; margin-bottom: 8px; max-height: 150px; overflow: auto; }
.pt { display: flex; flex-direction: column; gap: 2px; padding: 2px; height: auto; }
.pt > img, .pt > .flat { height: 40px; border-radius: 3px; }
.pt small { font-size: 9px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-3); }
.pt.on { border-color: var(--blue); background: var(--blue-wash); }
.chips { display: flex; flex-wrap: wrap; gap: 3px; margin: -2px 0 8px; }
.chips button { height: 20px; padding: 0 6px; font-size: 11px; }
.chips button.on { background: var(--blue); border-color: var(--blue); color: #fff; }
.hint.warn { color: var(--amber); }
.layer:hover { background: var(--g-800); }
.layer.on { border-color: var(--blue); background: rgba(71,140,191,.12); }
.layer  :deep(.lf-color-input) { width: 26px; height: 22px; padding: 0; border: none; background: none; flex: none; }
.lname { background: transparent; border-color: transparent; }
.lname:focus { background: var(--g-950); }
.slot { display: flex; gap: 8px; align-items: center; padding: 7px 6px; border: 1px solid transparent; border-radius: 6px; cursor: pointer; margin-bottom: 3px; }
.slot:hover { background: var(--g-800); }
.slot.on { border-color: var(--blue); background: rgba(71,140,191,.12); }
.slot.over, .newslot.over { border-color: var(--amber); background: rgba(255,181,71,.12); }
.slot.off { opacity: .55; }
.slot .sw { display: grid; place-items: center; color: var(--text-2); }
.sname { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.sname input { background: transparent; border-color: transparent; height: 20px; padding: 0 4px; }
.sname input:focus { background: var(--g-950); }
.sname small { font-size: 10px; color: var(--text-3); padding-left: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sname small.warn { color: var(--amber); }
.fprops { margin: 0 0 6px 8px; padding: 8px; background: var(--g-900); border: 1px solid var(--hair); border-radius: 6px; }
.fprops .row { grid-template-columns: 70px 1fr 1fr; }
.fprops .row  :deep(.lf-color-input) { width: 40px; height: 22px; padding: 0; }
.newslot { margin: 6px 0; padding: 10px 8px; border: 1px dashed var(--hair); border-radius: 6px; text-align: center; font-size: 11px; color: var(--text-3); }
.chk { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-2); margin: 2px 0 6px; }
.eye.off { opacity: .4; }
.btns button.on { background: var(--blue); border-color: var(--blue); color: #fff; }
.chips.bi button { display: inline-flex; align-items: center; gap: 3px; }
.btns { display: flex; gap: 6px; margin-top: 6px; }
.btns button { flex: 1; }
.hint { margin: 6px 0 0; font-size: 11px; color: var(--text-3); }
.pieces { border: 1px solid var(--hair); border-radius: 6px; background: var(--g-950); margin-bottom: 8px; max-height: 150px; overflow: auto; }
.piece { display: flex; align-items: center; gap: 6px; padding: 4px 8px; cursor: pointer; font-size: 12px; border-bottom: 1px solid var(--hair-soft); }
.piece .pn { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.piece.on { background: var(--blue); color: #fff; }
.piece.on .dim { color: #fff; opacity: .8; }
.ramp { border-top: 1px solid var(--hair-soft); margin-top: 6px; padding-top: 8px; }
.hint.info { color: var(--amber); }
.sides { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; margin: 4px 0 2px; }
.two { display: flex; gap: 6px; margin-top: 8px; }
.two > * { flex: 1; }
kbd { font-family: var(--font); font-size: 10px; background: var(--g-950); border: 1px solid var(--hair); border-radius: 3px; padding: 0 4px; }
@container (max-width: 290px) {
  .terrain-sect > .body { padding: 10px; }
  .row, .generator .row, .fprops .row { grid-template-columns: minmax(0, 1fr); }
  .row select { grid-column: auto; }
}
</style>
