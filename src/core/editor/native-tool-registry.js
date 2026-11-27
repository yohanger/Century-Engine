const nativeTools = new Map()
const activeDrags = new Set()

export function registerNativeTool(id, popup) {
  nativeTools.set(id, popup)
}
export function unregisterNativeTool(id, popup) {
  if (nativeTools.get(id) === popup) nativeTools.delete(id)
}
export function focusNativeTool(id) {
  const popup = nativeTools.get(id)
  if (!popup || popup.closed) return false
  popup.focus()
  return true
}

export function moveNativeTool(id, x, y) {
  const popup = nativeTools.get(id)
  if (!popup || popup.closed || !Number.isFinite(x) || !Number.isFinite(y)) return false
  if (window.lf?.moveToolWindow) return window.lf.moveToolWindow(popup.name, x, y)
  try { popup.moveTo(x, y); return true } catch { return false }
}

export function isNativeToolDragging(id) { return activeDrags.has(id) }

export function beginNativeToolDrag(id) {
  if (!id || activeDrags.has(id)) return false
  activeDrags.add(id)
  window.lf?.beginToolWindowDrag?.(id)
  return true
}

export function endNativeToolDrag(id) {
  if (!activeDrags.delete(id)) return false
  window.lf?.endToolWindowDrag?.(id)
  return true
}

export function getNativeToolDocument(id) {
  const popup = nativeTools.get(id)
  return popup && !popup.closed ? popup.document : null
}
