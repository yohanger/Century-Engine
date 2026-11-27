// QA contextual del Inspector real de Vue, con Electron/WebGL2/Jolt embebidos.
import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('TERRAIN-S04A: Inspector contextual, selección, persistencia visual y Jolt Electron', { timeout:90000 }, async () => {
  const result = await verifyWebGL({ port:44612, fixture:'scripts/fixtures/terrain/inspector-context-s04a-g001.html', id:'terrain-inspector-context-s04a-g001-result', minChecks:14 })
  console.log('LF_TERRAIN_INSPECTOR_CONTEXT_S04A_ELECTRON',JSON.stringify({checks:result.checks.length,gl:result.gl}))
})
