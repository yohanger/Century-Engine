// En el navegador (vista previa en PC) no hay detección de pose nativa: solo la fuente «Simulado».
export const MODEL = ''
export const cameraSupported = () => false
export const cameraError = () => 'La cámara con IA solo está en la app Android (APK o build de desarrollo).'
export function toFlat() { return new Array(132).fill(0) }
export function CameraPose() { return null }
