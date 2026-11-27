import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as M from '../src/filmmaker/montage.js'
import * as NA from '../src/filmmaker/node-authoring.js'
import { sampleCamera } from '../src/core/capture/edit.js'

const source = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8')
const nle = source('src/filmmaker/NleTimeline.vue')
const ses = source('src/filmmaker/session.js')
const app = source('src/filmmaker/FilmApp.vue')
const cameraUI = source('src/filmmaker/panels/CameraPanel.vue')
const core = source('src/core/state/film.js')
function emptyFilm() {
  return {
    id:'cinematic-01', name:'Cinematic de prueba',created:'2026-11-06T00:00:00Z',
    scene:{id:'scene-1',projectId:'project-1'},
    cameras:[{id:'cam-1',name:'Principal',pose:{pos:[2,3,4],rot:[0,90,0],fov:75},operator:{kind:'person'}}],
    activeCameraId:'cam-1',passes:[],takes:[],assets:[{id:'audio-1',name:'sonido.wav'}],
    edit:M.normalizeEdit({shots:[],layers:[],audio:[],filters:[],nodeTracks:[]})
  }
}

test('NLE-DIR-01 · crear plano no requiere take, grabación ni sesión móvil',()=>{
  const f=emptyFilm(), r=M.createEditorialShot(f,'cam-1',5)
  assert.equal(r.film.id,f.id)
  assert.equal(r.film.scene.projectId,f.scene.projectId)
  assert.equal(f.passes.length,0)
  assert.equal(r.film.takes.length,0)
  assert.equal(r.film.passes.length,1)
  assert.equal(r.film.edit.shots.length,1)
  assert.equal(r.film.passes[0].input,'editor')
  assert.equal(r.film.passes[0].take,-1)
  assert.equal(r.film.passes[0].cameraId,'cam-1')
  assert.equal(r.film.edit.shots[0].pass,r.passId)
  assert.equal(r.film.edit.shots[0].id,r.shotId)
  assert.deepEqual(r.film.assets,f.assets)
})
test('NLE-DIR-02 · el pase no grabado tiene cámara real que el evaluador puede muestrear',()=>{
  const r=M.createEditorialShot(emptyFilm(),'cam-1',4)
  const pass=r.film.passes[0]
  assert.equal(pass.keys.length,2)
  assert.deepEqual(pass.keys.map(k=>k.t),[0,4])
  for(const t of [0,1,2.5,4]) {
    const p=sampleCamera(pass.keys,t)
    assert.deepEqual(p.pos,[2,3,4])
    assert.deepEqual(p.rot,[0,90,0])
    assert.equal(p.fov,75)
  }
  assert.equal(M.sequence(r.film).items.length,1)
  assert.equal(M.sequence(r.film).total,4)
})
test('NLE-DIR-03 · ampliar el plano mueve su límite sin borrar claves ni cambiar ID',()=>{
  const { film,passId,shotId }=M.createEditorialShot(emptyFilm(),'cam-1',3)
  const expanded=M.resizeEditorialShot(film,shotId,12)
  assert.equal(expanded.id,film.id)
  assert.equal(expanded.passes.length,1)
  assert.equal(expanded.passes[0].id,passId)
  assert.equal(expanded.passes[0].duration,12)
  assert.equal(expanded.edit.shots[0].id,shotId)
  assert.equal(expanded.edit.shots[0].out,12)
  assert.equal(M.sequence(expanded).total,12)
  assert.deepEqual(sampleCamera(expanded.passes[0].keys,11).pos,[2,3,4])
  assert.equal(film.passes[0].duration,3,'modelo previo permanece inmutable')
})
test('NLE-DIR-04 · recortar plano editorial no destruye ni reescribe tomas previas',()=>{
  const r=M.createEditorialShot(emptyFilm(),'cam-1',8)
  const trimmed=M.resizeEditorialShot(r.film,r.shotId,2)
  assert.equal(trimmed.passes[0].duration,8)
  assert.equal(M.sequence(trimmed).total,2)
  assert.equal(trimmed.edit.shots[0].out,2)
  assert.equal(trimmed.passes[0].keys.length,2)
})
test('NLE-DIR-05 · un pase grabado conserva límite de fuente; no se le inventa duración',()=>{
  const r=M.createEditorialShot(emptyFilm(),'cam-1',5)
  const old={...r.film,passes:[{...r.film.passes[0],input:'mouse',take:0}],takes:[{name:'Captura original'}]}
  assert.throws(()=>M.resizeEditorialShot(old,r.shotId,9),/Solo los planos editoriales/)
  assert.equal(M.sequence(old).total,5)
  assert.equal(old.takes.length,1)
})
test('NLE-DIR-06 · entradas inválidas se rechazan sin crear planos',()=>{
  for(const id of ['','cam-inexistente']) assert.throws(()=>M.createEditorialShot(emptyFilm(),id,5),/cámara cinematográfica/)
  for(const dur of [0,-1,Infinity,NaN,3601]) assert.throws(()=>M.createEditorialShot(emptyFilm(),'cam-1',dur),/Duración/)
  const f=emptyFilm();f.cameras[0].pose.pos=[NaN,0,0]
  assert.throws(()=>M.createEditorialShot(f,'cam-1',5),/encuadre editorial válido/)
  const r=M.createEditorialShot(emptyFilm(),'cam-1',5)
  for(const dur of [NaN,-2,4000]) assert.throws(()=>M.resizeEditorialShot(r.film,r.shotId,dur),/Duración/)
})
test('NLE-DIR-07 · múltiples cámaras usan el ID de cada toma y respetan orden',()=>{
  const f=emptyFilm()
  f.cameras.push({id:'cam-2',name:'Segunda',pose:{pos:[0,5,10],rot:[0,0,0],fov:60},operator:{}})
  const a=M.createEditorialShot(f,'cam-1',2)
  const b=M.createEditorialShot(a.film,'cam-2',3)
  assert.deepEqual(M.sequence(b.film).items.map(item=>item.pass.cameraId),['cam-1','cam-2'])
  assert.deepEqual(M.sequence(b.film).items.map(item=>item.start),[0,2])
  assert.deepEqual(M.sequence(b.film).items.map(item=>item.end),[2,5])
  assert.equal(M.cameraAt(b.film,M.sequence(b.film),4).pos[2],10)
  const reordered=M.reorderShot(b.film,b.shotId,0)
  assert.deepEqual(reordered.shots.map(x=>x.id),[b.shotId,a.shotId])
})
test('NLE-DIR-08 · estructura se normaliza y puede convertirse al Timeline exportable',()=>{
  const r=M.createEditorialShot(emptyFilm(),'cam-1',5)
  const normalized=M.normalizeEdit(r.film.edit)
  assert.deepEqual(normalized.shots,r.film.edit.shots)
  const tl=M.montageTimeline({...r.film,edit:normalized},{objects:[],overrides:{}})
  assert.ok(tl.tracks.some(t=>t.kind==='camera'))
  assert.equal(tl.duration>=5,true)
})
test('NLE-DIR-09 · nodos conservan autoría por ID y el historial original',()=>{
  const f=emptyFilm()
  const withNode=NA.addNodeTrack(f.edit,'cubo-01','Cubo')
  const withProperty=NA.addProperty(withNode,'cubo-01','position')
  const withKey=NA.upsertNodeKey(withProperty,'cubo-01','position',1,[1,2,3])
  const hist=new NA.FilmTrackHistory()
  assert.equal(hist.commit(f.edit,withKey),true)
  assert.deepEqual(hist.undo(withKey).nodeTracks,[])
  assert.equal(withKey.nodeTracks[0].nodeId,'cubo-01')
  assert.equal(withKey.nodeTracks[0].properties[0].keys[0].t,1)
})
test('NLE-DIR-10 · apertura habilita edit directo sin interruptor manual, Auto-key opcional',()=>{
  assert.match(ses,/document\.title = `\$\{f\.name\} · Nether Film Maker`[\s\S]*?ensureFilmEditMode\(\)/)
  assert.match(ses,/export function ensureFilmEditMode\(\)/)
  assert.match(ses,/if \(!session\.author\.active\) setNodeAuthoring\(true\)/)
  assert.match(ses,/author: \{ active: false, autoKey: false/)
  assert.doesNotMatch(nle,/data-test="node-author-toggle"/)
  assert.match(nle,/data-test="node-autokey"/)
  assert.match(nle,/F\.ensureFilmEditMode\(\)/)
  assert.doesNotMatch(nle,/Activa Animar antes/)
})
test('NLE-DIR-11 · arrastre desde Jerarquía conserva MIME y protección de nodo',()=>{
  assert.match(nle,/application\/x-lf-node/)
  assert.match(nle,/F\.addFilmNode\(nodeId\)/)
  assert.match(ses,/function authorTarget\(nodeId\)/)
  assert.match(ses,/if \(!pose\.target\(nodeId\)\)/)
  assert.match(nle,/const node = nodeFor\(unique\[0\]\)/)
})
test('NLE-DIR-12 · cámaras arrastrables reutilizan pases y no llaman a grabación',()=>{
  assert.match(cameraUI,/application\/x-lf-film-camera/)
  assert.match(cameraUI,/:draggable="idle"/)
  assert.match(nle,/F\.createFilmEditorialShot\(cameraId, 5\)/)
  assert.match(nle,/types\.includes\(CAMERA_DRAG_TYPE\)/)
  assert.match(nle,/data-test="nle-add-camera-shot"/)
  assert.doesNotMatch(M.createEditorialShot.toString(),/startPass|startRecord|stopPass|recording/)
})
test('NLE-DIR-13 · grabación opcional conservada y no se modifican módulos móviles',()=>{
  assert.match(cameraUI,/F\.startPass\(/)
  assert.match(ses,/export async function startPass/)
  assert.match(app,/const mobileLink = createFilmMobileLink/)
  assert.match(cameraUI,/data-test="pass-rec"/)
  assert.match(ses,/export function openNativeFilm|export async function openNativeFilm/)
  assert.match(core,/nativeCinematic\(/)
})
test('NLE-DIR-14 · visor de edición evalúa efecto temporal sin escribir en escena o Player',()=>{
  const r=M.createEditorialShot(emptyFilm(),'cam-1',6)
  const next=M.addLayer(r.film,'text',1,3)
  const shot={...r.film,edit:next.edit}
  shot.edit.layers[0].params.text='Escena 01'
  assert.equal(M.effectsAt(shot,0).caption,'')
  assert.equal(M.effectsAt(shot,2).caption,'Escena 01')
  assert.equal(M.effectsAt(shot,5).caption,'')
  assert.match(app,/const editFx = computed\(/)
  assert.match(app,/filmEffectsAt\(film\.value, session\.montage\.T\)/)
  assert.match(app,/data-test="film-edit-fx"/)
  assert.match(app,/editFx\.fade/)
  assert.match(app,/editFx\.letterbox/)
  assert.match(ses,/export function previewFilmTime\(T\)/)
  assert.match(ses,/previewNodeTracks\(T\)/)
  assert.match(ses,/restoreEditorialCamera\(\)/)
})
test('NLE-DIR-15 · guardado nativo sigue por ID, snapshot de película y escena sin mutación',()=>{
  assert.match(app,/F\.prepareFilmForSave\(\)/)
  assert.match(app,/window\.lf\.cinematic\('save'/)
  assert.match(core,/args\.film\.id !== args\.cinematicId/)
  assert.match(core,/cinematicSceneStamp/)
  assert.match(core,/syncCinematicRuntime\(trial, updated, film/)
  const r=M.createEditorialShot(emptyFilm(),'cam-1',5)
  assert.equal(JSON.parse(JSON.stringify(r.film)).id,'cinematic-01')
  assert.equal(JSON.parse(JSON.stringify(r.film)).passes[0].keys.length,2)
})
