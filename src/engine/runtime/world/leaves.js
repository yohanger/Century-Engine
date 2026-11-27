// Hojas que caen de los árboles. Se anima ENTERA en la GPU (como la lluvia, fx.js): el CPU solo elige qué árboles cercanos emiten
// y cada cierto tiempo. Cada hoja es un cuadrito que nace en la copa de un árbol, cae con vaivén, la arrastra el viento local (World.windAt3D, con fallback a frame.wind)
// y acaba posada en el suelo, desvaneciéndose antes de volver a nacer. Con más viento caen más hojas; con lluvia fuerte, menos.
// Los emisores salen del terreno: los tipos de vegetación con «leaves» activado (por defecto árbol y pino). El terreno no sabe de viento
// ni de hojas: solo expone `foliage.types` (instancias) y `heightAt`.
import * as THREE from 'three'

const MAX_TREES = 96
const PER_TREE = 14
const RANGE = 48           // m alrededor de la cámara
const REFRESH = 1.5        // s entre búsquedas de emisores

const VERT = /* glsl */`
attribute vec4 aTree; attribute vec4 aSeed;
uniform float uTime, uSize; uniform vec2 uWind; uniform vec3 uRight, uUp;
varying vec2 vP; varying float vA; varying float vC; varying float vLand;
void main() {
  float life = 6.0 + 6.0 * aSeed.x;
  float age = fract(uTime / life + aSeed.y) * life;
  float a0 = aSeed.z * 6.2831853;
  float R = 0.7 + 0.22 * aTree.w;
  vec3 start = vec3(aTree.x + cos(a0) * R * aSeed.w, aTree.y + aTree.w * (0.55 + 0.4 * aSeed.z), aTree.z + sin(a0) * R * aSeed.w);
  float vFall = 0.5 + 0.55 * aSeed.x;
  float ground = aTree.y + 0.03;
  float fallT = max(0.01, (start.y - ground) / vFall);
  float fT = min(age, fallT);
  float land = step(fallT, age);
  float wsp = length(uWind);
  vec2 drift = uWind * fT * (0.3 + 0.45 * aSeed.y) * (0.7 + 0.08 * wsp);
  vec2 sway = vec2(sin(age * 1.9 + aSeed.z * 9.0), cos(age * 1.3 + aSeed.w * 9.0)) * (0.35 + 0.05 * wsp) * (1.0 - land);
  vec3 pos = vec3(start.x + drift.x + sway.x, max(ground, start.y - fT * vFall), start.z + drift.y + sway.y);
  float ang = age * (1.4 + aSeed.x * 2.2) * (1.0 - land) + aSeed.z * 6.2831853;
  float sq = mix(0.35, 1.0, abs(cos(age * 2.1 + aSeed.w * 6.0)));
  vec2 q = position.xy; q.x *= mix(sq, 1.0, land);
  q = mat2(cos(ang), sin(ang), -sin(ang), cos(ang)) * q;
  float sz = uSize * (0.7 + 0.6 * aSeed.x);
  vec3 wp = land > 0.5 ? pos + vec3(q.x, 0.0, q.y) * sz : pos + (uRight * q.x + uUp * q.y) * sz;
  vA = smoothstep(0.0, 0.5, age) * (1.0 - smoothstep(life - 1.4, life, age));
  vC = aSeed.w; vP = position.xy; vLand = land;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`
const FRAG = /* glsl */`
uniform float uLight; uniform vec3 uColA, uColB, uColC;
varying vec2 vP; varying float vA; varying float vC; varying float vLand;
void main() {
  vec2 p = vP * 2.0;                                   // −1…1
  float shape = 1.0 - (p.x * p.x * 1.6 + p.y * p.y * 0.55 + abs(p.x) * p.y * 0.5);   // hoja alargada con punta
  if (shape < 0.0 || vA < 0.02) discard;
  vec3 col = vC < 0.55 ? mix(uColA, uColB, vC / 0.55) : mix(uColB, uColC, (vC - 0.55) / 0.45);
  col *= (0.78 + 0.22 * (p.y * 0.5 + 0.5)) * uLight * (1.0 - 0.18 * vLand);
  gl_FragColor = vec4(col, vA * smoothstep(0.0, 0.12, shape));
}`

function seedBuf(n) {
  const a = new Float32Array(n * 4); let r = 987654321
  const rnd = () => { r ^= r << 13; r ^= r >>> 17; r ^= r << 5; return ((r >>> 0) % 100000) / 100000 }
  for (let i = 0; i < a.length; i++) a[i] = rnd()
  return a
}

export class LeafFX {
  constructor(scene) {
    const n = MAX_TREES * PER_TREE
    const quad = new THREE.PlaneGeometry(1, 1)
    const g = new THREE.InstancedBufferGeometry()
    g.index = quad.index; g.setAttribute('position', quad.attributes.position)
    this.tree = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4)
    g.setAttribute('aTree', this.tree)
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seedBuf(n), 4))
    g.instanceCount = 0
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      uniforms: { uTime: { value: 0 }, uSize: { value: 0.16 }, uWind: { value: new THREE.Vector2() }, uRight: { value: new THREE.Vector3(1, 0, 0) }, uUp: { value: new THREE.Vector3(0, 1, 0) }, uLight: { value: 1 },
        uColA: { value: new THREE.Color('#4f8f2f') }, uColB: { value: new THREE.Color('#a9b83c') }, uColC: { value: new THREE.Color('#b9772c') } },
    })
    this.mesh = new THREE.Mesh(g, this.mat)
    this.mesh.frustumCulled = false; this.mesh.visible = false; this.mesh.renderOrder = 4
    scene.add(this.mesh)
    this.trees = 0; this._age = 99; this._cx = Infinity; this._cz = Infinity; this._t = 0
  }

  /** Árboles que emiten, de más cerca a más lejos. `terrains` = lista de Terrain. */
  _collect(terrains, cx, cz) {
    const list = []
    for (const t of terrains) {
      if (!t.enabled || !t.foliage) continue
      for (const s of t.foliage.types.values()) {
        if (!s.cfg.leaves || !s.cfg.visible || !s.count) continue
        let h = 0
        for (const p of s.parts || []) { const g = p.geometry; if (!g.boundingBox) g.computeBoundingBox(); h = Math.max(h, g.boundingBox.max.y) }
        if (!h) h = 3.2
        const d = s.data
        for (let i = 0; i < s.count; i++) {
          const x = d[i * 4], z = d[i * 4 + 1], dd = (x + t.ox - cx) ** 2 + (z + t.oz - cz) ** 2
          if (dd > RANGE * RANGE) continue
          list.push([dd, x + t.ox, t.oy + t.heightAt(x, z), z + t.oz, h * (d[i * 4 + 3] || 1)])
        }
      }
    }
    list.sort((a, b) => a[0] - b[0])
    return list.slice(0, MAX_TREES)
  }

  /**
   * `f` = World.frame() o null (sin mundo activo: brisa suave). Devuelve true si hay hojas que dibujar (el visor sigue renderizando).
   * `animate` = false deja el tiempo quieto (editor sin clima animado).
   * `windLocal` es la misma muestra que usa la vegetación; sin World, conserva el viento del frame.
   */
  update(f, cam, dt, terrains, animate = true, windLocal = null) {
    if (!this.mesh) return false
    const wind = windLocal ?? (f ? f.wind : { x: 1.2, z: 0 })
    const wsp = Math.hypot(wind.x, wind.z)
    const rain = f ? f.precip.rain : 0, snow = f ? f.precip.snow : 0
    const rate = Math.max(0, Math.min(1, 0.3 + wsp / 9)) * (1 - 0.7 * rain) * (1 - snow)
    this._age += dt
    const moved = Math.hypot(cam.position.x - this._cx, cam.position.z - this._cz)
    if (this._age > REFRESH && (moved > 5 || this._age > 12) && terrains) {
      this._age = 0; this._cx = cam.position.x; this._cz = cam.position.z
      const list = this._collect(terrains, this._cx, this._cz)
      this.trees = list.length
      const a = this.tree.array
      for (let l = 0; l < PER_TREE; l++) for (let k = 0; k < list.length; k++) { const j = (l * list.length + k) * 4, e = list[k]; a[j] = e[1]; a[j + 1] = e[2]; a[j + 2] = e[3]; a[j + 3] = e[4] }
      this.tree.needsUpdate = true
    }
    const per = Math.ceil(PER_TREE * rate)
    this.mesh.geometry.instanceCount = this.trees * per
    this.mesh.visible = this.trees > 0 && per > 0
    if (!this.mesh.visible) return false
    if (animate) this._t += dt
    const u = this.mat.uniforms
    u.uTime.value = this._t
    u.uWind.value.set(wind.x, wind.z)
    cam.updateMatrixWorld()
    u.uRight.value.setFromMatrixColumn(cam.matrixWorld, 0); u.uUp.value.setFromMatrixColumn(cam.matrixWorld, 1)
    u.uLight.value = Math.min(1.1, 0.2 + 0.8 * (f ? f.ambientMul : 1))
    return animate
  }

  dispose() { this.mesh.parent?.remove(this.mesh); this.mesh.geometry.dispose(); this.mat.dispose() }
}
