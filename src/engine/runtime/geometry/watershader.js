// Agua · shader: parchea el material físico con las olas Gerstner, las ondas de interacción y la espuma. Ver water.js (parámetros y olas).
import * as THREE from 'three'
import { RIPPLE_GLSL, RIPPLES } from './waterripple.js'
import { waveSet } from './water.js'

// ---------------------------------------------------------------------------------------------
// GLSL (editor)
// ---------------------------------------------------------------------------------------------
const WAVE_UNIFORMS = `
uniform float rtTime;
uniform vec4 rtBig[3];   // dx, dz, k, amp
uniform vec3 rtBigP[3];  // omega, fase, _
uniform vec4 rtFine[3];
uniform vec3 rtFineP[3];
uniform float rtFaceted;
uniform vec3 rtShallow;
uniform vec3 rtDeep;
uniform float rtOpacity;
uniform float rtFoam;
uniform float rtTotalAmp;
uniform sampler2D rtTex;
uniform float rtTexOn; // 0 ninguna · 1 color · 2 normal
uniform float rtTexScale;
uniform float rtTexSpeed;
uniform float rtTexStrength;
uniform vec2 rtWind;
uniform sampler2D rtWM;
uniform vec4 rtWMp;    // tamaño del mapa (m), profundidad máx., activo
uniform vec3 rtWFx;    // claridad, espuma de orilla, ancho de la espuma
uniform vec3 rtFlowM;  // corriente fija (x, z en m/s) y velocidad del río (la dirección viene en el atributo rtAFlow)
`
const WAVE_FUNCS = `
vec3 rtWaves(vec2 p, bool fine, out float h) {
  float hh = 0.0; vec2 g = vec2(0.0);
  for (int i = 0; i < 3; i++) {
    vec4 w = fine ? rtFine[i] : rtBig[i];
    vec3 q = fine ? rtFineP[i] : rtBigP[i];
    float ph = w.z * dot(w.xy, p) - q.x * rtTime + q.y;
    hh += w.w * sin(ph);
    g += w.w * w.z * cos(ph) * w.xy;
  }
  h = hh;
  return vec3(g.x, 0.0, g.y);
}
// Corriente: el dibujo se arrastra con el agua. Dos capas desfasadas medio ciclo se mezclan (la del reinicio pesa 0), así nada se estira ni salta.
const float RT_CYCLE = 3.3;
vec3 rtFineFlow(vec2 p, out float h) {
  if (dot(rtVFlow, rtVFlow) < 1e-4) return rtWaves(p, true, h);
  float t = rtTime / RT_CYCLE; float f0 = fract(t), f1 = fract(t + 0.5);
  float w0 = 1.0 - abs(1.0 - 2.0 * f0);
  float h0, h1;
  vec3 g0 = rtWaves(p - rtVFlow * (f0 * RT_CYCLE), true, h0);
  vec3 g1 = rtWaves(p - rtVFlow * (f1 * RT_CYCLE), true, h1);
  h = mix(h1, h0, w0);
  return mix(g1, g0, w0);
}
vec4 rtTexAt(vec2 wp) {
  vec2 base = wp / rtTexScale + rtWind * rtTime * rtTexSpeed;
  if (dot(rtVFlow, rtVFlow) < 1e-4) return texture2D(rtTex, base);
  float t = rtTime / RT_CYCLE; float f0 = fract(t), f1 = fract(t + 0.5);
  float w0 = 1.0 - abs(1.0 - 2.0 * f0);
  vec2 d = rtVFlow * RT_CYCLE / rtTexScale;
  return mix(texture2D(rtTex, base - d * f1), texture2D(rtTex, base - d * f0), w0);
}
`

export function patchWaterMaterial(mat, u, { simulated = false } = {}) {
  mat.userData.rt = u
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${WAVE_UNIFORMS}\nvarying vec2 rtVFlow;\nattribute vec2 rtAFlow;\n${WAVE_FUNCS}\nvarying vec3 rtWPos;${simulated ? "\nvarying float rtSimDepth;\nattribute float rtWaterDepth;\nvarying float rtSimFoamV;\nattribute float rtSimFoam;" : ""}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 rtW0 = (modelMatrix * vec4(transformed, 1.0)).xyz;
        float rtD = distance(rtW0, cameraPosition);
        float rtH; rtWaves(rtW0.xz, false, rtH);
        transformed.y += ${simulated ? "0.0" : "rtH * (1.0 - smoothstep(120.0, 400.0, rtD))"};
        rtWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        rtVFlow = ${simulated ? "rtAFlow" : "rtFlowM.xy + rtFlowM.z * (modelMatrix * vec4(rtAFlow.x, 0.0, rtAFlow.y, 0.0)).xz"};
        ${simulated ? "rtSimDepth = rtWaterDepth; rtSimFoamV = rtSimFoam;" : ""}`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${WAVE_UNIFORMS}\nvarying vec2 rtVFlow;\n${WAVE_FUNCS}\n${RIPPLE_GLSL}
varying vec3 rtWPos;${simulated ? "\nvarying float rtSimDepth;\nvarying float rtSimFoamV;" : ""}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float rtHb; rtWaves(rtWPos.xz, false, rtHb);
        float rtRpf; vec2 rtRpg = rtRipples(rtWPos.xz, rtRpf); // ondas de interacción: gradiente y espuma
        float rtHn = ${simulated ? "clamp(rtSimDepth / max(rtWFx.x, 0.05), 0.0, 1.0)" : "clamp(rtHb / max(rtTotalAmp, 0.0001) * 0.5 + 0.5, 0.0, 1.0)"};
        vec3 rtAlb = mix(rtDeep, rtShallow, rtHn);
        float rtF = rtFoam > 0.001 ? smoothstep(1.0 - 0.5 * rtFoam, 1.0, rtHn) : 0.0;
        ${simulated ? 'rtF = max(rtF, rtSimFoamV * 0.55);' : ''}
        rtAlb = mix(rtAlb, vec3(1.0), rtF);
        vec4 rtT = rtTexAt(rtWPos.xz);
        if (rtTexOn > 0.5 && rtTexOn < 1.5) rtAlb = mix(rtAlb, rtT.rgb, rtTexStrength);
        float rtDepth = ${simulated ? "max(rtSimDepth, 0.0)" : "1000.0"};
        if (${simulated ? "false" : "true"} && rtWMp.z > 0.5) {
          vec2 rtMuv = rtWPos.xz / rtWMp.x + 0.5;
          if (rtMuv.x > 0.0 && rtMuv.x < 1.0 && rtMuv.y > 0.0 && rtMuv.y < 1.0) {
            float rtS = (texture2D(rtWM, rtMuv).r - 0.5) * 2.0;
            rtDepth = max(sign(rtS) * rtS * rtS * rtWMp.y, 0.0);
          }
        }
        float rtOn = ${simulated ? "1.0" : "rtWMp.z"};
        float rtDT = smoothstep(0.0, max(rtWFx.x, 0.05), rtDepth);
        rtAlb = mix(rtAlb, mix(rtShallow, rtDeep, rtDT), 0.75 * rtOn);
        float rtA0 = rtOpacity * mix(1.0, mix(0.55, 1.0, rtDT) * smoothstep(0.0, 0.25, rtDepth), rtOn);
        float rtSw = max(rtWFx.z, 0.05);
        float rtSf = rtOn * rtWFx.y * (1.0 - smoothstep(0.0, rtSw, rtDepth)) * (0.6 + 0.4 * sin(rtDepth / rtSw * 9.0 - rtTime * 1.3 + rtHb / max(rtTotalAmp, 0.0001) * 3.0));
        rtAlb = mix(rtAlb, vec3(1.0), rtSf);
        rtAlb = mix(rtAlb, vec3(1.0), rtRpf * 0.8);
        diffuseColor = vec4(rtAlb, max(max(rtA0, rtF), max(rtSf * 0.85 * smoothstep(0.0, 0.03, rtDepth), rtRpf * 0.7)));
        if (!gl_FrontFacing) diffuseColor = vec4(mix(rtDeep, rtShallow, 0.3), max(diffuseColor.a, 0.88)); // vista desde abajo: techo de agua`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
        {
          float rtDist = distance(rtWPos, cameraPosition);
          float rtA; vec3 rtG = rtWaves(rtWPos.xz, false, rtA);
          float rtB; vec3 rtR = rtFineFlow(rtWPos.xz, rtB);
          vec3 rtGg = rtG * (1.0 - 0.6 * smoothstep(200.0, 800.0, rtDist)) + rtR * (1.0 - smoothstep(60.0, 220.0, rtDist));
          if (rtTexOn > 1.5) {
            vec3 tn = rtTexAt(rtWPos.xz).xyz * 2.0 - 1.0;
            rtGg.xz += -tn.xy * rtTexStrength * (1.0 - smoothstep(60.0, 220.0, rtDist));
          }
          rtGg.xz += rtRpg * (1.0 - smoothstep(40.0, 140.0, rtDist));
          vec3 rtN = normalize(vec3(-rtGg.x, 1.0, -rtGg.z));
          if (${simulated ? "true" : "rtFaceted > 0.5"}) { rtN = normalize(cross(dFdx(rtWPos), dFdy(rtWPos))); if (rtN.y < 0.0) rtN = -rtN; }
          if (!gl_FrontFacing) rtN = -rtN;
          normal = normalize((viewMatrix * vec4(rtN, 0.0)).xyz);
        }`)
  }
  mat.customProgramCacheKey = () => simulated ? 'lfwater-sim' : 'lfwater'
}

const v4 = (o) => new THREE.Vector4(o.dx, o.dz, o.k, o.amp)
const v3 = (o) => new THREE.Vector3(o.om, o.ph, 0)

export function makeWaterUniforms() {
  return {
    rtRip: { value: RIPPLES }, // la misma lista para todas las aguas (geometry/waterripple.js)
    rtTime: { value: 0 }, rtBig: { value: [0, 1, 2].map(() => new THREE.Vector4()) }, rtBigP: { value: [0, 1, 2].map(() => new THREE.Vector3()) },
    rtFine: { value: [0, 1, 2].map(() => new THREE.Vector4()) }, rtFineP: { value: [0, 1, 2].map(() => new THREE.Vector3()) },
    rtFaceted: { value: 0 }, rtShallow: { value: new THREE.Color() }, rtDeep: { value: new THREE.Color() }, rtOpacity: { value: 1 }, rtFoam: { value: 0 }, rtTotalAmp: { value: 1 },
    rtWM: { value: null }, rtWMp: { value: new THREE.Vector4(64, 24, 0, 0) }, rtWFx: { value: new THREE.Vector3(6, 0.6, 1) },
    rtFlowM: { value: new THREE.Vector3() },
    rtTex: { value: null }, rtTexOn: { value: 0 }, rtTexScale: { value: 8 }, rtTexSpeed: { value: 0.3 }, rtTexStrength: { value: 0.6 }, rtWind: { value: new THREE.Vector2() },
  }
}

export function setWaterUniforms(u, w, tex) {
  const s = waveSet(w)
  s.big.forEach((o, i) => { u.rtBig.value[i].copy(v4(o)); u.rtBigP.value[i].copy(v3(o)) })
  s.fine.forEach((o, i) => { u.rtFine.value[i].copy(v4(o)); u.rtFineP.value[i].copy(v3(o)) })
  u.rtFaceted.value = w.faceted ? 1 : 0
  u.rtShallow.value.set(w.color); u.rtDeep.value.set(w.deepColor)
  u.rtOpacity.value = w.opacity
  u.rtFoam.value = w.foam
  u.rtWFx.value.set(w.clarity, w.shoreFoam, w.shoreWidth)
  u.rtTotalAmp.value = s.big.reduce((a, o) => a + o.amp, 0) || 1
  u.rtTex.value = tex || null
  u.rtTexOn.value = tex ? (w.textureMode === 'normal' ? 2 : 1) : 0
  u.rtTexScale.value = Math.max(0.1, w.textureScale)
  u.rtTexSpeed.value = w.textureSpeed
  const a = (w.windDir * Math.PI) / 180
  u.rtWind.value.set(Math.cos(a), Math.sin(a))
  u.rtTexStrength.value = w.textureStrength
  const fs = Math.max(0, w.flowSpeed || 0), fd = ((w.flowDir || 0) * Math.PI) / 180
  if (w.shape === 'river') u.rtFlowM.value.set(0, 0, fs); else u.rtFlowM.value.set(Math.cos(fd) * fs, Math.sin(fd) * fs, 0)
}
