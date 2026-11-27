import type { WebGL2Capabilities } from '../../core/RadianceCapabilities.js';
import type { WebGL2DiagnosticFormats } from './WebGL2Resources.js';

export function detectWebGL2Capabilities(
  gl: WebGL2RenderingContext,
  formats: WebGL2DiagnosticFormats,
): WebGL2Capabilities {
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  return Object.freeze({
    webgl2: true,
    renderer: String(debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)),
    vendor: String(debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR)),
    version: String(gl.getParameter(gl.VERSION)),
    shadingLanguageVersion: String(gl.getParameter(gl.SHADING_LANGUAGE_VERSION)),
    maxTextureSize: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)),
    maxCubeMapTextureSize: Number(gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE)),
    maxDrawBuffers: Number(gl.getParameter(gl.MAX_DRAW_BUFFERS)),
    maxColorAttachments: Number(gl.getParameter(gl.MAX_COLOR_ATTACHMENTS)),
    maxCombinedTextureImageUnits: Number(gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS)),
    colorBufferFloat: formats.colorBufferFloat,
    timerQuery: gl.getExtension('EXT_disjoint_timer_query_webgl2') !== null,
    offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
    diagnosticColorFormat: 'RGBA8',
    diagnosticHdrFormat: formats.hdr,
  });
}
