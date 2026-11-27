// LF-CSG-SUBTRACT-NODE-CORR-G001: nodo propio, atributos BSP y material del receptor.
import test from 'node:test'
import assert from 'node:assert/strict'
import { primitiveMetricAttributes } from '../src/engine/runtime/mesh/blockout-metrics.js'
import { source, box, THREE, Attr, csg, scene, volume, Matrix4 } from './fixtures/csg-fixture.mjs'

function decoratedBox(size=[2,2,2]) {
  const geo = box(size), n = geo.attributes.position.count
  const arr = (length, fn) => Array.from({length}, (_,i)=>fn(i))
  geo.setAttribute('normal', new Attr(arr(n*3,i=>i%3===0?1:0),3))
  geo.setAttribute('uv', new Attr(arr(n*2,i=>(i%2?0.8:0.4)),2))
  geo.setAttribute('lfBlockUV',new Attr(arr(n*2,i=>i%2?0.7:0.2),2))
  geo.setAttribute('lfBlockSize',new Attr(arr(n*2,i=>i%2?2:3),2))
  geo.setAttribute('lfPaintUV',new Attr(arr(n*2,i=>i%2?0.6:0.3),2))
  geo.setAttribute('lfColor',new Attr(arr(n*3,i=>0.1+(i%3)*0.2),3))
  geo.setAttribute('lfWeights0',new Attr(arr(n*4,i=>i%4===0?1:0),4))
  geo.setAttribute('lfWeights1',new Attr(arr(n*4,i=>0),4))
  return geo
}
function receiverWithAttributes() {
  const t=scene('mesh'), sourceGeo=decoratedBox([1,1,1])
  t.r.m.geometry=sourceGeo
  t.r.m.material={id:'wall-original',disposed:false,dispose(){this.disposed=true}}
  t.cutter.color='#ff0000'; t.receiver.color='#00ff00'
  return {...t,sourceGeo}
}
const allFinite=(geo)=>Object.values(geo.attributes).every(a=>Array.from(a.array).every(Number.isFinite))

test('SN-01 Substract es un tipo propio y una primitiva con csg antiguo no corta',()=>{
  assert.equal(csg.isCutter({type:'subtract',props:{}}),true)
  assert.equal(csg.isCutter({type:'primitive',props:{csg:'subtract'}}),false)
  assert.equal(csg.isCutter({type:'mesh',props:{csg:'subtract'}}),false)
})
test('SN-02 BSP conserva atributos extra en las caras del receptor',()=>{
  const sourceGeo=decoratedBox(), {geos}=csg.carveGeometries(sourceGeo,[{geometry:box([1,1,1]),matrix:new Matrix4()}])
  const main=geos.get(0);assert.ok(main)
  for(const key of ['lfBlockUV','lfBlockSize','lfPaintUV','lfColor','lfWeights0','lfWeights1']) {
    assert.ok(main.attributes[key],key)
    assert.equal(main.attributes[key].count,main.attributes.position.count,key)
  }
  assert.ok(allFinite(main))
})
test('SN-03 Corte interpola UV y Blockout al dividir un triángulo',()=>{
  const sourceGeo=decoratedBox(), {geos}=csg.carveGeometries(sourceGeo,[{geometry:box([.8,.8,.8]),matrix:new Matrix4([.8,0,0])}])
  const main=geos.get(0)
  assert.ok(main.attributes.lfBlockUV.array.some(v=>v!==0))
  assert.ok([...main.attributes.lfBlockUV.array].every(v=>v>=.19 && v<=.71))
  assert.ok(allFinite(main))
})
test('SN-04 El material del receptor se comparte con caras interiores',()=>{
  const {context,r,sourceGeo}=receiverWithAttributes()
  context.refreshBrushes()
  assert.ok(r.userData.cutMeshes?.length)
  for(const wall of r.userData.cutMeshes)assert.equal(wall.material,r.m.material)
  assert.equal(r.m.material.disposed,false)
  assert.equal(r.userData.baseGeo,sourceGeo)
})
test('SN-05 La malla recortada mantiene Blockout, Paint UV y pesos',()=>{
  const {context,r}=receiverWithAttributes();context.refreshBrushes()
  const main=r.m.geometry
  for(const key of ['lfBlockUV','lfBlockSize','lfPaintUV','lfWeights0','lfWeights1'])assert.equal(main.attributes[key].count,main.attributes.position.count)
  assert.ok(allFinite(main))
})
test('SN-06 Las paredes nuevas reconstruyen atributos métricos del receptor',()=>{
  const {context,r}=receiverWithAttributes();context.refreshBrushes()
  const wall=r.userData.cutMeshes[0].geometry
  for(const key of ['lfBlockUV','lfBlockSize','lfPaintUV','lfColor','lfWeights0','lfWeights1']) assert.equal(wall.attributes[key].count,wall.attributes.position.count,key)
  assert.ok(wall.attributes.lfBlockSize.array.some(v=>v>0))
  assert.ok(allFinite(wall))
})
test('SN-07 Al eliminar Substract se restaura la misma geometría original',()=>{
  const {context,r,sourceGeo}=receiverWithAttributes();context.refreshBrushes()
  const carved=r.m.geometry
  context.host.project.objects.pop();context.refreshBrushes()
  assert.equal(r.m.geometry,sourceGeo)
  assert.equal(carved.disposed,true)
  assert.equal(r.userData.cutMeshes,null)
})
test('SN-08 Eliminar un corte no dispone el material del receptor',()=>{
  const {context,r}=receiverWithAttributes();context.refreshBrushes()
  context.host.project.objects.pop();context.refreshBrushes()
  assert.equal(r.m.material.disposed,false)
})
test('SN-09 Mover Substract vuelve a recortar la geometría sin sustituir material',()=>{
  const {context,r,cutter}=receiverWithAttributes();context.refreshBrushes()
  const first=volume(r.userData.carvedPolys); const mat=r.m.material
  cutter.position=[.1,0,0];context.refreshBrushes()
  assert.notEqual(volume(r.userData.carvedPolys),first)
  assert.equal(r.m.material,mat)
})
test('SN-10 Dos Substract producen cortes independientes',()=>{
  const {context,r,cutter}=receiverWithAttributes();context.refreshBrushes()
  const first=volume(r.userData.carvedPolys)
  context.host.project.objects.push({...cutter,id:'cut2',position:[-.8,0,0]})
  context.refreshBrushes()
  assert.ok(volume(r.userData.carvedPolys)<first)
})
test('SN-11 Recibe cortes=false excluye el receptor',()=>{
  const {context,r,receiver,sourceGeo}=receiverWithAttributes()
  receiver.props.carve=false;context.refreshBrushes()
  assert.equal(r.m.geometry,sourceGeo)
})
test('SN-12 Registry registra Substract y no añade el atributo a primitive',()=>{
  assert.match(source('src/engine/runtime/nodes/index.js'),/import '.\/subtract\.js'/)
  assert.match(source('src/engine/runtime/nodes/subtract.js'),/type: 'subtract'/)
  assert.doesNotMatch(source('src/engine/runtime/nodes/primitive.js'),/isCutter\(obj\)/)
})
test('SN-13 Catálogo solo crea el nodo Substract separado',()=>{
  const commands=source('src/core/commands.js')
  assert.doesNotMatch(commands,/startPlace\('primitive', kind, \{ csg/)
  assert.doesNotMatch(commands,/props: \{ csg: 'subtract'/)
  assert.match(source('src/engine/runtime/nodes/subtract.js'),/category: 'Herramientas de modelado'/)
})
test('SN-14 Inspector ofrece forma y no Brush Sustractivo en primitivas',()=>{
  const ui=source('src/components/Inspector.vue')
  assert.match(ui,/obj\.type === 'subtract'/)
  assert.match(ui,/<option value="cylinder">Cilindro<\/option>/)
  assert.doesNotMatch(ui,/obj\.props\.csg === 'subtract'/)
})
test('SN-15 SyncObject actualiza recortes al editar transform de Substract',()=>{
  assert.match(source('src/engine/runtime/scene/objects.js'),/obj\.type === 'subtract' \|\| obj\.type === 'meshSubtract'\) this\._scheduleBrushes/)
})
test('SN-16 Player omite el volumen Substract y conserva colisiones recortadas',()=>{
  const p=source('src/engine/runtime/events/play.js')
  assert.match(p,/isCutter\(o\)/)
  assert.match(p,/ed\.refreshBrushes\?\.\(\)/)
  assert.match(source('src/engine/runtime/events/play-level.js'),/this\.phys\?\.addMesh\(m\)/)
})
test('SN-17 Conversión de escenas existentes cambia el tipo y elimina csg',()=>{
  const s=source('src/core/project.js');const body=s.slice(s.indexOf('export function migrateScene('),s.indexOf('export function createSceneContent(')).replace('export function migrateScene','function migrateScene')
  const migrate=new Function('normalizeWorld','makeObject','uid',body+'\nreturn migrateScene')((o)=>o,()=>({}),()=>1)
  const scene={objects:[{id:'a',type:'primitive',kind:'box',collision:true,props:{csg:'subtract'}},{id:'b',type:'primitive',kind:'box',props:{}}],environment:{}}
  migrate(scene)
  assert.equal(scene.objects[0].type,'subtract');assert.equal(scene.objects[0].collision,false)
  assert.equal('csg' in scene.objects[0].props,false)
  assert.equal(scene.objects[1].type,'primitive')
})
test('SN-18 No se introduce un segundo motor booleano ni dependencias CSG nuevas',()=>{
  const brushes=source('src/engine/runtime/scene/brushes.js')
  assert.match(brushes,/import \{ carveGeometries, cutterTouches, isCutter \}/)
  assert.match(brushes,/carveGeometries\(ud\.baseGeo, hits\)/)
})
test('SN-19 La forma por defecto es caja y el nodo carece de colisión propia',()=>{
  const code=source('src/engine/runtime/nodes/subtract.js')
  assert.match(code,/kind: 'box'/)
  assert.match(code,/collision: false/)
  assert.match(code,/editorGizmos = \[visual\]/)
})
test('SN-20 El historial incluye los tipos de nodo mediante datos de objeto',()=>{
  const history=source('src/core/state/history.js')
  assert.match(history,/objects/)
  assert.match(source('src/engine/runtime/nodes/index.js'),/getDef\(type\)\?\.create\(kind\)/)
})
