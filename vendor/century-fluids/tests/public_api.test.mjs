import { createWaterWorld, waterPhysicalConfig, waterSolverConfig, WaterHydrodynamics } from '../dist/fluids/water/index.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { FluidWorld, FluidConfig, FluidError, Vec3 } from '../dist/index.js';

const matchesError = (code, field) => (err) =>
  err instanceof FluidError && err.code === code && (field === undefined || err.field === field);

test('public exports are usable as native ESM without a host engine', () => {
  const config = waterPhysicalConfig();
  assert.equal(config.restDensityKgM3, 1000);
  assert.deepEqual(config.gravityMS2.toArray(), [0, -9.81, 0]);
  assert.equal(config.maxSubsteps, 16);
  assert.equal(new FluidWorld(config).state, 'ready');
});

test('finite 3D vectors preserve coordinates and reject nonfinite inputs', () => {
  assert.deepEqual(Vec3.of(1.25, -2.5, 0).toArray(), [1.25, -2.5, 0]);
  assert.deepEqual(Vec3.zero().toArray(), [0, 0, 0]);
  for (const invalid of [Number.NaN, Infinity, -Infinity, undefined, '3']) {
    assert.throws(() => Vec3.of(invalid, 0, 0), matchesError('NON_FINITE', 'x'));
  }
});

test('configuration validates every physical scalar and axis independence', () => {
  const base = {
    restDensityKgM3: 998,
    gravityMS2: Vec3.of(9.8, 0, 0),
    maxSubstepSeconds: 0.01,
    maxSubsteps: 8,
  };
  const config = FluidConfig.create(base);
  assert.equal(config.gravityMS2.x, 9.8);
  for (const invalid of [0, -1, Infinity, -Infinity, NaN, '2']) {
    assert.throws(() => FluidConfig.create({...base, restDensityKgM3: invalid}));
    assert.throws(() => FluidConfig.create({...base, maxSubstepSeconds: invalid}));
  }
  for (const invalid of [0, -1, 1.1, NaN, Infinity, 2**53, undefined]) {
    assert.throws(() => FluidConfig.create({...base, maxSubsteps: invalid}), matchesError('OUT_OF_RANGE', 'maxSubsteps'));
  }
  assert.throws(() => FluidConfig.create({...base, gravityMS2: {x: 0, y: -9.81, z: 0}}), matchesError('INVALID_ARGUMENT', 'gravityMS2'));
  assert.throws(() => FluidConfig.create(null), matchesError('INVALID_ARGUMENT', 'config'));
});

test('validated physical values cannot be mutated outside the API', () => {
  const v = Vec3.of(1, 2, 3);
  const c = waterPhysicalConfig();
  assert.ok(Object.isFrozen(v));
  assert.ok(Object.isFrozen(c));
  assert.throws(() => { v.x = 99; }, TypeError);
  assert.throws(() => { c.restDensityKgM3 = 0; }, TypeError);
  assert.deepEqual(v.toArray(), [1, 2, 3]);
});

test('step budget divides host timestep but never advances simulation', () => {
  const world = createWaterWorld();
  const plan = world.prepareStep(1 / 60);
  assert.equal(plan.substeps, 2);
  assert.ok(Object.isFrozen(plan));
  assert.ok(Math.abs(plan.substepDtSeconds * plan.substeps - plan.hostDtSeconds) <= 1e-14);
  assert.equal(world.state, 'ready');
  assert.throws(() => { plan.substeps = 90; }, TypeError);
});

test('rejects invalid host timesteps and budget overruns', () => {
  const world = createWaterWorld();
  for (const invalid of [0, -1, NaN, Infinity, -Infinity, undefined, '0.01']) {
    assert.throws(() => world.prepareStep(invalid));
  }
  assert.throws(() => world.prepareStep(1), matchesError('STEP_BUDGET_EXCEEDED', 'dtSeconds'));
  assert.equal(world.state, 'ready');
});

test('configuration replacement is validated and atomic', () => {
  const world = createWaterWorld();
  const original = world.getConfig();
  assert.throws(() => world.setConfig({ ...original, maxSubsteps: 0 }), matchesError('INVALID_ARGUMENT', 'config'));
  assert.equal(world.getConfig(), original);
  const changed = FluidConfig.create({
    restDensityKgM3: 997,
    gravityMS2: Vec3.of(0, -9.81, 0),
    maxSubstepSeconds: 0.02,
    maxSubsteps: 10,
  });
  world.setConfig(changed);
  assert.equal(world.getConfig(), changed);
  assert.equal(world.prepareStep(0.03).substeps, 2);
});

test('distinct worlds have no shared mutable lifecycle', () => {
  const first = createWaterWorld();
  const second = createWaterWorld();
  first.shutdown();
  first.shutdown();
  assert.equal(first.state, 'closed');
  assert.equal(second.state, 'ready');
  assert.throws(() => first.getConfig(), matchesError('CLOSED'));
  assert.throws(() => first.setConfig(waterPhysicalConfig()), matchesError('CLOSED'));
  assert.throws(() => first.prepareStep(0.01), matchesError('CLOSED'));
  assert.doesNotThrow(() => second.prepareStep(0.01));
});

test('invalid runtime configuration is rejected even for plain JS consumers', () => {
  assert.throws(() => new FluidWorld({ restDensityKgM3: 1000 }), matchesError('INVALID_ARGUMENT', 'config'));
  const world = createWaterWorld();
  assert.equal(world.state, 'ready');
});

test('micro and nonstandard valid timesteps remain finite and bounded', () => {
  const c = FluidConfig.create({
    restDensityKgM3: 1000, gravityMS2: Vec3.zero(), maxSubstepSeconds: 0.5,
    maxSubsteps: 3,
  });
  const world = new FluidWorld(c);
  for (const dt of [Number.MIN_VALUE, 1e-9, 0.125, 0.499, 0.5, 1, 1.5]) {
    const p = world.prepareStep(dt);
    assert.ok(p.substeps >= 1 && p.substeps <= 3);
    assert.ok(p.substepDtSeconds > 0 && Number.isFinite(p.substepDtSeconds));
  }
});
