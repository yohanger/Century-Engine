// Interfaz compartida de estado auxiliar y ViewModel. No mueve el cuerpo nativo ni
// decide la cámara: esas autoridades pertenecen a CharacterBody3D/Jolt y Camera Orchestration.
//
// CharacterBody3D/Jolt es dueño del estado físico cuando hay un jugador nativo. `PlayMode` lo expone con los accesores `pos`, `yaw`, `pitch`,
// `vy`, `grounded` y `body` para que eventos, rutas, cinemáticas y scripts lo lean sin saber de qué tipo es.
//
// Para jugar en red (más adelante) habrá una instancia por jugador; hoy PlayMode tiene una, la local.
import * as THREE from 'three'
import { handsMethods } from './viewmodel/hands.js'

/** Lo que TODO tipo de jugador debe tener (la prueba test-player-module.mjs lo comprueba para cada tipo registrado). */
export const CONTRACT = ['begin', 'applyConfig', 'setConfig', 'placeAtSpawn', 'placeAtCamera', 'update', 'late', 'look', 'turn', 'viewPose', 'api', 'sceneReset']

export class PlayerController {
  /** Identificador del tipo (el valor de `game.player` en la plantilla) y su nombre para la interfaz. */
  static id = ''
  static label = ''
  /** ¿Tiene personaje? Si es false (tipo «none») nunca hay jugador en escena, ni con Spawn ni con «jugar desde aquí». */
  static embodied = true

  /** @param {object} play  el PlayMode que lo gobierna (escena, entrada, física, juego…) */
  constructor(play) {
    this.play = play
    // Las manos son una capacidad opcional del jugador, no un tipo FPS paralelo.
    // Solo se montan cuando PlayMode identifica un personaje controlado.
    this.vm = null
    this._thrown = []
    this.pos = new THREE.Vector3() // pies del jugador
    this.yaw = 0; this.pitch = 0 // radianes
    this.vy = 0; this.grounded = false
    this.prev = new THREE.Vector3() // posición en el paso de física anterior (para interpolar la cámara entre pasos)
    /** Tamaño del cuerpo (m): altura, radio, altura de los ojos y escalón máximo. */
    this.body = { height: 1.7, radius: 0.3, eyeHeight: 1.55, stepHeight: 0.4 }
  }

  /** Al empezar a jugar (antes de cargar la escena). */
  begin() { this.vy = 0; this.pitch = 0 }
  /** Carga el registro «Jugador» de la base de datos (velocidades, cuerpo, FOV…). */
  applyConfig(cfg) { void cfg }
  /** game.player.<campo> = valor, durante la partida (no toca la base de datos). */
  setConfig(patch) { void patch }
  /** Coloca al jugador en el Spawn de la etiqueta `tag`. */
  placeAtSpawn(tag) { void tag }
  /** Coloca al jugador donde estaba la cámara del editor («jugar desde aquí»). */
  placeAtCamera() {}
  /** Una vez por fotograma de juego, antes de los pasos de física (para recordar pulsaciones que no deben perderse entre pasos). */
  frame(dt) { void dt }
  /** Cada PASO DE FÍSICA (tasa fija de Ajustes del juego; no cada fotograma): leer entrada y moverse. `dt` es constante. */
  update(dt) { void dt }
  /** Cada paso de simulación, después del resto del mundo (pasos, sonidos…). */
  late(dt) { void dt }
  /** Movimiento del ratón capturado (ya filtrado por PlayMode). */
  look(e) { void e }
  /** Giro por un mando: suma `yaw`/`pitch` (radianes). */
  turn(yaw, pitch) { this.yaw += yaw; this.pitch += pitch }
  /** Coloca la cámara del juego donde ve este jugador. */
  viewPose(cam) { void cam }
  /** Guarda la posición actual: PlayMode lo llama antes de cada paso de física. */
  snapshot() { this.prev.copy(this.pos) }
  /** Posición para dibujar: entre el paso anterior y el actual según `play._alpha` (0..1). Un salto grande (teletransporte) no se interpola. */
  renderPos(out) {
    const a = this.play._alpha ?? 1
    if (a >= 1 || this.prev.distanceToSquared(this.pos) > 4) return out.copy(this.pos)
    return out.lerpVectors(this.prev, this.pos, a)
  }
  /** El objeto `game.player` que ven los scripts. */
  api() { return {} }
  /** Al cargar una escena nueva. */
  sceneReset() {}
  /** Al detener el juego. */
  dispose() { this._vmTeardown() }
}

// Único propietario de slots, objetos sostenidos, stash y lanzamiento para el jugador nativo.
Object.defineProperties(PlayerController.prototype, Object.getOwnPropertyDescriptors(handsMethods))
