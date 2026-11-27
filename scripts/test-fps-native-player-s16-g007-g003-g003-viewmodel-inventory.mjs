import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = p => readFileSync(new URL(`../${p}`, import.meta.url),'utf8')
class V {
  constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this}
  copy(o){return this.set(o.x,o.y,o.z)}
  clone(){return new V(this.x,this.y,this.z)}
  toArray(){return [this.x,this.y,this.z]}
  multiplyScalar(s){return this.set(this.x*s,this.y*s,this.z*s)}
  setScalar(s){return this.set(s,s,s)}
  addScaledVector(v,s){return this.set(this.x+v.x*s,this.y+v.y*s,this.z+v.z*s)}
  add(v){return this.addScaledVector(v,1)}
  sub(v){return this.addScaledVector(v,-1)}
  length(){return Math.hypot(this.x,this.y,this.z)}
  normalize(){return this.multiplyScalar(1/(this.length()||1))}
  lerpVectors(a,b,t){return this.set(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t)}
}
class Q {
  constructor(){this.x=0;this.y=0;this.z=0;this.w=1}
  copy(o){Object.assign(this,{x:o.x,y:o.y,z:o.z,w:o.w});return this}
  clone(){return new Q().copy(this)}
  setFromEuler(){return this}
  invert(){return this}
  multiply(){return this}
  slerpQuaternions(a){return this.copy(a)}
}
class Layers {
  constructor(){this.mask=1}
  set(n){this.mask=1<<n}
  enable(n){this.mask|=1<<n}
  disable(n){this.mask&=~(1<<n)}
}
class N {
  constructor(){this.children=[];this.parent=null;this.position=new V();this.quaternion=new Q();this.scale=new V(1,1,1);this.layers=new Layers();this.userData={};this.visible=true}
  add(n){n.removeFromParent();this.children.push(n);n.parent=this;return this}
  attach(n){return this.add(n)}
  removeFromParent(){if(this.parent){this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null}return this}
  traverse(fn){fn(this);for(const c of this.children)c.traverse(fn)}
  updateMatrixWorld(){}
  getWorldPosition(out){return out.copy(this.position)}
  getWorldQuaternion(out){return out.copy(this.quaternion)}
  worldToLocal(out){return out}
}
class Cam extends N { constructor(fov){super();this.fov=fov;this.aspect=1;this.isCamera=true} updateProjectionMatrix(){} getWorldDirection(out){return out.set(0,0,-1)} }
class Box3 { setFromObject(){this.min=new V(0,0,0);return this} getSize(out){return out.set(.5,.5,.5)} }
const THREE={Group:N,PerspectiveCamera:Cam,Vector3:V,Quaternion:Q,Box3,Euler:class{set(){return this}setFromQuaternion(){return this}}}
const slotById=(cfg,id)=>cfg?.slots?.find(s=>s.id===id) || null
const arr3=(v,d)=>Array.isArray(v)&&v.length===3?v.map(Number):d
const eul=()=>({})
const toVmLayer=node=>{const save=[];node.traverse(n=>{save.push([n,n.layers.mask]);n.layers.set(4)});return save}
const fromVmLayer=save=>{for(const [node,mask] of save)node.layers.mask=mask}
const handsSrc=read('src/engine/runtime/player/viewmodel/hands.js')
const begin=handsSrc.indexOf('export const handsMethods =')
const end=handsSrc.indexOf('\nObject.assign(handsMethods',begin)
assert.ok(begin>=0 && end>begin)
const stashSrc=read('src/engine/runtime/player/viewmodel/hands-stash.js')
const throwSrc=read('src/engine/runtime/player/viewmodel/hands-throw.js')
function component(src,symbol){const idx=src.indexOf(`export const ${symbol} =`);return src.slice(idx).replace(`export const ${symbol} =`,`const ${symbol} =`)+`;return ${symbol}`}
const extras={_v:new V(),_q:new Q()}
const stashMethods=new Function('_q','_v',component(stashSrc,'stashMethods'))(extras._q,extras._v)
const throwMethods=new Function('THREE','_q','_v',component(throwSrc,'throwMethods'))(THREE,extras._q,extras._v)
const handsMethods=new Function('THREE','DEG','slotById','VM_LAYER','_e','_q','_v','arr3','eul','toVmLayer','fromVmLayer','throwMethods','stashMethods',
  handsSrc.slice(begin,end).replace('export const handsMethods =','const handsMethods =')+'\nObject.assign(handsMethods,stashMethods,throwMethods);return handsMethods')(
  THREE,Math.PI/180,slotById,4,{},extras._q,extras._v,arr3,eul,toVmLayer,fromVmLayer,throwMethods,stashMethods)
const db={slots:[{id:'right',label:'Derecha',pos:[.2,-.2,-.4],rot:[0,0,0],scale:1},{id:'left',label:'Izquierda',pos:[-.2,-.2,-.4],rot:[0,0,0],scale:1}],vmVisible:true,dropEnabled:true,throwMax:14}
function rig(){
  const scene=new N(),cam=new Cam(80),obj={id:'item',name:'Objeto',type:'mesh'},node=new N()
  node.isMesh=true;node.geometry={};node.castShadow=true;scene.add(node)
  const events=[], physics=[], signals=[], outputs=[]
  const game={db:{player:structuredClone(db)},state:{},party:{has:()=>true},rev:0,
    _nativeSignal:(...x)=>signals.push(x),emit:(...x)=>outputs.push(x)}
  const play={game,vp:{scene,vmView:null,requestRender(){},},cam,hasPlayer:true,_tlFov:false,
    state:{focus:true,dialog:null,choices:null},main:null,ui:{modalOpen:false},
    ed:{models:new Map(),nodes:new Map([[obj.id,node]]),groundAt:()=>0},events:[],colliders:[],tweens:[],
    input:{justPressed:()=>false},control:true,pos:new V(),yaw:0,body:{radius:.4,eyeHeight:1.5},
    _find:id=>id===obj.id||id===obj.name?obj:null,
    _gpRecord:()=>null,_gpDrop:id=>outputs.push(['gpDrop',id]),_gpSettle:id=>outputs.push(['gpSettle',id]),
    _animMethodsFor:()=>({}),phys:{hasSensors:()=>false,setNodeEnabled:(n,v)=>physics.push([n,v]),syncNode:()=>{}},
    _raycast:()=>null}
  const player=Object.create(handsMethods);Object.assign(player,{play,vm:null,_thrown:[]})
  return {scene,cam,obj,node,events,physics,signals,outputs,game,play,player}
}
test('VMN-01: PlayerController expone una sola implementación de manos y NoPlayer la hereda',()=>{
  const controller=read('src/engine/runtime/player/controller.js'),playerIndex=read('src/engine/runtime/player/index.js')
  assert.match(controller,/Object\.defineProperties\(PlayerController\.prototype, Object\.getOwnPropertyDescriptors\(handsMethods\)\)/)
  assert.doesNotMatch(playerIndex,/FpsPlayer|fps\/index/)
  for (const name of ['viewModelAttach','viewModelRelease','viewModelStash','viewModelUnstash','viewModelThrow','_vmFrame'])
    assert.equal(typeof handsMethods[name],'function')
})
test('VMN-02: montar VM crea los slots exclusivamente desde Database runtime',()=>{
  const {player,scene,play}=rig();player._vmSetup()
  assert.equal(player.vm.slots.size,2)
  assert.equal(player.vm.slots.get('right').anchor.position.x,.2)
  assert.equal(player.vm.slots.get('left').anchor.position.x,-.2)
  assert.equal(play.vp.vmView,player.vm.view)
  assert.equal(scene.children.includes(player.vm.root),true)
})
test('VMN-03: game.viewModel comparte slots y propiedades de la misma instancia',()=>{
  const {player}=rig();player._vmSetup();const api=player._vmApi()
  assert.deepEqual(api.slots,['right','left'])
  assert.equal(api.slot('left').label,'Izquierda')
  api.visible=false;assert.equal(player.vm.visible,false)
  api.visible=true;assert.equal(player.vm.visible,true)
})
test('VMN-04: attach coloca un objeto en la capa VM_LAYER, sin alterar Database',async()=>{
  const {player,node,game,physics,signals}=rig();const old=JSON.stringify(game.db.player);player._vmSetup()
  await player.viewModelAttach({target:'item',slot:'right',seconds:0})
  assert.equal(player.vm.held.has('item'),true)
  assert.equal(player.vm.slots.get('right').items.length,1)
  assert.equal(node.layers.mask,1<<4)
  assert.equal(signals.length,1)
  assert.equal(physics.at(-1)[1],false)
  assert.equal(JSON.stringify(game.db.player),old)
})
test('VMN-05: mover entre slots no duplica objetos ni emite otra señal',async()=>{
  const {player,signals}=rig();player._vmSetup()
  await player.viewModelAttach({target:'item',slot:'right',seconds:0})
  await player.viewModelAttach({target:'item',slot:'left',seconds:0})
  assert.equal(player.vm.held.size,1)
  assert.equal(player.vm.slots.get('right').items.length,0)
  assert.equal(player.vm.slots.get('left').items.length,1)
  assert.equal(signals.length,1)
})
test('VMN-06: stash y unstash reutilizan el estado de una sola mano',async()=>{
  const {player,node}=rig();player._vmSetup()
  await player.viewModelAttach({target:'item',seconds:0})
  assert.deepEqual(player.viewModelStash({target:'item'}),{id:'item',name:'Objeto'})
  assert.equal(player.vm.held.size,0);assert.equal(player.vm.stash.has('item'),true)
  assert.equal(node.visible,false)
  const ok=await player.viewModelUnstash({target:'item',seconds:0})
  assert.equal(ok,true);assert.equal(node.visible,true);assert.equal(player.vm.held.has('item'),true)
})
test('VMN-07: drop y throw toman las acciones Input Map y Database existentes',async()=>{
  const {player,play}=rig();player._vmSetup()
  await player.viewModelAttach({target:'item',slot:'right',seconds:0})
  const calls=[]
  player.viewModelRelease=opts=>{calls.push(['drop',opts]);return Promise.resolve()}
  player.viewModelThrow=opts=>{calls.push(['throw',opts]);return Promise.resolve()}
  play.input.justPressed=k=>k==='drop';player._dropInput()
  play.input.justPressed=k=>k==='throw';player._dropInput()
  assert.deepEqual(calls.map(c=>c[0]),['drop','throw'])
  assert.equal(calls[1][1].speed,14)
})
test('VMN-08: frame del VM sigue Camera3D y respeta visibilidad de Player',async()=>{
  const {player,play,cam}=rig();player._vmSetup()
  await player.viewModelAttach({target:'item',seconds:0});cam.position.set(4,2,3)
  player._vmFrame(1/60)
  assert.deepEqual(player.vm.root.position.toArray(),[4,2,3])
  assert.equal(player.vm.view.active,true)
  play.hasPlayer=false;player._vmFrame(1/60)
  assert.equal(player.vm.root.visible,false);assert.equal(player.vm.view.active,false)
})
test('VMN-09: destrucción del Player restaura mundo y colisiones de lo sostenido',async()=>{
  const {player,node,play,scene}=rig();player._vmSetup();await player.viewModelAttach({target:'item',seconds:0})
  player._vmTeardown({restoreWorld:true})
  assert.equal(player.vm,null);assert.equal(play.vp.vmView,null)
  assert.equal(node.parent,scene)
  assert.equal(node.layers.mask,1)
})
test('VMN-10: teardown normal preserva ruta legacy y no requiere jugador nativo',()=>{
  const {player,play}=rig();player._vmSetup();player._vmTeardown()
  assert.equal(play.vp.vmView,null);assert.equal(player.vm,null)
  player._vmTeardown()
})
test('VMN-11: no hay montaje VM durante modo Sin jugador o FilmMaker',()=>{
  const s=read('src/engine/runtime/events/play.js')
  assert.doesNotMatch(s,/playerDecision\.kind === 'legacy'/)
  assert.match(s,/if \(decision\.kind === 'native' && this\._nativeCharacterState\(\)\) this\._vmSetup\(\)/)
  assert.match(read('src/engine/runtime/events/play-player.js'),/this\._vmSetup\(\)\s*if \(!this\._restoringPhysical\) this\._gpReady\(\)/)
})
test('VMN-12: Spawn Player monta VM antes de _ready y destruye al salir',()=>{
  const spawn=read('src/engine/runtime/events/play-player.js'),prefs=read('src/engine/runtime/events/play-nodes.js')
  assert.match(spawn,/this\._nativePlayerConfigApply\(\)[\s\S]*?this\._vmSetup\(\)\s*if \(!this\._restoringPhysical\) this\._gpReady\(\)/)
  assert.match(prefs,/if \(removingPlayer\) \{\s*this\._vmTeardown\(\{ restoreWorld: !!this\.on && !force \}\)/)
})
test('VMN-13: Gameplay Object solo restaura manos cuando VM existe',()=>{
  const s=read('src/engine/runtime/events/play-gameplay-objects.js')
  assert.match(s,/_gpReady\(\) \{\s*if \(!this\.vm\) return/)
  assert.match(s,/g\.node\.visible = g\.obj\.visible !== false\s*this\.viewModelStash/)
})
test('VMN-14: API y render siguen siendo únicos, sin segundo renderer ni manager',()=>{
  const host=read('src/engine/runtime/events/play-host.js'),r=read('src/engine/runtime/render/look-passes.js')
  assert.match(host,/get viewModel\(\) \{ return self\._vmApi\(\) \}/)
  assert.match(r,/vmView/)
  const p=read('src/engine/runtime/events/play-player.js')
  assert.match(p,/_vmApi\(\.\.\.a\) \{ return this\.vm \? this\.player\._vmApi\?\.\(\.\.\.a\) : undefined \}/)
})
test('VMN-15: destruir jugador devuelve un stash manual al mundo sin reactivar objetos consumidos',async()=>{
  const {player,node,play}=rig();player._vmSetup()
  await player.viewModelAttach({target:'item',seconds:0})
  player.viewModelStash({target:'item'})
  assert.equal(node.visible,false)
  player._vmTeardown({restoreWorld:true})
  assert.equal(node.visible,true)
  assert.equal(node.parent,play.vp.scene)
})
test('VMN-16: rehidratar objetos Database almacenados usa su visibilidad autoral',()=>{
  const src=read('src/engine/runtime/events/play-gameplay-objects.js')
  const start=src.indexOf('  _gpReady() {')
  const end=src.indexOf('  _gpCandidate(',start)
  const fn=new Function(`return ({${src.slice(start,end)}})._gpReady`)()
  const obj={id:'arma-1',visible:true},node={visible:false},state={status:'stored',slot:'right'}
  const restore=[]
  const host={vm:{},_gpObjects:new Map([['arma-1',{obj,node,state}]]),
    viewModelStash({target}){restore.push([target,node.visible]);node.visible=false}}
  fn.call(host)
  assert.deepEqual(restore,[['arma-1',true]])
  assert.equal(node.visible,false)
})
