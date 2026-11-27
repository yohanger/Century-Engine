import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { ContinuousGrab } from '../src/core/editor/continuous-grab.js'
import { acquirePointer } from '../src/engine/runtime/input/pointer-capture.js'
const read=p=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8').replace(/^import .*$/gm,'').replace(/export const /g,'const ')
class Vec {
 constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}
 copy(v){Object.assign(this,v);return this} add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this}
 addScaledVector(v,s){return this.add(new Vec(v.x*s,v.y*s,v.z*s))} distanceTo(v){return Math.hypot(this.x-v.x,this.y-v.y,this.z-v.z)}
 lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z} multiplyScalar(s){this.x*=s;this.y*=s;this.z*=s;return this}
 normalize(){return this.multiplyScalar(1/Math.sqrt(this.lengthSq()))} applyQuaternion(){return this}
}
class Target {
 constructor(){this.handlers=new Map()}
 addEventListener(k,f,capture){this.handlers.set(k,[...(this.handlers.get(k)||[]),{f,capture:!!capture}])}
 removeEventListener(k,f){this.handlers.set(k,(this.handlers.get(k)||[]).filter(h=>h.f!==f))}
 emit(k,e={}){for(const {f} of [...(this.handlers.get(k)||[])].sort((a,b)=>Number(b.capture)-Number(a.capture)))f(e)}
}
function fixture({selected=true,asyncLock=false,asyncRelease=false}={}){
 const doc=new Target(),win=new Target(),dom=new Target(),parent=new Target();doc.defaultView=win;doc.hidden=false;doc.pointerLockElement=null;dom.ownerDocument=doc;dom.parentElement=parent;dom.style={};dom.isConnected=true;dom.clientHeight=200;dom.getBoundingClientRect=()=>({left:0,top:0,width:300,height:200});parent.getBoundingClientRect=()=>({left:0,top:0});parent.appendChild=e=>e.parentElement=parent;doc.createElement=()=>({style:{},setAttribute(){},remove(){}});dom.focus=()=>{doc.activeElement=dom}
 let captured=null,pending=false,resolveLock,rejectLock,addonCaptures=0,addonErrors=0,allow=true
 const unlock=()=>{doc.pointerLockElement=null;doc.emit('pointerlockchange')}
 doc.exitPointerLock=()=>{if(!asyncRelease)unlock()}
 dom.setPointerCapture=id=>{if(pending||doc.pointerLockElement)throw new DOMException('captura incompatible','InvalidStateError');captured=id};dom.hasPointerCapture=id=>captured===id;dom.releasePointerCapture=id=>{if(captured===id)captured=null}
 const grant=()=>{pending=false;doc.pointerLockElement=dom;resolveLock?.();doc.emit('pointerlockchange')}
 dom.requestPointerLock=()=>{pending=true;if(!asyncLock){grant();return}return new Promise((resolve,reject)=>{resolveLock=resolve;rejectLock=reject})}
 const deny=()=>{pending=false;rejectLock(new Error('denied'));doc.emit('pointerlockerror')}
 const nav=runInNewContext(read('engine/runtime/render/viewport-nav.js')+'\nnavMethods',{THREE:{Vector3:Vec},clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),acquirePointer,queueMicrotask,window:win})
 const gizmos=runInNewContext(read('core/editor/gizmo.js')+'\ngizmoMethods',{queueMicrotask})
 const controls={enabled:true,target:new Vec(),update(){},rotateSpeed:1,panSpeed:1}
 const vp=Object.assign({dom,controls,camera:{position:new Vec(0,0,10),quaternion:{}},playing:false,_space:false,_flying:false,_keys:new Set(),_flySpeed:14,requestRender(){}},nav);Object.defineProperty(vp,'isFlying',{get:()=>vp._flying});vp._flyRotate=()=>{}
 const grab=new ContinuousGrab(dom);vp.setEditNavigation(()=>true,grab)
 const t={object:selected?{}:null,enabled:selected,helper:{visible:selected}},terrain={object:null,enabled:false}
 const ed={vp,tcTer:terrain,_tcs:()=>[t],_updateGizmoMode(){t.enabled=!!t.object},_setFlyGizmoInput:gizmos._setFlyGizmoInput}
 vp._onFlyInput=active=>ed._setFlyGizmoInput?.(active);vp._canStartFly=()=>allow
 vp._bindFly();vp._bindContinuousNavigation()
 // Colaborador de captura posterior: conserva el orden del addon y el contrato DOM.
 dom.addEventListener('pointerdown',e=>{if(t.enabled&&!doc.pointerLockElement){try{dom.setPointerCapture(e.pointerId);addonCaptures++}catch{addonErrors++}}})
 const e=(button=2)=>({button,pointerId:1,clientX:50,clientY:50,preventDefault(){},stopPropagation(){}})
 const down=()=>dom.emit('pointerdown',e()),up=()=>dom.emit('pointerup',e());const key=(code='KeyW')=>{const event={code,key:code.slice(-1).toLowerCase(),target:dom,prevented:false,preventDefault(){this.prevented=true},stopPropagation(){}};win.emit('keydown',event);return event}
 const lose=()=>{captured=null;dom.emit('lostpointercapture',e())}
 return {vp,doc,dom,win,t,ed,grab,down,up,key,grant,deny,lose,unlock,disallow(){allow=false},get errors(){return addonErrors},get captures(){return addonCaptures},dispose(){vp._stopContinuousNavigation(true);vp._continuousNavigationCleanup();vp._flyCleanup();grab.dispose()}}
}
const settle=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve()}
test('El gizmo seleccionado no compite por la captura de vuelo ni se oculta',async()=>{const f=fixture({asyncLock:true});try{f.down();assert.equal(f.vp.isFlying,true);assert.equal(f.errors,0);assert.equal(f.t.enabled,false);assert.equal(f.t.helper.visible,true);f.grant();await settle();assert.equal(f.key().prevented,true);f.vp._flyStep(.1);assert.equal(f.vp.camera.position.z,8.6);f.up();await settle();assert.equal(f.t.enabled,true);assert.ok(f.t.object);assert.equal(f.vp._keys.size,0)}finally{f.dispose()}})
test('La pérdida de Pointer Capture al adquirir el bloqueo no termina el vuelo',async()=>{const f=fixture({asyncLock:true});try{f.down();f.lose();f.grant();await settle();assert.equal(f.vp.isFlying,true);assert.equal(f.key().prevented,true);assert.equal(f.grab.locked,true);f.up();await settle();assert.equal(f.vp.isFlying,false)}finally{f.dispose()}})
test('Denegación asíncrona conserva vuelo y entrada WASD con captura nativa',async()=>{const f=fixture({selected:false,asyncLock:true});try{f.down();f.deny();await settle();assert.equal(f.vp.isFlying,true);assert.equal(f.grab.active,false);assert.equal(f.dom.hasPointerCapture(1),true);f.key();f.vp._flyStep(.1);assert.equal(f.vp.camera.position.z,8.6);f.up();assert.equal(f.vp.isFlying,false)}finally{f.dispose()}})
test('Nuevo vuelo durante liberación de un bloqueo propio no exige deseleccionar',async()=>{const f=fixture({asyncRelease:true});try{f.grab.begin({x:50,y:50},()=>{},()=>{});f.grab.end();assert.equal(f.doc.pointerLockElement,f.dom);f.down();assert.equal(f.vp.isFlying,true);f.unlock();await settle();assert.equal(f.dom.hasPointerCapture(1),true);assert.equal(f.key().prevented,true);f.up();await settle();assert.equal(f.t.enabled,true)}finally{f.dispose()}})
test('Bloqueo ajeno y operación activa no son apropiados por el vuelo',()=>{const f=fixture({selected:false});try{f.doc.pointerLockElement={};f.down();assert.equal(f.vp.isFlying,false);f.doc.pointerLockElement=null;f.disallow();f.down();assert.equal(f.vp.isFlying,false)}finally{f.dispose()}})
test('Pérdida real de captura sin bloqueo cancela y restaura el control',async()=>{const f=fixture({asyncLock:true,selected:false});try{f.down();f.deny();await settle();assert.equal(f.vp.isFlying,true);f.lose();assert.equal(f.vp.isFlying,false);assert.equal(f.vp.controls.enabled,true)}finally{f.dispose()}})
test('WASD sin mover el ratón se registra como navegación y no clic contextual',()=>{const f=fixture({selected:false});try{f.down();f.key();f.vp._flyStep(.1);f.up();assert.equal(f.vp._lastContinuousNavigationMoved,true);assert.equal(f.vp._keys.size,0)}finally{f.dispose()}})
test('Blur, Escape y cambio de escena terminan el fallback sin teclas pegadas',async()=>{const f=fixture({asyncLock:true,selected:false});try{f.down();f.deny();await settle();f.key();f.win.emit('blur');assert.equal(f.vp.isFlying,false);assert.equal(f.vp._keys.size,0);f.down();f.deny();await settle();f.vp._stopContinuousNavigation(true);assert.equal(f.vp.isFlying,false)}finally{f.dispose()}})
