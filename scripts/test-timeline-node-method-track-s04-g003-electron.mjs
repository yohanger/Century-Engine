import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('Electron embebido · Métodos de nodo en Timeline e Inspector, DnD, historial y panel estrecho', { timeout: 60000 }, async () => {
  await verifyWebGL({ port: 44465, fixture: 'scripts/fixtures/editor/timeline-node-method-track-s04-g003.html', id: 'timeline-method-result', minChecks: 27 })
})
