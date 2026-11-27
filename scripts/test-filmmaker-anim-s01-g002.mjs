import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  addNodeTrack, removeNodeTrack, muteNodeTrack, addProperty, upsertNodeKey,
  moveNodeKey, removeNodeKey, editNodeKey, nodeTrackOf, FilmTrackHistory,
} from '../src/filmmaker/node-authoring.js'
import { normalizeNodeTracks, sampleNodeTracks } from '../src/filmmaker/node-tracks.js'

const original = () => ({shots:[{id:'shot1',pass:'p',in:0,out:1}],layers:[{id:'layer1',kind:'text'}],audio:[{id:'audio1',clips:[]}],nodeTracks:[],outro:{kind:'cut',dur:1}})
const start = () => addNodeTrack(original(),'id-vaso','Vaso')
const keys = (edit,property='position') => nodeTrackOf(edit,'id-vaso')?.properties.find(p=>p.prop===property)?.keys||[]
const value = (edit,prop='position',id='id-vaso') => sampleNodeTracks(edit.nodeTracks,0.6).values.get(id)?.[prop]
const source = (path) => readFileSync(new URL('../'+path,import.meta.url),'utf8')

test('ANIM-UI-01 · crear pista por ID sin duplicar, sin modificar montaje',()=>{
 const e=original(), next=addNodeTrack(e,'id-vaso','Vaso')
 assert.equal(next.nodeTracks.length,1);assert.equal(addNodeTrack(next,'id-vaso','Otro'),next)
 assert.deepEqual(e.nodeTracks,[]);assert.deepEqual(next.shots,e.shots);assert.deepEqual(next.audio,e.audio)
})
test('ANIM-UI-02 · solo propiedades compatibles y sin duplicarlas',()=>{
 let e=start();e=addProperty(e,'id-vaso','position');assert.equal(e.nodeTracks[0].properties.length,1)
 assert.equal(addProperty(e,'id-vaso','position'),e)
 assert.throws(()=>addProperty(e,'id-vaso','health'),/Propiedad no animable/)
 e=addProperty(e,'id-vaso','rotation');e=addProperty(e,'id-vaso','scale')
 assert.deepEqual(e.nodeTracks[0].properties.map(p=>p.prop),['position','rotation','scale'])
})
test('ANIM-UI-03 · primer keyframe conserva ID, tiempo y valor vectorial',()=>{
 let e=upsertNodeKey(start(),'id-vaso','position',0,[0,1,0])
 assert.equal(keys(e).length,1);assert.deepEqual(keys(e)[0].v,[0,1,0]);assert.equal(keys(e)[0].t,0)
 assert.equal(e.nodeTracks[0].nodeId,'id-vaso')
})
test('ANIM-UI-04 · Auto-key repetido actualiza misma clave en lugar de duplicarla',()=>{
 let e=upsertNodeKey(start(),'id-vaso','position',0.6,[1,2,3])
 const id=keys(e)[0].id
 e=upsertNodeKey(e,'id-vaso','position',0.6,[2,3,4])
 assert.equal(keys(e).length,1);assert.equal(keys(e)[0].id,id);assert.deepEqual(keys(e)[0].v,[2,3,4])
})
test('ANIM-UI-05 · mover clave ordena cronológicamente sin alterar ID',()=>{
 let e=upsertNodeKey(start(),'id-vaso','rotation',0,[0,0,0]);e=upsertNodeKey(e,'id-vaso','rotation',2,[0,90,0]);
 const id=keys(e,'rotation')[1].id
 e=moveNodeKey(e,'id-vaso','rotation',id,0.6)
 assert.deepEqual(keys(e,'rotation').map(k=>k.t),[0,0.6]);assert.equal(keys(e,'rotation')[1].id,id)
})
test('ANIM-UI-06 · dos keys para mismo instante se rechazan',()=>{
 let e=upsertNodeKey(start(),'id-vaso','position',0,[0,0,0]);e=upsertNodeKey(e,'id-vaso','position',2,[0,1,0]);
 assert.throws(()=>moveNodeKey(e,'id-vaso','position',keys(e)[1].id,0),/Ya existe/)
 assert.deepEqual(keys(e).map(k=>k.t),[0,2])
})
test('ANIM-UI-07 · editar valor/ease y eliminación no altera otros elementos',()=>{
 let e=upsertNodeKey(start(),'id-vaso','scale',0,[1,1,1]);const k=keys(e,'scale')[0]
 e=editNodeKey(e,'id-vaso','scale',k.id,[2,3,4],'linear')
 assert.deepEqual(keys(e,'scale')[0].v,[2,3,4]);assert.equal(keys(e,'scale')[0].ease,'linear')
 e=removeNodeKey(e,'id-vaso','scale',k.id);assert.equal(keys(e,'scale').length,0)
 assert.equal(e.shots[0].id,'shot1')
})
test('ANIM-UI-08 · mute no destruye claves y detiene solo evaluación',()=>{
 let e=upsertNodeKey(start(),'id-vaso','position',0,[5,0,0])
 e=muteNodeTrack(e,'id-vaso',true)
 assert.equal(keys(e).length,1);assert.equal(sampleNodeTracks(e.nodeTracks,0).values.size,0)
 e=muteNodeTrack(e,'id-vaso',false)
 assert.deepEqual(sampleNodeTracks(e.nodeTracks,0).values.get('id-vaso').position,[5,0,0])
})
test('ANIM-UI-09 · nombre cambiante no reasigna nodeId ni claves huérfanas',()=>{
 let e=upsertNodeKey(start(),'id-vaso','position',0,[5,0,0]);e.nodeTracks[0].name='Nombre antiguo'
 const out=sampleNodeTracks(e.nodeTracks,0,new Set(['otro-id']))
 assert.deepEqual(out.missing,['id-vaso']);assert.equal(out.values.size,0)
 assert.equal(nodeTrackOf(e,'id-vaso').nodeId,'id-vaso')
})
test('ANIM-UI-10 · undo/redo de película es aislado y funciona tras borrar pista',()=>{
 const h=new FilmTrackHistory(10);const a=original(),b=addNodeTrack(a,'id-vaso','Vaso')
 assert.equal(h.commit(a,b),true);assert.equal(h.canUndo,true)
 const c=upsertNodeKey(b,'id-vaso','position',0,[1,2,3]);h.commit(b,c)
 assert.deepEqual(h.undo(c).nodeTracks,b.nodeTracks)
 assert.deepEqual(h.undo(b).nodeTracks,a.nodeTracks)
 assert.deepEqual(h.redo(a).nodeTracks,b.nodeTracks)
 h.commit(b,removeNodeTrack(b,'id-vaso'));assert.equal(h.canRedo,false)
})
test('ANIM-UI-11 · un drag = una operación, historial sin saltos por igualdad',()=>{
 const h=new FilmTrackHistory(),a=original(),b=addNodeTrack(a,'id-vaso','Vaso')
 assert.equal(h.commit(a,a),false);assert.equal(h.commit(a,b),true)
 assert.equal(h.undoStack.length,1)
})
test('ANIM-UI-12 · validación de valores y tiempos, sin mutación accidental',()=>{
 const e=start()
 for(const t of [-1,Infinity,NaN])assert.throws(()=>upsertNodeKey(e,'id-vaso','position',t,[0,0,0]),/Tiempo/)
 for(const v of [[1,2], [NaN,0,0]])assert.throws(()=>upsertNodeKey(e,'id-vaso','position',0,v),/Transform/)
 assert.deepEqual(e.nodeTracks[0].properties,[])
})
test('ANIM-UI-13 · normalización v3 conserva esquema del S01-G001 y tiempos absolutos',()=>{
 const a=upsertNodeKey(start(),'id-vaso','position',0,[0,1,0]),b=upsertNodeKey(a,'id-vaso','position',0.6,[0,0,0])
 assert.equal(normalizeNodeTracks(b.nodeTracks).length,1)
 const r=sampleNodeTracks(b.nodeTracks,0.6,new Set(['id-vaso']))
 assert.deepEqual(r.values.get('id-vaso').position,[0,0,0])
})
test('ANIM-UI-14 · el gizmo en Filmmaker intercepta escrituras al proyecto',()=>{
 const giz=source('src/core/editor/gizmo.js')
 assert.match(giz,/store\.filmMode && this\.filmTransformCapture\?\.active\?\.\(\)/)
 assert.ok(giz.indexOf('this.filmTransformCapture.finish')<giz.indexOf('updateObject(obj.id, patch'))
 const app=source('src/filmmaker/FilmApp.vue')
 assert.match(app,/editor\.filmTransformCapture = \{ active:/)
 assert.match(app,/F\.stopNodeAuthoring\(\)/)
})
test('ANIM-UI-15 · buscar cabezal parado muestra pose y el timeline tiene grupos dinámicos',()=>{
 const timeline=source('src/filmmaker/NleTimeline.vue')
 assert.match(timeline,/F\.previewFilmTime\(T\)/)
 assert.doesNotMatch(timeline,/data-test="node-author-toggle"/) // CA-001: autoría directa, sin bloqueo por interruptor
 assert.match(timeline,/data-test="node-autokey"/)
 assert.match(timeline,/v-for="tr in nodeTracks"/)
 assert.match(timeline,/v-for="part in tr\.properties"/)
 assert.match(timeline,/v-for="k in part\.keys"/)
 assert.match(timeline,/data-test="key-time"/)
})
test('ANIM-UI-16 · solo el modo authoring captura el gizmo; física permanece protegida',()=>{
 const src=source('src/filmmaker/session.js')
 assert.match(src,/if \(!session\.author\.active\) return false/)
 assert.match(src,/authorTarget\(obj\.id\)/)
 assert.match(src,/new FilmNodePose\(store\.editor/)
 assert.match(src,/stopNodeAuthoring\(\)/)
 assert.match(src,/if \(!authorPose\?\.saved\.has\(obj\.id\)\)/)
})

function gizmoCommit({autoKey,existingPose=false,fail=false}={}){
  const full=source('src/filmmaker/session.js')
  const a=full.indexOf('export function finishFilmGizmo(')
  const b=full.indexOf('const filterProfileId',a)
  const text=full.slice(a,b).replace('export function','function')
  const node={position:{v:[2,0,0],toArray(){return [...this.v]},set(...x){this.v=x}},rotation:{v:[0,Math.PI/2,0],toArray(){return [...this.v]},set(...x){this.v=x},get x(){return this.v[0]},get y(){return this.v[1]},get z(){return this.v[2]}},scale:{v:[1,1,1],toArray(){return [...this.v]},set(...x){this.v=x}},userData:{},updateMatrixWorld(){}}
  const original={id:'id-vaso',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]}
  const called=[]
  const nodeScaleTarget = new Function(source('src/engine/runtime/nodes/three-helpers.js').replace(/^import .*$/gm, '').replace(/^export /gm, '') + '\nreturn nodeScaleTarget')()
  const ctx={nodeScaleTarget,session:{film:{edit:{nodeTracks:[]}},author:{active:true,autoKey},montage:{T:0.6}},authorPose:{saved:new Map(existingPose?[['id-vaso',{}]]:[]),at:()=>called.push('preview')},store:{editor:{setSelection:()=>called.push('selection')},selectedId:'id-vaso',selectedIds:['id-vaso']},NA:{nodeTrackOf:()=>({id:'t'})},authorTarget:()=>{if(fail)throw new Error('bloqueado')},addFilmKey:(...args)=>called.push(['key',...args]),toast:(...args)=>called.push(['toast',...args]),previewNodeTracks:()=>called.push('preview-new')}
  const run=new Function(...Object.keys(ctx),`${text}\nreturn finishFilmGizmo`)(...Object.values(ctx))
  return {node,original,called,run:()=>run(original,node,false,'translate')}
}

test('ANIM-UI-17 · la primera clave del gizmo restaura posición canónica sin guardarla en la escena',()=>{
 const h=gizmoCommit({autoKey:true});assert.equal(h.run(),true)
 assert.deepEqual(h.called[0],['key','id-vaso','position',0.6,[2,0,0]])
 assert.deepEqual(h.node.position.v,[0,0,0]);assert.ok(h.called.includes('preview'))
 assert.deepEqual(h.original.position,[0,0,0])
})
test('ANIM-UI-18 · Auto-key OFF no registra nada y conserva la pose original',()=>{
 const h=gizmoCommit({autoKey:false});h.run()
 assert.ok(!h.called.some(a=>Array.isArray(a)&&a[0]==='key'))
 assert.deepEqual(h.node.position.v,[0,0,0])
})
test('ANIM-UI-19 · un nodo inválido no genera clave y muestra diagnóstico',()=>{
 const h=gizmoCommit({autoKey:true,fail:true});h.run()
 assert.ok(!h.called.some(a=>Array.isArray(a)&&a[0]==='key'))
 assert.ok(h.called.some(a=>Array.isArray(a)&&a[0]==='toast'))
})
test('ANIM-UI-20 · selección múltiple conserva historial del proyecto',()=>{
 const file=source('src/core/editor/gizmo.js')
 assert.match(file,/this\._multiDrag = null/)
 assert.match(file,/this\.filmTransformCapture\.rejectMulti\?\.\(\)/)
 assert.ok(file.indexOf('this.filmTransformCapture.rejectMulti?.()')<file.indexOf('this._finishMultiDrag(t.mode); return'))
})

test('ANIM-UI-21 · pistas sin plano y sin audio conservan RAF de autoría',()=>{
 const ui=source('src/filmmaker/NleTimeline.vue')
 assert.match(ui,/if \(!seq\.value\.items\.length && !film\.value\?\.edit\.audio\?\.some\(t => t\.clips\?\.length\)\) \{[\s\S]*?nodeTracks\.value\.some/)
 assert.match(ui,/previewStart\+\(performance\.now\(\)-previewClock\)\/1000/)
 assert.match(ui,/F\.previewFilmTime\(T\)/)
 assert.match(ui,/previewPlaying\.value=false/)
})
