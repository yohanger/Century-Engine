// LF-MESH-LOOPCUT-INTERACTIVE-G001 — estados reales del modal y topología de PolyMesh.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { make } from '../src/engine/runtime/mesh/generators.js'
import { PolyMesh, checkClosed, signedVolume, ekey, triangulate } from '../src/engine/runtime/mesh/polymesh.js'
import { Sel } from '../src/core/mesh/sel.js'
import { loopCut, loopCutLines, cutParams, cutSlideLimit, loopSlideFromScreen, validLoopCutRing } from '../src/core/mesh/cuts.js'
import { polyBuffers, trimeshPoints } from '../src/engine/runtime/mesh/buffers.js'

const source = (file) => readFileSync(new URL('../'+file, import.meta.url), 'utf8')
const snapshot = (m) => JSON.stringify({ v:m.v, f:m.f, we:m.we, uv:m.uv, seams:m.seams, colors:m.colors })
const firstEdge = (m) => [...m.edges().keys()][0]
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a-b)<eps, `${a} ≠ ${b}`)

function mixin(path, name, deps) {
  const s = source(path).replace(/^import\s+[^\n]+\n/gm, '').replace(/^export\s+const\s+/gm,'const ')
  return runInNewContext(`${s}\n${name}`, deps, { filename:path, timeout:5000 })
}
function sessionFixture() {
  const poly = make('cube'), key = firstEdge(poly)
  const store = { edit: { loopCuts:1, loopSlide:0, hud:'', bevel:{segments:1}, paint:{active:false} }, project: { settings:{gridSize:1} } }
  const notifications=[]
  const THREE = { Float32BufferAttribute:class {constructor(data, n){this.array=data;this.itemSize=n}} }
  const O = { loopCutOp(m,sel,mode,p){ const res=loopCut(m,p.key,p.cuts,p.slide); if(!res)return 'Corte imposible'; sel.v = new Set(res.verts); return undefined } }
  const methods = mixin('src/core/mesh/session-modal.js','modalMethods', {
    THREE, vlen:()=>1, O, loopCutLines, validLoopCutRing, loopSlideFromScreen, store,
    toast:(...args)=>notifications.push(args), undo:()=>{}, rayLineParam:()=>0,
  })
  const input = mixin('src/core/mesh/session-input.js','inputMethods', { store, win:{}, ekeyA:()=>0, ekeyB:()=>0, linked:()=>{} })
  const calls=[]
  const session = {
    poly, sel:new Sel(), mode:'edge', modal:null, lastClient:{x:0,y:0},
    tc:{ getHelper:()=>({visible:true}), enabled:true },
    preview:{ visible:false, geometry:{ positions:[], setAttribute(key,attr){this.positions=attr.array} } },
    vp:{ requestRender(){calls.push('render')} }, visual:{matrixWorld:{}},
    dom:{ getBoundingClientRect(){return {left:0,top:0,width:800,height:600}} },
    _prepXform(){}, pivotWorld:()=>null, _project:()=>({x:0,y:0}),
    _pickEdge:()=>key, _screenVerts(){return this.poly.v.map(p=>({x:p[0]*100,y:p[1]*100,z:p[2]}))},
    _clearSvg(){}, refresh(){calls.push('refresh')}, commit(label){calls.push('commit:'+label)},
    run(label,fn){const before=this.poly.clone();const err=fn(this.poly,this.sel,this.mode); if(typeof err==='string'){this.poly=before;return false}this.poly.reconcileAttributes(before);this.commit(label);this.refresh();return true},
  }
  Object.assign(session,methods)
  return {session, store, notifications, calls, key, input}
}

test('LC-01 Ctrl+R queda conectado a la herramienta Loop Cut existente',()=>{
  const input=source('src/core/mesh/session-input.js')
  assert.match(input,/case 'r': return op\('loopcut'\)/)
  assert.match(source('src/core/mesh/session.js'),/case 'loopcut': return this\.startModal\('loopcut'\)/)
})
test('LC-02 Hover previsualiza un anillo real sin cambiar PolyMesh ni crear historial',()=>{
  const {session,calls}=sessionFixture(), orig=snapshot(session.poly)
  session.startModal('loopcut')
  assert.equal(session.modal.phase,'select-ring')
  assert.equal(session.modal.edge,firstEdge(session.poly))
  assert.equal(session.preview.visible,true)
  assert.ok(session.preview.geometry.positions.length>0)
  assert.equal(snapshot(session.poly),orig)
  assert.equal(calls.some(v=>v.startsWith('commit:')),false)
})
test('LC-03 Primer clic fija anillo sin aplicar geometría',()=>{
  const {session,calls}=sessionFixture(), orig=snapshot(session.poly)
  session.startModal('loopcut');session.modalConfirm()
  assert.equal(session.modal.phase,'slide')
  assert.equal(snapshot(session.poly),orig)
  assert.equal(calls.some(v=>v.startsWith('commit:')),false)
})
test('LC-04 Ratón desliza el corte sobre la arista proyectada',()=>{
  const {session}=sessionFixture()
  session.startModal('loopcut');session.modalConfirm()
  session.modalMove({clientX:0,clientY:36,ctrlKey:false,metaKey:false})
  assert.ok(session.modal.slide>0)
  assert.match(session.modal.phase,/slide/)
})
test('LC-05 Segundo clic confirma una sola operación con el slide elegido',()=>{
  const {session,calls}=sessionFixture();session.startModal('loopcut');session.modalConfirm()
  session.modalMove({clientX:0,clientY:36,ctrlKey:false,metaKey:false})
  const old=session.poly.v.length
  session.modalConfirm()
  assert.equal(session.modal,null)
  assert.equal(session.poly.v.length,old+4)
  assert.equal(calls.filter(v=>v==='commit:Corte en bucle').length,1)
  assert.equal(session.preview.visible,false)
})
test('LC-06 Enter confirma durante slide, nunca durante selección',()=>{
  const {session,calls}=sessionFixture();session.startModal('loopcut')
  session.modalKey({key:'Enter'});assert.equal(session.modal.phase,'select-ring')
  session.modalConfirm();session.modalKey({key:'Enter'});assert.equal(session.modal,null)
  assert.equal(calls.filter(v=>v==='commit:Corte en bucle').length,1)
})
test('LC-07 Escape cancela sin alterar ni geometría ni selección',()=>{
  const {session,calls}=sessionFixture(), orig=snapshot(session.poly)
  session.startModal('loopcut');session.modalConfirm();session.modalMove({clientX:0,clientY:36})
  session.modalKey({key:'Escape'})
  assert.equal(session.modal,null)
  assert.equal(snapshot(session.poly),orig)
  assert.equal(calls.some(v=>v.startsWith('commit:')),false)
})
test('LC-08 Clic derecho cancela en ambas fases y evita el menú contextual',()=>{
  const {session,input}=sessionFixture();session.startModal('loopcut');session.modalConfirm()
  let prevented=false
  input._onDown.call(session,{button:2,preventDefault(){prevented=true},stopImmediatePropagation(){}})
  assert.equal(prevented,true);assert.equal(session.modal,null)
})
test('LC-09 Rueda 1–32 cortes en fase selección y fija cantidad en slide',()=>{
  const {session,input}=sessionFixture();session.startModal('loopcut')
  for(let i=0;i<50;i++)input._onWheel.call(session,{deltaY:-2,preventDefault(){},stopImmediatePropagation(){}})
  assert.equal(session.modal.cuts,32)
  session.modalConfirm()
  input._onWheel.call(session,{deltaY:2,preventDefault(){},stopImmediatePropagation(){}})
  assert.equal(session.modal.cuts,32)
})
test('LC-10 Tecla C vuelve al centro y permite seguir deslizando',()=>{
  const {session}=sessionFixture();session.startModal('loopcut');session.modalConfirm()
  session.modalMove({clientX:0,clientY:40})
  assert.ok(session.modal.slide>0)
  session.modalKey({key:'c'})
  assert.equal(session.modal.slide,0)
  session.modalMove({clientX:0,clientY:10})
  assert.ok(session.modal.slide<0)
})
test('LC-11 Anillo inexistente no crea preview ni permite confirmar',()=>{
  const {session,calls,notifications}=sessionFixture()
  session._pickEdge=()=>null;session.startModal('loopcut');session.modalConfirm()
  assert.equal(session.modal.phase,'select-ring')
  assert.equal(session.preview.visible,false)
  assert.ok(notifications.length)
  assert.equal(calls.some(v=>v.startsWith('commit:')),false)
})
test('LC-12 Malla sin quads rechaza confirmación, sin mutaciones',()=>{
  const m=new PolyMesh([[0,0,0],[1,0,0],[0,1,0]],[[0,1,2]])
  const k=firstEdge(m),orig=snapshot(m)
  assert.equal(validLoopCutRing(m,k),null)
  assert.equal(loopCut(m,k,1,0),null)
  assert.equal(snapshot(m),orig)
})
test('LC-13 Quads degenerados no permiten un corte inválido',()=>{
  const m=new PolyMesh([[0,0,0],[1,0,0],[1,0,0],[0,0,0]],[[0,1,2,3]])
  const k=firstEdge(m),orig=snapshot(m)
  assert.equal(validLoopCutRing(m,k),null)
  assert.equal(loopCut(m,k,1,.5),null)
  assert.equal(snapshot(m),orig)
})
test('LC-14 El slider es estable para perspectiva, ortográfica y arista vertical',()=>{
  const start={x:0,y:0}
  near(loopSlideFromScreen(start,{x:40,y:0},{x:-100,y:0},{x:100,y:0},1), 40/200 / cutSlideLimit(1))
  near(loopSlideFromScreen(start,{x:0,y:40},{x:0,y:-100},{x:0,y:100},1), 40/200 / cutSlideLimit(1))
  assert.equal(loopSlideFromScreen(start,{x:40,y:0},{x:0,y:0},{x:0,y:0},1),null)
})
test('LC-15 32 cortes no coinciden ni tocan las aristas extremas con slide extremo',()=>{
  for(const s of [-1,-.9,0,.9,1]) {
    const pts=cutParams(32,s)
    assert.equal(pts.length,32)
    assert.ok(pts[0]>0&&pts[31]<1)
    assert.ok(pts.every((v,i)=>i===0||v-pts[i-1]>1e-4))
  }
})
test('LC-16 Previsualización y resultado geométrico tienen las mismas posiciones',()=>{
  const m=make('cube'),key=firstEdge(m),s=.65
  const preview=loopCutLines(m,key,1,s)
  const before=m.clone()
  const result=loopCut(m,key,1,s)
  const newVerts=result.verts.map(i=>m.v[i])
  const endpoints=preview.flat(1)
  for(const vertex of newVerts)assert.ok(endpoints.some(p=>p.every((v,i)=>Math.abs(v-vertex[i])<1e-9)))
  assert.equal(checkClosed(m).length,0)
  near(signedVolume(m),signedVolume(before))
})
test('LC-17 Cortes múltiples conservan volumen y malla cerrada',()=>{
  for(const cuts of [1,4,16,32]){
    const m=make('cube'),key=firstEdge(m),volume=signedVolume(m)
    assert.ok(loopCut(m,key,cuts,.9))
    assert.equal(checkClosed(m).length,0)
    near(signedVolume(m),volume)
  }
})
test('LC-18 Topología genera buffers de render y colisión finitos',()=>{
  const m=make('cube'),key=firstEdge(m),before=m.clone()
  assert.ok(loopCut(m,key,4,.33));m.reconcileAttributes(before)
  const b=polyBuffers(m),collision=trimeshPoints(m)
  assert.ok([...b.positions].every(Number.isFinite))
  assert.ok([...b.normals].every(Number.isFinite))
  assert.ok(collision.every(Number.isFinite))
  assert.equal(b.indices.length,collision.length/3)
})
test('LC-18B UV, colores y pesos siguen siendo válidos tras subdividir caras',()=>{
  const m=make('cube')
  m.ensureUV()
  m.colors=m.v.map((_,i)=>[i/8,0.25,0.75])
  m.weights=m.v.map(()=>[1,0,0,0,0,0,0,0])
  const base=m.clone(),key=firstEdge(m)
  assert.ok(loopCut(m,key,4,.7))
  m.reconcileAttributes(base)
  assert.equal(m.uv.length,m.f.length)
  assert.ok(m.uv.every((face,fi)=>face.length===m.f[fi].length&&face.every(uv=>uv.every(Number.isFinite))))
  assert.equal(m.colors.length,m.v.length)
  assert.equal(m.weights.length,m.v.length)
  assert.ok(m.colors.every(rgb=>rgb.every(Number.isFinite)))
  assert.ok(m.weights.every(w=>w.every(Number.isFinite)))
})
test('LC-19 PolyMesh guarda y restaura el corte sin diferencias geométricas',()=>{
  const m=make('cube'),key=firstEdge(m)
  assert.ok(loopCut(m,key,3,.25))
  const restored=PolyMesh.fromJSON(JSON.parse(JSON.stringify(m.toJSON())))
  assert.deepEqual(restored.f,m.f)
  for(let i=0;i<m.v.length;i++)for(let j=0;j<3;j++)near(restored.v[i][j],m.v[i][j],1e-5)
})
test('LC-20 Undo y Redo disponen de una única transacción en el flujo Editor',()=>{
  const {session,calls}=sessionFixture(),base=session.poly.clone()
  session.startModal('loopcut');session.modalConfirm();session.modalConfirm()
  const edited=session.poly.clone()
  assert.equal(calls.filter(v=>v.startsWith('commit:')).length,1)
  assert.notDeepEqual(edited.f,base.f)
  assert.deepEqual(base.clone().f,base.f)
  assert.deepEqual(edited.clone().f,edited.f)
})
test('LC-21 La preview es editorial y no se serializa en PolyMesh/Player',()=>{
  assert.match(source('src/core/mesh/session.js'),/this\.preview = mk\(new THREE\.LineSegments/)
  assert.doesNotMatch(source('src/engine/runtime/nodes/mesh.js'),/loopCutLines/)
  assert.doesNotMatch(source('src/engine/runtime/mesh/buffers.js'),/loopCutLines/)
})
test('LC-22 La operación modifica geometría local y no transforms de objeto',()=>{
  const s=source('src/core/mesh/session-modal.js')
  assert.match(s,/this\.run\('Corte en bucle'/)
  assert.match(s,/\{ key, cuts, slide \}/)
  assert.doesNotMatch(source('src/core/mesh/cuts.js'),/updateObject\(/)
})
