// «Sin jugador»: el tipo de jugador de la plantilla Vacío (como una escena nueva de Unity). No hay personaje, ni cuerpo, ni manos,
// ni mirada con el ratón: Camera Orchestration decide la cámara y todo el gameplay lo realizan los nodos.
// No crea un controlador FPS ni jugador implícito.
import { PlayerController } from '../controller.js'
import { pickMove } from '../../events/play-shared.js'
import { setCameraFov } from '../../render/camera-fov.js'

export class NoPlayer extends PlayerController {
  static id = 'none'
  static label = 'Sin jugador (vacío)'
  static embodied = false // PlayMode: hasPlayer = false siempre

  /** Solo el FOV por defecto de la cámara del juego (sin cuerpo ni velocidades). */
  applyConfig(c) {
    const pm = this.play
    // Empty no guarda registro de jugador: la cámara de escena decide el FOV.
    if (!c) return
    Object.assign(pm.g, pickMove(c))
    setCameraFov(pm.cam, pm.g.fov)
  }
  api() { return {} }
}
