// Sistema de vegetación del terreno: tipos (hierba, árboles, rocas…) y sus instancias.
//
// Cada TIPO tiene una fuente: 'builtin' (geometría procedural incluida), 'model' (un .glb/.obj del proyecto),
// 'texture' (una imagen con alfa → planos en cruz) o 'empty' (slot vacío esperando un archivo arrastrado).
// Las INSTANCIAS de un tipo son un Float32Array [x, z, rotY, escala]*n; la altura sale del terreno al dibujar.
import * as THREE from 'three'
import { cellKey, distToBox, cullDistance, thinning } from '../render/lod.js'
import { simplifyGeometry, trianglesOf } from '../render/lodgeo.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { clamp, uid, bytesToB64, b64ToBytes } from '../util.js'
import { applyWind, geometryHeight } from '../render/windlib.js'

export const MAX_PER_TYPE = 150000

import { BUILTIN_FOLIAGE } from './foliage-shapes.js'
export { BUILTIN_FOLIAGE }
export const foliageDefaults = () => ({
  id: '', name: 'Vegetación', source: 'empty', builtin: null, modelId: null, texture: null,
  density: 20, minScale: 0.8, maxScale: 1.2, yOffset: 0, alignNormal: 0, maxSlope: 60, color: '#ffffff',
  castShadow: true, visible: true,
  windSway: 1, // sensibilidad al viento (0 = rígido); la base la fija el tipo de vegetación
  leaves: false, // árboles: hojas que caen (ver core/world/leaves.js)
  destructible: false, rootResistanceN: 2400, trunkResistanceN: 4200,
  combustible: false, moisture: 0.25,
})

/** Configuración de un tipo nuevo. `source` = builtin|model|texture|empty; `ref` = clave del builtin o id de archivo. */
export function makeFoliageType(source = 'empty', ref = null, name = '') {
  const t = { ...foliageDefaults(), id: uid('f'), source }
  if (source === 'builtin') {
    const b = BUILTIN_FOLIAGE[ref]
    Object.assign(t, { builtin: ref, name: b.name, density: b.density, minScale: b.minScale, maxScale: b.maxScale, alignNormal: b.alignNormal, maxSlope: b.maxSlope, castShadow: b.castShadow, leaves: !!b.leaves })
  } else if (source === 'model') {
    Object.assign(t, { modelId: ref, name: name || 'Modelo', density: 4, alignNormal: 0, maxSlope: 40 })
  } else if (source === 'texture') {
    Object.assign(t, { texture: ref, name: name || 'Textura', density: 60, minScale: 0.7, maxScale: 1.3, alignNormal: 0.5, castShadow: false })
  } else t.name = name || 'Slot vacío'
  return t
}

// Campos que obligan a reconstruir las mallas / a reescribir las matrices.
const meshSig = (t) => [t.source, t.builtin, t.modelId, t.texture, t.color, t.castShadow].join('|')
const matSig = (t) => `${t.yOffset}|${t.alignNormal}`

const _q = new THREE.Quaternion(), _qa = new THREE.Quaternion(), _qy = new THREE.Quaternion()
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _m = new THREE.Matrix4(), _n = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0), YAX = new THREE.Vector3(0, 1, 0)


const normalAt = (t, x, z) => {
  const e = t.step
  return _n.set(t.heightAt(x - e, z) - t.heightAt(x + e, z), 2 * e, t.heightAt(x, z - e) - t.heightAt(x, z + e)).normalize()
}

/** Matriz de una instancia (posición sobre el terreno, giro, alineación a la pendiente, escala) → `out`. */
export function composeInstance(terrain, cfg, x, z, rot, scale, out) {
  _qy.setFromAxisAngle(YAX, rot)
  if (cfg.alignNormal > 0) {
    _qa.setFromUnitVectors(UP, normalAt(terrain, x, z))
    _q.identity().slerp(_qa, cfg.alignNormal).multiply(_qy)
  } else _q.copy(_qy)
  _s.setScalar(scale)
  _p.set(x, terrain.heightAt(x, z) + cfg.yOffset, z)
  return out.compose(_p, _q, _s)
}

export class Foliage {
  /** Resuelve un modelo del proyecto (Object3D) por id; lo fija el editor. */
  static modelLookup = null

  constructor(terrain) {
    this.terrain = terrain
    this.group = new THREE.Group()
    this.group.name = 'Foliage'
    this.types = new Map() // id -> { cfg, data, count, cap, meshes, sig, msig, hash, hashCs }
    this.onChange = null
    this._tok = 0
  }

  get list() { return [...this.types.values()].map((s) => s.cfg) }
  countOf(id) { return this.types.get(id)?.count || 0 }
  get total() { let n = 0; for (const s of this.types.values()) n += s.count; return n }
  _emit() { this.terrain.version++; this.onChange?.() }

  // ---------- tipos ----------
  /** Sincroniza la lista de tipos con la configuración (alta, baja, cambios). Conserva las instancias. */
  setTypes(cfgs) {
    const ids = new Set(cfgs.map((c) => c.id))
    for (const [id, s] of this.types) if (!ids.has(id)) { this._disposeMeshes(s); this.types.delete(id) }
    for (const c of cfgs) {
      const cfg = { ...foliageDefaults(), ...JSON.parse(JSON.stringify(c)) }
      if (c.leaves === undefined && c.source === 'builtin' && BUILTIN_FOLIAGE[c.builtin]?.leaves) cfg.leaves = true // proyectos anteriores: árboles y pinos sueltan hojas
      let s = this.types.get(c.id)
      if (!s) {
        s = { cfg, data: new Float32Array(256 * 4), count: 0, cap: 0, meshes: [], sig: '', msig: '', hash: null, hashCs: 0 }
        this.types.set(c.id, s)
      } else s.cfg = cfg
      this._syncType(s)
    }
    // mismo orden que la configuración
    const ordered = new Map()
    for (const c of cfgs) ordered.set(c.id, this.types.get(c.id))
    this.types = ordered
    this.terrain.version++
    this.terrain.onFoliageChange?.()
  }

  _syncType(s) {
    const sig = meshSig(s.cfg), msig = matSig(s.cfg)
    if (sig !== s.sig) { s.sig = sig; s.msig = msig; this._buildMeshes(s) }
    else if (msig !== s.msig) { s.msig = msig; this._writeAll(s) }
    if (s.parts && s.wsway !== s.cfg.windSway) { s.wsway = s.cfg.windSway; this._applyWind(s) }
    for (const m of s.meshes) m.visible = s.cfg.visible
  }

  _disposeMeshes(s) {
    for (const m of s.meshes) {
      this.group.remove(m)
      m.geometry.dispose()
      m.dispose?.()
    }
    s.meshes = []
    s.cap = 0
    s.parts = null
    s.matDispose?.forEach((x) => x.dispose())
    s.matDispose = null
  }

  /** (Re)crea las partes (geometría + material) del tipo y sus InstancedMesh. */
  async _buildMeshes(s) {
    const tok = (s.tok = (s.tok || 0) + 1)
    this._disposeMeshes(s)
    const mats = []
    const parts = await this._partsFor(s, mats)
    if (tok !== s.tok || !this.types.has(s.cfg.id)) { parts?.forEach((p) => p.geometry.dispose()); mats.forEach((m) => m.dispose()); return }
    if (!parts || !parts.length) { mats.forEach((m) => m.dispose()); this.terrain.onFoliageChange?.(); return }
    s.matDispose = mats
    s.parts = parts
    this._applyWind(s)
    this._makeInstanced(s)
    this._writeAll(s)
    this.terrain.onFoliageChange?.()
    this.requestRender?.()
  }

  /** Parche de viento de las mallas del tipo (core/render/windlib.js). Se repite al cambiar «Viento» sin rehacer nada. */
  _applyWind(s) {
    const c = s.cfg
    const base = c.source === 'builtin' ? BUILTIN_FOLIAGE[c.builtin]?.wind : c.source === 'texture' ? { bend: 1 } : c.source === 'model' ? { bend: 0.15, flutter: 0.4 } : null
    const k = c.windSway == null ? 1 : Math.max(0, +c.windSway || 0)
    for (const p of s.parts || []) applyWind(p.material, base && k > 0 ? { height: geometryHeight(p.geometry), bend: (base.bend || 0) * k, flutter: (base.flutter || 0) * k } : { height: 1, bend: 0, flutter: 0 })
  }

  async _partsFor(s, mats) {
    const c = s.cfg
    const tint = new THREE.Color(c.color)
    if (c.source === 'builtin') {
      const def = BUILTIN_FOLIAGE[c.builtin]
      if (!def) return null
      const geo = mergeGeometries(def.build(), false)
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.9, color: tint })
      mats.push(mat)
      return [{ geometry: geo, material: mat }]
    }
    if (c.source === 'texture') {
      let img = null
      try { const load = Terrain_loader(); img = c.texture && load ? await load(c.texture) : null } catch (e) { console.warn('Textura de vegetación no legible', e) }
      if (!img) return null
      const tex = new THREE.Texture(img)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 4
      tex.needsUpdate = true
      const aspect = img.width / Math.max(1, img.height)
      const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1, color: tint })
      mats.push(mat, tex)
      return [{ geometry: crossedQuads(aspect), material: mat }]
    }
    if (c.source === 'model') {
      const scene = Foliage.modelLookup?.(c.modelId)
      if (!scene) return null
      const parts = modelParts(scene)
      for (const p of parts) mats.push(p.material)
      return parts
    }
    return null
  }

  _makeInstanced(s) {
    const cap = Math.max(256, 1 << Math.ceil(Math.log2(Math.max(1, s.count * 1.5))))
    if (s.meshes.length) { for (const m of s.meshes) { this.group.remove(m); m.dispose?.() } s.meshes = [] }
    s.cap = cap
    if (s.data.length < cap * 4) { const d = new Float32Array(cap * 4); d.set(s.data.subarray(0, s.count * 4)); s.data = d }
    for (const p of s.parts) {
      const m = new THREE.InstancedMesh(p.geometry, p.material, cap)
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      m.count = s.count
      m.castShadow = s.cfg.castShadow
      m.receiveShadow = true
      m.frustumCulled = false
      m.name = s.cfg.name
      m.visible = s.cfg.visible
      m.raycast = () => {}
      this.group.add(m)
      s.meshes.push(m)
    }
  }

  // ---------- modo Jugar: chunks con culling y adelgazamiento por distancia ----------
  /**
   * Trocea cada tipo en chunks de 16 m (un InstancedMesh por chunk y parte) y esconde los InstancedMesh del editor.
   * Cada chunk tiene su esfera de culling (three lo descarta fuera de pantalla), se dibuja con menos instancias al alejarse y desaparece
   * pasada la distancia a la que ya mide pocos píxeles. Las instancias de un chunk van mezcladas: quedarse con una fracción es uniforme.
   */
  enterPlay() {
    this.exitPlay()
    const CELL = 16
    const chunks = [], hidden = []
    const hash = (i) => Math.imul(i + 1, 2654435761) >>> 0
    for (const s of this.types.values()) {
      if (!s.meshes.length || !s.count || !s.cfg.visible || !s.parts || s.parts.length !== s.meshes.length) continue
      const cells = new Map()
      for (let i = 0; i < s.count; i++) { const k = cellKey(s.data[i * 4], s.data[i * 4 + 1], CELL); let l = cells.get(k); if (!l) cells.set(k, (l = [])); l.push(i) }
      const scale = (s.cfg.minScale + s.cfg.maxScale) / 2 || 1
      s.parts.forEach((p, pi) => {
        const src = s.meshes[pi].instanceMatrix.array
        if (!p.geometry.boundingSphere) p.geometry.computeBoundingSphere()
        const radius = p.geometry.boundingSphere.radius * scale
        const tris = trianglesOf(p.geometry)
        let lod = null, lodTried = false
        for (const list of cells.values()) {
          list.sort((a, b) => hash(a) - hash(b))
          const m = new THREE.InstancedMesh(p.geometry, p.material, list.length)
          const arr = m.instanceMatrix.array
          let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity
          list.forEach((i, j) => {
            for (let q = 0; q < 16; q++) arr[j * 16 + q] = src[i * 16 + q]
            const x = s.data[i * 4], z = s.data[i * 4 + 1]
            if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z
          })
          m.instanceMatrix.needsUpdate = true
          m.castShadow = s.cfg.castShadow; m.receiveShadow = true; m.name = s.cfg.name; m.raycast = () => {}
          m.computeBoundingSphere()
          this.group.add(m)
          if (tris >= 400 && !lodTried) { lodTried = true; lod = simplifyGeometry(p.geometry, 0.25) } // nivel lejano (árboles, rocas); los cuadros cruzados no lo necesitan
          chunks.push({ mesh: m, n: list.length, typeId: s.cfg.id, indices: list, box: [x0, z0, x1, z1], radius, geo0: p.geometry, geo1: lod, far: Math.min(500, Math.max(30, cullDistance(radius, 500, 4))) })
        }
      })
      for (const m of s.meshes) { hidden.push([m, m.visible]); m.visible = false }
    }
    this.play = { chunks, hidden, tmp: new THREE.Vector3(), removed: new Map() }
  }

  /** Busca candidatos por hash espacial; no recorrer 150.000 árboles en cada paso físico. */
  nearbyPlayInstances(typeId, x, z, radius, max = 256) {
    const state=this.types.get(typeId)
    if(!this.play || !state || !Number.isFinite(radius) || radius<0)return []
    const hash=this._hashFor(state),cs=state.hashCs,near=[]
    const minX=Math.floor((x-radius)/cs),maxX=Math.floor((x+radius)/cs)
    const minZ=Math.floor((z-radius)/cs),maxZ=Math.floor((z+radius)/cs)
    if((maxX-minX+1)*(maxZ-minZ+1)>40000)return near
    for(let i=minX;i<=maxX;i++)for(let j=minZ;j<=maxZ;j++){
      for(const idx of hash.get(i*100003+j)||[]){
        const k=idx*4,dx=state.data[k]-x,dz=state.data[k+1]-z
        if(dx*dx+dz*dz<=radius*radius)near.push(idx)
        if(near.length>=max)return near
      }
    }
    return near
  }

  /** Reconstruye solo matrices de Play y permite restaurar un árbol guardado sin mutar autoría. */
  restoreDetachedInstances() {
    if(!this.play)return
    for(const ch of this.play.chunks){
      const s=this.types.get(ch.typeId),p=s?.parts?.find(x=>x.geometry===ch.geo0)
      if(!s)continue
      for(let k=0;k<ch.indices.length;k++){
        const i=ch.indices[k],src=s.meshes.find(mesh=>mesh.geometry===ch.geo0)?.instanceMatrix.array
        if(src)for(let q=0;q<16;q++)ch.mesh.instanceMatrix.array[k*16+q]=src[i*16+q]
      }
      ch.mesh.instanceMatrix.needsUpdate=true
    }
    this.play.removed.clear()
  }

  /** Desprende una instancia solamente en Play. La definición de autoría permanece intacta. */
  detachPlayInstance(typeId, index) {
    const s=this.types.get(typeId), pl=this.play
    if (!pl || !s?.cfg.destructible || !Number.isInteger(index) || index<0 || index>=s.count || !s.parts?.length) return null
    const key=`${typeId}:${index}`
    if (pl.removed.has(key)) return null
    const chunks=pl.chunks.filter(ch=>ch.typeId===typeId && ch.indices.includes(index))
    if (!chunks.length) return null
    const group=new THREE.Group()
    for (const part of s.parts) group.add(new THREE.Mesh(part.geometry,part.material))
    const d=s.data, j=index*4, scale=d[j+3]
    const x=d[j],z=d[j+1],yaw=d[j+2]
    const y=this.terrain.heightAt(x,z)+s.cfg.yOffset
    group.position.set(x+this.terrain.ox,y+this.terrain.oy,z+this.terrain.oz)
    group.rotation.y=yaw;group.scale.setScalar(scale)
    // Matrices nulas únicamente en las mallas de Play. No mutar editor ni data del pincel.
    for (const ch of chunks) {
      const k=ch.indices.indexOf(index), arr=ch.mesh.instanceMatrix.array, off=k*16
      for(let q=0;q<16;q++)arr[off+q]=0
      ch.mesh.instanceMatrix.needsUpdate=true
    }
    pl.removed.set(key,{typeId,index})
    return {id:key,group,config:s.cfg,scale,parts:s.parts,position:group.position.clone()}
  }

  /** Devuelve { hidden, chunks, lod } (chunks sin dibujar, totales y en nivel lejano). `focalPx` escala las distancias con la resolución real. */
  updatePlay(camWorld, focalPx = 500, drawScale = 1) {
    const pl = this.play
    if (!pl) return { hidden: 0, chunks: 0, lod: 0 }
    this.group.updateMatrixWorld()
    const c = this.group.worldToLocal(pl.tmp.copy(camWorld))
    const k = focalPx / 500, sc = drawScale
    let hidden = 0, lod = 0
    for (const ch of pl.chunks) {
      const d = distToBox(c.x, c.z, ch.box[0], ch.box[1], ch.box[2], ch.box[3])
      const far = ch.far * k * sc, f = thinning(d, far * 0.45, far)
      const cnt = Math.ceil(ch.n * f)
      const vis = cnt > 0
      if (ch.mesh.visible !== vis) ch.mesh.visible = vis
      if (!vis) { hidden++; continue }
      if (ch.mesh.count !== cnt) ch.mesh.count = cnt
      const g = ch.geo1 && d > far * 0.3 ? ch.geo1 : ch.geo0
      if (ch.mesh.geometry !== g) ch.mesh.geometry = g
      if (g === ch.geo1) lod++
    }
    return { hidden, chunks: pl.chunks.length, lod }
  }

  exitPlay() {
    const pl = this.play
    if (!pl) return
    const seen = new Set()
    for (const ch of pl.chunks) {
      this.group.remove(ch.mesh); ch.mesh.dispose?.()
      if (ch.geo1 && !seen.has(ch.geo1)) { seen.add(ch.geo1); ch.geo1.dispose() }
    }
    for (const [m, v] of pl.hidden) m.visible = v
    this.play = null
  }

  // ---------- matrices ----------
  _normalAt(x, z) { return normalAt(this.terrain, x, z) }

  _writeOne(s, i) {
    const d = s.data, o = i * 4
    composeInstance(this.terrain, s.cfg, d[o], d[o + 1], d[o + 2], d[o + 3], _m)
    for (const mesh of s.meshes) _m.toArray(mesh.instanceMatrix.array, i * 16)
  }

  _flush(s, from, to) {
    for (const mesh of s.meshes) {
      mesh.count = s.count
      const a = mesh.instanceMatrix
      a.clearUpdateRanges?.()
      if (to > from) a.addUpdateRange(from * 16, (to - from) * 16)
      a.needsUpdate = true
    }
    this.requestRender?.()
  }

  _writeAll(s) {
    if (!s.meshes.length) return
    for (let i = 0; i < s.count; i++) this._writeOne(s, i)
    this._flush(s, 0, s.count)
  }

  /** El terreno cambió de forma: recoloca las instancias dentro de la caja {x0,z0,x1,z1} (o todas). */
  refreshHeights(box = null) {
    for (const s of this.types.values()) {
      if (!s.meshes.length || !s.count) continue
      let lo = Infinity, hi = -1
      for (let i = 0; i < s.count; i++) {
        const x = s.data[i * 4], z = s.data[i * 4 + 1]
        if (box && (x < box.x0 || x > box.x1 || z < box.z0 || z > box.z1)) continue
        this._writeOne(s, i)
        if (i < lo) lo = i
        hi = i
      }
      if (hi >= 0) this._flush(s, lo, hi + 1)
    }
  }

  // ---------- pincel ----------
  _ensureCap(s, extra) {
    if (s.count + extra <= s.data.length / 4) return
    const d = new Float32Array(Math.max(256, 1 << Math.ceil(Math.log2(s.count + extra))) * 4)
    d.set(s.data.subarray(0, s.count * 4))
    s.data = d
  }

  _hashFor(s) {
    const cs = Math.max(0.05, 0.75 * Math.sqrt(100 / Math.max(0.5, s.cfg.density)))
    if (s.hash && s.hashCs === cs) return s.hash
    const h = new Map()
    const key = (x, z) => Math.floor(x / cs) * 100003 + Math.floor(z / cs)
    for (let i = 0; i < s.count; i++) {
      const k = key(s.data[i * 4], s.data[i * 4 + 1])
      const a = h.get(k)
      if (a) a.push(i); else h.set(k, [i])
    }
    s.hash = h; s.hashCs = cs
    return h
  }

  /**
   * Pinta o borra vegetación bajo un círculo. `typeId` = tipo activo; `eraseAll` borra todos los tipos.
   * Devuelve true si algo cambió.
   */
  brush(cx, cz, { radius, strength = 0.5, dt = 1 / 60, typeId, erase = false, eraseAll = false }) {
    const t = this.terrain, half = t.size / 2, hz = t.depth / 2
    let changed = false
    if (erase) {
      const prob = clamp(strength * dt * 8, 0.02, 1)
      for (const s of this.types.values()) {
        if (!eraseAll && s.cfg.id !== typeId) continue
        let first = -1, w = 0
        const d = s.data
        for (let i = 0; i < s.count; i++) {
          const o = i * 4
          if (Math.hypot(d[o] - cx, d[o + 1] - cz) <= radius && Math.random() < prob) { if (first < 0) first = i; continue }
          if (w !== i) d.copyWithin(w * 4, o, o + 4)
          w++
        }
        if (first >= 0) {
          s.count = w
          s.hash = null
          if (s.meshes.length) { for (let i = first; i < s.count; i++) this._writeOne(s, i); this._flush(s, first, s.count) }
          changed = true
        }
      }
      if (changed) this._emit()
      return changed
    }
    const s = this.types.get(typeId)
    if (!s || !s.meshes.length || !s.cfg.visible) return false
    const c = s.cfg
    if (s.count >= MAX_PER_TYPE) return false
    const area = Math.PI * radius * radius
    const want = (c.density / 100) * area * strength * dt * 4
    const attempts = Math.min(4000, Math.floor(want + Math.random()))
    if (!attempts) return false
    const cs = Math.max(0.05, 0.75 * Math.sqrt(100 / Math.max(0.5, c.density)))
    const hash = this._hashFor(s)
    const key = (x, z) => Math.floor(x / cs) * 100003 + Math.floor(z / cs)
    const minD2 = cs * cs
    const slopeLimit = Math.cos((clamp(c.maxSlope, 1, 90) * Math.PI) / 180)
    this._ensureCap(s, attempts)
    const first = s.count
    for (let k = 0; k < attempts && s.count < MAX_PER_TYPE; k++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * radius
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r
      if (x < -half || x > half || z < -hz || z > hz) continue
      if (c.maxSlope < 90 && this._normalAt(x, z).y < slopeLimit) continue
      const kx = Math.floor(x / cs), kz = Math.floor(z / cs)
      let ok = true
      for (let dx = -1; dx <= 1 && ok; dx++) {
        for (let dz = -1; dz <= 1 && ok; dz++) {
          const list = hash.get((kx + dx) * 100003 + kz + dz)
          if (!list) continue
          for (const j of list) {
            const ex = s.data[j * 4] - x, ez = s.data[j * 4 + 1] - z
            if (ex * ex + ez * ez < minD2) { ok = false; break }
          }
        }
      }
      if (!ok) continue
      const i = s.count++
      s.data[i * 4] = x; s.data[i * 4 + 1] = z
      s.data[i * 4 + 2] = Math.random() * Math.PI * 2
      s.data[i * 4 + 3] = c.minScale + Math.random() * Math.max(0, c.maxScale - c.minScale)
      const kk = key(x, z)
      const l = hash.get(kk)
      if (l) l.push(i); else hash.set(kk, [i])
    }
    if (s.count === first) return false
    if (s.count > s.cap) { this._makeInstanced(s); this._writeAll(s) } else {
      for (let i = first; i < s.count; i++) this._writeOne(s, i)
      this._flush(s, first, s.count)
    }
    this._emit()
    return true
  }

  clearType(id) {
    const s = this.types.get(id)
    if (!s || !s.count) return
    s.count = 0; s.hash = null
    for (const m of s.meshes) m.count = 0
    this._emit()
    this.requestRender?.()
  }

  // ---------- redimensionado ----------
  /** Tras cambiar el tamaño del terreno: descarta lo que queda fuera y recoloca el resto. */
  clipToTerrain() {
    const half = this.terrain.size / 2, hz = this.terrain.depth / 2
    for (const s of this.types.values()) {
      let w = 0
      for (let i = 0; i < s.count; i++) {
        const x = s.data[i * 4], z = s.data[i * 4 + 1]
        if (Math.abs(x) > half || Math.abs(z) > hz) continue
        if (w !== i) s.data.copyWithin(w * 4, i * 4, i * 4 + 4)
        w++
      }
      s.count = w; s.hash = null
    }
    this.refreshHeights()
    this.terrain.onFoliageChange?.()
  }

  // ---------- (de)serialización ----------
  serialize() {
    return [...this.types.values()].map((s) => ({ ...s.cfg, data: s.count ? bytesToB64(new Uint8Array(s.data.buffer, 0, s.count * 16)) : '' }))
  }

  load(arr = []) {
    this.setTypes(arr.map(({ data, ...cfg }) => cfg))
    for (const a of arr) {
      const s = this.types.get(a.id)
      if (!s) continue
      if (a.data) {
        const b = b64ToBytes(a.data)
        s.data = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
        s.count = Math.floor(s.data.length / 4)
      } else s.count = 0
      s.hash = null
      if (s.meshes.length) { if (s.count > s.cap) this._makeInstanced(s); this._writeAll(s) }
    }
    this.terrain.onFoliageChange?.()
  }

  snapshot() {
    return [...this.types.values()].map((s) => ({ cfg: { ...s.cfg }, data: s.data.slice(0, s.count * 4) }))
  }

  restore(snap = []) {
    this.setTypes(snap.map((x) => x.cfg))
    for (const x of snap) {
      const s = this.types.get(x.cfg.id)
      if (!s) continue
      s.count = x.data.length / 4
      s.data = new Float32Array(Math.max(256 * 4, x.data.length))
      s.data.set(x.data)
      s.hash = null
      if (s.meshes.length) { if (s.count > s.cap) this._makeInstanced(s); this._writeAll(s) }
    }
    this.terrain.onFoliageChange?.()
  }

  /** Reconstruye los tipos 'model' cuando se registra (o cambia) un modelo del proyecto. */
  rebuildModel(modelId) {
    for (const s of this.types.values()) if (s.cfg.source === 'model' && s.cfg.modelId === modelId) { s.sig = ''; this._syncType(s) }
  }
  rebuildTexture(texId) {
    for (const s of this.types.values()) if (s.cfg.source === 'texture' && s.cfg.texture === texId) { s.sig = ''; this._syncType(s) }
  }

  /** Para exportar: partes de un tipo con sus instancias. */
  exportData(id) {
    const s = this.types.get(id)
    return s ? { cfg: s.cfg, data: s.data.subarray(0, s.count * 4), count: s.count } : null
  }

  dispose() {
    for (const s of this.types.values()) this._disposeMeshes(s)
    this.types.clear()
  }
}

// ---------- utilidades ----------
let _loader = null
function Terrain_loader() { return _loader }
export function setFoliageImageLoader(fn) { _loader = fn }

import { crossedQuads, modelPivot, modelParts } from './foliage-models.js'
export { crossedQuads, modelPivot }