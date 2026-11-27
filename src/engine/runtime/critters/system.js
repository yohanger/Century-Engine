// Sistema de animales: crea un CritterCluster por cada nodo «critters» de la escena, los simula (IA) y los dibuja en la GPU.
// Una sola malla de puntos por especie, con halo aditivo: el brillo de cada agente (a.glow) y su tamaño van en atributos.
// Se usa igual en el editor (vista previa) y en el modo Jugar.
import * as THREE from 'three'
import { CritterCluster } from './cluster.js'
import { getSpecies } from './species.js'
import './index.js'

const VERT = /* glsl */`
attribute float aGlow; attribute vec3 aColor; attribute float aSize;
uniform float uScale;
varying float vG; varying vec3 vC;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vG = aGlow; vC = aColor;
  gl_PointSize = clamp(uScale * aSize * (0.35 + aGlow) / max(0.4, -mv.z), 1.0, 90.0);
  gl_Position = projectionMatrix * mv;
}`
const FRAG = /* glsl */`
varying float vG; varying vec3 vC;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float core = smoothstep(0.35, 0.0, d), halo = exp(-d * d * 4.5);
  float a = (core + halo * 0.55) * vG;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vC * (0.6 + core), a);
}`

const MAX = 2048

export class CritterSystem {
  /** @param scene THREE.Scene · @param opts { objects: () => nodos de la escena, ground: (x, z) => altura | NaN } */
  constructor(scene, opts) {
    this.opts = opts
    this.clusters = new Map()
    this.pos = new Float32Array(MAX * 3); this.glow = new Float32Array(MAX); this.col = new Float32Array(MAX * 3); this.size = new Float32Array(MAX)
    const g = new THREE.BufferGeometry()
    this.attr = {
      position: new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage),
      aGlow: new THREE.BufferAttribute(this.glow, 1).setUsage(THREE.DynamicDrawUsage),
      aColor: new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage),
      aSize: new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage),
    }
    for (const [k, v] of Object.entries(this.attr)) g.setAttribute(k, v)
    g.setDrawRange(0, 0)
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { uScale: { value: 600 } } })
    this.points = new THREE.Points(g, this.mat)
    this.points.frustumCulled = false; this.points.visible = false; this.points.renderOrder = 6
    scene.add(this.points)
    this._sync = 99; this._time = 0; this._last = null; this._camSpeed = 0
  }

  /** Reconcilia clusters y nodos (cada ~0.4 s o al forzar): altas, bajas y cambios de parámetros. */
  sync(force = false) {
    const objs = (this.opts.objects() || []).filter((o) => o.type === 'critters' && o.visible !== false)
    const seen = new Set()
    for (const o of objs) {
      seen.add(o.id)
      const temporary = this.opts.nodes?.()?.get(o.id)?.userData?.timelineVisualFields?.props
      const effective = temporary ? { ...o, props: { ...(o.props || {}), ...temporary } } : o
      const sig = JSON.stringify([effective.position, effective.props])
      let c = this.clusters.get(o.id)
      if (!c) { c = new CritterCluster(effective); c.sig = sig; this.clusters.set(o.id, c) }
      else if (c.sig !== sig || force) { c.configure(effective); c.sig = sig }
    }
    for (const id of [...this.clusters.keys()]) if (!seen.has(id)) this.clusters.delete(id)
  }

  /** Reinicia a los agentes (al empezar a jugar: todos vuelven al suelo y salen de nuevo). */
  reset() { this.clusters.clear(); this.sync(true) }

  /**
   * `f` = World.frame() o null. `animate` = false: se dibujan quietos (editor sin vista viva). Devuelve true si hay algo animándose.
   * Oscuridad: con la hora activa, la del mundo; sin ella, siempre «de noche» (si no, nunca se verían).
   */
  update(f, cam, dt, px = 720, animate = true) {
    this._sync += dt
    // Solo los clusters animados se reconcilian por frame; los estáticos
    // conservan el intervalo original y el coste de simulación actual.
    const nodes = this.opts.nodes?.()
    const animated = [...this.clusters.keys()].some(id => nodes?.get(id)?.userData?.timelineVisualFields?.props)
    if (this._sync > 0.4 || animated || (this._animatedLast && !animated)) {
      this._sync = 0; this.sync()
    }
    this._animatedLast = animated
    if (!this.clusters.size) { this.points.visible = false; return false }
    dt = Math.min(dt, 0.1)
    const cp = cam.position
    const ctx = this._ctx ||= { cam: { x: 0, y: 0, z: 0 }, wind: { x: 0, z: 0 }, ground: (x, z) => this.opts.ground(x, z) }
    if (this._last && dt > 0) { const s = Math.hypot(cp.x - this._last.x, cp.y - this._last.y, cp.z - this._last.z) / dt; this._camSpeed += (Math.min(s, 30) - this._camSpeed) * Math.min(1, dt * 6) }
    this._last = (this._last || new THREE.Vector3()).copy(cp)
    if (animate) this._time += dt
    ctx.time = this._time; ctx.cam.x = cp.x; ctx.cam.y = cp.y; ctx.cam.z = cp.z; ctx.camSpeed = this._camSpeed
    ctx.dark = f && f.timeOn ? Math.max(f.night, f.stars) : 1
    ctx.rain = f ? f.precip.rain : 0; ctx.snow = f ? f.precip.snow : 0
    ctx.wind.x = f ? f.wind.x : 0; ctx.wind.z = f ? f.wind.z : 0; ctx.windSpeed = Math.hypot(ctx.wind.x, ctx.wind.z)
    let n = 0, active = false
    const c3 = new THREE.Color()
    for (const cl of this.clusters.values()) {
      if (animate) cl.step(dt, ctx)
      const look = cl.sp.look, base = look.size * cl.p.size
      c3.set(cl.p.color)
      for (const a of cl.agents) {
        if (n >= MAX) break
        this.pos[n * 3] = a.x; this.pos[n * 3 + 1] = a.y; this.pos[n * 3 + 2] = a.z
        this.glow[n] = a.glow; this.size[n] = base
        this.col[n * 3] = c3.r; this.col[n * 3 + 1] = c3.g; this.col[n * 3 + 2] = c3.b
        n++
      }
      if (cl.active) active = true
    }
    for (const a of Object.values(this.attr)) a.needsUpdate = true
    this.points.geometry.setDrawRange(0, n)
    this.points.visible = n > 0
    this.mat.uniforms.uScale.value = px / (2 * Math.tan((cam.fov || 60) * Math.PI / 360))
    // de noche las que descansan están a punto de salir: hay que seguir dibujando para que despierten (si no, el editor se quedaría quieto)
    if (!active && ctx.dark >= 0.4 && ctx.rain <= 0.25 && ctx.snow <= 0.1) active = true
    return animate && active
  }

  dispose() { this.points.parent?.remove(this.points); this.points.geometry.dispose(); this.mat.dispose() }
}
export { getSpecies }
