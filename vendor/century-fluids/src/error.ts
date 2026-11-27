/** Public failure classifications. Codes, rather than message text, are stable. */
export type FluidErrorCode =
  | 'INVALID_ARGUMENT'
  | 'NON_FINITE'
  | 'NON_POSITIVE'
  | 'OUT_OF_RANGE'
  | 'STEP_BUDGET_EXCEEDED'
  | 'CLOSED'
  | 'NOT_FOUND'
  | 'CAPACITY_EXCEEDED';

/** Boundary-validation or lifecycle failure; never used to mask solver errors. */
export class FluidError extends Error {
  readonly code: FluidErrorCode;
  readonly field: string | null;

  constructor(code: FluidErrorCode, message: string, field: string | null = null) {
    super(message);
    this.name = 'FluidError';
    this.code = code;
    this.field = field;
  }
}

export function requireFinite(value: number, field: string): void {
  if (!Number.isFinite(value)) {
    throw new FluidError('NON_FINITE', `${field} must be a finite number`, field);
  }
}

export function requirePositive(value: number, field: string): void {
  requireFinite(value, field);
  if (value <= 0) {
    throw new FluidError('NON_POSITIVE', `${field} must be greater than zero`, field);
  }
}
