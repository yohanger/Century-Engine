import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerNodeAnimationProperties, nodeAnimationProperty, validatePropertyValue } from '../src/engine/runtime/anim/model.js'
import { newTimeline, upsertTimelineNodePropertyKey, normalizeTimeline } from '../src/core/timeline/model.js'
import { effectiveCollisionShape, validatePhysicsShape, PHYSICS_SHAPES, newPhysicsShape } from '../src/engine/runtime/physics/shapes.js'

const source = file => readFileSync(new URL('../'+file, import.meta.url),'utf8')
class FakeVector { constructor(){this.x=0;this.y=0;this.z=0;this.w=1} clone(){return new FakeVector()} lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z} }
const FakeThree = new Proxy({}, {get:()=>FakeVector})
const types = new Map()
const physics = source('src/engine/runtime/nodes/physics.js').replace(/^import .+$/gm,'')
Function('registerNode','AREA3D_NATIVE_SIGNALS','THREE','makeRoot','applyBase','hitSphere','lineMat','newPhysicsShape','PHYSICS_SHAPES','triMeshGeometry','effectiveCollisionShape','liquidPourAnimation','liquidGeometryAnimation','combustionEnvironmentAnimation',
`${physics}\nreturn true`)(def=>{types.set(def.type,def);registerNodeAnimationProperties(def.type,def.animation||{});return def},[],FakeThree,()=>{},()=>{},()=>{},()=>{},newPhysicsShape,PHYSICS_SHAPES,()=>{},effectiveCollisionShape,()=>({}),()=>({}),()=>({})) // Owner líquido aislado; validado en CONT006.
const nodeBody = source('src/engine/runtime/physics/node-bodies.js').replace(/^import .+$/gm,'').replace('export class NodeBodyRuntime','class NodeBodyRuntime')
const Body = Function('THREE','physicsNodePlan','nodeEffectiveActive','NodeSpatialRuntime','resolveTriMeshSource','triMeshGeometry','effectiveCollisionShape','validatePhysicsShape',`${nodeBody}\nreturn NodeBodyRuntime`)
 (FakeThree,()=>[],()=>true,class {},()=>null,()=>null,effectiveCollisionShape,validatePhysicsShape)
const spatialSrc = source('src/engine/runtime/physics/node-spatial.js').replace(/^import .+$/gm,'').replace('export function spatialNodePlan','function spatialNodePlan').replace('export class NodeSpatialRuntime','class NodeSpatialRuntime')
const Spatial = Function('THREE','getNativeSignal','validatePhysicsTree','createVirtualCharacter','createVirtualCharacterShape','effectiveCollisionShape','validatePhysicsShape',`${spatialSrc}\nreturn NodeSpatialRuntime`)(FakeThree,()=>null,()=>{},()=>{},()=>({Release(){}}),effectiveCollisionShape,validatePhysicsShape)
const obj=(id,type,props={},parentId)=>({id,type,props,parentId,active:true,name:id,visible:true})
const shape=(id,parentId,shape={type:'BoxShape3D',size:[1,1,1]},disabled=false)=>obj(id,'collisionshape3d',{shape,disabled},parentId)
class FakeMatrix {
  clone(){return new FakeMatrix()}
  invert(){return this}
  multiply(){return this}
  decompose(P,Q,S){ Object.assign(P,{x:0,y:0,z:0});Object.assign(Q,{x:0,y:0,z:0,w:1});Object.assign(S,{x:1,y:1,z:1}) }
}
const visual=id=>({userData:{id},matrixWorld:new FakeMatrix(),updateWorldMatrix(){},traverse(){}})
function create(type='staticbody3d',count=1){
 const parent=obj('owner',type,{mass:12,friction:.5}),shapes=Array.from({length:count},(_,i)=>shape('shape'+i,parent.id)),nodes=new Map([[parent.id,visual(parent.id)]],)
 for(const s of shapes)nodes.set(s.id,visual(s.id))
 const nativeCalls=[],shapeResources=[]
 const J={EActivation_Activate:9,EActivation_DontActivate:8,destroy(){},
   Vec3:class{constructor(...v){this.v=v}},Quat:class{constructor(...v){this.v=v}},
   BoxShapeSettings:class{Create(){const shape={AddRef(){},Release(){nativeCalls.push('releaseShape')}};shapeResources.push(shape);return{IsValid:()=>true,Get:()=>shape,Clear(){}}}},
   SphereShapeSettings:class{Create(){const shape={AddRef(){},Release(){nativeCalls.push('releaseShape')}};shapeResources.push(shape);return{IsValid:()=>true,Get:()=>shape,Clear(){}}}},
   CapsuleShapeSettings:class{Create(){const shape={AddRef(){},Release(){nativeCalls.push('releaseShape')}};shapeResources.push(shape);return{IsValid:()=>true,Get:()=>shape,Clear(){}}}},
   StaticCompoundShapeSettings:class{AddShape(){} Create(){const shape={AddRef(){},Release(){nativeCalls.push('releaseShape')}};return{IsValid:()=>true,Get:()=>shape,Clear(){}}}},
   RotatedTranslatedShapeSettings:class{Create(){const shape={AddRef(){},Release(){nativeCalls.push('releaseShape')}};return{IsValid:()=>true,Get:()=>shape,Clear(){}}}},
 }
 const item={id:{key:'same-body-id'},node:nodes.get(parent.id),active:true,mass:12,volume:1,density:.5},motion={ScaleToMass(v){nativeCalls.push('mass:'+v)}}
 const bi={SetShape(id,shape,adjust,activate){nativeCalls.push('setShape');assert.equal(id,item.id)},RemoveBody(id){nativeCalls.push('remove');assert.equal(id,item.id)},AddBody(id){nativeCalls.push('add');assert.equal(id,item.id)}}
 const world={disposed:false,J,bi,sys:{GetBodyLockInterfaceNoLock(){return{TryGetBody(){return{GetMotionProperties(){return motion}}}}}},nodeHandles:new Map([[parent.id,item]]),rigidNodes:new Map([[nodes.get(parent.id),item]]),shapes:new Map(),bodies:{setEnabled(it,enabled){nativeCalls.push(enabled?'enable':'disable');it.active=enabled}}}
 const play={project:{objects:[parent,...shapes]},ed:{nodes},phys:world,_nodeEnabled(){return true}}
 const runtime=new Body(play,1);runtime.bodyOwners=[parent]
 return {parent,shapes,nodes,world,runtime,nativeCalls,item,shapeResources,play}
}
function mark(model,index,key,value){
 const s=model.shapes[index],root=model.nodes.get(s.id),spec=nodeAnimationProperty(s,'collision.'+key)
 assert.ok(spec,'No aparece '+key)
 const snap=spec.capture(root,s)
 spec.apply(root,value,s)
 return ()=>spec.restore(root,snap,s)
}

test('CS-01 · registro en propietario único y elegibilidad según geometría',()=>{
 const s=shape('s','b')
 assert.deepEqual(Object.keys(types.get('collisionshape3d').animation),['collision.size','collision.radius','collision.height','collision.disabled','collision.type','collision.sourceId'])
 assert.ok(nodeAnimationProperty(s,'collision.size'))
 assert.equal(nodeAnimationProperty(s,'collision.radius'),null)
 assert.ok(nodeAnimationProperty(shape('sphere','b',{type:'SphereShape3D',radius:.5}),'collision.radius'))
 assert.ok(nodeAnimationProperty(shape('capsule','b',{type:'CapsuleShape3D',radius:.3,height:2}),'collision.height'))
 assert.equal(nodeAnimationProperty(s,'collision.sourceId'),null)
})
test('CS-02 · las claves persisten por SceneID y NodeID sin modificar recurso',()=>{
 const fixtures=[[shape('a','b'),'collision.size',[2,3,4]], [shape('b','c',{type:'SphereShape3D',radius:.5}),'collision.radius',.8], [shape('c','d',{type:'CapsuleShape3D',radius:.5,height:2}),'collision.height',3],[shape('d','e'),'collision.disabled',true],[shape('e','f'),'collision.type','SphereShape3D']]
 for(const [node,key,value] of fixtures){const original=structuredClone(node),timeline=newTimeline('Physics',{duration:3});upsertTimelineNodePropertyKey(timeline,node,key,'scene-1',[node],1,value);assert.deepEqual(normalizeTimeline(JSON.parse(JSON.stringify(timeline))).tracks[0].keys[0].v,value);assert.deepEqual(node,original)}
})
test('CS-03 · dimensiones inválidas son rechazadas antes del consumo Jolt',()=>{
 assert.throws(()=>validatePropertyValue('collision.size',[NaN,1,1]))
 assert.throws(()=>validatePropertyValue('collision.size',[0,1,1]))
 assert.throws(()=>validatePropertyValue('collision.radius',0))
 const s=create();s.nodes.get('shape0').userData.timelineCollision={size:[-1,1,1]}
 assert.throws(()=>s.runtime.syncTimelineCollisionShapes(),/valor positivo/)
 assert.equal(s.nativeCalls.length,0)
})
test('CS-04 · la lectura efectiva nunca altera props ni identidad autoral',()=>{
 const s=create(),before=structuredClone(s.shapes[0]);const undo=mark(s,0,'size',[2,3,4]);const eff=effectiveCollisionShape(s.shapes[0],s.nodes.get('shape0'));assert.deepEqual(eff.props.shape.size,[2,3,4]);assert.deepEqual(s.shapes[0],before);undo();assert.equal(s.nodes.get('shape0').userData.timelineCollision,undefined)
})
test('CS-05 · tamaño físico modifica forma del mismo BodyID y libera formas transitorias',()=>{
 const s=create(),undo=mark(s,0,'size',[2,2,2]);s.runtime.syncTimelineCollisionShapes();assert.deepEqual(s.nativeCalls,['setShape','releaseShape']);assert.equal(s.world.shapes.size,0);s.runtime.syncTimelineCollisionShapes();assert.equal(s.nativeCalls.length,2);undo();s.runtime.syncTimelineCollisionShapes();assert.deepEqual(s.nativeCalls,['setShape','releaseShape','setShape','releaseShape']);assert.equal(s.runtime.timelineShapeValues.size,0)
})
test('CS-06 · forma desactivada retira cuerpo y detener restaura BodyID',()=>{
 const s=create(),undo=mark(s,0,'disabled',true);s.runtime.syncTimelineCollisionShapes();assert.deepEqual(s.nativeCalls,['remove']);assert.equal(s.item.active,false);undo();s.runtime.syncTimelineCollisionShapes();assert.deepEqual(s.nativeCalls,['remove','setShape','add','releaseShape']);assert.equal(s.item.active,true)
})
test('CS-07 · desactivar una de dos formas conserva el mismo cuerpo compuesto',()=>{
 const s=create('staticbody3d',2);mark(s,0,'disabled',true);s.runtime.syncTimelineCollisionShapes();assert.equal(s.nativeCalls.filter(x=>x==='setShape').length,1);assert.equal(s.nativeCalls.includes('remove'),false)
})
test('CS-08 · dos pistas de una forma compuesta producen solo una sustitución por evaluación',()=>{
 const s=create('staticbody3d',2);mark(s,0,'size',[2,2,2]);mark(s,1,'size',[3,3,3]);s.runtime.syncTimelineCollisionShapes();assert.equal(s.nativeCalls.filter(x=>x==='setShape').length,1)
})
test('CS-09 · RigidBody3D usa BodySet y mantiene masa y flotación autorales al restaurar',()=>{
 const s=create('rigidbody3d'),undo=mark(s,0,'size',[2,3,4]);s.runtime.syncTimelineCollisionShapes();assert.equal(s.item.mass,12);assert.equal(s.item.volume,24);assert.equal(s.nativeCalls.filter(x=>x==='mass:12').length,1);undo();s.runtime.syncTimelineCollisionShapes();assert.equal(s.item.volume,1);assert.equal(s.item.density,.5)
 // Otro canal puede mantener masa activa cuando se libera solamente Shape.
 const undo2=mark(s,0,'size',[2,2,2]);s.runtime.syncTimelineCollisionShapes()
 s.item.mass=18;undo2();s.runtime.syncTimelineCollisionShapes()
 assert.equal(s.item.volume,1);assert.equal(s.item.density,.75)
})
test('CS-10 · último collider desactivado en rígido no crea BodyID nuevo',()=>{
 const s=create('rigidbody3d'),undo=mark(s,0,'disabled',true);s.runtime.syncTimelineCollisionShapes();assert.deepEqual(s.nativeCalls,['disable']);undo();s.runtime.syncTimelineCollisionShapes();assert.equal(s.nativeCalls.includes('enable'),true);assert.equal(s.item.active,true)
})
test('CS-11 · no inventar BodyID si padre se construyó sin Shape activa',()=>{
 const s=create(),undo=mark(s,0,'size',[2,2,2]);s.world.nodeHandles.clear();assert.throws(()=>s.runtime.syncTimelineCollisionShapes(),/no tiene BodyID/);assert.equal(s.nativeCalls.length,0);undo()
})
test('CS-12 · falta de SetShape produce bloqueo explícito antes de cambiar cuerpo',()=>{
 const s=create(),undo=mark(s,0,'size',[2,2,2]);delete s.world.bi.SetShape;assert.throws(()=>s.runtime.syncTimelineCollisionShapes(),/SetShape no disponible/);assert.equal(s.nativeCalls.length,0);undo()
})
test('CS-13 · cápsula inválida detectada antes de enviar SetShape',()=>{
 const s=create();s.shapes[0].props.shape={type:'CapsuleShape3D',radius:.5,height:2};const undo=mark(s,0,'radius',2);assert.throws(()=>s.runtime.syncTimelineCollisionShapes(),/altura de la cápsula/);assert.equal(s.nativeCalls.length,0);undo()
})
test('CS-14 · transición de tipo restaura geometría original al stop',()=>{
 const s=create(),original=structuredClone(s.shapes[0]);const undo=mark(s,0,'type','SphereShape3D');assert.equal(effectiveCollisionShape(s.shapes[0],s.nodes.get('shape0')).props.shape.type,'SphereShape3D');s.runtime.syncTimelineCollisionShapes();undo();s.runtime.syncTimelineCollisionShapes();assert.deepEqual(s.shapes[0],original)
})
test('CS-15 · sourceId TriMesh se guarda con el catálogo original, sin convertirlo en transform',()=>{
 const s=shape('trimesh','b',{type:'TriMeshShape3D',sourceId:'m1'}),spec=nodeAnimationProperty(s,'collision.sourceId');assert.ok(spec);const tl=newTimeline('TriMesh',{duration:2});upsertTimelineNodePropertyKey(tl,s,'collision.sourceId','scene',[s],1,'m2');assert.equal(normalizeTimeline(tl).tracks[0].keys[0].v,'m2');assert.equal(s.props.shape.sourceId,'m1')
})
test('CS-16 · propiedades del Inspector y liberación inmediata en Timeline stop',()=>{
 const ui=source('src/components/Inspector.vue'),play=source('src/engine/runtime/events/play-timeline.js');for(const key of ['size','radius','height','disabled','type','sourceId']) assert.match(ui,new RegExp(`inspectorKeyable\\('collision\\.${key}'\\)`));assert.match(play,/rec\.prop\.startsWith\('collision\.'\)/);assert.match(play,/this\._nodeBodies\?\.syncTimelinePhysics\(\)/)
})
test('CS-17 · datos autorales y SceneGraph no reciben otro runtime paralelo',()=>{
 const src=source('src/engine/runtime/physics/node-bodies.js');assert.doesNotMatch(src,/new JoltWorld\(/);assert.match(src,/this\.syncTimelineCollisionShapes\(\)/);const jolt=source('src/engine/runtime/physics/jolt.js');assert.match(jolt,/this\.nodeBodyRuntime\?\.syncTimelinePhysics\(\)/)
})
test('CS-18 · CharacterVirtual no se recrea al cambiar cápsula: usa mismo propietario',()=>{
 const parent=obj('char','characterbody3d'),s=shape('s','char',{type:'CapsuleShape3D',radius:.5,height:2}),nodes=new Map([[parent.id,visual('char')],[s.id,visual('s')]]);const calls=[];const old={Release(){calls.push('oldRelease')}};const native={SetShape(){calls.push('SetShape');return true}};const world={disposed:false,jolt:{GetTempAllocator(){return {}}},bpFilter:{},objFilter:{},bodyFilter:{},shapeFilter:{}};const play={project:{objects:[parent,s]},ed:{nodes},phys:world,_nodeEnabled:()=>true};const owner=new Spatial(play,()=>{});owner.characters.set(parent.id,{obj:parent,node:nodes.get(parent.id),shape:old,character:native});const spec=nodeAnimationProperty(s,'collision.height');spec.apply(nodes.get(s.id),3,s);owner.syncTimelineCollisionShapes();assert.ok(calls.includes('SetShape'));assert.equal(owner.timelineCollisionValues.size,1)
})

test('CS-19 · Area3D sustituye su sensor original sin crear otra instancia',()=>{
 const parent=obj('area','area3d',{monitoring:true,monitorable:true}),s=shape('area-shape',parent.id,{type:'SphereShape3D',radius:.5}),nodes=new Map([[parent.id,visual(parent.id)],[s.id,visual(s.id)]])
 const calls=[],previous={Release(){calls.push('release-prev')}},fresh={Release(){calls.push('release-fresh')}}
 const bi={SetShape(){calls.push('SetShape')},RemoveBody(){calls.push('RemoveBody')},AddBody(){calls.push('AddBody')}}
 const play={project:{objects:[parent,s]},ed:{nodes},phys:{bi,disposed:false,J:{EActivation_DontActivate:0}},_nodeEnabled:()=>true}
 const owner=new Spatial(play,()=>({shape:fresh,owned:true}))
 const area={obj:parent,node:nodes.get(parent.id),active:true,id:{index:1},shape:previous,ownsShape:true,previous:new Map()}
 owner.areas.set(parent.id,area)
 nodeAnimationProperty(s,'collision.radius').apply(nodes.get(s.id),.8,s)
 owner.syncTimelineCollisionShapes()
 assert.deepEqual(calls,['SetShape','release-prev']);assert.equal(owner.areas.get(parent.id),area)
 assert.equal(area.shape,fresh)
})
test('CS-20 · Area3D sin forma temporal desactiva y restituye el mismo BodyID',()=>{
 const parent=obj('area','area3d',{monitoring:true,monitorable:true}),s=shape('area-shape',parent.id),nodes=new Map([[parent.id,visual(parent.id)],[s.id,visual(s.id)]])
 const calls=[];const bi={SetShape(){calls.push('set')},RemoveBody(){calls.push('remove')},AddBody(){calls.push('add')}}
 const play={project:{objects:[parent,s]},ed:{nodes},phys:{bi,J:{EActivation_DontActivate:0},disposed:false},_nodeEnabled:()=>true}
 const owner=new Spatial(play,()=>({shape:{Release(){}},owned:true}))
 const area={obj:parent,node:nodes.get(parent.id),active:true,id:{key:1},shape:{Release(){}},ownsShape:true,previous:new Map()}
 owner.areas.set(parent.id,area)
 const spec=nodeAnimationProperty(s,'collision.disabled'),saved=spec.capture(nodes.get(s.id),s)
 spec.apply(nodes.get(s.id),true,s)
 owner.syncTimelineCollisionShapes();assert.deepEqual(calls,['remove']);assert.equal(area.active,false)
 spec.restore(nodes.get(s.id),saved,s)
 owner.syncTimelineCollisionShapes();assert.deepEqual(calls,['remove','set','add']);assert.equal(area.active,true)
})
test('CS-21 · CharacterVirtual rechaza la cápsula penetrante sin perder Shape anterior',()=>{
 const parent=obj('char','characterbody3d'),s=shape('s','char',{type:'CapsuleShape3D',radius:.5,height:2}),nodes=new Map([[parent.id,visual('char')],[s.id,visual('s')]])
 let released=0;const previous={Release(){released++}},native={SetShape(){return false}}
 const world={disposed:false,jolt:{GetTempAllocator(){return {}}},bpFilter:{},objFilter:{},bodyFilter:{},shapeFilter:{}}
 const play={project:{objects:[parent,s]},ed:{nodes},phys:world,_nodeEnabled:()=>true}
 const owner=new Spatial(play,()=>{}),character={obj:parent,node:nodes.get(parent.id),shape:previous,character:native}
 owner.characters.set(parent.id,character)
 nodeAnimationProperty(s,'collision.radius').apply(nodes.get(s.id),.6,s)
 assert.throws(()=>owner.syncTimelineCollisionShapes(),/interpenetración/)
 assert.equal(character.shape,previous)
 assert.equal(released,0)
 assert.equal(owner.timelineCollisionValues.size,0)
})
test('CS-22 · desactivación temporal de CharacterVirtual suspende movimiento sin destruir su Shape',()=>{
 const parent=obj('char','characterbody3d'),s=shape('s','char',{type:'CapsuleShape3D',radius:.5,height:2}),nodes=new Map([[parent.id,visual('char')],[s.id,visual('s')]])
 const native={SetShape(){return true}},old={Release(){}}
 const play={project:{objects:[parent,s]},ed:{nodes},phys:{disposed:false,jolt:{GetTempAllocator(){return{}}},bpFilter:{},objFilter:{},bodyFilter:{},shapeFilter:{}},_nodeEnabled:()=>true}
 const owner=new Spatial(play,()=>{}),entry={obj:parent,node:nodes.get(parent.id),shape:old,character:native}
 owner.characters.set(parent.id,entry)
 const spec=nodeAnimationProperty(s,'collision.disabled'),saved=spec.capture(nodes.get(s.id),s)
 spec.apply(nodes.get(s.id),true,s);owner.syncTimelineCollisionShapes()
 assert.equal(entry.timelineCollisionDisabled,true)
 assert.match(source('src/engine/runtime/physics/node-spatial.js'),/c\.timelineCollisionDisabled/)
 spec.restore(nodes.get(s.id),saved,s);owner.syncTimelineCollisionShapes()
 assert.equal(entry.timelineCollisionDisabled,false)
})
test('CS-23 · sin forma Jolt no hay animación física especulativa y Player comparte runtime',()=>{
 const body=source('src/engine/runtime/physics/node-bodies.js'),player=source('src/engine/runtime/physics/jolt.js')
 assert.doesNotMatch(body,/new JoltWorld\(/)
 assert.match(body,/no tiene BodyID; Timeline no puede crear cuerpos implícitos/)
 assert.match(player,/this\.nodeBodyRuntime\?\.syncTimelinePhysics\(\)/)
 assert.match(source('src/engine/runtime/physics/node-spatial.js'),/this\.assembleShape\(entry\.node,enabled,true\)/)
})
