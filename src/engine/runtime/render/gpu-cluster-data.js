// Conserva los vértices de cada nivel y un rango de índices por clúster.
export function packGpuClusters(pages) {
  let vertices = 0, indices = 0, maxOutput = 0
  for (const levels of pages) {
    maxOutput += levels[0].index.length
    for (const level of levels) {
      vertices += level.position.length / 3
      indices += level.index.length
    }
  }
  const position = new Float32Array(vertices * 3)
  const attrs = Object.fromEntries(Object.entries(pages[0][0].attrs).map(([name, { itemSize }]) =>
    [name, { itemSize, array: new Float32Array(vertices * itemSize) }]))
  const source = new Uint32Array(indices)
  const metadata = new Float32Array(pages.length * 16)
  const ranges = new Uint32Array(metadata.buffer)
  let vertex = 0, start = 0
  for (let c = 0; c < pages.length; c++) {
    const levels = pages[c], first = levels[0]
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
    for (let i = 0; i < first.position.length; i++) {
      const axis = i % 3
      min[axis] = Math.min(min[axis], first.position[i])
      max[axis] = Math.max(max[axis], first.position[i])
    }
    const offset = c * 16
    const center = min.map((x, i) => (x + max[i]) * 0.5)
    metadata.set([...center, Math.hypot(...max.map((x, i) => x - center[i]))], offset)
    ranges[offset + 10] = levels.length
    for (let l = 0; l < levels.length; l++) {
      const { position: points, attrs: data, index, error } = levels[l]
      position.set(points, vertex * 3)
      for (const [name, dest] of Object.entries(attrs)) dest.array.set(data[name].array, vertex * dest.itemSize)
      for (let i = 0; i < index.length; i++) source[start + i] = index[i] + vertex
      ranges[offset + 4 + l * 2] = start
      ranges[offset + 5 + l * 2] = index.length
      if (l) metadata[offset + 11 + l] = error
      vertex += points.length / 3
      start += index.length
    }
  }
  return { position, attrs, source, metadata, maxOutput }
}
