// Auditoría S00: invariantes de arquitectura, sin importar Three.js ni modificar runtime.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { VfxSimulation, VFX_MAX_PARTICLES } from '../src/engine/runtime/vfx/simulation.js'
import { newVfxResource } from '../src/engine/runtime/vfx/resource.js'

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8')
const path = {
  render:'src/engine/runtime/vfx/render.js', node:'src/engine/runtime/nodes/vfx.js',
  preview:'src/core/editor/vfx-preview.js', precip:'src/engine/runtime/world/fx.js',
  splash:'src/engine/runtime/world/splash.js', leaves:'src/engine/runtime/world/leaves.js',
  critter:'src/engine/runtime/critters/system.js', nature:'src/engine/runtime/world/nature.js',
  lightning:'src/engine/runtime/world/lightning-fx.js', viewport:'src/engine/runtime/render/viewport.js',
  water:'src/engine/runtime/geometry/waterworld.js', tornado:'src/engine/runtime/world/tornado-visual.js',
  sky:'src/engine/runtime/render/skylib.js', package:'src/engine/runtime/package/host.js',
  build:'src/core/buildList.js', look:'src/engine/runtime/render/look.js',
  fxwater:'src/engine/runtime/events/play-water.js', destruction:'src/engine/runtime/events/play-tornado-destruction.js',
}
const src = Object.fromEntries(Object.entries(path).map(([k,v])=>[k,read(v)]))
const count=(s,re)=>(s.match(re)||[]).length

test('AUD-01 · VFX3D y preview usan las mismas clases de simulación/render',()=>{
  for(const s of [src.node,src.preview]){
    assert.match(s,/new VfxSimulation\(/)
    assert.match(s,/new VfxBillboardRenderer\(/)
  }
})
test('AUD-02 · proyecto mantiene identidad y definición .vfx única',()=>{
  assert.match(src.node,/obj\.props\?\.vfxId/)
  assert.match(src.node,/scene\.host\.project\.vfx\.find/)
  assert.match(read('src/engine/runtime/vfx/resource.js'),/normalizeVfxCollection\(/)
  assert.match(src.package,/obj\.props\?\.vfxId/)
  assert.match(src.build,/o\.props\?\.vfxId/)
})
test('AUD-03 · la capacidad VFX CPU está limitada a 1024 por instancia',()=>{
  assert.equal(VFX_MAX_PARTICLES,1024)
  assert.throws(()=>new VfxSimulation({...newVfxResource('audit'), emission:{...newVfxResource('audit').emission,capacity:7000}}),/Emisión\.capacity/)
})
test('AUD-04 · PrecipFX utiliza su propio shader GPU instanciado y límites acotados',()=>{
  for(const n of ['7000','1800','520','384','64'])assert.match(src.precip,new RegExp(`\\b${n}\\b`))
  assert.match(src.precip,/new THREE\.InstancedBufferGeometry/)
  assert.match(src.precip,/new THREE\.ShaderMaterial/)
  assert.doesNotMatch(src.precip,/VfxSimulation|VfxBillboardRenderer/)
})
test('AUD-05 · las gotas comparten trayectorias GPU y no duplican volumen de WaterWorld',()=>{
  assert.match(src.precip,/TRACKED_DROPS = 384/)
  assert.match(src.precip,/MAX_IMPACT_CASTS = 64/)
  assert.match(src.precip,/traceRainSegment/)
  assert.doesNotMatch(src.precip,/new WaterWorld\(/)
  assert.match(src.water,/suspendedLiftM3/)
})
test('AUD-06 · SplashFX reutiliza un Points y un pool CPU',()=>{
  assert.match(src.splash,/const MAX = 480/)
  assert.match(src.splash,/new THREE\.Points\(/)
  assert.match(src.fxwater,/new SplashFX\(/)
  assert.doesNotMatch(src.splash,/VfxBillboardRenderer/)
})
test('AUD-07 · LeafFX usa 96 árboles x 14 GPU, con búsqueda temporal',()=>{
  for(const [re,text] of [[/MAX_TREES = 96/,'árboles'],[/PER_TREE = 14/,'hojas'],[/REFRESH = 1\.5/,'intervalo']]) assert.match(src.leaves,re,text)
  assert.match(src.leaves,/new THREE\.InstancedBufferGeometry/)
  assert.match(src.nature,/new LeafFX\(/)
})
test('AUD-08 · CritterSystem mantiene máquina de estados y Points único',()=>{
  assert.match(src.critter,/new CritterCluster\(/)
  assert.match(src.critter,/MAX = 2048/)
  assert.match(src.critter,/new THREE\.Points/)
  assert.match(src.nature,/new CritterSystem\(/)
})
test('AUD-09 · LightningFX usa una cinta de canal ramificada, no un emisor',()=>{
  assert.match(src.lightning,/new THREE\.BufferGeometry\(/)
  assert.match(src.lightning,/this\.mesh\.geometry\.dispose\(/)
  assert.match(src.viewport,/new LightningFX\(this\.scene\)/)
  assert.doesNotMatch(src.lightning,/VfxBillboardRenderer/)
})
test('AUD-10 · tornado visual sigue la nube madre y no crea VFX meteorológico',()=>{
  assert.match(src.sky,/tornadoCloudVolume/)
  assert.doesNotMatch(read('src/engine/runtime/events/play-tornado.js'),/createWeatherVfx3D/)
  assert.match(src.destruction,/tornadoWaterVfxNodeId|tornadoFireVfxNodeId/)
})
test('AUD-11 · AO excluye VFX y precipitación; LeafFX sigue por auditar',()=>{
  assert.match(src.render,/lfExcludeFromAO\s*=\s*true/)
  assert.match(src.look,/lfExcludeFromAO/)
  assert.match(src.precip,/lfExcludeFromAO/)
  assert.doesNotMatch(src.leaves,/lfExcludeFromAO/)
})
test('AUD-12 · no confundir renders de agua/ondas con el recurso de partículas',()=>{
  const ripple=read('src/engine/runtime/geometry/waterripple.js')
  assert.match(ripple,/RIPPLE_MAX = 16/)
  assert.match(ripple,/RIPPLE_GLSL/)
  assert.doesNotMatch(ripple,/VfxSimulation|VfxBillboardRenderer/)
})
test('AUD-13 · existen limpieza y propiedad de recursos GPU especializados',()=>{
  for(const k of ['splash','leaves','critter','lightning'])assert.match(src[k],/dispose\(\)/,k)
  assert.match(src.render,/dispose\(\)/)
})
test('AUD-14 · existe un único Viewport propietario de PrecipFX y LightningFX',()=>{
  assert.equal(count(src.viewport,/new PrecipFX\(/g),1)
  assert.equal(count(src.viewport,/new LightningFX\(/g),1)
})
test('AUD-15 · no se modifica producción en un Gate de auditoría',()=>{
  const f=read('scripts/fixtures/vfx/renderer-consolidation-audit.html')
  assert.match(f,/new VfxBillboardRenderer\(/)
  for(const n of ['PrecipFX','SplashFX','LeafFX','CritterSystem','LightningFX'])assert.match(f,new RegExp('new '+n+'\\('))
  assert.doesNotMatch(f,/SceneGraph|saveProject|applyMutation/)
})
test('AUD-16 · benchmark recoge contexto y no afirma GPU ni FPS',()=>{
  const b=read('scripts/bench-vfx-renderer-consolidation-s00-g001.mjs')
  assert.match(b,/VfxSimulation/)
  assert.match(b,/CPU aislada/)
  const f=read('scripts/fixtures/vfx/renderer-consolidation-audit.html')
  assert.match(f,/NO duración GPU, FPS ni equivalencia visual/)
})
test('AUD-17 · Electron se usa sin binario externo',()=>{
  const runner=read('scripts/test-vfx-renderer-consolidation-electron-s00-g001.mjs')
  assert.match(runner,/verifyWebGL/)
  assert.doesNotMatch(runner,/chromium|brave|spawnSync/)
})
