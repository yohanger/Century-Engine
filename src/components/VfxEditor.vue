<script setup>
// El documento es project.vfx; el Inspector no crea otro recurso ni una ventana.
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import ResourceDropSlot from './ResourceDropSlot.vue'
import NumberField from './NumberField.vue'
import VfxCurveEditor from './VfxCurveEditor.vue'
import Icon from './Icon.vue'
import { store, updateVfx, finishVfxEdit } from '../core/store.js'
import { IMAGE_EXT, extOf } from '../core/project.js'
import { VfxPreviewSession } from '../core/editor/vfx-preview.js'

const props = defineProps({ vfxId: { type: String, required: true } })
const resource = computed(() => store.project?.vfx?.find((r) => r.id === props.vfxId) || null)
const textures = computed(() => (store.project?.assets || []).filter((a) => a.kind === 'texture' || IMAGE_EXT.includes(extOf(a.name))))
const category = ref('emission')
const sections = [
  ['emission', 'Emisión'], ['birth', 'Nacimiento'], ['movement', 'Movimiento'],
  ['appearance', 'Apariencia'], ['evolution', 'Evolución'],
]
const message = ref('')
const active = ref(0)
const elapsed = ref(0)
const playing = ref(false)
let preview = null
let previewProject = null
let previewSceneId = null
const state = () => {
  if (!preview || preview.disposed) return
  const count = preview.simulation?.count || 0
  if (active.value !== count) active.value = count
  const seconds = Number((preview.simulation?.elapsed || 0).toFixed(2))
  if (elapsed.value !== seconds) elapsed.value = seconds
  if (message.value !== preview.error) message.value = preview.error
}
function patch(group, key, value, record = true) {
  if (!resource.value) return
  try {
    updateVfx(props.vfxId, { [group]: { [key]: value } }, { record })
    message.value = ''
  } catch (e) { message.value = e.message || String(e) }
}
function numeric(group, key, value) { patch(group, key, value, false) }
function vector(group, key, index, value) {
  const next = [...resource.value[group][key]]
  next[index] = value
  numeric(group, key, next)
}
function confirm() { finishVfxEdit(props.vfxId) }
function curve(key, points, record) { patch('evolution', key, points, record) }
const previewActive = ref(false)
function stopPreview() {
  preview?.dispose()
  preview = null
  previewProject = null
  previewSceneId = null
  previewActive.value = false
  playing.value = false
  active.value = 0
  elapsed.value = 0
}
function startPreview() {
  if (preview) return
  if (!resource.value || store.locked || store.play.on || !store.editor) return
  try {
    preview = new VfxPreviewSession(store.editor, () => resource.value, state)
    previewProject = store.project
    previewSceneId = store.project?.activeSceneId
    previewActive.value = true
    playing.value = true
    message.value = ''
  } catch (error) { message.value = `Vista previa no disponible: ${error.message}`; stopPreview() }
}
function toggle() {
  if (!preview) return startPreview()
  preview.playing = !preview.playing
  playing.value = preview.playing
  preview.vp.requestRender()
}
function reset() { preview?.reset(); state() }
function step() { preview?.step(); playing.value = false; state() }
// Nunca conservar una preview que secuestra el viewport al entrar en Play o cambiar de contexto.
watch(() => [store.project, store.project?.activeSceneId, store.play.on, store.locked, store.projSel?.kind, store.projSel?.id, store.prefs.rightTab, store.modal], () => {
  if (!preview) return
  if (store.play.on || store.locked || store.modal || store.project !== previewProject || store.project?.activeSceneId !== previewSceneId || !resource.value || store.projSel?.kind !== 'vfx' || store.projSel.id !== props.vfxId || store.prefs.rightTab !== 'object') stopPreview()
})
onBeforeUnmount(() => { confirm(); stopPreview() })
</script>

<template>
  <div v-if="resource" class="vfx-editor" data-testid="vfx-inspector" data-node-type="vfx-resource">
      <header class="vfx-title">
        <div class="vfx-brand"><Icon name="vfx" :size="19" /><div><strong>RECURSO VFX</strong><small>{{ resource.folder }}/{{ resource.name }}</small></div></div>
        <span class="vfx-tag">Recurso compartido</span>
      </header>
      <div class="vfx-preview">
        <div><strong>Vista previa (opcional)</strong><span v-if="previewActive">{{ active }} / {{ resource.emission.capacity }} partículas · {{ elapsed.toFixed(2) }} s</span></div>
        <div class="vfx-transport">
          <button type="button" @click="toggle" :aria-label="!previewActive?'Iniciar vista previa':playing?'Pausar efecto':'Reproducir efecto'"><Icon :name="!previewActive||!playing?'play':'pause'" :size="14"/> {{ !previewActive?'Vista previa':playing?'Pausar':'Reproducir' }}</button>
          <button v-if="previewActive" type="button" @click="reset" aria-label="Reiniciar efecto"><Icon name="undo" :size="14" /></button>
          <button v-if="previewActive" type="button" @click="step" aria-label="Avanzar un paso"><Icon name="step" :size="14" /></button>
          <button v-if="previewActive" type="button" @click="stopPreview" aria-label="Cerrar vista previa"><Icon name="x" :size="14" /></button>
        </div>
        <p>Activa la vista previa cuando la necesites; al cerrarla se restaura la cámara y la escena.</p>
      </div>
      <nav class="vfx-tabs" aria-label="Secciones VFX">
        <button v-for="[key,label] in sections" :key="key" type="button" :class="{ selected:category===key }" @click="category=key">{{ label }}</button>
      </nav>
      <div class="vfx-body">
        <section v-if="category==='emission'" class="vfx-fields">
          <label class="vfx-row">Modo <select :value="resource.emission.mode" @change="patch('emission','mode',$event.target.value)"><option value="continuous">Continuo</option><option value="burst">Ráfaga</option></select></label>
          <NumberField label="Tasa/s" :model-value="resource.emission.rate" :step="0.1" :min="0" :max="10000" @update:model-value="numeric('emission','rate',$event)" @commit="confirm" />
          <NumberField label="Ráfaga" :model-value="resource.emission.burstCount" :step="1" :min="0" :max="1024" :decimals="0" @update:model-value="numeric('emission','burstCount',Math.round($event))" @commit="confirm" />
          <NumberField label="Duración" :model-value="resource.emission.duration" :min="0" :max="86400" @update:model-value="numeric('emission','duration',$event)" @commit="confirm" />
          <NumberField label="Capacidad" :model-value="resource.emission.capacity" :step="1" :min="1" :max="1024" :decimals="0" @update:model-value="numeric('emission','capacity',Math.round($event))" @commit="confirm" />
          <label class="vfx-row">Repetir <input type="checkbox" :checked="resource.emission.loop" @change="patch('emission','loop',$event.target.checked)" /></label>
        </section>
        <section v-else-if="category==='birth'" class="vfx-fields">
          <label class="vfx-row">Forma <select :value="resource.birth.shape" @change="patch('birth','shape',$event.target.value)"><option value="point">Punto</option><option value="box">Caja</option><option value="sphere">Esfera</option></select></label>
          <NumberField label="Radio" :model-value="resource.birth.radius" :min="0" :max="10000" @update:model-value="numeric('birth','radius',$event)" @commit="confirm" />
          <div class="vfx-caption">Dimensiones de caja</div>
          <NumberField v-for="(v,i) in resource.birth.box" :key="'box'+i" :label="['X','Y','Z'][i]" :model-value="v" :min="0" :max="10000" @update:model-value="vector('birth','box',i,$event)" @commit="confirm" />
          <div class="vfx-caption">Vida de las partículas (mín./máx.)</div>
          <NumberField v-for="(v,i) in resource.birth.lifetime" :key="'life'+i" :label="i?'Máximo':'Mínimo'" :model-value="v" :step="0.1" :min="0.001" :max="86400" @update:model-value="vector('birth','lifetime',i,$event)" @commit="confirm" />
        </section>
        <section v-else-if="category==='movement'" class="vfx-fields">
          <NumberField label="Velocidad" :model-value="resource.movement.speed" :min="0" :max="10000" @update:model-value="numeric('movement','speed',$event)" @commit="confirm" />
          <NumberField label="Dispersión" :model-value="resource.movement.spread" :min="0" :max="10000" @update:model-value="numeric('movement','spread',$event)" @commit="confirm" />
          <div class="vfx-caption">Aceleración</div>
          <NumberField v-for="(v,i) in resource.movement.acceleration" :key="'acc'+i" :label="['X','Y','Z'][i]" :model-value="v" :min="-10000" :max="10000" @update:model-value="vector('movement','acceleration',i,$event)" @commit="confirm" />
          <label class="vfx-row">Espacio <select :value="resource.movement.space" @change="patch('movement','space',$event.target.value)"><option value="local">Local</option><option value="world">Mundo</option></select></label>
        </section>
        <section v-else-if="category==='appearance'" class="vfx-fields">
          <div class="vfx-row">Textura
            <ResourceDropSlot class="vfx-texture-slot" :kinds="['texture', 'file']" :accepted-ids="textures.map(t => t.id)" @assign="patch('appearance','textureId',$event)">
              <select aria-label="Textura del VFX" :value="resource.appearance.textureId" @change="patch('appearance','textureId',$event.target.value)"><option value="">Procedural (sin textura)</option><option v-for="t in textures" :key="t.id" :value="t.id">{{ t.name }}</option></select>
            </ResourceDropSlot>
          </div>
          <label class="vfx-row">Color <input type="color" :value="resource.appearance.color" @change="patch('appearance','color',$event.target.value)" /></label>
          <NumberField label="Tamaño" :model-value="resource.appearance.size" :min="0.001" :max="10000" @update:model-value="numeric('appearance','size',$event)" @commit="confirm" />
          <NumberField label="Opacidad" :model-value="resource.appearance.opacity" :min="0" :max="1" @update:model-value="numeric('appearance','opacity',$event)" @commit="confirm" />
          <NumberField label="Rotación °" :model-value="resource.appearance.rotation" :min="-36000" :max="36000" @update:model-value="numeric('appearance','rotation',$event)" @commit="confirm" />
          <label class="vfx-row">Mezcla <select :value="resource.appearance.blend" @change="patch('appearance','blend',$event.target.value)"><option value="alpha">Alpha</option><option value="additive">Aditiva</option></select></label>
        </section>
        <section v-else class="vfx-curves">
          <VfxCurveEditor label="Tamaño" :points="resource.evolution.size" :max-value="100" @update="(points,record) => curve('size',points,record)" @commit="confirm" />
          <VfxCurveEditor label="Opacidad" :points="resource.evolution.opacity" :max-value="1" @update="(points,record) => curve('opacity',points,record)" @commit="confirm" />
          <VfxCurveEditor label="Gradiente de color" field="color" :points="resource.evolution.color" @update="(points,record) => curve('color',points,record)" @commit="confirm" />
        </section>
      </div>
      <footer class="vfx-footer"><span :class="{ error: !!message }" role="status">{{ message || 'VFX v1 · Recurso compartido' }}</span></footer>
  </div>
</template>
<style scoped>
.vfx-editor { display:flex; flex-direction:column; min-width:0; background:var(--g-900); color:var(--text); font-size:12px; }
.vfx-title { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:6px; padding:10px; background:var(--g-850); border-bottom:1px solid var(--hair); min-height:48px; }
.vfx-brand { display:flex; align-items:center; gap:10px; min-width:0; }
.vfx-brand div { min-width:0; display:grid; gap:2px; }
.vfx-brand strong { letter-spacing:1px; font-size:12px; }
.vfx-brand small { color:var(--text-3); font-size:10px; overflow-wrap:anywhere; }
.vfx-tag { font-size:9px; background:#303743; padding:3px 6px; color:#a8b9ce; border-radius:3px; white-space:nowrap; }
.vfx-preview { padding:10px; background:var(--g-850); border-bottom:1px solid var(--hair); display:grid; gap:8px; }
.vfx-preview > div:first-child { display:flex; justify-content:space-between; gap:8px; }
.vfx-preview strong { font-size:12px; }
.vfx-preview span { color:#a6b2bf; font-size:11px; }
.vfx-transport { display:flex; gap:6px; }
.vfx-transport button { background:#333b46; color:#e3ebf6; border:1px solid #4a5360; border-radius:4px; padding:6px 9px; display:flex; align-items:center; gap:5px; cursor:pointer; }
.vfx-preview p { margin:0; color:#8c9bad; font-size:10px; line-height:1.5; }
.vfx-tabs { display:flex; gap:2px; padding:6px 5px 0; background:var(--g-900); overflow-x:auto; border-bottom:1px solid var(--hair); }
.vfx-tabs button { white-space:nowrap; border:0; background:none; color:var(--text-3); font-size:11px; padding:8px 7px; cursor:pointer; border-bottom:2px solid transparent; }
.vfx-tabs button.selected { border-bottom-color:#86b6e6; color:#e8f2ff; }
.vfx-body { min-width:0; padding:12px 9px; }
.vfx-fields { display:grid; gap:12px; align-content:start; }
.vfx-fields :deep(.nf) { min-width:0; width:100%; }
.vfx-row { display:flex; align-items:center; justify-content:space-between; gap:6px; flex-wrap:wrap; min-width:0; font-size:12px; color:#dce4ed; }
.vfx-row select { box-sizing:border-box; width:64%; min-width:0; height:30px; background:#161b21; border:1px solid #454e59; color:#ecf2fa; padding:0 8px; line-height:normal; border-radius:4px; }
.vfx-row :deep(.vfx-texture-slot) { width:64%; flex:0 1 64%; min-width:0; }
.vfx-row :deep(.vfx-texture-slot select) { width:100%; }
.vfx-row input[type=color] { width:65px; border:1px solid #4b5560; padding:1px; background:transparent; cursor:pointer; }
.vfx-caption { color:#a2afbc; font-size:11px; padding:5px 0 0; border-top:1px solid #383e48; }
.vfx-curves { display:grid; gap:12px; }
.vfx-footer { display:flex; align-items:center; background:var(--g-850); padding:9px 10px; border-top:1px solid var(--hair); }
.vfx-footer span { color:#9ba7b5; font-size:10px; min-width:0; overflow-wrap:anywhere; }
.vfx-footer span.error { color:#f4ad8d; }
@media(max-width:600px) { .vfx-tag { display:none; } }
</style>
