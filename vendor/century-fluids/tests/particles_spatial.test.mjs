import { createWaterWorld, waterPhysicalConfig, waterSolverConfig, WaterHydrodynamics } from '../dist/fluids/water/index.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { FluidWorld, FluidConfig, FluidError, Vec3 } from '../dist/index.js';

const V = (x, y, z) => Vec3.of(x, y, z);
const P = (x, y, z, massKg = 1) => ({ position: V(x, y, z), velocity: V(0, 0, 0), massKg });
const fails = (code) => (error) => error instanceof FluidError && error.code === code;
function brute(s, origin, radius, excludedId) {
  const found = [];
  for (let i = 0; i < s.count; ++i) {
    const x = s.positionsXYZ[i * 3], y = s.positionsXYZ[i * 3 + 1], z = s.positionsXYZ[i * 3 + 2];
    if (s.ids[i] !== excludedId && Math.hypot(x - origin.x, y - origin.y, z - origin.z) <= radius) found.push(s.ids[i]);
  }
  return found.sort((a, b) => a - b);
}

test('S02 public API, independent worlds, default empty particle state', () => {
  const a = new FluidWorld(waterPhysicalConfig());
  const b = createWaterWorld();
  assert.equal(a.particleCount, 0);
  const id = a.addParticle(P(1, 2, 3, 2.25));
  assert.equal(id, 1);
  assert.equal(b.particleCount, 0);
  assert.equal(b.hasParticle(id), false);
  assert.deepEqual(a.getParticle(id).position.toArray(), [1, 2, 3]);
  assert.equal(a.getParticle(id).massKg, 2.25);
  assert.ok(Object.isFrozen(a.getParticle(id)));
  assert.equal(a.prepareStep(1/60).substeps, 2);
  assert.deepEqual(a.getParticle(id).position.toArray(), [1, 2, 3], 'S02 does not run a solver');
});

test('insertion, dense swap-removal, stable IDs, and no stale-handle resurrection', () => {
  const w = createWaterWorld();
  const ids = Array.from({ length: 140 }, (_, i) => w.addParticle(P(i, 0, 0, i + 1)));
  assert.equal(w.particleCount, 140);
  w.removeParticle(ids[14]);
  w.removeParticle(ids[0]);
  w.removeParticle(ids[100]);
  assert.equal(w.particleCount, 137);
  for (const id of [ids[14], ids[0], ids[100]]) {
    assert.equal(w.hasParticle(id), false);
    assert.throws(() => w.getParticle(id), fails('NOT_FOUND'));
  }
  assert.deepEqual(w.getParticle(ids[139]).position.toArray(), [139, 0, 0]);
  const newer = w.addParticle(P(-1, 0, 0));
  assert.equal(newer, 141, 'IDs must never be recycled');
  const snap = w.particleSnapshot();
  assert.equal(snap.ids.length, snap.count);
  assert.equal(new Set(snap.ids).size, snap.count);
  assert.equal(snap.count, 138);
  w.clearParticles();
  assert.equal(w.particleCount, 0);
  assert.equal(w.hasParticle(newer), false);
  assert.equal(w.addParticle(P(0, 0, 0)), 142);
});

test('snapshot has detached numerical buffers with consistent positions, velocities and masses', () => {
  const w = createWaterWorld();
  const id = w.addParticle({ position: V(1, -2, 3), velocity: V(4, 5, -6), massKg: 1.5 });
  const snapshot = w.particleSnapshot();
  assert.ok(snapshot.positionsXYZ instanceof Float64Array);
  assert.ok(snapshot.velocitiesXYZ instanceof Float64Array);
  assert.ok(snapshot.ids instanceof Float64Array);
  assert.ok(snapshot.massesKg instanceof Float64Array);
  assert.deepEqual([...snapshot.positionsXYZ], [1, -2, 3]);
  assert.deepEqual([...snapshot.velocitiesXYZ], [4, 5, -6]);
  assert.deepEqual([...snapshot.massesKg], [1.5]);
  assert.deepEqual([...snapshot.ids], [id]);
  snapshot.positionsXYZ[0] = 999;
  snapshot.velocitiesXYZ[1] = 999;
  snapshot.massesKg[0] = 999;
  snapshot.ids[0] = 999;
  assert.deepEqual(w.getParticle(id).position.toArray(), [1, -2, 3]);
  assert.deepEqual(w.getParticle(id).velocity.toArray(), [4, 5, -6]);
  assert.equal(w.getParticle(id).massKg, 1.5);
});

test('updates validate completely before any mutation, reject unknown fields', () => {
  const w = createWaterWorld();
  const id = w.addParticle(P(1, 2, 3, 3));
  for (const changes of [
    { position: V(99, 99, 99), massKg: 0 },
    { position: V(99, 99, 99), velocity: { x: 0, y: 0, z: 0 } },
    { massKg: Number.NaN }, { massKg: undefined }, {}, null,
    { tyop: true },
  ]) {
    assert.throws(() => w.updateParticle(id, changes));
    assert.deepEqual(w.getParticle(id).position.toArray(), [1, 2, 3]);
    assert.equal(w.getParticle(id).massKg, 3);
  }
  w.updateParticle(id, { position: V(-1, 0, 1), velocity: V(2, 3, 4), massKg: 2.5 });
  assert.deepEqual(w.getParticle(id).position.toArray(), [-1, 0, 1]);
  assert.deepEqual(w.getParticle(id).velocity.toArray(), [2, 3, 4]);
  assert.equal(w.getParticle(id).massKg, 2.5);
});

test('strict runtime validation and bounded capacity prevent accidental over-allocation', () => {
  assert.throws(() => new FluidWorld(waterPhysicalConfig(), { maxParticles: -1 }), fails('OUT_OF_RANGE'));
  assert.throws(() => new FluidWorld(waterPhysicalConfig(), { maxParticles: 2, initialCapacity: 3 }), fails('OUT_OF_RANGE'));
  assert.throws(() => new FluidWorld(waterPhysicalConfig(), { maxParticles: 10_000_001 }), fails('OUT_OF_RANGE'));
  const w = new FluidWorld(waterPhysicalConfig(), { maxParticles: 2, initialCapacity: 0 });
  for (const bad of [
    P(0, 0, 0, 0), P(0, 0, 0, -1), P(0, 0, 0, Infinity),
    { position: { x: 0, y: 0, z: 0 }, velocity: V(0, 0, 0), massKg: 1 },
    { position: V(0, 0, 0), massKg: 1 }, null,
  ]) assert.throws(() => w.addParticle(bad));
  assert.equal(w.particleCount, 0);
  const a = w.addParticle(P(0, 0, 0));
  w.addParticle(P(1, 0, 0));
  assert.throws(() => w.addParticle(P(2, 0, 0)), fails('CAPACITY_EXCEEDED'));
  w.removeParticle(a);
  assert.equal(w.addParticle(P(3, 0, 0)), 3);
  assert.throws(() => w.removeParticle(99), fails('NOT_FOUND'));
  assert.throws(() => w.getParticle(1.7), fails('INVALID_ARGUMENT'));
});

test('3D spatial neighbors: zero, negative coordinates, diagonals and inclusive edge', () => {
  const w = createWaterWorld();
  const center = w.addParticle(P(0, 0, 0));
  const onRadius = w.addParticle(P(1, 0, 0));
  const diagonal = w.addParticle(P(0.6, 0.6, 0.5));
  const far = w.addParticle(P(1.01, 0, 0));
  const negative = w.addParticle(P(-0.1, -0.1, -0.1));
  assert.deepEqual(w.neighborsWithin(V(0, 0, 0), 1), [center, onRadius, diagonal, negative]);
  assert.deepEqual(w.neighborsOf(center, 1), [onRadius, diagonal, negative]);
  assert.deepEqual(w.neighborsWithin(V(0, 0, 0), 0.1), [center]);
  assert.ok(w.neighborsWithin(V(0, 0, 0), 2).includes(far));
  assert.deepEqual(w.neighborsWithin(V(100, 100, 100), 1), []);
});

test('spatial index refreshes after add, update, swap-remove, clear, and different query radii', () => {
  const w = createWaterWorld();
  const center = w.addParticle(P(0, 0, 0));
  assert.deepEqual(w.neighborsOf(center, 1), []);
  const a = w.addParticle(P(0.2, 0, 0));
  const b = w.addParticle(P(8, 0, 0));
  assert.deepEqual(w.neighborsOf(center, 1), [a]);
  w.updateParticle(b, { position: V(0.3, 0, 0) });
  assert.deepEqual(w.neighborsOf(center, 1), [a, b]);
  w.removeParticle(a);
  assert.deepEqual(w.neighborsOf(center, 1), [b]);
  assert.deepEqual(w.neighborsOf(center, 0.1), []);
  assert.deepEqual(w.neighborsOf(center, 1), [b]);
  w.clearParticles();
  assert.deepEqual(w.neighborsWithin(V(0, 0, 0), 1), []);
});

test('invalid queries are controlled, including unrepresentable spatial indices', () => {
  const w = createWaterWorld();
  w.addParticle(P(0, 0, 0));
  for (const invalid of [0, -1, Infinity, NaN, '1', undefined]) {
    assert.throws(() => w.neighborsWithin(V(0, 0, 0), invalid));
  }
  assert.throws(() => w.neighborsWithin({ x: 0, y: 0, z: 0 }, 1), fails('INVALID_ARGUMENT'));
  assert.throws(() => w.neighborsWithin(V(1e20, 0, 0), 1e-10), fails('OUT_OF_RANGE'));
  assert.deepEqual(w.neighborsWithin(V(0, 0, 0), 1), [1], 'failed query did not poison index');
  w.updateParticle(1, { position: V(1e20, 0, 0) });
  assert.throws(() => w.neighborsWithin(V(0, 0, 0), 1e-10), fails('OUT_OF_RANGE'));
  w.updateParticle(1, { position: V(0, 0, 0) });
  assert.deepEqual(w.neighborsWithin(V(0, 0, 0), 1), [1]);
});

test('brute force oracle checks 3D randomized distribution, multiple radii, density, and churn', () => {
  const w = createWaterWorld();
  let seed = 0x12345;
  const rng = () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };
  const ids = [];
  for (let i = 0; i < 900; i++) {
    const x = (rng() - 0.5) * 16;
    const y = (rng() - 0.5) * 16;
    const z = (rng() - 0.5) * 16;
    ids.push(w.addParticle(P(x, y, z, 0.5 + rng())));
  }
  for (let i = 0; i < 80; i++) {
    const position = V((rng() - 0.5) * 16, (rng() - 0.5) * 16, (rng() - 0.5) * 16);
    const radius = [0.15, 0.5, 1.1, 2.7][i % 4];
    assert.deepEqual(w.neighborsWithin(position, radius), brute(w.particleSnapshot(), position, radius));
  }
  for (let i = 0; i < ids.length; i += 9) w.removeParticle(ids[i]);
  for (let i = 1; i < ids.length; i += 17) if (w.hasParticle(ids[i])) w.updateParticle(ids[i], { position: V(0, 0, 0) });
  for (let i = 0; i < 30; i++) {
    const position = V((rng() - 0.5) * 8, (rng() - 0.5) * 8, (rng() - 0.5) * 8);
    const radius = [0.5, 1, 3][i % 3];
    assert.deepEqual(w.neighborsWithin(position, radius), brute(w.particleSnapshot(), position, radius));
  }
});

test('mass values and snapshots remain consistent through modifications', () => {
  const w = createWaterWorld();
  let total = 0;
  const ids = [];
  for (let i = 0; i < 500; i++) { ids.push(w.addParticle(P(i, 0, 0, i + 0.5))); total += i + 0.5; }
  const sum = (s) => [...s.massesKg].reduce((a, b) => a + b, 0);
  assert.equal(sum(w.particleSnapshot()), total);
  const old = w.getParticle(ids[100]).massKg;
  w.updateParticle(ids[100], { massKg: 1.25 });
  total += 1.25 - old;
  assert.equal(sum(w.particleSnapshot()), total);
  w.removeParticle(ids[50]); total -= 50.5;
  assert.equal(sum(w.particleSnapshot()), total);
});

test('after shutdown all public particle operations reject use and release ownership', () => {
  const w = createWaterWorld();
  const id = w.addParticle(P(0, 0, 0));
  w.shutdown(); w.shutdown();
  assert.equal(w.state, 'closed');
  const operations = [
    () => w.particleCount, () => w.addParticle(P(1, 0, 0)), () => w.getParticle(id),
    () => w.hasParticle(id), () => w.updateParticle(id, { massKg: 2 }),
    () => w.removeParticle(id), () => w.clearParticles(), () => w.particleSnapshot(),
    () => w.neighborsWithin(V(0, 0, 0), 1), () => w.neighborsOf(id, 1),
  ];
  for (const operation of operations) assert.throws(operation, fails('CLOSED'));
});
