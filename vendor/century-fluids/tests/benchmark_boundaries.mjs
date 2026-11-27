import { createWaterWorld, waterPhysicalConfig, waterSolverConfig, WaterHydrodynamics } from '../dist/fluids/water/index.js';
/** Non-gating boundary benchmark: simulated water in a closed six-plane tank. */
import {performance} from 'node:perf_hooks';
import {FluidWorld,FluidConfig,LiquidSolverConfig,Vec3} from '../dist/index.js';
const v=(x,y,z)=>Vec3.of(x,y,z), spacing=.11,side=6;
const world=new FluidWorld(FluidConfig.create({restDensityKgM3:1000,gravityMS2:v(0,-9.81,0),maxSubstepSeconds:1/120,maxSubsteps:32}));
world.setLiquidConfig(LiquidSolverConfig.create({...waterSolverConfig(),supportRadiusMeters:.3,particleContactRadiusMeters:.025}));
for(const [point,normal] of [[v(0,0,0),v(0,1,0)],[v(0,2.5,0),v(0,-1,0)],
 [v(-.15,0,0),v(1,0,0)],[v(.85,0,0),v(-1,0,0)],[v(0,0,-.15),v(0,0,1)],[v(0,0,.85),v(0,0,-1)]])
 world.addBoundary({kind:'plane',point,normal});
for(let x=0;x<side;x++)for(let y=0;y<side;y++)for(let z=0;z<side;z++)
 world.addParticle({position:v(x*spacing,.03+y*spacing,z*spacing),velocity:v(0,0,0),massKg:1000*spacing**3});
const before=world.totalMassKg,start=performance.now();
let contacts=0,maxPenetration=0,last;
for(let i=0;i<8;i++){
 last=world.step(1/120);contacts+=last.boundaryContacts;
 maxPenetration=Math.max(maxPenetration,last.maximumBoundaryPenetrationMeters);
}
const elapsedMs=performance.now()-start;
const result={label:'S04 boundaries non-gating benchmark',node:process.version,particles:world.particleCount,boundaries:world.boundaryCount,
 frames:8,dtSeconds:1/120,elapsedMs:Number(elapsedMs.toFixed(3)),totalContacts:contacts,
 maxPenetrationMeters:maxPenetration,initialMassKg:before,finalMassKg:world.totalMassKg,
 convergence:last.convergence,rssBytes:process.memoryUsage().rss};
console.log(JSON.stringify(result));
if(Math.abs(result.finalMassKg-before)>1e-9||maxPenetration>1e-6||contacts===0)
 throw Error('boundary benchmark physical oracle failure');
