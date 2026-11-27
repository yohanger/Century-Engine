// LF-RUNTIME-S00-G001: retirada del shell heredado sin retirar el Runtime ni el personaje nativo.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const text = p => fs.readFileSync(path.join(root, p), 'utf8')
const exists = p => fs.existsSync(path.join(root, p))

test('RT-G001-01 · no queda ninguna entrada, carpeta o distribución Player heredada', () => {
  for (const p of ['src/player', 'src/player:deprecated', 'electron/player', 'player.html', 'dist-player'])
    assert.equal(exists(p), false, `${p} debe estar retirado`)
  for (const p of ['src/runtime-app/main.js', 'src/runtime-app/RuntimeApp.vue', 'src/runtime-app/storage.js',
    'electron/runtime/main.cjs', 'electron/runtime/preload.cjs', 'electron/runtime/saves.cjs', 'runtime.html'])
    assert.ok(exists(p), `${p} forma parte del Runtime autónomo`)
})

test('RT-G001-02 · Vite y electron-builder integran solo el Runtime exportable', () => {
  const pkg = JSON.parse(text('package.json'))
  assert.equal(pkg.scripts.build, 'vite build && vite build --mode runtime')
  assert.ok(pkg.build.files.includes('dist-runtime/**/*'))
  assert.ok(!pkg.build.files.includes('dist-player/**/*'))
  const v = text('vite.config.js')
  assert.match(v, /mode === 'runtime'/)
  assert.match(v, /runtime: F\('runtime\.html'\)/)
  assert.match(v, /outDir: 'dist-runtime'/)
  assert.match(v, /RUNTIME_CSP/)
  assert.match(v, /default-src 'none'/)
  assert.match(text('runtime.html'), /\/src\/runtime-app\/main\.js/)
  assert.match(text('electron/main.cjs'), /distDir: path\.join\(app\.getAppPath\(\), 'dist-runtime'\)/)
})

test('RT-G001-03 · Runtime autónomo reutiliza openGame, UI y guardado; no reintroduce el Editor', () => {
  const main = text('src/runtime-app/main.js')
  const app = text('src/runtime-app/RuntimeApp.vue')
  const storage = text('src/runtime-app/storage.js')
  assert.match(main, /registerUiComponents\(app\)/)
  assert.match(main, /createApp\(RuntimeApp\)/)
  assert.match(app, /import \{ openGame \} from '\.\.\/engine\/runtime\/index\.js'/)
  assert.match(app, /await openGame\(/)
  assert.match(app, /normalizeSceneTransitions/)
  assert.match(app, /game\.value\?\.dispose\(\)/)
  assert.match(storage, /\.lfRuntime\?\.storage/)
  assert.doesNotMatch(app + main + storage, /from ['"]\.\.\/core\/store/)
})

test('RT-G001-04 · puente expone únicamente lfRuntime y conserva los canales autorizados', () => {
  const preload = text('electron/runtime/preload.cjs')
  const shell = text('electron/runtime/main.cjs')
  assert.match(preload, /exposeInMainWorld\('lfRuntime'/)
  assert.doesNotMatch(preload + shell, /rtPlayer|rtp:/)
  for (const channel of ['game','diagnostics','quit','get','set','remove','keys','stats-toggle']) {
    assert.ok(preload.includes(`lf-runtime:${channel}`), `preload ${channel}`)
    assert.ok(shell.includes(`lf-runtime:${channel}`), `shell ${channel}`)
  }
  assert.match(shell, /if \(!fromRuntime\(e\)\) throw new Error\('no permitido'\)/)
  assert.match(shell, /setWindowOpenHandler\(\(\) => \(\{ action: 'deny' \}\)\)/)
  assert.match(shell, /will-navigate/)
  assert.match(shell, /setPermissionRequestHandler/)
})

test('RT-G001-05 · la exportación AppImage empaqueta el Runtime reubicado, no el Editor', async () => {
  const calls = new Map()
  const sq = {
    dir: () => ({}), addDir() {}, addSymlink() {},
    addFile(_root, dest, opts) { calls.set(dest, opts) },
    async writeSquashfs() { return { size: 100 } },
  }
  const fakeFs = {
    existsSync: () => true,
    readdirSync: () => [],
    readFileSync: file => String(file).includes('/electron/runtime/') ? fs.readFileSync(file) : Buffer.from('stub'),
    statSync: () => ({ isDirectory: () => false }), chmodSync() {}, renameSync() {},
  }
  const module = { exports: {} }
  runInNewContext(text('electron/appimage.cjs'), {
    require: name => name === 'node:path' ? path : name === 'node:fs' ? fakeFs : name === './squashfs.cjs' ? sq : null,
    __dirname: path.join(root, 'electron'), Buffer, console,
    process: { platform: 'linux', arch: 'x64', execPath: '/runtime/electron/bin' }, module,
  })
  const gameBytes = Buffer.from('game bytes')
  const result = await module.exports.exportAppImage({
    distDir: '/game/dist-runtime', runtimeDir: '/runtime/electron', runtimeExe: 'bin',
    outPath: '/tmp/test-lf-runtime.AppImage', name: 'Test', gameBytes, icon: Buffer.from('png'),
  })
  assert.ok(result.exec)
  assert.deepEqual(calls.get('resources/app/game.rtpkg').data, gameBytes)
  const main = calls.get('resources/app/main.cjs').data.toString()
  const preload = calls.get('resources/app/preload.cjs').data.toString()
  const saves = calls.get('resources/app/saves.cjs').data.toString()
  assert.match(main, /runtime\.html/)
  assert.match(preload, /lfRuntime/)
  assert.match(saves, /createSaves/)
  assert.ok(calls.has('resources/app/config.json'))
  assert.ok(calls.has('resources/app/package.json'))
})

test('RT-G001-06 · personaje nativo y API de juego siguen presentes', () => {
  assert.ok(exists('src/engine/runtime/player/controller.js'))
  assert.ok(exists('src/engine/runtime/player/index.js'))
  assert.match(text('src/engine/runtime/index.js'), /createPlayer, playerTypes, PlayerController/)
  assert.match(text('src/engine/runtime/package/game.js'), /new PlayMode\(graph\)/)
  assert.match(text('src/engine/runtime/package/game.js'), /graph\.player\.runtime = true/)
})

test('RT-G001-07 · las referencias activas a entradas heredadas desaparecieron', () => {
  for (const p of ['package.json','vite.config.js','electron/appimage.cjs','electron/main.cjs',
    'electron/vcs.cjs','src/main.js','src/tools-register.js','src/core/tools.js',
    'scripts/verify-editor-distribution.mjs']) {
    const content = text(p)
    for (const old of ['dist-player', 'electron/player', 'src/player/', 'player.html', '--mode player'])
      assert.equal(content.includes(old), false, `${p} contiene ${old}`)
  }
})
