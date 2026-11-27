import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import {
  normalizeVolumeAutomation, volumeAutomationVisualOrder,
  volumeAutomationAt, scheduleVolumeAutomation, MAX_VOLUME_POINTS,
} from '../src/engine/runtime/audio/automation.js'
import {
  newKey, newTrack, newTimeline, normalizeTimeline,
  editTimelineAudioVolumePoint, duplicateTimelineSelection,
} from '../src/core/timeline/model.js'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const legacy = [
  { id: 'p1', t: 1, value: .2 },
  { id: 'p2', t: 3, value: .6 },
  { id: 'p3', t: 5, value: .8 },
]
function fixture(points = structuredClone(legacy)) {
  const key = newKey('audio', 1, { id: 'k', clip: 'source.wav', duration: 8, volume: .9, fadeIn: .3, fadeOut: .2, volumeAutomation: points })
  const track = newTrack('audio', { id: 'tr', keys: [key] })
  const timeline = newTimeline('FIFO', { id: 'tl', duration: 12, tracks: [track] })
  return { key, track, timeline, edit: (action, data) => editTimelineAudioVolumePoint(timeline, track.id, key.id, action, data) }
}
const ids = points => points.map(p => p.id)
const visible = points => ids(volumeAutomationVisualOrder(points))

test('FIFO-01 · lectura de proyectos legacy no añade ordinal ni nombre', () => {
  const f = fixture(), before = JSON.stringify(f.timeline)
  assert.deepEqual(normalizeTimeline(f.timeline).tracks[0].keys[0].volumeAutomation, legacy)
  assert.equal(JSON.stringify(f.timeline), before)
})
test('FIFO-02 · los puntos antiguos muestran un orden inicial determinista y sin mutación', () => {
  const points = structuredClone(legacy), before = JSON.stringify(points)
  assert.deepEqual(visible(points), ['p1','p2','p3'])
  assert.equal(JSON.stringify(points), before)
})
test('FIFO-03 · un punto nuevo, aunque sea anterior en el tiempo, queda al final', () => {
  const f = fixture()
  assert.equal(f.edit('add', { id: 'nuevo', t: .4, value: .5 }), true)
  assert.deepEqual(ids(f.key.volumeAutomation), ['nuevo','p1','p2','p3'])
  assert.deepEqual(visible(f.key.volumeAutomation), ['p1','p2','p3','nuevo'])
})
test('FIFO-04 · primer alta crea ordinales estables para legacy solo al editar', () => {
  const f = fixture(); f.edit('add', { id: 'n', t: 6, value: .5 })
  assert.deepEqual(f.key.volumeAutomation.map(p => [p.id,p.createdOrder]), [['p1',1],['p2',2],['p3',3],['n',4]])
  assert.ok(f.key.volumeAutomation.slice(0,3).every(p => !Object.hasOwn(p,'name')))
})
test('FIFO-05 · nuevas altas sucesivas usan orden de creación, no cronológico', () => {
  const f = fixture([])
  for (const [id,t] of [['a',6],['b',1],['c',4]]) assert.equal(f.edit('add',{id,t,value:.5}),true)
  assert.deepEqual(ids(f.key.volumeAutomation),['b','c','a'])
  assert.deepEqual(visible(f.key.volumeAutomation),['a','b','c'])
  assert.deepEqual(f.key.volumeAutomation.map(p=>p.createdOrder),[2,3,1])
})
test('FIFO-06 · mover el tiempo de un punto no reordena el Inspector', () => {
  const f=fixture();f.edit('add',{id:'nuevo',t:6,value:.3});const before=visible(f.key.volumeAutomation)
  assert.equal(f.edit('move',{id:'p1',t:7,value:.5}),true)
  assert.deepEqual(visible(f.key.volumeAutomation),before)
  assert.deepEqual(ids(f.key.volumeAutomation),['p2','p3','nuevo','p1'])
})
test('FIFO-07 · mover un punto antiguo migra ordinales una sola vez', () => {
  const f=fixture()
  assert.equal(f.edit('move',{id:'p1',t:7,value:.2}),true)
  assert.deepEqual(visible(f.key.volumeAutomation),['p1','p2','p3'])
  assert.deepEqual(f.key.volumeAutomation.map(p=>[p.id,p.createdOrder]),[['p2',2],['p3',3],['p1',1]])
})
test('FIFO-08 · cambiar solamente volumen no cambia orden', () => {
  const f=fixture();f.edit('add',{id:'n',t:7,value:.8});const before=visible(f.key.volumeAutomation)
  assert.equal(f.edit('move',{id:'p2',t:3,value:.1}),true)
  assert.deepEqual(visible(f.key.volumeAutomation),before)
})
test('FIFO-09 · renombrar no cambia ordinal, identificador ni posición visual', () => {
  const f=fixture();f.edit('add',{id:'n',t:7,value:.8});const before=visible(f.key.volumeAutomation)
  assert.equal(f.edit('rename',{id:'p2',name:'Lluvia'}),true)
  assert.deepEqual(visible(f.key.volumeAutomation),before)
  assert.equal(f.key.volumeAutomation.find(p=>p.id==='p2').name,'Lluvia')
})
test('FIFO-10 · eliminar solo afecta el punto indicado; el resto mantiene orden', () => {
  const f=fixture();f.edit('add',{id:'n',t:7,value:.8});const before=visible(f.key.volumeAutomation)
  assert.equal(f.edit('remove',{id:'p2'}),true)
  assert.deepEqual(visible(f.key.volumeAutomation),before.filter(id=>id!=='p2'))
})
test('FIFO-11 · los ordinales sobreviven a normalización, JSON, guardado y reapertura', () => {
  const f=fixture();f.edit('add',{id:'n',t:2,value:.8});f.edit('move',{id:'p3',t:7,value:.6})
  const before=visible(f.key.volumeAutomation)
  const restored=normalizeTimeline(JSON.parse(JSON.stringify(f.timeline))).tracks[0].keys[0].volumeAutomation
  assert.deepEqual(visible(restored),before)
  assert.deepEqual(restored.map(p=>p.t),[1,2,3,7])
})
test('FIFO-12 · restaurar snapshot (Undo/Redo) restaura datos y orden', () => {
  const f=fixture(), start=JSON.stringify(f.timeline)
  f.edit('add',{id:'n',t:4,value:.8})
  const after=JSON.stringify(f.timeline)
  assert.deepEqual(visible(JSON.parse(after).tracks[0].keys[0].volumeAutomation),['p1','p2','p3','n'])
  assert.deepEqual(visible(JSON.parse(start).tracks[0].keys[0].volumeAutomation),['p1','p2','p3'])
  assert.deepEqual(visible(JSON.parse(after).tracks[0].keys[0].volumeAutomation),['p1','p2','p3','n'])
})
test('FIFO-13 · duplicar clave preserva orden e independencia', () => {
  const f=fixture();f.edit('add',{id:'n',t:2,value:.5})
  const [ref]=duplicateTimelineSelection(f.timeline,[{tr:f.track.id,k:f.key.id}],1)
  const copy=f.track.keys.find(k=>k.id===ref.k)
  assert.deepEqual(visible(copy.volumeAutomation),visible(f.key.volumeAutomation))
  assert.notStrictEqual(copy.volumeAutomation,f.key.volumeAutomation)
  assert.notStrictEqual(copy.volumeAutomation[0],f.key.volumeAutomation[0])
})
test('FIFO-14 · normalizar ordinal inválido no elimina puntos', () => {
  const arr=[{id:'a',t:1,value:.2,createdOrder:-3},{id:'b',t:2,value:.4,createdOrder:0},{id:'c',t:3,value:.6,createdOrder:1.5}]
  assert.deepEqual(normalizeVolumeAutomation(arr,4),arr.map(({createdOrder,...rest})=>rest))
})
test('FIFO-15 · ordinal duplicado no se conserva en dos puntos tras normalización', () => {
  const arr=[{id:'a',t:1,value:.2,createdOrder:1},{id:'b',t:2,value:.4,createdOrder:1}]
  const normalized=normalizeVolumeAutomation(arr,4)
  assert.equal(normalized[0].createdOrder,1)
  assert.ok(!Object.hasOwn(normalized[1],'createdOrder'))
})
test('FIFO-16 · normalización mantiene datos legados de fecha, nombre y valor', () => {
  const arr=[{id:'a',t:1.123456,value:.23456,name:' Lluvia ',createdOrder:8}]
  assert.deepEqual(normalizeVolumeAutomation(arr,4),[{id:'a',t:1.12346,value:.2346,name:'Lluvia',createdOrder:8}])
})
test('FIFO-17 · interpolación real no cambia por metadatos de orden', () => {
  const raw=structuredClone(legacy),ordered=raw.map((p,i)=>({...p,createdOrder:i+1}))
  for(let t=0;t<=8;t+=.125) assert.equal(volumeAutomationAt(raw,t),volumeAutomationAt(ordered,t))
})
test('FIFO-18 · la programación WebAudio mantiene exactamente las mismas rampas', () => {
  const events = points => {
    const output=[]
    const param={cancelScheduledValues:t=>output.push(['cancel',t]),setValueAtTime:(v,t)=>output.push(['set',v,t]),linearRampToValueAtTime:(v,t)=>output.push(['ramp',v,t])}
    scheduleVolumeAutomation(param,5,points,1.5,1.2)
    return output
  }
  assert.deepEqual(events(legacy),events(legacy.map((p,i)=>({...p,createdOrder:i+1}))))
})
test('FIFO-19 · orden visual no modifica colección cronológica ni instantes', () => {
  const f=fixture(), before=JSON.stringify(f.key.volumeAutomation)
  const visual=volumeAutomationVisualOrder(f.key.volumeAutomation)
  assert.equal(JSON.stringify(f.key.volumeAutomation),before)
  assert.notEqual(visual,f.key.volumeAutomation)
  assert.deepEqual(f.key.volumeAutomation.map(p=>p.t),[1,3,5])
})
test('FIFO-20 · límite de 64 puntos y alta inválida no mutan', () => {
  const f=fixture([])
  for(let i=0;i<MAX_VOLUME_POINTS;i++) assert.equal(f.edit('add',{id:`p-${i}`,t:i*.1,value:.5}),true)
  const before=JSON.stringify(f.key.volumeAutomation)
  assert.equal(f.edit('add',{id:'extra',t:7.9,value:.5}),false)
  assert.equal(JSON.stringify(f.key.volumeAutomation),before)
})
test('FIFO-21 · acciones inválidas y pistas bloqueadas no migran datos', () => {
  const f=fixture(),before=JSON.stringify(f.timeline)
  assert.equal(f.edit('move',{id:'p1',t:3,value:.5}),false)
  assert.equal(f.edit('add',{id:'p3',t:4,value:.5}),false)
  f.track.locked=true
  assert.equal(f.edit('add',{id:'n',t:7,value:.3}),false)
  f.track.locked=false
  assert.equal(JSON.stringify(f.timeline),before)
})
test('FIFO-22 · borrado del último punto elimina solo la propiedad opcional', () => {
  const f=fixture([{id:'last',t:1,value:.2}])
  assert.equal(f.edit('remove',{id:'last'}),true)
  assert.equal(Object.hasOwn(f.key,'volumeAutomation'),false)
})
test('FIFO-23 · Inspector usa vista derivada sin reemplazar la colección original', () => {
  const code=read('src/components/TemporalResourceInspector.vue')
  assert.match(code,/computed\(\(\) => volumeAutomationVisualOrder\(item\.value\?\.volumeAutomation\)\)/)
  assert.match(code,/v-for="\(point, index\) in visualVolumePoints"/)
  assert.match(code,/:key="point.id"/)
  assert.match(code,/editInspectorVolumePoint\('remove',point\)/)
})
test('FIFO-24 · componentes de Timeline y Player siguen leyendo el arreglo original', () => {
  const timeline=read('src/components/TimelinePanel.vue')
  const audio=read('src/engine/runtime/audio/automation.js')
  assert.match(timeline,/v-for="point in k\.volumeAutomation"/)
  assert.match(audio,/for \(const point of points\) if \(point\.t > position\)/)
})
test('FIFO-25 · nueva fixture Electron está alineada con su contrato declarado', () => {
  const fixture=read('scripts/fixtures/editor/timeline-audio-point-lifo-s13-g008-g004.html')
  const runner=read('scripts/test-timeline-audio-point-lifo-s13-g008-g004-electron.mjs')
  assert.match(fixture,/volumeAutomationVisualOrder/)
  assert.match(fixture,/normalizar|Normalizaci[oó]n|normalizad/i)
  assert.match(fixture,/\.volume-point-row/)
  assert.match(runner,/minChecks:\s*25/)
})
test('FIFO-26 · test Electron y fixture mantienen sintaxis', () => {
  const t=spawnSync(process.execPath,['--check',new URL('./test-timeline-audio-point-lifo-s13-g008-g004-electron.mjs',import.meta.url).pathname],{encoding:'utf8'})
  assert.equal(t.status,0,t.stderr)
})

// Contrato FIFO CORR-002: el orden de creación persistido prevalece sobre t,
// incluso para proyectos guardados mientras se mostraba LIFO.
test('FIFO-27 · puntos creados fuera de orden temporal se presentan por createdOrder ascendente', () => {
  const points = [
    { id:'tercero', t:1, value:.3, createdOrder:3 },
    { id:'primero', t:2, value:.5, createdOrder:1 },
    { id:'segundo', t:4, value:.8, createdOrder:2 },
  ]
  const serialized = JSON.stringify(points)
  assert.deepEqual(visible(points), ['primero','segundo','tercero'])
  assert.equal(JSON.stringify(points), serialized)
  assert.deepEqual(visible(normalizeVolumeAutomation(points, 8)), ['primero','segundo','tercero'])
})
test('FIFO-28 · puntos de una sesión LIFO guardada recuperan FIFO sin reescribir proyecto', () => {
  const saved = [
    {id:'p2',t:1,value:.4,createdOrder:2,name:'Punto-2'},
    {id:'p4',t:2,value:.5,createdOrder:4,name:'Punto-4'},
    {id:'p1',t:3,value:.2,createdOrder:1,name:'Punto-1'},
    {id:'p3',t:4,value:.7,createdOrder:3,name:'Punto-3'},
  ]
  const f=fixture(saved),before=JSON.stringify(f.timeline)
  assert.deepEqual(visible(f.key.volumeAutomation), ['p1','p2','p3','p4'])
  assert.equal(JSON.stringify(f.timeline),before)
  assert.equal(f.edit('move',{id:'p1',t:7,value:.2}),true)
  assert.deepEqual(visible(f.key.volumeAutomation), ['p1','p2','p3','p4'])
  assert.deepEqual(visible(normalizeTimeline(JSON.parse(JSON.stringify(f.timeline))).tracks[0].keys[0].volumeAutomation), ['p1','p2','p3','p4'])
  assert.deepEqual(f.key.volumeAutomation.map(p=>p.t),[1,2,4,7])
})
