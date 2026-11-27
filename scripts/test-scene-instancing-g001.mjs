// LF-SCENE-INSTANCING-G001-INTEGRAL — pruebas puras del resolver real.
// El motor de resolución se ejecuta desde su fuente real con dependencias inyectadas.
// Node no necesita instalar Electron/Three para verificar la autoría y el grafo.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const source = await readFile(new URL('../src/engine/runtime/scene/instances.js', import.meta.url), 'utf8')
const moduleContext = vm.createContext({ Map, Set, Error, JSON, String, encodeURIComponent })
const service = new vm.SourceTextModule(source, { context: moduleContext, identifier: 'scene-instances' })
const imported = new Map([
  ['../nodes/index.js', `export function makeObject(type, kind, props) {
    return { type, kind, id: '', parentId: null, scale: [1, 1, 1], position: [0, 0, 0], rotation: [0, 0, 0], ...props }
  }`],
  ['../nodes/hierarchy.js', `export function validateNodeTree(objects) {
    const ids = new Map();
    for (const node of objects) {
      if (ids.has(node.id)) throw Error('ID repetido');
      ids.set(node.id, node);
    }
    for (const node of objects) {
      if (node.parentId && !ids.has(node.parentId)) throw Error('Padre ausente');
      const visited = new Set(); let current = node;
      while (current) {
        if (visited.has(current.id)) throw Error('Ciclo de nodos');
        visited.add(current.id);
        current = current.parentId ? ids.get(current.parentId) : null;
      }
    }
  }`],
])
await service.link(async specifier => {
  assert.ok(imported.has(specifier), `Dependencia inesperada: ${specifier}`)
  const m = new vm.SourceTextModule(imported.get(specifier), { context: moduleContext })
  return m
})
await service.evaluate()
const { authoredSceneTree, expandSceneInstances, makeSceneInstance, readSceneSources, includeInstancedSceneSources } = service.namespace
const node = (id, parentId = null, type = 'node3d', props = {}) =>
  ({ id, parentId, type, name: id, scale: [1, 1, 1], position: [0, 0, 0], props })
const ref = (id, src, parentId = null) => node(id, parentId, 'sceneInstance', { sceneId: src })
const record = objects => ({ objects, signalConnections: [] })
const plain = value => JSON.parse(JSON.stringify(value))

function records() {
  return new Map([
    ['Casa', { objects: [node('Pared'), node('Puerta', 'Pared'), node('Camara', null, 'camera', { main: true }), node('terreno', null, 'terrain')],
      signalConnections: [{ id: 's1', emitterId: 'Pared', receiverId: 'Puerta', signal: 'open', method: 'abrir' }] }],
    ['Mobiliario', record([node('Silla'), node('Mesa')])],
  ])
}

test('G001 resolver · múltiples instancias, transformaciones e identidades independientes', () => {
  const r = record([ref('Casa01', 'Casa'), ref('Casa02', 'Casa')]);
  r.objects[1].position = [9, 0, 0]
  const out = expandSceneInstances(r, 'Mundo', records())
  assert.equal(out.objects.length, 8) // 2 roots + 3 derivatives each
  assert.equal(out.objects.find(x => x.id === 'Casa01::Puerta').parentId, 'Casa01::Pared')
  assert.equal(out.objects.find(x => x.id === 'Casa02::Puerta').parentId, 'Casa02::Pared')
  assert.equal(out.objects.find(x => x.id === 'Casa02').position[0], 9)
  assert.notEqual(out.objects.find(x => x.id === 'Casa01::Pared').id, out.objects.find(x => x.id === 'Casa02::Pared').id)
  assert.equal(out.objects.find(x => x.id === 'Casa01::Camara').props.main, false)
  assert.equal(out.objects.some(x => x.type === 'terrain'), false)
  assert.equal(out.signalConnections.length, 2)
  assert.equal(out.signalConnections[0].emitterId, 'Casa01::Pared')
  assert.equal(out.signalConnections[1].receiverId, 'Casa02::Puerta')
  assert.equal(plain(r.objects[1].position)[0], 9)
})

test('G001 resolver · descarta solo materializaciones al guardar, no referencias autorales', () => {
  const base = record([ref('Casa01', 'Casa')])
  const expanded = expandSceneInstances(base, 'Mundo', records())
  assert.equal(authoredSceneTree(expanded).objects.length, 1)
  assert.equal(authoredSceneTree(expanded).signalConnections.length, 0)
  const transient = { ...base, objects: [ref('runtime', 'Casa'), ...expanded.objects], signalConnections: [] }
  transient.objects[0].sceneRuntimeOnly = true
  assert.equal(authoredSceneTree(transient).objects.map(x => x.id).join(','), 'Casa01')
})

test('G001 resolver · relación de instancias anidadas y IDs persistentes', () => {
  const all = records()
  all.set('Casa', { objects: [node('Pared'), ref('Muebles', 'Mobiliario', 'Pared')], signalConnections: [] })
  const entry = record([ref('Casa01', 'Casa')])
  const first = expandSceneInstances(entry, 'Mundo', all)
  const second = expandSceneInstances(entry, 'Mundo', all)
  assert.deepEqual(plain(first.objects), plain(second.objects))
  assert.equal(first.objects.find(x => x.name === 'Silla').parentId, 'Casa01::Muebles')
  assert.equal(first.objects.find(x => x.name === 'Silla').sceneInstanceOwner, 'Casa01')
})

test('G001 resolver · detecta autoreferencia y ciclo A→B→A', () => {
  const direct = records()
  direct.set('Casa', record([ref('me', 'Casa')]))
  assert.throws(() => expandSceneInstances(record([ref('inst', 'Casa')]), 'Mundo', direct), /Referencia circular/)
  const cycle = new Map([['A', record([ref('b', 'B')])], ['B', record([ref('a', 'A')])]])
  assert.throws(() => expandSceneInstances(record([ref('inst', 'A')]), 'Mundo', cycle), /Referencia circular/)
  assert.throws(() => expandSceneInstances(record([ref('inst', 'Mundo')]), 'Mundo', cycle), /Referencia circular/)
})

test('G001 resolver · error de fuente ausente y colisión de IDs', () => {
  assert.throws(() => expandSceneInstances(record([ref('x', 'Desconocida')]), 'Mundo', records()), /fuente ausente/)
  const collision = record([ref('Casa01', 'Casa'), node('Casa01::Pared')])
  assert.throws(() => expandSceneInstances(collision, 'Mundo', records()), /Identidad derivada duplicada/)
})

test('G001 resolver · lectura transitiva una vez y ausencia explícita', async () => {
  const all = records()
  all.set('Casa', record([ref('Muebles', 'Mobiliario')]))
  const count = new Map()
  const result = await readSceneSources([ref('a', 'Casa'), ref('b', 'Casa')], async id => {
    count.set(id, (count.get(id) || 0) + 1)
    return all.get(id) || null
  })
  assert.equal(result.size, 2)
  assert.equal(count.get('Casa'), 1)
  assert.equal(count.get('Mobiliario'), 1)
  await assert.rejects(() => readSceneSources([ref('x', 'NoExiste')], async () => null), /no encontrada/)
})

test('G001 integración documental · API de scripts y exportador de recursos', async () => {
  const [api, interp, host, pack, type, editor] = await Promise.all([
    'src/core/events/game-api.d.ts', 'src/engine/runtime/events/interpreter.js',
    'src/engine/runtime/package/host.js', 'src/core/levelpackage.js',
    'src/engine/runtime/nodes/base.js', 'src/core/state/scene-instances.js',
  ].map(p => readFile(new URL('../' + p, import.meta.url), 'utf8')))
  assert.match(api, /interface RuntimeScenesApi/)
  assert.match(interp, /scenes:\s*\{[\s\S]*?instantiate:/)
  assert.match(host, /loadResolvedScene/)
  assert.match(pack, /'sceneId'/)
  assert.match(type, /type: 'sceneInstance'/)
  assert.match(editor, /prepareEditorSceneInstances/)
})


test('G001 Build · conserva el nivel inicial e incluye escenas fuente transitivas', () => {
  const records = new Map([
    ['Mundo', record([ref('CasaInstancia', 'Casa')])],
    ['Casa', record([ref('Muebles', 'Mobiliario')])],
    ['Mobiliario', record([node('Silla')])],
    ['Outro', record([node('Credits')])],
  ])
  const meta = [...records.keys()].map(id => ({ id, name: id }))
  assert.deepEqual(plain(includeInstancedSceneSources(meta, records, ['Mundo'])), ['Mundo', 'Casa', 'Mobiliario'])
  assert.deepEqual(plain(includeInstancedSceneSources(meta, records, ['Mundo'], [record([ref('OutroInstance', 'Outro')])])),
    ['Mundo', 'Outro', 'Casa', 'Mobiliario'])
  assert.throws(() => includeInstancedSceneSources(meta, records, ['Mundo'], [record([ref('bad', 'NoExiste')])]), /inexistente/)
  assert.deepEqual(plain(includeInstancedSceneSources(meta, records, ['Mundo', 'Outro'])), ['Mundo', 'Outro', 'Casa', 'Mobiliario'])
})

test('G001 Jerarquía · muestra los hijos vinculados y abre su fuente sin editar el derivado', async () => {
  const tree = await readFile(new URL('../src/components/SceneTree.vue', import.meta.url), 'utf8')
  assert.match(tree, /function openLinkedSource\(o\)/)
  assert.match(tree, /sceneSourceNodeId/)
  assert.match(tree, /v-if="row\.o\.sceneInstanceOwner \|\| row\.o\.type === 'sceneInstance'"/)
  assert.match(tree, /@dblclick="row\.o\.sceneInstanceOwner \? openLinkedSource/)
  assert.match(tree, /row\.o\.type === 'sceneInstance' \? openInstanceSource/)
  assert.doesNotMatch(tree, /if \(o\.sceneInstanceOwner\) continue/)
})

test('G001 runtime · instanciar y destruir no altera la escena autora ni deja cuerpos físicos', async () => {
  const text = await readFile(new URL('../src/engine/runtime/events/play-nodes.js', import.meta.url), 'utf8')
  const context = {
    makeSceneInstance, expandSceneInstances, readSceneSources, Map, Set, JSON, Promise, Error,
    uid: (() => { let next = 0; return () => `transient${++next}` })(),
  }
  const code = text.replace(/^import .*\n/gm, '').replace('export const nodesMethods =', 'const nodesMethods =')
  const methods = vm.runInNewContext(`${code}\n;nodesMethods`, context)
  const base = node('WorldRoot')
  const project = { scenes: [{ id: 'Mundo', name: 'Mundo' }, { id: 'Casa', name: 'Casa' }],
    activeSceneId: 'Mundo', objects: [base], signalConnections: [] }
  const source = record([node('Pared'), node('Puerta', 'Pared')])
  let attachCount = 0, detachCount = 0, lifecycleCount = 0
  const mounted = new Map([[base.id, { _lfNodeOwner: base }]])
  const play = {
    ...methods, on: true, project,
    rt: { readStreamScene: async id => id === 'Casa' ? source : null },
    ed: { nodes: mounted, syncObject(id) { mounted.set(id, { _lfNodeOwner: project.objects.find(o => o.id === id) }) },
      removeObject(id) { mounted.delete(id) },
      nodeLifecycle: { beginRemoval() {}, endRemoval() {}, sync() { lifecycleCount++ } } },
    phys: { nodeBodyRuntime: { attach() { attachCount++ }, detach() { detachCount++ } } },
    _nodeHandle(id) { return mounted.has(id) ? { id, is_valid: () => mounted.has(id) } : null },
  }
  const handle = await play._sceneInstantiate('Casa')
  assert.equal(handle.is_valid(), true)
  assert.equal(project.objects.length, 4)
  assert.equal(project.objects.find(o => o.id === handle.id).sceneRuntimeOnly, true)
  assert.equal(project.objects.filter(o => o.sceneInstanceOwner === handle.id).length, 2)
  assert.equal(attachCount, 1)
  assert.equal(lifecycleCount, 1)
  assert.equal(play._sceneDestroy(handle), true)
  assert.equal(handle.is_valid(), false)
  assert.equal(project.objects.length, 1)
  assert.equal(project.objects[0], base)
  assert.deepEqual(plain(project.signalConnections), [])
  assert.equal(detachCount, 1)
  assert.equal(play._sceneDestroy(handle), false)
  assert.equal(source.objects.length, 2)
})

test('G001 runtime · falla si la fuente no existe, sin modificar los nodos activos', async () => {
  const text = await readFile(new URL('../src/engine/runtime/events/play-nodes.js', import.meta.url), 'utf8')
  const methods = vm.runInNewContext(text.replace(/^import .*\n/gm, '').replace('export const nodesMethods =', 'const nodesMethods =') + '\n;nodesMethods',
    { makeSceneInstance, expandSceneInstances, readSceneSources, uid: () => 'new', Map, Set, Promise, JSON, Error })
  const p = { activeSceneId: 'World', scenes: [{ id: 'World', name: 'World' }, { id: 'Missing', name: 'Missing' }],
    objects: [node('Persistente')], signalConnections: [] }
  const graph = new Map([['Persistente', {}]])
  const play = { ...methods, on: true, project: p, rt: { readStreamScene: async () => null },
    ed: { nodes: graph }, _nodeHandle(id) { return graph.has(id) ? { id, is_valid: () => true } : null } }
  await assert.rejects(() => play._sceneInstantiate('Missing'), /no encontrada/)
  assert.equal(p.objects.length, 1)
  assert.equal(p.signalConnections.length, 0)
})
