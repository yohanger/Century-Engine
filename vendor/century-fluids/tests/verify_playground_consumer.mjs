/** Installed-package scenario smoke test with REAL library from npm pack; no renderer/Jolt stubs. */
import {mkdtemp,mkdir,readFile,writeFile,copyFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const npm=process.platform==='win32'?'npm.cmd':'npm';
function run(cmd,args,cwd){
 const p=spawnSync(cmd,args,{cwd,encoding:'utf8',timeout:120000,env:{...process.env,npm_config_audit:'false',npm_config_fund:'false'}});
 if(p.error||p.status!==0)throw Error(`Consumer failed: ${cmd} ${args.join(' ')}\n${p.stdout||''}\n${p.stderr||''}`);
 return p.stdout.trim();
}
const tmp=await mkdtemp(join(tmpdir(),'century-s09-'));
try{
 const consumer=join(tmp,'consumer');await mkdir(consumer);
 await writeFile(join(consumer,'package.json'),JSON.stringify({name:'century-s09-consumer',private:true,type:'module'}));
 const pkg=JSON.parse(run(npm,['pack','--json','--pack-destination',tmp],root))[0];
 run(npm,['install','--offline','--ignore-scripts','--no-save','--package-lock=false','--no-audit','--no-fund',join(tmp,pkg.filename)],consumer);
 for(const file of ['fluids.mjs','scenarios.mjs','simulation.mjs','cup.mjs','shore.mjs'])await copyFile(join(root,'playground','src',file),join(consumer,file));
 await writeFile(join(consumer,'probe.mjs'),`
 import assert from 'node:assert/strict';
 import {makeScenario} from './scenarios.mjs';
 import {SimulationSession} from './simulation.mjs';
 import {FLUID_TYPES} from './fluids.mjs';
 assert.equal(FLUID_TYPES.length,1);assert.equal(FLUID_TYPES[0].id,'water');
 for(const id of ['tank','dam','obstacle']){
   const session=new SimulationSession({fluidId:'water',scenarioId:id});
   const init=session.world.totalMassKg;
   let report;
   for(let step=0;step<12;step++)report=session.step(1/120);
   const mesh=session.extract({cellSizeMeters:.08,maxGridPoints:60000,maxTriangles:100000});
   assert.ok(mesh.triangleCount>0,id+' missing surface');
   assert.ok(Math.abs(session.world.totalMassKg-init)<1e-8,id+' lost mass');
   assert.ok(Number.isFinite(report.totalMassKg));
   console.log('S09_CONSUMER_SCENE_PASS',id,mesh.triangleCount,report.convergence);
   session.shutdown();assert.throws(()=>session.step(1/120),/cerrada/);
 }
 const control=new SimulationSession({scenarioId:'tank'});
 const disturbed=new SimulationSession({scenarioId:'tank'});
 try{
   for(let i=0;i<144;i++){control.step();disturbed.step();}
   const before=disturbed.snapshot();
   let top=1;
   for(let i=4;i<before.positionsXYZ.length;i+=3)
     if(before.positionsXYZ[i]>before.positionsXYZ[top])top=i;
   disturbed.queueSurfaceDisturbance({x:before.positionsXYZ[top-1],y:before.positionsXYZ[top]+.035,z:before.positionsXYZ[top+1]});
   assert.deepEqual(before,disturbed.snapshot(),'input is deferred to the existing physics step');
   assert.equal(disturbed.simulatedSeconds,control.simulatedSeconds);
   const reference=control.step(), disturbedStep=disturbed.step();
   assert.equal(reference.totalMassKg,disturbedStep.totalMassKg);
   const verticalMomentum=frame=>frame.massesKg.reduce((sum,mass,i)=>sum+mass*frame.velocitiesXYZ[3*i+1],0);
   const boundaryImpulse=report=>report.boundaryReactions.reduce((sum,entry)=>sum+entry.impulseOnBoundaryNs.y,0);
   const delivered=verticalMomentum(disturbed.snapshot())-verticalMomentum(control.snapshot())+
     boundaryImpulse(disturbedStep)-boundaryImpulse(reference);
   assert.ok(delivered<0&&delivered>=-.8*disturbedStep.totalMassKg);
   assert.notDeepEqual(control.snapshot().positionsXYZ,disturbed.snapshot().positionsXYZ);
   assert.equal(control.simulatedSeconds,disturbed.simulatedSeconds);
   for(let i=0;i<90;i++)assert.ok(disturbed.step().maximumBoundaryPenetrationMeters<=1e-6);
   console.log('S09_WATER_PULSE_PASS mass='+disturbed.world.totalMassKg);
 }finally{control.shutdown();disturbed.shutdown();}
 for(const scenarioId of ['float','cup'])assert.throws(()=>new SimulationSession({fluidId:'water',scenarioId}),/Jolt WASM real/);
 console.log('S09_CONSUMER_SCENES_PASS fluids=1 scenarios=3 noJoltFake=true');
 `);
 const result=run(process.execPath,['probe.mjs'],consumer);
 if(!result.includes('S09_CONSUMER_SCENES_PASS'))throw Error('Missing scene report');
 console.log(result);
}finally{await rm(tmp,{recursive:true,force:true})}
