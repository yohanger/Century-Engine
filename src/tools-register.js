// Registro de las herramientas del editor (ver core/tools.js). Vive fuera de core/ porque compone las apps. Lo importan SOLO los puntos de entrada de las apps que las usan:
//   · editor (src/main.js): registerEditorTools() — todo.
//   · Nether Film Maker (src/filmmaker/main.js): registerCaptureFilm() — captura y película (usa captureRigInfo del store).
// El juego exportado (src/runtime-app/main.js) no importa este archivo: su paquete no lleva nada de esto.
import { registerTools } from './core/tools.js'
import * as meshTools from './core/mesh/session.js'
import * as commandTools from './core/commands.js'
import * as captureTools from './core/capture/index.js'
import { cinematicFromTake } from './core/capture/timeline.js'
import * as filmFile from './filmmaker/film.js'
import { cinematicFromPass } from './filmmaker/cinematic.js'
import { montageTimeline, sequence, cinematicReel } from './filmmaker/montage.js'

export function registerCaptureFilm() {
  registerTools({
    capture: { ...captureTools, cinematicFromTake },
    film: { newFilm: filmFile.newFilm, packNfm: filmFile.packNfm, unpackNfm: filmFile.unpackNfm, applyOverrides: filmFile.applyOverrides, cinematicFromPass, montageTimeline, sequence, cinematicReel },
  })
}
export function registerEditorTools() {
  registerCaptureFilm()
  registerTools({ mesh: meshTools, commands: commandTools })
}
