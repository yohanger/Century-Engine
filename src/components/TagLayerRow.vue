<script setup>
// Groups de scripting y Layers de físicas/audio comparten la fila, pero no el estado.
import { ref, computed } from 'vue'
import { store, updateObject, openTagLayers } from '../core/store.js'
import { layersOf, groupsOf, layerName } from '../engine/runtime/layers.js'
import downIcon from '../assets/icons/icn_expand_down.png'

const props = defineProps({ obj: { type: Object, required: true } })
const tl = computed(() => store.project.tagLayers)
const open = ref(false), groupOpen = ref(false)
const cur = computed(() => layersOf(props.obj))
const groups = computed(() => groupsOf(props.obj))
const names = computed(() => [...(tl.value.groups || []), ...groups.value.filter((g) => !(tl.value.groups || []).some((n) => n.toLowerCase() === g.toLowerCase()))])
const named = computed(() => tl.value.layers.map((l, i) => [i, l.name]).filter(([, n]) => n))
const summary = computed(() => cur.value.length === 1 ? layerName(tl.value, cur.value[0]) : `Mixto (${cur.value.length})`)
const groupSummary = computed(() => groups.value.length ? groups.value.join(', ') : 'Sin grupos')
function toggleGroup(name) {
  const next = groups.value.some((n) => n.toLowerCase() === name.toLowerCase())
    ? groups.value.filter((n) => n.toLowerCase() !== name.toLowerCase()) : [...groups.value, name]
  updateObject(props.obj.id, { groups: next })
}
function toggleLayer(i) {
  const s = new Set(cur.value)
  if (s.has(i)) s.delete(i); else s.add(i)
  const next = [...cur.value.filter((x) => s.has(x)), ...[...s].filter((x) => !cur.value.includes(x))]
  updateObject(props.obj.id, { layers: next.length ? next : [0] })
}
</script>
<template>
  <div class="tlr">
    <div class="ly" @keydown.escape.stop="groupOpen = false; $event.currentTarget.querySelector('button').focus()">
      <span>Groups</span>
      <button type="button" class="lyb" data-testid="insp-groups" :aria-label="'Groups: ' + groupSummary" :aria-expanded="groupOpen" :data-tooltip="groupSummary" @click="groupOpen = !groupOpen; open = false"><span>{{ groupSummary }}</span><img :src="downIcon" alt="" /></button>
      <div v-if="groupOpen" class="pop" @mouseleave="groupOpen = false">
        <label v-for="name in names" :key="name" class="opt"><input type="checkbox" :checked="groups.some((g) => g.toLowerCase() === name.toLowerCase())" @change="toggleGroup(name)" />{{ name }}</label>
        <p v-if="!names.length" class="dim">Todavía no hay grupos</p>
        <button class="ghost addb" @click="groupOpen = false; openTagLayers()">Administrar Groups…</button>
      </div>
    </div>
    <div class="ly" @keydown.escape.stop="open = false; $event.currentTarget.querySelector('button').focus()">
      <span>Layer</span>
      <button type="button" class="lyb" data-testid="insp-layer" :aria-label="'Layer: ' + summary" :aria-expanded="open" :data-tooltip="cur.map((i) => layerName(tl, i)).join(', ')" @click="open = !open; groupOpen = false"><span>{{ summary }}</span><img :src="downIcon" alt="" /></button>
      <div v-if="open" class="pop" @mouseleave="open = false">
        <label v-for="[i, n] in named" :key="i" class="opt"><input type="checkbox" :checked="cur.includes(i)" @change="toggleLayer(i)" />{{ n }}<i v-if="tl.layers[i].surface" class="dim">· {{ tl.layers[i].surface }}</i></label>
        <button class="ghost addb" @click="open = false; openTagLayers()">Administrar Layers…</button>
      </div>
    </div>
  </div>
</template>
<style scoped>
.tlr { display: flex; gap: 9px; }
.ly { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--text); flex: 1 1 0; min-width: 0; position: relative; }
.lyb {
  flex: 1; min-width: 0; height: 23px; padding: 0 5px; gap: 3px; justify-content: space-between;
  font-size: 11px; background: var(--details-field, var(--g-950)); border-color: var(--hair);
}
.lyb span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lyb img { width: 9px; height: 9px; object-fit: contain; flex: none; }
.pop { position: absolute; z-index: 30; top: 100%; right: 0; min-width: 170px; max-height: 260px; overflow: auto; background: var(--g-850); border: 1px solid var(--hair); border-radius: 6px; padding: 4px; box-shadow: 0 8px 24px rgba(0,0,0,.45); display: flex; flex-direction: column; }
.ly:first-child .pop { left: 0; right: auto; }
.opt { display: flex; align-items: center; gap: 6px; padding: 3px 6px; color: var(--text); font-size: 12px; cursor: pointer; border-radius: 4px; }
.opt:hover { background: var(--g-700); }
.dim { color: var(--text-3); font-size: 11px; }
.addb { margin-top: 4px; }
</style>
