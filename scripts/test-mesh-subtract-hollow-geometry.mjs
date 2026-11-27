import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { meshSubtractSourcePoly, meshSubtractSourceSignature, remapMeshSubtractSourceIds, resolveMeshSubtractSource } from '../src/engine/runtime/mesh/mesh-subtract-source.js'
import { cube, stairs, plane } from '../src/engine/runtime/mesh/generators.js'
import { polyBuffers } from '../src/engine/runtime/mesh/buffers.js'
import { nearestMeshParent } from '../src/engine/runtime/nodes/hierarchy.js'
import { source, csg, THREE as ThreeFixture, Geo, Attr, Matrix4, box, nodeFor, volume } from './fixtures/csg-fixture.mjs'

const toGeo = poly => {
  const b = polyBuffers(poly)
  const g = new Geo()
  g.setAttribute('position', new Attr(b.positions, 3))
  g.setAttribute('normal', new Attr(b.normals, 3))
  g.setAttribute('uv', new Attr(b.uvs, 2))
  g.index = { count:b.indices.length, getX(i) { return b.indices[i] } }
  g.applyMatrix4 = function (m) {
    const p = this.attributes.position
    for(let i=0;i<p.count;i++) for(let k=0;k<3;k++) p.array[i*3+k] = p.array[i*3+k]*m.s[k]+m.t[k]
    this.computeBoundingBox()
    return this
  }
  return g
}
const sourceGeometry = mesh => toGeo(mesh)
const THREE = { ...ThreeFixture, EdgesGeometry: class {
  constructor(geo){ this.base=geo }
  dispose(){ this.disposed=true }
}}
const raw = source('src/engine/runtime/scene/brushes.js')
  .replace(/^import .*$/gm,'').replace('export const brushesMethods =','const brushesMethods =')
const brush = new Function('THREE','nodeEffectiveActive','carveGeometries','cutterTouches','isCutter','applyShadowMats',
    'primitiveMetricAttributes','unitGeometry','stairsGeometry','geometryOf','subtractPolyOf','meshSubtractSourcePoly','meshSubtractSourceSignature','resolveMeshSubtractSource','nearestMeshParent',
    raw+'\nreturn brushesMethods')(
    THREE,()=>true,csg.carveGeometries,csg.cutterTouches,csg.isCutter,()=>{},()=>({uv:new Float32Array(),size:new Float32Array()}),
    ()=>box([1,1,1]),()=>box([1,1,1]),sourceGeometry,()=>null,meshSubtractSourcePoly,meshSubtractSourceSignature,resolveMeshSubtractSource,nearestMeshParent)

function fixture(receiverGeometry=box([1,1,1]), shape=cube(2,2,2).toJSON()) {
  const receiver={id:'stairs',type:'primitive',kind:'stairs',position:[0,0,0],scale:[4,3,5],props:{steps:8},visible:true}
  const mesh={id:'source',type:'mesh',kind:'cube',position:[0,-0.45,0.3],scale:[1,1,1],props:{mesh:shape},visible:false}
  const cut={id:'subtract-mesh',type:'meshSubtract',kind:'mesh',position:[0,0,0],scale:[1,1,1],props:{sourceId:mesh.id},visible:true}
  const r=nodeFor(receiverGeometry),m=nodeFor(toGeo(cube(1,1,1))),c=nodeFor(box([1,1,1]))
  c.userData.fill=c.m
  c.userData.edges={geometry:{dispose(){}},visible:true,material:{color:{set(){}}}}
  c.userData.subtractOwnedGeometry=null
  c.userData.fill.geometry=box([1,1,1])
  const objects=[receiver,mesh,cut]
  const context={host:{project:{objects,meshes:[]}},nodes:new Map([['stairs',r],['source',m],['subtract-mesh',c]]),
    vp:{requestRender(){},invalidateShadows(){}},worldMatrix(id){return new Matrix4(objects.find(o=>o.id===id)?.position || [0,0,0])},_brTimer:0}
  Object.assign(context,brush)
  return {receiver,mesh,cut,r,c,context}
}

test('MS-01 · la malla triangular cerrada sirve como volumen, la abierta se rechaza',()=>{
  const solid=meshSubtractSourcePoly({type:'mesh',props:{mesh:cube(2,2,2).toJSON()}})
  const open=meshSubtractSourcePoly({type:'mesh',props:{mesh:plane(2,2).toJSON()}})
  assert.ok(solid.poly)
  assert.equal(solid.error,'')
  assert.equal(open.poly,null)
  assert.match(open.error,/cerrado|volumen/i)
})

test('MS-02 · una escalera puede ser fuente geométrica sólida',()=>{
  const s=meshSubtractSourcePoly({type:'primitive',kind:'stairs',scale:[4,3,5],props:{steps:8,turn:0}})
  assert.equal(s.error,'')
  assert.ok(s.poly.f.length>8)
})

test('MS-03 · crea un hueco real y superficies interiores en el receptor',()=>{
  const {context,r}=fixture()
  const changed=context.refreshBrushes()
  assert.ok(changed.includes('stairs'))
  assert.ok(r.userData.carvedPolys?.length)
  assert.ok(r.userData.cutMeshes?.length)
  assert.ok(r.userData.cutMeshes[0].geometry.attributes.position.count>0)
  assert.equal(r.userData.cutMeshes[0].material,r.m.material)
})

test('MS-04 · retirar Mesh Substract restaura la geometría original',()=>{
  const {context,r}=fixture(), original=r.m.geometry
  context.refreshBrushes()
  context.host.project.objects.pop()
  context.refreshBrushes()
  assert.equal(r.m.geometry,original)
  assert.equal(r.userData.cutMeshes,null)
})

test('MS-05 · mover la malla fuente cambia el volumen recortado sin duplicar BSP',()=>{
  const {context,r,mesh}=fixture()
  context.refreshBrushes()
  const first=volume(r.userData.carvedPolys)
  mesh.position=[2.9,0.5,0]
  context.refreshBrushes()
  assert.notEqual(volume(r.userData.carvedPolys),first)
})

test('MS-06 · malla fuente inválida cancela el recorte y notifica al nodo',()=>{
  const {context,r,c,mesh}=fixture()
  context.refreshBrushes()
  mesh.props.mesh=plane(2,2).toJSON()
  context.refreshBrushes()
  assert.equal(c.userData.fill.visible,false)
  assert.match(c.userData.meshSubtractError,/cerrado|volumen/i)
  assert.equal(r.userData.carvedPolys,null)
})

test('MS-07 · referencia se remapea solo si la fuente también es duplicada',()=>{
  const nodes=[{type:'meshSubtract',props:{sourceId:'old'}},{type:'meshSubtract',props:{sourceId:'external'}}]
  remapMeshSubtractSourceIds(nodes,new Map([['old','new']]))
  assert.equal(nodes[0].props.sourceId,'new')
  assert.equal(nodes[1].props.sourceId,'external')
})

test('MS-08 · el cambio de revisión de malla compartida modifica su firma',()=>{
  const source={id:'source',type:'mesh',props:{meshRef:'asset'}}
  assert.notEqual(meshSubtractSourceSignature(source,[{id:'asset',mesh:{rev:1}}]),meshSubtractSourceSignature(source,[{id:'asset',mesh:{rev:2}}]))
})

test('MS-09 · el CSG original sigue reconociendo los cortadores clásicos',()=>{
  assert.equal(csg.isCutter({type:'subtract'}),true)
  assert.equal(csg.isCutter({type:'meshSubtract'}),true)
  assert.equal(csg.isCutter({type:'mesh'}),false)
})

test('MS-10 · malla de origen no se sustrae a sí misma',()=>{
  const {context,mesh}=fixture()
  const meshReceiver=nodeFor(box([1,1,1]))
  context.nodes.set(mesh.id,meshReceiver)
  context.refreshBrushes()
  assert.equal(meshReceiver.userData.carvedPolys ?? null,null)
})

test('MS-12 · resta en una escalera real sin eliminar sus peldaños exteriores',()=>{
  const stair=stairs(1,1,1,8,0,{})
  const {context,r,mesh}=fixture(toGeo(stair), cube(0.65,0.65,0.65).toJSON())
  mesh.position=[0,-0.22,0.06]
  const originalVolume=volume(stair.f.map(face=>({pts:face.map(i=>stair.v[i])})))
  context.refreshBrushes()
  const carved=r.userData.carvedPolys
  assert.ok(carved?.length)
  const remainingVolume=volume(carved)
  assert.ok(remainingVolume<originalVolume,`${remainingVolume} vs ${originalVolume}`)
  assert.ok(remainingVolume>0,`La escalera desapareció: ${remainingVolume}`)
  assert.ok(r.userData.cutMeshes?.length,'No se generaron paredes interiores')
})

test('MS-13 · puede usar una TriMeshShape3D válida como referencia de malla',()=>{
  const parent={id:'body',type:'staticbody3d',parentId:null}
  const mesh={id:'mesh-id',type:'mesh',parentId:'body',props:{mesh:cube().toJSON()}}
  const shape={id:'shape-id',type:'collisionshape3d',parentId:'body',props:{shape:{type:'TriMeshShape3D',sourceId:'mesh-id'}}}
  assert.equal(resolveMeshSubtractSource(shape,[parent,mesh,shape]),mesh)
  shape.props.shape.sourceId='missing'
  assert.equal(resolveMeshSubtractSource(shape,[parent,mesh,shape]),null)
})

test('MS-14 · dos nodos Mesh Substract comparten fuente sin duplicar su geometría persistida',()=>{
  const {context,r,c,cut}=fixture()
  context.refreshBrushes()
  const first=volume(r.userData.carvedPolys)
  const other={...cut,id:'cut-2',position:[2.5,0,0],props:{...cut.props}}
  const n=nodeFor(box([1,1,1]))
  n.userData.fill=n.m
  n.userData.edges={geometry:{dispose(){}},material:{color:{set(){}}}}
  context.host.project.objects.push(other)
  context.nodes.set(other.id,n)
  context.refreshBrushes()
  const second=volume(r.userData.carvedPolys)
  assert.ok(second<first,`Volumen con dos cortes: ${second}; con uno: ${first}`)
  assert.equal(other.props.sourceId,cut.props.sourceId)
})

test('MS-11 · integración declarada en catálogo, Inspector, escenas y colisiones',()=>{
  for (const file of [
    'src/engine/runtime/nodes/index.js','src/components/Inspector.vue','src/engine/runtime/scene/objects.js',
    'src/engine/runtime/events/play-timeline.js','src/engine/runtime/scene/instances.js',
  ]) assert.match(source(file),/meshSubtract|mesh-subtract/,file)
  assert.match(source('src/engine/runtime/physics/node-bodies.js'),/syncCarvedSources/)
})
