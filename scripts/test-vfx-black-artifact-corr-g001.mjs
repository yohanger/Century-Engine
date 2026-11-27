import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { VfxSimulation } from '../src/engine/runtime/vfx/simulation.js'
import { newVfxResource, validateVfxResource } from '../src/engine/runtime/vfx/resource.js'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const vfxSource = read('src/engine/runtime/vfx/render.js')
const lookSource = read('src/engine/runtime/render/look.js')

class Geometry {
  attributes = {}
  setIndex() { return this }
  setAttribute(name, value) { this.attributes[name] = value; return this }
  getAttribute(name) { return this.attributes[name] }
  dispose() {}
}
class Attribute {
  constructor(array) { this.array = array }
  setUsage() { return this }
}
class Material {
  constructor(options) { Object.assign(this, options) }
  dispose() {}
}
class Mesh {
  constructor(geometry, material) { this.geometry = geometry; this.material = material; this.userData = {}; this.visible = true }
}
const THREE = {
  InstancedBufferGeometry: Geometry, Float32BufferAttribute: Attribute, InstancedBufferAttribute: Attribute,
  ShaderMaterial: Material, Mesh, DynamicDrawUsage: 1, AdditiveBlending: 2, NormalBlending: 3, DoubleSide: 4,
}
const isolated = vfxSource.replace(/^import .*\n/gm, '').replace('export class VfxBillboardRenderer', 'class VfxBillboardRenderer') + '\nVfxBillboardRenderer'
const VfxBillboardRenderer = vm.runInNewContext(isolated, { THREE, VfxSimulation })
const make = opacity => {
  const r = newVfxResource('qa-vfx-black', 'QaVfxBlack.vfx')
  const resource = validateVfxResource({ ...r,
    emission: { ...r.emission, mode: 'burst', burstCount: 1, rate: 0, capacity: 4, loop: false },
    birth: { ...r.birth, lifetime: [4, 4] },
    appearance: { ...r.appearance, opacity },
    evolution: { ...r.evolution, opacity: [{ t:0, value:1 }, { t:1, value:1 }] },
  })
  const sim = new VfxSimulation(resource)
  sim.step()
  return sim
}

// Verifica el comportamiento, no solo la presencia de una expresión en el código.
test('VBQ-01: partículas vivas y completamente transparentes no envían el quad al render', () => {
  const s = make(0), r = new VfxBillboardRenderer(s)
  assert.equal(s.count, 1)
  r.sync()
  assert.equal(r.mesh.visible, false)
  assert.equal(r.geometry.instanceCount, 1)
  r.dispose()
})
test('VBQ-02: partículas visibles siguen dibujándose y VFX no proyecta sombras', () => {
  const r = new VfxBillboardRenderer(make(0.6))
  r.sync()
  assert.equal(r.mesh.visible, true)
  assert.equal(r.mesh.userData.lfExcludeFromAO, true)
  assert.equal(r.mesh.castShadow, false)
  assert.equal(r.mesh.receiveShadow, false)
  r.dispose()
})
test('VBQ-03: alpha normal, shader genérico y texturas compartidas conservados', () => {
  for (const fragment of ['#ifdef VFX_HAS_MAP', 'alpha *= vOpacity', 'if (alpha <= 0.001) discard', 'depthWrite: false']) {
    assert.ok(vfxSource.includes(fragment), fragment)
  }
  assert.match(vfxSource, /this\.material\.uniforms\.uMap\.value = null/)
})
const start = lookSource.indexOf('  _excludeVfxFromAO(pass) {')
const end = lookSource.indexOf('  _buildSingle() {', start)
const method = lookSource.slice(start, end).trim()
const filter = vm.runInNewContext('({' + method + '})', {})
const scene = {
  objects: [],
  traverse(fn) { for (const object of this.objects) fn(object) },
}
const look = { vp: { scene } }

test('VBQ-04: GTAO r186 excluye VFX del G-buffer sin ocultar sólidos', () => {
  const fx = new VfxBillboardRenderer(make(1)); fx.sync()
  const solid = { visible: true, userData: {} }
  const invisibleFx = { visible: false, userData: { lfExcludeFromAO: true } }
  scene.objects = [solid, fx.mesh, invisibleFx]
  const pass = {
    _visibilityCache: [],
    _overrideVisibility() {
      for (const obj of scene.objects) {
        if (obj.isPoints && obj.visible) { obj.visible = false; this._visibilityCache.push(obj) }
      }
    },
    _restoreVisibility() {
      for (const obj of this._visibilityCache) obj.visible = true
      this._visibilityCache.length = 0
    },
  }
  filter._excludeVfxFromAO.call(look, pass)
  pass._overrideVisibility()
  assert.equal(fx.mesh.visible, false)
  assert.equal(solid.visible, true)
  assert.equal(invisibleFx.visible, false)
  assert.equal(pass._visibilityCache.length, 1)
  pass._restoreVisibility()
  assert.equal(fx.mesh.visible, true)
  assert.equal(solid.visible, true)
  assert.equal(invisibleFx.visible, false)
  assert.equal(pass._visibilityCache.length, 0)
  fx.dispose()
})
test('VBQ-08: oculta Points originales y VFX y los restaura sin duplicar', () => {
  const fx = new VfxBillboardRenderer(make(1)); fx.sync()
  const points = { visible: true, isPoints: true, userData: {} }
  const solid = { visible: true, userData: {} }
  scene.objects = [points, solid, fx.mesh]
  const pass = {
    _visibilityCache: [],
    _overrideVisibility() {
      for (const obj of scene.objects) if (obj.isPoints && obj.visible) {
        obj.visible = false; this._visibilityCache.push(obj)
      }
    },
    _restoreVisibility() {
      for (const obj of this._visibilityCache) obj.visible = true
      this._visibilityCache.length = 0
    },
  }
  filter._excludeVfxFromAO.call(look, pass)
  pass._overrideVisibility()
  assert.equal(points.visible, false)
  assert.equal(fx.mesh.visible, false)
  assert.equal(solid.visible, true)
  assert.equal(pass._visibilityCache.length, 2)
  pass._restoreVisibility()
  assert.equal(points.visible, true)
  assert.equal(fx.mesh.visible, true)
  assert.equal(pass._visibilityCache.length, 0)
  fx.dispose()
})
test('VBQ-09: una API GTAO incompatible no provoca el antiguo TypeError', () => {
  const warnings = []
  const legacy = vm.runInNewContext('({' + method + '})', { console: { warn: (...args) => warnings.push(args.join(' ')) } })
  const incompatible = { overrideVisibility() {} }
  legacy._excludeVfxFromAO.call(look, incompatible)
  assert.equal(typeof incompatible.overrideVisibility, 'function')
  assert.equal(warnings.length, 1)
})
test('VBQ-05: el filtro usa API r186 en ambos caminos sin desactivar GTAO', () => {
  assert.equal((lookSource.match(/this\._excludeVfxFromAO\(this\.aoPass\)/g) || []).length, 2)
  assert.match(lookSource, /new GTAOPass\(/)
  assert.match(method, /pass\._overrideVisibility\.bind\(pass\)/)
  assert.doesNotMatch(method, /pass\.overrideVisibility\.bind\(pass\)/)
  assert.match(lookSource, /composer\.addPass\(this\.aoPass\)/)
})
test('VBQ-06: render VFX independiente de lluvia y clima', () => {
  assert.doesNotMatch(vfxSource, /PrecipFX|CloudField|WeatherDirector/)
  assert.doesNotMatch(lookSource.slice(start, end), /PrecipFX|World|tornado/)
})
test('VBQ-07: hay una fixture GPU real con alfa cero y GTAO', () => {
  const fixture = read('scripts/fixtures/vfx/black-artifact.html')
  for (const needle of ['GTAOPass', 'WebGLRenderer', '_overrideVisibility()', '_restoreVisibility()', 'gl.getError()', 'opacity:0']) assert.ok(fixture.includes(needle), needle)
  const host = read('scripts/test-vfx-black-artifact-electron-g001.mjs')
  assert.match(host, /verifyWebGL/)
  assert.doesNotMatch(host, /spawnSync|chromium|brave/)
})
