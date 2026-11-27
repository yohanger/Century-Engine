import { computeTriangHor } from './core.js'
import { normalizeTerrainBake } from '../terrain-bake.js'
import { assertTriangHorInput } from './validate.js'

const DEFAULT_REGION_CELLS = 16
const DEFAULT_MAX_BYTES = 64 * 1024 * 1024
const sameValue = (a,b) => Object.is(a,b)
const copyPlan = plan => ({ ...plan, index: plan.index ? plan.index.slice() : plan.index,
  shape: plan.shape ? { ...plan.shape } : plan.shape })
const copyArray = values => values?.slice() ?? null

function countNodes(root) {
  if (!root) return 0
  let count = 0
  const stack = [root]
  while (stack.length) {
    const node = stack.pop()
    count++
    if (node.children) stack.push(...node.children)
  }
  return count
}

function changes(input, previousHeights, previousSplat, regionCells) {
  const { heights, splat, nx, nz, channels = 8 } = input
  const width = nx+1
  const regions = new Map()
  let changedVertices = 0
  for (let i = 0; i < heights.length; i++) {
    let different = !sameValue(heights[i], previousHeights[i])
    if (!different && splat) {
      const start = i * channels
      for (let channel = 0; channel < channels; channel++) {
        if (!sameValue(splat[start+channel],previousSplat[start+channel])) {
          different = true
          break
        }
      }
    }
    if (!different) continue
    changedVertices++
    const x = i % width, z = Math.floor(i / width)
    const key = `${Math.floor(x/regionCells)}:${Math.floor(z/regionCells)}`
    let region = regions.get(key)
    if (!region) {
      region = { x0:x, x1:x, z0:z, z1:z }
      regions.set(key,region)
    } else {
      region.x0 = Math.min(region.x0,x)
      region.x1 = Math.max(region.x1,x)
      region.z0 = Math.min(region.z0,z)
      region.z1 = Math.max(region.z1,z)
    }
  }
  return { changedVertices, regions:[...regions.values()] }
}

function makeDirtyLookup(regions, nx, nz, regionCells) {
  const cols = Math.floor(nx / regionCells) + 1
  const rows = Math.floor(nz / regionCells) + 1
  // Un índice espacial temporal; para terrenos enormes se conserva el barrido exacto.
  if (cols * rows > 1048576) return null
  const prefix = new Uint32Array((cols + 1) * (rows + 1))
  const stride = cols + 1
  for (const region of regions) {
    const col = Math.floor(region.x0 / regionCells)
    const row = Math.floor(region.z0 / regionCells)
    prefix[(row + 1) * stride + col + 1] = 1
  }
  for (let row = 1; row <= rows; row++) {
    for (let col = 1; col <= cols; col++) {
      const k = row * stride + col
      prefix[k] += prefix[k - 1] + prefix[k - stride] - prefix[k - stride - 1]
    }
  }
  return {
    cells: cols * rows,
    intersects(x0, z0, x1, z1) {
      const xa = Math.floor(x0 / regionCells), xb = Math.floor(x1 / regionCells) + 1
      const za = Math.floor(z0 / regionCells), zb = Math.floor(z1 / regionCells) + 1
      return prefix[zb * stride + xb] - prefix[za * stride + xb] -
        prefix[zb * stride + xa] + prefix[za * stride + xa] > 0
    },
  }
}

/** Reutiliza decisiones del árbol adaptativo y fragmentos certificados, preservando el índice final. */
export function createIncrementalTriangHor({ regionCells = DEFAULT_REGION_CELLS, maxBytes = DEFAULT_MAX_BYTES } = {}) {
  if (!Number.isInteger(regionCells) || regionCells < 1)
    throw new RangeError('TriangHor: regionCells debe ser un entero positivo')
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0)
    throw new RangeError('TriangHor: maxBytes debe ser un entero no negativo')

  let previous = null
  let lastStats = null
  let disposed = false

  const reset = () => { previous = null; lastStats = null }
  const compute = input => {
    if (disposed) throw new Error('TriangHor: sesión incremental finalizada')
    assertTriangHorInput(input)
    const started = performance.now()
    const { heights, splat = null, nx, nz, channels = 8 } = input
    const cfg = normalizeTerrainBake(input.settings)
    const key = cfg ? `${nx}:${nz}:${channels}:${cfg.heightError}:${cfg.paintError}:${!!splat}` : null
    const compatible = !!(previous && key && previous.key === key &&
      heights?.length === previous.heights.length &&
      (splat ? splat.length === previous.splat?.length : previous.splat === null))
    const changeSet = compatible ? changes({ heights,splat,nx,nz,channels },previous.heights,previous.splat,regionCells) : null
    if (changeSet && changeSet.changedVertices === 0) {
      const plan = copyPlan(previous.plan)
      plan.bakeMs = performance.now() - started
      lastStats = Object.freeze({ mode:'reused', changedVertices:0, dirtyRegions:0,
        reusedBranches:previous.nodeCount, evaluatedBranches:0, cachedBytes:previous.bytes,
        elapsedMs:plan.bakeMs })
      return plan
    }

    const sourceBytes = (heights?.byteLength ?? heights?.length*8 ?? 0) +
      (splat?.byteLength ?? splat?.length*8 ?? 0)
    const mayCache = !!key && maxBytes >= sourceBytes
    const dirtyLookup = changeSet ? makeDirtyLookup(changeSet.regions, nx, nz, regionCells) : null
    const reuse = !mayCache ? null : compatible && previous.tree
      ? { previousTree:previous.tree, previousPatches:previous.patches,
          dirty:changeSet.regions, intersectsDirty:dirtyLookup?.intersects,
          previousShape:previous.plan.shape, previousIndex:previous.plan.index,
          reusedBranches:0, evaluatedBranches:0, nextTree:null, nextPatches:null,
          reusedPatches:0, rebuiltPatches:0, reusedValidations:0, evaluatedPatches:0,
          reusedSeamLayouts:0, rebuiltSeamLayouts:0,
          reusedShapeCertifications:0, evaluatedShapeCertifications:0,
          reusedFinalIndices:0, assembledFinalIndices:0 }
      : { previousTree:null, previousPatches:null, dirty:null,
          reusedBranches:0, evaluatedBranches:0, nextTree:null, nextPatches:null,
          reusedPatches:0, rebuiltPatches:0, reusedValidations:0, evaluatedPatches:0,
          reusedSeamLayouts:0, rebuiltSeamLayouts:0,
          reusedShapeCertifications:0, evaluatedShapeCertifications:0,
          reusedFinalIndices:0, assembledFinalIndices:0 }
    // El resultado final mantiene el orden de índices y la certificación del algoritmo original.
    const result = computeTriangHor(input, { reuse })
    const nodeCount = countNodes(reuse?.nextTree)
    const heightCopy = mayCache ? copyArray(heights) : null
    const splatCopy = mayCache ? copyArray(splat) : null
    const safePlan = mayCache ? copyPlan(result) : null
    let patchBytes = 0
    for (const patch of reuse?.nextPatches?.values() ?? []) {
      patchBytes += (patch.ring.byteLength + patch.index.byteLength) + 160
    }
    const bytes = (heightCopy?.byteLength ?? heightCopy?.length*8 ?? 0) +
      (splatCopy?.byteLength ?? splatCopy?.length*8 ?? 0) +
      (safePlan?.index?.byteLength ?? 0) + nodeCount*160 + patchBytes
    const cached = mayCache && bytes <= maxBytes
    previous = cached ? { key, heights:heightCopy, splat:splatCopy, tree:reuse.nextTree,
      patches:reuse.nextPatches, plan:safePlan, nodeCount, bytes } : null
    const mode = compatible && reuse?.reusedBranches > 0 ? 'incremental' : 'full'
    lastStats = Object.freeze({ mode, changedVertices:changeSet?.changedVertices ?? heights?.length ?? 0,
      dirtyRegions:changeSet?.regions.length ?? 0, reusedBranches:reuse?.reusedBranches ?? 0,
      evaluatedBranches:reuse?.evaluatedBranches ?? 0, cachedBytes:cached ? bytes : 0,
      dirtyIndexCells:dirtyLookup?.cells ?? 0, reusedPatches:reuse?.reusedPatches ?? 0,
      rebuiltPatches:reuse?.rebuiltPatches ?? 0, reusedValidations:reuse?.reusedValidations ?? 0,
      evaluatedPatches:reuse?.evaluatedPatches ?? 0,
      reusedSeamLayouts:reuse?.reusedSeamLayouts ?? 0,
      rebuiltSeamLayouts:reuse?.rebuiltSeamLayouts ?? 0,
      reusedShapeCertifications:reuse?.reusedShapeCertifications ?? 0,
      evaluatedShapeCertifications:reuse?.evaluatedShapeCertifications ?? 0,
      reusedFinalIndices:reuse?.reusedFinalIndices ?? 0,
      assembledFinalIndices:reuse?.assembledFinalIndices ?? 0,
      elapsedMs:performance.now()-started,
      ...(!cached ? { cacheLimited:true } : {}) })
    return result
  }
  return Object.freeze({ compute, reset,
    dispose: () => { reset(); disposed = true },
    get lastStats() { return lastStats },
  })
}
