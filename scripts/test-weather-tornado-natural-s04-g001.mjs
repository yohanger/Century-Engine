import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SKY_FRAG } from '../src/engine/runtime/render/skylib.js'
import { World } from '../src/engine/runtime/world/world.js'
import { tornadoVisualState } from '../src/engine/runtime/world/tornado-visual.js'
const source = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const section = (a,b) => SKY_FRAG.slice(SKY_FRAG.indexOf(a),SKY_FRAG.indexOf(b))
const root = section('float tornadoCloudRoot(', '// La condensación del embudo')
const funnel = section('float tornadoCondensation(', '// hf = altura relativa')
const march = section('vec4 cloudLayer(', '// estrellas: celdas 3D')

test('TV4-01: una nube madre y un único ShaderMaterial de Sky',()=>{
 assert.match(SKY_FRAG,/float cloudDensity\(/); assert.match(SKY_FRAG,/float atmosphericDensity\(/)
 assert.equal((SKY_FRAG.match(/vec4 cl = cloudLayer\(dir\)/g)||[]).length,1)
 assert.doesNotMatch(SKY_FRAG,/tornadoCloudVolume|VfxSimulation|VfxBillboardRenderer/)
})
test('TV4-02: raíz y embudo comparten ruido uShape y viento acumulado',()=>{
 assert.match(root,/texture\(uShape/);assert.match(funnel,/texture\(uShape/)
 assert.match(root,/uWindOff\.x/);assert.match(funnel,/uWindOff\.x/)
 assert.doesNotMatch(root,/sampler3D|sampler2D/)
})
test('TV4-03: raíz ancha con borde erosionado, sin disco duro',()=>{
 assert.match(root,/float wrinkle/);assert.match(root,/float outer = 1\.0 - smoothstep/)
 assert.match(root,/float underbelly/);assert.match(root,/if \(dist >= 2\.8\) return 0\.0/)
 assert.ok(root.indexOf('smoothstep(0.72, 2.32')<root.indexOf('underbelly'))
})
test('TV4-04: pendiente de densidad vertical hace masa sin forzar plano en la base',()=>{
 assert.match(root,/smoothstep\(0\.025, 0\.255, hf\)/)
 assert.match(funnel,/float shoulder = smoothstep\(0\.73, 1\.0, h\)/)
 assert.match(funnel,/1\.0 \+ 0\.36 \* shoulder/)
})
test('TV4-05: deformación temporal continua y cizalladura no toca eje físico',()=>{
 assert.match(funnel,/float shear = h \* h/)
 assert.match(funnel,/vec2 bend/)
 assert.match(funnel,/float radial = length\(rel\) \/ r \+ spiral/)
 assert.doesNotMatch(source('src/engine/runtime/world/tornado-visual.js'),/new World\(/)
})
test('TV4-06: tinte, iluminación solar y ambiental son los mismos que en las nubes',()=>{
 assert.match(march,/vec3 sunL = \(uSunColor \* sunScatter.x \+ uMoonColor \* moonScatter.x\) \* uCLight/)
 assert.match(march,/vec3 ambL=uCAmb\*mix/)
 assert.match(march,/acc\+=T\*alpha\*\(sunL\+ambL\)\*uCTint/)
 assert.doesNotMatch(SKY_FRAG,/uTornadoTint|uFunnelColor|uTornadoColor/)
})
test('TV4-07: absorción de masa superior deriva de Beer, sin color fijo',()=>{
 assert.match(march,/float shadow = mass\*\(1\.0-beer\)/)
 assert.match(march,/sunL \*= 1\.0-0\.45\*shadow/)
 assert.match(march,/ambL \*= 1\.0-0\.18\*shadow/)
 assert.doesNotMatch(march,/vec3\(0\.0,0\.0,0\.0\)\s*\*\s*shadow/)
})
test('TV4-08: conserva único raymarch 64+12 y transmitancia compartida',()=>{
 assert.match(march,/for \(int i=0;i<76;i\+\+\)/)
 assert.match(march,/int funnelSteps = funnelFar > funnelNear \? 12 : 0/)
 assert.match(march,/T\*=1\.0-alpha/)
 assert.match(march,/if \(!inCloud\) lowerT\*=1\.0-alpha/)
})
test('TV4-09: sin tornado no ejecuta muestras de raíz ni inferiores',()=>{
 assert.match(root,/if \(uTornadoCloud\.w <= 0\.001/)
 assert.match(funnel,/if \(uTornadoCloud\.w <= 0\.005/)
 assert.match(march,/if \(uTornadoCloud\.w > 0\.005 && uTornadoShape\.z > 0\.005\)/)
})
test('TV4-10: no reaparece segundo compositor ni máscara angular por cilindro',()=>{
 assert.match(march,/float lowerOpacity=clamp\(1\.0-lowerT,0\.0,1\.0\)/)
 assert.match(march,/return vec4\(acc,T\)/)
 assert.doesNotMatch(march,/if \(funnelSteps==0\)/)
})
test('TV4-11: CloudField y las dos modalidades no se modifican',()=>{
 const cloud=source('src/engine/runtime/world/cloudfield.js')
 assert.match(cloud,/selectTornadoMother\(/)
 assert.match(SKY_FRAG,/if \(uCCells == 1\)/)
 assert.match(SKY_FRAG,/organizedCloudOffset\(/)
})
test('TV4-12: raíz, embudo y física conservan vidas independientes',()=>{
 const w=new World(19).configure({weather:{on:true,preset:'storm',tornadoEnabled:true,tornadoMode:'script'}})
 w.startTornado({weatherTransition:0})
 w.tornadoStep(12)
 assert.equal(w.tornado.phase,'organization')
 const v=tornadoVisualState(w.tornado,900)
 assert.equal(v.reach<0.7,true)
 assert.ok(w.tornado.radius>0)
})
test('TV4-13: regression S03 conserva polvo fuera de Sky',()=>{
 assert.match(source('src/engine/runtime/world/nature.js'),/VfxSimulation/)
 assert.doesNotMatch(SKY_FRAG,/new THREE|groundAt\(|tornadoDustRate/)
})
test('TV4-14: fixture GPU verifica raíz y familia cromática con shader real',()=>{
 const fixture=source('scripts/fixtures/weather/tornado-natural-s04.html')
 assert.match(fixture,/import \{ SKY_VERT, SKY_FRAG \}/)
 assert.match(fixture,/raíz superior visible/)
 assert.match(fixture,/paleta atmosférica modifica nube y embudo/)
 assert.match(fixture,/sin errores GPU/)
 const runner=source('scripts/test-weather-tornado-natural-electron-s04-g001.mjs')
 assert.match(runner,/verifyWebGL\(/)
 assert.doesNotMatch(runner,/brave|puppeteer|chromium/)
})
