/** Launch a real Chromium-family browser for QA; never synthesize DOM or PASS. */
import { spawn } from 'node:child_process';

function terminateGroup(child) {
  try {
    if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGKILL');
    else child.kill('SIGKILL');
  } catch {
    try { child.kill('SIGKILL'); } catch { /* already exited */ }
  }
}

/** Resolve only after the browser emits a complete DOM or exits successfully. */
export function dumpBrowserDOM(browser, url, { profileDir, timeoutMs = 12000, spawnProcess = spawn } = {}) {
  if (!browser || !browser.command || !profileDir || !url) throw new TypeError('browser, profileDir and URL required');
  const args = [
    ...browser.argsPrefix,
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--no-first-run', '--no-default-browser-check',
    `--user-data-dir=${profileDir}`, '--dump-dom', url,
  ];
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawnProcess(browser.command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32',
      });
    } catch (error) { reject(error); return; }
    let stdout = '', stderr = '', settled = false;
    const start = Date.now();
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(value);
    };
    const timeout = setTimeout(() => {
      finish(new Error(`S05_BROWSER_RUNTIME_TIMEOUT: browser=${browser.command} origin=${browser.origin} after=${Date.now()-start}ms stdoutBytes=${Buffer.byteLength(stdout)} stderrTail=${stderr.slice(-1800) || '(empty)'}`));
      terminateGroup(child);
    }, timeoutMs);
    child.stdout?.on('data', chunk => {
      if (settled) return;
      stdout += chunk.toString();
      if (stdout.length > 4_000_000) {
        finish(new Error('S05_BROWSER_OUTPUT_LIMIT: DOM exceeds 4MB'));
        terminateGroup(child);
      } else if (stdout.includes('</html>')) {
        // --dump-dom can leave auxiliary processes alive even when it has printed the DOM.
        // The caller still checks the actual PASS marker and numeric result before approving QA.
        finish(null, stdout);
        terminateGroup(child);
      }
    });
    child.stderr?.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-5000); });
    child.on('error', error => finish(new Error(`S05_BROWSER_SPAWN_FAILED: ${error.message}`)));
    child.on('close', (code, signal) => {
      if (settled) return;
      if (code !== 0) finish(new Error(`S05_BROWSER_EXIT: code=${code} signal=${signal ?? 'none'} stderrTail=${stderr.slice(-1800) || '(empty)'}`));
      else finish(null, stdout);
    });
  });
}

/** Canary checks the headless runtime independently of the Century Fluids package. */
export async function verifyHeadlessRuntime(browser, profileDir, options = {}) {
  const marker = 'CF_BROWSER_HEADLESS_CANARY';
  const html = `<!doctype html><html><body>${marker}</body></html>`;
  const result = await dumpBrowserDOM(browser, `data:text/html,${encodeURIComponent(html)}`, {
    profileDir, timeoutMs: 10000, ...options,
  });
  if (!result.includes(marker) || !result.includes('</html>')) {
    throw new Error(`S05_BROWSER_RUNTIME_INVALID: browser did not render independent canary; received ${result.slice(-600)}`);
  }
  return true;
}
