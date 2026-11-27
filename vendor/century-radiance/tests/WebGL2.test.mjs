import assert from 'node:assert/strict';
import test from 'node:test';
import { WebGL2Backend } from '../dist/index.js';

function createFakeGl() {
  let id = 0;
  let activeTexture = 0x84c0;
  let boundTexture = null;
  let boundFramebuffer = null;
  const deletedTextures = [];
  const deletedFramebuffers = [];
  const gl = {
    canvas: new EventTarget(),
    FRAMEBUFFER_BINDING: 0x8ca6,
    ACTIVE_TEXTURE: 0x84e0,
    TEXTURE_BINDING_2D: 0x8069,
    FRAMEBUFFER: 0x8d40,
    TEXTURE_2D: 0x0de1,
    TEXTURE0: 0x84c0,
    RGBA8: 0x8058,
    RGBA16F: 0x881a,
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    HALF_FLOAT: 0x140b,
    NEAREST: 0x2600,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    COLOR_ATTACHMENT0: 0x8ce0,
    FRAMEBUFFER_COMPLETE: 0x8cd5,
    RENDERER: 0x1f01,
    VENDOR: 0x1f00,
    VERSION: 0x1f02,
    SHADING_LANGUAGE_VERSION: 0x8b8c,
    MAX_TEXTURE_SIZE: 0x0d33,
    MAX_CUBE_MAP_TEXTURE_SIZE: 0x851c,
    MAX_DRAW_BUFFERS: 0x8824,
    MAX_COLOR_ATTACHMENTS: 0x8cdf,
    MAX_COMBINED_TEXTURE_IMAGE_UNITS: 0x8b4d,
    isContextLost: () => false,
    getExtension: (name) => name === 'EXT_color_buffer_float' ? {} : null,
    getParameter(parameter) {
      if (parameter === this.FRAMEBUFFER_BINDING) return boundFramebuffer;
      if (parameter === this.ACTIVE_TEXTURE) return activeTexture;
      if (parameter === this.TEXTURE_BINDING_2D) return boundTexture;
      if ([this.MAX_TEXTURE_SIZE, this.MAX_CUBE_MAP_TEXTURE_SIZE].includes(parameter)) return 4096;
      if ([this.MAX_DRAW_BUFFERS, this.MAX_COLOR_ATTACHMENTS].includes(parameter)) return 4;
      if (parameter === this.MAX_COMBINED_TEXTURE_IMAGE_UNITS) return 16;
      return 'fake';
    },
    activeTexture(value) { activeTexture = value; },
    bindTexture(_target, value) { boundTexture = value; },
    bindFramebuffer(_target, value) { boundFramebuffer = value; },
    createTexture: () => ({ kind: 'texture', id: ++id }),
    createFramebuffer: () => ({ kind: 'framebuffer', id: ++id }),
    deleteTexture: (value) => deletedTextures.push(value),
    deleteFramebuffer: (value) => deletedFramebuffers.push(value),
    texParameteri() {},
    texImage2D() {},
    framebufferTexture2D() {},
    checkFramebufferStatus: () => 0x8cd5,
  };
  return { gl, deletedTextures, deletedFramebuffers };
}

test('WebGL2 backend allocates, reports, resets, and releases owned resources', () => {
  const { gl, deletedTextures, deletedFramebuffers } = createFakeGl();
  const backend = new WebGL2Backend(gl);
  const caps = backend.initialize();
  assert.equal(caps.webgl2, true);
  assert.equal(caps.diagnosticHdrFormat, 'RGBA16F');
  assert.equal(backend.getDiagnostics().liveResources, 4);
  assert.equal(backend.getDiagnostics().framebufferChecks, 2);

  backend.reset();
  assert.equal(backend.getDiagnostics().liveResources, 0);
  assert.equal(deletedTextures.length, 2);
  assert.equal(deletedFramebuffers.length, 2);

  backend.initialize();
  backend.dispose();
  backend.dispose();
  assert.equal(backend.getDiagnostics().disposed, true);
  assert.equal(backend.getDiagnostics().liveResources, 0);
});
