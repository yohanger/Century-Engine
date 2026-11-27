// Sonido del clima: lluvia y viento en bucle (su volumen sigue a la intensidad) y truenos con retraso según la distancia del rayo.
// Los clips se eligen en Escena ▸ Clima ▸ «Sonido del clima» (rainSound, windSound, boltSound, thunders[]).
// Sin DOM propio: usa el AudioScene del modo juego (resolveClip + engine.play).
// Trueno procedural (Escena ▸ Clima ▸ «Sonido del trueno»): se sintetiza con world/thunder.js (canal del rayo → pulsos con su retardo, cuerpo grave,
// región acústica del oyente) y pasa por un paso bajo que sigue a la oclusión (techos y paredes, por rayos de sonido que pone quien lo crea).
//
// Bloque G (0.26.11): la misma oclusión atenúa los bucles de lluvia y viento (bajo un techo la lluvia casi desaparece; el viento baja menos
// porque se cuela por grietas). El viento usa el viento LOCAL si hay obstáculos registrados (bloque F), no el viento global.
import { synthThunder, pickRegion, occlusionFilter } from './thunder.js'
import { normalizeRainAudio } from './rain-audio-profile.js'
import { surfaceFromPaintName } from '../layers.js'
const rnd = (a, b) => a + Math.random() * (b - a)

export class WeatherAudio {
  /** @param {{world:any, audio:any, camera:()=>any, probe?:(bearing:number|null)=>number}} o  `probe`: oclusión 0–1 en la posición del oyente (rayos de sonido). */
  constructor({ world, audio, camera, probe = null, scene = null }) {
    this.world = world; this.audio = audio; this.camera = camera; this.probe = probe; this.scene = scene
    this.occ = 0; this.occTarget = 0; this.occOverride = null; this._probeT = 0; this.active = [] // truenos procedurales sonando: { lp, gain, voice }
    this.lastThunder = null // última síntesis (para pruebas y depuración)
    this.muted = false
    this.loops = { rain: { id: null, voice: null, busy: false, vol: 0 }, wind: { id: null, voice: null, busy: false, vol: 0 } }
    this.log = [] // últimos sonidos lanzados (para pruebas y depuración)
    this.on = true
    this._rainClock = 0; this._rainTokens = 0; this._rainBusy = 0
    this._rainVoices = new Set(); this._rainLast = new Map(); this._rainPrev = new Map()
    this._rainGeneration = 0
  }

  get cfg() { return this.world.cfg.weather }
  get engine() { return this.audio?.engine }

  mute(on = true) { this.muted = !!on }

  _target(kind) {
    const c = this.cfg, w = this.world
    if (this.muted || !w.weatherOn) return 0
    if (kind === 'rain') {
      if (!c.rainSound) return 0
      // Bajo un techo la lluvia casi no se oye (occ 0.9 → factor 0.235); factor 0.85 para la lluvia.
      const occFade = 1 - this.occ * 0.85
      return Math.min(1, (w.rainLevel || 0) ** 0.7) * c.rainVolume * occFade
    }
    // Viento local si hay obstáculos registrados (bloque F), si no el global.
    let sp = w.frame().wind.speed
    if (w._wf && w._wf.size > 0) {
      const cam = this.camera?.(); if (cam?.position) sp = (w.windAt(cam.position.x, cam.position.z).speed ?? sp)
    }
    if (!c.windSound) return 0
    // El viento se cuela por grietas: factor 0.55 (menos atenuación que la lluvia).
    const occFadeW = 1 - this.occ * 0.55
    return Math.min(1, sp / 18) ** 0.8 * c.windVolume * occFadeW
  }

  async _ensureLoop(kind, clip) {
    const L = this.loops[kind]
    if (L.busy) return
    L.busy = true
    try {
      const id = this.audio.resolveClip(clip)
      if (!id) return
      const v = await this.engine.play(id, { mode: 'ui', group: 'ambient', loop: true, volume: 0 })
      if (!this.on) { v?.stop(); return }
      L.voice = v; L.id = clip
    } catch (e) { console.warn('Sonido del clima', e) } finally { L.busy = false }
  }

  update(dt) {
    if (!this.on || !this.engine?.ctx) return
    this._updateOcclusion(dt)
    this._rainClock += Math.max(0, Number.isFinite(dt) ? dt : 0)
    this._rainTokens = Math.min(8, this._rainTokens + Math.max(0, Number.isFinite(dt) ? dt : 0) * 8)
    const c = this.cfg
    for (const kind of ['rain', 'wind']) {
      const L = this.loops[kind], clip = c[kind + 'Sound'], target = this._target(kind)
      if (L.voice && L.id !== clip) { L.voice.stop(0.3); L.voice = null; L.id = null } // cambió el clip
      L.vol += (target - L.vol) * Math.min(1, dt * 1.5) // entra y sale con suavidad
      if (!L.voice) { if (target > 0.01 && clip) this._ensureLoop(kind, clip); continue }
      L.voice.setVolume(L.vol)
      if (target < 0.005 && L.vol < 0.01) { L.voice.stop(0.2); L.voice = null; L.id = null } // sin lluvia no gasta una voz
    }
  }

  /** Superficie que recibe el impacto. Consulta agua física y capas pintadas, sin añadir volumen. */
  _rainSurface(hit) {
    const p = hit.point
    if (hit.surface) return hit.surface
    const water = this.scene?._activeWaterWorld?.at?.(p[0], p[2])
    if (water && Math.abs(water.surface - p[1]) < 0.09) return 'water'
    for (const t of this.scene?.terrains || []) {
      const h = t.groundAt(p[0], p[2])
      if (Number.isFinite(h) && Math.abs(h - p[1]) < 0.12) {
        const layer = t.layers?.[t.paintAt(p[0], p[2])]
        return layer?.surface || surfaceFromPaintName(layer?.name) || 'dirt'
      }
    }
    return 'stone'
  }

  /** Muestreo acústico de impactos visuales. Límite global 8/s y cuatro voces/peticiones. */
  impact(hit) {
    if (!this.on || this.muted || !this.world?.weatherOn || !(this.world.rainLevel > 0) || !this.cfg.rainImpacts ||
        !this.engine?.ctx || !hit?.point || hit.point.length !== 3 || !hit.point.every(Number.isFinite)) return false
    const surface = this._rainSurface(hit)
    const own = hit.rainAudio ? normalizeRainAudio(hit.rainAudio) : null
    const profile = own?.enabled ? own : (this.cfg.rainImpactProfiles || []).find((p) => p.enabled && p.surface === surface)
    if (!profile || !profile.clips?.length || !profile.maxRate || !profile.volume) return false
    const point = hit.point, listener = this.listener().pos
    const distance = Math.hypot(point[0] - listener[0], point[1] - listener[1], point[2] - listener[2])
    if (distance > 22 || this._rainBusy + this._rainVoices.size >= 4 || this._rainTokens < 1) return false
    const key = (hit.materialId || '') + ':' + surface
    const last = this._rainLast.get(key) ?? -Infinity
    if (this._rainClock - last < 1 / profile.maxRate) return false
    const available = profile.clips.map((c) => ({ name: c, id: this.audio.resolveClip(c) })).filter((c) => c.id)
    if (!available.length) return false
    let index = Math.floor(Math.random() * available.length)
    if (available.length > 1 && index === this._rainPrev.get(key)) index = (index + 1) % available.length
    this._rainPrev.set(key, index)
    this._rainLast.set(key, this._rainClock)
    this._rainTokens--
    this._rainBusy++
    const clip = available[index]
    const volume = Math.min(1, this.world.rainLevel) * profile.volume
    const pitch = 1 + rnd(-profile.pitch, profile.pitch)
    const gen = this._rainGeneration
    this.engine.play(clip.id, { mode: '3d', group: 'sfx', position: [...point], volume, pitch,
      minDistance: 1.5, maxDistance: 24, occlusion: true }).then((voice) => {
      if (!voice) return
      if (!this.on || this._rainGeneration !== gen) { voice.stop(); return }
      if (hit.ownerId) voice.occlusionOwner = this.scene?.nodes?.get?.(hit.ownerId) || null
      this._rainVoices.add(voice)
      voice.done.then(() => this._rainVoices.delete(voice))
    }).catch(() => { /* recurso ilegible o audio no disponible: no interrumpir el juego */ })
      .finally(() => { this._rainBusy = Math.max(0, this._rainBusy - 1) })
    return true
  }

  /** Elige un trueno de la lista según la distancia (cerca/lejos/cualquiera). */
  pickThunder(distance) {
    const c = this.cfg, near = distance < c.thunderNear
    const all = (c.thunders || []).filter((t) => t.clip)
    const fit = all.filter((t) => t.kind === 'any' || (t.kind === 'near') === near)
    const pool = fit.length ? fit : all
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null
  }

  /** Un rayo: el crujido llega al instante si cae cerca; el trueno después (e.delay). */
  lightning(e) {
    if (!this.on || this.muted) return
    const c = this.cfg
    if (c.boltSound && e.distance < c.thunderNear) this._play(c.boltSound, { volume: c.thunderVolume * 0.9, pitch: rnd(0.95, 1.05), kind: 'bolt' })
  }

  thunder(e) {
    if (!this.on || this.muted) return null
    if (this.cfg.thunderSound === 'procedural') return this._procedural(e)
    const t = this.pickThunder(e.distance); if (!t) return null
    const k = 1 / (1 + (e.distance / 1500) ** 1.5) // lejos suena más flojo y más grave
    this._play(t.clip, { volume: this.cfg.thunderVolume * (t.volume ?? 1) * (0.25 + 0.75 * k), pitch: (0.8 + 0.25 * k) * rnd(0.96, 1.04), kind: 'thunder', distance: e.distance })
    return null
  }

  // ---------- posición del oyente, región y oclusión ----------
  /** Oído y hacia dónde mira (rumbo 0 = norte −Z) a partir de la cámara. */
  listener() {
    const cam = this.camera?.(), m = cam?.matrixWorld?.elements
    if (!m) return { pos: [0, 1.7, 0], yaw: 0 }
    return { pos: [m[12], m[13], m[14]], yaw: Math.atan2(-m[8], m[10]) }
  }
  /** Región acústica que vale donde está el oyente. */
  get region() { return pickRegion(this.cfg.thunderRegions, this.listener().pos, this.cfg.thunderRegion) }
  /** Oclusión actual (0 al aire libre – 0,92 tapado), ya suavizada. */
  get occlusion() { return this.occ }
  /** Fuerza la oclusión desde un script (0–1); `null` vuelve a la automática. */
  setOcclusion(v) { this.occOverride = v == null ? null : Math.min(1, Math.max(0, +v || 0)) }

  _updateOcclusion(dt) {
    const c = this.cfg
    if (!this.active.length && !c.rainSound && !c.windSound && !c.rainImpacts) return
    this._probeT -= dt
    if (this._probeT <= 0) {
      this._probeT = 0.25
      const floor = this.region.preset.occlusion || 0
      const auto = c.soundOcclusion && this.probe ? this.probe(null) || 0 : 0
      this.occTarget = this.occOverride ?? Math.max(floor, auto)
    }
    this.occ += (this.occTarget - this.occ) * Math.min(1, dt * 6)
    if (!this.active.length) return
    const f = occlusionFilter(this.occ), t = this.engine.ctx.currentTime
    for (const a of this.active) { a.lp.frequency.setTargetAtTime(f.cutoff, t, 0.05); a.gain.gain.setTargetAtTime(f.gain, t, 0.05) }
  }

  /** Sintetiza y reproduce el trueno de `e` (= evento 'thunder'). Devuelve { region, occlusion, loudness } para los scripts, o null. */
  _procedural(e) {
    const ctx = this.engine?.ctx; if (!ctx) return null
    const c = this.cfg, L = this.listener(), reg = this.region
    const s = synthThunder({ distance: e.distance, bearing: e.bearing, yaw: L.yaw, seed: e.seed ?? Math.round(e.distance * 1000), peakKA: e.peak ?? c.peakKA, region: reg.preset,
      cloudBase: e.altitude, thickness: e.thickness, sampleRate: 22050 })
    this.lastThunder = { ...s.stats, region: reg.id, level: s.level, duration: s.duration, distance: e.distance, left: s.left, right: s.right }
    const buf = ctx.createBuffer(2, s.left.length, s.sampleRate)
    buf.copyToChannel(s.left, 0); buf.copyToChannel(s.right, 1)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.6
    const gain = ctx.createGain(), f = occlusionFilter(this.occ)
    lp.frequency.value = f.cutoff; gain.gain.value = f.gain
    lp.connect(gain); gain.connect(this.engine.groupInput('sfx'))
    const vol = c.thunderVolume * s.level, a = { lp, gain, voice: null }
    this.active.push(a)
    this.log.push({ clip: '(procedural)', kind: 'thunder', volume: vol, pitch: 1, distance: e.distance, found: true, region: reg.id }); if (this.log.length > 30) this.log.shift()
    this.engine.playBuffer(buf, { mode: 'ui', group: 'sfx', volume: vol, dest: lp, offset: s.preroll }).then((v) => {
      a.voice = v
      if (!v) return this._release(a)
      if (!this.on) v.stop()
      v.done.then(() => this._release(a))
    }).catch(() => this._release(a))
    return { region: reg.id, occlusion: this.occ, loudness: vol }
  }
  _release(a) {
    const i = this.active.indexOf(a); if (i >= 0) this.active.splice(i, 1)
    try { a.lp.disconnect(); a.gain.disconnect() } catch { /* ya soltado */ }
  }

  _play(clip, o) {
    const id = this.audio.resolveClip(clip)
    this.log.push({ clip, kind: o.kind, volume: o.volume, pitch: o.pitch, distance: o.distance, found: !!id })
    if (this.log.length > 30) this.log.shift()
    if (!id) return
    this.engine.play(id, { mode: 'ui', group: 'sfx', volume: o.volume, pitch: o.pitch }).catch(() => {})
  }

  stop() {
    this.on = false
    this._rainGeneration++
    for (const v of this._rainVoices) v.stop(0.08)
    this._rainVoices.clear()
    this._rainLast.clear(); this._rainPrev.clear()
    for (const L of Object.values(this.loops)) { L.voice?.stop(0.2); L.voice = null }
    for (const a of [...this.active]) { a.voice?.stop(0.1); this._release(a) }
  }
}
