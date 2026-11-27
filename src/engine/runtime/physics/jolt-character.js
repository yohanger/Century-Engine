// Jolt · el personaje: cápsula `CharacterVirtual` con escalones, pendiente máxima, pegado al suelo y plataformas móviles. Mixin de `JoltWorld` (jolt.js).
/** Construye una cápsula para una transición temporal del mismo CharacterVirtual.
 * La referencia devuelta pertenece al dueño y se libera con Shape.Release(). */
export function createVirtualCharacterShape(world, { radius, height }) {
  if (!Number.isFinite(radius) || radius < 0.01 || !Number.isFinite(height) || height < radius * 2)
    throw new RangeError('CharacterBody3D: radio/altura de cápsula inválidos')
  const J = world.J
  const half = Math.max(0.01,(height-radius*2)/2)
  const cap = new J.CapsuleShapeSettings(half,radius)
  const center = new J.Vec3(0,height/2,0)
  const wrapper = new J.RotatedTranslatedShapeSettings(center,J.Quat.prototype.sIdentity(),cap)
  let result
  try {
    result = wrapper.Create()
    if (!result?.IsValid()) throw new Error('CharacterBody3D: Jolt rechazó la cápsula')
    const shape = result.Get()
    shape.AddRef()
    result.Clear?.()
    return shape
  } finally {
    if (result) J.destroy(result)
    J.destroy(wrapper) // libera sus Settings hijos
    J.destroy(center)
  }
}

/** Crea otra instancia CharacterVirtual en el mundo existente. El FPS conserva su instancia independiente. */
export function createVirtualCharacter(world, { position, radius, height, mass = 80, slope = 50 }) {
  const J = world.J
  const cap = new J.CapsuleShapeSettings(Math.max(0.01, (height - 2 * radius) / 2), radius)
  const shift = new J.RotatedTranslatedShapeSettings(new J.Vec3(0, height / 2, 0), J.Quat.prototype.sIdentity(), cap)
  const result = shift.Create()
  if (!result.IsValid()) { J.destroy(result); throw new Error('Jolt rechazó la cápsula de CharacterBody3D') }
  const shape = result.Get()
  shape.AddRef()
  const settings = new J.CharacterVirtualSettings()
  settings.mMass = mass
  settings.mMaxSlopeAngle = slope * Math.PI / 180
  settings.mShape = shape
  settings.mBackFaceMode = J.EBackFaceMode_CollideWithBackFaces
  settings.mCharacterPadding = 0.02
  settings.mPenetrationRecoverySpeed = 1
  settings.mPredictiveContactDistance = 0.1
  settings.mSupportingVolume = new J.Plane(J.Vec3.prototype.sAxisY(), -radius)
  world.tmp.r.Set(position.x, position.y, position.z)
  let character
  try { character = new J.CharacterVirtual(settings, world.tmp.r, J.Quat.prototype.sIdentity(), world.sys) }
  catch (error) { shape.Release(); throw error }
  finally { J.destroy(result) }
  // Como el personaje FPS, estos Settings son referenciados por Jolt; no destruir prematuramente.
  return { character, shape }
}

export const characterMethods = {
  // ---------- jugador ----------
  createCharacter(x, y, z) {
    const instance = createVirtualCharacter(this, {
      position: { x, y, z }, radius: this.radius, height: this.height,
      mass: 80, slope: this.maxSlope,
    })
    this.char = instance.character
    this.charShape = instance.shape
    this.charPos.set(x, y, z)
  },

  /** Cambia el tamaño del cuerpo en marcha (agacharse, encogerse…): la cápsula se rehace en la misma posición. */
  setBody({ height = this.height, radius = this.radius, stepUp = this.stepUp } = {}) {
    const same = height === this.height && radius === this.radius && stepUp === this.stepUp
    this.height = height; this.radius = radius; this.stepUp = stepUp
    if (same || !this.char) return
    const p = this.charPos.clone()
    this.J.destroy(this.char); this.charShape?.Release()
    this.char = null; this.charShape = null
    this.createCharacter(p.x, p.y, p.z)
  },

  /** Coloca al personaje (teletransporte) sin tocar su velocidad. */
  place(x, y, z) {
    this.tmp.r.Set(x, y, z)
    this.char.SetPosition(this.tmp.r)
    this.charPos.set(x, y, z)
  },

  /** Pendiente máxima caminable (grados): por encima el suelo es «empinado» (inestable) y el personaje resbala. */
  setSlope(deg) {
    this.maxSlope = deg
    this.char?.SetMaxSlopeAngle((deg * Math.PI) / 180)
  },

  /** Estado del suelo según el último paso: 'stable' (se puede andar), 'steep' (demasiado empinado) o 'air'. */
  groundKind() {
    const c = this.char; if (!c) return 'air'
    const s = c.GetGroundState(), J = this.J
    return s === J.EGroundState_OnGround ? 'stable' : s === J.EGroundState_OnSteepGround ? 'steep' : 'air'
  },

  /**
   * Un paso del personaje. `vx, vz`: velocidad horizontal deseada (m/s) RELATIVA al suelo; `vy`: velocidad vertical (relativa al suelo
   * si está en suelo estable —0 = pegado—, absoluta en el aire); `gravity`: la que usa Jolt para pegarse al suelo y bajar escalones.
   * Sobre suelo estable le suma la velocidad del suelo (plataformas móviles). Devuelve
   * { x, y, z, vy, ground, add: [x, z] (velocidad de suelo sumada), gv: [x, y, z] (velocidad del suelo tras el paso), normal: [x, y, z] }.
   */
  moveCharacter(dt, vx, vz, vy, gravity) {
    const J = this.J, c = this.char, t = this.tmp
    const onGround = c.GetGroundState() === J.EGroundState_OnGround
    const g0 = onGround ? c.GetGroundVelocity() : null
    const ax = g0 ? g0.GetX() : 0, ay = g0 ? g0.GetY() : 0, az = g0 ? g0.GetZ() : 0
    t.v.Set(ax + vx, ay + vy, az + vz)
    c.SetLinearVelocity(t.v)
    t.v2.Set(0, -gravity, 0)
    this.update.mWalkStairsStepUp.Set(0, this.stepUp, 0)
    this.update.mStickToFloorStepDown.Set(0, -0.5, 0) // restaurar ajustes del FPS tras actualizar otro CharacterBody3D
    c.ExtendedUpdate(dt, t.v2, this.update, this.bpFilter, this.objFilter, this.bodyFilter, this.shapeFilter, this.jolt.GetTempAllocator())
    this.bodies?.afterCharacter(dt, vx, vz)
    const p = c.GetPosition(), ground = this.groundKind()
    this.charPos.set(p.GetX(), p.GetY(), p.GetZ())
    const g1 = ground === 'stable' ? c.GetGroundVelocity() : null, n = ground === 'air' ? null : c.GetGroundNormal()
    return {
      x: p.GetX(), y: p.GetY(), z: p.GetZ(), vy: c.GetLinearVelocity().GetY(), ground,
      add: [ax, az], gv: g1 ? [g1.GetX(), g1.GetY(), g1.GetZ()] : [0, 0, 0], normal: n ? [n.GetX(), n.GetY(), n.GetZ()] : [0, 1, 0],
    }
  },
}
