// Verifica grupos, pestañas, división y ventanas en Electron embebido; QA visual manual aparte.
import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('DOCK-E01 · docking Vue y ventanas existentes en Electron', { timeout: 60000 }, async () => {
  const result = await verifyWebGL({
    port: 44149,
    fixture: 'scripts/fixtures/editor/docking-s03-g001-integral.html',
    id: 'docking-s03-result',
    minChecks: 44,
  })
  console.log('DOCKING_S03_ELECTRON', JSON.stringify({ checks:result.checks.length,scope:'DOM Vue en Electron, sin GPU ni QA visual' }))
})
