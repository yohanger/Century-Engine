// G003 · Sol/luna separados sin romper escenas antiguas y ayudas de iluminación coherentes.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizeTime } from '../src/engine/runtime/world/params.js'
import { World } from '../src/engine/runtime/world/world.js'
import { lightingMode, selectedSun } from '../src/engine/runtime/world/lighting.js'

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const lightSrc = read('src/engine/runtime/nodes/light.js')
const envSrc = read('src/engine/runtime/scene/environment.js')
const graphSrc = read('src/engine/runtime/scene-graph.js')
const params = read('src/engine/runtime/world/params.js')

test('G003-01: escenas anteriores conservan iluminación de una sola direccional', () => {
  assert.equal(normalizeTime({ on: true }).celestialLights, false)
  assert.equal(normalizeTime({ on: true, celestialLights: false }).celestialLights, false)
  assert.equal(normalizeTime({ on: true, celestialLights: 'true' }).celestialLights, false)
  assert.equal(normalizeTime({ on: true, celestialLights: true }).celestialLights, true)
  assert.match(params, /key: 'celestialLights'.*def: false/)
})
test('G003-02: World conserva keyDir/keyMul y publica factores independientes', () => {
  const w = new World().configure({ time: { on: true, celestialLights: true, hour: 0, moonLight: 0.2 } })
  const f = w.frame()
  assert.ok(Array.isArray(f.sunDir) && Array.isArray(f.moonDir))
  assert.ok(Number.isFinite(f.sunDirectMul) && Number.isFinite(f.moonMul))
  assert.equal(f.keyMul, Math.max(f.sunDirectMul, f.moonMul))
  assert.deepEqual(f.moonColor.length, 3)
  assert.equal(w.cfg.time.celestialLights, true)
})
test('G003-03: luz rectangular usa helper oficial, centrado y unido al emisor', () => {
  assert.match(lightSrc, /RectAreaLightHelper.*three\/addons\/helpers\/RectAreaLightHelper\.js/)
  assert.match(lightSrc, /new RectAreaLightHelper\(light,/)
  assert.match(lightSrc, /light\.add\(frame\)/)
  assert.match(lightSrc, /frame\.visible = false/)
  assert.match(lightSrc, /root\.userData\.editorGizmos\.push\(frame, aim\)/)
  assert.doesNotMatch(lightSrc, /frame\.rotation\.y = Math\.PI/)
  assert.match(lightSrc, /areaFrame\?\.update\(\)/)
})
test('G003-04: sin sombras o mapas adicionales para RectAreaLight ni Luna', () => {
  assert.match(lightSrc, /l\.castShadow = p\.type !== 'area' && !!p\.shadow/)
  assert.match(envSrc, /moon\.castShadow = false/)
  assert.match(envSrc, /moon\.userData\.environmentMoon = true/)
})
test('G003-05: ciclo de vida de luna al cambiar escena o liberar Graph', () => {
  assert.equal((graphSrc.match(/this\._removeWorldMoon\(\)/g) || []).length, 2)
  assert.match(envSrc, /_removeWorldMoon\(\)/)
  assert.match(envSrc, /_syncWorldMoon\(f, sunNode, sunObject\)/)
})

// Ejecuta el método real del mixin con objetos Three mínimos para verificar estado y restauración.
class Vec3 {
  constructor(x=0,y=0,z=0) { this.set(x,y,z) }
  set(x,y,z) { this.x=x; this.y=y; this.z=z; return this }
  normalize() { const d=Math.hypot(this.x,this.y,this.z)||1; return this.multiplyScalar(1/d) }
  multiplyScalar(v) { this.x*=v;this.y*=v;this.z*=v;return this }
}
class Quat {
  setFromUnitVectors(a,b) { this.dir=[b.x,b.y,b.z]; return this }
  premultiply(_) { this.parentApplied=true; return this }
  invert() { return this }
  copy(o) { this.dir=o.dir; this.parentApplied=o.parentApplied; return this }
}
class FakeColor { setRGB(...c) { this.rgb=c; return this } }
class FakeMoon {
  constructor(color,intensity) { this.isDirectionalLight=true; this.color=new FakeColor(); this.intensity=intensity; this.userData={}; this.target={position:new Vec3(),parent:null,updateMatrixWorld(){}}; this.position=new Vec3(); this.castShadow=true; this.parent=null }
  updateMatrixWorld() {}
}
const THREE = { Vector3:Vec3, Quaternion:Quat, DirectionalLight:FakeMoon }
const code = envSrc.replace(/^import .+\n/gm,'').replace('export const environmentMethods =','const environmentMethods =')
const methods = new Function('THREE', 'lightingMode', 'selectedSun', 'DEG', code+'\nreturn environmentMethods')(THREE, lightingMode, selectedSun, Math.PI / 180)
function makeGraph({ opt=true, time=true, lights=true, moon=0.1, parent=null }={}) {
  const sun={ id:'sun', type:'light', visible:true, light:{type:'directional',energy:2},color:'#ffffff',rotation:[0,0,0] }
  const L={ color:new FakeColor(),intensity:1,visible:true }
  const node={ userData:{light:L,fx:{},bakedOff:false,rtOff:false, lightAuthored:sun, refreshLightAppearance(){ L.intensity=sun.light.energy*Math.PI }},parent,quaternion:new Quat(),rotation:{set(){}},updateMatrixWorld(){} }
  const scene={ added:[],add(...xs){ for(const x of xs){x.parent=this;this.added.push(x)} },remove(x){this.added=this.added.filter(v=>v!==x);x.parent=null} }
  const vp={scene, shadows:0,renders:0, invalidateShadows(){this.shadows++}, requestRender(){this.renders++}}
  const frame={timeOn:time,sunDir:[0,1,0],moonDir:[0.2,0.9,0.1],sunColor:[1,0.8,0.5],moonColor:[0.58,0.67,0.86],sunDirectMul:0.3,moonMul:moon,keyDir:[0,1,0],keyColor:[1,1,1],keyMul:0.7}
  const graph={...methods,host:{project:{objects:[sun]},view:{lights}},nodes:new Map([['sun',node]]),world:{active:true,frame:()=>frame,cfg:{time:{celestialLights:opt}}},vp}
  return {graph,L,node,sun,vp,frame}
}
test('G003-06: opción heredada usa keyMul y no crea luz de luna', () => {
  const {graph,L,vp}=makeGraph({opt:false})
  graph._worldSun()
  assert.equal(L.intensity,2*Math.PI*0.7)
  assert.equal(graph._worldMoon,undefined)
  assert.equal(vp.scene.added.length,0)
})
test('G003-07: modo nuevo conserva luz solar y crea luna independiente sin sombras', () => {
  const {graph,L,vp,frame,node}=makeGraph({opt:true})
  graph._worldSun()
  assert.equal(L.intensity,2*Math.PI*frame.sunDirectMul)
  assert.equal(graph._worldMoon.intensity,2*Math.PI*frame.moonMul)
  assert.equal(graph._worldMoon.castShadow,false)
  assert.deepEqual(node.quaternion.dir,frame.sunDir)
  assert.equal(vp.scene.added.length,2)
  const moon=graph._worldMoon;graph._worldSun();assert.equal(graph._worldMoon,moon)
})
test('G003-08: luna se apaga y se elimina al llegar al día o desactivar opción', () => {
  const {graph,frame,vp}=makeGraph()
  graph._worldSun()
  frame.moonMul=0
  graph._worldSun()
  assert.equal(graph._worldMoon,null)
  assert.equal(vp.scene.added.length,0)
  frame.moonMul=0.1;graph._worldSun()
  graph.world.cfg.time.celestialLights=false;graph._worldSun()
  assert.equal(graph._worldMoon,null)
})
test('G003-09: view.lights deshabilita sol y luna sin tocar los datos de escena', () => {
  const {graph,L,sun}=makeGraph()
  graph._worldSun();graph.host.view.lights=false;graph._worldSun()
  assert.equal(L.visible,false)
  assert.equal(graph._worldMoon,null)
  assert.equal(sun.light.energy,2)
})
test('G003-10: desactivar reloj restaura la direccional manual y limpia luna', () => {
  const {graph,L,sun}=makeGraph()
  graph._worldSun();graph.world.active=false;graph._worldSun()
  assert.equal(graph._worldMoon,null)
  assert.equal(L.intensity,sun.light.energy*Math.PI)
  assert.equal(graph._worldSunBinding,null)
})
test('G003-11: luz anidada en padre rotado compensa orientación mundial', () => {
  const p={getWorldQuaternion(){return new Quat()}}
  const {graph,node}=makeGraph({parent:p})
  graph._worldSun()
  assert.equal(node.quaternion.parentApplied,true)
})
test('G003-12: helper oficial no invade el modo Player', () => {
  assert.match(envSrc, /node\.userData\.areaFrame\.visible = false/)
  assert.match(envSrc, /this\.isPlaying \|\| this\.player\?\.runtime/)
})
test('G003-13: no se crea luna sin DirectionalLight de escena', () => {
  const {graph}=makeGraph()
  graph.host.project.objects=[];graph._worldSun()
  assert.equal(graph._worldMoon,undefined)
})
