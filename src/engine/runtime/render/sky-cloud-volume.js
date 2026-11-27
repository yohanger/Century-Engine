export const CLOUD_VOLUME_UNIFORMS = /* glsl */ `
#ifdef LF_CLOUD_VOLUME
uniform highp sampler3D uCVolume;
uniform vec4 uCVolumeOrigin; // posición horizontal de la cámara, base y altura inversa
uniform float uCVolumeBlend;
#endif
`

export const CLOUD_VOLUME_DENSITY = /* glsl */ `
#ifdef LF_CLOUD_VOLUME
float simulatedCloudDensity(vec3 wp, vec2 organized, float altitude, bool full) {
  vec2 uv = (wp.xz + organized + uCVolumeOrigin.xy) / (2.0 * uCMapHalf) + 0.5;
  float h = (altitude - uCVolumeOrigin.z) * uCVolumeOrigin.w;
  if (any(lessThan(vec3(uv, h), vec3(0.0))) || any(greaterThan(vec3(uv, h), vec3(1.0)))) return 0.0;

  vec2 frames = texture(uCVolume, vec3(uv, h)).rg;
  float d = mix(frames.r, frames.g, uCVolumeBlend);
  if (d <= 0.005) return 0.0;
  d *= 1.0 - smoothstep(0.78, 1.0, length(uv - 0.5) * 2.0);
  if (!full) return d;

  // El campo define la silueta. El ruido Perlin–Worley erosiona sus bordes al renderizar.
  vec2 advected = wp.xz + organized + uCAtm;
  vec3 q = vec3(advected.x, altitude, advected.y) * (0.00032 / uCScale);
  vec4 shape = texture(uShape, q);
  vec3 detail = texture(uDetail, q * 5.0).rgb; // detalle solidario con el condensado; no deriva vertical arbitraria
  vec3 weights = vec3(0.625, 0.25, 0.125);
  float envelope = clamp(remap(shape.r, dot(shape.gba, weights) - 1.0, 1.0, 0.0, 1.0), 0.0, 1.0);
  float detailNoise = dot(detail, weights);
  float erosion = (1.0 - envelope) * 0.40 + detailNoise * uCErode * 0.15;
  float body = mix(0.52, 1.0, smoothstep(0.28, 0.82, envelope - (detailNoise - 0.5) * 0.25));
  return d * body * smoothstep(erosion * 0.72, erosion + 0.16, d);
}
#endif
`
