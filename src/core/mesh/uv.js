// Operaciones UV de Edit Mesh. No cambia geometría ni materiales; las UV se guardan por esquina.
import { finiteFloat32 } from '../../engine/runtime/numeric-integrity.js'
import { ekey } from '../../engine/runtime/mesh/polymesh.js'

const facesOf = (m, selection) => {
  const result = selection?.f?.size ? [...selection.f] : m.f.map((_, i) => i)
  return result.filter((i) => i >= 0 && i < m.f.length && !m.faceHidden(i))
}
const finite2 = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)

/** Proyección planar conjunta en un eje; UV en metros del espacio local. */
export function projectPlanar(m, sel, axis = 'z') {
  if (!['x', 'y', 'z'].includes(axis)) return 'Eje UV inválido'
  const axes = axis === 'x' ? [2, 1] : axis === 'y' ? [0, 2] : [0, 1]
  m.ensureUV()
  for (const fi of facesOf(m, sel)) m.uv[fi] = m.f[fi].map((v) => axes.map((a) => m.v[v][a]))
}
/** Proyección tipo caja: elige el plano dominante de cada cara. No modifica costuras. */
export function projectBox(m, sel) {
  m.ensureUV()
  for (const fi of facesOf(m, sel)) {
    const n = m.faceNormal(fi).map(Math.abs)
    const axes = n[0] >= n[1] && n[0] >= n[2] ? [2, 1] : n[1] >= n[2] ? [0, 2] : [0, 1]
    m.uv[fi] = m.f[fi].map((v) => axes.map((a) => m.v[v][a]))
  }
}
/** Transformación UV local al centro de las esquinas seleccionadas. */
export function transformUV(m, sel, { translate = [0, 0], rotate = 0, scale = [1, 1] } = {}) {
  if (!finite2(translate) || !finite2(scale) || !Number.isFinite(rotate) || scale.some((n) => n === 0)) return 'Transformación UV inválida'
  m.ensureUV()
  const targets = facesOf(m, sel).flatMap((fi) => m.uv[fi])
  if (!targets.length) return 'No hay caras que editar'
  const pivot = [0, 0]
  for (const uv of targets) { pivot[0] += uv[0]; pivot[1] += uv[1] }
  pivot[0] /= targets.length; pivot[1] /= targets.length
  const a = rotate * Math.PI / 180, c = Math.cos(a), s = Math.sin(a)
  const result = targets.map(uv => {
    const x = (uv[0] - pivot[0]) * scale[0], y = (uv[1] - pivot[1]) * scale[1]
    return [pivot[0] + c * x - s * y + translate[0], pivot[1] + s * x + c * y + translate[1]]
  })
  if (result.some(p => !p.every(finiteFloat32))) return "Transformación UV fuera del rango numérico"
  targets.forEach((uv, i) => { uv[0] = result[i][0]; uv[1] = result[i][1] })
}
/** Marca o limpia costuras según la selección de aristas. */
export function setSeams(m, sel, on = true) {
  if (!sel?.e?.size) return 'Selecciona al menos una arista para marcar costuras UV'
  const edges = m.edges(), keys = new Set(m.seams.map(([a, b]) => ekey(a, b)))
  for (const k of sel.e) {
    if (!edges.has(k)) return 'Selección de aristas inválida'
    if (on) keys.add(k); else keys.delete(k)
  }
  m.seams = [...keys].map((k) => [edges.get(k)?.a, edges.get(k)?.b]).filter(([a, b]) => a != null && b != null)
}
/** Los puntos UV para el panel; no muta la malla original ni la escena. */
export function uvPreview(m, sel, maxFaces = 2500) {
  // El panel SVG se limita para no crear decenas de miles de nodos DOM.
  // Los comandos UV sí operan sobre la selección completa, sin este límite.
  const chosen = m.f.map((_, i) => i)
  if (chosen.length > maxFaces) {
    const selected = [...(sel?.f || [])].filter((i) => i >= 0 && i < m.f.length)
    const unique = new Set([...selected, ...chosen])
    chosen.splice(0, chosen.length, ...[...unique].slice(0, maxFaces))
  }
  return chosen.map((i) => {
    const face = m.f[i]
    const n = m.faceNormal(i).map(Math.abs)
    const axis = n[0] >= n[1] && n[0] >= n[2] ? [2, 1] : n[1] >= n[2] ? [0, 2] : [0, 1]
    const uv = m.uv[i]?.length === face.length ? m.uv[i] : face.map((v) => axis.map((k) => m.v[v][k]))
    return { id: i, selected: !!sel?.f?.has(i), uv }
  })
}
