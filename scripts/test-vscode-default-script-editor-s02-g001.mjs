import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dockPanelAvailable } from '../src/core/editor/docking.js'
import { parseInterface } from '../vscode-extension/lib/apiParse.mjs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('el editor interno se monta en Code y solo abre Electron bajo demanda', () => {
  assert.match(read('src/App.vue'), /<ScriptEditor v-if="!store\.locked && store\.project/)
  assert.match(read('src/components/ScriptEditor.vue'), /dock-panel-id="codeView"/)
  assert.match(read('src/components/ScriptEditor.vue'), /native-tool="code" :native-on-demand="true"/)
  assert.equal(dockPanelAvailable('scriptEditor', { scriptEditId: 'script-1' }), false)
  assert.equal(dockPanelAvailable('codeView', { scriptEditId: null }), true)
})

test('Assets, Inspector, árbol y Signals abren el editor interno; VS Code queda en una acción explícita', () => {
  const assets = read('src/components/ProjectPanel.vue')
  assert.match(assets, /@dblclick.stop="dblOpen\(it\)"/)
  assert.match(assets, /function dblOpen\(it\).*activate\(it\)/)
  assert.match(assets, /if \(it.kind === 'script'\) return openScriptEditor\(it.id\)/)
  assert.match(read('src/components/Inspector.vue'), /@click="openScriptEditor\(id\)"/)
  assert.match(read('src/components/SceneTree.vue'), /ids.length === 1 .*openScriptEditor\(ids\[0\]\)/)
  const signals = read('src/components/SignalConnectionsPanel.vue')
  assert.match(signals, /@click="openScriptEditor\(generationScriptId\)"/)
  assert.match(signals, /openScriptEditor\(result.scriptId\)/)
  assert.match(read('src/components/ScriptEditor.vue'), /case 'vscode': if \(sc.value\) openInVSCode\(sc.value.id\)/)
})

test('el modo se cambia en Assets por el mismo setter y una acción singular', () => {
  const assets = read('src/components/ProjectPanel.vue')
  assert.match(assets, /const own = !one \? \[\]/)
  assert.match(assets, /label: 'Global'.*setScriptExecution\(it.id, 'global'\)/)
  assert.match(assets, /label: 'Nodo'.*setScriptExecution\(it.id, 'node'\)/)
})

test('la extensión consulta los tipos del motor y sus snippets coinciden con los métodos publicados', () => {
  const dts = read('vscode-extension/media/game-api.d.ts')
  assert.equal(dts, read('src/core/events/game-api.d.ts'))
  assert.equal(read('vscode-extension/lib/apiParse.mjs'), read('src/core/events/apiParse.js'))
  const names = new Set(['NodeHandle', 'NodeScriptHandle'].flatMap(type => parseInterface(dts, type).map(m => m.name)))
  for (const name of ['define_signal', 'emit_signal', 'expose', 'connect', 'disconnect']) assert.ok(names.has(name), name)
  const snippets = Object.values(JSON.parse(read('vscode-extension/snippets/levelforge.json')))
  for (const snippet of snippets.filter(entry => /^lf-node-/.test(entry.prefix))) {
    assert.ok(names.has(/^node\.(\w+)/.exec(snippet.body[0])?.[1]), snippet.prefix)
  }
  assert.match(read('vscode-extension/extension.js'), /add\('node\.', \[[\s\S]+?parseInterface\(dts, 'NodeHandle'\)[\s\S]+?parseInterface\(dts, 'NodeScriptHandle'\)/)
})
