// Pruebas del contrato Vertex Paint en la malla; no dependen de WebGL ni de Electron.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PolyMesh } from '../src/engine/runtime/mesh/polymesh.js'
import { polyBuffers } from '../src/engine/runtime/mesh/buffers.js'
import { meshPaintConfig, paintWeights, ensurePaintWeights, removePaintLayer, swapPaintLayers } from '../src/engine/runtime/mesh/vertex-paint.js'

const square=()=>new PolyMesh([[0,0,0],[1,0,0],[1,1,0],[0,1,0]],[[0,1,2,3]])
const points=m=>m.v.map(v=>[...v])
const code=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8')
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`)

test('VP01: proyectos antiguos no activan la pintura',()=>{
 const m=square();assert.equal(meshPaintConfig(undefined),null)
 assert.equal(polyBuffers(m).weights0,null);assert.equal('weights' in m.toJSON(),false)
})
test('VP02: preparación de pesos 8 canales, base 100%',()=>{
 const m=square();ensurePaintWeights(m);assert.equal(m.weights.length,m.v.length)
 for(const w of m.weights){assert.equal(w.length,8);assert.deepEqual(w,[1,0,0,0,0,0,0,0])}
})
test('VP03: pintar capa 2 reduce la base sin perder suma 1',()=>{
 const m=square();const n=paintWeights(m,[0,0,0],points(m),{radius:1.5,strength:1,hardness:1,layer:1})
 assert.equal(n,4);near(m.weights[0][1],0.25)
 for(const w of m.weights)near(w.reduce((a,b)=>a+b,0),1)
})
test('VP04: pincel pequeño no afecta vértices externos',()=>{
 const m=square();paintWeights(m,[0,0,0],points(m),{radius:0.3,strength:1,hardness:1,layer:1})
 assert.equal(m.weights[0][1],.25);assert.deepEqual(m.weights[1],[1,0,0,0,0,0,0,0])
})
test('VP05: dureza gradual reduce intensidad cerca del borde',()=>{
 const m=new PolyMesh([[0,0,0],[.5,0,0],[.9,0,0]],[],[[0,1],[1,2]])
 paintWeights(m,[0,0,0],points(m),{radius:1,strength:1,hardness:0,layer:1})
 assert.ok(m.weights[0][1]>m.weights[1][1]);assert.ok(m.weights[1][1]>m.weights[2][1])
})
test('VP06: borrar restaura progresivamente el peso de otras capas',()=>{
 const m=square();paintWeights(m,[0,0,0],points(m),{radius:2,strength:1,hardness:1,layer:2})
 const old=m.weights[0][2];paintWeights(m,[0,0,0],points(m),{radius:2,strength:1,hardness:1,layer:2,erase:true})
 assert.ok(m.weights[0][2]<old);near(m.weights[0].reduce((a,b)=>a+b,0),1)
})
test('VP07: ocultos nunca reciben pintura',()=>{
 const m=square();m.hidden.add(0);paintWeights(m,[0,0,0],points(m),{radius:2,strength:1,hardness:1,layer:1})
 assert.deepEqual(m.weights[0],[1,0,0,0,0,0,0,0])
})
test('VP08: valores peligrosos no alteran la malla',()=>{
 const m=square();assert.equal(paintWeights(m,[0,0,0],points(m),{layer:8,radius:1}),0)
 assert.equal(paintWeights(m,[0,0,0],points(m),{radius:Infinity}),0)
 assert.equal(paintWeights(m,[0,0,0],points(m),{radius:-1}),0)
 assert.deepEqual(m.weights,[])
})
test('VP09: quitar capa compacta los pesos, conservando normalización',()=>{
 const m=square();ensurePaintWeights(m);m.weights[0]=[.2,.3,.5,0,0,0,0,0]
 assert.equal(removePaintLayer(m,1,3),true)
 near(m.weights[0][0],.2/.7);near(m.weights[0][1],.5/.7)
})
test('VP10: intercambio de capas preserva suma y cantidad',()=>{
 const m=square();ensurePaintWeights(m);m.weights[0]=[.2,.8,0,0,0,0,0,0]
 assert.equal(swapPaintLayers(m,0,1,2),true);near(m.weights[0][0],.8);near(m.weights[0][1],.2)
})
test('VP11: deshacer un trazo restaura copia original sin referencias compartidas',()=>{
 const m=square(),before=m.clone();paintWeights(m,[0,0,0],points(m),{radius:2,strength:1,layer:1})
 assert.deepEqual(before.weights,[]);assert.ok(m.weights.length)
})
test('VP12: serialización de malla pintada conserva pesos tras recarga',()=>{
 const m=square();paintWeights(m,[0,0,0],points(m),{radius:2,strength:1,layer:1})
 assert.deepEqual(PolyMesh.fromJSON(m.toJSON()).weights,m.toJSON().weights)
})
test('VP13: buffers Editor/Player tienen ocho pesos por vértice',()=>{
 const m=square();ensurePaintWeights(m);const b=polyBuffers(m)
 assert.equal(b.weights0.length,b.positions.length/3*4)
 assert.equal(b.weights1.length,b.positions.length/3*4)
})
test('VP14: la pintura solo se activa con configuración explícita',()=>{
 const cfg=meshPaintConfig({enabled:true,layers:[{name:'Base',color:'#aaaaaa',tile:1}]})
 assert.equal(cfg.layers.length,1);assert.equal(meshPaintConfig({enabled:false,layers:cfg.layers}),null)
})
test('VP15: no se subdivide automáticamente la malla al pintar',()=>{
 const m=square(),nv=m.v.length,nf=m.f.length
 paintWeights(m,[0,0,0],points(m),{radius:2,strength:1,layer:1})
 assert.equal(m.v.length,nv);assert.equal(m.f.length,nf)
})
test('VP16: módulo de materiales conserva PBR y soporta array sRGB',()=>{
 const s=code('src/engine/runtime/mesh/vertex-paint-material.js')
 assert.match(s,/state\.baseCompile\.call/);assert.match(s,/THREE\.SRGBColorSpace/)
 assert.match(s,/sampler2DArray/);assert.match(s,/textureGrad\(/)
})
test('VP17: node mesh activa pintura explícita después de PBR',()=>{
 const s=code('src/engine/runtime/nodes/mesh.js')
 assert.match(s,/syncPbrMaterial\(root\.userData\.mat, obj\)/)
 assert.match(s,/syncMeshPaintMaterial\(root\.userData\.mat, obj\.props\?\.meshPaint\)/)
})
test('VP18: EditSession compromete una vez al soltar y permite cancelar',()=>{
 const s=code('src/core/mesh/session-paint.js')
 assert.match(s,/this\.commit\('Pintar malla'\)/);assert.match(s,/_cancelPaintStroke\(\)/)
})
test('VP19: entrada del visor consume puntero al pintar',()=>{
 const s=code('src/core/mesh/session-input.js')
 assert.match(s,/_startPaintStroke\(e\)/);assert.match(s,/_paintDab\(e\)/)
 assert.match(s,/_finishPaintStroke\(\)/)
})
test('VP20: UI ofrece selector de texturas, dureza, radio y capas',()=>{
 const s=code('src/components/MeshPanel.vue')
 for(const a of ['mesh-vertex-paint','painter.radius','painter.strength','painter.hardness','layer.texture','layerOp'])assert.ok(s.includes(a),a)
})
test('VP21: no se modifica el shader global de Terrain ni mallas antiguas',()=>{
 const s=code('src/engine/runtime/nodes/mesh.js')
 assert.match(s,/if \(meshPaintConfig\(obj\.props\?\.meshPaint\)\)/)
})
test('VP22: las imágenes reutilizan el cargador de Terrain',()=>{
 assert.match(code('src/engine/runtime/mesh/vertex-paint-material.js'),/import \{ layerPixels \}/)
 assert.match(code('src/engine/runtime/geometry/terrain.js'),/export async function layerPixels\(/)
})
