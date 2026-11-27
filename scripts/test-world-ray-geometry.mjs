import assert from 'node:assert/strict'
import test from 'node:test'
import { BackSide, DoubleSide, Group, Layers, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Ray, Vector3 } from 'three'
import { buildBvh } from '../src/engine/runtime/bake/geometry-bvh.js'
import { collectRayMeshes, rayMeshesSignature, snapshotRayMesh } from '../src/engine/runtime/render/world-ray-geometry.js'

test('el BVH incluye superficies fuera de cámara y un obstáculo más cercano bloquea al emisor', () => {
  const world = new Group()
  const emitter = new Mesh(new PlaneGeometry(10, 10), new MeshBasicMaterial({ color: 0xff0000, side: DoubleSide }))
  emitter.position.z = 4
  const blocker = new Mesh(new PlaneGeometry(10, 10), new MeshBasicMaterial({ color: 0x000000 }))
  blocker.position.z = 2
  const hidden = blocker.clone()
  hidden.position.z = 1
  hidden.visible = false
  world.add(emitter, blocker, hidden)
  const meshes = collectRayMeshes(world, new Layers())
  assert.deepEqual(meshes.map(entry => entry.mesh), [emitter, blocker])
  const packet = meshes.map(snapshotRayMesh)
  assert.deepEqual(packet[0].color, [0, 0, 0])
  assert.deepEqual(packet[0].emission, [1, 0, 0, 1])
  const result = buildBvh(packet)
  try {
    assert.equal(result.tris, 4)
    const ray = new Ray(new Vector3(0, 0, 0), new Vector3(0, 0, 1))
    assert.equal(result.bvh.raycastFirst(ray, DoubleSide).point.z, 2)
  } finally {
    for (const resource of [result.geometry, result.uni, result.albTex, result.emissionTex]) resource.dispose()
  }
})

test('detecta cambios de escena y preserva el lado de las mallas espejadas', () => {
  const world = new Group()
  const emitter = new Mesh(new PlaneGeometry(2, 2), new MeshStandardMaterial({ side: BackSide }))
  world.add(emitter)
  const normal = collectRayMeshes(world, new Layers())
  const signature = rayMeshesSignature(normal)
  const back = snapshotRayMesh(normal[0])
  emitter.scale.x = -1
  emitter.position.z = 3
  const mirrored = collectRayMeshes(world, new Layers())
  assert.notEqual(rayMeshesSignature(mirrored), signature)
  const snapshot = snapshotRayMesh(mirrored[0])
  assert.deepEqual([...snapshot.index], [...emitter.geometry.index.array])
  assert.deepEqual([...back.index].slice(0, 3), [snapshot.index[0], snapshot.index[2], snapshot.index[1]])
  assert.equal(snapshot.matrix[14], 3)
})

test('el paquete de reflejos usa rugosidad y reflectancia sin alterar el paquete de horneado', () => {
  const world = new Group()
  const mirror = new Mesh(new PlaneGeometry(2, 2), new MeshStandardMaterial({ color: 0xff0000, metalness: 1, roughness: 0.2 }))
  world.add(mirror)
  const entries = collectRayMeshes(world, new Layers())
  const packet = snapshotRayMesh(entries[0])
  assert.deepEqual(packet.surface, [1, 0, 0, 0.2])
  const bake = buildBvh([packet])
  const runtime = buildBvh([packet], true)
  try {
    assert.equal(bake.surfaceTex, null)
    assert.ok(runtime.surfaceTex.image.data instanceof Float32Array)
    assert.ok(Math.abs(runtime.surfaceTex.image.data[3] - 0.2) < 1e-5)
    const original = rayMeshesSignature(entries)
    mirror.material.roughness = 0.9
    assert.notEqual(rayMeshesSignature(entries), original)
  } finally {
    for (const result of [bake, runtime]) {
      for (const item of [result.geometry, result.uni, result.albTex, result.emissionTex, result.surfaceTex]) item?.dispose()
    }
  }
})
