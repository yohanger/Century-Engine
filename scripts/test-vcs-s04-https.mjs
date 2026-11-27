import test from 'node:test'
import https from 'node:https'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawn,execFileSync} from 'node:child_process'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const root=path.resolve(import.meta.dirname,'..')
const {registerVcsIpc}=require(root+'/electron/vcs.cjs')
const git=root+'/vendor/git/linux-x64/bin/git'
const available=process.platform==='linux' && fs.existsSync('/usr/lib/git-core/git-http-backend') && fs.existsSync('/usr/bin/openssl') && fs.existsSync(git)
test('HTTPS Git real: Git embebido + auxiliar HTTPS + token efímero + CA', {skip:!available}, async()=> {
const parent=fs.mkdtempSync(path.join(os.tmpdir(),'lf-https-smoke-'))
function cmd(args,cwd=parent) {return execFileSync(git,args,{cwd,env:{...process.env,PATH:path.dirname(git)+':'+process.env.PATH},encoding:'utf8'})}
const repo=path.join(parent,'demo.git')
cmd(['init','--bare','--initial-branch=main',repo])
const a=path.join(parent,'a');fs.mkdirSync(a);fs.writeFileSync(path.join(a,'project.lfproj'),'hello world')
cmd(['init','--initial-branch=main'],a);cmd(['add','project.lfproj'],a);cmd(['-c','user.name=QA','-c','user.email=qa@example.test','commit','-m','start'],a);cmd(['push',repo,'HEAD:main'],a)
const cert=path.join(parent,'cert.pem'),key=path.join(parent,'key.pem')
execFileSync('/usr/bin/openssl',['req','-x509','-nodes','-newkey','rsa:2048','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],{stdio:'ignore'})
let requests=0
const server=https.createServer({key:fs.readFileSync(key),cert:fs.readFileSync(cert)},(req,res)=>{
  requests++
  const chunks=[]
  req.on('data',b=>chunks.push(b))
  req.on('end',()=>{
    const requrl=new URL(req.url,'https://localhost')
    if(req.headers.authorization !== "Basic eC1hY2Nlc3MtdG9rZW46c2VjcmV0LXRlc3Q="){res.writeHead(401);res.end("Unauthorized");return}
    const env={...process.env,GIT_PROJECT_ROOT:parent,GIT_HTTP_EXPORT_ALL:'1',REQUEST_METHOD:req.method,PATH_INFO:requrl.pathname,QUERY_STRING:requrl.search.slice(1),CONTENT_TYPE:req.headers['content-type']||'',CONTENT_LENGTH:String(Buffer.concat(chunks).length),REMOTE_USER:'test'}
    const cgi=spawn('/usr/lib/git-core/git-http-backend',[],{env,stdio:['pipe','pipe','pipe']})
    let header=Buffer.alloc(0), ready=false
    cgi.stdout.on('data',chunk=>{
      if(ready) {res.write(chunk);return}
      header=Buffer.concat([header,chunk]);const i=header.indexOf('\r\n\r\n')>=0?header.indexOf('\r\n\r\n'):header.indexOf('\n\n')
      if(i<0)return
      const gap=header[i]===13?4:2;const head=header.subarray(0,i).toString();const body=header.subarray(i+gap)
      const status=head.match(/Status:\s*(\d+)/i);res.statusCode=status?Number(status[1]):200
      for(const line of head.split(/\r?\n/)){const j=line.indexOf(':');if(j>0 && line.slice(0,j).toLowerCase()!=='status')res.setHeader(line.slice(0,j),line.slice(j+1).trim())}
      ready=true;res.write(body)
    })
    cgi.stderr.on('data',b=>process.stderr.write('cgi: '+b))
    cgi.on('close',()=>res.end());cgi.stdin.end(Buffer.concat(chunks))
  })
})
await new Promise(r=>server.listen(0,'127.0.0.1',r))
const handlers=new Map()
registerVcsIpc({handle:(n,f)=>handlers.set(n,f)}, {authorize:s=>{if(s!==a)throw Error('no');return s},appPath:root,packaged:false})
const call=(action,data)=>handlers.get('lf:vcs')({},action,a,data)
const url=`https://127.0.0.1:${server.address().port}/demo.git`
const oldCA=process.env.GIT_SSL_CAINFO,oldPATH=process.env.PATH
process.env.GIT_SSL_CAINFO=cert
process.env.PATH=''
try {
  await call('setRemote',{url})
  const result=await call('fetchRemote',{token:'secret-test'})
  if(!result.tracking || requests<1) throw new Error('No fue posible consultar el servidor Git HTTPS real')
}finally{process.env.PATH=oldPATH;if(oldCA===undefined)delete process.env.GIT_SSL_CAINFO;else process.env.GIT_SSL_CAINFO=oldCA;await new Promise(r=>server.close(r));fs.rmSync(parent,{recursive:true,force:true})}
})
