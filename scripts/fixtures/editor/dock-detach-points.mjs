import { DOCK_DRAG_START_PX, DOCK_NATIVE_RELEASE_PX, dockDragDistance, shouldDetachDockDrag } from '../../../src/core/editor/native-dock.js'

export function outsideTabStrip(rect, point) {
  return Math.max(rect.left - point.x, point.x - rect.right, rect.top - point.y, point.y - rect.bottom, 0)
}

// Search along the actual tab strip edges, on integer client coordinates suitable for both input drivers.
export function findDetachPoints({ source, origin, width, height, isClear }) {
  const inside = p => p.x >= 0 && p.y >= 0 && p.x < width && p.y < height
  const t = DOCK_NATIVE_RELEASE_PX
  const x = Math.round(source.x), y = Math.round(source.y)
  const axes = [
    { axis: 'y', fixed: x, edge: origin.top, sign: -1 },
    { axis: 'y', fixed: x, edge: origin.bottom, sign: 1 },
    { axis: 'x', fixed: y, edge: origin.left, sign: -1 },
    { axis: 'x', fixed: y, edge: origin.right, sign: 1 },
  ]
  for (const { axis, fixed, edge, sign } of axes) {
    const coord = distance => sign < 0 ? Math.floor(edge - distance) : Math.ceil(edge + distance)
    const make = distance => axis === 'x' ? { x: coord(distance), y: fixed } : { x: fixed, y: coord(distance) }
    const before = make(t - 2), crossing = make(t), beyond = make(t + 4)
    const points = [before, crossing, beyond]
    if (!points.every(p => inside(p) && isClear(p) && dockDragDistance(source,p) >= DOCK_DRAG_START_PX)) continue
    if (shouldDetachDockDrag(source,before,false,outsideTabStrip(origin,before))) continue
    if (!points.slice(1).every(p => shouldDetachDockDrag(source,p,false,outsideTabStrip(origin,p)))) continue
    return { source, origin, threshold:t, startThreshold:DOCK_DRAG_START_PX, before, crossing, beyond,
      distances: points.map(p => outsideTabStrip(origin,p)) }
  }
  return null
}
