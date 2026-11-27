import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'

const root = resolve(import.meta.dirname, '..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')
const waterSource = read('src/engine/runtime/scene/water.js')
const objectSource = read('src/engine/runtime/scene/objects.js')

function extractMethod(source, name) {
  const start = source.indexOf(`  ${name}() {`)
  assert.notEqual(start, -1, `${name} debe existir`)
  const end = source.indexOf('\n  },', start)
  assert.notEqual(end, -1, `${name} debe terminar como método del objeto`)
  return source.slice(start, end + '\n  }'.length)
}

function previewHarness(project, options = {}) {
  const calls = { hide: 0, build: 0, surface: 0, terrain: 0, bounds: 0 }
  const water = { bodies: [], regions: new Map() }
  const refresh = runInNewContext(`({${extractMethod(waterSource, 'refreshPhysicalWaterPreview')}}).refreshPhysicalWaterPreview`, {
    WaterWorld: { fromObjects(objects) { calls.build++; assert.ok(Array.isArray(objects)); return water } },
    nativeWaterConfiguration() { if (options.fail) throw new Error('Superficie inválida'); return options.resolved ? {} : null },
    TerrainWaterConnection: class { constructor() { calls.terrain++ } },
    console: { warn() {} },
  })
  const scene = {
    host: { project, getObject: () => null, toast() {} },
    terrains: [], isPlaying: false, _previewWaterWorld: options.previous ?? null,
    _physicalPreviewSig: options.signature ?? null, _physicalWaterView: options.view ?? null,
    hidePhysicalWater() { calls.hide++; this._physicalPreviewSig = null; this._physicalWaterView = null },
    showPhysicalWater(w) { calls.surface++; this._physicalWaterView = { water: w } },
    setPhysicalWaterBounds() { calls.bounds++ },
  }
  return { calls, refresh, scene, water }
}

test('La vista previa no accede a objects sin proyecto ni conserva el estado obsoleto', () => {
  const { refresh, scene, calls } = previewHarness(null, { previous: { bodies: [] }, signature: 'old' })
  assert.doesNotThrow(() => refresh.call(scene))
  assert.equal(scene._previewWaterWorld, null)
  assert.equal(scene._physicalPreviewSig, null)
  assert.equal(calls.hide, 1)
  assert.equal(calls.build, 0)
  refresh.call(scene)
  assert.equal(calls.hide, 1)
})

test('Los registros parciales no reconstruyen WaterWorld', () => {
  for (const project of [{}, { objects: null }, { objects: 'sin escena' }]) {
    const { refresh, scene, calls } = previewHarness(project)
    assert.doesNotThrow(() => refresh.call(scene))
    assert.equal(calls.build, 0)
  }
})

test('El agua válida conserva su previsualización y evita reconstruir sin cambios', () => {
  const { refresh, scene, calls, water } = previewHarness({ objects: [{ id: 'agua', type: 'water', props: {} }] }, { resolved: true })
  refresh.call(scene)
  assert.equal(calls.build, 1)
  assert.equal(calls.surface, 1)
  assert.equal(calls.bounds, 1)
  assert.equal(scene._physicalWaterView.water, water)
  refresh.call(scene)
  assert.equal(calls.build, 1)
})

test('Un fallo de construcción limpia la referencia obsoleta y no rompe el fotograma', () => {
  const { refresh, scene } = previewHarness({ objects: [] }, { fail: true, previous: {} })
  assert.doesNotThrow(() => refresh.call(scene))
  assert.equal(scene._previewWaterWorld, null)
  assert.equal(scene._physicalWaterView, null)
})

test('La vista previa no interfiere con Play', () => {
  const { refresh, scene, calls } = previewHarness(null, { previous: {}, signature: 'old' })
  scene.isPlaying = true
  refresh.call(scene)
  assert.equal(calls.hide, 0)
  assert.equal(calls.build, 0)
})

test('Todos los módulos de tipos de nodo tienen su registro conectado', () => {
  const index = read('src/engine/runtime/nodes/index.js')
  const dir = resolve(root, 'src/engine/runtime/nodes')
  for (const name of readdirSync(dir).filter(name => name.endsWith('.js'))) {
    const content = read(`src/engine/runtime/nodes/${name}`)
    if (!/registerNode\s*\(\s*\{/.test(content)) continue
    assert.ok(index.includes(`import './${name}'`), `${name} define un tipo sin importar en el registro`)
  }
  assert.match(read('src/engine/runtime/nodes/mesh-subtract.js'), /type:\s*'meshSubtract'/)
})

test('El diagnóstico de nodo no registrado informa tipo e ID sin descartar el objeto', () => {
  const match = objectSource.match(/function requiredNodeDef\(obj\) \{[\s\S]*?\n\}/)
  assert.ok(match)
  const required = runInNewContext(`(${match[0]})`, { getDef: type => type === 'water' ? { type } : undefined })
  assert.equal(required({ type: 'water', id: 'ok' }).type, 'water')
  assert.throws(() => required({ type: 'no-registrado', id: 'id-conservado' }), err =>
    err.message.includes('no-registrado') && err.message.includes('id-conservado'))
  assert.match(objectSource, /const def = requiredNodeDef\(obj\)[\s\S]*?const node = def\.build/)
  assert.match(objectSource, /const def = requiredNodeDef\(obj\)[\s\S]*?let node = this\.nodes\.get\(id\)/)
})
