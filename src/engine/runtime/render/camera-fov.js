// FOV del Editor y del jugador: Three.js almacena siempre el ángulo vertical.
// El usuario introduce FOV horizontal. Las cámaras de escena y los timelines conservan grados verticales internos.
const DEG = Math.PI / 180

/** Convierte el ángulo indicado por el usuario al FOV vertical que necesita Three.js. */
export function verticalFov(degrees, aspect, axis = 'horizontal') {
  const angle = Number(degrees)
  const ratio = Number(aspect)
  if (!Number.isFinite(angle) || angle <= 0 || angle >= 179) return null
  if (axis === 'vertical') return angle
  if (!Number.isFinite(ratio) || ratio <= 0) return null
  return 2 * Math.atan(Math.tan(angle * DEG / 2) / ratio) / DEG
}

/** Guarda el FOV declarado y lo aplica a una PerspectiveCamera sin trabajo redundante. */
export function setCameraFov(cam, degrees, axis = 'horizontal') {
  const mode = axis === 'vertical' ? 'vertical' : 'horizontal'
  const value = Number(degrees)
  const vertical = verticalFov(value, cam.aspect, mode)
  if (vertical == null) return false
  const previous = cam.userData?.lfFov
  if (previous?.value === value && previous.axis === mode && Math.abs(cam.fov - vertical) < 1e-8) return false
  if (!cam.userData) cam.userData = {} // cámaras de prueba sin Three.js
  cam.userData.lfFov = { value, axis: mode }
  cam.fov = vertical
  cam.updateProjectionMatrix()
  return true
}

/** El resize cambia el ángulo vertical si el FOV configurado era horizontal. */
export function refreshCameraFov(cam) {
  const spec = cam.userData?.lfFov
  if (!spec) { cam.updateProjectionMatrix(); return }
  const vertical = verticalFov(spec.value, cam.aspect, spec.axis)
  if (vertical != null) cam.fov = vertical
  cam.updateProjectionMatrix()
}
