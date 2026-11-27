// Compatibilidad con proyectos y consumidores existentes.
import { normalizeLiquid, WATER_LIQUID } from '../fluids/liquid.js'
import { containerCapacity, insideContainer } from '../fluids/container-shape.js'
export { normalizeLiquid, WATER_LIQUID } from '../fluids/liquid.js'

const finite = (v, min, max, name) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new RangeError(`Líquido: ${name} inválido`)
  return v
}

export function containerSpec(config) {
  if (!config || typeof config !== 'object') throw new Error('Recipiente: configuración necesaria')
  const id = config.id
  if (typeof id !== 'string' || !id.trim() || id.length > 128) throw new Error('Recipiente: ID inválido')
  const shape = config.shape ?? 'cylinder'
  if (!['cylinder', 'box'].includes(shape)) throw new Error('Recipiente: forma no soportada')
  const [width,height,depth] = config.size || []
  for (const v of [width,height,depth]) finite(v, 0.001, 10, 'dimensión interior')
  const vessel = config.vessel ?? (shape === 'box' ? 'tank' : 'cup')
  if (!['cup','bottle','tank'].includes(vessel)) throw new RangeError('Recipiente: perfil inválido')
  const mouthRadius = finite(config.mouthRadius ?? Math.min(width,depth)/2*(vessel==='bottle'?0.38:1),0.0001,Math.min(width,depth)/2,'radio de abertura')
  const neckHeight = finite(config.neckHeight ?? height*0.18,0,height*0.45,'cuello')
  const simulation = config.simulation ?? 'analytic'
  if (!['analytic','particles'].includes(simulation)) throw new RangeError('Recipiente: simulación inválida')
  const quality = config.quality ?? 'balanced'
  if (!['low','balanced','high'].includes(quality)) throw new RangeError('Recipiente: calidad inválida')
  const closed = config.closed === true
  const capacityM3 = containerCapacity(shape,[width,height,depth],vessel,mouthRadius,neckHeight)
  const initialM3 = finite(config.initialM3 ?? 0, 0, capacityM3, 'volumen inicial')
  const liquid = normalizeLiquid(config.liquid || WATER_LIQUID)
  const pourRate = finite(config.pourRate ?? 0.5, 0, 5, 'coeficiente de vertido')
  return { id, shape, vessel, mouthRadius, neckHeight, closed, simulation, quality, size: [width,height,depth], capacityM3, initialM3, liquid, pourRate }
}

// Superficie libre horizontal respecto a la gravedad. Cuadratura determinista 8×8×8:
// se evita una simulación SPH y no se altera el balance con el nivel visual.
const SAMPLES = 8
export function freeSurface(state, pose) {
  if (!state || !pose || !Array.isArray(pose.position) || pose.position.length !== 3 ||
      !Array.isArray(pose.quaternion) || pose.quaternion.length !== 4 ||
      [...pose.position, ...pose.quaternion].some((x) => !Number.isFinite(x))) throw new Error('Recipiente: pose inválida')
  const [cx,cy,cz] = pose.position, [qx,qy,qz,qw] = pose.quaternion
  const norm = Math.hypot(qx,qy,qz,qw)
  if (norm < 1e-8) throw new Error('Recipiente: rotación inválida')
  const x=qx/norm,y=qy/norm,z=qz/norm,w=qw/norm
  const upY=1-2*(x*x+z*z), axisX=2*(x*y+z*w),axisZ=2*(y*z-x*w)
  const [sx,sy,sz] = state.size
  const heights=[]
  for (let k=0;k<SAMPLES;k++) for(let j=0;j<SAMPLES;j++) for(let i=0;i<SAMPLES;i++) {
    const xx=((i+0.5)/SAMPLES-0.5)*sx, yy=((k+0.5)/SAMPLES-0.5)*sy, zz=((j+0.5)/SAMPLES-0.5)*sz
    if (!insideContainer(state,xx,yy,zz)) continue
    // Segunda fila de la matriz de rotación; gravedad mundial -Y.
    heights.push(cy + 2*(x*y+z*w)*xx + upY*yy + 2*(y*z-x*w)*zz)
  }
  heights.sort((a,b)=>a-b)
  const fraction = Math.max(0,Math.min(1,state.volumeM3/state.capacityM3))
  const index = Math.min(heights.length-1,Math.max(0,Math.floor(fraction*(heights.length-1))))
  const levelY = fraction===0 ? heights[0]-0.01 : fraction===1 ? heights.at(-1)+0.01 : heights[index]
  // El borde más bajo define el inicio del derrame. Forma abierta; no representa una botella sellada.
  const radial = state.shape==='box' ? (Math.abs(2*(x*y+z*w))*sx/2+Math.abs(2*(y*z-x*w))*sz/2)
    : Math.hypot(2*(x*y+z*w)*sx/2, 2*(y*z-x*w)*sz/2)
  const rimY=cy + upY*sy/2-radial*(state.vessel==='bottle' ? state.mouthRadius/Math.min(sx,sz)*2 : 1)
  const horizontalX=axisX, horizontalZ=axisZ
  const radialNorm=Math.hypot(horizontalX,horizontalZ)||1
  const edgeX = cx - horizontalX/radialNorm*sx/2
  const edgeZ = cz - horizontalZ/radialNorm*sz/2
  return { levelY, rimY, headM: Math.max(0,levelY-rimY), edge:[edgeX,rimY,edgeZ], fill:fraction }
}

export function containerOutflow(state, dt, pose) {
  if (!Number.isFinite(dt) || dt<=0) throw new RangeError('Recipiente: paso inválido')
  const surface=freeSurface(state,pose)
  if (state.closed || !state.volumeM3 || surface.headM<=0) return { surface, volumeM3:0 }
  const [sx,,sz]=state.size
  const aperture= Math.min(sx,sz)**2 * 0.12
  const rate=state.pourRate*aperture*Math.sqrt(2*9.81*surface.headM)/Math.sqrt(state.liquid.viscosity)
  return { surface, volumeM3:Math.min(state.volumeM3,rate*dt) }
}
