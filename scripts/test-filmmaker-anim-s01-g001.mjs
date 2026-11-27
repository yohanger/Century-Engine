import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { normalizeNodeTracks, sampleNodeTracks, FilmNodePose } from '../src/filmmaker/node-tracks.js'

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const v = (t,x,ease='linear',id=`k${t}`)=>({id,t,v:[x,0,0],ease})
const sample = () => [{id:'ntr1',nodeId:'node-11',name:'Taza',muted:false,properties:[{id:'prop1',prop:'position',keys:[v(0,0),v(0.6,6)]}]}]

function filmHarness(){
 const frame={FILM_FRAME_PRESETS:[{width:1920,height:1080}], normalizeFilmFrame:(f)=>f||null}
 const editSource=source('src/filmmaker/montage.js')
 const fn=editSource.match(/export function normalizeEdit\(e = \{\}\) \{[\s\S]*?\n\}/)?.[0]
 assert.ok(fn)
 const part=source('src/filmmaker/film.js').replace(/^import .+\n/gm,'').replaceAll('export const ','const ').replaceAll('export function ','function ').replaceAll('export async function ','async function ')
 const timeline={LAYER_KINDS:{},uid:()=>`uid-${Math.random()}`,num:(v,d=0)=>Number.isFinite(+v)?+v:d,r3:(v)=>Math.round(v*1000)/1000, trans:(t,d=0.6)=>({kind:t?.kind==='black'?'black':'cut',dur:Math.max(0.05,t?.dur??d)}), normalizeNodeTracks,normalizePhysicsBakes:()=>[]}
 vm.runInNewContext(fn.replace(/^export /,'' )+'\nthis.normalizeEdit=normalizeEdit',timeline)
 vm.runInNewContext(part+'\nthis.api={newFilm,normalizeFilm}',{...frame,normalizeEdit:timeline.normalizeEdit,Date,Math,JSON,Number,Map,Set,Error,console})
 // The above eval exposes values on its context object, kept explicitly below in direct VM variant.
 const c={...frame,normalizeEdit:timeline.normalizeEdit,Date,Math,JSON,Number,Map,Set,Error,console}
 vm.runInNewContext(part+'\nthis.api={newFilm,normalizeFilm}',c)
 return c.api
}

class Vector {
 constructor(a=0,b=0,c=0){this.v=[a,b,c]}
 set(...v){this.v=[...v];return this}
 toArray(){return [...this.v]}
}
class Euler extends Vector{ constructor(...x){super(...x);this.order='YXZ'} set(...v){this.v=[...v];return this} toArray(){return [...this.v,this.order]} }
function runtime(id='node-11',type='primitive'){
 const root={position:new Vector(0,1,0),rotation:new Euler(0,0,0),scale:new Vector(1,1,1),userData:{visual:{scale:new Vector(2,2,2)}},updateMatrixWorld(){this.updated=(this.updated||0)+1}}
 const viewport={requestRender(){this.called=(this.called||0)+1}}
 const ed={nodes:new Map([[id,root]]),vp:viewport}
 return {ed,root,objects:[{id,type,name:'Antigua'}]}
}

test('ANIM-01 · normalizar pistas por ID, ordenar claves y preservar easing',()=>{
 const list=normalizeNodeTracks([{...sample()[0],name:'Renombrado',properties:[{...sample()[0].properties[0],keys:[v(0.6,6,'out','k2'),v(0,0,'bezier','k1')].map(k=>k.ease==='bezier'?{...k,bz:[0.42,0,0.58,1]}:k)}]}])
 assert.deepEqual(list[0].properties[0].keys.map(k=>k.t),[0,0.6]);assert.deepEqual(list[0].properties[0].keys[0].bz,[0.42,0,0.58,1])
 assert.equal(list[0].nodeId,'node-11'); assert.equal(list[0].name,'Renombrado')
})
test('ANIM-02 · pistas opcionales vacías y presentes conservan encuadre y claves',()=>{
 const api=filmHarness()
 const base=api.newFilm({sceneId:'main'})
 const empty=api.normalizeFilm({...base,frame:{width:1080,height:1920},edit:{shots:[]}})
 assert.equal(empty.edit.nodeTracks.length,0);assert.equal(empty.frame.width,1080)
 const extended=api.normalizeFilm({...empty,edit:{...empty.edit,nodeTracks:sample()}})
 assert.deepEqual(JSON.parse(JSON.stringify(extended.edit.nodeTracks)),normalizeNodeTracks(sample()))
 assert.throws(()=>api.normalizeFilm({format:'nfm',scene:{id:'main'}}),/sin cámaras cinematográficas/)
})
test('ANIM-03 · rechazo IDs duplicados, propiedades repetidas y mismo tiempo',()=>{
 assert.throws(()=>normalizeNodeTracks([...sample(),{...sample()[0],id:'ntr2'}]),/duplicada/)
 assert.throws(()=>normalizeNodeTracks([{...sample()[0],properties:[sample()[0].properties[0],{...sample()[0].properties[0],id:'prop2'}]}]),/repetida/)
 assert.throws(()=>normalizeNodeTracks([{...sample()[0],properties:[{...sample()[0].properties[0],keys:[v(0,0,'linear','x'),v(0.000001,5,'linear','y')]}]}]),/mismo instante/)
 assert.throws(()=>normalizeNodeTracks([{...sample()[0],nodeId:''}]),/falta nodeId/)
})
test('ANIM-04 · valida easing, vector y tiempo finito; no pierde claves inválidas',()=>{
 const p=sample()[0]
 assert.throws(()=>normalizeNodeTracks([{...p,properties:[{...p.properties[0],keys:[{...v(0,0),v:[NaN,0,0]}]}]}]),/vec3/)
 assert.throws(()=>normalizeNodeTracks([{...p,properties:[{...p.properties[0],keys:[{...v(0,0),t:-1}]}]}]),/tiempo/)
 assert.throws(()=>normalizeNodeTracks([{...p,properties:[{...p.properties[0],keys:[{...v(0,0),ease:'invalid'}]}]}]),/interpolación/)
})
test('ANIM-05 · interpolación real: buscar atrás/adelante produce misma pose',()=>{
 const tracks=normalizeNodeTracks(sample())
 const get=(T)=>sampleNodeTracks(tracks,T).values.get('node-11').position[0]
 assert.equal(get(0.3),3); assert.equal(get(0.6),6); assert.equal(get(0),0);assert.equal(get(0.3),3)
 assert.deepEqual(sampleNodeTracks(tracks,0.3,new Set()).missing,['node-11'])
})
test('ANIM-06 · Three overlay restaura posición/rotación/escala original sin tocar datos escena',()=>{
 const {ed,root,objects}=runtime();const original=JSON.stringify(objects)
 const tracks=normalizeNodeTracks([{...sample()[0],properties:[...sample()[0].properties,{id:'propR',prop:'rotation',keys:[{id:'k3',t:0,v:[0,0,0],ease:'linear'},{id:'k4',t:1,v:[0,90,0],ease:'linear'}]},{id:'propS',prop:'scale',keys:[{id:'k5',t:0,v:[2,2,2],ease:'linear'},{id:'k6',t:1,v:[3,3,3],ease:'linear'}]}]}])
 const overlay=new FilmNodePose(ed,tracks,objects)
 overlay.at(.5);assert.deepEqual(root.position.toArray(),[5,0,0]);assert.ok(Math.abs(root.rotation.v[1]-Math.PI/4)<1e-8);assert.deepEqual(root.userData.visual.scale.toArray(),[2.5,2.5,2.5])
 overlay.at(0);assert.deepEqual(root.position.toArray(),[0,0,0]);overlay.at(.5);assert.deepEqual(root.position.toArray(),[5,0,0])
 overlay.restore();assert.deepEqual(root.position.toArray(),[0,1,0]);assert.deepEqual(root.userData.visual.scale.toArray(),[2,2,2]);assert.equal(JSON.stringify(objects),original)
})
test('ANIM-07 · el nombre cambia pero el nodo se identifica por ID; huérfano no se reasigna',()=>{
 const {ed,root,objects}=runtime();const tracks=normalizeNodeTracks(sample());objects[0].name='Taza Nueva'
 const overlay=new FilmNodePose(ed,tracks,objects);overlay.at(.6);assert.equal(root.position.v[0],6);overlay.restore()
 ed.nodes.delete('node-11');assert.deepEqual(overlay.at(.5),['node-11']);assert.equal(root.position.v[0],0)
})
test('ANIM-08 · no intervenir RigidBody3D ni rig de actor',()=>{
 const env=runtime('node-11','rigidbody3d');const overlay=new FilmNodePose(env.ed,normalizeNodeTracks(sample()),env.objects)
 assert.deepEqual(overlay.at(.5),['node-11']);assert.deepEqual(env.root.position.v,[0,1,0])
 const actor=runtime();assert.deepEqual(new FilmNodePose(actor.ed,normalizeNodeTracks(sample()),actor.objects,{actorId:'node-11'}).at(.6),['node-11'])
})
test('ANIM-09 · montage integra evaluación al tiempo absoluto y libera pose',()=>{
 const s=source('src/filmmaker/session.js')
 assert.match(s,/nodePose\?\.at\(T\)/);assert.match(s,/nodePose\?\.restore\(\); nodePose = null/)
 assert.match(s,/nodePose = new FilmNodePose/)
 assert.doesNotMatch(source('src/filmmaker/node-tracks.js'),/new AnimRunner\(|new TimelineRunner\(|\.updateObject\(/)
})
test('ANIM-10 · ninguna clave se transforma en override o write del proyecto',()=>{
 const film=source('src/filmmaker/film.js')
 const session=source('src/filmmaker/session.js')
 assert.match(session,/overrides: diffOverrides\(session\.baseline, P\?\.objects \|\| \[\]\)/)
 assert.match(film,/edit: normalizeEdit\(f\.edit\)/)
 assert.doesNotMatch(source('src/filmmaker/node-tracks.js'),/store\.project\.objects.*=|updateObject\(/)
})
