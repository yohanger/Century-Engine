// LF-MESH-LINKED-INSTANCE-G001 — pruebas del registro real, duplicación, clipboard, Edit Mesh y persistencia.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { make, fromPrimitive, fromCarved, MESH_KINDS } from '../src/engine/runtime/mesh/generators.js'
import { PolyMesh } from '../src/engine/runtime/mesh/polymesh.js'
import { validateNodeTree } from '../src/engine/runtime/nodes/hierarchy.js'
import { remapTriMeshSourceIds } from '../src/engine/runtime/physics/trimesh-source.js'
import { remapMeshSubtractSourceIds } from '../src/engine/runtime/mesh/mesh-subtract-source.js'
import { finiteTuple } from '../src/engine/runtime/numeric-integrity.js'
import { meshDataOf, linkMesh, unlinkMesh, writeMesh, meshConsumers } from '../src/engine/runtime/mesh/shared-mesh.js'

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const clone = (v) => JSON.parse(JSON.stringify(v))
const pos = (a) => Array.from(a)
const mesh = (id, extra = {}) => ({ id, name:id, kind:'cube', type:'mesh', parentId:null, position:[0,0,0], rotation:[0,0,0],scale:[1,1,1], color:'#ffffff',materialId:'mat_1',props:{mesh:make('cube').toJSON()},...extra })
let next = 0
function fixture(objects=[mesh('a')], selected=['a']) {
  const logs=[]
  const store={project:{id:'proj1',objects:clone(objects),meshes:[],environment:{},terrain:{enabled:false,layers:[],foliage:[]},materials:[],profiles:[],gameManagers:[]},selectedIds:[...selected],selectedId:selected.at(-1),filmMode:false,play:{on:false}}
  const getObject=(id)=>store.project.objects.find(o=>o.id===id)||null
  const childrenOf=(id)=>store.project.objects.filter(o=>o.parentId===id)
  const descendantsOf=(id)=>{ const list=[]; const add=(id)=>{for(const child of childrenOf(id)){list.push(child);add(child.id)}};add(id);return list }
  const selectionRoots=()=>{const ids=new Set(store.selectedIds);return store.selectedIds.filter(id=>{let o=getObject(id);while(o?.parentId){if(ids.has(o.parentId))return false;o=getObject(o.parentId)}return true})}
  const editor={edit:null,duplicateWorldOffset:()=>[0,0,-2],syncObject(id){logs.push(['sync',id])},removeObject(id){logs.push(['remove',id])},syncAll(){logs.push(['syncAll'])},setSelection(id,ids){logs.push(['selection',id,[...ids]])},nodes:new Map(),_convertToMesh:null}
  store.editor=editor
  const msSource=read('src/core/editor/meshedit.js').replace(/^import[^\n]*\n/gm,'').replace(/^export\s+/gm,'')
  const ms=runInNewContext(msSource+'\n;mesheditMethods', {store,getObject,fromPrimitive,fromCarved,MESH_KINDS,toast:()=>{},polyOf:()=>null,THREE:{},writeMesh,meshConsumers})
  editor._convertToMesh=function(obj){return ms._convertToMesh.call(editor,obj)}
  const src=read('src/core/state/objects.js').replace(/^import[^\n]*\n/gm,'').replace(/^export\s+/gm,'')
  const ops=runInNewContext(src+'\n;({linkedDuplicateSelected,makeMeshIndependent,duplicateSelected,copySelected,pasteSelected,canPasteSelected,removeObject,updateObject})', {
    store,getObject,childrenOf,descendantsOf,selectionRoots,validateNodeTree,remapTriMeshSourceIds,remapMeshSubtractSourceIds,finiteTuple,uid:(prefix='n')=>prefix+(++next),linkMesh,unlinkMesh,meshDataOf,
    commit:(label)=>logs.push(['commit',label]),filmBlocked:()=>{},toast:(msg)=>logs.push(['toast',msg]),setLocalFromWorld:()=>{},worldMatrix:()=>({elements:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],toArray(){return [...this.elements]},fromArray(v){this.elements=[...v];return this}}),setTreeNodeOpen:()=>{},
  })
  return {store,logs,getObject,...ops,editor}
}
function polyFixture(o,resources) {
  const body = read('src/engine/runtime/nodes/mesh.js').slice(read('src/engine/runtime/nodes/mesh.js').indexOf('const cache = new Map()'),read('src/engine/runtime/nodes/mesh.js').indexOf('export function geometryOf'))
  const f=runInNewContext(body.replace(/^export /gm,'')+'\n;({polyOf,clearPolyCache})',{PolyMesh,meshDataOf,PBR_ENV:{meshes:resources},Map})
  return f.polyOf(o)
}
function histFixture(project){
 const editor={ snapshotTerrain:()=>({layers:[],foliage:[]}),restoreTerrain(){},syncAll(){},syncEnvironment(){},setSelection(){},applyView(){},restoreEdit(){},afterUndo(){} }
 const store={project,editor,selectedIds:[],selectedId:null,disk:{state:'saved'},saveState:'saved'}
 const body=read('src/core/state/history.js').replace(/^import[^\n]*\n/gm,'').replace(/^export\s+/gm,'')
 const hist=runInNewContext(body+'\n;({resetHistory,commit,undo,redo})',{store,toRaw:v=>v,debounce:()=>()=>{},JSON,Set,Object})
 return {store,hist}
}

test('LI-01 recurso único para primer Alt+D y dos objetos vinculados',()=>{
 const f=fixture(),res=f.linkedDuplicateSelected();assert.equal(res.length,1)
 assert.equal(f.store.project.meshes.length,1)
 assert.equal(f.getObject('a').props.meshRef,res[0].props.meshRef)
 assert.equal(f.getObject('a').props.mesh,undefined)
 assert.equal(res[0].props.mesh,undefined)
 assert.notEqual(res[0].id,'a')
})
test('LI-02 Alt+D repetido reutiliza el recurso, no crea geometrías duplicadas',()=>{
 const f=fixture();f.linkedDuplicateSelected();const res=f.linkedDuplicateSelected()
 assert.equal(f.store.project.meshes.length,1)
 assert.equal(res[0].props.meshRef,f.getObject('a').props.meshRef)
})
test('LI-03 cada instancia mantiene posición, rotación, escala y material propios',()=>{
 const f=fixture();const b=f.linkedDuplicateSelected()[0]
 f.getObject('a').rotation=[5,6,7];f.getObject('a').scale=[2,3,4];f.getObject('a').materialId='mt-a'
 assert.deepEqual(pos(b.rotation),[0,0,0]);assert.deepEqual(pos(b.scale),[1,1,1]);assert.equal(b.materialId,'mat_1')
 assert.deepEqual(pos(b.position),[0,0,-2])
})
test('LI-04 escribir geometría desde una instancia actualiza a los demás consumidores',()=>{
 const f=fixture();const b=f.linkedDuplicateSelected()[0],old=meshDataOf(b,f.store.project.meshes)
 const edited=clone(old);edited.v[0]=3.333
 assert.ok(writeMesh(f.store.project,b,edited))
 assert.equal(meshDataOf(b,f.store.project.meshes).v[0],3.333)
 assert.equal(meshDataOf(f.getObject('a'),f.store.project.meshes).v[0],3.333)
 assert.equal(meshConsumers(f.store.project,b.props.meshRef).length,2)
})
test('LI-05 caché PolyMesh invalida geometría al reemplazar recurso compartido',()=>{
 const f=fixture();const b=f.linkedDuplicateSelected()[0]
 const before=polyFixture(b,f.store.project.meshes),snap=clone(meshDataOf(b,f.store.project.meshes))
 snap.v[0]=3.375;snap.rev++
 writeMesh(f.store.project,f.getObject('a'),snap)
 const after=polyFixture(b,f.store.project.meshes)
 assert.notEqual(after.v[0][0],before.v[0][0])
})
test('LI-06 Ctrl+D sobre linked crea PolyMesh independiente y mantiene el original',()=>{
 const f=fixture();f.linkedDuplicateSelected();const copy=f.duplicateSelected();void copy
 const b=f.store.project.objects.at(-1)
 assert.equal(b.props.meshRef,undefined)
 assert.deepEqual(b.props.mesh.v,meshDataOf(f.getObject('a'),f.store.project.meshes).v)
 b.props.mesh.v[0]=999;assert.notEqual(meshDataOf(f.getObject('a'),f.store.project.meshes).v[0],999)
})
test('LI-07 Ctrl+C extrae una instantánea independiente de una malla vinculada',()=>{
 const f=fixture();f.linkedDuplicateSelected();assert.equal(f.copySelected(),true)
 // El proyecto se modifica después de copiar: la copia mantiene su geometría.
 const res=f.store.project.meshes[0];const previous=res.mesh.v[0];res.mesh.v[0]=99
 const b=f.pasteSelected()[0]
 assert.equal(b.props.meshRef,undefined);assert.equal(b.props.mesh.v[0],previous)
})
test('LI-08 Hacer independiente conserva geometría y elimina solo una referencia',()=>{
 const f=fixture();const b=f.linkedDuplicateSelected()[0],data=clone(meshDataOf(b,f.store.project.meshes))
 assert.equal(f.makeMeshIndependent(),true)
 assert.equal(b.props.meshRef,undefined)
 assert.deepEqual(b.props.mesh,data)
 const newData=clone(data);newData.v[0]=3
 writeMesh(f.store.project,f.getObject('a'),newData)
 assert.notEqual(b.props.mesh.v[0],3)
})
test('LI-09 eliminar el origen no destruye el recurso de sus instancias',()=>{
 const f=fixture();const b=f.linkedDuplicateSelected()[0];f.removeObject('a')
 assert.ok(meshDataOf(b,f.store.project.meshes))
 assert.equal(f.store.project.meshes.length,1)
})
test('LI-10 las mallas originales sin vincular siguen funcionando sin campo meshes',()=>{
 const o=mesh('legacy');assert.deepEqual(meshDataOf(o,undefined),o.props.mesh)
 const p={objects:[o]};assert.equal(linkMesh(p,o,'res-1')?.id,'res-1')
 assert.equal(unlinkMesh(p,o),true)
})
test('LI-11 rechaza vínculo a recurso inexistente y evita cambios destructivos',()=>{
 const f=fixture([mesh('a',{props:{meshRef:'missing'}})])
 assert.equal(f.linkedDuplicateSelected(),false)
 assert.equal(f.store.project.objects.length,1)
 assert.equal(f.store.project.meshes.length,0)
})
test('LI-12 no se ejecuta Alt+D en Play/Edit/Film ni sin selección',()=>{
 const f=fixture();f.store.editor.edit={};assert.equal(f.linkedDuplicateSelected(),false)
 f.store.editor.edit=null;f.store.play.on=true;assert.equal(f.linkedDuplicateSelected(),false)
 f.store.play.on=false;f.store.filmMode=true;assert.equal(f.linkedDuplicateSelected(),false)
 f.store.filmMode=false;f.store.selectedIds=[];assert.equal(f.linkedDuplicateSelected(),false)
})
test('LI-13 crea la geometría vinculada a partir de una primitiva mediante conversión real',()=>{
 const o=mesh('prim',{type:'primitive',kind:'box',props:{},scale:[1,1,1]})
 const f=fixture([o],['prim']);const res=f.linkedDuplicateSelected();assert.equal(res.length,1)
 assert.equal(f.getObject('prim').type,'mesh');assert.equal(res[0].type,'mesh')
 assert.ok(meshDataOf(res[0],f.store.project.meshes).v.length>0)
 assert.equal(f.getObject('prim').props.meshRef,res[0].props.meshRef)
})
test('LI-14 Ctrl+D después de convertir una primitiva sigue siendo independiente',()=>{
 const f=fixture([mesh('p',{type:'primitive',kind:'box',props:{}})],['p']);f.linkedDuplicateSelected();f.duplicateSelected()
 assert.equal(f.store.project.objects.at(-1).props.meshRef,undefined)
})
test('LI-15 grupo vinculado replica hijos sin compartir las transformaciones',()=>{
 const group=mesh('g',{type:'group',props:{},position:[2,0,0]});const child=mesh('child',{parentId:'g',position:[3,0,0]})
 const f=fixture([group,child],['g']);const [newRoot]=f.linkedDuplicateSelected()
 const newChild=f.store.project.objects.find(o=>o.parentId===newRoot.id)
 assert.ok(newChild);assert.equal(newChild.props.meshRef,f.getObject('child').props.meshRef)
 assert.deepEqual(pos(newChild.position),[3,0,0]);assert.deepEqual(pos(newRoot.position),[2,0,-2])
})
test('LI-16 undo/redo restaura juntos objetos, geometría y referencias',()=>{
 const f=fixture(),h=histFixture(f.store.project);h.hist.resetHistory();f.linkedDuplicateSelected();h.hist.commit('Alt D')
 const b=f.store.project.objects.at(-1),id=b.props.meshRef
 const data=clone(meshDataOf(b,f.store.project.meshes));data.v[0]=4
 writeMesh(f.store.project,b,data);h.hist.commit('Editar vertice')
 h.hist.undo();assert.notEqual(meshDataOf(f.store.project.objects.at(-1),f.store.project.meshes).v[0],4)
 h.hist.undo();assert.equal(f.store.project.objects.length,1);assert.equal(f.store.project.meshes.length,0)
 h.hist.redo();assert.equal(f.store.project.objects.at(-1).props.meshRef,id)
 h.hist.redo();assert.equal(meshDataOf(f.store.project.objects.at(-1),f.store.project.meshes).v[0],4)
})
test('LI-17 guardar y reabrir conserva vínculo entre escenas mediante datos globales',()=>{
 const f=fixture();const b=f.linkedDuplicateSelected()[0]
 const meta=clone({meshes:f.store.project.meshes});const scene1=clone([f.getObject('a')]),scene2=clone([b])
 assert.deepEqual(meshDataOf(scene1[0],meta.meshes).v,meshDataOf(scene2[0],meta.meshes).v)
 assert.notEqual(scene1[0].id,scene2[0].id)
})
test('LI-18 reusar el recurso no duplica los vértices serializados en cada objeto',()=>{
 const f=fixture();f.linkedDuplicateSelected()
 assert.equal(f.store.project.objects.filter(o=>o.type==='mesh').every(o=>!o.props.mesh),true)
 assert.equal(f.store.project.meshes.length,1)
})
test('LI-19 una sola entrada de Undo por cada Alt+D, Ctrl+D o hacer independiente',()=>{
 const f=fixture();f.linkedDuplicateSelected()
 assert.equal(f.logs.filter(x=>x[0]==='commit').length,1)
 f.duplicateSelected();assert.equal(f.logs.filter(x=>x[0]==='commit').length,2)
 f.store.selectedIds=[f.getObject('a').id];f.store.selectedId='a';f.makeMeshIndependent()
 assert.equal(f.logs.filter(x=>x[0]==='commit').length,3)
})
test('LI-20 la geometría del recurso conserva UV, color y pesos sin alterar al clonar',()=>{
 const o=mesh('a');o.props.mesh.uv=[ [[0,0],[1,0],[1,1],[0,1]] ]
 const f=fixture([o]);f.linkedDuplicateSelected();const b=f.store.project.objects.at(-1)
 assert.deepEqual(meshDataOf(b,f.store.project.meshes).uv,o.props.mesh?.uv ?? f.store.project.meshes[0].mesh.uv)
})
test('LI-21 el atajo Alt+D se encuentra fuera del modo Edit Mesh, sin pisar Shift+D',()=>{
 const keys=read('src/core/editor/keys.js'),input=read('src/core/mesh/session-input.js')
 assert.match(keys,/e\.altKey && k === 'd'.*linkedDuplicateSelected\(\)/)
 assert.match(keys,/this\.edit && !mod && e\.altKey && k === 'd'/)
 assert.match(input,/case 'd': return op\('duplicate'\)/)
})
test('LI-22 menús y botones incluyen operación vinculada e independiente',()=>{
 const s=read('src/core/commands.js'),panel=read('src/components/Inspector.vue')
 assert.match(s,/edit\.linkedDuplicate/);assert.match(s,/edit\.makeMeshIndependent/)
 assert.match(panel,/makeMeshIndependent\(\)/);assert.match(panel,/linkedDuplicateSelected\(\)/)
})
test('LI-23 renderizado conoce la fuente compartida y sus revisiones',()=>{
 const s=read('src/engine/runtime/nodes/mesh.js'),g=read('src/engine/runtime/scene-graph.js')
 assert.match(s,/meshDataOf\(obj, PBR_ENV\.meshes\)/)
 assert.match(s,/root\.userData\.sourceId !== sourceId/)
 assert.match(g,/get meshes\(\)/)
})
test('LI-24 runtime exportado incluye registro compartido en su manifest',()=>{
 const s=read('src/engine/runtime/package/format.js'),p=read('src/core/project.js')
 assert.match(s,/if \(!EDITOR_ONLY\.includes\(k\)\) game\[k\] = data\[k\]/)
 assert.match(p,/meshes: \[\]/)
 assert.match(p,/meta\.meshes = Array\.isArray\(meta\.meshes\)/)
})
test('LI-25 .levelpackage extrae geometría independiente para importar entre proyectos',()=>{
 const src=read('src/core/levelpackage.js'),expr=src.match(/function payloadOf\([\s\S]*?\n}\n/)[0]
 const payload=runInNewContext(expr+'\n;payloadOf',{toPlain:clone,Error})
 const f=fixture();const b=f.linkedDuplicateSelected()[0]
 const scene={objects:[clone(b)]},meta={meshes:clone(f.store.project.meshes)}
 const exported=payload({kind:'scene',id:'s'},new Map([['s',scene]]),meta)
 assert.equal(exported.objects[0].props.meshRef,undefined)
 assert.deepEqual(exported.objects[0].props.mesh,meta.meshes[0].mesh)
 assert.equal(scene.objects[0].props.meshRef,b.props.meshRef)
})
test('LI-26 .levelpackage rechaza referencias faltantes sin inventar datos',()=>{
 const src=read('src/core/levelpackage.js'),expr=src.match(/function payloadOf\([\s\S]*?\n}\n/)[0]
 const payload=runInNewContext(expr+'\n;payloadOf',{toPlain:clone,Error})
 assert.throws(()=>payload({kind:'scene',id:'s'},new Map([['s',{objects:[mesh('x',{props:{meshRef:'missing'}})]}]]),{meshes:[]}))
})
test('LI-27 no puede convertir con error de geometría antigua a vínculo inconsistente',()=>{
 const f=fixture([mesh('bad',{type:'mesh',props:{meshRef:'missing'}})])
 assert.equal(f.linkedDuplicateSelected(),false)
 assert.deepEqual(f.store.project.meshes,[])
})
test('LI-28 la duplicación vinculada no toca recursos externos ni materiales',()=>{
 const f=fixture([mesh('a',{materialId:'material-blue',props:{mesh:make('cube').toJSON(),image:'asset1'}})])
 const b=f.linkedDuplicateSelected()[0]
 assert.equal(b.materialId,'material-blue');assert.equal(b.props.image,'asset1')
})

test('LI-29 fallo de conversión restaura geometría, objetos e historial sin residuos',()=>{
 const prim=mesh('p',{type:'primitive',kind:'box',props:{}}),plain=mesh('a')
 const f=fixture([plain,prim],['a','p']),before=clone(f.store.project.objects)
 f.editor._convertToMesh=()=>{throw Error('malla inválida')}
 assert.equal(f.linkedDuplicateSelected(),false)
 assert.deepEqual(clone(f.store.project.objects),before)
 assert.equal(f.store.project.meshes.length,0)
 assert.equal(f.logs.filter(x=>x[0]==='commit').length,0)
})
