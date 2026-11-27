import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { newVfxResource } from '../src/engine/runtime/vfx/resource.js'
import { VfxSimulation } from '../src/engine/runtime/vfx/simulation.js'
import { validateSceneVfx } from '../src/engine/runtime/vfx/scene-validation.js'
import { validateBuildSources } from '../src/core/buildList.js'
import { NodeLifecycle } from '../src/engine/runtime/scene/node-lifecycle.js'
import { registerNode } from '../src/engine/runtime/nodes/registry.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/vfx/s02/scene.json', import.meta.url), 'utf8'))
const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const resource = () => newVfxResource('fx-smoke', 'Smoke.vfx')
const objects = () => structuredClone(fixture.objects)
const project = (nodes = objects(), fx = [resource()], assets = []) => ({ objects: nodes, vfx: fx, assets })

const registrations = []
class Group {
  constructor() { this.userData = {}; this.children = []; this.matrixWorld = { elements: [...identity] } }
  add(...items) { for (const item of items) { this.children.push(item); item.parent = this } }
  updateWorldMatrix() {}
}
class BufferGeometry { setFromPoints() { return this } dispose() { this.disposed = true } }
class Vector3 { constructor(x,y,z) { Object.assign(this,{x,y,z}) } }
class LineLoop { constructor(geometry, material) { this.userData = {}; this.geometry = geometry; this.material = material } }
const renderers = []
class FakeRenderer {
  constructor(simulation, { texture } = {}) {
    this.simulation = simulation
    this.material = { uniforms: { uMap: { value: texture || null } } }
    this.mesh = { matrixAutoUpdate: true, matrixWorldNeedsUpdate: false, matrix: {
      copied: false, inverted: false, copy() { this.copied = true; return this }, invert() { this.inverted = true; return this },
    } }
    renderers.push(this)
  }
  sync() { this.synced = (this.synced || 0) + 1 }
  dispose() { this.disposed = true }
  setTexture(texture) { this.material.uniforms.uMap.value = texture }
}
const source = readFileSync(new URL('../src/engine/runtime/nodes/vfx.js', import.meta.url), 'utf8')
  .replace(/^import .*\n/gm, '')
  .replace(/^export default vfxDef\s*$/gm, '')
  .replace(/^export function createWeatherVfx3D/gm, 'function createWeatherVfx3D')
const context = {
  THREE: { Group, BufferGeometry, Vector3, LineLoop },
  registerNode: (def) => { registrations.push(def); return registerNode(def) },
  makeRoot: () => {
    const root = new Group(), visual = new Group()
    root.add(visual)
    root.userData.visual = visual
    return { root, visual }
  },
  applyBase: () => {}, hitSphere: () => ({ geometry: new BufferGeometry(), material: { dispose() { this.disposed = true } } }), lineMat: () => ({ dispose() { this.disposed = true } }),
  validateVfxResource: (value) => {
    if (!value) throw new Error('VFX inexistente')
    return value
  },
  validateSceneVfx, VfxSimulation, VfxBillboardRenderer: FakeRenderer,
  console: { warn() {} },
}
vm.runInNewContext(source, context, { filename: 'src/engine/runtime/nodes/vfx.js' })
const def = registrations.at(-1)
const makeScene = (data, spriteTexture = () => null) => {
  const scene = {
    host: { project: data }, nodes: new Map(),
    spriteTexture,
    vp: { camera: {}, requests: 0, requestRender() { this.requests++ } },
  }
  for (const o of data.objects.filter(o => o.type === 'vfx')) scene.nodes.set(o.id, def.build(o))
  scene.nodeLifecycle = new NodeLifecycle(scene)
  return scene
}

test('VFX-G002-01 · referencia compartida, identidad y presupuesto correcto', () => {
  const p = project()
  assert.equal(validateSceneVfx(p.objects, p.vfx, p.assets), 128)
  assert.equal(p.objects[0].props.vfxId, p.objects[1].props.vfxId)
  assert.equal(p.vfx.length, 1)
})

test('VFX-G002-02 · faltante y textura incorrecta son errores de validación', () => {
  const p = project()
  p.objects[0].props.vfxId = 'inexistente'
  assert.throws(() => validateSceneVfx(p.objects, p.vfx, p.assets), /no existe/)
  p.objects[0].props.vfxId = 'fx-smoke'
  p.vfx[0].appearance.textureId = 'tex'
  assert.throws(() => validateSceneVfx(p.objects, p.vfx, p.assets), /textura ausente/)
  p.assets.push({ id: 'tex', kind: 'texture' })
  assert.equal(validateSceneVfx(p.objects, p.vfx, p.assets), 128)
})

test('VFX-G002-03 · capacidad acumulada de escena no supera 4096', () => {
  const p = project()
  p.vfx[0].emission.capacity = 1024
  p.objects = Array.from({ length: 5 }, (_, i) => ({ type: 'vfx', id: String(i), props: { vfxId: 'fx-smoke' } }))
  assert.throws(() => validateSceneVfx(p.objects, p.vfx, p.assets), /4096/)
  p.objects.pop()
  assert.equal(validateSceneVfx(p.objects, p.vfx, p.assets), 4096)
})

test('VFX-G002-04 · la exportación valida recursos y archivos de textura antes de escribir', () => {
  const p = project()
  const scenes = [{ name: 'A', data: { objects: p.objects } }]
  assert.doesNotThrow(() => validateBuildSources({ ...p, models: [] }, scenes, new Map()))
  p.vfx[0].appearance.textureId = 'tex'
  p.assets = [{ id: 'tex', name: 'tex.png', kind: 'texture' }]
  assert.throws(() => validateBuildSources({ ...p, models: [] }, scenes, new Map()), /archivo de textura/)
  assert.doesNotThrow(() => validateBuildSources({ ...p, models: [] }, scenes, new Map([['tex', new Uint8Array([1])]])))
})

test('VFX-G002-05 · NodeLifecycle mantiene simulaciones privadas y libera al parar', () => {
  const p = project(), scene = makeScene(p)
  scene.nodeLifecycle.sync()
  assert.equal(renderers.filter(r => !r.disposed).length, 0)
  scene.nodeLifecycle.start()
  const a = scene.nodes.get('vfx-a').userData.vfxRuntime
  const b = scene.nodes.get('vfx-b').userData.vfxRuntime
  assert.notEqual(a.simulation, b.simulation)
  assert.equal(a.simulation.resource.id, b.simulation.resource.id)
  scene.nodeLifecycle.process(0.2)
  assert.ok(a.simulation.count > 0)
  assert.ok(b.simulation.count > 0)
  assert.notDeepEqual([...a.simulation.position.slice(0,3)], [...b.simulation.position.slice(0,3)])
  assert.ok(scene.vp.requests >= 2)
  p.objects[0].props.enabled = false
  const count = a.simulation.totalBirths
  scene.nodeLifecycle.process(0.2)
  assert.equal(a.simulation.totalBirths, count)
  scene.nodeLifecycle.stop()
  assert.equal(a.renderer.disposed, true)
  assert.equal(b.renderer.disposed, true)
  assert.equal(scene.nodes.get('vfx-a').userData.vfxRuntime, null)
})

test('VFX-G002-06 · textura asíncrona no crea renderer antes de estar disponible', () => {
  const p = project()
  p.vfx[0].appearance.textureId = 'tex'
  p.assets.push({ id: 'tex', kind: 'texture' })
  let texture = null
  const scene = makeScene(p, () => texture)
  scene.nodeLifecycle.start()
  const root = scene.nodes.get('vfx-a')
  assert.equal(root.userData.vfxRuntime, null)
  assert.match(root.userData.vfxError, /Cargando textura/)
  texture = { id: 'texture-loaded' }
  def.update(root, p.objects[0]) // _resyncSprites lo invoca desde SceneGraph
  assert.equal(root.userData.vfxRuntime.renderer.material.uniforms.uMap.value, texture)
  scene.nodeLifecycle.stop()
  def.update(root, p.objects[0]) // carga tardía tras cierre: no resucita la instancia
  assert.equal(root.userData.vfxRuntime, null)
})

test('VFX-G002-07 · semilla cambiada reinicia la instancia, no la otra', () => {
  const p = project(), scene = makeScene(p)
  scene.nodeLifecycle.start()
  const a = scene.nodes.get('vfx-a'), b = scene.nodes.get('vfx-b')
  const prior = a.userData.vfxRuntime, neighbor = b.userData.vfxRuntime
  p.objects[0].props.seed = 999
  def.update(a, p.objects[0])
  assert.equal(prior.renderer.disposed, true)
  assert.notEqual(a.userData.vfxRuntime.simulation, prior.simulation)
  assert.equal(b.userData.vfxRuntime, neighbor)
  scene.nodeLifecycle.stop()
})

test('VFX-G002-08 · partículas en mundo cancelan el Transform de la jerarquía', () => {
  const p = project()
  p.vfx[0].movement.space = 'world'
  const scene = makeScene(p)
  scene.nodeLifecycle.start()
  const root = scene.nodes.get('vfx-a')
  scene.nodeLifecycle.process(0.2)
  const mesh = root.userData.vfxRuntime.renderer.mesh
  assert.equal(mesh.matrixAutoUpdate, false)
  assert.equal(mesh.matrix.copied, true)
  assert.equal(mesh.matrix.inverted, true)
  scene.nodeLifecycle.stop()
})

test('VFX-G002-09 · emisor sin recurso no se simula ni explota en Play', () => {
  const p = project()
  p.objects[0].props.vfxId = ''
  const scene = makeScene(p)
  scene.nodeLifecycle.start()
  assert.equal(scene.nodes.get('vfx-a').userData.vfxRuntime, null)
  assert.match(scene.nodes.get('vfx-a').userData.vfxError, /Asigna un recurso/)
  scene.nodeLifecycle.stop()
})

test('VFX-G002-11 · limpiar nodo libera también guía de edición y GPU', () => {
  const p = project(), scene = makeScene(p)
  scene.nodeLifecycle.start()
  const root = scene.nodes.get('vfx-a')
  const renderer = root.userData.vfxRuntime.renderer
  root.userData.disposeVfx()
  assert.equal(renderer.disposed, true)
  assert.equal(root.userData.vfxRuntime, null)
  const [ring, proxy] = root.userData.editorOnlyVisual.children
  assert.equal(ring.geometry.disposed, true)
  assert.equal(proxy.geometry.disposed, true)
  scene.nodeLifecycle.stop()
})
