// Texturas de carretera y de sprites
import * as THREE from 'three'

export const texturesMethods = {
  // ---------- carreteras ----------
  _roadTexture(id, mode = 'color') {
    if (!this._roadTex) {
      this._roadTex = new Map()
      this._roadTexLoading = new Map()
      this._roadTexFailed = new Set()
    }
    const key = `${id}|${mode}`
    const cached = this._roadTex.get(key)
    if (cached) return cached
    if (this._roadTexFailed.has(key) || this._roadTexLoading.has(key)) return null
    const token = {}
    this._roadTexLoading.set(key, token)
    Promise.resolve().then(() => this.host.assetImage(id)).then((img) => {
      if (this._roadTexLoading.get(key) !== token) return // la imagen se reemplazó antes de terminar
      if (!img) throw new Error('Imagen inexistente')
      const tx = new THREE.Texture(img)
      tx.colorSpace = mode === 'normal' ? THREE.NoColorSpace : THREE.SRGBColorSpace
      tx.wrapS = tx.wrapT = THREE.RepeatWrapping
      tx.anisotropy = 8
      tx.needsUpdate = true
      this._roadTex.set(key, tx)
      this._resyncRoadTexture(id)
    }).catch((err) => {
      if (this._roadTexLoading.get(key) !== token) return
      this._roadTexFailed.add(key)
      this.host.toast?.(`No se pudo cargar la textura de carretera: ${err.message || err}`, 'error')
      this._resyncRoadTexture(id)
    }).finally(() => {
      if (this._roadTexLoading.get(key) === token) this._roadTexLoading.delete(key)
    })
    return null
  },
  _resyncRoadTexture(id) {
    for (const o of this.host.project?.objects || []) {
      if (o.type === 'road' && Object.values(o.props?.slots || {}).some((s) => s?.texture === id)) this.syncObject(o.id)
      else if (o.type === 'water' && o.props?.texture === id) this.syncObject(o.id)
    }
  },
  /** Reimportar o repintar una imagen invalida todas las variantes y cargas pendientes. */
  forgetRoadTexture(id = null) {
    for (const key of [...this._roadTexLoading?.keys() || []]) {
      if (id == null || key.startsWith(`${id}|`)) this._roadTexLoading.delete(key)
    }
    for (const [key, tex] of [...this._roadTex?.entries() || []]) {
      if (id == null || key.startsWith(`${id}|`)) { this._roadTex.delete(key); tex.dispose() }
    }
    for (const key of [...this._roadTexFailed || []]) {
      if (id == null || key.startsWith(`${id}|`)) this._roadTexFailed.delete(key)
    }
    if (id != null) this._resyncRoadTexture(id)
  },

  // ---------- sprites (nodes/sprite.js) ----------
  /** Textura de la imagen de un sprite (una por recurso; se reutiliza). null mientras carga: al cargar se redibujan los sprites. */
  spriteTexture(id) {
    if (!this._spriteTex) { this._spriteTex = new Map(); this._spriteLoading = new Set(); this._spriteFailed = new Set() }
    const t = this._spriteTex.get(id)
    if (t) return t
    if (this._spriteFailed.has(id)) return null
    if (!this._spriteLoading.has(id)) {
      this._spriteLoading.add(id)
      this.host.assetImage(id).then((img) => {
        this._spriteLoading.delete(id)
        if (!img) { this._spriteFailed.add(id); return }
        const tx = new THREE.Texture(img); tx.colorSpace = THREE.SRGBColorSpace; tx.needsUpdate = true
        this._spriteTex.set(id, tx)
        this._resyncSprites(id)
      }).catch(() => { this._spriteLoading.delete(id); this._spriteFailed.add(id) })
    }
    return null
  },
  /** La imagen de un recurso cambió (se pintó o se reimportó): se vuelve a cargar en los sprites y eventos que la usan. */
  forgetSpriteTexture(id) {
    const t = this._spriteTex?.get(id)
    if (t) { t.dispose(); this._spriteTex.delete(id) }
    this._spriteFailed?.delete(id)
    this.spriteTexture(id)
  },
  _resyncSprites(id) {
    for (const o of this.host.project?.objects || []) {
      if ((o.type === 'sprite3d' || o.type === 'sprite2d' || o.type === 'decal') && o.props?.image === id) this.syncObject(o.id)
      else if (o.type === 'vfx' && (this.host.project?.vfx || []).some((fx) => fx.id === o.props?.vfxId && fx.appearance.textureId === id)) this.syncObject(o.id)
      else if (o.type === 'event') this.syncObject(o.id)
    }
  },
}
