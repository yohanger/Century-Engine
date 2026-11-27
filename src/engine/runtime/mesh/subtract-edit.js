import { PolyMesh, checkClosed, signedVolume, triangulateFace, cross, sub, len } from './polymesh.js'
import { fromPrimitive, stairs } from './generators.js'

export function initialSubtractPoly(obj) {
  if (obj.kind !== 'stairs') return fromPrimitive(obj.kind === 'cylinder' ? 'cylinder' : 'box', [1, 1, 1], obj.props)
  const scale = (obj.scale || [1, 1, 1]).map(v => Math.abs(v))
  if (scale.some(v => !Number.isFinite(v) || v <= 1e-6)) return null
  const p = stairs(scale[0], scale[1], scale[2], obj.props?.steps ?? 8, obj.props?.turn ?? 0, obj.props)
  for (const v of p.v) for (let axis = 0; axis < 3; axis++) v[axis] /= scale[axis]
  return p
}

export function validateSubtractPoly(poly) {
  if (!(poly instanceof PolyMesh) || !poly.f.length || !poly.v.length) return 'Substract necesita un volumen con caras'
  if (poly.f.length > 8192 || poly.v.length > 8192) return 'Substract admite hasta 8192 caras y vértices'
  if (poly.v.some(p => p.length !== 3 || p.some(v => !Number.isFinite(v)))) return 'El cortador contiene coordenadas inválidas'
  for (const face of poly.f) {
    if (face.length < 3 || new Set(face).size !== face.length || face.some(i => !Number.isInteger(i) || i < 0 || i >= poly.v.length)) return 'El cortador contiene caras degeneradas'
    if (len(cross(sub(poly.v[face[1]], poly.v[face[0]]), sub(poly.v[face[2]], poly.v[face[0]]))) < 1e-9) return 'El cortador contiene caras sin superficie'
  }
  if (checkClosed(poly).length) return 'Substract debe ser un volumen cerrado y con aristas compartidas correctamente'
  if (poly.f.some((_, i) => triangulateFace(poly, i).length < poly.f[i].length - 2)) return 'Substract contiene caras que no se pueden triangular'
  if (signedVolume(poly) <= 1e-7) return 'Substract necesita caras orientadas hacia fuera y volumen positivo'
  return null
}

export function subtractPolyOf(obj) {
  const data = obj?.props?.mesh
  if (!data) return null
  try {
    const poly = PolyMesh.fromJSON(data)
    return validateSubtractPoly(poly) ? null : poly
  } catch { return null }
}
