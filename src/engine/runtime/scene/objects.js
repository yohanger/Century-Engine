// Nodos de la escena: reconstruir, sincronizar y quitar. No sabe de selección ni de gizmos: avisa por ganchos (`_node*`) que el editor sobrescribe.
import { getDef } from '../nodes/index.js'
import { signature } from '../nodes/three-helpers.js'
import { disposeEventGraphic } from '../nodes/event.js'
import { disposeDecal } from '../nodes/decal.js'
import { worldMatrixOf } from './matrix.js'
import { nodeAncestors, nodeActive } from '../nodes/hierarchy.js'
import { fitCollisionBoxFromScene } from '../physics/box-fit-editor.js'

function requiredNodeDef(obj) {
  const def = getDef(obj.type)
  if (!def) throw new Error(`Tipo de nodo no registrado: ${String(obj.type)} (ID: ${String(obj.id)})`)
  return def
}

export const objectsMethods = {
  _rebuild(obj) {
    const def = requiredNodeDef(obj)
    const old = this.nodes.get(obj.id)
    const node = def.build(obj, this._ctx())
    if (old) {
      this._nodeReplacing(old)
      // los hijos del árbol pasan al nodo nuevo
      for (const c of old.children.filter((c) => c.userData.kind === 'object')) node.add(c)
      old.parent?.remove(old)
      if (obj.type === 'event') disposeEventGraphic(old.userData.previewGraphic)
      if (old.userData.decalKey !== undefined) disposeDecal(old)
      old.userData.disposeModelMaterials?.()
      old.userData.disposeLightEffects?.()
      old.userData.disposePhysicsPreview?.()
      old.userData.disposeWaterPreview?.()
      old.userData.disposeSubtractVisual?.()
      old.userData.disposeVfx?.()
      old.userData.disposeNature?.()
    }
    // Marca privada del nodo lógico; no entra en userData ni se serializa con Three.js.
    Object.defineProperty(node, '_lfNodeOwner', { value: obj, writable: true, configurable: true })
    this.nodes.set(obj.id, node)
    def.update(node, obj)
    this._attach(obj, node)
    node.visible = nodeActive(obj) && obj.visible !== false
    this._applyShadowFlags(node, obj)
    this._applyViewToNode(node)
    if (this.nodeLifecycle?.active && obj.type === 'vfx') getDef('vfx').onEnterTree(obj, this)
    this._bakeSchedule()
    this._clusterGraphRevision = (this._clusterGraphRevision || 0) + 1
    this._nodeBuilt(obj, node)
    return node
  },

  /** Las calcomanías reaccionan al movimiento, geometría o eliminación de sus objetivos. */
  _refreshDecals() {
    for (const o of this.host.project?.objects || []) {
      if (o.type !== 'decal') continue
      const node = this.nodes.get(o.id)
      if (node) getDef('decal').update(node, o)
    }
  },

  /** Actualiza la silueta de TriMeshShape3D al editar un mesh o primitiva fuente. */
  _refreshTriMeshShapes() {
    const objects = this.host.project?.objects || []
    for (const o of objects) {
      if (o.type !== 'collisionshape3d' || o.props?.shape?.type !== 'TriMeshShape3D') continue
      const source = this.nodes.get(o.props.shape.sourceId)
      this.nodes.get(o.id)?.userData?.refreshTriMeshPreview?.(source)
    }
  },

  /** El autoajuste se ejecuta tras actualizar las mallas Three.js y ANTES de crear Jolt.
   * No crea entradas Undo adicionales: participa en la operación de geometría en curso.
   * Las cajas antiguas/manuales sin autoFit=true no son modificadas. */
  _refreshAutoFitBoxes() {
    const objects = this.host.project?.objects || []
    for (const o of objects) {
      if (o.type !== 'collisionshape3d' || o.props?.shape?.type !== 'BoxShape3D' || o.props.shape.autoFit !== true) continue
      const node = this.nodes.get(o.id)
      if (!node) continue
      let fit
      try { fit = fitCollisionBoxFromScene(objects, this.nodes, o.id) }
      catch (e) { node.userData.boxFitError = e.message; continue }
      node.userData.boxFitError = fit ? '' : 'No se encontró geometría válida'
      if (!fit) continue
      const same = (a,b) => a?.length===b?.length && a.every((v,i)=>Math.abs(v-b[i])<1e-6)
      if (same(o.props.shape.size,fit.size) && same(o.position,fit.position)) continue
      o.props.shape = {...o.props.shape, size:fit.size}
      o.position = fit.position
      getDef(o.type).update(node,o) // solo actualiza gizmo y transform; no reconstruye cuerpo
    }
  },

  /** Las mallas proyectan sombra salvo que se desactive ("Sombra") y siempre la reciben. */
  _applyShadowFlags(node, obj) {
    if (obj.type !== 'mesh' && obj.type !== 'primitive' && obj.type !== 'text') return
    const cast = obj.castShadow !== false
    node.traverse((m) => { if (m.isMesh && m.geometry && !m.userData.helper) { m.castShadow = cast; m.receiveShadow = true } })
  },

  _attach(obj, node) {
    // El parentesco se valida sobre el estado real antes de crear referencias Three.js.
    if (obj.parentId && !this.host.getObject(obj.parentId)) throw new Error(`Padre inexistente: ${obj.parentId}`)
    let parent = this.objectsGroup
    if (obj.parentId) {
      if (!this.nodes.has(obj.parentId)) this.syncObject(obj.parentId)
      parent = this.nodes.get(obj.parentId) || this.objectsGroup
    }
    if (node.parent !== parent) parent.add(node)
  },

  syncObject(id) {
    if (!this._syncingAll) nodeAncestors((key) => this.host.getObject(key), id)
    const obj = this.host.getObject(id)
    if (!obj) return
    const def = requiredNodeDef(obj)
    let node = this.nodes.get(id)
    if (!node || node.userData.sig !== signature(obj)) node = this._rebuild(obj)
    else {
      def.update(node, obj)
      this._attach(obj, node)
    }
    node.visible = nodeActive(obj) && obj.visible !== false
    if (obj.type === 'terrain') {
      const piece = this.terrains.find(t => t.id === obj.id)
      // Identidad en sesión; no se serializa ni copia la fuente de verdad Terrain.
      if (piece) {
        Object.defineProperty(obj, '_lfTerrainPiece', { value: piece, configurable: true })
        node.userData.terrainPiece = piece
        node.userData.terrainScene = this
      }
    }
    // El mismo Object3D puede actualizarse sin reconstruirse.
    if (node._lfNodeOwner !== obj) Object.defineProperty(node, '_lfNodeOwner', { value: obj, writable: true, configurable: true })
    this._applyShadowFlags(node, obj)
    this._applyViewToNode(node)
    if (obj.type !== 'decal') this._refreshDecals()
    if (!this._syncingAll) {
      if (['mesh','primitive','collisionshape3d','node3d','sceneInstance','group','staticbody3d','rigidbody3d'].includes(obj.type)) this._refreshAutoFitBoxes()
      if (['mesh','primitive','collisionshape3d','node3d','sceneInstance'].includes(obj.type)) this._refreshTriMeshShapes()
    }
    if (obj.type === 'terrain') this.applyView()
    if (obj.type === 'road') node.userData.refresh?.()
    if (obj.type === 'light') this._updateSun()
    else {
      for (let parent = this._worldSunBinding?.node.parent; parent; parent = parent.parent) {
        if (parent === node) { this._updateSun(); break }
      }
    }
    this.vp.invalidateShadows()
    this._clusterGraphRevision = (this._clusterGraphRevision || 0) + 1
    this._nodeSynced(obj, id)
    this._scheduleWM()
    if (['primitive','mesh','group','node3d','sceneInstance','staticbody3d','rigidbody3d',
      'characterbody3d','area3d','collisionshape3d','subtract','meshSubtract'].includes(obj.type)) this._scheduleBrushes()
    this.vp.requestRender()
    if (!this._syncingAll) this.nodeLifecycle?.sync()
  },

  /** Matriz de mundo de un objeto del proyecto (cadena de padres). */
  worldMatrix(id) { return worldMatrixOf((x) => this.host.getObject(x), id) },

  removeObject(id) {
    const node = this.nodes.get(id)
    if (!node) return
    this.nodeLifecycle?.beginRemoval(id)
    this._nodeRemoving(node)
    node.parent?.remove(node)
    if (node.userData.previewGraphic) disposeEventGraphic(node.userData.previewGraphic)
    if (node.userData.decalKey !== undefined) disposeDecal(node)
    node.userData.disposeModelMaterials?.()
    node.userData.disposeLightEffects?.()
    node.userData.disposePhysicsPreview?.()
    node.userData.disposeWaterPreview?.()
    node.userData.disposeSubtractVisual?.()
    node.userData.disposeVfx?.()
    node.userData.disposeNature?.()
    this.nodes.delete(id)
    if (node.userData.light) this._updateSun()
    this.nodeLifecycle?.endRemoval(id)
    this._refreshDecals()
    this._refreshTriMeshShapes()
    this._refreshAutoFitBoxes()
    this._clusterGraphRevision = (this._clusterGraphRevision || 0) + 1
    this._nodeRemoved(id)
    this._scheduleWM()
    this._scheduleBrushes()
    this.vp.requestRender()
    if (!this._syncingAll) this.nodeLifecycle?.sync()
  },
}
