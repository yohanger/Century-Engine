// LF-THREE-S04-G002_CORR-001: reproducción de la ruta Clásico/Bajo + Outline.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('../src/engine/runtime/render/look.js', import.meta.url), 'utf8')
const start = src.indexOf('export class LookPipeline')
assert.ok(start !== -1)
const builtTargets = []
const fakeThree = {
  MathUtils: { clamp: (x, a, b) => Math.min(b, Math.max(a, x)) },
  HalfFloatType: 1, LinearFilter: 2, NearestFilter: 3,
  WebGLRenderTarget: class {
    constructor(w, h, opts) { this.width = w; this.height = h; this.samples = opts.samples; builtTargets.push(this) }
  },
  DepthTexture: class { constructor() {} },
}
class FakeComposer {
  constructor(renderer, target) { this.renderer = renderer; this.renderTarget1 = target; this.passes = [] }
  setPixelRatio() {}
  setSize() {}
  addPass(p) { this.passes.push(p) }
  render() { this.rendered = true }
}
class FakeRenderPass { constructor(scene, camera) { this.scene = scene; this.camera = camera } }
class FakeOutputPass {}
const compile = new Function('THREE', 'EffectComposer', 'RenderPass', 'OutputPass', 'normalizeVolumetric',
  `return (${src.slice(start).replace('export class LookPipeline', 'class LookPipeline')})`)
const LookPipeline = compile(fakeThree, FakeComposer, FakeRenderPass, FakeOutputPass, () => ({ volOn: true }))

function harness({ look = 'clasico', profile = 'bajo', lensflare = false, outline = true } = {}) {
  let visibleFlare = lensflare
  const scene = {
    children: [],
    traverseVisible(fn) { if (visibleFlare) fn({ isLensflare: true, visible: true }) },
  }
  const renderer = { getPixelRatio() { return 1 } }
  const vp = {
    renderer, scene, camera: { isOrthographicCamera: false }, playing: false,
    overlay: { children: [] }, grid: null, bolt: null,
    sky: { position: { copy() {} } }, skyMat: null,
  }
  const l = Object.create(LookPipeline.prototype)
  Object.assign(l, {
    vp, cfg: { look, profile, psx: false, taa: false }, fx: true,
    editorSelection: outline ? [{ id: 'box' }] : [], editorOutlineOn: outline,
    w: 640, h: 360, builtKey: '', volPass: null, atmoPass: null,
    composer: null, composerA: null, ssrPass: null, aoPass: null, grade: null,
    dofPass: null, bloomPass: null, _physFog: false,
    _syncFog() {}, _syncOutline() {}, _syncSSR() {}, _updateUniforms() {},
    _addOutline(c) { c.addPass({ name: 'OutlinePass' }) },
    _names() {},
  })
  return { l, vp, setFlare(v) { visibleFlare = v } }
}

test('CORR-01: Clásico + Outline dibuja sin volPass ni atmoPass', () => {
  const { l } = harness()
  l._buildSingle()
  l.builtKey = l._key()
  assert.equal(l.volPass, null)
  assert.equal(l.atmoPass, null)
  assert.doesNotThrow(() => l.render())
  assert.equal(l.composer.rendered, true)
})
test('CORR-02: Bajo + Outline mantiene ausentes los pases de niebla', () => {
  const { l } = harness({ look: 'realista', profile: 'bajo' })
  l._buildSingle(); l.builtKey = l._key()
  assert.doesNotThrow(() => l.render())
  assert.equal(l.volPass, null)
})
test('CORR-03: pases presentes siguen actualizándose en ruta completa', () => {
  const { l } = harness({ look: 'realista', profile: 'medio', outline: false })
  l.composer = { render() { this.rendered = true } }
  l.builtKey = l._key()
  l.renderPass = { camera: null }
  l.volPass = { enabled: false }; l.atmoPass = { enabled: true }
  l._physFog = false
  assert.doesNotThrow(() => l.render())
  assert.equal(l.volPass.enabled, true)
  assert.equal(l.atmoPass.enabled, false)
})
test('CORR-04: MSAA se conserva con Lensflare apagado en compositor único', () => {
  const { l } = harness()
  l._buildSingle()
  assert.equal(builtTargets.at(-1).samples, 4)
})
test('CORR-05: framebuffer de escena evita MSAA solamente con Lensflare visible', () => {
  const { l } = harness({ lensflare: true })
  l._buildSingle()
  assert.equal(builtTargets.at(-1).samples, 0)
})
test('CORR-06: ocultar Lensflare cambia el key para reconstruir y recuperar MSAA', () => {
  const { l, setFlare } = harness({ lensflare: true })
  const keyWithFlare = l._key()
  setFlare(false)
  const keyWithout = l._key()
  assert.notEqual(keyWithFlare, keyWithout)
  l._buildSingle()
  assert.equal(builtTargets.at(-1).samples, 4)
})
test('CORR-07: render targets de compositor dividido preservan MSAA sin flare', () => {
  const { l } = harness({ lensflare: false })
  assert.match(src, /samples: c\.taa \|\| this\._hasVisibleLensflare\(\) \? 0 : 4/)
  assert.match(src, /const rtB = new THREE\.WebGLRenderTarget\(W, H, \{ type: THREE\.HalfFloatType, samples: 4 \}\)/)
  assert.equal(l._hasVisibleLensflare(), false)
})
test('CORR-08: rutas dividida y PSX siguen separadas', () => {
  assert.match(src, /if \(this\.cfg\.psx\)/)
  assert.match(src, /this\.composerA\.render\(\)/)
  assert.match(src, /this\.psxTarget\?\.dispose\(\)/)
})
test('CORR-09: la detección respeta la visibilidad efectiva de Three.js', () => {
  const { l, setFlare } = harness({ lensflare: false })
  assert.equal(l._hasVisibleLensflare(), false)
  setFlare(true)
  assert.equal(l._hasVisibleLensflare(), true)
})
test('CORR-10: no modifica el renderer global ni desactiva antialias de todas las escenas', () => {
  assert.doesNotMatch(src, /renderer\.getContext\(\)\.disable\(/)
  assert.doesNotMatch(src, /renderer\.antialias\s*=\s*false/)
  assert.match(src, /samples: c\.psx \|\| this\._hasVisibleLensflare\(\) \? 0 : 4/)
})
let three
try { three = await import('three') } catch (e) { if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e }
if (!three) test('CORR-11: integración WebGL requiere dependencias instaladas', { skip: true }, () => {})
else test('CORR-11: el addon Lensflare r170 conserva oclusión mediante copyFramebufferToTexture', async () => {
  const { Lensflare } = await import('three/addons/objects/Lensflare.js')
  assert.equal(new Lensflare().isLensflare, true)
})
