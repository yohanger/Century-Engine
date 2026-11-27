// Adaptador del árbol de nodos al mundo Jolt que YA utiliza PlayMode.
// Una entidad física produce un único cuerpo, aunque tenga varias CollisionShape3D.
import * as THREE from 'three'
import { physicsNodePlan } from './node-body-plan.js'
import { nodeEffectiveActive } from '../nodes/hierarchy.js'
import { NodeSpatialRuntime } from './node-spatial.js'
import { resolveTriMeshSource } from './trimesh-source.js'
import { triMeshGeometry } from './trimesh-geometry.js'
import { effectiveCollisionShape, validatePhysicsShape } from './shapes.js'

const P = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3()

/** Forma Jolt almacenada en la caché del mundo: solo el mundo conserva su referencia. */
function primitiveShape(world, resource, transient = false) {
  const J = world.J
  if (resource.type === 'BoxShape3D') return { shape: transient ? null : world._boxShape(...resource.size), volume: resource.size.reduce((a, b) => a * b, 1) }
  const r = resource.radius
  const h = resource.type === 'SphereShape3D' ? 0 : (resource.height - 2 * r) / 2
  // Una cápsula sin tramo cilíndrico es exactamente una esfera;
  // evita pedirle a Jolt una cápsula degenerada de altura cero.
  const sphere = resource.type === 'SphereShape3D' || h < 1e-8
  const vol = sphere ? 4/3*Math.PI*r**3 : Math.PI*r*r*(2*h)+4/3*Math.PI*r**3
  if (transient) return { shape: null, volume: vol }
  const key = sphere ? `sph|${r.toFixed(4)}` : `cap|${r.toFixed(4)}|${h.toFixed(4)}`
  let shape = world.shapes.get(key)
  if (!shape) {
    const settings = sphere ? new J.SphereShapeSettings(r) : new J.CapsuleShapeSettings(h, r)
    const result = settings.Create()
    if (!result.IsValid()) { J.destroy(result); J.destroy(settings); throw new Error(`Jolt no pudo construir ${resource.type}`) }
    shape = result.Get()
    shape.AddRef()
    J.destroy(result); J.destroy(settings)
    world.shapes.set(key, shape)
  }
  const volume = sphere ? (4 / 3) * Math.PI * r ** 3 : Math.PI * r * r * (2 * h) + (4 / 3) * Math.PI * r ** 3
  return { shape, volume }
}

/** En wasm-compat las APIs de ShapeSettings requieren Settings, no el Shape ya cocinado. */
function shapeSettingsForPart(J, part) {
  const spec = part.resource
  const owned = []
  try {
    let settings
    if (spec.type === 'BoxShape3D') {
      const extents = spec.size.map((n) => Math.max(0.005, n / 2))
      const half = new J.Vec3(...extents)
      owned.push(half)
      settings = new J.BoxShapeSettings(half, Math.min(0.05, ...extents) * 0.5)
    } else if (spec.type === 'SphereShape3D') settings = new J.SphereShapeSettings(spec.radius)
    else if (spec.type === 'CapsuleShape3D') {
      const half = (spec.height - spec.radius * 2) / 2
      settings = half < 1e-8 ? new J.SphereShapeSettings(spec.radius) : new J.CapsuleShapeSettings(half, spec.radius)
    } else if (spec.type === 'TriMeshShape3D') {
      const { positions, indices } = part.meshData
      const verts = new J.VertexList(), tris = new J.IndexedTriangleList()
      const mats = new J.PhysicsMaterialList()
      owned.push(verts, tris, mats)
      verts.resize(positions.length / 3)
      for (let i = 0; i < positions.length / 3; i++) {
        const v = verts.at(i); v.x = positions[i * 3]; v.y = positions[i * 3 + 1]; v.z = positions[i * 3 + 2]
      }
      const count = indices ? indices.length : positions.length / 3
      tris.resize(Math.floor(count / 3))
      for (let i = 0; i < Math.floor(count / 3); i++) {
        const tri = tris.at(i)
        for (let j = 0; j < 3; j++) tri.set_mIdx(j, indices ? indices[i * 3 + j] : i * 3 + j)
      }
      settings = new J.MeshShapeSettings(verts, tris, mats)
    } else throw new Error(`Tipo de Shape3D no soportado: ${spec.type}`)
    // Quien recibe los ShapeSettings se convierte en su propietario nativo. Nunca
    // destruir la misma instancia desde el hijo y desde el padre.
    return { settings, dispose: (transferred = false) => {
      if (!transferred) J.destroy(settings)
      for (const item of owned) J.destroy(item)
    } }
  } catch (error) { for (const item of owned) J.destroy(item); throw error }
}

function joltShapeForBody(world, bodyNode, shapeEntries, objects, sceneNodes, transient = false) {
  const J = world.J
  bodyNode.updateWorldMatrix(true, true)
  const inverse = bodyNode.matrixWorld.clone().invert()
  const parts = []
  try {
    for (const { node, obj } of shapeEntries) {
      node.updateWorldMatrix(true, false)
      inverse.clone().multiply(node.matrixWorld).decompose(P, Q, S)
      if ([S.x, S.y, S.z].some((v) => Math.abs(v - 1) > 1e-5)) throw new Error(`${obj.name}: CollisionShape3D no admite escala física heredada`)
      if (obj.props.shape.type === 'TriMeshShape3D') {
        const source = resolveTriMeshSource(objects, obj)
        const sourceNode = sceneNodes.get(source.id)
        const { positions, indices } = triMeshGeometry(sourceNode, node)
        const meshShape = world._meshShape(positions, indices, 1, 1, 1)
        if (!meshShape) throw new Error(`Jolt rechazó TriMeshShape3D: ${obj.name}`)
        parts.push({ pos: P.clone(), quat: Q.clone(), shape: meshShape, volume: 0, owned: true, displacement: null,
          resource: obj.props.shape, meshData: { positions, indices } })
      } else {
        const { shape, volume } = primitiveShape(world, obj.props.shape, transient)
        parts.push({ pos: P.clone(), quat: Q.clone(), shape, volume, owned: false, resource: obj.props.shape,
          displacement: obj.props.shape.type === 'BoxShape3D'
            ? { kind: 'box', size: [...obj.props.shape.size] }
            : obj.props.shape.type === 'SphereShape3D'
              ? { kind: 'sphere', size: [obj.props.shape.radius*2, obj.props.shape.radius*2, obj.props.shape.radius*2] }
              : obj.props.shape.type === 'CapsuleShape3D'
                ? { kind: 'capsule', size: [obj.props.shape.radius*2, obj.props.shape.height, obj.props.shape.radius*2] }
                : null })
      }
    }
  } catch (error) {
    for (const part of parts) if (part.owned) part.shape.Release()
    throw error
  }
  if (!parts.length) return null
  const one = parts[0]
  const identity = one.pos.lengthSq() < 1e-12 &&
    Math.abs(one.quat.x) < 1e-8 && Math.abs(one.quat.y) < 1e-8 && Math.abs(one.quat.z) < 1e-8 &&
    Math.abs(Math.abs(one.quat.w) - 1) < 1e-8
  if (parts.length === 1 && identity) {
    if (!transient || one.owned) return { shape: one.shape, volume: one.volume, owned: one.owned, displacement: one.displacement }
    const entry = shapeSettingsForPart(J,one)
    let result
    try {
      result = entry.settings.Create()
      if (!result?.IsValid()) throw new Error('Jolt rechazó la forma animada')
      const shape = result.Get()
      shape.AddRef()
      result.Clear?.()
      return { shape, volume: one.volume, owned: true, displacement: one.displacement }
    } finally { if (result) J.destroy(result); entry.dispose(false) }
  }
  let settings = null, result = null
  const inner = []
  let transferred = 0 // cantidad de ShapeSettings transferidos a un padre nativo
  try {
    // Las versiones wasm-compat exponen RotatedTranslatedShapeSettings/CompoundShapeSettings
    // con argumentos ShapeSettings. Shape y ShapeSettings tienen tipos nativos distintos.
    for (const part of parts) inner.push(shapeSettingsForPart(J, part))
    if (parts.length === 1) {
      const v = new J.Vec3(one.pos.x, one.pos.y, one.pos.z)
      const q = new J.Quat(one.quat.x, one.quat.y, one.quat.z, one.quat.w)
      try {
        settings = new J.RotatedTranslatedShapeSettings(v, q, inner[0].settings)
        transferred = 1 // el decorador retiene la propiedad del ShapeSettings hijo
      } finally { J.destroy(v); J.destroy(q) }
    } else {
      settings = new J.StaticCompoundShapeSettings()
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        const v = new J.Vec3(part.pos.x, part.pos.y, part.pos.z)
        const q = new J.Quat(part.quat.x, part.quat.y, part.quat.z, part.quat.w)
        try {
          settings.AddShape(v, q, inner[i].settings, 0)
          transferred++ // cada hijo aceptado pertenece ahora al compound
        } finally { J.destroy(v); J.destroy(q) }
      }
    }
    result = settings.Create()
    if (!result?.IsValid()) throw new Error('Jolt rechazó la forma transformada o compuesta')
    const shape = result.Get()
    shape.AddRef() // mantener referencia propia antes de liberar el resultado
    result.Clear?.() // el resultado también retiene una referencia nativa
    return { shape, volume: parts.reduce((sum, p) => sum + p.volume, 0), owned: true, displacement: null }
  } finally {
    if (result) J.destroy(result)
    if (settings) J.destroy(settings) // libera los hijos que le fueron transferidos
    for (let i = 0; i < inner.length; i++) inner[i].dispose(i < transferred)
    for (const part of parts) if (part.owned) part.shape.Release()
  }
}

function visibleMesh(node) {
  let found = null
  node.traverse((m) => {
    if (!found && m.isMesh && !m.userData?.helper && !m.userData?.pickProxy && m.visible && m.geometry) found = m
  })
  return found
}

/** Registro temporal de física por escena. JoltWorld continúa siendo el dueño de los cuerpos. */
export class NodeBodyRuntime {
  constructor(play, collisionLayer) { this.play = play; this.collisionLayer = collisionLayer; this.staticHandles = []; this.timelineBodyValues = new Map(); this.timelineShapeValues = new Map(); this.bodyOwners = []; this.shapeOwners = null }

  /** Registra nodos físicos en el mismo JoltWorld, tanto al entrar en Play como al instanciar Prefabs. */
  _registerPlans(plans) {
    const play = this.play, world = play.phys
      for (const { obj, shapes, dynamic } of plans) {
        const node = play.ed.nodes.get(obj.id)
        if (!node) throw new Error(`Falta la representación de ${obj.name} en SceneGraph`)
        const entries = shapes.map((o) => ({ obj: o, node: play.ed.nodes.get(o.id) }))
        if (entries.some((e) => !e.node)) throw new Error(`${obj.name}: CollisionShape3D no construida`)
        let assembled
        try { assembled = joltShapeForBody(world, node, entries, play.project.objects, play.ed.nodes) }
        catch (error) {
          const names = shapes.map((s) => `${s.name || s.id} (${s.props?.shape?.type || 'sin Shape3D'})`).join(', ')
          throw new Error(`Jolt: no se pudo crear la colisión de ${obj.name || obj.id} [${obj.id}], formas: ${names}: ${error.message}`, { cause: error })
        }
        if (!assembled) continue
        try {
          node.updateWorldMatrix(true, false)
          node.matrixWorld.decompose(P, Q, S)
          const pos = P.clone(), quat = Q.clone(), props = obj.props || {}
          if (dynamic) {
            play._bodyAdd(obj.id, {
              colliderShape: assembled.shape, colliderVolume: assembled.volume,
              shape: assembled.displacement?.kind || 'box', displacement: assembled.displacement, mass: props.mass, friction: props.friction, bounce: props.restitution,
              linearDamping: props.linearDamping, angularDamping: props.angularDamping,
              gravityScale: props.gravityScale, sleep: props.canSleep,
            })
            const record = play._bodies.find((b) => b.id === obj.id)
            if (record) world.rigidNodes.set(node, record.item)
          } else {
            const id = world._body(assembled.shape, pos, quat, false, false, {
              friction: props.friction, restitution: props.restitution,
            })
            const h = { id, active: true, node, ownerId: obj.id }
            this.staticHandles.push(h)
            world.byBody.set(world._key(id), { node: obj.name, mesh: visibleMesh(node) || node })
            world.nodeHandles.set(obj.id, h)
          }
          // Los rayos de respaldo y la detección de superficie utilizan únicamente
          // mallas que pertenecen a un cuerpo físico explícito.
          node.traverse((m) => {
            if (m.isMesh && m.geometry && !m.userData?.helper && !m.userData?.pickProxy) {
              m.layers.enable(this.collisionLayer)
              if (!play.colliders.includes(m)) play.colliders.push(m)
            }
          })
        } finally {
          if (assembled.owned) assembled.shape.Release()
        }
      }
  }

  /** Alta incremental; conserva todas las instancias físicas preexistentes. */
  attach(ids) {
    const world = this.play.phys
    if (!world || world.disposed) {
      if (this.play.project.objects.some(o => ids.has(o.id) && ['characterbody3d','area3d','staticbody3d','rigidbody3d'].includes(o.type)))
        throw new Error('Prefab físico: Jolt no está disponible')
      return
    }
    const plans = physicsNodePlan(this.play.project.objects).filter(({ obj }) => ids.has(obj.id))
    if (plans.some(({obj}) => this.bodyOwners.some(o => o.id === obj.id))) throw new Error('Cuerpo físico duplicado')
    this.bodyOwners.push(...plans.map(({ obj }) => obj))
    try {
      this._registerPlans(plans)
      this.spatial?.start(ids)
      this.shapeOwners = this.play.project.objects.filter(o => o.type === 'collisionshape3d')
      for (const obj of this.play.project.objects.filter(o => ids.has(o.id) && ['characterbody3d','area3d','staticbody3d','rigidbody3d'].includes(o.type))) {
        const node = this.play.ed.nodes.get(obj.id)
        if (node) world.setNodeEnabled(node, this.play._nodeEnabled(obj))
      }
      world.finalize()
    } catch (error) { this.detach(ids); throw error }
  }

  /** Baja incremental, sin afectar cuerpos de otras instancias o de la escena. */
  detach(ids) {
    const world = this.play.phys
    this.spatial?.remove(ids)
    for (const body of [...this.bodyOwners]) {
      if (!ids.has(body.id)) continue
      const node = this.play.ed.nodes.get(body.id)
      const staticHandle = world?.nodeHandles?.get(body.id)
      if (staticHandle) {
        world.byBody.delete(world._key(staticHandle.id))
        world.nodeHandles.delete(body.id)
        world._free(staticHandle)
        this.staticHandles = this.staticHandles.filter(h => h !== staticHandle)
      }
      const dynamic = this.play._bodies?.find(b => b.id === body.id)
      if (dynamic) this.play._bodyRemove(dynamic)
      if (node) node.traverse(mesh => {
        if (mesh.isMesh && mesh.geometry && !mesh.userData?.helper && !mesh.userData?.pickProxy) {
          mesh.layers.disable(this.collisionLayer)
          this.play.colliders = this.play.colliders.filter(m => m !== mesh)
        }
      })
    }
    this.bodyOwners = this.bodyOwners.filter(o => !ids.has(o.id))
    this.shapeOwners = this.shapeOwners?.filter(o => !ids.has(o.id)) || null
    for (const key of [...this.timelineBodyValues.keys()]) {
      try { if (ids.has(JSON.parse(key)[0])) this.timelineBodyValues.delete(key) } catch { /* clave interna no serializada */ }
    }
    for (const key of [...this.timelineShapeValues.keys()]) if (ids.has(key)) this.timelineShapeValues.delete(key)
  }

  start() {
    const play = this.play, world = play.phys
    if (!world) return
    const plans = physicsNodePlan(play.project.objects)
    this.bodyOwners = plans.map(({ obj }) => obj)
    this.shapeOwners = play.project.objects.filter(o => o.type === 'collisionshape3d')
    const plannedIds = new Set(plans.map(({ obj }) => obj.id))
    for (const obj of play.project.objects) {
      if ((obj.type === 'staticbody3d' || obj.type === 'rigidbody3d') && nodeEffectiveActive(play.project.objects, obj) && !plannedIds.has(obj.id)) {
        console.warn(`${obj.name || obj.id}: sin CollisionShape3D habilitada, no se creó cuerpo Jolt`)
      }
    }
    try {
      this._registerPlans(plans)
      // La física de los nodos especializados utiliza el mismo mundo Jolt.
      // No introduce otro loop ni registra objetos visuales como colisionadores.
      this.spatial = new NodeSpatialRuntime(play, (body, shapes, transient = false) => {
        try { return joltShapeForBody(world, body, shapes, play.project.objects, play.ed.nodes, transient) }
        catch (error) {
          const owner = [...play.ed.nodes.entries()].find(([, node]) => node === body)?.[0] || 'desconocido'
          const kinds = shapes.map(({ obj }) => `${obj.name || obj.id}:${obj.props?.shape?.type}`).join(', ')
          throw new Error(`Jolt: no se pudo construir el sensor ${owner} [${kinds}]: ${error.message}`, { cause: error })
        }
      })
      this.spatial.start()
      world.nodeSpatial = this.spatial
      world.nodeBodyRuntime = this
    } catch (error) { try { this.dispose() } catch (cleanupError) { console.error('Jolt: falló la limpieza tras el error de Play', cleanupError) } throw error }
  }

  isTimelineShapeDisabled(id) { return this.timelineShapeValues.get(id)?.suspended === true }

  /** Se evalúa antes del solver original y al detener Timeline.
   * Cambia Shape conservando BodyID y sin almacenar claves en world.shapes. */
  syncTimelineCollisionShapes() {
    const world = this.play.phys
    if (!world || world.disposed) return
    const objects = this.play.project.objects, nodes = this.play.ed.nodes
    const affected = new Set()
    for (const shape of this.shapeOwners || objects) {
      if (shape.type !== 'collisionshape3d') continue
      if (Object.keys(nodes.get(shape.id)?.userData?.timelineCollision || {}).length) affected.add(shape.parentId)
    }
    for (const id of this.timelineShapeValues.keys()) affected.add(id)
    const bi = world.bi
    for (const id of affected) {
      const owner = objects.find(o => o.id === id)
      if (!owner) continue
      if (owner.type !== 'staticbody3d' && owner.type !== 'rigidbody3d') {
        if (!this.spatial?.characters?.has(id) && !this.spatial?.areas?.has(id))
          throw new Error(`CollisionShape3D: no hay instancia física para ${id}`)
        continue
      }
      const root = nodes.get(id)
      const item = owner.type === 'staticbody3d' ? world.nodeHandles.get(id) : world.rigidNodes.get(root)
      if (!root || !item?.id) throw new Error(`CollisionShape3D: ${id} no tiene BodyID; Timeline no puede crear cuerpos implícitos`)
      const all = objects.filter(o => o.parentId === id && o.type === 'collisionshape3d')
        .map(obj => ({obj:effectiveCollisionShape(obj,nodes.get(obj.id)),node:nodes.get(obj.id)}))
      for (const entry of all) {
        if (!entry.node) throw new Error(`CollisionShape3D: no se encontró ${entry.obj.id}`)
        validatePhysicsShape(entry.obj.props.shape)
        if (entry.obj.props.shape.type === 'TriMeshShape3D' && owner.type !== 'staticbody3d')
          throw new Error('TriMeshShape3D temporal solo se admite bajo StaticBody3D')
      }
      const signature = JSON.stringify(all.map(({obj})=>[obj.id,obj.props.disabled===true,obj.props.shape]))
      const previous = this.timelineShapeValues.get(id)
      if (previous?.signature === signature) continue
      const active = all.filter(({obj})=>obj.props.disabled !== true)
      const originals = previous?.originals || (owner.type === 'rigidbody3d'
        ? {mass:item.mass,volume:item.volume,density:item.density}:null)
      if (!active.length) {
        if (owner.type === 'rigidbody3d') world.bodies.setEnabled(item,false)
        else if (item.active) { bi.RemoveBody(item.id);item.active=false }
        this.timelineShapeValues.set(id,{signature,suspended:true,originals})
        continue
      }
      if (typeof bi.SetShape !== 'function') throw new Error('Jolt: BodyInterface.SetShape no disponible')
      // Validar la vía de inercia antes de tocar el BodyID.
      const motion = owner.type === 'rigidbody3d' ? world.sys.GetBodyLockInterfaceNoLock?.().TryGetBody(item.id)?.GetMotionProperties?.() : null
      if (owner.type === 'rigidbody3d' && typeof motion?.ScaleToMass !== 'function')
        throw new Error('Jolt: MotionProperties.ScaleToMass no disponible')
      const assembly = joltShapeForBody(world,root,active,objects,nodes,true)
      if (!assembly) throw new Error('CollisionShape3D: Jolt no pudo construir forma temporal')
      try {
        bi.SetShape(item.id,assembly.shape,owner.type === 'rigidbody3d',world.J.EActivation_Activate)
        if (owner.type === 'rigidbody3d') {
          motion.ScaleToMass(item.mass)
          item.volume=assembly.volume
          item.density=Math.max(.02,Math.min(20,item.mass/(Math.max(assembly.volume,1e-6)*1000)))
        }
        const enabled = this.play._nodeEnabled?.(owner) ?? nodeEffectiveActive(objects,owner)
        if (enabled) {
          if (owner.type === 'rigidbody3d') world.bodies.setEnabled(item,true)
          else if (!item.active) {bi.AddBody(item.id,world.J.EActivation_Activate);item.active=true}
        }
        const hasOverrides=all.some(({node})=>Object.keys(node.userData.timelineCollision||{}).length>0)
        if (hasOverrides) this.timelineShapeValues.set(id,{signature,suspended:false,originals})
        else {
          if (owner.type==='rigidbody3d' && originals) {
            item.volume=originals.volume
            // Masa puede seguir controlada por otra pista cuando termina Shape.
            // Conservar la densidad proporcional al peso físico todavía vigente.
            item.density=originals.mass > 0
              ? Math.max(.02,Math.min(20,originals.density * item.mass / originals.mass))
              : originals.density
          }
          this.timelineShapeValues.delete(id)
        }
      } finally {if (assembly.owned) assembly.shape.Release()}
    }
    this.spatial?.syncTimelineCollisionShapes?.()
  }

  /** Un recorte Substract cambia la fuente TriMesh de un cuerpo ESTÁTICO ya creado.
   *  Reconstruye su Shape sobre el mismo BodyID; sin otro mundo ni cuerpos implícitos.
   */
  syncCarvedSources(sourceIds) {
    if (!sourceIds?.length) return 0
    const play = this.play, world = play.phys
    if (!world || world.disposed) return 0
    if (typeof world.bi?.SetShape !== 'function') throw new Error('CSG: BodyInterface.SetShape no disponible')
    const objects = play.project.objects, nodes = play.ed.nodes, affected = new Set(sourceIds)
    const byId = new Map(objects.map(o => [o.id,o]))
    for (const id of affected) {
      const receiver = byId.get(id)
      const seen = new Set()
      for (let parent = byId.get(receiver?.parentId); parent; parent = byId.get(parent.parentId)) {
        if (seen.has(parent.id)) throw new Error('CSG: jerarquía de cuerpos circular')
        seen.add(parent.id)
        if (parent.type === 'staticbody3d' || parent.type === 'rigidbody3d') {
          const shapes = objects.filter(o => o.parentId === parent.id && o.type === 'collisionshape3d' && o.props?.disabled !== true)
          if (shapes.some(o => o.props?.shape?.type !== 'TriMeshShape3D' || o.props.shape.sourceId !== id))
            throw new Error(`CSG: el cuerpo «${parent.id}» debe usar TriMeshShape3D de «${id}» para animar el corte`)
          break
        }
      }
    }
    const pending = []
    try {
      for (const owner of this.bodyOwners) {
        if (owner.type !== 'staticbody3d') continue // TriMeshShape3D solo existe en StaticBody3D
        const shapes = objects.filter(o => o.parentId === owner.id && o.type === 'collisionshape3d')
        const relevant = shapes.some(shape => shape.props?.disabled !== true &&
          shape.props?.shape?.type === 'TriMeshShape3D' && affected.has(shape.props.shape.sourceId))
        if (!relevant) continue
        const handle = world.nodeHandles.get(owner.id), root = nodes.get(owner.id)
        if (!root || !handle?.id) throw new Error(`CSG: StaticBody3D «${owner.id}» sin BodyID existente`)
        const entries = shapes.map(obj => ({ obj: effectiveCollisionShape(obj,nodes.get(obj.id)), node: nodes.get(obj.id) }))
          .filter(entry => entry.obj.props?.disabled !== true)
        if (!entries.length || entries.some(entry => !entry.node)) throw new Error(`CSG: Shape3D inválida en «${owner.id}»`)
        for (const entry of entries) validatePhysicsShape(entry.obj.props.shape)
        const assembly = joltShapeForBody(world,root,entries,objects,nodes,true)
        if (!assembly) throw new Error(`CSG: no se pudo obtener Shape física para «${owner.id}»`)
        pending.push({handle,assembly})
      }
      // Si la segunda fuente CSG falla, la primera todavía NO ha cambiado su BodyID.
      for (const {handle,assembly} of pending)
        world.bi.SetShape(handle.id,assembly.shape,false,world.J.EActivation_Activate)
      return pending.length
    } finally {
      for (const {assembly} of pending) if (assembly.owned) assembly.shape.Release()
    }
  }

  /** Sincroniza únicamente propiedades físicas animadas, antes del paso Jolt existente.
   *  Los snapshots son los valores reales de BodyInterface, no una copia de props.
   */
  syncTimelinePhysics() {
    this.syncTimelineCollisionShapes()
    const world = this.play.phys
    if (!world || world.disposed) return
    const bi = world.bi
    const methods = {
      friction: ['GetFriction', 'SetFriction'],
      restitution: ['GetRestitution', 'SetRestitution'],
      gravityScale: ['GetGravityFactor', 'SetGravityFactor'],
    }
    const dynamicProps = ['linearDamping', 'angularDamping', 'mass', 'canSleep']
    for (const obj of this.bodyOwners) {
      if (obj.type !== 'staticbody3d' && obj.type !== 'rigidbody3d') continue
      const node = this.play.ed.nodes.get(obj.id)
      const handle = obj.type === 'staticbody3d' ? world.nodeHandles.get(obj.id) : world.rigidNodes.get(node)
      if (!node || !handle?.id) continue
      const channels = node.userData.timelineSpatial || {}
      for (const prop of obj.type === 'rigidbody3d'
        ? ['friction', 'restitution', 'gravityScale', ...dynamicProps] : ['friction', 'restitution']) {
        const key = JSON.stringify([obj.id, prop]), record = this.timelineBodyValues.get(key)
        const hasOverride = Object.hasOwn(channels, prop)
        if (!hasOverride && !record) continue
        let getValue, setValue
        if (dynamicProps.includes(prop)) {
          // wasm-compat: el lock NoLock es válido aquí, fuera de Jolt.Step y en el mismo hilo.
          const body = world.sys.GetBodyLockInterfaceNoLock?.().TryGetBody(handle.id)
          const motion = body?.GetMotionProperties?.()
          if (!body || !motion) throw new Error(`Jolt: MotionProperties no disponible para ${obj.id}`)
          const methods = {
            linearDamping: ['GetLinearDamping', 'SetLinearDamping'],
            angularDamping: ['GetAngularDamping', 'SetAngularDamping'],
          }
          if (prop === 'canSleep') {
            getValue = () => body.GetAllowSleeping()
            setValue = v => body.SetAllowSleeping(v)
          } else if (prop === 'mass') {
            getValue = () => 1 / motion.GetInverseMass()
            setValue = v => {
              const nativeMass = getValue()
              motion.ScaleToMass(v)
              // El mismo BodySet calcula empuje con density y empujes con mass.
              // Ajustar ambos evita que Timeline altere solo media simulación.
              if (handle.density != null && Number.isFinite(nativeMass) && nativeMass > 0)
                handle.density *= v / nativeMass
              handle.mass = v
            }
          } else {
            const [get, set] = methods[prop]
            if (typeof motion[get] !== 'function' || typeof motion[set] !== 'function')
              throw new Error(`Jolt: MotionProperties sin ${prop}`)
            getValue = () => motion[get]()
            setValue = v => motion[set](v)
          }
        } else {
          const [get, set] = methods[prop]
          if (typeof bi[get] !== 'function' || typeof bi[set] !== 'function')
            throw new Error(`Jolt: BodyInterface no admite ${prop} durante Timeline`)
          getValue = () => bi[get](handle.id)
          setValue = v => bi[set](handle.id, v)
        }
        if (!hasOverride) {
          if (record.id === handle.id) {
            setValue(record.before)
            if (prop === 'mass') {
              handle.mass = record.itemBefore
              handle.density = record.densityBefore
            }
          }
          this.timelineBodyValues.delete(key)
          continue
        }
        const value = channels[prop]
        if (prop === 'canSleep' ? typeof value !== 'boolean' : !Number.isFinite(value) || (prop === 'mass' && value <= 0))
          throw new RangeError(`Jolt: valor temporal inválido ${prop}`)
        const before = record?.id === handle.id ? record.before : getValue()
        const itemBefore = record?.id === handle.id ? record.itemBefore : prop === 'mass' ? handle.mass : null
        const densityBefore = record?.id === handle.id ? record.densityBefore : prop === 'mass' ? handle.density : null
        if (!record || record.id !== handle.id || record.last !== value) setValue(value)
        this.timelineBodyValues.set(key, { id: handle.id, before, last: value, itemBefore, densityBefore })
      }
    }
    // Los cuerpos que abandonaron la escena no pueden conservar snapshots nativos.
    for (const [key, record] of this.timelineBodyValues) {
      const [id] = JSON.parse(key)
      if (!this.play.project.objects.some(o => o.id === id) || !this.play.ed.nodes.has(id)) {
        this.timelineBodyValues.delete(key)
      }
    }
  }

  dispose() {
    if (this.play.phys?.nodeBodyRuntime === this) this.play.phys.nodeBodyRuntime = null
    this.spatial?.dispose()
    if (this.play.phys?.nodeSpatial === this.spatial) this.play.phys.nodeSpatial = null
    this.spatial = null
    const world = this.play.phys
    if (world && !world.disposed) for (const h of this.staticHandles) {
      world.byBody.delete(world._key(h.id))
      world.nodeHandles.delete(h.ownerId ?? h.node.userData?.id)
      world._free(h)
    }
    this.staticHandles = []
    this.timelineBodyValues.clear()
    this.timelineShapeValues.clear()
    this.shapeOwners = null
    this.bodyOwners = []
  }
}
