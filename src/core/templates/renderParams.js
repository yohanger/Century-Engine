// Ajustes de render (project.render): look, perfil de calidad y efectos. El formulario se genera con ParamForm.
import { BUILTIN_SHADERS } from '../../engine/runtime/render/shaderlib.js'
import { infoOf } from '../../engine/runtime/render/pbr.js'

export const shaderOptions = (shaders = [], withDefault = false) => [
  ...(withDefault ? [['', 'Por defecto del proyecto']] : []),
  ...BUILTIN_SHADERS.map((s) => [s.id, (infoOf(s.code).name || s.name) + ' (incluido)']),
  ...shaders.filter((s) => s.graph?.target !== 'post').map((s) => [s.id, infoOf(s.code).name || s.name.replace(/\.(glsl|frag)$/, '')]),
]

export const renderMainParams = (shaders) => [
  { key: 'backend', label: 'Backend de Play', type: 'select', options: [['webgl', 'WebGL'], ['webgpu', 'WebGPU (experimental)']], hint: 'WebGPU dibuja el fotograma completo y selecciona clústeres sin lectura desde la CPU. Los perfiles Realista funcionan con materiales y efectos compatibles. Si Play cambia a WebGL, Rendimiento muestra el motivo.' },
  { key: 'look', label: 'Aspecto', type: 'select', options: [['realista', 'Realista (PBR + efectos)'], ['clasico', 'Clásico (sin efectos, como Godot)']], hint: 'El juego exportado a Godot no cambia: esto afecta al editor y al juego propio.' },
  { key: 'profile', label: 'Calidad', type: 'select', options: [['alto', 'Alta (oclusión ambiental + bloom + MSAA)'], ['medio', 'Media (bloom + MSAA)'], ['bajo', 'Baja (sólo tonos y grading)']], when: { look: 'realista' } },
  { key: 'shader', label: 'Shader por defecto', type: 'select', options: shaderOptions(shaders).map(([v, l], i) => (i === 0 ? ['', l + ' · por defecto'] : [v, l])), hint: 'Lo usan todos los objetos que no tengan uno propio. Crea los tuyos en Assets/Shaders (GLSL).' },
  { key: 'psx', label: 'Estilo PSX', type: 'bool', hint: 'Escala la imagen con nearest. El ajuste de vértices se aplica solo a primitivas y mallas editables del motor.' },
  { key: 'psxHeight', label: 'Resolución PSX', type: 'select', options: [[240, '240p'], [480, '480p'], [0, 'Nativa']], when: { psx: true }, hint: 'Resolución vertical interna. La imagen se escala con nearest. Si es mayor que la pantalla, se limita a la resolución real.' },
  { key: 'psxSnap', label: 'Ajuste de vértices (px)', type: 'number', min: 0, max: 4, step: 1, when: { psx: true }, hint: '0 = apagado. 1–4 ajusta las posiciones en pantalla a una cuadrícula de píxeles PSX. Solo primitivas y mallas editables.' },
  { key: 'psxContinuous', label: 'Temblor continuo', type: 'bool', when: { psx: true }, hint: 'Varía el ajuste de vértices cada fotograma, incluso con la cámara inmóvil. Requiere un ajuste mayor que cero.' },
  { key: 'psxAffine', label: 'Texturas affine', type: 'bool', when: { psx: true }, hint: 'Deforma la textura de color al cambiar la perspectiva. Solo modelos GLTF/GLB con UV0 y mapa de color; no altera las demás texturas PBR.' },
]

export const renderToneParams = [
  { key: 'environmentLook', label: 'Adaptar color y exposición al entorno', type: 'bool', when: { look: 'realista' },
    hint: 'Usa la hora y el clima activos de la escena para ajustar la temperatura y la exposición sobre los valores base.' },
  { key: 'tonemap', label: 'Tone mapping', type: 'select', options: [['aces', 'ACES (cine)'], ['agx', 'AgX (suave)'], ['neutral', 'Neutro'], ['lineal', 'Lineal']] },
  { key: 'exposure', label: 'Exposición', type: 'number', min: 0.1, max: 4, step: 0.05 },
  { key: 'autoExposure', label: 'Exposición automática', type: 'number', min: 0, max: 1, step: 0.05, hint: '0 = apagada. Como la pupila: se adapta al brillo de lo que mira (oscurece al salir al sol, aclara al entrar a una cueva). Requiere perfil Medio o Alto.' },
  { key: 'aeKey', label: 'Brillo objetivo', type: 'number', min: 0.03, max: 1, step: 0.01, when: { autoExposure: (v) => v > 0 }, hint: 'Más alto = imagen más clara.' },
  { key: 'aeSpeedUp', label: 'Velocidad al aclarar', type: 'number', min: 0.1, max: 30, step: 0.1, when: { autoExposure: (v) => v > 0 } },
  { key: 'aeSpeedDown', label: 'Velocidad al oscurecer', type: 'number', min: 0.1, max: 30, step: 0.1, when: { autoExposure: (v) => v > 0 } },
  { key: 'aeMin', label: 'Límite oscuro (EV)', type: 'number', min: -8, max: 0, step: 0.5, when: { autoExposure: (v) => v > 0 } },
  { key: 'aeMax', label: 'Límite claro (EV)', type: 'number', min: 0, max: 8, step: 0.5, when: { autoExposure: (v) => v > 0 } },
  { key: 'reflections', label: 'Reflejos / luz ambiente (IBL)', type: 'number', min: 0, max: 3, step: 0.05 },
  { key: 'lut', label: 'LUT de color', type: 'texture', hint: 'Una imagen de Assets que remapea todos los colores (como en DaVinci o Photoshop). Admite tira N²×N (256×16, 1024×32) o Hald cuadrada (64×64, 512×512). La LUT neutra está en docs/lut-neutra-16.png.' },
  { key: 'lutStrength', label: 'Fuerza de la LUT', type: 'number', min: 0, max: 1, step: 0.02, when: { lut: (v) => !!v } },
  { key: 'saturation', label: 'Saturación', type: 'number', min: 0, max: 2, step: 0.02 },
  { key: 'contrast', label: 'Contraste', type: 'number', min: 0.5, max: 2, step: 0.02 },
  { key: 'shadowTint', label: 'Tinte de sombras', type: 'color' },
  { key: 'highlightTint', label: 'Tinte de luces', type: 'color' },
  { key: 'tintStrength', label: 'Fuerza del tinte', type: 'number', min: 0, max: 1, step: 0.02 },
]

export const renderFxParams = [
  { key: 'indirectProbeGrid', label: 'Sondas dinámicas de iluminación indirecta', type: 'bool', when: { look: 'realista', profile: (v) => v !== 'bajo' }, hint: 'Experimental. Actualiza sondas en GPU durante Play. Aporta luz de superficies fuera de cámara.' },
  { key: 'indirectProbeCoverage', label: 'Cobertura de las sondas', type: 'select', options: [['local', 'Alrededor de la cámara'], ['scene', 'Escena cargada']], when: { indirectProbeGrid: true, look: 'realista', profile: (v) => v !== 'bajo' }, hint: 'Escena cargada cubre los límites de la geometría presente. En niveles grandes aumenta la separación entre sondas.' },
  { key: 'screenBounce', label: 'Rebote de luz en pantalla', type: 'number', min: 0, max: 1, step: 0.05, when: { look: 'realista', profile: (v) => v !== 'bajo' }, hint: 'Iluminación indirecta experimental a partir de superficies visibles. 0 = apagado. Requiere GPU compatible y añade trabajo de renderizado.' },
  { key: 'worldRayBounce', label: 'Trazar rebotes fuera de pantalla', type: 'bool', when: { look: 'realista', profile: (v) => v !== 'bajo', screenBounce: (v) => v > 0 }, hint: 'Durante Play, busca intersecciones con la geometría opaca cargada. Complementa el rebote de pantalla con color base, emisión y sombras de luces compatibles.' },
  { key: 'worldRayBounceCount', label: 'Rebotes de escena', type: 'select', options: [[1, '1'], [2, '2'], [3, '3']], when: { look: 'realista', profile: (v) => v !== 'bajo', worldRayBounce: true, screenBounce: (v) => v > 0 }, hint: 'Cantidad de intersecciones por rayo fuera de pantalla. Cada rebote añade trabajo de GPU.' },
  { key: 'worldRayReflection', label: 'Reflejos trazados', type: 'number', min: 0, max: 1, step: 0.05, when: { look: 'realista', profile: (v) => v !== 'bajo' }, hint: '0 = apagado. Durante Play, combina el color visible con el trazado de la escena opaca. Usa la rugosidad y reflectancia base de los materiales compatibles.' },
  { key: 'worldRayReflectionDistance', label: 'Alcance de reflejos trazados (m)', type: 'number', min: 1, max: 60, step: 1, when: { look: 'realista', profile: (v) => v !== 'bajo', worldRayReflection: (v) => v > 0 } },
  { key: 'bounceDistance', label: 'Alcance del rebote (m)', type: 'number', min: 0.5, max: 12, step: 0.5, when: { look: 'realista', profile: (v) => v !== 'bajo', screenBounce: (v) => v > 0 } },
  { key: 'ao', label: 'Oclusión ambiental', type: 'number', min: 0, max: 2, step: 0.05, when: { profile: 'alto' } },
  { key: 'aoRadius', label: 'Radio de oclusión (m)', type: 'number', min: 0.05, max: 4, step: 0.05, when: { profile: 'alto' } },
  { key: 'dynamicReflections', label: 'Sonda de reflejos en tiempo real', type: 'bool', when: { look: 'realista' }, hint: 'Captura el entorno próximo para que los materiales PBR reflejen la escena. Tiene un coste adicional de GPU.' },
  { key: 'puddleReflections', label: 'Reflejos en charcos del terreno', type: 'bool', when: { look: 'realista' }, hint: 'Reflejo planar en superficies mojadas, también para objetos fuera de cámara.' },
  { key: 'puddleReflectionStrength', label: 'Intensidad del reflejo de charcos', type: 'number', min: 0, max: 1, step: 0.05, when: { puddleReflections: true, look: 'realista' } },
  { key: 'ssr', label: 'Reflejos SSR', type: 'bool', when: { look: 'realista', profile: (v) => v !== 'bajo' }, hint: 'Reflejos de objetos visibles en pantalla. Costoso: se activa por proyecto; no sustituye al IBL ni crea reflejos fuera de cámara.' },
  { key: 'ssrQuality', label: 'Calidad SSR', type: 'select', options: [['baja', 'Baja (50 %)'], ['media', 'Media (75 %)'], ['alta', 'Alta (100 %)']], when: { ssr: true, look: 'realista' } },
  { key: 'ssrStrength', label: 'Intensidad SSR', type: 'number', min: 0, max: 1, step: 0.05, when: { ssr: true, look: 'realista' } },
  { key: 'ssrDistance', label: 'Distancia máxima SSR (m)', type: 'number', min: 0.1, max: 100, step: 0.5, when: { ssr: true, look: 'realista' } },
  { key: 'sharpen', label: 'Nitidez', type: 'number', min: 0, max: 1, step: 0.05, when: { look: 'realista', resScale: (v) => Number(v) < 0.999, psx: false }, hint: 'Compensa la suavidad de la ampliación.' },
  { key: 'bloom', label: 'Bloom', type: 'number', min: 0, max: 3, step: 0.05 },
  { key: 'bloomThreshold', label: 'Umbral del bloom', type: 'number', min: 0, max: 4, step: 0.05 },
  { key: 'bloomRadius', label: 'Radio del bloom', type: 'number', min: 0, max: 1.5, step: 0.05 },
  { key: 'dofBlur', label: 'Profundidad de campo (px)', type: 'number', min: 0, max: 24, step: 0.5, hint: '0 = apagada. Desenfoque máximo del fondo y del primer plano, en píxeles a 1080p. Requiere perfil Medio o Alto.' },
  { key: 'dofAuto', label: 'Enfoque automático', type: 'bool', when: { dofBlur: (v) => v > 0 }, hint: 'Al jugar, enfoca lo que hay en el centro de la pantalla (suavizado).' },
  { key: 'dofFocus', label: 'Distancia de enfoque (m)', type: 'number', min: 0.1, max: 500, step: 0.1, when: { dofBlur: (v) => v > 0 } },
  { key: 'dofRange', label: 'Zona nítida (m)', type: 'number', min: 0, max: 200, step: 0.5, when: { dofBlur: (v) => v > 0 }, hint: 'Cuánta profundidad queda nítida alrededor del plano de enfoque.' },
  { key: 'vignette', label: 'Viñeta', type: 'number', min: 0, max: 1, step: 0.02 },
  { key: 'grain', label: 'Grano', type: 'number', min: 0, max: 0.5, step: 0.01 },
  { key: 'chromatic', label: 'Aberración cromática', type: 'number', min: 0, max: 0.02, step: 0.001 },
]

/** Rendimiento: solo actúa jugando. El editor siempre dibuja a resolución completa. */
export const renderScaleParams = [
  { key: 'spatialReconstruction', label: 'Filtro de ampliación', type: 'select', options: [['catmull', 'Catmull-Rom'], ['linear', 'Bilineal (rápido)'], ['nearest', 'Vecino más cercano (pixelado)'], ['edge-guard', 'Protección de bordes (experimental)']], when: { resScale: (v) => Number(v) < 0.999, psx: false } },
]
export const renderPerfParams = [
  { key: 'performanceAuto', label: 'Optimización automática al jugar', type: 'bool', hint: 'Mide el presupuesto aunque Stats esté cerrado. Ajusta LOD, precisión de AO y frecuencia de capturas de iluminación y reflejos. El cielo conserva sus muestras y resolución. Conserva forward, resolución de escena, materiales y gameplay. Si alcanza sus límites, lo indica en Stats.' },
  { key: 'targetFps', label: 'FPS objetivo', type: 'number', min: 20, max: 240, step: 1, when: { performanceAuto: true }, hint: 'Objetivo del controlador, no un límite de FPS ni una garantía independiente del hardware.' },
  { key: 'batchStatic', label: 'Batching de decoración', type: 'bool', hint: 'Solo al jugar: agrupa primitivas y mallas marcadas como decoración estática, sin shaders especiales ni lightmaps. Requiere WEBGL_multi_draw y grupos compatibles; apagado por defecto.' },
  { key: 'lod', label: 'LOD y culling', type: 'bool', hint: 'Al jugar: menos triángulos en terreno y mallas lejanas, vegetación por bloques con distancia de dibujado.' },
  { key: 'meshErrorLod', label: 'LOD por error proyectado', type: 'bool', when: { lod: true }, hint: 'Genera varios niveles para mallas indexadas marcadas como Estático. Conserva los bordes abiertos y elige el nivel según su error estimado en pantalla.' },
  { key: 'lodQuality', label: 'Calidad de LOD', type: 'number', min: 0.5, max: 2, step: 0.1, when: { lod: true }, hint: 'Más alto = el detalle completo se mantiene a más distancia.' },
  { key: 'drawDistance', label: 'Distancia de dibujado', type: 'number', min: 0.5, max: 2, step: 0.1, when: { lod: true } },
]
