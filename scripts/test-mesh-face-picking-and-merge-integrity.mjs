import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { grid, cube } from '../src/engine/runtime/mesh/generators.js'
import { PolyMesh } from '../src/engine/runtime/mesh/polymesh.js'
import { Sel, normalize } from '../src/core/mesh/sel.js'
import { mergeSelectedFaces } from '../src/core/mesh/ops-edit.js'
import { polyBuffers } from '../src/engine/runtime/mesh/buffers.js'

const selected = (mesh, ids) => {
  const sel = new Sel()
  sel.f = new Set(ids)
  normalize(mesh, sel, 'face')
  return sel
}

function pickFaceMethod() {
  const src = readFileSync(new URL('../src/core/mesh/session-pick.js', import.meta.url), 'utf8')
  const match = src.match(/  _pickFace\(x, y\) \{[\s\S]*?\n  \},/)
  assert.ok(match, 'La prueba debe ejecutar el método original de selección')
  return runInNewContext(`({${match[0].replace(/,\s*$/, '')}})._pickFace`)
}

function pickFixture(faceMap, faceIndex, count = 3) {
  const body = { geometry: { index: { count: count * 3 }, userData: faceMap == null ? {} : { faceOf: faceMap } } }
  const state = { body, ray: {}, hitIndex: faceIndex, rebuilds: 0, calls: 0 }
  const ctx = {
    body,
    poly: { f: Array.from({ length: 6 }, () => [0, 1, 2]), faceHidden: () => false },
    _ray: () => state.ray,
    rc: {
      ray: { copy: (ray) => { assert.equal(ray, state.ray) } },
      intersectObject: (mesh) => { assert.equal(mesh, state.body); state.calls++; return state.hitIndex == null ? [] : [{ faceIndex: state.hitIndex }] },
    },
    _rebuildBody() {
      state.rebuilds++
      state.body.geometry = { index: { count: 9 }, userData: { faceOf: Int32Array.from([1, 2, 4]) } }
    },
  }
  return { ctx, state, run: () => pickFaceMethod().call(ctx, 20, 30) }
}

test('FP-01: selecciona cara a partir del mapa de triángulos válido', () => {
  const f = pickFixture(Int32Array.from([1, 3, 5]), 1)
  assert.equal(f.run(), 3)
  assert.equal(f.state.rebuilds, 0)
  assert.equal(f.state.calls, 1)
})

test('FP-02: repara automáticamente el mapa ausente antes de seleccionar', () => {
  const f = pickFixture(null, 1)
  assert.equal(f.run(), 2)
  assert.equal(f.state.rebuilds, 1)
  assert.equal(f.state.calls, 2)
})

test('FP-03: mapa con longitud obsoleta exige reconstrucción y nuevo raycast', () => {
  const f = pickFixture(Int32Array.from([5]), 2)
  assert.equal(f.run(), 4)
  assert.equal(f.state.rebuilds, 1)
})

test('FP-04: índice de cara inválido no genera TypeError ni selección falsa', () => {
  const f = pickFixture(null, 137)
  assert.equal(f.run(), null)
  assert.equal(f.state.rebuilds, 1)
})

test('FP-05: un rayo sin intersección no altera geometría', () => {
  const f = pickFixture(null, null)
  assert.equal(f.run(), null)
  assert.equal(f.state.rebuilds, 0)
})

test('FP-06: mapa válido con referencia a cara eliminada se reconstruye', () => {
  const f = pickFixture(Int32Array.from([1, 9, 4]), 1)
  assert.equal(f.run(), 2)
  assert.equal(f.state.rebuilds, 1)
})

test('FP-07: números altos de triángulos mapean a caras después de fusionar', () => {
  const mesh = grid(8, 8, 12, 12), sel = selected(mesh, [0, 1])
  assert.equal(mergeSelectedFaces(mesh, sel, 'face'), undefined)
  const buffers = polyBuffers(mesh, { includeHidden: false })
  const map = buffers.faceOf
  assert.ok(map.length > 137)
  for (const i of [0, 13, 113, 119, 134, 136, 137]) {
    assert.ok(map[i] >= 0 && map[i] < mesh.f.length)
    assert.ok(mesh.f[map[i]].length >= 3)
  }
  assert.equal(mesh.f.length, 143)
})

test('FP-08: tras guardar y reabrir la malla la correspondencia es válida', () => {
  const m = grid(4, 4, 4, 4)
  const s = selected(m, [0, 1])
  assert.equal(mergeSelectedFaces(m, s, 'face'), undefined)
  const restored = PolyMesh.fromJSON(m.toJSON())
  const buffers = polyBuffers(restored)
  assert.ok([...buffers.faceOf].every((fi) => fi >= 0 && fi < restored.f.length))
})

test('FC-01: dos caras sin conexión en índices pero unidas visualmente explican el problema', () => {
  const m = grid(2, 1, 2, 1)
  m.f[1] = m.f[1].map((v) => { m.v.push([...m.v[v]]); return m.v.length - 1 })
  const s = selected(m, [0, 1]), original = m.toJSON(), originalSel = s.toJSON()
  assert.match(mergeSelectedFaces(m, s, 'face'), /aristas usan vértices distintos/)
  assert.deepEqual(m.toJSON().f, original.f)
  assert.deepEqual(s.toJSON(), originalSel)
})

test('FC-02: compartir únicamente un vértice no supone compartir arista', () => {
  const m = new PolyMesh([[0,0,0], [1,0,0], [0,1,0], [-1,0,0], [0,-1,0]], [[0,1,2], [0,3,4]])
  const s = selected(m, [0, 1])
  assert.match(mergeSelectedFaces(m, s, 'face'), /comparten vértices/)
  assert.equal(m.f.length, 2)
})

test('FC-03: caras realmente distantes se rechazan sin alterar geometría', () => {
  const m = grid(4, 1, 4, 1)
  const s = selected(m, [0, 3]), before = m.toJSON()
  assert.match(mergeSelectedFaces(m, s, 'face'), /no están conectadas/)
  assert.deepEqual(m.f, before.f)
})

test('FC-04: caras contiguas correctas siguen fusionándose', () => {
  const m = grid(2, 1, 2, 1), s = selected(m, [0, 1])
  assert.equal(mergeSelectedFaces(m, s, 'face'), undefined)
  assert.equal(m.f.length, 1)
  assert.deepEqual([...s.f], [0])
})

test('FC-05: aristas con orientaciones no coplanares no se fusionan', () => {
  const m = cube(), s = selected(m, [0, 2]), before = m.toJSON()
  assert.match(mergeSelectedFaces(m, s, 'face'), /coplanar/)
  assert.deepEqual(m.f, before.f)
})


test('FC-06: unión en T entre caras explica el corte desalineado sin soldar', () => {
  const m = new PolyMesh(
    [[0,0,0], [1,0,0], [1,2,0], [0,2,0], [2,0,0], [2,1,0], [1,1,0]],
    [[0,1,2,3], [1,4,5,6]],
  )
  const s = selected(m, [0, 1]), original = m.toJSON(), originalSel = s.toJSON()
  assert.match(mergeSelectedFaces(m, s, 'face'), /unión en T/)
  assert.deepEqual(m.toJSON().f, original.f)
  assert.deepEqual(s.toJSON(), originalSel)
})
