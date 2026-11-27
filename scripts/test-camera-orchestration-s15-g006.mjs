// G006: código productivo evaluado con cámara y reloj mínimos, sin abrir Electron.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { newTimeline, normalizeTimeline } from '../src/core/timeline/model.js'

const source = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8')
class Q {
  constructor(a = 0) { this.a = a; this.x = 0; this.y = 0; this.z = 0; this.w = 1 }
  clone() { return new Q(this.a) }
  copy(q) { this.a = q.a; return this }
  slerp(q, t) { this.a += (q.a - this.a) * t; return this }
  normalize() { return this }
}
const camMethods = Function('THREE', 'setCameraFov', 'resolveCamera3D', source('src/engine/runtime/events/play-camera.js')
  .replace(/^import .*$/gm, '').replace(/^export /gm, '') + '\nreturn cameraMethods')(
  { Matrix4: class {} }, (cam, fov) => { cam.fov = fov },
  (key, scene, objects, nodes) => {
    if (key.sceneId !== scene) return null
    const o = objects.find(o => o.id === key.node && o.type === 'camera' && o.active !== false)
    const n = nodes.get(key.node)
    return o && n ? { pos: [...n.pos], quat: new Q(n.angle), fov: o.props.fov, profile: o.props.profile || '' } : null
  })
const make = ({ player = true } = {}) => {
  const objects = ['a','b','c'].map((id,i) => ({ id, type:'camera', active:true, visible:true,
    props:{ fov:50 + i*20, profile:['night','day','blue'][i] } }))
  const nodes = new Map([['a',{pos:[2,0,0],angle:0}],['b',{pos:[10,0,0],angle:90}],['c',{pos:[20,0,0],angle:180}]])
  const cam = { position:{ x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z})} }, quaternion:new Q(0), fov:90 }
  const writes=[]
  const pm={ ...camMethods, on:true, project:{ activeSceneId:'scene-a', objects }, ed:{nodes,vp:{}},
    hasPlayer:player, film:null, tls:[], state:{noCamera:false},dom:{style:{}},rt:{log(){}},
    _gm:{},g:{fov:90},cam,
    _nodeEnabled(o){return o.active!==false},_profCamera(prof,seconds){writes.push([prof,seconds])},
    _waterFx(){}, _dofFocus(){}, _tlCamera(){},
    player:{viewPose(c){c.position.set(0,1,0);c.quaternion.copy(new Q(0));c.fov=90}},
  }
  pm._cameraReset()
  return {pm,cam,objects,nodes,writes,frame(dt=0){pm._cameraDelta=dt;pm._cameraFrame(cam)}}
}
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`)

test('G006-01 · Cut inmediato mantiene propietario y datos nativos',()=>{
  const {pm,cam,frame}=make()
  const lease=pm._cameraAcquire('a');assert.ok(lease)
  frame(0);assert.equal(cam.position.x,2)
  assert.equal(lease.use('b'),true);frame(.4)
  assert.equal(cam.position.x,10);assert.equal(cam.fov,70);assert.equal(pm._cameraBlend,null)
})
test('G006-02 · Blend lineal interpolado en el único frame efectivo',()=>{
  const {pm,cam,frame}=make()
  frame(0);assert.ok(pm._cameraAcquire('b',{seconds:1,ease:'linear'}))
  frame(.25);near(cam.position.x,2.5);near(cam.fov,85);near(cam.quaternion.a,22.5)
  frame(.75);assert.equal(cam.position.x,10);assert.equal(pm._cameraBlend,null)
})
test('G006-03 · inOut y perfil discreto por peso dominante',()=>{
  const {pm,cam,frame,writes}=make()
  const lease=pm._cameraAcquire('a');frame(0)
  lease.use('b',{seconds:1});frame(.25)
  near(cam.position.x,3.25);near(cam.quaternion.a,14.0625)
  assert.equal(writes.at(-1)[0],'night')
  frame(.25);near(cam.position.x,6);assert.equal(writes.at(-1)[0],'day')
})
test('G006-04 · interrupción del propio lease parte de salida ya dibujada',()=>{
  const {pm,cam,frame}=make()
  const lease=pm._cameraAcquire('a');frame(0)
  assert.equal(lease.use('b',{seconds:1}),true);frame(.25)
  const prior=cam.position.x
  assert.equal(lease.use('c',{seconds:1}),true)
  frame(0);near(cam.position.x,prior)
  frame(.25);near(cam.position.x,prior+(20-prior)*.15625)
})
test('G006-05 · solicitud ajena rechazada conserva progreso e identidad',()=>{
  const {pm,frame}=make()
  const lease=pm._cameraAcquire('a');frame(0)
  lease.use('b',{seconds:2});frame(.25)
  const blend=pm._cameraBlend
  assert.equal(pm._cameraAcquire('c',{seconds:1}),null)
  assert.equal(pm._cameraBlend,blend)
  assert.equal(blend.elapsed,.25)
})
test('G006-06 · duración inválida, curva inválida y destino ausente no mutan la autoridad',()=>{
  const {pm,frame}=make()
  assert.equal(pm._cameraAcquire('a',{seconds:-1}),null)
  const lease=pm._cameraAcquire('a');frame(0)
  const source=pm._cameraSource
  assert.equal(lease.use('b',{seconds:NaN}),false)
  assert.equal(lease.use('b',{ease:'cut'}),false)
  assert.equal(lease.use('not-found',{seconds:1}),false)
  assert.equal(pm._cameraSource,source);assert.equal(pm._cameraSource.source.id,'a')
})
test('G006-07 · pausa congela el avance; resume continúa sin depender de frames',()=>{
  const {pm,frame}=make()
  frame(0);pm._cameraAcquire('a',{seconds:2})
  frame(.5);assert.equal(pm._cameraBlend.elapsed,.5)
  for(let i=0;i<15;i++)frame(0)
  assert.equal(pm._cameraBlend.elapsed,.5)
  frame(.5);assert.equal(pm._cameraBlend.elapsed,1)
})
test('G006-08 · release keep conserva fuente viva y termina blend restante',()=>{
  const {pm,cam,nodes,frame}=make()
  const lease=pm._cameraAcquire('a');frame(0);lease.use('b',{seconds:1})
  frame(.25)
  assert.equal(lease.release(),true);assert.equal(pm._cameraSource.kind,'held')
  frame(.75);assert.equal(cam.position.x,10)
  nodes.get('b').pos[0]=16;frame(0);assert.equal(cam.position.x,16)
  assert.equal(lease.use('a'),false)
})
test('G006-09 · release base con blend vuelve solo bajo petición explícita',()=>{
  const {pm,cam,frame}=make()
  const lease=pm._cameraAcquire('b');frame(0)
  assert.equal(lease.release({to:'base',seconds:1,ease:'linear'}),true)
  frame(.5);near(cam.position.x,5)
  frame(.5);assert.equal(cam.position.x,0)
})
test('G006-10 · release permite Camera3D explícita, anterior y pose fija',()=>{
  const {pm,cam,nodes,frame}=make()
  const a=pm._cameraAcquire('a');frame(0);a.release()
  const b=pm._cameraAcquire('b');frame(0)
  assert.equal(b.release({to:'previous'}),true)
  frame(0);assert.equal(cam.position.x,2)
  const c=pm._cameraAcquire('c');frame(0)
  assert.equal(c.release({to:'pose'}),true)
  nodes.get('c').pos[0]=40;frame(0);assert.equal(cam.position.x,20)
  const d=pm._cameraAcquire('b');frame(0)
  assert.equal(d.release({to:'camera3d',cameraId:'a'}),true)
  frame(0);assert.equal(cam.position.x,2)
})
test('G006-11 · sin jugador no acepta retorno explícito al player',()=>{
  const {pm,frame}=make({player:false})
  const lease=pm._cameraAcquire('a');frame(0)
  assert.equal(lease.release({to:'player'}),false)
  assert.equal(pm._cameraSource.kind,'request')
})
test('G006-12 · al perderse la cámara, cancela blend e invalida lease',()=>{
  const {pm,frame,objects}=make({player:false})
  const lease=pm._cameraAcquire('a');frame(0);lease.use('b',{seconds:2});frame(.5)
  objects.splice(objects.findIndex(x=>x.id==='b'),1)
  frame(.2)
  assert.equal(pm._cameraBlend,null)
  assert.equal(lease.release(),false)
  assert.equal(pm.state.noCamera,true)
})
test('G006-13 · reiniciar escena invalida el snapshot, blend y lease',()=>{
  const {pm,frame}=make()
  frame(0);const lease=pm._cameraAcquire('a',{seconds:2});frame(.2)
  pm.project.activeSceneId='scene-b';pm._cameraReset()
  assert.equal(pm._cameraLastRaw,null)
  assert.equal(pm._cameraBlend,null)
  assert.equal(lease.use('b'),false)
})

test('G006-14 · Timeline nuevo tiene salida explícita, el normalizado existente no recibe política',()=>{
  const old=normalizeTimeline({id:'old',name:'Anterior',duration:3,tracks:[]})
  assert.equal(Object.hasOwn(old,'cameraExit'),false)
  const fresh=newTimeline('Nuevo')
  assert.equal(fresh.cameraExit.natural.to,'keep')
  assert.equal(fresh.cameraExit.stop.to,'keep')
  assert.equal(fresh.cameraExit.skip.to,'keep')
  const reopened=normalizeTimeline(JSON.parse(JSON.stringify(fresh)))
  assert.deepEqual(reopened.cameraExit,fresh.cameraExit)
})
test('G006-15 · declaración Camera3D de salida valida ID y escena sin migrar históricos',()=>{
  const tl=newTimeline('Toma')
  tl.cameraExit.natural={to:'camera3d',sceneId:'scene-a',cameraId:'b'}
  assert.deepEqual(normalizeTimeline(tl).cameraExit.natural,tl.cameraExit.natural)
  tl.cameraExit.natural={to:'camera3d',cameraId:'b'}
  assert.throws(()=>normalizeTimeline(tl),/ID y escena/)
})

const timelineMethods=Function('THREE', 'TimelineRunner', 'setCameraFov', 'verticalFov', 'resolveCamera3D', 'sampleBakeTrack', 'resolveAudioGroup', 'DEG',
  source('src/engine/runtime/events/play-timeline.js').replace(/^import .*$/gm,'').replace(/^export /gm,'')+'\nreturn timelineMethods')(
  {Vector3: class {},Quaternion: class {},Euler: class {}},class {},()=>{},()=>70,()=>{},()=>{},()=>{},Math.PI/180)
const runner=(exit='keep',mode='camera3d')=>({tl:{ id:'tl1',name:'Prueba',tracks:[{kind:'camera',muted:false,keys:[{t:0,mode,node:'a',sceneId:'scene-a'}]}]},
  lastCamera:{pos:[2,0,0],quat:new Q(0),fov:50,profile:'night'},
  cameraExit:{natural:{to:exit},stop:{to:exit},skip:{to:exit}}, time:2,finished:true,lock:false,skipped:false,
  _cameraBefore:{kind:'base'},})
test('G006-16 · al terminar Timeline nuevo conserva Camera3D viva y su control queda libre',()=>{
  const {pm,nodes,cam,frame}=make()
  Object.assign(pm,timelineMethods)
  const r=runner();pm.tls=[r];pm._tlBakeRelease=()=>{}
  pm._tlEnded(r,false)
  assert.equal(pm._cameraSource.kind,'held')
  nodes.get('a').pos[0]=7;frame(0);assert.equal(cam.position.x,7)
  assert.equal(pm.tls.length,0)
})
test('G006-17 · Timeline con clave libre sin fuente viva no fabrica FPS ni congela pose',()=>{
  const {pm,frame}=make()
  Object.assign(pm,timelineMethods)
  const r=runner('keep','free');pm.tls=[r];pm._tlBakeRelease=()=>{}
  pm._tlEnded(r)
  assert.equal(pm._cameraSource.kind,'empty')
  frame(0);assert.equal(pm.state.noCamera,true)
})
test('G006-18 · política explícita mantener pose conserva snapshot',()=>{
  const {pm,cam,frame}=make()
  Object.assign(pm,timelineMethods)
  const r=runner('pose','free');pm.tls=[r];pm._tlBakeRelease=()=>{}
  pm._tlEnded(r)
  frame(0);assert.equal(pm._cameraActive.kind,'pose');assert.equal(cam.position.x,2)
})
test('G006-19 · stop y skip seleccionan motivos diferentes',()=>{
  const {pm}=make()
  Object.assign(pm,timelineMethods)
  pm._tlBakeRelease=()=>{}
  const stop=runner();stop.cameraExit.stop={to:'base'};pm.tls=[stop];pm._tlEnded(stop,true)
  assert.equal(pm._cameraSource,null)
  const skip=runner();skip.skipped=true;skip.cameraExit.skip={to:'pose'};pm.tls=[skip];pm._tlEnded(skip,false)
  assert.equal(pm._cameraSource.kind,'pose')
})
test('G006-20 · solicitud ajena activa no cede al terminar otra Timeline',()=>{
  const {pm}=make();Object.assign(pm,timelineMethods);pm._tlBakeRelease=()=>{}
  const r=runner();pm.tls=[r];const owner=pm._cameraAcquire('b')
  assert.ok(owner);pm._tlEnded(r)
  assert.equal(pm._cameraSource.kind,'request')
  assert.equal(pm._cameraSource.source.id,'b')
})
test('G006-21 · API Event/VS Code y Player comparten runtime sin autoridad paralela',()=>{
  const code=source('src/core/events/game-api.d.ts')
  assert.equal(code,source('vscode-extension/media/game-api.d.ts'))
  assert.match(code,/CameraTransitionOptions/)
  assert.match(source('src/engine/runtime/events/cmd-world.js'),/seconds'/)
  assert.match(source('src/engine/runtime/events/exec-commands.js'),/cameraEvent\?\./)
  assert.match(source('src/engine/runtime/package/game.js'),/new PlayMode\(graph\)/)
})

test('G006-22 · liberar locks restaura mirada y movimiento sin cambiar fuente de cámara',()=>{
  const {pm}=make()
  Object.assign(pm,timelineMethods)
  pm._tlBakeRelease=()=>{}
  pm.control=true;pm.lookControl=true
  const a=runner();a.lock=true
  const b=runner();b.lock=true
  pm._tlCtl=pm.control;pm._tlLookCtl=pm.lookControl;pm.control=false;pm.lookControl=false;pm._tlLocks=2
  pm.tls=[a,b]
  pm._tlEnded(a)
  assert.equal(pm.control,false);assert.equal(pm.lookControl,false)
  pm._tlEnded(b)
  assert.equal(pm.control,true);assert.equal(pm.lookControl,true)
})
test('G006-23 · normalización no cambia salida de recursos antiguos con propiedades omitidas',()=>{
  const old={id:'old',name:'Viejo',duration:2,tracks:[],gameManagerId:'gm',lockPlayer:false}
  const normalized=normalizeTimeline(old)
  assert.equal(Object.hasOwn(normalized,'cameraExit'),false)
  assert.equal(normalized.lockPlayer,false)
  const again=normalizeTimeline(normalized)
  assert.equal(Object.hasOwn(again,'cameraExit'),false)
})
test('G006-24 · Screen Shake sigue compuesto después de resolver la única salida',()=>{
  const code=source('src/engine/runtime/events/play-controls.js')
  assert.ok(code.indexOf('this._cameraFrame(cam)') < code.indexOf('this._shakeFrame(cam, dt, stepping)'))
  assert.match(source('src/engine/runtime/events/play-camera-shake.js'),/\['film', 'timeline', 'pose'\]\.includes/ )
})

test('G006-25 · recurso nuevo conserva política por escena al empaquetar y leer ZIP real', async (t) => {
  let writePackage,readPackage
  try { ({ writePackage, readPackage } = await import('../src/engine/runtime/package/format.js')) }
  catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' && /jszip/i.test(error.message)) { t.skip('JSZip no instalado en este entorno'); return }
    throw error
  }
  const timeline = newTimeline('Cámara nueva', {duration:5,tracks:[]})
  timeline.cameraExit.stop = {to:'camera3d',sceneId:'s-a',cameraId:'cam-x'}
  const data = {id:'p',name:'Paridad',activeSceneId:'s-a',
    scenes:[{id:'s-a',name:'Inicio'}],build:{scenes:['s-a']},
    game:{player:'none'},timelines:[timeline],gameManagers:[],assets:[],scripts:[],
    models:[],prefabs:[],database:{},profiles:[]}
  const scenes=[{id:'s-a',name:'Inicio',data:{objects:[],environment:{},terrain:{size:32}}}]
  const zip=await writePackage({data,scenes,files:new Map()})
  const result=await readPackage(zip)
  assert.equal(result.game.timelines[0].cameraExit.stop.cameraId,'cam-x')
  assert.equal(result.game.timelines[0].cameraExit.natural.to,'keep')
})

test('G006-26 · comando declarativo muestra duración, easing y salida Camera3D contextual', async () => {
  const { visibleParams, newCommand } = await import('../src/engine/runtime/events/commandDefs.js')
  const cmd = newCommand('cameraControl')
  const acquireKeys = visibleParams('cameraControl', cmd.p).map(p=>p.key)
  assert.ok(acquireKeys.includes('seconds') && acquireKeys.includes('ease'))
  assert.ok(!acquireKeys.includes('cameraId'))
  const releaseKeys = visibleParams('cameraControl',{action:'release',to:'camera3d'}).map(p=>p.key)
  assert.ok(releaseKeys.includes('cameraId'))
  assert.ok(!releaseKeys.includes('node'))
})
test('G006-27 · propiedades nuevas se editan en el menú de Timeline existente, no en claves',()=>{
  const editor=source('src/components/TimelinePanel.vue')
  assert.match(editor,/setTimelineCameraExit\(reason, raw\)/)
  assert.match(editor,/Comportamiento actual/)
  assert.match(editor,/Salida de cámara/)
  assert.doesNotMatch(source('src/engine/runtime/events/play-camera.js'),/new CameraManager|new CinemachineBrain/)
})
test('G006-28 · invalidación de salida de cámara declarada no recicla fuentes inexistentes',()=>{
  const {pm}=make()
  Object.assign(pm,timelineMethods);pm._tlBakeRelease=()=>{}
  const r=runner('camera3d');r.cameraExit.natural={to:'camera3d',sceneId:'otra',cameraId:'a'}
  pm.tls=[r];pm._tlEnded(r)
  assert.equal(pm._cameraSource.kind,'empty')
})
