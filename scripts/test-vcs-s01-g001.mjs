// Pruebas de ejecución real con el Git incluido; no usan Git del PATH.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { verifiedArchive, MINGIT } from './prepare-vcs-git.mjs'
const require=createRequire(import.meta.url)
const { bundledGit, parseStatus, safeFile, validateAuthor, validateMessage, registerVcsIpc }=require('../electron/vcs.cjs')
const root=path.resolve(import.meta.dirname,'..')
const exe=process.platform==='linux'?path.join(root,'vendor/git/linux-x64/bin/git'):null
function server(dir){
  const handlers=new Map()
  const ipc={handle:(id,fn)=>{handlers.set(id,fn)}}
  const api=registerVcsIpc(ipc,{authorize:r=>{if(r!==dir) throw Error('no autorizado');return r},packaged:false,resourcesPath:'',appPath:root})
  return {action:(name,folder=dir,data)=>handlers.get('lf:vcs')({},name,folder,data),api}
}
function fixture(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lf-vcs-g001-'));fs.writeFileSync(path.join(dir,'project.lfproj'),'base');return dir}
const supported=process.platform==='linux' && fs.existsSync(exe)
test('Git embebido existe y no depende del PATH del usuario', {skip:!supported}, async()=>{
  assert.equal(fs.existsSync(bundledGit({appPath:root})),true)
  const dir=fixture();try{const v=server(dir);const p=process.env.PATH;process.env.PATH='';try{const h=await v.action('health');assert.match(h.version,/git version/i);assert.equal(h.embedded,true)}finally{process.env.PATH=p}}finally{fs.rmSync(dir,{recursive:true,force:true})}
})
test('init · status · commit · log reales con usuario sin Git instalado', {skip:!supported},async()=>{
  const dir=fixture();try{
    const v=server(dir)
    assert.equal((await v.action('health')).repository,false)
    assert.equal((await v.action('init')).created,true)
    assert.equal((await v.action('init')).created,false)
    assert.match(fs.readFileSync(path.join(dir,'.gitignore'),'utf8'),/node_modules/)
    const s=await v.action('status');assert(s.files.some(f=>f.path==='project.lfproj'))
    fs.writeFileSync(path.join(dir,'new script.js'),'hola')
    const c=await v.action('commit',dir,{name:'Editor',email:'dev@example.com',message:'Primera revisión',paths:['project.lfproj','new script.js']})
    assert.match(c.hash,/^[a-f0-9]+$/)
    const after=await v.action('status');assert.equal(after.files.length,1) // .gitignore no seleccionada
    const log=await v.action('log');assert.equal(log.length,1);assert.equal(log[0].subject,'Primera revisión')
    assert.equal(log[0].author,'Editor')
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
})
test('el servicio bloquea rutas no autorizadas y acciones arbitrarias', {skip:!supported}, async()=>{
  const dir=fixture(), other=fixture();try{
    const v=server(dir);await assert.rejects(v.action('init',other),/no autorizado/)
    await assert.rejects(v.action('exec',dir,{args:['-c','true']}),/no permitida/)
    await assert.rejects(v.action('status'),/repositorio/)
  }finally{fs.rmSync(dir,{recursive:true,force:true});fs.rmSync(other,{recursive:true,force:true})}
})
test('no se inicializa un repo anidado en otro repo', {skip:!supported},async()=>{
  const dir=fixture();try{
    const v=server(dir);await v.action('init')
    const nested=path.join(dir,'juego');fs.mkdirSync(nested);fs.writeFileSync(path.join(nested,'project.lfproj'),'v1')
    const w=server(nested);await assert.rejects(w.action('init'),/anidado/)
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
})
test('validación estricta del autor, rutas y mensaje',()=>{
  assert.deepEqual(validateAuthor(' Persona ', 'a@b.test'),{name:'Persona',email:'a@b.test'})
  assert.throws(()=>validateAuthor('x\nZ','a@b.test'))
  assert.throws(()=>validateAuthor('a','mal'))
  assert.throws(()=>validateMessage(' '))
  for (const p of ['../secret','/etc/passwd','C:\\foo','a/../b','']) assert.throws(()=>safeFile(p))
  assert.equal(safeFile('Assets/Mi material.material'),'Assets/Mi material.material')
})
test('parseStatus conserva espacios, cambios y renombres',()=>{
  assert.deepEqual(parseStatus('?? nueva escena.lfproj\0 M project.lfproj\0').map(x=>x.path),['nueva escena.lfproj','project.lfproj'])
  const r=parseStatus('R  destino.txt\0origen.txt\0 M x.txt\0');assert.equal(r.length,2);assert.equal(r[0].path,'destino.txt')
})
test('MinGit Windows fijado con SHA-256 conocido',()=>{
  assert.match(MINGIT.url,/https:\/\/github.com\/git-for-windows/)
  assert.equal(MINGIT.sha256.length,64)
  assert.throws(()=>verifiedArchive(Buffer.from('no es MinGit')),/SHA-256/)
})
test('se preserva la integración de guardado y dock profesional',()=>{
  const panel=fs.readFileSync(path.join(root,'src/components/VersionControlPanel.vue'),'utf8')
  assert.match(panel,/await saveAll\(\)/)
  assert.match(panel,/Crear commit/)
  assert.match(panel,/git-branch/)
  assert.match(fs.readFileSync(path.join(root,'src/components/BottomDock.vue'),'utf8'),/VersionControlPanel/)
  assert.match(fs.readFileSync(path.join(root,'electron/preload.cjs'),'utf8'),/vcs: \{ execute:/)
})
