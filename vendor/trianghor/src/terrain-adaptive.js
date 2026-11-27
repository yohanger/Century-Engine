import { triangulatePatchRing, triangleShapeQuality } from './trianghor/triangulate.js'
// Simplificación local para el índice de dibujo de Terrain. No altera heights/splat.
// Cada hoja es un rectángulo de la cuadrícula; sus aristas se cosen con los
// vértices de todas las hojas vecinas. En el perímetro preservamos cada vértice
// para conservar la continuidad con Terrain adyacentes y los LOD heredados.
const at = (x, z, width) => z * width + x
// Mantener las diagonales locales evita que un parche plano conecte extremos
// de todo el mapa con triángulos largos y delgados. No cambia las tolerancias.
const MAX_PATCH_CELLS = 16
const triangle = (a, b, c, width, heights, splat, channels, maxHeight, maxPaint) => {
  const ax = a % width, az = (a / width) | 0
  const bx = b % width, bz = (b / width) | 0
  const cx = c % width, cz = (c / width) | 0
  const area = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz)
  if (!area) return { height: Infinity, paint: Infinity }
  let height = 0, paint = 0
  for (let z = Math.min(az, bz, cz); z <= Math.max(az, bz, cz); z++) {
    for (let x = Math.min(ax, bx, cx); x <= Math.max(ax, bx, cx); x++) {
      const u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / area
      const v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / area
      const w = 1 - u - v
      if (u < -1e-7 || v < -1e-7 || w < -1e-7) continue
      const i = at(x, z, width)
      height = Math.max(height, Math.abs(heights[i] - (heights[a] * u + heights[b] * v + heights[c] * w)))
      if (height > maxHeight + 1e-7) return { height, paint }
      if (splat) for (let k = 0; k < channels; k++) {
        paint = Math.max(paint, Math.abs(splat[i*channels+k] -
          (splat[a*channels+k]*u + splat[b*channels+k]*v + splat[c*channels+k]*w))/255)
      }
      if (paint > maxPaint + 1e-7) return { height, paint }
    }
  }
  return { height, paint }
}

function checkTriangles(index, width, heights, splat, channels, maxHeight, maxPaint) {
  let height = 0, paint = 0
  for (let i = 0; i < index.length; i += 3) {
    const e = triangle(index[i], index[i+1], index[i+2], width,
      heights, splat, channels, maxHeight, maxPaint)
    height = Math.max(height, e.height); paint = Math.max(paint, e.paint)
    if (height > maxHeight + 1e-7 || paint > maxPaint + 1e-7) return { height, paint, valid: false }
  }
  return { height, paint, valid: true }
}

function add(map, key, value) {
  let set = map.get(key)
  if (!set) { set = new Set(); map.set(key, set) }
  set.add(value)
}

/**
 * Genera una malla de triángulos de conformidad comprobable, sin T-junctions.
 * No requiere potencias de dos, no introduce vértices nuevos ni cambia UV/splat.
 * Si no mejora la malla original devuelve null, nunca anuncia un falso horneado.
 */
export function adaptiveTerrainIndex(heights, splat, nx, nz, maxHeight, maxPaint, channels = 8, reuse = null) {
  if (!Number.isInteger(nx) || !Number.isInteger(nz) || nx < 2 || nz < 2 ||
    heights?.length !== (nx + 1) * (nz + 1) ||
    (splat && splat.length !== heights.length * channels))
    throw new RangeError('Dimensiones o pintura de Terrain incompatibles')
  if (![maxHeight, maxPaint].every(x => Number.isFinite(x) && x >= 0))
    throw new RangeError('Tolerancias de simplificación inválidas')
  const width = nx + 1
  const leaves = []
  const dirty = reuse?.dirty ?? null
  const intersectsChanges = reuse?.intersectsDirty ?? ((x0, z0, x1, z1) => !dirty || dirty.some(r =>
    r.x0 <= x1 && r.x1 >= x0 && r.z0 <= z1 && r.z1 >= z0))
  const appendCachedLeaves = node => {
    if (!node.children) { leaves.push({ x0: node.x0, z0: node.z0, x1: node.x1, z1: node.z1 }); return }
    for (const child of node.children) appendCachedLeaves(child)
  }
  const split = (x0, z0, x1, z1, previous = null) => {
    if (previous && !intersectsChanges(x0, z0, x1, z1)) {
      if (reuse) reuse.reusedBranches++
      appendCachedLeaves(previous)
      return previous
    }
    if (reuse) reuse.evaluatedBranches++
    const dx = x1 - x0, dz = z1 - z0
    const node = { x0, z0, x1, z1, children: null }
    if (dx === 1 && dz === 1) { leaves.push({ x0, z0, x1, z1 }); return node }
    const a = at(x0,z0,width), b = at(x1,z0,width), c = at(x0,z1,width), d = at(x1,z1,width)
    const first = dx <= MAX_PATCH_CELLS && dz <= MAX_PATCH_CELLS
      ? triangle(a,c,b,width,heights,splat,channels,maxHeight,maxPaint)
      : { height: Infinity, paint: Infinity }
    const second = first.height <= maxHeight && first.paint <= maxPaint
      ? triangle(b,c,d,width,heights,splat,channels,maxHeight,maxPaint)
      : first
    if (dx <= MAX_PATCH_CELLS && dz <= MAX_PATCH_CELLS && first.height <= maxHeight && first.paint <= maxPaint &&
        second.height <= maxHeight && second.paint <= maxPaint && dx >= 2 && dz >= 2) {
      leaves.push({ x0, z0, x1, z1 }); return node
    }
    const mx = x0 + Math.floor(dx / 2), mz = z0 + Math.floor(dz / 2)
    const regions = dx > 1 && dz > 1
      ? [[x0,z0,mx,mz],[mx,z0,x1,mz],[x0,mz,mx,z1],[mx,mz,x1,z1]]
      : dx > 1
        ? [[x0,z0,mx,z1],[mx,z0,x1,z1]]
        : [[x0,z0,x1,mz],[x0,mz,x1,z1]]
    node.children = regions.map((r,i) => {
      const old = previous?.children?.[i]
      const matching = old && old.x0===r[0] && old.z0===r[1] && old.x1===r[2] && old.z1===r[3]
      return split(...r, matching ? old : null)
    })
    return node
  }
  const root = split(0, 0, nx, nz, reuse?.previousTree)
  if (reuse) reuse.nextTree = root
  const lowerBound = (sorted, value) => {
    let lo = 0, hi = sorted.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (sorted[mid] < value) lo = mid + 1
      else hi = mid
    }
    return lo
  }
  const upperBound = (sorted, value) => {
    let lo = 0, hi = sorted.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (sorted[mid] <= value) lo = mid + 1
      else hi = mid
    }
    return lo
  }
  const sameRing = (a, b) => a?.length === b?.length && a.every((value, i) => value === b[i])
  function build() {
    const previousPatches = reuse?.previousPatches
    // La misma partición produce las mismas costuras, independientemente de alturas o pintura.
    let stableSeams = !!previousPatches && previousPatches.size === leaves.length
    let stableOrder = stableSeams
    if (stableSeams) {
      const order = previousPatches.keys()
      for (const p of leaves) {
        const key = `${p.x0}:${p.z0}:${p.x1}:${p.z1}`
        if (!previousPatches.has(key)) { stableSeams = false; stableOrder = false; break }
        if (order.next().value !== key) stableOrder = false
      }
    }
    if (reuse) {
      if (stableSeams) reuse.reusedSeamLayouts = (reuse.reusedSeamLayouts ?? 0) + 1
      else reuse.rebuiltSeamLayouts = (reuse.rebuiltSeamLayouts ?? 0) + 1
    }
    let sortedHorizontal, sortedVertical
    if (!stableSeams) {
    const horizontal = new Map(), vertical = new Map()
    for (const p of leaves) {
      // Los rectángulos de una sola celda dibujan su lado largo con vértices
      // intermedios. Registrarlos aquí impide T-junctions en la hoja contigua.
      if (p.x1-p.x0 === 1) for (let z=p.z0;z<=p.z1;z++) {
        add(vertical,p.x0,z); add(vertical,p.x1,z)
      }
      if (p.z1-p.z0 === 1) for (let x=p.x0;x<=p.x1;x++) {
        add(horizontal,p.z0,x); add(horizontal,p.z1,x)
      }
      for (const x of [p.x0,p.x1]) {
        add(horizontal,p.z0,x); add(horizontal,p.z1,x)
      }
      for (const z of [p.z0,p.z1]) {
        add(vertical,p.x0,z); add(vertical,p.x1,z)
      }
    }
    // Los bordes entre piezas quedan a la resolución original.
    for (let x=0;x<=nx;x++) { add(horizontal,0,x); add(horizontal,nz,x) }
    for (let z=0;z<=nz;z++) { add(vertical,0,z); add(vertical,nx,z) }
    sortedHorizontal = new Map([...horizontal].map(([line, vertices]) =>
      [line, [...vertices].sort((a, b) => a - b)]))
    sortedVertical = new Map([...vertical].map(([line, vertices]) =>
      [line, [...vertices].sort((a, b) => a - b)]))
    }
    const interval = (sorted, min, max) => sorted.slice(lowerBound(sorted, min), upperBound(sorted, max))
    const parts = [], errors = []
    let indexLength = 0
    const patches = reuse ? new Map() : null
    const v = (x,z) => at(x,z,width)
    for (let pIndex=0;pIndex<leaves.length;pIndex++) {
      const p=leaves[pIndex], {x0,z0,x1,z1}=p
      const key = `${x0}:${z0}:${x1}:${z1}`
      const old = previousPatches?.get(key)
      let ring
      if (stableSeams) {
        ring = old.ring
      } else {
        const xs0 = interval(sortedHorizontal.get(z0), x0, x1)
        const xs1 = interval(sortedHorizontal.get(z1), x0, x1)
        const zs0 = interval(sortedVertical.get(x0), z0, z1)
        const zs1 = interval(sortedVertical.get(x1), z0, z1)
        ring = []
        for (let i=0;i<xs0.length-1;i++) ring.push(v(xs0[i],z0))
        for (let i=0;i<zs1.length-1;i++) ring.push(v(x1,zs1[i]))
        for (let i=xs1.length-1;i>0;i--) ring.push(v(xs1[i],z1))
        for (let i=zs0.length-1;i>0;i--) ring.push(v(x0,zs0[i]))
      }
      const cached = old && (stableSeams || sameRing(old.ring, ring)) ? old : null
      const local = cached ? cached.index : []
      if (cached) {
        reuse.reusedPatches++
      } else if (x1-x0 === 1 && z1-z0 === 1) {
        const a=v(x0,z0), b=v(x1,z0), c=v(x0,z1), d=v(x1,z1)
        local.push(a,c,b,b,c,d)
      } else if (x1-x0 >= 2 && z1-z0 >= 2) {
        const minimal=triangulatePatchRing(ring,width)
        if(minimal) local.push(...minimal)
        else { // caso imposible de triangular con calidad: conservar la ruta anterior
          const center=v(x0+Math.floor((x1-x0)/2),z0+Math.floor((z1-z0)/2))
          for(let i=0;i<ring.length;i++) local.push(center,ring[(i+1)%ring.length],ring[i])
        }
      } else {
        // Hojas rectangulares de una celda de ancho: si las costuras exigen
        // puntos interiores, dividirlas en celdas evita triángulos degenerados.
        if (x1-x0 === 1) {
          for (let z=z0;z<z1;z++) { const a=v(x0,z),b=v(x1,z),c=v(x0,z+1),d=v(x1,z+1); local.push(a,c,b,b,c,d) }
        } else {
          for (let x=x0;x<x1;x++) { const a=v(x,z0),b=v(x+1,z0),c=v(x,z1),d=v(x+1,z1); local.push(a,c,b,b,c,d) }
        }
      }
      if (reuse && !cached) reuse.rebuiltPatches++
      const validCache = cached?.error && !intersectsChanges(x0, z0, x1, z1)
      const patchError = validCache ? cached.error : checkTriangles(local, width,
        heights, splat, channels, maxHeight, maxPaint)
      if (reuse) {
        if (validCache) reuse.reusedValidations++
        else reuse.evaluatedPatches++
        patches.set(key, {
          ring: cached ? cached.ring : Uint32Array.from(ring),
          index: cached ? cached.index : Uint32Array.from(local),
          error: patchError,
        })
      }
      errors.push(patchError)
      parts.push(local)
      indexLength += local.length
    }
    return { parts, indexLength, errors, patches, stableOrder }
  }
  const accumulatedError = errors => {
    let height = 0, paint = 0, valid = true
    for (const value of errors) {
      height = Math.max(height, value.height)
      paint = Math.max(paint, value.paint)
      valid = valid && value.valid
    }
    return { height, paint, valid }
  }
  let output=build(), error=accumulatedError(output.errors)
  // Certificar el índice FINAL, no solo los candidatos del árbol.
  // Refinar las hojas que fallan; si alguna transformación produce una malla
  // imposible de certificar, no anunciar optimización.
  for (let iteration=0; !error.valid && iteration<12; iteration++) {
    const invalid=[]
    for (let i=0;i<output.errors.length;i++) {
      if (!output.errors[i].valid) invalid.push(i)
    }
    if (!invalid.length) break
    for (const i of invalid.reverse()) {
      const p=leaves[i], dx=p.x1-p.x0, dz=p.z1-p.z0
      if (dx===1 && dz===1) continue
      const mx=p.x0+Math.floor(dx/2), mz=p.z0+Math.floor(dz/2)
      const sub=[]
      if (dx>1&&dz>1) sub.push({x0:p.x0,z0:p.z0,x1:mx,z1:mz},{x0:mx,z0:p.z0,x1:p.x1,z1:mz},{x0:p.x0,z0:mz,x1:mx,z1:p.z1},{x0:mx,z0:mz,x1:p.x1,z1:p.z1})
      else if (dx>1) sub.push({x0:p.x0,z0:p.z0,x1:mx,z1:p.z1},{x0:mx,z0:p.z0,x1:p.x1,z1:p.z1})
      else sub.push({x0:p.x0,z0:p.z0,x1:p.x1,z1:mz},{x0:p.x0,z0:mz,x1:p.x1,z1:p.z1})
      leaves.splice(i,1,...sub)
    }
    output=build()
    error=accumulatedError(output.errors)
  }
  if (reuse) reuse.nextPatches = output.patches
  if (!error.valid || output.indexLength >= nx*nz*6) return null
  // Cuando el orden de parches coincide, una copia compacta conserva exactamente los índices.
  const reuseIndex = !!(output.stableOrder && reuse?.previousIndex?.length === output.indexLength)
  const index = reuseIndex ? reuse.previousIndex.slice() : new Uint32Array(output.indexLength)
  if (!reuseIndex) {
    let offset = 0
    for (const part of output.parts) {
      index.set(part, offset)
      offset += part.length
    }
  }
  if (reuse) {
    if (reuseIndex) reuse.reusedFinalIndices = (reuse.reusedFinalIndices ?? 0) + 1
    else reuse.assembledFinalIndices = (reuse.assembledFinalIndices ?? 0) + 1
  }
  // La calidad de forma depende únicamente del índice ordenado, nunca del relieve.
  const reusedShape = !!(output.stableOrder && reuse?.previousShape)
  const shape = reusedShape ? { ...reuse.previousShape } : triangleShapeQuality(index,width)
  if (reuse) {
    if (reusedShape) reuse.reusedShapeCertifications = (reuse.reusedShapeCertifications ?? 0) + 1
    else reuse.evaluatedShapeCertifications = (reuse.evaluatedShapeCertifications ?? 0) + 1
  }
  return { index, triangles: index.length/3,
    height: error.height, paint: error.paint, patches: leaves.length,
    shape,
    sourceTriangles: nx*nz*2, reduction: 1-index.length/(nx*nz*6) }
}
