import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { newTimeline, newTrack, newKey, normalizeTimeline, addTimelineClip, deleteTimelineSelection } from '../src/core/timeline/model.js'
import { insertTimelineCurveKey, timelineCurveChannels } from '../src/core/timeline/curves.js'
const panel = readFileSync(new URL('../src/components/TimelinePanel.vue',import.meta.url),'utf8')
const curve = readFileSync(new URL('../src/components/TimelineCurveEditor.vue',import.meta.url),'utf8')
const model = readFileSync(new URL('../src/core/timeline/curves.js',import.meta.url),'utf8')
function nodeScene(){const tl=newTimeline('Curvas',{duration:10}),tr=newTrack('node',{prop:'position',interpolation:'linear'});tr.keys=[newKey('node',0,{v:[0,2,0]}),newKey('node',5,{v:[10,2,0]})];tl.tracks=[tr];return {tl,tr}}
test('CORR001-01 · inserción real dentro de un tramo conserva los IDs de las claves',()=>{
 const {tl,tr}=nodeScene(),oldIds=tr.keys.map(k=>k.id)
 const key=insertTimelineCurveKey(tr,'v1',2.5,4.2,tl.duration,{v:[5,2,0]})
 assert.ok(key);assert.equal(key.t,2.5);assert.deepEqual(key.v,[5,4.2,0]);assert.deepEqual(tr.keys.map(k=>k.t),[0,2.5,5]);assert.equal(new Set(tr.keys.map(k=>k.id)).size,3);assert.deepEqual([tr.keys[0].id,tr.keys[2].id],oldIds)
 assert.equal(normalizeTimeline(tl).tracks[0].keys[1].v[1],4.2)
})
test('CORR001-02 · rechaza duplicados, fuera de tramo, valores inválidos y pistas bloqueadas sin mutación',()=>{
 const {tl,tr}=nodeScene();const original=structuredClone(tr.keys)
 for(const [t,v] of [[0,1],[5,1],[-1,1],[11,1],[2.5,Infinity],[2.5,1e12]])assert.equal(insertTimelineCurveKey(tr,'v0',t,v,tl.duration,{v:[1,2,3]}),null)
 tr.locked=true;assert.equal(insertTimelineCurveKey(tr,'v0',2,1,tl.duration,{v:[1,2,3]}),null)
 assert.deepEqual(tr.keys,original)
})
test('CORR001-03 · cámara libre conserva pose de todos los canales y FOV válido',()=>{
 const tl=newTimeline('cámara',{duration:10}),tr=newTrack('camera');tr.keys=[newKey('camera',0),newKey('camera',6)];tl.tracks=[tr]
 assert.equal(timelineCurveChannels(tr).length,7)
 const k=insertTimelineCurveKey(tr,'r1',3,72,10,{pos:[1,2,3],rot:[4,5,6],fov:81})
 assert.ok(k);assert.deepEqual(k.pos,[1,2,3]);assert.deepEqual(k.rot,[4,72,6]);assert.equal(k.fov,81)
 assert.equal(insertTimelineCurveKey(tr,'fov',4,176,10,{pos:[1,2,3],rot:[4,5,6],fov:81}),null)
})
test('CORR001-04 · eliminación comparte contrato de referencias de clips',()=>{
 const {tl,tr}=nodeScene();const k=insertTimelineCurveKey(tr,'v0',2,4,tl.duration,{v:[4,2,0]})
 assert.equal(deleteTimelineSelection(tl,[{tr:tr.id,k:k.id}]),1);assert.equal(tr.keys.length,2)
 const clip=addTimelineClip(tl,tr.id,tr.keys[0].id);assert.ok(clip)
 assert.throws(()=>deleteTimelineSelection(tl,[{tr:tr.id,k:tr.keys[0].id}]),/clip/)
 assert.equal(tr.keys.length,2)
})
test('CORR001-05 · cabecera única y Vista previa arriba, sin duplicar controles',()=>{
 const head=panel.slice(panel.indexOf('<header class="timeline-titlebar">'),panel.indexOf('</header>'))
 assert.equal((head.match(/Vista previa/g)||[]).length,1)
 assert.doesNotMatch(head,/timeline-dock-tab/)
 assert.equal((panel.match(/>Vista previa<\/button>/g)||[]).length,1)
})
test('CORR001-06 · toolbar desplazable sin ocultar zoom, Snap ni modos en panel estrecho',()=>{
 assert.match(panel,/\.bar\s*\{[^}]*overflow-x:auto/)
 assert.match(panel,/\.bar \.zoom-tools,\.bar \.snap-tools[^}]*display:inline-flex!important/)
 assert.match(panel,/class="bar" role="toolbar"[^>]*tabindex="0"/)
})
test('CORR001-07 · asa externa independiente permite arrastrar cuerpo de clip',()=>{
 assert.match(panel,/clip-tail-external/)
 assert.match(panel,/@pointerdown\.stop="clipDragDown\(\$event,row\.track,clip\)"/)
 assert.match(panel,/@pointerdown\.stop\.prevent="clipDragDown\(\$event,row\.track,clip,true\)"/)
 assert.match(panel,/\.lane \.segment-grip \{[^}]*cursor:ew-resize/)
})
test('CORR001-08 · indicador de duración mantiene el único mecanismo de arrastre',()=>{
 assert.doesNotMatch(panel,/<span class="endmark"/)
 assert.match(panel,/@pointerdown\.stop\.prevent="beginDurationResize"/)
 assert.match(panel,/@keydown\.stop="durationKeydown"/)
})
test('CORR001-09 · doble clic sobre curva y Supr editan datos, no puntos ficticios',()=>{
 assert.match(curve,/@dblclick\.stop="curveInsertFromLine"/)
 assert.match(curve,/insertTimelineCurveKey\(/)
 assert.match(curve,/deleteTimelineSelection\(/)
 assert.match(curve,/emit\('edited','Insertar clave en curvas'\)/)
 assert.match(curve,/emit\('edited','Eliminar clave de curvas'\)/)
 assert.match(model,/keys\.push\(key\);sortKeys\(track\)/)
})
test('CORR001-10 · Responsive First usa geometría y marcas dependientes del tamaño real',()=>{
 assert.match(curve,/new ResizeObserver\(sync\)/)
 assert.match(curve,/:viewBox="`0 0 \$\{graphSize\.width\} \$\{graphSize\.height\}`"/)
 assert.match(curve,/Math\.floor\(curvePlot\.value\.width\/90\)/)
 assert.match(curve,/@container \(max-width:520px\)/)
 assert.match(curve,/\.curve-body \{flex-direction:column/)
})
test('CORR001-11 · inserción no altera evaluador Editor/Player ni Nether FilmMaker',()=>{
 assert.doesNotMatch(model,/import .*evalNode|import .*evalCamera/)
 assert.match(curve,/evalNode\(tr,time\)/)
 assert.match(curve,/evalCamera\(tr,time\)/)
})
test('CORR001-12 · compilador Vue real, si está disponible',async (t)=>{
 let vue;try{vue=await import('@vue/compiler-sfc')}catch{t.skip('Vue compiler ausente; comprobar npm ci y Electron local');return}
 for(const [name,source] of [['TimelinePanel',panel],['TimelineCurveEditor',curve]]){
  const parsed=vue.parse(source,{filename:name+'.vue'});assert.deepEqual(parsed.errors,[],name)
  const result=vue.compileTemplate({source:parsed.descriptor.template.content,filename:name+'.vue',id:'qa'});assert.deepEqual(result.errors,[],name)
 }
})
