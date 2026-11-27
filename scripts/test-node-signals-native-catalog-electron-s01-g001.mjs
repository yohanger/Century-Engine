// QA visual/físico con Electron embebido, sin navegador externo.
import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('SIG-CAT-E01 · catálogo nativo, conexión Area3D, Jolt WASM y WebGL2', { timeout: 90000 }, async () => {
  const result = await verifyWebGL({
    port: 44425,
    fixture: 'scripts/fixtures/nodes/node-signals-native-catalog-s01-g001.html',
    id: 'node-signals-native-catalog-s01-g001-result',
    minChecks: 20,
  })
  console.log('LF_SIGNALS_NATIVE_CATALOG_ELECTRON',JSON.stringify({checks:result.checks.length,gl:result.gl}))
})
