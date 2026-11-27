// Suelo mojado por la lluvia: UN conjunto de uniformes global. NatureFX acumula la humedad según la precipitación y la escribe aquí;
// el terreno solo lleva el parche de shader (WET_*). Con humedad 0 el parche no hace nada.
//  · uWet 0–1: oscurece el color y baja moderadamente la rugosidad (tierra húmeda).
//  · Charcos: zonas pequeñas sobre suelo plano, solo con humedad alta; el resto sigue siendo tierra, no espejo.
//  · Ondas: anillos que se expanden dentro de los charcos mientras llueve (uRain).
//  · uSnow 0–1: manto blanco (más en zonas llanas).

export const WETU = {
  uWet: { value: 0 },
  uRain: { value: 0 },
  uSnowCover: { value: 0 },
  uWetTime: { value: 0 },
  uPhysicalCount: { value: 0 },
  uPhysicalBounds: { value: new Float32Array(32 * 4) },
  uHydroCount: { value: 0 },
  uHydroGrid: { value: new Float32Array(32 * 4) },
  uHydroDims: { value: new Float32Array(32 * 4) },
  uHydroMoisture: { value: null },
}

export const WET_DECL = /* glsl */`
uniform sampler2D uWetMirrorMap;
uniform float uWetMirrorStrength, uWetMirrorHeight;
varying vec4 vWetMirror;
varying vec3 vWetWorld;
uniform float uWet, uRain, uSnowCover, uWetTime;
uniform int uPhysicalCount;
uniform vec4 uPhysicalBounds[32];
uniform int uHydroCount;
uniform vec4 uHydroGrid[32], uHydroDims[32];
uniform sampler2D uHydroMoisture;
float rtHydroWet(vec2 p) {
  for (int k = 0; k < 32; k++) {
    if (k >= uHydroCount) break;
    vec4 grid = uHydroGrid[k], dim = uHydroDims[k];
    vec2 c = floor((p - grid.xy) * grid.zw);
    if (all(greaterThanEqual(c, vec2(0.0))) && all(lessThan(c, dim.xy))) {
      float index = dim.z + c.y * dim.x + c.x;
      return texture2D(uHydroMoisture, vec2((mod(index, 64.0) + 0.5) / 64.0, (floor(index / 64.0) + 0.5) / 64.0)).r;
    }
  }
  return -1.0;
}
bool rtHasPhysicalWater(vec2 p) {
  for (int k = 0; k < 32; k++) {
    if (k >= uPhysicalCount) break;
    vec4 r = uPhysicalBounds[k];
    if (p.x >= r.x && p.y >= r.y && p.x < r.z && p.y < r.w) return true;
  }
  return false;
}
float rtH21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float rtVN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(rtH21(i), rtH21(i+vec2(1,0)), f.x), mix(rtH21(i+vec2(0,1)), rtH21(i+vec2(1,1)), f.x), f.y); }
float rtPuddle(vec2 p){ float n = rtVN(p*0.35)*0.6 + rtVN(p*0.9)*0.3 + rtVN(p*2.3)*0.1; return smoothstep(0.61, 0.69, n) * smoothstep(0.65, 0.98, uWet) * smoothstep(0.93, 0.99, vWetN); }
float rtRipples(vec2 p){
  vec2 cell = floor(p * 3.0); vec2 f = fract(p * 3.0) - 0.5;
  float ph = fract(uWetTime * 0.9 + rtH21(cell) * 7.0);
  float d = length(f + (vec2(rtH21(cell + 3.1), rtH21(cell + 9.7)) - 0.5) * 0.5);
  float ring = (1.0 - smoothstep(0.0, 0.03, abs(d - ph * 0.5))) * (1.0 - ph);
  return ring * step(0.5, rtH21(cell + 1.7));
}
float rtPud, rtRip;
`
// tras color_fragment: oscurecer y nevar
export const WET_COLOR = /* glsl */`
rtPud = 0.0; rtRip = 0.0;
float moistureFromSoil = rtHydroWet(vTxz);
float terrainWet = moistureFromSoil >= 0.0 ? moistureFromSoil : uWet;
if (uWet > 0.65 && vWetN > 0.93) {
  if (uPhysicalCount == 0 && !rtHasPhysicalWater(vTxz)) {
    rtPud = rtPuddle(vTxz);
    if (uRain > 0.001 && rtPud > 0.0) rtRip = rtRipples(vTxz) * rtPud * uRain;
  }
}
diffuseColor.rgb *= 1.0 - 0.45 * terrainWet - 0.2 * rtPud;
{ float flat_ = clamp(vWetN, 0.0, 1.0); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 0.98), uSnowCover * smoothstep(0.55, 0.9, flat_)); }
`
export const WET_ROUGH = /* glsl */`
// La tierra húmeda sigue siendo rugosa; el reflejo definido se reserva al agua acumulada.
roughnessFactor = mix(roughnessFactor, max(0.72, roughnessFactor * 0.85), terrainWet);
roughnessFactor = mix(roughnessFactor, 0.09, rtPud);
roughnessFactor = mix(roughnessFactor, 0.8, uSnowCover * 0.8);
`
// tras normal_fragment_maps: perturba la normal con las ondas (en el espacio de la vista, aproximado)
export const WET_NORMAL = /* glsl */`
normal = normalize(normal + vec3(rtRip * 0.25, 0.0, rtRip * 0.25));
`
export const WET_VS_DECL = 'varying float vWetN;\n'
export const WET_FS_DECL = 'varying float vWetN;\n'

const MIRROR = /* glsl */`
if (uWetMirrorStrength > 0.0 && rtPud > 0.0 && vWetMirror.w > 0.0) {
  vec2 uv = vWetMirror.xy / vWetMirror.w + vec2(rtRip, -rtRip) * 0.014;
  vec2 margin = min(uv, 1.0 - uv);
  float edge = smoothstep(0.0, 0.04, min(margin.x, margin.y));
  float planeFit = 1.0 - smoothstep(0.05, 0.25, abs(vWetWorld.y - uWetMirrorHeight));
  float ndv = clamp(abs(normalize(cameraPosition - vWetWorld).y), 0.0, 1.0);
  float fresnel = 0.08 + 0.92 * pow(1.0 - ndv, 4.0);
  totalEmissiveRadiance += texture2D(uWetMirrorMap, clamp(uv, 0.0, 1.0)).rgb
    * (rtPud * edge * planeFit * fresnel * uWetMirrorStrength);
}
`

export function patchTerrainWet(sh, mirror) {
  Object.assign(sh.uniforms, WETU, mirror)
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\n' + WET_VS_DECL + 'uniform mat4 uWetMirrorMatrix; varying vec4 vWetMirror; varying vec3 vWetWorld;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWetN = normalize(mat3(modelMatrix) * normal).y; vWetWorld = (modelMatrix * vec4(position, 1.0)).xyz; vWetMirror = uWetMirrorMatrix * vec4(vWetWorld, 1.0);')
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', '#include <common>\n' + WET_FS_DECL + WET_DECL)
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + MIRROR)
}
