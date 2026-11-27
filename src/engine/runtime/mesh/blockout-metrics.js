// Coordenadas de autoría en metros, separadas de las UV del material.
// El origen se reinicia por cara: las extrusiones no heredan el desplazamiento de otra superficie.
import { sub, cross, dot, norm, len } from './polymesh.js'

/** Medidas locales de un polígono después de aplicar la escala del objeto. */
export function faceMetrics(points) {
  if (!Array.isArray(points) || points.length < 3) return null
  let longest = 0, axis = null
  for (let i = 0; i < points.length; i++) {
    const e = sub(points[(i + 1) % points.length], points[i]), n = len(e)
    if (n > longest) { longest = n; axis = e }
  }
  if (!axis || longest < 1e-8) return null
  let normal = [0, 0, 0]
  for (let i = 1; i < points.length - 1; i++) {
    normal = cross(sub(points[i], points[0]), sub(points[i + 1], points[0]))
    if (len(normal) > 1e-8) break
  }
  if (len(normal) < 1e-8) return null
  const u = norm(axis), v = norm(cross(norm(normal), u))
  const raw = points.map((p) => [dot(sub(p, points[0]), u), dot(sub(p, points[0]), v)])
  const minU = Math.min(...raw.map((x) => x[0])), minV = Math.min(...raw.map((x) => x[1]))
  const maxU = Math.max(...raw.map((x) => x[0])), maxV = Math.max(...raw.map((x) => x[1]))
  return { uv: raw.map(([x, y]) => [x - minU, y - minV]), size: [maxU - minU, maxV - minV] }
}

/** La métrica no reutiliza m.uv: los UV artísticos permanecen intactos. */
export function polyFaceMetrics(mesh, scale = [1, 1, 1]) {
  return mesh.f.map((face) => faceMetrics(face.map((v) => mesh.v[v].map((n, i) => n * Math.abs(scale[i])))))
}

/** Asigna atributos a geometrías unitarias ya no indexadas (caja, rampa, escalera).
 * Las caras coplanares comparten origen; no se trocea cada cuadrícula en polígonos.
 */
export function primitiveMetricAttributes(positions, normals, scale = [1, 1, 1]) {
  const count = positions.length / 3
  const uv = new Float32Array(count * 2), size = new Float32Array(count * 2)
  const groups = new Map()
  for (let i = 0; i + 2 < count; i += 3) {
    const points = [i, i + 1, i + 2].map((j) => [0, 1, 2].map((k) => positions[j * 3 + k] * Math.abs(scale[k])))
    const n = norm(cross(sub(points[1], points[0]), sub(points[2], points[0])))
    if (len(n) < 1e-8) continue
    const plane = dot(n, points[0])
    // Un mismo plano, aunque provenga de triángulos diferentes, comparte origen métrico.
    const key = [...n, plane].map((x) => Math.round(x * 10000)).join(':')
    if (!groups.has(key)) groups.set(key, new Map())
    const group = groups.get(key)
    for (let j = 0; j < 3; j++) group.set(i + j, points[j])
  }
  for (const group of groups.values()) {
    const entries = [...group.entries()]
    // Ordenar el contorno: los triángulos coplanares no llegan necesariamente en orden.
    const unique = [...new Map(entries.map(([,p]) => [p.map((x) => x.toFixed(6)).join(':'), p])).values()]
    if (unique.length < 3) continue
    const center = [0,1,2].map((j) => unique.reduce((v,p) => v+p[j],0)/unique.length)
    let normal = [0,0,0]
    for (let i=1; i<unique.length-1; i++) {
      normal = cross(sub(unique[i],unique[0]),sub(unique[i+1],unique[0]))
      if (len(normal)>1e-7) break
    }
    if (len(normal)<1e-7) continue
    const reference = norm(sub(unique[0],center)), across = norm(cross(norm(normal),reference))
    const ordered = [...unique].sort((a,b) => Math.atan2(dot(sub(a,center),across),dot(sub(a,center),reference)) - Math.atan2(dot(sub(b,center),across),dot(sub(b,center),reference)))
    const metrics = faceMetrics(ordered)
    if (!metrics) continue
    for (const [index, point] of entries) {
      const j = ordered.findIndex((p) => p.every((x,k) => Math.abs(x-point[k]) < 1e-5))
      if (j < 0) continue
      uv.set(metrics.uv[j],index*2)
      size.set(metrics.size,index*2)
    }
  }
  void normals
  return { uv, size }
}
