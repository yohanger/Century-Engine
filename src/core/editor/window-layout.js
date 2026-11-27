// Distribución editorial: en Electron siempre hay paneles de escritorio, aunque Windows aplique escalado DPI.
export function editorScreenMode(width, electron = false) {
  if (electron) return 'desktop'
  return width >= 1100 ? 'desktop' : width >= 720 ? 'tablet' : 'phone'
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))

/** Ajusta tamaños visibles, sin modificar las preferencias guardadas por el usuario. */
export function fitEditorDocks(width, height, prefs, activeSide = null) {
  const w = Math.max(1, Number(width) || 1)
  const h = Math.max(1, Number(height) || 1)
  const leftOpen = !!prefs.leftOpen, rightOpen = !!prefs.rightOpen
  const splitW = (leftOpen ? 5 : 0) + (rightOpen ? 5 : 0)
  const minCenter = w >= 650 ? 280 : Math.max(100, w * .32)
  const capacity = Math.max(0, w - splitW - minCenter)
  const leftMin = leftOpen ? Math.min(155, capacity * .44) : 0
  const rightMin = rightOpen ? Math.min(215, capacity - leftMin) : 0
  let left = leftOpen ? clamp(prefs.leftW, leftMin, 420) : 0
  let right = rightOpen ? clamp(prefs.rightW, rightMin, 500) : 0
  const excess = Math.max(0, left + right - capacity)
  if (excess > 0 && activeSide === 'left') {
    left = Math.min(left, Math.max(leftMin, capacity - rightMin))
    right = Math.min(right, Math.max(rightMin, capacity - left))
  } else if (excess > 0 && activeSide === 'right') {
    right = Math.min(right, Math.max(rightMin, capacity - leftMin))
    left = Math.min(left, Math.max(leftMin, capacity - right))
  } else if (excess > 0) {
    const leftRoom = Math.max(0, left - leftMin), rightRoom = Math.max(0, right - rightMin)
    const room = leftRoom + rightRoom
    if (room > 0) {
      const leftCut = Math.min(leftRoom, excess * leftRoom / room)
      const rightCut = Math.min(rightRoom, excess - leftCut)
      left -= leftCut; right -= rightCut
      const rem = Math.max(0, left + right - capacity)
      if (rem) left = Math.max(leftMin, left - rem)
    }
  }
  const topOpen = !!prefs.topOpen
  const maxTop = Math.max(55, Math.min(320, (h - 96 - 180 - 10) * .55))
  const top = topOpen ? clamp(prefs.topH, Math.min(80, maxTop), maxTop) : 0
  const bottomOpen = !!prefs.bottomOpen
  // Cabecera, toolbar y barra de estado ocupan 96 px; reservar al menos 180 al visor.
  const maxBottom = Math.max(55, Math.min(520, h - 96 - 180 - 5 - top))
  const bottom = bottomOpen ? clamp(prefs.bottomH, Math.min(110, maxBottom), maxBottom) : 0
  return {
    left: Math.round(left), right: Math.round(right), top: Math.round(top), bottom: Math.round(bottom), topMax: Math.round(maxTop),
    leftMin: Math.round(leftMin), rightMin: Math.round(rightMin),
    leftMax: Math.max(Math.round(leftMin), Math.min(420, Math.floor(capacity - rightMin))),
    rightMax: Math.max(Math.round(rightMin), Math.min(500, Math.floor(capacity - leftMin))),
    bottomMax: Math.round(maxBottom),
  }
}

/** Coloca una ventana guardada de vuelta en el área visible del Editor. */
export function fitEditorWindow(rect, width, height, top = 40, margin = 8) {
  const W = Math.max(1, width), H = Math.max(1, height)
  const w = clamp(rect.w, 1, Math.max(1, W - margin * 2))
  const h = clamp(rect.h, 1, Math.max(1, H - top - margin))
  return {
    x: Math.round(clamp(rect.x, margin, Math.max(margin, W - margin - w))),
    y: Math.round(clamp(rect.y, top, Math.max(top, H - margin - h))),
    w, h,
  }
}
