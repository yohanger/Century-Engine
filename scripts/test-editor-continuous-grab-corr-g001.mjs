// LF-EDITOR-CONTINUOUS-GRAB-CORR-G001 · ratón continuo sin dependencias de navegador externo.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ContinuousGrab } from '../src/core/editor/continuous-grab.js'

class Target {
  constructor() { this.listeners = new Map() }
  addEventListener(n, fn) { const arr = this.listeners.get(n) || []; arr.push(fn); this.listeners.set(n, arr) }
  removeEventListener(n, fn) { this.listeners.set(n, (this.listeners.get(n) || []).filter(f => f !== fn)) }
  emit(n, e = {}) { for (const fn of [...(this.listeners.get(n) || [])]) fn(e) }
}
function fixture({width = 180,height = 100,lock = true}={}) {
  const doc = new Target(), win = new Target(), dom = new Target(), parent = new Target()
  doc.defaultView = win
  doc.hidden = false
  doc.pointerLockElement = null
  doc.createElement = () => ({style:{},setAttribute(){},parentElement:null,remove(){this.parentElement=null}})
  doc.exitPointerLock = () => {doc.pointerLockElement=null;doc.emit('pointerlockchange')}
  parent.getBoundingClientRect = () => ({left:0,top:0})
  parent.appendChild = (node) => {node.parentElement=parent}
  dom.parentElement = parent
  dom.ownerDocument = doc
  dom.style = {}
  dom.getBoundingClientRect = () => ({left:20,top:30,width,height})
  dom.requestPointerLock = () => { if (lock) {doc.pointerLockElement=dom;doc.emit('pointerlockchange')} else throw Error('denied') }
  return {doc,win,dom,parent}
}
const move = (dom, x, y) => {let stopped=false;dom.emit('pointermove',{movementX:x,movementY:y,stopImmediatePropagation(){stopped=true},preventDefault(){}});return stopped}
const code = (p) => readFileSync(new URL(p, import.meta.url),'utf8')

test('CG-01: bloqueo y cursor virtual aparecen solo durante el gesto',()=>{
  const {dom,doc}=fixture();const c=new ContinuousGrab(dom)
  assert.equal(c.cursor.style.display,'none')
  assert.equal(c.begin({x:180,y:100},()=>{},()=>{}),true)
  assert.equal(c.locked,true);assert.equal(doc.pointerLockElement,dom);assert.equal(dom.style.cursor,'none')
  assert.equal(c.cursor.style.display,'block')
  c.end();assert.equal(c.locked,false);assert.equal(doc.pointerLockElement,null);assert.equal(c.cursor.style.display,'none')
  c.dispose()
})
test('CG-02: derecha, izquierda, arriba y abajo reaparecen en el borde opuesto',()=>{
  const {dom}=fixture();const c=new ContinuousGrab(dom);c.begin({x:198,y:128},()=>{},()=>{})
  move(dom,15,13);assert.ok(c.visual.x<25);assert.ok(c.visual.y<20)
  move(dom,-60,-45);assert.ok(c.visual.x>100);assert.ok(c.visual.y>40)
  c.dispose()
})
test('CG-03: recorrido continuo no pierde píxeles por cruces repetidos',()=>{
  const {dom}=fixture();const values=[];const c=new ContinuousGrab(dom)
  c.begin({x:120,y:80},(p)=>values.push({...p}),()=>{})
  for(let i=0;i<12;i++)assert.equal(move(dom,90,50),true)
  assert.equal(values.at(-1).x,100+1080);assert.equal(values.at(-1).y,50+600)
  assert.equal(c.visual.x>=1 && c.visual.x<179,true)
  c.dispose()
})
test('CG-04: mientras no hay bloqueo, no intercepta selección ni navegación',()=>{
  const {dom}=fixture();const c=new ContinuousGrab(dom)
  assert.equal(move(dom,80,20),false)
  c.dispose()
})
test('CG-05: error de bloqueo mantiene el ratón nativo y no deja captura residual',()=>{
  const {dom}=fixture({lock:false});const c=new ContinuousGrab(dom)
  assert.equal(c.begin({x:100,y:70},()=>{},()=>{}),false)
  assert.equal(c.active,false);assert.equal(move(dom,2,2),false)
  c.dispose()
})
test('CG-06: Escape cancela una sola vez y libera la captura',()=>{
  const {dom,doc}=fixture();let cancels=0;const c=new ContinuousGrab(dom)
  c.begin({x:100,y:70},()=>{},()=>cancels++)
  doc.emit('keydown',{key:'Escape',preventDefault(){},stopImmediatePropagation(){}})
  assert.equal(cancels,1);assert.equal(c.active,false);assert.equal(doc.pointerLockElement,null)
  doc.emit('pointerlockchange');assert.equal(cancels,1)
  c.dispose()
})
test('CG-07: cambio de foco y visibilidad cancelan sin reintentos',()=>{
  const {dom,doc,win}=fixture();let cancelled=0;const c=new ContinuousGrab(dom)
  c.begin({x:100,y:70},()=>{},()=>cancelled++)
  win.emit('blur');assert.equal(cancelled,1);assert.equal(c.active,false)
  c.begin({x:100,y:70},()=>{},()=>cancelled++)
  doc.hidden=true;doc.emit('visibilitychange');assert.equal(cancelled,2)
  c.dispose()
})
test('CG-08: liberación normal no cancela, y dispose elimina listeners',()=>{
  const {dom,doc}=fixture();let cancels=0;const c=new ContinuousGrab(dom)
  c.begin({x:100,y:70},()=>{},()=>cancels++)
  c.end();c.dispose();doc.emit('pointerlockchange')
  assert.equal(cancels,0);assert.equal((doc.listeners.get('pointerlockchange')||[]).length,0)
})
test('CG-09: rangos pequeños no producen NaN ni modulo cero',()=>{
  const {dom}=fixture({width:2,height:2});const c=new ContinuousGrab(dom)
  c.begin({x:21,y:31},()=>{},()=>{});move(dom,800,-900)
  assert.equal(c.visual.x,1);assert.equal(c.visual.y,1);c.dispose()
})
test('El punto de selección se limita al visor mientras el movimiento sigue acumulándose', () => {
  const {dom} = fixture(), grab = new ContinuousGrab(dom)
  let point
  grab.begin({x:190,y:110}, value => { point = value }, () => {}, { clampCursor: true })
  move(dom,500,400)
  assert.deepEqual(point.screen, {x:180,y:100})
  assert.deepEqual([point.x,point.y], [670,480])
  move(dom,-4,-5)
  assert.deepEqual(point.screen, {x:176,y:95})
  grab.dispose()
})

test('Cancelar antes de completar la petición libera un bloqueo tardío', () => {
  const {doc,dom} = fixture()
  dom.requestPointerLock = () => {}
  const grab = new ContinuousGrab(dom), other = new ContinuousGrab(dom)
  assert.equal(grab.begin(null, () => {}, () => {}), true)
  grab.dispose()
  assert.equal(other.begin(null, () => {}, () => {}), false)
  doc.pointerLockElement = dom
  doc.emit('pointerlockchange')
  assert.equal(doc.pointerLockElement, null)
  assert.equal(other.begin(null, () => {}, () => {}), true)
  doc.emit('pointerlockerror')
  assert.equal(other.active, false)
  other.dispose()
})

test('CG-10: entrada modal conserva los atajos y la acumulación angular no se reinicia',()=>{
  const modal=code('../src/core/mesh/session-modal.js')
  assert.match(modal,/this\._continuousGrab\?\.begin\(/)
  assert.match(modal,/m\.continuous \? \(cur\.x - m\.start\.x\)/)
  assert.match(modal, /k === 'Escape'/)
  assert.match(modal, /ax === 'c' && m\.kind === 'bevel'/)
  assert.match(modal, /this\._continuousGrab\?\.end\(\)/)
})
test('CG-11: el gizmo de objetos recibe NDC de cursor acumulado',()=>{
  const gizmo=code('../src/core/editor/gizmo.js')
  assert.match(gizmo,/pointerMove\(\{ x:/)
  assert.match(gizmo,/button: -1/)
  assert.match(gizmo,/this\._continuousGrab\??\.begin\(/)
  assert.match(gizmo,/this\._continuousGrab\??\.end\(/)
})
test('CG-12: gizmos conservan Snap, Undo y controles del Player aislados',()=>{
  const mesh=code('../src/core/editor/gizmo.js'), ed=code('../src/core/editor.js')
  assert.match(mesh,/_beginSnapDrag\(t\)/)
  assert.match(mesh,/_endSnapDrag\(t\)/)
  assert.match(mesh,/updateObject\(obj\.id, patch/)
  assert.match(mesh,/_continuousGizmoCancel\(t\)/)
  assert.match(ed, /_continuousGrab\?\.dispose\(\)/)
  assert.doesNotMatch(code('../src/engine/runtime/events/play-controls.js'), /ContinuousGrab/)
})
