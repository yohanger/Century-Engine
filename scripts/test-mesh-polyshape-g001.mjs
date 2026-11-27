// LF-MESH-POLYSHAPE-G001: geometría, continuidad de Edit Mesh y regresión de superficie a sólido.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PolyMesh, ekey, checkClosed, signedVolume, triangulateFace, validatePolygon } from '../src/engine/runtime/mesh/polymesh.js'
import { Sel, normalize } from '../src/core/mesh/sel.js'
import * as O from '../src/core/mesh/ops.js'
import { polyBuffers } from '../src/engine/runtime/mesh/buffers.js'
const source = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const poly = (points = [[0, 0, 0], [2, 0, 0], [2, 2, 0], [0, 2, 0]]) => new PolyMesh(points, [], points.map((_, i) => [i, (i + 1) % points.length]))
const selection = (m, mode, data) => { const s = new Sel(); s.v = new Set(data.v || []); s.e = new Set(data.e || []); s.f = new Set(data.f || []); return normalize(m, s, mode) }
const snapshot = (m) => JSON.stringify({ v: m.v, f: m.f, we: m.we, uv: m.uv })
const trianglesArea = (m, fi) => triangulateFace(m, fi).reduce((sum, [a, b, c]) => {
  const [p, q, r] = [m.v[a], m.v[b], m.v[c]]
  return sum + Math.abs((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]))/2
}, 0)

test('PS-01: la cadena abierta no se rellena', () => {
  const m = poly(), s = selection(m, 'edge', { e: [ekey(0,1),ekey(1,2),ekey(2,3)] })
  const before = snapshot(m); assert.match(O.fill(m, s, 'edge'), /cerrados/); assert.equal(snapshot(m), before)
})
test('PS-02: cierra desde un extremo sin inventar superficies', () => {
  const m = poly(); m.we.pop(); const s = selection(m, 'vertex', {v:[3]})
  assert.equal(O.closeContour(m, s, 'vertex'), undefined)
  assert.equal(m.we.length,4); assert.equal(m.f.length,0); assert.ok(m.edges().has(ekey(3,0)))
})
test('PS-03: botón Fill rellena el bucle desde un único punto activo', () => {
  const m = poly(), s = selection(m, 'vertex', {v:[0]})
  assert.equal(O.fill(m, s, 'vertex'), undefined); assert.equal(m.f.length,1); assert.equal(s.f.size,1)
})
test('PS-04: Fill convexo triangula sin polígonos ficticios', () => {
  const m = poly(), s = selection(m,'edge',{e:[...m.edges().keys()]})
  assert.equal(O.fill(m,s,'edge'),undefined); assert.equal(triangulateFace(m,0).length,2)
  assert.equal(polyBuffers(m).indices.length, 6)
})
test('PS-05: concavidad conserva la forma trazada y el área', () => {
  const m=poly([[0,0,0],[4,0,0],[4,4,0],[2,2,0],[0,4,0]])
  const s=selection(m,'vertex',{v:[0]}); assert.equal(O.fill(m,s,'vertex'),undefined)
  assert.equal(triangulateFace(m,0).length,3); assert.ok(Math.abs(trianglesArea(m,0)-12)<1e-8)
})
test('PS-06: cruces de aristas se rechazan antes de modificar caras',()=>{
  const m=poly([[0,0,0],[2,2,0],[0,2,0],[2,0,0]]), s=selection(m,'vertex',{v:[0]})
  const before=snapshot(m);assert.match(O.fill(m,s,'vertex'),/autointerseca|degenerada/);assert.equal(snapshot(m),before)
})
test('PS-07: cierre inválido por cruce deja intacta la cadena',()=>{
  const m=poly([[0,0,0],[2,2,0],[0,2,0],[2,0,0]]);m.we.pop()
  const s=selection(m,'vertex',{v:[0]});const before=snapshot(m)
  assert.equal(typeof O.closeContour(m,s,'vertex'),'string');assert.equal(snapshot(m),before)
})
test('PS-08: no coplanar no permite Fill',()=>{
  const m=poly([[0,0,0],[2,0,0],[2,2,.3],[0,2,0]]),s=selection(m,'vertex',{v:[0]})
  const before=snapshot(m);assert.match(O.fill(m,s,'vertex'),/coplanar/);assert.equal(snapshot(m),before)
})
test('PS-09: vértices repetidos y puntos casi idénticos se rechazan',()=>{
  const m=poly([[0,0,0],[2,0,0],[2,2,0],[0,0.0000001,0]]),s=selection(m,'vertex',{v:[0]})
  assert.match(O.fill(m,s,'vertex'),/coincidentes/)
  assert.match(validatePolygon(m,[0,1,2,0]),/repite/)
})
test('PS-10: una cara no se puede crear dos veces',()=>{
  const m=poly(), s=selection(m,'vertex',{v:[0]}); O.fill(m,s,'vertex')
  const before=snapshot(m), next=selection(m,'vertex',{v:[0,1,2,3]})
  assert.match(O.fill(m,next,'vertex'),/ya tiene una cara/);assert.equal(snapshot(m),before)
})
test('PS-11: relleno múltiple atómico con un bucle degenerado',()=>{
  const m=new PolyMesh([[0,0,0],[1,0,0],[1,1,0],[0,1,0],[3,0,0],[4,0,0],[5,0,0]],[],[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,4]])
  const s=selection(m,'edge',{e:[...m.edges().keys()]});const before=snapshot(m)
  assert.equal(typeof O.fill(m,s,'edge'),'string');assert.equal(snapshot(m),before)
})
test('PS-12: Extrude clásico mantiene sin tapa inferior',()=>{
  const m=poly(),s=selection(m,'vertex',{v:[0]});O.fill(m,s,'vertex');const f=selection(m,'face',{f:[0]})
  assert.equal(O.extrude(m,f,'face'),undefined);assert.equal(m.f.length,5);assert.notDeepEqual(checkClosed(m),[])
})
test('PS-13: Extrude sólido construye tapa, laterales y normales consistentes',()=>{
  const m=poly(),s=selection(m,'vertex',{v:[0]});O.fill(m,s,'vertex');const f=selection(m,'face',{f:[0]})
  assert.equal(O.extrudeSolid(m,f,'face'),undefined)
  assert.equal(m.f.length,6)
  for(let i=4;i<8;i++)m.v[i][2]=1
  assert.deepEqual(checkClosed(m),[])
  assert.ok(Math.abs(signedVolume(m)-4)<1e-8)
})
test('PS-14: solid extrude no se aplica a cara con vecinas fuera de selección',()=>{
  const m=new PolyMesh([[0,0,0],[1,0,0],[1,1,0],[0,1,0],[2,0,0],[2,1,0]],[[0,1,2,3],[1,4,5,2]])
  const s=selection(m,'face',{f:[0]}),before=snapshot(m)
  assert.match(O.extrudeSolid(m,s,'face'),/vecinas/);assert.equal(snapshot(m),before)
})
test('PS-15: sólido de dos caras contiguas tiene una única tapa y volumen consistente',()=>{
  const m=new PolyMesh([[0,0,0],[1,0,0],[2,0,0],[0,1,0],[1,1,0],[2,1,0]],[[0,1,4,3],[1,2,5,4]])
  const s=selection(m,'face',{f:[0,1]});assert.equal(O.extrudeSolid(m,s,'face'),undefined)
  m.v.slice(6).forEach((v)=>v[2]=1)
  assert.deepEqual(checkClosed(m),[]);assert.ok(Math.abs(signedVolume(m)-2)<1e-8)
})
test('PS-16: serialización preserva aristas, caras y UV tras construcción',()=>{
  const m=poly(), base=m.clone(),s=selection(m,'vertex',{v:[0]});O.fill(m,s,'vertex');m.reconcileAttributes(base)
  assert.equal(m.uv.length,1);const before=m.clone(),f=selection(m,'face',{f:[0]})
  O.extrudeSolid(m,f,'face');m.v.slice(4).forEach((v)=>v[2]=1);m.reconcileAttributes(before)
  const restored=PolyMesh.fromJSON(m.toJSON());assert.deepEqual(restored.f,m.f);assert.deepEqual(restored.we,m.we);assert.equal(restored.uv.length,m.f.length)
})
test('PS-17: conserva UV de otras caras no modificadas',()=>{
  const m=new PolyMesh([[0,0,0],[1,0,0],[1,1,0],[0,1,0],[3,0,0],[4,0,0],[4,1,0],[3,1,0]],[[0,1,2,3]],[[4,5],[5,6],[6,7],[7,4]])
  m.uv=[[[0,0],[1,0],[1,1],[0,1]]];const before=m.clone();const s=selection(m,'vertex',{v:[4]})
  assert.equal(O.fill(m,s,'vertex'),undefined);m.reconcileAttributes(before)
  assert.deepEqual(m.uv[0],before.uv[0])
})
test('PS-18: compatibilidad de buffers Blockout',()=>{
  const m=poly(),s=selection(m,'vertex',{v:[0]});O.fill(m,s,'vertex')
  const b=polyBuffers(m,{blockout:true});assert.equal(b.indices.length,6);assert.ok(b.uvs.length>0)
})
test('PS-19: comandos y panel reutilizan editor, sin rama paralela',()=>{
  const a=source('src/core/commands.js'),p=source('src/components/MeshPanel.vue'),s=source('src/core/mesh/session.js')
  for(const id of ['mesh.extrudeSolid','mesh.closeContour','mesh.fill'])assert.ok(a.includes(id))
  assert.match(p,/@click="closeVerts"/);assert.match(s,/O\.extrudeSolid|startExtrude\(true\)/)
})
test('PS-20: modal positivo evita la confirmación de un sólido con altura cero',()=>{
  const s=source('src/core/mesh/session-modal.js')
  assert.match(s,/m\.solid/);assert.match(s,/distinta de cero/);assert.match(s,/moved\.dot\(worldNormal\)/)
})
test('PS-21: compatibilidad de redondeo y Undo/Redo por sesión',()=>{
  const s=source('src/core/mesh/session.js')
  assert.match(s,/this\.poly\.reconcileAttributes\(base\)/);assert.match(s,/this\.commit\(label\)/)
  assert.match(s,/this\.poly = base; this\.sel = bs/)
  assert.match(s,/if \(ok && this\.sel\.f\.size && this\.mode !== 'face'\) this\.setMode\('face'\)/)
})
