import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { brushesMethods } from '../src/engine/runtime/scene/brushes.js'
import { stairsGeometry } from '../src/engine/runtime/geometry/primitives.js'
import { worldMatrixOf } from '../src/engine/runtime/scene/matrix.js'

function receiverNode(geometry) {
  const root = new THREE.Group(), visual = new THREE.Group()
  visual.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()))
  root.add(visual); root.userData.visual = visual
  return root
}
function cutterNode() {
  const root = receiverNode(new THREE.BoxGeometry())
  const fill = root.userData.visual.children[0]
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(fill.geometry), new THREE.LineBasicMaterial())
  root.userData.visual.add(edges); root.userData.fill = fill; root.userData.edges = edges
  return root
}
function polygonArea(pts) {
  let area = 0
  const a = new THREE.Vector3(...pts[0]), b = new THREE.Vector3(), c = new THREE.Vector3()
  for (let i = 2; i < pts.length; i++) {
    b.set(...pts[i - 1]).sub(a); c.set(...pts[i]).sub(a)
    area += b.cross(c).length() / 2
  }
  return area
}
function geometryArea(geometry) {
  const p = geometry.attributes.position, index = geometry.index
  let area = 0
  const point = i => [p.getX(i), p.getY(i), p.getZ(i)]
  const count = index ? index.count : p.count
  for (let i = 0; i < count; i += 3) area += polygonArea([
    point(index ? index.getX(i) : i), point(index ? index.getX(i + 1) : i + 1), point(index ? index.getX(i + 2) : i + 2),
  ])
  return area
}
function volume(polys = []) {
  let sum = 0
  for (const { pts } of polys) for (let i = 2; i < pts.length; i++) {
    const [a,b,c] = [pts[0],pts[i-1],pts[i]]
    sum += (a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6
  }
  return Math.abs(sum)
}

function setup() {
  const source = { id:'stairs', name:'Escalera', type:'primitive', kind:'stairs', position:[0,0,0], rotation:[0,0,0], scale:[3,3,6], props:{steps:17,turn:0,sides:'right',sideHeight:.2,sideThickness:.15} }
  const hollow = { id:'hollow', name:'Mesh Substract', type:'meshSubtract', kind:'mesh', parentId:'stairs', position:[0,0,0], rotation:[0,0,0], scale:[1,1,1], props:{sourceId:'',autoInset:.1} }
  const door = { id:'door', name:'Puerta', type:'subtract', kind:'box', parentId:'stairs', position:[1.4,0,0], rotation:[0,0,0], scale:[.5,2,2], props:{receiverId:'',composeWithMeshSubtract:true}, active:false }
  const objects = [source,hollow,door], byId = new Map(objects.map(object => [object.id,object]))
  const sourceGeometry = stairsGeometry(source.props.steps,source.props.turn,source.scale[0],source.scale[2],source.scale[1],source.props).clone()
  const nodes = new Map([['stairs',receiverNode(sourceGeometry)],['hollow',cutterNode()],['door',cutterNode()]])
  const context = {
    host:{project:{objects,meshes:[]}},nodes,_brTimer:0,
    vp:{invalidateShadows(){},requestRender(){}},
    worldMatrix(id){return worldMatrixOf(key=>byId.get(key),id)},
  }
  Object.assign(context,brushesMethods)
  return {context,source,hollow,door,sourceGeometry,node:nodes.get('stairs'),hollowNode:nodes.get('hollow')}
}

test('MS-SHELL-01: el vaciado automático conserva todas las caras exteriores de la escalera',()=>{
  const scene=setup()
  scene.context.refreshBrushes()
  const polys=scene.node.userData.carvedPolys
  assert.ok(polys?.length)
  assert.deepEqual([...new Set(polys.map(poly=>poly.tag))].sort(),[0,1])
  const originalArea=geometryArea(scene.sourceGeometry)
  const survivingArea=polys.filter(poly=>poly.tag===0).reduce((sum,poly)=>sum+polygonArea(poly.pts),0)
  assert.ok(Math.abs(originalArea-survivingArea)<1e-4,
    `la envolvente exterior perdió superficie: ${originalArea} -> ${survivingArea}`)
  assert.equal(scene.node.userData.visual.children.find(child=>child.isMesh&&!child.userData.brushWall).visible,true)
  const levels=new Set(Array.from(scene.hollowNode.userData.fill.geometry.attributes.position.array)
    .filter((_,index)=>index%3===1).map(value=>Math.round(value*1e5)))
  assert.ok(levels.size>10,`el volumen interior dejó de ser escalonado: ${levels.size} niveles Y`)
})

test('MS-SHELL-02: Substract abre la puerta después sin borrar la cavidad',()=>{
  const scene=setup()
  scene.context.refreshBrushes()
  const hollowVolume=volume(scene.node.userData.carvedPolys)
  scene.door.active=true
  scene.context.refreshBrushes()
  const final=scene.node.userData.carvedPolys
  assert.deepEqual([...new Set(final.map(poly=>poly.tag))].sort(),[0,1,2])
  assert.ok(volume(final)<hollowVolume)
  scene.door.active=false
  scene.context.refreshBrushes()
  assert.ok(Math.abs(volume(scene.node.userData.carvedPolys)-hollowVolume)<1e-6)
})

test('MS-SHELL-03: seleccionar manualmente la escalera conserva el mismo vaciado y composición',()=>{
  const scene=setup()
  scene.context.refreshBrushes()
  const automaticVolume=volume(scene.node.userData.carvedPolys)
  scene.hollow.props.sourceId='stairs'
  scene.context.refreshBrushes()
  const manualVolume=volume(scene.node.userData.carvedPolys)
  assert.ok(Math.abs(manualVolume-automaticVolume)<1e-6)
  assert.deepEqual([...new Set(scene.node.userData.carvedPolys.map(poly=>poly.tag))].sort(),[0,1])

  scene.door.active=true
  scene.context.refreshBrushes()
  assert.deepEqual([...new Set(scene.node.userData.carvedPolys.map(poly=>poly.tag))].sort(),[0,1,2])
  assert.ok(volume(scene.node.userData.carvedPolys)<manualVolume)
})
