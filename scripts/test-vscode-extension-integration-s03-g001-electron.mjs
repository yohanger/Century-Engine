import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('Electron S03 · apertura, instalación informada, cancelación y reintento (puente simulado)', { timeout: 60000 }, async () => {
  await verifyWebGL({ port: 44459, fixture: 'scripts/fixtures/editor/vscode-extension-integration-s03-g001.html', id: 'vscode-extension-result', minChecks: 12 })
})
