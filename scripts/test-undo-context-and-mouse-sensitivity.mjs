import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { effectiveNavigationPrefs, mouseSensitivity } from '../src/core/editor/mouse-sensitivity.js'
import { PolyMesh } from '../src/engine/runtime/mesh/polymesh.js'
import { meshDataOf } from '../src/engine/runtime/mesh/shared-mesh.js'
import { strictJson, finiteMeshRecord, finiteMesh } from '../src/engine/runtime/numeric-integrity.js'
const read = f => readFileSync(new URL('../'+f, import.meta.url),'utf8')
const copy = v => JSON.parse(JSON.stringify(v))
const geom = x => new PolyMesh([[x,0,0],[0,1,0],[0,0,1]], [[0,1,2]]).toJSON()
function moduleSource(path) { return read(path).replace(/^import[^\n]*\n/gm,'').replace(/\bexport\s+(?=(?:async\s+)?(?:function|const|let|class)\b)/g,'') }
function setup(type='mesh') {
  const node = {id:'mesh',type,kind:'cube',position:[0,0,0],scale:[1,1,1],props:type==='mesh'?{mesh:geom(0)}:{}}
  const store = {project:{id:'qa',objects:[node,{id:'other',type:'node3d'}],meshes:[],environment:{},terrain:{enabled:false,layers:[],foliage:[]}},selectedId:'mesh',selectedIds:['mesh'],locked:false,pendingRevision:0,disk:{state:'saved'},edit:{mode:'vertex',localView:false}}
  const terrain = {layers:[],foliage:[]}
  const getObject = id => store.project.objects.find(o=>o.id===id)
  class Session {
    constructor(ed,obj) { this.ed=ed;this.obj=obj;this.objId=obj.id;this.mode='vertex';this.sel={v:[0],e:[],f:[]};this.dirty=false;store.edit.on=true }
    snapshot() {return {id:this.objId,mode:this.mode,sel:copy(this.sel)}}
    reload(snap){this.obj=getObject(this.objId);if(!this.obj||!meshDataOf(this.obj,store.project.meshes))return false;this.mode=snap.mode;this.sel=copy(snap.sel);return true}
    flush(){} dispose(){store.edit.on=false}
  }
  const env = {store,strictJson,toRaw:x=>x,authoredSceneTree:p=>({objects:p.objects,signalConnections:[]}),validateNodeTree:()=>{},debounce:()=>()=>{},nextNativeRevision:()=>1,JSON,Set,Map,Object}
  const history=runInNewContext(moduleSource('src/core/state/history.js')+'\n;({resetHistory,commit,undo,redo})',env)
  const methods=runInNewContext(moduleSource('src/core/editor/meshedit.js')+'\n;mesheditMethods',{store,getObject,meshDataOf,finiteMeshRecord,commit:history.commit,toast:m=>{throw Error(m)},tool:()=>({EditSession:Session})})
  const ed={...methods,edit:null,boxes:[],nodes:new Map(),vp:{overlay:{remove(){}},requestRender(){}},_lockedChain:()=>false,setGameView(){},_tcs:()=>[],syncObject(){},setSelection(){},_updateGizmoMode(){},snapshotTerrain:()=>terrain,syncAll(){},syncEnvironment(){},_convertToMesh(o){o.type='mesh';o.props={mesh:geom(0)}},restoreTerrain(){},applyView(){}}
  store.editor=ed;history.resetHistory()
  return {store,ed,history,getObject,change(x){getObject('mesh').props.mesh=geom(x);history.commit('Mover vértice')}}
}
test('Entrar y salir de una malla existente no crea historial ni marca dirty',()=>{const {ed,store}=setup();ed.enterEdit();assert.equal(store.canUndo,false);ed.exitEditMode();assert.equal(store.canUndo,false);assert.equal(store.unsavedChanges,undefined)})
test('Undo/Redo conserva la misma sesión, modo y Local View durante todas las modificaciones',()=>{const {ed,history,store,change,getObject}=setup();ed.enterEdit();const session=ed.edit;change(1);change(2);session.mode='edge';ed._meshLocalView={session,view:{id:'camera'}};store.edit.localView=true;history.undo();history.undo();history.undo();assert.equal(ed.edit,session);assert.equal(session.mode,'edge');assert.equal(store.edit.localView,true);assert.equal(ed._meshLocalView.view.id,'camera');assert.equal(getObject('mesh').props.mesh.v[0],0);assert.equal(store.canUndo,false);history.redo();history.redo();assert.equal(ed.edit,session);assert.equal(session.mode,'edge');assert.equal(getObject('mesh').props.mesh.v[0],2)})
test('Undo y Redo en Object Mode nunca reabren una sesión histórica',()=>{const {ed,history,change,store}=setup();ed.enterEdit();change(1);ed.exitEditMode();history.undo();history.redo();assert.equal(ed.edit,null);assert.equal(store.edit.on,false)})
test('Conversión de primitiva sigue siendo una operación; no se deshace dentro de su sesión incompatible',()=>{const {ed,history,store,getObject}=setup('primitive');ed.enterEdit();const session=ed.edit;assert.equal(store.canUndo,true);assert.throws(()=>history.undo(),/incompatible/);assert.equal(ed.edit,session);assert.equal(store.canUndo,true);assert.equal(getObject('mesh').type,'mesh');ed.exitEditMode();history.undo();assert.equal(getObject('mesh').type,'primitive');history.redo();assert.equal(getObject('mesh').type,'mesh');assert.equal(ed.edit,null)})
test('Preflight rechaza la pérdida del nodo activo antes de cambiar escena o índice',()=>{const {ed,store,history,getObject}=setup();const mesh=getObject('mesh');store.project.objects=store.project.objects.filter(o=>o.id!=='mesh');history.resetHistory();store.project.objects.push(mesh);history.commit('Crear malla');ed.enterEdit();assert.throws(()=>history.undo(),/incompatible/);assert.equal(store.canUndo,true);assert.equal(store.canRedo,false);assert.equal(getObject('mesh'),mesh)})
test('Preflight no consume historial cuando hay una operación modal sin confirmar',()=>{const {ed,history,store,change}=setup();ed.enterEdit();change(1);ed.edit.modal={kind:'grab'};assert.throws(()=>history.undo(),/Confirma o cancela/);assert.equal(store.canUndo,true);assert.equal(store.canRedo,false)})
test('Undo no sustituye el nodo activo por una selección histórica',()=>{const {store,history,change}=setup();change(1);store.selectedId='other';store.selectedIds=['other'];history.undo();assert.equal(store.selectedId,'other');assert.equal(JSON.stringify(store.selectedIds),'["other"]');history.redo();assert.equal(store.selectedId,'other')})
test('Preflight protege padres bloqueados, referencias inválidas y ciclos',()=>{const {ed}=setup();ed.enterEdit();const mesh={id:'mesh',type:'mesh',props:{mesh:geom(0)},parentId:'parent'};for(const parent of [{id:'parent',locked:true},{id:'parent',parentId:'mesh'}])assert.throws(()=>ed.validateHistoryEdit({objects:JSON.stringify([mesh,parent])}),/bloquearía|Ciclo/);assert.throws(()=>ed.validateHistoryEdit({objects:JSON.stringify([{...mesh,props:{meshRef:'missing'}}])}),/incompatible/)})
test('Multiplicador general se aplica exactamente una vez a las cuatro sensibilidades',()=>{const prefs={mouseSensitivity:.5,mouseOrbit:2,mousePan:1.2,mouseZoom:3,flyLook:.8,padOrbit:2,padPan:3,padZoom:4,flySpeed:14,mouseInvertZoom:true};const before=copy(prefs);const out=effectiveNavigationPrefs(prefs);assert.equal(out.mouseOrbit,1);assert.equal(out.mousePan,.6);assert.equal(out.mouseZoom,1.5);assert.equal(out.flyLook,.4);for(const k of ['padOrbit','padPan','padZoom','flySpeed','mouseInvertZoom'])assert.equal(out[k],prefs[k]);assert.deepEqual(prefs,before);assert.equal(effectiveNavigationPrefs(prefs).mouseOrbit,1)})
test('Compatibilidad de preferencias antiguas y validación de límites',()=>{assert.equal(effectiveNavigationPrefs({}).mouseOrbit,1);for(const v of [undefined,NaN,Infinity,0,.09,3.01,'0.5'])assert.equal(mouseSensitivity(v),1);assert.equal(mouseSensitivity(.1),.1);assert.equal(mouseSensitivity(3),3)})
test('TOML, sincronización y ambos visores editoriales comparten el multiplicador',()=>{assert.match(read('electron/editor.toml'),/\[mouse\]\nsensitivity = 1\.0/);assert.match(read('electron/editor-config.cjs'),/\['mouse', 'sensitivity', 'mouseSensitivity', numeric\(0\.1, 3\)\]/);assert.match(read('src/core/editor/appearance.js'),/'mouseSensitivity'/);assert.match(read('src/core/editor.js'),/applyPrefs\(effectiveNavigationPrefs\(store\.prefs\)\)/);assert.match(read('src/core/editor/keys.js'),/applyPrefs\(effectiveNavigationPrefs\(p\)\)/);assert.match(read('src/components/SceneRuntimeObserver.vue'),/effectiveNavigationPrefs\(store\.prefs\)/)})
test('Preferencias conserva claves anteriores, categorías, búsqueda, campos y restablecimiento',()=>{const ui=read('src/components/PreferencesModal.vue');for(const key of ['navigation','mouseSensitivity','mouseOrbit','mousePan','mouseZoom','mouseInvertZoom','padOrbit','padPan','padZoom','padInvert','padInvertY','padZoomCursor','flySpeed','flySprint','flyLook','editorFov','gizmoSize','orientGizmo','tooltips','toolPalette','diskDelay','addAsChild','terrainCropWarning','inspLabelWidth','showGizmos','selectionStyle','selectionOutlineColor','selectionOutlineWidth','selectionOutlineStrength'])assert.ok(ui.includes(`['${key}',`),key);assert.match(ui,/normalize\('NFD'\)/);assert.match(ui,/visibleSections = computed/);assert.match(ui,/keys\.forEach\(resetOne\)/);assert.match(ui,/NumberField/);assert.match(ui,/data-pref-section/);assert.match(ui,/\@container win \(max-width:390px\)/)})

test('La validación distingue PolyMesh en memoria de su registro persistente',()=>{
  const poly=new PolyMesh([[0,0,0],[1,0,0],[0,1,0]],[[0,1,2]])
  poly.ensureUV()
  const record=poly.toJSON()
  assert.equal(finiteMesh(poly),true)
  assert.equal(finiteMesh(record),false)
  assert.equal(finiteMeshRecord(record),true)
  assert.equal(finiteMeshRecord(poly),false)
  assert.deepEqual(PolyMesh.fromJSON(record).v,poly.v)
})
test('Preflight persistente rechaza registros incompletos, dispersos, no finitos y desbordamientos',()=>{
  const record=geom(0)
  for(const v of [[1,2], [1,2,NaN], [0,Infinity,0], [0,1e40,0], [0,null,0], [0,,0], [[0,0,0]]]) assert.equal(finiteMeshRecord({...record,v}),false)
  for(const uv of [[[[0,NaN]]],[[[0,1e40]]],[[[0]]],[null],[[,]], [,,]]) assert.equal(finiteMeshRecord({...record,uv}),false)
  assert.equal(finiteMeshRecord({...record,v:[],f:[],we:[]}),true)
})
test('Undo/Redo de malla vinculada conserva la sesión y restaura el recurso serializado',()=>{
  const {ed,store,history,getObject}=setup();const mesh=getObject('mesh')
  store.project.meshes=[{id:'shared',mesh:mesh.props.mesh}];mesh.props={meshRef:'shared'};history.resetHistory();ed.enterEdit();const session=ed.edit
  store.project.meshes[0].mesh=geom(3);history.commit('Mover vértice');history.undo()
  assert.equal(ed.edit,session);assert.equal(store.project.meshes[0].mesh.v[0],0)
  history.redo();assert.equal(ed.edit,session);assert.equal(store.project.meshes[0].mesh.v[0],3)
})
test('Preflight conserva rechazo de historial con geometría persistente inválida',()=>{
  const {ed,store,history,getObject,change}=setup();getObject('mesh').props.mesh={...geom(0),v:[0,1]};history.resetHistory();change(2);ed.enterEdit();const session=ed.edit
  assert.throws(()=>history.undo(),/incompatible/);assert.equal(ed.edit,session);assert.equal(getObject('mesh').props.mesh.v[0],2);assert.equal(store.canUndo,true);assert.equal(store.canRedo,false)
})

test('El dispatcher editorial ejecuta Ctrl+Z, Ctrl+Shift+Z y Ctrl+Y sobre registros reales sin perder contexto',()=>{
  const {store,ed,history,change,getObject}=setup('primitive')
  Object.assign(store,{play:{on:false},gameView:{on:false},roadPaint:{active:false},modal:null,palette:false})
  store.edit.globalShortcuts=true;ed.pointer={inside:true};ed.enterEdit();const session=ed.edit
  change(1);change(2);session.mode='edge';store.edit.localView=true;ed._meshLocalView={session,view:{id:'camera'}}
  const handlers=new Map(),messages=[]
  const win={addEventListener:(name,fn,capture)=>{if(name==='keydown'&&!capture)handlers.set(name,fn)},removeEventListener(){}}
  const doc={addEventListener(){},removeEventListener(){}}
  session.onKey=runInNewContext(moduleSource('src/core/mesh/session-input.js')+'\n;inputMethods.onKey',{store,win})
  const keys=runInNewContext(moduleSource('src/core/editor/keys.js')+'\n;keysMethods',{store,win,doc,releasePropertyFocusOnEscape(){},isLocalMeshShortcut:()=>false,undo:history.undo,redo:history.redo,toast:(msg,kind)=>messages.push({msg,kind})})
  keys._bindKeys.call(ed)
  const press=(key,shiftKey=false,tagName='CANVAS')=>{
    const event={key,code:'Key'+key.toUpperCase(),ctrlKey:true,shiftKey,target:{tagName},prevented:false,preventDefault(){this.prevented=true},stopPropagation(){}}
    handlers.get('keydown')(event);return event.prevented
  }
  assert.equal(press('z',false,'INPUT'),false);assert.equal(getObject('mesh').props.mesh.v[0],2)
  assert.equal(press('z'),true);assert.equal(getObject('mesh').props.mesh.v[0],1)
  assert.equal(press('z'),true);assert.equal(getObject('mesh').props.mesh.v[0],0)
  assert.equal(press('z'),true);assert.equal(getObject('mesh').props.mesh.v[0],0);assert.equal(messages.length,1);assert.match(messages[0].msg,/incompatible/);assert.equal(messages[0].kind,'error');assert.equal(store.canUndo,true);assert.equal(store.canRedo,true)
  assert.equal(press('Z',true),true);assert.equal(getObject('mesh').props.mesh.v[0],1)
  assert.equal(press('y'),true);assert.equal(getObject('mesh').props.mesh.v[0],2)
  assert.equal(ed.edit,session);assert.equal(session.mode,'edge');assert.equal(store.edit.localView,true);assert.equal(ed._meshLocalView.view.id,'camera');assert.equal(messages.length,1)
})
