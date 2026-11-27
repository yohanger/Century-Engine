// Iluminación horneada en el editor y en el juego: lightmaps en los objetos estáticos, sondas SH en los demás y apagado de las luces estáticas.
// Assets/Lightmaps: cabecera LF01, iluminación float16 y, para los nuevos lightmaps, el atlas UV en float32.
import * as THREE from 'three'
import '../render/chunks.js'
import { setProbeArray } from '../render/pbr.js'
import { giOf, normalizeBake } from './config.js'
import { lightmapGeometry, terrainLightmapGeometry, receiverMesh } from './baker.js'

const MAGIC = 0x3130464c // 'LF01'
export function encodeBakeFile(w, h, kind, half, uv) {
  const out = new ArrayBuffer(16 + half.byteLength + (uv?.byteLength || 0)), dv = new DataView(out)
  dv.setUint32(0, MAGIC, true); dv.setUint32(4, w, true); dv.setUint32(8, h, true); dv.setUint32(12, kind, true)
  new Uint16Array(out, 16, half.length).set(half)
  if (uv) new Float32Array(out, 16 + half.byteLength).set(uv)
  return out
}
export function decodeBakeFile(bytes) {
  const ab = bytes.buffer ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : bytes
  const dv = new DataView(ab)
  if (dv.getUint32(0, true) !== MAGIC) throw new Error('Archivo de iluminación no válido')
  const w = dv.getUint32(4, true), h = dv.getUint32(8, true), kind = dv.getUint32(12, true)
  if (kind !== 0) return { w, h, kind, half: new Uint16Array(ab, 16) }
  const length = w * h * 4, end = 16 + length * 2
  return { w, h, kind, half: new Uint16Array(ab, 16, length),
    uv: end < ab.byteLength ? new Float32Array(ab, end) : null }
}

/** Campo de sondas: interpola trilinealmente los 9 coeficientes SH de las 8 sondas más cercanas. */
export class ProbeField {
  constructor(meta, half) {
    this.origin = meta.origin; this.dims = meta.dims; this.spacing = meta.spacing
    const f = new Float32Array(half.length)
    for (let i = 0; i < f.length; i++) f[i] = THREE.DataUtils.fromHalfFloat(half[i])
    this.data = f
  }
  /** Escribe en `out` (9 Vector3) los coeficientes en la posición p. */
  sample(p, out) {
    const [nx, ny, nz] = this.dims, s = this.spacing
    const fx = Math.min(nx - 1, Math.max(0, (p.x - this.origin[0]) / s)), fy = Math.min(ny - 1, Math.max(0, (p.y - this.origin[1]) / s)), fz = Math.min(nz - 1, Math.max(0, (p.z - this.origin[2]) / s))
    const x0 = Math.min(nx - 2, Math.floor(fx)), y0 = Math.min(ny - 2, Math.floor(fy)), z0 = Math.min(nz - 2, Math.floor(fz))
    const tx = fx - x0, ty = fy - y0, tz = fz - z0
    for (let c = 0; c < 9; c++) out[c].set(0, 0, 0)
    for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const w = (dx ? tx : 1 - tx) * (dy ? ty : 1 - ty) * (dz ? tz : 1 - tz)
      if (w <= 0) continue
      const idx = ((z0 + dz) * ny + (y0 + dy)) * nx + (x0 + dx)
      for (let c = 0; c < 9; c++) { const o = idx * 27 + c * 3; out[c].x += this.data[o] * w; out[c].y += this.data[o + 1] * w; out[c].z += this.data[o + 2] * w }
    }
    return out
  }
}

export class BakeRuntime {
  /** @param scene SceneGraph (nodos, terrenos, visor)  @param host { project, view, assetData(id) → Promise<{bytes}|null>, bakeState?(state) } */
  constructor(scene, host) {
    this.editor = scene
    this.host = host
    this.textures = new Map()  // id de asset → DataTexture
    this.applied = []          // estado original y geometría temporal por receptor
    this.probeUsers = []       // { node, mats: [{mat, arr}], last: Vector3 }
    this.field = null
    this.token = 0
    this._timer = 0
    this.state = { active: false, stale: false, lightmaps: 0, probes: 0 }
  }

  /** Reaplica con retardo (tras reconstruir nodos o cambiar el entorno). */
  schedule() {
    if (this._timer) return
    this._timer = setTimeout(() => { this._timer = 0; this.apply().catch((e) => console.warn('bake', e)) }, 80)
  }

  dispose() {
    clearTimeout(this._timer)
    this._timer = 0
    this.token++
    this.clear(false)
    this.forget(this.textures.keys())
  }

  clear(refresh = true) {
    for (const a of this.applied) {
      if (a.original) {
        if (a.mesh.geometry === a.baked) {
          a.mesh.geometry = a.original
          a.baked.dispose()
        }
        delete a.mesh.userData.lmOrig
        delete a.node.userData.lmApplied
      } else if (a.mesh.geometry === a.baked) a.baked.deleteAttribute('lfLightmapUv')
      a.mat.lightMap = a.lightMap
      a.mat.lightMapIntensity = a.intensity
      delete a.mat.defines.LF_BAKE_UV
      a.mat.needsUpdate = true
    }
    this.applied = []
    for (const u of this.probeUsers) for (const m of u.mats) setProbeArray(m.mat, null)
    this.probeUsers = []
    this.field = null
    for (const n of this.editor.nodes.values()) n.userData.bakedOff = false
    if (refresh) this.editor.applyView()
    this.state = { active: false, stale: false, lightmaps: 0, probes: 0 }
  }

  async _texture(id, token) {
    let t = this.textures.get(id)
    if (t) return t
    const a = await this.host.assetData(id)
    if (!a || token !== this.token) return null
    const d = decodeBakeFile(a.bytes)
    t = new THREE.DataTexture(d.half, d.w, d.h, THREE.RGBAFormat, THREE.HalfFloatType)
    t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.channel = 1; t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true
    t.userData.lightmapUv = d.uv
    this.textures.set(id, t)
    return t
  }

  /** Olvida las texturas de un bake que ya no existe. */
  forget(ids) { for (const id of ids) { this.textures.get(id)?.dispose(); this.textures.delete(id) } }

  /** Aplica el bake de la escena (project.environment.bake). Es seguro llamarlo varias veces. */
  async apply() {
    const token = ++this.token
    const ed = this.editor
    const project = this.host.project
    const b = project?.environment?.bake
    this.clear()
    this.host.bakeState?.({ ...this.state })
    if (!b || this.host.view.bake === false) return
    const cfg = normalizeBake({ ...project.bake, ...(b.params || {}) })
    let stale = false, nLm = 0
    for (const [key, info] of Object.entries(b.lightmaps || {})) {
      const tex = await this._texture(info.id, token)
      if (token !== this.token) return
      if (!tex) { stale = true; continue }
      const terrain = key.startsWith('terrain:')
      const node = terrain ? null : ed.nodes.get(key)
      const obj = terrain ? null : project.objects.find(o => o.id === key)
      const mesh = terrain ? ed.terrains.find(t => t.id === key.slice(8))?.mesh : (node && receiverMesh(node))
      if (!mesh || (!terrain && !obj)) { stale = true; continue }
      const original = mesh.geometry
      const saved = tex.userData.lightmapUv
      let uv, baked = original
      if (saved) {
        const count = terrain ? original.attributes.position.count : (original.index?.count ?? original.attributes.position.count)
        if (saved.length !== count * 2) { stale = true; continue }
        uv = new THREE.BufferAttribute(saved, 2)
        if (!terrain) baked = original.index ? original.toNonIndexed() : original.clone()
      } else {
        const result = terrain ? terrainLightmapGeometry(mesh, cfg) : lightmapGeometry(mesh, node, obj, cfg)
        if (result.size !== info.size) { stale = true; result.geometry.dispose(); continue }
        uv = result.geometry.attributes.lfLightmapUv
        if (terrain) result.geometry.dispose()
        else baked = result.geometry
      }
      baked.setAttribute('lfLightmapUv', uv)
      if (!terrain) {
        mesh.geometry = baked
        mesh.userData.lmOrig = original
        node.userData.lmApplied = true
      }
      const mat = mesh.material
      this.applied.push({ mesh, node, original: terrain ? null : original, baked, mat,
        lightMap: mat.lightMap, intensity: mat.lightMapIntensity })
      ;(mat.defines ||= {}).LF_BAKE_UV = 1
      mat.lightMap = tex; mat.lightMapIntensity = 1; mat.needsUpdate = true
      nLm++
    }
    // luces estáticas (las mixtas siguen en tiempo real)
    for (const id of b.lights || []) {
      const node = ed.nodes.get(id), obj = project.objects.find((o) => o.id === id)
      if (node && obj?.light?.mode === 'baked') node.userData.bakedOff = true
    }
    // sondas para los objetos que no reciben lightmap
    let probes = 0
    if (b.probes) {
      const a = await this.host.assetData(b.probes.id)
      if (token !== this.token) return
      if (a) {
        const d = decodeBakeFile(a.bytes)
        this.field = new ProbeField(b.probes, d.half)
        const seen = new Set()
        for (const obj of project.objects) {
          const node = ed.nodes.get(obj.id)
          if (!node || ['light', 'spawn', 'trigger', 'atmovolume', 'postvolume', 'group', 'event'].includes(obj.type)) continue
          if (giOf(obj) === 'off' || node.userData.lmApplied) continue
          const mats = []
          node.traverse((m) => {
            if (!m.isMesh || m.userData.helper) return
            for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
              if (!mat || seen.has(mat) || !(mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial || mat.isMeshLambertMaterial || mat.isMeshPhongMaterial)) continue
              seen.add(mat)
              const arr = Array.from({ length: 9 }, () => new THREE.Vector3())
              setProbeArray(mat, arr)
              mats.push({ mat, arr })
            }
          })
          if (mats.length) this.probeUsers.push({ node, mats, last: new THREE.Vector3(1e9, 0, 0) })
        }
        probes = this.field.dims[0] * this.field.dims[1] * this.field.dims[2]
      } else stale = true
    }
    this.state = { active: true, stale, lightmaps: nLm, probes }
    ed.applyView()
    this.updateProbes(true)
    this.host.bakeState?.({ ...this.state })
    ed.vp.requestRender()
  }

  /** Antes de dibujar: actualiza los coeficientes SH de los objetos que se mueven. */
  updateProbes(force = false) {
    if (!this.field || !this.probeUsers.length) return
    const p = new THREE.Vector3()
    for (const u of this.probeUsers) {
      u.node.getWorldPosition(p)
      if (!force && p.distanceToSquared(u.last) < 0.0025) continue
      u.last.copy(p)
      for (const m of u.mats) this.field.sample(p, m.arr)
    }
  }
}
