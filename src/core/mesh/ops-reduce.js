import { checkClosed, cross, sub, dot, len, ekey, signedVolume, triangulateFace } from '../../engine/runtime/mesh/polymesh.js'
import { Sel, normalize } from './sel.js'
import { dissolveEdges } from './ops-edit.js'
import { collapseEdges } from './ops-join.js'

function validResult(before, after, wasClosed, wasVolume) {
  if (after.f.length >= before.f.length || after.f.some((face) =>
    face.length < 3 || new Set(face).size !== face.length ||
    face.some((i) => !after.v[i]?.every(Number.isFinite)) ||
    !Number.isFinite(len(cross(sub(after.v[face[1]], after.v[face[0]]), sub(after.v[face[2]], after.v[face[0]])))) ||
    len(cross(sub(after.v[face[1]], after.v[face[0]]), sub(after.v[face[2]], after.v[face[0]]))) < 1e-9)) return false
  if (wasClosed && checkClosed(after).length) return false
  if (wasClosed && Math.abs(signedVolume(after)) < 0.01 * wasVolume) return false
  return true
}

export function reduceFaces(m, sel, mode, target) {
  if (!Number.isInteger(target) || target < 1 || target >= m.f.length) return 'Indica una cantidad de caras inferior a la actual'
  if (m.f.length > 2048) return 'La reducción interactiva admite hasta 2048 caras por operación'
  const original = m.clone()
  const closed = checkClosed(m).length === 0
  const hasPlanarEdges = [...m.edges().values()].some((edge) => edge.faces.length === 2 &&
    dot(m.faceNormal(edge.faces[0]), m.faceNormal(edge.faces[1])) > 0.9999)
  if (closed && !hasPlanarEdges && m.f.some((face) => face.length > 3)) {
    const faces = m.f, validUV = m.uv.length === faces.length
    const triangulated = [], uv = []
    for (let fi = 0; fi < faces.length; fi++) for (const triangle of triangulateFace(m, fi)) {
      triangulated.push(triangle)
      if (validUV) uv.push(triangle.map((v) => [...m.uv[fi][faces[fi].indexOf(v)]]))
    }
    if (triangulated.length <= 4096 && triangulated.length >= faces.length) {
      m.f = triangulated
      m.uv = validUV ? uv : []
    }
  }
  const volume = closed ? Math.abs(signedVolume(m)) : 0
  let changed = false
  for (let count = 0; count < 512 && m.f.length > target; count++) {
    const edges = [...m.edges().values()].filter((edge) => edge.faces.length === 2 && !m.seams.some(([a, b]) => ekey(a, b) === ekey(edge.a, edge.b)))
    edges.sort((a, b) => len(sub(m.v[a.a], m.v[a.b])) - len(sub(m.v[b.a], m.v[b.b])))
    let next = null
    for (const edge of edges) {
      const [f1, f2] = edge.faces
      const normal1 = m.faceNormal(f1), normal2 = m.faceNormal(f2)
      const samePlane = dot(normal1, normal2) > 0.9999
      const triangles = m.f.every((face) => face.length === 3)
      if (!samePlane && !triangles) continue
      if (!samePlane && dot(normal1, normal2) < 0.75) continue
      const candidate = m.clone()
      const selection = new Sel()
      selection.e.add(ekey(edge.a, edge.b))
      normalize(candidate, selection, 'edge')
      const error = samePlane ? dissolveEdges(candidate, selection, 'edge') : collapseEdges(candidate, selection, 'edge')
      if (typeof error === 'string' || !validResult(m, candidate, closed, volume)) continue
      next = candidate
      break
    }
    if (!next) break
    Object.assign(m, next)
    changed = true
  }
  if (!changed || m.f.length >= original.f.length) { Object.assign(m, original); return 'La malla no tiene aristas compatibles para reducir sin invalidar su topología' }
  sel.clear()
}
