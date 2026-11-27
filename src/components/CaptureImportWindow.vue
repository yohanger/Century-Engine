<script setup>
// Importar una captura de movimiento (.lfcap, de la app Century Capture): elige tomas, el modelo con huesos sobre el que
// se aplica y el nodo de la escena que hará de actor. Crea un clip de huesos por toma y, si se quiere, una cinemática por toma.
import { ref, computed, watch } from 'vue'
import AppWindow from './AppWindow.vue'
import { store, toast, readCapture, captureRigInfo, importCapture, openTimelineEditor } from '../core/store.js'
import { pickFile } from '../engine/runtime/util.js'

const file = ref(''), info = ref(null), error = ref('')
const takes = ref([]) // índices elegidos
const modelId = ref(''), nodeId = ref(''), facing = ref('+Z'), makeTl = ref(true), useCam = ref(true)
const models = computed(() => store.project.models.filter((m) => /\.(glb|gltf)$/i.test(m.name)))
const nodes = computed(() => store.project.objects.filter((o) => o.modelId && o.modelId === modelId.value))
const rig = computed(() => (modelId.value ? captureRigInfo(modelId.value) : null))
watch(modelId, () => { nodeId.value = nodes.value.length === 1 ? nodes.value[0].id : (nodes.value.find((n) => n.id === store.selectedId)?.id || '') })
// el seleccionado manda: si tiene modelo, se proponen ese modelo y ese nodo
const sel = store.selectedId && store.project.objects.find((o) => o.id === store.selectedId)
if (sel?.modelId) { modelId.value = sel.modelId; nodeId.value = sel.id }
else if (models.value.length === 1) modelId.value = models.value[0].id

async function load(f) {
  error.value = ''; info.value = null
  try {
    const r = readCapture(await f.text())
    file.value = f.name; info.value = r; takes.value = r.takes.map((t) => t.index)
  } catch (e) { error.value = 'No es una captura válida: ' + (e.message || e) }
}
async function choose() { const [f] = await pickFile('.lfcap,application/json'); if (f) load(f) }
function onDrop(e) { const f = e.dataTransfer?.files?.[0]; if (f) load(f) }
const canImport = computed(() => info.value && takes.value.length && rig.value?.ok)
function run() {
  try {
    const r = importCapture(info.value.cap, { modelId: modelId.value, nodeId: nodeId.value || undefined, takes: takes.value, timeline: makeTl.value, camera: useCam.value, facing: facing.value })
    toast(`Captura importada: ${r.clips.length} clip${r.clips.length === 1 ? '' : 's'}${r.timelines.length ? ` y ${r.timelines.length} cinemática${r.timelines.length === 1 ? '' : 's'}` : ''}`, 'ok', 4000)
    store.modal = null
    if (r.timelines.length) openTimelineEditor()
  } catch (e) { error.value = e.message || String(e) }
}
const fmt = (s) => s.toFixed(1) + ' s'
</script>

<template>
  <AppWindow title="Importar captura de movimiento" subtitle=".lfcap · Century Capture" :width="560" persist="capture-import" @close="store.modal = null">
    <div class="cap" @dragover.prevent @drop.prevent="onDrop">
      <section>
        <button class="primary" data-test="cap-pick" @click="choose">Elegir archivo .lfcap…</button>
        <span class="f">{{ file || 'o arrástralo aquí' }}</span>
        <input type="file" accept=".lfcap,application/json" data-test="cap-file" hidden @change="$event.target.files[0] && load($event.target.files[0])" />
      </section>
      <section v-if="info">
        <h4>Tomas de «{{ info.cap.name }}»</h4>
        <label v-for="t in info.takes" :key="t.index" class="row">
          <input v-model="takes" type="checkbox" :value="t.index" />
          <b>{{ t.name }}</b> <i>{{ fmt(t.duration) }} · {{ t.frames }} fotogramas · {{ t.cameraKeys }} claves de cámara · {{ t.layers }} efectos</i>
        </label>
      </section>
      <section>
        <h4>Personaje</h4>
        <label class="fld">Modelo con huesos
          <select v-model="modelId" data-test="cap-model">
            <option value="" disabled>Elige un modelo…</option>
            <option v-for="m in models" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </label>
        <p v-if="!models.length" class="warn">Importa primero un modelo .glb/.gltf con esqueleto (Mixamo, Blender, Unreal…).</p>
        <p v-else-if="rig && rig.ok" class="okk">✓ Esqueleto humanoide reconocido ({{ rig.bones }} huesos; caderas «{{ rig.map.hips }}»)</p>
        <p v-else-if="rig" class="warn">{{ rig.bones ? 'No reconozco el esqueleto humanoide' : 'Este modelo no tiene huesos' }} (faltan: {{ rig.missing.join(', ') }}).</p>
        <label class="fld">Actor en la escena
          <select v-model="nodeId" data-test="cap-node">
            <option value="">(ninguno: solo crear el clip)</option>
            <option v-for="o in nodes" :key="o.id" :value="o.id">{{ o.name }}</option>
          </select>
        </label>
        <label class="fld">El modelo mira hacia
          <select v-model="facing"><option value="+Z">+Z (glTF, Mixamo: lo normal)</option><option value="-Z">−Z</option></select>
        </label>
      </section>
      <section>
        <h4>Cinemática</h4>
        <label class="row"><input v-model="makeTl" type="checkbox" /> Crear una cinemática por toma (Timeline)</label>
        <label class="row" :class="{ off: !makeTl }"><input v-model="useCam" type="checkbox" :disabled="!makeTl" /> Usar la cámara grabada con el móvil (anclada al actor)</label>
        <p class="hint lf-help">El clip queda en el modelo: se reproduce con «Reproducir animación», <code>node.playAnimation("Nombre")</code> o desde la cinemática, que además lleva los subtítulos, fundidos y barras de cine de la app.</p>
      </section>
      <p v-if="error" class="err" data-test="cap-error">{{ error }}</p>
    </div>
    <template #footer>
      <span style="flex:1"></span><button @click="store.modal = null">Cancelar</button>
      <button class="primary" data-test="cap-import" :disabled="!canImport" @click="run">Importar</button>
    </template>
  </AppWindow>
</template>

<style scoped>
.cap { padding: 12px 16px; display: flex; flex-direction: column; gap: 12px; }
section { display: flex; flex-direction: column; gap: 6px; }
section:first-child { flex-direction: row; align-items: center; gap: 10px; }
h4 { margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted, #9aa3b2); }
.f { color: var(--muted, #9aa3b2); font-size: 12px; }
.row { display: flex; gap: 8px; align-items: baseline; font-size: 13px; }
.row i { color: var(--muted, #9aa3b2); font-style: normal; font-size: 12px; }
.row.off { opacity: .5; }
.fld { display: grid; grid-template-columns: 150px 1fr; align-items: center; gap: 8px; font-size: 13px; }
.warn { color: #e3b341; margin: 0; font-size: 12px; }
.okk { color: #6cc18a; margin: 0; font-size: 12px; }
.err { color: #ff6b6b; margin: 0; font-size: 12px; }
.hint { color: var(--muted, #9aa3b2); margin: 0; font-size: 12px; }
</style>
