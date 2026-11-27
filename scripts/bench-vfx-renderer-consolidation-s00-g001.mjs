// Medición CPU aislada de la simulación genérica: NO compara renderers GPU ni FPS.
import { performance } from 'node:perf_hooks'
import { VfxSimulation } from '../src/engine/runtime/vfx/simulation.js'
import { newVfxResource, validateVfxResource } from '../src/engine/runtime/vfx/resource.js'
const sizes=[64,256,1024]
const median=values=>{const s=[...values].sort((a,b)=>a-b);return s[(s.length-1)>>1]}
console.log('Auditoría VFX S00 · CPU aislada · 600 pasos 1/60; calentamiento 120; NO GPU/FPS')
for(const size of sizes){
  const raw=newVfxResource('audit-vfx-'+size,'Audit.vfx')
  const resource=validateVfxResource({...raw,emission:{...raw.emission,mode:'continuous',rate:size*2,capacity:size},birth:{...raw.birth,lifetime:[9,9]}})
  const samples=[]
  for(let run=0;run<5;run++){
    const sim=new VfxSimulation(resource,{seed:331})
    for(let i=0;i<120;i++)sim.step()
    const start=performance.now()
    for(let i=0;i<600;i++)sim.step()
    samples.push({ms:performance.now()-start,alive:sim.count,dropped:sim.droppedBirths})
  }
  const m=median(samples.map(s=>s.ms))
  const s=samples[0]
  console.log(`capacidad=${size} · mediana=${m.toFixed(3)}ms por 600 pasos · vivas=${s.alive} · nacimientos omitidos=${s.dropped}`)
}
