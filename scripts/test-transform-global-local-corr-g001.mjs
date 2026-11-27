// LF-TRANSFORM-GLOBAL-LOCAL-CORR-G001 — geometría de los ejes y API del nodo real.
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {readFileSync} from 'node:fs'
const read = name => readFileSync(new URL(`../src/${name}`, import.meta.url),'utf8')
const EPS = 1e-6
class Q {
 constructor(x=0,y=0,z=0,w=1){Object.assign(this,{x,y,z,w})}
 clone(){return new Q(this.x,this.y,this.z,this.w)}
 copy(q){Object.assign(this,q);return this}
 invert(){this.x=-this.x;this.y=-this.y;this.z=-this.z;return this}
 normalize(){const l=Math.hypot(this.x,this.y,this.z,this.w);this.x/=l;this.y/=l;this.z/=l;this.w/=l;return this}
 multiply(q){const a=this.clone();this.x=a.x*q.w+a.w*q.x+a.y*q.z-a.z*q.y;this.y=a.y*q.w+a.w*q.y+a.z*q.x-a.x*q.z;this.z=a.z*q.w+a.w*q.z+a.x*q.y-a.y*q.x;this.w=a.w*q.w-a.x*q.x-a.y*q.y-a.z*q.z;return this}
 slerpQuaternions(a,b,t){this.copy(a);const dot=a.x*b.x+a.y*b.y+a.z*b.z+a.w*b.w;const end=dot<0?new Q(-b.x,-b.y,-b.z,-b.w):b;const c=Math.max(-1,Math.min(1,Math.abs(dot)));const theta=Math.acos(c);if(theta<1e-7){this.x=a.x+(end.x-a.x)*t;this.y=a.y+(end.y-a.y)*t;this.z=a.z+(end.z-a.z)*t;this.w=a.w+(end.w-a.w)*t;return this.normalize()};const s=Math.sin(theta);const k=Math.sin((1-t)*theta)/s,h=Math.sin(t*theta)/s;this.x=a.x*k+end.x*h;this.y=a.y*k+end.y*h;this.z=a.z*k+end.z*h;this.w=a.w*k+end.w*h;return this.normalize()}
 static y(a){return new Q(0,Math.sin(a/2),0,Math.cos(a/2))}
}
class V {
 constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z})}
 clone(){return new V(this.x,this.y,this.z)}
 copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this}
 applyQuaternion(q){const v=new Q(this.x,this.y,this.z,0);const p=q.clone().multiply(v).multiply(q.clone().invert());this.x=p.x;this.y=p.y;this.z=p.z;return this}
 toArray(){return [this.x,this.y,this.z]}
 set(x,y,z){Object.assign(this,{x,y,z});return this}
}
const eq=(a,b)=>{const p=Array.isArray(a)?a:a.toArray(),q=Array.isArray(b)?b:b.toArray();assert.equal(p.length,q.length);for(let i=0;i<p.length;i++)assert.ok(Math.abs(p[i]-q[i])<EPS,`${p} != ${q}`)}
const snap=read('core/editor/snap.js').replace(/^export /gm,'')
const gz=read('core/editor/gizmo.js').replace(/^import .*$/gm,'').replace('export const gizmoMethods =','const gizmoMethods =')
const selsrc=read('core/editor/selection.js').replace(/^import .*$/gm,'').replace('export const selectionMethods =','const selectionMethods =')
const api=read('engine/runtime/events/play-nodes.js').replace(/^import .*$/gm,'').replace('export const nodesMethods =','const nodesMethods =')
const edit=read('core/mesh/session-xform.js')
const storesrc=read('core/state/state.js')
function parent(position=[0,0,0],angle=0){const pos=new V(...position),q=Q.y(angle);return {updateWorldMatrix(){},localToWorld(v){return v.applyQuaternion(q).set(v.x+pos.x,v.y+pos.y,v.z+pos.z)},worldToLocal(v){v.x-=pos.x;v.y-=pos.y;v.z-=pos.z;return v.applyQuaternion(q.clone().invert())}}}
function setup({angle=0,parentPos=[0,0,0],localRotation=0,space='world',mode='translate',snapOn=true,shift=false,axis='X',start=[0,0,0],raw=[0,0,0],angleDrag=0}={}){
 const par=parent(parentPos,angle), obj={position:new V(...raw),quaternion:Q.y(localRotation),scale:new V(1,1,1),parent:par,updateMatrixWorld(){},getWorldQuaternion(q){return q.copy(Q.y(angle).multiply(this.quaternion))}}
 const t={object:obj,space,mode,axis,rotationAngle:angleDrag}
 const rawPose={position:new V(...raw),quaternion:obj.quaternion.clone(),scale:obj.scale.clone()}
 const drag={control:t,shifted:shift,anchorRaw:{position:new V(...start),quaternion:Q.y(localRotation),scale:new V(1,1,1)},anchorOut:{position:new V(...start),quaternion:Q.y(localRotation),scale:new V(1,1,1)},raw:rawPose,angleStart:0,angle:0,basis:Q.y(angle).multiply(Q.y(localRotation)),absolute:true}
 const store={project:{settings:{gridSize:1,rotSnap:15,moveSnapOn:snapOn,rotateSnapOn:snapOn}},space}
 const ctx=vm.createContext({THREE:{Vector3:V,Quaternion:Q},store,DEG:Math.PI/180,snapAxisValue:null,snapEnabled:null,snapStep:null})
 vm.runInContext(snap+'\nglobalThis.snapFns={snapAxisValue,snapEnabled,snapStep}',ctx)
 Object.assign(ctx,ctx.snapFns)
 vm.runInContext(gz+'\nglobalThis.gizmoMethods=gizmoMethods',ctx)
 const methods=ctx.gizmoMethods
 const receiver={_snapDrag:drag,_snapPose:()=>({position:obj.position.clone(),quaternion:obj.quaternion.clone(),scale:obj.scale.clone()})}
 return {t,obj,par,drag,ctx,methods,receiver,apply:()=>methods._applySnapDrag.call(receiver,t)}
}
test('GL-01: espacio global X con padre girado se cuantiza sobre el mundo',()=>{const x=setup({angle:Math.PI/2,start:[0,0,0],raw:[0,0,-1.3]});x.apply();eq(x.par.localToWorld(x.obj.position.clone()),[-1,0,0])})
test('GL-02: espacio local X con padre girado respeta eje orientado',()=>{const x=setup({angle:Math.PI/2,space:'local',raw:[1.3,0,0]});x.apply();eq(x.obj.position,[1,0,0]);eq(x.par.localToWorld(x.obj.position.clone()),[0,0,-1])})
test('GL-03: local con padre desplazado no aplica Snap en coordenadas del padre',()=>{const x=setup({angle:Math.PI/2,parentPos:[13,0,2],space:'local',start:[0,0,0],raw:[1.35,0,0]});x.apply();eq(x.obj.position,[1,0,0])})
test('GL-04: padre rotado sin Snap restringe el movimiento al eje global',()=>{const x=setup({angle:Math.PI/2,space:'world',snapOn:false,raw:[1.23,0,-0.47]});x.apply();eq(x.obj.position,[0,0,-0.47])})
test('GL-05: Shift suspende Snap en espacio local',()=>{const x=setup({angle:Math.PI/2,space:'local',shift:true,raw:[1.37,0,0]});x.apply();eq(x.obj.position,[1.37,0,0])})
test('GL-06: cambiar selector no dispara transformación ni altera datos',()=>{for(const s of ['world','local']){const x=setup({angle:Math.PI/3,space:s,start:[3,2,1],raw:[3,2,1]});x.t.space=s==='world'?'local':'world';eq(x.obj.position,[3,2,1])}})
test('GL-07: Snap solo afecta al eje arrastrado',()=>{const x=setup({raw:[1.31,2.6,3.4],start:[0,0,0],space:'world',axis:'X'});x.apply();eq(x.obj.position,[1,0,0])})
test('GL-08: la base de la operación recuerda orientación mundial al iniciar',()=>assert.match(gz,/basis: t\.object\.getWorldQuaternion\(new THREE\.Quaternion\(\)\)/))
test('GL-09: rotación sin Snap no reconstruye eje',()=>{const x=setup({mode:'rotate',snapOn:false,angle:Math.PI/2,localRotation:0});x.obj.quaternion=Q.y(0.43);x.apply();eq([x.obj.quaternion.y,x.obj.quaternion.w],[Math.sin(.43/2),Math.cos(.43/2)])})
test('GL-10: giro cuantizado usa delta local aportado por TransformControls',()=>{const x=setup({mode:'rotate',angleDrag:Math.PI/9,snapOn:true});x.obj.quaternion=Q.y(Math.PI/9);x.apply();eq([x.obj.quaternion.y,x.obj.quaternion.w],[Math.sin((Math.PI/12)/2),Math.cos((Math.PI/12)/2)])})
test('GL-11: la API conserva get local / set local y worldPosition solo lectura',()=>{const x=vm.createContext({THREE:{Vector3:V},DEG:Math.PI/180});vm.runInContext(api+'\nglobalThis.api=nodesMethods',x);const node={position:new V(2,0,0),rotation:new V(0,0,0),getWorldPosition(){return new V(12,0,0)},updateMatrixWorld(){this.updated=true},userData:{},visible:true};const host={project:{objects:[{id:'n',name:'Nodo',type:'primitive'}]},ed:{nodes:new Map([['n',node]])},phys:{syncNode(){node.synced=true}},pos:new V(0,0,0),_tagLayerApi:()=>({}),_animMethodsFor:()=>({})};host._find=x.api._find;host._nodeHandle=x.api._nodeHandle;const h=host._nodeHandle('n');eq(h.position,[2,0,0]);eq(h.worldPosition,[12,0,0]);h.position=[4,1,2];eq(node.position,[4,1,2]);assert.ok(node.synced&&node.updated);assert.equal(Object.getOwnPropertyDescriptor(h,'worldPosition').set,undefined)})
test('GL-12: Edit Mode actualiza la matriz mundial sin gizmo',()=>{assert.match(edit,/updateSelectionMatrix\(\) \{ this\.visual\.updateWorldMatrix\(true, false\) \}/);assert.doesNotMatch(edit,/this\.tc/);assert.match(read('core/mesh/session.js'),/this\.updateSelectionMatrix\(\)/)})
test('GL-13: el selector del Editor afecta mover y rotar, escala queda local',()=>{assert.match(selsrc,/this\.tc\.setSpace\(store\.space\); this\.tcRot\.setSpace\(store\.space\); this\.tcScl\.setSpace\('local'\)/);assert.match(read('core/editor/keys.js'),/store\.gizmo, store\.space/);assert.match(read('core/commands.js'),/store\.space = store\.space === 'world' \? 'local' : 'world'/)})
test('GL-14: Terrain mantiene gizmo de traslación y sin rotación artificial',()=>{assert.match(gz,/t\.setMode\('translate'\)/);assert.match(gz,/terrainProxy\.position\.set\(t\.ox, t\.oy, t\.oz\)/)})
test('GL-15: no se introduce segunda posición persistida',()=>{assert.doesNotMatch(storesrc,/worldPosition:\s*\[/);assert.doesNotMatch(gz,/obj\.worldPosition\s*=/)})
