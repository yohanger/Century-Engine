import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerNode, getDef } from '../src/engine/runtime/nodes/registry.js'
import { PROPS, nodeAnimationProperty, nodeAnimationProperties, validatePropertyValue, normalizeClip, newTrack as newClipTrack, newKey as newClipKey } from '../src/engine/runtime/anim/model.js'
import { sampleTrack } from '../src/engine/runtime/anim/eval.js'
import { newTimeline, upsertTimelineNodePropertyKey, normalizeTimeline, findTimelineNodePropertyTrack } from '../src/core/timeline/model.js'
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8')
const name='qa-universal-s13g008'
const owner={type:name,base:'Node3D',label:'QA universal',create:()=>({props:{pulse:.2}}),build:()=>({userData:{}}),update:()=>{},
  animation:{'props.pulse':{
    label:'Pulso',kind:'number',def:.2,min:0,max:5,
    read:obj=>obj.props.pulse,
    apply:(root,v)=>{root.userData.pulse=v},
    capture:root=>root.userData.pulse,
    restore:(root,v)=>{root.userData.pulse=v},
  }}}
registerNode(owner)
const source={type:name,id:'qa-u1',name:'Entidad QA',props:{pulse:.2},position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],visible:true}
const second={...source,id:'qa-u2',name:'Entidad QA',props:{pulse:.7}}
const prepared=()=>newTimeline('QA',{id:'tl-g008-ua',duration:5})
const put=(tl,node=source,time=1,val=.2,scene='scene-1')=>upsertTimelineNodePropertyKey(tl,node,'props.pulse',scene,[source,second],time,val)
const prop='props.pulse'

test('UA-01 metadata de nuevo nodo en la definición original y catálogo PROPS compartido',()=>{
  const def=getDef(name);assert.strictEqual(def.animation[prop],PROPS[prop]);assert.equal(PROPS[prop].ownerType,name);assert.equal(PROPS[prop].kind,'number')
})
test('UA-02 propiedad reconocida para su dueño, no para un nodo ajeno',()=>{
  assert.strictEqual(nodeAnimationProperty(source,prop),PROPS[prop]);assert.equal(nodeAnimationProperty({...source,type:'mesh'},prop),null)
  assert.equal(nodeAnimationProperties(source).filter(([id])=>id===prop).length,1)
})
test('UA-03 un nuevo tipo admite creación de pista y clave con tiempo exacto',()=>{
  const tl=prepared(),made=put(tl)
  assert.equal(made.created,true);assert.equal(made.track.prop,prop);assert.equal(made.key.t,1);assert.equal(made.key.v,.2)
})
test('UA-04 misma posición temporal actualiza la clave sin duplicación',()=>{
  const tl=prepared(),first=put(tl),secondKey=put(tl,source,1,2)
  assert.equal(secondKey.updated,true);assert.equal(secondKey.key.id,first.key.id);assert.equal(tl.tracks.length,1);assert.equal(tl.tracks[0].keys.length,1)
})
test('UA-05 llaves independientes por escena y por ID, no por nombre',()=>{
  const tl=prepared();put(tl);put(tl,second,1,.7);put(tl,source,1,.4,'scene-2')
  assert.equal(tl.tracks.length,3)
  assert.deepEqual(tl.tracks.map(t=>[t.sceneId,t.node]),[['scene-1','qa-u1'],['scene-1','qa-u2'],['scene-2','qa-u1']])
})
test('UA-06 rango numérico y tipos inválidos son rechazados antes de mutación',()=>{
  const tl=prepared();for(const value of [-1,6,NaN,Infinity,'1']) assert.throws(()=>put(tl,source,1,value))
  assert.equal(tl.tracks.length,0)
})
test('UA-07 no se permite registrar una propiedad con alias arbitrario o sin contrato completo',()=>{
  const original=Object.keys(PROPS).length
  assert.throws(()=>registerNode({type:'qa-bad-owner',create:()=>({}),build:()=>({}),update:()=>{},animation:{'props..evil':owner.animation[prop]}}),/Descriptor/)
  assert.throws(()=>registerNode({type:'qa-bad-owner-2',create:()=>({}),build:()=>({}),update:()=>{},animation:{'props.missing':{kind:'number',label:'M',def:0,read:()=>0}}}),/Descriptor/)
  assert.equal(Object.keys(PROPS).length,original)
})
test('UA-08 otra propiedad no puede suplantar el mismo ID',()=>{
  const original=PROPS[prop]
  assert.throws(()=>registerNode({type:'qa-dupe',create:()=>({}),build:()=>({}),update:()=>{},animation:{[prop]:owner.animation[prop]}}),/duplicado/)
  assert.strictEqual(PROPS[prop],original)
})
test('UA-09 la interpolación usa el evaluador tipado original de Animation Clips',()=>{
  const tr={prop,keys:[{id:'a',t:0,v:.2,ease:'linear'},{id:'b',t:2,v:2.2,ease:'linear'}]}
  assert.equal(sampleTrack(tr,0),.2);assert.equal(sampleTrack(tr,1),1.2);assert.equal(sampleTrack(tr,2),2.2)
})
test('UA-10 lector/aplicador y snapshot son los propios del nodo',()=>{
  const root={userData:{pulse:3}}
  const spec=nodeAnimationProperty(source,prop),captured=spec.capture(root,source)
  assert.equal(spec.read(source),.2)
  spec.apply(root,1.2,source);assert.equal(root.userData.pulse,1.2)
  spec.restore(root,captured,source);assert.equal(root.userData.pulse,3)
  assert.equal(source.props.pulse,.2)
})
test('UA-11 guardar/reabrir conserva identidad de pista y valores tipados',()=>{
  const tl=prepared();put(tl);put(tl,source,4,3)
  const normalized=normalizeTimeline(JSON.parse(JSON.stringify(tl)))
  assert.equal(normalized.tracks[0].prop,prop)
  assert.deepEqual(normalized.tracks[0].keys.map(k=>[k.id,k.t,k.v]),tl.tracks[0].keys.map(k=>[k.id,k.t,k.v]))
})
test('UA-12 Animation Clips conoce el mismo tipo, sin catálogo paralelo',()=>{
  const clip=normalizeClip({name:'QA',duration:2,tracks:[{path:'',prop,keys:[{id:'k1',t:0,v:.2},{id:'k2',t:2,v:2}]}]})
  assert.equal(clip.tracks[0].prop,prop);assert.equal(clip.tracks[0].keys[1].v,2)
})
test('UA-13 pista bloqueada rechaza inserción sin mutar nada',()=>{
  const tl=prepared();const r=put(tl);r.track.locked=true
  assert.throws(()=>put(tl,source,2,4),/bloqueada/);assert.equal(tl.tracks[0].keys.length,1)
})
test('UA-14 no admite la propiedad de otro nodo aunque PROPS la conozca',()=>{
  const tl=prepared();assert.throws(()=>put(tl,{...source,type:'camera'},1,2),/no es animable/)
  assert.equal(tl.tracks.length,0)
})
test('UA-15 evaluación Timeline integra estrategia general sin if por nombre del nodo',()=>{
  const s=read('src/engine/runtime/timeline/eval.js')
  assert.match(s,/PROPS\[track\.prop\]\?\.ownerType/)
  assert.match(s,/sampleAnimationTrack\(track, t\)/)
  assert.doesNotMatch(s,/props\.pulse/)
})
test('UA-16 runtime PlayMode integra aplicadores con propiedad y restauración, no managers',()=>{
  const s=read('src/engine/runtime/events/play-timeline.js')
  assert.match(s,/spec\.capture\(node, obj\)/);assert.match(s,/rec\.spec\.restore\(rec\.node, rec\.snapshot, rec\.obj\)/)
  assert.match(s,/custom\.apply\(node, v, o\)/)
  assert.doesNotMatch(s,/props\.pulse/)
})
test('UA-17 Clips reconoce lector y aplicador por propietario sin excepciones por tipo',()=>{
  const s=read('src/engine/runtime/events/play-anim.js');assert.match(s,/custom\.capture\(n, t\.obj\)/)
  assert.match(s,/if \(custom\?\.ownerType\) custom\.apply\(n, v, t\.obj\)/)
})
test('UA-18 Preview separa valor temporal de la propiedad guardada',()=>{
  const s=read('src/core/timeline/preview.js')
  assert.match(s,/custom\.capture\(target\.n, target\.o\)/)
  assert.match(s,/descriptor\.restore\(node, record\.snapshot, authored\)/)
})
test('UA-19 el selector lee descriptores del nodo y evita propiedades escritas a mano',()=>{
  const panel=read('src/components/TimelinePanel.vue')
  assert.match(panel,/nodeAnimationProperties\(row\.node\)/)
  assert.match(panel,/label: spec\.label/)
  assert.doesNotMatch(panel,/props\.pulse/)
})
test('UA-20 la fila de propiedad conserva el componente genérico y su estado accesible',()=>{
  const panel=read('src/components/TimelinePanel.vue')
  assert.equal((panel.match(/<PropertyKey /g)||[]).length,2)
  assert.doesNotMatch(read('src/components/Inspector.vue'),/<PropertyKey /)
  const key=read('src/components/PropertyKey.vue');assert.match(key,/aria-pressed/);assert.match(key,/defineEmits\(\['insert'\]\)/)
})
test('UA-21 no se crea AnimationPlayer, catalogo paralelo ni Auto-Key',()=>{
  const s=read('src/components/Inspector.vue');assert.doesNotMatch(s,/autoKeyEnabled|AnimationManager/)
  const k=read('src/components/PropertyKey.vue');assert.doesNotMatch(k,/setInterval|requestAnimationFrame/)
})
test('UA-22 no cambia política Jolt ni hace otro sistema de cámara',()=>{
  const source=read('src/engine/runtime/events/play-timeline.js')
  assert.match(source,/_tlChannelOwner/);assert.match(source,/_tlChannelAcquire/)
  assert.doesNotMatch(source,/new AnimationPlayer/)
})
test('UA-23 la selección de nodo original sigue despejando el Inspector temporal al primer click',()=>{
  const source=read('src/core/state/objects.js')
  assert.match(source,/store\.temporalSelection = null/)
  assert.match(source,/store\.projSel = null/)
})
test('UA-24 plantilla QA Electron debe exigir nodo nuevo y ruta metadata original',()=>{
  const s=read('scripts/fixtures/editor/timeline-universal-keyframes-s13-g008-corr001.html')
  assert.match(s,/registerNode/);assert.match(s,/data-node-property/)
  assert.match(s,/props\.pulse/)
})
