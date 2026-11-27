// Acciones de cámara del Editor. Reutilizan el viewport, el SceneGraph y el historial existente.
import * as THREE from 'three'
import { DEG } from '../../engine/runtime/util.js'
import { store, persistEditorWorkspace, getObject, updateObject, commit } from '../store.js'
import { resolveScenePlayerNode } from '../project.js'
import { nodeEffectiveActive } from '../../engine/runtime/nodes/hierarchy.js'
import { sceneGameConfig } from '../../engine/runtime/game-manager.js'
import { resolveMainCamera, placeCameraNode } from '../../engine/runtime/events/play-camera.js'
import { findPlayerCamera } from '../../engine/runtime/events/play-player.js'
import { PLAYER_DEFAULTS } from '../../engine/runtime/database/player.js'

const editorVisuals = new Set(['trigger', 'atmovolume', 'postvolume', 'cameraShake', 'spawn', 'camera', 'canvas', 'sprite2d', 'subtract', 'event'])

export const cameraMethods = {
  setGameView(on) {
    if (on === store.gameView.on) return true
    if (on && (!store.ready || store.locked || store.play.on || this.player.starting || this.edit || this.paint ||
      this._dragging || this.stroke || this._roadDrag || this._roadPaintStroke || this._colliderDrag)) return false
    const vp = this.vp
    if (on) {
      persistEditorWorkspace()
      vp._stopContinuousNavigation(true)
      this.stopCameraPilot()
      this._gameViewControls = vp.controls.enabled
      vp.controls.enabled = false
      this._down = null
      store.cursor = null
      vp.drawEditorPreview = (draw) => this._drawGameView(draw)
    } else {
      vp.drawEditorPreview = null
      vp.controls.enabled = this._gameViewControls
    }
    store.gameView.on = on
    store.gameView.noCamera = false
    vp.look.resetTemporal()
    vp.invalidateShadows()
    return true
  },

  getGamePreviewCamera(aspect) {
    const project = store.project
    if (!project) return null
    const { manager, config } = sceneGameConfig(project)
    const active = (obj) => nodeEffectiveActive(project.objects, obj)
    const source = resolveMainCamera(project.objects, this.nodes, active, manager?.camera)
    store.gameView.noCamera = !source
    if (!source) return null
    const scene = project.scenes?.find(s => s.id === project.activeSceneId)
    const player = config.player !== 'none' && !scene?.playerSpawnMode ? resolveScenePlayerNode(scene, project.objects) : null
    const playerCamera = player?.status === 'valid' && findPlayerCamera(project.objects, player.id, active)
    const fov = playerCamera?.id === source.obj.id ? project.database?.player?.fov ?? PLAYER_DEFAULTS.fov : undefined
    const cam = this._gameViewCamera ??= this.player.cam.clone()
    cam.aspect = Math.max(0.01, aspect)
    placeCameraNode(cam, source, fov)
    cam.updateMatrixWorld()
    return cam
  },

  withGamePreviewVisuals(draw) {
    const vp = this.vp
    const hidden = new Set([vp.overlay, vp.grid, vp.editorSun, this.ghost])
    for (const node of this.nodes.values()) {
      const u = node.userData
      if (editorVisuals.has(node._lfNodeOwner?.type)) hidden.add(u.visual)
      for (const helper of [u.editorOnlyVisual, u.indicatorZonesGizmo, u.cells, u.colliderGizmo, u.areaFrame, u.previewGraphic, u.gem, ...(u.editorGizmos || [])]) hidden.add(helper)
    }
    const visible = [...hidden].filter((obj) => obj?.visible)
    for (const obj of visible) obj.visible = false
    try { return draw() }
    finally { for (const obj of visible) obj.visible = true }
  },

  _drawGameView(draw) {
    const vp = this.vp
    const cam = this.getGamePreviewCamera(vp.dom.width / Math.max(1, vp.dom.height))
    if (!cam) return
    const editorCamera = vp.camera
    vp.camera = cam
    try { return this.withGamePreviewVisuals(draw) }
    finally { vp.camera = editorCamera }
  },

  /** Copia la pose mundial de la vista a un nodo, respetando grupos rotados. */
  _viewPoseFor(id, position, quaternion) {
    const node = this.nodes.get(id)
    if (!node) return null
    const pos = node.parent.worldToLocal(position.clone())
    const parentQ = node.parent.getWorldQuaternion(new THREE.Quaternion()).invert()
    const rot = new THREE.Euler().setFromQuaternion(parentQ.multiply(quaternion), 'YXZ')
    return { position: pos.toArray(), rotation: [rot.x / DEG, rot.y / DEG, rot.z / DEG] }
  },

  /** Lleva el visor al nodo sin desplazarlo: una Camera se usa exactamente, otras entidades se ven desde atrás. */
  moveViewToSelected() {
    const obj = getObject(store.selectedId), node = this.nodes.get(store.selectedId)
    if (!obj || !node || store.play.on) return false
    const pos = node.getWorldPosition(new THREE.Vector3())
    const q = node.getWorldQuaternion(new THREE.Quaternion())
    if (obj.type !== 'camera') pos.add(new THREE.Vector3(0, 0, 5).applyQuaternion(q))
    this.vp.camera.position.copy(pos)
    this.vp.camera.quaternion.copy(q)
    this.vp.controls.target.copy(pos).addScaledVector(new THREE.Vector3(0, 0, -1).applyQuaternion(q), 8)
    this.vp.controls.update(); this.vp.requestRender()
    return true
  },

  /** Alineación permanente, independiente de «Jugar desde aquí» y con Undo/Redo. */
  alignSelectedToView() {
    const id = store.selectedId
    if (store.play.on || !id || store.selectedIds.length !== 1 || this._lockedChain(id)) return false
    this.stopCameraPilot()
    const patch = this._viewPoseFor(id, this.vp.camera.position, this.vp.camera.quaternion)
    if (!patch) return false
    updateObject(id, patch, { label: `Alinear ${getObject(id).name} a la vista` })
    return true
  },

  /** Compatibilidad editorial: alinea un marcador Spawn ya presente en un proyecto antiguo. */
  alignSpawnToView() {
    if (store.play.on) return false
    const id = store.selectedId, obj = getObject(id)
    if (!obj || obj.type !== 'spawn' || this._lockedChain(id)) return false
    const p = this.vp.camera.position.clone()
    const height = Number(store.project?.database?.player?.eyeHeight)
    p.y -= Number.isFinite(height) && height > 0 ? height : 1.65
    const ground = this.terrains.length ? this.raycastTerrain(new THREE.Ray(p.clone().add(new THREE.Vector3(0, 3, 0)), new THREE.Vector3(0, -1, 0))) : null
    if (ground && ground.point.y <= p.y + 0.25 && ground.point.y >= p.y - 3) p.y = ground.point.y + 0.05
    else if (this.terrains.length) p.y = Math.max(p.y, this.heightAt(p.x, p.z) + 0.05)
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.vp.camera.quaternion)
    forward.y = 0
    const yaw = forward.lengthSq() > 1e-8 ? Math.atan2(-forward.x, -forward.z) : 0
    const horizontal = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
    const patch = this._viewPoseFor(id, p, horizontal)
    if (!patch) return false
    // El Spawn recibe orientación horizontal mundial; su conversión al grupo padre ya está aplicada.
    updateObject(id, patch, { label: 'Alinear Spawn a la vista' })
    return true
  },

  /** Pilotaje de una cámara del proyecto, mediante el visor existente (sin controladores extra). */
  startCameraPilot() {
    const id = store.selectedId, obj = getObject(id)
    if (store.play.on || store.gameView.on || this.edit || obj?.type !== 'camera' || this._lockedChain(id) || (this.vp.camera !== this.vp.persp && this.vp.camera !== this.vp.ortho)) return false
    if (this._cameraPilot?.id === id) return true
    this.stopCameraPilot()
    if (!this.moveViewToSelected()) return false
    this._cameraPilot = { id, before: JSON.stringify({ position: obj.position, rotation: obj.rotation }), orbit: this.vp.orbitAroundSelection }
    this.vp.orbitAroundSelection = false // al pilotar, orbitar la propia Camera la movería recursivamente
    this._pilotChange = () => {
      if (!this._cameraPilot || this._pilotUpdating) return
      const patch = this._viewPoseFor(id, this.vp.camera.position, this.vp.camera.quaternion)
      const node = this.nodes.get(id)
      if (!patch || !node) return
      this._pilotUpdating = true
      try {
        obj.position = patch.position; obj.rotation = patch.rotation
        node.position.set(...patch.position)
        node.rotation.order = 'YXZ'; node.rotation.set(...patch.rotation.map((v) => v * DEG))
        this._updateBoxes()
      } finally { this._pilotUpdating = false }
    }
    this.vp.controls.addEventListener('change', this._pilotChange)
    return true
  },

  stopCameraPilot() {
    if (!this._cameraPilot) return false
    const { id, before, orbit } = this._cameraPilot
    this.vp.orbitAroundSelection = orbit
    this.vp.controls.removeEventListener('change', this._pilotChange)
    this._pilotChange = null
    this._cameraPilot = null
    const obj = getObject(id)
    if (obj && JSON.stringify({ position: obj.position, rotation: obj.rotation }) !== before) {
      this.syncObject(id)
      commit(`Pilotar ${obj.name}`) // una sola entrada al terminar la sesión
    }
    this.vp.requestRender()
    return true
  },
}
