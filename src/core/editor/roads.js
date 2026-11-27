// Trazados (carreteras, ríos): asas, arrastre y clics
import { acquirePointer } from '../../engine/runtime/input/pointer-capture.js'
import * as THREE from 'three'
import { store, editorSettings, getObject, updateObject, addObject, commit } from '../store.js'
import { normalizeRoadPaint, ROAD_PAINT_MAX_POINTS, ROAD_PAINT_MAX_STROKES } from '../../engine/runtime/render/road-paint.js'

export const roadsMethods = {
  /** Clic en una superficie real de la carretera seleccionada, no en el terreno ni en líneas. */
  _roadPaintHit() {
    const road = this._selectedRoad()
    if (!road || road.type !== 'road') return null
    const slot = store.roadPaint.slot
    if (!['asphalt', 'side'].includes(slot)) return null
    const root = this.nodes.get(road.id)
    const mesh = root?.userData.parts?.[slot]
    if (!mesh?.visible || !mesh.geometry?.attributes?.lfPaintUV) return null
    const hits = this.raycaster.intersectObject(mesh, false)
    for (const hit of hits) {
      if (!hit.face) continue
      const g = mesh.geometry, uv = g.getAttribute('lfPaintUV'), pos = g.getAttribute('position')
      const { a, b, c } = hit.face
      const pt = mesh.worldToLocal(hit.point.clone())
      const q = THREE.Triangle.getBarycoord(pt,
        new THREE.Vector3().fromBufferAttribute(pos, a),
        new THREE.Vector3().fromBufferAttribute(pos, b),
        new THREE.Vector3().fromBufferAttribute(pos, c), new THREE.Vector3())
      if (!q || !Number.isFinite(q.x)) continue
      return { id: road.id, uv: [Math.max(0, Math.min(1, q.x * uv.getX(a) + q.y * uv.getX(b) + q.z * uv.getX(c))),
        Math.max(0, Math.min(1, q.x * uv.getY(a) + q.y * uv.getY(b) + q.z * uv.getY(c)))] }
    }
    return null
  },

  _roadPaintDown(e) {
    if (e.button !== 0 || !store.roadPaint.active || this.edit || store.play.on) return false
    const h = this._roadPaintHit()
    if (!h) return true // en modo pincel no seleccionar ni transformar otro objeto
    const road = getObject(h.id)
    const paint = normalizeRoadPaint(road.props?.paint)
    const slot = store.roadPaint.slot
    const layer = paint[slot].find((l) => l.id === store.roadPaint.layerId)
    if (!layer || layer.strokes.length >= ROAD_PAINT_MAX_STROKES) return true
    if (!acquirePointer(this.dom, e, "Pintura de carretera")) return true
    const before = JSON.stringify(road.props.paint || null)
    layer.strokes.push({ points: [h.uv], radius: store.roadPaint.radius,
      hardness: store.roadPaint.hardness, opacity: store.roadPaint.opacity, erase: store.roadPaint.erase })
    this._roadPaintStroke = { id: h.id, slot, layerId: layer.id, paint, before }
    updateObject(h.id, { props: { paint } }, { commit: false })
    this.vp.controls.enabled = false
    return true
  },

  _roadPaintMove() {
    const op = this._roadPaintStroke
    if (!op) return
    const hit = this._roadPaintHit()
    if (!hit || hit.id !== op.id) return
    const points = op.paint[op.slot].find((l) => l.id === op.layerId)?.strokes.at(-1)?.points
    if (!points || points.length >= ROAD_PAINT_MAX_POINTS) return
    const last = points.at(-1)
    if (Math.hypot(last[0] - hit.uv[0], last[1] - hit.uv[1]) < 0.002) return
    points.push(hit.uv)
    updateObject(op.id, { props: { paint: op.paint } }, { commit: false })
  },

  _roadPaintEnd(cancel = false) {
    const op = this._roadPaintStroke
    if (!op) return false
    this._roadPaintStroke = null
    this.vp.controls.enabled = true
    if (cancel) {
      const previous = JSON.parse(op.before)
      updateObject(op.id, { props: { paint: previous } }, { commit: false })
    } else commit('Pintar material de carretera') // un trazo = una entrada Undo
    return true
  },

  /** Objetos con trazado por puntos (carretera, río). */
  _isPath(o) { return !!o && o.type === 'road' },

  /** El terreno cambió (pincel, deshacer…): las carreteras que lo siguen se regeneran. */
  touchTerrain() {
    this.vp.invalidateShadows()
    this._terrainVer = (this._terrainVer || 0) + 1
    for (const [id, n] of this.nodes) if (n.userData.refresh) n.userData.refresh()
    this._syncRoadHandles()
    this.vp.requestRender()
  },

  _selectedRoad() {
    const o = getObject(store.selectedId)
    return this._isPath(o) && store.selectedIds.length === 1 && !this._lockedChain(o.id) ? o : null
  },

  /** Esferas arrastrables en cada punto de control de la carretera seleccionada. */
  _syncRoadHandles() {
    if (!this.roadHandles) { this.roadHandles = new THREE.Group(); this.vp.overlay.add(this.roadHandles) }
    const g = this.roadHandles
    const o = (store.tool === 'select' || store.tool === 'road') && !this.edit && !store.roadPaint.active ? this._selectedRoad() : null
    const node = o && this.nodes.get(o.id)
    const pts = o ? o.props.points : []
    while (g.children.length > pts.length) { const c = g.children.pop(); c.geometry.dispose?.(); c.material.dispose?.() }
    if (!node) { g.visible = false; this.vp.requestRender(); return }
    g.visible = true
    node.updateWorldMatrix(true, false)
    const sel = store.roadPoint
    pts.forEach((pt, i) => {
      let m = g.children[i]
      if (!m) {
        m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ depthTest: false, transparent: true }))
        m.renderOrder = 999
        g.add(m)
      }
      m.userData.index = i
      m.material.color.set(i === sel ? '#ffb547' : i === 0 ? '#5cd65c' : i === pts.length - 1 ? '#ff6b6b' : '#ffffff')
      const w = new THREE.Vector3(...pt).applyMatrix4(node.matrixWorld)
      if (o.props.conform) { const g = this.groundAt(w.x, w.z); if (!Number.isNaN(g)) w.y = g + (o.props.lift || 0) + 0.15 }
      m.position.copy(w)
    })
    this._scaleHandles()
    this.vp.requestRender()
  },

  _scaleHandles() {
    const g = this.roadHandles
    if (!g || !g.visible) return
    for (const m of g.children) m.scale.setScalar(Math.max(0.05, this.vp.camera.position.distanceTo(m.position) * 0.011))
  },

  _roadPickHandle() {
    if (!this.roadHandles?.visible || !this.roadHandles.children.length) return -1
    this._scaleHandles()
    this.roadHandles.updateMatrixWorld(true)
    const hit = this.raycaster.intersectObjects(this.roadHandles.children, false)[0]
    return hit ? hit.object.userData.index : -1
  },

  _roadWorldToLocal(road, w) {
    const node = this.nodes.get(road.id)
    node.updateWorldMatrix(true, false)
    const l = node.worldToLocal(w.clone())
    return [+l.x.toFixed(3), +l.y.toFixed(3), +l.z.toFixed(3)]
  },

  _snapXZ(v) {
    const s = editorSettings()
    if (s.snap) { v.x = Math.round(v.x / s.gridSize) * s.gridSize; v.z = Math.round(v.z / s.gridSize) * s.gridSize }
    return v
  },

  _roadDragMove() {
    const d = this._roadDrag
    const road = getObject(d.id)
    if (!road) return
    let w = null
    if (road.props.conform) { const h = this.raycastTerrain(this.raycaster.ray); if (h) w = h.point.clone() }
    if (!w) { w = new THREE.Vector3(); if (!this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -d.y), w)) return }
    this._snapXZ(w)
    const old = road.props.points[d.index]
    const l = this._roadWorldToLocal(road, w)
    const pts = road.props.points.map((p) => [...p])
    pts[d.index] = road.props.conform ? [l[0], old[1], l[2]] : l
    road.props.points = pts
    d.moved = true
    this.syncObject(road.id)
    this._syncRoadHandles()
  },

  /** Herramienta Carretera: cada clic añade un punto (o crea la carretera con el primero). */
  _roadClick() {
    const hit = this._surfaceHit({ fallback: 'ground' })
    if (!hit) return
    const w = this._snapXZ(hit.point.clone())
    const sel = this._selectedRoad()
    if (sel) {
      const pts = [...sel.props.points.map((p) => [...p]), this._roadWorldToLocal(sel, w)]
      store.roadPoint = pts.length - 1
      updateObject(sel.id, { props: { points: pts } }, { label: 'Añadir punto de carretera' })
      this._syncRoadHandles()
    } else {
      const o = addObject({ type: 'road', kind: 'road', position: [+w.x.toFixed(3), +w.y.toFixed(3), +w.z.toFixed(3)], props: { points: [[0, 0, 0]] } }, { select: true, label: 'Nueva carretera' })
      store.roadPoint = 0
      void o
    }
  },
}
