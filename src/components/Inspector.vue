<script setup>
import FluidContainerPanel from './FluidContainerPanel.vue'
import { ROLE_OPTIONS, SYSTEM_ROLE, systemCode } from '../engine/runtime/ui/system.js'
import { computed, ref, watch, inject } from 'vue'
import { store, commit as commitTimelineKey, getObject, updateObject, addNodeScript, removeNodeScript, moveNodeScript, setNodeScriptEditableField, authoredNodeScriptIds, openEventEditor, removeObject, duplicateObject, groupSelected, duplicateSelected, linkedDuplicateSelected, makeMeshIndependent, removeSelected, pathOf, prefabOf, applyToPrefab, revertInstance, unpackInstance, createPrefab } from '../core/store.js'
import { PRIMITIVES } from '../engine/runtime/geometry/primitives.js'
import { meshDataOf } from '../engine/runtime/mesh/shared-mesh.js'
import { isMeshSubtractSourceCandidate, meshSubtractSourceOf, meshSubtractSourcePoly } from '../engine/runtime/mesh/mesh-subtract-source.js'
import { nearestMeshParent, nodeEffectiveActive } from '../engine/runtime/nodes/hierarchy.js'
import { askConfirm } from '../core/dialogs.js'
import { validStairSidesTurn, normalizeStairTurn, stairSideOptions } from '../engine/runtime/mesh/generators.js'
import { kindLabel, kindIcon, getDef, LIGHT_TYPES } from '../engine/runtime/nodes/index.js'
import { newPhysicsShape } from '../engine/runtime/physics/shapes.js'
import { triMeshSources } from '../engine/runtime/physics/trimesh-source.js'
import { hasBoxFitGeometry } from '../engine/runtime/physics/box-fit-editor.js'
import { fitBoxShapeNow, beginUniformScale, applyUniformScale, finishUniformScale, cancelUniformScale } from '../core/state/objects.js'
import { LIGHT_STYLES } from '../engine/runtime/render/lightfx.js'
import { TEXT_FONTS } from '../engine/runtime/geometry/text3d.js'
import { NEON_LIGHTS } from '../engine/runtime/nodes/text.js'
import NumberField from './NumberField.vue'
import TextField from './TextField.vue'
import InteractionZonesPanel from './InteractionZonesPanel.vue'
import Vec3Field from './Vec3Field.vue'
import TerrainPanel from './TerrainPanel.vue'
import WaterPanel from './WaterPanel.vue'
import RoadPanel from './RoadPanel.vue'
import Icon from './Icon.vue'
import TagLayerRow from './TagLayerRow.vue'
import ProfileSlot from './ProfileSlot.vue'
import ResourceDropSlot from './ResourceDropSlot.vue'
import ParamForm from './ParamForm.vue'
import SpriteSection from './SpriteSection.vue'
import ScenePanel from './ScenePanel.vue'
import AudioMixerInspector from './AudioMixerInspector.vue'
import { renamePiece, setPieceVisible, switchScene } from '../core/store.js'
import { getSpecies, SPECIES_LIST, normalizeCritter } from '../engine/runtime/critters/index.js'
import MaterialSection from './MaterialSection.vue'
import ModelMaterialSection from './ModelMaterialSection.vue'
import { normalizeLight, LIGHT_MODES, SHADOW_RES } from '../engine/runtime/render/lightlib.js'
import { GI_MODES, giOf } from '../engine/runtime/bake/config.js'
import { OCCLUSION_NODE_TYPES, isOcclusionStatic } from '../engine/runtime/render/occlusion-static.js'
import { sharedValue, canEditShared, updateSharedSelection } from '../core/state/multi-inspector.js'
import { normalizeSource, AUDIO_EXT, ROLLOFFS } from '../engine/runtime/audio/config.js'
import { hasAudio } from '../engine/runtime/audio/host.js'
import { createUi, openUiEditor, openScriptEditor, toast } from '../core/store.js'
import { CANVAS_TEMPLATE } from '../engine/runtime/ui/defaults.js'
import { hasAssetEntry, nodeScriptFromDrop } from '../core/editor/script-drop.js'
import { previewClip, stopPreview, bakeNavigation, cancelNavBake, clearNavigation } from '../core/store.js'
import { nodeAnimationProperty } from '../engine/runtime/anim/model.js'
import { analyzeScriptEditables } from '../engine/runtime/scene/script-editables.js'
import { findTimelineNodePropertyTrack, isFilmMakerTimeline, readTimelineNodeProperty, upsertTimelineNodePropertyKey } from '../core/timeline/model.js'
import { timelinePlaybackKey } from '../core/timeline/playback-session.js'
import PropertyKey from './PropertyKey.vue'
import NodePicker from './NodePicker.vue'
const giTypes = ['primitive', 'mesh', 'model', 'road', 'text']

const audioContext = computed(() => store.audioInspector && store.project?.audio?.groups?.some(g=>g.id===store.audioInspector.groupId))
const multi = computed(() => store.selectedIds.length > 1)
const multiNodes = computed(() => store.selectedIds.map(getObject).filter(Boolean))
const multiCommon = (key, axis) => sharedValue(multiNodes.value, key, axis)
const multiMaterial = computed(() => multiNodes.value.every(n => ['primitive','mesh','model','road','text','nature'].includes(n.type)))
const multiWritable = computed(() => !store.locked && !store.edit.on && multiNodes.value.every(n => {
  if (n.locked || n.sceneInstanceOwner) return false
  for (let parent = getObject(n.parentId); parent; parent = getObject(parent.parentId)) if (parent.locked) return false
  return true
}))
const multiCan = key => canEditShared(multiNodes.value, key)
function setShared(key, value, axis) {
  if (!updateSharedSelection([...store.selectedIds], key, value, { axis })) toast('No se pudo aplicar la propiedad a toda la selección', 'warn')
}
function editSharedScalar(key, event) {
  if (event.target.value === '') return
  const value = Number(event.target.value)
  if (Number.isFinite(value)) setShared(key, value)
}
function editSharedAxis(key, axis, value) {
  if (Number.isFinite(value)) setShared(key, value, axis)
}

const obj = computed(() => getObject(store.selectedId))
const sceneSource = computed(() => store.project?.scenes.find(s => s.id === (obj.value?.props?.sceneId || obj.value?.sceneSourceSceneId)))
const terrainName = ref('')
watch(() => [obj.value?.id, obj.value?.name], ([, name]) => { terrainName.value = name || '' }, { immediate: true })
const link = computed(() => (obj.value?.type === 'primitive' ? PRIMITIVES[obj.value.kind]?.link : null))
const scalable = computed(() => !!obj.value && !!getDef(obj.value.type)?.scalable)
// El contexto del Editor es la única fuente del tiempo y del recurso; Inspector no crea transporte.
const timelinePlayback = inject(timelinePlaybackKey, null)
const editableTimeline = computed(() => (store.project?.timelines || [])
  .find(t => t.id === store.timelineId && !isFilmMakerTimeline(t)) || null)
const inspectorKeying = computed(() => !!editableTimeline.value && !!timelinePlayback &&
  store.prefs.bottomTab === 'timeline' && !store.locked && !store.play.on && !store.filmMode &&
  !timelinePlayback.playing.value)
function inspectorKeyable(prop) { return inspectorKeying.value && !!nodeAnimationProperty(obj.value, prop) }
function inspectorKeyMarked(prop) {
  if (!inspectorKeyable(prop)) return false
  const track = findTimelineNodePropertyTrack(editableTimeline.value, obj.value, prop,
    store.project.activeSceneId, store.project.objects || [])
  return !!track?.keys.some(key => Math.abs(key.t - timelinePlayback.time.value) <= 0.000001)
}
function inspectorInsertKey(prop) {
  if (!inspectorKeyable(prop)) return
  const timeline = editableTimeline.value, node = obj.value, sceneId = store.project.activeSceneId
  if (!timeline || !node || !store.project.objects.includes(node)) return
  try {
    const result = upsertTimelineNodePropertyKey(timeline, node, prop, sceneId,
      store.project.objects, timelinePlayback.time.value, readTimelineNodeProperty(node, prop))
    if (result.changed) {
      timelinePlayback.yieldToEditing()
      commitTimelineKey(result.updated ? 'Actualizar clave de propiedad' : 'Insertar clave de propiedad')
      store.temporalEditRevision++
    }
  } catch (error) { toast(error.message, 'error') }
}
const title = computed(() => (obj.value ? kindLabel(obj.value) : ''))
const icon = computed(() => (obj.value ? kindIcon(obj.value) : 'box'))
const hasMaterial = computed(() => ['primitive', 'mesh', 'text', 'model'].includes(obj.value?.type))
const subtractReceiverOptions = computed(() => (store.project?.objects || []).filter(node =>
  node.id !== obj.value?.id && (node.type === 'primitive' || node.type === 'mesh'))
  .map(node => ({ id: node.id, label: node.name, detail: pathOf(node.id), icon: kindIcon(node) })))
const subtractExplicitReceiver = computed(() => {
  const id = String(obj.value?.props?.receiverId || '').trim()
  return id ? (store.project?.objects || []).find(node => node.id === id && (node.type === 'primitive' || node.type === 'mesh')) || null : null
})
const subtractReceiver = computed(() => subtractExplicitReceiver.value || nearestMeshParent(store.project?.objects, obj.value))
const subtractMeshPartner = computed(() => {
  if (obj.value?.type !== 'subtract' || !subtractReceiver.value) return null
  const objects = store.project?.objects || []
  return objects.find(node => node.type === 'meshSubtract' && nodeEffectiveActive(objects, node) &&
    meshSubtractSourceOf(node, objects).source?.id === subtractReceiver.value.id &&
    nearestMeshParent(objects, node)?.id === subtractReceiver.value.id) || null
})
const subtractComposesWithMesh = computed(() => obj.value?.props?.composeWithMeshSubtract === true && !!subtractMeshPartner.value)
const meshSubtractSources = computed(() => (store.project?.objects || []).filter(o =>
  o.id !== obj.value?.id && isMeshSubtractSourceCandidate(o)))
const meshSubtractSourceOptions = computed(() => meshSubtractSources.value.map(node => ({
  id: node.id, label: node.name,
  detail: `${pathOf(node.id)}${node.type === 'collisionshape3d' ? ' · TriMeshShape3D' : ''}`,
  icon: kindIcon(node),
})))
const meshSubtractSelection = computed(() => meshSubtractSourceOf(obj.value, store.project?.objects || []))
const meshSubtractSelfHollow = computed(() => !!meshSubtractSelection.value.source &&
  meshSubtractSelection.value.source.id === subtractReceiver.value?.id)
const meshSubtractError = computed(() => {
  if (obj.value?.type !== 'meshSubtract') return ''
  const selection = meshSubtractSelection.value
  return meshSubtractSourcePoly(selection.source, store.project?.meshes || []).error
})
const decalTargets = computed(() => (store.project?.objects || []).filter((o) => o.id !== obj.value?.id && ['primitive', 'mesh', 'model'].includes(o.type)))
const decalImages = computed(() => (store.project?.assets || []).filter((a) => a.kind === 'texture'))
const decalImageIds = computed(() => decalImages.value.map((a) => a.id))
const editable = computed(() => ['primitive', 'mesh'].includes(obj.value?.type) && store.selectedIds.length === 1)
const currentMesh = computed(() => meshDataOf(obj.value, store.project?.meshes))
const prefab = computed(() => (obj.value?.prefabId ? prefabOf(obj.value.prefabId) : null))
function showPrefab() { store.prefs.bottomTab = 'project'; store.projFolder = prefab.value.folder; store.projSel = { kind: 'prefab', id: prefab.value.id } }

const aq = computed(() => normalizeSource(obj.value?.type === 'light' ? obj.value.light?.audio || {} : obj.value?.props || {}))
const audioHost = computed(() => hasAudio(obj.value))
const audioAssets = computed(() => (store.project?.assets || []).filter((a) => ['audio', 'file'].includes(a.kind) && AUDIO_EXT.includes((a.ext || a.name.split('.').pop() || '').toLowerCase())))
const liquidProfiles=computed(()=>(store.project?.liquids||[]))
const liquidContainer=computed(()=>obj.value?.props?.liquidContainer||{})
const setContainer=(patch)=>upd({props:{liquidContainer:{...liquidContainer.value,...patch}}})
const liquidCapacity=computed(()=>{const [x,y,z]=liquidContainer.value.size||[0.09,0.12,0.09];return liquidContainer.value.shape==='box'?x*y*z:Math.PI*x*z*y/4})
const audioAssetIds = computed(() => audioAssets.value.map((a) => a.id))
const sp = (key, v, commit = false) => upd(obj.value.type === 'light' ? { light: { audio: { ...(obj.value.light.audio || {}), [key]: v } } } : { props: { [key]: v } }, commit)
const lq = computed(() => normalizeLight(obj.value?.light || {}))
const upd = (patch, commit = true) => updateObject(obj.value.id, patch, { commit })
async function restoreSubtractShape() {
  const current = obj.value
  if (!current || current.type !== 'subtract' || !current.props?.mesh) return
  if (store.edit.on && store.edit.id === current.id) { toast('Sal de Edit Mesh antes de restaurar el volumen', 'info'); return }
  const ok = await askConfirm('Se perderá la geometría personalizada de Substract y se restaurará su volumen predefinido. Puedes deshacer con Ctrl+Z.', { title: 'Restaurar volumen de Substract', ok: 'Restaurar', danger: true })
  if (ok && obj.value?.id === current.id) updateObject(current.id, { props: { mesh: null } }, { label: 'Restaurar forma de Substract' })
}

const vec = (key, { value, commit }) => upd({ [key]: value }, commit)
const uniformFactor = ref(1)
let uniformDraft = null
function previewUniformScale(factor) {
  if (!uniformDraft) uniformDraft = beginUniformScale([obj.value?.id].filter(Boolean))
  if (!uniformDraft) { toast('No se puede escalar este nodo', 'error'); return }
  if (!applyUniformScale(uniformDraft, factor)) {
    cancelUniformScale(uniformDraft)
    uniformDraft = null
    uniformFactor.value = 1
    toast('Factor incompatible con la escala o la física del nodo', 'error')
    return
  }
  uniformFactor.value = factor
}
function confirmUniformScale() {
  if (uniformDraft) finishUniformScale(uniformDraft)
  uniformDraft = null
  uniformFactor.value = 1
}
watch(() => obj.value?.id, () => {
  if (uniformDraft) cancelUniformScale(uniformDraft)
  uniformDraft = null
  uniformFactor.value = 1
})
const setNum = (path, v) => {
  const [a, b] = path.split('.')
  upd(b ? { [a]: { [b]: v } } : { [a]: v }, false)
}
const commitNum = () => upd({}, true)
const stairSideRejected = ref(false)
const stairTurnInvalid = computed(() => obj.value?.kind === 'stairs' && !validStairSidesTurn(normalizeStairTurn(obj.value.props?.turn ?? 0), Math.abs(obj.value.scale[0]), Math.abs(obj.value.scale[2]), obj.value.props))
function setStairTurn(value) {
  const turn = normalizeStairTurn(value)
  if (!validStairSidesTurn(turn, Math.abs(obj.value.scale[0]), Math.abs(obj.value.scale[2]), obj.value.props)) { stairSideRejected.value = true; return }
  stairSideRejected.value = false
  upd({ props: { turn } }, false)
}
function setStairSide(key, value) {
  const props = { ...obj.value.props, [key]: value }
  const normalized = stairSideOptions(props)
  if (!validStairSidesTurn(normalizeStairTurn(props.turn ?? 0), Math.abs(obj.value.scale[0]), Math.abs(obj.value.scale[2]), normalized)) { stairSideRejected.value = true; return }
  stairSideRejected.value = false
  upd({ props: { [key]: normalized[key] } }, false)
}
const vecCollider = (key, { value, commit }) => upd({ props: { [key]: value } }, commit)
// Funciones definidas en los scripts del proyecto con game.define("nombre", …): sugerencias para los slots del Trigger.
const nodeScriptOptions = computed(() => (store.project?.scripts || []).filter((s) => s.execution === 'node'))
const assignedScriptIds = computed(() => authoredNodeScriptIds(obj.value))
const scriptById = computed(() => new Map((store.project?.scripts || []).map((s) => [s.id, s])))
const availableNodeScripts = computed(() => nodeScriptOptions.value.filter((s) => !assignedScriptIds.value.includes(s.id)))
const scriptEditables = computed(() => new Map(assignedScriptIds.value.map(id => {
  const script = scriptById.value.get(id)
  return [id, script?.execution === 'node' ? analyzeScriptEditables(script.code) : { fields: [], diagnostics: [] }]
})))
function editableDisplayValue(scriptId, field) {
  const saved = obj.value?.scriptProperties?.[scriptId]
  const value = saved && Object.hasOwn(saved, field.name) ? saved[field.name] : field.defaultValue
  return typeof value === field.type && (field.type !== 'number' || Number.isFinite(value)) ? value : field.defaultValue
}
function updateScriptEditable(scriptId, field, raw) {
  const value = field.type === 'boolean' ? raw : field.type === 'number' ? (raw.trim() === '' ? NaN : Number(raw)) : raw
  if (field.type === 'number' && !Number.isFinite(value)) return
  setNodeScriptEditableField(obj.value?.id, scriptId, field.name, value)
}
function showEditableHeader(fields, index) {
  return fields[index]?.header !== null && (index === 0 || fields[index]?.groupOrder !== fields[index - 1]?.groupOrder)
}

const scriptSelect = ref(null)
const scriptDragOver = ref(false)
const reorderingScript = ref(null)
function assignSelectedScript(id) {
  if (!id) return
  addNodeScript(obj.value.id, id)
  if (scriptSelect.value) scriptSelect.value.value = ''
}
function onScriptSortStart(event, index) {
  reorderingScript.value = index
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', assignedScriptIds.value[index])
}
function onScriptSortDrop(event, index) {
  if (reorderingScript.value === null) return
  event.preventDefault()
  event.stopPropagation()
  moveNodeScript(obj.value.id, reorderingScript.value, index)
  reorderingScript.value = null
}
function onScriptDragOver(event) {
  if (!hasAssetEntry(event.dataTransfer)) return
  event.preventDefault()
  event.dataTransfer.dropEffect = 'copy'
  scriptDragOver.value = true
}
function onScriptDrop(event) {
  event.preventDefault()
  event.stopPropagation()
  scriptDragOver.value = false
  const script = nodeScriptFromDrop(event.dataTransfer, store.project?.scripts)
  if (!script) { toast('Arrastra un único recurso Script desde Assets', 'error'); return }
  if (script.execution !== 'node') { toast('Este recurso es Global. Selecciona un Script de Nodo', 'error'); return }
  addNodeScript(obj.value.id, script.id)
}
const scriptFns = computed(() => {
  const out = new Set()
  for (const sc of store.project?.scripts || []) for (const m of String(sc.code || '').matchAll(/game\.define\(\s*(['"`])([^'"`]+)\1/g)) out.add(m[2])
  return [...out].sort()
})
// solo una cámara puede ser la principal
function setMainCamera(on) {
  if (on) for (const o of store.project.objects) if (o.type === 'camera' && o.id !== obj.value.id && o.props?.main) updateObject(o.id, { props: { main: false } }, { commit: false })
  upd({ props: { main: !!on } }, true)
}
const cv = computed(() => (obj.value?.type === 'canvas' ? { ui: '', role: '', layer: 10, interactive: false, modal: false, visible: true, refW: 1920, refH: 1080, alpha: 1, ...obj.value.props } : null))
const cvDoc = computed(() => store.project.uis.find((u) => u.id === cv.value?.ui))
const cvSet = (k, v) => upd({ props: { [k]: v } }, true)
function cvNew() {
  // con «Uso», el .ui nuevo parte de la interfaz por defecto de ese uso (diálogo, opciones…) para personalizarla
  const r = SYSTEM_ROLE[cv.value?.role]
  const d = r ? createUi('Assets/UI', `${r.file}.ui`, systemCode(r.key)) : createUi('Assets/UI', 'hud.ui', CANVAS_TEMPLATE)
  cvSet('ui', d.id); openUiEditor(d.id)
}
/** Cambia el «Uso»: pone la capa por defecto de ese uso si la capa seguía en la de antes. */
function cvRole(role) {
  const prev = SYSTEM_ROLE[cv.value.role]?.layer ?? 10
  const patch = { role }
  if ((Number(cv.value.layer) || 0) === prev) patch.layer = SYSTEM_ROLE[role]?.layer ?? 10
  upd({ props: patch }, true)
}
// cluster de animales: los parámetros los declara la especie (core/critters/)
const species = computed(() => getSpecies(obj.value?.props?.species) || getSpecies('firefly'))
const critterVals = () => { const o = obj.value; for (const [k, v] of Object.entries(normalizeCritter(o.props, o.props.species))) if (o.props[k] === undefined) o.props[k] = v; return o.props }
const setSpecies = (id) => upd({ props: normalizeCritter({ species: id }, id) })
const resetTransform = () => upd({ position: [0, 0, 0], rotation: [0, 0, 0], ...(scalable.value ? { scale: [1, 1, 1] } : {}) })
const shape3d = computed(() => obj.value?.type === 'collisionshape3d' ? obj.value.props?.shape : null)
const boxFitGeometry = computed(() => obj.value && hasBoxFitGeometry(store.project?.objects || [], obj.value))
const triMeshCandidates = computed(() => obj.value ? triMeshSources(store.project?.objects || [], obj.value) : [])
const triMeshSource = computed(() => triMeshCandidates.value.find(v => v.id === shape3d.value?.sourceId))
const setShapeKind = (kind) => {
  const shape = newPhysicsShape(kind)
  if (kind === 'mesh' && triMeshCandidates.value.length === 1) shape.sourceId = triMeshCandidates.value[0].id
  if (kind === 'box' && boxFitGeometry.value) shape.autoFit = true
  upd({ kind, props: { shape } })
}
const setShapeParam = (key, value, commit = false) => upd({ props: { shape: { ...shape3d.value, [key]: value,
  ...(key === 'size' ? { autoFit: false } : {}) } } }, commit)
const setBoxAutoFit = enabled => {
  if (enabled && !boxFitGeometry.value) { toast('No hay malla o primitiva válida bajo este cuerpo físico', 'error'); return }
  upd({ props: {shape: {...shape3d.value,autoFit:enabled}} }, true)
}
const setBodyParam = (key, value, commit = false) => upd({ props: { [key]: value } }, commit)
</script>

<template>
  <div class="insp" :class="{ 'node-inspector': !audioContext && (obj || multi) }" :data-node-type="obj?.type || 'scene'">
    <AudioMixerInspector v-if="audioContext" />
    <div v-else-if="multi" class="multi-inspector" data-testid="multi-inspector-properties">
      <div class="head node-head">
        <div class="hcol"><div class="hrow">
          <b>{{ obj?.name || 'Selección' }}</b><span class="dim">· {{ multiNodes.length }} nodos</span>
        </div><span class="dim">{{ obj ? title : '' }} · Propiedades compartidas</span></div>
      </div>
      <section class="sect" data-fold-id="multi-common"><header>Propiedades del nodo</header><div class="body">
        <div v-for="field in [{ key: 'active', label: 'Activo' }, { key: 'visible', label: 'Visible' }, { key: 'static', label: 'Estático' }, { key: 'dontDestroyOnLoad', label: 'DontDestroyOnLoad' }]"
          v-show="multiCan(field.key)" :key="field.key" class="field">
          <label>{{ field.label }}</label>
          <input type="checkbox" :aria-label="field.label" :data-testid="'multi-' + field.key"
            :checked="multiCommon(field.key).value && !multiCommon(field.key).mixed"
            :indeterminate="multiCommon(field.key).mixed" :disabled="!multiWritable"
            :aria-checked="multiCommon(field.key).mixed ? 'mixed' : String(multiCommon(field.key).value)"
            @change="setShared(field.key, $event.target.checked)" />
        </div>
      </div></section>
      <section v-if="multiCan('position') || multiCan('rotation') || multiCan('scale')" class="sect lf-transform" data-fold-id="multi-transform">
        <header>Transformación · local</header><div class="body">
          <div v-for="field in [{key:'position',label:'Posición'}, {key:'rotation',label:'Rotación °'}, {key:'scale',label:'Escala'}]"
            v-show="multiCan(field.key)" :key="field.key" class="field">
            <label>{{ field.label }}</label><div class="multi-axes">
              <div v-for="axis in 3" :key="axis" class="multi-axis">
                <span>{{ ['X','Y','Z'][axis-1] }}</span>
                <NumberField :step="field.key === 'rotation' ? 1 : 0.1"
                  :display-decimals="2"
                  :model-value="multiCommon(field.key,axis-1).mixed ? 0 : multiCommon(field.key,axis-1).value"
                  :mixed="multiCommon(field.key,axis-1).mixed" :disabled="!multiWritable"
                  @update:model-value="editSharedAxis(field.key,axis-1,$event)" />
              </div>
            </div>
          </div>
        </div>
      </section>
      <section v-if="multiMaterial" class="sect" data-fold-id="multi-material">
        <header>Apariencia compartida</header>
        <div class="body">
          <div v-if="multiCan('color')" class="field"><label>Color</label>
            <input type="color" aria-label="Color compartido" :value="multiCommon('color').mixed ? '#ffffff' : multiCommon('color').value"
              :disabled="!multiWritable" @change="setShared('color', $event.target.value)" />
            <span v-if="multiCommon('color').mixed" class="dim">Mixto</span>
          </div>
          <div v-for="field in [{key:'roughness',label:'Rugosidad'}, {key:'metallic',label:'Metálico'}, {key:'opacity',label:'Opacidad'}]"
            v-show="multiCan(field.key)" :key="field.key" class="field">
            <label>{{ field.label }}</label>
            <input type="number" min="0" max="1" step="0.05"
              :value="multiCommon(field.key).mixed ? '' : multiCommon(field.key).value"
              :placeholder="multiCommon(field.key).mixed ? '—' : ''" :disabled="!multiWritable"
              @change="editSharedScalar(field.key,$event)" />
          </div>
          <div v-if="multiCan('castShadow')" class="field"><label>Proyectar sombras</label>
            <input type="checkbox" :checked="multiCommon('castShadow').value && !multiCommon('castShadow').mixed"
              :indeterminate="multiCommon('castShadow').mixed" :disabled="!multiWritable" @change="setShared('castShadow',$event.target.checked)" />
          </div>
        </div>
      </section>
      <section v-if="multiCan('carve') || multiCan('steps')" class="sect" data-fold-id="multi-geometry">
        <header>Geometría compartida</header>
        <div class="body">
          <div v-if="multiCan('steps')" class="field"><label>Escalones</label>
            <input type="number" min="2" max="64" step="1"
              :value="multiCommon('steps').mixed ? '' : multiCommon('steps').value"
              :placeholder="multiCommon('steps').mixed ? '—' : ''" :disabled="!multiWritable"
              @change="editSharedScalar('steps',$event)" />
          </div>
          <div v-if="multiCan('carve')" class="field"><label>Recibe cortes</label>
            <input type="checkbox" :checked="multiCommon('carve').value && !multiCommon('carve').mixed"
              :indeterminate="multiCommon('carve').mixed" :disabled="!multiWritable"
              @change="setShared('carve',$event.target.checked)" />
          </div>
        </div>
      </section>
      <div class="actions col">
        <button @click="groupSelected()"><Icon name="group" :size="14" />Agrupar <kbd>Ctrl G</kbd></button>
        <button @click="duplicateSelected()"><Icon name="copy" :size="14" />Duplicar</button>
        <button class="danger multi-delete" @click="removeSelected()"><Icon name="trash" :size="14" />Eliminar</button>
      </div>
    </div>

    <template v-else-if="!obj && store.sceneSel">
      <ScenePanel />
    </template>

    <p v-else-if="!obj" class="node-empty">Selecciona un nodo para inspeccionarlo.</p>

    <template v-else>
      <div class="head node-head" :class="{ 'primitive-head': obj.type === 'primitive' }" data-testid="inspector-node-head">
        <div class="hcol">
          <div class="hrow">
            <input type="checkbox" class="act" aria-label="Nodo activo" :checked="obj.active !== false" data-tooltip="Activo · habilita procesos y física" @change="upd({ active: $event.target.checked })" />
            <PropertyKey v-if="inspectorKeyable('active')" label="Activo" :available="true" :marked="inspectorKeyMarked('active')" @insert="inspectorInsertKey('active')" />
            <TextField v-if="obj.type === 'terrain'" class="name" aria-label="Nombre del nodo" :key="obj.id" :model-value="terrainName" @update:model-value="terrainName = $event" @commit="renamePiece(obj.id, terrainName)" />
            <TextField v-else class="name" aria-label="Nombre del nodo" :key="obj.id" :model-value="obj.name" @update:model-value="upd({ name: $event }, false)" @commit="commitNum" />
            <label class="node-lock" title="Bloquea la edición desde el visor"><input type="checkbox" :checked="!!obj.locked" @change="upd({ locked: $event.target.checked })" />Bloqueado</label>
          </div>
          <TagLayerRow :obj="obj" :key="obj.id" />
        </div>
      </div>

      <WaterPanel v-if="obj.type === 'water'" :obj="obj" :keyable="inspectorKeyable" :marked="inspectorKeyMarked" @insert-key="inspectorInsertKey" />
      <TerrainPanel v-if="obj.type === 'terrain'" data-testid="terrain-context-inspector" :timeline-piece-id="obj.id"
        :timeline-keyable="inspectorKeyable" :timeline-marked="inspectorKeyMarked" @timeline-insert-key="inspectorInsertKey" />

      <section v-if="obj.type === 'sceneInstance' || obj.sceneInstanceOwner" class="sect" data-fold-id="scene-instance">
        <header>Escena fuente</header>
        <div class="body">
          <div class="field"><label>{{ sceneSource?.name || 'Escena no disponible' }}</label>
            <button v-if="sceneSource" :disabled="store.play.on || store.filmMode" @click="switchScene(sceneSource.id)">Abrir escena</button>
          </div>
          <p v-if="obj.sceneInstanceOwner" class="hint">Nodo vinculado. Sus propiedades se editan en la escena fuente.</p>
        </div>
      </section>

      <section v-if="getDef(obj.type)?.base !== 'Node'" class="sect lf-transform" :data-primitive-section="obj.type === 'primitive' ? 'transform' : null" data-fold-id="transform">
        <header>Transformación <span class="dim">{{ obj.parentId ? '· local' : '' }}</span><button class="hbtn" aria-label="Restablecer transformación" data-tooltip="Restablecer transformación" @click.stop="resetTransform"><Icon name="rotate" :size="12" /></button></header>
        <div class="body">
          <div class="field"><label>Posición</label><Vec3Field :display-decimals="2" :model-value="obj.position" :step="0.1" @change="vec('position', $event)" /><PropertyKey v-if="inspectorKeyable('position')" label="Posición" :available="true" :marked="inspectorKeyMarked('position')" @insert="inspectorInsertKey('position')" /></div>
          <div class="field"><label>Rotación °</label><Vec3Field :display-decimals="2" :model-value="obj.rotation" :step="1" :decimals="2" @change="vec('rotation', $event)" /><PropertyKey v-if="inspectorKeyable('rotation')" label="Rotación °" :available="true" :marked="inspectorKeyMarked('rotation')" @insert="inspectorInsertKey('rotation')" /></div>
          <div v-if="scalable" class="field"><label>{{ obj.type === 'primitive' ? 'Tamaño' : 'Escala' }}</label><Vec3Field :display-decimals="2" :model-value="obj.scale" :step="0.1" :min="0.01" @change="vec('scale', $event)" /><PropertyKey v-if="inspectorKeyable('scale')" label="Escala" :available="true" :marked="inspectorKeyMarked('scale')" @insert="inspectorInsertKey('scale')" /></div>
          <div v-if="scalable" class="field" data-testid="uniform-scale-inspector" data-tooltip="Multiplica uniformemente la escala actual; no sustituye el tamaño por eje"><label>Escala ×</label><NumberField label="×" :model-value="uniformFactor" :step="0.05" :min="0.01" :max="10000" :decimals="4" :display-decimals="2" @update:model-value="previewUniformScale" @commit="confirmUniformScale" /></div>
          <p v-if="link" class="hint">{{ link === 'xyz' ? 'La esfera mantiene sus tres ejes iguales.' : 'X y Z se mantienen iguales (radio).' }}</p>
          <p v-if="obj.type === 'group'" class="hint lf-help">Los grupos solo llevan posición y rotación; sus hijos conservan su propio tamaño.</p>
        </div>
      </section>

      <section v-if="obj.kind === 'stairs'" class="sect" :data-primitive-section="obj.type === 'primitive' ? 'stairs' : null" data-fold-id="stairs">
        <header><Icon name="stairs" :size="13" /> Escalera</header>
        <div class="body">
          <div class="field"><label>Escalones</label><NumberField :model-value="obj.props.steps" :step="1" :min="2" :max="64" :decimals="0" @update:model-value="upd({ props: { steps: Math.max(2, Math.min(64, Math.round($event))) } }, false)" @commit="commitNum" /></div>
          <div class="field"><label>Giro °</label><NumberField :model-value="obj.props.turn ?? 0" :step="5" :min="-90" :max="90" :decimals="1" @update:model-value="setStairTurn" @commit="commitNum" /></div>
          <div class="field"><label>Laterales</label><select :value="obj.props.sides ?? 'none'" @change="setStairSide('sides', $event.target.value); $event.target.value = obj.props.sides ?? 'none'; commitNum()"><option value="none">Ninguno</option><option value="left">Izquierdo</option><option value="right">Derecho</option><option value="both">Ambos</option></select></div>
          <template v-if="(obj.props.sides ?? 'none') !== 'none'">
            <div class="field"><label>Altura lateral (m)</label><NumberField :model-value="obj.props.sideHeight ?? 1" :step="0.1" :min="0.1" :max="5" @update:model-value="setStairSide('sideHeight', $event)" @commit="commitNum" /></div>
            <div class="field"><label>Grosor lateral (m)</label><NumberField :model-value="obj.props.sideThickness ?? 0.15" :step="0.05" :min="0.05" :max="2" @update:model-value="setStairSide('sideThickness', $event)" @commit="commitNum" /></div>
          </template>
          <p class="hint lf-help">Los parapetos siguen los peldaños y quedan fuera del ancho útil X. Su altura y grosor se expresan en metros.</p>
          <p class="hint lf-help">El giro sigue un arco de longitud Z. Si el ancho X o el parapeto interior invaden el radio, no se aplica el valor inválido. Giro 0° conserva la escalera recta.</p>
          <p v-if="stairSideRejected" class="hint lf-help">Valor rechazado: el parapeto interior dejaría un radio inválido. Reduce el grosor o el giro.</p>
          <p v-if="stairTurnInvalid" class="hint lf-help">Giro no válido para las dimensiones actuales; se muestra temporalmente recta.</p>
        </div>
      </section>

      <section class="sect node-properties" data-fold-id="node-properties">
        <header>Propiedades del nodo</header>
        <div class="body">
          <div class="hrow sub" data-testid="node-type-label"><Icon :name="icon" :size="12" /><span class="node-type" tabindex="0">{{ title }}</span><span v-if="obj.parentId" tabindex="0" class="path" :data-tooltip="pathOf(obj.id)">{{ pathOf(obj.id) }}</span></div>
          <div class="field" data-testid="node-visibility-inspector"><label>Visible</label><input type="checkbox" aria-label="Visible" :checked="obj.visible !== false" data-tooltip="Oculta el contenido visual sin suspender lógica ni física" @change="obj.type === 'terrain' ? setPieceVisible(obj.id, $event.target.checked) : upd({ visible: $event.target.checked })" /><PropertyKey v-if="inspectorKeyable('visible')" label="Visible" :available="true" :marked="inspectorKeyMarked('visible')" @insert="inspectorInsertKey('visible')" /></div>
          <div v-if="OCCLUSION_NODE_TYPES.includes(obj.type)" class="field">
            <label>Estático</label><input type="checkbox" aria-label="Estático" data-testid="node-occlusion-static" :checked="isOcclusionStatic(obj)" data-tooltip="Incluye la geometría fija de este nodo en el horneado de oclusión" @change="upd({ props: { static: $event.target.checked } })" />
          </div>
          <div v-if="obj.type !== 'terrain'" class="field"><label>DontDestroyOnLoad</label><input type="checkbox" aria-label="DontDestroyOnLoad" :checked="obj.dontDestroyOnLoad === true" data-tooltip="Conservar este nodo y sus hijos al cambiar de escena en Play" @change="upd({ dontDestroyOnLoad: $event.target.checked })" /></div>
        </div>
      </section>

      <FluidContainerPanel v-if="obj.type === 'fluidcontainer3d'" :obj="obj" />
      <section v-if="obj.type === 'node3d' || obj.type === 'rigidbody3d'" class="sect" data-testid="liquid-container-inspector" data-fold-id="liquid-container">
        <header>Líquido contenido</header><div class="body">
          <div class="field"><label>Recipiente abierto</label><input type="checkbox" :checked="liquidContainer.enabled === true" @change="setContainer({enabled:$event.target.checked})" /></div>
          <template v-if="liquidContainer.enabled">
            <div class="field"><label>Forma interior</label><select :value="liquidContainer.shape||'cylinder'" @change="setContainer({shape:$event.target.value})"><option value="cylinder">Cilindro</option><option value="box">Caja</option></select><PropertyKey v-if="inspectorKeyable(`${obj.type}.liquidShape`)" label="Forma interior" :available="true" :marked="inspectorKeyMarked(`${obj.type}.liquidShape`)" @insert="inspectorInsertKey(`${obj.type}.liquidShape`)" /></div>
            <div class="field"><label>Interior (m)</label><Vec3Field :model-value="liquidContainer.size||[0.09,0.12,0.09]" :min="0.001" :step="0.01" @change="setContainer({size:$event.value})" /><PropertyKey v-if="inspectorKeyable(`${obj.type}.liquidSize`)" label="Interior (m)" :available="true" :marked="inspectorKeyMarked(`${obj.type}.liquidSize`)" @insert="inspectorInsertKey(`${obj.type}.liquidSize`)" /></div>
            <div class="field"><label>Líquido</label><ResourceDropSlot :kinds="['liquid']" :accepted-ids="liquidProfiles.map((l)=>l.id)" @assign="setContainer({liquidId:$event})">
              <select :value="liquidContainer.liquidId||'water'" @change="setContainer({liquidId:$event.target.value})"><option value="water">Agua (integrada)</option><option v-for="l in liquidProfiles" :key="l.id" :value="l.id">{{l.name}}</option></select>
            </ResourceDropSlot></div>
            <div class="field"><label>Volumen inicial (m³)</label><NumberField :model-value="liquidContainer.initialM3??0" :step="0.00001" :min="0" :max="liquidCapacity" @update:model-value="setContainer({initialM3:$event})" /></div>
            <div class="field"><label>Caudal de salida</label><NumberField :model-value="liquidContainer.pourRate??0.5" :step="0.1" :min="0" :max="5" @update:model-value="setContainer({pourRate:$event})" /><PropertyKey v-if="inspectorKeyable(`${obj.type}.pourRate`)" label="Caudal de salida" :available="true" :marked="inspectorKeyMarked(`${obj.type}.pourRate`)" @insert="inspectorInsertKey(`${obj.type}.pourRate`)" /></div>
            <p class="hint lf-help">Capacidad {{(liquidCapacity*1000).toFixed(2)}} L. El líquido se simula en Play; no se convierte en física de la malla artística. Sin región receptora compatible, el derrame es una salida contabilizada.</p>
          </template>
        </div>
      </section>
      <section v-if="['staticbody3d','rigidbody3d','node3d'].includes(obj.type)" class="sect" data-testid="tornado-combustion-inspector" data-fold-id="weather-combustion">
        <header><Icon name="flame" :size="13" /> Combustión meteorológica</header>
        <div class="body">
          <div class="field"><label>Combustible</label><input type="checkbox" :checked="obj.props?.combustion?.enabled === true" @change="upd({props:{combustion:{...(obj.props?.combustion||{}),enabled:$event.target.checked}}})" /></div>
          <template v-if="obj.props?.combustion?.enabled">
            <div class="field"><label>Ignición inicial</label><input type="checkbox" :checked="obj.props.combustion.ignited === true" @change="upd({props:{combustion:{...obj.props.combustion,ignited:$event.target.checked}}})" /></div>
            <div class="field"><label>Humedad</label><NumberField :model-value="obj.props.combustion.moisture ?? 0.25" :min="0" :max="1" :step="0.05" @update:model-value="upd({props:{combustion:{...obj.props.combustion,moisture:$event}}})" /><PropertyKey v-if="inspectorKeyable(`${obj.type}.moisture`)" label="Humedad" :available="true" :marked="inspectorKeyMarked(`${obj.type}.moisture`)" @insert="inspectorInsertKey(`${obj.type}.moisture`)" /></div>
            <div class="field"><label>Temperatura de ignición (K)</label><NumberField :model-value="obj.props.combustion.ignitionK ?? 570" :min="300" :max="2000" :step="10" @update:model-value="upd({props:{combustion:{...obj.props.combustion,ignitionK:$event}}})" /><PropertyKey v-if="inspectorKeyable(`${obj.type}.ignitionK`)" label="Temperatura de ignición (K)" :available="true" :marked="inspectorKeyMarked(`${obj.type}.ignitionK`)" @insert="inspectorInsertKey(`${obj.type}.ignitionK`)" /></div>
            <p class="hint lf-help">Fuego físico simplificado; requiere Tornado → Combustión. Asigna un VFX3D separado para representar llamas y brasas. El material visual no determina la combustibilidad.</p>
          </template>
        </div>
      </section>
      <section v-if="obj.type === 'staticbody3d'  || obj.type === 'rigidbody3d'" class="sect" data-testid="physical-body-inspector" data-fold-id="physical-body">
        <header><Icon :name="icon" :size="13" /> {{ obj.type === 'staticbody3d' ? 'StaticBody3D' : 'RigidBody3D' }}</header>
        <div class="body">
          <p class="hint lf-help">Los cuerpos físicos usan nodos CollisionShape3D como hijos directos. La simulación se realiza con Jolt al entrar en PlayMode. Cada cuerpo utiliza sus CollisionShape3D habilitadas.</p>
          <template v-if="obj.type === 'rigidbody3d'">
            <div class="field"><label>Masa (kg)</label><NumberField :model-value="obj.props.mass" :step="0.1" :min="0.001" @update:model-value="setBodyParam('mass', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('physics.rigidMass')" label="Masa (kg)" :available="true" :marked="inspectorKeyMarked('physics.rigidMass')" @insert="inspectorInsertKey('physics.rigidMass')" /></div>
            <div class="field"><label>Escala gravedad</label><NumberField :model-value="obj.props.gravityScale" :step="0.1" @update:model-value="setBodyParam('gravityScale', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('physics.gravityScale')" label="Escala gravedad" :available="true" :marked="inspectorKeyMarked('physics.gravityScale')" @insert="inspectorInsertKey('physics.gravityScale')" /></div>
            <div class="field"><label>Amortiguación lineal</label><NumberField :model-value="obj.props.linearDamping" :step="0.05" :min="0" @update:model-value="setBodyParam('linearDamping', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('physics.linearDamping')" label="Amortiguación lineal" :available="true" :marked="inspectorKeyMarked('physics.linearDamping')" @insert="inspectorInsertKey('physics.linearDamping')" /></div>
            <div class="field"><label>Amortiguación angular</label><NumberField :model-value="obj.props.angularDamping" :step="0.05" :min="0" @update:model-value="setBodyParam('angularDamping', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('physics.angularDamping')" label="Amortiguación angular" :available="true" :marked="inspectorKeyMarked('physics.angularDamping')" @insert="inspectorInsertKey('physics.angularDamping')" /></div>
            <div class="field"><label>Puede dormir</label><input type="checkbox" :checked="obj.props.canSleep !== false" @change="setBodyParam('canSleep', $event.target.checked, true)" /><PropertyKey v-if="inspectorKeyable('physics.canSleep')" label="Puede dormir" :available="true" :marked="inspectorKeyMarked('physics.canSleep')" @insert="inspectorInsertKey('physics.canSleep')" /></div>
          </template>
          <div class="field"><label>Rozamiento</label><NumberField :model-value="obj.props.friction" :step="0.05" :min="0" :max="1" @update:model-value="setBodyParam('friction', $event)" @commit="commitNum" /><PropertyKey v-if="obj.type === 'staticbody3d' && inspectorKeyable('physics.staticFriction')" label="Rozamiento" :available="true" :marked="inspectorKeyMarked('physics.staticFriction')" @insert="inspectorInsertKey('physics.staticFriction')" /><PropertyKey v-else-if="obj.type === 'rigidbody3d' && inspectorKeyable('physics.rigidFriction')" label="Rozamiento" :available="true" :marked="inspectorKeyMarked('physics.rigidFriction')" @insert="inspectorInsertKey('physics.rigidFriction')" /></div>
          <div class="field"><label>Rebote</label><NumberField :model-value="obj.props.restitution" :step="0.05" :min="0" :max="1" @update:model-value="setBodyParam('restitution', $event)" @commit="commitNum" /><PropertyKey v-if="obj.type === 'staticbody3d' && inspectorKeyable('physics.staticRestitution')" label="Rebote" :available="true" :marked="inspectorKeyMarked('physics.staticRestitution')" @insert="inspectorInsertKey('physics.staticRestitution')" /><PropertyKey v-else-if="obj.type === 'rigidbody3d' && inspectorKeyable('physics.rigidRestitution')" label="Rebote" :available="true" :marked="inspectorKeyMarked('physics.rigidRestitution')" @insert="inspectorInsertKey('physics.rigidRestitution')" /></div>
          <p class="hint lf-help">Selecciona el cuerpo y usa Añadir → Física → BoxShape3D, SphereShape3D o CapsuleShape3D.</p>
        </div>
      </section>
      <section v-if="obj.type === 'characterbody3d'" class="sect" data-testid="character-body-inspector" data-fold-id="character-body">
        <header><Icon :name="icon" :size="13" /> CharacterBody3D</header>
        <div class="body">
          <p class="hint lf-help">Añade una CapsuleShape3D centrada. El movimiento se controla por velocidad, no mediante RigidBody3D.</p>
          <div class="field"><label>Velocidad (m/s)</label><Vec3Field :model-value="obj.props.velocity" :step="0.1" @change="upd({ props: { velocity: $event.value } }, $event.commit)" /><PropertyKey v-if="inspectorKeyable('physics.velocity')" label="Velocidad (m/s)" :available="true" :marked="inspectorKeyMarked('physics.velocity')" @insert="inspectorInsertKey('physics.velocity')" /></div>
          <div class="field"><label>Pendiente máxima (°)</label><NumberField :model-value="obj.props.maxSlopeAngle" :step="1" :min="0" :max="89" @update:model-value="setBodyParam('maxSlopeAngle', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('physics.maxSlopeAngle')" label="Pendiente máxima (°)" :available="true" :marked="inspectorKeyMarked('physics.maxSlopeAngle')" @insert="inspectorInsertKey('physics.maxSlopeAngle')" /></div>
          <div class="field"><label>Altura escalón (m)</label><NumberField :model-value="obj.props.stepHeight" :step="0.05" :min="0" :max="10" @update:model-value="setBodyParam('stepHeight', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('physics.stepHeight')" label="Altura escalón (m)" :available="true" :marked="inspectorKeyMarked('physics.stepHeight')" @insert="inspectorInsertKey('physics.stepHeight')" /></div>
          <div class="field"><label>Snap suelo (m)</label><NumberField :model-value="obj.props.floorSnap" :step="0.05" :min="0" :max="10" @update:model-value="setBodyParam('floorSnap', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('physics.floorSnap')" label="Snap suelo (m)" :available="true" :marked="inspectorKeyMarked('physics.floorSnap')" @insert="inspectorInsertKey('physics.floorSnap')" /></div>
          <div class="field"><label>Gravedad (m/s²)</label><NumberField :model-value="obj.props.gravity" :step="0.1" :min="0" @update:model-value="setBodyParam('gravity', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('physics.gravity')" label="Gravedad (m/s²)" :available="true" :marked="inspectorKeyMarked('physics.gravity')" @insert="inspectorInsertKey('physics.gravity')" /></div>
          <div class="field"><label>Masa (kg)</label><NumberField :model-value="obj.props.mass" :step="1" :min="0.001" @update:model-value="setBodyParam('mass', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('physics.characterMass')" label="Masa (kg)" :available="true" :marked="inspectorKeyMarked('physics.characterMass')" @insert="inspectorInsertKey('physics.characterMass')" /></div>
        </div>
      </section>
      <section v-if="obj.type === 'area3d'" class="sect" data-testid="area3d-inspector" data-fold-id="area3d">
        <header><Icon :name="icon" :size="13" /> Area3D</header>
        <div class="body">
          <p class="hint lf-help">Detecta solapamientos sin bloquear cuerpos. Sus CollisionShape3D definen el volumen.</p>
          <div class="field"><label>Monitoring</label><input type="checkbox" :checked="obj.props.monitoring" @change="setBodyParam('monitoring', $event.target.checked, true)" /><PropertyKey v-if="inspectorKeyable('physics.monitoring')" label="Monitoring" :available="true" :marked="inspectorKeyMarked('physics.monitoring')" @insert="inspectorInsertKey('physics.monitoring')" /></div>
          <div class="field"><label>Monitorable</label><input type="checkbox" :checked="obj.props.monitorable" @change="setBodyParam('monitorable', $event.target.checked, true)" /><PropertyKey v-if="inspectorKeyable('physics.monitorable')" label="Monitorable" :available="true" :marked="inspectorKeyMarked('physics.monitorable')" @insert="inspectorInsertKey('physics.monitorable')" /></div>
        </div>
      </section>
      <section v-if="shape3d" class="sect" data-testid="collision-shape-inspector" data-fold-id="collision-shape">
        <header><Icon :name="icon" :size="13" /> CollisionShape3D</header>
        <div class="body">
          <div class="field"><label>Forma</label><select :value="obj.kind" @change="setShapeKind($event.target.value)">
            <option value="box">BoxShape3D</option><option value="sphere">SphereShape3D</option><option value="capsule">CapsuleShape3D</option><option value="mesh" v-if="obj.parentId && getObject(obj.parentId)?.type === 'staticbody3d'">TriMeshShape3D (vértices)</option>
          </select><PropertyKey v-if="inspectorKeyable('collision.type')" label="Forma" :available="true" :marked="inspectorKeyMarked('collision.type')" @insert="inspectorInsertKey('collision.type')" /></div>
          <template v-if="shape3d.type === 'BoxShape3D'">
            <div class="field"><label>Autoajuste a geometría</label><input type="checkbox" :checked="shape3d.autoFit === true" @change="setBoxAutoFit($event.target.checked)" /></div>
            <div class="field"><label>Tamaño (m)</label><Vec3Field :model-value="shape3d.size" :min="0.01" :step="0.1" @change="setShapeParam('size', $event.value, $event.commit)" /><PropertyKey v-if="inspectorKeyable('collision.size')" label="Tamaño (m)" :available="true" :marked="inspectorKeyMarked('collision.size')" @insert="inspectorInsertKey('collision.size')" /></div>
            <button type="button" class="primary" @click="fitBoxShapeNow(obj.id)">Ajustar a geometría</button>
            <p v-if="!boxFitGeometry" class="hint lf-help">No hay primitivas o mallas editables bajo este cuerpo. El tamaño permanece manual.</p>
            <p v-else class="hint lf-help">Calcula tamaño y centro reales sin modificar la escala. Si editas manualmente el tamaño o la posición, el autoajuste se desactiva.</p>
          </template>
          <div v-else-if="shape3d.type === 'TriMeshShape3D'">
            <div class="field"><label>Malla de origen</label><select :value="shape3d.sourceId" @change="setShapeParam('sourceId', $event.target.value, true)">
              <option value="">Seleccionar geometría…</option>
              <option v-for="source in triMeshCandidates" :key="source.id" :value="source.id">{{ source.name }} ({{ source.type }})</option>
            </select><PropertyKey v-if="inspectorKeyable('collision.sourceId')" label="Malla de origen" :available="true" :marked="inspectorKeyMarked('collision.sourceId')" @insert="inspectorInsertKey('collision.sourceId')" /></div>
            <p class="hint lf-help" v-if="!triMeshSource">Selecciona una primitiva o malla editable del mismo StaticBody3D. No hay colisión física hasta definirla.</p>
            <p class="hint lf-help" v-else>La forma triangular sigue la geometría actual de {{ triMeshSource.name }} cuando se inicia Play. Es estática y no duplica la malla en el proyecto.</p>
          </div>
          <template v-else>
            <div class="field"><label>Radio (m)</label><NumberField :model-value="shape3d.radius" :step="0.1" :min="0.01" @update:model-value="setShapeParam('radius', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('collision.radius')" label="Radio (m)" :available="true" :marked="inspectorKeyMarked('collision.radius')" @insert="inspectorInsertKey('collision.radius')" /></div>
            <div v-if="shape3d.type === 'CapsuleShape3D'" class="field"><label>Altura total (m)</label><NumberField :model-value="shape3d.height" :step="0.1" :min="0.01" @update:model-value="setShapeParam('height', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('collision.height')" label="Altura total (m)" :available="true" :marked="inspectorKeyMarked('collision.height')" @insert="inspectorInsertKey('collision.height')" /></div>
          </template>
          <div class="field"><label>Desactivada</label><input type="checkbox" :checked="obj.props.disabled === true" @change="upd({ props: { disabled: $event.target.checked } })" /><PropertyKey v-if="inspectorKeyable('collision.disabled')" label="Desactivada" :available="true" :marked="inspectorKeyMarked('collision.disabled')" @insert="inspectorInsertKey('collision.disabled')" /></div>
          <p class="hint lf-help">La forma está en metros locales. Ajusta Posición y Rotación del nodo; la escala debe permanecer en (1, 1, 1).</p>
        </div>
      </section>

      <section v-if="obj.type === 'primitive'" class="sect" data-primitive-section="cuts" data-fold-id="cuts">
        <header><Icon name="box" :size="13" /> Cortes</header>
        <div class="body">
          <button class="wide" data-tooltip="Convierte esta primitiva en malla editable con los huecos ya hechos" @click="store.editor.bakeCuts()">Hornear cortes a malla</button>
          <div class="field"><label>Recibe cortes</label><input type="checkbox" :checked="obj.props.carve !== false" @change="upd({ props: { carve: $event.target.checked } })" /></div>
        </div>
      </section>

      <section v-if="prefab" class="sect" :data-primitive-section="obj.type === 'primitive' ? 'prefab' : null" data-fold-id="prefab">
        <header><Icon name="prefab" :size="13" /> Prefab <span class="dim">· {{ prefab.name }}</span></header>
        <div class="body">
          <div class="pfbtns">
            <button class="primary" data-tooltip="Sube los cambios de esta instancia al prefab y sincroniza las demás" @click="applyToPrefab(obj.id)">Aplicar</button>
            <button data-tooltip="Descarta los cambios locales y rehace la instancia desde el prefab" @click="revertInstance(obj.id)">Revertir</button>
            <button data-tooltip="La instancia pasa a ser un grupo normal" @click="unpackInstance(obj.id)">Desvincular</button>
            <button data-tooltip="Mostrar en el panel Proyecto" @click="showPrefab">Ver</button>
          </div>
          <p class="hint lf-help">Al aplicar, las demás instancias se rehacen desde el prefab (conservan nombre, padre y transformación).</p>
        </div>
      </section>
      <section v-else-if="!obj.prefabId" class="sect" :data-primitive-section="obj.type === 'primitive' ? 'prefab' : null" data-fold-id="prefab">
        <header><Icon name="prefab" :size="13" /> Prefab</header>
        <div class="body"><button style="width:100%" @click="createPrefab([obj.id], 'Assets/Prefabs')"><Icon name="prefab" :size="13" /> Crear prefab desde este nodo</button></div>
      </section>

      <section v-if="obj.type === 'decal'" class="sect" data-fold-id="decal">
        <header><Icon name="decal" :size="13" /> Calcomanía proyectada</header>
        <div class="body">
          <div class="field"><label>Malla objetivo</label><select :value="obj.props.targetId || ''" @change="upd({ props: { targetId: $event.target.value } })">
            <option value="">Seleccionar malla</option>
            <option v-for="target in decalTargets" :key="target.id" :value="target.id">{{ target.name }}</option>
          </select></div>
          <div class="field"><label>Textura</label>
            <ResourceDropSlot :kinds="['texture']" :accepted-ids="decalImageIds"
              @assign="upd({ props: { image: $event } })" @reject="toast('Suelta una única textura válida de Assets', 'error')">
              <select :value="obj.props.image || ''" @change="upd({ props: { image: $event.target.value } })">
                <option value="">Sin textura</option>
                <option v-if="obj.props.image && !decalImageIds.includes(obj.props.image)" :value="obj.props.image">(textura inexistente)</option>
                <option v-for="asset in decalImages" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
              </select>
            </ResourceDropSlot>
            <PropertyKey v-if="inspectorKeyable('decal.targetId')" label="Malla objetivo" :available="true" :marked="inspectorKeyMarked('decal.targetId')" @insert="inspectorInsertKey('decal.targetId')" /><PropertyKey v-if="inspectorKeyable('decal.image')" label="Textura" :available="true" :marked="inspectorKeyMarked('decal.image')" @insert="inspectorInsertKey('decal.image')" />
          </div>
          <div class="field"><label>Ancho / Alto / Profundidad</label><Vec3Field :model-value="obj.props.size || [1, 1, 0.5]" :min="0.01" :step="0.1" @change="upd({ props: { size: $event.value } }, $event.commit)" /><PropertyKey v-if="inspectorKeyable('decal.size')" label="Ancho / Alto / Profundidad" :available="true" :marked="inspectorKeyMarked('decal.size')" @insert="inspectorInsertKey('decal.size')" /></div>
          <div class="field"><label>Opacidad</label><input type="range" min="0" max="1" step="0.01" :value="obj.props.opacity ?? 1" @input="upd({ props: { opacity: +$event.target.value } }, false)" @change="commitNum" /><PropertyKey v-if="inspectorKeyable('decal.opacity')" label="Opacidad" :available="true" :marked="inspectorKeyMarked('decal.opacity')" @insert="inspectorInsertKey('decal.opacity')" /></div>
          <p class="hint lf-help">Solo se proyecta sobre la malla seleccionada. La textura se guarda como referencia del proyecto.</p>
        </div>
      </section>

      <section class="sect" :data-primitive-section="obj.type === 'primitive' ? 'script' : null" data-fold-id="scripts">
        <header><Icon name="script" :size="13" /> Scripts de Nodo <span class="node-script-count" v-if="assignedScriptIds.length" :data-tooltip="`${assignedScriptIds.length} scripts asignados`">{{ assignedScriptIds.length }}</span></header>
        <div class="body" :class="{ 'lf-script-drop': scriptDragOver }"
          @dragover="onScriptDragOver" @dragleave="scriptDragOver = false" @drop="onScriptDrop">
          <div v-for="(id, index) in assignedScriptIds" :key="id" class="node-script-slot"
            :class="{ 'node-script-missing': !scriptById.get(id) || scriptById.get(id).execution !== 'node' }"
            
            @dragover.prevent="reorderingScript !== null && ($event.dataTransfer.dropEffect = 'move')"
            @drop="onScriptSortDrop($event, index)">
            <div class="node-script-entry">
            <span draggable="true" class="node-script-grip" :aria-label="`Arrastrar ${id} para ordenar`" @dragstart="onScriptSortStart($event, index)" @dragend="reorderingScript = null"><Icon name="move" :size="13" class="node-script-handle" /></span>
            <Icon name="script" :size="13" />
            <span class="node-script-name" :title="scriptById.get(id)?.name || id">{{ scriptById.get(id)?.name || `Recurso inexistente (${id})` }}<small v-if="scriptById.get(id) && scriptById.get(id).execution !== 'node'">No es Script de Nodo</small></span>
            <button :disabled="index === 0" :aria-label="`Subir ${id}`" title="Subir" @click="moveNodeScript(obj.id, index, index - 1)"><Icon name="chevron-down" :size="13" class="node-script-up" /></button>
            <button :disabled="index === assignedScriptIds.length - 1" :aria-label="`Bajar ${id}`" title="Bajar" @click="moveNodeScript(obj.id, index, index + 1)"><Icon name="chevron-down" :size="13" /></button>
            <button :disabled="!scriptById.get(id) || scriptById.get(id).execution !== 'node'" :aria-label="`Abrir ${id}`" title="Abrir en el editor de código" @click="openScriptEditor(id)"><Icon name="file" :size="13" /></button>
            <button :aria-label="`Quitar ${id}`" title="Quitar script" @click="removeNodeScript(obj.id, id)"><Icon name="x" :size="13" /></button>
            </div>
            <div v-if="scriptEditables.get(id)?.fields.length" class="node-script-editables">
              <div v-for="(field, fieldIndex) in scriptEditables.get(id).fields" :key="field.name" class="node-script-field">
                <div v-if="showEditableHeader(scriptEditables.get(id).fields, fieldIndex)" class="node-script-header">
                  <strong>{{ field.header }}</strong>
                  <p v-if="field.headerDescription" class="hint">{{ field.headerDescription }}</p>
                </div>
                <label :for="`script-editable-${obj.id}-${id}-${field.name}`">{{ field.name }}</label>
                <input v-if="field.type === 'boolean'" :id="`script-editable-${obj.id}-${id}-${field.name}`" type="checkbox"
                  :checked="editableDisplayValue(id, field)" :disabled="store.locked || store.play.on || !!obj.sceneInstanceOwner"
                  @change="updateScriptEditable(id, field, $event.target.checked)" />
                <input v-else :id="`script-editable-${obj.id}-${id}-${field.name}`" :type="field.type === 'number' ? 'number' : 'text'"
                  :step="field.type === 'number' ? 'any' : undefined" :value="editableDisplayValue(id, field)"
                  :disabled="store.locked || store.play.on || !!obj.sceneInstanceOwner"
                  @change="updateScriptEditable(id, field, $event.target.value)" />
                <p v-if="field.description" class="hint node-script-description">{{ field.description }}</p>
              </div>
            </div>
            <p v-for="diagnostic in scriptEditables.get(id)?.diagnostics || []" :key="`${diagnostic.line}-${diagnostic.message}`"
              class="hint node-script-error">Línea {{ diagnostic.line }}: {{ diagnostic.message }}</p>
          </div>
          <div class="field node-script-add"><label :for="`node-script-add-${obj.id}`" data-tooltip="Selecciona un recurso o arrastra un Script de Nodo desde Assets">Agregar script</label>
            <select :id="`node-script-add-${obj.id}`" ref="scriptSelect" value="" :aria-label="'Agregar script'" :data-tooltip="!assignedScriptIds.length ? 'Este nodo todavía no tiene scripts.' : 'Agregar script'" :disabled="!availableNodeScripts.length" @change="assignSelectedScript($event.target.value)">
              <option value="">Seleccionar recurso…</option>
              <option v-for="sc in availableNodeScripts" :key="sc.id" :value="sc.id">{{ sc.name }}</option>
            </select>
          </div>
        </div>
      </section>

      <section v-if="obj.type === 'vfx'" class="sect" data-fold-id="vfx-emitter">
        <header><Icon name="vfx" :size="13" /> Emisor VFX 3D</header>
        <div class="body">
          <div class="field"><label>Recurso</label>
            <ResourceDropSlot :kinds="['vfx']" :accepted-ids="(store.project?.vfx || []).map(fx => fx.id)" @assign="upd({ props: { vfxId: $event } })">
              <select :value="obj.props?.vfxId || ''" @change="upd({ props: { vfxId: $event.target.value } })">
                <option value="">Sin recurso</option>
                <option v-for="fx in (store.project?.vfx || [])" :key="fx.id" :value="fx.id">{{ fx.name }}</option>
                <option v-if="obj.props?.vfxId && !(store.project?.vfx || []).some(fx => fx.id === obj.props.vfxId)" :value="obj.props.vfxId">Recurso ausente: {{ obj.props.vfxId }}</option>
              </select>
            </ResourceDropSlot><PropertyKey v-if="inspectorKeyable('vfx.vfxId')" label="Recurso VFX" :available="true" :marked="inspectorKeyMarked('vfx.vfxId')" @insert="inspectorInsertKey('vfx.vfxId')" />
          </div>
          <p v-if="obj.props?.vfxId && !(store.project?.vfx || []).some(fx => fx.id === obj.props.vfxId)" class="hint lf-help">Referencia VFX inválida. Vuelve a asignar un recurso existente antes de exportar.</p>
          <div class="field"><label>Activo</label><input type="checkbox" :checked="obj.props?.enabled !== false" @change="upd({ props: { enabled: $event.target.checked } })" /><PropertyKey v-if="inspectorKeyable('vfx.enabled')" label="Activo" :available="true" :marked="inspectorKeyMarked('vfx.enabled')" @insert="inspectorInsertKey('vfx.enabled')" /></div>
          <div class="field"><label>Semilla</label><NumberField :model-value="obj.props?.seed ?? 1" :min="0" :max="2147483647" :step="1" @update:model-value="upd({ props: { seed: Math.round($event) } }, false)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('vfx.seed')" label="Semilla" :available="true" :marked="inspectorKeyMarked('vfx.seed')" @insert="inspectorInsertKey('vfx.seed')" /></div>
          <p class="hint lf-help">El recurso es compartido, pero las partículas son independientes en cada instancia. Se reproduce en modo Jugar.</p>
        </div>
      </section>

      <section v-if="obj.type === 'nature'" class="sect" data-testid="nature-node-inspector" data-fold-id="nature">
        <header><Icon name="tree" :size="13" /> Naturaleza</header>
        <div class="body">
          <p class="hint lf-help">Instancia independiente: no necesita un nodo Terreno.</p>
          <div class="field"><label>Color</label><ColorInput :value="obj.color || '#ffffff'" @input="upd({ color:$event.target.value },false)" @change="commitNum" /><PropertyKey v-if="inspectorKeyable('nature.color')" label="Color" :available="true" :marked="inspectorKeyMarked('nature.color')" @insert="inspectorInsertKey('nature.color')" /></div>
          <div class="field"><label>Sombra</label><input type="checkbox" :checked="obj.castShadow !== false" @change="upd({ castShadow:$event.target.checked })" /><PropertyKey v-if="inspectorKeyable('nature.castShadow')" label="Sombra" :available="true" :marked="inspectorKeyMarked('nature.castShadow')" @insert="inspectorInsertKey('nature.castShadow')" /></div>
          <div class="field"><label>Influencia del viento</label><NumberField :model-value="obj.props?.windSway ?? 1" :step="0.1" :min="0" :max="4" @update:model-value="upd({props:{windSway:$event}},false)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('nature.windSway')" label="Influencia del viento" :available="true" :marked="inspectorKeyMarked('nature.windSway')" @insert="inspectorInsertKey('nature.windSway')" /></div>
        </div>
      </section>

      <RoadPanel v-if="obj.type === 'road'" :obj="obj" :keyable="inspectorKeyable" :marked="inspectorKeyMarked" @insert-key="inspectorInsertKey" />

      <section v-if="hasMaterial" class="sect" :data-primitive-section="obj.type === 'primitive' ? 'material' : null" data-fold-id="materials">
        <header><Icon name="sphere" :size="13" /> Materiales</header>
        <div class="body">
          <ModelMaterialSection v-if="obj.type === 'model'" :obj="obj" />
          <MaterialSection v-if="obj.type === 'primitive' || obj.type === 'mesh'" :obj="obj" :primitive-layout="obj.type === 'primitive'" :keyable="inspectorKeyable" :key-marked="inspectorKeyMarked" @insert-key="inspectorInsertKey" />
          <template v-else-if="obj.type === 'text'">
            <div class="field"><label>Color</label><ColorInput :value="obj.color" @input="upd({ color:$event.target.value },false)" @change="commitNum" /></div>
            <p class="hint lf-help">Material local del Texto 3D. El estilo se configura en las propiedades del nodo.</p>
          </template>
        </div>
      </section>

      <section v-if="giTypes.includes(obj.type)" class="sect" :data-primitive-section="obj.type === 'primitive' ? 'lighting' : null" data-fold-id="global-illumination">
        <header><Icon name="sun" :size="13" /> Iluminación global</header>
        <div class="body">
          <div class="field"><label>Sombra</label><input type="checkbox" :checked="obj.castShadow" @change="upd({ castShadow: $event.target.checked })" /><PropertyKey v-if="obj.type === 'model' && inspectorKeyable('model.castShadow')" label="Sombra" :available="true" :marked="inspectorKeyMarked('model.castShadow')" @insert="inspectorInsertKey('model.castShadow')" /></div>
          <div v-if="obj.type === 'primitive' || obj.type === 'mesh'" class="field"><label>Decoración estática (batch)</label><input type="checkbox" :checked="obj.props?.batchStatic === true" @change="upd({ props:{ batchStatic: $event.target.checked } })" /></div>
          <div class="field"><label>GI</label>
            <select :value="giOf(obj)" @change="upd({ gi: $event.target.value })"><option v-for="(l, k) in GI_MODES" :key="k" :value="k">{{ l }}</option></select>
          </div>
          <div v-if="giOf(obj) === 'lightmap' && (obj.type === 'primitive' || obj.type === 'mesh')" class="field"><label>Escala lightmap</label><NumberField :model-value="obj.lmScale || 1" :step="0.25" :min="0.25" :max="4" @update:model-value="setNum('lmScale', $event)" @commit="commitNum" /></div>
          <p class="hint lf-help">Estático: recibe lightmaps y tapa la luz al hornear. Dinámico: recibe sondas de luz y no proyecta sombra horneada.</p>
        </div>
      </section>

      <SpriteSection v-if="obj.type === 'sprite3d' || obj.type === 'sprite2d'" :obj="obj" :keyable="inspectorKeyable" :marked="inspectorKeyMarked" @insert-key="inspectorInsertKey" />

      <section v-if="obj.type === 'text'" class="sect" data-fold-id="text">
        <header><Icon name="text" :size="13" /> Texto</header>
        <div class="body">
          <div class="field"><label>Texto</label><textarea rows="2" :value="obj.props.text" @input="upd({ props: { text: $event.target.value } }, false)" @change="commitNum"></textarea><PropertyKey v-if="inspectorKeyable('text.text')" label="Texto" :available="true" :marked="inspectorKeyMarked('text.text')" @insert="inspectorInsertKey('text.text')" /></div>
          <div class="field"><label>Fuente</label>
            <select :value="obj.props.font" @change="upd({ props: { font: $event.target.value } })"><option v-for="(f, k) in TEXT_FONTS" :key="k" :value="k">{{ f.label }}</option></select>
            <PropertyKey v-if="inspectorKeyable('text.font')" label="Fuente" :available="true" :marked="inspectorKeyMarked('text.font')" @insert="inspectorInsertKey('text.font')" />
          </div>
          <div class="field"><label>Alineación</label>
            <select :value="obj.props.align" @change="upd({ props: { align: $event.target.value } })"><option value="left">Izquierda</option><option value="center">Centro</option><option value="right">Derecha</option></select>
            <PropertyKey v-if="inspectorKeyable('text.align')" label="Alineación" :available="true" :marked="inspectorKeyMarked('text.align')" @insert="inspectorInsertKey('text.align')" />
          </div>
          <div class="field"><label>Altura letra</label><NumberField :model-value="obj.props.size" :step="0.1" :min="0.1" @update:model-value="upd({ props: { size: $event } }, false)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('text.size')" label="Altura letra" :available="true" :marked="inspectorKeyMarked('text.size')" @insert="inspectorInsertKey('text.size')" /></div>
          <div class="field"><label>Profundidad</label><NumberField :model-value="obj.props.depth" :step="0.05" :min="0.01" @update:model-value="upd({ props: { depth: $event } }, false)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('text.depth')" label="Profundidad" :available="true" :marked="inspectorKeyMarked('text.depth')" @insert="inspectorInsertKey('text.depth')" /></div>
          <div class="field"><label>Bisel</label><NumberField :model-value="obj.props.bevel" :step="0.01" :min="0" :max="0.3" @update:model-value="upd({ props: { bevel: $event } }, false)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('text.bevel')" label="Bisel" :available="true" :marked="inspectorKeyMarked('text.bevel')" @insert="inspectorInsertKey('text.bevel')" /></div>
          <div class="field"><label>Interlineado</label><NumberField :model-value="obj.props.lineHeight" :step="0.05" :min="0.6" :max="3" @update:model-value="upd({ props: { lineHeight: $event } }, false)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('text.lineHeight')" label="Interlineado" :available="true" :marked="inspectorKeyMarked('text.lineHeight')" @insert="inspectorInsertKey('text.lineHeight')" /></div>
          <p class="hint lf-help">La cara frontal mira a +Z. Admite varias líneas, tildes y ñ.</p>
        </div>
      </section>

      <section v-if="obj.type === 'text'" class="sect" data-fold-id="neon">
        <header><Icon name="light" :size="13" /> Neón / emisión</header>
        <div class="body">
          <div class="field"><label>Emite luz</label><input type="checkbox" :checked="obj.props.neon" @change="upd({ props: { neon: $event.target.checked } })" /><PropertyKey v-if="inspectorKeyable('text.neon')" label="Emite luz" :available="true" :marked="inspectorKeyMarked('text.neon')" @insert="inspectorInsertKey('text.neon')" /></div>
          <template v-if="obj.props.neon">
            <div class="field"><label>Color</label><ColorInput :value="obj.props.neonColor" @input="upd({ props: { neonColor: $event.target.value } }, false)" @change="commitNum" /><PropertyKey v-if="inspectorKeyable('text.neonColor')" label="Color" :available="true" :marked="inspectorKeyMarked('text.neonColor')" @insert="inspectorInsertKey('text.neonColor')" /></div>
            <div class="field"><label>Brillo</label><NumberField :model-value="obj.props.neonEnergy" :step="0.1" :min="0" :max="16" @update:model-value="upd({ props: { neonEnergy: $event } }, false)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('text.neonEnergy')" label="Brillo" :available="true" :marked="inspectorKeyMarked('text.neonEnergy')" @insert="inspectorInsertKey('text.neonEnergy')" /></div>
            <div class="field"><label>Forma de luz</label>
              <select :value="obj.props.neonLight" @change="upd({ props: { neonLight: $event.target.value } })"><option v-for="(l, k) in NEON_LIGHTS" :key="k" :value="k">{{ l }}</option></select>
  <PropertyKey v-if="inspectorKeyable('text.neonLight')" label="Forma de luz" :available="true" :marked="inspectorKeyMarked('text.neonLight')" @insert="inspectorInsertKey('text.neonLight')" />
          </div>
            <template v-if="obj.props.neonLight !== 'none'">
              <div class="field"><label>Energía luz</label><NumberField :model-value="obj.props.neonLightEnergy" :step="0.1" :min="0" @update:model-value="upd({ props: { neonLightEnergy: $event } }, false)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('text.neonLightEnergy')" label="Energía luz" :available="true" :marked="inspectorKeyMarked('text.neonLightEnergy')" @insert="inspectorInsertKey('text.neonLightEnergy')" /></div>
              <div class="field"><label>Rango</label><NumberField :model-value="obj.props.neonRange" :step="0.5" :min="0.5" @update:model-value="upd({ props: { neonRange: $event } }, false)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('text.neonRange')" label="Rango" :available="true" :marked="inspectorKeyMarked('text.neonRange')" @insert="inspectorInsertKey('text.neonRange')" /></div>
              <div v-if="obj.props.neonLight === 'spot'" class="field"><label>Ángulo °</label><NumberField :model-value="obj.props.neonAngle" :step="1" :min="5" :max="89" @update:model-value="upd({ props: { neonAngle: $event } }, false)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('text.neonAngle')" label="Ángulo °" :available="true" :marked="inspectorKeyMarked('text.neonAngle')" @insert="inspectorInsertKey('text.neonAngle')" /></div>
            </template>
            <p class="hint lf-help">El brillo es emisión del material y la luz va en luces hijas. Para el halo (bloom), actívalo en el render del proyecto.</p>
          </template>
        </div>
      </section>



      <section v-if="obj.type === 'subtract'" class="sect" data-fold-id="subtract">
        <header><Icon name="subtract" :size="13" /> Substract</header>
        <div class="body">
          <div v-if="subtractReceiver" class="field"><label>Receptor</label><span>{{ subtractReceiver.name }}</span></div>
          <div class="field"><label>Receptor específico</label><NodePicker
            :model-value="obj.props?.receiverId || ''" :options="subtractReceiverOptions"
            none-label="Automático por jerarquía" placeholder="Buscar malla receptora…"
            @update:model-value="upd({ props: { receiverId: $event } })" /></div>
          <div class="field"><label>Trabajar con Mesh Substract</label><input type="checkbox"
            :checked="obj.props?.composeWithMeshSubtract === true"
            data-tooltip="Aplica este hueco después del Mesh Substract asociado al mismo padre"
            @change="upd({ props: { composeWithMeshSubtract: $event.target.checked } })" /></div>
          <p v-if="subtractComposesWithMesh" class="hint lf-help">«{{ subtractMeshPartner.name }}» vacía primero el interior de «{{ subtractReceiver.name }}». Después, este nodo abre la puerta sobre esa misma geometría sin restaurar la cavidad.</p>
          <p v-else-if="obj.props?.composeWithMeshSubtract" class="hint lf-help">Añade un Mesh Substract automático bajo el mismo padre compatible para encadenar ambos recortes.</p>
          <div class="field"><label>Volumen</label><select :value="obj.kind" :disabled="!!obj.props?.mesh" @change="upd({ kind: $event.target.value })"><option value="box">Caja</option><option value="cylinder">Cilindro</option><option value="stairs">Escalera</option></select><PropertyKey v-if="inspectorKeyable('subtract.kind')" label="Volumen" :available="true" :marked="inspectorKeyMarked('subtract.kind')" @insert="inspectorInsertKey('subtract.kind')" /></div>
          <div v-if="obj.props?.mesh" class="field"><label>Geometría personalizada</label><button type="button" :disabled="store.edit.on && store.edit.id === obj.id" @click="restoreSubtractShape">Restaurar volumen</button></div>
          <p v-if="obj.props?.mesh" class="hint lf-help">Puedes modificar el volumen mediante Edit Mesh. Su geometría personalizada tiene prioridad sobre la forma predefinida.</p>
          <p class="hint lf-help">Recorta los sólidos cerrados que intersecta. No tiene material ni colisión propios en Player.</p>
        </div>
      </section>


      <section v-if="obj.type === 'meshSubtract'" class="sect" data-fold-id="mesh-subtract">
        <header><Icon name="subtract" :size="13" /> Mesh Substract</header>
        <div class="body">
          <div v-if="subtractReceiver" class="field"><label>Receptor</label><span>{{ subtractReceiver.name }}</span></div>
          <div class="field"><label>Malla cortadora</label><NodePicker
            :model-value="obj.props?.sourceId || ''" :options="meshSubtractSourceOptions"
            none-label="Automático · usar padre compatible" placeholder="Buscar malla cortadora…"
            @update:model-value="upd({ props: { sourceId: $event } })" /></div>
          <div v-if="meshSubtractSelfHollow" class="field"><label>Margen interior</label><NumberField
            :model-value="obj.props?.autoInset ?? 0.1" :step="0.01" :min="0" :max="0.45"
            @update:model-value="upd({ props: { autoInset: $event } }, false)" @commit="commitNum" /></div>
          <p v-if="meshSubtractSelfHollow" class="hint lf-help">Usa una copia escalonada interior de «{{ meshSubtractSelection.selected?.name }}» para vaciar ese mismo receptor. Funciona igual en selección automática o manual; el margen conserva la carcasa.</p>
          <p v-if="meshSubtractError" class="hint lf-help">{{ meshSubtractError }}</p>
        </div>
      </section>

      <section v-if="obj.type === 'mesh'" class="sect" data-fold-id="brush">
        <header><Icon name="box" :size="13" /> Brush</header>
        <div class="body">
          <div class="field"><label>Recibe cortes</label><input type="checkbox" :checked="obj.props.carve !== false" data-tooltip="Permite que los nodos Substract abran huecos en esta malla editable cerrada" @change="upd({ props: { carve: $event.target.checked } })" /></div>
          <p class="hint lf-help">Los recortes afectan a las mallas cerradas. Los vértices siguen siendo editables en Edit Mesh.</p>
        </div>
      </section>

      <section v-if="obj.type === 'primitive' || obj.type === 'mesh' || obj.type === 'subtract'" class="sect" :data-primitive-section="obj.type === 'primitive' ? 'mesh' : null" data-fold-id="mesh">
        <header><Icon name="mesh" :size="13" /> Malla</header>
        <div class="body">
          <button class="wide" @click="store.editor.toggleEdit()"><Icon name="mesh" :size="14" />{{ store.edit.on ? 'Salir del modo edición' : 'Editar malla' }} <kbd>Tab</kbd></button>
          <div v-if="obj.type === 'mesh' && obj.props.meshRef" class="field"><label>Geometría vinculada</label><span class="hint">{{ obj.props.meshRef }}</span></div>
          <button v-if="obj.type === 'mesh' && obj.props.meshRef" class="wide" @click="makeMeshIndependent()">Hacer malla independiente</button>
          <button v-if="obj.type === 'mesh' || obj.type === 'primitive'" class="wide" @click="linkedDuplicateSelected()">Duplicar vinculada <kbd>Alt+D</kbd></button>
          <p class="hint">{{ obj.type === 'primitive' ? 'Al editar, la primitiva se convierte en una malla editable (vértices, aristas y caras).' : obj.type === 'subtract' ? 'El volumen sigue siendo Substract y conserva su función de abrir huecos.' : `${currentMesh ? currentMesh.v.length / 3 : 0} vértices · ${currentMesh ? currentMesh.f.length : 0} caras` }}</p>
        </div>
      </section>


      <section v-if="obj.type === 'light'" class="sect" data-fold-id="light">
        <header><Icon name="light" :size="13" /> Luz</header>
        <div class="body">
          <div class="field">
            <label>Tipo</label>
            <select :value="obj.light.type" @change="upd({ kind: $event.target.value, light: { type: $event.target.value } })">
              <option v-for="(l, k) in LIGHT_TYPES" :key="k" :value="k">{{ l }}</option>
            </select>
          </div>
          <div class="field"><label>Color</label><ColorInput :value="obj.color" @input="upd({ color: $event.target.value }, false)" @change="commitNum" /><PropertyKey v-if="inspectorKeyable('light.color')" label="Color" :available="true" :marked="inspectorKeyMarked('light.color')" @insert="inspectorInsertKey('light.color')" /></div>
          <div class="field"><label>Energía</label><NumberField :model-value="obj.light.energy" :step="0.05" :min="0" @update:model-value="setNum('light.energy', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('light.energy')" label="Energía" :available="true" :marked="inspectorKeyMarked('light.energy')" @insert="inspectorInsertKey('light.energy')" /></div>
          <div v-if="obj.light.type !== 'directional' && obj.light.type !== 'area'" class="field"><label>Rango</label><NumberField :model-value="obj.light.range" :step="0.5" :min="0.1" @update:model-value="setNum('light.range', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('light.range')" label="Rango" :available="true" :marked="inspectorKeyMarked('light.range')" @insert="inspectorInsertKey('light.range')" /></div>
          <div v-if="['omni', 'spot'].includes(obj.light.type)" class="field"><label>Atenuación</label>
            <select :value="lq.decay" @change="upd({ light: { decay: +$event.target.value } })">
              <option :value="1">Lineal (1/d)</option><option :value="2">Inverso del cuadrado (1/d²)</option>
            </select>
          </div>
          <div v-if="obj.light.type === 'area'" class="field"><label>Ancho (m)</label><NumberField :model-value="lq.areaWidth" :step="0.1" :min="0.05" :max="100" @update:model-value="setNum('light.areaWidth', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('light.areaWidth')" label="Ancho" :available="true" :marked="inspectorKeyMarked('light.areaWidth')" @insert="inspectorInsertKey('light.areaWidth')" /></div>
          <div v-if="obj.light.type === 'area'" class="field"><label>Alto (m)</label><NumberField :model-value="lq.areaHeight" :step="0.1" :min="0.05" :max="100" @update:model-value="setNum('light.areaHeight', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('light.areaHeight')" label="Alto" :available="true" :marked="inspectorKeyMarked('light.areaHeight')" @insert="inspectorInsertKey('light.areaHeight')" /></div>
          <p v-if="obj.light.type === 'area'" class="hint lf-help">Ilumina materiales PBR, sin sombras ni alcance configurable. El baking y la luz volumétrica no admiten este tipo.</p>
          <div v-if="obj.light.type === 'spot'" class="field"><label>Ángulo °</label><NumberField :model-value="obj.light.spotAngle" :step="1" :min="1" :max="89" @update:model-value="setNum('light.spotAngle', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('light.spotAngle')" label="Ángulo" :available="true" :marked="inspectorKeyMarked('light.spotAngle')" @insert="inspectorInsertKey('light.spotAngle')" /></div>
          <div v-if="obj.light.type === 'spot'" class="field"><label>Penumbra</label><input type="range" min="0" max="1" step="0.01" :value="lq.penumbra" @input="setNum('light.penumbra', +$event.target.value)" @change="commitNum" /><PropertyKey v-if="inspectorKeyable('light.penumbra')" label="Penumbra" :available="true" :marked="inspectorKeyMarked('light.penumbra')" @insert="inspectorInsertKey('light.penumbra')" /></div>
          <template v-if="['omni', 'spot', 'directional', 'area'].includes(obj.light.type)">
            <div class="field"><label>Lensflare</label><input type="checkbox" :checked="lq.flareOn" @change="upd({ light: { flareOn: $event.target.checked } })" /><PropertyKey v-if="inspectorKeyable('light.flareOn')" label="Lensflare" :available="true" :marked="inspectorKeyMarked('light.flareOn')" @insert="inspectorInsertKey('light.flareOn')" /></div>
            <template v-if="lq.flareOn">
              <div class="field"><label>Tamaño flare (px)</label><NumberField :model-value="lq.flareSize" :step="4" :min="16" :max="256" @update:model-value="setNum('light.flareSize', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('light.flareSize')" label="Tamaño flare" :available="true" :marked="inspectorKeyMarked('light.flareSize')" @insert="inspectorInsertKey('light.flareSize')" /></div>
              <div class="field"><label>Intensidad flare</label><NumberField :model-value="lq.flareIntensity" :step="0.1" :min="0" :max="2" @update:model-value="setNum('light.flareIntensity', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('light.flareIntensity')" label="Intensidad flare" :available="true" :marked="inspectorKeyMarked('light.flareIntensity')" @insert="inspectorInsertKey('light.flareIntensity')" /></div>
              <p class="hint lf-help">Efecto óptico visual; no modifica la luz ni sus sombras. Se oculta detrás de geometría mediante el addon oficial.</p>
            </template>
          </template>
          <div class="field"><label>Temperatura K</label><NumberField :model-value="lq.temperature" :step="100" :min="0" :max="20000" @update:model-value="setNum('light.temperature', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('light.temperature')" label="Temperatura" :available="true" :marked="inspectorKeyMarked('light.temperature')" @insert="inspectorInsertKey('light.temperature')" /></div>
          <p v-if="lq.temperature" class="hint lf-help">Se multiplica por el color (≈1900 vela · 2700 incandescente · 5500 día · 6500 nublado). 0 = sin temperatura.</p>
          <div v-if="obj.light.type !== 'area'" class="field"><label>Modo</label>
            <select :value="lq.mode" @change="upd({ light: { mode: $event.target.value } })">
              <option v-for="(l, k) in LIGHT_MODES" :key="k" :value="k">{{ l }}</option>
            </select>
          </div>
          <p v-if="obj.light.type !== 'area' && lq.mode !== 'dynamic'" class="hint lf-help">Las sombras se guardan en caché (más ligero) y se actualizan al editar la escena. Estas luces son las que usará el baking de iluminación.</p>
          <div v-if="obj.light.type !== 'area'" class="field"><label>Sombras</label><input type="checkbox" :checked="obj.light.shadow" @change="upd({ light: { shadow: $event.target.checked } })" /></div>
          <template v-if="obj.light.type !== 'area' && obj.light.shadow">
            <div class="field"><label>Resolución</label>
              <select :value="lq.shadowRes" @change="upd({ light: { shadowRes: +$event.target.value } })"><option v-for="r in SHADOW_RES" :key="r" :value="r">{{ r }} px</option></select>
            </div>
            <div class="field"><label>Sesgo</label><NumberField :model-value="lq.shadowBias" :step="0.0001" :min="0" :max="0.05" @update:model-value="setNum('light.shadowBias', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('light.shadowBias')" label="Sesgo" :available="true" :marked="inspectorKeyMarked('light.shadowBias')" @insert="inspectorInsertKey('light.shadowBias')" /></div>
            <div class="field"><label>Sesgo normal</label><NumberField :model-value="lq.shadowNormalBias" :step="0.01" :min="0" :max="1" @update:model-value="setNum('light.shadowNormalBias', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('light.shadowNormalBias')" label="Sesgo normal" :available="true" :marked="inspectorKeyMarked('light.shadowNormalBias')" @insert="inspectorInsertKey('light.shadowNormalBias')" /></div>
            <div v-if="obj.light.type === 'directional'" class="field"><label>Distancia (m)</label><NumberField :model-value="lq.shadowDistance" :step="5" :min="5" :max="500" @update:model-value="setNum('light.shadowDistance', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('light.shadowDistance')" label="Distancia" :available="true" :marked="inspectorKeyMarked('light.shadowDistance')" @insert="inspectorInsertKey('light.shadowDistance')" /></div>
          </template>
          <div v-if="obj.light.type !== 'area'" class="field"><label>Volumétrica</label><input type="checkbox" :checked="lq.volumetric" @change="upd({ light: { volumetric: $event.target.checked } })" data-tooltip="Dispersa luz en la niebla volumétrica (Escena → Niebla volumétrica)" /><PropertyKey v-if="inspectorKeyable('light.volumetric')" label="Volumétrica" :available="true" :marked="inspectorKeyMarked('light.volumetric')" @insert="inspectorInsertKey('light.volumetric')" /></div>
          <div v-if="obj.light.type !== 'area' && lq.volumetric" class="field"><label>Intensidad vol.</label><NumberField :model-value="lq.volIntensity" :step="0.1" :min="0" :max="20" @update:model-value="setNum('light.volIntensity', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('light.volIntensity')" label="Intensidad vol." :available="true" :marked="inspectorKeyMarked('light.volIntensity')" @insert="inspectorInsertKey('light.volIntensity')" /></div>
          <p v-if="obj.light.type !== 'area' && lq.volumetric" class="hint lf-help">Actívala también en Escena → Niebla volumétrica y usa un aspecto Realista con calidad Alta o Media.</p>
          <div class="field">
            <label>Animación</label>
            <select :value="obj.light.style || 'steady'" @change="upd({ light: { style: $event.target.value } })">
              <option v-for="(l, k) in LIGHT_STYLES" :key="k" :value="k">{{ l.label }}</option>
            </select><PropertyKey v-if="inspectorKeyable('light.style')" label="Animación" :available="true" :marked="inspectorKeyMarked('light.style')" @insert="inspectorInsertKey('light.style')" />
          </div>
          <template v-if="obj.light.style && obj.light.style !== 'steady'">
            <div class="field"><label>Velocidad</label><NumberField :model-value="obj.light.speed ?? 1" :step="0.05" :min="0" @update:model-value="setNum('light.speed', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('light.speed')" label="Velocidad" :available="true" :marked="inspectorKeyMarked('light.speed')" @insert="inspectorInsertKey('light.speed')" /></div>
            <div class="field"><label>Intensidad fx</label><NumberField :model-value="obj.light.amount ?? 0.5" :step="0.05" :min="0" :max="1" @update:model-value="setNum('light.amount', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('light.amount')" label="Intensidad fx" :available="true" :marked="inspectorKeyMarked('light.amount')" @insert="inspectorInsertKey('light.amount')" /></div>
          </template>
          <p v-if="obj.light.type !== 'omni'" class="hint lf-help">La luz apunta hacia -Z (la flecha amarilla).</p>
        </div>
      </section>

      <section v-if="obj.type === 'spawn'" class="sect" data-fold-id="spawn">
        <header><Icon name="spawn" :size="13" /> Spawn</header>
        <div class="body">
          <div class="field"><label>Etiqueta</label><input type="text" :value="obj.props.tag" @input="upd({ props: { tag: $event.target.value } }, false)" @change="commitNum" /><PropertyKey v-if="inspectorKeyable('spawn.tag')" label="Etiqueta" :available="true" :marked="inspectorKeyMarked('spawn.tag')" @insert="inspectorInsertKey('spawn.tag')" /></div>
          <ProfileSlot :obj="obj" label="Perfil (jugador)" />
          <p class="hint lf-help">El perfil de post-proceso se aplica a la cámara del jugador al aparecer aquí.</p>
        </div>
      </section>

      <section v-if="cv" class="sect" data-fold-id="canvas">
        <header><Icon name="ui" :size="13" /> Canvas</header>
        <div class="body">
          <div class="field"><label>Uso</label>
            <select :value="cv.role || ''" data-testid="canvas-role" @change="cvRole($event.target.value)">
              <option v-for="[k, l] in ROLE_OPTIONS" :key="k" :value="k">{{ l }}</option>
              <option v-if="cv.role && SYSTEM_ROLE[cv.role]" :value="cv.role">{{ SYSTEM_ROLE[cv.role].label }} (legado)</option>
            </select>
          </div>
          <p v-if="cv.role" class="hint lf-help">{{ SYSTEM_ROLE[cv.role]?.desc }} Compatibilidad con escenas antiguas. La versión nativa se edita ahora desde Assets/UI/Sistema.</p>
          <div class="field"><label>Recurso UI</label>
            <select :value="cv.ui" @change="cvSet('ui', $event.target.value)">
              <option value="">{{ cv.role ? '— por defecto —' : '— ninguno —' }}</option>
              <option v-if="cv.ui && !cvDoc" :value="cv.ui">(falta el .ui)</option>
              <option v-for="u in store.project.uis.filter(u => !u.systemRole)" :key="u.id" :value="u.id">{{ u.name }}</option>
            </select>
          </div>
          <div class="field"><label></label>
            <button v-if="cvDoc" @click="openUiEditor(cvDoc.id)">Editar .ui…</button>
            <button v-else @click="cvNew">Crear .ui nuevo</button>
          </div>
          <div class="field"><label>Resolución</label>
            <div class="two"><NumberField :model-value="cv.refW" :step="1" :min="16" :max="16384" @update:model-value="upd({ props: { refW: $event } }, false)" @commit="commitNum" /><NumberField :model-value="cv.refH" :step="1" :min="16" :max="16384" @update:model-value="upd({ props: { refH: $event } }, false)" @commit="commitNum" /></div>
            <PropertyKey v-if="inspectorKeyable('canvas.refW')" label="Resolución ancho" :available="true" :marked="inspectorKeyMarked('canvas.refW')" @insert="inspectorInsertKey('canvas.refW')" />
            <PropertyKey v-if="inspectorKeyable('canvas.refH')" label="Resolución alto" :available="true" :marked="inspectorKeyMarked('canvas.refH')" @insert="inspectorInsertKey('canvas.refH')" />
          </div>
          <div class="field"><label>Capa</label><NumberField :model-value="cv.layer" :step="1" @update:model-value="upd({ props: { layer: $event } }, false)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('canvas.layer')" label="Capa" :available="true" :marked="inspectorKeyMarked('canvas.layer')" @insert="inspectorInsertKey('canvas.layer')" /></div>
          <div class="field"><label>Visible al iniciar</label><input type="checkbox" :checked="cv.visible !== false" @change="cvSet('visible', $event.target.checked)" /><PropertyKey v-if="inspectorKeyable('canvas.visible')" label="Visible al iniciar" :available="true" :marked="inspectorKeyMarked('canvas.visible')" @insert="inspectorInsertKey('canvas.visible')" /></div>
          <div class="field"><label>Recibe clics</label><input type="checkbox" :checked="!!cv.interactive" @change="cvSet('interactive', $event.target.checked)" /><PropertyKey v-if="inspectorKeyable('canvas.interactive')" label="Recibe clics" :available="true" :marked="inspectorKeyMarked('canvas.interactive')" @insert="inspectorInsertKey('canvas.interactive')" /></div>
          <div class="field"><label>Modal</label><input type="checkbox" :checked="!!cv.modal" @change="cvSet('modal', $event.target.checked)" /><PropertyKey v-if="inspectorKeyable('canvas.modal')" label="Modal" :available="true" :marked="inspectorKeyMarked('canvas.modal')" @insert="inspectorInsertKey('canvas.modal')" /></div>
          <div class="field"><label>Opacidad</label><NumberField :model-value="cv.alpha" :step="0.01" :min="0" :max="1" @update:model-value="upd({ props: { alpha: $event } }, false)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('canvas.alpha')" label="Opacidad" :available="true" :marked="inspectorKeyMarked('canvas.alpha')" @insert="inspectorInsertKey('canvas.alpha')" /></div>
          <p class="hint lf-help">Modal: libera el ratón y pausa el juego mientras esté visible (Esc lo oculta). Dibuja el .ui sobre el juego mientras el nodo esté activo. Desde scripts: <code>game.ui.canvas("{{ obj.name }}").visible = false</code>. Los Canvas nuevos son para interfaces propias. Las interfaces del motor están en Assets/UI/Sistema y se activan automáticamente.</p>
        </div>
      </section>

      <section v-if="obj.type === 'camera'" class="sect" data-fold-id="camera">
        <header><Icon name="camera" :size="13" /> Cámara</header>
        <div class="body">
          <div class="field"><label>Cámara principal</label><input type="checkbox" :checked="!!obj.props.main" @change="setMainCamera($event.target.checked)" /><PropertyKey v-if="inspectorKeyable('camera.main')" label="Cámara principal" :available="true" :marked="inspectorKeyMarked('camera.main')" @insert="inspectorInsertKey('camera.main')" /></div>
          <p class="hint lf-help">La principal es la que dibuja el juego (cámara fija, como Main Camera de Unity). Sin ella, el juego usa la cámara del jugador, que solo existe si hay un CharacterBody3D designado o generado mediante API. Sin ninguna, no hay cámara activa.</p>
          <div class="field"><label>FOV °</label><NumberField :model-value="obj.props.fov" :step="1" :min="10" :max="140" @update:model-value="upd({ props: { fov: $event } }, false)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('camera.fov')" label="FOV" :available="true" :marked="inspectorKeyMarked('camera.fov')" @insert="inspectorInsertKey('camera.fov')" /></div>
          <ProfileSlot :obj="obj" /></div>
      </section>

      <section v-if="obj.type === 'cameraShake'" class="sect" data-fold-id="camera-shake">
        <header><Icon name="camera-shake" :size="13" /> Camera Shake Base</header>
        <div class="body">
          <div class="field"><label>Cámara objetivo</label><select :value="obj.props.camera || ''" @change="sp('camera', $event.target.value, true)">
            <option value="">— seleccionar cámara —</option>
            <option value="player">Cámara del jugador</option>
            <option v-for="cam in store.project.objects.filter(o => o.type === 'camera')" :key="cam.id" :value="cam.id">{{ cam.name }}</option>
          </select><PropertyKey v-if="inspectorKeyable('shake.camera')" label="Cámara objetivo" :available="true" :marked="inspectorKeyMarked('shake.camera')" @insert="inspectorInsertKey('shake.camera')" /></div>
          <p class="hint lf-help">Solo afecta la cámara activa. Una referencia eliminada no produce efecto.</p>
          <div class="field"><label>Activado</label><input type="checkbox" :checked="obj.props.enabled !== false" @change="sp('enabled', $event.target.checked, true)" /><PropertyKey v-if="inspectorKeyable('shake.enabled')" label="Activado" :available="true" :marked="inspectorKeyMarked('shake.enabled')" @insert="inspectorInsertKey('shake.enabled')" /></div>
          <div class="field"><label>Reproducir al iniciar</label><input type="checkbox" :checked="obj.props.autoPlay !== false" @change="sp('autoPlay', $event.target.checked, true)" /><PropertyKey v-if="inspectorKeyable('shake.autoPlay')" label="Reproducir al iniciar" :available="true" :marked="inspectorKeyMarked('shake.autoPlay')" @insert="inspectorInsertKey('shake.autoPlay')" /></div>
          <div class="field"><label>Bucle</label><input type="checkbox" :checked="obj.props.loop !== false" @change="sp('loop', $event.target.checked, true)" /><PropertyKey v-if="inspectorKeyable('shake.loop')" label="Bucle" :available="true" :marked="inspectorKeyMarked('shake.loop')" @insert="inspectorInsertKey('shake.loop')" /></div>
          <div class="field"><label>Patrón</label><select :value="obj.props.pattern || 'sine'" @change="sp('pattern', $event.target.value, true)">
            <option value="sine">Oscilación sinusoidal</option><option value="noise">Ruido suave</option><option value="clip">Curvas de animación</option>
          </select><PropertyKey v-if="inspectorKeyable('shake.pattern')" label="Patrón" :available="true" :marked="inspectorKeyMarked('shake.pattern')" @insert="inspectorInsertKey('shake.pattern')" /></div>
          <template v-if="obj.props.pattern === 'clip'">
            <div class="field"><label>Animación</label><select :value="obj.props.clip || ''" @change="sp('clip', $event.target.value, true)">
              <option value="">— seleccionar clip —</option>
              <option v-for="c in (store.project.animations || [])" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select><PropertyKey v-if="inspectorKeyable('shake.clip')" label="Animación" :available="true" :marked="inspectorKeyMarked('shake.clip')" @insert="inspectorInsertKey('shake.clip')" /></div>
            <p class="hint lf-help">Usa las pistas raíz de Posición y Rotación (°). El clip se reproduce como desplazamiento visual; sus eventos y pistas de otros nodos no se ejecutan. La reproducción utiliza clips existentes del proyecto; Cinematics no permite editarlos.</p>
          </template>
          <div v-if="obj.props.pattern !== 'clip'" class="field"><label>Desplazamiento XYZ (m)</label><Vec3Field :model-value="obj.props.position || [0, 0, 0]" :step="0.005" @change="({ value, commit }) => upd({ props: { position: value } }, commit)" /><PropertyKey v-if="inspectorKeyable('shake.position')" label="Desplazamiento XYZ (m)" :available="true" :marked="inspectorKeyMarked('shake.position')" @insert="inspectorInsertKey('shake.position')" /></div>
          <div v-if="obj.props.pattern !== 'clip'" class="field"><label>Rotación XYZ (°)</label><Vec3Field :model-value="obj.props.rotation || [0, 0, 0]" :step="0.05" @change="({ value, commit }) => upd({ props: { rotation: value } }, commit)" /><PropertyKey v-if="inspectorKeyable('shake.rotation')" label="Rotación XYZ (°)" :available="true" :marked="inspectorKeyMarked('shake.rotation')" @insert="inspectorInsertKey('shake.rotation')" /></div>
          <div v-if="obj.props.pattern !== 'clip'" class="field"><label>Frecuencia (Hz)</label><NumberField :model-value="obj.props.frequency ?? 0.65" :step="0.05" :min="0.05" :max="10" @update:model-value="sp('frequency', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('shake.frequency')" label="Frecuencia (Hz)" :available="true" :marked="inspectorKeyMarked('shake.frequency')" @insert="inspectorInsertKey('shake.frequency')" /></div>
          <template v-if="obj.props.pattern !== 'clip'">
            <div class="field"><label>Frecuencia XYZ · desplazamiento (×)</label><Vec3Field :model-value="obj.props.positionFrequency || [1, 1, 1]" :step="0.05" @change="({ value, commit }) => upd({ props: { positionFrequency: value } }, commit)" /><PropertyKey v-if="inspectorKeyable('shake.positionFrequency')" label="Frecuencia XYZ · desplazamiento (×)" :available="true" :marked="inspectorKeyMarked('shake.positionFrequency')" @insert="inspectorInsertKey('shake.positionFrequency')" /></div>
            <div class="field"><label>Frecuencia XYZ · rotación (×)</label><Vec3Field :model-value="obj.props.rotationFrequency || [1, 1, 1]" :step="0.05" @change="({ value, commit }) => upd({ props: { rotationFrequency: value } }, commit)" /><PropertyKey v-if="inspectorKeyable('shake.rotationFrequency')" label="Frecuencia XYZ · rotación (×)" :available="true" :marked="inspectorKeyMarked('shake.rotationFrequency')" @insert="inspectorInsertKey('shake.rotationFrequency')" /></div>
            <div class="field"><label>Fase XYZ · desplazamiento (°)</label><Vec3Field :model-value="obj.props.positionPhase || [0, 0, 0]" :step="5" @change="({ value, commit }) => upd({ props: { positionPhase: value } }, commit)" /><PropertyKey v-if="inspectorKeyable('shake.positionPhase')" label="Fase XYZ · desplazamiento (°)" :available="true" :marked="inspectorKeyMarked('shake.positionPhase')" @insert="inspectorInsertKey('shake.positionPhase')" /></div>
            <div class="field"><label>Fase XYZ · rotación (°)</label><Vec3Field :model-value="obj.props.rotationPhase || [0, 0, 0]" :step="5" @change="({ value, commit }) => upd({ props: { rotationPhase: value } }, commit)" /><PropertyKey v-if="inspectorKeyable('shake.rotationPhase')" label="Fase XYZ · rotación (°)" :available="true" :marked="inspectorKeyMarked('shake.rotationPhase')" @insert="inspectorInsertKey('shake.rotationPhase')" /></div>
            <div class="field"><label>Duración del impulso (s, 0 = automático)</label><NumberField :model-value="obj.props.duration ?? 0" :step="0.05" :min="0" :max="30" @update:model-value="sp('duration', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('shake.duration')" label="Duración del impulso (s, 0 = automático)" :available="true" :marked="inspectorKeyMarked('shake.duration')" @insert="inspectorInsertKey('shake.duration')" /></div>
          </template>
          <div class="field"><label>Blend In (s)</label><NumberField :model-value="obj.props.blendIn ?? 0" :step="0.05" :min="0" :max="10" @update:model-value="sp('blendIn', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('shake.blendIn')" label="Blend In (s)" :available="true" :marked="inspectorKeyMarked('shake.blendIn')" @insert="inspectorInsertKey('shake.blendIn')" /></div>
          <div class="field"><label>Blend Out (s)</label><NumberField :model-value="obj.props.blendOut ?? 0" :step="0.05" :min="0" :max="10" @update:model-value="sp('blendOut', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('shake.blendOut')" label="Blend Out (s)" :available="true" :marked="inspectorKeyMarked('shake.blendOut')" @insert="inspectorInsertKey('shake.blendOut')" /></div>
          <p class="hint lf-help">Sin bucle, Blend Out suaviza el final del efecto. En Curvas, la duración y velocidad provienen del clip. La reproducción manual mediante API llegará en G003.</p>
        </div>
      </section>

      <section v-if="obj.type === 'gameplayObject'" class="sect" data-fold-id="gameplay-object">
        <header><Icon name="gameplay-object" :size="13" /> Objeto interactuable</header>
        <div class="body">
          <div class="field"><label>Tipo</label><select :value="obj.props.recordKind" @change="upd({ props: { recordKind: $event.target.value, recordId: 0 } })">
            <option value="items">Objeto</option><option value="weapons">Arma</option>
          </select></div>
          <div class="field"><label>Database</label><select :value="obj.props.recordId" @change="sp('recordId', Number($event.target.value), true)">
            <option :value="0">— seleccionar —</option>
            <option v-for="r in (store.project.database?.[obj.props.recordKind] || [])" :key="r.id" :value="r.id">{{ String(r.id).padStart(3, '0') }} · {{ r.name }}</option>
          </select></div>
          <div class="field"><label>Recogida</label><select :value="obj.props.mode || 'inventory'" @change="sp('mode', $event.target.value, true)">
            <option value="inventory">Añadir al inventario</option>
            <option value="direct">Sostener sin inventario</option>
          </select></div>
          <div class="field"><label>Slot</label><select :value="obj.props.slot || 'right'" @change="sp('slot', $event.target.value, true)">
            <option v-for="s in (store.project.database?.player?.slots || [])" :key="s.id" :value="s.id">{{ s.label || s.id }}</option>
          </select></div>
          <div v-if="obj.props.recordKind === 'weapons'" class="field"><label>Enemigo objetivo</label><select :value="obj.props.targetEnemy || 0" @change="sp('targetEnemy', Number($event.target.value), true)">
            <option :value="0">— ninguno —</option>
            <option v-for="r in (store.project.database?.enemies || [])" :key="r.id" :value="r.id">{{ r.name }}</option>
          </select></div>
          <div class="field"><label>Alcance (m)</label><NumberField :model-value="obj.props.reach ?? 2.2" :step="0.1" :min="0.5" :max="12" @update:model-value="sp('reach', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('gameplayObject.reach')" label="Alcance (m)" :available="true" :marked="inspectorKeyMarked('gameplayObject.reach')" @insert="inspectorInsertKey('gameplayObject.reach')" /></div>
          <div class="field"><label data-tooltip="Mostrar al acercarse">Indicador</label><input type="checkbox" :checked="obj.props.showIndicator !== false" @change="sp('showIndicator', $event.target.checked, true)" /><PropertyKey v-if="inspectorKeyable('gameplayObject.showIndicator')" label="Indicador" :available="true" :marked="inspectorKeyMarked('gameplayObject.showIndicator')" @insert="inspectorInsertKey('gameplayObject.showIndicator')" /></div>
          <InteractionZonesPanel v-if="obj.props.showIndicator !== false" :model-value="obj.props.indicatorZones" :reach="obj.props.reach ?? 2.2" @change="upd({ props: { indicatorZones: $event.value } }, $event.commit)" />
          <p class="hint">Usa el modelo y Physics del registro. No necesita páginas de evento ni JavaScript.</p>
        </div>
      </section>

      <section v-if="obj.type === 'event'" class="sect" data-fold-id="event">
        <header><Icon name="event" :size="13" /> Evento</header>
        <div class="body">
          <button class="wide primary" @click="openEventEditor(obj.id)"><Icon name="event" :size="14" />Editar páginas y comandos… <kbd>Intro</kbd></button>
          <div class="field"><label>Páginas</label><span>{{ obj.props.pages?.length || 0 }} · {{ (obj.props.pages || []).reduce((n, p) => n + (p.list?.length || 0), 0) }} comando(s) raíz</span></div>
          <div class="field"><label>Color</label><ColorInput :value="obj.color" @input="upd({ color: $event.target.value }, false)" @change="commitNum" /><PropertyKey v-if="inspectorKeyable('event.color')" label="Color" :available="true" :marked="inspectorKeyMarked('event.color')" @insert="inspectorInsertKey('event.color')" /></div>
          <p class="hint lf-help">El tamaño del nodo es la zona del evento. Pulsa F5 para jugar y probarlo.</p>
        </div>
      </section>

      <section v-if="audioHost" class="sect" data-fold-id="audio-source">
        <header><Icon name="audio" :size="13" /> {{ obj.type === 'light' ? 'Audio Source (componente)' : 'Fuente de audio' }}</header>
        <div class="body">
          <div class="field"><label>Clip</label>
            <ResourceDropSlot :kinds="['audio', 'file']" :accepted-ids="audioAssetIds"
              @assign="sp('clip', $event, true)" @reject="toast('Suelta un único clip de audio válido de Assets', 'error')">
              <div class="clipRow">
                <select :value="aq.clip" @change="sp('clip', $event.target.value, true)">
                  <option value="">— ninguno —</option>
                  <option v-if="aq.clip && !audioAssetIds.includes(aq.clip)" :value="aq.clip">(falta: {{ aq.clip }})</option>
                  <option v-for="a in audioAssets" :key="a.id" :value="a.id">{{ a.name }}</option>
                </select>
                <button :disabled="!aq.clip" :data-tooltip="store.audioPrev === aq.clip ? 'Detener' : 'Probar'" @click="store.audioPrev === aq.clip ? stopPreview() : previewClip(aq.clip, { group: aq.group, volume: aq.volume, pitch: aq.pitch, loop: aq.loop, mode: aq.mode })"><Icon :name="store.audioPrev === aq.clip ? 'stop' : 'play'" :size="12" /></button>
              </div>
            </ResourceDropSlot><PropertyKey v-if="inspectorKeyable('audio.clip')" label="Clip" :available="true" :marked="inspectorKeyMarked('audio.clip')" @insert="inspectorInsertKey('audio.clip')" />
          </div>
          <p v-if="!audioAssets.length" class="hint keep">Importa audio (mp3, wav, ogg…) al panel Proyecto para usarlo aquí.</p>
          <div class="field"><label>Salida</label>
            <select :value="aq.group" @change="sp('group', $event.target.value, true)"><option v-for="g in store.project.audio.groups.filter((g) => g.id !== 'master')" :key="g.id" :value="g.id">{{ g.name }}</option></select>
            <PropertyKey v-if="inspectorKeyable('audio.group')" label="Salida" :available="true" :marked="inspectorKeyMarked('audio.group')" @insert="inspectorInsertKey('audio.group')" />
          </div>
          <div class="field"><label>Tipo</label>
            <div class="seg"><button :class="{ on: aq.mode === '3d' }" @click="sp('mode', '3d', true)">3D</button><button :class="{ on: aq.mode === 'ui' }" @click="sp('mode', 'ui', true)">UI</button></div>
            <PropertyKey v-if="inspectorKeyable('audio.mode')" label="Tipo" :available="true" :marked="inspectorKeyMarked('audio.mode')" @insert="inspectorInsertKey('audio.mode')" />
          </div>
          <p class="hint">{{ aq.mode === '3d' ? 'Suena desde su posición en la escena: volumen y panorama dependen de la distancia al jugador.' : 'Suena igual en todas partes (música de menú, clics, voz del narrador).' }}</p>
          <div class="field"><label>Silenciar</label><input type="checkbox" :checked="aq.mute" @change="sp('mute', $event.target.checked, true)" /><PropertyKey v-if="inspectorKeyable('audio.mute')" label="Silenciar" :available="true" :marked="inspectorKeyMarked('audio.mute')" @insert="inspectorInsertKey('audio.mute')" /></div>
          <div class="field"><label>Al empezar</label><input type="checkbox" :checked="aq.playOnStart" @change="sp('playOnStart', $event.target.checked, true)" data-tooltip="Reproducir al empezar (Play On Awake)" /><PropertyKey v-if="inspectorKeyable('audio.playOnStart')" label="Al empezar" :available="true" :marked="inspectorKeyMarked('audio.playOnStart')" @insert="inspectorInsertKey('audio.playOnStart')" /></div>
          <div class="field"><label>Bucle</label><input type="checkbox" :checked="aq.loop" @change="sp('loop', $event.target.checked, true)" /><PropertyKey v-if="inspectorKeyable('audio.loop')" label="Bucle" :available="true" :marked="inspectorKeyMarked('audio.loop')" @insert="inspectorInsertKey('audio.loop')" /></div>
          <div class="field"><label>Volumen</label><div class="sl"><input type="range" min="0" max="2" step="0.01" :value="aq.volume" @input="sp('volume', +$event.target.value)" @change="commitNum" /><em>{{ aq.volume.toFixed(2) }}</em></div><PropertyKey v-if="inspectorKeyable('audio.volume')" label="Volumen" :available="true" :marked="inspectorKeyMarked('audio.volume')" @insert="inspectorInsertKey('audio.volume')" /></div>
          <div class="field"><label>Tono</label><div class="sl"><input type="range" min="0.1" max="4" step="0.01" :value="aq.pitch" @input="sp('pitch', +$event.target.value)" @change="commitNum" /><em>{{ aq.pitch.toFixed(2) }}</em></div><PropertyKey v-if="inspectorKeyable('audio.pitch')" label="Tono" :available="true" :marked="inspectorKeyMarked('audio.pitch')" @insert="inspectorInsertKey('audio.pitch')" /></div>
          <div class="field"><label>Retardo (s)</label><NumberField :model-value="aq.delay" :step="0.1" :min="0" :max="60" @update:model-value="sp('delay', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('audio.delay')" label="Retardo (s)" :available="true" :marked="inspectorKeyMarked('audio.delay')" @insert="inspectorInsertKey('audio.delay')" /></div>
          <template v-if="aq.mode === '3d'">
            <div class="sub3">Ajustes 3D</div>
            <div class="field"><label>Distancia mín.</label><NumberField :model-value="aq.minDistance" :step="0.5" :min="0.1" @update:model-value="sp('minDistance', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('audio.minDistance')" label="Distancia mín." :available="true" :marked="inspectorKeyMarked('audio.minDistance')" @insert="inspectorInsertKey('audio.minDistance')" /></div>
            <div class="field"><label>Distancia máx.</label><NumberField :model-value="aq.maxDistance" :step="1" :min="0.5" @update:model-value="sp('maxDistance', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('audio.maxDistance')" label="Distancia máx." :available="true" :marked="inspectorKeyMarked('audio.maxDistance')" @insert="inspectorInsertKey('audio.maxDistance')" /></div>
            <div class="field"><label>Atenuación</label>
              <select :value="aq.rolloff" @change="sp('rolloff', $event.target.value, true)"><option v-for="(l, k) in ROLLOFFS" :key="k" :value="k">{{ l }}</option></select>
  <PropertyKey v-if="inspectorKeyable('audio.rolloff')" label="Atenuación" :available="true" :marked="inspectorKeyMarked('audio.rolloff')" @insert="inspectorInsertKey('audio.rolloff')" />
          </div>
            <div class="field"><label>Cono interior °</label><NumberField :model-value="aq.coneInner" :step="5" :min="0" :max="360" @update:model-value="sp('coneInner', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('audio.coneInner')" label="Cono interior °" :available="true" :marked="inspectorKeyMarked('audio.coneInner')" @insert="inspectorInsertKey('audio.coneInner')" /></div>
            <div class="field"><label>Cono exterior °</label><NumberField :model-value="aq.coneOuter" :step="5" :min="0" :max="360" @update:model-value="sp('coneOuter', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('audio.coneOuter')" label="Cono exterior °" :available="true" :marked="inspectorKeyMarked('audio.coneOuter')" @insert="inspectorInsertKey('audio.coneOuter')" /></div>
            <div v-if="aq.coneOuter < 360" class="field"><label>Volumen fuera</label><input type="range" min="0" max="1" step="0.01" :value="aq.coneOuterGain" @input="sp('coneOuterGain', +$event.target.value)" @change="commitNum" /><PropertyKey v-if="inspectorKeyable('audio.coneOuterGain')" label="Volumen fuera" :available="true" :marked="inspectorKeyMarked('audio.coneOuterGain')" @insert="inspectorInsertKey('audio.coneOuterGain')" /></div>
            <div class="field"><label>HRTF</label><input type="checkbox" :checked="aq.hrtf" @change="sp('hrtf', $event.target.checked, true)" data-tooltip="Panorama binaural (auriculares): más realista, algo más pesado" /><PropertyKey v-if="inspectorKeyable('audio.hrtf')" label="HRTF" :available="true" :marked="inspectorKeyMarked('audio.hrtf')" @insert="inspectorInsertKey('audio.hrtf')" /></div>
            <div class="field"><label>Oclusión</label><input type="checkbox" :checked="aq.occlusion" @change="sp('occlusion', $event.target.checked, true)" data-tooltip="Las paredes atenúan y filtran este sonido 3D. Desactivado por defecto para conservar proyectos anteriores." /><PropertyKey v-if="inspectorKeyable('audio.occlusion')" label="Oclusión" :available="true" :marked="inspectorKeyMarked('audio.occlusion')" @insert="inspectorInsertKey('audio.occlusion')" /></div>
            <p class="hint lf-help">Dentro de la distancia mínima suena a todo volumen; la máxima es el alcance del anillo exterior en el editor.</p>
          </template>
          <p class="hint lf-help">Desde un script: <code>game.audio.source("{{ obj.name }}").play()</code></p>
        </div>
      </section>

      <section v-if="obj.type === 'critters'" class="sect" data-fold-id="critters">
        <header><Icon name="critters" :size="13" /> Cluster de animales</header>
        <div class="body">
          <div class="field"><label>Especie</label><select :value="species.id" @change="setSpecies($event.target.value)"><option v-for="[k, l] in SPECIES_LIST()" :key="k" :value="k">{{ l }}</option></select></div>
          <ParamForm :params="species.params" :values="critterVals()" timeline-prefix="critters"
            :timeline-keyable="inspectorKeyable" :timeline-marked="inspectorKeyMarked"
            @insert-key="inspectorInsertKey" @change="upd({}, true)" />
          <p class="hint lf-help">Salen al anochecer, parpadean sincronizadas y se refugian con lluvia o viento fuerte (IA: máquina de estados). Sin «Hora» activa en la escena están siempre activas.</p>
        </div>
      </section>

      <section v-if="obj.type === 'trigger'" class="sect" data-fold-id="trigger">
        <header><Icon name="trigger" :size="13" /> Trigger</header>
        <div class="body">
          <div class="field"><label>Etiqueta</label><input type="text" :value="obj.props.tag" @input="upd({ props: { tag: $event.target.value } }, false)" @change="commitNum" /><PropertyKey v-if="inspectorKeyable('trigger.tag')" label="Etiqueta" :available="true" :marked="inspectorKeyMarked('trigger.tag')" @insert="inspectorInsertKey('trigger.tag')" /></div>
          <div class="field"><label>Color</label><ColorInput :value="obj.color" @input="upd({ color: $event.target.value }, false)" @change="commitNum" /><PropertyKey v-if="inspectorKeyable('trigger.color')" label="Color" :available="true" :marked="inspectorKeyMarked('trigger.color')" @insert="inspectorInsertKey('trigger.color')" /></div>
          <!-- Slots opcionales: nombre de una función definida con game.define("nombre", fn) en un script del proyecto. Vacío = no hace nada (y no cuesta nada). -->
          <div class="field"><label>Al entrar</label><input type="text" list="lf-trigger-fns" placeholder="función (opcional)" :value="obj.props.onEnter || ''" @input="sp('onEnter', $event.target.value)" @change="commitNum" /><PropertyKey v-if="inspectorKeyable('trigger.onEnter')" label="Al entrar" :available="true" :marked="inspectorKeyMarked('trigger.onEnter')" @insert="inspectorInsertKey('trigger.onEnter')" /></div>
          <div class="field"><label>Al salir</label><input type="text" list="lf-trigger-fns" placeholder="función (opcional)" :value="obj.props.onExit || ''" @input="sp('onExit', $event.target.value)" @change="commitNum" /><PropertyKey v-if="inspectorKeyable('trigger.onExit')" label="Al salir" :available="true" :marked="inspectorKeyMarked('trigger.onExit')" @insert="inspectorInsertKey('trigger.onExit')" /></div>
          <div class="field"><label>Mirada</label><input type="checkbox" :checked="!!obj.props.look" @change="sp('look', $event.target.checked, true)" /><PropertyKey v-if="inspectorKeyable('trigger.look')" label="Mirada" :available="true" :marked="inspectorKeyMarked('trigger.look')" @insert="inspectorInsertKey('trigger.look')" /></div>
          <template v-if="obj.props.look">
            <div class="field"><label>Alcance (m)</label><NumberField :model-value="obj.props.lookDistance ?? 3" :step="0.5" :min="0.5" :max="50" @update:model-value="sp('lookDistance', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('trigger.lookDistance')" label="Alcance (m)" :available="true" :marked="inspectorKeyMarked('trigger.lookDistance')" @insert="inspectorInsertKey('trigger.lookDistance')" /></div>
            <div class="field"><label>Al mirar</label><input type="text" list="lf-trigger-fns" placeholder="función (opcional)" :value="obj.props.onLook || ''" @input="sp('onLook', $event.target.value)" @change="commitNum" /><PropertyKey v-if="inspectorKeyable('trigger.onLook')" label="Al mirar" :available="true" :marked="inspectorKeyMarked('trigger.onLook')" @insert="inspectorInsertKey('trigger.onLook')" /></div>
            <div class="field"><label>Al dejar de mirar</label><input type="text" list="lf-trigger-fns" placeholder="función (opcional)" :value="obj.props.onLookEnd || ''" @input="sp('onLookEnd', $event.target.value)" @change="commitNum" /><PropertyKey v-if="inspectorKeyable('trigger.onLookEnd')" label="Al dejar de mirar" :available="true" :marked="inspectorKeyMarked('trigger.onLookEnd')" @insert="inspectorInsertKey('trigger.onLookEnd')" /></div>
          </template>
          <datalist id="lf-trigger-fns"><option v-for="n in scriptFns" :key="n" :value="n"></option></datalist>
          <p class="hint lf-help">Sin slots, el Trigger solo avisa a <code>game.on("triggerEnter" | "triggerExit")</code>. «Mirada» lanza un rayo por fotograma desde la cámara (solo mientras algún Trigger la tenga activada) y avisa con <code>game.on("triggerLook" | "triggerLookEnd")</code>. Los slots reciben <code>{ id, name, tag }</code>.</p>
        </div>
      </section>

      <section v-if="obj.type === 'postvolume'" class="sect" data-testid="post-volume-panel" data-fold-id="postprocess-volume">
        <header><Icon name="postvolume" :size="13" /> PostProcessVolume</header>
        <div class="body">
          <div class="field"><label>Activo</label><input type="checkbox" :checked="obj.props.enabled !== false" @change="sp('enabled', $event.target.checked, true)" /><PropertyKey v-if="inspectorKeyable('post.enabled')" label="Activo" :available="true" :marked="inspectorKeyMarked('post.enabled')" @insert="inspectorInsertKey('post.enabled')" /></div>
          <div class="field"><label>Forma</label><select :value="obj.props.shape || 'box'" @change="sp('shape', $event.target.value, true)"><option value="box">Caja</option><option value="sphere">Esfera</option></select><PropertyKey v-if="inspectorKeyable('post.shape')" label="Forma" :available="true" :marked="inspectorKeyMarked('post.shape')" @insert="inspectorInsertKey('post.shape')" /></div>
          <ProfileSlot :obj="obj" label="Perfil (.post)"><template #property-key><PropertyKey v-if="inspectorKeyable('post.profile')" label="Perfil (.post)" :available="true" :marked="inspectorKeyMarked('post.profile')" @insert="inspectorInsertKey('post.profile')" /></template></ProfileSlot>
          <div class="field"><label>Prioridad</label><NumberField :model-value="obj.props.priority ?? 0" :step="1" :min="-100" :max="100" @update:model-value="sp('priority', Math.round($event))" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('post.priority')" label="Prioridad" :available="true" :marked="inspectorKeyMarked('post.priority')" @insert="inspectorInsertKey('post.priority')" /></div>
          <div class="field"><label>Peso</label><NumberField :model-value="obj.props.weight ?? 1" :step="0.05" :min="0" :max="1" @update:model-value="sp('weight', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('post.weight')" label="Peso" :available="true" :marked="inspectorKeyMarked('post.weight')" @insert="inspectorInsertKey('post.weight')" /></div>
          <div class="field"><label>Distancia de mezcla (m)</label><NumberField :model-value="obj.props.blendDistance ?? 2" :step="0.25" :min="0" :max="100" @update:model-value="sp('blendDistance', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('post.blendDistance')" label="Distancia de mezcla (m)" :available="true" :marked="inspectorKeyMarked('post.blendDistance')" @insert="inspectorInsertKey('post.blendDistance')" /></div>
          <div class="field"><label>Transición (s)</label><NumberField :model-value="obj.props.blendTime ?? 0.5" :step="0.1" :min="0" :max="10" @update:model-value="sp('blendTime', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('post.blendTime')" label="Transición (s)" :available="true" :marked="inspectorKeyMarked('post.blendTime')" @insert="inspectorInsertKey('post.blendTime')" /></div>
          <div class="field"><label>Color de edición</label><ColorInput :value="obj.color" @input="upd({ color: $event.target.value }, false)" @change="commitNum" /><PropertyKey v-if="inspectorKeyable('post.color')" label="Color de edición" :available="true" :marked="inspectorKeyMarked('post.color')" @insert="inspectorInsertKey('post.color')" /></div>
          <p class="hint lf-help">El volumen se evalúa desde la cámara activa. Fuera de la caja o esfera, el perfil se difumina según la distancia; un override de script/evento manda por encima. No necesita colisión. Para esfera, se toma como radio la mitad del mayor eje de escala.</p>
        </div>
      </section>

      <section v-if="obj.type === 'atmovolume'" class="sect" data-fold-id="atmospheric-volume">
        <header><Icon name="atmovolume" :size="13" /> Volumen atmosférico</header>
        <div class="body">
          <div class="field"><label>Color</label><ColorInput :value="obj.color" @input="upd({ color: $event.target.value }, false)" @change="commitNum" /><PropertyKey v-if="inspectorKeyable('atmo.color')" label="Color" :available="true" :marked="inspectorKeyMarked('atmo.color')" @insert="inspectorInsertKey('atmo.color')" /></div>
          <div class="field"><label>Intercambio · {{ (obj.props.exchange ?? 0).toFixed(2) }}</label><input type="range" min="0" max="1" step="0.01" :value="obj.props.exchange ?? 0" @input="sp('exchange', +$event.target.value)" @change="commitNum" data-tooltip="0 = interior cerrado (sin niebla hasta la salida) · 1 = abierto (entra toda la niebla)" /><PropertyKey v-if="inspectorKeyable('atmo.exchange')" label="Intercambio" :available="true" :marked="inspectorKeyMarked('atmo.exchange')" @insert="inspectorInsertKey('atmo.exchange')" /></div>
          <p class="hint lf-help">Con la escena en <b>Niebla: Física</b>, mientras la cámara está dentro de esta caja la niebla empieza solo después de salir de ella, escalada por (1 − intercambio): <b>0</b> deja un interior limpio (casa, cueva, túnel), <b>1</b> no cambia nada. Si hay cajas anidadas manda la más pequeña. El tamaño es la escala del nodo; solo se ve en el editor.</p>
        </div>
      </section>

      <section v-if="obj.type === 'navigation'" class="sect" data-fold-id="navigation">
        <header><Icon name="navigation" :size="13" /> Navegación</header>
        <div class="body">
          <div class="field"><label>Celda (m)</label><NumberField :model-value="obj.props.cell" :step="0.1" :min="0.1" :max="4" @update:model-value="sp('cell', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('navigation.cell')" label="Celda (m)" :available="true" :marked="inspectorKeyMarked('navigation.cell')" @insert="inspectorInsertKey('navigation.cell')" /></div>
          <div class="field"><label>Radio agente</label><NumberField :model-value="obj.props.agentRadius" :step="0.05" :min="0" :max="3" @update:model-value="sp('agentRadius', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('navigation.agentRadius')" label="Radio agente" :available="true" :marked="inspectorKeyMarked('navigation.agentRadius')" @insert="inspectorInsertKey('navigation.agentRadius')" /></div>
          <div class="field"><label>Altura agente</label><NumberField :model-value="obj.props.agentHeight" :step="0.1" :min="0.3" :max="6" @update:model-value="sp('agentHeight', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('navigation.agentHeight')" label="Altura agente" :available="true" :marked="inspectorKeyMarked('navigation.agentHeight')" @insert="inspectorInsertKey('navigation.agentHeight')" /></div>
          <div class="field"><label>Pendiente máx. °</label><NumberField :model-value="obj.props.maxSlope" :step="5" :min="1" :max="89" @update:model-value="sp('maxSlope', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('navigation.maxSlope')" label="Pendiente máx." :available="true" :marked="inspectorKeyMarked('navigation.maxSlope')" @insert="inspectorInsertKey('navigation.maxSlope')" /></div>
          <div class="field"><label data-tooltip="En Timeline cambia conexiones entre celdas ya horneadas; para actualizar celdas/erosión hay que volver a hornear.">Escalón máx.</label><NumberField :model-value="obj.props.stepHeight" :step="0.05" :min="0" :max="3" @update:model-value="sp('stepHeight', $event)" @commit="commitNum" /><PropertyKey v-if="inspectorKeyable('navigation.stepHeight')" label="Escalón máx." :available="true" :marked="inspectorKeyMarked('navigation.stepHeight')" @insert="inspectorInsertKey('navigation.stepHeight')" /></div>
          <div class="field"><label>Capas</label><NumberField :model-value="obj.props.layers" :step="1" :min="1" :max="6" @update:model-value="sp('layers', Math.round($event))" @commit="commitNum" title="Pisos superpuestos (puentes, edificios)" /><PropertyKey v-if="inspectorKeyable('navigation.layers')" label="Capas" :available="true" :marked="inspectorKeyMarked('navigation.layers')" @insert="inspectorInsertKey('navigation.layers')" /></div>
          <div class="field"><label>Color</label><ColorInput :value="obj.color" @input="upd({ color: $event.target.value }, false)" @change="commitNum" /><PropertyKey v-if="inspectorKeyable('navigation.color')" label="Color" :available="true" :marked="inspectorKeyMarked('navigation.color')" @insert="inspectorInsertKey('navigation.color')" /></div>
          <div class="actions">
            <button v-if="!store.nav.running" @click="bakeNavigation(obj.id)"><Icon name="navigation" :size="14" />{{ obj.props.asset ? 'Volver a hornear' : 'Hornear' }}</button>
            <button v-else @click="cancelNavBake()">Cancelar {{ Math.round(store.nav.fraction * 100) }}%</button>
            <button v-if="obj.props.asset && !store.nav.running" class="danger" data-tooltip="Quitar el mapa horneado" @click="clearNavigation(obj.id)"><Icon name="trash" :size="14" /></button>
          </div>
          <p v-if="obj.props.stats" class="hint keep">{{ obj.props.stats.cells }} celdas transitables · {{ obj.props.stats.nx }}×{{ obj.props.stats.nz }} · {{ obj.props.stats.seconds }} s. Los puntos azules son el suelo transitable.</p>
          <p v-else class="hint lf-help">Cubre la zona por la que andarán los personajes y pulsa Hornear. Solo cuenta la geometría fija (terreno y objetos con colisión). La región es una caja alineada con los ejes.</p>
        </div>
      </section>


      <div class="actions">
        <button data-tooltip="Enfocar (F)" @click="store.editor.focus()"><Icon name="frame" :size="14" />Enfocar</button>
        <button @click="duplicateObject(obj.id)"><Icon name="copy" :size="14" />Duplicar</button>
        <button class="danger" @click="removeObject(obj.id)"><Icon name="trash" :size="14" /></button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.insp { padding-bottom: 20px; }
.node-script-count { margin-left: auto; color: var(--text-3); font-variant-numeric: tabular-nums; }
.node-script-entry { display:flex; align-items:center; gap:4px; min-width:0; padding:5px 2px; border-bottom:1px solid var(--hair); }
.node-script-entry button { flex:none; padding:2px; width:21px; height:23px; display:inline-flex; align-items:center; justify-content:center; background:transparent; border-color:transparent; }
.node-script-entry button:hover, .node-script-entry button:focus-visible { background:var(--g-700); border-color:var(--hair); }
.node-script-entry button:disabled { opacity:.35; }
.node-script-name { flex:1; min-width:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; font-size:11px; }
.node-script-name small { display:block; color:var(--red, #c77); font-size:10px; }
.node-script-missing { color:var(--red, #c77); }
.node-script-handle { color:var(--text-3); cursor:grab; flex:none; }
.node-script-grip { display:inline-flex; cursor:grab; }
.node-script-up { transform:rotate(180deg); }
.node-script-add { margin-top:5px; }
.node-script-add select { min-width:0; width:100%; }

.empty { padding: 36px 20px; text-align: center; color: var(--text-3); line-height: 1.6; }
.empty .big { opacity: .5; margin-bottom: 8px; display: flex; justify-content: center; }
.node-empty { margin: 8px; color: var(--text-3); }
.head { padding: 10px 10px 8px; display: flex; gap: 10px; align-items: center; color: var(--text-2); background: var(--g-850); border-bottom: 1px solid #000; }
.ico { width: 38px; height: 38px; flex: none; display: grid; place-items: center; border-radius: 6px; background: var(--g-800); border: 1px solid var(--g-700); color: var(--c, var(--text)); }
.hcol { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.hrow { display: flex; align-items: center; gap: 6px; min-width: 0; }
.act { margin: 0; flex: none; }
.name { flex: 1; min-width: 0; font-weight: 600; font-size: 13px; background: var(--g-800); border: 1px solid var(--g-700); color: var(--text); height: 24px; }
.name:hover { border-color: var(--g-600); } .name:focus { border-color: var(--blue); }
.node-lock { flex: none; display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--text); white-space: nowrap; }
.node-lock input { margin: 0; flex: none; }
.hrow.sub { font-size: 11px; color: var(--text-3); }
.node-type { color:var(--text-2);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:45%; }
.tag { white-space: nowrap; color: var(--text-2); background: var(--g-800); border: 1px solid var(--g-700); border-radius: 3px; padding: 0 6px; line-height: 16px; flex: none; }
.path { flex:1;min-width:0;overflow: hidden; text-overflow: ellipsis; white-space: nowrap; direction: rtl; text-align: left; }
.clipRow { display: flex; gap: 4px; min-width: 0; } .clipRow select { flex: 1; min-width: 0; } .clipRow button { width: 26px; padding: 0; flex: none; }
.seg { display: flex; } .seg button { flex: 1; border-radius: 0; } .seg button:first-child { border-radius: 3px 0 0 3px; } .seg button:last-child { border-radius: 0 3px 3px 0; margin-left: -1px; }
.seg button.on { background: var(--blue); border-color: var(--blue); color: #fff; }
.sl { display: flex; align-items: center; gap: 6px; } .sl input { flex: 1; min-width: 0; } .sl em { font-style: normal; font-size: 11px; color: var(--text-2); width: 34px; text-align: right; font-variant-numeric: tabular-nums; }
.material-control { min-width: 0; }
.material-control > input[type='range'] { flex: 1; min-width: 0; }
.material-control :deep(.nf) { flex: 0 0 54px; width: 54px; }
.sub3 { margin: 8px 0 2px; font-size: 11px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: .04em; border-top: 1px solid var(--hair-soft); padding-top: 6px; }
code { font-size: 11px; background: var(--g-800); padding: 0 4px; border-radius: 3px; }
.field input[type='text'], .field select { width: 100%; }
.actions { display: flex; gap: 6px; padding: 12px 10px 0; }
.actions button { flex: 1; }
.actions button.danger { flex: none; width: 30px; padding: 0; }
/* En selección múltiple el botón lleva texto: no aplicar el ancho de los botones solo-icono. */
.actions.col button.multi-delete { width: 100%; min-height: 26px; padding: 4px 8px; display: flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; }
.actions.col { flex-direction: column; margin-top: 14px; }
.dim { color: var(--text-3); }
.wide { width: 100%; }
.pfbtns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; }
.pfbtns button { padding: 0 4px; font-size: 11px; }
.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; }
.two button, .pfbtns button { min-width:0;white-space:normal; }
/* S01: composición de primitivas. Mantener intactos los controles y el plegado por título. */
.insp[data-node-type='primitive'] { --lf-primitive-surface: var(--g-850); }
.insp[data-node-type='primitive'] .primitive-head .name { padding-inline: 7px; }
.insp[data-node-type='primitive'] .sect[data-primitive-section] {
  background: var(--lf-primitive-surface); border-bottom: 1px solid var(--hair);
  margin: 0 0 3px; min-width: 0;
}
.insp[data-node-type='primitive'] .sect[data-primitive-section] > .body {
  padding: 9px 12px 11px; min-width: 0;
}
.insp[data-node-type='primitive'] .sect[data-primitive-section] .field { min-width: 0; column-gap: 8px; }
.insp[data-node-type='primitive'] .sect[data-primitive-section] .field > label { color: var(--text-2); font-size: 11px; }
.insp[data-node-type='primitive'] .sect[data-primitive-section] .field > :not(label) { min-width: 0; }
.insp[data-node-type='primitive'] .sect[data-primitive-section] .pfbtns { gap: 6px; }
.insp[data-node-type='primitive'] .sect[data-primitive-section] button.wide { justify-content: center; max-width: 100%; }
.insp[data-node-type='primitive'] .sect[data-primitive-section] :deep(.mr-primitive) { min-width: 0; }
.insp[data-node-type='primitive'] .sect[data-primitive-section] :deep(.mr-primitive .field) {
  display: grid; grid-template-columns: minmax(0, var(--lf-property-label-width, 112px)) minmax(0, 1fr);
  align-items: center; gap: 8px; min-width: 0;
}
.insp[data-node-type='primitive'] .sect[data-primitive-section] :deep(.mr-primitive .field:has(> .property-key)) { grid-template-columns: minmax(0, var(--lf-property-label-width, 112px)) minmax(0, 1fr) 22px; }
.insp[data-node-type='primitive'] .sect[data-primitive-section] :deep(.mr-primitive .field > label) {
  min-width: 0; width: auto; max-width: none; overflow-wrap: anywhere;
  font-size: 11px; color: var(--text-2); margin: 0; flex: initial;
}
@container insp (max-width: 260px) {
  .insp[data-node-type='primitive'] .sect[data-primitive-section] :deep(.mr-primitive .field) {
    grid-template-columns: minmax(0, 1fr); row-gap: 3px;
  }
  .insp[data-node-type='primitive'] .sect[data-primitive-section] :deep(.mr-primitive .field:has(> .property-key)) { grid-template-columns: minmax(0, 1fr) 22px; }
}
/* Ficha compacta del nodo y filas de transformación del panel Detalles. */
.insp > .node-head { padding: 6px 7px; margin-bottom: 4px; border: 0; border-radius: 4px; background: var(--g-800); }
.insp > .node-head .hcol { gap: 4px; }
.node-head .name { background: var(--details-field, var(--g-950)); border-color: var(--hair); font-size: 12px; font-weight: 400; }
.node-head .name:focus { border-color: var(--blue-hi); }
.node-properties .sub { min-height: 20px; margin-bottom: 4px; }
.insp > .sect > header { min-height: 30px; padding-right: 12px; }
.insp > .sect > .body { padding: 8px 12px 10px; }
.insp > .sect > .body > .field { min-height: 25px; }
.insp > .sect > .body > .field + .field { margin-top: 4px; }
/* La llave forma parte de la fila del valor; nunca ocupa una tercera fila implícita. */
.insp .field:has(> .property-key) {
  grid-template-columns: minmax(60px, var(--lf-property-label-width, 112px)) minmax(0, 1fr) 22px;
  column-gap: 5px;
}
.insp .field > .property-key { justify-self: end; }
.insp[data-node-type='primitive'] > .sect[data-primitive-section] > .body { padding: 8px 12px 10px; }
@container insp (max-width: 260px) {
  .insp > .sect > .body { padding-inline: 10px; }
  .insp[data-node-type='primitive'] > .sect[data-primitive-section] > .body { padding-inline: 10px; }
  /* Dock estrecho: la etiqueta sube, pero valor y llave continúan en la misma línea. */
  .insp .field:has(> .property-key) { grid-template-columns: minmax(0, 1fr) 22px; row-gap: 3px; }
  .insp .field:has(> .property-key) > label { grid-column: 1 / -1; }
}
.insp > .sect.lf-transform > .body {
  padding: 4px 7px 6px;
}
.insp .lf-transform .field {
  --transform-label: clamp(62px, 38%, var(--lf-property-label-width, 112px));
  grid-template-columns: var(--transform-label) minmax(0, 1fr);
  min-height: 26px; column-gap: 4px;
}
.insp .lf-transform .field + .field { margin-top: 1px; }
.insp .lf-transform .field:has(> .property-key) { grid-template-columns: var(--transform-label) minmax(0, 1fr) 22px; }
.insp .lf-transform .field > label { grid-column: auto; color: var(--text); }
.insp .node-properties .field { grid-template-columns: minmax(0, 1fr) auto; }
.insp .node-properties .field:has(> .property-key) { grid-template-columns: minmax(0, 1fr) auto 22px; }
.insp .node-properties .field > label { grid-column: auto; }
.lf-transform :deep(.v3) { gap: 3px; }
.lf-transform :deep(.v3 .nf) {
  background: #13161b; border: 1px solid transparent; border-radius: 4px;
}
.lf-transform :deep(.v3 .nf:focus-within), .lf-transform :deep(.v3 .nf.drag) { border-color: var(--blue-hi); }
.lf-transform :deep(.v3 .nf .lbl) { background: transparent !important; color: var(--text-2); padding: 0 2px 0 4px; min-width: 0; font-weight: 500; }
.lf-transform :deep(.v3 .nf:nth-child(1) .lbl), .multi-axis:nth-child(1) span { color: var(--inspector-axis-x); }
.lf-transform :deep(.v3 .nf:nth-child(2) .lbl), .multi-axis:nth-child(2) span { color: var(--inspector-axis-y); }
.lf-transform :deep(.v3 .nf:nth-child(3) .lbl), .multi-axis:nth-child(3) span { color: var(--inspector-axis-z); }
.lf-transform :deep(.v3 .nf input) { border: 0; background: transparent; padding: 0 2px; height: 20px; text-align: left; font-size: 11px; }
@container insp (max-width: 190px) {
  .node-lock { font-size: 0; }
  .insp .lf-transform .field { --transform-label: 57px; }
}
/* Llave contextual, visible solo con un Timeline editable y un canal compatible. */
/* Señal discreta al soltar un recurso Script desde Assets. */
.lf-script-drop { outline: 1px dashed var(--accent, #6e9dcc); outline-offset: -2px; }
.node-inspector > .node-head, .node-inspector .multi-inspector > .node-head { background: transparent; border: 0; padding: 4px 8px 6px; margin: 0; }
.node-inspector > .sect, .node-inspector[data-node-type='primitive'] > .sect[data-primitive-section], .node-inspector .multi-inspector > .sect { margin: 0 5px 5px; background: transparent; border-bottom: 0; min-width: 0; }
.node-inspector > .sect > header, .node-inspector .multi-inspector > .sect > header { border: 0; border-radius: 3px; height: 26px; min-height: 26px; }
.node-inspector > .sect > .body, .node-inspector[data-node-type='primitive'] > .sect[data-primitive-section] > .body, .node-inspector .multi-inspector > .sect > .body { padding: 5px 7px 7px; min-width: 0; }
.node-inspector .lf-transform :deep(.v3 .nf) { min-width: 0; flex: 1 1 0; }
.node-inspector .lf-transform :deep(.v3 .nf input) { min-width: 0; width: 100%; }
.node-inspector .node-properties .sub { margin-bottom: 2px; }
.node-inspector .node-type { max-width: none; flex-shrink: 1; }
@container insp (max-width: 260px) {
  .node-inspector .lf-transform .field { grid-template-columns: minmax(0, 1fr); }
  .node-inspector .lf-transform .field:has(> .property-key) { grid-template-columns: minmax(0, 1fr) 22px; }
  .node-inspector .lf-transform .field:has(> .property-key) > label { grid-column: 1 / -1; }
  .node-inspector .node-script-field { grid-template-columns: minmax(0, 1fr); }
}
</style>

<style scoped>
.multi-inspector .actions { padding: 8px 12px 14px; }
.multi-axes { display: flex; gap: 5px; width: 100%; min-width: 0; }
.multi-axis { display: flex; align-items: center; flex: 1; gap: 3px; min-width: 0; }
.multi-axis span { font-size: 11px; font-weight: 500; }
.multi-axis :deep(input) { min-width: 0; width: 100%; background: var(--details-field, var(--g-950)); color: inherit; border: 1px solid var(--hair); border-radius: 3px; padding: 3px; font-size: 11px; }

.node-script-slot { min-width: 0; }
.node-script-slot + .node-script-slot { border-top: 1px solid var(--hair-soft); }
.node-script-slot .node-script-entry { border-bottom: none; }
.node-script-editables { padding: 4px 2px 8px; display: grid; gap: 6px; }
.node-script-field { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); gap: 5px 8px; align-items: center; }
.node-script-field > label { overflow-wrap: anywhere; }
.node-script-field > input:not([type="checkbox"]) { width: 100%; min-width: 0; box-sizing: border-box; }
.node-script-header { grid-column: 1 / -1; margin: 4px 0 2px; }
.node-script-header strong { font-weight: 600; }
.node-script-header .hint { margin: 4px 0 0; }
.node-script-description { grid-column: 1 / -1; margin: 0; }
.node-script-error { color: var(--danger, #d45c59); padding-left: 2px; }
</style>
