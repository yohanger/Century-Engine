import { createWaterWorld, waterPhysicalConfig, waterSolverConfig, WaterHydrodynamics } from '../dist/fluids/water/index.js';
/** Deterministic, non-gating reference benchmark: no invented FPS or threshold. */
import { performance } from 'node:perf_hooks';
import { FluidWorld, Vec3 } from '../dist/index.js';

const COUNT = 12_000;
const QUERIES = 150;
let seed = 0xC0FFEE;
const rng = () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 2 ** 32; };
const world = createWaterWorld();
const origin = [];
let t0 = performance.now();
for (let i = 0; i < COUNT; i++) {
  const position = Vec3.of(rng() * 20, rng() * 20, rng() * 20);
  world.addParticle({ position, velocity: Vec3.zero(), massKg: 0.25 });
  if (i < QUERIES) origin.push(position);
}
const insertMs = performance.now() - t0;
let found = 0;
t0 = performance.now();
for (const p of origin) found += world.neighborsWithin(p, 0.7).length;
const indexedMs = performance.now() - t0;
const snapshot = world.particleSnapshot();
t0 = performance.now();
let bruteFound = 0;
for (const p of origin) {
  for (let i = 0; i < snapshot.count; i++) {
    if (Math.hypot(snapshot.positionsXYZ[i * 3] - p.x, snapshot.positionsXYZ[i * 3 + 1] - p.y, snapshot.positionsXYZ[i * 3 + 2] - p.z) <= 0.7) bruteFound++;
  }
}
const bruteMs = performance.now() - t0;
if (found !== bruteFound) throw new Error(`benchmark mismatch indexed=${found} brute=${bruteFound}`);
const mem = process.memoryUsage();
console.log(JSON.stringify({ label: 'S02 non-gating microbenchmark', node: process.version, count: COUNT, queries: QUERIES, radiusMeters: 0.7, results: found, insertMs: Number(insertMs.toFixed(3)), indexedMs: Number(indexedMs.toFixed(3)), bruteMs: Number(bruteMs.toFixed(3)), heapUsedBytes: mem.heapUsed, rssBytes: mem.rss }));
world.shutdown();
