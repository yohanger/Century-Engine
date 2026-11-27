// S03 — operaciones Git reales contra el binario incluido, sin usar Git del sistema.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const {registerVcsIpc}=require('../electron/vcs.cjs')
const git=path.resolve(import.meta.dirname,'../vendor/git/linux-x64/bin/git')
const skip=process.platform!=='linux'||!fs.existsSync(git)
function fixture() {
  const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'lf-vcs-s03-'))
  fs.writeFileSync(path.join(cwd,'project.lfproj'),'v1')
  const handlers=new Map()
  const ipc=registerVcsIpc({handle:(k,fn)=>handlers.set(k,fn)}, {authorize:p=>{assert.equal(p,cwd);return cwd},appPath:path.resolve(import.meta.dirname,'..'),packaged:false})
  const call=(operation,data)=>handlers.get('lf:vcs')({},operation,cwd,data)
  const done=()=>fs.rmSync(cwd,{recursive:true,force:true})
  return {cwd,call,done}
}
const identity={name:'QA LevelForge',email:'qa@example.test'}
async function start(v){await v.call('init');await v.call('commit',{...identity,message:'inicio',paths:['project.lfproj','.gitignore']})}
test('lista y crea rama local, sin cambiar de rama', {skip},async()=>{
  const v=fixture();try {
    await start(v)
    const before=await v.call('branches');assert(before.some(b=>b.name==='main'&&b.current))
    await v.call('createBranch',{name:'feature/escena'})
    const b=await v.call('branches');assert(b.some(x=>x.name==='feature/escena'));assert(b.some(x=>x.name==='main'&&x.current))
    for(const bad of ['-x','../foo','x.lock','a b','a~b','--exec=evil']) await assert.rejects(v.call('createBranch',{name:bad}))
  } finally{v.done()}
})
test('previsualiza, respalda y cambia entre ramas limpias', {skip},async()=>{
  const v=fixture();try {
    await start(v);await v.call('createBranch',{name:'alternate'})
    let plan=await v.call('prepareChange',{kind:'switch',branch:'alternate'})
    let result=await v.call('applyChange',{token:plan.token})
    assert.equal((await v.call('status')).branch,'alternate')
    assert(fs.existsSync(path.join(result.backup.location,'manifest.json')))
    assert.equal((await v.call('recoverChange',{id:result.backup.id})).restored,1)
    assert.equal((await v.call('status')).branch,'main')
  } finally{v.done()}
})
test('nunca cambia de rama con archivos unstaged, staged, untracked', {skip},async()=>{
  const v=fixture();try {
    await start(v);await v.call('createBranch',{name:'other'})
    fs.writeFileSync(path.join(v.cwd,'project.lfproj'),'modificado')
    await assert.rejects(v.call('prepareChange',{kind:'switch',branch:'other'}),/cambios|archivos/i)
    fs.writeFileSync(path.join(v.cwd,'project.lfproj'),'v1')
    fs.writeFileSync(path.join(v.cwd,'nuevo.txt'),'x')
    await assert.rejects(v.call('prepareChange',{kind:'switch',branch:'other'}),/archivos/i)
  }finally{v.done()}
})
test('restaura archivo individual con respaldo y recuperación verificable', {skip},async()=>{
  const v=fixture();try {
    await start(v);const old=(await v.call('log'))[0].hash
    fs.writeFileSync(path.join(v.cwd,'project.lfproj'),'v2')
    await v.call('commit',{...identity,message:'segunda',paths:['project.lfproj']})
    const plan=await v.call('prepareChange',{kind:'restoreFile',hash:old,path:'project.lfproj'})
    const result=await v.call('applyChange',{token:plan.token})
    assert.equal(fs.readFileSync(path.join(v.cwd,'project.lfproj'),'utf8'),'v1')
    assert.equal((await v.call('recoverChange',{id:result.backup.id})).restored,1)
    assert.equal(fs.readFileSync(path.join(v.cwd,'project.lfproj'),'utf8'),'v2')
  }finally{v.done()}
})
test('restaura todos los archivos controlados sin reset ni clean', {skip},async()=>{
 const v=fixture();try {
    await start(v);const old=(await v.call('log'))[0].hash
    fs.writeFileSync(path.join(v.cwd,'project.lfproj'),'v2');fs.writeFileSync(path.join(v.cwd,'nuevo.txt'),'new')
    await v.call('commit',{...identity,message:'segunda',paths:['project.lfproj','nuevo.txt']})
    const plan=await v.call('prepareChange',{kind:'restoreProject',hash:old})
    assert(plan.files.includes('project.lfproj'));assert(plan.files.includes('nuevo.txt'))
    const result=await v.call('applyChange',{token:plan.token})
    assert.equal(fs.readFileSync(path.join(v.cwd,'project.lfproj'),'utf8'),'v1')
    assert(!fs.existsSync(path.join(v.cwd,'nuevo.txt')))
    await v.call('recoverChange',{id:result.backup.id})
    assert.equal(fs.readFileSync(path.join(v.cwd,'project.lfproj'),'utf8'),'v2')
    assert.equal(fs.readFileSync(path.join(v.cwd,'nuevo.txt'),'utf8'),'new')
 } finally {v.done()}
})
test('token de previsualización es de un solo uso y scoped a carpeta', {skip},async()=>{
 const v=fixture();try {await start(v);await v.call('createBranch',{name:'feature'})
   const plan=await v.call('prepareChange',{kind:'switch',branch:'feature'})
   await v.call('applyChange',{token:plan.token})
   await assert.rejects(v.call('applyChange',{token:plan.token}),/caducó/)
 }finally{v.done()}
})
test('recuperación se niega si el archivo se editó tras la operación', {skip},async()=>{
 const v=fixture();try {await start(v);const old=(await v.call('log'))[0].hash
  fs.writeFileSync(path.join(v.cwd,'project.lfproj'),'new')
  await v.call('commit',{...identity,message:'new',paths:['project.lfproj']})
  const plan=await v.call('prepareChange',{kind:'restoreFile',hash:old,path:'project.lfproj'})
  const applied=await v.call('applyChange',{token:plan.token})
  fs.writeFileSync(path.join(v.cwd,'project.lfproj'),'user edit')
  await assert.rejects(v.call('recoverChange',{id:applied.backup.id}),/cambió/)
 } finally{v.done()}
})

test('evita aplicar una previsualización si cambiaron los archivos después', {skip}, async()=>{
 const v=fixture();try{await start(v);await v.call('createBranch',{name:'otra'})
  const plan=await v.call('prepareChange',{kind:'switch',branch:'otra'})
  fs.writeFileSync(path.join(v.cwd,'project.lfproj'),'sin guardar')
  await assert.rejects(v.call('applyChange',{token:plan.token}),/archivos|cambios/i)
  assert.equal((await v.call('status')).branch,'main')
 }finally{v.done()}
})
test('prohíbe restaurar un archivo inexistente y rechaza rutas externas', {skip},async()=>{
 const v=fixture();try{await start(v);const old=(await v.call('log'))[0].hash
  await assert.rejects(v.call('prepareChange',{kind:'restoreFile',hash:old,path:'../otro'}))
  await assert.rejects(v.call('prepareChange',{kind:'restoreFile',hash:old,path:'no-existe'}))
  await assert.rejects(v.call('prepareChange',{kind:'restoreProject',hash:'HEAD~1'}))
 }finally{v.done()}
})
test('el panel S03 incluye confirmación, restauración y recarga protegida en lugar de comandos libres',()=>{
 const panel=fs.readFileSync(path.join(import.meta.dirname,'../src/components/VersionControlPanel.vue'),'utf8')
 const project=fs.readFileSync(path.join(import.meta.dirname,'../src/core/state/project.js'),'utf8')
 assert.match(panel,/previewRecovery/);assert.match(panel,/applyRecovery/);assert.match(panel,/confirmRestore/)
 assert.match(panel,/suspendVcsProjectSync/);assert.match(panel,/reloadVcsProjectFromDisk/)
 assert.match(project,/skipActiveSave/);assert.match(project,/await parseLfproj/)
 assert.doesNotMatch(panel,/execute\('(reset|checkout|clean)'/)
})
