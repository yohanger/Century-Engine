// Cuadratura de columnas de sólidos: m³ ocupados / área de celda = altura equivalente.
// Sin dependencia de Three/Jolt. El host entrega la pose y las dimensiones de su collider.
const EPS = 1e-12
const QUAD = [0.125, 0.375, 0.625, 0.875]

function prepare(o) {
  if (!o || !['box', 'sphere', 'capsule'].includes(o.kind) ||
      !Array.isArray(o.center) || o.center.length !== 3 || !Array.isArray(o.size) || o.size.length !== 3 ||
      [...o.center, ...o.size].some(v => !Number.isFinite(v)) || o.size.some(v => v <= 0))
    throw new RangeError('Fluido: cuerpo desplazador inválido')
  // Compatibilidad: no interpretar una caja inclinada sin orientación como una caja vertical.
  if (o.kind === 'box' && o.upright === false && !o.quaternion) return null
  const q = o.quaternion || [0, 0, 0, 1]
  if (!Array.isArray(q) || q.length !== 4 || q.some(v => !Number.isFinite(v)) || Math.hypot(...q) < EPS)
    throw new RangeError('Fluido: orientación de cuerpo inválida')
  const norm = Math.hypot(...q), [x, y, z, w] = q.map(v => v / norm)
  // Matriz local → mundo. Su traspuesta transforma un rayo vertical al sólido local.
  const m = [1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w),
    2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w),
    2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]
  const [sx, sy, sz] = o.size
  // Mismas dimensiones que colliderShapeDimensions / BodySet.
  const radius = o.kind === 'sphere' ? Math.max(0.02, (sx+sy+sz)/6) : Math.max(0.02, (sx+sz)/4)
  const half = o.kind === 'capsule' ? Math.max(0.001, sy/2-radius) : 0
  const extent = axis => o.kind === 'box'
    ? Math.abs(m[axis])*sx/2 + Math.abs(m[axis+1])*sy/2 + Math.abs(m[axis+2])*sz/2
    : radius + Math.abs(m[axis+1])*half
  return { ...o, m, radius, half, rx: extent(0), rz: extent(6) }
}

function slab(p, d, half) {
  if (Math.abs(d) < EPS) return Math.abs(p) <= half ? [-Infinity, Infinity] : null
  const a = (-half-p)/d, b = (half-p)/d
  return [Math.min(a,b), Math.max(a,b)]
}
function quadratic(a, b, c) {
  if (a < EPS) return c <= 0 ? [-Infinity, Infinity] : null
  const disc = b*b - 4*a*c
  if (disc < 0) return null
  const s = Math.sqrt(disc)
  return [(-b-s)/(2*a), (-b+s)/(2*a)]
}
function intersect(a, b) {
  if (!a || !b) return null
  const lo = Math.max(a[0], b[0]), hi = Math.min(a[1], b[1])
  return hi > lo ? [lo,hi] : null
}

/** Intervalo mundial de altura ocupado por un sólido convexo en una columna vertical. */
function column(o, x, z) {
  const { m, center: [cx,cy,cz], radius: r, half } = o
  const px = x-cx, pz = z-cz
  const p = [m[0]*px+m[6]*pz, m[1]*px+m[7]*pz, m[2]*px+m[8]*pz]
  const d = [m[3], m[4], m[5]]
  let hit = null
  if (o.kind === 'box') {
    hit = intersect(intersect(slab(p[0],d[0],o.size[0]/2), slab(p[1],d[1],o.size[1]/2)), slab(p[2],d[2],o.size[2]/2))
  } else if (o.kind === 'sphere') {
    hit = quadratic(1, 2*(p[0]*d[0]+p[1]*d[1]+p[2]*d[2]), p[0]**2+p[1]**2+p[2]**2-r*r)
  } else {
    const cylinder = intersect(quadratic(d[0]**2+d[2]**2, 2*(p[0]*d[0]+p[2]*d[2]), p[0]**2+p[2]**2-r*r), slab(p[1],d[1],half))
    const hits = [cylinder]
    for (const y of [-half,half]) hits.push(quadratic(1,
      2*(p[0]*d[0]+(p[1]-y)*d[1]+p[2]*d[2]), p[0]**2+(p[1]-y)**2+p[2]**2-r*r))
    const intervals = hits.filter(Boolean)
    if (intervals.length) hit = [Math.min(...intervals.map(a=>a[0])), Math.max(...intervals.map(a=>a[1]))]
  }
  return hit && [hit[0]+cy, hit[1]+cy]
}

/** Valida todos los cuerpos antes de devolver buffers; el host realiza el commit atómico. */
export function displacementHeights(regions, objects = []) {
  if (!Array.isArray(objects) || objects.length > 64) throw new RangeError('Fluido: máximo 64 cuerpos desplazadores')
  const bodies = objects.map(prepare).filter(Boolean)
  const heights = new Map()
  for (const region of regions) {
    const out = new Float64Array(region.depth.length), area = region.dx*region.dz
    heights.set(region.id, out)
    for (const o of bodies) {
      const [x,,z] = o.center
      // Recortar contra TODOS los dominios intersectados, aunque el centro quede fuera.
      const c0 = Math.max(0, Math.floor((x-o.rx-region.x)/region.dx))
      const c1 = Math.min(region.width-1, Math.floor((x+o.rx-region.x)/region.dx))
      const r0 = Math.max(0, Math.floor((z-o.rz-region.z)/region.dz))
      const r1 = Math.min(region.height-1, Math.floor((z+o.rz-region.z)/region.dz))
      for (let j=r0; j<=r1; j++) for (let i=c0; i<=c1; i++) {
        const k = j*region.width+i
        if (!region.valid[k] || region.depth[k] <= 0) continue
        const x0 = Math.max(region.x+i*region.dx, x-o.rx), x1 = Math.min(region.x+(i+1)*region.dx, x+o.rx)
        const z0 = Math.max(region.z+j*region.dz, z-o.rz), z1 = Math.min(region.z+(j+1)*region.dz, z+o.rz)
        if (x1 <= x0 || z1 <= z0) continue
        // Nivel sin ocupación previa: un sólido inmóvil no bombea altura en cada sincronización.
        const bed = region.bed[k], surface = bed+region.depth[k]
        let thickness = 0
        for (const u of QUAD) for (const v of QUAD) {
          const interval = column(o, x0+u*(x1-x0), z0+v*(z1-z0))
          if (interval) thickness += Math.max(0, Math.min(surface,interval[1])-Math.max(bed,interval[0]))
        }
        out[k] = Math.min(100, region.depth[k], out[k]+thickness/16*(x1-x0)*(z1-z0)/area)
      }
    }
  }
  return heights
}
