// Revisión contractual S01: CORR-001 sustituye la proyección virtual por nodos reales.
// Se conserva esta suite histórica para proteger las funciones aprobadas de S01.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = f => readFileSync(new URL(`../src/${f}`, import.meta.url),'utf8')
const tree=read('components/SceneTree.vue')
const state=read('core/state/terrain.js')
const node=read('engine/runtime/nodes/terrain.js')
const io=read('engine/runtime/geometry/terrain-io.js')
const scene=read('engine/runtime/scene/environment.js')

test('TN1-01: piezas integradas en el árbol real sin lista paralela',()=>{
  assert.match(tree,/for \(const o of store\.project\.objects\)/)
  assert.doesNotMatch(tree,/terrainTreeNodes\(|terrainRows/)
})
test('TN1-02: sin piezas activas no aparecen nodos ficticios',()=>{
  assert.match(state,/const enabled = new Set\(ed\.terrains\.filter\(t => t\.enabled !== false\)/)
  assert.match(state,/if \(t\.enabled === false\) continue/)
})
test('TN1-03: las piezas desactivadas siguen existiendo en Terrain, no como nodos',()=>{
  assert.match(state,/for \(const node of oldNodes\) if \(!enabled\.has\(node\.id\)\)/)
  assert.match(state,/ed\.removeObject\?\.\(node\.id\)/)
})
test('TN1-04: búsqueda, navegación, selección y contador usan árbol común',()=>{
  for (const signature of ['subtreeHas(o)','walk(null, 0)','rowIndex','const total = computed','selSet.has(row.o.id)',"row.o.type === 'terrain'"]) assert.ok(tree.includes(signature),signature)
})
test('TN1-05: seleccionar pieza abre Inspector contextual del nodo real',()=>{
  assert.match(state,/export function selectPiece\(id\)/)
  assert.match(state,/store\.prefs\.rightTab = 'object'/)
  assert.match(state,/selectObject\(id\)/)
})
test('TN1-06: Terrain puede reordenarse en raíz, sin permitir parentesco físico',()=>{
  assert.match(tree,/draggable="true"/)
  assert.match(tree,/dragIds\.some\(id => getObject\(id\)\?\.type === 'terrain'\)/)
  assert.match(read('core/state/tree.js'),/Terreno solo admite ordenación entre nodos raíz/)
})
test('TN1-07: alturas, pintura y vegetación siguen exclusivamente en Terrain',()=>{
  for(const value of ['heights:', 'splat:', 'foliage:']) assert.match(io,new RegExp(value))
  assert.doesNotMatch(node,/new THREE\.Mesh/)
})
test('TN1-08: sincronización selecciona misma identidad de pieza',()=>{
  assert.match(state,/setActivePiece\(id\)/)
  assert.match(state,/props: \{ terrainId: t\.id \}/)
})
test('TN1-09: el panel puede seleccionar y mostrar pieza',()=>{
  assert.match(state,/export function setPieceVisible\(id, visible\)/)
  assert.match(state,/t\.visible = !!visible/)
})
test('TN1-10: visibilidad no equivale a existencia física',()=>{
  assert.match(scene,/t\.mesh\.visible = v\.terrain && t\.enabled && on && shown && t\.visible !== false/)
  assert.doesNotMatch(read('engine/runtime/geometry/terrain.js'),/groundAt\(x, z\).*this\.visible/)
})
test('TN1-11: visibilidad se guarda y se restaura con Undo',()=>{
  assert.match(io,/visible: this\.visible !== false/)
  assert.match(io,/this\.visible = s\.visible !== false/)
})
test('TN1-12: renombrar Terrain se replica en el nodo',()=>{
  assert.match(state,/export function renamePiece\(id, name\)/)
  assert.match(state,/node\.name = t\.name/)
})
test('TN1-13: borrar Terrain pasa por la ruta física existente',()=>{
  assert.match(tree,/removeTerrain\(\)/)
  assert.match(state,/store\.project\.terrain\.enabled = false/)
})
test('TN1-14: S04 retira el reencuadre tras remuestrear sin alterar transform Y',()=>{
  assert.match(read('engine/runtime/geometry/terrain.js'),/setOffset\(x, z, y = this.oy\)/)
  assert.doesNotMatch(read('components/TerrainPanel.vue'),/store\.editor\.frameAll\(\)/)
})
test('TN1-15: tipo registrado en el catálogo de nodos',()=>{
  assert.match(node,/type: 'terrain'/)
  assert.match(read('engine/runtime/nodes/index.js'),/import '\.\/terrain\.js'/)
})
test('TN1-16: S01 conserva edición Terrain sin estado de geometría duplicado',()=>{
  assert.match(node,/return makeRoot\(obj\)\.root/)
  assert.doesNotMatch(node,/heights:|splat:|foliage:|new THREE\.Mesh/)
})
