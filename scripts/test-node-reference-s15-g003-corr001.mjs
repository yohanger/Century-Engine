import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { createRequire } from 'node:module'
import { nodeReference, nodeReferenceFromDrop } from '../src/core/editor/node-reference.js'
const require = createRequire(import.meta.url)
const { createVSCodeBridge } = require('../electron/vscode-bridge.cjs')
const { startVSCodeBridge } = require('../vscode-extension/lib/bridge.js')
const root = new URL('..', import.meta.url)
const source = f => fs.readFile(new URL(f, root), 'utf8')
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

function payload(ids) {
  return { types: ['application/x-lf-node'], getData: type => type === 'application/x-lf-node' ? JSON.stringify(ids) : '' }
}

test('CORR-01: referencia estable por ID, escapada y sin serializar valores de nodo', () => {
  assert.equal(nodeReference('cam-A'), 'game.node("cam-A")')
  assert.equal(nodeReference('comillas"y\\barra'), 'game.node("comillas\\"y\\\\barra")')
  assert.throws(() => nodeReference('bad\ncode'), /inválido/)
  assert.throws(() => nodeReference(''), /inválido/)
})
test('CORR-02: soltado solo admite un nodo existente en escena activa', () => {
  const objects = [{ id: 'cam-A' }, { id: 'node-B' }]
  assert.equal(nodeReferenceFromDrop(payload(['cam-A']), objects), 'game.node("cam-A")')
  assert.equal(nodeReferenceFromDrop(payload(['outside']), objects), null)
  assert.equal(nodeReferenceFromDrop(payload(['cam-A', 'node-B']), objects), null)
  assert.equal(nodeReferenceFromDrop({ types: ['text/plain'], getData: () => 'cam-A' }, objects), null)
  assert.equal(nodeReferenceFromDrop({ types: ['application/x-lf-node'], getData: () => '{oops' }, objects), null)
})
test('CORR-03: CodeField reutilizado tiene selector y drop de Jerarquía, sin reemplazar editor JS', async () => {
  const text = await source('src/components/CodeField.vue')
  assert.match(text, /@drop\.capture="onNodeDrop"/)
  assert.match(text, /@dragover\.capture="onNodeDragOver"/)
  assert.match(text, /Insertar nodo…/)
  assert.match(text, /nodeReferenceFromDrop/)
  assert.match(text, /view\.dispatch/)
  assert.match(await source('src/components/ParamForm.vue'), /<CodeField v-else-if="p\.type === 'code'"/)
})
test('CORR-04: menú de Jerarquía usa la integración existente de VS Code', async () => {
  assert.match(await source('src/core/commands.js'), /Insertar referencia en VS Code/)
  assert.match(await source('src/core/state/project.js'), /insertNodeRefInVSCode/)
  assert.match(await source('src/core/state/vscode.js'), /insertNodeVSCode/)
  assert.match(await source('electron/preload.cjs'), /lf:insertNodeVSCode/)
  assert.match(await source('electron/main.cjs'), /lf:insertNodeVSCode/)
})

async function environment(t) {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'lf-ref-corr-'))
  const home = path.join(parent, 'level-forge')
  const other = path.join(parent, 'other')
  await fs.mkdir(path.join(home, 'Assets'), { recursive: true })
  await fs.mkdir(path.join(home, '.levelforge'))
  await fs.mkdir(path.join(other, 'Assets'), { recursive: true })
  await fs.writeFile(path.join(home, 'project.lfproj'), '{}')
  await fs.writeFile(path.join(home, 'Assets', 'Actor.js'), 'const node = ;\n')
  await fs.writeFile(path.join(other, 'Assets', 'outside.js'), '// other')
  let current = { uri: { fsPath: path.join(home, 'Assets', 'Actor.js'), scheme: 'file' }, languageId: 'javascript' }
  let body = 'const node = ;\n', editCalls = 0
  const vscode = {
    env: { appName: 'VS Code (QA)' },
    Uri: { file: fsPath => ({ fsPath }) },
    RelativePattern: class { constructor(base, relative) { this.base = base; this.relative = relative } },
    workspace: {
      workspaceFolders: [{ uri: { fsPath: home } }],
      onDidChangeWorkspaceFolders: () => ({ dispose() {} }),
      openTextDocument: async uri => ({ uri, languageId: 'javascript' }),
      createFileSystemWatcher: () => ({ onDidCreate: () => ({dispose(){}}), onDidChange: () => ({dispose(){}}), onDidDelete: () => ({dispose(){}}), dispose(){} }),
    },
    window: {
      state: { focused: true },
      get activeTextEditor() { return {
        document: current,
        selection: { start: 13, end: 13 },
        edit: async (callback) => { callback({ replace: (_selection, string) => { body = body.slice(0, 13) + string + body.slice(13); editCalls++ } }); return true },
      } },
      onDidChangeWindowState: () => ({dispose(){}}),
      showTextDocument: async () => {},
    },
    commands: { executeCommand: async () => {} },
  }
  let client
  const bridge = createVSCodeBridge({ graceMs: 100, connectMs: 500, requestMs: 500, minimumVersion: '0.1.5', launch: async () => {
    client = startVSCodeBridge(vscode, '0.1.5')
    return { ok: true, extension: { status:'current', version:'0.1.5' } }
  } })
  t.after(async () => { client?.dispose(); await bridge.close(); await fs.rm(parent, { recursive: true, force: true }) })
  assert.equal((await bridge.open(home, path.join(home, 'Assets', 'Actor.js'))).ok, true)
  return { home, other, bridge, setActive: doc => { current = doc }, get body() { return body }, get editCalls() { return editCalls } }
}

test('CORR-05: inserción real por TCP autenticado en documento JS activo de Assets', async t => {
  const env = await environment(t)
  const result = await env.bridge.insertNode(env.home, 'camera_ABC')
  assert.equal(result.ok, true, result.error)
  assert.match(env.body, /game\.node\("camera_ABC"\)/)
  assert.equal(env.editCalls, 1)
})
test('CORR-06: VS Code no permite insertar en un archivo ajeno al proyecto', async t => {
  const env = await environment(t)
  env.setActive({ uri: { fsPath: path.join(env.other, 'Assets', 'outside.js'), scheme: 'file' }, languageId: 'javascript' })
  const result = await env.bridge.insertNode(env.home, 'camera_ABC')
  assert.equal(result.ok, false)
  assert.equal(env.editCalls, 0)
})
test('CORR-07: VS Code rechaza la inserción si no está activo un script JavaScript de Assets', async t => {
  const env = await environment(t)
  env.setActive({ uri: { fsPath: path.join(env.home, 'Assets', 'Actor.js'), scheme: 'file' }, languageId: 'plaintext' })
  const result = await env.bridge.insertNode(env.home, 'camera_ABC')
  assert.equal(result.ok, false)
  assert.equal(env.editCalls, 0)
})
test('CORR-08: el puente rechaza IDs inválidos y no abre scripts alternativos', async t => {
  const env = await environment(t)
  assert.equal((await env.bridge.insertNode(env.home, 'bad\ncode')).ok, false)
  assert.equal(env.editCalls, 0)
  const result = await env.bridge.insertNode(env.home, 'id with " quotes')
  assert.equal(result.ok, true, result.error)
  assert.match(env.body, /game\.node\("id with \\" quotes"\)/)
})
test('CORR-09: los contratos G002/G003 permanecen disponibles para el consumo por ID', async () => {
  const nodes = await source('src/engine/runtime/events/play-nodes.js')
  const definitions = await source('src/core/events/game-api.d.ts')
  assert.match(nodes, /_nodeHandle\(name\)/)
  assert.match(definitions, /node\(name: NodeLike\): NodeHandle \| undefined/)
  assert.match(await source('src/engine/runtime/events/play-camera.js'), /_cameraAcquire\(id\)/)
})
