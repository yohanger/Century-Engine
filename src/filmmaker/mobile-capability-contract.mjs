// Contrato de evidencia S01. Ninguna muestra sintética acredita capacidades del teléfono.
const finiteVector = (value, len) => Array.isArray(value) && value.length === len && value.every((n) => typeof n === 'number' && Number.isFinite(n))
const VALID_STATES = new Set(['TRACKING', 'PAUSED', 'STOPPED'])

// Capacitor expone el permiso como texto en minúsculas en Android; no depender de su capitalización.
export function cameraPermissionGranted(permission) {
  return typeof permission === 'string' && permission.toLowerCase() === 'granted'
}

export function summarizeCapabilityReport(report) {
  const device = report?.inventory
  const native = device?.source === 'android-native'
  const sensors = Array.isArray(device?.sensors) ? device.sensors : []
  const orientationSamples = report?.orientation?.samples
  const orientationValid = native && report.orientation?.source === 'android-rotation-vector-3dof' && Array.isArray(orientationSamples)
    && orientationSamples.length > 0 && orientationSamples.every((sample) =>
      Number.isFinite(sample.elapsedMs) && finiteVector(sample.quaternionXYZW, 4))
  const ar = report?.arAvailability
  const rawPose = report?.poseProbe
  const poses = Array.isArray(rawPose?.samples) ? rawPose.samples : []
  const poseValid = native && rawPose?.source === 'arcore-session-live' && poses.length > 0
    && poses.every((sample) => VALID_STATES.has(sample.trackingState)
      && finiteVector(sample.positionMeters, 3) && finiteVector(sample.quaternionXYZW, 4)
      && Number.isFinite(sample.elapsedMs))
  const tracking = poseValid && poses.some((sample) => sample.trackingState === 'TRACKING')
  const trackingPoses = tracking ? poses.filter((sample) => sample.trackingState === 'TRACKING') : []
  const initial = trackingPoses[0]?.positionMeters
  const displacementMeters = initial ? Math.max(0, ...trackingPoses.map((sample) => Math.hypot(
    sample.positionMeters[0] - initial[0], sample.positionMeters[1] - initial[1], sample.positionMeters[2] - initial[2]))) : null
  return {
    deviceEvidence: native ? 'INVENTARIO_NATIVO_RECIBIDO' : 'NO_VERIFICADO',
    rotation3DoF: orientationValid ? 'MUESTRAS_VALIDAS' : 'NO_VERIFICADO',
    arSupport: native && ar?.availability ? ar.availability : 'NO_VERIFICADO',
    arPose: tracking ? 'TRACKING_REPORTADO_POR_ARCORE' : poseValid ? 'SIN_TRACKING_CONFIRMADO' : 'NO_VERIFICADO',
    maxDisplacementMetersFromFirstTrackingSample: displacementMeters,
    // Ni un reporte ARCore ni un desplazamiento aislado prueban estabilidad de rodaje o corrección de colisión.
    sixDofProductionApproved: false,
    sensorCount: sensors.length,
    evaluatedFrom: native ? 'dispositivo-android' : 'sin-evidencia-nativa',
  }
}

export function buildCapabilityEvidence(report) {
  const content = {
    schema: 'lf-filmmaker-mobile-capabilities-s01',
    version: 1,
    gate: 'LF-FILMMAKER-MOBILE-CAMERA-CAPABILITIES-S01-G001',
    diagnosticsOnly: true,
    exportedAt: new Date().toISOString(),
    ...report,
    summary: summarizeCapabilityReport(report),
  }
  return JSON.stringify(content, null, 2)
}
