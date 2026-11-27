import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverBrowser } from './browser_discovery.mjs';

const reply = (status = 0, stdout = '') => ({ status, stdout, error: undefined });

test('S05 browser discovery: explicit executable takes priority', () => {
  const result = discoverBrowser({ env: { CENTURY_FLUIDS_CHROME: '/opt/browser/chrome' }, run: (command, args) =>
    command === '/opt/browser/chrome' && args[0] === '--version' ? reply() : reply(1),
  });
  assert.deepEqual(result.browser, { command: '/opt/browser/chrome', argsPrefix: [], origin: 'override' });
});

test('S05 browser discovery: invalid override falls back to Brave binary', () => {
  const result = discoverBrowser({ env: { CENTURY_FLUIDS_CHROME: '/missing/chrome' }, run: (command) =>
    command === 'brave-browser' ? reply() : reply(1),
  });
  assert.equal(result.browser.command, 'brave-browser');
  assert.match(result.diagnostics.join(' '), /no es ejecutable/);
});

test('S05 browser discovery: registered Flatpak Chromium is located', () => {
  const result = discoverBrowser({ env: {}, run: (command, args) => {
    if (command === 'flatpak' && args[0] === 'list') return reply(0, 'org.chromium.Chromium\norg.mozilla.firefox\n');
    if (command === 'flatpak' && args[0] === 'run' && args[1] === 'org.chromium.Chromium') return reply();
    return reply(1);
  }});
  assert.deepEqual(result.browser, { command: 'flatpak', argsPrefix: ['run', 'org.chromium.Chromium'], origin: 'flatpak:org.chromium.Chromium' });
});

test('S05 browser discovery: Flatpak Brave and explicit app IDs are supported', () => {
  const result = discoverBrowser({ env: { CENTURY_FLUIDS_FLATPAK_ID: 'com.brave.Browser' }, run: (command, args) => {
    if (command === 'flatpak' && args[0] === 'list') return reply(0, 'com.brave.Browser\n');
    if (command === 'flatpak' && args[0] === 'run') return reply();
    return reply(1);
  }});
  assert.equal(result.browser.origin, 'flatpak:com.brave.Browser');
});

test('S05 browser discovery: absent browser remains blocked and gives instructions', () => {
  const result = discoverBrowser({ env: {}, run: () => reply(1) });
  assert.equal(result.browser, null);
  assert.match(result.diagnostics.join(' '), /No se encontró/);
});

test('S05 browser discovery: invalid app ID cannot become a command', () => {
  let calledUnsafe = false;
  const result = discoverBrowser({ env: { CENTURY_FLUIDS_FLATPAK_ID: 'bad;command' }, run: (command, args) => {
    if (args.includes('bad;command')) calledUnsafe = true;
    if (command === 'flatpak' && args[0] === 'list') return reply(0, 'bad;command\n');
    return reply(1);
  }});
  assert.equal(calledUnsafe, false);
  assert.equal(result.browser, null);
  assert.match(result.diagnostics.join(' '), /formato inválido/);
});
