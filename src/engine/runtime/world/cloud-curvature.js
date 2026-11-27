// Radio terrestre de referencia en metros. World (consultas de CloudField) y
// cielo WebGL comparten la misma curvatura: a altura humana el horizonte queda
// prácticamente recto; la depresión aumenta gradualmente al elevar la cámara.
// No altera la geometría de Terrain ni introduce una esfera de malla.
export const CLOUD_CURVATURE_RADIUS = 6371000
export const CLOUD_VIEW_DISTANCE = 28000

/** Altura de la capa en el plano tangente al observador, a una distancia horizontal dada. */
export function cloudHeightAtDistance(height, distanceSquared) {
  const radius = CLOUD_CURVATURE_RADIUS + height
  return height - distanceSquared / (radius + Math.sqrt(Math.max(0, radius * radius - distanceSquared)))
}
