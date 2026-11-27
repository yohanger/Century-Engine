import { sampleTrack } from '../anim/eval.js'
import { findClip } from '../anim/model.js'
// Camera Shake Base: muestreo determinista sin tocar la cámara persistida ni el cuerpo físico.
const clamp = (value, min, max, fallback) => {
  const v = Number(value)
  return Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback
}

export function shakeConfig(props = {}) {
  const vec = (value, limit) => [0, 1, 2].map((i) => clamp(value?.[i], -limit, limit, 0))
  return {
    camera: typeof props.camera === 'string' ? props.camera : '',
    pattern: ['sine', 'noise', 'clip'].includes(props.pattern) ? props.pattern : 'sine',
    clip: typeof props.clip === 'string' ? props.clip : '',
    enabled: props.enabled !== false,
    autoPlay: props.autoPlay !== false,
    loop: props.loop !== false,
    position: vec(props.position, 1),
    rotation: vec(props.rotation, 15), // Inspector: grados, composición: radianes
    frequency: clamp(props.frequency, 0.05, 10, 0.65),
    duration: clamp(props.duration, 0, 30, 0), // 0: ciclo de frecuencia; útil para impactos breves
    positionFrequency: [0, 1, 2].map((i) => clamp(props.positionFrequency?.[i], 0, 4, 1)),
    rotationFrequency: [0, 1, 2].map((i) => clamp(props.rotationFrequency?.[i], 0, 4, 1)),
    positionPhase: [0, 1, 2].map((i) => clamp(props.positionPhase?.[i], -360, 360, 0)),
    rotationPhase: [0, 1, 2].map((i) => clamp(props.rotationPhase?.[i], -360, 360, 0)),
    blendIn: clamp(props.blendIn, 0, 10, 0),
    blendOut: clamp(props.blendOut, 0, 10, 0),
  }
}

// Ruido por puntos de control interpolados. Es estable y continuo entre fotogramas.
const noiseValue = (point, channel) => {
  let x = (Math.imul(point, 374761393) + Math.imul(channel + 1, 668265263)) | 0
  x = Math.imul(x ^ (x >>> 13), 1274126177)
  return ((x ^ (x >>> 16)) >>> 0) / 2147483647.5 - 1
}
const smoothNoise = (t, channel) => {
  const n = Math.floor(t), u = t - n
  const w = u * u * (3 - 2 * u)
  return noiseValue(n, channel) * (1 - w) + noiseValue(n + 1, channel) * w
}

// Las pistas raíz del clip definen offsets, nunca posiciones absolutas del jugador.
function clipOffset(clip, time) {
  const out = { position: [0, 0, 0], rotation: [0, 0, 0] }
  let found = false
  for (const prop of ['position', 'rotation']) {
    const track = clip.tracks?.find((tr) => !tr.path && tr.prop === prop && Array.isArray(tr.keys) && tr.keys.length)
    if (!track) continue
    const value = sampleTrack(track, time)
    if (!Array.isArray(value) || value.length !== 3 || value.some((v) => !Number.isFinite(v))) return null
    const max = prop === 'position' ? 1 : 15
    out[prop] = value.map((v) => Math.max(-max, Math.min(max, v)))
    found = true
  }
  return found ? out : null
}

/** Offset local en el tiempo indicado; el clip se lee del proyecto, sin emitir sus eventos. */
export function sampleShake(props, seconds, animations = [], manual = false) {
  const p = shakeConfig(props)
  if (!p.enabled || (!p.autoPlay && !manual)) return null
  const t = Math.max(0, Number.isFinite(seconds) ? seconds : 0)
  const clip = p.pattern === 'clip' ? findClip(animations, p.clip) : null
  if (p.pattern === 'clip' && (!clip || !(clip.duration > 0) || !(clip.speed > 0))) return null
  const duration = clip ? clip.duration / clip.speed : (p.duration || 1 / p.frequency)
  if (!p.loop && t >= duration) return null
  const fadeIn = p.blendIn > 0 ? Math.min(1, t / p.blendIn) : 1
  const fadeOut = !p.loop && p.blendOut > 0 ? Math.min(1, Math.max(0, duration - t) / p.blendOut) : 1
  const weight = Math.min(fadeIn, fadeOut)
  if (clip) {
    const clipTime = p.loop ? (t * clip.speed) % clip.duration : Math.min(clip.duration, t * clip.speed)
    let offset = clipOffset(clip, clipTime)
    if (!offset) return null
    if (p.loop) {
      // Si el autor no cerró las claves, suaviza únicamente la unión del bucle.
      const seam = Math.min(0.1, clip.duration / 4)
      if (clipTime > clip.duration - seam) {
        const first = clipOffset(clip, 0)
        if (!first) return null
        const blend = (clipTime - (clip.duration - seam)) / seam
        const w = blend * blend * (3 - 2 * blend)
        offset = {
          position: offset.position.map((v, i) => v + (first.position[i] - v) * w),
          rotation: offset.rotation.map((v, i) => v + (first.rotation[i] - v) * w),
        }
      }
    }
    return {
      position: offset.position.map((v) => v * weight),
      rotation: offset.rotation.map((v) => v * weight * Math.PI / 180),
    }
  }
  const phases = [0, 1, 2, 3, 4, 5].map((channel) => {
    const i = channel % 3
    const multiplier = channel < 3 ? p.positionFrequency[i] : p.rotationFrequency[i]
    const phase = (channel < 3 ? p.positionPhase[i] : p.rotationPhase[i]) / 360
    const cycle = t * p.frequency * multiplier + phase
    return p.pattern === 'noise' ? smoothNoise(cycle, channel) : Math.sin(2 * Math.PI * cycle)
  })
  return {
    position: p.position.map((v, i) => v * phases[i] * weight),
    rotation: p.rotation.map((v, i) => v * phases[i + 3] * weight * Math.PI / 180),
  }
}

// Un solo lector para API, AutoPlay y movimiento del Player. Los cambios temporales
// provienen del descriptor Camera Shake y viven únicamente en el nodo renderizado.
export function shakeRuntimeProps(play, node) {
  const overrides = play.ed?.nodes?.get(node.id)?.userData?.timelineShake
  return overrides ? { ...(node.props || {}), ...overrides } : node.props || {}
}

export const cameraShakeMethods = {
  _shakeNode(ref) {
    if (ref == null) return null
    const key = typeof ref === 'object' ? ref.id ?? ref.name : ref
    const node = this._find?.(key, 'cameraShake')
    return node?.type === 'cameraShake' ? node : null
  },
  /** La misma tabla guarda el reloj antiguo de AutoPlay y el control manual cuando hace falta. */
  _shakePlay(ref, opts = {}) {
    const node = this._shakeNode(ref)
    if (!node || !this._nodeEnabled(node)) return false
    const config = shakeConfig(shakeRuntimeProps(this, node))
    if (!config.enabled || !sampleShake(config, 0, this.project.animations, true)) return false
    const clocks = this._shakeClocks ??= new Map()
    const old = clocks.get(node.id)
    const intensity = opts && Object.hasOwn(opts, 'intensity') ? opts.intensity : typeof old === 'object' ? old.intensity : 1
    clocks.set(node.id, { t: 0, intensity: clamp(intensity, 0, 1, 1), running: true, fading: false, fadeTime: 0 })
    return true
  },
  _shakeStop(ref) {
    const node = this._shakeNode(ref)
    if (!node) return false
    const clocks = this._shakeClocks ??= new Map()
    const old = clocks.get(node.id)
    const config = shakeConfig(shakeRuntimeProps(this, node))
    const running = typeof old === 'object' ? old.running : config.autoPlay && config.enabled
    if (!running) return false
    const t = typeof old === 'number' ? old : old?.t ?? 0
    const intensity = typeof old === 'object' ? old.intensity : 1
    clocks.set(node.id, { t, intensity, running: false, fading: config.blendOut > 0, fadeTime: 0 })
    return true
  },
  _shakeSetIntensity(ref, value) {
    const node = this._shakeNode(ref)
    if (!node || !Number.isFinite(Number(value))) return false
    const clocks = this._shakeClocks ??= new Map()
    const old = clocks.get(node.id)
    const config = shakeConfig(shakeRuntimeProps(this, node))
    clocks.set(node.id, {
      t: typeof old === 'number' ? old : old?.t ?? 0,
      intensity: clamp(value, 0, 1, 1),
      running: typeof old === 'object' ? old.running : config.autoPlay && config.enabled,
      fading: typeof old === 'object' && old.fading === true,
      fadeTime: typeof old === 'object' ? old.fadeTime : 0,
    })
    return true
  },
  _shakeIsPlaying(ref) {
    const node = this._shakeNode(ref)
    if (!node || !this._nodeEnabled(node)) return false
    const config = shakeConfig(shakeRuntimeProps(this, node))
    if (!config.enabled) return false
    const old = this._shakeClocks?.get(node.id)
    if (typeof old === 'object' && !old.running) return false
    if (!config.autoPlay && typeof old !== 'object') return false
    const t = typeof old === 'number' ? old : old?.t ?? 0
    return !!sampleShake(config, t, this.project.animations, true)
  },
  _shakeApi() {
    const self = this
    return {
      play: (node, opts) => self._shakePlay(node, opts),
      stop: (node) => self._shakeStop(node),
      setIntensity: (node, intensity) => self._shakeSetIntensity(node, intensity),
      isPlaying: (node) => self._shakeIsPlaying(node),
    }
  },
  /** Recupera la pose base antes de que entrada, audio o raycasts usen la cámara en el fotograma siguiente. */
  _shakeRestore(cam) {
    if (!this._shakeBase) return
    cam.position.copy(this._shakeBase.position)
    cam.quaternion.copy(this._shakeBase.quaternion)
    this._shakeBase = null
  },
  /** Tras Timeline/Film Maker, aplica solo los efectos destinados a la cámara activa. */
  _shakeFrame(cam, dt, stepping = false) {
    if (!this._cameraActive || ['film', 'timeline', 'pose'].includes(this._cameraActive.kind)) return
    const main = this._mainCameraNode()
    const target = this._cameraActive?.kind === 'camera3d' ? this._cameraActive.id : main?.node ? main.obj.id : this.hasPlayer ? 'player' : ''
    if (!target) return
    const offset = [0, 0, 0], angles = [0, 0, 0]
    const clocks = this._shakeClocks ??= new Map()
    const advancing = (!this.paused && !!this.state.focus) || stepping
    const motion = target === 'player' && this.hasPlayer && this.player?.cameraMotionSamples?.() || []
    const motionCfg = this.hasPlayer && target === 'player' ? this.game?.db?.player : null
    const motionRefs = new Set(motionCfg?.cameraMotionEnabled
      ? ['Walk', 'Run', 'Jump', 'Fall', 'Land'].map((kind) => motionCfg[`cameraMotion${kind}`]).filter(Boolean)
      : [])
    for (const node of this.project.objects) {
      if (node.type !== 'cameraShake' || !this._nodeEnabled(node)) continue
      const p = shakeConfig(shakeRuntimeProps(this, node))
      if (p.camera !== target || !p.enabled) continue
      const old = clocks.get(node.id)
      const controlled = typeof old === 'object'
      if (!p.autoPlay && !controlled) continue
      // Una receta asignada a locomoción no se ejecuta también por AutoPlay.
      if (!controlled && motionRefs.has(node.id)) continue
      if (controlled && !old.running && !old.fading) continue
      const t = controlled ? old.t : old ?? 0
      const sample = sampleShake(p, t, this.project.animations, controlled)
      if (!sample) {
        // Un clip ausente conserva su reloj; un efecto terminado no vuelve a empezar.
        if (controlled && old.running && t > 0 && p.pattern !== 'clip') old.running = false
        continue
      }
      const gain = controlled ? old.intensity * (old.fading && p.blendOut > 0
        ? Math.max(0, 1 - old.fadeTime / p.blendOut) : 1) : 1
      for (let i = 0; i < 3; i++) {
        offset[i] += sample.position[i] * gain
        angles[i] += sample.rotation[i] * gain
      }
      if (advancing) {
        const delta = Math.max(0, Math.min(0.05, dt))
        if (controlled) {
          old.t += delta
          if (old.fading) {
            old.fadeTime += delta
            if (old.fadeTime >= p.blendOut) old.fading = false
          }
          // Los efectos no repetidos terminan aunque su último fotograma tenga offset cero.
          if (old.running && !p.loop && !sampleShake(p, old.t, this.project.animations, true)) old.running = false
        } else clocks.set(node.id, t + delta)
      }
    }
    // El jugador solo decide cuándo y con qué ganancia: toda la forma procede de Camera Shake Base.
    for (const m of motion) {
      if (!(m.gain > 0)) continue
      const node = this.project.objects.find((o) => o.id === m.nodeId && o.type === 'cameraShake')
      if (!node || !this._nodeEnabled(node)) continue
      const p = shakeConfig(shakeRuntimeProps(this, node))
      if (!p.enabled || p.camera !== 'player') continue
      const sample = sampleShake({ ...p, autoPlay: true, loop: m.loop }, m.t, this.project.animations, true)
      if (!sample) continue
      for (let i = 0; i < 3; i++) {
        offset[i] += sample.position[i] * m.gain
        angles[i] += sample.rotation[i] * m.gain
      }
    }
    if (!offset.some((v) => v !== 0) && !angles.some((v) => v !== 0)) return
    if (cam.position?.clone && cam.quaternion?.clone) {
      this._shakeBase = { position: cam.position.clone(), quaternion: cam.quaternion.clone() }
    }
    // El desplazamiento se suma a la pose base del fotograma, nunca al nodo de cámara.
    cam.translateX(offset[0]); cam.translateY(offset[1]); cam.translateZ(offset[2])
    cam.rotateX(angles[0]); cam.rotateY(angles[1]); cam.rotateZ(angles[2])
  },
}
