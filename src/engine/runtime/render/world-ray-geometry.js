const MAX_TRIANGLES = 160000

function coveredMesh(mesh) {
  const g = mesh.geometry, m = mesh.material
  return mesh.isMesh && !mesh.isSkinnedMesh && !mesh.isInstancedMesh && !mesh.isBatchedMesh &&
    !mesh.userData.helper && !mesh.userData.isHelper && !mesh.userData.pickProxy &&
    (m?.isMeshStandardMaterial || m?.isMeshLambertMaterial || m?.isMeshBasicMaterial) &&
    m.visible && !m.transparent && !m.alphaTest && !m.alphaHash && !m.wireframe &&
    !m.displacementMap && !m.transmission && !m.clippingPlanes?.length &&
    g?.attributes.position?.itemSize === 3 && !Object.keys(g.morphAttributes || {}).length &&
    Number.isInteger(g.drawRange.start) && g.drawRange.start >= 0 && g.drawRange.start % 3 === 0
}

export function collectRayMeshes(world, layers) {
  world.updateWorldMatrix(true, true)
  const list = []
  let tris = 0
  world.traverseVisible((object) => {
    const mesh = object._lfClusterSource ?? object
    if (!coveredMesh(mesh) || !mesh.layers.test(layers)) return
    const g = mesh.geometry, m = mesh.material
    const start = g.drawRange.start
    const count = Math.floor(Math.min(g.drawRange.count, (g.index?.count ?? g.attributes.position.count) - start) / 3) * 3
    if (!(count > 0) || tris + count / 3 > MAX_TRIANGLES) return
    tris += count / 3
    list.push({ mesh, g, m, start, count })
  })
  return list
}

export function rayMeshesSignature(list) {
  return JSON.stringify(list.map(({ mesh, g, m, start, count }) => [
    mesh.id, g.id, g.index?.version, g.attributes.position.version ?? g.attributes.position.data?.version,
    start, count, mesh.matrixWorld.elements,
    m.id, m.color.toArray(), m.emissive?.toArray(), m.emissiveIntensity, m.side, m.metalness, m.roughness, m.ior, m.specularIntensity, m.specularColor?.toArray(),
  ]))
}

export function snapshotRayMesh({ mesh, g, m, start, count }) {
  const source = g.attributes.position
  let position
  if (!source.isInterleavedBufferAttribute && source.array instanceof Float32Array) {
    position = source.array.slice()
  } else {
    position = new Float32Array(source.count * 3)
    for (let i = 0; i < source.count; i++) position.set([source.getX(i), source.getY(i), source.getZ(i)], i * 3)
  }
  const index = g.index
    ? Uint32Array.from(g.index.array.subarray(start, start + count))
    : Uint32Array.from({ length: count }, (_, i) => start + i)
  // El BVH mide el lado emisor con el winding de la malla en coordenadas de mundo.
  if (mesh.matrixWorld.determinant() < 0) {
    for (let i = 0; i < index.length; i += 3) [index[i + 1], index[i + 2]] = [index[i + 2], index[i + 1]]
  }
  if (m.side === 1) {
    for (let i = 0; i < index.length; i += 3) [index[i + 1], index[i + 2]] = [index[i + 2], index[i + 1]]
  }
  const color = m.isMeshBasicMaterial ? [0, 0, 0] : m.color.toArray().map(channel => channel * (1 - (m.metalness ?? 0)))
  const emission = m.isMeshBasicMaterial ? m.color.toArray() :
    (m.emissive?.toArray() ?? [0, 0, 0]).map(channel => channel * (m.emissiveIntensity ?? 1))
  emission.push(m.side === 2 ? 1 : 0)
  const metalness = m.metalness ?? 0
  const ior = m.ior ?? 1.5
  const dielectric = Math.pow((ior - 1) / (ior + 1), 2) * (m.specularIntensity ?? 1)
  const specularColor = m.specularColor?.toArray() ?? [1, 1, 1]
  const surface = m.isMeshStandardMaterial
    ? [...m.color.toArray().map((channel, i) => Math.min(1, channel * metalness + specularColor[i] * dielectric * (1 - metalness))), m.roughness]
    : [0, 0, 0, 1]
  return { position, index, matrix: mesh.matrixWorld.toArray(), color, emission, surface }
}

