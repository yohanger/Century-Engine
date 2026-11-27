// Adaptador integrado en el árbol de escena real de Century.
// Reutiliza el SceneGraph y el cálculo de límites; no crea cuerpos físicos nuevos.
import * as THREE from 'three'
import { fitBoxBounds } from './box-fit-bounds.js'

const PHYSICS = new Set(['staticbody3d','rigidbody3d','characterbody3d','area3d'])
const VISUAL = new Set(['primitive','mesh'])
const isMesh = mesh => mesh.isMesh && mesh.geometry && !mesh.userData?.helper && !mesh.userData?.pickProxy

/** Solo identifica la geometría del mismo cuerpo, sin atravesar cuerpos físicos hijos.
 * Los proyectos existentes sin autoFit conservan dimensiones manuales. */
export function hasBoxFitGeometry(objects, shape) {
  const map=new Map(objects.map(o=>[o.id,o]))
  const body=map.get(shape?.parentId)
  if(!body || !PHYSICS.has(body.type)) return false
  const belongs=o=>{
    const visited=new Set()
    for(let cursor=o;cursor;cursor=map.get(cursor.parentId)) {
      if(visited.has(cursor.id) || cursor.visible===false) return false
      visited.add(cursor.id)
      if(cursor.id===body.id) return true
      if(PHYSICS.has(cursor.type)) return false
    }
    return false
  }
  return objects.some(o=>VISUAL.has(o.type) && belongs(o))
}

/** Calcula en el espacio local de la forma, nunca en unidades arbitrarias de escala.
 * Devuelve null si no hay geometría válida; no asigna el cubo predeterminado 1³.
 * Un cuerpo anidado interrumpe la búsqueda para impedir colisión compartida accidental.
 */
export function fitCollisionBoxFromScene(objects, nodes, shapeId) {
  const byId = new Map(objects.map(o => [o.id,o]))
  const shape = byId.get(shapeId)
  const body = byId.get(shape?.parentId)
  if (!shape || shape.type !== 'collisionshape3d' || shape.props?.shape?.type !== 'BoxShape3D' || !PHYSICS.has(body?.type)) return null
  const node = nodes.get(shapeId)
  if (!node) return null
  node.updateWorldMatrix(true,false)
  const inverse = node.matrixWorld.clone().invert()
  const parts = []
  const descendants = new Map()
  for (const o of objects) {
    if (!o.parentId) continue
    if (!descendants.has(o.parentId)) descendants.set(o.parentId,[])
    descendants.get(o.parentId).push(o)
  }
  const visited = new Set()
  const visit = id => {
    if (visited.has(id)) return
    visited.add(id)
    for (const obj of descendants.get(id) || []) {
      if (PHYSICS.has(obj.type) || obj.type === 'collisionshape3d' || obj.visible === false) continue
      if (VISUAL.has(obj.type) && obj.visible !== false) {
        const root = nodes.get(obj.id)
        if (root) {
          root.updateWorldMatrix(true,true)
          root.traverse(m => {
            // No incluir geometrías auxiliares o interiores a otro objeto-nodo.
            if (!isMesh(m) || !m.visible) return
            if (m !== root && m.userData?.kind === 'object') return
            // traverse() entra en subárboles de otros nodos: descartarlos explícitamente.
            for (let cursor=m.parent; cursor && cursor!==root; cursor=cursor.parent) {
              if (cursor.userData?.kind==='object') return
            }
            if (!m.geometry.boundingBox) m.geometry.computeBoundingBox()
            const bbox = m.geometry.boundingBox
            if (!bbox || bbox.isEmpty()) return
            const toShape = inverse.clone().multiply(m.matrixWorld)
            parts.push({ min:bbox.min.toArray(),max:bbox.max.toArray(),matrix:toShape.elements.slice() })
          })
        }
      }
      // Los contenedores Node3D o Group pueden tener primitiva dentro.
      visit(obj.id)
    }
  }
  visit(body.id)
  const bounds = fitBoxBounds(parts)
  if (!bounds) return null
  // La coordenada central está en el marco rotado actual de CollisionShape3D;
  // al aplicarla como delta de posición conservamos su rotación y escala 1.
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(
    (shape.rotation?.[0] || 0)*Math.PI/180,
    (shape.rotation?.[1] || 0)*Math.PI/180,
    (shape.rotation?.[2] || 0)*Math.PI/180,'YXZ'))
  const delta = new THREE.Vector3(...bounds.center).applyQuaternion(q)
  const position = (shape.position || [0,0,0]).map((v,i) => +(v+delta.getComponent(i)).toFixed(6))
  return {size:bounds.size.map(v=>+v.toFixed(6)),position,meshCount:bounds.meshCount}
}
