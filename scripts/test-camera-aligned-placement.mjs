import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { validateNodeTree } from '../src/engine/runtime/nodes/hierarchy.js'
import { remapTriMeshSourceIds } from '../src/engine/runtime/physics/trimesh-source.js'
import { remapMeshSubtractSourceIds } from '../src/engine/runtime/mesh/mesh-subtract-source.js'
import { meshDataOf, linkMesh, unlinkMesh } from '../src/engine/runtime/mesh/shared-mesh.js'
import { make } from '../src/engine/runtime/mesh/generators.js'
const read = p => readFileSync(new URL('../'+p, import.meta.url),'utf8')
const normal = v => JSON.parse(JSON.stringify(v))
const near = (a,b) => { assert.equal(a.length,b.length); a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-10,`${a} != ${b}`)) }
class Vec {
  constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z})}
  toArray(){return [this.x,this.y,this.z]}
  clone(){return new Vec(...this.toArray())}
  add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this}
  distanceTo(v){return Math.hypot(this.x-v.x,this.y-v.y,this.z-v.z)}
}
const code=read('src/core/editor/placement.js').replace(/^import[^\n]*\n/gm,'').replace(/^export /gm,'')
const methods=runInNewContext(code+'\n;placementMethods',{THREE:{Vector3:Vec,Vector2:class {constructor(x,y){Object.assign(this,{x,y})}}}})
function placement(forward=[0,0,-1],origin=[0,3,0],right=[1,0,0],hit=null){
 const camera={getWorldDirection:()=>new Vec(...forward),getWorldPosition:()=>new Vec(...origin),matrixWorld:{elements:right}}
 const ray={origin:new Vec(90,20,30),clone(){return {origin:this.origin.clone()}},copy(other){this.origin=other.origin.clone()}}
 const originalCamera={};const raycaster={ray,camera:originalCamera,setFromCamera(p,c){assert.deepEqual([p.x,p.y],[0,0]);this.camera=c;ray.origin=c.getWorldPosition()}}
 return {...methods,vp:{camera},raycaster,originalCamera,_surfaceHit:()=>hit}
}
for(const [name,dir,expected] of [['+X',[1,.5,.2],[2,0,0]],['-X',[-1,-.9,.2],[-2,0,0]],['+Z',[.2,0,1],[0,0,2]],['-Z',[.2,0,-1],[0,0,-2]],['diagonal',[.5,0,.5],[2,0,0]],['vertical',[0,1,0],[0,0,-2]]]){
 test('Dirección '+name,()=>near(placement(dir).duplicateWorldOffset(),expected))
}
test('Vista vertical conserva rumbo mediante eje derecho',()=>near(placement([0,-1,0],[0,0,0],[0,0,1]).duplicateWorldOffset(),[2,0,0]))
test('Pegado central cercano, sin alterar rayo del cursor',()=>{const e=placement([0,0,-1],[5,3,8],[1,0,0],{point:new Vec(5,3,6)});near(e.clipboardPlacePoint(),[5,3,6]);near(e.raycaster.ray.origin.toArray(),[90,20,30]);assert.equal(e.raycaster.camera,e.originalCamera)})
test('Pegado lejano y espacio libre aplican el límite horizontal',()=>{for(const hit of [{point:new Vec(5,3,-90)}, {point:new Vec(5,9,8),free:true},null])near(placement([.9,.4,-.1],[5,3,8],[1,0,0],hit).clipboardPlacePoint(),[7,3,8])})
test('El destino cambia al moverse de habitación e inclinar la cámara',()=>{const e=placement([0,.7,-.7],[1,2,3]);near(e.clipboardPlacePoint(),[1,2,1]);e.vp.camera=placement([-1,.9,0],[100,4,50]).vp.camera;near(e.clipboardPlacePoint(),[98,4,50])})
const state=read('src/core/state/objects.js').replace(/^import[^\n]*\n/gm,'').replace(/^export /gm,'')
const obj=(id,extra={})=>({id,name:id,type:'mesh',kind:'cube',parentId:null,position:[1,2,3],rotation:[12,34,56],scale:[2,3,4],props:{mesh:make('cube').toJSON()},...extra})
function fixture(objects,selected,editor=placement([1,0,0]),inverse=null){
 let serial=0; const commits=[], errors=[]
 const store={project:{objects:normal(objects),id:'qa',meshes:[],signalConnections:[]},selectedIds:[...selected],selectedId:selected.at(-1),editor:{...editor,syncAll(){},setSelection(){}},filmMode:false,play:{on:false}}
 const getObject=id=>store.project.objects.find(o=>o.id===id)
 const childrenOf=id=>store.project.objects.filter(o=>o.parentId===id)
 const descendantsOf=id=>childrenOf(id).flatMap(c=>[c,...descendantsOf(c.id)])
 const selectionRoots=()=>store.selectedIds.filter(id=>{for(let p=getObject(id);p?.parentId;p=getObject(p.parentId))if(store.selectedIds.includes(p.parentId))return false;return true})
 const worldMatrix=id=>({determinant:()=>inverse===false?0:1,invert:()=>({elements:inverse||[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]})})
 const api=runInNewContext(state+'\n;({duplicateSelected,linkedDuplicateSelected})',{store,getObject,childrenOf,descendantsOf,selectionRoots,worldMatrix,validateNodeTree,remapTriMeshSourceIds,remapMeshSubtractSourceIds,meshDataOf,linkMesh,unlinkMesh,uid:()=>`new${++serial}`,commit:x=>commits.push(x),toast:x=>errors.push(x),Map,Set,Number})
 return {...api,store,getObject,commits,errors}
}
test('Duplicación consecutiva desplaza 2 m, no modifica rotación ni escala',()=>{const f=fixture([obj('a')],['a']);assert.equal(f.duplicateSelected(),true);let b=f.getObject(f.store.selectedId);near(b.position,[3,2,3]);near(b.rotation,[12,34,56]);near(b.scale,[2,3,4]);assert.equal(f.duplicateSelected(),true);near(f.getObject(f.store.selectedId).position,[5,2,3]);assert.equal(f.commits.length,2)})
test('Raíces múltiples y padre-hijo reciben una traslación común, hijo conserva posición local',()=>{const f=fixture([obj('g',{type:'group'}),obj('c',{parentId:'g'}),obj('b',{position:[8,4,9]})],['g','c','b']);assert.equal(f.duplicateSelected(),true);assert.equal(f.store.project.objects.length,6);const [g,b]=f.store.selectedIds.map(f.getObject);near(g.position,[3,2,3]);near(b.position,[10,4,9]);near(f.store.project.objects.find(o=>o.parentId===g.id).position,[1,2,3]);assert.equal(f.commits.length,1)})
test('Padre rotado y escalado: inversa lineal conserva 2 m globales',()=>{const inverse=[0,0,.25,0,0,1/3,0,0,-.5,0,0,0,9,8,7,1];const f=fixture([obj('p',{type:'node3d'}),obj('a',{parentId:'p'})],['a'],placement([1,0,0]),inverse);assert.equal(f.duplicateSelected(),true);const b=f.getObject(f.store.selectedId);near(b.position,[1,2,3.5]);near(b.rotation,[12,34,56]);near(b.scale,[2,3,4]);const delta=b.position.map((v,i)=>v-[1,2,3][i]);near([4*delta[2],3*delta[1],-2*delta[0]],[2,0,0])})
test('Padre singular rechaza sin insertar ni confirmar',()=>{const f=fixture([obj('p',{type:'node3d'}),obj('a',{parentId:'p'})],['a'],placement(),false);assert.equal(f.duplicateSelected(),false);assert.equal(f.store.project.objects.length,2);assert.equal(f.commits.length,0);assert.match(f.errors[0],/no invertible/)})
test('Alt+D comparte solo geometría y conserva el desplazamiento cardinal',()=>{const f=fixture([obj('a')],['a']);const [b]=f.linkedDuplicateSelected();near(b.position,[3,2,3]);assert.ok(b.props.meshRef);assert.equal(b.props.meshRef,f.getObject('a').props.meshRef);assert.equal(f.store.project.meshes.length,1);assert.equal(f.commits.length,1)})
