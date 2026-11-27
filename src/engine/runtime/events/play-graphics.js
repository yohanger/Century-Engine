// Gráficos en el modo Jugar y el juego exportado: game.graphics.renderer = "mobile" · quality = "bajo" · resolutionScale = 0.75 · set({ bloom: 0 }) · reset()
//  · Se superpone al render del proyecto (o al método elegido en el visor del editor). En el modo Jugar del editor dura hasta detener;
//    en el juego exportado se recuerda en el navegador del jugador (para un menú «Calidad gráfica»). Se mezcla en PlayMode.prototype.
import { normalizeRender, rendererPreset, methodOf, RENDERERS, MIN_RENDER_SCALE } from '../render/config.js'

const SAFE = (p) => { const o = {}; for (const k of Object.keys(p || {})) if (k !== 'shader' && k !== 'psxContinuous') o[k] = p[k]; return o }

export const graphicsMethods = {
  _gfxInit() {
    this._gfx = {}
    if (this.runtime) { try { const raw = this.rt.storage.get('graphics'); if (raw) this._gfx = SAFE(JSON.parse(raw)) } catch { /* sin almacenamiento */ } }
    this._gfxApi = null
  },
  /** Render efectivo: el del editor/proyecto + lo que el juego haya cambiado con game.graphics. */
  _gfxRender() {
    const base = this.ed.baseRender()
    return Object.keys(this._gfx || {}).length ? normalizeRender({ ...base, ...this._gfx }) : base
  },
  /** Reaplica el render tras un cambio y deja el perfil de post-proceso actual encima. */
  _gfxRefresh() {
    if (this._prof) { this._prof.base = this._gfxRender(); this._profApply(this._profWanted(), 0) } else this.ed.vp.setRender(this._gfxRender())
    this.ed.refreshMaterials?.()
    this.ed.syncPsxModels?.()
    this.vp.requestRender()
  },
  _gfxSave() {
    if (!this.runtime) return
    try { Object.keys(this._gfx).length ? this.rt.storage.set('graphics', JSON.stringify(this._gfx)) : this.rt.storage.remove('graphics') } catch { /* nada */ }
  },
  _gfxPatch(patch) { Object.assign(this._gfx, SAFE(patch)); this._gfxSave(); this._gfxRefresh() },

  _graphicsApi() {
    if (this._gfxApi) return this._gfxApi
    const self = this
    this._gfxApi = {
      /** 'forward' (Forward+) · 'mobile' · 'compat' (Compatibility). */
      get renderer() { return methodOf(self._gfxRender()) },
      set renderer(id) { if (!RENDERERS.some((r) => r.id === id)) throw new Error(`Método de render desconocido «${id}» (usa: ${RENDERERS.map((r) => r.id).join(', ')})`); const { backend, shader, psx, psxHeight, psxSnap, psxAffine, psxContinuous, environmentLook, staticOcclusion, ...p } = rendererPreset(id); const r = self._gfxRender(); self._gfx = { psx: r.psx, psxHeight: r.psxHeight, psxSnap: r.psxSnap, psxAffine: r.psxAffine }; self._gfxPatch(p) },
      get renderers() { return RENDERERS.map((r) => ({ id: r.id, name: r.name })) },
      /** 'alto' | 'medio' | 'bajo' (calidad de sombras, reflejos y efectos). */
      get quality() { return self._gfxRender().profile },
      set quality(q) { if (!['alto', 'medio', 'bajo'].includes(q)) throw new Error('quality: "alto", "medio" o "bajo"'); self._gfxPatch({ profile: q }) },
      /** Escala de resolución 0.25–1. */
      get resolutionScale() { return self._gfxRender().resScale },
      set resolutionScale(v) { self._gfxPatch({ resScale: Math.min(1, Math.max(MIN_RENDER_SCALE, +v || 1)) }) },
      /** Copia de los ajustes de render actuales (los mismos nombres que Ajustes del juego ▸ Render). */
      get settings() { const { psxContinuous, ...settings } = self._gfxRender(); return settings },
      set: (patch) => self._gfxPatch(patch || {}),
      /** Vuelve a lo que dice el proyecto. */
      reset: () => { self._gfx = {}; self._gfxSave(); self._gfxRefresh() },
    }
    return this._gfxApi
  },
}
