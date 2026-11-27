/**
 * LF-NODE-COLLISION-BOX-FIT-CORR-G001 — núcleo matemático independiente de render/Jolt.
 * Convierte ocho esquinas de cada geometría al espacio local de CollisionShape3D.
 * Así se respeta tamaño real del mesh, offsets, rotaciones y transformaciones heredadas,
 * sin modificar ninguna escala del nodo físico.
 *
 * Cada entrada contiene { min:[x,y,z], max:[x,y,z], matrix:[16] }.
 * matrix es la transformación de los vértices locales de la malla hacia el espacio
 * local de CollisionShape3D (column-major, igual a THREE.Matrix4.elements).
 */
export function fitBoxBounds(entries, { minimumSize = 0.01 } = {}) {
  if (!Array.isArray(entries)) throw new TypeError('La geometría debe ser una colección')
  if (!Number.isFinite(minimumSize) || minimumSize <= 0) throw new RangeError('minimumSize inválido')
  const low = [Infinity, Infinity, Infinity]
  const high = [-Infinity, -Infinity, -Infinity]
  let count = 0
  for (const entry of entries) {
    const { min, max, matrix: m } = entry || {}
    if (!Array.isArray(min) || !Array.isArray(max) || min.length !== 3 || max.length !== 3 || !Array.isArray(m) || m.length !== 16 ||
        [...min, ...max, ...m].some(v => !Number.isFinite(v)) || min.some((v, i) => v > max[i])) {
      throw new TypeError('Límites o matriz de geometría inválidos')
    }
    // Aplicar matriz completa a cada esquina (bbox local de cada mesh), con perspectiva
    // deshabilitada por tratarse únicamente de matrices afines del árbol de escena.
    if (Math.abs(m[3]) > 1e-9 || Math.abs(m[7]) > 1e-9 || Math.abs(m[11]) > 1e-9 || Math.abs(m[15] - 1) > 1e-9) {
      throw new TypeError('Transformación no afín')
    }
    for (let k = 0; k < 8; k++) {
      const x = k & 1 ? max[0] : min[0]
      const y = k & 2 ? max[1] : min[1]
      const z = k & 4 ? max[2] : min[2]
      const q = [m[0]*x + m[4]*y + m[8]*z + m[12],
                 m[1]*x + m[5]*y + m[9]*z + m[13],
                 m[2]*x + m[6]*y + m[10]*z + m[14]]
      if (!q.every(Number.isFinite)) throw new RangeError('Transformación geométrica fuera de rango')
      for (let i = 0; i < 3; i++) { low[i] = Math.min(low[i], q[i]); high[i] = Math.max(high[i], q[i]) }
    }
    count++
  }
  if (!count) return null
  const size = high.map((v, i) => Math.max(minimumSize, v - low[i]))
  const center = high.map((v, i) => (v + low[i]) / 2)
  if (![...size,...center].every(v=>Number.isFinite(v) && Math.abs(v) <= 100000)) throw new RangeError('Caja envolvente excede los límites físicos')
  return { size, center, meshCount: count }
}
