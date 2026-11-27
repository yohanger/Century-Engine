import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
const source = p => readFileSync(new URL('../src/'+p,import.meta.url),'utf8').replace(/^import .*$/gm,'').replace('export const navMethods','const navMethods')
const nav = runInNewContext(source('engine/runtime/render/viewport-nav.js')+'\nnavMethods',{})
function event(button=2){return {button,prevented:false,stopped:false,preventDefault(){this.prevented=true},stopImmediatePropagation(){this.stopped=true}}}
function setup({lock=null,active=false,releasing=false,editor=true,playing=false}={}) {
  const dom={ownerDocument:{pointerLockElement:lock}}, starts=[]
  if(lock==='own')dom.ownerDocument.pointerLockElement=dom
  return {vp:{...nav,dom,playing,_editNavigationSource:()=>editor,_editNavigationGrab:{active,releasing},_beginFlyNavigation(e){starts.push(e.button);return e.button===2}},starts}
}
function dispatch(vp,e){if(vp._guardEditorPointerDown)vp._guardEditorPointerDown(e);if(!e.stopped&&vp.dom.ownerDocument.pointerLockElement)throw new DOMException('Pointer Lock activo','InvalidStateError')}
test('una captura ajena o un gesto activo no llega a los addons',()=>{for(const options of [{lock:{}},{lock:'own',active:true},{active:true}]){const {vp,starts}=setup(options),e=event();assert.doesNotThrow(()=>dispatch(vp,e));assert.equal(e.stopped,true);assert.equal(starts.length,0)}})
test('un vuelo inmediato durante la liberación propia evita la segunda captura',()=>{const {vp,starts}=setup({lock:'own',releasing:true});const e=event();assert.doesNotThrow(()=>dispatch(vp,e));assert.deepEqual(starts,[2]);assert.equal(e.stopped,true);assert.equal(e.prevented,true)})
test('una solicitud pendiente también impide una segunda captura; normal y Player no cambian',()=>{const {vp,starts}=setup({releasing:true});const pending=event(0);dispatch(vp,pending);assert.equal(pending.stopped,true);assert.deepEqual(starts,[]);for(const options of [{},{lock:'own',editor:false},{lock:'own',playing:true}]){const {vp}=setup(options),e=event();assert.equal(vp._guardEditorPointerDown(e),false);assert.equal(e.stopped,false)}})
test('la navegación aceptada consume pointerdown antes de los listeners posteriores',()=>{let down,starts=0;const dom={addEventListener(n,fn){if(n==='pointerdown')down=fn},removeEventListener(){}};const vp={...nav,dom,_continuousNavKind:()=> 'orbit',_editNavigationGrab:{begin(){starts++;return true}},controls:{enabled:true}};vp._bindContinuousNavigation();const e={...event(1),clientX:0,clientY:0,pointerId:1};down(e);assert.equal(starts,1);assert.equal(e.stopped,true);assert.equal(vp._continuousNavigation.kind,'orbit');assert.equal(vp.controls.enabled,false)})
test('el guard se instala en la fase de captura antes de construir OrbitControls',()=>{const s=source('engine/runtime/render/viewport.js');const start=s.indexOf('this._guardEditorPointerDown(e)'),end=s.indexOf('this.controls = new OrbitControls');assert.ok(start>=0&&start<end);assert.match(s.slice(start,end),/capture: true/)})
