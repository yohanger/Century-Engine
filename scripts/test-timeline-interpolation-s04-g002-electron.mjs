import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('Electron embebido · interpolaciones de Timeline e Inspector estrecho', {timeout:60000}, async()=>{
  await verifyWebGL({port:44464,fixture:'scripts/fixtures/editor/timeline-interpolation-s04-g002.html',id:'timeline-interpolation-result',minChecks:37})
})
