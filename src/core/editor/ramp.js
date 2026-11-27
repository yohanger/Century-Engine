// Herramienta Rampa
import * as THREE from 'three'
import { DEG, clamp } from '../../engine/runtime/util.js'
import { store } from '../store.js'

export const rampMethods = {
  // ---------- herramienta Rampa ----------
  _rampFrame(hit) {
    const A = this.stroke.a, B = hit.point
    const rp = store.ramp, br = store.brush, R = br.radius
    const dist = Math.hypot(B.x - A.x, B.z - A.z)
    const lift = rp.lift || 0
    const ay = A.y + lift
    const by = (rp.mode === 'angle' ? A.y + Math.tan(clamp(rp.angle, -88, 88) * DEG) * dist : B.y) + lift
    const lo = { x: Math.min(A.x, B.x) - R, x1: Math.max(A.x, B.x) + R, z: Math.min(A.z, B.z) - R, z1: Math.max(A.z, B.z) + R }
    for (const t of this.terrains) {
      if (!t.enabled || !t._ramp) continue
      const b = t.bounds
      const touches = lo.x1 >= b.x0 && lo.x <= b.x1 && lo.z1 >= b.z0 && lo.z <= b.z1
      if (touches) t.previewRamp({ x: A.x - t.ox, z: A.z - t.oz, y: ay - t.oy }, { x: B.x - t.ox, z: B.z - t.oz, y: by - t.oy }, { halfWidth: R, hardness: br.hardness, strength: Math.min(1, br.strength * 2) })
      else t.previewRamp(null)
    }
    store.rampInfo = { len: dist, width: R * 2, dh: by - ay, angle: dist > 1e-6 ? Math.atan2(by - ay, dist) / DEG : 0 }

    this._placeRamp(A, B, R)
    this.vp.requestRender()
  },

  _endRamp() {
    for (const t of this.terrains) {
      if (!t._ramp) continue
      t.endRamp()
      const box = t.takeDirtyBox()
      if (box && t.foliage.total) t.foliage.refreshHeights(box)
    }
    if (this._rampLine) this._rampLine.visible = this._rampRect.visible = false
    store.rampInfo = null
  },

  /** Rectángulo de la rampa (ancho = 2·R) pegado al terreno, más la línea central A→B. */
  _placeRamp(A, B, R) {
    const EL = 48, ES = 12 // segmentos por lado largo / corto
    if (!this._rampLine) {
      const mat = () => new THREE.LineBasicMaterial({ color: 0xffb547, depthTest: false, transparent: true })
      const g = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 2 * EL + 2 * ES + 1 }, () => new THREE.Vector3()))
      this._rampRect = new THREE.Line(g, mat())
      const g2 = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()])
      this._rampLine = new THREE.Line(g2, mat())
      for (const o of [this._rampRect, this._rampLine]) { o.renderOrder = 999; o.frustumCulled = false; this.vp.overlay.add(o) }
    }
    const dx = B.x - A.x, dz = B.z - A.z, len = Math.hypot(dx, dz) || 1
    const nx = (-dz / len) * R, nz = (dx / len) * R
    const C = [[A.x + nx, A.z + nz], [B.x + nx, B.z + nz], [B.x - nx, B.z - nz], [A.x - nx, A.z - nz]]
    const pr = this._rampRect.geometry.attributes.position
    let k = 0
    for (let e = 0; e < 4; e++) {
      const [x0, z0] = C[e], [x1, z1] = C[(e + 1) % 4], n = e % 2 === 0 ? EL : ES
      for (let i = 0; i < n; i++) {
        const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t
        pr.setXYZ(k++, x, this.heightAt(x, z) + 0.15, z)
      }
    }
    pr.setXYZ(k, C[0][0], this.heightAt(C[0][0], C[0][1]) + 0.15, C[0][1])
    pr.needsUpdate = true
    const pos = this._rampLine.geometry.attributes.position
    pos.setXYZ(0, A.x, A.y + 0.3, A.z); pos.setXYZ(1, B.x, B.y + 0.3, B.z)
    pos.needsUpdate = true
    this._rampRect.visible = this._rampLine.visible = true
    this.ringOuter.visible = this.ringInner.visible = false
  },
}
