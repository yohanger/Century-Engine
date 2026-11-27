// Entrada normal de escritorio: Electron carga dist/ mediante file:// sin servidor Vite.
// --build recompila solo la interfaz Editor/FilmMaker si se solicita explícitamente.
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { editorBuildStatus } from './editor-build-fingerprint.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const flags = new Set(process.argv.slice(2))
const entry = flags.has('--filmmaker') ? 'filmmaker.html' : 'index.html'
const dist = path.join(root, 'dist')

const build = flags.has('--build')
if (build) {
  console.log('Compilación del Editor solicitada explícitamente (--build)…')
  const result = spawnSync(process.execPath,
    [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build'],
    { cwd: root, stdio: 'inherit' })
  if (result.error || result.status !== 0) {
    if (result.error) console.error(`ERROR Vite: ${result.error.message}`)
    process.exit(result.status ?? 1)
  }
}

// Antes de ejecutar preparadores/abrir Electron, exigir el HTML y sus bundles enlazados.
const htmlFile = path.join(dist, entry)
if (!existsSync(htmlFile)) {
  console.error(`ERROR · BUILD NO DISPONIBLE: no existe dist/${entry}.`)
  console.error('Century no puede ejecutar Electron sin la compilación local. Ejecuta npm run build y vuelve a intentarlo.')
  process.exit(1)
}
let html
try { html = readFileSync(htmlFile, 'utf8') }
catch (error) { console.error(`ERROR · BUILD NO DISPONIBLE: no se puede leer dist/${entry}: ${error.message}`); process.exit(1) }
for (const match of html.matchAll(/(?:src|href)\s*=\s*["']((?:\.\/)?assets\/[^"']+)["']/g)) {
  const asset = decodeURIComponent(match[1].split(/[?#]/)[0].replace(/^\.\//, ''))
  if (!existsSync(path.join(dist, asset))) {
    console.error(`ERROR · BUILD INCOMPLETA: falta dist/${asset}, requerido por dist/${entry}.`)
    console.error('Ejecuta npm run build para regenerar la compilación del Editor.')
    process.exit(1)
  }
}

const status = editorBuildStatus(root, dist)
if (status.state === 'outdated') {
  console.warn(`ADVERTENCIA · BUILD DESACTUALIZADA: la compilación de Century (${status.compiledVersion}) no corresponde al código fuente actual (${status.currentVersion}).`)
  console.warn('Se abrirá la versión compilada. Ejecuta npm run build para actualizarla.')
} else if (status.state === 'unknown') {
  console.warn(`ADVERTENCIA · BUILD NO VERIFICABLE: ${status.reason}.`)
  console.warn('Se abrirá la compilación existente; ejecuta npm run build para verificar su actualidad.')
}

const require = createRequire(import.meta.url)
const { prepareVSCodeExtension } = await import('./prepare-vscode-extension.mjs')
await prepareVSCodeExtension(root)

if (process.platform === 'linux') {
  const { prepareLinuxGit } = await import('./prepare-vcs-git.mjs')
  try { prepareLinuxGit(root) }
  catch (error) { console.error(`ERROR Git embebido: ${error.message}`); process.exit(1) }
}

const args = []
if (process.platform === 'linux' && flags.has('--webgpu')) {
  args.push('--ozone-platform=x11', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=vulkan')
}
args.push('.')
if (flags.has('--filmmaker')) args.push('--filmmaker')
if (process.platform === 'linux' && process.getuid?.() === 0) args.push('--no-sandbox')
const env = { ...process.env }
delete env.VITE_DEV_URL // No permitir que un Vite externo fuerce loadURL() en modo normal.
const child = spawn(require('electron'), args, { cwd: root, stdio: 'inherit', env })
child.on('error', (error) => { console.error(`ERROR Electron: ${error.message}`); process.exitCode = 1 })
child.on('exit', (code) => { process.exitCode = code ?? 1 })
