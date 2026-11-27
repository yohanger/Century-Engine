// Contrato de arranque: estas comprobaciones NO sustituyen el runner WASM real.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { World } from '../src/engine/runtime/world/world.js'
const read=(name)=>readFileSync(new URL(`../${name}`, import.meta.url),'utf8')
const play=read('src/engine/runtime/events/play.js')
const bodies=read('src/engine/runtime/physics/node-bodies.js')
const native=read('src/engine/runtime/physics/jolt.js')
const tornado=read('src/engine/runtime/events/play-tornado.js')
test('JC-01 · no se utiliza Shape cocinado como ShapeSettings de forma decorada',()=>{
 assert.match(bodies,/RotatedTranslatedShapeSettings\(v, q, inner\[0\]\.settings\)/)
 assert.doesNotMatch(bodies,/RotatedTranslatedShapeSettings\(v, q, one\.shape\)/)
})
test('JC-02 · compuesto recibe exclusivamente ShapeSettings',()=>{
 assert.match(bodies,/settings\.AddShape\(v, q, inner\[i\]\.settings, 0\)/)
 assert.doesNotMatch(bodies,/settings\.AddShape\(v, q, part\.shape\)/)
})
test('JC-03 · se comprueba el resultado nativo antes de Get',()=>{
 assert.match(bodies,/if \(!result\?\.IsValid\(\)\) throw/)
 assert.match(native,/if \(!res\?\.IsValid\(\)\) throw/)
})
test('JC-04 · excepciones identifican nodo, ID y formas sin ocultar causa',()=>{
 assert.match(bodies,/new Error\(`Jolt: no se pudo crear la colisión/)
 assert.match(bodies,/\{ cause: error \}/)
})
test('JC-05 · la propiedad nativa se transfiere y solo se libera una vez',()=>{
 assert.match(bodies,/let transferred = 0/)
 assert.match(bodies,/transferred\+\+/)
 assert.match(bodies,/inner\[i\]\.dispose\(i < transferred\)/)
 assert.match(bodies,/if \(!transferred\) J\.destroy\(settings\)/)
 assert.match(bodies,/if \(part\.owned\) part\.shape\.Release\(\)/)
})
test('JC-06 · fallo de arranque parcial ejecuta rollback del registro',()=>{
 assert.match(bodies,/catch \(error\) \{ try \{ this\.dispose\(\)/)
 assert.match(play,/await this\.stop\(\)/)
})
test('JC-07 · si falla un registro nativo se destruye el cuerpo',()=>{
 assert.match(native,/if \(id\) this\.bi\.DestroyBody\(id\)/)
})
test('JC-08 · Play registra cuerpos antes del tornado, sin nuevo motor',()=>{
 assert.ok(play.indexOf('this._bodiesInit()') < play.indexOf('this._tornadoInit()'))
 assert.match(tornado,/world\.tornado/)
})
test('JC-09 · S02 inicia tornado en fase idle sin fuerza instantánea',()=>{
 const w=new World(9)
 w.configure({weather:{on:true,preset:'storm',tornadoEnabled:true,tornadoDuration:5,tornadoX:0,tornadoY:0,tornadoZ:0}})
 assert.equal(w.tornado?.active,false)
 assert.equal(w.tornado?.phase,'idle')
 assert.equal(w.tornado?.age,0)
})
test('JC-10 · S02 renderiza condensación en el cielo sin puente VFX',()=>{
 assert.doesNotMatch(tornado,/tornadoVfxNodeId|createWeatherVfx3D|_tornadoWeatherVfx/)
 assert.match(tornado,/_tornadoEmit\('tornadoPhase'/)
})
test('JC-11 · test nativo y mocks distinguen propiedad de ShapeSettings',()=>{
 const adapt=read('scripts/test-node-physics-runtime-s03-g001.mjs')
 assert.match(adapt,/Doble liberación de ShapeSettings/)
 assert.match(bodies,/settings = new J\.RotatedTranslatedShapeSettings/)
 assert.match(bodies,/if \(settings\) J\.destroy\(settings\)/)
})
