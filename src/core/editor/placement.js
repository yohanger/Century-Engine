// Colocar nodos, arrastrar recursos a la vista
import * as THREE from 'three'
import { getDef, makeObject } from '../../engine/runtime/nodes/index.js'
import { polyOf } from '../../engine/runtime/nodes/mesh.js'
import { store, editorSettings, getObject, addObject, worldMatrix, addTargetParent, instantiatePrefab, instantiateScene } from '../store.js'
import { baseName } from '../project.js'

export const placementMethods = {
  // =================== colocar nodos ===================
  _placeTemplate() {
    const { type, kind, modelId, props, name } = store.place
    const t = makeObject(type, kind, { id: '__ghost__', modelId })
    if (props) t.props = { ...t.props, ...props }
    if (name) t.name = name
    if (type === 'model') {
      const m = store.project.models.find((x) => x.id === modelId)
      t.name = m ? m.name.replace(/\.[^.]+$/, '') : 'Modelo'
    }
    return t
  },

  _ensureGhost() {
    const sig = JSON.stringify(store.place)
    if (this.ghost && this._ghostSig === sig) return
    this._clearGhost()
    const t = this._placeTemplate()
    t.opacity = 0.55
    this._ghostObj = t
    this.ghost = getDef(t.type).build(t, this._ctx())
    getDef(t.type).update(this.ghost, t)
    this.ghost.traverse((c) => { c.raycast = () => {} })
    if (this.ghost.userData.light) this.ghost.userData.light.visible = false
    this.vp.overlay.add(this.ghost)
    this._ghostSig = sig
  },

  _clearGhost() {
    if (this.ghost) { this.vp.overlay.remove(this.ghost); this.ghost.userData.disposeNature?.(); this.ghost = null }
  },

  _placement(hit, t) {
    const s = editorSettings()
    let { x, y, z } = hit.point
    // En espacio libre, el pivote queda donde apunta el visor; el ajuste de apoyo no corresponde.
    if (hit.free) return [x, y, z]
    if (s.snap) { x = Math.round(x / s.gridSize) * s.gridSize; z = Math.round(z / s.gridSize) * s.gridSize }
    const h = t.scale[1]
    switch (t.type) {
      case 'primitive': y += t.kind === 'plane' ? 0.05 : h / 2; break
      case 'subtract': case 'meshSubtract': case 'trigger': case 'atmovolume': case 'postvolume': case 'navigation': case 'event': y += h / 2; break
      case 'mesh': y -= polyOf(t).bounds().min[1] * t.scale[1]; break
      case 'light': y += t.kind === 'directional' ? 6 : 3; break
      case 'camera': y += 1.7; break
      case 'road': y = hit.point.y; break
    }
    if (!hit.onObject && this.terrains.length) y = Math.max(y, this.heightAt(x, z) + (y - hit.point.y))
    return [x, y, z]
  },

  _moveGhost() {
    this._ensureGhost()
    const hit = this._surfaceHit()
    if (!hit) { this.ghost.visible = false; return }
    this.ghost.visible = true
    this._ghostObj.position = this._placement(hit, this._ghostObj)
    getDef(this._ghostObj.type).update(this.ghost, this._ghostObj)
    if (this.ghost.userData.light) this.ghost.userData.light.visible = false
    store.cursor = { x: hit.point.x, y: hit.point.y, z: hit.point.z }
  },

  _placeHere(keep) {
    const hit = this._surfaceHit()
    if (!hit) return
    const t = this._placeTemplate()
    const world = this._placement(hit, t)
    // si hay un grupo seleccionado, el nodo nuevo nace dentro de él (como en Godot)
    const sel = getObject(store.selectedId)
    const parentId = sel && sel.type === 'group' ? sel.id : null
    if (parentId) {
      const p = new THREE.Vector3(...world).applyMatrix4(worldMatrix(parentId).invert())
      t.position = p.toArray().map((v) => +v.toFixed(4))
    } else t.position = world
    delete t.id
    addObject({ ...t, name: t.name || undefined }, { select: true, parentId })
    if (!keep) store.tool = 'select'
  },

  // =================== añadir desde menús (Shift+A) y arrastrar y soltar ===================
  /** Punto de la escena bajo el puntero (o el centro del viewport si el puntero está fuera). */
  pickPlacePoint() {
    const r = this.dom.getBoundingClientRect()
    const c = this.pointer.inside ? this.lastClient : null
    const inside = c && c.x >= r.left && c.x <= r.right && c.y >= r.top && c.y <= r.bottom
    if (inside) { if (!this._setRay({ clientX: c.x, clientY: c.y })) return null }
    else { this.pointer.x = r.width / 2; this.pointer.y = r.height / 2; if (!this._ray()) return null }
    return this._surfaceHit()
  },

  /** Desplazamiento mundial cardinal; la inclinación vertical no modifica la altura. */
  duplicateWorldOffset() {
    const cam = this.vp.camera
    if (!cam) return null
    const forward = cam.getWorldDirection(new THREE.Vector3())
    let { x, z } = forward
    if (![x, z].every(Number.isFinite)) return null
    if (Math.hypot(x, z) < 1e-6) {
      const right = cam.matrixWorld.elements
      x = right[2]; z = -right[0]
      if (Math.hypot(x, z) < 1e-6) { x = 0; z = -1 }
    }
    if (![x, z].every(Number.isFinite)) return null
    const distance = 2
    return Math.abs(x) + 1e-12 >= Math.abs(z)
      ? [x < 0 ? -distance : distance, 0, 0]
      : [0, 0, z < 0 ? -distance : distance]
  },

  /** Pega en la superficie próxima del centro de la vista o a dos metros horizontales. */
  clipboardPlacePoint() {
    const cam = this.vp.camera
    const offset = this.duplicateWorldOffset()
    if (!cam || !offset) return null
    const origin = cam.getWorldPosition(new THREE.Vector3())
    if (![origin.x, origin.y, origin.z].every(Number.isFinite)) return null
    const raycaster = this.raycaster
    const previousRay = raycaster.ray.clone(), previousCamera = raycaster.camera
    try {
      raycaster.setFromCamera(new THREE.Vector2(0, 0), cam)
      const hit = this._surfaceHit()
      const point = hit?.point
      if (point && !hit.free && [point.x, point.y, point.z].every(Number.isFinite) &&
          point.distanceTo(raycaster.ray.origin) <= Math.hypot(...offset)) return point.toArray()
    } finally {
      raycaster.ray.copy(previousRay)
      raycaster.camera = previousCamera
    }
    return origin.add(new THREE.Vector3(...offset)).toArray()
  },

  /** Crea un nodo en `spot` (resultado de pickPlacePoint) dentro de `parentId` (null = raíz). */
  addAt(spot, spec, { parentId = null, label } = {}) {
    if (!spot) return null
    const t = makeObject(spec.type, spec.kind, { id: '__new__', modelId: spec.modelId })
    if (spec.props) Object.assign(t.props, spec.props)
    if (spec.name) t.name = spec.name
    if (spec.type === 'model') {
      const m = store.project.models.find((x) => x.id === spec.modelId)
      t.name = m ? baseName(m.name) : 'Modelo'
    }
    const world = this._placement(spot, t)
    if (parentId) {
      const p = new THREE.Vector3(...world).applyMatrix4(worldMatrix(parentId).invert())
      t.position = p.toArray().map((v) => +v.toFixed(4))
    } else t.position = world
    delete t.id
    store.tool = 'select'
    const node = addObject({ ...t, name: t.name || undefined }, { select: true, parentId, label })
    if (node?.type === 'mesh' && spec.kind === 'vertex') this.enterEdit(node.id)
    return node
  },

  /** Suelta una imagen del panel Proyecto (o del sistema) sobre el viewport: crea un Sprite 3D con ella. */
  dropImage(assetId, clientX, clientY) {
    const a = store.project.assets.find((x) => x.id === assetId)
    if (!a) return null
    if (clientX != null && !this._setRay({ clientX, clientY })) return null
    const spot = clientX != null ? this._surfaceHit() : this.pickPlacePoint()
    if (!spot) return null
    return this.addAt(spot, { type: 'sprite3d', kind: 'sprite3d', props: { image: assetId }, name: baseName(a.name) }, { parentId: addTargetParent(), label: 'Añadir sprite' })
  },

  /** Suelta un prefab del panel Proyecto sobre el viewport. */
  dropPrefab(prefabId, clientX, clientY) {
    if (clientX != null && !this._setRay({ clientX, clientY })) return null
    const spot = clientX != null ? this._surfaceHit() : this.pickPlacePoint()
    if (!spot) return
    const s = editorSettings()
    let { x, y, z } = spot.point
    if (s.snap) { x = Math.round(x / s.gridSize) * s.gridSize; z = Math.round(z / s.gridSize) * s.gridSize }
    if (!spot.free && !spot.onObject && this.terrains.length) y = Math.max(y, this.heightAt(x, z))
    store.tool = 'select'
    return instantiatePrefab(prefabId, { parentId: addTargetParent(), position: [x, y, z] })
  },

  /** La escena se coloca con su origen en el punto señalado. */
  dropScene(id, clientX, clientY) {
    if (clientX != null && !this._setRay({ clientX, clientY })) return null
    const spot = clientX != null ? this._surfaceHit() : this.pickPlacePoint()
    return this.placeScene(id, spot)
  },

  placeScene(id, spot, parentId = addTargetParent()) {
    if (!spot) return
    const root = makeObject('sceneInstance', 'sceneInstance')
    return instantiateScene(id, { parentId, position: this._placement(spot, root) }).then(instance => {
      if (instance) store.tool = 'select'
      return instance
    })
  },

  /** Suelta un modelo del panel Proyecto sobre el viewport. */
  dropModel(modelId, clientX, clientY) {
    if (!this._setRay({ clientX, clientY })) return null
    const hit = this._surfaceHit()
    if (!hit) return
    this.addAt(hit, { type: 'model', kind: 'model', modelId }, { parentId: addTargetParent() })
  },
}
