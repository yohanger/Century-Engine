import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { watch as watchFs, existsSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import net from 'node:net'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url)
const {createVSCodeBridge,DESCRIPTOR}=require('../electron/vscode-bridge.cjs')
const {startVSCodeBridge}=require('../vscode-extension/lib/bridge.js')
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
async function until(check){for(let n=0;n<100;n++){if(check())return;await sleep(10)}assert.fail('Condición de conexión no alcanzada')}

async function workspace(t,name='Proyecto con espacios & símbolos'){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'lf-vscode-s04-')),root=path.join(dir,name)
 await fs.mkdir(path.join(root,'Assets'),{recursive:true});await fs.mkdir(path.join(root,'.levelforge'))
 await fs.writeFile(path.join(root,'project.lfproj'),'{}')
 for(const file of ['A.js','B.js'])await fs.writeFile(path.join(root,'Assets',file),'// QA\n')
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));return root
}
function extension(root,{delay=0,focused=true,version='0.1.4'}={}){
 const listeners=new Set(), opened=[], watchers=[]
 const vscode={
  env:{appName:'VS Code QA controlado'},Uri:{file:fsPath=>({fsPath})},RelativePattern:class{constructor(base,pattern){this.base=base;this.pattern=pattern}},
  commands:{executeCommand:async command=>opened.push({command})},
  workspace:{workspaceFolders:[{uri:{fsPath:root}}],onDidChangeWorkspaceFolders:()=>({dispose(){}}),
   openTextDocument:async uri=>({uri}),
   createFileSystemWatcher(pattern){
    const events={create:new Set(),change:new Set(),delete:new Set()}
    const watcher=watchFs(path.join(pattern.base,'.levelforge'),(_,name)=>{
     if(name!==path.basename(pattern.pattern))return
     const handlers=existsSync(path.join(pattern.base,pattern.pattern))?[...events.create,...events.change]:[...events.delete]
     for(const fn of handlers)fn()
    });watchers.push(watcher)
    const subscribe=kind=>fn=>{events[kind].add(fn);return{dispose:()=>events[kind].delete(fn)}}
    return {onDidCreate:subscribe('create'),onDidChange:subscribe('change'),onDidDelete:subscribe('delete'),dispose:()=>watcher.close()}
   }},
  window:{state:{focused},onDidChangeWindowState:fn=>{listeners.add(fn);return{dispose:()=>listeners.delete(fn)}},
   showTextDocument:async document=>{if(delay)await sleep(delay);opened.push(document.uri.fsPath)}},
 }
 const client=startVSCodeBridge(vscode,version)
 return{opened,focus:focused=>{vscode.window.state.focused=focused;for(const fn of listeners)fn({focused})},dispose:()=>client.dispose()}
}
function bridgeFor(t,options={}){
 const clients=[],launches=[]
 const bridge=createVSCodeBridge({graceMs:30,connectMs:1000,requestMs:500,launch:async root=>{launches.push(root);clients.push(extension(root,options));return{ok:true,extension:{status:'current',version:'0.1.4'}}},...options})
 t.after(async()=>{for(const client of clients)client.dispose();await bridge.close()})
 return{bridge,clients,launches}
}

test('S04: arranque y reaperturas usan cliente productivo sobre TCP real y cero CLI en caliente',async t=>{
 const root=await workspace(t),{bridge,clients,launches}=bridgeFor(t)
 assert.equal((await bridge.open(root,path.join(root,'Assets/A.js'))).ok,true)
 const before=bridge.stats()
 for(let i=0;i<5;i++)assert.equal((await bridge.open(root,path.join(root,'Assets/B.js'))).ok,true)
 assert.equal(launches.length,1);assert.equal(bridge.stats().launches,before.launches)
 assert.equal(clients[0].opened.length,6);assert.ok(clients[0].opened.every(file=>file.startsWith(root)))
 assert.equal(bridge.stats().acknowledgements,6)
})
test('S04 CORR-002: abrir y confirmar antes de que termine el CLI que mantiene la ventana',async t=>{
 const root=await workspace(t);let finishLaunch,client
 const holding=new Promise(resolve=>{finishLaunch=resolve})
 const {bridge}=bridgeFor(t,{launch:async directory=>{client=extension(directory);await holding;return{ok:true,extension:{status:'current',version:'0.1.4'}}}})
 t.after(()=>{finishLaunch();client?.dispose()})
 const opening=bridge.open(root,path.join(root,'Assets/A.js'))
 const result=await Promise.race([opening,sleep(600).then(()=>({ok:false,error:'La apertura esperó al cierre del CLI pese a tener un cliente conectado.'}))])
 assert.equal(result.ok,true,result.error)
 assert.equal(bridge.stats().connections,1);assert.equal(bridge.stats().acknowledgements,1)
 assert.equal(client.opened.at(-1),path.join(root,'Assets/A.js'))
 finishLaunch()
})
test('S04 CORR-002: lanzador productivo no mata CLI conectado ni propaga un error tardío',async t=>{
 const {openVSCode}=require('../electron/vscode.cjs'),root=await workspace(t)
 let client,finishCLI,openingSignal,calls=0,cliFinished=false
 const run=(_command,args,options,done)=>{
  calls++
  if(args.includes('--version'))done(null,'1.100.0\n')
  else if(args.includes('--list-extensions'))done(null,'levelforge.levelforge@0.1.5\n')
  else {
   assert.equal(options.timeout,0);openingSignal=options.signal;assert.ok(openingSignal)
   finishCLI=()=>{cliFinished=true;done(Error('El CLI terminó después de abrir la ventana.'))}
   client=extension(root)
  }
 }
 const bridge=createVSCodeBridge({graceMs:10,connectMs:1000,requestMs:500,launch:(dir,file,connection)=>openVSCode(dir,file,{launchers:[{command:'controlled-code'}],run,...connection})})
 t.after(async()=>{finishCLI?.();client?.dispose();await bridge.close()})
 const first=await bridge.open(root,path.join(root,'Assets/A.js'))
 assert.equal(first.ok,true,first.error);assert.equal(first.extension.status,'current')
 assert.equal(cliFinished,false);assert.equal(openingSignal.aborted,false)
 finishCLI();await sleep(20)
 assert.equal((await bridge.open(root,path.join(root,'Assets/B.js'))).ok,true)
 assert.equal(calls,3);assert.equal(bridge.stats().acknowledgements,2)
 await bridge.release(root);assert.equal(openingSignal.aborted,false)
})
test('S04 CORR-002: timeout tras preparar cancela CLI pendiente sin cliente',async t=>{
 const root=await workspace(t);let aborted=false
 const {bridge}=bridgeFor(t,{connectMs:30,launch:async(_root,_file,{signal,onPrepared})=>{
  onPrepared({status:'current',version:'0.1.4'})
  return await new Promise(resolve=>signal.addEventListener('abort',()=>{aborted=true;resolve({ok:false,error:'Abortado'})},{once:true}))
 }})
 const result=await bridge.open(root,null)
 assert.equal(result.ok,false);assert.match(result.error,/No se conectó/);assert.equal(aborted,true)
 assert.equal(bridge.stats().requests,0)
})
test('S04 CORR-002: cerrar proyecto cancela arranque pendiente antes de conectar',async t=>{
 const root=await workspace(t);let started=false,aborted=false
 const {bridge}=bridgeFor(t,{launch:async(_root,_file,{signal,onPrepared})=>{
  started=true;onPrepared({status:'current',version:'0.1.4'})
  return await new Promise(resolve=>signal.addEventListener('abort',()=>{aborted=true;resolve({ok:false,error:'Abortado'})},{once:true}))
 }})
 const opening=bridge.open(root,null);await until(()=>started);await bridge.release(root)
 assert.equal((await opening).canceled,true);assert.equal(aborted,true)
})
test('S04 CORR-002: dos archivos comparten CLI pendiente y ambos reciben ACK',async t=>{
 const root=await workspace(t);let finishLaunch,client
 const holding=new Promise(resolve=>{finishLaunch=resolve})
 const {bridge,launches}=bridgeFor(t,{launch:async directory=>{launches.push(directory);client=extension(directory);await holding;return{ok:true}}})
 t.after(()=>{finishLaunch();client?.dispose()})
 const results=await Promise.race([Promise.all(['A.js','B.js'].map(file=>bridge.open(root,path.join(root,'Assets',file)))),sleep(600).then(()=>[])])
 assert.equal(results.length,2);assert.ok(results.every(r=>r.ok));assert.equal(launches.length,1)
 assert.deepEqual([...client.opened].sort(),['A.js','B.js'].map(file=>path.join(root,'Assets',file)))
 assert.equal(bridge.stats().acknowledgements,2);finishLaunch()
})
test('S04: peticiones idénticas pendientes se agrupan',async t=>{
 const root=await workspace(t),{bridge,clients}=bridgeFor(t,{delay:50})
 const results=await Promise.all(Array.from({length:12},()=>bridge.open(root,path.join(root,'Assets/A.js'))))
 assert.ok(results.every(r=>r.ok));assert.equal(bridge.stats().requests,1);assert.equal(clients[0].opened.length,1)
})
test('S04: dos archivos concurrentes comparten arranque y conservan destinos',async t=>{
 const root=await workspace(t),{bridge,clients,launches}=bridgeFor(t,{delay:20})
 const results=await Promise.all(['A.js','B.js'].map(file=>bridge.open(root,path.join(root,'Assets',file))))
 assert.ok(results.every(r=>r.ok));assert.equal(launches.length,1)
 assert.deepEqual([...clients[0].opened].sort(),['A.js','B.js'].map(file=>path.join(root,'Assets',file)))
})
test('S04: dos proyectos no cruzan solicitudes ni archivos',async t=>{
 const a=await workspace(t,'A'),b=await workspace(t,'B'),{bridge,clients}=bridgeFor(t)
 await bridge.open(a,path.join(a,'Assets/A.js'));await bridge.open(b,path.join(b,'Assets/B.js'))
 assert.equal(clients[0].opened[0],path.join(a,'Assets/A.js'));assert.equal(clients[1].opened[0],path.join(b,'Assets/B.js'))
 assert.equal(bridge.stats().sessions,2)
})
test('S04: entre ventanas de la misma raíz se prefiere la enfocada',async t=>{
 const root=await workspace(t),{bridge,clients}=bridgeFor(t)
 await bridge.open(root,null)
 const second=extension(root);t.after(()=>second.dispose());await until(()=>bridge.stats().connections===2)
 clients[0].focus(false);second.focus(true);await sleep(20)
 assert.equal((await bridge.open(root,path.join(root,'Assets/A.js'))).ok,true)
 assert.equal(second.opened.at(-1),path.join(root,'Assets/A.js'))
})
test('S04: liberar proyecto elimina solo su descriptor y permite otra sesión',async t=>{
 const root=await workspace(t),{bridge}=bridgeFor(t)
 await bridge.open(root,null);const first=JSON.parse(await fs.readFile(path.join(root,DESCRIPTOR)))
 await bridge.release(root);assert.equal(existsSync(path.join(root,DESCRIPTOR)),false)
 assert.equal(bridge.stats().sessions,0)
 assert.equal((await bridge.open(root,path.join(root,'Assets/B.js'))).ok,true)
 const next=JSON.parse(await fs.readFile(path.join(root,DESCRIPTOR)));assert.notEqual(next.session,first.session);assert.notEqual(next.token,first.token)
})
test('S04: cierre no borra descriptor de una sesión reemplazada',async t=>{
 const root=await workspace(t),{bridge}=bridgeFor(t)
 await bridge.open(root,null);const descriptor=path.join(root,DESCRIPTOR),data=JSON.parse(await fs.readFile(descriptor))
 data.session='f'.repeat(32);await fs.writeFile(descriptor,JSON.stringify(data));await bridge.release(root)
 assert.equal(JSON.parse(await fs.readFile(descriptor)).session,data.session)
})
test('S04: recuperación tras reiniciar servidor sin relanzar VS Code',async t=>{
 const root=await workspace(t),first=bridgeFor(t)
 await first.bridge.open(root,null);await first.bridge.close()
 const next=createVSCodeBridge({graceMs:1000,launch:async()=>assert.fail('No debe lanzar CLI con cliente que reconecta')});t.after(()=>next.close())
 const result=await next.open(root,path.join(root,'Assets/A.js'));assert.equal(result.ok,true,result.error);assert.equal(next.stats().launches,0)
})
test('S04: release cancela apertura pendiente y retira la sesión',async t=>{
 const root=await workspace(t),{bridge}=bridgeFor(t,{delay:150})
 const opening=bridge.open(root,path.join(root,'Assets/A.js'))
 await until(()=>bridge.stats().requests===1);await bridge.release(root)
 const result=await opening;assert.equal(result.canceled,true);assert.equal(bridge.stats().sessions,0)
})
for(const change of [{token:'0'.repeat(64)},{protocol:7},{version:'0.1.3'}])test('S04: handshake inválido rechazado '+JSON.stringify(change),async t=>{
 const root=await workspace(t),{bridge}=bridgeFor(t,{launch:async()=>({ok:false,error:'sin editor'})})
 await bridge.open(root,null);const descriptor=JSON.parse(await fs.readFile(path.join(root,DESCRIPTOR)))
 const socket=net.createConnection({host:descriptor.host,port:descriptor.port});t.after(()=>socket.destroy())
 await new Promise(resolve=>{socket.on('connect',()=>socket.write(JSON.stringify({...descriptor,type:'hello',version:'0.1.4',...change})+'\n'));socket.on('close',resolve)})
 assert.equal(bridge.stats().connections,0)
})
test('S04: mensajes malformados se cierran sin afectar al servidor',async t=>{
 const root=await workspace(t),{bridge}=bridgeFor(t,{launch:async()=>({ok:false,error:'sin editor'})});await bridge.open(root,null)
 const descriptor=JSON.parse(await fs.readFile(path.join(root,DESCRIPTOR)))
 const socket=net.createConnection({host:descriptor.host,port:descriptor.port});await new Promise(resolve=>{socket.on('connect',()=>socket.write('{rotura\n'));socket.on('close',resolve)})
 assert.equal(bridge.stats().connections,0)
 const client=extension(root);t.after(()=>client.dispose())
 assert.equal((await bridge.open(root,path.join(root,'Assets/A.js'))).ok,true)
})
test('S04: symlink de script y carpeta .levelforge fuera de raíz se rechazan',async t=>{
 if(process.platform==='win32')return t.skip('Creación de symlink requiere permisos locales en Windows')
 const root=await workspace(t),outside=await workspace(t,'Fuera'),{bridge}=bridgeFor(t)
 await fs.symlink(path.join(outside,'Assets/A.js'),path.join(root,'Assets/Fuera.js'))
 assert.equal((await bridge.open(root,path.join(root,'Assets/Fuera.js'))).stage,'path')
 await bridge.release(root);await fs.rm(path.join(root,'.levelforge'),{recursive:true});await fs.symlink(path.join(outside,'.levelforge'),path.join(root,'.levelforge'))
 assert.equal((await bridge.open(root,null)).ok,false)
})
test('S04: cliente valida ruta aunque el servidor autenticado envíe una ruta ajena',async t=>{
 const root=await workspace(t);let peer,buffer='';const replies=[]
 const server=net.createServer(socket=>{peer=socket;socket.setEncoding('utf8');socket.on('data',chunk=>{buffer+=chunk;let end;while((end=buffer.indexOf('\n'))>=0){const data=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);if(data.type==='hello')socket.write(JSON.stringify({type:'ready',protocol:1,session:data.session})+'\n');else replies.push(data)}})});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{peer?.destroy();server.close(r)}))
 await fs.writeFile(path.join(root,DESCRIPTOR),JSON.stringify({protocol:1,host:'127.0.0.1',port:server.address().port,root,session:'a'.repeat(32),token:'b'.repeat(64)}))
 const client=extension(root);t.after(()=>client.dispose());await until(()=>peer)
 await sleep(25);peer.write(JSON.stringify({type:'open',id:'malicious',file:'../Fuera.js'})+'\n')
 await until(()=>replies.length>0);assert.equal(replies[0].ok,false);assert.equal(client.opened.length,0)
})

test('S04: versión activa superior se conserva sin preparar CLI',async t=>{
 const root=await workspace(t),{bridge}=bridgeFor(t,{launch:async()=>({ok:false,error:'no debe instalar'})})
 await bridge.open(root,null)
 const client=extension(root,{version:'9.0.0'});t.after(()=>client.dispose())
 await until(()=>bridge.stats().connections===1);const launches=bridge.stats().launches
 const result=await bridge.open(root,path.join(root,'Assets/A.js'))
 assert.equal(result.ok,true);assert.equal(result.extension.version,'9.0.0');assert.equal(bridge.stats().launches,launches)
})
test('S04: apertura sin ACK expira sin relanzar ni reenviar automáticamente',async t=>{
 const root=await workspace(t),{bridge}=bridgeFor(t,{delay:150,requestMs:30})
 const result=await bridge.open(root,path.join(root,'Assets/A.js'))
 assert.equal(result.ok,false);assert.match(result.error,/no confirmó|desconectó/)
 assert.equal(bridge.stats().launches,1);assert.equal(bridge.stats().requests,1)
})

test('S04: errores concurrentes en la misma ventana comparten diálogo de recuperación',async()=>{
 const vm=await import('node:vm'),source=await fs.readFile('electron/main.cjs','utf8')
 const block=source.slice(source.indexOf("ipcMain.handle('lf:openVSCode'"),source.indexOf('// ---- exportar el juego'))
 let handler,finish,dialogs=0;const win={isDestroyed:()=>false}
 const context={ipcMain:{handle:(_,fn)=>{handler=fn}},resolveIn:(root,rel)=>path.resolve(root,rel),fs:{statSync:()=>({isFile:()=>true})},BrowserWindow:{fromWebContents:()=>win},vscodeRetryDialogs:new WeakMap(),vscodeBridge:{open:async()=>({ok:false,error:'No se conectó'})},dialog:{showMessageBox:async()=>{dialogs++;return await new Promise(resolve=>{finish=resolve})}}}
 vm.runInNewContext(block,context)
 const event={sender:{isDestroyed:()=>false,send(){}}}
 const a=handler(event,'/tmp/QA','Assets/A.js'),b=handler(event,'/tmp/QA','Assets/B.js')
 await until(()=>dialogs===1);finish({response:1})
 assert.equal((await a).canceled,true);assert.equal((await b).canceled,true);assert.equal(dialogs,1)
})
