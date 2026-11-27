import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('G004 · Electron embebido: Inspector, AudioEngine, Mixer, Preview y Player', { timeout:65000 }, async()=>{
  await verifyWebGL({port:44544, fixture:'scripts/fixtures/editor/timeline-audio-mixer-routing-s11-g004.html',
    id:'audio-mixer-routing-result', minChecks:30,fixtureWaitMs:30000})
})
