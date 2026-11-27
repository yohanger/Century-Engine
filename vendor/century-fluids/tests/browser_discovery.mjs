#!/usr/bin/env node
/** S05 browser host discovery: never substitutes a mock for real browser execution. */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const nativeCandidates = [
  'chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable',
  'brave-browser', 'brave-browser-stable', 'microsoft-edge', 'microsoft-edge-stable',
  'vivaldi', 'vivaldi-stable',
];
const flatpakCandidates = [
  'org.chromium.Chromium', 'com.google.Chrome', 'com.brave.Browser',
  'com.microsoft.Edge', 'com.vivaldi.Vivaldi',
];
const appIdPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

/** Find a real Chromium-family executable, without shell execution or a new dependency. */
export function discoverBrowser({ env = process.env, run = spawnSync } = {}) {
  const diagnostics = [];
  const browserOverride = env.CENTURY_FLUIDS_CHROME?.trim();
  const names = [...new Set([browserOverride, ...nativeCandidates].filter(Boolean))];
  for (const name of names) {
    const result = run(name, ['--version'], { encoding: 'utf8', timeout: 5000 });
    if (!result.error && result.status === 0) {
      return { browser: { command: name, argsPrefix: [], origin: browserOverride === name ? 'override' : 'native' }, diagnostics };
    }
    if (name === browserOverride) {
      diagnostics.push(`CENTURY_FLUIDS_CHROME=${name} no es ejecutable (o falló --version)`);
    }
  }

  // Flatpak installations are applications, not executable names on PATH.
  const flatpak = run('flatpak', ['list', '--app', '--columns=application'], { encoding: 'utf8', timeout: 6000 });
  if (!flatpak.error && flatpak.status === 0) {
    const installed = new Set((flatpak.stdout ?? '').split(/\r?\n/).map(s => s.trim()).filter(Boolean));
    const requestedId = env.CENTURY_FLUIDS_FLATPAK_ID?.trim();
    if (requestedId && !appIdPattern.test(requestedId)) {
      diagnostics.push(`CENTURY_FLUIDS_FLATPAK_ID tiene un formato inválido`);
    }
    const ids = [...new Set([
      ...(requestedId && appIdPattern.test(requestedId) ? [requestedId] : []),
      ...flatpakCandidates,
    ])];
    for (const id of ids) {
      if (!installed.has(id)) continue;
      const probe = run('flatpak', ['run', id, '--version'], { encoding: 'utf8', timeout: 8000 });
      if (!probe.error && probe.status === 0) {
        return { browser: { command: 'flatpak', argsPrefix: ['run', id], origin: `flatpak:${id}` }, diagnostics };
      }
      diagnostics.push(`Flatpak ${id} está instalado, pero no ejecuta --version`);
    }
    if (!ids.some(id => installed.has(id))) {
      diagnostics.push('Flatpak disponible, pero no contiene un navegador Chromium compatible reconocido');
    }
  } else {
    diagnostics.push('Flatpak no disponible o no permite listar aplicaciones');
  }
  diagnostics.push('No se encontró Chromium/Chrome/Brave/Edge/Vivaldi ejecutable');
  diagnostics.push('Comprueba: flatpak list --app --columns=application');
  diagnostics.push('O indica una ruta real mediante CENTURY_FLUIDS_CHROME=/ruta/al/ejecutable');
  diagnostics.push('Para una app Flatpak compatible no listada: CENTURY_FLUIDS_FLATPAK_ID=ID_DE_LA_APP');
  return { browser: null, diagnostics };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = discoverBrowser();
  for (const line of result.diagnostics) console.error(`S05_BROWSER_DISCOVERY: ${line}`);
  if (result.browser) {
    console.log(`S05_BROWSER_FOUND origin=${result.browser.origin} command=${result.browser.command}`);
  } else {
    console.error('S05_BROWSER_QA_BLOCKED: ningún navegador compatible disponible; NO VERIFICADO');
    process.exitCode = 2;
  }
}
