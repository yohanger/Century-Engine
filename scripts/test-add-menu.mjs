import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { addMenuTree, searchAddNodes, addMenuPosition, addSubmenuPosition } from '../src/components/add-menu-model.js'

const calls = []
const options = [
  { heading: 'Añadir dentro de «Grupo»' },
  { label: 'Primitivas', icon: 'box', children: [
    { label: 'Cubo', icon: 'box', run: () => calls.push('cube') },
    { label: 'Hueco', children: [{ label: 'Cilindro (túnel)', run: () => calls.push('hole') }] },
    { sep: true },
  ] },
  { label: 'Gameplay', children: [
    { label: 'Gameplay Object', run: () => calls.push('gp') },
    { label: 'Event', run: () => calls.push('event') },
  ] },
  { label: 'Modelos del proyecto', children: [
    { label: 'Modelo importado', run: () => calls.push('model') },
    { sep: true },
    { label: 'Importar archivos…', run: () => calls.push('import') },
  ] },
  { label: 'Siempre dentro del seleccionado', checked: false, run: () => {} },
]

test('ADD-01 · conserva jerarquía, subgrupos y acciones del registro', () => {
  const tree = addMenuTree(options)
  assert.deepEqual(tree.map((it) => it.label), ['Primitivas', 'Gameplay', 'Modelos del proyecto'])
  assert.equal(tree[0].children[1].children[0].label, 'Cilindro (túnel)')
  tree[1].children[0].run(); tree[1].children[1].run()
  tree[2].children[0].run(); tree[2].children[1].run()
  assert.deepEqual(calls, ['gp', 'event', 'model', 'import'])
})
test('ADD-02 · excluye títulos, separadores, preferencias y opciones sin acción', () => {
  assert.equal(addMenuTree([...options, { label: 'Inerte' }]).length, 3)
  assert.equal(addMenuTree([{ label: 'Vacío', children: [{ sep: true }] }]).length, 0)
})
test('ADD-03 · búsqueda ignora tildes y mayúsculas', () => {
  assert.equal(searchAddNodes(addMenuTree(options), 'CILINDRO tunel')[0].label, 'Cilindro (túnel)')
  assert.equal(searchAddNodes(addMenuTree(options), 'GAMEPLAY OBJECT')[0].label, 'Gameplay Object')
})
test('ADD-04 · búsqueda encuentra hojas de cualquier profundidad con ruta', () => {
  const list = searchAddNodes(addMenuTree(options), 'primitivas hueco cilindro')
  assert.equal(list.length, 1)
  assert.equal(list[0].group, 'Primitivas › Hueco')
  assert.equal(searchAddNodes(addMenuTree(options), 'modelos importado').length, 1)
})
test('ADD-05 · búsqueda no devuelve categorías como nodos añadibles', () => {
  assert.deepEqual(searchAddNodes(addMenuTree(options), 'Gameplay').map((it) => it.label), ['Gameplay Object', 'Event'])
  assert.equal(searchAddNodes(addMenuTree(options), 'xyz-missing').length, 0)
})
test('ADD-06 · anclaje conserva posición del puntero si hay espacio', () => {
  assert.deepEqual(addMenuPosition({x:150,y:110},{width:1000,height:800}), {left:150,top:110})
})
test('ADD-07 · anclaje se mantiene en pantalla cerca de los bordes', () => {
  assert.deepEqual(addMenuPosition({x:994,y:795},{width:1000,height:800}), {left:724,top:442})
  assert.deepEqual(addMenuPosition({x:-5,y:-9},{width:1000,height:800}), {left:8,top:8})
})
test('ADD-08 · un submenú se abre a la derecha si hay espacio', () => {
  assert.deepEqual(addSubmenuPosition({top:120},{left:80,right:348},{width:1200,height:800}), {left:350,top:120})
})
test('ADD-09 · un submenú invierte lado si no cabe a la derecha', () => {
  assert.deepEqual(addSubmenuPosition({top:710},{left:700,right:968},{width:1000,height:800}), {left:438,top:442})
})
test('ADD-10 · el menú usa ramas, búsqueda y navegación sin una cuadrícula de tarjetas', () => {
  const vue = readFileSync(new URL('../src/components/AddModal.vue', import.meta.url),'utf8')
  assert.match(vue, /@mouseenter="moveTo\(/)
  assert.match(vue, /ArrowRight/)
  assert.match(vue, /ArrowLeft/)
  assert.match(vue, /@keydown="key"/)
  assert.doesNotMatch(vue, /width:\s*760px|height:\s*520px|class="grid"/)
})
test('ADD-11 · abrir Añadir conserva coordenadas y punto de inserción', () => {
  const src = readFileSync(new URL('../src/core/commands.js', import.meta.url),'utf8')
  assert.match(src, /const menu = \{ items: shiftAItems\(spot\), spot, at:/)
  assert.match(src, /menu\.refresh = \(\) => \{ menu\.items = shiftAItems\(spot\) \}/)
  assert.match(src, /store\.editor\.addAt\(spot, spec, \{ parentId, label \}\)/)
})
test('ADD-12 · reutiliza las acciones originales, sin segundo registro de nodos', () => {
  const src = readFileSync(new URL('../src/core/commands.js', import.meta.url),'utf8')
  assert.match(src, /for \(const def of allDefs\(\)\)/)
  assert.match(src, /store\.project\?\.models \|\| \[\]/)
  assert.match(src, /if \(store\.edit\.on\) return ed\.openEditAddMenu\(pos\)/)
})
test('ADD-13 · una opción de menú cambia preferencia sin ejecutar nodos', () => {
  assert.equal(addMenuTree(options).some((it) => it.checked !== undefined), false)
  const src = readFileSync(new URL('../src/components/AddModal.vue', import.meta.url), 'utf8')
  assert.match(src, /m\.value\?\.refresh\?\.\(\)/)
  assert.match(src, /@change="toggleChild"/)
})
test('ADD-14 · campo de búsqueda mantiene foco y salir no modifica la escena', () => {
  const src = readFileSync(new URL('../src/components/AddModal.vue', import.meta.url), 'utf8')
  assert.match(src, /input\.value\?\.focus\(\)/)
  assert.match(src, /@pointerdown\.prevent/)
  assert.match(src, /function close\(\) \{ store\.addModal = null \}/)
  assert.match(src, /function pick\(item\)/)
  assert.match(src, /@click="choose\(/)
})
test('ADD-15 · no se modifica el flujo de Shift+A en modo edición de malla', () => {
  const src = readFileSync(new URL('../src/core/editor/meshedit.js', import.meta.url), 'utf8')
  assert.match(src, /openEditAddMenu\(pos\)/)
  assert.match(src, /this\.edit\?\.addPrimitive\(k\)/)
})
