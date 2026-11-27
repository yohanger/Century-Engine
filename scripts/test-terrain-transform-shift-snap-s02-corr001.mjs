import { mergeEditorSettings } from '../src/core/state/editor-workspace.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { snapEnabled, snapStep, snapAxisValue, snapAbsolute, snapDelta } from '../src/core/editor/snap.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const store = { project: { settings: { moveSnapOn: true, rotateSnapOn: true, scaleSnapOn: true, gridSize: 1, rotSnap: 15, scaleSnap: 0.25 } }, play: { on: false }, locked: false }
const DEG = Math.PI / 180

class Vector3 {
  constructor(x=0,y=0,z=0) { this.x=x;this.y=y;this.z=z }
  clone(){ return new Vector3(this.x,this.y,this.z) }
  copy(v){ this.x=v.x;this.y=v.y;this.z=v.z;return this }
  set(x,y,z){ this.x=x;this.y=y;this.z=z;return this }
  applyQuaternion(q){
    const {x,y,z}=this,{x:qx,y:qy,z:qz,w:qw}=q
    const ix=qw*x+qy*z-qz*y,iy=qw*y+qz*x-qx*z,iz=qw*z+qx*y-qy*x,iw=-qx*x-qy*y-qz*z
    this.x=ix*qw+iw*-qx+iy*-qz-iz*-qy
    this.y=iy*qw+iw*-qy+iz*-qx-ix*-qz
    this.z=iz*qw+iw*-qz+ix*-qy-iy*-qx
    return this
  }
}
class Quaternion {
  constructor(x=0,y=0,z=0,w=1){ this.x=x;this.y=y;this.z=z;this.w=w }
  clone(){return new Quaternion(this.x,this.y,this.z,this.w)}
  copy(q){this.x=q.x;this.y=q.y;this.z=q.z;this.w=q.w;return this}
  invert(){this.x=-this.x;this.y=-this.y;this.z=-this.z;return this}
  normalize(){const n=Math.hypot(this.x,this.y,this.z,this.w);this.x/=n;this.y/=n;this.z/=n;this.w/=n;return this}
  setFromAxisAngle(axis,angle){const h=angle/2,k=Math.sin(h);this.x=axis.x*k;this.y=axis.y*k;this.z=axis.z*k;this.w=Math.cos(h);return this}
  multiply(q){const a=this.clone();this.x=a.x*q.w+a.w*q.x+a.y*q.z-a.z*q.y;this.y=a.y*q.w+a.w*q.y+a.z*q.x-a.x*q.z;this.z=a.z*q.w+a.w*q.z+a.x*q.y-a.y*q.x;this.w=a.w*q.w-a.x*q.x-a.y*q.y-a.z*q.z;return this}
  premultiply(q){return this.copy(q.clone().multiply(this))}
  slerpQuaternions(a,b,t){
    let dot=a.x*b.x+a.y*b.y+a.z*b.z+a.w*b.w
    const end=dot<0?{x:-b.x,y:-b.y,z:-b.z,w:-b.w}:b
    dot=Math.max(-1,Math.min(1,Math.abs(dot)))
    const angle=Math.acos(dot)
    if(angle<1e-8){this.x=a.x+t*(end.x-a.x);this.y=a.y+t*(end.y-a.y);this.z=a.z+t*(end.z-a.z);this.w=a.w+t*(end.w-a.w);return this.normalize()}
    const k=Math.sin((1-t)*angle)/Math.sin(angle),h=Math.sin(t*angle)/Math.sin(angle)
    this.x=a.x*k+end.x*h;this.y=a.y*k+end.y*h;this.z=a.z*k+end.z*h;this.w=a.w*k+end.w*h;return this.normalize()
  }
}
function object(p=[0,0,0], s=[1,1,1]) {
  const o={ position:new Vector3(...p),quaternion:new Quaternion(),scale:new Vector3(...s),
    updateMatrixWorld(){}, parent:{ updateMatrixWorld(){},updateWorldMatrix(){},localToWorld(v){return v},worldToLocal(v){return v} } }
  return o
}
function control(mode='translate', axis='X',space='world',o=object()) {
  const q=new Quaternion()
  o.getWorldQuaternion=(out)=>out.copy(q)
  return { object:o,mode,axis,space,dragging:true,_quaternionStart:q,rotationAxis:new Vector3(0,1,0),rotationAngle:0,
    setTranslationSnap(v){this.translationSnap=v},setRotationSnap(v){this.rotationSnap=v},setScaleSnap(v){this.scaleSnap=v} }
}
// Se prueba la implementación efectiva (no una reproducción de sus ecuaciones) con un adaptador de vectores
// que evita depender de una instalación de Three.js para la batería de contratos.
const gizmoSrc=readFileSync(resolve(root,'src/core/editor/gizmo.js'),'utf8')
  .replace(/^import .*$/gm,'').replace('export const gizmoMethods =','const gizmoMethods =')
const gizmoMethods=new Function('THREE','DEG','clamp','store','editorSettings','snapAxisValue','snapEnabled','snapStep','gizmoScale','syncPieces',`${gizmoSrc}\nreturn gizmoMethods`)(
  {Vector3,Quaternion},DEG,(n,min,max)=>Math.max(min,Math.min(max,n)),store,()=>mergeEditorSettings(store),snapAxisValue,snapEnabled,snapStep,(n)=>n,()=>{}
)
function editor(){return Object.assign({_shiftSnapHeld:false},gizmoMethods)}
const near=(n,target,eps=1e-8)=>assert.ok(Math.abs(n-target)<eps,`Esperado ${target}, obtenido ${n}`)
const angleY=q=>2*Math.atan2(q.y,q.w)


function terrainEditor(x=4.4,y=3.2,z=8.2, neighbor=null){
  const piece={id:'piece',name:'Terreno',ox:x,oy:y,oz:z,size:32,depth:32,enabled:true, setOffset(x,z,y){this.ox=x;this.oz=z;this.oy=y}}
  const proxy=object([x,y,z]);const tc=control('translate','XYZ','world',proxy)
  let renders=0
  const ed=Object.assign({_shiftSnapHeld:false,terrain:piece,terrains:neighbor?[piece,neighbor]:[piece],terrainProxy:proxy,tcTer:tc,vp:{requestRender(){renders++}}},gizmoMethods)
  return {ed,piece,proxy,tc,get renders(){return renders}}
}
function moveTo(s,x,y=s.proxy.position.y,z=s.proxy.position.z){
 s.proxy.position.x=x;s.proxy.position.y=y;s.proxy.position.z=z;s.ed._terrainGizmoMove()
}
function resetSettings(){store.project.settings={moveSnapOn:true,rotateSnapOn:true,scaleSnapOn:true,gridSize:1,rotSnap:15,scaleSnap:0.25}}

test('TSS-01: Terrain usa el ciclo de Snap existente, sin duplicar motor',()=>{
 assert.match(gizmoSrc,/t.addEventListener\('mouseDown', \(\) => \{\s*this\._beginSnapDrag\(t\)/)
 assert.match(gizmoSrc,/t.addEventListener\('objectChange', \(\) => this\._terrainGizmoMove\(\)\)/)
 assert.match(gizmoSrc,/this\._applySnapDrag\(this\.tcTer\)/)
 assert.match(gizmoSrc,/this\._endSnapDrag\(t\)/)
})
test('TSS-02: Snap normal cuantiza X, Y y Z; restitución del addon en mouseUp',()=>{
 resetSettings();const s=terrainEditor(4,2,7);s.ed._beginSnapDrag(s.tc)
 assert.equal(s.tc.translationSnap,null)
 moveTo(s,4.6,2.7,7.4);near(s.piece.ox,5);near(s.piece.oy,3);near(s.piece.oz,7)
 s.ed._endSnapDrag(s.tc);near(s.tc.translationSnap,1)
})
test('TSS-03: Shift sostenido desde el inicio desactiva Snap en tres ejes',()=>{
 resetSettings();const s=terrainEditor(4,2,7)
 s.ed._setSnapShiftHeld(true);s.ed._beginSnapDrag(s.tc)
 moveTo(s,4.6,2.7,7.4);near(s.piece.ox,4.6);near(s.piece.oy,2.7);near(s.piece.oz,7.4)
 s.ed._endSnapDrag(s.tc);assert.equal(store.project.settings.moveSnapOn,true)
})
test('TSS-04: alternar Shift durante gesto no cambia posición sin movimiento',()=>{
 resetSettings();const s=terrainEditor(0,1,0);s.tc.axis='X';s.ed._beginSnapDrag(s.tc)
 moveTo(s,1.8);near(s.piece.ox,2)
 s.ed._setSnapShiftHeld(true);near(s.piece.ox,2)
 moveTo(s,1.8);near(s.piece.ox,2)
 moveTo(s,2.12);near(s.piece.ox,2.32)
 s.ed._setSnapShiftHeld(false);near(s.piece.ox,2.32)
 moveTo(s,2.12);near(s.piece.ox,2.32)
 moveTo(s,2.65);near(s.piece.ox,3.32)
 s.ed._endSnapDrag(s.tc)
})
test('TSS-05: imán entre piezas se desactiva con Shift y se conserva sin Shift',()=>{
 resetSettings();store.project.settings.moveSnapOn=false
 const neighbor={id:'other',ox:82,oy:0,oz:0,size:32,depth:32,enabled:true}
 const s=terrainEditor(45,0,0,neighbor);s.tc.axis='X';s.ed._beginSnapDrag(s.tc)
 moveTo(s,50.4);near(s.piece.ox,50)
 s.ed._setSnapShiftHeld(true);near(s.piece.ox,50)
 moveTo(s,50.4);near(s.piece.ox,50)
 moveTo(s,50.6);near(s.piece.ox,50.2)
 s.ed._endSnapDrag(s.tc)
 resetSettings()
})
test('TSS-06: Shift desde mouseDown anula imán sin alterar preferencias',()=>{
 resetSettings();store.project.settings.moveSnapOn=false
 const neighbor={id:'other',ox:82,oy:0,oz:0,size:32,depth:32,enabled:true}
 const s=terrainEditor(45,0,0,neighbor);s.tc.axis='X';s.ed._setSnapShiftHeld(true);s.ed._beginSnapDrag(s.tc)
 moveTo(s,50.4);near(s.piece.ox,50.4);s.ed._endSnapDrag(s.tc)
 assert.equal(store.project.settings.moveSnapOn,false);resetSettings()
})
test('TSS-07: el paso efectivo respeta moveSnapOn, no el legado settings.snap',()=>{
 resetSettings();store.project.settings.moveSnapOn=false;store.project.settings.snap=true
 const s=terrainEditor(3,5,8);s.ed._beginSnapDrag(s.tc)
 moveTo(s,3.73,5.26,8.88);near(s.piece.ox,3.73);near(s.piece.oy,5.26);near(s.piece.oz,8.88)
 s.ed._endSnapDrag(s.tc);resetSettings()
})
test('TSS-08: paso configurable de la rejilla aplicado a Terrain',()=>{
 resetSettings();store.project.settings.gridSize=.25
 const s=terrainEditor(0,0,0);s.ed._beginSnapDrag(s.tc)
 moveTo(s,.31,.39,.61);near(s.piece.ox,.25);near(s.piece.oy,.5);near(s.piece.oz,.5)
 s.ed._endSnapDrag(s.tc);near(s.tc.translationSnap,.25);resetSettings()
})
test('TSS-09: Shift liberado en blur y en keyup mediante control central existente',()=>{
 const keys=readFileSync(resolve(root,'src/core/editor/keys.js'),'utf8')
 assert.match(keys,/win.addEventListener\('keyup', onShiftUp, true\)/)
 assert.match(keys,/win.addEventListener\('blur', releaseShift\)/)
 assert.match(keys,/this\._setSnapShiftHeld\(false\)/)
 assert.match(gizmoSrc,/if \(!this\._shiftSnapHeld\) \[x, z\] = this\._snapPiece\(t, x, z\)/)
})
test('TSS-10: una sola transacción al finalizar movimiento real, no al hacer clic',()=>{
 assert.match(gizmoSrc,/this\._terrainMoveStart = piece && \{ id: piece\.id, x: piece\.ox, y: piece\.oy, z: piece\.oz \}/)
 assert.match(gizmoSrc,/if \(!piece \|\| \(piece\.ox === start\.x && piece\.oy === start\.y && piece\.oz === start\.z\)\) return/)
 assert.match(gizmoSrc,/commitTerrain\(`Mover \$\{piece\.name\}`\)/)
})
test('TSS-11: cierre/ocultación del gizmo liberan gesto y mantienen el resto del editor',()=>{
 assert.match(gizmoSrc,/this\._endSnapDrag\(this\.tcTer\)/)
 assert.match(gizmoSrc,/this\.tcTer\.detach\(\)/)
 assert.match(gizmoSrc,/this\._terrainMoveStart = null/)
})
test('TSS-12: sin modificar Terrain, escenas, Jolt, cuatro bordes ni Snap persistente',()=>{
 assert.doesNotMatch(gizmoSrc,/settings\.(?:snap|moveSnapOn|gridSize)\s*=/)
 assert.match(gizmoSrc,/t\.setOffset\(x, z, y\)/)
 assert.match(gizmoSrc,/cells !== d\.cells && t\.previewEdge\(d\.side, cells\)/)
})
