// El Player de gameplay es un CharacterBody3D ordinario, gestionado por Jolt y scripts.
// NoPlayer sólo mantiene las interfaces compartidas de ViewModel y cámara.
import { NoPlayer } from './none/index.js'

export const PLAYER_TYPES = { [NoPlayer.id]: NoPlayer }
export const DEFAULT_PLAYER = NoPlayer.id

/** Opciones de GameManager: habilitación nativa, no controladores alternativos. */
export const playerTypes = () => [
  { id: 'native', label: 'Jugador nativo (CharacterBody3D)' },
  { id: 'none', label: 'Sin jugador' },
]
export function createPlayer(id, play) { void id; return new NoPlayer(play) }
export { PlayerController, CONTRACT } from './controller.js'
