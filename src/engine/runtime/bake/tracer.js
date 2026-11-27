// Shaders del baking: g-buffer en espacio UV, path tracer de lightmaps y de sondas SH (sobre un BVH de three-mesh-bvh).
import * as THREE from 'three'
import { BVHShaderGLSL } from 'three-mesh-bvh'

export const MAX_BAKE_LIGHTS = 16

export const SH_GLSL = /* glsl */`
float rtY(int i, vec3 d) {
  float x = d.x, y = d.y, z = d.z;
  if (i == 0) return 0.282095;
  if (i == 1) return 0.488603 * y;
  if (i == 2) return 0.488603 * z;
  if (i == 3) return 0.488603 * x;
  if (i == 4) return 1.092548 * x * y;
  if (i == 5) return 1.092548 * y * z;
  if (i == 6) return 0.315392 * (3.0 * z * z - 1.0);
  if (i == 7) return 1.092548 * x * z;
  return 0.546274 * (x * x - y * y);
}`

/** Misma base SH que el GLSL (para evaluar en CPU y en los tests). */
export function shBasis(d) {
  const [x, y, z] = d
  return [0.282095, 0.488603 * y, 0.488603 * z, 0.488603 * x, 1.092548 * x * y, 1.092548 * y * z, 0.315392 * (3 * z * z - 1), 1.092548 * x * z, 0.546274 * (x * x - y * y)]
}

/** Irradiancia (convolución con coseno) a partir de coeficientes de radiancia SH. c: 9 × [r,g,b]. */
export function shIrradiance(c, n) {
  const Y = shBasis(n), A = [Math.PI, 2 * Math.PI / 3, 2 * Math.PI / 3, 2 * Math.PI / 3, Math.PI / 4, Math.PI / 4, Math.PI / 4, Math.PI / 4, Math.PI / 4]
  const o = [0, 0, 0]
  for (let i = 0; i < 9; i++) for (let k = 0; k < 3; k++) o[k] += A[i] * Y[i] * c[i][k]
  return o
}

/** Trozo de GLSL que usa el material en juego para evaluar las sondas (ver pbr.js · injectProbes). */
export const SH_RUNTIME_GLSL = SH_GLSL + /* glsl */`
uniform vec3 uLfSH[9];
vec3 rtShIrradiance(vec3 n) {
  vec3 o = vec3(0.0);
  o += 3.141593 * rtY(0, n) * uLfSH[0];
  for (int i = 1; i < 4; i++) o += 2.094395 * rtY(i, n) * uLfSH[i];
  for (int i = 4; i < 9; i++) o += 0.785398 * rtY(i, n) * uLfSH[i];
  return max(o, vec3(0.0));
}`

export const GBUF_VERT = /* glsl */`
attribute vec2 lmuv;
varying vec3 vWP; varying vec3 vN;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz; vN = normalize(transpose(inverse(mat3(modelMatrix))) * normal);
  gl_Position = vec4(lmuv * 2.0 - 1.0, 0.0, 1.0);
}`
export const GBUF_FRAG = /* glsl */`
precision highp float;
layout(location = 0) out highp vec4 gPos;
layout(location = 1) out highp vec4 gNor;
in vec3 vWP; in vec3 vN;
void main() { gPos = vec4(vWP, 1.0); gNor = vec4(normalize(vN), 0.0); }`

const L = MAX_BAKE_LIGHTS
export const TRACE_VERT = 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }'

export const TRACE_FRAG = /* glsl */`
precision highp float; precision highp int; precision highp sampler2D; precision highp isampler2D; precision highp usampler2D;
${BVHShaderGLSL.common_functions}
${BVHShaderGLSL.bvh_struct_definitions}
${BVHShaderGLSL.bvh_ray_functions}
${SH_GLSL}
uniform BVH bvh;
uniform sampler2D tAlbedo, tEmission, tPos, tNor, tProbes;
uniform samplerCube tSky;
uniform sampler2D tPrev;
void outc(vec3 c) { gl_FragColor = vec4(c, 1.0) + texelFetch(tPrev, ivec2(gl_FragCoord.xy), 0); }
uniform float uSkyI, uSkyMax, uSeed, uEps, uLightRadius, uSunAngle;
uniform vec3 uAmbient;
uniform int uSpp, uBounces, uNL;
uniform vec3 uLPos[${L}], uLDir[${L}], uLCol[${L}];
uniform vec4 uLInfo[${L}];      // x tipo (0 punto, 1 foco, 2 sol) · y rango · z cos exterior · w cos interior
uniform vec4 uLFlag[${L}];      // x 1 = su luz directa se hornea en el receptor (modo estático) · 0 = mixta (sólo rebotes)
const float PI = 3.141592653589793;
uint rs;
uint pcg(uint v) { uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
float rnd() { rs = pcg(rs); return float(rs) / 4294967295.0; }
vec3 cosDir(vec3 n) {
  float u1 = rnd(), u2 = rnd(), r = sqrt(u1), ph = 6.2831853 * u2;
  vec3 t = normalize(abs(n.y) < 0.99 ? cross(n, vec3(0, 1, 0)) : cross(n, vec3(1, 0, 0))); vec3 b = cross(n, t);
  return normalize(t * r * cos(ph) + b * r * sin(ph) + n * sqrt(1.0 - u1));
}
vec3 sphereDir() { float z = 1.0 - 2.0 * rnd(), a = 6.2831853 * rnd(), r = sqrt(max(0.0, 1.0 - z * z)); return vec3(r * cos(a), r * sin(a), z); }
vec3 skyL(vec3 d) { return min(texture(tSky, d).rgb, vec3(uSkyMax)) * uSkyI + uAmbient / PI; }

bool hitScene(vec3 ro, vec3 rd, out vec3 pos, out vec3 n, out vec3 alb, out vec3 emission, out float dist) {
  uvec4 fi; vec3 fn, bc; float side;
  if (!bvhIntersectFirstHit(bvh, ro, rd, fi, fn, bc, side, dist)) return false;
  pos = ro + rd * dist; n = fn;
  alb = clamp(textureSampleBarycoord(tAlbedo, bc, fi.xyz).rgb, 0.0, 0.98);
  vec4 e = textureSampleBarycoord(tEmission, bc, fi.xyz);
  emission = side > 0.0 || e.w > 0.5 ? e.rgb : vec3(0.0);
  return true;
}
bool occluded(vec3 ro, vec3 rd, float maxD) {
  uvec4 fi; vec3 fn, bc; float side, dist;
  return bvhIntersectFirstHit(bvh, ro, rd, fi, fn, bc, side, dist) && dist < maxD;
}

float spotFalloff(int light, vec3 l) {
  float angle = dot(-l, uLDir[light]);
  vec2 limits = uLInfo[light].zw;
  return limits.y - limits.x > 1e-5 ? smoothstep(limits.x, limits.y, angle) : step(limits.x, angle);
}

// irradiancia directa de las luces horneables en p (n = normal). receiver: sólo las de modo estático
vec3 lightE(vec3 p, vec3 n, bool receiver) {
  vec3 E = vec3(0.0);
  for (int j = 0; j < ${L}; j++) {
    if (j >= uNL) break;
    if (receiver && uLFlag[j].x < 0.5) continue;
    float type = uLInfo[j].x; vec3 l; float att = 1.0, maxD = 1e9;
    if (type > 1.5) {
      l = -uLDir[j];
      if (uSunAngle > 0.0) { vec3 t = normalize(abs(l.y) < 0.99 ? cross(l, vec3(0, 1, 0)) : cross(l, vec3(1, 0, 0))); vec3 b = cross(l, t); float a = 6.2831853 * rnd(), r = sqrt(rnd()) * uSunAngle; l = normalize(l + (t * cos(a) + b * sin(a)) * r); }
    } else {
      vec3 lp = uLPos[j];
      if (uLightRadius > 0.0) lp += sphereDir() * uLightRadius * rnd();
      vec3 tl = lp - p; float d = length(tl); l = tl / max(d, 1e-4); maxD = d - uEps;
      float w = clamp(1.0 - pow(d / uLInfo[j].y, 4.0), 0.0, 1.0);
      att = w * w / pow(max(d, 0.01), uLFlag[j].y);
      if (type > 0.5) att *= spotFalloff(j, l);
    }
    float ndl = dot(n, l);
    if (ndl <= 0.0 || att <= 0.0) continue;
    if (!occluded(p + n * uEps, l, maxD)) E += uLCol[j] * att * ndl;
  }
  return E;
}

// luz indirecta (irradiancia) que llega a p con normal n, con 'bounces' rebotes
vec3 indirectE(vec3 p, vec3 n, int bounces) {
  vec3 ro = p + n * uEps, rd = cosDir(n), T = vec3(1.0), sum = vec3(0.0);
  for (int b = 0; b < 8; b++) {
    if (b >= bounces) break;
    vec3 hp, hn, ha, emission; float d;
    if (hitScene(ro, rd, hp, hn, ha, emission, d)) {
      sum += T * (PI * emission + ha * lightE(hp, hn, false));
      T *= ha;
      if (max(T.r, max(T.g, T.b)) < 0.003) break;
      ro = hp + hn * uEps; rd = cosDir(hn);
    } else { sum += T * PI * skyL(rd); break; }
  }
  return sum;
}

#ifdef PROBE
void main() {
  int ci = int(gl_FragCoord.x), pi = int(gl_FragCoord.y);
  vec3 p = texelFetch(tProbes, ivec2(pi, 0), 0).xyz;
  rs = pcg(uint(pi) * 9781u + uint(uSeed) * 6271u + 1u);
  vec3 c = vec3(0.0);
  // luz directa de las luces estáticas como deltas
  for (int j = 0; j < ${L}; j++) {
    if (j >= uNL) break;
    if (uLFlag[j].x < 0.5) continue;
    float type = uLInfo[j].x; vec3 l; float att = 1.0, maxD = 1e9;
    if (type > 1.5) l = -uLDir[j];
    else { vec3 tl = uLPos[j] - p; float d = length(tl); l = tl / max(d, 1e-4); maxD = d;
      float w = clamp(1.0 - pow(d / uLInfo[j].y, 4.0), 0.0, 1.0); att = w * w / pow(max(d, 0.01), uLFlag[j].y);
      if (type > 0.5) att *= spotFalloff(j, l); }
    if (att > 0.0 && !occluded(p, l, maxD)) c += uLCol[j] * att * rtY(ci, l);
  }
  for (int s = 0; s < 256; s++) {
    if (s >= uSpp) break;
    vec3 w = sphereDir(), hp, hn, ha, emission; float d; vec3 Lr;
    if (hitScene(p, w, hp, hn, ha, emission, d)) Lr = emission + ha / PI * (lightE(hp, hn, false) + indirectE(hp, hn, uBounces - 1));
    else Lr = skyL(w);
    c += Lr * rtY(ci, w) * (4.0 * PI / float(uSpp));
  }
  outc(c);
}
#else
void main() {
  ivec2 px = ivec2(gl_FragCoord.xy);
  vec4 P = texelFetch(tPos, px, 0);
  if (P.w < 0.5) { outc(vec3(0.0)); return; }
  vec3 n = normalize(texelFetch(tNor, px, 0).xyz);
  rs = pcg(uint(px.x) * 1973u + uint(px.y) * 9277u + uint(uSeed) * 26699u + 1u);
  vec3 acc = vec3(0.0);
  for (int s = 0; s < 256; s++) {
    if (s >= uSpp) break;
    acc += lightE(P.xyz, n, true) + indirectE(P.xyz, n, uBounces);
  }
  outc(acc / float(uSpp));
}
#endif`

export function makeGbufferMaterial() {
  return new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: GBUF_VERT, fragmentShader: GBUF_FRAG, side: THREE.DoubleSide, depthTest: false, depthWrite: false })
}
