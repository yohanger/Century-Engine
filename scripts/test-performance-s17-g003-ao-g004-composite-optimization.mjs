// Pruebas de contrato CPU del experimento AO-G004; no reemplazan QA GLSL/GPU.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PerfMonitor } from '../src/engine/runtime/render/perf.js'

const root = new URL('../', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')
const look = read('src/engine/runtime/render/look.js')
const panel = read('src/components/PerfPanel.vue')

// Ejecuta el método original de LookPipeline con un sustituto mínimo de Three.
// Así se valida su secuencia efectiva sin disponer de un contexto WebGL en Node.
function createExperiment(perf = { enabled: false, aoCompositeMode: 'native' }, install = true) {
  const start = look.indexOf('  _installAoCompositeExperiment(pass) {')
  const end = look.indexOf('  _buildSingle() {', start)
  assert.ok(start > 0 && end > start, 'el método debe residir en LookPipeline')
  const src = look.slice(start, end)
  let created = 0
  class FakeMaterial {
    constructor(config) { Object.assign(this, config); this.disposed = false; created++ }
    dispose() { this.disposed = true }
  }
  const THREE = { ShaderMaterial: FakeMaterial, NoBlending: 0 }
  const GTAOPass = { OUTPUT: { Default: 0 } }
  const C = new Function('THREE', 'GTAOPass', `return class Experiment { constructor(perf) { this.vp = { perf } } ${src} };`)(THREE, GTAOPass)
  const experiment = new C(perf)
  const calls = []
  const pass = {
    output: 0, renderToScreen: false, blendIntensity: 0.9,
    gtaoMaterial: {kind:'occlusion'}, pdMaterial: {kind:'denoise'},
    copyMaterial: {kind:'copy'}, blendMaterial: {kind:'blend'},
    pdRenderTarget: {texture: {id:'ao'}},
    _renderPass(_renderer, material, target) { calls.push([material, target]) },
    _renderOverride() {},
    render(renderer, target, input) {
      this._renderPass(renderer, this.gtaoMaterial, {id:'gtao'})
      this._renderPass(renderer, this.pdMaterial, {id:'pd'})
      this._renderPass(renderer, this.copyMaterial, target)
      this._renderPass(renderer, this.blendMaterial, target)
    },
    dispose() { this.baseDisposed = true },
  }
  if (install) experiment._installAoCompositeExperiment(pass)
  return { pass, calls, perf, created, experiment }
}

function gpuHarness() {
  const ext = {TIME_ELAPSED_EXT:1, GPU_DISJOINT_EXT:2}
  const gl = {
    QUERY_RESULT_AVAILABLE:3, QUERY_RESULT:4, opened:null,
    getExtension() { return ext }, getParameter() { return false },
    createQuery() { return {} },
    beginQuery(_kind, q) { assert.equal(this.opened, null); this.opened = q },
    endQuery() { assert.ok(this.opened); this.opened = null },
    getQueryParameter(_q, k) { return k === 3 ? true : 1_000_000 },
    deleteQuery() {},
  }
  const renderer = {getContext:()=>gl, info:{autoReset:true,reset(){},render:{calls:0,triangles:0,lines:0,points:0},memory:{geometries:0,textures:0}}}
  const monitor = new PerfMonitor(renderer, (() => {let n=0;return () => ++n})())
  return {renderer,monitor}
}

test('AO-G004-01: la ruta nativa conserva copia y mezcla en orden', () => {
  const {pass, calls} = createExperiment()
  const out = {id:'write'}, src = {texture:{id:'scene'}}
  pass.render({}, out, src)
  assert.deepEqual(calls.map(([m])=>m.kind), ['occlusion','denoise','copy','blend'])
})

test('AO-G004-02: la fusión realiza un solo dibujo de salida y conserva los dos cálculos AO', () => {
  const {pass,calls} = createExperiment({enabled:true,aoCompositeMode:'fused'})
  const out = {id:'write'}, src = {texture:{id:'scene'}}
  const prev = pass._renderPass
  pass.render({}, out, src)
  assert.deepEqual(calls.map(([m])=>m.kind || 'fused'), ['occlusion','denoise','fused'])
  assert.strictEqual(calls[2][0], pass._lfAoFusedMaterial)
  assert.strictEqual(calls[2][1], out)
  assert.strictEqual(pass._renderPass, prev)
  assert.strictEqual(pass._lfAoFusedMaterial.uniforms.tScene.value, src.texture)
  assert.strictEqual(pass._lfAoFusedMaterial.uniforms.tAO.value, pass.pdRenderTarget.texture)
  assert.equal(pass._lfAoFusedMaterial.uniforms.intensity.value, 0.9)
})

test('AO-G004-03: render-to-screen y materiales compatibles conservan el resultado de render', () => {
  const {pass,calls} = createExperiment({enabled:true,aoCompositeMode:'fused'})
  pass.renderToScreen = true
  pass.render({}, null, {texture:{id:'scene'}})
  assert.equal(calls.length, 3)
  assert.strictEqual(calls.at(-1)[1], null)
})

test('AO-G004-04: modos de salida y buffers inseguros vuelven al método oficial', () => {
  const {pass,calls} = createExperiment({enabled:true,aoCompositeMode:'fused'})
  const same={texture:{id:'scene'}}
  pass.render({}, same, same)
  assert.equal(calls.length, 4)
  calls.length=0; pass.output=3; pass.render({}, {id:'out'}, same)
  assert.equal(calls.length, 4)
  calls.length=0; pass.output=0; pass.render({}, {id:'out'}, {})
  assert.equal(calls.length, 4)
})

test('AO-G004-05: excepciones restauran _renderPass sin tocar el pipeline', () => {
  const {pass} = createExperiment({enabled:true,aoCompositeMode:'fused'})
  const before=pass._renderPass
  const original=pass._renderPass
  pass._renderPass = function(...args) { if(args[1]===pass._lfAoFusedMaterial) throw Error('GPU error'); return original.apply(this,args) }
  const checkpoint=pass._renderPass
  assert.throws(()=>pass.render({}, {id:'out'}, {texture:{id:'scene'}}), /GPU error/)
  assert.strictEqual(pass._renderPass, checkpoint)
  assert.notStrictEqual(pass._renderPass, before)
})

test('AO-G004-06: el recurso nuevo tiene owner y se libera con GTAOPass', () => {
  const {pass} = createExperiment()
  // La ruta normal no crea materiales; la ruta fusionada los libera con GTAOPass.
  assert.equal(pass._lfAoFusedMaterial,undefined)
  pass.dispose()
  assert.ok(pass.baseDisposed)
  const alt=createExperiment({enabled:true,aoCompositeMode:'fused'}).pass
  alt.render({}, {}, {texture:{id:'scene'}})
  const material=alt._lfAoFusedMaterial
  alt.dispose()
  assert.ok(material.disposed)
  assert.ok(pass.baseDisposed)
})

test('AO-G004-07: en ausencia de Stats nunca se activa la fusión', () => {
  const {pass,calls} = createExperiment({enabled:false,aoCompositeMode:'fused'})
  pass.render({}, {}, {texture:{id:'scene'}})
  assert.equal(calls.length, 4)
})

test('AO-G004-08: modo inválido rechazado y cierre de Stats restaura modo nativo', () => {
  const {monitor}=gpuHarness()
  monitor.enable(true)
  assert.equal(monitor.setAoCompositeMode('unknown'),false)
  assert.equal(monitor.aoCompositeMode,'native')
  assert.equal(monitor.setAoCompositeMode('fused'),true)
  assert.equal(monitor.aoCompositeMode,'fused')
  monitor.enable(false)
  assert.equal(monitor.aoCompositeMode,'native')
  assert.equal(monitor.aoScale,1)
})

test('AO-G004-09: el desglose GPU de fusión no duplica composición ni AO total', () => {
  const {renderer,monitor}=gpuHarness()
  const p=createExperiment(monitor).pass
  monitor.wrapPass(p, 'AO');monitor.wrapAO(p)
  monitor.enable(true);monitor.setAoCompositeMode('fused')
  monitor.frameStart();p.render(renderer, {id:'out'}, {texture:{id:'scene'}});monitor.frameEnd()
  const s=monitor.stats.snapshot()
  assert.equal(s.gpuDetails['AO · fusión'].avg,1)
  assert.equal(s.gpuDetails['AO · copia'].avg,0)
  assert.equal(s.gpuDetails['AO · mezcla'].avg,0)
  assert.equal(s.gpu['AO · composición'].avg,1)
  const expected = ['AO','AO · oclusión','AO · denoise','AO · composición']
    .reduce((sum, key) => sum + (s.gpu[key]?.avg || 0), 0)
  assert.equal(s.gpu['AO · total'].avg,expected)
})

test('AO-G004-10: el modo nativo registra dos pasadas y el cambio descarta muestras antiguas', () => {
  const {renderer,monitor}=gpuHarness()
  const pass=createExperiment(monitor).pass
  monitor.wrapPass(pass,'AO');monitor.wrapAO(pass)
  monitor.enable(true);monitor.frameStart();pass.render(renderer,{}, {texture:{id:'scene'}});monitor.frameEnd()
  let s=monitor.stats.snapshot()
  assert.equal(s.gpu['AO · composición'].avg,2)
  monitor.setAoCompositeMode('fused')
  assert.equal(Object.keys(monitor.stats.snapshot().gpu).length,0)
  monitor.frameStart();pass.render(renderer,{}, {texture:{id:'scene'}});monitor.frameEnd()
  s=monitor.stats.snapshot()
  assert.equal(s.gpuDetails['AO · copia'].avg,0)
  assert.equal(s.gpuDetails['AO · fusión'].avg,1)
})

test('AO-G004-11: Stats oculta el experimento de composición y el preset conserva 16+16', () => {
  assert.doesNotMatch(panel,/lf-ao-composite-mode|setAoCompositeMode|AO · composición experimental/)
  assert.match(look,/samples: 16, distanceFallOff: 1/)
  assert.match(look,/rings: 2, samples: 16/)
  assert.match(look,/if \(p === this\.aoPass\) this\.vp\.perf\.wrapAO\(p\)/)
  assert.doesNotMatch(read('src/engine/runtime/render/config.js'),/aoCompositeMode/)
})

test('AO-G004-12: el shader usa dos texturas, intensidad y no tiene blending adicional', () => {
  const {pass}=createExperiment({enabled:true,aoCompositeMode:'fused'})
  pass.render({}, {}, {texture:{id:'scene'}})
  const m=pass._lfAoFusedMaterial
  assert.match(m.fragmentShader,/sceneColor\.rgb \* light/)
  assert.match(m.fragmentShader,/sceneColor\.a \* occlusion\.a/)
  assert.match(m.fragmentShader,/mix\(vec3\(1\.0\), occlusion\.rgb, intensity\)/)
  assert.equal(m.blending,0)
  assert.equal(m.depthTest,false)
  assert.equal(m.depthWrite,false)
})

test('AO-G004-13: integración real: wrapPass antes de instalar la variante y wrapAO después', () => {
  const {renderer,monitor}=gpuHarness()
  const {pass,experiment,calls}=createExperiment(monitor,false)
  monitor.wrapPass(pass,'AO')
  experiment._installAoCompositeExperiment(pass)
  monitor.wrapAO(pass)
  monitor.enable(true);monitor.setAoCompositeMode('fused')
  monitor.frameStart();pass.render(renderer,{id:'out'},{texture:{id:'scene'}});monitor.frameEnd()
  assert.equal(calls.length,3)
  const s=monitor.stats.snapshot()
  assert.equal(s.gpuDetails['AO · fusión'].avg,1)
  assert.equal(s.gpuDetails['AO · copia'].avg,0)
  assert.equal(s.gpu['AO · composición'].avg,1)
})

test('AO-G004-14: alternar modo y cerrar Stats restaura copia/mezcla sin reconstruir el pase', () => {
  const {renderer,monitor}=gpuHarness()
  const {pass,calls}=createExperiment(monitor)
  monitor.enable(true)
  assert.equal(monitor.setAoCompositeMode('fused'),true)
  pass.render(renderer,{}, {texture:{id:'scene'}})
  assert.equal(calls.length,3)
  calls.length=0
  monitor.setAoCompositeMode('native')
  pass.render(renderer,{}, {texture:{id:'scene'}})
  assert.equal(calls.length,4)
  calls.length=0
  monitor.setAoCompositeMode('fused');monitor.enable(false)
  pass.render(renderer,{}, {texture:{id:'scene'}})
  assert.equal(calls.length,4)
})
