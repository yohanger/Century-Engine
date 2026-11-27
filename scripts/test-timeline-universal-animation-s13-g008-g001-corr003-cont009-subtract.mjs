import { nearestMeshParent } from '../src/engine/runtime/nodes/hierarchy.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {registerNode,getDef} from '../src/engine/runtime/nodes/registry.js'
import {nodeAnimationProperty,validatePropertyValue} from '../src/engine/runtime/anim/model.js'
import {newTimeline,upsertTimelineNodePropertyKey,normalizeTimeline} from '../src/core/timeline/model.js'
const source = name => readFileSync(new URL('../'+name,import.meta.url),'utf8')
const clean = name => source(name).replace(/^import .+$/gm,'').replace(/^export /gm,'')
class FakeGeometry {
  constructor(name='geo') {this.uuid=name;this.attributes={position:{array:new Float32Array([0,0,0,1,0,0,0,1,0]), count:3},normal:{array:new Float32Array(9)},uv:{array:new Float32Array(6)}};this.disposals=0}
  dispose(){this.disposals++}
  getAttribute(name){return this.attributes[name]}
  setAttribute(name,val){this.attributes[name]=val}
}
class FakeMatrix {
  constructor(n=0){this.elements=[n,...new Array(15).fill(1)];this.n=n}
  clone(){return new FakeMatrix(this.n)}
  multiply(m){this.n+=m.n;this.elements[0]=this.n;return this}
  invert(){this.n=-this.n;this.elements[0]=this.n;return this}
  makeScale(x,y,z){this.n=x+y+z;this.elements[0]=this.n;return this}
}
class FakeMesh {
  constructor(geometry,material){this.isMesh=true;this.geometry=geometry;this.material=material;this.userData={};this.visible=true;this.castShadow=true;this.receiveShadow=true}
}
class FakeEdgesGeometry extends FakeGeometry{}
class FakeBufferAttribute {constructor(array,itemSize){this.array=array;this.itemSize=itemSize}}
const THREE={Matrix4:FakeMatrix,Mesh:FakeMesh,EdgesGeometry:FakeEdgesGeometry,BufferAttribute:FakeBufferAttribute}
const units=[],stairs=[]
const unitGeometry=shape=>{units.push(shape);return new FakeGeometry('unit-'+shape)}
const stairsGeometry=()=>{const geo=new FakeGeometry('stairs');stairs.push(geo);return geo}
const def=Function('THREE','registerNode','makeRoot','applyBase','lineMat','unitGeometry','stairsGeometry',
 clean('src/engine/runtime/nodes/subtract.js').replace('default registerNode(', 'const out = registerNode(')+'\nreturn out')(THREE,registerNode,()=>{},()=>{},()=>{},unitGeometry,stairsGeometry)
const obj=(id='cut',kind='box')=>({id,type:'subtract',name:id,kind,active:true,visible:true,color:'#e0503c',scale:[2,2,2],position:[0,0,0],rotation:[0,0,0],props:{steps:8,turn:0}})
const shapeRoot=()=>({userData:{shapeKey:'box|8|0|2,2,2',fill:{geometry:new FakeGeometry('base'),material:{color:{set(){}}}},edges:{geometry:new FakeGeometry('edges'),material:{color:{set(){}}}}}})
const keyId='subtract.kind'
const descriptor=()=>getDef('subtract').animation[keyId]

test('S009-01 · un único descriptor enum bajo propietario original Substract',()=>{
 assert.equal(def.type,'subtract');assert.equal(descriptor().kind,'enum');assert.deepEqual(descriptor().options,['box','cylinder','stairs'])
 assert.equal(nodeAnimationProperty(obj(),keyId),descriptor())
 assert.equal(nodeAnimationProperty({...obj(),type:'mesh'},keyId),null)
})
test('S009-02 · el campo Volumen conserva valores y persistencia de clave NodeID/SceneID',()=>{
 for(const kind of ['box','cylinder','stairs']){
  const o=obj('cutA'),authored=structuredClone(o)
  const tl=newTimeline('CSG',{duration:2})
  upsertTimelineNodePropertyKey(tl,o,keyId,'scene-A',[o],1,kind)
  const tr=normalizeTimeline(JSON.parse(JSON.stringify(tl))).tracks[0]
  assert.equal(tr.keys[0].v,kind);assert.equal(tr.prop,keyId)
  assert.deepEqual(o,authored)
 }
})
test('S009-03 · tipos inválidos bloqueados antes de tocar la escena',()=>{
 assert.throws(()=>validatePropertyValue(keyId,'cone'))
 const root=shapeRoot();assert.throws(()=>descriptor().apply(root,'cone'))
 assert.equal(root.userData.timelineSubtractKind,undefined)
})
test('S009-04 · snapshots STOP restauran override anterior y autoría inalterada',()=>{
 const o=obj(),before=structuredClone(o),root=shapeRoot(),spec=descriptor(),snap=spec.capture(root,o)
 spec.apply(root,'stairs',o);assert.equal(spec.runtimeRead(root,o),'stairs')
 spec.restore(root,snap,o);assert.equal(root.userData.timelineSubtractKind,undefined)
 assert.deepEqual(o,before)
 root.userData.timelineSubtractKind='cylinder';const previous=spec.capture(root,o)
 spec.apply(root,'stairs',o);spec.restore(root,previous,o)
 assert.equal(root.userData.timelineSubtractKind,'cylinder')
})
test('S009-05 · gizmo de Volumen cambia sin reescribir posición, escala ni material autoral',()=>{
 const o=obj(),root=shapeRoot(),spec=descriptor()
 root.position={x:7};root.userData.visual={scale:{x:2,y:2,z:2}}
 const oldEdges=root.userData.edges.geometry
 spec.apply(root,'stairs',o)
 def.refreshShape(root,o)
 assert.equal(root.userData.shapeKey.startsWith('stairs'),true)
 assert.equal(root.position.x,7)
 assert.equal(o.kind,'box')
 assert.equal(root.userData.fill.geometry.uuid,'stairs')
 assert.equal(oldEdges.disposals,1)
 spec.restore(root,{had:false},o)
 def.refreshShape(root,o)
 assert.equal(root.userData.fill.geometry.uuid,'unit-box')
 assert.equal(stairs.at(-1).disposals,1)
})
function brushFixture(){
 const cut=obj(),receiver={id:'wall',type:'primitive',name:'Wall',kind:'box',active:true,visible:true,
   position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],props:{}}
 const mesh=new FakeMesh(new FakeGeometry('base-wall'),{id:'material'})
 const visual={children:[mesh],add(w){this.children.push(w);w.parent=this},remove(w){this.children=this.children.filter(x=>x!==w)}}
 const cutNode={matrixWorld:new FakeMatrix(60),userData:{visual:{scale:{x:2,y:2,z:2}}},updateWorldMatrix(){}}
 const receiverNode={userData:{visual},matrixWorld:new FakeMatrix(4),updateWorldMatrix(){}}
 const matrices=[];let builds=0
 const code=clean('src/engine/runtime/scene/brushes.js').replace('const unitOf', 'const unitOf').replace('const isReceiver','const isReceiver')
 const methods=Function('THREE','nodeEffectiveActive','carveGeometries','cutterTouches','isCutter','applyShadowMats','primitiveMetricAttributes','unitGeometry','stairsGeometry','nearestMeshParent',
  code+'\nreturn brushesMethods')(THREE,()=>true,(base,hits)=>{builds++;matrices.push(hits[0]?.matrix.n);
   return {geos:new Map([[0,new FakeGeometry('carved-'+builds)],[1,new FakeGeometry('wall-'+builds)]]),polys:[{tag:0}]}
  },()=>true,o=>o.type==='subtract',()=>{},()=>({uv:new Float32Array(),size:new Float32Array()}),unitGeometry,stairsGeometry,nearestMeshParent)
 const graph={...methods,host:{project:{objects:[cut,receiver]}},nodes:new Map([[cut.id,cutNode],[receiver.id,receiverNode]]),
  worldMatrix(id){return new FakeMatrix(id==='cut'?5:1)},_brTimer:0,
  vp:{requestRender(){},invalidateShadows(){}}}
 return {cut,receiver,mesh,cutNode,receiverNode,graph,matrices,get builds(){return builds}}
}
test('S009-06 · CSG usa transformación efectiva de jerarquía en Preview, sin datos autorales',()=>{
 const f=brushFixture()
 f.cutNode.userData.timelineSubtractKind='cylinder'
 const changed=f.graph.refreshBrushes({timeline:true})
 assert.deepEqual(changed,['wall'])
 assert.equal(f.mesh.geometry.uuid,'carved-1')
 assert.equal(f.matrices[0],(60+6)-4)
 assert.equal(f.receiverNode.userData.cutMeshes.length,1)
 assert.equal(f.cut.kind,'box')
 assert.equal(f.cutNode.userData.timelineSubtractKind,'cylinder')
 assert.ok(units.includes('cylinder'))
})
test('S009-07 · igual firma CSG no reconstruye ni acumula paredes',()=>{
 const f=brushFixture()
 f.graph.refreshBrushes({timeline:true});const oldGeo=f.mesh.geometry
 assert.deepEqual(f.graph.refreshBrushes({timeline:true}),[])
 assert.strictEqual(f.mesh.geometry,oldGeo)
 assert.equal(f.receiverNode.userData.cutMeshes.length,1)
 assert.equal(f.builds,1)
})
test('S009-08 · el CSG original autoral se restaura al terminar Preview',()=>{
 const f=brushFixture(),root=f.cutNode
 root.userData.timelineSubtractKind='stairs'
 f.graph.refreshBrushes({timeline:true})
 delete root.userData.timelineSubtractKind
 const changed=f.graph.refreshBrushes()
 assert.deepEqual(changed,['wall'])
 assert.equal(f.cut.kind,'box')
 assert.equal(f.builds,2)
})
test('S009-09 · no se reconstruye el BSP si no hay intersección, se conserva baseGeo',()=>{
 const f=brushFixture(),g=f.graph
 g.host.project.objects=[f.receiver]
 assert.deepEqual(g.refreshBrushes({timeline:true}),[])
 assert.equal(f.mesh.geometry.uuid,'base-wall')
})
const fullBody=source('src/engine/runtime/physics/node-bodies.js')
function syncMethod(dependencies){
 const match=fullBody.match(/  syncCarvedSources\(sourceIds\) \{[\s\S]*?\n  \}\n\n  \/\*\* Sincroniza únicamente/)
 assert.ok(match,'Método original no encontrado')
 return Function('effectiveCollisionShape','validatePhysicsShape','joltShapeForBody',
  `return ({${match[0].replace(/\n\n  \/\*\* Sincroniza únicamente/,'')}}).syncCarvedSources`)(
  (obj)=>obj,()=>{},dependencies.assembly)
}
function physicalFixture({shapeType='TriMeshShape3D',sourceId='wall',hasHandle=true}={}){
 const owner={id:'body',type:'staticbody3d'},shape={id:'s',parentId:'body',type:'collisionshape3d',props:{shape:{type:shapeType,sourceId},disabled:false}}
 const node={userData:{}},calls=[],id={index:18}
 const world={disposed:false,nodeHandles:new Map(hasHandle?[[owner.id,{id}]]:[]),bi:{SetShape(...args){calls.push(['set',...args])}},J:{EActivation_Activate:1}}
 const play={phys:world,project:{objects:[owner,shape]},ed:{nodes:new Map([[owner.id,node],[shape.id,{userData:{}}]])}}
 const method=syncMethod({assembly:(w,root,entries)=>({shape:{Release(){calls.push(['release'])}},owned:true})})
 return {owner,shape,node,calls,world,play,method}
}
test('S009-10 · StaticBody3D con TriMesh reemplaza Shape en el mismo BodyID',()=>{
 const s=physicalFixture(),body={play:s.play,bodyOwners:[s.owner]}
 assert.equal(s.method.call(body,['wall']),1)
 assert.strictEqual(s.calls[0][1],s.world.nodeHandles.get('body').id)
 assert.deepEqual(s.calls.map(c=>c[0]),['set','release'])
 assert.equal(s.world.nodeHandles.size,1)
})
test('S009-11 · receptor sin TriMesh vinculado no modifica el cuerpo',()=>{
 const s=physicalFixture({shapeType:'BoxShape3D'}),body={play:s.play,bodyOwners:[s.owner]}
 assert.equal(s.method.call(body,['wall']),0)
 assert.equal(s.calls.length,0)
})
test('S009-12 · un BodyID inexistente BLOQUEA, nunca fabrica un segundo cuerpo',()=>{
 const s=physicalFixture({hasHandle:false}),body={play:s.play,bodyOwners:[s.owner]}
 assert.throws(()=>s.method.call(body,['wall']),/BodyID existente/)
 assert.equal(s.calls.length,0)
})
test('S009-13 · no llamar SetShape si no está expuesta la API Jolt',()=>{
 const s=physicalFixture(),body={play:s.play,bodyOwners:[s.owner]}
 delete s.world.bi.SetShape
 assert.throws(()=>s.method.call(body,['wall']),/SetShape no disponible/)
 assert.equal(s.calls.length,0)
})
test('S009-14 · el nuevo ciclo sincroniza CSG antes de game.update y física',()=>{
 const play=source('src/engine/runtime/events/play-controls.js')
 assert.ok(play.indexOf('this._tlUpdate(dt)')<play.indexOf('this._tlSyncBrushes()'))
 assert.ok(play.indexOf('this._tlSyncBrushes()')<play.indexOf('this.game.update(dt)'))
 const t=source('src/engine/runtime/events/play-timeline.js')
 assert.match(t,/this\._nodeBodies\?\.syncCarvedSources\(changed\)/)
 assert.match(t,/if \(this\._tlCsgSig\) this\._tlSyncBrushes\(\)/)
})
test('S009-15 · Preview usa SceneGraph y STOP restaura sin tocar proyectos ni scripts',()=>{
 const p=source('src/core/timeline/preview.js')
 assert.match(p,/editor\.refreshBrushes\(\{timeline:true\}\)/)
 assert.match(p,/editor\?\.refreshBrushes\(\)/)
 assert.match(source('src/components/Inspector.vue'),/inspectorKeyable\('subtract\.kind'\)/)
 assert.doesNotMatch(source('src/engine/runtime/nodes/subtract.js'),/obj\.kind\s*=/)
})
test('S009-16 · contratos originales de navegación y física permanecen en el mismo runtime',()=>{
 assert.match(source('src/engine/runtime/physics/jolt.js'),/nodeBodyRuntime\?\.syncTimelinePhysics/)
 assert.match(source('src/engine/runtime/nav/world.js'),/timelineNavStepHeight/)
 assert.match(source('src/engine/runtime/events/play.js'),/Object\.assign\(PlayMode\.prototype/)
})

test('S009-17 · falla un ensamblado posterior: ninguna de las dos Shape alcanza SetShape',()=>{
  const first=physicalFixture(),objects=[...first.play.project.objects]
  objects.push({id:'body2',type:'staticbody3d'})
  objects.push({id:'s2',type:'collisionshape3d',parentId:'body2',props:{shape:{type:'TriMeshShape3D',sourceId:'wall'},disabled:false}})
  first.play.project.objects=objects
  first.play.ed.nodes.set('body2',{userData:{}});first.play.ed.nodes.set('s2',{userData:{}})
  first.world.nodeHandles.set('body2',{id:{index:99}})
  let buildCount=0,releaseCount=0
  const method=syncMethod({assembly(){
    if(++buildCount===2) throw new Error('Jolt: invalid geometry')
    return {owned:true,shape:{Release(){releaseCount++}}}
  }})
  assert.throws(()=>method.call({play:first.play,bodyOwners:[first.owner,objects[2]]},['wall']),/invalid geometry/)
  assert.equal(first.calls.length,0)
  assert.equal(releaseCount,1)
})
test('S009-18 · receptor bajo BoxShape3D se bloquea y no simula un hueco físico',()=>{
  const s=physicalFixture({shapeType:'BoxShape3D'})
  s.play.project.objects.push({id:'wall',type:'primitive',parentId:'body'})
  assert.throws(()=>s.method.call({play:s.play,bodyOwners:[s.owner]},['wall']),/debe usar TriMeshShape3D/)
  assert.equal(s.calls.length,0)
})

function brushTimelineSync(){
 const src=source('src/engine/runtime/events/play-timeline.js')
 const a=src.indexOf('  _tlSyncBrushes() {'), b=src.indexOf('  /** Una sesión, nodo o escena inválidos',a)
 assert.ok(a>0&&b>a)
 return Function('getDef','return ({'+src.slice(a,b)+'})._tlSyncBrushes')(
  ()=>({refreshShape(){}}))
}
function playBrushFixture(){
 const objects=[{id:'parent',type:'node3d'},obj('cut'),{id:'wall',type:'primitive'}]
 objects[1].parentId='parent'
 const nodes=new Map(objects.map((o,i)=>[o.id,{matrixWorld:{elements:[10+i,...new Array(15).fill(1)]},
  userData:{visual:{scale:{x:1,y:1,z:1}}},updateWorldMatrix(){}}]))
 const calls=[],errors=[]
 const ed={nodes,refreshBrushes(opts){calls.push(opts?.timeline?'live':'author');return ['wall']}}
 const play={project:{objects,activeSceneId:'scene'},ed,tls:[{finished:false,tl:{tracks:[
  {kind:'node',byId:true,sceneId:'scene',node:'parent',prop:'position'}
 ]}}],_tlCsgSig:null,_tlCsgFault:false,
  _nodeBodies:{syncCarvedSources(changed){calls.push('physics:'+changed.join(','))}},
  game:{report(e){errors.push(e.message)}}}
 return {objects,nodes,calls,errors,ed,play}
}
test('S009-19 · animar el abuelo y después el receptor recalcula BSP y Jolt una vez por firma',()=>{
 const f=playBrushFixture(),sync=brushTimelineSync()
 sync.call(f.play)
 assert.deepEqual(f.calls,['live','physics:wall'])
 sync.call(f.play);assert.deepEqual(f.calls,['live','physics:wall'])
 f.nodes.get('wall').matrixWorld.elements[0]+=2
 sync.call(f.play)
 assert.deepEqual(f.calls,['live','physics:wall','live','physics:wall'])
 f.play.tls=[];sync.call(f.play)
 assert.equal(f.calls.at(-2),'author');assert.equal(f.calls.at(-1),'physics:wall')
 assert.equal(f.play._tlCsgSig,null)
})
test('S009-20 · fallo nativo informa y revierte recorte sin reintentos silenciosos',()=>{
 const f=playBrushFixture(),sync=brushTimelineSync()
 let failures=0
 f.play._nodeBodies.syncCarvedSources=()=>{if(++failures===1)throw Error('Jolt SetShape failed')}
 sync.call(f.play)
 assert.equal(f.play._tlCsgFault,true)
 assert.deepEqual(f.calls,['live','author'])
 assert.deepEqual(f.errors,['Jolt SetShape failed'])
 sync.call(f.play)
 assert.equal(f.calls.length,2)
})

test('S009-21 · limpiar MotionPath no elimina la propiedad de restauración CSG',()=>{
  const preview=source('src/core/timeline/preview.js')
  const start=preview.indexOf('  clearMotionPath() {')
  const end=preview.indexOf('  /** La trayectoria no es un recurso',start)
  assert.ok(start>0&&end>start)
  assert.doesNotMatch(preview.slice(start,end),/csgPreview/)
  assert.match(preview.slice(preview.indexOf('  stop() {'),start),/this\.csgPreview/)
})
