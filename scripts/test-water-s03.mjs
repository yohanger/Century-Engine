// Water S03: contratos de render, estado autoritativo y compatibilidad sin requerir ventana WebGL.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { WaterRegion } from '../src/engine/runtime/geometry/water-solver.js'

const root = resolve(import.meta.dirname, '..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')
const src = (p) => read('src/engine/runtime/' + p)
const surface = src('geometry/water-surface.js')
const shader = src('geometry/watershader.js')
const wet = src('render/wetlib.js')
const scene = src('scene/water.js')
const controls = src('events/play-controls.js')
const play = src('events/play.js')
const editor = read('src/components/TerrainPanel.vue')

// Se ejercita el código real de la superficie con mínimos objetos Three.js de memoria.
class BufferAttribute {
  constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; this.needsUpdate = false }
  setUsage() { return this }
}
class BufferGeometry {
  constructor() { this.attributes = {} }
  setAttribute(name, attr) { this.attributes[name] = attr }
  setIndex(attr) { this.index = attr }
  setDrawRange(start, count) { this.drawRange = { start, count } }
  dispose() { this.disposed = true }
}
class Obj {
  constructor() { this.children = []; this.userData = {}; this.visible = true }
  add(x) { this.children.push(x) }
  remove(x) { this.children = this.children.filter((y) => y !== x) }
}
class Mesh extends Obj { constructor(geometry, material) { super(); this.geometry = geometry; this.material = material } }
class Color { set(v) { this.value = v; return this } }
const THREE = { BufferGeometry, BufferAttribute, Mesh, Group: Obj,
  MeshStandardMaterial: class { constructor() {} dispose() { this.disposed = true } },
  DynamicDrawUsage: 1, DoubleSide: 2 }
const fakeUniforms = () => ({ rtShallow: { value: new Color() }, rtDeep: { value: new Color() },
  rtOpacity: { value: 0 }, rtFoam: { value: 0 }, rtTotalAmp: { value: 0 },
  rtWMp: { value: { z: 1 } }, rtWFx: { value: { set() {} } } })
const surfModule = surface.replace("import * as THREE from 'three'", '')
  .replace("import { makeWaterUniforms, patchWaterMaterial } from './watershader.js'", '')
const Factory = Function('THREE', 'makeWaterUniforms', 'patchWaterMaterial', `${surfModule.replace('export class WaterSurfaceView', 'class WaterSurfaceView')}\nreturn WaterSurfaceView`)
const WaterSurfaceView = Factory(THREE, fakeUniforms, (m,u,o) => { m._mode = o; m.userData = { rt:u } })
const region = (cfg = {}) => new WaterRegion({ id: 'phys', width: 3, height: 3, x: 10, z: 20,
  bed: new Array(9).fill(2), depth: new Array(9).fill(0), ...cfg })
const water = (r) => ({ regions: new Map([[r.id, r]]) })

const fixed = src('geometry/waterworld.js')
  .replace("import { collectWaterBodies, riverLine } from './waterfx.js'", 'const collectWaterBodies = (items) => items; const riverLine = () => []')
  .replace("import { waveSet } from './water.js'", 'const waveSet = () => ({ big: [] })')
  .replace("import { WaterRegion } from './water-solver.js'", `import { WaterRegion } from '${new URL('../src/engine/runtime/geometry/water-solver.js',import.meta.url).href}'`)
const { WaterWorld } = await import(`data:text/javascript,${encodeURIComponent(fixed)}`)

// Unit scenarios

test('W19: superficie solo dibuja celdas físicamente mojadas', () => {
  const r = region({ depth: [0, 0.3, 0, 0, 0, 0, 0, 0, 0] })
  const world = water(r), scene = new Obj(), view = new WaterSurfaceView(scene, world)
  const mesh = view.items.get('phys').mesh, geom = mesh.geometry
  assert.equal(geom.drawRange.count, 6)
  assert.equal(geom.attributes.position.array[0], 11)
  assert.ok(Math.abs(geom.attributes.rtWaterDepth.array[0] - 0.3) < 1e-6)
  assert.equal(mesh.material._mode.simulated, true)
  assert.equal(view.group.children.length, 1)
  view.dispose()
  assert.equal(scene.children.length, 0)
  assert.equal(geom.disposed, true)
  assert.equal(mesh.material.disposed, true)
})
test('W19/W20: terreno sin agua no crea triángulos visibles y no genera altura artificial', () => {
  const r = region(), v = new WaterSurfaceView(new Obj(), water(r))
  const m = v.items.get('phys').mesh
  assert.equal(m.geometry.drawRange.count, 0)
  assert.equal(m.visible, false)
  r.depth[4] = 0.1
  v.update(water(r))
  assert.equal(m.geometry.drawRange.count, 6)
  assert.equal(m.visible, true)
  assert.ok(Math.abs(m.geometry.attributes.position.array[1] - 2.102) < 1e-4)
  r.depth[4] = 0
  v.update(water(r))
  assert.equal(m.geometry.drawRange.count, 0)
  v.dispose()
})
test('W19/W20: la superficie visual sigue el solver sin modificar su volumen', () => {
  const r = region({ depth: [0.1, 0.2, 0, 0, 0, 0, 0, 0, 0] })
  const before = r.volume(), view = new WaterSurfaceView(new Obj(),water(r))
  assert.equal(view.items.get('phys').mesh.geometry.drawRange.count, 12)
  const pos = view.items.get('phys').mesh.geometry.attributes.position.array
  // Misma esquina física entre dos celdas contiguas => sin grieta visual.
  assert.equal(pos[4], pos[13])
  assert.equal(r.volume(), before)
  view.dispose()
})
test('W20: la visualización respeta celdas sin suelo', () => {
  const r = region({ valid: [1,1,0,1,1,1,1,1,1], depth:[0.1,0,0,0,0,0,0,0,0] })
  const view = new WaterSurfaceView(new Obj(),water(r))
  assert.equal(view.items.get('phys').mesh.geometry.drawRange.count,6)
  view.dispose()
})
test('W19: al retirar una región se liberan sus recursos y desaparece su malla', () => {
  const r = region({ depth: new Array(9).fill(0.2) })
  const view = new WaterSurfaceView(new Obj(),water(r))
  const item = view.items.get('phys')
  view.update({ regions: new Map() })
  assert.equal(view.items.size,0)
  assert.equal(item.mesh.geometry.disposed,true)
  assert.equal(item.mesh.material.disposed,true)
  view.dispose()
})
test('W21: el shader de tierra mantiene humedad sin crear charcos dentro de las regiones físicas', () => {
  assert.match(wet,/rtHasPhysicalWater\(vTxz\)/)
  assert.match(wet,/uPhysicalCount/)
  assert.match(wet,/uWet > 0\.65/)
  assert.match(wet,/roughnessFactor = mix/)
})
test('W22: el shader PBR reutilizado diferencia la superficie simulada de la heredada', () => {
  assert.match(shader,/patchWaterMaterial\(mat, u, \{ simulated = false \}/)
  assert.match(shader,/rtSimDepth = rtWaterDepth/)
  assert.match(shader,/rtDepth = \$\{simulated/)
  assert.match(shader,/rtH \* \(1\.0 - smoothstep/)
  assert.match(shader,/rtRpg = rtRipples/)
})
test('W23/W24/W25: natación, cuerpos y scripts consultan WaterWorld.at sin segundo solver', () => {
  const w = new WaterWorld(), r = w.addRegion({ id: 'phys', width:2,height:2, depth:[0.5,0,0,0], velocityX:[1,0,0,0] })
  const at = w.at(0.25,0.25)
  assert.equal(at.depth,0.5)
  assert.equal(at.flowX,1)
  assert.match(src('physics/node-spatial.js'),/this\.play\.water\?\.at\(position\.GetX\(\), position\.GetZ\(\)\)/)
  assert.match(src('events/play-bodies.js'),/W\.at\(c\.x, c\.z\)/)
  assert.match(src('events/play-water.js'),/self\.water\.at\(a, b\)/)
})
test('W26: editor previsualiza sin dar pasos, juego actualiza después de la física', () => {
  assert.match(scene,/refreshPhysicalWaterPreview/)
  assert.match(scene,/new TerrainWaterConnection\(water, resolved, this\.terrains, this\.world\)/)
  assert.doesNotMatch(scene.slice(scene.indexOf('refreshPhysicalWaterPreview'),scene.indexOf('setPhysicalWaterBounds')),/\.step\(/)
  assert.match(controls,/this\.ed\.updatePhysicalWater\(this\.water\)/)
  assert.match(play,/ed\.showPhysicalWater\(this\.water\)/)
  assert.match(src('events/play-level.js'),/this\.ed\.hidePhysicalWater\(\)/)
})
test('W26: editor conserva configuración y ofrece controles de activación y profundidad inicial', () => {
  assert.match(editor,/waterSimulation/)
  assert.match(editor,/waterSimToggle/)
  assert.match(editor,/waterSimDepth/)
  assert.match(editor,/commit\('Simulación de agua'\)/)
  assert.match(editor,/@commit="waterSimDepth\(simDepthDraft\)"/)
})
test('W26: se detecta solapamiento en el enlace de escena sin romper WaterWorld.addRegion', () => {
  assert.match(src('geometry/water-terrain.js'),/se solapa con agua heredada/)
  assert.doesNotMatch(src('geometry/waterworld.js'),/solapada con agua heredada/)
})
test('W26: el shader PBR antiguo conserva su ruta sin agua física activada', () => {
  assert.match(shader,/simulated = false/)
  assert.match(wet,/uPhysicalCount:\s*\{ value: 0 \}/)
  assert.match(play,/if \(this\._waterConnection\) ed\.showPhysicalWater/)
})
