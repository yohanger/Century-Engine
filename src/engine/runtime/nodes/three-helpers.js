import * as THREE from 'three'
import { DEG } from '../util.js'

export const iconMat = (c) => new THREE.MeshBasicMaterial({ color: c })
export const lineMat = (c, o = 1) => new THREE.LineBasicMaterial({ color: c, transparent: o < 1, opacity: o })

export const signature = (obj) => [
  obj.type, obj.kind, obj.modelId, obj.props?.steps, obj.kind === 'stairs' ? obj.props?.turn : '', obj.kind === 'stairs' ? obj.props?.sides : '', obj.kind === 'stairs' ? obj.props?.sideHeight : '', obj.kind === 'stairs' ? obj.props?.sideThickness : '', obj.kind === 'stairs' && (obj.props?.turn || (obj.props?.sides && obj.props.sides !== 'none')) ? `${obj.scale?.[0]}:${obj.scale?.[1]}:${obj.scale?.[2]}` : '', obj.light?.type,
  // El editor reconstruye el gráfico del evento cuando cambia la página previsualizada.
  obj.type === 'event' ? JSON.stringify(obj.props?.pages?.[0]?.graphic || null) : '',
  obj.type === 'gameplayObject' ? `${obj.props?.recordKind}:${obj.props?.recordId}` : '',
].join('|')

/** Nodo raíz sin escala (posición + rotación) y un hijo `visual` que lleva el tamaño propio. */
export function makeRoot(obj) {
  const root = new THREE.Group()
  const visual = new THREE.Group()
  root.add(visual)
  root.userData = { id: obj.id, kind: 'object', sig: signature(obj), visual }
  return { root, visual }
}

/** El contenedor espacial escala su jerarquía; las mallas conservan tamaño visual propio. */
export function nodeScaleTarget(root, type) {
  return type === 'node3d' || type === 'sceneInstance' ? root : (root.userData.visual || root)
}

export function applyBase(root, obj, scalable) {
  root.position.set(...obj.position)
  root.rotation.order = 'YXZ' // orden de Euler YXZ del proyecto
  root.rotation.set(obj.rotation[0] * DEG, obj.rotation[1] * DEG, obj.rotation[2] * DEG)
  if (scalable) root.userData.visual.scale.set(...obj.scale)
  else root.userData.visual.scale.set(1, 1, 1)
  root.visible = obj.visible
}

export function arrowToward(len, color) {
  // línea + punta apuntando a -Z (convención del proyecto)
  const g = new THREE.Group()
  g.userData.helper = true // orientación editorial: no intercepta clics de selección ni colocación
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -len)]), lineMat(color)))
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 12), iconMat(color))
  tip.rotation.x = -Math.PI / 2
  tip.position.z = -len
  g.add(tip)
  return g
}

/** Esfera invisible para poder seleccionar nodos sin geometría propia. */
export function hitSphere(r = 0.3) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), new THREE.MeshBasicMaterial({ visible: false }))
  m.userData.pickProxy = true // selección editorial deliberada; no se usa como superficie para insertar nodos
  return m
}
