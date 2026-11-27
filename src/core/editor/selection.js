// Selección, enfoque y miniatura
import * as THREE from 'three'
import { getDef } from '../../engine/runtime/nodes/index.js'
import { nodeScaleTarget } from '../../engine/runtime/nodes/three-helpers.js'
import { store, getObject } from '../store.js'
import { makeCanvas } from '../../engine/runtime/platform.js'
import { gizmoCategory, gizmosEnabled } from './gizmo-visibility.js'
import { configureSelectionBoxes, makeSelectionBox } from './selection-box.js'


export const selectionMethods = {
  _syncNodeGizmos(node, selected) {
    if (!node) return
    const u = node.userData
    const obj = getObject(u.id) || node._lfNodeOwner
    const editing = !store.play.on && !this.edit
    const active = !!selected && editing
    const visible = editing && gizmosEnabled(store.prefs, gizmoCategory(obj))
    for (const part of (u.editorGizmos || [])) {
      part.userData.editorGizmoAllowed = visible
      const activeEditVisual = !store.play.on && this.edit?.objId === obj?.id && part === u.editMeshVisual
      part.visible = (visible || activeEditVisual) && part.userData.editorGizmoEnabled !== false
    }
    if (u.indicatorZonesGizmo) u.indicatorZonesGizmo.visible = editing && gizmosEnabled(store.prefs, 'volumes')
    if (u.cells) u.cells.visible = visible
    // Iconos editoriales de cámara/luz/audio y guías: nunca ocultar la geometría real.
    if (obj?.type === 'camera' && u.visual) u.visual.visible = visible
    if (u.editorOnlyVisual && ['light', 'audio'].includes(obj?.type)) {
      u.editorOnlyVisual.visible = visible
    }
    if (obj?.type === 'event' && u.gem) u.gem.visible = visible
    // Las asas de colisión también pertenecen a mallas normales, no solo a PhysicsBody.
    this._colliderSync?.(node, active, editing && gizmosEnabled(store.prefs, 'colliders'))
  },

  _refreshNodeGizmos(ids = store.selectedIds) {
    const selected = new Set(!this.edit && !store.play.on ? ids : [])
    for (const [sid, node] of this.nodes) this._syncNodeGizmos(node, selected.has(sid))
  },

  setSelection(id, ids = id ? [id] : []) {
    // La selección es editorial; no cambia quién controla la reproducción de Timeline.
    if (this._cameraPilot && (id !== this._cameraPilot.id || ids.length !== 1)) this.stopCameraPilot()
    this._refreshNodeGizmos(ids)
    for (const b of this.boxes) { this.vp.overlay.remove(b); b.geometry.dispose() }
    this.boxes = []
    this._detachAll()
    if (id !== this._rsId) { store.roadPoint = null; this._rsId = id }
    if (this.edit) { this.vp.look.setEditorOutline([], false); this.vp.requestRender(); return }
    if (store.play.on || this.vp.playing) this.vp.look.setEditorOutline([], false)
    configureSelectionBoxes(store.prefs)
    const linked = this.streamingPreview?.selection()
    if (linked) {
      const style = store.prefs.selectionStyle
      const child = linked.nodeId && linked.node
      this.vp.look.setEditorOutline(child && style === 'outline' ? [child] : [], style === 'outline', store.prefs)
      if (child && style === 'box') {
        const box = makeSelectionBox(child, true)
        this.boxes.push(box)
        this.vp.overlay.add(box)
      }
      this._updateGizmoMode()
      this.streamingPreview.updateBounds()
      this._syncRoadHandles()
      this._syncTerrainGizmo()
      return
    }
    this.streamingPreview?.updateBounds()
    const node = id ? this.nodes.get(id) : null
    const obj = id ? getObject(id) : null
    if (store.tool !== 'terrain' && ((node && obj && !this._lockedChain(id)) || this._multiTargets().length)) {
      this._updateGizmoMode()
    }
    const mode = store.play.on ? 'box' : (['box', 'outline', 'none'].includes(store.prefs.selectionStyle) ? store.prefs.selectionStyle : 'box')
    const outlines = mode === 'outline' ? ids.map((sid) => this.nodes.get(sid)).filter(Boolean) : []
    if (!store.play.on) this.vp.look.setEditorOutline(outlines, mode === 'outline', store.prefs)
    const activeId = ids.includes(id) ? id : ids.at(-1)
    for (const sid of (mode === 'box' ? ids : [])) {
      const n = this.nodes.get(sid)
      if (!n) continue
      const b = makeSelectionBox(n, sid === activeId)
      this.boxes.push(b)
      this.vp.overlay.add(b)
    }
    if (store.roadPoint != null && !this._isPath(obj)) store.roadPoint = null
    this._syncRoadHandles()
    this._syncTerrainGizmo()
    this.vp.requestRender()
  },

  _updateBoxes() {
    for (const b of this.boxes) b.update()
  },

  _lockedChain(id) {
    let o = getObject(id)
    while (o) { if (o.locked) return true; o = o.parentId ? getObject(o.parentId) : null }
    return false
  },

  _updateGizmoMode() {
    if (this.edit) { for (const t of this._tcs()) { t.getHelper().visible = false; t.enabled = false }; this.edit.syncGizmoMode(); return }
    const linked = this.streamingPreview?.selection()
    const ids = this._multiTargets()
    const multiple = store.selectedIds.length > 1 && ids.length > 1
    const activeId = store.selectedIds.length > 1 && !ids.includes(store.selectedId) ? ids.at(-1) :
      store.selectedIds.length > 1 && ids.length === 1 ? ids[0] : store.selectedId
    const obj = getObject(activeId)
    const g = store.gizmo
    this._uni = g === 'universal'
    const scalable = linked ? linked.scalable : multiple
      ? ids.every((sid) => getDef(getObject(sid).type).scalable)
      : obj ? getDef(obj.type).scalable : true
    const node = linked?.node || (obj && this.nodes.get(obj.id))
    if (store.tool !== 'select' || g === 'none' || !node || (linked ? linked.locked : this._lockedChain(obj.id)) || (!store.play.on && this.vp.camera !== this.vp.persp && this.vp.camera !== this.vp.ortho)) {
      for (const t of this._tcs()) { t.getHelper().visible = false; t.enabled = false }
      this._detachAll()
      this.vp.requestRender(); return
    }
    if (multiple && this._multiPivot && !this._multiDrag) {
      this._multiPivot.quaternion.identity()
      if (store.space === 'local') {
        const active = ids.includes(store.selectedId) ? store.selectedId : ids.at(-1)
        this._multiPivot.quaternion.copy(this.nodes.get(active).getWorldQuaternion(new THREE.Quaternion()))
      }
    }
    const target = multiple ? (this._multiPivot || this._makeMultiPivot(ids)) : node
    const want = {
      tcScl: (g === 'scale' || this._uni) && scalable ? (multiple ? target : nodeScaleTarget(node, (linked?.obj || obj)?.type)) : null,
      tc: g === 'translate' || this._uni ? target : null,
      tcRot: (g === 'rotate' || this._uni) && (!linked || linked.nodeId) ? target : null,
    }
    this.tc.setSpace(store.space); this.tcRot.setSpace(store.space); this.tcScl.setSpace('local')
    this._sizeObjectGizmos()
    for (const [k, dest] of Object.entries(want)) {
      const t = this[k]
      if (dest) { if (t.object !== dest) { t.detach(); t.attach(dest) }; t.getHelper().visible = true; t.enabled = !this.vp.isFlying }
      else { t.detach(); t.getHelper().visible = false; t.enabled = false }
    }
    this.vp.requestRender()
  },

  /** Volumen compartido por Enfocar y la órbita. No incluye nodos ocultos ni bloqueados. */
  _selectionBounds(ids = store.selectedIds) {
    const linked = this.streamingPreview?.selection()
    if (linked) {
      const bounds = new THREE.Box3().setFromObject(linked.nodeId ? linked.node : this.streamingPreview.bounds)
      if (!bounds.isEmpty()) return bounds
    }
    const box = new THREE.Box3()
    let found = false
    for (const id of ids) {
      const node = this.nodes.get(id)
      if (!node || !node.visible) continue
      const part = new THREE.Box3().setFromObject(node)
      if (part.isEmpty()) part.setFromCenterAndSize(node.getWorldPosition(new THREE.Vector3()), new THREE.Vector3(0.5, 0.5, 0.5))
      box.union(part); found = true
    }
    return found ? box : null
  },

  selectionOrbitCenter() { return (this._meshLocalView ? this.meshLocalBounds() : this._selectionBounds())?.getCenter(new THREE.Vector3()) || null },

  focus(id = store.selectedId) {
    const ids = id && store.selectedIds.includes(id) ? store.selectedIds : (id ? [id] : [])
    const box = this._meshLocalView ? this.meshLocalBounds() : this._selectionBounds(ids)
    if (box) this.vp.frameBox(box)
    else this.frameAll()
  },

  frameAll() {
    const [mn, mx] = this.terrainRange()
    const b = this.terrainBounds()
    this.vp.frameBox(new THREE.Box3(new THREE.Vector3(b.x0, mn, b.z0), new THREE.Vector3(b.x1, Math.max(mx, 4), b.z1)))
  },

  thumbnail() {
    try {
      // Pinta con el pipeline normal del visor (cielo, post-proceso, sombras…). Un renderer.render() directo dejaba el lienzo con
      // la escena «cruda» y, como el visor repinta bajo demanda, así se quedaba hasta tocar algo (bug al guardar la escena).
      this.vp._render()
      const c = makeCanvas()
      c.width = 320; c.height = 180
      const ctx = c.getContext('2d')
      const src = this.dom, ar = src.width / src.height, tar = 320 / 180
      let sw = src.width, sh = src.height, sx = 0, sy = 0
      if (ar > tar) { sw = src.height * tar; sx = (src.width - sw) / 2 } else { sh = src.width / tar; sy = (src.height - sh) / 2 }
      ctx.drawImage(src, sx, sy, sw, sh, 0, 0, 320, 180)
      return c.toDataURL('image/jpeg', 0.7)
    } catch { return undefined } finally { this.vp.requestRender() }
  },
}
