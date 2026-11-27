// QA de permisos Linux: pruebas reales del Git embebido y del aprovisionamiento existente.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { prepareGit, prepareLinuxGit, LINUX_GIT_EXECUTABLES } from './prepare-vcs-git.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const linux = process.platform === 'linux'
const bin = path.join(root, LINUX_GIT_EXECUTABLES[0])
const helpers = path.dirname(path.join(root, LINUX_GIT_EXECUTABLES[1]))

function isolated() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lf-vcs-permissions-'))
  for (const relative of LINUX_GIT_EXECUTABLES) {
    const target = path.join(dir, relative)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.copyFileSync(path.join(root, relative), target)
  }
  return dir
}
function runBundled(args) {
  return spawnSync(bin, args, {
    cwd: root, encoding: 'utf8', timeout: 12000,
    env: { ...process.env, PATH: path.dirname(bin), GIT_EXEC_PATH: helpers,
      GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0',
      GIT_PROXY_COMMAND: '', http_proxy: '', https_proxy: '',
      HTTP_PROXY: '', HTTPS_PROXY: '', ALL_PROXY: '', all_proxy: '',
      NO_PROXY: '127.0.0.1', no_proxy: '127.0.0.1' },
  })
}

test('VCS-P01 · contrato define exactamente los tres ELF del Git Linux', () => {
  assert.deepEqual(LINUX_GIT_EXECUTABLES, [
    'vendor/git/linux-x64/bin/git',
    'vendor/git/linux-x64/libexec/git-core/git-remote-http',
    'vendor/git/linux-x64/libexec/git-core/git-remote-https',
  ])
})
test('VCS-P02 · restaurar 0644 a 0755 en los tres binarios tras extracción', { skip: !linux }, () => {
  const dir = isolated()
  try {
    for (const relative of LINUX_GIT_EXECUTABLES) fs.chmodSync(path.join(dir, relative), 0o644)
    const result = prepareLinuxGit(dir)
    assert.equal(result.binary, path.join(dir, LINUX_GIT_EXECUTABLES[0]))
    for (const relative of LINUX_GIT_EXECUTABLES) {
      assert.equal(fs.statSync(path.join(dir, relative)).mode & 0o777, 0o755)
      fs.accessSync(path.join(dir, relative), fs.constants.X_OK)
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
test('VCS-P03 · reparación idempotente, sin alterar otros archivos', { skip: !linux }, () => {
  const dir = isolated()
  try {
    const other = path.join(dir, 'vendor', 'git', 'linux-x64', 'README.txt')
    fs.writeFileSync(other, 'no ejecutable')
    fs.chmodSync(other, 0o600)
    prepareLinuxGit(dir)
    prepareLinuxGit(dir)
    assert.equal(fs.statSync(other).mode & 0o777, 0o600)
    assert.equal(fs.readFileSync(other, 'utf8'), 'no ejecutable')
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
test('VCS-P04 · auxiliar ausente produce error explícito, sin fallback', { skip: !linux }, () => {
  const dir = isolated()
  try {
    fs.rmSync(path.join(dir, LINUX_GIT_EXECUTABLES[2]))
    assert.throws(() => prepareLinuxGit(dir), /Git Linux embebido ausente: .*git-remote-https/)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
test('VCS-P05 · rechaza sustitución por symlink y binario no ELF', { skip: !linux }, () => {
  const dir = isolated()
  try {
    const http = path.join(dir, LINUX_GIT_EXECUTABLES[1])
    fs.rmSync(http)
    fs.symlinkSync(path.join(root, LINUX_GIT_EXECUTABLES[1]), http)
    assert.throws(() => prepareLinuxGit(dir, { checkExecution: false }), /no es un archivo regular/)
    fs.rmSync(http)
    fs.writeFileSync(http, Buffer.alloc(20))
    assert.throws(() => prepareLinuxGit(dir, { checkExecution: false }), /Binario Linux x86_64 inválido/)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
test('VCS-P06 · Windows no recibe chmod Linux ni descarga no solicitada', () => {
  const text = fs.readFileSync(path.join(root, 'scripts', 'prepare-vcs-git.mjs'), 'utf8')
  assert.match(text, /if \(platform === 'linux'\) return prepareLinuxGit\(root\)/)
  assert.match(text, /if\(platform!=='win32'\)/)
  for (const entry of ['scripts/electron-start.mjs', 'scripts/electron-dev.mjs']) {
    const startup = fs.readFileSync(path.join(root, entry), 'utf8')
    assert.match(startup, /if \(process\.platform === 'linux'\)/)
    assert.match(startup, /prepareLinuxGit\(root\)/)
  }
})
test('VCS-P07 · Git embebido se ejecuta sin Git del PATH', { skip: !linux }, async () => {
  const actual = await prepareGit(root, 'linux')
  assert.equal(actual.binary, bin)
  const result = runBundled(['--version'])
  assert.equal(result.error, undefined)
  assert.equal(result.status, 0)
  assert.match(result.stdout, /^git version 2\./)
})
test('VCS-P08 · --exec-path señala únicamente a los auxiliares embebidos', { skip: !linux }, () => {
  const result = runBundled(['--exec-path'])
  assert.equal(result.status, 0)
  assert.equal(result.stdout.trim(), helpers)
})
for (const protocol of ['http', 'https']) {
  test(`VCS-P09 · auxiliar ${protocol} ejecutable; localhost rechaza conexión sin fallo de permisos`, { skip: !linux }, () => {
    const result = runBundled(['ls-remote', `${protocol}://127.0.0.1:1/void`])
    assert.equal(result.error, undefined)
    assert.equal(result.status, 128) // No hay servidor en el puerto local 1; se prueba el arranque del auxiliar
    assert.match(result.stderr, /Failed to connect|Could not connect|Connection refused/)
    assert.doesNotMatch(result.stderr, /Permission denied|git: 'remote-|not a git command/i)
  })
}
test('VCS-P10 · la distribución Linux conserva los extraResources existentes', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  const extra = pkg.build.linux.extraResources
  assert(extra.some(r => r.from === 'vendor/git/linux-x64' && r.to === 'git/linux-x64'))
  assert.match(pkg.scripts['dist:linux:package'], /npm run vcs:prepare.*electron-builder --linux AppImage deb/)
})
test('VCS-P11 · mensajes EACCES distinguen permisos/noexec, sin fallback al Git del sistema', () => {
  const backend = fs.readFileSync(path.join(root, 'electron/vcs.cjs'), 'utf8')
  assert.match(backend, /EACCES.*permisos ejecutables y montaje noexec/)
  assert.match(backend, /spawn\(exe,/)
  assert.doesNotMatch(backend, /spawn\(['\"]git['\"]/)
})
