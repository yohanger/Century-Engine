// Detalle adaptativo en el modo Jugar: LOD del terreno (por índices), de las mallas pesadas (por simplificación) y culling.
// La vegetación se trocea en chunks dentro de foliage.js (enterPlay / updatePlay). Todo se deshace al salir de Jugar (detach).
// La lógica de decisión está en lod.js (pura y probada); aquí solo se toca three.
import * as THREE from 'three'
import { terrainIndex, terrainStrides, pickStride, lodRatios, pickLevel, pickErrorLod, distToBox } from './lod.js'
import { lodBufferGeometry, lodTransferables, serializeLodGeometry, trianglesOf, simplifiable } from './lodgeo.js'
import { ClusterMeshes } from './cluster-mesh.js'
import { terrainBakePlan } from './terrain-bake.js'
import { StaticBatcher } from './static-batch.js'
import LodWorker from './lod.worker.js?worker&inline'

const MIN_MESH_TRIS = 1500   // por debajo no merece la pena
const TERRAIN_PX = 6         // lado de celda del terreno (px) a partir del cual sobra detalle
const MESH_PX = 4            // lado de triángulo de las mallas (px)

export class LodManager {
  /** @param {object} scene SceneGraph (visor, terrenos, nodos y proyecto)  @param {{ lodQuality?: number, drawDistance?: number }} cfg */
  constructor(scene, cfg = {}) {
    this.vp = scene.vp; this.ed = scene
    this.editorDiagnostics = cfg.editorDiagnostics === true
    this.enableLod = cfg.lod !== false
    this.meshErrorLod = cfg.meshErrorLod === true
    this.indexedLevels = new Map()
    this.enableBatching = !this.editorDiagnostics && cfg.batchStatic === true
    this.batcher = null
    this.quality = Math.max(0.25, cfg.lodQuality || 1)
    this.clusters = new ClusterMeshes(this.vp, this.quality) // nativo en Edit/Play, sin activar flags del proyecto
    this.drawScale = Math.max(0.25, cfg.drawDistance || 1)
    this.terrains = []   // { t, mesh, strides, idx: Map, orig, cur, box, wasCulled }
    this.meshes = []     // LOD actual de cada instancia
    this.meshLevels = new Map() // una sola copia de cada nivel por BufferGeometry original
    this._worker = null
    this._job = null
    this._workerUnavailable = false
    this._dirty = false
    this._lastFocal = 0
    this.foliages = []
    this._last = new THREE.Vector3(1e9, 0, 0)
    this._frame = 0
    this.stats = { swaps: 0, culled: 0, chunks: 0 }
    this._p = new THREE.Vector3(); this._c = new THREE.Vector3()
    this._lastForward = new THREE.Vector3()
    this._forward = new THREE.Vector3()
    this._worldSphere = new THREE.Sphere()
    this._frustum = new THREE.Frustum()
    this._vpMatrix = new THREE.Matrix4()
  }

  attach() {
    if (!this.editorDiagnostics && this.vp._editorDiagnosticLod) {
      this.vp._editorDiagnosticLod.detach() // Play toma la única autoridad LOD
      this.vp._editorDiagnosticLod = null
      this.ed._viewDiagnosticLod = null
    }
    this.vp.lodManager = this
    this._workerUnavailable = false
    if (this.enableBatching) {
      this.batcher = new StaticBatcher(this.ed)
      this.batcher.attach() // nunca modifica la autoría; originales ocultos solo en Play
    }
    for (const t of this.ed.terrains) {
      if (!t.mesh) continue
      t.mesh.userData._lfNativeTerrain = true
      // El terreno se agrupa cuando la geometría es apta; si no, conserva su LOD de índices.
      const accepted = this.clusters.add(t.mesh, { terrain: t })
      if (!accepted) this._addTerrain(t)
    }
    if (this.enableLod && !this.editorDiagnostics) for (const t of this.ed.terrains) { t.foliage.enterPlay(); this.foliages.push(t.foliage) }
    const objs = (this.ed.host.project?.objects) || []
    for (const o of objs) {
      if (!['model','mesh','primitive','road','nature'].includes(o.type)) continue
      const node = this.ed.nodes?.get(o.id)
      const visual = node?.userData.visual ?? node
      const visit = (mesh) => {
        if (mesh !== visual && mesh.userData.kind === 'object') return
        if (mesh.visible && mesh.isMesh && !mesh.userData.helper) {
          const accepted = this.clusters.add(mesh)
          // El LOD legado conserva su selección en geometrías de dibujo directo.
          // ClusterMeshes observa su nivel efectivo, pero no modifica el índice si existe dueño LOD.
          if (this.enableLod && (!accepted || this.clusters.byMesh.get(mesh)?.direct)) {
            const legacy = this.addMesh(mesh, true)
            if (accepted && legacy) this.clusters.byMesh.get(mesh).legacyManaged = true
          }
        }
        mesh.children.forEach(visit)
      }
      if (visual) visit(visual)
    }
    this._last.set(1e9, 0, 0)
  }

  _addTerrain(t) {
    const mesh = t.mesh
    if (!mesh) return
    const geo = mesh.geometry, strides = terrainStrides(t.segments, t.terrainBake ? 64 : 8, t.segmentsZ)
    geo.computeBoundingBox(); geo.computeBoundingSphere()
    mesh.updateMatrixWorld(true)
    const box = new THREE.Box3().copy(geo.boundingBox).applyMatrix4(mesh.matrixWorld)
    this.terrains.push({ t, mesh, geometry: geo, strides, idx: new Map(), orig: geo.index, cur: 1, box, wasCulled: mesh.frustumCulled })
    mesh.frustumCulled = true // una pieza fuera de pantalla no se dibuja (en el editor se deja siempre dibujada)
  }

  _reconcileEditor() {
    if (!this.editorDiagnostics) return
    // Los pinceles editan atributos en sitio; los cambios de tamaño reconstruyen BufferGeometry.
    for (const t of this.ed.terrains) {
      if (!t.mesh) continue
      t.mesh.userData._lfNativeTerrain = true
      this.clusters.sync(t.mesh, { terrain: t })
      const previous = this.terrains.find(x => x.mesh === t.mesh)
      if (previous && previous.geometry !== t.mesh.geometry) {
        previous.mesh.frustumCulled = previous.wasCulled
        this.terrains.splice(this.terrains.indexOf(previous), 1)
      }
      if ((!previous || previous.geometry !== t.mesh.geometry) && !this.clusters.byMesh.has(t.mesh))
        this._addTerrain(t)
    }
    const revision = this.ed._clusterGraphRevision || 0
    if (revision === this._seenGraphRevision) return
    this._seenGraphRevision = revision
    for (const [id, node] of this.ed.nodes) {
      const o = this.ed.host.getObject(id)
      if (!o || !['model','mesh','primitive','road','nature'].includes(o.type)) continue
      const visual = node.userData.visual ?? node
      const visit = mesh => {
        if (mesh !== visual && mesh.userData.kind === 'object') return
        if (mesh.isMesh && mesh.visible && !mesh.userData.helper) {
          this.clusters.sync(mesh)
          if (this.enableLod && this.clusters.byMesh.get(mesh)?.direct &&
              !this.meshes.some(e => e.mesh === mesh && e.mesh.geometry === e.set.levels[e.cur].geo))
            this.addMesh(mesh, true)
        }
        mesh.children.forEach(visit)
      }
      visit(visual)
    }
  }

  /** Registra una malla para LOD si es lo bastante pesada. Devuelve si se registró. */
  addMesh(m, indexed = false) {
    if (!m.visible || !m.isMesh || m.isInstancedMesh || m.isSkinnedMesh || !m.geometry || m.userData.helper || m.userData.isHelper) return false
    const mat = m.material
    const g = m.geometry
    // El simplificador conserva atributos, pero no los rangos de grupos ni los desplazamientos de un material.
    if (!mat || Array.isArray(mat) || mat.wireframe || mat.lightMap || mat.displacementMap ||
        !simplifiable(g) || g.drawRange.start || g.drawRange.count < trianglesOf(g) * 3) return false
    if (mat.isShaderMaterial || mat.isRawShaderMaterial) return false
    indexed = true // todas las mallas usan error geométrico; nunca agrupar superficies por proximidad
    const cache = indexed ? this.indexedLevels : this.meshLevels
    let set = cache.get(g)
    if (!set) {
      const tris = trianglesOf(g)
      const ratios = lodRatios(tris, MIN_MESH_TRIS)
      if (ratios.length < 2) return false
      if (!g.boundingSphere) g.computeBoundingSphere()
      set = indexed
        ? { ratios: ratios.slice(1), ready: false, levels: [{ geo: g, error: 0 }] }
        : { lodTriangles: ratios.map(r => Math.round(tris * r)), levels: ratios.map((ratio, i) => ({ ratio, geo: i === 0 ? g : null })) }
      cache.set(g, set)
    }
    this.meshes.push({ mesh: m, base: g, set, indexed, cur: 0 })
    this._dirty = true
    return true
  }

  _buildLevel(base, level, indexedSet) {
    if (this._job || this._workerUnavailable) return
    try {
      if (!this._worker) {
        const worker = new LodWorker()
        this._worker = worker
        worker.onmessage = ({ data }) => {
          if (this._worker !== worker || !this._job) return
          const job = this._job
          this._job = null
          if (job.indexedSet) {
            for (const result of data || []) {
              const geo = lodBufferGeometry(job.base, result)
              if (geo) job.indexedSet.levels.push({ geo, error: result.error })
            }
            job.indexedSet.ready = true
          } else {
            job.level.geo = lodBufferGeometry(job.base, data) || job.base
          }
          this._dirty = true
          this.vp.requestRender()
        }
        worker.onerror = () => this._stopWorker()
        worker.onmessageerror = () => this._stopWorker()
      }
      const input = serializeLodGeometry(base)
      this._job = { base, level, indexedSet }
      this._worker.postMessage({ input, ratio: level?.ratio, ratios: indexedSet?.ratios }, lodTransferables(input))
    } catch {
      this._stopWorker()
    }
  }

  _stopWorker() {
    this._worker?.terminate()
    this._worker = null
    this._job = null
    this._workerUnavailable = true
  }

  /** Presupuesto transitorio: reutiliza niveles existentes y fuerza selección incluso con cámara inmóvil. */
  setBudgetQuality(quality) {
    if (this.quality === quality) return
    this.quality = quality
    this.clusters.quality = quality
    this._dirty = true
  }

  /** Actualiza la selección por cámara y publica los niveles terminados por el worker. */
  update(cam) {
    if (this.vp.nativeBackend?.active) {
      // WebGPU conserva selección de Terrain en la ruta CPU segura; el resto lo gestiona su backend.
      this.clusters?.update(cam, performance.now(), {terrainOnly: true})
      return
    }
    this._reconcileEditor()
    this.clusters?.update(cam, performance.now())
    if (!this.enableLod) return
    this._frame++
    cam.getWorldPosition(this._p)
    const height = this.vp.renderer.domElement.height || 720
    const fullFocal = cam.projectionMatrix.elements[5] * height * 0.5
    const focal = cam.projectionMatrix.elements[5] * (this.vp.look?.scenePixelHeight || height) * 0.5
    this._forward.setFromMatrixColumn(cam.matrixWorld, 2).normalize()
    const rotated = this._forward.dot(this._lastForward) < 0.9998
    if (!this._dirty && !rotated && focal === this._lastFocal && this._p.distanceToSquared(this._last) < 0.09 && this._frame % 45) return
    this._lastForward.copy(this._forward)
    this._dirty = false
    this._lastFocal = focal
    this._last.copy(this._p)
    let swaps = 0
    for (const s of this.terrains) {
      if (s.strides.length < 2) continue
      const bakeRevision = s.t.version
      if (s.t.terrainBake && bakeRevision !== s.bakeRevision) {
        if(s.t.bakeInfo && s.t._bakeVersion===bakeRevision) {
          s.bakePlan=s.t.bakeInfo
          s.bakeRevision=bakeRevision
          s.idx.clear()
          this._setTerrainIndex(s)
        } else if(s.bakeTaskRevision!==bakeRevision) {
          if (s.bakePlan) {
            // Nunca continuar dibujando índices derivados de un relieve ya editado.
            s.bakePlan=null
            this._setTerrainIndex(s)
          }
          s.bakeTask?.abort()
          const controller=new AbortController()
          s.bakeTask=controller;s.bakeTaskRevision=bakeRevision
          import('./trianghor/worker-client.js').then(({bakeTerrainOffThread})=>
            bakeTerrainOffThread(s.t,s.t.terrainBake,controller.signal)).then(plan=>{
            if(controller.signal.aborted || s.t.version!==bakeRevision || s.mesh.geometry!==s.geometry) return
            s.t.bakeInfo=plan;s.t._bakeVersion=bakeRevision
            this._dirty=true;this.vp.requestRender()
          }).catch(error=>{if(!controller.signal.aborted)console.warn('TriangHor LOD',error)})
            .finally(()=>{if(s.bakeTask===controller)s.bakeTask=null})
        }
      } else if (!s.t.terrainBake) { s.bakeTask?.abort();s.bakePlan = null; s.bakeRevision = null; s.t.bakeInfo = null }
      const d = distToBox(this._p.x, this._p.z, s.box.min.x, s.box.min.z, s.box.max.x, s.box.max.z)
      const next = Math.max(s.bakePlan?.stride || 1, pickStride(Math.max(s.t.step, s.t.depth / s.t.segmentsZ), Math.hypot(d, Math.max(0, this._p.y - s.box.max.y)), focal, TERRAIN_PX / this.quality, s.strides, s.cur))
      if (next !== s.cur) { s.cur = next; this._setTerrainIndex(s) }
      if (s.cur > 1) swaps++
    }
    this._frustum.setFromProjectionMatrix(this._vpMatrix.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse))
    for (const e of this.meshes) {
      const { levels } = e.set
      if (e.mesh.geometry !== levels[e.cur].geo) continue
      e.mesh.updateWorldMatrix(true, false)
      const sphere = e.base.boundingSphere, world = e.mesh.matrixWorld
      this._c.copy(sphere.center).applyMatrix4(world)
      const scale = world.getMaxScaleOnAxis()
      const radius = sphere.radius * scale
      if (e.indexed && !e.set.ready && !this._workerUnavailable && !this._job) {
        this._worldSphere.set(this._c, radius)
        if (e.mesh.visible && this._frustum.intersectsSphere(this._worldSphere)) this._buildLevel(e.base, null, e.set)
      }
      const dist = cam.isOrthographicCamera ? 1 : Math.max(this._c.distanceTo(this._p), radius * 0.5)
      const near = cam.isOrthographicCamera ? 1 : Math.max(cam.near, dist - radius)
      const next = e.indexed
        ? pickErrorLod(levels, scale * focal / near, 1.5 / this.quality, e.cur)
        : pickLevel(e.set.lodTriangles, radius, dist, focal, MESH_PX / this.quality, e.cur)
      if (next !== e.cur) {
        const target = levels[next]
        if (target.geo) { e.cur = next; e.mesh.geometry = target.geo }
        else this._buildLevel(e.base, target)
      }
      if (this.clusters.byMesh.has(e.mesh)) {
        this.clusters.sync(e.mesh) // al cambiar el LOD, reindexar la fuente geométrica REAL
        const entry = this.clusters.byMesh.get(e.mesh)
        if (entry) entry.legacyManaged = true
      }
      if (e.mesh.geometry !== e.base) swaps++
    }
    let culled = 0, chunks = 0
    for (const f of this.foliages) { const r = f.updatePlay(this._p, fullFocal, this.drawScale); culled += r.hidden; chunks += r.chunks; swaps += r.lod }
    this.stats = { swaps, culled, chunks }
    const ex = this.vp.perf.stats.extra; ex.lodSwaps = swaps; ex.culled = culled
    this.vp.requestRender()
  }

  _setTerrainIndex(s) {
    const geo = s.mesh.geometry
    if (s.cur === 1) {
      if (s.bakePlan?.index) {
        if (!s.bakeIndex || s.bakeIndex.array !== s.bakePlan.index)
          s.bakeIndex = new THREE.BufferAttribute(s.bakePlan.index, 1)
        geo.setIndex(s.bakeIndex)
      } else geo.setIndex(s.orig)
      return
    }
    let a = s.idx.get(s.cur)
    if (!a) { a = new THREE.BufferAttribute(terrainIndex(s.t.segments, s.cur, s.t.segmentsZ), 1); s.idx.set(s.cur, a) }
    geo.setIndex(a)
  }

  suspendForWebGpu() {
    this.clusters?.suspend()
    for (const e of this.meshes) {
      if (e.mesh.geometry !== e.set.levels[e.cur].geo) continue
      e.mesh.geometry = e.base
      e.cur = 0
    }
    this._dirty = true
  }

  detach() {
    if (this.vp.lodManager === this) this.vp.lodManager = null
    this.clusters?.dispose()
    this.batcher?.detach()
    this.batcher = null
    for (const s of this.terrains) {
      s.bakeTask?.abort()
      if (s.mesh.geometry === s.geometry) s.mesh.geometry.setIndex(s.orig)
      s.mesh.frustumCulled = s.wasCulled
    }
    this._stopWorker()
    for (const e of this.meshes) if (e.mesh.geometry === e.set.levels[e.cur].geo) e.mesh.geometry = e.base
    for (const cache of [this.meshLevels, this.indexedLevels]) {
      for (const [base, { levels }] of cache) {
        for (const level of levels) if (level.geo && level.geo !== base) level.geo.dispose()
      }
      cache.clear()
    }
    for (const f of this.foliages) f.exitPlay()
    this.terrains = []; this.meshes = []; this.foliages = []
    this.vp.requestRender()
  }
}
