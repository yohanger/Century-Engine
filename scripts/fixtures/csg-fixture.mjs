import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { primitiveMetricAttributes } from '../../src/engine/runtime/mesh/blockout-metrics.js'
import { subtractPolyOf } from '../../src/engine/runtime/mesh/subtract-edit.js'
import { polyBuffers } from '../../src/engine/runtime/mesh/buffers.js'
import { nearestMeshParent, nodeEffectiveActive } from '../../src/engine/runtime/nodes/hierarchy.js'

export const source = (path) => readFileSync(new URL('../../'+path, import.meta.url), 'utf8')
export const near=(a,b,eps=0.0001)=>assert.ok(Math.abs(a-b)<eps,`${a} ≠ ${b}`)
export class Vec3 {
  constructor(x=0,y=0,z=0){this.set(x,y,z)}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this}
  fromBufferAttribute(a,i){return this.set(a.getX(i),a.getY(i),a.getZ(i))}
  applyMatrix4(m){const [x,y,z]=[this.x,this.y,this.z];return this.set(x*m.s[0]+m.t[0],y*m.s[1]+m.t[1],z*m.s[2]+m.t[2])}
  applyMatrix3(){return this}
  normalize(){const l=Math.hypot(this.x,this.y,this.z)||1;return this.set(this.x/l,this.y/l,this.z/l)}
}
export class Matrix3 {getNormalMatrix(){return this}}
export class Matrix4 {
  constructor(t=[0,0,0],s=[1,1,1]){this.t=[...t];this.s=[...s];this.sync()}
  sync(){this.elements=[this.s[0],0,0,0,0,this.s[1],0,0,0,0,this.s[2],0,...this.t,1];return this}
  makeScale(x,y,z){this.s=[x,y,z];this.t=[0,0,0];return this.sync()}
  determinant(){return this.s.reduce((a,b)=>a*b,1)}
  invert(){for(let k=0;k<3;k++){this.t[k]=-this.t[k]/this.s[k];this.s[k]=1/this.s[k]}return this.sync()}
  clone(){return new Matrix4(this.t,this.s)}
  multiply(other){for(let k=0;k<3;k++){this.t[k]+=this.s[k]*other.t[k];this.s[k]*=other.s[k]}return this.sync()}
}
export class Attr {constructor(array,itemSize){this.array=array;this.itemSize=itemSize;this.count=array.length/itemSize} getX(i){return this.array[i*this.itemSize]}getY(i){return this.array[i*this.itemSize+1]}getZ(i){return this.array[i*this.itemSize+2]}}
export class Bounds {
  constructor(min,max){this.min=min;this.max=max}
  clone(){return new Bounds([...this.min],[...this.max])}
  applyMatrix4(m){for(let k=0;k<3;k++){const p=this.min[k]*m.s[k]+m.t[k],q=this.max[k]*m.s[k]+m.t[k];this.min[k]=Math.min(p,q);this.max[k]=Math.max(p,q)}return this}
  intersectsBox(o){return [0,1,2].every(k=>this.max[k]>=o.min[k]&&o.max[k]>=this.min[k])}
}
export class Geo {
  constructor(){this.attributes={};this.index=null;this.disposed=false}
  setAttribute(k,v){this.attributes[k]=v;return this}
  getAttribute(k){return this.attributes[k]}
  computeBoundingSphere(){}
  computeBoundingBox(){const a=this.attributes.position,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<a.count;i++)for(let k=0;k<3;k++){const x=a.array[i*3+k];min[k]=Math.min(min[k],x);max[k]=Math.max(max[k],x)}this.boundingBox=new Bounds(min,max)}
  dispose(){this.disposed=true}
}
export class Mesh {constructor(geometry,material){this.geometry=geometry;this.material=material;this.isMesh=true;this.userData={};this.visible=true}}
export const THREE={Vector3:Vec3,Matrix3,Matrix4,Float32BufferAttribute:Attr,BufferAttribute:Attr,BufferGeometry:Geo,Mesh}
export function box(size,center=[0,0,0]){
  const [sx,sy,sz]=size.map(v=>v/2),[cx,cy,cz]=center
  const vertices=[[-sx,-sy,-sz],[sx,-sy,-sz],[sx,sy,-sz],[-sx,sy,-sz],[-sx,-sy,sz],[sx,-sy,sz],[sx,sy,sz],[-sx,sy,sz]].map(([x,y,z])=>[x+cx,y+cy,z+cz])
  const faces=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[0,4,7,3],[1,2,6,5]]
  const p=[];for(const f of faces)for(const id of [f[0],f[1],f[2],f[0],f[2],f[3]])p.push(...vertices[id])
  return new Geo().setAttribute('position',new Attr(p,3))
}
export function loadCsg(){const s=source('src/engine/runtime/geometry/csg.js').replace(/^import.*\n/gm,'').replace(/^export (function|const)/gm,'$1');return new Function('THREE',s+'\nreturn {carvePolys, carveGeometries, cutterTouches, isCutter}')(THREE)}
export const csg=loadCsg()
export function volume(polys){let out=0;for(const p of polys)for(let i=2;i<p.pts.length;i++){const [a,b,c]=[p.pts[0],p.pts[i-1],p.pts[i]];out+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6}return out}
const cutterGeometry = poly => {
  const b = polyBuffers(poly)
  const geo = new Geo()
  geo.setAttribute('position', new Attr(b.positions, 3))
  geo.setAttribute('normal', new Attr(b.normals, 3))
  geo.setAttribute('uv', new Attr(b.uvs, 2))
  geo.index = { count: b.indices.length, getX(i) { return b.indices[i] } }
  return geo
}
export function booleanReceiver(){
 const s=source('src/engine/runtime/scene/brushes.js').replace(/^import.*\n/gm,'').replace('export const brushesMethods','const brushesMethods')
 return new Function('THREE','carveGeometries','cutterTouches','isCutter','applyShadowMats','unitGeometry','stairsGeometry','primitiveMetricAttributes','geometryOf','subtractPolyOf','nodeEffectiveActive','nearestMeshParent',s+'\nreturn brushesMethods')(
  THREE,csg.carveGeometries,csg.cutterTouches,csg.isCutter,
  ()=>{},()=>box([1,1,1]),()=>box([1,1,1]),primitiveMetricAttributes,cutterGeometry,subtractPolyOf,nodeEffectiveActive,nearestMeshParent)
}
export const brush=booleanReceiver()
export function nodeFor(geo){const m=new Mesh(geo,{dispose(){}});const visual={children:[m],add(obj){obj.parent=this;this.children.push(obj)},remove(obj){this.children=this.children.filter(x=>x!==obj)}};return {userData:{visual},visual,m}}
export function scene(receiverType='mesh'){
 const receiver={id:'wall',type:receiverType,kind:'box',position:[0,0,0],scale:[2,2,2],props:{},visible:true}
 const cutter={id:'cut',type:'subtract',kind:'box',position:[.8,0,0],scale:[1,1,1],props:{},visible:true}
 const r=nodeFor(box([1,1,1])),c=nodeFor(box([1,1,1]))
 const context={host:{project:{objects:[receiver,cutter]}},nodes:new Map([['wall',r],['cut',c]]),vp:{requestRender(){},invalidateShadows(){}},worldMatrix(id){return new Matrix4([...(this.host.project.objects.find(o=>o.id===id)?.position || [0,0,0])])},_brTimer:0}
 Object.assign(context,brush)
 return {receiver,cutter,r,c,context}
}
