// WaterWorld owns each parcel from rim exit through reception or explicit domain exit.
import { containerLocalPoint, containerRadiusFactor } from './container-shape.js'

function deposit(world,p,region,col,row,volume=p.volumeM3) {
  region.queue(col,row,volume)
  world.containerDelivered.set(p.liquidId,(world.containerDelivered.get(p.liquidId)||0)+volume)
}
function spillRegion(world,p,level) {
  const existing=[...world.regions.values()].find(r=>r.contains(p.position[0],p.position[2]))
  if(existing)return existing
  if(!world.fluidGroundAt || world.regions.size>=32 || [...world.regions.values()].reduce((n,r)=>n+r.width*r.height,0)+36>4096)return null
  const size=0.035,width=6,span=size*width,x=Math.floor(p.position[0]/span)*span,z=Math.floor(p.position[2]/span)*span
  if([...world.regions.values()].some(r=>x<r.x+r.width*r.dx && r.x<x+span && z<r.z+r.height*r.dz && r.z<z+span))return null
  const bed=[],valid=[]
  for(let j=0;j<width;j++)for(let i=0;i<width;i++){const y=world.fluidGroundAt(x+(i+0.5)*size,z+(j+0.5)*size,level+0.03);bed.push(Number.isFinite(y)?y:0);valid.push(Number.isFinite(y)?1:0)}
  if(!valid.some(Boolean))return null
  const liquid=[...world.containers.values()].find(c=>c.liquid.id===p.liquidId)?.liquid
  const config={id:`spill:${p.liquidId}:${Math.round(x/span)}:${Math.round(z/span)}`,name:'Derrame',x,z,width,height:width,cellSize:size,bed,valid,liquid,color:liquid?.color}
  const r=world.addRegion(config);r._spillConfig=config
  return r
}
export function advanceParticleContainers(world,dt) {
  for(const c of world.containers.values())if(c.fluid){
    c.fluid.setSpec(c)
    if(Math.abs(c.fluid.volume()-c.volumeM3)>1e-12)c.fluid.setVolume(c.volumeM3)
    for(const p of c.fluid.step(dt,c.pose))world.containerParcels.push({...p,liquidId:c.liquid.id,origin:c.id,age:0})
    c.volumeM3=c.fluid.volume()
  }
  const keep=[]
  for(const p of world.containerParcels){
    const previous=[...p.position]
    p.velocity[1]-=9.81*dt
    for(let a=0;a<3;a++)p.position[a]+=p.velocity[a]*dt
    p.age+=dt
    let remaining=p.volumeM3
    for(const c of world.containers.values()){
      if(c.closed||c.liquid.id!==p.liquidId||c.capacityM3-c.volumeM3<1e-14)continue
      if(c.id===p.origin&&p.age<0.06)continue
      const before=containerLocalPoint(previous,c.pose),now=containerLocalPoint(p.position,c.pose),top=c.size[1]/2
      if(before[1]<top||now[1]>top||now[1]<-c.size[1]/2)continue
      const t=(top-before[1])/(now[1]-before[1]||1),x=before[0]+t*(now[0]-before[0]),z=before[2]+t*(now[2]-before[2])
      const f=containerRadiusFactor(c,top)
      if(c.shape==='box' ? Math.abs(x)>c.size[0]/2 || Math.abs(z)>c.size[2]/2 : (x/(c.size[0]/2*f))**2+(z/(c.size[2]/2*f))**2>1)continue
      const take=Math.min(remaining,c.capacityM3-c.volumeM3)
      c.volumeM3+=take;c.fluid?.receive(take,p.position,p.velocity);remaining-=take
      if(remaining<=1e-14)break
    }
    if(remaining<=1e-14)continue
    p.volumeM3=remaining
    let region=[...world.regions.values()].find(r=>r.contains(p.position[0],p.position[2]))
    let col=region?Math.floor((p.position[0]-region.x)/region.dx):-1,row=region?Math.floor((p.position[2]-region.z)/region.dz):-1
    let k=region?row*region.width+col:-1
    const floor=world.fluidGroundAt?.(p.position[0],p.position[2],previous[1]+0.03)
    const openWater=world.at(p.position[0],p.position[2])
    const target=Math.max(region&&region.valid[k]?region.effectiveBed[k]+region.depth[k]:-Infinity,Number.isFinite(floor)?floor:-Infinity,openWater?.surface??-Infinity)
    if(p.position[1]<=target+0.003 && previous[1]>=target-0.05){
      if(!region && openWater){world.containerExternalOut.set(p.liquidId,(world.containerExternalOut.get(p.liquidId)||0)+remaining);world.fluidOnImpact?.(p);continue}
      if(!region){region=spillRegion(world,p,target);col=region?Math.floor((p.position[0]-region.x)/region.dx):-1;row=region?Math.floor((p.position[2]-region.z)/region.dz):-1;k=region?row*region.width+col:-1}
      // A raised table can overlap an authored terrain domain. Its liquid must
      // remain on the supporting solid, never teleport into the terrain below.
      if((region && Number.isFinite(floor) && floor>region.effectiveBed[k]+0.04 && floor>=target-0.01) || !region){
        p.position[1]=target+0.003;p.velocity[0]*=0.7;p.velocity[1]=0;p.velocity[2]*=0.7;p.age=Math.min(p.age,0.1);keep.push(p);continue
      }
      if(region?.valid[k] && region.liquid.id===p.liquidId){deposit(world,p,region,col,row);world.fluidOnImpact?.(p)}
      else world.containerExternalOut.set(p.liquidId,(world.containerExternalOut.get(p.liquidId)||0)+remaining)
      continue
    }
    // Colliders may receive a parcel before Terrain. The ray is swept, not a point test.
    const hit=world.fluidImpact?.(previous,p.position,p.origin)
    if(hit?.point){
      p.position=[...hit.point]
      const n=hit.normal||[0,1,0],dot=p.velocity.reduce((a,v,i)=>a+v*n[i],0)
      if(dot<0)for(let i=0;i<3;i++)p.velocity[i]=(p.velocity[i]-dot*n[i])*0.7
      for(let i=0;i<3;i++)p.position[i]+=n[i]*0.002
    }
    if(p.age>=8||p.position[1]<-150){world.containerExternalOut.set(p.liquidId,(world.containerExternalOut.get(p.liquidId)||0)+remaining);continue}
    keep.push(p)
  }
  world.containerParcels=keep
}
export function validateContainerParcels(world,parcels) {
  if(!Array.isArray(parcels)||parcels.length>16384)throw new Error('Recipiente: derrame del snapshot inválido')
  for(const p of parcels)if(!world.containers.has(p.origin)||world.containers.get(p.origin)?.liquid.id!==p.liquidId||!Number.isFinite(p.volumeM3)||p.volumeM3<=0||!Number.isFinite(p.age)||p.age<0||!Array.isArray(p.position)||p.position.length!==3||!Array.isArray(p.velocity)||p.velocity.length!==3||[...p.position,...p.velocity].some(v=>!Number.isFinite(v)))throw new Error('Recipiente: partícula libre inválida')
  return structuredClone(parcels)
}
