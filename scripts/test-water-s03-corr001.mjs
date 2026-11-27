// S03_CORR-001: gotas, colisión de trayectorias y compatibilidad sin WebGL.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { rainPoint, traceRainSegment } from '../src/engine/runtime/world/rain-impact.js'

const read = (p) => readFileSync(new URL(`../src/engine/runtime/${p}`, import.meta.url), 'utf8')
const fxSrc = read('world/fx.js')
const sgSrc = read('scene-graph.js')
const waterScene = read('scene/water.js')
const wetSrc = read('render/wetlib.js')

test('C01: las gotas ya no usan tiras de más de 2 m ni la cortina ancha', () => {
  assert.match(fxSrc, /b\.uLen\.value = 0\.12 \+ 0\.08 \* rain/)
  assert.match(fxSrc, /a\.uLen\.value = 0\.075 \+ 0\.065 \* rain/)
  assert.match(fxSrc, /float droplet = 1\.0 - smoothstep/)
  assert.doesNotMatch(fxSrc, /b\.uLen\.value = 2\.4/)
})
test('C02: mapeo CPU y GPU usa mismo wrapping, incluso con valores negativos', () => {
  const seed = [0.2, 0.7, 0.1, 0.4], off = { x: -1, y: -20, z: 3 }, cam = { x: 10, y: 8, z: -20 }
  const p = rainPoint(seed, off, cam, 38, 26)
  assert.equal(p.length, 3)
  assert.ok(p[0] >= cam.x - 19 && p[0] < cam.x + 19)
  assert.ok(p[2] >= cam.z - 19 && p[2] < cam.z + 19)
  assert.ok(p[1] >= cam.y - 9.1 && p[1] < cam.y + 16.9)
  const withoutCameraChange = rainPoint(seed, { ...off, y: off.y - 0.02 }, cam, 38, 26)
  assert.ok(withoutCameraChange[1] < p[1])
})
test('C02/C03: cara de cubo gana frente a suelo; conserva normal de la cara', () => {
  const hit = traceRainSegment([2, 4, 0], [2, 0, 0], () => 1,
    () => ({ point: [2, 3, 0], normal: [0, 4, 0] }))
  assert.deepEqual(hit, { point: [2, 3, 0], normal: [0, 1, 0] })
  const side = traceRainSegment([0, 3, 0], [1, 1, 0], () => NaN,
    () => ({ point: [0.5, 2, 0], normal: [-1, 0, 0] }))
  assert.deepEqual(side?.normal, [-1, 0, 0])
})
test('C02: suelo gana cuando primitiva queda detrás; sin suelo ni objeto no inventa impacto', () => {
  const result = traceRainSegment([0, 3, 0], [0, 0, 0], () => 2,
    () => ({ point: [0, 0.5, 0], normal: [0, 1, 0] }))
  assert.equal(result.point[1], 2)
  assert.equal(traceRainSegment([0, 3, 0], [0, 1, 0], () => NaN, () => null), null)
  assert.equal(traceRainSegment([0, 1, 0], [0, 2, 0], () => 1), null)
})
test('C02: rechaza falsos contactos fuera del segmento', () => {
  const out = traceRainSegment([0, 3, 0], [0, 2, 0], () => NaN,
    () => ({ point: [0, -100, 0], normal: [0, 1, 0] }))
  assert.equal(out, null)
  assert.equal(traceRainSegment([0, 3, 0], [0, 2, 0], () => NaN,
    () => ({ point: [1, 2.5, 0], normal: [0, 1, 0] })), null)
})
test('C03: atributos de salpicadura usan normal de contacto en el shader', () => {
  assert.match(fxSrc, /attribute vec3 aNormal/)
  assert.match(fxSrc, /cross\(n, tangent\)/)
  assert.match(fxSrc, /this\.splashNormals\.set\(hit\.normal, n\)/)
  assert.doesNotMatch(fxSrc, /renace: más cerca/)
})
test('C02/C07: límite de raycasts y trazas sólo de gotas renderizadas', () => {
  assert.match(fxSrc, /const MAX_IMPACT_CASTS = 64/)
  assert.match(fxSrc, /this\.rain\.geometry\.getAttribute\('aSeed'\)\.array/)
  assert.match(fxSrc, /if \(this\._tracking && dt > 0 && castCount < MAX_IMPACT_CASTS\)/)
})
test('C02/C04: la escena reutiliza nodos físicos y Terrain, sin raycast de la malla del agua', () => {
  assert.match(sgSrc, /this\.vp\.precip\.ground = \(x, z\) => \{/)
  assert.match(sgSrc, /this\.vp\.precip\.impact = \(from, to\) => this\.rainImpact\(from, to\)/)
  assert.match(waterScene, /\['primitive', 'mesh', 'road', 'text'\]/)
  assert.match(waterScene, /ray\.intersectObjects\(this\._rainMeshes, false\)/)
})
test('C05: en modo WaterWorld se suprimen los charcos proceduralmente inventados en toda la escena', () => {
  assert.match(wetSrc, /uPhysicalCount == 0/)
  assert.match(wetSrc, /rtPud = rtPuddle\(vTxz\)/)
})
test('C06: salpicaduras no añaden volumen a la simulación y pueden finalizar con lluvia apagada', () => {
  assert.doesNotMatch(fxSrc, /\.queue\(|\.changeVolume\(|WaterRegion\.add/)
  assert.match(fxSrc, /if \(!this\.rain\.visible && !this\.snow\.visible && !this\._splashActive\)/)
  assert.match(fxSrc, /this\._ageSplashes\(dt\)/)
})
test('C08: reinicio y dispose limpian trazas, anillos y referencias a la escena', () => {
  assert.match(fxSrc, /resetImpacts\(\)/)
  assert.match(sgSrc, /this\.vp\.precip\.resetImpacts\(\)/)
  assert.match(fxSrc, /this\.impact = null; this\.ground = null/)
})

// Prueba conductual del PrecipFX real con el mínimo de Three para no depender de WebGL.
class FakeVector3 {
  constructor(x=0,y=0,z=0) { Object.assign(this, {x,y,z}) }
  copy(other) { this.x=other.x; this.y=other.y; this.z=other.z; return this }
  normalize() { const length=Math.hypot(this.x,this.y,this.z)||1; this.x/=length; this.y/=length; this.z/=length; return this }
}
class FakeColor {
  constructor(value) { this.value=value }
  copy(src) { this.value=src.value; return this }
  lerp() { return this }
  multiplyScalar() { return this }
  set() { return this }
}
class FakeAttribute { constructor(array) { this.array=array } setUsage() { return this } }
class FakeGeometry {
  constructor() { this.attributes={}; this.instanceCount=0 }
  setAttribute(key, attr) { this.attributes[key]=attr; return this }
  getAttribute(key) { return this.attributes[key] }
  setIndex() { return this }
  setDrawRange() { return this }
  dispose() { this.disposed = true }
}
class FakeMaterial { constructor(params) { Object.assign(this, params) } dispose() { this.disposed=true } }
class FakeMesh { constructor(geometry,material) { this.geometry=geometry; this.material=material; this.userData={} } }
const mockTHREE = {
  Vector3:FakeVector3, Color:FakeColor,
  BufferGeometry:FakeGeometry, InstancedBufferGeometry:FakeGeometry,
  Float32BufferAttribute:FakeAttribute, BufferAttribute:FakeAttribute,
  InstancedBufferAttribute:FakeAttribute,
  ShaderMaterial:FakeMaterial, Mesh:FakeMesh, Points:FakeMesh,
  DoubleSide:1, DynamicDrawUsage:1,
}
const factory = Function('THREE','rainPoint','traceRainSegment',
  `${fxSrc.replace("import { rainPoint, traceRainSegment } from './rain-impact.js'",'')
         .replace("import * as THREE from 'three'",'')
         .replace('export class PrecipFX','class PrecipFX')}\nreturn PrecipFX`)

test('C02/C03 conductual: una gota rastreada impacta cubo, crea anillo normal y se extingue', () => {
  const scene={ add(){}, remove(){} }
  const FX=factory(mockTHREE,()=>[0,0.9,0],traceRainSegment)
  const fx=new FX(scene,()=>0)
  let casts=0
  fx.impact=()=>{ casts++; return {point:[0,1,0],normal:[0,1,0]} }
  fx._rnd=()=>0
  for(let i=0;i<384;i++) { fx._tracked[i*3]=0; fx._tracked[i*3+1]=1.1; fx._tracked[i*3+2]=0 }
  fx._tracking=true
  fx._traceDrops({position:{x:0,y:2,z:0}},0.016,12,1)
  assert.equal(casts,64)
  assert.equal(fx.splashData[1],1)
  assert.deepEqual(Array.from(fx.splashNormals.slice(0,3)),[0,1,0])
  assert.equal(fx._splashActive,true)
  fx._ageSplashes(0.5)
  assert.equal(fx._splashActive,false)
  assert.equal(fx.splashData[3],1)
  fx.dispose()
  assert.equal(fx.impact,null)
})

test('C03/C08 conductual: sin contacto no hay salpicaduras; reset evita impactos de escena anterior', () => {
  const FX=factory(mockTHREE,()=>[0,0.9,0],traceRainSegment)
  const fx=new FX({add(){},remove(){}},()=>NaN)
  fx.impact=()=>null
  for(let i=0;i<384;i++) fx._tracked[i*3+1]=1.1
  fx._tracking=true
  fx._traceDrops({position:{x:0,y:2,z:0}},0.016,12,1)
  assert.equal(fx._splashActive,false)
  fx._addSplash({point:[2,3,4],normal:[0,0,1]})
  assert.equal(fx._splashActive,true)
  fx.resetImpacts()
  assert.equal(fx._splashActive,false)
  assert.equal(fx._tracking,false)
  fx.dispose()
})

test('C03 conductual: lluvia apagada permite terminar la última salpicadura sin frame meteorológico', () => {
  const FX=factory(mockTHREE,rainPoint,traceRainSegment)
  const fx=new FX({add(){},remove(){}},()=>NaN)
  fx._addSplash({point:[0,1,0],normal:[0,1,0]})
  const cam={position:new FakeVector3(0,2,0),fov:60}
  assert.equal(fx.update(null,cam,0.1),true)
  for(let i=0;i<6;i++) fx.update(null,cam,0.1)
  assert.equal(fx._splashActive,false)
  assert.equal(fx.splash.visible,false)
  assert.equal(fx.update(null,cam,0.1),false)
  fx.dispose()
})
