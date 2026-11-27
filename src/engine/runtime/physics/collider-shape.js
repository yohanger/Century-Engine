// Una sola regla para la forma física y su vista previa editorial.
// Offset y Extensión son metros locales del nodo, no escala adicional de la malla.
import * as THREE from 'three'

const clean = (a, min = -100000, max = 100000) => Array.from({ length: 3 }, (_, i) => {
  const n = Number(a?.[i])
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : 0
})

export function colliderShapeDimensions(size, kind = 'box') {
  if (kind === 'sphere') return { radius: Math.max(0.02, (size.x + size.y + size.z) / 6), halfHeight: 0 }
  if (kind === 'capsule') {
    const radius = Math.max(0.02, (size.x + size.z) / 4)
    return { radius, halfHeight: Math.max(0.001, size.y / 2 - radius) }
  }
  return { radius: 0, halfHeight: 0 }
}

/** Devuelve los valores exactos que recibirá BodySet, sin modificar la caja de la geometría. */
export function colliderBounds(box, props = {}) {
  const off = clean(props.bodyOffset), ext = clean(props.bodyExtension, -10000, 10000)
  const center = box.center.clone().add(new THREE.Vector3(...off))
  const size = box.size.clone().add(new THREE.Vector3(...ext)).max(new THREE.Vector3(0.04, 0.04, 0.04))
  const kind = ['box', 'sphere', 'capsule'].includes(props.bodyShape) ? props.bodyShape : 'box'
  return { center, size, kind, ...colliderShapeDimensions(size, kind) }
}
