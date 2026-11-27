import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { newKey, newTrack, newTimeline, normalizeTimeline, resizeTimelineAudioFade } from '../src/core/timeline/model.js'
const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8')
const setup = ({ duration = 4, fadeIn = .5, fadeOut = .75, locked = false, action = 'play' } = {}) => {
  const key = newKey('audio', 2, { id: 'g007-audio', clip:'viento.wav', duration, fadeIn, fadeOut, action })
  const track = newTrack('audio', { id:'g007-track', keys:[key], locked })
  const timeline = newTimeline('QA G007', { id:'g007-tl',duration:12,tracks:[track] })
  return {timeline,track,key}
}
const edit = (a,field,seconds,visible=0) => resizeTimelineAudioFade(a.timeline,a.track.id,a.key.id,field,seconds,visible)
test('FADE-01 · entrada actualiza solo fadeIn y preserva duración/PCM/FX',()=>{
  const a=setup(),before={...a.key}
  assert.equal(edit(a,'fadeIn',1),true)
  assert.equal(a.key.fadeIn,1)
  for(const field of ['duration','fadeOut','clip','t','volume','group','pitch','offset','loop','fx']) assert.deepEqual(a.key[field],before[field])
})
test('FADE-02 · salida actualiza solo fadeOut',()=>{
  const a=setup();assert.equal(edit(a,'fadeOut',1.25),true)
  assert.deepEqual([a.key.fadeIn,a.key.fadeOut,a.key.duration,a.key.t],[.5,1.25,4,2])
})
test('FADE-03 · no cruza el inicio ni la salida y no suma más que duración',()=>{
  const a=setup();assert.equal(edit(a,'fadeIn',3.25),true)
  assert.equal(edit(a,'fadeIn',3.25001),false)
  assert.equal(edit(a,'fadeOut',.8),false)
  assert.equal(a.key.fadeOut,.75)
})
test('FADE-04 · rechaza valores no numéricos y negativos',()=>{
  const a=setup();for(const value of [NaN,Infinity,-Infinity,-.01,undefined])assert.equal(edit(a,'fadeIn',value),false)
})
test('FADE-05 · rechaza campos distintos de fadeIn y fadeOut',()=>{
  const a=setup();for(const field of ['fade','duration','volume','fx','t',null])assert.equal(edit(a,field,1),false)
})
test('FADE-06 · bloqueos y acciones Stop no permiten edición',()=>{
  const a=setup({locked:true});assert.equal(edit(a,'fadeIn',1),false)
  a.track.locked=false;a.key.action='stop';assert.equal(edit(a,'fadeIn',1),false)
  assert.equal(edit(a,'fadeOut',.5),false)
})
test('FADE-07 · no se habilitan fundidos en pistas ajenas o IDs inexistentes',()=>{
  const a=setup()
  assert.equal(resizeTimelineAudioFade(a.timeline,'missing',a.key.id,'fadeIn',1),false)
  assert.equal(resizeTimelineAudioFade(a.timeline,a.track.id,'missing','fadeIn',1),false)
  const commands = newTrack('commands',{id:'cmd',keys:[newKey('commands',2,{id:'cmdkey'})]})
  a.timeline.tracks.push(commands)
  assert.equal(resizeTimelineAudioFade(a.timeline,'cmd','cmdkey','fadeIn',1),false)
})
test('FADE-08 · duration=0 no admite Fade Out, aunque se conozca el PCM',()=>{
  const a=setup({duration:0,fadeIn:0,fadeOut:0})
  assert.equal(edit(a,'fadeOut',1,5),false)
  assert.equal(a.key.duration,0)
})
test('FADE-09 · duration=0 solo habilita Fade In con tramo visible conocido',()=>{
  const a=setup({duration:0,fadeIn:0,fadeOut:0})
  assert.equal(edit(a,'fadeIn',1),false)
  assert.equal(edit(a,'fadeIn',1,5),true)
  assert.equal(edit(a,'fadeIn',5.001,5),false)
  assert.equal(a.key.duration,0)
})
test('FADE-10 · duración disponible limitada por el fin del Timeline',()=>{
  const a=setup({duration:10,fadeIn:0,fadeOut:0})
  assert.equal(edit(a,'fadeIn',10),true)
  assert.equal(edit(a,'fadeOut',.1),false)
})
test('FADE-11 · reset Home admite cero, los cambios sin efecto no hacen commit',()=>{
  const a=setup();assert.equal(edit(a,'fadeIn',0),true);assert.equal(edit(a,'fadeIn',0),false)
})
test('FADE-12 · datos existentes sobreviven serialización/normalización',()=>{
  const a=setup();edit(a,'fadeOut',1.1)
  const loaded=normalizeTimeline(JSON.parse(JSON.stringify(a.timeline)))
  assert.deepEqual([loaded.tracks[0].keys[0].fadeIn,loaded.tracks[0].keys[0].fadeOut],[.5,1.1])
})
test('FADE-13 · Editor reutiliza pointer drag, pausa, commits y cancelación',()=>{
  const panel=read('src/components/TimelinePanel.vue')
  assert.match(panel,/function audioFadeDown\(/)
  assert.match(panel,/timelineDrag\.begin\(event,\s*\{/)
  assert.match(panel,/cancel\(\) \{ if \(key\[field\] !== original\)/)
  assert.match(panel,/resizeTimelineAudioFade\(/)
  assert.match(panel,/playback\.eventsEdited\(\)/)
})
test('FADE-14 · la curva y asas no interceptan el PCM ni se anidan en botones',()=>{
  const panel=read('src/components/TimelinePanel.vue')
  const envelope=panel.indexOf('class="audio-fade-envelope"')
  const key=panel.indexOf('class="key" :class=')
  assert.ok(envelope>0 && envelope<key)
  assert.match(panel,/\.audio-fade-envelope \{[^}]*pointer-events:none/)
  assert.match(panel,/class="audio-fade-grip fade-in"/)
  assert.match(panel,/class="audio-fade-grip fade-out"/)
})
test('FADE-15 · fundido de salida no se inventa para duration=0',()=>{
  const panel=read('src/components/TimelinePanel.vue')
  assert.match(panel,/k\.duration > 0 && audioFadeSpan\(k\) > 0/)
  assert.match(panel,/audioSourceSeconds\.get\(key\.clip\) > 0/)
})
test('FADE-16 · Runtime y Preview siguen usando los campos aprobados',()=>{
  const player=read('src/engine/runtime/events/play-timeline.js')
  const preview=read('src/core/timeline/event-preview.js')
  assert.match(player,/k\.fadeIn > 0/)
  assert.match(player,/k\.duration > 0/)
  assert.match(preview,/key\.fadeOut/)
  assert.match(preview,/key\.fadeIn/)
})
test('FADE-17 · no hay claves de fundidos independientes ni nueva persistencia',()=>{
  const panel=read('src/components/TimelinePanel.vue')
  assert.doesNotMatch(panel,/newTrack\(['"]fade/)
  assert.match(panel,/key\.fadeIn|k\.fadeIn/)
  assert.match(panel,/key\.fadeOut|k\.fadeOut/)
})
