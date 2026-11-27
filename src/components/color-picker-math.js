// Conversiones y posicionamiento del selector. Sin estado del editor ni acceso al DOM.
export const validHex = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)
export const colorHex = (v) => validHex(v) ? v.toLowerCase() : '#ffffff'
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n))
export function rgbFromHex(hex) {
  const n = colorHex(hex).slice(1)
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16))
}
export function hexFromRgb(rgb) {
  return '#' + rgb.map((c) => Math.round(clamp(Number(c) || 0, 0, 255)).toString(16).padStart(2, '0')).join('')
}
export function hsvFromRgb(rgb) {
  const [r, g, b] = rgb.map((v) => clamp(v / 255, 0, 1))
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
  let h = 0
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6
    else if (mx === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h = ((h * 60) + 360) % 360
  }
  return [h, mx ? d / mx : 0, mx]
}
export function rgbFromHsv(h, s, v) {
  h = ((Number(h) % 360) + 360) % 360
  s = clamp(Number(s) || 0, 0, 1)
  v = clamp(Number(v) || 0, 0, 1)
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [r, g, b].map((n) => Math.round((n + m) * 255))
}
/** Preferir el lado libre; si no cabe, fijar el panel dentro del viewport visible. */
export function positionColorPicker(rect, viewport, size = { width: 286, height: 338 }, gap = 8) {
  const margin = 8
  const vw = viewport.width, vh = viewport.height
  const width = Math.min(size.width, Math.max(1, vw - margin * 2))
  const height = Math.min(size.height, Math.max(1, vh - margin * 2))
  const right = rect.right + gap, left = rect.left - width - gap
  const x = right + width <= vw - margin ? right : left >= margin ? left : clamp(rect.left, margin, vw - width - margin)
  const y = clamp(rect.top, margin, vh - height - margin)
  return { left: x, top: y, width, maxHeight: height }
}
