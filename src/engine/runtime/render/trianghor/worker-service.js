import { createIncrementalTriangHorWorkerClient, requestTriangHorBake } from 'trianghor'

const resident = new Map()
const MAX_WARM_WORKERS = 1

function snapshot(terrain, settings) {
  return {
    heights: new Float32Array(terrain.heights),
    splat: terrain.splat == null ? null : new Uint8Array(terrain.splat),
    nx: terrain.segments, nz: terrain.segmentsZ,
    channels: 8, settings,
  }
}

function available(terrain, makeWorker) {
  const existing = resident.get(terrain)
  if (existing) {
    resident.delete(terrain)
    resident.set(terrain, existing)
    return existing
  }
  if (resident.size >= MAX_WARM_WORKERS) {
    const idle = [...resident].find(([,entry]) => !entry.busy)
    if (!idle) return null
    const [key, old] = idle
    old.client.dispose()
    resident.delete(key)
  }
  const entry = {
    busy: false,
    client: createIncrementalTriangHorWorkerClient({
      makeWorker, regionCells: 16, maxBytes: 16 * 1024 * 1024,
    }),
  }
  resident.set(terrain, entry)
  return entry
}

function validatePlan(plan, terrain) {
  const sourceTriangles = 2 * terrain.segments * terrain.segmentsZ
  if (!plan || plan.sourceTriangles !== sourceTriangles ||
      !Number.isSafeInteger(plan.triangles) || plan.triangles < 0 ||
      plan.triangles > sourceTriangles ||
      (plan.index != null && (!(plan.index instanceof Uint32Array) ||
        plan.index.length !== 3 * plan.triangles)) ||
      (plan.index == null && plan.triangles !== sourceTriangles))
    throw new Error('TriangHor: plan incompatible')
  if (plan.index) {
    const vertices = (terrain.segments + 1) * (terrain.segmentsZ + 1)
    for (const i of plan.index) if (i >= vertices)
      throw new Error('TriangHor: índice fuera del terreno')
  }
  return plan
}

export async function runTerrainBake(terrain, settings, signal, onProgress, makeWorker) {
  if (signal?.aborted) throw new Error('TriangHor cancelado')
  const input = snapshot(terrain, settings)
  if (onProgress) return validatePlan(await requestTriangHorBake(input, { makeWorker, signal, onProgress }), terrain)
  const entry = available(terrain, makeWorker)
  if (!entry || entry.busy) return validatePlan(await requestTriangHorBake(input, { makeWorker, signal }), terrain)
  entry.busy = true
  try { return validatePlan(await entry.client.bake(input, { signal }), terrain) }
  catch (error) {
    entry.client.dispose()
    if (resident.get(terrain) === entry) resident.delete(terrain)
    throw error
  } finally { entry.busy = false }
}

export function releaseTerrainBakeWorker(terrain) {
  const entry = resident.get(terrain)
  if (!entry) return
  entry.client.dispose()
  resident.delete(terrain)
}
