// Fuente de datos única para la onda de Timeline y su duración en Inspector.
// La cola existente limita decodificaciones y conserva resúmenes por versión de Asset.
import { assetData } from '../state/assets.js'
import { assetVersion } from '../db.js'
import { getAudio, decodeAudioBytes } from '../../engine/runtime/audio/engine.js'
import { resolveAudioClip } from '../../engine/runtime/audio/config.js'
import { createAudioAnalysisQueue } from './audio-waveform.js'

let decoder
const analysis = createAudioAnalysisQueue(async ({ id, projectId, source }, signal) => {
  const ready = getAudio().cachedBuffer(id, source)
  if (ready) return ready
  const asset = await assetData(id, projectId)
  if (!asset) return null
  signal.throwIfAborted()
  decoder ??= new OfflineAudioContext(1, 1, 48000)
  return decodeAudioBytes(decoder, asset.bytes)
})

export function requestTimelineAudioAnalysis(project, clip, receive, priority = false) {
  const id = resolveAudioClip(project, clip)
  if (!project?.id || !id) {
    receive({ status: 'missing' })
    return () => {}
  }
  return analysis.request({ id, projectId: project.id, source: assetVersion(project.id, id) }, receive, priority)
}
