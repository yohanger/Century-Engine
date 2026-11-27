import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('S12-G004 · Electron embebido: creación de pistas e iconos Bootstrap sin accesos de Naturaleza', { timeout:70000 }, async () => {
  await verifyWebGL({ port:44550,
    fixture:'scripts/fixtures/editor/timeline-command-menu-icons-s12-g004.html',
    id:'timeline-command-menu-icons-s12-g004-result', minChecks:20, fixtureWaitMs:40000 })
})
