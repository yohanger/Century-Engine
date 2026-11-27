import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PLAYER_DEFAULTS, PLAYER_PARAMS, MOVE_KEYS, clampPlayerField, normalizePlayer } from '../src/engine/runtime/database/player.js'
import { createFirstPersonResources } from '../src/core/templates/fps-player.js'

const read = path => readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
const source = read('src/engine/runtime/events/play-player.js')
const pickMove = c => Object.fromEntries(MOVE_KEYS.map(k=>[k,c[k]]))
const methods = new Function('THREE','DEG','MOVE_KEYS','PLAYER_PARAMS','clampPlayerField','pickMove','nodeEffectiveActive',
  `return (${source.slice(source.indexOf('export const playerMethods =')+'export const playerMethods ='.length)})`)(
  {},Math.PI/180,MOVE_KEYS,PLAYER_PARAMS,clampPlayerField,pickMove,()=>true)
function rig({shapeError=null}={}) {
  const authored={id:'scene-body',type:'characterbody3d',props:{stepHeight:.35}}
  const shape={id:'scene-capsule',type:'collisionshape3d',parentId:authored.id,props:{shape:{type:'CapsuleShape3D',height:2,radius:.45}}}
  const camera={id:'eye',type:'camera',parentId:authored.id}
  const character={obj:authored,node:{id:authored.id},velocity:[1,0,0]}
  const spatial={disposed:false,characters:new Map([[authored.id,character]]),changes:[],
    characterState:()=>({velocity:[1,0,0],ground:'stable',onFloor:true}),
    configurePlayerShape(id,cfg){this.changes.push({id,cfg:{...cfg}});if(shapeError)throw shapeError}}
  const db=normalizePlayer({walk:6.5,run:11,groundAccel:35,jumpHeight:2,jumpTime:.5,sensitivity:1.3})
  const original=JSON.parse(JSON.stringify(db))
  const cameraNode={position:{y:.65},updateMatrixWorld() {}}
  const self=Object.create(methods)
  Object.assign(self,{on:true,_referenceSession:{},_nativePlayerId:authored.id,project:{activeSceneId:'one',objects:[authored,shape,camera]},
    ed:{nodes:new Map([[authored.id,character.node],[camera.id,cameraNode]])},phys:{nodeSpatial:spatial},
    game:{db:{player:db},party:{actors:{}}},g:pickMove(db),
    player:{body:{height:2,radius:.45,stepHeight:.35},applyConfig(){},api(){return {legacy:true}}},
    _nodeEnabled:()=>true,_nodeHandle:id=>({id}),
    _scenePlayerDecision:()=>({kind:'native'}),_playerMode:()=> 'free',_eyeRay:()=>({origin:[0,0,0],dir:[0,0,-1]}),
    _textCtx:()=>({actor:()=> 'Personaje'}),control:true,surfaceAt:()=> 'stone'})
  return {self,db,spatial,original,cameraNode}
}
function scriptRig(config={}) {
  const input={down:{},vector:()=>({x:0,y:1}),pressed:name=>!!input.down[name],justPressed:name=>!!input.down[name]}
  const body={id:'body',velocity:[0,0,0],rotation:[0,0,0],onFloor:true}
  const player={...normalizePlayer({...config}),node:{id:body.id},get ground(){return body.onFloor?'stable':'air'},control:true,mode:'free'}
  const game={input,level:{speedScale:1,canRun:true,canJump:true},get player(){return player}}
  const src=read('scripts/fixtures/fps/s16-g004-locomotion-node.js')
  const runner=new Function('game','node',`${src}\nreturn {ready:_ready,frame:_process,physics:_physics_process}`)(game,body)
  runner.ready()
  return {game,player,body,input,runner}
}
const nearly=(x,y)=>assert.ok(Math.abs(x-y)<1e-5,`${x} != ${y}`)

test('DBN-01: usa valores normalizados del registro Jugador sin inventar defaults',()=>{
  const {self,db}=rig();const api=self._playerApi()
  assert.equal(api.walk,db.walk);assert.equal(api.run,11);assert.equal(api.groundAccel,35)
  assert.equal(api.jumpHeight,2);assert.equal(api.sensitivity,1.3)
  assert.equal(api.height,db.height);assert.equal(api.stepHeight,db.stepHeight)
})
test('DBN-02: mutación game.player.walk actualiza solo el registro runtime y pm.g',()=>{
  const {self,db,spatial,original}=rig();const api=self._playerApi()
  api.walk=7.25;assert.equal(db.walk,7.25);assert.equal(self.g.walk,7.25)
  assert.equal(original.walk,6.5);assert.equal(spatial.changes.length,1)
})
test('DBN-03: validación numérica reutiliza clampPlayerField de Database',()=>{
  const {self,db}=rig();self._playerApi().walk=999
  assert.equal(db.walk,clampPlayerField('walk',999));assert.equal(self.g.walk,db.walk)
})
test('DBN-04: booleanos existentes se mantienen booleanos',()=>{
  const {self,db}=rig();self._playerApi().jumpAuto=false
  assert.equal(db.jumpAuto,false);assert.equal(self.g.jumpAuto,false)
})
test('DBN-05: rechaza valores inválidos sin alterar Database runtime',()=>{
  const {self,db}=rig();const before=JSON.stringify(db)
  assert.throws(()=>{self._playerApi().walk=NaN},/valor inválido/)
  assert.equal(JSON.stringify(db),before)
})
test('DBN-06: cápsula imposible no muta el registro de sesión',()=>{
  const {self,db}=rig();const before=JSON.stringify(db)
  assert.throws(()=>{self._playerApi().radius=1},/altura debe ser/)
  assert.equal(JSON.stringify(db),before)
})
test('DBN-07: fallo Jolt devuelve la operación sin mutar Database ni pm.g',()=>{
  const {self,db}=rig({shapeError:new Error('Jolt sin SetShape')});const before=JSON.stringify(db),old=self.g.walk
  assert.throws(()=>{self._playerApi().walk=9},/Jolt sin SetShape/)
  assert.equal(JSON.stringify(db),before);assert.equal(self.g.walk,old)
})
test('DBN-08: eyeHeight cambia Camera3D del jugador sin editar el descriptor',()=>{
  const {self,db,cameraNode}=rig();const src=JSON.stringify(self.project.objects)
  self._playerApi().eyeHeight=1.4
  assert.equal(cameraNode.position.y,1.4);assert.equal(db.eyeHeight,1.4)
  assert.equal(JSON.stringify(self.project.objects),src)
})
test('DBN-09: movimiento del prefab consume walk/run de Database durante el mismo Play',()=>{
  const {player,body,runner,input}=scriptRig({walk:2,run:8,groundAccel:80})
  for(let i=0;i<60;i++)runner.physics(1/60)
  nearly(body.velocity[2],-2)
  player.walk=5
  for(let i=0;i<60;i++)runner.physics(1/60)
  nearly(body.velocity[2],-5)
  input.down.run=true
  for(let i=0;i<60;i++)runner.physics(1/60)
  nearly(body.velocity[2],-8)
})
test('DBN-10: el salto automático utiliza altura/tiempo de Database',()=>{
  const {body,runner,input}=scriptRig({jumpAuto:true,jumpHeight:1.8,jumpTime:.3})
  input.down.jump=true;runner.frame();runner.physics(1/60)
  nearly(body.velocity[1],12)
})
test('DBN-11: no controla cuerpos que no son game.player.node',()=>{
  const {game,input}=scriptRig({walk:10});const other={id:'npc',velocity:[0,0,0],onFloor:true,rotation:[0,0,0]}
  const code=read('scripts/fixtures/fps/s16-g004-locomotion-node.js')
  const npc=new Function('game','node',`${code}\nreturn {ready:_ready,physics:_physics_process}`)(game,other)
  npc.ready();npc.physics(1/60)
  assert.deepEqual(other.velocity,[0,0,0])
})
test('DBN-12: template utiliza mismo código que los tres recursos de prueba G004-G006',()=>{
  let id=0
  const mk=(_type,_kind,extra)=>({type:_type,props:{},position:[0,0,0],...extra})
  const {scripts,prefabs}=createFirstPersonResources({uid:(prefix='')=>prefix+ ++id,makeObject:mk})
  for(let i=0;i<3;i++)assert.equal(scripts[i].code,read('scripts/fixtures/fps/'+['s16-g004-locomotion-node.js','s16-g005-native-camera-node.js','s16-g006-native-interaction-node.js'][i]))
  const body=prefabs[0].objects.find(o=>o.type==='characterbody3d')
  const camera=prefabs[0].objects.find(o=>o.type==='camera')
  nearly(body.position[1],0);nearly(camera.position[1],PLAYER_DEFAULTS.eyeHeight)
})
test('DBN-13: la física diferencia jugador nativo del resto',()=>{
  const spatial=read('src/engine/runtime/physics/node-spatial.js')
  assert.match(spatial,/const playerConfig = c\.obj\.id === this\.play\._nativePlayerId \? this\.play\.g : null/)
  assert.match(spatial,/fallMultiplier = playerConfig && v\[1\] < 0 \? playerConfig\.fallGravity : 1/)
  assert.match(spatial,/configurePlayerShape\(id, cfg\)/)
})
test('DBN-14: PlayMode aplica configuración tras Jolt y antes de validación final',()=>{
  const p=read('src/engine/runtime/events/play.js')
  assert.ok(p.indexOf('this._bodiesInit()')<p.indexOf('this._nativePlayerConfigApply()'))
  const spawn=read('src/engine/runtime/events/play-player.js')
  assert.match(spawn,/this\._nativePlayerConfigApply\(\)\s*this\.hasPlayer = true/)
})
test('DBN-15: la Camera3D conserva prioridad externa y solo FOV del personaje nativo en base',()=>{
  const s=read('src/engine/runtime/events/play-camera.js')
  assert.match(s,/playerCamera && mc\.node\?\.userData\?\.timelineFov == null/)
  assert.match(s,/setCameraFov\(cam, authorFov, 'vertical'\)/)
  assert.match(s,/this\._cameraAcquire\(/)
})

test('DBN-16: reemplazo de cápsula conserva CharacterVirtual y libera la forma anterior',()=>{
  const spatial=read('src/engine/runtime/physics/node-spatial.js')
  const start=spatial.indexOf('  configurePlayerShape(id, cfg) {')
  const block=spatial.slice(start,spatial.indexOf('  /** Permite a un futuro script',start))
  let oldReleases=0,newReleases=0,calls=0
  const oldShape={Release(){oldReleases++}},replacement={Release(){newReleases++}}
  const fn=new Function('createVirtualCharacterShape',`return ({${block}}).configurePlayerShape`)(()=>replacement)
  const character={SetShape(){calls++;return true}}
  const world={disposed:false,bpFilter:{},objFilter:{},bodyFilter:{},shapeFilter:{},jolt:{GetTempAllocator:()=>({})}}
  const body={character,shape:oldShape}
  const owner={disposed:false,play:{phys:world},characters:new Map([['player',body]])}
  fn.call(owner,'player',{height:1.8,radius:.32})
  assert.equal(body.character,character);assert.equal(body.shape,replacement)
  assert.equal(oldReleases,1);assert.equal(newReleases,0);assert.equal(calls,1)
  fn.call(owner,'player',{height:1.8,radius:.32})
  assert.equal(calls,1)
})
test('DBN-17: Jolt rechaza la forma: libera reemplazo y mantiene CharacterVirtual',()=>{
  const spatial=read('src/engine/runtime/physics/node-spatial.js')
  const start=spatial.indexOf('  configurePlayerShape(id, cfg) {')
  const block=spatial.slice(start,spatial.indexOf('  /** Permite a un futuro script',start))
  let oldReleases=0,newReleases=0
  const oldShape={Release(){oldReleases++}},replacement={Release(){newReleases++}}
  const fn=new Function('createVirtualCharacterShape',`return ({${block}}).configurePlayerShape`)(()=>replacement)
  const character={SetShape(){return false}}
  const world={disposed:false,bpFilter:{},objFilter:{},bodyFilter:{},shapeFilter:{},jolt:{GetTempAllocator:()=>({})}}
  const body={character,shape:oldShape}
  const owner={disposed:false,play:{phys:world},characters:new Map([['player',body]])}
  assert.throws(()=>fn.call(owner,'player',{height:1.8,radius:.32}),/interpenetración/)
  assert.equal(body.shape,oldShape);assert.equal(body.character,character)
  assert.equal(oldReleases,0);assert.equal(newReleases,1)
})
test('DBN-18: la fuente Database se conserva al crear el registro runtime',()=>{
  const authored={walk:12,run:15,jumpAuto:false,jump:7.2}
  const frozen=JSON.stringify(authored)
  const session=normalizePlayer(authored)
  session.walk=3
  assert.equal(JSON.stringify(authored),frozen)
  assert.equal(PLAYER_DEFAULTS.walk,4.3)
})
