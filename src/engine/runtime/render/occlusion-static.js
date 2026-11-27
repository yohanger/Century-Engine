import { Box3 } from 'three'

export const OCCLUSION_BAKE_VERSION = 2
export const OCCLUSION_NODE_TYPES = ['primitive', 'mesh', 'model', 'terrain', 'road', 'text', 'nature', 'decal', 'sprite3d', 'event', 'gameplayObject', 'vfx']

// Las escenas existentes pueden tener decoración marcada explícitamente para batching.
export const isOcclusionStatic = (node) => (node?.props?.static ?? node?.props?.batchStatic) === true

const isHelper = (object) => object.userData?.helper || object.userData?.isHelper ||
  object.userData?.pickProxy || object.userData?.ignoreOcclusion

function standardMaterial(material) {
  if (!material?.isMaterial || material.isShaderMaterial || material.isRawShaderMaterial ||
      !material.visible || !material.depthTest || material.displacementMap ||
      material.userData.rtPsx?.step?.value > 0) return false
  const shader = material.userData.rt?.key
  if (shader && !shader.startsWith('builtin:blockout|') && !shader.startsWith('builtin:realista|')) return false
  return !Object.hasOwn(material, 'onBeforeCompile') || !!shader || material.userData.rtLfEffects === true
}

export function candidateMesh(mesh) {
  if (!mesh?.isMesh || isHelper(mesh) || !mesh.geometry?.attributes?.position ||
      mesh.isSkinnedMesh || mesh.morphTargetInfluences?.length || mesh.geometry.morphAttributes?.position?.length ||
      mesh.geometry.isInstancedBufferGeometry || mesh.isInstancedMesh || mesh.isBatchedMesh) return false
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  return materials.length > 0 && materials.some(material => material?.visible !== false)
}

function opaqueOccluderMaterial(material) {
  return standardMaterial(material) && (material.side === 0 || material.side === 2) &&
    material.depthWrite && material.colorWrite && !material.transparent &&
    material.opacity === 1 && !material.alphaTest && !material.alphaHash &&
    !material.alphaMap && !material.alphaToCoverage && !material.wireframe &&
    !material.clippingPlanes?.length && !material.polygonOffset &&
    !material.stencilWrite && !material.userData.rtRoadPaint &&
    !material.transmission && (material.depthFunc === 2 || material.depthFunc === 3) &&
    material.blending === 1
}

export function occluderSide(mesh) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  return materials.some(material => material.side === 0) ? 0 : 2
}

export function occluderMesh(mesh) {
  if (!candidateMesh(mesh) || mesh.customDepthMaterial || mesh.customDistanceMaterial ||
      Object.hasOwn(mesh, 'onBeforeRender')) return false
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  return materials.length > 0 && materials.every(opaqueOccluderMaterial)
}

const boundsChecks = new WeakMap()
const versionOf = (attribute) => attribute.version ?? attribute.data?.version

export function worldBounds(mesh, target, refresh = false) {
  const geometry = mesh.geometry
  const position = geometry.attributes.position
  let cached = boundsChecks.get(geometry)
  const version = versionOf(position)
  if (refresh || !cached || cached.position !== position || cached.version !== version) {
    cached = { position, version, box: new Box3().setFromBufferAttribute(position) }
    boundsChecks.set(geometry, cached)
  }
  return target.copy(cached.box).applyMatrix4(mesh.matrixWorld)
}

const visualRoot = (root) => root?.userData.terrainPiece?.mesh ?? root?.userData.visual ?? root

export function visibleInScene(object, scene) {
  for (let current = object; current; current = current.parent) {
    if (!(current._lfClusterBatch?.visible ?? current.visible) || isHelper(current)) return false
    if (current === scene) return true
  }
  return false
}

export function visitStaticMeshes(graph, visit) {
  for (const [id, root] of graph.nodes) {
    if (!isOcclusionStatic(root._lfNodeOwner)) continue
    function walk(mesh, path) {
      if (!mesh.visible || isHelper(mesh) || mesh !== root && mesh.userData.kind === 'object') return
      if (candidateMesh(mesh)) visit(id, path, mesh)
      mesh.children.forEach((child, index) => walk(child, [...path, index]))
    }
    const visual = visualRoot(root)
    if (visual && visibleInScene(visual, graph.vp.scene)) walk(visual, [])
  }
}

export function resolveStaticMesh(graph, id, path) {
  const root = graph.nodes.get(id)
  if (!isOcclusionStatic(root?._lfNodeOwner)) return null
  let mesh = visualRoot(root)
  for (const index of path) {
    mesh = mesh?.children[index]
    if (!mesh || mesh.userData.kind === 'object') return null
  }
  return mesh && visibleInScene(mesh, graph.vp.scene) && candidateMesh(mesh) ? mesh : null
}
