// Desarrollo en Electron: levanta Vite, espera a que responda y abre la ventana apuntando a él.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const { prepareVSCodeExtension } = await import('./prepare-vscode-extension.mjs')
await prepareVSCodeExtension(root)

// Reparar permisos tras extraer un ZIP antes de iniciar Electron (solo Linux).
if (process.platform === 'linux') {
  const { prepareLinuxGit } = await import('./prepare-vcs-git.mjs')
  try { prepareLinuxGit(root) }
  catch (error) { console.error(`ERROR Git embebido: ${error.message}`); process.exit(1) }
}
const PORT = 5173
const URL_DEV = `http://127.0.0.1:${PORT}/`

const vite = spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: root, stdio: 'inherit' })
let electron = null
let viteEnded = false
const stop = (code = 0) => { vite.kill(); electron?.kill(); process.exit(code) }
vite.on('error', (error) => { console.error(`ERROR Vite: ${error.message}`); stop(1) })
vite.on('exit', (code) => {
  viteEnded = true
  if (electron) { console.error('Vite se ha detenido; cerrando Electron.'); stop(code || 1) }
})
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())

let ready = false
for (let i = 0; i < 100 && !viteEnded; i++) {
  try {
    const response = await fetch(URL_DEV, { signal: AbortSignal.timeout(700) })
    if (response.ok) { ready = true; break }
  } catch { /* Vite todavía arrancando */ }
  await new Promise(resolve => setTimeout(resolve, 150))
}
if (!ready || viteEnded) {
  console.error(viteEnded ? 'Vite terminó antes de abrir Electron.' : 'Vite no respondió en el puerto 5173.')
  stop(1)
}

const args = []
if (process.platform === 'linux' && process.argv.includes('--webgpu')) {
  args.push('--ozone-platform=x11', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--use-angle=vulkan')
}
args.push('.')
if (process.argv.includes('--filmmaker')) args.push('--filmmaker')
if (process.platform === 'linux' && process.getuid?.() === 0) args.push('--no-sandbox')
electron = spawn(require('electron'), args, { cwd: root, stdio: 'inherit', env: { ...process.env, VITE_DEV_URL: URL_DEV } })
electron.on('error', (error) => { console.error(`ERROR Electron: ${error.message}`); stop(1) })
electron.on('exit', (code) => stop(code ?? 1))
