// Vista previa segura compartida por Timeline y Cinematics; nunca despacha comandos, audio ni scripts.
// Trabaja solo sobre los nodos visuales existentes y siempre restaura la pose del editor.
import * as THREE from 'three'
import { evalTimelineCamera, evalTimelineNode, quatFromRot, resolveCamera3D } from '../../engine/runtime/timeline/eval.js'
import { sampleBakeTrack } from './physics.js'
import { DEG } from '../../engine/runtime/util.js'
import { localMatrix } from '../../engine/runtime/scene/matrix.js'
import { nodeAnimationProperty } from '../../engine/runtime/anim/model.js'
import { getDef } from '../../engine/runtime/nodes/registry.js'

export class TimelinePreview {
  constructor({ getEditor, getObjects, worldMatrix, getSceneId = () => null, onWarning = () => {} }) {
    this.getEditor = getEditor; this.getObjects = getObjects; this.worldMatrix = worldMatrix
    this.onWarning = onWarning
    this.getSceneId = getSceneId
    this.missingCameras = new Set()
    this.camera = new THREE.PerspectiveCamera(70, 1, .05, 3000)
    this.cameraOn = false
    this.previousCamera = null
    this.previousControlsEnabled = null
    this.saved = new Map()
    this.p = new THREE.Vector3(); this.q = new THREE.Quaternion(); this.s = new THREE.Vector3()
    this.pathGroup = null; this.pathSignature = ''; this.csgPreview = false
  }
  nodeOf(value, byId = false) {
    const objects = this.getObjects() || []
    const object = byId ? objects.find((o) => o.id === value) : objects.find((o) => o.name === value || o.id === value)
    const node = object && this.getEditor()?.nodes?.get(object.id)
    return node ? { o: object, n: node } : null
  }
  resolve(key) {
    if (key.mode === 'camera3d') {
      const pose = resolveCamera3D(key, this.getSceneId(), this.getObjects(), this.getEditor()?.nodes)
      const identity = JSON.stringify([key.sceneId, key.node])
      if (pose) this.missingCameras.delete(identity)
      else if (!this.missingCameras.has(identity)) {
        this.missingCameras.add(identity)
        this.onWarning(`Camera3D vinculada no disponible (${key.node || 'sin asignar'})`)
      }
      return pose
    }
    if (key.mode === 'node') {
      const found = this.nodeOf(key.node)
      if (found) {
        this.worldMatrix(found.o.id).decompose(this.p, this.q, this.s)
        return { pos: this.p.toArray(), quat: this.q.clone(), fov: found.o.type === 'camera' ? found.o.props?.fov || 70 : 70 }
      }
    }
    const camera = this.getEditor()?.vp?.persp
    return camera ? { pos: camera.position.toArray(), quat: camera.quaternion.clone(), fov: camera.fov }
      : { pos: key.pos, quat: quatFromRot(key.rot), fov: key.fov }
  }
  restoreNodes() {
    if (!this.saved.size) return
    const editor = this.getEditor()
    const objects = new Map((this.getObjects() || []).map(o => [o.id, o]))
    for (const [id, pose] of this.saved) {
      const node = editor?.nodes?.get(id)
      if (!node) continue
      const authored = objects.get(id)
      // Un cambio del Inspector durante Preview no puede quedar sustituido por una pose antigua.
      const changed = authored && JSON.stringify([authored.position, authored.rotation, authored.scale, authored.visible, authored.active, authored.light?.energy, authored.color]) !== pose.authored
      if (changed) {
        node.position.fromArray(authored.position || [0, 0, 0])
        node.rotation.order = 'YXZ'
        node.rotation.set(...(authored.rotation || [0, 0, 0]).map(v => v * DEG))
        ;(node.userData.visual || node).scale.fromArray(authored.scale || [1, 1, 1])
        node.visible = authored.active !== false && authored.visible !== false
      } else {
        node.position.copy(pose.pos); node.rotation.copy(pose.rot)
        ;(node.userData.visual || node).scale.copy(pose.scale)
        node.visible = pose.visible
      }
      if (pose.hadActiveOverride) node.userData._lfRuntimeActive = pose.activeOverride
      else delete node.userData._lfRuntimeActive
      if (pose.light && node.userData.light) {
        const light = node.userData.light
        const currentColor = changed ? authored.color : pose.light.color
        const currentEnergy = changed ? (Number(authored.light?.energy) || 0) * Math.PI : pose.light.intensity
        light.intensity = currentEnergy; light.color.set(currentColor)
        if (node.userData.fx) node.userData.fx.base = changed ? currentEnergy : pose.light.fxBase
        node.userData.iconMat?.color.set(currentColor)
        node.userData.refreshLightEffects?.()
      }
      for (const [prop, record] of pose.custom || []) {
        const descriptor = nodeAnimationProperty(authored, prop)
        if (!descriptor?.ownerType) continue
        const current = descriptor.read(authored)
        if (JSON.stringify(current) !== JSON.stringify(record.authored)) descriptor.apply(node, current, authored)
        else descriptor.restore(node, record.snapshot, authored)
      }
      node.updateMatrixWorld(true)
    }
    this.saved.clear()
    editor?._updateBoxes?.()
  }
  restoreCamera() {
    const editor = this.getEditor(), viewport = editor?.vp
    if (!this.cameraOn) return
    this.cameraOn = false
    if (viewport) {
      viewport.camera = this.previousCamera || viewport.persp
      viewport.controls.enabled = this.previousControlsEnabled ?? true
      viewport.requestRender()
      editor?._updateGizmoMode?.()
    }
    this.previousCamera = null
    this.previousControlsEnabled = null
  }
  stop() {
    this.restoreCamera(); this.restoreNodes()
    if (this.csgPreview) {
      const editor = this.getEditor()
      for (const obj of this.getObjects() || []) if (obj.type === 'subtract') {
        const root = editor?.nodes?.get(obj.id)
        if (root) getDef('subtract')?.refreshShape(root,obj)
      }
      editor?.refreshBrushes(); this.csgPreview = false
    }
    this.clearMotionPath(); this.missingCameras.clear(); this.getEditor()?.vp?.requestRender()
  }
  clearMotionPath() {
    if (!this.pathGroup) return
    this.pathGroup.parent?.remove(this.pathGroup)
    this.pathGroup.traverse(part => {
      // Three.js comparte las geometrías internas de ArrowHelper con otros gizmos.
      if (part.userData?.timelineOwnedGeometry) part.geometry?.dispose()
      if (Array.isArray(part.material)) part.material.forEach(material => material.dispose())
      else part.material?.dispose()
    })
    this.pathGroup = null; this.pathSignature = ''
  }
  /** La trayectoria no es un recurso de escena: muestrea el mismo evaluador que usa el Player. */
  updateMotionPath(timeline, track) {
    const viewport = this.getEditor()?.vp
    if (!track || track.kind !== 'node' || track.prop !== 'position' || track.muted || !viewport?.overlay) {
      this.clearMotionPath(); return
    }
    const object = this.nodeOf(track.node, track.byId === true)?.o
    if (!object) { this.clearMotionPath(); return }
    const objects = this.getObjects() || []
    const byId = new Map(objects.map(item => [item.id, item]))
    const ancestors = [], visited = new Set([object.id])
    let parentId = object.parentId
    while (parentId) {
      if (visited.has(parentId)) { this.clearMotionPath(); return }
      visited.add(parentId)
      const parent = byId.get(parentId)
      if (!parent) { this.clearMotionPath(); return }
      ancestors.unshift(parent)
      parentId = parent.parentId
    }
    const parentTracks = (timeline.tracks || []).filter(candidate => candidate.kind === 'node' && !candidate.muted &&
      ancestors.some(parent => candidate.byId === true ? candidate.node === parent.id : candidate.node === parent.name))
    const signature = JSON.stringify([timeline.id, track.id, track.interpolation, track.keys, track.clips, ancestors, parentTracks])
    if (this.pathGroup?.parent === viewport.overlay && this.pathSignature === signature) return
    this.clearMotionPath()
    const group = new THREE.Group()
    group.name = 'Timeline · Trayectoria temporal (solo editor)'
    // Cada muestra calcula la transformación de los padres en ese instante, no solo la pose inicial.
    const posAt = time => {
      const position = evalTimelineNode(track, time)
      if (!Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite)) return null
      const matrix = new THREE.Matrix4()
      for (const parent of ancestors) {
        const pose = { ...parent }
        for (const animation of parentTracks) {
          if ((animation.byId === true ? animation.node !== parent.id : animation.node !== parent.name)) continue
          const v = evalTimelineNode(animation, time)
          if (v !== undefined && ['position', 'rotation', 'scale'].includes(animation.prop)) pose[animation.prop] = v
        }
        matrix.multiply(localMatrix(pose))
      }
      return new THREE.Vector3(...position).applyMatrix4(matrix)
    }
    const keys = [...(track.keys || [])].sort((a, b) => a.t - b.t).slice(0, 256)
    const points = [], lines = [], arrows = []
    // Las claves son fuente cuando hay clips: la trayectoria solo ocupa intervalos editoriales activos.
    const clips = track.clips || []
    if (!clips.length) for (const key of keys) {
      const p = posAt(key.t)
      if (p) points.push(...p.toArray())
    }
    else for (const clip of clips) {
      for (const t of [clip.start, Math.max(clip.start, clip.start + clip.duration - .00001)]) {
        const p = posAt(t)
        if (p) points.push(...p.toArray())
      }
    }
    const intervals = []
    if (!clips.length) for (let i = 0; i < keys.length - 1; i++) {
      if (track.interpolation === 'nearest' || (!track.interpolation && keys[i].ease === 'cut')) continue
      intervals.push({ start:keys[i].t, end:keys[i + 1].t })
    }
    else for (const clip of clips) intervals.push({ start:clip.start,end:clip.start + clip.duration })
    for (const { start, end } of intervals) {
      if (end <= start) continue
      const count = Math.min(24, Math.max(6, Math.round((end - start) * 3)))
      let prev = posAt(start), midpoint = null
      for (let n = 1; n <= count; n++) {
        const curr = posAt(start + (end - start) * n / count)
        if (prev && curr) {
          lines.push(...prev.toArray(), ...curr.toArray())
          if (n === Math.ceil(count / 2)) midpoint = { from: prev.clone(), to: curr.clone() }
        }
        prev = curr
      }
      if (midpoint && arrows.length < 32) arrows.push(midpoint)
    }
    if (lines.length) {
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3))
      const line = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x4aa3ff, depthTest: false, transparent: true, opacity: 0.85 }))
      line.renderOrder = 999; line.userData.timelineOwnedGeometry = true
      group.add(line)
    }
    if (points.length) {
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
      const markers = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffd27b, size: 7, sizeAttenuation: false, depthTest: false }))
      markers.renderOrder = 1000; markers.userData.timelineOwnedGeometry = true
      group.add(markers)
    }
    for (const { from, to } of arrows) {
      const direction = to.clone().sub(from), distance = direction.length()
      if (distance < 0.001) continue
      direction.divideScalar(distance)
      const arrow = new THREE.ArrowHelper(direction, from, Math.min(0.9, Math.max(0.18, distance)), 0x76d0ff, 0.18, 0.1)
      arrow.line.material.depthTest = false; arrow.cone.material.depthTest = false
      arrow.line.renderOrder = 1001; arrow.cone.renderOrder = 1001
      group.add(arrow)
    }
    if (!group.children.length) return
    viewport.overlay.add(group)
    this.pathGroup = group
    this.pathSignature = signature
  }
  savePose(id, node) {
    if (this.saved.has(id)) return
    const obj = (this.getObjects() || []).find(o => o.id === id)
    this.saved.set(id, {
      pos: node.position.clone(), rot: node.rotation.clone(), scale: (node.userData.visual || node).scale.clone(), visible: node.visible,
      hadActiveOverride: Object.hasOwn(node.userData, '_lfRuntimeActive'), activeOverride: node.userData._lfRuntimeActive,
      authored: obj ? JSON.stringify([obj.position, obj.rotation, obj.scale, obj.visible, obj.active, obj.light?.energy, obj.color]) : null,
      custom: new Map(),
      light: node.userData.light ? { intensity: node.userData.light.intensity, color: '#' + node.userData.light.color.getHexString(),
        fxBase: node.userData.fx?.base } : null,
    })
  }
  /** Camera3D temporal: la fuente la determina camera.main, nunca la selección editorial. */
  animatedCameraPose() {
    const sceneId = this.getSceneId()
    let active = null
    for (const obj of this.getObjects() || []) {
      if (obj.type !== 'camera') continue
      const root = this.nodeOf(obj.id, true)?.n
      if (!root || (root.userData.timelineMain ?? obj.props?.main) !== true) continue
      const pose = this.resolve({ mode: 'camera3d', sceneId, node: obj.id })
      if (!pose) continue
      if (active) return null // Dos cámaras válidas principales: conflicto, no prioridad editorial.
      active = pose
    }
    return active
  }
  apply(timeline, time, { enabled = true, selectedTrack = null, selectedNodeId = null } = {}) {
    const editor = this.getEditor(), viewport = editor?.vp
    if (!enabled || !timeline || !viewport) { this.stop(); return }
    // Ninguna clave de audio, comando o método se ejecuta desde la vista previa.
    // Primero aplicar las pistas que pueden mover la cámara o sus padres.
    this.restoreNodes()
    this.updateMotionPath(timeline, selectedTrack)
    const previewVisibility = new Map()
    for (const track of timeline.tracks || []) {
      if (track.kind !== 'node' || track.muted || !track.node) continue
      const target = this.nodeOf(track.node, track.byId === true)
      if (!target) continue
      const value = evalTimelineNode(track, time)
      if (value === undefined) continue
      const custom = nodeAnimationProperty(target.o, track.prop)
      if (!custom && track.prop.includes('.')) continue
      this.savePose(target.o.id, target.n)
      if (custom?.ownerType && track.byId === true && track.sceneId === this.getSceneId()) {
        const saved = this.saved.get(target.o.id).custom
        if (!saved.has(track.prop)) saved.set(track.prop, { snapshot: custom.capture(target.n, target.o), authored: custom.read(target.o) })
        custom.apply(target.n, value, target.o)
      }
      else if (track.prop === 'light.energy' || track.prop === 'light.color') {
        if (target.o.type !== 'light' || track.byId !== true || track.sceneId !== this.getSceneId() || !target.n.userData.light) continue
        if (track.prop === 'light.energy') {
          target.n.userData.light.intensity = value * Math.PI
          if (target.n.userData.fx) target.n.userData.fx.base = value * Math.PI
        } else {
          target.n.userData.light.color.set(value)
          target.n.userData.iconMat?.color.set(value)
        }
        target.n.userData.refreshLightEffects?.()
      }
      else if (track.prop === 'position') target.n.position.set(...value)
      else if (track.prop === 'rotation') { target.n.rotation.order = 'YXZ'; target.n.rotation.set(value[0] * DEG, value[1] * DEG, value[2] * DEG) }
      else if (track.prop === 'scale') (target.n.userData.visual || target.n).scale.set(...value)
      else if (track.prop === 'visible' || track.prop === 'active') {
        const state = previewVisibility.get(target.o.id) || {target}
        state[track.prop] = !!value
        previewVisibility.set(target.o.id, state)
        if (track.prop === 'active') target.n.userData._lfRuntimeActive = !!value
      }
      target.n.updateMatrixWorld(true)
    }
    for (const {target, active, visible} of previewVisibility.values()) {
      target.n.visible = (active ?? (target.o.active !== false)) && (visible ?? (target.o.visible !== false))
    }
    for (const track of timeline.tracks || []) {
      if (track.kind !== 'bake' || track.muted) continue
      const value = sampleBakeTrack(track, time)
      const target = this.nodeOf(track.node)
      if (!value || !target) continue
      this.savePose(target.o.id, target.n)
      target.n.position.fromArray(value.pos); target.n.quaternion.fromArray(value.quat); target.n.updateMatrixWorld(true)
    }
    const csgTracks = (timeline.tracks || []).some(track => {
      if (track.kind !== 'node' || track.muted || track.byId !== true || track.sceneId !== this.getSceneId()) return false
      const obj = this.nodeOf(track.node,true)?.o
      if (!obj) return false
      if (['subtract','meshSubtract','primitive','mesh'].includes(obj.type)) return true
      const byId = new Map((this.getObjects() || []).map(o => [o.id,o]))
      return (this.getObjects() || []).some(candidate => {
        if (!['subtract','meshSubtract','primitive','mesh'].includes(candidate.type)) return false
        const seen = new Set()
        for (let cur=candidate;cur;cur=byId.get(cur.parentId)) {
          if (cur.id === obj.id) return true
          if (seen.has(cur.id)) break
          seen.add(cur.id)
        }
        return false
      })
    })
    if (csgTracks) {
      for (const obj of this.getObjects() || []) if (obj.type === 'subtract') {
        const root = editor.nodes.get(obj.id)
        if (root) getDef('subtract')?.refreshShape(root,obj)
      }
      editor.refreshBrushes({timeline:true})
      this.csgPreview = true
    } else if (this.csgPreview) {
      editor.refreshBrushes()
      this.csgPreview = false
    }
    let pose = null, explicitShotActive = false
    for (const track of timeline.tracks || []) if (track.kind === 'camera' && !track.muted) {
      const sampled = evalTimelineCamera(track, time, (key) => this.resolve(key))
      if (sampled) pose = sampled
      // Una toma explícita sin fuente disponible mantiene su autoridad; no se suplanta.
      if (track.clips?.length ? track.clips.some(clip => time >= clip.start && time < clip.start + clip.duration)
        : (track.keys || []).some(key => key.t <= time)) explicitShotActive = true
    }
    // Sin toma explícita activa, una Camera3D animada puede pilotar la vista previa.
    if (!pose && !explicitShotActive) pose = this.animatedCameraPose()
    if (pose) {
      const enteringCameraPreview = !this.cameraOn
      if (enteringCameraPreview) {
        // El pilotaje edita la cámara del proyecto; Preview solo lee y no debe competir con él.
        editor?.stopCameraPilot?.()
        this.previousCamera = viewport.camera
        this.previousControlsEnabled = viewport.controls.enabled
      }
      this.cameraOn = true
      this.camera.position.set(...pose.pos); this.camera.quaternion.copy(pose.quat); this.camera.fov = pose.fov
      const container = viewport.container
      this.camera.aspect = Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight)
      this.camera.updateProjectionMatrix(); viewport.camera = this.camera; viewport.controls.enabled = false
      if (enteringCameraPreview) editor?._updateGizmoMode?.() // No recalcular gizmos por cada fotograma.
    } else this.restoreCamera()
    viewport.requestRender()
  }
}
