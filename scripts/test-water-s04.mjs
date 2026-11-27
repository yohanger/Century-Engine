// Water S04 / AMEND-001: snapshots, guardado, replay y vinculación perceptual con el mismo estado.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { WaterRegion } from '../src/engine/runtime/geometry/water-solver.js'
const root = resolve(import.meta.dirname, '..')
const code = (rel) => readFileSync(resolve(root, 'src/engine/runtime', rel), 'utf8')
const fixed = code('geometry/waterworld.js')
  .replace("import { collectWaterBodies, riverLine } from './waterfx.js'", 'const collectWaterBodies = (items) => items; const riverLine = () => []')
  .replace("import { waveSet } from './water.js'", 'const waveSet = () => ({ big: [] })')
  .replace("import { WaterRegion } from './water-solver.js'", `import { WaterRegion } from '${new URL('../src/engine/runtime/geometry/water-solver.js', import.meta.url).href}'`)
const { WaterWorld } = await import(`data:text/javascript,${encodeURIComponent(fixed)}`)
const create = (id = 'a') => new WaterRegion({ id, width: 4, height: 4, bed: new Array(16).fill(2), depth: new Array(16).fill(0) })
const mutate = (r) => { r.queue(1, 1, 2.7); r.step(1/30); r.queue(1, 2, 0.3); return r }

test('W27: snapshot conserva altura, momento, balance y aportes pendientes', () => {
  const r = mutate(create()), snap = JSON.parse(JSON.stringify(r.snapshot()))
  assert.ok(snap.qx.length === 16 && snap.qz.length === 16 && snap.pending.length === 1)
  const other = create()
  other.restoreValidated(other.validateSnapshot(snap))
  assert.deepEqual(other.snapshot(), snap)
  assert.ok(Math.abs(other.balanceError()) < 1e-9)
  other.step(1/30); r.step(1/30)
  assert.deepEqual(other.snapshot(), r.snapshot())
})
test('W27: snapshot corrupto no cambia el estado al rechazarlo', () => {
  const r = mutate(create()), before = r.snapshot()
  for (const bad of [
    { ...before, depth: before.depth.slice(0, -1) },
    { ...before, qx: undefined },
    { ...before, depth: before.depth.map((v,i) => i === 0 ? -1 : v) },
    { ...before, depth: before.depth.map((v,i) => i === 0 ? NaN : v) },
    { ...before, pending: [[-1,1]] },
    { ...before, ledger: { ...before.ledger, added: 100 } },
    { ...before, bed: before.bed.map((v,i) => i === 0 ? v+1 : v) },
  ]) {
    assert.throws(() => r.validateSnapshot(bad))
    assert.deepEqual(r.snapshot(), before)
  }
})
test('W27: restauración atómica entre regiones, incluso si segunda está dañada', () => {
  const w = new WaterWorld(), a = w.addRegion({ id:'a', width:4,height:4 }), b = w.addRegion({ id:'b',x:10,width:4,height:4 })
  a.queue(0,0,1); a.step(1/60); b.queue(0,0,2); b.step(1/60)
  const saved = w.snapshot(), before = JSON.stringify(saved)
  const invalid = structuredClone(saved); invalid.regions[1].bed[0] = 99
  assert.throws(() => w.restore(invalid), /geometría/)
  assert.equal(JSON.stringify(w.snapshot()), before)
  w.changeVolume('a',0,0,1); w.step(1/60); w.restore(saved)
  assert.deepEqual(w.snapshot(), saved)
  assert.ok(w.at(0.5,0.5)?.surface > 0)
})
test('W27/W28: versión y topología incompatibles se rechazan', () => {
  const w = new WaterWorld(); w.addRegion({id:'a',width:2,height:2})
  assert.throws(()=>w.restore({ version:4,regions:[] }),/snapshot/)
  assert.throws(()=>w.restore({ version:1,regions:[] }),/snapshot/)
})
test('W31: pasos de región seca no alteran el estado ni reservan flujos innecesarios', () => {
  const r = create(); const scratch = r._scratch
  for (let i=0;i<10;i++) assert.equal(r.step(1/60).substeps,0)
  assert.strictEqual(r._scratch,scratch)
  mutate(r); r.step(1/60); assert.strictEqual(r._scratch,scratch)
})
test('W28: guardado y carga usan API existente; partidas antiguas compatibles', () => {
  const src = code('events/play-saves.js')
  assert.match(src, /water: this\._waterConnection \? this\.water\.snapshot\(\) : null/)
  assert.match(src,/if \(w\.water != null\)/)
  assert.match(src,/this\.water\.restore\(w\.water\)/)
})
test('W29: Film Maker reproduce clima y agua por el mismo paso y actualiza malla', () => {
  const src = code('events/play-controls.js')
  const fragment = src.slice(src.indexOf('  filmJump(t)'), src.indexOf('  _simStep('))
  assert.match(fragment,/this\.water\.restore\(this\._waterFilmInitial\)/)
  assert.match(fragment,/w\.update\(1 \/ 60\)\s+this\._waterConnection\?\.step\(1 \/ 60\)/)
  assert.match(fragment,/this\.ed\.updatePhysicalWater\(this\.water\)/)
  assert.match(code('events/play.js'),/this\._waterFilmInitial = this\.film && this\._waterConnection/)
})
test('W32 AMEND: lluvia impacta agua y usa Ripple existente sin alterar volumen', () => {
  assert.match(code('scene/water.js'),/rainWaterRipple\(hit\)/)
  assert.match(code('scene/water.js'),/addRipple\(p\[0\], p\[2\], 0\.11\)/)
  assert.match(code('scene-graph.js'),/precip\.onImpact = \(hit\) => this\.rainWaterRipple\(hit\)/)
  assert.match(code('world/fx.js'),/this\.onImpact\?\.\(hit\)/)
  assert.doesNotMatch(code('scene/water.js').slice(0,1300),/changeVolume\(/)
})
test('W32 AMEND: PBR lee profundidad y corrientes reales; no dobla marea heredada', () => {
  const shader = code('geometry/watershader.js'), surface = code('geometry/water-surface.js')
  assert.match(shader,/simulated \? "rtAFlow"/)
  assert.match(shader,/simulated \? "false" : "true"/)
  assert.match(shader,/rtSimDepth \/ max\(rtWFx\.x/)
  assert.match(surface,/region\.qx\[k\] \/ d/)
  assert.match(surface,/region\.qz\[k\] \/ d/)
  assert.match(surface,/geom\.attributes\.rtAFlow\.needsUpdate = true/)
})

test('W29 conductual: salto temporal reinicia, avanza clima primero y agua después, sin acumular saltos', () => {
  const source = code('events/play-controls.js')
  const factory = Function('doc','physicsStep',source
    .replace("import { doc } from '../platform.js'", '')
    .replace("import { physicsStep } from '../templates/gameParams.js'", '')
    .replace("import { refreshCameraFov } from '../render/camera-fov.js'", '')
    .replace('export const controlsMethods', 'const controlsMethods') + '\nreturn controlsMethods')
  const controls = factory({},()=>1/60)
  const events = [], host = {
    film: {seed:11,time:0,acc:0},
    project:{environment:{}},
    ed:{world:{configure:()=>events.push('config'),reseed:()=>events.push('seed'),update:()=>events.push('clima'),flash:0,_pulses:[]},
      updatePhysicalWater:()=>events.push('vista'),applyWorld:()=>events.push('presenta')},
    _waterConnection:{step:()=>events.push('agua')},
    _waterFilmInitial:{version:1,regions:[]},
    water:{restore:()=>events.push('restaura')}, vp:{requestRender:()=>events.push('render')}
  }
  controls.filmJump.call(host, 2/60)
  assert.deepEqual(events,['config','seed','restaura','clima','agua','clima','agua','vista','presenta','render'])
  events.length=0
  controls.filmJump.call(host, 1/60)
  assert.deepEqual(events,['config','seed','restaura','clima','agua','vista','presenta','render'])
  assert.equal(host.film.time,1/60)
})
test('W32 conductual: lluvia genera onda solo en agua, con amortiguación de frecuencia', () => {
  const text = code('scene/water.js')
  const portion = text.slice(text.indexOf('  rainWaterRipple(hit) {'),text.indexOf('  /** Devuelve la primera cara'))
  const callback = Function('addRipple',`return ({${portion}}).rainWaterRipple`)
  const calls = [], handler = callback((...v)=>calls.push(v))
  const host = { _physicalWaterView:{water:{at:(x,z)=>x===2?{surface:3}:null, disturb:()=>true}} }
  handler.call(host,{point:[2,3,4], normal:[0,1,0]})
  handler.call(host,{point:[2,3,4], normal:[0,1,0]})
  handler.call(host,{point:[2,4,4], normal:[0,1,0]})
  handler.call(host,{point:[5,3,4], normal:[0,1,0]})
  assert.equal(calls.length,1)
  assert.deepEqual(calls[0],[2,4,0.11])
})
test('W30: con agua física el clima avanza en paso fijo; legado mantiene reloj anterior', () => {
  const src=code('events/play-controls.js')
  assert.match(src,/if \(!this\._waterConnection\) this\.ed\.tickWorld\(dt\)/)
  assert.match(src,/this\.ed\.world\.update\(fdt\)/)
  assert.match(src,/this\._waterConnection\?\.step\(fdt\)/)
})
test('W34: sin región física no se modifica render antiguo ni charco legacy',()=>{
  assert.match(code('render/wetlib.js'),/if \(uPhysicalCount == 0 && !rtHasPhysicalWater\(vTxz\)\)/)
  assert.match(code('geometry/waterworld.js'),/static fromObjects\(objects\)/)
})
