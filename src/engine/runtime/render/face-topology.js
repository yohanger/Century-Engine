// Triángulos del draw efectivo, no de la malla original de autoría.
// Puro y comprobable sin GPU: el shader de diagnóstico consume exactamente estos vértices.
// La salida no se usa en Lit ni altera geometrías persistentes.
const hue = (seed) => {
  let x = Math.imul((seed + 1) | 0, 0x9e3779b1) ^ 0x85ebca6b
  x = Math.imul(x ^ x >>> 16, 0x7feb352d) >>> 0
  return [64 + (x & 191), 64 + ((x >>> 8) & 191), 64 + ((x >>> 16) & 191)]
}

export function effectiveTriangleSpan(geometry) {
  const position = geometry?.attributes?.position
  if (!position) return { first: 0, faces: 0 }
  const count = geometry.index?.count ?? position.count
  const first = Math.min(count, Math.max(0, geometry.drawRange?.start || 0))
  const remaining = Number.isFinite(geometry.drawRange?.count) ? geometry.drawRange.count : count
  const faces = Math.max(0, Math.floor((Math.min(count, first + Math.max(0, remaining)) - first) / 3))
  return { first, faces }
}

export function faceColorBuffers(geometry, mode, clusterId = 0) {
  const position = geometry.attributes.position
  const index = geometry.index
  const { first, faces } = effectiveTriangleSpan(geometry)
  const xyz = new Float32Array(faces * 9)
  const colors = new Uint8Array(faces * 9)
  for (let face = 0; face < faces; face++) {
    // ID de agrupación en modo Clusters, ID de cara en Triangles.
    const rgb = hue(mode === 'triangles' ? Math.imul(clusterId, 1000003) + face : clusterId)
    for (let v = 0; v < 3; v++) {
      const offset = first + face * 3 + v
      const i = index ? index.getX(offset) : offset
      xyz.set([position.getX(i), position.getY(i), position.getZ(i)], face * 9 + v * 3)
      colors.set(rgb, face * 9 + v * 3)
    }
  }
  return { xyz, colors, faces }
}
