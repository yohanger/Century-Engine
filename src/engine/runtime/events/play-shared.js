// Constantes y ayudas que comparten PlayMode (play.js) y sus mixins (play-*.js).
import * as THREE from 'three'
import { MOVE_KEYS } from '../database/player.js'

export const LAYER = 3 // capa de colisión: el Raycaster solo mira estas mallas
export const DOWN = new THREE.Vector3(0, -1, 0)
export const UP = new THREE.Vector3(0, 1, 0)
export const NEVER = new Promise(() => {}) // lo que quede esperando tras detener el juego no continúa nunca
export const DIRS = Array.from({ length: 8 }, (_, i) => new THREE.Vector3(Math.cos((i * Math.PI) / 4), 0, Math.sin((i * Math.PI) / 4)))
export const pickMove = (c) => Object.fromEntries(MOVE_KEYS.map((k) => [k, c[k]]))
export { freshPlay } from '../play-state.js'
