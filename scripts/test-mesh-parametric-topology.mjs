import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PolyMesh, meshGeometrySignature } from '../src/engine/runtime/mesh/polymesh.js'
import { make, makeParametric, fromPrimitive, GENERATOR_FIELDS } from '../src/engine/runtime/mesh/generators.js'
import { writeMesh, meshDataOf, linkMesh, unlinkMesh, meshConsumers } from '../src/engine/runtime/mesh/shared-mesh.js'

const cases = [
  ['plane', 'nx', 5, 12], ['grid', 'nz', 5, 30],
  ['circle', 'n', 32, 32], ['cylinder', 'n', 32, 64],
  ['cone', 'n', 32, 33], ['sphere', 'rings', 14, 210],
  ['torus', 'minor', 14, 280],
]

for (const [kind, field, count, vertices] of cases) {
  test(`${kind}: el parámetro se conserva y regenera la topología`, () => {
    const original = make(kind)
    const saved = original.toJSON()
    const loaded = PolyMesh.fromJSON(saved)
    assert.deepEqual(loaded.generator, saved.generator)
    assert.equal(meshGeometrySignature(loaded), saved.generator.signature)
    const changed = makeParametric(kind, { ...loaded.generator.params, [field]: count })
    assert.equal(changed.v.length, vertices)
    assert.equal(changed.generator.kind, kind)
    assert.equal(changed.generator.params[field], count)
    assert.notEqual(meshGeometrySignature(changed), saved.generator.signature)
    assert.equal(meshGeometrySignature(PolyMesh.fromJSON(changed.toJSON())), changed.generator.signature)
    assert.deepEqual(PolyMesh.fromJSON(saved).v, loaded.v)
  })
}

test('esfera: anillos y segmentos son independientes', () => {
  const a = makeParametric('sphere', { sx: 2, sy: 3, sz: 4, seg: 10, rings: 6 })
  assert.equal(a.v.length, 52)
  assert.equal(a.f.length, 60)
  assert.equal(a.bounds().max[0], 1)
  assert.equal(a.bounds().max[1], 1.5)
  assert.ok(a.bounds().max[2] <= 2 && a.bounds().max[2] > 1.9)
})

test('cilindro y cono convertidos retienen dimensiones y 32 segmentos', () => {
  for (const kind of ['cylinder', 'cone']) {
    const m = fromPrimitive(kind, [2, 4, 6])
    assert.equal(m.generator.params.n, 32)
    assert.equal(m.generator.params.rx, 1)
    assert.equal(m.generator.params.rz, 3)
    assert.equal(m.generator.params.h, 4)
    assert.equal(meshGeometrySignature(PolyMesh.fromJSON(m.toJSON())), m.generator.signature)
  }
  const sphere = fromPrimitive('sphere', [2, 4, 6])
  assert.equal(sphere.generator.params.seg, 32)
  assert.equal(sphere.generator.params.rings, 20)
})

test('conversiones recortadas y primitivas no compatibles no inventan parámetros', () => {
  for (const kind of ['box', 'stairs', 'ramp', 'vertex', 'cube']) {
    const m = ['vertex', 'cube'].includes(kind) ? make(kind) : fromPrimitive(kind)
    assert.equal(m.generator, null)
  }
})

test('ediciones manuales preservan la firma de origen para advertir al regenerar', () => {
  const m = PolyMesh.fromJSON(make('sphere').toJSON())
  const sig = m.generator.signature
  m.v[4][0] += 0.12
  assert.notEqual(meshGeometrySignature(m), sig)
  const stored = PolyMesh.fromJSON(m.toJSON())
  assert.equal(stored.generator.signature, sig)
  assert.notEqual(meshGeometrySignature(stored), sig)
  const cloned = stored.clone()
  assert.deepEqual(cloned.generator, stored.generator)
  cloned.generator.params.seg = 22
  assert.notEqual(cloned.generator.params.seg, stored.generator.params.seg)
})

test('modificaciones de UV y pintura también exigen protección', () => {
  const m = PolyMesh.fromJSON(make('cylinder').toJSON())
  m.ensureUV()
  assert.notEqual(meshGeometrySignature(m), m.generator.signature)
})

test('los rangos de cada parámetro se rechazan sin generar geometría', () => {
  for (const [kind, fields] of Object.entries(GENERATOR_FIELDS)) {
    const params = make(kind).generator.params
    for (const f of fields) {
      assert.equal(makeParametric(kind, { ...params, [f.key]: f.min - 1 }), null)
      assert.equal(makeParametric(kind, { ...params, [f.key]: f.max + 1 }), null)
      assert.equal(makeParametric(kind, { ...params, [f.key]: 3.5 }), null)
      assert.ok(makeParametric(kind, { ...params, [f.key]: f.min }))
      assert.ok(makeParametric(kind, { ...params, [f.key]: f.max }))
    }
  }
})

test('recurso compartido usa la misma malla y conserva sus metadatos al desvincular', () => {
  const o = { id: 'a', type: 'mesh', props: { mesh: make('torus').toJSON() } }
  const project = { meshes: [], objects: [o] }
  linkMesh(project, o, 'resource')
  const b = { id: 'b', type: 'mesh', props: { meshRef: 'resource' } }
  project.objects.push(b)
  assert.equal(meshConsumers(project, 'resource').length, 2)
  const next = makeParametric('torus', { ...meshDataOf(o, project.meshes).generator.params, major: 25 })
  assert.equal(writeMesh(project, o, next.toJSON()), true)
  assert.equal(meshDataOf(b, project.meshes).generator.params.major, 25)
  assert.equal(unlinkMesh(project, b), true)
  assert.equal(b.props.mesh.generator.params.major, 25)
  assert.notEqual(b.props.mesh, meshDataOf(o, project.meshes))
})

test('Edit Mesh mantiene controles y confirmación antes de reemplazar cambios manuales', () => {
  const ui = readFileSync(new URL('../src/components/MeshPanel.vue', import.meta.url), 'utf8')
  const edit = readFileSync(new URL('../src/core/mesh/session.js', import.meta.url), 'utf8')
  assert.match(ui, /data-testid="mesh-primitive-topology"/)
  assert.match(ui, /generator\.fields/)
  assert.match(ui, /changeGeneratorCount/)
  assert.match(edit, /state\.modified \|\| consumers > 1/)
  assert.match(edit, /await askConfirm/)
  assert.match(edit, /this\.commit\('Cambiar resolución de primitiva'\)/)
  assert.match(edit, /meshGeometrySignature\(this\.poly\) !== original/)
})
