import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('Editor real: Undo/Redo nativo, sensibilidad y preferencias responsivas', { timeout: 60000 }, async () => {
  await verifyWebGL({port:44339,fixture:'scripts/fixtures/editor/undo-context-and-mouse-sensitivity.html',id:'undo-context-result',minChecks:82})
})
