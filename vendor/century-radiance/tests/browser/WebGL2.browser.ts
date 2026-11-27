import { CenturyRadiance, WebGL2Backend, type WorkerEndpoint } from '../../src/index.js';

interface Check { name: string; pass: boolean; detail: string }
const checks: Check[] = [];
const check = (name: string, pass: boolean, detail: string): void => { checks.push({ name, pass, detail }); };
const waitFor = async (predicate: () => boolean, timeoutMs = 5000): Promise<void> => {
  const start = performance.now();
  while (!predicate()) {
    if (performance.now() - start > timeoutMs) throw new Error('Timed out waiting for browser state');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
};

let radiance: CenturyRadiance | null = null;

try {
  const canvas = document.querySelector<HTMLCanvasElement>('#qa-canvas');
  if (!canvas) throw new Error('QA canvas missing');
  const gl = canvas.getContext('webgl2');
  if (!gl) throw new Error('WebGL 2 unavailable');
  const instance = new CenturyRadiance(new WebGL2Backend(gl), {
    workerFactory: () => new Worker(new URL('../../src/workers/RadianceWorker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerEndpoint,
  });
  radiance = instance;
  const caps = await instance.initialize();
  check('webgl2-context', caps.webgl2, `${caps.vendor} · ${caps.renderer}`);
  check('glsl-es-300', caps.shadingLanguageVersion.includes('3.00'), caps.shadingLanguageVersion);
  check('diagnostic-framebuffer', instance.getDiagnostics().backend.framebufferFailures === 0, JSON.stringify(instance.getDiagnostics().backend));

  const input = new Uint8Array([11, 22, 33, 44]).buffer;
  const transfer = instance.runWorkerDiagnostic(input, { chunkBytes: 2 });
  check('transfer-detaches-input', input.byteLength === 0, `input.byteLength=${input.byteLength}`);
  const result = await transfer;
  check('worker-roundtrip', result.bytes === 4 && result.buffer.byteLength === 4, `bytes=${result.bytes}`);

  const controller = new AbortController();
  const cancellation = instance.runWorkerDiagnostic(new ArrayBuffer(16 * 1024 * 1024), {
    signal: controller.signal,
    chunkBytes: 64 * 1024,
    delayMs: 1,
  });
  setTimeout(() => controller.abort(), 10);
  let cancelled = false;
  try { await cancellation; } catch (error) { cancelled = error instanceof Error && 'code' in error && error.code === 'WORKER_CANCELLED'; }
  check('worker-cancellation', cancelled, `cancelled=${cancelled}`);

  const loseContext = gl.getExtension('WEBGL_lose_context');
  if (loseContext) {
    loseContext.loseContext();
    await waitFor(() => instance.getDiagnostics().state === 'context-lost');
    check('context-loss-observed', true, `losses=${instance.getDiagnostics().contextLosses}`);
    loseContext.restoreContext();
    await waitFor(() => instance.getDiagnostics().state === 'ready', 10000);
    check('context-restored', true, `generation=${instance.getDiagnostics().generation}`);
  } else {
    check('context-loss-extension', false, 'WEBGL_lose_context unavailable');
  }

  await instance.reset();
  check('reset-releases-resources', instance.getDiagnostics().backend.liveResources === 0, JSON.stringify(instance.getDiagnostics().backend));
  await instance.initialize();
  instance.dispose();
  check('dispose-releases-resources', instance.getDiagnostics().backend.liveResources === 0, JSON.stringify(instance.getDiagnostics().backend));
} catch (error) {
  check('unexpected-error', false, error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  radiance?.dispose();
}

const report = {
  pass: checks.every((item) => item.pass),
  userAgent: navigator.userAgent,
  checks,
};
document.querySelector<HTMLElement>('#qa-output')!.textContent = JSON.stringify(report, null, 2);
await fetch('/__qa_result', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(report) });
