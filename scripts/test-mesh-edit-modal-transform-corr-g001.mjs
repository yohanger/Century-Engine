// LF-MESH-EDIT-MODAL-TRANSFORM-CORR-G001 — Edit Mode sin TransformControls redundantes.
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import {PolyMesh} from '../src/engine/runtime/mesh/polymesh.js'
import {finiteMesh, usableRect} from '../src/engine/runtime/numeric-integrity.js'
import {Sel} from '../src/core/mesh/sel.js'
const read=file=>readFileSync(new URL('../src/'+file,import.meta.url),'utf8')
const session=read('core/mesh/session.js'), xform=read('core/mesh/session-xform.js'), modal=read('core/mesh/session-modal.js'), input=read('core/mesh/session-input.js'),panel=read('components/MeshPanel.vue')
const store={edit:{globalShortcuts:true,bevel:{segments:1,width:0},loopCuts:1,hud:'',paint:{active:false},vertexDraw:false,proportional:false,mirrorX:false},project:{settings:{gridSize:1}},space:'world'}
const code=str=>str.replace(/^import .*\n/gm,'').replace(/^export /gm,'')
const context=vm.createContext({finiteMesh,usableRect,store,toast(){},undo(){},THREE:{},O:{},vlen(){},loopCutLines(){},validLoopCutRing(){},loopSlideFromScreen(){},rayLineParam(){},snapEnabled(){return false},snapStep(){return 1},win:{}})
vm.runInContext(code(modal)+'\nglobalThis.modalMethods=modalMethods',context)
vm.runInContext(code(input)+'\nglobalThis.inputMethods=inputMethods',context)
function fixture(mode='vertex'){
 const poly=new PolyMesh([[0,0,0],[1,0,0],[0,1,0]],[[0,1,2]])
 const sel=new Sel(); if(mode==='vertex')sel.v.add(0);else if(mode==='edge'){sel.v=new Set([0,1]);sel.e.add('0:1')}else{sel.v=new Set([0,1,2]);sel.f.add(0)}
 const commits=[],grabs=[],refreshes=[]
 const dom={getBoundingClientRect:()=>({left:0,top:0,width:600,height:400})}
 const x={poly,sel,mode,modal:null,_shiftSnapHeld:false,paintStroke:null,lastClient:{x:100,y:100},dom,
  vp:{isFlying:false,isNavigating:false,_lastContinuousNavigationMoved:false,controls:{enabled:true},requestRender(){refreshes.push('render')},wantsNav(){return false}},
  preview:{visible:false},_continuousGrab:{begin(...args){grabs.push('begin')},end(){grabs.push('end')},locked:false},
  numericCancel(){this.numericDraft=null},_prepXform(){this.xf={base:this.poly.v.map(p=>[...p])}},_project(){return{x:100,y:100}},pivotWorld(){return{x:0,y:0,z:0}},
  _clearSvg(){},_localFromClient(c){return{x:c.x,y:c.y}},
  modalUpdate(){this.updates=(this.updates||0)+1},refresh(){refreshes.push('refresh')},commit(label){commits.push(label)},
  _clientToLocal(e){return{x:e.clientX,y:e.clientY}},
 }
 Object.assign(x,context.modalMethods,context.inputMethods)
 x.modalUpdate=()=>{x.updates=(x.updates||0)+1}
 return{x,commits,grabs,refreshes}
}
test('ME-01: EditSession no construye controles de transformación',()=>{
 assert.doesNotMatch(session,/new TransformControls\(/)
 assert.doesNotMatch(session,/this\.tc\b|this\.proxy\b|this\._buildGizmo\(/)
})
test('ME-02: el controlador modal sigue instalado en el prototipo original',()=>{
 assert.match(session,/Object\.assign\(EditSession\.prototype, modalMethods\)/)
 assert.match(session,/Object\.assign\(EditSession\.prototype, inputMethods\)/)
})
test('ME-03: ninguna superficie de gizmo intercepta selección y gestos',()=>{
 assert.match(input,/if \(e\.button !== 0\) return/)
 assert.doesNotMatch(input,/this\.tc\.axis/)
})
test('ME-04: G crea modal sin disponer de TransformControls',()=>{
 const {x,grabs}=fixture();x.startModal('grab')
 assert.equal(x.modal.kind,'grab');assert.deepEqual(grabs,['begin'])
})
test('ME-05: R y S crean modales sobre cara y arista',()=>{
 for(const [mode,kind] of [['face','rotate'],['edge','scale']]){
  const {x}=fixture(mode);x.startModal(kind);assert.equal(x.modal.kind,kind)
 }
})
test('ME-06: el modo modal no pierde el último valor introducido',()=>{
 const {x}=fixture();x.startModal('grab');x.modalKey({key:'2',shiftKey:false});x.modalKey({key:'.',shiftKey:false});x.modalKey({key:'5',shiftKey:false});assert.equal(x.modal.text,'2.5')
})
test('ME-07: X/Y/Z y Shift+X aplican restricciones al modal',()=>{
 const {x}=fixture();x.startModal('grab');x.modalKey({key:'x',shiftKey:false});assert.equal(x.modal.axis,'x');assert.equal(x.modal.plane,false)
 x.modalKey({key:'z',shiftKey:true});assert.equal(x.modal.axis,'z');assert.equal(x.modal.plane,true)
})
test('ME-08: repetir X cambia referencia del eje sin tocar gizmo',()=>{
 const {x}=fixture();x.startModal('grab');x.modalKey({key:'x',shiftKey:false});x.modalKey({key:'x',shiftKey:false});assert.equal(x.modal.local,true)
})
test('ME-09: Enter confirma una única entrada en historial',()=>{
 const {x,commits,grabs}=fixture();x.startModal('grab');x.modalKey({key:'Enter'});assert.equal(x.modal,null);assert.equal(commits.length,1);assert.equal(commits[0],'Mover');assert.equal(grabs.at(-1),'end')
})
test('ME-10: Escape restaura topología y no crea Undo',()=>{
 const {x,commits}=fixture();x.startModal('scale');x.poly.v[0][0]=27;x.modalKey({key:'Escape'});assert.equal(x.modal,null);assert.equal(x.poly.v[0][0],0);assert.equal(commits.length,0)
})
test('ME-11: click izquierdo confirma y click derecho cancela',()=>{
 for(const [button,expected] of [[0,1],[2,0]]){
 const {x,commits}=fixture();x.startModal('grab');let blocked=false;x._onDown({clientX:100,clientY:100,button,shiftKey:false,stopImmediatePropagation(){blocked=true},preventDefault(){}})
 assert.equal(blocked,true);assert.equal(x.modal,null);assert.equal(commits.length,expected)
 }
})
test('ME-12: Shift afecta Snap temporal sin reinstalar controles',()=>{
 const {x}=fixture();x.startModal('grab');x.setSnapShiftHeld(true);assert.equal(x.modal.shift,true);assert.equal(x._shiftSnapHeld,true);x.setSnapShiftHeld(false);assert.equal(x.modal.shift,false)
})
test('ME-13: G/R/S llegan a operaciones reales desde onKey',()=>{
 for(const [key,name] of [['g','grab'],['r','rotate'],['s','scale']]){
  const {x}=fixture();x.op=kind=>{x.lastOp=kind};assert.equal(x.onKey({key,altKey:false,shiftKey:false,ctrlKey:false,metaKey:false}),true);assert.equal(x.lastOp,name)
 }
})
test('ME-14: teclas consumidas durante un modal no cambian de modo',()=>{
 const {x}=fixture();x.startModal('grab');let changed=false;x.setMode=()=>{changed=true};assert.equal(x.onKey({key:'1'}),true);assert.equal(changed,false)
})
test('ME-15: el ratón permite seleccionar sin `tc.axis`',()=>{
 const {x}=fixture();x._onDown({button:0,clientX:4,clientY:6,shiftKey:false,altKey:false,ctrlKey:false,metaKey:false});assert.equal(x.down?.x,4);assert.equal(x.down?.y,6)
})
test('ME-16: Object Mode conserva Three.js TransformControls',()=>{
 assert.match(read('core/editor/gizmo.js'),/new TransformControls\(/)
 assert.match(read('core/editor/selection.js'),/if \(this\.edit\)/)
})
test('ME-17: EditSession no registra doble ContinuousGrab',()=>{
 assert.equal((session.match(/new ContinuousGrab\(/g)||[]).length,1)
 assert.doesNotMatch(session,/dragging-changed|objectChange/)
})
test('ME-18: la transformación numérica permanece independiente del gizmo',()=>{
 assert.match(xform,/numericTransform\(kind, axis, value\)/)
 assert.doesNotMatch(xform,/this\.gz\b|this\.tc\b/)
})
test('ME-19: HUD modal queda abajo y fuera de la Toolbar',()=>{
 assert.match(modal,/store\.edit\.hud = hud/)
 assert.match(panel,/Pulsa G para mover, R para rotar y S para escalar/)
 assert.doesNotMatch(read('components/Toolbar.vue'),/uniformScaleHud\.value/)
})
test('ME-20: operaciones de Fill y Extrude conservadas',()=>{
 assert.match(read('core/mesh/ops-fill.js'),/export function fill\(/)
 assert.match(session,/case 'grab': case 'rotate': case 'scale'/)
 assert.match(session,/startExtrude\(/)
})
