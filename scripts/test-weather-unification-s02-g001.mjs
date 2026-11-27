// S02: las nubes atmosféricas forman el tornado sin emisor meteorológico VFX3D.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { World } from '../src/engine/runtime/world/world.js'
import { normalizeWeather, migrateLegacyTornadoVisual } from '../src/engine/runtime/world/params.js'
import { SKY_FRAG } from '../src/engine/runtime/render/skylib.js'
import { tornadoVisualState } from '../src/engine/runtime/world/tornado-visual.js'
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8')
const makeWorld=()=>{
 const w=new World(51)
 w.configure({weather:{on:true,preset:'storm',tornadoEnabled:true,tornadoMode:'script',
  tornadoDevelopmentSeconds:1,tornadoOrganizationSeconds:1,tornadoFormationSeconds:3,
  tornadoWeakeningSeconds:1,tornadoDissipationSeconds:1,tornadoDuration:3}})
 return w
}
const vec4=()=>({x:0,y:0,z:0,w:0,set(x,y,z,w){Object.assign(this,{x,y,z,w})}})
const uniform=value=>({value})
function bridge(){
 const source=read('src/engine/runtime/render/viewport-env.js').replace(/^import .*\n/gm,'').replace('export const envMethods =','const envMethods =')
 const context={tornadoVisualState,applyAstro(){},normalizeSky(){},lightingMode(){},buildShape(){},buildDetail(){},setFogStart(){},normalizeFog(){},fogParams(){},shaftStrength(){},liveAtmoVolumes(){},THREE:{}}
 vm.runInNewContext(source+'\nthis.run = envMethods.setWorld',context)
 const u={uTornadoCloud:uniform(vec4()),uTornadoShape:uniform(vec4()),uTornadoOrganization:uniform(vec4()),uCCells:uniform(0),
 uWindOff:uniform({set(){}}),uStars:uniform(0),uMoonVis:uniform(0),uFlash:uniform(0),
 uMoonDir:uniform({set(){}}),uStarAxis:uniform({set(){}}),uStarAng:uniform(0),
 uAstro:uniform(0),uCAmb:uniform({copy(){return this},addScalar(){return this}})}
 const vp={skyMat:{uniforms:u},_cAmbBase:null,_wkey:null,_env:{},requestRender(){},_applyEnv(){},_cellClouds(){},_rawEnv:{}}
 return {update:frame=>context.run.call(vp,frame),u}
}
test('WU2-01: el shader atmosférico extiende su nube hacia el terreno',()=>{
 assert.match(SKY_FRAG,/tornadoCondensation\(vec3 wp\)/)
 assert.match(SKY_FRAG,/float atmosphericDensity\(vec3 p, bool full\)/)
 assert.doesNotMatch(SKY_FRAG,/vec4 tornadoCloudVolume\(/)
 assert.match(SKY_FRAG,/tornadoCloudRoot\(vec3 wp, float hf\)/)
 assert.match(SKY_FRAG,/uTornadoShape\.x/)
})
test('WU2-02: una sola esfera de cielo, sin malla ni renderer de tornado',()=>{
 const vp=read('src/engine/runtime/render/viewport.js')
 assert.match(vp,/this\.sky = new THREE\.Mesh\(new THREE\.SphereGeometry/)
 assert.match(vp,/uTornadoShape: \{ value: new THREE\.Vector4\(\) \}/)
 assert.doesNotMatch(read('src/engine/runtime/events/play-tornado.js'),/createWeatherVfx3D|new THREE\.Mesh|_tornadoWeatherVfx/)
})
test('WU2-03: misma paleta, densidad y textura 3D de la nube madre',()=>{
 assert.match(SKY_FRAG,/texture\(uShape, q \* 2\.0/)
 assert.match(SKY_FRAG,/acc\+=T\*alpha\*\(sunL\+ambL\)\*uCTint/)
 assert.match(SKY_FRAG,/vec3 ambL=uCAmb\*mix/)
 assert.doesNotMatch(SKY_FRAG,/sampler2D uTornadoTexture/)
})
test('WU2-04: la formación desciende según fases de World',()=>{
 const w=makeWorld();w.startTornado({weatherTransition:0});w.tornadoStep(1.5)
 const a=tornadoVisualState(w.tornado,900,{development:1,organization:1,formation:3})
 w.tornadoStep(1.5)
 const b=tornadoVisualState(w.tornado,900,{development:1,organization:1,formation:3})
 assert.ok(b.reach>a.reach && b.opacity>a.opacity)
 assert.equal(w.tornado.height,65,'la altura física no se ajusta al embudo visual')
})
test('WU2-05: World alimenta la posición y la base del embudo',()=>{
 const w=makeWorld(),{update,u}=bridge();w.startTornado({weatherTransition:0});w.tornadoStep(2.2)
 update(w.frame());assert.equal(u.uTornadoCloud.value.x,w.tornado.x)
 assert.equal(u.uTornadoCloud.value.y,w.tornado.z)
 assert.ok(u.uTornadoShape.value.y>u.uTornadoShape.value.x)
 assert.ok(u.uTornadoShape.value.z>0)
})
test('WU2-06: sin tornado ni clima, el shader desactiva la condensación',()=>{
 const w=makeWorld(),{update,u}=bridge()
 update(w.frame());assert.equal(u.uTornadoCloud.value.w,0)
 w.startTornado({weatherTransition:0});w.tornadoStep(2.3);update(w.frame());assert.ok(u.uTornadoCloud.value.w>0)
 update(null);assert.equal(u.uTornadoCloud.value.w,0)
})
test('WU2-07: antigua propiedad se migra sin tocar datos del usuario',()=>{
 const raw={on:true,preset:'storm',tornadoEnabled:true,tornadoVfxNodeId:'custom-vfx',tornadoRadius:42}
 const result=migrateLegacyTornadoVisual(raw)
 assert.equal(result.migrated,true);assert.equal(raw.tornadoVfxNodeId,'custom-vfx')
 assert.equal(Object.hasOwn(result.weather,'tornadoVfxNodeId'),false)
 const normalized=normalizeWeather(raw)
 assert.equal(Object.hasOwn(normalized,'tornadoVfxNodeId'),false)
 assert.equal(normalized.tornadoRadius,42)
})
test('WU2-08: el Inspector no expone emisor VFX de tornado',()=>{
 const src=read('src/engine/runtime/world/params.js')
 assert.doesNotMatch(src,/key:'tornadoVfxNodeId'|Emisor VFX3D del tornado/)
 assert.match(src,/tornadoWaterVfxNodeId|tornadoFireVfxNodeId/)
})
test('WU2-09: Play conserva Jolt y eventos sin tocar nodos VFX',()=>{
 const src=read('src/engine/runtime/events/play-tornado.js')
 assert.match(src,/w\.tornadoStep\(dt\)/)
 assert.match(src,/B\.impulse\(item,/)
 assert.match(src,/_tornadoEmit\('tornadoPhase'/)
 assert.doesNotMatch(src,/tornadoFlowActive|tornadoConditionalActive|createWeatherVfx3D/)
})
test('WU2-10: guardado y salto temporal no gestionan emisores automáticos',()=>{
 for(const p of ['src/engine/runtime/events/play-saves.js','src/engine/runtime/events/play-controls.js']){
  const s=read(p);assert.doesNotMatch(s,/_tornadoWeatherVfx|_tornadoSyncVisual|_tornadoVisual/)
 }
})
test('WU2-11: raster con límites locales, sin marchar en todos los píxeles',()=>{
 assert.match(SKY_FRAG,/if \(disc > 0\.0\)/)
 assert.match(SKY_FRAG,/if \(cloudSteps == 0 && funnelSteps == 0\)/)
 assert.match(SKY_FRAG,/int funnelSteps = funnelFar > funnelNear \? 12 : 0/)
})
test('WU2-12: ningún efecto ni recurso VFX ordinario se elimina',()=>{
 const node=read('src/engine/runtime/nodes/vfx.js')
 assert.match(node,/const vfxDef = registerNode/)
 assert.match(node,/new VfxSimulation\(resource/)
 assert.match(node,/new VfxBillboardRenderer\(simulation/)
 assert.doesNotMatch(node,/createWeatherVfx3D/)
})
