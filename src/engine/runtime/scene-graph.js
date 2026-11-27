// SceneGraph: la escena viva (visor, nodos, modelos, terrenos, mundo, entorno y render) sin edición.
// No importa el store ni el editor: lee el proyecto y la vista a través de `host` (lo inyecta quien lo use: el editor o el juego exportado):
//   host.project            proyecto en curso (objetos, entorno, render, base de datos, prefabs…)
//   host.view               opciones de vista (luces, wireframe, terreno, follaje, clima, bake, renderMethod…)
//   host.getObject(id)      objeto del proyecto por id
//   host.assetData(id)      → { name, bytes } | null        host.assetImage(id) → HTMLImageElement | null
//   host.toast?(msg, kind, ms)     host.foliageCounts?(counts)     host.bakeState?(state)
// El editor sobrescribe los ganchos `_node*`, `_sceneLoading`, `_renderApplied` y `isPlaying` para sus gizmos, selección y modo Jugar.
import * as THREE from 'three'
import { SpectralWater } from './fluids/spectral-water.js'
import { Viewport } from './render/viewport.js'
import { Terrain } from './geometry/terrain.js'
import { deserializeAll } from './geometry/terrains.js'
import { Foliage, setFoliageImageLoader } from './geometry/foliage.js'
import { lightMult } from './render/lightfx.js'
import { disposeEventGraphic } from './nodes/event.js'
import { disposeDecal } from './nodes/decal.js'
import { setPbrEnv } from './render/pbr.js'
import { World } from './world/world.js'
import { BakeRuntime } from './bake/runtime.js'
import { NatureFX } from './world/nature.js'
import { objectsMethods } from './scene/objects.js'
import { NodeLifecycle } from './scene/node-lifecycle.js'
import { validateNodeTree } from './nodes/hierarchy.js'
import { modelsMethods } from './scene/models.js'
import { texturesMethods } from './scene/textures.js'
import { waterMethods } from './scene/water.js'
import { brushesMethods } from './scene/brushes.js'
import { terrainMethods } from './scene/terrain.js'
import { environmentMethods } from './scene/environment.js'

export class SceneGraph {
  constructor(container, host) {
    this.host = host
    Terrain.loader = host.assetImage
    setFoliageImageLoader(host.assetImage)
    Foliage.modelLookup = (id) => this.models.get(id)
    this.vp = new Viewport(container)
    this.world = new World() // hora, sol/luna, clima y viento de la escena (core/world)
    this.vp.precip.ground = (x, z) => {
      const terrain = this.groundAt(x, z)
      const surface = (this._activeWaterWorld || this._physicalWaterView?.water)?.at?.(x, z)?.surface
      return Number.isFinite(surface) ? Math.max(surface, Number.isFinite(terrain) ? terrain : -Infinity) : terrain
    }
    this.vp.precip.onImpact = (hit) => this.rainWaterRipple(hit)
    this.vp.precip.impact = (from, to) => this.rainImpact(from, to) // raycast de gotas sobre primitivas de la escena
    this.vp.nature = new NatureFX(this.vp.scene, { scene: this.vp.scene, camera: () => this.vp.camera,
      terrains: () => this.terrains, objects: () => this.host.project?.objects, nodes: () => this.nodes, ground: (x, z) => this.groundAt(x, z),
      waterAt: (x, z) => (this._activeWaterWorld || this._physicalWaterView?.water)?.at?.(x, z) ?? null,
      soilAt: (x, z) => {
        const water = this._activeWaterWorld || this._physicalWaterView?.water
        for (const r of water?.regions?.values() || []) {
          if (!r.hydrology || !r.contains(x, z)) continue
          return r.moistureAt(Math.floor((x - r.x) / r.dx), Math.floor((z - r.z) / r.dz))
        }
        return null
      } }) // hojas, viento en la vegetación, animales
    this.vp.windWorld = this.world // autoridad de viento efectivo; el viewport comparte una muestra por frame
    const sg = this
    setPbrEnv({
      get look() { return sg.vp.renderCfg?.look || 'clasico' },
      get defaultShader() { return sg.vp.renderCfg?.shader || '' },
      get psxUniforms() { return sg.vp.renderCfg?.psx && sg.vp.renderCfg.psxSnap > 0 ? sg.vp.psxUniforms : null },
      get shaders() { return sg.host.project?.shaders || [] },
      get materials() { return sg.host.project?.materials || [] },
      get meshes() { return sg.host.project?.meshes || [] },
      getMap: (id, srgb, flipY) => sg._mapTexture(id, srgb, flipY),
    })
    this.dom = this.vp.dom
    this.streamedTerrains = new Set()
    this.terrains = []
    this.vp.reflectionTerrains = () => this._enabledTerrains()
    this.vp.authoredSun = () => this.nodes.get(this._sunObject()?.id)?.userData.light // piezas de terreno de la escena (la primera es la principal)
    this._activeId = null
    this.nodes = new Map()
    this.vp.occlusion.graph = this
    this.nodeLifecycle = new NodeLifecycle(this)
    this.models = new Map() // id -> THREE.Object3D
    this.modelClips = new Map() // id -> THREE.AnimationClip[] (animaciones embebidas del glTF + capturas de movimiento importadas)
    this.modelBaseClips = new Map() // id -> clips del propio glTF
    this._captures = [] // project.captures: animaciones capturadas (project.captures)
    this.objectsGroup = new THREE.Group()
    this.vp.world.add(this.objectsGroup)
    this.bake = new BakeRuntime(this, host) // iluminación horneada (lightmaps y sondas)
  }

  // =================== ganchos (el editor los sobrescribe) ===================
  /** ¿Se está jugando? (el reloj del mundo no se reinicia al cambiar de escena en juego). */
  get isPlaying() { return false }
  _sceneLoading() {}
  _nodeReplacing(_old) {}
  _nodeBuilt(_obj, _node) {}
  _nodeSynced(_obj, _id) {}
  _nodeRemoving(_node) {}
  _nodeRemoved(_id) {}
  _renderApplied() {}

  // =================== proyecto ===================
  /** Monta un proyecto: la escena activa + los modelos binarios del proyecto. `models` = metadatos (nombre por id). */
  async loadProject(rec, assets, models = [], onModels, project = this.host.project) {
    this.forgetRoadTexture() // una nueva sesión no conserva imágenes de proyectos anteriores
    this.models.clear(); this.modelClips.clear(); this.modelBaseClips.clear()
    const names = new Map(models.map((m) => [m.id, m.name]))
    await this.loadScene(rec)
    await onModels?.(0, assets?.length ?? 0)
    let loaded = 0
    for (const a of assets || []) {
      try { await this.registerModel(a.assetId, a.bytes, names.get(a.assetId) || a.name, { project }) } catch (e) { console.warn('Modelo no legible', a.name, e) }
      await onModels?.(++loaded, assets.length)
    }
  }

  /** Cambia solo la escena (terreno + nodos); los modelos del proyecto siguen cargados. */
  async loadScene(rec) {
    this._spectralWater?.dispose();this._spectralWater=null;this._previewWaterWorld=null
    const resumeLifecycle = this.nodeLifecycle.active
    this.nodeLifecycle.stop()
    this._releaseViewDiagnosticLod()
    this._sceneLoading()
    this._restoreWorldSun()
    this._removeWorldMoon()
    this.hidePhysicalWater()
    this._physicalPreviewSig = null
    this._rainMeshes = null
    this.vp.precip.resetImpacts()
    // Los nodos que siguen vivos no deben liberar sus geometrías, luces ni recursos GPU.
    const retained = this._persistRetainIds || new Set()
    this._retainedNodes = new Map([...this.nodes].filter(([id]) => retained.has(id)))
    for (const n of [...this.objectsGroup.children]) this.objectsGroup.remove(n)
    for (const [id, n] of this.nodes) {
      if (retained.has(id)) continue
      disposeEventGraphic(n.userData.previewGraphic)
      if (n.userData.decalKey !== undefined) disposeDecal(n)
      n.userData.disposeModelMaterials?.()
      n.userData.disposeLightEffects?.()
      n.userData.disposePhysicsPreview?.()
      n.userData.disposeVfx?.()
    }
    this.nodes.clear()
    for (const t of this.terrains) this._unmountPiece(t)
    this.terrains = deserializeAll(rec.terrain)
    this._activeId = this.terrains[0].id
    for (const t of this.terrains) this._mountPiece(t)
    this._terrainVer = (this._terrainVer || 0) + 1
    this._wmVer = (this._wmVer || 0) + 1; this._wmSig = null
    this._foliageCounts()
    this.applyView()
    this.vp.setGrid(rec.settings.gridSize, Math.max(rec.terrain.size, 32))
    this.syncSettings(rec.settings)
    this.applyRender()
    if (resumeLifecycle) this.nodeLifecycle.start()
    this.vp.requestRender()
  }

  /** Devuelve al mundo las mismas instancias, sin construirlas de nuevo. */
  restoreRetainedNodes(objects) {
    const held = this._retainedNodes || new Map()
    const ids = new Set(objects.map((o) => o.id))
    for (const [id, node] of held) {
      const collision = this.nodes.get(id)
      if (collision && collision !== node) this.removeObject(id)
      this.nodes.set(id, node)
    }
    for (const o of objects) {
      const node = held.get(o.id)
      if (!node) continue
      // Si su padre no sigue vivo, queda como raíz sin cambiar su posición mundial.
      if (o.parentId && !ids.has(o.parentId)) {
        node.updateWorldMatrix(true, false)
        const matrix = node.matrixWorld.clone()
        this.objectsGroup.add(node)
        matrix.decompose(node.position, node.quaternion, node.scale)
        o.parentId = null
      } else this._attach(o, node)
      node.updateMatrixWorld(true)
    }
    this._retainedNodes = null
    this.nodeLifecycle.sync()
    this.vp.requestRender()
  }

  discardRetainedNodes() { this._retainedNodes = null }

  // =================== sincronización con el estado ===================
  syncAll() {
    validateNodeTree(this.host.project.objects)
    this._syncingAll = true
    try {
      const ids = new Set(this.host.project.objects.map((o) => o.id))
      for (const id of [...this.nodes.keys()]) if (!ids.has(id)) this.removeObject(id)
      for (const o of this.host.project.objects) this.syncObject(o.id)
      this._refreshDecals()
      this._refreshTriMeshShapes()
      this._refreshAutoFitBoxes()
      this._bakeSchedule()
    } finally { this._syncingAll = false }
    this.nodeLifecycle.sync()
  }

  _ctx() {
    const sg = this
    return this._ctxObj || (this._ctxObj = {
      getModelScene: (id) => sg.models.get(id),
      getModelMap: (id, srgb, flipY) => sg._mapTexture(id, srgb, flipY),
      getDatabase: () => sg.host.project?.database,
      getPrefab: (id) => sg.host.project?.prefabs?.find((p) => p.id === id) || null,
      heightAt: (x, z) => sg.groundAt(x, z), // NaN en los huecos → la carretera hace de puente
      get terrainVersion() { return sg._terrainVer || 0 },
      getTexture: (id, mode) => sg._roadTexture(id, mode),
      getSpriteTexture: (id) => sg.spriteTexture(id),
      getDecalTarget: (id) => sg.nodes.get(id) || null,
    })
  }

  // =================== animación de la escena por fotograma ===================
  /** Clima vivo, sondas de bake, parpadeo de luces y agua. Devuelve true si algo se animó (ya pidió el redibujado). */
  _sceneFrame(dt) {
    let animated = false
    // Edit Mode: no avanza la meteorología. Solo actualiza la REGIÓN espacial
    // si el observador abandona el volumen; el resto de liveFx sigue disponible.
    if (!this.isPlaying) {
      this.refreshPhysicalWaterPreview()
      const field = this.world?.field
      if (field && this.world.weatherOn) {
        const c = this.vp.camera.position, m = field.map
        const d = Math.hypot(c.x - (m.cx + field.windOff[0]), c.z - (m.cz + field.windOff[1]))
        if (d > m.half * 0.25) {
          this.world.setObserver(c.x, c.y, c.z)
          const previous = m.version
          field.maintain(c.x, c.z, 0)
          if (m.version !== previous) {
            this.world._cq.init = false // volver a medir luz y precipitación desde esta posición
            this.applyWorld()
            animated = true
          }
        }
      }
    }
    const water=this._activeWaterWorld || this._physicalWaterView?.water || this._previewWaterWorld
    if(water?.bodies.length){
      this._spectralWater ||= new SpectralWater(this)
      this._spectralWater.reconcile(water)
      if(this._spectralWater.update(dt))animated=true
    }else if(this._spectralWater){this._spectralWater.dispose();this._spectralWater=null}
    this.bake.updateProbes()
    const tsec = performance.now() / 1000
    for (const n of this.nodes.values()) {
      n.userData?.updateFlareCamera?.(this.vp.camera)
      const fx = n.userData?.fx
      if (fx && fx.style && n.userData.light?.visible !== false) { n.userData.light.intensity = fx.base * lightMult(fx.style, tsec, fx.speed, fx.amount, fx.phase); n.userData.refreshLightEffects?.(); animated = true }
    }
    for (const item of this._physicalWaterView?.items.values() || []) {
      item.u.rtTime.value = tsec
      item.u.rtFaceted.value = this.vp.renderCfg?.psx ? 1 : 0
    }
    for (const n of this.nodes.values()) {
      const u = n.userData
      if (u.waterU && n.visible) { u.waterU.rtTime.value = tsec; if (u.waterMove) animated = true }
    }
    if (animated) this.vp.requestRender()
    return animated
  }

  dispose() {
    this._spectralWater?.dispose();this._spectralWater=null
    this._viewDiagnosticDestroyed = true
    this._releaseViewDiagnosticLod()
    this.nodeLifecycle.stop()
    clearTimeout(this._wmTimer)
    clearTimeout(this._brTimer)
    this.bake.dispose()
    this._removeWorldMoon()
    this.hidePhysicalWater()
    this.vp.precip.onImpact = null
    this.vp.precip.impact = null
    this.vp.precip.ground = null
    this._rainMeshes = null
    for (const n of this.nodes.values()) {
      if (n.userData.decalKey !== undefined) disposeDecal(n)
      n.userData.disposeModelMaterials?.()
      n.userData.disposeLightEffects?.()
      n.userData.disposeVfx?.()
    }
    this._disposeModelDecoders()
    this.forgetRoadTexture()
    this.vp.dispose()
  }
}

// Los métodos viven en engine/runtime/scene/*.js. Se copian los descriptores (no Object.assign) para que los getters no se ejecuten al mezclar.
function mixin(cls, methods) { Object.defineProperties(cls.prototype, Object.getOwnPropertyDescriptors(methods)) }
mixin(SceneGraph, objectsMethods)
mixin(SceneGraph, modelsMethods)
mixin(SceneGraph, texturesMethods)
mixin(SceneGraph, waterMethods)
mixin(SceneGraph, brushesMethods)
mixin(SceneGraph, terrainMethods)
mixin(SceneGraph, environmentMethods)
