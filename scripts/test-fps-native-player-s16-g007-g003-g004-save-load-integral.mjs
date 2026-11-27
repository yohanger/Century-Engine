// S16-G007-G003-G004 · QA Node por aislamiento de PlayMode: Jolt WASM y Electron son QA local.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SaveManager, MemoryStorage } from '../src/engine/runtime/events/saves.js'
import { nodeEffectiveActive } from '../src/engine/runtime/nodes/hierarchy.js'
import { sceneGameConfig } from '../src/engine/runtime/game-manager.js'

const read = path => readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
const DEG=Math.PI/180
const decSrc=read('src/engine/runtime/events/play.js')
const decSlice=decSrc.slice(decSrc.indexOf('  _scenePlayerDecision() {'),decSrc.indexOf('  // Una sola resolución por escena:'))
const decision=new Function('resolveScenePlayerNode',`return ({${decSlice.replace('\n  _scenePlayerSelect()',',\n  _scenePlayerSelect()')}})`)((scene,objects)=>{
  if(!scene?.playerNodeId)return {status:'unassigned',id:''}
  const obj=objects.find(o=>o.id===scene.playerNodeId)
  return obj?.type==='characterbody3d'?{status:'valid',id:obj.id}:{status:obj?'wrong-type':'missing',id:scene.playerNodeId}
})
const projectText=read('src/core/project.js')
let seq=0
const prefabSource=projectText.slice(projectText.indexOf('export function materializePrefab('),projectText.indexOf('/** Normaliza la autoría'))
const materializePrefab=new Function('uid','migrateNodeScripts','remapSignalConnections','validateNodeTree',`${prefabSource.replace('export function materializePrefab','function materializePrefab')}\nreturn materializePrefab`)(
  ()=>`temp-${++seq}`,o=>{o.scriptIds??=[];delete o.scriptId;return o},()=>[],()=>{})
const nodeText=read('src/engine/runtime/events/play-nodes.js')
const nodes=new Function('THREE','materializePrefab','guardedDescriptors',`return (${nodeText.slice(nodeText.indexOf('export const nodesMethods =')+'export const nodesMethods ='.length)})`)(
  {Vector3:class {constructor(...args){this.args=args}toArray(){return this.args}applyMatrix4(){return this}}},materializePrefab,()=>({}))
const playerText=read('src/engine/runtime/events/play-player.js')
const players=new Function('THREE','DEG','nodeEffectiveActive','MOVE_KEYS','PLAYER_PARAMS','clampPlayerField','pickMove',
  `return (${playerText.slice(playerText.indexOf('export const playerMethods =')+'export const playerMethods ='.length)})`)(
  {},DEG,nodeEffectiveActive,[],[],()=>{},()=>({}))
const savesText=read('src/engine/runtime/events/play-saves.js')
const worldMethods=new Function('KeyedStorageBackend','DEG','sceneGameConfig',
  `return (${savesText.slice(savesText.indexOf('export const saveMethods =')+'export const saveMethods ='.length)})`)(
  class {},DEG,sceneGameConfig)
function prefab(){return {id:'fps-pf',name:'Personaje FPS',rev:3,objects:[
  {id:'r',name:'FPS',type:'node3d',parentId:null,position:[0,0,0],active:true},
  {id:'b',name:'CharacterBody',type:'characterbody3d',parentId:'r',position:[0,1,0],active:true},
  {id:'item',name:'Lámpara de bolsillo',type:'node3d',parentId:'b',position:[0,1,0],active:true},
],signalConnections:[]}}
function rig({mode='api',sceneId='scene-a',throwAttach=null}={}){
  const scene={id:sceneId,name:sceneId,...(mode==='api'?{playerSpawnMode:'api'}:mode==='native'?{playerNodeId:'fixed-body'}:{})}
  const fixed={id:'fixed-body',name:'Jugador',type:'characterbody3d',parentId:null,active:true}
  const project={scenes:[scene],activeSceneId:sceneId,objects:[{id:'floor',name:'Suelo',type:'node3d',parentId:null},
    {id:'chest',name:'Cofre',type:'node3d',parentId:null},...(mode==='native'?[fixed]:[])],
    prefabs:[prefab()],signalConnections:[],game:{player:mode==='none'?'none':'fps'}}
  const map=new Map(project.objects.map(o=>[o.id,{_lfNodeOwner:o}]))
  const characters=new Map();let detached=0,attached=0
  const spatial={characters,disposed:false,
    characterState:id=>({velocity:characters.get(id)?.velocity || [0,0,0]}),
    setVelocity(id,v){characters.get(id).velocity=[...v]}}
  const phys={nodeSpatial:spatial,nodeBodyRuntime:{
    attach(ids){attached++;if(throwAttach)throw throwAttach;for(const o of project.objects){if(o.type!=='characterbody3d'||!ids.has(o.id))continue;characters.set(o.id,{obj:o,node:map.get(o.id),velocity:[0,0,0]})}},
    detach(ids){detached++;for(const id of ids)characters.delete(id)},
  }}
  const ed={nodes:map,_syncingAll:false,world:{timeOn:false,weatherOn:false,hour:0,flow:false,preset:'clear',intensity:0,field:null,tornado:null},
    nodeLifecycle:{scripts:null,beginRemoval(){},endRemoval(){},sync(){}},
    syncObject(id){map.set(id,{_lfNodeOwner:project.objects.find(o=>o.id===id)})},removeObject(id){map.delete(id)}}
  const proto={};for(const mixin of [decision,nodes,players,worldMethods])Object.defineProperties(proto,Object.getOwnPropertyDescriptors(mixin))
  const play=Object.create(proto)
  let position=[4,2,1],yaw=45*DEG,pitch=15*DEG
  Object.defineProperties(play,{
    pos:{configurable:true,get:()=>({x:position[0],y:position[1],z:position[2],toArray:()=>[...position]})},
    yaw:{configurable:true,get:()=>yaw,set:v=>{yaw=v}},pitch:{configurable:true,get:()=>pitch,set:v=>{pitch=v}},
  })
  const tracker={spawn:0,destroy:0,vmSetup:0,vmTeardown:0,gpRestore:0,events:[],calls:[],get attached(){return attached},get detached(){return detached}}
  const basePlayer={vm:null,constructor:{embodied:mode==='legacy'},pos:{set(){}},api:()=>({})}
  const game={db:{player:{}},state:{},_nativeSignalsMuted:false,report:(err,label)=>tracker.calls.push(['report',label,err.message])}
  Object.assign(play,{project,on:true,film:null,g:{player:mode==='none'?'none':'fps'},player:basePlayer,ed,phys,
    game,events:[],state:{player:false},hasPlayer:mode==='native'||mode==='legacy',
    _nativePlayerId:mode==='native'?'fixed-body':null,_nativePlayerIssue:null,_referenceSession:{},
    _runtimePrefabInstances:new Map(),_nodeEnabled:o=>nodeEffectiveActive(project.objects,o),_tagLayerApi:()=>({}),
    _animMethodsFor:()=>({}), _nativePlayerConfigApply:()=>true,
    _nodeHandle(id){return {id,is_valid:()=>map.has(id)}},
    _nativePositionSet(v){position=Array.isArray(v)?[...v]:v.toArray()},
    _rememberEventPhysics(){},_gpCapture(){},_gpRestore(){tracker.gpRestore++},_restoreEventPhysics(){},
    _destructionSnapshot:()=>null,_liquidViews:[],_waterConnection:null,water:{snapshot:()=>({}),suspensionEnabled:false},
    _vmSetup(){tracker.vmSetup++;basePlayer.vm={held:new Map(),stash:new Map()}},
    _vmTeardown(){tracker.vmTeardown++;basePlayer.vm=null},
    _gpReady(){},
    async _gotoScene({scene,...options}){tracker.calls.push(['goto',scene,options]);if(scene!==project.activeSceneId){
      this._prefabClearRuntime();project.activeSceneId=scene;this._nativePlayerId=null;this.hasPlayer=false;this._vmTeardown()
    }else if(options.pos){position=[...options.pos]}},
    _teleport({pos}){if(pos)position=[...pos]},
    viewModelStash({target}){tracker.calls.push(['stash',target]);basePlayer.vm?.stash.set(target,{id:target})},
    async viewModelAttach({target,slot,emit}){tracker.calls.push(['held',target,slot,emit]);basePlayer.vm?.held.set(target,{id:target,slot})},
  })
  if(mode==='native') characters.set('fixed-body',{obj:fixed,node:map.get('fixed-body'),velocity:[1,0,0]})
  const originalSpawn=play._spawnPlayer.bind(play)
  play._spawnPlayer=(...args)=>{tracker.spawn++;return originalSpawn(...args)}
  const originalDestroy=play._prefabDestroy.bind(play)
  play._prefabDestroy=(...args)=>{tracker.destroy++;return originalDestroy(...args)}
  return {play,project,tracker,map,characters,game,position:()=>[...position]}
}
function currentPlayerOwner(play){return [...play._runtimePrefabInstances.values()].find(o=>o.ids.has(play._nativePlayerId))}

test('SAVE-01: Spawn Player se guarda con Prefab estable, revisión y sin IDs temporales',()=>{
  const {play,project}=rig();play._spawnPlayer('fps-pf')
  const root=currentPlayerOwner(play).rootId
  const world=play.captureWorld()
  assert.deepEqual(world.player,{mode:'api',prefabId:'fps-pf',prefabRev:3,velocity:[0,0,0]})
  assert.deepEqual(world.pos,[4,2,1]);assert.ok(Math.abs(world.yaw-45)<1e-9);assert.ok(Math.abs(world.pitch-15)<1e-9)
  assert.ok(!JSON.stringify(world).includes(root));assert.equal(project.scenes[0].playerNodeId,undefined)
})
test('SAVE-02: modo API sin Spawn conserva ausencia real',async()=>{
  const {play,project}=rig();const world=play.captureWorld();assert.deepEqual(world.player,{mode:'api',prefabId:null})
  play._restorePlayerSnapshot(world.player,world)
  assert.equal(play._nativePlayerId,null);assert.equal(project.objects.length,2)
})
test('SAVE-03: carga en la misma escena reconstruye UNA instancia y aplica pose/velocidad antes de objetos',async()=>{
  const {play,tracker,position,project,characters}=rig()
  play._spawnPlayer('fps-pf');const old=currentPlayerOwner(play).rootId
  const saved=play.captureWorld();saved.pos=[8,3,-6];saved.yaw=90;saved.pitch=-10;saved.player.velocity=[4,1,2]
  const rootContents=JSON.stringify(project.prefabs[0]);const before=project.objects.length
  await play.restoreWorld(saved)
  const current=currentPlayerOwner(play)
  assert.ok(current);assert.notEqual(current.rootId,old);assert.equal(project.objects.length,before)
  assert.equal(tracker.spawn,2);assert.equal(tracker.destroy,1)
  assert.deepEqual(position(),[8,3,-6]);assert.equal(play.yaw,Math.PI/2);assert.equal(play.pitch,-10*DEG)
  assert.deepEqual(characters.get(play._nativePlayerId).velocity,[4,1,2])
  assert.equal(tracker.gpRestore,1);assert.equal(JSON.stringify(project.prefabs[0]),rootContents)
})
test('SAVE-04: repetir load no acumula CharacterBody3D ni ViewModel',async()=>{
  const {play,tracker,project,characters}=rig();play._spawnPlayer('fps-pf');const saved=play.captureWorld()
  await play.restoreWorld(saved);await play.restoreWorld(saved);await play.restoreWorld(saved)
  assert.equal(project.objects.filter(o=>o.type==='characterbody3d').length,1)
  assert.equal(characters.size,1);assert.equal(tracker.spawn,4);assert.equal(tracker.destroy,3)
  assert.equal(play.hasPlayer,true);assert.equal(play.state.player,true)
})
test('SAVE-05: restaurar un save sin jugador retira el Spawn actual',async()=>{
  const {play,characters,project}=rig();const empty=play.captureWorld()
  play._spawnPlayer('fps-pf');assert.ok(play._nativePlayerId)
  await play.restoreWorld(empty)
  assert.equal(play._nativePlayerId,null);assert.equal(play.hasPlayer,false);assert.equal(characters.size,0)
  assert.equal(project.objects.filter(o=>o.type==='characterbody3d').length,0)
})
test('SAVE-06: al cargar nuevo Save se invalidan handles anteriores',async()=>{
  const {play}=rig();const handle=play._spawnPlayer('fps-pf'),saved=play.captureWorld()
  await play.restoreWorld(saved)
  assert.equal(handle.is_valid(),false)
  assert.ok(play._nativePlayerId)
})
test('SAVE-07: JSON de manos y stash del Prefab usa índices autorales, sin IDs efímeros',()=>{
  const {play}=rig();play._spawnPlayer('fps-pf')
  const owner=currentPlayerOwner(play),itemId=owner.objects[2].id
  play.vm.held.set(itemId,{id:itemId,slot:'right'})
  const snap=play.captureWorld();assert.deepEqual(snap.held,[{id:{playerPrefabNode:'item'},slot:'right'}])
  assert.equal(JSON.stringify(snap).includes(itemId),false)
  play.vm.held.delete(itemId);play.vm.stash.set(itemId,{id:itemId})
  assert.deepEqual(play.captureWorld().stashed,[{playerPrefabNode:'item'}])
})
test('SAVE-08: restauración resuelve manos con nuevos IDs, sin duplicar emisión',async()=>{
  const {play,tracker}=rig();play._spawnPlayer('fps-pf')
  const owner=currentPlayerOwner(play),id=owner.objects[2].id
  play.vm.held.set(id,{id,slot:'left'})
  const saved=play.captureWorld()
  await play.restoreWorld(saved)
  const newId=currentPlayerOwner(play).objects[2].id
  assert.notEqual(newId,id)
  assert.deepEqual(tracker.calls.filter(x=>x[0]==='held'),[['held',newId,'left',false]])
})
test('SAVE-09: stash se restaura al objeto reconstruido, no al ID anterior',async()=>{
  const {play,tracker}=rig();play._spawnPlayer('fps-pf')
  const id=currentPlayerOwner(play).objects[2].id;play.vm.stash.set(id,{id})
  await play.restoreWorld(play.captureWorld())
  assert.deepEqual(tracker.calls.filter(x=>x[0]==='stash'),[['stash',currentPlayerOwner(play).objects[2].id]])
})
test('SAVE-10: IDs de mundo autorales permanecen sin transformaciones',()=>{
  const {play}=rig();assert.equal(play._saveViewModelRef('chest'),'chest')
  assert.equal(play._restoreViewModelRef('chest'),'chest')
})
test('SAVE-11: guardar referencias a otros Prefabs dinámicos falla explícitamente',()=>{
  const {play}=rig();play._spawnPlayer('fps-pf')
  play._runtimePrefabInstances.set('other',{scene:'scene-a',rootId:'other',ids:new Set(['foreign']),objects:[{id:'foreign'}]})
  assert.throws(()=>play._saveViewModelRef('foreign'),/no persistible/)
})
test('SAVE-12: preflight detecta Prefab eliminado ANTES de cambiar Game/Party',async()=>{
  const {play,project,game}=rig();play._spawnPlayer('fps-pf')
  const world=play.captureWorld();project.prefabs=[]
  assert.throws(()=>play._validateWorldRestore(world),/Prefab del jugador ausente/)
  const mgrGame={db:{player:{}},party:{members:[],gold:0,inv:{},actors:{},journal:{},enemies:{},nextEnemyId:1,ctx:{}},
    sw:{},vr:{},selfSw:{},dyn:{},state:{keep:123},time:0,rev:0,report(){},emit:async()=>{}}
  const save=new SaveManager(mgrGame),storage=new MemoryStorage();save.useStorage(storage)
  mgrGame.host={validateWorldRestore:w=>play._validateWorldRestore(w),restoreWorld:w=>play.restoreWorld(w)}
  storage.set(1,{game:{state:{keep:999}},world})
  await assert.rejects(save.load(1),/Prefab del jugador ausente/)
  assert.equal(mgrGame.state.keep,123);assert.equal(save.busy,false)
  assert.ok(game)
})
test('SAVE-13: preflight rechaza revisión distinta del Prefab',()=>{
  const {play,project}=rig();play._spawnPlayer('fps-pf');const saved=play.captureWorld()
  project.prefabs[0].rev=4
  assert.throws(()=>play._validateWorldRestore(saved),/revisión distinta/)
})
test('SAVE-14: preflight rechaza modos de escena incompatibles, sin fallback FPS',()=>{
  const {play,project}=rig();play._spawnPlayer('fps-pf');const w=play.captureWorld()
  delete project.scenes[0].playerSpawnMode
  assert.throws(()=>play._validateWorldRestore(w),/incompatible con Spawn Player/)
})
test('SAVE-15: Spawn API directa es rechazada durante load, salvo restaurador autorizado',()=>{
  const {play,project}=rig();play._restoringPhysical=true
  assert.throws(()=>play._spawnPlayer('fps-pf'),/carga ya está reconstruyendo/)
  assert.equal(project.objects.length,2)
})
test('SAVE-16: Jolt falla durante reconstrucción sin dejar personaje parcial',async()=>{
  const {play,project,characters}=rig();play._spawnPlayer('fps-pf');const saved=play.captureWorld()
  const original=play.phys.nodeBodyRuntime.attach
  play.phys.nodeBodyRuntime.attach=()=>{throw new Error('Jolt offline')}
  await assert.rejects(play.restoreWorld(saved),/Jolt offline/)
  play.phys.nodeBodyRuntime.attach=original
  assert.equal(play._nativePlayerId,null)
  assert.equal(project.objects.length,2)
  assert.equal(characters.size,0)
})
test('SAVE-17: CharacterBody3D autoral no se recrea, usa su ID estable',async()=>{
  const {play,tracker,characters}=rig({mode:'native'})
  const saved=play.captureWorld();assert.deepEqual(saved.player,{mode:'native',nodeId:'fixed-body',velocity:[1,0,0]})
  saved.pos=[1,9,2];await play.restoreWorld(saved)
  assert.equal(play._nativePlayerId,'fixed-body');assert.equal(characters.size,1)
  assert.equal(tracker.spawn,0);assert.equal(tracker.destroy,0)
})
test('SAVE-18: legado no genera Prefab nuevo y conserva estructura de saves',async()=>{
  const {play,tracker}=rig({mode:'legacy'});const snap=play.captureWorld()
  assert.equal(snap.player.mode,'none')
  await play.restoreWorld(snap)
  assert.equal(tracker.spawn,0)
  assert.equal(snap.scene,'scene-a')
})
test('SAVE-19: partidas antiguas sin campo player conservan restauración básica',async()=>{
  const {play,tracker}=rig({mode:'legacy'});const snap=play.captureWorld();delete snap.player
  await play.restoreWorld(snap)
  assert.equal(tracker.spawn,0);assert.equal(tracker.gpRestore,1)
})
test('SAVE-20: preflight respeta escena Sin jugador y desconoce modos inválidos',()=>{
  const {play}=rig({mode:'none'});const world=play.captureWorld();assert.equal(world.player.mode,'none')
  assert.equal(play._validateWorldRestore(world).mode,'none')
  assert.throws(()=>play._validateWorldRestore({...world,player:{mode:'xyz'}}),/modalidad de jugador desconocida/)
})
test('SAVE-21: SaveManager integra preflight antes del estado lógico, sin cambiar versión',()=>{
  const source=read('src/engine/runtime/events/saves.js')
  assert.match(source,/await this\.host\.validateWorldRestore\?\.\(d\.world \|\| \{\}\)\s*this\.restore\(d\.game\)/)
  assert.match(source,/SAVE_VERSION = 1/)
  assert.match(read('src/engine/runtime/events/play-host.js'),/validateWorldRestore: alive/)
})
test('SAVE-22: no existe serialización de nodos transitorios al proyecto autoral',()=>{
  const {play,project}=rig();const original=JSON.stringify(project.prefabs[0]),scenes=JSON.stringify(project.scenes)
  play._spawnPlayer('fps-pf');const w=play.captureWorld();play._prefabClearRuntime()
  assert.equal(JSON.stringify(project.prefabs[0]),original);assert.equal(JSON.stringify(project.scenes),scenes)
  assert.equal(w.player.prefabId,'fps-pf');assert.ok(!('nodeId' in w.player))
})

test('SAVE-23: preflight rechaza nodo interno de Prefab fuera de rango',()=>{
  const {play}=rig();play._spawnPlayer('fps-pf')
  const w=play.captureWorld();w.held=[{id:{playerPrefabNode:'unlisted'},slot:'right'}]
  assert.throws(()=>play._validateWorldRestore(w),/referencia interna del Prefab/)
})
test('SAVE-24: partida sin jugador no acepta objetos sostenidos',()=>{
  const {play}=rig();const w=play.captureWorld();w.held=[{id:'chest',slot:'right'}]
  assert.throws(()=>play._validateWorldRestore(w),/sin jugador no puede contener/)
})
test('SAVE-25: fallo después del montaje físico revierte el nuevo jugador',async()=>{
  const {play,project,characters}=rig();play._spawnPlayer('fps-pf')
  const saved=play.captureWorld();saved.player.velocity=[2,1,0]
  const original=play.phys.nodeSpatial.setVelocity
  play.phys.nodeSpatial.setVelocity=()=>{throw new Error('Error de Jolt al restaurar velocidad')}
  await assert.rejects(play.restoreWorld(saved),/Error de Jolt al restaurar velocidad/)
  play.phys.nodeSpatial.setVelocity=original
  assert.equal(play._nativePlayerId,null);assert.equal(characters.size,0)
  assert.equal(project.objects.length,2)
})
test('SAVE-26: fallo de restauración ambiental después del Spawn retira la instancia nueva',async()=>{
  const {play,project}=rig();play._spawnPlayer('fps-pf')
  const w=play.captureWorld();w.water={requiresWater:true}
  await assert.rejects(play.restoreWorld(w),/esta partida exige una escena con agua física/)
  assert.equal(play._nativePlayerId,null);assert.equal(project.objects.length,2)
})
test('SAVE-27: referencias de Prefab sin instancia dejan de resolverse al cargar sin jugador',()=>{
  const {play}=rig()
  assert.equal(play._restoreViewModelRef({playerPrefabNode:'item'}),null)
  assert.equal(play._restoreViewModelRef({playerPrefabNode:'not-a-node'}),null)
})

test('SAVE-28: referencia local permanece válida aunque cambie el orden autoral',async()=>{
  const {play,project}=rig();play._spawnPlayer('fps-pf')
  const oldId=currentPlayerOwner(play).objects[2].id
  play.vm.held.set(oldId,{id:oldId,slot:'right'})
  const saved=play.captureWorld()
  const asset=project.prefabs[0]
  asset.objects.splice(2,0,{id:'extra',name:'Extra',type:'node3d',parentId:'r',active:true,position:[0,0,0]})
  play._validateWorldRestore(saved)
  await play.restoreWorld(saved)
  const newId=currentPlayerOwner(play).objects.find(o=>o.name==='Lámpara de bolsillo').id
  assert.equal(play.vm.held.has(newId),true)
  assert.notEqual(newId,oldId)
})
test('SAVE-29: SaveManager real conserva formato y emite load después de rehidratar el mundo',async()=>{
  const {play,tracker}=rig();play._spawnPlayer('fps-pf')
  const game={
    db:{player:{saveSlots:10}},state:{score:7},sw:{},vr:{},selfSw:{},dyn:{},rev:0,time:1,
    party:{gold:4,inv:{items:{},weapons:{},armors:{}},actors:{},members:[],journal:{},enemies:{},nextEnemyId:1,ctx:{changed(){}},actor(){return null}},
    report(){},async emit(name){tracker.events.push(name)},
    host:{captureWorld:()=>play.captureWorld(),validateWorldRestore:w=>play._validateWorldRestore(w),restoreWorld:w=>play.restoreWorld(w)}
  }
  const saves=new SaveManager(game);saves.useStorage(new MemoryStorage())
  assert.equal(await saves.save(3),true)
  const snapshot=saves.storage.get(3)
  assert.equal(snapshot.v,1);assert.equal(snapshot.world.player.prefabId,'fps-pf')
  game.state.score=999
  assert.equal(await saves.load(3),true)
  assert.equal(game.state.score,7)
  assert.equal(tracker.spawn,2)
  assert.deepEqual(tracker.events,['save','load'])
  assert.equal(saves.last,3);assert.equal(saves.busy,false)
})
