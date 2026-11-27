import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFileSync} from 'node:fs'
import {newTimeline, newTrack, newKey, sortKeys, addTimelineCameraBinding, ensureTimelineNodePropertyTrack, findTimelineNodePropertyTrack, upsertTimelineNodePropertyKey, readTimelineNodeProperty, timelineTrackNodeOwner, normalizeTimeline, timelineVisibleRows} from '../src/core/timeline/model.js'
import {nodeAnimationProperties, registerNodeAnimationProperties} from '../src/engine/runtime/anim/model.js'

const panel=readFileSync(new URL('../src/components/TimelinePanel.vue',import.meta.url),'utf8')
const sample=()=>({
  a:{id:'cam-a',name:'Cámara A',type:'camera',position:[1,2,3],rotation:[0,0,0],scale:[1,1,1],visible:true},
  b:{id:'cam-b',name:'Cámara B',type:'camera',position:[4,5,6],rotation:[0,0,0],scale:[1,1,1],visible:true},
  light:{id:'light-a',name:'Luz',type:'light',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],visible:true,color:'#ffbb22',light:{energy:2.5}},
})
const compile=(start,end,ctx)=>{const code=panel.slice(panel.indexOf(start),panel.indexOf(end,panel.indexOf(start)));assert.ok(code.startsWith(start));const sandbox=vm.createContext(ctx);vm.runInContext(code,sandbox);return sandbox}
function dropHarness(){
 const {a,b,light}=sample(),items=[a,b,light],tl={value:newTimeline('QA',{id:'qa-03',duration:8})},objects={value:items},ph={value:2}
 const commits=[],selected=[],errors=[],store={project:{activeSceneId:'scene-a'},play:{on:false},locked:false,menu:null}
 const nodeTargetId={value:null}
 const ctx={tl,objects,ph,store,nodeDropActive:{value:false},nodeAnimationProperties,findTimelineNodePropertyTrack,
  readTimelineNodeProperty, upsertTimelineNodePropertyKey, timelineTrackNodeOwner,
  computed:read=>({get value(){return read()}}), playing:{value:false}, playback:{yieldToEditing(){}},
  nodeTargetId, sel:{value:null}, selectObject(){}, visibleRows:{value:[]}, nextTick(){}, timelineMenuAnchor:()=>null,
  ensureTimelineNodePropertyTrack,addTimelineCameraBinding,newTrack,snapT:t=>Math.round(t*10)/10,
  xToTime:x=>(x-24)/70,commit:v=>commits.push(v),bump(){},pick:(tr,k)=>selected.push([tr.id,k.id]),pickTrack:tr=>selected.push([tr.id]),toast:(s,t)=>errors.push([s,t])}
 compile('const objByName =','// ---------- edición ----------',ctx)
 const drop=(nodeId=a.id,trackId=null)=>{
  const lane=trackId?{dataset:{cameraTrack:trackId},getBoundingClientRect:()=>({left:100})}:null
  const event={clientX:194,clientY:50,dataTransfer:{types:['application/x-lf-node'],getData:()=>JSON.stringify([nodeId])},target:{closest:selector=>selector==='[data-camera-track]'?lane:null},preventDefault(){},stopPropagation(){}}
  ctx.nodeDrop(event)
  const node=objects.value.find(item=>item.id===nodeTargetId.value)
  if (!trackId && node && !store.play.on && !store.locked) ctx.nodePicker(event,{nodeId:node.id,node})
  return store.menu
 }
 const choose=label=>{const action=store.menu?.items.find(x=>x.label===label);assert.ok(action,`No existe ${label}`);action.run()}
 return {a,b,light,tl,objects,ph,store,commits,selected,errors,ctx,drop,choose}
}
function keyHarness(kind='node',prop='position') {
 const {a,light}=sample(),objects={value:[a,light]},tl={value:newTimeline('QA',{id:'keys-qa',duration:8})},store={project:{activeSceneId:'scene-a'},locked:false,play:{on:false}},ph={value:0},commits=[],errors=[],picks=[],transports=[]
 const node=prop.startsWith('light.')?light:a
 const {track}=ensureTimelineNodePropertyTrack(tl.value,node,prop,'scene-a',objects.value)
 const playback={pause(){transports.push('pause')},yieldToEditing(){transports.push('yield')}}
 const ctx={tl,objects,store,ph,canAuthorProperties:{value:true},readTimelineNodeProperty,upsertTimelineNodePropertyKey,playback,commit:s=>commits.push(s),bump(){},toast:(s,t)=>errors.push([s,t]),pick:(tr,k)=>picks.push([tr.id,k.id]),pickTrack(){},trackOwner:tr=>objects.value.find(o=>o.id===tr.node),guardedTrack:tr=>!tr.locked&&!store.locked&&!store.play.on,
  snapT:t=>Math.max(0,Math.min(tl.value.duration,Math.round(t*10)/10)),newKey,sortKeys,captureView:()=>({pos:[0,0,0],rot:[0,0,0],fov:80})}
 compile('function insertNodePropertyKey(', 'function trackOwner(',ctx)
 compile('function addKey(', 'function delKey()',ctx)
 return {node,track,store,tl,ph,errors,commits,transports,ctx}
}
function laneHarness(){
 const applied=[],pauses=[],ctx={guardedTrack:tr=>!tr.locked,playback:{pause:()=>pauses.push(true)},addKey:(tr,t)=>applied.push([tr.kind,t]),xToTime:x=>(x-24)/70}
 compile('function laneDbl(e, tr)','function keydown(e)',ctx)
 const dbl=(kind,{ctrl=true,child=null,button=0,meta=false,locked=false}={})=>{
  const lane={getBoundingClientRect:()=>({left:100})}
  const target=child?{closest:()=>child}:lane
  ctx.laneDbl({target,currentTarget:lane,clientX:264,ctrlKey:ctrl,metaKey:meta,button,preventDefault(){}},{kind,locked})
 }
 return {applied,pauses,ctx,dbl}
}

test('CAMUX-01 arrastre general de Camera3D y su llave no crean una pista por sí solos',()=>{const h=dropHarness();h.drop();assert.equal(h.tl.value.tracks.length,0);assert.ok(h.store.menu?.items.some(i=>i.label==='Añadir toma de cámara'))})
test('CAMUX-02 menú presenta propiedades existentes además de la toma',()=>{const h=dropHarness();h.drop();for(const item of ['Posición','Rotación (°)','Escala','Añadir toma de cámara'])assert.ok(h.store.menu.items.some(i=>i.label===item))})
test('CAMUX-03 elegir Posición crea pista node sin pista camera',()=>{const h=dropHarness();h.drop();h.choose('Posición');assert.equal(h.tl.value.tracks.length,1);assert.equal(h.tl.value.tracks[0].kind,'node');assert.equal(h.tl.value.tracks[0].node,h.a.id)})
test('CAMUX-04 elegir toma crea pista camera con ID y tiempo actual del cabezal',()=>{const h=dropHarness();h.drop();h.ph.value=4;h.choose('Añadir toma de cámara');const [t]=h.tl.value.tracks;assert.equal(t.kind,'camera');assert.equal(t.keys[0].node,h.a.id);assert.equal(t.keys[0].t,4)})
test('CAMUX-05 repetir toma en instante original no duplica clave',()=>{const h=dropHarness();h.drop();h.choose('Añadir toma de cámara');const id=h.tl.value.tracks[0].keys[0].id;h.drop();h.choose('Añadir toma de cámara');assert.equal(h.tl.value.tracks.length,1);assert.equal(h.tl.value.tracks[0].keys.length,1);assert.equal(h.tl.value.tracks[0].keys[0].id,id)})
test('CAMUX-06 arrastrar sobre pista de toma existente aplica a ese destino explícito',()=>{const h=dropHarness();h.drop();h.choose('Añadir toma de cámara');const id=h.tl.value.tracks[0].id;h.drop(h.b.id,id);assert.equal(h.store.menu,null);assert.equal(h.tl.value.tracks.length,1);assert.equal(h.tl.value.tracks[0].keys.length,2);assert.deepEqual(h.tl.value.tracks[0].keys.map(k=>k.node),['cam-b','cam-a'])})
test('CAMUX-07 una pista multicámara conserva la identidad y no pertenece a un nodo único',()=>{const h=dropHarness();h.drop();h.choose('Añadir toma de cámara');const id=h.tl.value.tracks[0].id;h.drop(h.b.id,id);assert.equal(h.tl.value.tracks[0].id,id);assert.equal(timelineVisibleRows(h.tl.value,{sceneId:'scene-a',objects:h.objects.value}).some(r=>r.type==='node'&&r.tracks.some(tr=>tr.id===id)),false)})
test('CAMUX-08 menú obsoleto no crea pista en otro Timeline',()=>{const h=dropHarness();h.drop();h.tl.value=newTimeline('Otro',{id:'qa-04',duration:8});h.choose('Añadir toma de cámara');assert.equal(h.tl.value.tracks.length,0)})
test('CAMUX-09 menú obsoleto no crea pista en otra escena',()=>{const h=dropHarness();h.drop();h.store.project.activeSceneId='scene-b';h.choose('Añadir toma de cámara');assert.equal(h.tl.value.tracks.length,0)})
test('CAMUX-10 menú obsoleto tampoco crea propiedad en otra escena',()=>{const h=dropHarness();h.drop();h.store.project.activeSceneId='scene-b';h.choose('Posición');assert.equal(h.tl.value.tracks.length,0)})
test('CAMUX-11 nodo eliminado rechaza toma sin crear referencias fantasma',()=>{const h=dropHarness();h.drop();h.objects.value.pop();h.objects.value.shift();h.choose('Añadir toma de cámara');assert.equal(h.tl.value.tracks.length,0);assert.equal(h.errors.at(-1)[1],'error')})
test('CAMUX-12 PlayMode y editor bloqueado rechazan cambios',()=>{const h=dropHarness();h.store.play.on=true;h.drop();assert.equal(h.tl.value.tracks.length,0);assert.equal(h.store.menu,null);h.store.play.on=false;h.drop();h.store.locked=true;h.choose('Añadir toma de cámara');h.choose('Posición');assert.equal(h.tl.value.tracks.length,0)})
test('KEY-01 posición se captura como vec3 autoral',()=>{const h=keyHarness();const k=h.ctx.addKey(h.track,1.3);assert.deepEqual(Array.from(k.v),[1,2,3]);assert.equal(k.t,1.3)})
test('KEY-02 color luz se captura y valida por el catálogo compartido',()=>{const h=keyHarness('node','light.color');const k=h.ctx.addKey(h.track,2);assert.equal(k.v,'#ffbb22')})
test('KEY-03 energía de luz conserva tipo number',()=>{const h=keyHarness('node','light.energy');const k=h.ctx.addKey(h.track,2);assert.equal(k.v,2.5)})
test('KEY-04 repetición en mismo tiempo mantiene ID y sin transacción superflua',()=>{const h=keyHarness();const a=h.ctx.addKey(h.track,2),b=h.ctx.addKey(h.track,2);assert.equal(b.id,a.id);assert.equal(h.track.keys.length,1);assert.equal(h.commits.length,1)})
test('KEY-05 un valor actualizado en mismo tiempo preserva ID',()=>{const h=keyHarness();const a=h.ctx.addKey(h.track,2);h.node.position=[2,3,4];const b=h.ctx.addKey(h.track,2);assert.equal(a.id,b.id);assert.equal(h.track.keys.length,1);assert.deepEqual(Array.from(b.v),[2,3,4]);assert.equal(h.commits.length,2)})
test('KEY-06 una pista bloqueada rechaza la inserción',()=>{const h=keyHarness();h.track.locked=true;assert.equal(h.ctx.addKey(h.track,1),null);assert.equal(h.track.keys.length,0)})
test('KEY-07 registro de prueba con descriptor no requiere cases por nodo',()=>{
 const id='props.testCorr003';registerNodeAnimationProperties('qa-corr003',{[id]:{kind:'number',label:'Prueba',def:0,read:n=>n.props.testCorr003,apply(){},capture:n=>n.props.testCorr003,restore(){}}})
 const n={id:'qa',type:'qa-corr003',props:{testCorr003:3.25}},t=newTimeline('QA',{duration:6});const x=upsertTimelineNodePropertyKey(t,n,id,'scene-a',[n],1,3.25);assert.equal(x.key.v,3.25)
})
test('KEY-08 propiedad de otro nodo no puede ser insertada',()=>{const h=keyHarness();h.track.prop='light.energy';assert.equal(h.ctx.addKey(h.track,1),null);assert.equal(h.track.keys.length,0)})
test('KEY-09 lector con valor numérico inválido no inserta clave ni hace commit',()=>{const h=keyHarness('node','light.energy');h.node.light.energy=NaN;assert.equal(h.ctx.addKey(h.track,1),null);assert.equal(h.track.keys.length,0);assert.equal(h.commits.length,0)})
test('KEY-10 nuevo keyframe no modifica datos del nodo',()=>{const h=keyHarness(),before=structuredClone(h.node);h.ctx.addKey(h.track,1);assert.deepEqual(h.node,before)})
test('KEY-11 primera clave y segunda clave conservan el formato del Timeline',()=>{const h=keyHarness();h.ctx.addKey(h.track,1);h.ctx.addKey(h.track,3);assert.equal(normalizeTimeline(JSON.parse(JSON.stringify(h.tl.value))).tracks[0].keys.length,2)})
test('KEY-12 inserción captura a través de reserva del Preview',()=>{const h=keyHarness();h.ctx.addKey(h.track,1);assert.ok(h.transports.includes('yield'))})
test('KEY-13 control sobre el carril de propiedad permite Ctrl doble clic',()=>{const h=laneHarness();h.dbl('node');assert.equal(h.applied.length,1);assert.ok(Math.abs(h.applied[0][1]-2)<1e-8)})
test('KEY-14 doble clic normal en propiedad no añade claves',()=>{const h=laneHarness();h.dbl('node',{ctrl:false});assert.equal(h.applied.length,0)})
test('KEY-15 doble clic sobre una clave no genera otra',()=>{const h=laneHarness();h.dbl('node',{child:{className:'key'}});assert.equal(h.applied.length,0)})
test('KEY-16 doble clic sobre clip preexistente conserva su interacción',()=>{const h=laneHarness();h.dbl('node',{child:{className:'timeline-live-clip'}});assert.equal(h.applied.length,0)})
test('KEY-17 dobles clics sin Ctrl para pistas camera se mantienen',()=>{const h=laneHarness();h.dbl('camera',{ctrl:false});assert.equal(h.applied.length,1)})
test('KEY-18 pista bloqueada rechaza Ctrl doble clic',()=>{const h=laneHarness();h.dbl('node',{locked:true});assert.equal(h.applied.length,0)})
test('UX-01 las barras temporales especializadas se reservan a Camera3D',()=>{assert.match(panel,/v-if="row\.track\.kind === 'camera'"/);assert.match(panel,/class="node-key-interval"/);assert.doesNotMatch(panel,/<button v-for="s in motionSpans\(row\.track\)"[^\n]*v-if="row\.track\.kind === 'node'"/)})
test('UX-02 propiedad usa marcadores discretos sin texto ni asa de duración',()=>{assert.match(panel,/\.lane\.property-lane \.key\.node/);assert.match(panel,/\.lane\.property-lane \.key\.node > em \{ display:none;/);assert.match(panel,/\.lane\.property-lane \.node-key-interval[^\n]*pointer-events:none/)})
test('UX-03 no se crea sistema nuevo de keyframes ni se toca Player',()=>{assert.match(panel,/upsertTimelineNodePropertyKey/);assert.doesNotMatch(panel,/new AnimationPlayer\(|new PropertyManager\(/)})
test('UX-04 tooltip y Ctrl accesibles al usuario',()=>{assert.match(panel,/Ctrl \+ doble clic para insertar un keyframe/);assert.match(panel,/\.ctrl-over-clips/)})
