import { nodeEffectiveActive } from '../nodes/hierarchy.js'
// Audio en el modo Jugar: crea las voces de los nodos AudioSource, mantiene el oyente y expone la API de scripts (game.audio).
import * as THREE from 'three'
import { getAudio } from './engine.js'
import { audioHost, hasAudio, audible } from './host.js'
import { AUDIO_EXT, resolveAudioClip, normalizeSource, normalizeAudio, gainToDb, newFx, FX_TYPES } from './config.js'

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _f = new THREE.Vector3(), _u = new THREE.Vector3()

export class AudioScene {
  /** @param {{ scene, host }} deps  scene = SceneGraph (nodos)  host = { project, assetData, storage } */
  constructor({ scene, host, cast = null, onFinished = null }) {
    this.ed = scene; this.host = host
    this.engine = getAudio()
    this.engine.setLoader?.(host.assetData, host.audioAssetSource)
    this.sources = new Map() // id de objeto → { obj, voice, pending }
    this.on = false
    this.saved = {}
    this.cast = cast // consulta de sólidos del modo Jugar: Jolt o Three.js; no hay otro mundo físico.
    this.onFinished = onFinished // adaptador al registro de señales nativas; sin bus adicional.
    this._occTokens = 4
    this._occAt = null
    this._occCursor = 0
    this._occNext = new WeakMap()
  }

  get project() { return this.host.project }

  /** Configuración efectiva de la fuente; Timeline no escribe en props del nodo. */
  _sourceConfig(obj) {
    const overrides = this.ed.nodes.get(obj.id)?.userData.timelineAudio
    return normalizeSource({ ...audioHost(obj), ...(overrides || {}) })
  }

  /** Id de un clip a partir de un id o de un nombre (con o sin extensión). */
  resolveClip(x) {
    return resolveAudioClip(this.project, x)
  }

  async start({ deferSources = false } = {}) {
    const e = this.engine, p = this.project
    await e.ensure()
    e.clearOverrides()
    e.configure(p.audio)
    this.on = true
    // volúmenes que el jugador guardó en otra sesión
    if (p.audio?.remember !== false) {
      try {
        const sv = JSON.parse(this.host.storage.get('audio') || '{}')
        for (const [g, v] of Object.entries(sv)) this._setVol(g, v, false)
      } catch { /* sin almacenamiento */ }
    }
    const st = p.audio.snapshots.find((x) => x.id === p.audio.startSnapshot)
    if (st) this._snapshot(st.id, 0)
    if (!deferSources) this.resetSources()
  }

  /** (Re)crea las voces de los nodos AudioSource de la escena actual (al empezar y al cambiar de escena). */
  resetSources({ keep = new Set() } = {}) {
    // Una voz de un objeto persistente no se reinicia al cruzar de escena.
    const saved = new Map([...this.sources].filter(([id]) => keep.has(id)))
    for (const [id, s] of this.sources) if (!saved.has(id)) { s.token++; s.voice?.stop() }
    this.sources.clear()
    this._occNext = new WeakMap()
    for (const obj of this.project.objects) if (audible(obj)) {
      if (saved.has(obj.id)) {
        const src = saved.get(obj.id); src.obj = obj; this.sources.set(obj.id, src); continue
      }
      const src = { obj, voice: null, token: 0 }
      this.sources.set(obj.id, src)
      const q = this._sourceConfig(obj)
      if (q.clip && q.playOnStart && nodeEffectiveActive(this.host.project?.objects || [], obj)) this._play(src)
    }
    for (const [id, s] of saved) if (!this.sources.has(id)) { s.token++; s.voice?.stop() }
  }

  get script() { return (this._api ??= this.api()) }

  stop() {
    this.on = false
    for (const s of this.sources.values()) { s.token++; s.voice?.stop() }
    this.sources.clear()
    this._occNext = new WeakMap()
    this._occAt = null
    this._occTokens = 4
    this.engine.stopAll()
    this.engine.clearOverrides()
    this.engine.configure(this.project?.audio) // vuelve a lo que dice el proyecto
  }

  _forward(node) { node.getWorldQuaternion(_q); return _f.set(0, 0, -1).applyQuaternion(_q).toArray() }

  async _play(src, offset = 0) {
    if (src.disabled) return null
    const emitterObj = src.obj
    const o = this._sourceConfig(emitterObj), id = this.resolveClip(o.clip)
    if (!id) return null
    const node = this.ed.nodes.get(src.obj.id)
    const token = ++src.token
    src.voice?.stop(); src.voice = null
    const opts = { ...o, offset }
    src.liveSourceKey = JSON.stringify([o.clip, o.group, o.mode])
    if (node && o.mode === '3d') { node.getWorldPosition(_p); opts.position = _p.toArray(); opts.forward = this._forward(node) }
    const v = await this.engine.play(id, opts)
    if (!v) return null
    if (token !== src.token || src.obj !== emitterObj || !this.on || src.disabled) { v.stop(); return null }
    src.voice = v
    if (node) v.occlusionOwner = node
    // Voice.done se resuelve también con stop(): solo la causa natural autoriza finished.
    // Token, voz, mapa e identidad impiden emitir desde reproducciones reemplazadas.
    v.done.then(() => {
      if (v.finishedNaturally && this.on && src.token === token && src.voice === v &&
          this.sources.get(emitterObj.id) === src && src.obj === emitterObj && this.project.objects.includes(emitterObj)) {
        try { this.onFinished?.(emitterObj) } catch (error) { console.error('Audio finished', error) }
      }
    })
    return v
  }

  /** Un nodo invisible sigue sonando; un nodo inactivo suspende solo su fuente de audio. */
  setNodeEnabled(id, enabled) {
    const src = this.sources.get(id)
    if (!src || src.disabled === !enabled) return
    src.disabled = !enabled
    if (!enabled) {
      if (src.voice?.isPlaying) {
        src.pausedByNode = true
        src.voice.pause()
      } else if (!src.voice) {
        src.pausedByNode = true
        src.token++ // invalida una carga asíncrona iniciada antes de desactivar
      }
    } else if (src.pausedByNode) {
      src.pausedByNode = false
      if (src.voice) src.voice.resume()
      else if (this._sourceConfig(src.obj).playOnStart) void this._play(src)
    }
  }

  /** Hasta 40 consultas por segundo (ráfagas de 4), con mínimo 200 ms entre consultas por voz. */
  _updateOcclusion(listener) {
    if (!this.cast) return
    const now = performance.now()
    if (this._occAt === null) this._occAt = now
    this._occTokens = Math.min(4, this._occTokens + Math.max(0, now - this._occAt) * 0.04)
    this._occAt = now
    if (this._occTokens < 1) return
    const voices = [...this.engine.voices].filter((v) => v.occlusionFilter && v.isPlaying && v.opts.position)
    if (!voices.length) return
    const n = voices.length, from = this._occCursor % n
    for (let k = 0; k < n && this._occTokens >= 1; k++) {
      const i = (from + k) % n, v = voices[i]
      if (now < (this._occNext.get(v) ?? -Infinity)) continue
      this._occNext.set(v, now + 200)
      this._occCursor = i + 1
      const pos = v.opts.position, dx = pos[0] - listener[0], dy = pos[1] - listener[1], dz = pos[2] - listener[2]
      const length = Math.hypot(dx, dy, dz)
      if (length < 0.1) { v.setOcclusion(false); continue }
      // Evita que el propio extremo emisor cuente como pared.
      this._occTokens--
      const owner = v.occlusionOwner || null
      const blocked = this.cast(listener, [dx / length, dy / length, dz / length], length - 0.06, owner)
      v.setOcclusion(!!blocked)
    }
  }

  /** Cada frame: oyente = cámara; las fuentes 3D siguen a su nodo. */
  update(camera) {
    if (!this.on || !this.engine.ctx) return
    camera.getWorldPosition(_p); camera.getWorldQuaternion(_q)
    _f.set(0, 0, -1).applyQuaternion(_q); _u.set(0, 1, 0).applyQuaternion(_q)
    this.engine.setListener(_p.toArray(), _f.toArray(), _u.toArray())
    for (const s of this.sources.values()) {
      const v = s.voice
      const config = this._sourceConfig(s.obj)
      const key = JSON.stringify([config.clip,config.group,config.mode])
      if (!s.liveSourceKey) s.liveSourceKey=key // Una fuente no iniciada nunca se reproduce por inspección.
      // Cambiar referencia, bus o modo requiere la vía habitual de AudioScene,
      // que invalida la carga anterior y conserva los tokens de concurrencia.
      if (key !== s.liveSourceKey && !s.pendingLiveChange) {
        s.pendingLiveChange = true
        Promise.resolve().then(async () => {
          try {
            if (config.clip) await this._play(s)
            else { s.token++;s.voice?.stop();s.voice=null;s.liveSourceKey=key }
          } finally { s.pendingLiveChange=false }
        })
      }
      if (!v) continue
      if (v.volume !== config.volume) v.setVolume(config.volume)
      if (v.pitch !== config.pitch) v.setPitch(config.pitch)
      if (v.mute !== config.mute) v.setMute(config.mute)
      if (v.loop !== config.loop) v.setLoop(config.loop)
      const panner = v.panner
      if (panner) {
        panner.distanceModel = config.rolloff === 'linear' ? 'linear' : 'inverse'
        panner.refDistance = config.minDistance; panner.maxDistance=config.maxDistance
        panner.coneInnerAngle=config.coneInner; panner.coneOuterAngle=config.coneOuter
        panner.coneOuterGain=config.coneOuterGain
        panner.panningModel=config.hrtf ? 'HRTF' : 'equalpower'
      }
      if (!panner) continue
      const node = this.ed.nodes.get(s.obj.id); if (!node) continue
      node.getWorldPosition(_p)
      v.setPosition(_p.toArray(), this._forward(node))
      v.opts.position = _p.toArray()
      v.occlusionOwner = node
    }
    for (const v of this.engine.voices) if (v.follow) { v.follow.getWorldPosition(_p); v.setPosition(_p.toArray()); v.opts.position = _p.toArray(); v.occlusionOwner = v.follow }
    this._updateOcclusion(camera.getWorldPosition(_p).toArray())
  }

  _setVol(group, lin, save = true) {
    const g = this.engine.cfg.groups.find((x) => x.id === group || x.name.toLowerCase() === String(group).toLowerCase())
    if (!g) throw new Error(`No existe el grupo de audio «${group}»`)
    this.engine.setOverride(g.id, { volume: Math.max(-80, Math.min(20, g.volume + gainToDb(Math.max(0, lin)))) })
    this.saved[g.id] = lin
    if (save && this.project.audio?.remember !== false) { try { this.host.storage.set('audio', JSON.stringify(this.saved)) } catch { /* nada */ } }
    return g
  }
  _group(group) {
    const g = this.engine.cfg.groups.find((x) => x.id === group || x.name.toLowerCase() === String(group).toLowerCase())
    if (!g) throw new Error(`No existe el grupo de audio «${group}»`)
    return g
  }


  /** Transición a un snapshot: volumen interpolado en dB; parámetros numéricos de efectos interpolados; on/off al empezar (encender) o al acabar (apagar). */
  _snapshot(name, seconds = 1) {
    const sn = this.project.audio.snapshots.find((s) => s.id === name || s.name.toLowerCase() === String(name).toLowerCase())
    if (!sn) throw new Error(`No existe el snapshot «${name}»`)
    const e = this.engine, t0 = performance.now(), steps = []
    for (const g of e.cfg.groups) {
      const t = sn.groups[g.id]; if (!t) continue
      const cur = e.eff(g)
      steps.push({ g, from: cur.volume, to: t.volume, fxs: Object.values(t.fx || {}).filter((f) => g.fx.some((x) => x.id === f.id)).map((f) => ({ f, from: { ...cur.fx.find((x) => x.id === f.id) } })), mute: t.mute })
    }
    for (const s of steps) { e.setOverride(s.g.id, { mute: s.mute }); for (const x of s.fxs) if (x.f.on) e.setOverride(s.g.id, { fx: { [x.f.id]: { on: true } } }) }
    return new Promise((resolve) => {
      const tick = () => {
        const k = seconds > 0 ? Math.min(1, (performance.now() - t0) / (seconds * 1000)) : 1
        for (const s of steps) {
          const patch = { volume: s.from + (s.to - s.from) * k, fx: {} }
          for (const x of s.fxs) {
            const p = {}
            for (const [key, v] of Object.entries(x.f)) if (typeof v === 'number' && typeof x.from[key] === 'number') p[key] = x.from[key] + (v - x.from[key]) * k
            if (k >= 1 && !x.f.on) p.on = false
            patch.fx[x.f.id] = p
          }
          e.setOverride(s.g.id, patch)
        }
        if (k < 1 && this.on) requestAnimationFrame(tick); else resolve()
      }
      tick()
    })
  }

  /** API que ven los scripts: game.audio */
  api() {
    const self = this, e = this.engine
    const lazy = (promise) => {
      let voice = null; const ops = []
      const run = (fn) => (voice ? fn(voice) : ops.push(fn))
      promise.then((v) => { voice = v; if (v) for (const f of ops) f(v) })
      return {
        get playing() { return !!voice?.isPlaying },
        stop: (fade = 0) => run((v) => v.stop(fade)), pause: () => run((v) => v.pause()), resume: () => run((v) => v.resume()),
        setVolume: (x) => run((v) => v.setVolume(x)), setPitch: (x) => run((v) => v.setPitch(x)), setPosition: (pos) => run((v) => v.setPosition(pos)),
        done: promise.then((v) => (v ? v.done : undefined)),
      }
    }
    const sourceHandle = (name) => {
      const o = self.project.objects.find((x) => hasAudio(x) && (x.id === name || x.name.toLowerCase() === String(name).toLowerCase()))
      if (!o) return undefined
      const src = self.sources.get(o.id) || (() => { const s = { obj: o, voice: null, token: 0 }; self.sources.set(o.id, s); return s })()
      return {
        name: o.name,
        get playing() { return !!src.voice?.isPlaying },
        play: () => self._play(src).then(() => undefined),
        stop: (fade = 0) => { src.token++; src.voice?.stop(fade); src.voice = null },
        pause: () => src.voice?.pause(), resume: () => src.voice?.resume(),
        get volume() { return src.voice?.volume ?? normalizeSource(audioHost(o)).volume }, set volume(v) { audioHost(o).volume = v; src.voice?.setVolume(v) },
        get pitch() { return src.voice?.pitch ?? normalizeSource(audioHost(o)).pitch }, set pitch(v) { audioHost(o).pitch = v; src.voice?.setPitch(v) },
        get mute() { return !!src.voice?.mute }, set mute(v) { src.voice?.setMute(v) },
        set loop(v) { audioHost(o).loop = !!v; src.voice?.setLoop(v) },
        get done() { return src.voice ? src.voice.done : Promise.resolve() },
      }
    }
    const api = {
      /** game.audio.play("explosion", { group:"sfx", volume:1, pitch:1, loop:false, at:[x,y,z] | node:"Puerta", ui:true }) → manejador */
      play: (clip, opts = {}) => {
        const id = self.resolveClip(clip)
        if (!id) throw new Error(`No existe el clip de audio «${clip}»`)
        const o = { group: opts.group || 'sfx', volume: opts.volume, pitch: opts.pitch, loop: opts.loop, delay: opts.delay, minDistance: opts.minDistance, maxDistance: opts.maxDistance, rolloff: opts.rolloff, occlusion: opts.occlusion === true, fx: opts.fx }
        let follow = null
        if (opts.node) { const obj = self.project.objects.find((x) => x.id === opts.node || x.name.toLowerCase() === String(opts.node).toLowerCase()); follow = obj && self.ed.nodes.get(obj.id) }
        if (opts.at || follow) { o.mode = '3d'; o.position = opts.at || follow.getWorldPosition(new THREE.Vector3()).toArray() } else o.mode = opts.ui === false ? '3d' : 'ui'
        const p = e.play(id, o).then((v) => { if (v && follow) { v.follow = follow; v.occlusionOwner = follow } return v })
        return lazy(p)
      },
      source: sourceHandle,
      stopAll: (group, fade = 0) => e.stopAll(group ? self._group(group).id : null, fade),
      pauseAll: (on = true) => e.pauseAll(on),
      groups: () => e.cfg.groups.map((g) => g.name),
      /** Volumen lineal 0–1 (1 = el del mezclador). Se recuerda entre partidas salvo que se indique save:false. */
      setVolume: (group, v, opts = {}) => { self._setVol(group, +v, opts.save !== false) },
      getVolume: (group) => self.saved[self._group(group).id] ?? 1,
      mute: (group, on = true) => { e.setOverride(self._group(group).id, { mute: !!on }) },
      /** game.audio.fade("music", 0, 2) → Promise */
      fade: (group, to = 0, seconds = 1) => new Promise((resolve) => {
        const g = self._group(group), from = self.saved[g.id] ?? 1, t0 = performance.now()
        const step = () => {
          const k = seconds > 0 ? Math.min(1, (performance.now() - t0) / (seconds * 1000)) : 1
          self._setVol(g.id, from + (to - from) * k, k >= 1)
          if (k < 1 && self.on) requestAnimationFrame(step); else resolve()
        }
        step()
      }),
      /** game.audio.effect("sfx", "lowpass", { freq:800 }) · tipos: eq3, lowpass, highpass, compressor, limiter, reverb, echo, distortion. Activa el efecto del grupo (o lo añade si no existe). */
      effect: (group, name, params = {}) => {
        if (!FX_TYPES[name]) throw new Error(`Efecto desconocido «${name}» (usa: ${Object.keys(FX_TYPES).join(', ')})`)
        const g = self._group(group)
        const fx = g.fx.find((f) => f.type === name) || e.override[g.id]?.extra?.find((f) => f.type === name)
        if (fx) e.setOverride(g.id, { fx: { [fx.id]: { on: true, ...params } } })
        else e.addExtraFx(g.id, newFx(name, params))
      },
      effectOff: (group, name) => {
        const g = self._group(group)
        const ids = [...g.fx, ...(e.override[g.id]?.extra || [])].filter((f) => f.type === name).map((f) => f.id)
        for (const id of ids) e.setOverride(g.id, { fx: { [id]: { on: false } } })
      },
      /** game.audio.snapshot("cueva", 1.5) → Promise: transición de volúmenes y efectos a un snapshot del mezclador. */
      snapshot: (name, seconds = 1) => self._snapshot(name, seconds),
      snapshots: () => self.project.audio.snapshots.map((s) => s.name),
    }
    /** game.audio.ui("clic") → sonido de interfaz (2D) por el grupo «UI» del mezclador: su volumen se controla aparte (game.audio.setVolume("ui", 0.5)). */
    api.ui = (clip, opts = {}) => api.play(clip, { ...opts, group: opts.group || 'ui', ui: true })
    return api
  }
}

export { normalizeAudio }
