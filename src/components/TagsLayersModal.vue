<script setup>
// Groups de scripting y Layers físicas/audio del proyecto.
//   · Groups: nombres reutilizables de pertenencia múltiple, sin reemplazar la jerarquía.
//   · Layers: 32 ranuras. Las reservadas no se renombran; las libres se nombran con un clic. Cada layer con nombre puede tener
//     una SUPERFICIE (piedra, tierra…): el motor la usa para los pasos del jugador.
import { ref, computed } from 'vue'
import AppWindow from './AppWindow.vue'
import { store, editTagLayers } from '../core/store.js'
import { RESERVED_LAYERS, SURFACE_LIST, addGroup, removeGroup, groupsOf, setLayerName, setLayerSurface, MAX_LAYERS, stepsCount } from '../engine/runtime/layers.js'
import StepSoundsEditor from './StepSoundsEditor.vue'

const tab = ref(store.tlTab === 'layers' ? 'layers' : 'groups')
const tl = computed(() => store.project.tagLayers)
const newGroup = ref(''), err = ref('')
const openSteps = ref(-1) // layer con el editor de sonido de pasos abierto
const usage = (name) => store.project.objects.filter((o) => groupsOf(o).includes(name)).length
const layerUse = (i) => store.project.objects.filter((o) => (o.layers || [0]).includes(i)).length

function add() {
  err.value = ''
  const n = newGroup.value.trim()
  if (!n) return
  if (!editTagLayers((t) => addGroup(t, n))) { err.value = 'Ese grupo ya existe o no es válido.'; return }
  newGroup.value = ''
}
function eraseGroup(name) {
  // No borrar pertenencias de escenas no abiertas: quitar solo el nombre sugerido.
  editTagLayers((t) => removeGroup(t, name))
}
function rename(i, v) {
  err.value = ''
  if (!editTagLayers((t) => setLayerName(t, i, v))) err.value = 'Ese nombre ya lo usa otra layer.'
}
</script>

<template>
  <AppWindow title="Groups y Layers" subtitle="globales del proyecto" :width="600" :height="560" :min-width="340" :min-height="300" :scroll="false" persist="taglayers" data-win="tl" @close="store.modal = null">
    <div class="tlw">
      <div class="seg">
        <button :class="{ on: tab === 'groups' }" data-testid="tl-tab-groups" @click="tab = 'groups'">Groups <span class="dim">{{ (tl.groups || []).length }}</span></button>
        <button :class="{ on: tab === 'layers' }" data-testid="tl-tab-layers" @click="tab = 'layers'">Layers <span class="dim">{{ tl.layers.filter((l) => l.name).length }}/{{ MAX_LAYERS }}</span></button>
      </div>
      <p v-if="err" class="err">{{ err }}</p>

      <div v-if="tab === 'groups'" class="pane">
        <p class="dim lf-help">Un nodo puede pertenecer a varios grupos. Se consultan desde scripts con <code>game.get_nodes_in_group("enemigos")</code>.</p>
        <div class="add"><input v-model="newGroup" type="text" placeholder="Nuevo grupo…" maxlength="40" data-testid="tl-newgroup" @keydown.enter="add" /><button class="primary" :disabled="!newGroup.trim()" @click="add">Añadir</button></div>
        <div class="rows">
          <div v-for="t in (tl.groups || [])" :key="t" class="row">
            <span class="nm">{{ t }}</span>
            <span class="dim">{{ usage(t) ? usage(t) + ' obj.' : '' }}</span>
            <button class="ghost icon danger" data-tooltip="Quitar nombre sugerido; las pertenencias de escenas existentes se conservan" @click="eraseGroup(t)">✕</button>
          </div>
        </div>
      </div>

      <div v-else class="pane">
        <p class="dim lf-help">Un objeto puede estar en varias layers; para los pasos manda la primera con sonido. <b>♪</b> añade clips propios (caminar, correr, aterrizar, saltar); sin clips suena el sintético de la <b>superficie</b>.</p>
        <div class="rows">
          <template v-for="(l, i) in tl.layers" :key="i">
          <div class="row lr" :class="{ free: !l.name, open: openSteps === i }">
            <span class="id">{{ i }}</span>
            <span v-if="RESERVED_LAYERS.includes(i)" class="nm" data-tooltip="Reservada">{{ l.name }} <span class="dim">🔒</span></span>
            <input v-else type="text" :value="l.name" :placeholder="'Layer ' + i" maxlength="40" :data-testid="'tl-layer-' + i" @change="rename(i, $event.target.value); $event.target.value = tl.layers[i].name" />
            <select :value="l.surface" :disabled="!l.name" data-tooltip="Superficie (pasos)" @change="editTagLayers((t) => setLayerSurface(t, i, $event.target.value))">
              <option value="">— sin superficie —</option>
              <option v-for="[k, lab] in SURFACE_LIST" :key="k" :value="k">{{ lab }}</option>
            </select>
            <button class="snd" :class="{ on: stepsCount(l.steps), open: openSteps === i }" :disabled="!l.name" :data-testid="'tl-steps-' + i" :aria-label="'Sonido de pasos de ' + (l.name || 'la layer')" @click="openSteps = openSteps === i ? -1 : i">♪<b v-if="stepsCount(l.steps)">{{ stepsCount(l.steps) }}</b></button>
            <span class="dim use">{{ layerUse(i) ? layerUse(i) + ' obj.' : '' }}</span>
          </div>
          <StepSoundsEditor v-if="openSteps === i && l.name" :index="i" />
          </template>
        </div>
      </div>
    </div>
    <template #footer><span class="grow"></span><button class="primary" @click="store.modal = null">Cerrar</button></template>
  </AppWindow>
</template>

<style scoped>
.tlw { display: flex; flex-direction: column; height: 100%; min-height: 0; padding: 8px 10px; gap: 8px; }
.seg { display: inline-flex; align-self: flex-start; border: 1px solid var(--hair); border-radius: 6px; overflow: hidden; }
.seg button { border: 0; border-radius: 0; background: transparent; padding: 4px 12px; }
.seg button.on { background: var(--accent, #3b82f6); color: #fff; }
.pane { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 8px; }
.dim { color: var(--text-3); font-size: 12px; } .grow { flex: 1; }
.err { color: #f08a8a; margin: 0; font-size: 12px; }
.add { display: flex; gap: 6px; } .add input { flex: 1; min-width: 0; }
.rows { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 2px; border: 1px solid var(--hair); border-radius: 6px; padding: 4px; }
.row { display: flex; align-items: center; gap: 8px; min-height: 28px; padding: 0 6px; border-radius: 4px; }
.row:hover { background: var(--g-800, rgba(255,255,255,.04)); }
.nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lr .id { width: 22px; text-align: right; color: var(--text-3); font-size: 11px; flex: none; }
.lr input { flex: 1 1 0; min-width: 0; } .lr select { flex: 0 1 140px; min-width: 0; }
.lr.free .id { opacity: .5; } .use { width: 52px; text-align: right; flex: none; }
@container win (max-width: 460px) { .lr select { flex-basis: 96px; } .use { display: none; } }
.snd { flex: none; width: 34px; height: 22px; padding: 0; font-size: 12px; display: inline-flex; align-items: center; justify-content: center; gap: 2px; color: var(--text-3); }
.snd.on { color: var(--blue-hi, #7ab8ff); } .snd.open { background: var(--blue-wash, rgba(61,139,214,.2)); }
.snd b { font-size: 9.5px; font-weight: 600; }
.row.open { background: var(--g-800, rgba(255,255,255,.05)); border-radius: 4px 4px 0 0; }
</style>
