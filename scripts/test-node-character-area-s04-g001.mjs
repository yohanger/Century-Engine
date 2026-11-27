// LF-NODE-CHARACTER-AREA-S04-G001: contrato de autoría y adaptador.
// Los dobles NO acreditan la ejecución real de Jolt WASM ni del Player.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PHYSICS_BODY_TYPES, PHYSICS_SHAPE_PARENTS, newPhysicsShape } from '../src/engine/runtime/physics/shapes.js'
import { validateNodeTree, validateNodeParent } from '../src/engine/runtime/nodes/hierarchy.js'
const file = (p) => new URL('../' + p, import.meta.url)
const source = (p) => readFileSync(file(p), 'utf8')
const base = (id, type, props, parentId = null) => ({ id, name: id, type, parentId, visible: true,
  position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], props })
const character = (id = 'hero', parentId = null) => base(id, 'characterbody3d', {
  velocity: [1, 0, 0], maxSlopeAngle: 50, stepHeight: 0.35, floorSnap: 0.5, gravity: 9.81, mass: 80,
}, parentId)
const area = (id = 'zone', parentId = null) => base(id, 'area3d', { monitoring: true, monitorable: true }, parentId)
const shape = (id, parentId, kind = 'capsule') => base(id, 'collisionshape3d', {
  shape: newPhysicsShape(kind), disabled: false,
}, parentId)
const fixtures = () => [character(), shape('capsule', 'hero'), area(), shape('box', 'zone', 'box')]

for (const [name, nodes, good] of [
  ['personaje y área con forma válida', fixtures(), true],
  ['dos personajes independientes', [character('a'), shape('sa','a'), character('b'),shape('sb','b')],true],
  ['área con dos formas', [area(),shape('a','zone','box'),shape('b','zone','sphere')],true],
  ['cápsula con padre incorrecto', [base('root','node3d',{}),shape('s','root')],false],
  ['Character con dos cápsulas', [character(),shape('a','hero'),shape('b','hero')],false],
  ['Character con caja', [character(),shape('a','hero','box')],false],
  ['Character con cápsula desplazada', [character(),{...shape('a','hero'),position:[1,0,0]}],false],
  ['Area con Monitoring inválido', [{...area(),props:{monitoring:'yes',monitorable:true}}],false],
  ['Character con gravedad no válida', [{...character(),props:{...character().props,gravity:-1}}],false],
  ['Character con velocidad infinita', [{...character(),props:{...character().props,velocity:[Infinity,0,0]}}],false],
  ['Area con escala no uniforme', [{...area(),scale:[1,2,1]}],false],
  ['Area heredando escala', [base('root','node3d',{}),{...area(),parentId:'root'},shape('s','zone','box')].map(n=>n.id==='root'?{...n,scale:[2,1,1]}:n),false],
]) test(`CA-PLAN · ${name}`,()=>{
  if (good) assert.doesNotThrow(()=>validateNodeTree(nodes))
  else assert.throws(()=>validateNodeTree(nodes))
})

test('CA-01 · Shape parent admite CharacterBody3D y Area3D sin ampliar lista de cuerpos sólidos',()=>{
 assert.deepEqual([...PHYSICS_BODY_TYPES].sort(), ['rigidbody3d','staticbody3d'])
 assert.equal(PHYSICS_SHAPE_PARENTS.has('characterbody3d'),true)
 assert.equal(PHYSICS_SHAPE_PARENTS.has('area3d'),true)
})
test('CA-02 · reparent inválido es atómico',()=>{
 const nodes=fixtures(),before=JSON.stringify(nodes)
 assert.throws(()=>validateNodeParent([...nodes, base('visual','primitive',{})],'capsule','visual'),/hija directa/)
 assert.equal(JSON.stringify(nodes),before)
})
test('CA-03 · Visual y StaticBody siguen separados',()=>{
 assert.doesNotThrow(()=>validateNodeTree([base('mesh','primitive',{}),...fixtures()]))
})
test('CA-04 · registro e Inspector están conectados al sistema existente',()=>{
 assert.match(source('src/engine/runtime/nodes/physics.js'),/bodyDefinition\('characterbody3d'/)
 assert.match(source('src/engine/runtime/nodes/physics.js'),/bodyDefinition\('area3d'/)
 assert.match(source('src/components/Inspector.vue'),/data-testid="character-body-inspector"/)
 assert.match(source('src/components/Inspector.vue'),/data-testid="area3d-inspector"/)
 assert.match(source('src/core/commands.js'),/characterbody3d.*area3d/)
})
test('CA-05 · ciclo global intacto',()=>{
 assert.match(source('src/engine/runtime/physics/jolt.js'),/nodeSpatial\?\.tick\(dt\)/)
 assert.match(source('src/engine/runtime/physics/node-bodies.js'),/new NodeSpatialRuntime/)
 assert.match(source('src/engine/runtime/events/play-controls.js'),/this\._bodiesTick\(dt\)/)
})

// Reemplazo de imports solo en la prueba: mantiene el código real del adaptador sin Jolt/Three instalados.
const threeCode=`
export class Vector3 {
 constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}
 set(x,y,z){this.x=x;this.y=y;this.z=z;return this}
 copy(v){return this.set(v.x,v.y,v.z)}
 toArray(){return [this.x,this.y,this.z]}
}
export class Quaternion { constructor(x=0,y=0,z=0,w=1){this.x=x;this.y=y;this.z=z;this.w=w} }
`
const threeUri='data:text/javascript,'+encodeURIComponent(threeCode)
const virtualUri='data:text/javascript,'+encodeURIComponent(`
export function createVirtualCharacter(world, {position}) {
 const pos={x:position.x,y:position.y,z:position.z}; const velocity={x:0,y:0,z:0,GetY(){return this.y}};
 const instance={pos,velocity,GetGroundState(){return 0},GetGroundNormal(){return {GetY:()=>1}},
   GetGroundVelocity(){return {GetX:()=>0,GetY:()=>0,GetZ:()=>0}},
   SetLinearVelocity(v){velocity.x=v.x;velocity.y=v.y;velocity.z=v.z},
   GetLinearVelocity(){return velocity},
   ExtendedUpdate(dt){pos.x+=velocity.x*dt;pos.y+=velocity.y*dt;pos.z+=velocity.z*dt},
   GetPosition(){return {GetX:()=>pos.x,GetY:()=>pos.y,GetZ:()=>pos.z}},
   SetPosition(v){pos.x=v.x;pos.y=v.y;pos.z=v.z},
   GetCenterOfMassTransform(){return {character:true}},
 };
 return {character:instance,shape:{_char:true,Release(){world.released++}}}
}
`)
// El harness data: omite el arranque del Editor; registrar Area3D como ocurre en nodes/physics.js.
const { registerNode } = await import(file('src/engine/runtime/nodes/registry.js'))
registerNode({ type:'area3d',create:()=>({}),build:()=>({}),update:()=>{} })
const spatialCode=source('src/engine/runtime/physics/node-spatial.js')
  .replace("from 'three'", `from '${threeUri}'`)
  .replace("from './shapes.js'",`from '${file('src/engine/runtime/physics/shapes.js').href}'`)
  .replace("from '../nodes/registry.js'",`from '${file('src/engine/runtime/nodes/registry.js').href}'`)
  .replace("from './jolt-character.js'",`from '${virtualUri}'`)
const { spatialNodePlan, NodeSpatialRuntime }=await import('data:text/javascript,'+encodeURIComponent(spatialCode))
const { Vector3 } = await import(threeUri)
function fakes(objects = fixtures()) {
 let nextId=0
 const signals=[];const released=[];const ids=[]
 const nodes=new Map(objects.map(obj=>{
  const node={id:obj.id,parent:null,position:new Vector3(...obj.position),matrixWorld:{decompose(p,q,s){p.set(...obj.position);s.set(1,1,1)}},
    updateWorldMatrix(){},updateMatrixWorld(){},getWorldPosition(){return new Vector3(this.position.x,this.position.y,this.position.z)}}
  return [obj.id,node]
 }))
 for(const obj of objects) {const n=nodes.get(obj.id);if(obj.parentId)n.parent=nodes.get(obj.parentId)}
 const vec=()=>({Set(x,y,z){this.x=x;this.y=y;this.z=z}})
 const world={J:{EGroundState_OnGround:1,EGroundState_OnSteepGround:2,EGroundState_InAir:0,EActivation_DontActivate:0,destroy(o){released.push(o)}},
   byBody:new Map(),_hits:new Set(),released:0,disposed:false,
   tmp:{r:vec(),q:vec(),v:vec(),v2:vec()},update:{mWalkStairsStepUp:vec(),mStickToFloorStepDown:vec()},
   one:{},zero:{},collideSettings:{},collector:{},anyBp:{},objFilter:{kind:'objects'},sensorFilter:{kind:'sensors'},bodyFilter:{},shapeFilter:{},
   jolt:{GetTempAllocator(){return {}}},
   _body(){const id=++nextId;ids.push(id);return id},_key(id){return id},_free(h){released.push(h.id)},
   bi:{GetWorldTransform(id){return {id}},SetPositionAndRotation(){},AddBody(){},RemoveBody(){}},
   sys:{GetNarrowPhaseQuery(){return {CollideShape(...args){const filter=args[7];if(filter.kind==='objects')for(const id of world.hitBodies||[])world._hits.add(id)
     if(filter.kind==='sensors')for(const id of args[0]?._char ? world.hitCharacters||[] : world.hitAreas||[])world._hits.add(id)}}}},
 }
 const play={phys:world,project:{objects},ed:{nodes},colliders:[],_nodeEnabled:(obj)=>obj.active!==false}
 const assemble=(node,entries)=>({shape:{Release(){world.released++}},owned:true,volume:1})
 const runtime=new NodeSpatialRuntime(play,assemble)
 return {play,world,runtime,signals,released,ids,nodes}
}

test('CA-06 · plan no crea cuerpos desde primitivas visuales',()=>{
 const x=spatialNodePlan([...fixtures(),base('visual','primitive',{})])
 assert.deepEqual(x.map(v=>v.obj.id),['hero','zone'])
})
test('CA-07 · CharacterVirtual es individual por nodo; Area3D usa un sensor Jolt',()=>{
 const f=fakes();f.runtime.start()
 assert.equal(f.runtime.characters.size,1);assert.equal(f.runtime.areas.size,1)
 assert.equal(f.ids.length,1);assert.deepEqual([...f.world.byBody.values()], [{area:true,areaId:'zone'}])
 f.runtime.dispose();assert.deepEqual(f.released.filter(Number.isInteger),[f.ids[0]])
 assert.equal(f.world.released,2)
})
test('CA-08 · dos personajes no comparten estado ni usan world.char',()=>{
 const f=fakes([character('a'),shape('sa','a'),character('b'),shape('sb','b')]);f.runtime.start()
 f.runtime.setVelocity('a',[3,0,0]);f.runtime.tick(0.5)
 assert.equal(f.runtime.characterState('a').position[0],1.5)
 assert.equal(f.runtime.characterState('b').position[0],0.5)
 assert.deepEqual(f.runtime.characterState('a').velocity.slice(0,1),[3])
 f.runtime.dispose();assert.equal(f.world.released,2)
})
test('CA-09 · velocidad inválida se rechaza antes de actualizar estado',()=>{
 const f=fakes();f.runtime.start();const state=f.runtime.characterState('hero')
 assert.throws(()=>f.runtime.setVelocity('hero',[NaN,0,0]),/inválida/)
 assert.deepEqual(f.runtime.characterState('hero'),state);f.runtime.dispose()
})
test('CA-10 · área emite entrada y salida exactamente una vez',()=>{
 const f=fakes();f.runtime.start()
 let inCount=0,outCount=0
 f.runtime.onArea('zone','body_entered',()=>inCount++)
 f.runtime.onArea('zone','body_exited',()=>outCount++)
 f.world.byBody.set(87,{node:'Box'})
 f.world.hitBodies=[87]
 f.runtime.tick(0.016);f.runtime.tick(0.016)
 assert.equal(inCount,1);assert.equal(outCount,0)
 assert.equal(f.runtime.overlaps('zone').length,1)
 f.world.hitBodies=[];f.runtime.tick(0.016);f.runtime.tick(0.016)
 assert.equal(inCount,1);assert.equal(outCount,1)
 f.runtime.dispose()
})
test('CA-11 · apagar monitoring limpia overlap y genera salida una vez',()=>{
 const f=fakes();f.runtime.start()
 f.world.byBody.set(87,{node:'Crate'});f.world.hitBodies=[87]
 let exits=0;f.runtime.onArea('zone','body_exited',()=>exits++)
 f.runtime.tick(0.016);f.play.project.objects.find(o=>o.id==='zone').props.monitoring=false
 f.runtime.tick(0.016);f.runtime.tick(0.016)
 assert.equal(exits,1);assert.equal(f.runtime.overlaps('zone').length,0);f.runtime.dispose()
})
test('CA-12 · un área no se detecta a sí misma',()=>{
 const f=fakes();f.runtime.start();f.world.hitAreas=[1]
 f.runtime.tick(0.016);assert.deepEqual(f.runtime.overlaps('zone'),[])
 f.runtime.dispose()
})
test('CA-13 · señal desacoplable y limpieza idempotente',()=>{
 const f=fakes();f.runtime.start()
 let enters=0;const off=f.runtime.onArea('zone','body_entered',()=>enters++);off()
 f.world.byBody.set(90,{node:'Box'});f.world.hitBodies=[90];f.runtime.tick(0.016)
 assert.equal(enters,0)
 f.runtime.dispose();f.runtime.dispose();assert.deepEqual(f.released.filter(Number.isInteger),[1])
 assert.equal(f.world.byBody.has(1),false);assert.equal(f.runtime.characters.size,0)
})
test('CA-14 · sensor de Area3D es recurso Jolt, no geometría visual',()=>{
 const s=source('src/engine/runtime/physics/node-spatial.js')
 assert.match(s,/_body\(assembled\.shape, P, Q, false, true\)/)
 assert.doesNotMatch(s,/new JoltWorld|new THREE\.Mesh|new BodySet/)
})
test('CA-15 · dos Area3D notifican área entrada y salida sin duplicados',()=>{
 const objects=[area('a'),shape('sa','a','box'),area('b'),shape('sb','b','sphere')]
 const f=fakes(objects);f.runtime.start()
 let entered=0,exited=0
 f.runtime.onArea('a','area_entered',(evt)=>{assert.equal(evt.id,'b');entered++})
 f.runtime.onArea('a','area_exited',(evt)=>{assert.equal(evt.id,'b');exited++})
 f.world.hitAreas=[1,2];f.runtime.tick(0.016);f.runtime.tick(0.016)
 assert.equal(entered,1);assert.equal(exited,0)
 f.world.hitAreas=[];f.runtime.tick(0.016);f.runtime.tick(0.016)
 assert.equal(entered,1);assert.equal(exited,1)
 f.runtime.dispose()
})
test('CA-16 · Area3D monitorable=false no se reporta a otras áreas',()=>{
 const b=area('b');b.props.monitorable=false
 const f=fakes([area('a'),shape('sa','a','box'),b,shape('sb','b','box')]);f.runtime.start()
 f.world.hitAreas=[1,2];f.runtime.tick(0.016)
 assert.deepEqual(f.runtime.overlaps('a'),[])
 assert.deepEqual(f.runtime.overlaps('b'),[{type:'area',id:'a'}])
 f.runtime.dispose()
})
