import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { diagnosticHudModel } from '../src/engine/runtime/render/diagnostic-hud-model.js'
import { DIAGNOSTIC_HEAT_COLORS, DIAGNOSTIC_LOD_COLORS, VIEW_MODES } from '../src/engine/runtime/render/view-diagnostics-contract.js'

const source = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8')
const state = (mode, data={}) => ({ mode, supported: true, inspected: 13, triangles: 900, ...data })

test('CORR002-01: leyenda GLSL y nube usan escalas publicadas por el renderizador', () => {
  const model = diagnosticHudModel('shader', state('shader', {shaderKnown: 7, shaderUnknown: 3, maxTextureCalls: 12, cloudVisible: true, cloudStepsBudget: 36}))
  assert.equal(model.title, 'Shader Complexity')
  assert.deepEqual([...model.scales[0].colors], [...DIAGNOSTIC_HEAT_COLORS])
  assert.equal(model.scales[0].label, 'Lecturas GLSL · estático')
  assert.equal(model.scales[0].min, '0–1')
  assert.equal(model.scales[0].max, '>31')
  assert.equal(model.scales[1].label, 'Nubes · pasos/rayo')
  assert.equal(model.scales[1].max, '36')
  assert.deepEqual(model.facts.map(x => x.value), ['7', '12'])
})
test('CORR002-02: no inventa métricas de shaders desconocidos', () => {
  const model=diagnosticHudModel('shader',state('shader',{shaderKnown:0,maxTextureCalls:0,cloudVisible:false}))
  assert.equal(model.facts[1].value,'–')
  assert.equal(model.scales.length,1)
})
test('CORR002-03: LOD y clústeres usan escala idéntica al renderer', () => {
  const lod=diagnosticHudModel('lod',state('lod',{noLod:4}))
  assert.deepEqual([...lod.scales[0].colors],[...DIAGNOSTIC_LOD_COLORS])
  const clusters=diagnosticHudModel('clusters',state('clusters',{gpuClusters:12,direct:8}))
  assert.equal(clusters.facts[1].value,'12')
  assert.deepEqual([...clusters.scales[0].colors],[...DIAGNOSTIC_LOD_COLORS])
})
test('CORR002-04: cambia de modo sin presentar datos obsoletos', () => {
  assert.equal(diagnosticHudModel('lit',state('lit')),null)
  assert.equal(diagnosticHudModel('shader',state('lights')),null)
  assert.equal(diagnosticHudModel('shader',null),null)
  assert.equal(diagnosticHudModel('lights', {mode:'lights',supported:false,reason:'Sin datos'}).unavailable,'Sin datos')
})
test('CORR002-05: todos los modos se representan con información corta', () => {
  for(const {id} of VIEW_MODES.filter(v=>v.id!=='lit')) {
    const model=diagnosticHudModel(id,state(id))
    assert.ok(model?.title)
    assert.ok(model.facts.length || model.scales.length)
    assert.ok(!('details' in model) && !('legend' in model))
  }
})
test('CORR002-06: HUD visible sin F3, se detiene en Lit y oculta durante Play', () => {
  const component=source('src/components/ViewportDiagnosticsHud.vue')
  const overlay=source('src/components/ViewportOverlay.vue')
  assert.match(overlay,/<ViewportDiagnosticsHud \/>/)
  assert.match(component,/viewDiagnostics\?\.last/)
  assert.match(component,/mode\.value !== 'lit' && !store\.play\.on/)
  assert.match(component,/setInterval\(poll, 400\)/)
  assert.match(component,/onBeforeUnmount\(stop\)/)
  assert.doesNotMatch(component,/store\.view\.perf/)
})
test('CORR002-07: Rendimiento deja la leyenda en viewport y conserva datos', () => {
  const perf=source('src/components/PerfPanel.vue')
  assert.doesNotMatch(perf,/class="heat-legend"|\.heat-legend/)
  assert.doesNotMatch(perf,/Cada región verifica|GLSL lecturas de textura: verde|GPU no disponible/)
  assert.match(perf,/<summary>Más métricas<\/summary>/)
  assert.match(perf,/terrainEffectiveTriangles/)
  assert.match(perf,/cloudStepsBudget/)
  assert.match(perf,/details class="perf-more"/)
})
test('CORR002-08: Hornear Mapa conserva datos, botones adaptativos, sin párrafos', () => {
  const scene=source('src/components/ScenePanel.vue')
  const section=scene.split('data-scene-fold="scene-terrain-bake"')[1].split('</details>')[0]
  assert.doesNotMatch(section,/<p|owner-note|Cada región verifica|estimación geométrica/)
  assert.match(section,/terrain-bake-actions/)
  assert.match(section,/terrainBakeTotals\(\)\.baked/)
  assert.match(scene,/terrain-bake-action:focus-visible/)
  assert.match(scene,/grid-template-columns:minmax\(0,1fr\)/)
})
test('CORR002-09: renderer conserva las métricas físicas sin cambio de solver', () => {
  const diagnostic=source('src/engine/runtime/render/view-diagnostics.js')
  assert.match(diagnostic,/DIAGNOSTIC_HEAT_COLORS/)
  assert.match(diagnostic,/DIAGNOSTIC_LOD_COLORS/)
  assert.match(diagnostic,/shaderKnown, shaderUnknown, maxTextureCalls/)
  assert.match(diagnostic,/gpuClusters, direct/)
})
