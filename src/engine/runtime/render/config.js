// Configuración de render del proyecto (project.render): valores por defecto, presets y normalización. Sin dependencias del DOM.
export const MIN_RENDER_SCALE = 0.25

export const RENDER_DEFAULTS = {
  backend: 'webgl',
  look: 'realista',            // 'realista' | 'clasico'
  profile: 'alto',             // 'alto' | 'medio' | 'bajo'
  shader: '',                  // shader por defecto de los materiales ('' = Realista incluido)
  psx: false,                 // estilo de píxeles PSX (apagado en proyectos existentes)
  psxHeight: 240,             // resolución vertical: 240, 480 o 0 (nativa)
  psxSnap: 0,                // 0 = sin movimiento de vértices; 1–4 = cuadrícula de píxeles
  psxContinuous: false,
  psxAffine: false,          // interpolación affine de la textura base en modelos GLTF con UV0
  tonemap: 'aces',             // 'aces' | 'agx' | 'neutral' | 'lineal'
  exposure: 0.9,
  // adaptación automática de exposición («ojo»): 0 = apagada. Mide el brillo y lo lleva a `aeKey` con el tiempo
  autoExposure: 0, aeKey: 0.25, aeSpeedUp: 3, aeSpeedDown: 1, aeMin: -3, aeMax: 3,
  reflections: 0.7,            // cuánto ilumina y refleja el cielo
  dynamicReflections: false,
  puddleReflections: false, puddleReflectionStrength: 0.65,
  ssr: false,                 // opt-in: refleja solo geometría visible en pantalla (independiente de IBL)
  ssrQuality: 'media',        // resolución interna del efecto: baja, media o alta
  ssrStrength: 0.45, ssrDistance: 30,
  screenBounce: 0, worldRayBounce: false, worldRayBounceCount: 1, bounceDistance: 3, indirectProbeGrid: false, indirectProbeCoverage: 'local',
  worldRayReflection: 0, worldRayReflectionDistance: 30,
  ao: 0.9, aoRadius: 0.7,
  bloom: 0.45, bloomThreshold: 0.85, bloomRadius: 0.55,
  vignette: 0.4, grain: 0,   // sin grano por defecto: el ruido por píxel molesta (se activa en Render o en un perfil)
  saturation: 0.92, contrast: 1.08,
  // profundidad de campo: dofBlur = radio máximo del desenfoque en píxeles a 1080p (0 = apagada), dofFocus = distancia de enfoque (m), dofRange = zona nítida (m)
  dofBlur: 0, dofFocus: 8, dofRange: 4, dofAuto: false,
  lut: '', lutStrength: 1,     // LUT de color (textura de Assets: tira N²×N o Hald); lutStrength la mezcla con la imagen
  shadowTint: '#8fa8c9', highlightTint: '#ffd9ae', tintStrength: 0.35,
  chromatic: 0,
  // gradación de color (como DaVinci / Premiere): ruedas Lift · Gamma · Gain · Offset (x, y = color; m = luminosidad; −1…1),
  // balance de blancos, tono y vibrance; viñeta con radio y color. Todo en 0 = sin cambios.
  liftX: 0, liftY: 0, liftM: 0, gammaX: 0, gammaY: 0, gammaM: 0, gainX: 0, gainY: 0, gainM: 0, offsetX: 0, offsetY: 0, offsetM: 0,
  temperature: 0, tintGreen: 0, hue: 0, vibrance: 0, vignetteRadius: 0.5, vignetteColor: '#000000',
  // rendimiento (solo jugando): con resScale < 1 se dibuja a una fracción de la resolución y se escala (MSAA ×4 en la escena)
  taa: false,                  // OBSOLETO (0.26.9): el TAA se retiró (parpadeos, fantasmas y el modo dividido); siempre false
  resScale: 1,                 // resolución interna (1 = nativa), fija
  spatialReconstruction: 'catmull', // Catmull-Rom, protección de bordes, bilineal o vecino más cercano
  dynRes: false,               // OBSOLETO (0.26.9): la resolución dinámica se retiró; siempre false
  performanceAuto: true,       // controlador de presupuesto durante Play/Player; conserva forward y resolución
  targetFps: 60,               // objetivo del controlador; no garantiza rendimiento en cualquier hardware
  minScale: 0.6,               // OBSOLETO: solo lo usaba la resolución dinámica
  lod: true, lodQuality: 1, drawDistance: 1,   // LOD de terreno/mallas, instancias y culling al jugar
  environmentLook: false,     // temperatura y exposición a partir de hora y clima
  staticOcclusion: false,      // visibilidad precalculada por escena
  meshErrorLod: false, clusterGeometry: false,
  batchStatic: false,         // BatchedMesh opcional solo para decoración marcada expresamente
  sharpen: 0.3,                // nitidez adaptativa que compensa la reconstrucción
}

/** Proyectos anteriores a Jolt/PBR: se ven exactamente como antes. */
export const CLASSIC_RENDER = { ...RENDER_DEFAULTS, look: 'clasico', profile: 'bajo', exposure: 1, reflections: 1, ao: 0, bloom: 0, vignette: 0, grain: 0, saturation: 1, contrast: 1, tintStrength: 0, chromatic: 0, tonemap: 'lineal', taa: false, resScale: 1, dynRes: false, sharpen: 0, lod: false }

/**
 * Método de renderizado (Forward+ / Mobile / Compatibility). Se elige al crear el proyecto y se puede cambiar después.
 * No es un ajuste nuevo: es un conjunto de valores de `project.render` (look + calidad + efectos); `methodOf` lo deduce de ellos.
 */
export const RENDERERS = [
  { id: 'forward', name: 'Forward+', tag: 'Escritorio · máxima calidad',
    desc: 'Gráficos avanzados: oclusión ambiental, bloom, gradación de color, niebla volumétrica y baking de luz. La resolución interna es fija; TAA y resolución dinámica permanecen retirados. Reconstrucción espacial opcional al jugar.',
    pros: ['Oclusión ambiental (AO)', 'Reconstrucción espacial configurable', 'Todos los efectos'], cons: ['Exige mayor presupuesto de GPU'] },
  { id: 'mobile', name: 'Mobile', tag: 'Portátiles y GPU integradas',
    desc: 'Equilibrio entre aspecto y coste: PBR con bloom y gradación de color, pero sin oclusión ambiental ni TAA. Pensado para portátiles, GPU integradas y móviles.',
    pros: ['PBR + bloom + color', 'Coste moderado'], cons: ['Sin AO ni TAA'] },
  { id: 'compat', name: 'Compatibility', tag: 'Máxima compatibilidad',
    desc: 'El aspecto clásico: sin efectos de post-proceso, tonos lineales y el menor coste. Funciona en casi cualquier equipo y es ideal para estilos simples o equipos modestos.',
    pros: ['Funciona en todo', 'Mínimo coste'], cons: ['Sin efectos de post-proceso'] },
]
export const DEFAULT_RENDERER = 'forward'
const RENDERER_PRESETS = {
  forward: () => ({ ...RENDER_DEFAULTS }),
  mobile: () => ({ ...RENDER_DEFAULTS, profile: 'medio', ao: 0, resScale: 1, sharpen: 0 }),
  compat: () => ({ ...CLASSIC_RENDER }),
}
/** Ajustes de render para un método (`forward` | `mobile` | `compat`). */
export const rendererPreset = (id) => (RENDERER_PRESETS[id] || RENDERER_PRESETS[DEFAULT_RENDERER])()
/** Método que corresponde a unos ajustes de render (los proyectos antiguos sin `render` son «compat»). */
export function methodOf(render) {
  if (!render || render.look === 'clasico') return 'compat'
  return render.profile === 'alto' ? 'forward' : 'mobile'
}
export const rendererName = (id) => RENDERERS.find((r) => r.id === id)?.name || id

const PRESETS = {
  realista: RENDER_DEFAULTS,
  clasico: CLASSIC_RENDER,
}
export const RENDER_PRESETS = [['realista', 'Realista (baja luz, cinematográfico)'], ['clasico', 'Clásico (sin efectos)']]
export const presetOf = (name) => ({ ...(PRESETS[name] || RENDER_DEFAULTS) })

/** Claves de las ruedas de color (x, y y luminosidad de Lift, Gamma, Gain y Offset). */
export const GRADE_WHEELS = ['lift', 'gamma', 'gain', 'offset']
export const GRADE_WHEEL_KEYS = GRADE_WHEELS.flatMap((w) => [w + 'X', w + 'Y', w + 'M'])
/** Posición de una rueda (x, y en el círculo) → desplazamiento RGB (el rojo a 0°, verde a 120°, azul a 240°). */
export function wheelRGB(x = 0, y = 0, m = 0) {
  const a = Math.atan2(y, x), r = Math.min(1, Math.hypot(x, y))
  return [m + r * Math.cos(a), m + r * Math.cos(a - (2 * Math.PI) / 3), m + r * Math.cos(a + (2 * Math.PI) / 3)]
}
const num = (v, d, a, b) => (Number.isFinite(+v) && v !== '' && v !== null ? Math.min(b, Math.max(a, +v)) : d)
const hexOr = (v, d) => (/^#[0-9a-f]{6}$/i.test(v) ? v : d)

/** Config válida a partir de datos del proyecto (valores que faltan = por defecto; sin `render` = clásico). */
export function normalizeRender(r) {
  if (!r || typeof r !== 'object') return { ...CLASSIC_RENDER }
  const d = r.look === 'clasico' ? CLASSIC_RENDER : RENDER_DEFAULTS
  return {
    backend: r.backend === 'webgpu' ? 'webgpu' : 'webgl',
    look: r.look === 'clasico' ? 'clasico' : 'realista',
    profile: ['alto', 'medio', 'bajo'].includes(r.profile) ? r.profile : d.profile,
    shader: typeof r.shader === 'string' ? r.shader : '',
    psx: r.psx === true,
    psxHeight: [0, 240, 480].includes(r.psxHeight) ? r.psxHeight : d.psxHeight,
    psxSnap: Math.round(num(r.psxSnap, d.psxSnap, 0, 4)),
    psxContinuous: r.psxContinuous === true,
    psxAffine: r.psxAffine === true,
    tonemap: ['aces', 'agx', 'neutral', 'lineal'].includes(r.tonemap) ? r.tonemap : d.tonemap,
    exposure: num(r.exposure, d.exposure, 0.1, 4),
    autoExposure: num(r.autoExposure, d.autoExposure, 0, 1), aeKey: num(r.aeKey, d.aeKey, 0.03, 1), aeSpeedUp: num(r.aeSpeedUp, d.aeSpeedUp, 0.1, 30), aeSpeedDown: num(r.aeSpeedDown, d.aeSpeedDown, 0.1, 30),
    aeMin: num(r.aeMin, d.aeMin, -8, 0), aeMax: num(r.aeMax, d.aeMax, 0, 8),
    reflections: num(r.reflections, d.reflections, 0, 3),
    dynamicReflections: r.dynamicReflections === true,
    puddleReflections: r.puddleReflections === true,
    puddleReflectionStrength: num(r.puddleReflectionStrength, d.puddleReflectionStrength, 0, 1),
    ssr: r.ssr === true,
    ssrQuality: ['baja', 'media', 'alta'].includes(r.ssrQuality) ? r.ssrQuality : d.ssrQuality,
    ssrStrength: num(r.ssrStrength, d.ssrStrength, 0, 1),
    ssrDistance: num(r.ssrDistance, d.ssrDistance, 0.1, 100),
    worldRayBounce: r.worldRayBounce === true,
    worldRayBounceCount: Math.round(num(r.worldRayBounceCount, d.worldRayBounceCount, 1, 3)),
    worldRayReflection: num(r.worldRayReflection, d.worldRayReflection, 0, 1),
    worldRayReflectionDistance: num(r.worldRayReflectionDistance, d.worldRayReflectionDistance, 1, 60),
    screenBounce: num(r.screenBounce, d.screenBounce, 0, 1),
    bounceDistance: num(r.bounceDistance, d.bounceDistance, 0.5, 12),
    indirectProbeGrid: r.indirectProbeGrid === true,
    indirectProbeCoverage: r.indirectProbeCoverage === 'scene' ? 'scene' : 'local',
    ao: num(r.ao, d.ao, 0, 2), aoRadius: num(r.aoRadius, d.aoRadius, 0.05, 4),
    bloom: num(r.bloom, d.bloom, 0, 3), bloomThreshold: num(r.bloomThreshold, d.bloomThreshold, 0, 4), bloomRadius: num(r.bloomRadius, d.bloomRadius, 0, 1.5),
    vignette: num(r.vignette, d.vignette, 0, 1), grain: num(r.grain, d.grain, 0, 0.5),
    dofBlur: num(r.dofBlur, d.dofBlur, 0, 24), dofFocus: num(r.dofFocus, d.dofFocus, 0.1, 500), dofRange: num(r.dofRange, d.dofRange, 0, 200), dofAuto: r.dofAuto === undefined ? d.dofAuto : !!r.dofAuto,
    lut: typeof r.lut === 'string' ? r.lut : '', lutStrength: num(r.lutStrength, d.lutStrength, 0, 1),
    saturation: num(r.saturation, d.saturation, 0, 2), contrast: num(r.contrast, d.contrast, 0.5, 2),
    shadowTint: hexOr(r.shadowTint, d.shadowTint), highlightTint: hexOr(r.highlightTint, d.highlightTint), tintStrength: num(r.tintStrength, d.tintStrength, 0, 1),
    chromatic: num(r.chromatic, d.chromatic, 0, 0.02),
    ...Object.fromEntries(GRADE_WHEEL_KEYS.map((k) => [k, num(r[k], 0, -1, 1)])),
    temperature: num(r.temperature, 0, -1, 1), tintGreen: num(r.tintGreen, 0, -1, 1), hue: num(r.hue, 0, -180, 180), vibrance: num(r.vibrance, 0, -1, 1),
    vignetteRadius: num(r.vignetteRadius, 0.5, 0.05, 1), vignetteColor: hexOr(r.vignetteColor, '#000000'),
    taa: false, resScale: num(r.resScale, d.resScale, MIN_RENDER_SCALE, 1), dynRes: false, // TAA y resolución dinámica retirados (0.26.9): un proyecto antiguo que los traía activos se carga sin ellos
    spatialReconstruction: ['linear', 'nearest', 'edge-guard'].includes(r.spatialReconstruction) ? r.spatialReconstruction : d.spatialReconstruction,
    performanceAuto: r.performanceAuto !== false,
    targetFps: num(r.targetFps, d.targetFps, 20, 240), minScale: num(r.minScale, d.minScale, 0.4, 1), sharpen: num(r.sharpen, d.sharpen, 0, 1),
    lod: r.lod === undefined ? d.lod : !!r.lod, lodQuality: num(r.lodQuality, d.lodQuality, 0.5, 2), drawDistance: num(r.drawDistance, d.drawDistance, 0.5, 2),
    environmentLook: r.environmentLook === true,
    staticOcclusion: r.staticOcclusion === true,
    meshErrorLod: r.meshErrorLod === true,
    clusterGeometry: r.clusterGeometry === true,
    batchStatic: r.batchStatic === true,
  }
}

