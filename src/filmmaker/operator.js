// Nether Film Maker · el camarógrafo virtual. Mueve la cámara del visor como lo haría la persona o la máquina que filma:
//   entradas   · sensores del móvil (orientación) + joystick en pantalla · ratón y teclado en el PC · AR (WebXR, 6 grados de libertad:
//                caminar y agacharse se detectan solos) cuando el móvil lo permite
//   persona    · a la altura de los ojos (estatura − 10 cm) sobre el suelo del nivel; el pulso de la mano se conserva en la medida
//                elegida y el resto se suaviza; con ratón/joystick se añade un vaivén de mano y de paso
//   máquina    · trípode (no se desplaza, solo gira), riel (se desliza sin cambiar de altura), grúa (sube y baja): sin temblor
// Graba claves { t, pos, rot:[pitch,yaw,roll]°, fov } en coordenadas del mundo, como las del Timeline.
import * as THREE from 'three'

const DEG = Math.PI / 180
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _ray = new THREE.Raycaster()
const ZEE = new THREE.Vector3(0, 0, 1), Q_SCREEN = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5))
const noise = (t, s) => Math.sin(t * 1.3 + s) * 0.5 + Math.sin(t * 2.9 + s * 2.1) * 0.3 + Math.sin(t * 6.1 + s * 0.7) * 0.2
const r4 = (v) => Math.round(v * 1e4) / 1e4

/** Orientación del dispositivo (grados W3C) → cuaternión de cámara de three (mirando por la pantalla trasera). */
export function deviceQuat(alpha, beta, gamma, screen = 0, out = new THREE.Quaternion()) {
  _e.set(beta * DEG, alpha * DEG, -gamma * DEG, 'YXZ')
  out.setFromEuler(_e).multiply(Q_SCREEN).multiply(_q.setFromAxisAngle(ZEE, -screen * DEG))
  return out
}
export const rotOf = (q) => { _e.setFromQuaternion(q, 'YXZ'); return [r4(_e.x / DEG), r4(_e.y / DEG), r4(_e.z / DEG)] }

export class OperatorRig {
  /** @param o { editor, operator (film.operator), input: 'mouse'|'sensors'|'ar' } */
  constructor({ editor, operator, input = 'mouse' }) {
    this.ed = editor; this.op = { ...operator }; this.input = input
    this.cam = editor.vp.persp
    this.keys = new Set(); this.move = { x: 0, y: 0 }; this.lift = 0; this.zoom = 1
    this.yaw = 0; this.pitch = 0; this.roll = 0
    this.pos = new THREE.Vector3(); this.smoothPos = new THREE.Vector3(); this.smoothQ = new THREE.Quaternion()
    this.rawQ = new THREE.Quaternion(); this.devRef = null; this.t = 0; this.walk = 0
    this.recording = false; this.recKeys = []; this._lastKey = -1; this.travelSpeed = 0; this.railProgress = 0; this.lastMx = 0; this.lastMy = 0
  }
  get person() { return this.op.kind === 'person' }
  get eye() { return Math.max(0.3, this.op.height - 0.1) }
  /** Suelo bajo (x, z): el más alto por debajo de `fromY` entre terreno y objetos con malla. */
  ground(x, z, fromY = 1e4) {
    let g = this.ed.groundAt(x, z)
    if (Number.isNaN(g)) g = -Infinity
    _ray.set(_v.set(x, fromY, z), new THREE.Vector3(0, -1, 0)); _ray.far = 1e4
    const hits = _ray.intersectObject(this.ed.objectsGroup, true).filter((h) => h.object.isMesh && h.object.visible && !h.object.userData?.helper)
    if (hits.length) g = Math.max(g, hits[0].point.y)
    return Number.isFinite(g) ? g : 0
  }
  /** Empieza donde está ahora la cámara del visor (la persona, de pie sobre el suelo). */
  begin() {
    this.ed.vp.controls.enabled = false
    this.pos.copy(this.cam.position)
    _e.setFromQuaternion(this.cam.quaternion, 'YXZ'); this.yaw = _e.y; this.pitch = _e.x; this.roll = 0
    if (this.person && this.input !== 'ar' && this.input !== 'remote') this.pos.y = this.ground(this.pos.x, this.pos.z, this.pos.y + 0.5) + this.eye
    this.baseFov = this.cam.fov
    this.startPos = this.pos.clone(); this.smoothPos.copy(this.pos)
    this.travelSpeed = 0; this.railProgress = 0; this.lastMx = 0; this.lastMy = 0
    if (!this.person && this.op.rig === 'dolly' && this.op.dolly?.points?.length >= 2) {
      this.rail = new THREE.CatmullRomCurve3(this.op.dolly.points.map(p => new THREE.Vector3(...p)), false, 'centripetal')
      this.railLength = Math.max(0.001, this.rail.getLength())
      // Elegir el punto más cercano al encuadre de inicio, sin saltar a una posición arbitraria.
      let best = Infinity
      for (let i = 0; i <= 100; i++) { const t = i / 100, d = this.rail.getPointAt(t).distanceToSquared(this.pos); if (d < best) { best = d; this.railProgress = t } }
      this.pos.copy(this.rail.getPointAt(this.railProgress)); this.smoothPos.copy(this.pos)
    }
    if (!this.person && this.op.rig === 'crane') {
      this.craneYaw = (this.op.crane?.yaw || 0) * DEG
      this.craneElev = (this.op.crane?.elevation || 0) * DEG
      this.craneLen = this.op.crane?.arm || 3
      this.cranePivot = this.op.crane?.pivot ? new THREE.Vector3(...this.op.crane.pivot) : this.pos.clone().sub(new THREE.Vector3(
        Math.sin(this.craneYaw) * Math.cos(this.craneElev) * this.craneLen,
        Math.sin(this.craneElev) * this.craneLen,
        -Math.cos(this.craneYaw) * Math.cos(this.craneElev) * this.craneLen))
    }
    this.smoothQ.setFromEuler(_e.set(this.pitch, this.yaw, 0, 'YXZ')); this.rawQ.copy(this.smoothQ)
    this.startYaw = this.yaw; this.devRef = null; this.arRef = null; this.remoteRef = null; this._remote = null
    this.apply(); return this
  }
  end() { this.ed.vp.controls.enabled = true; this.stopSensors() }

  // ---------- entradas ----------
  look(dx, dy) {
    const sensitivity = this.op.sensitivity ?? 1
    const limit = (this.op.tiltLimit ?? 83) * DEG
    const limitTurn = (this.op.turnSpeed || 180) * DEG * Math.max(1 / 120, this.lastDt || 1 / 60)
    this.yaw -= Math.max(-limitTurn, Math.min(limitTurn, dx * 0.0035 * sensitivity))
    if (!this.person && this.op.rig === 'tripod') {
      const pan = (this.op.panLimit ?? 180) * DEG
      this.yaw = Math.max(this.startYaw - pan, Math.min(this.startYaw + pan, this.yaw))
    }
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch - Math.max(-limitTurn, Math.min(limitTurn, dy * 0.0035 * sensitivity))))
  }
  wheel(d) { this.zoom = Math.max(1, Math.min(6, this.zoom * (d > 0 ? 0.92 : 1.08))) }
  /** Misma preferencia de trackpad del editor; una pasada nunca crea otro controlador de cámara. */
  trackpad(dx, dy, { pinch = false, pan = false } = {}, prefs = {}) {
    if (this.input !== 'mouse') return
    if (pinch) {
      this.zoom = Math.max(1, Math.min(6, this.zoom * Math.exp(-dy * 0.012 * (prefs.padZoom ?? 1))))
      return
    }
    const sx = prefs.padInvert ? 1 : -1
    const sy = sx * (prefs.padInvertY ? -1 : 1)
    if (pan) {
      if (!this.person) return
      const x = dx * sx * (prefs.padPan ?? 1) * 0.004
      const y = dy * sy * (prefs.padPan ?? 1) * 0.004
      this.pos.x -= Math.cos(this.yaw) * x - Math.sin(this.yaw) * y
      this.pos.z += Math.sin(this.yaw) * x + Math.cos(this.yaw) * y
    } else this.look(dx * sx * (prefs.padOrbit ?? 1), dy * sy * (prefs.padOrbit ?? 1))
  }
  startSensors() {
    this._onOri = (e) => { if (e.alpha == null) return; this._dev = { a: e.alpha, b: e.beta, g: e.gamma } }
    window.addEventListener('deviceorientation', this._onOri)
  }
  stopSensors() { if (this._onOri) window.removeEventListener('deviceorientation', this._onOri); this._onOri = null }
  /** AR (WebXR immersive-ar con dom-overlay): posición y orientación reales del móvil. `overlay` = elemento que sigue visible. */
  async startAR(overlay) {
    if (!navigator.xr || !(await navigator.xr.isSessionSupported?.('immersive-ar'))) throw new Error('Este dispositivo no admite AR (ARCore / WebXR)')
    const s = await navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['local-floor'], optionalFeatures: ['dom-overlay'], domOverlay: { root: overlay } })
    const gl = this.ed.vp.renderer.getContext()
    await gl.makeXRCompatible?.()
    s.updateRenderState({ baseLayer: new XRWebGLLayer(s, gl, { alpha: true }) }) // capa vacía: lo que se ve es nuestro lienzo en el overlay
    this.xrRef = await s.requestReferenceSpace('local-floor')
    this.xr = s
    const loop = (now, frame) => {
      if (!this.xr) return
      const pose = frame.getViewerPose(this.xrRef)
      if (pose) { const p = pose.transform.position, o = pose.transform.orientation; this._ar = { p: [p.x, p.y, p.z], q: [o.x, o.y, o.z, o.w] } }
      this.onXRFrame?.(now)
      this.ed.vp.step(now) // durante la sesión inmersiva el navegador para el requestAnimationFrame normal
      s.requestAnimationFrame(loop)
    }
    s.addEventListener('end', () => { this.xr = null })
    s.requestAnimationFrame(loop)
  }
  async stopAR() { const s = this.xr; this.xr = null; try { await s?.end() } catch { /* ya terminada */ } }

  /** Cuaternión Android [x,y,z,w]. Entrada física de orientación, nunca posición inventada. */
  setRemoteOrientation(values) {
    if (!Array.isArray(values) || values.length !== 4 || values.some((v) => typeof v !== 'number' || !Number.isFinite(v))) return false
    const length = Math.hypot(...values)
    if (length < 0.9 || length > 1.1) return false
    // Android: mundo ENU (Z arriba). Three.js: Y arriba; la cámara trasera mira -Z.
    const mapped = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)
      .multiply(new THREE.Quaternion(...values).normalize())
    if (!this.remoteRef) this.remoteRef = { input: mapped.clone(), start: this.smoothQ.clone() }
    this._remote = this.remoteRef.start.clone().multiply(this.remoteRef.input.clone().invert()).multiply(mapped).normalize()
    return true
  }
  clearRemoteOrientation() { this._remote = null; this.remoteRef = null }

  // ---------- simulación ----------
  update(dt) {
    dt = Math.min(0.1, Math.max(0, dt)); this.t += dt; this.lastDt = dt
    const op = this.op, machine = !this.person, rig = op.rig
    // 1) orientación «cruda»
    if (this.input === 'remote' && this._remote) {
      this.rawQ.copy(this._remote)
    } else if (this.input === 'ar' && this._ar) {
      const q = new THREE.Quaternion(...this._ar.q)
      if (!this.arRef) { _e.setFromQuaternion(q, 'YXZ'); this.arRef = { p: new THREE.Vector3(...this._ar.p), yaw: _e.y, start: this.startPos.clone(), floor: this.ground(this.startPos.x, this.startPos.z, this.startPos.y + 0.5) } }
      const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.startYaw - this.arRef.yaw)
      this.rawQ.copy(turn).multiply(q)
      const d = new THREE.Vector3(...this._ar.p).sub(this.arRef.p).applyQuaternion(turn)
      this.pos.set(this.arRef.start.x + d.x, this.arRef.floor + this._ar.p[1], this.arRef.start.z + d.z) // altura real del móvil sobre el suelo
    } else if (this.input === 'sensors' && this._dev) {
      const q = deviceQuat(this._dev.a, this._dev.b, this._dev.g, screen.orientation?.angle || window.orientation || 0, new THREE.Quaternion())
      if (!this.devRef) { _e.setFromQuaternion(q, 'YXZ'); this.devRef = _e.y }
      this.rawQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.startYaw - this.devRef).multiply(q)
    } else {
      this.rawQ.setFromEuler(_e.set(this.pitch, this.yaw, 0, 'YXZ'))
    }
    // 2) Movimiento con velocidad en m/s y aceleración estable por dt. Un rig mecánico no atraviesa su restricción.
    if (this.input !== 'ar' && this.input !== 'remote') {
      const keys = this.keys, mx = this.move.x + (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0)
      const my = this.move.y + (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0)
      const up = (keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0) + this.lift
      _e.setFromQuaternion(this.rawQ, 'YXZ')
      const magnitude = Math.hypot(mx, my), strength = Math.min(1, magnitude)
      const target = strength * (keys.has('ShiftLeft') ? Math.max(op.speed, op.sprint) : op.speed)
      const rate = (target > this.travelSpeed ? op.acceleration : op.deceleration) * dt
      this.travelSpeed += Math.max(-rate, Math.min(rate, target - this.travelSpeed))
      const step = this.travelSpeed * dt
      if (strength > 0.001) { this.lastMx = mx / magnitude; this.lastMy = my / magnitude }
      if (this.person) {
        const forward = new THREE.Vector3(-Math.sin(_e.y), 0, -Math.cos(_e.y))
        const right = new THREE.Vector3(Math.cos(_e.y), 0, -Math.sin(_e.y))
        if (step > 0) this.pos.addScaledVector(forward, this.lastMy * step).addScaledVector(right, this.lastMx * step)
        if (strength > 0.05) this.walk += dt * 1.9 * strength
        const crouch = Math.max(0, Math.min(this.eye - 0.5, -this.lift * (this.eye - 0.5)))
        this.pos.y = this.ground(this.pos.x, this.pos.z, this.pos.y + 0.6) + this.eye - crouch
      } else if (rig === 'dolly' && this.rail) {
        this.railProgress = Math.max(0, Math.min(1, this.railProgress + Math.sign(this.lastMy) * step / this.railLength))
        this.pos.copy(this.rail.getPointAt(this.railProgress))
      } else if (rig === 'crane') {
        const degreesPerSecond = (op.turnSpeed || 180) * DEG
        this.craneYaw += mx * degreesPerSecond * dt * 0.3
        this.craneElev = Math.max(-80 * DEG, Math.min(80 * DEG, this.craneElev + my * degreesPerSecond * dt * 0.3))
        this.craneLen = Math.max(0.5, Math.min(25, this.craneLen + up * op.speed * dt))
        this.pos.set(
          this.cranePivot.x + Math.sin(this.craneYaw) * Math.cos(this.craneElev) * this.craneLen,
          this.cranePivot.y + Math.sin(this.craneElev) * this.craneLen,
          this.cranePivot.z - Math.cos(this.craneYaw) * Math.cos(this.craneElev) * this.craneLen)
      }
      // Trípode: el origen permanece fijo durante toda la pasada; solo pan/tilt desde look().
    }
    // 3) filtros según quién filma
    const smooth = op.smooth
    const k = 1 - Math.exp(-dt * (32 - 30 * smooth)) // suavizado exponencial (más suave = más lento)
    this.smoothQ.slerp(this.rawQ, k); this.smoothPos.lerp(this.pos, k)
    const q = machine ? this.smoothQ.clone() : this.smoothQ.clone().slerp(this.rawQ, op.handheld * (1 - (op.stabilization || 0))) // el pulso que se conserva
    const p = this.smoothPos.clone()
    if (this.person && this.input !== 'ar' && this.input !== 'sensors') {
      // con ratón/joystick no hay pulso real: vaivén de la mano y del paso, proporcional a «pulso de la mano»
      const a = op.handheld * (1 - (op.stabilization || 0)), t = this.t
      _e.set(noise(t, 1) * 0.6 * a * DEG, noise(t, 2) * 0.5 * a * DEG, noise(t, 3) * 0.4 * a * DEG, 'YXZ')
      q.multiply(_q.setFromEuler(_e))
      p.y += Math.sin(this.walk * Math.PI * 2) * 0.025 * a
    }
    this.out = { pos: p, q, fov: 2 * Math.atan(Math.tan((this.baseFov * DEG) / 2) / this.zoom) / DEG }
    this.apply()
  }
  apply() {
    const o = this.out || { pos: this.pos, q: this.smoothQ, fov: this.baseFov || this.cam.fov }
    this.cam.position.copy(o.pos); this.cam.quaternion.copy(o.q)
    if (Math.abs(this.cam.fov - o.fov) > 1e-3) { this.cam.fov = o.fov; this.cam.updateProjectionMatrix() }
    this.ed.vp.requestRender()
  }
  /** Guarda una clave (≈30 por segundo) en el tiempo `t` de la toma. */
  sample(t) {
    if (!this.recording || !this.out || t - this._lastKey < 1 / 30 - 1e-6) return
    this._lastKey = t
    this.recKeys.push({ t: r4(t), pos: this.out.pos.toArray().map(r4), rot: rotOf(this.out.q), fov: r4(this.out.fov) })
  }
}
