// Regresión CPU del emisor meteorológico. Las comprobaciones GPU viven en el fixture Chromium.
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { World } from '../src/engine/runtime/world/world.js'
import { VfxSimulation } from '../src/engine/runtime/vfx/simulation.js'
import { newVfxResource, validateVfxResource } from '../src/engine/runtime/vfx/resource.js'
import { tornadoVisualState, tornadoFunnelRadius } from '../src/engine/runtime/world/tornado-visual.js'

const identity = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
class Group {
  constructor() {
    this.children = []; this.matrixWorld = { elements: identity }
    this.position = { set() {} }
  }
  add(child) { child.parent = this; this.children.push(child) }
  remove(child) { this.children = this.children.filter(v => v !== child); child.parent = null }
  removeFromParent() { this.parent?.remove(this) }
  updateWorldMatrix() {}
}
class DataTexture {
  constructor(data, width, height, format) {
    this.image = { data, width, height }; this.format = format; this.disposeCount = 0
  }
  dispose() { this.disposeCount++ }
}
class FakeRenderer {
  constructor(simulation, { texture } = {}) {
    this.simulation = simulation; this.texture = texture
    this.mesh = { matrixAutoUpdate: true, matrix: { copy() { return this }, invert() { return this } } }
  }
  sync() {}
  dispose() { this.disposed = true; this.mesh.parent?.remove(this.mesh) }
}
const source = readFileSync(new URL('../src/engine/runtime/nodes/vfx.js', import.meta.url), 'utf8')
  .replace(/^import .*\n/gm, '')
  .replace(/^export default vfxDef\s*$/gm, '')
  .replace(/^export function createWeatherVfx3D/gm, 'function createWeatherVfx3D')
const context = { THREE: { Group, DataTexture, RGBAFormat: 'rgba', SRGBColorSpace: 'srgb', LinearFilter: 'linear' },
  registerNode: () => null, VfxSimulation, VfxBillboardRenderer: FakeRenderer,
  newVfxResource, validateVfxResource, tornadoVisualState, tornadoFunnelRadius }
vm.runInNewContext(source, context)
const create = () => {
  const world = new World(17)
  world.configure({ weather: { on: true, preset: 'storm', tornadoEnabled: true, tornadoMode: 'script',
    tornadoDevelopmentSeconds: 1, tornadoOrganizationSeconds: 1, tornadoFormationSeconds: 2 } })
  const ed = { vp: { scene: new Group(), camera: {}, requestRender() {} } }
  const fx = context.createWeatherVfx3D(ed, world.tornado)
  return { world, ed, fx }
}

test('BQ-01: no hay textura meteorológica oculta dentro del nodo VFX',()=>{
 assert.doesNotMatch(source,/makeWeatherParticleTexture|createWeatherVfx3D/)
})
test('BQ-02: la condensación se dibuja en el campo de nubes',()=>{
 const sky=readFileSync(new URL('../src/engine/runtime/render/skylib.js',import.meta.url),'utf8')
 assert.match(sky,/tornadoCondensation\(vec3 wp\)/)
 assert.match(sky,/float atmosphericDensity\(vec3 p, bool full\)/)
 assert.doesNotMatch(sky,/vec4 tornadoCloudVolume\(/)
})
test('BQ-03: desaparecen los quads automáticos del tornado',()=>{
 const play=readFileSync(new URL('../src/engine/runtime/events/play-tornado.js',import.meta.url),'utf8')
 assert.doesNotMatch(play,/createWeatherVfx3D|VfxBillboardRenderer/)
})
test('BQ-04: Play/Stop ya no administra texturas meteorológicas',()=>{
 const play=readFileSync(new URL('../src/engine/runtime/events/play-tornado.js',import.meta.url),'utf8')
 assert.doesNotMatch(play,/particleTexture|_tornadoWeatherVfx/)
 assert.match(play,/_tornadoReset\(\)/)
})
test('BQ-05: el esquema genérico .vfx se conserva intacto',()=>{
 const res=validateVfxResource(newVfxResource('r','Smoke.vfx'))
 assert.equal(res.appearance.textureId,'')
 assert.equal(JSON.stringify(res).includes('tornado'),false)
})
test('BQ-06: el ciclo meteorológico conserva la formación sin emisor',()=>{
 const world=new World(17);world.configure({weather:{on:true,preset:'storm',tornadoEnabled:true,tornadoMode:'script'}})
 world.startTornado({weatherTransition:0});world.tornadoStep(2)
 assert.equal(world.tornado.phase,'development');assert.equal(world.tornado.active,false)
})
test('BQ-07: ruta renderer VFX genérica mantiene transparencia y texturas ajenas intactas', () => {
  const src = readFileSync(new URL('../src/engine/runtime/vfx/render.js',import.meta.url),'utf8')
  assert.match(src,/transparent: true/)
  assert.match(src,/depthWrite: false/)
  assert.match(src,/#ifdef VFX_HAS_MAP/)
  assert.match(src,/texture2D\(uMap, vUv\)/)
  assert.match(src,/uniforms\.uMap\.value = null/)
  assert.doesNotMatch(source, /project\.vfx\.push\(/)
})
