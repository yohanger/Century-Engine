// Gate S01: referencias métricas que no dependen de UV artísticas, ni de divisiones de la geometría.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { cube, plane } from '../src/engine/runtime/mesh/generators.js'
import { Sel } from '../src/core/mesh/sel.js'
import { extrudeIndividual } from '../src/core/mesh/ops-edit.js'
import { subdivide } from '../src/core/mesh/ops-fill.js'
import { faceMetrics, polyFaceMetrics, primitiveMetricAttributes } from '../src/engine/runtime/mesh/blockout-metrics.js'
import { polyBuffers } from '../src/engine/runtime/mesh/buffers.js'
import { PolyMesh } from '../src/engine/runtime/mesh/polymesh.js'
const read=(file)=>readFileSync(new URL('../'+file,import.meta.url),'utf8')
const approx=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`)
const equalDims=(size, a,b)=>{ approx(size[0],a); approx(size[1],b) }

test('BLOCK01: pared 100 x 4 m indica ambas dimensiones reales',()=>{
 const mesh=cube(100,4,0.25),dims=polyFaceMetrics(mesh)
 equalDims(dims[0].size,100,4)
})
test('BLOCK02: mediciones por cara empiezan en cero independientemente de la traslación',()=>{
 const f=[[250,30,-20],[350,30,-20],[350,34,-20],[250,34,-20]]
 const a=faceMetrics(f),b=faceMetrics(f.map(p=>p.map(v=>v+2000)))
 assert.deepEqual(a,b);equalDims(a.size,100,4)
})
test('BLOCK03: escalado no uniforme actualiza metros (sin editar UV)',()=>{
 const mesh=cube(),dims=polyFaceMetrics(mesh,[100,4,3]);equalDims(dims[0].size,100,4)
})
test('BLOCK04: rotación rígida mantiene unidades métricas',()=>{
 const f=[[0,0,0],[100,0,0],[100,4,0],[0,4,0]],a=faceMetrics(f)
 const rotated=f.map(([x,y,z])=>[y,-x,z]);equalDims(faceMetrics(rotated).size,...a.size)
})
test('BLOCK05: extrusión de 3m crea caras con referencia 3m',()=>{
 const m=cube(100,4,1),s=new Sel();s.f.add(1)
 extrudeIndividual(m,s,'face',{distance:3});const measures=polyFaceMetrics(m)
 assert.equal(m.f.length,10)
 assert.ok(measures.slice(6).some(x=>x.size.some(v=>Math.abs(v-3)<1e-5)))
 for(const f of measures.slice(6)){approx(Math.min(...f.uv.map(p=>p[0])),0);approx(Math.min(...f.uv.map(p=>p[1])),0)}
})
test('BLOCK06: la nueva cara no hereda UV ni origen de la cara anterior',()=>{
 const m=cube(100,4,1),orig=m.clone(),s=new Sel();s.f.add(1)
 m.ensureUV(); const stored=m.uv.map(loop=>loop.map(uv=>[...uv]));const before=m.clone();
 extrudeIndividual(m,s,'face',{distance:3});m.reconcileAttributes(before)
 assert.equal(m.uv.length,m.f.length)
 assert.deepEqual(stored[0],m.uv[0])
 assert.equal(m.f.length,10)
 const dims=polyFaceMetrics(m)
 assert.ok(dims.slice(6).every((face)=>face.uv.some((uv)=>uv[0]===0)))
 void orig
})
test('BLOCK07: subdivisión conserva mediciones, nunca modifica UV artísticas',()=>{
 const m=plane(10,5);m.ensureUV();const before=m.clone(),sel=new Sel();sel.f.add(0)
 assert.equal(subdivide(m,sel,'face',{cuts:1}),undefined)
 m.reconcileAttributes(before)
 assert.equal(m.f.length,4)
 assert.equal(m.uv.length,m.f.length)
 assert.ok(polyFaceMetrics(m).every(f=>Math.abs(f.size[0]-5)<1e-5 && Math.abs(f.size[1]-2.5)<1e-5))
 const b=polyBuffers(m,{blockout:true})
 assert.ok(b.blockUV && b.blockSize)
})
test('BLOCK08: atributos métricos son independientes de las UV modificadas por el usuario',()=>{
 const m=plane(6,3);m.ensureUV();m.uv[0].forEach((uv,i)=>{uv[0]=i*0.075;uv[1]=8-i})
 const b=polyBuffers(m,{blockout:true});assert.ok(b.uvs[0]!==b.blockUV[0]);
 assert.equal(b.positions.length/3,b.blockUV.length/2)
})
test('BLOCK09: mallas suaves se separan solo para la geometría metric (sin perder datos)',()=>{
 const m=cube(3,4,5);m.smooth=true
 const a=polyBuffers(m);const b=polyBuffers(m,{blockout:true})
 assert.equal(a.blockUV,undefined);assert.ok(b.blockUV)
 assert.equal(b.blockUV.length,b.blockSize.length)
})
test('BLOCK10: JSON legado no incorpora estado duplicado ni atributos métricos en disco',()=>{
 const m=cube();const j=m.toJSON();assert.ok(!Object.hasOwn(j,'blockUV'))
 assert.deepEqual(PolyMesh.fromJSON(j).toJSON().f,j.f)
})
test('BLOCK11: geometría degenerada produce un estado seguro',()=>assert.equal(faceMetrics([[0,0,0],[0,0,0],[0,0,0]]),null))
test('BLOCK12: primitivas compuestas reciben atributos del plano completo, no por triángulo',()=>{
 const positions=new Float32Array([
 -50,-2,0, 50,-2,0, 50,2,0,
 -50,-2,0, 50,2,0, -50,2,0,
 ])
 const normals=new Float32Array(18).fill(0)
 const {uv,size}=primitiveMetricAttributes(positions,normals)
 for(let i=0;i<size.length;i+=2){approx(size[i],100);approx(size[i+1],4)}
 assert.deepEqual([...uv.slice(0,2)],[...uv.slice(6,8)])
})
test('BLOCK13: modelo de bloque pinta líneas negras sin polígonos añadidos por metro',()=>{
 const s=read('src/engine/runtime/render/shaderlib.js')
 assert.match(s,/vec3\(0\.025\)/);assert.match(s,/lfBlockColor\(vLfBlockMetricUV - vec2\(0\.5\)\)/)
 assert.doesNotMatch(s,/for\s*\(.*100.*\)/)
})
test('BLOCK14: etiqueta de medidas muestra METROS y ambos ejes métricos',()=>{
 const s=read('src/engine/runtime/render/shaderlib.js');for(const k of ['lfMetricGlyph','lfBlockLabel','lfMeterDigits','uLfBlockFont','uLfBlockFaces'])assert.ok(s.includes(k))
 assert.match(s,/float width = floor\(size\.x \+ 0\.5\)/)
 assert.match(s,/float width = floor\(size\.x \+ 0\.5\), height = floor\(size\.y \+ 0\.5\)/)
})
test('BLOCK15: las primitivas continúan compartiendo geometrías de catálogo; metría usa copia individual',()=>{
 const s=read('src/engine/runtime/nodes/primitive.js')
 assert.match(s,/geometry\.clone\(\)/);assert.match(s,/root\.userData\.metricOwnGeometry = own/)
 assert.match(s,/METRIC_PRIMITIVES/)
})
test('BLOCK16: editar malla en vivo actualiza atributos después de operaciones topológicas',()=>{
 const s=read('src/core/mesh/session.js')
 assert.match(s,/lfBlockUV/);assert.match(s,/this\.body\.material\.userData\.lfBlockFaces/)
})
test('BLOCK17: restaurar Albedo sustituye el blockout sin cambiar UV métricas',()=>{
 const s=read('src/engine/runtime/render/shaderlib.js')
 assert.match(s,/if \(uAlbedo_set\)/)
 const p=read('src/engine/runtime/nodes/mesh.js')
 assert.match(p,/effectiveMaterialObject\(obj, PBR_ENV\.materials\)/)
 assert.match(p,/!effective\.mat\?\.params\?\.uAlbedo/)
})
test('BLOCK18: el shader Blockout reutiliza PBR y no modifica shaders de usuario',()=>{
 const p=read('src/engine/runtime/render/pbr.js')
 assert.match(p,/const metric = doc\.id === BUILTIN_PREFIX \+ 'blockout'/)
 assert.match(p,/PRELUDE_VERT \+ metricPrelude/)
})
test('BLOCK19: editor y Player usan mismo nodo mesh y material',()=>{
 const s=read('src/engine/runtime/nodes/mesh.js');assert.match(s,/polyBuffers\(poly/)
 const nodes=read('src/engine/runtime/nodes/index.js');assert.match(nodes,/import '\.\/mesh\.js'/)
})
