// Jolt · sensores: cajas que no chocan con nadie y solo se consultan (triggers, zonas de evento, el trigger que el jugador lleva en la mano). Mixin de `JoltWorld` (jolt.js).
import * as THREE from 'three'

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3()

export const sensorMethods = {
  // ---------- sensores ----------
  /** Caja-sensor de `size` (x,y,z) centrada en `node`, con su orientación. Devuelve el identificador para `overlaps()`. */
  addSensor(node, size) {
    if (this.disposed) return -1
    node.updateWorldMatrix(true, false)
    node.matrixWorld.decompose(_p, _q, _s)
    const id = this._body(this._boxShape(Math.abs(size[0]), Math.abs(size[1]), Math.abs(size[2])), _p, _q, false, true)
    const key = this._key(id)
    this.sensors.push({ id, node, key })
    this.byBody.set(key, { sensor: true })
    return key
  },

  /** Identificadores de los sensores que toca ahora la cápsula del jugador. */
  overlaps() {
    this._hits.clear()
    if (!this.sensors.length) return this._hits
    const selected = this.nodeSpatial?.characters.get(this.nodeSpatial.play._nativePlayerId)
    const character = selected?.character || this.char
    const shape = selected?.shape || this.charShape
    if (!character || !shape) return this._hits
    this.sys.GetNarrowPhaseQuery().CollideShape(shape, this.one, character.GetCenterOfMassTransform(), this.collideSettings, this.zero, this.collector, this.anyBp, this.sensorFilter, this.bodyFilter, this.shapeFilter)
    return this._hits
  },

  /** Lleva SOLO los sensores colgados de `node` (o de sus descendientes) a donde está ahora: un trigger que el jugador lleva en el view model. */
  syncSensors(node) {
    node.updateMatrixWorld(true)
    for (const sn of this.sensors) {
      let under = false
      for (let v = sn.node; v; v = v.parent) if (v === node) { under = true; break }
      if (!under) continue
      sn.node.matrixWorld.decompose(_p, _q, _s)
      this.tmp.r.Set(_p.x, _p.y, _p.z); this.tmp.q.Set(_q.x, _q.y, _q.z, _q.w)
      this.bi.SetPositionAndRotation(sn.id, this.tmp.r, this.tmp.q, this.J.EActivation_DontActivate)
    }
  },

  /** ¿Hay sensores colgados de `node`? */
  hasSensors(node) {
    return this.sensors.some((sn) => { for (let v = sn.node; v; v = v.parent) if (v === node) return true; return false })
  },
}
