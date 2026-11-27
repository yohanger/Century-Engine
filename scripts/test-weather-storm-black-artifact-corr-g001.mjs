import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const fxSource = read('src/engine/runtime/world/fx.js')
const lookSource = read('src/engine/runtime/render/look.js')

class Attribute {
  constructor(array, size) { this.array = array; this.itemSize = size; this.needsUpdate = false }
  setUsage() { return this }
}
class Geometry {
  attributes = {}
  instanceCount = 0
  setAttribute(name, attr) { this.attributes[name] = attr; return this }
  getAttribute(name) { return this.attributes[name] }
  setIndex() { return this }
  setDrawRange(start, count) { this.drawRange = { start, count } }
  dispose() { this.disposed = true }
}
class Vector3 {
  constructor(x=0,y=0,z=0) { this.x=x; this.y=y; this.z=z }
  copy(o) { this.x=o.x;this.y=o.y;this.z=o.z;return this }
  set(x,y,z) { this.x=x;this.y=y;this.z=z;return this }
  normalize() { return this }
}
class Color {
  constructor(value, green, blue) { this.value=value;this.green=green;this.blue=blue }
  lerp() { return this }
  copy() { return this }
  multiplyScalar() { return this }
  set() { return this }
}
class Material {
  constructor(config) { Object.assign(this, config) }
  dispose() { this.disposed = true }
}
class Mesh {
  constructor(geometry,material) { this.geometry=geometry;this.material=material;this.userData={};this.visible=true;this.isMesh=true }
}
class Points extends Mesh { constructor(...args) { super(...args);this.isPoints=true;this.isMesh=false } }
const THREE = {
  Vector3, Color, BufferGeometry:Geometry, InstancedBufferGeometry:Geometry,
  Float32BufferAttribute:Attribute, BufferAttribute:Attribute, InstancedBufferAttribute:Attribute,
  Mesh, Points, ShaderMaterial:Material, DoubleSide:2, DynamicDrawUsage:35048,
}
const isolatedFx = fxSource.replace(/^import .*\n/gm, '').replace('export class PrecipFX', 'class PrecipFX') + '\nPrecipFX'
const PrecipFX = vm.runInNewContext(isolatedFx, { THREE, rainPoint: () => [0,0,0], traceRainSegment: () => null })
const methodStart = lookSource.indexOf('  _excludeVfxFromAO(pass) {')
const methodEnd = lookSource.indexOf('  _buildSingle() {', methodStart)
assert.ok(methodStart > 0 && methodEnd > methodStart, 'Método GTAO real existente')
const method = vm.runInNewContext('({' + lookSource.slice(methodStart,methodEnd) + '})', {})
const frame = (rain=0,snow=0) => ({ precip: { rain,snow }, ambientMul:1, skyHorizon:'#aabbaa',wind:{x:0,z:0} })
const camera = { position: new Vector3(0,1.6,4), fov:70 }
const make = () => {
  const scene = { objects: [], add(o) {this.objects.push(o);o.parent=this}, traverse(fn) { for(const o of this.objects)fn(o) } }
  const fx=new PrecipFX(scene)
  const solid={isMesh:true,visible:true,userData:{},material:{transparent:false}}
  scene.add(solid)
  return {scene,fx,solid}
}
const gtao = scene => {
  const pass = {
    _visibilityCache:[],
    _overrideVisibility() { for(const o of scene.objects) if((o.isPoints || o.isLine) && o.visible) {
      o.visible=false;this._visibilityCache.push(o)
    } },
    _restoreVisibility() { for(const o of this._visibilityCache)o.visible=true;this._visibilityCache.length=0 },
  }
  method._excludeVfxFromAO.call({vp:{scene}},pass)
  return pass
}

test('STORM-01 · la precipitación conserva exactamente sus geometrías y capacidades GPU', () => {
  const {fx}=make()
  assert.equal(fx.rain.geometry.getAttribute('aSeed').array.length,7000*4)
  assert.equal(fx.mist.geometry.getAttribute('aSeed').array.length,1800*4)
  assert.equal(fx.snow.geometry.getAttribute('aSeed').array.length,7000*4)
  assert.equal(fx.splash.geometry.getAttribute('aSplash').array.length,520*4)
})
test('STORM-02 · lluvia, bruma y salpicaduras transparentes no se consideran sólidos GTAO', () => {
  const {fx}=make()
  for(const mesh of [fx.rain,fx.mist,fx.splash]) {
    assert.equal(mesh.userData.lfExcludeFromAO,true)
    assert.equal(mesh.material.transparent,true)
    assert.equal(mesh.material.depthWrite,false)
  }
  assert.equal(fx.snow.isPoints,true)
})
test('STORM-03 · Despejado no dibuja gotas ni bruma ni salpicaduras', () => {
  const {fx}=make()
  assert.equal(fx.update(frame(),camera,0.016),false)
  assert.equal(fx.rain.visible,false);assert.equal(fx.mist.visible,false);assert.equal(fx.splash.visible,false)
})
test('STORM-04 · Llovizna mantiene gotas y bruma activas y cantidad instanciada', () => {
  const {fx}=make()
  fx.update(frame(0.2),camera,0.016)
  assert.equal(fx.rain.visible,true);assert.equal(fx.mist.visible,true)
  assert.equal(fx.rain.geometry.instanceCount,1400)
  assert.equal(fx.mist.geometry.instanceCount,360)
})
test('STORM-05 · nieve sigue siendo Points y usa exclusión nativa de GTAO', () => {
  const {fx}=make()
  fx.update(frame(0,0.75),camera,0.016)
  assert.equal(fx.snow.visible,true)
  assert.equal(fx.rain.visible,false)
  const pass=gtao({objects:[fx.snow],traverse(fn){for(const o of this.objects)fn(o)}})
  pass._overrideVisibility();assert.equal(fx.snow.visible,false)
  pass._restoreVisibility();assert.equal(fx.snow.visible,true)
})
test('STORM-06 · GTAO oculta precipitación activa, conserva sólidos y no modifica los meshes', () => {
  const {scene,fx,solid}=make();fx.update(frame(0.4),camera,0.016)
  const rainMesh=fx.rain, rainGeometry=fx.rain.geometry, rainMaterial=fx.rain.material
  const pass=gtao(scene)
  pass._overrideVisibility()
  assert.equal(fx.rain.visible,false);assert.equal(fx.mist.visible,false)
  assert.equal(solid.visible,true)
  assert.equal(pass._visibilityCache.length,2)
  pass._restoreVisibility()
  assert.equal(fx.rain.visible,true);assert.equal(fx.mist.visible,true)
  assert.equal(rainMesh,fx.rain);assert.equal(rainGeometry,fx.rain.geometry);assert.equal(rainMaterial,fx.rain.material)
  assert.equal(pass._visibilityCache.length,0)
})
test('STORM-07 · GTAO no activa geometrías ya ocultas ni dibuja un splash sin impacto', () => {
  const {scene,fx}=make();fx.update(frame(0.4),camera,0.016)
  assert.equal(fx.splash.visible,false)
  fx.mist.visible=false
  const pass=gtao(scene);pass._overrideVisibility()
  assert.equal(pass._visibilityCache.length,1)
  pass._restoreVisibility()
  assert.equal(fx.mist.visible,false);assert.equal(fx.splash.visible,false)
})
test('STORM-08 · salpicadura real entra al G-buffer solamente en la vía original de render', () => {
  const {scene,fx}=make()
  fx._addSplash({point:[0,0,0],normal:[0,1,0]})
  fx.update(frame(),camera,0.016)
  assert.equal(fx.splash.visible,true)
  const pass=gtao(scene);pass._overrideVisibility()
  assert.equal(fx.splash.visible,false)
  pass._restoreVisibility()
  assert.equal(fx.splash.visible,true)
})
test('STORM-09 · no se modifican el shader de precipitación ni el presupuesto de raycasts', () => {
  assert.match(fxSource,/MAX_IMPACT_CASTS = 64/)
  assert.match(fxSource,/vec3 wp = p - uDir \* len \* position.y/)
  assert.match(fxSource,/depthWrite: false/)
  assert.doesNotMatch(fxSource,/(VfxSimulation|VfxBillboardRenderer|new WaterWorld\()/)
})
test('STORM-10 · el filtro GTAO permanece en ambos modos de compositor', () => {
  assert.equal((lookSource.match(/this\._excludeVfxFromAO\(this\.aoPass\)/g)||[]).length,2)
  assert.match(lookSource,/new GTAOPass\(/)
  assert.match(lookSource,/pass\._overrideVisibility\.bind\(pass\)/)
})
test('STORM-11 · fuente de render especializado conserva la autoridad de Viewport', () => {
  const viewport=read('src/engine/runtime/render/viewport.js')
  assert.equal((viewport.match(/new PrecipFX\(this\.scene\)/g)||[]).length,1)
  assert.match(viewport,/this\.precip\.update\(/)
})
test('STORM-12 · fixture GPU controla exclusión, preserva sólidos y compara G-buffer', () => {
  const fixture=read('scripts/fixtures/weather/precip-gtao-black-corr.html')
  for(const name of ['_overrideVisibility()','_restoreVisibility()','lfExcludeFromAO','MeshNormalMaterial','readRenderTargetPixels','gpuError','solid'])assert.ok(fixture.includes(name),name)
  const runner=read('scripts/test-weather-storm-black-artifact-electron-corr-g001.mjs')
  assert.match(runner,/verifyWebGL\(/)
  assert.doesNotMatch(runner,/chromium|brave|spawnSync/)
})
