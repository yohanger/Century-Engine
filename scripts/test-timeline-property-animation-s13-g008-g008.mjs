import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { newTimeline, newTrack, normalizeTimeline, upsertTimelineNodePropertyKey } from '../src/core/timeline/model.js'

const src = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const SCENE = 'scene-a'
const light = { id: 'light-a', name: 'Lámpara', type: 'light', color: '#123456', light: {energy: 1}, position:[0,0,0], rotation:[0,0,0], scale:[1,1,1] }
const other = { id: 'light-b', name: 'Lámpara', type: 'light', color: '#ffffff', light:{energy:2}, position:[1,2,3], rotation:[0,0,0], scale:[1,1,1] }
const mesh = { id: 'mesh-a', name:'Malla', type:'mesh', position:[0,0,0], rotation:[0,0,0], scale:[1,1,1] }
const objects = [light, other, mesh]
const fresh = () => newTimeline('QA',{id:'timeline-g008',duration:5})
const insert = (tl, node=light, prop='light.energy', time=1, value=2, scene=SCENE, sceneObjects=objects) =>
  upsertTimelineNodePropertyKey(tl,node,prop,scene,sceneObjects,time,value)

// Estado observable del modelo, no mera búsqueda de cadenas.
test('G008-01 primera llave crea pista canónica y clave en el tiempo exacto',()=>{
  const tl=fresh(),r=insert(tl)
  assert.equal(r.created,true);assert.equal(r.changed,true);assert.equal(tl.tracks.length,1)
  assert.deepEqual([r.track.node,r.track.sceneId,r.track.prop,r.key.t,r.key.v],['light-a',SCENE,'light.energy',1,2])
})
test('G008-02 segunda llave reusa pista y conserva primer ID',()=>{
  const tl=fresh(),first=insert(tl),next=insert(tl,light,'light.energy',3,4)
  assert.equal(next.created,false);assert.equal(tl.tracks.length,1)
  assert.equal(tl.tracks[0].keys.length,2);assert.equal(tl.tracks[0].keys[0].id,first.key.id)
})
test('G008-03 clave en tiempo ya existente actualiza valor sin regenerar ID',()=>{
  const tl=fresh(),first=insert(tl),next=insert(tl,light,'light.energy',1,5)
  assert.equal(next.updated,true);assert.equal(tl.tracks[0].keys.length,1)
  assert.equal(next.key.id,first.key.id);assert.equal(next.key.v,5)
})
test('G008-04 escribir el mismo valor no introduce otra operación histórica',()=>{
  const tl=fresh();insert(tl);const again=insert(tl)
  assert.equal(again.changed,false);assert.equal(tl.tracks[0].keys.length,1)
})
test('G008-05 escenas distintas no comparten pistas',()=>{
  const tl=fresh();insert(tl);insert(tl,light,'light.energy',1,3,'scene-b')
  assert.equal(tl.tracks.length,2)
  assert.deepEqual(tl.tracks.map(t=>t.sceneId),['scene-a','scene-b'])
})
test('G008-06 dos nodos del mismo nombre conservan IDs distintos',()=>{
  const tl=fresh();insert(tl);insert(tl,other,'light.energy',1,4)
  assert.deepEqual(tl.tracks.map(t=>t.node),['light-a','light-b'])
})
test('G008-07 propiedades independientes de un mismo nodo',()=>{
  const tl=fresh();insert(tl);insert(tl,light,'light.color',1,'#abcdef')
  assert.deepEqual(tl.tracks.map(t=>t.prop),['light.energy','light.color'])
})
test('G008-08 clave fuera de duración no altera pistas',()=>{
  const tl=fresh()
  assert.throws(()=>insert(tl,light,'light.energy',8,2),/fuera/);assert.equal(tl.tracks.length,0)
})
test('G008-09 tiempo inválido se rechaza sin modificar datos',()=>{
  const tl=fresh();assert.throws(()=>insert(tl,light,'light.energy',NaN,2),/fuera/);assert.equal(tl.tracks.length,0)
})
test('G008-10 una pista bloqueada no recibe inserciones ni actualización',()=>{
  const tl=fresh(),first=insert(tl)
  first.track.locked=true
  assert.throws(()=>insert(tl,light,'light.energy',2,4),/bloqueada/)
  assert.throws(()=>insert(tl,light,'light.energy',1,4),/bloqueada/)
  assert.equal(first.key.v,2);assert.equal(first.track.keys.length,1)
})
test('G008-11 un recurso FilmMaker no recibe llaves de Timeline',()=>{
  const tl=fresh();tl.filmMaker={provider:'nether-film-maker',filmId:'a',sceneId:SCENE,sourceId:'clip',kind:'pass'}
  // El contrato debe impedir autoría incluso si el origen se falsifica.
  assert.throws(()=>insert(tl),/referencia|Timeline/)
})
test('G008-12 propiedad de luz no aplica a Mesh',()=>{
  const tl=fresh();assert.throws(()=>insert(tl,mesh,'light.energy',1,2),/requiere/)
  assert.equal(tl.tracks.length,0)
})
test('G008-13 valor tipado inválido no crea pista parcial',()=>{
  const tl=fresh();assert.throws(()=>insert(tl,light,'light.color',1,'red'),/Color inválido/)
  assert.equal(tl.tracks.length,0)
})
test('G008-14 referencia de nodo ausente no crea pista',()=>{
  const tl=fresh();assert.throws(()=>insert(tl,{...light,id:'no-existe'},'light.energy',1,2),/no existe/)
  assert.equal(tl.tracks.length,0)
})
test('G008-15 vector se clona; no comparte la matriz del nodo',()=>{
  const tl=fresh(),r=insert(tl,mesh,'position',2,mesh.position)
  mesh.position[0]=5;assert.equal(r.key.v[0],0)
})
test('G008-16 claves admiten orden temporal no secuencial',()=>{
  const tl=fresh();insert(tl,light,'light.energy',4,4);insert(tl,light,'light.energy',1,1)
  assert.deepEqual(tl.tracks[0].keys.map(k=>k.t),[1,4])
})
test('G008-17 serializar y normalizar conserva claves e identidad',()=>{
  const tl=fresh();insert(tl,light,'light.color',1,'#abcdef');insert(tl,light,'light.color',3,'#fedcba')
  const normalized=normalizeTimeline(JSON.parse(JSON.stringify(tl)))
  assert.deepEqual(normalized.tracks.map(tr=>[tr.id,tr.sceneId,tr.node,tr.prop,tr.keys.map(k=>[k.id,k.t,k.v])]),
    tl.tracks.map(tr=>[tr.id,tr.sceneId,tr.node,tr.prop,tr.keys.map(k=>[k.id,k.t,k.v])]))
})
test('G008-18 la operación no toca datos originales del nodo',()=>{
  const tl=fresh(),before=JSON.stringify(light);insert(tl)
  assert.equal(JSON.stringify(light),before)
})
test('G008-19 la selección del mismo nodo limpia contextos síncronamente',()=>{
  const body=src('src/core/state/objects.js')
  const fn=body.slice(body.indexOf('export function selectObject('),body.indexOf('/** Selecciona la escena abierta:',body.indexOf('export function selectObject(')))
  assert.match(fn,/store\.temporalSelection = null/)
  assert.match(fn,/store\.projSel = null/)
  assert.ok(fn.indexOf('store.temporalSelection = null')<fn.indexOf('store.selectedId = id'))
})
test('G008-20 también la selección desde viewport limpia recursos que no son Timeline',()=>{
  const body=src('src/core/state/state.js');assert.match(body,/if \(store\.projSel\) store\.projSel = null/)
})
test('G008-21 Timeline usa el cabezal compartido para sus llaves',()=>{
  const body=src('src/components/TimelinePanel.vue')
  assert.match(body,/inject\(timelinePlaybackKey\)/)
  assert.match(body,/ph = playback.time/)
  assert.match(body,/upsertTimelineNodePropertyKey\(/)
  assert.doesNotMatch(src('src/components/Inspector.vue'),/timelinePlaybackKey|upsertTimelineNodePropertyKey/)
})
test('G008-22 selección de keyframe no sobreescribe el Inspector de nodo',()=>{
  const body=src('src/components/Inspector.vue')
  const fn=body.slice(body.indexOf('function insertPropertyKey('),body.indexOf('const aq = computed(',body.indexOf('function insertPropertyKey(')))
  assert.doesNotMatch(fn,/selectTemporal\(/);assert.doesNotMatch(fn,/store\.selectedId\s*=/)
})
test('G008-23 las llaves usan el descriptor del nodo desde Timeline',()=>{
  const body=src('src/components/TimelinePanel.vue')
  assert.match(body,/nodeAnimationProperties\(row\.node\)/)
  assert.match(body,/<PropertyKey v-if="row\.track\.kind==='node'"/)
  assert.doesNotMatch(src('src/components/Inspector.vue'),/<PropertyKey/)
})
test('G008-24 no hay Auto-Key ni gestor paralelo',()=>{
  const body=src('src/components/TimelinePanel.vue')
  assert.doesNotMatch(body,/new PropertyManager|autoKeyEnabled|autoKeyFrame/)
  assert.match(body,/playback\.yieldToEditing\(\)/)
})
