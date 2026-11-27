// Gotas de salpicadura: un solo `THREE.Points` con un número fijo de partículas que se reutilizan (sin crear objetos al jugar).
// Las gotas salen con una velocidad hacia arriba y hacia fuera, caen con la gravedad y mueren al volver a la altura del agua o al acabar su vida.
// Se dibujan como discos suaves del color del agua (más claro) y encogen al final de su vida. Todo en la CPU salvo el dibujo; unas 400 gotas cuestan nada.
import * as THREE from 'three'

const MAX = 480
const VERT = /* glsl */`
  attribute float aSize; attribute float aLife; attribute vec3 aColor; varying vec3 vC; varying float vA; uniform float uScale;
  void main() {
    vC = aColor; vA = clamp(aLife, 0.0, 1.0);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aLife > 0.0 ? max(1.5, aSize * uScale / max(-mv.z, 0.1) * (0.5 + 0.5 * vA)) : 0.0;
    gl_Position = projectionMatrix * mv;
  }`
const FRAG = /* glsl */`
  varying vec3 vC; varying float vA;
  void main() {
    vec2 q = gl_PointCoord - 0.5; float d = length(q) * 2.0;
    if (d > 1.0) discard;
    float a = smoothstep(1.0, 0.4, d) * (0.35 + 0.65 * vA);
    gl_FragColor = vec4(vC, a);
  }`

export class SplashFX {
  constructor(scene) {
    this.scene = scene
    const g = new THREE.BufferGeometry()
    this.pos = new Float32Array(MAX * 3); this.col = new Float32Array(MAX * 3); this.size = new Float32Array(MAX); this.life = new Float32Array(MAX)
    this.vel = new Float32Array(MAX * 3); this.t = new Float32Array(MAX); this.floor = new Float32Array(MAX); this.dur = new Float32Array(MAX)
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3))
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1))
    g.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1))
    this.mat = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 600 } }, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false })
    this.points = new THREE.Points(g, this.mat)
    this.points.frustumCulled = false; this.points.raycast = () => {}; this.points.renderOrder = 5; this.points.name = 'rt-splash'
    scene.add(this.points)
    this.next = 0; this.alive = 0
  }

  /**
   * Una salpicadura: `n` gotas desde (x, y, z) (y = superficie del agua). `power` 0..1+ da altura y alcance; `color` = color del agua (se aclara).
   * `light` 0..1 = luz de la escena (de noche las gotas no brillan).
   */
  burst(x, y, z, { n = 12, power = 0.6, color = '#9ec5e0', light = 1, spread = 0.25 } = {}) {
    const c = new THREE.Color(color).lerp(new THREE.Color(1, 1, 1), 0.55).multiplyScalar(0.25 + 0.75 * light)
    for (let i = 0; i < n; i++) {
      const k = this.next++ % MAX, a = Math.random() * Math.PI * 2, out = (0.3 + Math.random()) * (0.6 + power * 1.4) * (0.5 + spread * 2)
      const o = k * 3, r = Math.random() * spread
      this.pos[o] = x + Math.cos(a) * r; this.pos[o + 1] = y + 0.02; this.pos[o + 2] = z + Math.sin(a) * r
      this.vel[o] = Math.cos(a) * out; this.vel[o + 1] = (1.2 + Math.random() * 2.2) * (0.5 + power); this.vel[o + 2] = Math.sin(a) * out
      this.col[o] = c.r; this.col[o + 1] = c.g; this.col[o + 2] = c.b
      this.size[k] = 0.035 + Math.random() * 0.05 * (0.5 + power)
      this.dur[k] = 0.5 + Math.random() * 0.7; this.t[k] = 0; this.floor[k] = y; this.life[k] = 1
    }
    this.points.geometry.attributes.aColor.needsUpdate = true; this.points.geometry.attributes.aSize.needsUpdate = true
  }

  update(dt, camera, viewH = 800) {
    let alive = 0
    const g = 9.8
    for (let k = 0; k < MAX; k++) {
      if (this.life[k] <= 0) continue
      const o = k * 3
      this.t[k] += dt
      this.vel[o + 1] -= g * dt
      this.pos[o] += this.vel[o] * dt; this.pos[o + 1] += this.vel[o + 1] * dt; this.pos[o + 2] += this.vel[o + 2] * dt
      this.life[k] = 1 - this.t[k] / this.dur[k]
      if ((this.vel[o + 1] < 0 && this.pos[o + 1] < this.floor[k]) || this.life[k] <= 0) this.life[k] = 0
      else alive++
    }
    this.alive = alive
    this.points.visible = alive > 0
    if (alive > 0) {
      this.points.geometry.attributes.position.needsUpdate = true; this.points.geometry.attributes.aLife.needsUpdate = true
      const fov = camera?.isPerspectiveCamera ? (camera.fov * Math.PI) / 180 : 1
      this.mat.uniforms.uScale.value = viewH / (2 * Math.tan(fov / 2))
    }
    return alive > 0
  }

  dispose() { this.scene.remove(this.points); this.points.geometry.dispose(); this.mat.dispose() }
}
