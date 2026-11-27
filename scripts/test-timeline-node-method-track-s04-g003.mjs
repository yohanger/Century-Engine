import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { newKey, newTrack, newTimeline, keyParams, normalizeTimeline, normalizeTrack, TRACK_KINDS } from '../src/core/timeline/model.js'

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const loaded = (source) => import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
// Se evalúa el reproductor ORIGINAL con sustitución solo de imports gráficos: no se copia su lógica.
const runnerSrc = read('src/engine/runtime/timeline/player.js')
  .replace("import { evalTimelineCamera, evalTimelineNode } from './eval.js'", 'const evalTimelineCamera=()=>null, evalTimelineNode=()=>undefined')
  .replace("import { sampleBakeTrack } from '../../../core/timeline/physics.js'", 'const sampleBakeTrack=()=>null')
const { TimelineRunner } = await loaded(runnerSrc)
// Mismo runtime de scripts; únicamente las importaciones externas se sustituyen para Node sin node_modules.
const scriptsSrc = read('src/engine/runtime/scene/node-scripts.js')
  .replace("import { getNativeSignal } from '../nodes/registry.js'", 'const getNativeSignal=()=>null')
  .replace("import { compileScript, createScriptConsole } from '../host.js'", 'const compileScript=()=>{}, createScriptConsole=()=>({})')
const { discoverNodeMethods, NodeScriptRuntime } = await loaded(scriptsSrc)
const hostSrc = read('src/engine/runtime/events/play-timeline.js')
  .replace("import { nodeAnimationProperty, PROPS } from '../anim/model.js'", 'const nodeAnimationProperty=()=>null, PROPS={}')
  .replace("import { getDef } from '../nodes/registry.js'", 'const getDef=()=>({refreshShape(){}})')
  .replace("import * as THREE from 'three'", 'const THREE={Vector3:class{},Quaternion:class{},Euler:class{}}')
  .replace("import { TimelineRunner } from '../timeline/player.js'", 'const TimelineRunner=class{}')
  .replace("import { quatFromRot, resolveCamera3D } from '../timeline/eval.js'", 'const quatFromRot=()=>null,resolveCamera3D=()=>null')
  .replace("import { sampleBakeTrack } from '../../../core/timeline/physics.js'", 'const sampleBakeTrack=()=>null')
  .replace("import { DEG } from '../util.js'", 'const DEG=Math.PI/180')
  .replace("import { setCameraFov, verticalFov } from '../render/camera-fov.js'", 'const setCameraFov=()=>{}, verticalFov=()=>70')
  .replace("import { resolveAudioGroup } from '../audio/config.js'", 'const resolveAudioGroup=()=>null')
const { timelineMethods } = await loaded(hostSrc)

const fixture = (options={}) => {
  const tr = newTrack('method', {node:'node-1',byId:true})
  tr.keys = [newKey('method',0.5,{method:'abrir',args:[true,2]}),newKey('method',1.5,{method:'cerrar',args:[]})]
  return newTimeline('Puerta',{duration:2,tracks:[tr],...options})
}
const playback = (tl=fixture(), override={}) => {
  const calls=[],errors=[]
  const host={method:(...args)=>{calls.push(args)},error:(e)=>errors.push(e),...override}
  return {runner:new TimelineRunner(tl,host),calls,errors,host}
}

test('Modelo nuevo por ID, sin modificar otros tipos',()=>{
  assert.equal(TRACK_KINDS.method.label,'Métodos de nodo')
  assert.equal(newTrack('method').byId,true)
  assert.equal(newKey('method',1).method,'')
  assert.deepEqual(newKey('method',1).args,[])
  assert.equal(newTrack('node').kind,'node')
  assert.equal(newTrack('commands').kind,'commands')
})
test('Normalización persiste claves, parámetros JSON y nodo estricto por ID',()=>{
  const t=normalizeTimeline(JSON.parse(JSON.stringify(fixture())))
  const tr=t.tracks[0]
  assert.equal(tr.byId,true)
  assert.equal(tr.node,'node-1')
  assert.deepEqual(tr.keys[0].args,[true,2])
  assert.equal(tr.keys[0].method,'abrir')
  assert.deepEqual(normalizeTimeline(JSON.parse(JSON.stringify(t))),t)
  assert.deepEqual(keyParams(tr).map(p=>p.key),['t'])
})
test('La pista de métodos rechaza el modo legado por nombre aunque el importador lo solicite',()=>{
  const tr=normalizeTrack({kind:'method',node:'Puerta',byId:false,keys:[]})
  assert.equal(tr.node,'Puerta'); assert.equal(tr.byId,true)
  assert.ok(!('prop' in tr))
  assert.ok(!('interpolation' in tr))
})
test('Normalización limpia parámetros y no altera claves anteriores',()=>{
  const tr=normalizeTrack({kind:'method',node:'abc',keys:[{t:1,method:' abrir ',args:[{name:'hola',active:true},null,3]},{t:0,method:1,args:'texto'}]})
  assert.equal(tr.keys[0].method,'');assert.deepEqual(tr.keys[0].args,[])
  assert.equal(tr.keys[1].method,'abrir');assert.deepEqual(tr.keys[1].args,[{name:'hola',active:true},null,3])
  assert.equal(normalizeTrack({kind:'commands',keys:[{t:1,list:[]}]}).kind,'commands')
})
test('Dispara un método exactamente al cruzar su tiempo y conserva argumentos',()=>{
  const {runner,calls}=playback()
  runner.update(0); runner.update(0.4);assert.equal(calls.length,0)
  runner.update(0.1); assert.deepEqual(calls,[['node-1','abrir',[true,2]]])
  runner.update(0.7);assert.equal(calls.length,1)
  runner.update(0.3);assert.equal(calls[1][1],'cerrar')
})
test('Pausa, reanuda y no llama de nuevo claves ya disparadas',()=>{
  const {runner,calls}=playback()
  runner.update(0.6);runner.pause();runner.update(1);assert.equal(calls.length,1)
  runner.resume();runner.update(0.1);assert.equal(calls.length,1)
  runner.update(1);assert.equal(calls.length,2)
})
test('Seek no ejecuta llamadas; claves pasadas no se ejecutan retroactivamente',()=>{
  const {runner,calls}=playback()
  runner.seek(1);assert.equal(calls.length,0)
  runner.update(0.6);assert.deepEqual(calls.map(a=>a[1]),['cerrar'])
})
test('From mayor que cero omite métodos anteriores (sin ejecutar), inclusive en el primer update',()=>{
  const tl=fixture(), calls=[]
  const r=new TimelineRunner(tl,{method:(...args)=>calls.push(args)},{from:1})
  r.update(0);assert.equal(calls.length,0)
  r.update(0.6);assert.deepEqual(calls.map(a=>a[1]),['cerrar'])
})
test('Loop permite volver a llamar en ciclo nuevo sin duplicar antes del reinicio',()=>{
  const {runner,calls}=playback(fixture({loop:true}))
  runner.update(2.01); assert.equal(calls.length,2)
  runner.update(0.6);assert.deepEqual(calls.map(a=>a[1]),['abrir','cerrar','abrir'])
})
test('Pista silenciada nunca ejecuta métodos',()=>{
  const tl=fixture();tl.tracks[0].muted=true
  const {runner,calls}=playback(tl);runner.update(1.9);assert.equal(calls.length,0)
})
test('Skip y Stop no llaman a métodos pendientes',async()=>{
  const a=playback();a.runner.update(0.1);await a.runner.skip();assert.equal(a.calls.length,0)
  const b=playback();b.runner.stop();b.runner.update(2);assert.equal(b.calls.length,0)
})
test('La ausencia de método o nodo produce diagnóstico, no invocación accidental',()=>{
  const tl=fixture();tl.tracks[0].node='';tl.tracks[0].keys[0].method=''
  const {runner,calls,errors}=playback(tl)
  runner.update(0.6);assert.equal(calls.length,0);assert.equal(errors.length,1)
  assert.match(errors[0].message,/sin nodo\/método/)
})
test('Error síncrono se informa una vez, sin detener innecesariamente el Timeline',()=>{
  const {runner,errors}=playback(fixture(),{method:()=>{throw Error('método ausente')}})
  runner.update(0.6);assert.equal(errors.length,1);assert.match(errors[0].message,/ausente/)
  runner.update(0.1);assert.equal(errors.length,1)
})
test('Promesa rechazada informa error asíncrono sin unhandledRejection',async()=>{
  const {runner,errors}=playback(fixture(),{method:()=>Promise.reject(Error('promesa rechazada'))})
  runner.update(0.6);await new Promise(resolve=>setImmediate(resolve))
  assert.equal(errors.length,1);assert.match(errors[0].message,/promesa rechazada/)
})
test('Host de Player comprueba ID exacto y delega en NodeHandle.call',()=>{
  const obj={id:'node-1',name:'Puerta'};const calls=[]
  const play={project:{objects:[obj,{id:'node-2',name:'node-1'}]},ed:{nodes:new Map([['node-1',{}],['node-2',{}]])},_nodeHandle:(id)=>({call:(...args)=>calls.push([id,...args])}),_tlWarned:new Set()}
  const host=timelineMethods._tlHost.call(play)
  host.method('node-1','abrir',[1,'dos'])
  assert.deepEqual(calls,[['node-1','abrir',1,'dos']])
  assert.throws(()=>host.method('puerta','abrir',[]),/no disponible/)
  assert.throws(()=>host.method('desaparecido','abrir',[]),/no disponible/)
  assert.throws(()=>host.method('node-2','abrir',{}),/lista/)
})
test('Eliminación del nodo no redirige a otro con igual nombre',()=>{
  const other={id:'old',name:'node-1'}, calls=[]
  const play={project:{objects:[other]},ed:{nodes:new Map([['old',{}]])},_nodeHandle:()=>({call:()=>calls.push(1)}),_tlWarned:new Set()}
  assert.throws(()=>timelineMethods._tlHost.call(play).method('node-1','abrir',[]),/no disponible/)
  assert.equal(calls.length,0)
})
test('Runtime real de Scripts de Nodo: método válido, ambiguo, inactivo y ausente',()=>{
  const obj={id:'door',scriptIds:['script-a']}
  const runtime=new NodeScriptRuntime({_nodeEnabled:()=>true})
  const entry={obj,idsKey:JSON.stringify(obj.scriptIds),active:true,exiting:false,node:{is_valid:()=>true},methods:new Map([['abrir',(...args)=>args]]),methodOwners:new Map(),conflictedMethods:new Set()}
  runtime.instances.set(obj.id,entry)
  assert.deepEqual(runtime.callPublic(obj,'abrir',[1,2]),[1,2])
  assert.throws(()=>runtime.callPublic(obj,'cerrar',[]),/no encontrado/)
  entry.conflictedMethods.add('abrir')
  assert.throws(()=>runtime.callPublic(obj,'abrir',[]),/ambiguo/)
  entry.conflictedMethods.clear();entry.exiting=true
  assert.throws(()=>runtime.callPublic(obj,'abrir',[]),/no disponible/)
})
test('Inspector descubre node.expose literal, informa duplicados y no afirma registro runtime',()=>{
  const obj={id:'n',scriptIds:['a','b']}
  const scripts=[{id:'a',execution:'node',code:"node.expose('abrir', ()=>{}); node.expose('conflicto', ()=>{});"},
    {id:'b',execution:'node',code:"node.expose('cerrar',()=>{}); node.expose('conflicto',()=>{});"}]
  const info=discoverNodeMethods(obj,scripts)
  assert.ok(info.methods.find(m=>m.name==='abrir'&&!m.duplicate))
  assert.ok(info.methods.find(m=>m.name==='cerrar'&&!m.duplicate))
  assert.ok(info.methods.find(m=>m.name==='conflicto'&&m.duplicate))
})
test('Integración estática: selección desde Assets, inspector, drag por ID y Edit Mode sin comandos',()=>{
  const ui=read('src/components/TemporalResourceInspector.vue')
  const timeline=read('src/components/TimelinePanel.vue')
  assert.match(ui,/discoverNodeMethods/);assert.match(ui,/methodArgsChange/)
  assert.match(ui,/Array\.isArray\(args\)/);assert.match(ui,/methodNameChange/)
  assert.match(ui,/track\.kind === 'method'/)
  assert.match(timeline,/Llamadas a métodos/);assert.match(timeline,/nodeMethodTrack/)
  assert.match(timeline,/newTrack\('method'/)
  assert.doesNotMatch(timeline,/host\.method\?/)
})
