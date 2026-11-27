// Cielo del escenario: degradado, cielo físico (Rayleigh/Mie), panorama HDRI y nubes volumétricas.
// Todo vive en un solo ShaderMaterial (viewport.js lo pone en una esfera que sigue a la cámara; el mismo material
// alimenta el IBL del ambiente). Este módulo no usa el DOM: lo importa también el test de Node.
import { CLOUD_CURVATURE_RADIUS, CLOUD_VIEW_DISTANCE } from '../world/cloud-curvature.js'
import { SKY_PLANET } from './sky-planet.js'
import { CLOUD_VOLUME_UNIFORMS, CLOUD_VOLUME_DENSITY } from './sky-cloud-volume.js'

export const SKY_DEFAULTS = {
  skyMode: 'gradient',   // 'gradient' | 'physical' | 'hdri'
  skyExposure: 1, skyRotation: 0, skyTint: '#ffffff', skyHdri: '',
  sunLink: true, sunElevation: 45, sunAzimuth: 135,   // sin enlace: el sol se coloca a mano
  skyTurbidity: 2, skyRayleigh: 1, skyMie: 0.005, skyMieG: 0.8,
  cloudsOn: false, cloudsPreset: 'cloudy',
  cloudsCoverage: 0.5, cloudsDensity: 1, cloudsAltitude: 3200, cloudsThickness: 1400, cloudsScale: 1,
  cloudsErosion: 0.5, cloudsType: 0.5, cloudsWind: 10, cloudsWindDir: 0, cloudsTint: '#ffffff', cloudsLight: 1,
}

/** Presets de nubes (como los de Unity 6: Sparse, Cloudy, Overcast, Stormy). */
export const CLOUD_PRESETS = {
  sparse:   { label: 'Despejado (pocas nubes)', cloudsType: 0.5, cloudsCoverage: 0.3, cloudsDensity: 0.7, cloudsAltitude: 4200, cloudsThickness: 900, cloudsScale: 1, cloudsErosion: 0.6, cloudsTint: '#ffffff' },
  cloudy:   { label: 'Nublado parcial', cloudsType: 0.5, cloudsCoverage: 0.5, cloudsDensity: 1, cloudsAltitude: 3200, cloudsThickness: 1400, cloudsScale: 1, cloudsErosion: 0.5, cloudsTint: '#ffffff' },
  overcast: { label: 'Cubierto', cloudsType: 0.12, cloudsCoverage: 0.82, cloudsDensity: 1.1, cloudsAltitude: 2800, cloudsThickness: 1500, cloudsScale: 1.3, cloudsErosion: 0.35, cloudsTint: '#dfe4ea' },
  stormy:   { label: 'Tormenta', cloudsType: 1, cloudsCoverage: 0.9, cloudsDensity: 1.9, cloudsAltitude: 2400, cloudsThickness: 2400, cloudsScale: 0.8, cloudsErosion: 0.7, cloudsTint: '#8d96a3' },
}

const num = (v, d, a, b) => (Number.isFinite(+v) && v !== '' && v !== null && v !== undefined ? Math.min(b, Math.max(a, +v)) : d)
const hexOr = (v, d) => (/^#[0-9a-f]{6}$/i.test(v) ? v : d)

/** Parámetros de cielo válidos a partir del entorno de la escena (lo que falta = valores por defecto). */
export function normalizeSky(env = {}) {
  const d = SKY_DEFAULTS
  return {
    skyMode: ['gradient', 'physical', 'hdri'].includes(env.skyMode) ? env.skyMode : d.skyMode,
    skyExposure: num(env.skyExposure, d.skyExposure, 0, 8), skyRotation: num(env.skyRotation, d.skyRotation, -360, 360),
    skyTint: hexOr(env.skyTint, d.skyTint), skyHdri: typeof env.skyHdri === 'string' ? env.skyHdri : '',
    sunLink: env.sunLink !== false, sunElevation: num(env.sunElevation, d.sunElevation, -10, 90), sunAzimuth: num(env.sunAzimuth, d.sunAzimuth, -360, 360),
    skyTurbidity: num(env.skyTurbidity, d.skyTurbidity, 1, 20), skyRayleigh: num(env.skyRayleigh, d.skyRayleigh, 0, 4),
    skyMie: num(env.skyMie, d.skyMie, 0, 0.1), skyMieG: num(env.skyMieG, d.skyMieG, 0, 0.99),
    cloudsOn: !!env.cloudsOn, cloudsPreset: CLOUD_PRESETS[env.cloudsPreset] ? env.cloudsPreset : env.cloudsPreset === 'custom' ? 'custom' : d.cloudsPreset,
    cloudsCoverage: num(env.cloudsCoverage, d.cloudsCoverage, 0, 1), cloudsDensity: num(env.cloudsDensity, d.cloudsDensity, 0, 4),
    cloudsAltitude: num(env.cloudsAltitude, d.cloudsAltitude, 200, 8000), cloudsThickness: num(env.cloudsThickness, d.cloudsThickness, 100, 6000),
    cloudsScale: num(env.cloudsScale, d.cloudsScale, 0.2, 4), cloudsErosion: num(env.cloudsErosion, d.cloudsErosion, 0, 1), cloudsType: num(env.cloudsType, d.cloudsType, 0, 1),
    cloudsWind: num(env.cloudsWind, d.cloudsWind, 0, 200), cloudsWindDir: num(env.cloudsWindDir, d.cloudsWindDir, -360, 360),
    cloudsTint: hexOr(env.cloudsTint, d.cloudsTint), cloudsLight: num(env.cloudsLight, d.cloudsLight, 0, 4),
  }
}

/** Dirección hacia el sol (unitaria) desde elevación y azimut en grados. */
/** Intensidad visual de tormenta a partir del campo meteorológico YA interpolado por World. */
export function stormCoverFromFrame(frame) {
  const c = frame?.weatherOn && frame?.clouds?.on ? frame.clouds : null
  if (!c) return 0
  const sat = x => Math.max(0, Math.min(1, x))
  return sat((c.type - 0.55) / 0.35) * sat((c.density - 1.0) / 1.0) * sat((c.coverage - 0.6) / 0.35)
}

export function sunDirection(elevation, azimuth) {
  const e = elevation * Math.PI / 180, a = azimuth * Math.PI / 180
  return [Math.cos(e) * Math.sin(a), Math.sin(e), -Math.cos(e) * Math.cos(a)]
}

export const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position.z = gl_Position.w; // cielo en el plano lejano, independiente del radio de la esfera
}`

export const SKY_FRAG = /* glsl */`
uniform vec3 top; uniform vec3 horizon; uniform vec3 ground;
uniform int uMode;                         // 0 degradado · 1 físico · 2 HDRI
uniform float uExposure, uRotation; uniform vec3 uTint;
uniform sampler2D uPano; uniform float uPanoFlip;
uniform vec3 uSunDir, uSunColor;
uniform float uTurb, uRayleigh, uMie, uMieG;
uniform float uCamY, uTime;
uniform float uSolarTransmission;          // luz directa transmitida, sin afectar el cielo difuso
uniform float uNight;
uniform vec3 uMoonColor;
uniform float uStormCover;                 // intensidad derivada de las nubes de World; también con luz manual
uniform vec4 uStormFront;                   // dirección horizontal upwind, progreso y fuerza de la transición existente
uniform vec4 uLightningCloud;               // punto de descarga en el mundo (xyz), radio horizontal (w)
uniform float uLightningEnergy;             // intensidad de la descarga física, derivada de World.flash
uniform float uSkyFogDensity;              // solo ruta FogExp2: el pase físico ya trata el cielo
uniform float uWeatherHazeFalloff;
uniform vec3 uSkyFogColor;
uniform int uClouds, uCloudSteps, uCloudDiagnostic;
uniform float uCovg, uCDens, uCBase, uCThick, uCScale, uCErode, uCWind, uCWindDir, uCLight;
uniform vec2 uWindOff;                      // desplazamiento acumulado del viento (m): lo integra el CPU, así una racha no hace saltar las nubes
uniform float uStars, uMoonVis, uFlash;     // noche: estrellas y luna · relámpago
uniform vec3 uMoonDir, uStarAxis; uniform float uStarAng; // polo celeste y ángulo de giro de las estrellas
// astronomía real (world/astro.js): catálogo por RA/Dec, planetas y luna con fase
uniform float uAstro, uLat, uLst;           // 1 = activa · latitud y tiempo sidéreo local (rad)
uniform float uStarCore;                    // radio del núcleo de una estrella en píxeles: 0,72 normal · mayor con TAA (ver look.js)
uniform sampler2D uStarTex, uStarOff, uMoonTex;   // atlas de estrellas (color·brillo) y posición dentro del texel
uniform vec3 uPlDir[5]; uniform vec4 uPlCol[5]; uniform float uPlRad[5];
uniform vec3 uMoonRight, uMoonUp, uAstroSun; uniform float uMoonIllum, uMoonRad;
uniform vec3 uCTint, uCAmb;
uniform highp sampler3D uShape, uDetail;
uniform float uCType;
// Mapa atmosférico de celdas: opacidad, tipo, base y tope premultiplicados.
uniform int uCCells; uniform sampler2D uCMap; uniform vec2 uCCam, uCAtm; uniform float uCMapHalf;
${CLOUD_VOLUME_UNIFORMS}
uniform vec4 uTornadoCloud; uniform vec4 uTornadoOrganization; uniform vec2 uCamXZ;
uniform vec4 uTornadoShape;
varying vec3 vDir;
const float PI = 3.141592653589793;
const float CLOUD_RADIUS = ${CLOUD_CURVATURE_RADIUS.toFixed(1)};
const float CLOUD_REACH = ${CLOUD_VIEW_DISTANCE.toFixed(1)};

float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float hgPhase(float c, float g) { float g2 = g * g; return (1.0 - g2) / (4.0 * PI * pow(1.0 + g2 - 2.0 * g * c, 1.5)); }
float remap(float v, float a, float b, float c, float d) { return c + (v - a) / max(b - a, 1e-4) * (d - c); }

// Nubes volumétricas (receta de «Horizon Zero Dawn»): forma = Perlin-Worley erosionado por Worley (uShape), degradado de altura según
// el TIPO de nube (0 estrato plano · 0,5 cúmulo de base plana y tope hinchado · 1 cumulonimbo vertical), cobertura con variación a gran
// escala y bordes rizados con el detalle (uDetail). El tipo y la cobertura salen del clima: despejado = cúmulos sueltos, lluvia = un manto
// bajo y gris, tormenta = torres oscuras.
float heightGradient(float hf, float t) {
  float stratus = smoothstep(0.0, 0.1, hf) * (1.0 - smoothstep(0.14, 0.42, hf));
  float cumulus = smoothstep(0.0, 0.09, hf) * (1.0 - smoothstep(0.4, 0.8, hf));
  float cb = smoothstep(0.0, 0.07, hf) * (1.0 - smoothstep(0.78, 1.0, hf));
  return t < 0.5 ? mix(stratus, cumulus, t * 2.0) : mix(cumulus, cb, (t - 0.5) * 2.0);
}
// Núcleo de condensación localizado en la base de la MISMA capa de nubes.
// Deforma la densidad del raymarch sin añadir otra malla, sin nubes esféricas y sin más pasos.
float tornadoCloudRoot(vec3 wp, float hf) {
  if (uTornadoCloud.w <= 0.001) return 0.0;
  if (hf > 0.28) return 0.0;
  vec2 rel = wp.xz + uCamXZ - uTornadoCloud.xy;
  float radius = max(15.0, uTornadoCloud.z);
  float dist = length(rel) / radius;
  if (dist >= 2.8) return 0.0;
  // La base de la nube madre se ensancha irregularmente, no forma una tapa circular.
  // Usamos el MISMO ruido atmosférico y su deriva; no existe textura de tornado.
  vec3 q = (wp + vec3(uWindOff.x, 0.0, uWindOff.y)) * (0.00024 / max(0.2, uCScale));
  vec4 sh = texture(uShape, q + vec3(0.0, uTime * 0.00004, 0.0));
  float mass = sh.g * 0.625 + sh.b * 0.25 + sh.a * 0.125;
  float angle = atan(rel.y, rel.x);
  float wrinkle = (mass - 0.5) * 0.48 + sin(angle * 3.0 - hf * 15.0 + uTime * 0.14) * 0.045;
  float outer = 1.0 - smoothstep(0.72, 2.32, dist + wrinkle);
  float core = 1.0 - smoothstep(0.28, 1.25, dist + wrinkle);
  float underbelly = 1.0 - smoothstep(0.025, 0.255, hf);
  return (outer * (0.52 + 0.34 * mass) + core * 0.30) * underbelly * uTornadoCloud.w;
}
// La condensación del embudo pertenece al mismo campo atmosférico y comparte su iluminación.
// No crea nubes, geometrías ni partículas independientes del CloudField.
float tornadoCondensation(vec3 wp) {
  if (uTornadoCloud.w <= 0.005 || uTornadoShape.z <= 0.005) return 0.0;
  float topY = max(uTornadoShape.y, uTornadoShape.x + 1.0);
  float bottomY = mix(topY, uTornadoShape.x, clamp(uTornadoShape.z, 0.0, 1.0));
  if (wp.y < bottomY || wp.y > topY) return 0.0;
  float h = clamp((wp.y - uTornadoShape.x) / max(1.0, topY-uTornadoShape.x), 0.0, 1.0);
  // Cada fase prolonga la nube hacia ABAJO: el extremo naciente siempre termina en punta.
  // Si usáramos h del suelo para el radio, un embudo parcial tendría un extremo ancho y recto.
  float hVisible = clamp((wp.y - bottomY) / max(1.0, topY-bottomY), 0.0, 1.0);
  vec2 offset = wp.xz + uCamXZ - uTornadoCloud.xy;
  float r = max(2.0, uTornadoCloud.z * max(0.12, uTornadoShape.w) * (0.06 + 1.08 * pow(hVisible, 1.62)));
  // Cizalladura continua: la columna se inclina sin mover su eje físico en World.
  float shear = h * h;
  vec2 bend = uTornadoCloud.z * shear * vec2(
    0.13 * sin(h * 4.3 + uTime * 0.065) - 0.13 * sin(uTime * 0.065),
    0.10 * sin(h * 3.5 - uTime * 0.055) - 0.10 * sin(-uTime * 0.055));
  vec2 rel = offset - bend;
  // Las texturas 3D compartidas erosionan el volumen y rompen la simetría del cono.
  vec3 q = (wp + vec3(uWindOff.x, 0.0, uWindOff.y)) * (0.00032 / max(0.2, uCScale));
  vec4 sh = texture(uShape, q * 2.0 + vec3(0.0, uTime * 0.00008, 0.0));
  float n = sh.g * 0.625 + sh.b * 0.25 + sh.a * 0.125;
  float spiral = sin(atan(rel.y, rel.x) * 3.0 - h * 14.0 - uTime * 0.29) * 0.065;
  float radial = length(rel) / r + spiral + (n - 0.5) * 0.38;
  float envelope = 1.0 - smoothstep(0.38, 1.18, radial);
  // La unión superior gana volumen y continúa siendo la densidad de la nube,
  // con idéntico tinte, extinción e iluminación en el integrador atmosférico.
  float shoulder = smoothstep(0.73, 1.0, h);
  // Punta redondeada: evita un corte plano incluso durante el primer descenso.
  float foot = smoothstep(0.0, min(18.0, (topY-bottomY)*0.16), wp.y-bottomY);
  return envelope * mix(0.58, 1.0, n) * (1.0 + 0.36 * shoulder) * uTornadoCloud.w * foot;
}
// hf = altura relativa en la capa [0,1]; full = con detalle (para la luz basta la forma)
// Advección localizada en la MISMA densidad: sin otra nube ni ruido temporal independiente.
vec2 organizedCloudOffset(vec3 wp, float hf) {
  if (uTornadoOrganization.w <= 0.001) return vec2(0.0);
  vec2 q = wp.xz + uCamXZ - uTornadoOrganization.xy;
  float r = max(50.0, uTornadoOrganization.z);
  float dist = length(q) / r;
  if (dist >= 1.6) return vec2(0.0);
  float influence = (1.0 - smoothstep(0.2, 1.6, dist)) * uTornadoOrganization.w;
  float lift = 1.0 - smoothstep(0.2, 0.85, hf);
  float angle = influence * (0.18 + 0.42 * lift) * (uTime * 0.075 + hf * 1.3);
  float sn = sin(angle), cs = cos(angle);
  return vec2(cs * q.x - sn * q.y - q.x, sn * q.x + cs * q.y - q.y);
}
${CLOUD_VOLUME_DENSITY}
float cloudDensity(vec3 wp, float hf, bool full) {
  float root = tornadoCloudRoot(wp, hf);
  vec2 organized = organizedCloudOffset(wp, hf);
  float altitude = uCBase + hf * uCThick;
  vec3 p; float cov, typ = uCType;
  if (uCCells == 1) {
    #ifdef LF_CLOUD_VOLUME
    if (uCVolumeOrigin.w > 0.0) return max(root, simulatedCloudDensity(wp, organized, altitude, full)) * uCDens;
    #endif
    vec2 uv = (wp.xz + organized + uCCam) / (2.0 * uCMapHalf) + 0.5;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return root;
    vec4 m = texture(uCMap, uv);
    if (m.r <= 0.004) return root;
    typ = m.g / m.r;                                           // premultiplicado: al interpolar, el cociente da la media ponderada
    float bf = m.b / m.r, tf = m.a / m.r;
    hf = (hf - bf) / max(tf - bf, 0.03);                       // altura relativa DENTRO de la nube de esta columna (base y tope propios)
    if (hf <= 0.0 || hf >= 1.0) return root;
    // El mapa local se funde con la calima sin dibujar su borde cuadrado.
    cov = m.r * (1.0 - smoothstep(0.78, 1.0, length(uv - 0.5) * 2.0));
    if (cov <= 0.004) return root;
    p = vec3(wp.x + organized.x + uCAtm.x, altitude, wp.z + organized.y + uCAtm.y);
  } else {
    p = vec3(wp.x + organized.x + uWindOff.x, altitude, wp.z + organized.y + uWindOff.y);
    vec4 weather = texture(uShape, vec3(p.x * 0.000038, 0.31, p.z * 0.000038) / uCScale);
    cov = clamp(uCovg + (weather.r - 0.55) * 1.6 * 4.0 * uCovg * (1.0 - uCovg), 0.0, 1.0);
    if (cov <= 0.002) return root;
    // Un único volumen: relieve de base y techo por región, suavizado para que
    // las masas no queden coplanares ni parezcan montañas suspendidas.
    // Reutiliza el ruido y el raymarch existentes (sin muestras adicionales).
    float relief = smoothstep(0.12, 0.82, typ);
    float base = clamp(0.11 + mix(0.05, 0.20, relief) * (weather.g - 0.5) + 0.06 * weather.b, 0.045, 0.34);
    float top = min(1.0, base + mix(0.26, 0.35 + 0.25 * weather.b, relief));
    hf = (hf - base) / max(0.12, top - base);
    if (hf <= 0.0 || hf >= 1.0) return root;
  }
  vec3 q = p * (0.00032 / uCScale);
  vec4 sh = texture(uShape, q);
  float lf = sh.g * 0.625 + sh.b * 0.25 + sh.a * 0.125;
  float noise = clamp(remap(remap(sh.r, lf - 1.0, 1.0, 0.0, 1.0), 0.68, 0.96, 0.0, 1.0), 0.0, 1.0);
  float envelope = heightGradient(hf, typ);
  float base = mix(noise * envelope, max(0.0, noise + envelope - 1.0), 0.38);
  float d = remap(base, 1.0 - cov, 1.0, 0.0, 1.0) * cov;
  if (full && d > 0.0) {
    vec3 dd = texture(uDetail, q * 5.0 + vec3(0.0, uTime * 0.0006, 0.0)).rgb;
    float f = dd.r * 0.625 + dd.g * 0.25 + dd.b * 0.125;
    d = remap(d, mix(f, 1.0 - f, clamp(hf * 4.0, 0.0, 1.0)) * uCErode * 0.5, 1.0, 0.0, 1.0);
  }
  return max(clamp(d, 0.0, 1.0), root) * uCDens;
}

// Altitud radial en el sistema tangente de la cámara. La forma racional evita
// restar dos radios grandes y perder precisión cerca de la base de las nubes.
float cloudAltitude(vec3 p) {
  float r = CLOUD_RADIUS + p.y;
  float horizontal2 = dot(p.xz, p.xz);
  return p.y + horizontal2 / (sqrt(r*r + horizontal2) + r);
}

// La nube madre y su condensación comparten una sola marcha y una sola transmitancia.
// El intervalo del embudo, bajo la base, se recorre únicamente si el rayo lo atraviesa.
// Los intervalos se ordenan por distancia: la luz del fondo nunca tapa el primer volumen.
float atmosphericDensity(vec3 p, bool full) {
  float d = 0.0;
  float altitude = cloudAltitude(p);
  if (altitude >= uCBase && altitude <= uCBase + uCThick) {
    float hf = (altitude-uCBase) / max(uCThick,1.0);
    d = cloudDensity(p, hf, full);
  }
  return max(d, tornadoCondensation(p));
}

// Envolvente, erosión y dispersión de orden múltiple según Nubis, Evolved (SIGGRAPH 2022).
// La fase se calcula por rayo. Los órdenes sucesivos pierden direccionalidad, energía y extinción.
vec4 cloudPhase(float angle) {
  vec4 g = vec4(0.62, 0.42, 0.27, 0.16);
  vec4 phase;
  for (int i = 0; i < 4; i++) phase[i] = mix(hgPhase(angle, g[i]), hgPhase(angle, -g[i] * 0.45), 0.28);
  return phase * vec4(1.0, 0.50, 0.25, 0.125) * (4.0 * PI * 0.72);
}
// La zona de llegada viaja con el estado interpolado, sin un segundo CloudField.
// Solo modula la iluminación del volumen existente, no inventa nubes.
float stormFrontMask(vec3 p) {
  if (uStormFront.w < 0.001) return 0.0;
  float along = dot(p.xz, uStormFront.xy);
  float edge = mix(5200.0, -1400.0, clamp(uStormFront.z, 0.0, 1.0));
  return uStormFront.w * smoothstep(edge - 1600.0, edge + 1600.0, along);
}

vec2 scatterCloudLight(vec3 p, vec3 dir, vec4 phase, float stepSize, bool inCloud) {
  float depth = 0.0, distance = 0.0;
  for (int j = 0; j < 4; j++) {
    if (!inCloud && j >= 2) break;
    float stepLen = stepSize * (1.0 + 0.6 * float(j));
    depth += atmosphericDensity(p + dir * (distance + stepLen * 0.5), false) * stepLen;
    distance += stepLen;
  }
  vec4 beer = exp(-depth * vec4(0.011, 0.0055, 0.00275, 0.001375));
  return vec2(dot(beer, phase), beer.x);
}

// Intersección con una esfera centrada a CLOUD_RADIUS metros bajo el plano
// tangente. Se factoriza c y se obtiene la segunda raíz por el producto c/q.
vec2 cloudSphereHits(vec3 rd, float height) {
  float b = (CLOUD_RADIUS + uCamY) * rd.y;
  float c = (uCamY-height) * (2.0*CLOUD_RADIUS + uCamY + height);
  float disc = b*b - c;
  if (disc <= 0.0) return vec2(-1.0);
  float q = -b - (b < 0.0 ? -sqrt(disc) : sqrt(disc));
  float other = c / q;
  return vec2(min(q,other), max(q,other));
}

${SKY_PLANET}

// rgb = dispersión, a = transmitancia. La condensación inferior añade hasta 12 muestras.
vec4 cloudLayer(vec3 rd, out float workRatio) {
  workRatio = 0.0;
  vec3 ro = vec3(0.0, uCamY, 0.0);
  vec2 outer = cloudSphereHits(rd, uCBase + uCThick);
  vec2 inner = cloudSphereHits(rd, uCBase);
  float cloudNear = max(0.0, outer.x);
  float cloudFar = min(CLOUD_REACH, outer.y);
  // Recorremos el tramo visible más cercano de la envolvente.
  if (inner.x > cloudNear) cloudFar = min(cloudFar, inner.x);
  else if (inner.y > cloudNear) cloudNear = inner.y;
  if (rd.y < 0.0 && uCamY >= 0.0) {
    float horizon = cloudSphereHits(rd, 0.0).x;
    if (horizon >= 0.0) cloudFar = min(cloudFar, horizon);
  }
  cloudFar = min(cloudFar, cloudNear + 11000.0);
  int cloudSteps = cloudFar > cloudNear ? uCloudSteps : 0;

  float funnelNear = 0.0, funnelFar = 0.0;
  if (uTornadoCloud.w > 0.005 && uTornadoShape.z > 0.005) {
    vec2 delta = uCamXZ-uTornadoCloud.xy;
    float radius = max(15.0,uTornadoCloud.z*1.6);
    float a = dot(rd.xz,rd.xz), b = dot(delta,rd.xz), c = dot(delta,delta)-radius*radius;
    float nearT = 0.0, farT = 26000.0;
    if (a > 0.000001) {
      float disc = b*b-a*c;
      if (disc > 0.0) {
        float sq = sqrt(disc);
        nearT = max(0.0,(-b-sq)/a); farT = min(farT,(-b+sq)/a);
      } else farT = 0.0;
    } else if (c > 0.0) farT = 0.0;
    // La base nubosa ya forma parte de cloudDensity. Bajo ella no duplicamos muestras.
    float bottomY = mix(uTornadoShape.y,uTornadoShape.x,clamp(uTornadoShape.z,0.0,1.0));
    float topY = min(uCBase,max(bottomY+1.0,uTornadoShape.y));
    if (abs(rd.y) > 0.00001) {
      float y0 = (bottomY-uCamY)/rd.y, y1=(topY-uCamY)/rd.y;
      nearT = max(nearT,min(y0,y1)); farT = min(farT,max(y0,y1));
    } else if (uCamY < bottomY || uCamY > topY) farT=0.0;
    funnelNear=max(0.0,nearT);funnelFar=max(funnelNear,farT);
  }
  int funnelSteps = funnelFar > funnelNear ? 12 : 0;
  if (cloudSteps == 0 && funnelSteps == 0) return vec4(0.0,0.0,0.0,1.0);
  float cloudDt = (cloudFar-cloudNear)/max(1.0,float(cloudSteps));
  float funnelDt = (funnelFar-funnelNear)/max(1.0,float(funnelSteps));
  float jitter = fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715))));
  float T=1.0, lowerT=1.0;vec3 acc=vec3(0.0);
  bool hasSun = dot(uSunColor, uSunColor) > 0.000001;
  bool hasMoon = dot(uMoonColor, uMoonColor) > 0.000001;
  vec4 sunPhase = hasSun ? cloudPhase(dot(rd, uSunDir)) : vec4(0.0);
  vec4 moonPhase = hasMoon ? cloudPhase(dot(rd, uMoonDir)) : vec4(0.0);
  float lstep=clamp(uCThick*0.07,40.0,160.0);
  int ci=0,fi=0,executedSteps=0;
  bool searchEnvelope = true;
  for (int i=0;i<76;i++) {
    if ((ci>=cloudSteps && fi>=funnelSteps) || T<0.02) break;
    executedSteps++;
    float tc=ci<cloudSteps ? cloudNear+(float(ci)+jitter)*cloudDt : 30000.0;
    float tf=fi<funnelSteps ? funnelNear+(float(fi)+jitter)*funnelDt : 30000.0;
    bool inCloud=tc<=tf;
    float t=inCloud ? tc : tf;
    float dt=inCloud ? cloudDt : funnelDt;
    // En aire vacío la envolvente permite saltar dos intervalos. Al detectar masa,
    // se vuelve al primer intervalo y se evalúa la erosión con la resolución fina.
    if (searchEnvelope && inCloud && ci + 1 < cloudSteps && dt <= 240.0 && tc + dt < tf) {
      if (atmosphericDensity(ro + rd * (t + 0.5 * dt), false) <= 0.001) { ci += 2; continue; }
    }
    if (inCloud) ci++; else fi++;
    vec3 p=ro+rd*t;
    float d=atmosphericDensity(p,true);
    if (inCloud) {
      searchEnvelope = d <= 0.004;
      d *= 1.0 - smoothstep(0.68 * CLOUD_REACH, CLOUD_REACH, t);
    }
    if (d<=0.004) continue;
    float hf=clamp((cloudAltitude(p)-uCBase)/uCThick,0.0,1.0);
    vec2 sunScatter = hasSun ? scatterCloudLight(p, uSunDir, sunPhase, lstep, inCloud) : vec2(0.0, 1.0);
    vec2 moonScatter = hasMoon ? scatterCloudLight(p, uMoonDir, moonPhase, lstep, inCloud) : vec2(0.0, 1.0);
    float powder=1.0-exp(-d*3.2);
    float beer = min(sunScatter.y, moonScatter.y);
    vec3 sunL = (uSunColor * sunScatter.x + uMoonColor * moonScatter.x) * uCLight * mix(1.0,powder*1.8,0.55*(1.0-hf));
    vec3 ambL=uCAmb*mix(0.35,1.25,hf)*(0.55+0.45*pow(beer, 0.36));
    float frontShadow = stormFrontMask(p);
    sunL *= 1.0 - 0.36 * frontShadow;
    ambL *= 1.0 - 0.27 * frontShadow;
    // La masa inferior de la nube intercepta luz como el resto de la tormenta.
    // Conserva uCTint/uCAmb/uSunColor: no existe un color exclusivo del tornado.
    if (uTornadoCloud.w > 0.005 && p.y >= uCBase && hf < 0.25) {
      float dist = length(p.xz + uCamXZ - uTornadoCloud.xy) / max(15.0,uTornadoCloud.z);
      float mass = (1.0-smoothstep(0.4,2.3,dist))*(1.0-smoothstep(0.03,0.25,hf))*uTornadoCloud.w;
      float shadow = mass*(1.0-beer);
      sunL *= 1.0-0.45*shadow;
      ambL *= 1.0-0.18*shadow;
    }
    float alpha=1.0-exp(-d*0.0105*dt);
    // Inyección local de luz DENTRO de la misma marcha de condensado. No hay
    // billboards ni relámpagos de azar en el renderer. El canal sigue siendo LightningFX.
    vec3 internalFlash = vec3(0.0);
    if (inCloud && uLightningEnergy > 0.001 && uLightningCloud.w > 1.0) {
      vec3 worldP = p + vec3(uCamXZ.x, 0.0, uCamXZ.y);
      vec3 offset = (worldP - uLightningCloud.xyz) / vec3(uLightningCloud.w, max(240.0, uCThick * 0.52), uLightningCloud.w);
      float nearStrike = 1.0 - smoothstep(0.08, 1.0, length(offset));
      internalFlash = vec3(0.62, 0.73, 1.0) * (3.4 * uLightningEnergy * nearStrike);
    }
    acc+=T*alpha*(sunL+ambL)*uCTint;
    acc+=T*alpha*internalFlash*uCTint; // luz de la misma descarga, sin nuevo pase
    T*=1.0-alpha;
    if (!inCloud) lowerT*=1.0-alpha;
  }
  // El límite del cilindro es una optimización, no una máscara visible.
  // La calima solo se atenúa donde hay condensación inferior REAL.
  float lowerOpacity=clamp(1.0-lowerT,0.0,1.0);
  float k=cloudSteps > 0 ? 1.0-exp(-cloudNear*0.000075) : 0.0;
  acc=mix(acc,uCAmb*0.95*(1.0-T),k*0.65*(1.0-lowerOpacity));
  // Nº REAL de iteraciones ejecutadas del raymarch, normalizado por el máximo
  // permitido en este píxel. No es medición de tiempo GPU ni de lecturas GLSL.
  workRatio = float(executedSteps) / max(1.0, float(uCloudSteps+funnelSteps));
  return vec4(acc,T);
}

// estrellas: celdas 3D con una estrella como mucho; brillo y color (azuladas/anaranjadas) por celda
// Giran con la hora alrededor del polo celeste (como la luna y el sol) y NO se cortan en los bordes de la celda: el desplazamiento
// máximo (0.1) más el radio (≤ 0.4) nunca pasa de 0.5. Cada estrella tiene un núcleo a brillo pleno de medio píxel de radio (más el
// borde suave): así el píxel más cercano siempre la ve entera y no titila al mover la cámara (con el perfil puntiforme anterior,
// cada estrella cambiaba ~11 % de brillo —hasta ~37 %— por cada 0,1° de giro).

float frostHash(vec2 v) { return fract(sin(dot(v, vec2(12.9898, 78.233))) * 43758.5453); }
// Estrellas reales: la dirección se convierte a (RA, Dec) con la latitud y el tiempo sidéreo y se buscan, en el atlas de cubo del cielo
// (world/starcat.js), las estrellas que quedan cerca. Cada una es un DISCO de brillo pleno cuyo radio sigue al tamaño del píxel
// (0,72 píxeles: el píxel más cercano al centro siempre cae dentro, así que el brillo no depende de la fase de muestreo y las estrellas
// no aparecen ni desaparecen al mover la cámara) con un borde suave. Es función de la dirección y la hora, nada más: la constelación
// no depende de la cámara. Las tablas de caras repiten las de starcat.js.
const vec3 SFN[6] = vec3[6](vec3(1.0, 0.0, 0.0), vec3(-1.0, 0.0, 0.0), vec3(0.0, 1.0, 0.0), vec3(0.0, -1.0, 0.0), vec3(0.0, 0.0, 1.0), vec3(0.0, 0.0, -1.0));
const vec3 SFR[6] = vec3[6](vec3(0.0, 0.0, -1.0), vec3(0.0, 0.0, 1.0), vec3(1.0, 0.0, 0.0), vec3(1.0, 0.0, 0.0), vec3(1.0, 0.0, 0.0), vec3(-1.0, 0.0, 0.0));
const vec3 SFU[6] = vec3[6](vec3(0.0, 1.0, 0.0), vec3(0.0, 1.0, 0.0), vec3(0.0, 0.0, -1.0), vec3(0.0, 0.0, 1.0), vec3(0.0, 1.0, 0.0), vec3(0.0, 1.0, 0.0));
const float SN = 256.0;                                                // texels por lado de cada cara
const float STAR_RMAX = 0.0044;                                        // radio máximo de una estrella (rad): lo que garantiza la búsqueda 3×3
int starFace(vec3 p, out vec2 uv) {
  vec3 a = abs(p); int f;
  if (a.x >= a.y && a.x >= a.z) f = p.x > 0.0 ? 0 : 1; else if (a.y >= a.z) f = p.y > 0.0 ? 2 : 3; else f = p.z > 0.0 ? 4 : 5;
  uv = atan(vec2(dot(p, SFR[f]), dot(p, SFU[f])) / dot(p, SFN[f])) * 1.2732395;      // equiangular: 4/π
  return f;
}
vec3 starDirOf(int f, vec2 uv) { vec2 t = tan(uv * 0.7853982); return normalize(SFN[f] + t.x * SFR[f] + t.y * SFU[f]); }
vec3 catalogStars(vec3 d, float pa) {                                  // pa = tamaño angular de un píxel (rad)
  float n = -d.z;                                                      // norte = −Z
  float sl = sin(uLat), cl = cos(uLat), sT = sin(uLst), cT = cos(uLst);
  // Del horizonte al marco ecuatorial girando el vector (sin asin ni atan: cerca del polo, donde dec → 90°, los ángulos pierden la
  // precisión y las estrellas se corrían y estiraban). (xH, yH, zE) = (cos dec·cos H, cos dec·sin H, sin dec), con ra = LST − H.
  float xH = cl * d.y - sl * n, yH = -d.x, zE = sl * d.y + cl * n;
  vec3 e = vec3(cT * xH + sT * yH, sT * xH - cT * yH, zE);             // (cos dec·cos ra, cos dec·sin ra, sin dec)
  vec2 uv; int f = starFace(e, uv);
  ivec2 c0 = ivec2(floor((uv * 0.5 + 0.5) * SN));
  float rc0 = max(uStarCore * pa, 0.0004), soft = max(0.0006, 0.5 * pa);
  float turb = pow(1.0 - clamp(d.y, 0.0, 1.0), 1.45);                  // más centelleo cerca del horizonte
  vec3 acc = vec3(0.0);
  for (int dj = -1; dj <= 1; dj++) for (int di = -1; di <= 1; di++) {
    vec2 q = (vec2(c0 + ivec2(di, dj)) + 0.5) / SN * 2.0 - 1.0;        // centro del texel vecino (si se sale de la cara, cae en la contigua)
    vec2 uv2; int f2 = starFace(starDirOf(f, q), uv2);
    ivec2 c2 = ivec2(clamp(floor((uv2 * 0.5 + 0.5) * SN), 0.0, SN - 1.0));
    ivec2 tc = ivec2(f2 * int(SN) + c2.x, c2.y);
    vec4 sm = texelFetch(uStarTex, tc, 0);
    if (sm.a <= 0.0) continue;
    vec3 sd = starDirOf(f2, (vec2(c2) + texelFetch(uStarOff, tc, 0).rg) / SN * 2.0 - 1.0);
    float r = length(e - sd), b = sm.a;
    float rc = min(max(rc0, 0.0004 + 0.0011 * b), STAR_RMAX - 0.0006);
    float ro = min(rc + soft, STAR_RMAX);
    float prof = 1.0 - smoothstep(rc, ro, r);
    prof += b * b * 0.30 * (1.0 - smoothstep(rc, STAR_RMAX, r));   // halo de las brillantes
    float rnd = frostHash(vec2(tc));
    float w = sin(uTime * (4.0 + rnd * 7.0) + rnd * 37.0);
    float tw = 1.0 + w * (0.035 + turb * 0.24);
    float sh = w * turb * 0.055;
    acc = max(acc, sm.rgb * vec3(1.0 + sh, 1.0, 1.0 - sh) * (prof * b * tw * 4.2));
  }
  return acc * smoothstep(-0.015, 0.055, d.y);
}
vec3 frostBody(vec3 v, vec3 b, vec3 c, float br, float r) {
  float alt = smoothstep(-0.035, 0.045, b.y);
  float vr = max(r, 0.00078), ch = length(v - b);
  float core = 1.0 - smoothstep(vr * 0.42, vr * 1.08, ch), halo = 1.0 - smoothstep(vr, vr * 5.8, ch);
  return c * br * alt * (core * 2.7 + halo * 0.13);
}
// Luna real: disco con la fase que da la luz del sol sobre una esfera, y albedo fijo (siempre la misma cara).
vec3 frostMoon(vec3 v) {
  vec3 md = normalize(uMoonDir), mr = normalize(uMoonRight), mu = normalize(uMoonUp);
  float alt = smoothstep(-0.035, 0.045, md.y);
  float radius = max(uMoonRad, 0.0041), ch = length(v - md);
  float disk = 1.0 - smoothstep(radius * 0.955, radius * 1.025, ch);
  vec2 lp = clamp(vec2(dot(v, mr), dot(v, mu)) / radius, -1.25, 1.25);
  float z = sqrt(clamp(1.0 - clamp(dot(lp, lp), 0.0, 1.0), 0.0, 1.0));
  vec3 nrm = normalize(mr * lp.x + mu * lp.y - md * z);
  float direct = smoothstep(-0.035, 0.06, dot(nrm, normalize(uAstroSun)));
  float light = clamp(direct + (1.0 - uMoonIllum) * 0.010, 0.0, 1.0);
  float alb = mix(0.42, 1.18, clamp(texture2D(uMoonTex, clamp(lp * 0.5 + 0.5, 0.0, 1.0)).r, 0.0, 1.0));
  float limb = mix(0.58, 1.0, pow(z, 0.55)), rim = smoothstep(0.0, 0.42, z);
  float surf = alb * limb * mix(0.90, 1.0, rim);
  float inner = 1.0 - smoothstep(radius, radius * 4.2, ch), outer = 1.0 - smoothstep(radius * 2.0, radius * 9.0, ch);
  vec3 mc = vec3(1.0, 0.965, 0.89), br = vec3(pow(max(uMoonIllum, 0.0), 0.65));
  vec3 diskC = mc * max(0.10, br.x) * light * surf * disk * mix(1.10, 1.55, clamp(uMoonIllum, 0.0, 1.0)) * 0.5;
  vec3 haloC = mc * br.x * (inner * 0.105 + outer * 0.018);
  return (diskC + haloC) * alt;
}
vec3 starField(vec3 d, float pa) {                 // pa = tamaño angular de un píxel (rad)
  float ca = cos(uStarAng), sa = sin(uStarAng);
  d = d * ca + cross(uStarAxis, d) * sa + uStarAxis * dot(uStarAxis, d) * (1.0 - ca);
  vec3 p = d * 150.0, i = floor(p), f = fract(p) - 0.5;
  float px = pa * 150.0;                              // tamaño de un píxel en celdas
  float core = clamp(px * uStarCore, 0.05, 0.3);      // núcleo a brillo pleno: el píxel más cercano (a ≤ 0,71 px) siempre cae dentro, así que la estrella no titila al mover la cámara
  float rad = clamp(core + 0.1, 0.3, 0.4);            // radio total: desplazamiento máximo 0,1 + 0,4 = 0,5: no se corta en el borde de la celda
  float h = hash13(i);
  float on = step(0.9886, h);
  vec3 o = (vec3(hash13(i + 1.7), hash13(i + 3.1), hash13(i + 5.9)) - 0.5) * 0.2;
  // La estrella vive en 3D (centro de su celda + o) pero se ve donde la esfera del cielo pasa a su lado. Solo cuentan las que quedan
  // a menos de 0.21 celdas de la esfera y se dibujan con el tamaño y brillo de su sección a esa distancia: así todas tienen el mismo
  // tamaño (antes, las que rozaban la esfera eran puntos diminutos que aparecían y desaparecían al mover la cámara).
  float dist = length((i + 0.5 + o) / 150.0) - 1.0;
  float hh = abs(dist) * 150.0;
  float lat = sqrt(max(dot(f - o, f - o) - hh * hh, 0.0));
  float s = on * step(hh, 0.21) * smoothstep(rad, core, lat) * (0.35 + 0.65 * hash13(i + 9.0));
  s *= 0.92 + 0.08 * sin(uTime * 1.5 + h * 90.0);
  return mix(vec3(0.72, 0.84, 1.0), vec3(1.0, 0.88, 0.7), hash13(i + 2.0)) * s * 2.4;
}

vec3 physicalSky(vec3 dir, out vec3 solarDisk) {
  const vec3 totalRayleigh = vec3(5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5);
  const vec3 MieConst = vec3(1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14);
  vec3 up = vec3(0.0, 1.0, 0.0);
  float zc = clamp(dot(uSunDir, up), -1.0, 1.0);
  float sunE = 1000.0 * max(0.0, 1.0 - exp(-((1.6110731556870734 - acos(zc)) / 1.5)));
  float sunfade = 1.0 - clamp(1.0 - exp(uSunDir.y), 0.0, 1.0);
  vec3 betaR = totalRayleigh * max(0.0, uRayleigh - (1.0 - sunfade));
  vec3 betaM = 0.434 * (0.2 * uTurb) * 10E-18 * MieConst * uMie;
  float zenith = acos(max(0.0, dot(up, dir)));
  float inv = 1.0 / (cos(zenith) + 0.15 * pow(93.885 - ((zenith * 180.0) / PI), -1.253));
  vec3 Fex = exp(-(betaR * 8.4E3 * inv + betaM * 1.25E3 * inv));
  float cosT = dot(dir, uSunDir);
  float rPh = 0.05968310365946075 * (1.0 + pow(cosT * 0.5 + 0.5, 2.0));
  float mPh = hgPhase(cosT, uMieG);
  vec3 bR = betaR * rPh, bM = betaM * mPh;
  vec3 phase = (bR + bM) / max(betaR + betaM, vec3(1e-9));
  vec3 Lin = pow(sunE * phase * (1.0 - Fex), vec3(1.5));
  Lin *= mix(vec3(1.0), pow(sunE * phase * Fex, vec3(0.5)), clamp(pow(1.0 - zc, 5.0), 0.0, 1.0));
  vec3 L0 = vec3(0.1) * Fex;
  float disk = smoothstep(0.999956676946448, 0.999956676946448 + 0.00002, cosT);
  // El disco yace detrás del volumen. Su transmitancia depende del rayo de vista.
  float beamTransmission = uClouds == 1 ? 1.0 : uSolarTransmission;
  vec3 beam = (sunE * 19000.0 * Fex) * disk * beamTransmission;
  vec3 tex = (Lin + L0) * 0.04 + vec3(0.0, 0.0003, 0.00075);
  vec3 exponent = vec3(1.0 / (1.2 + 1.2 * sunfade));
  vec3 diffuse = pow(tex, exponent);
  solarDisk = disk > 0.0 ? (pow(tex + beam * 0.04, exponent) - diffuse) * (1.0 - uNight) : vec3(0.0);
  return diffuse;
}

void main() {
  vec3 dir = normalize(vDir);
  float pxAng = max(length(dFdx(dir)), length(dFdy(dir)));   // tamaño angular de un píxel (fuera de ramas: las derivadas lo exigen)
  // El límite angular de la esfera también alinea el gradiente con su silueta.
  float eyeHeight = max(0.0, uCamY);
  float horizonDip = sqrt(eyeHeight * (2.0 * CLOUD_RADIUS + eyeHeight)) / (CLOUD_RADIUS + eyeHeight);
  float skyY = dir.y + horizonDip;
  vec3 col, solarDisk = vec3(0.0);
  if (uMode == 1) {
    col = mix(physicalSky(dir, solarDisk) * 0.28, mix(horizon, top, smoothstep(0.0, 0.85, dir.y)), uNight);
  } else if (uMode == 2) {
    float a = atan(dir.z, dir.x) / (2.0 * PI) + 0.5 + uRotation / 360.0;
    float v = acos(clamp(dir.y, -1.0, 1.0)) / PI;
    col = texture2D(uPano, vec2(fract(a), mix(1.0 - v, v, uPanoFlip))).rgb * uTint * mix(1.0, 0.05, uNight);
  } else {
    float va = acos(clamp(skyY, -1.0, 1.0));
    float c = 1.0 - va / 1.5707963;
    col = mix(horizon, top, clamp(1.0 - pow(max(1.0 - c, 0.0), 1.0 / 0.15), 0.0, 1.0));
  }
  col *= uExposure;
  // El Inspector puede conservar cielo y sol manuales, pero la tormenta cubre TODA la
  // bóveda: la calima no debe iluminar el horizonte ni desaparecer por mirar abajo.
  if (uStormCover > 0.001) {
    vec3 overcast = mix((uCTint * 0.82 + uCAmb * 0.18) * 0.65, uCAmb * 0.8, uNight);
    col = mix(col, overcast, uStormCover);
  }
  vec3 preCelestial = col;
  if (uMode != 2) {                                   // un panorama HDRI ya trae su propio cielo
    if (uAstro > 0.5) {
      if (uStars > 0.001 && dir.y > -0.02) {
        col += catalogStars(dir, pxAng) * uStars;
        for (int i = 0; i < 5; i++) col += frostBody(dir, uPlDir[i], uPlCol[i].rgb, uPlCol[i].a, uPlRad[i]) * uStars;
      }
    } else if (uStars > 0.001 && dir.y > -0.02) col += starField(dir, pxAng) * uStars * smoothstep(-0.02, 0.12, dir.y);
  }
  col = mix(preCelestial, col, 1.0 - 0.97 * uStormCover);
  col += solarDisk * (0.38 * uExposure);
  if (uMode != 2 && uMoonVis > 0.001) col += frostMoon(dir) * uMoonVis;
  if (uMode != 2) col = planetBackdrop(dir, skyY, pxAng, eyeHeight, col, preCelestial);
  if (uFlash > 0.001) col += uFlash * vec3(0.55, 0.62, 0.8) * (0.35 + 0.65 * smoothstep(-0.1, 0.7, dir.y))
    * (uLightningEnergy > 0.001 ? 0.18 : 1.0); // descarga localizada: no blanquear toda la bóveda
  float cloudWorkRatio = 0.0;
  if (uClouds == 1) {
    vec3 background = col;
    vec4 cl = cloudLayer(dir, cloudWorkRatio);
    col = col * cl.a + cl.rgb;
    // Desde abajo, la nube que roza la silueta se funde con la bruma.
    float horizonHaze = (1.0 - smoothstep(0.0, 0.10, max(0.0, skyY)))
                      * (1.0 - smoothstep(120.0, 1000.0, eyeHeight));
    float haze = uMode == 2 ? 0.0 : 0.72 * horizonHaze * (1.0 - uStormCover);
    col = mix(col, background, haze);
  }
  if (uCloudDiagnostic == 1) {
    // Mapa térmico exclusivo de la marcha de nubes. Se conserva la silueta
    // nubosa mediante mezcla; el verde oscuro corresponde a 0 iteraciones.
    float r = clamp(cloudWorkRatio, 0.0, 1.0);
    vec3 low = vec3(0.07, 0.48, 0.21);
    vec3 mid = vec3(0.95, 0.76, 0.15);
    vec3 high = vec3(0.85, 0.11, 0.16);
    vec3 heat = r < 0.5 ? mix(low, mid, r*2.0) : mix(mid, high, (r-0.5)*2.0);
    col = mix(col, heat, 0.75);
  }
  // FogExp2 de Three solo afecta mallas con su chunk de niebla: Sky usa shader propio.
  // El aire frente a una bóveda lejana recibe la misma niebla horizontal, sin umbral
  // dependiente de dir.y. Con niebla física la composición se hace en el pase existente.
  if (uSkyFogDensity > 0.0) {
    const float skyDistance = 2400.0;
    float tau = uSkyFogDensity * skyDistance;
    float transmission = exp(-tau * tau);
    if (uWeatherHazeFalloff > 0.0) {
      float height = uWeatherHazeFalloff * max(0.0, dir.y) * skyDistance;
      float path = height < 0.001 ? 1.0 : (1.0 - exp(-height)) / height;
      transmission = exp(-tau * path * exp(-uWeatherHazeFalloff * max(0.0, uCamY)));
    }
    col = mix(uSkyFogColor, col, transmission);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`
