import type { WebGL2Capabilities } from '../core/RadianceCapabilities.js';
import type { RadianceLifecycleState } from '../core/RadianceLifecycle.js';

export interface BackendDiagnostics {
  readonly name: string;
  readonly initialized: boolean;
  readonly disposed: boolean;
  readonly contextLost: boolean;
  readonly allocations: number;
  readonly releases: number;
  readonly liveResources: number;
  readonly framebufferChecks: number;
  readonly framebufferFailures: number;
}

export interface WorkerDiagnostics {
  readonly state: 'idle' | 'ready' | 'disposed';
  readonly started: number;
  readonly completed: number;
  readonly cancelled: number;
  readonly failed: number;
  readonly inFlight: number;
  readonly transferredBytes: number;
  readonly progressEvents: number;
}

export interface RadianceDiagnostics {
  readonly state: RadianceLifecycleState;
  readonly generation: number;
  readonly initializeCalls: number;
  readonly resets: number;
  readonly contextLosses: number;
  readonly contextRestores: number;
  readonly lastError: { readonly code: string; readonly message: string } | null;
  readonly capabilities: WebGL2Capabilities | null;
  readonly backend: BackendDiagnostics;
  readonly worker: WorkerDiagnostics | null;
}
