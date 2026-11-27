import test from 'node:test';
import assert from 'node:assert/strict';
import {SCENARIOS,makeScenario} from '../playground/src/scenarios.mjs';
import {advanceClock} from '../playground/src/clock.mjs';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const file=rel=>readFileSync(new URL(rel,root),'utf8');
test('S09 playground refers to fluid specialization; water is initial scene, no fictitious types',()=>{
 const src=file('playground/src/fluids.mjs');
 assert.match(src,/FLUID_TYPES/);assert.match(src,/id:'water'/);
 assert.match(src, /@century\/fluids\/water/);
 assert.doesNotMatch(file('playground/src/scenarios.mjs'),/from ['"](?:jolt|three)/);
 assert.deepEqual(SCENARIOS.map(x=>x.id),['tank','dam','obstacle','float','shore','cup']);
});
test('S09 deterministic scenarios use real nonzero particle mass and constrain physical boundaries',()=>{
 for(const scene of SCENARIOS){
  const a=makeScenario(scene.id),b=makeScenario(scene.id);
  assert.deepEqual(a,b);
  if(scene.id==='shore'){
   assert.equal(a.particles.length,320);
   assert.deepEqual(a.boundaries.map(boundary=>boundary.kind),['heightfield','plane','plane','plane','plane']);
   assert.equal(a.boundaries[0],a.terrain);
   assert.ok(a.wave.strokeMeters>0);
  }else{
   assert.ok(a.particles.length>=64&&a.particles.length<=(scene.id==='cup'?200:100));
   assert.equal(a.boundaries.filter(x=>x.kind==='plane').length,5);
  }
  assert.ok(a.particles.every(p=>p.massKg>0&&Number.isFinite(p.position.x)));
 }
 assert.ok(makeScenario('obstacle').boundaries.some(x=>x.kind==='sphere'));
 assert.ok(makeScenario('float').floatSphere);
 assert.equal(makeScenario('cup').cup.boxes.length,5);
 assert.equal(makeScenario('tank').floatSphere,null);
 assert.throws(()=>makeScenario('lava'),/Escenario desconocido/);
});
test('S09 fixed step has one callback per step, respects budget, deterministic remainder',()=>{
 let calls=0,dtTotal=0;
 const out=advanceClock({elapsedSeconds:1/30,advance:dt=>{calls++;dtTotal+=dt;}});
 assert.equal(out.performed,4);assert.equal(calls,4);
 assert.ok(Math.abs(dtTotal-1/30)<1e-10);
 assert.equal(out.dropped,0);
 assert.ok(out.accumulatorSeconds<1e-10);
});
test('S09 overload drops excess host time without entering a second uncontrolled loop',()=>{
 let calls=0;
 const out=advanceClock({elapsedSeconds:.25,maxSteps:3,advance:()=>{calls++}});
 assert.equal(calls,3);assert.equal(out.performed,3);assert.ok(out.dropped>=20);
 assert.equal(out.accumulatorSeconds,0);
});
test('S09 frame invalid inputs rejected; callback is required',()=>{
 for(const options of [{elapsedSeconds:-1},{elapsedSeconds:1,rate:0},{elapsedSeconds:NaN},{elapsedSeconds:1,stepSeconds:0},{elapsedSeconds:1,maxSteps:0}])
  assert.throws(()=>advanceClock({...options,advance:()=>{}}),/Invalid/);
 assert.throws(()=>advanceClock({elapsedSeconds:1}),/Invalid/);
});
test('S09 browser host owns one Jolt.Step and the Three renderer never touches physics',()=>{
 const sim=file('playground/src/simulation.mjs');
 const jolt=file('playground/src/jolt-runtime.mjs');
 const renderer=file('playground/src/renderer.mjs');
 assert.match(sim,/this\.#jolt\.step\(dt\)/);
 assert.match(sim,/this\.#bridge\.step\(dt\)/);
 assert.match(sim,/this\.#bridge\.shutdown\(\)/);
 assert.match(jolt,/import\('jolt-physics'\)/);
 assert.match(jolt,/J\.destroy\(jolt\)/);
 assert.match(jolt,/body\.shape\.Release\(\)/);
 assert.doesNotMatch(renderer.replace(/\/\*[\s\S]*?\*\//g,''),/(FluidWorld|JoltFluidBridge|\.step\(dt\))/);
});
test('S09 browser dependency boundary isolated and pinned, core stays Jolt/Three free',()=>{
 const core=JSON.parse(file('package.json'));
 const p=JSON.parse(file('playground/package.json'));
 assert.ok(!core.dependencies);
 assert.equal(p.dependencies['@century/fluids'],'file:./.local/century-fluids-0.1.0.tgz');
 assert.equal(p.dependencies['jolt-physics'],'1.1.0');
 assert.equal(p.dependencies.three,'0.186.0');
 assert.equal(p.devDependencies.vite,'8.3.8');
 assert.match(file('playground/src/main.mjs'),/S09_BROWSER_READY/);
});

