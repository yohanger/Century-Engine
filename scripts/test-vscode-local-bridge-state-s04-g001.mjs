import test from 'node:test'
import assert from 'node:assert/strict'
import {createServer}from'vite'

test('S04 estado · agrupar aperturas, fases reales y limpieza tras ACK/error/cancelación/cambio de proyecto',async t=>{
 const vite=await createServer({server:{middlewareMode:true,ws:false},appType:'custom'});globalThis.window={}
 t.after(async()=>{delete globalThis.window;await vite.close()})
 const {createVscode}=await vite.ssrLoadModule('/src/core/state/vscode.js'),{store}=await vite.ssrLoadModule('/src/core/state/state.js'),{createProjectData}=await vite.ssrLoadModule('/src/core/project.js')
 const encoder=new TextEncoder(),files=new Map([['project.lfproj',encoder.encode('{}')],['jsconfig.json',encoder.encode('config propia')]])
 const listeners=new Set(),calls=[],released=[];let finish;let loc={kind:'path',path:'/QA/Con espacios'}
 window.lf={
 onVSCodeStatus:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},releaseVSCode:async root=>released.push(root),
 openVSCode:async(root,file)=>{calls.push({root,file});return await new Promise(resolve=>{finish=resolve})},
 fs:{exists:async(_,p)=>files.has(p),readFile:async(_,p)=>files.get(p)||null,scan:async()=>[...files].filter(([p])=>p.endsWith('.js')).map(([path,data])=>({path,size:data.length,mtime:1})),writeFiles:async(_,writes,remove=[])=>{for(const{path,data}of writes)files.set(path,typeof data==='string'?encoder.encode(data):data);for(const p of remove)files.delete(p)}}}
 store.project=createProjectData('Estado Puente');store.project.scripts=[{id:'sc',name:'A.js',folder:'Assets',execution:'node',code:'// QA'}];store.locked=false;store.toasts=[]
 const editor=createVscode({getLoc:()=>loc,serializeProject:()=>({meta:store.project,scene:{}}),collectScenes:async()=>new Map()});t.after(()=>editor.stop());await editor.startSync(loc)
 async function waitCalls(n){for(let i=0;i<100&&calls.length<n;i++)await new Promise(r=>setTimeout(r,5));assert.equal(calls.length,n)}
 const first=editor.open('sc'),duplicate=editor.open('sc');assert.equal(first,duplicate);await waitCalls(1)
 assert.equal(listeners.size,1);assert.equal(store.toasts.length,1)
 for(const fn of listeners)fn({root:loc.path,file:'Assets/A.js',phase:'opening'})
 assert.equal(store.toasts[0].msg,'Abriendo archivo en VS Code…')
 for(const fn of listeners)fn({root:'/Otro',file:'Assets/A.js',phase:'starting'})
 assert.equal(store.toasts[0].msg,'Abriendo archivo en VS Code…')
 finish({ok:true,transport:'bridge'});assert.equal(await first,true);assert.equal(await duplicate,true);assert.equal(store.toasts.length,0);assert.equal(listeners.size,0)
 assert.equal(new TextDecoder().decode(files.get('jsconfig.json')),'config propia')
 const failed=editor.open();const handled=failed.catch(error=>error);await waitCalls(2);finish({ok:false,error:'Desconexión QA'});assert.match((await handled).message,/Desconexión QA/);assert.equal(store.toasts.length,0)
 const canceled=editor.open();await waitCalls(3);finish({ok:false,canceled:true});assert.equal(await canceled,false);assert.equal(store.toasts.length,0)
 const old=editor.open();const oldHandled=old.catch(error=>error);await waitCalls(4);const previous=loc;editor.stop();assert.equal(store.toasts.length,0);assert.equal(listeners.size,0);loc={kind:'path',path:'/Nuevo'};finish({ok:true});assert.match((await oldHandled).message,/proyecto activo cambió/);assert.equal(store.toasts.length,0)
 editor.stop();await new Promise(r=>setTimeout(r,0));assert.ok(released.includes(previous.path));assert.equal(listeners.size,0)
})
