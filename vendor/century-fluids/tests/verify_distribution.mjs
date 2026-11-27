#!/usr/bin/env node
import { createWaterWorld, waterPhysicalConfig, waterSolverConfig, WaterHydrodynamics } from '../dist/fluids/water/index.js';
/** S05: exercise the packed artifact as an isolated JS/TS/browser consumer, never the source tree. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { dumpBrowserDOM, verifyHeadlessRuntime } from './browser_headless.mjs';
import { discoverBrowser } from './browser_discovery.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const tsc = process.platform === 'win32' ? 'tsc.cmd' : 'tsc';
const base = await mkdtemp(join(tmpdir(), 'century-fluids-s05-'));

function run(command, args, cwd, timeout = 60000) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout, env: { ...process.env, npm_config_audit: 'false', npm_config_fund: 'false', npm_config_update_notifier: 'false' } });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed (${result.status ?? result.error})\n${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  }
  return result.stdout;
}

const ensureEqual = (a, b, label) => {
  assert.ok(Math.abs(a - b) <= 1e-12, `${label}: browser ${a} differs from Node ${b}`);
};

async function browserTest(consumer, expected) {
  const discovery = discoverBrowser();
  for (const note of discovery.diagnostics) console.error(`S05_BROWSER_DISCOVERY: ${note}`);
  const browser = discovery.browser;
  if (!browser) throw new Error('S05_BROWSER_QA_BLOCKED: no hay navegador Chromium ejecutable; consulta la salida S05_BROWSER_DISCOVERY');
  console.log(`S05_BROWSER_FOUND origin=${browser.origin} command=${browser.command}`);
  try {
    await verifyHeadlessRuntime(browser, join(base, 'headless-canary'));
    console.log('S05_BROWSER_RUNTIME_PASS: standalone headless canary');
  } catch (error) {
    throw new Error(`S05_BROWSER_ENV_BLOCKED: standalone headless browser failed BEFORE loading the fluid package; ${error.message}`);
  }

  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>S05 browser consumer</title>
<script type="importmap">{"imports":{"@century/fluids":"/node_modules/@century/fluids/dist/index.js","@century/fluids/water":"/node_modules/@century/fluids/dist/fluids/water/index.js"}}</script>
<pre id="qa">PENDING</pre><script type="module">
import { FluidWorld, FluidConfig, Vec3 } from '@century/fluids';
import { createWaterWorld } from '@century/fluids/water';
import { createWaterWorld, waterPhysicalConfig } from '@century/fluids/water';
try {
  const world = createWaterWorld();
  const id = world.addParticle({ position: Vec3.of(0, 1, 0), velocity: Vec3.zero(), massKg: 1 });
  const result = world.step(0.005);
  const snap = world.particleSnapshot();
  const row = { id, count: snap.count, y: snap.positionsXYZ[1], vy: snap.velocitiesXYZ[1], mass: world.totalMassKg, convergence: result.convergence };
  world.shutdown();
  document.querySelector('#qa').textContent = JSON.stringify(row);
  document.body.dataset.qa = 'PASS';
} catch (error) {
  document.querySelector('#qa').textContent = 'FAIL:' + String(error);
  document.body.dataset.qa = 'FAIL';
}
</script></html>`;
  await writeFile(join(consumer, 'index.html'), html);
  const server = createServer(async (req, res) => {
    try {
      const requested = new URL(req.url ?? '/', 'http://localhost').pathname;
      const file = resolve(consumer, requested.slice(1) || 'index.html');
      if (relative(consumer, file).startsWith('..')) { res.writeHead(403).end(); return; }
      const bytes = await readFile(file);
      res.writeHead(200, { 'Content-Type': file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(bytes);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const port = server.address().port;
  let htmlOutput = '';
  try {
    htmlOutput = await dumpBrowserDOM(browser, `http://127.0.0.1:${port}/`, {
      profileDir: join(base, 'headless-consumer'), timeoutMs: 25000,
    });
  } finally {
    await new Promise((ok) => server.close(ok));
  }
  assert.match(htmlOutput, /<body data-qa="PASS">/, `browser did not complete: ${htmlOutput.slice(-1800)}`);
  const match = htmlOutput.match(/<pre id="qa">(.*?)<\/pre>/s);
  assert.ok(match, 'browser did not return simulation result');
  const parsed = JSON.parse(match[1]);
  assert.equal(parsed.id, expected.id);
  assert.equal(parsed.count, expected.count);
  assert.equal(parsed.convergence, expected.convergence);
  ensureEqual(parsed.y, expected.y, 'particle Y');
  ensureEqual(parsed.vy, expected.vy, 'velocity Y');
  ensureEqual(parsed.mass, expected.mass, 'total mass');
  console.log(`S05_BROWSER_PASS chromium=${browser.origin} count=${parsed.count} y=${parsed.y} convergence=${parsed.convergence}`);
}

try {
  const packJson = JSON.parse(run(npm, ['pack', '--json', '--pack-destination', base], root));
  assert.equal(packJson.length, 1, 'one tarball expected');
  const metadata = packJson[0];
  const packagePaths = metadata.files.map((f) => f.path);
  assert.ok(packagePaths.includes('dist/index.js') && packagePaths.includes('dist/index.d.ts'));
  assert.ok(packagePaths.includes('package.json'));
  assert.ok(packagePaths.every((p) => p.startsWith('dist/') || p === 'package.json' || p === 'README.md'), `unexpected published files ${packagePaths}`);
  assert.ok(packagePaths.every((p) => !p.endsWith('.rs') && !p.includes('node_modules') && !p.includes('qa/')));
  const consumer = join(base, 'consumer');
  await import('node:fs/promises').then((fs) => fs.mkdir(consumer));
  await writeFile(join(consumer, 'package.json'), JSON.stringify({ name: 'century-fluids-s05-consumer', version: '0.0.0', type: 'module', private: true }));
  const tgz = join(base, metadata.filename);
  run(npm, ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', '--no-save', tgz], consumer);
  const installed = JSON.parse(await readFile(join(consumer, 'node_modules/@century/fluids/package.json'), 'utf8'));
  assert.equal(installed.name, '@century/fluids');
  assert.equal(installed.version, '0.1.0');
  assert.equal(installed.private, true, 'package must remain registry-private until publication is authorized');
  assert.equal(installed.dependencies, undefined, 'runtime dependencies forbidden');

  const jsConsumer = `import { FluidWorld, FluidConfig, Vec3, FluidError } from '@century/fluids';
import { createWaterWorld } from '@century/fluids/water';
const world = createWaterWorld();
const id = world.addParticle({ position: Vec3.of(0, 1, 0), velocity: Vec3.zero(), massKg: 1 });
const result = world.step(0.005);
const snap = world.particleSnapshot();
const output = { id, count: snap.count, y: snap.positionsXYZ[1], vy: snap.velocitiesXYZ[1], mass: world.totalMassKg, convergence: result.convergence };
snap.positionsXYZ[1] = 500;
if (world.getParticle(id).position.y !== output.y) throw new Error('snapshot aliases internal state');
world.shutdown();
try { world.getParticle(id); throw new Error('closed world remains usable'); } catch(error) { if (!(error instanceof FluidError && error.code === 'CLOSED')) throw error; }
console.log(JSON.stringify(output));`;
  await writeFile(join(consumer, 'consumer.mjs'), jsConsumer);
  const expected = JSON.parse(run('node', ['consumer.mjs'], consumer).trim());
  assert.equal(expected.id, 1);
  assert.equal(expected.count, 1);
  assert.equal(expected.mass, 1);
  assert.equal(expected.convergence, 'converged');
  console.log(`S05_NODE_PACKAGE_PASS count=${expected.count} mass=${expected.mass}`);

  const tsConsumer = `import { FluidWorld, FluidConfig, Vec3, type ParticleSnapshot, type LiquidStepResult } from '@century/fluids';
import { createWaterWorld } from '@century/fluids/water';
const world = createWaterWorld();
const id: number = world.addParticle({ position: Vec3.zero(), velocity: Vec3.zero(), massKg: 1 });
const snap: ParticleSnapshot = world.particleSnapshot();
const result: LiquidStepResult = world.step(0.005);
if (snap.count < 0 || id < 0 || result.totalMassKg < 0) throw Error('invalid');
// @ts-expect-error: the public API requires validated vectors
world.addParticle({ position: 'invalid', velocity: Vec3.zero(), massKg: 1 });
world.shutdown();`;
  await writeFile(join(consumer, 'consumer.ts'), tsConsumer);
  await writeFile(join(consumer, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, noEmit: true, skipLibCheck: false }, include: ['consumer.ts'] }));
  run(tsc, ['-p', 'tsconfig.json'], consumer);
  console.log('S05_TYPES_PASS TypeScript consumer resolves published declarations');
  if (process.argv.includes('--browser')) {
    await browserTest(consumer, expected);
    console.log(`S05_PACKAGE_QA_PASS files=${packagePaths.length} packedBytes=${metadata.size} node=yes types=yes browser=yes`);
  } else {
    console.log(`S05_PACKAGE_CONSUMER_PASS files=${packagePaths.length} packedBytes=${metadata.size} node=yes types=yes browser=NOT_VERIFIED`);
  }
} finally {
  await rm(base, { recursive: true, force: true });
}
