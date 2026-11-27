// Lanzamiento del CLI oficial sin pasar rutas del proyecto por una shell.
const { execFile } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const FLATPAK_ARGS = ['run', 'com.visualstudio.code']

function vscodeLaunchers(platform, env, exists = fs.existsSync) {
  if (platform !== 'win32') {
    const launchers = ['code', 'code-insiders', 'codium'].map(command => ({ command }))
    if (platform === 'linux') launchers.push({ command: 'flatpak', prefix: FLATPAK_ARGS })
    return launchers
  }
  const { win32 } = path
  const pathDirs = (env.Path ?? env.PATH ?? '').split(win32.delimiter).filter(Boolean)
    .map(dir => dir.replace(/^"|"$/g, ''))
  const dirs = pathDirs.flatMap(dir => [dir, win32.dirname(dir)])
  const installDirs = [
    ['Microsoft VS Code', 'Code.exe'], ['Microsoft VS Code Insiders', 'Code - Insiders.exe'], ['VSCodium', 'VSCodium.exe'],
  ]
  const roots = [env.LOCALAPPDATA && win32.join(env.LOCALAPPDATA, 'Programs'), env.ProgramFiles, env['ProgramFiles(x86)']].filter(Boolean)
  return installDirs.flatMap(([folder, exe]) => {
    const candidates = [...dirs, ...roots.map(root => win32.join(root, folder))]
    return [...new Set(candidates.filter(dir => win32.isAbsolute(dir)))].flatMap(dir => {
      const command = win32.join(dir, exe)
      const cli = win32.join(dir, 'resources', 'app', 'out', 'cli.js')
      return exists(command) && exists(cli) ? [{ command, cli }] : []
    })
  })
}

async function openVSCode(dir, file, {
  launchers = vscodeLaunchers(process.platform, process.env), run = execFile,
  bundleDir = path.join(__dirname, '..', 'vendor', 'vscode-extension'), home,
  signal, onPrepared,
} = {}) {
  const invoke = (launcher, args, timeout = 15000, openingSignal) => new Promise((resolve, reject) => {
    const { command, cli, prefix = [] } = launcher
    const env = { ...process.env }
    if (cli) env.ELECTRON_RUN_AS_NODE = '1'
    else delete env.ELECTRON_RUN_AS_NODE
    run(command, [...(cli ? [cli] : prefix), ...args], {
      cwd: dir, windowsHide: true, timeout, maxBuffer: 1024 * 1024, env,
      ...(openingSignal ? { signal: openingSignal } : {}),
    }, (error, stdout, stderr) => {
      if (error) reject(new Error(String(stderr || error.message).trim().slice(-1500)))
      else resolve(String(stdout || ''))
    })
  })
  let selected = null
  const failures = []
  for (const launcher of launchers) {
    try {
      const version = await invoke(launcher, ['--version'])
      if (!/^\d+\.\d+\.\d+/m.test(version)) throw new Error('El CLI no devolvió una versión válida.')
      selected = launcher
      break
    } catch (error) { failures.push(`${launcher.command}: ${error.message}`) }
  }
  if (!selected) return {
    ok: false, stage: 'detection',
    error: 'No se encontró una instalación disponible de VS Code. Instálala y vuelve a intentarlo.\n' + failures.join('\n'),
  }
  let extension
  try {
    extension = await require('./vscode-extension.cjs').ensureExtension(selected, invoke, { bundleDir, home })
  } catch (error) {
    return { ok: false, stage: 'extension', launcher: selected.command,
      error: `No se pudo preparar la extensión de Century en ${selected.command}: ${error.message}` }
  }
  try {
    onPrepared?.(extension)
    // En modo puente, el servidor limita la espera de conexión y cancela solo
    // el arranque fallido. Un CLI aún abierto no debe cerrar una ventana ya conectada.
    await invoke(selected, file ? [dir, file] : [dir], signal ? 0 : 15000, signal)
    return { ok: true, launcher: selected.command, extension }
  } catch (error) {
    return { ok: false, stage: 'open', launcher: selected.command,
      error: `La extensión está disponible, pero VS Code no pudo abrir el proyecto: ${error.message}` }
  }
}

module.exports = { openVSCode, vscodeLaunchers }
