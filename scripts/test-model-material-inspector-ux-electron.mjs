import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('Inspector compacto de materiales, edición, restauración, arrastre e historial', { timeout:60000 }, async () => {
  await verifyWebGL({port:44321,fixture:'scripts/fixtures/editor/model-material-inspector-ux.html',id:'material-inspector-result',minChecks:12})
})
