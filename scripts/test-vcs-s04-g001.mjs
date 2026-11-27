// Pruebas S04 con Git embebido: remotos locales en transporte de test aislado.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const {registerVcsIpc}=require('../electron/vcs.cjs')
const {validRemoteUrl}=require('../electron/vcs-remote.cjs')
const {createCredentialStore}=require('../electron/vcs-credentials.cjs')
const source=path.resolve(import.meta.dirname,'..')
const git=path.join(source,'vendor/git/linux-x64/bin/git')
const skip=process.platform!=='linux'||!fs.existsSync(git)
function fixture() {
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'lf-vcs-s04-'))
  function project(name,create=true) {
    const cwd=path.join(base,name);fs.mkdirSync(cwd)
    if(create) fs.writeFileSync(path.join(cwd,'project.lfproj'),'v1')
    const handlers=new Map()
    registerVcsIpc({handle:(k,fn)=>handlers.set(k,fn)}, {authorize:r=>{assert.equal(r,cwd);return cwd},appPath:source,packaged:false,testFileRemotes:true})
    return {cwd,call:(action,data)=>handlers.get('lf:vcs')({},action,cwd,data)}
  }
  return {base,project,done:()=>fs.rmSync(base,{recursive:true,force:true})}
}
const identity={name:'QA LevelForge',email:'qa@example.test'}
async function initProject(p) {await p.call('init');await p.call('commit',{...identity,paths:['project.lfproj','.gitignore'],message:'Primera versión'})}
test('URLs remotas HTTPS sin credenciales, comandos ni protocolos inseguros',()=>{
  assert.equal(validRemoteUrl('https://github.com/org/juego.git'),'https://github.com/org/juego.git')
  for(const url of ['http://example.com/a','ssh://x/a','git@github.com:repo','https://user:secret@host/a','https://host/a?token=x','-c x','file:///tmp/repo','https://host/a\nB']) assert.throws(()=>validRemoteUrl(url))
})
test('Git HTTP helper existe y usa ruta interna del producto', {skip},()=>{
  const helper=path.join(source,'vendor/git/linux-x64/libexec/git-core/git-remote-https')
  assert(fs.statSync(helper).isFile())
  const env={...process.env,PATH:path.dirname(git),GIT_EXEC_PATH:path.dirname(helper),GIT_CONFIG_NOSYSTEM:'1',GIT_TERMINAL_PROMPT:'0'}
  try{execFileSync(git,['ls-remote','https://127.0.0.1:1/not-found.git'],{env,timeout:4000,stdio:'pipe'})}catch(err){
    const msg=String(err.stderr||err.message)
    assert.doesNotMatch(msg,/unable to find remote helper|git-remote-https: not found|git: 'remote-https' is not a git command/i)
    assert.match(msg,/connect|failed|refused|SSL|https/i)
  }
})
test('remotos reales: origen, push, clone, fetch, pull y recuperación segura', {skip},async()=>{
  const v=fixture()
  try {
    const bare=path.join(v.base,'bare.git')
    execFileSync(git,['init','--bare','--initial-branch=main',bare],{env:{...process.env,PATH:''}})
    const a=v.project('a');await initProject(a)
    await a.call('setRemote',{url:new URL('file://'+bare).href})
    assert.equal((await a.call('remoteStatus')).configured,true)
    await a.call('pushRemote')
    const b=v.project('b',false)
    assert.equal((await b.call('cloneRemote',{url:new URL('file://'+bare).href})).cloned,true)
    assert.equal(fs.readFileSync(path.join(b.cwd,'project.lfproj'),'utf8'),'v1')
    fs.writeFileSync(path.join(b.cwd,'project.lfproj'),'v2')
    await b.call('commit',{...identity,message:'Segunda versión',paths:['project.lfproj']})
    await b.call('pushRemote')
    const fetched=await a.call('fetchRemote')
    assert.equal(fetched.behind,1)
    const plan=await a.call('preparePull')
    assert(plan.files.includes('project.lfproj'))
    const applied=await a.call('applyPull',{token:plan.token})
    assert.equal(fs.readFileSync(path.join(a.cwd,'project.lfproj'),'utf8'),'v2')
    assert.equal((await a.call('remoteStatus')).behind,0)
    const recovered=await a.call('recoverChange',{id:applied.backup.id})
    assert(recovered.restored>=1)
    assert.equal(fs.readFileSync(path.join(a.cwd,'project.lfproj'),'utf8'),'v1')
    assert.equal((await a.call('remoteStatus')).behind,1)
    await assert.rejects(a.call('applyPull',{token:plan.token}),/vencido|inválido/)
  }finally{v.done()}
})
test('Pull rechazado ante cambios locales y token de confirmación reutilizado', {skip},async()=>{
  const v=fixture();try{
    const p=v.project('a');await initProject(p)
    fs.writeFileSync(path.join(p.cwd,'project.lfproj'),'sin guardar')
    await assert.rejects(p.call('preparePull'),/origin|configura/i)
    await assert.rejects(p.call('setRemote',{url:'https://user:password@example.com/repo'}),/HTTPS|credenciales/i)
    assert.match(fs.readFileSync(path.join(p.cwd,'project.lfproj'),'utf8'),/sin guardar/)
  }finally{v.done()}
})
test('Clone rechaza carpetas ocupadas y no borra proyectos existentes', {skip},async()=>{
 const v=fixture();try{
  const p=v.project('actual');
  await assert.rejects(p.call('cloneRemote',{url:'https://example.com/repo.git'}),/vacía/i)
  assert(fs.existsSync(path.join(p.cwd,'project.lfproj')))
 }finally{v.done()}
})
test('Las credenciales se cifran solo con backend realmente seguro',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lf-vcs-secrets-'))
 try {
  const secret=createCredentialStore({isEncryptionAvailable:()=>true,getSelectedStorageBackend:()=> 'basic_text'},dir)
  assert.equal(secret.available(),false)
  assert.throws(()=>secret.save('https://example.com/repo','private-token'),/cifrado/)
  const cryptoApi={isEncryptionAvailable:()=>true,getSelectedStorageBackend:()=> 'gnome_libsecret',encryptString:s=>Buffer.from('encrypted:'+s),decryptString:b=>b.toString().replace(/^encrypted:/,'')}
  const secure=createCredentialStore(cryptoApi,dir)
  secure.save('https://example.com/repo','private-token')
  const file=fs.readFileSync(path.join(dir,'vcs-credentials.json'),'utf8')
  assert(!file.includes('private-token'))
  assert.equal(secure.get('https://example.com/repo'),'private-token')
  secure.remove('https://example.com/repo')
  assert.equal(secure.get('https://example.com/repo'),'')
 }finally {fs.rmSync(dir,{recursive:true,force:true})}
})
test('El panel S04 tiene opciones reales y protege recarga, tokens y Pull',()=>{
 const ui=fs.readFileSync(path.join(source,'src/components/VersionControlPanel.vue'),'utf8')
 assert.match(ui,/preparePull/);assert.match(ui,/applyPull/);assert.match(ui,/reloadVcsProjectFromDisk/)
 assert.match(ui,/type="password"/);assert.match(ui,/saveCredential/);assert.match(ui,/cloneRemote/)
 assert.doesNotMatch(ui,/v-model="remoteToken"[^>]*type="text"/)
 const backend=fs.readFileSync(path.join(source,'electron/vcs-remote.cjs'),'utf8')
 assert.match(backend,/--ff-only/);assert.doesNotMatch(backend,/reset --hard|push.*--force/)
})
