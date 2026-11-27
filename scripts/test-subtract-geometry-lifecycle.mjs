import test from 'node:test'
import assert from 'node:assert/strict'
import { nearestMeshParent } from '../src/engine/runtime/nodes/hierarchy.js'
import { readFileSync } from 'node:fs'
import { initialSubtractPoly, validateSubtractPoly } from '../src/engine/runtime/mesh/subtract-edit.js'
import { meshGeometrySignature } from '../src/engine/runtime/mesh/polymesh.js'
import { polyBuffers } from '../src/engine/runtime/mesh/buffers.js'
import { source, scene, box, csg, THREE as csgThree } from './fixtures/csg-fixture.mjs'
import { subtractPolyOf } from '../src/engine/runtime/mesh/subtract-edit.js'
import { nodeEffectiveActive } from '../src/engine/runtime/nodes/hierarchy.js'
import { primitiveMetricAttributes } from '../src/engine/runtime/mesh/blockout-metrics.js'

class Geometry {
  constructor(input) { this.disposals = 0; this.userData = {}; this.attributes = {}; this.input = input }
  dispose() { this.disposals++ }
  setAttribute(key, attribute) { this.attributes[key] = attribute; return this }
  setIndex(index) { this.index = index; return this }
  getAttribute(key) { return this.attributes[key] }
  computeBoundingSphere() {}
}
class Attribute { constructor(array, itemSize) { this.array = array; this.itemSize = itemSize } }
class Material {
  constructor() { this.disposals = 0; this.userData = {}; this.color = { set() {} } }
  dispose() { this.disposals++ }
}
class Mesh { constructor(geometry, material) { this.geometry = geometry; this.material = material; this.userData = {} } }
const mockThree = { Mesh, LineSegments: Mesh, MeshBasicMaterial: Material, EdgesGeometry: Geometry, BufferGeometry: Geometry, BufferAttribute: Attribute, DoubleSide: 2 }
const obj = kind => ({ type: 'subtract', kind, scale: [2, 2, 2], props: { steps: 8, turn: 0 } })

function rebuildBody() {
  const text = source('src/core/mesh/session.js')
  const start = text.indexOf('  _rebuildBody() {')
  const end = text.indexOf('\n  _stats(', start)
  assert.ok(start !== -1 && end > start)
  const body = text.slice(start, end)
  return new Function('THREE', 'polyBuffers', 'meshPaintConfig', 'validateSubtractPoly', 'meshGeometrySignature', `return ({${body}})._rebuildBody`)(mockThree, polyBuffers, () => null, validateSubtractPoly, meshGeometrySignature)
}

function descriptor() {
  const text = source('src/engine/runtime/nodes/subtract.js')
    .replace(/^import.*\n/gm, '')
    .replace('export default registerNode(', 'const descriptor = registerNode(')
  const cachedBox = new Geometry(), cachedCylinder = new Geometry(), cachedStairs = new Geometry()
  const unitGeometry = kind => kind === 'cylinder' ? cachedCylinder : cachedBox
  const makeRoot = () => {
    const visual = { children: [], scale: { values: [1, 1, 1], set(...v) { this.values = v }, toArray() { return this.values } }, add(...children) { this.children.push(...children) } }
    const root = { userData: { visual } }
    return { root, visual }
  }
  const def = new Function('THREE','registerNode','makeRoot','applyBase','lineMat','unitGeometry','stairsGeometry','geometryOf','subtractPolyOf', text + '\nreturn descriptor')(
    mockThree, value => value, makeRoot, (root, value) => root.userData.visual.scale.set(...value.scale), () => new Material(),
    unitGeometry, () => cachedStairs, () => new Geometry(), subtractPolyOf)
  return { def, cachedBox, cachedCylinder, cachedStairs }
}

test('Edit Mesh no libera la geometría compartida de un Substract al reconstruir el cuerpo', () => {
  const shared = new Geometry(), neighbor = { geometry: shared }
  const body = { geometry: shared, material: new Material() }
  const oldEdges = new Geometry()
  const node = { userData: { subtractOwnedGeometry: null, edges: { geometry: oldEdges } } }
  const session = { obj: obj('box'), poly: initialSubtractPoly(obj('box')), body, node }
  const rebuild = rebuildBody()
  rebuild.call(session)
  const first = body.geometry
  assert.notEqual(first, shared)
  assert.equal(shared.disposals, 0)
  assert.equal(neighbor.geometry, shared)
  assert.equal(node.userData.subtractOwnedGeometry, first)
  assert.equal(oldEdges.disposals, 1)
  assert.equal(body.geometry.userData.faceOf.length > 0, true)
  rebuild.call(session)
  assert.equal(first.disposals, 0)
  assert.equal(body.geometry, first)
  session.poly = session.poly.clone()
  for (const v of session.poly.v) if (v[0] < 0) v[0] -= .2
  rebuild.call(session)
  assert.equal(first.disposals, 1)
  assert.equal(shared.disposals, 0)
  assert.equal(node.userData.subtractOwnedGeometry, body.geometry)
  assert.equal(body.geometry.disposals, 0)
})

test('Edit Mesh conserva la liberación de geometrías propias en mallas normales', () => {
  const initial = new Geometry(), body = { geometry: initial, material: new Material() }
  rebuildBody().call({obj: {type:'mesh', scale:[1,1,1],props:{}},poly:initialSubtractPoly(obj('box')),body,node:{userData:{}}})
  assert.equal(initial.disposals, 1)
  assert.equal(body.geometry.disposals, 0)
})

test('Substract cambia entre Caja, Escalera y Cilindro sin liberar ningún catálogo compartido', () => {
  const {def,cachedBox,cachedStairs,cachedCylinder} = descriptor()
  const target = obj('box'), root = def.build(target)
  def.update(root,target)
  target.kind = 'stairs';def.update(root,target)
  assert.equal(root.userData.fill.geometry,cachedStairs)
  assert.equal(root.userData.subtractOwnedGeometry,null)
  target.kind = 'cylinder';def.update(root,target)
  assert.equal(root.userData.fill.geometry,cachedCylinder)
  assert.deepEqual([cachedBox.disposals,cachedStairs.disposals,cachedCylinder.disposals],[0,0,0])
  assert.equal(root.userData.subtractOwnedGeometry,null)
})

test('Substract libera solamente la geometría personalizada sustituida y conserva las otras instancias', () => {
  const {def,cachedBox,cachedStairs} = descriptor()
  const a=obj('stairs'), b=obj('stairs'),root=def.build(a),another=def.build(b)
  def.update(root,a);def.update(another,b)
  assert.equal(root.userData.fill.geometry,another.userData.fill.geometry)
  assert.equal(root.userData.fill.geometry,cachedStairs)
  a.props.mesh = initialSubtractPoly(obj('box')).toJSON()
  def.update(root,a)
  const first = root.userData.fill.geometry
  assert.equal(cachedStairs.disposals,0)
  assert.equal(another.userData.fill.geometry,cachedStairs)
  a.props.mesh={...a.props.mesh,rev:a.props.mesh.rev+1}
  def.update(root,a)
  assert.equal(first.disposals,1)
  const second = root.userData.fill.geometry
  a.props.mesh=null; a.kind='box';def.update(root,a)
  assert.equal(second.disposals,1)
  assert.equal(root.userData.fill.geometry,cachedBox)
  assert.equal(root.userData.subtractOwnedGeometry,null)
  assert.equal(cachedStairs.disposals,0)
})

test('Al retirar un Substract se liberan los recursos propios una única vez', () => {
  const {def,cachedBox,cachedStairs}=descriptor()
  const target=obj('stairs'),root=def.build(target)
  def.update(root,target)
  const edges=root.userData.edges.geometry
  const fillMaterial=root.userData.fill.material,edgeMaterial=root.userData.edges.material
  root.userData.disposeSubtractVisual()
  root.userData.disposeSubtractVisual()
  assert.equal(edges.disposals,1)
  assert.equal(fillMaterial.disposals,1)
  assert.equal(edgeMaterial.disposals,1)
  assert.equal(cachedStairs.disposals,0)
  assert.equal(cachedBox.disposals,0)
  const customTarget=obj('box'),customRoot=def.build(customTarget)
  customTarget.props.mesh=initialSubtractPoly(customTarget).toJSON()
  def.update(customRoot,customTarget)
  const owned=customRoot.userData.subtractOwnedGeometry
  customRoot.userData.disposeSubtractVisual()
  assert.equal(owned.disposals,1)
  customRoot.userData.disposeSubtractVisual()
  assert.equal(owned.disposals,1)
})

test('El BSP no libera las geometrías cacheadas de los cortadores Escalera', () => {
  const shared=box([1,1,1])
  shared.disposals=0
  shared.dispose=()=>{shared.disposals++}
  const sourceText=source('src/engine/runtime/scene/brushes.js').replace(/^import.*\n/gm, '').replace('export const brushesMethods','const brushesMethods')
  const created=[]
  const methods=new Function('THREE','carveGeometries','cutterTouches','isCutter','applyShadowMats','unitGeometry','stairsGeometry','primitiveMetricAttributes','geometryOf','subtractPolyOf','nodeEffectiveActive','nearestMeshParent',sourceText+'\nreturn brushesMethods')(
    csgThree,csg.carveGeometries,()=>false,csg.isCutter,()=>{},()=>box([1,1,1]),()=>shared,primitiveMetricAttributes,
    () => { const geo=new Geometry();created.push(geo);return geo },subtractPolyOf,nodeEffectiveActive,nearestMeshParent)
  const {context,cutter}=scene()
  cutter.kind='stairs';cutter.props={steps:7}
  Object.assign(context,methods)
  for(let i=0;i<4;i++)context.refreshBrushes()
  assert.equal(shared.disposals,0)
  cutter.props.mesh=initialSubtractPoly(obj('box')).toJSON()
  context.refreshBrushes()
  assert.equal(created.length,1)
  assert.equal(created[0].disposals,1)
  assert.equal(shared.disposals,0)
})

test('Eliminar un nodo invoca la liberación de Substract y no afecta el resto', () => {
  const text=source('src/engine/runtime/scene/objects.js').replace(/^import.*\n/gm,'').replace('export const objectsMethods =','const objectsMethods =')
  const methods=new Function(text+'\nreturn objectsMethods')()
  let releases=0,detaches=0
  const node={userData:{disposeSubtractVisual(){releases++}},parent:{remove(){detaches++}}}
  const context={nodes:new Map([['a',node]]),vp:{requestRender(){}},_nodeRemoving(){},_refreshDecals(){},_refreshTriMeshShapes(){},_refreshAutoFitBoxes(){},_nodeRemoved(){},_scheduleWM(){},_scheduleBrushes(){}}
  methods.removeObject.call(context,'a')
  assert.equal(releases,1)
  assert.equal(detaches,1)
  assert.equal(context.nodes.size,0)
})

test('Reconstruir un nodo libera el Substract retirado sin tocar el nodo nuevo', () => {
  const text=source('src/engine/runtime/scene/objects.js').replace(/^import.*\n/gm,'').replace('export const objectsMethods =','const objectsMethods =')
  const newNode={userData:{},children:[],visible:true}
  const def={build:()=>newNode,update:()=>{}}
  const methods=new Function('getDef','signature','nodeActive',text+'\nreturn objectsMethods')(()=>def,()=> 'shape',()=>true)
  let releases=0
  const previous={userData:{disposeSubtractVisual(){releases++}},parent:{remove(){}},children:[]}
  const context={nodes:new Map([['a',previous]]),_ctx(){},_nodeReplacing(){},_attach(){},_applyShadowFlags(){},_applyViewToNode(){},_nodeBuilt(){},_bakeSchedule(){}}
  const target={id:'a',type:'subtract',visible:true}
  assert.equal(methods._rebuild.call(context,target),newNode)
  assert.equal(releases,1)
  assert.equal(context.nodes.get('a'),newNode)
})
