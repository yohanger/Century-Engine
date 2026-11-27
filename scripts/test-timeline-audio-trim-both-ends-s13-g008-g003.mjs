import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { newKey, newTrack, newTimeline, normalizeTimeline, trimTimelineAudioKey } from '../src/core/timeline/model.js'
import { audioSourcePlaybackSpan } from '../src/core/timeline/audio-waveform.js'
const setup = (options = {}) => {
  const key = newKey('audio', options.t ?? 2, { id: 'sample', clip: 'sample.wav', duration: options.duration ?? 6,
    offset: options.offset ?? 0, pitch: options.pitch ?? 1, fadeIn: options.fadeIn ?? 0, fadeOut: options.fadeOut ?? 0,
    ...options.extra })
  const track = newTrack('audio', { id: 'audio', locked: options.locked || false, keys: [key] })
  const tl = newTimeline('QA recorte', { id: 'audio-trim', duration: options.timelineDuration || 15, tracks: [track] })
  const trim = (edge, seconds, source = 12) => trimTimelineAudioKey(tl, track.id, key.id, edge, seconds, source)
  return { key, track, tl, trim }
}
const near = (actual, target) => assert.ok(Math.abs(actual-target)<1e-5, `${actual} != ${target}`)
const original = (key, track, tl) => JSON.stringify({ key, track: { id:track.id,kind:track.kind,keys:track.keys.map(k=>k.id) }, duration:tl.duration })

test('TRIM-01 · recortar izquierda conserva final y avanza offset sin editar la fuente', () => {
  const {key,tl,trim}=setup()
  assert.equal(trim('left',3),true)
  assert.deepEqual([key.t,key.offset,key.duration,key.clip,tl.duration],[3,1,5,'sample.wav',15])
  near(key.t+key.duration,8)
})
test('TRIM-02 · reextender desde izquierda recupera la señal original', () => {
  const {key,trim}=setup()
  assert.equal(trim('left',4),true)
  assert.equal(trim('left',2),true)
  assert.deepEqual([key.t,key.offset,key.duration],[2,0,6])
})
test('TRIM-03 · recortar derecha no modifica origen ni offset', () => {
  const {key,trim}=setup({offset:1})
  assert.equal(trim('right',4),true)
  assert.deepEqual([key.t,key.offset,key.duration],[2,1,4])
  assert.equal(trim('right',6),true)
  assert.equal(key.duration,6)
})
test('TRIM-04 · sin duración persistida se usa PCM real; nunca placeholder de un segundo', () => {
  const {key,trim}=setup({duration:0,t:2})
  assert.equal(trim('left',3,6),true)
  assert.deepEqual([key.t,key.offset,key.duration],[3,1,5])
  near(audioSourcePlaybackSpan(6,key),5)
})
test('TRIM-05 · trim izquierdo interpreta pitch en segundos de fuente, también lento', () => {
  const {key,trim}=setup({pitch:2})
  assert.equal(trim('left',3,12),true)
  assert.deepEqual([key.t,key.offset,key.duration],[3,2,5])
  const slow=setup({pitch:.5})
  assert.equal(slow.trim('left',4,12),true)
  near(slow.key.offset,1)
})
test('TRIM-06 · sin análisis PCM, operaciones inválidas y pista bloqueada no mutan', () => {
  const {key,track,tl,trim}=setup()
  const initial=original(key,track,tl)
  for (const [edge,value,source] of [['left',3,0],['right',4,NaN],['center',3,12],['left',NaN,12],['right',-1,12],['left',17,12],['left',-1,12]])
    assert.equal(trim(edge,value,source),false)
  assert.equal(original(key,track,tl),initial)
  track.locked=true
  assert.equal(trim('left',3),false)
  assert.equal(original(key,track,tl),initial)
})
test('TRIM-07 · no se puede extender izquierda más allá del inicio de fuente', () => {
  const {key,track,tl,trim}=setup({t:2,offset:1,duration:4})
  const snapshot=original(key,track,tl)
  assert.equal(trim('left',0,12),false)
  assert.equal(original(key,track,tl),snapshot)
})
test('TRIM-08 · recorte derecho no reproduce muestras inexistentes, tampoco a pitch 2', () => {
  const {key,trim}=setup({duration:3,offset:2,pitch:2})
  assert.equal(trim('right',4.1,10),false)
  assert.equal(key.duration,3)
  assert.equal(trim('right',4,10),true)
})
test('TRIM-09 · los puntos conservan ID, nombre y instante absoluto tras recorte izquierdo', () => {
  const points=[{id:'p1',t:2,value:.6,name:'Viento'},{id:'p2',t:4,value:.2,name:'Lluvia'}]
  const {key,trim}=setup({extra:{volumeAutomation:points}})
  assert.equal(trim('left',3),true)
  assert.deepEqual(key.volumeAutomation,[{id:'p1',t:1,value:.6,name:'Viento'},{id:'p2',t:3,value:.2,name:'Lluvia'}])
  assert.equal(trim('left',2),true)
  assert.deepEqual(key.volumeAutomation,points)
})
test('TRIM-10 · protege puntos cortados y no los borra silenciosamente', () => {
  const {key,track,tl,trim}=setup({extra:{volumeAutomation:[{id:'p1',t:1,value:.7,name:'Punto-1'}]}})
  const snapshot=original(key,track,tl)
  assert.equal(trim('left',3.5),false)
  assert.equal(trim('right',.5),false)
  assert.equal(original(key,track,tl),snapshot)
})
test('TRIM-11 · los fundidos deben caber dentro de la nueva duración', () => {
  const {key,track,tl,trim}=setup({fadeIn:1.5,fadeOut:1})
  const snapshot=original(key,track,tl)
  assert.equal(trim('right',2),false)
  assert.equal(trim('left',6),false)
  assert.equal(original(key,track,tl),snapshot)
  assert.equal(trim('right',2.5),true)
})
test('TRIM-12 · el recorte rechaza fuentes agotadas y duraciones iguales', () => {
  const {key,trim}=setup({duration:0})
  assert.equal(trim('right',6,6),false)
  assert.equal(key.duration,0)
  assert.equal(trim('right',5,6),true)
  assert.equal(trim('right',5,6),false)
})
test('TRIM-13 · fuente original, FX, grupo, volumen, loop y Player compartido intactos', () => {
  const {key,trim}=setup({extra:{fx:[{id:'eq',type:'eq3'}],group:'music',volume:.5,loop:true}})
  const old={fx:key.fx,clip:key.clip,group:key.group,volume:key.volume,loop:key.loop}
  assert.equal(trim('left',3),true)
  for (const name of Object.keys(old))assert.deepEqual(key[name],old[name])
})
test('TRIM-14 · guardado/reapertura mantiene tiempos, offsets, fundidos y puntos', () => {
  const {key,tl,trim}=setup({fadeIn:.2,fadeOut:.2,extra:{volumeAutomation:[{id:'p2',t:4,value:.8,name:'Paso'}]}})
  assert.equal(trim('left',3),true)
  const reopened=normalizeTimeline(JSON.parse(JSON.stringify(tl)))
  const k=reopened.tracks[0].keys[0]
  for (const name of ['id','t','offset','duration','fadeIn','fadeOut','clip','volumeAutomation'])assert.deepEqual(k[name],key[name])
})
test('TRIM-15 · no altera otros tracks, claves ni límites de Timeline', () => {
  const {key,track,tl,trim}=setup()
  const second=newKey('audio',10,{id:'other',clip:'other.wav',duration:2})
  track.keys.push(second)
  const before=JSON.stringify(second)
  assert.equal(trim('left',3),true)
  assert.equal(JSON.stringify(second),before)
  assert.equal(tl.duration,15)
})
test('TRIM-16 · edición mantiene el modelo; no introduce nuevos atributos de serialización', () => {
  const {key,trim}=setup()
  const keys=Object.keys(key).sort()
  assert.equal(trim('left',3),true)
  assert.deepEqual(Object.keys(key).sort(),keys)
})
test('TRIM-17 · interfaz reutiliza asas, drag, Snap y waveform PCM existentes', () => {
  const src=readFileSync(new URL('../src/components/TimelinePanel.vue',import.meta.url),'utf8')
  assert.match(src,/audio-duration-head/)
  assert.match(src,/audioTrimDown\(\$event,row\.track,k,'left'\)/)
  assert.match(src,/audioResizeDown\(\$event,row\.track,k\)/)
  assert.match(src,/restoreAudioTrim\(key, original, tr\)/)
  assert.match(src,/snap\.value \? Math\.round\(raw \/ snap\.value\)/)
  assert.match(src,/<TimelineAudioSource[^>]*:offset="k\.offset"/)
})
test('TRIM-18 · Preview/Player consumen offset y duration sin rutas duplicadas', () => {
  const s=readFileSync(new URL('../src/engine/runtime/events/play-timeline.js',import.meta.url),'utf8')
  assert.match(s,/key\.offset \|\| 0/)
  assert.match(s,/key\.t \+ key\.duration/)
  const panel=readFileSync(new URL('../src/components/TimelinePanel.vue',import.meta.url),'utf8')
  assert.doesNotMatch(panel,/new AudioContext\(/)
})
test('TRIM-19 · el instante de fuente que reproduce Preview/Player permanece igual en la zona retenida', () => {
  for (const pitch of [0.5,1,1.75,2,4]) {
    const {key,trim}=setup({t:1,offset:1,pitch,duration:2,timelineDuration:20})
    const before=Array.from({length:4},(_,i)=>{const time=1.5+i*.3;return 1+(time-1)*pitch})
    assert.equal(trim('left',1.5,16),true)
    for(let i=0;i<before.length;i++) {
      const time=1.5+i*.3
      near(key.offset+(time-key.t)*pitch,before[i])
    }
  }
})
test('TRIM-20 · claves Stop y pistas no Audio no son recortables', () => {
  const {track,tl,key}=setup()
  const stop=newKey('audio',10,{id:'stop',action:'stop'})
  track.keys.push(stop)
  assert.equal(trimTimelineAudioKey(tl,track.id,stop.id,'left',10.5,8),false)
  assert.equal(trimTimelineAudioKey(tl,track.id,'no-such','left',10,8),false)
  const camera=newTrack('camera',{id:'camera',keys:[newKey('camera',1,{id:'cam'})]})
  tl.tracks.push(camera)
  assert.equal(trimTimelineAudioKey(tl,camera.id,'cam','left',1.5,8),false)
  assert.equal(key.t,2)
})
test('TRIM-21 · múltiples recortes izquierdo/derecho no acumulan deriva de redondeo', () => {
  const {key,trim}=setup({t:2,offset:1,duration:5})
  for(let i=0;i<40;i++) {
    assert.equal(trim('left',2.1,12),true)
    assert.equal(trim('right',4.8,12),true)
    assert.equal(trim('left',2,12),true)
    assert.equal(trim('right',5,12),true)
  }
  assert.deepEqual([key.t,key.offset,key.duration],[2,1,5])
})
test('TRIM-22 · preserva distancias temporales en un rango de casos deterministas', () => {
  for(let i=0;i<160;i++) {
    const pitch=[.5,1,1.25,2][i%4],t=1+(i%5)*.25
    const duration=1+(i%7)*.4,offset=.3+(i%3)*.2
    const {key,trim,tl}=setup({t,duration,offset,pitch,timelineDuration:25})
    const end=t+duration,delta=(i%3+1)*.1
    assert.equal(trim('left',+(t+delta).toFixed(5),25),true)
    near(key.t+key.duration,end)
    near(key.offset,offset+delta*pitch)
    assert.equal(trim('left',t,25),true)
    near(key.t,t);near(key.duration,duration);near(key.offset,offset)
    assert.equal(tl.duration,25)
  }
})
test('TRIM-23 · una operación rechazada no reordena claves ni altera referencias', () => {
  const {key,track,tl,trim}=setup({extra:{volumeAutomation:[{id:'q1',t:.5,value:.2,name:'Punto-1'}]}})
  const second=newKey('audio',1,{id:'before',clip:'before.wav',duration:2})
  track.keys.unshift(second)
  const refs=[...track.keys],saved=JSON.stringify(tl)
  assert.equal(trim('left',3),false)
  assert.equal(JSON.stringify(tl),saved)
  assert.deepEqual(track.keys,refs)
  assert.equal(track.keys[1],key)
})
