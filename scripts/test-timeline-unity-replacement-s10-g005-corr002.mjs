import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {newTimeline,newTrack,newKey,normalizeTimeline,EASES,INTERPOLATIONS,keyParams,resizeTimelineAudioKey,timelineMinDuration} from '../src/core/timeline/model.js'
import {EASES as RUNTIME_EASES} from '../src/engine/runtime/anim/model.js'
const panel=readFileSync(new URL('../src/components/TimelinePanel.vue',import.meta.url),'utf8')
const inspector=readFileSync(new URL('../src/components/TemporalResourceInspector.vue',import.meta.url),'utf8')
const original=readFileSync(new URL('../src/engine/runtime/anim/model.js',import.meta.url),'utf8')
const gate='LF-TIMELINE-UNITY-REPLACEMENT-S10-G005-INTEGRAL_CORR-002'
const make=()=>{const tl=newTimeline('QA',{duration:10}),audio=newTrack('audio'),cmd=newTrack('commands'),nature=newTrack('commands',{name:'Naturaleza'}),method=newTrack('method');audio.keys=[newKey('audio',2,{action:'play',duration:0}),newKey('audio',6,{action:'stop'})];cmd.keys=[newKey('commands',1)];nature.keys=[newKey('commands',3)];method.keys=[newKey('method',4)];tl.tracks=[audio,cmd,nature,method];return{tl,audio,cmd,nature,method,k:audio.keys[0]}}
test('CORR002-01 · Audio tiene duración real en el Inspector, sin crear un segundo estado',()=>{
 const {tl,audio,k}=make();const field=keyParams(audio).find(p=>p.key==='duration')
 assert.ok(field);assert.equal(field.def,0);assert.equal(k.duration,0)
 assert.equal(resizeTimelineAudioKey(tl,audio.id,k.id,3.25),true);assert.equal(k.duration,3.25)
 assert.deepEqual(keyParams(audio).find(p=>p.key==='duration'),field) // mismo esquema, sin segundo campo
 assert.equal(normalizeTimeline(tl).tracks[0].keys[0].duration,3.25)
})
test('CORR002-02 · no se permite duración en Comandos, Naturaleza ni Métodos',()=>{
 const {tl,cmd,nature,method}=make()
 for(const tr of [cmd,nature,method]){
  const before=structuredClone(tr.keys)
  assert.equal(keyParams(tr).some(p=>p.key==='duration'),false)
  assert.equal(resizeTimelineAudioKey(tl,tr.id,tr.keys[0].id,2),false)
  assert.deepEqual(tr.keys,before)
 }
})
test('CORR002-03 · eventos de audio Stop y pista bloqueada permanecen protegidos',()=>{
 const {tl,audio,k}=make();assert.equal(resizeTimelineAudioKey(tl,audio.id,audio.keys[1].id,1),false)
 audio.locked=true;assert.equal(resizeTimelineAudioKey(tl,audio.id,k.id,2),false)
 assert.equal(k.duration,0)
})
test('CORR002-04 · duración fija respeta tiempo total, valores finitos y modo completo 0',()=>{
 const {tl,audio,k}=make()
 for(const v of [-1,Infinity,NaN,8.01,86401])assert.equal(resizeTimelineAudioKey(tl,audio.id,k.id,v),false)
 assert.equal(k.duration,0)
 assert.equal(resizeTimelineAudioKey(tl,audio.id,k.id,8),true);assert.equal(k.duration,8);assert.equal(timelineMinDuration(tl),10)
 assert.equal(resizeTimelineAudioKey(tl,audio.id,k.id,0),true);assert.equal(k.duration,0)
 assert.equal(resizeTimelineAudioKey(tl,audio.id,k.id,0),false)
 assert.equal(timelineMinDuration(tl)>=6,true)
})
test('CORR002-05 · el marcador final es un único corchete global de altura completa',()=>{
 assert.match(panel,/class="duration-grip"[^>]*role="slider"/)
 assert.match(panel,/@pointerdown\.stop\.prevent="beginDurationResize"/)
 assert.match(panel,/@keydown\.stop="durationKeydown"/)
 assert.equal((panel.match(/class="duration-grip"/g)||[]).length,1)
 assert.match(panel,/\.duration-grip::before,\.duration-grip::after/)
 assert.match(panel,/\.duration-grip \{[^}]*top:0;bottom:0;height:100%/)
 assert.doesNotMatch(panel,/class="duration-boundary"|<span class="endmark"/)
})
test('CORR002-06 · corchete único deriva del límite real y scroll horizontal',()=>{
 // G008-G002: la posición global incorpora el margen visual sin cambiar duración ni scroll.
 assert.match(panel,/const durationBoundaryX = computed\(\(\) => timeToX\(tl\.value\?\.duration \|\| 0\) - durationScrollX\.value\)/)
 assert.match(panel,/:style="\{ left: durationBoundaryX \+ 'px' \}"/)
 assert.match(panel,/updateDuration\(rounded\)/)
 assert.match(panel,/commit\('Redimensionar duración del Timeline'\)/)
})
test('CORR002-07 · Audio usa el mismo campo del Inspector, el asa exterior y un único commit',()=>{
 assert.match(panel,/function audioResizeDown\(e, tr, key\)/)
 // G008-G003: el asa derecho delega en el recorte validado; el modelo
 // sigue usando resizeTimelineAudioKey, con límites PCM comprobados.
 assert.match(panel,/function audioResizeDown\(e, tr, key\) \{ audioTrimDown\(e, tr, key, 'right'\) \}/)
 assert.match(panel,/trimTimelineAudioKey\(timeline, tr\.id, key\.id, edge/)
 assert.match(panel,/commit\(edge === 'left' \? 'Recortar inicio de Audio' : 'Recortar fin de Audio'\)/)
 assert.match(panel,/class="audio-duration-tail"/)
 assert.match(panel,/@pointerdown\.stop\.prevent="audioResizeDown\(\$event,row\.track,k\)"/)
 assert.match(inspector,/keyParams\(track\.value\)/)
 assert.match(inspector,/timelineMinDuration\(resource\.value\)/)
})
test('CORR002-08 · el clic sin arrastre y cancelación no alteran una reproducción completa',()=>{
 assert.match(panel,/timelineDrag\.begin\(e, \{/)
 // Un clic sin llegar al umbral no confirma cambios; cancelar restaura
 // inicio, offset, duración y puntos, no solamente duration.
 assert.match(panel,/finish\(\) \{[\s\S]*?if \(audioTrimChanged\(key, original\)\)/)
 assert.match(panel,/cancel\(\) \{ if \(audioTrimChanged\(key, original\)\) \{ restoreAudioTrim\(key, original, tr\); bump\(\) \} \}/)
 assert.match(panel,/key\.t = snapshot\.t; key\.offset = snapshot\.offset; key\.duration = snapshot\.duration/)
 assert.match(panel,/timelineDrag\.begin\(e, \{/)
})
test('CORR002-09 · teclado permite ajustar o volver a 0 con Home',()=>{
 assert.match(panel,/function audioResizeKeydown\(e, tr, key\)/)
 assert.match(panel,/\['ArrowLeft','ArrowRight','Home'\]/)
 assert.match(panel,/aria-valuetext="k\.duration \?/)
})
test('CORR002-10 · etiquetas inglesas con los mismos identificadores',()=>{
 assert.deepEqual(EASES.map(v=>v[0]),RUNTIME_EASES.map(v=>v[0]))
 assert.deepEqual(EASES.map(v=>v[1]),['Ease In Out','Linear','Ease In','Ease Out','Bezier','Back','Bounce','Elastic','Cut'])
 assert.deepEqual(INTERPOLATIONS.map(v=>v[1]),['Nearest','Linear','Cubic','Linear Angle','Cubic Angle'])
 assert.match(inspector,/options: EASES/)
 assert.match(inspector,/Smooth.*Fast Start.*Slow Start.*Anticipation/)
})
test('CORR002-11 · los nombres de FilmMaker y la semántica del Player no se reescriben',()=>{
 assert.match(original,/\['inOut', 'Suave \(entrada y salida\)'\]/)
 assert.match(panel,/row\.track\.kind === 'audio'/)
 assert.doesNotMatch(panel,/function resizeCommand|function resizeMethod/)
})
test('CORR002-12 · Responsive y cabeceras fijas de G001 se preservan',()=>{
 assert.match(panel,/class="pinned-column"/)
 assert.match(panel,/overflow-x:auto/)
 assert.match(panel,/\.duration-overlay \{[^}]*overflow:hidden;pointer-events:none/)
})
test('CORR002-13 · compilación real de Vue si existe en el entorno',async t=>{
 let sfc;try{sfc=await import('@vue/compiler-sfc')}catch{t.skip('Compilador Vue ausente; QA local pendiente');return}
 for(const f of ['TimelinePanel.vue','TemporalResourceInspector.vue']){
  const source=readFileSync(new URL('../src/components/'+f,import.meta.url),'utf8')
  const r=sfc.parse(source,{filename:f});assert.deepEqual(r.errors,[],f)
  const c=sfc.compileTemplate({source:r.descriptor.template.content,filename:f,id:gate});assert.deepEqual(c.errors,[],f)
 }
})
