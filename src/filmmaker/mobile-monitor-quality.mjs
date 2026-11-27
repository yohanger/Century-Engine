// Perfiles acotados al codificador del monitor; no alteran el canvas ni film.frame.
export const MONITOR_PROFILES = Object.freeze({
  ahorro: Object.freeze({ label: 'Ahorro', bitrate: 350000, fps: 5, scale: 2 }),
  equilibrado: Object.freeze({ label: 'Equilibrado', bitrate: 850000, fps: 10, scale: 1 }),
  detalle: Object.freeze({ label: 'Detalle', bitrate: 1600000, fps: 10, scale: 1 }),
})

export async function applyMonitorEncoding(sender, profileName) {
  const config = MONITOR_PROFILES[profileName]
  if (!config) throw new Error('Perfil de monitor desconocido')
  if (!sender?.getParameters || !sender?.setParameters) throw new Error('Codificador WebRTC sin controles de calidad')
  const params = sender.getParameters()
  if (!Array.isArray(params.encodings) || !params.encodings.length) {
    throw new Error('WebRTC no expone codificación modificable; se mantiene la calidad previa')
  }
  params.encodings[0] = {
    ...params.encodings[0],
    maxBitrate: config.bitrate,
    maxFramerate: config.fps,
    scaleResolutionDownBy: config.scale,
  }
  await sender.setParameters(params)
  const applied = sender.getParameters().encodings?.[0]
  if (!applied || applied.maxBitrate !== config.bitrate || applied.maxFramerate !== config.fps || applied.scaleResolutionDownBy !== config.scale) {
    throw new Error('WebRTC no confirmó los límites del perfil; comprobar calidad real mediante estadísticas')
  }
  return config
}
