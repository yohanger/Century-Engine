import test from 'node:test'
import assert from 'node:assert/strict'
import { cube, grid } from '../src/engine/runtime/mesh/generators.js'
import { PolyMesh, checkClosed, signedVolume, ekey } from '../src/engine/runtime/mesh/polymesh.js'
import { Sel, normalize } from '../src/core/mesh/sel.js'
import { extrudeIndividual } from '../src/core/mesh/ops-edit.js'
import { subdivide } from '../src/core/mesh/ops-fill.js'
import { loopCut, loopCutLines, ringOf, validLoopCutRing } from '../src/core/mesh/cuts.js'
import { loopCutOp } from '../src/core/mesh/ops.js'

const edge = (mesh, face = 0, i = 0) => ekey(mesh.f[face][i], mesh.f[face][(i + 1) % mesh.f[face].length])
const selected = (mesh, faces) => {
  const selection = new Sel()
  selection.f = new Set(faces)
  return normalize(mesh, selection, 'face')
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`)
const intact = (mesh) => {
  for (const face of mesh.f) {
    assert.ok(face.length >= 3 && new Set(face).size === face.length)
    for (const vi of face) assert.ok(mesh.v[vi]?.every(Number.isFinite))
  }
  for (const entry of mesh.edges().values()) assert.ok(entry.faces.length <= 2)
}

test('El anillo del cubo es independiente de seleccionar una, tres o todas sus caras', () => {
  for (const faces of [[], [0], [0, 1, 3], [0, 1, 2, 3, 4, 5]]) {
    const m = cube(), sel = selected(m, faces), k = edge(m)
    assert.equal(ringOf(m, k).faces.length, 4)
    assert.equal(loopCutLines(m, k, 1).length, 4)
    const original = signedVolume(m), before = m.f.length
    assert.equal(loopCutOp(m, sel, 'face', { key: k, cuts: 1 }), undefined)
    assert.equal(m.f.length, before + 4)
    assert.deepEqual(checkClosed(m), [])
    near(signedVolume(m), original)
  }
})

test('Una rejilla atraviesa la hilera topológica, no las tres caras seleccionadas transversales', () => {
  const m = grid(4, 2, 4, 2), k = edge(m, 0, 1), sel = selected(m, [0, 1, 2])
  const global = ringOf(m, k)
  assert.equal(global.faces.length, 2)
  assert.equal(sel.f.size, 3)
  assert.equal(loopCutLines(m, k, 1).length, 2)
  const previous = m.f.length
  loopCutOp(m, sel, 'face', { key: k, cuts: 1 })
  assert.equal(m.f.length, previous + 2)
})

test('Cortar el cubo después de extruir una cara conserva volumen y conectividad', () => {
  const m = cube(), s = selected(m, [1])
  assert.equal(extrudeIndividual(m, s, 'face', { distance: 0.8 }), undefined)
  const original = signedVolume(m), before = m.f.length
  assert.deepEqual(checkClosed(m), [])
  const candidate = [...m.edges().keys()].find((k) => ringOf(m, k)?.faces.length === 6)
  assert.ok(candidate != null)
  const preview = loopCutLines(m, candidate, 2, 0.3)
  assert.equal(preview.length, 12)
  const result = loopCut(m, candidate, 2, 0.3)
  assert.equal(result.edges.length, preview.length)
  assert.equal(m.f.length, before + 12)
  near(signedVolume(m), original)
  assert.deepEqual(checkClosed(m), [])
  intact(m)
})

test('Cortar y luego extruir funciona en el mismo recurso PolyMesh', () => {
  const m = cube(), k = edge(m)
  loopCut(m, k)
  const before = m.f.length, volume = signedVolume(m)
  const sel = selected(m, [0])
  assert.equal(extrudeIndividual(m, sel, 'face', { distance: 0.4 }), undefined)
  assert.equal(m.f.length, before + 4)
  assert.deepEqual(checkClosed(m), [])
  assert.ok(signedVolume(m) > volume)
})

test('Loop Cut se detiene en triángulos y N-gons sin recorrer otras islas', () => {
  for (const count of [3, 5]) {
    const m = grid(3, 1, 3, 1)
    if (count === 3) m.f[1].pop()
    else m.f[1].splice(1, 0, m.v.push([m.v[m.f[1][1]][0] + 0.05, 0, m.v[m.f[1][1]][2]]) - 1)
    const k = edge(m, 0, 1), ring = ringOf(m, k)
    assert.ok(ring)
    assert.equal(ring.faces.length, 1)
    assert.equal(loopCutLines(m, k).length, 1)
    const before = m.f.length
    assert.ok(loopCut(m, k))
    assert.equal(m.f.length, before + 1)
  }
})

test('Una arista no manifold no inicia Loop Cut ni modifica su geometría', () => {
  const m = cube(), first = m.f[0]
  m.f.push([...first])
  const snapshot = JSON.stringify({ v: m.v, f: m.f })
  const k = edge(m, 0)
  assert.equal(ringOf(m, k), null)
  assert.equal(validLoopCutRing(m, k), null)
  assert.deepEqual(loopCutLines(m, k), [])
  assert.equal(loopCut(m, k), null)
  assert.equal(JSON.stringify({ v: m.v, f: m.f }), snapshot)
})

test('32 cortes y slide comparten coordenadas entre preview y geometría aplicada', () => {
  const m = cube(), k = edge(m), preview = loopCutLines(m, k, 32, 0.88)
  const volume = signedVolume(m), original = m.clone()
  const result = loopCut(m, k, 32, 0.88)
  assert.equal(preview.length, 128)
  assert.equal(result.edges.length, preview.length)
  for (const vi of result.verts) assert.ok(preview.flat().some((p) => p.every((n, i) => Math.abs(n - m.v[vi][i]) < 1e-8)))
  near(signedVolume(m), volume)
  assert.deepEqual(checkClosed(m), [])
  const restored = PolyMesh.fromJSON(original.toJSON())
  assert.equal(restored.f.length, 6)
})

test('Subdividir en modo Cara afecta solo a esa cara y conserva los vecinos como polígonos', () => {
  const m = grid(3, 1, 3, 1), s = selected(m, [1])
  const before = m.f.map((f) => [...f]), previous = m.clone()
  assert.equal(subdivide(m, s, 'face', { cuts: 2 }), undefined)
  assert.equal(m.f.length, before.length + 8)
  assert.equal(s.f.size, 9)
  assert.ok(m.f.some((f) => f.includes(before[0][0]) && f.length >= 4))
  m.reconcileAttributes(previous)
  intact(m)
})

test('Dos caras seleccionadas se subdividen mientras el resto conserva su número de caras', () => {
  const m = grid(4, 1, 4, 1), s = selected(m, [1, 2])
  m.ensureUV()
  const old = m.clone()
  assert.equal(subdivide(m, s, 'face', { cuts: 1 }), undefined)
  assert.equal(m.f.length, old.f.length + 6)
  assert.equal(s.f.size, 8)
  m.reconcileAttributes(old)
  assert.equal(m.uv.length, m.f.length)
  assert.ok(m.uv.every((uv, i) => uv.length === m.f[i].length))
  intact(m)
})

test('Subdividir en cubo cerrado mantiene UV, colores, pesos, volumen y persistencia', () => {
  const m = cube(), s = selected(m, [0])
  m.ensureUV()
  m.colors = m.v.map(() => [0.6, 0.4, 0.3])
  m.weights = m.v.map(() => [1, 0, 0, 0, 0, 0, 0, 0])
  const previous = m.clone(), volume = signedVolume(m)
  assert.equal(subdivide(m, s, 'face', { cuts: 2 }), undefined)
  assert.equal(m.f.length, 14)
  assert.equal(s.f.size, 9)
  m.reconcileAttributes(previous)
  assert.equal(m.colors.length, m.v.length)
  assert.equal(m.weights.length, m.v.length)
  assert.ok(m.uv.every((uv, fi) => uv.length === m.f[fi].length))
  assert.deepEqual(checkClosed(m), [])
  near(signedVolume(m), volume)
  const saved = PolyMesh.fromJSON(JSON.parse(JSON.stringify(m.toJSON())))
  assert.deepEqual(saved.f, m.f)
})

test('La selección de subdivisión no se expande por componentes ajenos', () => {
  const m = grid(4, 1, 4, 1), s = selected(m, [0]), previous = m.f.length
  assert.equal(subdivide(m, s, 'face', { cuts: 1 }), undefined)
  assert.equal(m.f.length, previous + 3)
  assert.equal(s.f.size, 4)
  assert.deepEqual([...s.f], [0, 1, 2, 3])
})

test('Subdividir triángulo varias veces no genera caras degeneradas', () => {
  for (const cuts of [1, 2, 3]) {
    const m = new PolyMesh([[0, 0, 0], [3, 0, 0], [0, 3, 0]], [[0, 1, 2]])
    const s = selected(m, [0])
    assert.equal(subdivide(m, s, 'face', { cuts }), undefined)
    assert.equal(s.f.size, m.f.length)
    for (let i = 0; i < m.f.length; i++) assert.ok(Math.hypot(...m.faceNormalRaw(i)) > 1e-8)
  }
})

test('Subdividir N-gon convexo conserva el área sin triángulos degenerados', () => {
  const m = new PolyMesh([[0, 0, 0], [2, 0, 0], [3, 1, 0], [2, 2, 0], [0, 2, 0]], [[0, 1, 2, 3, 4]])
  const before = Math.hypot(...m.faceNormalRaw(0)), s = selected(m, [0])
  assert.equal(subdivide(m, s, 'face', { cuts: 2 }), undefined)
  assert.equal(s.f.size, m.f.length)
  const area = m.f.reduce((a, _, i) => a + Math.hypot(...m.faceNormalRaw(i)), 0)
  near(area, before)
  assert.ok(m.f.every((_, i) => Math.hypot(...m.faceNormalRaw(i)) > 1e-8))
})

test('Subdividir N-gon cóncavo se rechaza sin modificar el recurso', () => {
  const m = new PolyMesh([[0, 0, 0], [3, 0, 0], [1, 1, 0], [3, 3, 0], [0, 3, 0]], [[0, 1, 2, 3, 4]])
  const s = selected(m, [0]), before = JSON.stringify({ v: m.v, f: m.f })
  assert.match(subdivide(m, s, 'face', { cuts: 2 }), /cóncavos/)
  assert.equal(JSON.stringify({ v: m.v, f: m.f }), before)
})

test('Subdividir aristas no manifold falla sin mutaciones', () => {
  const m = cube(), f = [...m.f[0]], s = new Sel()
  m.f.push(f)
  s.f.add(0); normalize(m, s, 'face')
  const before = JSON.stringify({ v: m.v, f: m.f })
  assert.match(subdivide(m, s, 'face', { cuts: 1 }), /manifold/)
  assert.equal(JSON.stringify({ v: m.v, f: m.f }), before)
})
