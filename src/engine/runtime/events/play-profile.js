// Perfiles de post-proceso en el modo Jugar y el juego exportado (core/render/profiles.js). Se mezcla en PlayMode.prototype.
//  · Los marcadores Spawn antiguos sólo son destinos de escenas existentes; GameManager y Cámara siguen siendo propietarios.
//  · Una cámara de escena o Timeline con perfil tiene prioridad y restaura el fallback al salir.
//  · game.profile.set("Noche", 2) · game.profile.clear(1) · comando «Perfil de post-proceso». Los overrides de script/evento se mezclan en `seconds` y clear restaura la jerarquía.
import { normalizeRender } from '../render/config.js'
import { applyProfile, lerpRender, findProfile } from '../render/profiles.js'
import { volumeRender, renderChanged } from '../render/postvolumes.js'

export const profileMethods = {
  _profInit() {
    const base = this._gfxRender()
    this._prof = { base, cur: base, from: base, to: base, t: 1, dur: 0,
      id: '', player: this._gm?.profile || '', cam: '', override: null, display: null, volumeActive: false, volumeTime: 0 }
    this._profApply(this._prof.player, 0)
  },
  // Orden único: override temporal > cámara activa > marcador histórico explícito > GameManager > Render.
  _profWanted() {
    const p = this._prof
    if (!p) return ''
    return p.override !== null ? p.override : (p.cam || p.player || this._gm?.profile || '')
  },
  _profApply(key, seconds = 0) {
    const P = this._prof
    if (!P) return null
    const pr = key ? findProfile(this.project.profiles, key) : null
    if (key && !pr) throw new Error(`No existe el perfil «${key}» (Assets/Profiles)`)
    P.to = pr ? applyProfile(P.base, pr) : P.base
    P.from = P.cur; P.t = 0; P.dur = Math.max(0, +seconds || 0); P.id = pr?.id || ''
    if (P.dur <= 0) { P.cur = P.to; P.t = 1; if (!P.volumeActive) { P.display = P.cur; this.vp.setRenderLive(P.cur) } }
    return pr?.name ?? null
  },
  /** Activa un override temporal; al limpiar vuelve a cámara y GameManager (o marcador antiguo explícito). */
  _profSet(key, seconds = 0) {
    if (key && !findProfile(this.project.profiles, key)) throw new Error(`No existe el perfil «${key}» (Assets/Profiles)`)
    if (!this._prof) return null
    this._prof.override = key || null
    return this._profApply(this._profWanted(), seconds)
  },
  _profTick(dt) {
    const P = this._prof
    if (!P || P.t >= 1) return
    P.t = Math.min(1, P.t + dt / P.dur)
    P.cur = lerpRender(P.from, P.to, P.t * P.t * (3 - 2 * P.t))
    if (!P.volumeActive) { P.display = P.cur; this.vp.setRenderLive(P.cur) }
  },
  /** Al final del frame la cámara ya incluye la posición de Timelines y cámaras fijas. */
  _profVolumesTick(dt) {
    const P = this._prof
    if (!P) return
    const r = P.override === null ? volumeRender(P.cur, this.project.objects, this.ed.nodes, this.cam, this.project.profiles) : { render: P.cur, active: false, duration: 0 }
    const duration = P.override === null ? (r.active ? r.duration : P.volumeTime) : 0
    let render = r.render
    if (duration > 0 && P.display && (r.active || P.volumeTime > 0)) {
      // La distancia de mezcla actúa en el espacio y el tiempo suaviza entradas, salidas y teleportaciones.
      const t = Math.min(1, Math.max(0, dt) / duration * 5)
      render = lerpRender(P.display, render, t)
    }
    P.volumeTime = r.active || renderChanged(render, r.render) ? duration : 0
    P.volumeActive = r.active || P.volumeTime > 0
    if (renderChanged(P.display, render) || !P.display) { P.display = render; this.vp.setRenderLive(render) }
  },
  _profEnd() { if (this._prof) { this._prof = null; this.ed.vp.setRender(this.ed.baseRender()) } },
  _profSpawn(spawnObj) {
    const P = this._prof
    if (!P) return
    P.player = spawnObj?.props?.profile || this._gm?.profile || ''
    if (!P.cam && P.override === null) this._profApply(this._profWanted(), 0)
  },
  _profCamera(profileId, seconds = 0.4) {
    const P = this._prof
    if (!P) return
    const want = profileId || ''
    if (want === P.cam) return
    P.cam = want
    if (P.override === null) this._profApply(this._profWanted(), seconds)
  },
  _profileApi() {
    const self = this
    return {
      set: (name, seconds = 0) => self._profSet(name, seconds),
      clear: (seconds = 0) => self._profSet('', seconds),
      get current() { return self._prof?.id ? findProfile(self.project.profiles, self._prof.id)?.name ?? null : null },
    }
  },
}
