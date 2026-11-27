import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { normalizeVolumeAutomation, normalizeVolumePointName, volumeAutomationAt, MAX_VOLUME_POINTS } from '../src/engine/runtime/audio/automation.js'
import { newKey, newTrack, newTimeline, normalizeTimeline, editTimelineAudioVolumePoint, duplicateTimelineSelection } from '../src/core/timeline/model.js'

const read = file => readFileSync(new URL('../'+file, import.meta.url), 'utf8')
const inspector = read('src/components/TemporalResourceInspector.vue')
const fixture = (data = []) => {
  const key = newKey('audio',1,{id:'audio-key',duration:9,clip:'test.wav',volume:.75,volumeAutomation:data})
  const track = newTrack('audio',{id:'audio-track',keys:[key]})
  const timeline = newTimeline('Test',{id:'test-timeline',duration:15,tracks:[track]})
  return {key,track,timeline,edit:(action,p)=>editTimelineAudioVolumePoint(timeline,track.id,key.id,action,p)}
}
const legacy = [{id:'a',t:1,value:.2},{id:'b',t:2,value:.5},{id:'c',t:3,value:.8}]

// Contrato de datos: los puntos existentes no migran por lectura.
test('INS-01 · nombre opcional ausente mantiene exactamente el formato legado',()=>{
  assert.deepEqual(normalizeVolumeAutomation(legacy,9),legacy)
  const f=fixture(legacy)
  assert.deepEqual(normalizeTimeline(f.timeline).tracks[0].keys[0].volumeAutomation,legacy)
})
test('INS-02 · nombre personalizado se normaliza sin alterar ID, tiempo ni factor',()=>{
  const f=fixture([{id:'a',t:1,value:.2,name:'  Murmullo  '}])
  assert.deepEqual(normalizeTimeline(f.timeline).tracks[0].keys[0].volumeAutomation,[{id:'a',t:1,value:.2,name:'Murmullo'}])
})
test('INS-03 · nombre de 48 caracteres válido; 49 no se serializa',()=>{
  assert.equal(normalizeVolumePointName('a'.repeat(48)),'a'.repeat(48))
  assert.equal(normalizeVolumePointName('a'.repeat(49)),null)
})
test('INS-04 · nombres vacíos y controles inválidos no se serializan',()=>{
  for(const value of ['', '  ', 'Línea\n1', false, 7, null]) assert.equal(normalizeVolumePointName(value),null)
})
test('INS-05 · nuevo punto genera Punto-1 si no había puntos',()=>{
  const f=fixture(); assert.equal(f.edit('add',{id:'nuevo',t:1,value:.5}),true)
  assert.equal(f.key.volumeAutomation[0].name,'Punto-1')
})
test('INS-06 · alta sucesiva genera nombres sin duplicarse',()=>{
  const f=fixture();
  for(let i=1;i<=6;i++)assert.equal(f.edit('add',{id:'id-'+i,t:i,value:i/10}),true)
  assert.deepEqual(f.key.volumeAutomation.map(p=>p.name),Array.from({length:6},(_,i)=>`Punto-${i+1}`))
})
test('INS-07 · alta considera nombres implícitos de puntos antiguos',()=>{
  const f=fixture(legacy)
  assert.equal(f.edit('add',{id:'nuevo',t:4,value:.4}),true)
  assert.equal(f.key.volumeAutomation.find(p=>p.id==='nuevo').name,'Punto-4')
  assert.ok(f.key.volumeAutomation.slice(0,3).every(p=>!Object.hasOwn(p,'name')))
})
test('INS-08 · nombres por defecto no reutilizan nombres personalizados',()=>{
  const f=fixture([{id:'custom',t:1,value:.2,name:'Punto-1'}])
  assert.equal(f.edit('add',{id:'new',t:2,value:.3}),true)
  assert.equal(f.key.volumeAutomation[1].name,'Punto-2')
})
test('INS-09 · renombrar actualiza solo un punto e identifica la clave',()=>{
  const f=fixture(legacy),before=JSON.parse(JSON.stringify(f.key))
  assert.equal(f.edit('rename',{id:'b',name:'  Voz interior  '}),true)
  assert.equal(f.key.volumeAutomation[1].name,'Voz interior')
  assert.equal(f.key.id,before.id);assert.equal(f.key.volume,before.volume)
  assert.deepEqual(f.key.volumeAutomation[0],legacy[0]);assert.deepEqual(f.key.volumeAutomation[2],legacy[2])
})
test('INS-10 · renombrar no cambia el orden, tiempo, factor o IDs',()=>{
  const f=fixture(legacy),fields=f.key.volumeAutomation.map(({id,t,value})=>({id,t,value}))
  assert.equal(f.edit('rename',{id:'a',name:'Ambiente'}),true)
  assert.deepEqual(f.key.volumeAutomation.map(({id,t,value})=>({id,t,value})),fields)
})
test('INS-11 · no permite renombrados duplicados ni de solo mayúsculas',()=>{
  const f=fixture([{...legacy[0],name:'Lluvia'},legacy[1]])
  assert.equal(f.edit('rename',{id:'b',name:'LLUVIA'}),false)
  assert.equal(f.edit('rename',{id:'b',name:'Punto-2'}),false)
})
test('INS-12 · no permite nombre vacío ni sobrelongitud y no muta datos',()=>{
  const f=fixture(legacy),before=JSON.stringify(f.timeline)
  assert.equal(f.edit('rename',{id:'a',name:'   '}),false)
  assert.equal(f.edit('rename',{id:'a',name:'x'.repeat(49)}),false)
  assert.equal(JSON.stringify(f.timeline),before)
})
test('INS-13 · renombrar nombre idéntico, punto inexistente y acción inválida no actúan',()=>{
  const f=fixture(legacy)
  assert.equal(f.edit('rename',{id:'a',name:'Sombras'}),true)
  assert.equal(f.edit('rename',{id:'a',name:'Sombras'}),false)
  assert.equal(f.edit('rename',{id:'no-existe',name:'Nada'}),false)
})
test('INS-14 · una pista bloqueada no permite renombrar, añadir ni mover',()=>{
  const f=fixture(legacy);f.track.locked=true
  assert.equal(f.edit('rename',{id:'a',name:'No'}),false)
  assert.equal(f.edit('add',{id:'d',t:4,value:.4}),false)
  assert.equal(f.edit('move',{id:'a',t:1.5,value:.3}),false)
})
test('INS-15 · mover punto con nombre conserva nombre asociado a ID',()=>{
  const f=fixture([{...legacy[0],name:'Grave'},{...legacy[1],name:'Agudo'}])
  assert.equal(f.edit('move',{id:'a',t:2.5,value:.3}),true)
  assert.equal(f.key.volumeAutomation.find(p=>p.id==='a').name,'Grave')
  assert.deepEqual(f.key.volumeAutomation.map(p=>p.id),['b','a'])
})
test('INS-16 · mover punto sin nombre no lo migra a formato nuevo',()=>{
  const f=fixture(legacy)
  assert.equal(f.edit('move',{id:'a',t:1.5,value:.3}),true)
  assert.ok(!Object.hasOwn(f.key.volumeAutomation.find(p=>p.id==='a'),'name'))
})
test('INS-17 · duplicar clave conserva nombre y objetos independientes',()=>{
  const f=fixture([{...legacy[0],name:'Punto especial'}]),original=f.key.volumeAutomation
  const [ref]=duplicateTimelineSelection(f.timeline,[{tr:f.track.id,k:f.key.id}],1)
  const copy=f.track.keys.find(k=>k.id===ref.k)
  assert.equal(copy.volumeAutomation[0].name,'Punto especial')
  assert.notEqual(copy.volumeAutomation[0],original[0])
})
test('INS-18 · guardar/reabrir preserva el nombre y su asociación con ID',()=>{
  const f=fixture(legacy);f.edit('rename',{id:'b',name:'Melancolía'})
  const again=normalizeTimeline(JSON.parse(JSON.stringify(f.timeline)))
  assert.equal(again.tracks[0].keys[0].volumeAutomation.find(p=>p.id==='b').name,'Melancolía')
})
test('INS-19 · nombres no influyen en interpolación, volumen ni duración',()=>{
  const f=fixture(legacy),before=volumeAutomationAt(f.key.volumeAutomation,1.5),len=f.key.duration
  f.edit('rename',{id:'a',name:'Eco nocturno'})
  assert.equal(volumeAutomationAt(f.key.volumeAutomation,1.5),before)
  assert.equal(f.key.duration,len)
})
test('INS-20 · límite histórico de puntos permanece en 64',()=>{
  assert.equal(MAX_VOLUME_POINTS,64)
  const f=fixture(); for(let i=1;i<=64;i++)assert.equal(f.edit('add',{id:`id-${i}`,t:i/8,value:.3}),true)
  assert.equal(f.edit('add',{id:'too-much',t:8.125,value:.4}),false)
})
// Contrato UI y hooks existentes, sin sustitución de componentes.
test('INS-21 · Inspector reutiliza su sección y no introduce gestor global',()=>{
  assert.match(inspector,/class="inspector-audio-volume"/)
  assert.doesNotMatch(inspector,/import AudioVolumeManager/)
  assert.match(inspector,/volumeSectionOpen = ref\(true\)/)
  assert.match(inspector,/volumePointOpenIds = ref\(\[\]\)/)
})
test('INS-22 · encabezado principal accesible controla su propia sección',()=>{
  assert.match(inspector,/class="volume-section-toggle"/)
  assert.match(inspector,/:aria-expanded="volumeSectionOpen"/)
  assert.match(inspector,/@click="volumeSectionOpen = !volumeSectionOpen"/)
})
test('INS-23 · todos los puntos tienen encabezado accesible colapsable e independiente',()=>{
  assert.match(inspector,/v-for="\(point, index\) in visualVolumePoints"/)
  assert.match(inspector,/volumeAutomationVisualOrder/)
  assert.match(inspector,/class="volume-point-toggle"/)
  assert.match(inspector,/:aria-expanded="volumePointExpanded\(point\.id\)"/)
  assert.match(inspector,/@click="toggleVolumePoint\(point\.id\)"/)
})
test('INS-24 · campo Nombre usa edición persistente y límite de entrada',()=>{
  assert.match(inspector,/maxlength="48"/)
  assert.match(inspector,/@change="editInspectorVolumePoint\('rename',point,'name',\$event\)"/)
  assert.match(inspector,/changed\(action === 'remove'/)
})
test('INS-25 · la lista solo activa scroll con cinco puntos o más',()=>{
  assert.match(inspector,/:class="\{'volume-point-list-scroll': \(item\.volumeAutomation\?\.length \|\| 0\) >= 5\}"/)
  assert.match(inspector,/\.volume-point-list-scroll \{max-height:144px;overflow-y:auto;/)
})
test('INS-26 · el texto instructivo fue retirado y se conservan avisos de validación',()=>{
  assert.doesNotMatch(inspector,/Factor de 0–100 % del volumen base/)
  assert.doesNotMatch(inspector,/Doble clic sobre el audio para crear puntos/)
  assert.match(inspector,/Duración requerida/)
})
test('INS-27 · al contraer o expandir no se ejecuta una escritura de proyecto',()=>{
  assert.match(inspector,/function toggleVolumePoint\(id\) \{/)
  const toggle=inspector.match(/function toggleVolumePoint\(id\) \{[\s\S]*?\n\}/)?.[0]
  assert.ok(toggle)
  assert.doesNotMatch(toggle,/editTimelineAudioVolumePoint\(|commit\(|changed\(/)
})
test('INS-28 · el alta abre el nuevo punto sin abrir los existentes',()=>{
  assert.match(inspector,/volumePointOpenIds\.value = \[data\.id\]/)
  assert.match(inspector,/volumeSectionOpen\.value = true/)
})
test('INS-29 · eliminar punto limpia el estado local de expansión',()=>{
  assert.match(inspector,/volumePointOpenIds\.value\.filter\(id => id !== data\.id\)/)
})
test('INS-30 · se mantiene el commit habitual para Undo/Redo',()=>{
  assert.match(inspector,/changed\(action === 'remove' \? 'Eliminar punto de volumen' : action === 'rename' \? 'Renombrar punto de volumen'/)
})
test('INS-31 · normalización y modelo preservan nombres pero no modifican rutas DSP',()=>{
  const a=read('src/engine/runtime/audio/automation.js'), b=read('src/core/timeline/model.js')
  assert.match(a,/if \(name\) point\.name = name/)
  assert.match(b,/\{ \.\.\.point, t, value \}/)
  assert.doesNotMatch(b,/\.gain\.gain\.value =/)
})
test('INS-32 · ambos scripts de fixture Electron son sintácticamente válidos',()=>{
  const fixture=read('scripts/fixtures/editor/inspector-audio-volume-points-s12-g007-g001.html')
  const scripts=[...fixture.matchAll(/<script(?: type="module")?>([\s\S]*?)<\/script>/g)]
  assert.equal(scripts.length,2)
  for(const [,source] of scripts){const r=spawnSync(process.execPath,['--check','--input-type=module','-'],{input:source,encoding:'utf8'}); assert.equal(r.status,0,r.stderr)}
})
