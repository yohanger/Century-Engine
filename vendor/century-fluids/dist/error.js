/** Boundary-validation or lifecycle failure; never used to mask solver errors. */
export class FluidError extends Error {
    code;
    field;
    constructor(code, message, field = null) {
        super(message);
        this.name = 'FluidError';
        this.code = code;
        this.field = field;
    }
}
export function requireFinite(value, field) {
    if (!Number.isFinite(value)) {
        throw new FluidError('NON_FINITE', `${field} must be a finite number`, field);
    }
}
export function requirePositive(value, field) {
    requireFinite(value, field);
    if (value <= 0) {
        throw new FluidError('NON_POSITIVE', `${field} must be greater than zero`, field);
    }
}
//# sourceMappingURL=error.js.map