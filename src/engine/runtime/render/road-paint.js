// Máscaras de materiales de carretera: tres capas sobre el material PBR existente.
// El proyecto guarda trazos vectoriales compactos; la textura GPU se reconstruye bajo demanda.
import * as THREE from 'three'

import { ROAD_PAINT_RES, normalizeRoadPaint, rasterRoadPaint } from '../geometry/road-paint.js'
export { ROAD_PAINT_RES, ROAD_PAINT_MAX_STROKES, ROAD_PAINT_MAX_POINTS, normalizeRoadPaint, rasterRoadPaint } from '../geometry/road-paint.js'
const C = 3
const clamp = (n, a, b) => Math.max(a, Math.min(b, Number.isFinite(+n) ? +n : a))

function resolvedLayer(layer, mats, env) {
  const resource = mats?.find((m) => m.id === layer.materialId)
  if (!resource) return null
  const id = resource.mat?.shader || ''
  // No falsear shaders arbitrarios: la mezcla soporta datos PBR, no programas personalizados.
  if (id && !['builtin:realista', 'builtin:blockout'].includes(id)) return null
  const texture = resource.mat?.params?.uAlbedo || null
  const detail = resource.mat?.surfaceDetail
  const normalId = detail?.mode === 'normal' ? detail.texture : (id === 'builtin:realista' ? resource.mat?.params?.uNormal : null)
  return {
    color: new THREE.Color(resource.color || '#ffffff'),
    roughness: clamp(resource.roughness ?? 1, 0, 1),
    map: texture && env.getMap ? env.getMap(texture, true) : null,
    normal: normalId && env.getMap ? env.getMap(normalId, false) : null,
    strength: clamp(detail?.strength ?? resource.mat?.params?.uNormalStrength ?? 1, 0, 2),
    tile: layer.tile,
  }
}

/** Reutiliza el material que ya crea syncPbrMaterial; inyecta mezcla sin sustituir su shader. */
export function updateRoadPaint(m, paint, slot, dimensions, env) {
  const layers = normalizeRoadPaint(paint)[slot] || []
  const valid = layers.map((l) => resolvedLayer(l, env.materials, env))
  const active = layers.some((l, i) => l.visible && valid[i] && l.strokes.length)
  const old = m.userData.rtRoadPaint
  const signature = valid.map((v) => !!v).join(',')
  const paintSignature = JSON.stringify([paint, dimensions, layers.map((l) => env.materials?.find((m) => m.id === l.materialId)), valid.map((v) => [v?.map?.uuid || '', v?.normal?.uuid || ''])])
  if (old?.paintSignature === paintSignature && old.signature === signature) return
  if (!active) {
    if (old) { old.mask.dispose(); m.userData.rtRoadPaint = null; m.needsUpdate = true }
    return
  }
  const bytes = rasterRoadPaint(paint, slot, dimensions)
  let mask = old?.mask
  if (!mask) {
    mask = new THREE.DataTexture(bytes, ROAD_PAINT_RES[0], ROAD_PAINT_RES[1], THREE.RGBAFormat)
    mask.wrapS = THREE.ClampToEdgeWrapping
    mask.wrapT = dimensions.closed ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping
    mask.magFilter = THREE.LinearFilter
    mask.minFilter = THREE.LinearFilter
    mask.generateMipmaps = false
    mask.needsUpdate = true
  } else {
    mask.image.data = bytes
    mask.wrapT = dimensions.closed ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping
    mask.needsUpdate = true
  }
  const uniforms = old?.signature === signature ? old.uniforms : null
  if (uniforms) {
    uniforms.uLfRoadMask.value = mask
    valid.forEach((v, i) => {
      if (!v) return
      for (const [key, value] of Object.entries({
        [`uLfRoadColor${i}`]: v.color, [`uLfRoadRough${i}`]: v.roughness,
        [`uLfRoadTile${i}`]: v.tile, [`uLfRoadTex${i}`]: v.map || mask,
        [`uLfRoadHasTex${i}`]: !!v.map, [`uLfRoadNormal${i}`]: v.normal || mask,
        [`uLfRoadHasNormal${i}`]: !!v.normal, [`uLfRoadNormalStrength${i}`]: v.strength,
      })) if (uniforms[key]) uniforms[key].value = value
    })
  }
  m.userData.rtRoadPaint = { mask, layers: valid, signature, paintSignature, uniforms }
  if (!old || old.signature !== signature) m.needsUpdate = true
}

/** Se llama desde la única ruta de compilación PBR para preservar Blockout y Realista. */
export function injectRoadPaint(shader, m) {
  const data = m.userData.rtRoadPaint
  if (!data) return
  data.uniforms ||= { uLfRoadMask: { value: data.mask } }
  shader.uniforms.uLfRoadMask = data.uniforms.uLfRoadMask
  const u = 'uniform sampler2D uLfRoadMask; varying vec2 vLfRoadPaintUv; varying vec2 vLfRoadMetricUv;\n'
  const defines = []
  let diffuse = '', rough = '', normals = ''
  for (let i = 0; i < C; i++) {
    const lyr = data.layers[i]
    if (!lyr) continue
    shader.uniforms[`uLfRoadColor${i}`] = data.uniforms[`uLfRoadColor${i}`] ||= { value: lyr.color }
    shader.uniforms[`uLfRoadRough${i}`] = data.uniforms[`uLfRoadRough${i}`] ||= { value: lyr.roughness }
    shader.uniforms[`uLfRoadTile${i}`] = data.uniforms[`uLfRoadTile${i}`] ||= { value: lyr.tile }
    shader.uniforms[`uLfRoadTex${i}`] = data.uniforms[`uLfRoadTex${i}`] ||= { value: lyr.map || data.mask }
    shader.uniforms[`uLfRoadHasTex${i}`] = data.uniforms[`uLfRoadHasTex${i}`] ||= { value: !!lyr.map }
    shader.uniforms[`uLfRoadNormal${i}`] = data.uniforms[`uLfRoadNormal${i}`] ||= { value: lyr.normal || data.mask }
    shader.uniforms[`uLfRoadHasNormal${i}`] = data.uniforms[`uLfRoadHasNormal${i}`] ||= { value: !!lyr.normal }
    shader.uniforms[`uLfRoadNormalStrength${i}`] = data.uniforms[`uLfRoadNormalStrength${i}`] ||= { value: lyr.strength }
    defines.push(`uniform vec3 uLfRoadColor${i}; uniform float uLfRoadRough${i}; uniform float uLfRoadTile${i}; uniform sampler2D uLfRoadTex${i}; uniform bool uLfRoadHasTex${i}; uniform sampler2D uLfRoadNormal${i}; uniform bool uLfRoadHasNormal${i}; uniform float uLfRoadNormalStrength${i};`)
    const c = 'rgb'[i]
    const uv = `(vLfRoadMetricUv / max(0.2, uLfRoadTile${i}))`
    const a = `lfRoadMask.${c}`
    diffuse += `diffuseColor.rgb = mix(diffuseColor.rgb, uLfRoadColor${i} * (uLfRoadHasTex${i} ? texture2D(uLfRoadTex${i}, ${uv}).rgb : vec3(1.0)), ${a});\n`
    rough += `roughnessFactor = mix(roughnessFactor, uLfRoadRough${i}, ${a});\n`
    normals += `if (uLfRoadHasNormal${i} && ${a} > 0.001) { vec3 tn = texture2D(uLfRoadNormal${i}, ${uv}).xyz * 2.0 - 1.0; tn.xy *= uLfRoadNormalStrength${i}; normal = normalize(mix(normal, lfRoadNormal(tn, ${uv}, normal), ${a})); }\n`
  }
  const aMetric = shader.vertexShader.includes('attribute vec2 lfBlockUV;') ? '' : 'attribute vec2 lfBlockUV; '
  shader.vertexShader = aMetric + 'attribute vec2 lfPaintUV; varying vec2 vLfRoadPaintUv; varying vec2 vLfRoadMetricUv;\n' + shader.vertexShader
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n vLfRoadPaintUv = lfPaintUV; vLfRoadMetricUv = lfBlockUV;')
  shader.fragmentShader = u + defines.join('\n') + `\nvec3 lfRoadNormal(vec3 tangentNormal, vec2 uv, vec3 baseNormal) {
   vec3 q0 = dFdx(-vViewPosition), q1 = dFdy(-vViewPosition);
   vec2 s0 = dFdx(uv), s1 = dFdy(uv);
   vec3 S = q0 * s1.y - q1 * s0.y;
   vec3 T = -q0 * s1.x + q1 * s0.x;
   float den = max(1e-5, dot(S,S) * dot(T,T));
   return normalize(S * tangentNormal.x + T * tangentNormal.y + baseNormal * tangentNormal.z * sqrt(den));
}\n` + shader.fragmentShader
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n vec4 lfRoadMask = texture2D(uLfRoadMask, vLfRoadPaintUv);\n' + diffuse)
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + rough)
    .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + normals)
}
