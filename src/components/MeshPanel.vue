<script setup>
import { acquirePointer } from '../engine/runtime/input/pointer-capture.js'
import { finiteTuple } from '../engine/runtime/numeric-integrity.js'
import { computed, nextTick, ref, reactive, watch } from 'vue'
import { uvPreview } from '../core/mesh/uv.js'
import { store, getObject, updateObject, assetUrl } from '../core/store.js'
import { allEntries } from '../core/project.js'
import { run, command } from '../core/commands.js'
import NumberField from './NumberField.vue'
import Icon from './Icon.vue'
import ColorInput from './ColorInput.vue'
import { MAX_LAYERS } from '../engine/runtime/geometry/terrain-splat.js'

const props = defineProps({ search: { type: String, default: '' } })
const showAllParams = ref(false)
const e = computed(() => store.edit)
const modal = computed(() => e.value.modalControl)
const paramGroup = computed(() => ({ bevelVertex: 'bevel', vertexSlide: 'slide', edgeSlide: 'slide' })[modal.value?.kind] || modal.value?.kind || '')
const contextualParams = computed(() => !!modal.value?.inspecting && ['inset', 'bevel', 'spin', 'shear', 'slide'].includes(paramGroup.value))
watch(() => modal.value?.kind, () => { showAllParams.value = false })
const modalTitle = computed(() => groups.flatMap(group => group.tools).find(tool => tool[0] === 'mesh.' + modal.value?.kind)?.[1] || modal.value?.kind || '')
const modalField = ref(null)
const modalDraft = ref('')
const modalButton = ref(null)
const editSession = () => store.editor?.edit
function changeModalDraft(text) {
  modalDraft.value = text
  editSession()?.editModalValue(text)
}
watch([() => modal.value?.inspecting, () => modal.value?.focus, () => modal.value?.label], async ([inspecting, focus, label]) => {
  if (!inspecting) return
  const value = modal.value?.value
  modalDraft.value = Number.isFinite(value) ? String(Number(value.toFixed(8))) : ''
  if (!focus) return
  await nextTick()
  if (!modal.value?.inspecting || modal.value.focus !== focus || modal.value.label !== label) return
  if (label) {
    modalField.value?.focus()
    modalField.value?.select()
  } else modalButton.value?.focus()
}, { flush: 'post', immediate: true })
watch(() => {
  if (!modal.value?.inspecting) return null
  const settings = e.value
  switch (modal.value.kind) {
    case 'inset': return settings.inset.depth
    case 'bevel': case 'bevelVertex': return settings.bevel.profile
    case 'vertexSlide': case 'edgeSlide': return settings.slide.axis
    case 'spin': return [settings.spin.steps, settings.spin.axis, ...settings.spin.center].join(',')
    case 'shear': return settings.shear.axis + settings.shear.reference
    default: return null
  }
}, (value, previous) => {
  if (value != null && previous != null) editSession()?.modalUpdate()
})
const uvAxis = ref('z')
const uvAngle = ref(90)
const uvScale = ref(1.1)
const uvView = computed(() => {
  void e.value?.count
  const session = store.editor?.edit
  if (!session?.poly) return { polygons: [], factor: 1 }
  const faces = uvPreview(session.poly, session.sel)
  if (faces.some(face => !face.uv.every(p => finiteTuple(p, 2)))) return { polygons: [], factor: 1, invalid: true }
  const pts = faces.flatMap((face) => face.uv)
  if (!pts.length) return { polygons: [], factor: 1 }
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity
  for (const [u, v] of pts) {
    if (u < minU) minU = u; if (u > maxU) maxU = u
    if (v < minV) minV = v; if (v > maxV) maxV = v
  }
  const factor = 254 / Math.max(1e-6, maxU - minU, maxV - minV, 1)
  if (!(factor > 0) || !Number.isFinite(factor)) return { polygons: [], factor: 1, invalid: true }
  return { factor, polygons: faces.map((f) => ({ ...f,
    points: f.uv.map(([u,v]) => `${22 + (u - minU) * factor},${278 - (v - minV) * factor}`).join(' ') })) }
})
const uvRun = (kind, args = {}) => store.editor?.edit?.uvAction(kind, args)
let uvStart = null
const uvDown = (ev) => {
  if (ev.button !== 0 || !uvView.value.polygons.length) return
  if (!acquirePointer(ev.currentTarget, ev, "Mapa UV")) return
  uvStart = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, factor: uvView.value.factor }
}
const uvUp = (ev) => {
  if (!uvStart || uvStart.id !== ev.pointerId) return
  const start = uvStart; uvStart = null
  const bounds = ev.currentTarget.getBoundingClientRect()
  if (!bounds.width || !bounds.height) return
  const dx = (ev.clientX - start.x) * 300 / bounds.width / start.factor
  const dy = (start.y - ev.clientY) * 300 / bounds.height / start.factor
  if ([dx, dy].every(Number.isFinite) && Math.abs(dx) + Math.abs(dy) > 1e-6) uvRun('move', { translate: [dx, dy] })
}

const obj = computed(() => getObject(e.value.id))
const generator = computed(() => { void e.value.count; return editSession()?.generatorState?.() || null })
const reduceCount = ref(null)
watch(() => e.value.id, () => { reduceCount.value = null })
const reduceFaces = () => editSession()?.reduceFaceCount?.(reduceCount.value == null ? Math.max(1, Math.floor(c.value.f / 2)) : Number(reduceCount.value))
const changeGeneratorCount = (key, ev) => {
  const value = ev.target.value
  ev.target.value = String(generator.value?.params[key] ?? '')
  return editSession()?.changeGeneratorCount?.(key, value)
}
const cleanSettings = reactive({ removeLooseEdges: true, removeLooseVertices: true, removeDuplicateWires: true, weldVertices: false, tolerance: 0.0001 })
const cleanReport = computed(() => { void e.value.count; return editSession()?.inspectCleanup?.(Number(cleanSettings.tolerance)) || null })
const cleanTopology = () => editSession()?.cleanTopology?.({ ...cleanSettings })
const c = computed(() => e.value.count)
const modes = [['vertex', 'Vértices', '1'], ['edge', 'Aristas', '2'], ['face', 'Caras', '3']]

// herramientas agrupadas
const groups = [
  { id: 'modeling', icon: 'extrude', title: 'Modelado', tools: [['mesh.extrude', 'Extruir', 'extrude', 'E'], ['mesh.extrudeSolid', 'Sólido cerrado', 'extrude', ''], ['mesh.extrudeIndividual', 'Extruir individual', 'extrude', ''], ['mesh.inset', 'Inset', 'inset', 'I'], ['mesh.bevel', 'Bisel aristas', 'bevel', 'Ctrl B'], ['mesh.bevelVertex', 'Bisel vértices', 'vertex', 'Ctrl Shift B'], ['mesh.loopcut', 'Corte bucle', 'loopcut', 'Ctrl R'], ['mesh.knife', 'Cuchillo', 'knife', 'K'], ['mesh.bridge', 'Puente', 'bridge', ''], ['mesh.closeContour', 'Cerrar cadena', 'vertex', ''], ['mesh.fill', 'Rellenar', 'face', 'F'], ['mesh.subdivide', 'Subdividir', 'subdivide', '']] },
  { id: 'transform-tools', icon: 'move', title: 'Herramientas de transformación', tools: [['mesh.grab', 'Mover', 'move', 'G'], ['mesh.rotate', 'Rotar', 'rotate', 'R'], ['mesh.scale', 'Escalar', 'scale', 'S'], ['mesh.shrink', 'Encoger', 'scale', 'Alt S'], ['mesh.vertexSlide', 'Vertex Slide', 'move', ''], ['mesh.edgeSlide', 'Edge Slide', 'move', ''], ['mesh.spin', 'Spin', 'rotate', ''], ['mesh.shear', 'Shear', 'scale', '']] },
  { id: 'topology', icon: 'mesh', title: 'Topología', tools: [['mesh.merge.faces', 'Fusionar caras', 'face', ''], ['mesh.merge.center', 'Fusionar', 'merge', 'M'], ['mesh.split', 'Dividir', 'split', 'Y'], ['mesh.separate', 'Separar', 'split', 'P'], ['mesh.duplicate', 'Duplicar', 'copy', 'Shift D'], ['mesh.dissolve', 'Disolver aristas / unir caras', 'trash', 'Ctrl X'], ['mesh.delete', 'Eliminar', 'trash', 'X']] },
  { id: 'normals', icon: 'normal', title: 'Normales', tools: [['mesh.flip', 'Invertir', 'flip', 'Alt N'], ['mesh.recalc', 'Recalcular', 'normal', 'Shift N'], ['mesh.smooth', 'Suave', 'sphere', ''], ['mesh.flat', 'Plano', 'box', '']] },
]
const sel = (id) => run(id)
const drawVertex = () => store.editor?.edit?.toggleVertexDraw()
const setVertexPlane = (plane) => store.editor?.edit?.setVertexPlane(plane)
const connectVerts = () => store.editor?.edit?.connectSelectedVertices()
const closeVerts = () => run('mesh.closeContour')
// Los controles numéricos consultan siempre la selección y la geometría vigentes.
const numericPosition = computed(() => { void e.value?.count; return store.editor?.edit?.numericPosition?.() })
const numericEnabled = computed(() => { void e.value?.count; return !!store.editor?.edit?.sel?.v?.size && !e.value.hud && !e.value.paint.active })
const numericGroup = computed(() => { void e.value?.count; return (store.editor?.edit?.sel?.v?.size || 0) > 1 })
const numericAxis = ['X', 'Y', 'Z']
const numericEdit = (kind, axis, value) => store.editor?.edit?.numericTransform(kind, axis, value)
const uniformMeshScale = (factor) => store.editor?.edit?.numericTransform('uniformScale', -1, factor)
const numericCommit = () => store.editor?.edit?.numericCommit()
const numericValue = (kind, axis) => { void e.value?.count; return store.editor?.edit?.numericValue?.(kind, axis) ?? (kind === 'scale' ? 1 : 0) }
// pivote normalizado: se recalcula con cada cambio de la malla (store.edit.count es un objeto nuevo en cada refresco)
const pivNow = computed(() => { void e.value?.count; return store.editor?.edit?.pivotNormalized?.() || [0, 0, 0] })
const setPivot = (k, v) => { const n = [null, null, null]; n[k] = v; store.editor?.edit?.setPivot(n) }
const pivotAll = (n) => store.editor?.edit?.setPivot(n)
const patch = (p, commit = true) => updateObject(obj.value.id, p, { commit })
const collider = computed(() => obj.value?.props?.collider || 'trimesh')
const painter = computed(() => e.value.paint)
const paintConfig = computed(() => obj.value?.props?.meshPaint?.enabled ? obj.value.props.meshPaint : null)
const paintLayers = computed(() => paintConfig.value?.layers || [])
const textures = computed(() => allEntries(store.project).filter((entry) => entry.kind === 'texture'))
const paintUrls = reactive({})
watch([textures, paintLayers], ([entries, layers]) => {
  const ids = new Set([...entries.map((v) => v.id), ...layers.map((v) => v.texture).filter(Boolean)])
  for (const id of ids) if (!paintUrls[id]) assetUrl(id).then((u) => { if (u) paintUrls[id] = u })
}, { immediate: true, deep: true })
const paintSession = () => store.editor?.edit
const togglePaint = () => paintSession()?.paintEnable()
const layerOp = (kind, i, patch) => paintSession()?.paintLayerAction(kind, i, patch)

</script>

<template>
  <div class="mp" data-mesh-inspector
    @pointerenter="!e.globalShortcuts && editSession()?.focusModalInspector({ focusField: false })">
    <section class="mesh-overview">
      <div class="modes" role="group" aria-label="Modo de selección">
        <button v-for="[m, label, k] in modes" :key="m" :class="{ on: e.mode === m }" :aria-pressed="e.mode === m" :aria-label="label" :data-tooltip="`${label} (${k})`" @click="run('mesh.mode.' + m)"><Icon :name="m" :size="14" />{{ label }}</button>
      </div>
      <div class="stats mono">
        <span><small>Vértices</small><b>{{ c.sv }}</b> / {{ c.v }}</span><span><small>Aristas</small><b>{{ c.se }}</b> / {{ c.e }}</span><span><small>Caras</small><b>{{ c.sf }}</b> / {{ c.f }}</span>
      </div>
      <button type="button" class="mesh-shortcuts" :aria-pressed="e.globalShortcuts" aria-keyshortcuts="Control+Alt+M"
        :data-tooltip="e.globalShortcuts ? 'Atajos de malla globales' : 'Atajos de malla solo sobre el visor'"
        @click="editSession()?.toggleGlobalShortcuts()">
        Atajos globales <kbd>Ctrl+Alt+M</kbd>
      </button>
      <p v-if="e.hud" class="hud">{{ e.hud }}</p>
    </section>

    <section v-if="modal" class="modal-settings" aria-label="Ajustes de la operación">
      <header class="operation-header"><Icon name="mesh" :size="14" />{{ modalTitle }}<span>Operación activa</span></header>
      <button v-if="!modal.inspecting" type="button" @click="editSession()?.focusModalInspector()">
        Ajustar en el Inspector <kbd>Tab</kbd>
      </button>
      <form v-else @submit.prevent="modal.canConfirm && editSession()?.modalConfirm()"
        @keydown.esc.prevent.stop="editSession()?.modalCancel()">
        <label v-if="modal.label" class="row">
          <span>{{ modal.label }}</span>
          <input ref="modalField" type="text" inputmode="decimal" :value="modalDraft"
            :aria-invalid="modal.invalid" @input="changeModalDraft($event.target.value)" />
        </label>
        <label v-if="modal.bevelSegments != null" class="row">
          <span>Segmentos del bisel</span>
          <input type="number" inputmode="numeric" min="1" max="32" step="1" required :value="modal.bevelSegments"
            @input="$event.target.validity.valid && editSession()?.setModalBevelSegments($event.target.valueAsNumber)" />
        </label>
        <div v-if="modal.invalid" class="hint" role="status">Introduce un valor válido para esta operación.</div>
        <div class="modal-actions">
          <button v-if="modal.label" type="submit" :disabled="!modal.canConfirm">{{ modal.confirmLabel }}</button>
          <button ref="modalButton" type="button" @click="editSession()?.resumeModalPointer()">Volver al ratón</button>
          <button type="button" @click="editSession()?.modalCancel()">Cancelar</button>
        </div>
      </form>
    </section>

    <section class="sect mesh-section" data-fold-id="mesh-parameters" data-fold-default="closed" :data-fold-force-open="contextualParams ? 'true' : null" :class="{ 'contextual-parameters': contextualParams }">
      <header><Icon name="sliders" :size="14" />{{ contextualParams ? 'Parámetros de la operación' : 'Parámetros' }}</header>
      <div class="body">
      <button v-if="contextualParams" type="button" class="params-toggle" :aria-expanded="showAllParams" @click="showAllParams = !showAllParams">{{ showAllParams ? 'Solo operación activa' : 'Todos los parámetros' }}</button>
      <div class="row" v-show="!contextualParams || showAllParams || props.search.trim()"><span>Inset: grosor</span><NumberField v-model="e.inset.thickness" :step="0.05" :min="0" /></div>
      <div class="row" v-show="!contextualParams || showAllParams || props.search.trim() || paramGroup === 'inset'"><span>Inset: profund.</span><NumberField v-model="e.inset.depth" :step="0.05" /></div>
      <div class="row" v-show="!contextualParams || showAllParams || props.search.trim()"><span>Bisel: ancho</span><NumberField v-model="e.bevel.width" :step="0.02" :min="0.001" /></div>
      <div class="row" v-show="!contextualParams || showAllParams || props.search.trim()"><span>Bisel: segmentos</span><NumberField v-model="e.bevel.segments" :step="1" :min="1" :max="32" :decimals="0" /></div>
      <div class="row" v-show="!contextualParams || showAllParams || props.search.trim() || paramGroup === 'bevel'"><span>Bisel: perfil</span><input type="range" min="0.1" max="1" step="0.05" v-model.number="e.bevel.profile" /></div>
      <div class="row" v-show="!contextualParams || showAllParams || props.search.trim()"><span>Subdividir: cortes</span><NumberField v-model="e.subdivide.cuts" :step="1" :min="1" :max="16" :decimals="0" /></div>
      <div class="row" v-show="!contextualParams || showAllParams || props.search.trim()"><span>Bucle: deslizar</span><input type="range" min="-0.9" max="0.9" step="0.05" v-model.number="e.loopSlide" /></div>
      <div class="row" v-show="!contextualParams || showAllParams || props.search.trim()"><span>Fusionar: distancia</span><NumberField v-model="e.mergeDist" :step="0.001" :min="0" :decimals="4" /></div>
      <div class="row" v-show="!contextualParams || showAllParams || props.search.trim()"><span>Extrusión individual</span><NumberField v-model="e.extrudeIndividual.distance" :step="0.1" /></div>
      <div class="row" v-show="!contextualParams || showAllParams || props.search.trim()"><span>Slide: factor</span><NumberField v-model="e.slide.factor" :step="0.05" :min="-0.95" :max="0.95" /></div>
      <div class="row" v-show="!contextualParams || showAllParams || props.search.trim() || paramGroup === 'slide'"><span>Vertex Slide: eje</span><select v-model="e.slide.axis"><option value="x">X</option><option value="y">Y</option><option value="z">Z</option></select></div>
      <div class="row" v-show="!contextualParams || showAllParams || props.search.trim()"><span>Spin: ángulo</span><NumberField v-model="e.spin.angle" :step="5" :min="-359" :max="359" /></div>
      <div class="row" v-show="!contextualParams || showAllParams || props.search.trim() || paramGroup === 'spin'"><span>Spin: pasos</span><NumberField v-model="e.spin.steps" :step="1" :min="1" :max="128" :decimals="0" /></div>
      <div class="row" v-show="!contextualParams || showAllParams || props.search.trim() || paramGroup === 'spin'"><span>Spin: eje</span><select v-model="e.spin.axis"><option value="x">X</option><option value="y">Y</option><option value="z">Z</option></select></div>
      <div v-for="(axis, i) in ['X','Y','Z']" :key="'spin'+axis" class="row" v-show="!contextualParams || showAllParams || props.search.trim() || paramGroup === 'spin'"><span>Spin centro {{ axis }}</span><NumberField v-model="e.spin.center[i]" :step="0.1" /></div>
      <div class="row" v-show="!contextualParams || showAllParams || props.search.trim()"><span>Shear: factor</span><NumberField v-model="e.shear.factor" :step="0.1" /></div>
      <div class="row" v-show="!contextualParams || showAllParams || props.search.trim() || paramGroup === 'shear'"><span>Shear: eje</span><select v-model="e.shear.axis"><option v-for="a in ['x','y','z']" :key="a" :value="a" :disabled="a === e.shear.reference">{{ a.toUpperCase() }}</option></select></div>
      <div class="row" v-show="!contextualParams || showAllParams || props.search.trim() || paramGroup === 'shear'"><span>Shear: referencia</span><select v-model="e.shear.reference"><option v-for="a in ['x','y','z']" :key="a" :value="a" :disabled="a === e.shear.axis">{{ a.toUpperCase() }}</option></select></div>
          </div>
    </section>
    <section data-testid="mesh-numeric-transform" class="sect mesh-section" data-fold-id="mesh-numeric" data-fold-default="open">
      <header :title="'Geometría · ' + (store.space === 'local' ? 'Local' : 'Global') + ' · Pulsa G para mover, R para rotar y S para escalar'"><Icon name="move" :size="14" />Transformación precisa <span class="dim">{{ store.space === 'local' ? 'Local' : 'Global' }}</span></header>
      <div class="body">
      <template v-if="numericPosition">
        <div class="numeric-title" title="Posición absoluta de un vértice en espacio local">Posición local (m)</div>
        <div class="axis-fields"><div v-for="(ax, i) in numericAxis" :key="'pos' + ax" class="row numeric-row">
          <NumberField :label="ax" :model-value="numericPosition[i]" :step="0.01" :decimals="8" :display-decimals="2" :disabled="!numericEnabled" select-on-focus keep-focus-on-enter
            @update:model-value="numericEdit('position', i, $event)" @commit="numericCommit" />
        </div></div>
      </template>
      <template v-else>
        <div class="numeric-title" title="Desplazamiento relativo; conserva las distancias entre vértices">Desplazamiento (m)</div>
        <div class="axis-fields"><div v-for="(ax, i) in numericAxis" :key="'move' + ax" class="row numeric-row">
          <NumberField :label="ax" :model-value="numericValue('move', i)" :step="0.01" :decimals="8" :display-decimals="2" :disabled="!numericEnabled" select-on-focus keep-focus-on-enter
            @update:model-value="numericEdit('move', i, $event)" @commit="numericCommit" />
        </div></div>
      </template>
      <div class="numeric-title" title="Giro alrededor del centro de selección">Rotación (°)</div>
      <div class="axis-fields"><div v-for="(ax, i) in numericAxis" :key="'rot' + ax" class="row numeric-row">
        <NumberField :label="ax" :model-value="numericValue('rotate', i)" :step="1" :decimals="8" :display-decimals="2" :disabled="!numericEnabled || !numericGroup" select-on-focus keep-focus-on-enter
          @update:model-value="numericEdit('rotate', i, $event)" @commit="numericCommit" />
      </div></div>
      <div class="numeric-title">Escala uniforme (×)</div>
      <div class="row numeric-row uniform-row" data-testid="mesh-uniform-scale">
        <NumberField label="×" :model-value="numericValue('uniformScale', -1)" :step="0.05" :min="0.01" :max="10000" :decimals="8" :display-decimals="2" :disabled="!numericEnabled || !numericGroup" select-on-focus keep-focus-on-enter
          @update:model-value="uniformMeshScale" @commit="numericCommit" />
      </div>
      <div class="numeric-title">Escala por eje (×)</div>
      <div class="axis-fields"><div v-for="(ax, i) in numericAxis" :key="'sca' + ax" class="row numeric-row">
        <NumberField :label="ax" :model-value="numericValue('scale', i)" :step="0.05" :decimals="8" :display-decimals="2" :disabled="!numericEnabled || !numericGroup" select-on-focus keep-focus-on-enter
          @update:model-value="numericEdit('scale', i, $event)" @commit="numericCommit" />
      </div></div>
          </div>
    </section>
    <section v-for="g in groups" :key="g.id" class="sect mesh-section" :data-fold-id="'mesh-' + g.id" :data-fold-default="g.id === 'modeling' ? 'open' : 'closed'">
      <header><Icon :name="g.icon" :size="14" />{{ g.title }}</header>
      <div class="body"><div class="grid">
        <button v-for="[id, label, ic, key] in g.tools" :key="id" :data-tooltip="`${command(id)?.label}${key ? ' (' + key + ')' : ''}`" :disabled="!!e.hud || command(id)?.disabled?.()" @click="sel(id)">
          <Icon :name="ic" :size="14" /><span>{{ label }}</span><kbd v-if="key">{{ key }}</kbd>
        </button>
      </div></div>
    </section>
    <section v-if="generator" data-testid="mesh-primitive-topology" class="sect mesh-section" data-fold-id="mesh-primitive" data-fold-default="closed">
      <header><Icon name="box" :size="14" />Geometría de primitiva</header>
      <div class="body">
      <div v-for="field in generator.fields" :key="field.key" class="row">
        <span>{{ field.label }}</span>
        <input type="number" :aria-label="field.label" :value="generator.params[field.key]" :min="field.min" :max="field.max" step="1"
          :disabled="!!e.hud || !!modal || painter.active" @change="changeGeneratorCount(field.key, $event)" />
      </div>
      <p v-if="generator.modified" class="hint lf-help">La malla tiene ediciones manuales. Regenerar requiere confirmación.</p>
          </div>
    </section>

    <section data-testid="mesh-reduce-faces" class="sect mesh-section" data-fold-id="mesh-reduce" data-fold-default="closed">
      <header><Icon name="mesh" :size="14" />Reducir polígonos</header>
      <div class="body">
      <div class="row">
        <span>Objetivo de caras</span>
        <input type="number" aria-label="Objetivo de caras" min="1" :max="Math.max(1, c.f - 1)" step="1"
          :value="reduceCount == null ? Math.max(1, Math.floor(c.f / 2)) : reduceCount"
          :disabled="c.f < 2 || !!e.hud || !!modal || painter.active"
          @change="reduceCount = $event.target.valueAsNumber" />
      </div>
      <div class="btns"><button type="button" :disabled="c.f < 2 || !!e.hud || !!modal || painter.active" @click="reduceFaces">Reducir</button></div>
          </div>
    </section>

    <section data-testid="mesh-topology-cleanup" class="sect mesh-section" data-fold-id="mesh-cleanup" data-fold-default="closed">
      <header><Icon name="mesh" :size="14" />Limpiar geometría</header>
      <div class="body">
      <div v-if="cleanReport" class="hint lf-help" role="status">
        {{ cleanReport.looseVertices }} vértices aislados · {{ cleanReport.wireEdges }} aristas sueltas · {{ cleanReport.duplicateWires + cleanReport.redundantWires + cleanReport.invalidWires }} aristas redundantes · {{ cleanReport.invalidFaces ?? '—' }} caras a revisar · {{ cleanReport.tJunctions ?? '—' }} uniones en T · {{ cleanReport.nonManifoldEdges }} aristas no manifold
      </div>
      <label class="chk"><input v-model="cleanSettings.removeLooseEdges" type="checkbox" /> Eliminar aristas sueltas</label>
      <label class="chk"><input v-model="cleanSettings.removeLooseVertices" type="checkbox" /> Eliminar vértices aislados</label>
      <label class="chk"><input v-model="cleanSettings.removeDuplicateWires" type="checkbox" /> Eliminar aristas duplicadas</label>
      <label class="chk"><input v-model="cleanSettings.weldVertices" type="checkbox" /> Unir vértices próximos</label>
      <div v-if="cleanSettings.weldVertices" class="row">
        <span>Tolerancia (m)</span><input v-model.number="cleanSettings.tolerance" type="number" step="0.0001" min="0.000001" max="0.01" aria-label="Tolerancia de limpieza (m)" />
      </div>
      <div class="btns"><button type="button" :disabled="!!e.hud || !!modal || painter.active || !cleanReport" @click="cleanTopology">Limpiar</button></div>
          </div>
    </section>

    <section data-testid="mesh-vertex-draw" class="sect mesh-section" data-fold-id="mesh-vertex-draw" data-fold-default="closed">
      <header><Icon name="vertex" :size="14" />Construcción desde vértices</header>
      <div class="body">
      <div class="two">
        <button :class="{ on: e.vertexDraw }" :disabled="!!e.hud || painter.active" @click="drawVertex"><Icon name="vertex" :size="14" />{{ e.vertexDraw ? 'Terminar trazado' : 'Colocar vértice' }}</button>
        <button :disabled="e.mode !== 'vertex' || c.sv !== 2 || !!e.hud" @click="connectVerts">Conectar dos puntos</button>
      </div>
      <div class="vertex-planes" data-tooltip="Plano por el vértice activo; respeta Global/Local y Snap." role="group" aria-label="Plano para colocar vértices">
        <span>Plano de construcción</span>
        <div class="modes">
          <button v-for="plane in ['XZ', 'XY', 'YZ']" :key="plane" :class="{ on: e.vertexPlane === plane }"
            :aria-pressed="e.vertexPlane === plane" :disabled="!!e.hud || painter.active" @click="setVertexPlane(plane)">{{ plane }}</button>
        </div>
      </div>
      <button class="vertex-close" data-tooltip="Selecciona un extremo de la cadena para cerrarla." :disabled="e.mode !== 'vertex' || c.sv !== 1 || !!e.hud" @click="closeVerts">Cerrar contorno desde el extremo seleccionado</button>
          </div>
    </section>





    <section data-testid="mesh-vertex-paint" class="sect mesh-section" data-fold-id="mesh-vertex-paint" data-fold-default="closed">
      <header><Icon name="brush" :size="14" />Vertex Paint · {{ paintLayers.length }}/{{ MAX_LAYERS }} capas</header>
      <div class="body">
      <button class="paint-toggle" data-tooltip="Clic pinta; Ctrl + clic borra peso. No subdivide la malla." :class="{ on: painter.active }" :disabled="!!e.hud" @click="togglePaint">
        {{ painter.active ? 'Desactivar pincel' : paintConfig ? 'Activar pincel' : 'Activar Vertex Paint' }}
      </button>
      <template v-if="paintConfig">
        <div class="row"><span>Radio (m)</span><NumberField v-model="painter.radius" :min="0.01" :max="100" :step="0.1" /></div>
        <div class="row"><span>Intensidad</span><input type="range" v-model.number="painter.strength" min="0" max="1" step="0.05" /><b class="mono">{{ painter.strength.toFixed(2) }}</b></div>
        <div class="row"><span>Dureza</span><input type="range" v-model.number="painter.hardness" min="0" max="1" step="0.05" /><b class="mono">{{ painter.hardness.toFixed(2) }}</b></div>
        <div v-for="(layer, i) in paintLayers" :key="i" class="vp-layer" :class="{ on: painter.layer === i }">
          <button class="vp-swatch" :style="{ background: layer.color }" :title="'Seleccionar ' + layer.name" @click="painter.layer = i">
            <img v-if="layer.texture && paintUrls[layer.texture]" :src="paintUrls[layer.texture]" alt="" />
          </button>
          <div class="vp-layer-data">
            <input type="text" :value="layer.name" :aria-label="'Nombre capa '+(i+1)" @change="layerOp('update',i,{name:$event.target.value})" />
            <div class="vp-layer-controls">
              <ColorInput :value="layer.color" :aria-label="'Color capa '+(i+1)" @change="layerOp('update',i,{color:$event.target.value})" />
              <select :value="layer.texture || ''" :aria-label="'Textura capa '+(i+1)" @change="layerOp('update',i,{texture:$event.target.value || null})">
                <option value="">Solo color</option>
                <option v-for="t in textures" :key="t.id" :value="t.id">{{ t.file }}</option>
              </select>
            </div>
            <div class="row"><span>Tile (m)</span><input type="number" :value="layer.tile" min="0.1" max="512" step="0.25" @change="layerOp('update',i,{tile:Number($event.target.value)})" /></div>
          </div>
          <div class="vp-actions">
            <button class="ghost" :disabled="i===0" title="Subir capa" @click="layerOp('up',i)">↑</button>
            <button class="ghost" :disabled="i===paintLayers.length-1" title="Bajar capa" @click="layerOp('down',i)">↓</button>
            <button class="ghost" :disabled="paintLayers.length===1" title="Eliminar capa" @click="layerOp('remove',i)">×</button>
          </div>
        </div>
        <button :disabled="paintLayers.length >= MAX_LAYERS || !!e.hud" @click="layerOp('add')">Añadir capa</button>
      </template>
          </div>
    </section>

    <section data-testid="mesh-uv-panel" class="sect mesh-section" data-fold-id="mesh-uv" data-fold-default="closed">
      <header><Icon name="mesh-grid" :size="14" />UV Editing</header>
      <div class="body">
      <p v-if="c.f > 2500" class="hint lf-help">Vista previa limitada a 2500 caras para mantener el rendimiento; las herramientas siguen aplicándose a la selección completa.</p>
      <p v-if="uvView.invalid" role="alert" class="hint">Coordenadas UV inválidas. No se puede mostrar el mapa.</p>
      <svg class="uv-map" data-tooltip="Arrastra para mover UV. Sin selección se modifican todas las caras visibles." viewBox="0 0 300 300" aria-label="Mapa UV de la malla" @pointerdown="uvDown" @pointerup="uvUp" @pointercancel="uvStart = null" @lostpointercapture="uvStart = null">
        <rect x="0" y="0" width="300" height="300" fill="#161c25" />
        <g stroke="#3d4756" stroke-width="0.6">
          <line v-for="i in 11" :key="'u'+i" :x1="(i-1)*30" :x2="(i-1)*30" y1="0" y2="300" />
          <line v-for="i in 11" :key="'v'+i" x1="0" x2="300" :y1="(i-1)*30" :y2="(i-1)*30" />
        </g>
        <polygon v-for="f in uvView.polygons" :key="f.id" :points="f.points" :fill="f.selected ? '#3283b94d' : '#b4bec61b'" :stroke="f.selected ? '#4db7ff' : '#a2abb8'" stroke-width="1.4" />
      </svg>
      <div class="row"><span>Plano UV</span><select v-model="uvAxis"><option value="x">X</option><option value="y">Y</option><option value="z">Z</option></select></div>
      <div class="two">
        <button :disabled="!!e.hud" @click="uvRun('planar', { axis: uvAxis })">Proyección plana</button>
        <button :disabled="!!e.hud" @click="uvRun('box')">Proyección caja</button>
      </div>
      <div class="row"><span>Rotación UV (°)</span><NumberField v-model="uvAngle" :step="5" /></div>
      <div class="row"><span>Escala UV</span><NumberField v-model="uvScale" :step="0.1" :min="0.01" /></div>
      <div class="two">
        <button :disabled="!!e.hud" @click="uvRun('rotate', { angle: uvAngle })">Rotar UV</button>
        <button :disabled="!!e.hud" @click="uvRun('scale', { factor: uvScale })">Escalar UV</button>
      </div>
      <div class="two">
        <button :disabled="!!e.hud || !c.se" @click="uvRun('seam')">Marcar costura</button>
        <button :disabled="!!e.hud || !c.se" @click="uvRun('clearSeam')">Quitar costura</button>
      </div>
          </div>
    </section>

    <!-- Pivote: dónde queda el origen del objeto respecto a los límites de la malla (-1 mínimo · 0 centro · 1 máximo) -->
    <section data-testid="mesh-pivot" class="sect mesh-section" data-fold-id="mesh-pivot" data-fold-default="closed">
      <header><Icon name="move" :size="14" />Pivote</header>
      <div class="body">
      <div v-for="(ax, k) in ['X', 'Y', 'Z']" :key="ax" class="row piv">
        <span>{{ ax }} <i class="dim mono">{{ pivNow[k] == null ? '—' : (+pivNow[k].toFixed(2)) }}</i></span>
        <div class="seg">
          <button v-for="v in [-1, 0, 1]" :key="v" :class="{ on: pivNow[k] != null && Math.abs(pivNow[k] - v) < 1e-3 }" :data-testid="`pivot-${ax.toLowerCase()}${v}`" :disabled="!!e.hud || pivNow[k] == null" @click="setPivot(k, v)">{{ v > 0 ? '+1' : v }}</button>
        </div>
      </div>
      <div class="two">
        <button :disabled="!!e.hud" data-testid="pivot-center" @click="pivotAll([0, 0, 0])">Centro</button>
        <button :disabled="!!e.hud" data-testid="pivot-base" @click="pivotAll([0, -1, 0])">Base (pies)</button>
      </div>
          </div>
    </section>



    <section class="sect mesh-section" data-fold-id="mesh-options" data-fold-default="closed">
      <header><Icon name="sliders" :size="14" />Opciones de edición</header>
      <div class="body">
      <label class="chk"><input type="checkbox" :checked="e.proportional" @change="run('mesh.proportional')" /> Edición proporcional <kbd>O</kbd></label>
      <div v-if="e.proportional" class="sub">
        <div class="row"><span>Radio</span><NumberField v-model="e.propSize" :step="0.1" :min="0.05" /></div>
        <div class="row"><span>Caída</span>
          <select v-model="e.falloff">
            <option value="smooth">Suave</option><option value="sphere">Esfera</option><option value="root">Raíz</option>
            <option value="linear">Lineal</option><option value="sharp">Aguda</option><option value="constant">Constante</option>
          </select>
        </div>
      </div>
      <label class="chk"><input type="checkbox" :checked="e.mirrorX" @change="run('mesh.mirror')" /> Simetría en X</label>
      <label class="chk"><input type="checkbox" :checked="e.xray" @change="run('mesh.xray')" /> Transparencia (X-ray) <kbd>Alt Z</kbd></label>
      <label class="chk"><input type="checkbox" :checked="e.showNormals" @change="run('mesh.normals')" /> Mostrar normales</label>
      <div class="btns">
        <button :disabled="!!e.hud" @click="run('mesh.hide')">Ocultar <kbd>H</kbd></button>
        <button :disabled="!!e.hud" @click="run('mesh.reveal')">Mostrar <kbd>Alt H</kbd></button>
      </div>
          </div>
    </section>

    <section v-if="obj" class="sect mesh-section" data-fold-id="mesh-collision" data-fold-default="closed">
      <header><Icon name="static-body" :size="14" />Física de la malla</header>
      <div class="body">
      <label class="chk"><input type="checkbox" :checked="obj.collision" @change="patch({ collision: $event.target.checked })" /> Colisión</label>
      <div class="row"><span>Forma</span>
        <select :value="collider" @change="patch({ props: { collider: $event.target.value } })">
          <option value="trimesh">Exacta (trimesh) — nivel / estático</option>
          <option value="convex">Convexa — objetos simples</option>
          <option value="none">Ninguna</option>
        </select>
      </div>
          </div>
    </section>
  </div>
</template>

<style scoped>
.modal-settings .row input { width: 100%; min-width: 0; }
.modal-actions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.mp { display: flex; flex-direction: column; gap: 3px; min-width: 0; container-type: inline-size; }
.mesh-overview, .modal-settings { padding: 6px; min-width: 0; }
.mesh-section { border: 0; border-radius: 4px; background: transparent; min-width: 0; }
.mesh-section > header { overflow: hidden; text-overflow: ellipsis; }
.mesh-section > .body { padding: 7px 6px; min-width: 0; }
.operation-header { display: flex; align-items: center; gap: 6px; font-weight: 600; margin-bottom: 6px; color: var(--text); }
.operation-header span { margin-left: auto; font-size: 10px; font-weight: 400; color: var(--text-3); }
.modal-settings { border: 1px solid var(--blue); border-radius: 4px; }
.params-toggle { width: 100%; margin-bottom: 6px; }

.mesh-section .body > :last-child { margin-bottom: 0; }
.mp button:focus-visible { outline: 1px solid var(--blue); outline-offset: -1px; }
.modes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; }
.modes button { height: 28px; gap: 3px; font-size: 11px; padding: 0 3px; min-width: 0; }
.modes button.on { background: var(--amber-wash); border-color: var(--amber-edge); color: var(--amber); }
.mesh-shortcuts { margin-top: 5px; gap: 5px; }
.mesh-shortcuts[aria-pressed='true'] { background: var(--amber-wash); border-color: var(--amber-edge); color: var(--amber); }
.stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; margin: 6px 0 2px; color: var(--text-3); font-size: 11px; text-align: center; }
.stats span { background: var(--g-900); border-radius: 3px; padding: 4px 2px; min-width: 0; overflow-wrap: anywhere; }
.stats small { display: block; font-size: 10px; margin-bottom: 2px; }
.stats b { color: var(--amber); font-weight: 600; }
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; }
.grid button { height: 26px; justify-content: flex-start; gap: 6px; padding: 0 7px; font-size: 11px; min-width: 0; }
.grid button span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.grid button kbd { flex: none; font-size: 9px; padding: 0 2px; color: var(--text-3); }
.grid button svg { flex: none; }
.row { display: grid; grid-template-columns: minmax(0, 42%) minmax(0, 1fr); align-items: center; gap: 8px; margin-bottom: 5px; }
.row > span { color: var(--text-3); font-size: 11.5px; }
.numeric-title { margin: 10px 0 5px; font-size: 11px; color: var(--text-2); font-weight: 600; }
.axis-fields { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 3px; }
.numeric-row { display: flex; min-width: 0; margin-bottom: 2px; }
.axis-fields .numeric-row :deep(.lbl) { min-width: 14px; padding: 0 3px; }
.axis-fields .numeric-row :deep(input) { padding: 3px; font-size: 11px; }
.axis-fields .numeric-row:nth-child(1) :deep(.lbl) { color: var(--inspector-axis-x); }
.axis-fields .numeric-row:nth-child(2) :deep(.lbl) { color: var(--inspector-axis-y); }
.axis-fields .numeric-row:nth-child(3) :deep(.lbl) { color: var(--inspector-axis-z); }
.uniform-row { margin-left: 0; }
.row > :not(span) { min-width: 0; max-width: 100%; }
.row > span { overflow-wrap: anywhere; }
@container (max-width: 245px) { .grid { grid-template-columns: minmax(0, 1fr); } .modes button { font-size: 10px; } .modes button svg { display: none; } .axis-fields { grid-template-columns: minmax(0, 1fr); } .two { grid-template-columns: minmax(0, 1fr); } }

.sub { padding-left: 18px; }
.chk { display: flex; align-items: center; gap: 7px; margin: 4px 0; font-size: 12px; cursor: default; }
.btns { display: flex; gap: 5px; margin-top: 8px; }
.btns button { flex: 1; font-size: 11px; min-width: 0; white-space: normal; height: auto; min-height: 26px; }
.vertex-planes { display: flex; flex-direction: column; gap: 5px; margin-top: 8px; font-size: 11px; color: var(--text-2); }
.vertex-planes .modes { justify-content: stretch; }
.vertex-planes .modes button { flex: 1; }
.hint { margin: 7px 0 0; font-size: 11px; color: var(--text-3); line-height: 1.45; }
.hud { margin: 8px 0 0; padding: 5px 7px; border-radius: 5px; background: var(--amber-wash); border: 1px solid var(--amber-edge); color: var(--amber); font-size: 11.5px; line-height: 1.4; }
kbd, code { font-family: var(--font); font-size: 10px; background: var(--g-950); border: 1px solid var(--hair); border-radius: 3px; padding: 0 4px; }
.piv .seg { justify-self: stretch; display: flex; border: 1px solid var(--hair); border-radius: 5px; overflow: hidden; }
.piv .seg button { flex: 1; min-width: 0; border: 0; border-radius: 0; height: 22px; padding: 0 6px; background: transparent; font-variant-numeric: tabular-nums; }
.piv .seg button.on { background: var(--blue, #3d8bd6); color: #fff; }
.piv .dim { font-style: normal; color: var(--text-3); font-size: 10.5px; margin-left: 4px; }
.uv-map { display: block; width: 100%; max-height: 300px; margin: 8px 0; border: 1px solid var(--hair); border-radius: 4px; cursor: grab; touch-action: none; }
.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; margin-top: 6px; }
.vertex-close { display: block; width: 100%; height: auto; min-height: 26px; white-space: normal; margin-top: 5px; font-size: 11px; }
.two button { min-width: 0; height: auto; min-height: 26px; white-space: normal; }
.paint-toggle { width: 100%; margin: 0 0 6px; }
.paint-toggle.on { border-color: var(--amber-edge); background: var(--amber-wash); color: var(--amber); }
.vp-layer { display:flex; align-items:flex-start; gap:5px; padding:6px 0; border-bottom:1px solid var(--hair); }
.vp-layer.on { background:var(--amber-wash); }
.vp-swatch { width:32px; min-width:32px; height:32px; padding:0; overflow:hidden; border:1px solid var(--hair); }
.vp-swatch img { width:100%; height:100%; object-fit:cover; }
.vp-layer-data { min-width:0; flex:1; }
.vp-layer-data > input { width:100%; }
.vp-layer-controls { display:flex; gap:4px; margin-top:4px; }
.vp-layer-controls  :deep(.lf-color-input) { width:32px; min-width:32px; height:26px; padding:1px; }
.vp-layer-controls select { min-width:0; flex:1; width:100%; }
.vp-layer-data .row { margin-top:5px; margin-bottom:0; }
.vp-layer-data .row input { min-width:0; width:100%; }
.vp-actions { display:flex; flex-direction:column; gap:2px; }
.vp-actions button { padding:0 4px; min-width:20px; height:20px; }
</style>
