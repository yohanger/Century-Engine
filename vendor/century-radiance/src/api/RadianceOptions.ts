export interface WorkerEndpoint {
  postMessage(message: unknown, transfer?: readonly Transferable[]): void;
  addEventListener(type: 'message' | 'error' | 'messageerror', listener: EventListener): void;
  removeEventListener(type: 'message' | 'error' | 'messageerror', listener: EventListener): void;
  terminate(): void;
}

export type WorkerFactory = () => WorkerEndpoint;

export interface CenturyRadianceOptions {
  readonly workerFactory?: WorkerFactory;
  readonly recoverContext?: boolean;
}

export interface TransferDiagnosticOptions {
  readonly signal?: AbortSignal;
  readonly chunkBytes?: number;
  readonly delayMs?: number;
  readonly onProgress?: (fraction: number) => void;
}

export interface TransferDiagnosticResult {
  readonly buffer: ArrayBuffer;
  readonly checksum: number;
  readonly bytes: number;
}
