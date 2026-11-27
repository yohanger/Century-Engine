import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { WATER_DEFAULTS, resolveWaterBudgets, waterBodySearchBounds } from '../src/engine/runtime/fluids/water-policy.js'
import { Vec3 } from '../vendor/century-fluids/dist/index.js'
import { createWaterWorld } from '../vendor/century-fluids/dist/fluids/water/index.js'
import { VoxelSurfaceCache } from '../vendor/century-fluids/dist/surface/index.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = name => readFileSync(resolve(root, name), 'utf8')
const box = (min, max) => ({ min: Vec3.of(...min), max: Vec3.of(...max) })

test('agua nueva: configuración ligera compartida por nodo, Inspector y Runtime', () => {
  assert.deepEqual(resolveWaterBudgets([{}]), {
    cellSizeMeters: WATER_DEFAULTS.cellSize, maxCells: WATER_DEFAULTS.maxCells, maxTriangles: WATER_DEFAULTS.maxTriangles,
  })
  assert.equal(WATER_DEFAULTS.cellSize, 0.4)
  assert.ok(WATER_DEFAULTS.maxCells < 40000 && WATER_DEFAULTS.maxTriangles < 65000)
  const node = read('src/engine/runtime/nodes/water.js')
  const inspector = read('src/components/Inspector.vue')
  const runtime = read('src/engine/runtime/fluids/century-water.js')
  assert.match(node, /type: 'water'/)
  assert.match(node, /props: \{ \.\.\.WATER_DEFAULTS \}/)
  for (const name of ['cellSize', 'maxCells', 'maxTriangles']) assert.match(inspector, new RegExp(`WATER_DEFAULTS\\.${name}`))
  assert.match(runtime, /resolveWaterBudgets\(water\)/)
  assert.doesNotMatch(node, /fluidwater3d/)
})

test('configuraciones explícitas y nodos históricos no se reescriben', () => {
  const historical = { type: 'water', props: { cellSize: .25, maxCells: 40000, maxTriangles: 65000 } }
  const before = structuredClone(historical)
  assert.deepEqual(resolveWaterBudgets([historical]), {
    cellSizeMeters: .25, maxCells: 40000, maxTriangles: 65000,
  })
  assert.deepEqual(historical, before)
  const mixed = resolveWaterBudgets([historical, { props: {} }])
  assert.equal(mixed.cellSizeMeters, .25)
  assert.equal(mixed.maxCells, WATER_DEFAULTS.maxCells)
  assert.equal(mixed.maxTriangles, WATER_DEFAULTS.maxTriangles)
  assert.match(read('src/engine/runtime/scene/objects.js'), /fluidcontainer3d/)
})

test('bodies: el área de interés incluye desplazamiento y un margen voxelizado', () => {
  const position = { x: 0, y: 3, z: 0 }, size = { x: 1, y: 2, z: 1 }
  const stationary = waterBodySearchBounds(position, size, [0, 0, 0], 1/60, 0.4)
  const falling = waterBodySearchBounds(position, size, [0, -90, 0], 1/60, 0.4)
  assert.ok(falling.min[1] < stationary.min[1])
  assert.ok(falling.max[1] > stationary.max[1])
  const longBody = waterBodySearchBounds(position, { x: 8, y: .2, z: .2 }, [0,0,0], 1/60, .4)
  assert.ok(longBody.min[1] < 0, 'una caja larga rotada puede alcanzar el agua bajo el pivote')
  assert.equal(waterBodySearchBounds(position, size, null, 1/60, .4), null)
  assert.equal(waterBodySearchBounds(position, { x: 0, y: 1, z: 1 }, [0,0,0], 1/60, .4), null)
})

test('la consulta espacial evita acoplar cuerpos secos y conserva los próximos al agua', () => {
  const water = createWaterWorld({ voxels: { cellSizeMeters: WATER_DEFAULTS.cellSize, maxCells: WATER_DEFAULTS.maxCells } })
  try {
    water.fillBox(box([0,0,0],[2,.8,2]), 1.6)
    const size = { x: .5, y: .5, z: .5 }
    const far = waterBodySearchBounds({ x: 40, y: 40, z: 40 }, size, [0,0,0], 1/60, water.cellSizeMeters)
    const near = waterBodySearchBounds({ x: 1, y: .4, z: 1 }, size, [0,0,0], 1/60, water.cellSizeMeters)
    assert.equal(water.volumeInBox(box(far.min, far.max)), 0)
    assert.ok(water.volumeInBox(box(near.min, near.max)) > 0)
  } finally { water.shutdown() }
})

test('menor resolución por defecto: menos celdas para el mismo volumen y superficie real', () => {
  const create = cell => createWaterWorld({ voxels: { cellSizeMeters: cell, maxCells: 40000, sleepAtRest: true } })
  const fine = create(.25), light = create(WATER_DEFAULTS.cellSize)
  try {
    const volume = box([0,0,0],[3,1.5,3])
    for (const world of [fine, light]) {
      const filled = world.fillBox(volume, 9.45)
      assert.ok(Math.abs(filled - 9.45) < 1e-7)
    }
    assert.ok(light.occupiedCellCount < fine.occupiedCellCount)
    const surface = new VoxelSurfaceCache().update(light, {
      maxTriangles: WATER_DEFAULTS.maxTriangles, maxChunks: 100, timeBudgetMs: Infinity,
    })
    assert.equal(surface.pending, false)
    assert.ok(surface.triangles > 0)
    assert.ok(surface.triangles <= WATER_DEFAULTS.maxTriangles)
    assert.equal(new VoxelSurfaceCache().update(light, { maxTriangles: WATER_DEFAULTS.maxTriangles }).pending, false)
  } finally { fine.shutdown(); light.shutdown() }
})

test('reposo voxel existente permanece activo y las actualizaciones de superficie usan revisiones', () => {
  const runtime = read('src/engine/runtime/fluids/century-water.js')
  assert.match(runtime, /sleepAtRest: true/)
  assert.match(runtime, /else if \(this\.world\.needsStep\) this\.world\.step\(dt\)/)
  assert.match(runtime, /this\.renderedRevision === this\.world\.revision/)
  assert.match(runtime, /this\.surfacePending = result\.pending/)
  assert.match(runtime, /this\.syncDynamics\(dt\)/)
  assert.match(runtime, /shapesByBody/)
  assert.doesNotMatch(runtime, /\.jolt\.Step\(/)
})
