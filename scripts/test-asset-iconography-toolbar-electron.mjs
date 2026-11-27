import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('Proyecto y menú Ver reales en Electron', {timeout:60000}, async()=>{
  await verifyWebGL({port:44345,fixture:'scripts/fixtures/editor/asset-iconography-toolbar.html',id:'asset-iconography-result',minChecks:18})
})
