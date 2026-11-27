import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, relative, win32 } from 'node:path'
import { createServer } from 'vite'
import { createScriptSync, MANIFEST } from '../src/core/vscode/sync.js'

const require = createRequire(import.meta.url)
const { openVSCode, vscodeLaunchers } = require('../electron/vscode.cjs')
const extension = require('../vscode-extension/lib/core.js')
const text = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('el menú abre solo la raíz y Assets entrega el ID del script', () => {
  assert.match(text('src/core/commands.js'), /add\('game\.vscode'.+run: \(\) => openInVSCode\(\)/)
  assert.match(text('src/components/ProjectPanel.vue'), /if \(it\.kind === 'script'\) return openInVSCode\(it\.id\)/)
  assert.match(text('electron/preload.cjs'), /ipcRenderer\.invoke\('lf:openVSCode', root, file\)/)
})

test('CLI prepara la extensión y mantiene raíz/archivo como argumentos separados', async () => {
  const calls = []
  const run = (command, args, options, done) => {
    calls.push({ command, args, options })
    if (command === 'code') return done(new Error('ENOENT'))
    done(null, args.includes('--version') ? '1.100.0' : args.includes('--list-extensions') ? 'levelforge.levelforge@9.0.0' : '')
  }
  const root = '/tmp/Proyecto con espacios & símbolos'
  const file = root + '/Assets/Scripts/Uno.js'
  for (const target of [null, file]) {
    const result = await openVSCode(root, target, { run, launchers: vscodeLaunchers('linux', {}) })
    assert.equal(result.ok, true)
    assert.equal(result.launcher, 'code-insiders')
    assert.deepEqual(calls.at(-1).args, target ? [root, file] : [root])
    assert.equal(calls.at(-1).options.cwd, root)
    assert.equal(calls.at(-1).options.shell, undefined)
  }
})

test('Linux usa Flathub si los CLI nativos faltan y conserva el mismo destino', async () => {
  const calls = []
  const run = (command, args, options, done) => {
    calls.push({ command, args })
    if (command !== 'flatpak') return done(new Error('ENOENT'))
    done(null, args.includes('--version') ? '1.100.0' : args.includes('--list-extensions') ? 'levelforge.levelforge@9.0.0' : '')
  }
  const root = '/tmp/Proyecto con espacios & símbolos'
  const result = await openVSCode(root, null, { launchers: vscodeLaunchers('linux', {}), run })
  assert.equal(result.ok, true)
  assert.deepEqual(calls.at(-1), { command: 'flatpak', args: ['run', 'com.visualstudio.code', root] })
})

test('Linux informa del fallo y otros sistemas no prueban Flatpak', async () => {
  for (const platform of ['linux', 'darwin', 'win32']) {
    const launchers = vscodeLaunchers(platform, {}, () => false)
    const result = await openVSCode('/tmp', null, { launchers, run: (_, args, options, done) => done(new Error('no disponible')) })
    assert.equal(result.ok, false)
    assert.equal(result.stage, 'detection')
    assert.equal(launchers.some(l => l.command === 'flatpak'), platform === 'linux')
  }
})

test('Windows resuelve ejecutable y CLI pertenecientes a la misma instalación', () => {
  const install = 'C:\\Usuarios\\Ariel Dev\\AppData\\Local\\Programs\\Microsoft VS Code'
  const command = win32.join(install, 'Code.exe')
  const cli = win32.join(install, 'resources', 'app', 'out', 'cli.js')
  const installed = new Set([command, cli])
  assert.deepEqual(vscodeLaunchers('win32', { Path: '"' + win32.join(install, 'bin') + '"' }, p => installed.has(p)), [{ command, cli }])
})

test('la extensión reconoce la raíz y conserva los tipos generados y el jsconfig existente', () => {
  const config = JSON.parse(text('vscode-extension/package.json'))
  const files = new Set(['project.lfproj', '.levelforge/api.d.ts', '.levelforge/project.d.ts', 'jsconfig.json'])
  assert.ok(config.activationEvents.includes('workspaceContains:project.lfproj'))
  assert.ok(extension.isProject(p => files.has(p)))
  assert.deepEqual([...extension.prepareFiles(p => files.has(p), 'fallback')], [])
  assert.ok(extension.JSCONFIG.include.includes('.levelforge/*.d.ts'))
  assert.equal(text('vscode-extension/media/game-api.d.ts'), text('src/core/events/game-api.d.ts'))
})

test('una sincronización antigua no aplica cambios al proyecto nuevo', async () => {
  const old = { path: 'A' }, next = { path: 'B' }
  let loc = old, release, enter
  const entered = new Promise(resolve => { enter = resolve })
  const calls = []
  const sync = createScriptSync({
    getLoc: () => loc, getScripts: () => [], interval: 100000,
    apply: { importScript: path => calls.push(path) },
    disk: {
      async scanFiles(target) {
        if (target === old) { enter(); await new Promise(resolve => { release = resolve }) }
        return [{ path: 'Assets/' + target.path + '.js', size: 1, mtime: 1 }]
      },
      async readFile(target, path) { return path === MANIFEST ? null : new TextEncoder().encode(target.path) },
      async writeFiles() {},
    },
  })
  try {
    const first = sync.start(old)
    await entered
    loc = next
    const second = sync.start(next)
    release()
    await Promise.all([first, second])
    assert.deepEqual(calls, ['Assets/B.js'])
  } finally { sync.stop() }
})

test('la integración prepara dos proyectos y rechaza sincronización, tipos o script inválidos', async t => {
  const vite = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' })
  t.after(() => vite.close())
  globalThis.window = {}
  const { createVscode } = await vite.ssrLoadModule('/src/core/state/vscode.js')
  const { store } = await vite.ssrLoadModule('/src/core/state/state.js')
  const { createProjectData } = await vite.ssrLoadModule('/src/core/project.js')
  const sandbox = await mkdtemp(join(tmpdir(), 'lf-vscode-'))
  t.after(() => rm(sandbox, { recursive: true, force: true }))
  const calls = []
  let failSync = false, failTypes = false, loc
  const bridge = {
    openVSCode: async (...args) => { calls.push(args); return { ok: true } },
    fs: {
      exists: async (root, path) => !!await stat(join(root, path)).catch(() => null),
      readFile: (root, path) => readFile(join(root, path)).catch(() => null),
      scan: async (root, dir) => {
        if (failSync) throw new Error('disco no disponible')
        const paths = await readdir(join(root, dir), { recursive: true }).catch(() => [])
        const files = []
        for (const name of paths.filter(p => p.endsWith('.js'))) {
          const absolute = join(root, dir, name)
          const info = await stat(absolute)
          files.push({ path: relative(root, absolute).replaceAll('\\', '/'), size: info.size, mtime: info.mtimeMs })
        }
        return files
      },
      writeFiles: async (root, writes, remove) => {
        for (const { path, data } of writes) {
          if (failTypes && path === '.levelforge/project.d.ts') throw new Error('tipos sin permiso')
          const file = join(root, path)
          await mkdir(dirname(file), { recursive: true })
          await writeFile(file, data)
        }
        for (const path of remove) await rm(join(root, path), { force: true })
      },
    },
  }
  globalThis.window = { lf: bridge }
  const editor = createVscode({
    getLoc: () => loc,
    serializeProject: () => ({ meta: store.project, scene: {} }),
    collectScenes: async () => new Map(),
  })
  t.after(() => { editor.stop(); delete globalThis.window })
  const script = 'Assets/Scripts/Igual.js'
  for (const name of ['Proyecto A', 'Proyecto B']) {
    loc = { kind: 'path', path: join(sandbox, name) }
    await mkdir(loc.path)
    store.project = createProjectData(name)
    store.project.scripts = [{ id: name, execution: 'node', folder: 'Assets/Scripts', name: 'Igual.js', code: 'const n = 1' }]
    await assert.rejects(editor.open(), /Guarda el proyecto/)
    await writeFile(join(loc.path, 'project.lfproj'), 'marcador')
    await writeFile(join(loc.path, 'jsconfig.json'), 'configuración propia')
    await editor.startSync(loc)
    assert.equal(editor.active, true)
    await editor.open()
    await editor.open(name)
    assert.deepEqual(calls.slice(-2), [[loc.path, null], [loc.path, script]])
    assert.match(await readFile(join(loc.path, '.levelforge/project.d.ts'), 'utf8'), new RegExp(name))
    assert.equal(await readFile(join(loc.path, 'jsconfig.json'), 'utf8'), 'configuración propia')
    assert.equal(await readFile(join(loc.path, script), 'utf8'), 'const n = 1')
  }
  await writeFile(join(loc.path, script), 'const n = 2')
  await editor.flush({ force: true })
  assert.equal(store.project.scripts[0].code, 'const n = 2')
  assert.equal(store.project.scripts[0].id, 'Proyecto B')
  assert.equal(store.project.scripts[0].execution, 'node')
  assert.equal(await readFile(join(sandbox, 'Proyecto A', script), 'utf8'), 'const n = 1')
  await assert.rejects(editor.open('id antiguo'), /ya no existe/)
  failSync = true
  await assert.rejects(editor.open(), /disco no disponible/)
  failSync = false
  store.project.name = 'Nuevo nombre'
  failTypes = true
  await assert.rejects(editor.open(), /tipos sin permiso/)
  assert.equal(calls.length, 4)
  failTypes = false
  assert.equal(await editor.open(), true)
  assert.match(await readFile(join(loc.path, '.levelforge/project.d.ts'), 'utf8'), /Nuevo nombre/)
})

test('guardar incorpora la edición externa antes de capturar revisión y serializar', () => {
  const source = text('src/core/state/project.js').split('export async function saveAll()')[1].split('async function restoreConfirmedDisk')[0]
  assert.match(source, /await vsc\?\.flush\(\{ force: true \}\)[\s\S]+const revision = store\.pendingRevision[\s\S]+await saveNow/)
})
