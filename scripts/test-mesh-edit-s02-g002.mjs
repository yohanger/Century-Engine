import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PolyMesh, ekey } from '../src/engine/runtime/mesh/polymesh.js'
import { polyBuffers } from '../src/engine/runtime/mesh/buffers.js'
import { Sel, normalize } from '../src/core/mesh/sel.js'
import { projectPlanar, projectBox, transformUV, setSeams, uvPreview } from '../src/core/mesh/uv.js'
import * as O from '../src/core/mesh/ops.js'

const sample = () => new PolyMesh([[0,0,0],[1,0,0],[1,1,0],[0,1,0]],[[0,1,2],[0,2,3]])
const sel = (m, mode, ids) => { const s = new Sel(); s[mode === 'face' ? 'f' : mode === 'edge' ? 'e' : 'v'] = new Set(ids); return normalize(m,s,mode) }
const source = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-5, `${a} ~= ${b}`)

test('UV G002-01: proyecto antiguo abre y serializa sin campos nuevos obligatorios',()=>{
  const old={v:[0,0,0,1,0,0,0,1,0],f:[[0,1,2]],we:[],smooth:false,rev:12}
  const m=PolyMesh.fromJSON(old)
  assert.deepEqual(m.uv,[]); assert.equal('uv' in m.toJSON(),false)
  assert.equal(polyBuffers(m).uvs.length,6)
})
test('UV G002-02: UV por esquina permite costura en vértice compartido',()=>{
  const m=sample();m.uv=[[[0,0],[1,0],[1,1]],[[0.5,0.5],[0,1],[0,0]]]
  const b=polyBuffers(m,{smooth:true});assert.ok(b.positions.length/3>m.v.length);assert.equal(b.uvs.length/2,b.positions.length/3)
})
test('UV G002-03: normal plana exporta UV y normales sin desajuste',()=>{
  const m=sample(); projectBox(m,null); const b=polyBuffers(m)
  assert.equal(b.uvs.length/2,b.positions.length/3); assert.equal(b.normals.length,b.positions.length)
})
test('UV G002-04: roundtrip guarda UV, costuras y pesos de 8 capas',()=>{
  const m=sample();projectBox(m);m.seams=[[0,2]]
  m.colors=m.v.map(()=>[.1,.2,.3]);m.weights=m.v.map(()=>[.4,.6,0,0,0,0,0,0]);
  const j=m.toJSON(), r=PolyMesh.fromJSON(j);assert.deepEqual(r.uv,j.uv);assert.deepEqual(r.weights,j.weights)
  assert.deepEqual(r.seams,[[0,2]]);assert.equal(polyBuffers(r).weights0.length/4,polyBuffers(r).positions.length/3)
})
test('UV G002-05: planar en eje X',()=>{const m=sample();assert.equal(projectPlanar(m,null,'x'),undefined); assert.deepEqual(m.uv[0][1],[0,0])})
test('UV G002-06: planar rechaza eje inválido sin mutación',()=>{const m=sample();assert.equal(typeof projectPlanar(m,null,'no'),'string');assert.deepEqual(m.uv,[])})
test('UV G002-07: transformar UV en una selección no altera cara vecina',()=>{
 const m=sample();projectBox(m);const before=m.uv[1].map(x=>[...x]);const s=sel(m,'face',[0]);
 assert.equal(transformUV(m,s,{translate:[.25,-.5]}),undefined);assert.deepEqual(m.uv[1],before)
})
test('UV G002-08: escala y rotación UV conservan valores finitos',()=>{
 const m=sample();projectBox(m);transformUV(m,null,{rotate:90,scale:[2,2]});assert.ok(m.uv.flat(2).every(Number.isFinite))
})
test('UV G002-09: escala cero y NaN se rechazan',()=>{
 const m=sample();projectBox(m);const old=JSON.stringify(m.uv)
 assert.equal(typeof transformUV(m,null,{scale:[0,1]}),'string');assert.equal(JSON.stringify(m.uv),old)
 assert.equal(typeof transformUV(m,null,{rotate:NaN}),'string')
})
test('UV G002-10: costuras requieren aristas y se pueden quitar',()=>{
 const m=sample(), s=sel(m,'edge',[ekey(0,2)]);setSeams(m,s,true);assert.deepEqual(m.seams,[[0,2]])
 setSeams(m,s,false);assert.deepEqual(m.seams,[])
})
test('UV G002-11: clonar aísla datos y permite cancelar una operación',()=>{
 const m=sample();projectBox(m);const clone=m.clone();transformUV(m,null,{translate:[1,0]});assert.notDeepEqual(m.uv,clone.uv)
})
test('UV G002-12: reconciliación preserva UV ya editadas si topología es idéntica',()=>{
 const m=sample();projectBox(m);const old=m.clone();transformUV(m,null,{translate:[1,0]});const updated=structuredClone(m.uv)
 m.reconcileAttributes(old);assert.deepEqual(m.uv,updated)
})
test('UV G002-13: subdividir conserva datos válidos en todas las caras nuevas',()=>{
 const m=sample();projectBox(m);const s=sel(m,'face',[0]);const prev=m.clone(); O.subdivide(m,s,'face',{cuts:1});m.reconcileAttributes(prev)
 assert.equal(m.uv.length,m.f.length);assert.ok(m.uv.every((u,i)=>u.length===m.f[i].length))
 assert.ok(m.uv.flat(2).every(Number.isFinite))
})
test('UV G002-14: extruir conserva UV por cara y sin valores inválidos',()=>{
 const m=sample();projectBox(m);const prev=m.clone();O.extrudeIndividual(m,sel(m,'face',[0]),'face',{distance:.3});m.reconcileAttributes(prev)
 assert.equal(m.uv.length,m.f.length);assert.ok(m.uv.every((u,i)=>u.length===m.f[i].length))
})
test('UV G002-15: inversión de caras mantiene las esquinas asociadas a sus vértices',()=>{
 const m=sample();projectBox(m);const prev=m.clone();O.flipNormals(m,sel(m,'face',[0]),'face');m.reconcileAttributes(prev)
 const orig=prev.f[0], after=m.f[0];after.forEach((v,i)=> assert.deepEqual(m.uv[0][i],prev.uv[0][orig.indexOf(v)]))
})
test('UV G002-16: quitar vértices reindexa costuras y atributos',()=>{
 const m=new PolyMesh([[9,9,9],...sample().v],[[1,2,3],[1,3,4]]);projectBox(m)
 m.seams=[[1,3]];m.colors=m.v.map(()=>[1,0,0]);m.weights=m.v.map(()=>[1,0,0,0,0,0,0,0]);m.removeVerts(new Set([0]))
 assert.equal(m.colors.length,4);assert.deepEqual(m.seams,[[0,2]]);assert.equal(m.uv.length,2)
})
test('UV G002-17: geometría Editor y Player usa buffer UV común',()=>{
 assert.match(source('src/engine/runtime/nodes/mesh.js'),/setAttribute\('uv'/)
 assert.match(source('src/core/mesh/session.js'),/setAttribute\('uv'/)
 assert.match(source('src/core/mesh/session.js'),/reconcileAttributes\(base\)/)
})
test('UV G002-18: interfaz y acciones UV utilizan sesión e historial existentes',()=>{
 assert.match(source('src/components/MeshPanel.vue'),/data-testid="mesh-uv-panel"/)
 assert.match(source('src/core/mesh/session.js'),/uvAction\(kind, options/)
 assert.match(source('src/core/mesh/session.js'),/this\.run\('UV:/)
})
test('UV G002-19: vista UV no muta geometría del proyecto',()=>{
 const m=sample();const before=m.toJSON();const out=uvPreview(m,null)
 assert.equal(out.length,2);assert.deepEqual(m.toJSON().f,before.f);assert.deepEqual(m.uv,[])
})
test('UV G002-20: materiales existentes siguen seleccionables',()=>{
 assert.match(source('src/engine/runtime/nodes/mesh.js'),/syncPbrMaterial\(root\.userData\.mat, obj\)/)
})
test('UV G002-21: unión de mallas conserva UV y datos de pintura del origen',()=>{
 const a=sample();projectBox(a);a.colors=a.v.map(()=>[1,0,0]);a.weights=a.v.map(()=>[.3,.7,0,0,0,0,0,0]);
 const b=sample();projectBox(b);b.colors=b.v.map(()=>[0,1,0]);b.weights=b.v.map(()=>[.8,.2,0,0,0,0,0,0]);b.seams=[[0,2]]
 const s=sel(a,'face',[0]);const orig=a.clone();O.addMesh(a,b,s,'face');a.reconcileAttributes(orig)
 assert.equal(a.uv.length,4);assert.deepEqual(a.colors[5],[0,1,0]);assert.deepEqual(a.weights[5],[.8,.2,0,0,0,0,0,0]);assert.deepEqual(a.seams,[[4,6]])
})
test('UV G002-22: interpolación de nuevos vértices preserva pesos de pintura',()=>{
 const m=sample();projectBox(m);m.colors=m.v.map((_,i)=>[i/3,0,0]);m.weights=m.v.map((_,i)=>[i/3,1-i/3,0,0,0,0,0,0]);
 const base=m.clone();const s=sel(m,'face',[0]);O.subdivide(m,s,'face',{cuts:1});m.reconcileAttributes(base)
 assert.equal(m.weights.length,m.v.length);assert.equal(m.colors.length,m.v.length)
 const target=m.v.findIndex((v,i)=>i>=base.v.length && Math.abs(v[0]-.5)<1e-9 && Math.abs(v[1])<1e-9)
 assert.ok(target>=0);close(m.colors[target][0],1/6);close(m.weights[target][0],1/6)
})
test('UV G002-23: atributos inválidos se ignoran sin impedir abrir el proyecto',()=>{
 const j=sample().toJSON();j.uv=[[[0,0]]];j.colors=[[Infinity,1,1]];j.weights=[[1]];j.seams=[[-1,3]]
 const m=PolyMesh.fromJSON(j);assert.deepEqual(m.uv,[]);assert.deepEqual(m.colors,[]);assert.deepEqual(m.weights,[]);assert.deepEqual(m.seams,[])
})
test('UV G002-24: Extrude Individual conserva UV de la tapa original',()=>{
 const m=sample();projectBox(m);const prior=m.uv[0].map((u)=>[...u]), b=m.clone();
 O.extrudeIndividual(m,sel(m,'face',[0]),'face',{distance:.7});m.reconcileAttributes(b)
 assert.deepEqual(m.uv[0],prior)
})
test('UV G002-25: costura subdividida sigue marcada por segmentos',()=>{
 const m=sample();projectBox(m);m.seams=[[0,1]];const prior=m.clone();
 O.subdivide(m,sel(m,'face',[0]),'face',{cuts:1});m.reconcileAttributes(prior)
 const es=m.edges(), s=m.seams.map(([a,b])=>ekey(a,b));
 const midpoint=m.v.findIndex((p,i)=>i>=prior.v.length && Math.abs(p[0]-.5)<1e-8 && Math.abs(p[1])<1e-8)
 assert.ok(midpoint>=0);assert.ok(s.includes(ekey(0,midpoint)));assert.ok(s.includes(ekey(1,midpoint)))
 assert.ok(s.every(k=>es.has(k)))
})
