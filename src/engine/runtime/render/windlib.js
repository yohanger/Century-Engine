// Viento sobre la vegetación: UN conjunto de uniformes global (hora del viento, dirección, velocidad, rachas) y un parche de material
// que mece los vértices en la GPU. El terreno no sabe de clima: el mundo (core/world) llama a setWind() cada fotograma y todo lo que
// lleva el parche (hierba, flores, arbustos, árboles, modelos importados) se mueve a la vez, sin tocar el CPU por instancia.
//
//  · La racha es una onda que viaja en la dirección del viento (fase = posición · dirección − tiempo): se ve avanzar por el campo.
//  · La flexión crece con el cuadrado de la altura relativa del vértice (la base no se mueve, la punta sí): hierba «cimbrea», un árbol
//    apenas se inclina y su copa aletea (flutter, de alta frecuencia y poca amplitud).
//  · Con `uWOn = 0` (editor sin clima animado) todo queda quieto en su posición natural.
import * as THREE from 'three'

export const WINDU = {
  uWTime: { value: 0 },
  uWDir: { value: new THREE.Vector2(1, 0) },   // hacia dónde sopla (unitario, ejes del motor x, z)
  uWSpeed: { value: 0 },                       // m/s
  uWGust: { value: 0.35 },                     // 0–1
  uWOn: { value: 0 },                          // 1 = animado
}

/** Pone el viento global. `x`, `z` = velocidad en m/s (World.frame().wind). */
export function setWind({ time = 0, x = 0, z = 0, gust = 0.35, on = true } = {}) {
  const sp = Math.hypot(x, z)
  WINDU.uWTime.value = time
  WINDU.uWSpeed.value = sp
  if (sp > 1e-3) WINDU.uWDir.value.set(x / sp, z / sp)
  WINDU.uWGust.value = gust
  WINDU.uWOn.value = on ? 1 : 0
}

const DECL = /* glsl */`
uniform float uWTime, uWSpeed, uWGust, uWOn, uWHeight, uWBend, uWFlutter; uniform vec2 uWDir;
`
const BODY = /* glsl */`
#include <begin_vertex>
#ifdef USE_INSTANCING
if (uWOn > 0.5 && uWBend + uWFlutter > 0.0) {
  vec2 iw = instanceMatrix[3].xz;
  float hf = clamp(position.y / uWHeight, 0.0, 1.0);
  float sp = uWSpeed;
  float front = 0.5 + 0.5 * sin(dot(iw, uWDir) * 0.21 - uWTime * (0.8 + sp * 0.16));   // frente de racha que avanza
  float local = sp * (1.0 - uWGust * 0.6 + uWGust * 1.2 * front);
  float amp = uWBend * hf * hf * min(local, 24.0) * 0.05;
  float osc = sin(uWTime * (1.6 + sp * 0.11) + iw.x * 1.31 + iw.y * 0.93 + position.x * 2.7);
  vec2 d = uWDir * amp * (1.0 + 0.22 * osc) + vec2(-uWDir.y, uWDir.x) * amp * 0.16 * osc;
  float fl = uWFlutter * hf * sin(uWTime * (7.0 + sp * 0.6) + position.x * 9.0 + position.z * 7.0 + iw.x) * min(sp, 14.0) * 0.006;
  vec3 disp = vec3(d.x + fl, -amp * amp * 0.35, d.y + fl * 0.7);
  mat3 im = mat3(instanceMatrix);
  transformed += (disp * im) / max(1e-4, dot(im[0], im[0]));   // de mundo a local (giro y escala de la instancia)
}
#endif
`

/**
 * Parchea un material (MeshStandard…) para que se mueva con el viento. `cfg` = { height (m, vértice más alto), bend, flutter }:
 * bend ~1 = hierba, ~0.2 = árbol; flutter = aleteo de hojas. Llamar otra vez con otro cfg actualiza los valores en vivo.
 */
export function applyWind(mat, cfg) {
  const u = (mat.userData.windU ||= { uWHeight: { value: 1 }, uWBend: { value: 0 }, uWFlutter: { value: 0 } })
  u.uWHeight.value = Math.max(0.05, cfg.height || 1); u.uWBend.value = cfg.bend || 0; u.uWFlutter.value = cfg.flutter || 0
  if (mat.userData.windPatched) return mat
  mat.userData.windPatched = true
  const prev = mat.onBeforeCompile
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer)
    Object.assign(shader.uniforms, WINDU, u)
    shader.vertexShader = DECL + shader.vertexShader.replace('#include <begin_vertex>', BODY)
  }
  const key = mat.customProgramCacheKey?.bind(mat)
  mat.customProgramCacheKey = () => (key ? key() : '') + '|rt-wind'
  mat.needsUpdate = true
  return mat
}

/** Alto del vértice más alto de una geometría (para `height`). */
export function geometryHeight(geo) {
  if (!geo.boundingBox) geo.computeBoundingBox()
  return Math.max(0.1, geo.boundingBox.max.y)
}
