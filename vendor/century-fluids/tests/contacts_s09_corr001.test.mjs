import test from 'node:test';
import assert from 'node:assert/strict';
import { createWaterWorld } from '../dist/fluids/water/index.js';
import { Vec3, FluidError } from '../dist/index.js';
import { makeScenario } from '../playground/src/scenarios.mjs';

const v = p => Vec3.of(p.x,p.y,p.z);
const dt = 1/120;
function sceneWorld(spec) {
  const world = createWaterWorld();
  world.emitParticles(spec.particles.map(p => ({position:v(p.position),velocity:v(p.velocity),massKg:p.massKg})));
  for (const b of spec.boundaries) {
    const input = {...b};
    if(b.point)input.point=v(b.point);
    if(b.normal)input.normal=v(b.normal);
    if(b.center)input.center=v(b.center);
    world.addBoundary(input);
  }
  return world;
}

test('S09 CORR-001 near-floor sphere: no unresolved alternating floor/sphere penetration over 1200 frames', () => {
  const world = sceneWorld(makeScenario('obstacle'));
  try {
    const mass = world.totalMassKg;
    let touching = false;
    for (let step=0;step<1200;step++) {
      const result=world.step(dt);
      assert.ok(result.maximumBoundaryPenetrationMeters <= 1e-6,`frame ${step} penetration ${result.maximumBoundaryPenetrationMeters}`);
      if(result.boundaryContacts>0)touching=true;
    }
    assert.ok(touching,'sphere/floor contacts were actually exercised');
    assert.ok(Math.abs(world.totalMassKg-mass)<1e-8,'particle mass was not conserved');
  } finally {world.shutdown();}
});

test('S09 CORR-001 Jolt-like falling sphere stays within existing penetration limit without changing the solver clock', () => {
  // Deterministic structural reproduction: Jolt owns the body; this drives only
  // the borrowed boundary pose/velocity, never pretends to validate real WASM.
  // Keep the original CORR-001 inputs paired with its recorded prescribed
  // sphere. The live float scene now uses its own measured Jolt trajectory.
  const particles=[];
  for(let x=0;x<5;x++)for(let y=0;y<4;y++)for(let z=0;z<4;z++)
    particles.push({
      position:{x:-.2+x*.12,y:.16+y*.12,z:-.32+z*.12},
      velocity:{x:0,y:0,z:0},massKg:1000*.12**3
    });
  const boundaries=makeScenario('float').boundaries.map(b=>({
    ...b,point:{x:Math.sign(b.point.x)*1.45,y:0,z:Math.sign(b.point.z)*.95}
  }));
  const world=sceneWorld({particles,boundaries});
  const id=world.addBoundary({kind:'sphere',center:Vec3.of(.12,.88,.04),radiusMeters:.19});
  const mass=world.totalMassKg;
  let y=.88,vy=0,contacts=0;
  try {
    for(let step=0;step<700;step++) {
      vy=Math.max(-4,vy-9.81*dt);
      if(y<=.19){y=.19;vy=0;}
      world.updateBoundary(id,{kind:'sphere',center:Vec3.of(.12,y,.04),radiusMeters:.19,velocity:Vec3.of(0,vy,0)});
      const r=world.step(dt);
      assert.ok(r.maximumBoundaryPenetrationMeters<=1e-6,`frame ${step}: ${r.maximumBoundaryPenetrationMeters}`);
      contacts+=r.boundaryContacts;
      y=Math.max(.19,y+vy*dt);
    }
    assert.ok(contacts>0);
    assert.ok(Math.abs(world.totalMassKg-mass)<1e-8);
  } finally {world.shutdown();}
});

test('S09 CORR-001 unresolved impossible constraints still fail atomically', () => {
  const world=createWaterWorld();
  try {
    const id=world.addParticle({position:Vec3.of(0,0,0),velocity:Vec3.zero(),massKg:1});
    world.addBoundary({kind:'plane',point:Vec3.of(0,0,0),normal:Vec3.of(0,1,0)});
    world.addBoundary({kind:'plane',point:Vec3.of(0,0,0),normal:Vec3.of(0,-1,0)});
    const before=world.getParticle(id);
    assert.throws(()=>world.step(dt), e=>e instanceof FluidError && e.code==='OUT_OF_RANGE' && /unresolved boundary penetration/.test(e.message));
    assert.deepEqual(world.getParticle(id),before,'failed contact solve must not publish partial movement');
  } finally {world.shutdown();}
});
