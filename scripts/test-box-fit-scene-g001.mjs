// Ejecución del adaptador con matrices Three.js equivalentes; no necesita GPU.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const fakeThree = `
class Matrix4 {
 constructor(elements=[1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]) {this.elements=elements}
 clone(){return new Matrix4([...this.elements])}
 multiply(b){const a=this.elements,c=b.elements,out=Array(16).fill(0);for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)out[col*4+row]+=a[k*4+row]*c[col*4+k];this.elements=out;return this}
 invert(){let a=this.elements;const m=[[a[0],a[4],a[8]],[a[1],a[5],a[9]],[a[2],a[6],a[10]]];const det=m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);if(!det)throw Error('singular');let adj=[[(m[1][1]*m[2][2]-m[1][2]*m[2][1]),(m[0][2]*m[2][1]-m[0][1]*m[2][2]),(m[0][1]*m[1][2]-m[0][2]*m[1][1])],[(m[1][2]*m[2][0]-m[1][0]*m[2][2]),(m[0][0]*m[2][2]-m[0][2]*m[2][0]),(m[0][2]*m[1][0]-m[0][0]*m[1][2])],[(m[1][0]*m[2][1]-m[1][1]*m[2][0]),(m[0][1]*m[2][0]-m[0][0]*m[2][1]),(m[0][0]*m[1][1]-m[0][1]*m[1][0])]].map(r=>r.map(v=>v/det));const t=[a[12],a[13],a[14]];this.elements=[adj[0][0],adj[1][0],adj[2][0],0,adj[0][1],adj[1][1],adj[2][1],0,adj[0][2],adj[1][2],adj[2][2],0,...adj.map(r=>-r.reduce((sum,v,i)=>sum+v*t[i],0)),1];return this}
}
class Euler {constructor(x,y,z,order){Object.assign(this,{x,y,z,order})}}
class Quaternion {constructor(){this.x=0;this.y=0;this.z=0;this.w=1}setFromEuler(e){const c1=Math.cos(e.x/2),c2=Math.cos(e.y/2),c3=Math.cos(e.z/2),s1=Math.sin(e.x/2),s2=Math.sin(e.y/2),s3=Math.sin(e.z/2);this.x=s1*c2*c3+c1*s2*s3;this.y=c1*s2*c3-s1*c2*s3;this.z=c1*c2*s3-s1*s2*c3;this.w=c1*c2*c3+s1*s2*s3;return this}}
class Vector3 {constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}applyQuaternion(q){const {x,y,z,w}=q,u=[x,y,z],v=[this.x,this.y,this.z];const dot=u[0]*v[0]+u[1]*v[1]+u[2]*v[2],uu=u[0]**2+u[1]**2+u[2]**2;const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];const result=v.map((v,i)=>2*dot*u[i]+(w*w-uu)*v+2*w*cross[i]);[this.x,this.y,this.z]=result;return this}getComponent(i){return [this.x,this.y,this.z][i]}}
export {Matrix4,Euler,Quaternion,Vector3}
`
const bounds = readFileSync(new URL('../src/engine/runtime/physics/box-fit-bounds.js',import.meta.url),'utf8')
const boundsURL='data:text/javascript,'+encodeURIComponent(bounds).replaceAll("'",'%27')
const editor=readFileSync(new URL('../src/engine/runtime/physics/box-fit-editor.js',import.meta.url),'utf8')
  .replace("from 'three'",`from 'data:text/javascript,${encodeURIComponent(fakeThree).replaceAll("'",'%27')}'`)
  .replace("from './box-fit-bounds.js'",`from '${boundsURL}'`)
const {hasBoxFitGeometry,fitCollisionBoxFromScene}=await import('data:text/javascript,'+encodeURIComponent(editor).replaceAll("'",'%27'))
// Reconstruir matrices sin depender de la definición del fake módulo.
const matrix=(x=0,y=0,z=0,sx=1,sy=1,sz=1)=>{
 const el=[sx,0,0,0,0,sy,0,0,0,0,sz,0,x,y,z,1]
 return {elements:el,clone(){return matrix(...[this.elements[12],this.elements[13],this.elements[14],this.elements[0],this.elements[5],this.elements[10]])},invert(){const e=this.elements;const p=matrix(-e[12]/e[0],-e[13]/e[5],-e[14]/e[10],1/e[0],1/e[5],1/e[10]);this.elements=p.elements;return this},multiply(b){let a=this.elements,q=b.elements;this.elements=[a[0]*q[0],0,0,0,0,a[5]*q[5],0,0,0,0,a[10]*q[10],0,a[0]*q[12]+a[12],a[5]*q[13]+a[13],a[10]*q[14]+a[14],1];return this}}
}
function fixture({oneSize=[1,1,1],onePos=[0,0,0], shapePos=[0,0,0],extra=false, nested=false}={}){
 const objects=[{id:'body',type:'staticbody3d',visible:true},{id:'visual',parentId:'body',type:'primitive',visible:true},{id:'shape',parentId:'body',type:'collisionshape3d',position:shapePos,rotation:[0,0,0],props:{shape:{type:'BoxShape3D',size:[1,1,1],autoFit:true}}}]
 if(extra) objects.push({id:'second',parentId:'body',type:'mesh',visible:true})
 if(nested)objects.push({id:'nested',parentId:'body',type:'staticbody3d',visible:true},{id:'bad',parentId:'nested',type:'primitive',visible:true})
 const mkmesh=(size,pos)=>({isMesh:true,visible:true,geometry:{boundingBox:null,computeBoundingBox(){this.boundingBox={min:{toArray:()=>[-.5,-.5,-.5]},max:{toArray:()=>[.5,.5,.5]},isEmpty:()=>false}}},matrixWorld:matrix(...pos,...size),userData:{},parent:null})
 const meshes=new Map([['visual',mkmesh(oneSize,onePos)],['second',mkmesh([3,2,1],[5,0,0])],['bad',mkmesh([99,99,99],[0,0,0])]])
 const nodes=new Map();const shape={matrixWorld:matrix(...shapePos),updateWorldMatrix(){},userData:{}};nodes.set('shape',shape)
 for(const o of objects)if(meshes.has(o.id)) {const mesh=meshes.get(o.id);const root={matrixWorld:matrix(),updateWorldMatrix(){},traverse(fn){fn(mesh)}};mesh.parent=root;nodes.set(o.id,root)}
 return {objects,nodes,shape:objects.find(o=>o.id==='shape')}
}
const near=(x,y)=>assert(Math.abs(x-y)<1e-5,`expected ${y}, got ${x}`)
test('BOX-S-01: 20x0.5x20 m de primitiva sin tocar escala del colisionador',()=>{
 const f=fixture({oneSize:[20,.5,20]});const r=fitCollisionBoxFromScene(f.objects,f.nodes,'shape');assert.deepEqual(r.size,[20,.5,20]);assert.deepEqual(r.position,[0,0,0])
})
test('BOX-S-02: desfase local cambia centro, no dimensiones ni escala',()=>{
 const f=fixture({oneSize:[4,1,6],onePos:[3,4,5]});const r=fitCollisionBoxFromScene(f.objects,f.nodes,'shape');assert.deepEqual(r.size,[4,1,6]);assert.deepEqual(r.position,[3,4,5])
})
test('BOX-S-03: el centro conserva posición antigua sin saltos',()=>{
 const f=fixture({oneSize:[4,2,6],onePos:[10,0,0],shapePos:[7,0,0]});const r=fitCollisionBoxFromScene(f.objects,f.nodes,'shape');assert.deepEqual(r.position,[10,0,0])
})
test('BOX-S-04: varias primitivas hermanas dan la envolvente común',()=>{
 const f=fixture({extra:true});const r=fitCollisionBoxFromScene(f.objects,f.nodes,'shape');near(r.size[0],7);near(r.position[0],3);assert.equal(r.meshCount,2)
})
test('BOX-S-05: los cuerpos físicos anidados no contribuyen a la colisión del padre',()=>{
 const f=fixture({nested:true});const r=fitCollisionBoxFromScene(f.objects,f.nodes,'shape');assert.deepEqual(r.size,[1,1,1]);assert.equal(r.meshCount,1)
})
test('BOX-S-06: sin geometría válida se devuelve null y no se cambia la forma',()=>{
 const f=fixture();f.nodes.delete('visual');assert.equal(fitCollisionBoxFromScene(f.objects,f.nodes,'shape'),null)
})
test('BOX-S-07: reconocimiento de geometría no cruza otro cuerpo',()=>{
 const f=fixture({nested:true});assert.equal(hasBoxFitGeometry(f.objects,f.shape),true);f.objects.splice(1,1);assert.equal(hasBoxFitGeometry(f.objects,f.shape),false)
})
