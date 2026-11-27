// Edición de malla · pivote y transformaciones modales/numéricas. Mixin de `EditSession` (session.js).
import { finiteFloat32 } from '../../engine/runtime/numeric-integrity.js'
import * as THREE from 'three'
import { add as vadd, mul as vmul } from '../../engine/runtime/mesh/polymesh.js'
import { store } from '../store.js'
import { FALLOFF } from './session-shared.js'

export const xformMethods = {
  // ------------------------------------------------------------------ pivote de selección
  pivotLocal() {
    const S = this.sel, P = this.poly
    if (!S.v.size) return null
    let c = [0, 0, 0]
    for (const v of S.v) c = vadd(c, P.v[v])
    return vmul(c, 1 / S.v.size)
  },

  pivotWorld() { const p = this.pivotLocal(); return p ? new THREE.Vector3(...p).applyMatrix4(this.visual.matrixWorld) : null },

  // Las operaciones modales y numéricas necesitan la matriz actual del objeto.
  updateSelectionMatrix() { this.visual.updateWorldMatrix(true, false) },

  _restoreBase(base) { for (let i = 0; i < base.length; i++) { const p = this.poly.v[i]; p[0] = base[i][0]; p[1] = base[i][1]; p[2] = base[i][2] } },

  _liveUpdate() {
    // actualización ligera durante el arrastre: solo posiciones
    this.refresh({ geometry: true })
  },

  // ------------------------------------------------------------------ transformación numérica de la selección
  /** Coordenadas absolutas solo para un vértice; los demás modos usan un desplazamiento. */
  numericPosition() {
    if (this.mode !== 'vertex' || this.sel.v.size !== 1) return null
    const i = this.sel.v.values().next().value
    return this.poly.v[i] ? [...this.poly.v[i]] : null
  },

  numericValue(kind, axis) {
    const n = this.numericDraft
    return n?.kind === kind && n.axis === axis ? n.value : (kind === 'scale' || kind === 'uniformScale') ? 1 : 0
  },

  /** Las ediciones de arrastre de NumberField son una sola operación de historial. */
  numericTransform(kind, axis, value) {
    if (this.modal || this.paintStroke || !this.sel.v.size) return false
    if (!['position', 'move', 'rotate', 'scale', 'uniformScale'].includes(kind) || !(kind === 'uniformScale' ? axis === -1 : [0, 1, 2].includes(axis)) || !Number.isFinite(value) || (kind === 'uniformScale' && value <= 0)) return false
    const solo = this.numericPosition()
    if (kind === 'position' && !solo) return false
    if ((kind === 'rotate' || kind === 'scale' || kind === 'uniformScale') && this.sel.v.size < 2) return false
    const ids = [...this.sel.v].sort((a, b) => a - b).join(',')
    const draft = this.numericDraft
    if (draft && (draft.kind !== kind || draft.axis !== axis || draft.ids !== ids || draft.mode !== this.mode)) this.numericCancel()
    if (!this.numericDraft) {
      this.visual.updateWorldMatrix(true, false)
      this._prepXform()
      this.numericDraft = { kind, axis, ids, mode: this.mode, base: this.poly.v.map((p) => [...p]),
        pivot: this.pivotWorld(), basis: this.visual.getWorldQuaternion(new THREE.Quaternion()),
        origin: solo ? solo[axis] : 0, value: (kind === 'scale' || kind === 'uniformScale') ? 1 : kind === 'position' ? solo[axis] : 0 }
    }
    const n = this.numericDraft
    this._restoreBase(n.base)
    this.xf.base = n.base
    n.value = value
    if (kind === 'position' || kind === 'move') {
      const vector = new THREE.Vector3().setComponent(axis, kind === 'position' ? value - n.origin : value)
      // Al editar coordenadas locales, conservar las escalas del objeto al convertir el delta al mundo.
      if (kind === 'position' || store.space === 'local') {
        const M = this.visual.matrixWorld
        // Se aplica la parte lineal de la matriz, sin normalizar ni perder la escala.
        vector.applyMatrix4(M).sub(new THREE.Vector3().applyMatrix4(M))
      }
      this._xform({ t: vector }, n.pivot)
    } else if (kind === 'uniformScale') {
      this._xform({ s: new THREE.Vector3(value, value, value) }, n.pivot)
    } else if (kind === 'rotate') {
      const localAxis = new THREE.Vector3().setComponent(axis, 1)
      if (store.space === 'local') localAxis.applyQuaternion(n.basis)
      const q = new THREE.Quaternion().setFromAxisAngle(localAxis.normalize(), value * Math.PI / 180)
      this._xform({ q }, n.pivot)
    } else {
      const scale = new THREE.Vector3(1, 1, 1).setComponent(axis, value)
      const basis = store.space === 'local' ? n.basis : new THREE.Quaternion()
      this._xform({ s: scale, basis }, n.pivot)
    }
    if (this._invalidXform) { this.numericCancel(); return false }
    this._liveUpdate()
    return true
  },

  /** Confirma el último valor emitido, aunque Vue aún no haya actualizado las props de NumberField. */
  numericCommit() {
    const n = this.numericDraft
    if (!n) return false
    this.numericDraft = null
    const changed = this.poly.v.some((p, i) => p.some((v, axis) => Math.abs(v - n.base[i][axis]) > 1e-10))
    if (changed) {
      this.dirty = true
      this.commit({ position: 'Posición exacta', move: 'Mover selección', rotate: 'Rotar selección', scale: 'Escalar selección', uniformScale: 'Escalar selección uniformemente' }[n.kind])
    }
    this.refresh()
    return changed
  },

  /** Revertir un arrastre numérico interrumpido, sin crear historial. */
  numericCancel() {
    const n = this.numericDraft
    if (!n) return
    this.numericDraft = null
    this._restoreBase(n.base)
    this.refresh()
  },

  // ------------------------------------------------------------------ transformaciones (núcleo común)
  /** Pesos de la edición proporcional + simetría X; guarda en this.xf. */
  _prepXform() {
    const P = this.poly, S = this.sel
    const ids = [...S.v]
    const w = new Map(ids.map((i) => [i, 1]))
    if (store.edit.proportional) {
      const r = store.edit.propSize, fn = FALLOFF[store.edit.falloff] || FALLOFF.smooth
      const M = this.visual.matrixWorld
      const worldPts = P.v.map((p) => new THREE.Vector3(...p).applyMatrix4(M))
      const selPts = ids.map((i) => worldPts[i])
      for (let i = 0; i < P.v.length; i++) {
        if (w.has(i) || P.hidden.has(i)) continue
        let d = Infinity
        for (const sp of selPts) { const dd = sp.distanceTo(worldPts[i]); if (dd < d) d = dd }
        if (d < r) w.set(i, fn(d / r))
      }
    }
    // pares simétricos (en el espacio local)
    let mirror = null
    if (store.edit.mirrorX) {
      mirror = new Map()
      const key = (p) => `${Math.round(p[0] * 1e4)},${Math.round(p[1] * 1e4)},${Math.round(p[2] * 1e4)}`
      const idx = new Map(); P.v.forEach((p, i) => idx.set(key(p), i))
      P.v.forEach((p, i) => { if (Math.abs(p[0]) < 1e-5) return; const j = idx.get(key([-p[0], p[1], p[2]])); if (j != null && j !== i) mirror.set(i, j) })
      this._axisVerts = P.v.map((p, i) => (Math.abs(p[0]) < 1e-5 ? i : -1)).filter((i) => i >= 0)
    }
    this.xf = { w, mirror, base: P.v.map((p) => [...p]) }
  },

  /**
   * Aplica una transformación en espacio mundo a los vértices con peso.
   * t: Vector3 traslación · q: Quaternion rotación alrededor de pivot · s: Vector3 escala en ejes `basis` (Quaternion)
   */
  _xform(T, pivot) {
    const { w, mirror, base } = this.xf
    const P = this.poly
    const M = this.visual.matrixWorld
    const determinant = M.determinant?.()
    if (determinant !== undefined && (!Number.isFinite(determinant) || determinant === 0)) { this._invalidXform = true; return false }
    const Mi = M.clone().invert()
    const tmp = new THREE.Vector3(), id = new THREE.Quaternion()
    const out = new Map()
    for (const [i, wt] of w) {
      tmp.set(...base[i]).applyMatrix4(M)
      if (T.t) tmp.addScaledVector(T.t, wt)
      else if (T.q) { const q = id.clone().slerp(T.q, wt); tmp.sub(pivot).applyQuaternion(q).add(pivot) }
      else if (T.s) {
        const B = T.basis || id
        tmp.sub(pivot).applyQuaternion(B.clone().invert())
        tmp.set(tmp.x * (1 + (T.s.x - 1) * wt), tmp.y * (1 + (T.s.y - 1) * wt), tmp.z * (1 + (T.s.z - 1) * wt))
        tmp.applyQuaternion(B).add(pivot)
      }
      tmp.applyMatrix4(Mi)
      out.set(i, [tmp.x, tmp.y, tmp.z])
    }
    if ([...out.values()].some(p => !p.every(finiteFloat32))) {
      if (!this._invalidXform) console.warn(`Transformación de malla fuera de rango: ${this.objId}`)
      this._invalidXform = true
      return false
    }
    this._invalidXform = false
    for (const [i, p] of out) { P.v[i][0] = p[0]; P.v[i][1] = p[1]; P.v[i][2] = p[2] }
    if (mirror) {
      for (const [i, p] of out) {
        const j = mirror.get(i)
        if (j != null && !out.has(j)) { P.v[j][0] = -p[0]; P.v[j][1] = p[1]; P.v[j][2] = p[2] }
      }
      for (const i of this._axisVerts) if (out.has(i)) P.v[i][0] = 0
    }
  },
}
