export const WATER_DEFAULTS = Object.freeze({
  fill: 0.7,
  cellSize: 0.4,
  maxCells: 16000,
  maxTriangles: 24000,
  opacity: 0.7,
})

const clamp = (value, min, max, fallback) => Number.isFinite(value)
  ? Math.max(min, Math.min(max, value)) : fallback

export function resolveWaterBudgets(water) {
  const values = Array.isArray(water) && water.length ? water : [{ props: {} }]
  return {
    cellSizeMeters: Math.min(...values.map(node => clamp(node.props?.cellSize, 0.1, 1, WATER_DEFAULTS.cellSize))),
    maxCells: Math.round(Math.min(...values.map(node => clamp(node.props?.maxCells, 1000, 100000, WATER_DEFAULTS.maxCells)))),
    maxTriangles: Math.min(...values.map(node => clamp(node.props?.maxTriangles, 1000, 250000, WATER_DEFAULTS.maxTriangles))),
  }
}

/** Conservative search box for bodies that can affect occupied water cells this fixed step. */
export function waterBodySearchBounds(center, size, velocity, dt, cellSize) {
  const values = [center?.x, center?.y, center?.z, size?.x, size?.y, size?.z, cellSize, dt]
  if (values.some(value => !Number.isFinite(value)) || size.x <= 0 || size.y <= 0 || size.z <= 0 || cellSize <= 0 || dt < 0) return null
  const speed = Array.isArray(velocity) && velocity.length === 3 && velocity.every(Number.isFinite)
    ? Math.hypot(...velocity) : null
  if (speed === null) return null
  const margin = 2 * cellSize + speed * dt
  // A sphere enclosing the local box remains conservative under Jolt rotation.
  const radius = Math.hypot(size.x, size.y, size.z) * 0.5 + margin
  const half = [radius, radius, radius]
  return {
    min: [center.x - half[0], center.y - half[1], center.z - half[2]],
    max: [center.x + half[0], center.y + half[1], center.z + half[2]],
  }
}
