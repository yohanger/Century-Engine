import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PROPS, normalizeClip, validatePropertyValue } from '../src/engine/runtime/anim/model.js'
import {
  newTimeline, newTrack, newKey, newTimelinePropertyKey, normalizeTrack, normalizeTimeline,
  timelinePropertySpec, timelinePropertyPlayable, findTimelineNodePropertyTrack,
  ensureTimelineNodePropertyTrack, NODE_PROPS, keyParams,
} from '../src/core/timeline/model.js'

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const scene = 'scene-a'
const light = { id:'light-1', name:'Luz', type:'light' }
const mesh = { id:'mesh-1', name:'Caja', type:'mesh' }
const objects = [light, mesh]
const prep = (prop, values) => ({ id:'tr-light', kind:'node', name:'Luz', byId:true, node:light.id,
  sceneId:scene, prop, keys:values.map((v,i)=>({id:`k-${i}`,t:i*2,ease:'inOut',v})) })

test('G006-01 · reusa metadatos de Animation Clips, sin otro catálogo de tipos', () => {
  for (const [key,kind] of [['position','vec3'],['visible','bool'],['light.energy','number'],['light.color','color']]) {
    assert.strictEqual(timelinePropertySpec(key),PROPS[key]);assert.equal(PROPS[key].kind,kind)
  }
  assert.deepEqual(NODE_PROPS.map(v=>v[0]),['position','rotation','scale','visible'])
  assert.equal(timelinePropertySpec('arbitrary.path'),null)
})
test('G006-02 · catálogo tipado permanece compartido y los aplicadores se activan al existir G007', () => {
  for (const key of ['light.energy','light.color','position','rotation','scale','visible']) assert.equal(timelinePropertyPlayable(key),true)
  assert.equal(timelinePropertyPlayable('missing.property'),false)
})
test('G006-03 · valores numéricos finitos y rangos conocidos', () => {
  assert.equal(validatePropertyValue('light.energy',1.2),1.2)
  for (const v of [-1, NaN, Infinity, -Infinity, '2', null]) assert.throws(()=>validatePropertyValue('light.energy',v))
})
test('G006-04 · colores validan seis dígitos hexadecimales y se normalizan', () => {
  assert.equal(validatePropertyValue('light.color','#AABBCC'),'#aabbcc')
  for (const v of ['red','#abc','aabbcc','#12345678',2,null]) assert.throws(()=>validatePropertyValue('light.color',v))
})
test('G006-05 · vec3 rechaza NaN, strings, longitud incorrecta y conserva array original', () => {
  const data=[1,2,3], copy=validatePropertyValue('position',data)
  assert.deepEqual(copy,data);assert.notStrictEqual(copy,data)
  for(const v of [[1,2],[1,2,3,4],[1,'2',3],[1,NaN,3],null]) assert.throws(()=>validatePropertyValue('position',v))
})
test('G006-06 · bool tipado estricto',()=>{
  assert.equal(validatePropertyValue('visible',false),false)
  for(const v of [0,1,'false',null,undefined]) assert.throws(()=>validatePropertyValue('visible',v))
})
test('G006-07 · propiedad inexistente no se convierte silenciosamente en posición',()=>{
  assert.throws(()=>normalizeTrack({...prep('missing', [1])}),/desconocida/)
})
test('G006-08 · claves number conservan IDs y tiempos durante normalización',()=>{
  const t=normalizeTrack(prep('light.energy',[0.5,2]))
  assert.equal(t.prop,'light.energy');assert.deepEqual(t.keys.map(k=>[k.id,k.t,k.v]),[['k-0',0,0.5],['k-1',2,2]])
})
test('G006-09 · color de la clave conserva tipo y canoniza sin crear otro canal',()=>{
  const t=normalizeTrack(prep('light.color',['#AABBCC','#000000']))
  assert.deepEqual(t.keys.map(k=>k.v),['#aabbcc','#000000'])
})
test('G006-10 · normalización no admite clave tipada inválida',()=>{
  for(const value of [NaN,'1',null]) assert.throws(()=>normalizeTrack(prep('light.energy',[value])))
})
test('G006-11 · la pista tipada requiere ID real y sceneId explícito',()=>{
  assert.throws(()=>normalizeTrack({...prep('light.color',['#ffffff']),sceneId:undefined}),/necesita ID/)
  assert.throws(()=>normalizeTrack({...prep('light.color',['#ffffff']),byId:false}),/referencia de escena/)
})
test('G006-12 · pistas heredadas sin sceneId sobreviven con misma identidad',()=>{
  const legacy={kind:'node', id:'track-old',node:'Luz',prop:'position',keys:[{id:'old',t:1,v:[1,2,3]}]}
  const t=normalizeTrack(legacy)
  assert.equal(t.id,'track-old');assert.equal(t.node,'Luz');assert.equal(t.byId,false)
  assert.equal(Object.hasOwn(t,'sceneId'),false);assert.equal(t.keys[0].id,'old')
})
test('G006-13 · crear pista una vez y reusarla para la misma identidad',()=>{
  const tl=newTimeline('Prueba')
  const a=ensureTimelineNodePropertyTrack(tl,light,'light.color',scene,objects)
  const b=ensureTimelineNodePropertyTrack(tl,light,'light.color',scene,objects)
  assert.equal(a.created,true);assert.equal(b.created,false);assert.strictEqual(a.track,b.track)
  assert.equal(tl.tracks.length,1);assert.equal(a.track.byId,true);assert.equal(a.track.sceneId,scene)
})
test('G006-14 · misma propiedad en distintas escenas no colisiona',()=>{
  const tl=newTimeline('Prueba')
  const a=ensureTimelineNodePropertyTrack(tl,light,'light.color',scene,objects)
  const b=ensureTimelineNodePropertyTrack(tl,light,'light.color','scene-b',objects)
  assert.equal(a.created,true);assert.equal(b.created,true);assert.equal(tl.tracks.length,2)
})
test('G006-15 · nombres de nodo repetidos no generan asociación ambigua',()=>{
  const duplicate={id:'light-2',name:'Luz',type:'light'}
  const tl=newTimeline('Prueba',{tracks:[newTrack('node',{node:'Luz',prop:'position'})]})
  const made=ensureTimelineNodePropertyTrack(tl,light,'position',scene,[light,duplicate])
  assert.equal(made.created,true);assert.equal(made.track.byId,true)
})
test('G006-16 · si una pista heredada referencia nombre único, se reutiliza sin mutar datos',()=>{
  const old=newTrack('node',{node:'Luz',prop:'position',keys:[newKey('node',0)]})
  const tl=newTimeline('Prueba',{tracks:[old]})
  const found=findTimelineNodePropertyTrack(tl,light,'position',scene,objects)
  assert.strictEqual(found,old)
  const result=ensureTimelineNodePropertyTrack(tl,light,'position',scene,objects)
  assert.strictEqual(result.track,old);assert.equal(result.created,false);assert.equal(old.byId,undefined)
})
test('G006-17 · duplicate escena+nodo+prop detectado durante normalización',()=>{
  const tl=newTimeline('Duplicado',{tracks:[prep('light.color',['#ffffff']),{...prep('light.color',['#ffffff']),id:'otro'}]})
  assert.throws(()=>normalizeTimeline(tl),/pista duplicada/)
})
test('G006-18 · otros canales del mismo nodo permanecen independientes',()=>{
  const tl=newTimeline('Prueba')
  ensureTimelineNodePropertyTrack(tl,light,'light.color',scene,objects)
  ensureTimelineNodePropertyTrack(tl,light,'light.energy',scene,objects)
  assert.equal(tl.tracks.length,2)
})
test('G006-19 · no admite propiedades de Light sobre Mesh',()=>{
  const tl=newTimeline('Prueba')
  assert.throws(()=>ensureTimelineNodePropertyTrack(tl,mesh,'light.energy',scene,objects),/Light/)
  assert.throws(()=>ensureTimelineNodePropertyTrack(tl,{id:'missing',type:'light'},'light.energy',scene,objects),/no existe/)
  assert.equal(tl.tracks.length,0)
})
test('G006-20 · clave tipada se construye manualmente con tiempo y valor verificados',()=>{
  const k=newTimelinePropertyKey('light.color',1.5,'#ABCDEF')
  assert.equal(k.t,1.5);assert.equal(k.v,'#abcdef');assert.ok(k.id)
  assert.throws(()=>newTimelinePropertyKey('light.energy',-1,1))
})
test('G006-21 · guardar/cargar conserva recursos tipados sin renumeración',()=>{
  const tl=newTimeline('Prueba',{tracks:[prep('light.color',['#FFFFFF','#112233']),{...prep('light.energy',[0,2]),id:'energy'}]})
  const a=normalizeTimeline(tl),b=normalizeTimeline(JSON.parse(JSON.stringify(a)))
  assert.deepEqual(b,a)
  assert.equal(b.tracks[0].keys[1].id,'k-1')
})
test('G006-22 · clips existentes siguen admitiendo valores de luz sin cambios de formato',()=>{
  const clip=normalizeClip({id:'clip',name:'Prueba',tracks:[{id:'tr',path:'',prop:'light.energy',keys:[{id:'k',t:0,v:1.5}]}]})
  assert.equal(clip.tracks[0].prop,'light.energy')
  assert.equal(clip.tracks[0].keys[0].v,1.5)
})
test('G006-23 · datos tipados usan evaluador específico sin convertirse en transformación',()=>{
  const s=read('src/engine/runtime/timeline/eval.js')
  assert.match(s,/sampleAnimationTrack\(track, t\)/)
  assert.match(read('src/engine/runtime/timeline/player.js'),/if \(value !== undefined\) h\.node/)
})
test('G006-24 · clave incompatible no produce corrimiento de clips / evaluación',()=>{
  assert.throws(()=>normalizeTrack({...prep('light.energy',[1,2]),clips:[{id:'x'}]}),/requieren evaluador/)
})
test('G006-25 · los tracks legados siguen mostrando campos y los tipados usan su tipo',()=>{
  assert.equal(keyParams({kind:'node',prop:'position'}).find(p=>p.key==='v').type,'vec3')
  assert.equal(keyParams({kind:'node',prop:'visible'}).find(p=>p.key==='v').type,'bool')
  assert.equal(keyParams({kind:'node',prop:'light.energy'}).find(p=>p.key==='v').type,'number')
  assert.equal(keyParams({kind:'node',prop:'light.color'}).find(p=>p.key==='v').type,'color')
})
test('G006-26 · parser y editor siguen usando las APIs existentes sin segundo gestor',()=>{
  const source=read('src/components/TimelinePanel.vue')
  assert.match(source,/upsertTimelineNodePropertyKey/)
  assert.match(read('src/core/timeline/model.js'),/ensureTimelineNodePropertyTrack/)
  assert.doesNotMatch(source,/AnimationPlayer|class .*PropertyManager/)
})
