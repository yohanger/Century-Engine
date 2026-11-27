// LF-STAIRS-INTEGRATION-QA-G001: integración acumulada de escalones, giro y parapetos.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stairs, fromPrimitive, validStairSidesTurn, stairSideOptions } from '../src/engine/runtime/mesh/generators.js'
import { checkClosed, signedVolume, triangulate } from '../src/engine/runtime/mesh/polymesh.js'
import { polyBuffers, trimeshPoints } from '../src/engine/runtime/mesh/buffers.js'
import { buildMeshGLB } from '../src/core/godot/glb.js'

const size = [3, 3, 6]
const config = (steps, turn, sides, sideHeight = 1, sideThickness = 0.15) => ({ steps, turn, sides, sideHeight, sideThickness })
const construct = (params, dims = size) => fromPrimitive('stairs', dims, params)
const input = (params, dims = size) => stairs(...dims, params.steps, params.turn, params)
const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const near = (a, b, e = 1e-4) => assert.ok(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= e, `${a} != ${b}`)
const allFinite = (values) => assert.ok(values.length > 0 && Array.from(values).every(Number.isFinite))
const combos = [
  config(2, 0, 'none'), config(8, 0, 'both'), config(64, 0, 'left'),
  config(2, 45, 'right'), config(8, 45, 'both', 1.5, 0.22),
  config(64, -45, 'left'), config(8, 90, 'right'), config(8, -90, 'both', 0.4, 0.12),
]

// Evita aprobar una malla inválida solo por tener una cantidad positiva de caras.
function verifyMesh(m, context) {
  assert.ok(m.v.length > 0 && m.f.length > 0, context)
  assert.deepEqual(checkClosed(m), [], `Bordes abiertos: ${context}`)
  assert.ok(signedVolume(m) > 0, `Volumen no positivo: ${context}`)
  const { tris } = triangulate(m)
  assert.ok(tris.length > 0, context)
  for (const triangle of tris) {
    const [p, q, r] = triangle.map((i) => m.v[i])
    const a = q.map((v, i) => v - p[i]), b = r.map((v, i) => v - p[i])
    const area = Math.hypot(a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]) / 2
    assert.ok(Number.isFinite(area) && area > 1e-9, `Triángulo degenerado: ${context}`)
  }
}

test('STAIRS-INT-01: secuencia de edición sucesiva no conserva topología obsoleta', () => {
  const states = [config(2, 0, 'none'), config(8, 0, 'none'), config(8, 45, 'none'), config(8, 45, 'left'), config(8, 45, 'both'), config(64, -45, 'both'), config(8, 0, 'none')]
  const first = input(states[0]); let last = first
  for (const [i, p] of states.entries()) {
    const m = input(p); verifyMesh(m, `paso ${i}`)
    assert.deepEqual(m.f, construct(p).f)
    if (i > 0) assert.notDeepEqual(m.v, last.v, `Cambio no aplicado ${i}`)
    last = m
  }
  assert.deepEqual(input(states.at(-1)).v, input(config(8, 0, 'none')).v)
  assert.deepEqual(first.v, input(states[0]).v)
})

test('STAIRS-INT-02: diferentes dimensiones XYZ y giros mantienen volumen cerrado', () => {
  for (const dims of [[3, 3, 6], [1.5, 2.6, 7], [4, 3.5, 9]]) {
    for (const p of [config(2, 0, 'both'), config(8, 45, 'left'), config(64, -45, 'right')]) {
      verifyMesh(input(p, dims), `${dims}/${p.steps}/${p.turn}/${p.sides}`)
      assert.deepEqual(construct(p, dims).f, input(p, dims).f)
    }
  }
})

test('STAIRS-INT-03: matriz de escalones, curva y laterales conserva topología y triangulación', () => {
  for (const p of combos) verifyMesh(input(p), `${p.steps}/${p.turn}/${p.sides}`)
})

test('STAIRS-INT-04: conversión Edit Mesh comparte vértices y caras con la primitiva', () => {
  for (const p of combos) {
    const a = input(p), b = construct(p)
    assert.deepEqual(b.v, a.v)
    assert.deepEqual(b.f, a.f)
  }
})

test('STAIRS-INT-05: UV, normales y atributos métricos son finitos en combinaciones', () => {
  for (const p of combos) {
    const b = polyBuffers(input(p), { blockout: true })
    for (const attr of [b.positions, b.normals, b.uvs, b.blockUV, b.blockSize]) allFinite(attr)
    assert.equal(b.uvs.length, b.blockUV.length)
    assert.equal(b.blockSize.length, b.blockUV.length)
    assert.equal(b.indices.length * 3, b.positions.length)
  }
})

test('STAIRS-INT-06: render y trimesh reciben exactamente los mismos triángulos', () => {
  for (const p of combos) {
    const mesh = input(p), buf = polyBuffers(mesh), shape = trimeshPoints(mesh)
    assert.equal(shape.length, buf.positions.length)
    shape.forEach((coordinate, i) => near(coordinate, buf.positions[i]))
  }
})

test('STAIRS-INT-07: serialización conserva las combinaciones con precisión del formato existente', () => {
  for (const p of combos) {
    const mesh = input(p), restored = mesh.constructor.fromJSON(mesh.toJSON())
    assert.deepEqual(restored.f, mesh.f)
    assert.equal(restored.v.length, mesh.v.length)
    restored.v.forEach((point, i) => point.forEach((v, j) => near(v, mesh.v[i][j])))
    assert.deepEqual(checkClosed(restored), [])
    assert.deepEqual(JSON.parse(JSON.stringify(p)), p)
  }
})

test('STAIRS-INT-08: combinaciones con radio interior incompatible degradan con seguridad a recta', () => {
  const invalid = config(8, 90, 'both', 1, 0.6), dims = [3, 3, 3]
  assert.equal(validStairSidesTurn(invalid.turn, dims[0], dims[2], invalid), false)
  const mesh = input(invalid, dims), straight = input({...invalid, turn: 0}, dims)
  assert.deepEqual(mesh.v, straight.v)
  assert.deepEqual(mesh.f, straight.f)
  verifyMesh(mesh, 'radio inválido')
})

test('STAIRS-INT-09: los proyectos antiguos siguen usando su forma, valores y contrato anteriores', () => {
  const old = construct({}, size), ref = input(config(8, 0, 'none'))
  assert.deepEqual(old.v, ref.v); assert.deepEqual(old.f, ref.f)
  assert.deepEqual(stairSideOptions({}), { sides: 'none', sideHeight: 1, sideThickness: 0.15 })
  assert.deepEqual(construct({steps: 8}).f, old.f)
})

test('STAIRS-INT-10: exportador GLB produce índices y atributos para variantes complejas', () => {
  for (const p of [config(8, 45, 'both'), config(64, 0, 'right'), config(8, -90, 'both')]) {
    const b = polyBuffers(input(p))
    const glb = buildMeshGLB({ name: 'EscaleraIntegracion', positions: b.positions, normals: b.normals, uvs: b.uvs, indices: b.indices })
    const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength)
    assert.equal(view.getUint32(0, true), 0x46546c67)
    assert.equal(view.getUint32(8, true), glb.byteLength)
    const size = view.getUint32(12, true)
    const json = JSON.parse(new TextDecoder().decode(glb.slice(20, 20 + size)))
    const attrs = json.meshes[0].primitives[0].attributes
    assert.ok(attrs.POSITION !== undefined && attrs.NORMAL !== undefined && attrs.TEXCOORD_0 !== undefined)
    assert.equal(json.accessors[0].count, b.indices.length)
  }
})

test('STAIRS-INT-11: firmas de reconstrucción y CSG incluyen parámetros de curva y parapetos', () => {
  const signature = source('src/engine/runtime/nodes/three-helpers.js')
  const csg = source('src/engine/runtime/scene/brushes.js')
  const primitive = source('src/engine/runtime/nodes/primitive.js')
  for (const name of ['steps', 'turn', 'sides', 'sideHeight', 'sideThickness']) {
    assert.ok(signature.includes(`obj.props?.${name}`), `firma: ${name}`)
    assert.ok(csg.includes(`o.props?.${name}`), `corte: ${name}`)
  }
  assert.match(csg, /carveGeometries\(ud\.baseGeo, hits\)/)
  assert.match(primitive, /stairsGeometry\(obj\.props\?\.steps/)
})

test('STAIRS-INT-12: exportación distingue cajas históricas de GLB+trimesh con laterales/curva', () => {
  const code = source('src/core/godot/nodes.js')
  assert.match(code, /turn !== 0 \|\| stairSideOptions\(o\.props\)\.sides !== 'none'/)
  assert.match(code, /stairs\(sx, sy, sz, o\.props\?\.steps \?\? 8, turn, o\.props\)/)
  assert.match(code, /buildMeshGLB\(\{/)
  assert.match(code, /ConcavePolygonShape3D/)
  assert.match(code, /trimeshPoints\(poly\)/)
  assert.match(code, /stairSteps\(o\.props\?\.steps \?\? 8\)/)
})
