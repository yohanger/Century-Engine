const DRAG_THRESHOLD = 6

// Seleccionar ocurre en pointerdown. Solo un movimiento deliberado con el mismo
// puntero pulsado activa una edición; soltar y cancelar solo cierran el gesto.
export function createTimelinePointerDrag(target = window) {
  let cancelActive = () => {}
  return {
    cancel() { cancelActive() },
    begin(start, { move, finish, cancel, axis = 'x' }) {
      if (start.button !== 0 || start.isPrimary === false) return
      cancelActive()
      let dragging = false
      const onMove = event => {
        if (event.pointerId !== start.pointerId || (event.buttons & 1) === 0) return
        const x = event.clientX - start.clientX, y = event.clientY - start.clientY
        const distance = axis === 'x' ? Math.abs(x) : Math.hypot(x, y)
        if (!dragging && distance < DRAG_THRESHOLD) return
        dragging = true
        move(event, x, y)
      }
      const cleanup = () => {
        target.removeEventListener('pointermove', onMove)
        target.removeEventListener('pointerup', onUp)
        target.removeEventListener('pointercancel', onCancel)
        target.removeEventListener('blur', onBlur)
        cancelActive = () => {}
      }
      const onUp = event => {
        if (event.pointerId !== start.pointerId || event.button !== 0) return
        cleanup()
        finish?.(dragging)
      }
      const onBlur = () => { cleanup(); if (dragging) cancel?.() }
      const onCancel = event => { if (event.pointerId === start.pointerId) onBlur() }
      cancelActive = onBlur
      target.addEventListener('pointermove', onMove)
      target.addEventListener('pointerup', onUp)
      target.addEventListener('pointercancel', onCancel)
      target.addEventListener('blur', onBlur)
    },
  }
}
