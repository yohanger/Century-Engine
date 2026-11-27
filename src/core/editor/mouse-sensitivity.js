export const DEFAULT_MOUSE_SENSITIVITY = 1
export function mouseSensitivity(value) {
  return Number.isFinite(value) && value >= 0.1 && value <= 3 ? value : DEFAULT_MOUSE_SENSITIVITY
}
export function effectiveNavigationPrefs(p) {
  const gain = mouseSensitivity(p.mouseSensitivity)
  return { ...p, mouseOrbit: (p.mouseOrbit ?? 1) * gain, mousePan: (p.mousePan ?? 1) * gain,
    mouseZoom: (p.mouseZoom ?? 1) * gain, flyLook: (p.flyLook ?? 1) * gain }
}
