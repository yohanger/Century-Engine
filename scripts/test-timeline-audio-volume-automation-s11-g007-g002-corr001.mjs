import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { spawnSync } from 'node:child_process'
import { newKey, newTrack, newTimeline, editTimelineAudioVolumePoint } from '../src/core/timeline/model.js'

const source = name => readFileSync(new URL('../'+name, import.meta.url),'utf8')
const panel = source('src/components/TimelinePanel.vue')
const oldFixture = source('scripts/fixtures/editor/timeline-audio-volume-automation-s11-g007-g002.html')

function loadCursorHandlers() {
  const start=panel.indexOf('const ctrlOverClips = ref(false)')
  const end=panel.indexOf('const editMode = ref(', start)
  assert.ok(start>0 && end>start, 'Los handlers locales de Ctrl deben encontrarse en TimelinePanel')
  const doc={hidden:false}
  const handlers=runInNewContext(panel.slice(start,end)+'\n({ctrlOverClips,trackCtrlKey,syncCtrlPointer,clearCtrlCursor,resetCtrlOnVisibility})', {
    ref: initial => ({value: initial}), document:doc,
  })
  return {...handlers,doc}
}
function setupAudio() {
  const key=newKey('audio',1,{id:'audio-key',clip:'sample.wav',duration:4,fadeIn:.2,fadeOut:.3,volume:.85})
  const track=newTrack('audio',{id:'audio-track',keys:[key]})
  const timeline=newTimeline('QA',{id:'qa',duration:8,tracks:[track]})
  const context={ tl:{value:timeline}, guardedTrack:t=>!t.locked, zoom:{value:70}, snap:{value:.1},
    editTimelineAudioVolumePoint, uid:()=> 'new-point', count:0, picks:0, commits:0,
    pick(){context.picks++}, playback:{pause(){context.count++},eventsEdited(){context.count++}},
    commit(){context.commits++},bump(){context.count++},
  }
  const start=panel.indexOf('function audioVolumeAddFromClip(')
  const end=panel.indexOf('function audioVolumeDown(',start)
  assert.ok(start>0 && end>start, 'Se modifica el handler original de alta de puntos')
  context.handler=runInNewContext(panel.slice(start,end)+'\naudioVolumeAddFromClip',context)
  context.event=(opts={})=>({
    ctrlKey:false, metaKey:false, button:0, clientX:240, clientY:15,
    preventDefault(){context.prevented=true}, stopPropagation(){context.stopped=true},
    currentTarget:{getBoundingClientRect:()=>({left:100,top:0})},...opts,
  })
  return {key,track,timeline,context}
}

test('CORR001-01 · Ctrl inmediatamente muestra el cursor y al soltar recupera estado', () => {
  const a=loadCursorHandlers()
  a.trackCtrlKey({key:'Control',type:'keydown',ctrlKey:true})
  assert.equal(a.ctrlOverClips.value,true)
  a.trackCtrlKey({key:'Shift',type:'keyup',ctrlKey:true})
  assert.equal(a.ctrlOverClips.value,true)
  a.trackCtrlKey({key:'Control',type:'keyup',ctrlKey:false})
  assert.equal(a.ctrlOverClips.value,false)
})
test('CORR001-02 · Ctrl adquirido antes de entrar en Timeline y cambio de foco', () => {
  const a=loadCursorHandlers()
  a.syncCtrlPointer({ctrlKey:true});assert.equal(a.ctrlOverClips.value,true)
  a.syncCtrlPointer({ctrlKey:false});assert.equal(a.ctrlOverClips.value,false)
  a.trackCtrlKey({key:'Control',type:'keydown',ctrlKey:true})
  a.clearCtrlCursor();assert.equal(a.ctrlOverClips.value,false)
  a.trackCtrlKey({key:'Control',type:'keydown',ctrlKey:true})
  a.doc.hidden=true;a.resetCtrlOnVisibility();assert.equal(a.ctrlOverClips.value,false)
})
test('CORR001-03 · el cursor es local al componente y no duplica gestores globales',()=>{
  assert.match(panel, /:class="\{ 'ctrl-over-clips': ctrlOverClips \}"/)
  assert.match(panel, /@pointerenter="syncCtrlPointer"/)
  for(const name of ['keydown','keyup','blur']) assert.match(panel,new RegExp(`window\\.addEventListener\\('${name}', (?:trackCtrlKey|clearCtrlCursor)\\)`))
  assert.match(panel, /document\.addEventListener\('visibilitychange', resetCtrlOnVisibility\)/)
  for(const name of ['keydown','keyup','blur']) assert.match(panel,new RegExp(`window\\.removeEventListener\\('${name}', (?:trackCtrlKey|clearCtrlCursor)\\)`))
  assert.match(panel, /document\.removeEventListener\('visibilitychange', resetCtrlOnVisibility\)/)
})
test('CORR001-04 · CSS cubre Cámara, Nodo, Comandos, Métodos, Audio y clips continuos',()=>{
  const rule=panel.slice(panel.lastIndexOf('/* Ctrl sobre cualquier clip:'))
  assert.match(rule,/\.tlp\.ctrl-over-clips \.lane/)
  for(const className of ['.key','.span','.timeline-live-clip','.bakeclip','.audio-duration-tail','.clip-tail-external','.segment-grip','.audio-fade-grip','.audio-volume-point','.clip-tail'])
    assert.ok(rule.includes(className),className)
  assert.match(rule,/cursor: default !important/)
  assert.match(panel, /\.key\s*\{[^}]*cursor: grab/)
  assert.match(panel,/\.timeline-live-clip\s*\{[^}]*cursor:grab/)
})
test('CORR001-05 · doble clic ordinario y con Meta no crean puntos',()=>{
  const a=setupAudio()
  a.context.handler(a.context.event(),a.track,a.key)
  a.context.handler(a.context.event({ctrlKey:false,metaKey:true}),a.track,a.key)
  a.context.handler(a.context.event({ctrlKey:true,metaKey:true}),a.track,a.key)
  assert.equal(a.key.volumeAutomation,undefined)
  assert.equal(a.context.commits,0)
  assert.equal(a.context.picks,0)
})
test('CORR001-06 · Ctrl + doble clic crea un punto Audio válido y sincroniza la edición',()=>{
  const a=setupAudio(),e=a.context.event({ctrlKey:true})
  a.context.handler(e,a.track,a.key)
  assert.equal(a.key.volumeAutomation?.length,1)
  assert.equal(a.key.volumeAutomation[0].id,'new-point')
  assert.equal(a.key.volumeAutomation[0].t,2)
  assert.equal(a.key.duration,4)
  assert.equal(a.key.volume,.85)
  assert.equal(a.context.commits,1)
  assert.equal(a.context.picks,1)
  assert.equal(a.context.prevented,true)
  assert.equal(a.context.stopped,true)
})
test('CORR001-07 · Ctrl + doble clic no altera ninguna pista que no sea Audio',()=>{
  const a=setupAudio()
  for(const kind of ['camera','node','commands','method','bake']) {
    const tr=newTrack(kind,{id:'track-'+kind,keys:[newKey(kind,1,{id:'key-'+kind})]})
    a.timeline.tracks.push(tr)
    a.context.handler(a.context.event({ctrlKey:true}),tr,tr.keys[0])
    assert.equal(tr.keys[0].volumeAutomation,undefined)
  }
  assert.equal(a.context.commits,0)
})
test('CORR001-08 · bloqueo, Stop y duration=0 impiden puntos sin reescribir archivos',()=>{
  const a=setupAudio();a.track.locked=true
  a.context.handler(a.context.event({ctrlKey:true}),a.track,a.key)
  a.track.locked=false;a.key.action='stop'
  a.context.handler(a.context.event({ctrlKey:true}),a.track,a.key)
  a.key.action='play';a.key.duration=0
  a.context.handler(a.context.event({ctrlKey:true}),a.track,a.key)
  a.key.duration=4
  a.context.handler(a.context.event({ctrlKey:true,button:2}),a.track,a.key)
  assert.equal(a.context.commits,0)
  assert.equal(a.key.volumeAutomation,undefined)
})
test('CORR001-09 · un segundo punto en el mismo tiempo se rechaza sin duplicar ni confirmar',()=>{
  const a=setupAudio(),ev=a.context.event({ctrlKey:true})
  a.context.handler(ev,a.track,a.key)
  a.context.handler(a.context.event({ctrlKey:true}),a.track,a.key)
  assert.equal(a.key.volumeAutomation.length,1)
  assert.equal(a.context.commits,1)
})
test('CORR001-10 · fixture previa utiliza Ctrl + doble clic, mantiene 36 checks y añade zoom/scroll',()=>{
  assert.match(oldFixture,/new MouseEvent\('dblclick',\{bubbles:true,cancelable:true,ctrlKey:true,button:0/)
  assert.match(oldFixture,/checks\.length===37&&checks\.every/)
  assert.equal((oldFixture.match(/^\s*check\('/gm)||[]).length,37)
  assert.doesNotMatch(oldFixture,/\bcheck\('Doble clic crea segundo punto/)
})
test('CORR001-11 · Ctrl + doble clic no interfiere con selección múltiple y drag original',()=>{
  assert.match(panel,/if \(e\.ctrlKey \|\| e\.metaKey \|\| e\.shiftKey\) \{ pick\(tr,k,e\); return \}/)
  assert.match(panel,/function clipDragDown\(/)
  assert.match(panel,/function audioVolumeDown\(/)
  assert.match(panel,/function audioFadeDown\(/)
  assert.match(panel,/function audioVolumeKeydown\(/)
  assert.match(panel,/@dblclick="row\.track\.kind === 'audio' && audioVolumeAddFromClip/)
})

test('CORR001-12 · fixture Electron valida los cinco tipos de clave y clip temporal real',()=>{
  const fixture=source('scripts/fixtures/editor/timeline-audio-volume-automation-s11-g007-g002-corr001.html')
  const runner=source('scripts/test-timeline-audio-volume-automation-s11-g007-g002-corr001-electron.mjs')
  for(const kind of ['camera','node','audio','commands','method'])
    assert.match(fixture,new RegExp(`computed\\('\\.key\\.${kind}'\\)`))
  assert.match(fixture,/addTimelineClip\(timeline,camera\.id,camera\.keys\[0\]\.id\)/)
  assert.match(fixture,/computed\('\.timeline-live-clip'\)/)
  assert.match(fixture,/window\.dispatchEvent\(new KeyboardEvent\(down\?'keydown':'keyup'/)
  assert.match(fixture,/getComputedStyle\(element\)\.cursor/)
  assert.match(fixture,/checks\.length===32&&checks\.every/)
  assert.equal((fixture.match(/^\s*check\('/gm)||[]).length,32)
  assert.match(runner,/minChecks:\s*32/)
})
test('CORR001-13 · Electron comprueba Ctrl, salida de foco y bloqueos sin enmascarar un error',()=>{
  const fixture=source('scripts/fixtures/editor/timeline-audio-volume-automation-s11-g007-g002-corr001.html')
  for(const phrase of ['Doble clic normal Audio no crea puntos','Ctrl + doble clic en otros tipos no crea puntos',
    'Ctrl + doble clic Audio crea exactamente un punto','Ctrl + doble clic repetido no duplica el mismo tiempo',
    'Pérdida de foco restaura cursor original','Entrar con Ctrl presionado muestra flecha normal',
    'Ctrl + doble clic sobre clave Stop no crea puntos','Ctrl + doble clic sobre Audio duration=0 no migra datos'])
    assert.ok(fixture.includes(`check('${phrase}'`),phrase)
  assert.match(fixture,/output\.dataset\.stage=stage/)
  assert.match(fixture,/new Error\('Timeout en '\+stage\)/)
  assert.match(fixture,/window\.addEventListener\('unhandledrejection'/)
})
test('CORR001-14 · scripts JS de la fixture Electron son sintácticamente válidos',()=>{
  const fixture=source('scripts/fixtures/editor/timeline-audio-volume-automation-s11-g007-g002-corr001.html')
  const blocks=[...fixture.matchAll(/<script(?:\s+type="module")?>([\s\S]*?)<\/script>/g)]
  assert.equal(blocks.length,2)
  for(const [,text] of blocks){
    const check=spawnSync(process.execPath,['--check','--input-type=module','-'],{input:text,encoding:'utf8'})
    assert.equal(check.status,0,check.stderr)
  }
})
