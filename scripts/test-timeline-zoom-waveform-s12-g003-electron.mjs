import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('S12-G003 · zoom cursor y waveform PCM adaptativa en Electron embebido', {timeout:70000}, async () => {
  await verifyWebGL({port:44549,
    fixture:'scripts/fixtures/editor/timeline-zoom-waveform-s12-g003.html',
    id:'timeline-zoom-waveform-s12-g003-result', minChecks:20, fixtureWaitMs:40000 })
})
