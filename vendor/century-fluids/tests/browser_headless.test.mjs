import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { dumpBrowserDOM, verifyHeadlessRuntime } from './browser_headless.mjs';

function fakeSpawnWith(output = null, stderr = '') {
  return () => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => { child.emit('close', null, 'SIGKILL'); };
    queueMicrotask(() => {
      if (stderr) child.stderr.write(stderr);
      if (output !== null) child.stdout.write(output);
    });
    return child;
  };
}
const fakeBrowser = { command: 'fake-browser', argsPrefix: [], origin: 'unit-test' };

test('S05 headless: complete emitted DOM is captured even when browser leaves handles alive', async () => {
  const html = '<!doctype html><html><body data-qa="PASS">ok</body></html>';
  assert.equal(await dumpBrowserDOM(fakeBrowser, 'about:blank', {
    profileDir: '/tmp/test-profile', spawnProcess: fakeSpawnWith(html), timeoutMs: 200,
  }), html);
});

test('S05 headless: timeout reports missing browser DOM and stderr, never passes', async () => {
  await assert.rejects(
    dumpBrowserDOM(fakeBrowser, 'about:blank', {
      profileDir: '/tmp/test-profile', spawnProcess: fakeSpawnWith(null, 'startup stalled'), timeoutMs: 25,
    }), /S05_BROWSER_RUNTIME_TIMEOUT:.*stdoutBytes=0.*stderrTail=startup stalled/,
  );
});

test('S05 headless: canary rejects a non-rendering browser', async () => {
  await assert.rejects(verifyHeadlessRuntime(fakeBrowser, '/tmp/test-profile', {
    spawnProcess: fakeSpawnWith('<html><body>WRONG</body></html>'), timeoutMs: 200,
  }), /S05_BROWSER_RUNTIME_INVALID/);
});

test('S05 headless: canary requires a real marker in returned browser DOM', async () => {
  assert.equal(await verifyHeadlessRuntime(fakeBrowser, '/tmp/test-profile', {
    spawnProcess: fakeSpawnWith('<html><body>CF_BROWSER_HEADLESS_CANARY</body></html>'), timeoutMs: 200,
  }), true);
});
