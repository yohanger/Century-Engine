// G001: contratos verificables en Node. Las pruebas de WebGL reales están en runner Electron independiente.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { VIEW_MODES, geometryTriangles, modeCapability } from '../src/engine/runtime/render/view-diagnostics-contract.js'

const cap = (id, opts) => modeCapability(id, opts)
test('VM01 · catálogo único con modos explícitos, sin duplicados', () => {
  assert.equal(new Set(VIEW_MODES.map(m => m.id)).size, VIEW_MODES.length)
  for (const id of ['lit','unlit','lighting','wireframe','lod','lights','depth','normals','shader','clusters','indirect']) assert.ok(VIEW_MODES.some(m => m.id === id))
})
test('VM02 · lectura GLSL real publicada y coste GPU no falseado', () => {
  assert.equal(cap('shader').supported, true)
  const label=VIEW_MODES.find(m => m.id === 'shader')
  assert.match(label.label, /lecturas GLSL/)
  assert.match(label.description, /NO coste GPU/)
})
test('VM03 · la vista indirecta expone IBL real sin afirmar que muestra ScreenBounce', () => {
  assert.equal(cap('indirect').supported, true)
  assert.match(source('src/engine/runtime/render/view-diagnostics.js'), /ScreenBounce excluido/)
})
test('VM04 · clústeres nativos no dependen de WEBGL_multi_draw ni de un flag de proyecto', () => {
  assert.equal(cap('clusters').supported, false)
  assert.equal(cap('clusters', { lodManager: { clusters: { entries: [] } }, renderConfig: { clusterGeometry: false } }).supported, true)
})
test('VM05 · la vista LOD no necesita activar un ajuste de proyecto', () => {
  assert.equal(cap('lod', { lodManager: {}, renderConfig: { lod: false } }).supported, true)
  assert.equal(cap('lod', { renderConfig: { lod: true } }).supported, false)
})
test('VM06 · Lit y Unlit no exigen extensiones de GPU', () => {
  for (const id of ['lit','unlit','lighting','wireframe','triangles','lights','depth','normals','indirect']) assert.equal(cap(id).supported, true)
})
test('VM07 · cuenta triángulos de geometría efectiva indexada', () => {
  assert.equal(geometryTriangles({ geometry: { index: { count: 180 }, drawRange: { start: 0, count: 30 } } }), 10)
  assert.equal(geometryTriangles({ geometry: { index: { count: 180 }, drawRange: { start: 0, count: Infinity } } }), 60)
})
test('VM08 · respeta instancing y geometría no indexada', () => {
  assert.equal(geometryTriangles({ isInstancedMesh: true, count: 8, geometry: { attributes: { position: { count: 90 } } } }), 240)
  assert.equal(geometryTriangles({}), 0)
})
const source = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8')
test('VM09 · Edit Mode usa el mismo LODManager y detiene/recupera su trabajo', () => {
  const text = source('src/engine/runtime/scene/environment.js')
  assert.match(text, /import\('\.\.\/render\/lodmgr\.js'\)/)
  assert.match(text, /editorDiagnostics: true/)
  assert.match(text, /\.detach\(\)/)
  assert.match(source('src/engine/runtime/render/lodmgr.js'), /this\.editorDiagnostics/)
})
test('VM10 · swaps de materiales contienen try/finally y no persisten cambios', () => {
  const text = source('src/engine/runtime/render/view-diagnostics.js')
  assert.match(text, /finally\s*\{/)
  assert.match(text, /obj\.material = material/)
  assert.match(text, /scene\.background = originalBackground/)
  assert.match(text, /_cache = new Map/)
})
test('VM11 · captura de cielo usa temporizador existente y no copia datos de GPU', () => {
  const text = source('src/engine/runtime/render/viewport.js')
  assert.match(text, /onBeforeRender = \(\) => this\.perf\.begin\('Cielo atmosférico'\)/)
  assert.match(text, /onAfterRender = \(\) => this\.perf\.end\('Cielo atmosférico'\)/)
})
test('VM12 · modos editoriales no activan WebGPU de Player ni alteran el proyecto', () => {
  const text = source('src/engine/runtime/render/viewport.js')
  assert.match(text, /!this\.playing && !this\.drawEditorPreview && this\.viewMode !== 'lit'/)
  assert.match(source('src/core/state/state.js'), /mode: 'lit'/)
})
test('VM13 · los modos se publican desde el menú Ver y barra existente', () => {
  assert.match(source('src/core/commands.js'), /add\('view\.mode'/)
  assert.match(source('src/components/ViewBar.vue'), /Modo de visualización del renderer/)
})
test('VM14 · ningún modo incapaz fabrica resultados', () => {
  assert.equal(cap('inventado').supported, false)
  assert.equal(cap('shader').supported, true) // sólo métricas estáticas GLSL, jamás coste GPU
  assert.match(source('src/engine/runtime/render/view-diagnostics.js'), /Métrica ESTÁTICA, NO tiempo GPU/)
})
