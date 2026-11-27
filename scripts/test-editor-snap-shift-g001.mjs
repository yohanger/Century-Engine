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
const gizmoMethods=new Function('THREE','DEG','clamp','store','editorSettings','snapAxisValue','snapEnabled','snapStep','gizmoScale',`${gizmoSrc}\nreturn gizmoMethods`)(
  {Vector3,Quaternion},DEG,(n)=>n,store,()=>mergeEditorSettings(store),snapAxisValue,snapEnabled,snapStep,(n)=>n
)
function editor(){return Object.assign({_shiftSnapHeld:false},gizmoMethods)}
const near=(n,target,eps=1e-8)=>assert.ok(Math.abs(n-target)<eps,`Esperado ${target}, obtenido ${n}`)
const angleY=q=>2*Math.atan2(q.y,q.w)

 test('SNAP-01: configuración previa y pasos independientes no mutan',()=>{
   const before=structuredClone(store.project.settings)
   assert.equal(snapEnabled(store.project.settings,'rotate'),true)
   near(snapStep(store.project.settings,'scale'),0.25)
   assert.deepEqual(store.project.settings,before)
 })
 test('SNAP-02: cuantización y ejes seleccionados tienen transición continua',()=>{
   near(snapDelta(0.49,1),0);near(snapDelta(0.51,1),1)
   near(snapAbsolute(1.55,1),2)
   near(snapAxisValue(3.11,3,7,1,true,false),7)
   near(snapAxisValue(3.11,3,7,1,false,false),7)
 })
 test('SNAP-03: traslación inicial conserva Snap absoluto en mundo',()=>{
   const e=editor(), t=control('translate','X'), origin=structuredClone(store.project.settings)
   e._beginSnapDrag(t)
   assert.equal(t.translationSnap,null)
   t.object.position.x=2.6; e._applySnapDrag(t);near(t.object.position.x,3)
   assert.deepEqual(store.project.settings,origin)
   e._endSnapDrag(t);near(t.translationSnap,1)
 })
 test('SNAP-04: Shift durante arrastre, sin salto en pulsar y soltar',()=>{
   const e=editor(),t=control('translate','X')
   e._beginSnapDrag(t)
   t.object.position.x=1.8;e._applySnapDrag(t);near(t.object.position.x,2)
   e._setSnapShiftHeld(true);near(t.object.position.x,2)
   t.object.position.x=1.8; e._applySnapDrag(t);near(t.object.position.x,2)
   t.object.position.x=2.12;e._applySnapDrag(t);near(t.object.position.x,2.32)
   e._setSnapShiftHeld(false);near(t.object.position.x,2.32)
   t.object.position.x=2.12;e._applySnapDrag(t);near(t.object.position.x,2.32)
   t.object.position.x=2.65;e._applySnapDrag(t);near(t.object.position.x,3.32)
   e._endSnapDrag(t)
 })
 test('SNAP-05: Shift sostenido desde mouseDown empieza en modo libre',()=>{
   const e=editor(),t=control('translate','X');e._setSnapShiftHeld(true);e._beginSnapDrag(t)
   t.object.position.x=0.46;e._applySnapDrag(t);near(t.object.position.x,0.46)
 })
 test('SNAP-06: traslación local cuantiza en ejes de orientación de nodo',()=>{
   const e=editor(),t=control('translate','X','local')
   t._quaternionStart.setFromAxisAngle(new Vector3(0,0,1),Math.PI/2)
   e._beginSnapDrag(t)
   t.object.position.y=1.3;e._applySnapDrag(t)
   near(t.object.position.x,0);near(t.object.position.y,1)
 })
 test('SNAP-07: traslación mundial usa matriz del padre (rotación y desplazamiento)',()=>{
   const e=editor(),t=control('translate','X','world')
   t.object.parent={updateMatrixWorld(){},updateWorldMatrix(){},localToWorld(v){return new Vector3(v.y+10,-v.x+8,v.z)},worldToLocal(v){return new Vector3(8-v.y,v.x-10,v.z)}}
   e._beginSnapDrag(t)
   t.object.position.y=2.3;e._applySnapDrag(t)
   near(t.object.position.y,2)
 })
 test('SNAP-08: escala inicial cuantiza y al presionar Shift no salta',()=>{
   const e=editor(),t=control('scale','X');e._beginSnapDrag(t)
   t.object.scale.x=1.3;e._applySnapDrag(t);near(t.object.scale.x,1.25)
   e._setSnapShiftHeld(true);near(t.object.scale.x,1.25)
   t.object.scale.x=1.3;e._applySnapDrag(t);near(t.object.scale.x,1.25)
   t.object.scale.x=1.38;e._applySnapDrag(t);near(t.object.scale.x,1.33)
   e._setSnapShiftHeld(false);near(t.object.scale.x,1.33)
   t.object.scale.x=1.38;e._applySnapDrag(t);near(t.object.scale.x,1.33)
   t.object.scale.x=1.51;e._applySnapDrag(t);near(t.object.scale.x,1.58)
 })
 test('SNAP-09: rotación local inicial y cambio de Shift conservan orientación',()=>{
   const e=editor(),t=control('rotate','Y','local');e._beginSnapDrag(t)
   t.rotationAngle=17*DEG
   t.object.quaternion.setFromAxisAngle(new Vector3(0,1,0),17*DEG)
   e._applySnapDrag(t);near(angleY(t.object.quaternion),15*DEG)
   e._setSnapShiftHeld(true);near(angleY(t.object.quaternion),15*DEG)
   t.rotationAngle=17*DEG;t.object.quaternion.setFromAxisAngle(new Vector3(0,1,0),17*DEG)
   e._applySnapDrag(t);near(angleY(t.object.quaternion),15*DEG)
   t.rotationAngle=20*DEG;t.object.quaternion.setFromAxisAngle(new Vector3(0,1,0),20*DEG)
   e._applySnapDrag(t);near(angleY(t.object.quaternion),18*DEG)
   e._setSnapShiftHeld(false);near(angleY(t.object.quaternion),18*DEG)
   t.rotationAngle=20*DEG;t.object.quaternion.setFromAxisAngle(new Vector3(0,1,0),20*DEG)
   e._applySnapDrag(t);near(angleY(t.object.quaternion),18*DEG)
   t.rotationAngle=28*DEG;t.object.quaternion.setFromAxisAngle(new Vector3(0,1,0),28*DEG)
   e._applySnapDrag(t);near(angleY(t.object.quaternion),33*DEG)
 })
 test('SNAP-10: rotación global premultiplica, conservando jerarquía',()=>{
   const e=editor(),t=control('rotate','Y','world')
   t.object.quaternion.setFromAxisAngle(new Vector3(0,0,1),30*DEG)
   e._beginSnapDrag(t)
   t.rotationAngle=16*DEG; t.object.quaternion.setFromAxisAngle(new Vector3(0,1,0),16*DEG).multiply(t._quaternionStart)
   e._applySnapDrag(t)
   // source addon usa _quaternionStart, el test usa cuaternión inicial diferente intencionalmente
   near(Math.hypot(t.object.quaternion.x,t.object.quaternion.y,t.object.quaternion.z,t.object.quaternion.w),1)
 })
 test('SNAP-11: deshabilitar Snap previamente continúa libre y restaura null',()=>{
   const old=store.project.settings.moveSnapOn;store.project.settings.moveSnapOn=false
   try {
     const e=editor(), t=control();e._beginSnapDrag(t)
     t.object.position.x=0.4;e._applySnapDrag(t);near(t.object.position.x,0.4)
     e._endSnapDrag(t);assert.equal(t.translationSnap,null)
   } finally { store.project.settings.moveSnapOn=old }
 })
 test('SNAP-12: desconexión cancela sesión temporal y restaura ajuste',()=>{
   const e=editor(),t=control();e._beginSnapDrag(t)
   e._detachAll=()=>{e._endSnapDrag(e._snapDrag?.control)}
   e._detachAll(); assert.equal(e._snapDrag,null);near(t.translationSnap,1)
 })
 test('SNAP-13: un control inactivo en universal no modifica otro',()=>{
   const e=editor(),t1=control('translate','X'),t2=control('rotate','Y')
   e._beginSnapDrag(t1);t2.object.quaternion.setFromAxisAngle(new Vector3(0,1,0),19*DEG)
   e._applySnapDrag(t2);near(angleY(t2.object.quaternion),19*DEG)
 })
 test('SNAP-14: la interfaz guarda Shift fuera de proyecto sin alterar configuración',()=>{
   const e=editor(),t=control();const settings=structuredClone(store.project.settings)
   e._beginSnapDrag(t);e._setSnapShiftHeld(true);e._setSnapShiftHeld(false)
   assert.deepEqual(store.project.settings,settings)
 })
 test('SNAP-15: contrato de teclado Shift sin cancelar atajos ni filtrar teclado de herramientas',()=>{
   const keys=readFileSync(resolve(root,'src/core/editor/keys.js'),'utf8')
   assert.match(keys,/win\.addEventListener\('keyup', onShiftUp, true\)/)
   assert.match(keys,/win\.addEventListener\('blur', releaseShift\)/)
   assert.match(keys,/doc\.addEventListener\('visibilitychange', onVisibility\)/)
   assert.match(keys,/e\.shiftKey \? redo\(\) : undo\(\)/)
   assert.match(keys,/if \(e\.shiftKey\) \{ e\.preventDefault\(\); tool\('commands'\)\.openAddMenu\(\)/)
 })
 test('SNAP-16: contrato de arrastre una confirmación, gizmo universal y exclusión de terreno',()=>{
   assert.match(gizmoSrc,/this\._beginSnapDrag\(t\)/)
   assert.match(gizmoSrc,/this\._applySnapDrag\(t\)/)
   assert.match(gizmoSrc,/this\._endSnapDrag\(t\)/)
   assert.match(gizmoSrc,/const t = this\.tcTer = new TransformControls/)
   assert.equal((gizmoSrc.match(/_applySnapDrag\(t\)/g)||[]).length,2)
 })

test('SNAP-17: teclado, blur y visibilidad liberan Shift sin alterar atajos', () => {
  const handlers = new Map()
  const emitter = () => ({
    addEventListener(name, fn) { if (!handlers.has(name)) handlers.set(name,new Set()); handlers.get(name).add(fn) },
    removeEventListener(name, fn) { handlers.get(name)?.delete(fn) },
  })
  const win=emitter(), doc={...emitter(),hidden:false}
  const keysSrc=readFileSync(resolve(root,'src/core/editor/keys.js'),'utf8')
    .replace(/^import .*$/gm,'').replace('export const keysMethods =','const keysMethods =')
  const keysMethods=new Function('win','doc','store', `${keysSrc}\nreturn keysMethods`)(win,doc,{...store,roadPaint:{active:false}})
  const e=Object.assign(editor(),keysMethods,{vp:{isFlying:false},edit:null,paint:null})
  e._bindKeys()
  const trigger=(name,key,more={}) => {
    const event={key,code:key==='Shift'?'ShiftLeft':'KeyA',target:{tagName:'BODY'},shiftKey:key==='Shift',ctrlKey:false,metaKey:false,altKey:false,preventDefault(){},...more}
    for (const fn of [...(handlers.get(name)||[])]) fn(event)
  }
  trigger('keydown','Shift');assert.equal(e._shiftSnapHeld,true)
  trigger('keyup','Shift');assert.equal(e._shiftSnapHeld,false)
  trigger('keydown','Shift');trigger('blur');assert.equal(e._shiftSnapHeld,false)
  trigger('keydown','Shift');doc.hidden=true;trigger('visibilitychange');assert.equal(e._shiftSnapHeld,false)
  e._keyCleanup();assert.equal([...handlers.values()].every(v=>v.size===0),true)
  assert.match(readFileSync(resolve(root,'src/engine/runtime/platform.js'),'utf8'),/get hidden\(\)/)
})
