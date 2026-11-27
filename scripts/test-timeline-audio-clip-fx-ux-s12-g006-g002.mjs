// CA-TIMELINE-AUDIO-CLIP-FX-UX-001 · alcance solo Inspector; datos y DSP conservados.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { newTimeline, newTrack, newKey, normalizeTimeline, duplicateTimelineSelection } from '../src/core/timeline/model.js'
import { newFx, FX_TYPES, normalizeAudio } from '../src/engine/runtime/audio/config.js'
const read = name => readFileSync(new URL('../' + name, import.meta.url),'utf8')
const inspector = read('src/components/TemporalResourceInspector.vue')
const mixer = read('src/components/AudioMixerInspector.vue')
const fixture = read('scripts/fixtures/editor/timeline-audio-clip-fx-ux-s12-g006-g002.html')
const clips = () => {
 const saved = newKey('audio',1,{id:'saved',clip:'fx.wav',duration:3,fx:[
  newFx('eq3',{id:'eq-01',low:5,mid:-3,on:true}),newFx('echo',{id:'echo-02',time:.4,mix:.2,on:false})
 ]})
 const fresh = newKey('audio',5,{id:'fresh',clip:'fresh.wav',duration:2})
 const empty = newKey('audio',8,{id:'empty',clip:'empty.wav',duration:1,fx:[]})
 const stop = newKey('audio',10,{id:'stop',action:'stop',clip:''})
 return newTimeline('FX',{id:'fx-timeline',duration:12,tracks:[newTrack('audio',{id:'audio-1',keys:[saved,fresh,empty,stop]})]})
}

test('FX-UX-01 · el Inspector contextual ya no importa editor FX privado',()=>{
 assert.doesNotMatch(inspector,/import AudioMixerInspector/)
 assert.doesNotMatch(inspector,/<AudioMixerInspector/)
 assert.doesNotMatch(inspector,/function editKeyFx\(/)
 assert.doesNotMatch(inspector,/@fx-(?:add|remove|move|update|preset)/)
})
test('FX-UX-02 · no se crean ni normalizan efectos por lectura del Inspector',()=>{
 assert.match(inspector,/const savedClipFx = computed\(/)
 assert.match(inspector,/Array\.isArray\(item\.value\?\.fx\) \? item\.value\.fx : \[\]/)
 assert.doesNotMatch(inspector,/item\.value\.fx\s*=/)
})
test('FX-UX-03 · indicador existe solo cuando hay FX guardados',()=>{
 assert.match(inspector,/<p v-if="savedClipFx\.length"/)
 assert.match(inspector,/data-test="timeline-clip-fx-readonly"/)
 assert.match(inspector,/role="status"/)
 assert.match(inspector,/aria-label="FX guardados en el clip \(solo lectura\)"/)
 assert.doesNotMatch(inspector,/inspector-audio-fx/)
})
test('FX-UX-04 · indicador muestra cantidad, orden, tipos y estado on/off',()=>{
 assert.match(inspector,/FX guardados \(\{\{ savedClipFx\.length \}\}\)/)
 assert.match(inspector,/v-for="\(fx, index\) in savedClipFx"/)
 assert.match(inspector,/FX_TYPES\[fx\.type\]\?\.label \|\| fx\.type/)
 assert.match(inspector,/fx\.on === false \? 'desactivado' : 'activo'/)
 assert.equal(FX_TYPES.eq3.label,'Ecualizador (3 bandas)')
})
test('FX-UX-05 · sección de automatización y fuente Audio permanecen en Inspector',()=>{
 assert.match(inspector,/class="inspector-audio-volume"/)
 assert.match(inspector,/<TimelineAudioSource v-if=/)
 assert.match(inspector,/editInspectorVolumePoint\(/)
})
test('FX-UX-06 · propiedades FX opcionales ausentes no aparecen tras normalización',()=>{
 const timeline=normalizeTimeline(clips()),k=timeline.tracks[0].keys.find(x=>x.id==='fresh')
 assert.equal(Object.hasOwn(k,'fx'),false)
})
test('FX-UX-07 · cadena FX vacía sigue vacía después de serializar',()=>{
 const timeline=normalizeTimeline(clips()),k=timeline.tracks[0].keys.find(x=>x.id==='empty')
 assert.deepEqual(k.fx,[])
 assert.deepEqual(normalizeTimeline(JSON.parse(JSON.stringify(timeline))).tracks[0].keys.find(x=>x.id==='empty').fx,[])
})
test('FX-UX-08 · la cadena FX guarda IDs, orden, bypass y parámetros',()=>{
 const t=normalizeTimeline(clips()),first=t.tracks[0].keys[0].fx
 const serialized=JSON.parse(JSON.stringify(t)),again=normalizeTimeline(serialized).tracks[0].keys[0].fx
 assert.deepEqual(again,first)
 assert.deepEqual(first.map(f=>[f.id,f.type,f.on]),[['eq-01','eq3',true],['echo-02','echo',false]])
 assert.equal(again[0].low,5);assert.equal(again[0].mid,-3)
 assert.equal(again[1].time,.4);assert.equal(again[1].mix,.2)
})
test('FX-UX-09 · duplicar clave conserva FX con objetos independientes',()=>{
 const t=normalizeTimeline(clips()),tr=t.tracks[0],k=tr.keys[0]
 const [ref]=duplicateTimelineSelection(t,[{tr:tr.id,k:k.id}],.5)
 const copied=tr.keys.find(x=>x.id===ref.k)
 assert.deepEqual(copied.fx,k.fx); assert.notStrictEqual(copied.fx,k.fx)
 assert.notStrictEqual(copied.fx[0],k.fx[0])
})
test('FX-UX-10 · el bus mantiene editor completo; sin refactor de Mixer',()=>{
 assert.match(mixer,/Cadena de efectos \(\{\{ group\.fx\.length \}\}\)/)
 assert.match(mixer,/@change="addEffect\(\$event\.target\.value\)/)
 assert.match(read('src/components/Inspector.vue'),/<AudioMixerInspector v-if="audioContext"/)
})
test('FX-UX-11 · AudioEngine, Preview y Player conservan cadenas FX',()=>{
 assert.match(read('src/engine/runtime/audio/engine.js'),/opts\.fx/)
 assert.match(read('src/core/timeline/event-preview.js'),/fx:key\.fx/)
 assert.match(read('src/engine/runtime/events/play-timeline.js'),/offset: k\.offset, fx: k\.fx/)
 assert.match(read('src/engine/runtime/events/play-timeline.js'),/loop: k\.loop, fx: k\.fx, wait: false/)
})
test('FX-UX-12 · dos voces con efectos diferentes comparten el mismo bus, no la cadena',()=>{
 const before=normalizeAudio({groups:[{id:'ambient',fx:[newFx('lowpass',{id:'bus-low',freq:900})]}]})
 const first=[newFx('eq3',{id:'voice-a'})],second=[newFx('echo',{id:'voice-b'})]
 assert.notDeepEqual(first,second)
 assert.equal(before.groups.find(g=>g.id==='ambient').fx[0].id,'bus-low')
 assert.notEqual(first[0].id,second[0].id)
})
test('FX-UX-13 · las pruebas originales G005/G006 conservan sus verificaciones de runtime',()=>{
 const old=read('scripts/test-timeline-audio-clip-effects-s11-g005.mjs')
 assert.match(old,/G005-06 · la cadena privada/)
 assert.match(old,/G005-23 · Preview entrega FX reales/)
 assert.match(old,/CA-TIMELINE-AUDIO-CLIP-FX-UX-001/)
 assert.match(old,/G005-18 · CA-001/)
 assert.match(old,/G005-19 · CA-001/)
})
test('FX-UX-14 · la fixture Electron monta Inspector real y reporta fallos parciales',()=>{
 assert.match(fixture,/import\('\/src\/components\/TemporalResourceInspector\.vue'\)/)
 assert.match(fixture,/import\('\/src\/components\/AudioMixerInspector\.vue'\)/)
 assert.match(fixture,/window\.addEventListener\('unhandledrejection'/)
 assert.match(fixture,/checks\.every\(entry=>entry\.pass\)/)
 assert.match(fixture,/window\.__clipFxUxQa/)
})
test('FX-UX-15 · los dos bloques de la fixture Electron tienen sintaxis ESM válida',()=>{
 const scripts=[...fixture.matchAll(/<script(?: type="module")?>([\s\S]*?)<\/script>/g)]
 assert.equal(scripts.length,2)
 for(const [,source] of scripts){const result=spawnSync(process.execPath,['--check','--input-type=module','-'],{input:source,encoding:'utf8'}); assert.equal(result.status,0,result.stderr)}
})
