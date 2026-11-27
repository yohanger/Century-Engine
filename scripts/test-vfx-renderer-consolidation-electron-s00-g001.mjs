// Diagnóstico sobre clases reales: se ejecuta en el Electron del proyecto, sin navegador externo.
import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('VFX-CONSOL-S00 · inventario visual WebGL mediante Electron', { timeout: 50000 }, async () => {
  const result = await verifyWebGL({ port:43837, fixture:'scripts/fixtures/vfx/renderer-consolidation-audit.html', id:'vfx-consolidation-audit-result', minChecks:10 })
  console.log('LF_VFX_RENDERER_AUDIT:'+JSON.stringify(result.profiles))
})
