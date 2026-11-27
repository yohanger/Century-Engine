import { syncNativeMaps } from './native-maps.js'
// Material PBR de los objetos (primitivas, mallas editables…): MeshPhysicalMaterial + un shader de superficie GLSL.
//
// Datos en el objeto (`obj.mat`, opcional):
//   { shader: '' | 'builtin:…' | id de un shader del proyecto,   '' = el shader por defecto del proyecto (Ajustes → Render)
//     params: { uNombre: valor },   valores de las propiedades declaradas por el shader (texturas = id de archivo del proyecto)
//     mapping: 'world' | 'object' }  'world': las texturas siguen el mundo (continuas entre objetos); 'object': van pegadas al objeto
// Además se usan los campos de siempre: color, roughness, metallic, opacity (son los factores que multiplican a los mapas).
import * as THREE from 'three'
import { iblDiffuse } from './chunks.js'
import { effectiveMaterialObject } from './material-resource.js'
import { normalizeSurfaceDetail } from './surface-detail.js'
import { injectRoadPaint } from './road-paint.js'
import { blockoutFont } from './blockout-font.js'
import { SH_RUNTIME_GLSL } from '../bake/tracer.js'
import {
  BUILTIN_SHADERS, BUILTIN_PREFIX, DEFAULT_SHADER_ID, PRELUDE_VERT, VERT_BODY, PRELUDE_FRAG, FRAG_BEGIN, FRAG_AO, splitVertexStage, VERT_USER_PRELUDE, vertApply, VERT_APPLY_DEPTH,
  parseShader, uniformDecls, stripParamUniforms, hashString,
} from './shaderlib.js'

/** Reloj compartido por todos los shaders (`s.time`). Lo actualiza el viewport en cada fotograma. */
export const LF_TIME = { value: 0 }

const WHITE = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
WHITE.needsUpdate = true

const parsed = new Map() // hash del código → info
export function infoOf(code) {
  const k = hashString(code)
  let i = parsed.get(k)
  if (!i) { i = parseShader(code); parsed.set(k, i) }
  return i
}

/** Sondas de luz: coeficientes SH (9 × Vector3) que el material usa como luz difusa. null = sin sondas. Sirve para cualquier material de three. */
export function injectProbes(shader, m) {
  const arr = m.userData.rtShArr
  if (!arr) return
  shader.uniforms.uLfSH = { value: arr }
  shader.fragmentShader = '#define LF_PROBES\n' + shader.fragmentShader.replace('void main() {', SH_RUNTIME_GLSL + '\nvoid main() {')
}
/** Ajusta solo la posición dibujada: física, normales, UV y sombras permanecen en su espacio original. */
function injectPsx(shader, m) {
  const psx = m.userData.rtPsx
  if (!psx) return
  shader.uniforms.uLfPsxSize = psx.size
  shader.uniforms.uLfPsxStep = psx.step
  shader.uniforms.uLfPsxPhase = psx.phase
  shader.vertexShader = shader.vertexShader
    .replace('void main() {', 'uniform vec2 uLfPsxSize;\nuniform float uLfPsxStep;\nuniform vec2 uLfPsxPhase;\nvoid main() {')
    .replace('#include <project_vertex>', `#include <project_vertex>
  // Cuantización en píxeles tras la proyección, sin desplazar la malla del mundo.
  // El valor 0 desactiva el ajuste, incluso si el material conservó el programa compilado.
  if (uLfPsxStep > 0.0 && gl_Position.w > 0.0001) {
    vec2 p = (gl_Position.xy / gl_Position.w * 0.5 + 0.5) * uLfPsxSize;
    p += uLfPsxPhase * uLfPsxStep;
    p = floor(p / uLfPsxStep + 0.5) * uLfPsxStep;
    p -= uLfPsxPhase * uLfPsxStep;
    gl_Position.xy = (p / uLfPsxSize * 2.0 - 1.0) * gl_Position.w;
  }`)
}

/** Interpolación affine solo del mapa de color (UV ya transformadas por Three.js). El resto del PBR no cambia. */
function injectPsxAffine(shader, m) {
  if (!m.userData.rtPsxAffine) return
  shader.vertexShader = '#ifdef USE_MAP\nvarying vec2 vLfAffineUv;\nvarying float vLfAffineW;\n#endif\n' + shader.vertexShader
    .replace('#include <project_vertex>', `#include <project_vertex>
#ifdef USE_MAP
  vLfAffineUv = vMapUv * gl_Position.w;
  vLfAffineW = gl_Position.w;
#endif`)
  shader.fragmentShader = '#ifdef USE_MAP\nvarying vec2 vLfAffineUv;\nvarying float vLfAffineW;\n#endif\n' + shader.fragmentShader
    .replace('#include <map_fragment>', `#ifdef USE_MAP
  // La división posterior a la interpolación cancela la corrección de perspectiva.
  #define vMapUv (vLfAffineUv / max(vLfAffineW, 0.0001))
#endif
#include <map_fragment>
#ifdef USE_MAP
  #undef vMapUv
#endif`)
}

/** Un solo gancho para sondas y efectos del material, conservando cualquier gancho previo del importador. */
function attachMaterialEffects(m) {
  if (m.userData.rt || m.userData.rtLfEffects) return
  const compile = m.onBeforeCompile
  const cacheKey = m.customProgramCacheKey
  m.onBeforeCompile = function (shader, renderer) {
    compile.call(this, shader, renderer)
    injectProbes(shader, this)
    injectPsx(shader, this)
    injectPsxAffine(shader, this)
    injectRoadPaint(shader, this)
  }
  m.customProgramCacheKey = function () {
    return cacheKey.call(this) + (this.userData.rtShArr ? '|sh' : '') + (this.userData.rtPsx ? '|psx' : '') + (this.userData.rtPsxAffine ? '|psx-affine' : '') + (this.userData.rtRoadPaint ? '|roadpaint' : '')
  }
  m.userData.rtLfEffects = true
}

/** Solo se activa en materiales importados con textura base y UV0. No cambia ni clona la textura. */
export function setPsxAffine(m, enabled) {
  if (!m || !(m.isMeshStandardMaterial || m.isMeshPhysicalMaterial)) return
  const active = !!enabled && !!m.map && (m.map.channel ?? 0) === 0
  if (active) attachMaterialEffects(m)
  if (!!m.userData.rtPsxAffine !== active) {
    m.userData.rtPsxAffine = active
    m.needsUpdate = true
  }
}

export function setProbeArray(m, arr) {
  const had = !!m.userData.rtShArr
  m.userData.rtShArr = arr || null
  attachMaterialEffects(m)
  if (had !== !!arr) m.needsUpdate = true
}

/** Al pintar sobre un material clásico, conecta el mismo gancho PBR sin reemplazarlo. */
export function ensureRoadPaintPbrEffect(m) {
  if (m.userData.rtRoadPaint && !m.userData.rt) attachMaterialEffects(m)
}

export function makePbrMaterial(side = THREE.FrontSide) {
  return new THREE.MeshPhysicalMaterial({ side })
}

/** Busca el código de un shader por id (incluidos o del proyecto). */
export function findShader(id, projectShaders = []) {
  return BUILTIN_SHADERS.find((s) => s.id === id) || projectShaders.find((s) => s.id === id) || null
}

/** Todos los shaders disponibles: incluidos + del proyecto, con su nombre legible. */
export function listShaders(projectShaders = []) {
  return [...BUILTIN_SHADERS, ...projectShaders.filter((s) => s.graph?.target !== 'post')].map((s) => ({ id: s.id, name: infoOf(s.code).name || s.name || s.id, builtin: s.id.startsWith('builtin:') }))
}

const toLinear = (v) => (typeof v === 'string' ? (() => { const c = new THREE.Color(v); return new THREE.Vector3(c.r, c.g, c.b) })() : new THREE.Vector3(...(v || [0, 0, 0])))

/**
 * Aplica los datos del objeto al material. `env`: { look: 'clasico'|'realista', defaultShader, shaders: [], getMap(id, srgb) }.
 * Con el look «clásico» y sin shader explícito el material queda como un PBR estándar (sin gancho), igual que antes.
 */
export const PBR_ENV = { look: 'clasico', defaultShader: '', shaders: [], materials: [], meshes: [], getMap: null }
/** El editor registra aquí su entorno (propiedades dinámicas) para que los nodos sincronicen sus materiales sin recibirlo. */
export function setPbrEnv(env) { Object.defineProperties(PBR_ENV, Object.getOwnPropertyDescriptors(env)) }

// Extensión física opcional. Un proyecto antiguo no tiene mat.physical: conserva los valores originales de Three.js.
export const PHYSICAL_DEFAULTS = Object.freeze({
  clearcoat: 0, clearcoatRoughness: 0, transmission: 0, ior: 1.5, thickness: 0,
  sheen: 0, sheenRoughness: 1, sheenColor: '#000000',
  iridescence: 0, iridescenceIOR: 1.3, anisotropy: 0,
})
const PHYSICAL_LIMITS = {
  clearcoat: [0, 1], clearcoatRoughness: [0, 1], transmission: [0, 1], ior: [1, 2.333],
  thickness: [0, 100], sheen: [0, 1], sheenRoughness: [0, 1],
  iridescence: [0, 1], iridescenceIOR: [1, 2.333], anisotropy: [0, 1],
}
export function normalizePhysical(values = {}) {
  const out = { ...PHYSICAL_DEFAULTS }
  for (const [key, [lo, hi]] of Object.entries(PHYSICAL_LIMITS)) {
    const value = values?.[key]
    if (value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value))) {
      out[key] = Math.min(hi, Math.max(lo, Number(value)))
    }
  }
  if (typeof values?.sheenColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(values.sheenColor)) out.sheenColor = values.sheenColor
  return out
}

export function applyPhysicalMaterial(m, values) {
  if (!m?.isMeshPhysicalMaterial) return
  const p = normalizePhysical(values)
  // Los mapas y los hooks GLSL existentes quedan intactos.
  const active = ['clearcoat', 'transmission', 'sheen', 'iridescence', 'anisotropy'].map((k) => p[k] > 0 ? '1' : '0').join('')
  for (const key of Object.keys(PHYSICAL_DEFAULTS)) {
    if (key === 'sheenColor') m.sheenColor.set(p.sheenColor)
    else m[key] = p[key]
  }
  if (m.userData.lfPhysicalFeatures !== active) {
    m.userData.lfPhysicalFeatures = active
    m.needsUpdate = true
  }
}

export function syncPbrMaterial(m, obj, env = PBR_ENV) {
  obj = effectiveMaterialObject(obj, env.materials)
  m.color.set(obj.color)
  m.roughness = obj.roughness
  m.metalness = obj.metallic
  m.opacity = obj.opacity
  m.transparent = obj.opacity < 1
  applyPhysicalMaterial(m, obj.mat?.physical)
  const sel = obj.mat?.shader || ''
  const id = sel || (env.look === 'clasico' ? '' : env.defaultShader || DEFAULT_SHADER_ID)
  const detail = normalizeSurfaceDetail(obj.mat?.surfaceDetail)
  // En el material estándar/Blockout se emplean los mapas nativos UV de Three.js.
  // Realista usa en su lugar los mapas triplanares; nunca activar ambos caminos a la vez.
  const nativeDetail = !id || id === 'builtin:blockout'
  const image = detail?.texture && env.getMap ? env.getMap(detail.texture, false) : null
  const normal = obj.mat?.maps?.normal ? env.getMap?.(obj.mat.maps.normal, false) || null : nativeDetail && detail?.mode === 'normal' ? image : null
  const bump = !obj.mat?.maps?.normal && nativeDetail && detail?.mode === 'height' ? image : null
  if (m.normalMap !== normal || m.bumpMap !== bump) {
    m.normalMap = normal
    m.bumpMap = bump
    m.needsUpdate = true // USE_NORMALMAP / USE_BUMPMAP cambian el programa GLSL
  }
  if (detail) {
    m.normalScale.set(detail.strength, detail.strength)
    m.bumpScale = detail.strength * 0.05
  }
  if (obj.mat?.maps || m.userData.centuryNativeMaps) syncNativeMaps(m, obj.mat?.maps, env.getMap)
  let st = m.userData.rt || null
  const bakedUv = m.defines?.LF_BAKE_UV
  const previousPsx = m.userData.rtPsx || null
  const psx = env.psxUniforms || null
  m.userData.rtPsx = psx
  if (!id) {
    if (st) {
      m.defines = bakedUv ? { LF_BAKE_UV: bakedUv } : {}; m.userData.rt = null
      // Al volver al material clásico, retirar el shader anterior antes del gancho compartido.
      m.onBeforeCompile = THREE.Material.prototype.onBeforeCompile
      m.customProgramCacheKey = THREE.Material.prototype.customProgramCacheKey
      m.userData.rtLfEffects = false
    }
    if (st || previousPsx !== psx || m.userData.rtRoadPaint) { setProbeArray(m, m.userData.rtShArr); m.needsUpdate = true }
    return null
  }
  const doc = findShader(id, env.shaders) || BUILTIN_SHADERS[0]
  const info = infoOf(doc.code)
  const mapping = obj.mat?.mapping === 'object' ? 'object' : 'world'
  const key = `${doc.id}|${hashString(doc.code)}|${mapping}`
  if (!st || st.key !== key) {
    const uniforms = {}
    for (const p of info.params) {
      uniforms[p.uniform] = { value: p.glsl === 'sampler2D' ? WHITE : p.glsl === 'vec3' ? new THREE.Vector3() : p.def }
      if (p.glsl === 'sampler2D') uniforms[p.uniform + '_set'] = { value: false }
    }
    st?.depthMat?.dispose(); st?.distMat?.dispose()
    if (doc.id === BUILTIN_PREFIX + 'blockout') {
      uniforms.uLfBlockFaces = { value: false }
      uniforms.uLfBlockFont = { value: blockoutFont() }
    }
    st = { key, uniforms }
    m.userData.rt = st
    m.defines = mapping === 'object' ? { LF_MAPPING_OBJECT: '' } : {}
    if (bakedUv) m.defines.LF_BAKE_UV = bakedUv
    const stage = splitVertexStage(doc.code)
    const metric = doc.id === BUILTIN_PREFIX + 'blockout'
    const metricPrelude = metric ? 'attribute vec2 lfBlockUV; attribute vec2 lfBlockSize; varying vec2 vLfBlockMetricUV; varying vec2 vLfBlockMetricSize;\n' : ''
    const metricBody = metric ? '\n vLfBlockMetricUV = lfBlockUV; vLfBlockMetricSize = lfBlockSize;\n' : ''
    const metricFrag = metric ? 'varying vec2 vLfBlockMetricUV; varying vec2 vLfBlockMetricSize; uniform bool uLfBlockFaces; uniform sampler2D uLfBlockFont;\n' : ''
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, st.uniforms, { uLfTime: LF_TIME })
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', PRELUDE_VERT + metricPrelude + (stage.vert ? VERT_USER_PRELUDE + uniformDecls(info) + '\n' + stage.vert + '\n' : '') + 'void main() {')
        .replace('#include <begin_vertex>', '#include <begin_vertex>' + VERT_BODY + metricBody)
      if (stage.vert) shader.vertexShader = shader.vertexShader.replace('#include <displacementmap_vertex>', '#include <displacementmap_vertex>' + vertApply(!/@normals\s+off/.test(stage.vert)))
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', PRELUDE_FRAG + metricFrag + uniformDecls(info) + '\n//LF_USER_BEGIN\n' + stripParamUniforms(stage.frag) + '\nvoid main() {')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>' + FRAG_BEGIN)
        .replace('#include <aomap_fragment>', '#include <aomap_fragment>' + FRAG_AO)
      injectProbes(shader, m)
      injectPsx(shader, m)
      injectRoadPaint(shader, m)
    }
    // sombras: los materiales de profundidad/distancia de three no conocen vertex(); se les da una copia con el mismo desplazamiento
    if (stage.vert) {
      const mk = (mat) => {
        mat.onBeforeCompile = (sh) => {
          Object.assign(sh.uniforms, st.uniforms, { uLfTime: LF_TIME })
          sh.vertexShader = sh.vertexShader
            .replace('void main() {', VERT_USER_PRELUDE + uniformDecls(info) + '\n' + stage.vert + '\nvoid main() {')
            .replace('#include <displacementmap_vertex>', '#include <displacementmap_vertex>' + VERT_APPLY_DEPTH)
        }
        mat.customProgramCacheKey = () => `lfshadow|${key}`
        return mat
      }
      st.depthMat = mk(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }))
      st.distMat = mk(new THREE.MeshDistanceMaterial())
    }
    m.customProgramCacheKey = () => `lf|${key}|${iblDiffuse() ? 'ibl' : 'cls'}${m.userData.rtShArr ? '|sh' : ''}${m.userData.rtPsx ? '|psx' : ''}${m.userData.rtRoadPaint ? '|roadpaint' : ''}`
    m.needsUpdate = true
  }
  if (st.uniforms.uLfBlockFaces) st.uniforms.uLfBlockFaces.value = !!m.userData.lfBlockFaces
  if (previousPsx !== psx) m.needsUpdate = true
  for (const p of info.params) {
    let raw = obj.mat?.params?.[p.key]
    if (detail && doc.id === 'builtin:realista') {
      // Prioridad exclusiva del nuevo Inspector. Sin surfaceDetail, respetar 100 % los params antiguos.
      if (p.key === 'uNormal') raw = detail.mode === 'normal' ? detail.texture : ''
      if (p.key === 'uHeight') raw = detail.mode === 'height' ? detail.texture : ''
      if (p.key === 'uNormalStrength' || p.key === 'uBumpStrength') raw = detail.strength
      if (p.key === 'uMicro') raw = detail.mode === 'none' ? 0 : detail.micro
      if (p.key === 'uMicroScale') raw = detail.microScale
    }
    const u = st.uniforms[p.uniform]
    if (p.glsl === 'sampler2D') {
      const tex = raw && env.getMap ? env.getMap(raw, p.srgb) : null
      u.value = tex || WHITE
      st.uniforms[p.uniform + '_set'].value = !!tex
    } else if (p.glsl === 'vec3') u.value.copy(toLinear(raw !== undefined ? raw : p.type === 'color' ? p.defHex : p.def))
    else if (p.glsl === 'bool') u.value = raw !== undefined ? !!raw : p.def
    else u.value = Number.isFinite(+raw) && raw !== undefined && raw !== '' ? +raw : p.def
  }
  return info
}

/** Asigna a las mallas del nodo los materiales de sombra del shader (si tiene etapa de vértices) o los quita. Llamar tras syncPbrMaterial. */
export function applyShadowMats(root) {
  const m = root.userData.mat, st = m?.userData.rt
  const d = st?.depthMat || undefined, c = st?.distMat || undefined // three exige undefined (no null) para usar su material de sombra por defecto
  root.traverse((o) => { if (o.isMesh && o.material === m && (o.customDepthMaterial !== d || o.customDistanceMaterial !== c)) { o.customDepthMaterial = d; o.customDistanceMaterial = c } })
}

/** Valores por defecto de las propiedades de un shader (para la interfaz). */
export function paramValue(info, params, p) {
  const v = params?.[p.key]
  if (v !== undefined) return v
  return p.type === 'color' ? p.defHex : p.def
}

/**
 * Compila el shader en una escena mínima y devuelve el mensaje de error de GLSL ('' si compila).
 * Hay que dibujar de verdad: three comprueba los errores en el primer uso del programa.
 */
export function checkShader(renderer, code) {
  const info = infoOf(code)
  if (!/void\s+surface\s*\(\s*inout\s+Surface\s+\w+\s*\)/.test(code)) return 'Falta la función  void surface(inout Surface s)'
  let err = ''
  const dbg = renderer.debug, prev = [dbg.checkShaderErrors, dbg.onShaderError]
  dbg.checkShaderErrors = true
  dbg.onShaderError = (gl, program, vs, fs) => {
    const log = gl.getShaderInfoLog(fs) || gl.getShaderInfoLog(vs) || gl.getProgramInfoLog(program) || 'Error de compilación'
    // el log habla del código completo: se traduce a la línea del código del usuario con la marca //LF_USER_BEGIN
    const marker = (gl.getShaderSource(fs) || '').split('\n').findIndex((l) => l.includes('//LF_USER_BEGIN')) + 1
    err = log.split('\n').filter((l) => /ERROR/.test(l)).map((l) => l.replace(/^ERROR:\s*\d+:(\d+):/, (_, n) => (marker && +n > marker ? `línea ${+n - marker}:` : `(motor, línea ${n}):`))).slice(0, 4).join('\n') || log
  }
  const mat = makePbrMaterial()
  const obj = { color: '#ffffff', roughness: 0.5, metallic: 0, opacity: 1, mat: { shader: '__check__' } }
  const fake = { shaders: [{ id: '__check__', name: 'check', code }], look: 'realista' }
  syncPbrMaterial(mat, obj, fake)
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera()
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat), new THREE.AmbientLight())
  cam.position.z = 2
  const rt = new THREE.WebGLRenderTarget(2, 2)
  const old = renderer.getRenderTarget()
  try { renderer.setRenderTarget(rt); renderer.render(scene, cam) } catch (e) { err = err || String(e.message || e) } finally { renderer.setRenderTarget(old) }
  rt.dispose(); mat.dispose(); scene.traverse((o) => o.geometry?.dispose())
  dbg.checkShaderErrors = prev[0]; dbg.onShaderError = prev[1]
  void info
  return err
}
