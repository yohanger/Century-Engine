import { FluidConfig } from './config.js';
import { FluidError, requirePositive } from './error.js';
import { Vec3 } from './math.js';
import { ParticleStore } from './particles.js';
import type { ParticleChanges, ParticleInput, ParticleLimits, ParticleSnapshot, ParticleState } from './particles.js';
import { SpatialHash3D } from './spatial.js';
import { ChunkVoxelIndex } from './chunks.js';
import type { ChunkMass } from './chunks.js';
import {scheduleRegionalPhysics,subsetFrame,mergeWorkingSet} from './regional.js';
import {certifyHydrostaticFixedPoint} from './hydrostatic.js';
import type {RegionalPhysicsStats} from './regional.js';
import { LiquidSolverConfig, simulateLiquid } from './liquid.js';
import type { LiquidStepResult, ParticleScalarBalance, ParticleScalarModel } from './liquid.js';
import { BoundaryStore } from './boundaries.js';
import type { Boundary, BoundaryInput } from './boundaries.js';

export type WorldState = 'ready' | 'closed';

/** Validated proposal only; this does NOT advance fluid state. */
export interface StepPlan {
  readonly hostDtSeconds: number;
  readonly substeps: number;
  readonly substepDtSeconds: number;
}

/** Owns one particle state and a derived spatial index; no solver or renderer. */
export class FluidWorld {
  #configuration: FluidConfig;
  #state: WorldState = 'ready';
  readonly #particles: ParticleStore;
  readonly #spatial: SpatialHash3D;
  readonly #boundaries = new BoundaryStore();
  #liquidConfig: LiquidSolverConfig | null = null;
  #forceRegionalWake=false;
  #scalarModel: ParticleScalarModel | null = null;
  #scalarBalance: Readonly<ParticleScalarBalance> = Object.freeze({added:0,removed:0});
  // A cached diagnostic/reaction report, not a second physical state. Invalidated by
  // all user mutations, changing timesteps, or any moving boundary.
  #hydrostaticRest: {dtSeconds:number;report:LiquidStepResult;stats:RegionalPhysicsStats}|null=null;

  constructor(config: FluidConfig, limits: ParticleLimits = {}) {
    this.#configuration = FluidWorld.ensureConfig(config);
    this.#particles = new ParticleStore(limits);
    this.#spatial = new SpatialHash3D(this.#particles);
  }

  protected enableParticleScalar(model: ParticleScalarModel): void {
    this.#ensureReady();
    this.#particles.enableScalar();
    this.#scalarModel=model;
    this.#hydrostaticRest=null;
  }
  protected particleScalarSnapshot(): Float64Array | null {
    this.#ensureReady();
    return this.#particles.scalarSnapshot();
  }
  protected get scalarBalance(): Readonly<ParticleScalarBalance> {return this.#scalarBalance;}

  get state(): WorldState {
    return this.#state;
  }

  getConfig(): FluidConfig {
    this.#ensureReady();
    return this.#configuration;
  }

  setConfig(config: FluidConfig): void {
    this.#ensureReady();
    this.#configuration = FluidWorld.ensureConfig(config);
    this.#forceRegionalWake=true;
  }

  prepareStep(dtSeconds: number): StepPlan {
    this.#ensureReady();
    requirePositive(dtSeconds, 'dtSeconds');
    const maxDt = this.#configuration.maxSubstepSeconds;
    const required = Math.max(1, Math.ceil(dtSeconds / maxDt));
    if (required > this.#configuration.maxSubsteps) {
      throw new FluidError(
        'STEP_BUDGET_EXCEEDED',
        `timestep ${dtSeconds}s exceeds configured maximum ${maxDt * this.#configuration.maxSubsteps}s`,
        'dtSeconds',
      );
    }
    return Object.freeze({
      hostDtSeconds: dtSeconds,
      substeps: required,
      substepDtSeconds: dtSeconds / required,
    });
  }


  getLiquidConfig(): LiquidSolverConfig {
    this.#ensureReady();
    if (!this.#liquidConfig) throw new FluidError('INVALID_ARGUMENT', 'liquid solver not configured', 'liquidConfig');
    return this.#liquidConfig;
  }

  setLiquidConfig(config: LiquidSolverConfig): void {
    this.#ensureReady();
    if (!(config instanceof LiquidSolverConfig)) throw new FluidError('INVALID_ARGUMENT', 'expected validated LiquidSolverConfig', 'liquidConfig');
    this.#liquidConfig = config;
    this.#forceRegionalWake=true;
  }

  /** Integrates true particle kinematics using detached storage; commits atomically. */
  step(dtSeconds: number): LiquidStepResult {
    this.#ensureReady();
    this.prepareStep(dtSeconds);
    const liquidConfig = this.getLiquidConfig();
    // Preflight all boundary poses even when a certified fixed point is reused.
    const advancedBoundaries = this.#boundaries.previewAdvance(dtSeconds);
    const boundaries=this.#boundaries.snapshot();
    const cached=this.#hydrostaticRest;
    if(cached && !this.#forceRegionalWake && dtSeconds===cached.dtSeconds &&
       boundaries.every(b=>b.velocity.x===0&&b.velocity.y===0&&b.velocity.z===0&&
         b.angularVelocity.x===0&&b.angularVelocity.y===0&&b.angularVelocity.z===0)){
      // Same deterministic physical map and identical inputs: preserve the exact
      // boundary reaction impulse each host step (including Jolt coupling semantics).
      this.#boundaries.commitAdvance(advancedBoundaries);
      return cached.report;
    }
    const frame = this.#particles.snapshot();
    // Probe only already-motionless states on unmodified static boundaries.
    // Moving water (the normal tank case) incurs no extra frame copies.
    const canProbeHydrostatic=!this.#scalarModel&&!this.#forceRegionalWake && frame.count>0 &&
      boundaries.length>0 && frame.velocitiesXYZ.every(v=>v===0) &&
      (this.#configuration.gravityMS2.x!==0||this.#configuration.gravityMS2.y!==0||this.#configuration.gravityMS2.z!==0) &&
      boundaries.every(b=>b.velocity.x===0&&b.velocity.y===0&&b.velocity.z===0&&
        b.angularVelocity.x===0&&b.angularVelocity.y===0&&b.angularVelocity.z===0);
    const originalFrame=canProbeHydrostatic?{...frame,positionsXYZ:new Float64Array(frame.positionsXYZ),
      velocitiesXYZ:new Float64Array(frame.velocitiesXYZ.length)}:null;
    const plan=scheduleRegionalPhysics(frame,this.#configuration,liquidConfig,boundaries.length>0,this.#forceRegionalWake||this.#scalarModel!==null);
    let report:LiquidStepResult;
    if(plan.stats.mode==='rest'){
      const substeps=this.prepareStep(dtSeconds).substeps;
      report=Object.freeze({particleCount:frame.count,simulatedSeconds:dtSeconds,substeps,
        substepSeconds:dtSeconds/substeps,totalMassKg:frame.massesKg.reduce((a,b)=>a+b,0),
        densityIterations:0,divergenceIterations:0,maximumDensityCompressionRelative:plan.restingCompressionMax,
        meanDensityCompressionRelative:frame.count?plan.restingCompressionSum/frame.count:0,
        maximumDivergencePerSecond:0,convergence:'converged',boundaryContacts:0,
        maximumBoundaryPenetrationMeters:0,boundaryReactions:[],regional:plan.stats});
    }else if(plan.stats.mode==='partial'){
      const active=subsetFrame(frame,plan.activeIndices);
      const computed=simulateLiquid(active,dtSeconds,this.#configuration,liquidConfig,[]);
      mergeWorkingSet(frame,active,plan.activeIndices);
      report=Object.freeze({...computed,particleCount:frame.count,
        totalMassKg:frame.massesKg.reduce((a,b)=>a+b,0),
        maximumDensityCompressionRelative:Math.max(computed.maximumDensityCompressionRelative,plan.restingCompressionMax),
        meanDensityCompressionRelative:(computed.meanDensityCompressionRelative*active.count+plan.restingCompressionSum)/frame.count,
        regional:plan.stats});
      this.#particles.applyKinematics(frame.positionsXYZ,frame.velocitiesXYZ);
    }else{
      const scalar=this.#scalarModel ? {
        model:this.#scalarModel,values:this.#particles.scalarSnapshot()!,balance:{added:0,removed:0},
      } : undefined;
      report=Object.freeze({...simulateLiquid(frame,dtSeconds,this.#configuration,liquidConfig,boundaries,undefined,scalar),regional:plan.stats});
      this.#particles.applyKinematics(frame.positionsXYZ,frame.velocitiesXYZ,scalar?.values);
      if (scalar) this.#scalarBalance=Object.freeze(scalar.balance);
    }
    // Only FULL deterministic solutions can certify a gravity-supported fixed
    // point. A moving or merely low-speed tank is always simulated normally.
    let certified:RegionalPhysicsStats|null=null;
    if(plan.stats.mode==='full' && originalFrame){
      certified=certifyHydrostaticFixedPoint(originalFrame,frame,this.#configuration,
        liquidConfig,boundaries,report);
    }
    this.#boundaries.commitAdvance(advancedBoundaries);
    this.#hydrostaticRest=certified?{
      dtSeconds,stats:certified,
      report:Object.freeze({...report,densityIterations:0,divergenceIterations:0,regional:certified})
    }:null;
    this.#forceRegionalWake=false;
    return report;
  }

  get boundaryCount(): number { this.#ensureReady(); return this.#boundaries.count; }
  addBoundary(input: BoundaryInput): number { this.#ensureReady(); const id=this.#boundaries.add(input);this.#forceRegionalWake=true;return id; }
  getBoundary(id: number): Boundary { this.#ensureReady(); return this.#boundaries.get(id); }
  updateBoundary(id: number, input: BoundaryInput): void { this.#ensureReady(); this.#boundaries.update(id,input);this.#forceRegionalWake=true; }
  removeBoundary(id: number): void { this.#ensureReady(); this.#boundaries.remove(id);this.#forceRegionalWake=true; }
  clearBoundaries(): void { this.#ensureReady(); this.#boundaries.clear();this.#forceRegionalWake=true; }
  boundarySnapshot(): readonly Boundary[] { this.#ensureReady(); return this.#boundaries.snapshot(); }

  /** Derived, detached occupied chunks. Voxels report mass; only ParticleStore owns mass. */
  chunkMassSnapshot(voxelSizeMeters:number,cellsPerChunk=8):readonly ChunkMass[]{
    this.#ensureReady();
    const frame=this.#particles.snapshot();
    return new ChunkVoxelIndex(frame.positionsXYZ,frame.count,voxelSizeMeters,frame.massesKg,cellsPerChunk).snapshot();
  }

  get totalMassKg(): number {
    this.#ensureReady(); return this.#particles.totalMassKg();
  }

  emitParticles(inputs: readonly ParticleInput[]): readonly number[] {
    this.#ensureReady(); const ids=this.#particles.addMany(inputs);if(ids.length)this.#forceRegionalWake=true;return ids;
  }

  drainParticles(ids: readonly number[]): number {
    this.#ensureReady(); const mass=this.#particles.removeMany(ids);if(ids.length)this.#forceRegionalWake=true;return mass;
  }

  /** Apply equal/opposite host coupling impulses to particles; no hidden clock or Jolt dependency. */
  applyParticleImpulses(entries: readonly {readonly id:number;readonly impulseNs:Vec3}[]): void {
    this.#ensureReady();
    if (!Array.isArray(entries)) throw new FluidError('INVALID_ARGUMENT','impulses must be an array','impulses');
    const totals = new Map<number,Vec3>();
    for (const entry of entries) {
      if (!entry || !(entry.impulseNs instanceof Vec3))
        throw new FluidError('INVALID_ARGUMENT','expected validated impulse','impulseNs');
      const previous = totals.get(entry.id);
      totals.set(entry.id,previous ? Vec3.of(previous.x+entry.impulseNs.x,previous.y+entry.impulseNs.y,previous.z+entry.impulseNs.z) : entry.impulseNs);
    }
    const staged: {id:number;velocity:Vec3}[] = [];
    for (const [id, impulse] of totals) {
      const particle=this.#particles.get(id);
      const v=particle.velocity,m=particle.massKg;
      staged.push({id,velocity:Vec3.of(v.x+impulse.x/m,v.y+impulse.y/m,v.z+impulse.z/m)});
    }
    for (const p of staged) this.#particles.update(p.id,{velocity:p.velocity});if(staged.length)this.#forceRegionalWake=true;
  }

  get particleCount(): number {
    this.#ensureReady();
    return this.#particles.count;
  }

  addParticle(input: ParticleInput): number {
    this.#ensureReady();
    const id=this.#particles.add(input);this.#forceRegionalWake=true;return id;
  }

  getParticle(id: number): ParticleState {
    this.#ensureReady();
    return this.#particles.get(id);
  }

  hasParticle(id: number): boolean {
    this.#ensureReady();
    return this.#particles.has(id);
  }

  updateParticle(id: number, changes: ParticleChanges): void {
    this.#ensureReady();
    this.#particles.update(id, changes);this.#forceRegionalWake=true;
  }

  removeParticle(id: number): void {
    this.#ensureReady();
    this.#particles.remove(id);this.#forceRegionalWake=true;
  }

  clearParticles(): void {
    this.#ensureReady();
    this.#particles.clear();this.#forceRegionalWake=true;
    this.#spatial.invalidate();
  }

  particleSnapshot(): ParticleSnapshot {
    this.#ensureReady();
    return this.#particles.snapshot();
  }

  neighborsWithin(position: Vec3, radiusMeters: number): readonly number[] {
    this.#ensureReady();
    return this.#spatial.neighborsWithin(position, radiusMeters);
  }

  neighborsOf(id: number, radiusMeters: number): readonly number[] {
    this.#ensureReady();
    const position = this.#particles.positionOf(id);
    return this.#spatial.neighborsWithin(position, radiusMeters, id);
  }

  shutdown(): void {
    if (this.#state === 'closed') return;
    this.#hydrostaticRest=null;
    this.#particles.release();
    this.#boundaries.release();
    this.#spatial.invalidate();
    this.#state = 'closed';
  }

  #ensureReady(): void {
    if (this.#state === 'closed') {
      throw new FluidError('CLOSED', 'fluid world has been shut down');
    }
  }

  private static ensureConfig(config: FluidConfig): FluidConfig {
    if (!(config instanceof FluidConfig)) {
      throw new FluidError('INVALID_ARGUMENT', 'expected a validated FluidConfig', 'config');
    }
    return config;
  }
}
