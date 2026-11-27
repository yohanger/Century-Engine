import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Vec3 } from '../vendor/century-fluids/dist/index.js'
import { Quat } from '../vendor/century-fluids/dist/adapters/jolt.js'
import { createWaterWorld } from '../vendor/century-fluids/dist/fluids/water/index.js'
import { VoxelSurfaceCache } from '../vendor/century-fluids/dist/surface/index.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = path => readFileSync(resolve(root, path), 'utf8')

test('el nodo existente water es el único registro de autoría de agua', () => {
  const directory = read('src/engine/runtime/nodes/index.js')
  const definition = read('src/engine/runtime/nodes/water.js')
  assert.equal((directory.match(/import\s+['"]\.\/water\.js['"]/g) || []).length, 1)
  assert.match(definition, /type:\s*['"]water['"]/) 
  assert.match(definition, /label:\s*['"]Agua['"]/) 
  assert.doesNotMatch(directory, /water-volume|fluidwater3d|fluid-container/)
  assert.doesNotMatch(definition, /fluidwater3d|Water3D|Agua 3D/)
  assert.equal(existsSync(resolve(root, 'src/engine/runtime/nodes/water-volume.js')), false)
})

test('los registros heredados se conservan sin convertirse en otro nodo', () => {
  const scene = read('src/engine/runtime/scene/objects.js')
  const lifecycle = read('src/engine/runtime/scene/node-lifecycle.js')
  const inspector = read('src/components/Inspector.vue')
  assert.match(scene, /['"]fluidcontainer3d['"]/) 
  assert.match(lifecycle, /obj\.type !== ['"]fluidcontainer3d['"]/) 
  assert.match(inspector, /obj\.type === ['"]water['"]/) 
  assert.match(inspector, /obj\.type === ['"]fluidcontainer3d['"]/) 
  assert.doesNotMatch(inspector, /fluidwater3d|Agua 3D/)
})

test('la previsualización del nodo se oculta al jugar y vuelve al editor', () => {
  const play = read('src/engine/runtime/events/play.js')
  const level = read('src/engine/runtime/events/play-level.js')
  assert.match(play, /o\.type === ['"]water['"] && node\.userData\.waterPreview/)
  assert.match(play, /node\.userData\.visual\.visible = false/)
  assert.match(play, /this\.hidden\.push\(node\.userData\.visual\)/)
  assert.match(level, /for \(const h of this\.hidden \|\| \[\]\) h\.visible = true/)
})

test('la simulación usa una sola autoridad física y el paso Jolt existente', () => {
  const water = read('src/engine/runtime/fluids/century-water.js')
  const play = read('src/engine/runtime/events/play.js')
  const jolt = read('src/engine/runtime/physics/jolt.js')
  assert.match(water, /const WATER = ['"]water['"]/) 
  assert.match(water, /createWaterWorld\(/)
  assert.match(water, /new JoltFluidBridge\(/)
  assert.match(play, /this\.phys\.fluidRuntime = this\.water/)
  assert.match(jolt, /this\.fluidRuntime\?\.step\(dt\); this\.jolt\.Step\(dt, 1\)/)
  assert.doesNotMatch(water, /\.jolt\.Step\(/)
})

test('la biblioteca pública provee volumen, superficie y conversiones de rotación', () => {
  assert.equal(typeof Quat.of, 'function')
  const world = createWaterWorld({ voxels: { cellSizeMeters: 0.25, maxCells: 2000 } })
  try {
    const written = world.fillBox({ min: Vec3.of(0, 0, 0), max: Vec3.of(1, 1, 1) }, 0.1)
    assert.ok(Math.abs(written - 0.1) < 1e-9)
    const mesh = new VoxelSurfaceCache().update(world, { maxTriangles: 5000, maxChunks: 100 })
    assert.equal(mesh.pending, false)
    assert.ok(mesh.changes.length > 0)
    assert.ok(mesh.triangles > 0)
  } finally {
    world.shutdown()
  }
})
