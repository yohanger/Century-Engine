import { createWaterWorld, waterPhysicalConfig, waterSolverConfig, WaterHydrodynamics } from '../dist/fluids/water/index.js';
/** Non-gating CPU benchmark and mass/finite-value oracle; no rendering. */
import {performance} from 'node:perf_hooks';
import {FluidWorld,FluidConfig,LiquidSolverConfig,Vec3} from '../dist/index.js';
const spacing=.11,side=6;
const world=new FluidWorld(FluidConfig.create({restDensityKgM3:1000,gravityMS2:Vec3.of(0,-9.81,0),maxSubstepSeconds:1/120,maxSubsteps:32}));
world.setLiquidConfig(LiquidSolverConfig.create({...waterSolverConfig(),supportRadiusMeters:.3}));
for(let x=0;x<side;x++)for(let y=0;y<side;y++)for(let z=0;z<side;z++)world.addParticle({position:Vec3.of(x*spacing,1.5+y*spacing,z*spacing),velocity:Vec3.zero(),massKg:1000*spacing**3});
const massBefore=world.totalMassKg,start=performance.now();
let last;
for(let i=0;i<8;i++)last=world.step(1/120);
const duration=performance.now()-start,massAfter=world.totalMassKg;
const report={label:'S03 liquid solver non-gating benchmark',node:process.version,particles:world.particleCount,frames:8,dtSeconds:1/120,
  elapsedMs:Number(duration.toFixed(3)),massInitialKg:massBefore,massFinalKg:massAfter,
  maxFinalDensityCompression:last.maximumDensityCompressionRelative,convergence:last.convergence,
  rssBytes:process.memoryUsage().rss};
console.log(JSON.stringify(report));
if(Math.abs(massAfter-massBefore)>1e-9||!Number.isFinite(report.maxFinalDensityCompression))throw Error('numerical benchmark oracle failure');
