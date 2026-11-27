// A/B geométrico de S01-G001 vs CORR-001: mismo código, misma semilla, mismo preset.
// No sustituye las comparaciones visuales ni mediciones de rendimiento reales.
import { CloudField } from '../src/engine/runtime/world/cloudfield.js'
import { PRESETS } from '../src/engine/runtime/world/weather.js'

const names=['partly','cloudy','overcast','storm']
const results={seed:42,cloudSize:2,presets:{},textureBytes:0,depth:0}
for(const name of names){
  const p=PRESETS[name], f=new CloudField({seed:42,sizeMul:2})
  const forcing={coverage:p.coverage,density:p.density/2.1,humidity:p.humidity,
    storm:p.bolts/7,rain:45*p.rain,altitude:p.altitude}
  f.update(forcing,[0,0],0);f.prepare(0,0)
  const lobes=[],spans=[]
  for(const cell of f.cells){
    if(!cell.active||cell.condensate<=.03)continue
    const count=f.primitives(cell,lobes)
    let bottom=Infinity,top=-Infinity
    for(let i=0;i<count;i++){
      bottom=Math.min(bottom,lobes[i].y-lobes[i].ry)
      top=Math.max(top,lobes[i].y+lobes[i].ry)
    }
    spans.push(top-bottom)
  }
  spans.sort((a,b)=>a-b)
  const map=f.bake(),v=map.volume
  v.advance(0,forcing,[0,0])
  let occupied=0
  for(let y=0;y<v.depth;y++){
    let count=0
    for(let k=y*v.N*v.N;k<(y+1)*v.N*v.N;k++)if(v.data[k*2+1]>60)count++
    if(count>5)occupied++
  }
  results.presets[name]={clouds:spans.length,medianVisibleSpanM:+(spans[Math.floor(spans.length/2)]??0).toFixed(1),
    slabThicknessM:map.slabThick,volumeHeightM:v.height,activeVerticalSlices:occupied}
  results.textureBytes=v.data.byteLength;results.depth=v.depth
}
console.log(JSON.stringify(results,null,2))
