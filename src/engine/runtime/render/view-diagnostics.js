// Herramientas editoriales de inspección del renderer real. No serializan ni modifican materiales de autoría.
// Las vistas sin un dato auténtico se declaran no disponibles, nunca se colorean con números fabricados.
import * as THREE from 'three'
import { VIEW_MODES, modeCapability, geometryTriangles, DIAGNOSTIC_HEAT_COLORS, DIAGNOSTIC_LOD_COLORS } from './view-diagnostics-contract.js'
import { effectiveTriangleSpan, faceColorBuffers } from './face-topology.js'
import { fragmentSourceMetrics } from './shader-source-metrics.js'
import { SPLAT_VS_DECL, SPLAT_FS_DECL, SPLAT_FS_COLOR } from '../geometry/terrain-splat.js'
import { TERRAIN_COMPLEXITY_VERTEX, TERRAIN_COMPLEXITY_FRAGMENT } from './trianghor/terrain-shader-cost.js'
export { VIEW_MODES, modeCapability, geometryTriangles } from './view-diagnostics-contract.js'

const PALETTE = ['#95a5b6', '#33bd87', '#e8c04a', '#ee8b43', '#dc566a', '#a55fe3', '#6649dc']
const LOD_COLORS = DIAGNOSTIC_LOD_COLORS
const WHITE = new THREE.Color('#ffffff')
const DEFAULT_GRAY = new THREE.Color('#778294')
const LIGHTING_NEUTRAL = new THREE.Color('#a0a0a0')
const LOD_TONES = LOD_COLORS.map(c => new THREE.Color(c))
const LIGHT_TONES = PALETTE.map(c => new THREE.Color(c))
const COST_TONES = DIAGNOSTIC_HEAT_COLORS.map(c => new THREE.Color(c))
// Escalas editoriales basadas en CONTEO, no en tiempo de GPU.
export const heatIndex = (count, cuts) => cuts.reduce((n, cut) => n + Number(count > cut), 0)

function materialParams(m) {
  return { side: m.side, transparent: !!m.transparent, opacity: m.opacity ?? 1,
    alphaTest: m.alphaTest || 0, alphaMap: m.alphaMap || null, vertexColors: !!m.vertexColors,
    depthTest: m.depthTest !== false, depthWrite: m.depthWrite !== false, clippingPlanes: m.clippingPlanes || null }
}

function materialOf(source, mode, color = WHITE) {
  const m = source || {}
  if (mode === 'unlit') {
    // Para shaders procedurales ajenos a Terrain, conservar el material original
    // es menos engañoso que reemplazarlo por blanco. Se informa como cobertura
    // parcial; no se afirma que el material conservado esté sin iluminación.
    if (m.isShaderMaterial || m.isRawShaderMaterial) return m
    const basic = new THREE.MeshBasicMaterial({ ...materialParams(m), color: m.color?.isColor ? m.color : WHITE,
      map: m.map || null, fog: !!m.fog, wireframe: false })
    if (m.userData?._lfTerrainSplatUniforms) {
      const uniforms = m.userData._lfTerrainSplatUniforms
      basic.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, uniforms)
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\n' + SPLAT_VS_DECL)
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSpA = splatA; vSpB = splatB; vTxz = (modelMatrix * vec4(position, 1.0)).xz;')
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\n' + SPLAT_FS_DECL)
          .replace('#include <color_fragment>', SPLAT_FS_COLOR)
      }
      basic.customProgramCacheKey = () => 'lf-view-unlit-terrain-splat-1'
    }
    return basic
  }
  if (mode === 'shader' && m.userData?._lfTerrainSplatUniforms) {
    // Las ramas por capa/textura dependen de los pesos interpolados de CADA píxel.
    // No colorear Terrain según ocho texturas potenciales que quizá no usa.
    return new THREE.ShaderMaterial({
      uniforms: { uLTex: m.userData._lfTerrainSplatUniforms.uLTex },
      vertexShader: TERRAIN_COMPLEXITY_VERTEX,
      fragmentShader: TERRAIN_COMPLEXITY_FRAGMENT,
      side:m.side,depthTest:m.depthTest!==false,depthWrite:m.depthWrite!==false,
      toneMapped:false,
    })
  }
  if (mode === 'overdraw') {
    return new THREE.MeshBasicMaterial({color:0x243050,transparent:true,opacity:0.10,
      blending:THREE.AdditiveBlending,depthTest:false,depthWrite:false,toneMapped:false})
  }
  if (mode === 'depth') return new THREE.MeshDepthMaterial({ ...materialParams(m), map: m.map || null, depthPacking: THREE.BasicDepthPacking })
  if (mode === 'normals') return new THREE.MeshNormalMaterial({ ...materialParams(m) })
  if (mode === 'indirect') {
    // IBL/sondas del renderizador real. No incluye ScreenBounce ni simula Lumen.
    return new THREE.MeshStandardMaterial({ ...materialParams(m), color: LIGHTING_NEUTRAL, metalness: 0, roughness: 1,
      normalMap: m.normalMap || null, normalScale: m.normalScale?.clone?.() || new THREE.Vector2(1,1) })
  }
  if (mode === 'lighting') {
    return new THREE.MeshStandardMaterial({ ...materialParams(m), color: LIGHTING_NEUTRAL, metalness: 0,
      roughness: m.roughness ?? 1, normalMap: m.normalMap || null,
      normalScale: m.normalScale?.clone?.() || new THREE.Vector2(1, 1),
      roughnessMap: m.roughnessMap || null })
  }
  return new THREE.MeshBasicMaterial({ ...materialParams(m), color, fog: false, wireframe: mode === 'wireframe' })
}

function activeLightCandidate(light, mesh, center, radius) {
  if (!light.visible || light.intensity <= 0 || !light.layers.test(mesh.layers)) return false
  if (light.isAmbientLight || light.isHemisphereLight) return false // luz ambiental no es una luz local individual
  if (light.isDirectionalLight) return true
  if (!light.isPointLight && !light.isSpotLight && !light.isRectAreaLight) return false
  const distance = light.getWorldPosition(new THREE.Vector3()).distanceTo(center)
  if (light.distance > 0 && distance > light.distance + radius) return false
  // Spot/Rect pueden depender de ángulo y geometría superficial: broad-phase conservador, no influencia por píxel.
  return true
}

export function candidateLightCount(mesh, lights) {
  const g = mesh.geometry
  if (!g) return 0
  if (!g.boundingSphere) g.computeBoundingSphere()
  mesh.updateWorldMatrix(true, false)
  const sphere = g.boundingSphere
  const center = sphere.center.clone().applyMatrix4(mesh.matrixWorld)
  const radius = sphere.radius * mesh.matrixWorld.getMaxScaleOnAxis()
  return lights.reduce((n, l) => n + Number(activeLightCandidate(l, mesh, center, radius)), 0)
}

/** La visualización es una transacción temporal: swap → renderer → restore incluso ante errores WebGL. */
export class ViewDiagnostics {
  constructor(viewport) {
    this.vp = viewport
    this._cache = new Map() // materiales de diagnóstico reutilizables; barrido por inactividad para no retener assets antiguos
    this._frame = 0
    this._background = new THREE.Color('#171c25')
    this._topologyCache = new Map()
    this._bufferIds = new WeakMap()
    this._nextBufferId = 0
    this._shaderMetrics = new WeakMap()
    this._topologyMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false })
    this._wireframeMaterial = new THREE.MeshBasicMaterial({ color: '#c5d5e7', side: THREE.DoubleSide, wireframe: true, toneMapped: false })
    this._last = { mode: 'lit', supported: true, inspected: 0, triangles: 0, details: '' }
  }

  /** El objeto WebGLProgram lo publica el renderer al compilar el material de autoría. */
  _compiledShaderMetrics(source) {
    const gl = this.vp.renderer.getContext()
    const program = this.vp.renderer.properties?.get(source)?.currentProgram
    if (!program?.program) return null
    const previous = this._shaderMetrics.get(source)
    if (previous?.program === program) {
      previous.version = source.version
      return previous.metrics
    }
    const shader = gl.getAttachedShaders(program.program)?.find(shader =>
      gl.getShaderParameter(shader, gl.SHADER_TYPE) === gl.FRAGMENT_SHADER)
    const code = shader ? gl.getShaderSource(shader) : program.fragmentShader
    const metrics = fragmentSourceMetrics(code)
    this._shaderMetrics.set(source, { program, version: source.version, metrics })
    return metrics
  }

  /**
   * Copia EXACTA de los triángulos enviados por la geometría seleccionada.
   * Solo existe durante un modo diagnóstico. No altera índices, assets ni materiales fuente.
   * Una geometría indexada debe expandirse: el mismo vértice puede pertenecer a caras de distinto color.
   */
  _bufferId(attribute) {
    if (!attribute) return 0
    let id = this._bufferIds.get(attribute)
    if (!id) { id = ++this._nextBufferId; this._bufferIds.set(attribute, id) }
    return id
  }

  _topology(geometry, mode, clusterId = 0) {
    const position = geometry.attributes?.position
    if (!position) return null
    const index = geometry.index
    const { first, faces } = effectiveTriangleSpan(geometry)
    if (!faces) return null
    const topologyMode = mode === 'wireframe' ? 'triangles' : mode
    const key = [geometry.uuid, topologyMode, clusterId, first, faces, this._bufferId(index), index?.version || 0,
      this._bufferId(position), position.version, position.data?.version || 0].join(':')
    let record = this._topologyCache.get(key)
    if (record) { record.last = this._frame; return record.geometry }
    const { xyz, colors } = faceColorBuffers(geometry, topologyMode, clusterId)
    const out = new THREE.BufferGeometry()
    out.setAttribute('position', new THREE.BufferAttribute(xyz, 3))
    out.setAttribute('color', new THREE.BufferAttribute(colors, 3, true))
    out.computeBoundingSphere()
    this._topologyCache.set(key, { geometry: out, last: this._frame })
    // No conservar indefinidamente geometrías diagnósticas de escenas editadas.
    if (this._topologyCache.size > 120 || this._frame % 120 === 0) {
      for (const [k, v] of this._topologyCache) if (this._frame - v.last > 12) {
        v.geometry.dispose(); this._topologyCache.delete(k)
      }
    }
    return out
  }

  _drawTopology(mode) {
    const { scene, renderer, camera, occlusion, perf } = this.vp
    const invisible = []
    const debugMeshes = []
    const background = scene.background
    const shadowEnabled = renderer.shadowMap.enabled
    let faces = 0, sourceMeshes = 0, gpuClusters = 0, direct = 0
    const material = mode === 'wireframe' ? this._wireframeMaterial : this._topologyMaterial
    const frustum = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
    // Recopilar antes de añadir sustitutos para no visitar nuestros propios meshes.
    const subjects = []
    scene.traverseVisible(obj => {
      if (!obj.isMesh || !obj.geometry) return
      if (obj.userData?.helper || obj.userData?.isHelper || obj.userData?.pickProxy) return
      if ([this.vp.sky, this.vp.overlay, this.vp.grid, this.vp.bolt?.mesh].includes(obj)) return
      for (let parent = obj.parent; parent; parent = parent.parent) if ([this.vp.overlay, this.vp.sky, this.vp.grid].includes(parent)) return
      subjects.push(obj)
    })
    const add = (geometry, source, id) => {
      if (!geometry) return
      const g = this._topology(geometry, mode, id)
      if (!g) return
      const debug = new THREE.Mesh(g, material)
      debug.matrixAutoUpdate = false
      debug.matrix.copy(source.matrixWorld)
      debug.matrixWorldNeedsUpdate = true
      debug.layers.mask = source.layers.mask
      debug.frustumCulled = true
      debug.castShadow = false
      debug.receiveShadow = false
      debug.renderOrder = source.renderOrder
      scene.add(debug)
      debugMeshes.push(debug)
      faces += g.attributes.position.count / 3
    }
    try {
      this._frame++
      for (const obj of [this.vp.sky, this.vp.overlay, this.vp.grid, this.vp.bolt?.mesh]) {
        if (obj && obj !== this.vp.sky) { invisible.push([obj, obj.visible]); obj.visible = false }
      }
      // Mantener el cielo volumétrico activo en TODOS los modos: su coste es real.
      scene.background = this._background
      for (const obj of subjects) {
        if (!obj.visible) continue
        const owner = obj._lfClusterSource
        const entry = this.vp.lodManager?.clusters?.byMesh.get(owner || obj)
        if (entry?.terrain && entry.terrainActive) {
          invisible.push([obj, obj.visible]); obj.visible = false
          for (const page of entry.terrainActive) {
            if (!page.debugGeometry) {
              const slice = new THREE.BufferGeometry()
              slice.setAttribute('position', obj.geometry.attributes.position)
              slice.setIndex(new THREE.BufferAttribute(page.index, 1))
              slice.boundingSphere = page.sphere.clone()
              page.debugGeometry = slice
            }
            add(page.debugGeometry, obj, sourceMeshes * 65536 + page.id)
            gpuClusters++
          }
          sourceMeshes++
        } else if (entry?.batch === obj && entry.shared?.pages && entry.ids) {
          invisible.push([obj, obj.visible]); obj.visible = false
          owner.updateWorldMatrix(true, false)
          for (let i = 0; i < entry.ids.length; i++) {
            const level = entry.ids[i].level
            const geo = entry.shared.pages[i]?.[level]?.geo
            if (!geo?.boundingSphere) continue
            const bounds = geo.boundingSphere.clone().applyMatrix4(owner.matrixWorld)
            if (!frustum.intersectsSphere(bounds)) continue
            add(geo, owner, i)
            gpuClusters++
          }
          sourceMeshes++
        } else if (entry?.directActive?.some(page => page.index)) {
          invisible.push([obj, obj.visible]); obj.visible = false
          obj.updateWorldMatrix(true, false)
          for (const page of entry.directActive) {
            if (!page.debugGeometry) {
              const slice = new THREE.BufferGeometry()
              slice.setAttribute('position', obj.geometry.attributes.position)
              slice.setIndex(new THREE.BufferAttribute(page.index, 1))
              slice.boundingSphere = page.bounds.clone()
              page.debugGeometry = slice
            }
            add(page.debugGeometry, obj, sourceMeshes * 65536 + page.id)
            gpuClusters++
          }
          direct++; sourceMeshes++
        } else if (!obj.isBatchedMesh) {
          invisible.push([obj, obj.visible]); obj.visible = false
          obj.updateWorldMatrix(true, false)
          add(obj.geometry, obj, sourceMeshes)
          direct++; sourceMeshes++
        }
      }
      renderer.shadowMap.enabled = false
      perf.time(`Diagnóstico · ${mode}`, () => occlusion.draw(camera, () => renderer.render(scene, camera)))
      this._last = { mode, supported: true, triangles: faces, inspected: sourceMeshes, gpuClusters, direct,
        details: mode === 'triangles'
          ? `${faces} caras de la geometría efectiva; ID de triángulo por color`
          : mode === 'wireframe'
            ? `${faces} triángulos efectivos representados por sus aristas; la triangulación coincide con Triangles`
            : `${gpuClusters} páginas geométricas inspeccionadas (incluye partición de dibujo directo); ${direct} fuentes de dibujo directo. La partición no implica un draw call por página.` }
    } finally {
      for (const m of debugMeshes) m.removeFromParent()
      for (const [o, visible] of invisible.reverse()) o.visible = visible
      scene.background = background
      renderer.shadowMap.enabled = shadowEnabled
    }
  }

  capability(mode) { return modeCapability(mode, { lodManager: this.vp.lodManager, renderer: this.vp.renderer, renderConfig: this.vp.renderCfg }) }
  get last() { return this._last }

  _material(source, mode, tone) {
    if (mode === 'unlit' && (source.isShaderMaterial || source.isRawShaderMaterial)) return source
    const id = source.uuid || source.id
    const key = `${id}:${mode}:${['lod','lights','shader'].includes(mode) ? tone.getHexString() : ''}`
    let rec = this._cache.get(key)
    if (rec && rec.version !== source.version) {
      rec.material.dispose()
      this._cache.delete(key)
      rec = null
    }
    if (!rec) {
      rec = { material: materialOf(source, mode, tone), version: source.version, last: this._frame }
      this._cache.set(key, rec)
    }
    rec.last = this._frame
    // Overdraw debe conservar mezcla aditiva, sin depth test ni escritura de profundidad.
    if (mode === 'overdraw') return rec.material
    // Los valores de autoría cambian también sin incrementar material.version (p. ej. color o textura).
    const m = rec.material
    if (mode === 'unlit') {
      m.color.copy(source.color?.isColor ? source.color : WHITE)
      if (m.map !== source.map) { m.map = source.map || null; m.needsUpdate = true }
    }
    m.opacity = source.opacity ?? 1
    m.transparent = !!source.transparent
    return m
  }

  _sweep() {
    if (this._frame % 120) return
    for (const [key, rec] of this._cache) if (this._frame - rec.last > 180) {
      rec.material.dispose()
      this._cache.delete(key)
    }
  }

  draw(mode) {
    const { scene, renderer, camera, occlusion, perf } = this.vp
    if (mode === 'wireframe' || mode === 'triangles' || mode === 'clusters' && this.vp.lodManager?.clusters) {
      this._drawTopology(mode); return true
    }
    const status = this.capability(mode)
    if (!status.supported) {
      this._last = { mode, supported: false, reason: status.reason, inspected: 0, triangles: 0 }
      // El caller ejecuta el pipeline Lit completo; no fingir una vista ni saltarse el postprocesado.
      return false
    }
    this._frame++
    this._sweep()
    const viewFrustum = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse))
    if (mode === 'shader') {
      // El WebGLProgram efectivo se publica DURANTE el dibujo, no solo con compile().
      let needsSourcePass = this._last.mode !== 'shader'
      scene.traverseVisible(obj => {
        if (!obj.isMesh || !obj.material) return
        // El cielo tiene su propia métrica por rayo y no entra en el caché de
        // materiales. Incluirlo aquí forzaba una segunda escena en CADA frame.
        if (obj === this.vp.sky || obj.parent === this.vp.sky || obj.userData?.helper || obj.userData?.isHelper || obj.userData?.pickProxy) return
        for (let parent = obj; parent; parent = parent.parent)
          if (parent === this.vp.overlay || parent === this.vp.grid) return
        if (!obj.layers.test(camera.layers)) return
        obj.updateWorldMatrix(true, false)
        if (obj.frustumCulled && !viewFrustum.intersectsObject(obj)) return
        for (const m of (Array.isArray(obj.material) ? obj.material : [obj.material])) {
          if (this._shaderMetrics.get(m)?.version !== m.version) needsSourcePass = true
        }
      })
      if (needsSourcePass) renderer.render(scene, camera) // una precarga REAL de autoría, solo cuando cambia
    }
    const saved = []
    const visibility = []
    const lodProxies = [], pendingLodPages = [], lodHistogram = {}
    const originalBackground = scene.background
    const lod = this.vp.lodManager
    const lodLevels = new Map(), terrainLevels = new Map(), clusterLevels = new Map()
    if (lod) {
      for (const entry of lod.clusters?.entries || []) if (entry.batch) clusterLevels.set(entry.batch, entry.ids?.map(x => x.level) || [])
      for (const e of lod.meshes) lodLevels.set(e.mesh, e.cur)
      for (const t of lod.terrains) terrainLevels.set(t.mesh, Math.max(0, Math.round(Math.log2(t.cur))))
    }
    const lights = []
    if (mode === 'indirect') scene.traverseVisible(o => { if (o.isLight) { visibility.push([o, o.visible]); o.visible = false } })
    if (mode === 'lights') scene.traverseVisible(o => { if (o.isLight) lights.push(o) })
    let inspected = 0, tris = 0, noLod = 0, maxLights = 0, shaderKnown = 0, shaderUnknown = 0, maxTextureCalls = 0, terrainDynamic = 0
    try {
      // Se ocultan únicamente ayudas/editor overlay, no entidades autorales; el cielo se deja neutral en vistas de datos.
      for (const o of [this.vp.overlay, this.vp.grid, this.vp.bolt?.mesh]) if (o) { visibility.push([o, o.visible]); o.visible = false }
      // Las nubes del mismo SkyMaterial no se excluyen del diagnóstico.
      // Shader muestra además su carga volumétrica por rayo en el propio cielo.
      scene.background = mode === 'overdraw' ? new THREE.Color(0x000000) : this._background
      if (mode === 'overdraw' && this.vp.sky?.visible) {
        visibility.push([this.vp.sky, true]);this.vp.sky.visible=false
      }
      scene.traverseVisible(obj => {
          if (!obj.isMesh || !obj.geometry || !obj.material) return
          if (obj === this.vp.sky || obj.parent === this.vp.sky) return
          if (obj.userData?.helper || obj.userData?.isHelper || obj.userData?.pickProxy || !obj.layers.test(camera.layers)) return
          if (mode === 'lod' && obj.isBatchedMesh) {
            const entry = lod?.clusters?.byMesh.get(obj._lfClusterSource)
            if (entry?.batch === obj && entry.shared?.pages) {
              visibility.push([obj, obj.visible]); obj.visible = false
              entry.mesh.updateWorldMatrix(true, false)
              for (let i = 0; i < entry.ids.length; i++) {
                const level = entry.ids[i].level, geometry = entry.shared.pages[i]?.[level]?.geo
                if (!geometry?.boundingSphere || !viewFrustum.intersectsSphere(
                  geometry.boundingSphere.clone().applyMatrix4(entry.mesh.matrixWorld))) continue
                pendingLodPages.push({ geometry, source: entry.mesh, level })
              }
              return
            }
          }
          obj.updateWorldMatrix(true, false)
          if (obj.frustumCulled && !viewFrustum.intersectsObject(obj)) return
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
          let tone = WHITE
          if (mode === 'lod' || mode === 'clusters') {
            const level = mode === 'clusters' ? clusterLevels.get(obj)?.[0]
              : lodLevels.get(obj) ?? terrainLevels.get(obj) ??
                (lod?.clusters?.byMesh.get(obj)?.terrain
                  ? Math.max(0, Math.round(Math.log2(lod.clusters.byMesh.get(obj).terrainStride || 1)))
                  : undefined)
            if (level === undefined) { tone = DEFAULT_GRAY; noLod++ }
            else {
              tone = LOD_TONES[Math.min(level, LOD_TONES.length - 1)]
              lodHistogram[level] = (lodHistogram[level] || 0) + geometryTriangles(obj)
            }
          } else if (mode === 'lights') {
            const count = candidateLightCount(obj, lights)
            maxLights = Math.max(maxLights, count)
            tone = COST_TONES[heatIndex(count, [0,1,2,4,8])]
          } else if (mode === 'shader') {
            if (mats.some(m=>m.userData?._lfTerrainSplatUniforms)) terrainDynamic++
            const scores = mats.map(m => this._compiledShaderMetrics(m))
            const known = scores.filter(Boolean)
            if (!known.length) { tone = DEFAULT_GRAY; shaderUnknown++ }
            else {
              shaderKnown++
              const count = Math.max(...known.map(x => x.textureCalls))
              maxTextureCalls = Math.max(maxTextureCalls, count)
              tone = COST_TONES[heatIndex(count, [1,3,7,15,31])]
            }
          }
          const replacements = mats.map(m => this._material(m, mode === 'clusters' ? 'lod' : mode, tone))
          saved.push([obj, obj.material])
          obj.material = Array.isArray(obj.material) ? replacements : replacements[0]
          tris += geometryTriangles(obj); inspected++
        })
      // Cada página conserva su nivel y topología efectivos; el lote puede
      // contener varios LOD simultáneamente. No colorearlo con ids[0].level.
      for (const { geometry, source, level } of pendingLodPages) {
        const proxy = new THREE.Mesh(geometry, this._material(source.material, 'lod', LOD_TONES[Math.min(level, LOD_TONES.length - 1)]))
        proxy.matrixAutoUpdate = false
        proxy.matrix.copy(source.matrixWorld)
        proxy.layers.mask = source.layers.mask
        scene.add(proxy); lodProxies.push(proxy)
        const count = geometryTriangles(proxy)
        tris += count; inspected++
        lodHistogram[level] = (lodHistogram[level] || 0) + count
      }
      // No se usa el compositor ni los efectos de color: el diagnóstico muestra una salida directa y claramente identificada.
      const uniforms = this.vp.skyMat?.uniforms
      const previousCloudDebug = uniforms?.uCloudDiagnostic?.value ?? 0
      if (uniforms?.uCloudDiagnostic) uniforms.uCloudDiagnostic.value = mode === 'shader' ? 1 : 0
      try { perf.time(`Diagnóstico · ${mode}`, () => occlusion.draw(camera, () => renderer.render(scene, camera))) }
      finally { if (uniforms?.uCloudDiagnostic) uniforms.uCloudDiagnostic.value = previousCloudDebug }
      this._last = { mode, supported: true, inspected, triangles: tris, noLod, maxLights, shaderKnown, shaderUnknown, maxTextureCalls, terrainDynamic, clusterBatches: clusterLevels.size,
        lodHistogram,
        cloudVisible: !!this.vp.sky?.visible && uniforms?.uClouds?.value === 1, cloudStepsBudget: uniforms?.uCloudSteps?.value ?? null,
        legend: mode === 'overdraw' ? 'Aportaciones aditivas de fragmentos geométricos sin prueba de profundidad; NO tiempo GPU.'
          : mode === 'shader' ? 'GLSL lecturas de textura: verde 0–1 · lima 2–3 · amarillo 4–7 · naranja 8–15 · rojo 16–31 · violeta >31. Cielo: iteraciones de raymarch por píxel, proporción del máximo.'
          : mode === 'lights' ? 'Luces candidatas por objeto: verde 0 · lima 1 · amarillo 2 · naranja 3–4 · rojo 5–8 · violeta >8. Estimación CPU, NO tiempo GPU.'
          : mode === 'lod' ? 'Niveles geométricos efectivos; gris = sin nivel gestionado. No es un mapa térmico de rendimiento.'
          : null,
        details: mode === 'lod' ? `Niveles geométricos efectivos (incluye Terrain nativo): ${tris} triángulos inspeccionados; ${noLod} mallas sin LOD. Acerca y aleja la cámara para ver el cambio.`
          : mode === 'lights' ? `Luces candidatas máximas por objeto: ${maxLights}; estimación CPU, NO coste de fragmentos`
          : mode === 'clusters' ? `Lotes residentes: ${clusterLevels.size}; otros objetos sin clúster: ${noLod}`
          : mode === 'indirect' ? 'Contribución ambiental real: IBL y sondas activas. ScreenBounce excluido (sin salida separada).'
          : mode === 'overdraw' ? `Acumulación visible de fragmentos de geometría, sin depth-test. Cielo fuera del mapa de overdraw.`
          : mode === 'shader' ? `GLSL fragment original: ${shaderKnown} materiales compilados, ${shaderUnknown} sin fuente; máximo ${maxTextureCalls} llamadas de textura en código fuente. Métrica ESTÁTICA, NO tiempo GPU.`
          : mode === 'unlit' ? `Albedo de Terrain con sus capas y mapas; materiales procedurales ajenos sin ruta Unlit conservan su shader original (cobertura parcial). Nubes visibles.`
          : `Triángulos de objetos inspeccionados: ${tris}` }
    } finally {
      for (const proxy of lodProxies) proxy.removeFromParent()
      for (const [obj, material] of saved) obj.material = material
      for (const [obj, visible] of visibility) obj.visible = visible
      scene.background = originalBackground
    }
  }

  dispose() {
    for (const entry of this._cache.values()) entry.material.dispose()
    this._cache.clear()
    for (const entry of this._topologyCache.values()) entry.geometry.dispose()
    this._topologyCache.clear()
    this._topologyMaterial.dispose()
    this._wireframeMaterial.dispose()
  }
}
