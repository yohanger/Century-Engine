// LF-NODE-EDITOR-S06-G001 — QA de operaciones del editor (sin Electron).
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'

const source = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const tree = source('src/components/SceneTree.vue')
const inspector = source('src/components/Inspector.vue')
const dock = source('src/components/InspectorDock.vue')
const style = source('src/styles.css')

function runMove(ids, failAt = 0) {
  const objects = [{ id: 'a', parentId: null, position: [1, 2, 3], rotation: [0, 0, 0], scale: [1, 1, 1] },
    { id: 'b', parentId: null, position: [4, 5, 6], rotation: [0, 0, 0], scale: [1, 1, 1] },
    { id: 'c', parentId: null, position: [7, 8, 9], rotation: [0, 0, 0], scale: [1, 1, 1] }]
  const commits = [], synced = [], calls = []
  const context = {
    dragIds: [...ids],
    store: { project: { objects }, editor: { syncObject: (id) => synced.push(id) } },
    getObject: (id) => objects.find((o) => o.id === id),
    descendantsOf: () => [],
    reparent(id, parentId, beforeId, opts) {
      calls.push({ id, parentId, beforeId, opts })
      if (calls.length === failAt) return false
      const node = objects.find((o) => o.id === id)
      node.parentId = parentId
      node.position = [node.position[0] + 10, node.position[1], node.position[2]]
      objects.splice(objects.indexOf(node), 1)
      objects.push(node)
      return true
    },
    commit: (label) => commits.push(label),
    endDragging() { context.dragIds.length = 0 },
  }
  const start = tree.indexOf('function moveDragged(')
  const end = tree.indexOf('function onDrop(', start)
  assert.ok(start >= 0 && end > start)
  const fn = vm.runInNewContext(tree.slice(start, end) + '\nmoveDragged', context)
  fn(() => ['c', null], 'Mover nodo')
  return { objects, commits, synced, calls, context }
}

test('NE6-01 · dos nodos se mueven con un único commit', () => {
  const x = runMove(['a', 'b'])
  assert.equal(x.commits.length, 1)
  assert.equal(x.commits[0], 'Mover nodos')
  assert.deepEqual(x.objects.map((o) => o.id), ['c', 'a', 'b'])
  assert.equal(x.objects.find((o) => o.id === 'a').parentId, 'c')
})
test('NE6-02 · error al mover el segundo nodo restaura padres, orden y Transform', () => {
  const x = runMove(['a', 'b'], 2)
  assert.deepEqual(x.objects.map((o) => o.id), ['a', 'b', 'c'])
  assert.deepEqual(x.objects.map((o) => o.parentId), [null, null, null])
  assert.deepEqual([...x.objects[0].position], [1, 2, 3])
  assert.equal(x.commits.length, 0)
  assert.ok(x.synced.includes('a'))
})
test('NE6-03 · rechazo del primer nodo no registra Undo', () => {
  const x = runMove(['a', 'b'], 1)
  assert.equal(x.commits.length, 0)
  assert.deepEqual(x.objects.map((o) => o.id), ['a', 'b', 'c'])
})
test('NE6-04 · reparent utiliza la función validada existente', () => {
  const x = runMove(['a'])
  assert.equal(x.calls.length, 1)
  assert.equal(x.calls[0].opts.commit, false)
  assert.equal(x.commits[0], 'Mover nodo')
})
test('NE6-05 · Scene Tree mantiene selección, virtualización y sincronización del viewport', () => {
  for (const token of ['const shown = computed', 'const padTop = computed', 'watch(() => store.selectedId', 'selectObject(null, { range:', 'revealRow(id)']) assert.ok(tree.includes(token), token)
})
test('NE6-06 · la selección externa despeja un filtro que ocultaría el nodo', () => {
  assert.match(tree, /filter\.value && !rows\.value\.some\(\(row\) => row\.o\.id === id\)/)
})
test('NE6-07 · búsqueda contextual y teclado: Escape, flechas, Home, End, F2', () => {
  for (const k of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'F2', 'Escape', 'searchKey']) assert.ok(tree.includes(k), k)
  assert.match(tree, /aria-label="Buscar nodos en la escena"/)
})
test('NE6-08 · marcado de árbol accesible y estado de selección', () => {
  for (const token of ['role="tree"', 'role="treeitem"', ':aria-selected=', ':aria-level=', ':aria-expanded=']) assert.ok(tree.includes(token), token)
})
test('NE6-09 · script del nodo tiene indicador y abre el recurso existente', () => {
  assert.match(tree, /v-if="authoredNodeScriptIds\(row\.o\)\.length" class="script-indicator"/)
  assert.match(tree, /openInVSCode\(ids\[0\]\)/)
  assert.match(tree, /Recurso inexistente/)
})
test('NE6-10 · no se introduce otro SceneGraph ni un segundo Inspector', () => {
  assert.match(tree, /core\/store\.js/)
  assert.match(dock, /<Inspector v-else/)
  assert.doesNotMatch(tree + inspector + dock, /EntityWorld|Add Component/)
})
test('NE6-11 · Inspector identifica el tipo registrado y el nombre del nodo', () => {
  assert.match(inspector, /data-testid="node-type-label"/)
  assert.match(inspector, /\{\{ title \}\}/)
  assert.match(inspector, /:data-node-type="obj\?\.type/)
})
test('NE6-12 · Node puro no ofrece Transform; Node3D sí', () => {
  assert.match(inspector, /getDef\(obj\.type\)\?\.base !== 'Node'/)
  assert.match(inspector, /<Vec3Field :model-value="obj\.position"/)
})
test('NE6-13 · física y formas mantienen inspectores especializados', () => {
  for (const token of ['physical-body-inspector', 'character-body-inspector', 'area3d-inspector', 'collision-shape-inspector']) assert.ok(inspector.includes(token), token)
  for (const type of ['BoxShape3D','SphereShape3D','CapsuleShape3D']) assert.ok(inspector.includes(type))
})
test('NE6-14 · el script sigue siendo un recurso opcional del nodo', () => {
  for (const token of ['nodeScriptOptions', 'Este nodo todavía no tiene scripts', 'chooseNodeScript', 'openInVSCode(id)']) assert.ok(inspector.includes(token), token)
})
test('NE6-15 · pliegues del Inspector por tipo y accionables por teclado', () => {
  assert.match(dock, /header\.closest\('\.insp'\)\?\.dataset\.nodeType/)
  assert.match(dock, /aria-expanded/)
  assert.match(dock, /function onFoldKey/)
  assert.match(dock, /@keydown="onFoldKey"/)
})
test('NE6-16 · docks estrechos apilan campos sin desbordar controles', () => {
  assert.match(style, /@container insp \(max-width: 340px\)/)
  assert.match(style, /minmax\(0, 1fr\)/)
  assert.match(dock, /overflow-x: hidden/)
})
test('NE6-17 · el arrastre y el Inspector continúan utilizando Undo existente', () => {
  assert.match(tree, /commit\(count > 1 \? 'Mover nodos'/)
  assert.match(inspector, /updateObject\(obj\.value\.id, patch, \{ commit \}\)/)
})
test('NE6-18 · los recursos especializados no son sustituidos por el nuevo Inspector', () => {
  for (const k of ['ProfileEditor','MaterialResourceEditor','GameManagerEditor','MeshPanel','TerrainPanel','PaintPanel']) assert.ok(dock.includes(k))
})
