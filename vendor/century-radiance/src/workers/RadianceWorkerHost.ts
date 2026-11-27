import { RadianceError } from '../core/RadianceError.js';
import { processCommand } from './RadianceWorkerProcessor.js';
import type { WorkerInput, WorkerOutput } from './RadianceWorkerProtocol.js';

export interface WorkerHostPort {
  postMessage(message: WorkerOutput, transfer?: readonly Transferable[]): void;
  close(): void;
}

export class RadianceWorkerHost {
  private readonly active = new Map<number, AbortController>();
  private disposed = false;

  constructor(private readonly port: WorkerHostPort) {}

  receive(message: WorkerInput): void {
    if (message.kind === 'cancel') {
      this.active.get(message.requestId)?.abort();
      return;
    }
    if (message.kind === 'dispose') {
      this.dispose();
      return;
    }
    if (this.disposed) return;
    if (this.active.has(message.requestId)) {
      this.port.postMessage({
        kind: 'failure',
        requestId: message.requestId,
        error: { code: 'WORKER_FAILED', message: 'Duplicate worker request identifier' },
      });
      return;
    }
    const controller = new AbortController();
    this.active.set(message.requestId, controller);
    void processCommand(message.command, {
      signal: controller.signal,
      progress: (fraction) => this.port.postMessage({ kind: 'progress', requestId: message.requestId, fraction }),
    }).then(
      (result) => {
        if (!this.disposed) this.port.postMessage({ kind: 'success', requestId: message.requestId, result }, [result.buffer]);
      },
      (error: unknown) => {
        if (this.disposed) return;
        const cancelled = error instanceof RadianceError && error.code === 'WORKER_CANCELLED';
        this.port.postMessage({
          kind: 'failure',
          requestId: message.requestId,
          error: {
            code: cancelled ? 'WORKER_CANCELLED' : 'WORKER_FAILED',
            message: error instanceof Error ? error.message : String(error),
          },
        });
      },
    ).finally(() => this.active.delete(message.requestId));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const controller of this.active.values()) controller.abort();
    this.active.clear();
    this.port.close();
  }
}
