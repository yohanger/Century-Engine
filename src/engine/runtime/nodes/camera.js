import * as THREE from 'three'
import { registerNode } from './registry.js'
import { makeRoot, applyBase, iconMat } from './three-helpers.js'

/** Pirámide de visión (16:9, 3 m de largo) como la cámara de Unity: apunta hacia -Z. */
function setFrustum(fr, fov, len = 3, aspect = 16 / 9) {
  const h = Math.tan((fov * Math.PI) / 360) * len, w = h * aspect
  const c = [[-w, h], [w, h], [w, -h], [-w, -h]].map(([x, y]) => [x, y, -len])
  const pts = []
  for (let i = 0; i < 4; i++) { pts.push(0, 0, 0, ...c[i]); pts.push(...c[i], ...c[(i + 1) % 4]) }
  fr.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  fr.geometry.computeBoundingSphere()
  fr.userData.fov = fov
  fr.userData.length = len
}

export default registerNode({
  type: 'camera',
  label: 'Cámara',
  icon: 'camera',
  category: 'Gameplay',
  scalable: false,
  animation: {
    'camera.main': {
      label: 'Cámara principal', kind: 'bool', def: false,
      read: obj => obj.props?.main === true,
      runtimeRead: (root, obj) => root.userData.timelineMain ?? (obj.props?.main === true),
      apply: (root, value) => { root.userData.timelineMain = value },
      capture: root => ({ had: Object.hasOwn(root.userData, 'timelineMain'), value: root.userData.timelineMain }),
      restore: (root, snapshot) => {
        if (snapshot?.had) root.userData.timelineMain = snapshot.value
        else delete root.userData.timelineMain
      },
    },
    'camera.fov': {
      label: 'FOV °', kind: 'number', def: 70, min: 10, max: 140,
      read: obj => obj.props?.fov ?? 70,
      runtimeRead: (root, obj) => root.userData.timelineFov ?? obj.props?.fov ?? 70,
      apply: (root, value) => {
        root.userData.timelineFov = value
        if (root.userData.frustum) setFrustum(root.userData.frustum, value, root.userData.editorPlayerCamera ? 0.4 : 3)
      },
      capture: root => ({ value: root.userData.timelineFov, fov: root.userData.frustum?.userData.fov }),
      restore: (root, snapshot, obj) => {
        if (snapshot?.value === undefined) delete root.userData.timelineFov
        else root.userData.timelineFov = snapshot.value
        if (root.userData.frustum) setFrustum(root.userData.frustum,
          snapshot?.fov ?? obj.props?.fov ?? 70, root.userData.editorPlayerCamera ? 0.4 : 3)
      },
    },
  },
  create: () => ({ name: 'Cámara', collision: false, color: '#e3b341', props: { fov: 70, main: false } }),

  build(obj) {
    const { root, visual } = makeRoot(obj)
    const mat = iconMat(obj.color)
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.6), mat)
    const lens = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.4, 4), mat)
    lens.rotation.x = Math.PI / 2
    lens.position.z = -0.5
    root.userData.iconMat = mat
    const fr = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: obj.color, transparent: true, opacity: 0.8 }))
    fr.raycast = () => {}
    root.userData.frustum = fr
    fr.userData.helper = true
    root.userData.editorGizmos = [fr]
    setFrustum(fr, obj.props.fov || 70)
    visual.add(body, lens, fr)
    return root
  },
  update(root, obj) {
    applyBase(root, obj, false)
    root.userData.iconMat.color.set(obj.color)
    const fr = root.userData.frustum
    fr.material.color.set(obj.color)
    const effectiveFov = root.userData.timelineFov ?? root.userData.editorPlayerFov ?? obj.props.fov ?? 70
    const length = root.userData.editorPlayerCamera ? 0.4 : 3
    if (fr.userData.fov !== effectiveFov || fr.userData.length !== length) setFrustum(fr, effectiveFov, length)
  },
})
