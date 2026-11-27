// S04 — Transporte remoto seguro. Se conecta al runner Git ya autorizado por VCS.
// Ninguna acción recibe comandos arbitrarios: HTTPS, refs verificadas y límites fijos.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const REMOTE_TIMEOUT = 120000
const REF_RE = /^(?![-./])(?!.*(?:\.\.|\.lock(?:\/|$)|\/\/|@\{|[ ~^:?*\[\]\\]))[A-Za-z0-9._\/-]{1,120}$/
const SHA_RE = /^[0-9a-f]{40,64}$/i
function branchName(value) {
  if (typeof value !== 'string' || !REF_RE.test(value) || value.endsWith('/') || value.endsWith('.') || value.includes('/.')) throw new Error('Nombre de rama remota inválido')
  return value
}
function validRemoteUrl(value, testFile = false) {
  if (typeof value !== 'string' || value.length > 1800 || /[\x00-\x20\x7f]/.test(value)) throw new Error('URL de repositorio inválida')
  let u
  try { u = new URL(value) } catch { throw new Error('Escribe una URL HTTPS válida') }
  if (testFile && u.protocol === 'file:' && !u.username && !u.password && !u.search && !u.hash) return u.href
  if (u.protocol !== 'https:' || !u.hostname || u.username || u.password || u.search || u.hash || u.hostname.length > 253) throw new Error('Se requiere HTTPS sin credenciales en la URL')
  return u.href
}
function secretArg(value) {
  if (value == null || value === '') return ''
  if (typeof value !== 'string' || value.length > 4096 || /[\r\n\0]/.test(value)) throw new Error('Token inválido')
  return value
}
function installRemoteActions(actions, ctx, {testFileTransport = false} = {}) {
  const {run, checked, requireClean, currentHead, backup, authorize, safeRecoveryFile, receipts, secretStore} = ctx
  const getBranch = async cwd => {
    const r = await run(cwd,['symbolic-ref','-q','--short','HEAD'],{allowError:true})
    if(r.code) throw new Error('Es necesario estar en una rama local para sincronizar')
    return branchName(r.stdout.trim())
  }
  const getRemote = async cwd => {
    const r = await run(cwd,['remote','get-url','origin'],{allowError:true})
    return r.code ? null : validRemoteUrl(r.stdout.trim(),testFileTransport)
  }
  const runNet = async (cwd, args, {url,token,allowError=false}={}) => {
    const target = validRemoteUrl(url,testFileTransport)
    const secret = secretArg(token || secretStore?.get?.(target) || '')
    const encoded = secret ? Buffer.from('x-access-token:' + secret).toString('base64') : ''
    const envExtra = {GIT_ALLOW_PROTOCOL:testFileTransport?'https:file':'https', GIT_TERMINAL_PROMPT:'0',GIT_SSL_NO_VERIFY:'0',GIT_ASKPASS:'', SSH_ASKPASS:''}
    if (secret) {
      // Credencial transitoria: no se escribe en .git/config, argv ni archivos del proyecto.
      envExtra.GIT_CONFIG_COUNT='1'
      envExtra.GIT_CONFIG_KEY_0=`http.${target}.extraHeader`
      envExtra.GIT_CONFIG_VALUE_0='Authorization: Basic ' + encoded
    }
    const opts = {envExtra,timeoutMs:REMOTE_TIMEOUT,allowError,redact:[secret,encoded]}
    // Deshabilitar redirecciones y herramientas externas de Git durante operaciones de red.
    return run(cwd,['-c','http.followRedirects=false','-c','http.sslVerify=true','-c','credential.helper=','-c','core.hooksPath=/dev/null',...args],opts)
  }
  const hashRef = async (cwd,ref) => {
    const r=await run(cwd,['rev-parse','--verify',ref],{allowError:true})
    return r.code || !SHA_RE.test(r.stdout.trim()) ? null : r.stdout.trim()
  }
  actions.credentialStatus = async root => {
    const cwd=await checked(root), url=await getRemote(cwd)
    return {available:!!secretStore?.available?.(),saved:!!url && !!secretStore?.has?.(url)}
  }
  actions.saveCredential = async (root,data={}) => {
    const cwd=await checked(root),url=await getRemote(cwd)
    if(!url) throw new Error('Configura origin antes de guardar credenciales')
    const token=secretArg(data.token)
    if(!token) throw new Error('Introduce un token válido')
    if (!secretStore?.available?.()) throw new Error('No hay cifrado seguro disponible para guardar el token')
    secretStore.save(url,token)
    return {saved:true}
  }
  actions.forgetCredential = async root => {
    const cwd=await checked(root),url=await getRemote(cwd)
    if(url) secretStore?.remove(url)
    return {saved:false}
  }
  actions.remoteStatus = async root => {
    const cwd=await checked(root), branch=await getBranch(cwd)
    let url=null
    try {url=await getRemote(cwd)} catch {return {branch,configured:true,invalid:true,reason:'El remoto origin no es HTTPS válido'}}
    if(!url) return {branch,configured:false,ahead:0,behind:0}
    const tracking=await hashRef(cwd,`refs/remotes/origin/${branch}`)
    let ahead=0,behind=0
    if(tracking) {
      const counts=await run(cwd,['rev-list','--left-right','--count',`HEAD...refs/remotes/origin/${branch}`])
      const match=/^(\d+)\s+(\d+)/.exec(counts.stdout.trim())
      if(match) {ahead=Number(match[1]); behind=Number(match[2])}
    }
    return {configured:true,url,branch,tracking:!!tracking,ahead,behind}
  }
  actions.setRemote = async (root,data={}) => {
    const cwd=await checked(root), url=validRemoteUrl(data.url,testFileTransport)
    const existing=await run(cwd,['remote','get-url','origin'],{allowError:true})
    if(!existing.code && !data.replace) throw new Error('Ya existe origin. Confirma explícitamente la sustitución.')
    await run(cwd,existing.code?['remote','add','origin',url]:['remote','set-url','origin',url])
    return actions.remoteStatus(root)
  }
  actions.fetchRemote = async (root,data={}) => {
    const cwd=await checked(root),url=await getRemote(cwd)
    if(!url) throw new Error('Configura origin antes de consultar el remoto')
    await runNet(cwd,['fetch','--no-tags','--no-recurse-submodules','origin'],{url,token:data.token})
    return actions.remoteStatus(root)
  }
  actions.pushRemote = async (root,data={}) => {
    const cwd=await checked(root),url=await getRemote(cwd)
    if(!url) throw new Error('Configura origin antes de enviar commits')
    const branch=await getBranch(cwd)
    await runNet(cwd,['push','--porcelain','--set-upstream','origin',`HEAD:refs/heads/${branch}`],{url,token:data.token})
    return actions.remoteStatus(root)
  }
  const pullPlans = new Map()
  actions.preparePull = async (root,data={}) => {
    const cwd=await checked(root),url=await getRemote(cwd)
    if(!url) throw new Error('Configura origin antes de recibir commits')
    await requireClean(cwd)
    const branch=await getBranch(cwd),previous=await currentHead(cwd)
    await actions.fetchRemote(root,data)
    const target=await hashRef(cwd,`refs/remotes/origin/${branch}`)
    if(!target) throw new Error('La rama remota correspondiente no existe')
    const ancestor=await run(cwd,['merge-base','--is-ancestor',previous,target],{allowError:true})
    if(ancestor.code) throw new Error('Las ramas han divergido: Pull automático bloqueado (solo fast-forward)')
    const paths=await run(cwd,['diff','--name-only','-z',previous,target,'--'])
    const files=paths.stdout.split('\0').filter(Boolean)
    if(files.length>1000) throw new Error('Demasiados archivos para un Pull seguro')
    for(const p of files) safeRecoveryFile(cwd,p)
    const token=crypto.randomUUID()
    pullPlans.set(token,{root:cwd,branch,previous,target,files,at:Date.now()})
    return {token,branch,previous,target,files,affected:files.length,kind:'pull'}
  }
  actions.applyPull = async (root,data={}) => {
    const cwd=await checked(root),plan=pullPlans.get(data.token)
    if(!plan || plan.root!==cwd || Date.now()-plan.at>120000) throw new Error('Plan de Pull vencido o inválido')
    pullPlans.delete(data.token)
    await requireClean(cwd)
    if(await currentHead(cwd)!==plan.previous || await getBranch(cwd)!==plan.branch) throw new Error('La rama cambió tras la previsualización')
    if(await hashRef(cwd,`refs/remotes/origin/${plan.branch}`)!==plan.target) throw new Error('El remoto cambió después de la previsualización')
    const saved=await backup(cwd,plan.files.length?plan.files:['project.lfproj'],'pull')
    try {await run(cwd,['merge','--ff-only',plan.target])}
    catch(err) {throw new Error(`${err.message}. Respaldo disponible: ${saved.location}`)}
    const manifestPath=path.join(saved.location,'manifest.json')
    const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'))
    manifest.beforeHead=plan.previous;manifest.afterHead=await currentHead(cwd)
    manifest.beforeBranch=plan.branch;manifest.afterBranch=plan.branch
    manifest.after=manifest.files.map(f=>{
      const full=safeRecoveryFile(cwd,f.path)
      return fs.existsSync(full)?crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex'):null
    })
    fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2))
    return {backup:saved,head:manifest.afterHead,kind:'pull',updated:plan.files.length}
  }
  actions.cloneRemote = async (root,data={}) => {
    const url=validRemoteUrl(data.url,testFileTransport)
    const cwd=path.resolve(authorize(root))
    if(!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) throw new Error('Selecciona una carpeta de destino existente')
    if(fs.readdirSync(cwd).length) throw new Error('La carpeta de destino debe estar vacía')
    const temp=fs.mkdtempSync(path.join(cwd,'.levelforge-clone-'))
    try {
      await runNet(cwd,['clone','--no-recurse-submodules','--',url,temp],{url,token:data.token})
      if(!fs.existsSync(path.join(temp,'project.lfproj')) || !fs.statSync(path.join(temp,'project.lfproj')).isFile()) throw new Error('El repositorio no contiene project.lfproj')
      // El editor no debe abrir un repositorio clonado con symlinks externos.
      let count=0,bytes=0
      function validate(dir) {
        for(const d of fs.readdirSync(dir,{withFileTypes:true})) {
          if(++count>10000) throw new Error('Repositorio demasiado grande para validar')
          if(d.isSymbolicLink()) throw new Error('El repositorio contiene enlaces simbólicos')
          if(d.isDirectory()) validate(path.join(dir,d.name))
          else if(d.isFile()) {bytes+=fs.statSync(path.join(dir,d.name)).size; if(bytes>512*1024*1024) throw new Error('El repositorio supera el límite de 512 MiB para Clone')}
        }
      }
      validate(temp)
      const moved=[]
      try {
        for(const name of fs.readdirSync(temp)) {
          fs.renameSync(path.join(temp,name),path.join(cwd,name));moved.push(name)
        }
      } catch(err) {
        for(const name of moved.reverse()) fs.renameSync(path.join(cwd,name),path.join(temp,name))
        throw err
      }
      return {cloned:true,path:cwd}
    } finally {fs.rmSync(temp,{recursive:true,force:true})}
  }
}
module.exports={installRemoteActions,validRemoteUrl}
