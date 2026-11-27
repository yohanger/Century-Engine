import { RadianceError } from '../../core/RadianceError.js';

interface DiagnosticTarget {
  readonly texture: WebGLTexture;
  readonly framebuffer: WebGLFramebuffer;
}

export interface WebGL2ResourceState {
  readonly contextLost: boolean;
  readonly allocations: number;
  readonly releases: number;
  readonly liveResources: number;
  readonly framebufferChecks: number;
  readonly framebufferFailures: number;
}

export interface WebGL2DiagnosticFormats {
  readonly colorBufferFloat: boolean;
  readonly hdr: 'RGBA16F' | null;
}

export class WebGL2Resources {
  private colorTarget: DiagnosticTarget | null = null;
  private hdrTarget: DiagnosticTarget | null = null;
  private lost = false;
  private allocations = 0;
  private releases = 0;
  private framebufferChecks = 0;
  private framebufferFailures = 0;

  constructor(private readonly gl: WebGL2RenderingContext) {}

  initialize(): WebGL2DiagnosticFormats {
    const previousFramebuffer = this.gl.getParameter(this.gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
    const previousActiveTexture = this.gl.getParameter(this.gl.ACTIVE_TEXTURE) as number;
    this.gl.activeTexture(this.gl.TEXTURE0);
    const previousTexture = this.gl.getParameter(this.gl.TEXTURE_BINDING_2D) as WebGLTexture | null;
    let colorTarget: DiagnosticTarget | null = null;
    let hdrTarget: DiagnosticTarget | null = null;
    try {
      colorTarget = this.createTarget(this.gl.RGBA8, this.gl.RGBA, this.gl.UNSIGNED_BYTE);
      const colorBufferFloat = this.gl.getExtension('EXT_color_buffer_float') !== null;
      if (colorBufferFloat) {
        try {
          hdrTarget = this.createTarget(this.gl.RGBA16F, this.gl.RGBA, this.gl.HALF_FLOAT);
        } catch {
          hdrTarget = null;
        }
      }
      this.colorTarget = colorTarget;
      this.hdrTarget = hdrTarget;
      this.lost = false;
      return { colorBufferFloat, hdr: hdrTarget ? 'RGBA16F' : null };
    } catch (error) {
      this.deleteTarget(colorTarget);
      this.deleteTarget(hdrTarget);
      throw error instanceof RadianceError
        ? error
        : new RadianceError('BACKEND_INITIALIZATION_FAILED', 'WebGL2 diagnostic resource initialization failed', error);
    } finally {
      this.gl.bindTexture(this.gl.TEXTURE_2D, previousTexture);
      this.gl.activeTexture(previousActiveTexture);
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, previousFramebuffer);
    }
  }

  reset(): void {
    this.releaseTargets();
  }

  contextLost(): void {
    this.colorTarget = null;
    this.hdrTarget = null;
    this.lost = true;
  }

  dispose(): void {
    this.releaseTargets();
  }

  getState(): WebGL2ResourceState {
    return Object.freeze({
      contextLost: this.lost,
      allocations: this.allocations,
      releases: this.releases,
      liveResources: (this.colorTarget ? 2 : 0) + (this.hdrTarget ? 2 : 0),
      framebufferChecks: this.framebufferChecks,
      framebufferFailures: this.framebufferFailures,
    });
  }

  private createTarget(internalFormat: number, format: number, type: number): DiagnosticTarget {
    const texture = this.gl.createTexture();
    const framebuffer = this.gl.createFramebuffer();
    if (!texture || !framebuffer) {
      if (texture) this.gl.deleteTexture(texture);
      if (framebuffer) this.gl.deleteFramebuffer(framebuffer);
      throw new RadianceError('BACKEND_INITIALIZATION_FAILED', 'WebGL2 could not allocate diagnostic resources');
    }
    this.allocations += 2;
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, internalFormat, 1, 1, 0, format, type, null);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
    this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, texture, 0);
    this.framebufferChecks += 1;
    if (this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER) !== this.gl.FRAMEBUFFER_COMPLETE) {
      this.framebufferFailures += 1;
      this.gl.deleteFramebuffer(framebuffer);
      this.gl.deleteTexture(texture);
      this.releases += 2;
      throw new RadianceError('BACKEND_INITIALIZATION_FAILED', 'WebGL2 diagnostic framebuffer is incomplete');
    }
    return { texture, framebuffer };
  }

  private releaseTargets(): void {
    if (this.lost || this.gl.isContextLost()) {
      this.colorTarget = null;
      this.hdrTarget = null;
      return;
    }
    this.deleteTarget(this.colorTarget);
    this.deleteTarget(this.hdrTarget);
    this.colorTarget = null;
    this.hdrTarget = null;
  }

  private deleteTarget(target: DiagnosticTarget | null): void {
    if (!target) return;
    this.gl.deleteFramebuffer(target.framebuffer);
    this.gl.deleteTexture(target.texture);
    this.releases += 2;
  }
}
