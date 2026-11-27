// Shaders de superficie en GLSL (sobre el PBR de three.js).
//
// Un shader es un texto GLSL con una función `void surface(inout Surface s)` que modifica los datos de superficie; la iluminación
// (luces, sombras, reflejos del cielo, oclusión) la pone el motor. Los `uniform` con un comentario `// @param …` son las
// propiedades del shader: el panel del material se genera a partir de ellos (sin formularios hechos a mano).
//
//   // @name Mi shader                       nombre que se ve en las listas
//   // @description Texto opcional
//   uniform float uBrillo;   // @param label="Brillo" min=0 max=4 step=0.05 default=1 hint="…"
//   uniform vec3  uTinte;    // @param label="Tinte" color default=#ffffff
//   uniform bool  uOn;       // @param label="Activar" default=true
//   uniform sampler2D uMapa; // @param label="Mapa" srgb          (srgb = textura de color; sin srgb = datos lineales)
//
// Por cada `sampler2D uX` existe además `uniform bool uX_set;` (hay una textura asignada).
//
// struct Surface {
//   vec3 albedo; float alpha; float roughness; float metallic; vec3 emissive; float ao;   ← lo que el shader modifica
//   vec3 normal;        normal en espacio de vista (sale de aquí)
//   vec3 position;      posición de mapeo, en METROS (mundo u objeto, según el material)
//   vec3 mapNormal;     normal en el mismo espacio que `position`
//   vec3 worldPos; vec3 viewDir; vec2 uv; float time;
// }
// Ayudas: rtTriplanar(tex, p, n, 1.0/metros) · rtTriplanarNormal(tex, p, n, 1.0/metros, fuerza) · rtToView(n) · rtNoise(p) · rtFbm(p)
import * as THREE from 'three'

export const BUILTIN_PREFIX = 'builtin:'

export const PRELUDE_VERT = /* glsl */`
varying vec3 vLfWorld;
varying vec3 vLfObj;
varying vec3 vLfObjN;
varying vec2 vLfUv;
`
export const VERT_BODY = /* glsl */`
  vLfUv = uv;
  vec3 rtScale = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz));
  vLfObj = position * rtScale;
  vLfObjN = normal;
  vLfWorld = (modelMatrix * vec4(position, 1.0)).xyz;
`

/** Etapa de vértices opcional: el bloque entre `// @vertex begin` y `// @vertex end` define `void vertex(inout Vertex v)` y solo se compila en el vertex shader. */
export function splitVertexStage(code) {
  const m = /^[ \t]*\/\/\s*@vertex\s+begin[^\n]*\n([\s\S]*?)^[ \t]*\/\/\s*@vertex\s+end[^\n]*$/m.exec(String(code))
  if (!m) return { frag: String(code), vert: '' }
  return { frag: String(code).replace(m[0], ''), vert: m[1] }
}
export const VERT_USER_PRELUDE = /* glsl */`
uniform float uLfTime;
struct Vertex { vec3 position; vec3 normal; vec2 uv; vec3 worldPos; float time; };
struct Surface { vec3 position; vec3 mapNormal; vec3 normal; vec3 worldPos; vec3 viewDir; vec2 uv; float time; };
float rtHash(vec3 p) { p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float rtNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(rtHash(i), rtHash(i + vec3(1,0,0)), f.x), mix(rtHash(i + vec3(0,1,0)), rtHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(rtHash(i + vec3(0,0,1)), rtHash(i + vec3(1,0,1)), f.x), mix(rtHash(i + vec3(0,1,1)), rtHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float rtFbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * rtNoise(p); p = p * 2.03 + 11.7; a *= 0.5; } return s / 0.9375; }
`
/**
 * Aplica `vertex()` tras el desplazamiento de three. Con `normals` recalcula la normal con diferencias finitas
 * (dos vértices vecinos en el plano tangente pasan por `vertex()` y la normal es el producto vectorial de las diferencias),
 * así la luz sigue la forma desplazada. Se desactiva con el comentario `// @normals off` dentro del bloque de vértices.
 */
export const vertApply = (normals = true) => /* glsl */`
  {
    Vertex rtV; rtV.position = transformed; rtV.normal = objectNormal; rtV.uv = uv; rtV.time = uLfTime;
    rtV.worldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
    Vertex rtV0 = rtV;
    vertex(rtV);
    ${normals ? `#ifndef FLAT_SHADED
    {
      vec3 rtN0 = normalize(objectNormal);
      vec3 rtH = abs(rtN0.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
      vec3 rtT = normalize(cross(rtH, rtN0)), rtB = cross(rtN0, rtT);
      const float rtE = 0.02;
      Vertex rtA = rtV0; rtA.position += rtT * rtE; rtA.worldPos = (modelMatrix * vec4(rtA.position, 1.0)).xyz; vertex(rtA);
      Vertex rtC = rtV0; rtC.position += rtB * rtE; rtC.worldPos = (modelMatrix * vec4(rtC.position, 1.0)).xyz; vertex(rtC);
      vec3 rtNn = cross(rtA.position - rtV.position, rtC.position - rtV.position);
      if (dot(rtNn, rtNn) > 1e-12) { rtNn = normalize(rtNn); if (dot(rtNn, rtN0) < 0.0) rtNn = -rtNn; vNormal = normalize(normalMatrix * rtNn); }
    }
    #endif` : ''}
    transformed = rtV.position;
    vLfWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
    vLfObj = transformed * rtScale;
  }
`
export const VERT_APPLY = vertApply(true)
/** Variante para los materiales de sombra (profundidad / distancia): sin varyings propios ni normales; `normal` es el atributo. */
export const VERT_APPLY_DEPTH = /* glsl */`
  {
    Vertex rtV; rtV.position = transformed; rtV.normal = normal; rtV.uv = uv; rtV.time = uLfTime;
    rtV.worldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
    vertex(rtV);
    transformed = rtV.position;
  }
`

export const PRELUDE_FRAG = /* glsl */`
varying vec3 vLfWorld;
varying vec3 vLfObj;
varying vec3 vLfObjN;
varying vec2 vLfUv;
uniform float uLfTime;
uniform mat3 normalMatrix;
float rtAO = 1.0;
struct Surface {
  vec3 albedo; float alpha; float roughness; float metallic; vec3 emissive; float ao;
  vec3 normal; vec3 position; vec3 mapNormal; vec3 worldPos; vec3 viewDir; vec2 uv; float time;
};
float rtHash(vec3 p) { p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float rtNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(rtHash(i), rtHash(i + vec3(1,0,0)), f.x), mix(rtHash(i + vec3(0,1,0)), rtHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(rtHash(i + vec3(0,0,1)), rtHash(i + vec3(1,0,1)), f.x), mix(rtHash(i + vec3(0,1,1)), rtHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float rtFbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * rtNoise(p); p = p * 2.03 + 11.7; a *= 0.5; } return s / 0.9375; }
vec3 rtBlend(vec3 n) { vec3 w = pow(abs(n), vec3(4.0)); return w / max(w.x + w.y + w.z, 1e-4); }
vec4 rtTriplanar(sampler2D t, vec3 p, vec3 n, float k) {
  vec3 w = rtBlend(n);
  return texture2D(t, p.zy * k) * w.x + texture2D(t, p.xz * k) * w.y + texture2D(t, p.xy * k) * w.z;
}
vec3 rtTriplanarNormal(sampler2D t, vec3 p, vec3 n, float k, float strength) {
  vec3 w = rtBlend(n);
  vec3 tx = texture2D(t, p.zy * k).xyz * 2.0 - 1.0, ty = texture2D(t, p.xz * k).xyz * 2.0 - 1.0, tz = texture2D(t, p.xy * k).xyz * 2.0 - 1.0;
  tx.xy *= strength; ty.xy *= strength; tz.xy *= strength;
  tx = vec3(tx.xy + n.zy, abs(tx.z) * n.x);
  ty = vec3(ty.xy + n.xz, abs(ty.z) * n.y);
  tz = vec3(tz.xy + n.xy, abs(tz.z) * n.z);
  return normalize(tx.zyx * w.x + ty.xzy * w.y + tz.xyz * w.z);
}
vec3 rtToView(vec3 n) {
#ifdef LF_MAPPING_OBJECT
  return normalize(normalMatrix * n);
#else
  return normalize(transformDirection(n, viewMatrix));
#endif
}
`

export const FRAG_BEGIN = /* glsl */`
  Surface rtS;
  rtS.albedo = diffuseColor.rgb; rtS.alpha = diffuseColor.a; rtS.roughness = roughnessFactor; rtS.metallic = metalnessFactor;
  rtS.emissive = totalEmissiveRadiance; rtS.ao = 1.0; rtS.normal = normal;
#ifdef LF_MAPPING_OBJECT
  rtS.position = vLfObj; rtS.mapNormal = normalize(vLfObjN) * faceDirection;
#else
  rtS.position = vLfWorld; rtS.mapNormal = normalize(inverseTransformDirection(normal, viewMatrix));
#endif
  rtS.worldPos = vLfWorld; rtS.viewDir = normalize(vViewPosition); rtS.uv = vLfUv; rtS.time = uLfTime;
  surface(rtS);
  diffuseColor = vec4(clamp(rtS.albedo, 0.0, 1.0), rtS.alpha);
  roughnessFactor = clamp(rtS.roughness, 0.04, 1.0);
  metalnessFactor = clamp(rtS.metallic, 0.0, 1.0);
  normal = normalize(rtS.normal);
  totalEmissiveRadiance = rtS.emissive;
  rtAO = clamp(rtS.ao, 0.0, 1.0);
`
export const FRAG_AO = /* glsl */`
  reflectedLight.indirectDiffuse *= rtAO;
  reflectedLight.indirectSpecular *= mix(1.0, rtAO, 0.75);
`

// ---------------------------------------------------------------------------------------------------------------------
// Lectura de un shader: nombre, descripción y propiedades declaradas.
const TYPES = { float: 'number', int: 'number', bool: 'bool', vec3: 'vec3', sampler2D: 'texture' }
const hex = (s) => { const c = new THREE.Color(s); return [c.r, c.g, c.b] }
const UNIFORM_RE = /^\s*uniform\s+(float|int|bool|vec3|sampler2D)\s+(\w+)\s*;\s*\/\/\s*@param\b(.*)$/

function attrs(rest) {
  const out = {}
  for (const m of rest.matchAll(/(\w+)(?:=("[^"]*"|\S+))?/g)) out[m[1]] = m[2] === undefined ? true : m[2].replace(/^"|"$/g, '')
  return out
}

/** { name, description, params:[{ key, uniform, glsl, type, label, min, max, step, def, hint, color, srgb }] } */
export function parseShader(code) {
  const src = String(code || '')
  const info = { name: '', description: '', params: [] }
  for (const line of src.split('\n')) {
    let m = line.match(/^\s*\/\/\s*@name\s+(.+?)\s*$/)
    if (m) { info.name = m[1]; continue }
    m = line.match(/^\s*\/\/\s*@description\s+(.+?)\s*$/)
    if (m) { info.description = m[1]; continue }
    m = line.match(UNIFORM_RE)
    if (!m) continue
    const [, glsl, uniform, rest] = m
    const a = attrs(rest)
    const type = a.color && glsl === 'vec3' ? 'color' : TYPES[glsl]
    const p = { key: uniform, uniform, glsl, type, label: a.label || uniform.replace(/^u/, ''), hint: a.hint || '', srgb: !!a.srgb }
    if (glsl === 'sampler2D') p.def = null
    else if (glsl === 'bool') p.def = a.default === 'true' || a.default === true
    else if (glsl === 'vec3') p.def = a.color ? (a.default ? hex(a.default) : [1, 1, 1]) : (a.default ? String(a.default).split(',').map(Number) : [0, 0, 0])
    else p.def = a.default !== undefined ? Number(a.default) : 0
    if (type === 'number') {
      if (a.min !== undefined) p.min = Number(a.min)
      if (a.max !== undefined) p.max = Number(a.max)
      p.step = a.step !== undefined ? Number(a.step) : glsl === 'int' ? 1 : 0.01
    }
    if (type === 'color') p.defHex = '#' + new THREE.Color(p.def[0], p.def[1], p.def[2]).getHexString()
    if (!info.params.some((q) => q.key === p.key)) info.params.push(p)
  }
  return info
}

/** Declaraciones `uniform` que se insertan antes del código del usuario (más `<nombre>_set` por cada textura). */
export function uniformDecls(info) {
  return info.params.map((p) => (p.glsl === 'sampler2D' ? `uniform sampler2D ${p.uniform};\nuniform bool ${p.uniform}_set;` : `uniform ${p.glsl} ${p.uniform};`)).join('\n')
}

/** El código sin las líneas `uniform` anotadas (las declara uniformDecls) para no duplicarlas. */
export function stripParamUniforms(code) {
  return String(code).split('\n').map((l) => (UNIFORM_RE.test(l) ? '' : l)).join('\n')
}

export function hashString(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return (h >>> 0).toString(36) }

// ---------------------------------------------------------------------------------------------------------------------
// Shaders incluidos
// Blockout utiliza coordenadas métricas propias de cara y etiquetas de atlas compartido.
// UV artísticas sin tocar; fallback triplanar en objetos sin atributos métricos.
const BLOCKOUT = /* glsl */`// @name Blockout (cuadrícula 1 m)
// @description Patrón gris de referencia: cada casilla mide 1 metro. Al elegir Albedo, la imagen sustituye al patrón. Cambia a cualquier otro shader cuando termines el blockout.
uniform sampler2D uAlbedo; // @param label="Textura (sustituye blockout)" srgb
uniform float uTile;       // @param label="Tamaño de textura (m)" min=0.05 max=64 step=0.05 default=1 hint="Solo para una textura asignada; la cuadrícula de blockout siempre marca 1 metro"

float lfBlockLine(vec2 p) {
  // En los límites de cada metro, anti-alias para evitar parpadeos a distancia.
  vec2 q = fract(p + vec2(0.5));
  vec2 dist = min(q, 1.0 - q);
  vec2 width = max(fwidth(p) * 1.25, vec2(0.001));
  vec2 lines = 1.0 - smoothstep(vec2(0.0), width, dist);
  return max(lines.x, lines.y);
}
vec3 lfBlockColor(vec2 p) {
  vec2 cell = floor(p + vec2(0.5));
  float checker = mod(cell.x + cell.y, 2.0);
  vec3 gray = mix(vec3(0.46), vec3(0.65), checker);
  return mix(gray, vec3(0.025), lfBlockLine(p) * 0.95);
}
float lfMeterDigits(float value) {
  if (value >= 10000.0) return 5.0;
  if (value >= 1000.0) return 4.0;
  if (value >= 100.0) return 3.0;
  if (value >= 10.0) return 2.0;
  return 1.0;
}
float lfMeterDigit(float at, float value) {
  float size = lfMeterDigits(value);
  if (at < 0.0 || at >= size) return 17.0;
  return mod(floor(value / pow(10.0, size - at - 1.0)), 10.0);
}
float lfMetricGlyph(float index, vec2 size) {
  if (index < 6.0) {
    if (index < 1.0) return 10.0; // M
    if (index < 2.0) return 11.0; // E
    if (index < 3.0) return 12.0; // T
    if (index < 4.0) return 13.0; // R
    if (index < 5.0) return 14.0; // O
    return 15.0; // S
  }
  if (index < 7.0) return 16.0; // :
  if (index < 8.0) return 17.0; // espacio
  float width = floor(size.x + 0.5), height = floor(size.y + 0.5);
  float n = lfMeterDigits(width);
  if (index < 8.0 + n) return lfMeterDigit(index - 8.0, width);
  if (index < 9.0 + n) return 17.0;
  if (index < 10.0 + n) return 18.0; // X
  if (index < 11.0 + n) return 17.0;
  return lfMeterDigit(index - 11.0 - n, height);
}
vec3 lfBlockLabel(vec3 color, vec2 uv, vec2 size) {
  // 16 caracteres como máximo; una etiqueta por cara, no una etiqueta por casilla.
  if (size.x < 3.0 || size.y < 0.55) return color;
  const vec2 start = vec2(0.12, 0.12);
  const vec2 charSize = vec2(0.14, 0.28);
  vec2 p = (uv - start) / charSize;
  float n = 11.0 + lfMeterDigits(floor(size.x + 0.5)) + lfMeterDigits(floor(size.y + 0.5));
  if (p.x < 0.0 || p.y < 0.0 || p.x >= n || p.y >= 1.0 || uv.x > size.x - 0.12) return color;
  float glyph = lfMetricGlyph(floor(p.x), size);
  float ink = texture2D(uLfBlockFont, vec2((glyph + fract(p.x)) / 21.0, fract(p.y))).a;
  return mix(vec3(0.035), vec3(0.98), ink);
}
void surface(inout Surface s) {
  vec3 p = s.position;
  vec3 n = s.mapNormal;
  if (uAlbedo_set) {
    s.albedo *= rtTriplanar(uAlbedo, p, n, 1.0 / max(uTile, 0.05)).rgb;
  } else {
    if (uLfBlockFaces) {
      // El origen de cada nueva superficie comienza en (0,0), también tras Extrude.
      vec3 color = lfBlockColor(vLfBlockMetricUV - vec2(0.5));
      s.albedo *= lfBlockLabel(color, vLfBlockMetricUV, vLfBlockMetricSize);
    } else {
      vec3 w = rtBlend(n);
      s.albedo *= lfBlockColor(p.zy) * w.x + lfBlockColor(p.xz) * w.y + lfBlockColor(p.xy) * w.z;
    }
  }
  s.roughness = max(s.roughness, 0.85);
}
`

const REALISTA = /* glsl */`// @name Realista (PBR)
// @description Superficie PBR completa: mapas triplanares (albedo, normal, rugosidad, metal, AO, emisión) y micro-detalle procedural.
uniform sampler2D uAlbedo;    // @param label="Albedo" srgb
uniform sampler2D uNormal;    // @param label="Normal"
uniform sampler2D uHeight;    // @param label="Altura (Bump)"
uniform sampler2D uRoughness; // @param label="Rugosidad"
uniform sampler2D uMetallic;  // @param label="Metálico"
uniform sampler2D uAO;        // @param label="Oclusión (AO)"
uniform sampler2D uEmissive;  // @param label="Emisión" srgb
uniform float uTile;          // @param label="Tamaño de textura (m)" min=0.05 max=64 step=0.05 default=2 hint="Cada cuántos metros se repite"
uniform float uNormalStrength;// @param label="Fuerza normal" min=0 max=4 step=0.05 default=1
uniform float uBumpStrength; // @param label="Fuerza altura" min=0 max=4 step=0.05 default=1
uniform float uAOStrength;    // @param label="Fuerza AO" min=0 max=1 step=0.05 default=1
uniform vec3  uEmissiveColor; // @param label="Color emisión" color default=#ffffff
uniform float uEmissiveStrength; // @param label="Emisión" min=0 max=16 step=0.1 default=0
uniform float uMicro;         // @param label="Micro-detalle" min=0 max=1 step=0.01 default=0.35 hint="Relieve y rugosidad procedurales: quita el aspecto de plástico liso"
uniform float uMicroScale;    // @param label="Escala micro (m)" min=0.01 max=2 step=0.01 default=0.12
uniform float uVariation;     // @param label="Variación de color" min=0 max=0.5 step=0.01 default=0.08

void surface(inout Surface s) {
  float k = 1.0 / max(uTile, 0.001);
  vec3 p = s.position, n = s.mapNormal;
  if (uAlbedo_set) s.albedo *= rtTriplanar(uAlbedo, p, n, k).rgb;
  if (uRoughness_set) s.roughness *= rtTriplanar(uRoughness, p, n, k).r;
  if (uMetallic_set) s.metallic *= rtTriplanar(uMetallic, p, n, k).r;
  if (uAO_set) s.ao = mix(1.0, rtTriplanar(uAO, p, n, k).r, uAOStrength);

  float f = rtFbm(p / max(uMicroScale, 0.001));
  float g = rtFbm(p / (max(uMicroScale, 0.001) * 0.31) + 7.3);
  s.roughness = clamp(s.roughness + (f - 0.5) * 0.6 * uMicro, 0.04, 1.0);
  s.albedo *= 1.0 + (g - 0.5) * 2.0 * uVariation;

  vec3 nm = n;
  if (uNormal_set) nm = rtTriplanarNormal(uNormal, p, n, k, uNormalStrength);
  vec3 dpdx = dFdx(p), dpdy = dFdy(p);
  vec3 r1 = cross(dpdy, nm), r2 = cross(nm, dpdx);
  float det = dot(dpdx, r1);
  // Height Bump triplanar: derivadas en pantalla, sin desplazar la geometría.
  // Se evalúa únicamente si existe un mapa de altura (alternativo al normal map).
  if (uHeight_set && !uNormal_set) {
    float h = rtTriplanar(uHeight, p, n, k).r;
    vec3 hGrad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
    nm = normalize(abs(det) * nm - hGrad * uBumpStrength * 0.05);
  }
  r1 = cross(dpdy, nm); r2 = cross(nm, dpdx); det = dot(dpdx, r1);
  vec3 grad = sign(det) * (dFdx(g) * r1 + dFdy(g) * r2);
  nm = normalize(abs(det) * nm - grad * uMicro * 0.02);
  s.normal = rtToView(nm);

  vec3 em = uEmissive_set ? rtTriplanar(uEmissive, p, n, k).rgb : vec3(1.0);
  s.emissive += em * uEmissiveColor * uEmissiveStrength;
}
`

const HUMEDO = /* glsl */`// @name Húmedo (mojado)
// @description Superficie mojada: oscurece el color, baja la rugosidad y forma charcos brillantes.
uniform float uWet;       // @param label="Humedad" min=0 max=1 step=0.01 default=0.6
uniform float uPuddles;   // @param label="Charcos" min=0 max=1 step=0.01 default=0.4
uniform float uPuddleSize;// @param label="Tamaño de charcos (m)" min=0.2 max=20 step=0.1 default=2.5
uniform float uDarken;    // @param label="Oscurecer" min=0 max=0.8 step=0.01 default=0.35
void surface(inout Surface s) {
  float m = rtFbm(s.position / max(uPuddleSize, 0.01));
  float puddle = smoothstep(1.0 - uPuddles * 0.7, 1.0 - uPuddles * 0.7 + 0.12, m) * step(0.0001, uPuddles);
  float wet = clamp(uWet * (0.55 + 0.45 * rtFbm(s.position * 2.1)) + puddle, 0.0, 1.0);
  s.albedo *= 1.0 - uDarken * wet;
  s.roughness = mix(s.roughness, 0.04, wet * 0.85);
  s.normal = normalize(mix(s.normal, rtToView(s.mapNormal), puddle));
}
`

const NEON = /* glsl */`// @name Neón (emisivo)
// @description Emisión con pulso en el tiempo; con el bloom del look se ve como un tubo de neón.
uniform vec3  uColor;     // @param label="Color" color default=#ff2a6d
uniform float uPower;     // @param label="Intensidad" min=0 max=24 step=0.1 default=4
uniform float uPulse;     // @param label="Pulso" min=0 max=1 step=0.01 default=0.25
uniform float uSpeed;     // @param label="Velocidad" min=0 max=20 step=0.1 default=3
uniform float uFlicker;   // @param label="Parpadeo" min=0 max=1 step=0.01 default=0.1
void surface(inout Surface s) {
  float t = s.time * uSpeed;
  float flick = 1.0 - uFlicker * step(0.93, rtNoise(vec3(floor(s.time * 11.0), 3.1, 7.7)));
  s.albedo *= 0.15;
  s.emissive = uColor * uPower * (1.0 + uPulse * sin(t)) * flick;
}
`

export const BUILTIN_SHADERS = [
  { id: BUILTIN_PREFIX + 'blockout', name: 'Blockout (cuadrícula 1 m)', code: BLOCKOUT },
  { id: BUILTIN_PREFIX + 'realista', name: 'Realista (PBR)', code: REALISTA },
  { id: BUILTIN_PREFIX + 'humedo', name: 'Húmedo (mojado)', code: HUMEDO },
  { id: BUILTIN_PREFIX + 'neon', name: 'Neón (emisivo)', code: NEON },
]
export const DEFAULT_SHADER_ID = BUILTIN_PREFIX + 'realista'
export const SHADER_TEMPLATE = REALISTA.replace('// @name Realista (PBR)', '// @name Mi shader').replace(/^\/\/ @description.*\n/m, '// @description Describe aquí qué hace.\n')
