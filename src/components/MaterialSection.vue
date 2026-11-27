<script setup>
// Inspector estilo recurso: el objeto referencia un material; no duplica las propiedades compartidas.
import { computed, nextTick, ref, watch } from 'vue'
import { store, updateObject, createMaterial, assignMaterial, makeMaterialLocal, updateMaterial, openShaderEditor, openMaterialEditor, commit, assetUrl } from '../core/store.js'
import { effectiveMaterialObject } from '../engine/runtime/render/material-resource.js'
import { normalizedRunoff } from '../engine/runtime/render/material-resource.js'
import { normalizeRainAudio } from '../engine/runtime/world/rain-audio-profile.js'
import { SURFACE_LIST } from '../engine/runtime/layers.js'
import { AUDIO_EXT } from '../engine/runtime/audio/config.js'
import { getAudio } from '../engine/runtime/audio/engine.js'
import { allEntries } from '../core/project.js'
import { MODEL_MAPS } from '../engine/runtime/render/native-maps.js'
import { inheritedModelMap } from '../engine/runtime/render/model-material.js'
import { PHYSICAL_DEFAULTS } from '../engine/runtime/render/pbr.js'
import MaterialShader from './MaterialShader.vue'
import MaterialSurfaceDetail from './MaterialSurfaceDetail.vue'
import NumberField from './NumberField.vue'
import PropertyKey from './PropertyKey.vue'
import Icon from './Icon.vue'
import ResourceDropSlot from './ResourceDropSlot.vue'

const props = defineProps({ obj: { type: Object, default: () => ({}) }, resourceId: { type: String, default: '' }, primitiveLayout: { type: Boolean, default: false }, slotEdit: { type: Function, default: null }, slotChoose: { type: Function, default: null }, slotOriginal: { type: Boolean, default: false }, slotName: { type: String, default: '' }, slotUv: { type: Boolean, default: true }, slotImported: { type: Object, default: null }, slotRestore: { type: Function, default: null }, keyable: { type: Function, default: null }, keyMarked: { type: Function, default: null } })
const nodeMaterial = computed(() => !props.resourceId && !props.slotEdit)
const emit = defineEmits(['insert-key'])
const keyId = key => `${props.obj?.type}.${key}`
const canKey = key => !props.resourceId && ['primitive','mesh'].includes(props.obj?.type) && props.keyable?.(keyId(key)) === true
const marked = key => props.keyMarked?.(keyId(key)) === true
const host = computed(() => props.resourceId ? { materialId: props.resourceId, mat: {} } : props.obj)
const materials = computed(() => store.project?.materials || [])
const resource = computed(() => materials.value.find((m) => m.id === host.value.materialId) || null)
const effective = computed(() => effectiveMaterialObject(host.value, materials.value))
const shared = computed(() => !!resource.value)
const textures = computed(() => allEntries(store.project).filter(a => a.kind === 'texture'))
function setMap(key, id) { set({ mat: { maps: { ...(effective.value.mat?.maps || {}), [key]: id } } }, 'Asignar textura') }
const fields = [
  { key: 'clearcoat', label: 'Barniz', min: 0, max: 1, step: 0.01 },
  { key: 'clearcoatRoughness', label: 'Rugosidad barniz', min: 0, max: 1, step: 0.01 },
  { key: 'transmission', label: 'Transmisión', min: 0, max: 1, step: 0.01 },
  { key: 'ior', label: 'Índice de refracción', min: 1, max: 2.333, step: 0.01 },
  { key: 'thickness', label: 'Espesor', min: 0, max: 100, step: 0.01 },
  { key: 'sheen', label: 'Sheen', min: 0, max: 1, step: 0.01 },
  { key: 'sheenRoughness', label: 'Rugosidad tela', min: 0, max: 1, step: 0.01 },
  { key: 'iridescence', label: 'Iridiscencia', min: 0, max: 1, step: 0.01 },
  { key: 'iridescenceIOR', label: 'IOR iridiscencia', min: 1, max: 2.333, step: 0.01 },
  { key: 'anisotropy', label: 'Anisotropía', min: 0, max: 1, step: 0.01 },
]
const runoff = computed(() => normalizedRunoff(effective.value?.mat?.runoff))
function setRunoff(key, value, save=false) {
  set({ mat: { runoff: { ...runoff.value, [key]: value } } }, 'Escurrimiento superficial', save)
}
const rainAudio = computed(() => normalizeRainAudio(effective.value?.mat?.rainAudio))
const audioFiles = computed(() => allEntries(store.project).filter((a) =>
  (a.kind === 'audio' || a.kind === 'file') && AUDIO_EXT.includes(String(a.ref?.ext || a.name.split('.').pop() || '').toLowerCase())))
const audioIds = computed(() => audioFiles.value.map((a) => a.id))
const previewError = ref('')
function setRainAudio(patch, save = false) {
  set({ mat: { rainAudio: { ...rainAudio.value, ...patch } } }, 'Impactos acústicos', save)
}
function setRainClip(i, raw) {
  const file = audioFiles.value.find((a) => a.id === raw || a.name === raw)
  const clips = [...rainAudio.value.clips]
  clips[i] = file?.id || raw
  setRainAudio({ clips }, true)
}
function addRainClip() { if (rainAudio.value.clips.length < 8) setRainAudio({ clips: [...rainAudio.value.clips, ''] }, true) }
function removeRainClip(i) { setRainAudio({ clips: rainAudio.value.clips.filter((_, j) => j !== i) }, true) }
async function previewRainClip(clip) {
  previewError.value = ''
  const file = audioFiles.value.find((a) => a.id === clip || a.name === clip)
  if (!file) { previewError.value = 'El clip no está disponible en Assets'; return }
  try { await getAudio().play(file.id, { mode: 'ui', group: 'sfx', volume: 0.6 }) }
  catch { previewError.value = 'No se pudo reproducir el clip' }
}
const physical = computed(() => ({ ...PHYSICAL_DEFAULTS, ...(effective.value?.mat?.physical || {}) }))
const title = computed(() => resource.value?.name || (props.slotOriginal ? 'Material original' : effective.value.mat?.shader === 'builtin:blockout' ? 'Blockout (local)' : 'Material local'))
const doc = computed(() => store.project?.shaders?.find((s) => s.id === effective.value.mat?.shader))
function set(patch, label='Editar material', save=true) {
  if (shared.value) updateMaterial(resource.value.id, patch, { commit: save })
  else if (props.slotEdit) props.slotEdit(patch, label, save)
  else if (!props.resourceId) updateObject(props.obj.id, patch, { label, commit: save })
}
function setField(key, value, save=false) { set({ [key]: value }, `Editar ${key}`, save) }
function setPhysical(key, value, save=false) {
  set({ mat: { physical: { [key]: value } } }, `Editar ${key}`, save)
}
function create() {
  const m = createMaterial(effective.value, 'Assets/Materials', props.obj.type === 'primitive' && effective.value.mat?.shader === 'builtin:blockout' ? 'Blockout.material' : 'Material.material')
  choose(m.id)
}
function choose(id) { if (props.slotChoose) return props.slotChoose(id); if (!id) makeMaterialLocal(props.obj.id); else assignMaterial(props.obj.id, id) }
const panel = ref(null), materialSelect = ref(null), texturePreview = ref('')
const importedMap = key => inheritedModelMap(props.slotOriginal ? { ...effective.value, inheritImportedMaps: true } : effective.value, props.slotImported, key)
const mapValue = key => effective.value.mat?.maps?.[key] || (importedMap(key) ? '__imported__' : '')
const compactMapLabels = { albedo:'Albedo', normal:'Normal', roughness:'Rugosidad', metallic:'Metálico', ao:'Oclusión ambiental', emission:'Emisión' }
const sphereStyle = computed(() => ({ '--material-color': effective.value.color || '#9aa4b5',
  '--material-shine': 0.2 + (1 - (effective.value.roughness ?? 0.8)) * 0.6,
  '--material-opacity': effective.value.opacity ?? 1,
  '--material-metal': 0.2 + (effective.value.metallic ?? 0) * 0.4 }))
watch([() => props.slotEdit || nodeMaterial.value ? effective.value.mat?.maps?.albedo : '', () => store.project?.id, () => props.slotEdit ? importedMap('albedo')?.image?.src : ''], async ([id, projectId, importedUrl], _, onCleanup) => {
  let valid = true
  onCleanup(() => { valid = false })
  texturePreview.value = ''
  if (!id || !projectId) { if (typeof importedUrl === 'string') texturePreview.value = importedUrl; return }
  try { const url = await assetUrl(id, projectId); if (valid) texturePreview.value = url || '' } catch { /* La esfera conserva el color si no se puede leer la imagen. */ }
}, { immediate: true })
const materialChoice = computed(() => props.slotOriginal ? '__original__' : resource.value?.id || '')
function selectMaterial(value) { if (value === '__original__') props.slotRestore?.(); else choose(value) }
async function focusMaterial() {
  if (props.slotEdit && panel.value) panel.value.open = true
  await nextTick()
  materialSelect.value?.focus()
  try { materialSelect.value?.showPicker?.() } catch { /* El selector sigue disponible mediante teclado. */ }
}
function openSlotMenu(event) {
  const button = event.currentTarget
  const r = button.getBoundingClientRect()
  store.menu = { x:r.left, y:r.bottom+2, returnFocus:button, items:[
    { label:'Asignar material…', icon:'sphere', run:focusMaterial },
    { label:'Hacer local', icon:'copy', disabled:!props.slotOriginal && !shared.value, run:() => choose('') },
    { label:'Guardar como recurso…', icon:'save', run:create },
    { label:'Editar recurso…', icon:'sliders', disabled:!shared.value, run:() => { if (resource.value) openMaterialEditor(resource.value.id) } },
    ...(props.slotEdit ? [{ sep:true },
      { label:'Restaurar original', icon:'refresh', disabled:props.slotOriginal, run:() => props.slotRestore?.() }] : []),
  ] }
}

</script>

<template>
  <component :is="slotEdit ? 'details' : 'div'" ref="panel" :open="slotEdit ? true : undefined" class="mr" :class="{ 'mr-primitive': primitiveLayout, 'mr-model': slotEdit, 'mr-node': nodeMaterial }" data-testid="material-resource-panel">
    <component :is="slotEdit ? 'summary' : 'div'" v-if="slotEdit || nodeMaterial" :class="slotEdit ? 'mr-slot-heading' : 'mr-node-heading'" :data-testid="slotEdit ? 'model-material-heading' : 'node-material-heading'">
      <Icon v-if="slotEdit" name="chevron-right" :size="12" class="mr-slot-chevron" />
      <span class="mr-sphere-stage" data-tooltip="Miniatura aproximada del material">
        <span class="mr-sphere" :style="sphereStyle"><img v-if="texturePreview" :src="texturePreview" alt="" draggable="false" /></span>
      </span>
      <span class="mr-identity"><b :title="slotEdit ? slotName : title">{{ slotEdit ? slotName : title }}</b><small v-if="slotEdit || shared" :title="shared ? `${resource.name} · Los cambios afectan a todos sus usuarios` : ''">{{ shared ? 'Compartido' : slotOriginal ? 'Importado' : 'Local' }}</small></span>
      <Icon v-if="slotEdit && !slotUv" name="help" :size="13" data-tooltip="Este slot no tiene coordenadas UV" />
      <button type="button" class="mr-more" :data-testid="slotEdit ? 'model-material-menu' : 'node-material-menu'" aria-label="Acciones del material" aria-haspopup="menu" data-tooltip="Acciones del material" @click.stop.prevent="openSlotMenu"><Icon name="more" :size="16" /></button>
    </component>
    <div v-if="slotEdit" class="field mr-slot-picker"><label>Material</label>
      <ResourceDropSlot :kinds="['material']" :accepted-ids="materials.map(m => m.id)" @assign="choose">
        <select ref="materialSelect" aria-label="Material del slot" :value="materialChoice" @change="selectMaterial($event.target.value)">
          <option value="__original__">{{ slotName }}</option><option value="">Local</option>
          <option v-for="m in materials" :key="m.id" :value="m.id">{{ m.name }}</option>
        </select>
      </ResourceDropSlot>
    </div>
    <div v-if="!slotEdit && !nodeMaterial" class="mr-resource">
      <div class="mr-preview" :style="{ background: effective.color || '#9aa4b5' }" aria-hidden="true"></div>
      <div class="mr-identity"><b>{{ title }}</b><small>{{ shared ? 'Recurso compartido · Assets/Materials' : slotOriginal ? 'Material importado' : 'Material local' }}</small></div>
    </div>
    <div v-if="!resourceId && !slotEdit" class="field"><label>Recurso</label>
      <ResourceDropSlot :kinds="['material']" :accepted-ids="materials.map(m => m.id)" @assign="choose">
        <select ref="materialSelect" aria-label="Recurso de material" :value="resource?.id || ''" @change="choose($event.target.value)">
          <option value="">{{ slotOriginal ? 'Original' : 'Local (sin recurso)' }}</option>
          <option v-for="m in materials" :key="m.id" :value="m.id">{{ m.name }}</option>
        </select>
      </ResourceDropSlot>
    </div>
    <p v-if="shared && !slotEdit && !nodeMaterial" class="hint">Los cambios en este recurso se aplican a todos los nodos que lo comparten.</p>
    <component :is="slotEdit ? 'div' : 'details'" class="mr-group mr-properties" :open="slotEdit ? undefined : true"><summary v-if="!slotEdit">Propiedades del material</summary>
      <div class="field"><label>Albedo</label><ColorInput :value="effective.color" @input="setField('color',$event.target.value)" @change="commit('Color de material')" /><PropertyKey v-if="canKey('color')" label="Albedo" :available="true" :marked="marked('color')" @insert="emit('insert-key', keyId('color'))" /></div>
      <div v-for="f in [{key:'roughness',label:'Rugosidad'},{key:'metallic',label:'Metálico'},{key:'opacity',label:'Opacidad'}]" :key="f.key" class="field">
        <label>{{ f.label }}</label>
        <NumberField :model-value="effective[f.key] ?? 1" :min="f.key === 'opacity' ? 0.05 : 0" :max="1" :step="0.01" @update:model-value="setField(f.key,$event)" @commit="commit('Propiedades del material')" />
        <PropertyKey v-if="canKey(f.key)" :label="f.label" :available="true" :marked="marked(f.key)" @insert="emit('insert-key', keyId(f.key))" />
      </div>
    </component>
    <details v-if="slotEdit || resourceId || effective.mat?.maps" class="mr-group" open><summary>{{ slotEdit ? 'Texturas' : 'Texturas UV' }}</summary>
      <div v-for="map in MODEL_MAPS" :key="map.key" class="field"><label :title="map.label">{{ slotEdit ? compactMapLabels[map.key] : map.label }}</label>
        <ResourceDropSlot :kinds="['texture']" :accepted-ids="textures.map(t => t.id)" @assign="setMap(map.key,$event)">
          <select :aria-label="map.label" :value="slotEdit ? mapValue(map.key) : effective.mat?.maps?.[map.key] || ''" @change="setMap(map.key,$event.target.value)">
            <option v-if="slotEdit && importedMap(map.key)" value="__imported__" disabled>Importada</option>
            <option value="">{{ slotEdit ? 'Vacío' : 'Sin textura' }}</option><option v-for="t in textures" :key="t.id" :value="t.id">{{ t.name }}</option>
          </select>
        </ResourceDropSlot>
      </div>
    </details>
    <details v-if="!slotEdit" class="mr-group" open><summary>Detalle de superficie</summary>
      <MaterialSurfaceDetail :obj="effective" :edit="set" />
    </details>
    <details v-if="!slotEdit" class="mr-group"><summary>Escurrimiento de lluvia (agua física)</summary>
      <p class="hint">Solo superficies estáticas sobre regiones físicas. No habilita lluvia en proyectos anteriores.</p>
      <div class="field"><label>Participa</label><input type="checkbox" :checked="runoff.enabled" @change="setRunoff('enabled',$event.target.checked,true)" /></div>
      <div class="field"><label>Retención (mm)</label><NumberField :model-value="runoff.retentionMm" :min="0" :max="1000" :step="1" @update:model-value="setRunoff('retentionMm',$event)" @commit="commit('Retención de lluvia')" /></div>
      <div class="field"><label>Escurrimiento (m/s)</label><NumberField :model-value="runoff.runoffMps" :min="0" :max="20" :step="0.05" @update:model-value="setRunoff('runoffMps',$event)" @commit="commit('Velocidad de escurrimiento')" /></div>
    </details>
    <details v-if="!slotEdit" class="mr-group" data-testid="rain-acoustic-profile"><summary>Impactos acústicos de lluvia</summary>
      <p class="hint">Perfil del material; usa los mismos clips de Assets y el motor de audio de Century. Requiere activar impactos en Escena → Clima.</p>
      <div class="field"><label>Habilitado</label><input type="checkbox" :checked="rainAudio.enabled" @change="setRainAudio({enabled:$event.target.checked},true)" /></div>
      <div class="field"><label>Superficie</label><select :value="rainAudio.surface" @change="setRainAudio({surface:$event.target.value},true)"><option value="">Por Layers</option><option v-for="[id,name] in SURFACE_LIST" :key="id" :value="id">{{ name }}</option></select></div>
      <div v-for="(clip,i) in rainAudio.clips" :key="i" class="field"><label>Clip {{ i+1 }}</label>
        <ResourceDropSlot :kinds="['audio','file']" :accepted-ids="audioIds" @assign="setRainClip(i,$event)">
          <select :value="clip" @change="setRainClip(i,$event.target.value)"><option value="">— elegir clip —</option><option v-for="a in audioFiles" :key="a.id" :value="a.id">{{ a.name }}</option><option v-if="clip && !audioFiles.some(a=>a.id===clip || a.name===clip)" :value="clip">Recurso no disponible</option></select>
        </ResourceDropSlot>
        <button type="button" :disabled="!clip" data-tooltip="Escuchar clip" @click="previewRainClip(clip)">▶</button><button type="button" data-tooltip="Quitar clip" @click="removeRainClip(i)">×</button>
      </div>
      <button type="button" :disabled="rainAudio.clips.length>=8" @click="addRainClip">+ Añadir clip</button>
      <p v-if="previewError" class="hint" role="alert">{{ previewError }}</p>
      <div class="field"><label>Volumen</label><NumberField :model-value="rainAudio.volume" :min="0" :max="2" :step="0.05" @update:model-value="setRainAudio({volume:$event})" @commit="commit('Volumen de impactos')" /></div>
      <div class="field"><label>Tono aleatorio</label><NumberField :model-value="rainAudio.pitch" :min="0" :max="0.3" :step="0.01" @update:model-value="setRainAudio({pitch:$event})" @commit="commit('Tono de impactos')" /></div>
      <div class="field"><label>Máx./segundo</label><NumberField :model-value="rainAudio.maxRate" :min="0" :max="15" :step="1" @update:model-value="setRainAudio({maxRate:$event})" @commit="commit('Frecuencia de impactos')" /></div>
    </details>
    <details class="mr-group"><summary>{{ slotEdit ? 'Propiedades avanzadas' : 'Propiedades físicas avanzadas' }}</summary>
      <div class="field" v-for="f in fields" :key="f.key"><label>{{ f.label }}</label>
        <NumberField :model-value="physical[f.key]" :min="f.min" :max="f.max" :step="f.step" @update:model-value="setPhysical(f.key,$event)" @commit="commit('Material físico')" />
      </div>
      <div class="field"><label>Color tela</label><ColorInput :value="physical.sheenColor" @input="setPhysical('sheenColor',$event.target.value)" @change="commit('Material físico')" /></div>
    </details>
    <details v-if="!slotEdit" class="mr-group"><summary>Shader personalizado</summary>
      <MaterialShader :obj="effective" :edit="set" />
      <button v-if="doc" class="mr-edit" type="button" @click="openShaderEditor(doc.id)">Abrir Shader Graph…</button>
    </details>
  </component>
</template>

<style scoped>
.mr { display:flex; flex-direction:column; gap:10px; }
.mr-resource { display:flex; align-items:center; gap:10px; min-width:0; padding:8px; background:var(--g-850, #141414); border:1px solid var(--hair); border-radius:5px; }
.mr-preview { width:38px; height:38px; flex:none; border:1px solid #6667; border-radius:4px; }
.mr-identity { display:flex; flex-direction:column; min-width:0; gap:3px; }
.mr-identity b { font-size:12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.mr-identity small { font-size:10px; color:var(--text-3); }
.mr .field { display:flex; align-items:center; gap:8px; margin-top:7px; }
.mr .field label { flex:0 0 95px; font-size:11px; color:var(--text-2); }
.mr .field select,.mr .field :deep(input) { min-width:0; flex:1; }
.mr-group { border-top:1px solid var(--hair); padding-top:8px; }
.mr-group summary { cursor:pointer; font-size:12px; font-weight:600; }
.mr-group > :not(summary) { margin-top:6px; }
.mr-edit { margin-top:8px; }
/* S01: la variante solo afecta la presentación en el Inspector de primitivas. */
.mr.mr-primitive { gap: 8px; min-width: 0; }
.mr.mr-primitive .mr-resource { background: var(--g-700); border-color: var(--g-600); border-radius: 3px; padding: 8px; }
.mr.mr-primitive .mr-preview { width: 32px; height: 32px; }
.mr.mr-primitive .mr-identity { overflow: hidden; }
.mr.mr-primitive .mr-identity small { color: var(--text-2); line-height: 1.35; }
.mr.mr-primitive .mr-group { padding: 0; margin: 0; border: 1px solid var(--hair); border-radius: 3px; min-width: 0; }
.mr.mr-primitive .mr-group > summary { padding: 7px 9px; background: var(--g-700); color: var(--text); min-height: 27px; }
.mr.mr-primitive .mr-group[open] > summary { border-bottom: 1px solid var(--hair); }
.mr.mr-primitive .mr-group > :not(summary) { margin: 7px 9px; }
.mr.mr-primitive .mr-group summary:focus-visible { outline: 2px solid var(--blue-hi); outline-offset: -2px; }
.mr.mr-primitive .mr-group summary:hover { background: var(--g-600); }
.mr.mr-primitive .mr-group .field { min-width: 0; }
.hint { color:var(--text-3); font-size:11px; line-height:1.5; margin:0; }
/* La variante de slots mantiene los controles del Inspector y un único encabezado. */
.mr.mr-model { display:block; min-width:0; margin:5px 0; border:1px solid var(--hair); border-radius:4px; overflow:hidden; }
.mr-model > :not(summary) { margin:0 8px 7px; }
.mr-model:not([open]) > :not(summary) { display:none; }
.mr-slot-heading { display:flex; align-items:center; gap:7px; min-width:0; padding:6px; cursor:pointer; list-style:none; }
.mr-slot-heading::-webkit-details-marker { display:none; }
.mr-slot-heading:hover { background:var(--g-700); }
.mr-model[open] .mr-slot-heading { border-bottom:1px solid var(--hair); }
.mr-model[open] .mr-slot-chevron { transform:rotate(90deg); }
.mr-slot-chevron { flex:none; color:var(--text-3); }
.mr-sphere-stage { width:42px; height:42px; flex:none; display:grid; place-items:center; background:var(--g-850,#171a20); border-radius:3px; }
.mr-sphere { position:relative; display:block; width:34px; height:34px; border-radius:50%; overflow:hidden; isolation:isolate; background:var(--material-color); opacity:var(--material-opacity); box-shadow:0 2px 3px #0008; }
.mr-sphere img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; mix-blend-mode:multiply; }
.mr-sphere::after { content:''; position:absolute; inset:0; border-radius:50%; background:radial-gradient(circle at 32% 24%,rgb(255 255 255 / var(--material-shine)),transparent 48%),radial-gradient(circle at 36% 32%,transparent 34%,rgb(0 0 0 / var(--material-metal)) 62%,#000d 100%); pointer-events:none; }
.mr-model .mr-identity { flex:1; gap:2px; }
.mr-model .mr-identity small { font-size:10px; color:var(--text-3); }
.mr-more { flex:none; display:grid; place-items:center; width:25px; height:25px; padding:0; background:transparent; border:1px solid transparent; color:var(--text-2); }
.mr-more:hover,.mr-more:focus-visible { background:var(--g-700); border-color:var(--hair); }
.mr-model .field { display:grid; grid-template-columns:minmax(0,42%) minmax(0,1fr); gap:6px; align-items:center; margin-top:5px; min-width:0; }
.mr-model .field > label { min-width:0; overflow-wrap:anywhere; }
.mr-model .field select { width:100%; min-width:0; }
.mr-model .mr-slot-picker { margin-top:7px; }
.mr-model .mr-properties { border:0; padding:0; }
.mr-model .mr-group:not(.mr-properties) { padding-top:6px; }
.mr-model .mr-group summary { font-size:11px; font-weight:600; }
.mr-model .mr-group > :not(summary) { margin-top:5px; }
.mr.mr-node { gap: 5px; }
.mr-node-heading { display: flex; align-items: center; gap: 7px; min-width: 0; padding: 0 1px 3px; }
.mr-node-heading .mr-sphere-stage { width: 34px; height: 34px; background: transparent; }
.mr-node-heading .mr-sphere { width: 29px; height: 29px; }
.mr-node-heading .mr-identity { flex: 1; overflow: hidden; gap: 1px; }
.mr.mr-node .mr-group { border: 0; border-top: 1px solid var(--hair-soft); border-radius: 0; padding: 3px 0 0; margin: 0; min-width: 0; }
.mr.mr-node .mr-group > summary { padding: 5px 0; min-height: 23px; background: transparent; border: 0; font-size: 11px; }
.mr.mr-node .mr-group > :not(summary) { margin: 3px 0; }
.mr.mr-node .field { display: grid; grid-template-columns: minmax(0, var(--lf-property-label-width, 112px)) minmax(0, 1fr); gap: 5px; min-width: 0; }
.mr.mr-node .field:has(> .property-key) { grid-template-columns: minmax(0, var(--lf-property-label-width, 112px)) minmax(0, 1fr) 22px; }
.mr-node .field > label { overflow-wrap: anywhere; min-width: 0; }
@container insp (max-width: 260px) {
  .mr.mr-node .field { grid-template-columns: minmax(0, 1fr); }
  .mr.mr-node .field:has(> .property-key) { grid-template-columns: minmax(0, 1fr) 22px; }
  .mr.mr-node .field:has(> .property-key) > label { grid-column: 1 / -1; }
}
</style>
