import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeScriptEditables, validEditableValue, editableValuesForNode } from '../src/engine/runtime/scene/script-editables.js'
import { compileScript } from '../src/engine/runtime/host.js'

function run(code, stored = {}) {
  const analysis = analyzeScriptEditables(code)
  assert.deepEqual(analysis.diagnostics, [])
  const factory = compileScript(['game', 'node', '__centuryEditableValues'], `${analysis.source}\nreturn { _ready: typeof _ready === 'function' ? _ready : null }`)(console)
  const observed = []
  const obj = { scriptProperties: { scriptA: stored } }
  const callback = factory({ record: (...args) => observed.push(args) }, {}, editableValuesForNode(obj, 'scriptA', analysis.fields))
  callback._ready?.()
  return { observed, analysis }
}

test('directivas: título, descripción y los dos alias del campo', () => {
  const a = analyzeScriptEditables(`@header('Movimiento')\n@header_descripcion("Configuración")\n@editable_descricption("En metros")\n@editable\nlet velocidad = 5;\n@editable_description('Puede correr')\n@editable\nconst corre = true`)
  assert.deepEqual(a.diagnostics, [])
  assert.equal(a.fields.length, 2)
  assert.deepEqual(a.fields.map(f => [f.name, f.type, f.defaultValue, f.description]), [
    ['velocidad', 'number', 5, 'En metros'], ['corre', 'boolean', true, 'Puede correr'],
  ])
  assert.equal(a.fields[0].header, 'Movimiento')
  assert.equal(a.fields[1].headerDescription, 'Configuración')
  assert.equal(a.fields[0].groupOrder, a.fields[1].groupOrder)
})

test('encabezados distintos generan grupos distintos', () => {
  const a = analyzeScriptEditables('@header("Uno")\n@editable\nlet a=1\n@header("Dos")\n@editable\nlet b=2')
  assert.notEqual(a.fields[0].groupOrder, a.fields[1].groupOrder)
})

test('comentarios, cadenas, regex y plantillas no crean propiedades', () => {
  const a = analyzeScriptEditables('// @editable\n/*\n@editable\nlet falsa=4\n*/\nconst text = `\n@editable\nlet fake=8\n`;\nconst re=/@editable/;\nconst string="@editable";')
  assert.equal(a.fields.length, 0)
  assert.deepEqual(a.diagnostics, [])
})

test('propiedades anidadas no son de instancia de script', () => {
  const a = analyzeScriptEditables('function f(){\n@editable\nlet local = 2\n}')
  assert.equal(a.fields.length, 0)
})

test('números con exponente y signos, cadenas y booleanos', () => {
  const a = analyzeScriptEditables('@editable\nconst negative = -2.5e2\n@editable\nvar message = "Hola"\n@editable\nlet active=false')
  assert.deepEqual(a.fields.map(f => f.defaultValue), [-250, 'Hola', false])
})

test('un valor guardado se carga antes del callback', () => {
  const { observed } = run('@editable\nlet speed=5;\nfunction _ready(){game.record(speed)}', { speed: 12 })
  assert.deepEqual(observed, [[12]])
})

test('el valor por defecto no se evalúa si hay anulación compatible', () => {
  const { observed } = run('@editable\nconst name="original"\nfunction _ready(){game.record(name)}', { name: 'cambiado' })
  assert.deepEqual(observed, [['cambiado']])
})

test('sin valor persistido se conserva valor inicial', () => {
  assert.deepEqual(run('@editable\nlet speed=5\nfunction _ready(){game.record(speed)}').observed, [[5]])
})

test('un recurso tiene estados independientes en dos nodos', () => {
  const code = '@editable\nlet speed=5\nfunction _ready(){game.record(speed)}'
  assert.deepEqual(run(code, { speed: 8 }).observed, [[8]])
  assert.deepEqual(run(code, { speed: 3 }).observed, [[3]])
})

test('tipos corruptos se ignoran sin modificar el valor original', () => {
  assert.deepEqual(run('@editable\nconst speed=5\nfunction _ready(){game.record(speed)}', { speed: 'bad' }).observed, [[5]])
  assert.equal(validEditableValue(Infinity, 'number'), false)
  assert.equal(validEditableValue(4, 'number'), true)
  assert.equal(validEditableValue('4', 'number'), false)
})

test('nombres equivalentes en scripts diferentes no colisionan', () => {
  const a = analyzeScriptEditables('@editable\nlet value=1')
  const b = analyzeScriptEditables('@editable\nlet value=2')
  const node = { scriptProperties: { a: { value: 10 }, b: { value: 20 } } }
  assert.equal(editableValuesForNode(node, 'a', a.fields).value, 10)
  assert.equal(editableValuesForNode(node, 'b', b.fields).value, 20)
})

test('directiva sin declaración válida genera diagnóstico', () => {
  const a = analyzeScriptEditables('@editable\nlet velocity=compute()')
  assert.ok(a.diagnostics.some(x => x.message.includes('sin variable')))
})

test('declaraciones múltiples se rechazan', () => {
  assert.ok(analyzeScriptEditables('@editable\nlet x=1,y=2').diagnostics.length)
})

test('anotaciones sin texto o con tipo de argumento incorrecto se rechazan', () => {
  assert.ok(analyzeScriptEditables('@header\n@editable\nlet x=1').diagnostics.length)
  assert.ok(analyzeScriptEditables('@editable("x")\nlet x=1').diagnostics.length)
})

test('no se ejecuta código del autor durante el descubrimiento estático', () => {
  globalThis.__sentinel = 0
  analyzeScriptEditables('globalThis.__sentinel++;\n@editable\nlet count=2')
  assert.equal(globalThis.__sentinel, 0)
  delete globalThis.__sentinel
})

test('el código de Editor conserva posiciones y borra únicamente anotaciones válidas', () => {
  const code='@header("Jugador")\n@editable\nconst velocidad=5;\nfunction _ready(){return velocidad}'
  const a=analyzeScriptEditables(code)
  assert.equal(a.editorSource.length, code.length)
  assert.match(a.editorSource, /const velocidad=5/)
  assert.doesNotMatch(a.source, /@editable/)
  assert.doesNotMatch(a.source, /@header/)
})

test('script sin directivas sigue compilando sin modificaciones', () => {
  const source = 'let count=0; function _ready(){game.record(++count)}'
  const a = analyzeScriptEditables(source)
  assert.equal(a.source, source)
  assert.deepEqual(run(source).observed, [[1]])
})

test('importación de paquete remapea las claves de scriptProperties, pero no sus textos', async () => {
  const { readFileSync } = await import('node:fs')
  const vm = await import('node:vm')
  const source = readFileSync(new URL('../src/core/levelpackage-import.js', import.meta.url), 'utf8')
  const code = source.replace(/^import[^\n]*\n/gm, '').replace(/^export /gm, '')
  const imported = vm.runInNewContext(code + '\nplanLevelPackageImport', {
    allEntries: () => [], ROOT_FOLDER: 'Assets', sanitizeName: x => x, isSystemUiPath: () => false,
    validateSignalConnections: links => links || [], remapSignalConnections: () => [],
    migrateNodeScripts: x => x, LEVELPACKAGE_FORMAT: 'levelforge-package', LEVELPACKAGE_VERSION: 1,
    normalizeMaterial: x => x, normalizeLiquid: x => x, validateVfxResource: x => x, TIMELINE_REF_FIELDS: new Set(),
    Map, Set, Error, Object, Uint8Array,
  })
  let next = 0
  const manifest = { entries: [
    { id: 'scene1', name: 'Escena', kind: 'scene', path: 'Assets/Scenes/Uno.scene.json', folder: 'Assets/Scenes', file: 'Uno.scene.json', metadata: {}, dependencies: ['sc1'] },
    { id: 'sc1', name: 'Test.js', kind: 'script', path: 'Assets/Scripts/Test.js', folder: 'Assets/Scripts', file: 'Test.js', metadata: { execution: 'node' }, dependencies: [] },
  ], roots: [{ kind: 'scene', id: 'scene1' }] }
  const contents = new Map([
    ['scene1', { objects: [{ id: 'actor', name: 'Actor', type: 'node', scriptIds: ['sc1'], scriptProperties: { sc1: { etiqueta: 'sc1', velocidad: 4 } } }], terrain: {}, environment: {}, signalConnections: [] }],
    ['sc1', '@editable\nlet velocidad=1'],
  ])
  const result = imported({ manifest, contents, project: { entries: [] }, selectedIds: ['scene1'], makeId: pref => `${pref || 'n'}_${++next}` })
  const obj = result.scenes[0].data.objects[0]
  assert.equal(obj.scriptIds[0], result.idMap.sc1)
  assert.equal(obj.scriptProperties[result.idMap.sc1].etiqueta, 'sc1')
  assert.equal(obj.scriptProperties[result.idMap.sc1].velocidad, 4)
  assert.equal(obj.scriptProperties.sc1, undefined)
})

test('NodeLifecycle y NodeScriptRuntime reciben valores individuales antes de _ready', async () => {
  const { readFileSync } = await import('node:fs')
  const vm = await import('node:vm')
  const { Game } = await import('../src/engine/runtime/events/interpreter.js')
  const { NodeLifecycle } = await import('../src/engine/runtime/scene/node-lifecycle.js')
  const { NodeScriptRuntime } = await import('../src/engine/runtime/scene/node-scripts.js')
  const { registerNode } = await import('../src/engine/runtime/nodes/registry.js')
  registerNode({ type: 'scriptEditablesQA', label: 'QA', create: () => ({}), build: () => ({}), update: () => {} })
  const source = readFileSync(new URL('../src/engine/runtime/events/play-nodes.js', import.meta.url), 'utf8')
    .replace(/^import .*\n/gm, '').replace('export const nodesMethods', 'const nodesMethods')
  const methods = vm.runInNewContext(source + '\nnodesMethods', { resolveNodePath: () => null })
  const nodesList = [
    { id: 'actorA', name: 'Actor A', type: 'scriptEditablesQA', scriptIds: ['scA'], scriptProperties: { scA: { speed: 12 } } },
    { id: 'actorB', name: 'Actor B', type: 'scriptEditablesQA', scriptIds: ['scA'], scriptProperties: { scA: { speed: 3 } } },
  ]
  const scripts = [{ id: 'scA', execution: 'node', name: 'actor.js', code: '@editable\nlet speed = 5;\nfunction _ready(){game.record(speed)}' }]
  const records = [], errors = [], project = { objects: nodesList, scripts, activeSceneId: 'scene', signalConnections: [] }
  const nodes = new Map(nodesList.map(obj => [obj.id, { _lfNodeOwner: obj }]))
  const life = new NodeLifecycle({ host: { project }, nodes })
  const game = new Game({ host: { error: (message, error) => errors.push(String(error?.message || message)) } })
  game.api.record = value => records.push(value)
  const play = { on: true, _referenceSession: {}, project, ed: { nodes, nodeLifecycle: life }, game,
    _tagLayerApi: () => ({}), _animMethodsFor: () => ({}), _persistMarked: () => false, _persistSet: () => {},
    vm: { held: new Map() }, pos: {}, vp: { requestRender() {} } }
  Object.assign(play, methods)
  game.api.node = id => play._nodeHandle(id)
  life.scripts = new NodeScriptRuntime(play)
  life.start()
  assert.deepEqual(records.sort((a,b) => a-b), [3, 12])
  assert.deepEqual(errors, [])
  life.stop()
})
