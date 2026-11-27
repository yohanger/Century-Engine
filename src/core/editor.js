import { effectiveNavigationPrefs } from './editor/mouse-sensitivity.js'
import { snapEnabled, snapStep } from './editor/snap.js'
import * as THREE from 'three'
import { SceneGraph } from '../engine/runtime/scene-graph.js'
import { tool } from './tools.js' // edición de mallas y comandos: herramientas del editor (core/tools.js)
import { PlayMode } from '../engine/runtime/events/play.js'
import { store, editorSettings, selectionRoots, updateSettings } from './store.js'
import { syncEditorSceneInstances } from './state/scene-instances.js'
import { EDITOR_HOST } from './editor/editor-host.js'
import { EditorPlaySession } from './editor/play-session.js'
import { getAudio } from '../engine/runtime/audio/engine.js'
import { DEG } from '../engine/runtime/util.js'
import { mesheditMethods } from './editor/meshedit.js'
import { keysMethods } from './editor/keys.js'
import { rampMethods } from './editor/ramp.js'
import { placementMethods } from './editor/placement.js'
import { pointerMethods } from './editor/pointer.js'
import { selectionMethods } from './editor/selection.js'
import { colliderMethods } from './editor/collider.js'
import { gizmoMethods } from './editor/gizmo.js'
import { environmentMethods } from './editor/environment.js'
import { roadsMethods } from './editor/roads.js'
import { terrainMethods } from './editor/terrain.js'
import { StreamingPreview } from './editor/streaming-preview.js'
import { cameraMethods } from './editor/camera-tools.js'
import { syncPlayerSceneVisuals } from './editor/player-preview.js'

export class Editor extends SceneGraph {
  constructor(container) {
    super(container, EDITOR_HOST)
    this.raycaster = new THREE.Raycaster()
    this.pointer = { x: 0, y: 0, inside: false }
    this.stroke = null
    this.ghost = null
    this.boxes = []
    this._down = null
    this._lastCursor = 0
    this.lastClient = null
    this.edit = null // sesión de edición de malla (EditSession) mientras el modo edición está activo

    this.vp.orbitSelectionPoint = () => this.selectionOrbitCenter()
    this.vp.orbitAroundSelection = store.prefs.orbitSelection !== false
    this._buildGizmo()
    // La navegación continua pertenece al visor del Editor, en Object Mode y Edit Mode.
    this.vp.setEditNavigation(() => !this.player?.on && !store.gameView.on, this._continuousGrab)
    this._buildTerrainGizmo()
    this.vp._canStartFly = () => !!store.project && !store.locked && !store.modal && !store.palette &&
      !this._dragging && !this._terrainEdgeDrag && !this._colliderDrag && !this._roadDrag && !this._roadPaintStroke && !this.stroke &&
      !this.edit?.modal && !this.edit?.paintStroke && !this.edit?.down?.box && !this.paint?.op
    this.vp._consumeMeshModalPointerDown = e => this.edit?.consumeModalPointerDown(e)
    this.vp._onFlyInput = active => this._setFlyGizmoInput(active)
    this._buildBrushCursor()
    this.streamingPreview = new StreamingPreview(this)
    this._bindPointer()
    this._bindKeys()
    this._bindWatchers()
    this.player = new PlayMode(this, new EditorPlaySession(this))
    getAudio().setLoader(EDITOR_HOST.assetData, EDITOR_HOST.audioAssetSource)
    this.vp.onFrame((dt) => this._frame(dt))
    this.vp.setNavigation(store.prefs.navigation)
    this.vp.applyPrefs(effectiveNavigationPrefs(store.prefs))
    this._applyGizmoSize()
  }

  // =================== ganchos de la escena (engine/runtime/scene-graph.js) ===================
  get isPlaying() { return !!this.player?.on }
  _sceneLoading() { this.cancelEditorPointer('scene-change'); this.clearMeshLocalView(); this.streamingPreview.clear(); this.vp._stopContinuousNavigation?.(true); this.stopCameraPilot(); this.setSelection(null, []) }
  async loadScene(record) {
    await super.loadScene(record)
    this.streamingPreview.refresh()
  }
  syncAll() {
    if (!this.isPlaying && store.project) syncEditorSceneInstances(store.project)
    super.syncAll()
    syncPlayerSceneVisuals(this)
  }
  _nodeReplacing(old) { this._colliderClear(old); for (const t of this._tcs()) { let node = t.object; while (node && node !== old) node = node.parent; if (node === old) t.detach() } }
  _nodeBuilt(obj, node) {
    this._syncNodeGizmos(node, store.selectedIds.includes(obj.id) && !this.edit && !store.play.on)
    syncPlayerSceneVisuals(this, obj)
    if (store.selectedIds.includes(obj.id)) this.setSelection(store.selectedId, store.selectedIds)
  }
  _nodeSynced(obj, id) {
    this._syncNodeGizmos(this.nodes.get(id), store.selectedIds.includes(id) && !this.edit && !store.play.on)
    syncPlayerSceneVisuals(this, obj)
    if (this._isPath(obj) && id === store.selectedId) this._syncRoadHandles()
    this._updateBoxes()
  }
  // SceneGraph vuelve a mostrar los iconos editoriales al aplicar la vista.
  // Restituir aquí los filtros de Gizmos sin cambiar el Runtime compartido.
  _applyViewToNode(node) {
    super._applyViewToNode(node)
    this._syncNodeGizmos(node, store.selectedIds.includes(node.userData.id))
  }
  _nodeRemoving(node) { this._colliderClear(node); for (const t of this._tcs()) if (t.object && (t.object === node || t.object.parent === node)) t.detach() }
  _nodeRemoved() { this._updateBoxes() }
  _renderApplied() { if (this.player?.on) this.player._gfxRefresh() }

  /** Además de la cuadrícula y el plano lejano de la escena, ajusta el imán de los gizmos. */
  syncSettings(s = store.project ? editorSettings() : undefined) {
    if (!s) return
    for (const t of this._tcs()) {
      if (this._snapDrag?.control === t) continue // Durante el gesto el ajuste se aplica sin saltos en gizmo.js.
      t.setTranslationSnap(snapEnabled(s, 'translate') ? snapStep(s, 'translate') : null)
      t.setRotationSnap(snapEnabled(s, 'rotate') ? snapStep(s, 'rotate') * DEG : null)
      t.setScaleSnap(snapEnabled(s, 'scale') ? snapStep(s, 'scale') : null)
    }
    super.syncSettings(s)
  }

  // =================== bucle por frame ===================
  _frame(dt) {
    if (this._cameraPilot && this.vp.isFlying) this._pilotChange?.() // vuelo WASD no emite OrbitControls.change
    this._sceneFrame(dt)
    this._postVolumeEditorTick(dt)
    if (this.roadHandles?.visible) this._scaleHandles()
    if (this.stroke && this.terrains.length) {
      this._ray()
      const hit = this.raycastTerrain(this.raycaster.ray)
      if (hit) {
        if (this.stroke.a) { this._rampFrame(hit); return true }
        let tool = store.terrainTool
        const R = store.brush.radius
        // el pincel actúa sobre todas las piezas que toca el círculo (así se puede pintar a caballo entre dos)
        const reach = this.terrains.filter((t) => t.enabled && t.contains(hit.point.x, hit.point.z, R))
        if (tool === 'foliage') {
          const fb = store.foliageBrush
          for (const t of reach) t.foliage.brush(hit.point.x - t.ox, hit.point.z - t.oz, { radius: R, strength: store.brush.strength, dt, typeId: fb.typeId, erase: fb.erase !== this.stroke.invert, eraseAll: fb.erase && fb.all })
          this._updateBrushCursor(hit)
          return true
        }
        if (this.stroke.invert) tool = tool === 'raise' ? 'lower' : tool === 'lower' ? 'raise' : tool
        for (const t of reach) {
          t.applyBrush(tool, hit.point.x - t.ox, hit.point.z - t.oz, { ...store.brush, dt, layer: store.brush.layer, flattenHeight: this.stroke.flatten - t.oy })
          if (tool !== 'paint' && t.foliage.total) {
            const box = t.takeDirtyBox()
            if (box) t.foliage.refreshHeights(box)
          }
        }
        this._updateBrushCursor(hit)
        return true
      }
    }
    return false
  }




  cancelEditorPointer(reason) {
    this.edit?._continuousGrab?.cancel(reason)
    this._continuousGrab?.cancel(reason)
    this.vp._stopContinuousNavigation?.(true)
  }

  dispose() {
    this.cancelEditorPointer('dispose')
    this.clearMeshLocalView()
    this.setGameView(false)
    this._endSnapDrag?.(this._snapDrag?.control)
    this._keyCleanup?.()
    this._pointerCleanup?.()
    this._snapPointerCleanup?.()
    this._terrainEdgeCleanup?.()
    this.vp._onFlyInput = null
    this._flyGizmoInput = null
    this.vp._stopContinuousNavigation?.(true)
    this._continuousGrab?.dispose()
    this.stopCameraPilot()
    this.streamingPreview.dispose()
    this._stops.forEach((s) => s())
    this.streamingPreview.dispose()
    this.edit?.dispose()
    this._offCam?.()
    for (const control of [...this._tcs(), this.tcTer]) control?.dispose()
    super.dispose()
  }
}

// Los métodos viven en src/core/editor/*.js (fase F4), agrupados por responsabilidad, y se mezclan aquí. Se copian los descriptores
// (no Object.assign) para que los getters no se ejecuten al mezclar.
function mixin(cls, methods) { Object.defineProperties(cls.prototype, Object.getOwnPropertyDescriptors(methods)) }
mixin(Editor, mesheditMethods)
mixin(Editor, keysMethods)
mixin(Editor, rampMethods)
mixin(Editor, placementMethods)
mixin(Editor, pointerMethods)
mixin(Editor, selectionMethods)
mixin(Editor, colliderMethods)
mixin(Editor, gizmoMethods)
mixin(Editor, environmentMethods)
mixin(Editor, roadsMethods)
mixin(Editor, terrainMethods)
mixin(Editor, cameraMethods)
// @@MIXINS@@

// reexport usado por la paleta de comandos
export { selectionRoots, updateSettings }
