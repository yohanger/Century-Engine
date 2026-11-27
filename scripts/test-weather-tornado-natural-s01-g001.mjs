import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { World } from '../src/engine/runtime/world/world.js'
import { MORPH } from '../src/engine/runtime/world/cloudfield.js'
import { SKY_FRAG, stormCoverFromFrame } from '../src/engine/runtime/render/skylib.js'
import { tornadoVisualState } from '../src/engine/runtime/world/tornado-visual.js'

const code = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const make = (model='cells', seed=123) => new World(38).configure({ weather: {
  on: true, preset: 'storm', cloudModel: model, cloudSeed: seed,
  tornadoEnabled: true, tornadoMode: 'script', tornadoDevelopmentSeconds: 3,
  tornadoOrganizationSeconds: 3, tornadoFormationSeconds: 3, tornadoDuration: 4,
  tornadoWeakeningSeconds: 3, tornadoDissipationSeconds: 3,
}})

function bridge() {
  const source = code('src/engine/runtime/render/viewport-env.js').replace(/^import .*\n/gm, '').replace('export const envMethods =','const envMethods =')
  const vec4 = () => ({ x:0,y:0,z:0,w:0,set(x,y,z,w){ Object.assign(this,{x,y,z,w}) } })
  const val = value => ({value})
  const set = () => ({set(){}})
  const u = {uTornadoCloud:val(vec4()),uTornadoShape:val(vec4()),uTornadoOrganization:val(vec4()),
    uStormCover:val(0),uCCells:val(0),uWindOff:val(set()),uStars:val(0),uMoonVis:val(0),uFlash:val(0),
    uMoonDir:val(set()),uStarAxis:val(set()),uStarAng:val(0),uAstro:val(0),uCAmb:val({copy(){return this},addScalar(){return this}})}
  const context = {tornadoVisualState,stormCoverFromFrame,applyAstro(){},normalizeSky(){},lightingMode(){},buildShape(){},buildDetail(){},
    setFogStart(){},normalizeFog(){},fogParams(){},shaftStrength(){},liveAtmoVolumes(){},THREE:{}}
  vm.runInNewContext(source+'\nthis.setWorld = envMethods.setWorld',context)
  const vp = {skyMat:{uniforms:u},_cAmbBase:null,_wkey:null,_env:{},requestRender(){},_applyEnv(){},_cellClouds(){},_rawEnv:{}}
  return { update:f=>context.setWorld.call(vp,f),u }
}

test('TN1-01: sin episodio no hay nube madre ni fuerza adicional', () => {
  const w=make();w.update(0.2);assert.equal(w.tornado.phase,'idle');assert.equal(w.tornado.motherKey,undefined)
  assert.equal(w.tornadoWindAt(0,1,0).x,0)
})
test('TN1-02: selecciona una fuente del mosaico real, con clave estable', () => {
  const w=make();w.startTornado({weatherTransition:0});const t=w.tornado
  assert.equal(t.motherKey,w.field._worldKey(t.motherSx,t.motherSz))
  assert.deepEqual(w.field.selectTornadoMother(t.x,t.z),{motherKey:t.motherKey,motherSx:t.motherSx,motherSz:t.motherSz})
  assert.strictEqual(w.field.tornado,t)
})
test('TN1-03: misma semilla y posición seleccionan la misma nube', () => {
  const a=make(),b=make();a.startTornado();b.startTornado();
  assert.deepEqual([a.tornado.motherSx,a.tornado.motherSz,a.tornado.motherKey],
    [b.tornado.motherSx,b.tornado.motherSz,b.tornado.motherKey])
})
test('TN1-04: la selección no reposiciona el mapa/cámara ni crea una celda extra', () => {
  const w=make();w.update(0.3);const map=w.field.map,ids=w.field.cells.map(c=>c.id),before=w.field.map.version
  w.startTornado({weatherTransition:0});assert.strictEqual(w.field.map,map)
  assert.equal(w.field.map.version,before);assert.deepEqual(w.field.cells.map(c=>c.id),ids)
})
test('TN1-05: la nube seleccionada madura como cumulonimbo durante organización', () => {
  const w=make();w.startTornado({weatherTransition:0});w.tornadoStep(5.8);w.update(0.3)
  const t=w.tornado,c=w.field.evaluate(t.motherSx,t.motherSz)
  assert.equal(c.morph,MORPH.CUMULONIMBUS);assert.ok(c.condensate>0.7)
  assert.ok(c.thick>0);assert.ok(c.tau>0)
})
test('TN1-06: consultar una nube lejana no altera la morfología de la madre', () => {
  const w=make();w.startTornado({weatherTransition:0});w.tornadoStep(6);w.update(0.3)
  const t=w.tornado,c=w.field.evaluate(t.motherSx,t.motherSz),key=c.key,condensate=c.condensate
  w.field.evaluate(t.motherSx+999,t.motherSz+999)
  const again=w.field.evaluate(t.motherSx,t.motherSz)
  assert.equal(again.key,key)
  assert.equal(again.condensate,condensate)
})
test('TN1-07: la asociación se mantiene al mover el tornado sin reasignación brusca', () => {
  const w=make();w.startTornado();const key=w.tornado.motherKey
  w.modifyTornado({x:250,z:-170});w.tornadoStep(2)
  assert.equal(w.tornado.motherKey,key)
})
test('TN1-08: classic no crea un CloudField suplementario', () => {
  const w=make('classic');assert.equal(w.field,null)
  assert.equal(w.startTornado(),true)
  assert.equal(w.tornado.motherKey,undefined)
  const b=bridge();b.update(w.frame());assert.ok(b.u.uTornadoOrganization.value.w>0)
})
test('TN1-09: Sky organiza y desciende poco a poco sin llegar al suelo antes de formación', () => {
  const w=make(),b=bridge();w.startTornado();w.tornadoStep(1);b.update(w.frame())
  assert.ok(b.u.uTornadoOrganization.value.w>0)
  const early=b.u.uTornadoShape.value.z
  assert.ok(early>0 && early<0.1)
  w.tornadoStep(4);b.update(w.frame())
  assert.ok(b.u.uTornadoOrganization.value.w>=0.5)
  assert.ok(b.u.uTornadoShape.value.z>early && b.u.uTornadoShape.value.z<0.2)
})
test('TN1-10: la formación extiende el embudo más allá del descenso de organización', () => {
  const w=make(),b=bridge();w.startTornado();w.tornadoStep(6.5);b.update(w.frame())
  assert.ok(b.u.uTornadoShape.value.z>0.18)
})
test('TN1-11: apagado y parada restauran la organización a cero', () => {
  const w=make(),b=bridge();w.startTornado();b.update(w.frame());assert.ok(b.u.uTornadoOrganization.value.w>0)
  w.stopTornado(true);b.update(w.frame());assert.equal(b.u.uTornadoOrganization.value.w,0)
  b.update(null);assert.equal(b.u.uTornadoOrganization.value.w,0)
})
test('TN1-12: restoreCloudField mantiene semilla efectiva y deriva sin otra autoridad', () => {
  const a=make('cells',0);a.startTornado();a.update(1)
  const s={seed:a.field.seed,windOff:[...a.field.windOff],evolution:a.field.evolution}, t={...a.tornado}
  const b=make('cells',0);b.restoreCloudField(s);b.restoreTornado(t)
  assert.equal(b.field.seed,a.field.seed)
  assert.deepEqual(b.field.windOff,a.field.windOff)
  assert.equal(b.field.evolution,a.field.evolution)
  assert.deepEqual([b.tornado.motherKey,b.tornado.motherSx,b.tornado.motherSz],
    [a.tornado.motherKey,a.tornado.motherSx,a.tornado.motherSz])
  assert.strictEqual(b.field.tornado,b.tornado)
})
test('TN1-13: snapshot incoherente se rechaza antes de cambiar semilla o nube madre', () => {
  const w=make();w.startTornado();const old=w.field
  assert.throws(()=>w.restoreCloudField({seed:7,windOff:[Infinity,0],evolution:0}),/snapshot/)
  assert.strictEqual(w.field,old)
  assert.throws(()=>w.restoreTornado({...w.tornado,motherKey:123}),/nube madre incompatible/)
  assert.strictEqual(w.field,old)
})
test('TN1-14: guardado real Player conserva semilla, deriva e identidad del episodio', () => {
  const s=code('src/engine/runtime/events/play-saves.js')
  assert.match(s,/cloudField: \{ seed: w\.field\.seed, windOff: \[\.\.\.w\.field\.windOff\], evolution: w\.field\.evolution \}/)
  assert.match(s,/world\.restoreCloudField\(w\.cloudField\)/)
  assert.match(s,/world\.restoreTornado\(snapshot\)/)
})
test('TN1-15: shader comparte un solo campo de densidad para organización en ambos modos', () => {
  assert.match(SKY_FRAG,/vec2 organizedCloudOffset\(vec3 wp, float hf\)/)
  assert.match(SKY_FRAG,/wp\.xz \+ organized \+ uCCam/)
  assert.match(SKY_FRAG,/wp\.x \+ organized\.x \+ uWindOff\.x/)
  assert.match(SKY_FRAG,/wp\.x \+ organized\.x \+ uCAtm\.x/)
  assert.doesNotMatch(SKY_FRAG,/sampler2D uTornadoCloudMap/)
})
test('TN1-16: mismo estado de Sky cuando no hay tornado y sin bake IBL localizado', () => {
  const b=bridge(),w=make();b.update(w.frame())
  assert.equal(b.u.uTornadoOrganization.value.w,0)
  const env=code('src/engine/runtime/render/viewport-env.js')
  assert.match(env,/u\.uTornadoOrganization\.value\.w = 0/)
})
test('TN1-17: no se duplican física, partículas VFX3D, World o CloudField', () => {
  assert.doesNotMatch(code('src/engine/runtime/world/cloudfield.js'),/new VfxSimulation|new WebGLRenderer|new World\(/)
  assert.doesNotMatch(code('src/engine/runtime/render/skylib.js'),/new VfxSimulation|createWeatherVfx3D/)
})
test('TN1-18: fixture GPU usa Electron interno y muestra la organización del mismo shader', () => {
  const fixture=code('scripts/fixtures/weather/tornado-natural-s01.html')
  assert.match(fixture,/uTornadoOrganization/)
  assert.match(SKY_FRAG,/organizedCloudOffset/)
  const qa=code('scripts/test-weather-tornado-natural-electron-s01-g001.mjs')
  assert.match(qa,/verifyWebGL\(/)
  assert.doesNotMatch(qa,/brave|chromium|puppeteer/)
})
