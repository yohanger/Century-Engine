import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PolyMesh, ekey } from '../src/engine/runtime/mesh/polymesh.js'
import { Sel, normalize } from '../src/core/mesh/sel.js'
import * as O from '../src/core/mesh/ops.js'

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const selected = (m, mode, { v = [], e = [], f = [] }) => {
  const s = new Sel(); s.v = new Set(v); s.e = new Set(e); s.f = new Set(f)
  return normalize(m, s, mode)
}
const square = () => new PolyMesh([[1,0,0],[2,0,0],[2,1,0],[1,1,0]], [[0,1,2,3]])
const grid = () => new PolyMesh([[-1,-1,0],[0,-1,0],[1,-1,0],[-1,1,0],[0,1,0],[1,1,0]], [[0,1,4,3],[1,2,5,4]])
const approx = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} ≈ ${b}`)
const valid = (m) => {
  for (const p of m.v) assert.ok(p.length === 3 && p.every(Number.isFinite))
  for (const face of m.f) {
    assert.ok(face.length >= 3 && new Set(face).size >= 3)
    for (const v of face) assert.ok(v >= 0 && v < m.v.length)
    assert.ok(m.faceNormalRaw(m.f.indexOf(face)).every(Number.isFinite))
  }
  assert.deepEqual(PolyMesh.fromJSON(m.toJSON()).f, m.f)
}

test('MESH-G001-01: Edge Slide desplaza una cadena de dos caras sin perder topología', () => {
  const m = grid(), s = selected(m,'edge',{e:[ekey(1,4)]})
  assert.equal(O.edgeSlide(m,s,'edge',{factor:0.5}),undefined)
  approx(m.v[1][0],-.5); approx(m.v[4][0],-.5); assert.equal(m.f.length,2); valid(m)
})
test('MESH-G001-02: Edge Slide cambia lado con signo negativo', () => {
  const m=grid(),s=selected(m,'edge',{e:[ekey(1,4)]})
  assert.equal(O.edgeSlide(m,s,'edge',{factor:-.5}),undefined)
  approx(m.v[1][0], .5); approx(m.v[4][0], .5)
})
test('MESH-G001-03: Edge Slide rechaza bordes exteriores',()=>{
 const m=grid(), s=selected(m,'edge',{e:[ekey(0,1)]}), before=JSON.stringify(m.v)
 assert.match(O.edgeSlide(m,s,'edge',{factor:.5}),/dos caras/); assert.equal(JSON.stringify(m.v),before)
})
test('MESH-G001-04: Edge Slide rechaza bifurcaciones sin modificar malla',()=>{
 const m=grid(); const s=selected(m,'edge',{e:[ekey(0,1),ekey(1,4),ekey(1,2)]}); const before=JSON.stringify({v:m.v,f:m.f,we:m.we})
 assert.match(O.edgeSlide(m,s,'edge',{factor:.5}),/aristas interiores|bifurcación/); assert.equal(JSON.stringify({v:m.v,f:m.f,we:m.we}),before)
})
test('MESH-G001-05: Vertex Slide escoge arista vecina por eje',()=>{
 const m=new PolyMesh([[0,0,0],[1,0,0],[-1,0,0],[0,1,0]],[],[[0,1],[0,2],[0,3]])
 const s=selected(m,'vertex',{v:[0]})
 assert.equal(O.vertexSlide(m,s,'vertex',{factor:.5,axis:'x'}),undefined); approx(m.v[0][0],.5)
})
test('MESH-G001-06: Vertex Slide negativo y preservación de aristas',()=>{
 const m=new PolyMesh([[0,0,0],[1,0,0],[-1,0,0]],[],[[0,1],[0,2]])
 const s=selected(m,'vertex',{v:[0]}); O.vertexSlide(m,s,'vertex',{factor:-.3,axis:'x'})
 approx(m.v[0][0],-.3); assert.equal(m.edges().size,2);valid(m)
})
test('MESH-G001-07: Vertex Slide exige dirección válida y no muta en error',()=>{
 const m=new PolyMesh([[0,0,0],[1,0,0]],[],[[0,1]]),s=selected(m,'vertex',{v:[0]})
 const before=JSON.stringify(m.v)
 assert.equal(typeof O.vertexSlide(m,s,'vertex',{factor:-.4,axis:'x'}),'string');assert.equal(JSON.stringify(m.v),before)
})
test('MESH-G001-08: Vertex Slide permite destino explícito',()=>{
 const m=new PolyMesh([[0,0,0],[0,1,0]],[],[[0,1]]),s=selected(m,'vertex',{v:[0]})
 assert.equal(O.vertexSlide(m,s,'vertex',{factor:.5,target:1}),undefined);approx(m.v[0][1],.5)
})
test('MESH-G001-09: Extrude Individual crea paredes distintas por cara',()=>{
 const m=new PolyMesh([[0,0,0],[1,0,0],[1,1,0],[0,1,0]],[[0,1,2],[0,2,3]])
 const s=selected(m,'face',{f:[0,1]});const r=O.extrudeIndividual(m,s,'face',{distance:1})
 assert.equal(r,undefined);assert.equal(m.f.length,8);assert.equal(m.v.length,10); assert.equal(s.f.size,2);valid(m)
})
test('MESH-G001-10: Extrude Individual respeta normales por cara',()=>{
 const m=new PolyMesh([[0,0,0],[1,0,0],[0,1,0],[0,0,1]],[[0,1,2],[0,3,1]])
 const s=selected(m,'face',{f:[0,1]});O.extrudeIndividual(m,s,'face',{distance:.75})
 const aa=m.v[m.f[0][0]],bb=m.v[m.f[1][0]]
 assert.ok(Math.abs(aa[2]-bb[2])>.1 || Math.abs(aa[1]-bb[1])>.1);valid(m)
})
test('MESH-G001-11: Extrude Individual rechaza otro modo y distancia inválida',()=>{
 const m=square(),s=selected(m,'face',{f:[0]}), before=JSON.stringify(m.v)
 assert.equal(typeof O.extrudeIndividual(m,s,'face',{distance:NaN}),'string');assert.equal(JSON.stringify(m.v),before)
 assert.equal(typeof O.extrudeIndividual(m,s,'vertex',{distance:1}),'string')
})
test('MESH-G001-12: Spin crea pasos y cap final seleccionada',()=>{
 const m=square(),s=selected(m,'face',{f:[0]})
 assert.equal(O.spin(m,s,'face',{angle:90,axis:'y',steps:3,center:[0,0,0]}),undefined)
 assert.equal(m.f.length,13);assert.equal(m.v.length,16);assert.deepEqual([...s.f],[0]);valid(m)
})
test('MESH-G001-13: Spin usa eje opuesto con ángulo negativo',()=>{
 const m=square(),s=selected(m,'face',{f:[0]})
 O.spin(m,s,'face',{angle:-90,axis:'y',steps:1,center:[0,0,0]})
 assert.ok(m.v[4][2]>0);valid(m)
})
test('MESH-G001-14: Spin rechaza vueltas completas sin dejar geometría extra',()=>{
 const m=square(),s=selected(m,'face',{f:[0]}),before=m.toJSON()
 assert.equal(typeof O.spin(m,s,'face',{angle:360,steps:2}),'string');assert.equal(m.v.length,4);assert.deepEqual(m.f,before.f)
})
test('MESH-G001-15: Spin rechaza eje que atraviesa un vértice',()=>{
 const m=new PolyMesh([[0,0,0],[1,0,0],[1,1,0]],[[0,1,2]]),s=selected(m,'face',{f:[0]})
 assert.equal(typeof O.spin(m,s,'face',{angle:90,steps:3}),'string');assert.equal(m.v.length,3)
})
test('MESH-G001-16: Spin rechaza malla cerrada sin borde',()=>{
 const m=new PolyMesh([[1,0,0],[0,1,0],[0,0,1],[1,1,1]],[[0,1,2],[0,3,1],[1,3,2],[0,2,3]]),s=selected(m,'face',{f:[0,1,2,3]})
 assert.match(O.spin(m,s,'face',{angle:90}),/borde/);assert.equal(m.f.length,4)
})
test('MESH-G001-17: Shear usa pivote y desplazamiento correcto',()=>{
 const m=square(),s=selected(m,'face',{f:[0]})
 O.shear(m,s,'face',{factor:2,axis:'x',reference:'y',pivot:[0,0,0]})
 assert.deepEqual(m.v[2],[4,1,0]);assert.deepEqual(m.v[0],[1,0,0]);valid(m)
})
test('MESH-G001-18: Shear por pivote implícito conserva centro',()=>{
 const m=square(),s=selected(m,'vertex',{v:[0,1,2,3]});const c=m.v.reduce((sum,p)=>sum+p[0],0)/4
 O.shear(m,s,'vertex',{factor:.5,axis:'x',reference:'y'})
 approx(m.v.reduce((sum,p)=>sum+p[0],0)/4,c)
})
test('MESH-G001-19: Shear rechaza ejes coincidentes sin cambios',()=>{
 const m=square(),s=selected(m,'face',{f:[0]}),before=JSON.stringify(m.v)
 assert.equal(typeof O.shear(m,s,'face',{factor:1,axis:'y',reference:'y'}),'string');assert.equal(JSON.stringify(m.v),before)
})
test('MESH-G001-20: Operaciones públicas registradas y reutilizan PolyMesh',()=>{
 for(const name of ['vertexSlide','edgeSlide','extrudeIndividual','spin','shear'])assert.equal(typeof O.OPS[name],'function')
})
test('MESH-G001-21: Comandos, UI y EditSession tienen las cinco acciones',()=>{
 const c=read('src/core/commands.js'),ui=read('src/components/MeshPanel.vue'),ses=read('src/core/mesh/session.js')
 for(const op of ['vertexSlide','edgeSlide','extrudeIndividual','spin','shear']) {
  assert.ok(c.includes(`mesh.${op}`));assert.ok(ui.includes(`mesh.${op}`));assert.ok(ses.includes(`case '${op}'`))
 }
})
test('MESH-G001-22: Previsualización tiene confirmación y cancelación de cambios',()=>{
 const src=read('src/core/mesh/session-modal.js')
 for(const op of ['vertexSlide','edgeSlide','extrudeIndividual','spin','shear']) assert.ok(src.includes(`'${op}'`))
 assert.ok(src.includes('m.previewValid === false')); assert.match(src,/this\.poly = m\.base\.clone\(\)/)
 assert.match(src,/this\.poly = m\.base\s*\n/); assert.match(src,/this\.commit\(label/)
})
test('MESH-G001-23: Guardado y carga mantienen geometría creada por Spin',()=>{
 const m=square(),s=selected(m,'face',{f:[0]});O.spin(m,s,'face',{angle:45,steps:4})
 const rebuilt=PolyMesh.fromJSON(m.toJSON());assert.equal(rebuilt.v.length,m.v.length);valid(rebuilt)
})
test('MESH-G001-24: La suite no crea formato paralelo para mallas',()=>{
 const src=read('src/core/mesh/ops-shape.js');assert.ok(src.includes('polymesh.js'))
 assert.doesNotMatch(src,/import \* as THREE|new THREE\./)
})
