import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('S02-E01: ScenePanel real, cambio de autoridad visual y WebGL en Electron', { timeout: 60000 }, async () => {
  const result = await verifyWebGL({ port: 44302, fixture: 'scripts/fixtures/editor/scene-inspector-ownership-s02-g001.html', id: 'scene-inspector-ownership-s02-g001-result', minChecks: 18 })
  console.log('SCENE_INSPECTOR_OWNERSHIP_S02_ELECTRON', JSON.stringify({ checks: result.checks.length, scope: 'Vue ScenePanel, World manual/weather, layout 260px y WebGL; QA de usuario pendiente' }))
})
