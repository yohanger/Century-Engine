// Cuerpos dinámicos sobre el mundo de Jolt: objetos que caen, chocan, ruedan, se empujan entre sí y con el jugador, y flotan de verdad.
//
// `JoltWorld` (jolt.js) sigue siendo estático/cinemático + el personaje; todo lo dinámico vive aquí para no mezclarlo:
//  · `BodySet` crea cuerpos dinámicos (caja, esfera o cápsula ajustada al nodo), los avanza con el mundo y devuelve su pose.
//  · Flotación: la fuerza de empuje la calcula Jolt (`ApplyBuoyancyImpulse`) con el volumen realmente sumergido de la forma; aquí solo se le dice
//    dónde está la superficie (altura y pendiente de las olas), cuánto flota (densidad relativa al agua) y la corriente.
//  · El jugador empuja lo ligero, no mueve lo pesado, y su peso hunde la balsa sobre la que está parado.
// No sabe nada de nodos del editor, de agua ni de scripts: eso lo cablea `events/play-bodies.js`.
import * as THREE from 'three'
import { colliderShapeDimensions } from './collider-shape.js'

const G = 9.81
const DENSITY_WATER = 1000
const PUSH_ACCEL = 40 // N que el jugador puede empujar por cada kilo suyo (80 kg → 3200 N: mueve despacio una caja de 500 kg y sin esfuerzo una de 30)
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3()
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

/** Caja del nodo en SU marco (sin escala; en metros del mundo): { center: Vector3 local, size: Vector3 }. */
export function localBox(node, graphic = node) {
  node.updateWorldMatrix(true, true)
  node.matrixWorld.decompose(_p, _q, _s)
  const inv = new THREE.Matrix4().compose(_p, _q, new THREE.Vector3(1, 1, 1)).invert()
  const box = new THREE.Box3(), b = new THREE.Box3(), m = new THREE.Matrix4()
  graphic.traverse((o) => {
    if (!o.isMesh || !o.geometry || o.userData.helper || o.userData.pickIgnore) return
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox()
    if (o.geometry.boundingBox.isEmpty()) return
    b.copy(o.geometry.boundingBox).applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld))
    box.union(b)
  })
  if (box.isEmpty()) box.set(new THREE.Vector3(-0.25, -0.25, -0.25), new THREE.Vector3(0.25, 0.25, 0.25))
  return { center: box.getCenter(new THREE.Vector3()), size: box.getSize(new THREE.Vector3()) }
}

export class BodySet {
  constructor(world) {
    this.w = world
    this.items = new Map() // clave de BodyID → item
    this.onForces = null   // (dt) => void: se llama antes de cada paso (flotación, viento…)
    const J = world.J
    this.tmp = { v: new J.Vec3(), v2: new J.Vec3(), r: new J.RVec3(), q: new J.Quat(), n: new J.Vec3(0, 1, 0), g: new J.Vec3(0, -G, 0) }
    this._push = new Map() // BodyID → { dir, point }: contactos del jugador en este paso
    this.pushSettings = new J.CollideShapeSettings()
    this.pushSettings.mMaxSeparationDistance = 0.1
    this.collector = new J.CollideShapeCollectorJS()
    this.collector.Reset = () => {}
    this.collector.OnBody = () => {}
    this.collector.AddHit = (ptr) => {
      const r = J.wrapPointer(ptr, J.CollideShapeResult), k = r.get_mBodyID2().GetIndexAndSequenceNumber()
      if (!this.items.has(k)) return
      const ax = r.get_mPenetrationAxis(), pt = r.get_mContactPointOn2()
      this._push.set(k, { ax: [ax.GetX(), ax.GetY(), ax.GetZ()], pt: [pt.GetX(), pt.GetY(), pt.GetZ()] })
    }
    world.sys.SetGravity(this.tmp.g) // el personaje aplica su propia gravedad; esta solo cae sobre los cuerpos dinámicos
  }

  get count() { return this.items.size }

  _shape(kind, size) {
    const w = this.w, J = w.J
    if (kind === 'sphere') {
      const r = colliderShapeDimensions(size, 'sphere').radius, key = `sph|${r.toFixed(4)}`
      let s = w.shapes.get(key)
      if (!s) { const ss = new J.SphereShapeSettings(r); const res = ss.Create(); s = res.Get(); s.AddRef(); J.destroy(res); J.destroy(ss); w.shapes.set(key, s) }
      return { shape: s, volume: (4 / 3) * Math.PI * r ** 3 }
    }
    if (kind === 'capsule') {
      const { radius: r, halfHeight: h } = colliderShapeDimensions(size, 'capsule'), key = `cap|${r.toFixed(4)}|${h.toFixed(4)}`
      let s = w.shapes.get(key)
      if (!s) { const ss = new J.CapsuleShapeSettings(h, r); const res = ss.Create(); s = res.Get(); s.AddRef(); J.destroy(res); J.destroy(ss); w.shapes.set(key, s) }
      return { shape: s, volume: Math.PI * r * r * (2 * h) + (4 / 3) * Math.PI * r ** 3 }
    }
    return { shape: w._boxShape(size.x, size.y, size.z), volume: Math.max(1e-4, size.x * size.y * size.z) }
  }

  /**
   * Crea un cuerpo dinámico con la pose del mundo `pos`/`quat`, que envuelve una caja local (`center`, `size`).
   * opts: { shape 'box'|'sphere'|'capsule', mass (kg) | density (relativa al agua, 1 = como el agua), friction, bounce, linearDamping, angularDamping, sleep, vel:[x,y,z] }
   */
  add({ pos, quat, center, size }, opts = {}) {
    const w = this.w, J = w.J, t = this.tmp
    const { shape, volume } = opts.colliderShape
      ? { shape: opts.colliderShape, volume: opts.colliderVolume }
      : this._shape(opts.shape, size)
    const density = clamp(+opts.density || 0.6, 0.02, 20)
    const mass = clamp(Number.isFinite(+opts.mass) && +opts.mass > 0 ? +opts.mass : density * DENSITY_WATER * volume, 0.05, 20000)
    const c = center.clone().applyQuaternion(quat).add(pos)
    t.r.Set(c.x, c.y, c.z); t.q.Set(quat.x, quat.y, quat.z, quat.w)
    const cs = new J.BodyCreationSettings(shape, t.r, t.q, J.EMotionType_Dynamic, 1) // capa «moving»: choca con el mundo, con lo cinemático y entre sí
    cs.mOverrideMassProperties = J.EOverrideMassProperties_CalculateInertia
    cs.get_mMassPropertiesOverride().set_mMass(mass)
    cs.mFriction = clamp(opts.friction ?? 0.6, 0, 2)
    cs.mRestitution = clamp(opts.bounce ?? 0.15, 0, 1)
    cs.mLinearDamping = clamp(opts.linearDamping ?? 0.05, 0, 10)
    cs.mAngularDamping = clamp(opts.angularDamping ?? 0.2, 0, 10)
    cs.mAllowSleeping = opts.sleep !== false
    cs.mGravityFactor = opts.gravityScale ?? 1
    cs.mMotionQuality = J.EMotionQuality_LinearCast // los objetos pequeños y rápidos no atraviesan el suelo
    const body = w.bi.CreateBody(cs)
    J.destroy(cs)
    const id = body.GetID(), key = id.GetIndexAndSequenceNumber()
    w.bi.AddBody(id, J.EActivation_Activate)
    const it = { id, key, mass, volume, density, center: center.clone(), size: size.clone(), kind: opts.shape || 'box', sleepOk: opts.sleep !== false, active: true, inWater: false, displacementSupported: opts.displacementSupported !== false, node: opts.node ?? null }
    this.items.set(key, it)
    w.byBody.set(key, { body: true, node: opts.node ?? null, mesh: opts.graphic ?? null })
    if (Array.isArray(opts.vel)) this.setVelocity(it, opts.vel)
    if (Array.isArray(opts.angularVel)) this.setAngularVelocity(it, opts.angularVel)
    return it
  }

  setEnabled(it, on) {
    if (!it || it.active === on) return
    it.active = on
    if (on) this.w.bi.AddBody(it.id, this.w.J.EActivation_Activate)
    else this.w.bi.RemoveBody(it.id)
  }

  remove(it) {
    if (!this.items.delete(it.key)) return
    this.w.byBody.delete(it.key)
    if (it.active) this.w.bi.RemoveBody(it.id)
    this.w.bi.DestroyBody(it.id)
  }

  /** Pose del nodo (su origen) a partir del cuerpo: { pos, quat } en el mundo. */
  pose(it, outPos = new THREE.Vector3(), outQuat = new THREE.Quaternion()) {
    const bi = this.w.bi, p = bi.GetPosition(it.id), q = bi.GetRotation(it.id)
    outQuat.set(q.GetX(), q.GetY(), q.GetZ(), q.GetW())
    outPos.set(p.GetX(), p.GetY(), p.GetZ()).sub(_p.copy(it.center).applyQuaternion(outQuat))
    return { pos: outPos, quat: outQuat }
  }
  /** Centro de masa en el mundo. */
  centerOf(it, out = new THREE.Vector3()) { const p = this.w.bi.GetPosition(it.id); return out.set(p.GetX(), p.GetY(), p.GetZ()) }
  velocityOf(it) { const v = this.w.bi.GetLinearVelocity(it.id); return [v.GetX(), v.GetY(), v.GetZ()] }
  angularVelocityOf(it) { const v = this.w.bi.GetAngularVelocity(it.id); return [v.GetX(), v.GetY(), v.GetZ()] }
  isAwake(it) { return this.w.bi.IsActive(it.id) }
  wake(it) { this.w.bi.ActivateBody(it.id) }

  /** Coloca el cuerpo (teletransporte): `pos` es el origen del nodo. */
  teleport(it, pos, quat) {
    const t = this.tmp, c = _p.copy(it.center).applyQuaternion(quat).add(pos)
    t.r.Set(c.x, c.y, c.z); t.q.Set(quat.x, quat.y, quat.z, quat.w)
    this.w.bi.SetPositionAndRotation(it.id, t.r, t.q, this.w.J.EActivation_Activate)
    this.setVelocity(it, [0, 0, 0])
  }
  setVelocity(it, v) { this.tmp.v.Set(+v[0] || 0, +v[1] || 0, +v[2] || 0); this.w.bi.SetLinearVelocity(it.id, this.tmp.v) }
  setAngularVelocity(it, v) { this.tmp.v.Set(+v[0] || 0, +v[1] || 0, +v[2] || 0); this.w.bi.SetAngularVelocity(it.id, this.tmp.v) }
  impulse(it, v, at) {
    const t = this.tmp
    t.v.Set(+v[0] || 0, +v[1] || 0, +v[2] || 0)
    if (at) { t.r.Set(at[0], at[1], at[2]); this.w.bi.AddImpulse(it.id, t.v, t.r) } else this.w.bi.AddImpulse(it.id, t.v)
    this.w.bi.ActivateBody(it.id)
  }
  setFloating(it, on) { it.sleepOk = !on; this.w.bi.SetMotionQuality(it.id, this.w.J.EMotionQuality_LinearCast) }

  /**
   * Flotación con la superficie en (`sx, sy, sz`), de normal `n` (pendiente de la ola), corriente `flow` [x, z] (m/s) y `drag` (1/s).
   * La densidad relativa al agua decide cuánto queda sumergido: flota a la altura donde el empuje iguala el peso. Devuelve si tocó el agua.
   */
  buoy(it, sy, n, flow, drag, dt) {
    const t = this.tmp, c = this.centerOf(it, _p)
    t.r.Set(c.x, sy, c.z); t.n.Set(n[0], n[1], n[2])
    t.v.Set(flow[0], 0, flow[1])
    if (!it.sleepOk || !this.w.bi.IsActive(it.id)) this.w.bi.ActivateBody(it.id)
    it.inWater = this.w.bi.ApplyBuoyancyImpulse(it.id, t.r, t.n, 1 / it.density, drag, drag * 0.6, t.v, t.g, dt)
    return it.inWater
  }

  /** Antes del paso de Jolt. */
  beforeStep(dt) { this.onForces?.(dt) }

  /**
   * Después de mover al jugador: lo ligero se empuja, lo pesado apenas se mueve, y lo que pisa recibe su peso.
   * `vx, vz` = velocidad horizontal que quiere llevar el jugador; `world` = el JoltWorld (cápsula en `char`).
   */
  afterCharacter(dt, vx, vz, mass = 80) {
    const w = this.w, c = w.char
    if (!c || !this.items.size) return
    const J = w.J, speed = Math.hypot(vx, vz)
    // peso sobre lo que pisa (una balsa se hunde con el jugador encima)
    if (c.GetGroundState() === J.EGroundState_OnGround) {
      const k = c.GetGroundBodyID().GetIndexAndSequenceNumber(), it = this.items.get(k)
      if (it) {
        const gp = c.GetGroundPosition()
        this.tmp.v.Set(0, -mass * G * dt, 0); this.tmp.r.Set(gp.GetX(), gp.GetY(), gp.GetZ())
        w.bi.AddImpulse(it.id, this.tmp.v, this.tmp.r)
      }
    }
    if (speed < 0.2) return
    this._push.clear()
    w.sys.GetNarrowPhaseQuery().CollideShape(w.charShape, w.one, c.GetCenterOfMassTransform(), this.pushSettings, w.zero, this.collector, w.anyBp, w.objFilter, w.bodyFilter, w.shapeFilter)
    for (const [k, h] of this._push) {
      const it = this.items.get(k)
      let dx = h.ax[0], dz = h.ax[2]
      const len = Math.hypot(dx, dz)
      if (len < 1e-4) continue
      dx /= len; dz /= len
      const toward = (vx * dx + vz * dz) / speed
      if (toward < 0.2) continue // el jugador no va hacia el objeto
      const v = w.bi.GetLinearVelocity(it.id), along = v.GetX() * dx + v.GetZ() * dz
      const want = speed * toward * 0.9 // lo empuja hasta casi su velocidad
      if (along >= want) continue
      const imp = Math.min(it.mass * (want - along), mass * PUSH_ACCEL * dt) // fuerza máxima del jugador: lo muy pesado casi no se mueve
      this.tmp.v.Set(dx * imp, 0, dz * imp)
      w.bi.AddImpulse(it.id, this.tmp.v) // en el centro de masa: empuja sin hacer girar ni levantar el objeto
      w.bi.ActivateBody(it.id)
    }
  }

  dispose() {
    const w = this.w, J = w.J
    for (const it of [...this.items.values()]) this.remove(it)
    J.destroy(this.collector); J.destroy(this.pushSettings)
    for (const o of Object.values(this.tmp)) J.destroy(o)
  }
}
