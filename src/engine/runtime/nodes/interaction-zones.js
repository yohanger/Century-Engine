import * as THREE from 'three'
import { normalizeIndicatorZones } from '../interaction/volumes.js'

// Ayudas del editor: se dibujan como líneas y nunca participan en colisiones ni raycasts.
export function updateIndicatorGizmos(root, raw, reach, enabled = true) {
  const key = JSON.stringify([raw, reach, enabled])
  if (root.userData.indicatorGizmoKey === key) return
  root.userData.indicatorGizmoKey = key
  const old = root.userData.indicatorZonesGizmo
  if (old) {
    old.parent?.remove(old)
    old.traverse((m) => { m.geometry?.dispose(); m.material?.dispose() })
  }
  if (!enabled) { root.userData.indicatorZonesGizmo = null; return }
  const cfg = normalizeIndicatorZones(raw, reach)
  const group = new THREE.Group()
  for (const [name, color] of [['ring', 0x4d9bd1], ['key', 0x36b787]]) {
    const spec = cfg[name]
    const geo = spec.shape === 'box'
      ? new THREE.EdgesGeometry(new THREE.BoxGeometry(...spec.size))
      : new THREE.WireframeGeometry(new THREE.SphereGeometry(spec.radius, 16, 10))
    const line = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.45, depthTest: false }))
    line.position.set(...spec.offset)
    line.rotation.order = 'YXZ'; line.rotation.set(...spec.rotation.map((n) => n * Math.PI / 180))
    line.userData.editorOnly = true; line.userData.helper = true
    line.raycast = () => {}; line.renderOrder = 20
    group.add(line)
  }
  // Las ayudas se cuelgan de la raíz para que no hereden la escala visual del modelo.
  group.userData.editorOnly = true; group.userData.helper = true
  root.userData.indicatorZonesGizmo = group
  root.add(group)
}
