import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { ContinuousGrab } from '../src/core/editor/continuous-grab.js'
const read=p=>readFileSync(new URL('../src/'+p,import.meta.url),'utf8')
const mixin=(p,n,ctx={})=>runInNewContext(read(p).replace(/^import .*$/gm,'').replace('export const '+n,'const '+n)+'\n'+n,ctx)
const nav=mixin('engine/runtime/render/viewport-nav.js','navMethods')
const input=mixin('core/mesh/session-input.js','inputMethods',{store:{edit:{paint:{active:false}}}})
class Target extends EventTarget {}
function setup(lock='own') {
  const doc=new Target(),dom=new Target();doc.pointerLockElement=null;doc.defaultView=new Target();doc.createElement=()=>({style:{},setAttribute(){},remove(){}})
  dom.ownerDocument=doc;dom.style={cursor:'crosshair'};dom.getBoundingClientRect=()=>({left:0,top:0,width:300,height:200})
  dom.parentElement={appendChild(){},getBoundingClientRect:()=>({left:0,top:0})}
  doc.exitPointerLock=()=>{doc.pointerLockElement=null;doc.dispatchEvent(new Event('pointerlockchange'))}
  dom.requestPointerLock=()=>{if(lock!=='pending'){doc.pointerLockElement=dom;doc.dispatchEvent(new Event('pointerlockchange'))}}
  const editorGrab=new ContinuousGrab(dom),grab=new ContinuousGrab(dom,{owner:'Edit Mesh'}),vp={...nav,dom,_editNavigationSource:()=>true,_editNavigationGrab:editorGrab,isFlying:false}
  const calls=[];const session={...input,modal:{kind:'grab'},dom,vp,_continuousGrab:grab,_modalTargetsScreen:()=>false,modalConfirm(){calls.push('confirm');grab.end();this.modal=null},modalCancel(){calls.push('cancel');grab.end();this.modal=null}}
  // Use the same owner callback registered by Editor; the viewport must stop propagation itself.
  vp._consumeMeshModalPointerDown=e=>session.consumeModalPointerDown?.(e)??false
  if(lock==='own'||lock==='pending')grab.begin(null,()=>{},()=>{})
  if(lock==='foreign')editorGrab.begin(null,()=>{},()=>{})
  const click=button=>{const e={button,clientX:12,clientY:34,preventDefault(){this.prevented=true},stopImmediatePropagation(){this.stopped=true}};const guarded=vp._guardEditorPointerDown(e);if(!e.stopped)session._onDown(e);return {e,guarded}}
  const dispose=()=>{grab.dispose();editorGrab.dispose()}
  return {session,grab,editorGrab,doc,dom,calls,click,dispose}
}
for(const kind of ['own','pending','none'])for(const button of [0,2])test(`modal ${kind}: button ${button} goes only to its owner`,()=>{const f=setup(kind);try {const {e,guarded}=f.click(button);assert.equal(guarded,true);assert.equal(e.stopped,true);assert.deepEqual(f.calls,[button===0?'confirm':'cancel']);assert.equal(f.session.modal,null);assert.equal(f.dom.style.cursor,'crosshair')}finally{f.dispose()}})
test('foreign lock does not confirm mesh or release another owner',()=>{const f=setup('foreign');try{assert.equal(f.click(0).guarded,true);assert.deepEqual(f.calls,[]);assert.equal(f.editorGrab.locked,true)}finally{f.dispose()}})
test('guard retains foreign-lock protection when the mesh modal does not exist',()=>{const f=setup('foreign');try{f.session.modal=null;assert.equal(f.click(0).guarded,true);assert.deepEqual(f.calls,[])}finally{f.dispose()}})
test('production editor connects the owner delegate before dispatch',()=>assert.match(read('core/editor.js'),/_consumeMeshModalPointerDown\s*=\s*e\s*=>\s*this\.edit\?\.consumeModalPointerDown\(e\)/))
