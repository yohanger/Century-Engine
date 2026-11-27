import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('Electron · Assets y Signals abren el editor local y VS Code queda bajo demanda', { timeout: 60000 }, async () => {
  await verifyWebGL({
    port: 44457,
    fixture: 'scripts/fixtures/editor/vscode-default-script-editor-s02-g001.html',
    id: 'vscode-default-result',
    minChecks: 19,
  })
})
