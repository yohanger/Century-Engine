// Luces en juego: game.node("Lampara").light.on = false · color = "#ff0000" · energy = 3 · turnOff(1) · fadeTo({ color, energy }, 2) · game.lights("Tag").
// Los cambios son de la partida (no tocan el proyecto). Se mezcla en PlayMode.prototype.
import * as THREE from 'three'
import { tagOf } from '../layers.js'

const PI = Math.PI
const hex = (c) => '#' + new THREE.Color(c).getHexString()

export const lightMethods = {
  _lightInit() { this._lightH = new Map(); this._lightFades = [] },

  /** Manejador de la luz de un nodo (undefined si el nodo no es una luz). */
  _lightHandle(obj) {
    if (!obj || obj.type !== 'light') return undefined
    this._lightH ||= new Map()
    if (this._lightH.has(obj)) return this._lightH.get(obj)
    const self = this
    const session = this._referenceSession
    const isLive = () => {
      if (self.on === false || self._referenceSession !== session) return false
      const mounted = self.ed.nodes.get(obj.id)
      return !!mounted && (Object.hasOwn(mounted, '_lfNodeOwner') ? mounted._lfNodeOwner === obj : self.project.objects.includes(obj))
    }
    const node = () => {
      if (!isLive()) throw new Error(`Referencia de luz inválida: ${obj.id}`)
      return self.ed.nodes.get(obj.id)
    }
    const l = () => node()?.userData.light
    const u = () => node()?.userData
    const dir = obj.light.type === 'directional' || obj.light.type === 'area'
    const setOn = (v) => { const n = node(); if (!n) return; n.userData.rtOff = !v; n.userData.light.visible = !!v && !n.userData.bakedOff && (n.userData.environmentSun?.multiplier ?? 1) > 0.002 && self._lightsShown(); n.userData.refreshLightEffects?.(); self.vp.requestRender() }
    const setEnergy = (e) => {
      self._tlAssertWritable?.(obj.id, 'light.energy')
      const x = u()
      const energy = Math.max(0, +e || 0)
      if (x.light.isDirectionalLight) x.rtEnergy = energy
      const intensity = energy * PI * (x.environmentSun?.multiplier ?? 1)
      if (x.fx) x.fx.base = intensity
      x.light.intensity = intensity
      x.refreshLightEffects?.()
      self.vp.requestRender()
    }
    const setColor = (c) => { self._tlAssertWritable?.(obj.id, 'light.color'); const n = node(); if (!n) return; n.userData.rtColor = hex(c); n.userData.light.color.set(c); n.userData.iconMat?.color.set(c); n.userData.refreshLightColor?.(); n.userData.refreshLightEffects?.(); self.vp.requestRender() }
    const getEnergy = () => {
      const x = u()
      if (x.environmentSun) return x.rtEnergy ?? obj.light.energy
      return (x.fx?.base ?? x.light.intensity) / PI
    }
    const cancel = () => { for (const f of self._lightFades.filter((f) => f.id === obj.id)) f.r(); self._lightFades = self._lightFades.filter((f) => f.id !== obj.id) }
    const fade = (to, seconds = 1, then) => {
      if (to.energy != null) self._tlAssertWritable?.(obj.id, 'light.energy')
      if (to.color != null) self._tlAssertWritable?.(obj.id, 'light.color')
      cancel()
      const fromColor = u().environmentSun ? u().rtColor ?? obj.color : l().color
      const from = { energy: getEnergy(), color: new THREE.Color(fromColor), range: l().distance, angle: obj.light.spotAngle }
      const goal = { energy: to.energy, color: to.color != null ? new THREE.Color(to.color) : null, range: to.range }
      return new Promise((r) => {
        const done = () => { then?.(); r() }
        if (!(seconds > 0)) { apply(goal, 1, from); return done() }
        self._lightFades.push({ id: obj.id, valid: isLive, t: 0, dur: seconds, from, goal, apply, r: done })
      })
    }
    const apply = (goal, k, from) => {
      if (goal.energy != null) setEnergy(from.energy + (goal.energy - from.energy) * k)
      if (goal.color) setColor(from.color.clone().lerp(goal.color, k))
      if (goal.range != null && !dir) { l().distance = from.range + (goal.range - from.range) * k; self.vp.requestRender() }
    }
    let nominal = null // energía «encendida» mientras la luz está apagada con fundido
    const h = {
      get on() { return !node()?.userData.rtOff && !!l()?.visible }, set on(v) { cancel(); setOn(!!v) },
      toggle() { cancel(); setOn(!h.on); return h.on },
      /** '#rrggbb' */
      get color() { return u()?.rtColor ?? obj.color }, set color(c) { cancel(); setColor(c) },
      /** En unidades de energía (la intensidad de three es π · energía). */
      get energy() { return getEnergy() }, set energy(e) { cancel(); setEnergy(e) },
      get range() { return dir ? 0 : l()?.distance ?? obj.light.range }, set range(v) { if (!dir && l()) { l().distance = Math.max(0.1, +v || 0.1); self.vp.requestRender() } },
      /** Solo focos, en grados. */
      get angle() { return obj.light.type === 'spot' ? (l()?.angle ?? 0) * 180 / PI : 0 }, set angle(v) { if (obj.light.type === 'spot' && l()) { l().angle = Math.min(89, Math.max(1, +v || 1)) * PI / 180; self.vp.requestRender() } },
      get shadow() { return !!l()?.castShadow }, set shadow(v) { if (obj.light.type === 'area') return; if (l()) { l().castShadow = !!v; self.vp.recompileMaterials?.(); self.vp.requestRender() } },
      get type() { return obj.light.type },
      /** Mezcla energía, color y/o rango en `seconds`. */
      fadeTo: (to = {}, seconds = 1) => fade(to, seconds),
      /** Enciende (con fundido opcional). */
      turnOn: (seconds = 0, to = {}) => { self._tlAssertWritable?.(obj.id, 'light.energy'); const target = to.energy ?? nominal ?? getEnergy() ?? obj.light.energy; nominal = null; cancel(); if (!h.on) { setEnergy(0); setOn(true) } return fade({ ...to, energy: target }, seconds) },
      /** Apaga (con fundido opcional); al acabar la luz queda apagada y recuerda su energía para turnOn(). */
      turnOff: (seconds = 0) => { self._tlAssertWritable?.(obj.id, 'light.energy'); if (nominal == null) nominal = getEnergy(); const e0 = nominal; return fade({ energy: 0 }, seconds, () => { setOn(false); setEnergy(e0) }) },
    }
    this._lightH.set(obj, h)
    return h
  },
  _lightsShown() { return this.session ? this.session.lightsShown : true }, // en el juego exportado las luces siempre se ven
  _lightTick(dt) {
    if (!this._lightFades?.length) return
    const invalid = this._lightFades.filter((f) => f.valid && !f.valid())
    if (invalid.length) {
      this._lightFades = this._lightFades.filter((f) => !invalid.includes(f))
      for (const f of invalid) f.r()
    }
    for (const f of [...this._lightFades]) {
      f.t = Math.min(1, f.t + dt / f.dur)
      f.apply(f.goal, f.t * f.t * (3 - 2 * f.t), f.from)
    }
    const fin = this._lightFades.filter((f) => f.t >= 1)
    this._lightFades = this._lightFades.filter((f) => f.t < 1)
    for (const f of fin) f.r()
  },
  /** game.lights("Etiqueta") → todas las luces con esa etiqueta; sin etiqueta, todas. */
  _lightsApi(tag) {
    const objs = this.project.objects.filter((o) => o.type === 'light' && (tag == null || tagMatch(o, tag)))
    return objs.map((o) => this._lightHandle(o)).filter(Boolean)
  },
}
const tagMatch = (o, tag) => tagOf(o).toLowerCase() === String(tag).trim().toLowerCase()
