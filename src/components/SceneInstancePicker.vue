<script setup>
// Selector editorial de escenas: no crea nodos ni duplica la autoridad de Assets.
// La operación se ejecuta exclusivamente en SceneTree mediante instantiateScene().
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import AppWindow from './AppWindow.vue'
import Icon from './Icon.vue'

const props = defineProps({
  scenes: { type: Array, required: true },
  activeSceneId: { type: String, required: true },
  parentName: { type: String, default: '' },
  busy: { type: Boolean, default: false },
})
const emit = defineEmits(['choose', 'close'])
const search = ref('')
const chosen = ref(null)
const searchInput = ref(null)
const candidates = computed(() => props.scenes.filter(s => s.id !== props.activeSceneId)
  .filter(s => `${s.name} ${s.folder || 'Assets/Scenes'}`.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase()))
  .sort((a, b) => a.name.localeCompare(b.name, 'es') || a.id.localeCompare(b.id)))
const selected = computed(() => candidates.value.find(s => s.id === chosen.value) || null)
watch(candidates, list => {
  if (!list.some(s => s.id === chosen.value)) chosen.value = list[0]?.id || null
}, { immediate: true })
onMounted(() => { nextTick(() => searchInput.value?.focus({ preventScroll: true })) })
function confirm() { if (selected.value && !props.busy) emit('choose', selected.value.id) }
function keydown(e) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    const current = candidates.value.findIndex(s => s.id === chosen.value)
    const next = e.key === 'ArrowDown' ? Math.min(current + 1, candidates.value.length - 1) : Math.max(current - 1, 0)
    if (candidates.value[next]) chosen.value = candidates.value[next].id
    e.preventDefault()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    confirm()
  }
}
</script>

<template>
  <AppWindow title="Instanciar escena" :subtitle="parentName ? `Dentro de ${parentName}` : 'Raíz de la escena'"
    :width="510" :height="450" :min-width="350" :min-height="280" :scroll="false" :resizable="true"
    @close="emit('close')">
    <div class="picker" data-testid="scene-instance-picker" @keydown="keydown">
      <label class="search-label" for="lf-scene-instance-search">Escenas del proyecto</label>
      <div class="search"><Icon name="search" :size="14" />
        <input id="lf-scene-instance-search" ref="searchInput" v-model="search" type="search"
          aria-label="Buscar escena por nombre o carpeta" autocomplete="off" placeholder="Buscar escena…" :disabled="busy" />
      </div>
      <div class="results" role="listbox" aria-label="Escenas disponibles" :aria-busy="busy">
        <button v-for="s in candidates" :key="s.id" type="button" role="option" class="scene-option"
          :aria-selected="chosen === s.id" :class="{ picked: chosen === s.id }" :disabled="busy"
          @click="chosen = s.id" @dblclick="chosen = s.id; confirm()">
          <Icon name="scene" :size="16" />
          <span class="entry"><strong>{{ s.name }}</strong><span class="folder">{{ s.folder || 'Assets/Scenes' }}</span></span>
          <Icon v-if="chosen === s.id" name="check" :size="13" />
        </button>
        <div v-if="!candidates.length" class="empty">
          {{ search.trim() ? 'No se encontraron escenas con ese nombre.' : 'No hay otras escenas disponibles. Crea una escena desde Assets para poder instanciarla.' }}
        </div>
      </div>
    </div>
    <template #footer>
      <span class="destination">{{ parentName ? `Destino: ${parentName}` : 'Destino: raíz de la escena' }}</span>
      <span class="spacer"></span>
      <button type="button" :disabled="busy" @click="emit('close')">Cancelar</button>
      <button type="button" class="primary" data-testid="scene-instance-confirm" :disabled="!selected || busy" @click="confirm">
        {{ busy ? 'Instanciando…' : 'Instanciar' }}
      </button>
    </template>
  </AppWindow>
</template>

<style scoped>
.picker { display:flex; flex:1; flex-direction:column; min-height:0; padding:12px; gap:8px; }
.search-label { font-size:11px; font-weight:600; color:var(--text-2); }
.search { display:flex; align-items:center; gap:7px; color:var(--text-3); background:var(--g-950); border:1px solid var(--hair); border-radius:5px; padding:0 9px; min-height:32px; }
.search:focus-within { border-color:var(--blue); }
.search input { background:transparent; border:0; padding:0; flex:1; min-width:0; height:30px; outline:0; font-size:12px; }
.results { flex:1; overflow:auto; min-height:0; border:1px solid var(--hair); border-radius:5px; padding:4px; background:var(--g-900); }
.scene-option { display:flex; align-items:center; gap:10px; width:100%; min-height:45px; text-align:left; padding:5px 10px; background:transparent; border:1px solid transparent; border-radius:4px; color:var(--text-2); }
.scene-option:hover, .scene-option:focus-visible { background:var(--g-800); color:var(--text); }
.scene-option.picked { background:var(--blue-wash); border-color:var(--blue); color:var(--text); }
.entry { display:flex; flex:1; flex-direction:column; min-width:0; gap:2px; }
.entry strong, .entry .folder { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.entry strong { font-size:12px; font-weight:500; }
.folder { font-size:10.5px; color:var(--text-3); }
.empty { padding:28px 18px; color:var(--text-3); text-align:center; font-size:12px; line-height:1.55; }
.destination { font-size:11px; color:var(--text-3); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:50%; }
.spacer { flex:1; }
</style>
