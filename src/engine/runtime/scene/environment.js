// Sol, mundo, cielo, render, materiales y vista de la escena. Lee el proyecto y la vista a través de `this.host` (no importa el store).
import * as THREE from 'three'
import { halfExtentAll } from '../geometry/terrains.js'
import { nodeEffectiveActive } from '../nodes/hierarchy.js'
import { getDef } from '../nodes/index.js'
import { DEG } from '../util.js'
import { normalizeRender, rendererPreset } from '../render/config.js'
import { lightingMode, selectedSun } from '../world/lighting.js'

export const environmentMethods = {
  _sunObject() { return selectedSun(this.host.project?.objects, this.host.project?.environment, (o) => this.nodes.has(o.id)) },

  /** Dirección autoral del sol para el cielo manual. */
  _updateSun() {
    const o = this._sunObject()
    if (o) {
      const parent = this.nodes.get(o.id)?.parent
      const e = new THREE.Euler(o.rotation[0] * DEG, o.rotation[1] * DEG, o.rotation[2] * DEG, 'YXZ')
      const d = new THREE.Vector3(0, 0, 1).applyEuler(e)
      if (parent) d.applyQuaternion(parent.getWorldQuaternion(new THREE.Quaternion()))
      const dir = d.toArray()
      this.world.setAuthoredSunDirection?.(dir)
      this.vp.setSun({ dir, color: o.color, energy: o.light.energy })
    } else {
      this.world.setAuthoredSunDirection?.(null)
      this.vp.setSun(null)
    }
    this._worldSun() // si la hora o el clima mandan, vuelven a mandar sobre el sol recién editado
  },

  /** La luna es un recurso transitorio del render, no un nodo de autoría ni parte del proyecto. */
  _removeWorldMoon() {
    if (!this._worldMoon) return
    this._worldMoon.parent?.remove(this._worldMoon)
    this._worldMoon.target.parent?.remove(this._worldMoon.target)
    this._worldMoon = null
    this.vp.invalidateShadows()
  },

  _syncWorldMoon(f, sunNode, sunObject) {
    const m = f.moonMul || 0
    const allowed = !!sunNode && sunNode.visible !== false && sunObject.visible !== false && this.host.view?.lights !== false &&
      !sunNode.userData.bakedOff && !sunNode.userData.rtOff
    if (!allowed || m <= 0.0001) { this._removeWorldMoon(); return }
    let moon = this._worldMoon
    if (!moon) {
      moon = new THREE.DirectionalLight('#8fa8e0', 0)
      moon.name = 'Century · Luna (entorno)'
      moon.castShadow = false // igual que FrostEngine; no duplica los mapas de sombras
      moon.userData.environmentMoon = true
      moon.target.position.set(0, 0, 0)
      this.vp.scene.add(moon, moon.target)
      this._worldMoon = moon
    }
    moon.position.set(...f.moonDir).multiplyScalar(10)
    moon.color.setRGB(...f.moonColor)
    const energy = sunNode.userData.environmentSun ? sunNode.userData.rtEnergy ?? sunObject.light.energy : sunObject.light.energy
    moon.intensity = energy * Math.PI * m
    moon.visible = true
    moon.updateMatrixWorld()
    moon.target.updateMatrixWorld()
    this.vp.requestRender()
  },

  _restoreWorldSun() {
    const binding = this._worldSunBinding
    if (!binding) return
    this._worldSunBinding = null
    this._sunSig = null
    const { node, rotated } = binding
    const u = node.userData
    delete u.environmentSun
    if (rotated) node.rotation.set(...u.lightAuthored.rotation.map((angle) => angle * DEG), 'YXZ')
    u.refreshLightAppearance()
    this._applyViewToNode(node)
    node.updateMatrixWorld(true)
    this.vp.invalidateShadows()
  },

  /**
   * La hora y el clima controlan la luz solar. La separación solar/lunar es opt-in:
   * escenas anteriores conservan keyDir/keyMul (una sola luz).
   */
  _worldSun(f = this.world.active ? this.world.frame() : null) {
    const o = this._sunObject(), node = o && this.nodes.get(o.id), L = node?.userData.light
    const mode = lightingMode(this.host.project?.environment)
    const drive = !!L && !!f && mode !== 'manual'
    const separate = drive && f.timeOn && this.world.cfg?.time?.celestialLights === true
    if (!separate) this._removeWorldMoon()
    const binding = this._worldSunBinding
    if (binding && (!drive || binding.node !== node || (binding.rotated && !f.timeOn) || binding.mode !== mode)) this._restoreWorldSun()
    if (!drive) return
    this._worldSunBinding ??= { node, mode, rotated: false }
    this._worldSunBinding.rotated = !!f.timeOn
    const dir = separate ? f.sunDir : f.keyDir
    const mul = separate ? f.sunDirectMul : f.keyMul
    if (f.timeOn) {
      // Orientación mundial, aunque la luz sea hija de un grupo rotado.
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...dir).normalize())
      if (node.parent) q.premultiply(node.parent.getWorldQuaternion(new THREE.Quaternion()).invert())
      node.quaternion.copy(q)
    }
    const u = node.userData
    if (mode === 'cycle') {
      const modulation = u.environmentSun ??= {}
      modulation.multiplier = mul
      modulation.temperatureOffset = f.sunTemperatureOffset
      u.refreshLightAppearance()
    } else {
      if (f.timeOn) L.color.setRGB(...(separate ? f.sunColor : f.keyColor))
      L.intensity = o.light.energy * Math.PI * mul
      if (u.fx) u.fx.base = L.intensity
      u.refreshLightEffects?.()
    }
    L.visible = mul > 0.002 && this.host.view?.lights !== false && !u.bakedOff && !u.rtOff
    const sig = [...dir.map((x) => x.toFixed(3)), mul.toFixed(3)].join(',')
    if (sig !== this._sunSig) { this._sunSig = sig; this.vp.invalidateShadows() }
    node.updateMatrixWorld(true)
    if (separate) this._syncWorldMoon(f, node, o)
  },

  /** La cámara es el observador del clima: la lluvia local, los rayos y el sol tapado por nubes (campo de celdas) se miden desde ella. */
  _worldObserver() { const p = this.vp.camera.position; this.world.setObserver(p.x, p.y, p.z) },

  /** Aplica el estado del mundo al visor: cielo, niebla, luces y sol. Se llama tras configurar el mundo y en cada fotograma de juego. */
  applyWorld() {
    this._worldObserver()
    const frame = this.world.active ? this.world.frame() : null
    this.vp.setWorld(frame)
    this._worldSun(frame)
  },

  /** Un paso del reloj y del clima (modo Jugar). */
  tickWorld(dt) {
    if (!this.world.active) return
    this._worldObserver()
    this.world.update(dt)
    this.applyWorld()
  },

  /** Carga el panorama del cielo (HDR/EXR/imagen) cuando el modo es HDRI. */
  async _loadSkyTexture() {
    const env = this.host.project?.environment, id = env?.skyMode === 'hdri' ? env.skyHdri : ''
    if (id === this._skyId) return
    this._skyId = id
    if (!id) { this.vp.setSkyTexture(null); return }
    const a = await this.host.assetData(id)
    if (!a || this._skyId !== id) return
    const ext = (a.name.split('.').pop() || '').toLowerCase()
    let tex
    try {
      if (ext === 'hdr' || ext === 'exr') {
        const L = ext === 'hdr' ? new (await import('three/examples/jsm/loaders/RGBELoader.js')).RGBELoader() : new (await import('three/examples/jsm/loaders/EXRLoader.js')).EXRLoader()
        const d = L.parse(a.bytes.buffer ? a.bytes.buffer.slice(a.bytes.byteOffset, a.bytes.byteOffset + a.bytes.byteLength) : a.bytes)
        tex = new THREE.DataTexture(d.data, d.width, d.height, d.format, d.type)
        tex.colorSpace = THREE.LinearSRGBColorSpace; tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false
        tex.flipY = ext === 'hdr'
      } else {
        const img = await this.host.assetImage(id)
        if (!img) return
        tex = new THREE.Texture(img); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true
      }
      tex.wrapS = THREE.RepeatWrapping; tex.needsUpdate = true
    } catch (e) { this.host.toast?.('No se pudo leer el panorama: ' + (e.message || e), 'error', 4000); return }
    if (this._skyId === id) this.vp.setSkyTexture(tex, false)
  },

  syncEnvironment() {
    const p = this.host.project
    this.vp.worldIrradiance?.setScene(p.activeSceneId)
    this.vp.worldRayScene?.setScene(p.activeSceneId)
    this.world.configure(p.environment, { keepHour: this.isPlaying }) // hora y clima de la escena (en juego el reloj no se reinicia al cambiar de escena)
    this._updateSun()
    this._loadSkyTexture()
    this.vp.setEnvironment(p.environment)
    this.applyWorld()
    this.refreshWaterMap()
    if (!this.isPlaying) this.refreshPhysicalWaterPreview()
    this._bakeSync()
  },

  /** Reaplica el bake si cambió (nuevo horneado, deshacer) o si se activó/desactivó en Ver. */
  _bakeSync() {
    const b = this.host.project?.environment?.bake
    const bk = (b ? b.rev : 0) + '|' + this.host.view.bake
    if (bk !== this._bakeKey) { this._bakeKey = bk; this._bakeSchedule() }
  },

  syncSettings(s = this.host.project?.settings) {
    if (!s) return
    const ext = this.terrains.length ? halfExtentAll(this.terrains) * 2 : 64
    this.vp.setGrid(s.gridSize, Math.max(ext, 32))
    this.vp.setFar(Math.max(2000, ext * 3))
  },

  /** Aplica Ajustes → Render del proyecto (look, perfil, efectos) y vuelve a sincronizar todos los materiales. */
  /** Render que se ve en el editor y en el modo Jugar: el de Ajustes ▸ Render, o el método elegido en el visor (solo para trabajar; la exportación usa Ajustes ▸ Render). */
  baseRender() {
    const r = normalizeRender(this.host.project?.render), m = this.host.view.renderMethod
    if (!m) return r
    const { shader, ...p } = rendererPreset(m)
    return normalizeRender({ ...r, ...p, backend: r.backend, psx: r.psx, psxHeight: r.psxHeight, psxSnap: r.psxSnap, psxContinuous: r.psxContinuous, psxAffine: r.psxAffine, environmentLook: r.environmentLook, staticOcclusion: r.staticOcclusion })
  },

  applyRender() {
    const cfg = this.baseRender()
    this.vp.setShaderGraphDocs(this.host.project?.shaders)
    this.vp.setRender(cfg)
    this._syncViewDiagnosticLod(this.host.view.mode || 'lit')
    this.syncPsxModels()
    this._loadLut(cfg.lut)
    this._renderApplied()
    this.refreshMaterials()
  },

  /** LUT de color del render (Ajustes ▸ Render ▸ Color y tonos): carga la imagen del asset una sola vez por cambio. */
  async _loadLut(id) {
    if (id === this._lutId) return
    this._lutId = id
    if (!id) { this.vp.look.setLut(null); return }
    const img = await this.host.assetImage(id)
    if (this._lutId !== id) return
    this.vp.look.setLut(img || null)
    if (this.vp.look.lutError) this.host.toast?.(this.vp.look.lutError, 'error', 6000)
  },

  /** Vuelve a calcular los materiales PBR (cambió un shader, el shader por defecto o el look). */
  refreshMaterials() {
    for (const [id, n] of this.nodes) {
      if (!n.userData.modelMaterialBindings && !n.userData.mat?.isMeshPhysicalMaterial && !Object.values(n.userData.mats || {}).some((m) => m?.isMeshPhysicalMaterial)) continue
      const obj = this.host.getObject(id)
      if (obj) getDef(obj.type).update(n, obj)
    }
    this.vp.requestRender()
  },

  _mapTexture(id, srgb = true, flipY = true) {
    const key = `${id}|${srgb ? 's' : 'l'}${flipY ? '' : '|gltf'}`
    const texture = this._maps?.get(key)
    if (texture) return texture
    void this._loadMapTexture(id, srgb, flipY)
    return null
  },

  _loadMapTexture(id, srgb = true, flipY = true, projectId) {
    this._maps ||= new Map()
    this._mapsLoading ||= new Map()
    const key = `${id}|${srgb ? 's' : 'l'}${flipY ? '' : '|gltf'}`
    if (this._maps.has(key)) return Promise.resolve(this._maps.get(key))
    if (this._mapsLoading.has(key)) return this._mapsLoading.get(key)
    const pending = Promise.resolve().then(() => this.host.assetImage(id, projectId)).then(img => {
      if (!img) return null
      const tx = new THREE.Texture(img)
      tx.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
      tx.flipY = flipY
      tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.anisotropy = 8; tx.needsUpdate = true
      this._maps.set(key, tx)
      this.refreshMaterials()
      return tx
    }).catch(error => { console.warn('Textura no legible', id, error); return null })
    this._mapsLoading.set(key, pending)
    return pending
  },

  _releaseViewDiagnosticLod() {
    this._viewDiagToken = (this._viewDiagToken || 0) + 1
    this._viewDiagnosticRequested = false
    if (!this._viewDiagnosticLod) return
    this._viewDiagnosticLod.detach() // restaura índices/geometrías y detiene el worker temporal
    this._viewDiagnosticLod = null
    this.vp._editorDiagnosticLod = null
  },

  _syncViewDiagnosticLod(mode) {
    // La autoridad nativa funciona en Lit y en TODAS las vistas; el modo diagnóstico solo observa.
    const eligible = !this.isPlaying && !this.player?.on && !this.vp.playing
    if (!eligible) return this._releaseViewDiagnosticLod()
    const cfg = this.baseRender()
    const key = JSON.stringify([cfg.lod !== false, cfg.lodQuality, cfg.drawDistance])
    if ((this._viewDiagnosticLod || this._viewDiagnosticRequested) && this._viewDiagnosticLodKey !== key)
      this._releaseViewDiagnosticLod()
    if (this._viewDiagnosticLod || this._viewDiagnosticRequested) return
    this._viewDiagnosticLodKey = key
    this._viewDiagnosticRequested = true
    const token = this._viewDiagToken = (this._viewDiagToken || 0) + 1
    import('../render/lodmgr.js').then(({ LodManager }) => {
      if (token !== this._viewDiagToken || !this._viewDiagnosticRequested || this._viewDiagnosticDestroyed ||
          this._viewDiagnosticLod || this.isPlaying || this.player?.on || this.vp.playing) return
      this._viewDiagnosticLod = new LodManager(this, { ...cfg, editorDiagnostics: true, batchStatic: false })
      this._viewDiagnosticLod.attach()
      this.vp._editorDiagnosticLod = this._viewDiagnosticLod
      this.vp.requestRender()
    }).catch(error => { this._viewDiagnosticError = String(error?.message || error) })
      .finally(() => { if (token === this._viewDiagToken) this._viewDiagnosticRequested = false })
  },

  applyView() {
    this._bakeSync()
    const v = this.host.view
    this._syncViewDiagnosticLod(v.mode || 'lit')
    this.vp.viewMode = this.isPlaying || this.player?.on ? 'lit' : v.mode || 'lit'
    this.vp.look.setFx(v.fx !== false)
    this.vp.grid.visible = v.grid
    for (const t of this.terrains) {
      const obj = this.host.getObject(t.id)
      const on = !!obj && (this.player?.on ? this.player._nodeEnabled(obj) : nodeEffectiveActive(this.host.project.objects, obj))
      const liveVisibility = this.player?.on ? this.nodes.get(t.id)?.userData._lfRuntimeVisible : undefined
      const shown = liveVisibility ?? (obj?.visible !== false)
      t.mesh.visible = v.terrain && t.enabled && on && shown && t.visible !== false
      t.mesh.material.wireframe = v.wireframe
      t.foliage.group.visible = v.foliage && t.enabled && on && shown && t.visible !== false
    }
    this.vp.setLightPreview(v.lights)
    this.vp.liveFx = v.weather !== false
    for (const n of this.nodes.values()) this._applyViewToNode(n)
    this._worldSun() // también sincroniza la visibilidad de la luna al alternar «Luces»
    this.vp.requestRender()
  },

  _applyViewToNode(node) {
    const v = this.host.view
    if (node.userData.light) node.userData.light.visible = v.lights && !node.userData.bakedOff && !node.userData.rtOff
    if (node.userData.editorOnlyVisual) node.userData.editorOnlyVisual.visible = !this.isPlaying && !this.player?.runtime
    if (node.userData.areaFrame && (this.isPlaying || this.player?.runtime)) node.userData.areaFrame.visible = false // helper oficial es hijo de la luz, no de visual
    if (node.userData.mat) node.userData.mat.wireframe = v.wireframe
  },
}
