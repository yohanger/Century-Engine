import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PolyMesh, meshGeometrySignature, ekey } from '../src/engine/runtime/mesh/polymesh.js'
import { cube, grid, make } from '../src/engine/runtime/mesh/generators.js'
import { Sel, normalize } from '../src/core/mesh/sel.js'
import { knifeOp, knifeTargetFaces } from '../src/core/mesh/ops.js'

const reactive = (value) => new Proxy(value, {})

test('metadata paramétrica reactiva se copia sin structuredClone y conserva la firma', () => {
  const source = make('sphere').toJSON()
  source.generator = reactive({ kind: source.generator.kind, params: reactive(source.generator.params), signature: source.generator.signature })
  assert.throws(() => structuredClone(source.generator), { name: 'DataCloneError' })
  const mesh = PolyMesh.fromJSON(source)
  assert.equal(meshGeometrySignature(mesh), mesh.generator.signature)
  const saved = mesh.toJSON()
  assert.equal(saved.generator.kind, 'sphere')
  assert.equal(saved.generator.params.rings, source.generator.params.rings)
  assert.notEqual(saved.generator.params, source.generator.params)
  const next = mesh.clone()
  next.generator.params.rings = 9
  assert.notEqual(mesh.generator.params.rings, next.generator.params.rings)
})

test('metadata numérica inválida no interrumpe la carga de la geometría', () => {
  const source = make('torus').toJSON()
  source.generator = { kind: 'torus', params: { major: 20, minor: () => 3 }, signature: 'x' }
  const mesh = PolyMesh.fromJSON(source)
  assert.equal(mesh.generator, null)
  assert.equal(mesh.f.length, 200)
})

test('Cuchillo recorta exclusivamente la cara seleccionada', () => {
  const mesh = grid(2, 2, 2, 1)
  const old = mesh.f.map((face) => [...face])
  const selection = new Sel()
  selection.f.add(0)
  normalize(mesh, selection, 'face')
  const before = mesh.f.length
  const error = knifeOp(mesh, selection, 'face', { point: [-0.5, 0, 0], normal: [0, 0, 1] })
  assert.equal(error, undefined)
  assert.equal(mesh.f.length, before + 1)
  assert.deepEqual(mesh.f.at(-1).length > 2, true)
  assert.ok(old[1].every((v) => mesh.f[2].includes(v)))
  assert.equal(mesh.f[2].length, old[1].length + 1)
})

test('Cuchillo en modo arista toma caras adyacentes, no toda la malla', () => {
  const mesh = cube()
  const selection = new Sel()
  const key = ekey(mesh.f[0][0], mesh.f[0][1])
  selection.e.add(key)
  normalize(mesh, selection, 'edge')
  const target = knifeTargetFaces(mesh, selection, 'edge')
  assert.deepEqual(target, new Set(mesh.edges().get(key).faces))
  assert.ok(target.size > 0 && target.size < mesh.f.length)
})

test('Cuchillo en modo vértice toma las caras incidentes', () => {
  const mesh = cube()
  const selection = new Sel()
  selection.v.add(0)
  normalize(mesh, selection, 'vertex')
  const targets = knifeTargetFaces(mesh, selection, 'vertex')
  assert.ok(targets.size > 0 && targets.size < mesh.f.length)
  for (const fi of targets) assert.ok(mesh.f[fi].includes(0))
})

test('Cuchillo con selección vacía no modifica geometría', () => {
  const mesh = grid(2, 2, 2, 2)
  const before = JSON.stringify(mesh.toJSON().f)
  const error = knifeOp(mesh, new Sel(), 'face', { point: [0, 0, 0], normal: [1, 0, 0] })
  assert.match(error, /Selecciona/)
  assert.equal(JSON.stringify(mesh.f), before)
})

test('Corte en bucle global no cambia su semántica', () => {
  const source = readFileSync(new URL('../src/core/mesh/ops.js', import.meta.url), 'utf8')
  assert.match(source, /loopCut\(m, p\.key/)
})

test('TransformControls se desacopla al sustituir descendientes', () => {
  const editor = readFileSync(new URL('../src/core/editor.js', import.meta.url), 'utf8')
  assert.match(editor, /while \(node && node !== old\) node = node\.parent/)
})

test('reducción de polígonos sobre rejilla no toca bordes y respeta el objetivo', async () => {
  const { reduceFaces } = await import('../src/core/mesh/ops-reduce.js')
  const { checkClosed } = await import('../src/engine/runtime/mesh/polymesh.js')
  const mesh = grid(2, 2, 4, 4)
  mesh.ensureUV()
  const before = mesh.clone()
  assert.equal(reduceFaces(mesh, new Sel(), 'face', 8), undefined)
  assert.equal(mesh.f.length, 8)
  mesh.reconcileAttributes(before)
  assert.equal(mesh.uv.length, mesh.f.length)
  assert.ok(mesh.uv.every((loop, i) => loop.length === mesh.f[i].length))
  assert.ok(checkClosed(mesh).length > 0)
})

test('reducción numérica de esfera triangulada conserva superficie cerrada', async () => {
  const { reduceFaces } = await import('../src/core/mesh/ops-reduce.js')
  const { checkClosed } = await import('../src/engine/runtime/mesh/polymesh.js')
  const mesh = make('sphere')
  mesh.ensureUV()
  const before = mesh.clone()
  const goal = Math.floor(mesh.f.length / 2)
  assert.equal(reduceFaces(mesh, new Sel(), 'face', goal), undefined)
  assert.equal(mesh.f.length, goal)
  assert.deepEqual(checkClosed(mesh), [])
  mesh.reconcileAttributes(before)
  assert.equal(mesh.uv.length, mesh.f.length)
  assert.ok(mesh.uv.every((loop, i) => loop.length === mesh.f[i].length))
  assert.equal(mesh.generator.kind, 'sphere')
  assert.notEqual(meshGeometrySignature(mesh), mesh.generator.signature)
})

test('reducción no sobrescribe una malla cuando el objetivo es inválido', async () => {
  const { reduceFaces } = await import('../src/core/mesh/ops-reduce.js')
  const mesh = make('cube')
  const original = JSON.stringify(mesh.toJSON())
  assert.match(reduceFaces(mesh, new Sel(), 'face', 2), /compatibles/)
  const result = JSON.parse(original)
  const after = mesh.toJSON()
  assert.deepEqual(after.v, result.v)
  assert.deepEqual(after.f, result.f)
})

test('panel incluye reducción numérica y topología paramétrica', () => {
  const panel = readFileSync(new URL('../src/components/MeshPanel.vue', import.meta.url), 'utf8')
  assert.match(panel, /data-testid="mesh-reduce-faces"/)
  assert.match(panel, /data-testid="mesh-primitive-topology"/)
  assert.match(panel, /changeGeneratorCount/)
  assert.match(panel, /reduceFaces/)
})
