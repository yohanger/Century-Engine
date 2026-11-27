// Animaciones embebidas en modelos (.glb/.gltf): huesos, skinning y morph targets. Se reproducen con un AnimationMixer de three por nodo,
// pero se ven desde fuera igual que los clips por claves (mismo manejador: done, stop(), pause(), seek()…).
import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'

/** Copia de un modelo conservando esqueletos (scene.clone(true) rompe los SkinnedMesh). */
export const cloneModel = (scene) => cloneSkinned(scene)

/** Clips de un gltf → descriptores serializables { name, duration } (únicos por nombre). */
export function describeClips(clips = []) {
  const seen = new Set(), out = []
  for (const c of clips) {
    let name = c.name || 'Clip', n = 2
    while (seen.has(name.toLowerCase())) name = `${c.name || 'Clip'} ${n++}`
    seen.add(name.toLowerCase()); out.push({ name, duration: +c.duration.toFixed(3) })
  }
  return out
}
/** Busca el clip de three por nombre (los nombres repetidos se numeran igual que en describeClips). */
export function findModelClip(clips = [], name) {
  const q = String(name ?? '').trim().toLowerCase()
  const d = describeClips(clips)
  const i = d.findIndex((c) => c.name.toLowerCase() === q)
  return i < 0 ? null : { clip: clips[i], desc: d[i] }
}

/** 'Spine, Arm' | ['Spine','Arm'] → ['spine','arm'] */
export const maskList = (m) => (Array.isArray(m) ? m : String(m ?? '').split(',')).map((x) => String(x).trim().toLowerCase()).filter(Boolean)
/** Copia del clip con solo las pistas de los huesos/nodos cuyo nombre contiene alguno de los textos de la máscara. */
export function maskClip(clip, mask) {
  const c = clip.clone()
  c.tracks = c.tracks.filter((t) => { const node = t.name.slice(0, Math.max(t.name.lastIndexOf('.'), 0) || t.name.length).toLowerCase(); return mask.some((m) => node.includes(m)) })
  return c
}

export class ModelRunner {
  /** opts: { loop, speed, fade, from, weight (0–1), mask: ['hueso', …] }  mask = solo las pistas cuyo hueso/nodo contiene alguno de estos textos (capa de medio cuerpo). */
  constructor(mixer, root, found, modelId, opts = {}) {
    const { clip, desc } = found
    this.mixer = mixer; this.root = root
    this.clip = { id: `model:${modelId}:${desc.name}`, name: desc.name, duration: desc.duration, tracks: [], events: [], model: true }
    this.base = new Map()
    this.host = { end: null }
    this.paused = false; this.finished = false; this.stopped = false
    this.done = new Promise((r) => { this._res = r })
    const mask = maskList(opts.mask)
    this.used = mask.length ? maskClip(clip, mask) : clip // el recortado es una copia: se libera al terminar
    this.masked = mask.length > 0
    const a = this.action = mixer.clipAction(this.used, root)
    a.reset()
    a.setLoop(opts.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity)
    a.clampWhenFinished = true
    a.timeScale = Math.max(0.01, +opts.speed || 1)
    a.time = Math.max(0, +opts.from || 0)
    const fade = Math.max(0, +opts.fade || 0)
    const w = opts.weight === undefined || opts.weight === null || opts.weight === '' ? 1 : Math.min(1, Math.max(0, +opts.weight))
    if (w < 1) a.setEffectiveWeight(w)
    else if (fade > 0) a.fadeIn(fade)
    a.play()
    this._onFin = (e) => { if (e.action === a) this.finish(false) }
    mixer.addEventListener('finished', this._onFin)
  }
  get weight() { return this.action.getEffectiveWeight() }
  set weight(v) { this.action.enabled = true; this.action.setEffectiveWeight(Math.min(1, Math.max(0, +v || 0))) }
  get time() { return this.action.time }
  get duration() { return this.clip.duration }
  get speed() { return this.action.timeScale }
  set speed(v) { this.action.timeScale = Math.max(0.01, +v || 1) }
  get loop() { return this.action.loop === THREE.LoopRepeat }
  set loop(v) { this.action.setLoop(v ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); if (v) { this.action.clampWhenFinished = false } }
  get playing() { return !this.finished && !this.paused }
  get progress() { return this.clip.duration > 0 ? this.action.time / this.clip.duration : 1 }
  update() { return !this.finished }
  seek(t) { this.action.time = Math.min(this.clip.duration, Math.max(0, +t || 0)); this.mixer.update(0) }
  pause() { this.paused = true; this.action.paused = true }
  resume() { this.paused = false; this.action.paused = false }
  /** fade > 0: se funde hasta desaparecer en vez de cortarse. */
  stop(fade = 0) { if (this.finished) return; if (fade > 0) this.action.fadeOut(fade); else this.action.stop(); this.finish(true) }
  finish(stopped) {
    if (this.finished) return
    this.finished = true; this.stopped = stopped
    this.mixer.removeEventListener('finished', this._onFin)
    this._res({ stopped, clip: this.clip.name }); this.host.end?.(this, stopped)
    this._free()
  }
  _free() { if (this.masked) setTimeout(() => { try { this.mixer.uncacheClip(this.used) } catch { /* ya liberado */ } }, 2000) }
  dispose() { this.finished = true; this.mixer.removeEventListener('finished', this._onFin); this.action.stop(); this._res({ stopped: true, clip: this.clip.name }); if (this.masked) { try { this.mixer.uncacheClip(this.used) } catch { /* nada */ } } }
}
/** Deja el esqueleto en su pose de reposo (para stop(true)). */
export function resetPose(root) { root?.traverse?.((o) => { if (o.isSkinnedMesh) o.skeleton.pose() }) }
