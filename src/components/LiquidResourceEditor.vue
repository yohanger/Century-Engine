<script setup>
import { computed } from 'vue'
import { store, updateLiquid } from '../core/store.js'
import NumberField from './NumberField.vue'
const props=defineProps({liquidId:{type:String,required:true}})
const liquid=computed(()=>store.project?.liquids?.find((l)=>l.id===props.liquidId))
const set=(key,v)=>updateLiquid(props.liquidId,{[key]:v})
</script>
<template>
  <div v-if="liquid" class="insp" data-node-type="liquid">
    <section class="sect"><header>Líquido · {{ liquid.name }}</header>
      <div class="body">
        <p class="hint lf-help">Perfil reutilizable. Los recipientes guardan el volumen dinámico solo en Play.</p>
        <div class="field"><label>Densidad (kg/m³)</label><NumberField :model-value="liquid.densityKgM3" :step="10" :min="1" :max="30000" @update:model-value="set('densityKgM3',$event)" /></div>
        <div class="field"><label>Viscosidad relativa</label><NumberField :model-value="liquid.viscosity" :step="0.05" :min="0.01" :max="100" @update:model-value="set('viscosity',$event)" /></div>
        <div class="field"><label>Color</label><input type="color" :value="liquid.color" @change="set('color',$event.target.value)" /></div>
        <div class="field"><label>Opacidad</label><NumberField :model-value="liquid.opacity" :step="0.05" :min="0.05" :max="1" @update:model-value="set('opacity',$event)" /></div>
      </div>
    </section>
  </div>
</template>
