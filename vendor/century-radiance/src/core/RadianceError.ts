export type RadianceErrorCode =
  | 'INVALID_STATE'
  | 'CONTEXT_LOST'
  | 'BACKEND_INITIALIZATION_FAILED'
  | 'WORKER_UNAVAILABLE'
  | 'WORKER_CANCELLED'
  | 'WORKER_FAILED'
  | 'WORKER_DISPOSED'
  | 'INVALID_ARGUMENT';

export class RadianceError extends Error {
  readonly code: RadianceErrorCode;
  override readonly cause?: unknown;

  constructor(code: RadianceErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'RadianceError';
    this.code = code;
    if (cause !== undefined) this.cause = cause;
  }
}

export function asRadianceError(error: unknown, fallback: RadianceErrorCode): RadianceError {
  if (error instanceof RadianceError) return error;
  return new RadianceError(fallback, error instanceof Error ? error.message : String(error), error);
}
