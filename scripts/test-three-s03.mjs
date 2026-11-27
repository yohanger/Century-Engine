// LF-THREE-S03-G001: regresión SSR sin depender de WebGL para las comprobaciones de contrato.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizeRender, RENDER_DEFAULTS, CLASSIC_RENDER, rendererPreset } from '../src/engine/runtime/render/config.js'
import { normalizeProfile, newProfile, applyProfile } from '../src/engine/runtime/render/profiles.js'
import { whenOk } from '../src/engine/runtime/events/model.js'

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const look = read('src/engine/runtime/render/look.js')
const ui = read('src/core/templates/renderParams.js')

// Ejecuta las funciones reales de LookPipeline con dependencias falsas: comprueba
// parámetros y ciclo de vida sin atribuir una prueba WebGL que no hemos realizado.
function method(name, deps = {}) {
  const start = look.indexOf(`  ${name}(`)
  assert.ok(start >= 0, `método ${name}`)
  const a = look.indexOf('{', start)
  let depth = 0, end = a
  for (; end < look.length; end++) {
    if (look[end] === '{') depth++
    if (look[end] === '}' && --depth === 0) break
  }
  // El cuerpo de las funciones utilizadas no tiene plantillas con llaves complejas.
  const args = look.slice(start + 2 + name.length + 1, look.indexOf(')', start))
  return Function(...Object.keys(deps), `return function(${args}) ${look.slice(a, end + 1)}`)(...Object.values(deps))
}

test('S03: proyectos antiguos tienen SSR desactivado, también modo clásico', () => {
  assert.equal(RENDER_DEFAULTS.ssr, false)
  assert.equal(CLASSIC_RENDER.ssr, false)
  assert.equal(normalizeRender(null).ssr, false)
  assert.equal(normalizeRender({ look: 'realista' }).ssr, false)
  assert.equal(rendererPreset('mobile').ssr, false)
  assert.equal(rendererPreset('compat').ssr, false)
})
test('S03: SSR es independiente de la intensidad IBL anterior', () => {
  const cfg = normalizeRender({ look: 'realista', reflections: 2.3, ssr: true, ssrStrength: 0.7 })
  assert.equal(cfg.reflections, 2.3)
  assert.equal(cfg.ssr, true)
  assert.equal(cfg.ssrStrength, 0.7)
})
test('S03: normalización limita intensidad, distancia y calidad inválida', () => {
  const cfg = normalizeRender({ look: 'realista', ssr: 1, ssrQuality: 'ilegal', ssrStrength: 500, ssrDistance: -3 })
  assert.equal(cfg.ssr, false)
  assert.equal(cfg.ssrQuality, 'media')
  assert.equal(cfg.ssrStrength, 1)
  assert.equal(cfg.ssrDistance, 0.1)
  assert.equal(normalizeRender({ look: 'realista', ssr: true, ssrDistance: 500 }).ssrDistance, 100)
})
test('S03: ajustes se muestran solo con efecto aplicable', () => {
  assert.match(ui, /'Reflejos SSR'/)
  assert.match(ui, /'Calidad SSR'/)
  const relevant = { look: 'realista', profile: 'alto', ssr: true }
  assert.equal(whenOk({ look: 'realista', profile: (v) => v !== 'bajo' }, relevant), true)
  assert.equal(whenOk({ look: 'realista', profile: (v) => v !== 'bajo' }, { ...relevant, profile: 'bajo' }), false)
  assert.equal(whenOk({ ssr: true, look: 'realista' }, { ...relevant, ssr: false }), false)
})
test('S03: perfiles de cámara pueden activar SSR sin modificar configuración base', () => {
  const base = normalizeRender({ look: 'realista', ssr: false })
  const p = newProfile('pr-ssr', 'Reflejos', base)
  p.fx.ssr.on = true
  p.fx.ssr.ssr = true
  p.fx.ssr.ssrStrength = 0.5
  const normal = normalizeProfile(p)
  const out = applyProfile(base, normal)
  assert.equal(out.ssr, true)
  assert.equal(out.ssrStrength, 0.5)
  assert.equal(base.ssr, false)
})
test('S03: modo sin compositor y perfil bajo no crean SSR', () => {
  class FakeSSR { constructor() { throw new Error('No se debe crear SSR') } }
  const add = method('_addSSR', { SSRPass: FakeSSR })
  for (const cfg of [{ ssr: false, look: 'realista' }, { ssr: true, look: 'clasico' }, { ssr: true, look: 'realista' }]) {
    const vp = { renderer: {}, scene: {}, camera: {} }
    const ctx = { cfg, vp, profile: cfg.look === 'realista' ? (cfg.ssr ? 'bajo' : 'alto') : 'alto' }
    add.call(ctx, { addPass() { throw new Error('No debía añadirse un pase') } })
  }
})
test('S03: SSRPass recibe renderer, escena y cámara existentes; no crea otro compositor', () => {
  const instances = []
  class SSR { constructor(opts) { this.opts = opts; instances.push(this) } }
  const add = method('_addSSR', { SSRPass: SSR })
  const vp = { renderer: { id: 'renderer' }, scene: { id: 'scene' }, camera: { id: 'camera' } }
  const composer = { passes: [], addPass(p) { this.passes.push(p) } }
  const ctx = { cfg: { ssr: true, look: 'realista' }, profile: 'alto', vp }
  add.call(ctx, composer)
  assert.equal(instances.length, 1)
  assert.strictEqual(instances[0].opts.renderer, vp.renderer)
  assert.strictEqual(instances[0].opts.scene, vp.scene)
  assert.strictEqual(instances[0].opts.camera, vp.camera)
  assert.equal(composer.passes[0], ctx.ssrPass)
  assert.equal(ctx.ssrPass.bouncing, false)
  assert.deepEqual(ctx.ssrPass.opts.selects, [])
})
test('S03: calidad SSR modifica solo los buffers internos del pase r170', () => {
  const resize = method('_resizeSSR')
  const sizes = []
  const p = { setSize(w, h) { sizes.push([w, h]) } }
  const ctx = { ssrPass: p, cfg: { ssrQuality: 'media', psx: false }, w: 640, h: 360, _pr: 1, composerA: null }
  resize.call(ctx)
  ctx.cfg.ssrQuality = 'baja'; resize.call(ctx)
  ctx.cfg.ssrQuality = 'alta'; resize.call(ctx)
  assert.deepEqual(sizes, [[480, 270], [320, 180], [640, 360]])
  ctx.composerA = {}; ctx.scale = 0.5; ctx.cfg.ssrQuality = 'media'
  resize.call(ctx)
  assert.deepEqual(sizes.at(-1), [240, 135])
})
test('S03: sincroniza la proyección al cambiar la cámara FPS', () => {
  const sync = method('_syncSSR')
  const mat = () => ({ id: '', copy(v) { this.id = v.id } })
  const val = (value) => ({ value })
  const pass = {
    selects: [],
    ssrMaterial: { uniforms: { cameraNear: val(0), cameraFar: val(0), cameraProjectionMatrix: val(mat()), cameraInverseProjectionMatrix: val(mat()) } },
    depthRenderMaterial: { uniforms: { cameraNear: val(0), cameraFar: val(0) } },
  }
  const cam = { near: 0.2, far: 500, projectionMatrix: { id: 'P' }, projectionMatrixInverse: { id: 'I' } }
  const std = { isMesh: true, material: { isMeshStandardMaterial: true, roughness: 0.2, metalness: 0 } }
  const basic = { isMesh: true, material: { isMeshBasicMaterial: true, roughness: 0, metalness: 1 } }
  const ctx = { ssrPass: pass, vp: { camera: cam, scene: { traverseVisible(fn) { fn(std); fn(basic) } } }, cfg: { ssrStrength: 0.6, ssrDistance: 20 } }
  sync.call(ctx)
  assert.strictEqual(pass.camera, cam)
  assert.deepEqual(pass.selects, [std])
  assert.equal(pass.opacity, 0.6)
  assert.equal(pass.maxDistance, 20)
  assert.equal(pass.ssrMaterial.uniforms.cameraProjectionMatrix.value.id, 'P')
  assert.equal(pass.ssrMaterial.uniforms.cameraInverseProjectionMatrix.value.id, 'I')
  assert.equal(pass.depthRenderMaterial.uniforms.cameraFar.value, 500)
})
test('S03: el pase se ubica antes de niebla, AO, view model y postproceso', () => {
  const one = look.slice(look.indexOf('  _buildSingle()'), look.indexOf('  _buildSplit()'))
  const split = look.slice(look.indexOf('  _buildSplit()'), look.indexOf('  _updateUniforms()'))
  for (const part of [one, split]) {
    assert.ok(part.indexOf('this._addSSR(') > part.indexOf('new CaptureDepthPass'))
    assert.ok(part.indexOf('this._addSSR(') < part.indexOf('new VolumetricPass'))
    assert.ok(part.indexOf('this._addSSR(') < part.indexOf('new GTAOPass'))
  }
  assert.match(look, /this\.ssrPass = null; this\.volPass = null/)
  assert.match(look, /for \(const p of c\.passes\) p\.dispose\?\.\(\)/)
})
test('S03: SSR no reemplaza IBL, WATER, Sky ni modifica biblioteca Three.js', () => {
  assert.match(look, /three\/examples\/jsm\/postprocessing\/SSRPass\.js/)
  assert.match(look, /this\.scene\.environmentIntensity|this\.ssrPass = null|_syncSSR/)
  const pkg = JSON.parse(read('package.json'))
  const lock = JSON.parse(read('package-lock.json'))
  // El test protege el contrato de dependencias sin fijar una revisión antigua.
  assert.equal(pkg.dependencies.three, lock.packages[''].dependencies.three)
  assert.match(lock.packages['node_modules/three'].version, /^0\.(?:170|180|186)\.\d+$/)
})
let SSRPass
try { ({ SSRPass } = await import('three/examples/jsm/postprocessing/SSRPass.js')) } catch (e) { if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e }
if (!SSRPass) test('S03: prueba dinámica del addon oficial requiere npm ci', { skip: true }, () => {})
else test('S03: constructor oficial exporta dispose y setSize', () => {
  assert.equal(typeof SSRPass.prototype.dispose, 'function')
  assert.equal(typeof SSRPass.prototype.setSize, 'function')
})
