/**
 * Replay the same reference fixtures in each source tree with its compiled
 * library. Report timings in a separate process per tree. The playground run
 * exercises the installed package and real Jolt, including changed scene data.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpus, platform, release } from 'node:os';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.argv[2] ?? '.');
const fixtureRoot = resolve(process.argv[3] ?? root);
const mode = process.argv[4] ?? 'all';
assert.ok(['all', 'reference', 'playground'].includes(mode));
const load = (path, base = root) => import(pathToFileURL(resolve(base, path)).href);
const { Vec3 } = await load('dist/index.js');
const { createWaterWorld, waterSurfaceConfig } = await load('dist/fluids/water/index.js');
const { ChunkedSurfaceCache } = await load('dist/surface/index.js');
const { makeScenario, SCENARIOS } = await load('playground/src/scenarios.mjs', fixtureRoot);
const { SimulationSession } = await load('playground/src/simulation.mjs');
const { createJoltHost } = await load('playground/src/jolt-runtime.mjs');

const dt = 1 / 120;
const v = (x, y, z) => Vec3.of(x, y, z);
const convert = p => v(p.x, p.y, p.z);
const meshConfig = { cellSizeMeters: .08, maxGridPoints: 60000, maxTriangles: 100000 };
const percentile = (samples, q) => [...samples].sort((a, b) => a - b)[Math.ceil(samples.length * q) - 1];
const timing = samples => ({
  samples: samples.length,
  p50: percentile(samples, .50),
  p95: percentile(samples, .95),
});
function speed(frame) {
  let max = 0, sum = 0;
  for (let i = 0; i < frame.velocitiesXYZ.length; i += 3) {
    const value = Math.hypot(...frame.velocitiesXYZ.subarray(i, i + 3));
    sum += value;
    max = Math.max(max, value);
  }
  return { max, mean: sum / frame.count };
}
function momentum(frame) {
  const p = [0, 0, 0];
  for (let i = 0; i < frame.count; i++) {
    for (let k = 0; k < 3; k++) p[k] += frame.massesKg[i] * frame.velocitiesXYZ[3 * i + k];
  }
  return p;
}
function closedTank() {
  const world = createWaterWorld();
  const lo = -.15, hi = .6;
  for (const [point, normal] of [
    [v(0, 0, 0), v(0, 1, 0)], [v(lo, 0, 0), v(1, 0, 0)], [v(hi, 0, 0), v(-1, 0, 0)],
    [v(0, 0, lo), v(0, 0, 1)], [v(0, 0, hi), v(0, 0, -1)],
  ]) world.addBoundary({kind: 'plane', point, normal});
  for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) for (let z = 0; z < 4; z++) {
    world.addParticle({position: v(x * .11, .03 + y * .11, z * .11), velocity: Vec3.zero(), massKg: 1000 * .11 ** 3});
  }
  const mass = world.totalMassKg, weight = mass * 9.81;
  let limits = 0, balance = 0, penetration = 0, compression = 0, floorImpulse = 0;
  let beforePerturbation, response, atStep240;
  const digest = createHash('sha256');
  for (let i = 0; i < 1200; i++) {
    let frame = world.particleSnapshot();
    if (i === 960) {
      beforePerturbation = speed(frame);
      const particle = world.getParticle(frame.ids[21]);
      world.applyParticleImpulses([{id: particle.id, impulseNs: v(.35 * particle.massKg, 0, 0)}]);
      frame = world.particleSnapshot();
    }
    const before = momentum(frame), result = world.step(dt), end = world.particleSnapshot();
    const after = momentum(end), impulse = [0, 0, 0];
    for (const {impulseOnBoundaryNs: j} of result.boundaryReactions) {
      impulse[0] += j.x; impulse[1] += j.y; impulse[2] += j.z;
    }
    balance = Math.max(balance, Math.hypot(...after.map((p, k) =>
      p - before[k] + impulse[k] + (k === 1 ? weight * dt : 0))));
    penetration = Math.max(penetration, result.maximumBoundaryPenetrationMeters);
    compression = Math.max(compression, result.maximumDensityCompressionRelative);
    if (result.convergence === 'iteration_limit') limits++;
    if (i >= 840 && i < 960) floorImpulse -= result.boundaryReactions[0].impulseOnBoundaryNs.y;
    assert.equal(result.totalMassKg, mass);
    if (i === 239) atStep240 = { limits, speed: speed(end) };
    if (i === 960) response = speed(end);
    digest.update(new Uint8Array(end.positionsXYZ.buffer));
    digest.update(new Uint8Array(end.velocitiesXYZ.buffer));
    digest.update(JSON.stringify(result));
  }
  assert.ok(balance < 1e-9);
  assert.ok(penetration <= 1e-6);
  const report = {
    steps: 1200, massKg: mass, maxBalanceErrorNs: balance, maxPenetrationMeters: penetration,
    maxCompressionRelative: compression, limits, atStep240, beforePerturbation, response,
    final: speed(world.particleSnapshot()), meanFloorForceN: floorImpulse / (120 * dt), weightN: weight,
    meanFloorTractionPa: floorImpulse / (120 * dt * (hi - lo) ** 2), digest: digest.digest('hex'),
  };
  world.shutdown();
  return report;
}

function referenceScene(id) {
  const spec = makeScenario(id), physicsMs = [], meshMs = [];
  for (let repeat = 0; repeat < 4; repeat++) {
    const world = createWaterWorld(), surface = new ChunkedSurfaceCache();
    world.emitParticles(spec.particles.map(p => ({
      position: convert(p.position), velocity: convert(p.velocity), massKg: p.massKg,
    })));
    for (const b of spec.boundaries) {
      const input = {...b};
      for (const key of ['point', 'normal', 'center']) if (b[key]) input[key] = convert(b[key]);
      world.addBoundary(input);
    }
    const config = waterSurfaceConfig(world, meshConfig), mass = world.totalMassKg;
    for (let i = 0; i < 180; i++) {
      const start = performance.now(), result = world.step(dt);
      if (repeat > 0) physicsMs.push(performance.now() - start);
      assert.equal(result.totalMassKg, mass);
      if (i % 12 === 0) {
        const surfaceStart = performance.now();
        const mesh = surface.update(world.particleSnapshot(), config);
        if (repeat > 0) meshMs.push(performance.now() - surfaceStart);
        assert.ok(mesh.triangles > 0);
      }
    }
    world.shutdown();
  }
  return {id, physicsMs: timing(physicsMs), meshMs: timing(meshMs)};
}

function surfaceComponents(mesh) {
  const parents = Int32Array.from({length: mesh.vertexCount}, (_, i) => i);
  function rootOf(i) {
    while (parents[i] !== i) {
      parents[i] = parents[parents[i]];
      i = parents[i];
    }
    return i;
  }
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = rootOf(mesh.indices[i]);
    parents[rootOf(mesh.indices[i + 1])] = a;
    parents[rootOf(mesh.indices[i + 2])] = a;
  }
  const triangles = new Map();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const k = rootOf(mesh.indices[i]);
    triangles.set(k, (triangles.get(k) ?? 0) + 1);
  }
  return {count: triangles.size, largestTriangleShare: Math.max(0, ...triangles.values()) / mesh.triangleCount};
}
function playgroundScenario(id, jolt) {
  const sim = new SimulationSession({scenarioId: id, jolt});
  try {
    let limits = 0, maximumPenetrationMeters = 0, solidContacts = 0;
    let lowestBodyY = sim.bodyTransform?.position[1], highestBodyY = lowestBodyY, maxBodyX = 0, maxBodyZ = 0;
    const positions = [];
    const mass = sim.world.totalMassKg;
    const steps = id === 'float' ? 1200 : 360;
    for (let i = 0; i < steps; i++) {
      const result = sim.step(dt);
      if (result.convergence === 'iteration_limit') limits++;
      maximumPenetrationMeters = Math.max(maximumPenetrationMeters, result.maximumBoundaryPenetrationMeters);
      solidContacts += result.boundaryReactions[5]?.contacts ?? 0;
      const transform = sim.bodyTransform;
      if (transform) {
        const [x, y, z] = transform.position;
        lowestBodyY = Math.min(lowestBodyY, y);
        highestBodyY = Math.max(highestBodyY, y);
        maxBodyX = Math.max(maxBodyX, Math.abs(x));
        maxBodyZ = Math.max(maxBodyZ, Math.abs(z));
        if ([59, 119, 239, 359, 599, 1199].includes(i)) positions.push({step: i + 1, xyz: transform.position});
      }
      assert.equal(result.totalMassKg, mass);
    }
    const render = sim.extractChunks(meshConfig);
    const result = {
      id, steps, massKg: mass, limits, maximumPenetrationMeters, solidContacts,
      surfaceTriangles: render.triangles, lowestBodyY, highestBodyY, maxBodyX, maxBodyZ, positions, speed: speed(sim.snapshot()),
      surfaceComponents: id === 'tank' ? surfaceComponents(sim.extract(meshConfig)) : undefined,
      bodyContained: id === 'float' ?
        maxBodyX <= sim.spec.tank.width / 2 && maxBodyZ <= sim.spec.tank.depth / 2 &&
          lowestBodyY >= 0 && highestBodyY <= sim.spec.tank.height + sim.spec.floatSphere.radiusMeters :
        undefined,
    };
    return result;
  } finally {
    sim.shutdown();
  }
}

const jolt = mode === 'reference' ? null : await createJoltHost();
try {
  const reference = mode === 'playground' ? undefined : closedTank();
  const referenceScenes = mode === 'playground' ? undefined :
    SCENARIOS.filter(s => !s.usesJolt).map(s => referenceScene(s.id));
  const playground = mode === 'reference' ? undefined : SCENARIOS.map(s => {
    try { return playgroundScenario(s.id, jolt); }
    catch (error) { return { id: s.id, error: error.message }; }
  });
  const memory = process.memoryUsage();
  console.log(JSON.stringify({
    host: {node: process.version, cpu: cpus()[0]?.model, platform: platform(), kernel: release()},
    units: {time: 'ms', memory: 'bytes'}, reference, referenceScenes, playground, memory,
    maxRssKiB: process.resourceUsage().maxRSS,
  }, null, 2));
  if (playground?.some(s => s.error || s.bodyContained === false)) process.exitCode = 1;
} finally {
  jolt?.shutdown();
}
