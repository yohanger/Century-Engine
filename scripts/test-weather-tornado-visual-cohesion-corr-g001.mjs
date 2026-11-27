// Cohesión tornado/nubes: autoridad compartida, enlace GPU y regresión sin dependencia de Chromium.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { World } from '../src/engine/runtime/world/world.js'
import { tornadoVisualState } from '../src/engine/runtime/world/tornado-visual.js'
import { SKY_FRAG, stormCoverFromFrame } from '../src/engine/runtime/render/skylib.js'
import { VfxSimulation } from '../src/engine/runtime/vfx/simulation.js'
import { newVfxResource, validateVfxResource } from '../src/engine/runtime/vfx/resource.js'

const makeWorld=()=>{
  const world=new World(71)
  world.configure({weather:{on:true,preset:'storm',tornadoEnabled:true,tornadoMode:'script',
    tornadoDevelopmentSeconds:2,tornadoOrganizationSeconds:2,tornadoFormationSeconds:4,tornadoDuration:5,
    tornadoWeakeningSeconds:2,tornadoDissipationSeconds:2}})
  return world
}

function uniform(value) {return {value}}
function vec4(){return {x:0,y:0,z:0,w:0,set(x,y,z,w){Object.assign(this,{x,y,z,w})}}}
function vec3(){return {set(x,y,z){Object.assign(this,{x,y,z})}}}
function setupSky(){
  const source=readFileSync(new URL('../src/engine/runtime/render/viewport-env.js',import.meta.url),'utf8')
    .replace(/^import .+\n/gm,'').replace('export const envMethods =','const envMethods =')
  const ctx={tornadoVisualState,stormCoverFromFrame,applyAstro(){},normalizeSky(){},lightingMode(){},buildShape(){},buildDetail(){},setFogStart(){},normalizeFog(){},fogParams(){},shaftStrength(){},liveAtmoVolumes(){},THREE:{}}
  vm.runInNewContext(source+'\nthis.setWorld = envMethods.setWorld;',ctx)
  const u={uStormCover:uniform(0),uTornadoCloud:uniform(vec4()),uTornadoShape:uniform(vec4()),uTornadoOrganization:uniform(vec4()),uCCells:uniform(0),uWindOff:uniform({set(){}}),uStars:uniform(0),uMoonVis:uniform(0),uFlash:uniform(0),uMoonDir:uniform(vec3()),uStarAxis:uniform(vec3()),uStarAng:uniform(0),uAstro:uniform(0),uCAmb:uniform({copy(){return this},addScalar(){return this}})}
  const vp={skyMat:{uniforms:u},_cAmbBase:null,_wkey:null,_env:{},requestRender(){},_applyEnv(){},_cellClouds(){},_rawEnv:{}}
  return {setWorld:ctx.setWorld,vp,u}
}

test('VC-01: World.frame expone el tornado único y la configuración meteorológica existente',()=>{
  const world=makeWorld(), f=world.frame()
  assert.strictEqual(f.tornado,world.tornado)
  assert.strictEqual(f.tornadoDurations,world.cfg.weather)
  assert.equal(f.tornado.phase,'idle')
  world.startTornado({weatherTransition:0});world.tornadoStep(5)
  assert.strictEqual(world.frame().tornado,world.tornado)
})
test('VC-02: nubes y embudo usan la MISMA fase, centro y radio desde World',()=>{
  const world=makeWorld(),{setWorld,vp,u}=setupSky()
  setWorld.call(vp,world.frame())
  assert.equal(u.uTornadoCloud.value.w,0)
  world.startTornado({weatherTransition:0});world.tornadoStep(3.4)
  const f=world.frame(),t=f.tornado
  setWorld.call(vp,f)
  const strength=u.uTornadoCloud.value
  assert.equal(strength.x,t.x);assert.equal(strength.y,t.z)
  assert.equal(strength.z,Math.max(35,t.radius*5))
  const expected=tornadoVisualState(t,f.clouds.altitude,{development:2,organization:2,formation:4,weakening:2,dissipation:2})
  assert.ok(Math.abs(strength.w-expected.opacity)<1e-9)
})
test('VC-03: mover tornado actualiza la localización del cielo sin crear otro estado',()=>{
  const world=makeWorld(),{setWorld,vp,u}=setupSky()
  world.startTornado({weatherTransition:0});world.tornadoStep(3)
  world.modifyTornado({x:240,z:-170})
  setWorld.call(vp,world.frame())
  assert.equal(u.uTornadoCloud.value.x,world.tornado.x)
  assert.equal(u.uTornadoCloud.value.y,world.tornado.z)
  setWorld.call(vp,null)
  assert.equal(u.uTornadoCloud.value.w,0,'al parar Play no queda condensación atmosférica')
})
test('VC-04: el modelo de nube no inyecta esfera ni segundo renderer',()=>{
  assert.match(SKY_FRAG,/tornadoCloudRoot\(vec3 wp, float hf\)/)
  assert.match(SKY_FRAG,/return max\(clamp\(d, 0\.0, 1\.0\), root\) \* uCDens/)
  assert.match(SKY_FRAG,/uCamXZ - uTornadoCloud\.xy/)
  assert.match(SKY_FRAG,/if \(uTornadoCloud\.w <= 0\.001\) return 0\.0/)
  assert.doesNotMatch(SKY_FRAG,/uniform sampler2D uTornado/)
})
test('VC-05: nube atmosférica sin tornado queda inalterada, sin redibujar IBL localizado',()=>{
  const env=readFileSync(new URL('../src/engine/runtime/render/viewport-env.js',import.meta.url),'utf8')
  assert.match(env,/u\.uTornadoCloud\.value\.w = 0/)
  assert.match(env,/u\.uTornadoOrganization\.value\.w = 0/)
  assert.match(env,/u\.uTornadoOrganization\.value\.w\] = keep/)
  const vp=readFileSync(new URL('../src/engine/runtime/render/viewport.js',import.meta.url),'utf8')
  assert.match(vp,/uCamXZ\.value\.set\(this\.camera\.position\.x, this\.camera\.position\.z\)/)
})
test('VC-06: la condensación utiliza el tinte y la iluminación de la nube madre',()=>{
 assert.match(SKY_FRAG,/acc\+=T\*alpha\*\(sunL\+ambL\)\*uCTint/)
 assert.match(SKY_FRAG,/uCAmb\*mix\(0\.35,1\.25,hf\)/)
 assert.doesNotMatch(readFileSync(new URL('../src/engine/runtime/nodes/vfx.js',import.meta.url),'utf8'),/createWeatherVfx3D/)
})
test('VC-07: VFX3D genérico y recursos permanecen disponibles',()=>{
 const res=validateVfxResource(newVfxResource('vfx','Smoke.vfx'))
 const sim=new VfxSimulation(res,{seed:12});assert.equal(sim.visualTint,undefined)
 assert.match(readFileSync(new URL('../src/engine/runtime/nodes/vfx.js',import.meta.url),'utf8'),/VfxBillboardRenderer/)
})
test('VC-08: la representación meteorológica no introduce físicas ni emisores',()=>{
 const src=readFileSync(new URL('../src/engine/runtime/events/play-tornado.js',import.meta.url),'utf8')
 assert.doesNotMatch(src,/createWeatherVfx3D|new VfxSimulation|new WebGLRenderer/)
 assert.match(src,/w\.tornadoWindAt/)
})
