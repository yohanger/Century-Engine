<script setup>
import { computed } from 'vue'
import { activeScene, store, switchScene } from '../core/store.js'
import Vec3Field from './Vec3Field.vue'

const selected = computed(() => {
  // Las filas se publican tanto al montar los chunks como al editar sus nodos.
  if (!store.streamingPreviewRows.some(row => row.index === store.chunkSelection?.index)) return null
  return store.editor?.streamingPreview.selection()
})
const raw = computed(() => activeScene()?.streaming?.chunks[store.chunkSelection?.index])
const source = computed(() => store.project.scenes.find(scene => scene.id === store.chunkSelection?.sceneId))
const xyz = computed(() => [raw.value?.x ?? 0, raw.value?.y ?? 0, raw.value?.z ?? 0])
const fields = [
  { key: 'position', label: 'Posición local', step: 0.1, fallback: [0, 0, 0] },
  { key: 'rotation', label: 'Rotación local', step: 1, fallback: [0, 0, 0] },
  { key: 'scale', label: 'Escala local', step: 0.1, fallback: [1, 1, 1] },
]
function change(field, event) {
  if (event.commit) store.editor?.streamingPreview.setTransform(field, event.value)
}
</script>

<template>
  <div v-if="selected" class="chunk-inspector">
    <button v-if="source" type="button" @click="switchScene(source.id)">Abrir escena fuente · {{ source.name }}</button>
    <p v-if="selected.nodeId">Los cambios se guardan en la escena fuente y se reflejan en todas sus instancias.</p>
    <p v-else>La posición del chunk coloca esta instancia en la escena madre.</p>
    <fieldset :disabled="selected.locked || store.locked">
      <template v-if="selected.obj">
        <label v-for="field in fields.filter(field => field.key !== 'scale' || selected.scalable)" :key="selected.nodeId + field.key">
          <span>{{ field.label }}</span>
          <Vec3Field :model-value="selected.obj[field.key] || field.fallback" :step="field.step" @change="change(field.key, $event)" />
        </label>
      </template>
      <label v-else>
        <span>Centro en el mundo</span>
        <Vec3Field :key="selected.index" :model-value="xyz" @change="change('position', $event)" />
      </label>
    </fieldset>
  </div>
</template>

<style scoped>
.chunk-inspector { display: grid; gap: 8px; padding: 10px; }
.chunk-inspector p { margin: 0; color: var(--text-2); }
.chunk-inspector fieldset { display: grid; min-width: 0; gap: 8px; border: 0; padding: 0; margin: 0; }
.chunk-inspector label { display: grid; gap: 4px; }
</style>
