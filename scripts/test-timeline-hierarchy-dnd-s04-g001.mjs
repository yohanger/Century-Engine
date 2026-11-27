import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { newTrack, normalizeTimeline, timelineTrackNodeOwner, readTimelineNodeProperty, upsertTimelineNodePropertyKey } from '../src/core/timeline/model.js'
import { nodeAnimationProperties } from '../src/engine/runtime/anim/model.js'

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const timeline = read('src/components/TimelinePanel.vue')
const sharedPreview = read('src/core/timeline/preview.js')
const inspector = read('src/components/TemporalResourceInspector.vue')
const sceneTree = read('src/components/SceneTree.vue')
const dock = read('src/components/DockTree.vue')
const start = timeline.indexOf('const objByName =')
const end = timeline.indexOf('// ---------- edición ----------')
assert.ok(start >= 0 && end > start)
const code = timeline.slice(start, end)

function harness() {
  const a = { id:'node-a', name:'Puerta', position:[1,2,3], rotation:[0,0,0], scale:[1,1,1], visible:true }
  const b = { id:'node-b', name:'Luz', position:[2,3,4], rotation:[0,0,0], scale:[1,1,1], visible:true }
  const objects = { value:[a,b] }
  const tl = { value:{ id:'cin-01', duration:8, tracks:[] } }
  const store = { menu: null, project:{activeSceneId:'scene-qa'}, locked:false, play:{on:false} }
  const toastMessages = [], commits = [], selected = []
  const nodeDropActive = { value:false }
  const playing = {value:false}
  let serial=0
  const nodeTargetId = {value:null}
  const ctx = { objects, tl, store, ph:{value:1}, nodeDropActive, playing, nodeAnimationProperties, timelineTrackNodeOwner, readTimelineNodeProperty, upsertTimelineNodePropertyKey,
    computed: read => ({get value(){return read()}}), playback:{yieldToEditing(){}},
    visibleRows:{value:[]}, nodeTargetId, sel:{value:null}, selectObject(){}, nextTick(){},
    timelineMenuAnchor:()=>null, pick:tr=>selected.push(tr.id),
    newTrack: (kind,extra) => ({ id:`pista-${++serial}`,kind,muted:false,keys:[],...extra }),
    commit:(text)=>commits.push(text), pickTrack:(tr)=>selected.push(tr.id), bump:()=>{}, toast:(msg,type)=>toastMessages.push([msg,type]) }
  vm.createContext(ctx); vm.runInContext(code, ctx)
  const event = (ids=['node-a'], type='application/x-lf-node') => {
    const changes={prevented:false,stopped:false}
    const ev={ clientX:200,clientY:180, dataTransfer:{ types:[type],dropEffect:'move',getData:()=>JSON.stringify(ids) },
      preventDefault:()=>{changes.prevented=true},stopPropagation:()=>{changes.stopped=true}, currentTarget:{getBoundingClientRect:()=>({left:0,right:600,top:0,bottom:400})}}
    return {ev,changes}
  }
  const drop = (ev) => {
    ctx.nodeDrop(ev)
    const node = objects.value.find(item=>item.id===nodeTargetId.value)
    if (node && !store.locked && !store.play.on) ctx.nodePicker(ev,{nodeId:node.id,node})
  }
  const choose = (label) => { const item=store.menu?.items.find(it=>it.label===label); assert.ok(item,label); item.run() }
  return { ctx, drop, nodeTargetId, a,b, objects, tl, store, nodeDropActive, toastMessages, commits, selected, event, choose }
}

test('Contrato real de la Jerarquía reutilizado sin inventar un tipo MIME', () => {
  assert.match(sceneTree, /setData\('application\/x-lf-node', JSON\.stringify\(dragIds\)\)/)
  assert.match(timeline, /NODE_DRAG_TYPE = 'application\/x-lf-node'/)
  assert.match(timeline, /@dragover="nodeDragOver" @dragleave="nodeDragLeave" @drop="nodeDrop"/)
  assert.match(timeline, /node-drop-target/)
  assert.match(dock, /if \(!hasDockDrag\(event\)\)/)
})

test('Soltar un nodo enfoca el encabezado y la llave crea la primera clave por ID', () => {
  const h=harness(), {ev,changes}=h.event()
  h.ctx.nodeDragOver(ev)
  assert.equal(changes.prevented,true)
  assert.equal(h.nodeDropActive.value,true)
  assert.equal(ev.dataTransfer.dropEffect,'copy')
  h.ctx.nodeDrop(ev)
  assert.equal(h.nodeDropActive.value,false)
  assert.equal(h.nodeTargetId.value,h.a.id)
  assert.equal(h.store.menu,null)
  assert.equal(h.tl.value.tracks.length,0)
  h.ctx.nodePicker(ev,{nodeId:h.a.id,node:h.a})
  assert.deepEqual(Array.from(h.store.menu.items.filter(it => it.label), it => it.label), ['Posición', 'Rotación (°)', 'Escala', 'Visible', 'Llamadas a métodos'])
  h.choose('Posición')
  const tr=h.tl.value.tracks[0]
  assert.equal(tr.node, 'node-a')
  assert.equal(tr.byId,true)
  assert.equal(tr.prop,'position')
  assert.equal(h.selected.at(-1),tr.id)
  assert.equal(tr.keys[0].t,1)
  assert.deepEqual(h.commits,['Insertar clave de propiedad'])
})

test('Todas las propiedades crean pistas serializables y preservan el modelo nativo', () => {
  const h=harness()
  for (const label of ['Posición', 'Rotación (°)', 'Escala', 'Visible']) { h.drop(h.event().ev); h.choose(label) }
  assert.deepEqual(h.tl.value.tracks.map(t=>t.prop),['position','rotation','scale','visible'])
  const normalized=normalizeTimeline({ id:'cin-01',name:'QA',duration:8,tracks:h.tl.value.tracks })
  assert.deepEqual(normalized.tracks.map(t=>[t.node,t.byId,t.prop]),[
    ['node-a',true,'position'],['node-a',true,'rotation'],['node-a',true,'scale'],['node-a',true,'visible']
  ])
})

test('Repetir propiedad selecciona la pista y no añade duplicados', () => {
  const h=harness()
  h.drop(h.event().ev);h.choose('Escala')
  h.drop(h.event().ev);h.choose('Escala')
  assert.equal(h.tl.value.tracks.length,1)
  assert.equal(h.selected.length,2)
  assert.equal(h.commits.length,1)
})

test('No duplica pista heredada por nombre sin ambigüedad', () => {
  const h=harness()
  h.tl.value.tracks.push(newTrack('node',{ node:'Puerta',prop:'position',byId:false }))
  h.drop(h.event().ev);h.choose('Posición')
  assert.equal(h.tl.value.tracks.length,1)
  h.objects.value.push({id:'node-c',name:'Puerta'})
  h.drop(h.event().ev);h.choose('Posición')
  assert.equal(h.tl.value.tracks.length,2)
  assert.equal(h.tl.value.tracks[1].node,'node-a')
})

test('Renombrar nodo conserva ID y evita duplicados posteriores', () => {
  const h=harness()
  h.drop(h.event().ev);h.choose('Visible')
  h.a.name='Puerta_Renombrada'
  h.drop(h.event().ev);h.choose('Visible')
  assert.equal(h.tl.value.tracks.length,1)
  assert.equal(h.tl.value.tracks[0].node,'node-a')
})

test('Menú obsoleto y nodo eliminado no alteran otro documento', () => {
  const h=harness()
  h.drop(h.event().ev)
  h.tl.value={id:'cin-02',tracks:[]}
  h.choose('Posición')
  assert.equal(h.tl.value.tracks.length,0)
  h.tl.value={id:'cin-01',tracks:[]}
  h.drop(h.event().ev)
  h.objects.value=h.objects.value.filter(o=>o.id!=='node-a')
  h.choose('Escala')
  assert.equal(h.tl.value.tracks.length,0)
  assert.equal(h.toastMessages.at(-1)[1],'error')
})

test('Soltados múltiples, inválidos y no relacionados no producen pistas', () => {
  const h=harness()
  h.ctx.nodeDrop(h.event(['node-a','node-b']).ev)
  assert.equal(h.tl.value.tracks.length,0)
  assert.match(h.toastMessages[0][0],/solo nodo/)
  h.ctx.nodeDrop(h.event(['desconocido']).ev)
  assert.equal(h.tl.value.tracks.length,0)
  const other=h.event(['node-a'],'application/x-lf-dock-panel')
  h.ctx.nodeDragOver(other.ev);h.ctx.nodeDrop(other.ev)
  assert.equal(other.changes.prevented,false)
  assert.equal(h.store.menu,null)
  h.ctx.nodeDrop({...h.event().ev,dataTransfer:{types:['application/x-lf-node'],getData:()=>'{'}})
  assert.equal(h.tl.value.tracks.length,0)
})

test('Inspector asigna IDs al cambiar nodo, y preview respeta modo ID', () => {
  assert.match(inspector,/track\.value\.byId = track\.value\.kind === 'method' \|\| !!value/)
  assert.match(inspector, /:value="timelineNodeId"/)
  assert.match(inspector, /:value="o\.id"/)
  assert.match(inspector, /timelineNode = computed/)
  assert.match(sharedPreview, /this\.nodeOf\(track\.node, track\.byId === true\)/)
  assert.match(timeline, /const node = trackOwner\(tr\)/)
  assert.match(timeline, /byId \? objects\.value\.find/)
  assert.match(timeline, /upsertTimelineNodePropertyKey\(tl\.value/)
})

test('Sintaxis de los componentes, sin cambios en runtime ni modelos', () => {
  const dir=mkdtempSync(join(tmpdir(),'lf-s04-'))
  try {
    for (const [name,src] of [['TimelinePanel',timeline],['TemporalResourceInspector',inspector]]) {
      const script=src.match(/<script setup>([\s\S]*?)<\/script>/)?.[1]
      assert.ok(script)
      const file=join(dir,name+'.mjs')
      writeFileSync(file,script)
      const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'})
      assert.equal(r.status,0,r.stderr)
    }
  } finally {rmSync(dir,{recursive:true,force:true})}
})

test('Evaluación de valor y preview resuelven el nodo exacto al cambiar de nombre', () => {
  const a={id:'node-a',name:'Renombrado',position:[9,8,7],visible:true}
  const b={id:'node-b',name:'node-a',position:[100,200,300],visible:false}
  const objects={value:[b,a]}
  const methodSource = sharedPreview.slice(sharedPreview.indexOf('  nodeOf(value, byId = false) {'), sharedPreview.indexOf('  resolve(key) {')).replace(/^  nodeOf/, 'function nodeOf')
  const ctx={objects,store:{editor:{nodes:new Map([['node-a',{ref:'A'}],['node-b',{ref:'B'}]])}},
    objByName:(value)=>objects.value.find(o=>o.name===value||o.id===value),
    trackObject:(tr)=>tr.byId?objects.value.find(o=>o.id===tr.node):objects.value.find(o=>o.name===tr.node||o.id===tr.node)}
  vm.createContext(ctx)
  vm.runInContext(methodSource,ctx)
  const nodeOf=ctx.nodeOf.bind({getObjects:()=>objects.value,getEditor:()=>ctx.store.editor})
  const track = {kind:'node',node:'node-a',byId:true,prop:'position'}
  const owner = timelineTrackNodeOwner(track,objects.value,'scene-qa')
  assert.deepEqual(readTimelineNodeProperty(owner.node,track.prop),[9,8,7])
  assert.equal(nodeOf('node-a',true).o.id,'node-a')
  assert.equal(nodeOf('node-a',true).n.ref,'A')
  assert.equal(nodeOf('Renombrado',false).o.id,'node-a')
  assert.equal(nodeOf('node-a',false).o.id,'node-b')
})

test('Selector de nodo en Inspector convierte pista heredada de nombre a ID', () => {
  const section=inspector.slice(inspector.indexOf('function timelineNodeChange('),inspector.indexOf('function timelinePropChange('))
  const track={value:{node:'Nombre heredado',byId:false}}, labels=[]
  const ctx={track,trackChange:(label)=>labels.push(label)}
  vm.createContext(ctx);vm.runInContext(section,ctx)
  ctx.timelineNodeChange('id-estable')
  assert.equal(track.value.node,'id-estable')
  assert.equal(track.value.byId,true)
  ctx.timelineNodeChange('')
  assert.equal(track.value.byId,false)
  assert.equal(labels.length,2)
})
