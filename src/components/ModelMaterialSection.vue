<script setup>
import { computed } from 'vue'
import { store, updateObject } from '../core/store.js'
import { describeModelMaterials, modelSlotState, modelSlotPatch, localModelMaterial, editModelSlotMaterial, chooseModelSlotMaterial } from '../engine/runtime/render/model-material.js'
import MaterialSection from './MaterialSection.vue'
const props = defineProps({ obj: { type:Object, required:true } })
const slots = computed(() => describeModelMaterials(store.editor?.models?.get(props.obj.modelId)).slots)
const resources = computed(() => store.project?.materials || [])
const state = slot => modelSlotState(props.obj, slot.id)
function write(slot, value, label = 'Editar material del modelo', commit = true) {
  updateObject(props.obj.id, modelSlotPatch(props.obj, slot.id, value), { label, commit })
}
function choose(slot, id) {
  write(slot, chooseModelSlotMaterial(slot, state(slot), id, resources.value), 'Asignar material del modelo')
}
function edit(slot, patch, label, commit) {
  write(slot, editModelSlotMaterial(slot, state(slot), patch), label, commit)
}
</script>
<template>
  <p v-if="!slots.length" class="hint">Modelo sin materiales disponibles.</p>
  <MaterialSection v-for="slot in slots" :key="`${obj.id}:${slot.id}`"
    :obj="state(slot) || localModelMaterial(slot)" :slot-name="slot.name" :slot-uv="slot.uv"
    :slot-original="!state(slot)" :slot-imported="slot.material" :slot-edit="(patch,label,commit) => edit(slot,patch,label,commit)"
    :slot-choose="id => choose(slot,id)" :slot-restore="() => write(slot,null,'Restaurar material original')" />
</template>
