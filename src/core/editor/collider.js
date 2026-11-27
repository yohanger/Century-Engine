// Vista de autoría del collider. No crea cuerpos de física ni se serializa en la escena.
import { acquirePointer } from '../../engine/runtime/input/pointer-capture.js'
import * as THREE from 'three'
import { store, getObject, updateObject } from '../store.js'
import { localBox } from '../../engine/runtime/physics/bodies.js'
import { colliderBounds } from '../../engine/runtime/physics/collider-shape.js'
import { gizmoScale } from '../../engine/render/gizmo-size.js'

const AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)]
const pickable = (obj) => ['primitive', 'mesh', 'model'].includes(obj?.type) && (obj.props?.dynamic || obj.props?.floats)

function geometryOf(bounds) {
  const { kind, size, radius, halfHeight } = bounds
  if (kind === 'sphere') return new THREE.SphereGeometry(radius, 24, 12)
  if (kind === 'capsule') return new THREE.CapsuleGeometry(radius, halfHeight * 2, 8, 20)
  return new THREE.BoxGeometry(size.x, size.y, size.z)
}

function reach(b, i) {
  if (b.kind === 'sphere') return b.radius
  if (b.kind === 'capsule') return i === 1 ? b.radius + b.halfHeight : b.radius
  return b.size.getComponent(i) / 2
}

/** Del movimiento del asa a la extensión de la forma que consumirá Jolt. */
export function extensionFactor(kind, axis) {
  if (kind === 'sphere') return 6
  if (kind === 'capsule' && axis !== 1) return 4
  return 2
}

export const colliderMethods = {
  _colliderClear(node) {
    const g = node?.userData?.colliderGizmo
    if (!g) return
    g.traverse((part) => { if (part.geometry && part.geometry !== g.userData.handleGeometry) part.geometry.dispose(); part.material?.dispose() })
    g.userData.handleGeometry?.dispose()
    g.removeFromParent()
    node.userData.colliderGizmo = null
  },

  /** La geometría de las asas depende de la forma de Jolt, no de un tamaño visual aproximado. */
  _colliderSync(node, selected, enabled) {
    if (!node) return
    const obj = getObject(node.userData.id)
    const visible = !!enabled && !store.play.on && !this.edit && store.colliderPreview !== false && pickable(obj)
    const old = node.userData.colliderGizmo
    if (!visible) { if (old) old.visible = false; return }
    const b = colliderBounds(localBox(node), obj.props)
    let group = old
    if (!group) {
      group = new THREE.Group()
      group.userData.helper = true
      group.userData.pickIgnore = true
      group.userData.handles = []
      node.add(group)
      node.userData.colliderGizmo = group
      const outline = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x61d3b3, depthTest: false, transparent: true, opacity: 0.86 }))
      outline.userData.helper = true
      outline.renderOrder = 998
      group.add(outline)
      group.userData.outline = outline
      const small = new THREE.SphereGeometry(0.09, 10, 8)
      for (let i = -1; i < 3; i++) for (const side of (i === -1 ? [0] : [-1, 1])) {
        const handle = new THREE.Mesh(small, new THREE.MeshBasicMaterial({ color: i === -1 ? 0xffffff : [0xee6c68, 0x9ee36e, 0x71a9ee][i], depthTest: false }))
        handle.userData = { helper: true, pickIgnore: true, colliderAxis: i, colliderSide: side }
        handle.renderOrder = 999
        handle.frustumCulled = false
        group.add(handle)
        group.userData.handles.push(handle)
      }
      group.userData.handleGeometry = small
    }
    group.visible = true
    for (const handle of group.userData.handles) handle.visible = !!selected
    group.position.copy(b.center)
    const outline = group.userData.outline
    const signature = [b.kind, b.size.x, b.size.y, b.size.z, b.radius, b.halfHeight].join('|')
    if (group.userData.shapeSignature !== signature) {
      outline.geometry.dispose()
      const solid = geometryOf(b)
      outline.geometry = new THREE.EdgesGeometry(solid, b.kind === 'box' ? 1 : 12)
      solid.dispose()
      group.userData.shapeSignature = signature
    }
    for (const handle of group.userData.handles) {
      const i = handle.userData.colliderAxis, side = handle.userData.colliderSide
      handle.position.set(0, 0, 0)
      if (i >= 0) handle.position.setComponent(i, side * reach(b, i))
      handle.scale.setScalar(gizmoScale(store.prefs.gizmoSize))
    }
    group.userData.bounds = b
    this.vp.requestRender()
  },

  _colliderDown(e) {
    if (store.tool !== 'select' || this._anyAxis() || store.play.on || this.edit || store.selectedIds.length !== 1) return false
    const node = this.nodes.get(store.selectedId), g = node?.userData?.colliderGizmo
    if (!g?.visible) return false
    const hit = this.raycaster.intersectObjects(g.userData.handles, false)[0]
    if (!hit) return false
    const handle = hit.object, axis = handle.userData.colliderAxis
    const side = handle.userData.colliderSide
    const direction = axis >= 0 ? AXES[axis].clone().applyQuaternion(node.getWorldQuaternion(new THREE.Quaternion())) : null
    const forward = this.vp.camera.getWorldDirection(new THREE.Vector3())
    // Plano que mira hacia cámara y contiene el eje de extensión.
    const normal = direction ? forward.clone().addScaledVector(direction, -forward.dot(direction)) : forward
    if (normal.lengthSq() < 1e-6) normal.copy(new THREE.Vector3(0, 1, 0).addScaledVector(direction, -direction.y))
    normal.normalize()
    const origin = handle.getWorldPosition(new THREE.Vector3())
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, origin)
    const point = this.raycaster.ray.intersectPlane(plane, new THREE.Vector3())
    if (!point) return false
    const obj = getObject(node.userData.id)
    if (!acquirePointer(this.dom, e, "Collider")) return true
    this._colliderDrag = { id: obj.id, node, axis, side, direction, plane, point, start: [...(axis < 0 ? obj.props.bodyOffset || [0,0,0] : obj.props.bodyExtension || [0,0,0])],
      size: g.userData.bounds.size.clone(), kind: g.userData.bounds.kind, moved: false }
    this.vp.controls.enabled = false
    return true
  },

  _colliderMove() {
    const d = this._colliderDrag
    if (!d) return false
    const pt = this.raycaster.ray.intersectPlane(d.plane, new THREE.Vector3())
    if (!pt) return true
    const vals = [...d.start]
    if (d.axis < 0) {
      const from = d.node.worldToLocal(d.point.clone()), to = d.node.worldToLocal(pt.clone())
      const delta = to.sub(from)
      for (let i = 0; i < 3; i++) vals[i] += delta.getComponent(i)
    } else {
      const delta = pt.sub(d.point).dot(d.direction) * d.side * extensionFactor(d.kind, d.axis)
      vals[d.axis] += delta
      vals[d.axis] = Math.max(d.start[d.axis] + 0.04 - d.size.getComponent(d.axis), vals[d.axis])
    }
    if (!vals.every(Number.isFinite)) return true
    const key = d.axis < 0 ? 'bodyOffset' : 'bodyExtension'
    if (vals.some((v, i) => Math.abs(v - (getObject(d.id)?.props?.[key]?.[i] || 0)) > 1e-5)) {
      d.moved = true
      updateObject(d.id, { props: { [key]: vals } }, { commit: false })
    }
    return true
  },

  _colliderUp() {
    const d = this._colliderDrag
    if (!d) return false
    this._colliderDrag = null
    this.vp.controls.enabled = true
    if (d.moved) updateObject(d.id, {}, { label: d.axis < 0 ? 'Mover Offset de colisión' : 'Modificar Extensión de colisión' })
    return true
  },
}
