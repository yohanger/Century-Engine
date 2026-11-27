import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, copyFileSync, chmodSync, existsSync, rmSync, utimesSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { editorSourceFingerprint, BUILD_MANIFEST_NAME } from './editor-build-fingerprint.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const registry = JSON.parse(readFileSync(join(root, 'scripts/qa-suites.json'), 'utf8')).groups
const read = file => readFileSync(join(root, file), 'utf8')

function fixture(t, { built = false, verified = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'lf-electron-corr001-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const put = (name, content) => {
    const filename = join(dir, name)
    mkdirSync(dirname(filename), { recursive: true })
    writeFileSync(filename, content)
    return filename
  }
  put('package.json', '{"private":true,"version":"0.26.13","type":"module"}')
  put('package-lock.json', '{}')
  put('vite.config.js', 'export default {}')
  put('index.html', '<h1>index</h1>')
  put('filmmaker.html', '<h1>filmmaker</h1>')
  put('src/App.vue', '<template>test</template>')
  put('public/asset.txt', 'asset')
  for (const file of ['scripts/electron-start.mjs', 'scripts/electron-dev.mjs', 'scripts/editor-build-fingerprint.mjs']) {
    const out = join(dir, file); mkdirSync(dirname(out), { recursive: true }); copyFileSync(join(root, file), out)
  }
  put('scripts/prepare-vscode-extension.mjs', 'export const prepareVSCodeExtension = async () => ({changed:false})')
  put('scripts/prepare-vcs-git.mjs', 'export const prepareLinuxGit = () => ({platform:"linux"})')
  put('node_modules/electron/package.json', '{"name":"electron","main":"index.cjs"}')
  const electronExe = put('electron-stub.cjs', `#!/usr/bin/env node\nconst fs=require('node:fs'); fs.writeFileSync(process.env.LF_QA_ELECTRON_LOG, JSON.stringify({args:process.argv.slice(2), dev:process.env.VITE_DEV_URL||null}));`)
  chmodSync(electronExe, 0o755)
  put('node_modules/electron/index.cjs', `module.exports = ${JSON.stringify(electronExe)};`)
  put('node_modules/vite/bin/vite.js', `import { createServer } from 'node:http';\nimport { writeFileSync, mkdirSync } from 'node:fs';\nif (process.argv.includes('build')) { writeFileSync(process.env.LF_QA_BUILD_LOG, 'build'); mkdirSync('dist', {recursive:true}); writeFileSync('dist/index.html','ok'); writeFileSync('dist/filmmaker.html','ok'); process.exit(0) }\nwriteFileSync(process.env.LF_QA_VITE_SERVER_LOG, 'started');\nif (process.env.LF_QA_VITE_FAIL === '1') process.exit(3);\nconst port=Number(process.argv[process.argv.indexOf('--port')+1]); createServer((_req,res)=>{res.writeHead(200);res.end('ok')}).listen(port,'127.0.0.1');`)
  const fix = { dir, put, electronLog: join(dir, 'electron.json'), buildLog: join(dir, 'build.log'), viteLog: join(dir, 'vite-server.log') }
  if (built) {
    put('dist/index.html', '<script type="module" src="./assets/index-123.js"></script>')
    put('dist/filmmaker.html', '<script type="module" src="./assets/filmmaker-123.js"></script>')
    put('dist/assets/index-123.js', 'ok')
    put('dist/assets/filmmaker-123.js', 'ok')
    if (verified) writeManifest(fix)
  }
  return fix
}
function writeManifest(fix, override = {}) {
  const { sha256, fileCount } = editorSourceFingerprint(fix.dir)
  fix.put(`dist/${BUILD_MANIFEST_NAME}`, JSON.stringify({ schema: 1, sha256, fileCount, packageVersion: '0.26.13', ...override }))
}
function launch(fix, args = [], extraEnv = {}, script = 'electron-start.mjs') {
  return spawnSync(process.execPath, [`scripts/${script}`, ...args], {
    cwd: fix.dir, encoding: 'utf8', timeout: 12000,
    env: { ...process.env, LF_QA_ELECTRON_LOG: fix.electronLog, LF_QA_BUILD_LOG: fix.buildLog, LF_QA_VITE_SERVER_LOG: fix.viteLog, ...extraEnv },
  })
}
function assertElectron(fix, { filmmaker = false } = {}) {
  assert.ok(existsSync(fix.electronLog), 'Electron debe iniciarse')
  const electron = JSON.parse(readFileSync(fix.electronLog, 'utf8'))
  assert.equal(electron.dev, null, 'no debe heredar VITE_DEV_URL')
  assert.ok(electron.args.includes('.'))
  assert.equal(electron.args.includes('--filmmaker'), filmmaker)
}

test('TOOL-01 npm electron/start/filmmaker conservan el mismo launcher', () => {
  assert.equal(pkg.scripts.electron, 'node scripts/electron-start.mjs')
  assert.equal(pkg.scripts.start, pkg.scripts.electron)
  assert.equal(pkg.scripts.filmmaker, `${pkg.scripts.electron} --filmmaker`)
  assert.equal(pkg.scripts['electron:dev'], 'node scripts/electron-dev.mjs')
  assert.equal(pkg.scripts['filmmaker:dev'], 'node scripts/electron-dev.mjs --filmmaker')
})
test('TOOL-02 arranque normal abre Electron local sin servidor Vite ni recompilación', t => {
  const fix = fixture(t, { built: true }); const result = launch(fix)
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.equal(existsSync(fix.buildLog), false)
  assert.equal(existsSync(fix.viteLog), false)
  assert.doesNotMatch(result.stderr, /ADVERTENCIA/)
  assertElectron(fix)
})
test('TOOL-03 FilmMaker conserva su entrada nativa sin servidor Vite', t => {
  const fix = fixture(t, { built: true }); const result = launch(fix, ['--filmmaker'])
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.equal(existsSync(fix.viteLog), false)
  assertElectron(fix, { filmmaker: true })
})
test('TOOL-04 --built conserva el alias de dist existente', t => {
  const fix = fixture(t, { built: true }); const result = launch(fix, ['--built'])
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.equal(existsSync(fix.buildLog), false)
  assertElectron(fix)
})
test('TOOL-05 sin build se bloquea con error claro y sin abrir Electron ni Vite', t => {
  const fix = fixture(t), result = launch(fix)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /ERROR · BUILD NO DISPONIBLE.*dist\/index\.html/)
  assert.match(result.stderr, /npm run build/)
  assert.equal(existsSync(fix.electronLog), false)
  assert.equal(existsSync(fix.viteLog), false)
})
test('TOOL-06 --build es la ruta de compilación explícita (con simulador Vite)', t => {
  const fix = fixture(t), result = launch(fix, ['--build'])
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.equal(readFileSync(fix.buildLog, 'utf8'), 'build')
  assert.equal(existsSync(fix.viteLog), false)
  assert.match(result.stderr, /BUILD NO VERIFICABLE/) // el simulador no genera manifiesto
  assertElectron(fix)
})
test('TOOL-07 distribución conserva build previo y empaquetado', () => {
  assert.equal(pkg.scripts.build, 'vite build && vite build --mode runtime')
  for (const platform of ['linux', 'win']) {
    assert.match(pkg.scripts[`dist:${platform}`], /npm run build && npm run dist:/)
    assert.match(pkg.scripts[`dist:${platform}:package`], /electron-builder/)
  }
  assert.match(pkg.scripts['dist:filmmaker'], /^npm run build &&/)
})
test('TOOL-08 los grupos históricos de QA siguen presentes', () => {
  assert.equal(Object.keys(pkg.scripts).length, 27)
  assert.ok(Object.keys(registry).length >= 31)
  for (const [name, group] of Object.entries(registry)) {
    assert.ok(group.files?.length || group.steps?.length, name)
    for (const item of group.steps || [group]) {
      if (item.group) assert.ok(registry[item.group])
      else for (const file of item.files) assert.ok(file.startsWith('scripts/test-') && existsSync(join(root, file)), file)
    }
  }
  assert.equal(pkg.scripts['test:suite'], 'node scripts/qa-suite.mjs')
  assert.equal(pkg.scripts['test:distribution'], 'node --test scripts/test-editor-distribution-g001.mjs')
})
test('TOOL-09 el runner de desarrollo conserva el bloqueo ante fallo Vite', () => {
  const source = read('scripts/electron-dev.mjs')
  assert.match(source, /if \(!ready \|\| viteEnded\)/)
  assert.match(source, /Vite terminó antes de abrir Electron/)
  assert.match(source, /Vite no respondió en el puerto 5173/)
})
test('TOOL-10 flags WebGPU conservados en ambas rutas', () => {
  assert.match(read('scripts/electron-dev.mjs'), /process\.argv\.includes\('--webgpu'\)/)
  assert.match(read('scripts/electron-start.mjs'), /flags\.has\('--webgpu'\)/)
})
test('TOOL-11 fallo del servidor Vite afecta a electron:dev, pero no al modo normal', t => {
  const fix = fixture(t, { built: true })
  const normal = launch(fix, [], { LF_QA_VITE_FAIL: '1' })
  assert.equal(normal.status, 0, normal.stderr || normal.stdout)
  assert.equal(existsSync(fix.viteLog), false)
  const dev = launch(fix, [], { LF_QA_VITE_FAIL: '1' }, 'electron-dev.mjs')
  assert.equal(dev.status, 1, dev.stderr || dev.stdout)
  assert.equal(existsSync(fix.viteLog), true)
})
test('TOOL-12 fuente alterada = advertencia desactualizada y apertura permitida', t => {
  const fix = fixture(t, { built: true })
  fix.put('src/App.vue', '<template>modificado</template>')
  const result = launch(fix)
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.match(result.stderr, /ADVERTENCIA · BUILD DESACTUALIZADA/)
  assert.match(result.stderr, /npm run build/)
  assertElectron(fix)
})
test('TOOL-13 falta manifiesto legado = estado NO VERIFICABLE, sin falsa antigüedad', t => {
  const fix = fixture(t, { built: true, verified: false }), result = launch(fix)
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.match(result.stderr, /BUILD NO VERIFICABLE/)
  assert.doesNotMatch(result.stderr, /BUILD DESACTUALIZADA/)
  assertElectron(fix)
})
test('TOOL-14 manifiesto dañado = NO VERIFICABLE, sin bloquear', t => {
  const fix = fixture(t, { built: true })
  fix.put(`dist/${BUILD_MANIFEST_NAME}`, '{')
  const result = launch(fix)
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.match(result.stderr, /BUILD NO VERIFICABLE/)
  assertElectron(fix)
})
test('TOOL-15 versión de paquete divergente = desactualizada', t => {
  const fix = fixture(t, { built: true })
  writeManifest(fix, { packageVersion: '0.25.0' })
  const result = launch(fix)
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.match(result.stderr, /BUILD DESACTUALIZADA.*0\.25\.0.*0\.26\.13/)
  assertElectron(fix)
})
test('TOOL-16 bundle enlazado ausente = bloqueo de build incompleta', t => {
  const fix = fixture(t, { built: true })
  rmSync(join(fix.dir, 'dist/assets/index-123.js'))
  const result = launch(fix)
  assert.equal(result.status, 1)
  assert.match(result.stderr, /BUILD INCOMPLETA.*dist\/assets\/index-123\.js/)
  assert.equal(existsSync(fix.electronLog), false)
})
test('TOOL-17 VITE_DEV_URL heredada no cambia modo a servidor Vite', t => {
  const fix = fixture(t, { built: true })
  const result = launch(fix, [], { VITE_DEV_URL: 'http://127.0.0.1:9999/' })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assertElectron(fix)
})
test('TOOL-18 la huella es invariante a mtime y detecta archivos nuevos', t => {
  const fix = fixture(t)
  const initial = editorSourceFingerprint(fix.dir)
  const file = join(fix.dir, 'src/App.vue')
  utimesSync(file, new Date('2001-01-01'), new Date('2001-01-01'))
  assert.deepEqual(editorSourceFingerprint(fix.dir), initial)
  fix.put('src/New.vue', 'new')
  assert.notEqual(editorSourceFingerprint(fix.dir).sha256, initial.sha256)
})
test('TOOL-19 FilmMaker sin artefacto propio se bloquea aunque exista Editor', t => {
  const fix = fixture(t, { built: true })
  rmSync(join(fix.dir, 'dist/filmmaker.html'))
  const result = launch(fix, ['--filmmaker'])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /dist\/filmmaker\.html/)
  assert.equal(existsSync(fix.electronLog), false)
})
