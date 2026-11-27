import { RadianceError } from '../core/RadianceError.js';
import type { WorkerDiagnostics } from '../api/RadianceDiagnostics.js';
import type {
  TransferDiagnosticOptions,
  TransferDiagnosticResult,
  WorkerEndpoint,
} from '../api/RadianceOptions.js';
import type { WorkerInput, WorkerOutput } from './RadianceWorkerProtocol.js';

interface PendingRequest {
  resolve: (result: TransferDiagnosticResult) => void;
  reject: (error: RadianceError) => void;
  onProgress: ((fraction: number) => void) | undefined;
  signal: AbortSignal | undefined;
  abort: (() => void) | undefined;
}

export class RadianceWorkerClient {
  private readonly pending = new Map<number, PendingRequest>();
  private nextRequestId = 1;
  private disposed = false;
  private started = 0;
  private completed = 0;
  private cancelled = 0;
  private failed = 0;
  private transferredBytes = 0;
  private progressEvents = 0;

  private readonly onMessage = (event: Event): void => {
    const message = (event as MessageEvent<WorkerOutput>).data;
    const pending = this.pending.get(message.requestId);
    if (!pending) return;
    if (message.kind === 'progress') {
      this.progressEvents += 1;
      pending.onProgress?.(message.fraction);
      return;
    }
    this.releasePending(message.requestId, pending);
    if (message.kind === 'success') {
      this.completed += 1;
      pending.resolve(message.result);
      return;
    }
    if (message.error.code === 'WORKER_CANCELLED') {
      this.cancelled += 1;
      pending.reject(new RadianceError('WORKER_CANCELLED', message.error.message));
    } else {
      this.failed += 1;
      pending.reject(new RadianceError('WORKER_FAILED', message.error.message));
    }
  };

  private readonly onFailure = (event: Event): void => {
    const error = new RadianceError('WORKER_FAILED', event instanceof ErrorEvent ? event.message : 'Worker channel failed');
    this.failed += this.pending.size;
    for (const [requestId, pending] of this.pending) {
      this.releasePending(requestId, pending);
      pending.reject(error);
    }
  };

  constructor(private readonly worker: WorkerEndpoint) {
    worker.addEventListener('message', this.onMessage as EventListener);
    worker.addEventListener('error', this.onFailure as EventListener);
    worker.addEventListener('messageerror', this.onFailure as EventListener);
  }

  runTransferDiagnostic(
    buffer: ArrayBuffer,
    options: TransferDiagnosticOptions = {},
  ): Promise<TransferDiagnosticResult> {
    if (this.disposed) return Promise.reject(new RadianceError('WORKER_DISPOSED', 'Worker client is disposed'));
    if (options.signal?.aborted) return Promise.reject(new RadianceError('WORKER_CANCELLED', 'Worker request was cancelled'));
    if (buffer.byteLength === 0) {
      return Promise.reject(new RadianceError('INVALID_ARGUMENT', 'Transfer diagnostic requires a non-empty buffer'));
    }
    const requestId = this.nextRequestId;
    this.nextRequestId += 1;
    this.started += 1;
    this.transferredBytes += buffer.byteLength;
    return new Promise((resolve, reject) => {
      const abort = options.signal
        ? () => this.worker.postMessage({ kind: 'cancel', requestId } satisfies WorkerInput)
        : undefined;
      const pending: PendingRequest = {
        resolve,
        reject,
        onProgress: options.onProgress,
        signal: options.signal,
        abort,
      };
      this.pending.set(requestId, pending);
      if (abort) options.signal?.addEventListener('abort', abort, { once: true });
      try {
        this.worker.postMessage({
          kind: 'request',
          requestId,
          command: {
            kind: 'transfer-diagnostic',
            buffer,
            chunkBytes: options.chunkBytes ?? 64 * 1024,
            delayMs: options.delayMs ?? 0,
          },
        } satisfies WorkerInput, [buffer]);
      } catch (error) {
        this.releasePending(requestId, pending);
        this.failed += 1;
        reject(new RadianceError('WORKER_FAILED', 'Worker request could not be posted', error));
      }
    });
  }

  getDiagnostics(): WorkerDiagnostics {
    return Object.freeze({
      state: this.disposed ? 'disposed' : this.started === 0 ? 'idle' : 'ready',
      started: this.started,
      completed: this.completed,
      cancelled: this.cancelled,
      failed: this.failed,
      inFlight: this.pending.size,
      transferredBytes: this.transferredBytes,
      progressEvents: this.progressEvents,
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.worker.removeEventListener('message', this.onMessage as EventListener);
    this.worker.removeEventListener('error', this.onFailure as EventListener);
    this.worker.removeEventListener('messageerror', this.onFailure as EventListener);
    try {
      this.worker.postMessage({ kind: 'dispose' } satisfies WorkerInput);
    } catch {
      // Termination below remains authoritative when the channel already failed.
    }
    this.worker.terminate();
    for (const [requestId, pending] of this.pending) {
      this.releasePending(requestId, pending);
      pending.reject(new RadianceError('WORKER_DISPOSED', 'Worker client was disposed'));
    }
  }

  private releasePending(requestId: number, pending: PendingRequest): void {
    this.pending.delete(requestId);
    if (pending.abort) pending.signal?.removeEventListener('abort', pending.abort);
  }
}
