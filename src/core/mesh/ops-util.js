// Operaciones de malla · utilidades compartidas (limpieza, selección por modo). Ver ops.js.
import {
  PolyMesh, ekey, ekeyA, ekeyB, sub, add, mul, dot, cross, norm, len, lerp3, dist, triangulateFace, signedVolume,
} from '../../engine/runtime/mesh/polymesh.js'
import { normalize } from './sel.js'


// ---------- utilidades ----------
export const fixLoop = (f) => {
  const o = []
  for (const v of f) if (o[o.length - 1] !== v) o.push(v)
  while (o.length > 1 && o[0] === o[o.length - 1]) o.pop()
  return o
}
/** Quita caras nulas/degeneradas y vértices sueltos (solo entre `cand`). Devuelve mapas para re-indexar la selección. */
export function cleanup(m, cand = null) {
  const fmap = new Int32Array(m.f.length).fill(-1)
  const nf = []
  m.f.forEach((f, i) => { if (f) { const g = fixLoop(f); if (g.length >= 3) { fmap[i] = nf.length; nf.push(g) } } })
  m.f = nf
  m.we = m.we.filter(([a, b]) => a !== b)
  const vmap = cand && cand.size ? m.pruneLoose(cand) : Int32Array.from({ length: m.v.length }, (_, i) => i)
  return {
    fmap, vmap,
    F: (arr) => [...arr].map((i) => fmap[i]).filter((i) => i >= 0),
    V: (arr) => [...arr].map((i) => vmap[i]).filter((i) => i >= 0),
  }
}
export const setFromMode = (m, sel, mode, { v = [], e = [], f = [] }) => {
  sel.clear()
  if (mode === 'face') f.forEach((i) => sel.f.add(i))
  else if (mode === 'edge') e.forEach((k) => sel.e.add(k))
  else v.forEach((i) => sel.v.add(i))
  return normalize(m, sel, mode)
}
export const faceVerts = (m, faces) => { const s = new Set(); for (const fi of faces) for (const v of m.f[fi]) s.add(v); return s }
