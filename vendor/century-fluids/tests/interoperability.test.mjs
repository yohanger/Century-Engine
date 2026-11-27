import { createWaterWorld, waterPhysicalConfig, waterSolverConfig, WaterHydrodynamics } from '../dist/fluids/water/index.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../dist/index.js';

const { FluidWorld, FluidConfig, FluidError, LiquidSolverConfig, Vec3 } = api;

test('S05 public ESM surface is explicit and contains no host adapter', () => {
  assert.deepEqual(Object.keys(api).sort(), ['ChunkVoxelIndex', 'FluidConfig', 'FluidError', 'FluidWorld', 'LiquidSolverConfig', 'Vec3']);
  assert.equal(typeof FluidWorld, 'function');
});

test('S05 detached numerical data can transfer to a different execution context', () => {
  const world = createWaterWorld();
  const id = world.addParticle({ position: Vec3.of(1, 2, 3), velocity: Vec3.of(4, 5, 6), massKg: 7 });
  const before = world.particleSnapshot();
  const copy = structuredClone(before, { transfer: [before.positionsXYZ.buffer, before.velocitiesXYZ.buffer] });
  assert.equal(before.positionsXYZ.byteLength, 0);
  assert.deepEqual(Array.from(copy.positionsXYZ), [1, 2, 3]);
  assert.deepEqual(Array.from(copy.velocitiesXYZ), [4, 5, 6]);
  copy.positionsXYZ[0] = 999;
  assert.equal(world.getParticle(id).position.x, 1);
  assert.equal(world.totalMassKg, 7);
  world.shutdown();
});

test('S05 ESM lifecycle and error values are host independent', () => {
  const world = createWaterWorld();
  assert.ok(world.getLiquidConfig() instanceof LiquidSolverConfig);
  assert.throws(() => world.addParticle({ position: null, velocity: Vec3.zero(), massKg: 1 }), FluidError);
  assert.equal(world.particleCount, 0);
  world.shutdown();
  world.shutdown();
  assert.throws(() => world.particleSnapshot(), (error) => error instanceof FluidError && error.code === 'CLOSED');
});
