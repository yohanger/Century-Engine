import { effectiveNavigationPrefs } from './mouse-sensitivity.js'
// Teclado, rueda y observadores del estado
import { watch } from '@vue/reactivity'
import { GIZMO_CATEGORIES } from './gizmo-visibility.js'
import { syncPlayerSceneVisuals } from './player-preview.js'
import { clamp } from '../../engine/runtime/util.js'
import { hasTool, tool } from '../tools.js' // El editor registra comandos; FilmMaker solo registra captura y cine.
import { store, getObject, selectObject, undo, redo, removeSelected, duplicateSelected, linkedDuplicateSelected, copySelected, pasteSelected, groupSelected, ungroup, saveLfproj, saveAll, openLfprojDialog, parentSelectionToActive, unparentSelection, joinSelectedMeshes, openEventEditor, toast } from '../store.js'
import { getAudio } from '../../engine/runtime/audio/engine.js'
import { win, doc } from '../../engine/runtime/platform.js'
import { releasePropertyFocusOnEscape } from './property-focus.js'
import { isLocalMeshShortcut } from './local-mesh-view.js'

export const keysMethods = {
  /** Radio máximo del pincel: crece con el tamaño del terreno. */
  maxBrush() { return clamp(Math.round((this.terrain?.size ?? 64) / 4), 40, 400) },

  /** Teclado numérico estilo Blender. Devuelve true si la tecla se usó. */
  _numpad(e) {
    const vp = this.vp, ctrl = e.ctrlKey || e.metaKey
    const c = e.code.slice(6) // Numpad1 → 1
    switch (c) {
      case '1': vp.setView(ctrl ? 'back' : 'front'); break
      case '3': vp.setView(ctrl ? 'left' : 'right'); break
      case '7': vp.setView(ctrl ? 'bottom' : 'top'); break
      case '0': vp.setView('persp'); break
      case '5': vp.setOrtho(!vp.isOrtho); break
      case '9': vp.flipView(); break
      case '4': ctrl ? vp.stepPan(1, 0) : vp.stepOrbit(-1, 0); break
      case '6': ctrl ? vp.stepPan(-1, 0) : vp.stepOrbit(1, 0); break
      case '8': ctrl ? vp.stepPan(0, -1) : vp.stepOrbit(0, 1); break
      case '2': ctrl ? vp.stepPan(0, 1) : vp.stepOrbit(0, -1); break
      case 'Add': vp.stepZoom(1); break
      case 'Subtract': vp.stepZoom(-1); break
      case 'Decimal': this.focus(); break
      default: return false
    }
    return true
  },

  // =================== teclado ===================
  _bindKeys() {
    const onShiftDown = (e) => {
      if (e.key === 'Shift' && !store.play.on && !store.locked) {
        if (this.edit) this.edit.setSnapShiftHeld(true)
        else this._setSnapShiftHeld(true)
      }
    }
    const onShiftUp = (e) => { if (e.key === 'Shift') { this._setSnapShiftHeld(false); this.edit?.setSnapShiftHeld(false) } }
    const releaseShift = () => { this._setSnapShiftHeld(false); this.edit?.setSnapShiftHeld(false) }
    const onVisibility = () => { if (doc.hidden) releaseShift() }
    win.addEventListener('keydown', onShiftDown, true)
    win.addEventListener('keyup', onShiftUp, true)
    win.addEventListener('blur', releaseShift)
    doc.addEventListener('visibilitychange', onVisibility)
    doc.addEventListener('keydown', releasePropertyFocusOnEscape)
    const onKeyDown = (e) => {
      if (store.locked) return
      const t = e.target
      const mod = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      if (this.edit && !store.play.on && !store.gameView.on && !store.modal && !store.palette &&
          e.ctrlKey && !e.metaKey && e.altKey && !e.shiftKey && !e.isComposing && k === 'm') {
        e.preventDefault()
        if (!e.repeat) this.edit.toggleGlobalShortcuts()
        return
      }
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      if (mod && k === ',') { e.preventDefault(); store.modal = 'prefs'; return }
      if (mod && k === 'k') { e.preventDefault(); store.palette = !store.palette; return }
      if (!mod && !e.altKey && !e.shiftKey && k === 'f3' && !store.modal && !store.palette && store.project) { e.preventDefault(); store.view.perf = !store.view.perf; return }
      if (store.play.on && (store.ui.viewTab !== 'scene' || !this.editObserverControls)) return
      if (store.modal || store.palette || this.vp.isFlying || !store.project) return
      if (store.gameView.on && (!mod || e.code.startsWith('Numpad'))) {
        if (k === 'escape') { e.preventDefault(); this.setGameView(false) }
        if (k === 'f5') { e.preventDefault(); this.player.start({ here: e.shiftKey }) }
        return
      }
      const meshKeysHere = store.edit.globalShortcuts || !!this.pointer?.inside
      if (this.edit && !store.play.on && isLocalMeshShortcut(e)) {
        if (!meshKeysHere || this.edit.modal || this.edit.paintStroke) return
        e.preventDefault(); e.stopPropagation()
        if (!e.repeat) this.toggleMeshLocalView()
        return
      }
      if (this.edit && !meshKeysHere && k === 'tab' && !mod && !e.altKey) return
      if (k === 'tab' && !mod && !e.altKey && this.edit?.modal) {
        if (!this.edit.modal.inspecting || !t?.closest?.('[data-mesh-inspector]')) {
          e.preventDefault()
          this.edit.focusModalInspector()
        }
        return
      }
      if (!store.play.on && !this.edit?.modal && e.code.startsWith('Numpad') && this._numpad(e)) { e.preventDefault(); e.stopPropagation(); return }
      if (this.edit && !mod && e.altKey && k === 'd') { if (meshKeysHere) e.preventDefault(); return }
      if (this.paint && k !== 'tab' && this.paint.onKey(e)) { e.preventDefault(); e.stopPropagation(); return }
      if (this.edit && k !== 'tab' && this.edit.onKey(e, meshKeysHere)) {
        if (meshKeysHere) { e.preventDefault(); e.stopPropagation() }
        return
      }
      if (this.edit && k === 'escape') return
      if (store.roadPaint.active && k === 'escape') { e.preventDefault(); this._roadPaintEnd(true); store.roadPaint.active = false; return }
      // Ctrl+C/V son de objetos, no del Edit Mesh: impedir que copien el nodo entero al editar vértices.
      if (this.edit && mod && (k === 'c' || k === 'v')) { e.preventDefault(); return }
      if (mod && k === 'z') { e.preventDefault(); try { e.shiftKey ? redo() : undo() } catch (error) { toast(error.message || String(error), 'error', 5000) }; return }
      if (mod && k === 'y') { e.preventDefault(); try { redo() } catch (error) { toast(error.message || String(error), 'error', 5000) }; return }
      if (mod && k === 's') { e.preventDefault(); if (e.shiftKey) saveLfproj(); else saveAll(); return }
      if (mod && k === 'o') { e.preventDefault(); openLfprojDialog(); return }
      if (mod && k === 'b') { e.preventDefault(); store.modal = 'export'; return }
      if (mod && k === 'c' && !e.shiftKey) { e.preventDefault(); copySelected(); return }
      if (mod && k === 'v' && !e.shiftKey) { e.preventDefault(); pasteSelected(this.clipboardPlacePoint()); return }
      if (mod && k === 'd') { e.preventDefault(); duplicateSelected(); return }
      if (!mod && e.altKey && k === 'd') { e.preventDefault(); linkedDuplicateSelected(); return }
      if (mod && k === 'g') { e.preventDefault(); e.shiftKey ? ungroup(store.selectedId) : groupSelected(); return }
      if (mod && k === 'a' && e.shiftKey && !e.altKey && !e.isComposing &&
          !store.gameView.on && !this.edit && !store.filmMode && !store.addModal && hasTool('commands')) {
        e.preventDefault()
        if (!e.repeat) tool('commands').run('scene.instantiate')
        return
      }
      if (mod && k === 'a' && !e.shiftKey && !e.altKey) { e.preventDefault(); selectObject(null, { range: store.project.objects.map((o) => o.id) }); return }
      if (mod && k === 'p') { e.preventDefault(); parentSelectionToActive(); return }
      if (mod && k === 'j') { e.preventDefault(); joinSelectedMeshes(); return }
      if (mod) return
      switch (k) {
        case 'q': store.tool = 'select'; store.gizmo = 'none'; break
        case 'w': store.tool = 'select'; store.gizmo = 'translate'; break
        case 'e': store.tool = 'select'; store.gizmo = 'rotate'; break
        case 'r': store.tool = 'select'; store.gizmo = 'scale'; break
        case 'y': store.tool = 'select'; store.gizmo = 'universal'; break
        case 'u': store.tool = store.tool === 'road' ? 'select' : 'road'; break
        case 'b': store.tool = 'terrain'; break
        case 'f': this.focus(); break
        case 'x': store.space = store.space === 'world' ? 'local' : 'world'; break
        case 'tab':
          e.preventDefault()
          if (e.shiftKey) { const both = store.prefs.leftOpen || store.prefs.rightOpen; store.prefs.leftOpen = store.prefs.rightOpen = !both }
          else this.toggleEdit()
          break
        case 'a': if (e.shiftKey && hasTool('commands')) { e.preventDefault(); tool('commands').openAddMenu() } break
        case 'p': if (e.altKey) { e.preventDefault(); unparentSelection(1) } break
        case 'f2': if (store.selectedId) store.renameId = store.selectedId; break
        case 'f5': e.preventDefault(); this.player.start({ here: e.shiftKey }); break
        case '[': store.brush.radius = clamp(+(store.brush.radius * 0.88).toFixed(2), 0.5, this.maxBrush()); break
        case ']': store.brush.radius = clamp(+(store.brush.radius / 0.88).toFixed(2), 0.5, this.maxBrush()); break
        case 'enter': if (store.tool === 'road') store.tool = 'select'; else if (getObject(store.selectedId)?.type === 'event' && store.selectedIds.length === 1) openEventEditor(store.selectedId); break
        case 'escape': if (store.tool !== 'select') store.tool = 'select'; else selectObject(null); break
        case 'delete': case 'backspace': if (store.selectedIds.length) { e.preventDefault(); removeSelected() } break
      }
    }
    win.addEventListener('keydown', onKeyDown)
    this._keyCleanup = () => {
      win.removeEventListener('keydown', onKeyDown)
      win.removeEventListener('keydown', onShiftDown, true)
      win.removeEventListener('keyup', onShiftUp, true)
      win.removeEventListener('blur', releaseShift)
      doc.removeEventListener('visibilitychange', onVisibility)
      doc.removeEventListener('keydown', releasePropertyFocusOnEscape)
    }
  },

  // =================== watchers ===================
  withHistorySceneSync(restore) {
    if (this._historySceneObservers) throw new Error('Restauración de escena reentrante')
    const pending = new Map()
    this._historySceneObservers = pending
    try {
      restore()
    } finally {
      this._historySceneObservers = null
    }
    // Las notificaciones diferidas solo se ejecutan si la sincronización terminó.
    for (const [callback, args] of pending) callback(...args)
  },

  _bindWatchers() {
    const observe = (source, callback, options) => watch(source, (...args) => {
      const pending = this._historySceneObservers
      if (pending) pending.set(callback, args)
      else callback(...args)
    }, options)
    this._stops = [
      observe(() => store.tool, (t) => {
        if (t !== 'place') this._clearGhost()
        if (t !== 'terrain') this._updateBrushCursor(null)
        this.setSelection(store.selectedId, store.selectedIds)
        this.edit?.syncGizmoMode()
        this.dom.style.cursor = store.roadPaint.active || t === 'terrain' || t === 'road' ? 'crosshair' : t === 'place' ? 'copy' : 'default'
        this._syncRoadHandles()
        this.vp.requestRender()
      }),
      observe(() => store.roadPaint.active, (on) => { this.dom.style.cursor = on ? 'crosshair' : 'default'; this._syncRoadHandles(); this.vp.requestRender() }),
      observe(() => [store.gizmo, store.space], () => this._updateGizmoMode()),
      observe(() => store.selectedId, (id) => { if (this.edit && id !== this.edit.objId) this.exitEditMode(); if (store.roadPaint.active && getObject(id)?.type !== 'road') { this._roadPaintEnd(true); store.roadPaint.active = false } }),
      observe(() => [store.edit.proportional, store.edit.xray, store.edit.showNormals], () => { if (this.edit) { this.edit._applyXray(); this.edit.refresh({ geometry: false }) } }),
      observe(() => store.view, () => this.applyView(), { deep: true }),
      observe(() => store.play.on, () => { this.applyView(); syncPlayerSceneVisuals(this) }),
      watch(() => store.project?.id, () => this.setGameView(false)),
      observe(() => {
        const project = store.project
        const scene = project?.scenes?.find(s => s.id === project.activeSceneId)
        const p = project?.database?.player
        return [project?.activeSceneId, scene?.playerNodeId, scene?.playerSpawnMode,
          scene?.gameManagerId, project?.game?.player, project?.gameManagers?.find(g => g.id === scene?.gameManagerId)?.player,
          p?.height, p?.radius, p?.eyeHeight, p?.fov]
      }, () => syncPlayerSceneVisuals(this), { deep: true }),
      observe(() => store.gameView.on ? [store.project?.gameManagers, store.project?.scenes, store.project?.game?.player, store.project?.database?.player?.fov] : null, () => {
        if (store.gameView.on) this.vp.requestRender()
      }, { deep: true }),
      observe(() => store.project?.audio, (a) => { if (a) getAudio().configure(a) }, { deep: true }),
      observe([() => store.project?.render, () => store.view.renderMethod], () => this.applyRender(), { deep: true }),
      observe(() => store.place, () => { this._clearGhost(); if (store.tool === 'place' && this.pointer.inside) this._moveGhost() }, { deep: true }),
      observe(() => [store.terrainSel, store.tool, store.activePieceId, store.view.terrain], () => this._syncTerrainGizmo()),
      observe(() => store.brush, () => { if (store.tool === 'terrain') { this._updateBrushCursor(this.raycastTerrain(this.raycaster.ray)); this.vp.requestRender() } }, { deep: true }),
      watch(() => store.prefs.navigation, (m) => this.vp.setNavigation(m)),
      watch(() => store.prefs.orbitSelection, (on) => { this.vp.orbitAroundSelection = !!on }),
      watch(() => [store.prefs.selectionStyle, store.prefs.selectionOutlineColor, store.prefs.selectionOutlineWidth, store.prefs.selectionOutlineStrength], () => this.setSelection(store.selectedId, store.selectedIds)),
      watch(() => [store.prefs.showGizmos, ...GIZMO_CATEGORIES.map(({ id }) => store.prefs.gizmoCategories?.[id])], () => {
        this._refreshNodeGizmos()
        this.vp.requestRender()
      }),
      watch(() => ({ ...store.prefs }), (p) => { this.vp.applyPrefs(effectiveNavigationPrefs(p)); this._applyGizmoSize() }),
      observe(() => store.project?.terrain?.foliage, (f) => {
        if (!this.terrains.length || !f) return
        for (const t of this.terrains) t.foliage.setTypes(JSON.parse(JSON.stringify(f)))
        this.vp.requestRender()
      }, { deep: true }),
      observe(() => store.project?.terrain?.layers, () => {
        if (!this.terrains.length || !store.project) return
        for (const t of this.terrains) t.setLayers(store.project.terrain.layers)
        this.vp.requestRender()
      }, { deep: true }),
    ]
  },
}
