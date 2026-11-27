import * as THREE from 'three'
import { MeshBVH, MeshBVHUniformStruct, FloatVertexAttributeTexture } from 'three-mesh-bvh'

export function buildBvh(occluders, withSurface = false) {
  let total = 0
  for (const o of occluders) total += o.index?.length ?? (o.position.length / 3)
  const pos = new Float32Array(total * 3), alb = new Float32Array(total * 4), emission = new Float32Array(total * 4)
  const surface = withSurface ? new Float32Array(total * 4) : null
  let vertex = 0
  const world = new THREE.Matrix4(), p = new THREE.Vector3()
  for (const { position, index, matrix, color, emission: le, surface: reflectance } of occluders) {
    world.fromArray(matrix)
    const count = index?.length ?? (position.length / 3)
    for (let i = 0; i < count; i++, vertex++) {
      p.fromArray(position, (index ? index[i] : i) * 3).applyMatrix4(world).toArray(pos, vertex * 3)
      alb.set(color, vertex * 4)
      alb[vertex * 4 + 3] = 1
      if (le) emission.set(le, vertex * 4)
      if (surface && reflectance) surface.set(reflectance, vertex * 4)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geometry.setAttribute('albedo', new THREE.BufferAttribute(alb, 4))
  const bvh = new MeshBVH(geometry, { maxLeafTris: 4 })
  const uni = new MeshBVHUniformStruct(); uni.updateFrom(bvh)
  const albTex = new FloatVertexAttributeTexture(); albTex.updateFrom(geometry.attributes.albedo)
  const emissionTex = new FloatVertexAttributeTexture()
  emissionTex.updateFrom(new THREE.BufferAttribute(emission, 4))
  const box = new THREE.Box3().setFromBufferAttribute(geometry.attributes.position)
  const surfaceTex = surface ? new FloatVertexAttributeTexture() : null
  if (surfaceTex) surfaceTex.updateFrom(new THREE.BufferAttribute(surface, 4))
  return { geometry, bvh, uni, albTex, emissionTex, surfaceTex, box, tris: total / 3 }
}

