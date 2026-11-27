<script setup>
import { computed } from 'vue'
import { store, updateObject } from '../core/store.js'
import { fluidContainerDefaults, FLUID_CONTAINER_KINDS } from '../engine/runtime/fluids/container-props.js'
import { containerCapacity } from '../engine/runtime/fluids/container-shape.js'
import NumberField from './NumberField.vue'
import Vec3Field from './Vec3Field.vue'
const props=defineProps({obj:{type:Object,required:true}})
const cfg=computed(()=>({...fluidContainerDefaults(props.obj.kind),...props.obj.props.liquidContainer}))
const capacity=computed(()=>containerCapacity(cfg.value.shape,cfg.value.size,cfg.value.vessel,cfg.value.mouthRadius,cfg.value.neckHeight))
const profiles=computed(()=>store.project.liquids||[])
const set=patch=>{
  const next={...cfg.value,...patch},limit=containerCapacity(next.shape,next.size,next.vessel,next.mouthRadius,next.neckHeight)
  next.initialM3=Math.min(next.initialM3,limit)
  updateObject(props.obj.id,{props:{liquidContainer:next}},{label:'Recipiente de fluido'})
}
const preset=kind=>{const next=fluidContainerDefaults(kind);updateObject(props.obj.id,{kind,props:{liquidContainer:{...next,liquidId:cfg.value.liquidId,showVessel:cfg.value.showVessel}}},{label:'Tipo de recipiente'})}
const dimensions=size=>set({size,mouthRadius:undefined,neckHeight:undefined,initialM3:Math.min(cfg.value.initialM3,containerCapacity(cfg.value.shape,size,cfg.value.vessel))})
</script>
<template>
  <section class="sect" data-testid="fluid-container-inspector" data-fold-id="fluid-container">
    <header>Recipiente de fluido</header><div class="body">
      <div class="field"><label>Tipo de envase</label><select :value="obj.kind||'cup'" aria-label="Tipo de envase" @change="preset($event.target.value)"><option v-for="(p,k) in FLUID_CONTAINER_KINDS" :key="k" :value="k">{{p.label}}</option></select></div>
      <div class="field"><label>Interior (m)</label><Vec3Field :model-value="cfg.size" :min="0.01" :max="10" :step="0.005" @change="dimensions($event.value)" /></div>
      <div class="field"><label>Contenido</label><select :value="cfg.liquidId" aria-label="Líquido del recipiente" @change="set({liquidId:$event.target.value})"><option value="water">Agua</option><option v-for="p in profiles" :key="p.id" :value="p.id">{{p.name}}</option></select></div>
      <div class="field"><label>Cantidad inicial (L)</label><NumberField :model-value="cfg.initialM3*1000" :min="0" :max="capacity*1000" :step="0.01" @update:model-value="set({initialM3:$event/1000})" /></div>
      <div class="field"><label>Envase cerrado</label><input type="checkbox" aria-label="Envase cerrado" :checked="cfg.closed" @change="set({closed:$event.target.checked})" /></div>
      <div v-if="cfg.vessel==='bottle'" class="field"><label>Radio de la boca (m)</label><NumberField :model-value="cfg.mouthRadius??Math.min(cfg.size[0],cfg.size[2])*0.19" :min="0.001" :max="Math.min(cfg.size[0],cfg.size[2])/2" :step="0.001" @update:model-value="set({mouthRadius:$event})" /></div>
      <div class="field"><label>Calidad del líquido</label><select :value="cfg.quality" aria-label="Calidad del líquido" @change="set({quality:$event.target.value})"><option value="low">Ligera</option><option value="balanced">Equilibrada</option><option value="high">Alta</option></select></div>
      <div class="field"><label>Mostrar envase</label><input type="checkbox" aria-label="Mostrar envase de referencia" :checked="cfg.showVessel" @change="set({showVessel:$event.target.checked})" /></div>
      <p class="hint lf-help">Capacidad: {{(capacity*1000).toFixed(3)}} L. El líquido responde al movimiento y a la inclinación. Puedes añadir tu modelo como hijo y ocultar el envase de referencia.</p>
    </div>
  </section>
</template>
