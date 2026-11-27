// S01A: evidencias experimentales; no autorizan filmación ni movimiento de cámara.
export const VISUAL_FEASIBILITY_GATE = 'LF-FILMMAKER-MOBILE-CAMERA-VISUAL-TRACKING-FEASIBILITY-S01A-G001'
export const VISUAL_FRAME_LIMIT = 12
export const VISUAL_STAGE_IDS = Object.freeze([
  'calibracion', 'estatico', 'frontal_0_5m', 'frontal_1m',
  'lateral_0_5m', 'lateral_1m', 'giro', 'occlusion', 'recuperacion',
])

export function checkedVisualFrame(evidence, stage, count) {
  if (!VISUAL_STAGE_IDS.includes(stage)) throw new Error('Etapa de referencia no autorizada')
  if (!Number.isInteger(count) || count < 0 || count >= VISUAL_FRAME_LIMIT) throw new Error('Límite de imágenes alcanzado')
  if (evidence?.source !== 'android-native-camera-intent' || evidence.mime !== 'image/jpeg') throw new Error('Fuente de imagen no acreditada')
  if (!evidence.imageBase64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(evidence.imageBase64)) throw new Error('La imagen no contiene JPEG codificado válido')
  if (!Number.isFinite(evidence.width) || evidence.width < 200 || !Number.isFinite(evidence.height) || evidence.height < 200) throw new Error('Dimensiones de imagen inválidas')
  if (!Number.isFinite(evidence.imageBytes) || evidence.imageBytes < 1024 || evidence.imageBytes > 1200000) throw new Error('Imagen fuera del límite de adquisición')
  const filename = `s01a_${String(count + 1).padStart(2, '0')}_${stage}.jpg`
  return {
    filename, stage, width: evidence.width, height: evidence.height, imageBytes: evidence.imageBytes,
    source: evidence.source, rearLensRequested: evidence.rearLensRequested === true,
    rearLensVerified: false, // El Intent del sistema no certifica la lente seleccionada por el usuario.
    captureTimestampSystemMsApprox: evidence.captureTimestampSystemMsApprox ?? null,
    availableRamBytesAfterCapture: Number.isFinite(evidence.availableRamBytesAfterCapture) ? evidence.availableRamBytesAfterCapture : null,
    timestampIsShutterTime: false, imageBase64: evidence.imageBase64,
  }
}

export function visualCaptureManifest(frames, optics, device) {
  return {
    schema: 'lf-filmmaker-mobile-visual-tracking-s01a', version: 1, gate: VISUAL_FEASIBILITY_GATE,
    experimentOnly: true, productionSixDoFApproved: false,
    exportTimeUtc: new Date().toISOString(), device: {manufacturer:device?.manufacturer ?? null, model:device?.model ?? null, androidRelease:device?.androidRelease ?? null},
    optics: optics ?? null, calibration: 'REQUIRED_FROM_EXPORTED_JPEG_FRAMES',
    frames: frames.map(({imageBase64, ...metadata}) => metadata),
    cautions: ['La cámara trasera se solicita, pero debe verificarse físicamente en la aplicación de cámara.', 'Los tiempos se estiman cuando regresa la actividad; no son tiempos de exposición.', 'Sin calibración y medidas reales no se certifica precisión ni 6DoF.'],
  }
}
