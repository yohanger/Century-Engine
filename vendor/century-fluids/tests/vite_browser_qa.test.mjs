import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, realpath, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { prepareViteConsumer } from './run_vite_qa.mjs';
import { verifyParity } from './browser-vite/verify.mjs';

test('S05 Vite: parity rejects mismatched numbers and missing or non-finite data', () => {
  const expected = { id: 1, count: 1, mass: 1, convergence: 'converged', y: 0.99975475, vy: -0.04905 };
  assert.doesNotThrow(() => verifyParity({ ...expected }, expected));
  assert.throws(() => verifyParity({ ...expected, y: expected.y + 0.01 }, expected), /mismatch for y/);
  assert.throws(() => verifyParity({ ...expected, vy: NaN }, expected), /mismatch for vy/);
  assert.throws(() => verifyParity({ ...expected, count: undefined }, expected), /mismatch for count/);
  assert.throws(() => verifyParity({ ...expected, convergence: 'iteration_limit' }, expected), /mismatch for convergence/);
  assert.throws(() => verifyParity({ ...expected, count: 1 }, { ...expected, y: undefined }), /mismatch for y/);
});

test('S05 Vite: consumer imports only the tarball-installed ESM, never source', async () => {
  const prepared = await prepareViteConsumer();
  try {
    const installed = join(prepared.consumer, 'node_modules/@century/fluids');
    const actualPath = await realpath(installed);
    assert.ok(actualPath.startsWith(resolve(prepared.temporary)));
    const pkg = JSON.parse(await readFile(join(installed, 'package.json'), 'utf8'));
    assert.equal(pkg.exports['.'].import, './dist/index.js');
    assert.equal(pkg.dependencies, undefined);
    assert.equal(pkg.private, true);
    const distEntry = await readFile(join(installed, 'dist/index.js'), 'utf8');
    assert.ok(distEntry.includes('FluidWorld'));
    const probe = await readFile(join(prepared.consumer, 'probe.mjs'), 'utf8');
    assert.match(probe, /from '@century\/fluids'/);
    assert.doesNotMatch(probe, /from ['"]\.\.\/.*src\//);
    const expectedJson = JSON.parse(await readFile(join(prepared.consumer, 'expected.json'), 'utf8'));
    verifyParity(prepared.expected, expectedJson);
    assert.ok(prepared.expected.y < 1 && prepared.expected.y > 0);
  } finally {
    await rm(prepared.temporary, { recursive: true, force: true });
  }
});
