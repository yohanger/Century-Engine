import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('Menú contextual de grupos, scroll, reparentado y Undo/Redo en Vue', { timeout: 60000 }, async () => {
  await verifyWebGL({port:44319,fixture:'scripts/fixtures/editor/move-to-collection-group.html',id:'move-to-collection-group-result',minChecks:13})
})
