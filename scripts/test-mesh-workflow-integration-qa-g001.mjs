// LF-MESH-WORKFLOW-INTEGRATION-QA-G001 — solo QA: encadena mecanismos reales de cuatro Gates.
// Harnesses del repositorio: ejecutan lógica real de Editor/PolyMesh con entorno Three/Vue simulado.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { make, fromPrimitive, fromCarved, MESH_KINDS } from '../src/engine/runtime/mesh/generators.js'
import { PolyMesh, checkClosed, signedVolume } from '../src/engine/runtime/mesh/polymesh.js'
import { Sel, normalize } from '../src/core/mesh/sel.js'
import { loopCut, loopCutLines, validLoopCutRing } from '../src/core/mesh/cuts.js'
import { loopCutOp } from '../src/core/mesh/ops.js'
import { polyBuffers, trimeshPoints } from '../src/engine/runtime/mesh/buffers.js'
import { validateNodeTree } from '../src/engine/runtime/nodes/hierarchy.js'
import { remapTriMeshSourceIds } from '../src/engine/runtime/physics/trimesh-source.js'
import { remapMeshSubtractSourceIds } from '../src/engine/runtime/mesh/mesh-subtract-source.js'
import { finiteTuple } from '../src/engine/runtime/numeric-integrity.js'
import { meshDataOf, linkMesh, unlinkMesh, writeMesh, meshConsumers } from '../src/engine/runtime/mesh/shared-mesh.js'
const read = p => readFileSync(new URL('../'+p, import.meta.url),'utf8')
const clone = x => JSON.parse(JSON.stringify(x))
const close = (a,b,e=1e-6) => assert.ok(Math.abs(a-b)<=e, `${a} ≠ ${b}`)

// Conservar las fixtures verificadas en los Gates previos; no crear un modelo falso de la aplicación.
function linkedHarness(){
  const s=read('scripts/test-mesh-linked-instance-g001.mjs')
  const source=s.slice(s.indexOf('const read ='),s.indexOf("test('LI-01")).replace(/^const read =[^\n]*\n/, '')
  return runInNewContext(source+'\n;({fixture,histFixture,mesh,polyFixture})',{
    read,readFileSync,runInNewContext,make,fromPrimitive,fromCarved,MESH_KINDS,PolyMesh,
    meshDataOf,linkMesh,unlinkMesh,writeMesh,meshConsumers,validateNodeTree,remapTriMeshSourceIds,remapMeshSubtractSourceIds,finiteTuple,JSON,Set,Map,Array,Object
  },{filename:'linked-fixture',timeout:5000})
}
function numericHarness(){
  const s=read('scripts/test-mesh-transform-numeric-g001.mjs')
  const source=s.slice(s.indexOf('const source ='),s.indexOf("test('NT-01")).replace(/^const source =[^\n]*\n/, '')
  return runInNewContext(source+'\n;({fixture})',{
    source:read,readFileSync,runInNewContext,make,PolyMesh,Sel,normalize,assert,JSON,Set,Map,Array,Object
  },{filename:'numeric-fixture',timeout:5000})
}
const { fixture: linkedFixture, histFixture, mesh: meshFixture, polyFixture }=linkedHarness()
const { fixture: numericFixture }=numericHarness()
function entry(){
 const f=linkedFixture();f.store.project.materials=[{id:'mat_1',name:'Default',color:'#ddd'}]
 const history=histFixture(f.store.project)
 history.hist.resetHistory()
 return {f,history}
}
function linkWithCut(cuts=2){
 const {f,history}=entry()
 const before=PolyMesh.fromJSON(meshDataOf(f.getObject('a'),f.store.project.meshes))
 before.ensureUV()
 // Preparar UV antes de cortar, igual que una malla que ya tiene mapeado UV.
 const baseWithUV=before.clone()
 assert.ok(writeMesh(f.store.project,f.getObject('a'),baseWithUV.toJSON()))
 const origVol=signedVolume(before)
 const ringKey=[...before.edges().keys()][0]
 assert.ok(validLoopCutRing(before,ringKey,cuts))
 const preview=loopCutLines(before,ringKey,cuts,.4)
 const S=new Sel()
 const operation=loopCutOp(before,S,'vertex',{key:ringKey,cuts,slide:.4})
 assert.equal(operation,undefined)
 before.reconcileAttributes(baseWithUV)
 assert.equal(checkClosed(before).length,0)
 close(signedVolume(before),origVol)
 assert.ok(writeMesh(f.store.project,f.getObject('a'),before.toJSON()))
 history.hist.commit('Loop Cut')
 const numerical=numericFixture({poly:PolyMesh.fromJSON(meshDataOf(f.getObject('a'),f.store.project.meshes)),mode:'vertex',indices:[[...S.v][0]]})
 return {f,history,S,preview,numerical,origVol}
}

test('WF-01 · cubo → Loop Cut → edición numérica exacta → guardar y cargar',()=>{
 const {f,history,numerical,preview}=linkWithCut(2)
 const {s,commits}=numerical
 assert.ok(preview.length>0)
 assert.equal(s.sel.v.size,1)
 const i=[...s.sel.v][0],x0=s.poly.v[i][0]
 assert.equal(s.numericTransform('position',0,x0+0.12345678),true)
 assert.equal(commits.length,0)
 assert.equal(s.numericCommit(),true)
 assert.equal(commits.length,1)
 assert.ok(writeMesh(f.store.project,f.getObject('a'),s.poly.toJSON()))
 history.hist.commit('Posición exacta')
 const reloaded=JSON.parse(JSON.stringify(f.store.project))
 const meshCopy=PolyMesh.fromJSON(meshDataOf(reloaded.objects[0],reloaded.meshes))
 close(meshCopy.v[i][0],s.poly.v[i][0],1e-8)
 assert.equal(meshCopy.uv.length,meshCopy.f.length)
 assert.equal(checkClosed(meshCopy).length,0)
})
test('WF-02 · Loop Cut + Alt+D + edición numérica propaga malla pero no transforms',()=>{
 const {f,history,numerical}=linkWithCut(3)
 const [b]=f.linkedDuplicateSelected()
 assert.ok(b)
 history.hist.commit('Alt+D')
 const snapA=clone(f.getObject('a').position),snapB=clone(b.position)
 const {s}=numerical,i=[...numerical.s.sel.v][0]
 s.numericTransform('position',2,s.poly.v[i][2]+.45321);s.numericCommit()
 assert.ok(writeMesh(f.store.project,f.getObject('a'),s.poly.toJSON()))
 history.hist.commit('Editar malla vinculada')
 const resource=f.store.project.meshes
 assert.equal(f.getObject('a').props.meshRef,b.props.meshRef)
 close(PolyMesh.fromJSON(meshDataOf(f.getObject('a'),resource)).v[i][2], PolyMesh.fromJSON(meshDataOf(b,resource)).v[i][2])
 assert.deepEqual(clone(f.getObject('a').position),snapA)
 assert.deepEqual(clone(b.position),snapB)
 b.position=[42,17,-6]
 assert.deepEqual(clone(f.getObject('a').position),snapA)
})
test('WF-03 · Alt+D → Ctrl+D: la copia no hereda el enlace y admite nueva operación de corte',()=>{
 const {f,history}=linkWithCut(1)
 const [linked]=f.linkedDuplicateSelected();history.hist.commit('Alt+D')
 f.duplicateSelected();history.hist.commit('Ctrl+D')
 const copy=f.store.project.objects.at(-1)
 assert.equal(copy.props.meshRef,undefined)
 const orig=clone(meshDataOf(linked,f.store.project.meshes))
 const edited=PolyMesh.fromJSON(copy.props.mesh)
 const key=[...edited.edges().keys()].find(k=>validLoopCutRing(edited,k,1))
 assert.ok(key,'malla copiada permite otro Loop Cut')
 const res=loopCut(edited,key,1,.2)
 assert.ok(res)
 edited.reconcileAttributes(PolyMesh.fromJSON(copy.props.mesh))
 assert.ok(writeMesh(f.store.project,copy,edited.toJSON()))
 history.hist.commit('Loop Cut copia')
 assert.deepEqual(clone(meshDataOf(linked,f.store.project.meshes)),orig)
 assert.equal(checkClosed(edited).length,0)
})
test('WF-04 · Alt+D → Ctrl+C/V: pegar crea malla independiente con geometría original',()=>{
 const {f}=linkWithCut(2)
 const [linked]=f.linkedDuplicateSelected()
 assert.equal(f.copySelected(),true)
 const target=[8,3,12]
 const [copy]=f.pasteSelected(target)
 assert.equal(copy.props.meshRef,undefined)
 const base=clone(meshDataOf(linked,f.store.project.meshes))
 assert.deepEqual(clone(copy.props.mesh),base)
 copy.props.mesh.v[0]+=2
 assert.notDeepEqual(clone(copy.props.mesh),meshDataOf(linked,f.store.project.meshes))
})
test('WF-05 · Alt+D → romper vínculo → cambiar malla: instancia permanece independiente',()=>{
 const {f}=linkWithCut(2)
 const [linked]=f.linkedDuplicateSelected()
 assert.equal(f.makeMeshIndependent(),true)
 assert.equal(linked.props.meshRef,undefined)
 const old=clone(linked.props.mesh)
 const data=clone(meshDataOf(f.getObject('a'),f.store.project.meshes))
 data.v[0]+=3
 assert.equal(writeMesh(f.store.project,f.getObject('a'),data),true)
 assert.deepEqual(clone(linked.props.mesh),old)
})
test('WF-06 · cambios encadenados mantienen Undo/Redo de malla y referencias',()=>{
 const {f,history,numerical}=linkWithCut(2)
 const baseline=clone(f.store.project)
 const [linked]=f.linkedDuplicateSelected()
 history.hist.commit('Alt+D')
 const s=numerical.s,i=[...s.sel.v][0]
 s.numericTransform('position',1,s.poly.v[i][1]+.234);s.numericCommit()
 writeMesh(f.store.project,f.getObject('a'),s.poly.toJSON())
 history.hist.commit('Editar vértices')
 const last=clone(f.store.project),resourceId=linked.props.meshRef
 history.hist.undo()
 assert.notDeepEqual(clone(f.store.project.meshes),last.meshes)
 history.hist.undo()
 assert.equal(f.store.project.objects.length,1)
 assert.deepEqual(clone(f.store.project.meshes),clone(baseline.meshes))
 history.hist.redo()
 assert.equal(f.store.project.objects.at(-1).props.meshRef,resourceId)
 history.hist.redo()
 assert.deepEqual(clone(f.store.project.meshes),last.meshes)
})
test('WF-07 · exportación de escena materializa geometría para proyectos sin registro',()=>{
 const {f}=linkWithCut(4)
 const [linked]=f.linkedDuplicateSelected()
 const src=read('src/core/levelpackage.js')
 const expr=src.match(/function payloadOf\([\s\S]*?\n}\n/)[0]
 const payload=runInNewContext(expr+'\n;payloadOf',{toPlain:clone,Error})
 const scene={objects:[clone(linked)]}
 const exported=payload({kind:'scene',id:'s'},new Map([['s',scene]]),{meshes:clone(f.store.project.meshes)})
 assert.equal(exported.objects[0].props.meshRef,undefined)
 assert.ok(PolyMesh.fromJSON(exported.objects[0].props.mesh).v.length>0)
 assert.equal(scene.objects[0].props.meshRef,linked.props.meshRef)
})
test('WF-08 · varias escenas consumen un recurso y sobreviven a eliminar origen',()=>{
 const {f}=linkWithCut(3)
 const [b]=f.linkedDuplicateSelected()
 f.removeObject('a')
 const saved=clone(f.store.project)
 assert.equal(saved.meshes.length,1)
 assert.ok(meshDataOf(saved.objects.find(o=>o.id===b.id),saved.meshes))
 assert.equal(meshConsumers(saved,b.props.meshRef).length,1)
})
test('WF-09 · render/collider usan datos finitos tras cortes y transformación',()=>{
 const {numerical}=linkWithCut(4)
 const s=numerical.s,i=[...s.sel.v][0]
 s.numericTransform('position',2,s.poly.v[i][2]+.125);s.numericCommit()
 const b=polyBuffers(s.poly),coll=trimeshPoints(s.poly)
 assert.ok(b.positions.every(Number.isFinite)&&b.normals.every(Number.isFinite))
 assert.ok(coll.every(Number.isFinite))
 assert.equal(b.indices.length,coll.length/3)
})
test('WF-10 · Edit Mode, clipboard y Alt+D conservan atajos separados',()=>{
 const keys=read('src/core/editor/keys.js'),input=read('src/core/mesh/session-input.js')
 assert.match(keys,/linkedDuplicateSelected/)
 assert.match(keys,/copySelected/)
 assert.match(keys,/pasteSelected/)
 assert.match(input,/case 'r': return op\('loopcut'\)/)
 assert.match(input,/case 'd': return op\('duplicate'\)/)
})
test('WF-11 · referencias compartidas entre escenas y materiales no alteran transforms independientes',()=>{
 const {f}=linkWithCut(2)
 const [b]=f.linkedDuplicateSelected()
 b.position=[9,1,-4];b.rotation=[0,45,0];b.scale=[2,1,3]
 b.materialId='mat-unique'
 const original=clone(f.getObject('a'))
 const project=clone({meshes:f.store.project.meshes,materials:f.store.project.materials,scenes:[{objects:[original]},{objects:[b]}]})
 const [first,second]=project.scenes.map(scene=>scene.objects[0])
 assert.equal(first.props.meshRef,second.props.meshRef)
 assert.ok(meshDataOf(first,project.meshes))
 assert.deepEqual(meshDataOf(first,project.meshes),meshDataOf(second,project.meshes))
 assert.notDeepEqual(first.position,second.position)
 assert.notDeepEqual(first.scale,second.scale)
 assert.notEqual(first.materialId,second.materialId)
})
test('WF-12 · transformar cara posterior al corte conserva topología y mapeado UV',()=>{
 const {f}=linkWithCut(4)
 const old=PolyMesh.fromJSON(meshDataOf(f.getObject('a'),f.store.project.meshes))
 const initialUV=clone(old.uv),initialFaces=clone(old.f)
 const n=numericFixture({poly:old,mode:'face',indices:[0]})
 assert.equal(n.s.numericTransform('move',1,.25),true)
 n.s.numericCommit()
 assert.deepEqual(old.f,initialFaces)
 assert.deepEqual(clone(old.uv),initialUV)
 assert.equal(checkClosed(old).length,0)
 assert.ok(writeMesh(f.store.project,f.getObject('a'),old.toJSON()))
})
test('WF-13 · colores y pesos continúan válidos al cortar y mover geometría vinculada',()=>{
 const {f}=entry()
 const obj=f.getObject('a')
 const mesh=PolyMesh.fromJSON(obj.props.mesh)
 mesh.ensureUV()
 mesh.colors=mesh.v.map((_,i)=>[i/8,.45,.75])
 mesh.weights=mesh.v.map(()=>[1,0,0,0,0,0,0,0])
 const before=mesh.clone(),key=[...mesh.edges().keys()][0]
 assert.ok(loopCut(mesh,key,3,.35));mesh.reconcileAttributes(before)
 assert.ok(writeMesh(f.store.project,obj,mesh.toJSON()))
 const [linked]=f.linkedDuplicateSelected()
 const reloaded=PolyMesh.fromJSON(meshDataOf(linked,f.store.project.meshes))
 assert.equal(reloaded.colors.length,reloaded.v.length)
 assert.equal(reloaded.weights.length,reloaded.v.length)
 assert.equal(reloaded.uv.length,reloaded.f.length)
 assert.ok(reloaded.colors.every(c=>c.every(Number.isFinite)))
 assert.ok(reloaded.weights.every(w=>w.every(Number.isFinite)))
})
test('WF-14 · portapapeles de instancia es una instantánea incluso si se elimina el origen',()=>{
 const {f}=linkWithCut(1)
 const [linked]=f.linkedDuplicateSelected()
 const expected=clone(meshDataOf(linked,f.store.project.meshes))
 assert.equal(f.copySelected(),true)
 f.removeObject('a')
 const [independent]=f.pasteSelected()
 assert.equal(independent.props.meshRef,undefined)
 assert.deepEqual(clone(independent.props.mesh),expected)
 assert.equal(meshConsumers(f.store.project,linked.props.meshRef).length,1)
})
test('WF-15 · Undo/Redo de desvinculación mantiene valores geométricos del recurso',()=>{
 const {f,history}=linkWithCut(2)
 const [linked]=f.linkedDuplicateSelected()
 history.hist.commit('Alt+D')
 const resource=f.store.project.meshes[0].mesh
 const linkId=linked.props.meshRef
 assert.equal(f.makeMeshIndependent(),true)
 history.hist.commit('Desvincular')
 assert.equal(f.store.project.objects.at(-1).props.meshRef,undefined)
 history.hist.undo()
 assert.equal(f.store.project.objects.at(-1).props.meshRef,linkId)
 history.hist.redo()
 assert.equal(f.store.project.objects.at(-1).props.meshRef,undefined)
 assert.deepEqual(clone(f.store.project.objects.at(-1).props.mesh),clone(resource))
})
test('WF-16 · datos heredados sin meshes mantienen Edit Mesh y Loop Cut',()=>{
 const legacy={objects:[meshFixture('legacy')],materials:[],scenes:[]}
 const restored=clone(legacy)
 assert.equal(Object.hasOwn(restored,'meshes'),false)
 const data=meshDataOf(restored.objects[0],restored.meshes)
 const poly=PolyMesh.fromJSON(data)
 assert.ok(loopCut(poly,[...poly.edges().keys()][0],1,.2))
 assert.ok(writeMesh(restored,restored.objects[0],poly.toJSON()))
 assert.equal(checkClosed(PolyMesh.fromJSON(restored.objects[0].props.mesh)).length,0)
})
