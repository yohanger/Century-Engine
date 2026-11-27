<script setup>
// Editor del recurso compartido dentro del Inspector; las propiedades siguen en MaterialSection.
import { computed } from 'vue'
import MaterialSection from './MaterialSection.vue'
import { store, renameEntry } from '../core/store.js'
const props = defineProps({ materialId: { type: String, required: true } })
const material = computed(() => store.project?.materials?.find((m) => m.id === props.materialId))
const changeName = (name) => { if (material.value) renameEntry('material', material.value.id, name.trim() || material.value.name) }
</script>
<template>
  <div v-if="material" class="mat-editor" data-testid="material-inspector">
    <div class="mat-heading"><strong>Material compartido</strong><small>{{ material.folder }}/{{ material.name }}</small></div>
    <label for="mat-resource-name">Nombre del recurso</label>
    <input id="mat-resource-name" :value="material.name" @change="changeName($event.target.value)" />
    <MaterialSection :resource-id="material.id" />
  </div>
</template>
<style scoped>
.mat-editor { display:flex; flex-direction:column; gap:10px; padding:12px 10px; min-width:0; }
.mat-heading { display:flex; flex-direction:column; min-width:0; gap:3px; }
.mat-heading strong { font-size:13px; }
.mat-heading small { font-size:11px; color:var(--text-3); overflow-wrap:anywhere; }
.mat-editor label { font-size:12px; color:var(--text-2); }
.mat-editor input { width:100%; min-width:0; }
</style>
