import { RadianceError } from '../core/RadianceError.js';
import type { TransferDiagnosticCommand, WorkerCommand } from './RadianceWorkerProtocol.js';

export interface ProcessingContext {
  readonly signal: AbortSignal;
  readonly progress: (fraction: number) => void;
}

const yieldToQueue = (delayMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, delayMs));

export async function processCommand(
  command: WorkerCommand,
  context: ProcessingContext,
): Promise<{ buffer: ArrayBuffer; checksum: number; bytes: number }> {
  switch (command.kind) {
    case 'transfer-diagnostic':
      return processTransfer(command, context);
  }
}

async function processTransfer(
  command: TransferDiagnosticCommand,
  context: ProcessingContext,
): Promise<{ buffer: ArrayBuffer; checksum: number; bytes: number }> {
  const bytes = new Uint8Array(command.buffer);
  const chunkBytes = Math.max(1, Math.min(command.chunkBytes, 4 * 1024 * 1024));
  let checksum = 2166136261;
  for (let offset = 0; offset < bytes.length; offset += chunkBytes) {
    if (context.signal.aborted) {
      throw new RadianceError('WORKER_CANCELLED', 'Worker request was cancelled');
    }
    const end = Math.min(bytes.length, offset + chunkBytes);
    for (let index = offset; index < end; index += 1) {
      checksum ^= bytes[index] ?? 0;
      checksum = Math.imul(checksum, 16777619) >>> 0;
    }
    context.progress(bytes.length === 0 ? 1 : end / bytes.length);
    if (end < bytes.length) await yieldToQueue(command.delayMs);
  }
  if (bytes.length === 0) context.progress(1);
  return { buffer: command.buffer, checksum, bytes: bytes.byteLength };
}
