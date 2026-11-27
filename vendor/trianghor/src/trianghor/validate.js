export function assertTriangHorInput(input) {
  if (!input || typeof input !== 'object')
    throw new TypeError('TriangHor: entrada inválida')
  const { heights, splat = null, nx, nz, channels = 8 } = input
  if (!Number.isSafeInteger(nx) || !Number.isSafeInteger(nz) || nx < 2 || nz < 2 ||
      !Number.isSafeInteger(channels) || channels < 1)
    throw new RangeError('TriangHor: dimensiones o canales incompatibles')
  const vertices = (nx + 1) * (nz + 1)
  if (!Number.isSafeInteger(vertices) || !heights || typeof heights.length !== 'number' ||
      heights.length !== vertices ||
      (splat !== null && (!Number.isSafeInteger(vertices * channels) ||
        typeof splat.length !== 'number' || splat.length !== vertices * channels)))
    throw new RangeError('TriangHor: dimensiones de alturas o pintura incompatibles')
  if (heights instanceof Float32Array || heights instanceof Float64Array) {
    if (heights.includes(NaN) || heights.includes(Infinity) || heights.includes(-Infinity))
      throw new RangeError('TriangHor: alturas no finitas')
  } else if (!ArrayBuffer.isView(heights) || heights instanceof DataView) {
    for (let i = 0; i < vertices; i++) {
      if (!Number.isFinite(heights[i]))
        throw new RangeError('TriangHor: alturas no finitas')
    }
  }
  if (splat !== null && !(splat instanceof Uint8Array) && !(splat instanceof Uint8ClampedArray)) {
    for (let i = 0; i < splat.length; i++) {
      if (!Number.isFinite(splat[i]) || splat[i] < 0 || splat[i] > 255)
        throw new RangeError('TriangHor: pintura inválida')
    }
  }
  return input
}
