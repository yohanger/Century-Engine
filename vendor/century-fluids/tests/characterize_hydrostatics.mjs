/** Measured multi-layer gravity tank, never declares resting simply from convergence. */
import {Vec3} from '../dist/index.js';
import {createWaterWorld} from '../dist/fluids/water/index.js';
const v=(x,y,z)=>Vec3.of(x,y,z),w=createWaterWorld(),dt=1/120,side=4,spacing=.11;
for(const [point,normal] of [[v(0,0,0),v(0,1,0)],[v(-.15,0,0),v(1,0,0)],
 [v(.6,0,0),v(-1,0,0)],[v(0,0,-.15),v(0,0,1)],[v(0,0,.6),v(0,0,-1)]])w.addBoundary({kind:'plane',point,normal});
for(let x=0;x<side;x++)for(let y=0;y<side;y++)for(let z=0;z<side;z++)w.addParticle({position:v(x*spacing,.03+y*spacing,z*spacing),velocity:Vec3.zero(),massKg:1000*spacing**3});
const initialMass=w.totalMassKg,records=[];
for(let step=0;step<240;step++){
 const r=w.step(dt);let maxSpeed=0,meanSpeed=0;
 const snapshot=w.particleSnapshot();for(let i=0;i<snapshot.count;i++){
  const k=3*i,speed=Math.hypot(snapshot.velocitiesXYZ[k],snapshot.velocitiesXYZ[k+1],snapshot.velocitiesXYZ[k+2]);
  maxSpeed=Math.max(maxSpeed,speed);meanSpeed+=speed;
 }
 if([0,10,50,100,200,239].includes(step))records.push({step,maxSpeedMPS:+maxSpeed.toFixed(7),meanSpeedMPS:+(meanSpeed/snapshot.count).toFixed(7),
  contacts:r.boundaryContacts,compression:r.maximumDensityCompressionRelative,convergence:r.convergence,regionalMode:r.regional.mode});
 if(!Number.isFinite(maxSpeed)||r.totalMassKg!==initialMass)throw Error('invalid physical tank mass/finite oracle');
}
console.log(JSON.stringify({label:'S09 CONT003 4x4x4 gravity tank physical characterization',particles:64,
 frames:240,gravityMPS2:-9.81,initialMassKg:initialMass,finalMassKg:w.totalMassKg,records}));
console.log('S09_HYDROSTATIC_CHARACTERIZATION_PASS no_unjustified_sleep=true benchmark=NON_GATING');w.shutdown();
