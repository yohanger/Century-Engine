// LF-FILMMAKER-ANIM-S02-G002_CORR-001 · pruebas de comportamiento, no búsqueda de cadenas.
// Los dobles de Jolt/UI no sustituyen el QA con WASM y Electron reales.
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { sampleBakeTrack } from '../src/core/timeline/physics.js'
import { physicsSignature } from '../src/filmmaker/physics-data.js'
const root = new URL('../src/', import.meta.url)
const read = f => readFileSync(new URL(f, root), 'utf8')

class Vec {
  constructor(x=0,y=0,z=0) { this.x=x;this.y=y;this.z=z }
  toArray() { return [this.x,this.y,this.z] }
  fromArray(a) { [this.x,this.y,this.z]=a;return this }
  set(x,y,z) { return this.fromArray([x,y,z]) }
  copy(v) { return this.fromArray(v.toArray()) }
}
class Quat extends Vec {
  constructor(x=0,y=0,z=0,w=1) { super(x,y,z);this.w=w }
  toArray(){return [this.x,this.y,this.z,this.w]}
  fromArray(a){[this.x,this.y,this.z,this.w]=a;return this}
}
class Runner {
  constructor(tl,host,{from=0,onEnd}) { this.tl=tl;this.host=host;this.time=from;this.onEnd=onEnd;this.finished=false;this.paused=false;this.done=Promise.resolve(true) }
  update(dt){this.time+=dt;this.host.bakeFrame?.(this.time);for(const tr of this.tl.tracks.filter(x=>x.kind==='bake'&&!x.muted)){const pose=sampleBakeTrack(tr,this.time);if(pose)this.host.bake?.(tr.node,pose)}return true}
  seek(t){this.time=t;this.update(0)}
  stop(){this.finished=true;this.onEnd?.(this)}
  skip(){this.stop()}
  pause(){this.paused=true}
  resume(){this.paused=false}
}
const modeLog=[]
const srcTimeline=read('engine/runtime/events/play-timeline.js').replace(/^import .*\n/gm,'').replace('export const timelineMethods =', 'const timelineMethods =')
const ctx={THREE:{Vector3:Vec,Quaternion:Quat,Euler:class{}},TimelineRunner:Runner,sampleBakeTrack,DEG:Math.PI/180,setCameraFov(){},verticalFov(){},console,Set,Map}
vm.runInNewContext(`${srcTimeline}\nthis.api=timelineMethods`,ctx)
const methods=ctx.api
function makeHost(start=3) {
  modeLog.length=0
  const node={position:new Vec(0,4,0),quaternion:new Quat(),updateMatrixWorld(){},updateWorldMatrix(){},getWorldPosition(out){return out.copy(this.position)},getWorldQuaternion(out){return out.fromArray(this.quaternion.toArray())}}
  const body={id:'vaso',node,item:{id:19}}
  let velocity=[1,2,3],ang=[0,1,0]
  const B={velocityOf(){return [...velocity]},angularVelocityOf(){return [...ang]},setVelocity(item,v){velocity=[...v]},setAngularVelocity(item,v){ang=[...v]},teleport(){}}
  const track={kind:'bake',node:'vaso',start,duration:1,hz:60,muted:false,samples:Array.from({length:61},(_,i)=>({pos:[0,4-i/60,0],quat:[0,0,0,1]}))}
  const timeline={id:'cin',name:'Cine',lockPlayer:false,skippable:true,tracks:[track]}
  const host={project:{objects:[{id:'vaso',type:'rigidbody3d'}],timelines:[timeline]},ed:{nodes:new Map([['vaso',node]])},_bodies:[body],phys:{bi:{SetMotionType(_id,mode){modeLog.push(mode)}},J:{EMotionType_Kinematic:'K',EMotionType_Dynamic:'D',EActivation_Activate:1},bodies:B},control:true,state:{},_tlHost(){return {bake(){}}}}
  Object.assign(host,methods);host._tlInit()
  return {host,body,node,track,getVelocity:()=>velocity}
}
test('CORR-01 · reserva un cuerpo sin inmovilizarlo antes de start',()=>{
  const {host}=makeHost(3)
  host.timelinePlay('cin')
  assert.deepEqual(modeLog,[])
  assert.equal(host._tlBakeReservations.has('vaso'),true)
  assert.equal(host._tlBakeOwners.has('vaso'),false)
  host._tlUpdate(2)
  assert.deepEqual(modeLog,[])
})
test('CORR-02 · adquiere el cuerpo al llegar al bake y lo restaura en stop',()=>{
  const {host,node,getVelocity}=makeHost(3)
  host.timelinePlay('cin')
  host.timelineControl('cin','seek',3)
  assert.deepEqual(modeLog,['K'])
  assert.equal(host._tlBakeOwners.has('vaso'),true)
  host.timelineStop('cin')
  assert.deepEqual(modeLog,['K','D'])
  assert.equal(host._tlBakeOwners.has('vaso'),false)
  assert.equal(host._tlBakeReservations.has('vaso'),false)
  assert.deepEqual(node.position.toArray(),[0,4,0])
  assert.deepEqual(getVelocity(),[1,2,3])
})
test('CORR-03 · seek inverso antes del bake cede el control a Jolt',()=>{
  const {host}=makeHost(3)
  host.timelinePlay('cin');host.timelineControl('cin','seek',3.5)
  host.timelineControl('cin','seek',1)
  assert.deepEqual(modeLog,['K','D'])
  host.timelineControl('cin','seek',3.5)
  assert.deepEqual(modeLog,['K','D','K'])
  host.timelineStop('cin')
  assert.deepEqual(modeLog,['K','D','K','D'])
})
test('CORR-04 · pistas reservadas no admiten dos timelines concurrentes',()=>{
  const {host}=makeHost(3)
  const other={...host.project.timelines[0],id:'cin2',name:'Otra'}
  host.project.timelines.push(other)
  host.timelinePlay('cin')
  assert.throws(()=>host.timelinePlay('cin2'),/reservado/)
  assert.deepEqual(modeLog,[])
  host.timelineStop('cin')
  assert.doesNotThrow(()=>host.timelinePlay('cin2'))
})
test('CORR-05 · un bake pausado no se adquiere antes de start',()=>{
  const {host}=makeHost(3)
  host.timelinePlay('cin',{from:1})
  host.timelineControl('cin','pause')
  host._tlUpdate(0)
  assert.deepEqual(modeLog,[])
  host.timelineStop('cin')
  assert.deepEqual(modeLog,[])
})
test('CORR-06 · reinicio libera reservas y cuerpos',()=>{
  const {host}=makeHost(3)
  host.timelinePlay('cin',{from:3});host._tlReset()
  assert.deepEqual(modeLog,['K','D'])
  assert.equal(host._tlBakeReservations.size,0)
  assert.equal(host._tlBakeOwners.size,0)
})

function functionSource(src,name){
  const at=src.indexOf(`export async function ${name}(`)
  assert.ok(at>=0,`sin función ${name}`)
  const start=src.indexOf('{',src.indexOf(')',at))
  let depth=0,i=start
  for(;i<src.length;i++){if(src[i]==='{')depth++;else if(src[i]==='}'&&!--depth)break}
  // Nota: esta extracción solo se usa para funciones cuya cabecera y cuerpo son conocidos.
  return src.slice(at,i+1).replace('export async function','async function')
}
const filmSrc=read('core/state/film.js')
function makeImport({invalid=false,failLater=false}={}) {
  let switched=0,commits=0,deleted=[]
  const base=[{id:'origen',type:'primitive'}],target=[{id:'vaso',type:'primitive'}]
  const p={id:'proy',name:'Proyecto',activeSceneId:'escenaA',scenes:[{id:'escenaA'},{id:'escenaB'}],objects:structuredClone(base),assets:[],captures:[],models:[],timelines:[],profiles:[],folders:[],environment:{id:1},render:{},audio:{}}
  const store={project:p,timelineId:null,editor:{syncAll(){},syncEnvironment(){}}}
  const film={name:'Peli',scene:{id:'escenaB',name:'B',projectId:'proy'},edit:{nodeTracks:[],physicsBakes:[]},overrides:{vaso:{position:[9,0,0]}},assets:[],actor:{objectId:''},takes:[],passes:[]}
  const tool={unpackNfm:async()=>({film,assets:new Map()}),applyOverrides(objects,overrides){objects[0].position=[9,0,0];return {applied:['vaso'],missing:[]}},sequence:()=>({items:[]}),montageTimeline:()=>({})}
  const ctx={filmTool:()=>tool,store,askConfirm:async()=>true,db:{async loadScene(){return {objects:structuredClone(target)}},async deleteAsset(_p,id){deleted.push(id)}},validateFilmMotion(){if(invalid)throw new Error('película inválida')},normalizeTimeline:()=>({}),async switchScene(id){switched++;p.activeSceneId=id;p.objects=structuredClone(id==='escenaB'?target:base);return true},updateObject(){if(failLater)throw Error('error durante importación')},commit(){commits++},console,toast(){},normalizeRender:x=>x,addFolderChain(){},normFolder:x=>x,uniqueFileName:()=>'',fileKind:()=>'',extOf:()=>'',importCapture:()=>{},uid:()=>'',PROFILE_FOLDER:'',normalizeProfile:()=>({}),JSON,Array,Map,Set}
  const fnSrc = functionSource(filmSrc,'importFilm')
  vm.runInNewContext(`${fnSrc}\nthis.runImport=importFilm`,ctx)
  return {run:()=>ctx.runImport(new Uint8Array()),p,store,getSwitched:()=>switched,getCommits:()=>commits}
}
test('CORR-07 · importación inválida de escena diferente no provoca switchScene',async()=>{
  const h=makeImport({invalid:true})
  await assert.rejects(h.run(),/película inválida/)
  assert.equal(h.getSwitched(),0)
  assert.equal(h.p.activeSceneId,'escenaA')
  assert.deepEqual(h.p.objects,[{id:'origen',type:'primitive'}])
  assert.equal(h.getCommits(),0)
})
test('CORR-08 · error posterior restaura escena y datos iniciales',async()=>{
  const h=makeImport({failLater:true})
  await assert.rejects(h.run(),/error durante importación/)
  assert.equal(h.p.activeSceneId,'escenaA')
  assert.deepEqual(h.p.objects,[{id:'origen',type:'primitive'}])
  assert.equal(h.getSwitched(),2)
  assert.equal(h.getCommits(),0)
})
test('CORR-09 · import válido usa escena destino y registra un solo commit',async()=>{
  const h=makeImport()
  await h.run()
  assert.equal(h.p.activeSceneId,'escenaB')
  assert.equal(h.getSwitched(),1)
  assert.equal(h.getCommits(),1)
})
test('CORR-10 · physicsSignature proviene del módulo persistente',()=>{
  const src=read('filmmaker/session.js')
  assert.match(src,/import \{ physicsSignature \} from '\.\/physics-data\.js'/)
  assert.doesNotMatch(src,/import \{[^\n]*physicsSignature[^\n]*\} from '\.\/physics-bake\.js'/)
  assert.equal(typeof physicsSignature,'function')
})
test('CORR-11 · el Player evalúa propiedad física en cada seek/loop',()=>{
  const src=read('engine/runtime/timeline/player.js')
  assert.match(src,/h\.bakeFrame\?\.\(this\.time\)/)
  assert.equal(typeof Runner.prototype.seek,'function')
})
test('CORR-12 · FilmMaker sin planos no entra por locate()',()=>{
  const src=read('filmmaker/session.js')
  assert.match(src,/if \(seq\.items\.length\) \{\s*const loc = locate\(/)
  assert.match(src,/if \(!it\) \{[\s\S]*?show\(t, t\)/)
  assert.match(read('filmmaker/FilmApp.vue'),/F\.montageHasContent\(\)/)
})

// La función real de reproducción se ejecuta con dependencias explícitas; evita que
// una comprobación textual oculte un return prematuro cuando no hay planos.
function makeMontageHarness({onlyFirstKey=false}={}) {
  const s=read('filmmaker/session.js')
  const begin=s.indexOf('export async function playMontage(')
  const end=s.indexOf('export function stopMontage()',begin)
  assert.ok(begin>=0&&end>begin)
  const callTimes=[]; let onFrame=null, stops=0, stoppedEnvironment=0
  const nodePoseClass=class { restore(){} at(t){callTimes.push(t);return []} }
  const film={edit:{nodeTracks:[{properties:[{keys:[{t:0}]}]}],physicsBakes:[],audio:[]},actor:{objectId:''}}
  const player={on:true,paused:false,film:{time:0},filmJump(t){this.film.time=t},_profSet(){}}
  const ed={player,vp:{persp:{position:new Vec(),quaternion:new Quat(),fov:80,updateProjectionMatrix(){}},controls:{enabled:true}}}
  const session={film, montage:{T:0,on:false,total:0,index:-1},author:{},paused:false}
  const context={session,store:{editor:ed,project:{objects:[]}},stopLive(){},stopPlayback(){},stopView(){},async cancelPass(){},
    sequence:()=>({items:[],total:0}),filmEnd:()=>onlyFirstKey?0:1,stopNodeAuthoring(){},restoreEditorialCamera(){},syncFilterProfiles(){},
    FilmNodePose:nodePoseClass,FilmPhysicsPose:class {restore(){} at(){return []}},stopAudio(){},
    async restartEnvironment({onFrame:tick}){onFrame=tick},stopMontage(){stops++;session.montage.on=false},
    togglePause(){},shakeOptions:()=>({}),montageCamera:()=>null,montageEffects:()=>({fade:0}),transitionAt:()=>({alpha:0}),
    applyOverlay(){},syncAudio(){},physicsBakeStatus:()=>'',toast(){},performance:{now:()=>0},quatFromRot:()=>new Quat(),
    nodePose:null,physicsPose:null,mont:null,rig:null,Set,Array,Math,console,Error}
  // Reutilizar el guard de contenido real (también usado en el botón superior).
  context.montageHasContent = () => !!film.edit.nodeTracks.some(t => t.properties.some(p => p.keys.length))
  vm.runInNewContext(s.slice(begin,end).replace('export async function','async function')+'\nthis.playMontage=playMontage',context)
  return {context,play:(t)=>context.playMontage(t),frame:t=>onFrame(t),times:()=>callTimes,stops:()=>stops,session}
}
test('CORR-13 · montaje solo con animación avanza sin plano ni locate()',async()=>{
  const h=makeMontageHarness()
  await h.play(0.25)
  assert.equal(h.session.montage.on,true)
  assert.deepEqual(h.times(),[0.25])
  h.frame(0.5)
  assert.deepEqual(h.times(),[0.25,0.5])
  h.frame(1.1)
  assert.equal(h.stops(),1)
})
test('CORR-14 · una única clave en t=0 conserva duración mínima reproducible',async()=>{
  const h=makeMontageHarness({onlyFirstKey:true})
  await h.play(0)
  assert.equal(h.session.montage.total,0.1)
  h.frame(0.1)
  assert.equal(h.stops(),1)
})
