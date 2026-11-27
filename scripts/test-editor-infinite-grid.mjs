import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const moduleText = read('src/engine/runtime/render/infinite-grid.js')
const viewportText = read('src/engine/runtime/render/viewport.js')
const keyboardText = read('src/core/editor/keys.js')
const commandText = read('src/core/commands.js')
const viewModesText = read('src/engine/runtime/render/view-diagnostics.js')
const lookText = read('src/engine/runtime/render/look.js')

function setup() {
  const objects = []
  class Geometry {
    constructor(width, height) { this.width = width; this.height = height; this.disposed = 0; objects.push(this) }
    dispose() { this.disposed++ }
  }
  class Material {
    constructor(options) { Object.assign(this, options); this.disposed = 0; objects.push(this) }
    dispose() { this.disposed++ }
  }
  class Mesh {
    constructor(geometry, material) {
      this.geometry = geometry; this.material = material; this.rotation = { x: 0 }
      this.position = { x: 0, y: 0, z: 0, set(x, y, z) { Object.assign(this, { x, y, z }) } }
      this.scale = { x: 1, y: 1, z: 1, set(x, y, z) { Object.assign(this, { x, y, z }) } }
      this.matrixUpdates = 0; this.visible = true
    }
    updateMatrixWorld() { this.matrixUpdates++ }
  }
  class Color { constructor(value) { this.value = value } }
  class Vector3 { set(x, y, z) { Object.assign(this, { x, y, z }); return this } }
  const THREE = { PlaneGeometry: Geometry, ShaderMaterial: Material, Mesh, Color, Vector3, DoubleSide: 'double' }
  const source = moduleText.replace("import * as THREE from 'three'", '').replace('export function createInfiniteGrid', 'function createInfiniteGrid')
  const createInfiniteGrid = vm.runInNewContext(`${source}\ncreateInfiniteGrid`, { THREE, Math, Number })
  const setGridBody = viewportText.split('  setGrid(cell, extent = 64) {')[1]?.split('\n  }')[0]
  assert.ok(setGridBody, 'Viewport.setGrid debe existir')
  const setGrid = new Function('createInfiniteGrid', `return function setGrid(cell, extent = 64) {${setGridBody}\n}`)(createInfiniteGrid)
  return { createInfiniteGrid, setGrid, objects }
}

function camera(x, z, far = 2000) {
  return { far, getWorldPosition(target) { target.set(x, 8, z); return target } }
}

test('IG01 · superficie procedural constante de solo dos triángulos, sin GridHelper', () => {
  const { createInfiniteGrid } = setup(), grid = createInfiniteGrid(1)
  assert.equal(grid.geometry.width, 2)
  assert.equal(grid.geometry.height, 2)
  assert.equal(grid.rotation.x, -Math.PI / 2)
  assert.equal(grid.frustumCulled, false)
  assert.doesNotMatch(viewportText, /new THREE\.GridHelper/)
})

test('IG02 · shader repite la rejilla sobre coordenadas de mundo en XZ', () => {
  const { createInfiniteGrid } = setup(), { material } = createInfiniteGrid(1)
  assert.match(material.vertexShader, /modelMatrix \* vec4\(position, 1\.0\)/)
  assert.match(material.fragmentShader, /vWorld\.xz \/ spacing/)
  assert.match(material.fragmentShader, /fract\(coordinate - 0\.5\)/)
  assert.match(material.fragmentShader, /fwidth\(coordinate\)/)
})

test('IG03 · el centro sigue a la cámara sin cambiar las coordenadas del mundo del shader', () => {
  const { createInfiniteGrid } = setup(), grid = createInfiniteGrid(1)
  grid.onBeforeRender(null, null, camera(0, 0))
  assert.equal(grid.position.x, 0)
  grid.onBeforeRender(null, null, camera(15000, -20000))
  assert.equal(grid.position.x, 15000)
  assert.equal(grid.position.z, -20000)
  assert.equal(grid.position.y, 0.002)
  assert.equal(grid.matrixUpdates, 2)
})

test('IG04 · tamaño dinámico basado en frustum, no en extensión del terreno', () => {
  const { createInfiniteGrid } = setup(), grid = createInfiniteGrid()
  grid.onBeforeRender(null, null, camera(0, 0, 600))
  assert.equal(grid.scale.x, 1200)
  assert.equal(grid.scale.y, 1200)
  grid.onBeforeRender(null, null, camera(0, 0, 2000))
  assert.equal(grid.scale.x, 4000)
})

test('IG05 · configuración de gridSize cambia uniforme sin regenerar geometría', () => {
  const { createInfiniteGrid, setGrid } = setup()
  let renders = 0
  const scene = { children: [], add(item) { this.children.push(item) } }
  const vp = { grid: null, scene, requestRender() { renders++ }, setGrid }
  vp.setGrid(1, 64)
  const grid = vp.grid, geometry = grid.geometry, material = grid.material
  vp.setGrid(0.25, 256)
  vp.setGrid(4, 10000)
  assert.equal(vp.grid, grid)
  assert.equal(grid.geometry, geometry)
  assert.equal(grid.material, material)
  assert.equal(grid.material.uniforms.uCell.value, 4)
  assert.equal(scene.children.length, 1)
  assert.equal(geometry.disposed, 0)
  assert.equal(material.disposed, 0)
  assert.equal(renders, 3)
})

test('IG06 · tolerancia de celda inválida preserva distancia finita', () => {
  const { createInfiniteGrid } = setup(), grid = createInfiniteGrid()
  for (const bad of [0, -1, NaN, Infinity, undefined]) {
    grid.setCellSize(bad)
    assert.equal(grid.material.uniforms.uCell.value, 1)
  }
})

test('IG07 · opciones transparentes respetan composición y no escriben profundidad', () => {
  const { createInfiniteGrid } = setup(), grid = createInfiniteGrid()
  assert.equal(grid.material.transparent, true)
  assert.equal(grid.material.depthWrite, false)
  assert.equal(grid.material.depthTest, true)
  assert.equal(grid.material.toneMapped, false)
  assert.equal(grid.renderOrder, -1)
  assert.match(grid.material.fragmentShader, /#include <colorspace_fragment>/)
})

test('IG08 · líneas principales y secundarias antialias sin límite fijo de superficie', () => {
  const { createInfiniteGrid } = setup(), { fragmentShader } = createInfiniteGrid().material
  assert.match(fragmentShader, /gridCoverage\(uCell \* 10\.0\)/)
  assert.match(fragmentShader, /smoothstep\(1\.5, 4\.0/)
  assert.doesNotMatch(fragmentShader, /gridExtent|uExtent|discard.*distance/)
})

test('IG09 · G ya no conmuta rejilla desde teclado normal', () => {
  assert.doesNotMatch(keyboardText, /case 'g':\s*store\.view\.grid/)
  assert.match(keyboardText, /if \(this\.edit && k !== 'tab' && this\.edit\.onKey/)
})

test('IG10 · comando Ver → Rejilla queda disponible sin asociar G', () => {
  const row = commandText.match(/add\('view\.grid',[^\n]+/)
  assert.ok(row)
  assert.match(row[0], /store\.view\.grid = !store\.view\.grid/)
  assert.doesNotMatch(row[0], /keys:/)
  assert.match(commandText, /label: 'Ver', ids: \['view\.grid'/)
})

test('IG11 · G mueve en Edit Mesh y Ctrl+G agrupa objetos', () => {
  assert.match(commandText, /M\('mesh\.grab', 'Mover', \{ icon: 'move', keys: 'G'/)
  assert.match(keyboardText, /if \(mod && k === 'g'\) \{ e\.preventDefault\(\); e\.shiftKey \? ungroup\(store\.selectedId\) : groupSelected\(\)/)
})

test('IG12 · se conserva la pasada de rejilla en Lit y diagnósticos', () => {
  assert.match(viewportText, /const helpers = new Set\(\[this\.overlay, this\.grid/)
  assert.match(lookText, /vp\.drawEditorOverlay\(vis\)/)
  assert.match(viewModesText, /this\.vp\.grid/)
})

test('IG13 · las vistas auxiliares y Play siguen controlando la visibilidad existente', () => {
  assert.match(read('src/core/editor/play-session.js'), /vp\.grid\.visible/)
  assert.match(read('src/engine/runtime/scene/environment.js'), /this\.vp\.grid\.visible = v\.grid/)
  assert.match(read('src/components/MapPicker.vue'), /vp\.grid\.visible = false/)
})

test('IG14 · el setter conserva visibilidad previa del usuario', () => {
  const { setGrid } = setup()
  const vp = { grid: null, scene: { add() {} }, requestRender() {}, setGrid }
  vp.setGrid(1)
  vp.grid.visible = false
  vp.setGrid(0.1)
  assert.equal(vp.grid.visible, false)
})

test('IG15 · ortográfica de gran extensión no recorta la rejilla por tamaño fijo', () => {
  const { createInfiniteGrid } = setup(), grid = createInfiniteGrid()
  const ortho = { ...camera(0, 0, 800), isOrthographicCamera: true,
    left: -9000, right: 9000, top: 7000, bottom: -7000, zoom: 1 }
  grid.onBeforeRender(null, null, ortho)
  assert.ok(grid.scale.x > 20000)
  assert.equal(grid.scale.x, grid.scale.y)
})

test('IG16 · etiqueta de la barra no anuncia un atajo G retirado', () => {
  const viewbar = read('src/components/ViewBar.vue')
  assert.match(viewbar, /\['view\.grid', 'Rejilla'\]/)
  assert.doesNotMatch(viewbar, /Rejilla \(G\)/)
})
