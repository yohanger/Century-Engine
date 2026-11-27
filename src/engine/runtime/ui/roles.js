// @deprecated — Los roles (HUD, indicación, diálogo, opciones, fundido, pausa) se conservan solo para proyectos anteriores.
// Lo nuevo: nodo Canvas + recurso .ui adjunto (core/nodes/canvas.js). No hay HUD predefinido.
// Roles del sistema de interfaz: qué pantalla se muestra y cuándo. El resto de pantallas las abre el juego (game.ui.open).
export const ROLES = [
  { key: 'hud', label: 'HUD (siempre visible)', multi: true, layer: 10, desc: 'Se muestra durante todo el juego. Puedes asignar varias pantallas.' },
  { key: 'prompt', label: 'Indicación de acción', layer: 20, desc: 'Al mirar un evento que se puede activar (play.prompt).' },
  { key: 'dialog', label: 'Cuadro de diálogo', layer: 30, desc: 'Mientras hay un texto en pantalla (play.dialog).' },
  { key: 'choices', label: 'Opciones', layer: 40, desc: 'Mientras hay una elección pendiente (play.choices).' },
  { key: 'fade', label: 'Fundido', layer: 80, desc: 'Siempre montada; lee play.fade (color, alpha, ms).' },
  { key: 'pause', label: 'Pausa', layer: 100, desc: 'Desactivado: ya no se muestra al perder el foco (un clic en el juego captura el ratón de nuevo).', interactive: true },
]
export const ROLE_BY_KEY = Object.fromEntries(ROLES.map((r) => [r.key, r]))
export const emptySlots = () => ({ hud: [], prompt: null, dialog: null, choices: null, fade: null, pause: null })
