import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createRequire } from 'node:module'
import JSZip from 'jszip'
import vm from 'node:vm'
import { prepareVSCodeExtension } from './prepare-vscode-extension.mjs'
const require = createRequire(import.meta.url)
const { openVSCode, vscodeLaunchers } = require('../electron/vscode.cjs')
const { installedVersion, readBundle } = require('../electron/vscode-extension.cjs')
const bundleDir = path.resolve('vendor/vscode-extension')
const bundled = JSON.parse(readFileSync(path.join(bundleDir, 'manifest.json'))).version

function cli({ version = null, available = 'code', fail, unchanged = false, delay = 0 } = {}) {
  const calls = []
  const run = (command, args, options, done) => {
    calls.push({ command, args, options })
    const complete = () => {
      if (command !== available) return done(new Error('ENOENT'))
      if (fail?.(command, args)) return done(new Error('EACCES'), '', 'Permiso denegado')
      if (args.includes('--version')) return done(null, '1.100.0\ncommit\nx64\n')
      if (args.includes('--list-extensions')) return done(null, `other.extension@1.0.0\n${version ? `levelforge.levelforge@${version}\n` : ''}`)
      if (args.includes('--install-extension')) {
        assert.ok(existsSync(args[args.indexOf('--install-extension') + 1]), 'VSIX materializado antes de instalar')
        if (!unchanged) version = bundled
      }
      done(null, '')
    }
    if (delay) setTimeout(complete, delay); else complete()
  }
  return { run, calls, options: { run, bundleDir, launchers: [{ command: available }] } }
}

for (const [name, version, status, installs] of [
  ['ausente', null, 'installed', 1], ['anterior', '0.1.2', 'updated', 1],
  ['igual', bundled, 'current', 0], ['superior', '9.0.0', 'newer', 0],
  ['prerelease anterior', '0.1.3-beta.2', 'updated', 1],
]) test(`S03: extensión ${name}`, async () => {
  const fake = cli({ version })
  const result = await openVSCode('/tmp', null, fake.options)
  assert.equal(result.ok, true, result.error)
  assert.equal(result.extension.status, status)
  assert.equal(fake.calls.filter(c => c.args.includes('--install-extension')).length, installs)
  assert.equal(fake.calls.filter(c => c.args.includes('--list-extensions')).length, installs ? 2 : 1)
  const install = fake.calls.find(c => c.args.includes('--install-extension'))
  if (install) assert.equal(existsSync(install.args[1]), false, 'temporal retirado')
})

test('S03: comparación semántica, mayúsculas, CRLF y versiones inválidas', () => {
  assert.equal(installedVersion('LEVELFORGE.LEVELFORGE@0.9.0\r\nlevelforge.levelforge@0.10.0\n'), '0.10.0')
  assert.equal(installedVersion('otro.levelforge@4.0.0'), null)
  assert.throws(() => installedVersion('levelforge.levelforge@rota'))
})

test('S03: Flatpak lee el VSIX desde su caché y conserva argumentos con espacios y símbolos', async t => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'lf-home & '))
  t.after(() => fs.rm(home, { recursive: true, force: true }))
  const fake = cli({ available: 'flatpak' })
  const root = '/tmp/Juego & $(literal)'; const file = root + '/Assets/Uno.js'
  const result = await openVSCode(root, file, { ...fake.options, home, launchers: vscodeLaunchers('linux', {}) })
  assert.equal(result.ok, true, result.error)
  const install = fake.calls.find(c => c.args.includes('--install-extension'))
  const vsix = install.args[install.args.indexOf('--install-extension') + 1]
  assert.ok(vsix.startsWith(path.join(home, '.var/app/com.visualstudio.code/cache/levelforge')))
  assert.deepEqual(fake.calls.find(c => c.args.includes('--command=test')).args, ['run', '--command=test', 'com.visualstudio.code', '-r', vsix])
  assert.deepEqual(fake.calls.at(-1).args, ['run', 'com.visualstudio.code', root, file])
  for (const call of fake.calls) assert.equal(call.options.shell, undefined)
})

for (const phase of ['--list-extensions', '--install-extension', '--command=test']) test(`S03: error en ${phase} no abre ni salta a otro editor y permite reintento`, async t => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'lf-retry-'))
  t.after(() => fs.rm(home, { recursive: true, force: true }))
  const available = phase === '--command=test' ? 'flatpak' : 'code'
  let broken = true
  const fake = cli({ available, fail: (_, args) => broken && args.includes(phase) })
  const options = { ...fake.options, home, launchers: [{ command: available, ...(available === 'flatpak' ? { prefix: ['run', 'com.visualstudio.code'] } : {}) }, { command: 'other' }] }
  const first = await openVSCode('/tmp', null, options)
  assert.equal(first.stage, 'extension'); assert.match(first.error, /Permiso denegado/)
  assert.ok(!fake.calls.some(c => c.command === 'other' || c.args[0] === '/tmp'))
  broken = false
  assert.equal((await openVSCode('/tmp', null, options)).ok, true)
})

test('S03: salida cero de instalación sin versión registrada es un error', async () => {
  const fake = cli({ unchanged: true })
  const result = await openVSCode('/tmp', null, fake.options)
  assert.equal(result.ok, false); assert.match(result.error, /no registra/)
  assert.ok(!fake.calls.some(c => c.args[0] === '/tmp'))
})

test('S03: error al abrir conserva la instalación elegida', async () => {
  const fake = cli({ version: bundled, fail: (_, args) => args[0] === '/tmp' })
  const result = await openVSCode('/tmp', null, { ...fake.options, launchers: [{ command: 'code' }, { command: 'flatpak' }] })
  assert.equal(result.stage, 'open'); assert.ok(fake.calls.every(c => c.command === 'code'))
})

test('S03: ausencia de CLI informa sin instalar', async () => {
  const fake = cli({ available: 'missing' })
  const result = await openVSCode('/tmp', null, { ...fake.options, launchers: vscodeLaunchers('linux', {}) })
  assert.equal(result.stage, 'detection'); assert.match(result.error, /Instálala/)
  assert.equal(fake.calls.length, 4)
})

test('S03: aperturas concurrentes comparten instalación pero no destino; después se vuelve a consultar', async () => {
  const fake = cli({ delay: 5 })
  const results = await Promise.all(['A', 'B'].map(file => openVSCode('/tmp', `/tmp/Assets/${file}.js`, fake.options)))
  assert.ok(results.every(r => r.ok))
  assert.equal(fake.calls.filter(c => c.args.includes('--install-extension')).length, 1)
  assert.deepEqual(fake.calls.filter(c => c.args[0] === '/tmp').map(c => c.args[1]).sort(), ['/tmp/Assets/A.js', '/tmp/Assets/B.js'])
  const before = fake.calls.length
  await openVSCode('/tmp', null, fake.options)
  assert.ok(fake.calls.slice(before).some(c => c.args.includes('--list-extensions')))
})

test('S03: Windows usa cli.js y ELECTRON_RUN_AS_NODE para todas las fases', async () => {
  const launcher = { command: 'C:\\VS Code\\Code.exe', cli: 'C:\\VS Code\\resources\\app\\out\\cli.js' }
  const fake = cli({ version: bundled, available: launcher.command })
  const result = await openVSCode('D:\\Juegos & QA', 'D:\\Juegos & QA\\Assets\\Uno.js', { ...fake.options, launchers: [launcher] })
  assert.equal(result.ok, true)
  assert.ok(fake.calls.every(c => c.args[0] === launcher.cli && c.options.env.ELECTRON_RUN_AS_NODE === '1' && !c.options.shell))
})

test('S03: VSIX dañado o metadatos inválidos impiden instalar', async t => {
  const broken = await fs.mkdtemp(path.join(os.tmpdir(), 'lf-bundle-'))
  t.after(() => fs.rm(broken, { recursive: true, force: true }))
  await fs.cp(bundleDir, broken, { recursive: true })
  const meta = JSON.parse(await fs.readFile(path.join(broken, 'manifest.json')))
  await fs.appendFile(path.join(broken, meta.file), 'dañado')
  const fake = cli()
  const result = await openVSCode('/tmp', null, { ...fake.options, bundleDir: broken })
  assert.equal(result.stage, 'extension'); assert.match(result.error, /dañado/)
  meta.file = '../otro.vsix'; await fs.writeFile(path.join(broken, 'manifest.json'), JSON.stringify(meta))
  await assert.rejects(readBundle(broken), /metadatos/)
  assert.ok(!fake.calls.some(c => c.args.includes('--install-extension')))
})

test('S03: una preparación limpia incluye el plugin TypeScript local', async t => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'lf-vsix-build-'))
  t.after(() => fs.rm(base, { recursive: true, force: true }))
  await fs.cp('vscode-extension', path.join(base, 'vscode-extension'), {
    recursive: true, filter: file => file !== path.join('vscode-extension', 'node_modules'),
  })
  const events = path.join(base, 'src', 'core', 'events')
  await fs.mkdir(events, { recursive: true })
  for (const name of ['game-api.d.ts', 'apiParse.js']) {
    await fs.copyFile(path.join('src', 'core', 'events', name), path.join(events, name))
  }

  assert.equal((await prepareVSCodeExtension(base)).changed, true)
  const bundle = await readBundle(path.join(base, 'vendor', 'vscode-extension'))
  const zip = await JSZip.loadAsync(bundle.bytes, { checkCRC32: true })
  for (const name of ['index.js', 'package.json']) {
    const packed = zip.file(`extension/node_modules/levelforge-node-owner-types/${name}`)
    assert.ok(packed, name)
    assert.equal(await packed.async('string'), await fs.readFile(path.join('vscode-extension', 'lib', 'node-owner-types', name), 'utf8'))
  }
})

test('S03: VSIX oficial contiene exactamente la extensión existente y preparación repetida no reescribe', async () => {
  const bundle = await readBundle(bundleDir)
  const zip = await JSZip.loadAsync(bundle.bytes, { checkCRC32: true })
  for (const name of ['package.json', 'extension.js', 'lib/core.js', 'lib/bridge.js', 'lib/apiParse.mjs', 'snippets/levelforge.json', 'media/game-api.d.ts', 'README.md']) {
    const packaged = await zip.file('extension/' + (name === 'README.md' ? 'readme.md' : name)).async('string')
    assert.equal(packaged, await fs.readFile('vscode-extension/' + name, 'utf8'))
  }
  assert.ok(zip.file('extension.vsixmanifest'))
  const before = (await fs.stat(path.join(bundleDir, bundle.file))).mtimeMs
  assert.equal((await prepareVSCodeExtension()).changed, false)
  assert.equal((await fs.stat(path.join(bundleDir, bundle.file))).mtimeMs, before)
})

test('S03: recursos distribuidos y diálogo de reintento están conectados al flujo existente', async () => {
  const pkg = JSON.parse(await fs.readFile('package.json'))
  for (const platform of ['linux', 'win']) {
    assert.ok(pkg.build[platform].extraResources.some(r => r.from === 'vendor/vscode-extension' && r.to === 'vscode-extension'))
    assert.match(pkg.scripts[`dist:${platform}:package`], /^npm run vscode:prepare/)
  }
  const main = await fs.readFile('electron/main.cjs', 'utf8')
  assert.match(main, /app.isPackaged \? process.resourcesPath/)
  assert.match(main, /buttons: \['Reintentar', 'Cancelar'\]/)
  assert.match(main, /return \{ \.\.\.result, canceled: true \}/)
  for (const file of ['electron-start.mjs', 'electron-dev.mjs']) assert.match(await fs.readFile('scripts/' + file, 'utf8'), /await prepareVSCodeExtension\(root\)/)
})

for (const cancel of [false, true]) test(`S03: handler Electron real ${cancel ? 'cancela' : 'reintenta'} sin cambiar destino`, async () => {
  const source = await fs.readFile('electron/main.cjs', 'utf8')
  const handlerSource = source.slice(source.indexOf("ipcMain.handle('lf:openVSCode'"), source.indexOf('// ---- exportar el juego'))
  let handler, attempts = 0, dialogs = 0
  const context = {
    ipcMain: { handle: (_, fn) => { handler = fn } }, vscodeRetryDialogs: new WeakMap(),
    resolveIn: (root, relative) => path.resolve(root, relative), path,
    fs: { statSync: () => ({ isFile: () => true }) },
    app: { isPackaged: true, getPath: () => '/home/QA' }, process: { resourcesPath: '/opt/LevelForge/resources' },
    __dirname: '/opt/LevelForge/resources/app.asar/electron',
    BrowserWindow: { fromWebContents: () => ({ isDestroyed: () => false }) },
    dialog: { showMessageBox: async (_, options) => {
      dialogs++; assert.deepEqual(Array.from(options.buttons), ['Reintentar', 'Cancelar']); return { response: cancel ? 1 : 0 }
    } },
    vscodeBridge: { open: async (dir, file, options) => {
      attempts++; assert.equal(dir, '/tmp/Juego'); assert.equal(file, '/tmp/Juego/Assets/Receptor.js')
      assert.equal(typeof options.onPhase, 'function')
      options.onPhase('connecting')
      return attempts === 1 ? { ok: false, error: 'Disco sin permiso', stage: 'extension' } : { ok: true }
    } },
  }
  vm.runInNewContext(handlerSource, context)
  const result = await handler({ sender: { isDestroyed: () => false, send() {} } }, '/tmp/Juego', 'Assets/Receptor.js')
  assert.equal(result.ok, !cancel); assert.equal(attempts, cancel ? 1 : 2); assert.equal(dialogs, 1)
  if (cancel) assert.equal(result.canceled, true)
})
