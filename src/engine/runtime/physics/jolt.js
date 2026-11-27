// Física del juego con Jolt (JoltPhysics.js, WASM local separado del código JavaScript).
//
// Es el «backend» del modo Jugar y del juego exportado (AppImage). Solo mueve el juego (la exportación a otros motores no pasa por aquí).
//
//  · Los nodos StaticBody3D y RigidBody3D definen los cuerpos de escena.
//  · Los gráficos físicos de eventos y Gameplay Objects siguen siendo subsistemas especializados.
//  · El jugador es un CharacterVirtual (cápsula) con escalones, pendiente máxima y pegado al suelo.
//  · Las colisiones especiales de eventos/Database, cuando utilizan mallas, son MeshShape
//    con la escala del mundo ya aplicada; las formas se comparten entre instancias iguales.
//  · El terreno de cada pieza es un MeshShape construido de su mapa de alturas.
import * as THREE from 'three'
import { BodySet } from './bodies.js'
import { characterMethods } from './jolt-character.js'
import { sensorMethods } from './jolt-sensors.js'

const LAYER_STATIC = 0, LAYER_MOVING = 1, LAYER_SENSOR = 2, N_LAYERS = 3 // los sensores (triggers, zonas de evento) viven en su capa: no chocan con nadie, solo se consultan

let joltPromise = null

async function initJolt() {
  const { default: createJolt } = await import('jolt-physics/wasm')
  if (!import.meta.env) return createJolt() // Node carga el WASM junto al módulo de Jolt.
  const { default: wasmUrl } = await import('jolt-physics/jolt-physics.wasm.wasm?url')
  return createJolt({ locateFile: () => wasmUrl })
}

/** Carga (una sola vez) el módulo WASM. Se importa de forma diferida para no engordar el arranque del editor. */
export function loadJolt() {
  if (!joltPromise) joltPromise = initJolt().catch((e) => { joltPromise = null; throw e })
  return joltPromise
}

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3()

export class JoltWorld {
  constructor(Jolt, { radius = 0.32, height = 1.8, stepUp = 0.55, maxSlope = 50 } = {}) {
    this.J = Jolt
    this.radius = radius; this.height = height; this.stepUp = stepUp; this.maxSlope = maxSlope
    const settings = new Jolt.JoltSettings()
    const pairs = new Jolt.ObjectLayerPairFilterTable(N_LAYERS)
    pairs.EnableCollision(LAYER_STATIC, LAYER_MOVING)
    pairs.EnableCollision(LAYER_MOVING, LAYER_MOVING)
    const bpStatic = new Jolt.BroadPhaseLayer(0), bpMoving = new Jolt.BroadPhaseLayer(1), bpSensor = new Jolt.BroadPhaseLayer(2)
    const bpi = new Jolt.BroadPhaseLayerInterfaceTable(N_LAYERS, 3)
    bpi.MapObjectToBroadPhaseLayer(LAYER_STATIC, bpStatic)
    bpi.MapObjectToBroadPhaseLayer(LAYER_MOVING, bpMoving)
    bpi.MapObjectToBroadPhaseLayer(LAYER_SENSOR, bpSensor)
    settings.mObjectLayerPairFilter = pairs
    settings.mBroadPhaseLayerInterface = bpi
    settings.mObjectVsBroadPhaseLayerFilter = new Jolt.ObjectVsBroadPhaseLayerFilterTable(bpi, 3, pairs, N_LAYERS)
    settings.mMaxBodies = 16384
    this.jolt = new Jolt.JoltInterface(settings)
    Jolt.destroy(settings); Jolt.destroy(bpStatic); Jolt.destroy(bpMoving); Jolt.destroy(bpSensor)
    this.sys = this.jolt.GetPhysicsSystem()
    this.bi = this.sys.GetBodyInterface()
    this.sys.SetGravity(new Jolt.Vec3(0, 0, 0)) // la gravedad la aplica el personaje; si luego hay cuerpos dinámicos, `dynamics()` pone la suya
    this.bodies = null             // BodySet (bodies.js): cuerpos dinámicos, solo si se pide alguno
    this.shapes = new Map()        // clave de geometría+escala → Shape (con una referencia nuestra)
    this.handles = new Map()       // THREE.Mesh → { id, shape, moving }
    this.nodeHandles = new Map()   // StaticBody3D → un cuerpo físico por nodo
    this.rigidNodes = new Map()    // RigidBody3D Object3D → item de BodySet
    this.terrain = []              // handles del terreno
    this.sensors = []              // { id, node, key }: cajas-sensor ligadas a un nodo (triggers, zonas de evento)
    this.byBody = new Map()        // BodyID (índice+secuencia) → { mesh | kind } para saber qué tocó un rayo
    this.char = null
    this.charPos = new THREE.Vector3(NaN, NaN, NaN)
    this.tmp = { v: new Jolt.Vec3(), v2: new Jolt.Vec3(), r: new Jolt.RVec3(), q: new Jolt.Quat() }
    this.bpFilter = new Jolt.DefaultBroadPhaseLayerFilter(this.jolt.GetObjectVsBroadPhaseLayerFilter(), LAYER_MOVING)
    this.objFilter = new Jolt.DefaultObjectLayerFilter(this.jolt.GetObjectLayerPairFilter(), LAYER_MOVING)
    this.bodyFilter = new Jolt.BodyFilter()
    // Los cuerpos dinámicos desplazan fluido por su pose; no se hornean como diques.
    this.fluidBodyFilter = new Jolt.BodyFilterJS()
    this.fluidBodyFilter.ShouldCollide = () => true
    this.fluidBodyFilter.ShouldCollideLocked = ptr => Jolt.wrapPointer(ptr, Jolt.Body).GetMotionType() !== Jolt.EMotionType_Dynamic
    this.shapeFilter = new Jolt.ShapeFilter()
    this.sensorFilter = new Jolt.SpecifiedObjectLayerFilter(LAYER_SENSOR)
    this.anyBp = new Jolt.BroadPhaseLayerFilter()
    this.collideSettings = new Jolt.CollideShapeSettings()
    this.one = new Jolt.Vec3(1, 1, 1)
    this.zero = new Jolt.RVec3(0, 0, 0)
    this._hits = new Set()
    this.collector = new Jolt.CollideShapeCollectorJS()
    this.collector.Reset = () => {}
    this.collector.OnBody = () => {}
    this.collector.AddHit = (ptr) => { this._hits.add(Jolt.wrapPointer(ptr, Jolt.CollideShapeResult).get_mBodyID2().GetIndexAndSequenceNumber()) }
    this.update = new Jolt.ExtendedUpdateSettings()
    this.update.mStickToFloorStepDown = new Jolt.Vec3(0, -0.5, 0)
    this.update.mWalkStairsStepUp = new Jolt.Vec3(0, stepUp, 0)
    this.disposed = false
  }

  // ---------- formas ----------
  /** MeshShape a partir de posiciones (Float32Array xyz) e índices; `scale` ya se aplica a los vértices. */
  _meshShape(pos, index, sx, sy, sz) {
    const J = this.J
    const verts = new J.VertexList(), tris = new J.IndexedTriangleList()
    const n = pos.length / 3
    verts.resize(n)
    for (let i = 0; i < n; i++) {
      const a = verts.at(i)
      a.x = pos[i * 3] * sx; a.y = pos[i * 3 + 1] * sy; a.z = pos[i * 3 + 2] * sz
    }
    const m = index ? index.length : n
    tris.resize(Math.floor(m / 3))
    const flip = sx * sy * sz < 0 // escala negativa invierte el sentido de las caras
    for (let t = 0, k = 0; k + 2 < m; t++, k += 3) {
      const a = index ? index[k] : k, b = index ? index[k + 1] : k + 1, c = index ? index[k + 2] : k + 2
      const tr = tris.at(t)
      tr.set_mIdx(0, a); tr.set_mIdx(1, flip ? c : b); tr.set_mIdx(2, flip ? b : c)
    }
    const mats = new J.PhysicsMaterialList()
    const ss = new J.MeshShapeSettings(verts, tris, mats)
    const res = ss.Create()
    const shape = res.IsValid() ? res.Get() : null
    if (shape) shape.AddRef()
    J.destroy(res); J.destroy(ss); J.destroy(mats); J.destroy(verts); J.destroy(tris)
    return shape
  }

  _body(shape, p, q, moving, sensor = false, physical = null) {
    const J = this.J, t = this.tmp
    t.r.Set(p.x, p.y, p.z); t.q.Set(q.x, q.y, q.z, q.w)
    const cs = new J.BodyCreationSettings(shape, t.r, t.q, moving ? J.EMotionType_Kinematic : J.EMotionType_Static, sensor ? LAYER_SENSOR : moving ? LAYER_MOVING : LAYER_STATIC)
    cs.mAllowDynamicOrKinematic = !sensor // un evento puede mover este nodo más tarde (estático → cinemático)
    if (physical) { cs.mFriction = physical.friction; cs.mRestitution = physical.restitution }
    if (sensor) cs.mIsSensor = true
    let id
    try {
      const body = this.bi.CreateBody(cs)
      if (!body) throw new Error('Jolt: CreateBody devolvió un cuerpo nulo')
      id = body.GetID()
      this.bi.AddBody(id, J.EActivation_Activate)
      return id
    } catch (error) {
      if (id) this.bi.DestroyBody(id) // sin registro parcial en Jolt
      throw error
    } finally { J.destroy(cs) }
  }

  /** Añade la malla como colisión estática (con la matriz del mundo actual). Devuelve false si no es válida. */
  addMesh(mesh) {
    if (this.disposed || this.handles.has(mesh)) return !!this.handles.get(mesh)
    const g = mesh.userData?.lmOrig || mesh.geometry, pa = g?.attributes?.position // con bake: la original (la del lightmap no tiene índice y multiplica la memoria)
    if (!pa || mesh.isInstancedMesh || mesh.isSkinnedMesh) return false
    mesh.updateWorldMatrix(true, false)
    mesh.matrixWorld.decompose(_p, _q, _s)
    const key = `${g.uuid}|${_s.x.toFixed(4)}|${_s.y.toFixed(4)}|${_s.z.toFixed(4)}|${pa.count}|${g.index ? g.index.count : 0}`
    let shape = this.shapes.get(key)
    if (shape === undefined) {
      const pos = pa.isInterleavedBufferAttribute || pa.itemSize !== 3 || pa.normalized ? Float32Array.from({ length: pa.count * 3 }, (_, i) => pa.getComponent(Math.floor(i / 3), i % 3)) : pa.array
      shape = this._meshShape(pos, g.index ? g.index.array : null, _s.x, _s.y, _s.z)
      this.shapes.set(key, shape)
    }
    if (!shape) { this.handles.set(mesh, null); return false }
    const id = this._body(shape, _p, _q, false)
    this.handles.set(mesh, { id, moving: false, active: true })
    this.byBody.set(this._key(id), { mesh })
    return true
  }

  /** Colisión de caja (texto 3D). `size` en metros, ya con la escala del nodo. */
  addBox(mesh, size) {
    if (this.disposed || this.handles.has(mesh)) return !!this.handles.get(mesh)
    mesh.updateWorldMatrix(true, false)
    mesh.matrixWorld.decompose(_p, _q, _s)
    const shape = this._boxShape(size[0], size[1], size[2])
    const id = this._body(shape, _p, _q, false)
    this.handles.set(mesh, { id, moving: false, active: true })
    this.byBody.set(this._key(id), { mesh })
    return true
  }

  _boxShape(x, y, z) {
    const key = `box|${x.toFixed(4)}|${y.toFixed(4)}|${z.toFixed(4)}`
    let shape = this.shapes.get(key)
    if (!shape) {
      const J = this.J, hx = Math.max(0.005, x / 2), hy = Math.max(0.005, y / 2), hz = Math.max(0.005, z / 2)
      const he = new J.Vec3(hx, hy, hz)
      const ss = new J.BoxShapeSettings(he, Math.min(0.05, hx, hy, hz) * 0.5)
      let res
      try {
        res = ss.Create()
        if (!res?.IsValid()) throw new Error(`Jolt rechazó BoxShape3D (${x}, ${y}, ${z} m)`)
        shape = res.Get(); shape.AddRef()
        this.shapes.set(key, shape)
      } finally { if (res) J.destroy(res); J.destroy(ss); J.destroy(he) }
    }
    return shape
  }

  _key(id) { return id.GetIndexAndSequenceNumber() }

  removeMesh(mesh) {
    const h = this.handles.get(mesh)
    this.handles.delete(mesh)
    if (h) { this.byBody.delete(this._key(h.id)); this._free(h) }
  }

  /** Rayo contra la geometría sólida (no sensores). `dir` se normaliza. Devuelve null o { point, normal, distance, mesh }. */
  raycast(origin, dir, maxDist = 100, { backFaces = false, staticOnly = false } = {}) {
    const J = this.J, t = this.tmp
    const len = Math.hypot(dir[0], dir[1], dir[2])
    if (!(len > 0) || !(maxDist > 0)) return null
    t.v.Set((dir[0] / len) * maxDist, (dir[1] / len) * maxDist, (dir[2] / len) * maxDist)
    t.r.Set(origin[0], origin[1], origin[2])
    const ray = new J.RRayCast(t.r, t.v), settings = new J.RayCastSettings(), col = new J.CastRayClosestHitCollisionCollector()
    if (backFaces) { settings.set_mBackFaceModeTriangles(J.EBackFaceMode_CollideWithBackFaces); settings.set_mBackFaceModeConvex(J.EBackFaceMode_CollideWithBackFaces) }
    this.sys.GetNarrowPhaseQuery().CastRay(ray, settings, col, this.anyBp, this.objFilter, staticOnly ? this.fluidBodyFilter : this.bodyFilter, this.shapeFilter)
    let out = null
    if (col.HadHit()) {
      const hit = col.get_mHit(), f = hit.get_mFraction()
      const point = [origin[0] + (dir[0] / len) * maxDist * f, origin[1] + (dir[1] / len) * maxDist * f, origin[2] + (dir[2] / len) * maxDist * f]
      let normal = null
      const body = this.sys.GetBodyLockInterfaceNoLock().TryGetBody(hit.get_mBodyID())
      if (body) { t.r.Set(point[0], point[1], point[2]); const n = body.GetWorldSpaceSurfaceNormal(hit.get_mSubShapeID2(), t.r); normal = [n.GetX(), n.GetY(), n.GetZ()] }
      out = { point, normal, distance: maxDist * f, mesh: this.byBody.get(this._key(hit.get_mBodyID()))?.mesh || null }
    }
    J.destroy(ray); J.destroy(settings); J.destroy(col)
    return out
  }

  /** Optimiza el árbol del broadphase tras añadir muchos cuerpos (al cargar la escena). */
  finalize() { this.sys.OptimizeBroadPhase() }

  _free(h) {
    if (h.active) this.bi.RemoveBody(h.id)
    this.bi.DestroyBody(h.id)
  }

  /** Terreno de una pieza (`Terrain`): malla con su mapa de alturas, en coordenadas del mundo. */
  addTerrain(t) {
    if (this.disposed || t.enabled === false) return
    const n1 = t.n1, nz1 = t.nz1 || n1, half = t.size / 2, hz = (t.depth ?? t.size) / 2, step = t.step
    const pos = new Float32Array(n1 * nz1 * 3)
    for (let j = 0; j < nz1; j++) for (let i = 0; i < n1; i++) {
      const k = (j * n1 + i) * 3
      pos[k] = i * step - half; pos[k + 1] = t.heights[j * n1 + i]; pos[k + 2] = j * step - hz
    }
    const idx = new Uint32Array(t.segments * (t.segmentsZ ?? t.segments) * 6)
    let o = 0
    for (let j = 0; j < (t.segmentsZ ?? t.segments); j++) for (let i = 0; i < t.segments; i++) {
      const a = j * n1 + i, b = a + 1, c = a + n1, d = c + 1
      idx[o++] = a; idx[o++] = c; idx[o++] = b; idx[o++] = b; idx[o++] = c; idx[o++] = d
    }
    const shape = this._meshShape(pos, idx, 1, 1, 1)
    if (!shape) return
    this.shapes.set('terrain:' + t.id, shape)
    const id = this._body(shape, { x: t.ox, y: t.oy, z: t.oz }, { x: 0, y: 0, z: 0, w: 1 }, false)
    this.terrain.push({ id, active: true, pieceId: t.id })
    this.byBody.set(this._key(id), { terrain: true })
  }

  removeTerrain(pieceId) {
    const index = this.terrain.findIndex(handle => handle.pieceId === pieceId)
    if (index < 0) return
    const [handle] = this.terrain.splice(index, 1)
    this.byBody.delete(this._key(handle.id))
    this._free(handle)
    const key = 'terrain:' + pieceId
    this.shapes.get(key)?.Release()
    this.shapes.delete(key)
  }

  /** El desplazamiento temporal conserva el mismo BodyID, alturas y forma Jolt. */
  moveTerrainPiece(pieceId, position) {
    const handle = this.terrain.find(item => item.pieceId === pieceId)
    if (!handle?.id) throw new Error(`Terrain: pieza física no disponible «${pieceId}»`)
    if (!Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite))
      throw new RangeError('Terrain: posición temporal inválida')
    this.tmp.r.Set(...position)
    this.tmp.q.Set(0, 0, 0, 1)
    this.bi.SetPositionAndRotation(handle.id, this.tmp.r, this.tmp.q, this.J.EActivation_DontActivate)
  }

  // ---------- nodos que se mueven / se ocultan ----------
  _under(node) {
    const out = []
    node.traverse((m) => { if (m.isMesh && this.handles.get(m)) out.push(m) })
    return out
  }

  /** Cuerpos declarados por StaticBody3D en este nodo o sus descendientes. */
  _underNodeBodies(node) {
    const out = []
    for (const h of this.nodeHandles.values()) {
      for (let parent = h.node; parent; parent = parent.parent) {
        if (parent === node) { out.push(h); break }
      }
    }
    return out
  }

  /** Un evento va a mover `node`: sus colisiones pasan a cinemáticas (arrastran al jugador). */
  makeKinematic(node) {
    for (const m of this._under(node)) {
      const h = this.handles.get(m)
      if (h.moving) continue
      h.moving = true
      this.bi.SetMotionType(h.id, this.J.EMotionType_Kinematic, this.J.EActivation_Activate)
      this.bi.SetObjectLayer(h.id, LAYER_MOVING)
    }
    for (const h of this._underNodeBodies(node)) {
      if (h.moving) continue
      h.moving = true
      this.bi.SetMotionType(h.id, this.J.EMotionType_Kinematic, this.J.EActivation_Activate)
      this.bi.SetObjectLayer(h.id, LAYER_MOVING)
    }
  }

  /** Lleva las colisiones de `node` a donde está ahora (movimiento suave si ya son cinemáticas, salto si no). */
  syncNode(node, dt = 0) {
    node.updateMatrixWorld(true)
    for (const m of this._under(node)) {
      const h = this.handles.get(m)
      m.matrixWorld.decompose(_p, _q, _s)
      const t = this.tmp
      t.r.Set(_p.x, _p.y, _p.z); t.q.Set(_q.x, _q.y, _q.z, _q.w)
      if (h.moving && dt > 0) this.bi.MoveKinematic(h.id, t.r, t.q, dt)
      else this.bi.SetPositionAndRotation(h.id, t.r, t.q, this.J.EActivation_Activate)
    }
    for (const h of this._underNodeBodies(node)) {
      h.node.updateWorldMatrix(true, false)
      h.node.matrixWorld.decompose(_p, _q, _s)
      this.tmp.r.Set(_p.x, _p.y, _p.z)
      this.tmp.q.Set(_q.x, _q.y, _q.z, _q.w)
      if (h.moving && dt > 0) this.bi.MoveKinematic(h.id, this.tmp.r, this.tmp.q, dt)
      else this.bi.SetPositionAndRotation(h.id, this.tmp.r, this.tmp.q, this.J.EActivation_Activate)
    }
    // Un script que mueve un RigidBody3D (o su padre) teletransporta el cuerpo Jolt,
    // en lugar de limitarse a cambiar una matriz que el siguiente paso sobrescribiría.
    for (const [root, item] of this.rigidNodes) {
      let related = false
      for (let p = root; p; p = p.parent) if (p === node) { related = true; break }
      if (!related) continue
      root.updateWorldMatrix(true, false)
      root.matrixWorld.decompose(_p, _q, _s)
      this.bodies?.teleport(item, _p, _q)
    }
    for (const character of this.nodeSpatial?.characters?.values() || []) {
      let moved = false
      for (let v = character.node; v; v = v.parent) if (v === node) { moved = true; break }
      if (moved) this.nodeSpatial.syncCharacter(character)
    }
    for (const area of this.nodeSpatial?.areas?.values() || []) {
      let moved = false
      for (let v = area.node; v; v = v.parent) if (v === node) { moved = true; break }
      if (moved) this.nodeSpatial.syncArea(area)
    }
    for (const sn of this.sensors) { // los sensores cuelgan de un nodo: si ese nodo (o un ancestro) se movió, la zona va con él
      let moved = false
      for (let v = sn.node; v; v = v.parent) if (v === node) { moved = true; break }
      if (!moved) continue
      sn.node.matrixWorld.decompose(_p, _q, _s)
      this.tmp.r.Set(_p.x, _p.y, _p.z); this.tmp.q.Set(_q.x, _q.y, _q.z, _q.w)
      this.bi.SetPositionAndRotation(sn.id, this.tmp.r, this.tmp.q, this.J.EActivation_DontActivate)
    }
  }

  /** Suspende una pieza Terrain sin destruir su malla de colisión Jolt. */
  setTerrainActive(pieceId, on) {
    for (const handle of this.terrain) {
      if (handle.pieceId !== pieceId || handle.active === on) continue
      handle.active = on
      if (on) this.bi.AddBody(handle.id, this.J.EActivation_Activate)
      else this.bi.RemoveBody(handle.id)
    }
  }

  /** Activa/desactiva participación física; no depende de la visibilidad del render. */
  setNodeEnabled(node, on) {
    for (const [root, item] of this.rigidNodes) {
      let related = false
      for (let p = root; p; p = p.parent) if (p === node) { related = true; break }
      if (related) this.bodies?.setEnabled(item, on && !this.nodeBodyRuntime?.isTimelineShapeDisabled(root.userData?.id))
    }
    for (const m of this._under(node)) {
      const h = this.handles.get(m)
      if (h.active === on) continue
      h.active = on
      if (on) this.bi.AddBody(h.id, this.J.EActivation_Activate); else this.bi.RemoveBody(h.id)
    }
    for (const h of this._underNodeBodies(node)) {
      const enabled=on && !this.nodeBodyRuntime?.isTimelineShapeDisabled(h.node?.userData?.id)
      if (h.active === enabled) continue
      h.active = enabled
      if (enabled) this.bi.AddBody(h.id, this.J.EActivation_Activate)
      else this.bi.RemoveBody(h.id)
    }
    for (const area of this.nodeSpatial?.areas?.values() || []) {
      let related = false
      for (let v = area.node; v; v = v.parent) if (v === node) { related = true; break }
      const enabled=on && !this.nodeSpatial?.isTimelineShapeDisabled(area.obj.id)
      if (!related || area.active === enabled) continue
      area.active = enabled
      if (enabled) this.bi.AddBody(area.id, this.J.EActivation_DontActivate)
      else this.bi.RemoveBody(area.id)
    }

  }

  /** Cuerpos dinámicos (bodies.js); se crea al primero que se pide. */
  dynamics() { return (this.bodies ??= new BodySet(this)) }

  /** Avanza el mundo (cuerpos cinemáticos y dinámicos). */
  // El Game Loop llama una sola vez por intervalo físico; también avanza nodos sin jugador FPS.
  step(dt) { this.bodies?.beforeStep(dt); this.nodeBodyRuntime?.syncTimelinePhysics(); this.jolt.Step(dt, 1); this.nodeSpatial?.tick(dt) }

  dispose() {
    if (this.disposed) return
    const J = this.J
    this.nodeSpatial?.dispose(); this.nodeSpatial = null
    this.disposed = true
    this.bodies?.dispose(); this.bodies = null
    for (const h of this.handles.values()) if (h) this._free(h)
    for (const h of this.nodeHandles.values()) this._free(h)
    for (const h of this.terrain) this._free(h)
    for (const sn of this.sensors) this._free({ id: sn.id, active: true })
    this.handles.clear(); this.nodeHandles.clear(); this.rigidNodes.clear(); this.terrain = []; this.sensors = []; this.byBody.clear()
    if (this.char) { J.destroy(this.char); this.charShape?.Release() }
    for (const s of this.shapes.values()) s?.Release()
    this.shapes.clear()
    for (const o of [this.collector, this.collideSettings, this.sensorFilter, this.anyBp, this.one, this.zero, this.update, this.shapeFilter, this.fluidBodyFilter, this.bodyFilter, this.objFilter, this.bpFilter, this.tmp.v, this.tmp.v2, this.tmp.r, this.tmp.q]) J.destroy(o)
    J.destroy(this.jolt)
  }
}
Object.assign(JoltWorld.prototype, characterMethods) // characterMethods: ./jolt-character.js
Object.assign(JoltWorld.prototype, sensorMethods) // sensorMethods: ./jolt-sensors.js
