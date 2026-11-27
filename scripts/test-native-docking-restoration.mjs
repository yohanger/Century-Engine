import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { runInNewContext } from 'node:vm'
import { defaultDockLayout, moveDockPanel, floatDockPanel, findDockPanel, dockGroups, normalizeDockLayout } from '../src/core/editor/docking.js'
import { startDockGesture, startNativeDockTransfer, observeDockGesture } from '../src/core/editor/dock-gesture.js'
import { registerNativeTool, unregisterNativeTool } from '../src/core/editor/native-tool-registry.js'

const rect = { left: 0, top: 0, right: 100, bottom: 30, width: 100, height: 30 }
const source = file => fs.readFileSync(new URL('../'+file, import.meta.url), 'utf8')
function fakeWindow(x=0,y=0) {
  const listeners=new Map(), body={ captured:new Set(),setPointerCapture(id){this.captured.add(id)},hasPointerCapture(id){return this.captured.has(id)},releasePointerCapture(id){this.captured.delete(id)} }
  const win={screenX:x,screenY:y,innerWidth:800,innerHeight:600,addEventListener(n,f){listeners.set(n,f)},removeEventListener(n){listeners.delete(n)},dispatchEvent(){}}
  const doc={body,defaultView:win,elementFromPoint(){return null},hasFocus(){return win.focused}}
  body.ownerDocument=doc;win.focused=undefined
  return {win,doc,body,listeners}
}
function scenario(fn) {
  const old={window:globalThis.window,document:globalThis.document,requestAnimationFrame:globalThis.requestAnimationFrame,CustomEvent:globalThis.CustomEvent}
  const main=fakeWindow(100,100), popup=fakeWindow(1000,100), phases=[], moves=[], previews=[]
  main.win.lf={isElectron:true,beginToolWindowDrag:id=>phases.push('begin:'+id),endToolWindowDrag:id=>phases.push('end:'+id),moveToolWindow:(name,x,y)=>moves.push({name,x,y})}
  main.win.dispatchEvent=e=>previews.push(e.detail)
  Object.assign(globalThis,{window:main.win,document:main.doc,requestAnimationFrame:f=>f(),CustomEvent:class {constructor(type,{detail}){this.type=type;this.detail=detail}}})
  const store={prefs:{dockLayout:defaultDockLayout()}}, tool={name:'lf-tool-panel-1',closed:false,focus(){},document:popup.doc}
  registerNativeTool('hierarchy',tool)
  let target=null
  main.doc.elementFromPoint=()=>target
  const show=(zone='center',group='lf-dock-center',tab=null)=>{const g={dataset:{lfDockZone:zone,lfDockGroup:group},getBoundingClientRect:()=>({left:0,top:0,right:800,bottom:600,width:800,height:600})};target={closest(sel){if(sel==='[data-lf-dock-group]')return g;if(sel==='.lf-dock-tabs')return tab!==null?{}:null;if(sel==='[data-lf-dock-tab]')return tab?{dataset:{lfDockTab:tab}}:null;return null}}}
  const hide=()=>{target=null}
  const ev=(x,y,id=1,screenX=x+100,screenY=y+100)=>({pointerId:id,clientX:x,clientY:y,screenX,screenY,buttons:1})
  const handleListeners = new Map()
  const dragTarget={}
  const handle={getBoundingClientRect:()=>rect,closest:()=>null,addEventListener:(name,fn)=>handleListeners.set(name,fn),removeEventListener:name=>handleListeners.delete(name)}
  const start=(id='hierarchy',native=false)=>{const ctx=native?popup:main;handle.ownerDocument=ctx.doc;return startDockGesture({...ev(20,15,1,ctx.win.screenX+20,ctx.win.screenY+15),button:0,currentTarget:handle},id,store,native)}
  const emit=(name,e,ctx=main)=>ctx.listeners.get(name)?.(e && {type:name,currentTarget:ctx.win,target:dragTarget,...e})
  const data=new Map()
  const dataTransfer={get types(){return [...data.keys()]},setData:(type,value)=>data.set(type,value),getData:type=>data.get(type)}
  const drag=(name,x,y,ctx=main,transferData=dataTransfer)=>{
    const event={...ev(x,y,1,-400,-900),type:name,target:dragTarget,dataTransfer:transferData,preventDefault(){this.accepted=true},stopPropagation(){}}
    if(name==='dragstart') startNativeDockTransfer({...event,currentTarget:handle})
    else if(name==='dragend') handleListeners.get(name)?.({...event,currentTarget:handle})
    else ctx.listeners.get(name)?.(Object.assign(event,{currentTarget:ctx.win}))
    return event.accepted
  }
  try { fn({main,popup,store,show,hide,ev,start,emit,drag,dataTransfer,handleListeners,phases,moves,previews}) }
  finally { main.listeners.get('pagehide')?.();popup.listeners.get('pagehide')?.();unregisterNativeTool('hierarchy',tool);Object.assign(globalThis,old) }
}

test('Destino válido mantiene panel acoplado y muestra el destino durante el gesto',()=>scenario(({store,show,ev,start,emit,phases,previews,main})=>{
  assert.ok(start());show('right','lf-dock-right');emit('pointermove',ev(400,200));assert.equal(findDockPanel(store.prefs.dockLayout,'hierarchy').kind,'dock');assert.equal(previews.at(-1).zone,'right');assert.deepEqual(phases,[])
  emit('pointerup',ev(400,200));assert.equal(findDockPanel(store.prefs.dockLayout,'hierarchy').zone,'right');assert.equal(previews.at(-1),null);assert.equal(main.listeners.size,0);assert.equal(main.body.captured.size,0)
}))
test('Materializar y regresar durante el mismo gesto conserva destino y limpia captura',()=>scenario(({store,show,ev,start,emit,phases,main})=>{
  assert.ok(start());emit('pointermove',ev(850,100));assert.equal(findDockPanel(store.prefs.dockLayout,'hierarchy').kind,'float');show('center','lf-dock-center','gameView');emit('pointermove',ev(400,100));emit('pointerup',ev(400,100));assert.deepEqual(store.prefs.dockLayout.zones.center.tabs,['sceneView','hierarchy','gameView','codeView']);assert.deepEqual(phases,['begin:hierarchy','end:hierarchy']);assert.equal(main.listeners.size,0)
}))
test('Soltar fuera conserva ventana y Escape devuelve al grupo original no predeterminado',()=>scenario(({store,show,hide,ev,start,emit})=>{
  store.prefs.dockLayout=moveDockPanel(store.prefs.dockLayout,'hierarchy','right','lf-dock-right','top');const original=store.prefs.dockLayout;assert.ok(start());emit('pointermove',ev(850,100));emit('keydown',{key:'Escape'});assert.deepEqual(store.prefs.dockLayout,original);assert.ok(start());hide();emit('pointermove',ev(850,100));emit('pointerup',ev(850,100));assert.equal(findDockPanel(store.prefs.dockLayout,'hierarchy').kind,'float')
}))
test('El título nativo confirma el destino local del editor con coordenadas globales ajenas',()=>scenario(({store,popup,show,ev,start,emit,drag,moves,main,previews,handleListeners})=>{
  store.prefs.dockLayout=floatDockPanel(store.prefs.dockLayout,'hierarchy',{x:1000,y:100});assert.ok(start('hierarchy',true));assert.equal(main.listeners.size,0);assert.ok(popup.listeners.has('pointermove'))
  drag('dragstart',20,15,popup);emit('pointercancel',ev(20,15),popup)
  show('right','lf-dock-right');assert.equal(drag('dragover',400,200),undefined);assert.equal(previews.at(-1),null)
  assert.equal(drag('dragover',411,200),undefined);assert.equal(drag('dragover',412,200),true);assert.equal(previews.at(-1).zone,'right')
  drag('drop',412,200);assert.equal(findDockPanel(store.prefs.dockLayout,'hierarchy').zone,'right');assert.equal(previews.at(-1),null)
  assert.equal(popup.listeners.size,0);assert.equal(main.listeners.size,0);assert.equal(handleListeners.size,0);assert.deepEqual(moves,[])
}))
test('Abandonar el editor, cancelar o soltar fuera conserva la ventana y limpia la vista previa',()=>scenario(({store,popup,show,ev,start,emit,drag,moves,main,previews})=>{
  store.prefs.dockLayout=floatDockPanel(store.prefs.dockLayout,'hierarchy',{x:1000,y:100});const original=store.prefs.dockLayout
  for(const ending of ['dragend','Escape']){
    assert.ok(start('hierarchy',true));drag('dragstart',20,15,popup);drag('dragover',32,15,popup)
    show('right','lf-dock-right');assert.equal(drag('dragover',400,200),true);assert.equal(previews.at(-1).zone,'right')
    emit('dragleave',{});assert.equal(previews.at(-1),null)
    if(ending==='dragend') drag(ending,0,0,popup);else emit('keydown',{key:'Escape'},popup)
    assert.equal(store.prefs.dockLayout,original);assert.equal(popup.listeners.size,0);assert.equal(main.listeners.size,0)
  }
  assert.deepEqual(moves,[])
}))
test('Un drop externo o sobre un destino que desapareció no cambia la ubicación nativa',()=>scenario(({store,popup,show,hide,start,drag,previews})=>{
  store.prefs.dockLayout=floatDockPanel(store.prefs.dockLayout,'hierarchy',{x:1000,y:100});assert.ok(start('hierarchy',true));drag('dragstart',20,15,popup);drag('dragover',32,15,popup)
  show('right','lf-dock-right');assert.equal(drag('dragover',400,200),true)
  assert.equal(drag('drop',400,200,undefined,{getData:()=> 'project'}),undefined)
  hide();assert.equal(drag('drop',400,200),true);assert.equal(previews.at(-1),null);assert.equal(findDockPanel(store.prefs.dockLayout,'hierarchy').kind,'float')
}))
test('El drop nativo aplica la pestaña bajo el puntero al soltar',()=>scenario(({store,popup,show,start,drag})=>{
  store.prefs.dockLayout=floatDockPanel(store.prefs.dockLayout,'hierarchy',{x:1000,y:100});assert.ok(start('hierarchy',true));drag('dragstart',20,15,popup);drag('dragenter',32,15,popup)
  show('right','lf-dock-right');assert.equal(drag('dragover',400,200),true)
  show('center','lf-dock-center','gameView');drag('drop',400,15)
  assert.deepEqual(store.prefs.dockLayout.zones.center.tabs,['sceneView','hierarchy','gameView','codeView'])
}))
test('Destino inválido para vista obligatoria no cambia ubicación a zona auxiliar',()=>scenario(({store,show,ev,start,emit})=>{
  assert.ok(start('codeView'));show('right','lf-dock-right');emit('pointermove',ev(400,200));emit('pointerup',ev(400,200));assert.equal(findDockPanel(store.prefs.dockLayout,'codeView').zone,'center')
}))
test('Captura rechazada o botón perdido no deja un gesto huérfano',()=>scenario(({main,start,emit,ev,store})=>{
  main.body.setPointerCapture=()=>{};assert.ok(start());emit('pointermove',ev(400,200));assert.equal(main.listeners.size,0);assert.equal(findDockPanel(store.prefs.dockLayout,'hierarchy').kind,'dock');assert.ok(start());emit('pointermove',{...ev(400,200),buttons:0});assert.equal(main.listeners.size,0)
}))
test('Reordenación y persistencia sobreviven 100 ciclos sin duplicar identidades',()=>{
  let layout=defaultDockLayout();layout=moveDockPanel(layout,'console','bottom','lf-dock-bottom','center','project');assert.deepEqual(layout.zones.bottom.tabs,['console','project']);layout=moveDockPanel(layout,'console','bottom','lf-dock-bottom','center','');assert.deepEqual(layout.zones.bottom.tabs,['project','console']);
  for(let i=0;i<100;i++){layout=floatDockPanel(layout,'project',{x:-900,y:-200});assert.deepEqual(normalizeDockLayout(layout),layout);layout=moveDockPanel(layout,'project','right','lf-dock-right','left');layout=moveDockPanel(layout,'project','bottom','lf-dock-bottom','center');const ids=Object.values(layout.zones).flatMap(dockGroups).flatMap(g=>g.tabs).concat(layout.floats.map(f=>f.id),layout.hidden);assert.equal(new Set(ids).size,ids.length)}
})
for(const [file,name,marker] of [['AppWindow.vue','attachNative','function nativeDockEvent'],['FloatingEditorWindow.vue','restoreNativeDock','async function attachNative']])test(`${file}: regreso respeta grupo confirmado y solo restaura si falta`,()=>{
 const text=source('src/components/'+file);const from=text.indexOf('function '+name+'('),code=text.slice(from,text.indexOf(marker,from));let count=0;const store={prefs:{dockLayout:moveDockPanel(defaultDockLayout(),'database','right','lf-dock-right','left')}};const before=store.prefs.dockLayout;const ctx={props:{dockPanelId:'database'},nativeRequested:{value:true},store,findDockPanel,restoreDockPanel:()=>{count++;throw Error('no debe restaurar destino')},DOCK_PANELS:{database:['','','bottom']}};runInNewContext(code+'\nthis.run='+name,ctx);ctx.run();assert.equal(count,0);assert.equal(store.prefs.dockLayout,before);assert.equal(store.prefs.rightOpen,true)
})
test('La recuperación de ventanas conserva monitores negativos y devuelve títulos fuera de pantalla',()=>{
 const text=source('electron/main.cjs');const a=text.indexOf('function recoverToolWindowPosition(');const b=text.indexOf('function configureToolWindow(',a);assert.ok(a>=0&&b>a);const displays=[{workArea:{x:-1200,y:-200,width:1200,height:900}},{workArea:{x:0,y:0,width:1600,height:900}}];const ctx={screen:{getAllDisplays:()=>displays,getDisplayMatching:()=>displays[1]},console};runInNewContext(text.slice(a,b)+'\nthis.run=recoverToolWindowPosition',ctx);let moves=[];ctx.run({getBounds:()=>({x:-900,y:-100,width:500,height:400}),setPosition:(x,y)=>moves.push([x,y])});assert.deepEqual(moves,[]);ctx.run({getBounds:()=>({x:5000,y:4000,width:500,height:400}),setPosition:(x,y)=>moves.push([x,y])});assert.deepEqual(moves,[[1510,876]])
})


test('Diagnóstico separa destino válido, captura y apertura nativa sin cambiar el gesto',()=>scenario(({store,show,ev,start,emit,phases,main})=>{
  const trace=[];const stop=observeDockGesture(record=>trace.push(record))
  try {
    assert.ok(start());show('center','lf-dock-center');emit('pointermove',ev(400,200));
    assert.deepEqual(trace.map(r=>r.phase),['start','capture','hit-test']);
    assert.equal(trace[1].reason,'acquired');assert.equal(trace[1].actualCapture,true);
    assert.equal(trace[2].reason,'valid');assert.equal(trace[2].target.zone,'center');assert.equal(trace[2].owner,'editor');assert.equal(trace[2].panel,'hierarchy');assert.deepEqual(phases,[]);
    emit('pointerup',ev(400,200));assert.equal(trace.at(-1).phase,'committed');assert.equal(trace.at(-1).actualCapture,false);assert.equal(findDockPanel(store.prefs.dockLayout,'hierarchy').zone,'center');assert.equal(main.listeners.size,0)
  } finally { stop() }
}))
test('Diagnóstico distingue rechazo de captura y ausencia de destino',()=>scenario(({main,store,ev,start,emit,phases})=>{
  const trace=[];const stop=observeDockGesture(record=>trace.push(record));const capture=main.body.setPointerCapture
  try {
    main.body.setPointerCapture=()=>{};assert.ok(start());emit('pointermove',ev(400,200));assert.equal(trace.find(r=>r.phase==='capture').reason,'rejected');assert.equal(trace.some(r=>r.phase==='hit-test'),false);assert.equal(main.listeners.size,0);
    trace.length=0;main.body.setPointerCapture=capture;assert.ok(start());emit('pointermove',ev(400,200));assert.equal(trace.find(r=>r.phase==='hit-test').reason,'no-connected-group');assert.equal(trace.find(r=>r.phase==='native-request').reason,'no-valid-target');assert.deepEqual(phases,['begin:hierarchy']);emit('keydown',{key:'Escape'});assert.equal(findDockPanel(store.prefs.dockLayout,'hierarchy').kind,'dock')
  } finally { stop() }
}))
test('Desuscribir el diagnóstico no altera un gesto posterior',()=>scenario(({store,show,ev,start,emit})=>{
  const trace=[];const stop=observeDockGesture(record=>trace.push(record));stop();assert.ok(start());show('right','lf-dock-right');emit('pointermove',ev(400,200));emit('pointerup',ev(400,200));assert.equal(trace.length,0);assert.equal(findDockPanel(store.prefs.dockLayout,'hierarchy').zone,'right')
}))

test('Soltar el botón fuera de la secuencia invalida el destino sin confirmar el gesto',()=>scenario(({store,show,ev,start,emit,main,previews,phases})=>{
  assert.ok(start());show('center','lf-dock-center');emit('pointermove',ev(400,200));assert.equal(previews.at(-1).zone,'center');assert.equal(main.body.hasPointerCapture(1),true)
  emit('pointermove',{...ev(420,220),buttons:0});assert.equal(previews.at(-1),null);assert.equal(findDockPanel(store.prefs.dockLayout,'hierarchy').zone,'left');assert.equal(main.listeners.size,0);assert.equal(main.body.hasPointerCapture(1),false);assert.deepEqual(phases,[])
  emit('pointerup',ev(420,220));assert.equal(findDockPanel(store.prefs.dockLayout,'hierarchy').zone,'left')
}))
test('Perder la captura después de detectar un destino no confirma ni abre ventanas',()=>scenario(({store,show,ev,start,emit,main,previews,phases})=>{
  assert.ok(start());show('center','lf-dock-center');emit('pointermove',ev(400,200));assert.equal(previews.at(-1).zone,'center');main.body.captured.delete(1)
  emit('lostpointercapture',{...ev(400,200),target:main.body,type:'lostpointercapture'});assert.equal(previews.at(-1),null);assert.equal(findDockPanel(store.prefs.dockLayout,'hierarchy').zone,'left');assert.equal(main.listeners.size,0);assert.deepEqual(phases,[])
  assert.ok(start());emit('pointermove',ev(400,200));emit('pointerup',ev(400,200));assert.equal(findDockPanel(store.prefs.dockLayout,'hierarchy').zone,'center')
}))


test('La pérdida de foco hacia la ventana creada por Docking conserva el gesto original',()=>scenario(({main,popup,store,show,ev,start,emit,phases})=>{
  main.win.focused=true;popup.win.focused=false;assert.ok(start());emit('pointermove',ev(850,100));assert.equal(findDockPanel(store.prefs.dockLayout,'hierarchy').kind,'float');
  main.win.focused=false;popup.win.focused=true;main.body.captured.delete(1);emit('blur');
  assert.ok(main.listeners.has('pointermove'));show('center','lf-dock-center');emit('pointermove',ev(400,200));emit('pointerup',ev(400,200));assert.equal(findDockPanel(store.prefs.dockLayout,'hierarchy').zone,'center');assert.deepEqual(phases,['begin:hierarchy','end:hierarchy']);assert.equal(main.listeners.size,0)
}))
test('Una entrada del editor antes del foco tardío del popup no cierra la transición',()=>scenario(({main,popup,store,show,ev,start,emit,phases})=>{
  main.win.focused=true;popup.win.focused=false;assert.ok(start());emit('pointermove',ev(850,100));assert.equal(findDockPanel(store.prefs.dockLayout,'hierarchy').kind,'float')
  show('center','lf-dock-center');emit('pointermove',ev(400,200))
  main.win.focused=false;popup.win.focused=true;main.body.captured.delete(1);emit('blur')
  emit('lostpointercapture',{...ev(400,200),target:main.body});emit('pointerup',ev(400,200));assert.equal(findDockPanel(store.prefs.dockLayout,'hierarchy').zone,'center');assert.deepEqual(phases,['begin:hierarchy','end:hierarchy']);assert.equal(main.listeners.size,0)
}))
test('Una pérdida de foco antes de solicitar ventana cancela sin confirmar',()=>scenario(({main,store,show,ev,start,emit})=>{
  main.win.focused=true;assert.ok(start());show('center','lf-dock-center');emit('pointermove',ev(400,200));main.win.focused=false;emit('blur');assert.equal(main.listeners.size,0);assert.equal(findDockPanel(store.prefs.dockLayout,'hierarchy').zone,'left')
}))
test('La transición de foco no admite una liberación desde un foco ajeno',()=>scenario(({main,popup,store,show,ev,start,emit,phases})=>{
  main.win.focused=true;popup.win.focused=false;assert.ok(start());emit('pointermove',ev(850,100));main.win.focused=false;popup.win.focused=true;main.body.captured.delete(1);emit('blur');popup.win.focused=false;show('center','lf-dock-center');emit('pointerup',ev(400,200));assert.equal(findDockPanel(store.prefs.dockLayout,'hierarchy').kind,'float');assert.equal(main.listeners.size,0);assert.deepEqual(phases,['begin:hierarchy','end:hierarchy'])
}))

test('La pérdida de captura durante el cambio al popup propio no elimina la autoridad y Escape limpia ambos documentos',()=>scenario(({main,popup,store,ev,start,emit,phases})=>{
 main.win.focused=true;popup.win.focused=false;assert.ok(start());emit('pointermove',ev(850,100));main.win.focused=false;popup.win.focused=true;main.body.captured.delete(1);
 emit('lostpointercapture',{...ev(850,100),target:main.body,type:'lostpointercapture'});assert.ok(main.listeners.has('pointermove'));assert.ok(popup.listeners.has('keydown'));emit('keydown',{key:'Escape'},popup);assert.equal(findDockPanel(store.prefs.dockLayout,'hierarchy').kind,'dock');assert.equal(main.listeners.size,0);assert.equal(popup.listeners.size,0);assert.deepEqual(phases,['begin:hierarchy','end:hierarchy'])
}))
test('Un nuevo clic o la destrucción del documento cancela la transición pendiente',()=>scenario(({main,popup,store,ev,start,emit})=>{
 for(const event of ['pointerdown','pagehide']){main.win.focused=true;popup.win.focused=false;store.prefs.dockLayout=defaultDockLayout();assert.ok(start());emit('pointermove',ev(850,100));main.win.focused=false;popup.win.focused=true;emit('blur');emit(event,{button:0},popup);assert.equal(main.listeners.size,0);assert.equal(popup.listeners.size,0)}
}))
test('La cabecera mueve la ventana y solo el título o pestaña inicia Docking',()=>{
 for(const file of ['AppWindow.vue','FloatingEditorWindow.vue']){
  const text=source('src/components/'+file);const appWindow=file==='AppWindow.vue';
  const header=appWindow?'aw-bar':'native-tool-title',tab=appWindow?'native-dock-title':'native-code-tab';
  assert.doesNotMatch(text,/<header[^>]+nativeTitleDown/);assert.doesNotMatch(text,/native-dock-handle/);
  assert.match(text,new RegExp('\\.'+header+'\\s*\\{[^}]*-webkit-app-region:\\s*drag'));
  assert.match(text,new RegExp('\\.'+tab+'\\s*\\{[^}]*-webkit-app-region:\\s*no-drag'));
  assert.match(text,new RegExp('<span[^>]+\\b'+tab+'\\b[^>]+@pointerdown="nativeTitleDown"'));
  const start=text.indexOf('function nativeTitleDown('),end=text.indexOf('\n}',start)+2;let calls=0;const ctx={nativeTarget:{value:{}},props:{dockPanelId:'hierarchy'},store:{},startDockGesture:()=>calls++};runInNewContext(text.slice(start,end)+'\nthis.run=nativeTitleDown',ctx);ctx.run({target:{closest:()=>({})}});assert.equal(calls,0);ctx.run({target:{closest:()=>null}});assert.equal(calls,1)
 }
})

test('Una transición sin eventos posteriores expira y restaura la entrada sin confirmar un destino',(t)=>{
 t.mock.timers.enable({apis:['setTimeout']});
 scenario(({main,popup,store,ev,start,emit,phases})=>{
  main.win.focused=true;popup.win.focused=false;assert.ok(start());emit('pointermove',ev(850,100));main.win.focused=false;popup.win.focused=true;main.body.captured.delete(1);emit('blur');assert.ok(main.listeners.has('pointermove'));t.mock.timers.tick(1200);assert.equal(main.listeners.size,0);assert.equal(popup.listeners.size,0);assert.equal(findDockPanel(store.prefs.dockLayout,'hierarchy').kind,'float');assert.deepEqual(phases,['begin:hierarchy','end:hierarchy'])
 })
})

test('El posicionamiento distingue rechazo, posición no confirmada y posición observada sin repetir diagnósticos',()=>{
 const text=source('electron/main.cjs'),a=text.indexOf('const toolPositionDiagnostics ='),b=text.indexOf('function recoverToolWindowPosition(',a);assert.ok(a>=0&&b>a);
 const reports=[],timers=new Map();let serial=0,position=[5,6],reject=false,move=false;
 const ctx={app:{commandLine:{getSwitchValue:()=> 'wayland'}},process:{env:{XDG_SESSION_TYPE:'wayland'}},console:{warn:(_tag,d)=>reports.push(d),info:(_tag,d)=>reports.push(d)},setTimeout:fn=>{const id=++serial;timers.set(id,fn);return id},clearTimeout:id=>timers.delete(id)};
 runInNewContext(text.slice(a,b)+'\nthis.run=requestToolPosition',ctx);
 const tool={id:3,isDestroyed:()=>false,getPosition:()=>position,setPosition:(x,y)=>{if(reject)throw Error('unsupported');if(move)position=[x,y]}};
 const flush=()=>{for(const [id,fn] of [...timers]){timers.delete(id);fn()}};
 ctx.run(tool,20,30);flush();assert.equal(reports.at(-1).status,'unconfirmed');assert.equal(reports.at(-1).actual[0],5);
 ctx.run(tool,21,31);flush();assert.equal(reports.length,1);
 reject=true;ctx.run(tool,22,32);assert.equal(reports.at(-1).status,'rejected');assert.equal(reports.at(-1).error,'unsupported');
 reject=false;move=true;ctx.run(tool,23,33);ctx.run(tool,24,34);assert.equal(timers.size,1);flush();assert.equal(reports.at(-1).status,'observed');assert.equal(reports.at(-1).actual[0],24);
})
