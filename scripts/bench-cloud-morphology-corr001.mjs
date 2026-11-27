// Comparación aislada y orientativa, nunca FPS: ejecutar igual sobre base S01-G001 y CORR-001.
import { performance } from 'node:perf_hooks'
import { CloudField } from '../src/engine/runtime/world/cloudfield.js'
import { PRESETS } from '../src/engine/runtime/world/weather.js'
const p=PRESETS.partly
const forcing={coverage:p.coverage,density:p.density/2.1,humidity:p.humidity,storm:0,rain:0,altitude:p.altitude}
const times=[];let sum=0, bytes=0, prims=0
for(let j=0;j<9;j++){
  const f=new CloudField({seed:42,sizeMul:2})
  f.update(forcing,[0,0],0);f.prepare(0,0)
  const a=performance.now()
  f.bake()
  const b=performance.now()
  f.map.volume.advance(0,forcing,[0,0])
  const c=performance.now()
  if(j>=3) times.push({bake:b-a,init:c-b})
  bytes=f.map.volume.data.byteLength;prims=f.map.prims
  sum+=f.map.slabThick
}
const median=k=>+times.map(x=>x[k]).sort((a,b)=>a-b)[times.length>>1].toFixed(3)
console.log(JSON.stringify({type:'CPU no GPU',samples:times.length,primitives:prims,gpuVolumeBytes:bytes,bakeMedianMs:median('bake'),initializeMedianMs:median('init'),checksum:+sum.toFixed(1)}))
