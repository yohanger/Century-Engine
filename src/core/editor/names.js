// Nombres reales del proyecto abierto (nodos, interruptores, audio…) para el IntelliSense de los editores internos.
// Misma lista que .levelforge/project.d.ts para VS Code (vscode/files.js · projectNames); se recalcula como mucho una vez por segundo.
import { store } from '../store.js'
import { projectNames } from '../vscode/files.js'

let cache = null, at = 0, owner = null
export function liveNames() {
  const p = store.project
  if (!p) return {}
  const now = performance.now()
  if (cache && owner === p && now - at < 1000) return cache
  cache = projectNames(p, new Map([['_', { objects: p.objects || [] }]]))
  at = now
  owner = p
  return cache
}
