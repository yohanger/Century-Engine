// Fondo del cielo procedural, compuesto detrás del terreno del nivel.
export const SKY_PLANET = /* glsl */ `
vec3 planetSurface(vec3 rd, float hit, vec3 air) {
  vec3 normal = normalize(vec3(0.0, CLOUD_RADIUS + uCamY, 0.0) + rd * hit);
  vec3 direct = uSunColor * max(dot(normal, uSunDir), 0.0) * uSolarTransmission
              + uMoonColor * max(dot(normal, uMoonDir), 0.0);
  vec3 surface = ground * (mix(0.52, 0.08, uNight) + direct) * (1.0 - 0.58 * uStormCover) * uExposure;
  float grazing = 1.0 - smoothstep(0.0, 0.48, max(0.0, dot(normal, -rd)));
  float haze = 1.0 - exp(-max(0.0, hit) * 0.000035);
  // El radio terrestre deja el limbo cerca de la dirección horizontal en
  // gameplay. A gran altura se distingue sutilmente, sin un borde oscuro duro.
  float elevated = smoothstep(120.0, 3000.0, max(0.0, uCamY));
  float limbHaze = mix(0.955, 0.79, elevated);
  float airBlend = clamp(haze * 0.30 + grazing * limbHaze, 0.0, mix(0.965, 0.90, elevated));
  return mix(surface, air, airBlend);
}

vec3 planetBackdrop(vec3 dir, float skyY, float pxAng, float eyeHeight, vec3 col, vec3 air) {
  float edge = max(pxAng * 0.5, 0.0001);
  // Banda de dispersión de anchura angular: enlaza la calima con la caída real
  // del horizonte sin añadir geometría ni un segundo renderizador atmosférico.
  float limb = exp(-max(0.0, skyY) * 39.0) * smoothstep(120.0, 3000.0, eyeHeight);
  vec3 glow = horizon * limb * (0.10 * (1.0 - uNight) * (1.0 - uStormCover)) * uExposure;
  if (skyY >= edge) return col + glow;

  float hit = cloudSphereHits(dir, 0.0).x;
  // Sobre el límite, la distancia tangente da un antialias continuo.
  if (uCamY <= 0.0) hit = 0.0;
  else if (hit < 0.0) hit = -(CLOUD_RADIUS + uCamY) * dir.y;
  return mix(col + glow, planetSurface(dir, hit, air + glow), 1.0 - smoothstep(-edge, edge, skyY));
}
`
