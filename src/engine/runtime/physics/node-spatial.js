// CharacterBody3D y Area3D sobre el JoltWorld de PlayMode.
// Solo interpreta el árbol físico; las páginas de eventos no participan en este módulo.
import * as THREE from 'three'
import { getNativeSignal } from '../nodes/registry.js'
import { validatePhysicsTree, validatePhysicsShape, effectiveCollisionShape } from './shapes.js'
import { createVirtualCharacter, createVirtualCharacterShape } from './jolt-character.js'

const P = new THREE.Vector3(), Q = new THREE.Quaternion(), S = new THREE.Vector3()

/** Planifica personajes y áreas sin crear un segundo árbol ni modificar el proyecto. */
export function spatialNodePlan(objects) {
  const byId = new Map(objects.map((o) => [o.id, o]))
  if (objects.length !== byId.size) throw new Error('La escena contiene IDs duplicados')
  validatePhysicsTree(byId)
  const entries = []
  for (const obj of objects) {
    if (!['characterbody3d', 'area3d'].includes(obj.type)) continue
    const shapes = objects.filter((o) => o.parentId === obj.id && o.type === 'collisionshape3d' && o.props?.disabled !== true)
    if (shapes.length) entries.push({ obj, shapes })
  }
  return entries
}

/** La instancia de personaje está separada del CharacterVirtual del jugador FPS. */
export class NodeSpatialRuntime {
  constructor(play, assembleShape) {
    this.play = play
    this.assembleShape = assembleShape
    this.characters = new Map()
    this.areas = new Map()
    this.listeners = new Map()
    this.timelineCharacterValues = new Map()
    this.timelineCollisionValues = new Map()
    this.disposed = false
  }

  start(onlyIds = null) {
    const world = this.play.phys
    if (!world || this.disposed) return
    const plans = spatialNodePlan(this.play.project.objects)
    const created = new Set()
    try {
      for (const { obj, shapes } of plans) {
        if (onlyIds && !onlyIds.has(obj.id)) continue
        if (this.characters.has(obj.id) || this.areas.has(obj.id)) throw new Error(`Cuerpo físico duplicado: ${obj.id}`)
        const node = this.play.ed.nodes.get(obj.id)
        if (!node) throw new Error(`SceneGraph no contiene ${obj.name || obj.id}`)
        const entries = shapes.map((shape) => ({ obj: shape, node: this.play.ed.nodes.get(shape.id) }))
        if (entries.some((e) => !e.node)) throw new Error(`CollisionShape3D no construida en ${obj.name}`)
        if (obj.type === 'characterbody3d') {
          const capsule = shapes[0].props.shape
          node.updateWorldMatrix(true, false)
          node.matrixWorld.decompose(P, Q, S)
          const settings = obj.props
          const instance = createVirtualCharacter(world, {
            position: P, radius: capsule.radius, height: capsule.height,
            mass: settings.mass, slope: settings.maxSlopeAngle,
          })
          this.characters.set(obj.id, {
            obj, node, ...instance, velocity: [...settings.velocity], ground: 'air',
            onFloor: false, onWall: false, onCeiling: false,
          })
        } else {
          const assembled = this.assembleShape(node, entries)
          if (!assembled) continue
          try {
            node.updateWorldMatrix(true, false)
            node.matrixWorld.decompose(P, Q, S)
            const id = world._body(assembled.shape, P, Q, false, true)
            const key = world._key(id)
            const area = { obj, node, id, key, shape: assembled.shape, ownsShape: assembled.owned, previous: new Map(), active: true }
            this.areas.set(obj.id, area)
            world.byBody.set(key, { area: true, areaId: obj.id })
          } catch (error) { if (assembled.owned) assembled.shape.Release(); throw error }
        }
        created.add(obj.id)
      }
    } catch (e) {
      this.remove(created)
      if (!onlyIds) this.dispose()
      throw e
    }
  }

  /** Elimina únicamente las instancias físicas indicadas, sin reiniciar Jolt. */
  remove(ids) {
    const world = this.play.phys
    for (const id of ids) {
      const area = this.areas.get(id)
      if (area) {
        if (world && !world.disposed) {
          world.byBody.delete(area.key)
          if (area.active) world._free(area)
        }
        if (area.ownsShape) area.shape.Release()
        this.areas.delete(id)
      }
      const body = this.characters.get(id)
      if (body) {
        if (world && !world.disposed) world.J.destroy(body.character)
        body.shape.Release()
        this.characters.delete(id)
      }
      for (const key of [...this.listeners.keys()]) if (key.startsWith(`${id}:`)) this.listeners.delete(key)
      this.timelineCollisionValues.delete(id)
      for (const key of [...this.timelineCharacterValues.keys()]) if (key.startsWith(`["${id}",`)) this.timelineCharacterValues.delete(key)
    }
  }

  /** Aplicar el cuerpo de Database solo al jugador designado; conserva CharacterVirtual. */
  configurePlayerShape(id, cfg, { allowBlocked = false } = {}) {
    const body = this.characters.get(id)
    const world = this.play.phys
    if (!body || !world || world.disposed || this.disposed) throw new Error('Jugador nativo: cuerpo Jolt inexistente')
    const radius = cfg.radius, height = cfg.height
    if (!Number.isFinite(radius) || !Number.isFinite(height) || radius <= 0 || height < radius * 2)
      throw new RangeError('Jugador nativo: cápsula inválida')
    const previous = body.playerCapsule
    if (previous?.radius === radius && previous?.height === height) return true
    if (typeof body.character.SetShape !== 'function') throw new Error('Jolt: CharacterVirtual.SetShape no disponible')
    const shape = createVirtualCharacterShape(world, { radius, height })
    try {
      const accepted = body.character.SetShape(shape, .03, world.bpFilter, world.objFilter,
        world.bodyFilter, world.shapeFilter, world.jolt.GetTempAllocator())
      if (!accepted && allowBlocked) { shape.Release(); return false }
      if (!accepted) throw new Error('Jugador nativo: cápsula rechazada por interpenetración')
      const old = body.shape
      body.shape = shape
      body.playerCapsule = { radius, height }
      old.Release()
      return true
    } catch (error) { if (body.shape !== shape) shape.Release(); throw error }
  }

  /** Permite a un futuro script asignar velocidad sin alterar las props persistidas. */
  setVelocity(id, velocity) {
    const c = this.characters.get(id)
    if (!c) throw new Error(`CharacterBody3D inexistente: ${id}`)
    if (!Array.isArray(velocity) || velocity.length !== 3 || !velocity.every(Number.isFinite)) throw new Error('Velocidad XYZ inválida')
    c.velocity = [...velocity]
  }

  characterState(id) {
    const c = this.characters.get(id)
    return c ? { position: c.node.getWorldPosition(new THREE.Vector3()).toArray(), velocity: [...c.velocity],
      ground: c.ground, onFloor: c.onFloor, onWall: c.onWall, onCeiling: c.onCeiling } : null
  }

  /** Una transformación explícita del nodo teletransporta su cápsula Jolt. */
  syncCharacter(character) {
    const world = this.play.phys
    character.node.updateWorldMatrix(true, false)
    character.node.matrixWorld.decompose(P, Q, S)
    world.tmp.r.Set(P.x, P.y, P.z)
    character.character.SetPosition(world.tmp.r)
  }

  /** Fuente física única para las conexiones de Scripts de Nodo. */
  onArea(id, signal, callback) {
    if (!this.areas.has(id)) throw new Error(`Area3D inexistente: ${id}`)
    if (getNativeSignal('area3d', signal)?.source !== 'jolt-area') throw new Error('Señal Area3D inválida')
    if (typeof callback !== 'function') throw new TypeError('Callback inválido')
    const key = `${id}:${signal}`
    if (!this.listeners.has(key)) this.listeners.set(key, new Set())
    this.listeners.get(key).add(callback)
    return () => this.listeners.get(key)?.delete(callback)
  }

  overlaps(id) {
    const area = this.areas.get(id)
    return area ? [...area.previous.values()].map((v) => ({ ...v })) : []
  }

  _notify(id, signal, other) {
    for (const callback of this.listeners.get(`${id}:${signal}`) || []) {
      try { callback({ areaId: id, ...other }) }
      catch (e) { console.error(`Area3D ${id} ${signal}`, e) }
    }
  }

  syncArea(area) {
    const world = this.play.phys
    if (!world || world.disposed || !area.active) return
    area.node.updateWorldMatrix(true, false)
    area.node.matrixWorld.decompose(P, Q, S)
    world.tmp.r.Set(P.x, P.y, P.z); world.tmp.q.Set(Q.x, Q.y, Q.z, Q.w)
    world.bi.SetPositionAndRotation(area.id, world.tmp.r, world.tmp.q, world.J.EActivation_DontActivate)
  }

  /** Valores efectivos de Jolt; no modifica props guardadas del proyecto. */
  _effectiveSpatial(obj) {
    const overrides = this.play.ed.nodes.get(obj.id)?.userData?.timelineSpatial
    return overrides ? { ...(obj.props || {}), ...overrides } : obj.props || {}
  }

  /** Una clave de velocidad se aplica una vez por cambio de valor, no reinicia
   *  la aceleración vertical de Jolt en cada subpaso.
   */
  syncTimelineVelocity(character) {
    const wanted = character.node.userData.timelineSpatial?.velocity
    const signature = Array.isArray(wanted) ? wanted.join(',') : null
    if (signature === character.timelineVelocitySignature) return
    if (signature !== null) {
      if (character.timelineVelocitySignature == null) character.timelineVelocityBefore = [...character.velocity]
      this.setVelocity(character.obj.id, wanted)
    } else if (character.timelineVelocityBefore) {
      this.setVelocity(character.obj.id, character.timelineVelocityBefore)
      delete character.timelineVelocityBefore
    }
    character.timelineVelocitySignature = signature
  }

  /** Aplica masa y pendiente de CharacterVirtual sin reconstruir su cápsula.
   *  También restaura al detener Timeline aunque el mundo esté pausado.
   */
  syncTimelineCharacterPhysics() {
    for (const character of this.characters.values()) {
      const visual = character.node.userData.timelineSpatial || {}
      const native = character.character
      for (const prop of ['maxSlopeAngle', 'mass']) {
        const key = JSON.stringify([character.obj.id, prop])
        const record = this.timelineCharacterValues.get(key)
        const present = Object.hasOwn(visual, prop)
        if (!present && !record) continue
        const read = prop === 'mass' ? () => native.GetMass()
          : () => Math.acos(Math.max(-1, Math.min(1, native.GetCosMaxSlopeAngle()))) * 180 / Math.PI
        const apply = prop === 'mass' ? v => native.SetMass(v) : v => native.SetMaxSlopeAngle(v * Math.PI / 180)
        if (!present) {
          apply(record.before)
          this.timelineCharacterValues.delete(key)
          continue
        }
        const value = visual[prop]
        if (!Number.isFinite(value) || (prop === 'mass' && value <= 0) || (prop === 'maxSlopeAngle' && (value < 0 || value > 89)))
          throw new RangeError(`CharacterBody3D: valor temporal inválido ${prop}`)
        const before = record ? record.before : read()
        if (!record || record.last !== value) apply(value)
        this.timelineCharacterValues.set(key, { before, last: value })
      }
    }
  }

  isTimelineShapeDisabled(id) {
    const shapes=this.play.project.objects.filter(o=>o.type==='collisionshape3d'&&o.parentId===id)
    return !!shapes.length && shapes.every(o=>effectiveCollisionShape(o,this.play.ed.nodes.get(o.id)).props.disabled===true)
  }

  /** Los sensores y CharacterVirtual siguen siendo propiedad de NodeSpatialRuntime.
   * Se cambia Shape sobre la misma instancia sin reconstruir el nodo. */
  syncTimelineCollisionShapes() {
    const world = this.play.phys
    if (!world || world.disposed || this.disposed) return
    const objects=this.play.project.objects,nodes=this.play.ed.nodes
    for (const entry of [...this.characters.values(),...this.areas.values()]) {
      const entries=objects.filter(o=>o.type==='collisionshape3d'&&o.parentId===entry.obj.id)
        .map(obj=>({obj:effectiveCollisionShape(obj,nodes.get(obj.id)),node:nodes.get(obj.id)}))
      const overridden=entries.some(({node})=>Object.keys(node?.userData?.timelineCollision||{}).length)
      const previous=this.timelineCollisionValues.get(entry.obj.id)
      if (!overridden && !previous) continue
      if (entries.some(({node})=>!node)) throw new Error(`CollisionShape3D: falta nodo de ${entry.obj.id}`)
      for(const {obj} of entries)validatePhysicsShape(obj.props.shape)
      const signature=JSON.stringify(entries.map(({obj})=>[obj.id,obj.props.disabled===true,obj.props.shape]))
      if(previous?.signature===signature)continue
      const enabled=entries.filter(({obj})=>obj.props.disabled!==true)
      if(entry.character) {
        if(enabled.length>1 || (enabled.length&&enabled[0].obj.props.shape.type!=='CapsuleShape3D'))
          throw new Error('CharacterBody3D: requiere una sola CapsuleShape3D habilitada')
        if(enabled.length){
          if(typeof entry.character.SetShape!=='function')throw new Error('Jolt: CharacterVirtual.SetShape no disponible')
          const shape=enabled[0].obj.props.shape
          const replacement=createVirtualCharacterShape(world,shape)
          try {
            const ok=entry.character.SetShape(replacement,.03,world.bpFilter,world.objFilter,world.bodyFilter,world.shapeFilter,world.jolt.GetTempAllocator())
            if(!ok)throw new Error('CharacterBody3D: forma rechazada por interpenetración')
            const former=entry.shape
            entry.shape=replacement
            former.Release()
          } catch(error) { if(entry.shape!==replacement)replacement.Release(); throw error }
        }
        entry.timelineCollisionDisabled=!enabled.length
      } else {
        if (!enabled.length){
          if (entry.active){world.bi.RemoveBody(entry.id);entry.active=false}
        } else {
          if(typeof world.bi.SetShape!=='function')throw new Error('Jolt: BodyInterface.SetShape no disponible')
          const assembled=this.assembleShape(entry.node,enabled,true)
          if(!assembled)throw new Error('Area3D: forma temporal inválida')
          try {
            world.bi.SetShape(entry.id,assembled.shape,false,world.J.EActivation_DontActivate)
            const oldShape=entry.shape,oldOwned=entry.ownsShape
            entry.shape=assembled.shape;entry.ownsShape=assembled.owned
            if(oldOwned)oldShape.Release()
            if(!entry.active && this.play._nodeEnabled?.(entry.obj)!==false){
              world.bi.AddBody(entry.id,world.J.EActivation_DontActivate);entry.active=true
            }
          } catch(error) { if(entry.shape!==assembled.shape && assembled.owned)assembled.shape.Release();throw error }
        }
      }
      if(overridden)this.timelineCollisionValues.set(entry.obj.id,{signature})
      else this.timelineCollisionValues.delete(entry.obj.id)
    }
  }

  /** Se invoca una vez por paso de Jolt; no crea un loop propio. */
  tick(dt) {
    if (this.disposed || !(dt > 0)) return
    const world = this.play.phys, J = world.J
    this.syncTimelineCharacterPhysics()
    for (const c of this.characters.values()) {
      if (!this.play._nodeEnabled(c.obj) || c.timelineCollisionDisabled) continue
      this.syncTimelineVelocity(c)
      const v = c.velocity, instance = c.character
      const wasGround = instance.GetGroundState() === J.EGroundState_OnGround
      const gv = wasGround ? instance.GetGroundVelocity() : null
      const spatial = this._effectiveSpatial(c.obj)
      const playerConfig = c.obj.id === this.play._nativePlayerId ? this.play.g : null
      const jumpGravity = playerConfig
        ? playerConfig.jumpAuto ? 2 * playerConfig.jumpHeight / (playerConfig.jumpTime ** 2) : playerConfig.gravity
        : spatial.gravity
      const gravity = playerConfig ? jumpGravity * (this.play.level?.gravityScale ?? 1) : jumpGravity
      if (playerConfig && c.node.userData?.timelineSpatial?.maxSlopeAngle == null) {
        const slope = playerConfig.slopeLimit
        if (c.playerSlope !== slope) { instance.SetMaxSlopeAngle(slope * Math.PI / 180); c.playerSlope = slope }
      }
      // Solo el jugador nativo consume la gravedad/caída de Database.
      // Los demás CharacterBody3D conservan los valores autorales de sus nodos.
      const fallMultiplier = playerConfig && v[1] < 0 ? playerConfig.fallGravity : 1
      const vertical = wasGround && v[1] <= 0 ? 0 : Math.max(playerConfig ? -playerConfig.terminalSpeed : -Infinity,
        v[1] - gravity * fallMultiplier * dt)
      world.tmp.v.Set(v[0] + (gv ? gv.GetX() : 0),
        vertical + (gv ? gv.GetY() : 0), v[2] + (gv ? gv.GetZ() : 0))
      instance.SetLinearVelocity(world.tmp.v)
      world.tmp.v2.Set(0, -gravity, 0)
      world.update.mWalkStairsStepUp.Set(0, playerConfig ? this.play.game.db.player.stepHeight : spatial.stepHeight, 0)
      world.update.mStickToFloorStepDown.Set(0, -spatial.floorSnap, 0)
      instance.ExtendedUpdate(dt, world.tmp.v2, world.update, world.bpFilter, world.objFilter,
        world.bodyFilter, world.shapeFilter, world.jolt.GetTempAllocator())
      const state = instance.GetGroundState()
      const n = state === J.EGroundState_InAir ? null : instance.GetGroundNormal()
      c.onFloor = state === J.EGroundState_OnGround
      c.onWall = state === J.EGroundState_OnSteepGround && !!n && Math.abs(n.GetY()) < 0.5
      c.onCeiling = state === J.EGroundState_OnSteepGround && !!n && n.GetY() < -0.5
      c.ground = c.onFloor ? 'stable' : state === J.EGroundState_OnSteepGround ? 'steep' : 'air'
      const p = instance.GetPosition()
      c.velocity[1] = c.onFloor && vertical <= 0 ? 0 : instance.GetLinearVelocity().GetY()
      const parent = c.node.parent
      if (parent) {
        parent.updateWorldMatrix(true, false)
        c.node.position.copy(parent.worldToLocal(P.set(p.GetX(), p.GetY(), p.GetZ())))
      } else c.node.position.set(p.GetX(), p.GetY(), p.GetZ())
      c.node.updateMatrixWorld(true)
    }
    this._pollAreas()
  }

  /** Consulta cuerpos y sensores con el narrow phase existente de Jolt. */
  _pollAreas() {
    const world = this.play.phys
    for (const area of this.areas.values()) {
      const current = new Map()
      if (this._effectiveSpatial(area.obj).monitoring && area.active) {
        this.syncArea(area)
        const pose = world.bi.GetWorldTransform(area.id)
        const query = world.sys.GetNarrowPhaseQuery()
        world._hits.clear()
        // Filtro móvil: static + moving; filtro sensor: Area3D (también triggers ajenos).
        query.CollideShape(area.shape, world.one, pose, world.collideSettings, world.zero,
          world.collector, world.anyBp, world.objFilter, world.bodyFilter, world.shapeFilter)
        query.CollideShape(area.shape, world.one, pose, world.collideSettings, world.zero,
          world.collector, world.anyBp, world.sensorFilter, world.bodyFilter, world.shapeFilter)
        for (const key of world._hits) {
          if (key === area.key) continue
          const item = world.byBody.get(key)
          if (item?.area && item.areaId !== area.obj.id) {
            const other = this.areas.get(item.areaId)
            if (other && this._effectiveSpatial(other.obj).monitorable && other.active) current.set(`a:${item.areaId}`, { type: 'area', id: item.areaId })
          } else if (item && !item.sensor && !item.terrain) {
            current.set(`b:${key}`, { type: 'body', id: item.node || String(key) })
          }
        }
        // CharacterVirtual no es un BodyID de Jolt: se consulta explícitamente como cápsula.
        const characters = [...this.characters.values()].filter((c) => this.play._nodeEnabled(c.obj) && !c.timelineCollisionDisabled)
        if (world.char && world.charShape) characters.push({ obj: { id: '@player' }, character: world.char, shape: world.charShape })
        for (const ch of characters) {
          world._hits.clear()
          query.CollideShape(ch.shape, world.one, ch.character.GetCenterOfMassTransform(),
            world.collideSettings, world.zero, world.collector, world.anyBp,
            world.sensorFilter, world.bodyFilter, world.shapeFilter)
          if (world._hits.has(area.key)) current.set(`c:${ch.obj.id}`, { type: 'body', id: ch.obj.id })
        }
      }
      for (const [key, other] of current) if (!area.previous.has(key)) this._notify(area.obj.id, other.type === 'area' ? 'area_entered' : 'body_entered', other)
      for (const [key, other] of area.previous) if (!current.has(key)) this._notify(area.obj.id, other.type === 'area' ? 'area_exited' : 'body_exited', other)
      area.previous = current
    }
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    const world = this.play.phys
    if (world && !world.disposed) for (const area of this.areas.values()) {
      world.byBody.delete(area.key)
      if (area.active) world._free(area)
      area.active = false
    }
    for (const area of this.areas.values()) if (area.ownsShape) area.shape.Release()
    if (world) for (const c of this.characters.values()) {
      world.J.destroy(c.character)
      c.shape.Release()
    }
    this.characters.clear()
    this.areas.clear()
    this.listeners.clear()
    this.timelineCharacterValues.clear()
    this.timelineCollisionValues.clear()
  }
}
