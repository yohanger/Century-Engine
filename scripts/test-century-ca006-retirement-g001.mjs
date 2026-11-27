import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
const root = resolve(import.meta.dirname, '..')
const read = (name) => readFileSync(resolve(root, name), 'utf8')
const has = (name) => existsSync(resolve(root, name))
const pkg = JSON.parse(read('package.json'))

test('Century es la identidad publica y se conserva el ID persistente original', () => {
  assert.equal(pkg.name, 'century')
  assert.equal(pkg.build.productName, 'Century')
  assert.equal(pkg.build.executableName, 'century')
  assert.equal(pkg.build.appId, 'com.levelforge.editor')
})
test('Los comandos normales mantienen el launcher de Electron sin servidor Vite', () => {
  assert.equal(pkg.scripts.start, pkg.scripts.electron)
  assert.match(pkg.scripts.start, /electron-start\.mjs/)
  assert.match(pkg.scripts['electron:dev'], /electron-dev\.mjs/)
})
test('Ya no se registran tipos de nodo agua ni recipiente de fluido', () => {
  assert.doesNotMatch(read('src/engine/runtime/nodes/index.js'), /import\s+['"]\.\/(?:water|fluid-container)\.js['"]/)
  assert.equal(has('src/engine/runtime/nodes/water.js'), false)
  assert.equal(has('src/engine/runtime/nodes/fluid-container.js'), false)
})
test('Los datos de nodos retirados quedan inertes pero no se eliminan', () => {
  const scene = read('src/engine/runtime/scene/objects.js')
  assert.match(scene, /\['water', 'fluidcontainer3d'\]/)
  assert.match(scene, /makeRoot\(obj\)\.root/)
  assert.match(read('src/engine/runtime/scene/node-lifecycle.js'), /!\['water', 'fluidcontainer3d'\]\.includes\(obj\.type\)/)
})
test('La escena y Play no importan la simulacion de agua retirada', () => {
  const scene = read('src/engine/runtime/scene-graph.js')
  const play = read('src/engine/runtime/events/play.js')
  assert.doesNotMatch(scene, /waterMethods|refreshPhysicalWaterPreview|hidePhysicalWater|WaterWorld/)
  assert.doesNotMatch(play, /play-water|play-liquid|WaterWorld|waterFxMethods|liquidMethods/)
})
test('El agua antigua deja de existir como API game.water', () => {
  for (const file of ['src/core/events/game-api.d.ts', 'vscode-extension/media/game-api.d.ts']) {
    assert.doesNotMatch(read(file), /readonly water: WaterApi|interface WaterApi|game\.water/)
  }
  assert.doesNotMatch(read('src/engine/runtime/events/play-host.js'), /get water\s*\(/)
})
test('Editor ya no presenta controles de agua ni recipientes', () => {
  assert.doesNotMatch(read('src/components/Inspector.vue'), /<WaterPanel|<FluidContainerPanel|data-testid="liquid-container-inspector"/)
  assert.doesNotMatch(read('src/components/TerrainPanel.vue'), /data-fold-id="terrain-water"/)
  assert.doesNotMatch(read('src/components/ScenePanel.vue'), /data-scene-fold="world-water"/)
})
test('La lluvia conserva sus impactos y el terreno conserva humedad meteorologica', () => {
  assert.match(read('src/engine/runtime/scene-graph.js'), /rainImpactMethods/)
  assert.match(read('src/engine/runtime/scene/rain-impact.js'), /rainImpact\(from, to\)/)
  assert.match(read('src/engine/runtime/render/wetlib.js'), /uWet/)
  assert.doesNotMatch(read('src/engine/runtime/render/wetlib.js'), /uPhysicalCount|uHydroCount/)
})
test('Permanece la lectura de recursos .liquid existentes sin autorizar nueva simulacion', () => {
  assert.match(read('src/core/lfproj.js'), /normalizeLiquid/)
  assert.match(read('src/core/project.js'), /meta\.liquids/)
  assert.equal(has('src/engine/runtime/fluids/liquid.js'), true)
  assert.doesNotMatch(read('src/components/ProjectPanel.vue'), /label: 'Líquido \(\.liquid\)'/)
})
test('La exportacion antigua de Godot no emite agua', () => {
  assert.doesNotMatch(read('src/core/exporter.js'), /bakeWaterMap|waterMap|summary\.waters/)
  assert.doesNotMatch(read('src/core/godot/nodes.js'), /'water'\(o, ex\)/)
})
test('Antiguas pruebas de agua se conservan como archivo historico fuera de smoke', () => {
  const suites = JSON.parse(read('scripts/qa-suites.json'))
  assert.ok(suites.groups.fluids?.files?.some(s => s.includes('test-water')))
  assert.ok(!suites.groups.smoke.files.some(s => s.includes('water')))
})
