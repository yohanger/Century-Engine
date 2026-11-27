/** Solicita captura antes de abrir una operación; una transición del DOM puede invalidar el puntero. */
export function acquirePointer(element, event, context) {
  if (!element?.setPointerCapture || element.isConnected === false || !Number.isInteger(event?.pointerId)) return false
  try {
    element.setPointerCapture(event.pointerId)
    return element.hasPointerCapture ? element.hasPointerCapture(event.pointerId) : true
  } catch (error) {
    if (error?.name !== 'InvalidStateError' && error?.name !== 'NotFoundError') throw error
    console.warn(`[${context}] Captura de puntero rechazada (${event.pointerId}): ${error.name}`, {
      owner: context, operation: 'pointer-capture', pointerId: event.pointerId,
      pointerLock: element.ownerDocument?.pointerLockElement ? 'active' : 'none',
      focused: element.ownerDocument?.hasFocus?.() ?? null,
      connected: element.isConnected !== false, error,
      recovery: 'gesture-not-started',
    })
    return false
  }
}
