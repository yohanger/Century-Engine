import assert from 'node:assert/strict';
import test from 'node:test';
import { CenturyRadiance, RadianceError } from '../dist/index.js';

class FakeBackend {
  name = 'fake-webgl2';
  initialized = false;
  disposed = false;
  lost = false;
  allocations = 0;
  releases = 0;
  target = new EventTarget();

  initialize() {
    if (this.disposed) throw new RadianceError('INVALID_STATE', 'disposed');
    this.initialized = true;
    this.lost = false;
    this.allocations += 2;
    return Object.freeze({
      webgl2: true,
      renderer: 'test',
      vendor: 'test',
      version: 'WebGL 2.0',
      shadingLanguageVersion: 'WebGL GLSL ES 3.00',
      maxTextureSize: 4096,
      maxCubeMapTextureSize: 4096,
      maxDrawBuffers: 4,
      maxColorAttachments: 4,
      maxCombinedTextureImageUnits: 16,
      colorBufferFloat: true,
      timerQuery: true,
      offscreenCanvas: false,
      diagnosticColorFormat: 'RGBA8',
      diagnosticHdrFormat: 'RGBA16F',
    });
  }

  reset() {
    this.releases += this.initialized ? 2 : 0;
    this.initialized = false;
  }

  contextLost() {
    this.initialized = false;
    this.lost = true;
  }

  dispose() {
    this.reset();
    this.disposed = true;
  }

  getDiagnostics() {
    return {
      name: this.name,
      initialized: this.initialized,
      disposed: this.disposed,
      contextLost: this.lost,
      allocations: this.allocations,
      releases: this.releases,
      liveResources: this.initialized ? 2 : 0,
      framebufferChecks: this.initialized ? 1 : 0,
      framebufferFailures: 0,
    };
  }

  getContextEventTarget() {
    return this.target;
  }
}

test('lifecycle is idempotent, resettable, and disposable', async () => {
  const backend = new FakeBackend();
  const radiance = new CenturyRadiance(backend);
  const first = await radiance.initialize();
  const second = await radiance.initialize();
  assert.equal(first, second);
  assert.equal(radiance.getDiagnostics().generation, 1);
  assert.equal(radiance.getDiagnostics().initializeCalls, 2);

  await radiance.reset();
  assert.equal(radiance.getDiagnostics().state, 'idle');
  await radiance.initialize();
  assert.equal(radiance.getDiagnostics().generation, 2);

  radiance.dispose();
  radiance.dispose();
  assert.equal(radiance.getDiagnostics().state, 'disposed');
  assert.equal(backend.getDiagnostics().liveResources, 0);
  await assert.rejects(radiance.initialize(), (error) => error.code === 'INVALID_STATE');
});

test('context loss is observable and restoration reinitializes resources', async () => {
  const backend = new FakeBackend();
  const radiance = new CenturyRadiance(backend);
  await radiance.initialize();
  const lost = new Event('webglcontextlost', { cancelable: true });
  backend.target.dispatchEvent(lost);
  assert.equal(lost.defaultPrevented, true);
  assert.equal(radiance.getDiagnostics().state, 'context-lost');
  assert.equal(radiance.getDiagnostics().contextLosses, 1);

  backend.target.dispatchEvent(new Event('webglcontextrestored'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(radiance.getDiagnostics().state, 'ready');
  assert.equal(radiance.getDiagnostics().generation, 2);
  assert.equal(radiance.getDiagnostics().contextRestores, 1);
  radiance.dispose();
});
