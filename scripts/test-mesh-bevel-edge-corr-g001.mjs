// LF-MESH-BEVEL-EDGE-CORR-G001: topología, Clamp Overlap y operación modal Ctrl+B.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { cube, plane } from '../src/engine/runtime/mesh/generators.js'
import { ekey, checkClosed, signedVolume, triangulate, PolyMesh } from '../src/engine/runtime/mesh/polymesh.js'
import { Sel, normalize } from '../src/core/mesh/sel.js'
import * as O from '../src/core/mesh/ops.js'

const selection = (mesh, pairs) => {
  const sel = new Sel()
  sel.e = new Set(pairs.map(([a, b]) => ekey(a, b)))
  return normalize(mesh, sel, 'edge')
}
const json = (m, s) => JSON.stringify({ mesh: m.toJSON(), select: s.toJSON() }).replace(/"rev":\d+/, '"rev":0')
const quality = (m) => {
  assert.ok(m.v.every((p) => p.length === 3 && p.every(Number.isFinite)))
  assert.ok(m.f.every((face) => face.length >= 3 && new Set(face).size === face.length))
  assert.ok(triangulate(m).tris.length > 0)
  assert.deepEqual(PolyMesh.fromJSON(m.toJSON()).f, m.f)
}
const op = (m, edges, width = .2, segments = 4, clampOverlap = true) => {
  const s = selection(m, edges)
  return { result: O.bevelOp(m, s, 'edge', { width, segments, profile: .5, clampOverlap }), sel: s }
}

test('BE-01: una arista de cubo tiene bandas, sigue manifold y conserva volumen', () => {
  const m = cube(), {result} = op(m, [[0,1]])
  assert.equal(result, undefined); assert.deepEqual(checkClosed(m), []); quality(m)
  assert.ok(signedVolume(m) > .8 && signedVolume(m) < 1)
})
test('BE-02: dos aristas que convergen forman esquina compartida y cerrada', () => {
  const m = cube(), {result} = op(m, [[0,1],[0,3]], .3, 6)
  assert.equal(result, undefined); assert.deepEqual(checkClosed(m), []); quality(m)
})
test('BE-03: tres aristas en un vértice forman tapón sin huecos', () => {
  const m = cube(), {result} = op(m, [[0,1],[0,3],[0,4]], .25, 5)
  assert.equal(result, undefined); assert.deepEqual(checkClosed(m), []); quality(m)
})
test('BE-04: anillo de cuatro aristas y todas las de la caja', () => {
  const all = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]
  for (const edges of [all.slice(0,4),all]) {
    const m = cube(), {result} = op(m, edges, .18, 5)
    assert.equal(result, undefined); assert.deepEqual(checkClosed(m), []); quality(m)
  }
})
test('BE-05: bordes consecutivos en plano comparten geometría y no crean juntas en T', () => {
  const m = plane(), {result,sel} = op(m, [[0,1],[0,2]], .2, 6)
  assert.equal(result, undefined); assert.equal(m.f.length, 13); quality(m)
  assert.equal(sel.e.size, 2)
  assert.ok([...m.edges().values()].every((e) => e.faces.length <= 2))
})
test('BE-06: tres y cuatro lados de una cara aislada conservan contorno abierto', () => {
  for (const edges of [[[0,1],[0,2],[1,3]],[[0,1],[0,2],[1,3],[2,3]]]) {
    const m = plane(), {result} = op(m, edges, .15, 4)
    assert.equal(result,undefined); quality(m)
    assert.ok(checkClosed(m).length > 0)
  }
})
test('BE-07: varios bordes separados en superficies aisladas', () => {
  const m = plane(), another = plane()
  const off = m.v.length
  m.v.push(...another.v.map((p) => [p[0]+5,p[1],p[2]]))
  m.f.push(...another.f.map((face) => face.map((v)=>v+off)))
  const {result}=op(m, [[0,1],[off,off+1]], .2, 3)
  assert.equal(result,undefined); quality(m)
})
test('BE-08: Clamp ON limita el ancho y evita superar la mitad de aristas cortas', () => {
  const m1 = cube(), m2 = cube()
  assert.equal(op(m1, [[0,1],[0,3]], .7).result, undefined)
  assert.equal(op(m2, [[0,1],[0,3]], .45).result, undefined)
  assert.deepEqual(m1.v,m2.v)
  assert.equal(O.bevelClampedWidth(cube(), [ekey(0,1)], 99),.45)
})
test('BE-09: Clamp OFF elimina límite conservador sin cambiar el perfil', () => {
  const on = cube(), off = cube()
  assert.equal(op(on, [[0,1],[0,3]], .7, 4, true).result, undefined)
  assert.equal(op(off, [[0,1],[0,3]], .7, 4, false).result, undefined)
  assert.notDeepEqual(on.v,off.v); assert.deepEqual(checkClosed(off), []); quality(off)
})
test('BE-10: rechazo atómico de caras mezcladas, aristas sueltas y no manifold', () => {
  for (const [m,edges] of [
    [new PolyMesh([[0,0,0],[1,0,0],[0,1,0]],[],[[0,1]]),[[0,1]]],
    [new PolyMesh([[0,0,0],[1,0,0],[0,1,0],[0,0,1],[0,-1,0]],[[0,1,2],[1,0,3],[0,1,4]]),[[0,1]]],
    [new PolyMesh([[0,0,0],[1,0,0],[2,0,0],[0,1,0],[1,1,0],[2,1,0]],[[0,1,4,3],[1,2,5,4]]),[[0,1],[1,4]]]
  ]) {
    const s=selection(m,edges),before=json(m,s)
    assert.equal(typeof O.bevelOp(m,s,'edge',{width:.2,segments:3}), 'string')
    assert.equal(json(m,s),before)
  }
})
test('BE-11: parámetros inválidos no modifican malla ni selección', () => {
  for (const p of [{width:NaN},{width:0},{width:-3},{width:Infinity},{width:.2,segments:0},{width:.2,segments:33},{width:.2,profile:2}]) {
    const m=cube(),s=selection(m,[[0,1]]),before=json(m,s)
    assert.equal(typeof O.bevelOp(m,s,'edge',p),'string');assert.equal(json(m,s),before)
  }
})
test('BE-12: borde de contorno demasiado ancho con Clamp OFF rechaza sin mutación', () => {
  const m=plane(),s=selection(m,[[0,1],[0,2]]),before=json(m,s)
  assert.equal(typeof O.bevelOp(m,s,'edge',{width:50,segments:4,clampOverlap:false}),'string')
  assert.equal(json(m,s),before)
})
test('BE-13: bisel guarda y carga su triangulación y UV reconciliadas', () => {
  const m=cube(),s=selection(m,[[0,1],[0,3]]),before=m.clone()
  before.ensureUV();m.ensureUV()
  assert.equal(O.bevelOp(m,s,'edge',{width:.2,segments:6}),undefined)
  m.reconcileAttributes(before)
  const recovered=PolyMesh.fromJSON(m.toJSON())
  assert.equal(recovered.uv.length,recovered.f.length);assert.deepEqual(checkClosed(recovered),[])
  assert.equal(triangulate(recovered).tris.length,triangulate(m).tris.length)
})
test('BE-14: el modal ofrece C, actualiza vista previa y muestra estado y ancho limitado', () => {
  const source=readFileSync(new URL('../src/core/mesh/session-modal.js',import.meta.url),'utf8')
  const methods=runInNewContext(source.replace(/^import[^\n]*\n/gm,'').replace('export const modalMethods =','const modalMethods =')+'\nmodalMethods',{
    THREE:{},vlen:()=>1,O,loopCutLines:()=>{},validLoopCutRing:()=>true,loopSlideFromScreen:()=>0,
    store:{edit:{bevel:{width:.2,segments:3,profile:.5},loopCuts:1,hud:''},project:{settings:{gridSize:1}}},
    toast:()=>{},undo:()=>{},rayLineParam:()=>0,
  })
  const m=cube(),s=selection(m,[[0,1],[0,3]]),logs=[]
  const obj={poly:m,sel:s,mode:'edge',modal:null,lastClient:{x:100,y:100},dom:{getBoundingClientRect:()=>({left:0,top:0})},
    tc:{getHelper:()=>({visible:true}),enabled:true},preview:{visible:false},pivotWorld:()=>null,
    _project:()=>({x:100,y:100}),_prepXform:()=>{},_worldPerPx:()=>1,
    refresh:()=>{},commit:(name)=>logs.push(name),_clearSvg:()=>{},svg:{innerHTML:''},vp:{requestRender:()=>{}}}
  Object.assign(obj,methods)
  obj.startModal('bevel');obj.modal.text='.7';obj.modalUpdate()
  const clamped=JSON.stringify(obj.poly.v)
  assert.ok(obj.modal.previewValid);assert.equal(obj.modal.clampOverlap,true)
  assert.equal(obj.modalKey({key:'c',shiftKey:false}),true)
  assert.equal(obj.modal.clampOverlap,false)
  assert.ok(obj.modal.previewValid)
  assert.notEqual(JSON.stringify(obj.poly.v),clamped)
  obj.modalKey({key:'C',shiftKey:true})
  assert.equal(obj.modal.clampOverlap,true)
  obj.modalCancel()
  assert.deepEqual(obj.poly.v,m.v);assert.deepEqual(logs,[])
})
test('BE-15: la ayuda visible documenta C sin desviar otros atajos',()=>{
 const help=readFileSync(new URL('../src/components/ShortcutsModal.vue',import.meta.url),'utf8')
 assert.match(help,/C = limitar solapes/)
 const input=readFileSync(new URL('../src/core/mesh/session-input.js',import.meta.url),'utf8')
 assert.match(input,/case 'b': return op\(e.shiftKey \? 'bevelVertex' : 'bevel'\)/)
})

// QA CORR-001 (mismo Gate): el remate de una arista del cubo no debe
// solaparse con la cara terminal ni conservar una esquina rectangular.
const outwardFaces = (m) => {
  for (let fi = 0; fi < m.f.length; fi++) {
    const f = m.f[fi], center = f.reduce((p, id) => p.map((v, k) => v + m.v[id][k] / f.length), [0, 0, 0])
    const n = m.faceNormal(fi)
    assert.ok(n.every(Number.isFinite) && n.some((v) => Math.abs(v) > 1e-8))
    assert.ok(n.reduce((v, x, k) => v + x * center[k], 0) > 1e-6,
      `Cara ${fi} invertida o superpuesta en una esquina del cubo`)
  }
}

test('BE-16: el remate superior e inferior del borde vertical integra la curva sin tapones superpuestos', () => {
  const m = cube(), {result} = op(m, [[2,6]], .25, 6)
  assert.equal(result, undefined)
  assert.deepEqual(checkClosed(m), [])
  assert.equal(m.f.length, 12) // 6 caras originales + 6 bandas; no dos tapas invertidas
  assert.equal(m.v.some(([x,y,z]) => x === .5 && y === .5 && Math.abs(z) === .5), false)
  outwardFaces(m); quality(m)
})

test('BE-17: los dos extremos libres de una esquina de aristas consecutivas no generan caras invertidas', () => {
  const m = cube(), {result} = op(m, [[2,6],[2,3]], .25, 6)
  assert.equal(result, undefined)
  assert.deepEqual(checkClosed(m), [])
  outwardFaces(m); quality(m)
})

test('BE-18: tres aristas y anillo superior conservan remates orientados y continuidad', () => {
  for (const pairs of [ [[2,6],[2,3],[1,2]], [[3,2],[2,6],[6,7],[7,3]] ]) {
    const m = cube(), {result} = op(m, pairs, .2, 6)
    assert.equal(result, undefined)
    assert.deepEqual(checkClosed(m), [])
    outwardFaces(m); quality(m)
  }
})
