import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { tornadoSurfaceAt, tornadoDustRate } from '../src/engine/runtime/world/tornado-surface.js'
const source = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const surface = (type='dirt', height=0) => ({ groundAt:()=>height, paintAt:()=>0, layers:[{surface:type,color:'#7a5a3a'}] })
const opts = {wet:0,rain:0,snow:0}
test('TD3-01: solo terreno físico finito admite muestra',()=>{assert.equal(tornadoSurfaceAt([],0,0),null);assert.equal(tornadoSurfaceAt([surface('dirt',NaN)],0,0),null)})
test('TD3-02: tierra explícita puede emitir',()=>{assert.equal(tornadoSurfaceAt([surface()],0,0).surface,'dirt')})
test('TD3-03: arena declarada emite; no requiere .vfx',()=>{assert.equal(tornadoSurfaceAt([surface('sand')],0,0).surface,'sand')})
test('TD3-04: grava declarada emite',()=>{assert.equal(tornadoSurfaceAt([surface('gravel')],0,0).surface,'gravel')})
test('TD3-05: capa sin surface no equivale a tierra inferida',()=>{assert.equal(tornadoSurfaceAt([surface('')],0,0),null)})
test('TD3-05A: superficie Auto reutiliza el contrato de pintura existente',()=>{
 assert.equal(tornadoSurfaceAt([{...surface(''),layers:[{surface:'',name:'Tierra',color:'#7a5a3a'}]}],0,0)?.surface,'dirt')
 assert.equal(tornadoSurfaceAt([{...surface(''),layers:[{surface:'',name:'Arena',color:'#a98b65'}]}],0,0)?.surface,'sand')
})
test('TD3-06: roca y hierba no son fuentes automáticas de polvo',()=>{assert.equal(tornadoSurfaceAt([surface('stone')],0,0),null);assert.equal(tornadoSurfaceAt([surface('grass')],0,0),null)})
test('TD3-07: ausencia de capa rechaza nacimiento',()=>{assert.equal(tornadoSurfaceAt([{...surface(),paintAt:()=>-1}],0,0),null)})
test('TD3-08: agua física por encima del suelo bloquea polvo',()=>{assert.equal(tornadoSurfaceAt([surface()],0,0,{waterAt:()=>({surface:0.2})}),null)})
test('TD3-09: agua por debajo del terreno no suprime tierra',()=>{assert.ok(tornadoSurfaceAt([surface()],0,0,{waterAt:()=>({surface:-1})}))})
test('TD3-10: humedad y nieve suprimen polvo, sin alterar datos',()=>{
 assert.equal(tornadoSurfaceAt([surface()],0,0,{...opts,wet:1}),null)
 assert.equal(tornadoSurfaceAt([surface()],0,0,{...opts,snow:1}),null)
 assert.equal(tornadoSurfaceAt([surface()],0,0,{...opts,rain:1}),null)
})
test('TD3-11: suelo húmedo produce menor disponibilidad',()=>{
 const d=tornadoSurfaceAt([surface()],0,0,opts).dryness, w=tornadoSurfaceAt([surface()],0,0,{wet:0.6}).dryness
 assert.ok(w<d)
})
test('TD3-12: sin circulación física no se emite',()=>{assert.equal(tornadoDustRate({phase:'organization',intensity:0,active:false},1),0)})
test('TD3-13: fuerza activa controla la emisión sin consultar embudo',()=>{
 assert.ok(tornadoDustRate({active:true,intensity:25,phase:'active'},1)>0)
 assert.ok(tornadoDustRate({active:true,intensity:25,phase:'active',condensationOpacity:0},1)>0)
})
test('TD3-14: debilitamiento y lluvia reducen emisiones',()=>{
 assert.ok(tornadoDustRate({active:true,intensity:24},0.4)<tornadoDustRate({active:true,intensity:24},1))
 assert.equal(tornadoDustRate({active:true,intensity:0},1),0)
})
test('TD3-15: sin datos no inventa superficie',()=>{assert.equal(tornadoSurfaceAt([{}],0,0),null);assert.equal(tornadoSurfaceAt([surface()],Infinity,0),null)})
test('TD3-16: reutilización VFX CPU/render sin modificar el esquema .vfx',()=>{
 const n=source('src/engine/runtime/world/nature.js')
 assert.match(n,/new VfxSimulation\(/);assert.match(n,/new VfxBillboardRenderer\(/)
 assert.match(n,/sim\.flowAt = \(x, y, z\) => world\.windAt3D\(x, y, z\)/)
 assert.match(n,/current\.renderer\.dispose\(\)/)
 assert.match(n,/this\._tornadoDust = null/)
 assert.match(n,/!playing \|\| !world\?\.tornado/)
})
test('TD3-17: SceneGraph enlaza agua física y terrain existentes en Editor/Player',()=>{
 const s=source('src/engine/runtime/scene-graph.js')
 assert.match(s,/waterAt: \(x, z\) => \(this\._activeWaterWorld \|\| this\._physicalWaterView\?\.water\)\?\.at/)
 assert.match(s,/terrains: \(\) => this\.terrains/)
})
test('TD3-18: no toca Shader meteorológico ni física para hacer el polvo',()=>{
 const n=source('src/engine/runtime/world/nature.js')
 assert.doesNotMatch(n,/new World\(|new CloudField\(|new WindField\(/)
 const s=source('src/engine/runtime/world/tornado-surface.js');assert.doesNotMatch(s,/new World\(|new CloudField\(/)
})

test('TD3-19: textura/material de suelo define el tinte visual sin asset meteorológico',()=>{
 const n=source('src/engine/runtime/world/nature.js');assert.match(n,/surface\.color !== dust\.lastColor/)
 assert.match(n,/sim\.visualTint = channels\.map/)
})
test('TD3-20: WaterWorld aporta humedad física cuando existe hidrología',()=>{
 const scene=source('src/engine/runtime/scene-graph.js'), n=source('src/engine/runtime/world/nature.js')
 assert.match(scene,/r\.moistureAt\(Math\.floor/)
 assert.match(n,/this\.opts\.soilAt\?\.\(t\.x, t\.z\) \?\? this\._wet/)
})
