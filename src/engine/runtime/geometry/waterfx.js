// Interacción agua ↔ terreno. Un solo modelo para el editor y el juego (GLSL) y para la exportación.
//
// «Mapa de agua»: una textura RGBA8 que cubre el terreno (vista desde arriba) y se hornea con los objetos Agua:
//   R = profundidad con signo (nivel del agua − altura del terreno), codificada como 0.5 + 0.5·sgn·√(|d| / MAXD)
//       (la raíz da precisión de milímetros cerca de la orilla, que es donde se nota). + = bajo el agua, − = sobre ella.
//   G = cobertura: 1 dentro de la huella del agua, cae a 0 en ~0.75 m fuera de ella.
// El terreno lo usa para mojarse (orilla oscura y brillante) y teñirse bajo el agua (absorción).
// El agua lo usa para el color/opacidad según la profundidad real, el borde suave y la espuma de orilla.
import * as THREE from 'three'
import { normalizeWaterNode } from './watershape.js'

export const WMAP_MAXD = 24 // profundidad máxima representable (m)
const MARGIN = 0.75 // m: la cobertura baja a 0 fuera de la huella
const DEG = Math.PI / 180

/** Ajustes de la escena (viven en `environment`, con prefijo wf). */
export const WFX_DEFAULTS = {
  wfOn: true, // el terreno y el agua reaccionan entre sí
  wfWetBand: 0.6, // m sobre el agua que quedan mojados
  wfWetDarken: 0.4, // cuánto se oscurece lo mojado (0..1)
  wfWetGloss: 0.5, // cuánto brilla lo mojado (0..1)
  wfTint: '#1d5f73', // color del fondo a profundidad
  wfAbsorb: 0.45, // absorción por metro de agua (el fondo tira al color anterior)
}
export const normalizeWaterFx = (env) => {
  const o = {}
  for (const k of Object.keys(WFX_DEFAULTS)) o[k] = env && env[k] !== undefined ? env[k] : WFX_DEFAULTS[k]
  return o
}

// ------------------------------------------------------------------ horneado (JS, sin DOM)
/** Cuerpos de agua del proyecto con su transformación al mundo (solo cuenta el giro en Y). */
export function collectWaterBodies(objects) {
  const byId = new Map(objects.map((o) => [o.id, o]))
  const worldOf = (o) => {
    const chain = []
    for (let c = o, n = 0; c && n < 64; c = c.parentId ? byId.get(c.parentId) : null, n++) chain.unshift(c)
    const m = new THREE.Matrix4()
    const e = new THREE.Euler(), q = new THREE.Quaternion()
    for (const c of chain) {
      e.set(c.rotation[0] * DEG, c.rotation[1] * DEG, c.rotation[2] * DEG, 'YXZ')
      m.multiply(new THREE.Matrix4().compose(new THREE.Vector3(...c.position), q.setFromEuler(e), new THREE.Vector3(1, 1, 1)))
    }
    return m
  }
  const effective = (o) => {
    const seen = new Set()
    for (let c = o; c; c = c.parentId ? byId.get(c.parentId) : null) {
      if (seen.has(c.id) || c.active === false || c.visible === false || (c.parentId && !byId.has(c.parentId))) return false
      seen.add(c.id)
    }
    return true
  }
  const out = []
  for (const o of objects) {
    if (o.type !== 'water' || !effective(o)) continue
    const m = worldOf(o)
    const pos = new THREE.Vector3(), qn = new THREE.Quaternion(), sc = new THREE.Vector3()
    m.decompose(pos, qn, sc)
    const yaw = new THREE.Euler().setFromQuaternion(qn, 'YXZ').y
    out.push({ id: o.id, name: o.name, x: pos.x, y: pos.y, z: pos.z, yaw, p: normalizeWaterNode(o.props) })
  }
  return out
}

/** Línea central del río en coordenadas locales: [[x, y, z], …] muestreada cada ~`step` m. */
export function riverLine(p, step) {
  const pts = p.points.map((v) => new THREE.Vector3(...v))
  if (pts.length < 2) return []
  let curve
  if (p.smooth && pts.length > 2) curve = new THREE.CatmullRomCurve3(pts, p.closed, 'centripetal')
  else {
    curve = new THREE.CurvePath()
    for (let i = 0; i < pts.length - 1; i++) curve.add(new THREE.LineCurve3(pts[i], pts[i + 1]))
    if (p.closed && pts.length > 2) curve.add(new THREE.LineCurve3(pts[pts.length - 1], pts[0]))
  }
  const L = curve.getLength()
  if (!(L > 0.01)) return []
  curve.arcLengthDivisions = Math.max(200, Math.ceil(L * 4))
  curve.updateArcLengths?.()
  const n = Math.min(4000, Math.max(2, Math.ceil(L / step)))
  const line = []
  for (let i = 0; i <= n; i++) { const P = curve.getPointAt(i / n); line.push([P.x, P.y, P.z]) }
  return line
}

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const smooth01 = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t) }
export const encDepth = (d) => {
  const s = Math.sqrt(Math.min(Math.abs(d), WMAP_MAXD) / WMAP_MAXD)
  return Math.round(255 * (0.5 + 0.5 * Math.sign(d) * s))
}
export const decDepth = (byte) => { const s = (byte / 255 - 0.5) * 2; return Math.sign(s) * s * s * WMAP_MAXD }

/** Resolución del mapa: 2 texeles por celda del terreno, entre 64 y 512. */
export const waterMapRes = (terrain) => Math.max(64, Math.min(512, terrain.segments * 2))

/**
 * Hornea el mapa de agua. Devuelve null si no hay agua o el terreno está desactivado.
 * `terrain` solo necesita size, segments, enabled y heightAt(x, z).
 */
export function bakeWaterMap(objects, terrain) {
  if (!terrain || terrain.enabled === false) return null
  const bodies = collectWaterBodies(objects)
  if (!bodies.length) return null
  const M = waterMapRes(terrain), S = terrain.size
  const cell = S / M
  const N = M * M
  // por cada texel: el mejor cuerpo (dentro de la huella → el más profundo; si ninguno, el más cercano)
  const bestDepth = new Float32Array(N).fill(-1e9), bestCov = new Float32Array(N), bestSd = new Float32Array(N).fill(1e9)
  const hts = new Float32Array(N)
  for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) hts[j * M + i] = terrain.heightAt((i + 0.5) * cell - S / 2, (j + 0.5) * cell - S / 2)

  const consider = (k, sd, level) => {
    const cov = 1 - smooth01(0, MARGIN, sd)
    const depth = level - hts[k]
    const inside = cov > 0
    const hadInside = bestCov[k] > 0
    if (inside) { if (!hadInside || depth > bestDepth[k]) { bestDepth[k] = depth; bestCov[k] = cov; bestSd[k] = sd } }
    else if (!hadInside && sd < bestSd[k]) { bestDepth[k] = depth; bestCov[k] = 0; bestSd[k] = sd }
  }

  for (const b of bodies) {
    const c = Math.cos(b.yaw), s = Math.sin(b.yaw)
    // mundo → local (rotación −yaw alrededor de Y): lx = c·dx − s·dz ; lz = s·dx + c·dz  (R_y(θ) manda local→mundo con x' = c·x + s·z, z' = −s·x + c·z)
    const toLocal = (wx, wz) => { const dx = wx - b.x, dz = wz - b.z; return [c * dx - s * dz, s * dx + c * dz] }
    const shape = b.p.shape
    if (shape === 'river') {
      const line = riverLine(b.p, Math.max(0.25, cell * 0.5))
      if (line.length < 2) continue
      const half = Math.max(0.1, b.p.riverWidth) / 2
      const ext = half + MARGIN + cell
      const minD = new Float32Array(N).fill(1e9), lvl = new Float32Array(N)
      // locales → mundo (inversa de toLocal): x = c·lx + s·lz ; z = −s·lx + c·lz
      const toWorld = (lx, lz) => [b.x + c * lx + s * lz, b.z - s * lx + c * lz]
      for (let a = 0; a < line.length - 1; a++) {
        const [ax, ay, az] = line[a], [bx, by, bz] = line[a + 1]
        const [wax, waz] = toWorld(ax, az), [wbx, wbz] = toWorld(bx, bz)
        const x0 = Math.floor((Math.min(wax, wbx) - ext + S / 2) / cell), x1 = Math.ceil((Math.max(wax, wbx) + ext + S / 2) / cell)
        const z0 = Math.floor((Math.min(waz, wbz) - ext + S / 2) / cell), z1 = Math.ceil((Math.max(waz, wbz) + ext + S / 2) / cell)
        const ex = wbx - wax, ez = wbz - waz, len2 = ex * ex + ez * ez || 1e-9
        for (let j = Math.max(0, z0); j <= Math.min(M - 1, z1); j++) for (let i = Math.max(0, x0); i <= Math.min(M - 1, x1); i++) {
          const px = (i + 0.5) * cell - S / 2, pz = (j + 0.5) * cell - S / 2
          const t = clamp01(((px - wax) * ex + (pz - waz) * ez) / len2)
          const d = Math.hypot(px - (wax + ex * t), pz - (waz + ez * t))
          const k = j * M + i
          if (d < minD[k]) { minD[k] = d; lvl[k] = b.y + ay + (by - ay) * t }
        }
      }
      for (let k = 0; k < N; k++) if (minD[k] < 1e8) consider(k, minD[k] - half, lvl[k])
      continue
    }
    for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
      const [lx, lz] = toLocal((i + 0.5) * cell - S / 2, (j + 0.5) * cell - S / 2)
      let sd
      if (shape === 'rect') {
        const qx = Math.abs(lx) - Math.max(0.5, b.p.width) / 2, qz = Math.abs(lz) - Math.max(0.5, b.p.length) / 2
        sd = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0)
      } else if (shape === 'circle') sd = Math.hypot(lx, lz) - Math.max(0.5, b.p.radius)
      else sd = Math.max(Math.abs(lx), Math.abs(lz)) - Math.max(10, b.p.size) / 2
      consider(j * M + i, sd, b.y)
    }
  }

  const data = new Uint8Array(N * 4)
  for (let k = 0; k < N; k++) {
    const has = bestDepth[k] > -1e8
    data[k * 4] = has ? encDepth(bestDepth[k]) : 128
    data[k * 4 + 1] = Math.round(255 * bestCov[k])
    data[k * 4 + 2] = 0
    data[k * 4 + 3] = 255
  }
  return { data, res: M, size: S, maxD: WMAP_MAXD }
}

// ------------------------------------------------------------------ editor (three.js)
export function makeWaterFxUniforms() {
  const blank = new THREE.DataTexture(new Uint8Array([128, 0, 0, 255]), 1, 1, THREE.RGBAFormat)
  blank.needsUpdate = true
  return {
    rtWM: { value: blank }, rtWMp: { value: new THREE.Vector4(64, WMAP_MAXD, 0, 0) },
    rtFxA: { value: new THREE.Vector4(0.6, 0.4, 0.5, 0.45) }, rtFxTint: { value: new THREE.Color('#1d5f73') },
  }
}

/** Uniforms únicos y compartidos por el terreno y todas las aguas del editor (hay un solo mapa por escena). */
export const WM = makeWaterFxUniforms()

/** Pone la textura del mapa (o la apaga) y los ajustes de la escena en los uniforms compartidos. */
export function setWaterFxUniforms(u, map, fx) {
  if (u.rtWM.value?.userData?.owned && (!map || u.rtWM.value.image.width !== map.res)) { u.rtWM.value.dispose(); u.rtWM.value = null }
  if (map && fx.wfOn) {
    let t = u.rtWM.value
    if (!t || !t.userData?.owned) {
      t = new THREE.DataTexture(map.data, map.res, map.res, THREE.RGBAFormat)
      t.colorSpace = THREE.NoColorSpace
      t.minFilter = t.magFilter = THREE.LinearFilter
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping
      t.generateMipmaps = false
      t.userData = { owned: true }
      u.rtWM.value = t
    } else { t.image.data = map.data }
    t.needsUpdate = true
    u.rtWMp.value.set(map.size, map.maxD, 1, 0)
  } else {
    if (!u.rtWM.value) { const b = new THREE.DataTexture(new Uint8Array([128, 0, 0, 255]), 1, 1, THREE.RGBAFormat); b.needsUpdate = true; u.rtWM.value = b }
    u.rtWMp.value.set(64, WMAP_MAXD, 0, 0)
  }
  u.rtFxA.value.set(fx.wfWetBand, fx.wfWetDarken, fx.wfWetGloss, fx.wfAbsorb)
  u.rtFxTint.value.set(fx.wfTint)
}

/** GLSL del terreno (three). `vTxz` = x,z del vértice. Va después de componer el color de las capas. */
export const WFX_TERRAIN_DECL = `uniform sampler2D rtWM;
uniform vec4 rtWMp;
uniform vec4 rtFxA;
uniform vec3 rtFxTint;
float rtWetV = 0.0;
`
export const WFX_TERRAIN_COLOR = `if (rtWMp.z > 0.5) {
  vec4 rtM = texture2D(rtWM, vTxz / rtWMp.x + 0.5);
  float rtS = (rtM.r - 0.5) * 2.0;
  float rtD = sign(rtS) * rtS * rtS * rtWMp.y;
  float rtWet = rtM.g * (1.0 - smoothstep(0.0, rtFxA.x, -rtD));
  float rtUnder = rtM.g * smoothstep(0.0, 0.12, rtD);
  diffuseColor.rgb *= 1.0 - rtFxA.y * rtWet;
  vec3 rtUw = mix(rtFxTint, diffuseColor.rgb, exp(-rtFxA.w * max(rtD, 0.0)));
  diffuseColor.rgb = mix(diffuseColor.rgb, rtUw, rtUnder);
  rtWetV = rtWet;
}`
export const WFX_TERRAIN_ROUGH = 'roughnessFactor = mix(roughnessFactor, roughnessFactor * (1.0 - 0.7 * rtFxA.z), rtWetV);'
