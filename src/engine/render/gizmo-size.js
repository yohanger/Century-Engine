// Tamaño de los gizmos del editor (Preferencias ▸ «Tamaño de los gizmos» y el control de la barra del visor).
// Un solo factor para mover/rotar/escalar, el gizmo de la pieza de terreno y el de edición de malla. La cruceta de ejes no cambia.
export const GIZMO_MIN = 0.5
export const GIZMO_MAX = 4
/** Factor válido (1 = el tamaño de siempre). */
export const gizmoScale = (v) => { const n = +v; return Number.isFinite(n) && n > 0 ? Math.min(GIZMO_MAX, Math.max(GIZMO_MIN, n)) : 1 }
/** OBSOLETO: la cruceta de ejes del visor es de tamaño constante (no sigue «Tamaño de los gizmos»). Se conserva y devuelve siempre 1. */
export const orientScale = () => 1
