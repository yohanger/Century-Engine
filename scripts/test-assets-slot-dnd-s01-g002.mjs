// QA de G002: ejecuta los handlers reales del receptor sin montar Electron ni Vue.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { hasAssetDrag, resolveAssetDrop, writeAssetDrag, ASSET_ENTRY_MIME } from '../src/core/editor/asset-drop.js'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const records = [
  {kind:'audio',id:'audio1',name:'lluvia.ogg'},
  {kind:'file',id:'file1',name:'voz.wav'},
  {kind:'file',id:'file2',name:'notas.txt'},
  {kind:'texture',id:'tex1',name:'asfalto.png'},
  {kind:'profile',id:'profile1',name:'Exterior.post'},
  {kind:'script',id:'script1',name:'Jugador.js'},
]
function transfer(...entries) {
  const data = new Map()
  const value = { get types() { return [...data.keys()] }, setData(k,v) { data.set(k,v) }, getData(k) { return data.get(k) || '' } }
  if (entries.length) assert.equal(writeAssetDrag(value, entries), true)
  return value
}
function event(dataTransfer) {
  return { dataTransfer, prevented:false, stopped:false,
    preventDefault(){this.prevented=true}, stopPropagation(){this.stopped=true},
    currentTarget:{contains:()=>false}, relatedTarget:null,
  }
}
function instantiate(kinds, acceptedIds, projectRecords=records) {
  const source=read('src/components/ResourceDropSlot.vue').match(/<script setup>([\s\S]*?)<\/script>/)?.[1]
  assert.ok(source,'script setup real')
  const stripped=source.replace(/^import .*$/gm,'')
  const events=[]
  const ctx={ defineProps:()=>({kinds,acceptedIds}), defineEmits:()=>((...args)=>events.push(args)), ref:(v)=>({value:v}),
    store:{project:{records:projectRecords}}, allEntries:p=>p.records, hasAssetDrag, resolveAssetDrop,
  }
  vm.runInNewContext(`${stripped}\nglobalThis.result = {dragOver, dragLeave, drop, over};`,ctx,{filename:'ResourceDropSlot.vue'})
  return {...ctx.result,events}
}
const simple=(kinds,ids,dt)=>{const slot=instantiate(kinds,ids);const e=event(dt);slot.drop(e);return {slot,e}}

test('S01-G002-01 acepta textura en slot Decal por ID real',()=>{
  const {slot,e}=simple(['texture'],['tex1'],transfer({kind:'texture',id:'tex1'}))
  assert.deepEqual(slot.events,[['assign','tex1']]);assert.equal(e.prevented,true);assert.equal(e.stopped,true)
})
test('S01-G002-02 rechaza audio en Decal sin asignación',()=>{
  const {slot}=simple(['texture'],['tex1'],transfer({kind:'audio',id:'audio1'}));assert.deepEqual(slot.events,[['reject']])
})
test('S01-G002-03 recibe audio del proyecto (audio y file admitidos por extensión)',()=>{
  for (const [kind,id] of [['audio','audio1'],['file','file1']]) {
    const {slot}=simple(['audio','file'],['audio1','file1'],transfer({kind,id}));assert.deepEqual(slot.events,[['assign',id]])
  }
})
test('S01-G002-04 un file que no sea audio no entra aunque sea un file válido',()=>{
  const {slot}=simple(['audio','file'],['audio1','file1'],transfer({kind:'file',id:'file2'}));assert.deepEqual(slot.events,[['reject']])
})
test('S01-G002-05 perfil .post solo acepta profile del proyecto',()=>{
  assert.deepEqual(simple(['profile'],['profile1'],transfer({kind:'profile',id:'profile1'})).slot.events,[['assign','profile1']])
  assert.deepEqual(simple(['profile'],['profile1'],transfer({kind:'texture',id:'tex1'})).slot.events,[['reject']])
})
test('S01-G002-06 recurso eliminado e identidad falsificada rechazados',()=>{
  assert.deepEqual(simple(['texture'],['tex1'],transfer({kind:'texture',id:'deleted'})).slot.events,[['reject']])
  assert.deepEqual(simple(['texture'],['tex1'],transfer({kind:'texture',id:'script1'})).slot.events,[['reject']])
})
test('S01-G002-07 selección múltiple no entra en slot singular',()=>{
  const {slot}=simple(['texture'],['tex1'],transfer({kind:'texture',id:'tex1'},{kind:'profile',id:'profile1'}))
  assert.deepEqual(slot.events,[['reject']])
})
test('S01-G002-08 payload corrupto y nombres suplantados no mutan',()=>{
  const dt=transfer({kind:'texture',id:'tex1'})
  dt.setData(ASSET_ENTRY_MIME,JSON.stringify({kind:'texture',id:'fake'}))
  assert.deepEqual(simple(['texture'],['tex1'],dt).slot.events,[['reject']])
})
test('S01-G002-09 los archivos arrastrados del SO no son recursos del proyecto',()=>{
  const dt={types:['Files'],getData:()=>'',files:[{name:'piso.png'}]}
  const {slot,e}=simple(['texture'],['tex1'],dt)
  assert.deepEqual(slot.events,[]);assert.equal(e.prevented,false);assert.equal(e.stopped,false)
})
test('S01-G002-10 dragover muestra estado; dragleave limpia',()=>{
  const slot=instantiate(['texture'],['tex1']);const e=event(transfer({kind:'texture',id:'tex1'}))
  slot.dragOver(e);assert.equal(slot.over.value,true);assert.equal(e.prevented,true)
  slot.dragLeave(e);assert.equal(slot.over.value,false)
})
test('S01-G002-11 el drop no válido se detiene antes de llegar al viewport',()=>{
  const {slot,e}=simple(['texture'],['tex1'],transfer({kind:'model',id:'model1'}))
  assert.deepEqual(slot.events,[['reject']]);assert.equal(e.stopped,true)
})
test('S01-G002-12 reordenar/renombrar es transparente porque resuelve por ID',()=>{
  const renamed=records.map(r=>r.id==='tex1'?{...r,name:'asfalto-renombrado.png'}:r)
  assert.deepEqual(instantiate(['texture'],['tex1'],renamed).events,[])
  assert.deepEqual(simple(['texture'],['tex1'],transfer({kind:'texture',id:'tex1'})).slot.events,[['assign','tex1']])
})
test('S01-G002-13 los campos están conectados a la API que ya guarda y genera Undo',()=>{
  const inspector=read('src/components/Inspector.vue'),profile=read('src/components/ProfileSlot.vue')
  assert.match(inspector, /<ResourceDropSlot :kinds="\['texture'\]" :accepted-ids="decalImageIds"/)
  assert.match(inspector, /@assign="upd\(\{ props: \{ image: \$event \} \}\)"/)
  assert.match(inspector, /<ResourceDropSlot :kinds="\['audio', 'file'\]" :accepted-ids="audioAssetIds"/)
  assert.match(inspector, /@assign="sp\('clip', \$event, true\)"/)
  assert.match(profile, /@assign="set"/)
  assert.match(profile, /updateObject\(props\.obj\.id, \{ props: \{ profile: id \|\| '' \} \}\)/)
  assert.match(read('src/core/state/objects.js'), /if \(doCommit\) commit\(/)
})
test('S01-G002-14 se conservan scripts, imágenes, iconos y las rutas del selector',()=>{
  const inspector=read('src/components/Inspector.vue');const profile=read('src/components/ProfileSlot.vue')
  assert.match(inspector, /onScriptDrop/)
  assert.match(inspector, /:value="aq\.clip" @change="sp\('clip', \$event\.target\.value, true\)"/)
  assert.match(inspector, /:value="obj\.props\.image \|\| ''" @change="upd/)
  assert.match(profile,/data-testid="profile-slot" @change="set\(\$event\.target\.value\)"/)
  for(const filename of ['ImageField.vue','IconField.vue']) assert.match(read(`src/components/${filename}`), /resolveAssetDrop\(/)
})
test('S01-G002-15 no se modifica serialización ni Player ni gestor de recursos',()=>{
  const component=read('src/components/ResourceDropSlot.vue')
  assert.doesNotMatch(component,/setData\(|JSON\.parse\(|createObject\(|addObject\(|commit\(/)
  assert.match(component,/resolveAssetDrop\(event\.dataTransfer, allEntries\(store\.project\)/)
})
