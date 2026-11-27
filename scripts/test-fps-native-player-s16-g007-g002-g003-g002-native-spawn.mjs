import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { nodeEffectiveActive } from '../src/engine/runtime/nodes/hierarchy.js'

const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const playSource = read('src/engine/runtime/events/play.js')
const decisionCode = playSource.slice(playSource.indexOf('  _scenePlayerDecision() {'), playSource.indexOf('  // Una sola resolución por escena:'))
const decision = new Function('resolveScenePlayerNode', `return ({${decisionCode.replace('\n  _scenePlayerSelect()', ',\n  _scenePlayerSelect()')}})`)(
  (scene, objs) => {
    const id = scene?.playerNodeId || ''
    if (!id) return {status:'unassigned',id:''}
    const node = objs.find(o => o.id === id)
    return node?.type === 'characterbody3d' ? {status:'valid',id,node} : {status:node?'wrong-type':'missing',id}
  })
const projectSource = read('src/core/project.js')
const block = projectSource.slice(projectSource.indexOf('export function materializePrefab('),projectSource.indexOf('/** Normaliza la autoría'))
let nextId=0
const remapSignalConnections = (conns,map) => conns.filter(c=>map.has(c.emitterId)&&map.has(c.receiverId))
  .map(c=>({...c,id:`sig-new-${++nextId}`,emitterId:map.get(c.emitterId),receiverId:map.get(c.receiverId)}))
const validateNodeTree = list => {
  const ids=new Set(list.map(o=>o.id))
  if(ids.size!==list.length) throw new Error('ID duplicado')
  if(list.some((o,i)=>i>0&&!ids.has(o.parentId))) throw new Error('Padre inválido')
}
const materializePrefab = new Function('uid','migrateNodeScripts','remapSignalConnections','validateNodeTree',
  `${block.replace('export function materializePrefab','function materializePrefab')}\nreturn materializePrefab`)(
    ()=>`n-new-${++nextId}`,o=>{o.scriptIds??=[];delete o.scriptId;return o},remapSignalConnections,validateNodeTree)
class Vec {constructor(x,y,z){this.xyz=[x,y,z]} toArray(){return this.xyz} applyMatrix4(){return this} }
const nodeText=read('src/engine/runtime/events/play-nodes.js')
const nodesMethods=new Function('THREE','materializePrefab','guardedDescriptors',
  `return (${nodeText.slice(nodeText.indexOf('export const nodesMethods =')+'export const nodesMethods ='.length)})`)(
  {Vector3:Vec},materializePrefab,()=>({}))
const playerText=read('src/engine/runtime/events/play-player.js')
const playerMethods=new Function('THREE','DEG','nodeEffectiveActive',
  `return (${playerText.slice(playerText.indexOf('export const playerMethods =')+'export const playerMethods ='.length)})`)(
  {},Math.PI/180,nodeEffectiveActive)
function pf(bodyCount=1){return {id:'pf',name:'Personaje FPS',rev:1,objects:[
  {id:'root',type:'node3d',parentId:null,active:true,position:[0,0,0]},
  ...Array.from({length:bodyCount},(_,i)=>({id:`body-${i}`,type:'characterbody3d',parentId:'root',active:true,position:[0,1,0]})),
  ...(bodyCount?[{id:'capsule',type:'collisionshape3d',parentId:'body-0',props:{shape:{radius:.4,height:1.7}}}]:[]),
],signalConnections:[]}}
function rig({mode='api',manager='fps',film=null,bodyCount=1,onAttach,onReady,onSync}={}){
  const sc={id:'scene-one',...(mode?{playerSpawnMode:mode}:{})}
  const project={scenes:[sc],activeSceneId:sc.id,objects:[{id:'floor',type:'node3d',parentId:null}],prefabs:[pf(bodyCount)],signalConnections:[]}
  const nodes=new Map([['floor',{_lfNodeOwner:project.objects[0]}]])
  const characters=new Map();const trace={attached:0,detached:0,ready:0,syncs:0}
  const spatial={characters,disposed:false,characterState:id=>({velocity:characters.get(id)?.velocity||[0,0,0]})}
  const phys={nodeSpatial:spatial,nodeBodyRuntime:{attach(ids){trace.attached++;if(onAttach)onAttach(ids);for(const obj of project.objects){if(!ids.has(obj.id)||obj.type!=='characterbody3d')continue;characters.set(obj.id,{obj,node:nodes.get(obj.id),velocity:[0,0,0]})}},detach(ids){trace.detached++;for(const id of ids)characters.delete(id)}}}
  const ed={nodes,_syncingAll:false,nodeLifecycle:{scripts:null,beginRemoval(){},endRemoval(){},sync(){trace.syncs++;onSync?.();if(onReady){trace.ready++;onReady(play)}}},syncObject(id){const obj=project.objects.find(o=>o.id===id);nodes.set(id,{_lfNodeOwner:obj})},removeObject(id){nodes.delete(id)}}
  const proto={}
  for(const part of [decision,nodesMethods,playerMethods]) Object.defineProperties(proto,Object.getOwnPropertyDescriptors(part))
  const play=Object.create(proto)
  Object.assign(play,{project,on:true,film,g:{player:manager},ed,phys,state:{player:false},hasPlayer:false,_nativePlayerId:null,_nativePlayerIssue:null,_referenceSession:{},_nodeEnabled:o=>nodeEffectiveActive(project.objects,o),_tagLayerApi:()=>({}),_animMethodsFor:()=>({}),_vmSetup:()=>{},_vmTeardown:()=>{},_gpReady:()=>{},player:{api:()=>({legacy:true})}})
  return {play,project,nodes,characters,trace,ed}
}

test('SPN-01 · modo API inicia sin jugador y no activa legacy',()=>{
  const {play}=rig();assert.deepEqual(play._scenePlayerDecision(),{kind:'deferred',id:null});assert.equal(play._playerApi(),null)
})
test('SPN-02 · ausencia del campo no crea jugador',()=>{
  const {play}=rig({mode:null});assert.equal(play._scenePlayerDecision().kind,'none')
  assert.throws(()=>play._spawnPlayer('pf'),/modo Aparición por API/)
})
test('SPN-03 · modo API no permite Sin jugador',()=>{
  const {play}=rig({manager:'none'});assert.equal(play._scenePlayerDecision().kind,'invalid')
  assert.throws(()=>play._spawnPlayer('pf'),/incompatible/)
})
test('SPN-04 · modo API no permite playerNodeId autoral',()=>{
  const {play}=rig();play.project.scenes[0].playerNodeId='body-autoral';assert.equal(play._scenePlayerDecision().kind,'invalid')
  assert.throws(()=>play._spawnPlayer('pf'),/incompatible/)
})
test('SPN-05 · FilmMaker no permite Spawn',()=>{
  const {play}=rig({film:{}});assert.equal(play._scenePlayerDecision().kind,'disabled')
  assert.throws(()=>play._spawnPlayer('pf'),/modo Aparición por API/)
})
test('SPN-06 · aparición liga Jolt y game.player antes de _ready',()=>{
  const {play,trace,characters,project}=rig({onReady:self=>{
    assert.equal(self.hasPlayer,true);assert.equal(self.state.player,true)
    assert.ok(self._nativeCharacterState());assert.equal(characters.has(self._nativePlayerId),true)
  }})
  const master=JSON.stringify(project.prefabs[0]),root=play._spawnPlayer('pf',{position:[3,0,8]})
  assert.equal(trace.ready,1);assert.equal(trace.attached,1);assert.equal(play._nativeCharacterState().obj.id,play._nativePlayerId)
  assert.equal(project.objects.find(o=>o.id===root.id).position[0],3)
  assert.equal(JSON.stringify(project.prefabs[0]),master)
})
test('SPN-07 · segundo Spawn no crea nodos ni un segundo jugador',()=>{
  const {play,project,trace}=rig();play._spawnPlayer('pf');const before=project.objects.length
  assert.throws(()=>play._spawnPlayer('pf'),/ya existe/);assert.equal(project.objects.length,before);assert.equal(trace.attached,1)
})
test('SPN-08 · Prefab sin CharacterBody3D se rechaza antes de montar',()=>{
  const {play,project,trace}=rig({bodyCount:0})
  assert.throws(()=>play._spawnPlayer('pf'),/exactamente un CharacterBody3D/)
  assert.equal(project.objects.length,1);assert.equal(trace.attached,0)
})
test('SPN-09 · Prefab con dos candidatos se rechaza antes de montar',()=>{
  const {play,project,trace}=rig({bodyCount:2})
  assert.throws(()=>play._spawnPlayer('pf'),/exactamente un CharacterBody3D/)
  assert.equal(project.objects.length,1);assert.equal(trace.attached,0)
})
test('SPN-10 · Prefab inexistente no crea nodos',()=>{
  const {play,project,trace}=rig()
  assert.throws(()=>play._spawnPlayer('otro'),/inexistente/);assert.equal(project.objects.length,1);assert.equal(trace.attached,0)
})
test('SPN-11 · fallo Jolt revierte el árbol y deja jugador sin vincular',()=>{
  const {play,project,trace}=rig({onAttach:()=>{throw new Error('Jolt no inició')}})
  assert.throws(()=>play._spawnPlayer('pf'),/Jolt no inició/)
  assert.equal(project.objects.length,1);assert.equal(trace.detached,1);assert.equal(play._nativePlayerId,null);assert.equal(play.state.player,false)
})
test('SPN-12 · fallo de inicialización revierte instancia e identidad',()=>{
  const {play,project,trace}=rig({onSync:()=>{throw new Error('Error en scripts')}})
  assert.throws(()=>play._spawnPlayer('pf'),/Error en scripts/)
  assert.equal(project.objects.length,1);assert.equal(play._nativePlayerId,null);assert.equal(trace.detached,1)
})
test('SPN-13 · destruir por game.prefabs invalida el jugador, no los demás nodos',()=>{
  const {play,project,characters}=rig();const handle=play._spawnPlayer('pf');const playerId=play._nativePlayerId
  assert.equal(play._prefabDestroy(handle),true);assert.equal(play._nativePlayerId,null)
  assert.equal(play.state.player,false);assert.equal(play.hasPlayer,false);assert.equal(handle.is_valid(),false)
  assert.equal(project.objects.length,1);assert.equal(characters.has(playerId),false)
})
test('SPN-14 · STOP destruye instancias y restaura autoría sin jugador',()=>{
  const {play,project}=rig();const original=JSON.stringify(project.prefabs[0]);play._spawnPlayer('pf');play._prefabClearRuntime()
  assert.equal(play._nativePlayerId,null);assert.equal(project.objects.length,1);assert.equal(JSON.stringify(project.prefabs[0]),original)
})
test('SPN-15 · modo api y API pública están conectados en Play y NGM Runtime',()=>{
  assert.match(read('src/engine/runtime/events/interpreter.js'),/spawnPlayer: \(prefab, options = \{\}\)/)
  assert.match(read('src/engine/runtime/events/play-host.js'),/spawnPlayer: alive/)
  assert.doesNotMatch(read('src/engine/runtime/events/play.js'),/decision\.kind === 'legacy'/)
  assert.match(read('src/engine/runtime/package/format.js'),/source\?\.playerSpawnMode === 'api'/)
  assert.match(read('src/core/state/project.js'),/assignScenePlayerSpawnMode/)
  assert.match(read('src/components/ScenePanel.vue'),/Aparición por API/)
})
test('SPN-16 · la referencia persistida no se sustituye por un ID temporal',()=>{
  const {play,project}=rig();const before=JSON.stringify(project.scenes);play._spawnPlayer('pf')
  assert.equal(JSON.stringify(project.scenes),before);assert.equal(project.scenes[0].playerNodeId,undefined)
})

test('SPN-17 · errores síncronos de _ready activan rollback del Prefab',()=>{
  const {play,ed,project}=rig()
  ed.nodeLifecycle.scripts={_report(error,obj){if(this._spawnInitIds?.has(obj.id))this._spawnInitFailure=error}}
  ed.nodeLifecycle.sync=()=>{
    const character=project.objects.find(o=>o.type==='characterbody3d')
    if(character)ed.nodeLifecycle.scripts._report(new Error('Error de _ready'),character)
  }
  assert.throws(()=>play._spawnPlayer('pf'),/Error de _ready/)
  assert.equal(play._nativePlayerId,null)
  assert.equal(project.objects.length,1)
})
test('SPN-18 · el reporte de inicialización asíncrona hace rollback en la escena vigente',async()=>{
  const scripts=read('src/engine/runtime/scene/node-scripts.js')
  const block=scripts.slice(scripts.indexOf('  _report(error, obj, method ='), scripts.indexOf('  _handle(obj, entry, slot)'))
  const report=new Function(`return ({${block}})._report`)()
  const {play,project}=rig()
  const errors=[]
  play.game={report:error=>errors.push(error.message)}
  const root=play._spawnPlayer('pf')
  const obj=project.objects.find(o=>o.id===play._nativePlayerId)
  report.call({play},new Error('Rechazo asíncrono de _ready'),obj,'_ready · script')
  await Promise.resolve()
  assert.equal(errors[0],'Rechazo asíncrono de _ready')
  assert.equal(root.is_valid(),false)
  assert.equal(project.objects.length,1)
  assert.equal(play.state.player,false)
})
test('SPN-19 · el setter editorial no autoriza modalidad API incompatible',()=>{
  const src=read('src/core/state/project.js')
  const snippet=src.slice(src.indexOf('export function assignScenePlayerSpawnMode('),src.indexOf('/** { meta, scene }'))
    .replace('export function','function')
  const project={scenes:[{id:'scene'}],activeSceneId:'scene',objects:[]}
  const state={project,locked:false,play:{on:false},filmMode:false}
  const commits=[]
  const setter=new Function('activeScene','store','sceneGameConfig','commit',`${snippet}\nreturn assignScenePlayerSpawnMode`)(
    ()=>project.scenes[0],state,()=>({config:{player:'fps'}}),label=>commits.push(label))
  assert.equal(setter('api'),true)
  assert.equal(project.scenes[0].playerSpawnMode,'api')
  assert.equal(setter('node'),true)
  assert.equal(Object.hasOwn(project.scenes[0],'playerSpawnMode'),false)
  project.scenes[0].playerNodeId='body-author'
  assert.equal(setter('api'),false)
  assert.equal(commits.length,2)
})
