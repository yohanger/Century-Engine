// Triángulos de malla real en coordenadas locales de CollisionShape3D.
// Se usan tanto en el visor editorial como en Jolt (una única fuente de geometría).
import * as THREE from 'three'

const LIMIT_TRIANGLES = 200000
const LIMIT_VERTICES = 450000
const M = new THREE.Matrix4(), V = new THREE.Vector3()

/** Obtiene geometría triangulada, incluyendo transformación de primitivas y mallas editadas. */
export function triMeshGeometry(sourceRoot, shapeRoot) {
  if (!sourceRoot?.userData?.visual || !shapeRoot) throw new Error('TriMeshShape3D: la malla no existe en la escena')
  sourceRoot.updateWorldMatrix(true, true)
  shapeRoot.updateWorldMatrix(true, true)
  const inverse = shapeRoot.matrixWorld.clone().invert()
  const positions = [], indices = []
  sourceRoot.userData.visual.traverse((mesh) => {
    if (!mesh.isMesh || mesh.userData?.helper || mesh.userData?.pickProxy || !mesh.visible || !mesh.geometry) return
    const attr = mesh.geometry.getAttribute('position')
    if (!attr || attr.itemSize !== 3) return
    if (attr.count + positions.length / 3 > LIMIT_VERTICES) throw new Error('TriMeshShape3D excede el límite de vértices')
    const geomIndex = mesh.geometry.index
    const size = geomIndex ? geomIndex.count : attr.count
    if (size % 3 || indices.length / 3 + size / 3 > LIMIT_TRIANGLES) throw new Error('TriMeshShape3D: malla triangular inválida o demasiado grande')
    mesh.updateWorldMatrix(true, false)
    M.copy(inverse).multiply(mesh.matrixWorld)
    const mirrored = M.determinant() < 0
    const offset = positions.length / 3
    for(let v=0;v<attr.count;v++) {
      V.fromBufferAttribute(attr,v).applyMatrix4(M)
      if(![V.x,V.y,V.z].every(Number.isFinite)) throw new Error('TriMeshShape3D: vértice no finito')
      positions.push(V.x,V.y,V.z)
    }
    const get = i => geomIndex ? geomIndex.getX(i) : i
    for(let i=0;i<size;i+=3) {
      const a=get(i),b=get(i+1),c=get(i+2)
      if (![a,b,c].every(n=>Number.isInteger(n)&&n>=0&&n<attr.count)) throw new Error('TriMeshShape3D: índice inválido')
      if(a===b||b===c||c===a) continue
      if(mirrored) indices.push(offset+a,offset+c,offset+b)
      else indices.push(offset+a,offset+b,offset+c)
    }
  })
  if (!indices.length) throw new Error('TriMeshShape3D: la malla no contiene triángulos válidos')
  return {positions:new Float32Array(positions),indices:new Uint32Array(indices),triangles:indices.length/3}
}
