// Interfaz real del UI Designer en Electron integrado; no equivale a QA visual manual.
import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('UX05-E01 · UI Designer real: jerarquía, Canvas, Inspector, Assets y persistencia', { timeout: 90000 }, async () => {
  const result = await verifyWebGL({
    port: 44159,
    fixture: 'scripts/fixtures/editor/ui-designer-pro-ux-s05-g001-integral.html',
    id: 'ui-designer-s05-result',
    minChecks: 31,
    fixtureWaitMs: 45000,
  })
  console.log('UI_DESIGNER_S05_ELECTRON', JSON.stringify({ checks: result.checks.length, scope: 'DOM Vue y autoría .ui; sin GPU ni QA visual manual' }))
})
