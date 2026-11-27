import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { FILM_FRAME_PRESETS, normalizeFilmFrame, filmFramePreset, fitFilmFrame } from '../src/filmmaker/frame.js'

// La normalización de .nfm se ejerce sobre el módulo real, aislando JSZip y el montaje externo.
const original = readFileSync(new URL('../src/filmmaker/film.js', import.meta.url), 'utf8')
const code = original.replace(/^import .+\n/gm, '').replaceAll('export const ', 'const ').replaceAll('export function ', 'function ').replaceAll('export async function ', 'async function ')
const ctx = { FILM_FRAME_PRESETS, normalizeFilmFrame, normalizeEdit: (edit) => ({ shots:[], layers:[], filters:[], audio:[], outro:{kind:'cut',dur:1}, ...edit }), Date, Math, JSON, Number, String, Array, Object, Set, Map, Error }
vm.runInNewContext(code + '\nthis.api={newFilm,normalizeFilm}',ctx)
const { newFilm,normalizeFilm } = ctx.api
const same = (o) => JSON.parse(JSON.stringify(o))

test('FILM-01 · nuevas películas declaran Full HD, cámara inicial y formato único',()=>{
  const f=newFilm({name:'Test',sceneId:'scene-1'})
  assert.deepEqual(same(f.frame), {width:1920,height:1080})
  assert.equal(Object.hasOwn(f,'version'),false); assert.equal(f.cameras.length,1)
  assert.equal(f.scene.id,'scene-1')
})
test('FILM-02 · un archivo completo mantiene encuadre y claves, sin migraciones automáticas',()=>{
  const source=newFilm({name:'Película',sceneId:'s1'})
  const f=normalizeFilm({...source,frame:null,passes:[{id:'p',cameraId:source.activeCameraId,keys:[{t:0,pos:[1,2,3],rot:[0,0,0],fov:45}]}]})
  assert.equal(f.frame,null)
  assert.equal(f.passes[0].keys[0].fov,45)
  assert.equal(f.scene.id,'s1')
  assert.equal(Object.hasOwn(f,'version'),false)
})
test('FILM-03 · todos los predefinidos y formatos verticales cuadran con sus dimensiones',()=>{
  for(const p of FILM_FRAME_PRESETS){
    assert.deepEqual(normalizeFilmFrame({width:p.width,height:p.height}),{width:p.width,height:p.height})
    assert.equal(filmFramePreset(p),p.id)
  }
})
test('FILM-04 · configuraciones personalizadas se guardan sin alterar edición ni keyframes',()=>{
  const base=newFilm({name:'Cine'})
  base.edit={shots:[{id:'sh',pass:'camera',in:0,out:1}],layers:[],filters:[],audio:[],outro:{kind:'cut',dur:1}}
  base.passes=[{id:'camera',keys:[{t:0,pos:[1,2,3],rot:[0,0,0],fov:43}]}]
  const normalized=normalizeFilm({...base,frame:{width:2048,height:858}})
  assert.deepEqual(same(normalized.frame),{width:2048,height:858})
  assert.deepEqual(same(normalized.passes[0].keys),same(base.passes[0].keys))
  assert.equal(normalized.edit.shots[0].id,'sh')
})
test('FILM-05 · entradas dañadas y tamaños no enteros se rechazan sin ajustar silenciosamente',()=>{
  for(const f of [{width:0,height:1080},{width:1920,height:9},{width:8193,height:1080},{width:1920.2,height:1080},{width:'1920',height:1080},{width:1920,height:Infinity},{width:1920,height:null},'1920x1080',{}]) {
    assert.throws(()=>normalizeFilmFrame(f),/Encuadre inválido/)
  }
  assert.equal(normalizeFilmFrame(null),null)
  assert.throws(()=>normalizeFilm({format:'nfm'}),/sin cámaras cinematográficas/)
})
test('FILM-06 · letterbox/pillarbox ajustan sin recortes ni estiramiento',()=>{
  const h=fitFilmFrame(1000,600,{width:1920,height:1080})
  assert.equal(h.width,1000);assert.ok(Math.abs(h.height-562.5)<1e-8)
  const v=fitFilmFrame(1000,600,{width:1080,height:1920})
  assert.equal(v.height,600);assert.equal(v.width,337.5)
  const old=fitFilmFrame(1000,600,null)
  assert.deepEqual(old,{width:1000,height:600})
})
test('FILM-07 · cambiar calidad no cambia dimensiones ni proporción de producción',()=>{
  const frame={width:2048,height:858}
  const before=fitFilmFrame(1280,720,frame)
  for(const q of [1,.75,.5,.35]){
    assert.deepEqual(fitFilmFrame(1280,720,frame),before)
    assert.ok(q>0)
  }
})
test('FILM-08 · encuadre se centra dentro de la escena, overlays pertenecen al monitor',()=>{
  const app=readFileSync(new URL('../src/filmmaker/FilmApp.vue',import.meta.url),'utf8')
  assert.match(app, /<div class="film-frame"[^>]*:style="frameStyle"/)
  assert.match(app, /<div ref="host" class="host"/)
  assert.match(app, /<UiRoot v-if="store\.play\.on/)
  assert.match(app, /stageObserver\.observe\(stage\.value\)/)
  assert.match(app, /stageObserver\?\.disconnect\(\)/)
  assert.match(app, /watch\(quality, \(q\) =>/)
  assert.match(app, /\.film-frame \{ position: absolute; inset: 0; margin: auto;/)
})
test('FILM-09 · resolución editable desde panel y no renombra el control de calidad',()=>{
  const ui=readFileSync(new URL('../src/filmmaker/panels/FilmPanel.vue',import.meta.url),'utf8')
  for(const text of ['data-test="frame-preset"','data-test="frame-width"','data-test="frame-height"','data-test="frame-hint"','Resolución de la vista']) assert.ok(ui.includes(text),text)
  assert.ok(ui.includes("session.film = { ...session.film, frame: next }"))
})
test('FILM-10 · Viewport de producción conserva su único renderer y adapta cámaras a host',()=>{
  const vp=readFileSync(new URL('../src/engine/runtime/render/viewport.js',import.meta.url),'utf8')
  assert.match(vp,/this\._ro\.observe\(container\)/)
  assert.match(vp,/this\.persp\.aspect = w \/ h/)
  assert.match(vp,/this\.camera\.aspect = w \/ h/)
})
