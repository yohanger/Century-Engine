// Sesión de edición de malla · constantes y ayudas compartidas (colores del resaltado, modos, caída suave, materiales de la superposición, geometría de rayos).
import * as THREE from 'three'

export const C_EDGE = new THREE.Color('#34445a'), C_SEL = new THREE.Color('#ffb547'), C_VERT = new THREE.Color('#2f78c4'), C_SELFACE = 0xffb547
export const MODES = ['vertex', 'edge', 'face']
export const FALLOFF = {
  smooth: (t) => 1 - (3 * t * t - 2 * t * t * t), sphere: (t) => Math.sqrt(Math.max(0, 1 - t * t)), root: (t) => 1 - Math.sqrt(t),
  linear: (t) => 1 - t, sharp: (t) => (1 - t) * (1 - t), constant: () => 1,
}

// Materiales del overlay compartidos entre sesiones: así three.js no descarta y recompila sus programas al entrar/salir de edición.
let _om = null
export function overlayMats() {
  return (_om ||= {
    lines: new THREE.LineBasicMaterial({ vertexColors: true, depthTest: true }),
    points: new THREE.PointsMaterial({ vertexColors: true, size: 6, sizeAttenuation: false, depthTest: true }),
    fdots: new THREE.PointsMaterial({ vertexColors: true, size: 5, sizeAttenuation: false, depthTest: true }),
    fsel: new THREE.MeshBasicMaterial({ color: C_SELFACE, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    nlines: new THREE.LineBasicMaterial({ color: 0x4fd1c5 }),
    preview: new THREE.LineBasicMaterial({ color: 0xffd479, depthTest: false }),
  })
}


// parámetro t del punto de la recta (o, dir) más cercano al rayo
export function rayLineParam(ray, o, dir) {
  const w0 = ray.origin.clone().sub(o)
  const a = ray.direction.dot(ray.direction), b = ray.direction.dot(dir), c = dir.dot(dir)
  const d = ray.direction.dot(w0), e = dir.dot(w0)
  const den = a * c - b * b
  if (Math.abs(den) < 1e-9) return 0
  return (a * e - b * d) / den
}
