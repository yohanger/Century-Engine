// Base de datos ▸ Jugador: el cuerpo, el movimiento, la cámara y el VIEW MODEL del jugador (lo que cuelga de la cámara).
//
// Es un único registro (como «Sistema»), declarado igual que el resto de la base de datos: el formulario se genera solo.
// El view model se organiza en SLOTS: puntos de anclaje relativos a la cámara (mano derecha, mano izquierda, ojos…). Un slot
// no es un modelo de mano: es un lugar donde colgar cosas. Los comandos «Mover al view model» y game.viewModel.attach()
// llevan un evento, un nodo o un trigger a un slot por su `id`.
import { clone } from '../events/model.js'

export const PLAYER_DEFAULTS = {
  // personaje de la base de datos que «es» el jugador (0 = ninguno): da el nombre (\N) y el modelo del cuerpo
  actorId: 0,
  // cuerpo
  height: 1.8, radius: 0.32, eyeHeight: 1.65, stepHeight: 0.55,
  // movimiento (velocidades y respuesta: el jugador acelera y frena, no cambia de velocidad al instante)
  walk: 4.3, run: 7.5,
  groundAccel: 50, groundDecel: 40, turnBoost: 1.6,       // suelo estable (pendiente ≤ límite)
  slideAccel: 10, slideDecel: 2,                          // suelo inestable (pendiente > límite): resbala
  airAccel: 20, airDecel: 5,                              // en el aire
  // pendientes
  slopeLimit: 50, jumpOnSteep: false,
  // salto y gravedad: con «salto automático» la gravedad y la velocidad salen de la altura y la duración
  jumpAuto: true, jumpHeight: 1.1, jumpTime: 0.3,
  jump: 7.2, gravity: 24,                                 // manual (con jumpAuto desactivado)
  fallGravity: 1.15, terminalSpeed: 55,
  coyote: 0.1, jumpBuffer: 0.15, airJumps: 0,
  jumpCutEnabled: false, jumpCut: 0.5, jumpCutMin: 0.1, jumpCutMax: 0.3,
  // agacharse
  crouchEnabled: true, crouchToggle: false, crouchAir: false, crouchHeight: 0.6, crouchSpeed: 0.45, crouchLerp: 12,
  // agua (se activa sola al entrar en un objeto Agua): vadear → nadar → bucear, corriente y efecto bajo el agua
  swimEnabled: true, wadeDepth: 0.25, wadeSlow: 0.55, swimDepth: 0.7,
  swimSpeed: 2.8, swimRun: 1.6, swimAccel: 9, swimDrag: 4,
  diveEnabled: true, diveSpeed: 2.2, swimUp: 2.2, buoyancy: 0.6, swimEyeAbove: 0.1, swimExitJump: 0.85,
  currentPush: 1, breathTime: 20,
  uwEffect: true, uwDensity: 1, uwMuffle: 0.75, uwLight: true, waterFx: true,
  // plataformas móviles
  inheritGround: true, inheritMin: 1.5, inheritMult: 1,
  // cámara
  fov: 90, sensitivity: 1,
  cameraMotionEnabled: false,
  cameraMotionWalk: '', cameraMotionRun: '', cameraMotionJump: '', cameraMotionFall: '', cameraMotionLand: '',
  cameraMotionWalkGain: 0.55, cameraMotionRunGain: 0.85, cameraMotionJumpGain: 0.65,
  cameraMotionFallGain: 0.4, cameraMotionLandGain: 0.8,
  cameraMotionSmoothing: 10, cameraMotionCadence: 1, cameraMotionLandThreshold: 1.6,
  // pasos dinámicos (según la layer / capa de pintura del suelo)
  footsteps: true, footVolume: 0.6,
  // view model
  vmVisible: true,
  // Soltar y lanzar tienen acciones propias en Input Map. Conservamos throwMax para los proyectos anteriores.
  dropEnabled: true, throwMax: 14,
  // guardado: ranuras 1..N (+ la 0 de autoguardado), pantalla por defecto de «Abrir pantalla de guardado» y autoguardado al cambiar de escena
  saveSlots: 20, saveUi: '', autosaveScene: false,
  slots: [
    { id: 'right', label: 'Mano derecha', pos: [0.28, -0.24, -0.5], rot: [0, 0, 0], scale: 1, model: null },
    { id: 'left', label: 'Mano izquierda', pos: [-0.28, -0.24, -0.5], rot: [0, 0, 0], scale: 1, model: null },
    { id: 'eyes', label: 'Ojos (cámara)', pos: [0, 0, -0.3], rot: [0, 0, 0], scale: 1, model: null },
  ],
}

/** Claves de PLAYER_DEFAULTS que antes vivían en project.game (proyectos anteriores). */
const LEGACY = ['walk', 'run', 'jump', 'gravity', 'sensitivity']

/** Campos de «Movimiento» que PlayMode copia a `pm.g` y que el jugador lee cada paso de física (también son `game.player.<campo>`). */
export const MOVE_KEYS = [
  'walk', 'run', 'groundAccel', 'groundDecel', 'turnBoost', 'slideAccel', 'slideDecel', 'airAccel', 'airDecel', 'slopeLimit', 'jumpOnSteep',
  'jumpAuto', 'jumpHeight', 'jumpTime', 'jump', 'gravity', 'fallGravity', 'terminalSpeed', 'coyote', 'jumpBuffer', 'airJumps',
  'jumpCutEnabled', 'jumpCut', 'jumpCutMin', 'jumpCutMax',
  'crouchEnabled', 'crouchToggle', 'crouchAir', 'crouchHeight', 'crouchSpeed', 'crouchLerp',
  'inheritGround', 'inheritMin', 'inheritMult',
  'swimEnabled', 'wadeDepth', 'wadeSlow', 'swimDepth', 'swimSpeed', 'swimRun', 'swimAccel', 'swimDrag',
  'diveEnabled', 'diveSpeed', 'swimUp', 'buoyancy', 'swimEyeAbove', 'swimExitJump', 'currentPush', 'breathTime',
  'uwEffect', 'uwDensity', 'uwMuffle', 'uwLight', 'waterFx',
  'fov', 'sensitivity', 'cameraMotionEnabled', 'cameraMotionWalkGain', 'cameraMotionRunGain',
  'cameraMotionJumpGain', 'cameraMotionFallGain', 'cameraMotionLandGain',
  'cameraMotionSmoothing', 'cameraMotionCadence', 'cameraMotionLandThreshold',
]

const num = (min, max, step = 0.1) => ({ type: 'number', min, max, step })
const SLOT_FIELDS = [
  { key: 'id', label: 'Id', type: 'text', def: 'slot', hint: 'Nombre corto que usan los comandos y el código: game.viewModel.slot("right")' },
  { key: 'label', label: 'Nombre', type: 'text', def: 'Slot' },
  { key: 'pos', label: 'Posición', type: 'vec3', def: [0, 0, -0.5], hint: 'Relativa a la cámara: +X derecha, +Y arriba, −Z hacia delante (metros)' },
  { key: 'rot', label: 'Rotación (°)', type: 'vec3', def: [0, 0, 0] },
  { key: 'scale', label: 'Escala', ...num(0.01, 20, 0.05), def: 1 },
  { key: 'model', label: 'Objeto por defecto', type: 'model', def: null, hint: 'Opcional: algo que siempre está en este slot (una linterna, una cámara…)' },
]

/** Parámetros declarados: ParamForm dibuja «Base de datos ▸ Jugador» a partir de esta lista. */
export const PLAYER_PARAMS = [
  { key: '_hActor', type: 'header', label: 'Personaje' },
  { key: 'actorId', label: 'Personaje', type: 'ref', kind: 'actors', optional: true, def: 0, hint: 'El personaje de Base de datos ▸ Personajes que controla el jugador: aporta su nombre (\\N) y su modelo (vista previa en tercera persona).' },
  { key: '_hBody', type: 'header', label: 'Cuerpo' },
  { key: 'height', label: 'Altura (m)', ...num(0.4, 4, 0.05), def: PLAYER_DEFAULTS.height },
  { key: 'radius', label: 'Radio (m)', ...num(0.1, 1, 0.01), def: PLAYER_DEFAULTS.radius },
  { key: 'eyeHeight', label: 'Altura de los ojos (m)', ...num(0.2, 4, 0.05), def: PLAYER_DEFAULTS.eyeHeight, hint: 'Desde los pies hasta la cámara' },
  { key: 'stepHeight', label: 'Escalón máx. (m)', ...num(0, 1.5, 0.05), def: PLAYER_DEFAULTS.stepHeight },
  { key: '_hMove', type: 'header', label: 'Movimiento' },
  { key: 'walk', label: 'Caminar (m/s)', ...num(0.5, 30, 0.1), def: PLAYER_DEFAULTS.walk },
  { key: 'run', label: 'Correr (m/s)', ...num(0.5, 40, 0.1), def: PLAYER_DEFAULTS.run },
  { key: 'groundAccel', label: 'Aceleración en suelo (m/s²)', ...num(1, 300, 1), def: PLAYER_DEFAULTS.groundAccel, hint: 'Cuánto tarda en ponerse a velocidad. Alto = respuesta seca; bajo = arranque suave (con hielo, ~5).' },
  { key: 'groundDecel', label: 'Frenado en suelo (m/s²)', ...num(1, 300, 1), def: PLAYER_DEFAULTS.groundDecel, hint: 'Cuánto tarda en parar al soltar las teclas.' },
  { key: 'turnBoost', label: 'Impulso al girar', ...num(1, 4, 0.05), def: PLAYER_DEFAULTS.turnBoost, hint: 'Multiplica la aceleración cuando cambias de dirección (×1 a 0°, hasta este valor a 180°): evita el efecto «patinar» al dar la vuelta.' },
  { key: 'slideAccel', label: 'Aceleración en suelo inestable', ...num(0, 100, 1), def: PLAYER_DEFAULTS.slideAccel, hint: 'Sobre una pendiente más empinada que el límite casi no tienes control.' },
  { key: 'slideDecel', label: 'Frenado en suelo inestable', ...num(0, 100, 1), def: PLAYER_DEFAULTS.slideDecel },
  { key: 'airAccel', label: 'Control en el aire: aceleración', ...num(0, 200, 1), def: PLAYER_DEFAULTS.airAccel, hint: 'Cuánto puedes corregir el rumbo en un salto. Al saltar se conserva la velocidad que llevabas (correr + saltar = salto largo).' },
  { key: 'airDecel', label: 'Control en el aire: frenado', ...num(0, 200, 1), def: PLAYER_DEFAULTS.airDecel },
  { key: '_hSlope', type: 'header', label: 'Pendientes' },
  { key: 'slopeLimit', label: 'Pendiente máxima (°)', ...num(1, 89, 1), def: PLAYER_DEFAULTS.slopeLimit, hint: 'Por encima de este ángulo el suelo es «inestable»: el jugador resbala y no puede saltar (salvo que lo permitas).' },
  { key: 'jumpOnSteep', label: 'Saltar en pendientes empinadas', type: 'bool', def: false },
  { key: '_hJump', type: 'header', label: 'Salto y gravedad' },
  { key: 'jumpAuto', label: 'Salto automático', type: 'bool', def: true, hint: 'Defines hasta dónde sube y cuánto tarda; la gravedad y la velocidad de salto se calculan solas (g = 2·altura / tiempo²).' },
  { key: 'jumpHeight', label: 'Altura del salto (m)', ...num(0.1, 10, 0.05), def: PLAYER_DEFAULTS.jumpHeight, when: { jumpAuto: (v) => !!v } },
  { key: 'jumpTime', label: 'Tiempo hasta el punto más alto (s)', ...num(0.1, 2, 0.01), def: PLAYER_DEFAULTS.jumpTime, when: { jumpAuto: (v) => !!v }, hint: 'Menos = salto más seco y gravedad más fuerte.' },
  { key: 'jump', label: 'Velocidad de salto', ...num(0, 30, 0.1), def: PLAYER_DEFAULTS.jump, when: { jumpAuto: (v) => !v }, hint: '≈ 7,2 salta 1 m con gravedad 24' },
  { key: 'gravity', label: 'Gravedad', ...num(1, 120, 0.5), def: PLAYER_DEFAULTS.gravity, when: { jumpAuto: (v) => !v } },
  { key: 'fallGravity', label: 'Gravedad al caer (×)', ...num(0.5, 4, 0.05), def: PLAYER_DEFAULTS.fallGravity, hint: 'Multiplica la gravedad cuando bajas: > 1 = caídas más rápidas y saltos menos «flotantes».' },
  { key: 'terminalSpeed', label: 'Velocidad máx. de caída (m/s)', ...num(5, 200, 1), def: PLAYER_DEFAULTS.terminalSpeed },
  { key: 'coyote', label: 'Tiempo de gracia al caer (s)', ...num(0, 0.5, 0.01), def: PLAYER_DEFAULTS.coyote, hint: '«Coyote time»: puedes saltar un instante después de pisar el borde.' },
  { key: 'jumpBuffer', label: 'Salto anticipado (s)', ...num(0, 0.5, 0.01), def: PLAYER_DEFAULTS.jumpBuffer, hint: 'Si pulsas saltar un momento antes de aterrizar, el salto se hace al tocar el suelo.' },
  { key: 'airJumps', label: 'Saltos extra en el aire', ...num(0, 10, 1), def: PLAYER_DEFAULTS.airJumps, hint: '1 = doble salto.' },
  { key: 'jumpCutEnabled', label: 'Salto variable', type: 'bool', def: false, hint: 'Si sueltas el botón pronto, el salto es más corto.' },
  { key: 'jumpCut', label: 'Recorte al soltar', ...num(0, 1, 0.05), def: PLAYER_DEFAULTS.jumpCut, when: { jumpCutEnabled: (v) => !!v }, hint: '0 = nada, 1 = se para en seco.' },
  { key: 'jumpCutMin', label: 'Recorte: tiempo mínimo (s)', ...num(0, 1, 0.01), def: PLAYER_DEFAULTS.jumpCutMin, when: { jumpCutEnabled: (v) => !!v } },
  { key: 'jumpCutMax', label: 'Recorte: tiempo máximo (s)', ...num(0, 2, 0.01), def: PLAYER_DEFAULTS.jumpCutMax, when: { jumpCutEnabled: (v) => !!v } },
  { key: '_hCrouch', type: 'header', label: 'Agacharse (acción «crouch» del Input Map)' },
  { key: 'crouchEnabled', label: 'Permitir agacharse', type: 'bool', def: true },
  { key: 'crouchToggle', label: 'Alternar (en vez de mantener)', type: 'bool', def: false, when: { crouchEnabled: (v) => !!v } },
  { key: 'crouchAir', label: 'Agacharse en el aire', type: 'bool', def: false, when: { crouchEnabled: (v) => !!v } },
  { key: 'crouchHeight', label: 'Altura agachado (× altura)', ...num(0.3, 0.95, 0.01), def: PLAYER_DEFAULTS.crouchHeight, when: { crouchEnabled: (v) => !!v }, hint: 'Al levantarte se comprueba que haya techo libre.' },
  { key: 'crouchSpeed', label: 'Velocidad agachado (× caminar)', ...num(0.05, 1, 0.01), def: PLAYER_DEFAULTS.crouchSpeed, when: { crouchEnabled: (v) => !!v } },
  { key: 'crouchLerp', label: 'Rapidez de la cámara al agacharse', ...num(1, 40, 0.5), def: PLAYER_DEFAULTS.crouchLerp, when: { crouchEnabled: (v) => !!v } },
  { key: '_hPlat', type: 'header', label: 'Plataformas móviles' },
  { key: 'inheritGround', label: 'Heredar la velocidad de la plataforma al saltar', type: 'bool', def: true, hint: 'Al saltar o caer de una plataforma que se mueve, conservas su velocidad. Al aterrizar sobre una, te mueves con ella.' },
  { key: 'inheritMin', label: 'Velocidad mínima para heredar (m/s)', ...num(0, 20, 0.1), def: PLAYER_DEFAULTS.inheritMin, when: { inheritGround: (v) => !!v } },
  { key: 'inheritMult', label: 'Cuánta velocidad se hereda', ...num(0, 2, 0.05), def: PLAYER_DEFAULTS.inheritMult, when: { inheritGround: (v) => !!v } },
  { key: '_hSteps', type: 'header', label: 'Pasos' },
  { key: 'footsteps', label: 'Pasos dinámicos', type: 'bool', def: true, hint: 'Suenan según la superficie: la layer del objeto (Tags y Layers) o la capa de pintura del terreno.' },
  { key: 'footVolume', label: 'Volumen de los pasos', ...num(0, 1, 0.05), def: PLAYER_DEFAULTS.footVolume, when: { footsteps: (v) => !!v } },
  { key: '_hCam', type: 'header', label: 'Ojos y cámara' },
  { key: 'fov', label: 'FOV (°)', ...num(40, 120, 1), def: PLAYER_DEFAULTS.fov, hint: 'Campo de visión horizontal de la cámara del jugador.' },
  { key: 'sensitivity', label: 'Sensibilidad', ...num(0.1, 5, 0.05), def: PLAYER_DEFAULTS.sensitivity },
  { key: '_hMotion', type: 'header', label: 'Movimiento de cámara (Camera Shake Base)' },
  { key: 'cameraMotionEnabled', type: 'bool', label: 'Activar movimiento de cámara', def: false, hint: 'Afecta solo al render: no cambia la cámara física ni los raycasts. Las recetas se asignan desde los nodos Camera Shake Base.' },
  ...[['Walk','Caminar'], ['Run','Correr'], ['Jump','Saltar'], ['Fall','Caer'], ['Land','Aterrizar']].flatMap(([suffix, label]) => [
    { key: `cameraMotion${suffix}`, label: `Camera Shake Base · ${label}`, type: 'node', only: ['cameraShake'], optional: true, def: '', when: { cameraMotionEnabled: (v) => !!v }, hint: 'Selecciona un nodo Camera Shake Base configurado para Cámara del jugador. No requiere AutoPlay.' },
    { key: `cameraMotion${suffix}Gain`, label: `Intensidad · ${label} (×)`, ...num(0, 2, 0.05), def: PLAYER_DEFAULTS[`cameraMotion${suffix}Gain`], when: { cameraMotionEnabled: (v) => !!v } },
  ]),
  { key: 'cameraMotionSmoothing', label: 'Respuesta (1/s)', ...num(0.5, 30, 0.5), def: PLAYER_DEFAULTS.cameraMotionSmoothing, when: { cameraMotionEnabled: (v) => !!v }, hint: 'Rapidez con que la oscilación de pasos aparece y desaparece, sin corte brusco.' },
  { key: 'cameraMotionCadence', label: 'Cadencia según velocidad (×)', ...num(0.25, 3, 0.05), def: PLAYER_DEFAULTS.cameraMotionCadence, when: { cameraMotionEnabled: (v) => !!v }, hint: 'Multiplica la fase de los patrones al caminar/correr. Cada receta conserva su frecuencia base.' },
  { key: 'cameraMotionLandThreshold', label: 'Impacto mínimo al aterrizar (m/s)', ...num(0, 15, 0.1), def: PLAYER_DEFAULTS.cameraMotionLandThreshold, when: { cameraMotionEnabled: (v) => !!v } },
  { key: '_hVm', type: 'header', label: 'View model (lo que cuelga de la cámara)' },
  { key: 'vmVisible', label: 'Mostrar el view model', type: 'bool', def: true },
  { key: 'dropEnabled', label: 'Permitir soltar y lanzar', type: 'bool', def: true, hint: 'G suelta y T lanza directamente. Puedes cambiar ambas teclas por separado en Input Map; los clics del ratón quedan libres por defecto.' },
  { key: 'throwMax', label: 'Velocidad al lanzar (m/s)', ...num(1, 60, 0.5), def: PLAYER_DEFAULTS.throwMax, when: { dropEnabled: (v) => !!v }, hint: 'Velocidad de lanzamiento al pulsar la acción Lanzar. No depende del tiempo que mantengas la tecla.' },
  { key: '_hSave', type: 'header', label: 'Guardado' },
  { key: 'saveSlots', label: 'Ranuras de guardado', ...num(1, 99, 1), def: PLAYER_DEFAULTS.saveSlots, hint: 'Ranuras 1..N; la 0 es el autoguardado. Se guardan en este equipo (localStorage / datos de la app).' },
  { key: 'saveUi', label: 'Pantalla de guardado', type: 'ui', def: '', hint: 'La interfaz (Assets/UI) que abre el comando «Abrir pantalla de guardado / carga» si no indica otra.' },
  { key: 'autosaveScene', label: 'Autoguardar al cambiar de escena', type: 'bool', def: false },
  { key: 'slots', label: 'Slots (manos, ojos…)', type: 'list', def: PLAYER_DEFAULTS.slots, item: SLOT_FIELDS, summary: (s) => `${s.id} · ${s.label}` },
]

const limits = Object.fromEntries(PLAYER_PARAMS.filter((p) => p.type === 'number').map((p) => [p.key, p]))
const fin = (v, d) => (Number.isFinite(+v) && v !== '' && v !== null ? +v : d)
const vec = (v, d) => (Array.isArray(v) && v.length >= 3 ? [fin(v[0], d[0]), fin(v[1], d[1]), fin(v[2], d[2])] : [...d])

/** Identificador de slot válido: minúsculas sin espacios (se usa como nombre en comandos y código). */
export const slugSlot = (s) => String(s ?? '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')

function normalizeSlots(list) {
  const out = [], used = new Set()
  for (const raw of Array.isArray(list) ? list : []) {
    if (!raw || typeof raw !== 'object') continue
    let id = slugSlot(raw.id) || slugSlot(raw.label) || 'slot'
    for (let n = 2; used.has(id); n++) id = `${slugSlot(raw.id) || 'slot'}${n}`
    used.add(id)
    out.push({ id, label: String(raw.label ?? id), pos: vec(raw.pos, [0, 0, -0.5]), rot: vec(raw.rot, [0, 0, 0]), scale: Math.max(0.01, fin(raw.scale, 1)), model: raw.model || null })
  }
  return out
}

/**
 * Completa y sanea el registro «Jugador». `legacyGame` (project.game de un proyecto anterior) solo se mira cuando el registro
 * todavía no existe: así los valores de caminar/correr/saltar/FOV que ya tenía el proyecto no se pierden.
 */
export function normalizePlayer(raw, legacyGame = null) {
  const out = clone(PLAYER_DEFAULTS)
  if (!raw && legacyGame) for (const k of LEGACY) if (Number.isFinite(+legacyGame[k]) && legacyGame[k] !== '') out[k] = +legacyGame[k]
  const src = raw && typeof raw === 'object' ? raw : {}
  for (const [k, p] of Object.entries(limits)) {
    const v = Math.min(p.max, Math.max(p.min, fin(src[k], out[k])))
    out[k] = v
  }
  for (const p of PLAYER_PARAMS) if (p.type === 'bool') out[p.key] = src[p.key] === undefined ? PLAYER_DEFAULTS[p.key] : !!src[p.key]
  out.actorId = Math.max(0, Math.floor(fin(src.actorId, 0)))
  for (const suffix of ['Walk', 'Run', 'Jump', 'Fall', 'Land']) {
    const key = `cameraMotion${suffix}`
    out[key] = typeof src[key] === 'string' ? src[key] : ''
  }
  out.footsteps = src.footsteps === undefined ? true : !!src.footsteps
  out.vmVisible = src.vmVisible === undefined ? true : !!src.vmVisible
  out.dropEnabled = src.dropEnabled === undefined ? true : !!src.dropEnabled
  out.saveSlots = Math.round(out.saveSlots)
  out.saveUi = typeof src.saveUi === 'string' ? src.saveUi : ''
  out.autosaveScene = !!src.autosaveScene
  out.airJumps = Math.round(out.airJumps)
  if (out.jumpCutMax < out.jumpCutMin) out.jumpCutMax = out.jumpCutMin
  out.slots = Array.isArray(src.slots) ? normalizeSlots(src.slots) : clone(PLAYER_DEFAULTS.slots)
  // los ojos nunca quedan por encima de la cabeza ni el escalón supera la mitad del cuerpo
  out.eyeHeight = Math.min(out.eyeHeight, out.height)
  out.stepHeight = Math.min(out.stepHeight, out.height / 2)
  return out
}

/** Limita un valor numérico de «Jugador» a su rango (game.player.walk = 99 no rompe nada). */
export const clampPlayerField = (key, v) => { const l = limits[key]; return l ? Math.min(l.max, Math.max(l.min, +v)) : +v }

/** Slot por id (sin distinguir mayúsculas), por nombre visible o por posición (1, 2, 3…). */
export function slotById(player, key) {
  const slots = player?.slots || []
  if (typeof key === 'number') return slots[key - 1] || null
  const k = String(key ?? '').trim().toLowerCase()
  return slots.find((s) => s.id === k) || slots.find((s) => s.label.toLowerCase() === k) || slots.find((s) => s.id === slugSlot(k)) || null
}

/** Opciones [[id, nombre]] para el parámetro de comando de tipo «slot». */
export const slotOptions = (db) => (db?.player?.slots || []).map((s) => [s.id, s.label || s.id])
