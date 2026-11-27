#!/usr/bin/env node
/** S05 manual browser QA: pack, install the tarball into a disposable consumer, serve it using Vite. */
import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = join(root, 'tests/browser-vite');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const viteVersion = '8.3.8';

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd, encoding: 'utf8', timeout: 90000,
    env: { ...process.env, npm_config_audit: 'false', npm_config_fund: 'false', npm_config_update_notifier: 'false' },
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed: ${result.status ?? result.error}\n${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  }
  return result.stdout;
}

export async function prepareViteConsumer() {
  const temporary = await mkdtemp(join(tmpdir(), 'century-fluids-s05-vite-'));
  const consumer = join(temporary, 'consumer');
  try {
    await mkdir(consumer);
    await cp(fixture, consumer, { recursive: true });
    await writeFile(join(consumer, 'package.json'), JSON.stringify({
      name: 'century-fluids-s05-vite-consumer', version: '0.0.0', type: 'module', private: true,
    }, null, 2));
    const entries = JSON.parse(run(npm, ['pack', '--json', '--pack-destination', temporary], root));
    assert.equal(entries.length, 1);
    const pkg = entries[0];
    assert.equal(pkg.name, '@century/fluids');
    assert.ok(pkg.files.some((f) => f.path === 'dist/index.js'));
    assert.ok(pkg.files.every((f) => f.path === 'package.json' || f.path === 'README.md' || f.path.startsWith('dist/')));
    run(npm, ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund',
      '--no-save', '--package-lock=false', join(temporary, pkg.filename)], consumer);
    const installed = JSON.parse(await readFile(join(consumer, 'node_modules/@century/fluids/package.json'), 'utf8'));
    assert.equal(installed.name, '@century/fluids');
    assert.equal(installed.version, pkg.version);
    assert.equal(installed.dependencies, undefined);
    const expected = JSON.parse(run(process.execPath, [
      '--input-type=module', '--eval',
      "import { runProbe } from './probe.mjs'; console.log(JSON.stringify(runProbe()))",
    ], consumer).trim());
    assert.equal(expected.id, 1);
    assert.equal(expected.count, 1);
    assert.equal(expected.mass, 1);
    assert.equal(expected.convergence, 'converged');
    assert.ok(Number.isFinite(expected.y) && Number.isFinite(expected.vy));
    await writeFile(join(consumer, 'expected.json'), JSON.stringify(expected, null, 2) + '\n');
    return { temporary, consumer, expected, files: pkg.files.length, packedBytes: pkg.size };
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }
}

async function main() {
  let prepared;
  try {
    prepared = await prepareViteConsumer();
    console.log(`S05_VITE_CONSUMER_PREPARED files=${prepared.files} packedBytes=${prepared.packedBytes} count=${prepared.expected.count} y=${prepared.expected.y}`);
    if (process.argv.includes('--prepare-only')) {
      console.log('S05_VITE_PREPARE_PASS browser=NOT_VERIFIED');
      return;
    }
    console.log('S05_BROWSER_MANUAL_PENDING: abre http://127.0.0.1:5173/ en Brave y comprueba S05_BROWSER_PASS');
    console.log(`Vite ${viteVersion} se instala en la caché de npm si todavía no está disponible.`);
    const args = ['exec', '--yes', `--package=vite@${viteVersion}`, '--', 'vite', prepared.consumer,
      '--host', '127.0.0.1', '--port', '5173', '--strictPort'];
    const child = spawn(npm, args, { cwd: root, stdio: 'inherit', detached: process.platform !== 'win32' });
    const stop = () => {
      if (child.pid && process.platform !== 'win32') {
        try { process.kill(-child.pid, 'SIGTERM'); } catch { /* child already stopped */ }
      } else child.kill('SIGTERM');
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    const code = await new Promise((ok, fail) => {
      child.once('exit', (status, signal) => ok(signal ? 130 : status ?? 1));
      child.once('error', fail);
    });
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    if (code !== 0 && code !== 130) throw new Error(`Vite exited with code ${code}`);
  } finally {
    if (prepared) await rm(prepared.temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error('S05_VITE_QA_FAIL:', error.message); process.exitCode = 1; });
}
