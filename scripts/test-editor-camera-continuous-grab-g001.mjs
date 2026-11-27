// LF-EDITOR-CAMERA-CONTINUOUS-GRAB-G001: navegación modal sin duplicar ContinuousGrab.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ContinuousGrab } from '../src/core/editor/continuous-grab.js'

const raw = readFileSync(new URL('../src/engine/runtime/render/viewport-nav.js', import.meta.url), 'utf8')
const imported = raw.replace(/^import .*\n/gm, '').replace('export const navMethods', 'const navMethods')
const { navMethods } = await import(`data:text/javascript,${encodeURIComponent(`const THREE={};const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));\n${imported}\nexport {navMethods}`)}`)
const source = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8')

class Target {
  constructor() {this.events=new Map()}
  addEventListener(name,fn){this.events.set(name,[...(this.events.get(name)||[]),fn])}
  removeEventListener(name,fn){this.events.set(name,(this.events.get(name)||[]).filter(f=>f!==fn))}
  emit(name,props={}){for(const fn of [...(this.events.get(name)||[])]) fn(props)}
}
function scene({editable=true, denied=false}={}) {
  const doc=new Target(),win=new Target(),dom=new Target(),parent=new Target()
  doc.defaultView=win;doc.hidden=false;doc.pointerLockElement=null
  doc.createElement=()=>({style:{},setAttribute(){},remove(){}})
  doc.exitPointerLock=()=>{doc.pointerLockElement=null;doc.emit('pointerlockchange')}
  dom.parentElement=parent;dom.ownerDocument=doc;dom.style={};dom.clientHeight=200
  dom.getBoundingClientRect=()=>({left:10,top:20,width:300,height:200})
  parent.getBoundingClientRect=()=>({left:0,top:0});parent.appendChild=(elem)=>{elem.parentElement=parent}
  dom.requestPointerLock=()=>{if(denied)throw Error('No lock');doc.pointerLockElement=dom;doc.emit('pointerlockchange')}
  const grab=new ContinuousGrab(dom), calls=[]
  const vp={dom,playing:false,_flying:false,controls:{enabled:true,rotateSpeed:1,panSpeed:1},_space:false,
    _orbitBy:(x,y)=>calls.push(['orbit',x,y]),_panBy:(x,y)=>calls.push(['pan',x,y]),
    _flyRotate:(x,y)=>calls.push(['fly',x,y]),_endFlyNavigation(){this._flying=false;this.controls.enabled=true},
  }
  Object.assign(vp,navMethods)
  // Las pruebas aislan el despacho de deltas; las cámaras Three se verifican en Electron.
  vp._orbitBy=(x,y)=>calls.push(['orbit',x,y])
  vp._panBy=(x,y)=>calls.push(['pan',x,y])
  vp._flyRotate=(x,y)=>calls.push(['fly',x,y])
  vp._endFlyNavigation=function(){this._flying=false;this.controls.enabled=true}
  vp.setEditNavigation(()=>editable,grab)
  vp._bindContinuousNavigation()
  const down=(button,extra={})=>dom.emit('pointerdown',{button,clientX:300,clientY:100,pointerId:1,...extra})
  const move=(x,y)=>{let stopped=false;dom.emit('pointermove',{movementX:x,movementY:y,preventDefault(){},stopImmediatePropagation(){stopped=true}});return stopped}
  const up=(button)=>dom.emit('pointerup',{button,pointerId:1})
  const release=()=>{vp._stopContinuousNavigation(true);vp._continuousNavigationCleanup();grab.dispose()}
  return {vp,doc,win,dom,grab,calls,down,move,up,release}
}
test('ECG-01: la navegación reutiliza exactamente el cursor existente',()=>{
  const s=source('core/editor.js');assert.match(s,/setEditNavigation\(\(\) => !this\.player\?\.on && !store\.gameView\.on, this\._continuousGrab\)/)
  assert.doesNotMatch(source('engine/runtime/render/viewport-nav.js'),/new ContinuousGrab/)
  assert.match(source('engine/runtime/render/viewport.js'),/this\._bindContinuousNavigation\(\)/)
})
test('ECG-02: ratón normal no inicia bloqueo ni altera selección',()=>{
  const f=scene();f.down(0);assert.equal(f.grab.active,false);assert.equal(f.move(30,20),false);f.release()
})
test('ECG-03: fuente de navegación deshabilitada no permite captura continua',()=>{
  const f=scene({editable:false});f.down(1);assert.equal(f.grab.active,false);f.release()
})
test('ECG-04: botón central orbita con movimiento relativo sin límite',()=>{
  const f=scene();f.down(1);assert.equal(f.grab.locked,true);assert.equal(f.move(500,-170),true)
  assert.equal(f.calls[0][0],'orbit');assert.ok(f.calls[0][1]>0 && f.calls[0][2]<0)
  f.move(-730,410);assert.equal(f.calls.length,2);assert.equal(f.grab.cursor.style.display,'block')
  f.up(1);assert.equal(f.grab.active,false);f.release()
})
test('ECG-05: Shift + botón central desplaza sin orbitar',()=>{
  const f=scene();f.down(1,{shiftKey:true});f.move(12,-9);assert.deepEqual(f.calls,[['pan',12,-9]]);f.release()
})
test('ECG-06: Alt+izquierdo órbita y Alt+Shift+izquierdo desplaza',()=>{
  const f=scene();f.down(0,{altKey:true});f.move(10,0);assert.equal(f.calls[0][0],'orbit');f.up(0)
  f.down(0,{altKey:true,shiftKey:true});f.move(10,5);assert.deepEqual(f.calls.at(-1),['pan',10,5]);f.release()
})
test('ECG-07: Space+izquierdo desplaza en vez de seleccionar',()=>{
  const f=scene();f.vp._space=true;f.down(0);f.move(22,-12);assert.deepEqual(f.calls,[['pan',22,-12]]);f.release()
})
test('ECG-08: derecho en vuelo consume un único delta y libera el cursor',()=>{
  const f=scene();f.vp._flying=true;f.vp.controls.enabled=false;f.down(2);f.move(36,-18)
  assert.deepEqual(f.calls,[['fly',36,-18]]);f.up(2);assert.equal(f.grab.active,false);f.release()
})
test('ECG-09: Shift+derecho desplaza la vista y no inicia vuelo',()=>{
  const f=scene();f.down(2,{shiftKey:true});f.move(-30,12);assert.deepEqual(f.calls,[['pan',-30,12]]);f.release()
})
test('ECG-10: bloquear otro gesto durante el primero no genera otra captura',()=>{
  const f=scene();f.down(1);f.down(2);assert.equal(f.vp._continuousNavigation.button,1);f.up(2);assert.equal(f.grab.active,true);f.up(1);f.release()
})
test('ECG-11: pointerup conserva evidencia de desplazamiento para no seleccionar ni abrir menú',()=>{
  const f=scene();f.vp._flying=true;f.down(2);f.move(25,0);f.up(2);assert.equal(f.vp._lastContinuousNavigationMoved,true)
  const input=source('core/mesh/session-input.js');assert.match(input,/!d \|\| this\.vp\._lastContinuousNavigationMoved/)
  f.release()
})
test('ECG-12: un clic derecho sin movimiento todavía permite menú contextual',()=>{
  const f=scene();f.vp._flying=true;f.down(2);f.up(2);assert.equal(f.vp._lastContinuousNavigationMoved,false);f.release()
})
test('ECG-13: Escape cancela, libera el bloqueo y termina vuelo activo',()=>{
  const f=scene();f.vp._flying=true;f.down(2);f.move(1,1)
  f.doc.emit('keydown',{key:'Escape',preventDefault(){},stopImmediatePropagation(){}})
  assert.equal(f.grab.active,false);assert.equal(f.vp._continuousNavigation,null);assert.equal(f.vp._flying,false);f.release()
})
test('ECG-14: pérdida de foco y pointercancel liberan bloqueo',()=>{
  const f=scene();f.down(1);f.win.emit('blur');assert.equal(f.grab.active,false)
  f.down(1);f.dom.emit('pointercancel',{pointerId:1});assert.equal(f.grab.active,false);f.release()
})
test('ECG-15: denegación de Pointer Lock conserva la navegación nativa',()=>{
  const f=scene({denied:true});f.down(1);assert.equal(f.grab.active,false)
  assert.equal(f.vp._continuousNavigation,undefined);f.release()
})
test('ECG-16: el código respeta el modo Player y la salida de Edit Mode',()=>{
  const f=scene();f.vp.playing=true;f.down(1);assert.equal(f.grab.active,false);f.release()
  assert.match(source('core/editor/meshedit.js'),/this\.vp\._stopContinuousNavigation\?\.\(true\)/)
  assert.match(source('engine/runtime/render/viewport.js'),/this\._continuousNavigationCleanup\?\.\(\)/)
  assert.doesNotMatch(source('engine/runtime/events/play-controls.js'),/ContinuousGrab/)
})
