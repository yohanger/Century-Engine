// Agua · fase 2: salpicaduras (gotas), ondas de interacción y objetos que flotan. Además arma `game.water`.
//
// (Con Jolt, lo que flota es un cuerpo dinámico: ver play-bodies.js. Lo de este archivo es el respaldo cinemático sin Jolt, y las gotas y ondas.)
// Sobre `WaterWorld` (el agua consultable de la fase 1): aquí el agua REACCIONA. Todo es visual/cinemático (no hay cuerpos dinámicos de Jolt en
// este motor): un objeto que flota es un nodo al que se le mueve la altura con un muelle amortiguado hacia su línea de flotación, se le inclina
// según la pendiente de las olas y se le arrastra con la corriente. Los que no flotan (densidad ≥ 1) se hunden despacio hasta el fondo.
import * as THREE from 'three'
import { SplashFX } from '../world/splash.js'
import { addRipple, clearRipples } from '../geometry/waterripple.js'
import { normalizeLevel } from '../world/params.js'

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const UP = new THREE.Vector3(0, 1, 0)
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler()

export const waterFxMethods = {
  /** Al montar la escena (después de crear `this.water`). */
  _waterFxInit() {
    this._floaters = []
    this._nativeWaterContacts = new Map()
    clearRipples()
    this.splashFx ??= new SplashFX(this.ed.vp.scene)
    for (const o of this.project.objects) if (o.props?.floats && this._nodeEnabled(o)) { try { this._floatAdd(o.id, { density: o.props.floatDensity }) } catch (e) { console.warn('float', e) } }
  },
  /** Al desmontar la escena. */
  _waterFxReset() { this._floaters = []; this._nativeWaterContacts?.clear(); clearRipples() },
  /** Al salir de Jugar. */
  _waterFxEnd() { this._floaters = []; this._nativeWaterContacts?.clear(); clearRipples(); this.splashFx?.dispose(); this.splashFx = null },

  /** Luz de la escena 0..1 (la misma que oscurece el agua vista desde dentro): de noche las gotas no brillan. */
  _sceneLight() {
    const wf = this.ed.vp._wf, amb = Number(this._sceneEnv().ambient)
    return (wf?.light ?? 1) * Math.min(1, Math.max(0.3, (Number.isFinite(amb) ? amb : 0.55) / 0.55))
  },

  /**
   * Una salpicadura en (x, z). `power` 0..1,5 (0,2 gota suave · 0,6 chapuzón · 1 zambullida). Sin `y`, usa la superficie del agua en ese punto.
   * Devuelve false si ahí no hay agua. Sube una onda y lanza gotas.
   */
  _waterSplash(x, z, { power = 0.6, y, color, drops } = {}) {
    const s = this.water && !this.water.empty ? this.water.at(x, z) : null
    if (!s && y == null) return false
    const sy = y ?? s.surface
    addRipple(x, z, power)
    if (s) this.water.disturb(x, z, Math.max(0, Math.min(1.5, power)))
    this.splashFx?.burst(x, sy, z, { n: drops ?? Math.round(clamp(power * 18, 3, 40)), power, color: color || s?.color || '#9ec5e0', light: this._sceneLight() })
    this.ed.vp.requestRender()
    return true
  },

  /** Cada fotograma de simulación: gotas y objetos flotantes. */
  _waterFxTick(dt) {
    if (this._floaters?.length) for (const f of this._floaters.slice()) this._floatStep(f, Math.min(dt, 0.05))
    // CharacterBody3D utiliza el mismo JoltWorld que la locomoción: detectar
    // inmersión sin crear otro movimiento, inventario ni collider.
    const characters = this._nodeBodies?.spatial?.characters
    if (characters?.size && this.water?.regions.size && dt > 0) {
      const contacts = (this._nativeWaterContacts ||= new Map()), live = new Set()
      for (const [id, character] of characters) {
        live.add(id)
        if (!this._nodeEnabled(character.obj)) { contacts.delete(id); continue }
        const p = character.node.getWorldPosition(_v)
        const sample = this.water.at(p.x, p.z)
        const wet = !!sample && sample.surface >= p.y + 0.04
        const prev = contacts.get(id)
        const distance = prev ? Math.hypot(p.x-prev.x,p.z-prev.z) : 0
        const speed = Math.min(12, distance / dt)
        const elapsed = (prev?.elapsed ?? 1) + dt
        const pulse = wet && (!prev?.wet || (speed > 0.5 && elapsed >= 0.35))
        if (pulse) {
          const power = Math.max(0.08, Math.min(0.75, !prev?.wet ? 0.28 : speed*0.12))
          this._waterSplash(p.x,p.z,{power,y:sample.surface,drops:!prev?.wet?6:2})
          this.game?.emit('splash',{speed,x:p.x,y:sample.surface,z:p.z,water:sample.name||'',node:character.obj.name})
        }
        contacts.set(id,{x:p.x,z:p.z,wet,elapsed:pulse?0:elapsed})
      }
      for (const id of contacts.keys()) if (!live.has(id)) contacts.delete(id)
    }
    const vp = this.ed.vp
    if (this.splashFx?.update(dt, vp.camera, vp.renderer.domElement.clientHeight || 800)) vp.requestRender()
  },

  // ---------- objetos que flotan ----------
  _groundBelow(f, x, top, z) {
    try {
      const r = this._raycast([x, top, z], [0, -1, 0], 200, { ignore: [f.id] })
      return r ? r.point[1] : -Infinity
    } catch { return -Infinity }
  },

  /** Hace que un nodo flote en el agua. Con Jolt es un cuerpo dinámico de verdad (play-bodies.js); sin él, el flotador cinemático de abajo. */
  _floatAdd(target, opts = {}) {
    if (this.phys) return this._bodyAdd(target, { ...opts, float: true })
    const o = this._find(target?.id ?? target?.name ?? target)
    const node = o && this.ed.nodes.get(o.id)
    if (!o || !node) throw new Error(`game.water.float: no existe el nodo «${target?.name ?? target}»`)
    const old = this._floaters.find((f) => f.id === o.id)
    if (old) { Object.assign(old, this._floatOpts(opts, old)); return old.handle }
    node.updateWorldMatrix(true, false)
    const wp = node.getWorldPosition(new THREE.Vector3()), box = new THREE.Box3().setFromObject(node), size = box.getSize(new THREE.Vector3())
    const wq = node.getWorldQuaternion(new THREE.Quaternion())
    const yaw = _e.setFromQuaternion(wq, 'YXZ').y
    const qYaw = new THREE.Quaternion().setFromAxisAngle(UP, yaw)
    const f = {
      id: o.id, name: o.name, node, pos: wp, vel: new THREE.Vector3(), vy: 0, H: Math.max(0.05, size.y), hx: clamp(size.x / 2, 0.1, 1.5), hz: clamp(size.z / 2, 0.1, 1.5),
      offB: wp.y - box.min.y, yaw, qYaw0: qYaw, qLocal: qYaw.clone().invert().multiply(wq), qTilt: new THREE.Quaternion(), yawRate: (Math.random() - 0.5) * 0.4,
      state: 'air', gh: null, n: 0, rt: Math.random() * 0.5, ...this._floatOpts(opts, {}),
    }
    if (Array.isArray(opts.vel)) { f.vel.set(+opts.vel[0] || 0, 0, +opts.vel[2] || 0); f.vy = +opts.vel[1] || 0 } // un objeto lanzado entra con su velocidad
    this.phys?.makeKinematic?.(node) // el jugador puede subirse y el collider sigue al nodo
    this._floaters.push(f)
    const self = this
    f.handle = {
      get node() { return f.name },
      /** 'air' (cayendo) · 'floating' · 'sunk' (en el fondo) · 'ground' (en tierra). */
      get state() { return f.state },
      get floating() { return f.state === 'floating' },
      get density() { return f.density }, set density(v) { f.density = clamp(+v || 0.6, 0.05, 5) },
      get velocity() { return [f.vel.x, f.vy, f.vel.z] },
      get position() { return f.pos.toArray() },
      stop() { self._floaters = self._floaters.filter((x) => x !== f) },
    }
    return f.handle
  },
  _floatOpts(o, d) {
    const n = (v, def, a, b) => (Number.isFinite(+v) && v !== '' && v != null ? clamp(+v, a, b) : (d[def] ?? { density: 0.6, drag: 0.8, tilt: 1, current: 1, sink: 1.2 }[def]))
    return { density: n(o.density, 'density', 0.05, 5), drag: n(o.drag, 'drag', 0, 10), tilt: n(o.tilt, 'tilt', 0, 1), current: n(o.current, 'current', 0, 3), sink: n(o.sink, 'sink', 0.1, 10) }
  },

  _floatStep(f, dt) {
    const W = this.water, p = f.pos, node = f.node
    if (!node.parent || !this.ed.nodes.has(f.id)) { this._floaters = this._floaters.filter((x) => x !== f); return }
    const lv = this.level || normalizeLevel()
    const s = W && !W.empty ? W.at(p.x, p.z) : null
    if (f.gh == null || (f.n++ & 3) === 0) f.gh = this._groundBelow(f, p.x, p.y + f.H, p.z)
    let bottom = p.y - f.offB
    const inWater = !!s && bottom <= s.surface + 0.03
    const prev = f.state
    if (!inWater) {
      f.vy -= 9.8 * dt
      p.x += f.vel.x * dt; p.z += f.vel.z * dt; p.y += f.vy * dt
      bottom = p.y - f.offB
      if (bottom <= f.gh) { // aterriza en tierra
        p.y = f.gh + f.offB
        f.vy = Math.abs(f.vy) > 3 ? -f.vy * 0.25 : 0
        f.vel.multiplyScalar(Math.max(0, 1 - dt * 6))
        f.state = f.vy === 0 ? 'ground' : 'air'
      } else f.state = 'air'
    } else {
      if (prev === 'air') { // entra en el agua
        const speed = -f.vy
        if (speed > 0.8) {
          const power = clamp(speed / 6, 0.15, 1.2) * clamp(f.H + 0.3, 0.5, 1.5)
          this._waterSplash(p.x, p.z, { power, y: s.surface })
          this.game?.emit('splash', { speed, x: p.x, y: s.surface, z: p.z, water: s.name || '', node: f.name })
        }
        f.vy *= 0.3
      }
      if (f.density >= 1) f.vy = Math.max(f.vy - 4 * dt, -f.sink) // se hunde despacio
      else {
        const eq = s.surface - f.density * f.H // línea de flotación: el fondo del objeto queda a density·H bajo la superficie
        f.vy += (40 * (eq - bottom) - 5 * f.vy) * dt // muelle amortiguado (rebota un poco al caer)
      }
      const k = 1 - Math.exp(-dt * f.drag), cur = f.current * lv.waterCurrent
      f.vel.x += (s.flowX * cur - f.vel.x) * k; f.vel.z += (s.flowZ * cur - f.vel.z) * k
      p.x += f.vel.x * dt; p.z += f.vel.z * dt; p.y += f.vy * dt
      bottom = p.y - f.offB
      if (bottom <= f.gh) { p.y = f.gh + f.offB; if (f.vy < 0) f.vy = 0 } // fondo
      f.state = f.density >= 1 && bottom <= f.gh + 0.02 ? 'sunk' : 'floating'
      f.rt -= dt
      if (f.rt <= 0) { // ondas mientras se mueve o cabecea
        f.rt = 0.6
        const act = Math.hypot(f.vel.x, f.vel.z) + Math.abs(f.vy) * 0.6
        if (act > 0.12) addRipple(p.x, p.z, clamp(0.12 + act * 0.4, 0.1, 0.6) * clamp(f.hx + f.hz, 0.4, 1.2))
      }
      if (f.state === 'floating' && f.tilt > 0) { // se inclina con la pendiente de las olas
        const hx = f.hx, hz = f.hz, h = (x, z) => W.at(x, z)?.surface ?? s.surface
        const dx = (h(p.x + hx, p.z) - h(p.x - hx, p.z)) / (2 * hx), dz = (h(p.x, p.z + hz) - h(p.x, p.z - hz)) / (2 * hz)
        _v.set(-dx * f.tilt, 1, -dz * f.tilt).normalize()
        _q.setFromUnitVectors(UP, _v)
        f.qTilt.slerp(_q, 1 - Math.exp(-dt * 5))
        f.yaw += f.yawRate * dt
      }
    }
    if (f.state !== prev) this.game?.emit('float', { node: f.name, state: f.state })
    // pose en el nodo: inclinación · giro · orientación original (el padre puede no ser la escena)
    _q2.setFromAxisAngle(UP, f.yaw)
    _q.copy(f.qTilt).multiply(_q2).multiply(f.qLocal)
    const parent = node.parent
    parent.updateWorldMatrix(true, false)
    node.position.copy(parent.worldToLocal(_v.copy(p)))
    parent.getWorldQuaternion(_q2); node.quaternion.copy(_q2.invert().multiply(_q))
    node.updateMatrixWorld(true)
    this.phys?.syncNode(node, dt)
    this.ed.vp.requestRender()
  },

  /** game.water: consulta del agua, ondas, salpicaduras y objetos que flotan. */
  _waterApi() {
    const self = this
    const pt = (x, z) => { if (!Number.isFinite(+x) || !Number.isFinite(+z)) throw new Error('game.water: x y z deben ser números'); return [+x, +z] }
    return {
      /** Muestra el agua en (x, z): { surface, flowX, flowZ, depth?, name, … } o null si ahí no hay agua. */
      at(x, z) { const [a, b] = pt(x, z); return self.water && !self.water.empty ? self.water.at(a, b) : null },
      /** Altura de la superficie (con olas) en (x, z), o null. */
      height(x, z) { return this.at(x, z)?.surface ?? null },
      /** Salpicadura (gotas + onda) en (x, z). opts: { power 0..1,5, y, color, drops }. Devuelve false si ahí no hay agua (y sin `y`). */
      splash(x, z, opts = {}) { const [a, b] = pt(x, z); return self._waterSplash(a, b, opts || {}) },
      /** Solo una onda en (x, z). `amp` 0..1,5. */
      ripple(x, z, amp = 0.5) { const [a, b] = pt(x, z); const strength = +amp || 0.5; addRipple(a, b, strength); self.water?.disturb(a,b,Math.max(0,strength)) },
      /** Hace que un nodo flote: density < 1 flota (0,6 madera, 0,9 casi a ras), ≥ 1 se hunde. opts: { density, drag, tilt, current, sink }. */
      float(node, opts = {}) { return self._floatAdd(node, opts || {}) },
      /** Deja de flotar. */
      unfloat(node) {
        const o = self._find(node?.id ?? node?.name ?? node)
        if (!o) return
        self._floaters = self._floaters.filter((f) => f.id !== o.id)
        const b = self._bodies?.find((x) => x.id === o.id)
        if (b) { b.density = Math.max(b.density, 1.5); b.item.density = b.density } // sigue siendo cuerpo, pero ya no flota
      },
      /** Los objetos que flotan ahora. */
      get floaters() { return [...(self._floaters || []).map((f) => f.handle), ...(self._bodies || []).filter((b) => b.floats).map((b) => b.handle)] },
    }
  },
}
