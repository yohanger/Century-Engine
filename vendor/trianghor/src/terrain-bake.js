// Hornear Mapa: planificación geométrica pura para los clústeres nativos de Terrain.
// No altera el heightmap, el splat ni las colisiones. Evalúa el error en TODOS los vértices
// originales antes de aceptar un índice de dibujo. Los bordes se conservan a resolución fuente.
import { terrainIndex, terrainStrides } from './lod.js'
import { adaptiveTerrainIndex } from './terrain-adaptive.js'

export const TERRAIN_BAKE_DEFAULTS = Object.freeze({ heightError: 0.08, paintError: 0.06 })
const clamp = (x,a,b) => Math.max(a,Math.min(b,x))

export function normalizeTerrainBake(v) {
  if (!v || typeof v !== 'object') return null
  return { heightError: clamp(Number.isFinite(+v.heightError) ? +v.heightError : TERRAIN_BAKE_DEFAULTS.heightError, 0, 10),
    paintError: clamp(Number.isFinite(+v.paintError) ? +v.paintError : TERRAIN_BAKE_DEFAULTS.paintError, 0, 1) }
}

// Evalúa la superficie que realmente producirá terrainIndex, incluso los abanicos
// cosidos de las fronteras. No confunde interpolación de quads con topología GPU.
export function terrainBakeError(heights, splat, nx, nz, stride, channels = 8) {
  if (!Number.isInteger(nx) || !Number.isInteger(nz) || nx < 2 || nz < 2 ||
      !Number.isInteger(stride) || nx % stride || nz % stride ||
      heights.length !== (nx+1)*(nz+1) || (splat && splat.length !== heights.length*channels))
    throw new RangeError('Dimensiones de Terrain o stride incompatibles')
  if (stride === 1) return { height: 0, paint: 0 }
  const index = terrainIndex(nx, stride, nz)
  const width = nx + 1
  let height = 0, paint = 0
  for (let t=0; t<index.length; t+=3) {
    const ia=index[t], ib=index[t+1], ic=index[t+2]
    const ax=ia%width, az=Math.floor(ia/width), bx=ib%width, bz=Math.floor(ib/width)
    const cx=ic%width, cz=Math.floor(ic/width)
    const denom=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz)
    if (!denom) throw new Error('Terrain horneado tiene un triángulo degenerado')
    const ix0=Math.min(ax,bx,cx), ix1=Math.max(ax,bx,cx)
    const iz0=Math.min(az,bz,cz), iz1=Math.max(az,bz,cz)
    for (let z=iz0;z<=iz1;z++) for (let x=ix0;x<=ix1;x++) {
      const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/denom
      const v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/denom
      const w=1-u-v
      if (u<-1e-7 || v<-1e-7 || w<-1e-7) continue
      const src=z*width+x
      height=Math.max(height,Math.abs(heights[src]-(heights[ia]*u+heights[ib]*v+heights[ic]*w)))
      if (splat) for (let k=0;k<channels;k++) {
        const expected=splat[(src)*channels+k]
        const interpolated=splat[ia*channels+k]*u+splat[ib*channels+k]*v+splat[ic*channels+k]*w
        paint=Math.max(paint,Math.abs(expected-interpolated)/255)
      }
    }
  }
  return { height, paint }
}

export function terrainBakePlan(heights, splat, nx, nz, settings, channels=8, reuse=null) {
  const cfg=normalizeTerrainBake(settings)
  if (!cfg) return null
  // El algoritmo anterior exigía un stride uniforme para toda la pieza; un
  // relieve aislado impedía reducir incluso regiones planas independientes.
  // El plan adaptativo conserva los bordes originales y valida el índice FINAL.
  const adaptive = adaptiveTerrainIndex(heights,splat,nx,nz,cfg.heightError,cfg.paintError,channels,reuse)
  const sourceTriangles=2*nx*nz
  return adaptive
    ? { ...adaptive, stride:1, adaptive:true, heightError:cfg.heightError, paintError:cfg.paintError }
    : { stride:1, adaptive:false, index:null, triangles:sourceTriangles,
      sourceTriangles, height:0, paint:0, heightError:cfg.heightError,
      paintError:cfg.paintError, reduction:0, reason:'La tolerancia no permite reducir la topología de esta pieza' }
}
