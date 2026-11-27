import type { Vec3 } from '../math.js';
import type { Quat } from '../rotation.js';
import type { VolumeImpulse, VoxelWorld } from './world.js';
export type CouplingShape = {readonly kind: 'sphere'; readonly radiusMeters: number} |
  {readonly kind: 'box'; readonly halfExtents: Vec3};

export interface VoxelHydroSample {
  readonly shape: CouplingShape;
  readonly position: Vec3;
  readonly rotation: Quat;
  readonly velocity: Vec3;
  readonly buoyancyScale: number;
  readonly linearDragKgPerSecond: number;
}

export interface VoxelHydroResult {
  readonly impulse: Vec3;
  readonly torque: Vec3;
  readonly fraction: number;
  readonly sampledCellCount: number;
  readonly reaction?: VolumeImpulse;
}

export interface VoxelHydrodynamicPolicy {
  evaluate(world: VoxelWorld, sample: VoxelHydroSample, dt: number): VoxelHydroResult;
}
