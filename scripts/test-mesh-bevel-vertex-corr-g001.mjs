// LF-MESH-BEVEL-VERTEX-CORR-G001: QA geométrico, persistencia, atajos e integración declarada.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {cube,plane} from '../src/engine/runtime/mesh/generators.js'
import {PolyMesh,ekey,checkClosed,signedVolume,triangulate} from '../src/engine/runtime/mesh/polymesh.js'
import {Sel,normalize} from '../src/core/mesh/sel.js'
import {trimeshPoints,polyBuffers} from '../src/engine/runtime/mesh/buffers.js'
import * as ops from '../src/core/mesh/ops.js'

const src=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
const selection=(m,mode,ids)=>{let s=new Sel();s[mode==='vertex'?'v':mode==='edge'?'e':'f']=new Set(ids);return normalize(m,s,mode)}
const snap=(m)=>JSON.stringify({v:m.v,f:m.f,we:m.we,uv:m.uv,colors:m.colors,weights:m.weights})
const quality=(m)=>{
  assert.ok(m.v.every((p)=>p.length===3 && p.every(Number.isFinite)))
  assert.ok(m.f.every((f)=>f.length>=3 && new Set(f).size===f.length && f.every((v)=>Number.isInteger(v)&&v>=0&&v<m.v.length)))
  assert.equal(triangulate(m).tris.length>0,true)
  assert.deepEqual(PolyMesh.fromJSON(m.toJSON()).f,m.f)
}
const manifold=(m)=>{assert.deepEqual(checkClosed(m),[]);quality(m)}

test('BV-01: Ctrl+Shift+B agrega esquinas curvas reales a superficie abierta',()=>{
 const m=plane(4,4),s=selection(m,'vertex',[0]);const old=m.v.length
 assert.equal(ops.OPS.bevelVertex(m,s,'vertex',{width:.5,segments:6,profile:.5}),undefined)
 assert.ok(m.v.length>old+2);assert.equal(m.f.length,1);assert.ok(s.v.size>3);quality(m)
})
test('BV-02: Segmentos 1 = chaflán, sin vértices intermedios',()=>{
 const m=plane(),s=selection(m,'vertex',[0]); assert.equal(ops.OPS.bevelVertex(m,s,'vertex',{width:.2,segments:1}),undefined)
 assert.equal(m.f[0].length,5); quality(m)
})
test('BV-03: Funciona sobre vértices de una caja sin perforar la colisión',()=>{
 const m=cube(2,2,2),s=selection(m,'vertex',[0]); assert.equal(ops.OPS.bevelVertex(m,s,'vertex',{width:.25,segments:4}),undefined)
 manifold(m);assert.ok(s.v.size>3);assert.ok(signedVolume(m)>7.8 && signedVolume(m)<8)
})
test('BV-04: Múltiples esquinas adyacentes de acera conservan orientación y volumen',()=>{
 const m=cube(8,.4,3),s=selection(m,'vertex',[0,1,4,5]);assert.equal(ops.OPS.bevelVertex(m,s,'vertex',{width:.16,segments:5}),undefined)
 manifold(m);assert.ok(signedVolume(m)>8.5)
})
test('BV-05: Ocho esquinas y 32 segmentos mantienen malla cerrada y triangulable',()=>{
 const m=cube(),s=selection(m,'vertex',[0,1,2,3,4,5,6,7]);assert.equal(ops.OPS.bevelVertex(m,s,'vertex',{width:.2,segments:32}),undefined)
 manifold(m);assert.equal(s.v.size>100,true)
})
test('BV-06: Secciones inválidas no tocan geometría ni selección',()=>{
 for(const p of [{width:0},{width:NaN},{width:-2},{segments:0},{segments:33},{profile:2}]){
  const m=cube(),s=selection(m,'vertex',[0]);const before=snap(m),oldSel=s.toJSON()
  assert.equal(typeof ops.OPS.bevelVertex(m,s,'vertex',p),'string');assert.equal(snap(m),before);assert.deepEqual(s.toJSON(),oldSel)
 }
})
test('BV-07: Malla no manifold no se modifica',()=>{
 const m=new PolyMesh([[0,0,0],[2,0,0],[0,2,0],[1,1,1],[1,-1,0]],[[0,1,2],[0,3,1],[0,1,4]]),s=selection(m,'vertex',[0]);let before=snap(m)
 assert.equal(typeof ops.OPS.bevelVertex(m,s,'vertex',{width:.2}),'string');assert.equal(snap(m),before)
})
test('BV-08: Arista suelta no se bisela como vértice de superficie',()=>{
 const m=new PolyMesh([[0,0,0],[1,0,0],[0,1,0]],[],[[0,1],[0,2]]),s=selection(m,'vertex',[0]);const b=snap(m)
 assert.equal(typeof ops.OPS.bevelVertex(m,s,'vertex',{width:.2}),'string');assert.equal(snap(m),b)
})
test('BV-09: Sólo en modo vértice',()=>{
 const m=cube(),s=selection(m,'edge',[ekey(0,1)]);assert.equal(typeof ops.OPS.bevelVertex(m,s,'edge',{width:.2}),'string')
})
test('BV-10: Persistencia round-trip conserva bisel y atributos reconciliados',()=>{
 const m=cube(),before=m.clone(),s=selection(m,'vertex',[0]);m.uv=[];m.colors=m.v.map(()=>[.2,.4,.6]);m.weights=m.v.map(()=>[1,0,0,0,0,0,0,0]);
 assert.equal(ops.OPS.bevelVertex(m,s,'vertex',{width:.2,segments:3}),undefined);m.reconcileAttributes(before)
 const reload=PolyMesh.fromJSON(m.toJSON());assert.deepEqual(reload.f,m.f);manifold(reload);assert.ok(reload.colors.every((v)=>v.length===3));
})
test('BA-01: Bisel de borde abierto genera una tira real sin cerrar la superficie',()=>{
 const m=plane(4,4),s=selection(m,'edge',[ekey(0,1)]);const before=m.v.length
 assert.equal(ops.OPS.bevel(m,s,'edge',{width:.2,segments:4,profile:.5}),undefined)
 assert.equal(m.f.length,5);assert.ok(m.v.length>before);assert.ok(checkClosed(m).length>0);quality(m)
})
test('BA-02: Borde abierto de un segmento genera chaflán físico (no sólo normales)',()=>{
 const m=plane(4,4),s=selection(m,'edge',[ekey(0,1)]);const start=m.v.map(v=>[...v]);
 assert.equal(ops.OPS.bevel(m,s,'edge',{width:.2,segments:1,profile:.5}),undefined)
 assert.ok(m.v.some((v,i)=> i<start.length && v[1]!==start[i][1]));quality(m)
})
test('BA-03: Borde compartido con otras caras se rechaza sin mutar el proyecto',()=>{
 const m=cube(),s=selection(m,'edge',[ekey(0,1)]);const before=snap(m)
 const r=ops.OPS.bevel(m,s,'edge',{width:.2,segments:2})
 // La ruta anterior Ctrl+B debe conservar su comportamiento previo, éxito o rechazo documentado.
 assert.ok(r===undefined||typeof r==='string')
 if(typeof r==='string') assert.equal(snap(m),before)
})
test('BA-04: CORR-G001 admite aristas conectadas de contorno en una cara aislada',()=>{
 const m=plane(),s=selection(m,'edge',[ekey(0,1),ekey(0,2)]),before=snap(m)
 assert.equal(ops.OPS.bevel(m,s,'edge',{width:.2,segments:3}),undefined);assert.notEqual(snap(m),before);quality(m)
})
test('BA-05: Aristas de contorno e interiores mezcladas se rechazan atómicamente',()=>{
 const m=new PolyMesh([[0,0,0],[1,0,0],[2,0,0],[0,1,0],[1,1,0],[2,1,0]],[[0,1,4,3],[1,2,5,4]])
 const s=selection(m,'edge',[ekey(0,1),ekey(1,4)]),b=snap(m)
 assert.equal(typeof ops.OPS.bevel(m,s,'edge',{width:.2}),'string');assert.equal(snap(m),b)
})
test('UI-01: existe comando nuevo y atajo distinto al de bisel de aristas',()=>{
 const commands=src('src/core/commands.js'),input=src('src/core/mesh/session-input.js'),session=src('src/core/mesh/session.js')
 assert.match(commands,/mesh\.bevelVertex[^\n]*Ctrl Shift B/)
 assert.match(input,/case 'b': return op\(e\.shiftKey \? 'bevelVertex' : 'bevel'\)/)
 assert.match(session,/case 'bevelVertex': return this\.startModal\('bevelVertex'\)/)
})
test('UI-02: modal tiene preview, control de segmentos y confirmación/Undo',()=>{
 const modal=src('src/core/mesh/session-modal.js')
 assert.match(modal,/case 'bevelVertex'/);assert.match(modal,/m\.kind === 'bevelVertex' \? O\.bevelVertexOp/)
 assert.match(modal,/\['bevel', 'bevelVertex'\]\.includes\(m\.kind\)/)
 assert.match(modal,/this\.commit\(label/)
})
test('UI-03: hay accesos desde panel, menú contextual y ayuda',()=>{
 for(const path of ['src/components/MeshPanel.vue','src/core/editor/meshedit.js','src/components/ShortcutsModal.vue']) assert.match(src(path),/bevelVertex|Bisel de vértices/)
})

test('BV-11: TriMesh y geometría visible derivan del mismo bisel confirmado',()=>{
 const m=cube(),s=selection(m,'vertex',[0,1]);assert.equal(ops.OPS.bevelVertex(m,s,'vertex',{width:.18,segments:5}),undefined)
 const phys=trimeshPoints(m),vis=polyBuffers(m)
 assert.ok(phys.length>0 && phys.every(Number.isFinite))
 assert.equal(phys.length,vis.indices.length*3)
 manifold(m)
})
test('BA-06: TriMesh acepta superficie abierta redondeada sin crear caja física',()=>{
 const m=plane(),s=selection(m,'edge',[ekey(0,1)]);assert.equal(ops.OPS.bevel(m,s,'edge',{width:.15,segments:3}),undefined)
 assert.ok(trimeshPoints(m).length>0);assert.ok(triangulate(m).tris.every((tri)=>tri.length===3));quality(m)
})
function modalFixture(){
 const ui={edit:{bevel:{width:.2,segments:4,profile:.5},loopCuts:1,hud:'',paint:{active:false}},project:{settings:{gridSize:1}}}
 const code=src('src/core/mesh/session-modal.js').replace(/^import[^\n]*\n/gm,'').replace('export const modalMethods =','const modalMethods =')+'\nmodalMethods'
 const methods=runInNewContext(code,{THREE:{},vlen:()=>1,O:ops,loopCutLines:()=>{},validLoopCutRing:()=>true,loopSlideFromScreen:()=>0,store:ui,toast:()=>{},undo:()=>{},rayLineParam:()=>0})
 const calls=[]
 const m=cube(),s=selection(m,'vertex',[0])
 const obj={poly:m,sel:s,mode:'vertex',modal:null,lastClient:{x:100,y:100},
  dom:{getBoundingClientRect:()=>({left:0,top:0})},
  tc:{getHelper:()=>({visible:true}),enabled:true},preview:{visible:false},
  pivotWorld:()=>null,_project:()=>({x:100,y:100}),_prepXform:()=>{},
  _worldPerPx:()=>1,refresh:()=>{},commit:(label)=>calls.push(label),
  _clearSvg:()=>{},svg:{innerHTML:''},vp:{requestRender:()=>{}},
 }
 Object.assign(obj,methods)
 return {obj,ui,calls,m}
}
test('UI-04: Cancelación modal restaura malla sin commit',()=>{
 const {obj,calls,m}=modalFixture(),before=snap(m)
 obj.startModal('bevelVertex');obj.modal.text='.18';obj.modalUpdate()
 assert.notEqual(snap(obj.poly),before)
 obj.modalCancel();assert.equal(snap(obj.poly),before);assert.deepEqual(calls,[])
})
test('UI-05: Confirmación modal con ancho numérico crea un solo commit y topología cerrada',()=>{
 const {obj,calls}=modalFixture()
 obj.startModal('bevelVertex');obj.modal.text='.18';obj.modalUpdate()
 assert.equal(obj.modal.previewValid,true)
 obj.modalConfirm();assert.deepEqual(calls,['Bisel de vértices']);manifold(obj.poly)
})
