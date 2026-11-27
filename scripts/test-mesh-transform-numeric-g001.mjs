// LF-MESH-TRANSFORM-NUMERIC-G001 — usa las funciones reales de session-xform y PolyMesh.
import { finiteFloat32 } from '../src/engine/runtime/numeric-integrity.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { make } from '../src/engine/runtime/mesh/generators.js'
import { PolyMesh, ekey } from '../src/engine/runtime/mesh/polymesh.js'
import { Sel, normalize } from '../src/core/mesh/sel.js'
const source = (file) => readFileSync(new URL('../'+file, import.meta.url),'utf8')
const near=(x,y,e=1e-8)=>assert.ok(Math.abs(x-y)<e,`${x} != ${y}`)
const vecNear=(x,y)=>x.forEach((v,i)=>near(v,y[i]))
class M4 {
 constructor(sx=1,sy=1,sz=1,tx=0,ty=0,tz=0){Object.assign(this,{sx,sy,sz,tx,ty,tz})}
 clone(){return new M4(this.sx,this.sy,this.sz,this.tx,this.ty,this.tz)}
 invert(){const {sx,sy,sz,tx,ty,tz}=this;return Object.assign(this,{sx:1/sx,sy:1/sy,sz:1/sz,tx:-tx/sx,ty:-ty/sy,tz:-tz/sz})}
}
class V3 {
 constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z})}
 set(x,y,z){Object.assign(this,{x,y,z});return this}
 setComponent(i,n){this[['x','y','z'][i]]=n;return this}
 clone(){return new V3(this.x,this.y,this.z)}
 toArray(){return [this.x,this.y,this.z]}
 copy(v){return this.set(v.x,v.y,v.z)}
 add(v){return this.set(this.x+v.x,this.y+v.y,this.z+v.z)}
 sub(v){return this.set(this.x-v.x,this.y-v.y,this.z-v.z)}
 addScaledVector(v,w){return this.set(this.x+v.x*w,this.y+v.y*w,this.z+v.z*w)}
 multiplyScalar(v){return this.set(this.x*v,this.y*v,this.z*v)}
 distanceTo(v){return Math.hypot(this.x-v.x,this.y-v.y,this.z-v.z)}
 normalize(){return this.multiplyScalar(1/(Math.hypot(this.x,this.y,this.z)||1))}
 applyMatrix4(m){return this.set(this.x*m.sx+m.tx,this.y*m.sy+m.ty,this.z*m.sz+m.tz)}
 applyQuaternion(q){const x=this.x,y=this.y,z=this.z,u=q.x,v=q.y,w=q.z,s=q.w;
  const ix=s*x+v*z-w*y,iy=s*y+w*x-u*z,iz=s*z+u*y-v*x,iw=-u*x-v*y-w*z
  return this.set(ix*s+iw*-u+iy*-w-iz*-v,iy*s+iw*-v+iz*-u-ix*-w,iz*s+iw*-w+ix*-v-iy*-u)}
}
class Q {
 constructor(x=0,y=0,z=0,w=1){Object.assign(this,{x,y,z,w})}
 clone(){return new Q(this.x,this.y,this.z,this.w)}
 invert(){this.x=-this.x;this.y=-this.y;this.z=-this.z;return this}
 setFromAxisAngle(v,a){return Object.assign(this,{x:v.x*Math.sin(a/2),y:v.y*Math.sin(a/2),z:v.z*Math.sin(a/2),w:Math.cos(a/2)})}
 slerp(q,t){if(t===1)return Object.assign(this,q);if(t===0)return this; const a=2*Math.acos(Math.min(1,Math.max(-1,q.w)))*t;const l=Math.hypot(q.x,q.y,q.z);return this.setFromAxisAngle(l?new V3(q.x/l,q.y/l,q.z/l):new V3(1,0,0),a)}
}
const THREE={Vector3:V3,Quaternion:Q}
const store={space:'local',edit:{proportional:false,propSize:3,falloff:'linear',mirrorX:false}}
const src=source('src/core/mesh/session-xform.js').replace(/^import .*\n/gm,'').replace(/^export /gm,'')+'\n;({xformMethods})'
const {xformMethods}=runInNewContext(src,{THREE,store,finiteFloat32,vadd:(a,b)=>a.map((v,i)=>v+b[i]),vmul:(a,b)=>a.map(v=>v*b),FALLOFF:{linear:(t)=>1-t,smooth:(t)=>1-t}}, {filename:'session-xform.js'})
function fixture({mode='vertex',indices=[0],matrix=new M4(),poly=make('cube'),space='local'}={}){
 store.space=space;store.edit.proportional=false;store.edit.mirrorX=false
 const sel=new Sel()
 sel[mode==='face'?'f':mode==='edge'?'e':'v']=new Set(indices)
 normalize(poly,sel,mode)
 const commits=[],renders=[]
 const s={poly,sel,mode,modal:null,gz:null,paintStroke:null,visual:{matrixWorld:matrix,updateWorldMatrix(){},getWorldQuaternion(){return new Q()}},
  refresh(){renders.push('refresh')},commit(label){commits.push(label);this.saved=JSON.parse(JSON.stringify(this.poly.toJSON()))},
  _liveUpdate(){renders.push('preview');this.refresh({geometry:true})},tc:{getHelper(){return {visible:true}},enabled:true}}
 Object.assign(s,xformMethods)
 return {s,commits,renders}
}
const coords=(s,ids)=>ids.map(i=>[...s.poly.v[i]])

test('NT-01 un vértice admite posición XYZ absoluta y un solo commit',()=>{
 const {s,commits,renders}=fixture();const initial=s.poly.v[0][0];assert.ok(s.numericPosition())
 assert.equal(s.numericTransform('position',0,initial+1),true)
 near(s.poly.v[0][0],initial+1);assert.equal(commits.length,0)
 s.numericTransform('position',0,initial+1.25); near(s.poly.v[0][0],initial+1.25)
 assert.equal(s.numericCommit(),true);assert.equal(commits.length,1);assert.equal(s.saved.v[0],initial+1.25)
 assert.ok(renders.includes('refresh'))
})
test('NT-02 vértice posición exacta respeta transformaciones del objeto no uniformes',()=>{
 const {s}=fixture({matrix:new M4(2,3,4,5,0,-2)})
 const old=[...s.poly.v[0]];s.numericTransform('position',1,old[1]+2);s.numericCommit()
 vecNear(s.poly.v[0],[old[0],old[1]+2,old[2]])
})
test('NT-03 traslación local de selección usa delta y conserva distancias',()=>{
 const {s}=fixture({indices:[0,1,2],matrix:new M4(2,3,4,0,0,0)})
 const before=coords(s,[0,1,2]);s.numericTransform('move',1,1.25);s.numericCommit()
 for(let i=0;i<3;i++)vecNear(s.poly.v[i],[before[i][0],before[i][1]+1.25,before[i][2]])
})
test('NT-04 traslación global respeta escala del objeto en unidades del mundo',()=>{
 const {s}=fixture({indices:[0,1],matrix:new M4(2,3,4),space:'global'})
 const before=s.poly.v[0][0];s.numericTransform('move',0,2);s.numericCommit();near(s.poly.v[0][0]-before,1)
})
test('NT-05 selección de arista afecta cada vértice una única vez',()=>{
 const m=make('cube'), k=[...m.edges().keys()][0]
 const {s}=fixture({poly:m,mode:'edge',indices:[k]});const before=coords(s,[...s.sel.v]);
 assert.equal(s.sel.v.size,2);assert.equal(s.numericPosition(),null)
 s.numericTransform('move',2,3);s.numericCommit()
 let i=0;for(const v of s.sel.v){near(s.poly.v[v][2]-before[i][2],3);i++}
})
test('NT-06 selección de cara transforma sus vértices únicos sin tocar otros',()=>{
 const {s}=fixture({mode:'face',indices:[0]});const ids=new Set(s.sel.v),before=s.poly.v.map(p=>[...p]);
 s.numericTransform('move',2,0.5);s.numericCommit()
 s.poly.v.forEach((p,i)=>near(p[2]-before[i][2],ids.has(i)?0.5:0))
})
test('NT-07 varios ejes confirmados sucesivamente conservan ambos cambios',()=>{
 const {s,commits}=fixture({indices:[0,1]});const orig=coords(s,[0,1]);
 s.numericTransform('move',0,1.5);s.numericCommit();s.numericTransform('move',1,2.25);s.numericCommit()
 for(let i=0;i<2;i++)vecNear(s.poly.v[i],[orig[i][0]+1.5,orig[i][1]+2.25,orig[i][2]])
 assert.equal(commits.length,2)
})
test('NT-08 rotación alrededor del centro de selección conserva longitudes',()=>{
 const {s}=fixture({indices:[0,1]});const ids=[...s.sel.v],a=coords(s,ids),before=Math.hypot(...a[0].map((v,i)=>v-a[1][i]));
 s.numericTransform('rotate',2,90);s.numericCommit()
 const b=coords(s,ids),after=Math.hypot(...b[0].map((v,i)=>v-b[1][i]));near(after,before)
 near((a[0][0]+a[1][0])/2,(b[0][0]+b[1][0])/2)
})
test('NT-09 escala por eje respeta el centro de selección y no cambia el objeto',()=>{
 const {s}=fixture({indices:[0,1]});const ids=[...s.sel.v],orig=coords(s,ids);const center=orig[0].map((x,i)=>(x+orig[1][i])/2)
 const object={position:[3,4,5],rotation:[0,15,0],scale:[2,2,2]}
 s.numericTransform('scale',0,2);s.numericCommit()
 for(let j=0;j<2;j++)near(s.poly.v[ids[j]][0]-center[0],2*(orig[j][0]-center[0]))
 assert.deepEqual(object,{position:[3,4,5],rotation:[0,15,0],scale:[2,2,2]})
})
test('NT-10 vértice único no permite rotación ni escala engañosas',()=>{
 const {s,commits}=fixture();assert.equal(s.numericTransform('rotate',1,90),false);assert.equal(s.numericTransform('scale',2,2),false);assert.equal(commits.length,0)
})
test('NT-11 sin selección, valores inválidos o durante operación modal no edita',()=>{
 const {s}=fixture();s.sel.clear();assert.equal(s.numericTransform('move',0,2),false)
 s.sel.v.add(0);assert.equal(s.numericTransform('move',3,2),false);assert.equal(s.numericTransform('move',0,Infinity),false)
 s.modal={kind:'grab'};assert.equal(s.numericTransform('move',0,2),false)
})
test('NT-12 cancelar una edición no introduce commit ni deja geometría alterada',()=>{
 const {s,commits}=fixture({indices:[0,1]});const before=coords(s,[0,1]);s.numericTransform('move',0,5);s.numericCancel();
 assert.deepEqual(coords(s,[0,1]),before);assert.equal(commits.length,0)
})
test('NT-13 confirmación neutra no genera historial innecesario',()=>{
 const {s,commits}=fixture({indices:[0,1]});s.numericTransform('move',0,0);assert.equal(s.numericCommit(),false)
 s.numericTransform('scale',1,1);assert.equal(s.numericCommit(),false);assert.equal(commits.length,0)
})
test('NT-14 cambio de campo interrumpe el borrador anterior sin registrar historial',()=>{
 const {s,commits}=fixture({indices:[0,1]});const orig=coords(s,[0,1]);s.numericTransform('move',0,5)
 s.numericTransform('move',1,3);s.numericCommit();
 for(let i=0;i<2;i++)vecNear(s.poly.v[i],[orig[i][0],orig[i][1]+3,orig[i][2]])
 assert.equal(commits.length,1)
})
test('NT-15 simetría X sigue sincronizando pares de la malla',()=>{
 const {s}=fixture({poly:make('cube'),indices:[0]});store.edit.mirrorX=true
 const before=s.poly.v.map(p=>[...p]);
 s.numericTransform('position',1,s.poly.v[0][1]+1);s.numericCommit()
 const p=s.poly.v[0], partner=s.poly.v.find((v,i)=>i!==0&&Math.abs(v[0]+p[0])<1e-8&&Math.abs(v[1]-p[1])<1e-8&&Math.abs(v[2]-p[2])<1e-8)
 assert.ok(partner,'el vértice espejo se actualizó')
 store.edit.mirrorX=false
})
test('NT-16 edición proporcional usa el mismo cálculo de pesos del gizmo',()=>{
 const {s}=fixture({indices:[0]});store.edit.proportional=true;store.edit.propSize=5
 const b=coords(s,[0,1]);s.numericTransform('position',1,s.poly.v[0][1]+1);s.numericCommit()
 assert.ok(s.poly.v[1][1]-b[1][1]>0)
 assert.ok(s.poly.v[1][1]-b[1][1]<1)
 store.edit.proportional=false
})
test('NT-17 guardar/reabrir conserva los vértices, UV y el historial no cambia topología',()=>{
 const {s}=fixture({mode:'face',indices:[0]});const faces=s.poly.f.map(f=>[...f]);const uvs=s.poly.uv.map(x=>x.map(y=>[...y]))
 s.numericTransform('move',1,1.5);s.numericCommit()
 const reload=PolyMesh.fromJSON(JSON.parse(JSON.stringify(s.saved)))
 assert.deepEqual(reload.f,faces)
 assert.deepEqual(reload.uv,uvs)
 assert.deepEqual(reload.v,s.poly.v)
})
test('NT-18 edición numérica se cancela al cambiar selección, modo o iniciar modal',()=>{
 const sess=source('src/core/mesh/session.js'),pick=source('src/core/mesh/session-pick.js'),modal=source('src/core/mesh/session-modal.js'),xf=source('src/core/mesh/session-xform.js')
 assert.match(sess,/setMode\(m\)[\s\S]*?numericCancel/)
 assert.match(pick,/_selChanged\(\).*numericCancel/)
 assert.match(modal,/startModal\(kind[\s\S]*?numericCancel/)
 assert.doesNotMatch(xf,/_gizmoStart\(/)
})
test('NT-19 UI presenta XYZ absolutos o relativos, rotación y escala, con validación',()=>{
 const panel=source('src/components/MeshPanel.vue'),nf=source('src/components/NumberField.vue')
 assert.match(panel,/data-testid="mesh-numeric-transform"/)
 assert.match(panel,/numericPosition/)
 for(const kind of ['position','move','rotate','scale'])assert.ok(panel.includes(`numericEdit('${kind}', i, $event)`))
 assert.match(nf,/disabled: \{ type: Boolean, default: false \}/)
 assert.match(nf,/:disabled="disabled"/)
 assert.match(panel,/@commit="numericCommit"/)
})
test('NT-20 el gesto del campo es un commit después de uno o varios preview updates',()=>{
 const {s,commits,renders}=fixture({indices:[0,1]});s.numericTransform('move',0,1);s.numericTransform('move',0,1.5);s.numericTransform('move',0,1.75)
 assert.equal(commits.length,0);assert.equal(s.numericValue('move',0),1.75)
 s.numericCommit();assert.equal(commits.length,1);assert.equal(s.numericValue('move',0),0)
 assert.equal(renders.filter(v=>v==='refresh').length,4)
})
test('NT-21 precisión de coordenadas conserva ocho decimales al guardar y reabrir',()=>{
 const {s}=fixture();s.numericTransform('position',0,0.12345678);s.numericCommit()
 const json=s.poly.toJSON();assert.equal(json.v[0],0.12345678)
 const restored=PolyMesh.fromJSON(JSON.parse(JSON.stringify(json)))
 near(restored.v[0][0],0.12345678,1e-12)
})
test('NT-22 formato de PolyMesh con cinco decimales anterior sigue cargando',()=>{
 const m=make('cube'),old=m.toJSON();old.v[0]=0.12345
 assert.equal(PolyMesh.fromJSON(old).v[0][0],0.12345)
 assert.equal(PolyMesh.fromJSON(old).toJSON().v[0],0.12345)
})
