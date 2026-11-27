// Modelos (.glb/.gltf/.obj), capturas y esqueletos
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { eventPagesUsingModel } from '../events/model.js'
import { parseOBJ } from '../geometry/objconv.js'
import { parseMTL, resolveModelAsset } from '../geometry/mtl.js'
import { MODEL_MAPS } from '../render/native-maps.js'
import { skeletonFromModel, clipFromTracks } from '../anim/three-bridge.js'
import { describeClips } from '../anim/modelclips.js'
import { setPsxAffine } from '../render/pbr.js'

export const modelsMethods = {

  /** Decodificadores oficiales compartidos entre modelos. Se distribuyen locales en editor y Player. */
  _gltfLoader() {
    if (!this._gltf) {
      const base = new URL('./three-decoders/', document.baseURI)
      this._draco = new DRACOLoader().setDecoderPath(new URL('draco/', base).href)
      this._ktx2 = new KTX2Loader().setTranscoderPath(new URL('basis/', base).href)
      this._ktx2.detectSupport(this.vp.renderer)
      this._gltf = new GLTFLoader()
        .setDRACOLoader(this._draco)
        .setKTX2Loader(this._ktx2)
        .setMeshoptDecoder(MeshoptDecoder)
    }
    return this._gltf
  },
  /** Los workers WASM no deben sobrevivir al runtime que los creó. */
  _disposeModelDecoders() {
    this._draco?.dispose()
    this._ktx2?.dispose()
    this._draco = null; this._ktx2 = null; this._gltf = null
  },
  /** Los materiales GLTF se comparten entre instancias; aplicar el shader una sola vez al material fuente. */
  _syncPsxModel(scene) {
    const on = !!(this.vp.renderCfg?.psx && this.vp.renderCfg.psxAffine)
    scene.traverse((o) => {
      if (!o.isMesh || !o.geometry?.getAttribute('uv')) return
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) setPsxAffine(m, on)
    })
  },
  /** Reaplicar al cambiar Render, incluso con modelos ya cargados e instancias animadas. */
  syncPsxModels() {
    for (const scene of this.models.values()) this._syncPsxModel(scene)
    this.vp.requestRender()
  },
  /** Registra un modelo (.glb/.gltf/.obj) y devuelve su tamaño y centro. */
  async registerModel(id, bytes, name = '', { project = this.host.project, folder = project?.models?.find(m => m.id === id)?.folder || 'Assets/Models' } = {}) {
    let scene, clips = []
    if (/\.obj$/i.test(name)) {
      const m = parseOBJ(bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes)
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3))
      g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3))
      g.setIndex(new THREE.BufferAttribute(m.indices, 1))
      if (m.uvs) g.setAttribute('uv', new THREE.BufferAttribute(m.uvs, 2))
      for (const group of m.groups) g.addGroup(group.start, group.count, group.materialIndex)
      const definitions = new Map(), assets = project?.assets || []
      for (const library of m.libraries) {
        const file = resolveModelAsset(assets, folder, library, a => /\.mtl$/i.test(a.name))
        if (!file) continue
        const data = await this.host.assetData(file.id, project?.id)
        if (!data) continue
        for (const [key, value] of parseMTL(data.bytes)) definitions.set(key, { ...value, folder: file.folder })
      }
      const materials = await Promise.all(m.materials.map(async key => {
        const d = definitions.get(key) || {}
        const mat = new THREE.MeshStandardMaterial({ name: key || 'Material', color: '#cfd5df', roughness: 0.8 })
        if (d.kd) mat.color.setRGB(...d.kd)
        if (d.ke) mat.emissive.setRGB(...d.ke)
        if (d.pr !== undefined || d.ns !== undefined) mat.roughness = THREE.MathUtils.clamp(d.pr ?? Math.sqrt(2 / (Math.max(0, d.ns) + 2)), 0, 1)
        if (d.pm !== undefined) mat.metalness = THREE.MathUtils.clamp(d.pm, 0, 1)
        mat.opacity = THREE.MathUtils.clamp(d.d ?? (d.tr !== undefined ? 1 - d.tr : 1), 0, 1)
        mat.transparent = mat.opacity < 1
        mat.userData.centuryMaps = {}
        for (const map of MODEL_MAPS) {
          const file = resolveModelAsset(assets, d.folder || folder, d.maps?.[map.key], a => a.kind === 'texture')
          if (!file) continue
          const texture = await this._loadMapTexture(file.id, map.srgb, true, project?.id)
          if (texture && m.uvs) {
            mat[map.property] = texture
            mat.userData.centuryMaps[map.key] = file.id
            if (map.key === 'emission' && !d.ke) mat.emissive.set('#ffffff')
          }
        }
        const bump = resolveModelAsset(assets, d.folder || folder, d.maps?.height, a => a.kind === 'texture')
        if (bump && m.uvs) mat.bumpMap = await this._loadMapTexture(bump.id, false, true, project?.id)
        return mat
      }))
      scene = new THREE.Group()
      scene.userData.centuryObj = true
      scene.add(new THREE.Mesh(g, materials.length === 1 ? materials[0] : materials))
    } else {
      const loader = this._gltfLoader()
      await MeshoptDecoder.ready
      const input = ArrayBuffer.isView(bytes) ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : bytes.slice ? bytes.slice(0) : bytes
      const gltf = await new Promise((res, rej) => loader.parse(input, '', res, rej))
      scene = gltf.scene
      clips = gltf.animations || []
    }
    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3())
    this.models.set(id, scene)
    this._syncPsxModel(scene)
    this.modelBaseClips.set(id, clips)
    clips = this._mergeCaptureClips(id)
    for (const t of this.terrains) t.foliage.rebuildModel(id)
    for (const [oid] of this.nodes) {
      const o = this.host.getObject(oid)
      if (o?.modelId === id || (o?.type === 'event' && eventPagesUsingModel(o.props, id).length)) this._rebuild(o)
    }
    this._refreshDecals?.() // Un decal puede apuntar al modelo antes de que terminara de importarse.
    return { size: size.toArray(), center: center.toArray(), clips: describeClips(clips) }
  },

  unregisterStreamModel(id) {
    const model = this.models.get(id)
    if (!model) return
    this.models.delete(id)
    this.modelBaseClips.delete(id)
    this.modelClips.delete(id)
    const resources = new Set()
    model.traverse(node => {
      if (node.geometry) resources.add(node.geometry)
      if (node.skeleton) resources.add(node.skeleton)
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        if (!material) continue
        resources.add(material)
        for (const value of Object.values(material)) if (value?.isTexture && ![...(this._maps?.values() || [])].includes(value)) resources.add(value)
      }
    })
    for (const resource of resources) resource.dispose()
  },

  /** Clips del glTF + capturas de movimiento importadas para ese modelo (project.captures). */
  _mergeCaptureClips(id) {
    const all = [...(this.modelBaseClips.get(id) || []), ...this._captures.filter((c) => c.modelId === id).map((c) => clipFromTracks(c.name, c.tracks, c.duration))]
    this.modelClips.set(id, all)
    return all
  },
  /** Fija las capturas del proyecto y devuelve { modelId: descriptores de clips } de los modelos cargados afectados. */
  setCaptureClips(captures = []) {
    const before = new Set(this._captures.map((c) => c.modelId))
    this._captures = captures
    const out = {}
    for (const id of new Set([...before, ...captures.map((c) => c.modelId)])) if (this.models.has(id)) out[id] = describeClips(this._mergeCaptureClips(id))
    return out
  },
  /** Esqueleto (pose de reposo) de un modelo cargado, para retarget de capturas. */
  modelSkeleton(id) { return skeletonFromModel(this.models.get(id)) },
}
