import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PolyMesh, checkClosed, signedVolume } from '../src/engine/runtime/mesh/polymesh.js'
import { initialSubtractPoly, validateSubtractPoly, subtractPolyOf } from '../src/engine/runtime/mesh/subtract-edit.js'
import { polyBuffers } from '../src/engine/runtime/mesh/buffers.js'
import { meshDataOf, writeMesh } from '../src/engine/runtime/mesh/shared-mesh.js'
import { scene, volume, csg, box, Matrix4 } from './fixtures/csg-fixture.mjs'
import { Sel, normalize } from '../src/core/mesh/sel.js'
import { extrude, extrudeNormal } from '../src/core/mesh/ops.js'

const src = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8')
const obj = kind => ({ id: 'cut', type: 'subtract', kind, position: [.8, 0, 0], scale: [2, 3, 4], props: { steps: 8, turn: 0 } })

for (const kind of ['box', 'cylinder', 'stairs']) {
  test(`Substract ${kind}: entrada a edición sin conversión del nodo`, () => {
    const o = obj(kind)
    const poly = initialSubtractPoly(o)
    assert.equal(validateSubtractPoly(poly), null)
    assert.equal(checkClosed(poly).length, 0)
    assert.ok(signedVolume(poly) > 0)
    assert.ok(polyBuffers(poly).indices.length >= 12)
    assert.equal(writeMesh({ objects: [o] }, o, poly.toJSON()), true)
    assert.equal(o.type, 'subtract')
    assert.equal(subtractPolyOf(o).f.length, poly.f.length)
    assert.deepEqual(PolyMesh.fromJSON(meshDataOf(o)).f, poly.f)
  })
}

test('Substract escalera: geometría inicial respeta escala y giro sin escala doble', () => {
  const o = obj('stairs'); o.props.turn = 30; o.scale = [3, 3, 6]
  const m = initialSubtractPoly(o)
  assert.equal(validateSubtractPoly(m), null)
  const saved = PolyMesh.fromJSON(m.toJSON())
  assert.equal(validateSubtractPoly(saved), null)
  assert.ok(m.v.every(v => v.every(Number.isFinite)))
})

test('Substract rechaza un cortador abierto y conserva su última geometría válida', () => {
  const o = obj('box'), poly = initialSubtractPoly(o)
  writeMesh(null, o, poly.toJSON())
  const valid = JSON.stringify(o.props.mesh)
  const invalid = poly.clone(); invalid.f.pop()
  assert.match(validateSubtractPoly(invalid), /cerrado/)
  assert.equal(JSON.stringify(o.props.mesh), valid)
})

test('Substract rechaza orientación inversa, volumen plano y caras degeneradas', () => {
  const poly = initialSubtractPoly(obj('box'))
  const reversed = poly.clone(); reversed.f = reversed.f.map(f => [...f].reverse())
  assert.match(validateSubtractPoly(reversed), /orientadas/)
  const flat = poly.clone(); flat.v = flat.v.map(v => [v[0], 0, v[2]])
  assert.ok(validateSubtractPoly(flat))
  const bad = poly.clone(); bad.f[0][0] = bad.f[0][1]
  assert.match(validateSubtractPoly(bad), /degeneradas/)
})

test('Substract vuelve a calcular realmente el BSP al editar su malla', () => {
  const { context, cutter, r } = scene()
  const initial = initialSubtractPoly(cutter)
  assert.equal(writeMesh(context.host.project, cutter, initial.toJSON()), true)
  context.refreshBrushes()
  const before = volume(r.userData.carvedPolys)
  const oldGeo = r.m.geometry
  const bigger = initial.clone()
  for (const v of bigger.v) if (v[0] < 0) v[0] -= .35
  assert.equal(validateSubtractPoly(bigger), null)
  writeMesh(context.host.project, cutter, bigger.toJSON())
  const updated = context.refreshBrushes()
  assert.ok(updated.includes('wall'))
  const after = volume(r.userData.carvedPolys)
  assert.ok(after < before, `El hueco no aumentó: ${before} -> ${after}`)
  assert.notEqual(r.m.geometry, oldGeo)
  assert.equal(cutter.type, 'subtract')
  assert.equal(meshDataOf(cutter).rev, cutter.props.mesh.rev)
})

test('Substract preserva Undo/Redo mediante la misma fuente de geometría serializada', () => {
  const o = obj('box'), initial = initialSubtractPoly(o).toJSON()
  assert.ok(writeMesh(null, o, initial))
  const next = PolyMesh.fromJSON(initial)
  for (const p of next.v) if (p[0] > 0) p[0] *= 1.5
  const changed = next.toJSON()
  assert.ok(writeMesh(null, o, changed))
  assert.equal(PolyMesh.fromJSON(meshDataOf(o)).v[1][0], .75)
  assert.ok(writeMesh(null, o, initial))
  assert.equal(PolyMesh.fromJSON(meshDataOf(o)).v[1][0], .5)
  assert.ok(writeMesh(null, o, changed))
  assert.equal(PolyMesh.fromJSON(meshDataOf(o)).v[1][0], .75)
})

test('Edición de Substract usa EditSession y la escala únicamente en el nodo', () => {
  const edit = src('src/core/editor/meshedit.js')
  const session = src('src/core/mesh/session.js')
  assert.match(edit, /'primitive', 'mesh', 'subtract'/)
  assert.match(edit, /initialSubtractPoly\(obj\)/)
  assert.match(edit, /new \(tool\('mesh'\)\.EditSession\)/)
  assert.match(session, /this\.obj\.type === 'subtract' \? \[1, 1, 1\] : this\.obj\.scale/)
  assert.match(session, /validateSubtractPoly\(this\.poly\)/)
  assert.match(session, /meshDataOf\(this\.obj, store\.project\.meshes\)/)
  assert.match(session, /this\.node\.userData\.subtractOwnedGeometry = g/)
})

test('Editor y BSP consumen la geometría personalizada del mismo Substract', () => {
  const node = src('src/engine/runtime/nodes/subtract.js')
  const brushes = src('src/engine/runtime/scene/brushes.js')
  assert.match(node, /root\.userData\.meshBody = fill/)
  assert.match(node, /custom \? geometryOf\(custom\)/)
  assert.match(brushes, /custom \? geometryOf\(custom\)/)
  assert.match(brushes, /c\.o\.props\?\.mesh\?\.rev/)
  assert.match(brushes, /if \(c\.owned\) c\.g\.dispose/)
})

test('Inspector conserva forma predefinida y ofrece restauración confirmada', () => {
  const inspector = src('src/components/Inspector.vue')
  assert.match(inspector, /restoreSubtractShape/)
  assert.match(inspector, /await askConfirm/)
  assert.match(inspector, /props: \{ mesh: null \}/)
  assert.match(inspector, /:disabled="!!obj\.props\?\.mesh"/)
  assert.match(inspector, /obj\.type === 'mesh' \|\| obj\.type === 'subtract'/)
  assert.match(src('src/components/Toolbar.vue'), /'primitive', 'mesh', 'subtract'/)
})

test('Player sigue excluyendo Substract de colisiones y recibe los recortes', () => {
  const play = src('src/engine/runtime/events/play-level.js')
  const csgsrc = src('src/engine/runtime/geometry/csg.js')
  assert.match(csgsrc, /o\?\.type === 'subtract'/)
  assert.match(play, /obj\.type === 'subtract'/)
  assert.match(play, /refreshBrushes/)
})

test('La ruta real enterEdit inicializa Substract sin convertirlo a mesh', () => {
  const source = src('src/core/editor/meshedit.js')
    .replace(/^import.*\n/gm, '')
    .replace('export const mesheditMethods =', 'const mesheditMethods =')
  const o = obj('box'), calls = []
  const store = { selectedId: o.id, selectedIds: [o.id], tool: 'select' }
  class StubSession {
    constructor(editor, target) { assert.equal(target, o); assert.equal(target.type, 'subtract'); assert.ok(target.props.mesh); calls.push('session') }
  }
  const methods = new Function('store','getObject','toast','initialSubtractPoly','validateSubtractPoly','PolyMesh','tool','commit', source + '\nreturn mesheditMethods')(
    store, id => id === o.id ? o : null, message => { throw Error(message) }, initialSubtractPoly,validateSubtractPoly,PolyMesh,
    () => ({ EditSession: StubSession }), label => calls.push(label))
  const editor = {
    nodes: new Map([[o.id, { userData: { visual: {}, meshBody: {} } }]]),
    boxes: [], vp: {overlay:{remove(){}},requestRender(){}},
    _lockedChain:()=>false, setGameView:()=>{}, _tcs:()=>[], syncObject:()=>calls.push('sync'),
  }
  const result = methods.enterEdit.call(editor, o.id)
  assert.equal(result, undefined)
  assert.ok(editor.edit instanceof StubSession)
  assert.equal(o.type, 'subtract')
  assert.deepEqual(o.scale, [2,3,4])
  assert.equal(validateSubtractPoly(PolyMesh.fromJSON(o.props.mesh)), null)
  assert.deepEqual(calls, ['sync','session','Inicializar geometría Substract'])
})

test('La ruta real EditSession.commit rechaza un cortador abierto sin contaminar el proyecto', () => {
  const source = src('src/core/mesh/session.js')
    .replace(/^import.*\n/gm, '')
    .replace('export class EditSession', 'class EditSession')
    .replace(/^export \{ updateObject, vcross.*\n/m, '')
  const store = { project: { meshes: [], objects: [] } }, history = []
  const factory = new Function('PolyMesh','meshDataOf','writeMesh','validateSubtractPoly','meshConsumers','store','toast','commit',
    'pickMethods','inputMethods','modalMethods','xformMethods','paintInputMethods', source + '\nreturn EditSession')
  const Session = factory(PolyMesh,meshDataOf,writeMesh,validateSubtractPoly,() => [],store,()=>{}, label => history.push(label), {},{},{},{},{})
  const target = obj('box')
  store.project.objects = [target]
  target.props.mesh = initialSubtractPoly(target).toJSON()
  const session = Object.create(Session.prototype)
  session.objId = target.id; session.obj = target;session.poly=PolyMesh.fromJSON(target.props.mesh)
  session.sel={clear(){}, clone(){return this}}
  session.mode='face';session.node={userData:{}}
  session.ed={syncObject(){}};session.refresh=()=>{}
  const before = JSON.stringify(target.props.mesh)
  session.poly.f.pop()
  assert.equal(session.commit('Cortador inválido'),false)
  assert.equal(JSON.stringify(target.props.mesh),before)
  assert.equal(session.poly.f.length,6)
  assert.deepEqual(history,[])
  for (const v of session.poly.v) if (v[0] < 0) v[0] -= .2
  assert.equal(session.commit('Editar Substract'),true)
  assert.equal(history.length,1)
  assert.notEqual(JSON.stringify(target.props.mesh),before)
  assert.equal(validateSubtractPoly(PolyMesh.fromJSON(target.props.mesh)),null)
})

test('El nodo Substract reconstruye el volumen visible desde la geometría personalizada', () => {
  const source = src('src/engine/runtime/nodes/subtract.js')
    .replace(/^import.*\n/gm, '')
    .replace('export default registerNode(', 'const descriptor = registerNode(')
  const geometries = []
  class Geometry {
    constructor() { this.disposed=false; geometries.push(this) }
    dispose() {this.disposed=true}
  }
  class Material {
    constructor() {this.color={set(color){this.value=color}}}
  }
  class Mesh {
    constructor(geometry,material){this.geometry=geometry;this.material=material;this.userData={};this.isMesh=true}
  }
  const three={Mesh,MeshBasicMaterial:Material, LineSegments:Mesh, EdgesGeometry:Geometry, DoubleSide:2}
  const defaultGeo=new Geometry()
  const makeRoot=()=>{
    const visual={children:[],scale:{values:[1,1,1],set(...v){this.values=v},toArray(){return this.values}},add(...children){this.children.push(...children)}}
    const root={userData:{visual}}
    return {root,visual}
  }
  const applyBase=(root, target)=>root.userData.visual.scale.set(...target.scale)
  const def=new Function('THREE','registerNode','makeRoot','applyBase','lineMat','unitGeometry','stairsGeometry','geometryOf','subtractPolyOf',
    source+'\nreturn descriptor')(three,o=>o,makeRoot,applyBase,()=>new Material(),()=>defaultGeo,()=>defaultGeo,()=>new Geometry(),subtractPolyOf)
  const target=obj('box')
  const root=def.build(target)
  assert.equal(root.userData.meshBody,root.userData.fill)
  def.update(root,target)
  assert.equal(root.userData.fill.geometry,defaultGeo)
  const custom=initialSubtractPoly(target)
  writeMesh(null,target,custom.toJSON())
  def.update(root,target)
  const geometry1=root.userData.fill.geometry
  assert.notEqual(geometry1,defaultGeo)
  assert.equal(root.userData.subtractOwnedGeometry,geometry1)
  assert.ok(root.userData.shapeKey.startsWith('editable:'))
  const changed=custom.clone()
  for(const vertex of changed.v)if(vertex[0]<0)vertex[0]-=.1
  writeMesh(null,target,changed.toJSON())
  root.userData.liveEdit=true
  def.update(root,target)
  assert.equal(root.userData.fill.geometry,geometry1)
  root.userData.liveEdit=false
  def.update(root,target)
  assert.notEqual(root.userData.fill.geometry,geometry1)
  assert.equal(geometry1.disposed,true)
  assert.equal(defaultGeo.disposed,false)
  assert.deepEqual(root.userData.visual.scale.values,target.scale)
  const customizedGeometry = root.userData.fill.geometry
  root.userData.timelineSubtractKind = 'cylinder'
  def.refreshShape(root,target)
  assert.equal(root.userData.fill.geometry,customizedGeometry)
  assert.ok(root.userData.shapeKey.startsWith('editable:'))
  target.props.mesh = null
  def.refreshShape(root,target)
  assert.equal(root.userData.fill.geometry,defaultGeo)
  assert.equal(customizedGeometry.disposed,true)
})

test('Extruir en Substract tolera solo el estado transitorio y confirma un volumen cerrado', () => {
  const source = src('src/core/mesh/session-modal.js').replace(/^import.*\n/gm, '').replace('export const modalMethods =','const modalMethods =')
  const methods = new Function('O','vlen','toast','undo','store', source+'\nreturn modalMethods')(
    { extrude: (m,s,mode) => extrude(m,s,mode), extrudeSolid: () => 'No compatible', extrudeNormal: (m,s) => extrudeNormal(m,s) },
    v => Math.hypot(...v), msg => { throw Error(msg) },()=> { throw Error('No debe ejecutarse Undo en extrusión no confirmada') },{edit:{}})
  const target = obj('box'), poly = initialSubtractPoly(target)
  const selection = new Sel();selection.f.add(1);normalize(poly,selection,'face')
  const context={obj:target,poly,sel:selection,mode:'face',dirty:false,
    run(){throw Error('No se debe confirmar geometría transitoria')},refresh(){},
    startModal(kind,extra){this.modal={kind,...extra};this.didStart=true}}
  methods.startExtrude.call(context)
  assert.equal(context.didStart,true)
  assert.equal(context.modal.transientSubtract,true)
  assert.match(validateSubtractPoly(context.poly),/superficie/)
  const normal=extrudeNormal(context.poly,context.sel)
  for(const vi of context.sel.v)for(let axis=0;axis<3;axis++)context.poly.v[vi][axis]+=.35*normal[axis]
  assert.equal(validateSubtractPoly(context.poly),null)
})

test('Cancelar la extrusión de Substract restaura la geometría sin usar Undo', () => {
  const source = src('src/core/mesh/session-modal.js').replace(/^import.*\n/gm, '').replace('export const modalMethods =','const modalMethods =')
  const methods = new Function('O','vlen','toast','undo','store',source+'\nreturn modalMethods')({},()=>0,()=>{},()=>{throw Error('Undo inesperado')},{edit:{hud:'',modalControl:null}})
  const original=initialSubtractPoly(obj('box'))
  const current=original.clone();current.v[0][0]-=.2
  const session={modal:{kind:'grab',transientSubtract:true,extruded:true,extrudeSource:original,extrudeSel:new Sel(),base:current,baseSel:new Sel()},poly:current,sel:new Sel(),dirty:true,
    _continuousGrab:{end(){}},_clearSvg(){},preview:{visible:true},refresh(){}}
  methods.modalCancel.call(session)
  assert.equal(session.modal,null)
  assert.equal(session.poly,original)
  assert.equal(session.dirty,false)
})

test('Extrusión interactiva de Substract se confirma una sola vez tras cerrar el volumen', () => {
  const source = src('src/core/mesh/session-modal.js').replace(/^import.*\n/gm, '').replace('export const modalMethods =','const modalMethods =')
  const stored = {edit:{hud:'grab', modalControl:null}}
  const methods = new Function('O','vlen','toast','undo','store',source+'\nreturn modalMethods')(
    {extrude,extrudeSolid:()=> 'No compatible',extrudeNormal},
    v=>Math.hypot(...v),message=>{throw Error(message)},()=>{throw Error('No debe usarse Undo')},stored)
  const cutter=obj('box'), original=initialSubtractPoly(cutter), before=JSON.stringify(original.toJSON())
  cutter.props.mesh=original.toJSON()
  const sel=new Sel();sel.f.add(1);normalize(original,sel,'face')
  const log=[]
  const session={obj:cutter,poly:original,sel,mode:'face',dirty:false,preview:{visible:true},
    _continuousGrab:{end(){}},refresh(){log.push('refresh')},
    run(){throw Error('No debe confirmarse el estado de área cero')},
    startModal(kind,extra){this.modal={kind,base:this.poly.clone(),baseSel:this.sel.clone(),previewValid:true,...extra}},
    commit(label){const invalid=validateSubtractPoly(this.poly);if(invalid)throw Error(invalid);writeMesh(null,cutter,this.poly.toJSON());log.push(label);return true}}
  methods.startExtrude.call(session)
  assert.equal(session.modal.transientSubtract,true)
  const normal=extrudeNormal(session.poly,session.sel)
  for(const vi of session.sel.v)for(let axis=0;axis<3;axis++)session.poly.v[vi][axis]+=.25*normal[axis]
  assert.equal(validateSubtractPoly(session.poly),null)
  methods.modalConfirm.call(session)
  assert.equal(session.modal,null)
  assert.deepEqual(log,['refresh','Mover (extruir)','refresh'])
  assert.notEqual(JSON.stringify(cutter.props.mesh),before)
  assert.equal(validateSubtractPoly(PolyMesh.fromJSON(cutter.props.mesh)),null)
})

test('No iniciar otra extrusión cuando un modal está activo', () => {
  const source=src('src/core/mesh/session-modal.js').replace(/^import.*\n/gm,'').replace('export const modalMethods =','const modalMethods =')
  const methods=new Function('O','vlen','toast','undo','store',source+'\nreturn modalMethods')(
    {extrude(){throw Error('Extrusión duplicada')}},()=>0,()=>{},()=>{},{edit:{}})
  const poly=initialSubtractPoly(obj('box'))
  const session={obj:obj('box'),poly,sel:new Sel(),modal:{kind:'grab'}}
  assert.equal(methods.startExtrude.call(session),undefined)
  assert.equal(session.poly,poly)
})
