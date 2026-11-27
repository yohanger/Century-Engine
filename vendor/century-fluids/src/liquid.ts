import { FluidConfig } from './config.js';
import { FluidError, requireFinite, requirePositive } from './error.js';
import type { ParticleSnapshot } from './particles.js';
import { SpatialHash3D } from './spatial.js';
import type { Boundary } from './boundaries.js';
import type { BoundaryReaction } from './contacts.js';
import { createContactAccumulator, resolveContacts, projectSupportedContactVelocities, contactReport } from './contacts.js';

export interface LiquidSolverOptions {
  readonly supportRadiusMeters: number;
  readonly kinematicViscosityM2S: number;
  readonly maxDensityIterations: number;
  readonly maxDivergenceIterations: number;
  readonly densityToleranceRelative: number;
  readonly divergenceTolerancePerSecond: number;
  readonly cflFraction: number;
  /** Optional spherical contact radius for solid boundaries, default 0.1*h. */
  readonly particleContactRadiusMeters?: number;
}

/** Immutable, validated SI solver parameters; not a universal fluid preset. */
export class LiquidSolverConfig implements LiquidSolverOptions {
  readonly supportRadiusMeters: number;
  readonly kinematicViscosityM2S: number;
  readonly maxDensityIterations: number;
  readonly maxDivergenceIterations: number;
  readonly densityToleranceRelative: number;
  readonly divergenceTolerancePerSecond: number;
  readonly cflFraction: number;
  readonly particleContactRadiusMeters: number;

  private constructor(v: LiquidSolverOptions) {
    this.supportRadiusMeters = v.supportRadiusMeters;
    this.kinematicViscosityM2S = v.kinematicViscosityM2S;
    this.maxDensityIterations = v.maxDensityIterations;
    this.maxDivergenceIterations = v.maxDivergenceIterations;
    this.densityToleranceRelative = v.densityToleranceRelative;
    this.divergenceTolerancePerSecond = v.divergenceTolerancePerSecond;
    this.cflFraction = v.cflFraction;
    this.particleContactRadiusMeters = v.particleContactRadiusMeters ?? .1 * v.supportRadiusMeters;
    Object.freeze(this);
  }

  static create(v: LiquidSolverOptions): LiquidSolverConfig {
    if (v === null || typeof v !== 'object') throw new FluidError('INVALID_ARGUMENT', 'invalid liquid options', 'liquidOptions');
    requirePositive(v.supportRadiusMeters, 'supportRadiusMeters');
    requireFinite(v.kinematicViscosityM2S, 'kinematicViscosityM2S');
    if (v.kinematicViscosityM2S < 0) throw new FluidError('OUT_OF_RANGE', 'negative viscosity', 'kinematicViscosityM2S');
    for (const key of ['maxDensityIterations', 'maxDivergenceIterations'] as const) {
      if (!Number.isSafeInteger(v[key]) || v[key] < 1 || v[key] > 100) throw new FluidError('OUT_OF_RANGE', `invalid ${key}`, key);
    }
    for (const key of ['densityToleranceRelative', 'divergenceTolerancePerSecond'] as const) {
      requireFinite(v[key], key);
      if (v[key] < 0) throw new FluidError('OUT_OF_RANGE', `invalid ${key}`, key);
    }
    requirePositive(v.cflFraction, 'cflFraction');
    if (v.cflFraction > 1) throw new FluidError('OUT_OF_RANGE', 'cflFraction > 1', 'cflFraction');
    if (v.particleContactRadiusMeters !== undefined) {
      requirePositive(v.particleContactRadiusMeters, 'particleContactRadiusMeters');
      if (v.particleContactRadiusMeters > .5 * v.supportRadiusMeters)
        throw new FluidError('OUT_OF_RANGE', 'contact radius exceeds half support radius', 'particleContactRadiusMeters');
    }
    return new LiquidSolverConfig(v);
  }


}

export interface LiquidStepResult {
  readonly particleCount: number;
  readonly simulatedSeconds: number;
  readonly substeps: number;
  readonly substepSeconds: number;
  readonly totalMassKg: number;
  readonly densityIterations: number;
  readonly divergenceIterations: number;
  readonly maximumDensityCompressionRelative: number;
  readonly meanDensityCompressionRelative: number;
  readonly maximumDivergencePerSecond: number;
  readonly convergence: 'converged' | 'iteration_limit';
  readonly boundaryContacts: number;
  readonly maximumBoundaryPenetrationMeters: number;
  readonly boundaryReactions: readonly BoundaryReaction[];
  readonly regional?: import('./regional.js').RegionalPhysicsStats;
}

/** Numerical observations from one existing SPH substep, with no alternative solver.
 * All rates are positive compressive continuity residuals in 1/s. The density
 * projection's residual includes density compression / substepSeconds.
 * This type is an internal diagnostic contract; not part of the root package API.
 */
export interface ProjectionDiagnostics {
  readonly iterations: number;
  readonly converged: boolean;
  readonly residualHistoryPerSecond: readonly number[];
}
export interface LiquidSubstepDiagnostics {
  readonly substep: number;
  readonly pairsBeforeProjection: number;
  readonly pairsAfterContacts: number;
  readonly compressionBeforeRelative: number;
  readonly compressionAfterContactsRelative: number;
  readonly divergenceProjection: ProjectionDiagnostics;
  readonly densityProjection: ProjectionDiagnostics;
  readonly divergenceAfterProjectionPerSecond: number;
  readonly divergenceAfterContactsPerSecond: number;
  readonly contactsAdded: number;
  /** Residual after geometric contact integration and before joint velocity corrections. */
  readonly divergenceBeforeCouplingPerSecond: number;
  /** Executed alternate SPH/contact velocity iterations, including discarded trial iterations. */
  readonly boundaryCouplingPasses: number;
}

type Pair = { i: number; j: number; w: number; gx: number; gy: number; gz: number; g2: number };
/** Optional specialization transported on the same particles and substep. */
export interface ParticleScalarBalance {added: number; removed: number}
export interface ParticleScalarModel {
  advance(frame: ParticleSnapshot, neighbors: readonly {i:number;j:number}[],
    incomingVelocity: Float64Array, values: Float64Array, dt: number, config: FluidConfig,
    solver: LiquidSolverConfig): ParticleScalarBalance;
}
export interface ScalarScratch {
  readonly values: Float64Array;
  readonly model: ParticleScalarModel;
  readonly balance: ParticleScalarBalance;
}
const W0 = (h: number): number => 21 / (2 * Math.PI * h ** 3);

function pairsFor(frame: ParticleSnapshot, h: number): Pair[] {
  const p = frame.positionsXYZ, alpha = W0(h), pairs: Pair[] = [];
  SpatialHash3D.forEachFramePair(p, frame.count, h, (i, j) => {
    const a = i * 3, b = j * 3;
    const x = p[a]! - p[b]!, y = p[a + 1]! - p[b + 1]!, z = p[a + 2]! - p[b + 2]!;
    const r = Math.hypot(x, y, z), q = r / h;
    if (q >= 1) return;
    const u = 1 - q, grad = -20 * alpha / (h * h) * u ** 3;
    const gx = grad * x, gy = grad * y, gz = grad * z;
    pairs.push({ i, j, w: alpha * u ** 4 * (1 + 4 * q), gx, gy, gz,
      g2: gx * gx + gy * gy + gz * gz });
  });
  return pairs;
}

type Constraints = { density: Float64Array; compression: Float64Array; diagonal: Float64Array };
function constraints(frame: ParticleSnapshot, pairs: Pair[], rho0: number, h: number): Constraints {
  const n = frame.count, m = frame.massesKg;
  const density = new Float64Array(n), diagonal = new Float64Array(n), compression = new Float64Array(n);
  const selfWeight = W0(h);
  const gxSum = new Float64Array(n), gySum = new Float64Array(n), gzSum = new Float64Array(n);
  for (let i = 0; i < n; i++) density[i] = m[i]! * selfWeight;
  for (const { i, j, w, gx, gy, gz, g2 } of pairs) {
    const mi = m[i]!, mj = m[j]!, ai = mj / rho0, aj = mi / rho0;
    density[i] = density[i]! + mj * w; density[j] = density[j]! + mi * w;
    gxSum[i] = gxSum[i]! + ai * gx; gySum[i] = gySum[i]! + ai * gy; gzSum[i] = gzSum[i]! + ai * gz;
    gxSum[j] = gxSum[j]! - aj * gx; gySum[j] = gySum[j]! - aj * gy; gzSum[j] = gzSum[j]! - aj * gz;
    diagonal[i] = diagonal[i]! + mj * g2 / (rho0 * rho0);
    diagonal[j] = diagonal[j]! + mi * g2 / (rho0 * rho0);
  }
  for (let i = 0; i < n; i++) {
    diagonal[i] = diagonal[i]! + (gxSum[i]! ** 2 + gySum[i]! ** 2 + gzSum[i]! ** 2) / m[i]!;
    compression[i] = Math.max(0, density[i]! / rho0 - 1);
    if (!Number.isFinite(diagonal[i]) || !Number.isFinite(density[i])) {
      throw new FluidError('NON_FINITE', 'density or gradient overflow', 'solver');
    }
  }
  return { density, compression, diagonal };
}

/** Reuse the solver's exact SPH density kernel to certify stationary islands. */
export function restCompression(frame:ParticleSnapshot,rho0:number,h:number):Float64Array {
  return constraints(frame,pairsFor(frame,h),rho0,h).compression;
}
function rates(frame: ParticleSnapshot, pairs: Pair[], rho0: number): Float64Array {
  const out = new Float64Array(frame.count), v = frame.velocitiesXYZ, m = frame.massesKg;
  for (const { i, j, gx, gy, gz } of pairs) {
    const a = 3 * i, b = 3 * j;
    const dot = (v[a]! - v[b]!) * gx + (v[a + 1]! - v[b + 1]!) * gy + (v[a + 2]! - v[b + 2]!) * gz;
    out[i] = out[i]! + m[j]! * dot / rho0;
    out[j] = out[j]! + m[i]! * dot / rho0;
  }
  return out;
}

function maxPositive(v: Float64Array): number { let max = 0; for (const x of v) if (x > max) max = x; return max; }

/** Separate compressive density and divergence constraints; mass-weighted Jacobi projection. */
function project(frame: ParticleSnapshot, pairs: Pair[], c: Constraints, rho0: number,
                 dt: number, tolerance: number, iterations: number, mode: 'density' | 'divergence',
                 traceResiduals: number[] | null = null):
  { iterations: number; converged: boolean } {
  const m = frame.massesKg, v = frame.velocitiesXYZ;
  const lambda = new Float64Array(frame.count), impulseDelta = new Float64Array(v.length);
  for (let iteration = 0; iteration <= iterations; iteration++) {
    const dot = rates(frame, pairs, rho0);
    let residualMax = 0;
    for (let i = 0; i < frame.count; i++) {
      const residual = Math.max(0, (mode === 'density' ? c.compression[i]! / dt : 0) + dot[i]!);
      residualMax = Math.max(residualMax, residual);
      const diag = c.diagonal[i]!;
      lambda[i] = diag > 1e-18 ? -residual / diag : 0;
    }
    if (!Number.isFinite(residualMax)) throw new FluidError('NON_FINITE', 'continuity residual overflow', 'solver');
    if (traceResiduals) traceResiduals.push(residualMax);
    if (residualMax <= (mode === 'density' ? tolerance / dt : tolerance)) return { iterations: iteration, converged: true };
    if (iteration === iterations) break;
    impulseDelta.fill(0);
    for (const { i, j, gx, gy, gz } of pairs) {
      const impulse = (lambda[i]! * m[j]! + lambda[j]! * m[i]!) / rho0;
      const ai = impulse / m[i]!, aj = impulse / m[j]!;
      const a = 3 * i, b = 3 * j;
      impulseDelta[a] = impulseDelta[a]! + ai * gx;
      impulseDelta[a + 1] = impulseDelta[a + 1]! + ai * gy;
      impulseDelta[a + 2] = impulseDelta[a + 2]! + ai * gz;
      impulseDelta[b] = impulseDelta[b]! - aj * gx;
      impulseDelta[b + 1] = impulseDelta[b + 1]! - aj * gy;
      impulseDelta[b + 2] = impulseDelta[b + 2]! - aj * gz;
    }
    for (let k = 0; k < v.length; k++) v[k] = v[k]! + impulseDelta[k]!;
  }
  return { iterations, converged: false };
}

function viscosity(frame: ParticleSnapshot, pairs: Pair[], h: number, rho0: number, dt: number, nu: number): void {
  if (nu === 0) return;
  const p = frame.positionsXYZ, v = frame.velocitiesXYZ, m = frame.massesKg, change = new Float64Array(v.length);
  for (const { i, j, gx, gy, gz } of pairs) {
    const a = i * 3, b = j * 3;
    const dx = p[a]! - p[b]!, dy = p[a + 1]! - p[b + 1]!, dz = p[a + 2]! - p[b + 2]!;
    const f = -2 * nu * dt * (dx * gx + dy * gy + dz * gz) / ((dx * dx + dy * dy + dz * dz + .01 * h * h) * rho0);
    for (let k = 0; k < 3; k++) {
      const dv = v[b + k]! - v[a + k]!;
      change[a + k] = change[a + k]! + f * m[j]! * dv;
      change[b + k] = change[b + k]! - f * m[i]! * dv;
    }
  }
  for (let i = 0; i < v.length; i++) v[i] = v[i]! + change[i]!;
}

function maxSpeed(frame: ParticleSnapshot): number {
  const v = frame.velocitiesXYZ;
  let max = 0;
  for (let i = 0; i < frame.count; i++) max = Math.max(max, Math.hypot(v[i * 3]!, v[i * 3 + 1]!, v[i * 3 + 2]!));
  return max;
}
function finiteFrame(frame: ParticleSnapshot): void {
  for (const buffer of [frame.positionsXYZ, frame.velocitiesXYZ]) {
    for (const n of buffer) if (!Number.isFinite(n)) throw new FluidError('NON_FINITE', 'nonfinite solver frame', 'solver');
  }
}

/** Mutates detached scratch arrays only; FluidWorld applies a single atomic commit on success. */
export function simulateLiquid(frame: ParticleSnapshot, dt: number, physical: FluidConfig, s: LiquidSolverConfig,
  boundaries: readonly Boundary[] = [],
  onNumericalTrace?: (entry: LiquidSubstepDiagnostics) => void,
  scalar?: ScalarScratch): LiquidStepResult {
  requirePositive(dt, 'dtSeconds');
  const h = s.supportRadiusMeters;
  const g = physical.gravityMS2, gmag = Math.hypot(g.x, g.y, g.z);
  // Relative motion matters for moving solid contacts, not particle motion alone.
  const movingBoundaryMax = frame.count
    ? boundaries.reduce((max,b)=>{
      let speed = Math.hypot(b.velocity.x,b.velocity.y,b.velocity.z);
      if (b.kind==='box' && b.rotationCenter) {
        const arm = Math.hypot(b.center.x-b.rotationCenter.x,b.center.y-b.rotationCenter.y,b.center.z-b.rotationCenter.z);
        speed += (arm+Math.hypot(b.halfExtents.x,b.halfExtents.y,b.halfExtents.z)) *
          Math.hypot(b.angularVelocity.x,b.angularVelocity.y,b.angularVelocity.z);
      }
      return Math.max(max,speed);
    },0)
    : 0;
  const bound = maxSpeed(frame) + movingBoundaryMax + gmag * dt;
  const cflDt = bound > 0 ? s.cflFraction * h / bound : Number.POSITIVE_INFINITY;
  const viscDt = s.kinematicViscosityM2S > 0 ? .1 * h * h / s.kinematicViscosityM2S : Number.POSITIVE_INFINITY;
  const count = Math.max(1, Math.ceil(dt / Math.min(physical.maxSubstepSeconds, cflDt, viscDt)));
  if (!Number.isSafeInteger(count) || count > physical.maxSubsteps) {
    throw new FluidError('STEP_BUDGET_EXCEEDED', 'solver CFL or substep budget exceeded', 'dtSeconds');
  }
  const subDt = dt / count, mass = frame.massesKg.reduce((a, b) => a + b, 0);
  if (!Number.isFinite(mass)) throw new FluidError('NON_FINITE', 'mass overflow', 'massKg');
  let densityIterations = 0, divergenceIterations = 0, maxDivergence = 0;
  let convergence: LiquidStepResult['convergence'] = 'converged';
  const v = frame.velocitiesXYZ, p = frame.positionsXYZ;
  const contacts = createContactAccumulator(boundaries);
  let pairs = pairsFor(frame, h);
  let constraintsAtStart = constraints(frame, pairs, physical.restDensityKgM3, h);
  for (let step = 0; step < count; step++) {
    const divergenceHistory = onNumericalTrace ? [] as number[] : null;
    const densityHistory = onNumericalTrace ? [] as number[] : null;
    const contactsBefore = boundaries.length
      ? [...contacts.values()].reduce((sum, item) => sum + item.contacts, 0) : 0;
    for (let i = 0; i < frame.count; i++) {
      const k = i * 3;
      v[k] = v[k]! + g.x * subDt;
      v[k + 1] = v[k + 1]! + g.y * subDt;
      v[k + 2] = v[k + 2]! + g.z * subDt;
    }
    viscosity(frame, pairs, h, physical.restDensityKgM3, subDt, s.kinematicViscosityM2S);
    const incomingVelocity=scalar ? new Float64Array(v) : null;
    const div = project(frame, pairs, constraintsAtStart, physical.restDensityKgM3, subDt,
      s.divergenceTolerancePerSecond, s.maxDivergenceIterations, 'divergence', divergenceHistory);
    const den = project(frame, pairs, constraintsAtStart, physical.restDensityKgM3, subDt,
      s.densityToleranceRelative, s.maxDensityIterations, 'density', densityHistory);
    divergenceIterations += div.iterations; densityIterations += den.iterations;
    if (!div.converged || !den.converged) convergence = 'iteration_limit';
    maxDivergence = Math.max(maxDivergence, maxPositive(rates(frame, pairs, physical.restDensityKgM3)));
    if (maxSpeed(frame) * subDt > s.cflFraction * h * (1 + 1e-10)) {
      throw new FluidError('STEP_BUDGET_EXCEEDED', 'pressure-corrected velocity exceeds CFL displacement', 'dtSeconds');
    }
    const afterPressure = onNumericalTrace ? maxPositive(rates(frame,pairs,physical.restDensityKgM3)) : 0;
    if (boundaries.length) {
      resolveContacts(frame, boundaries, s.particleContactRadiusMeters, step * subDt, subDt, contacts);
    } else {
      for (let k = 0; k < p.length; k++) p[k] = p[k]! + v[k]! * subDt;
    }
    finiteFrame(frame);
    let boundaryCouplingPasses=0, divergenceBeforeCoupling=0;
    const contactedThisSubstep = boundaries.length &&
      [...contacts.values()].some(c=>c.contacts>contactsBefore);
    const endPairs = pairsFor(frame, h);
    const endConstraints = constraints(frame, endPairs, physical.restDensityKgM3, h);
    if(contactedThisSubstep && frame.count) {
      // Alternating constrained projections: preserve exact contact geometry and
      // report equal/opposite impulses on the SAME boundaries as resolveContacts.
      const residual = maxPositive(rates(frame, endPairs, physical.restDensityKgM3));
      if(onNumericalTrace)divergenceBeforeCoupling=residual;
      if(residual>s.divergenceTolerancePerSecond){
       const bestVelocity=new Float64Array(v);
       const savedReactions=new Map([...contacts].map(([id,c])=>[id,{...c}]));
       let bestResidual=residual,bestReactions=savedReactions;
       const staticBounds=boundaries.every(b=>b.velocity.x===0&&b.velocity.y===0&&b.velocity.z===0 &&
         b.angularVelocity.x===0&&b.angularVelocity.y===0&&b.angularVelocity.z===0);
       const kinetic=()=>{let total=0;for(let i=0;i<frame.count;i++){
         const k=3*i;total+=.5*frame.massesKg[i]!*(v[k]!**2+v[k+1]!**2+v[k+2]!**2);
       }return total;};
       const baselineKinetic=staticBounds?kinetic():0;
       for(let repeat=0;repeat<s.maxDivergenceIterations;repeat++){
         const candidate=project(frame,endPairs,endConstraints,physical.restDensityKgM3,subDt,
           s.divergenceTolerancePerSecond,1,'divergence');
         boundaryCouplingPasses++;
         divergenceIterations+=candidate.iterations;
         projectSupportedContactVelocities(frame,boundaries,s.particleContactRadiusMeters,
           (step+1)*subDt,contacts);
         const current=maxPositive(rates(frame,endPairs,physical.restDensityKgM3));
         if(!Number.isFinite(current))throw new FluidError('NON_FINITE','coupled contact residual overflow','solver');
         const allowedEnergy=!staticBounds||(
           kinetic()<=baselineKinetic*(1+256*Number.EPSILON));
         if(current>=bestResidual || !allowedEnergy)break;
         bestResidual=current;bestVelocity.set(v);
         bestReactions=new Map([...contacts].map(([id,c])=>[id,{...c}]));
         if(current<=s.divergenceTolerancePerSecond)break;
       }
       v.set(bestVelocity);
       for(const [id,c] of bestReactions)Object.assign(contacts.get(id)!,c);
      }
    }
    if (onNumericalTrace) {
      const contactsAfter = [...contacts.values()].reduce((sum, item) => sum + item.contacts, 0);
      onNumericalTrace(Object.freeze({
        substep:step,
        pairsBeforeProjection:pairs.length,
        pairsAfterContacts:endPairs.length,
        compressionBeforeRelative:maxPositive(constraintsAtStart.compression),
        compressionAfterContactsRelative:maxPositive(endConstraints.compression),
        divergenceProjection:Object.freeze({iterations:div.iterations,converged:div.converged,
          residualHistoryPerSecond:Object.freeze(divergenceHistory!)}),
        densityProjection:Object.freeze({iterations:den.iterations,converged:den.converged,
          residualHistoryPerSecond:Object.freeze(densityHistory!)}),
        divergenceAfterProjectionPerSecond:afterPressure,
        divergenceAfterContactsPerSecond:maxPositive(rates(frame,endPairs,physical.restDensityKgM3)),
        contactsAdded:contactsAfter-contactsBefore,
        divergenceBeforeCouplingPerSecond:divergenceBeforeCoupling,
        boundaryCouplingPasses,
      }));
    }
    if (scalar && incomingVelocity) {
      const balance=scalar.model.advance(frame,endPairs,incomingVelocity,scalar.values,subDt,physical,s);
      scalar.balance.added+=balance.added;
      scalar.balance.removed+=balance.removed;
    }
    // The joint projection only changed velocity. Its end-position neighbors
    // and density constraints are also valid at the start of the next substep.
    pairs = endPairs;
    constraintsAtStart = endConstraints;
  }
  const final = constraintsAtStart;
  let totalCompression = 0;
  for (const x of final.compression) totalCompression += x;
  const maxCompression = maxPositive(final.compression);
  maxDivergence = Math.max(maxDivergence, maxPositive(rates(frame, pairs, physical.restDensityKgM3)));
  if (maxCompression > s.densityToleranceRelative || maxDivergence > s.divergenceTolerancePerSecond) convergence = 'iteration_limit';
  const contactResult = contactReport(frame, boundaries, s.particleContactRadiusMeters, contacts, dt);
  return Object.freeze({ particleCount: frame.count, simulatedSeconds: dt, substeps: count,
    substepSeconds: subDt, totalMassKg: mass, densityIterations, divergenceIterations,
    maximumDensityCompressionRelative: maxCompression,
    meanDensityCompressionRelative: frame.count ? totalCompression / frame.count : 0,
    maximumDivergencePerSecond: maxDivergence, convergence,
    boundaryContacts: contactResult.contacts, maximumBoundaryPenetrationMeters: contactResult.maxPenetrationMeters,
    boundaryReactions: contactResult.reactions });
}
