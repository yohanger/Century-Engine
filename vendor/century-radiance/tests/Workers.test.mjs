import assert from 'node:assert/strict';
import test from 'node:test';
import { Worker } from 'node:worker_threads';
import { RadianceWorkerClient } from '../dist/index.js';

class NodeWorkerEndpoint extends EventTarget {
  constructor(url) {
    super();
    this.worker = new Worker(url);
    this.worker.on('message', (data) => {
      const event = new Event('message');
      Object.defineProperty(event, 'data', { value: data });
      this.dispatchEvent(event);
    });
    this.worker.on('error', (error) => {
      const event = new Event('error');
      Object.defineProperty(event, 'message', { value: error.message });
      this.dispatchEvent(event);
    });
    this.worker.on('messageerror', () => this.dispatchEvent(new Event('messageerror')));
  }

  postMessage(message, transfer = []) {
    this.worker.postMessage(message, transfer);
  }

  terminate() {
    void this.worker.terminate();
  }
}

const nodeWorkerUrl = new URL('../dist/workers/RadianceNodeWorker.js', import.meta.url);

test('worker transfers ownership and returns deterministic result', async () => {
  const client = new RadianceWorkerClient(new NodeWorkerEndpoint(nodeWorkerUrl));
  const buffer = new Uint8Array([1, 2, 3, 4, 5]).buffer;
  const progress = [];
  const promise = client.runTransferDiagnostic(buffer, { chunkBytes: 2, onProgress: (value) => progress.push(value) });
  assert.equal(buffer.byteLength, 0, 'input ownership must transfer immediately');
  const result = await promise;
  assert.deepEqual([...new Uint8Array(result.buffer)], [1, 2, 3, 4, 5]);
  assert.equal(result.bytes, 5);
  assert.equal(result.checksum, 3219469544);
  assert.equal(progress.at(-1), 1);
  assert.equal(client.getDiagnostics().completed, 1);
  assert.equal(client.getDiagnostics().transferredBytes, 5);
  client.dispose();
});

test('worker cancellation rejects and releases the request', async () => {
  const client = new RadianceWorkerClient(new NodeWorkerEndpoint(nodeWorkerUrl));
  const controller = new AbortController();
  const request = client.runTransferDiagnostic(new ArrayBuffer(8 * 1024 * 1024), {
    signal: controller.signal,
    chunkBytes: 64 * 1024,
    delayMs: 1,
  });
  setTimeout(() => controller.abort(), 10);
  await assert.rejects(request, (error) => error.code === 'WORKER_CANCELLED');
  assert.equal(client.getDiagnostics().cancelled, 1);
  assert.equal(client.getDiagnostics().inFlight, 0);
  client.dispose();
});
