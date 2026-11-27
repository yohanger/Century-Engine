// Nether Film Maker · fuentes del cuerpo del actor. Todas entregan fotogramas { t, p } con los 33 puntos de MediaPipe Pose
// (worldLandmarks, en metros) y, si hay imagen, los puntos sobre la imagen (para dibujar el esqueleto encima del vídeo).
//   camera  · la cámara del móvil o la webcam (getUserMedia)
//   video   · un vídeo grabado (por ejemplo con el móvil) que se procesa en el PC
//   sim     · el actor simulado del núcleo de captura (probar sin cámara)
// MediaPipe se carga de /mediapipe/pose/ (archivos locales copiados de node_modules): funciona sin internet.
import { subjectPoints, poseAt, RAW } from '../core/capture/simulate.js'

const flat = (lms) => { const p = new Array(132); for (let i = 0; i < 33; i++) { const l = lms[i] || {}; p[i * 4] = +l.x || 0; p[i * 4 + 1] = +l.y || 0; p[i * 4 + 2] = +l.z || 0; p[i * 4 + 3] = l.visibility ?? 1 } return p }
export const mpBase = () => new URL('mediapipe/pose/', location.href).href

let lib = null
/** Carga pose.js (script clásico de MediaPipe Solutions) una sola vez. */
export function loadPoseLib() {
  if (window.Pose) return Promise.resolve(window.Pose)
  lib ||= new Promise((res, rej) => {
    const s = document.createElement('script')
    s.src = mpBase() + 'pose.js'
    s.onload = () => (window.Pose ? res(window.Pose) : rej(new Error('MediaPipe Pose no se inicializó')))
    s.onerror = () => { lib = null; rej(new Error('No se encontró MediaPipe Pose en ' + mpBase())) }
    document.head.appendChild(s)
  })
  return lib
}

/** Detector de pose sobre imágenes (vídeo, cámara o lienzo). `quality`: 0 rápido · 1 normal · 2 preciso (solo si existe el modelo). */
export class PoseTracker {
  async init({ quality = 1 } = {}) {
    const Pose = await loadPoseLib()
    this.pose = new Pose({ locateFile: (f) => mpBase() + f })
    this.pose.setOptions({ modelComplexity: Math.min(1, quality), smoothLandmarks: true, enableSegmentation: false, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 })
    this.pose.onResults((r) => { this.last = r.poseWorldLandmarks?.length ? { world: flat(r.poseWorldLandmarks), image: r.poseLandmarks ? flat(r.poseLandmarks) : null } : null })
    await this.pose.initialize()
    return this
  }
  /** Procesa una imagen y devuelve { world, image } o null si no ve a nadie. */
  async detect(image) { this.last = null; await this.pose.send({ image }); return this.last }
  close() { try { this.pose?.close() } catch { /* ya cerrado */ } this.pose = null }
}

// ---------- manos (dedos) ----------
let handsLib = null
export const mpHandsBase = () => new URL('mediapipe/hands/', location.href).href
export function loadHandsLib() {
  if (window.Hands) return Promise.resolve(window.Hands)
  handsLib ||= new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = mpHandsBase() + 'hands.js'
    s.onload = () => (window.Hands ? res(window.Hands) : rej(new Error('MediaPipe Hands no se inicializó')))
    s.onerror = () => { handsLib = null; rej(new Error('No se encontró MediaPipe Hands en ' + mpHandsBase())) }
    document.head.appendChild(s)
  })
  return handsLib
}
const FINGER_IDX = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]]
const angle = (a, b, c, d) => { // ángulo entre a→b y c→d
  const u = [b.x - a.x, b.y - a.y, b.z - a.z], v = [d.x - c.x, d.y - c.y, d.z - c.z]
  const lu = Math.hypot(...u) || 1, lv = Math.hypot(...v) || 1
  return Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (lu * lv))))
}
/** 21 puntos de una mano (MediaPipe Hands, en metros) → cierre 0–1 de [pulgar, índice, medio, anular, meñique]. */
export function fingerCurls(lm) {
  return FINGER_IDX.map((ids, f) => {
    const [a, b, c, d] = ids.map((i) => lm[i]), w = lm[0]
    const sum = angle(w, a, a, b) + angle(a, b, b, c) + angle(b, c, c, d)
    const [open, full] = f === 0 ? [0.5, 1.9] : [0.35, 4.2] // radianes: mano abierta → puño
    return Math.round(Math.max(0, Math.min(1, (sum - open) / (full - open))) * 1000) / 1000
  })
}
export class HandTracker {
  async init() {
    const Hands = await loadHandsLib()
    this.h = new Hands({ locateFile: (f) => mpHandsBase() + f })
    this.h.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 })
    this.h.onResults((r) => { this.last = r })
    await this.h.initialize()
    return this
  }
  /** Cierres [izq×5, der×5] (−1 = no se vio). Cada mano se asigna al lado cuya muñeca (de la pose) tiene más cerca en la imagen. */
  async detect(image, poseImage) {
    this.last = null; await this.h.send({ image })
    const r = this.last, c = new Array(10).fill(-1)
    const hands = r?.multiHandWorldLandmarks || [], imgs = r?.multiHandLandmarks || []
    hands.forEach((lm, i) => {
      const wr = imgs[i]?.[0]
      let side = (r.multiHandedness?.[i]?.label === 'Left') ? 1 : 0 // MediaPipe etiqueta como en un espejo
      if (wr && poseImage) { const d = (j) => Math.hypot(poseImage[j * 4] - wr.x, poseImage[j * 4 + 1] - wr.y); side = d(15) <= d(16) ? 0 : 1 } // 15 = muñeca izq., 16 = der.
      fingerCurls(lm).forEach((v, f) => { c[side * 5 + f] = v })
    })
    return c
  }
  close() { try { this.h?.close() } catch { /* ya cerrado */ } this.h = null }
}

/** Fuente genérica: llama a onFrame({ t, p, image, c? }) mientras está en marcha. `hands`: seguir también los dedos. */
export class PoseSource {
  constructor(kind, { facing = 'environment', file = null, hands = false, onFrame, onError } = {}) { Object.assign(this, { kind, facing, file, hands, onFrame, onError }); this.on = false; this.fps = 0; this._times = [] }
  async start() {
    this.on = true; this.t0 = performance.now()
    if (this.kind === 'sim') { this._simLoop(); return this }
    this.tracker = await new PoseTracker().init()
    if (this.hands) this.handTracker = await new HandTracker().init()
    this.video = document.createElement('video')
    this.video.muted = true; this.video.playsInline = true
    if (this.kind === 'camera') {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este dispositivo no permite usar la cámara desde la app')
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: this.facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      this.video.srcObject = this.stream
    } else {
      this.video.src = URL.createObjectURL(this.file)
    }
    await this.video.play()
    this._videoLoop()
    return this
  }
  _tick() { const now = performance.now(); this._times.push(now); while (this._times.length && now - this._times[0] > 1000) this._times.shift(); this.fps = this._times.length }
  _simLoop() {
    const step = () => {
      if (!this.on) return
      const t = (performance.now() - this.t0) / 1000, pts = subjectPoints(poseAt(t)), p = []
      const image = new Array(132)
      pts.forEach((v, i) => { const r = RAW.mediapipe(v); p.push(r[0], r[1], r[2], 0.99); image[i * 4] = 0.5 + r[0] * 0.38; image[i * 4 + 1] = 0.45 + r[1] * 0.38; image[i * 4 + 2] = 0; image[i * 4 + 3] = 1 })
      const g = Math.round((0.5 + 0.5 * Math.sin(t * 1.5)) * 1000) / 1000 // el actor simulado abre y cierra las manos
      this._tick(); this.onFrame?.({ t, p, image, c: [g * 0.6, g, g, g, g, g * 0.6, g, g, g, g] })
      this._timer = setTimeout(step, 33)
    }
    step()
  }
  _videoLoop() {
    const v = this.video
    const step = async () => {
      if (!this.on) return
      if (v.readyState >= 2 && !v.paused) {
        try {
          const r = await this.tracker.detect(v)
          const t = this.kind === 'video' ? v.currentTime : (performance.now() - this.t0) / 1000
          this._tick()
          if (r) {
            const c = this.handTracker ? await this.handTracker.detect(v, r.image) : null
            this.onFrame?.({ t, p: r.world, image: r.image, ...(c ? { c } : {}) })
          }
        } catch (e) { this.onError?.(e) }
      }
      if (this.kind === 'video' && v.ended) { this.on = false; this.onEnd?.(); return }
      if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(step); else this._raf = requestAnimationFrame(step)
    }
    step()
  }
  stop() {
    this.on = false
    clearTimeout(this._timer); cancelAnimationFrame(this._raf)
    this.stream?.getTracks().forEach((t) => t.stop())
    if (this.video) { this.video.pause(); if (this.kind === 'video') URL.revokeObjectURL(this.video.src); this.video.srcObject = null }
    this.tracker?.close(); this.handTracker?.close()
  }
}
