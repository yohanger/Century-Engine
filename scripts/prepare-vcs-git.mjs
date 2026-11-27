// Aprovisionamiento reproducible del Git nativo, sin depender del Git instalado por el usuario.
// Windows: MinGit oficial, descarga fijada por versión y SHA-256 antes de extraer.
import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

export const MINGIT = Object.freeze({
  version: '2.56.0.4',
  sha256: 'e3bf78351fe777fba47ddee5950082f8a98bb0f02604fdc7ba3ee2cb68ffa877',
  url: 'https://github.com/git-for-windows/git/releases/download/v2.56.0.windows.4/MinGit-2.56.0.4-64-bit.zip',
})
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const LINUX_GIT_EXECUTABLES = Object.freeze([
  'vendor/git/linux-x64/bin/git',
  'vendor/git/linux-x64/libexec/git-core/git-remote-http',
  'vendor/git/linux-x64/libexec/git-core/git-remote-https',
])

// Solo ejecutables ELF x86_64 propios: no cambiar permisos en vendor/ de forma recursiva.
export function prepareLinuxGit(root = projectRoot, { checkExecution = true } = {}) {
  // Comprobar los tres archivos antes de modificar permisos: una distribución incompleta se bloquea.
  const files = LINUX_GIT_EXECUTABLES.map(relative => {
    const absolute = path.join(root, relative)
    let stat
    try { stat = fs.lstatSync(absolute) }
    catch { throw new Error(`Git Linux embebido ausente: ${relative}`) }
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Git Linux embebido no es un archivo regular: ${relative}`)
    const header = Buffer.alloc(20)
    const fd = fs.openSync(absolute, 'r')
    try { if (fs.readSync(fd, header, 0, header.length, 0) !== header.length ||
      header.toString('hex', 0, 4) !== '7f454c46' || header[4] !== 2 ||
      header.readUInt16LE(18) !== 62) throw new Error(`Binario Linux x86_64 inválido: ${relative}`) }
    finally { fs.closeSync(fd) }
    return { absolute, relative, mode: stat.mode & 0o777 }
  })
  for (const { absolute, relative, mode } of files) {
    if (mode !== 0o755) {
      try { fs.chmodSync(absolute, 0o755) }
      catch (error) { throw new Error(`No se pudo restaurar 0755 en ${relative}: ${error.message}`) }
    }
    try { fs.accessSync(absolute, fs.constants.X_OK) }
    catch (error) { throw new Error(`${relative} no es ejecutable: ${error.message}`) }
  }
  const [bin, http, https] = files.map(item => item.absolute)
  if (checkExecution) {
    const result = spawnSync(bin, ['--version'], {
      encoding: 'utf8', timeout: 15000, windowsHide: true,
      env: { ...process.env,
        PATH: path.dirname(bin),
        GIT_EXEC_PATH: path.dirname(http),
        GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
      },
    })
    if (result.error || result.status !== 0 || !/^git version /i.test(result.stdout || '')) {
      const cause = result.error?.message || String(result.stderr || `salida ${result.status}`).trim()
      throw new Error(`Git Linux embebido no puede ejecutarse (${cause}). Verifica permisos, dependencias y montaje noexec.`)
    }
  }
  return { platform: 'linux', binary: bin, httpHelper: http, httpsHelper: https }
}
function download(url, redirects = 4) {
  if (!url.startsWith('https://')) throw new Error('MinGit debe descargarse mediante HTTPS')
  return new Promise((resolve, reject) => {
    https.get(url, {headers:{'User-Agent':'Century-VCS/0.26.13'}}, resp => {
      if ([301,302,303,307,308].includes(resp.statusCode) && redirects > 0) {
        const next = new URL(resp.headers.location || '', url)
        resp.resume()
        if (next.protocol !== 'https:') reject(new Error('Redirección insegura de MinGit'))
        else download(next.href, redirects - 1).then(resolve,reject)
        return
      }
      if (resp.statusCode !== 200) { resp.resume(); reject(new Error(`No se pudo descargar MinGit (HTTP ${resp.statusCode})`)); return }
      const chunks=[]; let size=0
      resp.on('data', buf => { size+=buf.length; if (size>80*1024*1024) resp.destroy(new Error('Archivo MinGit excesivo')); else chunks.push(buf) })
      resp.on('end',()=>resolve(Buffer.concat(chunks)))
      resp.on('error',reject)
    }).on('error',reject)
  })
}
export function verifiedArchive(buf) {
  const digest=createHash('sha256').update(buf).digest('hex')
  if(digest!==MINGIT.sha256) throw new Error(`MinGit SHA-256 incorrecto: ${digest}`)
  return true
}
export async function prepareGit(root = projectRoot, platform=process.platform, { archive = null }={}) {
  if (platform === 'linux') return prepareLinuxGit(root)
  if(platform!=='win32') throw new Error(`Plataforma no incluida en este Gate: ${platform}`)
  const dir=path.join(root,'vendor/git/win-x64')
  const exe=path.join(dir,'cmd/git.exe')
  const httpsHelper=path.join(dir,'mingw64/libexec/git-core/git-remote-https.exe')
  if(fs.existsSync(exe)) {
    if(!fs.existsSync(httpsHelper)) throw new Error('MinGit no incluye el auxiliar HTTPS requerido')
    return {platform,binary:exe,cached:true}
  }
  // Los usuarios no necesitan instalar Git: el responsable del build descarga MinGit una vez.
  const bytes=archive ? fs.readFileSync(archive) : await download(MINGIT.url)
  verifiedArchive(bytes)
  const { default: JSZip }=await import('jszip')
  const zip=await JSZip.loadAsync(bytes)
  const files=Object.values(zip.files).filter(f=>!f.dir)
  if (files.length>1500) throw new Error('MinGit contiene demasiadas entradas')
  for (const f of files) {
    const relative=f.name.replace(/\\/g,'/')
    if(!relative || relative.startsWith('/') || relative.split('/').some(x=>x==='..')) throw new Error('Ruta insegura dentro de MinGit')
    const dest=path.resolve(dir,relative)
    if(!dest.startsWith(path.resolve(dir)+path.sep)) throw new Error('Ruta externa en MinGit')
    const content=await f.async('nodebuffer')
    fs.mkdirSync(path.dirname(dest),{recursive:true})
    fs.writeFileSync(dest,content)
  }
  if(!fs.existsSync(exe) || !fs.existsSync(httpsHelper)) throw new Error('El paquete MinGit carece de Git o del auxiliar HTTPS requerido')
  return {platform,binary:exe,downloaded:true}
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  prepareGit(projectRoot,process.platform,{archive:process.env.LEVELFORGE_MINGIT_ZIP||null})
    .then(r=>console.log(`Git embebido verificado para ${r.platform}: ${r.binary}`))
    .catch(e=>{console.error(`ERROR Git embebido: ${e.message}`);process.exitCode=1})
}
