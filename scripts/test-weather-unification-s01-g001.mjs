// S01: consulta única de viento y consumidores visuales. Sin DOM, dependencias npm ni física simulada.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { World } from '../src/engine/runtime/world/world.js'

const source = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const approx = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`)
const world = (tornado = false) => {
  const w = new World(19)
  w.configure({ weather: { on: true, preset: 'storm', directorSeed: 19, tornadoEnabled: tornado, tornadoMode: 'script',
    tornadoX: 0, tornadoY: 0, tornadoZ: 0, tornadoRadius: 45, tornadoHeight: 100,
    tornadoDevelopmentSeconds: 1, tornadoOrganizationSeconds: 1, tornadoFormationSeconds: 1 } })
  w.update(0.2); w.frame()
  if (tornado) { w.startTornado({ weatherTransition: 0 }); w.tornadoStep(2.6); w.frame() }
  return w
}
const ctxClass = (file, name, additions = {}) => {
  const js = source(file).replace(/^import .*\n/gm, '').replace(new RegExp(`export class ${name}`), `class ${name}`)
  const ctx = { ...additions }
  vm.runInNewContext(js + `\nthis.${name} = ${name};`, ctx, { filename: file })
  return ctx[name]
}

// El mismo World se usa en todos los consumidores; no se cambia el contrato legacy de windAt.
test('WU-01: sin tornado el campo efectivo conserva viento local con obstáculos', () => {
  const w = world(), point = [4, 3, 1]
  w.registerObstacle('cavidad', 'cavity', { minX: 0, maxX: 8, minZ: -2, maxZ: 4 })
  const ambient = w.windAt(point[0], point[2]), total = w.windAt3D(...point)
  approx(total.x, ambient.x); approx(total.y, 0); approx(total.z, ambient.z)
})
test('WU-02: vórtice activo compone viento ambiental y circular sin cambiar el campo legacy', () => {
  const w = world(true), p = [8, 25, 8], ambient = w.windAt(p[0], p[2])
  const vortex = w.tornadoWindAt(...p), effective = w.windAt3D(...p)
  assert.ok(vortex.weight > 0)
  approx(effective.x, ambient.x + vortex.x); approx(effective.y, vortex.y); approx(effective.z, ambient.z + vortex.z)
  approx(w.windAt(p[0], p[2]).x, ambient.x)
})
test('WU-03: fuera del volumen del tornado no hay perturbación', () => {
  const w = world(true), p = [220, 25, 220], ambient = w.windAt(p[0], p[2]), total = w.windAt3D(...p)
  approx(total.x, ambient.x); approx(total.y, 0); approx(total.z, ambient.z)
  assert.equal(total.inside, false)
})
test('WU-04: consultas sucesivas deterministas y sin mutar el frame', () => {
  const w = world(true), f = structuredClone(w.frame().wind)
  assert.deepEqual(w.windAt3D(5, 15, 4), w.windAt3D(5, 15, 4))
  assert.deepEqual(w.frame().wind, f)
})

let windInput = null
class Vector3 {
  constructor(x=0,y=0,z=0) { Object.assign(this, {x,y,z}) }
  normalize() { return this }
  copy(p) { Object.assign(this, {x:p.x,y:p.y,z:p.z});return this }
  set(x,y,z){ Object.assign(this,{x,y,z});return this }
}
class Color { constructor(){} copy(){return this} lerp(){return this} multiplyScalar(){return this} set(){return this} }
const PrecipFX = ctxClass('src/engine/runtime/world/fx.js', 'PrecipFX', { THREE: { Vector3, Color }, rainPoint(){}, traceRainSegment(){} })
function precip() {
  const mat = () => ({ uniforms: { uOff:{value:new Vector3()},uCam:{value:new Vector3()},uDir:{value:new Vector3()},uColor:{value:new Color()},
    uLen:{value:0},uWidth:{value:0},uAlpha:{value:0},uTime:{value:0},uScale:{value:0} } })
  const fx = Object.create(PrecipFX.prototype)
  fx.rainMat=mat();fx.mistMat=mat();fx.snowMat=mat()
  fx.rain={visible:false,geometry:{instanceCount:0}}
  fx.mist={visible:false,geometry:{instanceCount:0}}
  fx.snow={visible:false,geometry:{setDrawRange(){}}}
  fx.splash={visible:false};fx._splashActive=false;fx._tracking=false;fx._rt=0
  fx._traceDrops=()=>{};fx._ageSplashes=()=>{}
  return fx
}
test('WU-05: lluvia y niebla toman viento efectivo local, una consulta', () => {
  const fx=precip(),f={wind:{x:1,z:2},precip:{rain:1,snow:0},ambientMul:1,skyHorizon:0}
  fx.update(f,{position:{x:8,y:3,z:1}},0.1,720,0,{x:6,z:-4,y:2})
  approx(fx.rainMat.uniforms.uOff.value.x,0.45)
  approx(fx.rainMat.uniforms.uOff.value.z,-0.3)
  assert.equal(fx.mist.visible,true)
})
test('WU-06: nieve conserva misma dirección efectiva sin añadir cuerpos', () => {
  const fx=precip(),f={wind:{x:1,z:2},precip:{rain:0,snow:0.8},ambientMul:1,skyHorizon:0}
  fx.update(f,{position:{x:0,y:2,z:0},fov:70},0.1,720,0,{x:-2,z:3,y:0})
  approx(fx.snowMat.uniforms.uOff.value.x,-0.11)
  approx(fx.snowMat.uniforms.uOff.value.z,0.165)
})
test('WU-07: precipitación sin World conserva el viento de frame y oclusión', () => {
  const fx=precip(),f={wind:{x:1,z:2},precip:{rain:0.8,snow:0},ambientMul:1,skyHorizon:0}
  fx.update(f,{position:{x:0,y:1,z:0}},0.1,720,0)
  approx(fx.rainMat.uniforms.uOff.value.x,0.075)
  fx.update(f,{position:{x:0,y:1,z:0}},0.1,720,1)
  assert.equal(fx.rain.visible,false)
})

const captured = []
const setWind = (w) => captured.push(w)
const WETU = { uWet:{value:0},uRain:{value:0},uSnowCover:{value:0},uWetTime:{value:0} }
const NatureFX = ctxClass('src/engine/runtime/world/nature.js', 'NatureFX', { setWind, WETU, LeafFX:class{},CritterSystem:class{} })
function nature() {
  const n=Object.create(NatureFX.prototype)
  n._t=0;n._wet=0;n._snow=0;n.opts={terrains:()=>[]};n.critters={update:()=>false}
  n.leaves={update(...args){n.leafArgs=args;return false}}
  return n
}
test('WU-08: vegetación y hojas reciben UNA muestra efectiva y ninguna consulta extra', () => {
  const n=nature(),f={wind:{x:1,z:3},precip:{rain:0,snow:0},gusts:0.4,weatherOn:true}
  let calls=0, p={position:{x:4,y:7,z:3}}
  n.update(f,p,0.03,720,true,true,{windAt3D(x,y,z){calls++;return {x:9,y:5,z:-7}}})
  assert.equal(calls,1)
  assert.equal(captured.at(-1).x,9)
  assert.equal(captured.at(-1).z,-7)
  assert.equal(n.leafArgs[5].x,9)
  assert.equal(n.leafArgs[5].z,-7)
})
test('WU-09: sin autoridad World, la naturaleza conserva la brisa y viento global previos', () => {
  const n=nature(),cam={position:{x:0,y:1,z:0}}
  n.update(null,cam,0.02,720,true,true,null)
  assert.equal(captured.at(-1).x,1.2)
  n.update({wind:{x:3,z:4},precip:{rain:0,snow:0},weatherOn:true},cam,0.02,720,true,true,null)
  assert.equal(captured.at(-1).x,3)
})
const LeafFX=ctxClass('src/engine/runtime/world/leaves.js','LeafFX',{THREE:{}})
test('WU-10: GPU de hojas recibe muestra local explícita y mantiene fallback', () => {
  const n=Object.create(LeafFX.prototype)
  const v={x:0,z:0,set(x,z){this.x=x;this.z=z}}
  const vec3={setFromMatrixColumn(){return this}}
  n.mat={uniforms:{uTime:{value:0},uWind:{value:v},uRight:{value:vec3},uUp:{value:vec3},uLight:{value:1}}}
  n.mesh={visible:true,geometry:{instanceCount:0}}
  n.trees=1;n._age=0;n._cx=0;n._cz=0;n._t=0
  const cam={position:{x:0,z:0},matrixWorld:{},updateMatrixWorld(){}}
  const f={wind:{x:1,z:2},precip:{rain:0,snow:0},ambientMul:1}
  n.update(f,cam,0.03,[],true,{x:8,z:-5})
  assert.equal(v.x,8);assert.equal(v.z,-5)
  n.update(f,cam,0.03,[],true)
  assert.equal(v.x,1);assert.equal(v.z,2)
})
test('WU-11: viewport conecta la misma autoridad con lluvia y naturaleza, sin alterar frame',()=>{
  const code=source('src/engine/runtime/render/viewport.js')
  assert.match(code,/this\.precip\.update\(live \? this\._wf : null,[^\n]+windLocal\)/)
  assert.match(code,/this\.nature\?\.update\(this\._wf,[^\n]+this\.windWorld, windLocal\)/)
  assert.match(code,/const windLocal = live[^\n]+this\.windWorld\?\.windAt3D/)
  assert.doesNotMatch(code,/this\._wf\.wind\s*=/)
})
test('WU-12: Jolt y FPS conservan solo contribución del vórtice, sin duplicar el ambiente',()=>{
  const play=source('src/engine/runtime/events/play-tornado.js')
  const fps=source('src/engine/runtime/player/fps/movement.js')
  assert.match(play,/w\.tornadoWindAt\(/)
  assert.match(fps,/\.world\.tornadoWindAt\(/)
  assert.doesNotMatch(play,/w\.windAt3D\(/)
})
test('WU-13: nubes conservan advección ambiental, deformación localizada diferida a S02',()=>{
  const code=source('src/engine/runtime/world/world.js')
  assert.match(code,/cf\.update\(this\._cloudState\(\), \[wind\.x \* CLOUD_WIND, wind\.z \* CLOUD_WIND\], dt\)/)
  assert.match(code,/windAt3D\(x,y,z\)/)
})

test('WU-14: NatureFX no repite consulta si el viewport ya entregó la muestra', () => {
  const n=nature(),f={wind:{x:1,z:2},precip:{rain:0,snow:0},weatherOn:true}
  const local={x:12,y:3,z:-6}
  n.update(f,{position:{x:4,y:5,z:6}},0.05,720,true,true,{windAt3D(){throw Error('consulta duplicada')}},local)
  assert.equal(captured.at(-1).x,12)
  assert.equal(n.leafArgs[5],local)
})
