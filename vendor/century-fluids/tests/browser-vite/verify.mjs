/** Host-neutral Node/browser comparison; no test status is issued without this check. */
export function verifyParity(actual, expected) {
  for (const key of ['id', 'count', 'mass', 'convergence', 'y', 'vy']) {
    if (!(key in expected) || !(key in actual)) throw new Error(`Missing property: ${key}`);
    const a = actual[key];
    const b = expected[key];
    if (typeof a === 'number' && typeof b === 'number') {
      if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) > 1e-12) {
        throw new Error(`Node/browser mismatch for ${key}: browser=${a}, node=${b}`);
      }
    } else if (a !== b) {
      throw new Error(`Node/browser mismatch for ${key}: browser=${a}, node=${b}`);
    }
  }
}
