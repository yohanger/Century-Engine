import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { SKY_VERT, SKY_FRAG } from '../src/engine/runtime/render/skylib.js'
import { skyVariantState, specializeSkyFragment, SkyVariants } from '../src/engine/runtime/render/sky-variants.js'

function uniforms() { return {
 uMode:{value:0},uClouds:{value:1},uCCells:{value:1},uCVolumeOrigin:{value:new THREE.Vector4(1,2,900,1/1000)},
 uTornadoCloud:{value:new THREE.Vector4(5,6,7,0)},uTornadoOrganization:{value:new THREE.Vector4(5,6,7,0)},
 uMoonColor:{value:new THREE.Color(0,0,0)},uStars:{value:0},uMoonVis:{value:0},uCloudSteps:{value:56},uTime:{value:10},
} }

test('especialización conserva muestras, resolución temporal y fórmulas de dispersión',()=>{
 const u=uniforms(),s=specializeSkyFragment(SKY_FRAG,skyVariantState(u))
 assert.match(s,/const int uMode = 0;/);assert.match(s,/const int uCCells = 1;/)
 assert.match(s,/const vec4 uTornadoCloud = vec4\(0.0\);/)
 assert.match(s,/if \(true\) return max\(root, simulatedCloudDensity/)
 assert.match(s,/uniform int uClouds, uCloudSteps, uCloudDiagnostic/)
 assert.match(s,/uniform float uCamY, uTime/)
 assert.ok(s.includes(SKY_FRAG.slice(SKY_FRAG.indexOf('vec2 scatterCloudLight'),SKY_FRAG.indexOf('// Intersección con una esfera'))))
})

test('noche, volumen, astronomía y tornado producen claves distintas y mantienen sus rutas activas',()=>{
 const u=uniforms(),initial=skyVariantState(u)
 u.uStars.value=1;u.uMoonVis.value=1;u.uMoonColor.value.setRGB(.1,.1,.1)
 u.uTornadoCloud.value.w=.6;u.uTornadoOrganization.value.w=.4
 const state=skyVariantState(u),s=specializeSkyFragment(SKY_FRAG,state)
 assert.notEqual(state.key,initial.key)
 assert.match(s,/uniform vec4 uTornadoCloud;/);assert.match(s,/uniform vec4 uTornadoOrganization;/)
 assert.match(s,/uniform vec3 uMoonColor;/);assert.match(s,/uniform float uStars, uMoonVis, uFlash;/)
 u.uCVolumeOrigin.value.w=0
 assert.notEqual(skyVariantState(u).key,state.key)
 assert.match(specializeSkyFragment(SKY_FRAG,skyVariantState(u)),/if \(uCVolumeOrigin.w > 0.0\)/)
})

function fixture({parallel=true,limit=8}={}) {
 const pending=[],calls=[],target={name:'previous'},u=uniforms()
 let current=target
 const material=new THREE.ShaderMaterial({uniforms:u,vertexShader:SKY_VERT,fragmentShader:SKY_FRAG})
 const geometry=new THREE.SphereGeometry(1,8,4),scene=new THREE.Scene(),envScene=new THREE.Scene(),sky=new THREE.Mesh(geometry,material)
 envScene.add(new THREE.Mesh(geometry,material))
 const renderer={extensions:{has:()=>parallel},getRenderTarget:()=>current,getActiveCubeFace:()=>2,getActiveMipmapLevel:()=>1,
  setRenderTarget(value){current=value},compileAsync(_scene,_camera,targetScene){calls.push({target:current,scene:targetScene});return new Promise((resolve,reject)=>pending.push({resolve,reject}))}}
 const vp={renderer,scene,envScene,sky,skyMat:material,camera:new THREE.PerspectiveCamera(),perf:{stats:{extra:{}}},requestRender(){}}
 const manager=new SkyVariants(vp,limit)
 return {vp,manager,pending,calls,target,u,cleanup(){manager.dispose();material.dispose();geometry.dispose()}}
}
const tick=async()=>{await new Promise(resolve=>setImmediate(resolve))}
async function ready(f){for(let i=0;i<3;i++){f.pending.shift().resolve();await tick()}}

test('compila los tres contextos secuencialmente y restaura el destino actual',async()=>{
 const f=fixture();const base=f.vp.skyMat
 assert.equal(f.manager.update(),base);assert.equal(f.calls.length,1);assert.equal(f.calls[0].target,null)
 assert.equal(f.vp.renderer.getRenderTarget(),f.target)
 assert.equal(f.manager.update(),base);assert.equal(f.calls.length,1)
 await ready(f)
 const specialized=f.manager.update()
 assert.notEqual(specialized,base);assert.equal(specialized.uniforms,base.uniforms)
 assert.equal(f.calls.length,3);assert.equal(f.calls[2].scene,f.vp.envScene)
 assert.equal(f.vp.renderer.getRenderTarget(),f.target)
 f.u.uTime.value=99;assert.equal(specialized.uniforms.uTime.value,99)
 assert.equal(f.manager.update(),specialized);assert.equal(f.calls.length,3)
 f.cleanup()
})

test('cambios de estado usan respaldo genérico hasta que la nueva variante está lista',async()=>{
 const f=fixture();f.manager.update();await ready(f);const day=f.manager.update()
 f.u.uMoonVis.value=1
 assert.equal(f.manager.update(),f.vp.skyMat)
 assert.notEqual(f.vp.sky.material,day)
 await ready(f);assert.notEqual(f.manager.update(),day)
 f.u.uMoonVis.value=0;assert.equal(f.manager.update(),day)
 f.cleanup()
})

test('sin compilación paralela no introduce compilaciones síncronas',()=>{
 const f=fixture({parallel:false});assert.equal(f.manager.update(),f.vp.skyMat);assert.equal(f.calls.length,0)
 assert.equal(f.vp.perf.stats.extra.skyVariant.status,'unavailable');f.cleanup()
})

test('contexto perdido conserva respaldo sin iniciar trabajo GPU',()=>{
 const f=fixture();f.vp._glLost=true
 assert.equal(f.manager.update(),f.vp.skyMat);assert.equal(f.calls.length,0);f.cleanup()
})

test('fallo de compilación conserva el shader original',async()=>{
 const f=fixture();f.manager.update();f.pending.shift().reject(Error('driver'));await tick()
 assert.equal(f.manager.update(),f.vp.skyMat);assert.equal(f.vp.perf.stats.extra.skyVariant.status,'failed');f.cleanup()
})

test('reinicio y disposición no publican una compilación antigua',async()=>{
 const f=fixture();f.manager.update();f.manager.reset();f.pending.shift().resolve();await tick()
 assert.equal(f.manager.entries.size,0);assert.equal(f.vp.sky.material,f.vp.skyMat);assert.equal(f.calls.length,1)
 f.cleanup()
})

test('caché acotada libera materiales y conserva el respaldo cuando todo está pendiente',async()=>{
 const f=fixture({limit:1});f.manager.update();f.u.uMoonVis.value=1
 assert.equal(f.manager.update(),f.vp.skyMat);assert.equal(f.manager.entries.size,1)
 await ready(f)
 const old=[...f.manager.entries.values()][0].material;let disposed=0;old.addEventListener('dispose',()=>disposed++)
 f.manager.update();assert.equal(disposed,1);assert.equal(f.manager.entries.size,1)
 f.cleanup();f.pending.shift().resolve();await tick()
})
