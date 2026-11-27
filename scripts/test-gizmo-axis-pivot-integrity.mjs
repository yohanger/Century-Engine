import { mergeEditorSettings } from '../src/core/state/editor-workspace.js'
import { finiteVector, finiteQuaternion, finiteTuple } from '../src/engine/runtime/numeric-integrity.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { snapAxisValue, snapEnabled, snapStep } from '../src/core/editor/snap.js'

const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8')
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-7, `${a} != ${b}`)
const vectorNear = (a,b) => ['x','y','z'].forEach((k,i)=>near(a[k],b[i]))
const DEG = Math.PI/180
class Q {
  constructor(x=0,y=0,z=0,w=1) { Object.assign(this,{x,y,z,w}) }
  clone(){return new Q(this.x,this.y,this.z,this.w)}
  copy(q){Object.assign(this,q);return this}
  normalize(){const n=Math.hypot(this.x,this.y,this.z,this.w);for(const a of ['x','y','z','w'])this[a]/=n;return this}
  invert(){this.x=-this.x;this.y=-this.y;this.z=-this.z;return this}
  multiply(q){const a=this.clone();this.x=a.x*q.w+a.w*q.x+a.y*q.z-a.z*q.y;this.y=a.y*q.w+a.w*q.y+a.z*q.x-a.x*q.z;this.z=a.z*q.w+a.w*q.z+a.x*q.y-a.y*q.x;this.w=a.w*q.w-a.x*q.x-a.y*q.y-a.z*q.z;return this}
  slerpQuaternions(a,b,t){const dot=a.x*b.x+a.y*b.y+a.z*b.z+a.w*b.w;const q=dot<0?new Q(-b.x,-b.y,-b.z,-b.w):b;const theta=Math.acos(Math.min(1,Math.abs(dot)));if(theta<1e-8)return this.copy(a);const k=Math.sin((1-t)*theta)/Math.sin(theta),h=Math.sin(t*theta)/Math.sin(theta);return this.copy(new Q(a.x*k+q.x*h,a.y*k+q.y*h,a.z*k+q.z*h,a.w*k+q.w*h)).normalize()}
  static axis(axis,angle){const v=new Q(0,0,0,Math.cos(angle/2));v[axis.toLowerCase()]=Math.sin(angle/2);return v}
}
class V {
  constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z})}
  clone(){return new V(this.x,this.y,this.z)}
  copy(v){Object.assign(this,v);return this}
  applyQuaternion(q){const p=q.clone().multiply(new Q(this.x,this.y,this.z,0)).multiply(q.clone().invert());return this.copy(new V(p.x,p.y,p.z))}
}
const source=read('src/core/editor/gizmo.js').replace(/^import .*$/gm,'').replace('export const gizmoMethods =','const gizmoMethods =')
const helpers=read('src/engine/runtime/nodes/three-helpers.js').replace(/^import .*$/gm,'').replace(/^export /gm,'')
const scaleTarget = new Function(helpers+'\nreturn typeof nodeScaleTarget === "function" ? nodeScaleTarget : null')()
function session({mode='translate',axis='X',space='world',snap=true,start=[0,0,0],scale=[1,1,1],parent,basis=new Q(),rotation=new Q(),native=false}={}){
 const p=parent||{localToWorld:v=>v,worldToLocal:v=>v,updateWorldMatrix(){},getWorldQuaternion:q=>q}
 const obj={position:new V(...start),scale:new V(...scale),quaternion:rotation.clone(),parent:p,updateMatrixWorld(){},getWorldQuaternion:q=>q.copy(basis)}
 const t={object:obj,mode,axis,space,rotationAngle:0,dragging:true,setTranslationSnap(){},setRotationSnap(){},setScaleSnap(){}}
 if(native)Object.assign(t,{pointStart:new V(),pointEnd:new V(),worldPositionStart:p.localToWorld(obj.position.clone()),rotationAxis:new V(1,0,0),eye:new V(0,1,0)})
 const store={project:{settings:{moveSnapOn:snap,scaleSnapOn:snap,rotateSnapOn:snap,gridSize:1,rotSnap:15,scaleSnap:.25}}}
 const m=new Function('THREE','store','editorSettings','DEG','snapAxisValue','snapEnabled','snapStep','nodeScaleTarget','getObject','finiteVector','finiteQuaternion','finiteTuple',source+'\nreturn gizmoMethods')({Vector3:V,Quaternion:Q},store,()=>mergeEditorSettings(store),DEG,snapAxisValue,snapEnabled,snapStep,scaleTarget,()=>null,finiteVector,finiteQuaternion,finiteTuple)
 const e=Object.assign({_shiftSnapHeld:false},m)
 e._beginSnapDrag(t)
 return {obj,t,e,apply:()=>e._applySnapDrag(t)}
}
const rotatedParent={updateWorldMatrix(){},getWorldQuaternion:q=>q.copy(Q.axis('Y',Math.PI/2)),localToWorld:v=>v.applyQuaternion(Q.axis('Y',Math.PI/2)),worldToLocal:v=>v.applyQuaternion(Q.axis('Y',-Math.PI/2))}

test('Unselected axes are immutable with and without snapping',()=>{
 for(const step of [null,1])near(snapAxisValue(8,4,4,step,false),4)
})
test('No motion on an off-grid position does not snap to a new point',()=>near(snapAxisValue(.4,.4,.4,1,true,true),.4))
for(const axis of ['X','Y','Z'])test(`World ${axis} excludes the other two axes`,()=>{
 const h=session({axis,snap:false,start:[2,3,4]});h.obj.position.copy(new V(5,6,7));h.apply()
 vectorNear(h.obj.position,[2,3,4].map((v,i)=>v+(axis==='XYZ'[i]?3:0)))
})
test('Planar motion preserves the normal coordinate',()=>{
 const h=session({axis:'XZ',start:[2,3,4]});h.obj.position.copy(new V(4.3,8,6.6));h.apply();vectorNear(h.obj.position,[4,3,7])
})
test('World translation under a rotated, scaled and sheared parent uses the exact world delta',()=>{
 const parent={updateWorldMatrix(){},getWorldQuaternion:q=>q,localToWorld:v=>new V(2*v.x+v.y+10,3*v.y-4,4*v.z),worldToLocal:v=>new V((v.x-10-(v.y+4)/3)/2,(v.y+4)/3,v.z/4)}
 const h=session({native:true,parent,snap:false,start:[1,2,3]});h.t.pointStart=new V(.7,0,0);h.t.pointEnd=new V(4.7,2,-3)
 h.obj.position.copy(new V(9,9,9));h.apply();vectorNear(parent.localToWorld(h.obj.position),[18,2,12])
})
test('Local translation follows the frozen world basis under a rotated parent',()=>{
 const h=session({native:true,parent:rotatedParent,basis:Q.axis('Y',Math.PI/2),space:'local',snap:false});h.t.pointEnd=new V(9,7,-2);h.obj.position.copy(new V(1,7,9));h.apply();vectorNear(h.obj.position,[2,0,0])
})
test('Shift rebases a drag without introducing cross-axis motion',()=>{
 const h=session({start:[.4,5,6]});h.obj.position.copy(new V(1.7,8,9));h.apply();vectorNear(h.obj.position,[2,5,6]);h.e._setSnapShiftHeld(true);h.obj.position.copy(new V(1.7,1,1));h.apply();vectorNear(h.obj.position,[2,5,6]);h.obj.position.copy(new V(2,9,8));h.apply();vectorNear(h.obj.position,[2.3,5,6])
})
test('Scale X preserves the other components',()=>{
 const h=session({mode:'scale',scale:[2,3,4]});h.obj.scale.copy(new V(2.4,8,9));h.apply();vectorNear(h.obj.scale,[2.5,3,4])
})
test('Uniform scaling snaps a common factor, preserving proportions',()=>{
 const h=session({mode:'scale',axis:'XYZ',scale:[1,2.2,3.4]});h.obj.scale.copy(new V(1.3,2.86,4.42));h.apply();vectorNear(h.obj.scale,[1.25,2.75,4.25])
})
test('A snapped 200 degree rotation follows the native angle, not the shortest arc',()=>{
 const h=session({mode:'rotate',axis:'Y'});h.t.rotationAngle=200*DEG;h.obj.quaternion=Q.axis('Y',200*DEG);h.apply();const v=new V(1,0,0).applyQuaternion(h.obj.quaternion);vectorNear(v,[Math.cos(195*DEG),0,-Math.sin(195*DEG)])
})
for(const snap of [true,false])test(`Face-on local rotation under a rotated parent (${snap?'snap':'free'}) follows the selected local ring`,()=>{
 const h=session({mode:'rotate',axis:'X',space:'local',native:true,parent:rotatedParent,basis:Q.axis('Y',Math.PI/2),snap})
 h.t.eye=new V(0,0,1);h.t.rotationAxis=h.t.eye.clone();h.t.rotationAngle=20*DEG;h.obj.quaternion=Q.axis('Z',20*DEG);h.apply()
 const a=(snap?-15:-20)*DEG;const v=new V(0,1,0).applyQuaternion(h.obj.quaternion);vectorNear(v,[0,Math.cos(a),Math.sin(a)])
})
test('Spatial containers scale their root; primitives scale their visual',()=>{
 assert.equal(typeof scaleTarget,'function');const visual={},root={userData:{visual}};assert.equal(scaleTarget(root,'node3d'),root);assert.equal(scaleTarget(root,'sceneInstance'),root);assert.equal(scaleTarget(root,'primitive'),visual)
})
test('Scale target resolution recognizes the root as a scale operation',()=>{
 const h=session({mode:'scale'});h.obj.userData={kind:'object',id:'p'};assert.equal(h.e._gizmoTarget(h.t).isScale,true)
})
