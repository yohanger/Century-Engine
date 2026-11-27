// El juego a partir de un paquete: escena + modo Jugar con el `host` del paquete. Sin editor, sin store, sin IndexedDB.
import { SceneGraph } from '../scene-graph.js'
import { PlayMode } from '../events/play.js'
import { getAudio } from '../audio/engine.js'
import { readPackage, readPackageEntries } from './format.js'
import { createPackageHost } from './host.js'

class GameGraph extends SceneGraph {
  player = null // PlayMode (lo asigna openGame)
  get isPlaying() { return !!this.player?.on }
  _renderApplied() { this.player?._gfxRefresh?.() }
}

/**
 * Abre un paquete y deja el juego listo para arrancar.
 * @param {object} o
 * @param o.container  elemento donde se dibuja
 * @param o.bytes      contenido del paquete
 * @param o.storage    almacenamiento del jugador (síncrono)
 * @param o.onQuit     al elegir «Salir»
 * @param [o.log]  registro de mensajes de los scripts
 * @returns {Promise<any>} { graph, host, player, game, state, report, start(), dispose() }
 */
export async function openGame({ container, bytes, entries, storage, onQuit = () => {}, log, onProgress }) {
  const pkg = entries ? await readPackageEntries(entries) : await readPackage(bytes)
  const host = createPackageHost({ pkg, storage, log })
  const graph = new GameGraph(container, host)
  graph.player = new PlayMode(graph)
  graph.player.runtime = true
  graph.player.onQuit = onQuit
  getAudio().setLoader(host.assetData)
  graph.vp.applyPrefs({})
  graph.vp.onFrame((dt) => graph._sceneFrame(dt))
  await host.attach(graph, onProgress)
  return {
    graph, host, player: graph.player, game: host.project.game, state: host.playState, report: pkg.report,
    start: () => graph.player.start({ onProgress }),
    dispose() { if (graph.player.on) graph.player.stop(); graph.dispose(); host.dispose() },
  }
}
