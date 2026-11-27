const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

function editableControl(node) {
  if (!node || typeof node !== 'object') return false
  return EDITABLE_TAGS.has(node.tagName?.toUpperCase()) || node.isContentEditable === true
}

export function releasePropertyFocusOnEscape(event) {
  if (event.key !== 'Escape' || event.isComposing) return false
  const path = event.composedPath?.() || []
  if (path.some((node) => node?.classList?.contains?.('cm-editor'))) return false
  const target = event.target
  const control = path.find(editableControl) || (editableControl(target) ? target : target?.closest?.('[contenteditable="true"]'))
  if (!control) return false
  event.stopPropagation()
  if (event.defaultPrevented) return true
  event.preventDefault()
  const active = control.ownerDocument?.activeElement
  if (active === control || (active?.isContentEditable && (control.contains?.(active) || active.contains?.(control)))) active.blur?.()
  return true
}
