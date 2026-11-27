// Cuerpos dinámicos en el juego: RigidBody3D y cuerpos propios de eventos/Database. Arma `game.physics`.
//
// Los nodos físicos declarados se conectan mediante NodeBodyRuntime; el intérprete de eventos conserva su flujo.
// El nodo sigue al cuerpo en cada fotograma; el agua solo dice dónde está la superficie y hacia dónde corre, y Jolt calcula el empuje con el
// volumen que de verdad queda sumergido. Sin Jolt (respaldo) `game.water.float` usa el flotador cinemático de play-water.js.
//
//   game.physics.body('Caja', { mass: 20, shape: 'box', bounce: 0.3 })     // desde ahora cae, choca y se puede empujar
//   game.physics.body('Barril', { density: 0.6 })                          // flota (densidad < 1) o se hunde (≥ 1)
//   game.physics.impulse('Caja', [0, 6, 0])                                // golpe seco (N·s)
//   game.physics.explode(x, y, z, { radius: 6, force: 8 })                 // empuja todo lo cercano
import * as THREE from 'three'
import { addRipple } from '../geometry/waterripple.js'
import { localBox } from '../physics/bodies.js'
import { colliderBounds } from '../physics/collider-shape.js'
import { normalizeLevel } from '../world/params.js'
import { NodeBodyRuntime } from '../physics/node-bodies.js'
import { LAYER } from './play-shared.js'

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _n = new THREE.Vector3()
const SHAPES = ['box', 'sphere', 'capsule']

export const bodyMethods = {
  /** El cuerpo de un evento corresponde únicamente al gráfico de la página activa. */
  _eventPhysicsStop(inst) {
    if (!inst?.physicsBody) return
    const b = this._bodies?.find((x) => x.id === inst.id)
    if (b) this._bodyRemove(b)
    inst.physicsBody = null
  },

  _eventPhysicsResume(inst, vel = null) {
    if (!inst?.gfx || inst.held || inst.stashed || inst.physicsProfile?.type !== 'dynamic' || !this.phys) return null
    if (inst.physicsBody) return inst.physicsBody
    const p = inst.physicsProfile
    inst.physicsBody = this._bodyAdd(inst.id, { shape: p.shape, mass: p.mass,
      friction: p.friction, bounce: p.bounce, graphic: inst.gfx,
      ...(vel || inst.physicsRestoreVel ? { vel: vel || inst.physicsRestoreVel } : {}) })
    inst.physicsRestoreVel = null
    return inst.physicsBody
  },
  /** Guarda la pose actual de cada evento con física. Cada escena conserva sus propias instancias. */
  _rememberEventPhysics() {
    if (!this.game || !this.events?.length) return
    const scene = this.project.activeSceneId
    if (!scene) return
    const scenes = (this.game.state.eventPhysicsScenes ||= {})
    const stored = (scenes[scene] ||= {})
    for (const e of this.events) {
      if (!e.physicsProfile || e.held || e.stashed) continue
      const b = this._bodies?.find((x) => x.id === e.id)
      stored[e.id] = { pos: e.node.position.toArray(), quat: e.node.quaternion.toArray(),
        vel: b ? this.phys.bodies.velocityOf(b.item) : [0, 0, 0] }
    }
  },

  /** Al volver a una escena restaura la pose antes de reconstruir los cuerpos de las páginas. */
  _restoreEventPhysics() {
    const saved = this.game?.state.eventPhysicsScenes?.[this.project.activeSceneId] || {}
    for (const e of this.events || []) {
      const data = saved[e.id]
      if (!data || !Array.isArray(data.pos) || data.pos.length !== 3 || !data.pos.every(Number.isFinite)) continue
      this._eventPhysicsStop(e)
      e.node.position.fromArray(data.pos)
      if (Array.isArray(data.quat) && data.quat.length === 4 && data.quat.every(Number.isFinite)) e.node.quaternion.fromArray(data.quat)
      e.node.updateMatrixWorld(true)
      e.physicsRestoreVel = Array.isArray(data.vel) && data.vel.length === 3 && data.vel.every(Number.isFinite) ? data.vel : null
      this.phys?.syncNode(e.node)
      if (e.physicsProfile && !e.held && !e.stashed) this._eventPhysicsResume(e)
    }
  },

  /** Al montar la escena (después de `this.water` y de los colisionadores). */
  _bodiesInit() {
    this._bodies = []
    this._nodeBodies = new NodeBodyRuntime(this, LAYER)
    if (!this.phys) return
    this._nodeBodies.start()
  },
  _bodiesReset() { this._nodeBodies?.dispose(); this._nodeBodies = null; this._bodies = [] },
  _bodiesEnd() { this._nodeBodies?.dispose(); this._nodeBodies = null; this._bodies = [] },

  _bodyOpts(o, d = {}) {
    const n = (v, k, a, b, def) => (Number.isFinite(+v) && v !== '' && v != null ? clamp(+v, a, b) : d[k] ?? def)
    return {
      shape: SHAPES.includes(o.shape) ? o.shape : d.shape || 'box',
      mass: Number.isFinite(+o.mass) && +o.mass > 0 ? clamp(+o.mass, 0.05, 20000) : d.mass ?? null,
      density: n(o.density, 'density', 0.02, 20, o.float ? 0.6 : 1.5),
      friction: n(o.friction, 'friction', 0, 2, 0.6), bounce: n(o.bounce, 'bounce', 0, 1, 0.15),
      drag: n(o.drag, 'drag', 0, 10, 1.5), current: n(o.current, 'current', 0, 3, 1), tilt: n(o.tilt, 'tilt', 0, 1, 1),
    }
  },

  /** Registra un cuerpo dinámico explícito de Node3D, Event o Database. Devuelve su manejador. */
  _bodyAdd(target, opts = {}) {
    const ph = this.phys
    if (!ph) throw new Error('game.physics.body: la física (Jolt) no está disponible')
    const o = this._find(target?.id ?? target?.name ?? target)
    const node = o && this.ed.nodes.get(o.id)
    if (!o || !node) throw new Error(`game.physics.body: no existe el nodo «${target?.name ?? target}»`)
    const old = this._bodies.find((b) => b.id === o.id)
    if (old) { Object.assign(old, this._bodyOpts(opts, old)); old.item.density = old.density; if (opts.float != null) old.floats = !!opts.float; return old.handle }
    node.updateWorldMatrix(true, true)
    const wp = node.getWorldPosition(new THREE.Vector3()), wq = node.getWorldQuaternion(new THREE.Quaternion())
    // Los nuevos cuerpos usan sus recursos Shape3D; los gráficos de eventos y Database
    // mantienen su propia ruta explícita de física especializada.
    const box = opts.colliderShape
      ? { center: new THREE.Vector3(), size: new THREE.Vector3(...(opts.displacement?.size || [1, 1, 1])) }
      : colliderBounds(localBox(node, opts.graphic || node), { bodyShape: opts.shape,
        bodyOffset: opts.bodyOffset ?? o.props?.bodyOffset, bodyExtension: opts.bodyExtension ?? o.props?.bodyExtension })
    const cfg = this._bodyOpts(opts, {})
    ph.setNodeEnabled(node, false) // su colisión estática se retira: ahora la da el cuerpo
    const B = ph.dynamics()
    B.onForces ??= (dt) => this._bodiesForces(dt)
    const item = B.add({ pos: wp, quat: wq, center: box.center, size: box.size }, { ...cfg,
      colliderShape: opts.colliderShape, colliderVolume: opts.colliderVolume,
      displacementSupported: !opts.colliderShape || !!opts.displacement,
      gravityScale: opts.gravityScale, linearDamping: opts.linearDamping, angularDamping: opts.angularDamping,
      node: o.name, graphic: opts.graphic || node, vel: opts.vel, angularVel: opts.angularVel, sleep: opts.sleep ?? !opts.float })
    const b = { id: o.id, name: o.name, node, item, parent: node.parent, floats: !!opts.float, state: 'air', ...cfg, hx: clamp(box.size.x / 2, 0.1, 1.5), hz: clamp(box.size.z / 2, 0.1, 1.5), H: Math.max(0.05, box.size.y), rt: Math.random() * 0.5, wasIn: false, vyPrev: 0, age: 0 }
    this._bodies.push(b)
    const self = this
    b.handle = {
      get node() { return b.name },
      /** 'air' (cayendo) · 'floating' · 'sunk' (en el fondo) · 'ground' (apoyado). */
      get state() { return b.state },
      get floating() { return b.state === 'floating' },
      get mass() { return item.mass },
      get density() { return b.density }, set density(v) { b.density = clamp(+v || 0.6, 0.02, 20); item.density = b.density },
      get velocity() { return B.velocityOf(item) },
      get position() { return self._bodyPos(b) },
      /** Golpe seco en N·s (masa × velocidad): `[x, y, z]`. */
      push(v, at) { if (!Array.isArray(v)) throw new Error('body.push([x, y, z])'); B.impulse(item, v, Array.isArray(at) ? at : null) },
      setVelocity(v) { if (!Array.isArray(v)) throw new Error('body.setVelocity([x, y, z])'); B.setVelocity(item, v); B.wake(item) },
      teleport(x, y, z) { B.teleport(item, new THREE.Vector3(+x, +y, +z), new THREE.Quaternion()) },
      /** Deja de ser dinámico: el objeto se queda donde está y vuelve a ser sólido estático. */
      stop() { self._bodyRemove(b) },
    }
    return b.handle
  },

  _bodyPos(b) { const p = this.phys.dynamics().pose(b.item); return p.pos.toArray() },

  _bodyRemove(b) {
    this._bodies = this._bodies.filter((x) => x !== b)
    const event = this.events?.find((e) => e.id === b.id)
    if (event?.physicsBody === b.handle) event.physicsBody = null
    const ph = this.phys
    if (!ph?.bodies) return
    ph.rigidNodes.delete(b.node)
    ph.bodies.remove(b.item)
    if (b.node.parent) { ph.setNodeEnabled(b.node, true); ph.syncNode(b.node) }
  },

  /** Pose mundial de nodos sólidos estáticos; detecta Timeline, padres, altas y bajas. */
  _waterObjectSignature() {
    const objects = this.project.objects || [], byId = new Map(objects.map(o=>[o.id,o]))
    const moving = new Set((this._bodies || []).map(b=>b.id))
    const rows = []
    for (const o of objects) {
      if (!['primitive','mesh','road','text','staticbody3d','collisionshape3d'].includes(o.type)) continue
      let id=o.id, dynamic=false
      for (let i=0; id && i<64; i++) {
        if (moving.has(id) || byId.get(id)?.type === 'rigidbody3d') { dynamic=true; break }
        id=byId.get(id)?.parentId
      }
      if (dynamic) continue
      const node = this.ed.nodes.get(o.id)
      node?.updateWorldMatrix(true,false)
      rows.push([o.id, node?.matrixWorld.elements, o.visible, this._nodeEnabled?.(o) ?? o.active, o.materialId,
        o.props?.shape, o.props?.disabled, node?.userData.timelineCollision, o.type === 'road' ? o.props?.slots : null, o.mat?.runoff])
    }
    return JSON.stringify([rows,this.project.materials?.map(m=>[m.id,m.mat?.runoff])])
  },

  /** La misma pose Jolt alimenta ocupación de WaterRegion. No añade agua ni usa partículas GPU. */
  _waterDisplacementSync() {
    if (!this._waterConnection?.displacementOn || !this.phys?.bodies) return
    const B = this.phys.bodies
    const solids = []
    for (const b of this._bodies || []) {
      if (this._tlBakeOwners?.has(b.id) || solids.length >= 64) continue
      const item = b.item
      if (item.displacementSupported === false || !['box', 'sphere', 'capsule'].includes(item.kind)) continue
      const p = B.centerOf(item, _v)
      const rot = B.pose(item).quat
      solids.push({ center: [p.x, p.y, p.z], size: [item.size.x, item.size.y, item.size.z], kind: item.kind, quaternion: [rot.x, rot.y, rot.z, rot.w],
        upright: item.kind !== 'box' || Math.abs(rot.x) < 1e-3 && Math.abs(rot.y) < 1e-3 && Math.abs(rot.z) < 1e-3 })
    }
    this.water.setDisplacements(solids)
  },

  /** Antes de cada paso de Jolt: empuje del agua sobre lo que está dentro. */
  _bodiesForces(dt) {
    this._tornadoBodyForces?.(dt)
    this._destructionBodyForces?.(dt)
    const W = this.water
    if (!W || W.empty || !this._bodies?.length) return
    const B = this.phys.bodies, lv = this.level || normalizeLevel()
    for (const b of this._bodies) {
      if (this._tlBakeOwners?.has(b.id)) continue // la trayectoria horneada gobierna este cuerpo
      const c = B.centerOf(b.item, _v), s = W.at(c.x, c.z)
      if (!s) { b.item.inWater = false; continue }
      if (c.y - b.item.size.length() * 0.6 > s.surface + 0.5) { b.item.inWater = false; continue } // lejos de la superficie
      const hx = b.hx, hz = b.hz, h = (x, z) => W.at(x, z)?.surface ?? s.surface
      const dx = (h(c.x + hx, c.z) - h(c.x - hx, c.z)) / (2 * hx), dz = (h(c.x, c.z + hz) - h(c.x, c.z - hz)) / (2 * hz)
      _n.set(-dx * b.tilt, 1, -dz * b.tilt).normalize()
      const cur = b.current * lv.waterCurrent
      B.buoy(b.item, s.surface, [_n.x, _n.y, _n.z], [s.flowX * cur, s.flowZ * cur], b.drag, dt)
    }
  },

  /** Cada fotograma, tras los pasos fijos de Jolt: sincroniza cuerpos y detecta chapuzones. */
  _bodiesTick(dt) {
    const list = this._bodies
    const ph = this.phys
    if (!list?.length || !ph?.bodies) return
    const B = ph.bodies, W = this.water
    for (const b of list.slice()) {
      if (this._tlBakeOwners?.has(b.id)) continue // no sobrescribir la pose del Timeline con Jolt
      const node = b.node
      if (!node.parent || !this.ed.nodes.has(b.id) || node.parent !== b.parent) { this._bodyRemove(b); continue } // se borró o el jugador lo cogió
      const it = b.item, p = B.centerOf(it, _v)
      if (p.y < -150) { this._bodyRemove(b); node.visible = false; continue }
      const awake = B.isAwake(it)
      const vel = B.velocityOf(it), speed = Math.hypot(vel[0], vel[1], vel[2])
      // pose
      if (awake || b.first !== false) {
        b.first = false
        const pose = B.pose(it)
        const parent = node.parent
        parent.updateWorldMatrix(true, false)
        node.position.copy(parent.worldToLocal(_v.copy(pose.pos)))
        parent.getWorldQuaternion(_q2); node.quaternion.copy(_q2.invert().multiply(pose.quat))
        node.updateMatrixWorld(true)
        if (this.events?.some((e) => e.id === b.id)) ph.syncSensors(node)
        this.ed.vp.requestRender()
      }
      // estado
      b.age += dt
      const prev = b.state, inW = !!it.inWater
      const s = W && !W.empty ? W.at(p.x, p.z) : null
      if (inW && s) {
        if (!b.wasIn && b.vyPrev < -0.8) { // entra en el agua
          const power = clamp(-b.vyPrev / 6, 0.15, 1.2) * clamp(b.H + 0.3, 0.5, 1.5)
          this._waterSplash(p.x, p.z, { power, y: s.surface })
          this.game?.emit('splash', { speed: -b.vyPrev, x: p.x, y: s.surface, z: p.z, water: s.name || '', node: b.name })
        }
        b.state = b.density >= 1 ? (speed < 0.15 ? 'sunk' : 'floating') : 'floating'
        b.rt -= dt
        if (b.rt <= 0) { b.rt = 0.6; const act = Math.hypot(vel[0], vel[2]) + Math.abs(vel[1]) * 0.6; if (act > 0.12) { const power = clamp(0.12 + act * 0.4, 0.1, 0.6) * clamp(b.hx + b.hz, 0.4, 1.2); addRipple(p.x, p.z, power); W?.disturb(p.x,p.z,power,Math.max(0.5,b.hx+b.hz)) } }
      } else b.state = b.age > 0.2 && speed < 0.2 && Math.abs(vel[1]) < 0.3 ? 'ground' : 'air'
      b.wasIn = inW; b.vyPrev = vel[1]
      if (b.state !== prev) this.game?.emit('float', { node: b.name, state: b.state })
      // Fuera del paso de Jolt, el Gameplay Object puede recuperar su perfil físico original.
      this._gpRest?.(b.id, b, awake)
    }
  },

  /** game.physics: cuerpos dinámicos. */
  _physicsApi() {
    const self = this
    const need = () => { if (!self.phys) throw new Error('game.physics: la física (Jolt) no está disponible') }
    const one = (node) => { const o = self._find(node?.id ?? node?.name ?? node); return o && self._bodies?.find((b) => b.id === o.id) }
    return {
      /** Hace dinámico un nodo. opts: { shape 'box'|'sphere'|'capsule', mass (kg), density (relativa al agua), friction, bounce, drag, vel:[x,y,z] }. */
      body(node, opts = {}) {
        need()
        const target = self._find(node?.id ?? node?.name ?? node)
        if (!target || !['rigidbody3d', 'event', 'gameplayObject'].includes(target.type)) {
          throw new Error('game.physics.body: usa un RigidBody3D con CollisionShape3D; no una primitiva visual')
        }
        return self._bodyAdd(node, opts || {})
      },
      /** El cuerpo de un nodo (o null si no es dinámico). */
      get(node) { return one(node)?.handle ?? null },
      /** Quita lo dinámico a un nodo: se queda donde está. */
      release(node) { const b = one(node); if (b) self._bodyRemove(b) },
      /** Golpe seco a un nodo dinámico (N·s). */
      impulse(node, v, at) { const b = one(node); if (!b) throw new Error('game.physics.impulse: ese nodo no es dinámico (game.physics.body primero)'); b.handle.push(v, at) },
      /** Empuja todo lo dinámico cercano a (x, y, z). opts: { radius = 6, force = 8 } (m/s que gana lo que está pegado; baja con la distancia). */
      explode(x, y, z, opts = {}) {
        need()
        const r = Math.max(0.1, +opts.radius || 6), f = +opts.force || 8, B = self.phys.bodies
        let n = 0
        for (const b of self._bodies || []) {
          const c = B.centerOf(b.item, new THREE.Vector3()), d = c.distanceTo(_v.set(+x, +y, +z))
          if (d > r) continue
          const k = 1 - d / r, dir = c.sub(_v); dir.y += r * 0.15; dir.normalize()
          B.impulse(b.item, [dir.x * f * k * b.item.mass, dir.y * f * k * b.item.mass, dir.z * f * k * b.item.mass])
          n++
        }
        return n
      },
      /** Todos los cuerpos dinámicos de la escena. */
      get bodies() { return (self._bodies || []).map((b) => b.handle) },
    }
  },
}
