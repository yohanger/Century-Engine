// Brushes sustractivos (estilo BSP de Unreal): restar un sólido a otro para abrir puertas, ventanas, túneles y arcos.
//
// Es CSG por árboles BSP sobre polígonos convexos (sin dependencias, sin DOM, mismo código en el editor y en el juego exportado).
// El método es el clásico: se parte cada polígono con los planos del otro sólido, se tiran los trozos de dentro y se unen las
// caras nuevas (las paredes interiores del hueco, que heredan la normal invertida del brush). Trabaja en el ESPACIO UNITARIO del
// sólido que se corta; los brushes llegan ya transformados a ese espacio (ver `carveGeometry`).
import * as THREE from 'three'

const EPS = 1e-5
const COPLANAR = 0, FRONT = 1, BACK = 2, SPANNING = 3

// Atributos adicionales utilizados por Blockout, Vertex Paint y mallas coloreadas.
const CSG_ATTRIBUTES = ['lfBlockUV', 'lfBlockSize', 'lfPaintUV', 'lfColor', 'lfWeights0', 'lfWeights1', 'color']

class Vtx {
  constructor(p, n, uv, attrs = {}) { this.p = p; this.n = n; this.uv = uv; this.attrs = attrs }
  clone() { return new Vtx(this.p.slice(), this.n.slice(), this.uv.slice(), Object.fromEntries(Object.entries(this.attrs).map(([k,v]) => [k,v.slice()]))) }
  flip() { this.n = [-this.n[0], -this.n[1], -this.n[2]] }
  lerp(o, t) {
    const l = (a, b) => a.map((v, i) => v + (b[i] - v) * t)
    const n = l(this.n, o.n), k = Math.hypot(n[0], n[1], n[2]) || 1
    const attrs = {}
    for (const key of Object.keys(this.attrs)) {
      if (o.attrs[key]) attrs[key] = l(this.attrs[key], o.attrs[key])
    }
    return new Vtx(l(this.p, o.p), [n[0] / k, n[1] / k, n[2] / k], l(this.uv, o.uv), attrs)
  }
}

class Plane {
  constructor(n, w) { this.n = n; this.w = w }
  static from(a, b, c) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    const l = Math.hypot(nx, ny, nz)
    if (l < 1e-12) return null // triángulo degenerado
    nx /= l; ny /= l; nz /= l
    return new Plane([nx, ny, nz], nx * a[0] + ny * a[1] + nz * a[2])
  }
  flip() { this.n = [-this.n[0], -this.n[1], -this.n[2]]; this.w = -this.w }
  split(poly, cf, cb, f, b) {
    let type = 0
    const types = poly.v.map((v) => {
      const t = this.n[0] * v.p[0] + this.n[1] * v.p[1] + this.n[2] * v.p[2] - this.w
      const ty = t < -EPS ? BACK : t > EPS ? FRONT : COPLANAR
      type |= ty
      return ty
    })
    switch (type) {
      case COPLANAR: (this.n[0] * poly.plane.n[0] + this.n[1] * poly.plane.n[1] + this.n[2] * poly.plane.n[2] > 0 ? cf : cb).push(poly); break
      case FRONT: f.push(poly); break
      case BACK: b.push(poly); break
      default: { // SPANNING
        const fv = [], bv = []
        for (let i = 0; i < poly.v.length; i++) {
          const j = (i + 1) % poly.v.length, ti = types[i], tj = types[j], vi = poly.v[i], vj = poly.v[j]
          if (ti !== BACK) fv.push(vi)
          if (ti !== FRONT) bv.push(ti !== BACK ? vi.clone() : vi)
          if ((ti | tj) === SPANNING) {
            const t = (this.w - (this.n[0] * vi.p[0] + this.n[1] * vi.p[1] + this.n[2] * vi.p[2])) / (this.n[0] * (vj.p[0] - vi.p[0]) + this.n[1] * (vj.p[1] - vi.p[1]) + this.n[2] * (vj.p[2] - vi.p[2]))
            const v = vi.lerp(vj, t)
            fv.push(v); bv.push(v.clone())
          }
        }
        if (fv.length >= 3) f.push(new Poly(fv, poly.plane, poly.tag))
        if (bv.length >= 3) b.push(new Poly(bv, poly.plane, poly.tag))
      }
    }
  }
}

class Poly {
  constructor(v, plane, tag = 0) { this.v = v; this.plane = plane || Plane.from(v[0].p, v[1].p, v[2].p); this.tag = tag } // tag: 0 = cara del sólido, i+1 = cara creada por el brush i
  clone() { return new Poly(this.v.map((x) => x.clone()), new Plane(this.plane.n.slice(), this.plane.w), this.tag) }
  flip() { this.v.reverse().forEach((x) => x.flip()); this.plane.flip() }
}

class BspNode {
  constructor(polys) { this.plane = null; this.front = null; this.back = null; this.polys = []; if (polys) this.build(polys) }
  clone() {
    const n = new BspNode()
    n.plane = this.plane && new Plane(this.plane.n.slice(), this.plane.w)
    n.front = this.front?.clone() || null; n.back = this.back?.clone() || null
    n.polys = this.polys.map((p) => p.clone())
    return n
  }
  invert() {
    for (const p of this.polys) p.flip()
    this.plane?.flip()
    this.front?.invert(); this.back?.invert()
    const t = this.front; this.front = this.back; this.back = t
  }
  clip(polys) {
    if (!this.plane) return polys.slice()
    let f = [], b = []
    for (const p of polys) this.plane.split(p, f, b, f, b)
    f = this.front ? this.front.clip(f) : f
    b = this.back ? this.back.clip(b) : []
    return f.concat(b)
  }
  clipTo(bsp) {
    this.polys = bsp.clip(this.polys)
    this.front?.clipTo(bsp); this.back?.clipTo(bsp)
  }
  all() {
    let out = this.polys.slice()
    if (this.front) out = out.concat(this.front.all())
    if (this.back) out = out.concat(this.back.all())
    return out
  }
  build(polys) {
    if (!polys.length) return
    if (!this.plane) this.plane = new Plane(polys[0].plane.n.slice(), polys[0].plane.w)
    const f = [], b = []
    for (const p of polys) this.plane.split(p, this.polys, this.polys, f, b)
    if (f.length) (this.front ||= new BspNode()).build(f)
    if (b.length) (this.back ||= new BspNode()).build(b)
  }
}

/** Triángulos de una geometría (indexada o no) → polígonos; `m` (Matrix4) la lleva a otro espacio. */
function polysOf(geo, m, tag = 0) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv, idx = geo.index
  const nm = m ? new THREE.Matrix3().getNormalMatrix(m) : null
  const flipWind = m ? m.determinant() < 0 : false // una escala negativa invierte el orden de los vértices
  const tmp = new THREE.Vector3()
  const vtx = (i) => {
    tmp.fromBufferAttribute(pos, i); if (m) tmp.applyMatrix4(m)
    const p = [tmp.x, tmp.y, tmp.z]
    let n = [0, 1, 0]
    if (nor) { tmp.fromBufferAttribute(nor, i); if (nm) tmp.applyMatrix3(nm); tmp.normalize(); n = [tmp.x, tmp.y, tmp.z] }
    const attrs = {}
    for (const key of CSG_ATTRIBUTES) {
      const attr = geo.getAttribute?.(key) || geo.attributes[key]
      if (attr) attrs[key] = Array.from({length: attr.itemSize}, (_, j) => attr.array[i * attr.itemSize + j])
    }
    return new Vtx(p, n, uv ? [uv.getX(i), uv.getY(i)] : [0, 0], attrs)
  }
  const count = idx ? idx.count : pos.count
  const out = []
  for (let k = 0; k + 2 < count; k += 3) {
    const a = idx ? idx.getX(k) : k, b = idx ? idx.getX(k + 1) : k + 1, c = idx ? idx.getX(k + 2) : k + 2
    const v = flipWind ? [vtx(a), vtx(c), vtx(b)] : [vtx(a), vtx(b), vtx(c)]
    const pl = Plane.from(v[0].p, v[1].p, v[2].p)
    if (pl) out.push(new Poly(v, pl, tag))
  }
  return out
}

function geometryOf(polys) {
  const P = [], N = [], U = [], attrs = {}
  const schema = {}
  for (const p of polys) for (const v of p.v) {
    for (const [key, arr] of Object.entries(v.attrs)) schema[key] = arr.length
  }
  for (const key of Object.keys(schema)) attrs[key] = []
  for (const p of polys) {
    for (let i = 2; i < p.v.length; i++) {
      for (const v of [p.v[0], p.v[i - 1], p.v[i]]) {
        P.push(...v.p); N.push(...v.n); U.push(...v.uv)
        for (const [key, arr] of Object.entries(attrs)) arr.push(...(v.attrs[key] || new Array(schema[key]).fill(0)))
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2))
  for (const [key, arr] of Object.entries(attrs)) g.setAttribute(key, new THREE.Float32BufferAttribute(arr, schema[key]))
  g.computeBoundingSphere(); g.computeBoundingBox()
  return g
}

/**
 * Resta `cutters` de `base`. `cutters` = [{ geometry, matrix }] con `matrix` (Matrix4) que lleva cada brush al espacio de `base`.
 * Devuelve los polígonos convexos resultantes: [{ pts: [[x,y,z]…], tag }] (tag 0 = cara original, i+1 = cara abierta por el brush i;
 * así cada brush puede dar su propio material a las paredes del hueco). Lista vacía si no queda nada.
 */
export function carvePolys(base, cutters) {
  const a = new BspNode(polysOf(base, null, 0))
  cutters.forEach((c, i) => {
    const b = new BspNode(polysOf(c.geometry, c.matrix, i + 1))
    a.invert(); a.clipTo(b); b.clipTo(a); b.invert(); b.clipTo(a); b.invert()
    a.build(b.all()); a.invert()
  })
  return a.all().map((p) => ({ pts: p.v.map((v) => v.p), poly: p, tag: p.tag }))
}

/** Geometrías del resultado, una por tag: Map(tag → BufferGeometry). El llamador las libera. */
export function carveGeometries(base, cutters) {
  const by = new Map()
  for (const p of carvePolys(base, cutters)) { if (!by.has(p.tag)) by.set(p.tag, []); by.get(p.tag).push(p.poly) }
  return { geos: new Map([...by].map(([t, ps]) => [t, geometryOf(ps)])), polys: [...by].flatMap(([t, ps]) => ps.map((p) => ({ pts: p.v.map((v) => v.p), tag: t }))) }
}

/** ¿Se solapan las cajas envolventes (en el espacio de `base`)? Evita recortar lo que no se toca. */
export function cutterTouches(baseGeo, cutGeo, matrix) {
  if (!baseGeo.boundingBox) baseGeo.computeBoundingBox()
  if (!cutGeo.boundingBox) cutGeo.computeBoundingBox()
  const box = cutGeo.boundingBox.clone().applyMatrix4(matrix)
  return box.intersectsBox(baseGeo.boundingBox)
}

/** Los nodos sustractivos recortan; las primitivas y mallas son sólidos receptores. */
export const isCutter = (o) => o?.type === 'subtract' || o?.type === 'meshSubtract'
