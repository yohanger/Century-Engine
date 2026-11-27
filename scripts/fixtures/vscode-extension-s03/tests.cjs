const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vscode = require('vscode')
exports.run = async () => {
  let stage = 'host-start'
  const state = {}, history = []
  const checkpoint = (phase, data = {}) => {
    history.push({ phase, at: new Date().toISOString() })
    Object.assign(state, data, { phase, history })
    fs.writeFileSync(process.env.LF_QA_VSCODE_RESULT, JSON.stringify(state))
  }
  checkpoint(stage, { codeVersion: vscode.version })
  try {
  const extension = vscode.extensions.getExtension('levelforge.levelforge')
  assert.ok(extension, 'Extensión instalada encontrada')
  assert.equal(extension.packageJSON.version, process.env.LF_QA_VSCODE_VERSION)
  assert.ok(extension.extensionPath.startsWith(process.env.LF_QA_VSCODE_EXTENSIONS), 'Se evalúa la instalación aislada, no developmentPath')
  stage = 'extension-found';checkpoint(stage, { version: extension.packageJSON.version, extensionPath: extension.extensionPath })
  await extension.activate()
  assert.ok(extension.isActive)
  stage = 'extension-activated';checkpoint(stage)
  const commands = await vscode.commands.getCommands(true)
  for (const name of ['levelforge.newScript', 'levelforge.prepare', 'levelforge.api']) assert.ok(commands.includes(name), name)
  const root = vscode.workspace.workspaceFolders[0].uri.fsPath
  if (process.env.LF_QA_VSCODE_HOST_COMPLETE) {
    // Diagnóstico acotado: no escribir el token del descriptor en la evidencia.
    let descriptor
    try {
      const data = JSON.parse(fs.readFileSync(path.join(root, '.levelforge/vscode-session.json'), 'utf8'))
      descriptor = { readable: true, rootMatches: data.root === fs.realpathSync(root), host: data.host, port: data.port, protocol: data.protocol }
    } catch (error) { descriptor = { readable: false, error: error.message } }
    checkpoint(stage, { workspace: root, descriptor })
  }
  const configBefore = fs.readFileSync(path.join(root, 'jsconfig.json'), 'utf8')
  await vscode.commands.executeCommand('levelforge.prepare')
  assert.equal(fs.readFileSync(path.join(root, 'jsconfig.json'), 'utf8'), configBefore)
  const snippets = JSON.parse(fs.readFileSync(path.join(extension.extensionPath, 'snippets/levelforge.json')))
  assert.ok(Object.values(snippets).some(s => s.prefix === 'lf-node-signal'))
  const document = await vscode.workspace.openTextDocument(path.join(root, 'Assets', 'QA.js'))
  await vscode.window.showTextDocument(document)
  // Esperar al servicio JavaScript real, sin sustituir las sugerencias por las del fixture.
  stage = 'intellisense';checkpoint(stage)
  for (const [line, prefix, expected] of [[0, 'game.', 'timeline'], [2, 'node.', 'connect'], [2, 'node.', 'emit_signal']]) {
    let found = false
    for (let attempt = 0; attempt < 60; attempt++) {
      const list = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', document.uri, new vscode.Position(line, prefix.length), '.')
      found = list?.items.some(i => (typeof i.label === 'string' ? i.label : i.label.label) === expected)
      if (found) break
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    assert.ok(found, `IntelliSense ${prefix}${expected}`)
  }
  console.log('LF_VSCODE_REAL_PASS: activación instalada, comandos, snippets, game.*, node.*, Signals y jsconfig')
  const result = { pass: true, version: extension.packageJSON.version }
  if (process.env.LF_QA_VSCODE_HOST_COMPLETE) {
    checkpoint('ready', result)
    for (let attempt = 0; !fs.existsSync(process.env.LF_QA_VSCODE_HOST_COMPLETE); attempt++) {
      assert.ok(attempt < 1200, 'El Editor no confirmó las aperturas del puente')
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    assert.notEqual(JSON.parse(fs.readFileSync(process.env.LF_QA_VSCODE_HOST_COMPLETE, 'utf8')).abort, true, 'El Editor abortó la prueba; no se declara PASS')
    const expected = path.join(root, 'Assets', 'Second.js')
    for (let attempt = 0; vscode.window.activeTextEditor?.document.uri.fsPath !== expected; attempt++) {
      assert.ok(attempt < 100, 'La ventana no enfocó el último archivo solicitado')
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    result.phase = 'complete'
  }
  checkpoint(result.phase || 'complete', result)
  } catch (error) {
    checkpoint('failed', { pass: false, stage, error: error.stack || error.message })
    throw error
  }
}
