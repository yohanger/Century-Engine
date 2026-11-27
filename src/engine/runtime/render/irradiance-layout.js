import { Box3, Vector3 } from 'three'

const LOCAL_SIZE = [12, 5, 12]
const LOCAL_RESOLUTION = [3, 2, 3]
const SCENE_PROBE_LIMIT = 96

export function layoutIrradiance(mode, position, bounds) {
  if (mode !== 'scene' || bounds.isEmpty()) {
    return { size: LOCAL_SIZE, resolution: LOCAL_RESOLUTION, center: position.toArray(), far: 28 }
  }
  const extents = bounds.getSize(new Vector3())
  const size = extents.toArray().map((axis, i) => Math.max(axis + 2, i === 1 ? 5 : 6))
  const resolution = size.map((axis, i) => Math.max(3, Math.min(i === 1 ? 5 : 12, 1 + Math.ceil(axis / 6))))
  while (resolution[0] * resolution[1] * resolution[2] > SCENE_PROBE_LIMIT) {
    // Reduce primero el eje con mayor densidad de muestreo.
    let densest = -1
    for (let i = 0; i < 3; i++) {
      if (resolution[i] <= 3) continue
      if (densest < 0 || (resolution[i] - 1) / size[i] > (resolution[densest] - 1) / size[densest]) densest = i
    }
    resolution[densest]--
  }
  const spacing = Math.max(...size.map((axis, i) => axis / (resolution[i] - 1)))
  return { size, resolution, center: bounds.getCenter(new Vector3()).toArray(), far: Math.max(28, spacing * 2.5) }
}

export function boundsOfIrradianceWorld(world, target = new Box3()) {
  const scratch = new Box3()
  target.makeEmpty()
  world.updateWorldMatrix(true, true)
  world.traverseVisible((object) => {
    if (!object.isMesh || object.userData.helper || object.userData.isHelper || object.userData.pickProxy) return
    const mesh = object._lfClusterSource ?? object
    const material = mesh.material
    if (!(Array.isArray(material) ? material : [material]).some(m => m?.visible && !m.transparent)) return
    const base = mesh.isInstancedMesh || mesh.isBatchedMesh ? mesh : mesh.geometry
    if (!base) return
    if (!base.boundingBox) base.computeBoundingBox()
    if (!base.boundingBox || base.boundingBox.isEmpty()) return
    scratch.copy(base.boundingBox).applyMatrix4(mesh.matrixWorld)
    if (scratch.min.toArray().every(Number.isFinite) && scratch.max.toArray().every(Number.isFinite)) target.union(scratch)
  })
  return target
}
