/** Public failure classifications. Codes, rather than message text, are stable. */
export type FluidErrorCode = 'INVALID_ARGUMENT' | 'NON_FINITE' | 'NON_POSITIVE' | 'OUT_OF_RANGE' | 'STEP_BUDGET_EXCEEDED' | 'CLOSED' | 'NOT_FOUND' | 'CAPACITY_EXCEEDED';
/** Boundary-validation or lifecycle failure; never used to mask solver errors. */
export declare class FluidError extends Error {
    readonly code: FluidErrorCode;
    readonly field: string | null;
    constructor(code: FluidErrorCode, message: string, field?: string | null);
}
export declare function requireFinite(value: number, field: string): void;
export declare function requirePositive(value: number, field: string): void;
//# sourceMappingURL=error.d.ts.map