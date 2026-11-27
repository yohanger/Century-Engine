import test from 'node:test'
import assert from 'node:assert/strict'
import { DOCK_NATIVE_RELEASE_PX, shouldDetachDockDrag } from '../src/core/editor/native-dock.js'
import { findDetachPoints, outsideTabStrip } from './fixtures/editor/dock-detach-points.mjs'
const source={x:719.640625,y:78}, origin={left:380,right:1350,top:65.5,bottom:90.5}
const fixture={source,origin,width:1360,height:768,isClear:p=>p.y<64}
test('El punto del log anterior no alcanza el umbral de salida de la franja',()=>{
 const old={x:652,y:48.5};assert.equal(outsideTabStrip(origin,old),17);assert.equal(shouldDetachDockDrag(source,old,false,17),false)
})
test('La búsqueda utiliza rectángulo y umbral de producción sin depender de la resolución',()=>{
 for(const shift of [0,20,100]){
  const box={...origin,top:origin.top+shift,bottom:origin.bottom+shift};const start={...source,y:source.y+shift}
  const plan=findDetachPoints({...fixture,origin:box,source:start,isClear:p=>p.y<64+shift});assert.ok(plan)
  assert.ok(plan.distances[0]<DOCK_NATIVE_RELEASE_PX);assert.ok(plan.distances[1]>=DOCK_NATIVE_RELEASE_PX);assert.ok(plan.distances[2]>DOCK_NATIVE_RELEASE_PX)
  assert.equal(shouldDetachDockDrag(start,plan.before,false,plan.distances[0]),false)
  assert.equal(shouldDetachDockDrag(start,plan.crossing,false,plan.distances[1]),true)
  assert.equal(shouldDetachDockDrag(start,plan.beyond,true,plan.distances[2]),false)
 }
})
test('Umbral exacto con coordenadas enteras: antes, límite y después',()=>{
 const plan=findDetachPoints({...fixture,origin:{...origin,top:64},isClear:p=>p.y<64});assert.deepEqual(plan.distances,[22,24,28]);assert.equal(shouldDetachDockDrag(source,plan.crossing,false,24),true)
})
test('Busca otro borde si un destino válido ocupa el primero y no inventa un punto si todos están ocupados',()=>{
 const plan=findDetachPoints({...fixture,isClear:p=>p.y>origin.bottom});assert.ok(plan);assert.ok(plan.crossing.y>origin.bottom)
 assert.equal(findDetachPoints({...fixture,isClear:()=>false}),null)
})
test('No selecciona coordenadas fuera del viewport ni un recorrido que no alcance el inicio de gesto',()=>{
 assert.equal(findDetachPoints({...fixture,width:20,height:20,isClear:()=>true}),null)
})
