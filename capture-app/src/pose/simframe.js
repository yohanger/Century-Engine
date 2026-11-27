// Un fotograma del actor simulado, con la convención de ejes de MediaPipe (33 puntos [x,y,z,vis]).
import { subjectPoints, poseAt, RAW } from '../core/simulate.js'
export function simulatedFrame(t) {
  const pts = subjectPoints(poseAt(t)), p = []
  for (const v of pts) { const r = RAW.mediapipe(v); p.push(r[0], r[1], r[2], 0.99) }
  return p
}
