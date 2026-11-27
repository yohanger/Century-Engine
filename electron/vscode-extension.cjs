// Instalación de la extensión incluida; solo usa el CLI elegido por el lanzador.
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const { createHash } = require('node:crypto')
const semver = require('semver')
const pending = new Map()
const ID = 'levelforge.levelforge'

function installedVersion(stdout) {
  const matches = String(stdout).split(/\r?\n/).map(line => line.trim())
    .filter(line => line.toLowerCase().startsWith(ID + '@'))
    .map(line => line.slice(ID.length + 1))
  if (matches.some(version => !semver.valid(version))) throw new Error('VS Code devolvió una versión de Century inválida.')
  return matches.sort(semver.rcompare)[0] || null
}

async function readBundle(directory) {
  const manifest = JSON.parse(await fs.readFile(path.join(directory, 'manifest.json'), 'utf8'))
  if (manifest.id !== ID || !semver.valid(manifest.version) ||
      manifest.file !== `levelforge-${manifest.version}.vsix` || !/^[a-f0-9]{64}$/.test(manifest.sha256 || '')) {
    throw new Error('Los metadatos de la extensión incluida no son válidos.')
  }
  const file = path.join(directory, manifest.file)
  const bytes = await fs.readFile(file)
  if (createHash('sha256').update(bytes).digest('hex') !== manifest.sha256) {
    throw new Error('El paquete de la extensión está incompleto o dañado.')
  }
  return { ...manifest, bytes }
}

async function prepareExtension(launcher, invoke, { bundleDir, home = os.homedir() }) {
  const bundle = await readBundle(bundleDir)
  const before = installedVersion(await invoke(launcher, ['--list-extensions', '--show-versions']))
  if (before && semver.gte(before, bundle.version)) {
    return { status: semver.eq(before, bundle.version) ? 'current' : 'newer', version: before }
  }
  const flatpak = launcher.command === 'flatpak'
  const parent = flatpak
    ? path.join(home, '.var', 'app', 'com.visualstudio.code', 'cache', 'levelforge')
    : os.tmpdir()
  await fs.mkdir(parent, { recursive: true })
  const staging = await fs.mkdtemp(path.join(parent, 'lf-vscode-'))
  try {
    const vsix = path.join(staging, bundle.file)
    await fs.writeFile(vsix, bundle.bytes, { flag: 'wx' })
    if (flatpak) {
      // Verificar dentro del sandbox, sin overrides persistentes ni acceso adicional.
      await invoke({ command: 'flatpak', prefix: ['run', '--command=test', 'com.visualstudio.code'] }, ['-r', vsix])
    }
    await invoke(launcher, ['--install-extension', vsix, '--force'], 120000)
    const after = installedVersion(await invoke(launcher, ['--list-extensions', '--show-versions']))
    if (!after || semver.lt(after, bundle.version)) throw new Error('VS Code terminó la instalación pero no registra la versión requerida.')
    return { status: before ? 'updated' : 'installed', version: after }
  } finally {
    await fs.rm(staging, { recursive: true, force: true }).catch(() => {})
  }
}

function ensureExtension(launcher, invoke, options) {
  const key = JSON.stringify([launcher, options.bundleDir, options.home])
  if (!pending.has(key)) {
    const task = prepareExtension(launcher, invoke, options).finally(() => pending.delete(key))
    pending.set(key, task)
  }
  return pending.get(key)
}

module.exports = { ensureExtension, installedVersion, readBundle }
