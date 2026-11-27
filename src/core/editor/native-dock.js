import { DOCK_PANELS } from './docking.js'

export const DOCK_DRAG_START_PX = 12
export const DOCK_NATIVE_RELEASE_PX = 24
const origins = new Map()

export function nativeDockAllowed(id) {
  return Object.hasOwn(DOCK_PANELS, id) && id !== 'scriptEditor'
}

export function setDockSpawn(id, point) {
  if (!nativeDockAllowed(id)) return false
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return false
  origins.set(id, { x: Math.round(point.x), y: Math.round(point.y) })
  return true
}

export function getDockSpawn(id) {
  return origins.get(id) || null
}

export function dockDragDistance(start, current) {
  return Math.hypot(current.x - start.x, current.y - start.y)
}

export function dockNativePosition(pointer, grab = { x: 0, y: 0 }) {
  return {
    x: Math.round(pointer.screenX - grab.x),
    y: Math.round(pointer.screenY - grab.y),
  }
}

export function shouldDetachDockDrag(start, current, insideTarget, outsideOrigin) {
  return !insideTarget && outsideOrigin >= DOCK_NATIVE_RELEASE_PX &&
    dockDragDistance(start, current) >= DOCK_DRAG_START_PX
}

export function notifyNativeDock(id, action) {
  if (!nativeDockAllowed(id) || !['detach', 'attach'].includes(action) || typeof window === 'undefined') return false
  window.dispatchEvent(new CustomEvent(`century:dock-${action}`, { detail: { id } }))
  return true
}
