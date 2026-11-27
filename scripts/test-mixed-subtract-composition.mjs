import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { cube, stairs } from '../src/engine/runtime/mesh/generators.js'
import { polyBuffers } from '../src/engine/runtime/mesh/buffers.js'
import { meshSubtractSourcePoly, meshSubtractSourceSignature, resolveMeshSubtractSource } from '../src/engine/runtime/mesh/mesh-subtract-source.js'
import { nearestMeshParent } from '../src/engine/runtime/nodes/hierarchy.js'
import { source, csg, THREE as fakeThree, Geo, Attr, Matrix4, box, nodeFor, volume } from './fixtures/csg-fixture.mjs'

function toGeo(poly) {
  const buffers = polyBuffers(poly)
  const geo = new Geo()
  geo.setAttribute('position', new Attr(buffers.positions, 3))
  geo.setAttribute('normal', new Attr(buffers.normals, 3))
  geo.setAttribute('uv', new Attr(buffers.uvs, 2))
  geo.index = { count: buffers.indices.length, getX(i) { return buffers.indices[i] } }
  geo.applyMatrix4 = function (m) {
    const position = this.attributes.position
    for (let i = 0; i < position.count; i++) for (let k = 0; k < 3; k++)
      position.array[i * 3 + k] = position.array[i * 3 + k] * m.s[k] + m.t[k]
    this.computeBoundingBox()
    return this
  }
  return geo
}

const THREE = { ...fakeThree, EdgesGeometry: class {
  constructor(geo) { this.base=geo }
  dispose() { this.disposed=true }
} }
const code = source('src/engine/runtime/scene/brushes.js')
  .replace(/^import .*$/gm, '').replace('export const brushesMethods =', 'const brushesMethods =')
const brushesMethods = new Function(
  'THREE','nodeEffectiveActive','carveGeometries','cutterTouches','isCutter','applyShadowMats',
  'primitiveMetricAttributes','unitGeometry','stairsGeometry','geometryOf','subtractPolyOf',
  'meshSubtractSourcePoly','meshSubtractSourceSignature','resolveMeshSubtractSource','nearestMeshParent',
  `${code}\nreturn brushesMethods`,
)(THREE, (objects,o) => o.active !== false, csg.carveGeometries, csg.cutterTouches, csg.isCutter,
  ()=>{},()=>({uv:new Float32Array(),size:new Float32Array()}),()=>box([1,1,1]),()=>box([1,1,1]),
  toGeo,()=>null,meshSubtractSourcePoly,meshSubtractSourceSignature,resolveMeshSubtractSource,nearestMeshParent)

function setup(order=['stairs','source','hollow','door']) {
  const stairsMesh = stairs(1,1,1,8,0,{})
  const stairGeo = toGeo(stairsMesh)
  const originalVolume = volume(stairsMesh.f.map(f => ({ pts:f.map(i => stairsMesh.v[i]) })))
  const originals = {
    stairs:{id:'stairs',type:'primitive',kind:'stairs',position:[0,0,0],scale:[1,1,1],props:{steps:8}},
    source:{id:'source',type:'mesh',kind:'cube',position:[0,-0.2,0.15],scale:[1,1,1],props:{mesh:cube(.65,.6,.65).toJSON()}},
    hollow:{id:'hollow',type:'meshSubtract',kind:'mesh',position:[0,0,0],scale:[1,1,1],props:{sourceId:'source'}},
    door:{id:'door',type:'subtract',kind:'box',position:[-.45,-.18,.15],scale:[.4,.55,.45],props:{}},
  }
  const objects = order.map(id => originals[id])
  const receiver = nodeFor(stairGeo)
  const sourceNode = nodeFor(toGeo(cube(1,1,1)))
  const hollowNode = nodeFor(box([1,1,1]))
  hollowNode.userData.fill=hollowNode.m
  hollowNode.userData.edges={geometry:{dispose(){}},visible:true,material:{color:{set(){}}}}
  const doorNode = nodeFor(box([1,1,1]))
  const nodes=new Map([['stairs',receiver],['source',sourceNode],['hollow',hollowNode],['door',doorNode]])
  const context={
    host:{project:{objects,meshes:[]}},nodes,
    vp:{requestRender(){},invalidateShadows(){}},
    worldMatrix(id){
      const byId=new Map(objects.map(o=>[o.id,o]))
      const chain=[]
      for(let node=byId.get(id);node;node=byId.get(node.parentId)) chain.unshift(node)
      const matrix=new Matrix4()
      for(const node of chain) matrix.multiply(new Matrix4(node.position ?? [0,0,0],node.type==='node3d' ? node.scale : [1,1,1]))
      return matrix
    },
    _brTimer:0,
  }
  Object.assign(context, brushesMethods)
  return {context, receiver, originals, objects, originalVolume, stairGeo}
}

const nearly=(a,b,epsilon=0.00001)=>assert.ok(Math.abs(a-b)<epsilon, `Expected ${a} ≈ ${b}`)

test('MIX-01: cavidad y puerta se restan conjuntamente de la escalera y generan superficies interiores',()=>{
  const scene=setup()
  const changed=scene.context.refreshBrushes()
  assert.deepEqual(changed,['stairs','source'])
  const carved=scene.receiver.userData.carvedPolys
  assert.ok(carved?.length)
  const tags=new Set(carved.map(p=>p.tag))
  assert.ok(tags.has(0), 'conserva exterior de escalera')
  assert.ok(tags.has(1), 'conserva cara interior de primer cortador')
  assert.ok(tags.has(2), 'conserva cara interior de segundo cortador')
  assert.ok(scene.receiver.userData.cutMeshes?.length>=2)
  const cutVol=volume(carved)
  assert.ok(cutVol>0 && cutVol<scene.originalVolume)
})

test('MIX-02: al quitar la puerta queda la cavidad y al quitar Mesh Substract se restaura la escalera',()=>{
  const scene=setup()
  scene.context.refreshBrushes()
  const mixedVol=volume(scene.receiver.userData.carvedPolys)
  scene.objects.splice(scene.objects.indexOf(scene.originals.door),1)
  scene.context.refreshBrushes()
  const hollowVol=volume(scene.receiver.userData.carvedPolys)
  assert.ok(hollowVol>mixedVol)
  scene.objects.splice(scene.objects.indexOf(scene.originals.hollow),1)
  scene.context.refreshBrushes()
  assert.equal(scene.receiver.m.geometry,scene.stairGeo)
  assert.equal(scene.receiver.userData.cutMeshes,null)
})

test('MIX-03: invertir el orden de los cortadores conserva el volumen y la abertura',()=>{
  const a=setup(['stairs','source','hollow','door'])
  const b=setup(['stairs','source','door','hollow'])
  a.context.refreshBrushes()
  b.context.refreshBrushes()
  nearly(volume(a.receiver.userData.carvedPolys),volume(b.receiver.userData.carvedPolys),0.005)
})

test('MIX-04: mover el cortador clásico no invalida la cavidad de la malla',()=>{
  const scene=setup()
  scene.context.refreshBrushes()
  scene.originals.door.position=[-3,0,0]
  scene.context.refreshBrushes()
  assert.ok(scene.receiver.userData.carvedPolys?.length)
  assert.ok(scene.receiver.userData.cutMeshes?.length>=1)
})


test('MIX-05: reordenar ambos nodos en Jerarquía no reconstruye la geometría',()=>{
  const scene=setup()
  scene.context.refreshBrushes()
  const geometry=scene.receiver.m.geometry
  const walls=scene.receiver.userData.cutMeshes
  scene.objects.splice(scene.objects.indexOf(scene.originals.door),1)
  scene.objects.splice(scene.objects.indexOf(scene.originals.hollow),0,scene.originals.door)
  const changed=scene.context.refreshBrushes()
  assert.deepEqual(changed,[])
  assert.equal(scene.receiver.m.geometry,geometry)
  assert.equal(scene.receiver.userData.cutMeshes,walls)
})

test('MIX-06: desactivar el recorte de la puerta conserva el vaciado interior',()=>{
  const scene=setup()
  scene.context.refreshBrushes()
  const mixed=volume(scene.receiver.userData.carvedPolys)
  scene.originals.door.active=false
  scene.context.refreshBrushes()
  const hollow=volume(scene.receiver.userData.carvedPolys)
  assert.ok(hollow>mixed)
  scene.originals.door.active=true
  scene.context.refreshBrushes()
  nearly(volume(scene.receiver.userData.carvedPolys),mixed,0.005)
})

test('MIX-07: al ocultar Mesh Substract queda la puerta; al restaurar ambos recortes reaparecen',()=>{
  const scene=setup()
  scene.context.refreshBrushes()
  const mixed=volume(scene.receiver.userData.carvedPolys)
  scene.originals.hollow.active=false
  scene.context.refreshBrushes()
  assert.ok(scene.receiver.userData.carvedPolys?.length)
  assert.equal(scene.receiver.userData.cutMeshes.length,1)
  scene.originals.hollow.active=true
  scene.context.refreshBrushes()
  nearly(volume(scene.receiver.userData.carvedPolys),mixed,0.005)
})

test('MIX-08: modificar la fuente de Mesh Substract no borra el hueco de la puerta',()=>{
  const scene=setup()
  scene.context.refreshBrushes()
  const old=volume(scene.receiver.userData.carvedPolys)
  scene.originals.source.position=[0,-0.1,0.25]
  scene.context.refreshBrushes()
  const changed=volume(scene.receiver.userData.carvedPolys)
  assert.notEqual(changed,old)
  assert.ok(scene.receiver.userData.cutMeshes?.length>=2)
})

test('MIX-09: preservar la geometría autoral y las mismas propiedades de ambos cortadores',()=>{
  const scene=setup()
  const src=scene.originals.source.props.mesh
  const doorProps=structuredClone(scene.originals.door.props)
  scene.context.refreshBrushes()
  assert.equal(scene.receiver.userData.baseGeo,scene.stairGeo)
  assert.equal(scene.originals.source.props.mesh,src)
  assert.deepEqual(scene.originals.door.props,doorProps)
  assert.equal(scene.receiver.userData.cutMeshes.every(m=>m.material===scene.receiver.m.material),true)
})

test('MIX-10: ambos recortes hijos de la escalera afectan exclusivamente a su malla padre',()=>{
  const scene=setup()
  scene.originals.hollow.parentId='stairs'
  scene.originals.door.parentId='stairs'
  const neighbor={id:'neighbor',type:'primitive',kind:'box',position:[0,0,0],scale:[1,1,1],props:{}}
  scene.objects.push(neighbor)
  const adjacent=nodeFor(box([1,1,1]))
  scene.context.nodes.set(neighbor.id,adjacent)
  scene.context.refreshBrushes()
  assert.ok(scene.receiver.userData.cutMeshes?.length>=2)
  assert.equal(adjacent.userData.carvedPolys ?? null,null)
  assert.equal(adjacent.m.geometry,adjacent.userData.baseGeo)
})

test('MIX-11: el Substract sin padre receptor mantiene su alcance global',()=>{
  const scene=setup()
  const neighbor={id:'neighbor',type:'primitive',kind:'box',position:[-.45,-.18,.15],scale:[1,1,1],props:{}}
  const adjacent=nodeFor(box([1,1,1]))
  scene.objects.push(neighbor)
  scene.context.nodes.set(neighbor.id,adjacent)
  scene.context.refreshBrushes()
  assert.ok(adjacent.userData.carvedPolys?.length)
  assert.ok(scene.receiver.userData.cutMeshes?.length)
})

test('MIX-12: el origen de la fuente bajo la escalera no se aplica dos veces',()=>{
  const scene=setup()
  scene.originals.stairs.position=[15,0,-8]
  scene.originals.source.parentId='stairs'
  scene.originals.hollow.parentId='stairs'
  scene.originals.door.parentId='stairs'
  scene.context.refreshBrushes()
  const volumeShifted=volume(scene.receiver.userData.carvedPolys)
  const base=setup()
  base.context.refreshBrushes()
  nearly(volumeShifted,volume(base.receiver.userData.carvedPolys),0.005)
  const hollowNode=scene.context.nodes.get('hollow')
  const center=hollowNode.userData.fill.geometry.boundingBox
  nearly((center.min[0]+center.max[0])/2,scene.originals.source.position[0])
  nearly((center.min[1]+center.max[1])/2,scene.originals.source.position[1])
  nearly((center.min[2]+center.max[2])/2,scene.originals.source.position[2])
})

test('MIX-13: mover el padre junto a su fuente y cortadores no recalcula su geometría relativa',()=>{
  const scene=setup()
  scene.originals.source.parentId='stairs'
  scene.originals.hollow.parentId='stairs'
  scene.originals.door.parentId='stairs'
  scene.context.refreshBrushes()
  const geo=scene.receiver.m.geometry
  const sourceGeo=scene.context.nodes.get('hollow').userData.fill.geometry
  scene.originals.stairs.position=[12,3,-9]
  const changed=scene.context.refreshBrushes()
  assert.deepEqual(changed,[])
  assert.equal(scene.receiver.m.geometry,geo)
  assert.equal(scene.context.nodes.get('hollow').userData.fill.geometry,sourceGeo)
})

test('MIX-14: cambiar la jerarquía de un cortador actualiza inmediatamente su receptor',()=>{
  const scene=setup()
  scene.originals.hollow.parentId='stairs'
  const neighbor={id:'neighbor',type:'primitive',kind:'box',position:[-.45,-.18,.15],scale:[1,1,1],props:{}}
  const adjacent=nodeFor(box([1,1,1]))
  scene.objects.push(neighbor)
  scene.context.nodes.set(neighbor.id,adjacent)
  scene.context.refreshBrushes()
  assert.ok(adjacent.userData.carvedPolys?.length)
  scene.originals.door.parentId='stairs'
  scene.context.refreshBrushes()
  assert.equal(adjacent.userData.carvedPolys,null)
  assert.ok(scene.receiver.userData.carvedPolys?.length)
})

test('MIX-15: el receptor más cercano prevalece sobre otros antepasados de malla',()=>{
  const scene=setup()
  const receiverOuter=scene.originals.stairs
  const receiverInner={id:'inner',type:'mesh',kind:'cube',parentId:receiverOuter.id,position:[0,0,0],scale:[1,1,1],props:{}}
  scene.objects.push(receiverInner)
  const innerNode=nodeFor(box([1,1,1]))
  scene.context.nodes.set('inner',innerNode)
  scene.originals.door.parentId='inner'
  scene.context.refreshBrushes()
  assert.ok(innerNode.userData.carvedPolys?.length)
  assert.ok(scene.receiver.userData.carvedPolys?.length)
  assert.equal(nearestMeshParent(scene.objects,scene.originals.door).id,receiverInner.id)
  assert.equal(nearestMeshParent(scene.objects,scene.originals.hollow),null)
})

test('MIX-16: el check encadena Substract sobre el resultado de Mesh Substract',()=>{
  const scene=setup()
  scene.originals.hollow.parentId='source'
  scene.originals.hollow.props.sourceId=''
  scene.originals.hollow.position=[0,0,0]
  scene.originals.door.parentId='source'
  scene.originals.door.props.composeWithMeshSubtract=true
  scene.context.refreshBrushes()

  const sourceNode=scene.context.nodes.get('source')
  const chainedVolume=volume(sourceNode.userData.carvedPolys)
  const sourceTags=new Set(sourceNode.userData.carvedPolys?.map(poly=>poly.tag))
  assert.deepEqual([...sourceTags].sort(),[0,1,2],
    'la escalera conserva la cavidad de malla y las caras de la puerta posterior')
  assert.equal(scene.receiver.userData.carvedPolys ?? null,null,
    'Mesh Substract automático no usa sólidos ajenos como receptor')

  scene.originals.door.active=false
  scene.context.refreshBrushes()
  const meshOnlyVolume=volume(sourceNode.userData.carvedPolys)
  assert.ok(meshOnlyVolume>chainedVolume,
    'quitar Substract conserva Mesh Substract pero restaura únicamente el segundo hueco')
  assert.deepEqual([...new Set(sourceNode.userData.carvedPolys.map(poly=>poly.tag))].sort(),[0,1],
    'desactivar la puerta conserva la cavidad de Mesh Substract')
})

test('MIX-18: Mesh Substract automático vacía sólo su padre y no un receptor global vecino',()=>{
  const scene=setup()
  scene.originals.hollow.parentId='source'
  scene.originals.hollow.props.sourceId=''
  scene.originals.hollow.position=[0,0,0]
  scene.originals.door.active=false
  scene.context.refreshBrushes()

  assert.ok(scene.context.nodes.get('source').userData.carvedPolys?.length,
    'el padre queda hueco usando su propia forma transformada')
  assert.equal(scene.receiver.userData.carvedPolys ?? null,null,
    'el sólido vecino no recibe el corte automático del hijo ajeno')
})

test('MIX-19: el slot opcional de Substract limita el corte a un único receptor',()=>{
  const scene=setup()
  scene.originals.hollow.active=false
  scene.originals.door.parentId='source'
  scene.originals.door.props.receiverId='stairs'
  scene.context.refreshBrushes()

  assert.ok(scene.receiver.userData.carvedPolys?.length,
    'el receptor elegido recibe el hueco aunque no sea el padre inmediato')
  assert.equal(scene.context.nodes.get('source').userData.carvedPolys ?? null,null,
    'el padre no se recorta cuando el slot elige otra malla')

  scene.originals.door.props.receiverId='missing'
  scene.context.refreshBrushes()
  assert.equal(scene.receiver.userData.carvedPolys ?? null,null,
    'una referencia obsoleta no degrada a recorte global')
  assert.equal(scene.context.nodes.get('source').userData.carvedPolys ?? null,null)
})

test('MIX-17: el check sin pareja automática conserva el receptor normal',()=>{
  const scene=setup()
  scene.originals.hollow.parentId='source'
  scene.originals.hollow.props.sourceId='source'
  scene.originals.door.parentId='source'
  scene.originals.door.props.composeWithMeshSubtract=true
  scene.context.refreshBrushes()

  assert.equal(scene.receiver.userData.carvedPolys ?? null,null)
  assert.ok(scene.context.nodes.get('source').userData.carvedPolys?.length)
})
