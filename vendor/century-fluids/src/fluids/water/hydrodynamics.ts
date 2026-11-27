/** Local water-only hydrostatic approximation. Not a generic liquid/Jolt responsibility. */
import { FluidError } from '../../error.js';
import { Vec3 } from '../../math.js';
import { rotated } from '../../rotation.js';
import type { FluidWorld } from '../../world.js';
import type { HydrodynamicPolicy, HydroResult, HydroSample } from '../../coupling/hydrodynamics.js';
const add=(a:Vec3,b:Vec3):Vec3=>Vec3.of(a.x+b.x,a.y+b.y,a.z+b.z);
const minus=(a:Vec3,b:Vec3):Vec3=>Vec3.of(a.x-b.x,a.y-b.y,a.z-b.z);
const scale=(a:Vec3,s:number):Vec3=>Vec3.of(a.x*s,a.y*s,a.z*s);
const mag=(v:Vec3):number=>Math.hypot(v.x,v.y,v.z);
const empty=():HydroResult=>({impulse:Vec3.zero(),torque:Vec3.zero(),fraction:0,particleIds:[],fluidImpulses:[]});

export class WaterHydrodynamics implements HydrodynamicPolicy {
  evaluate(world:FluidWorld,sample:HydroSample,dt:number):HydroResult {
    const buoyancy=sample.buoyancyScale,drag=sample.linearDragKgPerSecond;
    if(buoyancy===0&&drag===0)return empty();
    const config=world.getConfig();const g=config.gravityMS2;
    if(buoyancy!==0&&(g.y>=0||Math.abs(g.x)>1e-8||Math.abs(g.z)>1e-8))
      throw new FluidError('INVALID_ARGUMENT','water hydrostatic estimator requires Y-up with downward gravity','gravityMS2');
    const shape=sample.shape,r=shape.kind==='sphere'?shape.radiusMeters:mag(shape.halfExtents);
    const searchRadius=2*r+world.getLiquidConfig().supportRadiusMeters;
    const neighbors=world.neighborsWithin(sample.position,searchRadius);
    if(neighbors.length===0)return empty();
    const local=neighbors.map(id=>world.getParticle(id));
    let waterLevel=-Infinity;
    for(const particle of local)waterLevel=Math.max(waterLevel,particle.position.y);
    waterLevel+=world.getLiquidConfig().particleContactRadiusMeters;
    if(!Number.isFinite(waterLevel))return empty();
    // Integrate volume occupancy against observed local free surface; no virtual infinite plane.
    let total=0,submerged=0;
    for(let i=0;i<8;i++)for(let j=0;j<8;j++)for(let k=0;k<8;k++){
      const unit=Vec3.of((i+.5)/4-1,(j+.5)/4-1,(k+.5)/4-1);
      if(shape.kind==='sphere'&&mag(unit)>1)continue;
      total++;
      const localPos=shape.kind==='sphere'?scale(unit,shape.radiusMeters):Vec3.of(unit.x*shape.halfExtents.x,unit.y*shape.halfExtents.y,unit.z*shape.halfExtents.z);
      const pos=add(sample.position,shape.kind==='box'?rotated(localPos,sample.rotation):localPos);
      if(pos.y<=waterLevel)submerged++;
    }
    const fraction=total?submerged/total:0;
    const volume=shape.kind==='sphere'?(4*Math.PI/3)*shape.radiusMeters**3:8*shape.halfExtents.x*shape.halfExtents.y*shape.halfExtents.z;
    const observedMassKg=local.reduce((acc,p)=>acc+p.massKg,0);
    const displacedMassKg=Math.min(config.restDensityKgM3*volume*fraction,observedMassKg);
    const buoyant=scale(g,-displacedMassKg*dt*buoyancy);
    const fluidVel=scale(local.reduce((acc,p)=>add(acc,p.velocity),Vec3.zero()),1/local.length);
    const dragImpulse=scale(minus(fluidVel,sample.velocity),drag*dt);
    const impulse=add(buoyant,dragImpulse);
    const opposite=scale(impulse,-1/local.length);
    // No unsupported hydrostatic torque; physical angular reactions come from contact impulses.
    return {impulse,torque:Vec3.zero(),fraction,particleIds:neighbors,
      fluidImpulses:mag(impulse)<=1e-14?[]:local.map(p=>({id:p.id,impulseNs:opposite}))};
  }
}
