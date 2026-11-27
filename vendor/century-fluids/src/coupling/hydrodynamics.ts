import type { Vec3 } from '../math.js';
import type { Quat } from '../rotation.js';
import type { FluidWorld } from '../world.js';
/** Renderer/Jolt-independent shape and hydrodynamic coupling contract. */
export type CouplingShape = {readonly kind:'sphere';readonly radiusMeters:number} | {readonly kind:'box';readonly halfExtents:Vec3};
export interface HydroSample {
  readonly shape:CouplingShape;
  readonly position:Vec3;
  readonly rotation:Quat;
  readonly velocity:Vec3;
  readonly buoyancyScale:number;
  readonly linearDragKgPerSecond:number;
}
export interface HydroResult {
  readonly impulse:Vec3;
  readonly torque:Vec3;
  readonly fraction:number;
  readonly particleIds:readonly number[];
  readonly fluidImpulses:readonly {readonly id:number;readonly impulseNs:Vec3}[];
}
export interface HydrodynamicPolicy {
  evaluate(world:FluidWorld, sample:HydroSample, dtSeconds:number):HydroResult;
}
