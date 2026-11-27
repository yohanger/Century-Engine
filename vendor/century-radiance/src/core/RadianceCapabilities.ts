export interface WebGL2Capabilities {
  readonly webgl2: true;
  readonly renderer: string;
  readonly vendor: string;
  readonly version: string;
  readonly shadingLanguageVersion: string;
  readonly maxTextureSize: number;
  readonly maxCubeMapTextureSize: number;
  readonly maxDrawBuffers: number;
  readonly maxColorAttachments: number;
  readonly maxCombinedTextureImageUnits: number;
  readonly colorBufferFloat: boolean;
  readonly timerQuery: boolean;
  readonly offscreenCanvas: boolean;
  readonly diagnosticColorFormat: 'RGBA8';
  readonly diagnosticHdrFormat: 'RGBA16F' | null;
}
