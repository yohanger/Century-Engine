import { RadianceWorkerHost } from './RadianceWorkerHost.js';
import type { WorkerInput } from './RadianceWorkerProtocol.js';

interface BrowserWorkerScope {
  onmessage: ((event: MessageEvent<WorkerInput>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
  close(): void;
}

const workerScope = self as unknown as BrowserWorkerScope;
const host = new RadianceWorkerHost({
  postMessage: (message, transfer = []) => workerScope.postMessage(message, [...transfer]),
  close: () => workerScope.close(),
});

workerScope.onmessage = (event: MessageEvent<WorkerInput>) => host.receive(event.data);
