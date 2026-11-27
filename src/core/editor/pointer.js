// Cursores de pincel, rayos, selección con el ratón y hover
import { acquirePointer } from '../../engine/runtime/input/pointer-capture.js'
import { usableRect, finiteVector } from '../../engine/runtime/numeric-integrity.js'
import * as THREE from 'three'
import { store, getObject, selectObject, selectPiece, commitTerrain, commit } from '../store.js'
import { win } from '../../engine/runtime/platform.js'

export const pointerMethods = {
  // =================== brush y cursores ===================
  _buildBrushCursor() {
    const mk = (color) => {
      const g = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 73 }, () => new THREE.Vector3()))
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true }))
      l.renderOrder = 999
      l.frustumCulled = false
      l.visible = false
      this.vp.overlay.add(l)
      return l
    }
    this.ringOuter = mk(0xffffff)
    this.ringInner = mk(0x5fa8dd)
  },

  _placeRing(ring, cx, cz, r) {
    const pos = ring.geometry.attributes.position
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * Math.PI * 2
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r
      pos.setXYZ(i, x, this.heightAt(x, z) + 0.12, z)
    }
    pos.needsUpdate = true
    ring.visible = true
  },

  _updateBrushCursor(hit) {
    if (this.stroke?.a) return // durante una rampa los anillos marcan los extremos A y B
    if (store.tool !== 'terrain' || !hit) { this.ringOuter.visible = this.ringInner.visible = false; return }
    const b = store.brush
    this._placeRing(this.ringOuter, hit.point.x, hit.point.z, b.radius)
    this._placeRing(this.ringInner, hit.point.x, hit.point.z, Math.max(0.05, b.radius * b.hardness))
  },

  // =================== raycast ===================
  _setRay(e) {
    const r = this.dom.getBoundingClientRect()
    this.pointer.x = e.clientX - r.left
    this.pointer.y = e.clientY - r.top
    return this._ray()
  },

  _ray() {
    const r = this.dom.getBoundingClientRect()
    if (!usableRect(r) || ![this.pointer.x, this.pointer.y].every(Number.isFinite)) return false
    this.raycaster.setFromCamera(new THREE.Vector2((this.pointer.x / r.width) * 2 - 1, -(this.pointer.y / r.height) * 2 + 1), this.vp.camera)
    return finiteVector(this.raycaster.ray.origin) && finiteVector(this.raycaster.ray.direction)
  },

  _objectRoot(o) {
    while (o && o.userData.kind !== 'object') o = o.parent
    return o
  },

  _pickable(root) {
    for (let n = root; n && n !== this.objectsGroup; n = n.parent) if (!n.visible) return false
    return !this._lockedChain(root.userData.id)
  },

  /** Excluye ayudas y descendientes ocultos. Los proxies invisibles siguen permitiendo elegir nodos sin malla. */
  _hitAllowed(part, root, surfacesOnly) {
    const proxy = !surfacesOnly && !!part.userData?.pickProxy
    for (let n = part; n && n !== root; n = n.parent) {
      if (!n.visible || (n.userData?.helper && !proxy) || n.userData?.pickIgnore) return false
    }
    if (surfacesOnly) {
      if (!part.isMesh || part.material?.visible === false || part.material?.opacity === 0) return false
      if (part.userData?.pickProxy) return false
    } else if (part.material?.visible === false && !proxy) return false
    return true
  },

  _pick({ surfacesOnly = false } = {}) {
    const hits = this.raycaster.intersectObjects(this.objectsGroup.children, true)
    let best = null, wet = null
    for (const h of hits) {
      const root = this._objectRoot(h.object)
      if (!root || !this._pickable(root) || !this._hitAllowed(h.object, root, surfacesOnly)) continue
      const hit = { id: root.userData.id, distance: h.distance, point: h.point }
      if (root.userData.waterU) { // el agua transparente no debe tapar los objetos sólidos
        if (store.tool !== 'road' && !wet) wet = hit
        continue
      }
      best = hit; break
    }
    if (!best) best = wet
    const t = store.view.terrain ? this.raycastTerrain(this.raycaster.ray) : null
    return { object: best, terrain: t }
  },

  /** Sin superficie visible, coloca delante de la cámara; nunca sobre un plano infinito o en el origen. */
  _cameraPlaceHit() {
    const ray = this.raycaster.ray
    return { point: ray.origin.clone().addScaledVector(ray.direction, 6), onObject: false, free: true }
  },

  _surfaceHit({ fallback = 'camera' } = {}) {
    const { object, terrain } = this._pick({ surfacesOnly: true })
    if (object && (!terrain || object.distance < terrain.distance)) return { point: object.point.clone(), onObject: true }
    if (terrain) return { point: terrain.point.clone(), onObject: false }
    if (fallback === 'ground') { // la herramienta de carreteras conserva su intersección con el suelo
      const p = new THREE.Vector3()
      return this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p) ? { point: p, onObject: false } : null
    }
    return this._cameraPlaceHit()
  },

  _viewportSelectionId(id) {
    const obj = getObject(id)
    if (!obj) return id
    if (obj.sceneInstanceOwner || obj.type === 'sceneInstance') return obj.sceneInstanceOwner || id
    return obj.parentId && obj.parentId !== id && getObject(obj.parentId) ? obj.parentId : id
  },

  // =================== puntero ===================
  _bindPointer() {
    const dom = this.dom
    let previousHit = null, doubleClickHit = null
    const clearSelectionGesture = () => { previousHit = doubleClickHit = null; this._down = null }
    const sameHit = (a, b) => !!a && !!b && a.node === b.node && a.project === b.project && a.sceneId === b.sceneId
    const trackPointer = (e) => { this.lastClient = { x: e.clientX, y: e.clientY } }
    win.addEventListener('pointermove', trackPointer, { passive: true })
    this._pointerCleanup = () => win.removeEventListener('pointermove', trackPointer)
    dom.addEventListener('pointerenter', () => { this.pointer.inside = true })
    dom.addEventListener('pointerleave', () => {
      this.pointer.inside = false
      store.cursor = null
      this._updateBrushCursor(null)
      if (this.ghost) { this.ghost.visible = false; this.vp.requestRender() }
    })

    dom.addEventListener('pointermove', (e) => {
      if (store.play.on || store.gameView.on || this.vp.isFlying || this.vp.isNavigating) return
      if (!this._setRay(e)) return
      if (this.paint) { this.paint.move(e); return }
      if (this._roadPaintStroke) { this._roadPaintMove(); return }
      if (this._colliderDrag) { this._colliderMove(); return }
      if (this._roadDrag) { this._roadDragMove(); return }
      this._hover()
    })

    dom.addEventListener('pointerdown', (e) => {
      this._down = null
      doubleClickHit = null
      if (e.button !== 0) previousHit = null
      if (store.gameView.on) return
      if (store.roadPaint.active && !store.play.on && !this.vp.isFlying && !this.vp.wantsNav(e)) { if (!this._setRay(e) || this._roadPaintDown(e)) return }
      if (this.paint && !store.play.on && e.button === 0 && !this.vp.isFlying && !this.vp.wantsNav(e)) { if (this._setRay(e)) this.paint.down(e); return }
      if (store.play.on || this.edit || this.paint) return
      if (e.button !== 0 || this.vp.isFlying || this.vp.wantsNav(e)) return
      if (!this._setRay(e)) return
      if (this._colliderDown(e)) return
      this._down = { x: e.clientX, y: e.clientY, gizmo: this._anyAxis(), project: store.project, sceneId: store.project?.activeSceneId }
      if ((store.tool === 'select' || store.tool === 'road') && !this._anyAxis()) {
        const hi = this._roadPickHandle()
        if (hi >= 0) {
          const road = this._selectedRoad()
          if (!acquirePointer(dom, e, "Punto de carretera")) { this._down = null; return }
          store.roadPoint = hi
          const node = this.nodes.get(road.id)
          const wy = new THREE.Vector3(...road.props.points[hi]).applyMatrix4(node.matrixWorld).y
          this._roadDrag = { id: road.id, index: hi, y: wy, moved: false }
          this._down = null
          this.vp.controls.enabled = false
          this._syncRoadHandles()
          return
        }
      }
      if (store.tool === 'terrain') {
        const hit = this.raycastTerrain(this.raycaster.ray)
        if (!hit) return
        if (!acquirePointer(dom, e, "Pincel de terreno")) { this._down = null; return }
        this.stroke = { flatten: hit.point.y, invert: e.ctrlKey || e.metaKey }
        if (store.terrainTool === 'ramp') {
          this.stroke.a = { x: hit.point.x, y: hit.point.y, z: hit.point.z }
          for (const t of this.terrains) if (t.enabled) t.beginRamp()
        }
      }
    })

    const interrupt = () => {
      clearSelectionGesture()
      this._roadPaintEnd(true)
      if (this._colliderDrag) this._colliderUp()
      if (this._roadDrag) {
        const d = this._roadDrag; this._roadDrag = null
        this.vp.controls.enabled = true
        if (d.moved) commit('Mover punto de carretera')
      }
      if (this.stroke) {
        if (this.stroke.a) this._endRamp()
        this.stroke = null; this.stitch(); commitTerrain(`Pincel: ${store.terrainTool}`); this.touchTerrain()
      }
      this.paint?.up()
    }
    dom.addEventListener('pointercancel', interrupt)
    dom.addEventListener('lostpointercapture', () => { if (this._roadPaintStroke || this._colliderDrag || this._roadDrag || this.stroke || this.paint?.op) interrupt() })
    win.addEventListener('blur', interrupt)
    const cleanupPointer = this._pointerCleanup
    this._pointerCleanup = () => { cleanupPointer(); win.removeEventListener('blur', interrupt) }
    dom.addEventListener('pointerup', (e) => {
      const priorHit = previousHit
      previousHit = doubleClickHit = null
      if (store.gameView.on) return
      if (this._roadPaintStroke) { this._roadPaintEnd(false); return }
      if (this.paint) { this.paint.up(e); return }
      if (store.play.on || this.edit) return
      if (e.button !== 0) return
      if (this._colliderUp()) return
      if (this._roadDrag) {
        const d = this._roadDrag
        this._roadDrag = null
        this.vp.controls.enabled = true
        if (d.moved) commit('Mover punto de carretera')
        return
      }
      if (this.stroke) {
        if (this.stroke.a) this._endRamp()
        this.stroke = null
        this.stitch()
        commitTerrain(`Pincel: ${store.terrainTool}`)
        this.touchTerrain()
        return
      }
      const d = this._down
      this._down = null
      if (!d || d.gizmo || this._dragging || d.project !== store.project || d.sceneId !== store.project?.activeSceneId) return
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return
      if (!this._setRay(e)) return
      if (store.tool === 'select') {
        const { object, terrain } = this._pick()
        const chunk = this.streamingPreview?.pick(this.raycaster)
        if (chunk && chunk.distance < Math.min(object?.distance ?? Infinity, terrain?.distance ?? Infinity)) {
          this.streamingPreview.select(chunk.index, chunk.nodeId)
          return
        }
        // el terreno también se elige con un clic (como en Unity): si está delante de cualquier objeto, se selecciona su pieza
        if (terrain && (!object || terrain.distance < object.distance - 1e-3) && !e.shiftKey && !(e.ctrlKey || e.metaKey)) selectPiece(terrain.piece.id)
        else if (object || !(e.shiftKey || e.ctrlKey || e.metaKey)) {
          if (object && !(e.shiftKey || e.ctrlKey || e.metaKey || e.altKey)) {
            const node = getObject(object.id)
            if (node) {
              previousHit = { node, project: store.project, sceneId: store.project?.activeSceneId }
              if (sameHit(priorHit, previousHit)) doubleClickHit = previousHit
            }
          }
          selectObject(object ? this._viewportSelectionId(object.id) : null, { additive: e.shiftKey, toggle: e.ctrlKey || e.metaKey })
        }
      } else if (store.tool === 'place') {
        this._placeHere(e.shiftKey)
      } else if (store.tool === 'road') {
        this._roadClick()
      }
    })

    dom.addEventListener('dblclick', (e) => {
      const hit = doubleClickHit
      previousHit = doubleClickHit = null
      if (!hit || e.button !== 0 || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey ||
          store.play.on || store.gameView.on || this.edit || this.paint || store.tool !== 'select' || this._dragging ||
          this.vp.isFlying || this.vp.isNavigating) return
      const node = getObject(hit.node.id)
      if (!sameHit(hit, { node, project: store.project, sceneId: store.project?.activeSceneId }) || this._lockedChain(node.id)) return
      selectObject(node.id)
    })
  },

  _hover() {
    const now = performance.now()
    if (store.tool === 'terrain') {
      const hit = this.raycastTerrain(this.raycaster.ray)
      this._updateBrushCursor(hit)
      if (hit) store.cursor = { x: hit.point.x, y: hit.point.y, z: hit.point.z }
      this.vp.requestRender()
    } else if (store.tool === 'place') {
      this._moveGhost()
      this.vp.requestRender()
    } else if (now - this._lastCursor > 60) {
      this._lastCursor = now
      const hit = this.raycastTerrain(this.raycaster.ray)
      store.cursor = hit ? { x: hit.point.x, y: hit.point.y, z: hit.point.z } : null
    }
  },
}
