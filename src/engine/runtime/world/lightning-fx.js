// El rayo visible: cintas aditivas (halo azul + núcleo blanco azulado) siguiendo el canal que simula world/lightning.js. Se construye cuando
// `frame().strike` trae un rayo nuevo y brilla según `frame().boltAlpha` (la corriente de Heidler: parpadea con cada golpe). Lo tapa el
// terreno y los objetos (prueba de profundidad); lejos se ensancha para verse con el mismo ángulo que se vería en la realidad.
import * as THREE from 'three'
import { createStrike, LIGHTNING_DEFAULTS } from './lightning.js'

function mulberry32(a) { return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

export class LightningFX {
  /** `ground`: (x, z) → altura del suelo o NaN (la misma que usa la lluvia para las salpicaduras). Se puede poner después. */
  constructor(scene, ground = null) {
    this.ground = ground; this.scene = scene; this.lastId = 0; this.bolt = null
    this.mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false })
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.mat)
    this.mesh.frustumCulled = false; this.mesh.visible = false; this.mesh.renderOrder = 6
    scene.add(this.mesh)
  }

  /**
   * Construye el canal de `s` (= frame.strike) respecto a la cámara. El centro de la nube queda a `s.distance` m en el rumbo `s.bearing`
   * (0 = norte −Z, 90 = este +X), a la altura de las nubes del tiempo actual.
   */
  build(s, cam) {
    const b = (s.bearing * Math.PI) / 180, d = s.distance
    const cx = cam.position.x + Math.sin(b) * d, cz = cam.position.z - Math.cos(b) * d
    const thick = Math.min(1500, Math.max(300, (s.thickness || 1500) * 0.5))
    const cloud = s.cloud ? [...s.cloud] : [cx, (s.altitude || 1200) + thick * 0.35, cz] // con nubes por celdas el centro es el de la nube elegida (coordenadas del mundo)
    const rng = mulberry32(s.seed)
    const bolt = s.bolt || createStrike({ ...LIGHTNING_DEFAULTS, peakKA: s.peak }, rng, { cloud, cloudRadius: s.cloudRadius || 240, thickness: thick, development: s.type ?? 0.5, groundAt: this.ground })
    bolt.peak = s.peak
    this._mesh(bolt, cam, rng, d, !!s.bolt)
    this.bolt = bolt
  }

  _mesh(bolt, cam, rng, dist, worldSpace = false) {
    // el canal con tortuosidad extra (4 subdivisiones por segmento con desplazamiento lateral): el modelo da el árbol, esto le da el zigzag fino
    const P = bolt.points, par = bolt.parents, cp = cam.position
    const far = (cam.far || 2000) * 0.9
    let maxD = 1; for (const p of P) maxD = Math.max(maxD, Math.hypot(p[0] - cp.x, p[1] - cp.y, p[2] - cp.z))
    const sc = worldSpace ? 1 : Math.min(1, far / maxD) // si no cabe en el plano lejano, se acerca todo a la cámara conservando los ángulos
    const widen = (1 + dist / 150) * sc, pos = [], col = [], idx = []
    const halo = [0.35, 0.58, 1], core = [0.82, 0.93, 1]
    const ribbon = (a, b, axis, w, c, alpha) => {
      const o = [axis[0] * w, axis[1] * w, axis[2] * w], i = pos.length / 3
      pos.push(a[0] - o[0], a[1] - o[1], a[2] - o[2], a[0] + o[0], a[1] + o[1], a[2] + o[2], b[0] - o[0], b[1] - o[1], b[2] - o[2], b[0] + o[0], b[1] + o[1], b[2] + o[2])
      for (let k = 0; k < 4; k++) col.push(c[0] * alpha, c[1] * alpha, c[2] * alpha, 1)
      idx.push(i, i + 2, i + 1, i + 1, i + 2, i + 3)
    }
    const S = (p) => [cp.x + (p[0] - cp.x) * sc, cp.y + (p[1] - cp.y) * sc, cp.z + (p[2] - cp.z) * sc]
    for (let i = 1; i < P.length; i++) {
      if (par[i] < 0) continue
      const A = P[par[i]], B = P[i]
      const dx = B[0] - A[0], dy = B[1] - A[1], dz = B[2] - A[2], len = Math.hypot(dx, dy, dz)
      if (len < 1e-3) continue
      const dir = [dx / len, dy / len, dz / len]
      let a1 = [dir[1] * 0 - dir[2] * 1, dir[2] * 0 - dir[0] * 0, dir[0] * 1 - dir[1] * 0] // dir × up
      let l1 = Math.hypot(...a1); if (l1 < 1e-3) { a1 = [0, dir[2], -dir[1]]; l1 = Math.hypot(...a1) || 1 }
      a1 = a1.map((x) => x / l1)
      const a2 = [dir[1] * a1[2] - dir[2] * a1[1], dir[2] * a1[0] - dir[0] * a1[2], dir[0] * a1[1] - dir[1] * a1[0]]
      const vis = Math.sqrt(Math.min(1, Math.max(0, Math.exp(-bolt.dist[i] / 2000))))
      const hw = (0.7 + 1.15 * vis) * widen, cw = (0.16 + 0.36 * vis) * widen
      // 4 sub-segmentos con desplazamiento lateral (extremos fijos: el canal sigue conectado)
      let prev = A
      for (let k = 1; k <= 4; k++) {
        const t = k / 4, j = k < 4 ? len * 0.07 * (rng() * 2 - 1) : 0, j2 = k < 4 ? len * 0.07 * (rng() * 2 - 1) : 0
        const cur = [A[0] + dx * t + a1[0] * j + a2[0] * j2, A[1] + dy * t + a1[1] * j + a2[1] * j2, A[2] + dz * t + a1[2] * j + a2[2] * j2]
        const sa = S(prev), sb = S(cur)
        ribbon(sa, sb, a1, hw, halo, 0.08 + 0.16 * vis); ribbon(sa, sb, a2, hw, halo, 0.08 + 0.16 * vis)
        ribbon(sa, sb, a1, cw, core, 0.58 + 0.42 * vis); ribbon(sa, sb, a2, cw, core, 0.58 + 0.42 * vis)
        prev = cur
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx)
    this.mesh.geometry.dispose(); this.mesh.geometry = g
  }

  /** Cada fotograma: `f` = World.frame() (o null). Devuelve true mientras el rayo se ve (el visor sigue dibujando). */
  update(f, cam) {
    const s = f?.strike
    if (!s) { this.mesh.visible = false; return false }
    if (s.id !== this.lastId) { this.lastId = s.id; this.build(s, cam) }
    const a = f.boltAlpha || 0
    this.mesh.visible = a > 0.002 && !!this.bolt
    if (this.mesh.visible) { this.mat.opacity = 1; this.mat.color.setScalar(2.2 * Math.min(1, a)) }
    return this.mesh.visible
  }

  reset() { this.lastId = 0; this.bolt = null; this.mesh.visible = false }
  dispose() { this.mesh.parent?.remove(this.mesh); this.mesh.geometry.dispose(); this.mat.dispose() }
}
