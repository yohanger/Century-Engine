// Vista previa en el editor de un clip embebido en un modelo (.glb): un AnimationMixer sobre el modelo del nodo, con cabezal manual.
import * as THREE from 'three'
import { findModelClip, resetPose } from '../../engine/runtime/anim/modelclips.js'

export class ModelPreview {
  constructor() { this.mixer = null; this.action = null; this.root = null; this.duration = 0; this.time = 0; this.name = ''; this.objId = null; this.playing = false; this.loop = true }
  get active() { return !!this.action }
  /** Prepara el clip `name` del modelo `modelId` sobre el nodo `objId`. Devuelve false si no se puede. */
  start(ed, objId, modelId, name) {
    this.stop()
    const root = ed.nodes.get(objId)?.userData?.modelRoot
    const found = findModelClip(ed.modelClips?.get(modelId), name)
    if (!root || !found) return false
    this.root = root; this.mixer = new THREE.AnimationMixer(root)
    this.action = this.mixer.clipAction(found.clip); this.action.play()
    this.duration = found.desc.duration; this.name = found.desc.name; this.objId = objId; this.time = 0; this.playing = false
    this.seek(0)
    return true
  }
  seek(t) {
    if (!this.action) return
    this.time = Math.min(this.duration, Math.max(0, +t || 0))
    this.action.time = this.time; this.mixer.update(0)
  }
  /** Avanza dt segundos si está reproduciendo; devuelve true si cambió la pose. */
  tick(dt) {
    if (!this.action || !this.playing) return false
    let t = this.time + dt
    if (t >= this.duration) { if (this.loop && this.duration > 0) t %= this.duration; else { t = this.duration; this.playing = false } }
    this.seek(t)
    return true
  }
  stop() {
    if (this.mixer) { this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.root) }
    if (this.root) resetPose(this.root)
    this.mixer = this.action = this.root = null; this.playing = false; this.time = 0; this.objId = null
  }
}
