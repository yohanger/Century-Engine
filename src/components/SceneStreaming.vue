<script setup>
import { computed } from 'vue'
import { activeScene, commit, store } from '../core/store.js'
import { CHUNK_DEFAULTS, normalizeChunk } from '../engine/runtime/streaming/config.js'
import NumberField from './NumberField.vue'

const owner = computed(() => activeScene())
const config = computed(() => owner.value?.streaming || { enabled: false, parallel: 1, chunks: [] })
const sources = computed(() => store.project.scenes.filter(scene => scene.id !== owner.value?.id))
const disabled = computed(() => store.locked || store.play?.on || store.filmMode)
const fields = [
  ['x', 'Centro X', -10000000, 1], ['y', 'Centro Y', -10000000, 1], ['z', 'Centro Z', -10000000, 1],
  ['width', 'Ancho X', 1, 1], ['height', 'Altura Y (0 = sin límite)', 0, 1], ['depth', 'Profundidad Z', 1, 1],
  ['preload', 'Distancia de precarga', 0, 1], ['distantRange', 'Alcance lejano', 0, 1],
  ['unloadMargin', 'Margen de descarga', 0, 1], ['unloadDelay', 'Demora de descarga (s)', 0, 0.1],
]
const save = () => commit('Streaming de escena')
function change(patch, commitNow = true) {
  if (!owner.value || disabled.value) return
  owner.value.streaming = { ...config.value, ...patch }
  if (commitNow) save()
}
function changeChunk(index, patch, commitNow = true) {
  const chunks = config.value.chunks.map((chunk, i) => i === index ? { ...chunk, ...patch } : chunk)
  change({ chunks }, commitNow)
}
function addChunk() {
  const previous = config.value.chunks.at(-1)
  change({ chunks: [...config.value.chunks, {
    ...CHUNK_DEFAULTS, sceneId: sources.value[0].id, x: previous ? previous.x + previous.width : 128,
  }] })
}
</script>

<template>
  <fieldset v-if="owner" :disabled="disabled">
    <label><span>Activar streaming en esta escena</span>
      <input type="checkbox" :checked="config.enabled" @change="change({ enabled: $event.target.checked })" />
    </label>
    <template v-if="config.enabled">
      <label><span>Cargas simultáneas</span>
        <NumberField :modelValue="config.parallel" :min="1" :max="8" :step="1"
          @update:modelValue="change({ parallel: +$event }, false)" @commit="save" />
      </label>
      
      <details v-for="(raw, index) in config.chunks" :key="index" class="chunk">
        <summary>{{ sources.find(scene => scene.id === raw.sceneId)?.name || 'Escena ausente' }} · {{ raw.x }}, {{ raw.y }}, {{ raw.z }}</summary>
        <label><span>Escena de detalle</span>
          <select :value="raw.sceneId" @change="changeChunk(index, { sceneId: $event.target.value })">
            <option v-if="!sources.some(scene => scene.id === raw.sceneId)" :value="raw.sceneId">Referencia ausente</option>
            <option v-for="scene in sources" :key="scene.id" :value="scene.id">{{ scene.name }}</option>
          </select>
        </label>
        <label><span>Escena lejana (LOD)</span>
          <select :value="raw.distantSceneId" @change="changeChunk(index, { distantSceneId: $event.target.value })">
            <option value="">Ninguna</option>
            <option v-if="raw.distantSceneId && !sources.some(scene => scene.id === raw.distantSceneId)" :value="raw.distantSceneId">Referencia ausente</option>
            <option v-for="scene in sources" :key="scene.id" :value="scene.id" :disabled="scene.id === raw.sceneId">{{ scene.name }}</option>
          </select>
        </label>
        <label v-for="[key, caption, minimum, step] in fields" :key="key">
          <span>{{ caption }}</span>
          <NumberField :modelValue="raw[key] ?? normalizeChunk(raw)[key]" :min="minimum" :max="10000000" :step="step"
            :disabled="!raw.distantSceneId && key === 'distantRange'"
            @update:modelValue="changeChunk(index, { [key]: +$event }, false)" @commit="save" />
        </label>
        <button type="button" :disabled="!store.streamingPreviewRows.some(row => row.index === index && row.ready)"
          @click="store.editor?.streamingPreview.select(index)">Seleccionar en escena</button>
        <button type="button" @click="change({ chunks: config.chunks.filter((_, i) => i !== index) })">Quitar chunk</button>
      </details>
      <button class="streaming-add" type="button" :disabled="!sources.length" data-tooltip="Coloca la escena fuente en coordenadas del mundo. La versión lejana es opcional." @click="addChunk">Añadir chunk…</button>
      <p v-if="!sources.length" class="streaming-warning" role="status">Crea otra escena para usarla como fuente del chunk.</p>
    </template>
  </fieldset>
</template>

<style scoped>
fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
label { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: center; gap: 8px; margin-block: 5px; }
select { min-width: 0; width: 100%; }
input[type=checkbox] { justify-self: start; }
.chunk { border: 1px solid var(--hair); border-radius: 4px; padding: 6px; margin-block: 8px; }
.chunk > summary { cursor: pointer; overflow-wrap: anywhere; }

.chunk > summary { background: var(--g-800); padding: 5px; border-radius: 3px; }
.chunk button { margin: 4px 3px 0 0; white-space: normal; }
.streaming-add { width: 100%; }
.streaming-warning { font-size: 11px; color: var(--text-3); }
@container scene-inspector (max-width:260px) { label { grid-template-columns: minmax(0,1fr); gap:3px; } }
</style>
