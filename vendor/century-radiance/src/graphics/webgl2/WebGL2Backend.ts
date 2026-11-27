import type { BackendDiagnostics } from '../../api/RadianceDiagnostics.js';
import type { WebGL2Capabilities } from '../../core/RadianceCapabilities.js';
import { RadianceError } from '../../core/RadianceError.js';
import type { RadianceBackend } from '../RadianceBackend.js';
import { detectWebGL2Capabilities } from './WebGL2Capabilities.js';
import { WebGL2Resources } from './WebGL2Resources.js';

export class WebGL2Backend implements RadianceBackend {
  readonly name = 'webgl2';
  private readonly resources: WebGL2Resources;
  private capabilities: WebGL2Capabilities | null = null;
  private disposed = false;

  constructor(private readonly gl: WebGL2RenderingContext) {
    this.resources = new WebGL2Resources(gl);
  }

  initialize(): WebGL2Capabilities {
    if (this.disposed) throw new RadianceError('INVALID_STATE', 'WebGL2 backend is disposed');
    if (this.gl.isContextLost()) {
      this.resources.contextLost();
      throw new RadianceError('CONTEXT_LOST', 'WebGL2 context is lost');
    }
    if (this.capabilities) return this.capabilities;
    const formats = this.resources.initialize();
    this.capabilities = detectWebGL2Capabilities(this.gl, formats);
    return this.capabilities;
  }

  reset(): void {
    if (this.disposed) throw new RadianceError('INVALID_STATE', 'WebGL2 backend is disposed');
    this.resources.reset();
    this.capabilities = null;
  }

  contextLost(): void {
    if (this.disposed) return;
    this.resources.contextLost();
    this.capabilities = null;
  }

  dispose(): void {
    if (this.disposed) return;
    this.resources.dispose();
    this.capabilities = null;
    this.disposed = true;
  }

  getDiagnostics(): BackendDiagnostics {
    const state = this.resources.getState();
    return Object.freeze({
      name: this.name,
      initialized: this.capabilities !== null,
      disposed: this.disposed,
      contextLost: state.contextLost,
      allocations: state.allocations,
      releases: state.releases,
      liveResources: state.liveResources,
      framebufferChecks: state.framebufferChecks,
      framebufferFailures: state.framebufferFailures,
    });
  }

  getContextEventTarget(): EventTarget | null {
    return this.gl.canvas instanceof EventTarget ? this.gl.canvas : null;
  }
}
