import test,{before,after} from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import {fileURLToPath} from 'node:url'
let server,api,oldDocument
const root=fileURLToPath(new URL('..',import.meta.url))
before(async()=>{server=await createServer({root,server:{middlewareMode:true},appType:'custom'});api=await server.ssrLoadModule('/scripts/fixtures/mesh/edit-session-integration-corr-g001.mjs');oldDocument=globalThis.document})
after(async()=>{if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;await server?.close()})
function fixture(options){const dom=api.createNodeEditDom();globalThis.document=dom.doc;return {...api.createEditScenario(dom.dom,options),parent:dom.parent}}
// rev invalida buffers/cachés; cancelar debe conservar todos los datos geométricos y atributos.
const snapshot=s=>{const {rev,...data}=s.poly.toJSON();return JSON.stringify(data)}
function cleanup(f){f.close()}

test('MEI-01: prototipo real integra todos los métodos originales de pintura',()=>{
 for(const[name,fn]of Object.entries(api.paintInputMethods))assert.equal(api.EditSession.prototype[name],fn,name)
})
test('MEI-02: constructor y salida reales liberan sesión sin pintura activa',()=>{
 const f=fixture();assert.equal(api.store.edit.on,true);f.close();assert.equal(api.store.edit.on,false);assert.equal(f.node.userData.liveEdit,false);assert.equal(f.vp.controls.enabled,true);assert.equal(f.parent.children.length,0)
})
for(const kind of ['grab','rotate','scale'])test(`MEI-03-${kind}: modal real evalúa Snap sin inyectar el helper`,()=>{
 const f=fixture();try{f.session.lastClient={x:320,y:200};f.session.setSnapShiftHeld(true);f.session.startModal(kind);assert.equal(f.session.modal.kind,kind);assert.equal(f.session.modal.shift,true);assert.ok(api.store.edit.hud);assert.equal(api.store.canUndo,false);f.session.modalCancel();f.session.setSnapShiftHeld(false)}finally{cleanup(f)}
})
test('MEI-04: G/X, Shift y Snap preservan continuidad y preferencias',()=>{
 const f=fixture();try{
  const s=f.session,settings=JSON.stringify(api.store.project.settings);s.lastClient={x:320,y:200};s.startModal('grab');s.modalKey({key:'x',shiftKey:false});s.modalMove({clientX:350,clientY:200,shiftKey:false});const before=s.poly.v[0][0]
  s.setSnapShiftHeld(true);s.modalMove({clientX:350,clientY:200,shiftKey:true});assert.ok(Math.abs(s.poly.v[0][0]-before)<1e-8)
  s.modalMove({clientX:370,clientY:200,shiftKey:true});assert.notEqual(s.poly.v[0][0],before);assert.equal(JSON.stringify(api.store.project.settings),settings);s.modalCancel()
 }finally{cleanup(f)}
})
test('MEI-05: cancelar revierte geometría y confirmar registra Undo/Redo real',()=>{
 const f=fixture();try{const s=f.session,initial=snapshot(s);s.lastClient={x:320,y:200};s.startModal('grab');s.modalKey({key:'x',shiftKey:false});s.modalKey({key:'2',shiftKey:false});s.modalCancel();assert.equal(snapshot(s),initial);assert.equal(api.store.canUndo,false)
  s.startModal('grab');s.modalKey({key:'x',shiftKey:false});s.modalKey({key:'2',shiftKey:false});s.modalConfirm();const changed=JSON.stringify(api.meshDataOf(api.store.project.objects[0],api.store.project.meshes));assert.equal(api.store.canUndo,true);api.undo();assert.equal(api.store.canUndo,false);api.redo();assert.equal(JSON.stringify(api.meshDataOf(api.store.project.objects[0],api.store.project.meshes)),changed)
 }finally{cleanup(f)}
})
test('MEI-06: activar pintura y Escape restaura pesos sin nueva transacción',()=>{
 const f=fixture();try{const s=f.session;s.paintEnable();api.store.edit.paint.layer=1;api.store.edit.paint.radius=10;api.store.edit.paint.strength=1;const before=snapshot(s),p=f.point(),r=f.dom.getBoundingClientRect();s._onDown({button:0,clientX:p.x+r.left,clientY:p.y+r.top,preventDefault(){},stopImmediatePropagation(){}});assert.ok(s.paintStroke?.changed);assert.notEqual(snapshot(s),before);s.onKey({key:'Escape'});assert.equal(s.paintStroke,null);assert.equal(snapshot(s),before);assert.equal(api.store.canUndo,true);api.undo();assert.equal(api.store.canUndo,false)
 }finally{cleanup(f)}
})
test('MEI-07: terminar trazo persiste pesos; Undo/Redo conserva material y UV',()=>{
 const f=fixture();try{const s=f.session;s.paintEnable();const uv=JSON.stringify(s.poly.uv),mat=JSON.stringify(s.obj.mat);api.store.edit.paint.layer=1;api.store.edit.paint.radius=10;const p=f.point();s._onDown({button:0,clientX:p.x,clientY:p.y,preventDefault(){},stopImmediatePropagation(){}});s._onUp({button:0});const weights=JSON.stringify(s.poly.weights);assert.equal(s.paintStroke,null);assert.ok(s.poly.weights.some(w=>w[1]>0));api.undo();assert.ok(!s.poly.weights.some(w=>w[1]>0));api.redo();assert.equal(JSON.stringify(s.poly.weights),weights);assert.equal(JSON.stringify(s.poly.uv),uv);assert.equal(JSON.stringify(s.obj.mat),mat)
 }finally{cleanup(f)}
})
test('MEI-08: salir durante pintura cancela trazo y permite reentrada',()=>{
 const f=fixture();try{const s=f.session;s.paintEnable();api.store.edit.paint.layer=1;api.store.edit.paint.radius=10;const before=JSON.stringify(api.meshDataOf(s.obj,api.store.project.meshes)),p=f.point();s._onDown({button:0,clientX:p.x,clientY:p.y,preventDefault(){},stopImmediatePropagation(){}});s.dispose();f.ed.edit=null;assert.equal(JSON.stringify(api.meshDataOf(api.store.project.objects[0],api.store.project.meshes)),before);assert.equal(api.store.edit.on,false);const next=f.open();assert.equal(next.poly.weights.some(w=>w[1]>0),false)
 }finally{cleanup(f)}
})
test('MEI-09: confirmar mantiene recurso vinculado y serialización de proyecto',()=>{
 const f=fixture({linked:true});try{const s=f.session;s.lastClient={x:320,y:200};s.startModal('grab');s.modalKey({key:'x',shiftKey:false});s.modalKey({key:'1',shiftKey:false});s.modalConfirm();assert.ok(f.syncs.includes('mesh')&&f.syncs.includes('linked'));assert.equal(api.store.project.meshes.length,1);const saved=JSON.parse(JSON.stringify(api.store.project));assert.deepEqual(api.meshDataOf(saved.objects[0],saved.meshes),api.meshDataOf(saved.objects[1],saved.meshes));assert.equal(saved.objects[1].mat.color,'#aa5533')
 }finally{cleanup(f)}
})

test('El fixture inicializa los registros nativos del proyecto antes de abrir Edit Mesh',()=>{
 const f=fixture({linked:true});try{
  const p=api.store.project
  assert.equal(p.tagLayers.layers.length,32)
  assert.equal(p.tagLayers.layers[0].name,'Default')
  assert.deepEqual(p.tagLayers.groups,[])
  assert.ok(p.scenes.some(scene=>scene.id===p.activeSceneId))
  assert.ok(Array.isArray(p.audio.groups))
  for(const key of ['materials','assets','models','scripts','profiles','shaders','uis','animations','timelines','cinematics','prefabs','folders','gameManagers','liquids','vfx'])assert.ok(Array.isArray(p[key]),key)
  assert.equal(p.terrain.enabled,false)
  assert.equal(p.settings.gridSize,.5)
  assert.equal(p.objects.length,2)
  assert.equal(p.meshes.length,1)
  assert.equal(api.store.canUndo,false)
 }finally{cleanup(f)}
})
