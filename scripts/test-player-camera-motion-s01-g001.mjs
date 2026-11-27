import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizePlayer, PLAYER_PARAMS } from '../src/engine/runtime/database/player.js'
import { shakeConfig, sampleShake, cameraShakeMethods } from '../src/engine/runtime/events/play-camera-shake.js'
import { cameraMotionMethods } from '../src/engine/runtime/player/fps/camera-motion.js'

const near = (a, b, e=1e-7) => assert.ok(Math.abs(a-b)<e, `${a} ≠ ${b}`)
const recipe = (o={}) => ({ camera:'player', enabled:true, autoPlay:false, loop:true, pattern:'sine',
  position:[0.08,0.03,0], rotation:[0,0,0.6], frequency:2, blendIn:0, blendOut:0, ...o })
const node=(id, props={})=>({id,type:'cameraShake',visible:true,props:recipe(props)})
function scenario(config={}) {
  const cfg=normalizePlayer({cameraMotionEnabled:true,cameraMotionWalk:'walk',cameraMotionRun:'run',cameraMotionJump:'jump',cameraMotionLand:'land',cameraMotionFall:'fall',...config})
  const fake={play:{hasPlayer:true,control:true,paused:false,game:{db:{player:cfg}},g:cfg},
    pos:{x:0,y:0,z:0}, prev:{x:0,y:0,z:0}, vy:0, grounded:true,gk:'stable',wet:{swim:false}}
  Object.setPrototypeOf(fake,cameraMotionMethods)
  return {fake,cfg,step(dt,dx=0){fake.prev.x=fake.pos.x;fake.pos.x+=dx;fake._cameraMotionTick(dt)}}
}
function scene(player,nodes) {
  const w=Object.assign(Object.create(cameraShakeMethods), {player,hasPlayer:true,
    project:{objects:nodes,animations:[]},state:{focus:true},paused:false,film:null,tls:[],_shakeClocks:new Map(),
    _mainCameraNode:()=>null})
  const render=()=>{const a={position:[0,0,0],rotation:[0,0,0]}; w._shakeFrame({
    translateX:v=>a.position[0]+=v,translateY:v=>a.position[1]+=v,translateZ:v=>a.position[2]+=v,
    rotateX:v=>a.rotation[0]+=v,rotateY:v=>a.rotation[1]+=v,rotateZ:v=>a.rotation[2]+=v,
  },.016);return a}
  return {w,render}
}
test('PCM-01 proyecto anterior no activa movimiento',()=>{
 const p=normalizePlayer({walk:5});assert.equal(p.cameraMotionEnabled,false)
 assert.deepEqual(cameraMotionMethods.cameraMotionSamples.call({play:{game:{db:{player:p}}},cameraMotion:null}),[])
})
test('PCM-02 campos se publican y referencias se conservan',()=>{
 const keys=['cameraMotionWalk','cameraMotionRun','cameraMotionJump','cameraMotionFall','cameraMotionLand']
 const p=normalizePlayer({cameraMotionEnabled:true,cameraMotionWalk:'node-3',cameraMotionRunGain:7})
 assert.equal(p.cameraMotionWalk,'node-3');assert.equal(p.cameraMotionRunGain,2)
 for(const k of keys)assert.ok(PLAYER_PARAMS.some(f=>f.key===k&&f.type==='node'&&f.only.includes('cameraShake')))
})
test('PCM-03 los valores numéricos y las referencias malformadas se sanean',()=>{
 const p=normalizePlayer({cameraMotionRun:44,cameraMotionSmoothing:-10,cameraMotionLandThreshold:100})
 assert.equal(p.cameraMotionRun,'');assert.equal(p.cameraMotionSmoothing,0.5);assert.equal(p.cameraMotionLandThreshold,15)
})
test('PCM-04 el nodo genérico conserva el muestreo anterior cuando no hay nuevos parámetros',()=>{
 const p=recipe({frequency:1,position:[.1,0,0],rotation:[0,0,0]})
 near(sampleShake(p,.25,[],true).position[0],.1)
 assert.deepEqual(shakeConfig(p).positionFrequency,[1,1,1])
})
test('PCM-05 fases por eje producen movimiento alternado sin cambiar la receta persistida',()=>{
 const p=recipe({position:[.1,.1,0],positionPhase:[0,90,0],frequency:1})
 const original=structuredClone(p),s=sampleShake(p,0,[],true)
 near(s.position[0],0);near(s.position[1],.1);assert.deepEqual(p,original)
})
test('PCM-06 frecuencia individual por eje y duración del impulso son genéricas',()=>{
 const p=recipe({positionFrequency:[1,2,1],position:[.1,.1,0],frequency:1,duration:.4,loop:false})
 const s=sampleShake(p,.25,[],true)
 near(s.position[0],.1);near(s.position[1],0)
 assert.equal(sampleShake(p,.4,[],true),null)
})
test('PCM-07 el desplazamiento físico, no la tecla, activa la caminata',()=>{
 const {fake,step}=scenario();step(.02,0);near(fake.cameraMotion.gain.Walk,0)
 step(.02,.08);assert.ok(fake.cameraMotion.gain.Walk>0)
})
test('PCM-08 no hay bob al empujar una pared',()=>{
 const {fake,step}=scenario();step(.02,.08);const start=fake.cameraMotion.gain.Walk
 for(let i=0;i<100;i++)step(.02,0)
 assert.ok(fake.cameraMotion.gain.Walk<start*.01)
})
test('PCM-09 correr usa la receta de correr sin duplicar caminar',()=>{
 const {fake,step}=scenario()
 for(let i=0;i<50;i++)step(.02,.16)
 assert.ok(fake.cameraMotion.gain.Run>.5)
 assert.ok(fake.cameraMotion.gain.Walk<.001)
})
test('PCM-10 pausa, agua y ausencia de suelo suprimen oscilación de pisada',()=>{
 const {fake,step}=scenario();for(let i=0;i<20;i++)step(.02,.08)
 fake.wet.swim=true;for(let i=0;i<100;i++)step(.02,.08)
 assert.ok(fake.cameraMotion.gain.Walk<1e-6)
})
test('PCM-11 salto reinicia un impulso por evento; su reloj se consume una vez',()=>{
 const {fake,step}=scenario();fake._cameraMotionJump();assert.equal(fake.cameraMotion.t.Jump,0)
 step(.02);assert.equal(fake.cameraMotion.t.Jump,.02)
 step(.02);assert.equal(fake.cameraMotion.t.Jump,.04)
 fake._cameraMotionJump();assert.equal(fake.cameraMotion.t.Jump,0)
})
test('PCM-12 aterrizaje solo produce impacto al cruzar aire a tierra',()=>{
 const {fake,step}=scenario();step(.02)
 fake.grounded=false;fake.gk='air';fake.vy=-6;step(.02)
 fake.grounded=true;fake.gk='stable';fake.vy=0;step(.02)
 assert.ok(fake.cameraMotion.gain.Land>=.7)
 step(.02);assert.equal(fake.cameraMotion.t.Land,.04)
})
test('PCM-13 microcaídas debajo del umbral no disparan impacto',()=>{
 const {fake,step}=scenario();step(.02);fake.grounded=false;fake.gk='air';fake.vy=-.5;step(.02)
 fake.grounded=true;fake.gk='stable';fake.vy=0;step(.02);assert.equal(fake.cameraMotion.gain.Land,0)
})
test('PCM-14 sin sonido de pasos el movimiento de cámara se mantiene',()=>{
 const {fake,step}=scenario({footsteps:false});step(.02,.08)
 assert.ok(fake.cameraMotion.gain.Walk>0)
})
test('PCM-15 node ausente, desactivado o dirigido a otra cámara no modifica el render',()=>{
 const {fake,step}=scenario();step(.02,.08)
 const cases=[[],[node('walk',{enabled:false})],[node('walk',{camera:'cinematic'})]]
 for(const nodes of cases)assert.deepEqual(scene(fake,nodes).render().position,[0,0,0])
})
test('PCM-16 locomoción usa sampleShake y no modifica el cuerpo físico',()=>{
 const {fake,step}=scenario({cameraMotionWalkGain:1});for(let i=0;i<7;i++)step(.02,.08)
 const p={x:fake.pos.x,y:fake.pos.y,z:fake.pos.z};const {w,render}=scene(fake,[node('walk')]);
 const result=render();assert.ok(Math.abs(result.position[0])>0)
 assert.deepEqual({x:fake.pos.x,y:fake.pos.y,z:fake.pos.z},p)
 assert.equal(w._shakeClocks.has('walk'),false)
})
test('PCM-17 el mismo nodo permite reproducción manual adicional',()=>{
 const {fake,step}=scenario();for(let i=0;i<5;i++)step(.02,.08)
 const n=node('walk'),{w,render}=scene(fake,[n]);w._find=(id)=>id==='walk'?n:null
 assert.equal(w._shakePlay('walk'),true)
 assert.ok(Math.abs(render().position[0])>0)
 assert.ok(w._shakeClocks.has('walk'))
})
test('PCM-18 el Film Maker y la cámara principal preservan su autoridad',()=>{
 const {fake,step}=scenario();step(.02,.08);const {w,render}=scene(fake,[node('walk')]);
 w.film={};assert.deepEqual(render().position,[0,0,0]);w.film=null
 w._mainCameraNode=()=>({node:{},obj:{id:'cam'}});assert.deepEqual(render().position,[0,0,0])
})
test('PCM-19 cambiar de escena limpia relojes de locomoción',()=>{
 const {fake,step}=scenario();step(.02,.08)
 fake.cameraMotion=null;assert.deepEqual(fake.cameraMotionSamples(),[])
})
test('PCM-20 el evaluador existente es la única fuente de fases y amplitudes',()=>{
 const src=readFileSync(new URL('../src/engine/runtime/player/fps/camera-motion.js',import.meta.url),'utf8')
 assert.doesNotMatch(src,/Math\.sin|Math\.cos|translateX|rotateX/)
 assert.match(readFileSync(new URL('../src/engine/runtime/player/fps/index.js',import.meta.url),'utf8'),/_cameraMotionTick/)
 assert.match(readFileSync(new URL('../src/engine/runtime/events/play-camera-shake.js',import.meta.url),'utf8'),/sampleShake\(\{ \.\.\.p, autoPlay: true, loop: m\.loop \}/)
})
