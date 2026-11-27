import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('S12-G007-G001 · Electron: nombres persistentes, secciones colapsables y scroll a cinco puntos', {timeout:70000}, async () => {
  await verifyWebGL({
    port:44559,
    fixture:'scripts/fixtures/editor/inspector-audio-volume-points-s12-g007-g001.html',
    id:'lf-inspector-volume-points-s12-g007-g001-result',
    minChecks:40,
    fixtureWaitMs:42000,
  })
})
