// Animaciones en el modo Jugar y el juego exportado (core/anim/): clips de claves sobre un nodo, sus hijos o un slot del view model.
//  · game.node("Vaso").playAnimation("Beber", { loop, speed, fade, from, additive }) → manejador { done, stop(), pause(), seek()… }
//  · game.viewModel.slot("right").playAnimation("Beber")  ·  game.animation.play(nodo, clip) / stop(nodo?, clip?) / list()
//  · comandos «Reproducir animación» / «Detener animación»; los eventos del clip lanzan comandos y game.on("animationEvent").
import * as THREE from 'three'
import { AnimRunner } from '../anim/eval.js'
import { findClip, PROPS, nodeAnimationProperty } from '../anim/model.js'
import { DEG } from '../util.js'
import { ModelRunner, findModelClip, describeClips, resetPose } from '../anim/modelclips.js'
import { resolveGraphic } from '../database/models.js'

const _e = new THREE.Euler()

export const animMethods = {
  _animInit() { this._anims = []; this._animKin = new Set(); this._mixers = new Map() },

  /** Solo una finalización natural del nodo y de esta estancia puede emitir la señal nativa. */
  _animFinished(root, runner, stopped, session) {
    if (stopped || root.slot || !this.on || session !== this._referenceSession) return
    const obj = root.obj, node = obj && this.ed.nodes.get(obj.id)
    if (!obj || !this.project.objects.includes(obj) || node?._lfNodeOwner !== obj ||
        this.ed.nodeLifecycle?.entered.get(obj.id)?.obj !== obj) return
    this.ed.nodeLifecycle.scripts?.emitNativeAnimationFinished(obj, runner.clip.name)
  },
  _animReset() { for (const a of [...(this._anims || [])]) { if (a.runner.dispose) a.runner.dispose(); else { a.runner.finished = true; a.runner._res({ stopped: true, clip: a.runner.clip.name }) } } this._anims = []; this._animKin = new Set(); for (const m of (this._mixers || new Map()).values()) m.mixer.stopAllAction(); this._mixers = new Map() },

  /** Modelo visible del nodo. Los eventos también pueden mostrar modelos desde Database. */
  _modelSource(root) {
    const obj = root?.obj
    if (!obj) return null
    if (obj.modelId) return { id: obj.modelId, scene: this.ed.nodes.get(obj.id)?.userData?.modelRoot }
    if (obj.type !== 'event') return null
    const event = this.events?.find((e) => e.id === obj.id)
    const page = event?.props?.pages?.[event.pageIdx]
    const graphic = resolveGraphic(page?.graphic, this.game?.party?.db || this.project.database)
    if (graphic?.kind !== 'model') return null
    // En un evento, el modelo se crea dentro de gfx, no en userData.modelRoot.
    return { id: graphic.modelId, scene: event?.gfx?.children?.[0] }
  },
  /** Clip embebido en un modelo (huesos / skinning / morph), incluido el gráfico de un evento. */
  _modelClip(root, name) {
    const obj = root?.obj, source = this._modelSource(root)
    if (!source?.scene) return null
    const found = findModelClip(this.ed.modelClips?.get(source.id), name)
    return found ? { ...found, modelId: source.id, obj, node: this.ed.nodes.get(obj.id), mr: source.scene } : null
  },
  _mixerFor(mc) {
    let m = this._mixers.get(mc.obj.id)
    // Si el evento cambia de página, su modelo anterior ya no es el que se ve.
    if (m && m.root !== mc.mr) { m.mixer.stopAllAction(); this._mixers.delete(mc.obj.id); m = null }
    if (!m) { m = { mixer: new THREE.AnimationMixer(mc.mr), root: mc.mr }; this._mixers.set(mc.obj.id, m) }
    return m.mixer
  },
  /** Clips embebidos del modelo visible, también si proviene de Database. */
  modelAnimationNames(target, eventId) {
    const source = this._modelSource(this._animRoot(target, eventId))
    return describeClips(this.ed.modelClips?.get(source?.id)).map((c) => c.name)
  },

  /** Raíz de una animación: { obj } (nodo del proyecto) o { slot } (anclaje del view model). */
  _animRoot(target, eventId) {
    if (target && typeof target === 'object' && target.slotId) return { slot: this._vmSlot(target.slotId) }
    const { obj } = this._vmTarget(target, eventId)
    return { obj }
  },
  _animRootKey: (r) => (r.slot ? 'slot:' + r.slot.id : r.obj.id),
  _animRootName: (r) => (r.slot ? 'slot ' + r.slot.id : r.obj.name),

  /** Nodo THREE al que apunta una pista (o undefined). */
  _animTarget(root, path) {
    if (!path) return root.slot ? { node: root.slot.anchor, slot: true } : { node: this.ed.nodes.get(root.obj.id), obj: root.obj }
    if (path.startsWith('@slot:')) { const s = this.vm?.slots.get(path.slice(6)); return s ? { node: s.anchor, slot: true } : undefined }
    if (root.slot) return undefined
    let cur = root.obj
    for (const name of path.split('/')) {
      cur = this.project.objects.find((o) => o.parentId === cur.id && o.name.toLowerCase() === name.trim().toLowerCase())
      if (!cur) return undefined
    }
    return { node: this.ed.nodes.get(cur.id), obj: cur }
  },

  _animHost(root, clipName) {
    const self = this, session = this._referenceSession
    const warned = new Set()
    const warn = (k, msg) => { if (warned.has(k)) return; warned.add(k); self.game?.log?.(msg) ?? console.warn(msg) }
    return {
      read(tr) {
        const t = self._animTarget(root, tr.path); if (!t?.node) return undefined
        const n = t.node
        if (tr.prop === 'position') return n.position.toArray()
        if (tr.prop === 'rotation') { _e.setFromQuaternion(n.quaternion, 'YXZ'); return [_e.x / DEG, _e.y / DEG, _e.z / DEG] }
        if (tr.prop === 'scale') { const s = (t.slot ? n : n.userData.visual || n).scale; return s.toArray() }
        if (tr.prop === 'visible') return n.visible
        if (tr.prop === 'active' && t.obj) return n.userData._lfRuntimeActive ?? (t.obj.active !== false)
        const custom = nodeAnimationProperty(t.obj, tr.prop)
        if (custom?.ownerType) return custom.runtimeRead ? custom.runtimeRead(n, t.obj) : custom.read(t.obj)
        const L = t.obj && self._lightHandle(t.obj)
        if (tr.prop === 'light.energy') return L?.energy
        if (tr.prop === 'light.color') return L?.color
        return undefined
      },
      apply(tr, v) {
        const t = self._animTarget(root, tr.path)
        if (!t?.node) { warn(tr.path + tr.prop, `Animación «${clipName}»: no se encuentra «${tr.path || 'el nodo'}»`); return }
        const n = t.node
        if (t.obj && self._tlChannelOwner?.(t.obj.id, tr.prop)) return // Clip independiente sigue en sus demás canales.
        const moved = () => { n.updateMatrixWorld(true); if (!t.slot) self.phys?.syncNode(n) }
        if (tr.prop === 'visible') { if (t.slot) n.visible = !!v; else if ((n.userData._lfRuntimeVisible ?? (t.obj.visible !== false)) !== !!v) self._nodeVisible(t.obj.id, !!v); return }
        if (tr.prop === 'active' && t.obj) { if ((n.userData._lfRuntimeActive ?? (t.obj.active !== false)) !== !!v) self._nodeActive(t.obj.id, !!v); return }
        if (tr.prop === 'position') { if (!t.slot && !self._animKin.has(n)) { self._animKin.add(n); self.phys?.makeKinematic(n) } n.position.set(v[0], v[1], v[2]); moved() }
        else if (tr.prop === 'rotation') { if (!t.slot && !self._animKin.has(n)) { self._animKin.add(n); self.phys?.makeKinematic(n) } n.rotation.order = 'YXZ'; n.rotation.set(v[0] * DEG, v[1] * DEG, v[2] * DEG); moved() }
        else if (tr.prop === 'scale') { (t.slot ? n : n.userData.visual || n).scale.set(v[0], v[1], v[2]); n.updateMatrixWorld(true) }
        else if (t.obj) {
          const custom = nodeAnimationProperty(t.obj, tr.prop)
          if (custom?.ownerType) custom.apply(n, v, t.obj)
        }
        else if (tr.prop === 'light.energy') { const L = t.obj && self._lightHandle(t.obj); if (L) L.energy = v }
        else if (tr.prop === 'light.color') { const L = t.obj && self._lightHandle(t.obj); if (L) L.color = v }
        self.vp.requestRender()
      },
      event(ev) {
        if (!self.game) return
        self.game.emit('animationEvent', { node: self._animRootName(root), clip: clipName, name: ev.name })
        if (ev.list?.length) self.game.run(ev.list, { name: `Animación ${clipName}: ${ev.name || 'evento'}`, eventId: root.obj?.type === 'event' ? root.obj.id : undefined })
      },
      end(runner, stopped) {
        self._anims = self._anims.filter((a) => a.runner !== runner)
        self._animFinished(root, runner, stopped, session)
      },
    }
  },

  /** Reproduce un clip. Si ese clip ya suena en esa raíz, lo reinicia. Devuelve el manejador. */
  animationPlay(target, clipName, opts = {}, eventId) {
    const root = this._animRoot(target, eventId)
    const key = this._animRootKey(root)
    const clip = findClip(this.project.animations, clipName)
    const mc = !clip && this._modelClip(root, clipName)
    if (mc) {
      // animación del propio modelo: sustituye a las demás de su misma capa en ese nodo (con fundido si fade > 0). Capas distintas suenan a la vez.
      const layer = String(opts.layer ?? '')
      for (const a of this._anims.filter((x) => x.key === key && x.runner.clip.model && (x.layer || '') === layer)) a.runner.stop(+opts.fade || 0)
      const runner = new ModelRunner(this._mixerFor(mc), mc.mr, mc, mc.modelId, { loop: opts.loop ?? false, speed: opts.speed, fade: opts.fade, from: opts.from, weight: opts.weight, mask: opts.mask })
      const session = this._referenceSession
      runner.host.end = (r, stopped) => {
        this._anims = this._anims.filter((a) => a.runner !== r)
        this._animFinished(root, r, stopped, session)
      }
      const rec = { key, root, runner, layer }
      this._anims.push(rec)
      return this._animHandle(rec)
    }
    if (!clip) throw new Error(`No existe la animación «${clipName}»` + (root.obj?.modelId ? ` (ni en el modelo: ${this.modelAnimationNames(target, eventId).join(', ') || 'sin animaciones'})` : ''))
    for (const a of this._anims.filter((x) => x.key === key && x.runner.clip.id === clip.id)) a.runner.stop()
    const runner = new AnimRunner(clip, this._animHost(root, clip.name), { loop: opts.loop, speed: opts.speed, fade: opts.fade, from: opts.from, additive: opts.additive })
    const rec = { key, root, runner }
    this._anims.push(rec)
    return this._animHandle(rec)
  },
  _animHandle(rec) {
    const r = rec.runner, self = this
    return {
      get clip() { return r.clip.name }, get time() { return r.time }, get duration() { return r.clip.duration },
      get speed() { return r.speed }, set speed(v) { r.speed = Math.max(0.01, +v || 1) },
      get loop() { return r.loop }, set loop(v) { r.loop = !!v },
      get playing() { return r.playing }, get paused() { return r.paused }, get finished() { return r.finished },
      get layer() { return rec.layer || '' },
      /** Peso de mezcla 0–1 (solo animaciones de modelo): sirve para fundir una capa con otra. */
      get weight() { return r.weight ?? 1 }, set weight(v) { if ('weight' in r) r.weight = v },
      pause: () => r.pause(), resume: () => r.resume(), seek: (t) => r.seek(t),
      /** stop(true) deja el nodo como estaba al empezar. */
      stop: (reset = false) => { if (reset) self._animRestore(rec); r.stop(); if (reset && r.clip.model) resetPose(r.root) },
      done: r.done,
    }
  },
  _animRestore(rec) { for (const tr of rec.runner.clip.tracks) { const b = rec.runner.base.get(tr.id); if (b !== undefined) rec.runner.host.apply(tr, b) } },

  animationStop(target, clipName, { reset = false, layer } = {}, eventId) {
    let root = null
    if (target !== undefined && target !== null && target !== '' || eventId) root = this._animRoot(target, eventId)
    const key = root && this._animRootKey(root)
    let clip = clipName ? findClip(this.project.animations, clipName) : null
    if (clipName && !clip && root) { const mc = this._modelClip(root, clipName); if (mc) clip = { id: `model:${mc.modelId}:${mc.desc.name}` } }
    if (clipName && !clip) throw new Error(`No existe la animación «${clipName}»`)
    let n = 0
    for (const a of [...this._anims]) {
      if ((key && a.key !== key) || (clip && a.runner.clip.id !== clip.id) || (layer !== undefined && (a.layer || '') !== String(layer))) continue
      if (reset) { this._animRestore(a); if (a.runner.clip.model) resetPose(a.runner.root) }
      a.runner.stop(); n++
    }
    return n
  },
  animationList(target, eventId) {
    const key = target === undefined && !eventId ? null : this._animRootKey(this._animRoot(target, eventId))
    return this._anims.filter((a) => !key || a.key === key).map((a) => this._animHandle(a))
  },
  animationPlaying(target, clipName, eventId) {
    const root = this._animRoot(target, eventId), key = this._animRootKey(root)
    let clip = clipName ? findClip(this.project.animations, clipName) : null
    if (clipName && !clip) { const mc = this._modelClip(root, clipName); if (mc) clip = { id: `model:${mc.modelId}:${mc.desc.name}` } }
    return this._anims.some((a) => a.key === key && (!clip || a.runner.clip.id === clip.id) && !a.runner.finished)
  },
  _animTick(dt) { for (const m of this._mixers.values()) m.mixer.update(dt); for (const a of [...this._anims]) a.runner.update(dt) },

  /** Métodos que cuelgan de un nodo (game.node("x")) o de un slot (viewModel.slot("x")). */
  _animMethodsFor(target) {
    const self = this
    return {
      playAnimation: (clip, opts = {}) => self.animationPlay(target, clip, opts),
      stopAnimation: (clip, opts = {}) => { self.animationStop(target, clip, opts) },
      pauseAnimation: (clip) => { for (const h of self.animationList(target)) if (!clip || h.clip.toLowerCase() === String(clip).toLowerCase()) h.pause() },
      resumeAnimation: (clip) => { for (const h of self.animationList(target)) if (!clip || h.clip.toLowerCase() === String(clip).toLowerCase()) h.resume() },
      isAnimating: (clip) => self.animationPlaying(target, clip),
      get animations() { return self.animationList(target) },
    }
  },

  /** game.animation */
  _animApi() {
    const self = this
    return {
      /** game.animation.play(nodo, "Beber", { loop, speed, fade, from, additive }) → manejador */
      play: (node, clip, opts = {}) => self.animationPlay(node, clip, opts, self.main?.ctx?.eventId),
      stop: (node, clip, opts = {}) => self.animationStop(node, clip, opts, self.main?.ctx?.eventId),
      isPlaying: (node, clip) => self.animationPlaying(node, clip, self.main?.ctx?.eventId),
      active: (node) => self.animationList(node, self.main?.ctx?.eventId),
      /** Nombres de todos los clips del proyecto. */
      list: () => (this.project.animations || []).map((c) => c.name),
      /** Animaciones embebidas en el modelo de un nodo (huesos de un .glb): ["Walk", "Idle"…]. */
      modelClips: (node) => self.modelAnimationNames(node, self.main?.ctx?.eventId),
      stopAll: () => { for (const a of [...self._anims]) a.runner.stop() },
      has: (clip) => !!findClip(this.project.animations, clip),
      duration: (clip) => findClip(this.project.animations, clip)?.duration ?? 0,
    }
  },
}
void PROPS
