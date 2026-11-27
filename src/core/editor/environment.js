// Vista previa de perfiles de post-proceso (solo editor). El resto de la escena vive en engine/runtime/scene/environment.js
import { applyProfile, lerpRender } from '../../engine/runtime/render/profiles.js'
import { volumeRender, renderChanged } from '../../engine/runtime/render/postvolumes.js'

export const environmentMethods = {
  /** Vista previa de un perfil de post-proceso en el visor del editor (null = el render normal del proyecto). */
  previewProfile(profile) {
    this._postPreviewProfile = profile || null
    const base = this.baseRender()
    this.vp.setRenderLive(profile ? applyProfile(base, profile) : base)
    this._postVolumeDisplay = null
  },
  _postVolumeEditorTick(dt) {
    if (this.player?.on || this._postPreviewProfile) return
    const p = this.host.project
    if (!this._postVolumeEditorActive && !p?.objects?.some(o => o.type === 'postvolume')) return
    const result = volumeRender(this.baseRender(), p?.objects, this.nodes, this.vp.camera, p?.profiles)
    if (!result.active && !this._postVolumeEditorActive) return
    // La primera entrada también debe interpolar: partimos del Render normal, no del perfil final.
    const previous = this._postVolumeDisplay || this.baseRender()
    const duration = result.active ? result.duration : this._postVolumeEditorDuration || 0
    const render = duration > 0 && previous ? lerpRender(previous, result.render, Math.min(1, Math.max(0, dt) * 5 / duration)) : result.render
    if (renderChanged(previous, render)) this.vp.setRenderLive(render)
    this._postVolumeDisplay = render
    this._postVolumeEditorDuration = result.active || renderChanged(render, result.render) ? duration : 0
    this._postVolumeEditorActive = result.active || this._postVolumeEditorDuration > 0
  }
}
