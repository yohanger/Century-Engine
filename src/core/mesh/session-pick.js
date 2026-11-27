// Edición de malla · cámara, rayos y selección con el ratón (vértice, arista, cara, bucle, caja). Mixin de `EditSession` (session.js).
import { usableRect, finiteVector } from '../../engine/runtime/numeric-integrity.js'
import * as THREE from 'three'
import { ekeyA, ekeyB } from '../../engine/runtime/mesh/polymesh.js'
import { normalize, edgeLoop } from './sel.js'
import { ringOf } from './cuts.js'
import { store } from '../store.js'

export const pickMethods = {
  _ray(x, y) {
    const r = this.dom.getBoundingClientRect()
    if (!usableRect(r) || ![x, y].every(Number.isFinite)) return null
    this.rc.setFromCamera(new THREE.Vector2((x / r.width) * 2 - 1, -(y / r.height) * 2 + 1), this.vp.camera)
    return finiteVector(this.rc.ray.origin) && finiteVector(this.rc.ray.direction) ? this.rc.ray.clone() : null
  },

  _project(world) {
    const r = this.dom.getBoundingClientRect()
    const v = world.clone().project(this.vp.camera)
    return { x: (v.x * 0.5 + 0.5) * r.width, y: (-v.y * 0.5 + 0.5) * r.height, z: v.z }
  },

  _screenVerts() {
    this.visual.updateWorldMatrix(true, false)
    const M = this.visual.matrixWorld
    const tmp = new THREE.Vector3()
    return this.poly.v.map((p) => { tmp.set(...p).applyMatrix4(M); return this._project(tmp) })
  },

  _worldPerPx(point) {
    const cam = this.vp.camera, r = this.dom.getBoundingClientRect()
    if (cam.isOrthographicCamera) return (2 * this.vp._orthoH / cam.zoom) / r.height
    const d = cam.position.distanceTo(point)
    return (2 * Math.tan((cam.fov * Math.PI) / 360) * d) / r.height
  },

  _visible(localPoint) {
    if (store.edit.xray) return true
    const M = this.visual.matrixWorld
    const wp = new THREE.Vector3(...localPoint).applyMatrix4(M)
    const camO = this.vp.camera
    let cam = camO.position, dir = wp.clone().sub(cam)
    if (camO.isOrthographicCamera) { // rayos paralelos: el origen se retrasa sobre el eje de visión
      dir = camO.getWorldDirection(new THREE.Vector3())
      cam = wp.clone().addScaledVector(dir, -200)
    }
    const dist = camO.isOrthographicCamera ? 200 : dir.length()
    dir.normalize()
    this.rc.set(cam, dir)
    this.rc.far = dist
    const hits = this.rc.intersectObject(this.body, false)
    this.rc.far = Infinity
    if (!hits.length) return true
    return hits[0].distance > dist - Math.max(0.01 * dist, 1e-3)
  },

  // ------------------------------------------------------------------ selección con el ratón
  _pickVertex(x, y, R = 14) {
    const S = this._screenVerts(), c = []
    S.forEach((p, i) => { if (p.z > 1 || this.poly.hidden.has(i)) return; const d = Math.hypot(p.x - x, p.y - y); if (d <= R) c.push([d, i]) })
    c.sort((a, b) => a[0] - b[0])
    for (const [, i] of c) if (this._visible(this.poly.v[i])) return i
    return null
  },

  _pickEdge(x, y, R = 12) {
    const S = this._screenVerts(), P = this.poly, c = []
    for (const [k, e] of P.edges()) {
      if (P.hidden.has(e.a) || P.hidden.has(e.b)) continue
      const a = S[e.a], b = S[e.b]
      if (a.z > 1 || b.z > 1) continue
      const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy
      let t = l2 ? ((x - a.x) * dx + (y - a.y) * dy) / l2 : 0
      t = Math.max(0, Math.min(1, t))
      const d = Math.hypot(a.x + dx * t - x, a.y + dy * t - y)
      if (d <= R) c.push([d, k, t])
    }
    c.sort((a, b) => a[0] - b[0])
    for (const [, k, t] of c.slice(0, 12)) {
      const e = P.edges().get(k)
      const mid = [0, 1, 2].map((q) => P.v[e.a][q] + (P.v[e.b][q] - P.v[e.a][q]) * t)
      if (this._visible(mid)) return k
    }
    return null
  },

  _pickFace(x, y) {
    const ray = this._ray(x, y)
    if (!ray) return null
    const pick = () => {
      this.rc.ray.copy(ray)
      return this.rc.intersectObject(this.body, false)[0] || null
    }
    const faceMap = () => {
      const geometry = this.body?.geometry
      const map = geometry?.userData?.faceOf
      const triangles = (geometry?.index?.count ?? geometry?.getAttribute?.('position')?.count ?? -1) / 3
      return (Array.isArray(map) || ArrayBuffer.isView(map)) && Number.isInteger(triangles) && map.length === triangles ? map : null
    }
    let hit = pick()
    if (!hit) return null
    let map = faceMap()
    if (!map || !Number.isInteger(map[hit.faceIndex]) || map[hit.faceIndex] < 0 || map[hit.faceIndex] >= this.poly.f.length) {
      this._rebuildBody()
      map = faceMap()
      hit = pick()
    }
    if (!map || !hit) return null
    const face = map[hit.faceIndex]
    return Number.isInteger(face) && face >= 0 && face < this.poly.f.length && !this.poly.faceHidden(face) ? face : null
  },

  _pick(x, y) {
    if (this.mode === 'vertex') return this._pickVertex(x, y)
    if (this.mode === 'edge') return this._pickEdge(x, y)
    return this._pickFace(x, y)
  },

  _primary() { return this.mode === 'vertex' ? this.sel.v : this.mode === 'edge' ? this.sel.e : this.sel.f },

  _clickSelect(x, y, e) {
    const hit = this._pick(x, y)
    const set = this._primary()
    if (e.altKey && hit != null) { this._loopSelect(x, y, e); return }
    if (!e.shiftKey && !e.ctrlKey) { set.clear(); this.sel.v.clear(); this.sel.e.clear(); this.sel.f.clear() }
    if (hit != null) { if (e.ctrlKey) set.delete(hit); else if (e.shiftKey && set.has(hit)) set.delete(hit); else set.add(hit) }
    normalize(this.poly, this.sel, this.mode)
    this._selChanged()
  },

  _loopSelect(x, y, e) {
    const k = this._pickEdge(x, y, 18)
    if (k == null) return
    if (!e.shiftKey) { this.sel.clear() }
    if (this.mode === 'face') { const r = ringOf(this.poly, k); r?.faces.forEach((f) => this.sel.f.add(f)) }
    else {
      const keys = e.ctrlKey ? new Set((ringOf(this.poly, k)?.edges || []).map((q) => q.key)) : edgeLoop(this.poly, k)
      if (this.mode === 'edge') keys.forEach((q) => this.sel.e.add(q))
      else keys.forEach((q) => { this.sel.v.add(ekeyA(q)); this.sel.v.add(ekeyB(q)) })
    }
    normalize(this.poly, this.sel, this.mode)
    this._selChanged()
  },

  _selChanged() { this.numericCancel?.(); this.refresh({ geometry: false }); },

  _boxSelect(r, e) {
    const P = this.poly, S = this._screenVerts()
    const inside = (p) => p.z <= 1 && p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1
    const many = P.v.length > 2500
    const vis = (pt) => many || this._visible(pt)
    const set = this._primary()
    if (!e.shiftKey && !e.ctrlKey) { this.sel.clear() }
    const apply = (list) => { for (const k of list) { if (e.ctrlKey) set.delete(k); else set.add(k) } }
    if (this.mode === 'vertex') apply(P.v.map((_, i) => i).filter((i) => !P.hidden.has(i) && inside(S[i]) && vis(P.v[i])))
    else if (this.mode === 'edge') {
      const E = P.edges(), full = [], mid = []
      for (const [k, ed] of E) {
        if (P.hidden.has(ed.a) || P.hidden.has(ed.b)) continue
        const a = S[ed.a], b = S[ed.b]
        const m = [0, 1, 2].map((q) => (P.v[ed.a][q] + P.v[ed.b][q]) / 2)
        if (inside(a) && inside(b) && vis(m)) full.push(k)
        else if (inside({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: Math.max(a.z, b.z) }) && vis(m)) mid.push(k)
      }
      apply(full.length ? full : mid)
    } else {
      apply(P.f.map((_, i) => i).filter((i) => { if (P.faceHidden(i)) return false; const c = P.faceCenter(i); return inside(this._project(new THREE.Vector3(...c).applyMatrix4(this.visual.matrixWorld))) && vis(c) }))
    }
    normalize(P, this.sel, this.mode)
    this._selChanged()
  },
}
