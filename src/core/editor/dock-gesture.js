import { acquirePointer } from '../../engine/runtime/input/pointer-capture.js'
import { DOCK_PANELS, SPECIAL_DOCK_PANELS, REQUIRED_DOCK_VIEWS, dockGroups, dockDropEdge, floatDockPanel, moveDockPanel, findDockPanel, updateDockFloat } from './docking.js'
import { DOCK_DRAG_START_PX, dockDragDistance, dockNativePosition, shouldDetachDockDrag, setDockSpawn, notifyNativeDock } from './native-dock.js'
import { beginNativeToolDrag, endNativeToolDrag, focusNativeTool, moveNativeTool, getNativeToolDocument } from './native-tool-registry.js'

let gesture = null
let suppressClick = false
let diagnosticObserver = null
const NATIVE_FOCUS_GRACE_MS = 1200
const NATIVE_DOCK_TYPE = 'application/x-lf-native-dock'

/** Observación opcional del gesto, sin alterar su autoridad ni registrar eventos en consola. */
export function observeDockGesture(observer) {
  if (typeof observer !== 'function') throw new TypeError('Se requiere un observador de Docking')
  diagnosticObserver = observer
  return () => { if (diagnosticObserver === observer) diagnosticObserver = null }
}

function report(entry, event, phase, detail = {}) {
  if (!diagnosticObserver) return
  try {
    const point = event && (!entry.fromNative || event.currentTarget === window) ? clientPoint(event) : null
    const record = {
      phase, panel: entry.id, owner: entry.fromNative ? 'native' : 'editor',
      pointerId: entry.pointerId, event: event?.type ?? null, buttons: event?.buttons ?? null,
      client: event ? { x: event.clientX, y: event.clientY } : null,
      screen: event ? { x: event.screenX, y: event.screenY } : null,
      editor: point, active: entry.active, native: entry.native,
      captured: entry.captured ?? false,
      actualCapture: entry.body.hasPointerCapture?.(entry.pointerId) ?? null,
      focused: entry.body.ownerDocument?.hasFocus?.() ?? null,
      connected: entry.body.isConnected !== false,
      location: findDockPanel(entry.store.prefs.dockLayout, entry.id) ?? null,
      ...detail,
    }
    diagnosticObserver(record)
  } catch (error) { console.warn('[Century/Docking] diagnostic-observer-error', error.message) }
}

function removeListeners(entry) {
  entry.win.removeEventListener('pointermove', track, true)
  entry.win.removeEventListener('pointerup', finish, true)
  entry.win.removeEventListener('pointercancel', cancel, true)
  entry.win.removeEventListener('keydown', key, true)
  entry.win.removeEventListener('blur', blur)
  entry.win.removeEventListener('pagehide', pagehide)
  clearFocusTransfer(entry)
  entry.win.removeEventListener('lostpointercapture', lostCapture, true)
  if (entry.transfer) {
    entry.win.removeEventListener('dragenter', nativeOver, true)
    entry.win.removeEventListener('dragover', nativeOver, true)
    entry.handle.removeEventListener('dragend', endNativeTransfer)
    window.removeEventListener('dragenter', nativeOver, true)
    window.removeEventListener('dragover', nativeOver, true)
    window.removeEventListener('dragleave', leaveNativeEditor, true)
    window.removeEventListener('drop', dropNative, true)
  }
  try {
    if (entry?.captured && (entry.body.hasPointerCapture?.(entry.pointerId) ?? true)) entry.body.releasePointerCapture(entry.pointerId)
  } catch (error) { console.warn('[Century/Pointer] dock-release-error', { owner: 'Docking', pointerId: entry?.pointerId, error }) }
}

function clearFocusTransfer(entry) {
  clearTimeout(entry.focusTimer)
  entry.focusTimer = null
  entry.win.removeEventListener('pointerdown', newPress, true)
  if (entry.focusWindow) {
    entry.focusWindow.removeEventListener('keydown', key, true)
    entry.focusWindow.removeEventListener('pointerdown', newPress, true)
    entry.focusWindow.removeEventListener('blur', relatedBlur)
    entry.focusWindow.removeEventListener('pagehide', pagehide)
    entry.focusWindow = null
  }
  entry.focusTransfer = false
}

function relatedDocument(entry) {
  const doc = getNativeToolDocument(entry.id)
  return doc && doc !== entry.body.ownerDocument ? doc : null
}

function focusWithinGesture(entry) {
  return entry.body.ownerDocument?.hasFocus?.() === true || relatedDocument(entry)?.hasFocus?.() === true
}

function armFocusTransfer(entry) {
  clearTimeout(entry.focusTimer)
  const related = relatedDocument(entry)?.defaultView
  if (related && !entry.focusWindow) {
    entry.focusWindow = related
    related.addEventListener('keydown', key, true)
    related.addEventListener('pointerdown', newPress, true)
    related.addEventListener('blur', relatedBlur)
    related.addEventListener('pagehide', pagehide)
  }
  entry.focusTimer = setTimeout(() => {
    if (gesture === entry) cancel({ pointerId: entry.pointerId, type: 'pointercancel', reason: 'native-focus-timeout' })
  }, NATIVE_FOCUS_GRACE_MS)
}

function beginFocusTransfer(entry) {
  if (!entry.native || entry.fromNative || !entry.active || entry.focusTransfer || !entry.awaitingNativeFocus || Date.now() > entry.nativeFocusUntil) return false
  // Solo la ventana de este panel puede justificar el cambio de foco.
  // No se solicita una nueva captura: el documento que inició el gesto conserva la autoridad.
  if (relatedDocument(entry)?.hasFocus?.() !== true && entry.body.ownerDocument?.hasFocus?.() !== false) return false
  entry.awaitingNativeFocus = false
  entry.focusTransfer = true
  entry.win.addEventListener('pointerdown', newPress, true)
  armFocusTransfer(entry)
  report(entry, null, 'native-focus-transfer', { reason: 'opening-tool', relatedFocused: relatedDocument(entry)?.hasFocus?.() ?? null })
  return true
}

function validateFocusTransfer(entry, event) {
  if (!entry.focusTransfer) return true
  if (!focusWithinGesture(entry)) {
    cancel({ pointerId: entry.pointerId, type: 'pointercancel', reason: 'unrelated-focus' })
    return false
  }
  if (entry.body.ownerDocument?.hasFocus?.() === true && entry.body.hasPointerCapture?.(entry.pointerId)) {
    clearFocusTransfer(entry)
  } else if (event.type !== 'pointerup') armFocusTransfer(entry)
  return true
}

function newPress(event) {
  if (gesture?.focusTransfer && event.button === 0) cancel({ pointerId: gesture.pointerId, type: 'pointercancel', reason: 'new-press' })
}

function relatedBlur() {
  const entry = gesture
  if (!entry?.focusTransfer) return
  queueMicrotask(() => {
    if (gesture === entry && !focusWithinGesture(entry)) cancel({ pointerId: entry.pointerId, type: 'pointercancel', reason: 'unrelated-focus' })
  })
}

const clientPoint = event => ({ x: event.clientX, y: event.clientY })

function targetAt(entry, event) {
  const { x, y } = clientPoint(event)
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) {
    report(entry, event, 'hit-test', { reason: 'outside-editor', target: null })
    return null
  }
  const hit = document.elementFromPoint(x, y)
  const group = hit?.closest?.('[data-lf-dock-group]')
  const hitInfo = diagnosticObserver ? { tag: hit?.tagName ?? null, id: hit?.id ?? null, class: typeof hit?.className === 'string' ? hit.className.slice(0, 160) : null } : null
  const reject = reason => { report(entry, event, 'hit-test', { reason, hit: hitInfo, target: null }); return null }
  if (!group || group.isConnected === false) return reject('no-connected-group')
  const zone = group.dataset?.lfDockZone, groupId = group.dataset?.lfDockGroup
  if (REQUIRED_DOCK_VIEWS.includes(entry.id) && zone !== 'center') return reject('required-view-zone')
  if (!dockGroups(entry.store.prefs.dockLayout.zones[zone]).some(g => g.id === groupId)) return reject('group-not-in-layout')
  const onTabs = !!hit.closest?.('.lf-dock-tabs')
  const edge = dockDropEdge(group.getBoundingClientRect(), x, y, onTabs)
  const beforeTab = onTabs ? hit.closest?.('[data-lf-dock-tab]')?.dataset?.lfDockTab ?? '' : null
  const target = { zone, groupId, edge, beforeTab, onTabs }
  report(entry, event, 'hit-test', { reason: 'valid', hit: hitInfo, target })
  return target
}

function preview(target) {
  if (typeof CustomEvent !== 'undefined') window.dispatchEvent(new CustomEvent('century:dock-preview', { detail: target }))
}

function commit(entry, target) {
  const { zone, groupId, edge, beforeTab } = target
  const store = entry.store
  store.prefs.dockLayout = moveDockPanel(store.prefs.dockLayout, entry.id, zone, groupId, edge, beforeTab)
  const at = findDockPanel(store.prefs.dockLayout, entry.id)
  if (at?.kind !== 'dock' || at.zone !== zone) return false
  if (zone !== 'center') store.prefs[zone + 'Open'] = true
  if (SPECIAL_DOCK_PANELS.includes(entry.id)) notifyNativeDock(entry.id, 'attach')
  return true
}

export function startNativeDockTransfer(event) {
  const entry = gesture
  if (!entry?.fromNative || entry.handle !== event.currentTarget || !event.dataTransfer) {
    event.preventDefault()
    return
  }
  entry.transfer = true
  event.dataTransfer.setData(NATIVE_DOCK_TYPE, entry.id)
  event.dataTransfer.effectAllowed = 'move'
  // El arrastre entre superficies pasa al compositor, que cancela la secuencia de Pointer Events.
  entry.win.removeEventListener('pointermove', track, true)
  entry.win.removeEventListener('pointerup', finish, true)
  entry.win.removeEventListener('pointercancel', cancel, true)
  entry.win.addEventListener('dragenter', nativeOver, true)
  entry.win.addEventListener('dragover', nativeOver, true)
  entry.handle.addEventListener('dragend', endNativeTransfer)
  window.addEventListener('dragenter', nativeOver, true)
  window.addEventListener('dragover', nativeOver, true)
  window.addEventListener('dragleave', leaveNativeEditor, true)
  window.addEventListener('drop', dropNative, true)
  report(entry, event, 'native-transfer')
}

function activateNativeTransfer(entry, event) {
  if (entry.active) return true
  const point = clientPoint(event)
  // Cada superficie entrega sus propias coordenadas de cliente.
  const start = event.currentTarget === window ? entry.editorEnter ??= point : entry.start
  if (dockDragDistance(start, point) < DOCK_DRAG_START_PX) return false
  entry.active = true
  report(entry, event, 'native-activated')
  return true
}

function nativeOver(event) {
  const entry = gesture
  if (!entry?.transfer || !event.dataTransfer?.types.includes(NATIVE_DOCK_TYPE)) return
  const active = activateNativeTransfer(entry, event)
  if (event.currentTarget !== window) return
  entry.editorHoverTarget = event.target
  const target = active ? targetAt(entry, event) : null
  preview(target)
  if (!target) return
  event.preventDefault()
  event.stopPropagation()
  event.dataTransfer.dropEffect = 'move'
}

function leaveNativeEditor(event) {
  const entry = gesture
  if (!entry?.transfer || event.target !== entry.editorHoverTarget || event.relatedTarget) return
  entry.editorHoverTarget = null
  entry.editorEnter = null
  preview(null)
}

function dropNative(event) {
  const entry = gesture
  if (!entry?.transfer || event.dataTransfer?.getData(NATIVE_DOCK_TYPE) !== entry.id) return
  event.preventDefault()
  event.stopPropagation()
  const target = entry.active ? targetAt(entry, event) : null
  stopNativeTransfer(entry, event)
  if (target && commit(entry, target)) report(entry, event, 'committed', { target })
}

function endNativeTransfer(event) {
  if (gesture?.transfer) stopNativeTransfer(gesture, event)
}

function stopNativeTransfer(entry, event) {
  gesture = null
  removeListeners(entry)
  preview(null)
  report(entry, event, 'finish')
}

function releaseNative(entry, event) {
  const id = entry.id
  const point = dockNativePosition(event, entry.grab)
  report(entry, event, 'native-request', { reason: 'no-valid-target', point })
  entry.native = true
  // La confirmación de foco de la ventana puede llegar después de otro movimiento del editor.
  entry.awaitingNativeFocus = gesture === entry
  entry.nativeFocusUntil = Date.now() + NATIVE_FOCUS_GRACE_MS
  beginNativeToolDrag(id)
  setDockSpawn(id, point)
  if (SPECIAL_DOCK_PANELS.includes(id)) notifyNativeDock(id, 'detach')
  else entry.store.prefs.dockLayout = floatDockPanel(entry.store.prefs.dockLayout, id, {
    x: point.x, y: point.y,
    w: id === 'sceneView' || id === 'gameView' ? 780 : 620, h: 460,
  })
  moveNativeTool(id, point.x, point.y)
}

function track(event) {
  const entry = gesture
  if (!entry || event.pointerId !== entry.pointerId) return
  if (event.buttons === 0) { cancel({ pointerId: event.pointerId, type: 'pointercancel' }); return }
  if (entry.fromNative) { activateNativeTransfer(entry, event); return }
  if (!validateFocusTransfer(entry, event)) return
  const current = clientPoint(event)
  if (!entry.active && dockDragDistance(entry.start, current) >= DOCK_DRAG_START_PX) {
    entry.captured = acquirePointer(entry.body, event, "Arrastre Docking")
    report(entry, event, 'capture', { reason: entry.captured ? 'acquired' : 'rejected' })
    if (!entry.captured) { cancel(event); return }
    entry.active = true
    suppressClick = true
  }
  if (!entry.active) { report(entry, event, 'below-threshold'); return }
  const target = targetAt(entry, event)
  preview(target)
  if (entry.native) {
    const point = dockNativePosition(event, entry.grab)
    if (entry.lastPoint?.x !== point.x || entry.lastPoint?.y !== point.y) {
      entry.lastPoint = point
      moveNativeTool(entry.id, point.x, point.y)
    }
    return
  }
  const r = entry.origin
  const outside = r ? Math.max(r.left - event.clientX, event.clientX - r.right,
    r.top - event.clientY, event.clientY - r.bottom, 0) : 0
  if (window.lf?.isElectron && shouldDetachDockDrag(entry.start, current, !!target, outside)) {
    releaseNative(entry, event)
  }
}

function finish(event) {
  const entry = gesture
  if (!entry || event.pointerId !== entry.pointerId) return
  if (entry.fromNative) {
    stopNativeTransfer(entry, event)
    return
  }
  if (!validateFocusTransfer(entry, event)) return
  gesture = null
  removeListeners(entry)
  report(entry, event, 'finish')
  if (!entry.active) return
  setTimeout(() => { suppressClick = false }, 0)
  preview(null)
  const target = targetAt(entry, event)
  if (entry.native) endNativeToolDrag(entry.id)
  if (target && commit(entry, target)) { report(entry, event, 'committed', { target }); return }
  if (!entry.native && window.lf?.isElectron) {
    const r = entry.origin
    const outside = Math.max(r.left - event.clientX, event.clientX - r.right, r.top - event.clientY, event.clientY - r.bottom, 0)
    if (shouldDetachDockDrag(entry.start, { x: event.clientX, y: event.clientY }, false, outside)) {
      releaseNative(entry, event)
      endNativeToolDrag(entry.id)
    }
  }
  if (entry.native) {
    const point = dockNativePosition(event, entry.grab)
    moveNativeTool(entry.id, point.x, point.y)
    entry.store.prefs.dockLayout = updateDockFloat(entry.store.prefs.dockLayout, entry.id, point)
    setDockSpawn(entry.id, point)
    requestAnimationFrame(() => focusNativeTool(entry.id))
  }
}

function cancel(event) {
  const entry = gesture
  if (!entry || event.pointerId !== entry.pointerId) return
  gesture = null
  removeListeners(entry)
  suppressClick = false
  preview(null)
  report(entry, event, 'cancel', { reason: event.reason ?? event.type ?? 'escape' })
  if (entry.fromNative) return
  if (entry.native) {
    endNativeToolDrag(entry.id)
    // Algunos gestores de ventanas cancelan el puntero al mostrar el popup.
    // En ese caso conservamos la ventana; Escape sí revierte el gesto.
    if (event.type !== 'pointercancel') {
      entry.store.prefs.dockLayout = entry.initialLayout
      if (SPECIAL_DOCK_PANELS.includes(entry.id)) notifyNativeDock(entry.id, 'attach')
    } else if (!event.reason && focusWithinGesture(entry)) requestAnimationFrame(() => focusNativeTool(entry.id))
  }
}
function lostCapture(event) {
  const entry = gesture
  if (!entry?.captured || event.target !== entry.body || event.pointerId !== entry.pointerId) return
  if (entry.focusTransfer && focusWithinGesture(entry)) { armFocusTransfer(entry); return }
  if (beginFocusTransfer(entry)) return
  cancel({ pointerId: event.pointerId, type: 'pointercancel' })
}
function blur() {
  const entry = gesture
  if (!entry || entry.transfer) return
  if (beginFocusTransfer(entry)) return
  if (entry.focusTransfer && focusWithinGesture(entry)) return
  cancel({ pointerId: entry.pointerId, type: 'pointercancel', reason: 'blur' })
}
function pagehide() { if (gesture) cancel({ pointerId: gesture.pointerId, type: 'pointercancel', reason: 'pagehide' }) }
function key(event) {
  if (event.key === 'Escape' && gesture) {
    if (gesture.active) { event.preventDefault?.(); event.stopImmediatePropagation?.() }
    cancel({ pointerId: gesture.pointerId })
  }
}

export function startDockGesture(event, id, store, fromNative = false) {
  if (event.button !== 0 || !Object.hasOwn(DOCK_PANELS, id) || gesture) return false
  const source = event.currentTarget.ownerDocument || document
  const win = source.defaultView || window
  if (source.pointerLockElement || document.pointerLockElement || source.body?.isConnected === false) return false
  if (fromNative && (win === window || !window.lf?.isElectron)) return false
  const handle = event.currentTarget.getBoundingClientRect()
  // Se abandona la franja de pestañas, no el panel entero. Usar el rect del
  // grupo hacía que arrastrar hacia abajo/derecha nunca desacoplara hasta
  // cruzar toda la vista; hacia la izquierda sí, por estar mucho más cerca.
  const origin = event.currentTarget.closest?.('.lf-dock-tabs')?.getBoundingClientRect() || handle
  const grab = { x: Math.max(0, event.clientX - handle.left), y: Math.max(0, event.clientY - handle.top) }
  gesture = { id, store, win, body: source.body, fromNative, handle: event.currentTarget, pointerId: event.pointerId,
    start: clientPoint(event), grab,
    origin, initialLayout: store.prefs.dockLayout, active: false, native: fromNative }
  win.addEventListener('pointermove', track, true)
  win.addEventListener('pointerup', finish, true)
  win.addEventListener('pointercancel', cancel, true)
  win.addEventListener('keydown', key, true)
  win.addEventListener('blur', blur)
  win.addEventListener('pagehide', pagehide)
  win.addEventListener('lostpointercapture', lostCapture, true)
  report(gesture, event, 'start')
  return true
}

export function consumeDockClickSuppression() {
  const suppressed = suppressClick
  suppressClick = false
  return suppressed
}
