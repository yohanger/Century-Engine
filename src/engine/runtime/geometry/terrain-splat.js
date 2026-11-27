// Pintura del terreno: capas por defecto, normalización, y el shader que mezcla hasta MAX_LAYERS capas por vértice.
// Shader de pintura del terreno: hasta MAX_LAYERS capas por vértice (dos atributos vec4) mezcladas en el fragmento, con texturas en un DataArrayTexture.

/** Máximo de capas de pintura (8 pesos por vértice: dos atributos vec4). */
export const DEFAULT_HYDROLOGY = Object.freeze({ infiltrationMmH: 0, capacityMm: 0, initialSaturation: 0, drainageMmH: 0 })
const HYDRO_LIMITS = { infiltrationMmH: 10000, capacityMm: 10000, initialSaturation: 1, drainageMmH: 10000 }

export function normalizedHydrology(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RangeError('Hidrología: perfil inválido')
  const profile = {}
  for (const [name, max] of Object.entries(HYDRO_LIMITS)) {
    const n = value[name] ?? DEFAULT_HYDROLOGY[name]
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > max)
      throw new RangeError(`Hidrología: ${name} fuera de rango`)
    profile[name] = n
  }
  return profile
}

export const MAX_LAYERS = 8
/** Floats por vértice en el mapa de pesos (8 capas). */
export const STRIDE = 8

/** Capa: color plano o textura (id de un archivo del proyecto) repetida cada `tile` metros. */
export const DEFAULT_LAYERS = [
  { name: 'Hierba', color: '#5a8f3c', texture: null, tile: 4 },
  { name: 'Tierra', color: '#7a5a3a', texture: null, tile: 4 },
  { name: 'Roca', color: '#8a8d93', texture: null, tile: 4 },
  { name: 'Arena', color: '#d6c28a', texture: null, tile: 4 },
]

export function normalizeLayers(layers) {
  const src = layers?.length ? layers : DEFAULT_LAYERS
  return src.slice(0, MAX_LAYERS).map((l, i) => ({
    name: l.name || `Capa ${i + 1}`, color: l.color || '#808080', texture: l.texture || null, tile: l.tile > 0 ? +l.tile : 4, surface: typeof l.surface === 'string' ? l.surface : '',
    ...(l.hydrology != null && { hydrology: normalizedHydrology(l.hydrology) }),
  }))
}

export const SPLAT_VS_DECL = 'attribute vec4 splatA;\nattribute vec4 splatB;\nvarying vec4 vSpA;\nvarying vec4 vSpB;\nvarying vec2 vTxz;\n'
export const SPLAT_FS_DECL = `varying vec4 vSpA;
varying vec4 vSpB;
varying vec2 vTxz;
uniform vec3 uLCol[${MAX_LAYERS}];
uniform float uLTile[${MAX_LAYERS}];
uniform float uLTex[${MAX_LAYERS}];
uniform highp sampler2DArray uLayerTex;
`
export const SPLAT_FS_COLOR = `{
  vec3 acc = vec3(0.0); float tw = 0.0;
  vec2 gx = dFdx(vTxz), gy = dFdy(vTxz);
  for (int k = 0; k < ${MAX_LAYERS}; k++) {
    float w = k < 4 ? vSpA[k] : vSpB[k - 4];
    if (w < 0.003) continue;
    vec3 c = uLCol[k];
    if (uLTex[k] > -0.5) c = textureGrad(uLayerTex, vec3(vTxz / uLTile[k], uLTex[k]), gx / uLTile[k], gy / uLTile[k]).rgb;
    acc += c * w; tw += w;
  }
  diffuseColor.rgb *= acc / max(tw, 1e-4);
}`
