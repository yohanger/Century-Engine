import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../build/playground/', import.meta.url)));
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.map': 'application/json' };
let resolveResult;
const resultPromise = new Promise((resolveValue) => { resolveResult = resolveValue; });

const server = createServer(async (request, response) => {
  if (request.url === '/__qa_result' && request.method === 'POST') {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const report = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    response.writeHead(204).end();
    resolveResult(report);
    return;
  }
  const requested = request.url === '/' ? '/tests/browser/index.html' : request.url?.split('?')[0] ?? '/tests/browser/index.html';
  const candidate = normalize(join(root, decodeURIComponent(requested)));
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
    response.writeHead(403).end('forbidden');
    return;
  }
  try {
    const body = await readFile(candidate);
    response.writeHead(200, { 'content-type': mime[extname(candidate)] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
  } catch {
    response.writeHead(404).end('not found');
  }
});

await new Promise((resolveValue) => server.listen(0, '127.0.0.1', resolveValue));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('QA server failed to bind');
const profile = await mkdtemp(join(tmpdir(), 'century-radiance-qa-'));
const browser = spawn(edge, [
  '--headless=new',
  '--no-first-run',
  '--disable-background-networking',
  '--disable-default-apps',
  '--disable-extensions',
  '--disable-sync',
  '--metrics-recording-only',
  '--mute-audio',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  `--user-data-dir=${profile}`,
  `http://127.0.0.1:${address.port}/tests/browser/index.html`,
], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });

let stderr = '';
browser.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
let timeoutId;
const timeout = new Promise((_, reject) => {
  timeoutId = setTimeout(() => reject(new Error('Browser QA timed out')), 45000);
});
try {
  const report = await Promise.race([resultPromise, timeout]);
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  if (stderr) console.error(stderr.slice(-4000));
  process.exitCode = 1;
} finally {
  clearTimeout(timeoutId);
  if (browser.pid && browser.exitCode === null) {
    const killer = spawn('taskkill.exe', ['/PID', String(browser.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    await once(killer, 'exit');
  }
  browser.kill();
  server.closeAllConnections();
  await new Promise((resolveValue) => server.close(resolveValue));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 }).catch(() => undefined);
}
