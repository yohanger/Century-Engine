import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('S13-G008-G003 · Electron real: asas de ambos extremos, waveform, automatización y persistencia', {timeout: 90000}, async () => {
  await verifyWebGL({port:44571,fixture:'scripts/fixtures/editor/timeline-audio-trim-both-ends-s13-g008-g003.html',
    id:'timeline-audio-trim-both-ends-s13-g008-g003-result',minChecks:46,fixtureWaitMs:55000})
})
