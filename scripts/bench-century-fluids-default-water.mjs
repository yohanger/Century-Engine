import { performance } from 'node:perf_hooks'
import { Vec3 } from '../vendor/century-fluids/dist/index.js'
import { createWaterWorld } from '../vendor/century-fluids/dist/fluids/water/index.js'
import { VoxelSurfaceCache } from '../vendor/century-fluids/dist/surface/index.js'
import { WATER_DEFAULTS } from '../src/engine/runtime/fluids/water-policy.js'

const V = Vec3.of
const volume = { min: V(0, 0, 0), max: V(3, 1.5, 3) }
const walls = [
  [V(0, 0, 0), V(0, 1, 0)],
  [V(0, 0, 0), V(1, 0, 0)], [V(3, 0, 0), V(-1, 0, 0)],
  [V(0, 0, 0), V(0, 0, 1)], [V(0, 0, 3), V(0, 0, -1)],
]

for (const cell of [0.25, WATER_DEFAULTS.cellSize]) {
  const world = createWaterWorld({ voxels: { cellSizeMeters: cell, maxCells: 40000, maxFacesPerStep: 600000, sleepAtRest: true } })
  try {
    for (const [point, normal] of walls) world.addBoundary({ kind: 'plane', point, normal })
    const initial = world.fillBox(volume, 9.45)
    const start = performance.now()
    let facesProcessed = 0
    for (let i = 0; i < 4; i++) facesProcessed += world.step(1/60).facesProcessed
    const physicsMs = performance.now() - start
    const surface = new VoxelSurfaceCache().update(world, { maxTriangles: 65000 })
    console.log(JSON.stringify({ cellSizeMeters: cell, wetCells: world.occupiedCellCount,
      facesProcessed, physicsMs: Number(physicsMs.toFixed(2)), triangles: surface.triangles,
      massErrorKg: Number((world.totalMassKg - initial * 1000).toFixed(8)) }))
  } finally { world.shutdown() }
}
