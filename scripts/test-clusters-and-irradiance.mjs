import assert from 'node:assert/strict'
import test from 'node:test'
import { Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three'
import { packGpuClusters } from '../src/engine/runtime/render/gpu-cluster-data.js'
import { buildMeshClusters, partitionTriangles } from '../src/engine/runtime/render/mesh-clusters.js'
import { serializeLodGeometry } from '../src/engine/runtime/render/lodgeo.js'
import { boundsOfIrradianceWorld, layoutIrradiance } from '../src/engine/runtime/render/irradiance-layout.js'

test('la partición conserva todos los triángulos y las páginas tienen LOD independiente', async () => {
  const geometry = new PlaneGeometry(8, 6, 40, 32)
  const data = serializeLodGeometry(geometry)
  const triangles = index => {
    const keys = []
    for (let i = 0; i < index.length; i += 3) keys.push(index.slice(i, i + 3).join('/'))
    return keys.sort()
  }
  const parts = partitionTriangles(data)
  assert.ok(parts.length > 2)
  assert.ok(parts.every(part => part.length <= 768 * 3))
  assert.deepEqual(parts.flatMap(triangles).sort(), triangles(data.index))
  const pages = await buildMeshClusters(data)
  assert.equal(pages.length, parts.length)
  assert.equal(pages.reduce((sum, [part]) => sum + part.triangles, 0), data.index.length / 3)
  for (const [index, page] of pages.entries()) {
    assert.ok(page.length > 1)
    const bounds = new Box3().setFromArray(page[0].position)
    for (const level of page) assert.ok(bounds.containsBox(new Box3().setFromArray(level.position)))
    assert.equal(page[0].triangles, parts[index].length / 3)
  }
})

test('el atlas cubre toda la geometría visible cargada con un presupuesto acotado', () => {
  const world = new Group()
  const solid = new Mesh(new BoxGeometry(24, 4, 12), new MeshBasicMaterial())
  solid.position.set(60, 20, -45)
  const group = new Group()
  group.position.set(10, 0, 0)
  world.add(group)
  group.add(solid)
  const hidden = solid.clone()
  hidden.visible = false
  hidden.position.x = 2000
  group.add(hidden)
  const bounds = boundsOfIrradianceWorld(world)
  assert.deepEqual(bounds.getCenter(new Vector3()).toArray(), [70, 20, -45])
  const atlas = layoutIrradiance('scene', new Vector3(), bounds)
  assert.deepEqual(atlas.center, [70, 20, -45])
  assert.ok(atlas.size[0] > 24)
  const large = layoutIrradiance('scene', new Vector3(), new Box3(new Vector3(-4000, -50, -2500), new Vector3(4000, 250, 1500)))
  assert.ok(large.resolution.every(axis => axis >= 3))
  assert.ok(large.resolution.reduce((product, axis) => product * axis, 1) <= 96)
  assert.deepEqual(layoutIrradiance('scene', new Vector3(1, 2, 3), new Box3()).center, [1, 2, 3])
})

test('el paquete WebGPU conserva los rangos por nivel y limita la salida al original', async () => {
  const source = serializeLodGeometry(new PlaneGeometry(10, 8, 50, 42))
  const pages = await buildMeshClusters(source)
  const packed = packGpuClusters(pages)
  const ranges = new Uint32Array(packed.metadata.buffer)
  let vertex = 0, offset = 0
  assert.equal(packed.maxOutput, source.index.length)
  for (let c = 0; c < pages.length; c++) {
    const levels = pages[c]
    assert.equal(ranges[c * 16 + 10], levels.length)
    const radius = packed.metadata[c * 16 + 3]
    assert.ok(radius > 0)
    for (let l = 0; l < levels.length; l++) {
      const level = levels[l]
      assert.equal(ranges[c * 16 + 4 + l * 2], offset)
      assert.equal(ranges[c * 16 + 5 + l * 2], level.index.length)
      assert.deepEqual(packed.source.slice(offset, offset + level.index.length), level.index.map(i => i + vertex))
      if (l) assert.ok(Math.abs(packed.metadata[c * 16 + 11 + l] - level.error) < 1e-5)
      offset += level.index.length
      vertex += level.position.length / 3
    }
  }
  assert.equal(offset, packed.source.length)
})
