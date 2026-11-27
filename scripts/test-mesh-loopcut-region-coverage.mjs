import test from 'node:test'
import assert from 'node:assert/strict'
import { grid, make } from '../src/engine/runtime/mesh/generators.js'
import { PolyMesh, ekey, checkClosed, signedVolume } from '../src/engine/runtime/mesh/polymesh.js'
import { loopCut, loopCutLines, ringOf, validLoopCutRing } from '../src/core/mesh/cuts.js'
import { loopCutOp } from '../src/core/mesh/ops.js'
import { Sel, normalize } from '../src/core/mesh/sel.js'

const edge = (m, face = 0, index = 1) => ekey(m.f[face][index], m.f[face][(index + 1) % m.f[face].length])
const near = (a, b) => Math.abs(a - b) < 1e-7
const faceCount = (m) => m.f.length

function assertNoDanglingEdges(m) {
  for (const { faces, a, b } of m.edges().values()) {
    assert.ok(faces.length <= 2, 'Arista no-manifold')
    assert.ok(m.v[a] && m.v[b], 'Arista sin vértices válidos')
  }
  for (const f of m.f) {
    assert.ok(f.length >= 3 && new Set(f).size === f.length, 'Cara degenerada')
  }
}


test('Región horizontal seleccionada no cambia el anillo real de una rejilla', () => {
  const m = grid(4, 2, 4, 2), selected = new Set([0, 1, 2]), start = edge(m, 0, 1)
  assert.equal(selected.size, 3)
  const ring = ringOf(m, start)
  assert.equal(ring.faces.length, 2)
  assert.equal(loopCutLines(m, start).length, ring.faces.length)
  const original = faceCount(m), cut = loopCut(m, start)
  assert.equal(cut.edges.length, ring.faces.length)
  assert.equal(faceCount(m), original + ring.faces.length)
  assertNoDanglingEdges(m)
})

test('Una columna vertical de caras no fuerza cortes ajenos al anillo', () => {
  const m = grid(2, 3, 2, 3), selected = new Set([0, 2, 4]), start = edge(m, 0, 0)
  assert.equal(selected.size, 3)
  const ring = ringOf(m, start)
  assert.ok(ring.faces.length >= 1)
  assert.equal(loopCutLines(m, start).length, ring.faces.length)
  const n = m.f.length
  assert.ok(loopCut(m, start))
  assert.equal(m.f.length, n + ring.faces.length)
  assertNoDanglingEdges(m)
})

test('Una región rectangular seleccionada conserva el anillo elegido por el cursor', () => {
  const m = grid(3, 3, 4, 3), selected = new Set([0, 1, 4, 5]), start = edge(m, 0, 1)
  assert.equal(selected.size, 4)
  const ring = validLoopCutRing(m, start)
  assert.ok(ring)
  assert.equal(loopCutLines(m, start).length, ring.faces.length)
  const n = m.f.length, result = loopCut(m, start, 1, .15)
  assert.equal(m.f.length, n + ring.faces.length)
  assert.equal(result.edges.length, ring.faces.length)
  assertNoDanglingEdges(m)
})

test('Previsualización y vértices resultantes coinciden con varias divisiones', () => {
  const m = grid(3, 2, 4, 2), start = edge(m, 0, 1)
  const ring = ringOf(m, start), preview = loopCutLines(m, start, 3, -.65)
  assert.equal(preview.length, ring.faces.length * 3)
  const original = m.clone(), result = loopCut(m, start, 3, -.65)
  assert.equal(result.edges.length, preview.length)
  for (const vi of result.verts) {
    const point = m.v[vi]
    assert.ok(preview.flat().some((p) => p.every((value, index) => near(value, point[index]))))
  }
  assert.equal(m.f.length, original.f.length + ring.faces.length * 3)
})

test('Deslizamiento y 32 cortes respetan el anillo global', () => {
  const m = grid(4, 2, 4, 2), start = edge(m, 0, 1)
  const faces = ringOf(m, start).faces.length
  const preview = loopCutLines(m, start, 32, .95)
  assert.equal(preview.length, faces * 32)
  const result = loopCut(m, start, 32, .95)
  assert.equal(result.edges.length, preview.length)
  assert.equal(m.f.length, 8 + faces * 32)
  assertNoDanglingEdges(m)
})

test('Seleccionar una cara no limita ni modifica el anillo obtenido', () => {
  const m = grid(3, 2, 4, 2), start = edge(m, 0, 1)
  const selected = new Set([0])
  assert.equal(selected.size, 1)
  assert.ok(ringOf(m, start).faces.length > 1)
  assert.equal(loopCutLines(m, start).length, ringOf(m, start).faces.length)
})

test('La selección fuera de la arista inicial tampoco la invalida', () => {
  const m = grid(4, 2, 4, 2), selected = new Set([2, 3, 6]), start = edge(m, 0, 1)
  assert.equal(selected.size, 3)
  const previous = m.f.length, ring = ringOf(m, start)
  assert.ok(validLoopCutRing(m, start))
  assert.equal(loopCutLines(m, start).length, ring.faces.length)
  assert.ok(loopCut(m, start))
  assert.equal(m.f.length, previous + ring.faces.length)
})

test('Las caras desconectadas de la selección no originan cortes extra', () => {
  const m = grid(4, 2, 4, 2), disconnected = new Set([0, 1, 7]), start = edge(m, 0, 1)
  assert.equal(disconnected.size, 3)
  const ring = ringOf(m, start)
  assert.equal(loopCutLines(m, start).length, ring.faces.length)
  const n = m.f.length
  loopCut(m, start)
  assert.equal(m.f.length, n + ring.faces.length)
})

test('Las caras que solo comparten un vértice no alteran el anillo', () => {
  const m = grid(2, 2, 2, 2), selected = new Set([0, 3]), start = edge(m, 0, 1)
  assert.equal(selected.size, 2)
  const ring = ringOf(m, start)
  assert.ok(ring.faces.length > 0)
  assert.equal(loopCutLines(m, start).length, ring.faces.length)
})

test('Rotar los índices de los quads mantiene la conectividad del corte', () => {
  const m = grid(4, 2, 4, 2)
  m.f[1].push(m.f[1].shift())
  m.f[2].unshift(m.f[2].pop())
  const start = edge(m, 0, 1), ring = ringOf(m, start)
  assert.equal(loopCutLines(m, start, 2, .3).length, ring.faces.length * 2)
  assert.ok(loopCut(m, start, 2, .3))
  assertNoDanglingEdges(m)
})

test('Cortar el cubo conserva volumen y malla manifold aunque haya caras seleccionadas', () => {
  const m = make('cube'), selected = new Set([0, 5, 1]), start = edge(m, 0, 0)
  assert.equal(selected.size, 3)
  const volume = signedVolume(m)
  assert.equal(ringOf(m, start).faces.length, 4)
  assert.ok(loopCut(m, start, 2, .3))
  assert.deepEqual(checkClosed(m), [])
  assert.ok(near(signedVolume(m), volume))
})

test('Un triángulo interrumpe el avance continuo por quads', () => {
  const m = grid(4, 2, 4, 2), start = edge(m, 0, 1)
  m.f[1].pop()
  const before = JSON.stringify({ v: m.v, f: m.f })
  assert.ok(validLoopCutRing(m, start))
  assert.ok(ringOf(m, start).faces.length < 4)
  assert.equal(loopCutLines(m, start).length, ringOf(m, start).faces.length)
  assert.equal(JSON.stringify({ v: m.v, f: m.f }), before)
})

test('Seleccionar toda la rejilla no expande ni cambia un anillo transversal', () => {
  const m = grid(3, 2, 3, 1), selected = new Set(m.f.map((_, fi) => fi)), start = edge(m, 0, 1)
  assert.equal(selected.size, 3)
  assert.equal(loopCutLines(m, start).length, ringOf(m, start).faces.length)
})

test('El cubo conserva Loop Cut global aun con todas sus caras seleccionadas', () => {
  const m = make('cube'), start = edge(m, 0, 0), selected = new Set(m.f.map((_, fi) => fi))
  assert.equal(selected.size, 6)
  assert.equal(loopCutLines(m, start, 1, .2).length, 4)
})

test('UV, pintura, pesos y persistencia sobreviven al anillo completo', () => {
  const m = grid(3, 3, 4, 2), start = edge(m, 0, 1)
  m.ensureUV()
  m.colors = m.v.map(() => [.2, .4, .6])
  m.weights = m.v.map(() => [1, 0, 0, 0, 0, 0, 0, 0])
  const base = m.clone(), selection = new Sel()
  selection.f = new Set([0, 1, 2]); normalize(m, selection, 'face')
  const count = ringOf(m, start).faces.length
  assert.equal(loopCutOp(m, selection, 'face', { key: start, cuts: 2, slide: .2 }), undefined)
  m.reconcileAttributes(base)
  assert.equal(m.f.length, base.f.length + count * 2)
  assert.equal(m.uv.length, m.f.length)
  assert.ok(m.uv.every((loop, fi) => loop.length === m.f[fi].length))
  assert.equal(m.colors.length, m.v.length)
  assert.equal(m.weights.length, m.v.length)
  const saved = PolyMesh.fromJSON(JSON.parse(JSON.stringify(m.toJSON())))
  assert.deepEqual(saved.f, m.f)
  assert.equal(saved.v.length, m.v.length)
  assertNoDanglingEdges(saved)
  assert.deepEqual(PolyMesh.fromJSON(base.toJSON()).f, base.f)
})
