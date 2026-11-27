import * as THREE from 'three'
import { Vec3 } from '@century/fluids'
import { createWaterWorld, WaterHydrodynamics } from '@century/fluids/water'
import { VoxelSurfaceCache } from '@century/fluids/surface'
import { JoltFluidBridge, Quat } from '@century/fluids/adapters/jolt'
import { nodeEffectiveActive } from '../nodes/hierarchy.js'
import { WATER_DEFAULTS, resolveWaterBudgets, waterBodySearchBounds } from './water-policy.js'

const WATER = 'water'
const CENTER = new THREE.Vector3()
const ROTATION = new THREE.Quaternion()
const SCALE = new THREE.Vector3()
const vec = (v) => Vec3.of(v.x, v.y, v.z)
const quat = (q) => Quat.of(q.x, q.y, q.z, q.w)
const clamp = (n, min, max, fallback) => Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback

function volumeBounds(node, obj) {
  node.updateWorldMatrix(true, false)
  const size = obj.scale || [1, 1, 1]
  const transform = node.matrixWorld.clone().multiply(new THREE.Matrix4().makeScale(...size))
  return new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5)).applyMatrix4(transform)
}

function heightfield(piece) {
  if (!piece?.heights || !piece.n1 || !piece.nz1 || piece.enabled === false) return null
  return {
    kind: 'heightfield',
    origin: Vec3.of(piece.ox - piece.size / 2, piece.oy, piece.oz - (piece.depth ?? piece.size) / 2),
    columns: piece.n1, rows: piece.nz1,
    cellSizeXMeters: piece.size / piece.segments,
    cellSizeZMeters: (piece.depth ?? piece.size) / (piece.segmentsZ ?? piece.segments),
    heightsMeters: Array.from(piece.heights),
  }
}

function shapeBoundary(shape, node) {
  const spec = shape.props?.shape
  if (!spec || !node) return null
  node.updateWorldMatrix(true, false)
  node.matrixWorld.decompose(CENTER, ROTATION, SCALE)
  if (spec.type === 'BoxShape3D' && Array.isArray(spec.size) && spec.size.length === 3) {
    const half = spec.size.map((n, i) => Math.abs(n * SCALE.getComponent(i)) * 0.5)
    if (half.some(n => !(n > 0))) return null
    return { kind: 'box', center: vec(CENTER), halfExtents: Vec3.of(...half), rotation: quat(ROTATION) }
  }
  if (spec.type === 'SphereShape3D' && spec.radius > 0 && Math.abs(SCALE.x - SCALE.y) < 1e-5 && Math.abs(SCALE.y - SCALE.z) < 1e-5)
    return { kind: 'sphere', center: vec(CENTER), radiusMeters: spec.radius * Math.abs(SCALE.x) }
  return null
}

/** Adapter between Century's authored nodes, its single Jolt world and the independent voxel solver. */
export class CenturyWaterRuntime {
  constructor(play) {
    this.play = play
    this.world = null
    this.jolt = null
    this.surface = new VoxelSurfaceCache()
    this.tiles = new Map()
    this.boundaries = new Map()
    this.dynamic = new Set()
    this.filled = new Set()
    this.group = new THREE.Group()
    this.group.name = 'Century water surface'
    this.material = null
    this.limit = WATER_DEFAULTS.maxTriangles
    this.renderedRevision = -1
    this.surfacePending = false
    this.bodyCenter = new THREE.Vector3()
    this.closed = false
    this.lastError = null
  }

  start() {
    const objects = this.play.project.objects || []
    const water = objects.filter(o => o.type === WATER && nodeEffectiveActive(objects, o))
    if (!water.length) return false
    const budget = resolveWaterBudgets(water)
    this.limit = budget.maxTriangles
    this.world = createWaterWorld({ voxels: {
      cellSizeMeters: budget.cellSizeMeters, maxCells: budget.maxCells, maxFacesPerStep: 600000,
      sleepAtRest: true,
    } })
    this.jolt = new JoltFluidBridge(this.world, this.play.phys.J, this.play.phys.bi, new WaterHydrodynamics())
    const first = water[0]
    this.material = new THREE.MeshPhysicalMaterial({
      color: first.color || '#3b91b7', metalness: 0.05, roughness: 0.18,
      transparent: true, opacity: clamp(first.props?.opacity, 0.1, 1, WATER_DEFAULTS.opacity),
      depthWrite: false, side: THREE.DoubleSide,
    })
    this.play.ed.vp.scene.add(this.group)
    this.syncBoundaries()
    this.syncVolumes()
    this.render()
    return true
  }

  syncVolumes() {
    const objects = this.play.project.objects || []
    for (const obj of objects) {
      if (obj.type !== WATER || this.filled.has(obj.id) || !this.play._nodeEnabled(obj)) continue
      const node = this.play.ed.nodes.get(obj.id)
      if (!node) continue
      const box = volumeBounds(node, obj)
      const size = box.getSize(new THREE.Vector3())
      const fill = clamp(obj.props?.fill, 0, 1, WATER_DEFAULTS.fill)
      this.filled.add(obj.id)
      if (!fill || !(size.x > 0 && size.y > 0 && size.z > 0)) continue
      const volume = size.x * size.y * size.z * fill
      const min = vec(box.min), max = vec(box.max)
      this.world.fillBox({ min, max }, volume)
    }
  }

  syncBoundaries() {
    const active = new Set()
    const phys = this.play.phys
    const objects = this.play.project.objects || []
    for (const terrain of this.play.ed.terrains || []) {
      if (terrain.enabled === false || phys.terrain?.some(h => h.pieceId === terrain.id && !h.active)) continue
      const key = `terrain:${terrain.id}`
      active.add(key)
      const sig = [terrain.version, terrain.ox, terrain.oy, terrain.oz, terrain.size, terrain.depth].join('|')
      this.syncBoundary(key, sig, () => heightfield(terrain))
    }
    const shapesByBody = new Map()
    for (const shape of objects) {
      if (shape.type !== 'collisionshape3d' || !shape.parentId) continue
      if (!shapesByBody.has(shape.parentId)) shapesByBody.set(shape.parentId, [])
      shapesByBody.get(shape.parentId).push(shape)
    }
    for (const obj of objects) {
      if (obj.type !== 'staticbody3d' || !this.play._nodeEnabled(obj) || !phys.nodeHandles?.get(obj.id)?.active) continue
      for (const shape of shapesByBody.get(obj.id) || []) {
        if (shape.props?.disabled === true || !this.play._nodeEnabled(shape)) continue
        const node = this.play.ed.nodes.get(shape.id)
        if (!node) continue
        node.updateWorldMatrix(true, false)
        const key = `shape:${shape.id}`
        active.add(key)
        const sig = JSON.stringify([shape.props?.shape, node.matrixWorld.elements])
        this.syncBoundary(key, sig, () => shapeBoundary(shape, node))
      }
    }
    for (const [key, entry] of this.boundaries) {
      if (active.has(key)) continue
      this.world.removeBoundary(entry.id)
      this.boundaries.delete(key)
    }
  }

  syncBoundary(key, sig, build) {
    const current = this.boundaries.get(key)
    if (current?.signature === sig) return
    const input = build()
    if (!input) {
      if (current) { this.world.removeBoundary(current.id); this.boundaries.delete(key) }
      return
    }
    if (current) this.world.updateBoundary(current.id, input)
    else this.boundaries.set(key, { id: this.world.addBoundary(input), signature: sig })
    if (current) current.signature = sig
  }

  syncDynamics(dt) {
    const live = new Set()
    for (const item of this.play.phys.bodies?.items?.values() || []) {
      if (!item.active || !item.displacementSupported) continue
      const size = item.size
      if (!size || !(size.x > 0 && size.y > 0 && size.z > 0)) continue
      if (item.kind !== 'sphere' && item.kind !== 'box') continue
      // Do not register distant bodies as moving fluid boundaries. Recheck every
      // fixed step so a falling body couples as soon as it approaches wet voxels.
      const center = this.play.phys.bodies.centerOf?.(item, this.bodyCenter)
      const velocity = this.play.phys.bodies.velocityOf?.(item)
      const bounds = waterBodySearchBounds(center, size, velocity, dt, this.world.cellSizeMeters)
      if (bounds && !this.world.volumeInBox({ min: Vec3.of(...bounds.min), max: Vec3.of(...bounds.max) })) continue
      live.add(item.key)
      if (this.dynamic.has(item.key)) continue
      const shape = item.kind === 'sphere' ? { kind: 'sphere', radiusMeters: Math.min(size.x, size.y, size.z) / 2 } :
        { kind: 'box', halfExtents: Vec3.of(size.x / 2, size.y / 2, size.z / 2) }
      this.jolt.register({ id: item.id, motion: 'dynamic', shape,
        buoyancyScale: 1, linearDragKgPerSecond: 1.5 })
      this.dynamic.add(item.key)
    }
    for (const key of this.dynamic) if (!live.has(key)) {
      this.jolt.unregister(key)
      this.dynamic.delete(key)
    }
  }

  step(dt) {
    if (!this.world || this.closed) return
    try {
      this.syncBoundaries()
      this.syncVolumes()
      this.syncDynamics(dt)
      if (this.dynamic.size) this.jolt.step(dt)
      else if (this.world.needsStep) this.world.step(dt)
    } catch (error) {
      if (this.lastError !== error.message) {
        this.lastError = error.message
        this.play.rt.log?.(`Century Fluids: ${error.message}`, 'error', 'Agua')
      }
    }
  }

  render() {
    if (!this.world || this.closed) return
    if (!this.surfacePending && this.renderedRevision === this.world.revision) return
    let result
    try { result = this.surface.update(this.world, { maxTriangles: this.limit, maxChunks: 2, timeBudgetMs: 1.5 }) }
    catch (error) {
      if (this.lastError !== error.message) {
        this.lastError = error.message
        this.play.rt.log?.(`Superficie Century Fluids: ${error.message}`, 'error', 'Agua')
      }
      return
    }
    this.surfacePending = result.pending
    if (result.pending) return
    this.renderedRevision = result.revision
    for (const { key, mesh: data } of result.changes) {
      const old = this.tiles.get(key)
      if (old) { this.group.remove(old); old.geometry.dispose(); this.tiles.delete(key) }
      if (!data || !data.vertexCount || !data.triangleCount) continue
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(data.positionsXYZ, 3))
      geometry.setAttribute('normal', new THREE.BufferAttribute(data.normalsXYZ, 3))
      geometry.setIndex(new THREE.BufferAttribute(data.indices, 1))
      geometry.computeBoundingSphere()
      const tile = new THREE.Mesh(geometry, this.material)
      tile.renderOrder = 2
      tile.userData.helper = true
      this.group.add(tile)
      this.tiles.set(key, tile)
    }
  }

  dispose() {
    if (this.closed) return
    this.closed = true
    this.jolt?.shutdown()
    this.jolt = null
    for (const tile of this.tiles.values()) tile.geometry.dispose()
    this.tiles.clear()
    this.group.clear()
    this.group.removeFromParent()
    this.material?.dispose()
    this.material = null
    this.surface.reset()
    this.world?.shutdown()
    this.world = null
    this.boundaries.clear()
    this.dynamic.clear()
    this.filled.clear()
  }
}
