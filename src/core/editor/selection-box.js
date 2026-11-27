import * as THREE from 'three'
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'

const activeMaterial = new LineMaterial({ color: 0xffb547, linewidth: 3, depthTest: false, depthWrite: false, toneMapped: false })
const secondaryMaterial = new LineMaterial({ color: 0x38d6f0, linewidth: 2.25, depthTest: false, depthWrite: false, toneMapped: false })
const edgePositions = []
for (const a of [-0.5, 0.5]) for (const b of [-0.5, 0.5]) {
  edgePositions.push(-0.5, a, b, 0.5, a, b)
  edgePositions.push(a, -0.5, b, a, 0.5, b)
  edgePositions.push(a, b, -0.5, a, b, 0.5)
}

export function configureSelectionBoxes(prefs) {
  const color = /^#[0-9a-f]{6}$/i.test(prefs?.selectionOutlineColor) ? prefs.selectionOutlineColor : '#ffb547'
  const width = THREE.MathUtils.clamp(Number(prefs?.selectionOutlineWidth) || 1.5, 0.5, 4)
  const strength = THREE.MathUtils.clamp(Number(prefs?.selectionOutlineStrength) || 3, 0.5, 6)
  activeMaterial.color.set(color)
  secondaryMaterial.color.set(color).lerp(new THREE.Color('#35d7ee'), 0.72)
  activeMaterial.linewidth = THREE.MathUtils.clamp(width + strength * 0.55, 2, 6)
  secondaryMaterial.linewidth = THREE.MathUtils.clamp(width + strength * 0.2, 1.5, 4.5)
}

export function makeSelectionBox(node, active) {
  const geometry = new LineSegmentsGeometry()
  geometry.setPositions(edgePositions)
  const box = new LineSegments2(geometry, active ? activeMaterial : secondaryMaterial)
  const bounds = new THREE.Box3()
  const center = new THREE.Vector3()
  const size = new THREE.Vector3()
  const minSize = new THREE.Vector3(0.15, 0.15, 0.15)
  box.frustumCulled = false
  box.renderOrder = 10010
  box.userData.editorSelectionHighlight = true
  box.update = () => {
    if (!node.parent || !node.visible) { box.visible = false; return }
    bounds.setFromObject(node)
    if (bounds.isEmpty()) {
      node.getWorldPosition(center)
      size.setScalar(0.35)
    } else {
      bounds.getCenter(center)
      bounds.getSize(size)
      size.max(minSize)
    }
    box.position.copy(center)
    box.scale.copy(size)
    box.visible = true
  }
  box.update()
  return box
}
