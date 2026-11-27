// QA S02: Git embebido real, diff de solo lectura y commit de selección exacta.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const {registerVcsIpc} = require('../electron/vcs.cjs')
const root = path.resolve(import.meta.dirname,'..')
const git = path.join(root,'vendor/git/linux-x64/bin/git')
const enabled = process.platform==='linux' && fs.existsSync(git)
function fixture() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(),'lf-vcs-s02-'))
  fs.writeFileSync(path.join(cwd,'project.lfproj'),'base')
  const handlers = new Map()
  registerVcsIpc({handle:(name,fn)=>handlers.set(name,fn)}, {authorize:dir=>{if(dir!==cwd) throw new Error('Fuera de proyecto');return dir},appPath:root,packaged:false})
  const call = (name, data={}) => handlers.get('lf:vcs')({},name,cwd,data)
  return {cwd,call,cleanup:()=>fs.rmSync(cwd,{recursive:true,force:true})}
}
const identity={name:'Author QA',email:'qa@example.test'}
async function committed(v, message, paths) {return v.call('commit',{...identity,message,paths})}
test('selección exacta: conserva staging previo ajeno y soporta archivo nuevo en primer commit', {skip:!enabled}, async()=>{
  const v=fixture()
  try {
    await v.call('init')
    fs.writeFileSync(path.join(v.cwd,'other.txt'),'preparado')
    await fs.promises.writeFile(path.join(v.cwd,'selected.txt'),'seleccionado')
    const x=await v.call('status');assert(x.files.some(f=>f.path==='selected.txt'))
    // El servidor no expone git add; simulamos un staging externo con el Git embebido.
    const {spawnSync}=await import('node:child_process')
    const stage=spawnSync(git,['add','other.txt'],{cwd:v.cwd});assert.equal(stage.status,0)
    const r=await committed(v,'Solo selected',['selected.txt'])
    assert.match(r.hash,/^[a-f0-9]+$/)
    const log=await v.call('log');assert.equal(log.length,1)
    const d=await v.call('detail',{hash:log[0].hash})
    assert.deepEqual(d.files.map(f=>f.path),['selected.txt'])
    const s=await v.call('status');assert(s.files.find(f=>f.path==='other.txt')?.index==='A')
  }finally{v.cleanup()}
})
test('comparación de dos commits: texto, nombres con espacios, renombres y binario', {skip:!enabled},async()=>{
  const v=fixture()
  try {
    await v.call('init')
    fs.writeFileSync(path.join(v.cwd,'un archivo.txt'),'uno\n')
    fs.writeFileSync(path.join(v.cwd,'imagen.bin'),Buffer.from([0,1,4,5]))
    await committed(v,'Primera',['project.lfproj','un archivo.txt','imagen.bin'])
    const first=(await v.call('log'))[0].hash
    fs.writeFileSync(path.join(v.cwd,'un archivo.txt'),'dos\n')
    await committed(v,'Segunda',['un archivo.txt'])
    const second=(await v.call('log'))[0].hash
    const compare=await v.call('compare',{base:first,target:second})
    assert(compare.files.some(f=>f.path==='un archivo.txt'))
    const d=await v.call('diff',{base:first,target:second,path:'un archivo.txt'})
    assert.equal(d.kind,'text');assert.match(d.text,/\+dos/)
    const x=await v.call('diff',{base:first,target:second,path:'imagen.bin'}).then(()=>null,e=>e)
    assert.match(String(x),/no forma parte/)
    const detail=await v.call('detail',{hash:second})
    assert.equal(detail.subject,'Segunda')
    assert.equal(detail.files.length,1)
  }finally{v.cleanup()}
})
test('comparar working tree sin cambiar archivos y con untracked', {skip:!enabled},async()=>{
  const v=fixture()
  try {
    await v.call('init');await committed(v,'Base',['project.lfproj'])
    const initial=(await v.call('log'))[0].hash
    fs.writeFileSync(path.join(v.cwd,'project.lfproj'),'changed')
    fs.writeFileSync(path.join(v.cwd,'new.txt'),'hola\nmundo')
    const before=fs.readFileSync(path.join(v.cwd,'project.lfproj'),'utf8')
    const compare=await v.call('compare',{base:initial,target:'WORKTREE'})
    assert(compare.files.some(f=>f.path==='project.lfproj'))
    assert(compare.files.some(f=>f.path==='new.txt'&&f.untracked))
    const preview=await v.call('diff',{base:initial,target:'WORKTREE',path:'new.txt'})
    assert.equal(preview.kind,'text');assert.match(preview.text,/\+hola/)
    assert.equal(fs.readFileSync(path.join(v.cwd,'project.lfproj'),'utf8'),before)
    assert.equal((await v.call('log')).length,1)
  }finally{v.cleanup()}
})
test('bloquea refs, rutas y acciones arbitrarias de renderer', {skip:!enabled},async()=>{
  const v=fixture()
  try {
    await v.call('init');await committed(v,'Base',['project.lfproj'])
    for(const ref of ['--help','HEAD~1','bad ref','../HEAD']) await assert.rejects(v.call('compare',{base:ref,target:'WORKTREE'}))
    const base=(await v.call('log'))[0].hash
    await assert.rejects(v.call('diff',{base,target:'WORKTREE',path:'../../etc/passwd'}))
    await assert.rejects(v.call('shell',{args:['rm','-rf']}))
  }finally{v.cleanup()}
})
test('UI ofrece selección de dos revisiones, comparación, archivos y visor sin restauración',()=>{
  const panel=fs.readFileSync(path.join(root,'src/components/VersionControlPanel.vue'),'utf8')
  assert.match(panel,/compararRevisiones/)
  assert.match(panel,/selectedDiff/)
  assert.match(panel,/WORKTREE/)
  assert.match(panel,/vcs-diff-line/)
  assert.doesNotMatch(panel,/api\(\)\.execute\('(checkout|reset|push|pull)'/)
})
test('binarios y límites: no se presentan bytes como texto', {skip:!enabled},async()=>{
  const v=fixture()
  try {
    await v.call('init')
    fs.writeFileSync(path.join(v.cwd,'imagen.bin'),Buffer.from([0,2,3,4]))
    await committed(v,'Binario A',['project.lfproj','imagen.bin'])
    const first=(await v.call('log'))[0].hash
    fs.writeFileSync(path.join(v.cwd,'imagen.bin'),Buffer.from([0,10,20,30]))
    await committed(v,'Binario B',['imagen.bin'])
    const second=(await v.call('log'))[0].hash
    const result=await v.call('diff',{base:first,target:second,path:'imagen.bin'})
    assert.equal(result.kind,'binary')
  }finally{v.cleanup()}
})
test('historial paginado con hashes completos', {skip:!enabled},async()=>{
  const v=fixture()
  try {
    await v.call('init')
    await committed(v,'One',['project.lfproj'])
    fs.writeFileSync(path.join(v.cwd,'project.lfproj'),'new')
    await committed(v,'Two',['project.lfproj'])
    const first=await v.call('log',{offset:0,limit:1})
    const second=await v.call('log',{offset:1,limit:1})
    assert.equal(first.length,1);assert.equal(second.length,1)
    assert.match(first[0].hash,/^[a-f0-9]{40}$/)
    assert.notEqual(first[0].hash,second[0].hash)
    await assert.rejects(v.call('log',{offset:-1,limit:500}))
  }finally{v.cleanup()}
})
test('renombres en comparaciones conservan origen y destino', {skip:!enabled},async()=>{
  const v=fixture()
  try {
    await v.call('init')
    const old=path.join(v.cwd,'antiguo.txt'), next=path.join(v.cwd,'nuevo.txt')
    fs.writeFileSync(old,'línea estable\n'.repeat(40))
    await committed(v,'Initial',['project.lfproj','antiguo.txt'])
    const first=(await v.call('log'))[0].hash
    fs.renameSync(old,next)
    await committed(v,'Rename',['antiguo.txt','nuevo.txt'])
    const second=(await v.call('log'))[0].hash
    const result=await v.call('compare',{base:first,target:second})
    assert(result.files.some(f=>f.path==='nuevo.txt' && f.oldPath==='antiguo.txt' && f.status==='R'))
  }finally{v.cleanup()}
})
test('archivos sin seguimiento grandes o con UTF-8 inválido no se muestran como texto', {skip:!enabled},async()=>{
  const v=fixture()
  try {
    await v.call('init');await committed(v,'Base',['project.lfproj'])
    const first=(await v.call('log'))[0].hash
    fs.writeFileSync(path.join(v.cwd,'notutf8.txt'),Buffer.from([0xff,0x81,0x43]))
    fs.writeFileSync(path.join(v.cwd,'large.txt'),'x'.repeat(100_000))
    for(const file of ['notutf8.txt','large.txt']) {
      const r=await v.call('diff',{base:first,target:'WORKTREE',path:file})
      assert.equal(r.kind,'binary')
    }
  }finally{v.cleanup()}
})
