import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const read = (name) => readFileSync(resolve(root, name), 'utf8')
const has = (name) => existsSync(resolve(root, name))

test('Se reutilizan los tipos water y fluidcontainer3d sin registrar un tipo de agua adicional', () => {
  const registry = read('src/engine/runtime/nodes/index.js')
  assert.match(registry, /import '\.\/water\.js'/)
  assert.match(registry, /import '\.\/fluid-container\.js'/)
  assert.doesNotMatch(registry, /fluidwater3d|Water3D/)
  assert.match(read('src/engine/runtime/nodes/water.js'), /type:\s*'water'/)
  assert.match(read('src/engine/runtime/nodes/fluid-container.js'), /type:\s*'fluidcontainer3d'/)
})

test('El agua histórica conserva WaterWorld, modelos, superficies y controles del Editor', () => {
  for (const name of [
    'src/engine/runtime/geometry/waterworld.js',
    'src/engine/runtime/geometry/water-surface.js',
    'src/engine/runtime/geometry/water-terrain.js',
    'src/engine/runtime/events/play-water.js',
    'src/engine/runtime/events/play-liquid.js',
    'src/components/WaterPanel.vue',
    'src/components/FluidContainerPanel.vue',
  ]) assert.ok(has(name), name)
  assert.match(read('src/components/Inspector.vue'), /<WaterPanel\s+v-if="obj\.type === 'water'"/)
  assert.match(read('src/components/Inspector.vue'), /<FluidContainerPanel/)
  assert.match(read('src/engine/runtime/geometry/waterworld.js'), /export class WaterWorld/)
})

test('Play utiliza la autoridad física antigua y su puente de terreno', () => {
  const play = read('src/engine/runtime/events/play.js')
  assert.match(play, /this\.water\s*=\s*WaterWorld\.fromObjects/)
  assert.match(play, /new TerrainWaterConnection\(/)
  assert.match(play, /this\._liquidInit\(\)/)
  assert.doesNotMatch(play, /CenturyWaterRuntime|@century\/fluids/)
  assert.match(read('src/engine/runtime/events/play-controls.js'), /this\._waterConnection\?\.step\(fdt\)/)
  assert.doesNotMatch(read('src/engine/runtime/physics/jolt.js'), /fluidRuntime\?\.step|fluidRuntime\?\.dispose/)
})

test('Century Fluids queda conservada en vendor pero no como dependencia activa del ejecutable', () => {
  const pkg = JSON.parse(read('package.json'))
  const lock = JSON.parse(read('package-lock.json'))
  assert.ok(has('vendor/century-fluids/package.json'))
  assert.equal(pkg.dependencies?.['@century/fluids'], undefined)
  assert.equal(lock.packages?.['']?.dependencies?.['@century/fluids'], undefined)
  assert.equal(pkg.scripts?.['fluids:prepare'], undefined)
  assert.ok(has('src/engine/runtime/fluids/century-water.js'))
})

test('Las superficies, el exportador heredado y la API de scripts recuperan sus dependencias', () => {
  assert.match(read('src/engine/runtime/scene-graph.js'), /waterMethods/)
  assert.match(read('src/engine/runtime/scene/water.js'), /refreshPhysicalWaterPreview/)
  assert.match(read('src/core/godot/shaders.js'), /export function godotWaterShader/)
  assert.match(read('src/core/godot/nodes.js'), /godotWaterShader/)
  assert.match(read('src/core/events/game-api.d.ts'), /interface WaterApi|readonly water: WaterApi/)
})

test('El estado Deprecated y la suspensión se explican en documentos sin eliminar contratos anteriores', () => {
  assert.ok(has('docs/architecture/CE-CF-CA-002-NATIVE-VOXEL-WATER-CONSUMER-AUTHORITY.md'))
  assert.ok(has('docs/architecture/CE-CF-CA-002-AM-001-EXISTING-WATER-NODE-AUTHORITY.md'))
  const amendment = read('docs/architecture/CE-CF-CA-002-AM-002-LEGACY-WATER-RESTORATION-AND-INTEGRATION-PAUSE.md')
  assert.match(amendment, /Deprecated/)
  assert.match(amendment, /EN PAUSA/)
})
