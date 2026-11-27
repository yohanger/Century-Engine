export interface TransferDiagnosticCommand {
  readonly kind: 'transfer-diagnostic';
  readonly buffer: ArrayBuffer;
  readonly chunkBytes: number;
  readonly delayMs: number;
}

export type WorkerCommand = TransferDiagnosticCommand;

export type WorkerRequest = {
  readonly kind: 'request';
  readonly requestId: number;
  readonly command: WorkerCommand;
};

export type WorkerCancel = {
  readonly kind: 'cancel';
  readonly requestId: number;
};

export type WorkerDispose = { readonly kind: 'dispose' };
export type WorkerInput = WorkerRequest | WorkerCancel | WorkerDispose;

export type WorkerProgress = {
  readonly kind: 'progress';
  readonly requestId: number;
  readonly fraction: number;
};

export type WorkerSuccess = {
  readonly kind: 'success';
  readonly requestId: number;
  readonly result: {
    readonly buffer: ArrayBuffer;
    readonly checksum: number;
    readonly bytes: number;
  };
};

export type WorkerFailure = {
  readonly kind: 'failure';
  readonly requestId: number;
  readonly error: {
    readonly code: 'WORKER_CANCELLED' | 'WORKER_FAILED';
    readonly message: string;
  };
};

export type WorkerOutput = WorkerProgress | WorkerSuccess | WorkerFailure;
