import { parentPort } from 'node:worker_threads';
import { RadianceWorkerHost } from './RadianceWorkerHost.js';
import type { WorkerInput } from './RadianceWorkerProtocol.js';

if (!parentPort) throw new Error('Century Radiance Node worker requires parentPort');
const port = parentPort;

const host = new RadianceWorkerHost({
  postMessage: (message, transfer = []) => port.postMessage(message, [...transfer] as ArrayBuffer[]),
  close: () => port.close(),
});

port.on('message', (message: WorkerInput) => host.receive(message));
