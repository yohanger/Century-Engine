/** Non-gating CPU A/B. Supported isolated samples are NOT a realistic water tank. */
import {performance} from 'node:perf_hooks';
import {Vec3} from '../dist/index.js';
import {createWaterWorld} from '../dist/fluids/water/index.js';
import {simulateLiquid} from '../dist/liquid.js';
const v=(x,y,z)=>Vec3.of(x,y,z),dt=1/120,frames=100;
const w=createWaterWorld();w.addBoundary({kind:'plane',point:v(0,0,0),normal:v(0,1,0)});
for(let x=0;x<8;x++)for(let z=0;z<8;z++)w.addParticle({position:v(x*.5,.03,z*.5),velocity:Vec3.zero(),massKg:1.728});
w.step(dt);w.step(dt);const initial=w.particleSnapshot(),full={...initial,positionsXYZ:new Float64Array(initial.positionsXYZ),velocitiesXYZ:new Float64Array(initial.velocitiesXYZ)};
const start=performance.now();for(let f=0;f<frames;f++)simulateLiquid(full,dt,w.getConfig(),w.getLiquidConfig(),w.boundarySnapshot());const fullMs=performance.now()-start;
const restStart=performance.now();let last;for(let f=0;f<frames;f++){last=w.step(dt);if(last.regional.mode!=='rest')throw Error('hydrostatic fixed point was not retained');}
const cachedMs=performance.now()-restStart,got=w.particleSnapshot();
for(const key of ['positionsXYZ','velocitiesXYZ','massesKg'])for(let i=0;i<got[key].length;i++)if(!Object.is(got[key][i],full[key][i]))throw Error(`hydrostatic A/B state mismatch ${key}[${i}]`);
const r={label:'S09 CONT003 supported fixed-point CPU A/B NON-GATING',particles:got.count,frames,restingChunks:last.regional.restingChunks,
 fullMs:+fullMs.toFixed(3),certifiedRestMs:+cachedMs.toFixed(3),speedup:+(fullMs/cachedMs).toFixed(2),
 contactImpulseY:last.boundaryReactions[0].impulseOnBoundaryNs.y,massKg:w.totalMassKg,rssBytes:process.memoryUsage().rss,
 applicability:'exact fixed-point, static floor, isolated samples; NOT moving hydrostatic water or Jolt-hosted dynamic bodies'};
console.log(JSON.stringify(r));console.log('S09_HYDROSTATIC_AB_PASS scenario=STATIC_FIXED_POINT gravitational_multilayer=NOT_CERTIFIED browser=NOT_VERIFIED');w.shutdown();
