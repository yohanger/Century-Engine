const {app,BrowserWindow,screen}=require('electron')
const {spawnSync}=require('node:child_process')
const fs=require('node:fs'),os=require('node:os'),path=require('node:path')
const [url]=process.argv.slice(-2)
if(!/^http:\/\/127\.0\.0\.1:\d+\//.test(url))throw Error('URL local requerida')
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'century-dock-qa-'))
app.setPath('userData',profile);process.env.VITE_DEV_URL=url
const checks=[],inputs=[],windows=[];let latest=null,initial=null
const requestedBackend=app.commandLine.getSwitchValue('ozone-platform')||null
const inputEnvironment={requestedBackend,requested:process.env.LF_QA_DOCK_INPUT||null,platform:process.platform,displayAvailable:!!process.env.DISPLAY,sessionType:process.env.XDG_SESSION_TYPE||null,waylandDisplayAvailable:!!process.env.WAYLAND_DISPLAY}
const inputMode=inputEnvironment.requested || (inputEnvironment.platform==='linux'&&inputEnvironment.displayAvailable&&(requestedBackend==='x11'||(!requestedBackend&&inputEnvironment.sessionType!=='wayland'))?'x11':'cdp')
inputEnvironment.reason=inputEnvironment.requested?'explicit-override':inputMode==='x11'?(requestedBackend==='x11'?'explicit-x11-backend':'linux-x11-display'):'no-eligible-x11-session'
const detachScenarios=[];let nativeGeometry=null,nativeMove=null
if(!['x11','cdp'].includes(inputMode))throw Error('LF_QA_DOCK_INPUT debe ser x11 o cdp')
let ownedPress=false,activeWindow=null
function x11(action,point){
 const args=[path.join(__dirname,'qa-x11-pointer.py'),action,...(point?[String(Math.round(point.x)),String(Math.round(point.y))]:[])]
 const result=spawnSync('python3',args,{encoding:'utf8',timeout:5000})
 if(result.error||result.status!==0)throw Error(`Entrada X11 ${action}: ${result.error?.message||result.stderr?.trim()||result.status}`)
 return JSON.parse(result.stdout)
}
function screenPoint(w,p){
 const b=w.getContentBounds(),z=w.webContents.getZoomFactor(),dip={x:Math.round(b.x+p.x*z),y:Math.round(b.y+p.y*z)}
 if(typeof screen.dipToScreenPoint==='function')return screen.dipToScreenPoint(dip)
 if(screen.getDisplayNearestPoint(dip).scaleFactor!==1)throw Error('No hay conversión DIP a píxel para el destino X11')
 return dip
}
function cursorPoint(){try{return screen.getCursorScreenPoint()}catch{return null}}
function releaseInput(){
 if(!ownedPress)return
 if(inputMode==='x11'){x11('cleanup');ownedPress=false;return}
 if(activeWindow&&!activeWindow.isDestroyed()){
  const d=activeWindow.webContents.debugger
  if(d.isAttached())return d.sendCommand('Input.dispatchMouseEvent',{type:'mouseReleased',x:0,y:0,button:'left',buttons:0,clickCount:1}).finally(()=>{ownedPress=false})
 }
 ownedPress=false
}
const keep=(items,value)=>{items.push(value);if(items.length>20)items.shift()}
const check=(name,value,details=null)=>{checks.push({name,passed:!!value,...(details?{details}:{})});if(!value)throw Error(name)}
function checkTogether(items){for(const [name,value,details] of items)checks.push({name,passed:!!value,...(details?{details}:{})});const failed=items.filter(([,value])=>!value);if(failed.length)throw Error(failed.map(([name])=>name).join('; '))}
function diagnosticData(){return {checks,inputs,windows,initial,latest,inputMode,inputEnvironment,detachScenarios,nativeGeometry,nativeMove}}
const wait=ms=>new Promise(r=>setTimeout(r,ms))
async function poll(fn){for(let i=0;i<100;i++){const v=await fn();if(v)return v;await wait(60)}throw Error('Tiempo agotado esperando estado de Docking')}
function point(w,sel){return w.webContents.executeJavaScript(`(()=>{const element=document.querySelector(${JSON.stringify(sel)});const r=element?.getBoundingClientRect();if(!r)return null;const x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);return {x,y,selector:${JSON.stringify(sel)},rect:{left:r.left,top:r.top,width:r.width,height:r.height},hit:{tag:hit?.tagName??null,id:hit?.id??null,tab:hit?.closest?.("[data-lf-dock-tab]")?.dataset?.lfDockTab??null,group:hit?.closest?.("[data-lf-dock-group]")?.dataset?.lfDockGroup??null}}})()`)}
async function mouse(w,type,p){
 if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))throw Error('Punto de entrada inválido: '+type)
 const record={type,point:p,window:w.id,contentBounds:w.getContentBounds(),zoom:w.webContents.getZoomFactor(),inputMode,osBefore:cursorPoint()};keep(inputs,record)
 if(inputMode==='x11'){
  const action={mousePressed:'press',mouseMoved:'move',mouseReleased:'release'}[type]
  if(action==='press'){
   if(ownedPress||x11('query').after.left)throw Error('Botón izquierdo ocupado antes del gesto X11')
  }
  record.physicalPoint=screenPoint(w,p);record.physical=x11(action,record.physicalPoint)
  if(action==='press')ownedPress=true
  if(action==='release')ownedPress=false
 }else{
  const d=w.webContents.debugger;if(!d.isAttached())d.attach('1.3')
  if(type==='mousePressed'){activeWindow=w;ownedPress=true}
  await d.sendCommand('Input.dispatchMouseEvent',{type,x:p.x,y:p.y,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:type==='mouseMoved'?0:1})
  if(type==='mouseReleased')ownedPress=false
 }
 await wait(130);record.osAfter=cursorPoint()
}
async function sendNativeDockInput(w,p,title,dest){
 if(inputMode==='x11'){
  const mainOrigin=w.getContentBounds(),popupOrigin=p.getContentBounds(),mainZoom=w.webContents.getZoomFactor(),popupZoom=p.webContents.getZoomFactor()
  const globalTarget={x:mainOrigin.x+dest.x*mainZoom,y:mainOrigin.y+dest.y*mainZoom}
  const local={x:(globalTarget.x-popupOrigin.x)/popupZoom,y:(globalTarget.y-popupOrigin.y)/popupZoom}
  nativeGeometry={mainOrigin,popupOrigin,mainZoom,popupZoom,globalTarget,local}
  await mouse(p,'mousePressed',title)
  await mouse(p,'mouseMoved',{x:title.x,y:title.y+20})
  await mouse(p,'mouseMoved',local)
  return ()=>mouse(p,'mouseReleased',local)
 }
 const source=p.webContents.debugger,editor=w.webContents.debugger
 if(!source.isAttached())source.attach('1.3')
 if(!editor.isAttached())editor.attach('1.3')
 let data=null
 const intercept=(_event,method,params)=>{if(method==='Input.dragIntercepted')data=params.data}
 source.on('message',intercept)
 try {
  await source.sendCommand('Input.setInterceptDrags',{enabled:true})
  await mouse(p,'mousePressed',title)
  await mouse(p,'mouseMoved',{x:title.x+8,y:title.y})
  const departure={x:title.x,y:title.y+20}
  await mouse(p,'mouseMoved',departure)
  await poll(()=>data)
  const send=(debuggerClient,type,point)=>debuggerClient.sendCommand('Input.dispatchDragEvent',{type,x:point.x,y:point.y,data})
  await send(source,'dragEnter',departure)
  await send(source,'dragOver',departure)
  await send(editor,'dragEnter',dest)
  await send(editor,'dragOver',dest)
  nativeGeometry={source:departure,editor:dest,transport:'cdp-drag-intercepted'}
  return async()=>{
   await send(editor,'drop',dest)
   await releaseInput()
  }
 } finally { source.off('message',intercept) }
}
function popup(w){return BrowserWindow.getAllWindows().find(t=>t!==w&&!t.isDestroyed()&&t.__lfToolName?.startsWith('lf-tool-panel-'))}
let done=false
async function run(w){try{
 const state=()=>w.webContents.executeJavaScript('window.__dockQA?.() || null');const snapshot=async()=>{latest=await w.webContents.executeJavaScript('window.__dockQADiagnostics?.() || null');return latest};await poll(state);w.show();w.focus();await poll(()=>w.isFocused());await wait(150);if(inputMode==='x11')x11('query')
 const tab=()=>point(w,'[data-lf-dock-tab="hierarchy"]');const center=()=>point(w,'#qa-center .lf-dock-body');const detachPoints=async()=>{const plan=await w.webContents.executeJavaScript('window.__dockQADetachPoints?.() || null');check('Destino sin grupo y umbral calculados',!!plan,{plan});detachScenarios.push(plan);return plan};
 const detach=async()=>{
  const plan=await detachPoints();
  await mouse(w,'mousePressed',plan.source);
  await mouse(w,'mouseMoved',plan.before);
  const before=await state();
  await snapshot();
  const lastHit=latest.trace.at(-1);
  checkTogether([
   ['Antes del umbral no abre ventana',!before.native&&!popup(w)&&before.where.kind==='dock',{before,plan}],
   ['Antes del umbral no hay destino',!before.preview&&lastHit?.reason==='no-connected-group',{trace:lastHit}],
  ]);
  await mouse(w,'mouseMoved',plan.crossing);
  await snapshot();
  const started=latest.lifecycle.findLastIndex(r=>r.phase==='start');
  const phases=latest.lifecycle.slice(started);
  check('Umbral cruzado solicita ventana',started>=0&&phases.some(r=>r.phase==='native-request'),{plan,phases,trace:latest.trace.slice(-5)});
  await poll(()=>popup(w));
  return plan;
 };
 check('Instancia inicial única',(await state()).mounts===1)
 const source=await tab(),destCenter=await center();const initialSnapshot=await snapshot();initial={state:initialSnapshot?.state,layout:initialSnapshot?.layout,viewport:initialSnapshot?.viewport}
 await mouse(w,'mousePressed',source);await mouse(w,'mouseMoved',destCenter);const firstDrop=await state();await snapshot()
 checkTogether([
  ['Destino válido no abre ventana',!firstDrop.native&&!popup(w),{registered:firstDrop.native,window:!!popup(w)}],
  ['Destino centro detectado',firstDrop.preview?.zone==='center',{preview:firstDrop.preview}],
 ])
 await mouse(w,'mouseReleased',await center());check('Destino centro conservado',(await state()).where.zone==='center');check('Vista previa limpia',!(await state()).preview)
 await detach();check('Ventana Electron real',!!popup(w));check('Identidad flotante',(await state()).where.kind==='float');await mouse(w,'mouseMoved',await center());await mouse(w,'mouseReleased',await center());await poll(()=>!popup(w));check('Retorno en el mismo gesto',(await state()).where.zone==='center');check('Contenido único después del retorno',(await state()).mounts===1&&(await state()).payload==='7')
 const secondDetach=await detach();await mouse(w,'mouseReleased',secondDetach.crossing);const p=await poll(()=>popup(w));check('Soltar sin destino conserva ventana',(await state()).where.kind==='float');p.focus();await wait(150)
 if(inputMode==='x11'){
  const grip=await point(p,'.aw-grow'),before=p.getContentBounds();
  check('Cabecera libre para movimiento del sistema',!!grip&&grip.rect.width>=12,{grip});
  const work=screen.getDisplayMatching(before).workArea;
  const zoom=p.webContents.getZoomFactor(),origin={x:before.x+grip.x*zoom,y:before.y+grip.y*zoom};
  const dx=before.x-200>=work.x?-200:Math.min(160,work.x+work.width-1-origin.x);
  const dy=before.y+before.height+30<=work.y+work.height?30:-30;
  const target={x:origin.x+dx,y:origin.y+dy};
  await snapshot();const starts=latest.lifecycle.filter(r=>r.phase==='start').length;
  await mouse(p,'mousePressed',grip);
  for(const progress of [0.25,0.6,1]){
   const current=p.getContentBounds();
   await mouse(p,'mouseMoved',{x:(origin.x+dx*progress-current.x)/zoom,y:(origin.y+dy*progress-current.y)/zoom});
  }
  const moved=p.getContentBounds();await mouse(p,'mouseReleased',{x:(target.x-moved.x)/zoom,y:(target.y-moved.y)/zoom});
  const after=p.getContentBounds();nativeMove={before,after,target,inputMode};await snapshot();
  checkTogether([['Movimiento físico de ventana nativa',Math.hypot(after.x-before.x,after.y-before.y)>=12,nativeMove],['Mover cabecera no inicia Docking',latest.lifecycle.filter(r=>r.phase==='start').length===starts&&!!popup(w)&&(await state()).where.kind==='float']]);
 }else nativeMove={status:'NO VERIFICADO',reason:'CDP no acredita el movimiento de la cabecera por el compositor; requiere QA manual'};
 const title=await point(p,'.native-dock-title');check('Título de ventana admite arrastre',!!title)
 const dest=await point(w,'#qa-right .lf-dock-body');const drop=await sendNativeDockInput(w,p,title,dest)
 await snapshot();check('Vista previa del título nativo en el destino derecho',(await state()).preview?.zone==='right',{trace:latest?.trace?.slice(-8)})
 await drop();await poll(()=>!popup(w));check('Reacoplamiento desde título real',(await state()).where.zone==='right');check('Contenido y selección sobreviven',(await state()).mounts===1&&(await state()).payload==='7');check('Entradas confiables recibidas',(await state()).trusted>=3);if(inputMode==='x11')check('Botón izquierdo del sistema liberado',!x11('query').after.left)
 await releaseInput();console.log('LF_WEBGL_QA_RESULT:'+JSON.stringify({ok:true,data:{checks,gl:'Electron BrowserWindow / shell e IPC productivos; entradas '+inputMode,inputMode,inputEnvironment,detachScenarios,nativeGeometry,nativeMove}}))
 }catch(e){try{latest=await w.webContents.executeJavaScript('window.__dockQADiagnostics?.() || null')}catch{}console.log('LF_WEBGL_QA_RESULT:'+JSON.stringify({ok:false,error:String(e.stack||e),data:diagnosticData()}))}finally{try{await releaseInput()}catch(e){console.error('Liberación de entrada QA:',e.message)}done=true;app.exit(0)}}
let first=true;app.on('browser-window-created',(_e,w)=>{keep(windows,{event:'created',id:w.id,bounds:w.getContentBounds()});const id=w.id;w.once('closed',()=>keep(windows,{event:'closed',id}));if(!first)return;first=false;w.webContents.once('did-finish-load',()=>void run(w))})
app.on('quit',()=>{try{fs.rmSync(profile,{recursive:true,force:true})}catch{}})
setTimeout(async()=>{if(!done){try{await releaseInput()}catch(e){console.error('Liberación de entrada QA:',e.message)}console.log('LF_WEBGL_QA_RESULT:'+JSON.stringify({ok:false,error:'Timeout de fixture Electron',data:diagnosticData()}));app.exit(1)}},45000).unref()
require('../electron/main.cjs')
