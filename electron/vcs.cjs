// Control de versiones local — backend nativo aislado del renderer.
// Ejecuta únicamente un catálogo cerrado de operaciones, con Git embebido y sin shell.
const fs = require('node:fs')
const path = require('node:path')
const { spawn } = require('node:child_process')
const crypto = require('node:crypto')

const MAX_OUTPUT = 1024 * 1024
const TIMEOUT_MS = 20000
const MAX_DIFF_TEXT = 96 * 1024
const MAX_CHANGED_FILES = 350
const SHA_RE = /^[a-f0-9]{7,64}$/i
const BRANCH_RE = /^(?![./-])(?!.*(?:\.\.|\.lock(?:\/|$)|\/\/|@\{|[ ~^:?*\[\]\\]))[a-zA-Z0-9._/-]{1,120}$/
const MAX_BACKUP_BYTES = 128 * 1024 * 1024
function safeBranch(name) {
  if (typeof name !== 'string' || !BRANCH_RE.test(name) || name.endsWith('/') || name.endsWith('.') || name.includes('/.') || name.includes('./')) throw new Error('Nombre de rama inválido')
  return name
}
function safeRecoveryFile(cwd, rel) {
  const safe = safeFile(rel)
  if (safe === '.git' || safe.startsWith('.git/') || safe === '.levelforge') throw new Error('Archivo de control no permitido')
  const root = fs.realpathSync(cwd)
  let dir = root
  for (const part of safe.split('/').slice(0,-1)) {
    dir = path.join(dir,part)
    if (fs.existsSync(dir) && fs.lstatSync(dir).isSymbolicLink()) throw new Error('No se admiten enlaces simbólicos en rutas restaurables')
  }
  const file = path.join(root,...safe.split('/'))
  if (fs.existsSync(file) && (!fs.lstatSync(file).isFile() || fs.lstatSync(file).isSymbolicLink())) throw new Error('Solo se admiten archivos locales regulares')
  return file
}
function bundledGit({ packaged = false, resourcesPath = '', appPath = '' } = {}) {
  const rel = process.platform === 'win32' ? path.join('win-x64', 'cmd', 'git.exe') : path.join('linux-x64', 'bin', 'git')
  return path.join(packaged ? resourcesPath : appPath, packaged ? 'git' : 'vendor/git', rel)
}
function repoRoot(root, authorize) {
  const dir = path.resolve(authorize(root))
  if (!fs.statSync(dir).isDirectory()) throw new Error('Carpeta de proyecto inválida')
  if (!fs.existsSync(path.join(dir, 'project.lfproj'))) throw new Error('Guarda el proyecto en su carpeta antes de usar Git')
  const meta = path.join(dir, '.git')
  if (fs.existsSync(meta) && !fs.lstatSync(meta).isDirectory()) throw new Error('Repositorio Git externo o enlace no admitido')
  return dir
}
function validateAuthor(name, email) {
  const n = String(name || '').trim(), e = String(email || '').trim()
  if (!n || n.length > 100 || /[\r\n\0<>]/.test(n)) throw new Error('Indica un nombre de autor válido')
  if (!e || e.length > 180 || /[\r\n\0<>]/.test(e) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error('Indica un correo válido')
  return { name: n, email: e }
}
function validateMessage(message) {
  const m = String(message || '').trim()
  if (!m || m.length > 2000 || m.includes('\0')) throw new Error('Escribe un mensaje de commit (máx. 2000 caracteres)')
  return m
}
function safeFile(p) {
  const s = String(p || '')
  if (!s || s.includes('\0') || path.isAbsolute(s) || s.includes('\\') || s.split('/').some(x => x === '..' || !x)) throw new Error('Ruta de archivo no permitida')
  return s
}
function makeRunner(exe) {
  return async (cwd, args, { allowError = false, envExtra = {}, timeoutMs = TIMEOUT_MS, redact = [] } = {}) => {
    if (!fs.existsSync(exe)) throw new Error('Git embebido no disponible. Revisa la distribución nativa de Century.')
    const winRoot=process.platform === 'win32' ? path.dirname(path.dirname(exe)) : ''
    const bundledPaths=process.platform === 'win32' ? [path.dirname(exe),path.join(winRoot,'mingw64','bin'),path.join(winRoot,'usr','bin')] : [path.dirname(exe)]
    const env = {
      ...process.env,
      // Git puede reinvocarse como 'git remote-https': mantener primero el ejecutable embebido.
      PATH: [...bundledPaths, process.env.PATH || ''].join(path.delimiter),
      GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
      GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', GIT_PAGER: 'cat',
      GIT_CONFIG_COUNT: '0', GIT_TRACE: '0', GIT_TRACE_SETUP: '0',
      GIT_EXEC_PATH: process.platform === 'linux' ? path.join(path.dirname(path.dirname(exe)), 'libexec', 'git-core') : undefined,
      GIT_ASKPASS: '', SSH_ASKPASS: '', GIT_SSL_NO_VERIFY: '0', ...envExtra,
    }
    return await new Promise((resolve, reject) => {
      let out = [], err = [], count = 0, settled = false
      const child = spawn(exe, ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', ...args], {
        cwd, env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      })
      const finish = (error, result) => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(result) }
      const collect = target => buf => { count += buf.length; if (count > MAX_OUTPUT) { child.kill(); finish(new Error('La salida de Git excede el límite permitido')) } else target.push(buf) }
      child.stdout.on('data', collect(out)); child.stderr.on('data', collect(err))
      child.on('error', e => finish(new Error(e.code === 'EACCES' ? `No se pudo ejecutar Git embebido (EACCES): revisa permisos ejecutables y montaje noexec: ${exe}` : `No se pudo ejecutar Git embebido: ${e.message}`)))
      child.on('close', code => {
        const stdout = Buffer.concat(out).toString('utf8'), stderr = Buffer.concat(err).toString('utf8')
        if (code !== 0 && !allowError) {
          let detail = (stderr || stdout || `Git devolvió ${code}`).slice(0, 1200)
          for (const secret of redact) if (secret) detail = detail.split(secret).join('[redactado]')
          finish(new Error(detail))
        }
        else finish(null, { code, stdout, stderr })
      })
      const timer = setTimeout(() => { child.kill(); finish(new Error('Git excedió el tiempo de espera')) }, timeoutMs)
    })
  }
}
function parseStatus(text) {
  const parts = text.split('\0'), files = []
  for (let i = 0; i < parts.length; i++) {
    const item = parts[i]; if (!item || item.length < 4) continue
    const x = item.slice(0,2), file = item.slice(3)
    if (!file) continue
    // En salida -z el destino precede al origen, incluso con espacios.
    const oldPath = x.includes('R') || x.includes('C') ? (parts[++i] || '') : ''
    files.push({ path:file, oldPath, index:x[0], worktree:x[1], untracked:x==='??' })
  }
  return files
}
function registerVcsIpc(ipcMain, { authorize, packaged, resourcesPath, appPath, secretStore, testFileRemotes = false }) {
  const exe = bundledGit({ packaged, resourcesPath, appPath })
  const run = makeRunner(exe)
  async function checked(root, needsRepo = true) {
    const cwd = repoRoot(root, authorize)
    if (needsRepo) {
      const top = await run(cwd, ['rev-parse', '--show-toplevel'], {allowError:true})
      if (top.code || fs.realpathSync(top.stdout.trim()) !== fs.realpathSync(cwd)) throw new Error('El repositorio debe pertenecer exactamente a la carpeta del proyecto')
    }
    return cwd
  }
  // Copias en .git: no alteran el árbol de trabajo ni aparecen como archivos Git.
  // Se conserva el manifiesto para recuperar manualmente si la recarga de IndexedDB falla.
  const receipts = new Map()
  async function backup(cwd, paths, operation) {
    if (!fs.lstatSync(path.join(cwd,'.git')).isDirectory()) throw new Error('Repositorio no compatible con copia interna')
    const entries = [...new Set(paths)].map(safeFile)
    if (entries.length > 1000) throw new Error('Demasiados archivos para una recuperación segura')
    const id = crypto.randomUUID(), base = path.join(cwd,'.git','levelforge-backups',id)
    let total = 0
    const manifest = { id, operation, createdAt:new Date().toISOString(), files:[] }
    try {
      fs.mkdirSync(base,{recursive:true,mode:0o700})
      for (let i=0;i<entries.length;i++) {
        const rel = entries[i], file = safeRecoveryFile(cwd,rel)
        const present = fs.existsSync(file)
        if (present) {
          const size = fs.statSync(file).size
          total += size
          if (total > MAX_BACKUP_BYTES) throw new Error('El respaldo supera 128 MiB: cancela o reduce la operación')
          fs.copyFileSync(file,path.join(base,String(i)))
        }
        manifest.files.push({path:rel,present,index:i})
      }
      fs.writeFileSync(path.join(base,'manifest.json'),JSON.stringify(manifest,null,2))
      return {id,location:base,files:entries.length}
    } catch(err) {fs.rmSync(base,{recursive:true,force:true});throw err}
  }
  async function requireClean(cwd) {
    const result = await run(cwd,['status','--porcelain=v1','-z','--untracked-files=all'])
    if (result.stdout.length) throw new Error('Hay archivos modificados, preparados o nuevos. Crea un commit antes de cambiar o restaurar una versión.')
    const merge = await run(cwd,['rev-parse','-q','--verify','MERGE_HEAD'],{allowError:true})
    if (!merge.code) throw new Error('Resuelve la fusión pendiente antes de continuar')
  }
  async function pathsBetween(cwd,a,b) {
    const r = await run(cwd,['diff','--name-only','-z','--no-ext-diff',a,b,'--'])
    return r.stdout.split('\0').filter(Boolean).map(safeFile)
  }
  async function currentHead(cwd) {
    const r = await run(cwd,['rev-parse','--verify','HEAD'])
    return r.stdout.trim()
  }
  const actions = {
    async health(root) {
      const cwd = repoRoot(root, authorize)
      const version = await run(cwd, ['--version'])
      return { version:version.stdout.trim(), embedded:true, repository:fs.existsSync(path.join(cwd,'.git')) }
    },
    async init(root) {
      const cwd = await checked(root, false)
      const existing = await run(cwd, ['rev-parse', '--show-toplevel'], {allowError:true})
      if (existing.code === 0) {
        if (fs.realpathSync(existing.stdout.trim()) !== fs.realpathSync(cwd)) throw new Error('La carpeta pertenece a otro repositorio; no se inicializará uno anidado')
        return { created:false }
      }
      await run(cwd, ['init', '--initial-branch=main'])
      const ignore = path.join(cwd,'.gitignore')
      if (!fs.existsSync(ignore)) fs.writeFileSync(ignore, '# Century — datos temporales y derivados\n*.lftmp\n*.lfproj.bak-*\nnode_modules/\ndist/\ndist-runtime/\nrelease/\n.DS_Store\nThumbs.db\n')
      return { created:true }
    },
    async status(root) {
      const cwd = await checked(root)
      const s = await run(cwd, ['status', '--porcelain=v1', '-z', '--untracked-files=all'])
      const b = await run(cwd, ['symbolic-ref','--quiet','--short','HEAD'], {allowError:true})
      return { branch:b.code===0?b.stdout.trim():'(HEAD separado)', files:parseStatus(s.stdout) }
    },
    async commit(root, data = {}) {
      const cwd = await checked(root)
      const author = validateAuthor(data.name, data.email), message = validateMessage(data.message)
      const files = await actions.status(root)
      const available = new Set(files.files.map(f=>f.path))
      const selected = [...new Set(Array.isArray(data.paths)?data.paths:[])].map(safeFile)
      if (!selected.length || selected.length > 500 || selected.some(p=>!available.has(p))) throw new Error('Selecciona cambios válidos antes del commit')
      // Git --only ignora el staging ajeno; los untracked necesitan intent-to-add.
      // No se realiza un git add de todos los archivos ni un commit de todo el índice.
      const untracked = selected.filter(p => files.files.some(f => f.path === p && f.untracked))
      const hasHead = (await run(cwd, ['rev-parse','--verify','HEAD'], {allowError:true})).code === 0
      if (untracked.length) await run(cwd, ['add','-N','--',...untracked])
      try {
        await run(cwd, ['-c',`user.name=${author.name}`, '-c',`user.email=${author.email}`,
          'commit', '--only', '-m', message, '--', ...selected])
      } catch (error) {
        // Restaurar únicamente las marcas de intent-to-add creadas para esta operación.
        if (untracked.length) {
          await run(cwd, hasHead ? ['reset','-q','--',...untracked] : ['rm','--cached','-q','-f','--',...untracked], {allowError:true})
        }
        throw error
      }
      const changed = await run(cwd, ['diff-tree','--root','--no-commit-id','--name-only','-r','-z','HEAD'])
      const actual = changed.stdout.split('\0').filter(Boolean)
      if (actual.some(p => !selected.includes(p))) throw new Error('El commit contiene archivos ajenos a la selección; revisa el repositorio')
      const head = await run(cwd,['rev-parse','--short','HEAD'])
      return { hash:head.stdout.trim() }
    },
    async log(root, data = {}) {
      const cwd = await checked(root)
      const offset = Number(data.offset ?? 0), limit = Number(data.limit ?? 40)
      if (!Number.isInteger(offset) || offset < 0 || offset > 5000 || !Number.isInteger(limit) || limit < 1 || limit > 80) throw new Error('Paginación de historial inválida')
      const l = await run(cwd,['log','-n',String(limit),'--skip',String(offset),'--format=%H%x1f%s%x1f%an%x1f%aI%x1e'],{allowError:true})
      if (l.code) return []
      return l.stdout.split('\x1e').map(s=>s.trim()).filter(Boolean).map(s=>{
        const [hash,subject,author,date]=s.split('\x1f'); return {hash,subject,author,date}
      })
    },
  }
  // S03: catálogo de operaciones con confirmación por token de previsualización.
  actions.branches = async root => {
    const cwd = await checked(root)
    const out = await run(cwd,['for-each-ref','--format=%(refname:short)%09%(objectname)%09%(HEAD)','refs/heads'])
    return out.stdout.trimEnd().split('\n').filter(Boolean).slice(0,200).map(line=>{
      const [name,hash,head] = line.split('\t'); return {name,hash,current:head==='*'}
    })
  }
  actions.createBranch = async (root,data={}) => {
    const cwd = await checked(root), name=safeBranch(data.name)
    await run(cwd,['branch','--',name]);return {created:name}
  }
  actions.prepareChange = async (root,data={}) => {
    const cwd=await checked(root)
    await requireClean(cwd)
    const kind=data.kind
    if (!['switch','restoreFile','restoreProject'].includes(kind)) throw new Error('Operación desconocida')
    const previous=await currentHead(cwd)
    const branch=(await run(cwd,['symbolic-ref','-q','--short','HEAD'],{allowError:true})).stdout.trim()
    if(kind==='switch' && !branch) throw new Error('No se puede cambiar de rama desde HEAD separado')
    let target, files, selectedPath=''
    if (kind==='switch') {
      target=safeBranch(data.branch)
      const branches=await actions.branches(root)
      const found=branches.find(b=>b.name===target)
      if(!found) throw new Error('La rama seleccionada no existe')
      if(found.current) throw new Error('Esta rama ya está activa')
      files=await pathsBetween(cwd,previous,found.hash)
    } else {
      target=await actualRevision(cwd,data.hash)
      if(kind==='restoreFile') {
        selectedPath=safeFile(data.path)
        // Restaurar solo un archivo presente en la revisión, sin crear rutas externas.
        const found=await run(cwd,['cat-file','-e',`${target}:${selectedPath}`],{allowError:true})
        if(found.code) throw new Error('El archivo no existe en esa revisión')
        files=[selectedPath]
      } else {
        const found=await run(cwd,['cat-file','-e',`${target}:project.lfproj`],{allowError:true})
        if(found.code) throw new Error('La revisión no contiene project.lfproj')
        files=await pathsBetween(cwd,previous,target)
      }
    }
    // Evitar symlinks, rutas externas y un número no acotado de cambios.
    for(const file of files) safeRecoveryFile(cwd,file)
    if(files.length>1000) throw new Error('Demasiados archivos afectados')
    const token=crypto.randomUUID()
    const plan={kind,target,branch,previous,selectedPath,files,token,root:cwd,at:Date.now()}
    receipts.set(token,plan)
    return {token,kind,target,branch,files,affected:files.length,previous}
  }
  actions.applyChange = async (root,data={}) => {
    const cwd=await checked(root)
    const plan=receipts.get(data.token)
    if(!plan || plan.root!==cwd || Date.now()-plan.at>120000) throw new Error('La previsualización caducó; vuelve a comprobar la operación')
    receipts.delete(data.token)
    await requireClean(cwd)
    if(await currentHead(cwd)!==plan.previous) throw new Error('HEAD ha cambiado desde la previsualización')
    if(plan.kind==='switch') {
      const found=(await actions.branches(root)).find(b=>b.name===plan.target)
      if(!found) throw new Error('La rama desapareció')
    }
    const saved=await backup(cwd,plan.files.length?plan.files:['project.lfproj'],plan.kind)
    try {
      if(plan.kind==='switch') await run(cwd,['switch','--',plan.target])
      else if(plan.kind==='restoreFile') await run(cwd,['restore',`--source=${plan.target}`,'--worktree','--',plan.selectedPath])
      else await run(cwd,['restore',`--source=${plan.target}`,'--worktree','--','.'])
      // En todos los casos el proyecto en disco debe seguir siendo legible.
      if(!fs.existsSync(path.join(cwd,'project.lfproj'))) throw new Error('La operación dejó el proyecto sin project.lfproj')
      const after=await currentHead(cwd)
      const manifestFile=path.join(saved.location,'manifest.json')
      const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'))
      manifest.beforeHead=plan.previous
      manifest.afterHead=after
      manifest.beforeBranch=plan.branch
      manifest.afterBranch=plan.kind==='switch'?plan.target:plan.branch
      manifest.after=manifest.files.map(f=>{
        const file=safeRecoveryFile(cwd,f.path)
        return fs.existsSync(file)?crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'):null
      })
      fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2))
      return {backup:saved,kind:plan.kind,previous:plan.previous,branch:plan.branch,head:after}
    } catch(e) {throw new Error(`${e.message}. Respaldo disponible: ${saved.location}`)}
  }
  // La recuperación solo se ofrece tras un fallo al recargar el proyecto; se ejecuta
  // contra una copia cuya ruta/identificador proporcionó el propio backend.
  actions.recoverChange = async (root,data={}) => {
    const cwd=await checked(root)
    if(typeof data.id!=='string' || !/^[0-9a-f-]{36}$/.test(data.id)) throw new Error('Identificador de respaldo inválido')
    const dir=path.join(cwd,'.git','levelforge-backups',data.id)
    const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'))
    if(manifest.id!==data.id || manifest.files.length>1000) throw new Error('Respaldo inválido')
    if(manifest.afterHead!==await currentHead(cwd)) throw new Error('HEAD cambió después de la operación; no se recuperará automáticamente')
    const active=(await run(cwd,['symbolic-ref','-q','--short','HEAD'],{allowError:true})).stdout.trim()
    if(manifest.afterBranch!==active) throw new Error('La rama cambió después del respaldo')
    for(let i=0;i<manifest.files.length;i++) {
      const f=manifest.files[i], file=safeRecoveryFile(cwd,f.path)
      const current=fs.existsSync(file)?crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'):null
      if(current!==manifest.after?.[i]) throw new Error('El archivo '+f.path+' cambió desde la operación; recuperación automática cancelada')
    }
    if(manifest.operation==='switch') {
      await run(cwd,['switch','--',safeBranch(manifest.beforeBranch)])
    } else {
      if(manifest.operation==='pull') {
        // Retornar HEAD e índice a la revisión previa sin emplear reset --hard.
        const branch=safeBranch(manifest.beforeBranch)
        await run(cwd,['update-ref',`refs/heads/${branch}`,manifest.beforeHead,manifest.afterHead])
        await run(cwd,['read-tree','--reset',manifest.beforeHead])
      }
      for(const f of manifest.files) {
        const file=safeRecoveryFile(cwd,f.path)
        if(f.present) {fs.mkdirSync(path.dirname(file),{recursive:true});fs.copyFileSync(path.join(dir,String(f.index)),file)}
        else fs.rmSync(file,{force:true})
      }
    }
    return {restored:manifest.files.length,location:dir}
  }
  // Identificadores Git explícitos, nunca refs arbitrarias ni opciones enviadas por renderer.
  function revision(value, allowWorktree = false) {
    if (allowWorktree && value === 'WORKTREE') return value
    if (typeof value !== 'string' || !SHA_RE.test(value)) throw new Error('Identificador de revisión inválido')
    return value
  }
  async function actualRevision(cwd, value) {
    const q = await run(cwd, ['rev-parse','--verify',`${revision(value)}^{commit}`], {allowError:true})
    if (q.code || !/^[a-f0-9]{40,64}\s*$/i.test(q.stdout)) throw new Error('La revisión seleccionada ya no existe')
    return q.stdout.trim()
  }
  // --name-status -z devuelve código y origen seguido de destino en renombres.
  function changedFiles(output) {
    const parts = output.split('\0'), files = []
    for (let i=0;i<parts.length;i++) {
      const kind = parts[i]
      if (!kind) continue
      if (!/^[ACDMRTUXB][0-9]{0,3}$/.test(kind)) throw new Error('Formato de cambios Git inesperado')
      const first = parts[++i]
      if (!first) throw new Error('Ruta Git inválida')
      const isRename = /^[RC]/.test(kind)
      const file = isRename ? parts[++i] : first
      if (!file) throw new Error('Destino Git inválido')
      files.push({ path:file, oldPath:isRename ? first : '', status:kind[0] })
      if (files.length > MAX_CHANGED_FILES) throw new Error('Demasiados archivos para la comparación interactiva')
    }
    return files
  }
  actions.detail = async (root, data = {}) => {
    const cwd = await checked(root), sha = await actualRevision(cwd, data.hash)
    const meta = await run(cwd, ['show','-s','--format=%H%x1f%s%x1f%an%x1f%aI%x1f%b',sha])
    const [hash, subject, author, date, body] = meta.stdout.trimEnd().split('\x1f')
    const changed = await run(cwd, ['diff-tree','--root','--no-commit-id','--name-status','-z','-r','-M',sha])
    return {hash, subject, author, date, body:body?.slice(0,4000) || '', files:changedFiles(changed.stdout)}
  }
  actions.compare = async (root, data = {}) => {
    const cwd = await checked(root), base = await actualRevision(cwd, data.base)
    const target = revision(data.target, true)
    const dest = target === 'WORKTREE' ? null : await actualRevision(cwd,target)
    const args = ['diff','--no-ext-diff','--no-textconv','--name-status','-z','-M',base,...(dest ? [dest] : []),'--']
    const result = await run(cwd, args)
    const files = changedFiles(result.stdout)
    if (!dest) {
      // git diff BASE incluye staged y worktree de archivos ya rastreados; no incluye untracked.
      const s = await actions.status(root)
      for (const f of s.files.filter(f=>f.untracked)) {
        if (!files.some(g=>g.path===f.path)) files.push({path:f.path,oldPath:'',status:'A',untracked:true})
        if (files.length>MAX_CHANGED_FILES) throw new Error('Demasiados archivos para comparar')
      }
    }
    return {base,target:dest || 'WORKTREE',files}
  }
  actions.diff = async (root, data = {}) => {
    const cwd = await checked(root), base = await actualRevision(cwd,data.base)
    const target = revision(data.target,true)
    const dest = target === 'WORKTREE' ? null : await actualRevision(cwd,target)
    const file = safeFile(data.path)
    const comparison = await actions.compare(root,{base,target:dest || 'WORKTREE'})
    const changed = comparison.files.find(f=>f.path===file)
    if (!changed) throw new Error('El archivo no forma parte de la comparación')
    const paths = changed.oldPath && changed.oldPath !== file ? [safeFile(changed.oldPath),file] : [file]
    if (changed.untracked) {
      const full = path.resolve(cwd,file)
      // Evitar leer symlinks y archivos externos o de tamaño excesivo.
      const real = fs.realpathSync(full), baseDir = fs.realpathSync(cwd)
      if (!real.startsWith(baseDir + path.sep) || !fs.statSync(real).isFile()) throw new Error('Archivo externo no permitido')
      const size = fs.statSync(real).size
      if (size > MAX_DIFF_TEXT) return {path:file,kind:'binary',reason:'Archivo demasiado grande para vista de texto',size}
      const buf = fs.readFileSync(real)
      if (buf.includes(0)) return {path:file,kind:'binary',reason:'Archivo binario',size}
      let content
      try { content = new TextDecoder('utf-8', {fatal:true}).decode(buf) }
      catch { return {path:file,kind:'binary',reason:'Archivo no textual (UTF-8 inválido)',size} }
      return {path:file,kind:'text',text:content.split('\n').map(line => '+' + line).join('\n').slice(0,MAX_DIFF_TEXT),size,untracked:true}
    }
    const args = ['diff','--no-ext-diff','--no-textconv','--no-color','--unified=3','-M',base,
      ...(dest ? [dest] : []),'--',...paths]
    const d = await run(cwd,args)
    const output = d.stdout
    if (/^(Binary files|GIT binary patch)/m.test(output) || /\0/.test(output)) return {path:file,kind:'binary',reason:'Git identifica este archivo como binario'}
    if (output.length > MAX_DIFF_TEXT) return {path:file,kind:'large',reason:'Diferencia textual demasiado grande',size:output.length}
    return {path:file,kind:'text',text:output || 'Sin diferencia textual disponible (contenido binario o cambio de metadatos).'}
  }
  require('./vcs-remote.cjs').installRemoteActions(actions, {run, checked, requireClean, currentHead, backup, authorize, safeRecoveryFile, receipts, packaged, resourcesPath, appPath, secretStore}, {testFileTransport:testFileRemotes})
  ipcMain.handle('lf:vcs', async (_event, action, root, data) => {
    if (!Object.hasOwn(actions, action)) throw new Error('Operación Git no permitida')
    return actions[action](root,data)
  })
  return { exe, run, actions }
}
module.exports = { bundledGit, repoRoot, validateAuthor, validateMessage, safeFile, parseStatus, makeRunner, registerVcsIpc }
