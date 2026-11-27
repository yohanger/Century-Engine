import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'
import { Group } from 'three'
import { chunkDistance, includeStreamingScenes, normalizeChunk } from '../src/engine/runtime/streaming/config.js'
import { WorldStreamer } from '../src/engine/runtime/streaming/streamer.js'
import { createSceneStreamer } from '../src/engine/runtime/streaming/scene.js'
import { makeObject } from '../src/engine/runtime/nodes/index.js'
import { Terrain } from '../src/engine/runtime/geometry/terrain.js'
import { JoltWorld, loadJolt } from '../src/engine/runtime/physics/jolt.js'
import { readPackage, readPackageEntries, writePackage } from '../src/engine/runtime/package/format.js'
import staging from '../electron/stream-package.cjs'

const point = x => ({ x, y: 0, z: 0 })
const tick = () => new Promise(resolve => setImmediate(resolve))

test('el rango comienza en el borde del chunk y puede incluir el eje vertical', () => {
  const chunk = normalizeChunk({ x: -50, width: 20, depth: 10 })
  assert.equal(chunkDistance(chunk, { x: -38, y: 1000, z: 0 }), 2)
  assert.equal(chunkDistance({ ...chunk, height: 10 }, { x: -50, y: 20, z: 0 }), 15)
})

test('intercambia LOD, conserva el chunk fuera del borde y libera recursos tras la demora', async () => {
  const events = []
  const chunk = normalizeChunk({ sceneId: 'near', distantSceneId: 'far', width: 20,
    preload: 15, distantRange: 100, unloadMargin: 5, unloadDelay: 2 })
  const streamer = new WorldStreamer({
    chunks: [chunk], parallel: 1,
    async prepare(id) { return { id, release: () => events.push(['release', id]) } },
    mount({ id }) {
      return { show: value => events.push(['visible', id, value]), dispose: () => events.push(['dispose', id]) }
    },
  })
  streamer.update(point(65), 0)
  await tick()
  assert.deepEqual(events.at(-1), ['visible', 'far', true])
  await streamer.settleNearby(point(0), 1)
  assert.deepEqual(events.at(-1), ['visible', 'far', false])
  streamer.update(point(28), 2)
  streamer.update(point(35), 3)
  streamer.update(point(35), 4)
  assert.deepEqual(events.at(-1), ['visible', 'far', false])
  streamer.update(point(35), 5)
  assert.deepEqual(events.slice(-3), [['dispose', 'near'], ['release', 'near'], ['visible', 'far', true]])
  streamer.close()
  assert.deepEqual(events.slice(-2), [['dispose', 'far'], ['release', 'far']])
})

test('una lectura terminada después de salir de Play libera recursos y no monta un chunk', async () => {
  let complete
  let released = 0
  const streamer = new WorldStreamer({
    chunks: [normalizeChunk({ sceneId: 'near' })], parallel: 1,
    prepare: () => new Promise(resolve => { complete = resolve }),
    mount() { assert.fail('El chunk se montó después de cerrar') },
  })
  streamer.update(point(0), 0)
  await tick()
  streamer.close()
  complete({ release: () => released++ })
  await tick()
  assert.equal(released, 1)
})

test('monta terreno, mallas y colisiones en las coordenadas del chunk y las descarga juntas', async () => {
  const terrain = new Terrain(12, 8)
  const data = terrain.serialize()
  terrain.dispose()
  const objects = [
    makeObject('staticbody3d', '', { id: 'wall', name: 'wall', position: [4, 2, 0] }),
    makeObject('collisionshape3d', 'box', { id: 'box', parentId: 'wall', props: { shape: { type: 'BoxShape3D', size: [2, 2, 2] } } }),
    makeObject('primitive', 'box', { id: 'mesh', parentId: 'wall' }),
    makeObject('characterbody3d', 'characterbody3d', { id: 'other-player', position: [8, 2, 0] }),
    makeObject('collisionshape3d', 'capsule', { id: 'player-shape', parentId: 'other-player' }),
  ]
  const phys = new JoltWorld(await loadJolt())
  const world = new Group()
  const graph = { streamedTerrains: new Set(), vp: { world, requestRender() {}, invalidateShadows() {} },
    host: { view: {} }, _ctx: () => ({}), _applyShadowFlags() {} }
  const project = { activeSceneId: 'base', scenes: [{ id: 'base', streaming: {
    enabled: true, chunks: [{ sceneId: 'chunk', x: 100, width: 12, depth: 12, preload: 0, unloadMargin: 0, unloadDelay: 0 }],
  } }] }
  const errors = []
  const streamer = createSceneStreamer({
    project, phys, ed: graph, colliders: [], rt: { readStreamScene: async () => ({ objects, terrain: data }),
      log: msg => errors.push(msg) },
  }, 3)
  try {
    await streamer.settleNearby(point(100), 0)
    assert.deepEqual(errors, [])
    assert.equal(world.children[0].position.x, 100)
    assert.equal(graph.streamedTerrains.size, 1)
    assert.ok(phys.raycast([100, 10, 0], [0, -1, 0], 20))
    assert.ok(phys.raycast([104, 2, -5], [0, 0, 1], 10))
    assert.equal(phys.nodeHandles.size, 1)
    assert.equal(project.activeSceneId, 'base')
    streamer.update(point(200), 1)
    assert.equal(world.children.length, 0)
    assert.equal(graph.streamedTerrains.size, 0)
    assert.equal(phys.nodeHandles.size, 0)
    assert.equal(phys.terrain.length, 0)
    assert.equal(phys.raycast([100, 10, 0], [0, -1, 0], 20), null)
  } finally { streamer.close(); phys.dispose() }
})

test('conserva el formato ZIP para proyectos clásicos y deja entradas individuales para el exportador', async () => {
  const scenes = [
    { id: 'base', name: 'Base', streaming: { enabled: true, chunks: [{ sceneId: 'near', distantSceneId: 'far' }] } },
    { id: 'near', name: 'Detalle' }, { id: 'far', name: 'Vista lejana' },
  ]
  assert.deepEqual(includeStreamingScenes(scenes, ['base']), ['base', 'near', 'far'])
  const bytes = await writePackage({ data: { scenes, assets: [{ id: 'tex', name: 'tex.png' }] },
    scenes: scenes.map(scene => ({ ...scene, data: { name: scene.name } })), files: new Map([['tex', Uint8Array.of(4, 5)]]) })
  const zip = await readPackage(bytes)
  assert.equal(zip.game.scenes[0].streaming.chunks[0].distantSceneId, 'far')
  assert.deepEqual(await zip.scene('far'), { name: 'Vista lejana' })
  const paths = new Map()
  await staging.stageEntries(bytes, (name, file) => paths.set(name, file), async () => {
    const opened = []
    const entry = async (name, encoding) => { opened.push(name); return readFile(paths.get(name), encoding) }
    const game = await readPackageEntries({
      game: () => entry('game.json', 'utf8'),
      scene: id => entry(`scene-${id}.json`, 'utf8'),
      file: id => entry(`asset-${id}.bin`),
    })
    assert.deepEqual(opened, ['game.json'])
    assert.deepEqual(await game.scene('near'), { name: 'Detalle' })
    assert.deepEqual(await game.file('tex'), Uint8Array.of(4, 5))
    assert.deepEqual(opened, ['game.json', 'scene-near.json', 'asset-tex.bin'])
  })
  await assert.rejects(access(paths.get('game.json')), { code: 'ENOENT' })
})
