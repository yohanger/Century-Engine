// Formato de encuadre de Nether Film Maker. Independiente de la calidad de previsualización.
export const FILM_FRAME_PRESETS = Object.freeze([
  { id: '1080p', label: 'Full HD · 16:9', width: 1920, height: 1080 },
  { id: '720p', label: 'HD · 16:9', width: 1280, height: 720 },
  { id: 'classic', label: 'Clásico · 4:3', width: 1440, height: 1080 },
  { id: 'scope', label: 'Cine · 2.39:1', width: 2048, height: 858 },
  { id: 'vertical', label: 'Vertical · 9:16', width: 1080, height: 1920 },
  { id: 'square', label: 'Cuadrado · 1:1', width: 1080, height: 1080 },
])

const isDimension = (v) => Number.isInteger(v) && v >= 64 && v <= 8192
/** null significa película antigua: sigue el tamaño libre del panel. */
export function normalizeFilmFrame(frame) {
  if (frame == null) return null
  if (!frame || typeof frame !== 'object' || Array.isArray(frame) ||
      !isDimension(frame.width) || !isDimension(frame.height)) {
    throw new Error('Encuadre inválido: ancho y alto deben ser enteros entre 64 y 8192 píxeles')
  }
  return { width: frame.width, height: frame.height }
}

export const filmFramePreset = (frame) => FILM_FRAME_PRESETS.find((p) => p.width === frame?.width && p.height === frame?.height)?.id || 'custom'

/** Ajuste sin estiramiento: el renderer dibuja en este rectángulo interior. */
export function fitFilmFrame(width, height, frame) {
  const w = Math.max(1, width), h = Math.max(1, height)
  if (!frame) return { width: w, height: h }
  const scale = Math.min(w / frame.width, h / frame.height)
  return { width: Math.min(w, frame.width * scale), height: Math.min(h, frame.height * scale) }
}
