// Edición de malla (modo edición, pintura de vértices, unir mallas)
import * as THREE from 'three'
import { finiteMeshRecord } from '../../engine/runtime/numeric-integrity.js'
import { drawLocalMesh } from './local-mesh-view.js'
import { polyOf } from '../../engine/runtime/nodes/mesh.js'
import { writeMesh, meshConsumers, meshDataOf } from '../../engine/runtime/mesh/shared-mesh.js'
import { fromPrimitive, fromCarved, MESH_KINDS } from '../../engine/runtime/mesh/generators.js'
import { initialSubtractPoly, validateSubtractPoly } from '../../engine/runtime/mesh/subtract-edit.js'
import { PolyMesh } from '../../engine/runtime/mesh/polymesh.js'
import { hasTool, tool } from '../tools.js' // Las órdenes de malla solo están registradas en el editor principal.
import { store, getObject, worldMatrix, commit, removeObject, canRemoveObjects, toast } from '../store.js'

export const mesheditMethods = {
  // =================== modo edición de malla ===================
  _convertToMesh(obj) {
    const carved = this.nodes.get(obj.id)?.userData.carvedPolys // con huecos de brushes sustractivos: la malla ya nace recortada
    const poly = carved?.length ? fromCarved(carved, obj.scale) : fromPrimitive(obj.kind, obj.scale, obj.props)
    const stairs = obj.kind === 'stairs' || !!carved?.length
    const kindMap = { cylinder: 'cylinder', cone: 'cone', sphere: 'sphere' }
    obj.type = 'mesh'
    obj.kind = kindMap[obj.kind] || 'cube'
    obj.scale = [1, 1, 1]
    obj.props = { mesh: poly.toJSON(), collider: stairs ? 'trimesh' : 'convex' }
    this.syncObject(obj.id)
  },

  /** «Hornear cortes»: convierte la primitiva en malla editable con los huecos de los brushes ya hechos. */
  bakeCuts(id = store.selectedId) {
    const obj = getObject(id)
    if (!obj || obj.type !== 'primitive') return toast('Selecciona una primitiva', 'info')
    if (!this.nodes.get(id)?.userData.carvedPolys) return toast('Esta primitiva no tiene cortes de brushes', 'info')
    this._convertToMesh(obj)
    commit('Hornear cortes a malla')
  },

  enterEdit(id = store.selectedId, snap = null, { silent = false } = {}) {
    const obj = getObject(id)
    if (!obj) return toast('Selecciona una primitiva o una malla para editarla', 'info')
    if (!snap && store.selectedIds.length !== 1) return toast('Selecciona un solo objeto para entrar al modo edición', 'info')
    if (!['primitive', 'mesh', 'subtract'].includes(obj.type)) return toast('Solo se pueden editar primitivas, mallas y Substract', 'info')
    if (this._lockedChain(id)) return toast('El objeto está bloqueado', 'info')
    this.setGameView(false)
    if (this.edit) this.exitEditMode({ silent: true })
    const converted = obj.type === 'primitive'
    const primitive = converted ? { type: obj.type, kind: obj.kind, scale: obj.scale, props: obj.props } : null
    if (converted) this._convertToMesh(obj)
    if (obj.type === 'subtract' && obj.props?.mesh) {
      const poly = PolyMesh.fromJSON(obj.props.mesh)
      const invalid = validateSubtractPoly(poly)
      if (invalid) return toast(invalid, 'error')
    }
    let initializedSubtract = false
    if (obj.type === 'subtract' && !obj.props?.mesh && snap) return false
    if (obj.type === 'subtract' && !obj.props?.mesh) {
      const poly = initialSubtractPoly(obj)
      const invalid = poly && validateSubtractPoly(poly)
      if (!poly || invalid) return toast(invalid || 'No se pudo preparar el volumen Substract', 'error')
      obj.props ||= {}
      obj.props.mesh = poly.toJSON()
      initializedSubtract = true
      this.syncObject(id)
    }
    store.tool = 'select'
    for (const b of this.boxes) { this.vp.overlay.remove(b); b.geometry.dispose() }
    this.boxes = []
    for (const t of this._tcs()) { t.detach(); t.getHelper().visible = false; t.enabled = false }
    try { this.edit = new (tool('mesh').EditSession)(this, getObject(id), snap) }
    catch (error) {
      if (converted) { Object.assign(obj, primitive); this.syncObject(id) }
      if (initializedSubtract) { delete obj.props.mesh; this.syncObject(id) }
      toast(`No se pudo abrir Edit Mesh: ${error.message}`, 'error')
      return false
    }
    if (!silent && (converted || initializedSubtract)) commit(converted ? 'Convertir primitiva a malla' : 'Inicializar geometría Substract')
    this.vp.requestRender()
  },

  meshLocalBounds() {
    const s = this.edit
    if (!s?.visual) return null
    s.visual.updateWorldMatrix(true, false)
    const box = new THREE.Box3(), point = new THREE.Vector3()
    for (const vertex of s.poly.v) box.expandByPoint(point.fromArray(vertex).applyMatrix4(s.visual.matrixWorld))
    if (box.isEmpty()) box.setFromCenterAndSize(s.visual.getWorldPosition(point), new THREE.Vector3(1, 1, 1))
    return box
  },

  meshLocalSavedView() { return this._meshLocalView?.view || null },

  toggleMeshLocalView() {
    const s = this.edit, vp = this.vp
    if (!s || s.modal || s.paintStroke || store.play.on || this.player?.starting || store.gameView.on || store.locked || vp.isFlying) return false
    if (this._meshLocalView) return this.clearMeshLocalView()
    const bounds = this.meshLocalBounds()
    if (!bounds) return false
    vp._stopContinuousNavigation?.(true)
    this._meshLocalView = { session: s, view: vp.saveEditorView() }
    const background = new THREE.Color('#25282c')
    vp.drawMeshLocal = () => {
      if (this.edit === s && drawLocalMesh(vp, s.visual, background)) return true
      this.clearMeshLocalView()
      return false
    }
    store.edit.localView = true
    vp.frameBox(bounds)
    vp.requestRender()
    return true
  },

  clearMeshLocalView() {
    const state = this._meshLocalView
    if (!state) return false
    this._meshLocalView = null
    this.vp.drawMeshLocal = null
    store.edit.localView = false
    this.vp._stopContinuousNavigation?.(true)
    this.vp.restoreEditorView(state.view)
    this.vp.look.resetTemporal()
    this.vp.invalidateShadows()
    return true
  },

  exitEditMode({ silent = false } = {}) {
    this.clearMeshLocalView()
    const s = this.edit
    if (!s) return
    this.vp._stopContinuousNavigation?.(true)
    const previousMesh = meshDataOf(s.obj, store.project.meshes)
    s.flush()
    if (!silent && previousMesh !== meshDataOf(s.obj, store.project.meshes)) commit('Confirmar geometría')
    this.edit = null
    const id = s.objId
    s.dispose()
    this.syncObject(id)
    this.setSelection(store.selectedId, store.selectedIds)
    this._updateGizmoMode()
    this.vp.requestRender()
  },

  toggleEdit() {
    // Tab: con un Sprite (o un Lienzo de píxeles) elegido entra a PINTAR en su imagen; con una malla, al modo edición
    if (this.paint) return this.exitPaint()
    if (this.edit) return this.exitEditMode()
    const o = getObject(store.selectedId)
    if (o && (o.type === 'sprite3d' || o.type === 'sprite2d')) return this.enterPaint(o.id)
    this.enterEdit()
  },
  /** Pintar en la imagen de un sprite (core/paint/session.js). */
  async enterPaint(id = store.selectedId) {
    const o = getObject(id)
    if (!o || !['sprite3d', 'sprite2d'].includes(o.type)) return toast('Selecciona un Sprite o un Lienzo de píxeles para pintar', 'info')
    if (this._lockedChain(id)) return toast('El objeto está bloqueado', 'info')
    this.setGameView(false)
    if (this.edit) this.exitEditMode({ silent: true })
    if (this.paint) await this.exitPaint()
    const { PaintSession } = await import('../paint/session.js')
    for (const t of this._tcs()) { t.detach(); t.getHelper().visible = false; t.enabled = false }
    this.paint = new PaintSession(this, o)
    await this.paint.ready
    store.paint.on = true; store.paint.objId = o.id
    store.prefs.rightTab = 'paint'
    this.vp.requestRender()
  },
  async exitPaint() {
    const s = this.paint
    if (!s) return
    this.paint = null
    store.paint.on = false; store.paint.objId = null
    if (store.prefs.rightTab === 'paint') store.prefs.rightTab = 'object'
    await s.close()
    for (const t of this._tcs()) t.enabled = true
    this.setSelection(store.selectedId, store.selectedIds)
    this.vp.requestRender()
  },
  setEditMode(m) { this.edit?.setMode(m) },
  meshOp(name, arg) { this.edit?.op(name, arg) },
  editSnapshot() { return this.edit ? this.edit.snapshot() : null },
  validateHistoryEdit(entry) {
    const s = this.edit
    if (!s) return
    if (s.modal || s.paintStroke || s.numericDraft || s.down || s.dirty) throw new Error('Confirma o cancela la operación de malla antes de deshacer o rehacer')
    const objects = JSON.parse(entry.objects)
    const target = objects.find(o => o.id === s.objId)
    if (!target || target.type !== s.obj.type || !finiteMeshRecord(meshDataOf(target, JSON.parse(entry.meshes || '[]')))) {
      throw new Error('Sal de Edit Mesh para deshacer o rehacer esta modificación incompatible')
    }
    const byId = new Map(objects.map(o => [o.id, o])), visited = new Set()
    for (let o = target; o; o = byId.get(o.parentId)) {
      if (visited.has(o.id)) throw new Error('Ciclo en la jerarquía histórica')
      visited.add(o.id)
      if (o.locked) throw new Error('La modificación bloquearía la malla activa; sal de Edit Mesh primero')
    }
  },
  restoreEdit(snap) {
    const active = this.edit?.snapshot()
    this._pendingSnap = active && snap?.id === active.id && snap.mode === active.mode
      ? { ...active, sel: snap.sel } : active || null
  },
  flushEdit() { this.edit?.flush() },
  afterUndo() {
    const snap = this._pendingSnap
    this._pendingSnap = null
    if (this.edit && !this.edit.reload(snap)) throw new Error('No se pudo restaurar la geometría de la sesión activa')
  },

  openEditAddMenu(pos) {
    const at = pos || this.lastClient || { x: 200, y: 200 }
    store.menu = {
      x: at.x, y: at.y,
      items: [{ heading: 'Añadir a la malla' }, ...Object.entries(MESH_KINDS).map(([k, v]) => ({ label: v.label, icon: v.icon, run: () => this.edit?.addPrimitive(k) }))],
    }
  },
  openEditContext({ x, y }) {
    if (!hasTool('commands')) { toast('Las operaciones de malla pertenecen al editor principal', 'info'); return }
    const menuItems = tool('commands').items
    const g = (label, ids) => ({ label, children: menuItems(ids) })
    store.menu = {
      x, y,
      items: [
        ...menuItems(['mesh.extrude', 'mesh.inset', 'mesh.bevel', 'mesh.bevelVertex', 'mesh.loopcut', 'mesh.knife', 'mesh.fill', 'mesh.bridge', 'mesh.subdivide']), { sep: true },
        ...menuItems(['mesh.merge.faces']),
        g('Fusionar', ['mesh.merge.center', 'mesh.merge.first', 'mesh.merge.last', 'mesh.merge.collapse', 'mesh.merge.dist']),
        g('Eliminar', ['mesh.delete.verts', 'mesh.delete.edges', 'mesh.delete.faces', 'mesh.delete.onlyfaces', 'mesh.dissolve']),
        ...menuItems(['mesh.cleanup']),
        g('Normales', ['mesh.flip', 'mesh.recalc', 'mesh.smooth', 'mesh.flat']),
        g('Ocultar', ['mesh.hide', 'mesh.hideOthers', 'mesh.reveal']),
        g('Seleccionar', ['mesh.selectAll', 'mesh.selectNone', 'mesh.invert', 'mesh.linked', 'mesh.more', 'mesh.less']),
        { sep: true },
        ...menuItems(['mesh.split', 'mesh.separate', 'mesh.duplicate']),
      ],
    }
  },

  /** Ctrl+J: une las mallas / primitivas seleccionadas en la activa. */
  joinMeshes() {
    const ids = store.selectedIds.filter((id) => ['mesh', 'primitive'].includes(getObject(id)?.type))
    const active = getObject(store.selectedId)
    if (ids.length < 2 || !active || !ids.includes(active.id)) return toast('Selecciona dos o más mallas (la activa recibe a las demás)', 'info')
    if (this.edit) return toast('Sal del modo edición para unir objetos', 'info')
    if (!canRemoveObjects(ids.filter((id) => id !== active.id))) return false
    if (active.type === 'primitive') this._convertToMesh(active)
    const full = (o) => worldMatrix(o.id).multiply(new THREE.Matrix4().makeScale(...o.scale))
    const inv = full(active).invert()
    const target = polyOf(active).clone()
    for (const id of ids) {
      if (id === active.id) continue
      const o = getObject(id)
      const poly = o.type === 'mesh' ? polyOf(o).clone() : fromPrimitive(o.kind, o.scale, o.props)
      const M = o.type === 'mesh' ? inv.clone().multiply(full(o)) : inv.clone().multiply(worldMatrix(o.id))
      const base = target.v.length
      const tmp = new THREE.Vector3()
      for (const p of poly.v) { tmp.set(...p).applyMatrix4(M); target.v.push([tmp.x, tmp.y, tmp.z]) }
      for (const f of poly.f) target.f.push(f.map((v) => v + base))
      for (const [a, b] of poly.we) target.we.push([a + base, b + base])
    }
    if (!writeMesh(store.project, active, target.toJSON())) return toast('No se encontró la geometría vinculada', 'error')
    for (const id of ids) if (id !== active.id) removeObject(id, { commit: false })
    store.selectedIds = [active.id]; store.selectedId = active.id
    this.syncObject(active.id)
    if (active.props.meshRef) for (const c of meshConsumers(store.project, active.props.meshRef)) if (c.id !== active.id) this.syncObject(c.id)
    this.setSelection(active.id, [active.id])
    commit('Unir mallas')
    toast(`${ids.length} mallas unidas`, 'ok')
  },
}
