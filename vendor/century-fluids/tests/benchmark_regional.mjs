/** Non-gating A/B CPU on same frame. Zero gravity, no contacts: NOT FPS or water-under-gravity evidence. */
import {performance} from 'node:perf_hooks';
import {Vec3} from '../dist/index.js';
import {createWaterWorld} from '../dist/fluids/water/index.js';
import {simulateLiquid} from '../dist/liquid.js';
const inputs=[{position:Vec3.of(0,0,0),velocity:Vec3.of(.2,0,0),massKg:1.728}];
for(let x=0;x<20;x++)for(let z=0;z<20;z++)inputs.push({position:Vec3.of(10+x*.8,0,10+z*.8),velocity:Vec3.zero(),massKg:1.728});
const world=createWaterWorld({physical:{gravityMS2:Vec3.zero()}});world.emitParticles(inputs);world.step(1/120);
const ref=world.particleSnapshot(),start=performance.now();
for(let i=0;i<6;i++)simulateLiquid(ref,1/120,world.getConfig(),world.getLiquidConfig());
const fullMs=performance.now()-start,startRegional=performance.now();let stats;
for(let i=0;i<6;i++)stats=world.step(1/120).regional;
const regionalMs=performance.now()-startRegional,got=world.particleSnapshot();
for(let i=0;i<got.positionsXYZ.length;i++)if(Math.abs(got.positionsXYZ[i]-ref.positionsXYZ[i])>1e-8)throw Error(`SPH parity mismatch ${i}`);
if(stats.mode!=='partial'||stats.restingParticles!==400||Math.abs(world.totalMassKg-inputs.length*1.728)>1e-8)throw Error('benchmark invalid');
console.log(JSON.stringify({label:'S09 CONT002 regional CPU A/B non-gating',particles:inputs.length,
 activeParticles:stats.activeParticles,restingParticles:stats.restingParticles,totalChunks:stats.totalChunks,
 fullMs:+fullMs.toFixed(3),regionalMs:+regionalMs.toFixed(3),speedup:+(fullMs/regionalMs).toFixed(2),
 totalMassKg:world.totalMassKg,rssBytes:process.memoryUsage().rss}));
console.log('S09_REGIONAL_AB_PASS gravity=zero contacts=none browser=NOT_VERIFIED');world.shutdown();
