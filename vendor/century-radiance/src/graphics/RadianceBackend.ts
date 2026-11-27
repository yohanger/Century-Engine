import type { BackendDiagnostics } from '../api/RadianceDiagnostics.js';
import type { WebGL2Capabilities } from '../core/RadianceCapabilities.js';

export interface RadianceBackend {
  readonly name: string;
  initialize(): WebGL2Capabilities;
  reset(): void;
  contextLost(): void;
  dispose(): void;
  getDiagnostics(): BackendDiagnostics;
  getContextEventTarget?(): EventTarget | null;
}
