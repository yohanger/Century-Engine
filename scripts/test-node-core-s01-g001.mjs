// LF-NODE-CORE-S01-G001 — jerarquía y ciclo de vida sin un segundo SceneGraph.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { validateNodeTree, validateNodeParent, nodeAncestors } from '../src/engine/runtime/nodes/hierarchy.js'
import { NodeLifecycle } from '../src/engine/runtime/scene/node-lifecycle.js'
import { registerNode, getDef } from '../src/engine/runtime/nodes/registry.js'

const n = (id, parentId = null, type = 'lfTestNode') => ({ id, parentId, name: id, type })
const fixtures = [n('child', 'parent'), n('parent'), n('other')]
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')

test('NC-01 · acepta raíces múltiples e hijos fuera de orden', () => {
  assert.deepEqual([...validateNodeTree(fixtures).keys()], ['child', 'parent', 'other'])
})
test('NC-02 · rechaza ID vacío', () => assert.throws(() => validateNodeTree([n('')]), /ID/))
test('NC-03 · rechaza IDs duplicados', () => assert.throws(() => validateNodeTree([n('a'), n('a')]), /duplicado/))
test('NC-04 · rechaza padres inexistentes', () => assert.throws(() => validateNodeTree([n('a', 'lost')]), /Padre inexistente/))
test('NC-05 · rechaza ciclos de dos nodos', () => assert.throws(() => validateNodeTree([n('a', 'b'), n('b', 'a')]), /Ciclo/))
test('NC-06 · rechaza ciclos largos', () => assert.throws(() => validateNodeTree([n('a', 'b'), n('b', 'c'), n('c', 'a')]), /Ciclo/))
test('NC-07 · rechaza auto-parent', () => assert.throws(() => validateNodeParent(fixtures, 'parent', 'parent'), /propio padre/))
test('NC-08 · rechaza reparent a descendiente', () => assert.throws(() => validateNodeParent(fixtures, 'parent', 'child'), /descendiente/))
test('NC-09 · rechaza padre externo', () => assert.throws(() => validateNodeParent(fixtures, 'other', 'lost'), /Padre inexistente/))
test('NC-10 · rechaza nodo movido desconocido', () => assert.throws(() => validateNodeParent(fixtures, 'lost', null), /Nodo inexistente/))
test('NC-11 · acepta mover a raíz y a hermano', () => {
  assert.equal(validateNodeParent(fixtures, 'child', null), true)
  assert.equal(validateNodeParent(fixtures, 'child', 'other'), true)
  assert.equal(fixtures[0].parentId, 'parent', 'validar no modifica los objetos')
})

const logs = []
registerNode({ type: 'lfTestNode', label: 'Test', create: () => ({}), build: () => null, update: () => {},
  onEnterTree: (obj) => logs.push(`enter:${obj.id}`),
  onReady: (obj) => logs.push(`ready:${obj.id}`),
  onProcess: (obj, dt) => logs.push(`frame:${obj.id}:${dt}`),
  onPhysicsProcess: (obj, dt) => logs.push(`physics:${obj.id}:${dt}`),
  onExitTree: (obj) => logs.push(`exit:${obj.id}`),
})
const fixture = (objects = [n('a'), n('c','b'), n('b','a')]) => {
  logs.length = 0
  const scene = { host: { project: { objects } }, nodes: new Map(objects.map(o => [o.id, {}])) }
  const life = new NodeLifecycle(scene)
  return { scene, life }
}
test('NC-12 · Edit Mode no dispara callbacks de nodo', () => {
  const { life } = fixture(); life.sync(); life.process(1); life.physicsProcess(1); assert.deepEqual(logs, [])
})
test('NC-13 · enter padre→hijo y ready hijo→padre, sin depender del orden del array', () => {
  const { life } = fixture(); life.start()
  assert.deepEqual(logs, ['enter:a','enter:b','enter:c','ready:c','ready:b','ready:a'])
})
test('NC-14 · start/sync repetidos no duplican ready', () => {
  const { life } = fixture(); life.start(); life.start(); life.sync()
  assert.equal(logs.filter(s => s.startsWith('ready:')).length, 3)
})
test('NC-15 · process y physicsProcess separados', () => {
  const { life } = fixture([n('a')]); life.start(); logs.length=0
  life.process(0.4); life.physicsProcess(0.02)
  assert.deepEqual(logs, ['frame:a:0.4','physics:a:0.02'])
})
test('NC-16 · pasos inválidos no ejecutan scripts', () => {
  const { life } = fixture([n('a')]); life.start(); logs.length=0
  life.process(NaN); life.physicsProcess(-1); assert.deepEqual(logs, [])
})
test('NC-17 · stop libera hijos antes que el padre', () => {
  const { life } = fixture(); life.start(); logs.length=0
  life.stop(); assert.deepEqual(logs, ['exit:c','exit:b','exit:a'])
})
test('NC-18 · stop idempotente', () => {
  const { life } = fixture([n('a')]); life.start(); life.stop(); logs.length=0
  life.stop(); assert.deepEqual(logs, [])
})
test('NC-19 · la inserción activa prepara un nodo nuevo solo una vez', () => {
  const { life, scene } = fixture([n('a')]); life.start(); logs.length=0
  scene.host.project.objects.push(n('b','a')); scene.nodes.set('b', {})
  life.sync(); life.sync(); assert.deepEqual(logs, ['enter:b','ready:b'])
})
test('NC-20 · eliminar el padre desmonta descendientes al revés', () => {
  const { life, scene } = fixture(); life.start(); logs.length=0
  scene.host.project.objects = []; scene.nodes.clear(); life.sync()
  assert.deepEqual(logs, ['exit:c','exit:b','exit:a'])
})
test('NC-21 · reparent sale/entra con descendientes sin callbacks duplicados', () => {
  const { life, scene } = fixture(); life.start(); logs.length=0
  scene.host.project.objects.find(o=>o.id==='b').parentId = null
  life.sync()
  assert.deepEqual(logs, ['exit:c','exit:b','enter:b','enter:c'])
})
test('NC-22 · no se envían callbacks a representaciones aún no montadas', () => {
  const { life, scene } = fixture(); scene.nodes.delete('c'); life.start()
  assert.equal(logs.includes('enter:c'), false)
})
test('NC-23 · cambio de transform no implica nuevo ready', () => {
  const { life, scene } = fixture([n('a')]); life.start(); logs.length=0
  scene.host.project.objects[0].position=[2,0,0];life.sync();assert.deepEqual(logs, [])
})
test('NC-24 · registry declara Node/Node3D sin duplicar tipos', () => {
  const reg = read('src/engine/runtime/nodes/base.js')
  assert.match(reg, /type: 'node', base: 'Node'/)
  assert.match(reg, /type: 'node3d', base: 'Node3D'/)
  assert.match(read('src/engine/runtime/nodes/index.js'), /import '\.\/base\.js'/)
})
test('NC-25 · la fábrica asigna Transform solo a nodos espaciales', () => {
  const src=read('src/engine/runtime/nodes/index.js')
  const code=src.slice(src.indexOf('export function makeObject('),src.indexOf('export const kindLabel')).replace('export function makeObject','function makeObject')
  const make=vm.runInNewContext(code+'\nmakeObject', {getDef: (type) => ({base: type==='node'?'Node':'Node3D',create:()=>({})})})
  const plain=make('node'),spatial=make('node3d'),legacy=make('primitive')
  assert.equal('position' in plain,false);assert.deepEqual([...spatial.position],[0,0,0]);assert.deepEqual([...spatial.rotation],[0,0,0])
  assert.equal('collision' in spatial,false);assert.equal('collision' in legacy,false)
})
test('NC-26 · SceneGraph conecta un ciclo de vida; no crea mundo ECS', () => {
  const scene=read('src/engine/runtime/scene-graph.js')
  assert.match(scene,/this\.nodeLifecycle = new NodeLifecycle\(this\)/)
  assert.match(scene,/this\.nodeLifecycle\.stop\(\)/)
  assert.match(scene,/this\.nodeLifecycle\.sync\(\)/)
  assert.doesNotMatch(scene,/EntityWorld|ECSWorld/)
})
test('NC-27 · Edit Mode no arranca el ciclo automáticamente', () => {
  const scene=read('src/engine/runtime/scene-graph.js')
  assert.match(scene, /if \(resumeLifecycle\) this\.nodeLifecycle\.start\(\)/)
  assert.doesNotMatch(scene.split('constructor(container, host)')[1].split('// =================== ganchos')[0],/nodeLifecycle\.start\(/)
})
test('NC-28 · protección: sin modificar el Event Order Flow', () => {
  assert.match(read('src/engine/runtime/events/play-controls.js'), /_simStep\(/)
})
test('NC-29 · la jerarquía se valida antes de montarse', () => {
  const scene=read('src/engine/runtime/scene-graph.js')
  assert.match(scene,/validateNodeTree\(this\.host\.project\.objects\)/)
})
test('NC-30 · el reparent permite preservar local o mundial', () => {
  const tree=read('src/core/state/tree.js')
  assert.match(tree, /preserveWorld = true/)
  assert.match(tree, /validateNodeParent\(/)
})
test('NC-31 · no se alteran los módulos de eventos por este Gate', () => {
  const scene=read('src/engine/runtime/scene/node-lifecycle.js')
  assert.doesNotMatch(scene, /events\/|play-controls|PlayMode/)
})

test('NC-32 · cambiar el tipo de nodo desmonta el tipo anterior y prepara el nuevo', () => {
  registerNode({ type:'lfAnotherNode', label:'Second', create:()=>({}), build:()=>null, update:()=>{},
    onEnterTree: (o)=>logs.push(`enterNew:${o.id}`), onReady: (o)=>logs.push(`readyNew:${o.id}`) })
  const { life, scene } = fixture([n('a')]); life.start(); logs.length=0
  scene.host.project.objects[0].type = 'lfAnotherNode'; life.sync()
  assert.deepEqual(logs, ['exit:a','enterNew:a','readyNew:a'])
})
test('NC-33 · Node no expone Vector3 en Inspector', () => {
  assert.match(read('src/components/Inspector.vue'), /v-if="getDef\(obj.type\)\?\.base !== 'Node'"/)
})
test('NC-34 · crear Node no requiere posicionarlo como malla', () => {
  assert.match(read('src/core/commands.js'), /getDef\(spec.type\)\?\.base === 'Node'/)
  assert.match(read('src/core/commands.js'), /\? addObject\(spec, \{ parentId, label \}\)/)
})
test('NC-35 · editar un Node sin escala no intenta copiar un array ausente', () => {
  assert.match(read('src/core/state/objects.js'), /obj.scale \? \[\.\.\.obj.scale\] : null/)
})

test('NC-36 · ancestros: solo se recorre la cadena solicitada', () => {
  const byId = new Map(fixtures.map(o => [o.id, o]))
  assert.deepEqual(nodeAncestors(id => byId.get(id), 'child').map(o => o.id), ['child','parent'])
})
test('NC-37 · ancestros rechaza ciclos sin recorrer toda la escena', () => {
  const data = [n('a','b'),n('b','a')],byId = new Map(data.map(o => [o.id,o]))
  assert.throws(()=>nodeAncestors(id => byId.get(id),'a'),/Ciclo/)
})
test('NC-38 · el render usa la cadena de padres del mismo contrato', () => {
  const matrix = read('src/engine/runtime/scene/matrix.js')
  assert.match(matrix,/nodeAncestors\(getObject, id\)\.reverse\(\)/)
})
test('NC-39 · Node3D propaga escala; las mallas existentes conservan tamaño propio', () => {
  assert.match(read('src/engine/runtime/nodes/base.js'), /root\.scale\.set\(\.\.\.obj\.scale\)/)
  assert.match(read('src/engine/runtime/scene/matrix.js'), /o.type === 'node3d'/)
  assert.match(read('src/core/state/tree.js'), /obj.type === 'node3d'/)
})

test('NC-40 · Node es contenedor válido para los nuevos hijos', () => {
  assert.match(read('src/core/state/objects.js'), /\['group', 'node', 'node3d'\]\.includes\(sel.type\)/)
})
test('NC-41 · portapapeles y editor no introducen Transform a Node', () => {
  const objects=read('src/core/state/objects.js')
  assert.match(objects,/obj.type === 'node' && \['position', 'rotation', 'scale'\]/)
  assert.match(objects,/if \(copy.type !== 'node'\) setLocalFromWorld\(/)
})

test('NC-42 · Node sin Transform no se desplaza silenciosamente al reparentar', () => {
  assert.match(read('src/core/state/tree.js'), /preserveWorld && obj.type === 'node'/)
  assert.match(read('src/core/state/tree.js'), /Node no puede conservar su transformación mundial/)
})
test('NC-43 · agrupar un Node no modifica implícitamente sus descendientes', () => {
  assert.match(read('src/core/state/tree-ops.js'), /roots.some\(\(o\) => o.type === 'node'\)/)
})
