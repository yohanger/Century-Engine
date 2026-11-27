// Estado reactivo del juego en curso (lo que dibuja la interfaz del juego): diálogo, opciones, fundidos, subtítulos, etc.
// Lo escribe PlayMode y lo lee la interfaz (UiManager / UiRoot). El Runtime crea el suyo; el editor pasa el suyo (`host.playState`)
// para que sus paneles (barra de herramientas, HUD) lo vean con la misma identidad.
import { reactive } from '@vue/reactivity'

export const freshPlay = () => ({ on: false, focus: false, started: false, dialog: null, choices: null, prompt: '', interactionIndicator: null, heldActions: [], fade: { color: '#000000', alpha: 0, ms: 0, curve: 'linear' }, errors: 0, party: null, letterbox: 0, caption: null, levelTitle: null, spriteRev: 0, timeline: null, noCamera: false, player: true, paused: false, lang: '' })

/** Campos que existen siempre (aunque freshPlay no los reinicie): notas y carga de lanzamiento. */
export const createPlayState = () => reactive({ ...freshPlay(), notes: [], throwCharge: 0 })
