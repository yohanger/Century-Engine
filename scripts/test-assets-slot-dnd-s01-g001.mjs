// Contrato S01 G001: payload real de Assets, resolución por ID/tipo y regresión de destinos existentes.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  ASSET_ENTRY_MIME, ASSET_ENTRIES_MIME, hasAssetDrag, readAssetDrag,
  resolveAssetDrop, writeAssetDrag,
} from '../src/core/editor/asset-drop.js'
import { draggedScriptId, nodeScriptFromDrop, hasAssetEntry } from '../src/core/editor/script-drop.js'

function transfer(initial = {}) {
  const data = new Map(Object.entries(initial))
  return {
    get types() { return [...data.keys()] },
    setData(type, value) { data.set(type, value) },
    getData(type) { return data.get(type) || '' },
  }
}
const t = (...items) => { const dt = transfer(); assert.equal(writeAssetDrag(dt, items), true); return dt }
const records = [
  { id: 'tx1', kind: 'texture', name: 'Piso.png', folder: 'Assets/Pisos', ref: { id: 'tx1', kind: 'texture' } },
  { id: 'm1', kind: 'model', name: 'Piso.glb', folder: 'Assets/Models' },
  { id: 's1', kind: 'script', name: 'Comportamiento.js', folder: 'Assets/Scripts' },
  { id: 'a1', kind: 'audio', name: 'Impacto.ogg', folder: 'Assets/Audio' },
  { id: 'v1', kind: 'vfx', name: 'Chispas.vfx', folder: 'Assets/VFX' },
]
const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8')

test('DND-01 emite MIME individual y plural sin rutas ni nombres en identidad', () => {
  const dt = t({kind:'texture',id:'tx1'})
  assert.deepEqual(JSON.parse(dt.getData(ASSET_ENTRY_MIME)), {kind:'texture',id:'tx1'})
  assert.deepEqual(JSON.parse(dt.getData(ASSET_ENTRIES_MIME)), [{kind:'texture',id:'tx1'}])
})
test('DND-02 conserva el arrastre de carpetas y la primera entrada no carpeta', () => {
  const dt = t({kind:'folder',id:'Assets/Pisos'},{kind:'texture',id:'tx1'})
  assert.equal(JSON.parse(dt.getData(ASSET_ENTRY_MIME)).id, 'tx1')
  assert.deepEqual(readAssetDrag(dt, {multiple:true}), [{kind:'folder',id:'Assets/Pisos'},{kind:'texture',id:'tx1'}])
})
test('DND-03 no anuncia entrada individual para carpeta sola', () => {
  const dt = t({kind:'folder',id:'Assets/Pisos'})
  assert.equal(dt.getData(ASSET_ENTRY_MIME),'')
  assert.equal(readAssetDrag(dt), null)
})
test('DND-04 entrada individual válida y lectura de legacy MIME', () => {
  const dt = transfer({[ASSET_ENTRY_MIME]:JSON.stringify({kind:'script',id:'s1'})})
  assert.deepEqual(readAssetDrag(dt), [{kind:'script',id:'s1'}])
})
test('DND-05 arrastre múltiple no entra en slot de recurso único', () => {
  assert.equal(resolveAssetDrop(t({kind:'texture',id:'tx1'},{kind:'audio',id:'a1'}), records, {kinds:['texture']}),null)
})
test('DND-06 los payloads individual y plural deben ser coherentes', () => {
  const dt = t({kind:'texture',id:'tx1'})
  dt.setData(ASSET_ENTRY_MIME, JSON.stringify({kind:'texture',id:'tx2'}))
  assert.equal(readAssetDrag(dt),null)
})
test('DND-07 JSON corrupto no provoca excepciones ni asignaciones', () => {
  const dt = transfer({[ASSET_ENTRIES_MIME]:'{mal'})
  assert.equal(readAssetDrag(dt),null)
  assert.equal(resolveAssetDrop(dt, records, {kinds:['texture']}),null)
})
test('DND-08 valores de tipo o ID falsificados son rechazados', () => {
  for (const entry of [{kind:'unknown',id:'x'},{kind:'texture',id:''},{kind:'texture',id:13},null,{kind:'texture',id:'tx1',path:'/tmp'}]) {
    const dt = transfer({[ASSET_ENTRY_MIME]:JSON.stringify(entry)})
    assert.equal(readAssetDrag(dt),null)
  }
})
test('DND-09 IDs duplicados o lista vacía se rechazan', () => {
  assert.equal(readAssetDrag(transfer({[ASSET_ENTRIES_MIME]:'[]'})),null)
  const dup = transfer({[ASSET_ENTRIES_MIME]:JSON.stringify([{kind:'model',id:'m1'},{kind:'model',id:'m1'}])})
  assert.equal(readAssetDrag(dup,{multiple:true}),null)
})
test('DND-10 no se permite establecer payload con tipo o ID inválido', () => {
  const dt=transfer(); assert.equal(writeAssetDrag(dt,[{kind:'script',id:'\n'}]),false)
  assert.equal(dt.types.length,0)
})
test('DND-11 solo permite tipo compatible con slot', () => {
  assert.equal(resolveAssetDrop(t({kind:'audio',id:'a1'}),records,{kinds:['texture']}),null)
  assert.equal(resolveAssetDrop(t({kind:'texture',id:'tx1'}),records,{kinds:['texture']})?.id,'tx1')
})
test('DND-12 IDs inexistentes o eliminados no se asignan', () => {
  assert.equal(resolveAssetDrop(t({kind:'texture',id:'deleted'}),records,{kinds:['texture']}),null)
})
test('DND-13 suplantar tipo de un ID existente no permite asignación', () => {
  assert.equal(resolveAssetDrop(t({kind:'script',id:'tx1'}),records,{kinds:['script']}),null)
})
test('DND-14 un registro ambiguo nunca resuelve de forma arbitraria', () => {
  assert.equal(resolveAssetDrop(t({kind:'texture',id:'tx1'}),[...records,records[0]],{kinds:['texture']}),null)
})
test('DND-15 renombrar o mover conserva el ID y lee el registro actualizado', () => {
  const updated = records.map((e) => e.id==='tx1' ? {...e, name:'Nuevo.png', folder:'Assets/Nuevos'} : e)
  const entry = resolveAssetDrop(t({kind:'texture',id:'tx1'}),updated,{kinds:['texture']})
  assert.equal(entry.name,'Nuevo.png')
  assert.equal(entry.folder,'Assets/Nuevos')
})
test('DND-16 puede validar características del recurso real y rechazarlo', () => {
  assert.equal(resolveAssetDrop(t({kind:'audio',id:'a1'}),records,{kinds:['audio'],accepts:(e)=>e.ext==='wav'}),null)
})
test('DND-17 soporte múltiple conserva orden y filtra otros tipos en follaje', () => {
  const list=resolveAssetDrop(t({kind:'folder',id:'Assets'},{kind:'model',id:'m1'},{kind:'audio',id:'a1'},{kind:'texture',id:'tx1'}),records,{kinds:['model','texture'],multiple:true,filterKinds:true})
  assert.deepEqual(list?.map((e)=>e.id),['m1','tx1'])
})
test('DND-18 el arrastre de archivos del sistema no se confunde con Assets', () => {
  assert.equal(hasAssetDrag(transfer({'Files':'archivo'})),false)
  assert.equal(readAssetDrag(transfer({'Files':'archivo'})),null)
})
test('DND-19 TypeList del navegador y datos vacíos son seguros', () => {
  assert.equal(hasAssetEntry({types:{0:ASSET_ENTRY_MIME,length:1}}),true)
  assert.equal(hasAssetEntry({types:[]}),false)
  assert.equal(readAssetDrag({getData:()=>''}),null)
})
test('DND-20 Inspector conserva asociación de Script de Nodo real', () => {
  const dt=t({kind:'script',id:'s1'})
  assert.equal(draggedScriptId(dt),'s1')
  assert.equal(nodeScriptFromDrop(dt,[{id:'s1',execution:'node'}])?.id,'s1')
  assert.equal(nodeScriptFromDrop(dt,[]),null)
})
test('DND-21 multiselección, script falso o script inexistente no se asocia', () => {
  assert.equal(nodeScriptFromDrop(t({kind:'script',id:'s1'},{kind:'script',id:'s2'}),[{id:'s1'}]),null)
  assert.equal(nodeScriptFromDrop(t({kind:'model',id:'m1'}),[{id:'m1'}]),null)
})
test('DND-22 emisor usa protocolo único y no lo reimplementa', () => {
  const src=read('src/components/ProjectPanel.vue')
  assert.match(src,/writeAssetDrag\(e\.dataTransfer, dragging, it\.name\)/)
  assert.doesNotMatch(src,/setData\('application\/x-lf-entr/)
})
test('DND-23 destinos existentes utilizan validación común por ID y tipo', () => {
  for(const name of ['ImageField.vue','IconField.vue','TerrainPanel.vue']) {
    const source=read(`src/components/${name}`)
    assert.match(source,/resolveAssetDrop\(/,name)
    assert.doesNotMatch(source,/JSON\.parse\(raw\)/,name)
  }
})
test('DND-24 se conserva la separación entre slot e instanciación de escena', () => {
  const src=read('src/components/ProjectPanel.vue')
  assert.match(src,/dropPrefab\(it\.id\)/)
  assert.match(read('src/components/SceneTree.vue'),/nodeScriptFromDrop\(e\.dataTransfer/)
  assert.doesNotMatch(read('src/core/editor/asset-drop.js'),/dropPrefab|placeModel|addObject|commit\(/)
})
test('DND-25 la resolución no muta el registro ni el payload', () => {
  const expected=JSON.stringify(records)
  const dt=t({kind:'texture',id:'tx1'});const payload=dt.getData(ASSET_ENTRY_MIME)
  resolveAssetDrop(dt,records,{kinds:['texture']})
  assert.equal(JSON.stringify(records),expected)
  assert.equal(dt.getData(ASSET_ENTRY_MIME),payload)
})
test('DND-26 no se acepta payload plural corrupto aunque el individual sea válido', () => {
  const dt=t({kind:'texture',id:'tx1'})
  dt.setData(ASSET_ENTRIES_MIME,'{bad')
  assert.equal(resolveAssetDrop(dt,records,{kinds:['texture']}),null)
})
