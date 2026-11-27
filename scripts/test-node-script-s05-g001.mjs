// LF-NODE-SCRIPT-S05-G001 — scripts independientes por nodo, ciclo de vida y conexión al runtime.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { NodeLifecycle } from '../src/engine/runtime/scene/node-lifecycle.js'
import { NodeScriptRuntime } from '../src/engine/runtime/scene/node-scripts.js'
import { registerNode } from '../src/engine/runtime/nodes/registry.js'

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
registerNode({ type: 's05Node', label: 'Test', create: () => ({}), build: () => ({}), update: () => {} })
const node = (id, parentId = null, scriptId = 's') => ({ id, name: id, type: 's05Node', parentId, scriptId })
function setup(objects, scripts) {
  const events = [], errors = []
  const project = { objects, scripts }
  const scene = { host: { project }, nodes: new Map(objects.map((o) => [o.id, {}])) }
  const play = { project, _nodeEnabled:()=>true, game: { api: { record: (value) => events.push(value) }, report: (err, where) => errors.push([where, String(err.message)]) }, _nodeHandle(id) {
    return { id, name: project.objects.find((o) => o.id === id)?.name || id, position: [0,0,0] }
  } }
  const life = new NodeLifecycle(scene)
  life.scripts = new NodeScriptRuntime(play)
  return { life, scene, play, events, errors }
}
const script = (code, id = 's') => ({ id, name: 'node.js', execution: 'node', code })

const CALLBACK_SCRIPT = `let count = 0;
function _enter_tree() { game.record(node.id + ':enter') }
function _ready() { game.record(node.id + ':ready') }
function _process(dt) { count++; game.record(node.id + ':frame:' + count + ':' + dt) }
function _physics_process(dt) { game.record(node.id + ':fixed:' + dt) }
function _exit_tree() { game.record(node.id + ':exit') }`

test('NS-01 · editar nunca ejecuta scripts', () => {
  const x = setup([node('a')], [script(CALLBACK_SCRIPT)])
  x.life.sync(); x.life.process(0.1); x.life.physicsProcess(0.1)
  assert.deepEqual(x.events, [])
})
test('NS-02 · enter padre→hijo, ready hijo→padre', () => {
  const x = setup([node('c','p'), node('p')], [script(CALLBACK_SCRIPT)]); x.life.start()
  assert.deepEqual(x.events, ['p:enter','c:enter','c:ready','p:ready'])
})
test('NS-03 · el mismo recurso tiene estado independiente por nodo', () => {
  const x = setup([node('a'),node('b')], [script(CALLBACK_SCRIPT)]); x.life.start(); x.events.length = 0
  x.life.process(0.2); x.life.process(0.1)
  assert.deepEqual(x.events, ['a:frame:1:0.2','b:frame:1:0.2','a:frame:2:0.1','b:frame:2:0.1'])
})
test('NS-04 · _physics_process solo se llama en pasos físicos', () => {
  const x = setup([node('a')], [script(CALLBACK_SCRIPT)]); x.life.start(); x.events.length = 0
  x.life.process(0.5); x.life.physicsProcess(0.02); x.life.physicsProcess(0.02)
  assert.deepEqual(x.events, ['a:frame:1:0.5','a:fixed:0.02','a:fixed:0.02'])
})
test('NS-05 · stop sale de hijos a padres y libera todas las instancias', () => {
  const x = setup([node('c','p'),node('p')], [script(CALLBACK_SCRIPT)]); x.life.start(); x.events.length = 0
  x.life.stop(); x.life.stop()
  assert.deepEqual(x.events, ['c:exit','p:exit']); assert.equal(x.life.scripts.instances.size,0)
})
test('NS-06 · scripts globales no se interpretan como scripts de nodo', () => {
  const x = setup([node('a')], [{ ...script(CALLBACK_SCRIPT), execution:'global' }]); x.life.start()
  assert.equal(x.life.scripts.instances.size,0); assert.equal(x.errors.length,1)
})
test('NS-07 · script inexistente no detiene el ciclo de vida', () => {
  const x = setup([node('a')], []); x.life.start(); x.life.process(0.1)
  assert.equal(x.errors.length,1); assert.equal(x.life.active,true)
})
test('NS-08 · sin script no crea una instancia', () => {
  const x = setup([node('a',null,'')], []); x.life.start()
  assert.equal(x.errors.length,0); assert.equal(x.life.scripts.instances.size,0)
})
test('NS-09 · un error síncrono no detiene otros nodos', () => {
  const x = setup([node('bad',null,'a'),node('good',null,'b')], [script('function _ready(){ throw new Error("fallo") }','a'),script('function _ready(){game.record(node.id)}','b')]); x.life.start()
  assert.deepEqual(x.events, ['good']); assert.equal(x.errors.length,1)
})
test('NS-10 · error de compilación queda aislado', () => {
  const x = setup([node('bad',null,'a'),node('good',null,'b')], [script('() => {','a'),script('function _ready(){game.record("ok")}', 'b')]); x.life.start()
  assert.deepEqual(x.events,['ok']); assert.equal(x.errors.length,1)
})
test('NS-11 · un script obtiene padre e hijos sin construir árbol paralelo', () => {
  const x = setup([node('parent'),node('child','parent')], [script('function _ready(){game.record(node.id + ":" + (node.parent?.id||"root") + ":" + node.children.length)}')]); x.life.start()
  assert.deepEqual(x.events,['child:parent:0','parent:root:1'])
})
test('NS-12 · get_node resuelve hijos y rutas relativas', () => {
  const x = setup([node('parent'),node('child','parent')], [script('function _ready(){game.record(node.id + ":" + (node.get_node("child")?.id||"-") + ":" + (node.get_node("..")?.id||"-"))}')]); x.life.start()
  assert.deepEqual(x.events,['child:-:parent','parent:child:-'])
})
test('NS-13 · eliminar nodo desmonta su script y conserva el de los supervivientes', () => {
  const a = node('a'), b = node('b')
  const x = setup([a, b], [script(CALLBACK_SCRIPT)]); x.life.start(); x.events.length = 0
  const bInstance = x.life.scripts.instances.get('b')
  // Se elimina únicamente a: b conserva el mismo registro lógico, no otro objeto con su ID.
  x.scene.host.project.objects = [b]; x.scene.nodes.delete('a'); x.life.sync()
  assert.deepEqual(x.events, ['a:exit'])
  assert.equal(x.life.scripts.instances.size, 1)
  assert.strictEqual(x.life.scripts.instances.get('b'), bInstance)
  x.life.process(0.2)
  assert.deepEqual(x.events, ['a:exit', 'b:frame:1:0.2'])
})
test('NS-25 · sustituir deliberadamente un registro con igual ID renueva su script', () => {
  const b = node('b')
  const x = setup([b], [script(CALLBACK_SCRIPT)]); x.life.start(); x.events.length = 0
  const oldInstance = x.life.scripts.instances.get('b')
  const replacement = node('b')
  assert.notStrictEqual(replacement, b)
  x.scene.host.project.objects = [replacement]; x.life.sync()
  assert.deepEqual(x.events, ['b:exit', 'b:enter', 'b:ready'])
  assert.equal(x.life.scripts.instances.size, 1)
  assert.notStrictEqual(x.life.scripts.instances.get('b'), oldInstance)
  x.events.length = 0
  x.life.process(0.2)
  assert.deepEqual(x.events, ['b:frame:1:0.2'])
})
test('NS-14 · volver a arrancar crea una instancia nueva', () => {
  const x = setup([node('a')], [script(CALLBACK_SCRIPT)]); x.life.start(); x.life.process(1); x.life.stop(); x.life.start(); x.events.length = 0; x.life.process(2)
  assert.deepEqual(x.events,['a:frame:1:2'])
})
test('NS-15 · cambiar scriptId libera el anterior y prepara el nuevo', () => {
  const x = setup([node('a')], [script(CALLBACK_SCRIPT,'s'), script('function _ready(){game.record("new")}', 'other')]); x.life.start(); x.events.length = 0
  x.scene.host.project.objects[0].scriptId = 'other'; x.life.sync()
  assert.deepEqual(x.events,['a:exit','new'])
})
test('NS-16 · callbacks no definidos no fallan', () => {
  const x = setup([node('a')], [script('let v = 0; v++')]); x.life.start(); x.life.process(0.1); x.life.physicsProcess(0.01); x.life.stop()
  assert.equal(x.errors.length,0)
})
test('NS-17 · scripts por nodo no admiten top-level await y reportan el error', () => {
  const x = setup([node('a')], [script('await Promise.resolve()')]); x.life.start(); assert.equal(x.errors.length,1)
})
test('NS-18 · G002 guarda scriptIds en el objeto y mantiene el recurso por id', () => {
  const src=read('src/engine/runtime/nodes/index.js'), proj=read('src/core/project.js')
  assert.match(src,/scriptIds: \[\]/); assert.match(proj,/scripts: \[\]/)
})
test('NS-19 · PlayMode separa scripts globales y arranca el ciclo de nodos', () => {
  const src=read('src/engine/runtime/events/play.js')
  assert.match(src,/s\.execution !== 'node'/); assert.match(src,/nodeLifecycle\.start\(\)/); assert.match(src,/nodeLifecycle\.stop\(\)/)
})
test('NS-20 · el paso de física está dentro del mismo bucle fijo Jolt', () => {
  const src=read('src/engine/runtime/events/play-controls.js')
  assert.ok(src.indexOf('nodeLifecycle?.physicsProcess(fdt)') > src.indexOf('this.game.fixedUpdate(fdt)'))
  assert.ok(src.indexOf('nodeLifecycle?.physicsProcess(fdt)') < src.indexOf('this.phys?.step(fdt)'))
})
test('NS-21 · el Inspector permite asociar, crear, editar y retirar el script', () => {
  const src=read('src/components/Inspector.vue')
  for (const token of ['Este nodo todavía no tiene scripts','nodeScriptOptions','chooseNodeScript','openInVSCode(id)']) assert.ok(src.includes(token))
})
test('NS-22 · el editor de scripts distingue global de nodo', () => {
  const src=read('src/components/ScriptEditor.vue')
  assert.match(src,/setScriptExecution/); assert.match(src,/<option value="node">Nodo<\/option>/)
})
test('NS-23 · exportación continúa usando PlayMode', () => assert.match(read('src/engine/runtime/package/game.js'),/new PlayMode\(graph\)/))
test('NS-24 · las promesas rechazadas se reportan sin romper el loop', async () => {
  const x = setup([node('a')], [script('async function _ready() { throw new Error("async") }')]); x.life.start()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(x.errors.length,1)
})
