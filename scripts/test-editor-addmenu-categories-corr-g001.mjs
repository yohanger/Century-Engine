// LF-EDITOR-ADDMENU-CATEGORIES-CORR-G001 — categorías de tipos reales sin cambiar su identidad.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { shiftANodeCatalog } from '../src/core/add-menu-catalog.js'
import { addMenuTree, searchAddNodes } from '../src/components/add-menu-model.js'

const src=p=>readFileSync(new URL(`../src/${p}`,import.meta.url),'utf8')
const expected={
  primitive:'Primitivas',water:'Ambiente',terrain:'Naturaleza',road:'Herramientas de modelado',
  subtract:'Herramientas de modelado',decal:'Efectos',text:'Visuales',vfx:'Efectos',
  atmovolume:'Ambiente',postvolume:'Ambiente',
}
const defs=Object.entries(expected).map(([type,category])=>({type,category,label:({road:'Carretera',text:'Texto 3D'}[type] || type),icon:type,
 ...(type==='primitive'?{kinds:{box:{label:'Cubo',icon:'box'},plane:{label:'Plano',icon:'plane'}}}:
 type==='water'?{kinds:{ocean:{label:'Océano',icon:'water-ocean'},river:{label:'Río',icon:'water-river'}}}:{})}))
defs.push({type:'mesh',category:'Malla',kinds:{vertex:{label:'Vértice',icon:'vertex'},cube:{label:'Cubo',icon:'box'},grid:{label:'Rejilla',icon:'grid'}}})
defs.push({type:'sprite3d',category:'Visuales',kinds:{sprite3d:{label:'Sprite 3D',icon:'sprite3d'},paint:{label:'Lienzo de píxeles 3D',icon:'pixel3d'}}})
defs.push({type:'sprite2d',category:'Interfaz',kinds:{sprite2d:{label:'Sprite 2D',icon:'sprite2d'}}})
const items=shiftANodeCatalog(defs)
const groups=new Map()
for(const item of items){if(!groups.has(item.category))groups.set(item.category,[]);groups.get(item.category).push({label:item.label,icon:item.icon,run:()=>item})}
const tree=addMenuTree([...groups].map(([label,children])=>({label,children})))

test('AC-01: Primitivas solo admite geometrías del tipo primitive',()=>assert.deepEqual([...new Set(items.filter(i=>i.category==='Primitivas').map(i=>i.type))],['primitive']))
test('AC-02: Agua: Océano y Río están en Ambiente',()=>{
 for(const kind of ['ocean','river'])assert.equal(items.find(i=>i.type==='water'&&i.kind===kind).category,'Ambiente')
})
test('AC-03: Terrain pasa a Naturaleza y los volúmenes permanecen en Ambiente',()=>{
 assert.equal(items.find(i=>i.type==='terrain').category,'Naturaleza')
 for(const type of ['atmovolume','postvolume'])assert.equal(items.find(i=>i.type===type).category,'Ambiente')
})
test('AC-04: Carretera, Subtract y vértices en Herramientas de modelado',()=>{
 for(const type of ['road','subtract','mesh'])assert.ok(items.some(i=>i.type===type&&i.category==='Herramientas de modelado'))
})
test('AC-05: no aparecen calcomanías ni VFX en Primitivas',()=>{
 for(const type of ['decal','vfx'])assert.equal(items.find(i=>i.type===type).category,'Efectos')
})
test('AC-06: Texto 3D, Sprite 3D y lienzo de píxeles 3D están en Visuales',()=>{
 for(const type of ['text','sprite3d'])assert.ok(items.some(i=>i.type===type&&i.category==='Visuales'))
})
test('AC-07: los Sprite 2D permanecen en Interfaz',()=>assert.equal(items.find(i=>i.type==='sprite2d').category,'Interfaz'))
test('AC-08: el alias Cubo conserva una sola entrada en Shift+A',()=>assert.equal(items.filter(i=>i.label==='Cubo').length,1))
test('AC-09: búsqueda localiza Agua fuera de Primitivas',()=>{
 assert.equal(searchAddNodes(tree,'oceano').at(0)?.group,'Ambiente')
 assert.equal(searchAddNodes(tree,'river').length,0)
 assert.equal(searchAddNodes(tree,'río').at(0)?.group,'Ambiente')
})
test('AC-10: búsqueda de Carretera/Texto/Vértice mantiene rutas reales',()=>{
 for(const [label,category] of [['Carretera','Herramientas de modelado'],['text','Visuales'],['Vértice','Herramientas de modelado']])
  assert.equal(searchAddNodes(tree,label)[0]?.group,category)
})
test('AC-11: no hay categoría Geometría confundida con Primitivas',()=>assert.ok(!groups.has('Geometría')))
test('AC-12: nombres de tipos y variantes no son alterados por la proyección',()=>{
 for(const item of items) assert.ok(defs.some(d=>d.type===item.type && (d.kinds?.[item.kind] || item.kind===item.type)))
})
test('AC-13: categorías se leen del registro, sin tabla paralela de alias por tipo',()=>{
 const s=src('core/add-menu-catalog.js')
 assert.match(s,/def\.category/)
 assert.doesNotMatch(s,/water:\s*'Ambiente'|road:\s*'Herramientas de modelado'/)
})
test('AC-14: entradas de nodo reales están declaradas en cada registro existente',()=>{
 for(const [type,category] of Object.entries(expected)) {
  const file=type==='primitive'?'primitive':type==='water'?'water':type==='road'?'road':type==='terrain'?'terrain':type==='subtract'?'subtract':type==='decal'?'decal':type==='text'?'text':type==='vfx'?'vfx':type
  assert.match(src(`engine/runtime/nodes/${file}.js`),new RegExp(`category:\\s*'${category}'`),`${type} debe figurar en ${category}`)
 }
 assert.match(src('engine/runtime/nodes/sprite.js'),/category: two \? 'Interfaz' : 'Visuales'/)
})
test('AC-15: ambas rutas de creación conservan la construcción original',()=>{
 const c=src('core/commands.js')
 assert.match(c,/for \(const def of allDefs\(\)\)/)
 assert.match(c,/for \(const item of shiftANodeCatalog\(allDefs\(\)\)\)/)
 assert.match(c,/store\.editor\.addAt\(spot, spec, \{ parentId, label \}\)/)
 assert.match(c,/startPlace\(def\.type, kind\)/)
 assert.match(c,/category: def\.type === 'mesh' \? 'Herramientas de modelado' : def\.category/)
})
test('AC-16: no cambian la API, la serialización ni las fábricas de nodos',()=>{
 for(const type of ['primitive','water','road','subtract','decal','text']) {
  const s=src(`engine/runtime/nodes/${type}.js`)
  assert.match(s,new RegExp(`type: '${type}'`));assert.match(s,/(?:create\(|create:\s*\()/);assert.match(s,/(?:build\(|build:\s*\()/)
 }
})
test('AC-17: categoría de Añadir Terreno concuerda con el registro',()=>{
 const c=src('core/commands.js'); assert.doesNotMatch(c,/add\('add\.terrain',/); assert.match(c,/def\.type === 'terrain' \? \(terrainOn\(\) \? addTerrainPiece\(\) : addTerrain\(\)\)/)
})
test('AC-18: el Editor mantiene Shift+A para Malla sin nuevo flujo',()=>{
 assert.match(src('core/commands.js'),/if \(store\.edit\.on\) return ed\.openEditAddMenu\(pos\)/)
 assert.match(src('core/editor/meshedit.js'),/Object\.entries\(MESH_KINDS\)/)
})
