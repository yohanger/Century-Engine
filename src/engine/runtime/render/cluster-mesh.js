import { BatchedMesh, BufferAttribute, Box3, Frustum, Matrix4, Sphere, Vector3 } from 'three'
import { candidateMesh, isOcclusionStatic } from './occlusion-static.js'
import { geometryFromLod, lodTransferables, serializeLodGeometry, simplifiable, trianglesOf } from './lodgeo.js'
import { pickErrorLod, terrainIndex, terrainStrides, pickStride, distToBox } from './lod.js'
import { partitionTriangles } from './mesh-clusters.js'
import { terrainBakePlan } from './terrain-bake.js'
import { buildPageTree, queryPageTree } from './trianghor/spatial.js'
import LodWorker from './lod.worker.js?worker&inline'

const MIN_TRIANGLES = 1 // participación nativa; una cara constituye un clúster válido
const BATCH_MIN_TRIANGLES = 768 // evitar BatchedMesh + worker para mallas diminutas
const MAX_RESIDENT_BYTES = 48 * 1024 * 1024
const MAX_DIRECT_PAGE_BYTES = 24 * 1024 * 1024
const EVICT_AFTER = 2500
const RELEASE_PAGES_AFTER = 7500

/** Participación nativa: no depende de materiales PBR, estático, multi_draw ni LOD de proyecto. */
export function nativeClusterCandidate(mesh) {
  const g = mesh?.geometry
  return !!(mesh?.isMesh && !mesh.isInstancedMesh && !mesh.isSkinnedMesh && !mesh.isBatchedMesh &&
    !mesh.userData?.helper && !mesh.userData?.isHelper && !mesh.userData?.pickProxy &&
    !mesh.morphTargetInfluences?.length && !g?.isInstancedBufferGeometry &&
    g?.attributes?.position && trianglesOf(g) >= MIN_TRIANGLES &&
    (g.drawRange?.start || 0) % 3 === 0)
}

/** La ruta batch es opcional INTERNAMENTE: clústeres nativos siguen existiendo sin ella. */
export function clusterCandidate(mesh) {
  if (!nativeClusterCandidate(mesh)) return false
  const g = mesh.geometry, m = mesh.material, triangles = trianglesOf(g)
  const terrain = mesh.userData?._lfNativeTerrain === true
  const inputBytes = Object.values(g.attributes).reduce((sum, attr) => sum + (attr.array?.byteLength || attr.data?.array?.byteLength || 0), 0) + (g.index?.array?.byteLength || 0)
  // El registro nativo NO tiene límite de triángulos; el lote GPU sí respeta el presupuesto real.
  if (inputBytes * 3 > MAX_RESIDENT_BYTES) return false
  return triangles >= BATCH_MIN_TRIANGLES && !!g.index && !Array.isArray(m) &&
    m?.isMeshStandardMaterial && !m.transparent && m.opacity === 1 &&
    !m.alphaTest && !m.lightMap && !m.wireframe && !m.transmission && !m.userData.rtShArr &&
    !mesh.customDepthMaterial && !mesh.customDistanceMaterial &&
    simplifiable(g) && !g.drawRange.start && g.drawRange.count >= g.index.count &&
    (terrain || candidateMesh(mesh))
}

/** Las actualizaciones de Terrain, pintura y geometría procedural invalidan páginas residentes. */
export function geometryRevision(g, terrain = null, indexOverride = undefined) {
  const index = indexOverride === undefined ? g?.index : indexOverride
  return [g?.uuid, index?.uuid, index?.version,
    ...Object.entries(g?.attributes || {}).flatMap(([name,a]) => [name,a.version,a.data?.version,a.count]),
    terrain?.version ?? 0].join('|')
}

export class ClusterMeshes {
  constructor(vp, quality) {
    this.vp = vp
    this.quality = quality
    this.entries = []
    this.byMesh = new WeakMap()
    this.cache = new Map()
    this.worker = null
    this.job = null
    this.failed = false
    this.bytes = 0
    this.directBytes = 0
    this.frustum = new Frustum()
    this.view = new Matrix4()
    this.sphere = new Sphere()
    this.cameraPosition = new Vector3()
    this._queryCenter = new Vector3()
    this._shadowFrusta = null
  }

  add(mesh, owner = null) {
    if (this.byMesh.has(mesh)) return true
    if (!nativeClusterCandidate(mesh)) return false
    mesh.updateWorldMatrix(true, false)
    if (Math.abs(mesh.matrixWorld.determinant()) < 1e-12) return false
    const base = mesh.geometry
    const batchEligible = !owner?.terrain && this.vp.renderer.extensions?.has('WEBGL_multi_draw') && clusterCandidate(mesh)
    const direct = !batchEligible
    base.computeBoundingSphere()
    let shared = direct ? null : this.cache.get(base)
    if (!direct && !shared) {
      shared = { base, pages: null, bytes: 0, done: false, refs: 0, residents: 0, lastSeen: -Infinity, revision: '', terrain: owner?.terrain || null }
      this.cache.set(base, shared)
    }
    const entry = { mesh, base, shared, owner, direct, batch: null, lastSeen: -Infinity,
      revision: geometryRevision(base, owner?.terrain), terrain: owner?.terrain || null,
      sourceIndex: owner?.terrain ? base.index : null, terrainPages: null, terrainActive: null,
      terrainSelection: '', terrainStride: 1, directPages: null, directActive: null,
      directSelection: '', activeIndex: null, sourceRevision: '', directBytes: 0,
      previousFrustumCulled: mesh.frustumCulled, authoredVisible: mesh.visible, legacyManaged: false }
    if (entry.terrain) mesh.frustumCulled = true // culling nativo, preservar valor editorial al desmontar
    this.entries.push(entry)
    this.byMesh.set(mesh, entry)
    if (shared) shared.refs++
    return true
  }

  /** Vuelve a registrar la identidad de geometría tras reconstruir terreno, primitiva o malla. */
  sync(mesh, owner = null) {
    const entry = this.byMesh.get(mesh)
    if (entry && entry.base !== mesh.geometry) {
      this._remove(entry)
      this.entries.splice(this.entries.indexOf(entry), 1)
    } else if (entry) return true
    return this.add(mesh, owner)
  }

  /** Evita retener meshes de nodos eliminados (incluidos recursos de worker). */
  prune() {
    this.entries = this.entries.filter(entry => {
      if (entry.mesh.parent) return true
      this._remove(entry)
      return false
    })
  }

  addStreamed(nodes, owner) {
    for (const node of nodes.values()) {
      if (!isOcclusionStatic(node._lfNodeOwner) || !node.visible) continue
      const visual = node.userData.visual ?? node
      const visit = (object) => {
        if (!object.visible || object !== visual && object.userData.kind === 'object') return
        this.add(object, owner)
        object.children.forEach(visit)
      }
      visit(visual)
    }
  }

  removeStreamed(owner) {
    this.entries = this.entries.filter((entry) => {
      if (entry.owner !== owner) return true
      this._remove(entry)
      return false
    })
  }

  _remove(entry) {
    this._unmount(entry)
    if (entry.terrain) entry.mesh.frustumCulled = entry.previousFrustumCulled
    if (entry.mesh.geometry === entry.base &&
        (entry.terrain && entry.sourceIndex || entry.activeIndex && entry.base.index === entry.activeIndex))
      entry.base.setIndex(entry.sourceIndex)
    for (const page of [...(entry.terrainPages || []), ...(entry.directPages || [])]) page.debugGeometry?.dispose()
    entry.bakeTask?.controller.abort()
    for (const variant of entry.terrainVariants?.values() || []) for (const page of variant.pages) page.debugGeometry?.dispose()
    entry.terrainVariants?.clear()
    entry.terrainPages = null; entry.terrainActive = null
    entry.directPages = null; entry.directActive = null
    this.directBytes -= entry.directBytes || 0; entry.directBytes = 0
    this.byMesh.delete(entry.mesh)
    if (!entry.shared || --entry.shared.refs > 0) return
    this._releasePages(entry.shared)
    this.cache.delete(entry.base)
  }

  _releasePages(shared) {
    for (const levels of shared.pages || []) for (const level of levels) level.geo.dispose()
    shared.pages = null
    shared.done = false
  }

  _build(shared) {
    if (this.failed || this.job || shared.done) return
    try {
      if (!this.worker) {
        this.worker = new LodWorker()
        this.worker.onmessage = ({ data }) => {
          const job = this.job
          this.job = null
          if (!job) return
          if (!job.refs || job.revision !== geometryRevision(job.base, job.terrain)) return
          job.done = true
          if (!data?.length) return
          job.pages = data.map(levels => levels.map(level => ({ geo: geometryFromLod(level, job.base.uuid), error: level.error })))
          const originals = data.map(levels => levels[0])
          job.vertices = originals.reduce((n, level) => n + level.position.length / 3, 0)
          job.indices = originals.reduce((n, level) => n + level.index.length, 0)
          const bytesPerVertex = originals[0].position.BYTES_PER_ELEMENT *
            (3 + Object.values(originals[0].attrs).reduce((n, attr) => n + attr.itemSize, 0))
          job.bytes = job.vertices * bytesPerVertex + job.indices * (job.vertices > 65535 ? 4 : 2)
          this.vp.requestRender()
        }
        this.worker.onerror = () => this._stopWorker()
        this.worker.onmessageerror = () => this._stopWorker()
      }
      this.job = shared
      shared.revision = geometryRevision(shared.base, shared.terrain)
      const input = serializeLodGeometry(shared.base)
      this.worker.postMessage({ input, clusters: true }, lodTransferables(input))
    } catch { this._stopWorker() }
  }

  _mount(entry) {
    const { mesh, shared } = entry
    const batch = new BatchedMesh(shared.pages.length, shared.vertices, shared.indices, mesh.material)
    try {
      const ids = shared.pages.map(([first]) => {
        const geometry = batch.addGeometry(first.geo)
        const instance = batch.addInstance(geometry)
        return { geometry, instance, level: 0 }
      })
      batch.sortObjects = false
      batch.frustumCulled = false
      batch.castShadow = mesh.castShadow
      batch.receiveShadow = mesh.receiveShadow
      batch.layers.mask = mesh.layers.mask
      batch.raycast = () => {}
      batch.matrixAutoUpdate = false
      batch.matrix.copy(mesh.matrix)
      batch.matrixWorldNeedsUpdate = true
      batch._lfClusterSource = mesh
      batch.visible = mesh.visible
      mesh.parent.add(batch)
      mesh._lfClusterBatch = batch
      entry.authoredVisible = mesh.visible
      mesh.visible = false
      entry.batch = batch
      entry.ids = ids
      shared.residents++
      this.bytes += shared.bytes
      this.vp.invalidateShadows?.()
    } catch (error) {
      batch.removeFromParent()
      batch.dispose()
      shared.failed = true
      console.warn('Clústeres de geometría', error)
    }
  }

  _unmount(entry) {
    if (!entry.batch) return
    // No forzar true: la visibilidad de autoría puede haber cambiado con el lote montado.
    entry.mesh.visible = entry.mesh._lfNodeOwner?.visible !== undefined
      ? entry.mesh._lfNodeOwner.visible !== false : entry.authoredVisible !== false
    delete entry.mesh._lfClusterBatch
    entry.batch.removeFromParent()
    entry.batch.dispose()
    entry.batch = null
    entry.ids = null
    entry.shared.residents--
    this.bytes -= entry.shared.bytes
    this.vp.invalidateShadows?.()
  }

  /** Hornea en CPU sin congelar el renderer cuando el terreno cambia o al cargar una escena. */
  _requestTerrainBake(entry, revision) {
    if (entry.bakeTask?.revision === revision || entry.bakeAttempt === revision) return
    entry.bakeTask?.controller.abort()
    const controller = new AbortController(), terrain=entry.terrain
    const task={controller,revision,version:terrain.version}
    entry.bakeTask=task; entry.bakeAttempt=revision
    import('./trianghor/worker-client.js').then(({bakeTerrainOffThread}) =>
      bakeTerrainOffThread(terrain,terrain.terrainBake,controller.signal)).then(plan=>{
      if (entry.bakeTask!==task || controller.signal.aborted ||
          terrain.version!==task.version || entry.mesh.geometry!==entry.base) return
      terrain.bakeInfo=plan
      terrain._bakeVersion=terrain.version
      entry.bakeRevision=null
      entry.terrainCachePlan=null
      this.vp.requestRender?.()
    }).catch(error=>{
      if (!controller.signal.aborted) console.warn('TriangHor · regeneración',error)
    }).finally(()=>{if(entry.bakeTask===task)entry.bakeTask=null})
  }

  /** Spatial del cluster nativo; no añade otra topología a Terrain. */
  _terrainPages(entry,stride,revision,pos) {
    const t=entry.terrain
    const planIndex=entry.bakePlan?.index || null
    if (entry.terrainRevision!==revision || entry.terrainCachePlan!==planIndex) {
      for(const variant of entry.terrainVariants?.values() || [])
        for(const page of variant.pages) page.debugGeometry?.dispose()
      entry.terrainVariants=new Map()
      entry.terrainCachePlan=planIndex
      entry.terrainRevision=revision
      entry.terrainSelection=''
    }
    let variant=entry.terrainVariants.get(stride)
    if (variant) { // LRU acotado: no reconstruir páginas por cada movimiento de cámara.
      entry.terrainVariants.delete(stride)
      entry.terrainVariants.set(stride,variant)
      return variant
    }
    const source=stride===1 ? (entry.bakePlan?.index || entry.sourceIndex.array) :
      terrainIndex(t.segments,stride,t.segmentsZ)
    const index=source instanceof Uint32Array ? source : Uint32Array.from(source)
    const leaves=partitionTriangles({index,position:pos.array},768)
    const pages=leaves.map((leaf,id)=>{
      const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity]
      for(const vertex of leaf) for(let k=0;k<3;k++) {
        const v=pos.array[vertex*3+k]
        min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],v)
      }
      const sphere=new Sphere().setFromPoints([new Vector3(...min),new Vector3(...max)])
      return {id,index:leaf,sphere}
    })
    variant={pages,tree:buildPageTree(pages)}
    entry.terrainVariants.set(stride,variant)
    // No crecer indefinidamente por alternancia entre perfiles/cámaras.
    while(entry.terrainVariants.size>3) {
      const old=entry.terrainVariants.keys().next().value
      const victim=entry.terrainVariants.get(old)
      for(const page of victim.pages) page.debugGeometry?.dispose()
      entry.terrainVariants.delete(old)
    }
    return variant
  }

  _terrainShadowFrusta() {
    const frusta=[]
    let unknown=false
    this.vp.scene.traverseVisible(obj=>{
      if(!obj.isLight || !obj.castShadow || !obj.shadow) return
      // Direccionales y Spot usan un frustum único. Las PointLights requieren
      // seis frusta: sin cobertura demostrada se conservan todas las páginas.
      if (!(obj.isDirectionalLight || obj.isSpotLight) ||
          typeof obj.shadow.updateMatrices!=='function' || typeof obj.shadow.getFrustum!=='function') {
        unknown=true;return
      }
      try {
        obj.updateWorldMatrix(true,false)
        obj.target?.updateWorldMatrix?.(true,false)
        obj.shadow.updateMatrices(obj)
        frusta.push(obj.shadow.getFrustum())
      } catch {unknown=true}
    })
    return unknown?null:frusta
  }

  _updateTerrain(entry,camera,focal) {
    const t=entry.terrain,mesh=entry.mesh,geo=entry.base,pos=geo.attributes.position
    const revision=[t.version,pos.version,pos.data?.version,t.segments,t.segmentsZ].join('|')
    if(!geo.boundingBox || revision!==entry.terrainRevision) {geo.computeBoundingBox();geo.computeBoundingSphere()}
    const box=new Box3().copy(geo.boundingBox).applyMatrix4(mesh.matrixWorld)
    const d=distToBox(this.cameraPosition.x,this.cameraPosition.z,box.min.x,box.min.z,box.max.x,box.max.z)
    const settings=t.terrainBake
    const stridesKey=`${t.segments}x${t.segmentsZ}|${settings?'baked':'auto'}`
    if(entry.terrainStridesKey!==stridesKey) {
      entry.terrainStridesKey=stridesKey
      entry.terrainStrides=terrainStrides(t.segments,settings?64:8,t.segmentsZ)
    }
    const auto=pickStride(Math.max(t.step,t.depth/t.segmentsZ),
      Math.hypot(d,Math.max(0,this.cameraPosition.y-box.max.y)),focal,
      6/this.quality,entry.terrainStrides,entry.terrainStride)
    if(settings && (!t.bakeInfo || t._bakeVersion!==t.version))
      this._requestTerrainBake(entry,revision)
    else if(!settings) {entry.bakeTask?.controller.abort();entry.bakePlan=null;entry.bakeRevision=null;t.bakeInfo=null}
    entry.bakePlan=settings && t._bakeVersion===t.version ? t.bakeInfo : null
    // Mantener la selección previa cuando los datos siguen válidos; los índices
    // de un trabajo antiguo nunca se dibujan tras editar heightmap/splat.
    const stride=Math.max(auto,entry.bakePlan?.stride || 1)
    const variant=this._terrainPages(entry,stride,revision,pos)
    entry.terrainPages=variant.pages
    entry.terrainStride=stride
    // Pase principal y shadow-pass comparten índice: usar la unión de frusta.
    // Para luces sin frustum fiable, mantener todos los casters (conservador).
    const shadowFrusta=mesh.castShadow ? this._shadowFrusta : []
    const counters={nodes:0,pages:0}
    const intersects=(center,radius)=>{
      const sphere=this.sphere
      sphere.center.set(...center);sphere.radius=radius
      sphere.applyMatrix4(mesh.matrixWorld)
      if (this.frustum.intersectsSphere(sphere)) return true
      if (!mesh.castShadow || !shadowFrusta?.length) return false
      return shadowFrusta.some(f=>f.intersectsSphere(sphere))
    }
    const active=mesh.castShadow && shadowFrusta===null ? variant.pages.slice()
      : queryPageTree(variant.tree,intersects,[],counters).sort((a,b)=>a.id-b.id)
    entry.terrainQuery=counters
    const key=`${stride}|${revision}|${entry.bakePlan?.index?.length||0}|${active.map(p=>p.id).join(',')}`
    entry.terrainActive=active
    if (key===entry.terrainSelection) return
    entry.terrainSelection=key
    if(stride===1 && active.length===variant.pages.length && !entry.bakePlan?.index)
      geo.setIndex(entry.sourceIndex)
    else {
      const combined=new Uint32Array(active.reduce((n,page)=>n+page.index.length,0))
      let offset=0
      for(const page of active){combined.set(page.index,offset);offset+=page.index.length}
      geo.setIndex(new BufferAttribute(combined,1))
    }
    this.vp.invalidateShadows?.()
  }

  /**
   * Mallas en dibujo directo: partición nativa por índices para cualquier tamaño.
   * Se conserva la geometría y material del autor; solo se cambia el índice
   * de dibujo cuando una selección por página es segura y comprobable.
   * Transparencia, grupos multimaterial y drawRange restringido NO se reordenan.
   */
  _updateDirect(entry) {
    const { mesh, base } = entry
    if (base.index !== entry.sourceIndex && base.index !== entry.activeIndex) {
      // Un editor externo ha cambiado el índice: la nueva fuente tiene prioridad.
      entry.sourceIndex = base.index
      entry.directSelection = ''
    }
    const revision = geometryRevision(base, null, entry.sourceIndex)
    if (revision !== entry.sourceRevision || !entry.directPages) {
      for (const page of entry.directPages || []) page.debugGeometry?.dispose()
      entry.directPages = null; entry.directActive = null
      this.directBytes -= entry.directBytes || 0; entry.directBytes = 0
      entry.sourceRevision = revision; entry.directSelection = ''
      if (entry.activeIndex && base.index === entry.activeIndex) base.setIndex(entry.sourceIndex)
      entry.activeIndex = null
      const attr = base.attributes.position
      const source = entry.sourceIndex
      const first = Math.max(0, base.drawRange?.start || 0)
      const count = source?.count ?? attr.count
      const available = Number.isFinite(base.drawRange?.count) ? Math.min(base.drawRange.count, count - first) : count - first
      const triangles = Math.floor(Math.max(0, available) / 3)
      if (!triangles) return
      const bytes = triangles * 3 * 4
      const compact = !Array.isArray(mesh.material) && first === 0 &&
        (!Number.isFinite(base.drawRange.count) || base.drawRange.count >= count) &&
        !mesh.material?.transparent && !mesh.material?.alphaTest && !mesh.morphTargetInfluences?.length
      // Frente a geometría desmesurada, participar sin exigir almacenamiento infinito.
      if (!compact || bytes > MAX_RESIDENT_BYTES || bytes > MAX_DIRECT_PAGE_BYTES - this.directBytes) {
        entry.directPages = [{ id: 0, source: true, index: null, bounds: base.boundingSphere.clone() }]
        entry.directActive = entry.directPages
        return
      }
      const index = new Uint32Array(triangles * 3)
      for (let i = 0; i < index.length; i++) index[i] = source ? source.getX(i) : i
      const pos = new Float32Array(attr.count * 3)
      for (let i = 0; i < attr.count; i++) pos.set([attr.getX(i), attr.getY(i), attr.getZ(i)], i * 3)
      const leaves = partitionTriangles({ index, position: pos }, 768)
      entry.directBytes = leaves.reduce((n, leaf) => n + leaf.byteLength, 0)
      this.directBytes += entry.directBytes
      entry.directPages = leaves.map((leaf, id) => {
        const bounds = new Box3()
        const v = new Vector3()
        for (let i = 0; i < leaf.length; i++) {
          const p = leaf[i]
          bounds.expandByPoint(v.set(pos[p*3], pos[p*3+1], pos[p*3+2]))
        }
        return { id, index: leaf, bounds: bounds.getBoundingSphere(new Sphere()) }
      })
    }
    if (!entry.directPages?.length) return
    const active = mesh.castShadow ? entry.directPages : entry.directPages.filter(page =>
      this.frustum.intersectsSphere(this.sphere.copy(page.bounds).applyMatrix4(mesh.matrixWorld)))
    entry.directActive = active
    // No altera topología para una sola página o cuando las sombras requieren toda la malla.
    const canSelect = entry.directPages[0]?.index && entry.directPages.length > 1 && !mesh.castShadow && !entry.legacyManaged
    const key = `${revision}|${active.map(page => page.id).join(',')}|${canSelect}`
    if (key === entry.directSelection) return
    entry.directSelection = key
    if (!canSelect || active.length === entry.directPages.length) {
      if (entry.activeIndex && base.index === entry.activeIndex) base.setIndex(entry.sourceIndex)
      entry.activeIndex = null
    } else {
      const combined = new Uint32Array(active.reduce((sum, page) => sum + page.index.length, 0))
      let off = 0
      for (const page of active) { combined.set(page.index, off); off += page.index.length }
      entry.activeIndex = new BufferAttribute(combined, 1)
      base.setIndex(entry.activeIndex)
    }
  }

  _authoredVisible(mesh) {
    for (let node = mesh; node; node = node.parent) {
      if (node._lfNodeOwner?.visible === false) return false
    }
    return true
  }

  update(camera, now, { terrainOnly = false } = {}) {
    this.prune()
    if (!this.entries.length) return
    camera.updateWorldMatrix(true, false)
    this.frustum.setFromProjectionMatrix(this.view.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
    this.cameraPosition.setFromMatrixPosition(camera.matrixWorld)
    const focal = camera.projectionMatrix.elements[5] * (this.vp.look?.scenePixelHeight || this.vp.renderer.domElement.height || 720) * 0.5
    this._shadowFrusta=this._terrainShadowFrusta()
    const budget = 1.5 / this.quality
    let uploads = 1, updates = 24
    for (const entry of this.entries) {
      if (terrainOnly && !entry.terrain) continue
      const { mesh, base, shared } = entry
      if (!mesh.parent || mesh.geometry !== base || entry.batch && mesh.material !== entry.batch.material) {
        this._unmount(entry)
        continue
      }
      if (entry.terrain) {
        mesh.updateWorldMatrix(true, false)
        this._updateTerrain(entry, camera, focal)
        continue
      }
      const revision = geometryRevision(base, entry.terrain, entry.direct ? entry.sourceIndex : undefined)
      if (revision !== entry.revision) {
        entry.revision = revision
        this._unmount(entry)
        if (shared) { this._releasePages(shared); shared.failed = false }
        base.computeBoundingSphere()
      }
      mesh.updateWorldMatrix(true, false)
      if (entry.batch) {
        // El mesh original se oculta únicamente como detalle del batching. Si el
        // nodo autor se oculta, el lote hermano también debe desaparecer.
        entry.batch.visible = entry.authoredVisible !== false && this._authoredVisible(mesh)
        mesh.visible = false
      }
      let isVisible = entry.batch?.visible ?? mesh.visible
      for (let o = mesh.parent; isVisible && o; o = o.parent) isVisible = o.visible
      const visible = isVisible && mesh.layers.test(camera.layers) &&
        this.frustum.intersectsSphere(this.sphere.copy(base.boundingSphere).applyMatrix4(mesh.matrixWorld))
      if (visible) {
        if (entry.direct) this._updateDirect(entry)
        entry.lastSeen = now
        if (shared) {
          shared.lastSeen = now
          shared.terrain = entry.terrain
          if (!shared.done) this._build(shared)
        }
      }
      if (entry.batch && (entry.batch.parent !== mesh.parent || now - entry.lastSeen > EVICT_AFTER)) this._unmount(entry)
      if (!entry.batch && !entry.direct && visible && shared.pages && !shared.failed && uploads > 0 && this.bytes + shared.bytes <= MAX_RESIDENT_BYTES) {
        this._mount(entry)
        uploads--
      }
      if (!entry.batch) continue
      entry.batch.layers.mask = mesh.layers.mask
      entry.batch.castShadow = mesh.castShadow
      entry.batch.receiveShadow = mesh.receiveShadow
      if (!entry.batch.matrix.equals(mesh.matrix)) {
        entry.batch.matrix.copy(mesh.matrix)
        entry.batch.matrixWorldNeedsUpdate = true
      }
      if (!visible) continue
      const scale = mesh.matrixWorld.getMaxScaleOnAxis()
      for (let i = 0; i < entry.ids.length; i++) {
        const handle = entry.ids[i], levels = shared.pages[i]
        const bounds = this.sphere.copy(levels[0].geo.boundingSphere).applyMatrix4(mesh.matrixWorld)
        if (!this.frustum.intersectsSphere(bounds)) continue
        const distance = camera.isOrthographicCamera ? 1 :
          Math.max(camera.near, bounds.center.distanceTo(this.cameraPosition) - bounds.radius)
        const next = pickErrorLod(levels, scale * focal / distance, budget, handle.level)
        if (next === handle.level || updates <= 0) continue
        updates--
        entry.batch.setGeometryAt(handle.geometry, levels[next].geo)
        handle.level = next
      }
    }
    for (const shared of this.cache.values()) {
      if (shared.pages && !shared.residents && now - shared.lastSeen > RELEASE_PAGES_AFTER) this._releasePages(shared)
    }
    const extra = this.vp.perf?.stats?.extra
    if (extra) {
      extra.clusterBatches = this.entries.filter(entry => entry.batch).length
      extra.clusterDirect = this.entries.filter(entry => entry.direct && !entry.terrain).length
      extra.clusterDirectPages = this.entries.reduce((n, entry) => n + (entry.directActive?.length || 0), 0)
      const terrainEntries = this.entries.filter(entry => entry.terrain && entry.mesh.visible && entry.mesh.layers.test(camera.layers))
      extra.clusterTerrainPages = terrainEntries.reduce((sum, entry) => sum + (entry.terrainActive?.length || 0), 0)
      extra.terrainSourceTriangles = terrainEntries.reduce((n, e) => n + 2 * e.terrain.segments * e.terrain.segmentsZ, 0)
      extra.terrainEffectiveTriangles = terrainEntries.reduce((n, e) => n + (e.terrainActive || []).reduce((sum, page) => sum + page.index.length / 3, 0), 0)
      extra.terrainBakedTriangles = terrainEntries.reduce((n, e) => n + (e.bakePlan?.triangles ?? 2 * e.terrain.segments * e.terrain.segmentsZ), 0)
      extra.terrainBakeBlocked = terrainEntries.filter(e => e.terrain.terrainBake && !e.bakePlan?.index).length
      extra.terrainDrawNote = 'Triángulos de índices seleccionados; no incluye oclusión de fragmentos GPU'
      extra.triangHorNodes = terrainEntries.reduce((n,e)=>n+(e.terrainQuery?.nodes||0),0)
      extra.triangHorPagesTested = terrainEntries.reduce((n,e)=>n+(e.terrainQuery?.pages||0),0)
      extra.triangHorPagesTotal = terrainEntries.reduce((n,e)=>n+(e.terrainPages?.length||0),0)
      extra.triangHorBakeMs = terrainEntries.reduce((n,e)=>n+(e.bakePlan?.bakeMs||0),0)
      extra.triangHorShadowConservative = terrainEntries.filter(e=>e.mesh.castShadow && this._shadowFrusta===null).length
      extra.clusterSources = this.entries.length
      extra.clusterMiB = (this.bytes + this.directBytes) / (1024 * 1024) // incluye páginas CPU nativas
    }
  }

  _stopWorker() {
    this.worker?.terminate()
    this.worker = null
    this.job = null
    this.failed = true
  }

  suspend() {
    for (const entry of this.entries) this._unmount(entry)
  }

  dispose() {
    this._stopWorker()
    for (const entry of this.entries) this._remove(entry)
    this.entries.length = 0
    const extra = this.vp.perf?.stats?.extra
    if (extra) { delete extra.clusterBatches; delete extra.clusterDirect; delete extra.clusterDirectPages; delete extra.clusterTerrainPages; delete extra.clusterSources; delete extra.clusterMiB
      delete extra.triangHorNodes; delete extra.triangHorPagesTested; delete extra.triangHorPagesTotal
      delete extra.triangHorBakeMs; delete extra.triangHorShadowConservative }
  }
}
