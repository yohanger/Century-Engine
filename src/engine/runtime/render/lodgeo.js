// LOD de geometrías de three: extrae los atributos, los simplifica con lod.js y devuelve otra BufferGeometry.
import * as THREE from 'three'
import { simplifyTopology } from './lod-indexed.js'

/** Copia un atributo (normal, interleaved o no) a un Float32Array compacto. */
function floats(attr) {
  const n = attr.count, k = attr.itemSize, out = new Float32Array(n * k)
  for (let i = 0; i < n; i++) for (let c = 0; c < k; c++) out[i * k + c] = attr.getComponent ? attr.getComponent(i, c) : attr.array[i * k + c]
  return { array: out, itemSize: k }
}

/** Triángulos de una geometría. */
export const trianglesOf = (g) => (g.index ? g.index.count : g.attributes.position?.count || 0) / 3

/** ¿Se puede simplificar? (no con animación por esqueleto o morphs, que dependen de los vértices originales) */
export const simplifiable = (g) => !!g?.attributes?.position && !g.attributes.skinIndex && !g.attributes.skinWeight && !Object.keys(g.morphAttributes || {}).length && !g.attributes.uv1

export function serializeLodGeometry(g) {
  const attrs = {}
  for (const [name, a] of Object.entries(g.attributes)) if (name !== 'position') attrs[name] = floats(a)
  return { position: floats(g.attributes.position).array, index: g.index ? Uint32Array.from(g.index.array) : null, attrs }
}

export function lodTransferables({ position, index, attrs }) {
  return [position.buffer, ...(index ? [index.buffer] : []), ...Object.values(attrs).map(a => a.array.buffer)]
}

export function lodBufferGeometry(g, result) {
  if (!result?.triangles || result.triangles >= trianglesOf(g)) return null
  return geometryFromLod(result, g.uuid)
}

export function geometryFromLod(result, sourceId) {
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(result.position, 3))
  for (const [name, a] of Object.entries(result.attrs)) out.setAttribute(name, new THREE.BufferAttribute(a.array, a.itemSize))
  out.setIndex(new THREE.BufferAttribute(result.index, 1))
  out.computeBoundingSphere(); out.computeBoundingBox()
  out.userData.lodOf = sourceId
  return out
}

/** Geometría con ~`ratio` de los triángulos, o null si no se puede. */
export function simplifyGeometry(g, ratio) {
  if (!simplifiable(g)) return null
  return lodBufferGeometry(g, simplifyTopology(serializeLodGeometry(g), ratio))
}
