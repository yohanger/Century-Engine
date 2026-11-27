// BatchedMesh oficial para decoración marcada por el autor. Se monta solo en Play/Player.
// Mantiene intactos los nodos originales, sus referencias y colisiones Jolt.
import * as THREE from 'three'

const MIN_GROUP = 3
const MAX_GROUP = 64
const MAX_VERTICES = 65535
const MAX_INDICES = 180000
const MAPS = ['map', 'lightMap', 'aoMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'bumpMap', 'alphaMap', 'displacementMap', 'envMap', 'clearcoatMap', 'clearcoatNormalMap', 'transmissionMap', 'sheenColorMap', 'iridescenceMap']

function isSimpleMaterial(m) {
  if (!m?.isMeshPhysicalMaterial || m.transparent || m.opacity !== 1 || m.wireframe || m.alphaTest || m.vertexColors || m.skinning || m.morphTargets) return false
  if (MAPS.some((k) => m[k]) || m.userData?.rt || m.userData?.rtShArr || m.userData?.rtPsx || m.userData?.rtPsxAffine) return false
  // El material avanzado y los hooks del usuario no se pueden compartir por objeto.
  if (m.clearcoat || m.transmission || m.sheen || m.iridescence || m.anisotropy) return false
  if (m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile && !m.userData?.rtLfEffects) return false
  return true
}

/** Solo atributos equivalentes y triángulos de una sola submalla. */
function geometryKey(g) {
  if (!g?.isBufferGeometry || g.groups.length || g.morphAttributes && Object.values(g.morphAttributes).some((a) => a.length) || !g.attributes.position) return null
  const attrs = Object.entries(g.attributes).sort(([a], [b]) => a.localeCompare(b))
  if (!attrs.every(([k, a]) => ['position', 'normal', 'uv'].includes(k) && !a.isInterleavedBufferAttribute && !a.isInstancedBufferAttribute)) return null
  return JSON.stringify({ idx: !!g.index, attrs: attrs.map(([k, a]) => [k, a.itemSize, a.normalized, a.array.constructor.name]) })
}

function materialKey(m) {
  return JSON.stringify([m.type, m.color.getHexString(), m.emissive.getHexString(), m.emissiveIntensity, m.roughness, m.metalness, m.side, m.flatShading, m.envMapIntensity, m.ior, m.thickness, m.sheenRoughness])
}

export function batchCandidate(obj, node) {
  if (!(obj.type === 'primitive' || obj.type === 'mesh') || obj.props?.batchStatic !== true || obj.visible === false || obj.gi === 'lightmap') return null
  if (obj.parentId || node.children.some((c) => c.userData?.kind === 'object')) return null
  if (obj.mat?.shader || obj.mat?.physical && Object.values(obj.mat.physical).some((v) => typeof v === 'number' && v !== 0 && v !== 1.5 && v !== 1)) return null
  let mesh = null, invalid = false
  node.traverse((m) => {
    if (!m.isMesh) return
    if (mesh || m.isSkinnedMesh || m.isInstancedMesh || m.isBatchedMesh || !m.visible || m.userData?.helper || m.userData?.isHelper) { invalid = true; return }
    mesh = m
  })
  if (invalid || !mesh || mesh.material?.isMaterial !== true || !isSimpleMaterial(mesh.material)) return null
  const gk = geometryKey(mesh.geometry)
  if (!gk) return null
  const vertexCount = mesh.geometry.attributes.position.count
  const indexCount = mesh.geometry.index?.count ?? vertexCount
  if (!vertexCount || vertexCount > MAX_VERTICES || indexCount > MAX_INDICES || !Number.isFinite(vertexCount + indexCount)) return null
  mesh.updateWorldMatrix(true, false)
  // BatchedMesh r170 no soporta matrices de determinante negativo.
  if (!(mesh.matrixWorld.determinant() > 0) || obj.castShadow === false) return null
  return { mesh, geometry: mesh.geometry, vertexCount, indexCount, key: gk + '|' + materialKey(mesh.material) }
}

export class StaticBatcher {
  constructor(scene) {
    this.ed = scene
    this.batches = []
    this.originals = []
    this.stats = { batches: 0, objects: 0, skipped: 0, reason: '' }
  }

  attach() {
    const renderer = this.ed.vp.renderer
    if (!renderer?.extensions?.has?.('WEBGL_multi_draw')) {
      this.stats.reason = 'WEBGL_multi_draw no disponible: se conserva el render original'
      return this.stats
    }
    const groups = new Map()
    for (const obj of this.ed.host.project?.objects || []) {
      if (obj.props?.batchStatic !== true) continue
      const node = this.ed.nodes?.get(obj.id)
      const candidate = node && batchCandidate(obj, node)
      if (!candidate) { this.stats.skipped++; continue }
      if (!groups.has(candidate.key)) groups.set(candidate.key, [])
      groups.get(candidate.key).push(candidate)
    }
    try {
      for (const candidates of groups.values()) {
        for (let i = 0; i < candidates.length; i += MAX_GROUP) {
          const group = candidates.slice(i, i + MAX_GROUP)
          if (group.length < MIN_GROUP) { this.stats.skipped += group.length; continue }
          const geometries = new Map()
          let verts = 0, indices = 0
          for (const c of group) if (!geometries.has(c.geometry)) { geometries.set(c.geometry, null); verts += c.vertexCount; indices += c.indexCount }
          if (verts > MAX_VERTICES || indices > MAX_INDICES) { this.stats.skipped += group.length; continue }
          const batch = new THREE.BatchedMesh(group.length, verts, indices, group[0].mesh.material)
          batch.raycast = () => {} // solo dibuja: los rayos siguen apuntando a las mallas originales
          try {
            for (const g of geometries.keys()) geometries.set(g, batch.addGeometry(g))
            for (const c of group) {
              const id = batch.addInstance(geometries.get(c.geometry))
              batch.setMatrixAt(id, c.mesh.matrixWorld)
            }
            batch.castShadow = group[0].mesh.castShadow
            batch.receiveShadow = group[0].mesh.receiveShadow
            batch.frustumCulled = false // cada instancia conserva el frustum culling del addon
            this.ed.vp.scene.add(batch)
            this.batches.push(batch)
            for (const c of group) { this.originals.push({ mesh: c.mesh, wasVisible: c.mesh.visible }); c.mesh.visible = false }
            this.stats.batches++; this.stats.objects += group.length
          } catch (err) { batch.dispose(); throw err }
        }
      }
    } catch (err) {
      this.detach() // rollback completo si falla una geometría o un recurso
      this.stats.reason = `Batch cancelado: ${err.message}`
      console.warn('BatchedMesh', err)
    }
    Object.assign(this.ed.vp.perf?.stats?.extra || {}, { batchedMeshes: this.stats.batches, batchedObjects: this.stats.objects })
    this.ed.vp.requestRender()
    return this.stats
  }

  detach() {
    for (const { mesh, wasVisible } of this.originals) mesh.visible = wasVisible
    this.originals.length = 0
    for (const batch of this.batches) { batch.parent?.remove(batch); batch.dispose() }
    this.batches.length = 0
    if (this.ed.vp.perf?.stats?.extra) { this.ed.vp.perf.stats.extra.batchedMeshes = 0; this.ed.vp.perf.stats.extra.batchedObjects = 0 }
    this.ed.vp.requestRender()
  }
}
