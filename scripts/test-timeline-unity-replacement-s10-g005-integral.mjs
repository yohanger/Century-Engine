import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { newTimeline,newTrack,newKey,normalizeTimeline,addTimelineClip } from '../src/core/timeline/model.js'
import {timelineCurveChannels,timelineCurveKeyValue,timelineCurveCanRetime,editTimelineCurveKey,editTimelineCurveTangent,resetTimelineCurveTangent,editTimelineCurveBezier} from '../src/core/timeline/curves.js'
const root=new URL('../',import.meta.url)
const panel=readFileSync(new URL('src/components/TimelinePanel.vue',root),'utf8')
const graph=readFileSync(new URL('src/components/TimelineCurveEditor.vue',root),'utf8')
const runtime=readFileSync(new URL('src/engine/runtime/timeline/eval.js',root),'utf8')
const preview=readFileSync(new URL('src/core/timeline/preview.js',root),'utf8')
const player=readFileSync(new URL('src/engine/runtime/timeline/player.js',root),'utf8')
const inspector=readFileSync(new URL('src/components/TemporalResourceInspector.vue',root),'utf8')
function scene(prop='position',interpolation='cubic'){
 const tl=newTimeline('G005',{duration:12}),tr=newTrack('node',{prop,interpolation})
 tr.keys=[newKey('node',1,{v:prop==='rotation'?[350,0,0]:[0,0,0]}),newKey('node',4,{v:prop==='rotation'?[10,0,0]:[10,5,-2]}),newKey('node',8,{v:[20,5,0]})]
 tl.tracks=[tr];return {tl,tr}
}
const first=(tr)=>tr.keys[0]
// Carga el evaluador de producción, no un evaluador alternativo: se reemplazan únicamente los imports de Three para Node sin dependencias.
async function nodeEvalWithoutThree(){
 const source=runtime.replace("import * as THREE from 'three'",'const THREE = {Euler:class {},Quaternion:class {}}').replace("import { easeValue as animationEase } from '../anim/eval.js'",'const animationEase = (_k,u)=>u')
 return import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))
}
test('G005-01 · usa canales originales, sin nuevos recursos persistentes',()=>{
 const {tr}=scene();assert.deepEqual(timelineCurveChannels(tr).map(c=>c.id),['v0','v1','v2'])
 assert.equal(timelineCurveKeyValue(first(tr),timelineCurveChannels(tr)[0]),0)
 assert.deepEqual(timelineCurveChannels(newTrack('audio')),[])
 assert.deepEqual(timelineCurveChannels(newTrack('node',{prop:'visible'})),[])
})
test('G005-02 · cámara libre expone posición, rotación y FOV; cámara ligada no inventa pose',()=>{
 const camera=newTrack('camera');camera.keys=[newKey('camera',0),newKey('camera',2)]
 assert.deepEqual(timelineCurveChannels(camera).map(c=>c.id),['p0','p1','p2','r0','r1','r2','fov'])
 camera.keys[1].mode='node';assert.deepEqual(timelineCurveChannels(camera),[])
})
test('G005-03 · editar valor y tiempo cambia la clave original y no crea datos paralelos',()=>{
 const {tl,tr}=scene();const k=first(tr),id=k.id,count=tr.keys.length
 assert.equal(editTimelineCurveKey(tr,id,'v0',{time:1.5,value:2.5},tl.duration),true)
 assert.deepEqual([k.t,k.v[0],k.id,tr.keys.length],[1.5,2.5,id,count])
})
test('G005-04 · rechaza conflictos temporales y fuera de duración sin mutación',()=>{
 const {tl,tr}=scene(),k=first(tr),before=structuredClone(k)
 for(const t of [-1,5,13,Number.NaN])assert.equal(editTimelineCurveKey(tr,k.id,'v0',{time:t,value:4},tl.duration),false)
 assert.deepEqual(k,before)
})
test('G005-05 · bloqueo y pista física impiden todas las operaciones',()=>{
 const {tl,tr}=scene(),k=first(tr);tr.locked=true
 assert.equal(editTimelineCurveKey(tr,k.id,'v1',{value:7},tl.duration),false)
 assert.equal(editTimelineCurveTangent(tr,k.id,'v0','out',3),false)
 assert.equal(editTimelineCurveBezier(tr,k.id,0,.2,.4),false)
 assert.equal(editTimelineCurveKey(newTrack('bake'),k.id,'v0',{value:1},tl.duration),false)
})
test('G005-06 · no permite FOV fuera del intervalo del contrato',()=>{
 const c=newTrack('camera'),k=newKey('camera',0);c.keys=[k,newKey('camera',2)]
 assert.equal(editTimelineCurveKey(c,k.id,'fov',{value:171},12),false)
 assert.equal(editTimelineCurveKey(c,k.id,'fov',{value:90},12),true)
 assert.equal(k.fov,90)
})
test('G005-07 · referencias de clips fijan tiempo, no el valor',()=>{
 const {tl,tr}=scene();tr.interpolation='linear';const k=first(tr)
 addTimelineClip(tl,tr.id,k.id)
 assert.equal(timelineCurveCanRetime(tr,k),false)
 assert.equal(editTimelineCurveKey(tr,k.id,'v0',{time:2,value:5},tl.duration),false)
 assert.equal(editTimelineCurveKey(tr,k.id,'v0',{value:5},tl.duration),true)
 assert.equal(k.t,1)
})
test('G005-08 · tangente cúbica guarda valores por eje y no toca los demás',()=>{
 const {tl,tr}=scene(),k=first(tr)
 assert.equal(editTimelineCurveTangent(tr,k.id,'v0','out',12),true)
 assert.deepEqual(k.tanOut,[12,null,null]);assert.equal(k.t,1)
 assert.equal(editTimelineCurveTangent(tr,k.id,'v0','out',12),false)
 const reloaded=normalizeTimeline(tl)
 assert.deepEqual(reloaded.tracks[0].keys[0].tanOut,[12,null,null])
})
test('G005-09 · límites de tangentes y cardinalidad respetan la interpolación',()=>{
 const {tr}=scene(),k=first(tr)
 assert.equal(editTimelineCurveTangent(tr,k.id,'v0','in',2),false)
 assert.equal(editTimelineCurveTangent(tr,k.id,'v0','out',Infinity),false)
 assert.equal(editTimelineCurveTangent(tr,k.id,'v0','out',1e9),false)
 tr.interpolation='linear';assert.equal(editTimelineCurveTangent(tr,k.id,'v0','out',2),false)
})
test('G005-10 · evaluación Hermite existente usa tangente manual sin alterar el valor clave',async()=>{
 const {evalNode}=await nodeEvalWithoutThree()
 const {tr}=scene();const automatic=evalNode(tr,2.5)[0]
 editTimelineCurveTangent(tr,tr.keys[0].id,'v0','out',30)
 const manual=evalNode(tr,2.5)[0]
 assert.notEqual(manual,automatic)
 assert.equal(evalNode(tr,1)[0],0);assert.equal(evalNode(tr,4)[0],10)
})
test('G005-11 · interpolación angular cruza 360 sin salto, con tangente opcional',async()=>{
 const {evalNode}=await nodeEvalWithoutThree()
 const {tr}=scene('rotation','cubic-angle');const original=evalNode(tr,2.5)[0]
 assert.ok(original>350 && original<370)
 assert.equal(editTimelineCurveTangent(tr,tr.keys[0].id,'v0','out',7),true)
 const manual=evalNode(tr,2.5)[0]
 assert.ok(Number.isFinite(manual));assert.ok(manual>340 && manual<380)
})
test('G005-12 · sin tangente el evaluador anterior conserva exactamente el mismo cálculo',async()=>{
 const {evalNode}=await nodeEvalWithoutThree();const {tl,tr}=scene()
 const old=Array.from({length:30},(_,i)=>evalNode(tr,1+i/10)[0])
 const reloaded=normalizeTimeline(tl).tracks[0]
 assert.deepEqual(Array.from({length:30},(_,i)=>evalNode(reloaded,1+i/10)[0]),old)
})
test('G005-13 · Bézier temporal guarda x acotada y y libre sin cambiar el esquema original',()=>{
 const {tl,tr}=scene('position',null),k=first(tr)
 delete tr.interpolation;k.ease='bezier';k.bz=[.42,0,.58,1]
 assert.equal(editTimelineCurveBezier(tr,k.id,0,-5,-.2),true)
 assert.deepEqual(k.bz,[0,-.2,.58,1])
 const normalized=normalizeTimeline(tl)
 assert.deepEqual(normalized.tracks[0].keys[0].bz,[0,-.2,.58,1])
})
test('G005-14 · no edita Bézier donde manda interpolación explícita',()=>{
 const {tr}=scene();const k=first(tr);k.ease='bezier'
 assert.equal(editTimelineCurveBezier(tr,k.id,0,.2,.5),false)
 delete tr.interpolation;assert.equal(editTimelineCurveBezier(tr,k.id,0,.2,.5),true)
})
test('G005-15 · no edita el Bézier saliente de la última clave',()=>{
 const {tr}=scene('position',null);delete tr.interpolation
 const k=tr.keys.at(-1);k.ease='bezier'
 assert.equal(editTimelineCurveBezier(tr,k.id,1,.6,.9),false)
})
test('G005-16 · el gráfico usa evaluadores de producción y no implementa una copia matemática',()=>{
 assert.match(graph,/import \{evalNode,evalCamera,rotFromQuat\} from '\.\.\/engine\/runtime\/timeline\/eval\.js'/)
 assert.match(graph,/curveSample\(t\)/)
 assert.match(preview,/evalTimelineCamera|evalTimelineNode/)
 assert.match(player,/evalTimelineCamera|evalTimelineNode/)
 assert.match(runtime,/const m1 = Number\.isFinite\(a\.tanOut/)
 assert.match(runtime,/const m2 = Number\.isFinite\(b\.tanIn/)
})
test('G005-17 · editor gráfico mantiene selección contextual y un solo commit por arrastre',()=>{
 assert.match(graph,/data-test="timeline-curve-editor"/)
 assert.match(graph,/function curveKeyDown\(/)
 assert.match(graph,/emit\('pick',tr,key/)
 assert.match(graph,/emit\('edited','Editar clave en curvas'\)/)
 assert.match(panel,/@edited="onCurveEdited"/)
 assert.match(graph,/emit\('edited','Editar tangente cúbica'\)/)
 assert.match(graph,/emit\('edited','Editar suavizado Bézier'\)/)
})
test('G005-18 · controles de navegación y teclado no alteran el scroll de pistas',()=>{
 for(const name of ['fitCurve','curveZoom','curveValueZoom','curveBackgroundDown','curveKeyKeyboard'])assert.ok(graph.includes(`function ${name}(`))
 assert.match(panel,/class="pinned-column"/)
 assert.match(panel,/ref="scroller" class="scroll"/)
 assert.match(graph,/role="slider" :aria-label="'Clave '/)
})
test('G005-19 · Inspector existente conserva Bézier y selección, sin un segundo Inspector',()=>{
 assert.match(inspector,/function curveChange\(index, value\)/)
 assert.match(inspector,/function timelineInterpolationChange\(value\)/)
 assert.match(panel,/selectTemporal\('timeline'/)
 assert.doesNotMatch(panel,/import.*CurveInspector/)
})
test('G005-20 · sin modificaciones a FilmMaker, Cinematics, Jolt ni formatos externos',()=>{
 const file=readFileSync(new URL('src/core/timeline/curves.js',root),'utf8')
 assert.doesNotMatch(file,/FilmMaker|Cinematics|Jolt/)
 assert.match(graph,/curveTrack\.clips\?\.length/)
})
test('G005-21 · reset automático restaura la Hermite original y persiste sin propiedades sobrantes',async()=>{
 const {evalNode}=await nodeEvalWithoutThree(),{tl,tr}=scene(),k=tr.keys[0]
 const initial=evalNode(tr,2)[0]
 editTimelineCurveTangent(tr,k.id,'v0','out',90)
 assert.notEqual(evalNode(tr,2)[0],initial)
 assert.equal(resetTimelineCurveTangent(tr,k.id,'out',0),true)
 assert.equal(evalNode(tr,2)[0],initial)
 assert.equal(Object.hasOwn(normalizeTimeline(tl).tracks[0].keys[0],'tanOut'),false)
})
test('G005-22 · Inspector edita tangentes sin eludir el bloqueo y mantiene Bézier numérico',()=>{
 assert.match(inspector,/function inspectorTangentChange\(side, axis, value\)/)
 assert.match(inspector,/function inspectorTangentAuto\(side\)/)
 assert.match(inspector,/aria-label="Tangentes cúbicas de la clave"/)
 assert.match(inspector,/timelineTrackEditable\(track.value\)/)
 assert.match(inspector,/function curveChange\(index, value\)/)
})
test('G005-23 · clip usa la curva original incluso con tangente manual',async()=>{
 const {evalTimelineNode}=await nodeEvalWithoutThree(),{tl,tr}=scene(),k=first(tr)
 const clip=addTimelineClip(tl,tr.id,k.id);clip.start=6
 const before=evalTimelineNode(tr,clip.start+clip.duration*.4)?.[0]
 editTimelineCurveTangent(tr,k.id,'v0','out',25)
 const after=evalTimelineNode(tr,clip.start+clip.duration*.4)?.[0]
 assert.ok(Number.isFinite(before)&&Number.isFinite(after));assert.notEqual(before,after)
 assert.equal(evalTimelineNode(tr,1),undefined)
})
test('G005-21 · el compilador Vue real valida template cuando está disponible',async(t)=>{
 let compiler
 try {compiler=await import('@vue/compiler-sfc')} catch {t.skip('Compilador Vue no instalado; verificar npm ci + Electron local');return}
 const res=compiler.parse(panel,{filename:'TimelinePanel.vue'})
 assert.deepEqual(res.errors,[])
 const compiled=compiler.compileTemplate({source:res.descriptor.template.content,filename:'TimelinePanel.vue',id:'lf-s10-g005'})
 assert.deepEqual(compiled.errors,[])
 const child=compiler.parse(graph,{filename:'TimelineCurveEditor.vue'})
 assert.deepEqual(child.errors,[])
 const childCompiled=compiler.compileTemplate({source:child.descriptor.template.content,filename:'TimelineCurveEditor.vue',id:'lf-s10-g005-curve'})
 assert.deepEqual(childCompiled.errors,[])
})

test('G005-24 · gráfico separado sin Timeline paralela, emite seek sin mutar props de Vue',()=>{
 assert.match(panel,/import TimelineCurveEditor from '\.\/TimelineCurveEditor\.vue'/)
 assert.match(graph,/emit\('seek'/)
 assert.doesNotMatch(graph,/props\.playhead\s*=/)
 assert.doesNotMatch(graph,/\bselKey\b|\bsel\?\.k\b/)
 assert.match(graph,/flatMap\(\(a,i\)=>/)
})
