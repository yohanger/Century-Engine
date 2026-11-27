import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('Electron embebido · forma de onda, Inspector y transporte de audio', { timeout: 60000 }, async () => {
  await verifyWebGL({ port: 44543, fixture: 'scripts/fixtures/editor/timeline-audio-waveform-inspector-s11-g003.html',
    id: 'audio-waveform-result', minChecks: 22 })
})
