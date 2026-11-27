import * as THREE from 'three'
import { clamp, lerp, fbm, b64ToBytes, uid } from '../util.js'
import { Foliage } from './foliage.js'
import { patchTerrainWet, WET_COLOR, WET_ROUGH, WET_NORMAL } from '../render/wetlib.js'
import { makeCanvas } from '../platform.js'
import { terrainBakePlan, normalizeTerrainBake } from '../render/terrain-bake.js'
import { releaseTerrainBakeWorker } from '../render/trianghor/worker-service.js'

import { MAX_LAYERS, STRIDE, DEFAULT_LAYERS, normalizeLayers, SPLAT_VS_DECL, SPLAT_FS_DECL, SPLAT_FS_COLOR } from './terrain-splat.js'
export { MAX_LAYERS, DEFAULT_LAYERS, normalizeLayers }
const TEX_RES = 512 // resolución a la que se normalizan las texturas de las capas


import { DEFAULT_TERRAIN_GENERATOR, terrainGeneratorParams, storedTerrainGeneratorParams, smooth, coastOutline, coastLandMask, coastSignedDistance, coastReliefField, coastReliefAt, coastalCliffMix, coastalReliefScale, relaxCoastalSlopes } from './terrain-gen.js'
import { layerMethods } from './terrain-layers.js'
import { brushMethods } from './terrain-brush.js'
import { ioMethods } from './terrain-io.js'
export { DEFAULT_TERRAIN_GENERATOR }

// Pixeles ya reducidos de cada textura (por id de archivo), para no decodificar de nuevo al cambiar capas.
const pixelCache = new Map()
export async function layerPixels(id) {
  if (pixelCache.has(id)) return pixelCache.get(id)
  const img = await Terrain.loader?.(id)
  if (!img) return null
  const c = makeCanvas()
  c.width = c.height = TEX_RES
  const g = c.getContext('2d', { willReadFrequently: true })
  g.drawImage(img, 0, 0, TEX_RES, TEX_RES)
  const px = g.getImageData(0, 0, TEX_RES, TEX_RES).data
  let r = 0, gr = 0, b = 0, n = 0
  for (let i = 0; i < px.length; i += 4 * 97) { r += px[i]; gr += px[i + 1]; b += px[i + 2]; n++ }
  const out = { px, avg: new THREE.Color().setRGB(r / n / 255, gr / n / 255, b / n / 255, THREE.SRGBColorSpace) }
  pixelCache.set(id, out)
  return out
}
export const forgetLayerTexture = (id) => pixelCache.delete(id)


/**
 * Terreno por mapa de alturas.
 * - heights: Float32Array((n+1)^2)   (fila = Z, columna = X)
 * - splat:   Uint8Array((n+1)^2 * 8) pesos de hasta 8 capas de pintura (color plano o textura)
 * En pantalla se mezcla en el shader (texturas en un DataArrayTexture). Además se mantiene un color por
 * vértice (promedio de las capas) que es lo que se exporta a GLB.
 */
export class Terrain {
  /** Cargador de imágenes por id de archivo del proyecto (lo fija el editor). */
  static loader = null

  constructor(size = 64, segments = 128, layers = DEFAULT_LAYERS) {
    this.id = uid()
    this.name = 'Terreno'
    this.ox = 0 // posición mundial del centro; el mapa de alturas conserva cotas locales
    this.oy = 0
    this.oz = 0
    this.size = size
    this.segments = segments
    this.depth = size
    this.segmentsZ = segments
    this.layers = normalizeLayers(layers)
    this.heights = new Float32Array((segments + 1) ** 2)
    this.splat = new Uint8Array((segments + 1) ** 2 * STRIDE)
    for (let i = 0; i < this.heights.length; i++) this.splat[i * STRIDE] = 255
    this._avg = []
    this._texSig = ''
    this._texTok = 0
    this.mesh = null
    this.version = 0
    this.terrainBake = null // configuración de Hornear Mapa, no reemplaza la geometría editable
    this.bakeInfo = null
    this._bakeVersion = -1 // índice derivado, reconstruible al editar/cargar
    this._cache = null
    this._dirty = null
    this.enabled = true // false = la escena no tiene terreno (nodo eliminado)
    this.visible = true // bandera visual independiente; ocultar no desactiva colisiones
    this.generator = null // null en escenas antiguas / nunca generadas; no se regenera al cargar
    this.onFoliageChange = null
    this.foliage = new Foliage(this)
    this._buildMesh()
    this._syncTextures()
  }

  get n1() { return this.segments + 1 }
  get nz1() { return this.segmentsZ + 1 }
  get step() { return this.size / this.segments }

  _buildMesh() {
    this.clearEdgePreview()
    const n1 = this.n1, n = this.segments, nz = this.segmentsZ
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n1 * this.nz1 * 3), 3))
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n1 * this.nz1 * 3), 3))
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n1 * this.nz1 * 3), 3))
    this._ib = new THREE.InterleavedBuffer(this.splat, STRIDE)
    geo.setAttribute('splatA', new THREE.InterleavedBufferAttribute(this._ib, 4, 0, true))
    geo.setAttribute('splatB', new THREE.InterleavedBufferAttribute(this._ib, 4, 4, true))
    const idx = new Uint32Array(n * nz * 6)
    let k = 0
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < n; i++) {
        const a = j * n1 + i, b = a + 1, c = a + n1, d = c + 1
        idx[k++] = a; idx[k++] = c; idx[k++] = b
        idx[k++] = b; idx[k++] = c; idx[k++] = d
      }
    }
    geo.setIndex(new THREE.BufferAttribute(idx, 1))
    if (this.mesh) { this.mesh.geometry.dispose(); this.mesh.geometry = geo }
    else this.mesh = new THREE.Mesh(geo, this._makeMaterial())
    this.mesh.name = 'Terrain'
    this.mesh.userData._lfNativeTerrain = true // candidato geométrico nativo, no atributo serializable del proyecto
    this.mesh.receiveShadow = true
    this.mesh.castShadow = true
    this.mesh.frustumCulled = false
    this.refreshAll()
  }

  _makeMaterial() {
    const dummy = new THREE.DataArrayTexture(new Uint8Array(4), 1, 1, 1)
    dummy.needsUpdate = true
    const u = this._uniforms = {
      uLCol: { value: Array.from({ length: MAX_LAYERS }, () => new THREE.Color()) },
      uLTile: { value: new Array(MAX_LAYERS).fill(4) },
      uLTex: { value: new Array(MAX_LAYERS).fill(-1) },
      uLayerTex: { value: dummy },
    }
    const mirror = this.wetMirror ||= {
      uWetMirrorMap: { value: null }, uWetMirrorStrength: { value: 0 },
      uWetMirrorMatrix: { value: new THREE.Matrix4() }, uWetMirrorHeight: { value: 0 },
    }
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 })
    // Diagnóstico Unlit: compartir EXACTAMENTE capas y pesos de este Terrain.
    // No copiar el material PBR ni inventar un albedo blanco.
    mat.userData._lfTerrainSplatUniforms = u
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u)
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\n' + SPLAT_VS_DECL)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSpA = splatA; vSpB = splatB; vTxz = (modelMatrix * vec4(position, 1.0)).xz;')
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\n' + SPLAT_FS_DECL)
        // Un solo punto de inserción: la mezcla de capas elimina color_fragment.
        .replace('#include <color_fragment>', SPLAT_FS_COLOR + '\n' + WET_COLOR)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + WET_ROUGH)
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + WET_NORMAL)
      patchTerrainWet(sh, mirror)
    }
    mat.customProgramCacheKey = () => 'rt-terrain-splat-wfx-wet'
    this._applyLayerUniforms()
    return mat
  }

  _applyLayerUniforms() {
    const u = this._uniforms
    if (!u) return
    this.layers.forEach((l, k) => { u.uLCol.value[k].set(l.color); u.uLTile.value[k] = l.tile })
  }

  /** (Re)carga las texturas de las capas en el DataArrayTexture. Mientras llegan, se ve el color plano. */
  async _syncTextures() {
    const sig = JSON.stringify(this.layers.map((l) => [l.texture, l.tile]))
    if (sig === this._texSig) return
    this._texSig = sig
    const tok = ++this._texTok
    const withTex = this.layers.map((l, k) => [l, k]).filter(([l]) => l.texture)
    if (!withTex.length && !this._hadTex) return // sin texturas antes ni ahora: nada que reconstruir
    const loaded = []
    for (const [l, k] of withTex) {
      try { const px = await layerPixels(l.texture); if (px) loaded.push({ k, px }) } catch (e) { console.warn('Textura de capa no legible', e) }
    }
    if (tok !== this._texTok || !this.mesh) return
    const u = this._uniforms
    const old = u.uLayerTex.value
    this._avg = []
    u.uLTex.value.fill(-1)
    if (loaded.length) {
      const data = new Uint8Array(TEX_RES * TEX_RES * 4 * loaded.length)
      loaded.forEach(({ k, px }, n) => { data.set(px.px, n * TEX_RES * TEX_RES * 4); u.uLTex.value[k] = n; this._avg[k] = px.avg })
      const tex = new THREE.DataArrayTexture(data, TEX_RES, TEX_RES, loaded.length)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping
      tex.minFilter = THREE.LinearMipmapLinearFilter
      tex.magFilter = THREE.LinearFilter
      tex.generateMipmaps = true
      tex.anisotropy = 4
      tex.needsUpdate = true
      u.uLayerTex.value = tex
    } else {
      const d = new THREE.DataArrayTexture(new Uint8Array(4), 1, 1, 1); d.needsUpdate = true
      u.uLayerTex.value = d
    }
    old.dispose()
    this._hadTex = loaded.length > 0
    this.onTexturesChanged?.()
  }

  /** Hornea y registra un nivel de dibujo verificado; los índices los consumen los clústeres nativos. */
  bakeOptimized(settings, prepared = undefined) {
    const cfg = normalizeTerrainBake(settings)
    if (!cfg) return null
    // El Worker calcula el plan. La ruta síncrona se conserva para pruebas y
    // herramientas sin renderer; el botón de Escena SIEMPRE utiliza el Worker.
    const plan = prepared === undefined
      ? terrainBakePlan(this.heights,this.splat,this.segments,this.segmentsZ,cfg) : prepared
    if (!plan || plan.sourceTriangles !== 2*this.segments*this.segmentsZ ||
        (plan.index && plan.index.length !== plan.triangles*3)) throw new Error('TriangHor: plan incompatible')
    this.terrainBake = cfg
    this.bakeInfo = plan
    this.version++
    this._bakeVersion = this.version
    return plan
  }

  clearOptimizedBake() {
    if (!this.terrainBake) return false
    this.terrainBake = null; this.bakeInfo = null; this._bakeVersion = -1; this.version++
    return true
  }

  // ---------- acceso ----------
  idx(i, j) { return j * this.n1 + i }

  // ---------- posición en el mundo (varias piezas de terreno) ----------
  setOffset(x, z, y = this.oy) {
    if (![x, y, z].every(Number.isFinite)) return
    this.ox = x; this.oy = y; this.oz = z
    this.mesh.position.set(x, y, z)
    this.foliage.group.position.set(x, y, z)
    this.mesh.updateMatrixWorld(true)
    this.foliage.group.updateMatrixWorld(true)
    this.version++
  }
  /** Límites en el mundo. */
  get bounds() { const x = this.size / 2, z = this.depth / 2; return { x0: this.ox - x, x1: this.ox + x, z0: this.oz - z, z1: this.oz + z } }
  contains(x, z, pad = 0) { return Math.abs(x - this.ox) <= this.size / 2 + pad && Math.abs(z - this.oz) <= this.depth / 2 + pad }
  /** Altura en coordenadas del mundo; NaN fuera de la pieza (o si está desactivada). */
  groundAt(x, z) { return this.enabled && this.contains(x, z) ? this.oy + this.heightAt(x - this.ox, z - this.oz) : NaN }
  /** raycast con el rayo en coordenadas del mundo → punto en el mundo. */
  raycastW(ray, maxDist = 2000) {
    if (!this.enabled) return null
    const local = new THREE.Ray(new THREE.Vector3(ray.origin.x - this.ox, ray.origin.y - this.oy, ray.origin.z - this.oz), ray.direction)
    const h = this.raycast(local, maxDist)
    if (!h) return null
    h.point.x += this.ox; h.point.y += this.oy; h.point.z += this.oz
    h.piece = this
    return h
  }

  /** Índice de la capa de pintura dominante en un punto del mundo (la de más peso en el vértice más cercano); -1 fuera. */
  paintAt(x, z) {
    if (!this.enabled || !this.contains(x, z)) return -1
    const hx = this.size / 2, hz = this.depth / 2
    const i = clamp(Math.round((x - this.ox + hx) / this.step), 0, this.segments), j = clamp(Math.round((z - this.oz + hz) / this.step), 0, this.segmentsZ)
    const o = (j * this.n1 + i) * STRIDE
    let best = 0
    for (let k = 1; k < Math.min(STRIDE, this.layers.length); k++) if (this.splat[o + k] > this.splat[o + best]) best = k
    return best
  }

  heightAt(x, z) {
    if (!this.enabled) return 0
    const fx = clamp((x + this.size / 2) / this.step, 0, this.segments)
    const fz = clamp((z + this.depth / 2) / this.step, 0, this.segmentsZ)
    const i0 = Math.min(Math.floor(fx), this.segments - 1)
    const j0 = Math.min(Math.floor(fz), this.segmentsZ - 1)
    const tx = fx - i0, tz = fz - j0
    const h = this._ramp ? this._ramp.base : this.heights, n1 = this.n1 // durante una rampa se «ve» el relieve original (puntería estable)
    const h00 = h[j0 * n1 + i0], h10 = h[j0 * n1 + i0 + 1]
    const h01 = h[(j0 + 1) * n1 + i0], h11 = h[(j0 + 1) * n1 + i0 + 1]
    return lerp(lerp(h00, h10, tx), lerp(h01, h11, tx), tz)
  }

  /** Rango [min, max] de alturas. Se cachea; el pincel solo lo amplía (conservador) y refreshAll lo recalcula. */
  heightRange() {
    if (!this._range) {
      let mn = Infinity, mx = -Infinity
      for (let i = 0; i < this.heights.length; i++) {
        const v = this.heights[i]
        if (v < mn) mn = v
        if (v > mx) mx = v
      }
      this._range = [mn, mx]
    }
    return this._range
  }

  // ---------- actualización de geometría ----------
  _layerColors() {
    const out = this.layers.map((l, k) => (l.texture && this._avg[k] ? this._avg[k] : new THREE.Color(l.color)))
    while (out.length < STRIDE) out.push(new THREE.Color(0, 0, 0))
    return out
  }

  refreshAll() {
    this._range = null
    this.refreshRegion(0, 0, this.segments, this.segmentsZ, true)
    this._dirty = null
    this.foliage?.refreshHeights()
  }

  refreshRegion(i0, j0, i1, j1, normals = false) {
    const geo = this.mesh.geometry
    const pos = geo.attributes.position.array
    const n1 = this.n1, half = this.size / 2, halfZ = this.depth / 2, step = this.step
    const r = this._range
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const v = j * n1 + i
        pos[v * 3] = -half + i * step
        const hv = this.heights[v]
        pos[v * 3 + 1] = hv
        if (r) { if (hv < r[0]) r[0] = hv; else if (hv > r[1]) r[1] = hv }
        pos[v * 3 + 2] = -halfZ + j * step
      }
    }
    this._upload(geo.attributes.position, j0, j1)
    this._uploadSplat(j0, j1)
    this.version++
    if (normals) this.computeNormals(i0, j0, i1, j1)
  }

  /** Calcula el color por vértice (promedio de las capas, para GLB). Solo hace falta al exportar. */
  bakeColors() {
    const col = this.mesh.geometry.attributes.color.array
    const lc = this._layerColors()
    const S = this.splat
    for (let v = 0, n = this.n1 * this.nz1; v < n; v++) {
      let cr = 0, cg = 0, cb = 0, sum = 0
      for (let k = 0; k < STRIDE; k++) {
        const w = S[v * STRIDE + k]
        if (!w) continue
        sum += w; cr += lc[k].r * w; cg += lc[k].g * w; cb += lc[k].b * w
      }
      sum = sum || 1
      col[v * 3] = cr / sum; col[v * 3 + 1] = cg / sum; col[v * 3 + 2] = cb / sum
    }
    return col
  }

  computeNormals(i0 = 0, j0 = 0, i1 = this.segments, j1 = this.segmentsZ) {
    // Normales por diferencias finitas, solo en la región tocada (el pincel no recalcula todo el mapa).
    const geo = this.mesh.geometry
    const nor = geo.attributes.normal.array
    const n1 = this.n1, h = this.heights, step = this.step
    i0 = Math.max(0, i0 - 1); j0 = Math.max(0, j0 - 1)
    i1 = Math.min(n1 - 1, i1 + 1); j1 = Math.min(this.segmentsZ, j1 + 1)
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const hl = h[j * n1 + Math.max(i - 1, 0)], hr = h[j * n1 + Math.min(i + 1, n1 - 1)]
        const hd = h[Math.max(j - 1, 0) * n1 + i], hu = h[Math.min(j + 1, this.segmentsZ) * n1 + i]
        const dx = (hr - hl) / (step * (i === 0 || i === n1 - 1 ? 1 : 2))
        const dz = (hu - hd) / (step * (j === 0 || j === this.segmentsZ ? 1 : 2))
        const l = Math.hypot(dx, 1, dz)
        const v = (j * n1 + i) * 3
        nor[v] = -dx / l; nor[v + 1] = 1 / l; nor[v + 2] = -dz / l
      }
    }
    this._upload(geo.attributes.normal, j0, j1)
  }

  _uploadSplat(j0, j1) {
    const ib = this._ib, row = this.n1 * STRIDE
    if (j0 <= 0 && j1 >= this.segmentsZ) ib.clearUpdateRanges()
    else ib.addUpdateRange(j0 * row, (j1 - j0 + 1) * row)
    ib.needsUpdate = true
  }

  /** Marca para subir a la GPU solo las filas j0..j1 (la subida completa si abarca todo el mapa). */
  _upload(attr, j0, j1) {
    const row = this.n1 * attr.itemSize
    if (j0 <= 0 && j1 >= this.segmentsZ) attr.clearUpdateRanges()
    else attr.addUpdateRange(j0 * row, (j1 - j0 + 1) * row)
    attr.needsUpdate = true
  }

  // ---------- generación ----------
  generate(options = {}) {
    const p = terrainGeneratorParams(options)
    // Una nueva Generate aplica el litoral acotado al lienzo. Las alturas previamente
    // guardadas NO se recalculan al abrir ni al restaurar snapshots.
    if (p.shape !== 'terrain') { p.coastlineVersion = 4; p.reliefVersion = 3 }
    const { shape, seed, scale, amplitude, octaves, roughness, island, coastRoughness, beachWidth, cliffStrength, seaLevel } = p
    const half = this.size / 2, halfZ = this.depth / 2, n1 = this.n1, step = this.step
    const genSpan = Math.max(this.size, this.depth)
    const genSegments = Math.max(this.segments, this.segmentsZ)
    let coastDistances = null
    if (shape !== 'terrain') {
      const field = coastSignedDistance(
        coastLandMask(genSpan, genSegments, coastOutline(genSpan, seed, coastRoughness, shape), shape, seed, coastRoughness),
        genSegments, genSpan / genSegments,
      )
      if (this.size === genSpan && this.depth === genSpan && this.segments === genSegments) coastDistances = field
      else {
        coastDistances = new Float32Array(this.n1 * this.nz1)
        const st = genSpan / genSegments, row = genSegments + 1
        for (let j = 0; j <= this.segmentsZ; j++) for (let i = 0; i <= this.segments; i++) {
          const x = -half + i * step, z = -halfZ + j * step
          const fx = clamp((x + genSpan / 2) / st, 0, genSegments)
          const fz = clamp((z + genSpan / 2) / st, 0, genSegments)
          const ix = Math.min(Math.floor(fx), genSegments - 1), iz = Math.min(Math.floor(fz), genSegments - 1)
          coastDistances[j * n1 + i] = lerp(
            lerp(field[iz * row + ix], field[iz * row + ix + 1], fx - ix),
            lerp(field[(iz + 1) * row + ix], field[(iz + 1) * row + ix + 1], fx - ix), fz - iz,
          )
        }
      }
    }
    const landforms = coastDistances ? coastReliefField(seed) : null
    const reliefScale = coastDistances ? coastalReliefScale(genSpan, shape) : 0
    const beach = Math.max(step, beachWidth)
    for (let j = 0; j < this.nz1; j++) {
      for (let i = 0; i < n1; i++) {
        const x = -half + i * step, z = -halfZ + j * step
        let h
        if (shape === 'terrain') {
          // Comportamiento histórico exacto: sin cambios de semántica ni ruido.
          const noise = fbm(x * scale + seed * 13.7, z * scale + seed * 7.1, { octaves, gain: roughness, seed })
          h = noise * amplitude
          if (island > 0) {
            const d = Math.min(1, Math.hypot(x, z) / half)
            h = h * (1 - island * d * d) - island * amplitude * d * d * d
          }
        } else {
          // SDF firmado: la costa es el origen de altura, no el centro de la isla.
          const distance = coastDistances[j * n1 + i]
          if (distance >= 0) {
            // Mantener la playa baja, elevar acantilados cerca de la costa.
            const beachRise = 0.10 * smooth(distance / beach)
            const inlandRise = 0.90 * smooth((distance - beach) / (half * 0.44))
            const cliffRise = 0.78 * smooth(distance / Math.max(step, beach * 0.20))
              + 0.22 * smooth(distance / (half * 0.40))
            const relief = coastReliefAt(landforms, x, z, genSpan)
            // Tipo de costa por región: el control define una tendencia,
            // no obliga a que cada metro de litoral sea playa o acantilado.
            const localCliff = coastalCliffMix(relief, cliffStrength)
            const coastProfile = (1 - localCliff) * (beachRise + inlandRise) + localCliff * cliffRise
            const landformsWeight = smooth(Math.max(0, distance - beach * 0.45) / (genSpan * 0.12))
            // Crestas y valles sólo predominan tierra adentro; sin relieves
            // artificialmente abruptos sobre la orilla arenosa.
            const variation = lerp(0.38, relief, landformsWeight)
            h = seaLevel + reliefScale * coastProfile * variation
          } else {
            // Batimetría moderada independiente de Height y de los controles
            // específicos del generador Original Terrain.
            h = seaLevel - reliefScale * 0.44 * smooth(-distance / (genSpan * 0.23 + beach))
          }
        }
        this.heights[j * n1 + i] = h
      }
    }
    if (coastDistances) relaxCoastalSlopes(this.heights, coastDistances, this.segments, step, beach, this.segmentsZ)
    this.generator = p
    this.refreshAll()
  }

  flat(height = 0) {
    this.heights.fill(height)
    this.refreshAll()
  }

  /** Cambia tamaño/resolución remuestreando alturas y pintura (operación distinta de extender bordes). */
  resize(size, segments) {
    const old = { size: this.size, depth: this.depth, segments: this.segments, segmentsZ: this.segmentsZ, n1: this.n1, step: this.step, h: this.heights, s: this.splat }
    this.size = size
    this.segments = segments
    this.depth = size
    this.segmentsZ = segments
    this.heights = new Float32Array((segments + 1) ** 2)
    this.splat = new Uint8Array((segments + 1) ** 2 * STRIDE)
    const oh = old.size / 2, oz = old.depth / 2, half = size / 2, n1 = this.n1, step = this.step
    for (let j = 0; j < n1; j++) {
      for (let i = 0; i < n1; i++) {
        const x = -half + i * step, z = -half + j * step
        const ox = x + oh, oldZ = z + oz
        const inside = ox >= 0 && oldZ >= 0 && ox <= old.size && oldZ <= old.depth
        const v = j * n1 + i
        if (!inside) { this.splat[v * STRIDE] = 255; continue }
        const fi = clamp(ox / old.step, 0, old.segments), fj = clamp(oldZ / old.step, 0, old.segmentsZ)
        const i0 = Math.min(Math.floor(fi), old.segments - 1), j0 = Math.min(Math.floor(fj), old.segmentsZ - 1)
        const tx = fi - i0, tz = fj - j0
        const g = (a, ii, jj) => a[jj * old.n1 + ii]
        this.heights[v] = lerp(lerp(g(old.h, i0, j0), g(old.h, i0 + 1, j0), tx), lerp(g(old.h, i0, j0 + 1), g(old.h, i0 + 1, j0 + 1), tx), tz)
        const ni = tx > 0.5 ? i0 + 1 : i0, nj = tz > 0.5 ? j0 + 1 : j0
        for (let k = 0; k < STRIDE; k++) this.splat[v * STRIDE + k] = old.s[(nj * old.n1 + ni) * STRIDE + k]
      }
    }
    this._buildMesh()
    this.foliage.clipToTerrain()
  }

  /** Datos de una extensión calculados sin mutar la pieza ni su malla. */
  _edgeData(side, cells) {
    if (!['px','nx','pz','nz'].includes(side) || !Number.isInteger(cells) || cells === 0) return null
    const xEdge = side.endsWith('x'), x0 = this.segments, z0 = this.segmentsZ
    const nx = x0 + (xEdge ? cells : 0), nz = z0 + (xEdge ? 0 : cells)
    if (nx < 8 || nz < 8 || nx > 1024 || nz > 1024 || (nx + 1) * (nz + 1) > 262144) return null
    const newX0 = side === 'nx' ? cells : 0, newZ0 = side === 'nz' ? cells : 0
    const H = new Float32Array((nx + 1) * (nz + 1))
    const S = new Uint8Array(H.length * STRIDE)
    const ni = this.n1, half = cells * this.step / 2
    const dx = side === 'px' ? half : side === 'nx' ? -half : 0
    const dz = side === 'pz' ? half : side === 'nz' ? -half : 0
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const oi = Math.min(x0, Math.max(0, i - newX0))
      const oj = Math.min(z0, Math.max(0, j - newZ0))
      const src = oj * ni + oi, dst = j * (nx + 1) + i
      H[dst] = this.heights[src]
      S.set(this.splat.subarray(src * STRIDE, (src + 1) * STRIDE), dst * STRIDE)
    }
    return { H, S, nx, nz, dx, dz, step: this.step }
  }

  /** Solo render: previsualización reversible. Ni alturas ni pintura ni física cambian durante el gesto. */
  previewEdge(side, cells) {
    if (cells === 0) { this.clearEdgePreview(); return true }
    if (this._edgePreview?.side === side && this._edgePreview?.cells === cells) return true
    const next = this._edgeData(side, cells)
    if (!next) return false
    this.clearEdgePreview()
    const { H, S, nx, nz, dx, dz, step } = next
    const row = nx + 1, count = row * (nz + 1)
    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const normals = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const v = j * row + i, k = v * 3
      positions[k] = -nx * step / 2 + i * step
      positions[k + 1] = H[v]
      positions[k + 2] = -nz * step / 2 + j * step
      const left = H[j * row + Math.max(0, i - 1)], right = H[j * row + Math.min(nx, i + 1)]
      const up = H[Math.min(nz, j + 1) * row + i], down = H[Math.max(0, j - 1) * row + i]
      const gx = (right - left) / (step * (i === 0 || i === nx ? 1 : 2))
      const gz = (up - down) / (step * (j === 0 || j === nz ? 1 : 2))
      const inv = 1 / Math.hypot(gx, 1, gz)
      normals[k] = -gx * inv; normals[k + 1] = inv; normals[k + 2] = -gz * inv
    }
    const index = new Uint32Array(nx * nz * 6)
    let k = 0
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const a = j * row + i, b = a + 1, c = a + row, d = c + 1
      index[k++] = a; index[k++] = c; index[k++] = b
      index[k++] = b; index[k++] = c; index[k++] = d
    }
    const weights = new THREE.InterleavedBuffer(S, STRIDE)
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('splatA', new THREE.InterleavedBufferAttribute(weights, 4, 0, true))
    geometry.setAttribute('splatB', new THREE.InterleavedBufferAttribute(weights, 4, 4, true))
    geometry.setIndex(new THREE.BufferAttribute(index, 1))
    geometry.computeBoundingSphere()
    this._edgePreview = { side, cells, original: this.mesh.geometry, geometry }
    this.mesh.geometry = geometry
    this.mesh.position.set(this.ox + dx, this.oy, this.oz + dz)
    this.mesh.updateMatrixWorld(true)
    return true
  }

  clearEdgePreview() {
    const preview = this._edgePreview
    if (!preview) return
    this.mesh.geometry = preview.original
    this.mesh.position.set(this.ox, this.oy, this.oz)
    this.mesh.updateMatrixWorld(true)
    preview.geometry.dispose()
    this._edgePreview = null
  }

  /** Desplaza un único borde una cantidad entera de celdas, sin remuestrear las celdas conservadas. */
  extendEdge(side, cells) {
    const data = this._edgeData(side, cells)
    if (!data) return false
    this.clearEdgePreview()
    const { H, S, nx, nz, dx, dz } = data
    // Las instancias almacenan X/Z locales: compensar el cambio de centro.
    for (const f of this.foliage.types.values()) {
      for (let i = 0; i < f.count; i++) {
        f.data[i * 4] -= dx
        f.data[i * 4 + 1] -= dz
      }
      f.hash = null
    }
    const step = this.step
    this.segments = nx; this.segmentsZ = nz
    this.size = nx * step
    this.depth = nz * step
    this.heights = H; this.splat = S
    this.setOffset(this.ox + dx, this.oz + dz, this.oy)
    this._buildMesh()
    this.foliage.clipToTerrain()
    this._cache = null
    return true
  }

  // ---------- raycast sobre el mapa de alturas ----------
  raycast(ray, maxDist = 2000) {
    if (!this.enabled) return null
    const hx = this.size / 2, hz = this.depth / 2
    const [mn, mx] = this.heightRange()
    const lo = new THREE.Vector3(-hx, mn - 0.01, -hz), hi = new THREE.Vector3(hx, mx + 0.01, hz)
    // slab test
    let t0 = 0, t1 = maxDist
    for (const ax of ['x', 'y', 'z']) {
      const o = ray.origin[ax], d = ray.direction[ax]
      if (Math.abs(d) < 1e-9) { if (o < lo[ax] || o > hi[ax]) return null; continue }
      let a = (lo[ax] - o) / d, b = (hi[ax] - o) / d
      if (a > b) [a, b] = [b, a]
      t0 = Math.max(t0, a); t1 = Math.min(t1, b)
      if (t0 > t1) return null
    }
    const dt = this.step * 0.5
    let t = t0
    const p = new THREE.Vector3()
    let prevAbove = null
    let prevT = t
    while (t <= t1 + dt) {
      ray.at(t, p)
      const above = p.y >= this.heightAt(p.x, p.z)
      if (prevAbove === true && !above) {
        // refinar por bisección entre prevT y t
        let a = prevT, b = t
        for (let k = 0; k < 14; k++) {
          const m = (a + b) / 2
          ray.at(m, p)
          if (p.y >= this.heightAt(p.x, p.z)) a = m; else b = m
        }
        ray.at(b, p)
        return { point: p.clone(), distance: b }
      }
      if (prevAbove === null && !above) { // el rayo empieza dentro del terreno
        ray.at(t, p)
        return { point: p.clone(), distance: t }
      }
      prevAbove = above
      prevT = t
      t += dt
    }
    return null
  }

  /** Datos de pintura (base64 o bytes) → 8 canales por vértice; los proyectos antiguos tenían 4. */
  static _splatFrom(src, stride, count) {
    const bytes = typeof src === 'string' ? b64ToBytes(src) : src
    if ((stride || 4) === STRIDE) return bytes.slice()
    const out = new Uint8Array(count * STRIDE)
    for (let v = 0; v < count; v++) for (let k = 0; k < 4; k++) out[v * STRIDE + k] = bytes[v * 4 + k]
    return out
  }

  static deserialize(d) {
    const t = new Terrain(d.size, d.segments, d.layers)
    t.depth = d.depth ?? d.size; t.segmentsZ = d.segmentsZ ?? d.segments
    if (t.segmentsZ !== t.segments) { t.heights = new Float32Array(t.n1 * t.nz1); t.splat = new Uint8Array(t.n1 * t.nz1 * STRIDE); t._buildMesh() }
    if (d.id) t.id = d.id
    if (d.name) t.name = d.name
    if (d.ox || d.oz || d.oy) t.setOffset(d.ox || 0, d.oz || 0, d.oy || 0)
    const hb = b64ToBytes(d.heights)
    t.heights = new Float32Array(hb.buffer.slice(hb.byteOffset, hb.byteOffset + hb.byteLength))
    t.splat = Terrain._splatFrom(d.splat, d.splatStride, t.n1 * t.nz1)
    t._ib.array = t.splat
    t._ib.needsUpdate = true
    t.enabled = d.enabled !== false
    t.visible = d.visible !== false
    t.terrainBake = normalizeTerrainBake(d.terrainBake)
    t.bakeInfo = null
    t.generator = storedTerrainGeneratorParams(d.generator)
    t.refreshAll()
    t.foliage.load(d.foliage || [])
    return t
  }

  dispose() {
    releaseTerrainBakeWorker(this)
    this.clearEdgePreview()
    this.foliage.dispose()
    this.mesh.geometry.dispose()
    this.mesh.material.dispose()
    this._uniforms?.uLayerTex.value.dispose()
  }
}
Object.assign(Terrain.prototype, layerMethods) // layerMethods: ./terrain-layers.js
Object.assign(Terrain.prototype, brushMethods) // brushMethods: ./terrain-brush.js
Object.assign(Terrain.prototype, ioMethods) // ioMethods: ./terrain-io.js
