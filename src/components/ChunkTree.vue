<script setup>
import { computed } from 'vue'
import { store } from '../core/store.js'
import { kindIcon } from '../engine/runtime/nodes/index.js'
import Icon from './Icon.vue'

const props = defineProps({ filter: { type: String, default: '' } })
const entries = computed(() => {
  const query = props.filter.trim().toLocaleLowerCase()
  if (!query) return store.streamingPreviewRows
  return store.streamingPreviewRows.map(entry => {
    if (entry.name.toLocaleLowerCase().includes(query)) return entry
    return { ...entry, nodes: entry.nodes.filter(node => node.name.toLocaleLowerCase().includes(query)) }
  }).filter(entry => entry.nodes.length || entry.name.toLocaleLowerCase().includes(query))
})
function select(index, id) { store.editor?.streamingPreview.select(index, id) }
</script>

<template>
  <details v-for="entry in entries" :key="entry.index + '/' + entry.sceneId"
    class="chunk-tree" :open="store.chunkSelection?.index === entry.index || !!filter ? true : undefined">
    <summary>
      <button type="button" :class="{ selected: store.chunkSelection?.index === entry.index && !store.chunkSelection?.nodeId }"
        :disabled="!entry.ready" :aria-pressed="store.chunkSelection?.index === entry.index && !store.chunkSelection?.nodeId"
        :data-chunk-index="entry.index" @click.prevent.stop="select(entry.index)">
        <Icon name="prefab" :size="13" /> {{ entry.name }}
      </button>
    </summary>
    <button v-for="node in entry.nodes" :key="node.id" type="button" class="chunk-node"
      :class="{ selected: store.chunkSelection?.index === entry.index && store.chunkSelection?.nodeId === node.id }"
      :aria-pressed="store.chunkSelection?.index === entry.index && store.chunkSelection?.nodeId === node.id"
      :data-chunk-node="node.id" :style="{ paddingInlineStart: (12 + node.depth * 14) + 'px' }"
      @click.stop="select(entry.index, node.id)">
      <Icon :name="kindIcon(node)" :size="13" /> {{ node.name }}
    </button>
  </details>
</template>

<style scoped>
.chunk-tree { margin-left: 14px; color: var(--text-2); }
.chunk-tree summary { min-width: 0; }
.chunk-tree summary button, .chunk-node { display: inline-flex; align-items: center; gap: 6px; border: 0; background: transparent; color: inherit; text-align: left; }
.chunk-node { display: flex; width: 100%; min-height: 23px; }
.chunk-tree button:hover, .chunk-tree button.selected { background: var(--blue-wash); color: var(--text); }
</style>
