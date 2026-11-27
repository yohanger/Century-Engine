// Impactos de precipitación sobre geometría y materiales: independiente del sistema de fluidos.
import * as THREE from 'three'
import { effectiveMaterialObject, normalizedRunoff } from '../render/material-resource.js'
import { roadSlotMaterial } from '../render/road-material.js'
import { surfaceOf } from '../layers.js'

export const rainImpactMethods = {
  rainAudioImpact(hit) { this._rainAudioImpact?.(hit) },
  /** Devuelve la primera cara sólida atravesada por una gota visible. El suelo se consulta aparte. */
  rainImpact(from, to) {
    const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2])
    const length = dir.length()
    if (!(length > 0)) return null
    if (!this._rainRay) this._rainRay = new THREE.Raycaster()
    const ray = this._rainRay
    ray.set(new THREE.Vector3(...from), dir.divideScalar(length))
    ray.near = 0; ray.far = length
    // Refrescar lista por intervalo para no recorrer la escena en cada gota ni conservar geometría retirada.
    const now = performance.now()
    if (!this._rainMeshes || now - (this._rainMeshStamp || 0) > 300) {
      this._rainMeshes = []
      this._rainOwners = new WeakMap()
      const types = new Set(['primitive', 'mesh', 'road', 'text'])
      for (const [id, node] of this.nodes) {
        if (!types.has(this.host.getObject(id)?.type)) continue
        node.traverse((mesh) => {
          if (!mesh.isMesh || !mesh.geometry || mesh.userData.helper || mesh.material?.visible === false) return
          for (let parent = mesh; parent; parent = parent.parent) if (!parent.visible) return
          this._rainMeshes.push(mesh)
          this._rainOwners.set(mesh, id)
        })
      }
      this._rainMeshStamp = now
    }
    const hit = ray.intersectObjects(this._rainMeshes, false)[0]
    if (!hit?.face) return null
    const normal = hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize()
    const id = this._rainOwners.get(hit.object), obj = id ? this.host.getObject(id) : null
    const materials = this.host.project?.materials || []
    // Una superficie física debe ser estática. La identificación se comparte con el audio futuro.
    const slot = obj?.type === 'road' && hit.object.userData.roadSlot
      ? obj.props?.slots?.[hit.object.userData.roadSlot] : null
    const resolved = slot ? roadSlotMaterial(slot, hit.object.userData.roadSlot, materials)
      : effectiveMaterialObject(obj, materials)
    const motion = obj?.physics?.type || obj?.physics?.mode || obj?.physics
    const stationary = !motion || motion === 'static' || motion === 'Static'
    let runoff = null
    try { if (stationary && resolved?.mat?.runoff?.enabled) runoff = normalizedRunoff(resolved.mat.runoff) }
    catch { /* dato inválido: nunca habilitar una superficie física */ }
    return { point: hit.point.toArray(), normal: normal.toArray(), ownerId: id || null,
      materialId: slot?.materialId || obj?.materialId || '', surface: this.host.project?.tagLayers && obj ? surfaceOf(this.host.project.tagLayers, obj) : '',
      rainAudio: resolved?.mat?.rainAudio || null, runoff }
  },
}
