// LF-SCENE-CLIPBOARD-G001 — código real de la selección, duplicación y portapapeles bajo dependencias editoriales simuladas.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { isTriMeshSource, remapTriMeshSourceIds } from '../src/engine/runtime/physics/trimesh-source.js'
const read = (path) => readFileSync(new URL('../'+path, import.meta.url), 'utf8')
const stateSource=read('src/core/state/objects.js')
const keysSource=read('src/core/editor/keys.js')
const commandsSource=read('src/core/commands.js')
const placementSource=read('src/core/editor/placement.js')
const original=(id,name,position=[0,0,0],parentId=null,extra={})=>({id,name,type:'mesh',kind:'cube',position,rotation:[0,0,0],scale:[1,1,1],parentId,props:{mesh:{v:[[1,2,3]],f:[]}},...extra})
const norm=(a)=>JSON.parse(JSON.stringify(a))
let serial=0
function fakeMatrix(a){
 const items=a||[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
 return {elements:[...items],determinant(){return 1},invert(){return fakeMatrix()},toArray(){return [...this.elements]},fromArray(v){this.elements=[...v];return this}}
}
function fixture(objects=[original('a','Cubo')],selected=['a']){
 const log=[]
 const store={project:{id:'p1',objects:norm(objects)},selectedIds:[...selected],selectedId:selected.at(-1),filmMode:false,
   editor:{syncAll(){log.push('syncAll')},setSelection(id,ids){log.push(['selection',id,[...ids]])},edit:null}}
 const getObject=(id)=>store.project.objects.find(o=>o.id===id)||null
 const childrenOf=(id)=>store.project.objects.filter(o=>o.parentId===id)
 const descendantsOf=(id)=>{const out=[];const visit=(id)=>{for(const c of childrenOf(id)){out.push(c);visit(c.id)}};visit(id);return out}
 const selectionRoots=()=>{const sel=new Set(store.selectedIds);return store.selectedIds.filter(id=>{let cur=getObject(id);while(cur?.parentId){if(sel.has(cur.parentId))return false;cur=getObject(cur.parentId)}return true})}
 const worldMatrix=(id)=>{let p=getObject(id),xyz=[0,0,0];while(p){p.position.forEach((v,i)=>xyz[i]+=v);p=getObject(p.parentId)}const m=fakeMatrix();m.elements[12]=xyz[0];m.elements[13]=xyz[1];m.elements[14]=xyz[2];return m}
 const setLocalFromWorld=(obj,parentId,world)=>{const par=worldMatrix(parentId);obj.position=[12,13,14].map(i=>world.elements[i]-par.elements[i]);obj.rotation=[0,0,0]}
 const uniqBody=stateSource.match(/export function uniqueName\([\s\S]*?\n}\n/)[0].replace('export ','')
 const segment=stateSource.slice(stateSource.indexOf('/** Guarda instantáneas independientes'),stateSource.indexOf('/**\n * Selección. additive'))
   .replace(/^export /gm,'')
 const translation=stateSource.slice(stateSource.indexOf('function translatedLocalPosition('),stateSource.indexOf('export function duplicateSelected()'))
 const body=uniqBody+translation+'\nlet sceneClipboard = null;\n'+segment+'\n;({copySelected,canPasteSelected,pasteSelected})'
 const out=vm.runInNewContext(body,{store,getObject,childrenOf,descendantsOf,selectionRoots,worldMatrix,setLocalFromWorld,setTreeNodeOpen:()=>{},uid:()=>`cp${++serial}`,commit:(label)=>log.push(['commit',label]),filmBlocked:()=>{},isTriMeshSource,remapTriMeshSourceIds,toast:(message)=>log.push(['toast',message]),Map,Set,Number,Array})
 return {...out,store,log,getObject}
}
test('SC-01 · Ctrl+C crea instantánea sin modificar escena ni Undo',()=>{
 const f=fixture();assert.equal(f.copySelected(),true);assert.equal(f.store.project.objects.length,1);assert.deepEqual(f.log,[])
})
test('SC-02 · Ctrl+V crea nuevos IDs, misma geometría pero objetos independientes',()=>{
 const f=fixture();f.copySelected();const made=f.pasteSelected([3,4,-6]);assert.equal(made.length,1)
 assert.notEqual(made[0].id,'a');assert.deepEqual(norm(made[0].props.mesh),norm(f.getObject('a').props.mesh));assert.notStrictEqual(made[0].props.mesh,f.getObject('a').props.mesh)
 made[0].props.mesh.v[0][0]=42;assert.equal(f.getObject('a').props.mesh.v[0][0],1)
 assert.deepEqual(norm(made[0].position),[3,4,-6]);assert.equal(f.log.filter(i=>Array.isArray(i)&&i[0]==='commit').length,1)
})
test('SC-03 · pegar varias raíces conserva offsets mundiales',()=>{
 const f=fixture([original('a','A',[2,0,0]),original('b','B',[5,2,0])],['a','b']);f.copySelected();const made=f.pasteSelected([0,0,-6]);assert.equal(made.length,2)
 assert.deepEqual(norm(made.map(m=>m.position)),[[-1.5,-1,-6],[1.5,1,-6]])
 assert.equal(f.log.filter(i=>Array.isArray(i)&&i[0]==='commit').length,1)
})
test('SC-04 · subárbol conserva jerarquía y transformaciones locales de hijos',()=>{
 const f=fixture([original('a','Grupo',[5,0,0],null,{type:'group'}),original('b','Cubo',[1,0,0],'a')],['a','b'])
 f.copySelected();const made=f.pasteSelected([0,0,-6]);assert.equal(made.length,2)
 const root=made.find(m=>m.type==='group'),child=made.find(m=>m.type==='mesh');assert.equal(child.parentId,root.id)
 assert.deepEqual(norm(child.position),[1,0,0]);assert.deepEqual(norm(root.position),[0,0,-6]);assert.equal(f.store.selectedIds.length,1)
})
test('SC-05 · los padres externos existentes se conservan con posición local correcta',()=>{
 const f=fixture([original('parent','Padre',[10,0,0],null,{type:'group'}),original('a','Hijo',[2,0,0],'parent')],['a'])
 f.copySelected();const made=f.pasteSelected([3,0,-6]);assert.equal(made[0].parentId,'parent');assert.deepEqual(norm(made[0].position),[-7,0,-6]);
})
test('SC-06 · padres externos eliminados no dejan IDs huérfanos',()=>{
 const f=fixture([original('parent','Padre',[10,0,0],null,{type:'group'}),original('a','Hijo',[2,0,0],'parent')],['a']);f.copySelected()
 f.store.project.objects=f.store.project.objects.filter(o=>o.id!=='parent');const made=f.pasteSelected([4,0,-6]);assert.equal(made[0].parentId,null)
 assert.deepEqual(norm(made[0].position),[4,0,-6])
})
test('SC-07 · un padre dentro de prefab no absorbe la copia',()=>{
 const f=fixture([original('parent','Prefab',[10,0,0],null,{type:'group',prefabId:'pf1'}),original('a','Hijo',[2,0,0],'parent')],['a']);f.copySelected()
 const made=f.pasteSelected([4,0,-6]);assert.equal(made[0].parentId,null)
})
test('SC-08 · decal dirigido a nodo copiado reescribe la referencia interna',()=>{
 const f=fixture([original('a','A'),original('d','Decal',[1,0,0],null,{type:'decal',props:{targetId:'a',textureId:'tex-9'}})],['a','d']);f.copySelected()
 const made=f.pasteSelected([3,0,-6]),a=made.find(o=>o.name==='A 2'),d=made.find(o=>o.type==='decal')
 assert.equal(d.props.targetId,a.id);assert.equal(d.props.textureId,'tex-9')
})
test('SC-09 · materiales/modelos/assets preservan IDs como recursos, sin crear datos enlazados de malla',()=>{
 const f=fixture([original('a','A',[0,0,0],null,{materialId:'mat-1',modelId:'model-1',props:{mesh:{v:[[1,2,3]],f:[]},image:'tex-2'}})],['a']);f.copySelected()
 const m=f.pasteSelected([0,0,-6])[0];assert.equal(m.materialId,'mat-1');assert.equal(m.modelId,'model-1');assert.equal(m.props.image,'tex-2')
})
test('SC-10 · clipboard es una instantánea y no sigue posteriores cambios en el origen',()=>{
 const f=fixture();f.copySelected();f.getObject('a').props.mesh.v[0][0]=77
 const copy=f.pasteSelected([1,0,-6])[0];assert.equal(copy.props.mesh.v[0][0],1)
})
test('SC-11 · pegar repetidamente genera distintos IDs y nombre único',()=>{
 const f=fixture();f.copySelected();const a=f.pasteSelected([0,0,-6])[0];const b=f.pasteSelected([1,0,-6])[0];assert.notEqual(a.id,b.id);assert.notEqual(a.name,b.name)
})
test('SC-12 · no permite pegar en otro proyecto (referencias a recursos)',()=>{
 const f=fixture();f.copySelected();f.store.project={id:'p2',objects:[]};assert.equal(f.canPasteSelected(),false);assert.equal(f.pasteSelected([0,0,0]),false)
})
test('SC-13 · bloquea operaciones en Play/Film/Edit Mesh',()=>{
 const f=fixture();f.copySelected();f.store.editor.edit={};assert.equal(f.canPasteSelected(),false);assert.equal(f.pasteSelected([0,0,0]),false)
 f.store.editor.edit=null;f.store.filmMode=true;assert.equal(f.canPasteSelected(),false)
})
test('SC-14 · sin selección Copy no sobrescribe el clipboard previo',()=>{
 const f=fixture();f.copySelected();f.store.selectedIds=[];assert.equal(f.copySelected(),false);assert.equal(f.canPasteSelected(),true)
})
test('SC-15 · Ctrl+C/V están conectados y respetan campos editables',()=>{
 assert.match(keysSource,/t\.tagName === 'INPUT'/);assert.match(keysSource,/t\.isContentEditable/)
 assert.match(keysSource,/k === 'c'.*copySelected\(\)/);assert.match(keysSource,/k === 'v'.*pasteSelected\(this\.clipboardPlacePoint\(\)\)/)
 assert.match(keysSource,/this\.edit && mod && \(k === 'c' \|\| k === 'v'\)/)
})
test('SC-16 · Ctrl+D sigue duplicando y Edit Mesh conserva Shift+D',()=>{
 assert.match(keysSource,/k === 'd'.*duplicateSelected\(\)/)
 assert.match(read('src/core/mesh/session-input.js'),/case 'd': return op\('duplicate'\)/)
})
test('SC-17 · menús y paleta comparten el mismo Copy/Paste, sin ramas paralelas',()=>{
 assert.match(commandsSource,/add\('edit\.copy'/);assert.match(commandsSource,/add\('edit\.paste'/)
 assert.match(commandsSource,/'edit\.copy', 'edit\.paste', 'edit\.duplicate'/)
 assert.match(commandsSource,/label: 'Pegar delante de la cámara'/)
})
test('SC-18 · colocar frente a la cámara no depende del FOV ni cursor ni seleccionados',()=>{
 assert.match(placementSource,/clipboardPlacePoint\(\)/);assert.match(placementSource,/cam\.getWorldDirection/)
 assert.match(placementSource,/duplicateWorldOffset\(\)/);assert.match(placementSource,/setFromCamera\(new THREE\.Vector2\(0, 0\), cam\)/)
})
test('SC-19 · pegar rechaza coordenadas inválidas y vuelve al centro original',()=>{
 const f=fixture([original('a','A',[4,2,1])]);f.copySelected();const m=f.pasteSelected([Infinity,0,0])[0]
 assert.deepEqual(norm(m.position),[4,2,1])
})
test('SC-20 · selección final contiene solo raíces nuevas y una única confirmación',()=>{
 const f=fixture([original('a','G',[0,0,0],null,{type:'group'}),original('child','C',[2,0,0],'a')],['a']);f.copySelected();f.pasteSelected([0,0,-6]);assert.equal(f.store.selectedIds.length,1)
 assert.equal(f.store.selectedId,f.store.selectedIds[0]);assert.equal(f.log.filter(x=>Array.isArray(x)&&x[0]==='commit').length,1)
})

test('SC-21 · en reproducción el portapapeles no modifica la escena',()=>{
 const f=fixture();f.copySelected();f.store.play={on:true};assert.equal(f.canPasteSelected(),false)
 assert.equal(f.pasteSelected([0,0,-6]),false)
})
test('SC-22 · placement usa dirección cardinal y rayo central',()=>{
 assert.match(placementSource,/const distance = 2/)
 assert.match(placementSource,/point\.distanceTo\(raycaster\.ray\.origin\) <= Math\.hypot/)
 assert.match(placementSource,/raycaster\.ray\.copy\(previousRay\)/)
})

test('SC-23 · pegar un StaticBody3D con TriMesh redirige el origen a la malla copiada',()=>{
 const b=original('b','Cuerpo',[0,0,0],null,{type:'staticbody3d',props:{friction:0.5,restitution:0}})
 const m=original('m','Malla',[0,0,0],'b')
 const s=original('s','Colisión',[0,0,0],'b',{type:'collisionshape3d',props:{shape:{type:'TriMeshShape3D',sourceId:'m'},disabled:false}})
 const f=fixture([b,m,s],['b'])
 assert.equal(f.copySelected(),true)
 const made=f.pasteSelected([1,0,0])
 const copyMesh=made.find(o=>o.type==='mesh'),copyShape=made.find(o=>o.type==='collisionshape3d')
 assert.equal(copyShape.props.shape.sourceId,copyMesh.id)
 assert.equal(f.getObject('s').props.shape.sourceId,'m')
 assert.equal(isTriMeshSource(f.store.project.objects,copyShape,copyMesh),true)
})

test('SC-24 · si falta el origen TriMesh al pegar se rechaza sin insertar parcialmente la copia',()=>{
 const b=original('b','Cuerpo',[0,0,0],null,{type:'staticbody3d',props:{friction:0.5,restitution:0}})
 const m=original('m','Malla',[0,0,0],'b')
 const s=original('s','Colisión',[0,0,0],'b',{type:'collisionshape3d',props:{shape:{type:'TriMeshShape3D',sourceId:'m'},disabled:false}})
 const f=fixture([b,m,s],['s'])
 assert.equal(f.copySelected(),true)
 f.store.project.objects=f.store.project.objects.filter(o=>o.id!=='m')
 const previous=f.store.project.objects.length
 assert.equal(f.pasteSelected([2,0,0]),false)
 assert.equal(f.store.project.objects.length,previous)
 assert(f.log.some(x=>Array.isArray(x)&&x[0]==='toast'))
})

test('SC-25 · pegar sin cambio de base conserva exactamente rotación y escala locales',()=>{
 const f=fixture([original('a','A',[1,2,3],null,{rotation:[0.123456789,23.123456789,-3.123456789],scale:[1.123456789,2.123456789,3.123456789]})]);f.copySelected();const copy=f.pasteSelected([5,2,3])[0];assert.deepEqual(norm(copy.rotation),norm(f.getObject('a').rotation));assert.deepEqual(norm(copy.scale),norm(f.getObject('a').scale));assert.deepEqual(norm(copy.position),[5,2,3])
})
