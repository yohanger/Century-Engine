// Pruebas puras de máscaras: ejecutables con Node sin WebGL, Vue ni Three.js.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { normalizeRoadPaint, rasterRoadPaint, ROAD_PAINT_RES, ROAD_PAINT_MAX_STROKES } from '../src/engine/runtime/geometry/road-paint.js'
const base = { version:1, asphalt:[{id:'dirt',materialId:'m1',strokes:[{points:[[.5,.5]],radius:1,hardness:.5,opacity:1}]}],side:[] }
const opts = {width:8,length:24,closed:false}
const px = (d,x,y,ch=0,w=ROAD_PAINT_RES[0]) => d[(y*w+x)*4+ch]
test('un proyecto antiguo no recibe capas nuevas ni cambia su geometría',()=> {
  assert.deepEqual(normalizeRoadPaint(),{version:1,asphalt:[],side:[]})
})
test('los datos permanecen inmutables tras normalización',()=> {
  const x=JSON.stringify(base); normalizeRoadPaint(base); assert.equal(JSON.stringify(base),x)
})
test('máscara al centro y fondo transparente',()=> {
  const d=rasterRoadPaint(base,'asphalt',opts)
  assert.equal(d.length,ROAD_PAINT_RES[0]*ROAD_PAINT_RES[1]*4)
  assert.ok(px(d,128,256)>100); assert.equal(px(d,0,0),0)
})
test('capas RGB independientes',()=>{
  const p=structuredClone(base); p.asphalt.push({id:'wet',materialId:'m2',strokes:[{points:[[.25,.25]],radius:1,opacity:1,hardness:1}]})
  const d=rasterRoadPaint(p,'asphalt',opts)
  assert.ok(px(d,128,256,0)>0);assert.ok(px(d,64,128,1)>0)
  assert.equal(px(d,64,128,2),0)
})
test('borrador retira pigmento de una sola capa',()=>{
  const p=structuredClone(base)
  p.asphalt[0].strokes.push({points:[[.5,.5]],radius:1,hardness:1,opacity:1,erase:true})
  const d=rasterRoadPaint(p,'asphalt',opts); assert.equal(px(d,128,256),0)
})
test('sin material no rasteriza por accidente',()=>{
 const p=structuredClone(base);p.asphalt[0].materialId='';assert.equal(px(rasterRoadPaint(p,'asphalt',opts),128,256),0)
})
test('capas ocultas no producen máscara',()=>{
 const p=structuredClone(base);p.asphalt[0].visible=false;assert.equal(px(rasterRoadPaint(p,'asphalt',opts),128,256),0)
})
test('repetición del material no afecta la pintura',()=>{
 const p=structuredClone(base); const a=rasterRoadPaint(p,'asphalt',opts);p.asphalt[0].tile=99
 assert.deepEqual(rasterRoadPaint(p,'asphalt',opts),a)
})
test('anchura de brocha en metros, no solo píxeles',()=>{
 const a=rasterRoadPaint(base,'asphalt',{width:4,length:24});const b=rasterRoadPaint(base,'asphalt',{width:16,length:24})
 assert.ok(px(a,155,256)>px(b,155,256))
})
test('los trazos discontinuos se interpolan sin huecos',()=>{
 const p=structuredClone(base);p.asphalt[0].strokes[0].points=[[.2,.5],[.8,.5]]
 const d=rasterRoadPaint(p,'asphalt',opts);assert.ok(px(d,128,256)>100)
})
test('circuito cerrado: la máscara cubre ambos extremos longitudinales',()=>{
 const p=structuredClone(base);p.asphalt[0].strokes[0].points=[[.5,.002]]
 const d=rasterRoadPaint(p,'asphalt',{...opts,closed:true})
 assert.ok(px(d,128,1)>0);assert.ok(px(d,128,ROAD_PAINT_RES[1]-2)>0)
})
test('pintura de aceras separada de calzada',()=>{
 const p=structuredClone(base);assert.equal(px(rasterRoadPaint(p,'side',opts),128,256),0)
})
test('opacidad parcial nunca supera 255',()=>{
 const p=structuredClone(base);p.asphalt[0].strokes[0].opacity=.3
 for(let k=0;k<12;k++)p.asphalt[0].strokes.push(structuredClone(p.asphalt[0].strokes[0]))
 const d=rasterRoadPaint(p,'asphalt',opts);assert.ok(px(d,128,256)<=255 && px(d,128,256)>.3*255)
})
test('se acota el número de capas y trazos de un archivo externo',()=>{
 const p={asphalt:Array.from({length:10},(_,i)=>({id:`${i}`,materialId:'m1',strokes:Array.from({length:ROAD_PAINT_MAX_STROKES+5},()=>({points:[[.5,.5]]}))}))}
 const n=normalizeRoadPaint(p);assert.equal(n.asphalt.length,3);assert.equal(n.asphalt[0].strokes.length,ROAD_PAINT_MAX_STROKES)
})
test('se acotan parámetros inválidos',()=>{
 const n=normalizeRoadPaint({asphalt:[{id:'x',materialId:'m',tile:-1,strokes:[{points:[[-1,99]],radius:999,hardness:-1,opacity:20}]}]})
 assert.deepEqual(n.asphalt[0].strokes[0].points,[[0,1]]);assert.equal(n.asphalt[0].strokes[0].radius,8)
})
test('las UV de pintura se generan independientemente de la UV del material',()=>{
 const s=fs.readFileSync(new URL('../src/engine/runtime/geometry/road.js',import.meta.url),'utf8')
 assert.match(s,/paintUvs/);assert.match(s,/f\.s \/ L/);assert.match(s,/lfPaintUV|paintUv/)
})
test('el Inspector ofrece capas y controles de pincel reales',()=>{
 const s=fs.readFileSync(new URL('../src/components/RoadPanel.vue',import.meta.url),'utf8')
 assert.match(s,/paintMode/);assert.match(s,/@click="addPaintLayer"/);assert.match(s,/Pincel/)
})
test('el puntero no toca las líneas viales y confirma una sola entrada',()=>{
 const s=fs.readFileSync(new URL('../src/core/editor/roads.js',import.meta.url),'utf8')
 assert.match(s,/\['asphalt', 'side'\]/);assert.match(s,/commit\('Pintar material de carretera'\)/)
})
test('editor y Player comparten el renderizador de carretera',()=>{
 const s=fs.readFileSync(new URL('../src/engine/runtime/nodes/road.js',import.meta.url),'utf8')
 assert.match(s,/updateRoadPaint\(/); assert.match(s,/lfPaintUV/)
})
