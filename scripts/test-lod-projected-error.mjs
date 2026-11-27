import assert from 'node:assert/strict'
import test from 'node:test'
import { PlaneGeometry, SphereGeometry } from 'three'
import { serializeLodGeometry } from '../src/engine/runtime/render/lodgeo.js'
import { buildIndexedLods } from '../src/engine/runtime/render/lod-indexed.js'
import { pickErrorLod } from '../src/engine/runtime/render/lod.js'

test('los niveles indexados conservan vértices originales y exponen un error ordenado', async () => {
  const mesh = serializeLodGeometry(new SphereGeometry(1, 40, 30))
  const levels = await buildIndexedLods(mesh, [0.4, 0.16, 0.06])
  assert.equal(levels.length, 3)
  const vertices = new Set()
  for (let i = 0; i < mesh.position.length / 3; i++) {
    vertices.add([...mesh.position.slice(i * 3, i * 3 + 3), ...mesh.attrs.uv.array.slice(i * 2, i * 2 + 2)].join(','))
  }
  for (let i = 0; i < levels.length; i++) {
    const { position, attrs, triangles, error } = levels[i]
    assert.ok(triangles < (levels[i - 1]?.triangles ?? mesh.index.length / 3))
    assert.ok(error >= (levels[i - 1]?.error ?? 0))
    for (let j = 0; j < position.length / 3; j++) {
      assert.ok(vertices.has([...position.slice(j * 3, j * 3 + 3), ...attrs.uv.array.slice(j * 2, j * 2 + 2)].join(',')))
    }
  }
})

test('mantiene bordes abiertos y conserva el nivel actual cerca del umbral', async () => {
  const { position, index, attrs } = serializeLodGeometry(new PlaneGeometry(2, 2, 16, 16))
  const openEdge = positions => {
    const edge = []
    for (let i = 0; i < positions.length; i += 3) {
      if (Math.abs(positions[i]) === 1 || Math.abs(positions[i + 1]) === 1) edge.push([...positions.slice(i, i + 3)].join(','))
    }
    return edge.sort()
  }
  const [lod] = await buildIndexedLods({ position, index, attrs }, [0.16])
  assert.deepEqual(openEdge(lod.position), openEdge(position))
  const levels = [{ error: 0 }, { error: 0.05 }, { error: 0.2 }]
  assert.equal(pickErrorLod(levels, 5, 1.5, 0), 2)
  assert.equal(pickErrorLod(levels, 8, 1.5, 0), 1)
  assert.equal(pickErrorLod(levels, 8, 1.5, 2), 2)
  assert.equal(pickErrorLod(levels, 60, 1.5, 2), 0)
})
