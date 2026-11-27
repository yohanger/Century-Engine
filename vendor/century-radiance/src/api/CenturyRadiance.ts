import { asRadianceError, RadianceError } from '../core/RadianceError.js';
import type { WebGL2Capabilities } from '../core/RadianceCapabilities.js';
import type { RadianceLifecycleState } from '../core/RadianceLifecycle.js';
import type { RadianceBackend } from '../graphics/RadianceBackend.js';
import { RadianceWorkerClient } from '../workers/RadianceWorkerClient.js';
import type {
  CenturyRadianceOptions,
  TransferDiagnosticOptions,
  TransferDiagnosticResult,
} from './RadianceOptions.js';
import type { RadianceDiagnostics } from './RadianceDiagnostics.js';

export class CenturyRadiance {
  private state: RadianceLifecycleState = 'idle';
  private capabilities: WebGL2Capabilities | null = null;
  private generation = 0;
  private initializeCalls = 0;
  private resets = 0;
  private contextLosses = 0;
  private contextRestores = 0;
  private lastError: RadianceError | null = null;
  private worker: RadianceWorkerClient | null = null;
  private listenersAttached = false;
  private restoreWhenAvailable = false;
  private readonly recoverContext: boolean;

  constructor(
    private readonly backend: RadianceBackend,
    private readonly options: CenturyRadianceOptions = {},
  ) {
    this.recoverContext = options.recoverContext ?? true;
  }

  async initialize(): Promise<WebGL2Capabilities> {
    this.assertUsable();
    this.initializeCalls += 1;
    if (this.state === 'ready' && this.capabilities) return this.capabilities;
    if (this.state === 'context-lost') throw new RadianceError('CONTEXT_LOST', 'Cannot initialize while the WebGL2 context is lost');
    if (this.state === 'initializing') throw new RadianceError('INVALID_STATE', 'Century Radiance is already initializing');
    this.state = 'initializing';
    try {
      this.capabilities = this.backend.initialize();
      this.attachContextListeners();
      this.generation += 1;
      this.state = 'ready';
      this.lastError = null;
      return this.capabilities;
    } catch (error) {
      const radianceError = asRadianceError(error, 'BACKEND_INITIALIZATION_FAILED');
      this.state = radianceError.code === 'CONTEXT_LOST' ? 'context-lost' : 'idle';
      this.lastError = radianceError;
      throw radianceError;
    }
  }

  async reset(): Promise<void> {
    this.assertUsable();
    this.backend.reset();
    this.worker?.dispose();
    this.worker = null;
    this.capabilities = null;
    this.state = 'idle';
    this.resets += 1;
    this.lastError = null;
  }

  runWorkerDiagnostic(
    buffer: ArrayBuffer,
    options: TransferDiagnosticOptions = {},
  ): Promise<TransferDiagnosticResult> {
    if (this.state !== 'ready') {
      return Promise.reject(new RadianceError('INVALID_STATE', 'Century Radiance must be ready before running Worker diagnostics'));
    }
    if (!this.options.workerFactory) {
      return Promise.reject(new RadianceError('WORKER_UNAVAILABLE', 'No Worker factory was provided'));
    }
    this.worker ??= new RadianceWorkerClient(this.options.workerFactory());
    return this.worker.runTransferDiagnostic(buffer, options);
  }

  getDiagnostics(): RadianceDiagnostics {
    return Object.freeze({
      state: this.state,
      generation: this.generation,
      initializeCalls: this.initializeCalls,
      resets: this.resets,
      contextLosses: this.contextLosses,
      contextRestores: this.contextRestores,
      lastError: this.lastError ? { code: this.lastError.code, message: this.lastError.message } : null,
      capabilities: this.capabilities,
      backend: this.backend.getDiagnostics(),
      worker: this.worker?.getDiagnostics() ?? null,
    });
  }

  dispose(): void {
    if (this.state === 'disposed') return;
    this.detachContextListeners();
    this.worker?.dispose();
    this.worker = null;
    this.backend.dispose();
    this.capabilities = null;
    this.state = 'disposed';
  }

  private readonly handleContextLost = (event: Event): void => {
    if (this.state === 'disposed') return;
    if ('preventDefault' in event) event.preventDefault();
    this.restoreWhenAvailable = this.state === 'ready' || this.state === 'initializing';
    this.backend.contextLost();
    this.capabilities = null;
    this.state = 'context-lost';
    this.contextLosses += 1;
    this.lastError = new RadianceError('CONTEXT_LOST', 'WebGL2 context was lost');
  };

  private readonly handleContextRestored = (): void => {
    if (this.state === 'disposed') return;
    this.contextRestores += 1;
    this.state = 'idle';
    if (this.restoreWhenAvailable && this.recoverContext) void this.initialize().catch(() => undefined);
    this.restoreWhenAvailable = false;
  };

  private attachContextListeners(): void {
    if (this.listenersAttached) return;
    const target = this.backend.getContextEventTarget?.();
    if (!target) return;
    target.addEventListener('webglcontextlost', this.handleContextLost);
    target.addEventListener('webglcontextrestored', this.handleContextRestored);
    this.listenersAttached = true;
  }

  private detachContextListeners(): void {
    if (!this.listenersAttached) return;
    const target = this.backend.getContextEventTarget?.();
    target?.removeEventListener('webglcontextlost', this.handleContextLost);
    target?.removeEventListener('webglcontextrestored', this.handleContextRestored);
    this.listenersAttached = false;
  }

  private assertUsable(): void {
    if (this.state === 'disposed') throw new RadianceError('INVALID_STATE', 'Century Radiance is disposed');
  }
}
