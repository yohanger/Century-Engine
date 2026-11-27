// LF-EDITOR-ADD-MENU-CORR-G001 — contrato ejecutable del catálogo Shift+A.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { shiftANodeCatalog } from '../src/core/add-menu-catalog.js'
import { addMenuTree, searchAddNodes } from '../src/components/add-menu-model.js'

const defs = [
  { type: 'primitive', category: 'Primitivas', kinds: Object.fromEntries(
    [['box','Cubo'],['plane','Plano'],['cylinder','Cilindro'],['cone','Cono'],['sphere','Esfera'],['ramp','Rampa'],['stairs','Escalera']]
      .map(([key,label]) => [key,{ label, icon: `icon-${key}` }])) },
  { type: 'mesh', category: 'Malla', kinds: Object.fromEntries(
    [['vertex','Vértice'],['cube','Cubo'],['plane','Plano'],['grid','Rejilla'],['circle','Círculo'],['cylinder','Cilindro'],['cone','Cono'],['sphere','Esfera UV'],['torus','Toro']]
      .map(([key,label]) => [key,{ label, icon: `icon-${key}` }])) },
  { type: 'road', category: 'Herramientas de modelado', label: 'Carretera', icon: 'road' },
  { type: 'group', category: 'Escena', label: 'Grupo', icon: 'group', base: 'Node' },
  { type: 'model', category: 'Modelos', label: 'Modelo', icon: 'model' },
]
const catalog = shiftANodeCatalog(defs)
const code = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const tools = catalog.filter((it) => it.type === 'mesh')

function toTree() {
  const cats = new Map()
  for (const item of catalog) {
    if (!cats.has(item.category)) cats.set(item.category, [])
    cats.get(item.category).push({ label: item.label, icon: item.icon, run: () => item })
  }
  return addMenuTree([...cats].map(([cat, items]) => ({ label: cat, children: items })))
}

test('MENU-CORR-01: se eliminan las 5 mallas redundantes por tipo y clave, no por nombre', () => {
  assert.deepEqual(tools.map((it) => it.kind), ['vertex','grid','circle','torus'])
  assert.ok(!tools.some((it) => ['cube','plane','cylinder','cone','sphere'].includes(it.kind)))
})
test('MENU-CORR-02: se mantienen las 7 primitivas del catálogo real', () => {
  assert.deepEqual(catalog.filter((it) => it.type === 'primitive').map((it) => it.kind),
    ['box','plane','cylinder','cone','sphere','ramp','stairs'])
})
test('MENU-CORR-03: el cubo de malla (cube) coincide con la primitiva (box)', () => {
  assert.equal(catalog.filter((it) => it.label === 'Cubo').length, 1)
  assert.equal(catalog.find((it) => it.label === 'Cubo').type, 'primitive')
})
test('MENU-CORR-04: las mallas especiales conservan su identidad y sus iconos del registro', () => {
  assert.ok(tools.every((it) => it.category === 'Herramientas de modelado' && it.icon === `icon-${it.kind}`))
})
test('MENU-CORR-05: no hay grupo ni resultados Malla editable en Shift+A', () => {
  assert.equal(catalog.some((it) => it.category === 'Malla'), false)
  assert.equal(toTree().some((it) => it.label === 'Malla editable'), false)
  assert.deepEqual(searchAddNodes(toTree(), 'malla editable'), [])
})
test('MENU-CORR-06: búsqueda encuentra exactamente cada herramienta especializada', () => {
  for (const label of ['Vértice','Rejilla','Círculo','Toro']) {
    const found = searchAddNodes(toTree(), label)
    assert.equal(found.length, 1)
    assert.equal(found[0].group, 'Herramientas de modelado')
  }
})
test('MENU-CORR-07: búsqueda de cubo, plano y esfera no presenta duplicados', () => {
  for (const label of ['Cubo','Plano','Esfera']) {
    const matches = searchAddNodes(toTree(), label)
    assert.equal(matches.length, 1)
    assert.equal(matches[0].group, 'Primitivas')
  }
})
test('MENU-CORR-08: se conservan otros nodos y la creación de grupo vacío', () => {
  assert.ok(catalog.some((it) => it.type === 'road' && it.kind === 'road'))
  assert.ok(catalog.some((it) => it.type === 'group' && it.label === 'Grupo vacío'))
})
test('MENU-CORR-09: los modelos importados siguen fuera del registro de nodos del menú', () => {
  assert.equal(catalog.some((it) => it.type === 'model'), false)
  assert.match(code('src/core/commands.js'), /store\.project\?\.models \|\| \[\]/)
})
test('MENU-CORR-10: nuevos tipos de malla no duplicados aparecen sin otra lista de registros', () => {
  const added = structuredClone(defs)
  added[1].kinds.ribbon = { label: 'Cinta', icon: 'ribbon' }
  assert.ok(shiftANodeCatalog(added).some((it) => it.type === 'mesh' && it.kind === 'ribbon'))
})
test('MENU-CORR-11: variantes con igual nombre y claves diferentes no se eliminan accidentalmente', () => {
  const added = structuredClone(defs)
  added[1].kinds.special = { label: 'Cubo', icon: 'special' }
  assert.ok(shiftANodeCatalog(added).some((it) => it.type === 'mesh' && it.kind === 'special'))
})
test('MENU-CORR-12: Shift+A crea con spec real, padre y posición existentes', () => {
  const src = code('src/core/commands.js')
  assert.match(src, /shiftANodeCatalog\(allDefs\(\)\)/)
  assert.match(src, /store\.editor\.addAt\(spot, spec, \{ parentId, label \}\)/)
  assert.match(src, /addShapeToBody\(spec\.kind\)/)
  assert.match(src, /const menu = \{ items: shiftAItems\(spot\), spot, at:/)
})
test('MENU-CORR-13: Edit Mesh sigue utilizando el catálogo completo original', () => {
  const src = code('src/core/editor/meshedit.js')
  assert.match(src, /Object\.entries\(MESH_KINDS\)/)
  assert.match(src, /this\.edit\?\.addPrimitive\(k\)/)
  assert.match(code('src/core/commands.js'), /if \(store\.edit\.on\) return ed\.openEditAddMenu\(pos\)/)
})
test('MENU-CORR-14: tipo interno mesh, generación y conversión existentes intactos', () => {
  const node = code('src/engine/runtime/nodes/mesh.js')
  assert.match(node, /type: 'mesh'/)
  assert.match(node, /kinds: MESH_KINDS/)
  assert.match(code('src/core/editor/placement.js'), /spec\.kind === 'vertex'/)
})
test('MENU-CORR-15: búsqueda y navegación comparten el modelo de menú original', () => {
  assert.match(code('src/components/AddModal.vue'), /ArrowRight/)
  assert.match(code('src/components/AddModal.vue'), /ArrowLeft/)
  assert.match(code('src/components/AddModal.vue'), /searchAddNodes\(tree\.value, search\.value\)/)
})
