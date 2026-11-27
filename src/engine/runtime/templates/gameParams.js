// Ajustes del juego (project.game): los usa el modo Jugar del editor y el juego exportado.
// Se declaran como parámetros: el diálogo «Ajustes del juego» se genera a partir de esta lista (ParamForm).
// El jugador (cuerpo, velocidad, FOV, manos…) vive en Base de datos ▸ Jugador (core/database/player.js).
export const GAME_DEFAULTS = {
  title: '',            // vacío = nombre del proyecto
  window: 'fullscreen', width: 1280, height: 720,
  version: '1.0.0', icon: '', splash: '',
  player: 'native',     // habilita Player nativo; 'none' prohíbe jugador. Valores antiguos 'fps' no crean fallback
  physicsRate: 60,      // pasos de física por segundo (Hz): movimiento del jugador, Jolt y game.on('fixedUpdate')
}

export const PHYSICS_RATE_MIN = 20, PHYSICS_RATE_MAX = 240
/** Segundos de un paso de física según project.game.physicsRate (valor ausente o absurdo → 60 Hz). */
export function physicsStep(g) {
  const r = Number(g?.physicsRate)
  return 1 / (Number.isFinite(r) ? Math.min(PHYSICS_RATE_MAX, Math.max(PHYSICS_RATE_MIN, Math.round(r))) : 60)
}

export const PHYSICS_PARAMS = [
  { key: 'physicsRate', label: 'Tasa de física (Hz)', type: 'number', min: PHYSICS_RATE_MIN, max: PHYSICS_RATE_MAX, step: 1,
    hint: 'Pasos por segundo del movimiento del jugador y de Jolt. 60 es lo normal; más alto = colisiones más finas y más coste. La cámara se interpola, no se ve a saltos.' },
]

export const BUILD_PARAMS = [
  { key: 'title', label: 'Título del juego', type: 'text', hint: 'Vacío = nombre del proyecto' },
  { key: 'version', label: 'Versión', type: 'text' },
  { key: 'window', label: 'Ventana', type: 'select', options: [['fullscreen', 'Pantalla completa'], ['maximized', 'Ventana maximizada'], ['window', 'Ventana con tamaño fijo']] },
  { key: 'width', label: 'Ancho (px)', type: 'number', min: 320, max: 7680, step: 10, when: { window: 'window' } },
  { key: 'height', label: 'Alto (px)', type: 'number', min: 240, max: 4320, step: 10, when: { window: 'window' } },
  { key: 'icon', label: 'Icono (PNG)', type: 'texture', hint: 'Opcional. Cuadrado, 256 px o más' },
  { key: 'splash', label: 'Splash de arranque', type: 'texture', hint: 'Imagen de marca del AppImage. Si está vacía se usa el emblema NGM. PNG, JPEG o WebP, máximo 16 MiB.' },
]
