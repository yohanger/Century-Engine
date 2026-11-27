import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { scriptOwnerTypes } from '../src/core/vscode/files.js'

const require = createRequire(import.meta.url)
const plugin = require('../vscode-extension/lib/node-owner-types/index.js')
const source = resolve(import.meta.dirname, '..')
const text = path => readFileSync(join(source, path), 'utf8')

const scripts = [
  { id: 's1', name: 'personaje.js', folder: 'Assets/Scripts', execution: 'node' },
  { id: 's2', name: 'compartido.js', folder: 'Assets/Scripts', execution: 'node' },
  { id: 's3', name: 'sin-asociar.js', folder: 'Assets/Scripts', execution: 'node' },
  { id: 's4', name: 'global.js', folder: 'Assets/Scripts', execution: 'global' },
]
const scenes = (shared = false) => new Map([
  ['a', { objects: [{ id: 'a', type: 'characterbody3d', scriptIds: ['s1', 's2'] }] }],
  ['b', { objects: [{ id: 'b', type: shared ? 'primitive' : 'characterbody3d', scriptIds: ['s2'] }] }],
])

test('G003 CORR001: propietario único se obtiene de las escenas, no de la selección ni del nombre', () => {
  const info = JSON.parse(scriptOwnerTypes({ scripts }, scenes(true)))
  assert.deepEqual(info.owners, { 'Assets/Scripts/personaje.js': 'characterbody3d' })
  const compatible = JSON.parse(scriptOwnerTypes({ scripts }, scenes(false)))
  assert.equal(compatible.owners['Assets/Scripts/compartido.js'], 'characterbody3d')
  assert.equal(info.owners['Assets/Scripts/sin-asociar.js'], undefined)
  assert.equal(info.owners['Assets/Scripts/global.js'], undefined)
})

test('G003 CORR001: Prefab no instanciado también impide inferencias falsas', () => {
  const meta = { scripts, prefabs: [{ objects: [{ type: 'primitive', scriptIds: ['s1'] }] }] }
  assert.deepEqual(JSON.parse(scriptOwnerTypes(meta, scenes())).owners, { 'Assets/Scripts/compartido.js': 'characterbody3d' })
})

test('G003 CORR001: scriptId anterior y scriptIds actual sin duplicar propietarios', () => {
  const legacy = new Map([['old', { objects: [{ type: 'characterbody3d', scriptId: 's1' }] }]])
  assert.deepEqual(JSON.parse(scriptOwnerTypes({ scripts }, legacy)).owners, { 'Assets/Scripts/personaje.js': 'characterbody3d' })
})

test('G003 CORR001: la definición física no contamina el NodeHandle general', () => {
  const dts = text('src/core/events/game-api.d.ts')
  assert.equal(dts, text('vscode-extension/media/game-api.d.ts'))
  const generic = dts.split('interface NodeScriptHandle extends NodeHandle {')[1].split('\n  }')[0]
  for (const prop of ['velocity', 'ground', 'onFloor', 'onWall', 'onCeiling']) {
    assert.match(dts, new RegExp(`interface CharacterBody3DNodeScriptHandle[\\s\\S]+?\\b${prop}\\b`))
    assert.doesNotMatch(generic, new RegExp(`\\b${prop}\\b`))
  }
  assert.match(dts, /declare const node: LF\.NodeScriptHandle/)
})

test('G003 CORR001: no altera el JS real, no infiere por ruta arbitraria ni sin metadatos', () => {
  const root = mkdtempSync(join(tmpdir(), 'lf-owner-'))
  try {
    mkdirSync(join(root, '.levelforge'))
    const file = join(root, 'Assets', 'Scripts', 'personaje.js')
    const other = join(root, 'Assets', 'Scripts', 'otro.js')
    const outside = join(root, 'tmp', 'personaje.js')
    assert.equal(plugin.ownerSuffix(root, file), '')
    writeFileSync(join(root, '.levelforge', 'script-owners.json'), scriptOwnerTypes({ scripts }, scenes(true)))
    assert.match(plugin.ownerSuffix(root, file), /LF\.CharacterBody3DNodeScriptHandle/)
    assert.equal(plugin.ownerSuffix(root, other), '')
    assert.equal(plugin.ownerSuffix(root, outside), '')
    assert.equal(plugin.ownerSuffix(root, join(root, '..', 'otro', 'Assets', 'Scripts', 'personaje.js')), '')
    assert.equal(plugin.ownerSuffix(root, join(root, 'Assets', 'Scripts', 'personaje.ts')), '')
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('G003 CORR001: Editor genera metadatos y la VSIX activa el plugin TS existente', () => {
  assert.match(text('src/core/state/vscode.js'), /scriptOwnerTypes\(meta, scenes\)/)
  assert.match(text('vscode-extension/extension.js'), /typescript\.reloadProjects/)
  const pkg = JSON.parse(text('vscode-extension/package.json'))
  assert.equal(pkg.contributes.typescriptServerPlugins[0].name, 'levelforge-node-owner-types')
  assert.equal(pkg.dependencies['levelforge-node-owner-types'], 'file:./lib/node-owner-types')
  assert.match(pkg.version, /^0\.1\.\d+$/)
})

test('G003 CORR001: manifiesto de extensión coincide con el VSIX distribuido', () => {
  const manifest = JSON.parse(text('vendor/vscode-extension/manifest.json'))
  assert.equal(manifest.version, JSON.parse(text('vscode-extension/package.json')).version)
  assert.equal(manifest.file, `levelforge-${manifest.version}.vsix`)
  const hash = createHash('sha256').update(readFileSync(join(source, 'vendor/vscode-extension', manifest.file))).digest('hex')
  assert.equal(hash, manifest.sha256)
})

test('G003 CORR001: TypeScript real distingue CharacterBody3D de los otros nodos', t => {
  let ts
  try { ts = require('typescript') } catch { t.skip('TypeScript no está instalado en el entorno de Node; usar el incluido en VS Code'); return }
  const root = mkdtempSync(join(tmpdir(), 'lf-ts-owner-'))
  try {
    mkdirSync(join(root, '.levelforge'), { recursive: true })
    mkdirSync(join(root, 'Assets', 'Scripts'), { recursive: true })
    const files = new Map()
    const api = join(root, '.levelforge', 'api.d.ts')
    files.set(api, text('src/core/events/game-api.d.ts'))
    const owner = join(root, 'Assets', 'Scripts', 'personaje.js')
    const shared = join(root, 'Assets', 'Scripts', 'compartido.js')
    const script = 'const v = node.velocity;\nnode.velocity = [1, v[1], 0];\nnode.onFloor;\nnode.operacionInexistente;\n'
    files.set(owner, script)
    files.set(shared, script)
    writeFileSync(join(root, '.levelforge', 'script-owners.json'), scriptOwnerTypes({ scripts }, scenes(true)))
    const host = {
      getCompilationSettings: () => ({ allowJs: true, checkJs: true, noEmit: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleDetection: ts.ModuleDetectionKind.Force, lib: ['lib.es2022.d.ts'] }),
      getScriptFileNames: () => [...files.keys()],
      getScriptVersion: () => '1',
      getScriptSnapshot(file) { const content = files.get(file) ?? (ts.sys.fileExists(file) ? ts.sys.readFile(file) : undefined); return content === undefined ? undefined : ts.ScriptSnapshot.fromString(content) },
      getCurrentDirectory: () => root,
      getDefaultLibFileName: options => ts.getDefaultLibFilePath(options),
      fileExists: f => files.has(f) || ts.sys.fileExists(f),
      readFile: f => files.get(f) || ts.sys.readFile(f),
      readDirectory: ts.sys.readDirectory,
      directoryExists: ts.sys.directoryExists,
      getDirectories: ts.sys.getDirectories,
    }
    const languageService = ts.createLanguageService(host)
    plugin({ typescript: ts }).create({ languageServiceHost: host, languageService, project: { getCurrentDirectory: () => root } })
    const errors = path => languageService.getSemanticDiagnostics(path).filter(d => d.code === 2339).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
    assert.deepEqual(errors(owner), ["Property 'operacionInexistente' does not exist on type 'CharacterBody3DNodeScriptHandle'."])
    assert.ok(errors(shared).some(m => m.includes("'velocity'")))
    assert.ok(errors(shared).some(m => m.includes("'onFloor'")))
    const ownerCompletions = languageService.getCompletionsAtPosition(owner, script.indexOf('node.velocity') + 5, {})?.entries || []
    const sharedCompletions = languageService.getCompletionsAtPosition(shared, script.indexOf('node.velocity') + 5, {})?.entries || []
    assert.ok(ownerCompletions.some(x => x.name === 'velocity'))
    assert.ok(!sharedCompletions.some(x => x.name === 'velocity'))
    assert.equal(files.get(owner), script, 'el documento JS real permanece intacto')
  } finally { rmSync(root, { recursive: true, force: true }) }
})
