import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('Editor integrado: sugerencias según propietario real', { timeout: 60000 }, async () => {
 await verifyWebGL({port:44287,fixture:'scripts/fixtures/editor/documentation-api-s01-g001.html',id:'documentation-api-result',minChecks:6})
})
