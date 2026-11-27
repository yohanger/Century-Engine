// Empaqueta la extensión existente con vsce oficial; no publica en Marketplace.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import JSZip from 'jszip'
const run = promisify(execFile)
const require = createRequire(import.meta.url)
const root = fileURLToPath(new URL('..', import.meta.url))
const { readBundle } = require('../electron/vscode-extension.cjs')

export async function prepareVSCodeExtension(base = root) {
  const source = path.join(base, 'vscode-extension')
  const destination = path.join(base, 'vendor', 'vscode-extension')
  const manifest = JSON.parse(await fs.readFile(path.join(source, 'package.json'), 'utf8'))
  // Rechazar tipos desactualizados en lugar de cambiarlos silenciosamente.
  for (const [copy, original] of [['media/game-api.d.ts', 'src/core/events/game-api.d.ts'], ['lib/apiParse.mjs', 'src/core/events/apiParse.js']]) {
    if (!Buffer.from(await fs.readFile(path.join(source, copy))).equals(await fs.readFile(path.join(base, original)))) {
      throw new Error(`Extensión desactualizada: ${copy}. Ejecuta node scripts/sync-extension.mjs.`)
    }
  }
  const files = (await fs.readdir(source, { recursive: true })).sort()
  const hash = createHash('sha256')
  for (const name of files) {
    const file = path.join(source, name)
    if ((await fs.stat(file)).isFile()) hash.update(name.replaceAll('\\', '/') + '\0').update(await fs.readFile(file))
  }
  const sourceHash = hash.digest('hex')
  try {
    const existing = await readBundle(destination)
    if (existing.sourceHash === sourceHash && existing.version === manifest.version) return { changed: false, version: manifest.version }
  } catch { /* paquete ausente o dañado: se reconstruye */ }
  await fs.mkdir(destination, { recursive: true })
  const staging = await fs.mkdtemp(path.join(destination, '.package-'))
  try {
    const name = `levelforge-${manifest.version}.vsix`
    const output = path.join(staging, name)
    // VS Code carga el plugin TS como una dependencia NPM. Se materializa solo en staging:
    // el SOURCE_BASELINE nunca incorpora node_modules ni cambia el flujo de instalación.
    const packageSource = path.join(staging, 'source')
    const localModules = path.join(source, 'node_modules')
    await fs.cp(source, packageSource, { recursive: true, filter: file => file !== localModules })
    const pluginSource = path.join(packageSource, 'lib', 'node-owner-types')
    const pluginDestination = path.join(packageSource, 'node_modules', 'levelforge-node-owner-types')
    await fs.mkdir(path.dirname(pluginDestination), { recursive: true })
    // npm reconoce el paquete file: como enlace local y vsce incluye sus archivos en el VSIX.
    await fs.symlink(pluginSource, pluginDestination, process.platform === 'win32' ? 'junction' : 'dir')
    await run(process.execPath, [require.resolve('@vscode/vsce/vsce'), 'package', '--no-yarn', '--allow-missing-repository', '--skip-license', '--out', output], { cwd: packageSource, timeout: 120000 })
    const bytes = await fs.readFile(output)
    const zip = await JSZip.loadAsync(bytes, { checkCRC32: true })
    const packed = JSON.parse(await zip.file('extension/package.json').async('string'))
    if (`${packed.publisher}.${packed.name}` !== 'levelforge.levelforge' || packed.version !== manifest.version) throw new Error('Identidad VSIX incorrecta')
    for (const name of ['extension.js', 'lib/core.js', 'lib/bridge.js', 'lib/apiParse.mjs', 'media/game-api.d.ts', 'snippets/levelforge.json', 'node_modules/levelforge-node-owner-types/index.js', 'node_modules/levelforge-node-owner-types/package.json', 'node_modules/levelforge-node-owner-types/script-editables.cjs']) {
      if (!zip.file(`extension/${name}`)) throw new Error(`Falta ${name} en el VSIX`)
    }
    await fs.rename(output, path.join(destination, name))
    const metadata = { id: 'levelforge.levelforge', version: manifest.version, file: name, sha256: createHash('sha256').update(bytes).digest('hex'), sourceHash }
    await fs.writeFile(path.join(staging, 'manifest.json'), JSON.stringify(metadata, null, 2) + '\n')
    await fs.rename(path.join(staging, 'manifest.json'), path.join(destination, 'manifest.json'))
    for (const old of await fs.readdir(destination)) {
      if (/^levelforge-\d+\.\d+\.\d+\.vsix$/.test(old) && old !== name) await fs.unlink(path.join(destination, old))
    }
    return { changed: true, version: manifest.version }
  } finally { await fs.rm(staging, { recursive: true, force: true }) }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log('Extensión VS Code:', await prepareVSCodeExtension()) }
  catch (error) { console.error(error.message); process.exitCode = 1 }
}
