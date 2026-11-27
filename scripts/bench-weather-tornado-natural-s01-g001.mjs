// Diagnóstico CPU sin navegador: mismo escenario, misma semilla y misma cámara.
// No mide GPU, FPS renderizados ni calidad visual.
import { performance } from 'node:perf_hooks'
import { World } from '../src/engine/runtime/world/world.js'
const sample = (active, model) => {
  const w=new World(44).configure({weather:{on:true,preset:'storm',cloudModel:model,cloudSeed:163,
    tornadoEnabled:true,tornadoMode:'script',tornadoDevelopmentSeconds:8,tornadoOrganizationSeconds:8}})
  w.setObserver(0,2,0)
  if(active) w.startTornado({weatherTransition:0})
  const samples=[]
  for(let i=0;i<120;i++) {
    const t0=performance.now()
    if(active) w.tornadoStep(1/30)
    w.update(1/30);w.frame()
    if(i>=20) samples.push(performance.now()-t0)
  }
  samples.sort((a,b)=>a-b)
  return {p50:samples[Math.floor(samples.length/2)],p95:samples[Math.floor(samples.length*.95)],mapVersion:w.field?.map.version??null}
}
for(const model of ['classic','cells']) for(const active of [false,true]) {
  const s=sample(active,model)
  console.log(`${model} · ${active?'organización S01':'sin tornado'}: CPU p50=${s.p50.toFixed(3)}ms p95=${s.p95.toFixed(3)}ms · mapa=${s.mapVersion??'no aplica'}`)
}
console.log('Medición indicativa local Node: no es tiempo GPU ni velocidad de fotogramas del Editor.')
