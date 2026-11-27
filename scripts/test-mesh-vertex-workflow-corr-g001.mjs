// LF-MESH-VERTEX-WORKFLOW-CORR-G001 — proyección geométrica y cadena reales, sin navegador.
import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { make } from '../src/engine/runtime/mesh/generators.js'
import { PolyMesh } from '../src/engine/runtime/mesh/polymesh.js'
import { Sel } from '../src/core/mesh/sel.js'
import * as O from '../src/core/mesh/ops.js'
const read=p=>readFileSync(new URL(`../src/${p}`, import.meta.url),'utf8')
const session=read('core/mesh/session.js'),panel=read('components/MeshPanel.vue'),input=read('core/mesh/session-input.js')
class V {
 constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z})}
 setComponent(i,v){this[['x','y','z'][i]]=v;return this}
 getComponent(i){return this[['x','y','z'][i]]}
 clone(){return new V(this.x,this.y,this.z)}
 toArray(){return [this.x,this.y,this.z]}
 applyMatrix4(m){const [x,y,z]=this.toArray(),c=Math.cos(m.yaw),s=Math.sin(m.yaw);this.x=m.x+c*x*m.sx+s*z*m.sz;this.y=m.y+y*m.sy;this.z=m.z-s*x*m.sx+c*z*m.sz;return this}
 applyNormalMatrix(m){const [x,y,z]=this.toArray(),a=m.m,c=Math.cos(a.yaw),s=Math.sin(a.yaw);this.x=c*x/a.sx+s*z/a.sz;this.y=y/a.sy;this.z=-s*x/a.sx+c*z/a.sz;return this}
 normalize(){const n=Math.hypot(this.x,this.y,this.z);if(n){this.x/=n;this.y/=n;this.z/=n}return this}
 copy(p){Object.assign(this,{x:p.x,y:p.y,z:p.z});return this}
}
class M3 {getNormalMatrix(m){this.m=m;return this}}
class P {setFromNormalAndCoplanarPoint(n,p){this.n=n;this.p=p;return this}}
function ray(origin,direction){return {intersectPlane(plane,dst){const {n,p}=plane;const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;const denom=dot(n,direction);if(Math.abs(denom)<1e-7)return null;const diff=new V(p.x-origin.x,p.y-origin.y,p.z-origin.z),t=dot(n,diff)/denom;if(t<0)return null;dst.x=origin.x+direction.x*t;dst.y=origin.y+direction.y*t;dst.z=origin.z+direction.z*t;return dst}}}
const start=session.indexOf('  setVertexPlane(plane) {'),end=session.indexOf('  /** Enlaza dos puntos',start)
assert.ok(start>0&&end>start)
const store={edit:{vertexPlane:'XZ',vertexDraw:true,paint:{active:false}},space:'world',project:{settings:{moveSnapOn:false,gridSize:1}}}
const methodSource=session.slice(start,end).replace(/\n  }(?=\s*(?:\/\*\*|[a-z_]\w*\())/g, '\n  },')
const methods=vm.runInNewContext('({'+methodSource+'})',{THREE:{Vector3:V,Matrix3:M3,Plane:P},store,toast:()=>{},snapEnabled:(s)=>s.moveSnapOn,snapStep:s=>s.gridSize,O})
function fixture({yaw=0,sx=1,sy=1,sz=1,tx=0,ty=0,tz=0,first=[0,0,0],from=true}={}){
 const m={yaw,sx,sy,sz,x:tx,y:ty,z:tz}
 const mesh=make('vertex');mesh.v[0]=[...first]
 const selection=new Sel();if(from)selection.v.add(0)
 const v={matrixWorld:m,updateWorldMatrix(){},worldToLocal(p){const x=p.x-m.x,y=p.y-m.y,z=p.z-m.z,c=Math.cos(yaw),s=Math.sin(yaw);p.x=(c*x-s*z)/sx;p.y=y/sy;p.z=(s*x+c*z)/sz;return p}}
 const previewArr=new Float32Array(18)
 const attribute={setXYZ(i,x,y,z){previewArr.set([x,y,z],i*3)},set needsUpdate(v){this.updated=v}}
 const preview={visible:false,geometry:{getAttribute:()=>attribute}}
 const counts={undo:0,render:0}
 const sessionInstance={...methods,visual:v,poly:mesh,sel:selection,mode:'vertex',modal:null,paintStroke:null,preview,vp:{requestRender(){counts.render++},isNavigating:false},_shiftSnapHeld:false,_ray:()=>ray(new V(1,5,3),new V(0,-1,0)),run(label,fn){counts.undo++;const response=fn(mesh,selection,'vertex');if(typeof response==='string')return response;return true}}
 return {s:sessionInstance,mesh,selection,preview,previewArr,counts}
}
const approx=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`)
function reset(){store.edit.vertexPlane='XZ';store.edit.vertexDraw=true;store.space='world';store.project.settings={moveSnapOn:false,gridSize:1}}
test('VW-01: selector acepta XZ, XY y YZ sin afectar geometría',()=>{reset();const f=fixture();for(const p of ['XZ','XY','YZ'])assert.equal(f.s.setVertexPlane(p),true);assert.equal(f.mesh.v.length,1);assert.equal(f.counts.undo,0)})
test('VW-02: plano inválido no modifica la selección',()=>{reset();const f=fixture();assert.equal(f.s.setVertexPlane('auto'),false);assert.equal(store.edit.vertexPlane,'XZ')})
test('VW-03: XZ fija Y al vértice seleccionado, incluso si este no está en Y=0',()=>{reset();const f=fixture({first:[0,2,0]});f.s._ray=()=>ray(new V(1,8,3),new V(0,-1,0));const p=f.s._vertexPlacement(0,0);approx(p.local.y,2);approx(p.local.x,1);approx(p.local.z,3)})
test('VW-04: XY fija Z y permite pared vertical desde cámara frontal',()=>{reset();store.edit.vertexPlane='XY';const f=fixture({first:[0,0,4]});f.s._ray=()=>ray(new V(2,3,12),new V(0,0,-1));const p=f.s._vertexPlacement(0,0);approx(p.local.z,4);approx(p.local.x,2);approx(p.local.y,3)})
test('VW-05: YZ fija X y permite pared lateral',()=>{reset();store.edit.vertexPlane='YZ';const f=fixture({first:[2,0,0]});f.s._ray=()=>ray(new V(12,3,4),new V(-1,0,0));const p=f.s._vertexPlacement(0,0);approx(p.local.x,2);approx(p.local.y,3);approx(p.local.z,4)})
test('VW-06: el rayo paralelo no produce vértice ni error',()=>{reset();const f=fixture();f.s._ray=()=>ray(new V(0,2,0),new V(1,0,0));assert.equal(f.s._vertexPlacement(0,0),null);assert.equal(f.mesh.v.length,1)})
test('VW-07: plano XZ local gira con padre, sin interpretar el espacio world',()=>{reset();store.space='local';store.edit.vertexPlane='XY';const f=fixture({yaw:Math.PI/2,tx:4});f.s._ray=()=>ray(new V(8,3,2),new V(-1,0,0));const p=f.s._vertexPlacement(0,0);approx(p.local.z,0);approx(p.local.x,-2);approx(p.local.y,3)})
test('VW-08: snap global conserva profundidad XZ distinta del múltiplo de rejilla',()=>{reset();store.project.settings.moveSnapOn=true;store.project.settings.gridSize=1;const f=fixture({first:[0,1.3,0]});f.s._ray=()=>ray(new V(1.7,7,2.6),new V(0,-1,0));const p=f.s._vertexPlacement(0,0);assert.deepEqual(Array.from(p.local.toArray()),[2,1.3,3])})
test('VW-09: snap local respeta el eje perpendicular del plano XY',()=>{reset();store.space='local';store.edit.vertexPlane='XY';store.project.settings.moveSnapOn=true;const f=fixture({first:[0,0,0.8]});f.s._ray=()=>ray(new V(1.7,2.4,7),new V(0,0,-1));assert.deepEqual(Array.from(f.s._vertexPlacement(0,0).local.toArray()),[2,2,0.8])})
test('VW-10: Shift suspende Snap durante el cálculo de previsualización',()=>{reset();store.project.settings.moveSnapOn=true;const f=fixture();f.s._shiftSnapHeld=true;const p=f.s._vertexPlacement(0,0);approx(p.local.x,1);approx(p.local.z,3);f.s._ray=()=>ray(new V(1.35,5,3.25),new V(0,-1,0));const q=f.s._vertexPlacement(0,0);approx(q.local.x,1.35);approx(q.local.z,3.25)})
test('VW-11: preview actualiza solo buffer temporal; no muta PolyMesh ni historial',()=>{reset();const f=fixture();const baseline=JSON.stringify(f.mesh.toJSON());f.s._previewVertexFromScreen(0,0);assert.equal(f.preview.visible,true);assert.deepEqual(Array.from(f.previewArr.slice(0,6)),[0,0,0,1,0,3]);assert.equal(JSON.stringify(f.mesh.toJSON()).replace(/"rev":\d+/, '"rev":0'),baseline.replace(/"rev":\d+/, '"rev":0'));assert.equal(f.counts.undo,0)})
test('VW-12: preview oculta cuando el trazado deja de estar activo',()=>{reset();const f=fixture();f.s._previewVertexFromScreen(0,0);store.edit.vertexDraw=false;f.s._previewVertexFromScreen(0,0);assert.equal(f.preview.visible,false)})
test('VW-13: colocar vértice usa misma proyección, conecta origen y genera un único Undo',()=>{reset();const f=fixture();assert.equal(f.s._placeVertexFromScreen(0,0),true);assert.deepEqual(f.mesh.v[1],[1,0,3]);assert.deepEqual(f.mesh.we,[[0,1]]);assert.equal(f.counts.undo,1);assert.deepEqual([...f.selection.v],[1])})
test('VW-14: proyección en plano inválido no registra Undo ni modifica vertices',()=>{reset();const f=fixture();f.s._ray=()=>ray(new V(1,3,0),new V(1,0,0));assert.equal(f.s._placeVertexFromScreen(0,0),false);assert.equal(f.counts.undo,0);assert.equal(f.mesh.v.length,1)})
test('VW-15: malla serializada conserva aristas sueltas y no fabrica caras',()=>{reset();const f=fixture();f.s._placeVertexFromScreen(0,0);const restored=PolyMesh.fromJSON(f.mesh.toJSON());assert.deepEqual(restored.we,[[0,1]]);assert.deepEqual(restored.f,[])})
test('VW-16: UI usa panel Edit Mode y botones XZ XY YZ, sin nuevo nodo ni segunda fuente',()=>{assert.match(panel,/data-testid="mesh-vertex-draw"/);assert.match(panel,/setVertexPlane\(plane\)/);assert.match(panel,/\['XZ', 'XY', 'YZ'\]/);assert.match(read('core/state/state.js'),/vertexPlane: 'XZ'/)})
test('VW-17: selección Shift/Ctrl, Escape y navegado conservan rutas existentes',()=>{assert.match(input,/!d\.e\.altKey && !d\.e\.shiftKey && !d\.e\.ctrlKey/);assert.match(input,/this\._hideVertexPreview\(\)/);assert.match(input,/this\.vp\.isNavigating/);assert.match(input,/e\.key === 'Escape'/)})
test('VW-18: se conserva API de Fill/Extrude y la geometría no nace de una previsualización',()=>{assert.match(read('core/mesh/ops-fill.js'),/export function fill\(/);assert.match(read('core/mesh/ops-edit.js'),/export function extrudeSolid\(/);assert.match(session,/this\.run\('Colocar vértice'/);assert.doesNotMatch(session,/new PolyMesh\(/)})
