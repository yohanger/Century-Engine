// Medición controlada del transporte. El peer no es VS Code: los resultados no son latencia de usuario.
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import net from 'node:net'
import {createRequire} from 'node:module'
import {performance} from 'node:perf_hooks'
import {createScriptSync} from '../src/core/vscode/sync.js'
const require=createRequire(import.meta.url),{createVSCodeBridge,DESCRIPTOR}=require('../electron/vscode-bridge.cjs')
const folder=await fs.mkdtemp(path.join(os.tmpdir(),'lf-vscode-benchmark-'));let socket,buffer=''
await fs.mkdir(path.join(folder,'Assets'));await fs.writeFile(path.join(folder,'project.lfproj'),'{}');await fs.writeFile(path.join(folder,'Assets/A.js'),'// QA')
const bridge=createVSCodeBridge({graceMs:0,launch:async root=>{
 const descriptor=JSON.parse(await fs.readFile(path.join(root,DESCRIPTOR)))
 socket=net.createConnection({host:descriptor.host,port:descriptor.port});socket.setEncoding('utf8')
 socket.on('connect',()=>socket.write(JSON.stringify({...descriptor,type:'hello',version:'0.1.4',app:'Peer de benchmark'})+'\n'))
 socket.on('data',chunk=>{buffer+=chunk;let end;while((end=buffer.indexOf('\n'))>=0){const data=JSON.parse(buffer.slice(0,end));buffer=buffer.slice(end+1);if(data.type==='open')socket.write(JSON.stringify({type:'ack',id:data.id,ok:true})+'\n')}})
 return{ok:true,extension:{status:'current',version:'0.1.4'}}
}})
try{
 const initial=await bridge.open(folder,null);if(!initial.ok)throw Error(initial.error)
 const before=bridge.stats(),samples=[]
 for(let n=0;n<20;n++){const start=performance.now(),result=await bridge.open(folder,path.join(folder,'Assets/A.js'));if(!result.ok)throw Error(result.error);samples.push(performance.now()-start)}
 const sorted=[...samples].sort((a,b)=>a-b),after=bridge.stats()
 const loc={path:folder};let scans=0,reads=0,writes=0
 const scripts=Array.from({length:100},(_,i)=>({id:'s'+i,folder:'Assets',name:`S${i}.js`,code:'// QA'}))
 const sync=createScriptSync({getLoc:()=>loc,getScripts:()=>scripts,apply:{},disk:{
  scanFiles:async()=>{scans++;return scripts.map(s=>({path:`Assets/${s.name}`,mtime:1,size:s.code.length}))},
  readFile:async(_loc,file)=>{reads++;return file.endsWith('.js')?new TextEncoder().encode('// QA'):null},
  writeFiles:async()=>{writes++},
 }})
 await sync.start(loc);const idleBefore={scans,reads,writes};const startIdle=performance.now();await new Promise(r=>setTimeout(r,2200));const idle={milliseconds:performance.now()-startIdle,scans:scans-idleBefore.scans,reads:reads-idleBefore.reads,writes:writes-idleBefore.writes};sync.stop()
 console.log(JSON.stringify({scope:'Servidor productivo sobre TCP real con peer que solo confirma. No ejecuta VS Code, UI ni mide el equipo del usuario.',opens:20,warm:{cliLaunches:after.launches-before.launches,requests:after.requests-before.requests,acks:after.acknowledgements-before.acknowledgements,p50Ms:sorted[9],p95Ms:sorted[18],samplesMs:samples},syncIdle:{scope:'Sincronizador existente con 100 scripts y disco controlado. Se conserva su algoritmo.',...idle}},null,2))
}finally{socket?.destroy();await bridge.close();await fs.rm(folder,{recursive:true,force:true})}
